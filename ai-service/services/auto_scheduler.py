"""AI Auto-Scheduler — chạy tự động các tính năng AI định kỳ (Idea: auto-run).

Thay vì phải ấn từng nút "Ghép nối" / "Đo lường" / "Phân tích" như hiện tại,
trung tâm lịch trình này tự động chạy các tính toán AI nặng trong background
(trên daemon thread của ai-service) và lưu kết quả vào cache in-process.
Frontend chỉ cần gọi GET để lấy cache — không bao giờ chờ LLM động.

Kiến trúc (tuân nguyên AGENTS.md):
  • Daemon thread trong main.py startup hook (giống `_startup_seed_knowledge_graph`)
  • In-process TTL cache (HF Spaces: không có Redis)
  • Graceful degradation — mỗi task đều bắt exception, trả về degraded=true
  • Env-tunable intervals (AUTO_SCHEDULER_*)
  • SQLite query trực tiếp trong ai-service (pattern của impact_measure.py)

Các task tự động:
  1. chroma_seed        — re-seed ChromaDB (6h)  [trước đây chỉ 1 lần ở startup]
  2. question_gaps      — phân tích khoảng trống câu hỏi (6h)
  3. resource_exchange   — ghép nối nguồn lực ↔ yêu cầu (6h)
  4. impact_match        — ghép nối nhu cầu ↔ nhà tài trợ (12h)
  5. impact_measure      — đo lường tác động trước/sau (24h)
  6. climate_risk        — bản đồ rủi ro khí hậu theo vùng (12h)
  7. daily_insight       — gợi ý hằng ngày cho dashboard (24h)
"""

import os
import time
import json
import sqlite3
import threading
import asyncio
import logging
from typing import Dict, Any, List, Optional, Tuple, Callable
from datetime import datetime

logger = logging.getLogger("auto_scheduler")

# ── SQLite path (mirror impact_measure.py pattern) ───────────────────────────

SQLITE_PATH = os.getenv("DB_SQLITE_PATH", "/app/frontend/public/edumap.db")


def _sqlite_path() -> Optional[str]:
    """Return the SQLite file used by the backend when in SQLite mode."""
    if os.getenv("DB_TYPE", "sqlite").lower() != "sqlite":
        return None
    if SQLITE_PATH and os.path.exists(SQLITE_PATH):
        return SQLITE_PATH
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
        if conn:
            conn.close()


# ── Predefined Vietnamese regions for geo-based auto-run ──────────────────────
# Used by climate_risk + impact_measure tasks to pre-compute for key areas
# so the frontend shows results immediately on map load.
AUTO_REGIONS: List[Dict[str, Any]] = [
    {"id": "dong_nai",  "name": "Đồng Nai",      "bbox": [10.75, 11.20, 106.60, 107.20]},
    {"id": "hcmc",      "name": "TP. Hồ Chí Minh", "bbox": [10.75, 10.83, 106.65, 106.76]},
    {"id": "hanoi",     "name": "Hà Nội",        "bbox": [20.95, 21.05, 105.75, 105.90]},
    {"id": "danang",    "name": "Đà Nẵng",       "bbox": [15.90, 16.10, 107.90, 108.40]},
    {"id": "cantho",    "name": "Cần Thơ",       "bbox": [10.40, 10.50, 105.50, 105.90]},
]


# ── Urgency weight map (mirror backend ResourceExchangeService / ImpactMatch) ──
URGENCY_WEIGHT = {"critical": 4, "high": 3, "medium": 2, "low": 1}


# ── Shared in-process TTL cache ──────────────────────────────────────────────

