// ─── GLOBALS ──────────────────────────────────
let allStores = [];
let allProducts = [];
let allCategories = [];
let currentPage = 1;
const PAGE_SIZE = 10;
let allPriceRecords = [];

// ─── INIT ─────────────────────────────────────
window.addEventListener('pywebviewready', function () {
  setCurrentDate();
  loadDashboard();
  loadStores();
  loadProducts();
  loadCategories();
  loadPriceHistory();
  loadPriceComparison();
});

// ─── DATE ─────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

function setCurrentDate() {
  const now = new Date();
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('current-date').textContent =
  now.toLocaleDateString('en-US', options);
}

function setRecordCount(elementId, count, label) {
  const el = document.getElementById(elementId);
  if (el) el.textContent = count + ' ' + label;
}

// ─── PAGE NAVIGATION ──────────────────────────
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + pageId).classList.add('active');
  const navMap = {
    dashboard: 0, stores: 1, products: 2,
    categories: 3, price_comparison: 4, price_history: 5
  };
  document.querySelectorAll('.nav-item')[navMap[pageId]]?.classList.add('active');
}

// ─── MODAL HELPERS ────────────────────────────
function showModal(id) {
  document.getElementById(id).classList.add('open');
}

function hideModal(id) {
  document.getElementById(id).classList.remove('open');
}

document.querySelectorAll('.overlay').forEach(o => {
  o.addEventListener('click', function (e) {
    if (e.target === this) this.classList.remove('open');
  });
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.overlay.open')
      .forEach(o => o.classList.remove('open'));
  }
});

// ─── TOAST ────────────────────────────────────
function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast' + (isError ? ' error' : '');
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ─── SEARCH / FILTER ──────────────────────────
function filterTable(tableId, query) {
  const table = document.getElementById(tableId);
  const rows = table.querySelectorAll('tbody tr');
  const q = query.toLowerCase();
  rows.forEach(row => {
    row.style.display =
      row.textContent.toLowerCase().includes(q) ? '' : 'none';
  });

}
function makeSortable(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const headers = table.querySelectorAll('th');
  const sortState = {};

  headers.forEach((th, colIndex) => {
    th.style.cursor = 'pointer';
    th.style.userSelect = 'none';
    th.addEventListener('click', () => {
      const tbody = table.querySelector('tbody');
      const rows  = Array.from(tbody.querySelectorAll('tr'));

      // Skip empty rows
      if (rows.length === 1 && rows[0].querySelector('.empty-msg')) return;

      const asc = !sortState[colIndex];
      sortState[colIndex] = asc;

      // Reset all headers
      headers.forEach(h => {
        h.textContent = h.textContent.replace(' ↑', '').replace(' ↓', '');
      });
      th.textContent += asc ? ' ↑' : ' ↓';

      rows.sort((a, b) => {
        const aText = (a.cells[colIndex]?.textContent || '').trim();
        const bText = (b.cells[colIndex]?.textContent || '').trim();

        // Try numeric sort first
        const aNum = parseFloat(aText.replace(/[^0-9.]/g, ''));
        const bNum = parseFloat(bText.replace(/[^0-9.]/g, ''));

        if (!isNaN(aNum) && !isNaN(bNum)) {
          return asc ? aNum - bNum : bNum - aNum;
        }

        return asc
          ? aText.localeCompare(bText)
          : bText.localeCompare(aText);
      });

      rows.forEach(row => tbody.appendChild(row));
    });
  });
}

// ─── LOGOUT ───────────────────────────────────
function confirmLogout() {
  if (confirm('Are you sure you want to exit?')) {
    window.pywebview.api.get_dashboard_stats().then(() => {});
    window.close();
  }
}

