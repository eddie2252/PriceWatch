// ─── GLOBALS ──────────────────────────────────
let allStores = [];
let allProducts = [];
let allCategories = [];
let currentPage = 1;
const PAGE_SIZE = 10;
let allPriceRecords = [];
let comparisonSearchQuery = '';
let historySearchQuery = '';
let historyDateFrom = '';
let historyDateTo = '';

// ─── INIT ─────────────────────────────────────
window.addEventListener('pywebviewready', function () {
  setCurrentDate();


  
  const loads = [
    loadDashboard(),
    loadStores(),
    loadProducts(),
    loadCategories(),
    loadPriceHistory().then(() => loadPriceComparison()),
  ];

  Promise.allSettled(loads).then(() => {
    const loader = document.getElementById('app-loader');
    loader.classList.add('hidden');
    setTimeout(() => loader.style.display = 'none', 400);
  });
});

function escAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
}

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
  const q = query.toLowerCase();

  if (tableId === 'history-table') {
    historySearchQuery = q;
    currentPage = 1;
    renderPriceHistoryPage();
    return;
  }

  if (tableId === 'comparison-table') {
    comparisonSearchQuery = q;
    comparisonPage = 1;
    renderComparisonPage();
    return;
  }

  const table = document.getElementById(tableId);
  const tbody = table.querySelector('tbody');
  const rows = Array.from(tbody.querySelectorAll('tr')).filter(r => !r.dataset.emptyMsg);
  rows.forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
  });

  const existingMsg = tbody.querySelector('tr[data-empty-msg]');
  if (existingMsg) existingMsg.remove();

  const anyVisible = rows.some(r => r.style.display !== 'none');
  if (!anyVisible && q !== '') {
    const colspan = tbody.closest('table').querySelectorAll('thead th').length;
    const msg = document.createElement('tr');
    msg.dataset.emptyMsg = '1';
    msg.innerHTML = `<td colspan="${colspan}" class="empty-msg">No results matching "${q}"</td>`;
    tbody.appendChild(msg);
  }
}


const _sortableInitialized = new Set();

// Keys matching column order in the history table
const _historyKeys = ['product_name', 'store_name', 'product_unit', 'price', 'date_recorded'];

function makeSortable(tableId) {
  if (_sortableInitialized.has(tableId)) return;
  _sortableInitialized.add(tableId);
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
      if (rows.length === 1 && rows[0].querySelector('.empty-msg')) return;

      const asc = !sortState[colIndex];
      sortState[colIndex] = asc;
      headers.forEach(h => {
        h.textContent = h.textContent.replace(' \u2191', '').replace(' \u2193', '');
      });
      th.textContent += asc ? ' \u2191' : ' \u2193';

      // History table is paginated — sort the data array then re-render
      if (tableId === 'history-table') {
        const key = _historyKeys[colIndex];
        allPriceRecords.sort((a, b) => {
          const aVal = a[key], bVal = b[key];
          const aNum = parseFloat(aVal), bNum = parseFloat(bVal);
          if (!isNaN(aVal) && !isNaN(bVal)) return asc ? aNum - bNum : bNum - aNum;
          return asc
            ? String(aVal).localeCompare(String(bVal))
            : String(bVal).localeCompare(String(aVal));
        });
        currentPage = 1;
        renderPriceHistoryPage();
        return;
      }

      // Non-paginated tables — sort DOM rows directly
      rows.sort((a, b) => {
        const aText = (a.cells[colIndex]?.textContent || '').trim();
        const bText = (b.cells[colIndex]?.textContent || '').trim();
        const aNum = parseFloat(aText.replace(/[^0-9.]/g, ''));
        const bNum = parseFloat(bText.replace(/[^0-9.]/g, ''));
        if (!isNaN(aNum) && !isNaN(bNum)) return asc ? aNum - bNum : bNum - aNum;
        return asc ? aText.localeCompare(bText) : bText.localeCompare(aText);
      });
      rows.forEach(row => tbody.appendChild(row));
    });
  });
}

// ─── LOGOUT ───────────────────────────────────
function confirmLogout() {
  if (confirm('Are you sure you want to exit?')) {
    window.pywebview.api.quit_app();
  }
}

