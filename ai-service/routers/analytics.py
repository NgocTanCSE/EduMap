from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from collections import Counter, defaultdict
import json
import logging
import os
import sqlite3
import traceback

router = APIRouter(prefix="/api/ai/analytics", tags=["6. AI Education Analytics"])

class DashboardInsightRequest(BaseModel):
    dashboard_data: Optional[Dict[str, Any]] = None

logger = logging.getLogger("analytics")


def _sqlite_path() -> Optional[str]:
    """Return the SQLite file used by the backend, when running in SQLite mode."""
    if os.getenv("DB_TYPE", "postgres").lower() != "sqlite":
        return None
    path = os.getenv("DB_SQLITE_PATH", "/app/frontend/public/edumap.db")
    return path if os.path.exists(path) else None


def _query_sqlite(sql: str) -> List[Dict[str, Any]]:
    """Run a read-only query against the shared SQLite DB (HF Spaces mode)."""
    path = _sqlite_path()
    if not path:
        return []
    conn = None
    try:
        conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True, timeout=5)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute(sql)
        return [dict(row) for row in cur.fetchall()]
    except Exception as e:
        logger.error(f"SQLite analytics query failed: {e}")
        return []
    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass


def _load_education_stats() -> List[Dict[str, Any]]:
    """Load education stats from PostgreSQL when configured, else from SQLite.

    In HF Spaces mode `db_service` is intentionally disabled (DB_TYPE=sqlite),
    which used to make this endpoint return 503 and left /analytics/trends
    empty even though the rest of the AI service was healthy. The SQLite file
    is the same pre-seeded database the NestJS backend uses, so we can read it
    directly for aggregate analytics.
    """
    try:
        from services.db_service import db_service
        if db_service is not None:
            rows = db_service.get_education_stats_all() or []
            if rows:
                return [dict(r) for r in rows]
    except Exception as e:
        logger.error(f"DB error fetching education stats: {e}")

    return _query_sqlite(
        "SELECT region, province, district, metric_type, metric_value, year, source "
        "FROM education_stats ORDER BY year ASC"
    )


def _load_user_events(limit: int = 500) -> List[Dict[str, Any]]:
    try:
        from services.db_service import db_service
        if db_service is not None:
            return [dict(r) for r in (db_service.get_user_events(limit=limit) or [])]
    except Exception as e:
        logger.error(f"DB error fetching user events: {e}")

    return _query_sqlite(
        f"SELECT event_type FROM user_events ORDER BY created_at DESC LIMIT {int(limit)}"
    )


def _parse_skills(raw: Any) -> List[str]:
    if isinstance(raw, list):
        return [str(s).strip() for s in raw if str(s).strip()]
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return [str(s).strip() for s in parsed if str(s).strip()]
        except Exception:
            pass
        # Some legacy rows store comma-separated skills.
        if raw.strip():
            return [s.strip() for s in raw.split(",") if s.strip()]
    return []


def _load_trending_skills(limit: int = 5) -> List[Dict[str, Any]]:
    """Derive in-demand skills from active job postings."""
    jobs: List[Dict[str, Any]] = []
    try:
        from services.db_service import db_service
        if db_service is not None and db_service.conn is not None:
            with db_service.conn.cursor() as cur:
                cur.execute(
                    "SELECT required_skills FROM jobs WHERE status = 'active'"
                )
                for row in cur.fetchall():
                    if isinstance(row, dict):
                        jobs.append(dict(row))
                    else:
                        jobs.append({"required_skills": row[0]})
    except Exception as e:
        logger.error(f"DB error fetching job skills: {e}")
        try:
            from services.db_service import db_service
            if db_service is not None and db_service.conn is not None:
                db_service.conn.rollback()
        except Exception:
            pass

    if not jobs:
        jobs = _query_sqlite(
            "SELECT required_skills FROM jobs WHERE status = 'active'"
        )

    counter: Counter = Counter()
    for job in jobs:
        counter.update(_parse_skills(job.get("required_skills")))

    if not counter:
        return []

    total = sum(counter.values()) or 1
    return [
        {
            "name": skill,
            "growth": f"+{round(count / total * 100)}%",
            "count": count,
        }
        for skill, count in counter.most_common(limit)
    ]


def _to_float(value: Any) -> Optional[float]:
    try:
        number = float(value)
        return number if number == number else None  # reject NaN
    except (TypeError, ValueError):
        return None


