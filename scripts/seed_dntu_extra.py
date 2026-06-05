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

def seed_business_and_intern():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        # 1. Seed Business Profiles (KCN Amata & Bien Hoa)
        print("Seeding Business Profiles around DNTU...")
        business_data = [
            ("Tập đoàn Amata City Biên Hòa", "Đơn vị quản lý KCN Amata, đối tác chiến lược của DNTU.", "Công nghiệp / Quản lý", "KCN Amata, Long Bình, Biên Hòa", "https://www.amata.com"),
            ("Nestlé Việt Nam (Nhà máy Amata)", "Tập đoàn thực phẩm và thức uống lớn nhất thế giới.", "Thực phẩm / FMCG", "Đường số 9, KCN Amata, Biên Hòa", "https://www.nestle.com.vn"),
            ("Brother Industries Việt Nam", "Công ty Nhật Bản chuyên sản xuất máy in và thiết bị điện tử.", "Kỹ thuật / Điện tử", "Đường số 11, KCN Amata, Biên Hòa", "https://www.brother.com.vn"),
            ("Bayer Việt Nam", "Tập đoàn đa quốc gia trong lĩnh vực Chăm sóc sức khỏe và Nông nghiệp.", "Hóa học / Y tế", "KCN Amata, Long Bình, Biên Hòa", "https://www.bayer.com.vn"),
            ("Kao Việt Nam", "Công ty sản xuất hàng tiêu dùng nổi tiếng từ Nhật Bản.", "Sản xuất / Marketing", "Đường số 10, KCN Amata, Biên Hòa", "https://www.kao.com/vn"),
        ]
        
        business_ids = []
        for name, desc, industry_val, addr, web in business_data:
            cur.execute("""
                INSERT INTO business_profiles (id, name, description, industry, address, website, is_verified, user_id)
                VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, gen_random_uuid())
                RETURNING id;
            """, (name, desc, industry_val, addr, web, True))
            business_ids.append(cur.fetchone()[0])

        # 2. Seed Internships
        print("Seeding Internship Opportunities for DNTU students...")
        intern_data = [
            (business_ids[0], "Thực tập sinh Quản lý Hạ tầng KCN", "Hỗ trợ giám sát vận hành hệ thống kỹ thuật tại KCN Amata.", "Engineering", ["CAD", "Project Management"]),
            (business_ids[1], "Nesternship 2026 - Supply Chain", "Chương trình thực tập chuyên nghiệp tại bộ phận Chuỗi cung ứng.", "Logistics", ["Excel", "Analytical Thinking"]),
            (business_ids[2], "Thực tập sinh Kỹ thuật Điện - Điện tử", "Tham gia bảo trì và vận hành dây chuyền sản xuất máy in.", "IT / Engineering", ["Electronic", "IoT"]),
            (business_ids[3], "Thực tập sinh Nghiên cứu Nông nghiệp", "Hỗ trợ thí nghiệm và phân tích dữ liệu nông nghiệp tại Lab.", "Science", ["Biology", "Data Analysis"]),
        ]
        
        expiry = datetime.now() + timedelta(days=60)
        for b_id, title, desc, category, skills in intern_data:
            cur.execute("""
                INSERT INTO internships (id, company_id, title, description, field, requirements, deadline, status)
                VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s);
            """, (b_id, title, desc, category, json.dumps(skills), expiry, "open"))

        # 3. Seed Events
        print("Seeding DNTU Campus Events...")
        event_data = [
            ("DNTU Robotics Championship 2026", "Cuộc thi sáng tạo Robot dành cho sinh viên khối ngành kỹ thuật.", "Competition", "Nhà thi đấu DNTU"),
            ("Ngày hội Việc làm DNTU - Amata Job Fair", "Kết nối sinh viên với hơn 50 doanh nghiệp tại KCN Amata.", "Workshop", "Sân trung tâm DNTU"),
            ("Chiến dịch Mùa hè xanh 2026", "Hoạt động tình nguyện tại các xã vùng sâu vùng xa tỉnh Đồng Nai.", "Volunteer", "Tỉnh Đồng Nai"),
            ("Workshop: Kỹ năng viết CV và Phỏng vấn", "Hỗ trợ sinh viên cuối khóa chuẩn bị hành trang lập nghiệp.", "Workshop", "Hội trường G - DNTU"),
        ]
        
        event_start = datetime.now() + timedelta(days=15)
        for title, desc, e_type, loc in event_data:
            cur.execute("""
                INSERT INTO events (id, title, description, type, location, start_date, end_date, status)
                VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s);
            """, (title, desc, e_type, loc, event_start, event_start + timedelta(hours=4), "upcoming"))

        conn.commit()
        print("DNTU Business, Internships and Events data seeded successfully!")
        
    except Exception as e:
        print(f"Error seeding data: {e}", file=sys.stderr)
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    seed_business_and_intern()
