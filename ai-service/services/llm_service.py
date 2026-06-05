import os
import json
import google.generativeai as genai
from models.career_models import CareerAnalysisRequest # Updated import
from models.chat_models import ChatRequest
from models.learning_models import LearningPathRequest
from models.library_models import MaterialSummaryRequest # New import

class LLMService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY", "mock-key-for-dev")
        if self.api_key and self.api_key != "mock-key-for-dev":
            genai.configure(api_key=self.api_key)
            model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
            self.model = genai.GenerativeModel(model_name)
        else:
            self.model = None

    async def recommend_career(self, data: CareerAnalysisRequest) -> list:
        prompt = f'''
        Bạn là một chuyên gia tư vấn nghề nghiệp cao cấp của EduMap.
        Hãy phân tích hồ sơ người dùng sau và đề xuất 3 nghề nghiệp phù hợp nhất.

        Hồ sơ người dùng:
        - Họ tên: {data.full_name or "N/A"}
        - MBTI: {data.mbti_type or "Chưa xác định"}
        - Kỹ năng hiện có: {", ".join(data.skills) if data.skills else "Chưa cập nhật"}
        - Nguyện vọng nghề nghiệp: {", ".join(data.career_aspirations) if data.career_aspirations else "Chưa xác định"}
        - Từ khóa tìm kiếm gần đây: {data.recent_keywords or "N/A"}
        - Kết quả Holland: {data.holland_code or "N/A"}

        BẮT BUỘC trả về kết quả dưới dạng một MẢNG JSON, mỗi phần tử có cấu trúc:
        {{
            "title": "Tên nghề nghiệp",
            "match_score": 85,
            "explanation": "Lý do đề xuất ngắn gọn",
            "missing_skills": ["Kỹ năng 1", "Kỹ năng 2"]
        }}
        Chỉ trả về JSON, không kèm theo văn bản giải thích nào khác.
        '''

        try:
            if self.model:
                response = self.model.generate_content(prompt)
                text = response.text
                
                # Robust JSON extraction: look for [ and ] and strip markdown artifacts
                json_str = text.strip()
                if json_str.startswith("```json"):
                    json_str = json_str[7:]
                if json_str.endswith("```"):
                    json_str = json_str[:-3]
                
                json_start = json_str.find('[')
                json_end = json_str.rfind(']') + 1
                
                if json_start != -1 and json_end > json_start:
                    final_json = json_str[json_start:json_end]
                    return json.loads(final_json)
                
                print(f"Error: Could not find valid JSON array in AI response: {text}")
                return []
            else:
                # Mocking for simplicity in development
                return [{"title": "Backend Developer", "match_score": 90, "explanation": "Dựa trên kỹ năng phân tích và logic của bạn.", "missing_skills": ["NestJS", "Docker"]}]
        except Exception as e:
            print(f"Error in recommend_career (LLM): {str(e)}")
            return []

    async def analyze_geo_density(self, data: any) -> dict:
        points_str = "\n".join([f"- {p.name} ({p.type}) at {p.lat}, {p.lng}" for p in data.points])

        prompt = f'''
        Bạn là chuyên gia phân tích dữ liệu không gian và quy hoạch giáo dục.
        Hãy phân tích dữ liệu các cơ sở giáo dục tại thành phố {data.city} sau đây:

        {points_str}

        Nhiệm vụ:
        1. Đánh giá mật độ phân bổ các cơ sở giáo dục.
        2. Phát hiện các khu vực còn thiếu hụt (ví dụ: thiếu thư viện, thiếu trường học).
        3. Đề xuất 3 vị trí hoặc khu vực cụ thể cần ưu tiên đầu tư phát triển giáo dục.

        BẮT BUỘC trả về kết quả dưới dạng JSON với cấu trúc:
        {{
            "summary": "Tóm tắt phân tích",
            "density_score": 8.5,
            "gaps": ["Vấn đề 1", "Vấn đề 2"],
            "recommendations": [
                {{"area": "Tên khu vực", "reason": "Lý do", "priority": "High/Medium/Low"}}
            ]
        }}
        Chỉ trả về JSON, không kèm văn bản giải thích.
        '''

        try:
            if self.model:
                response = self.model.generate_content(prompt)
                text = response.text

                # Extract JSON
                json_start = text.find('{{') if text.find('{{') != -1 else text.find('{')
                json_end = text.rfind('}}') + 2 if text.rfind('}}') != -1 else text.rfind('}') + 1
                if json_start != -1 and json_end > json_start:
                    return json.loads(text[json_start:json_end])

                return {{"summary": "Lỗi phân tích JSON", "density_score": 0}}
            else:
                return {{
                    "summary": "Chế độ Mock: Mật độ giáo dục tại thành phố này khá đồng đều.",
                    "density_score": 7.0,
                    "gaps": ["Thiếu hụt trung tâm nghiên cứu tại phía Nam"],
                    "recommendations": [{{"area": "Quận 7", "reason": "Mật độ cư dân cao nhưng ít thư viện cộng đồng", "priority": "High"}}]
                }}
        except Exception as e:
            print(f"Error in analyze_geo_density (LLM): {str(e)}")
            return {"summary": "Lỗi xử lý AI", "error": str(e)}

    async def summarize_material(self, data: MaterialSummaryRequest) -> dict:
        prompt = f'''
        Bạn là một trợ lý AI thông minh chuyên tóm tắt tài liệu học tập của EduMap.
        Dưới đây là thông tin về một tài liệu học tập:
        - Tiêu đề: {data.title}
        - Mô tả: {data.description or "Không có"}
        - Thể loại: {data.category or "Không xác định"}
        - Tags: {", ".join(data.tags) if data.tags else "Không có"}
        - Định dạng: {data.type or "Không xác định"}

        Nhiệm vụ của bạn:
        Dựa vào các thông tin trên (metadata), hãy dự đoán và suy luận nội dung chính của tài liệu này. 
        Sau đó, BẮT BUỘC trả về kết quả dưới dạng một OBJECT JSON có cấu trúc như sau:
        {{
            "summary": "Một đoạn tóm tắt ngắn gọn, lôi cuốn về giá trị của tài liệu này mang lại (khoảng 3-4 câu).",
            "key_concepts": [
                {{"concept": "Tên khái niệm 1", "explanation": "Giải thích ngắn gọn khái niệm 1"}},
                {{"concept": "Tên khái niệm 2", "explanation": "Giải thích ngắn gọn khái niệm 2"}},
                {{"concept": "Tên khái niệm 3", "explanation": "Giải thích ngắn gọn khái niệm 3"}}
            ],
            "study_tips": [
                "Mẹo học tập 1 (ví dụ: 'Nên thực hành code ngay sau khi đọc phần này')",
                "Mẹo học tập 2",
                "Mẹo học tập 3"
            ]
        }}
        Lưu ý quan trọng: Chỉ trả về đoạn text chứa mã JSON hợp lệ, KHÔNG bao bọc bởi markdown (```json ... ```) và KHÔNG kèm theo lời giải thích nào khác.
        '''

        try:
            if self.model:
                response = self.model.generate_content(prompt)
                text = response.text

                # Robust JSON extraction
                json_str = text.strip()
                if json_str.startswith("```json"):
                    json_str = json_str[7:]
                if json_str.endswith("```"):
                    json_str = json_str[:-3]

                json_start = json_str.find('{{') if json_str.find('{{') != -1 else json_str.find('{')
                json_end = json_str.rfind('}}') + 2 if json_str.rfind('}}') != -1 else json_str.rfind('}') + 1

                if json_start != -1 and json_end > json_start:
                    final_json = json_str[json_start:json_end]
                    return json.loads(final_json)

                print(f"Error: Could not find valid JSON object in AI response: {text}")
                return {"summary": "Lỗi phân tích JSON", "key_concepts": [], "study_tips": []}
            else:
                # Mocking for simplicity
                return {
                    "summary": "Đây là dữ liệu giả lập (Mock). Tài liệu này cung cấp kiến thức nền tảng vững chắc.",
                    "key_concepts": [
                        {"concept": "Khái niệm Mock 1", "explanation": "Giải thích mock 1"}
                    ],
                    "study_tips": ["Thực hành mock"]
                }
        except Exception as e:
            print(f"Error in summarize_material (LLM): {str(e)}")
            return {"summary": "Lỗi xử lý AI", "key_concepts": [], "study_tips": []}

    async def match_mentors(self, data: MatchRequest) -> list:
        mentors_str = "\n".join([f"- Mentor ID: {m.mentor_id}, Tên: {m.name}, Kỹ năng: {', '.join(m.skills)}, MBTI: {m.mbti}, Lịch rảnh: {', '.join(m.available_days)}" for m in data.available_mentors])

        prompt = f'''
        Bạn là một chuyên gia ghép nối (Matchmaker) cho chương trình Mentor của EduMap.
        Dưới đây là thông tin của một Học viên (Mentee) và danh sách các Cố vấn (Mentors) khả dụng.

        Học viên:
        - Kỹ năng cần học: {", ".join(data.student_skills_needed) if data.student_skills_needed else "Chưa xác định"}
        - MBTI: {data.student_mbti or "Chưa xác định"}
        - Ngày rảnh: {", ".join(data.preferred_days) if data.preferred_days else "Chưa xác định"}

        Danh sách Mentor khả dụng:
        {mentors_str}

        Nhiệm vụ:
        Hãy đánh giá mức độ phù hợp giữa Học viên và từng Mentor dựa trên: sự trùng khớp kỹ năng, sự bổ trợ về tính cách (MBTI) và sự phù hợp về thời gian.
        Chọn ra tối đa 3 Mentor phù hợp nhất.

        BẮT BUỘC trả về kết quả dưới dạng một MẢNG JSON, mỗi phần tử có cấu trúc:
        {{
            "mentor_id": "ID của mentor",
            "name": "Tên của mentor",
            "match_score": 85.5,
            "match_reasons": [
                "Lý do 1 (ví dụ: Trùng khớp kỹ năng React)",
                "Lý do 2 (ví dụ: MBTI bổ trợ tốt)"
            ]
        }}
        Chỉ trả về đoạn text chứa mã JSON hợp lệ, KHÔNG bao bọc bởi markdown (```json ... ```) và KHÔNG kèm theo văn bản nào khác.
        '''

        try:
            if self.model:
                response = self.model.generate_content(prompt)
                text = response.text
                
                json_str = text.strip()
                if json_str.startswith("```json"):
                    json_str = json_str[7:]
                if json_str.endswith("```"):
                    json_str = json_str[:-3]
                
                json_start = json_str.find('[')
                json_end = json_str.rfind(']') + 1
                
                if json_start != -1 and json_end > json_start:
                    final_json = json_str[json_start:json_end]
                    return json.loads(final_json)
                
                print(f"Error: Could not find valid JSON array in AI response: {text}")
                return []
            else:
                return [{
                    "mentor_id": data.available_mentors[0].mentor_id if data.available_mentors else "mock_id",
                    "name": data.available_mentors[0].name if data.available_mentors else "Mock Mentor",
                    "match_score": 95.0,
                    "match_reasons": ["Mock reason: Perfect skill match"]
                }]
        except Exception as e:
            print(f"Error in match_mentors (LLM): {str(e)}")
            return []

    async def chat_with_rag(self, request: ChatRequest, context_docs: list) -> str:
...
        return "Xin lỗi, hiện tại mình đang chạy ở chế độ Mock Data."

    async def moderate_text(self, text: str) -> dict:
        """
        Sử dụng Gemini để kiểm duyệt nội dung văn bản.
        """
        prompt = f'''
        Bạn là một hệ thống kiểm duyệt nội dung tự động cho nền tảng giáo dục EduMap.
        Hãy phân tích đoạn văn bản sau và xác định xem nó có an toàn để hiển thị công khai không.
        Các nội dung KHÔNG an toàn bao gồm: chửi thề, ngôn từ kích động thù địch, bạo lực, quấy rối, spam, quảng cáo rác.

        Văn bản cần phân tích:
        "{text}"

        BẮT BUỘC trả về kết quả dưới dạng MỘT OBJECT JSON duy nhất theo cấu trúc:
        {{
            "is_safe": true/false,
            "confidence": 0.95, (Điểm tin cậy từ 0.0 đến 1.0)
            "flags": ["Lý do 1", "Lý do 2"] (Nếu an toàn thì để mảng rỗng [])
        }}
        Chỉ trả về JSON, không giải thích thêm.
        '''

        try:
            if self.model:
                response = self.model.generate_content(prompt)
                res_text = response.text
                
                json_str = res_text.strip()
                if json_str.startswith("```json"):
                    json_str = json_str[7:]
                if json_str.endswith("```"):
                    json_str = json_str[:-3]
                
                json_start = json_str.find('{')
                json_end = json_str.rfind('}') + 1
                
                if json_start != -1 and json_end > json_start:
                    final_json = json_str[json_start:json_end]
                    return json.loads(final_json)
                
                print(f"Error: Could not parse Moderation JSON: {res_text}")
                return {"is_safe": False, "confidence": 0.0, "flags": ["AI Parse Error"]}
            else:
                # Mock fallback
                is_toxic = "ngu" in text.lower() or "chết" in text.lower()
                return {
                    "is_safe": not is_toxic,
                    "confidence": 0.9,
                    "flags": ["Toxic"] if is_toxic else []
                }
        except Exception as e:
            print(f"Error in moderate_text (LLM): {str(e)}")
            # Fail-safe: Nếu AI chết, đánh dấu là không an toàn để chờ người duyệt (Pending Review)
            return {"is_safe": False, "confidence": 0.0, "flags": ["AI Timeout/Error"]}

    async def generate_learning_path(self, data: LearningPathRequest) -> dict:
        prompt = f'''
        Bạn là chuyên gia thiết kế lộ trình học tập EduMap.
        Hãy tạo một lộ trình học tập để đạt được mục tiêu: {data.target_role}.
        Trình độ hiện tại: {data.current_level}.
        Thời gian học: {data.time_commitment_hours_per_week} giờ/tuần.

        BẮT BUỘC trả về MỘT OBJECT JSON duy nhất theo cấu trúc:
        {{
            "target_role": "{data.target_role}",
            "total_estimated_months": 6.5,
            "steps": [
                {{"step_number": 1, "title": "Tên kỹ năng", "estimated_weeks": 4, "description": "Mô tả ngắn"}}
            ]
        }}
        '''

        try:
            if self.model:
                response = self.model.generate_content(prompt)
                json_str = response.text.replace('```json', '').replace('```', '').strip()
                return json.loads(json_str)
            else:
                return {
                    "target_role": data.target_role,
                    "total_estimated_months": 6.0,
                    "steps": [
                        {"step_number": 1, "title": "Cơ sở Dữ liệu SQL", "estimated_weeks": 4, "description": "Học cách thiết kế bảng và viết truy vấn."},
                        {"step_number": 2, "title": "Lập trình API (FastAPI)", "estimated_weeks": 6, "description": "Xây dựng backend cho ứng dụng."}
                    ]
                }
        except Exception as e:
            print("Lỗi khi tạo lộ trình:", e)
            return {}