class AutoCache:
    """Shared in-process TTL cache cho toàn bộ auto-scheduler (HF Spaces: no Redis).

    Cache key format: ``"<task_name>"`` hoặc ``"<task_name>:<sub_key>"``
    (ví dụ: ``"climate_risk:dong_nai"``, ``"impact_measure:hcmc"``).
    """

    _store: Dict[str, Tuple[float, Any]] = {}
    _hits: int = 0
    _misses: int = 0
    _lock = threading.Lock()

    @classmethod
    def get(cls, key: str) -> Optional[Any]:
        with cls._lock:
            entry = cls._store.get(key)
            if not entry:
                cls._misses += 1
                return None
            expiry, value = entry
            if time.time() > expiry:
                cls._store.pop(key, None)
                cls._misses += 1
                return None
            cls._hits += 1
            return value

    @classmethod
    def set(cls, key: str, value: Any, ttl_seconds: float = 86400) -> None:
        with cls._lock:
            cls._store[key] = (time.time() + ttl_seconds, value)

    @classmethod
    def is_stale(cls, key: str) -> bool:
        with cls._lock:
            entry = cls._store.get(key)
            if not entry:
                return True
            expiry = entry[0]
            return time.time() > expiry

    @classmethod
    def stats(cls) -> Dict[str, Any]:
        with cls._lock:
            live = sum(1 for _, (exp, _) in cls._store.items() if time.time() <= exp)
            expired = sum(1 for _, (exp, _) in cls._store.items() if time.time() > exp)
            return {
                "keys": len(cls._store),
                "live": live,
                "expired": expired,
                "hits": cls._hits,
                "misses": cls._misses,
            }

    @classmethod
    def clear(cls) -> None:
        with cls._lock:
            cls._store.clear()


# ── Task result wrapper ──

def _wrap_result(name: str, data: Any, degraded: bool = False, reason: str = "") -> Dict[str, Any]:
    """Wrap task output in a consistent response shape."""
    return {
        "task": name,
        "data": data,
        "degraded": degraded,
        "reason": reason,
        "last_updated": datetime.utcnow().isoformat() + "Z",
        "cache_ttl_seconds": AUTO_INTERVALS.get(name, {}).get("ttl", 86400),
    }


# ── Task interval config (env-tunable) ──

def _env_hours(var: str, default: float) -> float:
    try:
        return float(os.getenv(var, str(default))) * 3600
    except (ValueError, TypeError):
        return default * 3600


AUTO_INTERVALS: Dict[str, Dict[str, Any]] = {
    "chroma_seed":        {"interval_s": _env_hours("AUTO_SCHEDULER_CHROMA_INTERVAL", 6), "ttl": 86400},
    "question_gaps":      {"interval_s": _env_hours("AUTO_SCHEDULER_QUESTION_GAPS_INTERVAL", 6), "ttl": 86400},
    "resource_exchange":  {"interval_s": _env_hours("AUTO_SCHEDULER_RESOURCE_EXCHANGE_INTERVAL", 6), "ttl": 86400},
    "impact_match":       {"interval_s": _env_hours("AUTO_SCHEDULER_IMPACT_MATCH_INTERVAL", 12), "ttl": 86400},
    "impact_measure":     {"interval_s": _env_hours("AUTO_SCHEDULER_IMPACT_MEASURE_INTERVAL", 24), "ttl": 86400},
    "climate_risk":       {"interval_s": _env_hours("AUTO_SCHEDULER_CLIMATE_INTERVAL", 12), "ttl": 43200},
    "daily_insight":      {"interval_s": _env_hours("AUTO_SCHEDULER_DAILY_INSIGHT_INTERVAL", 24), "ttl": 86400},
}

AUTO_ENABLED = os.getenv("AUTO_SCHEDULER_ENABLED", "true").lower() in ("1", "true", "yes", "on")


# ── Individual task implementations ──────────────────────────────────────────

def _run_chroma_seed() -> Dict[str, Any]:
    """Re-seed ChromaDB to keep vector DB fresh (not just at startup)."""
    from seed_vector_db import seed_data
    result = seed_data()
    return _wrap_result(
        "chroma_seed",
        {
            "synced_count": result.get("synced_count", 0),
            "failed_count": result.get("failed_count", 0),
            "source": result.get("source", "unknown"),
            "status": result.get("status", "unknown"),
        },
        degraded=bool(result.get("status") == "error"),
        reason=result.get("message", ""),
    )


def _run_question_gaps() -> Dict[str, Any]:
    """Pre-compute Question Gap Report so admin page shows results instantly."""
    from services.question_gap_analyzer import QuestionGapAnalyzer
    analyzer = QuestionGapAnalyzer()
    report = analyzer.analyze_gaps(limit=10000)
    return _wrap_result(
        "question_gaps",
        report,
        degraded=bool(report.get("degraded", False)),
        reason=report.get("reason", ""),
    )


