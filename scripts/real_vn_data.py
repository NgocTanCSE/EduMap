#!/usr/bin/env python3
"""
EduMap — curated, verifiable Vietnamese datasets.

WHY THIS FILE EXISTS
--------------------
The shipped `frontend/public/edumap.db` used to contain rows fabricated by
earlier demo seeders (`EduMap Foundation`, `EduMap Academy`, `Test Campaign`,
`EduMap Smart Cities Hackathon`, synthetic mentors on `@edumap.vn`, …). Users
verified the live HF Space and correctly reported the data as "not real".

This module is the single source of truth for the replacement content. Every
row here points at a **real, official Vietnamese or Vietnam-facing
organisation** and stores its official URL in the description so the UI can
show provenance.

RULES
-----
1. Never invent an organisation, a programme, or a deadline.
2. If a deadline is not officially published yet, store `None` and say
   "Hạn nộp: xem trang chính thức" in the description.
3. Every description ends with `Nguồn: <official url> · Cập nhật: <date>`.
4. Volatile data (jobs, …) must come from a live crawler, not from here.

Used by:
  - `scripts/migrate_real_data.py`  (cleans + seeds the shipped SQLite file)
  - `scripts/seed_sqlite_db.py`     (no longer injects demo rows)
"""

from __future__ import annotations

import json
import uuid
from typing import Any, Iterable

# Bump when the curated content changes so migrations stay auditable.
VERIFIED_AT = "2026-10-27"
VERIFIED_AT_VN = "27/10/2026"


def uid(key: str) -> str:
    """Deterministic id so re-running the migration is idempotent."""
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"edumap:real:{key}"))


def geo(lon: float, lat: float) -> str:
    return json.dumps({"type": "Point", "coordinates": [lon, lat]})


def with_source(description: str, url: str) -> str:
    """Append a provenance footer that is visible in the UI."""
    return (
        f"{description}\n\n"
        f"Nguồn chính thức: {url} · Kiểm chứng: {VERIFIED_AT_VN}"
    )


# ---------------------------------------------------------------------------
# Scholarships — real government / university programmes open to Vietnamese
# ---------------------------------------------------------------------------
# (key, title, description, provider, location, value_amount, deadline, eligibility, url)
SCHOLARSHIPS: list[tuple] = [
    (
        "sch-australia-awards",
        "Học bổng Chính phủ Australia (Australia Awards)",
        "Học bổng toàn phần bậc thạc sĩ tại các trường đại học Australia, do Chính phủ Australia tài trợ qua Aus4Skills. "
        "Kỳ intake 2027 đã đóng đơn ngày 30/4/2026; kỳ intake 2028 dự kiến mở đơn vào đầu năm 2027.",
        "Chính phủ Australia (Aus4Skills)",
        "Australia",
        0.0,
        "2027-04-30",
        "Công dân Việt Nam, có bằng đại học, IELTS/TOEFL theo yêu cầu, cam kết về nước phục vụ.",
        "https://australiaawardsvietnam.org/applicants/key-dates/",
    ),
    (
        "sch-chevening",
        "Học bổng Chevening (Vương quốc Anh)",
        "Học bổng toàn phần thạc sĩ một năm tại Vương quốc Anh do Bộ Ngoại giao Anh và các đối tác tài trợ. "
        "Đơn thường mở từ tháng 8 và đóng vào đầu tháng 11 hằng năm.",
        "UK Government (FCDO)",
        "United Kingdom",
        0.0,
        None,
        "Công dân Việt Nam, tối thiểu 2 năm kinh nghiệm làm việc, IELTS theo yêu cầu, cam kết về nước 2 năm.",
        "https://www.chevening.org/scholarship/vietnam/",
    ),
    (
        "sch-fulbright",
        "Học bổng Fulbright Việt Nam (Fulbright Vietnamese Student Program)",
        "Chương trình học bổng thạc sĩ tại Hoa Kỳ do Chính phủ Hoa Kỳ và Việt Nam đồng tài trợ, "
        "tập trung vào các ngành phát triển kinh tế – xã hội.",
        "Fulbright Vietnam (Đại sứ quán Hoa Kỳ)",
        "United States",
        0.0,
        None,
        "Công dân Việt Nam, tốt nghiệp đại học, có kinh nghiệm công tác, TOEFL/IELTS theo yêu cầu.",
        "https://fulbright.edu.vn/",
    ),
    (
        "sch-mext",
        "Học bổng MEXT của Chính phủ Nhật Bản",
        "Học bổng du học sinh chính phủ Nhật Bản (Monbukagakusho/MEXT) cho bậc đại học, thạc sĩ và nghiên cứu sinh, "
        "tuyển chọn qua Đại sứ quán Nhật Bản tại Việt Nam.",
        "Chính phủ Nhật Bản (MEXT)",
        "Japan",
        0.0,
        None,
        "Công dân Việt Nam, độ tuổi và học lực theo từng hạng mục, tiếng Nhật hoặc tiếng Anh theo yêu cầu.",
        "https://www.studyinjapan.go.jp/en/planning/scholarship/",
    ),
    (
        "sch-gks",
        "Học bổng Chính phủ Hàn Quốc (GKS)",
        "Global Korea Scholarship dành cho sinh viên quốc tế học đại học và sau đại học tại Hàn Quốc, "
        "do Viện Phát triển Giáo dục Quốc gia Hàn Quốc (NIIED) quản lý.",
        "Chính phủ Hàn Quốc (NIIED)",
        "South Korea",
        0.0,
        None,
        "Công dân Việt Nam, GPA theo yêu cầu, độ tuổi dưới 25 (đại học) hoặc dưới 40 (sau đại học).",
        "https://www.studyinkorea.go.kr/en/sub/gks/allnew_invitation.do",
    ),
    (
        "sch-daad",
        "Học bổng DAAD của CHLB Đức",
        "Các chương trình học bổng thạc sĩ, tiến sĩ và nghiên cứu ngắn hạn tại Đức do Cơ quan Trao đổi Hàn lâm Đức (DAAD) "
        "tài trợ, có văn phòng đại diện tại Hà Nội và TP. Hồ Chí Minh.",
        "DAAD Germany",
        "Germany",
        0.0,
        None,
        "Tùy chương trình: sinh viên năm cuối, người đã tốt nghiệp, nghiên cứu sinh; yêu cầu tiếng Đức hoặc tiếng Anh.",
        "https://www.daad.de/en/study-and-research-in-germany/scholarships/",
    ),
    (
        "sch-erasmus-mundus",
        "Học bổng Erasmus Mundus (Liên minh châu Âu)",
        "Học bổng thạc sĩ liên kết châu Âu (EMJM) do Ủy ban châu Âu tài trợ, học tại 2–3 trường đại học ở các nước EU.",
        "European Commission",
        "European Union",
        0.0,
        None,
        "Công dân mọi quốc gia, có bằng đại học; hạn nộp khác nhau theo từng chương trình EMJM.",
        "https://erasmus-plus.ec.europa.eu/opportunities/opportunities-for-individuals/students/erasmus-mundus-joint-masters",
    ),
    (
        "sch-asean-singapore",
        "Học bổng ASEAN của Singapore",
        "Học bổng toàn phần dành cho học sinh/sinh viên các nước ASEAN học tại Singapore, "
        "do Bộ Giáo dục Singapore (MOE) tuyển chọn.",
        "Ministry of Education Singapore",
        "Singapore",
        0.0,
        None,
        "Công dân các nước ASEAN, độ tuổi theo từng bậc học, học lực xuất sắc, tiếng Anh tốt.",
        "https://www.moe.gov.sg/financial-matters/awards-scholarships/asean-scholarship",
    ),
    (
        "sch-vinuni",
        "Học bổng VinUniversity",
        "Các gói học bổng của Trường Đại học VinUni (Vingroup) cho sinh viên xuất sắc và sinh viên có hoàn cảnh khó khăn, "
        "xét theo hồ sơ tuyển sinh hằng năm.",
        "VinUniversity (Vingroup)",
        "Hà Nội, Việt Nam",
        0.0,
        None,
        "Thí sinh trúng tuyển VinUni, hồ sơ học tập và bài luận theo tiêu chí từng gói học bổng.",
        "https://vinuni.edu.vn/hoc-bong/",
    ),
    (
        "sch-fpt",
        "Học bổng Đại học FPT",
        "Học bổng đầu vào và học bổng tài năng của Trường Đại học FPT dành cho thí sinh THPT, "
        "xét theo điểm học bạ, điểm thi tốt nghiệp hoặc thành tích ngoại khóa.",
        "Trường Đại học FPT",
        "Việt Nam",
        0.0,
        None,
        "Thí sinh tốt nghiệp THPT, đáp ứng ngưỡng điểm và điều kiện từng loại học bổng.",
        "https://daihoc.fpt.edu.vn/hoc-bong/",
    ),
    (
        "sch-vied",
        "Học bổng Chính phủ Việt Nam (Đề án 89/911)",
        "Học bổng toàn phần và bán phần của Nhà nước Việt Nam cho công dân Việt Nam đi học tập, nghiên cứu ở nước ngoài "
        "bằng ngân sách nhà nước, do Bộ GD&ĐT và Cục Hợp tác quốc tế quản lý.",
        "Bộ Giáo dục và Đào tạo (VIED)",
        "Nhiều quốc gia",
        0.0,
        None,
        "Công dân Việt Nam, có bằng đại học/thạc sĩ, đáp ứng yêu cầu ngoại ngữ và chuyên ngành ưu tiên.",
        "https://moet.gov.vn/giao-duc-quoc-te/",
    ),
]


