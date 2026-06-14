import psycopg2
import sys
import os
from dotenv import load_dotenv

# Load .env file
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

# --- Database Configuration ---
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": os.getenv("DB_PORT", "5432"),
    "dbname": os.getenv("DB_DATABASE", "edumap_db"),
    "user": os.getenv("DB_USERNAME", "admin"),
    "password": os.getenv("DB_PASSWORD", "password123")
}

def seed_marketplace():
    conn = None
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        # Get Admin ID for owner
        cur.execute("SELECT id FROM users WHERE email = 'admin@edumap.vn' LIMIT 1;")
        admin_row = cur.fetchone()
        if not admin_row:
            print("ERROR: Admin user not found.")
            return
        admin_id = admin_row[0]

        print("Seeding DNTU Marketplace books...")
        marketplace_data = [
            ("Giáo trình Giải tích 1 - DNTU", "Sách cũ, còn mới 80%, có ghi chú quan trọng.", "book", "available"),
            ("Lập trình C cơ bản", "Tặng cho bạn nào mới vào k21 khoa CNTT.", "book", "available"),
            ("Tiếng Anh giao tiếp", "Sách học kèm CD, phù hợp tự học tại nhà.", "book", "available"),
            ("Cấu trúc dữ liệu và Giải thuật", "Tài liệu photo từ thư viện, tặng miễn phí.", "book", "available"),
        ]
        
        for name, desc, cat, status in marketplace_data:
            # 🛠️ FIX: Match schema columns for shared_items (id, name, category, description, status, owner_id)
            cur.execute("""
                INSERT INTO shared_items (id, name, category, description, status, owner_id)
                VALUES (uuid_generate_v4(), %s, %s, %s, %s, %s)
                ON CONFLICT DO NOTHING;
            """, (name, cat, desc, status, admin_id))

        conn.commit()
        print("DNTU Marketplace books seeded successfully!")
        
    except Exception as e:
        print(f"Error seeding marketplace: {e}", file=sys.stderr)
        if conn:
            conn.rollback()
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if conn:
            conn.close()

if __name__ == "__main__":
    seed_marketplace()
