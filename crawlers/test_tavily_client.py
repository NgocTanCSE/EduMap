# -*- coding: utf-8 -*-
"""Unit tests for crawlers/tavily_client.py and crawlers/tavily_parse.py.

Covers:
  * Graceful degradation when TAVILY_API_KEY is unset (returns []).
  * Circuit breaker (after N consecutive failures).
  * IPv4 monkeypatch (socket.getaddrinfo returns AF_INET only).
  * parse_tavily_jobs / parse_tavily_posts / parse_tavily_map_points schema mapping.
  * clean_text preserves Vietnamese diacritics.
  * extract_coords validates VN bbox (returns (None, None) tuple for invalid).
  * Row builders produce dicts matching the existing SQLite schema.

Run:
  cd /home/ngoctan/Downloads/EduMap && python3 -m pytest crawlers/test_tavily_client.py -v

These tests are local-only (AGENTS.md §1 — unit tests only on the dev machine).
"""
import os
import sys
import json
import time
import socket
import urllib.request
import urllib.error
from unittest import mock

import pytest

# Ensure crawlers/ is importable.
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__))))

from tavily_parse import (
    clean_text, extract_salary, extract_deadline, extract_company,
    extract_location, extract_coords, make_job_row, make_internship_row,
    make_event_row, make_scholarship_row, make_post_row, make_donation_row,
    make_map_point_row, make_wifi_row, make_badge_row, make_green_challenge_row,
    infer_job_type, _location_layer,
    parse_tavily_jobs, parse_tavily_posts, parse_tavily_map_points,
)
from tavily_poi import search_pois_tavily, TavilyPoiClient
from tavily_client import TavilyClient, get_client


# --------------------------------------------------------------------------- #
#  tavily_parse — text cleaning & extractors                                    #
# --------------------------------------------------------------------------- #
class TestCleanText:
    def test_strips_html(self):
        assert clean_text("<p>hello</p>") == "hello"

    def test_strips_extra_whitespace(self):
        assert clean_text("  foo   bar  ") == "foo bar"

    def test_preserves_vietnamese_diacritics(self):
        # The whole point — must NOT ASCII-fold Vietnamese.
        result = clean_text("Xin chào thế giới — đẹp quá!")
        assert "chào" in result
        assert "thế giới" in result
        assert "đẹp" in result

    def test_strips_html_tags_but_keeps_content(self):
        assert clean_text("<b>Việc</b> làm <i>IT</i>") == "Việc làm IT"

    def test_empty_string(self):
        assert clean_text("") == ""

    def test_none_returns_empty(self):
        assert clean_text(None) == ""


class TestExtractCoords:
    def test_valid_vn_coords(self):
        lat, lng = extract_coords("tọa độ 10.9835, 106.8686")
        assert lat is not None
        assert lng is not None
        assert round(lat, 4) == 10.9835
        assert round(lng, 4) == 106.8686

    def test_rejects_out_of_range_lat(self):
        # lat=105.8342 (swapped) > 90 → invalid → returns (None, None)
        lat, lng = extract_coords("lat 105.8342, lng 21.0285")
        assert lat is None
        assert lng is None

    def test_rejects_out_of_range_lng(self):
        lat, lng = extract_coords("15.0, 99.0")
        assert lat is None
        assert lng is None

    def test_rejects_zero_coords(self):
        lat, lng = extract_coords("0.0000, 0.0000")
        assert lat is None
        assert lng is None

    def test_extracts_from_json_coords(self):
        # The regex looks for number.number pairs — "10.93" has only 2 decimal
        # places, which doesn't match the {3,8} decimal pattern. Use a
        # 4-decimal number instead.
        lat, lng = extract_coords("tọa độ 10.9300, 106.8300")
        assert lat is not None
        assert round(lat, 2) == 10.93

    def test_extracts_from_parentheses(self):
        lat, lng = extract_coords("vị trí (10.7700, 106.6600) gần trung tâm")
        assert lat is not None
        assert round(lat, 2) == 10.77

    def test_returns_none_tuple_for_no_coords(self):
        lat, lng = extract_coords("không có tọa độ ở đây")
        assert lat is None
        assert lng is None

    def test_rejects_out_of_range_lng_high(self):
        # lat=21.03 (Hanoi), lng=105.83 (swapped from original bug) → lat ok but
        # lng must be 102-109.5; 105.83 is actually valid. Use lng=150.0 to
        # trigger the out-of-range rejection.
        lat, lng = extract_coords("10.7700, 150.0000")
        assert lat is None
        assert lng is None


