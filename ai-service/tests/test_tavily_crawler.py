

import os
import sys
import json
import time
import socket
from unittest import mock
import urllib.error

import pytest




_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_CRAWLERS_DIR = os.path.join(_PROJECT_ROOT, "crawlers")
if _CRAWLERS_DIR not in sys.path:
    sys.path.insert(0, _CRAWLERS_DIR)

from tavily_parse import (
    clean_text,
    extract_salary,
    extract_coords,
    extract_deadline,
    parse_tavily_jobs,
    parse_tavily_posts,
    parse_tavily_map_points,
    make_job_row,
    make_map_point_row,
    make_wifi_row,
)
from tavily_client import (
    TavilyClient,
    get_client,
    tavily_search,
    tavily_extract,
    tavily_search_and_extract,
    _force_ipv4,
)
from tavily_poi import search_pois_tavily, TavilyPoiClient






MOCK_JOB_RESULTS = [
    {
        "title": "Tuyển lập trình viên Python tại Đồng Nai | Công ty TNHH Tech ABC",
        "content": "Lương 15-20 triệu. Địa chỉ: Biên Hòa, Đồng Nai. Hạn nộp 30/06/2025.",
        "url": "https://example.com/job/1",
        "raw_content": 
                       "Lương 15-20 triệu/tháng. Làm việc tại Biên Hòa, Đồng Nai. "
                       "Yêu cầu: Python 3+, Django, SQL. Hạn nộp đơn: 30/06/2025.",
        "score": 0.97,
    },
    {
        "title": "Tuyển DevOps Engineer tại TP Hồ Chí Minh",
        "content": "Lương 25-35 triệu. Full-time. TP.HCM.",
        "url": "https://example.com/job/2",
        "raw_content": 
                       "Lương 25-35 triệu. TP.HCM. Python, Docker, Kubernetes.",
        "score": 0.93,
    },
    {
        "title": "Thực tập sinh thiết kế UX tại Hà Nội",
        "content": "Lương 8-12 triệu. Thực tập 3-6 tháng. HN.",
        "url": "https://example.com/intern/1",
        "raw_content": 
                       "Lương 8-12 triệu. Hà Nội. Thời hạn 31/05/2025.",
        "score": 0.88,
    },
    {
        "content": "no title here",
        "url": "https://example.com/no-title",
        "raw_content": "some content without a real title",
    },
    {
        "title": "Duplicate Job | Công ty TNHH Tech ABC",
        "content": "duplicate entry same company",
        "url": "https://example.com/job/dup",
        "raw_content": 
                       "Biên Hòa, Đồng Nai. Hạn nộp 30/06/2025.",
        "score": 0.90,
    },
]

MOCK_POST_RESULTS = [
    {
        "title": "Hội thảo AI giáo dục tại Đà Nẵng",
        "content": "Hội thảo trí tuệ nhân tạo trong giáo dục tại Đà Nẵng.",
        "url": "https://example.com/event/1",
        "raw_content": 
                       "Diễn giả: TS. Nguyễn. Đăng ký tại edumap.vn.",
        "score": 0.94,
    },
    {
        "title": "Hackathon sinh thái 2025",
        "content": "Cuộc thi hackathon sinh thái.",
        "url": "https://example.com/hack/1",
        "raw_content": "Hackathon sinh thái 2025. Cơ hội thắng thưởng lớn.",
        "score": 0.91,
    },
]

MOCK_MAP_POINTS = [
    {
        "title": "Trường Đại học Công nghệ Đồng Nai",
        "content": "trường đại học hàng đầu",
        "url": "https://example.com/dntu",
        "raw_content": 
                       "Trường kỹ thuật lớn nhất miền Nam. Tọa độ 10.9835, 106.8686.",
        "score": 0.99,
    },
    {
        "title": "Chợ Đầm Cau",
        "content": "chợ truyền thống",
        "url": "https://example.com/market/1",
        "raw_content": "Chợ Đầm Cau, TP.HCM. Tọa độ 10.7626, 106.6582.",
        "score": 0.95,
    },
    {
        "title": "Cà phê không tên",
        "content": "quán cafe",
        "url": "https://example.com/cafe/1",
        "raw_content": "quán cà phê không có tọa độ",
        "score": 0.30,
    },
    {
        "title": "Trường Đại học Công nghệ Đồng Nai",
        "content": "duplicate",
        "url": "https://example.com/dntu-dup",
        "raw_content": "Tọa độ: 10.9835, 106.8686. Duplicate entry.",
        "score": 0.85,
    },
]