def _run_daily_insight() -> Dict[str, Any]:
    """Pre-generate daily insight for the dashboard."""
    from services.llm_service import LLMService
    svc = LLMService()
    # Build summary stats from SQLite for the insight prompt
    stats = {}
    try:
        rows = _query_sqlite(
            "SELECT date(metric_name) as d, metric_value FROM education_stats ORDER BY d DESC LIMIT 50"
        )
        if rows:
            stats["education_stats"] = rows
    except Exception:
        pass
    try:
        poi_count = _query_sqlite("SELECT COUNT(*) as c FROM map_points")
        if poi_count:
            stats["poi_count"] = poi_count[0]["c"]
    except Exception:
        pass
    try:
        mat_count = _query_sqlite("SELECT COUNT(*) as c FROM learning_materials WHERE status='published'")
        if mat_count:
            stats["materials_count"] = mat_count[0]["c"]
    except Exception:
        pass
    try:
        result = asyncio.run(svc.generate_daily_insight({"stats": stats}))
    except Exception as e:
        result = {
            "motivation_message": "Hãy khám phá tài nguyên giáo dục mới trên EduMap.",
            "suggested_action": "Xem thư viện hoặc bản đồ địa điểm gần bạn.",
        }
        return _wrap_result("daily_insight", result, degraded=True, reason=str(e))

    return _wrap_result("daily_insight", result, degraded=False)


