from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional, List, Tuple
from collections import Counter, defaultdict
import asyncio
import json
import logging
import os
import re
import sqlite3
import subprocess
import traceback
import urllib.parse

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


# ──────────────────────── Hot-skill extraction ────────────────────────
#
# Skill taxonomy used to mine in-demand ("hot") skills out of job postings.
# Mirrors the keyword set in frontend/app/api/career/jobs/route.ts so the
# "hot skills" surfaced on the Market Trends page are consistent with the
# skills the Jobs page already extracts from Adzuna results.
#
# Adzuna API reference (Vietnam job search):
#   GET https://api.adzuna.com/v1/api/jobs/{country}/search/{page}
#   params: app_id, app_key, results_per_page, what, latitude, longitude, radius
#   response: { count, results: [ { title, company.display_name, category.label,
#                                    location.display_name, salary_min, salary_max,
#                                    description, ... } ] }
# Source: https://developer.adzuna.com/  (in-repo implementation verified in
#   frontend/app/api/career/jobs/route.ts and llm_service._fetch_adzuna_jobs)
_SKILL_KEYWORDS: List[str] = [
    # Languages & runtimes
    'react', 'vue', 'angular', 'node', 'nodejs', 'python', 'java', 'go', 'rust',
    'typescript', 'javascript', 'php', 'dart', 'flutter', 'android', 'ios',
    'swift', 'kotlin', 'c++', 'c#', 'laravel', 'django', 'nestjs',
    # Cloud & infra / DevOps
    'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'redis', 'nginx', 'jenkins',
    'git', 'devops', 'ci/cd', 'microservices', 'rest api', 'linux',
    # Data
    'sql', 'postgresql', 'postgres', 'mongodb', 'mysql', 'graphql',
    'data analysis', 'data science', 'machine learning', 'deep learning',
    'tensorflow', 'pytorch', 'nlp', 'bigquery', 'snowflake',
    # Design / soft
    'figma', 'photoshop', 'seo', 'agile', 'scrum', 'product management',
]


def _extract_skills_from_text(text: str) -> List[str]:
    """Extract known skill keywords from free-form job text.

    Alphanumeric keywords are matched with word boundaries (so ``react`` does
    not match ``reactive``); keywords containing special chars (``c++``,
    ``c#``, ``ci/cd``) use a case-insensitive substring match because they are
    distinctive enough that a substring hit is a true positive.
    """
    lower = (text or "").lower()
    found: set = set()
    for kw in _SKILL_KEYWORDS:
        try:
            if kw.isalnum():
                if re.search(rf"\b{re.escape(kw)}\b", lower):
                    found.add(kw)
            else:
                if kw.lower() in lower:
                    found.add(kw)
        except re.error:
            continue
    return list(found)


def _adzuna_available() -> bool:
    return bool(os.getenv("ADZUNA_APP_ID")) and bool(os.getenv("ADZUNA_APP_KEY"))


def _fetch_adzuna_hot_skills(
    results_per_page: int = 50, limit_skills: int = 10
) -> List[Dict[str, Any]]:
    """Fetch REAL job postings from the Adzuna API and extract hot skills.

    Adzuna provides live Vietnam job postings (free tier: 5,000 req/month).
    On HF Spaces we shell out to ``curl --ipv4 --insecure`` — the exact same
    pattern already used by ``llm_service._fetch_adzuna_jobs`` and the
    embedding chain — to bypass the Python ssl/urllib IPv6 blackhole that
    makes TLS handshakes to Cloudflare/HF hang on HF Spaces.

    The Adzuna keys are read from container env (set as HF Spaces secrets via
    start.sh's PID-1 environ recovery) and are NEVER sent to the browser.

    Returns ``[]`` when keys are missing or the request fails so the caller
    can transparently fall back to the local SQLite ``jobs`` table.
    """
    app_id = os.getenv("ADZUNA_APP_ID")
    app_key = os.getenv("ADZUNA_APP_KEY")
    country = os.getenv("ADZUNA_COUNTRY", "vn")
    if not (app_id and app_key):
        return []

    try:
        url = (
            f"https://api.adzuna.com/v1/api/jobs/{country}/search/1?"
            f"app_id={urllib.parse.quote(app_id)}&app_key={urllib.parse.quote(app_key)}"
            f"&results_per_page={int(results_per_page)}"
            f"&what={urllib.parse.quote('it')}"
        )
        # curl (OpenSSL TLS) — bypasses the Python ssl/urllib IPv6 blackhole
        # on HF Spaces; --ipv4 forces IPv4, --insecure tolerates the
        # Space's optional MITM proxy with a custom CA.
        proc = subprocess.run(
            [
                "curl", "--ipv4", "--insecure", "-sS", "-X", "GET",
                "-H", "User-Agent: EduMap-AI/1.0",
                "-H", "Accept: application/json",
                "--connect-timeout", "6",
                "--max-time", "15",
                url,
            ],
            capture_output=True, text=True, timeout=20,
        )
        if proc.returncode != 0 or not (proc.stdout or "").strip():
            logger.warning(
                "Adzuna hot-skill fetch failed (curl rc=%s); "
                "falling back to local jobs table", proc.returncode,
            )
            return []
        payload = json.loads(proc.stdout)
        results = payload.get("results") or []

        counter: Counter = Counter()
        for r in results:
            text = " ".join([
                r.get("title", "") or "",
                r.get("description", "") or "",
                ((r.get("category") or {}).get("label", "") if isinstance(r.get("category"), dict) else ""),
            ])
            counter.update(_extract_skills_from_text(text))

        if not counter:
            return []

        total = sum(counter.values()) or 1
        logger.info(
            "Adzuna: extracted %d hot skills from %d live job postings",
            len(counter), len(results),
        )
        return [
            {
                "name": skill,
                "growth": f"+{round(count / total * 100)}%",
                "count": count,
            }
            for skill, count in counter.most_common(limit_skills)
        ]
    except Exception as e:
        logger.warning(
            "Adzuna hot-skill extraction failed (%s: %s); "
            "falling back to local jobs table", type(e).__name__, e,
        )
        return []


