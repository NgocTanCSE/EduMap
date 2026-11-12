
import os
import sys
import json
import time
import socket
import threading
from typing import Any, Dict, List, Optional, Union
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
from urllib.parse import urlencode

TAVILY_BASE = "https://api.tavily.com"
SEARCH_URL = f"{TAVILY_BASE}/search"
EXTRACT_URL = f"{TAVILY_BASE}/extract"

CB_FAILURES = int(os.getenv("TAVILY_CIRCUIT_BREAKER_FAILURES", "5"))
CB_TTL = int(os.getenv("TAVILY_CIRCUIT_BREAKER_TTL", "300"))
REQUEST_TIMEOUT = float(os.getenv("TAVILY_TIMEOUT_SECONDS", "25"))
MAX_RESULTS_DEFAULT = int(os.getenv("TAVILY_MAX_RESULTS", "8"))
MAX_EXTRACT_URLS = 10   
MAX_EXTRACT_BATCH = 20  

_USER_AGENT = "EduMapTavilyCrawler/1.0 (+https://edumap.vn; contact admin@edumap.vn)"


class _CircuitBreaker:
    """Simple failure-count circuit breaker (open/half-open/close)."""

    def __init__(self, fail_threshold: int, ttl: int):
        self._fail_threshold = fail_threshold
        self._ttl = ttl
        self._failures = 0
        self._opened_at: float = 0.0
        self._lock = threading.Lock()

    def allow(self) -> bool:
        """Return True if a request is allowed (circuit closed or half-open)."""
        with self._lock:
            if self._failures >= self._fail_threshold:
                if time.time() - self._opened_at < self._ttl:
                    return False  
                return True
            return True

    def record_failure(self) -> None:
        with self._lock:
            self._failures += 1
            if self._failures >= self._fail_threshold and self._opened_at == 0.0:
                self._opened_at = time.time()

    def record_success(self) -> None:
        with self._lock:
            self._failures = 0
            self._opened_at = 0.0

    def state(self) -> str:
        with self._lock:
            if self._failures >= self._fail_threshold:
                remaining = max(0, self._ttl - int(time.time() - self._opened_at))
                return f"open({remaining}s)" if remaining else "half-open"
            return "closed"


_CB = _CircuitBreaker(CB_FAILURES, CB_TTL)


def _force_ipv4() -> None:
    """Monkeypatch socket.getaddrinfo to prefer AF_INET.

    host has an IPv6 egress blackhole that causes TLS handshakes to some
    HTTPS endpoints to hang until timeout.  Forcing IPv4 fixes the
    ``curl --ipv4`` requirement documented in AGENTS.md §3.
    """
    _orig = socket.getaddrinfo

    def _ipv4_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
        return _orig(host, port, socket.AF_INET, type, proto, flags)

    socket.getaddrinfo = _ipv4_getaddrinfo


_force_ipv4()


def _has_key() -> bool:
    return bool(os.getenv("TAVILY_API_KEY"))


