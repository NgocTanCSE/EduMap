# 🕷️ EduMap Data Crawlers

Collection of web crawlers to gather educational data for the EduMap platform.

## Overview

This module contains crawlers to collect various types of data for the EduMap system:

1. **WiFi Crawler** - Public WiFi hotspots, internet cafes
2. **Green Spaces Crawler** - Parks, gardens, environmental initiatives
3. **Books Crawler** - Books from OpenLibrary, local libraries
4. **Schools Crawler** - Universities, schools, training centers
5. **Aggregator** - Master script to combine all data

## Data Coverage

### Geographic Focus
- **Entire Vietnam** (nationwide real crawl) via the Overpass API (OpenStreetMap).
- The map is split into **5 regions** (North, North-Central, Central, South-Central,
  South) and queried with combined category queries to avoid Overpass timeouts.
- Each nightly run also merges **native** reference data (libraries, schools,
  green spaces) — including detailed Đông Nai / DNTU points which act as
  high-quality supplements to the nationwide OpenStreetMap feed.
- Real-time WiFi hotspots (`internet_access=wlan`) are now fetched **nationwide**
  (previously only Đông Nai).

### Data Sources
- **OpenStreetMap / Overpass API** → real, nationwide POIs (schools, universities,
  libraries, hospitals, parks, green spaces, tourism, transport, food/shops, WiFi).
- **OpenLibrary** → real book records (link + cover), 17 subjects.
- **Native hard-coded reference sets** → high-fidelity local points (DNTU campus,
  Đồng Nai institutions, …) used to enrich/fill gaps in OSM data.

### Data Types

#### WiFi Hotspots (12+ locations)
- Public WiFi areas
- Libraries with WiFi
- Educational institutions
- Cafes with WiFi
- Government buildings
- Residential areas

#### Green Spaces (8+ locations)
- Parks and gardens
- Ecological areas
- Environmental initiatives
- Agro-tourism sites

#### Books (100+ books, 17 subjects)
Every book carries a **real OpenLibrary link** (`file_url` — a web link, never a PDF)
and a **real cover thumbnail** (`thumbnail_url`). Subjects span foundational →
advanced levels:
- Information Technology, Computer Science, Digital Transformation
- Mathematics, Physics, Chemistry
- Literature, History, Geography, Economics
- Foreign Language, Engineering, Philosophy, Psychology
- Environmental Science, Professional Development, Education

#### Libraries (11 libraries)
- Nationwide public + university libraries (National Library of VN, ĐHQG HN/HCM,
  Bách khoa HN/HCM, Kinh tế, …) and Đồng Nai provincial libraries.

#### Educational Institutions (nationwide + Đông Nai detail)
- All Vietnamese universities, secondary schools & training centers via Overpass
  (real OSM data), plus high-fidelity Đông Nai / DNTU reference points.

## Usage

### Run All Crawlers

```bash
cd crawlers
python aggregator.py
```

This will:
1. Run all individual crawlers
2. Generate consolidated SQL seed file
3. Create summary reports
4. Save all results to `crawled_data/` directory

### Run Individual Crawlers

```bash
# WiFi locations
python wifi_crawler.py

# Green spaces
python green_spaces_crawler.py

# Books and libraries
python books_crawler.py

# Schools and educational spaces
python schools_crawler.py
```

## Output Files

### Consolidated Data
- `consolidated_crawled_data_YYYYMMDD_HHMMSS.sql` - Ready-to-import SQL file
- `crawl_summary_YYYYMMDD_HHMMSS.json` - Detailed summary in JSON
- `statistics_YYYYMMDD_HHMMSS.txt` - Human-readable statistics

### Individual SQL Files (from individual crawlers)
- `wifi_locations.sql`
- `green_spaces.sql`
- `books.sql`
- `libraries.sql`
- `schools.sql`

## Importing Data

### 1. Copy SQL to seed directory
```bash
cp crawled_data/consolidated_crawled_data_*.sql ../seed_crawled_data.sql
```

### 2. Run database setup
```bash
python ../scripts/execute_db_setup.py
```

Or manually:
```bash
psql -h localhost -U postgres -d edumap -f seed_crawled_data.sql
```

### 3. Update Vector DB
```bash
cd ../ai-service
python seed_vector_db.py
```

## Data Structure

All data is structured to work with EduMap's database schema:

### map_points table
```sql
INSERT INTO map_points (id, name, description, location)
VALUES (uuid, name, category, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography);
```

Categories:
- `wifi` - WiFi hotspots
- `park` - Parks and green spaces
- `library` - Libraries
- `school` - Schools
- `education` - Educational institutions
- `innovation_space` - Startup hubs, coworking