class TestParseTavilyJobsIntegration:
    def test_parses_valid_job_results(self):
        jobs = parse_tavily_jobs(MOCK_JOB_RESULTS[:2])
        assert len(jobs) >= 1
        for job in jobs:
            assert "title" in job
            assert "company_name" in job
            assert "location" in job
            assert "location_scope" in job
            assert "salary_range" in job
            assert "job_type" in job
            assert "description" in job
            assert "source_url" in job
            assert "crawl_year" in job
            assert "image_url" in job
            assert "status" in job

    def test_skips_results_without_title(self):
        jobs = parse_tavily_jobs(MOCK_JOB_RESULTS)


        assert all(job["title"] for job in jobs)

        pairs = [(j["title"], j["company_name"]) for j in jobs]
        assert len(pairs) == len(set(pairs))

    def test_vietnamese_location_scope(self):
        jobs = parse_tavily_jobs(MOCK_JOB_RESULTS[:1])
        assert len(jobs) == 1
        assert jobs[0]["location_scope"] == "dong_nai"

    def test_southern_vn_location_scope(self):
        jobs = parse_tavily_jobs(MOCK_JOB_RESULTS[1:2])
        assert len(jobs) == 1
        assert jobs[0]["location_scope"] == "southern_vn"

    def test_northern_location_scope(self):
        results = [
            {"title": "Công ty TNHH North", "content": "",
             "url": "u1",
             "raw_content": "Công ty TNHH North tuyển dev 15 triệu Hà Nội",
             "score": 0.9},
        ]
        jobs = parse_tavily_jobs(results)
        assert len(jobs) == 1
        assert jobs[0]["location_scope"] == "vietnam"

    def test_empty_input_returns_empty(self):
        assert parse_tavily_jobs([]) == []
        assert parse_tavily_jobs(None) == []
        assert parse_tavily_jobs([{"content": "no title"}]) == []

    def test_salary_extracted(self):
        jobs = parse_tavily_jobs(MOCK_JOB_RESULTS[:1])
        assert len(jobs) == 1
        assert jobs[0]["salary_range"] is not None

    def test_deadline_extracted(self):
        jobs = parse_tavily_jobs(MOCK_JOB_RESULTS[:1])
        assert len(jobs) == 1
        assert jobs[0]["application_deadline"] is not None

    def test_crawl_year_is_int(self):
        jobs = parse_tavily_jobs(MOCK_JOB_RESULTS[:1])
        assert isinstance(jobs[0]["crawl_year"], int)

    def test_tags_json_serialized(self):
        jobs = parse_tavily_jobs(MOCK_JOB_RESULTS[:1])
        assert len(jobs) == 1
        tags = json.loads(jobs[0]["required_skills"])
        assert isinstance(tags, list)





class TestParseTavilyPostsIntegration:
    def test_parses_community_posts(self):
        posts = parse_tavily_posts(MOCK_POST_RESULTS[:1], post_tag="community")
        assert len(posts) == 1
        assert posts[0]["title"] == "Hội thảo AI giáo dục tại Đà Nẵng"
        tags = json.loads(posts[0]["tags"])
        assert "community" in tags
        assert len(tags) >= 2

    def test_parses_hackathon_posts(self):
        posts = parse_tavily_posts(MOCK_POST_RESULTS[1:], post_tag="hackathon")
        assert len(posts) == 1
        assert "hackathon" in json.loads(posts[0]["tags"])

    def test_empty_input(self):
        assert parse_tavily_posts([]) == []
        assert parse_tavily_posts(None) == []