// ══════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════
function loadDashboard() {
  window.pywebview.api.get_dashboard_stats().then(res => {
    const data = JSON.parse(res);

    document.getElementById('stat-products').textContent = data.total_products;
    document.getElementById('stat-stores').textContent   = data.total_stores;
    document.getElementById('stat-prices').textContent   = data.total_prices;

    // Recent prices table
    const tbody = document.getElementById('dashboard-recent-table');
    if (data.recent_prices.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-msg">No price records yet.</td></tr>';
    } else {
      tbody.innerHTML = data.recent_prices.map(r => `
        <tr>
          <td>${r.product_name}</td>
          <td>${r.store_name}</td>
          <td class="price-col price-low">₱${parseFloat(r.price).toFixed(2)}</td>
          <td>${r.date_recorded}</td>
        </tr>
      `).join('');
    }
  });

  // Categories on dashboard
  window.pywebview.api.get_all_categories().then(res => {
    const cats = JSON.parse(res);
    const tbody = document.getElementById('dashboard-categories-table');
    if (cats.length === 0) {
      tbody.innerHTML = '<tr><td colspan="2" class="empty-msg">No categories yet.</td></tr>';
    } else {
      tbody.innerHTML = cats.map(c => `
        <tr>
          <td><strong>${c.category_name}</strong></td>
          <td>${c.category_description || '—'}</td>
        </tr>
      `).join('');
    }
  });
}

// ══════════════════════════════════════════════
// STORES
// ══════════════════════════════════════════════
function loadStores() {
  window.pywebview.api.get_all_stores().then(res => {
    allStores = JSON.parse(res);
    const tbody = document.getElementById('stores-tbody');

    if (allStores.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-msg">No stores yet. Click Add Store!</td></tr>';
      return;
    }
    setRecordCount('stores-count', allStores.length, 'stores');
    tbody.innerHTML = allStores.map((s, i) => `
      <tr class="clickable" onclick="openStorePreview(${s.store_id})">
        <td>${i + 1}</td>
        <td><strong>${s.store_name}</strong></td>
        <td><span class="badge badge-green">${s.store_type}</span></td>
        <td>${s.barangay}</td>
        <td>${s.street || '—'}</td>
        <td>${s.contact_number || '—'}</td>
        <td>
          <div class="action-row" onclick="event.stopPropagation()">
            <div class="act-btn" onclick="openEditStore(${s.store_id})" title="Edit"><i data-lucide="pencil"></i></div>
            <div class="act-btn del" onclick="openDeleteStore(${s.store_id}, '${s.store_name}')" title="Delete"><i data-lucide="trash-2"></i></div>
          </div>
        </td>
      </tr>
    `).join('');

    refreshStoreDropdown();
    makeSortable('stores-table');
    renderIcons()
  });
}

function submitAddStore() {
  const name    = document.getElementById('add-store-name').value.trim();
  const type    = document.getElementById('add-store-type').value;
  const street  = document.getElementById('add-store-street').value.trim();
  const barangay = document.getElementById('add-store-barangay').value.trim();
  const contact = document.getElementById('add-store-contact').value.trim();

  if (!name || !type || !barangay) {
    showToast('Please fill all required fields!', true); return;
  }

  window.pywebview.api.add_store(name, type, street, barangay, contact).then(res => {
    const result = JSON.parse(res);
    if (result.success) {
      hideModal('modal-store-add');
      document.getElementById('add-store-name').value    = '';
      document.getElementById('add-store-type').value    = '';
      document.getElementById('add-store-street').value  = '';
      document.getElementById('add-store-barangay').value = '';
      document.getElementById('add-store-contact').value = '';
      loadStores();
      loadDashboard();
      showToast('✅ ' + result.message);
    } else {
      showToast('❌ ' + result.message, true);
    }
  });
}

function openEditStore(storeId) {
  const s = allStores.find(x => x.store_id === storeId);
  if (!s) return;
  document.getElementById('edit-store-id').value       = s.store_id;
  document.getElementById('edit-store-name').value     = s.store_name;
  document.getElementById('edit-store-type').value     = s.store_type;
  document.getElementById('edit-store-street').value   = s.street || '';
  document.getElementById('edit-store-barangay').value = s.barangay;
  document.getElementById('edit-store-contact').value  = s.contact_number || '';

  // Preview
  document.getElementById('edit-store-preview-name').textContent = s.store_name;
  document.getElementById('edit-store-preview-meta').textContent =
    s.store_type + ' • ' + s.barangay;

  showModal('modal-store-edit');
}

function submitEditStore() {
  const id      = document.getElementById('edit-store-id').value;
  const name    = document.getElementById('edit-store-name').value.trim();
  const type    = document.getElementById('edit-store-type').value;
  const street  = document.getElementById('edit-store-street').value.trim();
  const barangay = document.getElementById('edit-store-barangay').value.trim();
  const contact = document.getElementById('edit-store-contact').value.trim();

  if (!name || !type || !barangay) {
    showToast('Please fill all required fields!', true); return;
  }

  window.pywebview.api.update_store(
    parseInt(id), name, type, street, barangay, contact
  ).then(res => {
    const result = JSON.parse(res);
    if (result.success) {
      hideModal('modal-store-edit');
      loadStores();
      loadDashboard();
      showToast('✅ ' + result.message);
    } else {
      showToast('❌ ' + result.message, true);
    }
  });
}

