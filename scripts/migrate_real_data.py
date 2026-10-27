#!/usr/bin/env python3
"""
EduMap — replace fabricated demo rows in the shipped SQLite DB with verified
Vietnamese data.

WHAT IT DOES
------------
1. Backs up the DB (`edumap.db.bak-realdata`).
2. Empties the content tables that were filled with demo/fabricated rows.
3. Inserts the curated, source-backed rows from `scripts/real_vn_data.py`.
4. Leaves user-generated features (posts, marketplace, mentors) genuinely
   empty instead of seeding fake people/listings — the UI already renders an
   honest empty state for them.

RUN
---
    python3 scripts/migrate_real_data.py
    python3 scripts/migrate_real_data.py --db frontend/public/edumap.db

Idempotent: safe to run repeatedly.
"""

from __future__ import annotations

import argparse
import os
import shutil
import sqlite3
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import real_vn_data as D  # noqa: E402

DEFAULT_DB = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "frontend", "public", "edumap.db",
)

NOW = datetime.now(timezone.utc).isoformat(timespec="seconds")

# Content tables we fully control — wipe demo rows, insert curated rows.
CONTENT_TABLES = [
    "scholarships",
    "international_programs",
    "opportunities",
    "internships",
    "events",
    "hackathons",
    "career_paths",
    "stem_labs",
    "green_challenges",
    "summer_campaigns",
    "donation_campaigns",
    "learning_materials",
    "groups",
    "learning_spots",
    "flood_zones",
]

# Tables that only ever contained demo/test rows on the shipped DB.
# They are user-generated features: better empty than fake.
DEMO_ONLY_TABLES = [
    "posts",
    "shared_items",
    "surveys",
    "green_activities",
    "summer_activities",
    "mentors",
]

BANNERS = {
    "stem": "/illustrations/stem.svg",
    "contest": "/illustrations/opportunities.svg",
    "competition": "/illustrations/opportunities.svg",
    "hackathon": "/illustrations/opportunities.svg",
    "conference": "/illustrations/events.svg",
    "festival": "/illustrations/stem.svg",
    "volunteer": "/illustrations/community.svg",
}


def banner_for(event_type: str) -> str:
    return BANNERS.get((event_type or "").lower(), "/illustrations/events.svg")


def clear(con: sqlite3.Connection, table: str) -> int:
    try:
        cur = con.execute(f'DELETE FROM "{table}"')
        return cur.rowcount
    except sqlite3.OperationalError as exc:  # table missing on very old DBs
        print(f"  ! {table}: {exc}")
        return 0


def insert(con: sqlite3.Connection, table: str, cols: list[str], rows: list[tuple]) -> int:
    cols_sql = ", ".join(f'"{c}"' for c in cols)
    marks = ", ".join(["?"] * len(cols))
    con.executemany(
        f'INSERT INTO "{table}" ({cols_sql}) VALUES ({marks})',
        rows,
    )
    return len(rows)


