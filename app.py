import webview
import json
import database
import os

# Initialize database on startup
database.initialize_database()

# Get absolute path to templates folder
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_DIR = os.path.join(BASE_DIR, 'templates')
STATIC_DIR = os.path.join(BASE_DIR, 'static')

class API:
    # ─── DASHBOARD ────────────────────────────────────────
    def get_dashboard_stats(self):
        return json.dumps(database.get_dashboard_stats())

    # ─── STORES ───────────────────────────────────────────
    def get_all_stores(self):
        return json.dumps(database.get_all_stores())

    def add_store(self, store_name, store_type, street, barangay, contact_number):
        try:
            if database.store_exists(store_name):
                return json.dumps({
                    "success": False,
                    "message": f"Store '{store_name}' already exists!"
                })
            database.add_store(store_name, store_type, street, barangay, contact_number)
            return json.dumps({"success": True, "message": "Store added successfully!"})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})

    def update_store(self, store_id, store_name, store_type, street, barangay, contact_number):
        try:
            database.update_store(store_id, store_name, store_type, street, barangay, contact_number)
            return json.dumps({"success": True, "message": "Store updated successfully!"})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})

    def delete_store(self, store_id):
        try:
            database.delete_store(store_id)
            return json.dumps({"success": True, "message": "Store deleted successfully!"})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})

    # ─── CATEGORIES ───────────────────────────────────────
    def get_all_categories(self):
        return json.dumps(database.get_all_categories())

    def add_category(self, category_name, category_description):
        try:
            if database.category_exists(category_name):
                return json.dumps({
                    "success": False,
                    "message": f"Category '{category_name}' already exists!"
                })
            database.add_category(category_name, category_description)
            return json.dumps({"success": True, "message": "Category added successfully!"})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})

    def update_category(self, category_id, category_name, category_description):
        try:
            database.update_category(category_id, category_name, category_description)
            return json.dumps({"success": True, "message": "Category updated successfully!"})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})

    def delete_category(self, category_id):
        try:
            database.delete_category(category_id)
            return json.dumps({"success": True, "message": "Category deleted successfully!"})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})

    # ─── PRODUCTS ─────────────────────────────────────────
    def get_all_products(self):
        return json.dumps(database.get_all_products())

    def add_product(self, product_name, product_unit, product_brand, category_ids):
        try:
            if database.product_exists(product_name, product_brand):
                return json.dumps({
                    "success": False,
                    "message": f"Product '{product_name}' by '{product_brand}' already exists!"
                })
            database.add_product(product_name, product_unit, product_brand, category_ids)
            return json.dumps({"success": True, "message": "Product added successfully!"})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})

    def update_product(self, product_id, product_name, product_unit, product_brand, category_ids):
        try:
            database.update_product(product_id, product_name, product_unit, product_brand, category_ids)
            return json.dumps({"success": True, "message": "Product updated successfully!"})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})

    def delete_product(self, product_id):
        try:
            database.delete_product(product_id)
            return json.dumps({"success": True, "message": "Product deleted successfully!"})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})

    # ─── PRICES ───────────────────────────────────────────
    def get_all_prices(self):
        return json.dumps(database.get_all_prices())

    def get_price_comparison(self):
        return json.dumps(database.get_price_comparison())

    def add_price(self, store_id, product_id, date_recorded, price):
        try:
            database.add_price(store_id, product_id, date_recorded, float(price))
            return json.dumps({"success": True, "message": "Price recorded successfully!"})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})

    def delete_price(self, store_id, product_id, date_recorded):
        try:
            database.delete_price(store_id, product_id, date_recorded)
            return json.dumps({"success": True, "message": "Price deleted successfully!"})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})


if __name__ == "__main__":
    api = API()

    # Use file:// protocol with absolute path
    index_path = 'file:///' + os.path.join(BASE_DIR, 'templates', 'index.html').replace('\\', '/')

    window = webview.create_window(
        title="Grocery Price Comparison System",
        url=index_path,
        js_api=api,
        width=1200,
        height=750,
        min_size=(900, 600),
        resizable=True
    )
    webview.start(debug=False)