### learning_materials table
```sql
INSERT INTO learning_materials (id, title, description, subject, thumbnail_url, type, status)
VALUES (uuid, title, description, subject, url, 'book', 'published');
```

Subjects:
- Computer Science
- Information Technology
- Digital Transformation
- Education
- Environmental Science
- Professional Development

## Features

### ✨ Hardcoded Data (No External API Dependencies)
All data is hardcoded to avoid network issues and rate limiting:
- Actual WiFi locations in Dong Nai
- Real parks and green spaces
- Books from OpenLibrary catalog
- Universities and schools in the region

### 📍 Geographic Accuracy
Realistic GPS coordinates for all locations

### 🌐 Multi-language Support
Data in Vietnamese (with English translations where relevant)

### 🔄 Scalability
Easy to add more crawlers by following the pattern:
1. Inherit from a base crawler class
2. Implement data collection methods
3. Provide SQL generation methods
4. Integrate with aggregator

## Automated Scheduling (Docker)

A nightly **cron** job reloads the database with the latest real crawled data
every day at **00:00:00 (Asia/Ho_Chi_Minh)**:

```bash
docker compose up -d crawler
```

The `crawler` service (`crawlers/Dockerfile`) runs `scripts/run_crawl_pipeline.sh`
at 00:00 via cron (see `crawlers/crontab`). The pipeline:

1. `python aggregator.py` → nationwide Overpass + native + books
2. Stages `seed_crawled_data.sql` (consolidated real data)
3. `python scripts/execute_db_setup.py` → **DROP SCHEMA + rebuild** with
   `schema.sql` + `seed.sql` + `seed_crawled_data.sql` + analytics seed +
   Python seed scripts, then deduplicates `map_points` (full refresh = always
   latest).
4. (Optional) refreshes the Chroma vector DB from the freshly loaded books.

Run it **once now** to populate the DB with real nationwide data:

```bash
docker compose run --rm crawler /app/scripts/run_crawl_pipeline.sh
```

> The container also performs a best-effort crawl on start if
> `EDUMAP_CRAWLER_BOOT_RUN=1` is set (default in `docker-compose.yml`).

## Extending the Crawlers

### Add New Data Source

1. Create new crawler file: `new_source_crawler.py`

```python
import uuid
from typing import List, Dict

class NewSourceCrawler:
    def get_data(self) -> List[Dict]:
        """Get data from source"""
        return [
            {"name": "...", "description": "...", "lat": 10.0, "lng": 106.0}
        ]

    def to_map_points_sql(self, locations: List[Dict]) -> List[str]:
        """Convert to SQL"""
        # Implementation
        pass
```

2. Register in `aggregator.py`:

```python
# In run_all_crawlers()
new_crawler = NewSourceCrawler()
new_data = new_crawler.get_data()
```

## Data Quality

### Validation
- All locations have valid GPS coordinates
- All records have names and descriptions
- Books have authors and publication years
- No duplicate entries

### Updates
To update data:
1. Edit the hardcoded data in the respective crawler
2. Re-run aggregator
3. Import new SQL seed file
4. Refresh vector database

## Deployment

### For Hugging Face Spaces

1. Generate all crawled data:
```bash
python aggregator.py
```

2. Copy to project root:
```bash
cp crawled_data/consolidated_crawled_data_*.sql ../seed_crawled_data_latest.sql
```

3. Commit and push:
```bash
git add -A
git commit -m "Update crawled data for EduMap"
git push origin main
```

4. GitHub Actions will automatically:
   - Deploy to Hugging Face Spaces
   - Initialize database with new seed data

## Statistics

### Current Data Count
- **WiFi Locations**: 12+
- **Green Spaces**: 8+
- **Books**: 80+
- **Libraries**: 4+
- **Schools**: 20+
- **Total Map Points**: 40+
- **Total Learning Materials**: 80+

### Coverage Area
- Geographic: **All of Vietnam** (via Overpass OSM), with Đồng Nai / DNTU points as
  native high-quality supplements.
- Thematic: Education, Technology, Sustainability, Innovation, Books, WiFi,
  Tourism/Transport, Food & Services, Healthcare.

## Future Enhancements

- [x] Real web scraping integration (Overpass API → nationwide OSM data)
- [x] Scheduling for periodic data updates (Docker cron, daily 00:00:00)
- [ ] Data validation pipeline
- [ ] Duplicate detection (map_points dedup already runs in execute_db_setup)
- [ ] Data versioning

## License

Part of the EduMap project - Educational Map Platform

## Support

For issues or questions about the crawlers:
1. Check existing data in the crawler files
2. Verify GPS coordinates
3. Ensure UTF-8 encoding for Vietnamese text
4. Test SQL generation independently