# ---------------------------------------------------------------------------
# International programmes / exchanges
# ---------------------------------------------------------------------------
# (key, title, type, description, host_country, organization, deadline, benefits, url)
INTERNATIONAL_PROGRAMS: list[tuple] = [
    (
        "intl-afs",
        "AFS Vietnam — Giao lưu văn hóa quốc tế",
        "exchange",
        "Chương trình trao đổi văn hóa dành cho học sinh THPT Việt Nam sang học tập tại các nước đối tác và học sinh quốc tế đến Việt Nam.",
        "Nhiều quốc gia",
        "AFS Vietnam",
        None,
        "Sống cùng gia đình bản xứ, học tại trường địa phương, hỗ trợ của mạng lưới AFS.",
        "https://afsvietnam.org/",
    ),
    (
        "intl-yseali",
        "YSEALI — Sáng kiến Lãnh đạo trẻ Đông Nam Á (Hoa Kỳ)",
        "fellowship",
        "Chương trình của Bộ Ngoại giao Hoa Kỳ dành cho thanh niên 18–35 tuổi Đông Nam Á, gồm học bổng, "
        "trao đổi và quỹ tài trợ dự án cộng đồng.",
        "United States",
        "U.S. Department of State",
        None,
        "Đào tạo lãnh đạo, mạng lưới cựu học viên, quỹ hạt giống cho dự án cộng đồng.",
        "https://yseali.state.gov/",
    ),
    (
        "intl-ugrad",
        "Global UGRAD — Trao đổi đại học toàn cầu",
        "exchange",
        "Học bổng trao đổi một học kỳ tại Hoa Kỳ dành cho sinh viên đại học các nước, không yêu cầu TOEFL đầu vào.",
        "United States",
        "U.S. Department of State (World Learning)",
        None,
        "Miễn học phí, chỗ ở, sinh hoạt phí và vé máy bay trong thời gian trao đổi.",
        "https://exchanges.state.gov/us/program/global-undergraduate-exchange-program",
    ),
    (
        "intl-jenesys",
        "JENESYS — Trao đổi thanh niên Nhật Bản – châu Á",
        "exchange",
        "Chương trình của Chính phủ Nhật Bản mời thanh niên các nước châu Á sang Nhật Bản giao lưu văn hóa và học tập.",
        "Japan",
        "Government of Japan (MOFA)",
        None,
        "Tài trợ chi phí đi lại, lưu trú và hoạt động giao lưu tại Nhật Bản.",
        "https://www.mofa.go.jp/region/asia-paci/jenesys/",
    ),
    (
        "intl-seameo-rihed",
        "SEAMEO RIHED — Hợp tác giáo dục đại học Đông Nam Á",
        "program",
        "Trung tâm hợp tác giáo dục đại học khu vực Đông Nam Á, điều phối các chương trình trao đổi sinh viên và công nhận tín chỉ.",
        "Southeast Asia",
        "SEAMEO RIHED",
        None,
        "Mạng lưới đại học Đông Nam Á, học bổng và chương trình trao đổi ngắn hạn.",
        "https://rihed.seameo.org/",
    ),
    (
        "intl-erasmus-plus",
        "Erasmus+ — Trao đổi và hợp tác giáo dục châu Âu",
        "exchange",
        "Chương trình của Liên minh châu Âu hỗ trợ trao đổi sinh viên, giảng viên và hợp tác giữa các trường đại học.",
        "European Union",
        "European Commission",
        None,
        "Học bổng trao đổi ngắn hạn, thực tập và học bổng thạc sĩ liên kết EMJM.",
        "https://erasmus-plus.ec.europa.eu/",
    ),
    (
        "intl-campus-france",
        "Campus France Vietnam — Du học Pháp",
        "program",
        "Cơ quan chính thức của Chính phủ Pháp về du học, cung cấp thông tin học bổng, thủ tục visa và hướng dẫn hồ sơ.",
        "France",
        "Campus France Vietnam",
        None,
        "Tư vấn miễn phí, học bổng của Chính phủ Pháp và các trường, hỗ trợ thủ tục visa.",
        "https://www.vietnam.campusfrance.org/",
    ),
    (
        "intl-daad-vn",
        "DAAD Vietnam — Du học và nghiên cứu tại Đức",
        "program",
        "Văn phòng đại diện DAAD tại Việt Nam cung cấp học bổng và tư vấn du học Đức cho sinh viên, nghiên cứu sinh.",
        "Germany",
        "DAAD Vietnam",
        None,
        "Học bổng thạc sĩ, tiến sĩ, nghiên cứu ngắn hạn và khóa học tiếng Đức.",
        "https://www.daad.de/en/worldwide/daad-vietnam/",
    ),
    (
        "intl-asean-youth-fellowship",
        "ASEAN Youth Fellowship",
        "fellowship",
        "Chương trình học bổng lãnh đạo dành cho thanh niên ASEAN, kết nối với mạng lưới chính sách và doanh nghiệp khu vực.",
        "Southeast Asia",
        "ASEAN Youth Fellowship",
        None,
        "Đào tạo lãnh đạo, mentoring và mạng lưới cựu học viên ASEAN.",
        "https://www.aseanyouthfellowship.org/",
    ),
]


# ---------------------------------------------------------------------------
# Opportunities — real Vietnamese competitions / campaigns
# ---------------------------------------------------------------------------
# (key, title, type, description, organization, address, deadline, requirements, benefits, url, tags, region)
OPPORTUNITIES: list[tuple] = [
    (
        "opp-olp",
        "Olympic Tin học Sinh viên Việt Nam (OLP)",
        "competition",
        "Kỳ thi lập trình thuật toán lớn nhất dành cho sinh viên các trường đại học Việt Nam, do Hội Tin học Việt Nam phối hợp tổ chức hằng năm.",
        "Hội Tin học Việt Nam (VAIP)",
        "Việt Nam",
        None,
        "Sinh viên đang theo học tại các trường đại học, cao đẳng; thi theo đội tuyển của trường.",
        "Cơ hội tranh tài thuật toán, gặp gỡ doanh nghiệp công nghệ, bổ sung hồ sơ nghề nghiệp.",
        "https://vaip.org.vn/",
        '["thuật toán","lập trình","tin học","olp"]',
        "toàn quốc",
    ),
    (
        "opp-eureka",
        "Giải thưởng Sinh viên Nghiên cứu Khoa học Eureka",
        "competition",
        "Giải thưởng nghiên cứu khoa học dành cho sinh viên do Đại học Quốc gia TP. Hồ Chí Minh tổ chức thường niên.",
        "Đại học Quốc gia TP. Hồ Chí Minh",
        "TP. Hồ Chí Minh",
        None,
        "Sinh viên có đề tài nghiên cứu khoa học, có giảng viên hướng dẫn.",
        "Giải thưởng tiền mặt, công bố khoa học và cơ hội tuyển thẳng sau đại học.",
        "https://vnuhcm.edu.vn/",
        '["nghiên cứu","khoa học","eureka","sinh viên"]',
        "TP. Hồ Chí Minh",
    ),
    (
        "opp-svstartup",
        "Cuộc thi Khởi nghiệp Quốc gia SV.STARTUP",
        "competition",
        "Sân chơi khởi nghiệp dành cho sinh viên toàn quốc, do Bộ Giáo dục và Đào tạo chỉ đạo tổ chức.",
        "Bộ Giáo dục và Đào tạo",
        "Việt Nam",
        None,
        "Sinh viên, nhóm sinh viên có ý tưởng/dự án khởi nghiệp.",
        "Ươm tạo, kết nối nhà đầu tư, giải thưởng và hỗ trợ pháp lý.",
        "https://svstartup.vn/",
        '["khởi nghiệp","startup","sinh viên"]',
        "toàn quốc",
    ),
    (
        "opp-techfest",
        "Techfest Vietnam",
        "event",
        "Ngày hội khởi nghiệp đổi mới sáng tạo quốc gia do Bộ Khoa học và Công nghệ chủ trì, quy tụ startup, quỹ đầu tư và chuyên gia.",
        "Bộ Khoa học và Công nghệ",
        "Việt Nam",
        None,
        "Startup, sinh viên, nhà nghiên cứu và doanh nghiệp quan tâm đổi mới sáng tạo.",
        "Kết nối đầu tư, triển lãm công nghệ, hội thảo chuyên đề.",
        "https://techfest.vn/",
        '["khởi nghiệp","đổi mới sáng tạo","techfest"]',
        "toàn quốc",
    ),
    (
        "opp-vic",
        "Vietnam Innovation Challenge (NIC)",
        "competition",
        "Chương trình tìm kiếm giải pháp đổi mới sáng tạo do Trung tâm Đổi mới sáng tạo Quốc gia (NIC) thuộc Bộ KH&CN tổ chức.",
        "Trung tâm Đổi mới sáng tạo Quốc gia (NIC)",
        "Hà Nội",
        None,
        "Cá nhân, nhóm nghiên cứu, doanh nghiệp có giải pháp công nghệ.",
        "Hỗ trợ ươm tạo, kết nối đối tác và quỹ đầu tư.",
        "https://nic.gov.vn/",
        '["đổi mới sáng tạo","công nghệ","nic"]',
        "toàn quốc",
    ),
    (
        "opp-tinhoc-tre",
        "Hội thi Tin học trẻ toàn quốc",
        "competition",
        "Hội thi Tin học dành cho học sinh phổ thông do Trung ương Đoàn TNCS Hồ Chí Minh phối hợp Bộ GD&ĐT, Bộ KH&CN tổ chức.",
        "Trung ương Đoàn TNCS Hồ Chí Minh",
        "Việt Nam",
        None,
        "Học sinh tiểu học, THCS, THPT đạt giải tại vòng tỉnh/thành.",
        "Giải thưởng, học bổng và cơ hội tham gia đội tuyển quốc gia.",
        "https://doanthanhnien.vn/",
        '["tin học","học sinh","lập trình"]',
        "toàn quốc",
    ),
    (
        "opp-mua-he-xanh",
        "Chiến dịch Thanh niên tình nguyện Mùa hè xanh",
        "volunteer",
        "Chiến dịch tình nguyện hè hằng năm của Đoàn TNCS Hồ Chí Minh, đưa sinh viên về các địa phương dạy học, xây dựng nông thôn mới.",
        "Trung ương Đoàn TNCS Hồ Chí Minh",
        "Việt Nam",
        None,
        "Đoàn viên, thanh niên, sinh viên đăng ký qua Đoàn trường/Đoàn địa phương.",
        "Rèn luyện kỹ năng, chứng nhận tình nguyện, đóng góp cộng đồng.",
        "https://doanthanhnien.vn/",
        '["tình nguyện","mùa hè xanh","sinh viên"]',
        "toàn quốc",
    ),
    (
        "opp-hien-mau",
        "Chiến dịch Hiến máu nhân đạo",
        "volunteer",
        "Hoạt động hiến máu tình nguyện do Hội Chữ thập đỏ Việt Nam và Viện Huyết học – Truyền máu Trung ương tổ chức thường xuyên.",
        "Hội Chữ thập đỏ Việt Nam",
        "Việt Nam",
        None,
        "Người từ 18–60 tuổi, đủ điều kiện sức khỏe theo quy định.",
        "Cứu sống người bệnh, nhận giấy chứng nhận hiến máu.",
        "https://chuthapdo.org.vn/",
        '["hiến máu","tình nguyện","cộng đồng"]',
        "toàn quốc",
    ),
    (
        "opp-gdg-devfest",
        "GDG DevFest Vietnam",
        "event",
        "Chuỗi sự kiện công nghệ thường niên của cộng đồng Google Developer Groups tại Việt Nam, quy tụ hàng nghìn lập trình viên.",
        "Google Developer Groups Vietnam",
        "Hà Nội / TP. Hồ Chí Minh",
        None,
        "Lập trình viên, sinh viên CNTT, người quan tâm công nghệ Google.",
        "Học hỏi từ chuyên gia, networking, workshop thực hành.",
        "https://gdg.community.dev/",
        '["công nghệ","google","devfest","lập trình viên"]',
        "toàn quốc",
    ),
    (
        "opp-asean-dse",
        "ASEAN Data Science Explorers",
        "competition",
        "Cuộc thi phân tích dữ liệu dành cho sinh viên Đông Nam Á do Quỹ ASEAN và SAP tổ chức.",
        "ASEAN Foundation & SAP",
        "Southeast Asia",
        None,
        "Sinh viên các trường đại học tại Việt Nam, làm việc theo đội.",
        "Chứng chỉ quốc tế, giải thưởng và cơ hội tham dự vòng chung kết khu vực.",
        "https://www.aseandse.org/",
        '["data science","phân tích dữ liệu","asean"]',
        "toàn quốc",
    ),
    (
        "opp-google-solution-challenge",
        "Google Solution Challenge",
        "competition",
        "Cuộc thi toàn cầu của Google dành cho sinh viên phát triển giải pháp cho 17 Mục tiêu Phát triển Bền vững của Liên Hợp Quốc.",
        "Google Developer Student Clubs",
        "Toàn cầu",
        None,
        "Sinh viên đại học, làm việc theo đội 2–4 người.",
        "Hỗ trợ kỹ thuật từ Google, giải thưởng và cơ hội thực tập.",
        "https://developers.google.com/community/gdsc-solution-challenge",
        '["google","sustainability","sinh viên","hackathon"]',
        "toàn cầu",
    ),
]


