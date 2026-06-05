import sys
import os

# Thêm đường dẫn để import được app.services
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.vector_store_service import vector_store_service

def seed_data():
    documents = [
        "Trường Đại học Công nghệ Đồng Nai (DNTU) tọa lạc tại đường Nguyễn Khuyến, phường Trảng Dài, thành phố Biên Hòa, tỉnh Đồng Nai.",
        "EduMap là nền tảng bản đồ giáo dục thông minh giúp sinh viên tìm kiếm học liệu, mentor và lộ trình nghề nghiệp.",
        "DNTU có các khoa trọng điểm như Công nghệ thông tin, Kỹ thuật ô tô, Điều dưỡng và Kinh tế.",
        "Thư viện DNTU cung cấp hàng ngàn đầu sách về lập trình NestJS, React, AI và các kỹ năng mềm.",
        "Sinh viên có thể tham gia các thử thách Sống Xanh trên EduMap để tích lũy điểm thưởng và bảo vệ môi trường.",
        "Hệ thống Mentor của EduMap kết nối sinh viên với các chuyên gia từ doanh nghiệp tại KCN Amata và Long Bình.",
        "Các điểm Wifi miễn phí tại thành phố Biên Hòa bao gồm: Công viên Biên Hùng, Công viên Dương Tử Giang và các trạm xe buýt trung tâm.",
        "DNTU có phòng Lab STEM hiện đại dành cho sinh viên nghiên cứu Robotics và AI."
    ]
    
    metadatas = [{"source": "official_info"} for _ in range(len(documents))]
    ids = [f"doc_{i}" for i in range(len(documents))]
    
    print(f"Đang indexing {len(documents)} tài liệu vào ChromaDB...")
    vector_store_service.add_documents(documents, metadatas, ids)
    print("Hoàn tất seeding AI Vector Database!")

if __name__ == "__main__":
    seed_data()
