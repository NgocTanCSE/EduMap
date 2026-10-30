# -*- coding: utf-8 -*-
"""
Gamification crawler -> `badges` + `green_challenges` tables (STATIC definitions).

Badges & green challenges are NOT web-crawled — they are curated achievement
rules. This crawler upserts a canonical set of badge/challenge definitions so the
gamification feature always has content (idempotent, no web source needed).

badges.name            UNIQUE -> upsert by name
green_challenges.title  (no unique) -> upsert by (title, type)
"""
import os, sys, datetime
sys.path.insert(0, os.path.dirname(__file__))
from db_utils import get_conn, upsert_rows, Jsonb, sync_seq
from crawl_scope import crawl_years, year_scope_range

# Dynamic green challenge dates spanning the 2-year crawl window.
_CRAWL_YEARS = crawl_years()
_YEAR_MIN, _YEAR_MAX = year_scope_range()

# Badges: fill icon_url with inline SVG (no external network)
def _svg_icon(char="🏆"):
    return f"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'><text y='34' font-size='28' text-anchor='middle'>{char}</text></svg>"

BADGES = [
    {"name": "Đại Sứ Bản Đồ", "description": "Khám phá 10 địa điểm trên bản đồ", "icon_url": _svg_icon("🔵"), "category": "map", "points_criteria": 50, "rarity": "bronze"},
    {"name": "Chiến Binh Xanh Biên Hòa", "description": "Hoàn thành 5 thách thức xanh", "icon_url": None, "category": "green", "points_criteria": 100, "rarity": "silver"},
    {"name": "Mentor Uy Tín", "description": "Được cộng đồng đánh giá cao", "icon_url": None, "category": "mentor", "points_criteria": 200, "rarity": "gold"},
    {"name": "Chuyên Gia STEM", "description": "Hoàn thành 3 dự án STEM", "icon_url": None, "category": "stem", "points_criteria": 300, "rarity": "gold"},
    {"name": "Thủ Khoa Học Liệu", "description": "Đạt 9 điểm trên 10 môn", "icon_url": None, "category": "study", "points_criteria": 500, "rarity": "platinum"},
    {"name": "Sinh Viên Mạng Lưới", "description": "Kết nối 20 bạn cùng trường", "icon_url": None, "category": "social", "points_criteria": 150, "rarity": "silver"},
    {"name": "Khám Phá Việt", "description": "Tới 5 tỉnh/thành", "icon_url": None, "category": "map", "points_criteria": 80, "rarity": "bronze"},
    {"name": "Nhà Từ Thiện", "description": "Tham gia 3 chiến dịch quyên góp", "icon_url": None, "category": "donate", "points_criteria": 120, "rarity": "silver"},
]

GREEN_CHALLENGES = [
    {"title": "Chương trình tái chế rác thải", "description": "Thu thập và tái chế 5kg rác plastic", "type": "recycle", "start_date": f"{_YEAR_MIN}-01-01", "end_date": f"{_YEAR_MAX}-12-31", "points_reward": 80, "status": "active"},
    {"title": "Ngày hội đi bộ xanh", "description": "Tham gia buổi đi bộ xanh cộng đồng", "type": "walk", "start_date": f"{_YEAR_MIN}-03-01", "end_date": f"{_YEAR_MAX}-09-30", "points_reward": 60, "status": "active"},
    {"title": "Trồng cây xanh", "description": "Trồng 1 cây xanh tại công viên", "type": "plant", "start_date": f"{_YEAR_MIN}-02-15", "end_date": f"{_YEAR_MAX}-11-30", "points_reward": 100, "status": "active"},
]

def run():
    print("gamification_crawler: start")
    print(f"  [scope] crawl_years={crawl_years()} | green challenge dates span {_YEAR_MIN}-{_YEAR_MAX}")
    conn = get_conn()
    try:
        sync_seq(conn, "badges")
        rb = upsert_rows(conn, "badges", BADGES, ["name"])
        rg = upsert_rows(conn, "green_challenges", [{**c, "participant_count": 0} for c in GREEN_CHALLENGES], ["title", "type"])
        print(f"gamification_crawler badges: {rb}")
        print(f"gamification_crawler green_challenges: {rg}")
    finally:
        conn.close()

if __name__ == "__main__":
    run()
