# -*- coding: utf-8 -*-
"""
Donations / fundraising campaigns crawler -> `donation_campaigns` table
(title UNIQUE).

Multiple Eventbrite fundraising query angles, ALL paginated (crawl nhiều trang,
không chỉ 1-2):

  Each keyword in QUERIES is fetched across PAGES pages of
  https://www.eventbrite.com/d/vietnam/all-events/?q=<kw>&page=N

Card-aware extraction (extract_eventbrite_cards) so the campaign image is the
correct one — never the site logo/banner (the old global-index bug). The parser
now reads the money figures straight off each card's block
("Raised $X of $Y goal") when present, instead of hardcoding 0/0.

Graceful: any blocked/unreachable page -> 0 rows, no crash. Idempotent upsert
by title.
"""
import os, re, sys, time, datetime
sys.path.insert(0, os.path.dirname(__file__))
from db_utils import (get_conn, upsert_rows, Jsonb, make_session, fetch_html,
                      crawl_pages, extract_eventbrite_cards)

NOW = datetime.datetime.utcnow()
QUERIES = [
    "fundraising", "charity", "donation", "support", "community", "cause",
    "nonprofit", "ngo", "aid", "relief", "volunteer", "education", "student",
]
PAGES = 8  # per query
BASE = "https://www.eventbrite.com/d/vietnam/all-events/"
TARGET = 150
CAP = 500  # hard stop on distinct campaigns


def _money(s):
    """'1,234' / '$1,234' / '1.2k' -> 1234 (int). None if unparseable."""
    if not s:
        return None
    s = s.replace("$", "").replace(",", "").replace(" ", "").strip().lower()
    m = re.match(r"^([\d.]+)k$", s)
    if m:
        try:
            return int(float(m.group(1)) * 1000)
        except ValueError:
            return None
    try:
        return int(float(s))
    except ValueError:
        return None


def _parse_amounts(block):
    """Extract (current_amount, target_amount) from a card's money text."""
    cur = None
    tgt = None
    # "Raised $X of $Y" / "$X raised of $Y goal"
    m = re.search(r'([Rr]aised)\s*\$([\d,.]+)\s*(?:of\s*\$([\d,.]+))?', block)
    if m:
        cur = _money(m.group(2))
        if m.group(3):
            tgt = _money(m.group(3))
    if cur is None:
        m2 = re.search(r'\$([\d,.]+)\s*raised', block, re.I)
        if m2:
            cur = _money(m2.group(1))
    if tgt is None:
        m3 = re.search(r'(?:goal|target|of)\s*\$([\d,.]+)', block, re.I)
        if m3:
            tgt = _money(m3.group(1))
    return cur, tgt


def _donation_items(html):
    """Parse one Eventbrite listing page -> list of campaign dicts (deduped by title)."""
    rows = {}
    if not html:
        return []
    for c in extract_eventbrite_cards(html):
        title = (c.get("title") or "").strip()
        if not title:
            continue
        block = c.get("raw_block") or ""
        cur, tgt = _parse_amounts(block)
        rows[title] = {
            "title": title[:255],
            "description": f"Chiến dịch quyên góp từ Eventbrite. Chi tiết: https://www.eventbrite.com{c.get('href','')}",
            "target_amount": tgt or 0,
            "current_amount": cur or 0,
            "organizer_id": None,
            "location_point": None,
            "status": "active",
            "start_date": NOW,
            "end_date": NOW + datetime.timedelta(days=30),
            "images": Jsonb([c["img"]] if c.get("img") else []),
        }
    return list(rows.values())


def crawl():
    s = make_session()
    by_title = {}

    for q in QUERIES:
        if len(by_title) >= CAP:
            break
        page_items = crawl_pages(
            s, lambda p, q=q: f"{BASE}?q={q}&page={p}", fetch_html,
            _donation_items, key=("title",), max_pages=PAGES,
            stop_when_empty=True, sleep=0.6, label=f'donations(q={q})')
        for it in page_items:
            if it["title"] not in by_title:
                by_title[it["title"]] = it
        if len(by_title) >= CAP:
            break

    rows = list(by_title.values())
    if len(rows) > TARGET:
        rows = rows[:TARGET]
    print(f"  [donations] collected {len(rows)} distinct campaigns ({len(QUERIES)} queries x {PAGES} pages)")
    return rows


def run():
    print("donations_crawler: start")
    conn = get_conn()
    try:
        rows = crawl()
        if rows:
            r = upsert_rows(conn, "donation_campaigns", rows, ["title"])
            print(f"donations_crawler: {r}")
        else:
            print("donations_crawler: 0 rows (sources blocked/unreachable — graceful)")
    finally:
        conn.close()


if __name__ == "__main__":
    run()
