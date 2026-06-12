#!/usr/bin/env python3
"""Quality check on consolidated crawled data SQL"""
import re
from collections import Counter

SQL_FILE = "crawled_data/consolidated_crawled_data_20260612_231835.sql"

with open(SQL_FILE, "r", encoding="utf-8") as f:
    sql = f.read()

# Count INSERT statements for map_points
inserts = re.findall(r"INSERT INTO map_points", sql)
print(f"Total map_points INSERTs: {len(inserts)}")

# Count by description/category
descs = re.findall(
    r"INSERT INTO map_points \([^)]+\) VALUES \('[^']+', '[^']+', '([^']+)'",
    sql,
)
counts = Counter(descs)
print("\nBreakdown by category:")
for cat, cnt in counts.most_common():
    print(f"  {cat}: {cnt}")

# Check for missing coordinates (lat=0 or lng=0)
zero_coords = re.findall(
    r"ST_MakePoint\(0\.0, 0\.0\)", sql
)
print(f"\nRecords with zero coordinates: {len(zero_coords)}")

# Check for duplicate names
names = re.findall(
    r"INSERT INTO map_points \([^)]+\) VALUES \('[^']+', '([^']+)'",
    sql,
)
name_counts = Counter(names)
dups = {n: c for n, c in name_counts.items() if c > 1}
print(f"\nDuplicate names: {len(dups)}")
if dups:
    for n, c in sorted(dups.items(), key=lambda x: -x[1])[:10]:
        print(f"  '{n}': {c} occurrences")

# File size
import os
size_kb = os.path.getsize(SQL_FILE) / 1024
print(f"\nSQL file size: {size_kb:.1f} KB")
print(f"Total unique names: {len(name_counts)}")