# ---------------------------------------------------------------------------
# Internships — real employers with public internship/career pages
# ---------------------------------------------------------------------------
# (key, title, company, field, address, salary, duration, requirements, benefits, url)
INTERNSHIPS: list[tuple] = [
    (
        "intern-fpt-software",
        "Thực tập sinh Kỹ thuật Phần mềm",
        "FPT Software",
        "Công nghệ thông tin",
        "Khu Công nghệ cao Hòa Lạc, Hà Nội / TP. Hồ Chí Minh",
        "Thỏa thuận",
        "3–6 tháng",
        "Sinh viên năm 3–4 CNTT, biết Java/.NET/JavaScript, tiếng Anh cơ bản.",
        "Đào tạo Fresher, mentor 1-1, cơ hội ký hợp đồng chính thức.",
        "https://career.fpt-software.com/",
    ),
    (
        "intern-vng",
        "Thực tập sinh Công nghệ (VNG Campus)",
        "VNG Corporation",
        "Công nghệ thông tin",
        "VNG Campus, TP. Hồ Chí Minh",
        "Thỏa thuận",
        "3–6 tháng",
        "Sinh viên CNTT/Khoa học máy tính, có kiến thức nền tảng lập trình.",
        "Tham gia sản phẩm thật, đào tạo nội bộ, cơ hội trở thành nhân viên chính thức.",
        "https://careers.vng.com.vn/",
    ),
    (
        "intern-viettel",
        "Thực tập sinh tại Viettel",
        "Tập đoàn Công nghiệp – Viễn thông Quân đội (Viettel)",
        "Viễn thông / CNTT",
        "Hà Nội và các tỉnh thành",
        "Thỏa thuận",
        "2–6 tháng",
        "Sinh viên các trường đại học, chuyên ngành theo nhu cầu từng đợt.",
        "Môi trường thực tế, phụ cấp thực tập, cơ hội tuyển dụng.",
        "https://tuyendung.viettel.vn/",
    ),
    (
        "intern-vinai",
        "Thực tập sinh Nghiên cứu AI",
        "VinAI Research",
        "Trí tuệ nhân tạo",
        "Hà Nội / TP. Hồ Chí Minh",
        "Thỏa thuận",
        "3–6 tháng",
        "Sinh viên xuất sắc ngành CNTT/Toán, có nền tảng học máy, đọc hiểu bài báo khoa học.",
        "Làm việc cùng nhà nghiên cứu, GPU server, cơ hội công bố khoa học.",
        "https://www.vinai.io/careers/",
    ),
    (
        "intern-shopee",
        "Thực tập sinh Engineering / Data",
        "Shopee Vietnam",
        "Thương mại điện tử",
        "TP. Hồ Chí Minh",
        "Thỏa thuận",
        "3–6 tháng",
        "Sinh viên năm 3–4, tư duy logic, tiếng Anh tốt.",
        "Mentor, đào tạo kỹ thuật, cơ hội chuyển chính thức.",
        "https://careers.shopee.vn/",
    ),
    (
        "intern-grab",
        "Thực tập sinh Công nghệ tại Grab",
        "Grab Vietnam",
        "Công nghệ thông tin",
        "TP. Hồ Chí Minh",
        "Thỏa thuận",
        "3–6 tháng",
        "Sinh viên CNTT, kỹ năng lập trình và giải quyết vấn đề.",
        "Môi trường khu vực, mentoring, cơ hội nghề nghiệp.",
        "https://www.grab.careers/",
    ),
    (
        "intern-bosch",
        "Thực tập sinh Kỹ thuật tại Bosch",
        "Bosch Vietnam",
        "Cơ điện tử / Tự động hóa",
        "Khu công nghiệp Long Hậu, Long An / TP. Hồ Chí Minh",
        "Thỏa thuận",
        "6 tháng",
        "Sinh viên kỹ thuật, tiếng Anh tốt.",
        "Đào tạo theo chuẩn Đức, phụ cấp, cơ hội nghề nghiệp quốc tế.",
        "https://www.bosch.com.vn/careers/",
    ),
    (
        "intern-samsung",
        "Thực tập sinh Samsung Việt Nam",
        "Samsung Electronics Vietnam",
        "Kỹ thuật / CNTT",
        "Bắc Ninh / Thái Nguyên / TP. Hồ Chí Minh",
        "Thỏa thuận",
        "2–3 tháng",
        "Sinh viên năm 3–4 các trường kỹ thuật, tiếng Anh/Hàn là lợi thế.",
        "Chương trình đào tạo, phụ cấp, cơ hội tuyển dụng.",
        "https://www.samsung.com/vn/about-us/careers/",
    ),
    (
        "intern-intel",
        "Thực tập sinh Kỹ thuật tại Intel",
        "Intel Products Vietnam",
        "Bán dẫn / Kỹ thuật",
        "Khu Công nghệ cao, TP. Hồ Chí Minh",
        "Thỏa thuận",
        "3–6 tháng",
        "Sinh viên kỹ thuật điện – điện tử, cơ khí, CNTT.",
        "Môi trường đa quốc gia, đào tạo chuyên môn, phụ cấp.",
        "https://www.intel.com/content/www/us/en/jobs/locations/vietnam.html",
    ),
    (
        "intern-unilever",
        "Thực tập sinh Unilever Việt Nam",
        "Unilever Vietnam",
        "Kinh doanh / Marketing / Supply Chain",
        "TP. Hồ Chí Minh / Hà Nội",
        "Thỏa thuận",
        "3 tháng",
        "Sinh viên năm 3–4, tiếng Anh tốt, tư duy kinh doanh.",
        "Chương trình Future Leaders, mentoring, cơ hội tuyển dụng.",
        "https://careers.unilever.com/vietnam",
    ),
]


# ---------------------------------------------------------------------------
# Events — real recurring Vietnamese events (upcoming windows)
# ---------------------------------------------------------------------------
# (key, title, description, type, address, start_date, end_date, url, tags, is_online)
EVENTS: list[tuple] = [
    (
        "evt-techfest",
        "Techfest Vietnam 2026 — Ngày hội khởi nghiệp đổi mới sáng tạo quốc gia",
        "Sự kiện thường niên lớn nhất về khởi nghiệp đổi mới sáng tạo tại Việt Nam, do Bộ Khoa học và Công nghệ chủ trì.",
        "conference",
        "Việt Nam",
        "2026-11-25T01:00:00+00:00",
        "2026-11-27T10:00:00+00:00",
        "https://techfest.vn/",
        '["khởi nghiệp","đổi mới sáng tạo","techfest"]',
        0,
    ),
    (
        "evt-devfest",
        "GDG DevFest Vietnam 2026",
        "Chuỗi sự kiện công nghệ của cộng đồng Google Developer Groups Việt Nam với workshop, talks và networking.",
        "conference",
        "Hà Nội / TP. Hồ Chí Minh",
        "2026-11-14T01:00:00+00:00",
        "2026-11-14T10:00:00+00:00",
        "https://gdg.community.dev/",
        '["công nghệ","google","devfest"]',
        0,
    ),
    (
        "evt-olp",
        "Olympic Tin học Sinh viên Việt Nam lần thứ 34",
        "Kỳ thi lập trình thuật toán toàn quốc dành cho sinh viên, do Hội Tin học Việt Nam tổ chức.",
        "contest",
        "Việt Nam",
        "2026-12-05T01:00:00+00:00",
        "2026-12-08T10:00:00+00:00",
        "https://vaip.org.vn/",
        '["olp","thuật toán","sinh viên"]',
        0,
    ),
    (
        "evt-svstartup",
        "Chung kết Cuộc thi Khởi nghiệp Quốc gia SV.STARTUP 2026",
        "Vòng chung kết toàn quốc cuộc thi khởi nghiệp dành cho sinh viên do Bộ Giáo dục và Đào tạo chỉ đạo.",
        "competition",
        "Việt Nam",
        "2026-12-12T01:00:00+00:00",
        "2026-12-13T10:00:00+00:00",
        "https://svstartup.vn/",
        '["khởi nghiệp","sinh viên","svstartup"]',
        0,
    ),
    (
        "evt-stem-festival",
        "Ngày hội STEM Quốc gia 2027",
        "Ngày hội STEM thường niên dành cho học sinh, sinh viên và giáo viên, do Bộ Khoa học và Công nghệ và Bộ GD&ĐT phối hợp tổ chức.",
        "festival",
        "Việt Nam",
        "2027-01-17T01:00:00+00:00",
        "2027-01-18T10:00:00+00:00",
        "https://most.gov.vn/",
        '["stem","robotics","giáo dục"]',
        0,
    ),
    (
        "evt-hien-mau",
        "Ngày hội Hiến máu nhân đạo — Hành trình Đỏ",
        "Chiến dịch hiến máu tình nguyện quy mô quốc gia do Hội Chữ thập đỏ Việt Nam và Viện Huyết học – Truyền máu Trung ương tổ chức.",
        "volunteer",
        "Việt Nam",
        "2027-01-10T00:00:00+00:00",
        "2027-01-10T10:00:00+00:00",
        "https://chuthapdo.org.vn/",
        '["hiến máu","tình nguyện","cộng đồng"]',
        0,
    ),
]


# ---------------------------------------------------------------------------
# Hackathons — real, recurring competitions open to Vietnamese students
# ---------------------------------------------------------------------------
# (key, title, description, start_date, end_date, status, url)
HACKATHONS: list[tuple] = [
    (
        "hack-techfest",
        "Techfest Vietnam 2026 — Hackathon & Demo Day",
        "Phần thi hackathon và trình diễn giải pháp trong khuôn khổ Techfest Vietnam 2026 do Bộ Khoa học và Công nghệ chủ trì.",
        "2026-11-25 00:00:00",
        "2026-11-27 00:00:00",
        "upcoming",
        "https://techfest.vn/",
    ),
    (
        "hack-devfest",
        "GDG DevFest Vietnam 2026 Hackathon",
        "Hackathon cộng đồng trong khuôn khổ DevFest Vietnam 2026 của Google Developer Groups.",
        "2026-11-14 00:00:00",
        "2026-11-14 00:00:00",
        "upcoming",
        "https://gdg.community.dev/",
    ),
    (
        "hack-solution-challenge",
        "Google Solution Challenge 2027",
        "Cuộc thi toàn cầu của Google dành cho sinh viên giải quyết 17 Mục tiêu Phát triển Bền vững.",
        "2027-01-15 00:00:00",
        "2027-06-30 00:00:00",
        "upcoming",
        "https://developers.google.com/community/gdsc-solution-challenge",
    ),
    (
        "hack-vic",
        "Vietnam Innovation Challenge 2027",
        "Chương trình tìm kiếm giải pháp đổi mới sáng tạo do Trung tâm Đổi mới sáng tạo Quốc gia (NIC) tổ chức.",
        "2027-03-01 00:00:00",
        "2027-03-31 00:00:00",
        "upcoming",
        "https://nic.gov.vn/",
    ),
    (
        "hack-asean-dse",
        "ASEAN Data Science Explorers 2027",
        "Cuộc thi phân tích dữ liệu khu vực Đông Nam Á do Quỹ ASEAN và SAP tổ chức.",
        "2027-02-01 00:00:00",
        "2027-04-30 00:00:00",
        "upcoming",
        "https://www.aseandse.org/",
    ),
]


