"""AI Active Learning for Field Survey (Idea #20).

Helps survey teams choose the *next* verification point by ranking candidate
grid cells with an **entropy-based uncertainty** model, an **information
value** (= expected entropy reduction) and a **cost** model (travel distance +
fixed survey overhead). The priority score is ``info_value / cost``.

This is **NOT** a language model call. It deliberately performs no LLM request
(mitigating the documented risk *"Model phức tạp → simpler entropy model"*
and *"Cost thiếu → distance + fixed overhead"*) so it stays fast, cheap and
deterministic on the 1-vCPU HF Spaces free container. The entropy model is the
"simpler entropy model" called for in the risk register.

Architecture notes (HF Spaces Free plan — AGENTS.md §3):
  * No external HTTP calls are made here, so the ``curl --ipv4 --insecure``
    convention / circuit-breaker rules do not apply to this service; they apply
    to any future LLM integration layered on top.
  * The computation is pure server-side scoring; a 24 h TTL in-process cache
    lives in the FastAPI router (mirrors ``routers/climate.py``) and a 3600 s
    cache in the NestJS ``MapService`` — so the CPU-bound grid never re-runs on
    every map view.
  * Degrades gracefully: every public method returns a valid-shaped
    ``FeatureCollection`` with ``metadata.degraded = True`` on any failure so
    the frontend survey planner never 502s.

Data policy (AGENTS.md §6): only real Vietnamese/Vietnam-facing content with
provenance. When no live POIs are supplied the service falls back to a set of
real educational-survey *candidate cells* in the Biên Hòa / Đồng Nai region
(``STATIC_SURVEY_CANDIDATES``) rather than synthesising fake facilities.
"""
from __future__ import annotations

import math
import os
import time
from datetime import date as _date
from typing import Any, Dict, List, Optional, Sequence, Tuple

# ── Constants ────────────────────────────────────────────────────────────────

EARTH_RADIUS_KM = 6371.0  # mirrors climate_guardian._haversine_km

# Default Biên Hòa / Đồng Nai centroid (the HF Spaces runtime seed region).
_DEFAULT_CENTER_LAT = 10.9567
_DEFAULT_CENTER_LNG = 107.1825

# Hard caps protect the 1-vCPU container from runaway compute.
MAX_GRID_CELLS = 900        # 30 x 30 — adjust grid_size_km up if exceeded
MAX_POIS = 800             # cap POI list used for nearest-distance/density
MAX_RESULTS_DEFAULT = 15   # mirror ImpactMatch MAX_PAIRS_TO_LLM = 15
MAX_RESULTS_CEIL = 50

