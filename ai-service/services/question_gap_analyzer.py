"""AI Question Gap Report — Idea #17 service (MEDIUM).

Reads anonymized query_logs from the shared SQLite DB, clusters the queries
by topic (TF-IDF + K-Means, with a keyword-based fallback when scikit-learn
is unavailable), identifies knowledge gaps (queries that retrieved zero
documents or received a low-quality response), and recommends documents
to fill each gap.

Privacy / risk compliance (per AGENTS.md):
  * ``user_id_hash`` is already anonymized upstream (SHA-256). We never
    re-identify users here.
  * Clustering is capped at **10 000 queries** (``MAX_QUERY_LIMIT``) so the
    TF-IDF + K-Means pass stays well under the NestJS stream timeout.
  * Results are cached 24 h in-process (HF Spaces has no Redis).
  * Graceful degradation: returns a valid-but-empty report on any failure.
"""

from __future__ import annotations

import json
import logging
import os
import re
import sqlite3
import time
from collections import Counter, defaultdict
from datetime import date as _date
from typing import Any, Dict, List, Optional, Tuple

# ── Optional sklearn ───────────────────────────────────────────────────────
# scikit-learn is listed in ai-service/requirements.txt.  The import is
# still guarded so the router never crashes if the package is missing.
try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.cluster import KMeans
    SKLEARN_OK = True
except ImportError:
    SKLEARN_OK = False

logger = logging.getLogger("question_gaps")

# ── Constants ───────────────────────────────────────────────────────────────

#: Hard cap on the number of queries analyzed — mitigates the
#: "clustering chậm" (slow clustering) risk documented in AGENTS.md.
MAX_QUERY_LIMIT = 10_000

#: Number of topic clusters to extract.
N_CLUSTERS = 12

#: A query is flagged as a "gap" when ANY of these hold.
GAP_RETRIEVAL_FAILED = "failed"
GAP_QUALITY_THRESHOLD = 0.30  # response_quality below this = likely gap

#: 24 h in-process cache (mirrors climate.py / forecast.py).
_CACHE: Dict[str, Tuple[float, Dict[str, Any]]] = {}
_CACHE_TTL_SECONDS = 24 * 3600

# Vietnamese stop-words (lightweight — no external dep).
_VIETNAMESE_STOPWORDS = frozenset({
    "và", "của", "các", "là", "để", "trong", "cho", "với", "tại", "về",
    "như", "được", "có", "không", "đã", "đã", "sẽ", "đang", "này", "đó",
    "nhưng", "hoặc", "nếu", "vì", "vì sao", "tại sao", "như thế", "ra",
    "vào", "từ", "trên", "xuống", "lên", "các", "một", "hai", "ba", "bài",
    "hỏi", "câu", "viết", "làm", "theo", "qua", "hơn", "nhiều", "ít",
    "cũng", "để", "giống", "so với", "kể cả", "thì", "mà", "vẫn",
    "tôi", "bạn", "anh", "chị", "em", "mình", "họ", "chúng", "tôi",
})


# ── SQLite access (mirrors analytics.py) ────────────────────────────────────

def _sqlite_path() -> Optional[str]:
    """Return the SQLite file used by the backend, when in SQLite mode."""
    if os.getenv("DB_TYPE", "postgres").lower() != "sqlite":
        return None
    path = os.getenv("DB_SQLITE_PATH", "/app/frontend/public/edumap.db")
    return path if os.path.exists(path) else None


def _query_sqlite(sql: str, params: Optional[Tuple] = None) -> List[Dict[str, Any]]:
    """Run a read-only query against the shared SQLite DB (HF Spaces mode)."""
    path = _sqlite_path()
    if not path:
        return []
    conn = None
    try:
        conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True, timeout=5)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute(sql, params or ())
        return [dict(row) for row in cur.fetchall()]
    except Exception as e:
        logger.error(f"SQLite question-gaps query failed: {e}")
        return []
    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass


# ── Caching ─────────────────────────────────────────────────────────────────

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
    _CACHE[key] = (time.time() + _CACHE_TTL_SECONDS, value)


