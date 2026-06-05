import psycopg2
import os
import uuid
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load .env file
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

DB_CONFIG = {
    "host": "localhost",
    "port": os.getenv("POSTGRES_PORT_EXTERNAL", "5433"),
    "dbname": os.getenv("DB_DATABASE", "edumap_db"),
    "user": os.getenv("DB_USERNAME", "admin"),
    "password": os.getenv("DB_PASSWORD", "password123")
}

def get_db_connection():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return None

def seed_scholarships(cur):
    scholarships = [
        ("Học bổng Toàn phần ASEAN 2026", "Học bổng dành cho sinh viên xuất sắc khối ngành kỹ thuật tại Đông Nam Á.", "Chính phủ Singapore", 50000.0, datetime.now() + timedelta(days=90)),
        ("Quỹ Tài năng Trẻ EduMap", "Hỗ trợ các dự án khởi nghiệp sáng tạo trong lĩnh vực giáo dục.", "EduMap Foundation", 2000.0, datetime.now() + timedelta(days=45)),
        ("Học bổng Lập trình viên Tương lai", "Dành cho các bạn nữ có đam mê với lập trình và khoa học dữ liệu.", "Google Vietnam", 5000.0, datetime.now() + timedelta(days=60)),
        ("Học bổng Thạc sĩ Erasmus+", "Cơ hội học tập tại các trường đại học hàng đầu Châu Âu.", "European Union", 35000.0, datetime.now() + timedelta(days=120)),
        ("Quỹ Khuyến học Vingroup", "Dành cho sinh viên có hoàn cảnh khó khăn đạt thành tích cao.", "Vingroup", 1500.0, datetime.now() + timedelta(days=30))
    ]
    
    for title, desc, provider, val, deadline in scholarships:
        cur.execute("""
            INSERT INTO scholarships (id, title, description, provider, value_amount, deadline, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING
        """, (str(uuid.uuid4()), title, desc, provider, val, deadline, datetime.now(), datetime.now()))

def seed_events(cur):
    events = [
        ("Workshop: Làm chủ AI 2026", "Tìm hiểu về ứng dụng của LLM trong phát triển phần mềm.", "workshop", "Hội trường A1, ĐH Công nghệ", datetime.now() + timedelta(days=7, hours=9), datetime.now() + timedelta(days=7, hours=12), 100),
        ("Hackathon: Green Tech Challenge", "Cuộc thi lập trình các giải pháp bảo vệ môi trường.", "hackathon", "Trung tâm Đổi mới Sáng tạo", datetime.now() + timedelta(days=14), datetime.now() + timedelta(days=16), 200),
        ("Seminar: Kỹ năng Viết CV & Phỏng vấn", "Hướng dẫn từ các chuyên gia tuyển dụng hàng đầu.", "seminar", "Phòng họp trực tuyến Zoom", datetime.now() + timedelta(days=3), datetime.now() + timedelta(days=3, hours=2), 500),
        ("Trại hè STEM cho Học sinh Cấp 3", "Khám phá khoa học qua các thí nghiệm thực tế.", "camp", "Cơ sở EduMap Thủ Đức", datetime.now() + timedelta(days=30), datetime.now() + timedelta(days=35), 50),
        ("Triển lãm Du học Quốc tế", "Gặp gỡ đại diện hơn 50 trường đại học toàn cầu.", "seminar", "Khách sạn Sheraton", datetime.now() + timedelta(days=20), datetime.now() + timedelta(days=20, hours=8), 1000)
    ]
    
    for title, desc, type, loc, start, end, cap in events:
        cur.execute("""
            INSERT INTO events (id, title, description, type, location, start_date, end_date, capacity, registered_count, status, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING
        """, (str(uuid.uuid4()), title, desc, type, loc, start, end, cap, 0, 'upcoming', datetime.now(), datetime.now()))

def seed_donations(cur):
    campaigns = [
        ("Xây dựng Phòng Lab STEM vùng cao", "Mục tiêu xây dựng 5 phòng Lab hiện đại cho trẻ em nghèo.", 500000000.0, 125000000.0, datetime.now() + timedelta(days=180)),
        ("Quỹ Tiếp sức Đến trường 2026", "Hỗ trợ học phí và dụng cụ học tập cho học sinh có hoàn cảnh đặc biệt.", 200000000.0, 85000000.0, datetime.now() + timedelta(days=60)),
        ("Trồng cây xanh Campus EduMap", "Chung tay vì một môi trường học tập xanh - sạch - đẹp.", 50000000.0, 42000000.0, datetime.now() + timedelta(days=30))
    ]
    
    for title, desc, target, current, end in campaigns:
        cur.execute("""
            INSERT INTO donation_campaigns (id, title, description, target_amount, current_amount, end_date, status, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING
        """, (str(uuid.uuid4()), title, desc, target, current, end, 'active', datetime.now(), datetime.now()))

def seed_internships(cur):
    internships = [
        ("Thực tập sinh Frontend (React/Next.js)", "Tham gia phát triển các tính năng UI hiện đại cho hệ sinh thái EduMap.", "Công nghệ phần mềm", "Tòa nhà Innovation, Quận 1, TP.HCM", datetime.now() + timedelta(days=30), "8.000.000 - 12.000.000 VNĐ"),
        ("Thực tập sinh AI/ML (Python)", "Nghiên cứu và triển khai các mô hình NLP cho chatbot giáo dục.", "Trí tuệ nhân tạo", "Phòng Lab AI, ĐH Công nghệ", datetime.now() + timedelta(days=45), "Thỏa thuận"),
        ("Thực tập sinh Marketing & Community", "Xây dựng chiến dịch truyền thông và quản lý cộng đồng sinh viên.", "Kinh doanh/Marketing", "Cơ sở EduMap Thủ Đức", datetime.now() + timedelta(days=20), "5.000.000 VNĐ"),
        ("Thực tập sinh Backend (NestJS/PostgreSQL)", "Xử lý logic nghiệp vụ và tối ưu hóa truy vấn cơ sở dữ liệu.", "Công nghệ phần mềm", "Làm việc từ xa (Remote)", datetime.now() + timedelta(days=60), "10.000.000 VNĐ")
    ]
    
    # Get a valid company_id (admin user)
    cur.execute("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
    admin_id = cur.fetchone()
    if not admin_id: return
    
    for title, desc, field, loc, deadline, salary in internships:
        cur.execute("""
            INSERT INTO internships (id, title, description, field, location_point, salary_range, deadline, company_id, status, created_at, updated_at)
            VALUES (%s, %s, %s, %s, ST_SetSRID(ST_MakePoint(106.660172, 10.762622), 4326), %s, %s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING
        """, (str(uuid.uuid4()), title, desc, field, salary, deadline, admin_id[0], 'open', datetime.now(), datetime.now()))

def main():
    conn = get_db_connection()
    if not conn:
        return
    
    cur = conn.cursor()
    try:
        print("Seeding Scholarships...")
        seed_scholarships(cur)
        print("Seeding Events...")
        seed_events(cur)
        print("Seeding Donation Campaigns...")
        seed_donations(cur)
        print("Seeding Internships...")
        seed_internships(cur)
        conn.commit()
        print("Seeding completed successfully!")
    except Exception as e:
        print(f"Error during seeding: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()