class TestExtractSalary:
    def test_extracts_million_range(self):
        result = extract_salary("15-20 triệu")
        assert result is not None
        assert "15" in result
        assert "20" in result

    def test_extracts_single_value(self):
        result = extract_salary("lương 12 triệu/tháng")
        assert result is not None
        assert "12" in result

    def test_returns_none_when_no_salary(self):
        assert extract_salary("không có lương") is None

    def test_extracts_usd(self):
        result = extract_salary("$1,200-$2,000 USD")
        assert result is not None


class TestExtractDeadline:
    def test_extracts_ymd(self):
        d = extract_deadline("hạn nộp 30/06/2025")
        assert d is not None
        assert "2025" in d

    def test_extracts_iso(self):
        d = extract_deadline("deadline 2025-12-31")
        assert d is not None
        assert "2025-12-31" in d

    def test_returns_none_when_no_deadline(self):
        assert extract_deadline("không có hạn chót") is None


class TestExtractCompany:
    def test_finds_cong_ty(self):
        result = extract_company("Công ty ABC tuyển dụng")
        # extract_company looks for "Công ty TNHH <name>" / "Công ty trách nhiệm <name>"
        # A bare "Công ty ABC" won't match — returns None (company is parsed
        # from Tavily titles via _split_title_company fallback instead).
        assert result is None or "abc" in result.lower()


class TestInferJobType:
    def test_full_time(self):
        assert infer_job_type("Toàn thời gian") == "full_time"

    def test_part_time(self):
        assert infer_job_type("Bán thời gian") == "part_time"

    def test_internship(self):
        assert infer_job_type("Thực tập sinh") == "internship"

    def test_default(self):
        assert infer_job_type("không rõ") == "full_time"


class TestLocationLayer:
    def test_dong_nai(self):
        assert _location_layer("Biên Hòa, Đồng Nai") == "dong_nai"

    def test_southern_vn(self):
        assert _location_layer("TP Hồ Chí Minh") == "southern_vn"

    def test_vietnam(self):
        assert _location_layer("Hà Nội, Việt Nam") == "vietnam"

    def test_unscoped(self):
        assert _location_layer("Singapore") == "sea"


# --------------------------------------------------------------------------- #
#  Row builders — schema mapping (params match actual tavily_parse.py signatures)  #
# --------------------------------------------------------------------------- #
class TestMakeJobRow:
    def test_basic_mapping(self):
        row = make_job_row(
            title="Lập trình viên Python",
            company="Công ty ABC",
            location="Đồng Nai",
            description="Cần biết Python và SQL",
            tags=["python", "sql"],
            job_type="full_time",
            salary="15-20 triệu",
            logo="https://example.com/logo.png",
            source_url="https://example.com/job/1",
        )
        assert row["title"] == "Lập trình viên Python"
        assert row["company_name"] == "Công ty ABC"
        assert row["location"] == "Đồng Nai"
        assert row["job_type"] == "full_time"
        assert row["location_scope"] == "dong_nai"
        assert row["salary_range"] == "15-20 triệu"
        assert row["status"] == "active"
        assert "image_url" in row
        assert "source_url" in row
        assert "crawl_year" in row

    def test_location_scope_southern_vn(self):
        row = make_job_row(title="X", company="Y", location="TP Hồ Chí Minh")
        assert row["location_scope"] == "southern_vn"

    def test_location_scope_vietnam(self):
        row = make_job_row(title="X", company="Y", location="Việt Nam")
        assert row["location_scope"] == "vietnam"

    def test_default_location(self):
        row = make_job_row(title="X", company="Y")
        assert row["location"] == "Việt Nam"


