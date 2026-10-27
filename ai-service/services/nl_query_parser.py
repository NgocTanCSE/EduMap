"""
Talk2Map — Vietnamese Natural Language → Structured GIS Query Parser.

Two-tier architecture (mirrors the provider-cascade pattern in ``llm_service.py``):

1. **Regex fallback** (always works, zero API-key / zero network required).
   This is the primary path on HF Spaces where LLM providers are frequently
   unreachable (Cloudflare TLS blocked, HF 401, etc.).

2. **LLM enrichment** (optional — when ``llm_service.is_ready`` is ``True``).
   The regex parse is run first; the LLM result is *merged* with it so a
   partial LLM failure never loses the regex baseline.

Returns a dict with this shape::

    {
      "location": str | None,           # proper location name (city, region, institution)
      "radius_km": float | None,        # search radius in kilometres
      "facility_types": List[str],      # POI categories to search for
      "conditions": List[str],          # filter conditions (free, wifi, open_evening…)
      "reference_location": str | None, # reference point (e.g. "trường" = near school)
      "confidence": float,              # 0.0–1.0
      "method": str,                    # "llm" | "regex"
      "suggestions": List[str],         # fuzzy location / facility suggestions
      "raw_text": str,                  # original user input
    }

The ``facility_types`` values match ``PointOfInterest.category`` on the NestJS
backend so the backend can filter SQLite rows directly.
"""

from __future__ import annotations

import asyncio
import json
import re
from typing import Any, Dict, List, Optional

# ── Intent classification (Idea #16: Voice-to-Geo) ───────────────────────────
# Maps a transcribed (or typed) Vietnamese query to one of three intents.
# ``geo_recommend``  — user wants to FIND a place to learn/study/etc.
# ``report_form``    — user wants to REPORT an issue (broken wifi, flooding…).
# ``geo_query``      — pure information request about a location ("where is …").
# The classification reuses the Talk2Map regex baseline so it works even when
# the LLM is down (zero-dependency, always-on path on HF Spaces free plan).
INTENT_REPORT_KEYWORDS: List[str] = [
    "hỏng", "đứt", "lỗi", "ngập", "hỏng", "gửi báo cáo", "báo cáo",
    "đóng góp", "báo cáo sự cố", "báo lỗi", "báo wifi", "mạng yếu",
    "không hoạt động", "không kết nối", "đóng góp thông tin", "signal",
    "yếu", "down", "outage", "broken",
]
INTENT_FIND_KEYWORDS: List[str] = [
    "tìm", "tìm kiếm", "tìm nơi", "tìm đường",
]
INTENT_QUERY_KEYWORDS: List[str] = [
    "ở đâu", "là gì", "thế nào", "bao nhiêu", "giờ mở cửa",
    "giờ đóng cửa", "thông tin", "liên hệ", "số điện thoại",
]

# Default intent when nothing clearly matches.
_DEFAULT_INTENT = "geo_recommend"


# ── Vietnamese category keywords → backend POI category ─────────────────────
# Sorted longest-first at match-time so multi-word phrases (e.g. "trường học")
# are matched before bare "trường". Covers miền Bắc / Trung / Nam variants.
FACILITY_KEYWORDS: Dict[str, str] = {
    # school (miền Bắc: "trường", miền Nam: "truồng", typo: "trương")
    "trường đại học": "university",
    "trường học": "school",
    "trường tiểu học": "school",
    "trường trung học": "school",
    "trường thpt": "school",
    "trường thcs": "school",
    "truồng": "school",          # Southern pronunciation
    "trương": "school",          # common typo
    "trường": "school",
    # university
    "đại học": "university",
    "đh": "university",
    # library
    "thư viện": "library",
    "thư viên": "library",       # common misspelling
    "thuvien": "library",
    "thưvien": "library",
    # cafe
    "cà phê": "cafe",
    "càphê": "cafe",
    "quán cà phê": "cafe",
    "cafe": "cafe",
    "cà pha": "cafe",
    # restaurant
    "nhà hàng": "restaurant",
    "quán ăn": "restaurant",
    "nhà ăn": "restaurant",
    "đồ ăn": "restaurant",
    "food": "restaurant",
    # market
    "chợ": "market",
    "thị trường": "market",
    "siêu thị": "market",
    "chợ hôm": "market",
    # convenience
    "cửa hàng": "convenience",
    "cửa hàng tiện lợi": "convenience",
    "tiệm": "convenience",
    # green / park
    "công viên": "park",
    "khu vui chơi": "park",
    "khu xanh": "green",
    "không gian xanh": "green",
    "vườn": "green",
    "park": "park",
}

