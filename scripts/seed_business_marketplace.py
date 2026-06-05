import psycopg2
import sys
import uuid

# --- Database Configuration ---
DB_CONFIG = {
    "host": "localhost",
    "port": "5433",
    "dbname": "edumap_db",
    "user": "admin",
    "password": "password123"
}

def seed_business_marketplace():
    conn = None
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        # 1. Get Employer ID
        cur.execute("SELECT id FROM users WHERE role = 'employer' LIMIT 1;")
        employer_row = cur.fetchone()
        if not employer_row:
            print("No employer found. Please run main seed first.")
            return
        employer_id = employer_row[0]

        print(f"Seeding Business Marketplace for employer: {employer_id}")

        # 2. Create Business Profile
        biz_id = str(uuid.uuid4())
        cur.execute("""
            INSERT INTO business_profiles (id, user_id, name, description, industry, website, is_verified)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
            RETURNING id;
        """, (biz_id, employer_id, "EduCorp Solutions", "Chuyên cung cấp giải pháp giáo dục toàn diện.", "Education", "https://educorp.vn", True))
        biz_id = cur.fetchone()[0]

        # 3. Create Products
        products = [
            ("Bộ dụng cụ vẽ kỹ thuật", "Bộ compa, thước kẻ chuyên dụng cho sinh viên kiến trúc.", 150000, "Dụng cụ", 50),
            ("Máy tính Casio fx-580VN X", "Máy tính khoa học hỗ trợ giải toán bậc cao.", 650000, "Thiết bị", 20),
            ("Balo EduMap Limited", "Balo chống nước, có ngăn đựng laptop 15.6 inch.", 350000, "Thời trang", 100),
        ]
        
        for name, desc, price, cat, stock in products:
            cur.execute("""
                INSERT INTO products (id, name, description, price, category, stock, business_profile_id)
                VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s);
            """, (name, desc, price, cat, stock, biz_id))

        # 4. Create Services
        services = [
            ("Gia sư Tiếng Anh IELST 7.5+", "Luyện thi cấp tốc với giáo viên kinh nghiệm.", 500000, "Gia sư", "2 giờ/buổi", "Online"),
            ("Khóa học Lập trình Web Fullstack", "Từ Zero đến Hero với React và Node.js.", 2500000, "Khóa học", "3 tháng", "Hybrid"),
            ("Tư vấn hướng nghiệp 1-1", "Giúp bạn chọn đúng ngành, đúng trường.", 300000, "Tư vấn", "1 giờ", "Trực tiếp"),
        ]

        for name, desc, price, cat, duration, loc in services:
            cur.execute("""
                INSERT INTO business_services (id, name, description, price, category, duration, location, business_profile_id)
                VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s);
            """, (name, desc, price, cat, duration, loc, biz_id))

        conn.commit()
        print("Business Marketplace seeded successfully!")
        
    except Exception as e:
        print(f"Error seeding business marketplace: {e}", file=sys.stderr)
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    seed_business_marketplace()