def _run_resource_exchange() -> Dict[str, Any]:
    """Pre-filter resource↔request pairs from SQLite + LLM ranking.

    Mirrors backend ResourceMatchService.matchResources() pre-filter:
    - resources.status='available', requests.status='open'
    - resource.type = request.need_type
    - resource.condition >= request.preferred_min_condition
    - Cap at 15 pairs (MAX_PAIRS_TO_LLM)

    Scoring (SQLite layer): proximity(40%) + need_level(25%) + condition(25%) + availability(10%).
    Since we don't have real distances without the backend geo service, we use
    location overlap heuristic.
    """
    try:
        resources = _query_sqlite(
            "SELECT id, type, title, description, condition, location, lat, lng, available_from, cost, contact_method, is_verified, tags, status "
            "FROM resources WHERE status='available' ORDER BY created_at DESC LIMIT 200"
        )
        requests = _query_sqlite(
            "SELECT id, need_type, title, description, urgency, location, lat, lng, deadline, preferred_min_condition, contact_method, tags, status "
            "FROM resource_requests WHERE status='open' ORDER BY created_at DESC LIMIT 200"
        )
    except Exception as e:
        return _wrap_result("resource_exchange", {"ranked_matches": [], "transport_plan": []},
                           degraded=True, reason=f"SQLite query failed: {e}")

    pairs = []
    for req in requests:
        req_loc = (req.get("location") or "").lower()
        req_type = (req.get("need_type") or "").lower()
        req_min_cond = int(req.get("preferred_min_condition") or 0)
        req_urgency_weight = URGENCY_WEIGHT.get(req.get("urgency") or "medium", 2)

        for res in resources:
            res_type = (res.get("type") or "").lower()
            if res_type != req_type:
                continue
            res_cond = int(res.get("condition") or 0)
            if res_cond < req_min_cond:
                continue

            # Scoring (mirrors backend _scorePair)
            # proximity: location overlap heuristic (40%)
            res_loc = (res.get("location") or "").lower()
            proximity_score = 60.0 if (req_loc and res_loc and req_loc in res_loc or res_loc in req_loc) else 30.0
            # need_level (urgencyWeight/4 * 100 * 0.25)
            need_level = (req_urgency_weight / 4.0) * 100
            need_level_score = need_level * 0.25
            # condition (res.condition/5 * 100 * 0.25)
            condition_score = (res_cond / 5.0) * 100 * 0.25
            # availability (10%) — always 100 for available items
            availability_score = 100 * 0.10

            total = proximity_score * 0.40 + need_level_score + condition_score + availability_score
            total = round(min(100.0, max(0.0, total)), 1)

            pairs.append({
                "resource_id": res["id"],
                "request_id": req["id"],
                "resource": {
                    "id": res["id"],
                    "type": res["type"],
                    "title": res.get("title", ""),
                    "description": res.get("description") or None,
                    "condition": res_cond,
                    "location": res.get("location", ""),
                    "lat": res.get("lat"),
                    "lng": res.get("lng"),
                    "available_from": res.get("available_from") or None,
                    "cost": float(res.get("cost") or 0),
                    "contact_method": res.get("contact_method") or None,
                    "is_verified": bool(res.get("is_verified")),
                    "tags": json.loads(res.get("tags") or "[]"),
                    "metadata": {},
                },
                "request": {
                    "id": req["id"],
                    "need_type": req.get("need_type", ""),
                    "title": req.get("title", ""),
                    "description": req.get("description") or None,
                    "urgency": req.get("urgency", "medium"),
                    "location": req.get("location", ""),
                    "lat": req.get("lat"),
                    "lng": req.get("lng"),
                    "deadline": req.get("deadline") or None,
                    "preferred_min_condition": req_min_cond,
                    "contact_method": req.get("contact_method") or None,
                    "tags": json.loads(req.get("tags") or "[]"),
                },
                "match_score": total,
                "match_reasons": [f"Loại khớp: {res_type} ↔ {req_type}",
                                  f"Điều kiện: {res_cond}/{req_min_cond}",
                                  f"Độ khẩn: {req.get('urgency', 'medium')}"],
            })

    pairs.sort(key=lambda x: x["match_score"], reverse=True)
    limited_pairs = pairs[:15]

    if not limited_pairs:
        return _wrap_result("resource_exchange", {
            "ranked_matches": [],
            "transport_plan": [],
            "pre_filter_summary": {"total_resources": len(resources), "total_requests": len(requests), "pre_filtered_pairs": 0, "max_pairs": 0},
        }, degraded=False)

    # Build the request object for the LLM service
    from models.resource_exchange_models import ResourceExchangeRequest, MatchCandidate
    try:
        model_pairs = [MatchCandidate(**p) for p in limited_pairs]
        req_obj = ResourceExchangeRequest(pairs=model_pairs, region=None, type=None, max_results=15)
    except Exception as e:
        return _wrap_result("resource_exchange", {
            "ranked_matches": [], "transport_plan": [],
            "pre_filter_summary": {"total_resources": len(resources), "total_requests": len(requests), "pre_filtered_pairs": len(limited_pairs), "max_pairs": 15},
        }, degraded=False, reason=f"Model build failed: {e}")

    try:
        from services.llm_service import LLMService
        svc = LLMService()
        result = asyncio.run(svc.rank_resource_matches(req_obj))
        return _wrap_result("resource_exchange", result,
                           degraded=bool(result.get("degraded", False)),
                           reason=result.get("reason", ""))
    except Exception as e:
        return _wrap_result("resource_exchange", {
            "ranked_matches": [{"resource_id": p["resource_id"], "request_id": p["request_id"],
                                "match_score": p["match_score"], "explanation": p["match_reasons"][0] if p["match_reasons"] else "",
                                "match_reasons": p["match_reasons"], "next_steps": ["Liên hệ người cung cấp qua contact_method để xác nhận."]}
                              for p in limited_pairs],
            "transport_plan": [],
            "pre_filter_summary": {"total_resources": len(resources), "total_requests": len(requests), "pre_filtered_pairs": len(limited_pairs), "max_pairs": 15},
        }, degraded=True, reason=str(e))