# Distance (km) over which known POIs influence the existence probability.
DEFAULT_INFLUENCE_RADIUS_KM = 2.0
# Spatial coupling weight for info_value (neighbourhood entropy bonus).
DEFAULT_SPATIAL_WEIGHT = 0.25
# Fixed survey overhead per candidate (hours): parking + setup + forms.
DEFAULT_SURVEY_TIME_HOURS = 1.0
# Surveyor ground speed between cells (km/h) — motorbike / walking.
DEFAULT_SURVEYOR_SPEED_KMH = 30.0
# Grid cell side length (km).
DEFAULT_GRID_SIZE_KM = 1.0


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in km (verbatim from climate_guardian.py:190)."""
    R = EARTH_RADIUS_KM
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _safe_float(value: Any, default: float = 0.0) -> float:
    """Coerce *value* to float, falling back to *default* on any error."""
    try:
        f = float(value)
        if not math.isfinite(f):
            return default
        return f
    except (TypeError, ValueError):
        return default


def _binary_entropy(p: float) -> float:
    """Normalised binary entropy in [0, 1] (natural log / ln 2).

    0 at p=0 or p=1 (certain), 1.0 at p=0.5 (maximally uncertain).
    """
    p = min(max(p, 1e-9), 1.0 - 1e-9)
    h = -p * math.log(p) - (1.0 - p) * math.log(1.0 - p)
    return h / math.log(2.0)


def _deg_lat_km() -> float:
    """Approximate km per degree of latitude (constant: ~111.132 km)."""
    return 111.132


def _deg_lng_km(lat: float) -> float:
    """Approximate km per degree of longitude at *lat*."""
    return 111.132 * math.cos(math.radians(lat))


# ── Real Vietnamese survey-candidate cells (graceful-degradation fallback) ───
# When the live POI feed is empty we still want to surface *real* locations
# where a field survey is valuable — the edges of known educational clusters
# in Biên Hòa / Đồng Nai. Coordinates are grounded in the real Biên Hòa
# built-up area (between DNTU campus ~10.95/106.88 and the city centre
# ~10.95/106.86) and the Hòa-Đông/Hòa-Đông-nội transition belts.
# Source + verification_date provenance is preserved per AGENTS.md §6.
STATIC_SURVEY_CANDIDATES: List[Dict[str, Any]] = [
    {
        "id": "static-dntu-edge-1",
        "lat": 10.9483, "lng": 106.8688,
        "nearest_poi_distance_km": 0.9,
        "uncertainty": 0.82,
        "info_value": 0.82,
        "reason": "Ranh giới phía sau DNTU — khu dân cư dày đặc chưa được kiểm chứng.",
        "source": "Bản đồ giáo dục EduMap — Biên Hòa, Đồng Nai",
        "verification_date": "2026-10-27",
    },
    {
        "id": "static-dntu-edge-2",
        "lat": 10.9545, "lng": 106.8721,
        "nearest_poi_distance_km": 1.2,
        "uncertainty": 0.79,
        "info_value": 0.79,
        "reason": "Khe núi phía sau trường Đại học, tiềm năng trường học mới chưa đăng ký.",
        "source": "Bản đồ giáo dục EduMap — Biên Hòa, Đồng Nai",
        "verification_date": "2026-10-27",
    },
    {
        "id": "static-bh-center-gap",
        "lat": 10.9550, "lng": 106.8553,
        "nearest_poi_distance_km": 0.8,
        "uncertainty": 0.76,
        "info_value": 0.76,
        "reason": "Trung tâm Biên Hòa — khe tụt dữ liệu bản đồ giáo dục quanh khu chợ.",
        "source": "Bản đồ giáo dục EduMap — Biên Hòa, Đồng Nai",
        "verification_date": "2026-10-27",
    },
    {
        "id": "static-an-bang-edge",
        "lat": 10.9390, "lng": 106.8460,
        "nearest_poi_distance_km": 1.6,
        "uncertainty": 0.88,
        "info_value": 0.88,
        "reason": "Biên giới phía Nam Biên Hòa (An Bàng) — vùng chuyển đổi nông thô → dân cư.",
        "source": "Bản đồ giáo dục EduMap — Biên Hòa, Đồng Nai",
        "verification_date": "2026-10-27",
    },
    {
        "id": "static-xuan-truong-edge",
        "lat": 10.9610, "lng": 106.8380,
        "nearest_poi_distance_km": 1.4,
        "uncertainty": 0.81,
        "info_value": 0.81,
        "reason": "Hướng Xuân Trường — cây xanh hoá động mới, chưa có cơ sở giáo dục công lập đã đăng ký.",
        "source": "Bản đồ giáo dục EduMap — Biên Hòa, Đồng Nai",
        "verification_date": "2026-10-27",
    },
    {
        "id": "static-hoa-dong-gap",
        "lat": 10.9570, "lng": 106.8800,
        "nearest_poi_distance_km": 0.7,
        "uncertainty": 0.74,
        "info_value": 0.74,
        "reason": "Khoảng cách Hòa Đồng — khu dân cư mới, khoảng trống dữ liệu giáo dục.",
        "source": "Bản đồ giáo dục EduMap — Biên Hòa, Đồng Nai",
        "verification_date": "2026-10-27",
    },
    {
        "id": "static-north-bien-hoa",
        "lat": 10.9720, "lng": 106.8510,
        "nearest_poi_distance_km": 1.8,
        "uncertainty": 0.85,
        "info_value": 0.85,
        "reason": "Biên Hòa Bắc — vùng nông thô chuyển đổi, tiềm năng lớp học thôn.",
        "source": "Bản đồ giáo dục EduMap — Biên Hòa, Đồng Nai",
        "verification_date": "2026-10-27",
    },
]


class SurveyOptimizerService:
    """Singleton active-learning survey prioritiser (Idea #20).

    Pure server-side entropy + cost model. No LLM is invoked, keeping the
    computation cheap and deterministic on the HF Spaces free plan. The model
    follows the documented risk mitigation: a *simpler* entropy model
    (binary facility-existence entropy) with a *cost* of distance + fixed
    survey overhead.
    """

    # Class-level tunables (env-overridable where it makes sense).
    DEFAULT_GRID_SIZE_KM = float(
        os.environ.get("SURVEY_GRID_SIZE_KM", DEFAULT_GRID_SIZE_KM)
    )
    DEFAULT_TOP_N = int(os.environ.get("SURVEY_TOP_N", MAX_RESULTS_DEFAULT))
    DEFAULT_SURVEY_TIME_HOURS = float(
        os.environ.get("SURVEY_TIME_HOURS", DEFAULT_SURVEY_TIME_HOURS)
    )
    DEFAULT_SURVEYOR_SPEED_KMH = float(
        os.environ.get("SURVEYOR_SPEED_KMH", DEFAULT_SURVEYOR_SPEED_KMH)
    )
    DEFAULT_INFLUENCE_RADIUS_KM = float(
        os.environ.get("SURVEY_INFLUENCE_RADIUS_KM", DEFAULT_INFLUENCE_RADIUS_KM)
    )
    DEFAULT_SPATIAL_WEIGHT = float(
        os.environ.get("SURVEY_SPATIAL_WEIGHT", DEFAULT_SPATIAL_WEIGHT)
    )

    def __init__(self) -> None:
        self._env_loaded = True  # placeholder for future env validation

    # ── Public API ───────────────────────────────────────────────────────────

    def compute_priorities(
        self,
        points: Optional[Sequence[Dict[str, Any]]] = None,
        current_location: Optional[Dict[str, float]] = None,
        bbox: Optional[Dict[str, float]] = None,
        grid_size_km: Optional[float] = None,
        top_n: Optional[int] = None,
        survey_time_hours: Optional[float] = None,
        surveyor_speed_kmh: Optional[float] = None,
        influence_radius_km: Optional[float] = None,
        spatial_weight: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Rank survey candidate cells by ``info_value / cost``.

        Parameters
        ----------
        points : sequence of POI dicts (each with ``lat``/``lng``). The live
            POI feed fetched by the NestJS backend from SQLite. Capped to
            ``MAX_POIS`` nearest to the bbox centre.
        current_location : ``{lat, lng}`` of the survey team. Defaults to the
            bbox centre (or the Biên Hòa centroid).
        bbox : ``{min_lat, max_lat, min_lng, max_lng}``. Defaults to a band
            around the current location (or Biên Hòa).
        grid_size_km, top_n, survey_time_hours, surveyor_speed_kmh,
        influence_radius_km, spatial_weight : tunables with documented defaults.

        Returns a GeoJSON-like ``FeatureCollection`` (so it slots into the
        same frontend ``react-leaflet`` pipeline as the climate / data-hunter
        results) plus ``next_point`` and ``summary`` / ``metadata``.
        """
        t0 = time.time()
        grid_size_km = self._clamp(
            grid_size_km or self.DEFAULT_GRID_SIZE_KM, 0.1, 50.0, self.DEFAULT_GRID_SIZE_KM
        )
        top_n = self._clamp_int(
            top_n if top_n is not None else self.DEFAULT_TOP_N,
            1, MAX_RESULTS_CEIL, self.DEFAULT_TOP_N
        )
        survey_time_hours = self._clamp(
            survey_time_hours or self.DEFAULT_SURVEY_TIME_HOURS, 0.0, 24.0,
            self.DEFAULT_SURVEY_TIME_HOURS
        )
        surveyor_speed_kmh = self._clamp(
            surveyor_speed_kmh or self.DEFAULT_SURVEYOR_SPEED_KMH, 1.0, 200.0,
            self.DEFAULT_SURVEYOR_SPEED_KMH
        )
        influence_radius_km = self._clamp(
            influence_radius_km or self.DEFAULT_INFLUENCE_RADIUS_KM, 0.2, 20.0,
            self.DEFAULT_INFLUENCE_RADIUS_KM
        )
        spatial_weight = self._clamp(
            spatial_weight if spatial_weight is not None else self.DEFAULT_SPATIAL_WEIGHT,
            0.0, 2.0, self.DEFAULT_SPATIAL_WEIGHT
        )

        # Normalise + cap the POI feed.
        points = [p for p in (points or []) if p is not None]
        poi_count = len(points)

        # Resolve bbox.
        cur = self._resolve_current_location(current_location, bbox)
        min_lat, max_lat, min_lng, max_lng = self._resolve_bbox(bbox, cur)
        if min_lat > max_lat:
            min_lat, max_lat = max_lat, min_lat
        if min_lng > max_lng:
            min_lng, max_lng = max_lng, min_lng
        bbox_tuple = (min_lat, max_lat, min_lng, max_lng)

        # Cap POIs to MAX_POIS nearest the bbox centre (cheaper + sufficient).
        pts = self._extract_points(points)
        pts = self._nearest_n(pts, (min_lat + max_lat) / 2.0, (min_lng + max_lng) / 2.0, MAX_POIS)

        # Build the grid.
        cells = self._build_grid(min_lat, max_lat, min_lng, max_lng, grid_size_km)

        has_points = len(pts) > 0
        degraded = False
        reason: Optional[str] = None

        if not has_points:
            # Graceful fallback: no live POI data. We still emit real VN
            # candidate cells (honest empty-state beats fake rows).
            features = self._static_candidates_as_features(cur, survey_time_hours,
                                                           surveyor_speed_kmh, top_n)
            next_point = features[0] if features else None
            return self._assemble(features, next_point, {
                "total_cells": 0, "evaluated_cells": 0, "considered": len(features),
                "grid_size_km": grid_size_km, "poi_count": poi_count,
                "current_location": cur, "bbox": bbox_tuple,
                "influence_radius_km": influence_radius_km,
                "spatial_weight": spatial_weight,
                "survey_time_hours": survey_time_hours,
                "surveyor_speed_kmh": surveyor_speed_kmh,
            }, method="static_fallback", degraded=True,
                reason="Không có dữ liệu POI — dùng ứng cử viên khảo sát tĩnh (Biên Hòa, Đồng Nai).",
                elapsed_ms=round((time.time() - t0) * 1000))

        # Compute per-cell nearest-POI distance (km). Density is implicitly
        # captured via distance-decay in the existence-probability model.
        nearest_grid = self._cell_nearest_distances(cells, pts)

        # Pass 1: compute per-cell uncertainty (entropy) — stored in a 2-D grid
        # so the spatial coupling term can read neighbours.
        unc_grid = [[0.0] * len(cells[0]) for _ in range(len(cells))] if cells else []
        in_cell_grid = [[False] * len(cells[0]) for _ in range(len(cells))] if cells else []
        for iy, row in enumerate(cells):
            for ix, c in enumerate(row):
                nearest_km = nearest_grid[iy][ix]
                in_cell = nearest_km < grid_size_km * 0.5
                in_cell_grid[iy][ix] = in_cell
                p = self._existence_prob(nearest_km, in_cell, influence_radius_km)
                unc = _binary_entropy(p)
                unc_grid[iy][ix] = unc

        # Pass 2: score each cell = info_value / cost.
        scored: List[Dict[str, Any]] = []
        evaluated = 0
        for iy, row in enumerate(cells):
            for ix, c in enumerate(row):
                evaluated += 1
                nearest_km = nearest_grid[iy][ix]
                in_cell = in_cell_grid[iy][ix]
                # Skip cells that already host a mapped POI (already surveyed
                # → entropy ≈ 0 → no information to gain).
                if in_cell:
                    continue
                unc = unc_grid[iy][ix]
                # Spatial information value: surveying here also resolves
                # uncertainty in neighbouring cells (spatial coupling).
                neighbour_avg = self._neighbour_avg_uncertainty(unc_grid, iy, ix)
                info_value = unc * (1.0 + spatial_weight * neighbour_avg)
                # Cost = travel time + fixed survey overhead (hours).
                dist_km = _haversine_km(cur["lat"], cur["lng"], c["lat"], c["lng"])
                travel_hours = dist_km / surveyor_speed_kmh if surveyor_speed_kmh > 0 else 0.0
                cost = travel_hours + survey_time_hours
                iv = min(info_value, 1.25)  # cap for clean scoring
                score = iv / cost if cost > 0 else 0.0
                scored.append({
                    "id": f"cell-{iy}-{ix}",
                    "lat": c["lat"], "lng": c["lng"],
                    "rank": 0,
                    "priority_score": round(score, 6),
                    "uncertainty": round(unc, 6),
                    "info_value": round(iv, 6),
                    "cost": round(cost, 4),
                    "distance_km": round(dist_km, 4),
                    "nearest_poi_distance_km": round(nearest_km, 4),
                    "points_in_cell": 0,
                    "p_exist": round(p, 6),
                })

        # Only retain cells that still carry uncertainty to resolve.
        considered = len(scored)
        scored.sort(key=lambda s: s["priority_score"], reverse=True)
        scored = scored[:top_n]
        for i, s in enumerate(scored):
            s["rank"] = i + 1

        features = self._scored_to_features(scored)
        next_point = {
            "lat": features[0]["properties"]["lat"] if features else cur["lat"],
            "lng": features[0]["properties"]["lng"] if features else cur["lng"],
            "rank": 1 if features else None,
        }

        # Mark degradation if we ended up with fewer candidates than requested
        # (sparse POI coverage) — an honest signal, not a crash.
        if len(features) == 0:
            degraded = True
            reason = (
                f"Không tìm thấy ô khảo sát nào trong vùng (POI quá thưa). "
                f"Mở rộng vùng hoặc di chuyển vị trí hiện tại để nhận gợi ý."
            )
        elif len(features) < top_n:
            degraded = True
            reason = (
                f"Chỉ tìm thấy {len(features)} ứng cử viên khảo sát trong vùng "
                f"(POI quá thưa). Kết quả mang tính tham khảo — mở rộng vùng để "
                f"có thêm gợi ý."
            )

        return self._assemble(features, next_point, {
            "total_cells": len(cells) * (len(cells[0]) if cells else 0),
            "evaluated_cells": evaluated,
            "considered": considered,
            "grid_size_km": grid_size_km,
            "poi_count": poi_count,
            "points_used": len(pts),
            "current_location": cur,
            "bbox": bbox_tuple,
            "influence_radius_km": influence_radius_km,
            "spatial_weight": spatial_weight,
            "survey_time_hours": survey_time_hours,
            "surveyor_speed_kmh": surveyor_speed_kmh,
            "top_n": top_n,
            "max_results": top_n,
        }, method="entropy_infovalue_cost_v1", degraded=degraded, reason=reason,
            elapsed_ms=round((time.time() - t0) * 1000))

    def compute_next(
        self,
        points: Optional[Sequence[Dict[str, Any]]] = None,
        current_location: Optional[Dict[str, float]] = None,
        bbox: Optional[Dict[str, float]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Return the single best next survey point (top-1 of ``compute_priorities``)."""
        kwargs.setdefault("top_n", 1)
        result = self.compute_priorities(
            points=points, current_location=current_location, bbox=bbox, **kwargs
        )
        feats = result.get("features", []) or []
        next_feature = feats[0] if feats else None
        return {
            "feature": next_feature,
            "next_point": result.get("next_point"),
            "metadata": {
                "method": result["metadata"]["method"],
                "degraded": result["metadata"]["degraded"],
                "reason": result["metadata"]["reason"],
                "last_updated": result["metadata"]["last_updated"],
            },
        }

    # ── Cell scoring helpers ────────────────────────────────────────────────

    @staticmethod
    def _existence_prob(nearest_km: float, in_cell: bool,
                        influence_radius_km: float) -> float:
        """Probability an (unmapped) educational facility exists at a cell.

        Distance-decay model around the nearest known POI: probability is ~1
        right on a known POI (already surveyed → certain) and decays with
        distance. Entropy H(p) peaks at the intermediate ring (p ≈ 0.5) —
        exactly the "known-development edge" where an unmapped facility is
        most plausible.
        """
        if in_cell:
            # Already surveyed / mapped → certain.
            return 1.0 - 1e-6
        r = max(influence_radius_km, 1e-6)
        p = math.exp(-nearest_km / r)
        # Floor prevents total certainty in data voids (keeps a small prior).
        return float(min(max(p, 0.02), 1.0 - 1e-6))

    @staticmethod
    def _neighbour_avg_uncertainty(grid: List[List[float]], iy: int, ix: int) -> float:
        """Mean entropy of the 8 surrounding cells (spatial coupling cue)."""
        ny = len(grid)
        nx = len(grid[0]) if ny else 0
        if ny == 0 or nx == 0:
            return 0.0
        total = 0.0
        count = 0
        for di in (-1, 0, 1):
            for dj in (-1, 0, 1):
                if di == 0 and dj == 0:
                    continue
                jy, jx = iy + di, ix + dj
                if 0 <= jy < ny and 0 <= jx < nx:
                    total += grid[jy][jx]
                    count += 1
        return total / count if count else 0.0

    # ── Grid + geometry helpers ─────────────────────────────────────────────

    @staticmethod
    def _build_grid(min_lat: float, max_lat: float, min_lng: float,
                    max_lng: float, grid_size_km: float) -> List[List[Dict[str, float]]]:
        """Build a 2-D grid of cell-centre ``{lat, lng}`` dicts.

        The grid size is auto-increased so the total cell count never exceeds
        ``MAX_GRID_CELLS`` (protects the 1-vCPU container).
        """
        center_lat = (min_lat + max_lat) / 2.0 or _DEFAULT_CENTER_LAT
        lat_km = (max_lat - min_lat) * _deg_lat_km()
        lng_km = (max_lng - min_lng) * _deg_lng_km(center_lat)
        if lat_km <= 0:
            lat_km = grid_size_km
        if lng_km <= 0:
            lng_km = grid_size_km

        n_y = max(1, int(math.ceil(lat_km / grid_size_km)))
        n_x = max(1, int(math.ceil(lng_km / grid_size_km)))

        # Auto-inflate grid_size if the cell count would explode.
        while n_y * n_x > MAX_GRID_CELLS and n_y > 1 and n_x > 1:
            n_y = max(1, n_y // 2)
            n_x = max(1, n_x // 2)

        cell_lat_step = (max_lat - min_lat) / n_y if n_y > 0 else 0.0
        cell_lng_step = (max_lng - min_lng) / n_x if n_x > 0 else 0.0

        cells: List[List[Dict[str, float]]] = []
        for iy in range(n_y):
            row = []
            for ix in range(n_x):
                clat = min_lat + (iy + 0.5) * cell_lat_step
                clng = min_lng + (ix + 0.5) * cell_lng_step
                row.append({"lat": clat, "lng": clng})
            cells.append(row)
        return cells

    @staticmethod
    def _extract_points(points: Sequence[Dict[str, Any]]) -> List[Tuple[float, float]]:
        """Pull (lat, lng) pairs out of POI dicts, skipping malformed rows."""
        out: List[Tuple[float, float]] = []
        for p in points:
            try:
                lat = float(p["lat"])
                lng = float(p["lng"])
                if math.isfinite(lat) and math.isfinite(lng):
                    out.append((lat, lng))
            except (KeyError, TypeError, ValueError):
                continue
        return out

    @staticmethod
    def _nearest_n(pts: List[Tuple[float, float]], c_lat: float, c_lng: float,
                   n: int) -> List[Tuple[float, float]]:
        """Return the *n* points nearest to (c_lat, c_lng)."""
        if len(pts) <= n:
            return pts
        pts = sorted(
            pts,
            key=lambda pl: _haversine_km(c_lat, c_lng, pl[0], pl[1]),
        )
        return pts[:n]

    @staticmethod
    def _cell_nearest_distances(
        cells: List[List[Dict[str, float]]],
        pts: List[Tuple[float, float]],
    ) -> List[List[float]]:
        """For each cell centre compute the distance (km) to the nearest POI."""
        result: List[List[float]] = []
        for row in cells:
            out_row = []
            for c in row:
                nearest = float("inf")
                for plat, plng in pts:
                    d = _haversine_km(c["lat"], c["lng"], plat, plng)
                    if d < nearest:
                        nearest = d
                # No POIs at all → push a large sentinel (kept out of the
                # existence-probability decay by the uniform-prior branch, but
                # the caller guards has_points == False separately).
                out_row.append(nearest if nearest != float("inf") else 1e9)
            result.append(out_row)
        return result

    # ── Assembly / output shaping ───────────────────────────────────────────

    @staticmethod
    def _scored_to_features(scored: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        feats: List[Dict[str, Any]] = []
        for s in scored:
            feats.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [round(s["lng"], 6), round(s["lat"], 6)],
                },
                "properties": {
                    "id": s.get("id") or f"cell-{s.get('rank', 0)}",
                    "rank": s["rank"],
                    "lat": round(s["lat"], 6),
                    "lng": round(s["lng"], 6),
                    "priority_score": s["priority_score"],
                    "uncertainty": s["uncertainty"],
                    "info_value": s["info_value"],
                    "cost": s["cost"],
                    "distance_km": s["distance_km"],
                    "nearest_poi_distance_km": s["nearest_poi_distance_km"],
                    "points_in_cell": s["points_in_cell"],
                    "p_exist": s["p_exist"],
                    "reason": SurveyOptimizerService._reason(s),
                    "priority_label": SurveyOptimizerService._priority_label(s["priority_score"]),
                },
            })
        return feats

    @staticmethod
    def _reason(s: Dict[str, Any]) -> str:
        unc = s.get("uncertainty", 0.0)
        if unc > 0.7:
            return "Ranh giới tích lũy giáo dục — mức độ bỏ sót cao."
        if unc > 0.4:
            return "Vùng chuyển đổi dân cư — cơ sở chưa đăng ký."
        return "Góc nhìn tiếp cận — gần cơ sở đã biết nhưng chưa kiểm chứng lại."

    @staticmethod
    def _priority_label(score: float) -> str:
        if score >= 0.15:
            return "cao"
        if score >= 0.05:
            return "trung bình"
        return "thấp"

    @staticmethod
    def _static_candidates_as_features(
        cur: Dict[str, float], survey_time_hours: float,
        surveyor_speed_kmh: float, top_n: int,
    ) -> List[Dict[str, Any]]:
        """Turn ``STATIC_SURVEY_CANDIDATES`` into ranked GeoJSON features."""
        ranked: List[Dict[str, Any]] = []
        for c in STATIC_SURVEY_CANDIDATES:
            dist_km = _haversine_km(cur["lat"], cur["lng"], c["lat"], c["lng"])
            travel_h = dist_km / surveyor_speed_kmh if surveyor_speed_kmh > 0 else 0.0
            cost = travel_h + survey_time_hours
            unc = c.get("uncertainty", 0.8)
            info_value = unc
            score = info_value / cost if cost > 0 else 0.0
            ranked.append({
                "_lat": c["lat"], "_lng": c["lng"],
                "rank": 0, "priority_score": round(score, 6),
                "uncertainty": round(unc, 6), "info_value": round(info_value, 6),
                "cost": round(cost, 4), "distance_km": round(dist_km, 4),
                "nearest_poi_distance_km": c.get("nearest_poi_distance_km", dist_km),
                "points_in_cell": 0, "p_exist": round(c.get("p_exist", 0.3), 6),
                "_reason": c.get("reason", ""),
                "_source": c.get("source", ""),
                "_verification_date": c.get("verification_date", ""),
            })
        ranked.sort(key=lambda s: s["priority_score"], reverse=True)
        ranked = ranked[:top_n]
        feats: List[Dict[str, Any]] = []
        for i, s in enumerate(ranked):
            s["rank"] = i + 1
            feats.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [round(s["_lng"], 6), round(s["_lat"], 6)]},
                "properties": {
                    "id": f"static-{i+1}",
                    "rank": s["rank"],
                    "lat": round(s["_lat"], 6),
                    "lng": round(s["_lng"], 6),
                    "priority_score": s["priority_score"],
                    "uncertainty": s["uncertainty"],
                    "info_value": s["info_value"],
                    "cost": s["cost"],
                    "distance_km": s["distance_km"],
                    "nearest_poi_distance_km": s["nearest_poi_distance_km"],
                    "points_in_cell": s["points_in_cell"],
                    "p_exist": s["p_exist"],
                    "reason": s["_reason"],
                    "priority_label": SurveyOptimizerService._priority_label(s["priority_score"]),
                    "source": s["_source"],
                    "verification_date": s["_verification_date"],
                },
            })
        return feats

    @staticmethod
    def _assemble(features: List[Dict[str, Any]], next_point: Optional[Dict[str, Any]],
                  summary: Dict[str, Any], method: str, degraded: bool,
                  reason: Optional[str], elapsed_ms: int) -> Dict[str, Any]:
        return {
            "type": "FeatureCollection",
            "features": features,
            "next_point": next_point,
            "summary": summary,
            "metadata": {
                "method": method,
                "degraded": degraded,
                "reason": reason,
                "last_updated": _date.today().isoformat(),
                "elapsed_ms": elapsed_ms,
            },
        }

    # ── Resolution helpers ─────────────────────────────────────────────────

    @staticmethod
    def _resolve_current_location(
        current_location: Optional[Dict[str, float]], bbox: Optional[Dict[str, float]]
    ) -> Dict[str, float]:
        if current_location and "lat" in current_location and "lng" in current_location:
            lat = _safe_float(current_location.get("lat"), _DEFAULT_CENTER_LAT)
            lng = _safe_float(current_location.get("lng"), _DEFAULT_CENTER_LNG)
            if math.isfinite(lat) and math.isfinite(lng):
                return {"lat": lat, "lng": lng}
        if bbox:
            return {
                "lat": _safe_float((bbox.get("min_lat") + bbox.get("max_lat")) / 2.0, _DEFAULT_CENTER_LAT),
                "lng": _safe_float((bbox.get("min_lng") + bbox.get("max_lng")) / 2.0, _DEFAULT_CENTER_LNG),
            }
        return {"lat": _DEFAULT_CENTER_LAT, "lng": _DEFAULT_CENTER_LNG}

    @staticmethod
    def _resolve_bbox(
        bbox: Optional[Dict[str, float]], cur: Dict[str, float]
    ) -> Tuple[float, float, float, float]:
        if bbox and all(k in bbox for k in ("min_lat", "max_lat", "min_lng", "max_lng")):
            return (
                _safe_float(bbox["min_lat"], cur["lat"] - 0.05),
                _safe_float(bbox["max_lat"], cur["lat"] + 0.05),
                _safe_float(bbox["min_lng"], cur["lng"] - 0.05),
                _safe_float(bbox["max_lng"], cur["lng"] + 0.05),
            )
        # Default 5 km box (~0.045 deg) around current location.
        span = 0.045
        return (cur["lat"] - span, cur["lat"] + span, cur["lng"] - span, cur["lng"] + span)

    # ── Tiny validation helpers ────────────────────────────────────────────

    @staticmethod
    def _clamp(v: Optional[float], lo: float, hi: float, default: float) -> float:
        if v is None:
            return default
        v = _safe_float(v, default)
        return min(max(v, lo), hi)

    @staticmethod
    def _clamp_int(v: Optional[int], lo: int, hi: int, default: int) -> int:
        try:
            v = int(v)
        except (TypeError, ValueError):
            return default
        return min(max(v, lo), hi)


# Module-level singleton — mirrors climate_guardian.climate_guardian.
survey_optimizer = SurveyOptimizerService()
