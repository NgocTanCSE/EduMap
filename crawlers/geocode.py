import json
import math
import os
import socket
import time
from typing import Optional, Tuple
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

NOMINATIM_URL = os.getenv("NOMINATIM_URL", "https://nominatim.openstreetmap.org").rstrip("/")
GEOCODE_ENABLED = os.getenv("GEOCODE_ENABLED", "true").strip().lower() == "true"
GEOCODE_TIMEOUT = float(os.getenv("GEOCODE_TIMEOUT_SECONDS", "12"))
GEOCODE_MIN_INTERVAL = float(os.getenv("GEOCODE_MIN_INTERVAL_SECONDS", "1.1"))
GEOCODE_CACHE_PATH = os.getenv("GEOCODE_CACHE_PATH", "/tmp/edumap_geocode_cache.json")
GEOCODE_MAX_PER_RUN = int(os.getenv("GEOCODE_MAX_PER_RUN", "150"))
GEOCODE_MAX_DISTANCE_KM = float(os.getenv("GEOCODE_MAX_DISTANCE_KM", "15"))
GEOCODE_REQUIRE = os.getenv("GEOCODE_REQUIRE", "false").strip().lower() == "true"

_USER_AGENT = "EduMapCrawler/1.0 (+https://edumap.vn; contact admin@edumap.vn)"

_force_ipv4_done = False


def _force_ipv4() -> None:
    """Prefer AF_INET — the deploy host blackholes IPv6 egress (AGENTS.md §3)."""
    global _force_ipv4_done
    if _force_ipv4_done:
        return
    _orig = socket.getaddrinfo

    def _ipv4_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
        return _orig(host, port, socket.AF_INET, type, proto, flags)

    socket.getaddrinfo = _ipv4_getaddrinfo
    _force_ipv4_done = True


def _load_cache() -> dict:
    try:
        with open(GEOCODE_CACHE_PATH, encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def _save_cache(cache: dict) -> None:
    try:
        directory = os.path.dirname(GEOCODE_CACHE_PATH)
        if directory:
            os.makedirs(directory, exist_ok=True)
        with open(GEOCODE_CACHE_PATH, "w", encoding="utf-8") as fh:
            json.dump(cache, fh, ensure_ascii=False)
    except OSError:
        pass


_CACHE = _load_cache()
_LAST_CALL = 0.0
_CALLS = 0


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    )
    return 2 * r * math.asin(math.sqrt(min(1.0, a)))


def _throttle() -> None:
    global _LAST_CALL
    elapsed = time.time() - _LAST_CALL
    if elapsed < GEOCODE_MIN_INTERVAL:
        time.sleep(GEOCODE_MIN_INTERVAL - elapsed)
    _LAST_CALL = time.time()


def geocode(query: str, country: str = "vn") -> Optional[Tuple[float, float]]:
    """Resolve an address to ``(lat, lng)`` via Nominatim.

    Returns ``None`` when geocoding is disabled, the budget for this run is
    exhausted, or the address cannot be resolved. Result ``(0, 0)`` is never
    returned — an unresolved address stays unresolved instead of pinning a POI
    at the Gulf of Guinea.
    """
    global _CALLS
    if not GEOCODE_ENABLED or not query or len(query.strip()) < 6:
        return None
    key = query.strip().lower()[:200]
    cached = _CACHE.get(key)
    if cached:
        try:
            return float(cached[0]), float(cached[1])
        except (TypeError, ValueError, IndexError):
            pass
    if _CALLS >= GEOCODE_MAX_PER_RUN:
        return None

    _force_ipv4()
    params = urlencode({"q": query.strip(), "format": "jsonv2", "limit": 1, "countrycodes": country})
    req = Request(f"{NOMINATIM_URL}/search?{params}", headers={
        "User-Agent": _USER_AGENT,
        "Accept": "application/json",
    })
    _throttle()
    _CALLS += 1
    try:
        with urlopen(req, timeout=GEOCODE_TIMEOUT) as resp:
            payload = json.loads(resp.read().decode("utf-8", errors="replace") or "[]")
    except (HTTPError, URLError, socket.timeout, OSError, ValueError):
        return None
    if not isinstance(payload, list) or not payload:
        _CACHE[key] = None
        return None
    try:
        lat = float(payload[0]["lat"])
        lng = float(payload[0]["lon"])
    except (KeyError, TypeError, ValueError):
        return None
    if not (8.0 <= lat <= 24.0 and 102.0 <= lng <= 109.6):
        return None
    _CACHE[key] = [lat, lng]
    if len(_CACHE) > 5000:
        _save_cache(_CACHE)
    return lat, lng


def flush_cache() -> None:
    _save_cache(_CACHE)


def verify_or_replace(
    address: str,
    lat: Optional[float],
    lng: Optional[float],
    max_distance_km: Optional[float] = None,
) -> Optional[Tuple[float, float, str]]:
    """Anchor a POI on its address instead of on a regex-scraped coordinate.

    Returns ``(lat, lng, source)`` where ``source`` is ``"geocode"`` (address
    resolved — authoritative) or ``"text"`` (no address match, the original
    coordinate is kept because it is at least plausible), or ``None`` when the
    row must be dropped (no address match **and** the scraped coordinate is
    implausibly far from the address we could resolve).
    """
    max_km = GEOCODE_MAX_DISTANCE_KM if max_distance_km is None else max_distance_km
    resolved = geocode(address) if address else None
    if resolved:
        g_lat, g_lng = resolved
        if lat is not None and lng is not None:
            if haversine_km(lat, lng, g_lat, g_lng) > max_km:
                return g_lat, g_lng, "geocode"
        return g_lat, g_lng, "geocode"
    if lat is None or lng is None:
        return None
    if GEOCODE_REQUIRE:
        return None
    return lat, lng, "text"