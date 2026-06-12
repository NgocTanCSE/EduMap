#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Combine all Dong Nai data into a single SQL file
"""
import json
import uuid
import os
import time

# Load data
with open("crawled_data/dongnai_detailed.json", "r", encoding="utf-8") as f:
    detailed = json.load(f)

with open("crawled_data/dongnai_unis.json", "r", encoding="utf-8") as f:
    unis = json.load(f)

schools = detailed.get("schools", [])
libraries = detailed.get("libraries", [])
wifi_spots = detailed.get("wifi", [])

print(f"Loaded: {len(schools)} schools, {len(unis)} unis, {len(libraries)} libs, {len(wifi_spots)} wifi")

# Combine all
all_locs = []
seen = set()

def add_loc(loc, category):
    key = (loc["name"].lower().strip(), round(loc["lat"], 4), round(loc["lng"], 4))
    if key in seen:
        return
    seen.add(key)
    all_locs.append({**loc, "category": category})

for s in schools:
    add_loc(s, "school")
for u in unis:
    add_loc(u, "university")
for l in libraries:
    add_loc(l, "library")
for w in wifi_spots:
    add_loc(w, "wifi")

print(f"Total unique locations: {len(all_locs)}")

# Detect school type
def detect_type(loc):
    name = loc.get("name", "").lower()
    if "đại học" in name or "university" in name:
        return "university"
    if "cao đẳng" in name or "college" in name:
        return "college"
    if "mầm non" in name or "mẫu giáo" in name or "kindergarten" in name:
        return "kindergarten"
    if "tiểu học" in name or "primary" in name:
        return "primary_school"
    if "trung học phổ thông" in name or "thpt" in name:
        return "secondary_school"
    if "trung học cơ sở" in name or "thcs" in name:
        return "middle_school"
    if "trung cấp" in name:
        return "vocational"
    return loc.get("type", "school")

# Generate SQL
lines = []
lines.append("-- ============================================================")
lines.append("-- Dong Nai Province - Detailed Education & Facilities Data")
lines.append("-- Generated: " + time.strftime("%Y-%m-%d %H:%M:%S"))
lines.append(f"-- Total locations: {len(all_locs)}")
lines.append("-- ============================================================")
lines.append("")

for loc in all_locs:
    point_id = str(uuid.uuid4())
    name = loc.get("name", "").replace("'", "''")
    category = loc.get("category", "school")
    school_type = detect_type(loc)
    lat = loc.get("lat", 0)
    lng = loc.get("lng", 0)

    # Build rich description
    desc_parts = []
    desc_parts.append(f"Loại: {school_type}")

    if loc.get("address"):
        desc_parts.append(f"Địa chỉ: {loc['address']}")
    if loc.get("operator"):
        desc_parts.append(f"Quản lý: {loc['operator']}")
    if loc.get("website"):
        desc_parts.append(f"Website: {loc['website']}")
    if loc.get("phone"):
        desc_parts.append(f"Điện thoại: {loc['phone']}")
    if loc.get("opening_hours"):
        desc_parts.append(f"Giờ mở cửa: {loc['opening_hours']}")

    # WiFi info
    if loc.get("nearby_wifi"):
        wifi_names = [w["name"] for w in loc["nearby_wifi"][:3]]
        desc_parts.append(f"WiFi gần: {', '.join(wifi_names)}")
    elif loc.get("category") == "wifi":
        desc_parts.append("WiFi công cộng")

    # Library info
    if loc.get("nearby_libraries"):
        lib_names = [l["name"] for l in loc["nearby_libraries"][:3]]
        desc_parts.append(f"Thư viện gần: {', '.join(lib_names)}")
    elif loc.get("category") == "library":
        desc_parts.append("Thư viện")

    description = " | ".join(desc_parts).replace("'", "''")

    sql = f"INSERT INTO map_points (id, name, description, category, location) VALUES ('{point_id}', '{name}', '{description}', '{category}', ST_SetSRID(ST_MakePoint({lng}, {lat}), 4326)::geography);"
    lines.append(sql)

# Write SQL
os.makedirs("crawled_data", exist_ok=True)
sql_file = f"crawled_data/dong_nai_all_schools_{time.strftime('%Y%m%d_%H%M%S')}.sql"
with open(sql_file, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
print(f"\nSQL saved: {sql_file}")
print(f"File size: {os.path.getsize(sql_file) / 1024:.1f} KB")

# Stats
from collections import Counter
type_counts = Counter(detect_type(loc) for loc in all_locs)
cat_counts = Counter(loc.get("category", "unknown") for loc in all_locs)
print(f"\nBy category: {dict(cat_counts)}")
print(f"By type: {dict(type_counts.most_common(20))}")