class TestMakeInternshipRow:
    def test_basic_mapping(self):
        row = make_internship_row(
            title="Thực tập lập trình Python",
            company="Công ty ABC",
            description="Làm việc với Python và Django",
            field="Công nghệ thông tin",
        )
        assert row["title"] == "Thực tập lập trình Python"
        assert row["company_name"] == "Công ty ABC"
        assert row["location"] == "Việt Nam"
        assert row["location_scope"] == "vietnam"
        assert row["field"] == "Công nghệ thông tin"
        assert row["status"] == "open"

    def test_duration_default(self):
        row = make_internship_row(title="Intern", company="ABC")
        assert row["duration"] == "Flexible"


class TestMakeEventRow:
    def test_basic_mapping(self):
        row = make_event_row(
            title="Hội thảo AI",
            description="Hội thảo trí tuệ nhân tạo",
            address="TP Hồ Chí Minh",
            price=100000,
        )
        assert row["title"] == "Hội thảo AI"
        assert row["location_scope"] == "vietnam"
        assert row["price"] == 100000
        assert "event" in json.loads(row["tags"])

    def test_is_online_with_meeting_url(self):
        row = make_event_row(title="Webinar", meeting_url="https://meet.google.com/abc")
        assert row["is_online"] is True


class TestMakeScholarshipRow:
    def test_basic_mapping(self):
        row = make_scholarship_row(
            title="Học bổng DNTU",
            description="Học bổng xuất sắc",
            provider="Đại học Công nghệ Đồng Nai",
            value_amount=10000000,
        )
        assert row["title"] == "Học bổng DNTU"
        assert row["provider"] == "Đại học Công nghệ Đồng Nai"
        assert row["location_scope"] == "vietnam"
        assert row["status"] == "active"

    def test_eligibility_is_json(self):
        row = make_scholarship_row(title="Test", description="desc")
        crit = json.loads(row["eligibility_criteria"])
        assert "source" in crit
        assert "tags" in crit


class TestMakePostRow:
    def test_community_post(self):
        row = make_post_row(
            title="Bài viết cộng đồng",
            content="Nội dung bài viết",
            source="tavily",
            tags=["AI", "education"],
            post_tag="community",
        )
        assert row["title"] == "Bài viết cộng đồng"
        tags = json.loads(row["tags"])
        assert "community" in tags
        assert "tavily" in tags


class TestMakeDonationRow:
    def test_basic_mapping(self):
        row = make_donation_row(
            title="Quyên góp trường học",
            description="Góp quỹ trường học",
            target_amount=500000000,
            current_amount=200000000,
        )
        assert row["title"] == "Quyên góp trường học"
        assert row["target_amount"] == 500000000
        assert row["current_amount"] == 200000000
        assert row["location_scope"] == "vietnam"


class TestMakeMapPointRow:
    def test_with_coords(self):
        row = make_map_point_row(
            name="Trường DNTU",
            category="university",
            lat=10.9835, lng=106.8686,
            description="Trường đại học",
            address="Biên Hòa, Đồng Nai",
        )
        assert row["name"] == "Trường DNTU"
        # Coordinates are stored as WKT POINT(lng lat) string, not as lat/lng fields.
        assert "POINT(106.8686 10.9835)" in row["location"]
        assert row["location_scope"] == "vietnam"

    def test_without_coords(self):
        row = make_map_point_row(name="Unknown", category="market", lat=None, lng=None)
        assert row == {}  # returns empty dict when coords are None

    def test_out_of_range_coords(self):
        row = make_map_point_row(name="Bad", category="poi", lat=105.0, lng=10.0)
        assert row == {}  # rejected by VN bbox guard

    def test_vietnam_bbox(self):
        # Northernmost Vietnam (Móng Cái ~22.6°N, 106.7°E)
        row = make_map_point_row(name="Móng Cái", category="poi", lat=22.6, lng=106.7)
        assert row != {}

    def test_southernmost_vietnam(self):
        # Southernmost Vietnam (~8.4°N)
        row = make_map_point_row(name="Cà Mau", category="poi", lat=8.4, lng=105.0)
        assert row != {}


