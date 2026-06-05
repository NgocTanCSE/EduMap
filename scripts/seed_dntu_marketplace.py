import psycopg2
import sys

# --- Database Configuration ---
DB_CONFIG = {
    "host": "localhost",
    "port": "5433",
    "dbname": "edumap_db",
    "user": "admin",
    "password": "password123"
}

def seed_marketplace():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        # Get Admin ID for owner
        cur.execute("SELECT id FROM users WHERE email = 'admin@edumap.vn' LIMIT 1;")
        admin_id = cur.fetchone()[0]

        print("Seeding DNTU Marketplace books...")
        marketplace_data = [
            ("Giáo trình Giải tích 1 - DNTU", "Sách cũ, còn mới 80%, có ghi chú quan trọng.", "book", "Trao đổi"),
            ("Lập trình C cơ bản", "Tặng cho bạn nào mới vào k21 khoa CNTT.", "book", "Tặng"),
            ("Tiếng Anh giao tiếp", "Sách học kèm CD, phù hợp tự học tại nhà.", "book", "Trao đổi"),
            ("Cấu trúc dữ liệu và Giải thuật", "Tài liệu photo từ thư viện, tặng miễn phí.", "book", "Tặng"),
        ]
        
        for name, desc, cat, status in marketplace_data:
            cur.execute("""
                INSERT INTO shared_items (id, name, description, category, status, owner_id)
                VALUES (gen_random_uuid(), %s, %s, %s, %s, %s)
                ON CONFLICT DO NOTHING;
            """, (name, desc, cat, status, admin_id))

        conn.commit()
        print("DNTU Marketplace books seeded successfully!")
        
    except Exception as e:
        print(f"Error seeding marketplace: {e}", file=sys.stderr)
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    seed_marketplace()
