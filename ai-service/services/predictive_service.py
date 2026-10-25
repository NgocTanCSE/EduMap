"""Predictive service — synced with analytics.py's Holt's Linear forecasting.

Previously this module used static `return {}` for market trends and if-else
keyword matching for career prediction. Now it delegates to the same
Holt's Linear Exponential Smoothing (alpha=0.3, beta=0.1) and data-loading
layer that analytics.py uses, so the /api/ai/predictive/* endpoints produce
forecasts consistent with /api/ai/analytics/stats and /api/ai/analytics/forecast.
"""

import os
from datetime import date as _date
from typing import List, Dict, Any
from collections import Counter

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

predictive_service = PredictiveService()