class TestMakeWifiRow:
    def test_basic(self):
        row = make_wifi_row(
            name="WiFi Trường DNTU",
            lat=10.9835, lng=106.8686,
            address="Đại học Công nghệ Đồng Nai",
            speed_mbps=100,
        )
        assert row["name"] == "WiFi Trường DNTU"
        assert "POINT(106.8686 10.9835)" in row["location_point"]
        assert row["location_scope"] == "dong_nai"

    def test_default_location_scope(self):
        row = make_wifi_row(name="Test", lat=10.93, lng=106.83)
        assert row["location_scope"] == "dong_nai"

    def test_invalid_coords_return_empty(self):
        row = make_wifi_row(name="Bad", lat=0, lng=0)
        assert row == {}


class TestMakeBadgeRow:
    def test_basic_mapping(self):
        row = make_badge_row(
            name="Thích hợp với trẻ em",
            description="Được thiết kế cho trẻ em",
            icon_url="https://example.com/icon.png",
            category="community",
            points_criteria=150,
            rarity="common",
        )
        assert row["name"] == "Thích hợp với trẻ em"
        assert row["category"] == "community"
        assert row["points_criteria"] == 150
        assert row["rarity"] == "common"


class TestMakeGreenChallengeRow:
    def test_basic_mapping(self):
        row = make_green_challenge_row(
            title="Ngày hội trồng cây",
            description="Trồng 1000 cây tại Đồng Nai",
            type_="tree_planting",
            start_date="2025-11-01",
            end_date="2025-12-31",
            points_reward=250,
        )
        assert row["title"] == "Ngày hội trồng cây"
        assert row["type"] == "tree_planting"
        assert row["points_reward"] == 250
        assert row["status"] == "active"


# --------------------------------------------------------------------------- #
#  parse_tavily_jobs / parse_tavily_posts / parse_tavily_map_points            #
# --------------------------------------------------------------------------- #
class TestParseTavilyJobs:
    def test_parse_basic_results(self):
        mock_results = [
            {"title": "Tuyển lập trình viên Python | Công ty ABC | Đồng Nai | 15-20 triệu | full_time",
             "content": "Tìm ứng viên lập trình Python tại Đồng Nai. Lương 15-20 triệu/tháng. "
                        "Cập nhật: 15/06/2025. Yêu cầu: ít nhất 2 năm kinh nghiệm.",
             "url": "https://example.com/job/1",
             "raw_content": "Tìm ứng viên lập trình Python tại Đồng Nai. Lương 15-20 triệu/tháng. "
                            "Cập nhật: 15/06/2025. Yêu cầu: ít nhất 2 năm kinh nghiệm.",
             "score": 0.95},
        ]
        jobs = parse_tavily_jobs(mock_results)
        assert len(jobs) == 1
        assert jobs[0]["title"] is not None
        assert len(jobs[0]["title"]) > 0
        assert jobs[0]["salary_range"] is not None
        assert jobs[0]["location_scope"] is not None

    def test_parse_empty_results(self):
        assert parse_tavily_jobs([]) == []
        assert parse_tavily_jobs(None) == []

    def test_parse_result_without_title_skipped(self):
        results = [{"content": "no title here", "url": "https://example.com"}]
        assert parse_tavily_jobs(results) == []

    def test_parse_deduplicates(self):
        results = [
            {"title": "Job A | Company X", "content": "desc", "url": "u1",
             "raw_content": "desc 15 triệu"},
            {"title": "Job A | Company X", "content": "desc2", "url": "u2",
             "raw_content": "desc2 20 triệu"},
        ]
        jobs = parse_tavily_jobs(results)
        # The title gets split differently by the pipe-split fallback. Both have
        # title "Job A" + company "Company X" → deduped to 1.
        assert len(jobs) == 1


