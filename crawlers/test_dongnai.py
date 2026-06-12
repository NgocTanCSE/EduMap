import requests
import json
import urllib.parse
import time
from collections import Counter

bbox = "10.68,106.75,11.15,107.25"

queries = {
    "schools": '[out:json][timeout:90];(node["amenity"="school"](' + bbox + ');way["amenity"="school"](' + bbox + '););out center tags;',
    "universities": '[out:json][timeout:90];(node["amenity"="university"](' + bbox + ');way["amenity"="university"](' + bbox + ');node["amenity"="college"](' + bbox + ');way["amenity"="college"](' + bbox + '););out center tags;',
    "libraries": '[out:json][timeout:90];(node["amenity"="library"](' + bbox + ');way["amenity"="library"](' + bbox + ');node["amenity"="books"](' + bbox + '););out center tags;',
    "wifi": '[out:json][timeout:90];(node["internet_access"="wlan"](' + bbox + ');node["amenity"="community_centre"]["internet_access"="wlan"](' + bbox + '););out center tags;',
}

all_results = {}

for key, q in queries.items():
    print(f"\nQuerying {key}...")
    try:
        get_url = "https://overpass.kumi.systems/api/interpreter?" + urllib.parse.urlencode({"data": q})
        r = requests.get(get_url, timeout=120)
        if r.status_code == 200:
            data = r.json()
            els = data.get("elements", [])
            items = []
            for e in els:
                tags = e.get("tags", {})
                name = tags.get("name", "")
                if not name:
                    continue
                lat = e.get("lat") or (e.get("center") or {}).get("lat")
                lng = e.get("lon") or (e.get("center") or {}).get("lon")
                if not lat or not lng:
                    continue
                items.append({
                    "name": name,
                    "name_vi": tags.get("name:vi", name),
                    "lat": lat,
                    "lng": lng,
                    "type": tags.get("amenity", key),
                    "address": tags.get("addr:street", ""),
                    "website": tags.get("website", ""),
                    "phone": tags.get("phone", ""),
                    "operator": tags.get("operator", ""),
                    "opening_hours": tags.get("opening_hours", ""),
                    "level": tags.get("education_level", tags.get("school:level", "")),
                })
            all_results[key] = items
            print(f"  Found: {len(items)}")
            for it in items[:10]:
                print(f"    {it['name']} [{it['lat']:.4f}, {it['lng']:.4f}]")
        else:
            print(f"  Error: {r.status_code}")
            all_results[key] = []
    except Exception as e:
        print(f"  Error: {e}")
        all_results[key] = []
    time.sleep(3)

# Summary
print("\n" + "="*60)
print("DONG NAI SUMMARY")
print("="*60)
for key, items in all_results.items():
    print(f"  {key}: {len(items)}")
    if key == "schools":
        types = Counter(it.get("level", "unknown") for it in items)
        print(f"    By level: {dict(types)}")
total = sum(len(v) for v in all_results.values())
print(f"  TOTAL: {total}")

# Save
with open("crawled_data/dongnai_detailed.json", "w", encoding="utf-8") as f:
    json.dump(all_results, f, ensure_ascii=False, indent=2)
print("\nSaved to crawled_data/dongnai_detailed.json")
