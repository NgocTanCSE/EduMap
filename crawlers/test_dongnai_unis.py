import requests
import urllib.parse
import json

bbox = "10.68,106.75,11.15,107.25"
q = (
    '[out:json][timeout:90];'
    '(node["amenity"="university"](' + bbox + ');'
    'way["amenity"="university"](' + bbox + ');'
    'node["amenity"="college"](' + bbox + ');'
    'way["amenity"="college"](' + bbox + ');'
    ');out center tags;'
)

print("Querying universities/colleges...")
get_url = "https://overpass.kumi.systems/api/interpreter?" + urllib.parse.urlencode({"data": q})
r = requests.get(get_url, timeout=120)
print(f"Status: {r.status_code}")
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
            "lat": lat,
            "lng": lng,
            "type": tags.get("amenity", ""),
            "operator": tags.get("operator", ""),
            "website": tags.get("website", ""),
        })
    print(f"Found: {len(items)}")
    for it in items:
        print(f"  {it['name']} ({it['type']}) [{it['lat']:.4f}, {it['lng']:.4f}]")
    with open("crawled_data/dongnai_unis.json", "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
    print("Saved to crawled_data/dongnai_unis.json")
else:
    print(r.text[:300])