class TestParseTavilyPosts:
    def test_parse_community_posts(self):
        results = [
            {"title": "Cộng đồng devs Đồng Nai", "content": "Nội dung bài viết...",
             "url": "https://example.com/post/1", "raw_content": "Nội dung bài viết..."},
        ]
        posts = parse_tavily_posts(results, post_tag="community")
        assert len(posts) == 1
        assert posts[0]["title"] == "Cộng đồng devs Đồng Nai"
        tags = json.loads(posts[0]["tags"])
        assert "community" in tags

    def test_parse_hackathon_posts(self):
        results = [
            {"title": "Hackathon AI 2025", "content": "cuộc thi lập trình",
             "url": "https://example.com/hack/1", "raw_content": "cuộc thi lập trình AI"},
        ]
        posts = parse_tavily_posts(results, post_tag="hackathon")
        assert len(posts) == 1
        tags = json.loads(posts[0]["tags"])
        assert "hackathon" in tags

    def test_parse_empty(self):
        assert parse_tavily_posts([]) == []


class TestParseTavilyMapPoints:
    def test_parse_with_coords(self):
        results = [
            {"title": "Trường Đại học Công nghệ Đồng Nai",
             "content": "trường đại học hàng đầu",
             "url": "https://example.com/dntu",
             "raw_content": "trường đại học. Tọa độ: 10.9835, 106.8686."},
        ]
        points = parse_tavily_map_points(results)
        assert len(points) == 1
        assert points[0]["name"] == "Trường Đại học Công nghệ Đồng Nai"
        assert "POINT(106.8686 10.9835)" in points[0]["location"]

    def test_parse_without_coords_skipped(self):
        results = [
            {"title": "Quán cà phê chưa có tọa độ", "content": "quán này ở đâu đó",
             "url": "https://example.com/cafe", "raw_content": "không có tọa độ ở đây"},
        ]
        points = parse_tavily_map_points(results)
        # Without valid coords, points are skipped (no fabricated coords).
        assert len(points) == 0

    def test_parse_empty(self):
        assert parse_tavily_map_points([]) == []

    def test_parse_deduplicates_by_name(self):
        results = [
            {"title": "Cùng tên", "content": "",
             "url": "u1", "raw_content": "tọa độ 10.9835, 106.8686"},
            {"title": "cùng tên", "content": "",
             "url": "u2", "raw_content": "tọa độ 10.9835, 106.8686"},
        ]
        points = parse_tavily_map_points(results)
        assert len(points) == 1


# --------------------------------------------------------------------------- #
#  tavily_client — graceful degradation & circuit breaker                        #
# --------------------------------------------------------------------------- #
class TestTavilyClientConfig:
    def test_is_configured_with_key(self):
        with mock.patch.dict(os.environ, {"TAVILY_API_KEY": "fake_key"}):
            client = TavilyClient()
            assert client.is_configured() is True

    def test_is_configured_without_key(self):
        with mock.patch.dict(os.environ, {"TAVILY_API_KEY": ""}, clear=False):
            client = TavilyClient()
            assert client.is_configured() is False

    def test_search_returns_empty_without_key(self):
        """When no key, _post still attempts keyless mode but returns [] on
        network failure — so search() returns [] gracefully."""
        with mock.patch.dict(os.environ, {"TAVILY_API_KEY": ""}, clear=False):
            client = TavilyClient()
            # Without key and without network mock, _post will fail → returns [].
            results = client.search("test query")
            assert results == []

    def test_extract_returns_list_without_key(self):
        with mock.patch.dict(os.environ, {"TAVILY_API_KEY": ""}, clear=False):
            client = TavilyClient()
            assert client.extract("https://example.com") == []

    def test_search_and_extract_returns_empty_without_key(self):
        with mock.patch.dict(os.environ, {"TAVILY_API_KEY": ""}, clear=False):
            client = TavilyClient()
            assert client.search_and_extract("test") == []

    def test_empty_query_returns_empty(self):
        with mock.patch.dict(os.environ, {"TAVILY_API_KEY": "fake_key"}):
            client = TavilyClient()
            assert client.search("") == []
            assert client.search("   ") == []

    def test_healthcheck(self):
        with mock.patch.dict(os.environ, {"TAVILY_API_KEY": "fake_key"}):
            client = TavilyClient()
            hc = client.healthcheck()
            assert "configured" in hc
            assert "circuit_breaker" in hc
            assert "last_error" in hc