function openDeleteStore(storeId, storeName) {
  document.getElementById('delete-store-id').value   = storeId;
  document.getElementById('delete-store-name').textContent = storeName;
  showModal('modal-store-delete');
}

function submitDeleteStore() {
  const id = parseInt(document.getElementById('delete-store-id').value);
  window.pywebview.api.delete_store(id).then(res => {
    const result = JSON.parse(res);
    if (result.success) {
      hideModal('modal-store-delete');
      loadStores();
      loadDashboard();
      loadPriceHistory();
      showToast('🗑️ ' + result.message);
    } else {
      showToast('❌ ' + result.message, true);
    }
  });
}

function refreshStoreDropdown() {
  const select = document.getElementById('add-price-store');
  select.innerHTML = '<option value="" disabled selected>Select store...</option>' +
    allStores.map(s => `<option value="${s.store_id}">${s.store_name}</option>`).join('');
}

// ══════════════════════════════════════════════
// STORE PREVIEW
// ══════════════════════════════════════════════
function openStorePreview(storeId) {
  window.pywebview.api.get_store_preview(storeId).then(res => {
    const data = JSON.parse(res);
    const s = data.store;

    document.getElementById('preview-store-title').textContent   = s.store_name;
    document.getElementById('preview-store-type').textContent    = s.store_type;
    document.getElementById('preview-store-barangay').textContent = s.barangay || '—';
    document.getElementById('preview-store-street').textContent  = s.street || '—';
    document.getElementById('preview-store-contact').textContent = s.contact_number || '—';
    document.getElementById('preview-store-count').textContent   = data.price_count;

    // Cheapest product
    const cheapBox = document.getElementById('preview-store-cheapest');
    if (data.cheapest) {
      cheapBox.innerHTML = `
        <strong>${data.cheapest.product_name}</strong>
        <span style="float:right;color:var(--green);font-size:15px;font-weight:800">
          ₱${parseFloat(data.cheapest.price).toFixed(2)}
        </span>
        <div style="font-size:11px;color:var(--muted);margin-top:4px">
          Recorded on ${formatDate(data.cheapest.date_recorded)}
        </div>
      `;
    } else {
      cheapBox.textContent = 'No price records yet';
    }

    // Recent records
    const tbody = document.getElementById('preview-store-recent');
    if (data.recent.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="empty-msg">No records yet</td></tr>';
    } else {
      tbody.innerHTML = data.recent.map(r => `
        <tr>
          <td><strong>${r.product_name}</strong></td>
          <td class="price-low">₱${parseFloat(r.price).toFixed(2)}</td>
          <td>${formatDate(r.date_recorded)}</td>
        </tr>
      `).join('');
    }

    // Edit button
    document.getElementById('preview-store-edit-btn').onclick = () => {
      hideModal('modal-store-preview');
      openEditStore(storeId);
    };

    showModal('modal-store-preview');
    renderIcons();
  });
}