def _run_impact_match() -> Dict[str, Any]:
    """Pre-filter need×sponsor pairs from SQLite + LLM ranking.

    Mirrors backend ImpactMatchService.rankMatches() pre-filter:
    - needs.status='open', sponsors.status='active'
    - sponsor.budget_amount >= need.cost_estimate
    - Cap at 15 pairs
    """
    try:
        needs = _query_sqlite(
            "SELECT id, title, description, category, urgency, cost_estimate, location, status, tags "
            "FROM sponsor_needs WHERE status='open' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 50"
        )
        sponsors = _query_sqlite(
            "SELECT id, name, description, focus_areas, budget_amount, budget_currency, location, status, is_verified "
            "FROM sponsor_profiles WHERE status='active' ORDER BY budget_amount DESC LIMIT 50"
        )
    except Exception as e:
        return _wrap_result("impact_match", {"ranked_matches": [], "pre_filter_summary": {}},
                           degraded=True, reason=f"SQLite query failed: {e}")

    pairs = []
    for need in needs:
        need_cat = (need.get("category") or "").lower()
        need_cost = float(need.get("cost_estimate") or 0)
        for spon in sponsors:
            spon_budget = float(spon.get("budget_amount") or 0)
            if spon_budget < need_cost:
                continue

            focus_areas = json.loads(spon.get("focus_areas") or "[]")
            need_tags = json.loads(need.get("tags") or "[]")
            category_match = bool(need_cat and (need_cat in focus_areas or any(t in focus_areas for t in need_tags)))

            # Proximity: location overlap (0-30 points)
            spon_loc = (spon.get("location") or "").lower()
            need_loc = (need.get("location") or "").lower()
            proximity = 30.0 if (need_loc and spon_loc and (need_loc in spon_loc or spon_loc in need_loc)) else 10.0
            # Budget fit: budget >= cost → full points (0-30)
            if need_cost > 0:
                budget_fit = min(30, (spon_budget / need_cost) * 15 + 15)
            else:
                budget_fit = 30.0
            # Category match (0-20)
            category_score = 20.0 if category_match else 5.0
            # Urgency bonus (0-20)
            urgency_weight = URGENCY_WEIGHT.get(need.get("urgency") or "medium", 2)
            urgency_score = urgency_weight / 4.0 * 20
            # Verified bonus (0-5)
            verified_score = 5.0 if spon.get("is_verified") else 0.0

            total = round(min(100.0, proximity + budget_fit + category_score + urgency_score + verified_score), 1)

            pairs.append({
                "need_id": need["id"],
                "sponsor_id": spon["id"],
                "need": {
                    "id": need["id"],
                    "title": need.get("title", ""),
                    "description": need.get("description") or None,
                    "category": need.get("category", ""),
                    "urgency": need.get("urgency", "medium"),
                    "cost_estimate": need_cost,
                    "location": need.get("location") or None,
                    "tags": json.loads(need.get("tags") or "[]"),
                },
                "sponsor": {
                    "id": spon["id"],
                    "name": spon.get("name", ""),
                    "description": spon.get("description") or None,
                    "focus_areas": focus_areas,
                    "budget_amount": spon_budget,
                    "budget_currency": spon.get("budget_currency", "VND"),
                    "location": spon.get("location") or None,
                },
                "category_match": category_match,
            })

    pairs.sort(key=lambda x: x["match_score"] if "match_score" in x else 0, reverse=True)
    limited_pairs = pairs[:15]

    if not limited_pairs:
        return _wrap_result("impact_match", {
            "ranked_matches": [],
            "pre_filter_summary": {"total_needs": len(needs), "total_sponsors": len(sponsors), "pre_filtered_pairs": 0, "max_pairs": 0},
        }, degraded=False)

    from models.impactmatch_models import ImpactMatchRequest, NeedSponsorPair
    try:
        model_pairs = [NeedSponsorPair(**p) for p in limited_pairs]
        req_obj = ImpactMatchRequest(pairs=model_pairs, region=None, category=None, max_results=15)
    except Exception as e:
        return _wrap_result("impact_match", {
            "ranked_matches": [],
            "pre_filter_summary": {"total_needs": len(needs), "total_sponsors": len(sponsors), "pre_filtered_pairs": len(limited_pairs), "max_pairs": 15},
        }, degraded=False, reason=f"Model build failed: {e}")

    try:
        from services.llm_service import LLMService
        svc = LLMService()
        result = asyncio.run(svc.rank_impact_matches(req_obj))
        # Inject SQLite-side score into each result for the fallback frontend display
        score_map = {f"{p['need_id']}:{p['sponsor_id']}": p.get("match_score", 0) for p in limited_pairs}
        for m in result.get("ranked_matches", []):
            key = f"{m.get('need_id')}:{m.get('sponsor_id')}"
            if key in score_map:
                m.setdefault("pre_filter_score", score_map[key])
        return _wrap_result("impact_match", result,
                           degraded=bool(result.get("degraded", False)),
                           reason=result.get("reason", ""))
    except Exception as e:
        return _wrap_result("impact_match", {
            "ranked_matches": [],
            "pre_filter_summary": {"total_needs": len(needs), "total_sponsors": len(sponsors), "pre_filtered_pairs": len(limited_pairs), "max_pairs": 15},
        }, degraded=True, reason=str(e))


