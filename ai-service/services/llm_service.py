import os
import json
import google.generativeai as genai
from models.career_models import CareerQuizRequest
from models.chat_models import ChatRequest
from models.learning_models import LearningPathRequest

class LLMService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY", "mock-key-for-dev")
        if self.api_key != "mock-key-for-dev":
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel('gemini-pro')
        else:
            self.model = None

    async def recommend_career(self, data: CareerQuizRequest) -> list:
        # Mocking for simplicity in development
        return [{"title": "Backend Developer", "match_score": 90, "explanation": "Mock Data", "missing_skills": ["NestJS"]}]

    async def chat_with_rag(self, request: ChatRequest, context_docs: list) -> str:
        # Mocking for simplicity
        return "Xin lỗi, hiện tại mình đang chạy ở chế độ Mock Data."

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
