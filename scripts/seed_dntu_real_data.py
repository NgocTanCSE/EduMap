import psycopg2
import json
import sys

DB_CONFIG = {
    "host": "localhost",
    "port": "5433",
    "dbname": "edumap_db",
    "user": "admin",
    "password": "password123"
}

def seed_real_dntu_data():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()

        print("--- VALIDATING & SEEDING REAL DNTU DATA ---")

        # 1. SEED SCHOLARSHIPS (opportunities table)
        print("1. Cleaning old DNTU scholarships...")
        cur.execute("DELETE FROM opportunities WHERE organization = 'Đại học Công nghệ Đồng Nai (DNTU)' AND type = 'scholarship';")

        scholarships = [
            {
                "title": "Học bổng Nữ sinh Kỹ thuật & Nam sinh Điều dưỡng",
                "desc": "Khuyến khích sinh viên phá vỡ định kiến giới tính nghề nghiệp.",
                "reqs": "- Tân sinh viên Nữ nhập học các ngành: Chế tạo máy, Kỹ thuật Điện - điện tử, Công nghệ Kỹ thuật Ô tô, Kỹ thuật xây dựng, Hóa học, Môi trường.\n- Tân sinh viên Nam nhập học ngành: Điều dưỡng.",
                "benefits": "Giảm 20% học phí toàn khóa học (4 năm).",
                "tags": ["Bình đẳng giới", "Kỹ thuật", "Sức khỏe"]
            },
            {
                "title": "Học bổng Thủ khoa đầu vào",
                "desc": "Dành cho sinh viên có thành tích xét tuyển xuất sắc nhất.",
                "reqs": "- Là Thủ khoa các phương thức xét tuyển vào trường.\n- Điểm hạnh kiểm loại Tốt.",
                "benefits": "Giảm 20% học phí Học kỳ 1 và Miễn phí 100% Ký túc xá năm học đầu tiên.",
                "tags": ["Thủ khoa", "Thành tích cao"]
            },
            {
                "title": "Học bổng Tiếp sức (Anh chị em ruột)",
                "desc": "Hỗ trợ gia đình có truyền thống theo học tại DNTU.",
                "reqs": "- Có anh/chị/em ruột đang học tại DNTU.\n- Cung cấp sổ hộ khẩu hoặc giấy khai sinh minh chứng.",
                "benefits": "Giảm 20% học phí toàn khóa học cho người nhập học sau.",
                "tags": ["Gia đình", "Hỗ trợ tài chính"]
            },
            {
                "title": "Học bổng Đối tác THPT (MOU)",
                "desc": "Dành cho học sinh tốt nghiệp từ các trường THPT có ký kết hợp tác.",
                "reqs": "- Tốt nghiệp từ trường THPT có MOU với DNTU.\n- Nhập học đúng thời hạn quy định.",
                "benefits": "Giảm 10% học phí toàn khóa học (4 năm).",
                "tags": ["MOU", "Hợp tác giáo dục"]
            }
        ]

        print("   Inserting real scholarships...")
        for s in scholarships:
            cur.execute("""
                INSERT INTO opportunities (title, description, type, organization, requirements, benefits, field_tags)
                VALUES (%s, %s, 'scholarship', 'Đại học Công nghệ Đồng Nai (DNTU)', %s, %s, %s)
            """, (s["title"], s["desc"], s["reqs"], s["benefits"], json.dumps(s["tags"])))


        # 2. SEED MAJORS (career_paths table)
        print("2. Cleaning old DNTU career paths...")
        cur.execute("DELETE FROM career_paths WHERE resources::text LIKE '%DNTU%';")

        majors = [
            {
                "title": "Công nghệ thông tin / Trí tuệ nhân tạo (AI)",
                "desc": "Chương trình đào tạo kỹ sư phần mềm, AI, khoa học dữ liệu hiện đại, nắm bắt xu hướng công nghệ 4.0.",
                "skills": ["Lập trình", "Thuật toán", "Toán học", "Tiếng Anh chuyên ngành", "Tư duy logic"],
                "demand": "Rất cao",
                "roadmap": {"year1": "Đại cương & Lập trình cơ bản", "year2": "Cấu trúc dữ liệu & OOP", "year3": "Chuyên ngành AI/Software", "year4": "Thực tập doanh nghiệp & Đồ án"}
            },
            {
                "title": "Công nghệ kỹ thuật Ô tô",
                "desc": "Đào tạo kỹ sư có kiến thức chuyên sâu về cơ khí, động cơ đốt trong và hệ thống điện - điện tử ô tô.",
                "skills": ["Cơ khí", "Điện tử", "Bản vẽ kỹ thuật", "AutoCAD", "Chẩn đoán lỗi"],
                "demand": "Cao",
                "roadmap": {"year1": "Toán & Lý kỹ thuật", "year2": "Chi tiết máy", "year3": "Thực hành Garage/Xưởng", "year4": "Đồ án ô tô điện"}
            },
            {
                "title": "Điều dưỡng & Kỹ thuật xét nghiệm y học",
                "desc": "Cung cấp kiến thức y khoa, thực hành lâm sàng đáp ứng nhu cầu nhân lực y tế khu vực.",
                "skills": ["Sinh học", "Hóa học", "Chăm sóc bệnh nhân", "Sử dụng thiết bị y tế", "Tỉ mỉ, cẩn thận"],
                "demand": "Rất cao",
                "roadmap": {"year1": "Khoa học cơ bản", "year2": "Y học cơ sở", "year3": "Thực hành lâm sàng tại BV", "year4": "Chuyên khoa sâu"}
            },
            {
                "title": "Quản trị dịch vụ du lịch & lữ hành",
                "desc": "Trang bị kỹ năng thiết kế, điều hành tour, quản lý nhà hàng khách sạn.",
                "skills": ["Giao tiếp", "Ngoại ngữ", "Tổ chức sự kiện", "Kiến thức văn hóa lịch sử"],
                "demand": "Trung bình - Cao",
                "roadmap": {"year1": "Đại cương du lịch", "year2": "Nghiệp vụ hướng dẫn", "year3": "Thực tập khách sạn/tour", "year4": "Quản trị chiến lược"}
            },
            {
                "title": "Thiết kế đồ họa & Nghệ thuật số",
                "desc": "Phát triển tư duy mỹ thuật, làm chủ công cụ thiết kế, dựng phim, hoạt hình 3D.",
                "skills": ["Thẩm mỹ", "Adobe Suite", "Vẽ tay", "Tư duy sáng tạo"],
                "demand": "Cao",
                "roadmap": {"year1": "Mỹ thuật cơ bản", "year2": "Nhiếp ảnh & Xử lý ảnh", "year3": "3D & Kỹ xảo", "year4": "Portfolio nghệ thuật"}
            }
        ]

        print("   Resetting sequence and inserting real majors...")
        cur.execute("SELECT setval('career_paths_id_seq', COALESCE((SELECT MAX(id)+1 FROM career_paths), 1), false);")
        dntu_resource = json.dumps([{"name": "Trang chủ DNTU", "url": "https://dntu.edu.vn"}])
        for m in majors:
            cur.execute("""
                INSERT INTO career_paths (title, description, skills_required, roadmap_json, demand_level, resources)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (m["title"], m["desc"], json.dumps(m["skills"]), json.dumps(m["roadmap"]), m["demand"], dntu_resource))

        conn.commit()
        print("--- SUCCESSFULLY VALIDATED AND SEEDED REAL DNTU DATA ---")

    except Exception as e:
        print(f"ERROR: Failed to seed data: {e}", file=sys.stderr)
        if conn:
            conn.rollback()
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()

if __name__ == "__main__":
    seed_real_dntu_data()
