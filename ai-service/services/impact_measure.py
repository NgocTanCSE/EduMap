
from __future__ import annotations

import json
import math
import os
import time
from datetime import date as _date, datetime
from typing import Any, Dict, List, Optional, Tuple




try:
    from services.llm_service import LLMService
except Exception:
    LLMService = None




SQLITE_PATH = os.getenv("DB_SQLITE_PATH", "/app/frontend/public/edumap.db")


SQLITE_PATH = (
    os.getenv("DB_SQLITE_PATH")
    or os.getenv("SQLITE_DATABASE_URL")
    or "/app/frontend/public/edumap.db"
)





POP_DENSITY_PER_KM2 = float(os.getenv("IMPACT_POP_DENSITY", "350"))




SYNTHETIC_BEFORE_ACCESS_RATE = 0.70



EDU_TYPE_NAMES = {
    1: "university",
    2: "school",
    3: "library",
    4: "bookstore",
    5: "lab",
    6: "wifi",
    7: "green",
    8: "cafe",
    10: "restaurant",
    11: "convenience",
}



DEFAULT_EDU_ACCESS_TYPES = {"wifi", "library", "school", "university", "lab"}


ACCESS_RADIUS_KM = 5.0



GRID_STEP_DEG = 0.01




USAGE_PER_FACILITY = {"wifi": 30, "library": 25, "school": 0, "university": 0, "lab": 20}



W_COVERAGE = 0.45
W_ACCESS = 0.35
W_USAGE = 0.20


CI_LEVEL = 0.95
CI_Z = 1.96


_CACHE_TTL = 24 * 3600




def _sqlite_path() -> Optional[str]:
    """Return the SQLite file used by the backend when in SQLite mode."""
    if os.getenv("DB_TYPE", "sqlite").lower() != "sqlite":
        return None
    path = SQLITE_PATH
    if path and os.path.exists(path):
        return path

    candidate = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "frontend", "public", "edumap.db",
    )
    return candidate if os.path.exists(candidate) else None


def _query_sqlite(sql: str, params: Optional[Tuple] = None) -> List[Dict[str, Any]]:
    """Run a read-only SQLite query and return rows as dicts. Never raises."""
    path = _sqlite_path()
    if not path:
        return []
    import sqlite3
    conn = None
    try:
        conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True, timeout=8)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute(sql, params or ())
        return [dict(r) for r in cur.fetchall()]
    except Exception:
        return []
    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass




def _parse_coords(value: Any) -> Optional[Tuple[float, float]]:
    """Parse coordinates from GeoJSON JSON string/dict/array/EWKT → (lng, lat)."""
    if value is None:
        return None
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (json.JSONDecodeError, TypeError):
            if "POINT" in value.upper():
                try:
                    coords = value.split("POINT(")[1].rstrip(")").split()
                    return float(coords[0]), float(coords[1])
                except Exception:
                    return None
            return None
    if isinstance(value, dict):
        coords = value.get("coordinates")
        if isinstance(coords, list) and len(coords) >= 2:
            return float(coords[0]), float(coords[1])
        if "lat" in value and "lng" in value:
            return float(value["lng"]), float(value["lat"])
    if isinstance(value, (list, tuple)):
        if len(value) >= 2:
            try:
                return float(value[0]), float(value[1])
            except (ValueError, TypeError):
                return None
    return None


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in km."""
    R = 6371.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def _bbox_area_km2(min_lat: float, max_lat: float, min_lng: float, max_lng: float) -> float:
    """Approximate bbox area in km² (spherical rectangle)."""
    lat_span = abs(max_lat - min_lat)
    lng_span = abs(max_lng - min_lng)

    mid_lat = math.radians((min_lat + max_lat) / 2.0)
    return lat_span * lng_span * (111.32 ** 2) * math.cos(mid_lat)


def _polygon_overlaps_bbox(polygon: List[List[float]],
                            bbox: Tuple[float, float, float, float]) -> bool:
    min_lat, max_lat, min_lng, max_lng = bbox
    for lng, lat in polygon:
        if min_lat <= lat <= max_lat and min_lng <= lng <= max_lng:
            return True
    return False




def _grid_cells(min_lat: float, max_lat: float,
                min_lng: float, max_lng: float,
                step: float = GRID_STEP_DEG) -> List[Tuple[float, float]]:
    """Return cell centroids covering the bbox at `step` resolution."""
    lats = [min_lat + i * step for i in range(0, max(1, int((max_lat - min_lat) / step)) + 1)]
    lngs = [min_lng + j * step for j in range(0, max(1, int((max_lng - min_lng) / step)) + 1)]
    cells: List[Tuple[float, float]] = []
    for i in range(len(lats) - 1):
        for j in range(len(lngs) - 1):
            clat = (lats[i] + lats[i + 1]) / 2.0
            clng = (lngs[j] + lngs[j + 1]) / 2.0
            cells.append((clat, clng))
    if not cells:

        cells.append(((min_lat + max_lat) / 2.0, (min_lng + max_lng) / 2.0))
    return cells


def _cell_step_for(bbox_area_km2: float) -> float:
    """Pick a grid step so a ~5 km access radius covers a handful of cells.

    Keeps the cell count bounded (~a few thousand) on the 1-vCPU free plan.
    """
    if bbox_area_km2 <= 0:
        return GRID_STEP_DEG

    side_km = math.sqrt(max(bbox_area_km2, 0.1))
    target_side_cells = 50
    step_km = max(side_km / target_side_cells, 0.5)

    return max(0.004, min(GRID_STEP_DEG, step_km / 111.32))




def _resolve_access_types(requested: Optional[List[str]]) -> set:
    if not requested:
        return set(DEFAULT_EDU_ACCESS_TYPES)
    names = set(t.lower() for t in requested)
    return names


def _load_facilities(bbox: Tuple[float, float, float, float],
                     access_types: set) -> List[Dict[str, Any]]:
    """Load educational facilities within the bbox from SQLite ``map_points``.

    Each facility: {id, name, category, lat, lng, created_at, type_id}.
    Only facilities whose type maps to an *access* category are returned.
    """
    min_lat, max_lat, min_lng, max_lng = bbox
    rows = _query_sqlite(
        "SELECT id, name, type_id, location, created_at, status "
        "FROM map_points LIMIT 5000"
    )
    facilities: List[Dict[str, Any]] = []
    for r in rows:
        coords = _parse_coords(r.get("location"))
        if not coords:
            continue
        lng, lat = coords
        if not (min_lat <= lat <= max_lat and min_lng <= lng <= max_lng):
            continue
        type_id = r.get("type_id")
        try:
            type_id = int(type_id)
        except (TypeError, ValueError):
            continue
        category = EDU_TYPE_NAMES.get(type_id, "other")
        if category not in access_types:
            continue
        created = r.get("created_at") or ""
        facilities.append({
            "id": str(r.get("id")),
            "name": r.get("name") or "",
            "category": category,
            "lat": lat,
            "lng": lng,
            "type_id": type_id,
            "created_at": created,
        })
    return facilities


def _facilities_before_after(facilities: List[Dict[str, Any]],
                              cutoff_iso: Optional[str]
                              ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Split facilities into (before, after) by ``created_at`` and cutoff.

    If ``cutoff_iso`` is None, fall back to the median created_at so the
    split is still meaningful (roughly half the facilities pre-date the
    median). Facilities with an unparseable/empty created_at are treated as
    "before" only if no cutoff is given (they form the persistent baseline).
    """
    cutoff = _parse_iso_date(cutoff_iso)

    if cutoff is None:

        dates = [_parse_iso_date(f.get("created_at")) for f in facilities]
        dates = [d for d in dates if d is not None]
        if dates:
            dates.sort()
            cutoff = dates[len(dates) // 2]

    before: List[Dict[str, Any]] = []
    after: List[Dict[str, Any]] = []
    for f in facilities:
        fdate = _parse_iso_date(f.get("created_at"))
        if cutoff is not None and fdate is not None:
            if fdate < cutoff:
                before.append(f)
            else:
                after.append(f)
        elif cutoff is None:


            after.append(f)
        else:


            before.append(f)
    return before, after


def _parse_iso_date(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(str(value)[:19].split("+")[0], fmt)
        except (ValueError, TypeError):
            continue
    try:
        return datetime.fromisoformat(str(value)[:10])
    except Exception:
        return None




def _nearest_facility_within(cells: List[Tuple[float, float]],
                             facilities: List[Dict[str, Any]],
                             radius_km: float) -> List[bool]:
    """For each cell, whether a facility lies within ``radius_km``."""
    if not facilities:
        return [False] * len(cells)
    flags: List[bool] = []
    for clat, clng in cells:
        ok = False
        for f in facilities:
            if _haversine_km(clat, clng, f["lat"], f["lng"]) <= radius_km:
                ok = True
                break
        flags.append(ok)
    return flags


def _wilson_interval(successes: int, total: int,
                     z: float = CI_Z) -> Tuple[float, float]:
    """Wilson score 95 % confidence interval for a proportion.

    Conservative for small samples / extreme rates (returns [0,0] when
    total=0). Used for the access_rate CI.
    """
    if total <= 0:
        return 0.0, 0.0
    n = total
    p = successes / n
    denom = 1.0 + z * z / n
    center = (p + z * z / (2 * n)) / denom
    margin = (z * math.sqrt((p * (1 - p) + z * z / (4 * n)) / n)) / denom
    lo = max(0.0, center - margin)
    hi = min(1.0, center + margin)
    return lo, hi


def _linear_growth_rate(points: List[Tuple[int, float]]) -> float:
    """Least-squares slope of (x, y) points expressed as %/step.

    Returns 0.0 for <2 points. Used for the trend growth rate.
    """
    n = len(points)
    if n < 2:
        return 0.0
    xs = [float(p[0]) for p in points]
    ys = [p[1] for p in points]
    mx = sum(xs) / n
    my = sum(ys) / n
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    den = sum((x - mx) ** 2 for x in xs)
    if den == 0:
        return 0.0
    slope = num / den

    if my == 0:
        return 0.0
    return (slope / my) * 100.0





_REFUSAL_MARKERS = (
    "tôi không thể", "tôi xin lỗi", "xin lỗi", "không thể hỗ trợ",
    "không được phép", "illegal", "i'm sorry", "i cannot",
    "i can't", "as an ai", "tôi là một mô hình ngôn ngữ",
    "vi phạm", "bất hợp pháp", "tôi không thể cung cấp",
)


def _is_informative_narrative(text: str) -> bool:
    """Return True only if the LLM produced a substantive narrative.

    Rejects refusals, safety blocks, and trivially short / empty output so the
    caller can fall back to the template narrative.
    """
    if not text or not text.strip():
        return False
    low = text.lower()
    if any(m in low for m in _REFUSAL_MARKERS):
        return False
    if len(text.strip()) < 40:
        return False
    return True




_CACHE: Dict[str, Tuple[float, Dict[str, Any]]] = {}


def _cache_get(key: str) -> Optional[Dict[str, Any]]:
    entry = _CACHE.get(key)
    if not entry:
        return None
    expiry, value = entry
    if time.time() > expiry:
        _CACHE.pop(key, None)
        return None
    return value


def _cache_set(key: str, value: Dict[str, Any]) -> None:
    _CACHE[key] = (time.time() + _CACHE_TTL, value)




class ImpactMeasurementService:
    """Singleton-style service for AI Impact Measurement (Idea #19).

    Mirrors ``climate_guardian.py`` / ``predictive_service.py`` patterns:
    SQLite data source, 24 h in-process cache, graceful degradation, and an
    LLM narrative with template fallback.
    """

    def __init__(self, llm: Optional[LLMService] = None):
        self._llm = llm

    def _llm_ready(self) -> bool:
        if self._llm is None:
            try:
                from services.llm_service import llm_service
                self._llm = llm_service
            except Exception:
                return False
        return bool(getattr(self._llm, "is_ready", False))

    def _resolve_bbox(self, request: Any) -> Tuple[float, float, float, float]:
        """Resolve (min_lat, max_lat, min_lng, max_lng) from the request."""
        if all(getattr(request, f) is not None for f in ("min_lat", "max_lat", "min_lng", "max_lng")):
            mn_lat, mx_lat = min(request.min_lat, request.max_lat), max(request.min_lat, request.max_lat)
            mn_lng, mx_lng = min(request.min_lng, request.max_lng), max(request.min_lng, request.max_lng)
            return (mn_lat, mx_lat, mn_lng, mx_lng)
        if getattr(request, "lat", None) is not None and getattr(request, "lng", None) is not None:
            r = getattr(request, "radius_km", 15.0)
            d = r / 111.0
            return (request.lat - d, request.lat + d, request.lng - d, request.lng + d)





        return (10.9, 11.0, 106.8, 107.0)

    def measure(self, request: Any) -> Dict[str, Any]:
        """Compute the full impact-measurement report for a region.

        ``request`` is a pydantic ``ImpactMeasureRequest`` (or any object with
        the same attributes). Returns a dict matching
        ``ImpactMeasureResponse``.
        """
        bbox = self._resolve_bbox(request)
        cache_key = self._cache_key(bbox, request)
        cached = _cache_get(cache_key)
        if cached is not None:
            cached = dict(cached)
            cached["metadata"] = {**cached.get("metadata", {}), "cached": True}
            return cached

        min_lat, max_lat, min_lng, max_lng = bbox
        area_km2 = _bbox_area_km2(min_lat, max_lat, min_lng, max_lng)
        step = _cell_step_for(area_km2)
        cells = _grid_cells(min_lat, max_lat, min_lng, max_lng, step)
        population = int(area_km2 * POP_DENSITY_PER_KM2)

        population = min(population, 2_000_000)

        access_types = _resolve_access_types(getattr(request, "facility_types", None))
        facilities = _load_facilities(bbox, access_types)

        degraded = False
        reason: Optional[str] = None
        if not facilities:
            degraded = True

        before, after = _facilities_before_after(facilities, request.deployment_date)
        synthetic_before = len(before) == 0


        n_cells = len(cells)
        before_flags = _nearest_facility_within(cells, before, ACCESS_RADIUS_KM)
        after_flags = _nearest_facility_within(cells, after, ACCESS_RADIUS_KM)
        access_after = sum(after_flags) / max(n_cells, 1)
        if synthetic_before:

            access_before = SYNTHETIC_BEFORE_ACCESS_RATE
            before_user_count = int(population * access_before)
            degraded = True
        else:
            access_before = sum(before_flags) / max(n_cells, 1)
            before_user_count = int(population * access_before)

        after_user_count = int(population * access_after)


        def usage_of(facil: List[Dict[str, Any]]) -> int:
            total = 0
            for f in facil:
                total += int(USAGE_PER_FACILITY.get(f["category"], 0))
            return max(total, len(facil))

        usage_before = usage_of(before)
        usage_after = usage_of(after)

        access_delta = after_user_count - before_user_count
        cover_imp = ((access_after - access_before) / access_before * 100.0) if access_before > 0 else 0.0

        before_metrics = {
            "period": "trước triển khai",
            "access_rate": round(access_before, 4),
            "user_count": before_user_count,
            "facility_count": len(before),
            "usage_count": usage_before,
            "synthetic_baseline": synthetic_before,
        }
        after_metrics = {
            "period": "sau triển khai",
            "access_rate": round(access_after, 4),
            "user_count": after_user_count,
            "facility_count": len(after),
            "usage_count": usage_after,
            "synthetic_baseline": False,
        }


        monthly = self._trend_monthly(facilities, before, after, cutoff=before_metrics["period"])
        growth_pct = self._trend_growth(monthly)


        score = self._impact_score(cover_imp, access_before, access_after, usage_before, usage_after)


        ci_lo, ci_hi = _wilson_interval(int(round(access_after * n_cells)), max(n_cells, 1))

        if synthetic_before:
            ci_lo = max(0.0, ci_lo - 0.05)
            ci_hi = min(1.0, ci_hi + 0.10)
            ci_method = "wilson_score+synthetic_baseline_widen"
        else:
            ci_method = "wilson_score"

        score_ci_half = (ci_hi - ci_lo) / 2.0 * 100.0
        score_ci = {
            "lower": round(max(0.0, score - score_ci_half), 1),
            "upper": round(min(100.0, score + score_ci_half), 1),
            "level": CI_LEVEL,
            "method": ci_method,
        }


        causal_notes = self._causal_notes(synthetic_before, len(before), len(after))


        narrative = self._narrative(
            before_metrics, after_metrics, cover_imp, access_delta,
            score, growth_pct, synthetic_before, degraded,
        )

        result = {
            "region": request.region or "Biên Hòa, Đồng Nai",
            "bbox": [round(min_lat, 5), round(max_lat, 5), round(min_lng, 5), round(max_lng, 5)],
            "population_estimate": population,
            "before": before_metrics,
            "after": after_metrics,
            "diff": {
                "access_rate_delta": round(access_after - access_before, 4),
                "user_count_delta": access_delta,
                "usage_count_delta": usage_after - usage_before,
                "coverage_improvement_pct": round(cover_imp, 2),
            },
            "people_in_radius": {
                "before": before_user_count,
                "after": after_user_count,
                "delta": access_delta,
                "radius_km": ACCESS_RADIUS_KM,
            },
            "trend": {
                "monthly": monthly,
                "growth_rate_pct": round(growth_pct, 2),
                "trend": self._trend_label(growth_pct),
            },
            "impact_score": round(score, 1),
            "confidence_interval": score_ci,
            "causal_notes": causal_notes,
            "narrative": narrative,
            "degraded": degraded,
            "reason": reason,
            "metadata": {
                "method": "impact_measure_v1",
                "data_source": "sqlite_map_points",
                "facilities_loaded": len(facilities),
                "before_count": len(before),
                "after_count": len(after),
                "synthetic_baseline": synthetic_before,
                "grid_cells": n_cells,
                "grid_step_deg": round(step, 5),
                "pop_density_per_km2": POP_DENSITY_PER_KM2,
                "access_types": sorted(access_types),
                "deployment_date": request.deployment_date or None,
                "last_updated": datetime.now().isoformat(),
            },
        }

        _cache_set(cache_key, result)
        return result



    def _cache_key(self, bbox: Tuple[float, float, float, float], request: Any) -> str:
        lats = f"{bbox[0]:.4f}:{bbox[1]:.4f}:{bbox[2]:.4f}:{bbox[3]:.4f}"
        dep = (request.deployment_date or "") if hasattr(request, "deployment_date") else ""
        types = "_".join(sorted(getattr(request, "facility_types", None) or []))
        return f"impact:{lats}:{dep}:{types}"



    @staticmethod
    def _trend_monthly(facilities: List[Dict[str, Any]],
                       before: List[Dict[str, Any]], after: List[Dict[str, Any]],
                       cutoff: str) -> List[Dict[str, Any]]:
        """Monthly deployment timeline: facilities added per month + cumulative.

        Only counts facilities that have a parseable created_at. Months with
        zero additions are omitted from the timeline (sparse data is flagged
        in metadata).
        """
        months: Dict[str, int] = {}
        for f in facilities:
            d = _parse_iso_date(f.get("created_at"))
            if d is None:
                continue
            key = d.strftime("%Y-%m")
            months[key] = months.get(key, 0) + 1
        monthly: List[Dict[str, Any]] = []
        cumulative = 0
        for key in sorted(months.keys()):
            cumulative += months[key]
            monthly.append({"month": key, "facilities_added": months[key], "cumulative": cumulative})
        return monthly

    @staticmethod
    def _trend_growth(monthly: List[Dict[str, Any]]) -> float:
        """Linear growth rate (%/month) from the cumulative timeline."""
        if len(monthly) < 2:
            return 0.0
        points = [(i, float(m["cumulative"])) for i, m in enumerate(monthly)]
        return _linear_growth_rate(points)

    @staticmethod
    def _trend_label(growth_pct: float) -> str:
        if growth_pct > 5:
            return "tăng"
        if growth_pct < -5:
            return "giảm"
        return "ổn định"



    @staticmethod
    def _impact_score(cover_imp_pct: float,
                      access_before: float, access_after: float,
                      usage_before: int, usage_after: int) -> float:
        """Weighted composite impact score ∈ [0, 100].

        coverage_improvement (capped to [0,1]) is the dominant signal;
        access-rate gain and usage growth are normalised and blended.
        """
        cover = max(0.0, min(1.0, cover_imp_pct / 100.0))
        access_gain = max(0.0, min(1.0, (access_after - access_before) / max(access_before, 0.01)))


        denom = max(usage_before, usage_after, 1)
        usage_gain = max(0.0, min(1.0, (usage_after - usage_before) / denom))
        score = W_COVERAGE * cover * 100.0 + W_ACCESS * access_gain * 100.0 + W_USAGE * usage_gain * 100.0
        return max(0.0, min(100.0, score))



    @staticmethod
    @staticmethod
    def _causal_notes(synthetic_before: bool, before_n: int, after_n: int) -> List[str]:
        notes: List[str] = []
        notes.append(
            "Yếu tố nhầm lẫn (confounding): khác biệt truy cập có thể do tăng dân "
            "số, thay đổi dân cư, hoặc các triển khai khác cùng thời gian — "
            "không phải duy nhất do triển khai này."
        )
        notes.append(
            "Để khẳng định nguyên nhân gây ra hiệu quả, đề xuất nghiên cứu RCT "
            "(Randomized Controlled Trial) — ngẫu nhiên hoá khu vực/triển khai, "
            "so sánh nhóm kiểm soát vs nhóm thử nghiệm."
        )
        return notes



    def _narrative(self, before, after, cover_imp, user_delta,
                   score: float, growth_pct: float, synthetic_before: bool,
                   degraded: bool) -> str:
        """Build a short human-readable impact narrative.

        Uses the LLM provider cascade when available (temperature=0.3, like
        rank_impact_matches) and falls back to a deterministic template so the
        dashboard always has a coherent explanation — never a 502.
        """
        payload = {
            "before": before,
            "after": after,
            "coverage_improvement_pct": round(cover_imp, 2),
            "user_count_delta": user_delta,
            "impact_score": round(score, 1),
            "growth_rate_pct": round(growth_pct, 2),
            "synthetic_baseline": synthetic_before,
            "degraded": degraded,
        }
        if self._llm_ready():
            try:
                prompt = self._narrative_prompt(payload)
                text = self._llm._generate_text_with_fallback(
                    prompt, temperature=0.3, max_tokens=512, top_p=0.8
                )
                if text and _is_informative_narrative(text):
                    return text.strip()[:1500]
            except Exception:
                pass
        return self._narrative_template(payload)

    @staticmethod
    def _narrative_prompt(payload: dict) -> str:
        return f"""Bạn là chuyên gia đo lường tác động giáo dục tại Việt Nam. Hãy viết một đoạn tóm tắt ngắn (3-5 câu, tiếng Việt) về hiệu quả triển khai dựa trên số liệu sau.

- Trước: access_rate={payload['before']['access_rate']}, user_count={payload['before']['user_count']}, facilities={payload['before']['facility_count']}
- Sau: access_rate={payload['after']['access_rate']}, user_count={payload['after']['user_count']}, facilities={payload['after']['facility_count']}
- Cải thiện phủ sóng: {payload['coverage_improvement_pct']}%, người được tiếp cận tăng {payload['user_count_delta']}
- Điểm tác động: {payload['impact_score']}/100, tốc độ tăng trưởng: {payload['growth_rate_pct']}%/tháng

Hãy ghi chú ngắn gọn hạn chế của causal inference và đề xuất RCT. Giữ ngắn gọn và chỉ ra con số chính."""

    @staticmethod
    def _narrative_template(payload: dict) -> str:
        b = payload["before"]
        a = payload["after"]
        b_access_rate = b["access_rate"]
        a_access_rate = a["access_rate"]
        b_user_count = b["user_count"]
        a_user_count = a["user_count"]
        b_facility_count = b["facility_count"]
        a_facility_count = a["facility_count"]
        cover_pct = payload["coverage_improvement_pct"]
        user_delta = payload["user_count_delta"]
        impact_score = payload["impact_score"]
        growth_rate = payload.get("growth_rate_pct")
        if growth_rate:
            growth_clause = f" với tốc độ tăng trưởng {growth_rate:.1f}%/tháng"
        else:
            growth_clause = ""
        facility_delta = a_facility_count - b_facility_count
        return (
            f"Sau triển khai, tỉ lệ tiếp cận tăng từ {b_access_rate:.1%} lên "
            f"{a_access_rate:.1%} (+{cover_pct:.1f}%), "
            f"số người được tiếp cận tăng {user_delta:+d} "
            f"(từ {b_user_count} → {a_user_count}). "
            f"Số cơ sở giáo dục phục vụ tăng {facility_delta:+d} "
            f"(từ {b_facility_count} → {a_facility_count}). "
            f"Điểm tác động AI đo đạt {impact_score}/100{growth_clause}. "
            "Lưu ý: causal inference có hạn — nên triển khai RCT để khẳng định nguyên nhân."
        )



impact_measure = ImpactMeasurementService()