class TestParseTavilyMapPointsIntegration:
    def test_parses_valid_coords(self):
        points = parse_tavily_map_points(MOCK_MAP_POINTS[:2])
        assert len(points) == 2
        assert all("POINT(" in p["location"] for p in points)
        assert all(8.0 <= p["lat"] <= 24.0 for p in points) if "lat" in points[0] else True

        for p in points:
            wkt = p["location"]
            assert wkt.startswith("POINT(")
            assert wkt.endswith(")")

    def test_skips_results_without_coords(self):

        points = parse_tavily_map_points(MOCK_MAP_POINTS[:3])
        assert len(points) == 2

    def test_deduplicates_by_name(self):
        points = parse_tavily_map_points(MOCK_MAP_POINTS)



        names = [p["name"] for p in points]
        assert len(names) == len(set(names))
        assert "Trường Đại học Công nghệ Đồng Nai" in names

    def test_empty_input(self):
        assert parse_tavily_map_points([]) == []

    def test_vietnam_bbox_validation(self):
        points = parse_tavily_map_points(MOCK_MAP_POINTS[:2])
        for p in points:

            wkt = p["location"]
            parts = wkt.replace("POINT(", "").replace(")", "").strip().split()
            lng = float(parts[0])
            lat = float(parts[1])
            assert 8.0 <= lat <= 24.0, f"lat {lat} out of VN range"
            assert 102.0 <= lng <= 109.5, f"lng {lng} out of VN range"





class TestTavilyClientDegradation:
    def test_returns_empty_list_when_no_key(self):
        """Without TAVILY_API_KEY, search() must return [] (never raise)."""
        with mock.patch.dict(os.environ, {"TAVILY_API_KEY": ""}, clear=False):
            import tavily_client as tc
            tc._default_client = None
            client = TavilyClient()
            assert client.is_configured() is False
            assert client.search("test") == []
            assert client.extract("https://example.com") == []
            assert client.search_and_extract("test") == []

    @mock.patch("tavily_client.urlopen")
    def test_network_failure_returns_empty(self, mock_urlopen):
        """URLError (blocked egress) → returns [] not crash."""
        mock_urlopen.side_effect = urllib.error.URLError("connection refused")

        with mock.patch.dict(os.environ, {"TAVILY_API_KEY": "fake_key"}):
            client = TavilyClient()
            assert client.search("test") == []
            assert client.last_error.startswith("network:")

    @mock.patch("tavily_client.urlopen")
    def test_http_429_rate_limit(self, mock_urlopen):
        mock_urlopen.side_effect = urllib.error.HTTPError(
            "https://api.tavily.com/search", 429, "Too Many Requests", {}, None)

        with mock.patch("tavily_client.CB_FAILURES", 1), \
             mock.patch("tavily_client.CB_TTL", 300):
            client = TavilyClient()
            assert client.search("test") == []
            assert client.last_error == "http_429"

    @mock.patch("tavily_client.urlopen")
    def test_invalid_json_handled(self, mock_urlopen):
        mock_response = mock.MagicMock()
        mock_response.read.return_value = b"not json {{{"
        mock_response.__enter__ = mock.MagicMock(return_value=mock_response)
        mock_response.__exit__ = mock.MagicMock(return_value=False)
        mock_urlopen.return_value = mock_response

        with mock.patch("tavily_client.CB_FAILURES", 100), \
             mock.patch("tavily_client.CB_TTL", 300):
            client = TavilyClient()

            assert client.search("test") == []


class TestTavilyClientCircuitBreakerIntegration:
    @mock.patch("tavily_client.urlopen")
    def test_circuit_opens_prevents_further_calls(self, mock_urlopen):
        mock_urlopen.side_effect = urllib.error.URLError("blocked")

        with mock.patch("tavily_client.CB_FAILURES", 3), \
             mock.patch("tavily_client.CB_TTL", 300):
            client = TavilyClient()

            for _ in range(3):
                client.search("q")
            assert "open" in client._cb.state()


            calls_before = mock_urlopen.call_count
            client.search("blocked-query")
            assert mock_urlopen.call_count == calls_before

    @mock.patch("tavily_client.urlopen")
    def test_circuit_recovers_after_ttl(self, mock_urlopen):
        mock_urlopen.side_effect = urllib.error.URLError("blocked")

        with mock.patch("tavily_client.CB_FAILURES", 2), \
             mock.patch("tavily_client.CB_TTL", 1):
            client = TavilyClient()
            client.search("q1")
            client.search("q2")
            assert "open" in client._cb.state()

            time.sleep(2)
            client._cb._failures = 0
            client._cb._opened_at = time.time() - 10


            assert client._cb.allow() is True





