from __future__ import annotations

import html as _html
import re
import email.utils
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from xml.etree import ElementTree as ET

from db_utils import image_from_html, pick_image_urls

NEWS_FEEDS: List[Dict[str, Any]] = [
    {
        "id": "tienphong",
        "name": "Báo Tiền Phong",
        "domain": "tienphong.vn",
        "urls": [
            "https://tienphong.vn/rss/giao-duc.rss",
            "https://tienphong.vn/rss/ban-doc.rss",
        ],
    },
    {
        "id": "dantri",
        "name": "Báo Dân trí",
        "domain": "dantri.com.vn",
        "urls": [
            "https://dantri.com.vn/rss/giao-duc.rss",
        ],
    },
    {
        "id": "thanhnien",
        "name": "Báo Thanh Niên",
        "domain": "thanhnien.vn",
        "urls": [
            "https://thanhnien.vn/rss/giao-duc.rss",
        ],
    },
    {
        "id": "tuoitre",
        "name": "Báo Tuổi Trẻ",
        "domain": "tuoitre.vn",
        "urls": [
            "https://tuoitre.vn/rss/giao-duc.rss",
        ],
    },
    {
        "id": "vnexpress",
        "name": "VnExpress",
        "domain": "vnexpress.net",
        "urls": [
            "https://vnexpress.net/rss/giao-duc.rss",
        ],
    },
    {
        "id": "vietnamnet",
        "name": "VietnamNet",
        "domain": "vietnamnet.vn",
        "urls": [
            "https://vietnamnet.vn/giao-duc.rss",
        ],
    },
    {
        "id": "vietnamplus",
        "name": "VietnamPlus (TTXVN)",
        "domain": "vietnamplus.vn",
        "urls": [
            "https://www.vietnamplus.vn/rss/giao-duc.rss",
        ],
    },
    {
        "id": "giaoducthoidai",
        "name": "Giáo dục & Thời đại",
        "domain": "giaoducthoidai.vn",
        "urls": [
            "https://giaoducthoidai.vn/rss/home.rss",
        ],
    },
]

SCHOLARSHIP_KEYWORDS = (
    "học bổng", "miễn học phí", "quỹ học bổng", "trao học bổng",
    "cấp học bổng", "hỗ trợ học phí", "xét học bổng",
)

COMPETITION_KEYWORDS = (
    "cuộc thi", "hackathon", "olympic", "khởi nghiệp", "giải thưởng",
    "trao giải", "vô địch", "chung kết", "robotics", "tranh biện",
    "sáng tạo trẻ", "cuộc đua",
)

SPONSORSHIP_KEYWORDS = (
    "tài trợ", "nhà tài trợ", "đồng hành", "trao tặng",
    "học sinh nghèo", "vượt khó", "quỹ hỗ trợ",
)

_WS_RE = re.compile(r"\s+")
_TAG_RE = re.compile(r"<[^>]+>")
_PUBDATE_FORMATS = (
    "%a, %d %b %Y %H:%M:%S %z",
    "%a, %d %b %Y %H:%M:%S",
    "%Y-%m-%dT%H:%M:%S%z",
    "%Y-%m-%dT%H:%M:%SZ",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d",
)


def parse_published(raw: Optional[str]) -> Optional[datetime]:
    """Parse an RSS/Atom date into an aware UTC datetime (``None`` when absent)."""
    if not raw:
        return None
    raw = raw.strip()
    try:
        dt = email.utils.parsedate_to_datetime(raw)
        if dt is not None:
            return dt.astimezone(timezone.utc) if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError, IndexError):
        pass
    for fmt in _PUBDATE_FORMATS:
        try:
            dt = datetime.strptime(raw, fmt)
            return dt.astimezone(timezone.utc) if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def strip_html(fragment: str) -> str:
    """Turn an RSS description fragment into plain text (Vietnamese preserved)."""
    if not fragment:
        return ""
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", fragment, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<br\s*/?>|</p>", "\n", text, flags=re.IGNORECASE)
    text = _TAG_RE.sub(" ", text)
    text = _html.unescape(text)
    if "&" in text:
        text = _html.unescape(text)
    text = re.sub(r"[ \t\u00a0]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _localname(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower() if "}" in tag else tag.lower()


