#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
tavily_poi.py — Tavily-based POI crawler for Vietnamese map_points.

Deployment context (see AGENTS.md §1):
  EduMap runs ONLY on Hugging Face Spaces (free CPU tier).  The existing POI
  crawlers (overpass_crawler.py, crawl_poi_vietnam.py, dongnai_schools_crawler.py,
  green_spaces_crawler.py) used the Overpass API (https://overpass-api.de) which
  is **blocked on HF Spaces egress**.  This module provides a Tavily-based
  replacement: Tavily Search returns web pages listing Vietnamese POIs, and
  we parse coordinates from the extracted article text via regex.

  When TAVILY_API_KEY is absent, or when a result page doesn't contain
  parseable coordinates, the POI is skipped — the curated snapshots in
  schools_crawler.py / wifi_crawler.py / green_spaces_crawler.py fill the gaps
  (AGENTS.md §6: honest-empty-state rule — never fake coordinates).
"""
import os
import re
import sys
import time
from typing import Any, Dict, List, Optional, Tuple

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tavily_client import TavilyClient, tavily_search_and_extract  # noqa: E402
from tavily_parse import clean_text, extract_coords, _location_layer  # noqa: E402

# Coordinate validation for Vietnam (AGENTS.md §9 coordinate fix).
_LAT_MIN, _LAT_MAX = 8.0, 24.0
_LNG_MIN, _LNG_MAX = 102.0, 109.5


def _valid_coords(lat: float, lng: float) -> bool:
    """True when (lat, lng) is inside Vietnam bounding box."""
    return (_LAT_MIN <= lat <= _LAT_MAX) and (_LNG_MIN <= lng <= _LNG_MAX)


def _extract_name_and_coords(text: str) -> Tuple[Optional[str], Optional[float], Optional[float]]:
    """Extract (name, lat, lng) from free text.

    Looks for patterns like:
      'tọa độ 10.9835, 106.8686'
      'lat: 10.9300, lng: 106.8300'
      '10.9300, 106.8300'
    """
    lat, lng = extract_coords(text)
    if lat is not None and lng is not None:
        # Try to find a name near the coordinates.
        # Pattern: "Tên địa điểm (tọa độ 10.xxxx, 106.yyyy)"
        m = re.search(
            r"([^\n,;{}\[\]]{3,80}?)\s*(?:tọa\s*độ|lat|latitude)"
            r"[:\s]*([\d.\s,]+)",
            text, re.IGNORECASE | re.UNICODE,
        )
        if m:
            name = clean_text(m.group(1))[:200]
            return name, lat, lng
        # Pattern: "Tên — 10.xxxx, 106.yyyy"
        m = re.search(r"([^\n,;{}\[\]]{3,80}?)\s*[-–]\s*(\d{1,3}\.\d{3,8})\s*,\s*(\d{1,3}\.\d{3,8})", text)
        if m:
            name = clean_text(m.group(1))[:200]
            try:
                lat2, lng2 = float(m.group(2)), float(m.group(3))
                if _valid_coords(lat2, lng2):
                    return name, lat2, lng2
            except ValueError:
                pass
    return None, lat, lng


def search_pois_tavily(
    query: str,
    *,
    category: str = "poi",
    location_scope: str = "dong_nai",
    max_results: int = 8,
) -> List[Dict[str, Any]]:
    """Search Tavily for a Vietnamese POI query and return parsed POI row dicts.

    Each result is parsed for coordinates in its raw_content.  Results without
    parseable coordinates are skipped.

    Returns a list of dicts with keys: name, lat, lng, address, description,
    category, location_scope, source.
    """
    results = tavily_search_and_extract(
        query,
        search_depth="basic",
        max_results=max_results,
        extract_top_k=5,
        extract_depth="advanced",
    )
    if not results:
        return []

    pois: List[Dict[str, Any]] = []
    seen: set = set()
    for r in results:
        raw_content = r.get("raw_content", "") or r.get("content", "")
        title = clean_text(r.get("title", ""))[:255]
        url = r.get("url", "")

        # Try to extract coordinates from content.
        blob = clean_text(raw_content) or clean_text(title)
        lat, lng = extract_coords(blob)
        if lat is None or lng is None or not _valid_coords(lat, lng):
            continue

        # Try to find a name.
        name = title if title else None
        if not name or len(name) < 3:
            name, _, _ = _extract_name_and_coords(blob)
        if not name:
            name = f"{category} tại {lat:.4f},{lng:.4f}"

        key = (name.lower(), round(lat, 6), round(lng, 6))
        if key in seen:
            continue
        seen.add(key)

        # Try to extract address from content.
        addr = ""
        m = re.search(r"(?:địa chỉ|địa chỉ:|address)[:\s]+((?:[^\n,;]{5,80}?)(?:,|\n))", blob, re.IGNORECASE)
        if m:
            addr = clean_text(m.group(1))[:300]
        if not addr:
            addr = title[:200]

        pois.append({
            "name": name[:255],
            "lat": lat,
            "lng": lng,
            "address": addr,
            "description": blob[:500] + (f" | Nguồn: {url}" if url else ""),
            "category": category,
            "location_scope": location_scope,
            "source": "tavily",
            "source_url": url,
        })

    return pois


class TavilyPoiClient:
    """Tavily-based replacement for OverpassCrawler.

    Provides the same interface methods (fetch_all_education_health, etc.)
    but uses Tavily Search + Extract instead of the Overpass API.
    """

    def __init__(self):
        self.client = TavilyClient()
        self._results_cache: Dict[str, List] = {}
        print(f"  [tavily_poi] configured={self.client.is_configured()} "
              f"circuit_breaker={self.client._cb.state()}")

    # -- Vietnamese POI queries per category/scope --

    _EDU_HEALTH_QUERIES = [
        "trường học Đồng Nai tọa độ",
        "trường tiểu học Biên Hòa địa chỉ",
        "trường THPT Đồng Nai tọa độ",
        "đại học Đồng Nai kĩ thuật",
        "thư viện công cộng Đồng Nai",
        "bệnh viện Đà Nẵng tọa độ",
        "trường học TP Hồ Chí Minh tọa độ địa chỉ",
        "đại học Sài Gòn kĩ thuật",
        "trường học Hà Nội tọa độ",
        "trường khoa học kỹ thuật miền Nam",
    ]

    _FOOD_SHOPS_QUERIES = [
        "chợ địa phương Đồng Nai địa chỉ",
        "chợ Đông Việt Hà Nội",
        "chợ Bình Tâm TP Hồ Chí Minh",
        "quán ăn đường phố Đồng Nai",
        "quán cà phê Biên Hòa",
        "Bách hóa Xanh địa chỉ Đồng Nai",
        "siêu thị Mini miền Nam",
        "chợ Tuấn Ngãi Đà Nẵng",  # example specific market
    ]

    _TOURISM_TRANSPORT_QUERIES = [
        "khách sạn Đồng Nai",
        "điểm du lịch Đà Nẵng",
        "bảo tàng Việt Nam",
        "công viên thiên đường Đồng Nai",
        "nhà ga xe buýt Biên Hòa",
        "trạm xăng Đồng Nai",
    ]

    _WIFI_QUERIES = [
        "wifi công cộng Đồng Nai",
        "quán wifi học tập Biên Hòa",
        "thư viện wifi tốc độ cao Đồng Nai",
        "chỗ học online TP Hồ Chí Minh",
    ]

    def _search_category(self, queries: List[str], category: str,
                         scope: str = "dong_nai") -> List[Dict]:
        """Search Tavily for a set of queries and return merged POI rows."""
        pois = []
        for q in queries:
            results = search_pois_tavily(q, category=category, location_scope=scope)
            pois.extend(results)
            time.sleep(0.5)  # gentle rate-limiting
        return pois

    def fetch_all_education_health(self, bbox: str) -> List[Dict]:
        return self._search_category(self._EDU_HEALTH_QUERIES[:6], "school")

    def fetch_all_food_shops(self, bbox: str) -> List[Dict]:
        return self._search_category(self._FOOD_SHOPS_QUERIES, "restaurant")

    def fetch_all_tourism_transport(self, bbox: str) -> List[Dict]:
        return self._search_category(self._TOURISM_TRANSPORT_QUERIES, "tourism")

    def fetch_wifi(self, bbox: str) -> List[Dict]:
        return self._search_category(self._WIFI_QUERIES, "wifi")

    def crawl_region(self, region_name: str, bbox: str) -> List[Dict]:
        """Crawl all POI categories for a region (Tavily-based replacement)."""
        all_locs = []
        all_locs.extend(self.fetch_all_education_health(bbox))
        all_locs.extend(self.fetch_all_food_shops(bbox))
        all_locs.extend(self.fetch_all_tourism_transport(bbox))
        all_locs.extend(self.fetch_wifi(bbox))
        for loc in all_locs:
            loc["location_scope"] = region_name
        print(f"  [{region_name.upper()}] Tavily crawl: {len(all_locs)} POIs")
        return all_locs

    def crawl_vietnam(self) -> List[Dict]:
        """Crawl nationwide via Tavily, walking the location expansion."""
        print(f"  [tavily_poi] crawl_years={_get_crawl_years()} | scope_order=dong_nai → southern_vn → vietnam")
        all_locations = []
        for region in ["dong_nai", "southern_vn", "vietnam"]:
            pois = self.crawl_region(region, "")
            all_locations.extend(pois)
        print(f"  [tavily_poi] nationwide total: {len(all_locations)} locations")
        return all_locations

    def get_all_locations(self) -> List[Dict]:
        return self.crawl_vietnam()


def _get_crawl_years():
    from crawl_scope import crawl_years
    return crawl_years()


def crawl_pois_markets(
    scope_bboxes: List[Tuple[str, str]],
) -> List[Dict]:
    """Crawl markets + convenience stores via Tavily for each location scope.

    Replaces the Overpass-based ``fetch_tile`` in crawl_pois_vietnam.py.
    """
    queries_by_scope = {
        "dong_nai": [
            "chợ Đồng Nai địa chỉ tọa độ",
            "chợ Biên Hòa Đồng Nai",
            "Bách hóa Xanh Đồng Nai địa chỉ",
            "chợ địa phương Bình Dương",
        ],
        "southern_vn": [
            "chợ TP Hồ Chí Minh địa chỉ",
            "chợ Cần Thơ tọa độ",
            "Bách hóa Xanh TP Hồ Chí Minh",
            "chợ địa phương miền Nam",
        ],
        "vietnam": [
            "chợ lớn Hà Nội tọa độ",
            "chợ Đông Hà địa chỉ",
            "chợ miền Trung Việt Nam",
            "Bách hóa Xanh toàn quốc",
        ],
    }

    all_pois = []
    for layer_label, bbox in scope_bboxes:
        queries = queries_by_scope.get(layer_label, queries_by_scope["vietnam"])
        for q in queries:
            results = search_pois_tavily(
                q,
                category="market" if "chợ" in q or "market" in q.lower() else "convenience",
                location_scope=layer_label,
            )
            all_pois.extend(results)
            time.sleep(0.5)
    return all_pois