def ensure_column(con: sqlite3.Connection, table: str, column: str, sql_type: str,
                  default_sql: str = None) -> bool:
    """Idempotently add a column to a SQLite table if it doesn't exist.

    Mirrors the self-healing logic in backend/src/database/sqlite-bootstrap.ts
    so the migrate script can run against a raw shipped DB that hasn't been
    bootstrapped yet.
    """
    try:
        cols = [r[1] for r in con.execute(f'PRAGMA table_info("{table}")').fetchall()]
    except sqlite3.OperationalError:
        return False  # table doesn't exist
    if column in cols:
        return False
    ddl = f'ALTER TABLE "{table}" ADD COLUMN "{column}" {sql_type}'
    if default_sql:
        ddl += f' {default_sql}'
    con.execute(ddl)
    return True


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=os.environ.get("EDUMAP_SQLITE_DB") or DEFAULT_DB)
    ap.add_argument("--no-backup", action="store_true")
    args = ap.parse_args()

    db = os.path.abspath(args.db)
    if not os.path.exists(db):
        print(f"ERROR: SQLite DB not found: {db}", file=sys.stderr)
        return 1

    if not args.no_backup:
        backup = db + ".bak-realdata"
        shutil.copy2(db, backup)
        print(f"📦 Backup: {backup}")

    con = sqlite3.connect(db)
    con.execute("PRAGMA foreign_keys = OFF;")

    print("\n🧹 Removing fabricated / demo rows")
    for t in CONTENT_TABLES + DEMO_ONLY_TABLES:
        n = clear(con, t)
        print(f"  - {t:24s} cleared {n}")

    # Jobs come from the live crawler, not from seeders. Drop the rows the old
    # broken crawler produced (location text stored as company name, EduMap
    # fictional employer, ASCII-folded garbage) so only real postings remain.
    bad_jobs = con.execute(
        """
        DELETE FROM jobs
        WHERE company_name LIKE '%EduMap%'
           OR title LIKE '%EduMap%'
           OR company_name IN (
                'Toa nha FPT, Quan 10',
                'Truong Dai hoc Bach Khoa TP.HCM',
                'Cong ty CTV CMC',
                'Unknown'
           )
        """
    ).rowcount
    print(f"  - {'jobs (fake rows)':24s} cleared {bad_jobs}")

    print("\n🌱 Inserting verified Vietnamese data")

    # ---------------------------------------------------------------- scholarships
    rows = []
    for (key, title, desc, provider, location, value, deadline, eligibility, url) in D.SCHOLARSHIPS:
        rows.append((
            D.uid(key), title, D.with_source(desc, url), provider, location,
            value, deadline, eligibility, url, "active", NOW, NOW,
        ))
    n = insert(con, "scholarships", [
        "id", "title", "description", "provider", "location", "value_amount",
        "deadline", "eligibility_criteria", "apply_url", "status",
        "created_at", "updated_at",
    ], rows)
    print(f"  + scholarships           {n}")

    # ------------------------------------------------------ international_programs
    rows = []
    for (key, title, typ, desc, country, org, deadline, benefits, url) in D.INTERNATIONAL_PROGRAMS:
        rows.append((
            D.uid(key), title, typ, D.with_source(desc, url), country, org,
            deadline, benefits, url, NOW,
        ))
    n = insert(con, "international_programs", [
        "id", "title", "type", "description", "host_country", "organization",
        "application_deadline", "benefits", "apply_url", "created_at",
    ], rows)
    print(f"  + international_programs {n}")

    # ---------------------------------------------------------------- opportunities
    rows = []
    for (key, title, typ, desc, org, address, deadline, req, benefits, url, tags, region) in D.OPPORTUNITIES:
        rows.append((
            D.uid(key), title, D.with_source(desc, url), typ, org, None,
            address, deadline, req, benefits, url, tags, region,
            "active", None, 0, tags, NOW, NOW, None,
        ))
    n = insert(con, "opportunities", [
        "id", "title", "description", "type", "organization", "location_point",
        "address", "deadline", "requirements", "benefits", "url", "field_tags",
        "region", "status", "created_by", "is_team_finding_open", "tags",
        "created_at", "updated_at", "deleted_at",
    ], rows)
    print(f"  + opportunities          {n}")

    # ---------------------------------------------------------------- internships
    rows = []
    for (key, title, company, field, address, salary, duration, req, benefits, url) in D.INTERNSHIPS:
        desc = D.with_source(
            f"Chương trình thực tập tại {company}. Xem vị trí đang mở và nộp hồ sơ trên trang tuyển dụng chính thức.",
            url,
        )
        rows.append((
            D.uid(key), None, title, desc, field, None, salary, duration,
            req, benefits, None, 0, "open", NOW, NOW,
        ))
    n = insert(con, "internships", [
        "id", "company_id", "title", "description", "field", "location_point",
        "salary_range", "duration", "requirements", "benefits", "deadline",
        "application_count", "status", "created_at", "updated_at",
    ], rows)
    print(f"  + internships            {n}")

    # ---------------------------------------------------------------- events
    rows = []
    for (key, title, desc, typ, address, start, end, url, tags, is_online) in D.EVENTS:
        rows.append((
            D.uid(key), title, D.with_source(desc, url), typ, None, address,
            start, end, 0, 0, banner_for(typ), None, "upcoming", tags,
            is_online, None, 0.0, NOW, NOW, None,
        ))
    n = insert(con, "events", [
        "id", "title", "description", "type", "location_point", "address",
        "start_date", "end_date", "capacity", "registered_count", "banner_url",
        "organizer_id", "status", "tags", "is_online", "meeting_url", "price",
        "created_at", "updated_at", "deleted_at",
    ], rows)
    print(f"  + events                 {n}")

    # ---------------------------------------------------------------- hackathons
    rows = []
    for (key, title, desc, start, end, status, url) in D.HACKATHONS:
        rows.append((D.uid(key), title, D.with_source(desc, url), start, end, status, NOW))
    n = insert(con, "hackathons", [
        "id", "title", "description", "start_date", "end_date", "status", "created_at",
    ], rows)
    print(f"  + hackathons             {n}")

    # ---------------------------------------------------------------- career_paths
    # id is INTEGER AUTOINCREMENT — let SQLite assign it.
    rows = []
    for (key, title, field, desc, skills, roadmap, salary, demand, resources) in D.CAREER_PATHS:
        rows.append((
            title, field, desc, skills, roadmap, salary, demand, resources,
            NOW, NOW,
        ))
    n = insert(con, "career_paths", [
        "title", "field", "description", "skills_required", "roadmap_json",
        "salary_range", "demand_level", "resources", "created_at", "updated_at",
    ], rows)
    print(f"  + career_paths           {n}")

    # ---------------------------------------------------------------- stem_labs
    coords = {
        "lab-ltv": (106.8245, 10.9574),
        "lab-lhu-robotics": (106.7965, 10.9765),
        "lab-nguyen-trai": (106.8245, 10.9574),
        "lab-tran-bien": (106.8245, 10.9574),
        "lab-long-khanh": (107.2450, 10.9280),
        "lab-dnu": (106.8245, 10.9574),
    }
    rows = []
    for (key, name, address, desc, equipment, contact) in D.STEM_LABS:
        lon, lat = coords[key]
        rows.append((
            D.uid(key), name, None, D.geo(lon, lat), desc, equipment,
            address, 0, 0, None, D.with_source(f"Liên hệ: {contact}", contact),
            NOW, NOW,
        ))
    n = insert(con, "stem_labs", [
        "id", "name", "school_id", "location_point", "description", "equipment",
        "location_point_text", "capacity", "booking_available", "photos",
        "contact", "created_at", "updated_at",
    ], rows)
    print(f"  + stem_labs              {n}")

    # ---------------------------------------------------------------- green_challenges
    rows = []
    for (key, title, desc, typ, start, end, points, url, address, lat, lng) in D.GREEN_CHALLENGES:
        rows.append((
            D.uid(key), title, D.with_source(desc, url), typ, start, end,
            points, 0, None, "active", NOW, lat, lng, address,
        ))
    n = insert(con, "green_challenges", [
        "id", "title", "description", "type", "start_date", "end_date",
        "points_reward", "participant_count", "created_by", "status",
        "created_at", "lat", "lng", "address",
    ], rows)
    print(f"  + green_challenges       {n}")

    # ---------------------------------------------------------------- summer_campaigns
    rows = []
    for (key, name, year, location, status, desc, lat, lng) in D.SUMMER_CAMPAIGNS:
        rows.append((
            D.uid(key), name, year, location, "active",
            D.with_source(desc, "https://doanthanhnien.vn/"),
            NOW, NOW, lat, lng,
        ))
    n = insert(con, "summer_campaigns", [
        "id", "name", "year", "location", "status", "description",
        "created_at", "updated_at", "lat", "lng",
    ], rows)
    print(f"  + summer_campaigns       {n}")

    # ---------------------------------------------------------------- flood_zones
    # Seed real Vietnamese flood-hazard zones (Idea #11: AI Climate Learning
    # Guardian). The flood_zones table is empty on the shipped SQLite DB (the
    # TypeORM migration only seeds it on PostgreSQL); populate it here so the
    # ai-service can load real hazard polygons from the DB.
    if con.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='flood_zones'"
    ).fetchone():
        rows = []
        for (key, name, desc, polygon_geojson, risk_level, metadata_json, source_url) in D.FLOOD_ZONES:
            rows.append((
                D.uid(key), name, D.with_source(desc, source_url),
                polygon_geojson, risk_level, metadata_json, NOW, NOW,
            ))
        n = insert(con, "flood_zones", [
            "id", "name", "description", "coordinates",
            "riskLevel", "metadata", "createdAt", "updatedAt",
        ], rows)
        print(f"  + flood_zones            {n}")
    else:
        print(f"  ! flood_zones            table not found (skipped)")

    # ---------------------------------------------------------------- donation_campaigns
    rows = []
    for (key, title, desc, target, org, address, start, end, url) in D.DONATION_CAMPAIGNS:
        rows.append((
            D.uid(key), title, D.with_source(desc, url), target, 0.0, None,
            None, "active", start, end, None, NOW, NOW,
        ))
    n = insert(con, "donation_campaigns", [
        "id", "title", "description", "target_amount", "current_amount",
        "organizer_id", "location_point", "status", "start_date", "end_date",
        "images", "created_at", "updated_at",
    ], rows)
    print(f"  + donation_campaigns     {n}")

    # ---------------------------------------------------------------- learning_materials
    rows = []
    for (key, title, desc, typ, subject, grade, tags, url) in D.LEARNING_MATERIALS:
        rows.append((
            D.uid(key), title, D.with_source(desc, url), typ, subject, grade,
            tags, url, None, None, 0, 0, 0.0, "published", None, 0, None,
            NOW, NOW, None,
        ))
    n = insert(con, "learning_materials", [
        "id", "title", "description", "type", "subject", "grade", "tags",
        "file_url", "file_size", "thumbnail_url", "download_count", "view_count",
        "rating_avg", "status", "author_id", "is_offline_available", "search_vector",
        "created_at", "updated_at", "deleted_at",
    ], rows)
    print(f"  + learning_materials     {n}")

    # ---------------------------------------------------------------- groups
    rows = []
    for (key, name, desc, typ, url) in D.GROUPS:
        rows.append((
            D.uid(key), name, D.with_source(desc, url), None, None, typ,
            0, "public", None, NOW, NOW, None,
        ))
    n = insert(con, "groups", [
        "id", "name", "description", "avatar_url", "cover_url", "type",
        "member_count", "privacy", "owner_id", "created_at", "updated_at", "deleted_at",
    ], rows)
    print(f"  + groups                 {n}")

    # ---------------------------------------------------------------- learning_spots
    # Real Vietnamese study spaces (libraries + study cafés) with opening hours,
    # quietness, amenities, and provenance. Coordinates stored as GeoJSON Point
    # (lng, lat) per the locations/location_point convention used elsewhere.
    #
    # The shipped SQLite DB ships with the original 8-column learning_spots;
    # the recommender needs the extended columns. Ensure they exist here (the
    # runtime bootstrap at backend/src/database/sqlite-bootstrap.ts does the
    # same on HF boot, but this runs first when re-seeding the bundled DB).
    for col, sql_type, default_sql in [
        ("address", "TEXT", None),
        ("description", "TEXT", None),
        ("quietness", "INTEGER", None),
        ("opening_hours", "TEXT", None),
        ("amenities", "TEXT", "DEFAULT '[]'"),
        ("last_updated", "DATETIME", None),
    ]:
        if ensure_column(con, "learning_spots", col, sql_type, default_sql):
            print(f"  + learning_spots.{col} added")
    con.execute("UPDATE learning_spots SET amenities = '[]' WHERE amenities IS NULL")

    rows = []
    for (key, name, typ, lat, lng, address, desc, has_wifi, has_power, quietness,
         opening_hours, amenities, rating_avg, total_capacity, url) in D.LEARNING_SPOTS:
        rows.append((
            D.uid(key), name, D.geo(lng, lat), typ, address,
            D.with_source(desc, url), has_wifi, has_power, quietness,
            opening_hours, amenities, rating_avg, total_capacity, NOW, NOW,
        ))
    n = insert(con, "learning_spots", [
        "id", "name", "location", "type", "address", "description",
        "has_wifi", "has_power_outlets", "quietness", "opening_hours",
        "amenities", "rating_avg", "total_capacity", "created_at", "last_updated",
    ], rows)
    print(f"  + learning_spots         {n}")

    con.commit()

    print("\n📊 Final counts")
    for t in CONTENT_TABLES + DEMO_ONLY_TABLES:
        c = con.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]
        print(f"  {t:24s} {c}")
    con.close()
    print("\n✅ Real Vietnamese data migration complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
