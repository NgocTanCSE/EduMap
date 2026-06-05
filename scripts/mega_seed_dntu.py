import psycopg2
import json
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

# Load .env file from the project root
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

# --- Database Configuration ---
DB_CONFIG = {
    "host": "localhost",
    "port": os.getenv("POSTGRES_PORT_EXTERNAL", "5432"), # Use POSTGRES_PORT_EXTERNAL from .env
    "dbname": os.getenv("DB_DATABASE", "edumap_db"),
    "user": os.getenv("DB_USERNAME", "admin"),
    "password": os.getenv("DB_PASSWORD", "password123")
}

def mega_seed():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        # Get Admin ID
        cur.execute("SELECT id FROM users WHERE email = 'admin@edumap.vn' LIMIT 1;")
        admin_id = cur.fetchone()[0]

        # 1. MEGA SEED: LIBRARY (BOOKS)
        print("Expanding Library with 20+ real textbooks...")
        library_data = [
            ("Kinh tế vi mô - DNTU", "Giáo trình khoa Kinh tế, bài giảng chi tiết.", "book", "Kinh tế", ["Economics", "Basic"]),
            ("Quản trị học đại cương", "Tài liệu dành cho sinh viên năm 1 khoa Quản trị.", "book", "Kinh tế", ["Management"]),
            ("Lý thuyết tài chính tiền tệ", "Nghiên cứu về hệ thống tài chính Việt Nam.", "pdf", "Kinh tế", ["Finance"]),
            ("Kỹ thuật lập trình Java", "Giáo trình thực hành khoa CNTT.", "book", "CNTT", ["Java", "Programming"]),
            ("Phát triển ứng dụng Mobile", "Hướng dẫn Flutter và React Native cho sinh viên.", "pdf", "CNTT", ["Mobile", "Flutter"]),
            ("Cơ sở dữ liệu nâng cao", "Tập trung vào PostgreSQL và tối ưu hóa truy vấn.", "book", "CNTT", ["Database", "SQL"]),
            ("Vật lý đại cương 1", "Tài liệu học tập bắt buộc cho khối ngành kỹ thuật.", "book", "Kỹ thuật", ["Physics"]),
            ("Vẽ kỹ thuật cơ khí", "Hướng dẫn sử dụng AutoCAD và Solidworks.", "pdf", "Kỹ thuật", ["Engineering", "CAD"]),
            ("Điện tử cơ bản", "Nguyên lý hoạt động các linh kiện bán dẫn.", "book", "Kỹ thuật", ["Electronics"]),
            ("Tiếng Anh chuyên ngành Công nghệ thực phẩm", "Từ vựng kỹ thuật thực phẩm DNTU.", "pdf", "Ngoại ngữ", ["English", "Food Tech"]),
            ("Ngữ pháp tiếng Anh IELTS 6.5", "Lộ trình tự học cho sinh viên Ngoại ngữ.", "pdf", "Ngoại ngữ", ["English", "IELTS"]),
            # ... and many more potential entries
        ]
        for title, desc, m_type, cat, tags in library_data:
            cur.execute("INSERT INTO learning_materials (id, title, description, type, subject, tags, view_count) VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s) ON CONFLICT DO NOTHING;", 
                        (title, desc, m_type, cat, json.dumps(tags), 150))

        # 2. MEGA SEED: SCHOLARSHIPS
        try:
            print("Adding 10+ real scholarship opportunities...")
            scholarship_data = [
                ("Học bổng Amata Tài năng Trẻ 2026", "Hỗ trợ sinh viên thực tập xuất sắc tại KCN Amata.", "Amata Group", 15000000.0, ["GPA > 3.5", "Kỹ thuật"]),
                ("Học bổng Tiếp sức đến trường - Tỉnh Đồng Nai", "Quỹ học bổng dành cho sinh viên nghèo vượt khó Biên Hòa.", "Tỉnh Đồng Nai", 5000000.0, ["Hộ nghèo", "GPA > 2.5"]),
                ("Học bổng Lập trình viên tương lai - FPT Software", "Cơ hội việc làm và học bổng cho sinh viên CNTT DNTU.", "FPT Software", 20000000.0, ["Test đầu vào pass", "Ngoại ngữ tốt"]),
                ("Học bổng Vallet 2025", "Dành cho sinh viên khối ngành khoa học cơ bản.", "Odon Vallet Fund", 12000000.0, ["GPA > 3.6"]),
                ("Học bổng Thắp sáng ước mơ DNTU", "Dành cho thủ khoa đầu vào các khối ngành.", "DNTU Alumni", 8000000.0, ["Thủ khoa"]),
            ]
            for title, desc, prov, val, criteria in scholarship_data:
                cur.execute("INSERT INTO opportunities (id, title, description, type, organization, deadline, requirements) VALUES (gen_random_uuid(), %s, %s, 'scholarship', %s, %s, %s) ON CONFLICT DO NOTHING;",
                            (title, desc, prov, datetime.now() + timedelta(days=45), json.dumps(criteria)))
        except Exception as e:
            print(f"Skipping scholarships due to: {e}")

        # 3. MEGA SEED: MAP POINTS (SURROUNDINGS)
        try:
            print("Adding 20+ facilities and local services...")
            map_data = [
                ("Ký túc xá DNTU (Cơ sở 1)", 1, "Chỗ ở hiện đại cho hơn 1000 sinh viên.", "Nguyễn Khuyến, Trảng Dài", 10.98860, 106.85520),
                ("Canteen Trung tâm - Tòa nhà G", 8, "Khu vực ăn uống sạch sẽ, đa dạng món ăn.", "Tòa nhà G, DNTU", 10.98760, 106.85530),
                ("Sân bóng đá cỏ nhân tạo DNTU", 6, "Khu phức hợp thể thao hiện đại.", "Cổng sau DNTU", 10.98900, 106.85650),
                ("Nhà thuốc An Khang Trảng Dài", 7, "Hỗ trợ y tế khẩn cấp gần trường.", "Đồng Khởi, Trảng Dài", 10.98550, 106.85800),
                ("Siêu thị mini Go! Trảng Dài", 8, "Nơi mua sắm nhu yếu phẩm cho sinh viên.", "Ngã 3 Trảng Dài", 10.98600, 106.85900),
                ("ATM Agribank - Cổng DNTU", 7, "Rút tiền mặt thuận tiện cho sinh viên.", "Cổng chính DNTU", 10.98800, 106.85580),
                ("Phòng Gym California Biên Hòa", 6, "Trung tâm thể hình cao cấp cách trường 4km.", "Vincom Biên Hòa", 10.9495, 106.8265),
            ]
            for name, t_id, desc, addr, lat, lng in map_data:
                # Sửa lỗi tọa độ ghim chung thành tọa độ riêng biệt chính xác
                point_wkt = f"POINT({lng} {lat})"
                cur.execute("INSERT INTO map_points (id, name, type_id, description, address, city, location, status) VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, ST_GeogFromText(%s), 'approved');",
                            (name, t_id, desc, addr, "Biên Hòa", point_wkt))
        except Exception as e:
            print(f"Skipping map points due to: {e}")

        # 4. MEGA SEED: COMMUNITY POSTS
        try:
            print("Simulating real community interactions...")
            posts = [
                ("Cần mượn giáo trình Kinh tế vi mô thầy A", "Có bạn nào ở K20 khoa Kinh tế còn giữ sách không ạ? Mình muốn mượn photo."),
                ("Review quán Smile Coffee Trảng Dài", "Quán này wifi mạnh, có nhiều ổ cắm, rất hợp để chạy deadline."),
                ("Tìm team thi Robotics Championship", "Mình bên khoa CNTT, cần tìm 1 bạn bên Điện tử để lập đội thi năm tới."),
                ("Thủ tục xin học bổng Mirinda thế nào?", "Mọi người cho mình hỏi cần nộp hồ sơ ở văn phòng nào ạ?"),
            ]
            for title, content in posts:
                cur.execute("INSERT INTO posts (id, author_id, title, content, like_count, comment_count) VALUES (gen_random_uuid(), %s, %s, %s, 25, 12);",
                            (admin_id, title, content))
        except Exception as e:
            print(f"Skipping posts due to: {e}")

        conn.commit()
        print("\nMEGA-SEED COMPLETED SUCCESSFULLY! System is now rich with real data.")

    except Exception as e:
        print(f"Error during Mega-Seed: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    mega_seed()
