# Plan: Debug AI Service Crash and Map Data Issues

## Identified Issues

### 1. AI Service Crash (Exit Status 1)
**Root Cause Analysis:**
- The AI service at `ai-service/main.py` uses `google-genai` package (line 4 in requirements.txt)
- Code uses `from google import genai` (llm_service.py line 4) which is the **wrong import**
- The correct import for `google-genai` should be `import google.generativeai as genai`
- This mismatch causes a ModuleNotFoundError/ImportError on startup

**Evidence:**
- Log shows: `exited: ai-service (exit status 1; not expected)` after ~3 seconds
- This timing matches Python failing to import the module after startup

### 2. Map Data Issues - Wrong Field Names
**Root Cause Analysis:**
- `MapScreen.tsx` displays `item.address` (line 38) from API response
- `map.service.ts::locationToPoi()` (line 67) correctly maps `address` field
- `map.service.ts::mapPointToPoi()` (line 100) correctly maps `address` field
- In `seed_crawled_data.sql` (lines 1-100+), `locations` table is populated with:
  - Only `name`, `description`, `coordinates` fields
  - **Missing `address` field** - causing addresses to be undefined on the map
  - Example: `INSERT INTO locations (id, name, description, coordinates) VALUES ...`

**Missing Address Data:**
- All records in `seed_crawled_data.sql` lack the `address` column
- This affects both the map display and any address-based filtering

### 3. Missing Restaurant Data on Map
**Root Cause Analysis:**
- `seed_crawled_data.sql` contains restaurant entries (e.g., "Nhà Hàng Jaspas", "Nhà Hàng Alibaba")
- However, these are inserted into `locations` table without `category_id`
- The `locations` table schema (schema.sql lines 697-716) requires `category_id` referencing `location_categories`
- `map.service.ts::findPoisByCategory()` lookup (line 204) filters by category name
- Restaurants are NOT being categorized because:
  - No `category_id` is set in seed data
  - `locations` table has NO `category_id` in the INSERT statements

**Category Mapping Issue:**
- `map.service.ts` (line 81-92) detects restaurant from description: `descLower.includes('restaurant') || descLower.includes('food')`
- But the crawled data uses Vietnamese descriptions like "restaurant" mixed with other categories
- The category detection logic doesn't properly map crawled categories to the expected categories

## Proposed Fix Plan

### Fix 1: AI Service Import (ai-service/services/llm_service.py)
Change line 4 from:
```python
from google import genai
```
To:
```python
import google.generativeai as genai
```

Also update lines 20-21, 118, 141, etc. to use `genai.Client` properly or change to `genai.GenerativeModel`.

### Fix 2: Map Address Data (seed_crawled_data.sql)
Update INSERT statements to include address field. Since crawled data lacks addresses, we can:
- Use empty string as placeholder
- Or generate addresses based on location context

### Fix 3: Restaurant Category (seed_crawled_data.sql + map.service.ts)
Options:
1. **Add category_id to seed_crawled_data.sql** - Insert into `location_categories` first with restaurant category
2. **Update map service logic** - Add proper detection for restaurant/fast_food from description field

### Fix 4: Coordinate Accuracy in Map Seed (Multiple files)
The seed files have coordinates that may not be accurate for DNTU campus:
- `seed_dntu_locations.py` uses correct DNTU coordinates (lat 10.98..., lng 106.85...)
- `master_seed_map.py` uses `gen_random_uuid()` which requires PostgreSQL extension
- `seed_crawled_data.sql` uses mixed coordinates (some correct, some from nationwide crawl)

## Files to Modify

1. `ai-service/services/llm_service.py` - Fix google-genai import
2. `seed_crawled_data.sql` - Add missing address field and category_id for restaurants
3. `backend/src/modules/map/map.service.ts` - Improve category detection for restaurant/fast_food
4. `scripts/seed_dntu_locations.py` - Verify coordinate format consistency

## Implementation Priority

1. **Critical**: Fix AI service import (prevents service from starting)
2. **High**: Fix map locations - add missing address and restaurant data
3. **Medium**: Verify coordinate accuracy for DNTU-specific locations