// ══════════════════════════════════════════════
// CATEGORIES
// ══════════════════════════════════════════════
function loadCategories() {
  window.pywebview.api.get_all_categories().then(res => {
    allCategories = JSON.parse(res);
    const tbody = document.getElementById('categories-tbody');

    if (allCategories.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-msg">No categories yet. Click Add Category!</td></tr>';
      return;
    }
    setRecordCount('categories-count', allCategories.length, 'categories');
    tbody.innerHTML = allCategories.map((c, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${c.category_name}</strong></td>
        <td>${c.category_description || '—'}</td>
        <td>
          <div class="action-row">
            <div class="act-btn" onclick="openEditCategory(${c.category_id})" title="Edit"><i data-lucide="pencil"></i></div>
            <div class="act-btn del" onclick="openDeleteCategory(${c.category_id}, '${c.category_name}')" title="Delete"><i data-lucide="trash-2"></i></div>
          </div>
        </td>
      </tr>
    `).join('');

    refreshCategoryCheckboxes();
    makeSortable('categories-table');
    renderIcons()
  });
}

function submitAddCategory() {
  const name = document.getElementById('add-cat-name').value.trim();
  const desc = document.getElementById('add-cat-desc').value.trim();

  if (!name) { showToast('Category name is required!', true); return; }

  window.pywebview.api.add_category(name, desc).then(res => {
    const result = JSON.parse(res);
    if (result.success) {
      hideModal('modal-category-add');
      document.getElementById('add-cat-name').value = '';
      document.getElementById('add-cat-desc').value = '';
      loadCategories();
      loadDashboard();
      showToast('✅ ' + result.message);
    } else {
      showToast('❌ ' + result.message, true);
    }
  });
}

function openEditCategory(catId) {
  const c = allCategories.find(x => x.category_id === catId);
  if (!c) return;
  document.getElementById('edit-cat-id').value   = c.category_id;
  document.getElementById('edit-cat-name').value = c.category_name;
  document.getElementById('edit-cat-desc').value = c.category_description || '';

  // Preview
  document.getElementById('edit-cat-preview-name').textContent = c.category_name;
  document.getElementById('edit-cat-preview-meta').textContent =
    c.category_description || 'No description';

  showModal('modal-category-edit');
}

function submitEditCategory() {
  const id   = document.getElementById('edit-cat-id').value;
  const name = document.getElementById('edit-cat-name').value.trim();
  const desc = document.getElementById('edit-cat-desc').value.trim();

  if (!name) { showToast('Category name is required!', true); return; }

  window.pywebview.api.update_category(parseInt(id), name, desc).then(res => {
    const result = JSON.parse(res);
    if (result.success) {
      hideModal('modal-category-edit');
      loadCategories();
      loadDashboard();
      showToast('✅ ' + result.message);
    } else {
      showToast('❌ ' + result.message, true);
    }
  });
}

function openDeleteCategory(catId, catName) {
  document.getElementById('delete-cat-id').value          = catId;
  document.getElementById('delete-cat-name').textContent  = catName;
  showModal('modal-category-delete');
}

function submitDeleteCategory() {
  const id = parseInt(document.getElementById('delete-cat-id').value);
  window.pywebview.api.delete_category(id).then(res => {
    const result = JSON.parse(res);
    if (result.success) {
      hideModal('modal-category-delete');
      loadCategories();
      loadDashboard();
      showToast('🗑️ ' + result.message);
    } else {
      showToast('❌ ' + result.message, true);
    }
  });
}

function refreshCategoryCheckboxes() {
  ['add-prod-categories', 'edit-prod-categories'].forEach(id => {
    const container = document.getElementById(id);
    container.innerHTML = allCategories.map(c => `
      <label class="checkbox-item">
        <input type="checkbox" value="${c.category_id}">
        ${c.category_name}
      </label>
    `).join('');
  });
}

// ══════════════════════════════════════════════
// PRODUCTS
// ══════════════════════════════════════════════
function loadProducts() {
  window.pywebview.api.get_all_products().then(res => {
    allProducts = JSON.parse(res);
    const tbody = document.getElementById('products-tbody');

    if (allProducts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-msg">No products yet. Click Add Product!</td></tr>';
      return;
    }
    setRecordCount('products-count', allProducts.length, 'products');
    tbody.innerHTML = allProducts.map((p, i) => `
      <tr class="clickable" onclick="openProductPreview(${p.product_id})">
        <td>${i + 1}</td>
        <td><strong>${p.product_name}</strong></td>
        <td>${p.product_brand}</td>
        <td><span class="badge badge-blue">${p.product_unit}</span></td>
        <td>${p.categories || '—'}</td>
        <td>
          <div class="action-row" onclick="event.stopPropagation()">
            <div class="act-btn" onclick="openEditProduct(${p.product_id})" title="Edit"><i data-lucide="pencil"></i></div>
            <div class="act-btn del" onclick="openDeleteProduct(${p.product_id}, '${p.product_name}')" title="Delete"><i data-lucide="trash-2"></i></div>
          </div>
        </td>
      </tr>
    `).join('');

    refreshProductDropdown();
    makeSortable('products-table');
    renderIcons()
  });
}

function submitAddProduct() {
  const name  = document.getElementById('add-prod-name').value.trim();
  const brand = document.getElementById('add-prod-brand').value.trim();
  const unit  = document.getElementById('add-prod-unit').value.trim();
  const checks = document.querySelectorAll('#add-prod-categories input[type="checkbox"]:checked');
  const catIds = Array.from(checks).map(c => parseInt(c.value));

  if (!name || !brand || !unit) {
    showToast('Please fill all required fields!', true); return;
  }
  if (catIds.length === 0) {
    showToast('Please select at least one category!', true); return;
  }

  window.pywebview.api.add_product(name, unit, brand, catIds).then(res => {
    const result = JSON.parse(res);
    if (result.success) {
      hideModal('modal-product-add');
      document.getElementById('add-prod-name').value  = '';
      document.getElementById('add-prod-brand').value = '';
      document.getElementById('add-prod-unit').value  = '';
      loadProducts();
      loadDashboard();
      showToast('✅ ' + result.message);
    } else {
      showToast('❌ ' + result.message, true);
    }
  });
}

function openEditProduct(prodId) {
  const p = allProducts.find(x => x.product_id === prodId);
  if (!p) return;
  document.getElementById('edit-prod-id').value    = p.product_id;
  document.getElementById('edit-prod-name').value  = p.product_name;
  document.getElementById('edit-prod-brand').value = p.product_brand;
  document.getElementById('edit-prod-unit').value  = p.product_unit;

  // Preview
  document.getElementById('edit-prod-preview-name').textContent = p.product_name;
  document.getElementById('edit-prod-preview-meta').textContent =
    p.product_brand + ' • ' + p.product_unit;

  const currentCats = (p.categories || '').split(', ');
  document.querySelectorAll('#edit-prod-categories input[type="checkbox"]').forEach(cb => {
    const label = cb.parentElement.textContent.trim();
    cb.checked = currentCats.includes(label);
  });

  showModal('modal-product-edit');
}

function submitEditProduct() {
  const id    = document.getElementById('edit-prod-id').value;
  const name  = document.getElementById('edit-prod-name').value.trim();
  const brand = document.getElementById('edit-prod-brand').value.trim();
  const unit  = document.getElementById('edit-prod-unit').value.trim();
  const checks = document.querySelectorAll('#edit-prod-categories input[type="checkbox"]:checked');
  const catIds = Array.from(checks).map(c => parseInt(c.value));

  if (!name || !brand || !unit) {
    showToast('Please fill all required fields!', true); return;
  }
  if (catIds.length === 0) {
    showToast('Please select at least one category!', true); return;
  }

  window.pywebview.api.update_product(
    parseInt(id), name, unit, brand, catIds
  ).then(res => {
    const result = JSON.parse(res);
    if (result.success) {
      hideModal('modal-product-edit');
      loadProducts();
      loadDashboard();
      showToast('✅ ' + result.message);
    } else {
      showToast('❌ ' + result.message, true);
    }
  });
}

function openDeleteProduct(prodId, prodName) {
  document.getElementById('delete-prod-id').value          = prodId;
  document.getElementById('delete-prod-name').textContent  = prodName;
  showModal('modal-product-delete');
}

function submitDeleteProduct() {
  const id = parseInt(document.getElementById('delete-prod-id').value);
  window.pywebview.api.delete_product(id).then(res => {
    const result = JSON.parse(res);
    if (result.success) {
      hideModal('modal-product-delete');
      loadProducts();
      loadDashboard();
      loadPriceHistory();
      showToast('🗑️ ' + result.message);
    } else {
      showToast('❌ ' + result.message, true);
    }
  });
}

function refreshProductDropdown() {
  const select = document.getElementById('add-price-product');
  select.innerHTML = '<option value="" disabled selected>Select product...</option>' +
    allProducts.map(p =>
      `<option value="${p.product_id}">${p.product_name}</option>`
    ).join('');
}

// ══════════════════════════════════════════════
// PRODUCT PREVIEW
// ══════════════════════════════════════════════
function openProductPreview(productId) {
  window.pywebview.api.get_product_preview(productId).then(res => {
    const data = JSON.parse(res);
    const p = data.product;

    document.getElementById('preview-product-title').textContent    = p.product_name;
    document.getElementById('preview-product-brand').textContent    = p.product_brand;
    document.getElementById('preview-product-unit').textContent     = p.product_unit;
    document.getElementById('preview-product-brand-val').textContent = p.product_brand;
    document.getElementById('preview-product-categories').textContent =
      data.categories.length > 0 ? data.categories.join(', ') : '—';

    // Prices across stores
    const tbody = document.getElementById('preview-product-prices');
    const noPrice = document.getElementById('preview-product-no-prices');

    if (data.prices.length === 0) {
      tbody.innerHTML = '';
      noPrice.style.display = 'block';
      document.getElementById('preview-product-prices-table').style.display = 'none';
    } else {
      noPrice.style.display = 'none';
      document.getElementById('preview-product-prices-table').style.display = 'table';

      const lowestPrice = Math.min(...data.prices.map(x => x.price));

      tbody.innerHTML = data.prices.map((pr, i) => {
        const isLowest = pr.price === lowestPrice;
        return `
          <tr>
            <td>${pr.store_name}</td>
            <td class="${isLowest ? 'price-low' : 'price-mid'}">
              ₱${parseFloat(pr.price).toFixed(2)}
              ${isLowest ? '<span class="badge badge-green" style="margin-left:6px">Cheapest</span>' : ''}
            </td>
            <td>${formatDate(pr.date_recorded)}</td>
            <td>${i === 0 && data.prices.length > 1 ?
              `<span style="font-size:10px;color:var(--green);font-weight:700">
                saves ₱${(Math.max(...data.prices.map(x=>x.price)) - pr.price).toFixed(2)}
              </span>` : ''}
            </td>
          </tr>
        `;
      }).join('');
    }

    // Edit button
    document.getElementById('preview-product-edit-btn').onclick = () => {
      hideModal('modal-product-preview');
      openEditProduct(productId);
    };

    showModal('modal-product-preview');
    renderIcons();
  });
}

// ══════════════════════════════════════════════
// PRICE HISTORY
// ══════════════════════════════════════════════
function loadPriceHistory() {
  window.pywebview.api.get_all_prices().then(res => {
    allPriceRecords = JSON.parse(res);
    currentPage = 1;
    renderPriceHistoryPage();
    setRecordCount('history-count', allPriceRecords.length, 'records');
  });
}

function renderPriceHistoryPage() {
  const tbody      = document.getElementById('history-tbody');
  const totalPages = Math.max(1, Math.ceil(allPriceRecords.length / PAGE_SIZE));
  const start      = (currentPage - 1) * PAGE_SIZE;
  const end        = start + PAGE_SIZE;
  const pageData   = allPriceRecords.slice(start, end);

  if (allPriceRecords.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-msg">No price records yet.</td></tr>';
    document.getElementById('pagination-info').textContent = '';
    document.getElementById('pagination-controls').innerHTML = '';
    return;
  }

  tbody.innerHTML = pageData.map(p => `
    <tr>
      <td><strong>${p.product_name}</strong></td>
      <td>${p.store_name}</td>
      <td><span class="badge badge-blue">${p.product_unit}</span></td>
      <td class="price-low">₱${parseFloat(p.price).toFixed(2)}</td>
      <td>${formatDate(p.date_recorded)}</td>
      <td>
        <div class="action-row">
          <div class="act-btn del"
            onclick="openDeletePrice(${p.store_id}, ${p.product_id}, '${p.date_recorded}')"
            title="Delete"><i data-lucide="trash-2"></i></div>
        </div>
      </td>
    </tr>
  `).join('');

  // Pagination info
  document.getElementById('pagination-info').textContent =
    `Showing ${start + 1}–${Math.min(end, allPriceRecords.length)} of ${allPriceRecords.length} records`;

  // Pagination buttons
  const controls = document.getElementById('pagination-controls');
  controls.innerHTML = `
    <button class="pag-btn" onclick="changePage(-1)" ${currentPage === 1 ? 'disabled' : ''}>‹ Prev</button>
    <span class="pag-info">Page ${currentPage} of ${totalPages}</span>
    <button class="pag-btn" onclick="changePage(1)" ${currentPage === totalPages ? 'disabled' : ''}>Next ›</button>
  `;

  makeSortable('history-table');
  renderIcons()
}

function changePage(direction) {
  const totalPages = Math.ceil(allPriceRecords.length / PAGE_SIZE);
  currentPage = Math.max(1, Math.min(totalPages, currentPage + direction));
  renderPriceHistoryPage();
}

function submitAddPrice() {
  const storeId   = document.getElementById('add-price-store').value;
  const productId = document.getElementById('add-price-product').value;
  const amount    = document.getElementById('add-price-amount').value;
  const date      = document.getElementById('add-price-date').value;

  // Validation
  if (!storeId) {
    showToast('Please select a store!', true); return;
  }
  if (!productId) {
    showToast('Please select a product!', true); return;
  }
  if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
    showToast('Please enter a valid price!', true); return;
  }
  if (!date) {
    showToast('Please select a date!', true); return;
  }

  window.pywebview.api.add_price(
    parseInt(storeId), parseInt(productId), date, parseFloat(amount)
  ).then(res => {
    const result = JSON.parse(res);
    if (result.success) {
      hideModal('modal-price-add');
      document.getElementById('add-price-amount').value = '';
      document.getElementById('add-price-date').value   = '';
      loadPriceHistory();
      loadPriceComparison();
      loadDashboard();
      showToast('✅ ' + result.message);
    } else {
      showToast('❌ ' + result.message, true);
    }
  });
}

function openAddPriceModal() {
  // Auto set today's date
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('add-price-date').value = today;
  showModal('modal-price-add');
}

function openDeletePrice(storeId, productId, date) {
  document.getElementById('delete-price-store-id').value   = storeId;
  document.getElementById('delete-price-product-id').value = productId;
  document.getElementById('delete-price-date').value       = date;
  showModal('modal-price-delete');
}

function submitDeletePrice() {
  const storeId   = parseInt(document.getElementById('delete-price-store-id').value);
  const productId = parseInt(document.getElementById('delete-price-product-id').value);
  const date      = document.getElementById('delete-price-date').value;

  window.pywebview.api.delete_price(storeId, productId, date).then(res => {
    const result = JSON.parse(res);
    if (result.success) {
      hideModal('modal-price-delete');
      loadPriceHistory();
      loadPriceComparison();
      loadDashboard();
      showToast('🗑️ ' + result.message);
    } else {
      showToast('❌ ' + result.message, true);
    }
  });
}

// ══════════════════════════════════════════════
// PRICE COMPARISON
// ══════════════════════════════════════════════
function loadPriceComparison() {
  window.pywebview.api.get_price_comparison().then(res => {
    const prices = JSON.parse(res);
    const tbody  = document.getElementById('comparison-tbody');

    if (prices.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">No price records to compare yet.</td></tr>';
      return;
    }

    // Find lowest AND highest price per product
    const lowestMap  = {};
    const highestMap = {};

    prices.forEach(p => {
      const name = p.product_name;
      if (!lowestMap[name] || p.price < lowestMap[name])
        lowestMap[name] = p.price;
      if (!highestMap[name] || p.price > highestMap[name])
        highestMap[name] = p.price;
    });

    tbody.innerHTML = prices.map(p => {
      const isLowest  = p.price === lowestMap[p.product_name];
      const isHighest = p.price === highestMap[p.product_name];
      const onlyOne   = lowestMap[p.product_name] === highestMap[p.product_name];

      let priceClass = '';
      let badge      = '';
      let rowClass   = '';

      if (onlyOne) {
        priceClass = 'price-low';
        badge      = '<span class="badge badge-green">Only Record</span>';
        rowClass   = '';
      } else if (isLowest) {
        priceClass = 'price-low';
        badge      = '<span class="badge badge-green">✅ Cheapest</span>';
        rowClass   = 'row-lowest';
      } else if (isHighest) {
        priceClass = 'price-high';
        badge      = '<span class="badge badge-red">⚠️ Most Expensive</span>';
        rowClass   = 'row-highest';
      } else {
        priceClass = 'price-mid';
        badge      = '';
        rowClass   = '';
      }

      return `
        <tr class="${rowClass}">
          <td><strong>${p.product_name}</strong></td>
          <td><span class="badge badge-blue">${p.product_unit}</span></td>
          <td>${p.store_name}</td>
          <td class="${priceClass}">
            ₱${parseFloat(p.price).toFixed(2)}
            <span style="margin-left:6px">${badge}</span>
          </td>
          <td>${formatDate(p.date_recorded)}</td>
        </tr>
      `;
    }).join('');
  });
  makeSortable('comparison-table');
}

function renderIcons() {
  if (typeof lucide !== 'undefined') lucide.createIcons();
}