class TavilyClient:
    """HTTP client for the Tavily Search + Extract APIs (stdlib only).

    All methods degrade gracefully: a network failure, 401/403, or missing key
    returns an empty list (never raises).  The circuit breaker opens after
    ``CB_FAILURES`` consecutive failures so the crawler loop skips Tavily
    quickly instead of burning time/credits on repeated timeouts.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("TAVILY_API_KEY", "")
        self._cb = _CircuitBreaker(CB_FAILURES, CB_TTL)
        self.last_error: Optional[str] = None


    def is_configured(self) -> bool:
        """True when a TAVILY_API_KEY env var is set."""
        return bool(self.api_key)

    def healthcheck(self) -> Dict[str, Any]:
        """Return a status snapshot (for logs / monitoring)."""
        return {
            "configured": self.is_configured(),
            "circuit_breaker": self._cb.state(),
            "last_error": self.last_error,
        }


    def _post(self, url: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """POST JSON to a Tavily endpoint; return parsed JSON or ``None``."""
        if not self._cb.allow():
            self.last_error = "circuit_open"
            return None
        headers = {
            "User-Agent": _USER_AGENT,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        body = json.dumps(payload).encode("utf-8")
        req = Request(url, data=body, headers=headers, method="POST")
        try:
            with urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
            self._cb.record_success()
            try:
                return json.loads(raw)
            except (ValueError, TypeError):
                self.last_error = "invalid_json"
                return None
        except HTTPError as e:
            self.last_error = f"http_{e.code}"
            self._cb.record_failure()
            if e.code in (401, 403):
                print(f"  [tavily] auth error {e.code} — check TAVILY_API_KEY")
            elif e.code in (429, 432, 433, 434):
                self._cb.record_failure()
                print(f"  [tavily] rate/limit {e.code} — circuit breaker engaged")
            return None
        except (URLError, socket.timeout, OSError) as e:
            self.last_error = f"network:{type(e).__name__}"
            self._cb.record_failure()
            return None


    def search(
        self,
        query: str,
        *,
        search_depth: str = "basic",
        max_results: int = MAX_RESULTS_DEFAULT,
        include_answer: bool = True,
        include_raw_content: bool = True,
        time_range: Optional[str] = None,
        language: Optional[str] = "vietnamese",
    ) -> List[Dict[str, Any]]:
        """Execute a Tavily Search.

        Returns a list of result dicts (each with ``title``, ``url``,
        ``content``, ``score``, ``raw_content``, ``published_date``).

        When the key is absent the call is still attempted (keyless mode) but
        returns ``[]`` on failure — the crawler degrades to curated data.
        """
        if not query or not query.strip():
            return []
        payload: Dict[str, Any] = {
            "query": query,
            "search_depth": search_depth,
            "max_results": max_results,
            "include_answer": include_answer,
            "include_raw_content": include_raw_content,
            "include_images": False,
            "include_favicon": False,
        }
        if time_range:
            payload["time_range"] = time_range
        if language:
            payload["language"] = language

        data = self._post(SEARCH_URL, payload)
        if not data:
            return []
        results = data.get("results", []) or []
        answer = data.get("answer")
        if answer:
            results.append({
                "title": f"AI trả lời: {query[:60]}",
                "url": f"search:{query}",
                "content": answer,
                "raw_content": answer,
                "score": 0.95,
                "published_date": None,
            })
        return results


    def extract(
        self,
        urls: Union[str, List[str]],
        *,
        query: Optional[str] = None,
        extract_depth: str = "basic",
        include_images: bool = False,
        format: str = "markdown",
    ) -> List[Dict[str, Any]]:
        """Extract readable content from 1–20 URLs via Tavily Extract.

        Returns a list of ``{"url", "raw_content"}`` dicts.  Per-URL failures
        are returned in ``failed_results`` but we normalise to a flat list
        of successful extractions here (callers iterate ``results``).
        """
        if isinstance(urls, str):
            url_list = [urls]
        else:
            url_list = list(urls)[:MAX_EXTRACT_BATCH]
        if not url_list:
            return []
        payload: Dict[str, Any] = {
            "urls": url_list,
            "extract_depth": extract_depth,
            "include_images": include_images,
            "format": format,
        }
        if query:
            payload["query"] = query

        data = self._post(EXTRACT_URL, payload)
        if not data:
            return []
        return data.get("results", []) or []


    def search_and_extract(
        self,
        query: str,
        *,
        search_depth: str = "basic",
        max_results: int = MAX_RESULTS_DEFAULT,
        extract_top_k: int = 5,
        extract_depth: str = "basic",
    ) -> List[Dict[str, Any]]:
        """Search Tavily, then extract full content from the top ``extract_top_k`` URLs.

        Each returned dict has ``title``, ``url``, ``content`` (search snippet),
        ``raw_content`` (full extracted article text), ``score``.

        This is the main entry point for crawlers: the ``raw_content`` field is
        where structured fields (salary, deadline, address, etc.) live.
        """
        results = self.search(
            query,
            search_depth=search_depth,
            max_results=max_results,
            include_raw_content=False,  
            include_answer=False,
        )
        if not results:
            return []
        urls = [r["url"] for r in results[:extract_top_k] if r.get("url", "").startswith("http")]
        extracted = self.extract(urls, extract_depth=extract_depth) if urls else []
        ext_by_url = {e["url"]: e.get("raw_content", "") for e in extracted}
        out: List[Dict[str, Any]] = []
        for r in results:
            url = r.get("url", "")
            out.append({
                "title": r.get("title", ""),
                "url": url,
                "content": r.get("content", ""),
                "raw_content": ext_by_url.get(url, r.get("raw_content", "")),
                "score": r.get("score", 0.0),
                "source": r.get("favicon", "").replace("//", "").replace("/", "") or "web",
            })
        return out


_default_client: Optional[TavilyClient] = None
_default_lock = threading.Lock()


def get_client() -> TavilyClient:
    """Return the process-wide TavilyClient singleton."""
    global _default_client
    if _default_client is None:
        with _default_lock:
            if _default_client is None:
                _default_client = TavilyClient()
    return _default_client


def tavily_search(query: str, **kw) -> List[Dict[str, Any]]:
    """Search Tavily (graceful — returns [] on any failure)."""
    return get_client().search(query, **kw)


def tavily_extract(urls, **kw) -> List[Dict[str, Any]]:
    """Extract from Tavily (graceful — returns [] on any failure)."""
    return get_client().extract(urls, **kw)


def tavily_search_and_extract(query: str, **kw) -> List[Dict[str, Any]]:
    """Search + extract via Tavily (graceful — returns [] on any failure)."""
    return get_client().search_and_extract(query, **kw)
