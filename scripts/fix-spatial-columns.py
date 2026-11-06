"""
Fix geography/geometry columns: wrap spatialFeatureType/srid in conditional spread.
"""
import re, glob, os

BASE = "/home/ngoctan/Downloads/EduMap/backend/src"

files = glob.glob(f"{BASE}/**/*.entity.ts", recursive=True)
fixed = 0

for f in sorted(files):
    with open(f) as fh:
        original = fh.read()
    content = original

    content = re.sub(
        r"(\s+)(spatialFeatureType:\s*'[^']+',\s*\n\s*srid:\s*\d+,\s*\n)",
        r"\1...(process.env.DB_TYPE === 'postgres' ? { spatialFeatureType: 'Point', srid: 4326 } : {}),\n",
        content
    )

    content = re.sub(
        r"spatialFeatureType:\s*'(\w+)',\s*srid:\s*(\d+)",
        lambda m: f"...(process.env.DB_TYPE === 'postgres' ? {{ spatialFeatureType: '{m.group(1)}', srid: {m.group(2)} }} : {{}})",
        content
    )

    content = re.sub(
        r"(\s+)(spatialFeatureType:\s*'[^']+',\s*\n)",
        r"\1...(process.env.DB_TYPE === 'postgres' ? { spatialFeatureType: 'Point' } : {}),\n",
        content
    )

    content = re.sub(
        r"spatialFeatureType:\s*'(\w+)'",
        lambda m: f"...(process.env.DB_TYPE === 'postgres' ? {{ spatialFeatureType: '{m.group(1)}' }} : {{}})",
        content
    )

    if content != original:
        with open(f, 'w') as fh:
            fh.write(content)
        print(f"✅ Fixed: {os.path.relpath(f, BASE)}")
        fixed += 1

print(f"\nFixed {fixed} entity files")
