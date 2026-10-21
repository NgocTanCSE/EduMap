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
               "international_programs", "internships", "donation_campaigns"]}

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
    ]
    n = upsert(con, "internships", it_cols, it_rows); print(f"  internships:+{n} (3 new)")

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
