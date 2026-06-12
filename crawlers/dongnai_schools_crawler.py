#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Dong Nai Detailed School Crawler
Crawls ALL schools in Dong Nai from OSM, enriches with WiFi, library, facilities info
"""

import json
import uuid
import time
import requests
from typing import List, Dict, Any

OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

VIETNAM_BBOXES = {
    "dong_nai": "10.68,106.75,11.15,107.25",
}


class DongNaiSchoolCrawler:
    """Crawler chi tiết về tất cả trường học tại Đồng Nai"""

    def __init__(self):
        self.results = []

    def _query_overpass(self, query: str, retries=3) -> List[Dict]:
        """Query Overpass API with retry."""
        for attempt in range(retries):
            url = OVERPASS_URLS[attempt % len(OVERPASS_URLS)]
            try:
                resp = requests.post(url, data={"data": query}, timeout=120)
                if resp.status_code == 200:
                    return resp.json().get("elements", [])
                print(f"    [Warn] Overpass {resp.status_code}")
            except Exception as e:
                print(f"    [Error] {e}")
            time.sleep(3)
        return []

    def fetch_all_schools(self, bbox: str) -> List[Dict[str, Any]]:
        """Query all schools (amenity=school) in Dong Nai."""
        query = f"""
        [out:json][timeout:120];
        (
          node["amenity"="school"]({bbox});
          way["amenity"="school"]({bbox});
        );
        out center tags;
        """
        elements = self._query_overpass(query)
        schools = []
        for el in elements:
            tags = el.get("tags", {})
            name = tags.get("name", "")
            if not name:
                continue
            lat = el.get("lat") or el.get("center", {}).get("lat")
            lng = el.get("lon") or el.get("center", {}).get("lon")
            if not lat or not lng:
                continue
            schools.append({
                "osm_id": el.get("id"),
                "name": name,
                "name_vi": tags.get("name:vi", name),
                "lat": lat,
                "lng": lng,
                "category": "school",
                "type": self._detect_school_type(tags),
                "level": tags.get("education_level", tags.get("school:level", "")),
                "address": tags.get("addr:street", "") + " " + tags.get("addr:housenumber", ""),
                "operator": tags.get("operator", ""),
                "website": tags.get("website", ""),
                "phone": tags.get("phone", ""),
                "opening_hours": tags.get("opening_hours", ""),
                "source": "osm",
                "facilities": [],
                "wifi": False,
                "library": False,
            })
        return schools

    def fetch_libraries(self, bbox: str) -> List[Dict[str, Any]]:
        """Query libraries in Dong Nai."""
        query = f"""
        [out:json][timeout:90];
        (
          node["amenity"="library"]({bbox});
          way["amenity"="library"]({bbox});
          node["amenity"="books"]({bbox});
        );
        out center tags;
        """
        elements = self._query_overpass(query)
        libs = []
        for el in elements:
            tags = el.get("tags", {})
            name = tags.get("name", "")
            if not name:
                continue
            lat = el.get("lat") or el.get("center", {}).get("lat")
            lng = el.get("lon") or el.get("center", {}).get("lon")
            if not lat or not lng:
                continue
            libs.append({
                "osm_id": el.get("id"),
                "name": name,
                "name_vi": tags.get("name:vi", name),
                "lat": lat,
                "lng": lng,
                "category": "library",
                "type": tags.get("library:type", "public"),
                "address": tags.get("addr:street", ""),
                "opening_hours": tags.get("opening_hours", ""),
                "website": tags.get("website", ""),
                "phone": tags.get("phone", ""),
                "source": "osm",
            })
        return libs

    def fetch_universities(self, bbox: str) -> List[Dict[str, Any]]:
        """Query universities and colleges in Dong Nai."""
        query = f"""
        [out:json][timeout:90];
        (
          node["amenity"="university"]({bbox});
          way["amenity"="university"]({bbox});
          node["amenity"="college"]({bbox});
          way["amenity"="college"]({bbox});
        );
        out center tags;
        """
        elements = self._query_overpass(query)
        unis = []
        for el in elements:
            tags = el.get("tags", {})
            name = tags.get("name", "")
            if not name:
                continue
            lat = el.get("lat") or el.get("center", {}).get("lat")
            lng = el.get("lon") or el.get("center", {}).get("lon")
            if not lat or not lng:
                continue
            unis.append({
                "osm_id": el.get("id"),
                "name": name,
                "name_vi": tags.get("name:vi", name),
                "lat": lat,
                "lng": lng,
                "category": "university",
                "type": "university" if "university" in el.get("tags", {}).get("amenity", "") else "college",
                "address": tags.get("addr:street", ""),
                "website": tags.get("website", ""),
                "phone": tags.get("phone", ""),
                "operator": tags.get("operator", ""),
                "source": "osm",
                "facilities": [],
                "wifi": False,
                "library": False,
            })
        return unis

    def fetch_public_wifi(self, bbox: str) -> List[Dict[str, Any]]:
        """Query public WiFi spots (libraries, community centers)."""
        query = f"""
        [out:json][timeout:90];
        (
          node["internet_access"="wlan"]({bbox});
          node["amenity"="community_centre"]["internet_access"="wlan"]({bbox});
          way["amenity"="community_centre"]["internet_access"="wlan"]({bbox});
        );
        out center tags;
        """
        elements = self._query_overpass(query)
        wifi_spots = []
        for el in elements:
            tags = el.get("tags", {})
            name = tags.get("name", tags.get("operator", "Unknown"))
            lat = el.get("lat") or el.get("center", {}).get("lat")
            lng = el.get("lon") or el.get("center", {}).get("lon")
            if not lat or not lng:
                continue
            wifi_spots.append({
                "name": name,
                "lat": lat,
                "lng": lng,
                "internet_access": tags.get("internet_access", "wlan"),
                "fee": tags.get("internet_access:fee", "unknown"),
            })
        return wifi_spots

    def enrich_schools_with_nearby(self, schools: List[Dict], libs: List[Dict], wifi_spots: List[Dict]) -> List[Dict]:
        """Enrich schools with nearby WiFi and library info."""
        from math import radians, cos, sin, asin, sqrt

        def haversine(lat1, lon1, lat2, lon2):
            lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
            dlat = lat2 - lat1
            dlon = lon2 - lon1
            a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
            return 2 * 6371 * asin(sqrt(a))

        enriched = []
        for school in schools:
            s_lat = school.get("lat", 0)
            s_lng = school.get("lng", 0)

            # Find nearby WiFi (within 500m)
            nearby_wifi = []
            for w in wifi_spots:
                dist = haversine(s_lat, s_lng, w["lat"], w["lng"])
                if dist <= 0.5:
                    nearby_wifi.append({"name": w["name"], "distance_km": round(dist, 2)})

            # Find nearby libraries (within 1km)
            nearby_libs = []
            for lib in libs:
                dist = haversine(s_lat, s_lng, lib["lat"], lib["lng"])
                if dist <= 1.0:
                    nearby_libs.append({"name": lib["name"], "distance_km": round(dist, 2)})

            school["wifi"] = len(nearby_wifi) > 0
            school["nearby_wifi"] = nearby_wifi
            school["library"] = len(nearby_libs) > 0
            school["nearby_libraries"] = nearby_libs

            # Facilities inference
            facilities = []
            if school.get("wifi"):
                facilities.append("WiFi")
            if school.get("library"):
                facilities.append("Thư viện gần")
            if school.get("type") in ["university", "college"]:
                facilities.extend(["Canteen", "Ký túc xá", "Sân thể thao"])
            elif school.get("type") == "primary_school":
                facilities.extend(["Sân chơi", "Căng tin"])
            elif school.get("type") == "secondary_school":
                facilities.extend(["Phòng lab", "Thư viện", "Sân thể thao"])
            school["facilities"] = facilities

            enriched.append(school)

        return enriched

    def _detect_school_type(self, tags: Dict) -> str:
        """Detect school level from OSM tags."""
        isced = tags.get("isced:level", "")
        level = tags.get("education_level", tags.get("school:level", ""))
        name_lower = tags.get("name", "").lower()

        if "đại học" in name_lower or "university" in name_lower:
            return "university"
        if "cao đẳng" in name_lower or "college" in name_lower:
            return "college"
        if "tiểu học" in name_lower or "primary" in name_lower or isced == "1":
            return "primary_school"
        if "trung học phổ thông" in name_lower or "thpt" in name_lower or isced == "3":
            return "secondary_school"
        if "trung học cơ sở" in name_lower or "thcs" in name_lower or isced == "2":
            return "middle_school"
        if "mầm non" in name_lower or "kindergarten" in name_lower or isced == "0":
            return "kindergarten"
        if "mẫu giáo" in name_lower:
            return "kindergarten"

        if level == "primary" or "tiểu" in name_lower:
            return "primary_school"
        if level == "secondary" or "phổ thông" in name_lower:
            return "secondary_school"
        return "school"

    def crawl_all(self) -> Dict[str, Any]:
        """Main method: crawl all Dong Nai schools, libraries, WiFi."""
        bbox = VIETNAM_BBOXES["dong_nai"]

        print("=== Dong Nai Detailed School Crawler ===\n")

        print("[1/4] Querying schools...")
        schools = self.fetch_all_schools(bbox)
        print(f"  Found {len(schools)} schools")

        print("[2/4] Querying universities/colleges...")
        unis = self.fetch_universities(bbox)
        print(f"  Found {len(unis)} universities/colleges")

        print("[3/4] Querying libraries...")
        libs = self.fetch_libraries(bbox)
        print(f"  Found {len(libs)} libraries")

        print("[4/4] Querying public WiFi spots...")
        wifi_spots = self.fetch_public_wifi(bbox)
        print(f"  Found {len(wifi_spots)} WiFi spots")

        # Combine schools + universities
        all_education = schools + unis

        print(f"\nEnriching {len(all_education)} schools with WiFi & library data...")
        enriched = self.enrich_schools_with_nearby(all_education, libs, wifi_spots)

        # Stats
        with_wifi = sum(1 for s in enriched if s.get("wifi"))
        with_lib = sum(1 for s in enriched if s.get("library"))
        print(f"  Schools with WiFi nearby: {with_wifi}")
        print(f"  Schools with library nearby: {with_lib}")

        # Type breakdown
        from collections import Counter
        type_counts = Counter(s.get("type", "unknown") for s in enriched)
        print(f"\n  Type breakdown:")
        for t, cnt in type_counts.most_common():
            print(f"    {t}: {cnt}")

        return {
            "schools": enriched,
            "libraries": libs,
            "wifi_spots": wifi_spots,
            "stats": {
                "total_schools": len(enriched),
                "total_libraries": len(libs),
                "total_wifi": len(wifi_spots),
                "with_wifi": with_wifi,
                "with_library": with_lib,
                "type_breakdown": dict(type_counts),
            }
        }

    def to_sql(self, data: Dict[str, Any]) -> str:
        """Generate SQL for all Dong Nai schools."""
        lines = []
        lines.append("-- Dong Nai Detailed Schools Data")
        lines.append("-- Generated by DongNaiSchoolCrawler")
        lines.append("")

        all_locs = data["schools"] + data["libraries"]
        for loc in all_locs:
            point_id = str(uuid.uuid4())
            name = loc.get("name", "").replace("'", "''")
            category = loc.get("category", "school")
            lat = loc.get("lat", 0)
            lng = loc.get("lng", 0)

            # Build description with details
            desc_parts = []
            if loc.get("type"):
                desc_parts.append(f"Loại: {loc['type']}")
            if loc.get("address"):
                desc_parts.append(f"Địa chỉ: {loc['address']}")
            if loc.get("operator"):
                desc_parts.append(f"Quản lý: {loc['operator']}")
            if loc.get("website"):
                desc_parts.append(f"Website: {loc['website']}")
            if loc.get("wifi"):
                wifi_names = [w["name"] for w in loc.get("nearby_wifi", [])]
                desc_parts.append(f"WiFi: {', '.join(wifi_names) if wifi_names else 'Có'}")
            if loc.get("library"):
                lib_names = [l["name"] for l in loc.get("nearby_libraries", [])]
                desc_parts.append(f"Thư viện gần: {', '.join(lib_names) if lib_names else 'Có'}")
            if loc.get("facilities"):
                desc_parts.append(f"Cơ sở vật chất: {', '.join(loc['facilities'])}")

            description = " | ".join(desc_parts).replace("'", "''")

            sql = f"INSERT INTO map_points (id, name, description, category, location) VALUES ('{point_id}', '{name}', '{description}', '{category}', ST_SetSRID(ST_MakePoint({lng}, {lat}), 4326)::geography);"
            lines.append(sql)

        return "\n".join(lines)


if __name__ == "__main__":
    crawler = DongNaiSchoolCrawler()
    data = crawler.crawl_all()

    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    print(f"Schools: {data['stats']['total_schools']}")
    print(f"Libraries: {data['stats']['total_libraries']}")
    print(f"WiFi spots: {data['stats']['total_wifi']}")

    # Save SQL
    sql_content = crawler.to_sql(data)
    import os
    os.makedirs("crawled_data", exist_ok=True)
    sql_file = f"crawled_data/dong_nai_schools_{time.strftime('%Y%m%d_%H%M%S')}.sql"
    with open(sql_file, "w", encoding="utf-8") as f:
        f.write(sql_content)
    print(f"\nSQL saved: {sql_file}")

    # Save JSON
    json_file = f"crawled_data/dong_nai_schools_{time.strftime('%Y%m%d_%H%M%S')}.json"
    with open(json_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"JSON saved: {json_file}")
