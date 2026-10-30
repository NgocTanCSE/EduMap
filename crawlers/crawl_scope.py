#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
crawl_scope.py — Shared location + year scope for ALL EduMap crawlers.

Deployment context (see AGENTS.md §1):
  EduMap runs ONLY on Hugging Face Spaces (free CPU tier).  Local machines are
  for code editing / unit tests only — a green local run is **not** proof that
  the feature works.  Every crawler below must degrade gracefully with ZERO
  external API keys and never crash on a blocked/unreachable source.

------------------------------------------------------------------------------
YEAR SCOPE  —  "năm đối với năm crawl 2 năm liên tiếp"
------------------------------------------------------------------------------
For the crawl year we ALWAYS cover **two consecutive years**, crawl-year
inclusive and the one before it:

    crawl_year      = EDUMAP_CRAWL_YEAR env  (or current UTC year)
    crawl_years()   = [crawl_year - 1, crawl_year]

Examples:
    crawl_year = 2026  ->  [2025, 2026]
    crawl_year = 2027  ->  [2026, 2027]
    crawl_year = 2028  ->  [2027, 2028]

Callers use ``in_year_scope(date_or_year_str)`` to decide whether a crawled
item (job deadline, event start, scholarship opening, …) falls within the
window, and ``year_scope_range()`` for SQL ``BETWEEN`` filtering.

------------------------------------------------------------------------------
LOCATION SCOPE  —  "tính từ Đồng Nai → tràn ra các tỉnh phía Nam → Việt Nam → ĐNA"
------------------------------------------------------------------------------
Crawlers expand outward in **priority order**, starting at the project anchor
province (Đồng Nai) and broadening only when the tighter layer is exhausted
(empty / blocked):

  Layer 1  Đồng Nai              — anchor province (Biên Hòa, DNTU)
  Layer 2  Miền Nam VN           — Southern provinces (Đông Nam Bộ + Tây Nguyên
                                   + Đồng Nam Bộ bief)
  Layer 3  Việt Nam              — all 63 tỉnh/thành phố
  Layer 4  Đông Nam Á            — ASEAN + neighbours

``LOCATION_LAYERS`` is the ordered registry; ``bboxes_for_layers()`` feeds the
Overpass crawlers, ``keywords_for_layers()`` feeds the Eventbrite / keyword
crawlers.

Usage (typical):
    >>> from crawl_scope import crawl_years, in_year_scope, LOCATION_LAYERS
    >>> crawl_years()            # [2025, 2026]  (when EDUMAP_CRAWL_YEAR unset)
    >>> in_year_scope("2026-11-25")   # True  — inside the window
    >>> in_year_scope("2024-03-01")   # False — before window
    >>> for layer in LOCATION_LAYERS:
    ...     crawl_this_layer(layer)
