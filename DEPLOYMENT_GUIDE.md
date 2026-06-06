# 🚀 EduMap Deployment Guide - Crawled Data Integration

## Overview

This guide walks through integrating the crawled data into EduMap and deploying to Hugging Face Spaces.

## 📊 Data Generated

```
✓ 13 WiFi hotspots
✓ 11 Green spaces
✓ 4 Libraries
✓ 15 Schools & Educational Institutions
✓ 80 Books across 4 categories
═══════════════════════════════════════════════════════════
  Total: 43 Map Points + 80 Learning Materials
```

## 🔧 Quick Setup (5 steps)

### Step 1: Generate Crawled Data

If you need to regenerate the data:

```bash
cd crawlers/
python generate_seed_data.py
# Output: ../seed_crawled_data_new.sql
```

Or run the full aggregator with detailed reports:

```bash
python aggregator.py
# Outputs to: crawled_data/ directory
```

### Step 2: Backup Current Data (Optional)

```bash
# Backup existing seed data
cp seed_crawled_data.sql seed_crawled_data.backup.sql
```

### Step 3: Use New Seed Data

The system automatically uses `seed_crawled_data.sql`. You have two options:

**Option A:** Replace with new data
```bash
cp crawlers/../seed_crawled_data_new.sql seed_crawled_data.sql
```

**Option B:** Merge with existing data
- Edit `seed_crawled_data.sql` to include both old and new data
- Ensure no duplicate UUIDs

### Step 4: Database Setup

Run the database setup script:

```bash
python scripts/execute_db_setup.py
```

Or manually with PostgreSQL:

```bash
# Start PostgreSQL
psql -U postgres -d edumap -f seed_crawled_data.sql

# Verify data
psql -U postgres -d edumap -c "SELECT COUNT(*) FROM map_points;"
psql -U postgres -d edumap -c "SELECT COUNT(*) FROM learning_materials;"
```

### Step 5: Update AI Vector Database

```bash
cd ai-service/
python seed_vector_db.py
```

## 📍 Data Details

### WiFi Hotspots (13 locations)

Located throughout Biên Hòa and Đông Nái:

- **DNTU Campus** - 500Mbps WiFi, 24/7 access
- **Public Parks** - Biên Hùng, Dương Tử Giang
- **Libraries** - Provincial, District, DNTU
- **Shopping Centers** - Hoàng Phúc Mall
- **Amata Industrial Park** - Tech hub with WiFi
- And more...

### Green Spaces (11 locations)

Environmental and sustainability areas:

- **Parks** - 15+ hectares of green space
- **Ecological Areas** - Bio-diversity hotspots
- **Initiatives** - DNTU Sống Xanh project
- **Agro-tourism** - Grape farms, nature experiences
- **Riverside Walks** - Saigon River ecosystem

### Libraries (4 locations)

**DNTU Library** - 2000+ IT books, E-journals, 24/7 access
**Provincial Library** - General collection, databases
**District Libraries** - Community resources
**Training Centers** - Vocational materials

### Schools (15 locations)

**Universities:**
- Trường Đại học Công nghệ Đông Nái (DNTU) - Main focus
- Trường Đại học Nông Lâm TPHCM - Agriculture campus

**Secondary Schools:** 5 institutions
**Training Centers:** 4 centers
**DNTU Spaces:** 4 specialized facilities
- Lab STEM
- Central Library
- Sống Xanh Initiative
- Incubator & Business Center

### Books (80 total)

**Categories:**
- **Information Technology** (20 books) - Web dev, AI, DevOps
- **Computer Science** (20 books) - Algorithms, Databases, Architecture
- **Digital Transformation** (20 books) - Innovation, AI, Entrepreneurship
- **Education** (20 books) - Teaching, Learning, Professional Development

## 🐳 Docker Deployment

### Local Testing

```bash
# Build and run with Docker Compose
docker-compose up --build

# Verify services
docker-compose ps
```

### Health Checks

```bash
# Test Backend API
curl http://localhost:3000/api/health

# Test Frontend
curl http://localhost:3000/

# Test AI Service
curl http://localhost:8000/docs
```

## 🤗 Hugging Face Deployment

### Prerequisites

1. **GitHub Repository Setup**
   - Fork or clone EduMap repo
   - Add HF_TOKEN to GitHub Secrets

2. **Hugging Face Space Created**
   - Name: `EduMap` (or your choice)
   - Type: Docker
   - Private/Public: Choose based on needs

3. **Configure Deploy Workflow**
   - File: `.github/workflows/deploy-hf.yml`
   - Update Space URL with your HF username
   - Verify HF_TOKEN is available in secrets

### Deploy Steps

1. **Commit crawled data**
   ```bash
   git add seed_crawled_data.sql
   git add crawlers/
   git commit -m "Add crawled data - WiFi, Green Spaces, Books, Schools"
   git push origin main
   ```

2. **Automatic deployment**
   - GitHub Actions triggers automatically
   - Dockerfile.hf renamed to Dockerfile
   - Code pushed to HF Space
   - Database initialized with seed data