// ══════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════
function loadDashboard() {
  return window.pywebview.api.get_dashboard_stats().then(res => {
    const data = JSON.parse(res);

    document.getElementById('stat-products').textContent = data.total_products;
    document.getElementById('stat-stores').textContent   = data.total_stores;
    document.getElementById('stat-prices').textContent   = data.total_prices;

    // Recent prices table
    const tbody = document.getElementById('dashboard-recent-table');
    if (data.recent_prices.length === 0) {
      const noStores = data.total_stores === 0;
      const noProducts = data.total_products === 0;
      let hint = 'No price records yet.';
      if (noStores && noProducts) {
        hint = 'Get started: add a Store and a Product first, then record a price.';
      } else if (noStores) {
        hint = 'Almost there: add a Store first before recording prices.';
      } else if (noProducts) {
        hint = 'Almost there: add a Product first before recording prices.';
      } else {
        hint = 'Ready to go: click Price Record in the sidebar to record your first price.';
      }
      tbody.innerHTML = `<tr><td colspan="4" class="empty-msg">${hint}</td></tr>`;
    } else {
      tbody.innerHTML = data.recent_prices.map(r => `
        <tr>
          <td>${r.product_name}</td>
          <td>${r.store_name}</td>
          <td class="price-col price-low">₱${parseFloat(r.price).toFixed(2)}</td>
          <td>${formatDate(r.date_recorded)}</td>
        </tr>
      `).join('');
    }
  }).then(() => {

  // Categories on dashboard
  return window.pywebview.api.get_all_categories().then(res => {
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
  });
}

// ══════════════════════════════════════════════
// STORES
// ══════════════════════════════════════════════
function loadStores() {
  return window.pywebview.api.get_all_stores().then(res => {
    allStores = JSON.parse(res);
    const tbody = document.getElementById('stores-tbody');

    setRecordCount('stores-count', allStores.length, 'stores');
    if (allStores.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-msg">No stores yet. Click Add Store!</td></tr>';
      return;
    }
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
            <div class="act-btn del" onclick="openDeleteStore(${s.store_id})" title="Delete"><i data-lucide="trash-2"></i></div>
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

  return window.pywebview.api.add_store(name, type, street, barangay, contact).then(res => {
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

  return window.pywebview.api.update_store(
    parseInt(id), name, type, street, barangay, contact
  ).then(res => {
    const result = JSON.parse(res);
    if (result.success) {
      hideModal('modal-store-edit');
      loadStores();
      loadDashboard();
      loadPriceHistory();
      loadPriceComparison();
      showToast('✅ ' + result.message);
    } else {
      showToast('❌ ' + result.message, true);
    }
  });
}

function openDeleteStore(storeId) {
  const s = allStores.find(x => x.store_id === storeId);
  document.getElementById('delete-store-id').value = storeId;
  document.getElementById('delete-store-name').textContent = s ? s.store_name : '';
  showModal('modal-store-delete');
}



function submitDeleteStore() {
  const id = parseInt(document.getElementById('delete-store-id').value);
  return window.pywebview.api.delete_store(id).then(res => {
    const result = JSON.parse(res);
    if (result.success) {
      hideModal('modal-store-delete');
      loadStores();
      loadDashboard();
      loadPriceHistory();
      loadPriceComparison();
      showToast('🗑️ ' + result.message);
    } else {
      showToast('❌ ' + result.message, true);
    }
  });
}

function refreshStoreDropdown() {
  const select = document.getElementById('add-price-store');
  select.innerHTML = '<option value="" disabled selected>Select store...</option>' +
    allStores.map(s => `<option value="${s.store_id}">${s.store_name} — ${s.barangay}</option>`).join('');
}

// ══════════════════════════════════════════════
// STORE PREVIEW
// ══════════════════════════════════════════════
function openStorePreview(storeId) {
  return window.pywebview.api.get_store_preview(storeId).then(res => {
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
  return window.pywebview.api.get_all_categories().then(res => {
    allCategories = JSON.parse(res);
    const tbody = document.getElementById('categories-tbody');

    setRecordCount('categories-count', allCategories.length, 'categories');
    if (allCategories.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-msg">No categories yet. Click Add Category!</td></tr>';
      return;
    }
    tbody.innerHTML = allCategories.map((c, i) => `
      <tr class="clickable" onclick="openCategoryPreview(${c.category_id})">
        <td>${i + 1}</td>
        <td><strong>${c.category_name}</strong></td>
        <td>${c.category_description || '—'}</td>
        <td>
          <div class="action-row">
            <div class="act-btn" onclick="event.stopPropagation(); openEditCategory(${c.category_id})" title="Edit"><i data-lucide="pencil"></i></div>
            <div class="act-btn del" onclick="event.stopPropagation(); openDeleteCategory(${c.category_id})" title="Delete"><i data-lucide="trash-2"></i></div>
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

  return window.pywebview.api.add_category(name, desc).then(res => {
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

  return window.pywebview.api.update_category(parseInt(id), name, desc).then(res => {
    const result = JSON.parse(res);
    if (result.success) {
      hideModal('modal-category-edit');
      loadCategories();
      loadProducts();
      loadDashboard();
      showToast('✅ ' + result.message);
    } else {
      showToast('❌ ' + result.message, true);
    }
  });
}

function openDeleteCategory(catId) {
  const c = allCategories.find(x => x.category_id === catId);
  document.getElementById('delete-cat-id').value         = catId;
  document.getElementById('delete-cat-name').textContent = c ? c.category_name : '';
  showModal('modal-category-delete');
}

function submitDeleteCategory() {
  const id = parseInt(document.getElementById('delete-cat-id').value);
  return window.pywebview.api.delete_category(id).then(res => {
    const result = JSON.parse(res);
    if (result.success) {
      hideModal('modal-category-delete');
      loadCategories();
      loadProducts();
      loadDashboard();
      showToast('🗑️ ' + result.message);
    } else {
      showToast('❌ ' + result.message, true);
    }
  });
}


function openCategoryPreview(categoryId) {
  return window.pywebview.api.get_category_preview(categoryId).then(res => {
    const data = JSON.parse(res);
    const c = data.category;

    document.getElementById('preview-cat-title').textContent       = c.category_name;
    document.getElementById('preview-cat-subtitle').textContent    = `${data.products.length} product${data.products.length !== 1 ? 's' : ''}`;
    document.getElementById('preview-cat-description').textContent = c.category_description || '—';
    document.getElementById('preview-cat-count').textContent       = data.products.length;

    const tbody    = document.getElementById('preview-cat-products');
    const noProds  = document.getElementById('preview-cat-no-products');
    const table    = document.getElementById('preview-cat-products-table');

    if (data.products.length === 0) {
      tbody.innerHTML = '';
      noProds.style.display = 'block';
      table.style.display   = 'none';
    } else {
      noProds.style.display = 'none';
      table.style.display   = 'table';
      tbody.innerHTML = data.products.map(p => `
        <tr class="clickable" onclick="openProductPreview(${p.product_id}); hideModal('modal-category-preview');">
          <td><strong>${p.product_name}</strong></td>
          <td>${p.product_brand}</td>
          <td><span class="badge badge-blue">${p.product_unit}</span></td>
        </tr>
      `).join('');
    }

    document.getElementById('preview-cat-edit-btn').onclick = () => {
      hideModal('modal-category-preview');
      openEditCategory(categoryId);
    };

    showModal('modal-category-preview');
    renderIcons();
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
  return window.pywebview.api.get_all_products().then(res => {
    allProducts = JSON.parse(res);
    const tbody = document.getElementById('products-tbody');

    setRecordCount('products-count', allProducts.length, 'products');
    if (allProducts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-msg">No products yet. Click Add Product!</td></tr>';
      return;
    }
    tbody.innerHTML = allProducts.map((p, i) => `
      <tr class="clickable" onclick="openProductPreview(${p.product_id})">
        <td>${i + 1}</td>
        <td class="clickable-cell" onclick="openProductPreview(${p.product_id})" title="View product details"><strong>${p.product_name}</strong> <i data-lucide="external-link" style="width:12px;height:12px;vertical-align:middle;opacity:0.5;"></i></td>
        <td>${p.product_brand}</td>
        <td><span class="badge badge-blue">${p.product_unit}</span></td>
        <td>${p.categories || '—'}</td>
        <td>
          <div class="action-row" onclick="event.stopPropagation()">
            <div class="act-btn" onclick="openEditProduct(${p.product_id})" title="Edit"><i data-lucide="pencil"></i></div>
            <div class="act-btn del" onclick="openDeleteProduct(${p.product_id})" title="Delete"><i data-lucide="trash-2"></i></div>
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
  const unitSelect = document.getElementById('add-prod-unit').value;
  const unit = unitSelect === 'other'
    ? document.getElementById('add-prod-unit-other').value.trim().toLowerCase()
    : unitSelect;
  if (!unit) { showToast('Please specify a unit!', true); return; }
  const checks = document.querySelectorAll('#add-prod-categories input[type="checkbox"]:checked');
  const catIds = Array.from(checks).map(c => parseInt(c.value));

  if (!name || !brand || !unit) {
    showToast('Please fill all required fields!', true); return;
  }
  if (catIds.length === 0) {
    showToast('Please select at least one category!', true); return;
  }

  return window.pywebview.api.add_product(name, unit, brand, catIds).then(res => {
    const result = JSON.parse(res);
    if (result.success) {
      hideModal('modal-product-add');
      document.getElementById('add-prod-name').value        = '';
      document.getElementById('add-prod-brand').value       = '';
      document.getElementById('add-prod-unit').value        = '';
      document.getElementById('add-prod-unit-other').value  = '';
      document.getElementById('add-prod-unit-other').style.display = 'none';
      document.querySelectorAll('#add-prod-categories input[type="checkbox"]')
        .forEach(cb => cb.checked = false);
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
  const knownUnits = ['per piece','per kg','per pack','per liter','per dozen','per box','per sachet','per bottle','per can'];
  const unitSelect = document.getElementById('edit-prod-unit');
  const unitOther  = document.getElementById('edit-prod-unit-other');
  if (knownUnits.includes(p.product_unit)) {
    unitSelect.value = p.product_unit;
    unitOther.style.display = 'none';
    unitOther.value = '';
  } else {
    unitSelect.value = 'other';
    unitOther.style.display = 'block';
    unitOther.value = p.product_unit;
  }

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
  const unitSelect = document.getElementById('edit-prod-unit').value;
  const unit = unitSelect === 'other'
    ? document.getElementById('edit-prod-unit-other').value.trim().toLowerCase()
    : unitSelect;
  if (!unit) { showToast('Please specify a unit!', true); return; }
  const checks = document.querySelectorAll('#edit-prod-categories input[type="checkbox"]:checked');
  const catIds = Array.from(checks).map(c => parseInt(c.value));

  if (!name || !brand) {
    showToast('Please fill all required fields!', true); return;
  }
  if (catIds.length === 0) {
    showToast('Please select at least one category!', true); return;
  }

  return window.pywebview.api.update_product(
    parseInt(id), name, unit, brand, catIds
  ).then(res => {
    const result = JSON.parse(res);
    if (result.success) {
      hideModal('modal-product-edit');
      loadProducts();
      loadDashboard();
      loadPriceHistory();
      loadPriceComparison();
      showToast('✅ ' + result.message);
    } else {
      showToast('❌ ' + result.message, true);
    }
  });
}

function openDeleteProduct(prodId) {
  const p = allProducts.find(x => x.product_id === prodId);
  document.getElementById('delete-prod-id').value = prodId;
  document.getElementById('delete-prod-name').textContent = p ? p.product_name : '';
  showModal('modal-product-delete');
}

function submitDeleteProduct() {
  const id = parseInt(document.getElementById('delete-prod-id').value);
  return window.pywebview.api.delete_product(id).then(res => {
    const result = JSON.parse(res);
    if (result.success) {
      hideModal('modal-product-delete');
      loadProducts();
      loadDashboard();
      loadPriceHistory();
      loadPriceComparison();
      showToast('🗑️ ' + result.message);
    } else {
      showToast('❌ ' + result.message, true);
    }
  });
}

function refreshProductDropdown() {
  const select = document.getElementById('add-price-product');
  select.innerHTML = '<option value="" disabled selected>Select product...</option>' +
    allProducts.map(p => `<option value="${p.product_id}">${p.product_name} (${p.product_brand})</option>`)
    .join('');
}


function handleUnitChange(selectId, inputId) {
  const select = document.getElementById(selectId);
  const input  = document.getElementById(inputId);
  if (select.value === 'other') {
    input.style.display = 'block';
    input.focus();
  } else {
    input.style.display = 'none';
    input.value = '';
  }
}

// ══════════════════════════════════════════════
// PRODUCT PREVIEW
// ══════════════════════════════════════════════
function openProductPreview(productId) {
  return window.pywebview.api.get_product_preview(productId).then(res => {
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
  return window.pywebview.api.get_all_prices().then(res => {
    allPriceRecords = JSON.parse(res);
    currentPage = 1;
    historySearchQuery = '';
    renderPriceHistoryPage();
    setRecordCount('history-count', allPriceRecords.length, 'records');
  });
}

function renderPriceHistoryPage() {
  const tbody = document.getElementById('history-tbody');
  const filtered = allPriceRecords.filter(p => {
    const matchesSearch = historySearchQuery === '' || (
      p.product_name.toLowerCase().includes(historySearchQuery) ||
      p.store_name.toLowerCase().includes(historySearchQuery) ||
      p.product_unit.toLowerCase().includes(historySearchQuery) ||
      parseFloat(p.price).toFixed(2).includes(historySearchQuery) ||
      p.date_recorded.includes(historySearchQuery) ||
      formatDate(p.date_recorded).toLowerCase().includes(historySearchQuery)
    );
    const matchesFrom = !historyDateFrom || p.date_recorded >= historyDateFrom;
    const matchesTo   = !historyDateTo   || p.date_recorded <= historyDateTo;
    return matchesSearch && matchesFrom && matchesTo;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const start      = (currentPage - 1) * PAGE_SIZE;
  const end        = start + PAGE_SIZE;
  const pageData   = filtered.slice(start, end);

  if (allPriceRecords.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-msg">No price records yet.</td></tr>';
    document.getElementById('pagination-info').textContent = '';
    document.getElementById('pagination-controls').innerHTML = '';
    return;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-msg">No records matching the current filter.</td></tr>`;
    document.getElementById('pagination-info').textContent = '';
    document.getElementById('pagination-controls').innerHTML = '';
    return;
  }

  tbody.innerHTML = pageData.map(p => `
    <tr>
      <td class="clickable-cell" onclick="openProductPreview(${p.product_id})" title="View product details"><strong>${p.product_name}</strong> <i data-lucide="external-link" style="width:12px;height:12px;vertical-align:middle;opacity:0.5;"></i></td>
      <td class="clickable-cell" onclick="openStorePreview(${p.store_id})" title="View store details">${p.store_name} <i data-lucide="external-link" style="width:12px;height:12px;vertical-align:middle;opacity:0.5;"></i></td>
      <td><span class="badge badge-blue">${p.product_unit}</span></td>
      <td class="price-low">₱${parseFloat(p.price).toFixed(2)}</td>
      <td>${formatDate(p.date_recorded)}</td>
      <td>
        <div class="action-row" onclick="event.stopPropagation()">
          <div class="act-btn" onclick="openEditPrice(${p.store_id}, ${p.product_id}, '${p.date_recorded}', ${p.price}, '${escAttr(p.product_name)}', '${escAttr(p.store_name)}')" title="Edit"><i data-lucide="pencil"></i></div>
          <div class="act-btn del" onclick="openDeletePrice(${p.store_id}, ${p.product_id}, '${p.date_recorded}')" title="Delete"><i data-lucide="trash-2"></i></div>
        </div>
      </td>
    </tr>
  `).join('');

  // Pagination info
  const isFiltered = historySearchQuery !== '' || historyDateFrom || historyDateTo;
  document.getElementById('pagination-info').textContent = isFiltered
    ? `Showing ${start + 1}–${Math.min(end, filtered.length)} of ${filtered.length} filtered records`
    : `Showing ${start + 1}–${Math.min(end, allPriceRecords.length)} of ${allPriceRecords.length} records`;

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
  const filtered = allPriceRecords.filter(p => {
    const matchesSearch = historySearchQuery === '' || (
      p.product_name.toLowerCase().includes(historySearchQuery) ||
      p.store_name.toLowerCase().includes(historySearchQuery) ||
      p.product_unit.toLowerCase().includes(historySearchQuery) ||
      parseFloat(p.price).toFixed(2).includes(historySearchQuery) ||
      p.date_recorded.includes(historySearchQuery) ||
      formatDate(p.date_recorded).toLowerCase().includes(historySearchQuery)
    );
    const matchesFrom = !historyDateFrom || p.date_recorded >= historyDateFrom;
    const matchesTo   = !historyDateTo   || p.date_recorded <= historyDateTo;
    return matchesSearch && matchesFrom && matchesTo;
  });
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  currentPage = Math.max(1, Math.min(totalPages, currentPage + direction));
  renderPriceHistoryPage();
}

function applyDateFilter() {
  historyDateFrom = document.getElementById('history-date-from').value;
  historyDateTo   = document.getElementById('history-date-to').value;
  const clearBtn  = document.getElementById('clear-date-btn');
  if (clearBtn) clearBtn.style.display = (historyDateFrom || historyDateTo) ? 'inline-block' : 'none';
  currentPage = 1;
  renderPriceHistoryPage();
}

function clearDateFilter() {
  historyDateFrom = '';
  historyDateTo   = '';
  document.getElementById('history-date-from').value = '';
  document.getElementById('history-date-to').value   = '';
  const clearBtn = document.getElementById('clear-date-btn');
  if (clearBtn) clearBtn.style.display = 'none';
  currentPage = 1;
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
  if (!amount || isNaN(amount) || parseFloat(amount) < 0.01) {
    showToast('Please enter a valid price!', true); return;
  }
  if (!date) {
    showToast('Please select a date!', true); return;
  }
  const today = new Date().toISOString().split('T')[0];
  if (date > today) {
    showToast('Date cannot be in the future!', true); return;
  }

  return window.pywebview.api.add_price(
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

function openEditPrice(storeId, productId, date, currentPrice, productName, storeName) {
  document.getElementById('edit-price-store-id').value    = storeId;
  document.getElementById('edit-price-product-id').value  = productId;
  document.getElementById('edit-price-date').value        = date;
  document.getElementById('edit-price-amount').value      = currentPrice;
  document.getElementById('edit-price-product-name').textContent = productName;
  document.getElementById('edit-price-store-name').textContent   = storeName;
  document.getElementById('edit-price-date-display').textContent = formatDate(date);
  showModal('modal-price-edit');
}

function submitEditPrice() {
  const storeId   = parseInt(document.getElementById('edit-price-store-id').value);
  const productId = parseInt(document.getElementById('edit-price-product-id').value);
  const date      = document.getElementById('edit-price-date').value;
  const amount    = document.getElementById('edit-price-amount').value;

  if (!amount || isNaN(amount) || parseFloat(amount) < 0.01) {
    showToast('Please enter a valid price!', true); return;
  }

  return window.pywebview.api.update_price(storeId, productId, date, parseFloat(amount)).then(res => {
    const result = JSON.parse(res);
    if (result.success) {
      hideModal('modal-price-edit');
      loadPriceHistory();
      loadPriceComparison();
      loadDashboard();
      showToast('✅ ' + result.message);
    } else {
      showToast('❌ ' + result.message, true);
    }
  });
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

  return window.pywebview.api.delete_price(storeId, productId, date).then(res => {
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
let comparisonFilter = 'all';
let allComparisonRecords = [];
let comparisonPage = 1;
const COMP_PAGE_SIZE = 10;

function setComparisonFilter(filter) {
  comparisonFilter = filter;
  comparisonPage = 1;

  document.querySelectorAll('.comp-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });

  renderComparisonPage();
}

function renderComparisonPage() {
  const tbody = document.getElementById('comparison-tbody');

  // Build lowestMap and highestMap from full dataset
  const lowestMap  = {};
  const highestMap = {};
  allComparisonRecords.forEach(p => {
    const name = p.product_name;
    if (!lowestMap[name]  || p.price < lowestMap[name])  lowestMap[name]  = p.price;
    if (!highestMap[name] || p.price > highestMap[name]) highestMap[name] = p.price;
  });

  // Build previous price map from history (allPriceRecords is sorted date DESC)
  const prevPriceMap = {};
  const latestSeen = new Set();
  allPriceRecords.forEach(r => {
    const key = `${r.store_id}_${r.product_id}`;
    if (!latestSeen.has(key)) { latestSeen.add(key); }
    else if (!(key in prevPriceMap)) { prevPriceMap[key] = r.price; }
  });
  // Tag each row
  const tagged = allComparisonRecords.map(p => {
    const onlyOne   = lowestMap[p.product_name] === highestMap[p.product_name];
    const isLowest  = p.price === lowestMap[p.product_name];
    const isHighest = p.price === highestMap[p.product_name];
    let rowClass, priceClass, badge;

    if (onlyOne) {
      rowClass = 'row-only'; priceClass = 'price-low';
      badge = '<span class="badge badge-green">Only Record</span>';
    } else if (isLowest) {
      rowClass = 'row-lowest'; priceClass = 'price-low';
      badge = '<span class="badge badge-green">Cheapest</span>';
    } else if (isHighest) {
      rowClass = 'row-highest'; priceClass = 'price-high';
      badge = '<span class="badge badge-red">Most Expensive</span>';
    } else {
      rowClass = ''; priceClass = 'price-mid'; badge = '';
    }
    const tKey = `${p.store_id}_${p.product_id}`;
    const prev = prevPriceMap[tKey];
    const trend = prev === undefined ? '' :
      p.price < prev ? `<span class="trend-down" title="Down from ₱${prev.toFixed(2)}">↓</span>` :
      p.price > prev ? `<span class="trend-up"   title="Up from ₱${prev.toFixed(2)}">↑</span>` :
                       `<span class="trend-flat"  title="No change">—</span>`;
    return { ...p, rowClass, priceClass, badge, trend };
  });

  // Apply filter + search together
  const filtered = tagged.filter(p => {
    const matchesFilter =
      comparisonFilter === 'cheapest'  ? (p.rowClass === 'row-lowest' || p.rowClass === 'row-only') :
      comparisonFilter === 'expensive' ? (p.rowClass === 'row-highest' || p.rowClass === 'row-only') :
      true;

    const matchesSearch = comparisonSearchQuery === '' || (
      p.product_name.toLowerCase().includes(comparisonSearchQuery) ||
      p.store_name.toLowerCase().includes(comparisonSearchQuery) ||
      p.product_unit.toLowerCase().includes(comparisonSearchQuery) ||
      parseFloat(p.price).toFixed(2).includes(comparisonSearchQuery) ||
      p.date_recorded.includes(comparisonSearchQuery) ||
      formatDate(p.date_recorded).toLowerCase().includes(comparisonSearchQuery)
    );

    return matchesFilter && matchesSearch;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">No records match this filter.</td></tr>';
    document.getElementById('comp-pagination-info').textContent = '';
    document.getElementById('comp-pagination-controls').innerHTML = '';
    return;
  }

  // Paginate
  const totalPages = Math.max(1, Math.ceil(filtered.length / COMP_PAGE_SIZE));
  comparisonPage   = Math.min(comparisonPage, totalPages);
  const start      = (comparisonPage - 1) * COMP_PAGE_SIZE;
  const end        = start + COMP_PAGE_SIZE;
  const pageData   = filtered.slice(start, end);

  tbody.innerHTML = pageData.map(p => `
    <tr class="${p.rowClass}">
      <td class="clickable-cell" onclick="openProductPreview(${p.product_id})" title="View product details"><strong>${p.product_name}</strong> <i data-lucide="external-link" style="width:12px;height:12px;vertical-align:middle;opacity:0.5;"></i></td>
      <td><span class="badge badge-blue">${p.product_unit}</span></td>
      <td class="clickable-cell" onclick="openStorePreview(${p.store_id})" title="View store details">
        ${p.store_name} <i data-lucide="external-link" style="width:12px;height:12px;vertical-align:middle;opacity:0.5;"></i>
      </td>
      <td class="${p.priceClass}">
        ₱${parseFloat(p.price).toFixed(2)}
        ${p.trend}
        <span style="margin-left:6px">${p.badge}</span>
      </td>
      <td>${formatDate(p.date_recorded)}</td>
    </tr>
  `).join('');

  document.getElementById('comp-pagination-info').textContent = comparisonSearchQuery
    ? `Showing ${start + 1}–${Math.min(end, filtered.length)} of ${filtered.length} results for "${comparisonSearchQuery}"`
    : `Showing ${start + 1}–${Math.min(end, filtered.length)} of ${filtered.length} records`;

  document.getElementById('comp-pagination-controls').innerHTML = `
    <button class="pag-btn" onclick="changeCompPage(-1)" ${comparisonPage === 1 ? 'disabled' : ''}>‹ Prev</button>
    <span class="pag-info">Page ${comparisonPage} of ${totalPages}</span>
    <button class="pag-btn" onclick="changeCompPage(1)" ${comparisonPage === totalPages ? 'disabled' : ''}>Next ›</button>
  `;

  renderIcons();
}

function changeCompPage(direction) {
  const filtered = allComparisonRecords.filter(p => {
    const lowestMap  = {};
    const highestMap = {};
    allComparisonRecords.forEach(x => {
      if (!lowestMap[x.product_name]  || x.price < lowestMap[x.product_name])  lowestMap[x.product_name]  = x.price;
      if (!highestMap[x.product_name] || x.price > highestMap[x.product_name]) highestMap[x.product_name] = x.price;
    });
    const onlyOne   = lowestMap[p.product_name] === highestMap[p.product_name];
    const isLowest  = p.price === lowestMap[p.product_name];
    const isHighest = p.price === highestMap[p.product_name];
    if (comparisonFilter === 'cheapest')  return isLowest || onlyOne;
    if (comparisonFilter === 'expensive') return isHighest || onlyOne;
    return true;
  });
  const totalPages = Math.ceil(filtered.length / COMP_PAGE_SIZE);
  comparisonPage = Math.max(1, Math.min(totalPages, comparisonPage + direction));
  renderComparisonPage();
}

function loadPriceComparison() {
  return window.pywebview.api.get_price_comparison().then(res => {
    allComparisonRecords = JSON.parse(res);
    comparisonPage = 1;
    comparisonSearchQuery = '';
    if (allComparisonRecords.length === 0) {
      document.getElementById('comparison-tbody').innerHTML =
        '<tr><td colspan="5" class="empty-msg">No price records to compare yet.</td></tr>';
      document.getElementById('comp-pagination-info').textContent = '';
      document.getElementById('comp-pagination-controls').innerHTML = '';
      return;
    }
    renderComparisonPage();
     makeComparisonSortable();
  });
}

function makeComparisonSortable() {
  if (_sortableInitialized.has('comparison-table')) return;
  const table = document.getElementById('comparison-table');
  if (!table) return;
  const headers = table.querySelectorAll('th');
  const sortState = {};
  const keys = ['product_name', 'product_unit', 'store_name', 'price', 'date_recorded'];

  headers.forEach((th, colIndex) => {
    th.style.cursor = 'pointer';
    th.style.userSelect = 'none';
    th.addEventListener('click', () => {
      const asc = !sortState[colIndex];
      sortState[colIndex] = asc;

      headers.forEach(h => {
        h.textContent = h.textContent.replace(' ↑', '').replace(' ↓', '');
      });
      th.textContent += asc ? ' ↑' : ' ↓';

      const key = keys[colIndex];
      allComparisonRecords.sort((a, b) => {
        const aVal = a[key];
        const bVal = b[key];
        const aNum = parseFloat(aVal);
        const bNum = parseFloat(bVal);
        if (!isNaN(aVal) && !isNaN(bVal)) return asc ? aNum - bNum : bNum - aNum;
        return asc
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      });

      comparisonPage = 1;
      renderComparisonPage();
    });
  });
}

function renderIcons() {
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function confirmLogout() {
  if (confirm('Are you sure you want to exit?')) {
    window.pywebview.api.quit_app();
  }
}