# wifi/internet is a CONDITION (filter amenity), NOT a facility type to search for.
# Users asking "có wifi" mean "places that have wifi", not "wifi hotspots".
CONDITION_KEYWORDS: Dict[str, List[str]] = {
    "free": ["miễn phí", "free", "chạy", "không mất tiền", "tự do", "gratis",
             "miễn cước", "ko mất tiền", "không tính phí"],
    "wifi": ["wifi", "wi-fi", "internet", "mạng"],
    "open_evening": ["buổi tối", "tối", "đêm", "24h", "24/7", "đêm khuya",
                     "giờ tối", "tối muộn", "hoạt động đến khuya",
                     "đến khuya", "qua đêm"],
    "open_now": ["đang mở", "mở bây giờ", "đang mở cửa", "đang hoạt động",
                 "hoạt động", "đang hoạt động"],
    "parking": ["đậu xe", "chỗ đậu", "bãi đỗ", "parking", "chỗ để xe", "đậu chỗ",
                "có chỗ đậu"],
    "quiet": ["yên tĩch", "lý tĩnh", "thích hợp học", "không ồn", "yên chi",
              "không ồn ào", "không ồn", "không ồn"],
    "outdoor": ["ngoài trời", "cửa mở", "không gian mở", "outside", "ngoài trời"],
    "group": ["nhóm", "đông người", "nhiều người", "5 người", "nhóm lớn"],
    "bench": ["bàn ghế", "ghế", "bỏng ghế"],
    "aircon": ["điều hòa", "mát", "máy lạnh", "mát lạnh", "có điều hòa"],
}

# Proper location names (city / region / institution) — 3 miền.
LOCATION_PROPER_NAMES: Dict[str, str] = {
    "biên hòa": "Biên Hòa",
    "biên hà": "Biên Hà",
    "tp.hcm": "TP. Hồ Chí Minh",
    "tphcm": "TP. Hồ Chí Minh",
    "tp hcm": "TP. Hồ Chí Minh",
    "hồ chí minh": "TP. Hồ Chí Minh",
    "hà nội": "Hà Nội",
    "đà nẵng": "Đà Nẵng",
    "miền bắc": "Miền Bắc",
    "miền trung": "Miền Trung",
    "miền nam": "Miền Nam",
    "đông nam bộ": "Đông Nam Bộ",
    "tây nguyên": "Tây Nguyên",
    "bắc bộ": "Bắc Bộ",
    "trung bộ": "Trung Bộ",
    "dntu": "Đại học Công nghệ Đồng Nai",
    "trường dntu": "Đại học Công nghệ Đồng Nai",
    "đại học nông lâm": "Đại học Nông lâm",
    "đại học quốc gia": "Đại học Quốc gia",
}

# Reference-location prefixes (context words that precede a reference place).
_REF_CONTEXTS = ["gần", "ở", "tại", "quanh", "xung quanh", "bên"]

# Radius extraction regex — matches "3km", "5 km", "3.5km", "bán kính 3km".
_RADIUS_RE = re.compile(r'(?:bán\s*kính\s*)?(\d+(?:\.\d+)?)\s*(km|kĩ|mét|m)\b', re.IGNORECASE)

# Default radius (km) when user says "gần" but gives no number.
_DEFAULT_RADIUS = 5.0
_NEAR_RADIUS = 3.0
_FAR_RADIUS = 10.0


