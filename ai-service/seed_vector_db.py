import os
import sys
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from services.vector_store import vector_store


def get_db_connection():
    """Ket noi PostgreSQL linh hoat (ho tro ca trong container va ngoai host qua port external)."""
    candidates = [
        {
            "host": os.getenv("DB_HOST", "localhost"),
            "port": os.getenv("DB_PORT", "5432"),
        },
        {
            "host": "localhost",
            "port": os.getenv("POSTGRES_PORT_EXTERNAL", "5433"),
        },
        {
            "host": "localhost",
            "port": "5432",
        },
    ]
    db_name = os.getenv("DB_DATABASE", "edumap_db")
    user = os.getenv("DB_USERNAME", "admin")
    password = os.getenv("DB_PASSWORD", "password123")

    for cand in candidates:
        try:
            conn = psycopg2.connect(
                host=cand["host"],
                port=cand["port"],
                database=db_name,
                user=user,
                password=password,
                connect_timeout=3
            )
            print(f"-> Ket noi PostgreSQL thanh cong tai {cand['host']}:{cand['port']} (Database: {db_name})")
            return conn
        except Exception:
            continue
    return None


def fetch_data_from_db(conn):
    """Doc du lieu tu cac bang nghiep vu trong PostgreSQL va chuyen doi thanh narrative text cho Vector RAG."""
    documents = []
    metadatas = []
    ids = []

    cur = conn.cursor(cursor_factory=RealDictCursor)

    # 1. Hoc bong (scholarships)
    try:
        cur.execute("""
            SELECT id, title, description, provider, value_amount, deadline, eligibility_criteria
            FROM scholarships
            WHERE status = 'active' OR status IS NULL
        """)
        rows = cur.fetchall()
        for r in rows:
            criteria = r.get("eligibility_criteria")
            if isinstance(criteria, (dict, list)):
                criteria_str = json.dumps(criteria, ensure_ascii=False)
            else:
                criteria_str = str(criteria or "Theo quy che xet duyet")

            val = f"{float(r['value_amount']):,.0f} VND" if r.get("value_amount") else "Theo quy dinh"
            doc_text = (
                f"Thong tin hoc bong: {r['title']}. Don vi tai tro: {r.get('provider') or 'EduMap / DNTU'}. "
                f"Gia tri hoc bong: {val}. Han chot nop ho so: {r.get('deadline') or 'Xem thong bao'}. "
                f"Tieu chuan xet tuyen: {criteria_str}. Mo ta chi tiet: {r.get('description') or ''}."
            )
            documents.append(doc_text)
            metadatas.append({"title": r["title"], "category": "scholarship", "source": "db_scholarships"})
            ids.append(f"scholarship_{r['id']}")
        if rows:
            print(f"  + Da doc {len(rows)} hoc bong tu bang scholarships.")
    except Exception as e:
        print(f"  ! Khong the doc bang scholarships: {e}")
        conn.rollback()

    # 2. Phong STEM Lab (stem_labs)
    try:
        cur.execute("""
            SELECT id, name, description, equipment, location_point_text, capacity, contact
            FROM stem_labs
        """)
        rows = cur.fetchall()
        for r in rows:
            eq = r.get("equipment")
            if isinstance(eq, (dict, list)):
                eq_str = json.dumps(eq, ensure_ascii=False)
            else:
                eq_str = str(eq or "Thiet bi Robotics, may in 3D, he thong AI")

            doc_text = (
                f"Phong thuc hanh STEM: {r['name']}. "
                f"Dia diem/Vi tri: {r.get('location_point_text') or 'Khuon vien DNTU'}. "
                f"Suc chua: {r.get('capacity') or 'N/A'} sinh vien. "
                f"Trang thiet bi san co: {eq_str}. Lien he dang ky: {r.get('contact') or 'Phong Quan ly STEM'}. "
                f"Quy che va mo ta: {r.get('description') or 'Mo cua phuc vu sinh vien nghien cuu va sang tao.'}."
            )
            documents.append(doc_text)
            metadatas.append({"title": r["name"], "category": "facility", "source": "db_stem_labs"})
            ids.append(f"stem_lab_{r['id']}")
        if rows:
            print(f"  + Da doc {len(rows)} phong STEM tu bang stem_labs.")
    except Exception as e:
        print(f"  ! Khong the doc bang stem_labs: {e}")
        conn.rollback()

    # 3. Lo trinh nghe nghiep (career_paths)
    try:
        cur.execute("""
            SELECT id, title, description, skills_required, roadmap_json, salary_range, demand_level
            FROM career_paths
        """)
        rows = cur.fetchall()
        for r in rows:
            skills = r.get("skills_required")
            if isinstance(skills, (dict, list)):
                skills_str = json.dumps(skills, ensure_ascii=False)
            else:
                skills_str = str(skills or "Ky nang chuyen mon can ban va nang cao")

            doc_text = (
                f"Dinh huong va lo trinh nghe nghiep: {r['title']}. "
                f"Muc luong tham khao: {r.get('salary_range') or 'Thoa thuan'}. "
                f"Nhu cau tuyen dung tren thi truong: {r.get('demand_level') or 'Cao'}. "
                f"Cac ky nang can tich luy: {skills_str}. "
                f"Lo trinh chi tiet: {r.get('description') or 'Chuong trinh dao tao gan lien voi nhu cau doanh nghiep.'}."
            )
            documents.append(doc_text)
            metadatas.append({"title": r["title"], "category": "career", "source": "db_career_paths"})
            ids.append(f"career_{r['id']}")
        if rows:
            print(f"  + Da doc {len(rows)} lo trinh nghe nghiep tu bang career_paths.")
    except Exception as e:
        print(f"  ! Khong the doc bang career_paths: {e}")
        conn.rollback()

    # 4. Diem truy cap Wifi (wifi_locations)
    try:
        cur.execute("""
            SELECT id, name, address, speed_mbps, is_free, provider, hint
            FROM wifi_locations
            LIMIT 50
        """)
        rows = cur.fetchall()
        for r in rows:
            doc_text = (
                f"Diem truy cap Wifi: {r.get('name') or 'Wifi Cong cong'}. "
                f"Dia chi: {r.get('address') or 'Khu vuc Bien Hoa / DNTU'}. "
                f"Toc do ket noi: {r.get('speed_mbps') or '50'} Mbps. "
                f"Trang thai: {'Mien phi' if r.get('is_free', True) else 'Co thu phi'}. "
                f"Nha mang / Don vi: {r.get('provider') or 'EduMap'}. "
                f"Huong dan ket noi: {r.get('hint') or 'Khong can mat khau'}."
            )
            documents.append(doc_text)
            metadatas.append({"title": r.get("name", "Wifi"), "category": "wifi", "source": "db_wifi_locations"})
            ids.append(f"wifi_{r['id']}")
        if rows:
            print(f"  + Da doc {len(rows)} diem wifi tu bang wifi_locations.")
    except Exception as e:
        print(f"  ! Khong the doc bang wifi_locations: {e}")
        conn.rollback()

    # 5. Dia diem & Tien ich truong hoc (locations)
    try:
        cur.execute("""
            SELECT l.id, l.name, l.description, l.address, l.city, c.name as category_name
            FROM locations l
            LEFT JOIN location_categories c ON l.category_id = c.id
            LIMIT 100
        """)
        rows = cur.fetchall()
        for r in rows:
            doc_text = (
                f"Dia diem ({r.get('category_name') or 'Tien ich'}): {r['name']}. "
                f"Dia chi: {r.get('address') or ''}, {r.get('city') or 'Bien Hoa'}. "
                f"Thong tin gioi thieu: {r.get('description') or 'Dia diem thuoc he thong ban do giao duc EduMap.'}."
            )
            documents.append(doc_text)
            metadatas.append({"title": r["name"], "category": "location", "source": "db_locations"})
            ids.append(f"location_{r['id']}")
        if rows:
            print(f"  + Da doc {len(rows)} dia diem tu bang locations.")
    except Exception as e:
        print(f"  ! Khong the doc bang locations: {e}")
        conn.rollback()

    # 6. Tai lieu hoc tap & Thu vien (learning_materials)
    try:
        cur.execute("""
            SELECT id, title, description, category, author
            FROM learning_materials
            LIMIT 50
        """)
        rows = cur.fetchall()
        for r in rows:
            doc_text = (
                f"Tai lieu hoc tap: {r['title']}. "
                f"The loai / Nganh: {r.get('category') or 'Chung'}. "
                f"Tac gia: {r.get('author') or 'DNTU'}. "
                f"Tom tat noi dung: {r.get('description') or ''}."
            )
            documents.append(doc_text)
            metadatas.append({"title": r["title"], "category": "library", "source": "db_learning_materials"})
            ids.append(f"material_{r['id']}")
        if rows:
            print(f"  + Da doc {len(rows)} tai lieu tu bang learning_materials.")
    except Exception as e:
        print(f"  ! Khong the doc bang learning_materials: {e}")
        conn.rollback()

    cur.close()
    return documents, metadatas, ids