# ── Preprocessing ───────────────────────────────────────────────────────────

def _clean_query(text: str) -> str:
    """Normalize query text for clustering: lowercase, strip noise."""
    if not text:
        return ""
    text = text.lower().strip()
    # Remove URLs, emails, extra whitespace.
    text = re.sub(r"https?://\S+", " ", text)
    text = re.sub(r"\S+@\S+", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text


def _tokenize(text: str) -> List[str]:
    """Simple word tokenizer that preserves Vietnamese diacritics."""
    if not text:
        return []
    tokens = re.findall(r"[a-zàáạảãâầấậẩẫăắằẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữýỳỵỷỵđ0-9]+", text)
    return [t for t in tokens if t and t not in _VIETNAMESE_STOPWORDS and len(t) > 1]


def _gap_fallback(cluster_terms: List[str], gap_queries: List[str]) -> List[str]:
    """Template-based doc recommendation when the LLM is unavailable.

    Derives human-readable document-title suggestions from the cluster's
    top TF-IDF terms + the most common gap queries.
    """
    recs = []
    # Suggest a document per top term.
    for term in cluster_terms[:3]:
        recs.append(f"Tài liệu hướng dẫn chi tiết về: {term}")
    # Suggest a document per common gap topic (deduplicated).
    seen = set()
    for q in gap_queries[:3]:
        q_clean = _clean_query(q)
        if q_clean and q_clean not in seen:
            seen.add(q_clean)
            recs.append(f"Câu hỏi thường gặp: {q_clean[:80]}")
    # Always at least one meaningful suggestion.
    if not recs:
        recs.append("Tài liệu giới thiệu chung về giáo dục Việt Nam")
    return recs[:5]


# ── Core analyzer ───────────────────────────────────────────────────────────

class QuestionGapAnalyzer:
    """Analyzes anonymized query_logs to find knowledge gaps.

    Instantiation is cheap — the heavy work (SQLite read + clustering) happens
    in :meth:`analyze_gaps`, which is cached 24 h in-process.
    """

    def __init__(self):
        self.max_query_limit = int(os.getenv("QUESTION_GAPS_MAX_QUERIES", str(MAX_QUERY_LIMIT)))
        self.n_clusters = int(os.getenv("QUESTION_GAPS_N_CLUSTERS", str(N_CLUSTERS)))

    # ── Public API ───────────────────────────────────────────────────────

    def analyze_gaps(self, limit: Optional[int] = None) -> Dict[str, Any]:
        """Read query_logs, cluster, identify gaps, recommend docs.

        Returns a dict matching the router's response model.  Never raises —
        callers always receive a valid report (possibly ``degraded=True``
        with empty clusters when no data exists).
        """
        n_limit = min(limit or self.max_query_limit, self.max_query_limit, MAX_QUERY_LIMIT)
        cache_key = f"gaps:{n_limit}"
        cached = _cache_get(cache_key)
        if cached is not None:
            cached = dict(cached)
            cached["cached"] = True
            logger.info("question-gaps cache hit: %s", cache_key)
            return cached

        try:
            raw_rows = self._load_query_logs(n_limit)
            result = self._build_report(raw_rows, n_limit)
        except Exception as e:
            logger.exception(f"QuestionGapAnalyzer.analyze_gaps failed: {e}")
            result = self._degraded_report(str(e))

        _cache_set(cache_key, dict(result))
        result["cached"] = False
        return result

    # ── Data loading ─────────────────────────────────────────────────────

    def _load_query_logs(self, limit: int) -> List[Dict[str, Any]]:
        """Read up to ``limit`` anonymized query_logs rows, newest first.

        Columns: user_id_hash, query_text, retrieved_doc_count,
        retrieval_status, response_text, response_quality, created_at.
        """
        rows = _query_sqlite(
            f"""
            SELECT user_id_hash, query_text, retrieved_doc_count,
                   retrieval_status, response_text, response_quality,
                   created_at
            FROM query_logs
            WHERE query_text IS NOT NULL AND length(query_text) > 0
            ORDER BY created_at DESC
            LIMIT {int(limit)}
            """,
        )
        logger.info("question-gaps: loaded %d query_log rows (limit=%d)", len(rows), limit)
        return rows

    # ── Clustering ───────────────────────────────────────────────────────

    def _cluster_queries(self, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Group queries into topic clusters.

        Uses TF-IDF + K-Means when scikit-learn is available; falls back to
        a lightweight keyword-based grouping otherwise.
        """
        texts = [_clean_query(r.get("query_text", "")) for r in rows]
        texts = [t for t in texts if t]

        if SKLEARN_OK and len(texts) >= 3:
            return self._cluster_tfidf(texts, rows)
        else:
            return self._cluster_keyword(texts, rows)

    def _cluster_tfidf(self, texts: List[str], rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """TF-IDF + K-Means clustering (preferred path)."""
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.cluster import KMeans

        n_clusters = min(self.n_clusters, max(2, len(texts) // 3))
        vectorizer = TfidfVectorizer(
            max_features=500,
            tokenizer=_tokenize,
            token_pattern=None,
            ngram_range=(1, 2),
        )
        tfidf = vectorizer.fit_transform(texts)
        km = KMeans(n_clusters=n_clusters, n_init=3, random_state=42)
        labels = km.fit_predict(tfidf.toarray())

        clusters = self._build_clusters_from_labels(labels, rows, texts, vectorizer)
        logger.info("question-gaps: K-Means produced %d clusters (sklearn)", len(clusters))
        return clusters

    def _build_clusters_from_labels(
        self,
        labels: List[int],
        rows: List[Dict[str, Any]],
        texts: List[str],
        vectorizer: Any,
    ) -> List[Dict[str, Any]]:
        """Convert K-Means labels into structured cluster dicts."""
        groups: Dict[int, List[int]] = defaultdict(list)
        for idx, label in enumerate(labels):
            groups[label].append(idx)

        # Map TF-IDF feature indices back to term strings.
        feature_names = vectorizer.get_feature_names_out()

        clusters = []
        for cid, indices in groups.items():
            cluster_rows = [rows[i] for i in indices]
            cluster_texts = [texts[i] for i in indices]
            # Top terms by average TF-IDF weight.
            cluster_tfidf = [row for row in cluster_texts]
            term_scores: Counter = Counter()
            for t in cluster_tfidf:
                for token in _tokenize(t):
                    term_scores[token] += 1
            top_terms = [t for t, _ in term_scores.most_common(5)]
            topic = self._topic_from_terms(top_terms, cluster_texts)
            clusters.append(
                self._make_cluster(cid, cluster_rows, cluster_texts, top_terms, topic)
            )
        # Sort by total query count descending.
        clusters.sort(key=lambda c: c["total_queries"], reverse=True)
        return clusters

    def _cluster_keyword(self, texts: List[str], rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Keyword-based fallback clustering — groups by the first significant token.

        Used when scikit-learn is not installed (e.g. minimal Docker image).
        """
        groups: Dict[str, List[int]] = defaultdict(list)
        for idx, t in enumerate(texts):
            tokens = _tokenize(t)
            key = tokens[0] if tokens else "khác"
            groups[key].append(idx)

        clusters = []
        for i, (key, indices) in enumerate(groups.items()):
            cluster_rows = [rows[idx] for idx in indices]
            cluster_texts = [texts[idx] for idx in indices]
            # Flatten tokens from all queries in this cluster, dedupe by first occurrence.
            flat_terms: List[str] = []
            seen_terms: set = set()
            for t in cluster_texts[:5]:
                for tok in _tokenize(t):
                    if tok not in seen_terms:
                        seen_terms.add(tok)
                        flat_terms.append(tok)
            topic = self._topic_from_terms(flat_terms[:5], cluster_texts)
            clusters.append(
                self._make_cluster(i, cluster_rows, cluster_texts, flat_terms[:5], topic)
            )
        clusters.sort(key=lambda c: c["total_queries"], reverse=True)
        logger.info("question-gaps: keyword clustering produced %d groups", len(clusters))
        return clusters

    def _topic_from_terms(self, terms: List[str], texts: List[str]) -> str:
        """Derive a human-readable topic label from cluster terms."""
        if not terms:
            return "chủ đề khác"
        # Use a bigram from the most common query if possible; otherwise the top term.
        # Look for the longest common bigram prefix across cluster queries.
        if len(terms) >= 2:
            return f"{terms[0]} {terms[1]}"
        return terms[0]

    def _make_cluster(
        self,
        cid: int,
        cluster_rows: List[Dict[str, Any]],
        cluster_texts: List[str],
        top_terms: List[str],
        topic: str,
    ) -> Dict[str, Any]:
        """Assemble a single cluster dict with gap metrics + doc recommendations."""
        gap_rows = [
            r for r in cluster_rows
            if self._is_gap(r)
        ]
        gap_rate = round(len(gap_rows) / max(len(cluster_rows), 1), 3)

        gap_queries = [r.get("query_text", "") for r in gap_rows][:10]
        representative = cluster_rows[0].get("query_text", "") if cluster_rows else ""

        # Doc recommendations (LLM + template fallback).
        recommended_docs = self._recommend_docs(top_terms, gap_queries, topic)

        return {
            "cluster_id": int(cid),
            "topic": topic,
            "total_queries": len(cluster_rows),
            "gap_count": len(gap_rows),
            "gap_rate": gap_rate,
            "top_terms": top_terms[:5],
            "representative_query": representative,
            "gap_queries": gap_queries,
            "recommended_docs": recommended_docs,
        }

    def _is_gap(self, row: Dict[str, Any]) -> bool:
        """A query is a 'gap' if retrieval failed, zero docs returned, or quality is very low."""
        status = (row.get("retrieval_status") or "").lower()
        doc_count = int(row.get("retrieved_doc_count") or 0)
        quality = float(row.get("response_quality") or 0.0)
        if status == GAP_RETRIEVAL_FAILED:
            return True
        if doc_count == 0:
            return True
        if quality < GAP_QUALITY_THRESHOLD:
            return True
        return False

    # ── Doc recommendation ──────────────────────────────────────────────

    def _recommend_docs(self, terms: List[str], gap_queries: List[str], topic: str) -> List[str]:
        """Ask the LLM for doc recommendations, fall back to templates."""
        try:
            from services.llm_service import llm_service
            if llm_service and llm_service.is_ready and terms:
                prompt = self._doc_recommendation_prompt(terms, gap_queries, topic)
                response = llm_service._generate_text_with_fallback(
                    prompt,
                    temperature=0.3,
                    max_tokens=1024,
                    top_p=0.8,
                )
                recs = self._extract_json(response)
                if isinstance(recs, list) and len(recs) > 0:
                    # Validate: each entry should be a string.
                    clean = [str(r) for r in recs if r]
                    if clean:
                        return clean[:5]
        except Exception as e:
            logger.warning(f"LLM doc recommendation failed, using template fallback: {e}")

        # Template-based fallback.
        return _gap_fallback(terms, gap_queries)

    def _doc_recommendation_prompt(self, terms: List[str], gap_queries: List[str], topic: str) -> str:
        terms_str = ", ".join(terms[:5])
        gaps_str = "; ".join(gap_queries[:5])
        return f"""Bạn là chuyên gia phân tích nội dung giáo dục tại Việt Nam.

Chủ đề cụm: "{topic}"
Từ khóa chính: {terms_str}
Các câu hỏi thường gặp chưa được trả lời tốt:
{gaps_str}

Nhiệm vụ: Đề xuất 5 tiêu đề tài liệu (trong tiếng Việt) mới cần được thêm vào
hệ thống tri thức để trả lời tốt hơn cho những câu hỏi này. Mỗi tiêu đề ngắn
gọn, rõ ràng, tập trung vào giáo dục Việt Nam.

Trả về **mảng JSON** các chuỗi: ["Tiêu đề 1", "Tiêu đề 2", ...].
Không cần giải thích thêm."""

    @staticmethod
    def _extract_json(text: str):
        """Best-effort JSON extraction from LLM text (array or object)."""
        if not text:
            return None
        try:
            import json as _json, re as _re
            match = _re.search(r'```json\s*([\s\S]*?)\s*```', text)
            if match:
                try:
                    return _json.loads(match.group(1).strip())
                except Exception:
                    pass
            cleaned = text.strip()
            start_obj = cleaned.find('{')
            start_arr = cleaned.find('[')
            if start_arr != -1 and (start_obj == -1 or start_arr < start_obj):
                end = cleaned.rfind(']') + 1
                if end > start_arr:
                    try:
                        return _json.loads(cleaned[start_arr:end])
                    except Exception:
                        pass
            if start_obj != -1:
                end = cleaned.rfind('}') + 1
                if end > start_obj:
                    try:
                        return _json.loads(cleaned[start_obj:end])
                    except Exception:
                        pass
        except Exception:
            pass
        return None

    # ── Report assembly ─────────────────────────────────────────────────

    def _build_report(self, rows: List[Dict[str, Any]], n_limit: int) -> Dict[str, Any]:
        """Assemble the full gap report from raw query_log rows."""
        total = len(rows)
        date_range = {"start": None, "end": None}
        if rows:
            dates = [r.get("created_at") for r in rows if r.get("created_at")]
            date_range = {
                "start": min(dates) if dates else None,
                "end": max(dates) if dates else None,
            }

        clusters = self._cluster_queries(rows) if total > 0 else []

        # Flat list of the most severe gap queries.
        gap_rows = [r for r in rows if self._is_gap(r)]
        top_gaps = []
        for r in gap_rows[:20]:
            top_gaps.append({
                "query_text": r.get("query_text", "")[:200],
                "retrieved_doc_count": int(r.get("retrieved_doc_count") or 0),
                "retrieval_status": r.get("retrieval_status") or "unknown",
                "response_quality": float(r.get("response_quality") or 0.0),
                "created_at": r.get("created_at"),
            })

        # Summary
        gap_pct = round(len(gap_rows) / max(total, 1) * 100, 1)
        avg_quality = (
            round(sum(float(r.get("response_quality") or 0) for r in rows) / max(total, 1), 3)
            if rows else 0.0
        )
        summary = (
            f"Phân tích {total} câu truy vấn (giới hạn {n_limit}, tuân thủ TTL 30 ngày). "
            f"{len(gap_rows)} câu ({gap_pct}%) được đánh dấu là khoảng trống tri thức "
            f"(retrieval thất bại hoặc chất lượng thấp <{GAP_QUALITY_THRESHOLD}). "
            f"Trung bình chất lượng phản hồi: {avg_quality}."
        )

        return {
            "status": "success",
            "degraded": False,
            "generated_at": _date.today().isoformat(),
            "total_queries": total,
            "date_range": date_range,
            "limit_applied": n_limit,
            "privacy": {
                "user_id_hashed": True,
                "hash_algorithm": "sha256",
                "ttl_days": 30,
            },
            "clusters": clusters,
            "top_gaps": top_gaps,
            "summary": summary,
        }

    def _degraded_report(self, reason: str) -> Dict[str, Any]:
        """Valid-but-empty report returned on any failure."""
        logger.warning(f"question-gaps degraded report: {reason}")
        return {
            "status": "degraded",
            "degraded": True,
            "reason": reason,
            "generated_at": _date.today().isoformat(),
            "total_queries": 0,
            "date_range": {"start": None, "end": None},
            "limit_applied": self.max_query_limit,
            "clusters": [],
            "top_gaps": [],
            "summary": "Khoảng trống tri thức chưa khả dụng — dịch vụ AI hoặc CSDL tạm thời không sẵn sàng.",
        }


# ── Singleton (mirrors clustering_service / climate_guardian) ────────────────
question_gap_analyzer = QuestionGapAnalyzer()
