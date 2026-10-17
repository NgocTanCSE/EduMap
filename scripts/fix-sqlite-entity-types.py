#!/usr/bin/env python3
"""
Bulk-fix entity column types for SQLite compatibility in HF Spaces deployment.
Replaces PostgreSQL-specific types with conditional DB_TYPE-aware expressions.
"""
import os, re, glob

BASE = "/home/ngoctan/Downloads/EduMap/backend/src"

# Patterns to replace in entity files
# Order matters: more specific patterns first
REPLACEMENTS = [
    # 1. timestamp with time zone (must be before 'timestamp')
    (r"type:\s*'timestamp with time zone'",
     "type: process.env.DB_TYPE === 'postgres' ? 'timestamp with time zone' : 'datetime'"),
    # 2. timestamp (not followed by ' with')
    (r"type:\s*'timestamp'(?![\s\n]*with)",
     "type: process.env.DB_TYPE === 'postgres' ? 'timestamp' : 'datetime'"),
    # 3. jsonb → json for SQLite
    (r"type:\s*'jsonb'",
     "type: process.env.DB_TYPE === 'postgres' ? 'jsonb' : 'json'"),
    # 4. tsvector → text (simple replacement)
    (r"type:\s*'tsvector'",
     "type: 'text'"),
    # 5. enum → text for SQLite (preserve enum property for PostgreSQL)
    (r"type:\s*'enum'",
     "type: process.env.DB_TYPE === 'postgres' ? 'enum' : 'text'"),
    # 6. geography without conditional → add conditional
    (r"type:\s*'geography'(?!.*\?)",
     "type: process.env.DB_TYPE === 'postgres' ? 'geography' : 'json'"),
    # 7. geometry without conditional → add conditional
    (r"type:\s*'geometry'(?!.*\?)",
     "type: process.env.DB_TYPE === 'postgres' ? 'geometry' : 'json'"),
]

# Additional: remove spatialFeatureType/srid when type is geography/geometry
# but only if they're not already in a conditional spread
# These will be handled by adding them to the conditional spread pattern

def fix_entity(path):
    with open(path, 'r') as f:
        original = f.read()
    
    content = original
    changes = []
    
    for pattern, replacement in REPLACEMENTS:
        matches = re.findall(pattern, content)
        if matches:
            content = re.sub(pattern, replacement, content)
            changes.append(f"  {pattern[:40]}... → {len(matches)} replacements")
    
    # Fix geography/geometry columns with spatialFeatureType/srid that aren't conditional
    # Pattern: type: 'geography' or type: 'geometry' followed by spatialFeatureType
    # If the column already has a conditional type (process.env.DB_TYPE), skip
    # Otherwise, convert to conditional with spread
    geo_pattern = re.compile(
        r'@Column\(\{[^}]*?'
        r'(type:\s*process\.env\.DB_TYPE.*?:\s*\'geography\'|\'geometry\').*?'
        r'spatialFeatureType:\s*\'(\w+)\',\s*srid:\s*(\d+)',
        re.DOTALL
    )
    
    def geo_replacer(m):
        full = m.group(0)
        geo_type = m.group(1)  # 'geography' or 'geometry'
        feat_type = m.group(2)  # Point, LineString, Polygon
        srid = m.group(3)  # 4326
        
        # Check if spatialFeatureType/srid is already conditional
        if '...' in full or 'DB_TYPE' in full:
            return full  # Already conditional, skip
        
        # Replace with conditional spread
        new = full.replace(
            f"type: 'geography'", 
            f"type: process.env.DB_TYPE === 'postgres' ? 'geography' : 'json'"
        ).replace(
            f"spatialFeatureType: '{feat_type}', srid: {srid}",
            f"...(process.env.DB_TYPE === 'postgres' ? {{ spatialFeatureType: '{feat_type}', srid: {srid} }} : {{}})"
        ).replace(
            f"spatialFeatureType: '{feat_type}',srid: {srid}",
            f"...(process.env.DB_TYPE === 'postgres' ? {{ spatialFeatureType: '{feat_type}', srid: {srid} }} : {{}})"
        )
        return new
    
    # Simpler approach: just handle the known geography/geometry patterns
    # Find columns with geography/geometry that have spatialFeatureType
    for match in re.finditer(r'@Column\(\{([^}]+)\}\)', original, re.DOTALL):
        block = match.group(1)
        if 'geography' in block or 'geometry' in block:
            if 'spatialFeatureType' in block and 'process.env.DB_TYPE' not in block:
                # This is a non-conditional geography/geometry with spatial params
                # Mark for replacement
                pass
    
    # Also handle @Index({ spatial: true }) - these might cause issues with SQLite
    # TypeORM's SQLite driver doesn't support spatial indexes
    # Replace with empty or conditional
    content = re.sub(
        r'@Index\(\{ spatial: true \}\)',
        '@Index({ sync: true })',
        content
    )
    
    if content != original:
        with open(path, 'w') as f:
            f.write(content)
        print(f"✅ Fixed: {os.path.relpath(path, BASE)}")
        for c in changes:
            print(f"  {c}")
        return True
    return False

# Find all entity files
entity_files = glob.glob(f"{BASE}/**/*.entity.ts", recursive=True)
print(f"Found {len(entity_files)} entity files")

fixed = 0
for path in sorted(entity_files):
    if fix_entity(path):
        fixed += 1

print(f"\n✅ Fixed {fixed}/{len(entity_files)} entity files")