def _load_trending_skills(limit: int = 5) -> Tuple[List[Dict[str, Any]], str]:
    """Derive in-demand ("hot") skills from active job postings.

    PRIMARY: real-time job postings scraped from the Adzuna API (Vietnam) —
      this is the actual recruitment data source. When
      ``ADZUNA_APP_ID``/``ADZUNA_APP_KEY`` are set on HF Spaces, hot skills are
      extracted from live job titles + descriptions instead of the small seeded
      ``jobs`` table.

    FALLBACK: active rows of the local ``jobs`` table (SQLite on HF Spaces,
      PostgreSQL in local/provisioned envs), seeded by seed_crawled_data.sql and
      optionally refreshed by the ITviec/Adzuna job crawler.

    Returns a ``(skills, source)`` tuple so the UI can report provenance
    ("adzuna" vs "local db") and stop calling the result "sample data" when it
    is backed by real market postings.
    """
    # 1) Real market data first.
    adzuna_skills = _fetch_adzuna_hot_skills(limit_skills=limit)
    if adzuna_skills:
        return adzuna_skills, "adzuna"

    # 2) Graceful fallback to the local (seeded + crawler-populated) jobs table.
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
        return [], "local"

    total = sum(counter.values()) or 1
    return (
        [
            {
                "name": skill,
                "growth": f"+{round(count / total * 100)}%",
                "count": count,
            }
            for skill, count in counter.most_common(limit)
        ],
        "local",
    )


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

        # Use Holt's linear exponential smoothing for prediction.
        # Falls back to CAGR-based extrapolation when insufficient data points.
        hist_years = [p["year"] for p in points]
        hist_values = [p["metric_value"] for p in points]
        target_year = 2025
        steps_ahead = max(1, target_year - points[-1]["year"])
        forecast = _holt_linear_forecast(hist_years, hist_values, steps_ahead=steps_ahead)
        prediction = int(forecast[-1]) if forecast and forecast[-1] > 0 else (
            int(last_value * (1 + growth / 100)) if growth else int(last_value * 1.15)
        )
        sectors.append({
            "name": name,
            "growth_pct": round(growth, 2),
            "prediction_2025": prediction,
            "latest_value": last_value,
            "historical": points,
        })

    sectors.sort(key=lambda s: s["growth_pct"], reverse=True)
    return sectors


def _holt_linear_forecast(years: List[int], values: List[float],
                           steps_ahead: int = 1, alpha: float = 0.3, beta: float = 0.1) -> List[float]:
    """Holt's linear exponential smoothing (double exponential smoothing).

    Dự báo time-series dựa trên numpy duy nhất — không cần statsmodels/prophet.
    Thích hợp với HF Spaces môi trường lightweight + numpy-only.

    Trả về danh sách `steps_ahead` giá trị dự báo.
    """
    import numpy as np

    if len(values) < 2:
        # Không đủ dữ liệu để smoothing — dùng linear extrapolation đơn giản
        if len(values) == 1:
            return [values[0]] * steps_ahead
        return [0.0] * steps_ahead

    y = np.array(values, dtype=float)
    n = len(y)

    # Khởi tạo level và trend
    level = y[0]
    trend = y[1] - y[0]

    for t in range(1, n):
        prev_level = level
        level = alpha * y[t] + (1 - alpha) * (level + trend)
        trend = beta * (level - prev_level) + (1 - beta) * trend

    forecasts = []
    for h in range(1, steps_ahead + 1):
        forecast = level + h * trend
        # Đảm bảo giá trị không âm (đây là số liệu thống kê sinh viên)
        forecasts.append(max(0.0, float(forecast)))

    return forecasts


