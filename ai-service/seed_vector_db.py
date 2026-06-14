import sys
import os

from services.vector_store import vector_store

def seed_data():
    knowledge_base = [
        {
            "id": "info_dntu_location",
            "doc": "Trường Đại học Công nghệ Đồng Nai (DNTU) tọa lạc tại đường Nguyễn Khuyến, phường Trảng Dài, thành phố Biên Hòa, tỉnh Đồng Nai. Đây là trung tâm giáo dục hiện đại với diện tích rộng lớn và cơ sở vật chất tiên tiến.",
            "metadata": {"title": "Vị trí DNTU", "category": "general"}
        },
        {
            "id": "info_edumap_purpose",
            "doc": "EduMap là nền tảng bản đồ giáo dục thông minh (Smart Education Map) được thiết kế riêng cho sinh viên DNTU. Mục tiêu của EduMap là giúp sinh viên dễ dàng định vị các tài nguyên giáo dục, kết nối với mentor và nhận tư vấn sự nghiệp dựa trên AI.",
            "metadata": {"title": "Giới thiệu EduMap", "category": "general"}
        },
        {
            "id": "scholarship_talent_2026",
            "doc": "Học bổng EduMap Talent 2026 dành cho sinh viên có thành tích học tập xuất sắc (GPA > 3.6) hoặc đạt giải cao trong các kỳ thi Hackathon. Giá trị học bổng lên đến 50.000.000 VNĐ và cơ hội thực tập tại các tập đoàn công nghệ đối tác.",
            "metadata": {"title": "Học bổng Talent 2026", "category": "scholarship"}
        },
        {
            "id": "stem_lab_rules",
            "doc": "Phòng STEM Lab tại DNTU mở cửa cho sinh viên từ thứ 2 đến thứ 7 hàng tuần (8:00 - 17:00). Sinh viên cần đăng ký trước thông qua EduMap để sử dụng các thiết bị Robotics, in 3D và máy tính cấu hình cao cho nghiên cứu AI.",
            "metadata": {"title": "Quy định STEM Lab", "category": "facility"}
        },
        {
            "id": "career_path_it",
            "doc": "Lộ trình sự nghiệp cho sinh viên CNTT tại DNTU bao gồm các giai đoạn: Học căn bản (Năm 1-2), Thực tập dự án (Năm 3), và Chuyên sâu Web/AI/Mobile (Năm 4). EduMap cung cấp các khóa học bổ trợ và kết nối doanh nghiệp để hỗ trợ lộ trình này.",
            "metadata": {"title": "Lộ trình CNTT", "category": "career"}
        },
        {
            "id": "green_living_rewards",
            "doc": "Tính năng Sống Xanh (Green Living) trên EduMap cho phép sinh viên báo cáo các hành động bảo vệ môi trường như sử dụng xe đạp, tiết kiệm điện tại ký túc xá. Mỗi hành động được cộng điểm 'Eco-Point' dùng để đổi quà tại canteen trường.",
            "metadata": {"title": "Tính năng Sống Xanh", "category": "gamification"}
        },
        {
            "id": "wifi_locations_bienhoa",
            "doc": "Các điểm truy cập Wifi miễn phí do EduMap ghi nhận tại Biên Hòa bao gồm: Công viên Biên Hùng, Quảng trường tỉnh Đồng Nai và toàn bộ khuôn viên Đại học Công nghệ Đồng Nai.",
            "metadata": {"title": "Wifi miễn phí", "category": "facility"}
        }
    ]
    
    documents = [item["doc"] for item in knowledge_base]
    metadatas = [item["metadata"] for item in knowledge_base]
    ids = [item["id"] for item in knowledge_base]
    
    print(f"Đang indexing {len(documents)} tài liệu vào ChromaDB (Vector Store)...")
    try:
        vector_store.add_documents(documents, metadatas, ids)
        print("Hoàn tất seeding AI Vector Database thành công!")
    except Exception as e:
        print(f"Lỗi khi seeding dữ liệu: {e}")

if __name__ == "__main__":
    seed_data()
