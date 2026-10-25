import os
import sys
import json
import sqlite3
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


def get_sqlite_connection():
    """Ket noi SQLite — dung trong che do HF Spaces (DB_TYPE=sqlite).

    HF Spaces chay single-container voi SQLite thay the PostgreSQL.
    File DB nam tai DB_SQLITE_PATH (mac dinh: /app/frontend/public/edumap.db).
    """
    db_path = os.getenv("DB_SQLITE_PATH", "/app/frontend/public/edumap.db")
    if not os.path.exists(db_path) or os.path.getsize(db_path) < 1000:
        print(f"  -> SQLite DB khong ton tai hoac qua nho: {db_path}")
        return None
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row  # truy cap cot bang ten (tuong tu RealDictCursor)
        print(f"  -> Ket noi SQLite thanh cong tai {db_path}")
        return conn
    except Exception as e:
        print(f"  -> Loi ket noi SQLite: {e}")
        return None


def _coerce(value, default=""):
    """Chuyen doi gia tri SQLite (co the la JSON string, null) thanh chuoi."""
    if value is None:
        return default if isinstance(default, str) else str(default)
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def fetch_data_from_sqlite(conn):
    """Doc du lieu tu cac bang nghiep vu trong SQLite va chuyen doi thanh narrative text cho Vector RAG.

    Tuong duong voi fetch_data_from_db() nhung dung sqlite3 thay cho psycopg2.
    Cac cau query tuong tu (SQLite ho tro SELECT, LEFT JOIN, LIMIT).
    """
    documents = []
    metadatas = []
    ids = []

    cur = conn.cursor()  # sqlite3.Row factory da duoc set o get_sqlite_connection

    # 1. Hoc bong (scholarships)
    try:
        cur.execute("""
            SELECT id, title, description, provider, value_amount, deadline, eligibility_criteria
            FROM scholarships
            WHERE status = 'active' OR status IS NULL
        """)
        rows = [dict(r) for r in cur.fetchall()]
        for r in rows:
            criteria = r["eligibility_criteria"]
            if isinstance(criteria, str):
                # co the la JSON string
                try:
                    parsed = json.loads(criteria)
                    criteria_str = json.dumps(parsed, ensure_ascii=False)
                except (json.JSONDecodeError, ValueError):
                    criteria_str = criteria
            else:
                criteria_str = _coerce(criteria, "Theo quy che xet duoc")

            try:
                val = f"{float(r['value_amount']):,.0f} VND" if r.get("value_amount") else "Theo quy dinh"
            except (TypeError, ValueError):
                val = "Theo quy dinh"

            doc_text = (
                f"Thong tin hoc bong: {r['title']}. Don vi tai tro: {_coerce(r.get('provider'), 'EduMap / DNTU')}. "
                f"Gia tri hoc bong: {val}. Han chot nop ho so: {_coerce(r.get('deadline'), 'Xem thong bao')}. "
                f"Tieu chuan xet tuyen: {criteria_str}. Mo ta chi tiet: {_coerce(r.get('description'), '')}."
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
        rows = [dict(r) for r in cur.fetchall()]
        for r in rows:
            eq = r["equipment"]
            eq_str = _coerce(eq, "Thiet bi Robotics, may in 3D, he thong AI")

            doc_text = (
                f"Phong thuc hanh STEM: {r['name']}. "
                f"Dia diem/Vi tri: {_coerce(r.get('location_point_text'), 'Khuon vien DNTU')}. "
                f"Suc chua: {_coerce(r.get('capacity'), 'N/A')} sinh vien. "
                f"Trang thiet bi san co: {eq_str}. Lien he dang ky: {_coerce(r.get('contact'), 'Phong Quan ly STEM')}. "
                f"Quy che va mo ta: {_coerce(r.get('description'), 'Mo cua phuc vu sinh vien nghien cuu va sang tao.')}."
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
        rows = [dict(r) for r in cur.fetchall()]
        for r in rows:
            skills = r["skills_required"]
            skills_str = _coerce(skills, "Ky nang chuyen mon can ban va nang cao")

            doc_text = (
                f"Dinh huong va lo trinh nghe nghiep: {r['title']}. "
                f"Muc luong tham khao: {_coerce(r.get('salary_range'), 'Thoa thuan')}. "
                f"Nhu cau tuyen dung tren thi truong: {_coerce(r.get('demand_level'), 'Cao')}. "
                f"Cac ky nang can tich luy: {skills_str}. "
                f"Lo trinh chi tiet: {_coerce(r.get('description'), 'Chuong trinh dao tao gan lien voi nhu cau doanh nghiep.')}."
            )
            documents.append(doc_text)
            metadatas.append({
                "title": r["title"], "category": "career", "source": "db_career_paths",
                "skills_required": skills_str, "field": _coerce(r.get("field"), ""),
            })
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
        rows = [dict(r) for r in cur.fetchall()]
        for r in rows:
            doc_text = (
                f"Diem truy cap Wifi: {_coerce(r.get('name'), 'Wifi Cong cong')}. "
                f"Dia chi: {_coerce(r.get('address'), 'Khu vuc Bien Hoa / DNTU')}. "
                f"Toc do ket noi: {_coerce(r.get('speed_mbps'), '50')} Mbps. "
                f"Trang thai: {'Mien phi' if r.get('is_free', True) else 'Co phi'}. "
                f"Nha mang / Don vi: {_coerce(r.get('provider'), 'EduMap')}. "
                f"Huong dan ket noi: {_coerce(r.get('hint'), 'Khong can mat khau')}."
            )
            documents.append(doc_text)
            metadatas.append({"title": _coerce(r.get("name"), "Wifi"), "category": "wifi", "source": "db_wifi_locations"})
            ids.append(f"wifi_{r['id']}")
        if rows:
            print(f"  + Da doc {len(rows)} diem wifi tu bang wifi_locations.")
    except Exception as e:
        print(f"  ! Khong the doc bang wifi_locations: {e}")
        conn.rollback()

    # 5. Dia diem & Tien ich truong hoc (locations + location_categories)
    try:
        cur.execute("""
            SELECT l.id, l.name, l.description, l.address, l.city, c.name as category_name
            FROM locations l
            LEFT JOIN location_categories c ON l.category_id = c.id
            LIMIT 200
        """)
        rows = [dict(r) for r in cur.fetchall()]
        for r in rows:
            doc_text = (
                f"Dia diem ({_coerce(r.get('category_name'), 'Tien ich')}): {r['name']}. "
                f"Dia chi: {_coerce(r.get('address'), '')}, {_coerce(r.get('city'), 'Bien Hoa')}. "
                f"Thong tin gioi thieu: {_coerce(r.get('description'), 'Dia diem thuoc he thong ban do giao duc EduMap.')}."
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
            SELECT id, title, description, type, subject, grade, author_id
            FROM learning_materials
            WHERE status = 'published' OR status IS NULL
            LIMIT 100
        """)
        rows = [dict(r) for r in cur.fetchall()]
        for r in rows:
            doc_text = (
                f"Tai lieu hoc tap: {r['title']}. "
                f"The loai / Nganh: {_coerce(r.get('type'), r.get('subject') or 'Chung')}. "
                f"Lop / khoi: {_coerce(r.get('grade'), 'Chung')}. "
                f"Tac gia (author_id): {_coerce(r.get('author_id'), 'DNTU')}. "
                f"Tom tat noi dung: {_coerce(r.get('description'), '')}."
            )
            documents.append(doc_text)
            metadatas.append({
                "title": r["title"], "category": "library", "source": "db_learning_materials",
                "type": _coerce(r.get("type")), "subject": _coerce(r.get("subject")),
            })
            ids.append(f"material_{r['id']}")
        if rows:
            print(f"  + Da doc {len(rows)} tai lieu tu bang learning_materials.")
    except Exception as e:
        print(f"  ! Khong the doc bang learning_materials: {e}")
        conn.rollback()

    cur.close()
    return documents, metadatas, ids


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
            # Include skills_required in metadata so the semantic search can
            # compute match scores and missing-skills without re-parsing text.
            metadatas.append({"title": r["title"], "category": "career", "source": "db_career_paths", "skills_required": skills_str, "field": r.get("field") or ""})
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
        # schema thuc te: id, title, description, type, subject, grade, author_id, ...
        # (khong co cot category/author nhu cu — da sua de gioi qua loi "column does not exist")
        cur.execute("""
            SELECT id, title, description, type, subject, grade, author_id
            FROM learning_materials
            LIMIT 50
        """)
        rows = cur.fetchall()
        for r in rows:
            doc_text = (
                f"Tai lieu hoc tap: {r['title']}. "
                f"The loai / Nganh: {r.get('type') or r.get('subject') or 'Chung'}. "
                f"Lop / khoi: {r.get('grade') or 'Chung'}. "
                f"Tac gia (author_id): {r.get('author_id') or 'DNTU'}. "
                f"Tom tat noi dung: {r.get('description') or ''}."
            )
            documents.append(doc_text)
            metadatas.append({"title": r["title"], "category": "library", "source": "db_learning_materials", "type": r.get("type"), "subject": r.get("subject")})
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
    db_type = os.getenv("DB_TYPE", "postgres").lower()
    documents, metadatas, ids = [], [], []
    source = "database"

    if db_type == "sqlite":
        # ── HF Spaces mode: read from SQLite (edumap.db) ──
        conn = get_sqlite_connection()
        if conn:
            try:
                print("-> Dang doc du lieu tu SQLite (edumap.db)...")
                documents, metadatas, ids = fetch_data_from_sqlite(conn)
                conn.close()
                source = "sqlite"
            except Exception as e:
                print(f"Loi khi trich xuat du lieu tu SQLite: {e}")
                conn.close()
        else:
            print("-> Khong the ket noi SQLite, se thu PostgreSQL...")
            # Fall through to PostgreSQL attempt below
            db_type = "postgres"

    if db_type != "sqlite" or not documents:
        # ── PostgreSQL mode (local Docker Compose) ──
        conn = get_db_connection()
        if conn:
            try:
                print("-> Dang doc du lieu tu Database PostgreSQL...")
                documents, metadatas, ids = fetch_data_from_db(conn)
                conn.close()
            except Exception as e:
                print(f"Loi khi trich xuat du lieu tu Database: {e}")
                if conn:
                    conn.close()

    if not documents:
        print("-> Khong co du lieu tu DB hoac chua the ket noi DB.")
        print("-> Su dung bo tri thuc co ban ve DNTU & EduMap lam du lieu khoi tao...")
        documents, metadatas, ids = get_default_fallback_knowledge()
        source = "fallback"

    print(f"-> Dang danh chi muc (indexing) {len(documents)} tai lieu vao ChromaDB...")
    try:
        vector_store.add_documents(documents, metadatas, ids)
        print(f"=== THANH CONG: Da cap nhat {len(documents)} tai lieu vao Vector Database (source={source})! ===")
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