def get_default_fallback_knowledge():
    """Bo tri thuc nen tang mac dinh ve Truong DNTU & EduMap (dung khi DB chua co du lieu hoac chua chay)."""
    knowledge_base = [
        {
            "id": "info_dntu_location",
            "doc": "Trường Đại học Công nghệ Đồng Nai (DNTU) tọa lạc tại đường Nguyễn Khuyến, phường Trảng Dài, thành phố Biên Hòa, tỉnh Đồng Nai. Đây là trung tâm giáo dục hiện đại với diện tích rộng lớn và cơ sở vật chất tiên tiến.",
            "metadata": {"title": "Vị trí DNTU", "category": "general", "source": "fallback"}
        },
        {
            "id": "info_edumap_purpose",
            "doc": "EduMap là nền tảng bản đồ giáo dục thông minh (Smart Education Map) được thiết kế riêng cho sinh viên DNTU. Mục tiêu của EduMap là giúp sinh viên dễ dàng định vị các tài nguyên giáo dục, kết nối với mentor và nhận tư vấn sự nghiệp dựa trên AI.",
            "metadata": {"title": "Giới thiệu EduMap", "category": "general", "source": "fallback"}
        },
        {
            "id": "scholarship_talent_2026",
            "doc": "Học bổng EduMap Talent 2026 dành cho sinh viên có thành tích học tập xuất sắc (GPA > 3.6) hoặc đạt giải cao trong các kỳ thi Hackathon. Giá trị học bổng lên đến 50.000.000 VNĐ và cơ hội thực tập tại các tập đoàn công nghệ đối tác.",
            "metadata": {"title": "Học bổng Talent 2026", "category": "scholarship", "source": "fallback"}
        },
        {
            "id": "stem_lab_rules",
            "doc": "Phòng STEM Lab tại DNTU mở cửa cho sinh viên từ thứ 2 đến thứ 7 hàng tuần (8:00 - 17:00). Sinh viên cần đăng ký trước thông qua EduMap để sử dụng các thiết bị Robotics, in 3D và máy tính cấu hình cao cho nghiên cứu AI.",
            "metadata": {"title": "Quy định STEM Lab", "category": "facility", "source": "fallback"}
        },
        {
            "id": "career_path_it",
            "doc": "Lộ trình sự nghiệp cho sinh viên CNTT tại DNTU bao gồm các giai đoạn: Học căn bản (Năm 1-2), Thực tập dự án (Năm 3), và Chuyên sâu Web/AI/Mobile (Năm 4). EduMap cung cấp các khóa học bổ trợ và kết nối doanh nghiệp để hỗ trợ lộ trình này.",
            "metadata": {"title": "Lộ trình CNTT", "category": "career", "source": "fallback"}
        },
        {
            "id": "green_living_rewards",
            "doc": "Tính năng Sống Xanh (Green Living) trên EduMap cho phép sinh viên báo cáo các hành động bảo vệ môi trường như sử dụng xe đạp, tiết kiệm điện tại ký túc xá. Mỗi hành động được cộng điểm 'Eco-Point' dùng để đổi quà tại canteen trường.",
            "metadata": {"title": "Tính năng Sống Xanh", "category": "gamification", "source": "fallback"}
        },
        {
            "id": "wifi_locations_bienhoa",
            "doc": "Các điểm truy cập Wifi miễn phí do EduMap ghi nhận tại Biên Hòa bao gồm: Công viên Biên Hùng, Quảng trường tỉnh Đồng Nai và toàn bộ khuôn viên Đại học Công nghệ Đồng Nai.",
            "metadata": {"title": "Wifi miễn phí", "category": "facility", "source": "fallback"}
        }
    ]
    return (
        [item["doc"] for item in knowledge_base],
        [item["metadata"] for item in knowledge_base],
        [item["id"] for item in knowledge_base]
    )


