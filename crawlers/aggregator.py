#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Master Crawler Aggregator for EduMap
Combines all crawlers and generates consolidated seed data
"""

import os
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional

# Import crawlers
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wifi_crawler import WiFiCrawler
from green_spaces_crawler import GreenSpacesCrawler
from books_crawler import BooksCrawler
from schools_crawler import SchoolsCrawler
from open_data_crawler import OpenDataCrawler
from overpass_crawler import OverpassCrawler

class DataAggregator:
    """Master aggregator để kết hợp tất cả dữ liệu crawled"""

    def __init__(self, output_dir: str = "crawled_data"):
        self.output_dir = output_dir
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        Path(self.output_dir).mkdir(exist_ok=True)

    def run_all_crawlers(self) -> Dict:
        """Run nationwide crawl using Overpass + native crawlers."""
        print("[START] Nationwide Data Aggregation for EduMap...\n")

        # ----------------------------------------------------------
        # 1) Nationwide Overpass crawl (all categories)
        # ----------------------------------------------------------
        print("[1/4] Nationwide Overpass Crawl...")
        overpass = OverpassCrawler()
        nationwide_locations = overpass.crawl_vietnam()

        # ----------------------------------------------------------
        # 2) Native crawlers (Dong Nai specific data)
        # ----------------------------------------------------------
        print("\n[2/4] Native Crawlers (Dong Nai)...")
        wifi_crawler = WiFiCrawler()
        wifi_data = wifi_crawler.crawl_all_wifi()
        print(f"  WiFi: {wifi_data['total']} locations")

        green_crawler = GreenSpacesCrawler()
        green_data = green_crawler.crawl_all_green_spaces()
        print(f"  Green spaces: {green_data['total']} locations")

        books_crawler = BooksCrawler()
        books_data = books_crawler.crawl_all_books()
        print(f"  Books: {books_data['total_books']}, Libraries: {len(books_data['libraries'])}")

        schools_crawler = SchoolsCrawler()
        schools_data = schools_crawler.crawl_all_schools()
        print(f"  Schools: {schools_data['total']} institutions")

        # ----------------------------------------------------------
        # 3) Merge all data
        # ----------------------------------------------------------
        print("\n[3/4] Merging data...")
        all_locations = list(nationwide_locations)
        for loc in all_locations:
            loc["source"] = "osm"
        print(f"  OSM nationwide: {len(all_locations)}")

        for loc in wifi_data["locations"]:
            loc["source"] = "native_wifi"
            all_locations.append(loc)
        print(f"  + Native WiFi: {wifi_data['total']}")

        for loc in green_data["locations"]:
            loc["source"] = "native_green"
            all_locations.append(loc)
        print(f"  + Native Green: {green_data['total']}")

        for lib in books_data["libraries"]:
            lib["source"] = "native_library"
            all_locations.append(lib)
        print(f"  + Native Libraries: {len(books_data['libraries'])}")

        for school in schools_data["locations"]:
            school["source"] = "native_school"
            all_locations.append(school)
        print(f"  + Native Schools: {schools_data['total']}")

        # ----------------------------------------------------------
        # 4) Deduplicate
        # ----------------------------------------------------------
        print(f"\n[4/4] Deduplicating {len(all_locations)} records...")
        all_locations = self._dedup_locations(all_locations)
        print(f"  After dedup: {len(all_locations)} unique records")

        return {
            "wifi": (wifi_crawler, wifi_data),
            "green": (green_crawler, green_data),
            "books": (books_crawler, books_data),
            "schools": (schools_crawler, schools_data),
            "nationwide": nationwide_locations,
            "all_locations": all_locations,
        }

    def generate_consolidated_sql(self, crawlers_data: Dict) -> str:
        """Generate consolidated SQL seed file from all crawled data."""
        all_locations = crawlers_data.get("all_locations", [])
        books_data = crawlers_data.get("books", (None, {}))[1] if crawlers_data.get("books") else {}
        total_books = books_data.get("total_books", 0)

        sql_content = f"""-- EduMap Consolidated Crawled Data Seed (Nationwide)
-- Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
-- Total POI: {len(all_locations)}
-- Sources: OSM Overpass (nationwide), Native crawlers (Dong Nai)
"""

        # All map points
        sql_content += f"-- ============================================\n"
        sql_content += f"-- Map Points (All Sources)\n"
        sql_content += f"-- Total: {len(all_locations)} locations\n"
        sql_content += f"-- ============================================\n"
        for location in all_locations:
            cat = location.get("category", "poi")
            sql = self._location_to_sql(location, cat)
            if sql:
                sql_content += sql + "\n"
        sql_content += "\n"

        # Books
        if total_books > 0:
            sql_content += f"-- ============================================\n"
            sql_content += f"-- Learning Materials (Books)\n"
            sql_content += f"-- Total: {total_books} books\n"
            sql_content += f"-- ============================================\n"
            crawler, data = crawlers_data["books"]
            book_sqls = crawler.to_learning_materials_sql(data["books"])
            for sql in book_sqls:
                sql_content += sql + "\n"
            sql_content += "\n"

        return sql_content

    def _dedup_locations(self, locations: List[Dict]) -> List[Dict]:
        """Remove duplicate locations by name + approximate coordinates."""
        seen = set()
        unique = []
        for loc in locations:
            name = loc.get("name", "").strip()
            lat = round(loc.get("lat", 0), 4)
            lng = round(loc.get("lng", 0), 4)
            key = (name.lower(), lat, lng)
            if key not in seen and name:
                seen.add(key)
                unique.append(loc)
        return unique

    def _location_to_sql(self, location: Dict, default_category: str = 'poi') -> Optional[str]:
        """Chuyen doi mot location thanh SQL INSERT"""
        try:
            import uuid
            point_id = str(uuid.uuid4())
            name = location.get("name", "").replace("'", "''")
            desc = location.get("category", location.get("type", default_category))
            lat = location.get("lat", 0)
            lng = location.get("lng", 0)

            if not name or lat == 0 or lng == 0:
                return None

            sql = f"INSERT INTO map_points (id, name, description, location) VALUES ('{point_id}', '{name}', '{desc}', ST_SetSRID(ST_MakePoint({lng}, {lat}), 4326)::geography);"
            return sql
        except Exception as e:
            print(f"Error converting location: {e}")
            return None

    def save_results(self, crawlers_data: Dict):
        """Save all results to files"""

        # Consolidated SQL
        sql_content = self.generate_consolidated_sql(crawlers_data)
        sql_file = os.path.join(self.output_dir, f"consolidated_crawled_data_{self.timestamp}.sql")
        with open(sql_file, "w", encoding="utf-8") as f:
            f.write(sql_content)
        print(f"✓ Saved consolidated SQL: {sql_file}")

        # Individual JSON reports
        summary = self._generate_summary(crawlers_data)
        json_file = os.path.join(self.output_dir, f"crawl_summary_{self.timestamp}.json")
        import json
        with open(json_file, "w", encoding="utf-8") as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        print(f"✓ Saved summary: {json_file}")

        # Statistics
        stats_file = os.path.join(self.output_dir, f"statistics_{self.timestamp}.txt")
        with open(stats_file, "w", encoding="utf-8") as f:
            f.write(self._generate_statistics(crawlers_data))
        print(f"✓ Saved statistics: {stats_file}")

    def _generate_summary(self, crawlers_data: Dict) -> Dict:
        """Generate summary of all crawled data."""
        all_locations = crawlers_data.get("all_locations", [])

        # Count by category
        from collections import Counter
        cat_counts = Counter(loc.get("category", "unknown") for loc in all_locations)

        # Count by source
        source_counts = Counter(loc.get("source", "unknown") for loc in all_locations)

        return {
            "timestamp": datetime.now().isoformat(),
            "total_map_points": len(all_locations),
            "by_category": dict(cat_counts.most_common(30)),
            "by_source": dict(source_counts),
            "books": crawlers_data.get("books", (None, {}))[1].get("total_books", 0) if crawlers_data.get("books") else 0,
        }

    def _generate_statistics(self, crawlers_data: Dict) -> str:
        """Generate detailed statistics."""
        all_locations = crawlers_data.get("all_locations", [])
        books_data = crawlers_data.get("books", (None, {}))[1] if crawlers_data.get("books") else {}

        from collections import Counter
        cat_counts = Counter(loc.get("category", "unknown") for loc in all_locations)
        source_counts = Counter(loc.get("source", "unknown") for loc in all_locations)

        lines = []
        lines.append("=" * 60)
        lines.append("  EduMap NATIONWIDE Data Crawling Report")
        lines.append(f"  Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 60)
        lines.append("")
        lines.append(f"TOTAL MAP POINTS: {len(all_locations)}")
        lines.append("")
        lines.append("BY CATEGORY (top 20):")
        for cat, cnt in cat_counts.most_common(20):
            lines.append(f"  {cat}: {cnt}")
        lines.append("")
        lines.append("BY SOURCE:")
        for src, cnt in source_counts.most_common():
            lines.append(f"  {src}: {cnt}")
        lines.append("")
        lines.append(f"BOOKS: {books_data.get('total_books', 0)}")
        lines.append("")
        lines.append("=" * 60)

        return "\n".join(lines)

def main():
    """Main function"""
    aggregator = DataAggregator(output_dir="crawled_data")

    try:
        # Run all crawlers
        crawlers_data = aggregator.run_all_crawlers()

        # Save results
        aggregator.save_results(crawlers_data)

        print("\n" + "="*60)
        print("✅ Data crawling completed successfully!")
        print("="*60)
        print(f"\n📂 Output directory: {aggregator.output_dir}/")
        print("\nFiles generated:")
        for file in sorted(os.listdir(aggregator.output_dir)):
            size = os.path.getsize(os.path.join(aggregator.output_dir, file)) / 1024  # KB
            print(f"  • {file} ({size:.1f} KB)")

    except Exception as e:
        print(f"\n❌ Error during data crawling: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
