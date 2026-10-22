#!/usr/bin/env python3
"""
EduMap — Portable SQLite seeder for HF Spaces (DB_TYPE=sqlite).

WHY THIS EXISTS
---------------
The committed `frontend/public/edumap.db` is the single source of truth for the
HF Spaces (single-container, SQLite) deployment. `seed.sql` (PostgreSQL) was
already updated with the fresh 2026 competitions (Eureka 2026, P2A AI
Appathon 2026, Innovation Challenge 2026, new jobs, scholarships, …) but the
committed `.db` was never regenerated — so on both HF and local the latest
jobs / campaigns / events / hackathons stay invisible and only stale (2024/25)
rows appear.

`regenerate_sqlite_db.sh` previously rebuilt the DB through Docker + Postgres
(`migrate-pg-to-sqlite.py`), which is fragile: it needs a running postgis
container, and `migrate-pg-to-sqlite.py` has a bug where it calls `sys.exit`
before `sys` is imported. This script is the portable, dependency-free path:
it upserts the fresh feature data directly into the SQLite DB and never wipes
existing rows (INSERT … ON CONFLICT(id) DO NOTHING + idempotent UPDATEs).

Safe to run repeatedly. Safe to run in CI / HF build / locally.

Usage:
    python3 scripts/seed_sqlite_db.py                         # patch default DB
    EDUMAP_SQLITE_DB=/path/to/edumap.db python3 scripts/seed_sqlite_db.py
"""
import json
import os
import shutil
import sqlite3
import sys
from datetime import datetime, timezone

DEFAULT_DB = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "edumap.db")
)

# EduMap organizer / business user ids referenced by seed.sql (already present
# in the committed DB), used to keep FK-ish references sane. SQLite has FK
# enforcement OFF by default, so these are soft references and cannot break the
# import.
EDUMAP_ORG_USER = "f08ce2f3-f866-47b3-964b-aea280a8e443"
SONADEZI_BUSINESS = "d9c7edeb-0b15-4d26-8c40-f2bdcc902306"

# Matches the timestamp the committed DB was last built with (see seed.sql
# CURRENT_TIMESTAMP / build time). Using a fixed value keeps diffs reproducible.
NOW = "2026-10-16T00:58:14.000000+00:00"


def geo_point(lon: float, lat: float) -> str:
    """GeoJSON 'Point' string — matches the format already stored in edumap.db."""
    return json.dumps({"type": "Point", "coordinates": [lon, lat]})


def upsert(con, table, cols, rows):
    """Insert rows that do NOT already exist (idempotent).

    The committed SQLite schema does NOT declare a PRIMARY KEY on `id` (the
    Postgres→SQLite migration dropped the PK declarations), so
    `ON CONFLICT(id) DO NOTHING` is unavailable. We instead dedup in Python
    against the existing ids and INSERT the newcomers — safe and schema-free.
    `cols[0]` must be `id`; each row is a tuple aligned to `cols`.
    """
    if not rows:
        return 0
    assert cols[0] == "id", f"seed helper expects 'id' as first column for {table}"
    existing = {r[0] for r in con.execute(f'SELECT id FROM "{table}"').fetchall()}
    to_insert = []
    for r in rows:
        if r[0] in existing:
            continue
        existing.add(r[0])  # also dedup within the same batch
        to_insert.append(r)
    if not to_insert:
        return 0
    col_list = ", ".join(f'"{c}"' for c in cols)
    placeholders = ", ".join(["?"] * len(cols))
    sql = f'INSERT INTO "{table}" ({col_list}) VALUES ({placeholders})'
    con.executemany(sql, to_insert)
    return len(to_insert)


