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

    async def chat_with_rag(self, message: str, history: list = None):
        if not self.is_ready:
            return {"reply": "Trợ lý ảo đang bận, bạn vui lòng quay lại sau.", "sources": []}

        history = history or []

        # RAG Logic: Truy xuất dữ liệu thực tế từ ChromaDB
        from app.services.vector_store_service import vector_store_service
        
        search_results = vector_store_service.query(message, n_results=3)
        
        documents = search_results.get('documents', [[]])
        metadatas = search_results.get('metadatas', [[]])
        
        context_docs = documents[0] if documents and len(documents) > 0 else []
        meta_docs = metadatas[0] if metadatas and len(metadatas) > 0 else []
        
        sources = []
        docs_str = ""
        if context_docs:
            for i, doc in enumerate(context_docs):
                meta = meta_docs[i] if i < len(meta_docs) and meta_docs else {}
                title = meta.get("title", f"Tài liệu tham khảo {i+1}")
                doc_id = meta.get("id", str(i))
                docs_str += f"\n--- Tài liệu {i+1} ({title}) ---\n{doc}\n"
                
                sources.append({
                    "doc_id": doc_id,
                    "title": title,
                    "snippet": doc[:150] + "..." if len(doc) > 150 else doc
                })
        else:
            docs_str = "Không tìm thấy tài liệu trong kho dữ liệu RAG."

        system_instruction = f"""
        Bạn là Trợ lý ảo thông minh của EduMap DNTU (Trường Đại học Công nghệ Đồng Nai).
        
        DỮ LIỆU TỪ HỆ THỐNG RAG (Sự thật tuyệt đối):
        {docs_str}
        
        NGUYÊN TẮC HOẠT ĐỘNG (CORE RULES):
        1. ZERO HALLUCINATION (Không ảo giác): TUYỆT ĐỐI KHÔNG tự bịa ra thông tin. Chỉ trả lời dựa trên DỮ LIỆU TỪ HỆ THỐNG RAG.
        2. Nếu thông tin hỏi không có trong phần RAG, phải nói rõ: "Dữ liệu hiện tại của EduMap chưa có thông tin về vấn đề này". Không phỏng đoán.
        3. Suy luận lô-gic và xâu chuỗi thông tin từ dữ liệu RAG để có câu trả lời sâu sắc, tư vấn đúng trọng tâm.
        4. Trình bày đầy đủ ý, không bao giờ ngắt ngang nội dung.
        """

        # Format history for the prompt
        history_str = ""
        for msg in history[-6:]: # Lấy 6 tin nhắn gần nhất làm bối cảnh
            role = "Sinh viên" if msg.get("role") == "user" else "Trợ lý"
            history_str += f"{role}: {msg.get('content')}\n"

        prompt = f"{system_instruction}\n\nLỊCH SỬ TRÒ CHUYỆN:\n{history_str}\nSinh viên: {message}\nTrợ lý EduMap:"
        
        try:
            # Cấu hình chống ngắt nội dung và tăng tính phòng thủ (Defensive AI parameters)
            generation_config = genai.types.GenerationConfig(
                max_output_tokens=4096,
                temperature=0.3, # Giảm Temperature để câu trả lời chính xác, tránh lan man
                top_p=0.8
            )
            response = self.model.generate_content(prompt, generation_config=generation_config)
            if response and response.text:
                return {"reply": response.text.strip(), "sources": sources}
            return {"reply": "Xin lỗi, mình không thể sinh câu trả lời phù hợp lúc này.", "sources": sources}
        except Exception as e:
            print(f"Lỗi AI Service RAG: {str(e)}")
            return {"reply": "Hệ thống AI đang gặp sự cố nhỏ, mình sẽ quay lại ngay!", "sources": []}

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