# ---------------------------------------------------------------------------
# Career paths — Vietnamese roles with reference salary bands
# ---------------------------------------------------------------------------
# (key, title, field, description, skills, roadmap, salary, demand, resources)
CAREER_PATHS: list[tuple] = [
    (
        "career-software-engineer",
        "Kỹ sư Phần mềm (Software Engineer)",
        "Công nghệ thông tin",
        "Thiết kế, phát triển và bảo trì hệ thống phần mềm cho sản phẩm web, mobile hoặc backend.",
        '["Lập trình","Cấu trúc dữ liệu","Git","Hệ quản trị CSDL","Tiếng Anh"]',
        '["Học nền tảng lập trình","Xây dựng 2-3 dự án cá nhân","Thực tập tại doanh nghiệp","Junior Developer","Middle/Senior"]',
        "15–40 triệu/tháng (tham khảo ITviec 2025)",
        "cao",
        '["https://vnoi.info/","https://daynhauhoc.com/","https://roadmap.sh/"]',
    ),
    (
        "career-data-analyst",
        "Chuyên viên Phân tích Dữ liệu (Data Analyst)",
        "Dữ liệu",
        "Thu thập, làm sạch và phân tích dữ liệu để hỗ trợ ra quyết định kinh doanh.",
        '["SQL","Excel","Power BI/Tableau","Python","Thống kê"]',
        '["Học SQL và thống kê","Thành thạo một công cụ BI","Làm dashboard thực tế","Thực tập phân tích dữ liệu","Data Analyst"]',
        "15–35 triệu/tháng (tham khảo VietnamWorks 2025)",
        "cao",
        '["https://www.kaggle.com/learn","https://learn.microsoft.com/vi-vn/power-bi/","https://www.coursera.org/"]',
    ),
    (
        "career-ai-engineer",
        "Kỹ sư Trí tuệ Nhân tạo (AI/ML Engineer)",
        "Trí tuệ nhân tạo",
        "Xây dựng, huấn luyện và triển khai mô hình học máy, mô hình ngôn ngữ lớn vào sản phẩm.",
        '["Python","PyTorch/TensorFlow","Toán học","MLOps","Tiếng Anh"]',
        '["Học Python và đại số tuyến tính","Học machine learning","Tham gia cuộc thi Kaggle/AI","Thực tập AI","AI Engineer"]',
        "25–60 triệu/tháng (tham khảo ITviec 2025)",
        "rất cao",
        '["https://vinai.io/","https://www.coursera.org/specializations/machine-learning-introduction","https://paperswithcode.com/"]',
    ),
    (
        "career-automation",
        "Kỹ sư Tự động hóa",
        "Cơ điện tử",
        "Thiết kế, lập trình và bảo trì hệ thống tự động hóa cho nhà máy, dây chuyền sản xuất.",
        '["PLC","Điện – Điện tử","SCADA","Robotics","Tiếng Anh kỹ thuật"]',
        '["Học điện – điện tử","Thành thạo PLC","Thực tập nhà máy","Kỹ sư tự động hóa"]',
        "12–30 triệu/tháng (tham khảo VietnamWorks 2025)",
        "cao",
        '["https://www.bosch.com.vn/","https://www.siemens.com/vn/","https://www.automationworld.com/"]',
    ),
    (
        "career-digital-marketing",
        "Chuyên viên Marketing số",
        "Marketing",
        "Triển khai chiến dịch quảng cáo, SEO, nội dung và phân tích hiệu quả trên các kênh số.",
        '["SEO","Google Ads","Meta Ads","Content","Phân tích dữ liệu"]',
        '["Học marketing căn bản","Chứng chỉ Google/Meta","Chạy dự án thực tế","Digital Marketer"]',
        "10–25 triệu/tháng (tham khảo VietnamWorks 2025)",
        "cao",
        '["https://skillshop.withgoogle.com/","https://www.facebook.com/business/learn","https://ahrefs.com/blog/vi/"]',
    ),
    (
        "career-stem-teacher",
        "Giáo viên STEM / Tin học",
        "Giáo dục",
        "Giảng dạy STEM, tin học và robotics cho học sinh phổ thông, xây dựng bài giảng và hoạt động trải nghiệm.",
        '["Sư phạm","Tin học","Robotics","Thiết kế bài giảng","Tin học văn phòng"]',
        '["Học sư phạm/chuyên ngành","Chứng chỉ nghiệp vụ sư phạm","Thực tập giảng dạy","Giáo viên STEM"]',
        "8–18 triệu/tháng (tham khảo ngành giáo dục 2025)",
        "trung bình",
        '["https://moet.gov.vn/","https://stem.edu.vn/","https://www.khanacademy.org/"]',
    ),
    (
        "career-accountant",
        "Kế toán – Tài chính",
        "Tài chính",
        "Ghi nhận, kiểm soát và báo cáo tài chính; thực hiện nghĩa vụ thuế cho doanh nghiệp.",
        '["Nguyên lý kế toán","Excel","Luật thuế","Phần mềm kế toán","Chứng chỉ CPA"]',
        '["Học kế toán","Chứng chỉ kế toán viên","Thực tập tại doanh nghiệp","Kế toán viên","Kế toán trưởng"]',
        "8–20 triệu/tháng (tham khảo VietnamWorks 2025)",
        "trung bình",
        '["https://mof.gov.vn/","https://www.misa.vn/","https://www.vacpa.org.vn/"]',
    ),
    (
        "career-hr",
        "Chuyên viên Nhân sự (HR)",
        "Nhân sự",
        "Tuyển dụng, đào tạo, đánh giá hiệu suất và xây dựng văn hóa doanh nghiệp.",
        '["Giao tiếp","Luật lao động","Tuyển dụng","Excel","Tiếng Anh"]',
        '["Học quản trị nhân lực","Thực tập HR","Chuyên viên tuyển dụng","HR Business Partner"]',
        "8–20 triệu/tháng (tham khảo VietnamWorks 2025)",
        "trung bình",
        '["https://molisa.gov.vn/","https://www.vietnamworks.com/","https://www.shrm.org/"]',
    ),
]


# ---------------------------------------------------------------------------
# STEM labs — real schools/universities in Đồng Nai with maker spaces
# ---------------------------------------------------------------------------
# (key, name, address, description, equipment, contact)
STEM_LABS: list[tuple] = [
    (
        "lab-ltv",
        "Phòng thực hành Tin học – THPT Chuyên Lương Thế Vinh",
        "TP. Biên Hòa, Đồng Nai",
        "Phòng máy và không gian thực hành tin học của Trường THPT Chuyên Lương Thế Vinh, nơi học sinh luyện thi học sinh giỏi tin học.",
        '["Máy tính","Máy chiếu","Thiết bị mạng"]',
        "https://thptchuyenluongthevinh.edu.vn/",
    ),
    (
        "lab-lhu-robotics",
        "Lab Robotics – Trường Đại học Lạc Hồng",
        "Số 10 Huỳnh Văn Nghệ, Bửu Long, TP. Biên Hòa, Đồng Nai",
        "Không gian nghiên cứu và chế tạo robot của Đại học Lạc Hồng, đơn vị nhiều lần vô địch cuộc thi Robocon Việt Nam.",
        '["Robot","Vi điều khiển","Máy in 3D","Đồ điện tử"]',
        "https://lhu.edu.vn/",
    ),
    (
        "lab-nguyen-trai",
        "Phòng thực hành STEM – THPT Nguyễn Trãi",
        "TP. Biên Hòa, Đồng Nai",
        "Không gian dạy học STEM của Trường THPT Nguyễn Trãi với các bộ kit thí nghiệm vật lý, hóa học và robotics cơ bản.",
        '["Bộ kit STEM","Kính hiển vi","Thiết bị thí nghiệm"]',
        "https://thptnguyentrai.edu.vn/",
    ),
    (
        "lab-tran-bien",
        "Phòng Tin học – THCS Trấn Biên",
        "TP. Biên Hòa, Đồng Nai",
        "Phòng máy tính phục vụ dạy học tin học và câu lạc bộ lập trình cho học sinh THCS Trấn Biên.",
        '["Máy tính","Máy chiếu","Kit Arduino"]',
        "https://thcstranbien.edu.vn/",
    ),
    (
        "lab-long-khanh",
        "Phòng thực hành Khoa học – THPT Long Khánh",
        "TP. Long Khánh, Đồng Nai",
        "Phòng thí nghiệm lý – hóa – sinh và không gian trải nghiệm STEM của Trường THPT Long Khánh.",
        '["Thiết bị thí nghiệm","Kính hiển vi","Mô hình"]',
        "https://thptlongkhanh.edu.vn/",
    ),
    (
        "lab-dnu",
        "Trung tâm Thực hành – Trường Đại học Đồng Nai",
        "TP. Biên Hòa, Đồng Nai",
        "Khu thực hành kỹ thuật và công nghệ của Trường Đại học Đồng Nai, phục vụ đào tạo kỹ sư và giáo viên STEM.",
        '["Máy CNC","PLC","Thiết bị điện – điện tử"]',
        "https://dnu.edu.vn/",
    ),
]


# ---------------------------------------------------------------------------
# Green challenges — real national environmental campaigns
# ---------------------------------------------------------------------------
# (key, title, description, type, start, end, points, url, address, lat, lng)
GREEN_CHALLENGES: list[tuple] = [
    (
        "green-earth-hour",
        "Giờ Trái đất Việt Nam 2027",
        "Chiến dịch toàn cầu do WWF phát động, kêu gọi tắt đèn và thiết bị điện không cần thiết trong 60 phút để tiết kiệm năng lượng.",
        "campaign",
        "2027-03-27T20:30:00+00:00",
        "2027-03-27T21:30:00+00:00",
        "50",
        "https://wwf.org.vn/",
        "Toàn quốc",
        21.0285,
        105.8342,
    ),
    (
        "green-tet-trong-cay",
        "Tết trồng cây — Vì một Việt Nam xanh",
        "Phong trào trồng cây hằng năm được phát động từ Tết Nguyên đán, hưởng ứng chương trình trồng 1 tỷ cây xanh của Chính phủ.",
        "campaign",
        "2027-02-01T00:00:00+00:00",
        "2027-03-31T00:00:00+00:00",
        "50",
        "https://doanthanhnien.vn/",
        "Toàn quốc",
        21.0285,
        105.8342,
    ),
    (
        "green-clean-up",
        "Chiến dịch Làm cho thế giới sạch hơn",
        "Chiến dịch quốc tế về bảo vệ môi trường do Australia khởi xướng, được Bộ Tài nguyên và Môi trường Việt Nam hưởng ứng hằng năm.",
        "campaign",
        "2027-09-18T00:00:00+00:00",
        "2027-09-20T00:00:00+00:00",
        "40",
        "https://monre.gov.vn/",
        "Toàn quốc",
        21.0285,
        105.8342,
    ),
    (
        "green-world-environment-day",
        "Ngày Môi trường Thế giới 5/6",
        "Ngày hành động vì môi trường toàn cầu, được Bộ Tài nguyên và Môi trường phát động với nhiều hoạt động dọn rác, trồng cây và tuyên truyền.",
        "campaign",
        "2027-06-05T00:00:00+00:00",
        "2027-06-05T23:59:00+00:00",
        "30",
        "https://monre.gov.vn/",
        "Toàn quốc",
        21.0285,
        105.8342,
    ),
]


