import os
import json
import google.generativeai as genai
from dotenv import load_dotenv
from models.career_models import CareerAnalysisRequest
from models.chat_models import ChatRequest, ChatResponse, ChatMessage
from models.learning_models import LearningPathRequest
from models.library_models import MaterialSummaryRequest
from models.mentor_models import MatchRequest
from models.geo_models import GeoDensityAnalysisRequest

load_dotenv()

class LLMService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY", "mock-key-for-dev")
        if self.api_key and self.api_key != "mock-key-for-dev" and not self.api_key.startswith("AIzaSy_placeholder"):
            genai.configure(api_key=self.api_key)
            model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
            self.model = genai.GenerativeModel(model_name)
            self.is_ready = True
        else:
            self.model = None
            self.is_ready = False
            print("WARNING: GEMINI_API_KEY not set correctly. AI Service running in Mock mode.")

    # --- Methods from Legacy LLMService ---

    async def chat_response(self, message: str, history: list = None, context: dict = None):
        if not self.is_ready:
            return "Trợ lý ảo đang bận, bạn vui lòng quay lại sau."

        context = context or {}
        history = history or []

        # RAG Logic
        from services.vector_store import vector_store
        try:
            search_results = vector_store.query(message, n_results=3)
            context_docs = search_results.get('documents', [[]])[0]
        except Exception:
            context_docs = []
        
        docs_str = "\n".join([f"- {doc}" for doc in context_docs]) if context_docs else "Không tìm thấy tài liệu liên quan."

        system_instruction = f"Bạn là Trợ lý ảo thông minh của EduMap DNTU. Context: {docs_str}"
        history_str = ""
        for msg in history[-6:]:
            role = "Sinh viên" if msg.get("role") == "user" else "Trợ lý"
            history_str += f"{role}: {msg.get('content')}\n"

        prompt = f"{system_instruction}\n\nLịch sử:\n{history_str}\nSinh viên: {message}\nTrợ lý EduMap:"
        
        try:
            response = self.model.generate_content(prompt)
            return response.text if response and response.text else "Xin lỗi, mình không tìm thấy câu trả lời."
        except Exception as e:
            print(f"Lỗi chat_response: {e}")
            return "Hệ thống AI đang gặp sự cố nhỏ."

    async def generate_career_advice(self, user_info: dict):
        if not self.is_ready: return "Dịch vụ bảo trì."
        prompt = f"Tư vấn lộ trình học tập dựa trên kỹ năng: {user_info.get('skills')}"
        try:
            response = self.model.generate_content(prompt)
            return response.text
        except:
            return "AI đang bận, hãy thử lại."

    async def analyze_market_trends(self, market_data: list):
        if not self.is_ready: return {"status": "offline"}
        return {"status": "online", "analysis": "Xu hướng tuyển dụng tại KCN Amata đang rất tốt."}

    async def generate_daily_insight(self, dashboard_data: dict) -> dict:
        if not self.is_ready:
            return {"insight": "Hãy tiếp tục cố gắng học tập mỗi ngày!"}
        
        prompt = f"Dựa trên dữ liệu dashboard: {json.dumps(dashboard_data)}, hãy đưa ra 1 lời khuyên ngắn gọn."
        try:
            response = self.model.generate_content(prompt)
            return {"insight": response.text}
        except:
            return {"insight": "Hôm nay là một ngày tuyệt vời để học kỹ năng mới."}

    # --- Methods from New LLMService ---

    async def recommend_career(self, data: CareerAnalysisRequest) -> list:
        if not self.is_ready:
            return [{"title": "Backend Developer", "match_score": 90, "explanation": "Mock explanation", "missing_skills": ["NestJS"]}]
        
        prompt = f"Phân tích hồ sơ và đề xuất 3 nghề nghiệp: {data.json()}. Trả về mảng JSON."
        try:
            response = self.model.generate_content(prompt)
            text = response.text
            json_start = text.find('[')
            json_end = text.rfind(']') + 1
            if json_start != -1:
                return json.loads(text[json_start:json_end])
            return []
        except Exception as e:
            print(f"Error in recommend_career: {e}")
            return []

    async def analyze_geo_density(self, data: GeoDensityAnalysisRequest) -> dict:
        if not self.is_ready:
            return {"summary": "Mock geo analysis", "density_score": 7.0}
        
        prompt = f"Phân tích mật độ giáo dục tại {data.city}. Points: {data.points}. Trả về JSON."
        try:
            response = self.model.generate_content(prompt)
            text = response.text
            json_start = text.find('{')
            json_end = text.rfind('}') + 1
            if json_start != -1:
                return json.loads(text[json_start:json_end])
            return {"summary": "Lỗi phân tích"}
        except Exception as e:
            print(f"Error in analyze_geo_density: {e}")
            return {"summary": "Lỗi AI"}

    async def summarize_material(self, data: MaterialSummaryRequest) -> dict:
        if not self.is_ready:
            return {"summary": "Mock summary", "key_concepts": []}
        
        prompt = f"Tóm tắt tài liệu: {data.title}. Trả về JSON."
        try:
            response = self.model.generate_content(prompt)
            text = response.text
            json_start = text.find('{')
            json_end = text.rfind('}') + 1
            if json_start != -1:
                return json.loads(text[json_start:json_end])
            return {"summary": "Lỗi JSON"}
        except Exception as e:
            print(f"Error in summarize_material: {e}")
            return {"summary": "Lỗi AI"}

    async def match_mentors(self, data: MatchRequest) -> list:
        if not self.is_ready:
            return [{"mentor_id": "mock", "name": "Mock Mentor", "match_score": 90.0, "match_reasons": []}]
        
        prompt = f"Ghép nối mentor cho sinh viên. Request: {data.json()}. Trả về mảng JSON."
        try:
            response = self.model.generate_content(prompt)
            text = response.text
            json_start = text.find('[')
            json_end = text.rfind(']') + 1
            if json_start != -1:
                return json.loads(text[json_start:json_end])
            return []
        except Exception as e:
            print(f"Error in match_mentors: {e}")
            return []

    async def chat_with_rag(self, request: ChatRequest, context_docs: list) -> ChatResponse:
        try:
            if not self.is_ready:
                return ChatResponse(reply="AI model is not initialized.", sources=[])

            if not request.message:
                return ChatResponse(reply="Message cannot be empty.", sources=[])
            
            context_str = "\n".join(context_docs)
            prompt = f"Context: {context_str}\n\nQuestion: {request.message}"

            response = await self.model.generate_content(prompt)
            reply_text = response.text if response and response.text else "Could not generate response."

            return ChatResponse(reply=reply_text, sources=[])

        except Exception as e:
            print(f"Error in chat_with_rag: {e}")
            return ChatResponse(reply=f"Error: {e}", sources=[])

    async def moderate_text(self, text: str) -> dict:
        if not self.is_ready:
            return {"is_safe": True, "confidence": 1.0, "flags": []}
        
        prompt = f"Kiểm duyệt văn bản: \"{text}\". Trả về JSON: {{is_safe, confidence, flags}}"
        try:
            response = self.model.generate_content(prompt)
            res_text = response.text
            json_start = res_text.find('{')
            json_end = res_text.rfind('}') + 1
            if json_start != -1:
                return json.loads(res_text[json_start:json_end])
            return {"is_safe": False, "confidence": 0.0, "flags": ["Parse Error"]}
        except Exception as e:
            print(f"Error in moderate_text: {e}")
            return {"is_safe": False, "confidence": 0.0, "flags": ["AI Error"]}

    async def generate_learning_path(self, data: LearningPathRequest) -> dict:
        if not self.is_ready:
            return {"target_role": data.target_role, "steps": []}
        
        prompt = f"Tạo lộ trình học tập cho {data.target_role}. Trả về JSON."
        try:
            response = self.model.generate_content(prompt)
            text = response.text
            json_start = text.find('{')
            json_end = text.rfind('}') + 1
            if json_start != -1:
                return json.loads(text[json_start:json_end])
            return {"target_role": data.target_role, "steps": []}
        except Exception as e:
            print(f"Error in generate_learning_path: {e}")
            return {"target_role": data.target_role, "steps": []}

llm_service = LLMService()