def _run_climate_risk() -> Dict[str, Any]:
    """Pre-compute climate risk heatmap for all predefined regions."""
    results = {}
    any_degraded = False
    for region in AUTO_REGIONS:
        cache_key = f"climate_risk:{region['id']}"
        lat1, lat2, lng1, lng2 = region["bbox"]
        try:
            from services.climate_guardian import climate_guardian
            heatmap = climate_guardian.get_risk_heatmap(lat1, lat2, lng1, lng2, None)
            results[region["id"]] = heatmap
            if heatmap.get("metadata", {}).get("degraded"):
                any_degraded = True
        except Exception as e:
            results[region["id"]] = {
                "type": "FeatureCollection", "features": [], "heat_points": [],
                "risk_ranking": [], "metadata": {"degraded": True, "reason": str(e), "region": region["name"]},
            }
            any_degraded = True

    return _wrap_result("climate_risk", {"regions": results}, degraded=any_degraded)


def _run_impact_measure() -> Dict[str, Any]:
    """Pre-compute impact measurement for all predefined regions."""
    results = {}
    any_degraded = False
    for region in AUTO_REGIONS:
        lat1, lat2, lng1, lng2 = region["bbox"]
        # Use a representative center point for impact measurement
        center_lat = (lat1 + lat2) / 2
        center_lng = (lng1 + lng2) / 2
        try:
            from services.impact_measure import impact_measure
            req = type("ImpactReq", (), {
                "lat": center_lat, "lng": center_lng,
                "radius_km": 15.0, "min_lat": lat1, "max_lat": lat2,
                "min_lng": lng1, "max_lng": lng2,
                "deployment_date": "2025-01-01", "region": region["name"],
                "facility_types": None,
            })()
            report = impact_measure.measure(req)
            results[region["id"]] = report
            if report.get("degraded", False):
                any_degraded = True
        except Exception as e:
            results[region["id"]] = {
                "degraded": True, "reason": str(e), "region": region["name"],
            }
            any_degraded = True

    return _wrap_result("impact_measure", {"regions": results}, degraded=any_degraded)


# ── Task registry ──

TASK_REGISTRY: Dict[str, Callable[[], Dict[str, Any]]] = {
    "chroma_seed": _run_chroma_seed,
    "question_gaps": _run_question_gaps,
    "resource_exchange": _run_resource_exchange,
    "impact_match": _run_impact_match,
    "impact_measure": _run_impact_measure,
    "climate_risk": _run_climate_risk,
    "daily_insight": _run_daily_insight,
}


# ── AutoScheduler ──