def seed_data():
    print("=== DONG BO DU LIEU DATABASE VAO VECTOR STORE (CHROMADB) ===")
    conn = get_db_connection()

    documents, metadatas, ids = [], [], []
    source = "database"

    if conn:
        try:
            print("-> Dang doc du lieu tu Database PostgreSQL...")
            documents, metadatas, ids = fetch_data_from_db(conn)
            conn.close()
        except Exception as e:
            print(f"Loi khi trich xuat du lieu tu Database: {e}")

    if not documents:
        print("-> Khong co du lieu tu DB hoac chua the ket noi DB.")
        print("-> Su dung bo tri thuc co ban ve DNTU & EduMap lam du lieu khoi tao...")
        documents, metadatas, ids = get_default_fallback_knowledge()
        source = "fallback"

    print(f"-> Dang danh chi muc (indexing) {len(documents)} tai lieu vao ChromaDB...")
    try:
        vector_store.add_documents(documents, metadatas, ids)
        print(f"=== THANH CONG: Da cap nhat {len(documents)} tai lieu vao Vector Database! ===")
        return {
            "status": "success",
            "message": f"Đã đồng bộ thành công {len(documents)} tài liệu vào ChromaDB.",
            "synced_count": len(documents),
            "source": source
        }
    except Exception as e:
        print(f"Loi khi indexing vao ChromaDB: {e}")
        return {
            "status": "error",
            "message": f"Lỗi khi indexing vào ChromaDB: {str(e)}",
            "synced_count": 0,
            "source": source
        }


if __name__ == "__main__":
    result = seed_data()
    print(result)