def _child_text(node: ET.Element, *names: str) -> Optional[str]:
    wanted = {n.lower() for n in names}
    for child in node:
        if _localname(child.tag) in wanted:
            return (child.text or "").strip() or None
    return None


def _entry_link(node: ET.Element) -> Optional[str]:
    for child in node:
        if _localname(child.tag) != "link":
            continue
        href = child.attrib.get("href")
        if href:
            return href.strip()
        if child.text and child.text.strip().startswith("http"):
            return child.text.strip()
    return _child_text(node, "guid", "id", "origlink")


def _entry_images(node: ET.Element, description_html: str) -> List[str]:
    cands: List[str] = []
    for child in node:
        name = _localname(child.tag)
        if name in ("thumb", "image", "thumbnail"):
            if child.text:
                cands.append(child.text.strip())
        elif name in ("content", "enclosure"):
            url = child.attrib.get("url")
            if url:
                cands.append(url)
    imgs = pick_image_urls(cands, limit=3)
    if imgs:
        return imgs
    return image_from_html(description_html, limit=3)


def parse_feed(xml_text: str, source_id: str, source_name: str) -> List[Dict[str, Any]]:
    """Parse an RSS 2.0 or Atom feed into normalised article dicts.

    Returns ``[]`` (never raises) when the document is not valid XML — feeds
    change shape without warning and the crawler must degrade, not crash.
    """
    if not xml_text:
        return []
    try:
        root = ET.fromstring(xml_text.encode("utf-8") if isinstance(xml_text, str) else xml_text)
    except ET.ParseError:
        return []
    except Exception:
        return []

    items: List[Dict[str, Any]] = []
    for node in root.iter():
        name = _localname(node.tag)
        if name not in ("item", "entry"):
            continue
        title = _child_text(node, "title") or ""
        title = strip_html(title)
        if len(title) < 8:
            continue
        link = _entry_link(node) or ""
        if not link.startswith("http"):
            continue
        desc_html = _child_text(node, "description", "summary", "content", "encoded") or ""
        body = strip_html(desc_html)
        images = _entry_images(node, desc_html)
        published = parse_published(
            _child_text(node, "pubdate", "published", "updated", "date", "dc:date")
        )
        category = _child_text(node, "category") or ""
        items.append({
            "title": _WS_RE.sub(" ", title)[:255],
            "url": link,
            "summary": body[:1200],
            "images": images,
            "published_at": published,
            "source_id": source_id,
            "source_name": source_name,
            "category": strip_html(category)[:100],
        })
    return items


def classify(title: str, summary: str = "") -> Optional[str]:
    """Map a headline (+ summary) to the feature bucket it belongs to.

    Matching is intentionally **title-first**: a summary mentions many things
    (a school event, a policy, a sponsor), so matching on it alone would file
    ordinary news as a scholarship/competition. The only summary-level signal
    accepted is the literal phrase "học bổng", which is specific enough.

    Order matters: a scholarship headline often mentions the awarding
    competition, so scholarships are checked first.
    """
    head = (title or "").lower()
    body = (summary or "").lower()
    if not head and not body:
        return None
    if any(k in head for k in SCHOLARSHIP_KEYWORDS) or "học bổng" in body:
        return "scholarship"
    if any(k in head for k in COMPETITION_KEYWORDS):
        return "competition"
    if any(k in head for k in SPONSORSHIP_KEYWORDS):
        return "sponsorship"
    return None


def matched_keywords(text: str) -> List[str]:
    low = (text or "").lower()
    hits = []
    for group in (SCHOLARSHIP_KEYWORDS, COMPETITION_KEYWORDS, SPONSORSHIP_KEYWORDS):
        for kw in group:
            if kw in low and kw not in hits:
                hits.append(kw)
    return hits[:6]