def main():
    db = os.environ.get("EDUMAP_SQLITE_DB") or DEFAULT_DB
    db = os.path.abspath(db)
    if not os.path.exists(db):
        print(f"ERROR: SQLite DB not found at {db}. Run this from the project root.")
        sys.exit(1)

    # Backup before mutating the shipped artifact.
    backup = db + ".bak"
    shutil.copy2(db, backup)
    print(f"📦 Backed up {db} -> {backup}")

    con = sqlite3.connect(db)
    con.execute("PRAGMA foreign_keys = OFF;")  # match the existing (non-enforced) DB
    before = {t: con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for t in
              ["jobs", "events", "hackathons", "scholarships",
               "international_programs", "internships", "opportunities",
               "stem_labs", "shared_items", "surveys", "donation_campaigns"]}

    # ------------------------------------------------------------------ EVENTS
    # 3 new 2026 competitions (Eureka, P2A, Innovation Challenge) — currently
    # missing from the DB, so they never appear on /events or /events/[id].
    events_cols = [
        "id", "title", "description", "type", "location_point", "address",
        "start_date", "end_date", "capacity", "registered_count", "banner_url",
        "organizer_id", "status", "is_online", "meeting_url", "price",
        "created_at", "updated_at",
    ]
    events_rows = [
        ("e20260001-0001-4000-8000-000000000001",
         "Thi Eureka 2026 - Giải thưởng Sáng tạo Khoa học",
         "Cuộc thi sáng tạo khoa học dành cho sinh viên toàn quốc, đề cập các giải pháp giáo dục, AI và bền vững.",
         "contest", geo_point(106.6802, 10.8231), "TP. Hồ Chí Minh, Việt Nam",
         "2026-03-15T01:00:00+00:00", "2026-03-20T10:00:00+00:00",
         500, 0, None, EDUMAP_ORG_USER, "upcoming", 0, None, 0.0, NOW, NOW),
        ("e20260001-0001-4000-8000-000000000002",
         "P2A - Phát triển Ứng dụng AI 2026",
         "Cuộc lập trình Appathon dành cho sinh viên phát triển ứng dụng trí tuệ nhân tạo giải quyết vấn đề thực tế.",
         "hackathon", geo_point(105.8342, 21.0285), "Hà Nội, Việt Nam",
         "2026-04-10T02:00:00+00:00", "2026-04-12T11:00:00+00:00",
         400, 0, None, EDUMAP_ORG_USER, "upcoming", 0, None, 0.0, NOW, NOW),
        ("e20260001-0001-4000-8000-000000000003",
         "Innovation Challenge 2026 - Giáo dục Tương lai",
         "Cuộc thi đổi mới trong giáo dục, tìm kiếm các ý tưởng thành phố thông minh và học tập số.",
         "competition", geo_point(106.6501, 10.7994), "Đồng Nai, Việt Nam",
         "2026-05-05T01:00:00+00:00", "2026-05-08T08:00:00+00:00",
         300, 0, None, EDUMAP_ORG_USER, "upcoming", 0, None, 0.0, NOW, NOW),
    ]
    n = upsert(con, "events", events_cols, events_rows); print(f"  events:    +{n} (Eureka/P2A/Innovation 2026)")

    # -------------------------------------------------------------------- JOBS
    # 3 newest jobs (2026) missing from the shipped DB — these are the
    # "công việc mới nhất" the user could never see.
    jobs_cols = [
        "id", "title", "description", "company_name", "location", "job_type",
        "salary_range", "required_skills", "experience_level", "application_deadline",
        "views", "status", "posted_by_user_id", "career_path_id", "created_at", "updated_at",
    ]
    jobs_rows = [
        ("j20260001-0001-4000-8000-000000000001",
         "AI Engineer (Machine Learning)",
         "Tìm kiếm ML engineer có kinh nghiệm PyTorch, TensorFlow. Dự án AI trong giáo dục.",
         "VNG Corporation", "Quận 12, TP. Hồ Chí Minh", "full_time", "25 - 40 triệu",
         '["python","pytorch","tensorflow","machine-learning","docker"]', "3-5 năm",
         "2026-06-30 23:59:59", 0, "active", None, None, "2026-01-15 10:00:00", "2026-01-15 10:00:00"),
        ("j20260001-0001-4000-8000-000000000002",
         "Fullstack Developer (React/NestJS)",
         "Phát triển ứng dụng web fullstack cho nền tảng giáo dục. Stack: React, NestJS, PostgreSQL.",
         "FPT Software", "Quận 1, TP. Hồ Chí Minh", "full_time", "20 - 35 triệu",
         '["react","nestjs","postgresql","typescript","docker"]', "2-3 năm",
         "2026-07-15 23:59:59", 0, "active", None, None, "2026-01-20 10:00:00", "2026-01-20 10:00:00"),
        ("j20260001-0001-4000-8000-000000000003",
         "Data Analyst Intern",
         "Thực tập sinh phân tích dữ liệu, hỗ trợ bộ phận marketing và giáo dục.",
         "EduMap Foundation", "Biên Hòa, Đồng Nai", "internship", "Thỏa thuận",
         '["sql","python","pandas","tableau"]', "Mới ra trường / Sinh viên",
         "2026-05-31 23:59:59", 0, "active", None, None, "2026-02-01 10:00:00", "2026-02-01 10:00:00"),
    ]
    n = upsert(con, "jobs", jobs_cols, jobs_rows); print(f"  jobs:      +{n} (3 newest 2026 jobs)")

    # -------------------------------------------------------------- HACKATHONS
    # Previously EMPTY (0 rows) → hackathon list/detail showed nothing.
    h_cols = ["id", "title", "description", "start_date", "end_date", "status", "created_at"]
    h_rows = [
        ("h20260001-0001-4000-8000-000000000001",
         "EduMap Smart Cities Hackathon 2026",
         "Build solutions for smarter education using GIS, AI, and open data.",
         "2026-10-15 00:00:00", "2026-11-15 23:59:59", "upcoming", NOW),
        ("h20260001-0001-4000-8000-000000000002",
         "Eureka 2026 Hackathon",
         "Eureka 2026 - Cuộc thi sáng tạo khoa học và công nghệ cho sinh viên Việt Nam.",
         "2026-03-15 00:00:00", "2026-03-20 23:59:59", "upcoming", NOW),
        ("h20260001-0001-4000-8000-000000000003",
         "P2A AI Appathon 2026",
         "P2A - Phát triển ứng dụng AI 2026, lập trình ứng dụng AI giải quyết vấn đề thực tế.",
         "2026-04-10 00:00:00", "2026-04-12 23:59:59", "upcoming", NOW),
        ("h20260001-0001-4000-8000-000000000004",
         "Innovation Challenge 2026",
         "Innovation Challenge 2026 - Giáo dục tương lai và thành phố thông minh.",
         "2026-05-05 00:00:00", "2026-05-08 23:59:59", "upcoming", NOW),
        ("h20260001-0001-4000-8000-000000000005",
         "EduMap GreenTech Challenge",
         "Hack for sustainable education solutions — green campuses, eco-apps, carbon tracking.",
         "2026-09-01 00:00:00", "2026-10-01 23:59:59", "completed", NOW),
        ("h20260001-0001-4000-8000-000000000006",
         "EduMap AI Tutor Hackathon",
         "Create AI-powered tutoring tools for personalized learning.",
         "2026-11-01 00:00:00", "2026-12-01 23:59:59", "upcoming", NOW),
    ]
    n = upsert(con, "hackathons", h_cols, h_rows); print(f"  hackathons: +{n} (6 competitions incl. Eureka/P2A)")

    # ------------------------------------------------------------ SCHOLARSHIPS
    s_cols = ["id", "title", "description", "provider", "value_amount", "deadline",
              "status", "created_at", "updated_at"]
    s_rows = [
        ("s20260001-0001-4000-8000-000000000004", "Học bổng Eureka 2026",
         "Học bổng dành cho thí sinh xuất sắc tại cuộc thi Eureka 2026, khối ngành công nghệ thông tin và AI.",
         "Eureka Organization", 10000.0, "2026-03-10", "active", NOW, NOW),
        ("s20260001-0001-4000-8000-000000000005", "Học bổng P2A 2026",
         "Học bổng hỗ trợ sinh viên tham gia P2A AI Appathon 2026, phát triển ứng dụng AI.",
         "P2A Vietnam", 8000.0, "2026-04-05", "active", NOW, NOW),
        ("s20260001-0001-4000-8000-000000000006", "Học bổng Innovation 2026",
         "Học bổng dành cho dự án đổi mới giáo dục và thành phố thông minh tại Innovation Challenge 2026.",
         "Innovation Fund", 12000.0, "2026-04-25", "active", NOW, NOW),
    ]
    n = upsert(con, "scholarships", s_cols, s_rows); print(f"  scholarships:+{n} (3 new 2026)")

    # ----------------------------------------------------- INTERNATIONAL PROGRAMS
    ip_cols = ["id", "title", "type", "description", "host_country", "organization",
               "application_deadline", "benefits", "apply_url", "created_at"]
    ip_rows = [
        ("i20260001-0001-4000-8000-000000000001", "Chương trình Trao đổi Sinh viên ASEAN 2026",
         "exchange", "Chương trình trao đổi học kỳ tại các trường đại học hàng đầu Đông Nam Á.",
         "Singapore", "SEAMEO", "2026-09-30 23:59:59+07",
         '["Miễn học phí", "Hỗ trợ ký túc xá", "Trợ cấp sinh hoạt $500/tháng"]',
         "https://seameo.org/exchange", NOW),
        ("i20260001-0001-4000-8000-000000000005", "Workshop Khởi nghiệp Sáng tạo Silicon Valley 2026",
         "workshop", "Chương trình đào tạo khởi nghiệp 2 tuần tại Thung lũng Silicon dành cho startup trẻ Việt Nam.",
         "Hoa Kỳ", "VietTech Group", "2026-06-15 23:59:59+07",
         '["Mentor từ Big Tech", "Kết nối quỹ đầu tư", "Chứng chỉ hoàn thành", "Visa hỗ trợ"]',
         "https://viettech.com/silicon-valley", NOW),
        ("i20260001-0001-4000-8000-000000000007", "Seminar Du học Châu Âu - EduMap 2026",
         "seminar", "Hội thảo trực tuyến với đại diện tuyển sinh từ 20 trường đại học hàng đầu châu Âu.",
         "Trực tuyến", "EduMap", "2026-05-20 23:59:59+07",
         '["Tư vấn 1-1", "Học bổng riêng", "Miễn phí đăng ký", "Quà tặng tài liệu"]',
         "https://edumap.vn/intl/seminar", NOW),
    ]
    n = upsert(con, "international_programs", ip_cols, ip_rows)
    print(f"  intl_programs:+{n} (3 showcase 2026 programs)")

    # -------------------------------------------------------------- INTERNSHIPS
    # Table was empty (0 rows) → /internships showed nothing.
    it_cols = ["id", "company_id", "title", "description", "field", "location_point",
               "salary_range", "duration", "requirements", "benefits", "deadline",
               "application_count", "status", "created_at", "updated_at"]
    it_rows = [
        ("it20260001-0001-4000-8000-000000000001", SONADEZI_BUSINESS,
         "Thực tập sinh Phát triển Web - Nền tảng giáo dục",
         "Phát triển tính năng web cho nền tảng giáo dục của Sonadezi. Làm việc với team giáo lý, áp dụng React + NestJS.",
         "internship", geo_point(106.843, 10.957), "4.000.000 - 6.000.000 VND/tháng",
         "3 tháng (thực tập sinh kỳ), có thể làm việc từ xa",
         '["React", "NestJS", "TypeScript", "PostgreSQL"]',
         '["Hướng dẫn mentor", "Chứng chỉ hoàn thành", "Cơ hội full-time"]',
         "2026-08-31 23:59:59", 0, "open", NOW, NOW),
        ("it20260001-0001-4000-8000-000000000002", SONADEZI_BUSINESS,
         "Thực tập sinh Data Analysis & AI for Education",
         "Hỗ trợ phân tích dữ liệu người học và xây dựng mô hình AI gợi ý khóa học.",
         "internship", geo_point(106.915, 10.895), "5.000.000 - 7.000.000 VND/tháng",
         "4 tháng, full-time", '["Python", "Pandas", "SQL", "Machine Learning"]',
         '["Đào tạo AI/ML", "Mentor cấp cấp 2", "Tặng máy tính khi ký hợp đồng"]',
         "2026-09-15 23:59:59", 0, "open", NOW, NOW),
        ("it20260001-0001-4000-8000-000000000003", EDUMAP_ORG_USER,
         "Thực tập sinh UI/UX & Product Design - EduMap",
         "Thiết kế giao diện và trải nghiệm người dùng cho tính năng mới trên EduMap.",
         "internship", geo_point(106.680, 10.823), "Thỏa thuận",
         "2 tháng, part-time (20h/tuần)", '["Figma", "UI/UX Design", "Prototyping"]',
         '["Làm việc linh hoạt", "Portfolio chất lượng", "Cơ hội join team"]',
         "2026-10-31 23:59:59", 0, "open", NOW, NOW),
        ("it20260001-0001-4000-8000-000000000004", SONADEZI_BUSINESS,
         "Thực tập sinh Kế toán - Tài chính",
         "Hỗ trợ ghi nhận chứng từ, đối chiếu sổ sách và lập báo cáo tài chính tháng dưới sự hướng dẫn của kế toán trưởng.",
         "Kế toán / Tài chính", geo_point(106.843, 10.957), "4.000.000 - 6.000.000 VND/tháng",
         "3 tháng, full-time", '["Excel", "Kế toán", "Báo cáo tài chính"]',
         '["Mentor 1-1", "Chứng chỉ thực tập", "Hỗ trợ ăn trưa"]',
         "2026-12-15 23:59:59", 0, "open", NOW, NOW),
        ("it20260001-0001-4000-8000-000000000005", "32952e85-ddb6-416d-9839-677059f4f4ab",
         "Thực tập sinh Marketing & Truyền thông",
         "Tham gia xây dựng nội dung mạng xã hội, chạy chiến dịch tuyển sinh và phân tích hiệu quả truyền thông.",
         "Marketing", geo_point(106.915, 10.895), "5.000.000 - 7.000.000 VND/tháng",
         "4 tháng, full-time", '["Content Marketing", "Social Media", "Canva", "Google Analytics"]',
         '["Đào tạo thực chiến", "Team trẻ", "Cơ hội full-time"]',
         "2026-12-10 23:59:59", 0, "open", NOW, NOW),
        ("it20260001-0001-4000-8000-000000000006", "32952e85-ddb6-416d-9839-677059f4f4ab",
         "Thực tập sinh Kỹ thuật Điện - Điện tử",
         "Theo dõi hệ thống điện tại khu công nghiệp, hỗ trợ bảo trì thiết bị và ghi nhận dữ liệu vận hành.",
         "Kỹ thuật", geo_point(106.915, 10.895), "6.000.000 - 8.000.000 VND/tháng",
         "3 tháng, full-time", '["Điện công nghiệp", "PLC", "An toàn lao động"]',
         '["Phụ cấp xăng xe", "Bảo hộ lao động", "Chứng chỉ nghề"]',
         "2026-12-20 23:59:59", 0, "open", NOW, NOW),
        ("it20260001-0001-4000-8000-000000000007", "e1614ee3-5234-4359-b207-72d0819d5686",
         "Thực tập sinh Phân tích dữ liệu",
         "Khai thác dữ liệu khách hàng, xây dựng dashboard và hỗ trợ đội ngũ ra quyết định dựa trên số liệu.",
         "Data Analytics", geo_point(106.843, 10.957), "6.000.000 - 9.000.000 VND/tháng",
         "4 tháng, full-time", '["SQL", "Python", "Power BI", "Excel"]',
         '["Mentor ngân hàng", "Lộ trình nghề nghiệp", "Phụ cấp"]',
         "2026-12-05 23:59:59", 0, "open", NOW, NOW),
        ("it20260001-0001-4000-8000-000000000008", SONADEZI_BUSINESS,
         "Thực tập sinh Nhân sự - Tuyển dụng",
         "Hỗ trợ đăng tuyển, sàng lọc CV, sắp xếp phỏng vấn và cập nhật dữ liệu nhân sự.",
         "Nhân sự", geo_point(106.843, 10.957), "4.000.000 - 6.000.000 VND/tháng",
         "3 tháng, full-time", '["Tuyển dụng", "Giao tiếp", "Excel"]',
         '["Kỹ năng phỏng vấn", "Chứng chỉ", "Cơ hội ở lại"]',
         "2026-12-12 23:59:59", 0, "open", NOW, NOW),
    ]
    n = upsert(con, "internships", it_cols, it_rows); print(f"  internships:+{n} (8 internship roles)")

    # -------------------------------------------------------------- OPPORTUNITIES
    # Table was empty (0 rows) → /opportunities showed a permanent empty state.
    # The UI tabs filter on the Vietnamese category labels below.
    op_cols = ["id", "title", "description", "type", "organization", "location_point",
               "address", "deadline", "requirements", "benefits", "url", "field_tags",
               "region", "status", "created_by", "is_team_finding_open", "tags",
               "created_at", "updated_at"]
    op_rows = [
        ("op20260001-0001-4000-8000-000000000001",
         "Cuộc thi Sáng tạo STEM EduMap 2026",
         "Sân chơi dành cho học sinh THPT yêu thích khoa học, kỹ thuật và công nghệ. Thí sinh xây dựng sản phẩm giải quyết một vấn đề thực tế của địa phương, trình bày trước hội đồng chuyên môn và nhận cố vấn từ giảng viên đại học.",
         "Cuộc thi", "Sở GD&ĐT Đồng Nai",
         geo_point(106.8085, 10.9631), "Trường THPT Chuyên Lương Thế Vinh, Biên Hòa, Đồng Nai",
         "2026-12-15 23:59:59+07",
         "Học sinh lớp 10-12; đội 2-4 thành viên; có ý tưởng STEM khả thi.",
         "Tổng giải thưởng 100 triệu đồng, học bổng và cơ hội thực tập tại doanh nghiệp.",
         "https://edumap.vn/opportunities/stem-2026",
         '["STEM","Robotics","Sáng tạo"]', "Đồng Nai", "open", EDUMAP_ORG_USER, 1,
         '["STEM","Cuộc thi","Học sinh"]', NOW, NOW),
        ("op20260001-0001-4000-8000-000000000002",
         "Khóa học Lập trình Web Full-stack miễn phí",
         "Chương trình 8 tuần từ cơ bản đến nâng cao: HTML/CSS, JavaScript, React, Node.js và cơ sở dữ liệu. Học viên hoàn thành đồ án cuối khóa và nhận chứng nhận từ EduMap.",
         "Khóa học", "EduMap Academy",
         None, "Trực tuyến (Zoom + Google Classroom)",
         "2026-11-30 23:59:59+07",
         "Biết tin học cơ bản; có máy tính và kết nối Internet.",
         "Miễn phí 100%, mentor 1-1, chứng nhận hoàn thành, hỗ trợ việc làm.",
         "https://edumap.vn/opportunities/web-fullstack",
         '["CNTT","Lập trình","Web"]', "Toàn quốc", "open", EDUMAP_ORG_USER, 0,
         '["Lập trình","Miễn phí","Online"]', NOW, NOW),
        ("op20260001-0001-4000-8000-000000000003",
         "Chiến dịch Mùa hè xanh 2026 - Dạy học cho em",
         "Tình nguyện viên tham gia dạy văn hóa, tiếng Anh và kỹ năng sống cho học sinh vùng sâu vùng xa trong 3 tuần. Chương trình có xe đưa đón, chỗ ở và bảo hiểm.",
         "Hoạt động", "Tỉnh Đoàn Đồng Nai",
         geo_point(107.3501, 11.2304), "Huyện Định Quán, Đồng Nai",
         "2026-11-20 23:59:59+07",
         "Sinh viên hoặc học sinh lớp 12; ưu tiên có kinh nghiệm hoạt động cộng đồng.",
         "Chứng nhận tình nguyện, cộng điểm rèn luyện, trải nghiệm thực tế.",
         "https://edumap.vn/opportunities/mua-he-xanh-2026",
         '["Tình nguyện","Giáo dục","Cộng đồng"]', "Đồng Nai", "open", EDUMAP_ORG_USER, 1,
         '["Tình nguyện","Mùa hè xanh"]', NOW, NOW),
        ("op20260001-0001-4000-8000-000000000004",
         "Cuộc thi Olympic Tin học Sinh viên 2026",
         "Cuộc thi lập trình thuật toán dành cho sinh viên các trường đại học, cao đẳng khu vực phía Nam. Thi cá nhân và đồng đội, đề thi bằng tiếng Việt và tiếng Anh.",
         "Cuộc thi", "Hội Tin học Việt Nam",
         geo_point(106.8475, 10.9423), "Đại học Đồng Nai, Biên Hòa",
         "2026-12-05 23:59:59+07",
         "Sinh viên đang theo học các ngành CNTT, Toán tin hoặc tương đương.",
         "Giấy chứng nhận, giải thưởng tiền mặt, cơ hội tuyển dụng trực tiếp.",
         "https://edumap.vn/opportunities/olympic-tin-hoc-2026",
         '["Thuật toán","CNTT","Sinh viên"]', "Miền Nam", "open", EDUMAP_ORG_USER, 1,
         '["Olympic","Lập trình"]', NOW, NOW),
        ("op20260001-0001-4000-8000-000000000005",
         "Khóa học AI & Data Science cho học sinh THPT",
         "Làm quen với Python, phân tích dữ liệu và mô hình học máy qua các dự án nhỏ. Cuối khóa, học viên thuyết trình sản phẩm AI ứng dụng trong học tập.",
         "Khóa học", "Đại học Lạc Hồng",
         geo_point(106.8624, 10.9482), "Đại học Lạc Hồng, Biên Hòa, Đồng Nai",
         "2026-12-10 23:59:59+07",
         "Học sinh lớp 10-12, không yêu cầu kinh nghiệm lập trình.",
         "Học phí ưu đãi, thực hành trên phòng lab, chứng nhận hoàn thành.",
         "https://edumap.vn/opportunities/ai-thpt-2026",
         '["AI","Data Science","Python"]', "Đồng Nai", "open", EDUMAP_ORG_USER, 0,
         '["AI","Học sinh","Thực hành"]', NOW, NOW),
        ("op20260001-0001-4000-8000-000000000006",
         "Ngày hội STEM & Robotics Đồng Nai 2026",
         "Triển lãm và trải nghiệm robot, máy in 3D, drone và các sản phẩm sáng tạo của học sinh, sinh viên. Có workshop miễn phí và khu vực tuyển dụng cho các bạn yêu công nghệ.",
         "Hoạt động", "EduMap & Sở Khoa học Công nghệ",
         geo_point(106.8208, 10.9495), "Trung tâm Hội nghị tỉnh Đồng Nai, Biên Hòa",
         "2026-11-25 23:59:59+07",
         "Mở cửa tự do cho học sinh, sinh viên và phụ huynh.",
         "Tham quan miễn phí, workshop robotics, quà tặng và cơ hội kết nối.",
         "https://edumap.vn/opportunities/stem-day-2026",
         '["Robotics","STEM","Sự kiện"]', "Đồng Nai", "open", EDUMAP_ORG_USER, 0,
         '["STEM Day","Robotics"]', NOW, NOW),
        ("op20260001-0001-4000-8000-000000000007",
         "Hackathon Giáo dục số 2026",
         "48 giờ cùng lập trình viên, nhà thiết kế và giáo viên xây dựng giải pháp số cho giáo dục. Ban giám khảo gồm chuyên gia công nghệ và quỹ đầu tư.",
         "Cuộc thi", "VietTech Group",
         geo_point(106.915, 10.895), "Khu công nghệ cao TP.HCM",
         "2026-12-20 23:59:59+07",
         "Đội 3-5 người, có ít nhất một thành viên biết lập trình hoặc thiết kế.",
         "Giải thưởng 200 triệu đồng, mentor, cơ hội gọi vốn.",
         "https://edumap.vn/opportunities/eduhack-2026",
         '["Hackathon","EdTech","Khởi nghiệp"]', "TP.HCM", "open", EDUMAP_ORG_USER, 1,
         '["Hackathon","EdTech"]', NOW, NOW),
        ("op20260001-0001-4000-8000-000000000008",
         "Khóa học Kỹ năng thuyết trình & Lãnh đạo",
         "Rèn luyện kỹ năng nói trước công chúng, làm việc nhóm và dẫn dắt dự án. Lớp học tương tác với bài tập thực hành mỗi buổi.",
         "Khóa học", "Trung tâm Kỹ năng EduMap",
         None, "Trực tuyến",
         "2026-11-28 23:59:59+07",
         "Học sinh, sinh viên muốn tự tin hơn trong giao tiếp và làm việc nhóm.",
         "Tài liệu miễn phí, chứng nhận, feedback 1-1 từ giảng viên.",
         "https://edumap.vn/opportunities/soft-skills-2026",
         '["Kỹ năng mềm","Lãnh đạo","Thuyết trình"]', "Toàn quốc", "open", EDUMAP_ORG_USER, 0,
         '["Kỹ năng mềm","Online"]', NOW, NOW),
        ("op20260001-0001-4000-8000-000000000009",
         "Chương trình Mentor 1-1 cùng chuyên gia",
         "Kết nối học sinh, sinh viên với mentor đang làm việc tại các công ty công nghệ, tài chính và giáo dục. Mỗi cặp mentor-mentee có 4 buổi trao đổi trong 2 tháng.",
         "Hoạt động", "EduMap Mentor Network",
         None, "Trực tuyến hoặc tại văn phòng đối tác",
         "2026-12-01 23:59:59+07",
         "Học sinh lớp 11-12 hoặc sinh viên năm 1-3.",
         "Định hướng nghề nghiệp, review CV, mở rộng mạng lưới.",
         "https://edumap.vn/opportunities/mentor-1-1",
         '["Mentor","Hướng nghiệp","Kết nối"]', "Toàn quốc", "open", EDUMAP_ORG_USER, 0,
         '["Mentor","Hướng nghiệp"]', NOW, NOW),
        ("op20260001-0001-4000-8000-000000000010",
         "Cuộc thi Ý tưởng Khởi nghiệp Học sinh 2026",
         "Học sinh trình bày ý tưởng kinh doanh giải quyết vấn đề xã hội, được huấn luyện về mô hình kinh doanh, tài chính và pitching trước nhà đầu tư.",
         "Cuộc thi", "Quỹ Khởi nghiệp Đồng Nai",
         geo_point(106.843, 10.957), "Trung tâm Đổi mới sáng tạo Đồng Nai",
         "2026-12-18 23:59:59+07",
         "Học sinh THPT, đội 2-5 người, có ý tưởng sản phẩm/dịch vụ.",
         "Vốn hạt giống, mentor khởi nghiệp, chứng nhận tham gia.",
         "https://edumap.vn/opportunities/startup-hs-2026",
         '["Khởi nghiệp","Kinh doanh","Pitching"]', "Đồng Nai", "open", EDUMAP_ORG_USER, 1,
         '["Khởi nghiệp","Học sinh"]', NOW, NOW),
        ("op20260001-0001-4000-8000-000000000011",
         "Khóa học Tiếng Anh giao tiếp miễn phí",
         "Lớp tiếng Anh giao tiếp thực hành theo chủ đề học tập, nghề nghiệp và đời sống. Giáo viên Việt Nam và tình nguyện viên quốc tế luân phiên đứng lớp.",
         "Khóa học", "EduMap Language Club",
         None, "Trực tuyến",
         "2026-12-08 23:59:59+07",
         "Mọi trình độ, ưu tiên học sinh THPT và sinh viên.",
         "Miễn phí, tài liệu số, câu lạc bộ luyện nói hàng tuần.",
         "https://edumap.vn/opportunities/english-club-2026",
         '["Tiếng Anh","Giao tiếp","Ngoại ngữ"]', "Toàn quốc", "open", EDUMAP_ORG_USER, 0,
         '["Tiếng Anh","Miễn phí"]', NOW, NOW),
        ("op20260001-0001-4000-8000-000000000012",
         "Chiến dịch Hiến máu nhân đạo 2026",
         "Ngày hội hiến máu do EduMap phối hợp với bệnh viện địa phương tổ chức. Người tham gia được kiểm tra sức khỏe miễn phí và nhận chứng nhận hiến máu.",
         "Hoạt động", "Hội Chữ thập đỏ Đồng Nai",
         geo_point(106.8085, 10.9631), "Nhà văn hóa thanh niên Biên Hòa",
         "2026-11-22 23:59:59+07",
         "Từ 18 tuổi, đủ điều kiện sức khỏe theo quy định hiến máu.",
         "Chứng nhận hiến máu, quà tặng, kiểm tra sức khỏe miễn phí.",
         "https://edumap.vn/opportunities/hien-mau-2026",
         '["Tình nguyện","Sức khỏe","Cộng đồng"]', "Đồng Nai", "open", EDUMAP_ORG_USER, 0,
         '["Hiến máu","Tình nguyện"]', NOW, NOW),
    ]
    n = upsert(con, "opportunities", op_cols, op_rows)
    print(f"  opportunities:+{n} (12 demo opportunities)")

    # -------------------------------------------------------------- STEM LABS
    # Table was empty (0 rows) → /stem showed a permanent empty state.
    lab_cols = ["id", "name", "school_id", "location_point", "description", "equipment",
                "location_point_text", "capacity", "booking_available", "photos",
                "contact", "created_at", "updated_at"]
    lab_rows = [
        ("lab20260001-0001-4000-8000-000000000001",
         "STEM Lab - THPT Chuyên Lương Thế Vinh",
         None, geo_point(106.8085, 10.9631),
         "Phòng lab trang bị robot giáo dục, máy in 3D và bộ kit Arduino phục vụ câu lạc bộ STEM và các dự án dự thi.",
         '["Robot LEGO Spike","Máy in 3D","Arduino Kit","Kính hiển vi"]',
         "Phòng 201, THPT Chuyên Lương Thế Vinh, Biên Hòa, Đồng Nai",
         30, 1, '[]', "stem@luongthevinh.edu.vn", NOW, NOW),
        ("lab20260001-0001-4000-8000-000000000002",
         "Phòng Lab Robotics - Đại học Lạc Hồng",
         None, geo_point(106.8624, 10.9482),
         "Không gian nghiên cứu robotics dành cho sinh viên và học sinh THPT, có robot công nghiệp mini và cảm biến IoT.",
         '["Robot UR3","Cảm biến IoT","Raspberry Pi","Máy in 3D"]',
         "Tòa nhà Kỹ thuật, Đại học Lạc Hồng, Biên Hòa, Đồng Nai",
         40, 1, '[]', "robotics@lhu.edu.vn", NOW, NOW),
        ("lab20260001-0001-4000-8000-000000000003",
         "STEM Space - THPT Nguyễn Trãi",
         None, geo_point(106.8475, 10.9423),
         "Phòng thực hành STEM dành cho học sinh khối 10-12, tập trung vào vật lý ứng dụng, điện tử và lập trình nhúng.",
         '["Bộ kit Vật lý","Bo mạch Micro:bit","Máy in 3D","Máy đo đa năng"]',
         "Khu thực hành, THPT Nguyễn Trãi, Biên Hòa, Đồng Nai",
         25, 1, '[]', "stem@nguyentrai.edu.vn", NOW, NOW),
        ("lab20260001-0001-4000-8000-000000000004",
         "Lab Công nghệ - THCS Trấn Biên",
         None, geo_point(106.8208, 10.9495),
         "Lab dành cho học sinh THCS làm quen với lập trình Scratch, robot và các thí nghiệm khoa học vui.",
         '["Robot mBot","Scratch Kit","Kính hiển vi","Bộ kit điện tử"]',
         "Phòng 105, THCS Trấn Biên, Biên Hòa, Đồng Nai",
         20, 1, '[]', "lab@tranbien.edu.vn", NOW, NOW),
        ("lab20260001-0001-4000-8000-000000000005",
         "Trung tâm STEM EduMap Biên Hòa",
         None, geo_point(106.843, 10.957),
         "Trung tâm cộng đồng mở cửa cho học sinh, sinh viên sử dụng thiết bị STEM, tham gia workshop cuối tuần và đặt lịch mentor.",
         '["Máy in 3D","Cắt laser","Bộ kit Robotics","Máy tính cấu hình cao"]',
         "Tầng 3, 123 Phạm Văn Thuận, Biên Hòa, Đồng Nai",
         50, 1, '[]', "hello@edumap.vn", NOW, NOW),
        ("lab20260001-0001-4000-8000-000000000006",
         "Lab Sinh học - THPT Long Khánh",
         None, geo_point(107.236, 10.928),
         "Phòng thí nghiệm sinh học với kính hiển vi, mẫu tiêu bản và thiết bị quan sát phục vụ học tập và nghiên cứu nhỏ.",
         '["Kính hiển vi sinh học","Bộ tiêu bản","Tủ cấy vô trùng","Máy ly tâm mini"]',
         "Phòng thí nghiệm Sinh học, THPT Long Khánh, Đồng Nai",
         24, 1, '[]', "sinh@thptlongkhanh.edu.vn", NOW, NOW),
    ]
    n = upsert(con, "stem_labs", lab_cols, lab_rows)
    print(f"  stem_labs:+{n} (6 demo labs)")

    # -------------------------------------------------------------- SHARED ITEMS
    # Table was empty (0 rows) → /marketplace showed a permanent empty state.
    share_cols = ["id", "name", "category", "description", "status", "owner_id",
                  "created_at", "updated_at"]
    share_rows = [
        ("sh20260001-0001-4000-8000-000000000001", "Sách Toán cao cấp tập 1",
         "book", "Sách còn mới 95%, không ghi chú, phù hợp sinh viên năm 1-2.",
         "available", "0d641fd8-46e5-41c6-84ba-a3f187fdc090", NOW, NOW),
        ("sh20260001-0001-4000-8000-000000000002", "Máy tính Casio fx-580VN X",
         "tool", "Máy hoạt động tốt, kèm pin và hướng dẫn sử dụng. Cho mượn theo tuần.",
         "available", "0d641fd8-46e5-41c6-84ba-a3f187fdc090", NOW, NOW),
        ("sh20260001-0001-4000-8000-000000000003", "Sách Lập trình Python cơ bản",
         "book", "Giáo trình Python từ cơ bản đến nâng cao, có bài tập thực hành.",
         "available", "47e62774-09f4-4e7f-bb57-16f6855b13a5", NOW, NOW),
        ("sh20260001-0001-4000-8000-000000000004", "Bộ kit Arduino Uno",
         "electronic", "Bộ kit gồm board Arduino, cảm biến, dây nối và đèn LED cho dự án STEM.",
         "available", "47e62774-09f4-4e7f-bb57-16f6855b13a5", NOW, NOW),
        ("sh20260001-0001-4000-8000-000000000005", "Tai nghe học online",
         "electronic", "Tai nghe có micro, còn bảo hành 3 tháng, phù hợp học trực tuyến.",
         "available", "31e1fd5b-a1c6-44fe-a5c5-b12adad42001", NOW, NOW),
        ("sh20260001-0001-4000-8000-000000000006", "Sách Destination B2",
         "book", "Sách ngữ pháp và từ vựng tiếng Anh B2, kèm đáp án.",
         "available", "9d91b5d3-bcb8-4c28-a10a-87cdbbf3f4d8", NOW, NOW),
        ("sh20260001-0001-4000-8000-000000000007", "Bộ dụng cụ vẽ kỹ thuật",
         "tool", "Compa, thước, eke và bút chì kỹ thuật dành cho môn Vẽ kỹ thuật.",
         "available", "6c44ccfa-5d65-4604-96d5-a3c7a98d9c13", NOW, NOW),
        ("sh20260001-0001-4000-8000-000000000008", "Máy tính bảng học tập",
         "electronic", "Máy tính bảng 10 inch, pin tốt, đã cài sẵn ứng dụng học tập.",
         "available", "6c44ccfa-5d65-4604-96d5-a3c7a98d9c13", NOW, NOW),
    ]
    n = upsert(con, "shared_items", share_cols, share_rows)
    print(f"  shared_items:+{n} (8 marketplace items)")

    # -------------------------------------------------------------- SURVEYS
    survey_cols = ["id", "title", "description", "questions_json", "created_by",
                   "status", "response_count", "start_date", "end_date",
                   "target_roles", "created_at", "updated_at"]
    survey_rows = [
        ("sv20260001-0001-4000-8000-000000000001",
         "Khảo sát nhu cầu học tập kỹ năng số 2026",
         "Giúp EduMap hiểu bạn muốn học gì trong học kỳ tới.",
         json.dumps([
             {"text": "Bạn hiện là học sinh hay sinh viên?", "type": "single_choice",
              "options": ["Học sinh THPT", "Sinh viên", "Khác"]},
             {"text": "Kỹ năng nào bạn muốn học nhất?", "type": "single_choice",
              "options": ["Lập trình", "Ngoại ngữ", "Thiết kế", "Kỹ năng mềm", "AI & Dữ liệu"]},
             {"text": "Bạn muốn các khóa học diễn ra vào thời gian nào?", "type": "single_choice",
              "options": ["Buổi tối trong tuần", "Cuối tuần", "Linh hoạt theo video"]},
             {"text": "Điều gì khiến bạn khó tham gia khóa học?", "type": "text"},
         ], ensure_ascii=False),
         "47e62774-09f4-4e7f-bb57-16f6855b13a5", "active", 0,
         "2026-10-01 00:00:00+07", "2026-12-31 23:59:59+07",
         '["student","teacher"]', NOW, NOW),
        ("sv20260001-0001-4000-8000-000000000002",
         "Đánh giá trải nghiệm sử dụng EduMap",
         "Chia sẻ cảm nhận của bạn để EduMap cải thiện bản đồ, thư viện và cơ hội học tập.",
         json.dumps([
             {"text": "Bạn sử dụng EduMap thường xuyên như thế nào?", "type": "single_choice",
              "options": ["Hàng ngày", "Vài lần mỗi tuần", "Vài lần mỗi tháng", "Lần đầu sử dụng"]},
             {"text": "Tính năng nào bạn dùng nhiều nhất?", "type": "single_choice",
              "options": ["Bản đồ học tập", "Thư viện", "Sự kiện & cơ hội", "AI Chat", "Việc làm & thực tập"]},
             {"text": "Bạn đánh giá giao diện EduMap ở mức nào?", "type": "single_choice",
              "options": ["Rất tốt", "Tốt", "Bình thường", "Cần cải thiện"]},
             {"text": "Bạn muốn EduMap bổ sung điều gì?", "type": "text"},
         ], ensure_ascii=False),
         "47e62774-09f4-4e7f-bb57-16f6855b13a5", "active", 0,
         "2026-10-10 00:00:00+07", "2026-12-20 23:59:59+07",
         '["student","teacher","parent"]', NOW, NOW),
    ]
    n = upsert(con, "surveys", survey_cols, survey_rows)
    print(f"  surveys:+{n} (2 demo surveys)")



    # ----------------------------------------------- DONATION CAMPAIGNS
    # 1) Fix the stale campaign rows so they look "alive" again: give them a
    #    real target + window + current_amount computed from the donations table
    #    (previously current_amount was hardcoded 0 even though donations exist).
    con.execute("""
        UPDATE donation_campaigns
           SET target_amount = COALESCE(target_amount, 50000000),
               start_date     = COALESCE(start_date, '2026-09-01 00:00:00+07'),
               end_date       = COALESCE(end_date, '2026-12-31 23:59:59+07'),
               status         = 'active',
               updated_at     = ?
    """, (NOW,))
    con.execute("""
        UPDATE donation_campaigns
           SET current_amount = COALESCE(
                 (SELECT COALESCE(SUM(d.amount), 0) FROM donations d
                    WHERE d.campaign_id = donation_campaigns.id), 0),
               updated_at = ?
    """, (NOW,))
    print("  campaigns: recomputed current_amount = SUM(donations) for all campaigns")

    # 2) Add 3 specific 2026 public campaigns (incl. AI Innovation / Eureka / P2A)
    #    — previously only 4 generic, content-identical placeholder campaigns existed.
    c_cols = ["id", "title", "description", "target_amount", "current_amount",
              "organizer_id", "location_point", "status", "start_date", "end_date",
              "images", "created_at", "updated_at"]
    c_rows = [
        ("cmp20260001-0001-4000-8000-000000000001",
         "Quyên góp Công nghệ AI cho Trường mạnh lên số — AI Innovation Challenge 2026",
         "Chiến dịch quyên góp thiết bị công nghệ AI (máy tính, linh kiện mạng) để lắp đặt "
         "phòng thí nghiệm AI tại các trường THPT vùng sâu, hỗ trợ học sinh tham gia Innovation Challenge 2026.",
         150000000.0, 0.0, EDUMAP_ORG_USER, geo_point(106.6501, 10.7994),
         "active", "2026-05-01 00:00:00+07", "2026-08-31 23:59:59+07", None, NOW, NOW),
        ("cmp20260001-0001-4000-8000-000000000002",
         "Ủng hộ thí sinh dự thi Eureka 2026",
         "Quyên góp hỗ trợ chi phí tham dự và vận chuyển thiết bị thí nghiệm cho các đội thi "
         "trong Thi Eureka 2026 — Giải thưởng Sáng tạo Khoa học toàn quốc.",
         100000000.0, 0.0, EDUMAP_ORG_USER, geo_point(106.6802, 10.8231),
         "active", "2026-02-20 00:00:00+07", "2026-04-30 23:59:59+07", None, NOW, NOW),
        ("cmp20260001-0001-4000-8000-000000000003",
         "Quyên góp P2A AI Appathon 2026",
         "Quyên góp máy chủ cloud và GPU để tổ chức P2A - Phát triển Ứng dụng AI 2026, "
         "tạo môi trường thực hành trí tuệ nhân tạo cho sinh viên.",
         80000000.0, 0.0, EDUMAP_ORG_USER, geo_point(105.8342, 21.0285),
         "active", "2026-03-01 00:00:00+07", "2026-05-15 23:59:59+07", None, NOW, NOW),
    ]
    n = upsert(con, "donation_campaigns", c_cols, c_rows); print(f"  campaigns: +{n} new 2026 campaigns")

    con.commit()

    # ---- report ----
    after = {t: con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for t in before}
    print("\n📊 Row counts (before -> after):")
    for t in before:
        print(f"  {t:22s} {before[t]:>3} -> {after[t]:>3}")

    # Spot-check: confirm the headline 2026 competitions are present.
    checks = [
        ("events", "title LIKE '%Eureka 2026%'"),
        ("events", "title LIKE '%P2A%'"),
        ("events", "title LIKE '%Innovation Challenge 2026%'"),
        ("jobs", "title LIKE '%AI Engineer (Machine Learning)%'"),
        ("jobs", "title LIKE '%Data Analyst Intern%'"),
        ("hackathons", "title LIKE '%Eureka 2026%'"),
        ("hackathons", "title LIKE '%P2A%'"),
        ("scholarships", "title LIKE '%Eureka 2026%'"),
        ("internships", "title LIKE '%Thực tập%'"),
        ("opportunities", "title LIKE '%Cuộc thi Sáng tạo STEM%'"),
        ("stem_labs", "name LIKE '%STEM Lab%'"),
        ("shared_items", "name LIKE '%Sách Toán cao cấp%'"),
        ("surveys", "title LIKE '%Khảo sát nhu cầu%'"),
    ]
    print("\n🔍 Presence checks:")
    ok = True
    for tbl, cond in checks:
        cnt = con.execute(f"SELECT COUNT(*) FROM {tbl} WHERE {cond}").fetchone()[0]
        flag = "✅" if cnt > 0 else "❌"
        if cnt == 0:
            ok = False
        print(f"  {flag} {tbl}: {cond} -> {cnt}")
    con.close()
    print("\n✅ seed_sqlite_db.py complete." if ok else "\n⚠️  some checks failed — review above.")


if __name__ == "__main__":
    main()
