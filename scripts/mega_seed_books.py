import psycopg2
import os
import random
from dotenv import load_dotenv

# Load .env file from the project root
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

DB_CONFIG = {
    "host": "localhost",
    "port": os.getenv("POSTGRES_PORT_EXTERNAL", "5432"),
    "dbname": os.getenv("DB_DATABASE", "edumap_db"),
    "user": os.getenv("DB_USERNAME", "admin"),
    "password": os.getenv("DB_PASSWORD", "password123")
}

def seed_100_books():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        # Get Admin ID for owner
        cur.execute("SELECT id FROM users WHERE email = 'admin@edumap.vn' LIMIT 1;")
        res = cur.fetchone()
        if not res:
            print("Admin user not found. Please run execute_db_setup.py first.")
            return
        admin_id = res[0]

        print("Generating 100 realistic books for Marketplace...")
        
        subjects = ["Giải tích", "Vật lý đại cương", "Triết học Mác-Lênin", "Kinh tế chính trị", "Lập trình C++", 
                    "Cấu trúc dữ liệu", "Cơ sở dữ liệu", "Mạng máy tính", "Hệ điều hành", "Tiếng Anh chuyên ngành",
                    "Đại số tuyến tính", "Xác suất thống kê", "Kỹ thuật đồ họa", "Phát triển Web", "Trí tuệ nhân tạo",
                    "An toàn thông tin", "Quản trị mạng", "Thiết kế UI/UX", "Kỹ năng mềm", "Khởi nghiệp"]
        
        types = ["Giáo trình", "Sách tham khảo", "Bài tập", "Tài liệu ôn thi", "Từ điển", "Truyện ngắn", "Sách ngoại văn"]
        
        conditions = ["Mới 100%", "Mới 95%", "Hơi cũ", "Có ghi chú", "Góc bị quăn", "Mất bìa", "Bản photo"]
        
        statuses = ["Trao đổi", "Tặng", "Bán rẻ"]

        for i in range(100):
            subject = random.choice(subjects)
            book_type = random.choice(types)
            condition = random.choice(conditions)
            status = random.choice(statuses)
            
            name = f"{book_type} {subject} - Tập {random.randint(1, 3)}"
            desc = f"Sách {condition}. Phù hợp cho sinh viên khoa {random.choice(['CNTT', 'Điện điện tử', 'Kinh tế', 'Ngoại ngữ'])}. {status} cho ai cần."
            
            cur.execute("""
                INSERT INTO shared_items (id, name, description, category, status, owner_id)
                VALUES (gen_random_uuid(), %s, %s, 'book', %s, %s)
                ON CONFLICT DO NOTHING;
            """, (name, desc, status, admin_id))

        conn.commit()
        print("Successfully seeded 100 books to Marketplace!")
        
    except Exception as e:
        print(f"Error seeding books: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    seed_100_books()
