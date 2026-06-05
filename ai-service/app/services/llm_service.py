import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

class LLMService:
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key and not api_key.startswith("AIzaSy_placeholder"):
            genai.configure(api_key=api_key)
            model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
            self.model = genai.GenerativeModel(model_name)
            self.is_ready = True
        else:
            self.is_ready = False
            print("WARNING: GEMINI_API_KEY not set correctly.")

    async def chat_response(self, message: str, history: list = None, context: dict = None):
        if not self.is_ready:
            return "Trợ lý ảo đang bận, bạn vui lòng quay lại sau."

        context = context or {}
        history = history or []

        # RAG Logic: Truy xuất dữ liệu từ ChromaDB
        from app.services.vector_store_service import vector_store_service
        
        search_results = vector_store_service.query(message, n_results=3)
        context_docs = search_results.get('documents', [[]])[0]
        
        docs_str = "\n".join([f"- {doc}" for doc in context_docs]) if context_docs else "Không tìm thấy tài liệu liên quan trong kho dữ liệu."

        system_instruction = f"""
        Bạn là Trợ lý ảo thông minh của EduMap DNTU (Trường Đại học Công nghệ Đồng Nai).
        Dữ liệu liên quan được truy xuất từ kho tài liệu của EduMap:
        {docs_str}
        
        Nhiệm vụ:
        1. Ưu tiên trả lời dựa trên dữ liệu thực tế được cung cấp ở trên.
        2. Nếu thông tin không có trong dữ liệu truy xuất, hãy sử dụng kiến thức chung nhưng vẫn giữ phong cách của EduMap.
        3. Giữ thái độ thân thiện, chuyên nghiệp.
        4. Trả lời bằng tiếng Việt.
        """

        # Format history for the prompt
        history_str = ""
        for msg in history[-6:]: # Chỉ lấy tối đa 6 tin nhắn gần nhất để tiết kiệm token
            role = "Sinh viên" if msg.get("role") == "user" else "Trợ lý"
            history_str += f"{role}: {msg.get('content')}\n"

        prompt = f"{system_instruction}\n\nLịch sử trò chuyện:\n{history_str}\nSinh viên: {message}\nTrợ lý EduMap:"
        
        try:
            response = self.model.generate_content(prompt)
            if response and response.text:
                return response.text
            return "Xin lỗi, mình không thể tìm thấy câu trả lời phù hợp lúc này."
        except Exception as e:
            print(f"Lỗi AI Service: {str(e)}")
            return "Hệ thống AI đang gặp sự cố nhỏ, mình sẽ quay lại ngay!"

    async def generate_career_advice(self, user_info: dict):
        if not self.is_ready: return "Dịch vụ bảo trì."
        prompt = f"Dựa trên kỹ năng {user_info.get('skills')} của sinh viên DNTU, hãy tư vấn lộ trình học tập chuyên sâu."
        try:
            response = self.model.generate_content(prompt)
            return response.text
        except:
            return "AI đang bận phân tích lộ trình, hãy thử lại."

    async def recommend_career(self, request):
        if not self.is_ready:
            return [{"title": "Software Engineer", "match_score": 80, "explanation": "Fallback mode", "missing_skills": []}]

        prompt = f"""
        Phân tích hồ sơ người dùng và đề xuất 3 công việc phù hợp nhất.
        HỒ SƠ:
        - Học vấn: {request.education_level}
        - Chuyên ngành: {request.major}
        - Kỹ năng hiện có: {", ".join(request.skills)}
        - Sở thích: {", ".join(request.interests)}
        
        Nhiệm vụ:
        Trả về danh sách JSON gồm 3 đối tượng, mỗi đối tượng có:
        - title: Tên công việc
        - match_score: Điểm phù hợp (0-100)
        - explanation: Giải thích tại sao phù hợp (tiếng Việt)
        - missing_skills: Danh sách kỹ năng còn thiếu để đạt 100% phù hợp.
        
        Chỉ trả về JSON.
        """
        
        try:
            response = self.model.generate_content(prompt)
            text = response.text
            # Extract JSON
            import json
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "[" in text:
                text = text[text.find("["):text.rfind("]")+1]
            return json.loads(text)
        except Exception as e:
            print(f"Error in recommend_career AI: {str(e)}")
            return [
                {"title": "Lập trình viên Fullstack", "match_score": 75, "explanation": "Dựa trên kỹ năng hiện tại của bạn.", "missing_skills": ["Docker", "Kubernetes"]}
            ]

    async def analyze_market_trends(self, market_data: list):
        if not self.is_ready: return {"status": "offline"}
        return {"status": "online", "analysis": "Xu hướng tuyển dụng tại KCN Amata đang rất tốt."}

llm_service = LLMService()
