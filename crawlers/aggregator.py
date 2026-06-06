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

# Import crawlers
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wifi_crawler import WiFiCrawler
from green_spaces_crawler import GreenSpacesCrawler
from books_crawler import BooksCrawler
from schools_crawler import SchoolsCrawler

class DataAggregator:
    """Master aggregator để kết hợp tất cả dữ liệu crawled"""

    def __init__(self, output_dir: str = "crawled_data"):
        self.output_dir = output_dir
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        Path(self.output_dir).mkdir(exist_ok=True)

    def run_all_crawlers(self) -> Dict:
        """Chạy tất cả crawlers"""
        print("🔄 Starting Data Aggregation for EduMap...\n")

        print("📍 [1/4] Running WiFi Crawler...")
        wifi_crawler = WiFiCrawler()
        wifi_data = wifi_crawler.crawl_all_wifi()
        print(f"   ✓ Found {wifi_data['total']} WiFi locations")

        print("🌳 [2/4] Running Green Spaces Crawler...")
        green_crawler = GreenSpacesCrawler()
        green_data = green_crawler.crawl_all_green_spaces()
        print(f"   ✓ Found {green_data['total']} green spaces")

        print("📚 [3/4] Running Books Crawler...")
        books_crawler = BooksCrawler()
        books_data = books_crawler.crawl_all_books()
        print(f"   ✓ Found {books_data['total_books']} books and {len(books_data['libraries'])} libraries")

        print("🏫 [4/4] Running Schools Crawler...")
        schools_crawler = SchoolsCrawler()
        schools_data = schools_crawler.crawl_all_schools()
        print(f"   ✓ Found {schools_data['total']} educational institutions\n")

        return {
            "wifi": (wifi_crawler, wifi_data),
            "green": (green_crawler, green_data),
            "books": (books_crawler, books_data),
            "schools": (schools_crawler, schools_data)
        }

    def generate_consolidated_sql(self, crawlers_data: Dict) -> str:
        """Generate consolidated SQL seed file"""
        sql_content = f"""-- EduMap Consolidated Crawled Data Seed
-- Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
-- This file contains all crawled data from:
-- - WiFi hotspots
-- - Green spaces
-- - Books and Libraries
-- - Schools and Educational Institutions

"""

        # WiFi data
        sql_content += f"-- ============================================\n"
        sql_content += f"-- WiFi Hotspots Data\n"
        sql_content += f"-- Total: {crawlers_data['wifi'][1]['total']} locations\n"
        sql_content += f"-- ============================================\n"
        crawler, data = crawlers_data['wifi']
        for location in data['locations']:
            sql = self._location_to_sql(location, 'wifi')
            if sql:
                sql_content += sql + "\n"
        sql_content += "\n"

        # Green spaces data
        sql_content += f"-- ============================================\n"
        sql_content += f"-- Green Spaces Data\n"
        sql_content += f"-- Total: {crawlers_data['green'][1]['total']} locations\n"
        sql_content += f"-- ============================================\n"
        crawler, data = crawlers_data['green']
        for location in data['locations']:
            sql = self._location_to_sql(location, 'green_space')
            if sql:
                sql_content += sql + "\n"
        sql_content += "\n"

        # Libraries
        sql_content += f"-- ============================================\n"
        sql_content += f"-- Libraries Data\n"
        sql_content += f"-- Total: {len(crawlers_data['books'][1]['libraries'])} libraries\n"
        sql_content += f"-- ============================================\n"
        crawler, data = crawlers_data['books']
        for library in data['libraries']:
            sql = self._location_to_sql(library, 'library')
            if sql:
                sql_content += sql + "\n"
        sql_content += "\n"

        # Schools
        sql_content += f"-- ============================================\n"
        sql_content += f"-- Schools & Educational Institutions\n"
        sql_content += f"-- Total: {crawlers_data['schools'][1]['total']} institutions\n"
        sql_content += f"-- ============================================\n"
        crawler, data = crawlers_data['schools']
        for school in data['locations']:
            sql = self._location_to_sql(school, school.get('category', 'school'))
            if sql:
                sql_content += sql + "\n"
        sql_content += "\n"

        # Books
        sql_content += f"-- ============================================\n"
        sql_content += f"-- Learning Materials (Books)\n"
        sql_content += f"-- Total: {crawlers_data['books'][1]['total_books']} books\n"
        sql_content += f"-- ============================================\n"
        crawler, data = crawlers_data['books']
        book_sqls = crawler.to_learning_materials_sql(data['books'])
        for sql in book_sqls:
            sql_content += sql + "\n"
        sql_content += "\n"

        return sql_content

    def _location_to_sql(self, location: Dict, default_category: str = 'poi') -> Optional[str]:
        """Chuyển đổi một location thành SQL INSERT"""
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
        """Generate summary of all crawled data"""
        return {
            "timestamp": datetime.now().isoformat(),
            "summary": {
                "wifi_locations": crawlers_data['wifi'][1]['total'],
                "green_spaces": crawlers_data['green'][1]['total'],
                "books": crawlers_data['books'][1]['total_books'],
                "libraries": len(crawlers_data['books'][1]['libraries']),
                "schools": crawlers_data['schools'][1]['total'],
                "total_map_points": (
                    crawlers_data['wifi'][1]['total'] +
                    crawlers_data['green'][1]['total'] +
                    len(crawlers_data['books'][1]['libraries']) +
                    crawlers_data['schools'][1]['total']
                )
            },
            "details": {
                "wifi_by_type": crawlers_data['wifi'][1]['summary']['by_category'],
                "schools_breakdown": {
                    "universities": crawlers_data['schools'][1]['universities'],
                    "secondary_schools": crawlers_data['schools'][1]['secondary_schools'],
                    "training_centers": crawlers_data['schools'][1]['training_centers'],
                    "dntu_spaces": crawlers_data['schools'][1]['dntu_spaces']
                }
            }
        }

    def _generate_statistics(self, crawlers_data: Dict) -> str:
        """Generate detailed statistics"""
        stats = f"""
╔════════════════════════════════════════════════════════════╗
║         EduMap Data Crawling Statistics Report              ║
║         Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}                ║
╚════════════════════════════════════════════════════════════╝

📊 DATA SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌐 WiFi Hotspots: {crawlers_data['wifi'][1]['total']} locations
   {crawlers_data['wifi'][1]['summary']['by_area']}

🌳 Green Spaces: {crawlers_data['green'][1]['total']} locations
   - Parks: {len([l for l in crawlers_data['green'][1]['locations'] if 'park' in l.get('category', '')])}
   - Initiatives: {len([l for l in crawlers_data['green'][1]['locations'] if 'initiative' in l.get('category', '')])}

📚 Books & Libraries
   - Books: {crawlers_data['books'][1]['total_books']} books
   - Libraries: {len(crawlers_data['books'][1]['libraries'])} libraries
   - Book Categories:
     * Information Technology
     * Computer Science
     * Digital Transformation
     * Education

🏫 Schools & Educational Spaces: {crawlers_data['schools'][1]['total']} institutions
   - Universities: {crawlers_data['schools'][1]['universities']}
   - Secondary Schools: {crawlers_data['schools'][1]['secondary_schools']}
   - Training Centers: {crawlers_data['schools'][1]['training_centers']}
   - DNTU Specific Spaces: {crawlers_data['schools'][1]['dntu_spaces']}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 TOTAL MAP POINTS: {
    crawlers_data['wifi'][1]['total'] +
    crawlers_data['green'][1]['total'] +
    len(crawlers_data['books'][1]['libraries']) +
    crawlers_data['schools'][1]['total']
}

📌 TOTAL LEARNING MATERIALS: {crawlers_data['books'][1]['total_books']}

🎯 FOCUS AREAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Dong Nai Province (Biên Hòa, Thủ Dầu Một)
✓ Trường Đại học Công nghệ Đông Nái (DNTU)
✓ Khu công nghiệp Amata
✓ Digital transformation initiatives
✓ Green/sustainability programs
✓ Educational spaces and resources

📦 READY FOR DEPLOYMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Next steps:
1. Import consolidated_crawled_data_*.sql into PostgreSQL
2. Add vector embeddings to ChromaDB using seed_vector_db.py
3. Deploy to Hugging Face Spaces
4. Validate data in frontend map view
"""
        return stats

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
