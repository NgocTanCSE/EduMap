# -*- coding: utf-8 -*-
"""
OpenDataCrawler – fetches datasets from the Vietnam Open Data portal (data.gov.vn).
It supports automatic detection of CSV/JSON resources and basic normalization of fields
(name, address, lat, lng, category). Missing coordinates are optionally geocoded via
Nominatim (subject to rate limits).
"""

import os
import csv
import json
import time
import requests
from typing import List, Dict, Any
from urllib.parse import quote_plus

# Load optional proxy configuration from environment (e.g., http://proxy:8080)
PROXY_URL = os.getenv("PROXY_URL")
PROXIES = {"http": PROXY_URL, "https": PROXY_URL} if PROXY_URL else None

# Simple Nominatim geocoder for fallback (rate‑limited to 1 req/s)
def _geocode(address: str) -> Dict[str, float]:
    """Geocode an address using Nominatim. Returns a dict with lat/lng (0.0 if failed)."""
    try:
        resp = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": address, "format": "json", "limit": 1},
            headers={"User-Agent": "EduMapCrawler/1.0"},
            proxies=PROXIES,
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        if data:
            return {"lat": float(data[0]["lat"]), "lng": float(data[0]["lon"]) }
    except Exception:
        pass
    # Respect Nominatim rate‑limit even on failure
    time.sleep(1)
    return {"lat": 0.0, "lng": 0.0}

class OpenDataCrawler:
    """Fetches dataset metadata and resources from data.gov.vn (OpenData Vietnam)."""

    BASE_API = "https://data.gov.vn/api/3/action/package_show?id="

    def __init__(self):
        self.session = requests.Session()
        if PROXIES:
            self.session.proxies.update(PROXIES)
        self.session.headers.update({"User-Agent": "EduMapCrawler/1.0"})

    def _download_resource(self, url: str) -> bytes:
        """Download a resource (CSV/JSON) and return raw bytes."""
        resp = self.session.get(url, timeout=30)
        resp.raise_for_status()
        return resp.content

    def _parse_csv(self, content: bytes) -> List[Dict[str, Any]]:
        """Parse CSV content into list of dicts (UTF‑8)."""
        text = content.decode("utf-8", errors="ignore")
        reader = csv.DictReader(text.splitlines())
        return list(reader)

    def _parse_json(self, content: bytes) -> List[Dict[str, Any]]:
        """Parse JSON content – expect list or dict with "records" key."""
        data = json.loads(content)
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and "records" in data:
            return data["records"]
        return []

    def _normalize_record(self, rec: Dict[str, Any], default_category: str) -> Dict[str, Any]:
        """Transform raw record into unified schema.
        Expected keys (case‑insensitive): name, tên, title → name
        address, địa chỉ → address
        latitude, lat → lat; longitude, lng → lng
        """
        def _get(keys):
            for k in keys:
                if k in rec and rec[k]:
                    return rec[k]
            return None
        name = _get(["name", "Tên", "title", "Tên cơ sở"])
        address = _get(["address", "địa chỉ", "location", "Address"])
        lat = _get(["lat", "latitude", "latitud", "latituded"])
        lng = _get(["lng", "longitude", "longitud", "longituded"])
        # Convert to float if possible
        try:
            lat = float(lat) if lat is not None else None
        except Exception:
            lat = None
        try:
            lng = float(lng) if lng is not None else None
        except Exception:
            lng = None
        # If missing coordinates, attempt geocode (slow)
        if (lat is None or lng is None) and address:
            geo = _geocode(address)
            lat = geo.get("lat")
            lng = geo.get("lng")
        return {
            "name": name or "",
            "address": address or "",
            "lat": lat or 0.0,
            "lng": lng or 0.0,
            "category": default_category,
        }

    def fetch_dataset(self, dataset_id: str, default_category: str = "poi") -> List[Dict[str, Any]]:
        """Fetch a dataset by its id (slug) and return a list of normalized locations.
        The function looks for the first CSV or JSON resource.
        """
        url = self.BASE_API + quote_plus(dataset_id)
        resp = self.session.get(url, timeout=15)
        resp.raise_for_status()
        pkg = resp.json().get("result", {})
        resources = pkg.get("resources", [])
        locations: List[Dict[str, Any]] = []
        for res in resources:
            fmt = res.get("format", "").lower()
            if fmt not in ("csv", "json"):
                continue
            try:
                raw = self._download_resource(res["url"])
                if fmt == "csv":
                    records = self._parse_csv(raw)
                else:
                    records = self._parse_json(raw)
                for rec in records:
                    loc = self._normalize_record(rec, default_category)
                    if loc["name"]:
                        locations.append(loc)
            except Exception as e:
                # Continue with next resource if one fails
                print(f"[OpenDataCrawler] Failed resource {res.get('url')}: {e}")
            # Stop after first successful resource to avoid duplicate imports
            if locations:
                break
        return locations