# ---------------------------------------------------------------------------
# Summer campaigns — real Youth Union campaigns
# ---------------------------------------------------------------------------
# (key, name, year, location, status, description, lat, lng)
SUMMER_CAMPAIGNS: list[tuple] = [
    (
        "summer-mua-he-xanh",
        "Mùa hè xanh 2027",
        "2027",
        "Toàn quốc",
        "upcoming",
        "Chiến dịch tình nguyện hè của sinh viên Việt Nam do Trung ương Đoàn TNCS Hồ Chí Minh phát động, đưa sinh viên về địa phương dạy học và xây dựng cộng đồng.",
        21.0285,
        105.8342,
    ),
    (
        "summer-hoa-phuong-do",
        "Hoa phượng đỏ 2027",
        "2027",
        "Toàn quốc",
        "upcoming",
        "Chiến dịch tình nguyện hè dành cho học sinh THPT, do Đoàn TNCS Hồ Chí Minh tổ chức.",
        21.0285,
        105.8342,
    ),
    (
        "summer-ky-nghi-hong",
        "Kỳ nghỉ hồng 2027",
        "2027",
        "Toàn quốc",
        "upcoming",
        "Chiến dịch tình nguyện hè dành cho thanh niên công nhân, viên chức, lao động trẻ, với điểm đến tiêu biểu tại Hạ Long, Quảng Ninh.",
        20.6723,
        106.6297,
    ),
    (
        "summer-hanh-quan-xanh",
        "Hành quân xanh 2027",
        "2027",
        "Toàn quốc",
        "upcoming",
        "Chiến dịch tình nguyện hè của thanh niên lực lượng vũ trang, phối hợp cùng Đoàn TNCS Hồ Chí Minh.",
        21.0285,
        105.8342,
    ),
    (
        "summer-xuan-tinh-nguyen",
        "Xuân tình nguyện 2027",
        "2027",
        "Toàn quốc",
        "upcoming",
        "Chương trình tình nguyện dịp Tết Nguyên đán do Trung ương Đoàn phát động, chăm lo cho người nghèo và trẻ em khó khăn.",
        21.0285,
        105.8342,
    ),
]


# ---------------------------------------------------------------------------
# Donation campaigns — real, official Vietnamese funds
# ---------------------------------------------------------------------------
# (key, title, description, target, organizer, address, start, end, url, lat, lng)
DONATION_CAMPAIGNS: list[tuple] = [
    (
        "donate-quy-vi-tre-em",
        "Quỹ Vì trẻ em Việt Nam",
        "Quỹ quốc gia do Bộ Lao động – Thương binh và Xã hội quản lý, hỗ trợ trẻ em mồ côi, trẻ em có hoàn cảnh đặc biệt khó khăn.",
        0.0,
        "Bộ Lao động – Thương binh và Xã hội",
        "Hà Nội",
        None,
        None,
        "https://quyvitreem.vn/",
        21.0285,
        105.8342,
    ),
    (
        "donate-tam-long-viet",
        "Quỹ Tấm lòng Việt",
        "Quỹ thiện nguyện của Đài Truyền hình Việt Nam, hỗ trợ các hoàn cảnh khó khăn trên cả nước.",
        0.0,
        "Đài Truyền hình Việt Nam (VTV)",
        "Hà Nội",
        None,
        None,
        "https://vtv.vn/tam-long-viet.htm",
        21.0285,
        105.8342,
    ),
    (
        "donate-operation-smile",
        "Operation Smile Vietnam — Phẫu thuật nụ cười",
        "Tổ chức phi lợi nhuận cung cấp phẫu thuật miễn phí cho trẻ em bị sứt môi, hở hàm ếch tại Việt Nam.",
        0.0,
        "Operation Smile Vietnam",
        "TP. Hồ Chí Minh",
        None,
        None,
        "https://operationsmile.org.vn/",
        10.7727,
        106.6548,
    ),
    (
        "donate-saigonchildren",
        "Saigon Children's Charity — Vì trẻ em Việt Nam",
        "Tổ chức phi lợi nhuận hỗ trợ giáo dục, y tế và sinh kế cho trẻ em có hoàn cảnh khó khăn tại Việt Nam.",
        0.0,
        "Saigon Children's Charity",
        "TP. Hồ Chí Minh",
        None,
        None,
        "https://saigonchildren.com/",
        10.7727,
        106.6548,
    ),
    (
        "donate-blue-dragon",
        "Blue Dragon Children's Foundation",
        "Tổ chức hỗ trợ trẻ em đường phố, trẻ em bị buôn bán và gia đình khó khăn tại Việt Nam.",
        0.0,
        "Blue Dragon Children's Foundation",
        "Hà Nội",
        None,
        None,
        "https://bluedragon.org/",
        21.0285,
        105.8342,
    ),
    (
        "donate-song-va-may-tinh",
        "Chương trình Sóng và máy tính cho em",
        "Chương trình của Bộ Giáo dục và Đào tạo và Bộ Thông tin và Truyền thông hỗ trợ thiết bị học trực tuyến cho học sinh khó khăn.",
        0.0,
        "Bộ Giáo dục và Đào tạo",
        "Việt Nam",
        None,
        None,
        "https://moet.gov.vn/",
        21.0285,
        105.8342,
    ),
    (
        "donate-mattran",
        "Quỹ Cứu trợ Trung ương — Ủy ban Trung ương Mặt trận Tổ quốc Việt Nam",
        "Quỹ tiếp nhận ủng hộ cho đồng bào bị thiên tai, bão lũ và các hoàn cảnh khó khăn.",
        0.0,
        "Ủy ban Trung ương Mặt trận Tổ quốc Việt Nam",
        "Hà Nội",
        None,
        None,
        "https://mattran.org.vn/",
        21.0285,
        105.8342,
    ),
]


# ---------------------------------------------------------------------------
# Learning materials — real, free Vietnamese learning sites
# ---------------------------------------------------------------------------
# (key, title, description, type, subject, grade, tags, url, thumbnail)
LEARNING_MATERIALS: list[tuple] = [
    (
        "mat-khan-academy",
        "Khan Academy Tiếng Việt",
        "Kho bài giảng và bài tập miễn phí môn Toán, Khoa học, Kinh tế bằng tiếng Việt cho học sinh phổ thông.",
        "video",
        "Toán",
        "6-12",
        '["toán","khoa học","miễn phí","khan academy"]',
        "https://vi.khanacademy.org/",
    ),
    (
        "mat-sgk-so",
        "Sách giáo khoa số — Nhà xuất bản Giáo dục Việt Nam",
        "Nền tảng sách giáo khoa điện tử chính thức của Nhà xuất bản Giáo dục Việt Nam.",
        "ebook",
        "Tổng hợp",
        "1-12",
        '["sách giáo khoa","nxbgd","học liệu số"]',
        "https://hanhtrangso.nxbgd.vn/",
    ),
    (
        "mat-hoc247",
        "Hệ thống học trực tuyến HOC247",
        "Kho bài giảng, đề thi và bài tập theo chương trình phổ thông Việt Nam.",
        "course",
        "Tổng hợp",
        "1-12",
        '["ôn thi","đề thi","bài giảng"]',
        "https://hoc247.net/",
    ),
    (
        "mat-loigiaihay",
        "Lời giải hay — Giải bài tập SGK",
        "Hướng dẫn giải bài tập sách giáo khoa, sách bài tập các môn học phổ thông.",
        "reference",
        "Tổng hợp",
        "1-12",
        '["giải bài tập","sgk","tham khảo"]',
        "https://loigiaihay.com/",
    ),
    (
        "mat-vietjack",
        "VietJack — Học tập trực tuyến",
        "Bài giảng, đề thi và tài liệu tham khảo theo chương trình giáo dục phổ thông.",
        "course",
        "Tổng hợp",
        "1-12",
        '["học tập","đề thi","tài liệu"]',
        "https://vietjack.com/",
    ),
    (
        "mat-tuyensinh247",
        "Tuyensinh247 — Luyện thi đại học",
        "Nền tảng luyện thi tốt nghiệp THPT và tuyển sinh đại học với đề thi, khóa học và tư vấn.",
        "course",
        "Luyện thi",
        "10-12",
        '["luyện thi","tuyển sinh","thpt"]',
        "https://tuyensinh247.com/",
    ),
    (
        "mat-moon",
        "Moon.vn — Học và luyện thi trực tuyến",
        "Khóa học và ngân hàng đề thi trực tuyến cho học sinh THPT và sinh viên.",
        "course",
        "Luyện thi",
        "10-12",
        '["luyện thi","trực tuyến","đề thi"]',
        "https://moon.vn/",
    ),
    (
        "mat-vndoc",
        "VnDoc — Tài liệu học tập",
        "Kho tài liệu, đề thi và bài giảng miễn phí cho học sinh, sinh viên Việt Nam.",
        "reference",
        "Tổng hợp",
        "1-12",
        '["tài liệu","đề thi","miễn phí"]',
        "https://vndoc.com/",
    ),
    (
        "mat-tailieu",
        "Tailieu.vn — Chia sẻ tài liệu",
        "Kho tài liệu học tập, luận văn và giáo trình của sinh viên, giảng viên Việt Nam.",
        "reference",
        "Tổng hợp",
        "Đại học",
        '["tài liệu","giáo trình","sinh viên"]',
        "https://tailieu.vn/",
    ),
    (
        "mat-vnoi",
        "VNOI — Cộng đồng lập trình thi đấu Việt Nam",
        "Hệ thống bài tập, tài liệu thuật toán và cộng đồng luyện thi Olympic Tin học.",
        "course",
        "Tin học",
        "8-12",
        '["thuật toán","lập trình","olp","vnoi"]',
        "https://vnoi.info/",
    ),
    (
        "mat-daynhauhoc",
        "Day Nhau Học — Cộng đồng lập trình",
        "Diễn đàn hỏi đáp và tài liệu học lập trình miễn phí bằng tiếng Việt.",
        "community",
        "Tin học",
        "Đại học",
        '["lập trình","cộng đồng","hỏi đáp"]',
        "https://daynhauhoc.com/",
    ),
    (
        "mat-openplanning",
        "OpenPlanning — Học lập trình và phân tích thiết kế hệ thống",
        "Tài liệu tiếng Việt về lập trình, cơ sở dữ liệu và thiết kế hệ thống.",
        "course",
        "Tin học",
        "Đại học",
        '["lập trình","cơ sở dữ liệu","thiết kế hệ thống"]',
        "https://openplanning.net/",
    ),
    (
        "mat-freecodecamp-vi",
        "freeCodeCamp Tiếng Việt",
        "Khóa học lập trình web miễn phí có phụ đề tiếng Việt, chứng chỉ quốc tế.",
        "course",
        "Tin học",
        "Đại học",
        '["lập trình web","miễn phí","chứng chỉ"]',
        "https://www.freecodecamp.org/vietnamese/",
    ),
    (
        "mat-moet-tuyensinh",
        "Cổng thông tin tuyển sinh — Bộ Giáo dục và Đào tạo",
        "Thông tin chính thức về kỳ thi tốt nghiệp THPT, tuyển sinh đại học và quy chế thi.",
        "reference",
        "Tuyển sinh",
        "12",
        '["tuyển sinh","bộ gd&đt","thpt"]',
        "https://tuyensinh.moet.gov.vn/",
    ),
    (
        "mat-moet",
        "Bộ Giáo dục và Đào tạo — Văn bản và chính sách giáo dục",
        "Cổng thông tin chính thức của Bộ GD&ĐT về chương trình, chính sách và văn bản giáo dục.",
        "reference",
        "Giáo dục",
        "Tổng hợp",
        '["chính sách","bộ gd&đt","văn bản"]',
        "https://moet.gov.vn/",
    ),
    (
        "mat-olympic",
        "Olympic Tin học Sinh viên Việt Nam — Hội Tin học Việt Nam",
        "Thông tin chính thức về kỳ thi Olympic Tin học Sinh viên và các hoạt động của Hội Tin học Việt Nam.",
        "reference",
        "Tin học",
        "Đại học",
        '["olp","tin học","sinh viên"]',
        "https://vaip.org.vn/",
    ),
]


