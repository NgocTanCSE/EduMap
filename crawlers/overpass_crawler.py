# -*- coding: utf-8 -*-
"""
OverpassCrawler → **renamed** to TavilyCrawler (compat shim keeps the class name).

Deployment context (see AGENTS.md §1):
  EduMap runs ONLY on Hugging Face Spaces (free CPU tier).  The Overpass API
  (https://overpass-api.de) is **blocked on HF Spaces egress**, so the original
  overpass_crawler.py returned 0 POIs every night.  This module is a drop-in
  replacement: the ``OverpassCrawler`` class name is preserved so that
  ``crawlers/aggregator.py`` (which imports it) works unchanged; the internals
  now use Tavily Search + Extract via ``crawlers/tavily_poi.py``.

  When TAVILY_API_KEY is absent or Tavily is unreachable, the crawler returns
  ``[]`` — the curated snapshots in schools_crawler / wifi_crawler /
  green_spaces_crawler fill the gaps (AGENTS.md §6 honest-empty-state rule).
"""
import os
import sys
import time
from typing import List, Dict, Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from crawl_scope import (  # noqa: E402
    crawl_years, year_scope_range, in_year_scope,
    LOCATION_LAYERS, DONG_NAI_BBOX, SOUTHERN_VN_BBOX, VIETNAM_BBOX,
)
from tavily_poi import TavilyPoiClient  # noqa: E402

# 2 consecutive years (e.g. 2026 -> [2025, 2026])
_CRAWL_YEARS = crawl_years()
_YEAR_MIN, _YEAR_MAX = year_scope_range()

# Vietnam regions — reordered so SOUTH (incl. Đồng Nai) is crawled first, then
# northward, matching the location expansion: Đồng Nai → miền Nam → VN.
VIETNAM_REGIONS = {
    "dong_nai": DONG_NAI_BBOX,
    "southern_vn": SOUTHERN_VN_BBOX,
    "south": "8.0,104.0,11.5,107.5",
    "south_central": "11.0,105.0,14.0,109.0",
    "central": "14.0,105.0,17.0,109.0",
    "north_central": "17.0,104.0,20.5,107.0",
    "north": "20.5,102.0,23.5,106.5",
}
SCOPE_ORDER = ["dong_nai", "southern_vn", "south", "south_central",
               "central", "north_central", "north"]
VIETNAM_FULL = VIETNAM_BBOX


def _respect_rate_limit(last_ts: float, min_delay: float = 1.0) -> float:
    """Ensure minimum delay between Tavily requests."""
    now = time.time()
    elapsed = now - last_ts
    if elapsed < min_delay:
        time.sleep(min_delay - elapsed)
    return time.time()


