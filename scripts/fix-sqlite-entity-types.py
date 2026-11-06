"""
Bulk-fix entity column types for SQLite compatibility in HF Spaces deployment.
Replaces PostgreSQL-specific types with conditional DB_TYPE-aware expressions.
"""
import os, re, glob

BASE = "/home/ngoctan/Downloads/EduMap/backend/src"

REPLACEMENTS = [
    (r"type:\s*'timestamp with time zone'",
     "type: process.env.DB_TYPE === 'postgres' ? 'timestamp with time zone' : 'datetime'"),
    (r"type:\s*'timestamp'(?![\s\n]*with)",
     "type: process.env.DB_TYPE === 'postgres' ? 'timestamp' : 'datetime'"),
    (r"type:\s*'jsonb'",
     "type: process.env.DB_TYPE === 'postgres' ? 'jsonb' : 'json'"),
    (r"type:\s*'tsvector'",
     "type: 'text'"),
    (r"type:\s*'enum'",
     "type: process.env.DB_TYPE === 'postgres' ? 'enum' : 'text'"),
    (r"type:\s*'geography'(?!.*\?)",
     "type: process.env.DB_TYPE === 'postgres' ? 'geography' : 'json'"),
    (r"type:\s*'geometry'(?!.*\?)",
     "type: process.env.DB_TYPE === 'postgres' ? 'geometry' : 'json'"),
]


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

    geo_pattern = re.compile(
        r'@Column\(\{[^}]*?'
        r'(type:\s*process\.env\.DB_TYPE.*?:\s*\'geography\'|\'geometry\').*?'
        r'spatialFeatureType:\s*\'(\w+)\',\s*srid:\s*(\d+)',
        re.DOTALL
    )

    def geo_replacer(m):
        full = m.group(0)
        geo_type = m.group(1)  
        feat_type = m.group(2)  
        srid = m.group(3)  

        if '...' in full or 'DB_TYPE' in full:
            return full  

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

    for match in re.finditer(r'@Column\(\{([^}]+)\}\)', original, re.DOTALL):
        block = match.group(1)
        if 'geography' in block or 'geometry' in block:
            if 'spatialFeatureType' in block and 'process.env.DB_TYPE' not in block:
                pass

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

entity_files = glob.glob(f"{BASE}/**/*.entity.ts", recursive=True)
print(f"Found {len(entity_files)} entity files")

fixed = 0
for path in sorted(entity_files):
    if fix_entity(path):
        fixed += 1

print(f"\n✅ Fixed {fixed}/{len(entity_files)} entity files")