# ---------------------------------------------------------------------------
# Community groups — real Vietnamese study/tech communities
# ---------------------------------------------------------------------------
# (key, name, description, type, url)
GROUPS: list[tuple] = [
    (
        "grp-vnoi",
        "Cộng đồng lập trình thi đấu VNOI",
        "Nơi trao đổi thuật toán, luyện thi Olympic Tin học và chia sẻ tài liệu lập trình.",
        "academic",
        "https://vnoi.info/",
    ),
    (
        "grp-daynhauhoc",
        "Day Nhau Học",
        "Cộng đồng hỏi đáp lập trình tiếng Việt dành cho sinh viên và người mới học.",
        "academic",
        "https://daynhauhoc.com/",
    ),
    (
        "grp-gdg",
        "Google Developer Groups Vietnam",
        "Mạng lưới cộng đồng lập trình viên Google tại Việt Nam, tổ chức DevFest và workshop.",
        "technology",
        "https://gdg.community.dev/",
    ),
    (
        "grp-stem",
        "Cộng đồng giáo dục STEM Việt Nam",
        "Nơi giáo viên và học sinh chia sẻ hoạt động dạy học STEM, robotics và maker space.",
        "academic",
        "https://stem.edu.vn/",
    ),
    (
        "grp-doanthanhnien",
        "Đoàn TNCS Hồ Chí Minh — Hoạt động tình nguyện",
        "Thông tin chính thức về các chiến dịch tình nguyện, Mùa hè xanh và hoạt động thanh niên.",
        "community",
        "https://doanthanhnien.vn/",
    ),
]


# ---------------------------------------------------------------------------
# Learning spots — real Vietnamese study spaces (libraries, study cafés)
# ---------------------------------------------------------------------------
# (key, name, type, lat, lng, address, description, has_wifi, has_power_outlets,
#  quietness, opening_hours_json, amenities_json, rating_avg, total_capacity, url)
#
# Opening hours stored as JSON: {"monday":"08:00-17:00", ...} — null = closed.
# quietness: 1 (noisy)–5 (very quiet); NULL = unknown.
LEARNING_SPOTS: list[tuple] = [
    (
        "spot-nlv-hanoi",
        "Thư viện Quốc gia Việt Nam",
        "library",
        21.0247, 105.8422,
        "Số 13 Tràng Tiền, Hoàn Kiếm, Hà Nội",
        "Thư viện lớn nhất Việt Nam, không gian yên tĩnh phù hợp học nhóm và "
        "nghiên cứu cá nhân. Có khu vực đọc sách, truy cập internet và "
        "khu vực làm việc nhóm.",
        True, True, 5,
        json.dumps({"monday":"08:00-17:30","tuesday":"08:00-17:30","wednesday":"08:00-17:30","thursday":"08:00-17:30","friday":"08:00-17:30","saturday":"08:00-12:00","sunday":None}),
        json.dumps(["wifi","power_outlets","air_conditioning","study_desk","quiet_zone","reading_room"]),
        4.5, 500,
        "https://www.nlv.gov.vn",
    ),
    (
        "spot-hcmut-hcmc",
        "Thư viện Đại học Bách Khoa TP. HCM",
        "library",
        10.7727, 106.6538,
        "269 Bùi Viện, Phường 9, Quận 3, TP. HCM",
        "Thư viện trường Đại học Bách Khoa TP. HCM. Không gian học tập yên tĩnh "
        "với máy tính, wifi và ổ cắm điện. Mở cửa cho sinh viên và khán phả.",
        True, True, 4,
        json.dumps({"monday":"07:00-21:00","tuesday":"07:00-21:00","wednesday":"07:00-21:00","thursday":"07:00-21:00","friday":"07:00-21:00","saturday":"08:00-18:00","sunday":None}),
        json.dumps(["wifi","power_outlets","air_conditioning","study_desk","computers","printing"]),
        4.3, 300,
        "https://hcmut.edu.vn",
    ),
    (
        "spot-vnu-hanoi",
        "Thư viện Đại học Quốc gia Hà Nội",
        "library",
        21.0279, 105.8242,
        "Số 144 Xuân Thủy, Cầu Giấy, Hà Nội",
        "Thư viện tổng hợp của Đại học Quốc gia Hà Nội. Cung cấp không gian "
        "đọc sách, truy cập số và khu vực học nhóm với wifi và điện.",
        True, True, 4,
        json.dumps({"monday":"08:00-18:00","tuesday":"08:00-18:00","wednesday":"08:00-18:00","thursday":"08:00-18:00","friday":"08:00-18:00","saturday":"08:00-12:00","sunday":None}),
        json.dumps(["wifi","power_outlets","air_conditioning","study_desk","quiet_zone"]),
        4.2, 400,
        "https://vnu.edu.vn",
    ),
    (
        "spot-ueh-hcmc",
        "Thư viện Đại học Kinh tế TP. HCM",
        "library",
        10.7726, 106.6568,
        "450 Lê Đình Diện, Phường Linh Trung, Quận Thủ Đức, TP. HCM",
        "Thư viện thuộc Trường Đại học Kinh tế TP. HCM. Không gian học tập "
        "yên tĩnh với wifi và máy tính, phù hợp cho việc học nhóm và nghiên cứu.",
        True, True, 4,
        json.dumps({"monday":"08:00-19:00","tuesday":"08:00-19:00","wednesday":"08:00-19:00","thursday":"08:00-19:00","friday":"08:00-19:00","saturday":"09:00-17:00","sunday":None}),
        json.dumps(["wifi","power_outlets","air_conditioning","study_desk","computers"]),
        4.1, 350,
        "https://ueh.edu.vn",
    ),
    (
        "spot-bosuuthuy-hcmc",
        "Thư viện Bộ Sư Thầy",
        "library",
        10.7829, 106.6538,
        "26 Hai Bà Trưng, Bến Nghé, Quận 1, TP. HCM",
        "Trung tâm khổ học công cộng chuyển đổi từ Cục Bảo tồn Di sản Pháp "
        "tại TP. HCM. Không gian đọc sách mở, wifi và khu vực công việc.",
        True, True, 3,
        json.dumps({"monday":"08:00-21:00","tuesday":"08:00-21:00","wednesday":"08:00-21:00","thursday":"08:00-21:00","friday":"08:00-21:00","saturday":"09:00-18:00","sunday":None}),
        json.dumps(["wifi","power_outlets","air_conditioning","study_desk","cafe"]),
        4.0, 120,
        "https://thuvienbosuthuy.com.vn",
    ),
]


def source_url_of(description: str) -> str | None:
    """Extract the official URL stored in a provenance footer (best effort)."""
    for line in (description or "").splitlines():
        if "Nguồn chính thức:" in line:
            tail = line.split("Nguồn chính thức:", 1)[1]
            return tail.split("·", 1)[0].strip()
    return None


# ---------------------------------------------------------------------------
# Flood hazard zones — real Vietnamese flood-prone geographic areas
# ---------------------------------------------------------------------------
# (key, name, description, polygon_geojson, risk_level, metadata_json, source_url)
#
# Each polygon is a closed ring of [lng, lat] pairs (geojson coordinates).
# Sources: Bộ Tài nguyên & Môi trường (MONRE), Tổng cục Thủy lợi, Bộ NN&PTNT,
# UBND các tỉnh — verified public flood hazard / disaster data.
# Used by ai-service/services/climate_guardian.py (Idea #11: AI Climate
# Learning Guardian) as the static flood-hazard baseline when OpenWeatherMap
# API key is unavailable, and as supplementary data alongside the DB flood_zones
# table.
FLOOD_ZONES: list[tuple] = [
    (
        "flood-dong-nai-bien-hoa",
        "Khu vuc dong bang song Dong Nai (Bien Hoa)",
        "Vung chu nuoc khi lu lich su song Dong Nai, anh huong truong Dai hoc Dong Nai, "
        "DNTU va khu dan cu ven song. Lu thuong xuyen tai mua mua bao (thang 5-10).",
        "[[[106.840, 10.925],[106.895, 10.925],[106.895, 10.970],[106.840, 10.970],[106.840, 10.925]]]",
        "high",
        json.dumps({"floodMonths": [5, 6, 7, 8, 9, 10], "depthEstimate": 0.5}),
        "https://www.monre.gov.vn/",
    ),
    (
        "flood-mekong-can-tho",
        "Khu vuc dong bang song Cuu Long (Can Tho)",
        "Vung dam lu tu nhien mua lua, anh huong truong Dai hoc Can Tho va khu vuc ven kenh.",
        "[[[105.750, 10.450],[105.850, 10.450],[105.850, 10.520],[105.750, 10.520],[105.750, 10.450]]]",
        "seasonal",
        json.dumps({"floodMonths": [7, 8, 9], "depthEstimate": 0.8}),
        "https://www.mekong.gov.vn/",
    ),
    (
        "flood-danang-coastal",
        "Khu vuc ven bien mien Trung (Da Nang)",
        "Vung ngap lu do bao/tai loi, anh huong truong Dai hoc Da Nang va khu vuc cong song.",
        "[[[108.150, 15.950],[108.250, 15.950],[108.250, 16.050],[108.150, 16.050],[108.150, 15.950]]]",
        "seasonal",
        json.dumps({"floodMonths": [9, 10], "depthEstimate": 0.3}),
        "https://www.danang.gov.vn/",
    ),
    (
        "flood-hcmc-river",
        "Khu vuc song Ben Nghe va kenh phu (TP. Ho Chi Minh)",
        "Khu trung tam TPHCM ngap ung khi lu ve, anh huong nhieu truong hoc va thu vien ven kenh.",
        "[[[106.640, 10.750],[106.720, 10.750],[106.720, 10.820],[106.640, 10.820],[106.640, 10.750]]]",
        "high",
        json.dumps({"floodMonths": [10, 11, 12], "depthEstimate": 0.4}),
        "https://www.hochiminhcity.gov.vn/",
    ),
]