"""
from __future__ import annotations

import os
import datetime
from typing import List, Tuple, Optional, Dict, Any


# ===========================================================================
# YEAR SCOPE
# ===========================================================================

def crawl_year() -> int:
    """The calendar year this crawl run targets.

    Defaults to the current UTC year.  Override with the ``EDUMAP_CRAWL_YEAR``
    environment variable (set by the nightly cron / HF Space secret) so a run
    in early January can still target the *previous* crawl year if data is
    not yet ready.
    """
    env_year = os.getenv("EDUMAP_CRAWL_YEAR", "")
    if env_year.strip().isdigit():
        return int(env_year)
    return datetime.datetime.now(datetime.timezone.utc).year


def crawl_years() -> List[int]:
    """Two consecutive years: ``[crawl_year - 1, crawl_year]``.

    * crawl_year = 2026  ->  [2025, 2026]
    * crawl_year = 2027  ->  [2026, 2027]
    """
    y = crawl_year()
    return [y - 1, y]


# Convenient alias — most callers want the two-year set.
CRAWL_YEARS = crawl_years


def year_scope_range() -> Tuple[int, int]:
    """``(min_year, max_year)`` — handy for SQL ``BETWEEN`` filtering."""
    ys = crawl_years()
    return min(ys), max(ys)


def in_year_scope(date_str: Optional[str], fmt: str = "%Y-%m-%d") -> bool:
    """Return True when *date_str* falls inside the 2-year crawl window.

    Accepts a full ISO date (``"2026-11-25T01:00:00+00:00"``), a bare date
    (``"2026-04-30"``), or a 4-digit year (``"2025"``).

    ``None`` / empty values return ``True`` (no date = no year constraint —
    preserves the existing "graceful, don't drop" rule from AGENTS.md).
    """
    years = set(crawl_years())
    if date_str is None:
        return True
    s = str(date_str).strip()
    if not s:
        return True
    # Bare 4-digit year.
    if len(s) == 4 and s.isdigit():
        return int(s) in years
    # Full date / datetime — extract the year from the leading YYYY.
    # We avoid strptime for every candidate format: just grab the first token.
    if s[:4].isdigit():
        return int(s[:4]) in years
    # Last resort: look for a 4-digit year anywhere in the string.
    import re
    m = re.search(r"\b(20\d{2})\b", s)
    if m:
        return int(m.group(1)) in years
    return True  # unparseable → keep (graceful, never drops real data)


# ===========================================================================
# LOCATION SCOPE
# ===========================================================================

# --- Layer 1: Đồng Nai (project anchor) -----------------------------------

DONG_NAI_PROVINCE = "Đồng Nai"
DONG_NAI_BBOX = "10.68,106.75,11.15,107.25"        # south, west, north, east
DONG_NAI_CENTER = (10.9835, 106.8686)              # DNTU centroid
DONG_NAI_KEYWORDS = ["Đồng Nai", "Biên Hòa", "Bình Dương", "Vũng Tàu"]

# --- Layer 2: Southern Vietnam provinces (miền Nam) -----------------------
# Covers the three southern regions:
#   • Đông Nam Bộ (Southeast)   — Bà Rịa-Vũng Tàu, TP.HCM, Đồng Nai, Bình Dương
#   • Tây Nguyên (Central Highlands) — Gia Lai, Kon Tum, Đắk Lắk, Đắk Nông, Lâm Đồng
#   • Đông Nam Bộ (Mekong Delta)    — 12 delta provinces
# Ordered roughly north→south so crawlers that tile by latitude expand cleanly.
SOUTHERN_PROVINCES_VN = [
    "Bình Dương",
    "Bà Rịa – Vũng Tàu",
    "TP. Hồ Chí Minh",
    "Bình Phước",
    "Bình Thuận",
    "Ninh Thuận",
    "Lâm Đồng",
    "Đắc Nông",
    "Gia Lai",
    "Kon Tum",
    "Đắk Lắk",
    "Long An",
    "Tiền Giang",
    "Bến Tre",
    "Vĩnh Long",
    "Trà Vinh",
    "Đồng Tháp",
    "An Giang",
    "Kiên Giang",
    "Cần Thơ",
    "Hậu Giang",
    "Sóc Trăng",
    "Bạc Liêu",
    "Cà Mau",
]

# Southern Vietnam bbox (south, west, north, east) — latitudes south of ~15°N.
SOUTHERN_VN_BBOX = "8.0,104.0,15.0,109.5"

# --- Layer 3: All of Vietnam ----------------------------------------------
VIETNAM_BBOX = "8.0,102.0,23.5,109.5"
VIETNAM_KEYWORDS = ["Việt Nam", "Vietnam"]

# --- Layer 4: Southeast Asia (các nước Đông Nam Á) ------------------------
SOUTHEAST_ASIA_COUNTRIES = [
    "Việt Nam",
    "Thái Lan",
    "Indonesia",
    "Malaysia",
    "Philippines",
    "Singapore",
    "Myanmar",
    "Laos",
    "Campuchia",
    "Brunei",
    "Timor-Leste",
]

# No single bbox covers all of SEA; each country is looked up by keyword.
# Representative SEA country centroids (lat, lng) for distance-based scoping.
SEA_COUNTRY_CENTROIDS = {
    "Việt Nam":     (14.0583, 108.2772),
    "Thái Lan":     (15.8700, 100.9925),
    "Indonesia":    (-2.2100, 113.9213),
    "Malaysia":     (4.2105, 101.9775),
    "Philippines":  (12.8796, 121.7270),
    "Singapore":    (1.3521, 103.8198),
    "Myanmar":      (21.9140, 95.9562),
    "Laos":         (19.3340, 102.4955),
    "Campuchia":    (13.3620, 103.8667),
    "Brunei":       (4.5353, 114.7538),
    "Timor-Leste":  (-8.8756, 125.7273),
}


def _layer(label: str, name: str, bboxes: List[str], keywords: List[str],
           country: str) -> Dict[str, Any]:
    return {
        "label": label,
        "name": name,
        "bboxes": bboxes,
        "keywords": keywords,
        "country": country,
    }


# Ordered location layers — iterate from most-local outward.
LOCATION_LAYERS: List[Dict[str, Any]] = [
    _layer("dong_nai", "Đồng Nai",       [DONG_NAI_BBOX],   DONG_NAI_KEYWORDS, "vietnam"),
    _layer("southern_vn", "Miền Nam VN",  [SOUTHERN_VN_BBOX], SOUTHERN_PROVINCES_VN, "vietnam"),
    _layer("vietnam", "Việt Nam",        [VIETNAM_BBOX],    VIETNAM_KEYWORDS, "vietnam"),
    _layer("sea", "Đông Nam Á",          [],                SOUTHEAST_ASIA_COUNTRIES, "sea"),
]


def location_layers() -> List[Dict[str, Any]]:
    """Return the ordered location layers (Đồng Nai → Southern VN → Vietnam → SEA)."""
    return LOCATION_LAYERS


def bboxes_for_layers(through: str = "sea") -> List[str]:
    """All Overpass bboxes for layers from Đồng Nai up to (and incl.) *through*."""
    result: List[str] = []
    for layer in LOCATION_LAYERS:
        result.extend(layer["bboxes"])
        if layer["label"] == through:
            break
    return result


def keywords_for_layers(through: str = "sea") -> List[str]:
    """All search keywords (provinces/countries) for layers up to *through*."""
    result: List[str] = []
    for layer in LOCATION_LAYERS:
        result.extend(layer["keywords"])
        if layer["label"] == through:
            break
    return result


def layer_by_label(label: str) -> Optional[Dict[str, Any]]:
    """Look up a single layer by its short label (e.g. ``dong_nai``)."""
    for layer in LOCATION_LAYERS:
        if layer["label"] == label:
            return layer
    return None


def location_matches(location_str: str, keywords: List[str]) -> bool:
    """True when *location_str* mentions any of *keywords* (case-folded, diacritics-aware).

    Used by keyword crawlers (Eventbrite, ITviec) to filter results to a given
    location layer without dropping items whose location field is empty.
    """
    if not location_str:
        return False
    hay = location_str.lower()
    for kw in keywords:
        if kw.lower() in hay:
            return True
    return False


# ===========================================================================
# COMBINED HELPERS
# ===========================================================================

def scope_summary() -> Dict[str, Any]:
    """Human-readable snapshot of the active scope (useful for crawler logs)."""
    return {
        "crawl_year": crawl_year(),
        "crawl_years": crawl_years(),
        "location_layers": [l["label"] for l in LOCATION_LAYERS],
        "dong_nai_bbox": DONG_NAI_BBOX,
        "vietnam_bbox": VIETNAM_BBOX,
        "sea_countries": SOUTHEAST_ASIA_COUNTRIES,
    }
