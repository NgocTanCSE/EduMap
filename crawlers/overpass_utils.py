#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Stdlib-only Overpass helper (urllib — NO `requests`/`psycopg2` dependency).

Why stdlib-only: crawlers/green_spaces_crawler.py, schools_crawler.py and
wifi_crawler.py are run by the *manual* nationwide aggregation pipeline
(aggregator.py -> combine_dongnai.py) which ships a leaner environment. They
must not pull in psycopg2 just to do an Overpass HTTP POST.

Reused by: green_spaces_crawler (parks), schools_crawler (schools),
           wifi_crawler (wifi/cafe spots). crawl_pois_vietnam.py keeps its own
grid+dedup logic but can adopt overpass_query() in Phase G.
"""
import json
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen

OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.ru/api/interpreter",
]

DEFAULT_TIMEOUT = 180
DEFAULT_RETRIES = 3
RATE_DELAY = 1.5  # be polite to public Overpass instances (1 req / 1.5s)


def overpass_query(bbox, ql, timeout=DEFAULT_TIMEOUT, retries=DEFAULT_RETRIES,
                   delay=RATE_DELAY, label="overpass"):
    """Run an Overpass QL query (POST) and return the `elements` list.

    Args:
        bbox: "south,west,north,east"
        ql: overpass QL (the body, after [out:json][timeout:...];). e.g.
            '(node["leisure"="park"](BBOX); way["leisure"="park"](BBOX);); out center;'
            The token BBOX is replaced by `bbox`.
        Returns: list of element dicts; [] on total failure (graceful).
    """
    query = ql.replace("BBOX", bbox)
    full = f"[out:json][timeout:{timeout}];{query}"
    last_err = None
    for attempt in range(retries):
        url = OVERPASS_MIRRORS[attempt % len(OVERPASS_MIRRORS)]
        try:
            data = urlencode({"data": full}).encode("utf-8")
            req = Request(url, data=data,
                          headers={"User-Agent": "EduMap/1.0 (overpass_utils)",
                                   "Accept": "application/json"})
            with urlopen(req, timeout=timeout) as resp:
                out = json.loads(resp.read().decode("utf-8", errors="replace"))
            time.sleep(delay)
            return out.get("elements", [])
        except Exception as e:           # 429 / 504 / timeout / parse error
            last_err = e
            print(f"  [{label}] overpass mirror {url} failed (attempt {attempt+1}/{retries}): {e}")
            time.sleep(RATE_DELAY * (attempt + 1))
    print(f"  [{label}] overpass_query FAILED after {retries} retries — graceful (0 elements)")
    return []


def overpass_post(query, mirrors, timeout=DEFAULT_TIMEOUT, retries=DEFAULT_RETRIES,
                  delay=RATE_DELAY, user_agent="EduMap/1.0 (overpass_utils)",
                  label="overpass_post"):
    """POST a *fully-built* Overpass QL query string (incl. [out:json] directive)
    to one of `mirrors`, returning the raw JSON dict.

    This is the low-level sibling of `overpass_query`: instead of taking a
    `bbox`+`ql` template it accepts the exact query text the caller built
    (e.g. with a custom [timeout:..] and `out meta;`). Used by
    crawlers/green_spaces_crawler.py and scripts/crawl_pois_vietnam.py so they
    share ONE Overpass HTTP client (mirror rotation + retry/backoff + graceful
    {} on total failure).
    """
    last_err = None
    for attempt in range(retries):
        url = mirrors[attempt % len(mirrors)]
        try:
            req = Request(url, data=query.encode("utf-8"),
                          headers={"Content-Type": "application/x-www-form-urlencoded",
                                   "Accept": "application/json",
                                   "User-Agent": user_agent})
            with urlopen(req, timeout=timeout + 5) as resp:
                return json.loads(resp.read().decode("utf-8", errors="replace"))
        except Exception as e:           # 429 / 504 / timeout / parse error
            last_err = e
            print(f"  [{label}] mirror {url} failed (attempt {attempt+1}/{retries}): {e}")
            time.sleep(RATE_DELAY * (attempt + 1))
    print(f"  [{label}] overpass_post FAILED after {retries} retries — graceful (empty result)")
    return {"elements": [], "_overpass_post_last_err": str(last_err)}


def center(el):
    """Return (lat, lng) for an OSM element (node: lat/lon; way/relation: center)."""
    if "lat" in el and "lon" in el:
        return el["lat"], el["lon"]
    c = el.get("center") or {}
    return c.get("lat"), c.get("lon")


def name_of(el):
    tags = el.get("tags") or {}
    return (tags.get("name") or tags.get("alt_name") or "").strip()
