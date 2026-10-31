#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
tavily_parse.py — Shared helpers for turning Tavily Search/Extract results
into structured EduMap row dicts.

All data crawlers (jobs, internships, events, scholarships, hackathons, etc.)
share the same workflow:

    1. tavily_client.tavily_search_and_extract(query)  -> list of web results
       with `title`, `url`, `content` (snippet), `raw_content` (full article).
    2. tavily_parse.parse_jobs(raw_text) / parse_events(...) / etc.
       -> list of row dicts matching the target SQLite schema.

The parsers use regex + heuristics (not a live LLM) so they work on the
2-vCPU HF Spaces free tier with zero latency.  They preserve Vietnamese
diacritics (AGENTS.md §6: ``clean_text`` must not ASCII-fold).

Graceful by design: every parser returns ``[]`` on empty/invalid input
— the caller upserts 0 rows instead of crashing.
"""
import re
import os
import html as _html
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime, timezone

# --------------------------------------------------------------------------- #
# Text helpers (Vietnamese-aware)                                             #
# --------------------------------------------------------------------------- #

def clean_text(text: Any) -> str:
    """Unescape HTML entities, strip tags, collapse whitespace.

    PRESERVES Vietnamese diacritics (AGENTS.md §6 data policy).  The old
    ASCII-folding broke ``Cong ty CTM CMC``-style company names.
    """
    if text is None:
        return ""
    text = _html.unescape(str(text))
    text = re.sub(r"<[^>]{1,200}>", " ", text)
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
    return re.sub(r"\s+", " ", text).strip()


def truncate(text: Any, n: int) -> str:
    """Clean then truncate to *n* characters."""
    return clean_text(text)[:n]


# --------------------------------------------------------------------------- #
# Field extractors — each returns (value, found_bool) for a single text blob  #
# --------------------------------------------------------------------------- #

def extract_salary(text: str) -> Optional[str]:
    """Best-effort salary extraction from free text.

    Handles VND / USD / EUR patterns:
      '15 - 20 triệu', '15-20 triệu VND', '$1,200-$2,000', '1000 - 1500 USD',
      'từ 20 triệu', 'lên tới 500 USD'.
    """
    if not text:
        return None
    t = text.lower()
    # Vietnamese: "X - Y triệu" / "từ X triệu" / "lên tới Y triệu"
    m = re.search(r"(\d[\d\.,]*(?:\s*-\s*\d[\d\.,]*)?)\s*(triệu|đ|dong|vnd)", t)
    if m:
        return m.group(0).replace("triệu", "triệu").strip()
    # USD / EUR / GBP: "$X-Y", "X-Y USD"
    m = re.search(r"(?:usd|eur|gbp)?\s*\$?\s*(\d[\d\.,]*)\s*(?:-\s*\$?\s*(\d[\d\.,]*))?\s*(usd|eur|gbp|vnd)?", t)
    if m:
        return m.group(0).strip()
    # Fallback: bare number + "triệu"
    m = re.search(r"(\d+\.?\d*)\s*triệu", t)
    if m:
        return f"{m.group(1)} triệu"
    return None


def extract_deadline(text: str) -> Optional[str]:
    """Extract a date from text.  Returns ISO date string (YYYY-MM-DD) or None.

    Looks for common date patterns in Vietnamese/English job-posting text.
    Returns ``None`` when no date is found (callers supply a default).
    """
    if not text:
        return None
    # ISO dates: 2025-12-31, 2025/12/31
    m = re.search(r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})", text)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        try:
            return datetime(y, mo, d).strftime("%Y-%m-%d")
        except ValueError:
            pass
    # DD/MM/YYYY or DD.MM.YYYY
    m = re.search(r"(\d{1,2})[-/\.](\d{1,2})[-/\.](\d{4})", text)
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        try:
            return f"{y:04d}-{mo:02d}-{d:02d}"
        except ValueError:
            pass
    # "31/12/2025" handled above.  Try "tháng 12 năm 2025" / "December 2025"
    m = re.search(r"(?:tháng\s*(\d{1,2})|(\d{1,2})[\/\-](\d{4}))", text.lower())
    if m:
        month = m.group(1) or m.group(2)
        year = m.group(3) or m.group(4)
        if month and year:
            try:
                return f"{int(year):04d}-{int(month):02d}-28"
            except (ValueError, TypeError):
                pass
    return None


def extract_company(text: str) -> Optional[str]:
    """Extract a company name from text.  Heuristic: look for patterns
    like 'công ty ABC', 'Công ty TNHH XYZ', 'ABC tuyển dụng', etc."""
    if not text:
        return None
    # "Công ty TNHH ABC" / "Công ty ABC"
    m = re.search(r"[Cc]ông ty\s+(?:tnhh|trách nhiệm)\s+(\S[^.\,]{2,80})", text)
    if m:
        return clean_text(m.group(1))[:200]
    # "Tên công ty: ABC"
    m = re.search(r"[Tt]ên công ty[:\s]+([^\n\,\.]{3,120})", text)
    if m:
        return clean_text(m.group(1))[:200]
    return None


def infer_job_type(text: str, title: str = "") -> str:
    """Infer job_type enum from text + title keywords."""
    blob = (text + " " + title).lower()
    if any(h in blob for h in ("thực tập", "intern", "trainee")):
        return "internship"
    if any(h in blob for h in ("freelance", "tự do", "contract", "hợp đồng")):
        return "freelance"
    if any(h in blob for h in ("part time", "part-time", "bán thời gian")):
        return "part_time"
    if "full time" in blob or "full-time" in blob or "toàn thời gian" in blob:
        return "full_time"
    return "full_time"


def _location_layer(location_str: str) -> str:
    """Classify a posting's location into its scope layer.

    Đồng Nai → miền Nam → VN → ĐNA → unscoped.
    """
    if not location_str:
        return "unscoped"
    hay = location_str.lower()
    # Đồng Nai / Biên Hòa / Bình Dương / Vũng Tàu
    if any(k.lower() in hay for k in ("đồng nai", "biên hòa", "bình dương", "vũng tàu")):
        return "dong_nai"
    # Southern provinces
    southern = ["tp.hồ chí minh", "tp. hồ chí minh", "hồ chí minh", "hcmc", "cần thơ",
                "long an", "tiền giang", "bến tre", "vĩnh long", "trà vinh", "đồng tháp",
                "an giang", "kiên giang", "hậu giang", "sóc trăng", "bạc liêu", "cà mau",
                "đắk lắk", "đắk nông", "gia lai", "kon tum", "lâm đồng", "bình thuận",
                "ninh thuận", "bình phước", "bà rịa", "bạc liêu"]
    if any(k in hay for k in southern):
        return "southern_vn"
    # "việt nam" / "vietnam" / "toàn quốc" → national scope.
    if any(k in hay for k in ("việt nam", "vietnam", "toàn quốc", "hà nội",
                              "đà nẵng", "hải phòng", "quảng ninh", "hải dương",
                              "hưng yên", "thái bình", "nam định", "phú thọ", "bắc ninh")):
        return "vietnam"
    # Southeast Asia
    sea = ["thái lan", "indonesia", "malaysia", "philippines", "singapore", "myanmar",
           "laos", "campuchia", "brunei"]
    if any(k in hay for k in sea):
        return "sea"
    return "unscoped"


def extract_location(text: str) -> Optional[str]:
    """Extract a location string (city/province) from text."""
    if not text:
        return None
    # Common VN cities/provinces mentioned in job texts.
    for city in ("đồng nai", "biên hòa", "tp.hồ chí minh", "hồ chí minh", "hà nội",
                 "đà nẵng", "cần thơ", "hải phòng", "quận 1", "quận 3", "bình dương",
                 "vũng tàu", "long an", "tiền giang", "bến tre", "cà mau", "an giang"):
        if city in text.lower():
            return city.replace("_", " ").title() if city == "tp.hồ chí minh" else city.title()
    return None


def extract_coords(text: str) -> Tuple[Optional[float], Optional[float]]:
    """Extract (lat, lng) from text containing coordinate patterns.

    Looks for patterns like:
      'tọa độ 10.9835, 106.8686'
      'lat: 10.9200, lng: 106.8195'
      '10.9300, 106.8350'
    """
    if not text:
        return None, None
    # Match coordinate pairs (lat, lng) — lat is 8-11° for VN, lng is 102-109°
    m = re.search(
        r"(?:lat(?:itude)?[:\s=]*|tọa độ\s*)?(\d{1,3}\.\d{3,8})\s*[,;\s]\s*(\d{1,3}\.\d{3,8})",
        text,
    )
    if not m:
        # Bare pair like "10.9835, 106.8686"
        m = re.search(r"(\d{1,3}\.\d{3,8})\s*,\s*(\d{1,3}\.\d{3,8})", text)
    if m:
        try:
            lat, lng = float(m.group(1)), float(m.group(2))
            # Sanity-check VN bounds (AGENTS.md §9 coordinate fix).
            if 8.0 <= lat <= 24.0 and 102.0 <= lng <= 109.5:
                return lat, lng
        except (ValueError, TypeError):
            pass
    return None, None


# --------------------------------------------------------------------------- #
# Row builders — produce dicts matching the existing SQLite schema          #
# --------------------------------------------------------------------------- #

def make_job_row(
    title: str,
    company: str = "",
    location: str = "",
    description: str = "",
    tags: Optional[List[str]] = None,
    job_type: Optional[str] = None,
    salary: Optional[str] = None,
    logo: Optional[str] = None,
    source_url: str = "",
    crawl_year: int = 0,
) -> Dict[str, Any]:
    """Build a ``jobs`` row dict (matches jobs_crawler._base_row / crawl_jobs._base_job)."""
    from crawl_scope import in_year_scope  # lazy to avoid circular imports
    tags = tags or []
    desc = clean_text(description) or ""
    if tags:
        desc = f"{desc} | Tags: {','.join(str(t) for t in tags)}"[:2000]
    if not location:
        location = "Việt Nam"
    infer_type = job_type or infer_job_type(desc, title)
    deadline = extract_deadline(desc) or extract_deadline(title)
    from crawl_scope import year_scope_range
    _, _year_max = year_scope_range()
    import datetime as _dt
    default_deadline = _dt.datetime(_year_max, 12, 31, 23, 59, 59)
    if not deadline or not in_year_scope(deadline):
        deadline = default_deadline.date().isoformat()
    return {
        "title": (title or "")[:255],
        "company_name": (company or "")[:255],
        "location": (location or "Việt Nam")[:255],
        "location_scope": _location_layer(location),
        "description": desc,
        "job_type": infer_type,
        "salary_range": salary,
        "required_skills": _json(tags),
        "experience_level": "any",
        "application_deadline": deadline,
        "views": 0,
        "status": "active",
        "image_url": logo,
        "source_url": source_url,
        "crawl_year": crawl_year,
    }


def make_internship_row(
    title: str,
    company: str = "",
    description: str = "",
    field: str = "internship",
    tags: Optional[List[str]] = None,
    salary: Optional[str] = None,
    logo: Optional[str] = None,
    source_url: str = "",
    crawl_year: int = 0,
) -> Dict[str, Any]:
    """Build an ``internships`` row dict."""
    from crawl_scope import in_year_scope, year_scope_range
    tags = tags or []
    desc = clean_text(description) or ""
    if tags:
        desc = f"{desc} | Tags: {','.join(str(t) for t in tags)}"[:2000]
    deadline = extract_deadline(desc) or extract_deadline(title)
    _, _year_max = year_scope_range()
    import datetime as _dt
    if not deadline or not in_year_scope(deadline):
        deadline = _dt.datetime(_year_max, 12, 31, 23, 59, 59)
    return {
        "title": (title or "")[:255],
        "company_id": None,
        "company_name": (company or "")[:255],
        "location": "Việt Nam",
        "location_scope": "vietnam",
        "description": desc,
        "field": (str(field)[:100] if field else "internship"),
        "location_point": None,
        "salary_range": salary,
        "duration": "Flexible",
        "requirements": clean_text(description)[:500] if description else "Xem mô tả chi tiết.",
        "benefits": "Làm việc linh hoạt, phát triển kỹ năng.",
        "deadline": deadline,
        "application_count": 0,
        "status": "open",
        "image_url": logo,
    }


def make_event_row(
    title: str,
    description: str = "",
    address: str = "Việt Nam",
    start_date=None,
    end_date=None,
    banner_url: Optional[str] = None,
    meeting_url: Optional[str] = None,
    tags: Optional[List[str]] = None,
    price: Any = 0,
    source_url: str = "",
) -> Dict[str, Any]:
    """Build an ``events`` row dict."""
    from crawl_scope import in_year_scope
    import datetime as _dt
    now = _dt.datetime.utcnow()
    start = start_date or now
    if not in_year_scope(start.date().isoformat()):
        start = now
    end = end_date or (start + _dt.timedelta(days=1))
    desc = clean_text(description) or ""
    if source_url:
        desc = f"{desc} | Chi tiết: {source_url}"[:3000]
    return {
        "title": (title or "")[:255],
        "description": desc,
        "type": "event",
        "location_point": None,
        "location_scope": "vietnam",
        "address": address or "Việt Nam",
        "start_date": start,
        "end_date": end,
        "capacity": 200,
        "registered_count": 0,
        "banner_url": banner_url,
        "organizer_id": None,
        "status": "active" if start >= now else "inactive",
        "tags": _json(["event"] + (tags or [])),
        "is_online": bool(meeting_url),
        "meeting_url": meeting_url,
        "price": price,
    }


def make_scholarship_row(
    title: str,
    description: str = "",
    provider: str = "Cộng đồng",
    value_amount: Optional[Any] = None,
    deadline=None,
    image_url: Optional[str] = None,
    apply_url: str = "",
    tags: Optional[List[str]] = None,
    source_url: str = "",
) -> Dict[str, Any]:
    """Build a ``scholarships`` row dict."""
    from crawl_scope import in_year_scope
    import datetime as _dt
    now = _dt.datetime.utcnow()
    if deadline is None or not in_year_scope(deadline.date().isoformat() if hasattr(deadline, 'date') else str(deadline)):
        deadline = now + _dt.timedelta(days=30)
    desc = clean_text(description) or ""
    return {
        "title": (title or "")[:255],
        "description": desc,
        "provider": (provider or "Cộng đồng")[:255],
        "location": None,
        "location_scope": "vietnam",
        "value_amount": value_amount,
        "deadline": deadline,
        "image_url": image_url,
        "eligibility_criteria": _json({"source": source_url, "tags": tags or []}),
        "apply_url": apply_url or source_url,
        "status": "active",
    }


def make_post_row(
    title: str,
    content: str = "",
    source: str = "tavily",
    media_urls: Optional[List[str]] = None,
    tags: Optional[List[str]] = None,
    like_count: int = 0,
    comment_count: int = 0,
    post_tag: str = "community",  # community / social / hackathon
    source_url: str = "",
) -> Dict[str, Any]:
    """Build a ``posts`` row dict (tag=community/social/hackathon)."""
    return {
        "title": (title or "")[:255],
        "source": source,
        "content": clean_text(content)[:3000],
        "media_urls": _json(media_urls or []),
        "tags": _json([post_tag, source] + (tags or [])),
        "like_count": like_count,
        "comment_count": comment_count,
        "status": "active",
        "pinned": False,
    }


def make_donation_row(
    title: str,
    description: str = "",
    target_amount: Any = 0,
    current_amount: Any = 0,
    image_url: Optional[str] = None,
    source_url: str = "",
) -> Dict[str, Any]:
    """Build a ``donation_campaigns`` row dict."""
    import datetime as _dt
    now = _dt.datetime.utcnow()
    return {
        "title": (title or "")[:255],
        "description": clean_text(description)[:500],
        "target_amount": target_amount,
        "current_amount": current_amount,
        "organizer_id": None,
        "location_point": None,
        "location_scope": "vietnam",
        "status": "active",
        "start_date": now,
        "end_date": now + _dt.timedelta(days=30),
        "images": _json([image_url] if image_url else []),
    }


def make_map_point_row(
    name: str,
    description: str = "",
    category: str = "poi",
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    address: str = "",
    city: str = "",
    province: str = "",
    source: str = "tavily",
    location_scope: str = "vietnam",
) -> Dict[str, Any]:
    """Build a ``map_points`` row dict (SQLite WKT POINT geometry).

    On SQLite (HF Spaces) the ``location`` column stores WKT
    ``POINT(lng lat)`` which ``db_utils.upsert_rows`` can handle
    (AGENTS.md §7: no PostGIS ``ST_MakePoint`` on SQLite).
    """
    if lat is None or lng is None:
        return {}
    # Validate coordinates (AGENTS.md §9 coordinate fix — skip out-of-range).
    if not (8.0 <= lat <= 24.0 and 102.0 <= lng <= 109.5):
        return {}
    return {
        "name": (name or "")[:255],
        "description": (description or category)[:500],
        "category": category,
        "location": f"POINT({lng} {lat})",
        "address": (address or "")[:300],
        "city": (city or "")[:100],
        "province": (province or "")[:100],
        "location_scope": location_scope,
        "source": source,
        "crawl_year": 0,
    }


def make_wifi_row(
    name: str,
    lat: float,
    lng: float,
    address: str = "",
    speed_mbps: Optional[int] = None,
    provider: str = "",
    hint: Optional[str] = None,
    location_scope: str = "dong_nai",
) -> Dict[str, Any]:
    """Build a ``wifi_locations`` row dict."""
    if not (8.0 <= lat <= 24.0 and 102.0 <= lng <= 109.5):
        return {}
    return {
        "name": (name or "")[:255],
        "location_point": f"POINT({lng} {lat})",
        "address": (address or "")[:300],
        "speed_mbps": speed_mbps,
        "is_free": True,
        "password": None,
        "hint": (hint or "")[:200],
        "provider": (provider or "")[:200],
        "rating_avg": 0.0,
        "verified": False,
        "reported_by": None,
        "location_scope": location_scope,
    }


def make_badge_row(name: str, description: str, icon_url: Optional[str],
                   category: str, points_criteria: int, rarity: str) -> Dict[str, Any]:
    return {
        "name": (name or "")[:255],
        "description": (description or "")[:500],
        "icon_url": icon_url,
        "category": category,
        "points_criteria": points_criteria,
        "rarity": rarity,
    }


def make_green_challenge_row(title: str, description: str, type_: str,
                             start_date: str, end_date: str, points_reward: int,
                             status: str = "active") -> Dict[str, Any]:
    return {
        "title": (title or "")[:255],
        "description": (description or "")[:500],
        "type": (type_ or "recycle"),
        "start_date": start_date,
        "end_date": end_date,
        "points_reward": points_reward,
        "status": status,
        "participant_count": 0,
    }


def _json(obj: Any) -> str:
    """Serialise to JSON string (for SQLite TEXT columns)."""
    import json as _json_mod
    return _json_mod.dumps(obj, ensure_ascii=False) if obj is not None else None


# --------------------------------------------------------------------------- #
# Tavily result → structured row parsers                                       #
# --------------------------------------------------------------------------- #

# Regex for parsing Tavily search-result titles / content to extract jobs.
# Tavily result titles often look like: "Tuyển Dung Lap Trinh Vien Java - ABC Corp"
_JOB_TITLE_RE = re.compile(
    r"(?:tuyển\s+d?ng|tuyển\s+d?ụng|tuyển\s+d?ụng\s+ngay|tuyển\s+d?ụng\s+gấp|"
    r"urgent|tuyển\s+d?ụng|job|recruitment|tuyển\s+d?ụng|tuyen\s+dung)\s*"
    r"(?:\W*\s*)?(lập\s*trình\s*viên|lập\s*trình\s+viên|developer|backend|"
    r"frontend|fullstack|full\s*stack|devops|qa|tester|data\s*analyst|data\s*"
    r"scientist|product\s*manager|designer|designer\s*giảm|senior|junior|"
    r"trưởng\s* nhóm|team\s*lead|architech|architect|engineer|kỹ\s*sư|"
    r"chuyên\s*viên|nhân\s*viên|người\s* làm\s* việc|staff|specialist|"
    r"officer|manager)\b[^|]{0,200}",
    re.IGNORECASE | re.UNICODE,
)
# Salary patterns: "15 - 20 triệu", "15-20 triệu", "$1,200 - $2,000", "20-30tr"
_SALARY_RE = re.compile(
    r"(\d[\d\.,]*(?:\s*-\s*\d[\d\.,]*)?)\s*(triệu|tr|vnd|đ|usd|eur|gbp|\$)?",
    re.IGNORECASE,
)


def _split_title_company(raw_title: str, raw_content: str) -> Tuple[str, str, str]:
    """Split a Tavily result title+content into (title, company, location_guess).

    Tavily titles from job boards often embed company + location, e.g.
      "Lập trình viên Python, Công ty ABC, HCM - 15-20 triệu"
    or just a page headline with the company elsewhere in the content.
    """
    title = clean_text(raw_title)[:255]
    company = ""
    location = ""

    # Try to find "Công ty ..." pattern in the content.
    company = extract_company(raw_content + " " + title) or ""

    # Try to find a Vietnamese city in the title/content.
    for city in ("đồng nai", "biên hòa", "tp.hồ chí minh", "hồ chí minh",
                 "hà nội", "đà nẵng", "cần thơ", "bình dương", "vũng tàu"):
        if city in title.lower():
            location = city
            break
    if not location:
        location = extract_location(raw_content) or extract_location(title) or ""

    # If title looks like "Lập trình viên X - Công ty Y", split on " - " or " | ".
    if not company:
        parts = re.split(r"\s*[-|]\s*", title)
        if len(parts) >= 2:
            # Last part is often the company.
            possible_company = parts[-1].strip()
            if len(possible_company) < 80 and len(possible_company) > 2:
                company = possible_company
                title = " - ".join(parts[:-1])

    return title, company, location


def parse_tavily_jobs(
    tavily_results: List[Dict[str, Any]],
    *,
    source_name: str = "web",
) -> List[Dict[str, Any]]:
    """Parse a list of Tavily search results into ``jobs`` row dicts.

    Each result dict should have ``title``, ``url``, ``content`` (snippet),
    and ``raw_content`` (full extracted article text).

    The parser:
      • uses the search result title as the job title (cleaned)
      • extracts company name from content via keyword regex
      • extracts salary, deadline, location from the raw content
      • uses the raw_content as the job description (truncated)
    Falls back gracefully — returns ``[]`` on empty input, never raises.
    """
    import json as _json_mod
    from crawl_scope import in_year_scope, year_scope_range

    if not tavily_results:
        return []

    _, year_max = year_scope_range()
    from datetime import datetime as _dt
    default_deadline = _dt(year_max, 12, 31, 23, 59, 59).date().isoformat()

    rows: List[Dict[str, Any]] = []
    seen: set = set()

    for res in tavily_results:
        raw_title = res.get("title", "")
        raw_content = res.get("raw_content", "") or res.get("content", "")
        url = res.get("url", "")

        if not raw_title or len(clean_text(raw_title)) < 3:
            continue

        title, company, location = _split_title_company(raw_title, raw_content)
        blob = clean_text(raw_content) or clean_text(raw_title)

        # Salary
        salary = extract_salary(blob)
        if not salary:
            # Try "lương: X" pattern explicitly
            m = re.search(r"(?:lương|tệ|salary)[:\s]*([\d\.,\-]+\s*(?:triệu|tỷ|usd|eur|vnd)?)", blob.lower())
            if m:
                salary = m.group(0)[:60]

        # Tags (skills) — look for comma-separated tech keywords.
        tags = []
        for kw in ("python", "java", "javascript", "react", "angular", "vue",
                   "node.js", "nodejs", "golang", "go", "c++", "c#", ".net",
                   "php", "ruby", "swift", "kotlin", "flutter", "docker",
                   "kubernetes", "aws", "azure", "gcp", "sql", "mongodb",
                   "postgreSQL", "redis", "linux", "nginx", "typescript"):
            if re.search(rf"\b{kw}\b", blob.lower()):
                tags.append(kw)

        # Dedup
        dedup = f"{title.lower()}|{company.lower()}"
        if dedup in seen:
            continue
        seen.add(dedup)

        job_type = infer_job_type(blob, title)
        if company and not company.lower().startswith("unknown"):
            company_clean = company[:255]
        else:
            company_clean = "Nhà tuyển dụng"

        rows.append({
            "title": title[:255],
            "company_name": company_clean,
            "location": location if location else "Việt Nam",
            "location_scope": _location_layer(location) if location else "unscoped",
            "salary_range": clean_text(str(salary))[:100] if salary else "Thỏa thuận",
            "description": blob[:500],
            "job_type": (job_type or "full_time").lower().strip(),
            "required_skills": _json_mod.dumps(tags, ensure_ascii=False) if tags else "[]",
            "experience_level": "Chưa xác định",
            "source_url": url,
            "image_url": None,
            "application_deadline": default_deadline,
            "crawl_year": year_max,
            "views": 0,
            "status": "active",
            "posted_by_user_id": None,
            "career_path_id": None,
            "updated_at": None,
        })

    return rows


def parse_tavily_posts(
    tavily_results: List[Dict[str, Any]],
    *,
    post_tag: str = "community",
    source_name: str = "web",
    max_content: int = 3000,
) -> List[Dict[str, Any]]:
    """Parse Tavily results into ``posts`` row dicts.

    Used by hackathons_crawler, community_posts_crawler, social_crawler.
    Each result becomes one post; the Tavily title → ``title``, the
    raw_content → ``content``.
    """
    if not tavily_results:
        return []
    rows: List[Dict[str, Any]] = []
    seen: set = set()
    for res in tavily_results:
        title = clean_text(res.get("title", ""))[:255]
        if not title or len(title) < 3:
            continue
        if title.lower() in seen:
            continue
        seen.add(title.lower())
        content = clean_text(res.get("raw_content", "") or res.get("content", ""))[:max_content]
        rows.append({
            "title": title,
            "source": source_name,
            "content": content,
            "media_urls": _json([]),
            "tags": _json([post_tag, source_name]),
            "like_count": 0,
            "comment_count": 0,
            "status": "active",
            "pinned": False,
            "location_scope": "vietnam",
        })
    return rows


def parse_tavily_map_points(
    tavily_results: List[Dict[str, Any]],
    *,
    category: str = "poi",
    source_name: str = "tavily",
) -> List[Dict[str, Any]]:
    """Parse Tavily results into ``map_points`` row dicts.

    For each result we look for coordinate patterns in the raw_content
    (e.g. "tọa độ 10.9835, 106.8686").  Results without parseable coordinates
    are skipped (the curated snapshots in schools_crawler/wifi_crawler/etc.
    fill those gaps — AGENTS.md §6 honest-empty-state rule).
    """
    rows: List[Dict[str, Any]] = []
    seen: set = set()
    for res in tavily_results:
        raw_title = clean_text(res.get("title", ""))
        raw_content = clean_text(res.get("raw_content", "") or res.get("content", ""))
        url = res.get("url", "")
        blob = (raw_title + " " + raw_content)[:3000]

        lat, lng = extract_coords(raw_content) or extract_coords(blob)
        if lat is None or lng is None:
            continue  # can't geo-locate — skip, curated snapshot fills the gap

        name = raw_title[:255] if raw_title else f"{category} tại {lat:.4f},{lng:.4f}"
        if name.lower() in seen:
            continue
        seen.add(name.lower())

        row = make_map_point_row(
            name=name,
            description=raw_content[:500] + (f" | Nguồn: {url}" if url else ""),
            category=category,
            lat=lat,
            lng=lng,
            source=source_name,
        )
        if row:
            rows.append(row)
    return rows


def parse_tavily_poi_from_results(
    tavily_results: List[Dict[str, Any]],
    *,
    category: str = "poi",
    location_scope: str = "dong_nai",
) -> Dict[str, Any]:
    """Parse a single Tavily result into one ``wifi_locations`` or ``map_points`` row.

    Returns a row dict (possibly empty if coords can't be parsed) or ``None``.
    This is used by the POI crawlers that need one POI per result.
    """
    pass  # kept minimal — see parse_tavily_map_points for the list version