def _sort_keywords(keywords: Dict[str, Any]) -> List[str]:
    """Return keyword list sorted longest-first so multi-word phrases
    (e.g. ``trường học``) are matched before bare ``trường``."""
    return sorted(keywords.keys(), key=len, reverse=True)


class NLQueryParser:
    """Parse Vietnamese natural-language queries into structured GIS search
    parameters.

    Parameters
    ----------
    llm_service
        An instance of the project's ``LLMService`` (or any object exposing
        ``is_ready``, ``_generate_text_with_fallback`` and ``_extract_json``).
        When ``None`` or ``is_ready == False`` the parser runs in pure regex
        mode — this is the normal state on HF Spaces without API keys.
    """

    def __init__(self, llm_service: Optional[Any] = None) -> None:
        self.llm = llm_service

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def parse(self, text: str) -> dict:
        """Parse a Vietnamese query string. Always returns a valid dict."""
        text = (text or "").strip()

        # 1. Baseline: regex parse (always succeeds)
        result = self._parse_regex(text)

        # 2. Optional: LLM enrichment + merge
        if self.llm and getattr(self.llm, "is_ready", False):
            try:
                llm_result = self._parse_llm(text)
                if llm_result:
                    result = self._merge_results(result, llm_result)
                    result["method"] = "llm"
            except Exception:
                pass  # keep regex result — graceful degradation

        result["raw_text"] = text
        return result

    async def parse_async(self, text: str) -> dict:
        """Async wrapper — routers call this via ``asyncio.to_thread`` so the
        blocking LLM subprocess (``_generate_text_with_fallback``) doesn't
        freeze the event loop."""
        return await asyncio.to_thread(self.parse, text)

    # ------------------------------------------------------------------
    # Intent classification (Idea #16: Voice-to-Geo, Task 3)
    # ------------------------------------------------------------------
    def extract_intent(self, parsed: dict) -> dict:
        """Classify a parsed query into a Voice-to-Geo intent.

        Reuses the Talk2Map regex baseline (facility_types / conditions /
        location already extracted by :meth:`parse`) so intent detection works
        on HF Spaces even when the LLM is down.

        Returns::

            {
              "intent": "geo_recommend" | "report_form" | "geo_query",
              "confidence": 0.0–1.0,
              "detail": "human-readable reason for the classification",
            }

        Intent rules (Vietnamese, 3-miền aware):

        * ``report_form`` — the transcript contains a report/issue keyword
          (hỏng, đứt, lỗi, ngập, "gửi báo cáo", mạng yếu…). Maps to the
          "send a map report" output (pin an issue at a location).
        * ``geo_recommend`` — the transcript contains a "find" verb
          (tìm, tìm kiếm, tìm nơi…) or conditions that imply searching for
          a study spot (wifi, free, open_evening). This is the default when
          facility_types or search conditions are detected.
        * ``geo_query`` — the transcript asks for information about a place
          (ở đâu, là gì, giờ mở cửa…) rather than searching for one.
        """
        raw = (parsed.get("raw_text") or "").lower().strip()
        facilities = parsed.get("facility_types") or []
        conditions = parsed.get("conditions") or []
        has_location = bool(parsed.get("location") or parsed.get("reference_location"))

        # ── report_form: issue / broken / flooding keywords ─────────────
        # Takes priority: "Báo wifi hỏng" is a report even if "tìm" appears.
        report_hits = [kw for kw in INTENT_REPORT_KEYWORDS if kw in raw]
        if report_hits:
            return {
                "intent": "report_form",
                "confidence": min(0.4 + 0.15 * len(report_hits), 0.95),
                "detail": f"Nhận diện báo cáo sự cố: {', '.join(report_hits[:3])}",
            }

        # ── geo_recommend: explicit "find" verbs (tìm / tìm kiếm / tìm nơi) ─
        # These are unambiguous search intents — the user wants results on a map.
        find_hits = [kw for kw in INTENT_FIND_KEYWORDS if re.search(kw, raw)]

        # ── geo_query: information questions (ở đâu / là gì / bao nhiêu…) ────
        # Only trigger when there is NO explicit "tìm" find-verb — a query like
        # "Trường DNTU ở đâu?" asks WHERE, it doesn't search FOR a place.
        # Facility keywords (trường, thư viện…) appear in both find and info
        # queries, so the verb — not the facility presence — decides.
        query_hits = [kw for kw in INTENT_QUERY_KEYWORDS if re.search(kw, raw)]
        if query_hits and not find_hits:
            return {
                "intent": "geo_query",
                "confidence": min(0.4 + 0.1 * len(query_hits), 0.85),
                "detail": f"Nhận diện câu hỏi thông tin: {', '.join(query_hits[:3])}",
            }

        # ── geo_recommend: the default / "find a place" intent ──────────
        find_hits = [kw for kw in INTENT_FIND_KEYWORDS if re.search(kw, raw)]
        confidence = 0.5
        if facilities:
            confidence += 0.2
        if conditions:
            confidence += 0.15
        if find_hits:
            confidence += 0.15
        if has_location:
            confidence += 0.1
        confidence = min(round(confidence, 2), 0.95)

        detail_parts = []
        if facilities:
            detail_parts.append(f"loại địa điểm: {', '.join(facilities)}")
        if conditions:
            detail_parts.append(f"điều kiện: {', '.join(conditions)}")
        if has_location:
            detail_parts.append(f"địa điểm: {parsed.get('location') or parsed.get('reference_location')}")
        detail = " | ".join(detail_parts) if detail_parts else "Tìm địa điểm học tập gần đây"

        return {
            "intent": "geo_recommend",
            "confidence": confidence,
            "detail": detail,
        }

    def generate_explanation(self, parsed: dict) -> str:
        """Produce a human-readable explanation of the parsed query.

        Uses the LLM when available (richer, more natural); falls back to a
        deterministic template otherwise."""
        if self.llm and getattr(self.llm, "is_ready", False) and parsed.get("method") == "llm":
            try:
                prompt = (
                    "Bạn là trợ lý Talk2Map. Dưới đây là query đã phân tích:\n"
                    f"JSON: {json.dumps(parsed, ensure_ascii=False, default=str)}\n\n"
                    "Hãy viết một câu giải thích ngắn gọn (1 câu, tiếng Việt) cho "
                    "người dùng biết bạn đã hiểu câu hỏi này như thế nào. "
                    "Chỉ trả về câu giải thích, không JSON, không markdown."
                )
                response = self.llm._generate_text_with_fallback(
                    prompt, temperature=0.3, max_tokens=256
                )
                if response and response.strip():
                    return response.strip()
            except Exception:
                pass

        # Template fallback
        return self._template_explanation(parsed)

    # ------------------------------------------------------------------
    # Regex fallback
    # ------------------------------------------------------------------
    def _parse_regex(self, text: str) -> dict:
        text_lower = text.lower().strip()

        facility_types: List[str] = []
        conditions: List[str] = []
        reference_location: Optional[str] = None

        # ── 1. Extract reference locations (facility keyword after
        #      "gần/ở/tại …") and mask that span in a working copy so the
        #      facility matcher below doesn't double-count it.
        text_for_facility = text_lower
        for ref_ctx in _REF_CONTEXTS:
            for kw in _sort_keywords(FACILITY_KEYWORDS):
                pattern = rf'{re.escape(ref_ctx)}\s+{re.escape(kw)}'
                m = re.search(pattern, text_for_facility)
                if m:
                    if reference_location is None:
                        reference_location = kw
                    text_for_facility = text_for_facility.replace(m.group(0), '   ', 1)
                    break  # move to next ref_ctx

        # ── 2. Detect facility types (on masked working copy) ───────────
        for kw in _sort_keywords(FACILITY_KEYWORDS):
            if kw in text_for_facility:
                facility = FACILITY_KEYWORDS[kw]
                if facility not in facility_types:
                    facility_types.append(facility)

        # ── 3. Detect conditions (on ORIGINAL text) ─────────────────────
        for cond, keywords in CONDITION_KEYWORDS.items():
            for kw in keywords:
                if kw in text_lower:
                    if cond not in conditions:
                        conditions.append(cond)
                    break

        # ── 4. Detect radius (on ORIGINAL text) ────────────────────────
        radius_km = self._extract_radius(text_lower)

        # ── 5. Detect overall location (proper names, on ORIGINAL text) ─
        location = self._extract_location(text_lower)

        # ── 6. Generate suggestions ──────────────────────────────────────
        suggestions = self._generate_suggestions(text_lower, location, reference_location, facility_types)

        # ── 7. Confidence score ──────────────────────────────────────────
        confidence = self._compute_confidence(
            facility_types, conditions, radius_km, location, reference_location
        )

        return {
            "location": location,
            "radius_km": radius_km,
            "facility_types": facility_types,
            "conditions": conditions,
            "reference_location": reference_location,
            "confidence": round(confidence, 2),
            "method": "regex",
            "suggestions": suggestions,
            "raw_text": text,
        }

    def _extract_radius(self, text_lower: str) -> Optional[float]:
        m = _RADIUS_RE.search(text_lower)
        if m:
            try:
                return float(m.group(1))
            except (ValueError, TypeError):
                pass
        if "gần" in text_lower:
            return _NEAR_RADIUS
        if "rộng" in text_lower or "toàn" in text_lower:
            return _FAR_RADIUS
        return _DEFAULT_RADIUS

    def _extract_location(self, text_lower: str) -> Optional[str]:
        """Find a proper location name (city / region / institution) in text."""
        for name_key in sorted(LOCATION_PROPER_NAMES.keys(), key=len, reverse=True):
            if name_key in text_lower:
                return LOCATION_PROPER_NAMES[name_key]
        return None

    def _generate_suggestions(
        self,
        text_lower: str,
        location: Optional[str],
        reference_location: Optional[str],
        facility_types: List[str],
    ) -> List[str]:
        """Fuzzy-match ambiguous location / facility references and produce
        suggestion strings the frontend can surface to the user."""
        suggestions: List[str] = []

        # Suggest canonical institution names when short forms are used.
        if reference_location and "trường" in str(reference_location):
            suggestions.append("Đại học Công nghệ Đồng Nai (DNTU)")
            suggestions.append("Đại học Nông lâm")
        if "dntu" in text_lower:
            suggestions.append("Đại học Công nghệ Đồng Nai")

        # Suggest broader location when a region keyword appears.
        for name_key, canonical in LOCATION_PROPER_NAMES.items():
            if name_key in text_lower and canonical not in suggestions:
                if len(canonical) > 2:
                    suggestions.append(canonical)

        # If a facility was detected but location is fuzzy, suggest
        # surrounding areas.
        if facility_types and not location:
            suggestions.append("Biên Hòa, Đồng Nai")
            suggestions.append("TP. Hồ Chí Minh")

        # Deduplicate while preserving order
        seen: set = set()
        deduped: List[str] = []
        for s in suggestions:
            if s not in seen:
                seen.add(s)
                deduped.append(s)
        return deduped[:5]

    def _compute_confidence(
        self,
        facility_types: List[str],
        conditions: List[str],
        radius_km: Optional[float],
        location: Optional[str],
        reference_location: Optional[str],
    ) -> float:
        score = 0.0
        if facility_types:
            score += 0.35
        if conditions:
            score += 0.20
        if radius_km is not None:
            score += 0.15
        if reference_location:
            score += 0.15
        if location:
            score += 0.15
        return min(score, 1.0)

    def _template_explanation(self, parsed: dict) -> str:
        """Deterministic explanation template (used when LLM is down)."""
        facilities = parsed.get("facility_types") or []
        conditions = parsed.get("conditions") or []
        radius = parsed.get("radius_km")
        ref_loc = parsed.get("reference_location")
        location = parsed.get("location")

        parts = [f"Tìm {', '.join(facilities) if facilities else 'địa điểm'}"
                 f" gần {ref_loc or location or 'đây'}"
                 + (f' trong bán kính {radius}km' if radius else '')
                 + (f", với điều kiện: {', '.join(conditions)}" if conditions else '')]
        return ". ".join(p for p in parts if p) + "."

    # ------------------------------------------------------------------
    # LLM enrichment
    # ------------------------------------------------------------------
    def _parse_llm(self, text: str) -> Optional[dict]:
        """Call the LLM to extract structured entities from Vietnamese text.

        Returns a dict (possibly partial) or ``None`` if the LLM call fails
        or returns non-JSON. The result is *merged* with the regex baseline
        by :meth:`_merge_results`, so only non-None fields override.
        """
        if not (self.llm and getattr(self.llm, "is_ready", False)):
            return None

        prompt = (
            "Bạn là parser tiếng Việt cho Talk2Map — chuyển đổi câu hỏi "
            "tự nhiên thành JSON có các trường sau:\n"
            "{\n"
            '  "location": string | null,         // tên địa điểm (thành phố, khu vực, trường...)\n'
            '  "radius_km": number | null,          // bán kính tìm kiếm (km), nếu không nêu thì để null\n'
            '  "facility_types": ["school"|"university"|"library"|"wifi"|"cafe"|"green"|"park"|"restaurant"|"market"|"convenience"|"bookstore"|"lab"|"other"],\n'
            '  "conditions": ["free"|"wifi"|"open_evening"|"open_now"|"parking"|"quiet"|"outdoor"|"group"|"bench"|"aircon"],\n'
            '  "reference_location": string | null, // địa điểm tham chiếu (ví dụ: "trường")\n'
            '  "suggestions": [string]             // gợi ý địa danh nếu người dùng gõ thiếu/viết tắt\n'
            "}\n\n"
            f'Câu hỏi: "{text}"\n'
            "Chỉ trả về JSON, không giải thích, không markdown."
        )

        response = self.llm._generate_text_with_fallback(
            prompt, temperature=0.3, max_tokens=512
        )
        if not response:
            return None

        result = self.llm._extract_json(response)
        if result is None or not isinstance(result, dict):
            return None

        # Validate / normalise types
        if "facility_types" in result and not isinstance(result["facility_types"], list):
            result["facility_types"] = []
        if "conditions" in result and not isinstance(result["conditions"], list):
            result["conditions"] = []
        if "radius_km" in result and result["radius_km"] is not None:
            try:
                result["radius_km"] = float(result["radius_km"])
            except (ValueError, TypeError):
                result["radius_km"] = None

        # Validate facility/condition names against known sets
        valid_facilities = set(FACILITY_KEYWORDS.values()) | {"bookstore", "lab", "other"}
        valid_conditions = set(CONDITION_KEYWORDS.keys())
        result["facility_types"] = [f for f in result.get("facility_types", []) if f in valid_facilities]
        result["conditions"] = [c for c in result.get("conditions", []) if c in valid_conditions]

        return result

    def _merge_results(self, regex_result: dict, llm_result: dict) -> dict:
        """Merge LLM fields into the regex baseline. Non-None LLM fields
        override; None LLM fields keep the regex value."""
        merged = dict(regex_result)

        if llm_result.get("location"):
            merged["location"] = llm_result["location"]
        if llm_result.get("radius_km"):
            merged["radius_km"] = llm_result["radius_km"]
        if llm_result.get("facility_types"):
            merged["facility_types"] = list(llm_result["facility_types"])
        if llm_result.get("conditions"):
            merged["conditions"] = list(llm_result["conditions"])
        if llm_result.get("reference_location"):
            merged["reference_location"] = llm_result["reference_location"]
        if llm_result.get("suggestions"):
            merged["suggestions"] = list(llm_result["suggestions"])

        # Boost confidence when LLM agrees with regex
        merged["confidence"] = max(merged["confidence"], 0.7)
        return merged
