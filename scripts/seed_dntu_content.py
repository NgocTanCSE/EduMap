import psycopg2
import sys
import json
from datetime import datetime, timedelta

# --- Database Configuration ---
DB_CONFIG = {
    "host": "localhost",
    "port": "5433",
    "dbname": "edumap_db",
    "user": "admin",
    "password": "password123"
}

def seed_content():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        # 1. Get Admin ID
        cur.execute("SELECT id FROM users WHERE email = 'admin@edumap.vn' LIMIT 1;")
        admin_row = cur.fetchone()
        if not admin_row:
            print("ERROR: Admin user not found. Please run database seed first.")
            return
        admin_id = admin_row[0]

        # 2. Seed Learning Materials (Library)
        print("Seeding DNTU Library materials...")
        library_data = [
            ("Giáo trình Kỹ thuật Lập trình DNTU", "Tài liệu giảng dạy chính thức cho sinh viên khoa CNTT.", "book", "Lập trình", ["Basic", "DNTU"]),
            ("Tuyển tập luận văn Thạc sĩ CNTT 2025", "Các công trình nghiên cứu tiêu biểu của học viên cao học DNTU.", "pdf", "Lập trình", ["Research", "IT"]),
            ("Hướng dẫn sử dụng Thư viện Nhà C", "Cẩm nang hướng dẫn sinh viên khai thác học liệu tại tòa nhà C.", "pdf", "Kỹ năng mềm", ["Student Guide", "Lib"]),
            ("Ngôn ngữ C++ nâng cao - Khoa Công nghệ", "Bài giảng chuyên sâu về lập trình đối tượng.", "book", "Lập trình", ["Advanced", "C++"]),
            ("Tiếng Anh chuyên ngành Kỹ thuật Ô tô", "Bộ từ vựng và thuật ngữ chuyên ngành ô tô tại DNTU.", "pdf", "Ngoại ngữ", ["English", "Automotive"]),
        ]
        
        for title, desc, m_type, cat, tags in library_data:
            cur.execute("""
                INSERT INTO learning_materials (id, title, description, type, category, tags, view_count)
                VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s)
                ON CONFLICT DO NOTHING;
            """, (title, desc, m_type, cat, tags, 120))

        # 3. Seed Scholarships
        print("Seeding DNTU Scholarships...")
        scholarship_data = [
            ("Học bổng Mirinda 2025 - DNTU", "Học bổng dành cho sinh viên có thành tích xuất sắc và tích cực tham gia phong trào.", "DNTU & PepsiCo", 5000000.0, ["GPA > 3.2", "Đoàn viên ưu tú"]),
            ("Học bổng Ươm mầm Tài năng Trẻ", "Hỗ trợ học phí cho tân sinh viên K21 có điểm đầu vào cao.", "DNTU", 10000000.0, ["Điểm xét tuyển > 24", "Tân sinh viên"]),
            ("Học bổng Doanh nghiệp Nhật Bản 2026", "Cơ hội thực tập và làm việc tại Nhật Bản cho sinh viên Đông phương học.", "Japanese Partners", 15000000.0, ["JLPT N3", "Sinh viên năm 3-4"]),
        ]
        
        deadline = datetime.now() + timedelta(days=30)
        for title, desc, prov, val, criteria in scholarship_data:
            cur.execute("""
                INSERT INTO scholarships (id, title, description, provider, value_amount, deadline, eligibility_criteria)
                VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s)
                ON CONFLICT DO NOTHING;
            """, (title, desc, prov, val, deadline, json.dumps(criteria)))

        # 4. Seed News Posts (Community)
        print("Seeding DNTU News & Community posts...")
        posts_data = [
            ("DNTU Robotics Championship 2026 chính thức khởi tranh!", "Cuộc thi thường niên lớn nhất về Robot tại DNTU đã quy tụ hàng chục đội chơi. 8 đội xuất sắc nhất đã lọt vào chung kết."),
            ("Ngày hội Thực tập và Làm việc Quốc tế 2026", "Kết nối hơn 50 doanh nghiệp nước ngoài với sinh viên DNTU. Hàng trăm cơ hội việc làm tại Nhật Bản, Hàn Quốc."),
            ("Workshop 'Sinh viên DNTU học tập và làm theo Bác'", "Chuỗi hoạt động bồi dưỡng tư tưởng và đạo đức cho thế hệ trẻ DNTU năm học 2025-2026."),
            ("Chào đón Tân sinh viên Khóa 21 gia nhập mái nhà chung", "Tuần lễ hội nhập đầy sôi động với các hoạt động Teambuilding và Gala âm nhạc."),
        ]
        
        for title, content in posts_data:
            cur.execute("""
                INSERT INTO posts (id, author_id, title, content, like_count, comment_count)
                VALUES (gen_random_uuid(), %s, %s, %s, 10, 5)
                ON CONFLICT DO NOTHING;
            """, (admin_id, title, content))

        conn.commit()
        print("All real-world DNTU content seeded successfully!")
        
    except Exception as e:
        print(f"Error seeding content: {e}", file=sys.stderr)
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    seed_content()