3. **Monitor deployment**
   - Check GitHub Actions tab for workflow status
   - View HF Space logs for build/startup issues
   - Access via `https://huggingface.co/spaces/YOUR_USERNAME/EduMap`

## 🔍 Verification

### Check Map Points

```sql
-- Total map points
SELECT COUNT(*) FROM map_points;

-- By category
SELECT description, COUNT(*) FROM map_points GROUP BY description;

-- WiFi locations
SELECT name, ST_AsText(location) FROM map_points
WHERE description LIKE '%wifi%';

-- Schools
SELECT name FROM map_points WHERE description = 'school';
```

### Check Learning Materials

```sql
-- Total books
SELECT COUNT(*) FROM learning_materials;

-- By subject
SELECT subject, COUNT(*) FROM learning_materials GROUP BY subject;

-- Information Technology books
SELECT title, author FROM learning_materials
WHERE subject = 'Information Technology' LIMIT 10;
```

### Frontend Verification

Once deployed:
1. Open map view - should show 40+ markers
2. Search for "WiFi" - should find 13 locations
3. Filter by "School" - should find 15 institutions
4. View learning materials - should list 80 books
5. Search by subject in AI - should find materials

## 📚 Data Format

### Map Points (geographic locations)

```sql
INSERT INTO map_points (id, name, description, location)
VALUES (
  'uuid',
  'Location Name',
  'category',
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
);
```

**Categories:**
- `wifi`, `wifi_park`, `wifi_cafe`, etc.
- `park`, `ecological_park`, `botanical_garden`, etc.
- `school`, `university`, `education`
- `library`
- `innovation_space`, `startup_center`

### Learning Materials (books)

```sql
INSERT INTO learning_materials (
  id, title, description, subject,
  thumbnail_url, type, status
)
VALUES (
  'uuid',
  'Book Title',
  'Author: Name',
  'Subject Category',
  'https://covers.openlibrary.org/...',
  'book',
  'published'
);
```

**Subjects:**
- Information Technology
- Computer Science
- Digital Transformation
- Education
- Environmental Science
- Professional Development

## 🔄 Updates & Maintenance

### Adding New Data

1. Edit crawler file (e.g., `wifi_crawler.py`)
2. Add location to data list
3. Run generator:
   ```bash
   cd crawlers && python generate_seed_data.py
   ```
4. Deploy new SQL to production

### Removing Duplicates

```sql
-- Find duplicates by name
SELECT name, COUNT(*) FROM map_points
GROUP BY name HAVING COUNT(*) > 1;

-- Delete duplicates (keep first)
DELETE FROM map_points WHERE id NOT IN (
  SELECT MIN(id) FROM map_points GROUP BY name
);
```

### Updating Coordinates

```sql
UPDATE map_points
SET location = ST_SetSRID(ST_MakePoint(106.87, 10.98), 4326)::geography
WHERE name = 'Location Name';
```

## 🚨 Troubleshooting

### Issue: "Tables don't exist"
**Solution:** Run `scripts/execute_db_setup.py` to create schema first

### Issue: "Duplicate key value"
**Solution:** Clear old data or use different UUIDs in seed file

### Issue: "PostGIS extension not found"
**Solution:** Run `CREATE EXTENSION IF NOT EXISTS postgis;` as superuser

### Issue: "Vector DB not populated"
**Solution:** Run `ai-service/seed_vector_db.py` after DB setup

### Issue: "Map not showing markers"
**Solution:**
1. Check coordinates are valid (lat: -90 to 90, lng: -180 to 180)
2. Verify database query works
3. Check frontend map component for errors

## 📞 Support

For issues:
1. Check crawler README in `crawlers/`
2. Review database logs
3. Verify PostGIS is enabled: `SELECT PostGIS_Version();`
4. Test individual crawlers separately

## 📋 Checklist

- [ ] Crawled data generated successfully (43 map points)
- [ ] SQL seed file created
- [ ] Database initialized with seed data
- [ ] Vector DB populated with documents
- [ ] Frontend displays map with markers
- [ ] Books searchable by subject
- [ ] WiFi locations marked
- [ ] Schools categorized
- [ ] Green spaces visible
- [ ] Deployed to Hugging Face Spaces
- [ ] Public access verified
- [ ] Performance tested

## 📈 Next Steps

1. **Enhance Data Collection**
   - Add real-time WiFi from Google Maps
   - Integrate OpenLibrary API
   - Scrape school websites for programs

2. **Improve Recommendations**
   - Build user preference profiles
   - Implement collaborative filtering
   - Train AI model on user interactions

3. **Add Features**
   - User reviews and ratings
   - Bookmarking favorites
   - Social sharing
   - Mentor connections

4. **Optimize Performance**
   - Index PostGIS coordinates
   - Cache frequent queries
   - Paginate large results

---

**Last Updated:** June 6, 2026
**Data Version:** 1.0 (Initial Release)
**Coverage:** Dong Nai Province, Vietnam
**Total Records:** 123 (43 map points + 80 books)
