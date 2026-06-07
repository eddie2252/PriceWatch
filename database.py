import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "grocery.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def initialize_database():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS store (
            store_id   INTEGER PRIMARY KEY AUTOINCREMENT,
            store_name TEXT NOT NULL,
            store_type TEXT NOT NULL CHECK(store_type IN ('Supermarket','Mall','Local Market')),
            street     TEXT,
            barangay   TEXT NOT NULL,
            contact_number TEXT
        );

        CREATE TABLE IF NOT EXISTS category (
            category_id          INTEGER PRIMARY KEY AUTOINCREMENT,
            category_name        TEXT NOT NULL UNIQUE,
            category_description TEXT
        );

        CREATE TABLE IF NOT EXISTS product (
            product_id   INTEGER PRIMARY KEY AUTOINCREMENT,
            product_name TEXT NOT NULL,
            product_unit TEXT NOT NULL,
            product_brand TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS classifies (
            product_id  INTEGER NOT NULL,
            category_id INTEGER NOT NULL,
            PRIMARY KEY (product_id, category_id),
            FOREIGN KEY (product_id)  REFERENCES product(product_id)  ON DELETE CASCADE,
            FOREIGN KEY (category_id) REFERENCES category(category_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS price (
            store_id      INTEGER NOT NULL,
            product_id    INTEGER NOT NULL,
            date_recorded TEXT NOT NULL,
            price         REAL NOT NULL,
            created_at    TEXT DEFAULT (datetime('now', 'localtime')),
            PRIMARY KEY (store_id, product_id, date_recorded),
            FOREIGN KEY (store_id)   REFERENCES store(store_id)     ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES product(product_id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_price_product ON price(product_id);
        CREATE INDEX IF NOT EXISTS idx_price_store ON price(store_id);                                  
    """)

    conn.commit()
    conn.close()
    print("Database initialized successfully!")

# ─── STORE QUERIES ────────────────────────────────────────────
def get_all_stores():
    conn = get_connection()
    stores = conn.execute("SELECT * FROM store").fetchall()
    conn.close()
    return [dict(s) for s in stores]

def add_store(store_name, store_type, street, barangay, contact_number):
    conn = get_connection()
    conn.execute("""
        INSERT INTO store (store_name, store_type, street, barangay, contact_number)
        VALUES (?, ?, ?, ?, ?)
    """, (store_name, store_type, street, barangay, contact_number))
    conn.commit()
    conn.close()

def update_store(store_id, store_name, store_type, street, barangay, contact_number):
    conn = get_connection()
    conn.execute("""
        UPDATE store SET store_name=?, store_type=?, street=?, barangay=?, contact_number=?
        WHERE store_id=?
    """, (store_name, store_type, street, barangay, contact_number, store_id))
    conn.commit()
    conn.close()

def delete_store(store_id):
    conn = get_connection()
    conn.execute("DELETE FROM store WHERE store_id=?", (store_id,))
    conn.commit()
    conn.close()

# ─── CATEGORY QUERIES ─────────────────────────────────────────
def get_all_categories():
    conn = get_connection()
    cats = conn.execute("SELECT * FROM category").fetchall()
    conn.close()
    return [dict(c) for c in cats]

def add_category(category_name, category_description):
    conn = get_connection()
    conn.execute("""
        INSERT INTO category (category_name, category_description)
        VALUES (?, ?)
    """, (category_name, category_description))
    conn.commit()
    conn.close()

def update_category(category_id, category_name, category_description):
    conn = get_connection()
    conn.execute("""
        UPDATE category SET category_name=?, category_description=?
        WHERE category_id=?
    """, (category_name, category_description, category_id))
    conn.commit()
    conn.close()

def delete_category(category_id):
    conn = get_connection()
    conn.execute("DELETE FROM category WHERE category_id=?", (category_id,))
    conn.commit()
    conn.close()

# ─── PRODUCT QUERIES ──────────────────────────────────────────
def get_all_products():
    conn = get_connection()
    products = conn.execute("""
        SELECT p.*,
               GROUP_CONCAT(c.category_name, ', ') AS categories
        FROM product p
        LEFT JOIN classifies cl ON p.product_id = cl.product_id
        LEFT JOIN category c   ON cl.category_id = c.category_id
        GROUP BY p.product_id
    """).fetchall()
    conn.close()
    return [dict(p) for p in products]

def add_product(product_name, product_unit, product_brand, category_ids):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO product (product_name, product_unit, product_brand)
        VALUES (?, ?, ?)
    """, (product_name, product_unit, product_brand))
    product_id = cursor.lastrowid
    for cat_id in category_ids:
        cursor.execute("""
            INSERT INTO classifies (product_id, category_id) VALUES (?, ?)
        """, (product_id, cat_id))
    conn.commit()
    conn.close()

def update_product(product_id, product_name, product_unit, product_brand, category_ids):
    conn = get_connection()
    conn.execute("""
        UPDATE product SET product_name=?, product_unit=?, product_brand=?
        WHERE product_id=?
    """, (product_name, product_unit, product_brand, product_id))
    conn.execute("DELETE FROM classifies WHERE product_id=?", (product_id,))
    for cat_id in category_ids:
        conn.execute("""
            INSERT INTO classifies (product_id, category_id) VALUES (?, ?)
        """, (product_id, cat_id))
    conn.commit()
    conn.close()

def delete_product(product_id):
    conn = get_connection()
    conn.execute("DELETE FROM product WHERE product_id=?", (product_id,))
    conn.commit()
    conn.close()

# ─── PRICE QUERIES ────────────────────────────────────────────
def get_all_prices():
    conn = get_connection()
    prices = conn.execute("""
        SELECT 
            p.store_id,
            p.product_id,
            p.price, 
            p.date_recorded,
            pr.product_name, 
            pr.product_unit,
            s.store_name
        FROM price p
        JOIN product pr ON p.product_id = pr.product_id
        JOIN store   s  ON p.store_id   = s.store_id
        ORDER BY p.date_recorded DESC, p.created_at DESC
    """).fetchall()
    conn.close()
    return [dict(p) for p in prices]

def add_price(store_id, product_id, date_recorded, price):
    conn = get_connection()
    conn.execute("""
        INSERT OR REPLACE INTO price (store_id, product_id, date_recorded, price)
        VALUES (?, ?, ?, ?)
    """, (store_id, product_id, date_recorded, price))
    conn.commit()
    conn.close()

def update_price(store_id, product_id, date_recorded, new_price):
    conn = get_connection()
    conn.execute("""
        UPDATE price SET price = ?
        WHERE store_id = ? AND product_id = ? AND date_recorded = ?
    """, (new_price, store_id, product_id, date_recorded))
    conn.commit()
    conn.close()

def delete_price(store_id, product_id, date_recorded):
    conn = get_connection()
    conn.execute("""
        DELETE FROM price
        WHERE store_id=? AND product_id=? AND date_recorded=?
    """, (store_id, product_id, date_recorded))
    conn.commit()
    conn.close()



def get_price_comparison():
    conn = get_connection()
    prices = conn.execute("""
        SELECT pr.product_name, pr.product_unit, pr.product_id,
               s.store_name, s.store_id, p.price, p.date_recorded
        FROM price p
        JOIN product pr ON p.product_id = pr.product_id
        JOIN store   s  ON p.store_id   = s.store_id
        INNER JOIN (
            SELECT store_id, product_id, MAX(date_recorded) as latest
            FROM price
            GROUP BY store_id, product_id
        ) latest ON p.store_id = latest.store_id
                AND p.product_id = latest.product_id
                AND p.date_recorded = latest.latest
        ORDER BY pr.product_name, p.price ASC
    """).fetchall()
    conn.close()
    return [dict(p) for p in prices]

def get_dashboard_stats():
    conn = get_connection()
    total_products = conn.execute("SELECT COUNT(*) FROM product").fetchone()[0]
    total_stores   = conn.execute("SELECT COUNT(*) FROM store").fetchone()[0]
    total_prices   = conn.execute("SELECT COUNT(*) FROM price").fetchone()[0]
    recent_prices  = conn.execute("""
        SELECT pr.product_name, s.store_name, p.price, p.date_recorded
        FROM price p
        JOIN product pr ON p.product_id = pr.product_id
        JOIN store   s  ON p.store_id   = s.store_id
        ORDER BY p.date_recorded DESC, p.created_at DESC LIMIT 10
    """).fetchall()
    conn.close()
    return {
        "total_products": total_products,
        "total_stores":   total_stores,
        "total_prices":   total_prices,
        "recent_prices":  [dict(r) for r in recent_prices]
    }
def store_exists(store_name, barangay):
    conn = get_connection()
    result = conn.execute(
        "SELECT COUNT(*) FROM store WHERE LOWER(store_name) = LOWER(?) AND LOWER(barangay) = LOWER(?)",
        (store_name, barangay)
    ).fetchone()[0]
    conn.close()
    return result > 0

def store_exists_other(store_name, barangay, store_id):
    conn = get_connection()
    result = conn.execute(
        "SELECT COUNT(*) FROM store WHERE LOWER(store_name) = LOWER(?) AND LOWER(barangay) = LOWER(?) AND store_id != ?",
        (store_name, barangay, store_id)
    ).fetchone()[0]
    conn.close()
    return result > 0

def product_exists(product_name, product_brand):
    conn = get_connection()
    result = conn.execute(
        """SELECT COUNT(*) FROM product 
           WHERE LOWER(product_name) = LOWER(?) 
           AND LOWER(product_brand) = LOWER(?)""",
        (product_name, product_brand)
    ).fetchone()[0]
    conn.close()
    return result > 0

def category_exists(category_name):
    conn = get_connection()
    result = conn.execute(
        "SELECT COUNT(*) FROM category WHERE LOWER(category_name) = LOWER(?)",
        (category_name,)
    ).fetchone()[0]
    conn.close()
    return result > 0

def get_store_preview(store_id):
    conn = get_connection()
    store = conn.execute(
        "SELECT * FROM store WHERE store_id = ?", (store_id,)
    ).fetchone()
    price_count = conn.execute(
        "SELECT COUNT(*) FROM price WHERE store_id = ?", (store_id,)
    ).fetchone()[0]
    cheapest = conn.execute("""
        SELECT pr.product_name, p.price, p.date_recorded
        FROM price p
        JOIN product pr ON p.product_id = pr.product_id
        WHERE p.store_id = ?
        ORDER BY p.price ASC LIMIT 1
    """, (store_id,)).fetchone()
    recent = conn.execute("""
        SELECT pr.product_name, p.price, p.date_recorded
        FROM price p
        JOIN product pr ON p.product_id = pr.product_id
        WHERE p.store_id = ?
        ORDER BY p.date_recorded DESC LIMIT 5
    """, (store_id,)).fetchall()
    conn.close()
    return {
        "store":       dict(store) if store else {},
        "price_count": price_count,
        "cheapest":    dict(cheapest) if cheapest else None,
        "recent":      [dict(r) for r in recent]
    }

def get_product_preview(product_id):
    conn = get_connection()
    product = conn.execute(
        "SELECT * FROM product WHERE product_id = ?", (product_id,)
    ).fetchone()
    categories = conn.execute("""
        SELECT c.category_name FROM classifies cl
        JOIN category c ON cl.category_id = c.category_id
        WHERE cl.product_id = ?
    """, (product_id,)).fetchall()
    prices = conn.execute("""
        SELECT s.store_name, p.price, p.date_recorded
        FROM price p
        JOIN store s ON p.store_id = s.store_id
        WHERE p.product_id = ?
        ORDER BY p.price ASC
    """, (product_id,)).fetchall()
    conn.close()
    return {
        "product":    dict(product) if product else {},
        "categories": [c["category_name"] for c in categories],
        "prices":     [dict(p) for p in prices]
    }

def get_category_preview(category_id):
    conn = get_connection()
    category = conn.execute(
        "SELECT * FROM category WHERE category_id = ?", (category_id,)
    ).fetchone()
    products = conn.execute("""
        SELECT p.product_id, p.product_name, p.product_brand, p.product_unit
        FROM product p
        JOIN classifies cl ON p.product_id = cl.product_id
        WHERE cl.category_id = ?
        ORDER BY p.product_name ASC
    """, (category_id,)).fetchall()
    conn.close()
    return {
        "category": dict(category) if category else {},
        "products": [dict(p) for p in products]
    }