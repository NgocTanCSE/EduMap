"""
MapAgent — NL → GIS agent for EduMap.

Chuyển câu hỏi người dùng (ngôn ngữ tự nhiên) thành truy vấn GIS bằng cách:
  1. LLM lập kế hoạch (plan-then-execute) — gọi tool để thu thập dữ liệu.
  2. Thực thi tool (query_sqlite / geo_recommend / geo_density / rag_search).
  3. Tóm tắt kết quả kèm bằng chứng.

Tuân thủ AGENTS.md:
  - Production chỉ chạy trên HF Spaces (single Docker container).
  - Mọi HTTP call dùng curl --ipv4 --insecure (đã có trong LLMService).
  - SQL injection → chỉ cho phép SELECT trên allowlist tables.
  - XKIRO tool calling → Gemini fallback (prompt-based plan & execute).
  - RAG failure → LLM-only answer, never crash.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import math
import os
import re
import time
from typing import Any, Dict, List, Optional

# ── Lazy imports (HF Spaces: db_service is None in SQLite mode) ───────────────
try:
    from services.llm_service import llm_service
except Exception as e:
    print(f"[MapAgent] llm_service import failed: {e}")
    llm_service = None

try:
    from services.db_service import db_service as _db_service
except Exception:
    _db_service = None

try:
    from services.clustering_service import clustering_service
except Exception as e:
    print(f"[MapAgent] clustering_service import failed: {e}")
    clustering_service = None

try:
    from services.vector_store import vector_store
except Exception as e:
    print(f"[MapAgent] vector_store import failed: {e}")
    vector_store = None

# ── Shared SQLite path (HF Spaces: /app/frontend/public/edumap.db) ────────────
# In SQLite mode db_service is None, so the agent reads edumap.db directly.
# _sqlite_path() returns None when the DB file is genuinely absent.
_DB_ENV_PATH = os.getenv("DB_SQLITE_PATH", "")

def _sqlite_path() -> Optional[str]:
    """Resolve the SQLite DB path across environments.

    Priority:
      1. DB_SQLITE_PATH env var (set by Docker / HF Spaces)
      2. Local dev path (relative to repo root, for pytest run from ai-service/)
      3. HF Spaces default (/app/frontend/public/edumap.db)
    """
    candidates = []
    if _DB_ENV_PATH:
        candidates.append(_DB_ENV_PATH)
    # Local dev: repo-root/frontend/public/edumap.db
    _repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    candidates.append(os.path.join(_repo_root, "frontend", "public", "edumap.db"))
    # HF Spaces default
    candidates.append("/app/frontend/public/edumap.db")
    for p in candidates:
        if p and os.path.exists(p):
            return p
    return None

# ── Table allowlist for query_sqlite ──────────────────────────────────────────
# Only these tables may be read via the agent's query_sqlite tool. This is the
# primary SQL-injection defence: even if a malicious payload bypasses the
# keyword filter, the table name must appear in this set.
_ALLOWED_TABLES: List[str] = [
    "map_points",
    "jobs",
    "career_paths",
    "education_stats",
    "learning_materials",
    "scholarships",
    "mentors",
    "wifi_locations",
    "internchipships",
    "locations",
    "location_categories",
    "stem_labs",
    "events",
    "hackathons",
    "green_challenges",
    "university_counseling",
    "alumni_networks",
    "map_categories",
    "map_reviews",
    "user_skills",
    "users",
]

# SQL key-words that must NEVER appear in a user-supplied query.
_SQL_BLOCKLIST_RE = re.compile(
    r"\b("
    r"drop|delete|insert|update|alter|create|truncate|replace|grant|revoke|"
    r"attach|detach|pragma|vacUUM|reindex|shutdown|exec|execute|cross|attach"
    r")\b",
    re.IGNORECASE,
)

# Type-ID → category-name map (mirrors db_service.TYPE_NAME_MAP)
_TYPE_NAME_MAP = {
    1: "university", 2: "school", 3: "library", 4: "bookstore",
    5: "lab", 6: "wifi", 7: "green", 8: "cafe",
}


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance in kilometres between two lat/lng pairs."""
    R = 6371.0
    try:
        lat1r = math.radians(float(lat1))
        lat2r = math.radians(float(lat2))
        dlat = math.radians(float(lat2) - float(lat1))
        dlon = math.radians(float(lon2) - float(lon1))
        a = math.sin(dlat / 2) ** 2 + math.cos(lat1r) * math.cos(lat2r) * math.sin(dlon / 2) ** 2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c
    except (TypeError, ValueError):
        return 9999.0