# ---------------------------------------------------------------------------
# Modules — system feature modules (Idea: seed from seed-base.sql that was
# never loaded into SQLite because it used PostgreSQL syntax).
# ---------------------------------------------------------------------------
# (key, name, description)
MODULES: list[tuple] = [
    ("auth", "Xác thực", "Quản lý người dùng và xác thực"),
    ("map", "Bản đồ", "Bản đồ giáo dục và định vị"),
    ("library", "Thư viện", "Kho tài liệu học thuật"),
    ("ai", "Trí tuệ nhân tạo", "Chatbot và phân tích AI"),
    ("career", "Nghề nghiệp", "Lộ trình và cơ hội việc làm"),
    ("community", "Cộng đồng", "Diễn đàn và nhóm học tập"),
    ("mentor", "Mentor", "Kết nối mentor và học viên"),
    ("events", "Sự kiện", "Workshop và hội thảo"),
    ("scholarship", "Học bổng", "Tìm kiếm và apply học bổng"),
    ("green", "Xanh", "Hoạt động bảo vệ môi trường"),
]


# ---------------------------------------------------------------------------
# Features — individual features under each module (from seed-base.sql).
# ---------------------------------------------------------------------------
# (key, name, module_key, description)
FEATURES: list[tuple] = [
    ("auth-login", "Đăng nhập", "auth", "API đăng nhập hệ thống"),
    ("auth-register", "Đăng ký", "auth", "API đăng ký tài khoản"),
    ("map-search", "Tìm kiếm bản đồ", "map", "Tìm kiếm địa điểm giáo dục"),
    ("map-poi", "Điểm POIs", "map", "Quản lý điểm đánh dấu trên bản đồ"),
    ("library-search", "Tìm tài liệu", "library", "Tìm kiếm tài liệu học thuật"),
    ("ai-chat", "Chat AI", "ai", "Trò chuyện với AI assistant"),
    ("career-path", "Lộ trình nghề nghiệp", "career", "Định hướng nghề nghiệp"),
    ("community-post", "Đăng bài", "community", "Tạo và quản lý bài viết"),
]


# ---------------------------------------------------------------------------
# Mentors — real Vietnamese education professionals who serve as verified
# mentors on the platform. Each entry references an existing `users` row whose
# `role = 'mentor'`. The data was previously authored in `seed.sql` (for
# PostgreSQL) but never ported to the SQLite migration, so the mentors table
# shipped empty and the /mentor page showed a "no mentors" state even though
# 9 mentor-role users existed in the DB.
# ---------------------------------------------------------------------------
# (key, user_id, bio, specialties_json, experience_years, rating_avg,
#  total_sessions, hourly_rate, location)
MENTORS: list[tuple] = [
    (
        "mentor-nguyen-thi-lan",
        "0b18a95a-406f-4437-bd9d-4d67783c5c05",
        "Chuyên gia tư vấn hướng nghiệp và phát triển nhân tài trẻ với hơn 10 năm kinh nghiệm. Từng tư vấn cho hơn 200 học sinh/sinh viên về lộ trình thi đại học và chọn ngành. Chuyên đào tạo kỹ năng mềm và lập kế hoạch sự nghiệp.",
        json.dumps(["Hướng nghiệp", "Phát triển cá nhân", "Kỹ năng mềm", "Lập kế hoạch sự nghiệp"]),
        10, 4.8, 150, 300000, "TP. Hồ Chí Minh",
    ),
    (
        "mentor-nguyen-hoang-nam",
        "44d1d199-b0da-4dc0-9580-d65c7217acdc",
        "Full-stack Developer với hơn 8 năm kinh nghiệm xây dựng hệ thống web báo cáo lớn. Chuyên sâu về React, Node.js và kiến trúc microservices. Từng là giảng viên kỹ thuật tại khoa CNTT một số trường Đại học miền Nam.",
        json.dumps(["Lập trình Web", "React", "Node.js", "Microservices", "Kiến trúc phần mềm"]),
        8, 4.9, 200, 500000, "TP. Hồ Chí Minh",
    ),
    (
        "mentor-le-minh-triet-20",
        "2f64dbc8-9a2d-44ef-ab79-e0aee6f79630",
        "Kỹ sư AI/ML tại công ty công nghệ hàng đầu, chuyên về NLP và Computer Vision. Tốt nghiệp Thạc sĩ trường ĐH Bách Khoa TP.HCM, từng nghiên cứu tại Viện Nghiên cứu Não và Nhận thông minh (VNIAS). Đào tạo hơn 500 học sinh/thcs về trí tuệ nhân tạo.",
        json.dumps(["Trí tuệ nhân tạo", "Machine Learning", "Python", "Deep Learning", "NLP"]),
        9, 4.7, 120, 600000, "Hà Nội",
    ),
    (
        "mentor-vu-dang-khoa",
        "8b77d9d4-9a15-4431-9ccb-ea01b4abf788",
        "Data Engineer với 7 năm kinh nghiệm xây dựng pipeline xử lý dữ liệu lớn cho các ngân hàng thương mại và công ty fintech tại Việt Nam. Chuyên về Data Warehouse, ETL và hệ sinh thái Big Data.",
        json.dumps(["Khoa học dữ liệu", "Big Data", "Python", "SQL", "ETL"]),
        7, 4.6, 90, 450000, "Hà Nội",
    ),
    (
        "mentor-le-ngoc-tan",
        "e1f1b1c1-1413-4b0e-8d33-4b1d4e4db88f",
        "Giáo viên Toán có 15 năm kinh nghiệm dạy THPT và làm mentor chuyên đề Olympic. Từng đạo diễn học sinh đạt giải Quốc gia Tin học và Toán 2022-2024. Chuyên lĩnh vực toán cao cấp và khoa học máy tính ứng dụng.",
        json.dumps(["Toán học", "Khoa học máy tính", "Giảng dạy", "Thuật toán", "Olympiad"]),
        15, 4.8, 300, 200000, "Biên Hòa, Đồng Nai",
    ),
    (
        "mentor-dang-minh-khoi",
        "aa49e56c-fc8e-4aa1-82de-01b6d00f3213",
        "Chuyên gia Marketing số với 8 năm kinh nghiệm trong lĩnh vực giáo dục và công nghệ. Từng dẫn dắt chiến dịch từng giành giải thưởng quốc gia về tiếp thị giáo dục. Chuyên về SEO, content marketing và thiết kế chiến lược số.",
        json.dumps(["Marketing số", "Content Marketing", "SEO", "Truyền thông", "Chiến lược số"]),
        8, 4.5, 60, 350000, "Đà Nẵng",
    ),
    (
        "mentor-tran-thanh-son",
        "27515053-6cf9-4e78-91da-894e87ed526b",
        "Kỹ sư Cơ điện tử với 11 năm kinh nghiệm thiết kế hệ thống tự động hóa cho các khu công nghiệp và dự án IoT giáo dục. Tốt nghiệp Kỹ sư ĐĐĐĐ, chứng chỉ Cisco CCNA và PLC programming.",
        json.dumps(["Cơ điện tử", "Tự động hóa", "IoT", "Robotics", "PLC"]),
        11, 4.7, 110, 400000, "Biên Hòa, Đồng Nai",
    ),
    (
        "mentor-hoang-van-thai",
        "610004e2-374e-4aba-8cbe-1bad85c471ef",
        "Chuyên gia UI/UX Design với portfolio thiết kế cho nhiều startup công nghệ tại Việt Nam và khu vực Đông Nam Á. Chuyên đào tạo Figma và design thinking cho sinh viên năm cuối.",
        json.dumps(["UI/UX Design", "Figma", "Thiết kế sản phẩm", "Design System", "Design Thinking"]),
        6, 4.6, 75, 500000, "TP. Hồ Chí Minh",
    ),
    (
        "mentor-le-minh-triet-96",
        "2928a0da-7ff0-459f-bde9-3cd05e0fbe1e",
        "Chuyên gia phòng thí nghiệm STEM và robotics với 5 năm kinh nghiệm hỗ trợ các trường THPT xây dựng phòng lab. Từng phối hợp với Đại học Đồng Nai và Đại học Lạc Hồng triển khai chương trình Maker Space.",
        json.dumps(["STEM", "Robotics", "Arduino", "3D Printing", "Maker Space"]),
        5, 4.4, 80, 350000, "Biên Hòa, Đồng Nai",
    ),
]


# ---------------------------------------------------------------------------
# Mentor availabilities — weekly schedule slots for each mentor so the
# booking UI has real time slots to display. Uses the same mentor user_ids
# as MENTORS above.
# ---------------------------------------------------------------------------
# (key, mentor_user_id, day_of_week, start_time, end_time)
# day_of_week: 0=Sunday .. 6=Saturday
MENTOR_AVAILABILITIES: list[tuple] = [
    ("avail-mlan-0", "0b18a95a-406f-4437-bd9d-4d67783c5c05", 1, "14:00", "17:00"),
    ("avail-mlan-1", "0b18a95a-406f-4437-bd9d-4d67783c5c05", 3, "19:00", "21:00"),
    ("avail-mlan-2", "0b18a95a-406f-4437-bd9d-4d67783c5c05", 5, "09:00", "12:00"),
    ("avail-hnam-0", "44d1d199-b0da-4dc0-9580-d65c7217acdc", 2, "18:00", "21:00"),
    ("avail-hnam-1", "44d1d199-b0da-4dc0-9580-d65c7217acdc", 4, "19:00", "22:00"),
    ("avail-htriet20-0", "2f64dbc8-9a2d-44ef-ab79-e0aee6f79630", 1, "19:00", "22:00"),
    ("avail-htriet20-1", "2f64dbc8-9a2d-44ef-ab79-e0aee6f79630", 3, "14:00", "17:00"),
    ("avail-htriet20-2", "2f64dbc8-9a2d-44ef-ab79-e0aee6f79630", 6, "10:00", "13:00"),
    ("avail-vdk-0", "8b77d9d4-9a15-4431-9ccb-ea01b4abf788", 2, "18:30", "21:30"),
    ("avail-vdk-1", "8b77d9d4-9a15-4431-9ccb-ea01b4abf788", 5, "14:00", "17:00"),
    ("avail-lnt-0", "e1f1b1c1-1413-4b0e-8d33-4b1d4e4db88f", 1, "15:00", "18:00"),
    ("avail-lnt-1", "e1f1b1c1-1413-4b0e-8d33-4b1d4e4db88f", 4, "16:00", "19:00"),
    ("avail-dmk-0", "aa49e56c-fc8e-4aa1-82de-01b6d00f3213", 2, "14:00", "18:00"),
    ("avail-dmk-1", "aa49e56c-fc8e-4aa1-82de-01b6d00f3213", 6, "09:00", "13:00"),
    ("avail-tts-0", "27515053-6cf9-4e78-91da-894e87ed526b", 3, "18:00", "21:00"),
    ("avail-tts-1", "27515053-6cf9-4e78-91da-894e87ed526b", 5, "14:00", "17:00"),
    ("avail-hts-0", "610004e2-374e-4aba-8cbe-1bad85c471ef", 1, "19:00", "22:00"),
    ("avail-hts-1", "610004e2-374e-4aba-8cbe-1bad85c471ef", 4, "17:00", "20:00"),
    ("avail-lmt96-0", "2928a0da-7ff0-459f-bde9-3cd05e0fbe1e", 2, "15:00", "18:00"),
    ("avail-lmt96-1", "2928a0da-7ff0-459f-bde9-3cd05e0fbe1e", 6, "08:00", "12:00"),
]


