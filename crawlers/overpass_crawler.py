# -*- coding: utf-8 -*-
"""
OverpassCrawler - Nationwide Vietnam OpenStreetMap data fetcher.
Splits queries by region to avoid timeouts and rate limits.
"""

import time
import requests
from typing import List, Dict, Any, Tuple

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
# Backup Overpass servers
OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.ru/api/interpreter",
]

# Vietnam regions (south,west,north,east) - split into 5 parts
VIETNAM_REGIONS = {
    "north": "20.5,102.0,23.5,106.5",
    "north_central": "17.0,104.0,20.5,107.0",
    "central": "14.0,105.0,17.0,109.0",
    "south_central": "11.0,105.0,14.0,109.0",
    "south": "8.0,104.0,11.5,107.5",
}

# Full Vietnam bbox
VIETNAM_FULL = "8.0,102.0,23.5,109.5"


def _respect_rate_limit(last_ts: float, min_delay: float = 3.0) -> float:
    """Ensure minimum delay between Overpass requests."""
    now = time.time()
    elapsed = now - last_ts
    if elapsed < min_delay:
        time.sleep(min_delay - elapsed)
    return time.time()


class OverpassCrawler:
    """Nationwide Vietnam Overpass crawler with regional splitting."""

    def __init__(self, proxy_url: str = None):
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": "EduMapNationwide/1.0"})
        self.proxies = {"http": proxy_url, "https": proxy_url} if proxy_url else None
        if self.proxies:
            self.session.proxies.update(self.proxies)
        self._last_ts = 0.0
        self._mirror_idx = 0

    def _get_url(self) -> str:
        """Rotate through Overpass mirrors."""
        url = OVERPASS_MIRRORS[self._mirror_idx % len(OVERPASS_MIRRORS)]
        self._mirror_idx += 1
        return url

    def _post(self, data: str, retries: int = 3) -> Dict[str, Any]:
        """Send POST request with retry and mirror rotation."""
        for attempt in range(retries):
            self._last_ts = _respect_rate_limit(self._last_ts)
            url = self._get_url()
            try:
                resp = self.session.post(url, data=data, timeout=300)
                if resp.status_code == 429:
                    wait = 60 * (attempt + 1)
                    print(f"    [Rate limited] Waiting {wait}s...")
                    time.sleep(wait)
                    continue
                if resp.status_code == 504:
                    wait = 30 * (attempt + 1)
                    print(f"    [Timeout] Waiting {wait}s...")
                    time.sleep(wait)
                    continue
                resp.raise_for_status()
                return resp.json()
            except Exception as e:
                if attempt < retries - 1:
                    wait = 30 * (attempt + 1)
                    print(f"    [Error] {e}, retrying in {wait}s...")
                    time.sleep(wait)
                else:
                    print(f"    [Failed] {e}")
        return {"elements": []}

    def _normalize_element(self, el: Dict[str, Any]) -> Dict[str, Any]:
        """Convert OSM element to unified schema."""
        tags = el.get("tags", {})
        name = tags.get("name", "")
        parts = []
        if tags.get("addr:housenumber"):
            parts.append(tags["addr:housenumber"])
        if tags.get("addr:street"):
            parts.append(tags["addr:street"])
        if tags.get("addr:ward"):
            parts.append(tags["addr:ward"])
        if tags.get("addr:city"):
            parts.append(tags["addr:city"])
        address = ", ".join(parts)

        lat = el.get("lat") or el.get("center", {}).get("lat")
        lng = el.get("lon") or el.get("center", {}).get("lon")

        # Category from primary tag
        for tag_key in ["amenity", "shop", "leisure", "tourism", "healthcare",
                        "office", "craft", "man_made", "boundary"]:
            if tag_key in tags:
                category = tags[tag_key]
                break
        else:
            category = "poi"

        return {
            "name": name,
            "address": address,
            "lat": float(lat) if lat else 0.0,
            "lng": float(lng) if lng else 0.0,
            "category": category,
        }

    def fetch(self, query: str) -> List[Dict[str, Any]]:
        """Execute Overpass query and return normalized locations."""
        try:
            raw = self._post(query)
        except Exception as e:
            print(f"    [Query failed] {e}")
            return []
        elements = raw.get("elements", [])
        locations = []
        for el in elements:
            try:
                loc = self._normalize_element(el)
                if loc["name"]:
                    locations.append(loc)
            except Exception:
                continue
        return locations

    # ------------------------------------------------------------------
    # Combined queries for efficiency
    # ------------------------------------------------------------------

    def fetch_all_education_health(self, bbox: str) -> List[Dict[str, Any]]:
        """Fetch education + health in one query."""
        query = f"""
        [out:json][timeout:180];
        (
          node[amenity~"school|library|university|kindergarten|college|hospital|clinic|pharmacy|doctors|dentist"]({bbox});
          way[amenity~"school|library|university|kindergarten|college|hospital|clinic|pharmacy|doctors|dentist"]({bbox});
        );
        out center;
        """
        return self.fetch(query)

    def fetch_all_food_shops(self, bbox: str) -> List[Dict[str, Any]]:
        """Fetch food/drink + shops in one query."""
        query = f"""
        [out:json][timeout:180];
        (
          node[amenity~"restaurant|cafe|fast_food|bar|pub|ice_cream|food_court"]({bbox});
          way[amenity~"restaurant|cafe|fast_food|bar|pub|ice_cream|food_court"]({bbox});
          node[shop]({bbox});
          way[shop]({bbox});
        );
        out center;
        """
        return self.fetch(query)

    def fetch_all_tourism_transport(self, bbox: str) -> List[Dict[str, Any]]:
        """Fetch tourism + transport + public services in one query."""
        query = f"""
        [out:json][timeout:180];
        (
          node[tourism~"hotel|hostel|guest_house|motel|attraction|museum|zoo|camp_site|viewpoint"]({bbox});
          way[tourism~"hotel|hostel|guest_house|motel|attraction|museum|zoo|camp_site|viewpoint"]({bbox});
          node[leisure~"park|garden|nature_reserve|water_park|stadium|sports_centre"]({bbox});
          way[leisure~"park|garden|nature_reserve|water_park|stadium|sports_centre"]({bbox});
          node[amenity~"bus_station|parking|taxi|car_rental|post_office|bank|atm|townhall|fuel"]({bbox});
          way[amenity~"bus_station|parking|taxi|car_rental|post_office|bank|atm|townhall|fuel"]({bbox});
          node[aeroway~"aerodrome|helipad"]({bbox});
        );
        out center;
        """
        return self.fetch(query)

    # ------------------------------------------------------------------
    # WiFi hotspots
    # ------------------------------------------------------------------

    def fetch_wifi(self, bbox: str) -> List[Dict[str, Any]]:
        """Fetch WiFi hotspots for a bbox."""
        query = f"""
        [out:json][timeout:120];
        (
          node["internet_access"="wlan"]({bbox});
        );
        out;
        """
        return self.fetch(query)

    # ------------------------------------------------------------------
    # Nationwide crawl methods
    # ------------------------------------------------------------------

    def _crawl_region(self, region_name: str, bbox: str) -> List[Dict]:
        """Crawl all categories for a single region using combined queries."""
        print(f"\n  [{region_name.upper()}] bbox={bbox}")
        all_locs = []

        print(f"    Education + Health...")
        data1 = self.fetch_all_education_health(bbox)
        all_locs.extend(data1)
        print(f"    -> {len(data1)} records")

        print(f"    Food + Shops...")
        data2 = self.fetch_all_food_shops(bbox)
        all_locs.extend(data2)
        print(f"    -> {len(data2)} records")

        print(f"    Tourism + Transport + Services...")
        data3 = self.fetch_all_tourism_transport(bbox)
        all_locs.extend(data3)
        print(f"    -> {len(data3)} records")

        print(f"  Region total: {len(all_locs)}")
        return all_locs

    def crawl_vietnam(self) -> List[Dict[str, Any]]:
        """Crawl all of Vietnam by regions. Returns combined list."""
        all_locations = []

        for region_name, bbox in VIETNAM_REGIONS.items():
            print(f"\n{'='*60}")
            print(f"Crawling region: {region_name.upper()}")
            print(f"{'='*60}")
            region_data = self._crawl_region(region_name, bbox)
            all_locations.extend(region_data)

        # Summary
        print(f"\n{'='*60}")
        print("NATIONWIDE SUMMARY")
        print(f"{'='*60}")
        print(f"  Total locations: {len(all_locations)}")

        return all_locations

    def get_all_locations(self) -> List[Dict[str, Any]]:
        """Crawl nationwide and return flat list of all locations."""
        return self.crawl_vietnam()