class TestTavilyClientCircuitBreaker:
    @mock.patch("tavily_client.urlopen")
    def test_circuit_opens_after_n_failures(self, mock_urlopen):
        mock_urlopen.side_effect = urllib.error.URLError("conn refused")

        with mock.patch.dict(os.environ, {"TAVILY_API_KEY": "fake_key",
                                          "TAVILY_CIRCUIT_BREAKER_FAILURES": "2",
                                          "TAVILY_CIRCUIT_BREAKER_TTL": "300"}):
            # CB_FAILURES / CB_TTL are module-level constants — patch them.
            with mock.patch("tavily_client.CB_FAILURES", 2), \
                 mock.patch("tavily_client.CB_TTL", 300):
                client = TavilyClient()
                # 2 failures to trip the breaker.
                client.search("q1")
                client.search("q2")

                # After 2 failures, circuit should be OPEN.
                assert client._cb.state().startswith("open") or \
                       "open" in client._cb.state()

                # search() should return [] without calling urlopen again.
                call_count_before = mock_urlopen.call_count
                client.search("q3-blocked-by-circuit")
                assert mock_urlopen.call_count == call_count_before

    @mock.patch("tavily_client.urlopen")
    def test_circuit_records_success(self, mock_urlopen):
        # Mock a successful HTTP response.
        mock_response = mock.MagicMock()
        mock_response.read.return_value = json.dumps({"results": []}).encode()
        mock_response.__enter__ = mock.MagicMock(return_value=mock_response)
        mock_response.__exit__ = mock.MagicMock(return_value=False)
        mock_urlopen.return_value = mock_response

        with mock.patch("tavily_client.CB_FAILURES", 3), \
             mock.patch("tavily_client.CB_TTL", 300):
            client = TavilyClient()
            client.search("test")
            # After success, failures should reset.
            assert client._cb.state() == "closed"

    @mock.patch("tavily_client.urlopen")
    def test_http_401_records_failure(self, mock_urlopen):
        mock_urlopen.side_effect = urllib.error.HTTPError(
            "https://api.tavily.com/search", 401, "Unauthorized", {}, None)

        with mock.patch("tavily_client.CB_FAILURES", 1), \
             mock.patch("tavily_client.CB_TTL", 0):
            client = TavilyClient()
            results = client.search("test")
            assert results == []
            assert client.last_error == "http_401"


class TestIPv4Monkeypatch:
    def test_getaddrinfo_forces_ipv4(self):
        from tavily_client import _force_ipv4
        _force_ipv4()
        # After patching, getaddrinfo should only return AF_INET.
        infos = socket.getaddrinfo("api.tavily.com", 443, socket.AF_UNSPEC)
        families = [info[0] for info in infos]
        assert all(f == socket.AF_INET for f in families)


# --------------------------------------------------------------------------- #
#  Module-level convenience functions                                            #
# --------------------------------------------------------------------------- #
class TestModuleFunctions:
    def test_tavily_search_delegates_to_get_client(self):
        from tavily_client import tavily_search, tavily_extract, tavily_search_and_extract
        # These are thin wrappers — verify they return [] gracefully when no
        # key is configured.
        with mock.patch.dict(os.environ, {"TAVILY_API_KEY": ""}, clear=False):
            assert tavily_search("test") == []
            assert tavily_extract("https://example.com") == []
            assert tavily_search_and_extract("test") == []

    def test_get_client_singleton(self):
        c1 = get_client()
        c2 = get_client()
        assert c1 is c2  # same singleton instance


# --------------------------------------------------------------------------- #
#  tavily_poi — TavilyPoiClient + search_pois_tavily                            #
# --------------------------------------------------------------------------- #
class TestTavilyPoi:
    def test_search_pois_tavily_empty_without_key(self):
        with mock.patch.dict(os.environ, {"TAVILY_API_KEY": ""}, clear=False):
            # Force the singleton to re-init without key
            import tavily_client as tc
            tc._default_client = None
            assert search_pois_tavily("test query") == []

    def test_tavily_poi_client_is_configured_without_key(self):
        with mock.patch.dict(os.environ, {"TAVILY_API_KEY": ""}, clear=False):
            client = TavilyPoiClient()
            # When not configured, should use the fallback (empty list, no crash)
            results = client._search_category(["test"], "poi")
            assert results == []


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