class AutoScheduler:
    """Centralized AI auto-scheduler.

    Runs each registered task at its configured interval in a daemon thread.
    Results are stored in AutoCache so GET endpoints can return them instantly.

    If a task fails, the scheduler logs the error and continues — one task's
    failure does NOT prevent other tasks from running. This mirrors the
    per-task try/except pattern already used by seed_vector_db.py and the
    KG startup hook.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._last_run: Dict[str, float] = {}
        self._last_result: Dict[str, Dict[str, Any]] = {}
        self._last_error: Dict[str, str] = {}
        self._running = False
        self._thread: Optional[threading.Thread] = None

    def _run_task(self, name: str) -> None:
        """Execute a single task, cache result, log outcome."""
        if name not in TASK_REGISTRY:
            logger.warning(f"[auto-scheduler] Unknown task: {name}")
            return

        fn = TASK_REGISTRY[name]
        ttl = AUTO_INTERVALS.get(name, {}).get("ttl", 86400)
        t0 = time.monotonic()

        try:
            result = fn()
            # Cache the result
            cache_key = f"auto:{name}"
            AutoCache.set(cache_key, result, ttl_seconds=ttl)

            with self._lock:
                self._last_run[name] = time.time()
                self._last_result[name] = result
                self._last_error.pop(name, None)

            duration_ms = int((time.monotonic() - t0) * 1000)
            logger.info(
                f"[auto-scheduler] Task '{name}' completed in {duration_ms}ms "
                f"(degraded={result.get('degraded', False)})"
            )
        except Exception as e:
            with self._lock:
                self._last_error[name] = str(e)[:300]
                self._last_run[name] = time.time()
            # Cache a degraded result so GET endpoints can return it
            # instead of 202-warming forever after a crash
            fallback_result = _wrap_result(
                name, {"error": str(e)[:300]},
                degraded=True,
                reason=f"{type(e).__name__}: {e}",
            )
            cache_key = f"auto:{name}"
            AutoCache.set(cache_key, fallback_result, ttl_seconds=AUTO_INTERVALS.get(name, {}).get("ttl", 86400))
            with self._lock:
                self._last_result[name] = fallback_result
            logger.warning(
                f"[auto-scheduler] Task '{name}' failed (non-fatal): "
                f"{type(e).__name__}: {e}"
            )

    def run_once(self, name: str) -> Optional[Dict[str, Any]]:
        """Run a single task immediately (blocking). Returns the cached result."""
        self._run_task(name)
        return AutoCache.get(f"auto:{name}")

    def run_initial(self) -> None:
        """Run all tasks once at startup (non-blocking per task via thread)."""
        # Run each task in its own thread so one slow task doesn't block others
        for name in TASK_REGISTRY:
            t = threading.Thread(target=self._run_task, args=(name,), daemon=True)
            t.start()

    def run_loop(self) -> None:
        """Main daemon loop — checks every minute which tasks are overdue."""
        self._running = True
        logger.info("[auto-scheduler] Starting auto-scheduler daemon loop")

        # Initial run: stagger tasks to avoid RAM spike
        # (mirrors the staggered model warmup pattern)
        stagger_delay = 5  # seconds between initial task launches
        for name in TASK_REGISTRY:
            time.sleep(stagger_delay)
            t = threading.Thread(target=self._run_task, args=(name,), daemon=True)
            t.start()

        # Periodic loop: check every minute
        CHECK_INTERVAL = 60  # seconds
        while self._running:
            now = time.time()
            for name, config in AUTO_INTERVALS.items():
                last = self._last_run.get(name, 0)
                interval = config["interval_s"]
                if now - last >= interval:
                    # Run in background thread so the loop isn't blocked
                    t = threading.Thread(target=self._run_task, args=(name,), daemon=True)
                    t.start()

            time.sleep(CHECK_INTERVAL)

    def stop(self) -> None:
        self._running = False

    def get_result(self, name: str) -> Optional[Dict[str, Any]]:
        """Return the cached result for a task (from AutoCache)."""
        result = AutoCache.get(f"auto:{name}")
        if result:
            return result

        # If not cached, check the in-memory last result
        with self._lock:
            return self._last_result.get(name)

    def health(self) -> Dict[str, Any]:
        """Return scheduler health + per-task status."""
        with self._lock:
            tasks = {}
            for name in TASK_REGISTRY:
                config = AUTO_INTERVALS.get(name, {})
                last = self._last_run.get(name)
                last_result = self._last_result.get(name, {})
                tasks[name] = {
                    "registered": name in TASK_REGISTRY,
                    "interval_hours": config.get("interval_s", 0) / 3600,
                    "last_run_at": datetime.utcfromtimestamp(last).isoformat() + "Z" if last else None,
                    "last_status": last_result.get("status", "pending") if last_result else "pending",
                    "last_degraded": last_result.get("degraded", False) if last_result else None,
                    "last_error": self._last_error.get(name),
                    "cache_stale": AutoCache.is_stale(f"auto:{name}") if last else True,
                }

        return {
            "scheduler_enabled": AUTO_ENABLED,
            "running": self._running,
            "cache_stats": AutoCache.stats(),
            "tasks": tasks,
        }


# ── Singleton ──

auto_scheduler = AutoScheduler()