@router.post("/daily-insight")
async def get_daily_insight(request_data: DashboardInsightRequest):
    from services.llm_service import llm_service
    if not llm_service or not llm_service.is_ready:
        raise HTTPException(status_code=503, detail="AI Service chưa sẵn sàng. Cấu hình XKIRO_API_KEY (primary), NVIDIA_API_KEY, CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID hoặc HF_TOKEN.")
    try:
        insight = await llm_service.generate_daily_insight(request_data.dashboard_data or {})
        return insight
    except Exception as e:
        logger.error(f"Error in get_daily_insight route: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=503, detail="Hệ thống AI tạm thời không khả dụng.")


@router.get("/stats")
async def get_stats():
    # The loaders are synchronous. Run each in a worker thread so a locked DB
    # (the NestJS backend writes analytics events) or a slow disk can never
    # block the event loop for other AI requests. Keep them sequential: in
    # PostgreSQL mode all three share one psycopg2 connection, which is not
    # safe for concurrent use.
    stats_data = await asyncio.to_thread(_load_education_stats)
    events = await asyncio.to_thread(_load_user_events, 500)
    trending_skills, skills_source = await asyncio.to_thread(_load_trending_skills)
    logger.info(
        "Fetched %d education stats records; trending skills source=%s (%d skills)",
        len(stats_data), skills_source, len(trending_skills),
    )

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

    top_event = Counter(
        str(e.get("event_type") or "N/A") for e in events
    ).most_common(1)
    top_event = top_event[0][0] if top_event else "N/A"

    if sectors:
        conclusion_parts = [
            f"{s['name']}: {s['growth_pct']}%/năm" for s in sectors[:5]
        ]
        conclusion = (
            "Dựa trên dữ liệu, các chỉ số giáo dục có mức tăng trưởng: "
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
        "trending_skills": trending_skills,
        # Provenance flag so the frontend can stop labeling the result as
        # "sample data" when the skills actually came from live Adzuna jobs.
        "trending_skills_source": skills_source,
        "trending_skills_available": skills_source == "adzuna" or len(trending_skills) > 0,
        "insights": {
            "average_annual_growth_pct": avg_growth,
            "prediction_2025_it_students": int(prediction_2025),
            "top_user_activity": top_event,
            "conclusion": conclusion,
            "data_points": len(stats_data),
        },
    }


@router.get("/forecast")
async def get_forecast(steps: int = 3):
    """Dự báo tăng trưởng giáo dục dựa trên Holt's Linear Exponential Smoothing.

    Trả về dự báo `steps` năm tiếp theo cho mỗi sector. Phù hợp với môi trường
    HF Spaces không có statsmodels/prophet.
    """
    try:
        stats_data = await asyncio.to_thread(_load_education_stats)
        if not stats_data:
            return {
                "status": "error",
                "detail": "Chưa có dữ liệu education_stats trong CSDL.",
            }

        sectors = _build_sectors(stats_data)
        forecast_result: Dict[str, Any] = {}

        for sector in sectors:
            points = sector.get("historical", [])
            if len(points) < 2:
                forecast_result[sector["name"]] = {
                    "method": "insufficient_data",
                    "forecast": [],
                    "note": "Cần ít nhất 2 năm dữ liệu để dự báo."
                }
                continue

            years = [p["year"] for p in points]
            values = [p["metric_value"] for p in points]
            fc = _holt_linear_forecast(years, values, steps_ahead=steps)

            forecast_result[sector["name"]] = {
                "method": "holt_linear_exponential_smoothing",
                "historical_years": years,
                "historical_values": values,
                "forecast_years": [years[-1] + i + 1 for i in range(steps)],
                "forecast_values": [round(v, 2) for v in fc],
                "growth_pct": sector["growth_pct"],
                "latest_value": sector["latest_value"],
            }

        return {
            "status": "success",
            "forecast": forecast_result,
            "steps": steps,
        }
    except Exception as e:
        logger.error(f"Error in get_forecast: {str(e)}")
        raise HTTPException(status_code=503, detail=f"Lỗi dự báo: {str(e)}")