class OverpassCrawler:
    """Nationwide Vietnam crawler — **Tavily-based** (Overpass API is blocked on HF).

    The class name ``OverpassCrawler`` is preserved for backward compatibility
    with ``crawlers/aggregator.py`` which imports it.  Internally it delegates
    to ``TavilyPoiClient`` which uses the Tavily Search + Extract API
    (https://api.tavily.com — reachable from HF Spaces egress).
    """

    def __init__(self, proxy_url: str = None):
        self._client = TavilyPoiClient()
        self._last_ts = 0.0
        print(f"  [overpass→tavily] TavilyPoiClient ready "
              f"(configured={self._client.client.is_configured()})")

    def _get_url(self) -> str:
        """Kept for compatibility (no longer used — Tavily is a single endpoint)."""
        return "https://api.tavily.com/search"

    def fetch(self, query: str) -> List[Dict[str, Any]]:
        """Search Tavily for one query and return normalized locations.
        Kept as a low-level compatibility method.
        """
        self._last_ts = _respect_rate_limit(self._last_ts)
        results = self._client._search_category([query], "poi")
        return results

    # ------------------------------------------------------------------
    # Category fetchers (same method names as the Overpass version)      #
    # ------------------------------------------------------------------

    def fetch_all_education_health(self, bbox: str) -> List[Dict[str, Any]]:
        """Fetch education + health POIs via Tavily (schools, libraries, hospitals)."""
        self._last_ts = _respect_rate_limit(self._last_ts)
        return self._client.fetch_all_education_health(bbox)

    def fetch_all_food_shops(self, bbox: str) -> List[Dict[str, Any]]:
        """Fetch food/drink + shops via Tavily (markets, restaurants, cafés)."""
        self._last_ts = _respect_rate_limit(self._last_ts)
        return self._client.fetch_all_food_shops(bbox)

    def fetch_all_tourism_transport(self, bbox: str) -> List[Dict[str, Any]]:
        """Fetch tourism + transport + public services via Tavily."""
        self._last_ts = _respect_rate_limit(self._last_ts)
        return self._client.fetch_all_tourism_transport(bbox)

    def fetch_wifi(self, bbox: str) -> List[Dict[str, Any]]:
        """Fetch WiFi hotspots via Tavily."""
        self._last_ts = _respect_rate_limit(self._last_ts)
        return self._client.fetch_wifi(bbox)

    # ------------------------------------------------------------------
    # Nationwide crawl (same interface as the Overpass version)         #
    # ------------------------------------------------------------------

    tile_size: float = 0.5  # kept for compatibility; Tavily doesn't tile.

    def _iter_tiles(self, bbox: str, size: float = None) -> List[str]:
        """Kept for compatibility — returns a single tile (Tavily uses search, not tiles)."""
        return ["placeholder"]

    def _fetch_tiled(self, query_fn, bbox: str, label: str) -> List[Dict]:
        """Kept for compatibility — calls query_fn(bbox) directly (no tiling)."""
        return query_fn(bbox)

    def _crawl_region(self, region_name: str, bbox: str) -> List[Dict]:
        """Crawl all categories for a single region via Tavily.

        Tags each element with its ``location_scope`` matching the region name.
        """
        print(f"\n  [{region_name.upper()}] bbox={bbox}")
        all_locs = []
        all_locs.extend(self.fetch_all_education_health(bbox))
        all_locs.extend(self.fetch_all_food_shops(bbox))
        all_locs.extend(self.fetch_all_tourism_transport(bbox))
        all_locs.extend(self.fetch_wifi(bbox))

        for loc in all_locs:
            loc["location_scope"] = region_name

        print(f"  Region total: {len(all_locs)}")
        return all_locs

    def crawl_vietnam(self) -> List[Dict[str, Any]]:
        """Crawl all of Vietnam by regions, walking the location expansion
        (Đồng Nai → miền Nam → southern → central → northern).

        Uses Tavily Search + Extract (Overpass API is blocked on HF Spaces).
        """
        all_locations = []
        print(f"  [scope] crawl_years={_CRAWL_YEARS} | scope_order={SCOPE_ORDER}")

        for region_name in SCOPE_ORDER:
            bbox = VIETNAM_REGIONS.get(region_name)
            if not bbox:
                continue
            print(f"\n{'='*60}")
            print(f"Crawling region: {region_name.upper()} (scope layer)")
            print(f"{'='*60}")
            region_data = self._crawl_region(region_name, bbox)
            all_locations.extend(region_data)

        # Summary
        print(f"\n{'='*60}")
        print("NATIONWIDE SUMMARY (Tavily)")
        print(f"{'='*60}")
        print(f"  Total locations: {len(all_locations)}")
        from collections import Counter
        layer_counts = Counter(l.get("location_scope", "unknown") for l in all_locations)
        print(f"  Per-layer: {dict(layer_counts)}")
        print(f"  [scope] crawl_years: {crawl_years()}")
        return all_locations

    def get_all_locations(self) -> List[Dict[str, Any]]:
        """Crawl nationwide and return flat list of all locations."""
        return self.crawl_vietnam()
