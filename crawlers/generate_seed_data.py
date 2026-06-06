#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unified Data Processing for EduMap
Combines crawled data and seeds both database and vector DB
"""

import os
import sys
import json
import uuid
from datetime import datetime
from pathlib import Path

# Assuming crawlers are in the same directory
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def compile_all_crawled_data():
    """Compile data from all crawlers and return unified structure"""

    try:
        from wifi_crawler import WiFiCrawler
        from green_spaces_crawler import GreenSpacesCrawler
        from books_crawler import BooksCrawler
        from schools_crawler import SchoolsCrawler
    except ImportError as e:
        print(f"Error importing crawlers: {e}")
        return None

    print("🔄 Compiling all crawled data...\n")

    # WiFi
    print("📍 Processing WiFi data...")
    wifi = WiFiCrawler()
    wifi_data = wifi.crawl_all_wifi()
    print(f"   ✓ {wifi_data['total']} WiFi locations")

    # Green spaces
    print("🌳 Processing green spaces...")
    green = GreenSpacesCrawler()
    green_data = green.crawl_all_green_spaces()
    print(f"   ✓ {green_data['total']} green space locations")

    # Books and libraries
    print("📚 Processing books and libraries...")
    books = BooksCrawler()
    books_data = books.crawl_all_books()
    print(f"   ✓ {books_data['total_books']} books")
    print(f"   ✓ {len(books_data['libraries'])} libraries")

    # Schools
    print("🏫 Processing schools...")
    schools = SchoolsCrawler()
    schools_data = schools.crawl_all_schools()
    print(f"   ✓ {schools_data['total']} educational institutions\n")

    return {
        "wifi": {"crawler": wifi, "data": wifi_data},
        "green": {"crawler": green, "data": green_data},
        "books": {"crawler": books, "data": books_data},
        "schools": {"crawler": schools, "data": schools_data}
    }

def generate_combined_sql(all_data) -> str:
    """Generate single SQL file with all data"""

    sql = f"""-- EduMap Consolidated Crawled Data
-- Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
-- This includes: WiFi, Green Spaces, Books, Libraries, Schools
-- Target: PostgreSQL with PostGIS extension

-- ============================================
-- WiFi Hotspots
-- ============================================
"""

    # WiFi locations
    for loc in all_data['wifi']['data']['locations']:
        name = loc.get('name', '').replace("'", "''")
        lat = loc.get('lat', 0)
        lng = loc.get('lng', 0)
        desc = loc.get('category', 'wifi')

        point_id = str(uuid.uuid4())
        sql += f"INSERT INTO map_points (id, name, description, location) VALUES ('{point_id}', '{name}', '{desc}', ST_SetSRID(ST_MakePoint({lng}, {lat}), 4326)::geography);\n"

    sql += f"\n-- ============================================\n"
    sql += f"-- Green Spaces\n"
    sql += f"-- ============================================\n"

    # Green spaces
    for loc in all_data['green']['data']['locations']:
        name = loc.get('name', '').replace("'", "''")
        lat = loc.get('lat', 0)
        lng = loc.get('lng', 0)
        desc = loc.get('category', 'park')

        point_id = str(uuid.uuid4())
        sql += f"INSERT INTO map_points (id, name, description, location) VALUES ('{point_id}', '{name}', '{desc}', ST_SetSRID(ST_MakePoint({lng}, {lat}), 4326)::geography);\n"

    sql += f"\n-- ============================================\n"
    sql += f"-- Libraries\n"
    sql += f"-- ============================================\n"

    # Libraries
    for lib in all_data['books']['data']['libraries']:
        name = lib.get('name', '').replace("'", "''")
        lat = lib.get('lat', 0)
        lng = lib.get('lng', 0)

        point_id = str(uuid.uuid4())
        sql += f"INSERT INTO map_points (id, name, description, location) VALUES ('{point_id}', '{name}', 'library', ST_SetSRID(ST_MakePoint({lng}, {lat}), 4326)::geography);\n"

    sql += f"\n-- ============================================\n"
    sql += f"-- Schools & Educational Institutions\n"
    sql += f"-- ============================================\n"

    # Schools
    for school in all_data['schools']['data']['locations']:
        name = school.get('name', '').replace("'", "''")
        lat = school.get('lat', 0)
        lng = school.get('lng', 0)
        desc = school.get('category', 'school')

        point_id = str(uuid.uuid4())
        sql += f"INSERT INTO map_points (id, name, description, location) VALUES ('{point_id}', '{name}', '{desc}', ST_SetSRID(ST_MakePoint({lng}, {lat}), 4326)::geography);\n"

    sql += f"\n-- ============================================\n"
    sql += f"-- Learning Materials (Books)\n"
    sql += f"-- ============================================\n"

    # Books
    books_sqls = all_data['books']['crawler'].to_learning_materials_sql(all_data['books']['data']['books'])
    for book_sql in books_sqls:
        if not book_sql.startswith('--'):  # Skip comments
            sql += book_sql + "\n"

    return sql

def main():
    """Main execution"""
    print("="*60)
    print("EduMap Data Processing & Seeding")
    print("="*60 + "\n")

    # Compile all data
    all_data = compile_all_crawled_data()

    if not all_data:
        print("❌ Failed to compile data")
        return False

    # Generate SQL
    print("\n💾 Generating SQL seed file...")
    sql_content = generate_combined_sql(all_data)

    # Save to project root
    output_path = os.path.join(os.path.dirname(__file__), '..', 'seed_crawled_data_new.sql')
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(sql_content)

    file_size = os.path.getsize(output_path) / 1024
    print(f"✓ Saved: {output_path} ({file_size:.1f} KB)")

    # Generate summary
    print("\n📊 Data Summary:")
    print(f"  WiFi: {all_data['wifi']['data']['total']}")
    print(f"  Green Spaces: {all_data['green']['data']['total']}")
    print(f"  Books: {all_data['books']['data']['total_books']}")
    print(f"  Libraries: {len(all_data['books']['data']['libraries'])}")
    print(f"  Schools: {all_data['schools']['data']['total']}")

    total_points = (all_data['wifi']['data']['total'] +
                   all_data['green']['data']['total'] +
                   len(all_data['books']['data']['libraries']) +
                   all_data['schools']['data']['total'])
    print(f"  📌 Total Map Points: {total_points}")
    print(f"  📚 Total Learning Materials: {all_data['books']['data']['total_books']}")

    print("\n✅ Processing complete!")
    print("\nNext steps:")
    print("1. Run: python ../scripts/execute_db_setup.py")
    print("2. Or manually: psql -d edumap -f seed_crawled_data_new.sql")
    print("3. Update AI vector DB: cd ai-service && python seed_vector_db.py")

    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