def _to_year(value: Any) -> Optional[int]:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _build_sectors(stats: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Group raw stats by metric_type and aggregate per year.

    The previous implementation fetched only year=2024, so every sector had a
    single data point and growth was always 0%. We now use all available years
    and average across regions for each (sector, year) before computing growth.
    """
    grouped: Dict[str, Dict[int, List[float]]] = defaultdict(lambda: defaultdict(list))
    for row in stats:
        metric_type = str(row.get("metric_type") or "Khác").strip() or "Khác"
        year = _to_year(row.get("year"))
        value = _to_float(row.get("metric_value"))
        if year is None or value is None:
            continue
        grouped[metric_type][year].append(value)

    sectors: List[Dict[str, Any]] = []
    for name, by_year in grouped.items():
        points = [
            {"year": year, "metric_value": round(sum(values) / len(values), 2)}
            for year, values in sorted(by_year.items())
            if values
        ]
        if not points:
            continue

        for point in points:
            point["value"] = point["metric_value"]

        first_value = points[0]["metric_value"]
        last_value = points[-1]["metric_value"]
        growth = 0.0
        if len(points) >= 2 and first_value > 0 and last_value > 0:
            # Compound annual growth rate across the observed years.
            years_span = max(1, points[-1]["year"] - points[0]["year"])
            growth = ((last_value / first_value) ** (1 / years_span) - 1) * 100

        prediction = int(last_value * (1 + growth / 100)) if growth else int(last_value * 1.15)
        sectors.append({
            "name": name,
            "growth_pct": round(growth, 2),
            "prediction_2025": prediction,
            "latest_value": last_value,
            "historical": points,
        })

    sectors.sort(key=lambda s: s["growth_pct"], reverse=True)
    return sectors


@router.post("/daily-insight")
async def get_daily_insight(request_data: DashboardInsightRequest):
    from services.llm_service import llm_service
    if not llm_service or not llm_service.is_ready:
        raise HTTPException(status_code=503, detail="AI Service chưa sẵn sàng. Cấu hình CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID hoặc HF_TOKEN.")
    try:
        insight = await llm_service.generate_daily_insight(request_data.dashboard_data or {})
        return insight
    except Exception as e:
        logger.error(f"Error in get_daily_insight route: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=503, detail="Hệ thống AI tạm thời không khả dụng.")


@router.get("/stats")
async def get_stats():
    stats_data = _load_education_stats()
    logger.info(f"Fetched {len(stats_data)} education stats records")

    sectors = _build_sectors(stats_data)

    # Overall historical series = the fastest-growing sector, falling back to
    # an empty list. Never raise on missing data: the trends page should still
    # render (with an empty-state message) instead of showing a network error.
    historical = sectors[0]["historical"] if sectors else []

    avg_growth = (
        round(sum(s["growth_pct"] for s in sectors) / len(sectors), 2)
        if sectors else 0.0
    )

    it_sector = next(
        (
            s for s in sectors
            if "it" in s["name"].lower()
            or "enroll" in s["name"].lower()
            or "tuyển sinh" in s["name"].lower()
        ),
        sectors[0] if sectors else None,
    )
    prediction_2025 = it_sector["prediction_2025"] if it_sector else 0

    events = _load_user_events(limit=500)
    top_event = Counter(
        str(e.get("event_type") or "N/A") for e in events
    ).most_common(1)
    top_event = top_event[0][0] if top_event else "N/A"

    if sectors:
        conclusion_parts = [
            f"{s['name']}: {s['growth_pct']}%/năm" for s in sectors[:5]
        ]
        conclusion = (
            "Dựa trên dữ liệu, các ngành có nhu cầu tăng trưởng: "
            + ", ".join(conclusion_parts)
            + "."
        )
    else:
        conclusion = (
            "Chưa có dữ liệu thống kê giáo dục trong CSDL. "
            "Hãy đồng bộ dữ liệu education_stats để xem xu hướng."
        )

    return {
        "status": "success",
        "historical_data": historical,
        "sectors": sectors,
        "trending_skills": _load_trending_skills(),
        "insights": {
            "average_annual_growth_pct": avg_growth,
            "prediction_2025_it_students": int(prediction_2025),
            "top_user_activity": top_event,
            "conclusion": conclusion,
            "data_points": len(stats_data),
        },
    }