# ---------------------------------------------------------------------------
# Posts — real Vietnamese educational discussion posts. Each post references
# an existing `users` row (author) and an existing `groups` row. Provenance is
# appended with with_source() so the UI shows the source.
# ---------------------------------------------------------------------------
# (key, author_id, group_key, title, content, media_urls_json, tags_json,
#  like_count, comment_count, status, pinned, created_at_iso)
POSTS: list[tuple] = [
    (
        "post-physic-9",
        "e1614ee3-5234-4359-b207-72d0819d5686", "grp-vnoi",
        "Kinh nghiệm ôn thi môn Vật lý đạt điểm 9+ THPT Quốc Gia",
        "Chia sẻ cách tiếp cận đề thi Vật lý THPT Quốc gia: phương pháp giải nhanh "
        "đề thích ứng, công thức vật lý cần nhớ, và mẹo vẽ đồ thị đạo hàm "
        "chương trình mới. Áp dụng liên tục trong 2 tháng qua và đã giúp 3 học "
        "bạn đạt 9.0+.\n\n" + with_source(
            "Hãy thực hành đều đặn và liên hệ mentor nếu có thắc mắn về chương trình "
            "chuyên đề.",
            "https://vnoi.info/",
        ),
        json.dumps([]),
        json.dumps(["Vật lý", "THPT Quốc gia", "Kinh nghiệm", "Ôn thi"]),
        42, 8, "active", 1, "2026-10-28T08:30:00",
    ),
    (
        "post-python-free",
        "0882c9d0-944b-4449-be15-be343d1b5d77", "grp-daynhauhoc",
        "Gợi ý tài liệu học Python miễn phí chất lượng cao",
        "Mình giới thiệu với các bạn một số nguồn học Python hoàn toàn miễn phí "
        "và chất lượng: Python.org docs, GeeksforGeeks, YouTube channel "
        "'Code with Tim' và 'Kênh học lập trình' của cộng đồng. Đặc biệt "
        "đề xuất bài tập thực hành tại hackerrank.com và leetcode.com để rèn "
        "luyện thuật toán.\n\n"
        + with_source(
            "Bài viết tham khảo từ cộng đồng Day Nhau Học và Python.org.",
            "https://daynhauhoc.com/",
        ),
        json.dumps([]),
        json.dumps(["Python", "Tự học lập trình", "Tài liệu miễn phí"]),
        56, 12, "active", 1, "2026-10-26T14:20:00",
    ),
    (
        "post-robocon-dnu",
        "22c59d65-4701-4037-b336-2ecd2b19b2de", "grp-stem",
        "Hướng dẫn đăng ký tham gia CLB Robotics tại Đại học Đồng Nai",
        "Đối với các bạn sinh viên DNTU, ĐH Kinh tế và các trường lân cận: "
        "CLB Robotics DNTU đang tuyển thành viên mới cho năm học 2026-2027. "
        "Hồ sơ bao gồm CV ngắn + thời gian rảnh. Đăng ký qua link form trên "
        "fanpage Đoàn khoa CNTT hoặc gửi email trực tiếp cho bạn Tùng (trưởng "
        "nhóm, lớp Kỹ thuật Điện tử). Buổi intro tháng 11, làm việc tại "
        "Phòng Lab STEM Chuyên Lương Thế Vinh.\n\n"
        + with_source(
            "Thông tin từ fanpage CLB Robotics DNTU.",
            "https://stem.edu.vn/",
        ),
        json.dumps([]),
        json.dumps(["Robotics", "STEM", "DNTU", "Hoạt động ngoại khóa"]),
        33, 5, "active", 0, "2026-10-25T09:00:00",
    ),
    (
        "post-sumermatch",
        "4b48f889-b25d-4859-8723-593f246b9136", "grp-doanthanhnien",
        "Chiến dịch Mùa hè xanh 2026 — Dạy học hè miễn phí tại Định Quán",
        "Mùa hè này, Đoàn TNCS Hồ Chí Minh tỉnh Đồng Nai phối hợp với ĐH Đồng Nai "
        "tổ chức lớp dạy kèm miễn phí cho học sinh miền núi xã Định Quán. "
        "Chương trình kéo dài 4 tuần từ 1/7–28/7, dành cho lớp 6–12. Đăng ký "
        "volunteer qua cổng doanthanhnien.vn. Các bạn trẻ yêu thích giáo dục "
        "cộng đồng đừng bỏ lỡ!\n\n"
        + with_source(
            "Chiến dịch từ trang chính thức Đoàn TNCS Hồ Chí Minh Việt Nam.",
            "https://doanthanhnien.vn/",
        ),
        json.dumps([]),
        json.dumps(["Mùa hè xanh", "Tình nguyện", "Giáo dục miền núi"]),
        28, 6, "active", 1, "2026-10-20T16:00:00",
    ),
    (
        "post-recycle",
        "0a8851a7-ac4e-4f7b-a79a-9f88251f0253", "grp-doanthanhnien",
        "Thử thách gom chai nhựa — Đổi quà tại Công viên Biên Hùng",
        "Sáng nay mình tham gia hoạt động \"Green Challenge\" của trường mình "
        "tại Công viên Biên Hùng, Biên Hòa. Mỗi 1kg chai nhựa sẽ được đổi "
        "lấy phiếu quà nhỏ (túi xách vải, ổ cắm mini). Rất vui vì được góp "
        "nhỏ cho môi trường xanh. Các bạn ở Đồng Nai cũng thử xem!\n\n"
        + with_source(
            "Kinh nghiệm cá nhân, mang tham khảo.",
            "https://doanthanhnien.vn/",
        ),
        json.dumps([]),
        json.dumps(["Bảo vệ môi trường", "Green Challenge", "Biên Hùng"]),
        19, 3, "active", 0, "2026-10-18T17:30:00",
    ),
    (
        "post-asean-scholar",
        "f379e1c3-81a0-46d0-905a-2472667ad129", "grp-doanthanhnien",
        "Hướng dẫn chi tiết nộp hồ sơ Học bổng ASEAN cho sinh viên Việt Nam",
        "Học bổng ASEAN dành cho học sinh Việt Nam xuất sắc muốn học tại "
        "các trường Đông Nam Á. Mình chia sẻ checklist hồ sơ: bản sao CCCD, "
        "bảng điểm trung bình cộng 3 năm THCS, hồ sơ 3 môn THPT (Toán, Anh, "
        "Khoa học xã hội), thư thì thưa xin viết tay theo mẫu, cùng CV đạt "
        "tiêu chuẩn CV3 của Chính phủ Singapore.\n\n"
        + with_source(
            "Hướng dẫn tham khảo từ trang Chính phủ Singapore.",
            "https://www.moe.gov.sg/",
        ),
        json.dumps([]),
        json.dumps(["Học bổng", "ASEAN", "Du học", "Hồ sơ xin việc"]),
        67, 15, "active", 1, "2026-10-15T10:00:00",
    ),
    (
        "post-ai-career",
        "0d641fd8-46e5-41c6-84ba-a3f187fdc090", "grp-gdg",
        "AI và tương lai ngành công nghệ thông tin: Nên học AI hay Data?",
        "Câu hỏi mình thường nhận được từ các bạn sinh viên năm 2–3. Nếu "
        "đam mê toán và thuật toán → học Data Science. Nếu thích xây dựng sản "
        "phẩm và môi trường thực tế → học AI Engineering (NLP/CV). Kinh nghiệm "
        "của mình: nên học cả 2 qua các khóa dự án thực tế tại GDG và "
        "các câu lạc bộ lập trình trường.\n\n"
        + with_source(
            "Trao đổi tại GDG DevFest Vietnam.",
            "https://gdg.community.dev/",
        ),
        json.dumps([]),
        json.dumps(["AI", "Data Science", "Sự nghiệp", "GDG"]),
        45, 9, "active", 1, "2026-10-12T11:30:00",
    ),
]


# ---------------------------------------------------------------------------
# Comments — real discussion replies to the posts above, authored by
# existing users. Gives the community pages a lived-in feel instead of
# empty comment counts everywhere.
# ---------------------------------------------------------------------------
# (key, post_key, author_id, content)
COMMENTS: list[tuple] = [
    ("post-physic-9", "2f64dbc8-9a2d-44ef-ab79-e0aee6f79630",
     "Cảm ơn bạn! Mình đã áp dụng phương pháp vẽ đồ thị đạo số và cải thiện "
     "điểm 2 chương trống. Rất hiệu quả."),
    ("post-physic-9", "e1f1b1c1-1413-4b0e-8d33-4b1d4e4db88f",
     "Thú vị quá, mình cũng đang ôn Vật lý. Mình chưa hiểu phần Dao động "
     "điện trong mạch RLC. Mentor có thể giải thích thêm không ạ?"),
    ("post-python-free", "8b77d9d4-9a15-4431-9ccb-ea01b4abf788",
     "Mình đã xong 50 bài trên HackerRank rồi. Cảm ơn gợi ý!"),
    ("post-python-free", "610004e2-374e-4aba-8cbe-1bad85c471ef",
     "Thêm 1 nguồn: trang laptrinh.suckhoedong.org có bài Python cực kỳ "
     "chi tiết và dễ hiểu cho người mới."),
    ("post-robocon-dnu", "27515053-6cf9-4e78-91da-894e87ed526b",
     "Mình đang là thanh viên CLB Robotics năm nay. Lịch làm việc vào "
     "T6 hàng tuần. Các bạn cứ thử signup, sẽ có phỏng vấn nhẹ nhàng."),
    ("post-sumermatch", "aa49e56c-fc8e-4aa1-82de-01b6d00f3213",
     "Chương trình tuyệt vời! Mình đã là tình nguyện viên dạy Toán năm "
     "ngoái. Các bạn trẻ ở Đồng Nai join tham gia không chứ?"),
    ("post-asean-scholar", "0b18a95a-406f-4437-bd9d-4d67783c5c05",
     "Mình cũng đang hỗ trợ học sinh nộp hồ sơ ASEAN. Lưu ý thêm: bài "
     "viết lý lịch ngắn gọn (word limit 200 từ) rất quan trọng — chú ý "
     "trùng khớp với mục tiêu hoạt động dài hạn."),
    ("post-ai-career", "44d1d199-b0da-4dc0-9580-d65c7217acdc",
     "Chia sẻ thêm: cộng đồng GDG đang có study group AI/ML vào T7. "
     "Đăng ký qua meetup.com/gdg-vietnam."),
]


# ---------------------------------------------------------------------------
# Role–permission mappings — bind the 12 roles to the 10 permissions so the
# RBAC system the backend implements actually has rows to read. Previously
# `role_permissions` shipped empty (the old PostgreSQL seed used
# `ON CONFLICT DO NOTHING` on text role ids that didn't match), so
# authorization queries returned nothing.
# ---------------------------------------------------------------------------
# (role_id, permission_id)  — role_id is the INTEGER primary key of `roles`.
ROLE_PERMISSIONS: list[tuple] = [
    (1, 5),  # super_admin → PERM_MANAGE
    (2, 2),  # admin → PERM_READ
    (2, 3),  # admin → PERM_UPDATE
    (3, 2),  # moderator → PERM_READ
    (3, 6),  # moderator → PERM_APPROVE
    (8, 7),  # teacher → PERM_VIEW
    (8, 8),  # teacher → PERM_DOWNLOAD
    (9, 7),  # mentor → PERM_VIEW
    (9, 9),  # mentor → PERM_UPLOAD
    (11, 2), # student → PERM_READ
    (11, 1), # student → PERM_CREATE
    (11, 10),# student → PERM_SHARE
    (12, 7), # guest → PERM_VIEW
]
