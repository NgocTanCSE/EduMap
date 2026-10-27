"""Predictive service — synced with analytics.py's Holt's Linear forecasting.

Previously this module used static `return {}` for market trends and if-else
keyword matching for career prediction. Now it delegates to the same
Holt's Linear Exponential Smoothing (alpha=0.3, beta=0.1) and data-loading
layer that analytics.py uses, so the /api/ai/predictive/* endpoints produce
forecasts consistent with /api/ai/analytics/stats and /api/ai/analytics/forecast.
"""

import os
import re
import json
from datetime import date as _date
from typing import List, Dict, Any, Optional
from collections import Counter, defaultdict

class PredictiveService:
    def __init__(self):
        self.db_host = os.getenv("DB_HOST", "localhost")
        self.db_port = os.getenv("DB_PORT", "5432")
        self.db_name = os.getenv("DB_DATABASE", "edumap_db")
        self.db_user = os.getenv("DB_USERNAME", "admin")
        self.db_password = os.getenv("DB_PASSWORD", "password123")

    # ────────────────── Data access (synced with analytics.py) ──────────────────

    def _load_education_stats(self) -> List[Dict[str, Any]]:
        """Load education_stats rows from PostgreSQL or SQLite fallback.

        Delegates to analytics._load_education_stats() so both modules read
        from the same data source — consistent in HF Spaces (SQLite) and
        production (PostgreSQL) modes.
        """
        try:
            from routers.analytics import _load_education_stats
            return _load_education_stats()
        except Exception as e:
            print(f"PredictiveService._load_education_stats error: {e}")
            return []

    def _load_active_job_skills(self) -> List[str]:
        """Load required_skills from active job postings (SQLite fallback)."""
        try:
            from routers.analytics import _query_sqlite, _parse_skills
            jobs = _query_sqlite(
                "SELECT required_skills FROM jobs WHERE status = 'active'"
            )
            skills: List[str] = []
            for job in jobs:
                skills.extend(_parse_skills(job.get("required_skills")))
            return skills
        except Exception:
            return []

    def _forecast(self, years: List[int], values: List[float],
                  steps_ahead: int = 3, alpha: float = 0.3, beta: float = 0.1
                  ) -> List[float]:
        """Holt's Linear Exponential Smoothing (delegates to analytics.py).

        Uses the exact same double exponential smoothing implementation
        (alpha=0.3, beta=0.1) as analytics._holt_linear_forecast() so
        predictive endpoints stay in sync with the analytics/forecast endpoints.
        """
        from routers.analytics import _holt_linear_forecast
        return _holt_linear_forecast(years, values, steps_ahead=steps_ahead, alpha=alpha, beta=beta)

    def _build_sectors(self, stats: List[Dict[str, Any]]
                       ) -> List[Dict[str, Any]]:
        """Group stats by metric_type and aggregate per year (delegates to analytics.py)."""
        from routers.analytics import _build_sectors
        return _build_sectors(stats)

    # ────────────────── Public API ──────────────────

    def analyze_trends(self, recent_logs: List[Dict]) -> List[Dict]:
        """Analyze market trends using actual time-series data with Holt's forecasting.

        Previously: keyword counting only (if-else style).
        Now synced with analytics.py: loads real education_stats data and
        applies Holt's Linear Exponential Smoothing to identify growing sectors.
        Also retains keyword-frequency analysis from recent_logs for backward compat.
        """
        # 1. Time-series analysis from real data (synced with analytics.py)
        stats = self._load_education_stats()
        sectors = self._build_sectors(stats) if stats else []

        trend_results: List[Dict[str, Any]] = []
        for sector in sectors:
            points = sector.get("historical", [])
            if len(points) >= 2:
                years = [p["year"] for p in points]
                values = [p["metric_value"] for p in points]
                fc = self._forecast(years, values, steps_ahead=1)
                forecast_val = fc[-1] if fc else points[-1]["metric_value"]
                trend_results.append({
                    "name": sector["name"],
                    "score": round(forecast_val, 2),
                    "growth_pct": round(sector.get("growth_pct", 0), 2),
                    "latest_value": round(sector.get("latest_value", 0), 2),
                    "forecast_value": round(forecast_val, 2),
                    "method": "holt_linear_exponential_smoothing",
                })
            elif points:
                trend_results.append({
                    "name": sector["name"],
                    "score": round(points[-1]["metric_value"], 2),
                    "growth_pct": round(sector.get("growth_pct", 0), 2),
                    "latest_value": round(points[-1]["metric_value"], 2),
                    "forecast_value": round(points[-1]["metric_value"], 2),
                    "method": "insufficient_data",
                })

        # 2. Keyword-based analysis from recent_logs (backward-compatible)
        if recent_logs:
            keyword_counts: Dict[str, int] = {}
            for log in recent_logs:
                kw = log.get('keyword', '')
                if kw and isinstance(kw, str):
                    keyword_counts[kw.lower()] = keyword_counts.get(kw.lower(), 0) + 1
            sorted_trends = sorted(keyword_counts.items(), key=lambda x: x[1], reverse=True)
            for kw, count in sorted_trends[:5]:
                # Avoid duplicating sectors already found via time-series
                if not any(t["name"].lower() == kw.lower() for t in trend_results):
                    trend_results.append({
                        "name": kw,
                        "score": count,
                        "growth_pct": 0,
                        "method": "keyword_frequency",
                    })

        # Sort by score descending, return top results
        trend_results.sort(key=lambda t: t.get("score", 0), reverse=True)
        return trend_results[:10]

    def predict_career_path(self, user_history: List[str],
                            steps_ahead: int = 3) -> Dict[str, Any]:
        """Predict career paths using Holt's time-series forecasting.

        Replaces the previous if-else keyword-matching approach with
        data-driven trend analysis:

        1. Loads education_stats and applies Holt's Linear Exponential
           Smoothing (alpha=0.3, beta=0.1) — synced with analytics.py.
        2. Cross-references forecasted sector growth with the user's
           skills/interests to recommend high-demand career paths.
        3. Returns a structured prediction with match scores, growth rates,
           and missing-skill recommendations.
        """
        if not user_history:
            return {
                "status": "no_input",
                "recommendations": [],
                "message": "Hãy cung cấp kỹ năng/hoạt động để nhận đề xuất lộ trình phù hợp.",
            }

        history_lower = [h.lower().strip() for h in user_history if h and str(h).strip()]
        if not history_lower:
            return {
                "status": "no_input",
                "recommendations": [],
                "message": "Hãy cung cấp kỹ năng/hoạt động để nhận đề xuất lộ trình phù hợp.",
            }

        stats = self._load_education_stats()
        job_skills = self._load_active_job_skills()
        sectors = self._build_sectors(stats) if stats else []

        # Skill-to-sector mapping: which education metrics relate to which skills
        skill_sector_map: Dict[str, List[str]] = {
            "python": ["Stem Lab Usage", "Online Learning Adoption"],
            "javascript": ["Online Learning Adoption"],
            "web": ["Online Learning Adoption"],
            "data": ["Stem Lab Usage", "Online Learning Adoption"],
            "ai": ["Stem Lab Usage"],
            "machine learning": ["Stem Lab Usage"],
            "enrollment": ["Enrollment Rate"],
            "graduation": ["Graduation Rate"],
        }

        # Build growth ranking from Holt's forecasts
        growth_ranking: List[Dict[str, Any]] = []
        for sector in sectors:
            points = sector.get("historical", [])
            name = sector["name"]
            growth = sector.get("growth_pct", 0.0)
            latest = sector.get("latest_value", 0.0)

            if len(points) >= 2:
                years = [p["year"] for p in points]
                values = [p["metric_value"] for p in points]
                fc = self._forecast(years, values, steps_ahead=steps_ahead)
                forecast_val = fc[-1] if fc else latest
            else:
                forecast_val = latest

            # Determine which sector keywords relate to this sector
            sector_keywords = [kw for kw, sectors_list in skill_sector_map.items() if name in sectors_list]

            # Compute match: how many user inputs relate to this sector
            match_count = sum(1 for h in history_lower if any(kw in h for kw in sector_keywords))

            # Base score from growth + match count
            base_score = min(100, max(0, 30 + growth * 2 + match_count * 15))
            if match_count > 0:
                base_score = min(100, base_score + 10)

            growth_ranking.append({
                "name": name,
                "growth_pct": round(growth, 2),
                "latest_value": round(latest, 2),
                "forecast_value": round(forecast_val, 2),
                "match_count": match_count,
                "score": int(round(base_score)),
                "sector_keywords": sector_keywords,
                "method": "holt_linear_exponential_smoothing",
            })

        # Sort by score descending
        growth_ranking.sort(key=lambda r: r["score"], reverse=True)

        # Build structured recommendations
        recommendations: List[Dict[str, Any]] = []
        for item in growth_ranking:
            keywords = item["sector_keywords"]
            missing = [kw for kw in keywords if not any(kw in h for h in history_lower)] if keywords else []
            recommendations.append({
                "career_path": item["name"],
                "field": item["name"],
                "match_score": item["score"],
                "growth_pct": item["growth_pct"],
                "forecast_value": item["forecast_value"],
                "latest_value": item["latest_value"],
                "explanation": (
                    f"Dự báo {item['name']}: tăng trưởng {item['growth_pct']}%/năm, "
                    f"giá trị dự báo {item['forecast_value']} "
                    f"(phương pháp Holt's Linear, alpha=0.3, beta=0.1)."
                ),
                "missing_skills": missing,
                "demand_level": "Cao" if item["growth_pct"] > 2 else ("Trung bình" if item["growth_pct"] > 0 else "Thấp"),
                "method": item["method"],
            })

        # Enrich with job-skill demand data if available
        if job_skills:
            skill_counter = Counter(job_skills)
            top_skills = [{"skill": s, "count": c} for s, c in skill_counter.most_common(5)]
            for rec in recommendations:
                rec["related_job_skills"] = top_skills

        return {
            "status": "success",
            "recommendations": recommendations,
            "method": "holt_linear_exponential_smoothing",
            "alpha": 0.3,
            "beta": 0.1,
            "historical_sectors": len(sectors),
            "steps_ahead": steps_ahead,
        }

    def get_market_trends(self, steps_ahead: int = 3) -> Dict[str, Any]:
        """Return real market trends with Holt's Linear Exponential Smoothing forecasts.

        Previously returned `{}` (empty static placeholder with no real data).
        Now synced with analytics.py: loads actual education_stats data and
        applies Holt's double exponential smoothing (alpha=0.3, beta=0.1)
        for time-series forecasting of each sector's growth.

        Returns a structured dict with trend list and per-sector forecast map.
        """
        stats = self._load_education_stats()
        if not stats:
            return {
                "status": "no_data",
                "trends": [],
                "forecast": {},
                "message": "Chưa có dữ liệu education_stats trong CSDL.",
            }

        sectors = self._build_sectors(stats)
        if not sectors:
            return {
                "status": "no_data",
                "trends": [],
                "forecast": {},
                "message": "Không có chỉ số giáo dục khả dụng để dự báo.",
            }

        forecast_map: Dict[str, Any] = {}
        trends_list: List[Dict[str, Any]] = []

        for sector in sectors:
            points = sector.get("historical", [])
            name = sector["name"]
            growth_pct = sector.get("growth_pct", 0.0)
            latest = sector.get("latest_value", 0.0)
            fc_years = [points[-1]["year"] + i + 1 for i in range(steps_ahead)] if points else [2025 + i for i in range(steps_ahead)]

            if len(points) >= 2:
                years = [p["year"] for p in points]
                values = [p["metric_value"] for p in points]
                fc = self._forecast(years, values, steps_ahead=steps_ahead)

                forecast_map[name] = {
                    "method": "holt_linear_exponential_smoothing",
                    "alpha": 0.3,
                    "beta": 0.1,
                    "historical_years": years,
                    "historical_values": values,
                    "forecast_years": fc_years,
                    "forecast_values": [round(v, 2) for v in fc],
                    "growth_pct": round(growth_pct, 2),
                    "latest_value": round(latest, 2),
                }
                trends_list.append({
                    "name": name,
                    "growth_pct": round(growth_pct, 2),
                    "latest_value": round(latest, 2),
                    "forecast_value": round(fc[-1], 2) if fc else latest,
                    "forecast_year": fc_years[-1] if fc_years else (points[-1]["year"] + 1),
                    "method": "holt_linear_exponential_smoothing",
                })
            else:
                forecast_map[name] = {
                    "method": "insufficient_data",
                    "forecast": [],
                    "note": "Cần ít nhất 2 năm dữ liệu để dự báo.",
                }
                trends_list.append({
                    "name": name,
                    "growth_pct": round(growth_pct, 2),
                    "latest_value": round(latest, 2),
                    "forecast_value": latest,
                    "forecast_year": fc_years[-1] if fc_years else 2025,
                    "method": "insufficient_data",
                })

        trends_list.sort(key=lambda t: t["growth_pct"], reverse=True)

        return {
            "status": "success",
            "trends": trends_list,
            "forecast": forecast_map,
            "last_updated": _date.today().isoformat(),
            "data_source": "education_stats",
            "method": "holt_linear_exponential_smoothing",
        }

    # ────────────────── Educational Gap Predictor (Idea #3) ──────────────────

    # Province centroid fallback (decimal degrees) used when a region has
    # education_stats but no POI locations in the shared SQLite DB, so the
    # GeoJSON risk map still anchors on a sensible point instead of (0, 0).
    _PROVINCE_CENTROID: Dict[str, Any] = {
        "đồng nai": (10.9567, 107.1825),
        "tp. hồ chí minh": (10.7727, 106.6548),
        "hồ chí minh": (10.7727, 106.6548),
        "hà nội": (21.0279, 105.8342),
        "đà nẵng": (16.0477, 108.2062),
        "cần thơ": (10.0333, 105.7936),
    }

    # map_points.type_id / locations.category_id -> label (mirrors DBService.TYPE_NAME_MAP)
    _TYPE_NAME_MAP: Dict[int, str] = {
        1: 'university', 2: 'school', 3: 'library', 4: 'bookstore',
        5: 'lab', 6: 'wifi', 7: 'green', 8: 'cafe', 9: 'restaurant',
        10: 'market', 11: 'convenience',
    }

    def _matches_region(self, row: Dict[str, Any], region: Optional[str]) -> bool:
        """True if `region` (case-insensitive substring) is present in any of the
        geography-bearing columns of `row`. Works for both `education_stats`
        rows (region/province/district) and POI rows (province/city/district/
        address/name) because missing columns simply yield falsy .get() values.
        """
        if not region:
            return True
        needle = region.strip().lower()
        if not needle:
            return True
        for field in ("region", "province", "district", "city", "address", "name"):
            value = row.get(field)
            if isinstance(value, str) and needle in value.lower():
                return True
        return False

    def _parse_point_coords(self, raw: Any) -> Optional[List[float]]:
        """Parse a PostGIS/H3/ewkt geo value into ``[lng, lat]``.

        Handles:
          - GeoJSON JSON string: ``{"type":"Point","coordinates":[lng,lat]}``
          - Bare JSON array string ``[lng, lat]``
          - EWKT string ``POINT(lng lat)``
          - Already-parsed list/dict
        Returns ``None`` when the value can't be resolved (so bad rows are
        skipped rather than corrupting the cluster).
        """
        if raw is None:
            return None
        if isinstance(raw, (list, tuple)) and len(raw) >= 2:
            try:
                return [float(raw[0]), float(raw[1])]
            except (TypeError, ValueError):
                return None
        if isinstance(raw, dict):
            coords = raw.get("coordinates") or (raw.get("type") == "Point" and raw.get("coordinates"))
            if isinstance(coords, (list, tuple)) and len(coords) >= 2:
                try:
                    return [float(coords[0]), float(coords[1])]
                except (TypeError, ValueError):
                    return None
            return None
        if isinstance(raw, str):
            s = raw.strip()
            try:
                obj = json.loads(s)
                return self._parse_point_coords(obj)
            except (ValueError, TypeError):
                pass
            # EWKT fallback: SRID=4326;POINT(lng lat)
            m = re.search(r"POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)", s, re.I)
            if m:
                try:
                    return [float(m.group(1)), float(m.group(2))]
                except ValueError:
                    return None
        return None

    def _load_region_points(self, region: Optional[str]) -> List[Dict[str, Any]]:
        """Load school/library/facility POIs (lat, lng, name, category) for a region.

        Reads the SAME shared SQLite file the NestJS backend uses
        (``education_stats`` lives there alongside ``map_points``/``locations``).
        Both POI tables are UNIONed: ``map_points`` carries ``province`` while
        ``locations`` only carries ``city``/``address`` — the address string
        embeds the province (e.g. "...TP. Biên Hòa, Đồng Nai") so a province
        filter still resolves the ~3 200 locations rows, not just the 49
        map_points. Region matching is a case-insensitive substring against
        region/province/district/city/address/name.
        """
        from routers.analytics import _query_sqlite, _to_float

        rows = _query_sqlite(
            "SELECT city, district, province, address, name, type_id, location AS coords FROM map_points WHERE location IS NOT NULL "
            "UNION ALL "
            "SELECT city, NULL AS district, NULL AS province, address, name, category_id AS type_id, coordinates AS coords FROM locations WHERE coordinates IS NOT NULL"
        ) or []

        points: List[Dict[str, Any]] = []
        for r in rows:
            coords = self._parse_point_coords(r.get("coords"))
            if not coords:
                continue
            if not self._matches_region(r, region):
                continue
            try:
                lat = float(coords[1]); lng = float(coords[0])
            except (TypeError, ValueError):
                continue
            if not (isinstance(lat, float) and isinstance(lng, float)) or lat != lat or lng != lng:
                continue  # reject NaN
            type_id_raw = r.get("type_id")
            try:
                type_id = int(float(type_id_raw)) if type_id_raw is not None else 0
            except (TypeError, ValueError):
                type_id = 0
            points.append({
                "lat": lat, "lng": lng,
                "name": r.get("name") or "Không có tên",
                "category": self._TYPE_NAME_MAP.get(type_id, "other"),
                "source": "map_points" if type_id in self._TYPE_NAME_MAP else "locations",
            })
        return points

    def _region_centroid(self, region: Optional[str], points: List[Dict[str, Any]]) -> Dict[str, float]:
        """Resolve a centroid for `region`, preferring the mean of loaded POIs
        and falling back to a province centroid lookup, finally to Biên Hòa
        (the EduMap default map center)."""
        if points:
            lats = [p["lat"] for p in points]
            lngs = [p["lng"] for p in points]
            return {"lat": float(sum(lats) / len(lats)), "lng": float(sum(lngs) / len(lngs))}
        if region:
            key = region.strip().lower()
            for prov, (lat, lng) in self._PROVINCE_CENTROID.items():
                if prov == key or key in prov or prov in key:
                    return {"lat": float(lat), "lng": float(lng)}
        return {"lat": 10.9567, "lng": 107.1825}

    def _risk_level(self, score: float) -> str:
        if score >= 0.66:
            return "high"
        if score >= 0.33:
            return "medium"
        return "low"

    def _haversine_km(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        from math import radians, sin, cos, sqrt, atan2
        R = 6371.0
        p1 = radians(lat1); p2 = radians(lat2)
        dlat = radians(lat2 - lat1)
        dlon = radians(lng2 - lng1)
        a = sin(dlat / 2) ** 2 + cos(p1) * cos(p2) * sin(dlon / 2) ** 2
        return R * 2 * atan2(sqrt(a), sqrt(1 - a))

    def predict_educational_gaps(self, region: Optional[str] = None,
                                 steps_ahead: int = 3) -> Dict[str, Any]:
        """Predict educational gap risk for a region (Idea #3 — AI Educational
        Gap Predictor).

        Pipeline:
          1. Time-series forecasting (Holt's Linear, alpha=0.3, beta=0.1) over
             the region's ``education_stats`` per metric_type → trend + risk.
          2. DBSCAN clustering of school/library POIs → geographic density
             gaps (areas far from any facility).
          3. Risk score ∈ [0, 1] = 0.4·growth_risk + 0.3·density_gap +
             0.3·access_risk (feature importance is returned for transparency).

        Returns a GeoJSON ``FeatureCollection`` plus ``heat_points``
        (``[[lat, lng, weight], ...]`` for leaflet.heat), ``risk_ranking``,
        ``trends`` and ``metadata``. Degrades gracefully: sparse data
        (< 3 years for a metric, or no POIs for the region) yields
        ``metadata.degraded = true`` + a human-readable ``reason`` instead of a
        crash. DBSCAN input is pre-filtered to ≤ 2000 points to bound latency
        (mitigation for the "DBSCAN slow on 10k+ points" risk).
        """
        import numpy as np  # type: ignore
        try:
            from sklearn.cluster import DBSCAN  # type: ignore
            sklearn_ok = True
        except Exception:
            sklearn_ok = False

        region_str = (region or "").strip() or None
        stats = self._load_education_stats() or []

        # ── 1. Time-series forecast per metric ──────────────────────────────
        region_stats = [s for s in stats if self._matches_region(s, region_str)] if region_str else stats
        stats_degraded = len(region_stats) == 0
        stats_reason = None if stats else None
        if stats_degraded:
            stats_reason = "Không có dữ liệu education_stats cho khu vực này." \
                if region_str else "Chưa có dữ liệu education_stats trong CSDL."

        by_metric: Dict[str, List[Dict[str, float]]] = defaultdict(list)
        for s in region_stats:
            from routers.analytics import _to_year, _to_float
            mt = (s.get("metric_type") or "Khác").strip()
            year = _to_year(s.get("year"))
            value = _to_float(s.get("metric_value"))
            if year is None or value is None:
                continue
            by_metric[mt].append({"year": year, "value": value})

        trends: List[Dict[str, Any]] = []
        metric_risks: List[float] = []
        for mt, pts in sorted(by_metric.items()):
            pts.sort(key=lambda p: p["year"])
            years = [p["year"] for p in pts]
            values = [p["value"] for p in pts]
            forecast_years = [years[-1] + i + 1 for i in range(steps_ahead)] if pts else []

            degraded_metric = len(pts) < 3
            method = "insufficient_data" if degraded_metric else "holt_linear_exponential_smoothing"
            if len(values) >= 2:
                fc = self._forecast(years, values, steps_ahead=steps_ahead)
            else:
                fc = [values[-1] if values else 0.0] * steps_ahead

            latest = float(values[-1]) if values else 0.0
            forecast_final = float(fc[-1]) if fc else latest
            # growth risk: decline (forecast < latest) raises risk
            growth_frac = ((forecast_final - latest) / latest) if latest > 0 else 0.0
            growth_risk = float(np.clip(-growth_frac, 0.0, 1.0))
            # level risk: these metrics are "higher is better" (0-100 %),
            # so a low absolute level is itself a gap.
            level_risk = float(np.clip(1.0 - (latest / 100.0 if latest <= 100 else 1.0), 0.0, 1.0))
            risk = 0.6 * growth_risk + 0.4 * level_risk
            metric_risks.append(risk)

            trends.append({
                "metric_type": mt,
                "historical": [{"year": int(y), "value": round(float(v), 2)} for y, v in zip(years, values)],
                "forecast": [{"year": int(y), "value": round(float(v), 2)} for y, v in zip(forecast_years, fc)],
                "latest_value": round(latest, 2),
                "forecast_value": round(forecast_final, 2),
                "growth_pct": round(growth_frac * 100, 2),
                "risk_score": round(risk, 3),
                "risk_level": self._risk_level(risk),
                "method": method,
                "degraded": degraded_metric,
            })

        stats_growth_risk = float(sum(metric_risks) / len(metric_risks)) if metric_risks else 0.0
        # Build a clean forecast horizon from the first metric's latest year.
        first_metric_pts = next(iter(by_metric.values()), []) if by_metric else []
        forecast_horizon = [int(first_metric_pts[-1]["year"]) + i + 1 for i in range(steps_ahead)] if first_metric_pts else []
        trend_desc = self._summarise_trend(trends)

        # ── 2. Geographic DBSCAN + gap detection ─────────────────────────────
        poi_points = self._load_region_points(region_str)

        geo_degraded = False
        geo_reason = None
        if not poi_points:
            geo_degraded = True
            geo_reason = "Không tìm thấy trường/học viện cho khu vực này."
        elif not sklearn_ok:
            geo_degraded = True
            geo_reason = "sklearn/chroma chưa sẵn sàng — bản đồ rủi ro địa lý bị giảm."

        # Pre-filter DBI input to ≤ 2000 points (mitigates DBSCAN latency risk).
        cluster_points = list(poi_points)
        if len(cluster_points) > 2000:
            stride = max(1, len(cluster_points) // 2000)
            cluster_points = cluster_points[::stride][:2000]

        centroid = self._region_centroid(region_str, poi_points)
        features: List[Dict[str, Any]] = []
        heat_points: List[List[float]] = []
        risk_ranking: List[Dict[str, Any]] = []

        if poi_points and sklearn_ok:
            coords = np.array([[p["lat"], p["lng"]] for p in cluster_points], dtype=float)
            # DBSCAN on (lat, lng) degrees; eps≈0.01 (~1.1 km) mirrors geo.py.
            db = DBSCAN(eps=0.01, min_samples=3).fit(coords)
            labels = db.labels_

            # --- Hub features (well-served, lower risk) ---
            cluster_ids = set(labels) - {-1}
            hub_density_scores = {}
            for cid in cluster_ids:
                member_idx = np.where(labels == cid)[0]
                members = [cluster_points[i] for i in member_idx]
                hub_center = {"lat": float(coords[member_idx, 0].mean()),
                              "lng": float(coords[member_idx, 1].mean())}
                density_score = float(len(members) / max(len(cluster_points), 1))
                hub_density_scores[cid] = density_score
                # A hub is served, so its gap-access risk is ~0; blend with stats.
                hub_risk = float(np.clip(0.4 * stats_growth_risk + 0.6 * (1.0 - density_score), 0.0, 1.0))
                geom = self._cluster_polygon(members) if len(members) >= 3 else {
                    "type": "Point", "coordinates": [hub_center["lng"], hub_center["lat"]]}
                features.append({
                    "type": "Feature",
                    "geometry": geom,
                    "properties": {
                        "region": region_str or "toàn quốc",
                        "area": f"Hub giáo dục #{int(cid)}",
                        "risk_score": round(hub_risk, 3),
                        "risk_level": self._risk_level(hub_risk),
                        "risk_score_pct": round(hub_risk * 100, 1),
                        "point_count": len(members),
                        "density_score": round(density_score, 3),
                        "trend": trend_desc,
                        "needs_survey": False,
                        "gap_type": "well_served_hub",
                        "categories": sorted({m["category"] for m in members}),
                    },
                })
                risk_ranking.append({
                    "area": f"Hub giáo dục #{int(cid)}",
                    "risk_score": round(hub_risk, 3),
                    "risk_score_pct": round(hub_risk * 100, 1),
                    "risk_level": self._risk_level(hub_risk),
                    "trend": trend_desc,
                    "density": round(density_score, 3),
                    "point_count": len(members),
                    "needs_survey": False,
                    "lat": hub_center["lat"], "lng": hub_center["lng"],
                    "reason": "Khu vực có tập trung cơ sở giáo dục, ít rủi ro.",
                })

            # --- Gap detection via a grid + nearest-facility distance ---
            lats = coords[:, 0]; lngs = coords[:, 1]
            min_lat, max_lat = float(lats.min()), float(lats.max())
            min_lng, max_lng = float(lngs.min()), float(lngs.max())
            # Pad the bbox so the heatmap extends beyond the outermost POIs.
            pad = (max_lat - min_lat) * 0.25 + 0.005
            lat_lo, lat_hi = min_lat - pad, max_lat + pad
            lng_lo, lng_hi = min_lng - pad, max_lng + pad
            # Cap grid resolution to bound work (≤ 30×30 = 900 cells).
            n = 30
            grid_lats = np.linspace(lat_lo, lat_hi, n).tolist()
            grid_lngs = np.linspace(lng_lo, lng_hi, n).tolist()

            max_dist = self._haversine_km(lat_lo, lng_lo, lat_hi, lng_hi) or 1.0
            cell_rows: List[Dict[str, Any]] = []
            for glat in grid_lats:
                for glng in grid_lngs:
                    # nearest-POI distance (Euclidean-in-degrees on grid is fine
                    # for ordering; compute true km for the risk weight).
                    diffs = coords - np.array([[glat, glng]])
                    nearest_idx = int(np.argmin(np.abs(diffs).sum(axis=1)))
                    nearest = cluster_points[nearest_idx]
                    dist_km = self._haversine_km(glat, glng, nearest["lat"], nearest["lng"])
                    access_risk = float(np.clip(dist_km / max_dist, 0.0, 1.0))
                    cell_risk = float(np.clip(0.4 * stats_growth_risk + 0.6 * access_risk, 0.0, 1.0))
                    cell_rows.append({
                        "lat": float(glat), "lng": float(glng),
                        "access_risk": access_risk, "cell_risk": cell_risk,
                        "nearest_name": nearest["name"],
                    })

            # Heat points (leaflet.heat): every cell, weight = cell_risk ∈ [0,1].
            # Sort by weight desc and cap for performance.
            cell_rows.sort(key=lambda c: c["cell_risk"], reverse=True)
            heat_points = [[round(c["lat"], 6), round(c["lng"], 6), round(c["cell_risk"], 3)]
                           for c in cell_rows[:500]]

            # Gap features: top-N highest-risk cells → "areas to survey".
            for c in cell_rows[:12]:
                features.append({
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [c["lng"], c["lat"]]},
                    "properties": {
                        "region": region_str or "toàn quốc",
                        "area": "Vùng cần khảo sát",
                        "risk_score": round(c["cell_risk"], 3),
                        "risk_score_pct": round(c["cell_risk"] * 100, 1),
                        "risk_level": self._risk_level(c["cell_risk"]),
                        "trend": trend_desc,
                        "growth_pct": sum(t["growth_pct"] for t in trends) / len(trends) if trends else 0.0,
                        "needs_survey": True,
                        "gap_type": "density_gap",
                        "access_distance_km": round(self._haversine_km(
                            c["lat"], c["lng"], centroid["lat"], centroid["lng"]), 2),
                        "nearest_facility": c["nearest_name"],
                    },
                })
                risk_ranking.append({
                    "area": "Vùng cần khảo sát",
                    "risk_score": round(c["cell_risk"], 3),
                    "risk_score_pct": round(c["cell_risk"] * 100, 1),
                    "risk_level": self._risk_level(c["cell_risk"]),
                    "trend": trend_desc,
                    "needs_survey": True,
                    "lat": c["lat"], "lng": c["lng"],
                    "reason": f"Xa trung tâm giáo dục nhất ({c['nearest_name']}); cần khảo sát bổ sung.",
                })

            n_clusters = len(cluster_ids)
        else:
            n_clusters = 0

        # ── 3. Region aggregate feature (always present) ─────────────────────
        overall_risk = float(np.clip(stats_growth_risk if stats_growth_risk else 0.0, 0.0, 1.0))
        if poi_points and sklearn_ok:
            overall_geo_risk = max((c["cell_risk"] for c in cell_rows), default=0.0)
            overall_risk = float(np.clip(0.5 * stats_growth_risk + 0.5 * overall_geo_risk, 0.0, 1.0))

        features.insert(0, {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [centroid["lng"], centroid["lat"]]},
            "properties": {
                "region": region_str or "toàn quốc",
                "area": region_str or "Toàn quốc",
                "risk_score": round(overall_risk, 3),
                "risk_score_pct": round(overall_risk * 100, 1),
                "risk_level": self._risk_level(overall_risk),
                "trend": trend_desc,
                "growth_pct": sum(t["growth_pct"] for t in trends) / len(trends) if trends else 0.0,
                "needs_survey": overall_risk >= 0.5,
                "gap_type": "region_aggregate",
            },
        })
        risk_ranking.insert(0, {
            "area": region_str or "Toàn quốc",
            "risk_score": round(overall_risk, 3),
            "risk_score_pct": round(overall_risk * 100, 1),
            "risk_level": self._risk_level(overall_risk),
            "trend": trend_desc,
            "needs_survey": overall_risk >= 0.5,
            "lat": centroid["lat"], "lng": centroid["lng"],
            "reason": "Tổng hợp rủi ro dựa trên dự báo Holt's Linear + mật độ cơ sở giáo dục.",
        })

        degraded = bool(stats_degraded or geo_degraded or any(t["degraded"] for t in trends))
        reason = stats_reason or geo_reason
        if not reason and any(t["degraded"] for t in trends):
            reason = "Một số chỉ số có < 3 năm dữ liệu — dự báo Holt's không ổn định."

        # Sort ranking by risk desc.
        risk_ranking.sort(key=lambda r: r["risk_score"], reverse=True)

        return {
            "type": "FeatureCollection",
            "features": features,
            "heat_points": heat_points,
            "risk_ranking": risk_ranking,
            "trends": trends,
            "feature_importance": {
                "growth_risk": 0.4,
                "density_gap": 0.3,
                "access_risk": 0.3,
            },
            "metadata": {
                "region": region_str or "toàn quốc",
                "method": "holt_linear_exponential_smoothing + dbscan",
                "degraded": degraded,
                "reason": reason,
                "data_points": len(region_stats),
                "pois_loaded": len(poi_points),
                "pois_clustered": len(cluster_points),
                "clusters": n_clusters,
                "steps_ahead": steps_ahead,
                "last_updated": _date.today().isoformat(),
                "forecast_horizon_years": forecast_horizon,
                "holt_alpha": 0.3,
                "holt_beta": 0.1,
            },
        }

    def _summarise_trend(self, trends: List[Dict[str, Any]]) -> str:
        """One-line Vietnamese trend summary for UI tooltips."""
        if not trends:
            return "Chưa có dữ liệu"
        declining = sum(1 for t in trends if t["growth_pct"] < 0)
        growing = sum(1 for t in trends if t["growth_pct"] > 0)
        if declining >= len(trends) / 2:
            return "Giảm"
        if growing >= len(trends) / 2:
            return "Tăng"
        return "Ổn định"

    def _cluster_polygon(self, members: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Convex-hull Polygon (RFC 7946 [lng,lat]) for a DBSCAN hub, or a
        Point at the centroid when < 3 / collinear points."""
        try:
            from scipy.spatial import ConvexHull  # type: ignore
            pts = np.array([[m["lat"], m["lng"]] for m in members], dtype=float)
            if len(pts) >= 3:
                hull = ConvexHull(pts)
                ring = [[float(pts[i, 1]), float(pts[i, 0])] for i in hull.vertices]
                ring.append(ring[0])
                return {"type": "Polygon", "coordinates": [ring]}
        except Exception:
            pass
        lat = float(sum(m["lat"] for m in members) / len(members))
        lng = float(sum(m["lng"] for m in members) / len(members))
        return {"type": "Point", "coordinates": [lng, lat]}


predictive_service = PredictiveService()