def _parse_geojson_location(loc: Any) -> Optional[Dict[str, float]]:
    """Extract (lat, lng) from a GeoJSON Point stored as JSON string or dict."""
    if loc is None:
        return None
    if isinstance(loc, str):
        try:
            loc = json.loads(loc)
        except (json.JSONDecodeError, TypeError):
            return None
    if isinstance(loc, dict):
        coords = loc.get("coordinates")
        if isinstance(coords, list) and len(coords) >= 2:
            return {"lng": float(coords[0]), "lat": float(coords[1])}
    return None


class MapAgent:
    """NL → GIS agent.

    The agent receives a natural-language question and produces a final
    answer with evidence. Internally it may invoke up to four tools:

    - ``query_sqlite``  — raw read-only SELECT on the allowlisted SQLite tables
    - ``geo_recommend`` — nearby educational locations within a radius
    - ``geo_density``   — DBSCAN cluster analysis of education hubs
    - ``rag_search``    — semantic search over the seeded ChromaDB knowledge base

    Tool call sequence:
      1. Plan  — the LLM decides which tools to call (XKIRO function calling).
      2. Act   — each tool is executed and its result is fed back to the LLM.
      3. Repeat until the LLM returns a natural-language summary (no more tool_calls).

    If XKIRO tool calling is unavailable, a **plan-then-execute** fallback
    is used: the LLM emits a JSON plan (tool names + arguments) which the agent
    parses and executes, then summarises.
    """

    # ── Tool definitions (OpenAI / XKIRO function-calling schema) ────────
    TOOLS: List[Dict[str, Any]] = [
        {
            "type": "function",
            "function": {
                "name": "query_sqlite",
                "description": (
                    "Chạy một truy vấn SQL SELECT (chỉ đọc) trên cơ sở dữ liệu "
                    "SQLite của EduMap. Chỉ được phép dùng SELECT — mọi lệnh "
                    "thay đổi dữ liệu (INSERT/UPDATE/DELETE/DROP/...) sẽ bị từ chối. "
                    "Các bảng được phép: map_points, jobs, career_paths, "
                    "education_stats, learning_materials, scholarships, mentors, "
                    "wifi_locations, stem_labs, events, hackathons, green_challenges, "
                    "university_counseling, alumni_networks, map_categories, "
                    "map_reviews, user_skills, users. "
                    "Bảng map_points có cột 'location' dạng GeoJSON Point "
                    '(JSON string: {"type":"Point","coordinates":[lng,lat]}). ',
                    "Để lấy lat/lng dùng: json_extract(location,'$.coordinates[1]') AS lat, "
                    "json_extract(location,'$.coordinates[0]') AS lng."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "sql": {
                            "type": "string",
                            "description": (
                                "Câu truy vấn SELECT an toàn. Ví dụ: "
                                "\"SELECT name, type_id, address, city, "
                                "json_extract(location,'$.coordinates[1]') AS lat, "
                                "json_extract(location,'$.coordinates[0]') AS lng "
                                "FROM map_points WHERE type_id IN (1,2,3) LIMIT 50\""
                            ),
                        },
                    },
                    "required": ["sql"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "geo_recommend",
                "description": (
                    "Tìm các địa điểm giáo dục gần một tọa độ (lat, lng) trong "
                    "bán kính radius_km. Trả về danh sách các địa điểm kèm khoảng "
                    "cách, loại (university/school/library/...), rating. "
                    "Nếu không biết lat/lng chính xác, trước tiên gọi query_sqlite "
                    "để tìm tọa độ địa điểm (ví dụ: thư viện), sau đó dùng tọa độ "
                    "đó làm trung tâm."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "lat": {"type": "number", "description": "Vĩ độ tâm điểm"},
                        "lng": {"type": "number", "description": "Kinh độ tâm điểm"},
                        "radius_km": {"type": "number", "description": "Bán kính tìm kiếm (km)", "default": 5.0},
                        "category": {"type": "string", "description": "Loại địa điểm: university, school, library, bookstore, lab, wifi, green, cafe. Để trống = tất cả."},
                        "limit": {"type": "number", "description": "Số kết quả tối đa", "default": 10},
                    },
                    "required": ["lat", "lng"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "geo_density",
                "description": (
                    "Phân tích mật độ giáo dục bằng DBSCAN clustering trên một "
                    "danh sách các điểm (mỗi điểm có lat, lng, type). Trả về "
                    "GeoJSON FeatureCollection các cụm giáo dục (hubs) kèm "
                    "đa giác bao phủ. Nên gọi sau khi đã thu thập points qua "
                    "query_sqlite hoặc geo_recommend."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "points": {
                            "type": "string",
                            "description": "JSON string — mảng các đối tượng {lat, lng, type}. Ví dụ: '[{\"lat\":10.95,\"lng\":106.88,\"type\":\"university\"}, ...]'",
                        },
                    },
                    "required": ["points"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "rag_search",
                "description": (
                    "Tìm kiếm ngữ nghĩa trong kho tri thức (ChromaDB) của EduMap — "
                    "sách, tài liệu, lộ trình, hướng dẫn học tập. Dùng khi người "
                    "dùng hỏi về kiến thức học thuật, lộ trình, tài liệu, chứng chỉ..."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Câu hỏi / từ khóa tìm kiếm ngữ nghĩa"},
                        "n_results": {"type": "integer", "description": "Số kết quả tối đa", "default": 5},
                    },
                    "required": ["query"],
                },
            },
        },
    ]

    MAX_TOOL_ROUNDS = 8  # giới hạn số vòng tool-calling để tránh vòng lặp vô hạn

    def __init__(self):
        self._tool_map = {
            "query_sqlite": self.query_sqlite,
            "geo_recommend": self.geo_recommend,
            "geo_density": self.geo_density,
            "rag_search": self.rag_search,
        }

    # ─────────────────────────────────────────────────────────────────────────
    # Tool: query_sqlite  (SQL-injection-safe)
    # ─────────────────────────────────────────────────────────────────────────

    def query_sqlite(self, sql: str) -> List[Dict[str, Any]]:
        """Execute a read-only SELECT on the allowlisted SQLite tables.

        Security layers (defence in depth):
          1. Reject if the query contains any blocklisted DDL/DML keyword.
          2. Verify the query starts with SELECT.
          3. Extract every table name referenced (FROM, JOIN … ON, …) and
             require **all** of them to be in ``_ALLOWED_TABLES``.
          4. Open the DB in read-only mode (``mode=ro``) so even a bypass
             cannot write.
        """
        if not sql or not sql.strip():
            return [{"error": "Truy vấn rỗng."}]

        path = _sqlite_path()
        if not path:
            return [{"error": "SQLite database is not available."}]

        # Layer 1: block dangerous keywords
        if _SQL_BLOCKLIST_RE.search(sql):
            match = _SQL_BLOCKLIST_RE.search(sql)
            return [{"error": f"Truy vấn bị từ chối: từ khóa nguy hiểm '{match.group(0)}' không được phép."}]

        # Layer 2: must be SELECT
        stripped = sql.strip()
        if not re.match(r"^SELECT\b", stripped, re.IGNORECASE):
            return [{"error": "Chỉ cho phép câu lệnh SELECT."}]

        # Layer 3: table allowlist
        referenced_tables = self._extract_table_names(sql)
        if not referenced_tables:
            return [{"error": "Không tìm thấy tên bảng trong truy vấn."}]
        denied = [t for t in referenced_tables if t.lower() not in {x.lower() for x in _ALLOWED_TABLES}]
        if denied:
            return [{"error": f"Bảng không được phép: {denied}. Bảng cho phép: {_ALLOWED_TABLES}"}]

        # Layer 4: read-only connection
        import sqlite3 as _sqlite3
        conn = None
        try:
            conn = _sqlite3.connect(f"file:{path}?mode=ro", uri=True, timeout=10)
            conn.row_factory = _sqlite3.Row
            cur = conn.cursor()
            cur.execute(sql)
            return [dict(row) for row in cur.fetchall()]
        except Exception as e:
            return [{"error": f"Query failed: {type(e).__name__}: {e}"}]
        finally:
            if conn:
                try:
                    conn.close()
                except Exception:
                    pass

    @staticmethod
    def _extract_table_names(sql: str) -> List[str]:
        """Naively extract table names from FROM / JOIN clauses.

        This is intentionally simple — it catches the common cases
        (``FROM map_points``, ``JOIN users ON …``) and is backed by the
        allowlist + blocklist + read-only mode, so a false negative here
        would still be caught by the other layers.
        """
        tables: List[str] = []
        # Match: FROM table_name  /  JOIN table_name
        for m in re.finditer(r"\b(?:FROM|JOIN)\s+([\"\[]?[a-zA-Z_][a-zA-Z0-9_\"]*[\"]?\]?)", sql, re.IGNORECASE):
            name = m.group(1).strip().strip('"').strip("'").strip("[]")
            tables.append(name)
        # Also catch subquery aliases inside parentheses (e.g. FROM (SELECT ... FROM x) AS y)
        # The regex already handles nested FROM inside parens.
        return tables

    # ─────────────────────────────────────────────────────────────────────────
    # Tool: geo_recommend  — nearby locations with Haversine filtering
    # ─────────────────────────────────────────────────────────────────────────

    def geo_recommend(
        self,
        lat: float,
        lng: float,
        radius_km: float = 5.0,
        category: Optional[str] = None,
        limit: int = 10,
    ) -> Dict[str, Any]:
        """Find educational locations within *radius_km* of (lat, lng).

        In SQLite mode (HF Spaces) ``db_service`` is ``None`` and PostGIS is
        unavailable, so we query all candidate points and filter with the
        Haversine formula in Python — exactly the same approach used by
        ``clustering_service._haversine_distance``.
        """
        category_filter = (category or "").strip().lower()
        type_ids: List[int] = []
        if category_filter:
            tid = None
            for k, v in _TYPE_NAME_MAP.items():
                if v == category_filter:
                    tid = k
                    break
            if tid is not None:
                type_ids = [tid]
            else:
                # numeric category
                try:
                    tid = int(category_filter)
                    if tid in _TYPE_NAME_MAP:
                        type_ids = [tid]
                except (TypeError, ValueError):
                    pass
        # If category unmatched, return empty
        if category_filter and not type_ids:
            return {
                "status": "ok",
                "recommendations": [],
                "total_found": 0,
                "search_radius_km": radius_km,
                "center": {"lat": lat, "lng": lng},
                "note": f"Loại '{category_filter}' không hợp lệ.",
            }

        # Build SQL to fetch candidate points (optionally filtered by type)
        path = _sqlite_path()
        if not path:
            return {
                "status": "error",
                "recommendations": [],
                "error": "SQLite database is not available.",
                "center": {"lat": lat, "lng": lng},
            }

        import sqlite3 as _sqlite3
        conn = None
        candidates: List[Dict[str, Any]] = []
        try:
            conn = _sqlite3.connect(f"file:{path}?mode=ro", uri=True, timeout=10)
            conn.row_factory = _sqlite3.Row
            cur = conn.cursor()
            if type_ids:
                # SQLite IN clause with integers
                type_filter_sql = " AND type_id IN (" + ",".join(str(t) for t in type_ids) + ")"
            else:
                type_filter_sql = ""
            sql = (
                "SELECT id, name, type_id, address, city, district, "
                "rating_avg, rating_count, verified, "
                "json_extract(location, '$.coordinates[1]') AS lat, "
                "json_extract(location, '$.coordinates[0]') AS lng "
                "FROM map_points "
                f"WHERE location IS NOT NULL {type_filter_sql} "
                "AND deleted_at IS NULL"
            )
            cur.execute(sql)
            candidates = [dict(row) for row in cur.fetchall()]
        except Exception as e:
            return {
                "status": "error",
                "recommendations": [],
                "error": f"Query map_points failed: {type(e).__name__}: {e}",
                "center": {"lat": lat, "lng": lng},
            }
        finally:
            if conn:
                try:
                    conn.close()
                except Exception:
                    pass

        # Haversine filtering + sorting
        nearby: List[Dict[str, Any]] = []
        for c in candidates:
            clat = c.get("lat")
            clng = c.get("lng")
            if clat is None or clng is None:
                # Try parsing GeoJSON location manually
                parsed = _parse_geojson_location(c.get("location")) if "location" in c else None
                # In the SQL above we used json_extract which may return NULL
                # if 'location' isn't valid JSON; fall back to the raw column
                if parsed:
                    clat, clng = parsed["lat"], parsed["lng"]
                else:
                    continue
            dist = _haversine(float(lat), float(lng), float(clat), float(clng))
            if dist <= radius_km:
                type_name = _TYPE_NAME_MAP.get(int(c.get("type_id") or 0), "other")
                nearby.append({
                    "id": str(c.get("id", "")),
                    "name": c.get("name", "Unknown"),
                    "category": type_name,
                    "lat": float(clat),
                    "lng": float(clng),
                    "distance_km": round(dist, 2),
                    "rating_avg": float(c.get("rating_avg", 0.0) or 0.0),
                    "rating_count": c.get("rating_count", "0"),
                    "address": c.get("address", ""),
                    "city": c.get("city", ""),
                    "district": c.get("district", ""),
                })

        nearby.sort(key=lambda x: x.get("distance_km", 999))
        nearby = nearby[:limit]
        return {
            "status": "success",
            "recommendations": nearby,
            "total_found": len(nearby),
            "search_radius_km": radius_km,
            "center": {"lat": float(lat), "lng": float(lng)},
        }

    # ─────────────────────────────────────────────────────────────────────────
    # Tool: geo_density  — DBSCAN clustering
    # ─────────────────────────────────────────────────────────────────────────

    def geo_density(self, points: str) -> Dict[str, Any]:
        """Cluster education POIs with DBSCAN and return a GeoJSON
        ``FeatureCollection``."""
        if clustering_service is None:
            return {"type": "FeatureCollection", "features": [], "error": "Clustering service unavailable."}

        # points may arrive as a JSON string (tool-call args) or a list
        if isinstance(points, str):
            try:
                points_list = json.loads(points)
            except (json.JSONDecodeError, TypeError):
                return {"type": "FeatureCollection", "features": [], "error": "points is not valid JSON."}
        elif isinstance(points, list):
            points_list = points
        else:
            return {"type": "FeatureCollection", "features": [], "error": "points must be a JSON string or list."}

        try:
            hubs = clustering_service.identify_education_hubs(points_list)
            return hubs if hubs else {"type": "FeatureCollection", "features": []}
        except Exception as e:
            print(f"[MapAgent] geo_density error: {e}")
            return {"type": "FeatureCollection", "features": [], "error": str(e)}

    # ─────────────────────────────────────────────────────────────────────────
    # Tool: rag_search  — semantic search over ChromaDB
    # ─────────────────────────────────────────────────────────────────────────

    def rag_search(self, query: str, n_results: int = 5) -> List[Dict[str, Any]]:
        """Semantic search in ChromaDB knowledge base. Falls back to an
        empty list (never raises) so the agent can still answer LLM-only."""
        if vector_store is None or getattr(vector_store, "collection", None) is None:
            return []
        try:
            results = vector_store.query(query, n_results=n_results or 5, hybrid=True)
            documents = results.get("documents", [[]])
            metadatas = results.get("metadatas", [[]])
            ids = results.get("ids", [[]])
            distances = results.get("distances", [[]])

            doc_list = documents[0] if documents and len(documents) > 0 else []
            meta_list = metadatas[0] if metadatas and len(metadatas) > 0 else []
            id_list = ids[0] if ids and len(ids) > 0 else []
            dist_list = distances[0] if distances and len(distances) > 0 else []

            out: List[Dict[str, Any]] = []
            for i, doc in enumerate(doc_list):
                out.append({
                    "doc_id": id_list[i] if i < len(id_list) else str(i),
                    "title": (meta_list[i] or {}).get("title", f"Tài liệu {i+1}") if i < len(meta_list) else f"Tài liệu {i+1}",
                    "snippet": doc[:300] if doc else "",
                    "distance": round(float(dist_list[i]), 4) if i < len(dist_list) and dist_list[i] is not None else None,
                })
            return out
        except Exception as e:
            print(f"[MapAgent] rag_search error: {e}")
            return []

    # ─────────────────────────────────────────────────────────────────────────
    # System prompt
    # ─────────────────────────────────────────────────────────────────────────

    def _system_prompt(self) -> str:
        return (
            "Bạn là **Edumap AI Agent** — trợ lý thông minh chuyên về bản đồ giáo dục và dữ liệu "
            "địa lý của Việt Nam (trọng tâm DNTU / Biên Hòa, Đồng Nai). "
            "Nhiệm vụ của bạn là chuyển câu hỏi người dùng (ngôn ngữ tự nhiên) thành hành động "
            "bằng cách gọi công cụ (tool calling), thu thập dữ liệu, và đư ra câu trả lời tóm tắt "
            "kèm bằng chứng.\n\n"
            "Các công cụ bạn có sẵn:\n"
            "1. **query_sqlite** — chạy SELECT (chỉ đọc) trên SQLite. Các bảng: map_points "
            "(cột location là GeoJSON), jobs, career_paths, education_stats, "
            "learning_materials, scholarships, mentors, wifi_locations, stem_labs, events, "
            "hackathons, green_challenges, university_counseling, alumni_networks. "
            "Cột location của map_points: json_extract(location,'$.coordinates[1]') AS lat, "
            "json_extract(location,'$.coordinates[0]') AS lng. type_id: 1=university, "
            "2=school, 3=library, 4=bookstore, 5=lab, 6=wifi, 7=green, 8=cafe.\n"
            "2. **geo_recommend** — tìm địa điểm gần (lat,lng) trong bán kính km.\n"
            "3. **geo_density** — phân tích cụm DBSCAN trên danh sách points (JSON string).\n"
            "4. **rag_search** — tìm kiếm ngữ nghĩa trong ChromaDB.\n\n"
            "QUY TẮC TRƯỢT TÁI:\n"
            "- Nếu không biết tọa độ, dùng query_sqlite trước để tra cứu.\n"
            "- Chỉ gọi tool khi thực sự cần thiết; tránh gọi trùng lặp.\n"
            "- Tóm tắt kết quả ngắn gọn, rõ ràng bằng tiếng Việt, kèm nguồn tham khảo.\n"
            "- Nếu query_sqlite trả về lỗi SQL injection, hãy thử lại bằng cách sử dụng "
            "geo_recommend hoặc rag_search."
        )

    # ─────────────────────────────────────────────────────────────────────────
    # Agent loop (non-streaming)
    # ─────────────────────────────────────────────────────────────────────────

    def run_agent_loop(
        self,
        question: str,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """Synchronous agent loop: plan → execute tools → summarise.

        Returns ``{"reply": str, "tools_used": [...], "sources": [...]}``.
        If the LLM is unavailable, returns a degraded reply.
        """
        # XKIRO tool calling was removed from the provider chain (see
        # AGENTS.md §3). Always use plan-then-execute via
        # _generate_text_with_fallback (Cloudflare → Gemini → template).
        return self._fallback_plan_execute(question, history, [])

    # ─────────────────────────────────────────────────────────────────────────
    # Fallback: plan-then-execute (Gemini / non-tool-calling LLM)
    # ─────────────────────────────────────────────────────────────────────────

    def _fallback_plan_execute(
        self,
        question: str,
        history: Optional[List[Dict[str, str]]],
        tools_used: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """When XKIRO tool calling is unavailable, use plan-then-execute.

        The LLM (via _generate_text_with_fallback) is prompted to output a JSON
        plan of tool calls. We parse it, execute the tools, then prompt the LLM
        again to summarise the results.
        """
        # When no LLM provider is configured (HF Spaces free plan), use
        # keyword-based planning to run SQLite queries directly and produce a
        # template summary — so the agent still answers geo/data questions
        # from real Vietnamese data instead of just saying "service not ready".
        if not llm_service or not llm_service.is_ready:
            return self._keyword_plan_execute(question, history, tools_used)

        # Step 1: ask LLM to plan tool calls in JSON
        plan_prompt = f"""
Bạn là Edumap AI Agent. Phân tích câu hỏi và lên kế hoạch gọi công cụ.

Câu hỏi: "{question}"

Công cụ có sẵn:
- query_sqlite(sql): chạy SELECT trên SQLite. Bảng: map_points, jobs, career_paths, education_stats, learning_materials, scholarships, mentors. Cột location của map_points là GeoJSON.
- geo_recommend(lat, lng, radius_km, category, limit): tìm địa điểm gần (lat,lng) trong bán kính.
- geo_density(points): phân tích cụm DBSCAN. points là JSON string.
- rag_search(query, n_results): tìm kiếm ngữ nghĩa.

Hãy trả về JSON duy nhất (không giải thích thêm):
{{"tool_calls": [{{"tool": "query_sqlite", "arguments": {{"sql": "..."}}}}]}}

Nếu câu hỏi không cần gọi công cụ (ví dụ: chào hỏi, câu hỏi chung), trả về:
{{"tool_calls": []}}
"""
        try:
            plan_response = llm_service._generate_text_with_fallback(plan_prompt, temperature=0.2, max_tokens=1024)
        except Exception as e:
            return {
                "reply": f"Lỗi kế hoạch: {str(e)[:200]}",
                "tools_used": tools_used,
                "sources": [],
                "degraded": True,
            }

        plan = llm_service._extract_json(plan_response) or {}
        tool_calls = plan.get("tool_calls", [])
        if not tool_calls:
            # LLM couldn't plan — ask it to answer directly
            direct_prompt = f"""
Bạn là trợ lý ảnh của EduMap. Trả lời câu hỏi sau một cách thân thiện, ngắn gọn bằng tiếng Việt:
"{question}"

Nếu bạn không biết thông tin cụ thể, hãy nói rằng bạn không có dữ liệu và đề xuất người dùng
đặt câu hỏi cụ thể hơn (ví dụ: tìm trường học ở Biên Hòa, tìm học bổng, lộ trình học AI...).
"""
            try:
                reply = llm_service._generate_text_with_fallback(direct_prompt, temperature=0.7, max_tokens=1024)
                return {"reply": reply.strip(), "tools_used": [], "sources": [], "degraded": True}
            except Exception:
                return {
                    "reply": "Hiện tại tôi chưa thể trả lời câu hỏi này. Vui lòng thử câu hỏi cụ thể hơn.",
                    "tools_used": [],
                    "sources": [],
                    "degraded": True,
                }

        # Step 2: execute planned tool calls
        for tc in tool_calls:
            fn_name = tc.get("tool", "")
            fn_args = tc.get("arguments", {})
            tool_fn = self._tool_map.get(fn_name)
            if tool_fn is None:
                tools_used.append({"tool": fn_name, "error": f"Tool '{fn_name}' không tồn tại."})
                continue
            try:
                result = tool_fn(**fn_args)
                result_str = json.dumps(result, ensure_ascii=False, default=str)[:300]
                tools_used.append({"tool": fn_name, "arguments": fn_args, "result_preview": result_str})
            except Exception as ex:
                tools_used.append({"tool": fn_name, "error": str(ex)[:200]})

        # Step 3: summarise
        summary_prompt = f"""
Bạn là Edumap AI Agent. Dựa trên câu hỏi và kết quả công cụ thu thập được, hãy đư ra câu trả lời cuối cùng.

Câu hỏi: "{question}"

Kết quả công cụ:
{json.dumps(tools_used, ensure_ascii=False, indent=2)[:3000]}

Hãy trả lời ngắn gọn, rõ ràng bằng tiếng Việt, kèm nguồn tham khảo (nếu có). Trích dẫn dữ liệu thực tế từ kết quả công cụ.
"""
        try:
            reply = llm_service._generate_text_with_fallback(summary_prompt, temperature=0.3, max_tokens=2048)
            sources = self._extract_sources(tools_used)
            return {"reply": reply.strip(), "tools_used": tools_used, "sources": sources, "degraded": False}
        except Exception as e:
            return {
                "reply": "Tôi đã thu thập một số thông tin nhưng không thể tóm tắt. Vui lòng xem kết quả công cụ.",
                "tools_used": tools_used,
                "sources": [],
                "degraded": True,
            }

    # ─────────────────────────────────────────────────────────────────────────
    # Keyword-based plan (no LLM provider — HF Spaces free plan)
    # ─────────────────────────────────────────────────────────────────────────

    def _keyword_plan_execute(
        self,
        question: str,
        history: Optional[List[Dict[str, str]]],
        tools_used: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Plan-and-execute using regex/keyword heuristics when no LLM is configured.

        Detects common Vietnamese geo/education query patterns and runs
        SQLite queries directly. Always returns a valid reply (never 502/503).
        """
        q_lower = question.lower().strip()

        # Pattern: "tìm <type> ở/gần <place>" or "có <type> nào ở <place>"
        # → query map_points filtered by type + city/district keyword.
        _type_keywords = {
            "trường": [1, 2],       # university, school
            "trường đại học": [1],
            "trường trung học": [2],
            "thư viện": [3],
            "phòng lab": [5],
            "lab": [5],
            "wifi": [6],
            "khu xanh": [7],
            "quán cà phê": [8],
            "nhà sách": [4],
        }

        # Try to identify a location filter from the question
        city_keywords = ["biên hòa", "đồng nai", "tp.hcm", "tp hồ chí minh",
                         "hà nội", "đà nẵng", "cần thơ", "hải phòng",
                         "biên giới", "thị trấn", "thành phố"]
        matched_city = None
        for kw in city_keywords:
            if kw in q_lower:
                matched_city = kw.replace(".", " ")  # normalise
                break

        # Try to identify an education type
        matched_types: List[int] = []
        for kw, type_ids in _type_keywords.items():
            if kw in q_lower:
                matched_types.extend(type_ids)
        matched_types = list(set(matched_types))

        # Build and execute the SQLite query (inline values — query_sqlite
        # does not accept params; SQL-injection is already blocked by the
        # blocklist + allowlist + read-only mode in query_sqlite itself).
        sql = "SELECT name, type_id, address, city, district, rating_avg, " \
              "json_extract(location, '$.coordinates[1]') AS lat, " \
              "json_extract(location, '$.coordinates[0]') AS lng " \
              "FROM map_points WHERE location IS NOT NULL AND deleted_at IS NULL"

        conditions = []
        if matched_types:
            type_placeholders = ",".join(str(t) for t in matched_types)
            conditions.append(f"type_id IN ({type_placeholders})")
        if matched_city:
            # Inline the LIKE value (safe due to query_sqlite's blocklist).
            safe_city = matched_city.replace("'", "''")
            conditions.append(f"city LIKE '%{safe_city}%'")
        elif "biên hòa" in q_lower or "đồng nai" in q_lower:
            conditions.append("city LIKE '%Biên Hòa%'")

        if conditions:
            sql += " AND " + " AND ".join(conditions)

        sql += " LIMIT 20"

        try:
            results = self.query_sqlite(sql)
        except Exception as e:
            results = [{"error": f"Lỗi truy vấn: {e}"}]

        tools_used.append({
            "tool": "query_sqlite", "arguments": {"sql": sql},
            "result_preview": json.dumps(results[:3], ensure_ascii=False)[:300] if results else "",
        })

        sources = self._extract_sources(tools_used)

        # Template summary (no LLM needed)
        if results and not any("error" in r for r in results):
            # Build a readable template reply
            type_names = {1: "Đại học", 2: "Trường", 3: "Thư viện", 4: "Nhà sách",
                          5: "Lab", 6: "Wifi", 7: "Khu xanh", 8: "Quán cà phê"}
            parts = [f"Dựa trên dữ liệu hệ thống EduMap, tôi tìm thấy {len(results)} kết quả cho câu hỏi của bạn:"]
            for r in results[:10]:
                tname = type_names.get(r.get("type_id"), "Cơ sở")
                name = r.get("name", "Không tên")
                addr = r.get("address", "")
                city = r.get("city", "")
                rating = r.get("rating_avg", 0)
                parts.append(f"  • **{name}** ({tname}) — {addr}, {city}. Đánh giá: {rating}/5")
            parts.append("")
            parts.append("_Lưu ý: Đây là kết quả từ dữ liệu SQLite (chế độ offline). "
                         "Để nhận tư vấn chi tiết từ AI, hãy cấu hình CLOUDFLARE_API_TOKEN hoặc GEMINI_API_KEY._")
            reply = "\n".join(parts)
        elif results:
            reply = f"[Chế độ offline] Tìm thấy lỗi khi truy vấn SQLite: {results[0].get('error', 'Không xác định')}. " \
                    f"Vui lòng thử câu hỏi cụ thế hơn (ví dụ: 'Tìm trường ở Biên Hòa')."
        else:
            if matched_city:
                reply = f"Tôi không tìm thấy kết quả nào khớp với '{matched_city}' trong bảng dữ liệu. " \
                        f"Hãy thử câu hỏi khác hoặc kiểm tra chính tả."
            else:
                reply = "Tôi hiểu bạn đang hỏi về giáo dục. Để được hỗ trợ chính xác, " \
                        "vui lòng cho biết thêm địa điểm (ví dụ: 'Tìm trường ở Biên Hòa, Đồng Nai'). " \
                        "Tôi sẽ tìm kiếm trong cơ sở dữ liệu SQLite của EduMap."

        return {
            "reply": reply,
            "tools_used": tools_used,
            "sources": sources,
            "degraded": True,
        }

    # ─────────────────────────────────────────────────────────────────────────
    # Helpers
    # ─────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _extract_sources(tools_used: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract source documents from tool results."""
        sources: List[Dict[str, Any]] = []
        for tu in tools_used:
            result_preview = tu.get("result_preview", "")
            tool_name = tu.get("tool", "")
            if tool_name == "rag_search" and result_preview:
                try:
                    results = json.loads(result_preview)
                    for r in results:
                        sources.append({
                            "doc_id": r.get("doc_id", ""),
                            "title": r.get("title", ""),
                            "snippet": r.get("snippet", ""),
                            "type": "rag",
                        })
                except (json.JSONDecodeError, TypeError):
                    pass
            elif tool_name == "query_sqlite" and result_preview:
                try:
                    sql_results = json.loads(result_preview)
                    if isinstance(sql_results, list) and sql_results:
                        # Use the first row as a source snippet
                        first = sql_results[0] if isinstance(sql_results[0], dict) else {}
                        sources.append({
                            "doc_id": "sqlite",
                            "title": "Dữ liệu SQLite",
                            "snippet": json.dumps(first, ensure_ascii=False, default=str)[:200],
                            "type": "sql",
                        })
                except (json.JSONDecodeError, TypeError):
                    pass
        return sources

    # ─────────────────────────────────────────────────────────────────────────
    # Streaming agent (SSE)
    # ─────────────────────────────────────────────────────────────────────────

    async def stream_agent(
        self,
        question: str,
        history: Optional[List[Dict[str, str]]] = None,
    ):
        """Streaming agent — runs the full agent loop in a worker thread, then
        streams the final summary token-by-token via SSE.

        Yield format (same as chat_with_rag_stream):
          data: {"sources": [...], "tools_used": [...], "meta": true, "heartbeat": true}
          data: {"token": "...", "is_final": false}
          data: {"done": true}
        """
        # Heartbeat — keep the connection alive before the (blocking) agent runs
        yield self._sse("data", {"sources": [], "tools_used": [], "meta": True, "heartbeat": True})

        try:
            result = await asyncio.to_thread(self.run_agent_loop, question, history)
        except Exception as e:
            print(f"[MapAgent] stream_agent error: {e}")
            result = {
                "reply": "Lỗi hệ thống. Vui lòng thử lại.",
                "tools_used": [],
                "sources": [],
                "degraded": True,
            }

        # Send metadata (sources + tools used) before the text
        meta = {
            "sources": result.get("sources", []),
            "tools_used": result.get("tools_used", []),
            "meta": True,
        }
        yield self._sse("data", meta)

        # Stream the reply word-by-word for a typing effect
        reply = result.get("reply", "")
        import re as _re
        words = _re.split(r'( +|\n+)', reply)
        words = [w for w in words if w]
        for i, word in enumerate(words):
            is_final = i == len(words) - 1
            yield self._sse("data", {"token": word, "is_final": is_final, "done": is_final})
            if not is_final:
                await asyncio.sleep(0.02)
        # Ensure done chunk
        yield self._sse("data", {"done": True})

    @staticmethod
    def _sse(event_type: str, data: Dict[str, Any]) -> str:
        """Format a dict as an SSE data line."""
        return f"data: {json.dumps(data, ensure_ascii=False, default=str)}\n\n"


# ── Singleton ────────────────────────────────────────────────────────────────
map_agent = MapAgent()