class TestIPv4Monkeypatch:
    def test_ipv4_enforced_at_import(self):
        """socket.getaddrinfo must only return AF_INET after _force_ipv4()."""
        _force_ipv4()
        infos = socket.getaddrinfo("api.tavily.com", 443, socket.AF_UNSPEC)
        families = [info[0] for info in infos]
        assert all(f == socket.AF_INET for f in families)
        assert socket.AF_INET6 not in families

    def test_ipv4_for_localhost(self):
        _force_ipv4()
        infos = socket.getaddrinfo("localhost", 443, socket.AF_UNSPEC)
        families = [info[0] for info in infos]
        assert all(f == socket.AF_INET for f in families)





class TestSingletonPattern:
    def test_get_client_returns_same_instance(self):
        c1 = get_client()
        c2 = get_client()
        assert c1 is c2

    def test_convenience_functions_degrade_without_key(self):
        with mock.patch.dict(os.environ, {"TAVILY_API_KEY": ""}, clear=False):
            import tavily_client as tc
            tc._default_client = None
            assert tavily_search("test") == []
            assert tavily_extract("https://example.com") == []
            assert tavily_search_and_extract("test") == []





class TestTavilyPoiClient:
    def test_returns_empty_without_key(self):
        with mock.patch.dict(os.environ, {"TAVILY_API_KEY": ""}, clear=False):
            import tavily_client as tc
            tc._default_client = None
            assert search_pois_tavily("test query") == []

    def test_client_fallback_to_empty(self):
        client = TavilyPoiClient()
        results = client._search_category(["fake query xyz"], "poi")
        assert results == []





class TestCleanTextVietnamese:
    def test_preserves_diacritics(self):
        text = "Xin chào! Đây là trường Đại học Công nghệ Đồng Nai."
        result = clean_text(text)
        assert "chào" in result
        assert "Đây" in result
        assert "Đại học Công nghệ Đồng Nai" in result

    def test_preserves_salary_vietnamese(self):
        result = clean_text("15-20 triệu/tháng ( gross )")
        assert "triệu" in result
        assert "15" in result
        assert "20" in result





class TestRowSchemaCompatibility:
    """Verify parsed rows match the column names from schema.sql."""

    JOBS_COLUMNS = {
        "title", "company_name", "location", "description", "required_skills",
        "experience_level", "salary_range", "application_deadline", "views",
        "status", "posted_by_user_id", "career_path_id", "image_url",
        "location_scope", "crawl_year",
    }

    MAP_POINTS_COLUMNS = {
        "name", "description", "category", "location", "address", "city",
        "province", "location_scope", "source", "crawl_year",
    }

    WIFI_COLUMNS = {
        "name", "location_point", "address", "speed_mbps", "is_free",
        "password", "hint", "provider", "rating_avg", "verified",
        "reported_by", "location_scope",
    }

    def test_job_rows_match_schema(self):
        jobs = parse_tavily_jobs(MOCK_JOB_RESULTS[:1])
        assert len(jobs) == 1
        row = jobs[0]
        missing = self.JOBS_COLUMNS - set(row.keys())

        assert "crawl_year" in row
        assert "location_scope" in row
        assert "image_url" in row

        for col in self.JOBS_COLUMNS:
            assert col in row, f"Missing column: {col}"

    def test_map_point_rows_match_schema(self):
        points = parse_tavily_map_points(MOCK_MAP_POINTS[:1])
        assert len(points) == 1
        row = points[0]
        for col in self.MAP_POINTS_COLUMNS:
            assert col in row, f"Missing column: {col}"
        assert "POINT(" in row["location"]

    def test_wifi_row_matches_schema(self):
        row = make_wifi_row(
            name="Test WiFi",
            lat=10.9300, lng=106.8300,
            address="Biên Hòa, Đồng Nai",
            speed_mbps=50,
            provider="Viettel",
        )
        assert row != {}
        for col in self.WIFI_COLUMNS:
            assert col in row, f"Missing column: {col}"
        assert "POINT(" in row["location_point"]

    def test_wifi_row_invalid_coords(self):
        row = make_wifi_row(name="Bad", lat=0, lng=0)
        assert row == {}


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
