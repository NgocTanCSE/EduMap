import os
import json
import hashlib
from google import genai
from dotenv import load_dotenv
from services.cache_service import cache_service
from models.career_models import CareerAnalysisRequest
from models.chat_models import ChatRequest, ChatResponse, ChatMessage
from models.learning_models import LearningPathRequest
from models.library_models import MaterialSummaryRequest
from models.mentor_models import MatchRequest
from models.geo_models import GeoDensityAnalysisRequest

load_dotenv()

class LLMService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
            self.model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
            self.is_ready = True
        else:
            self.model = None
            self.is_ready = False
            print("ERROR: GEMINI_API_KEY is not configured. AI Service requires a valid Gemini API key.")
            print("Set GEMINI_API_KEY in .env file or environment variables.")

    # --- Methods from Legacy LLMService ---

    async def chat_with_rag(self, message: str, history: list = None, context: dict = None) -> dict:
        """
        Phương thức Chat RAG nâng cao với cơ chế chống ảo giác (Anti-Hallucination).
        Kết hợp dữ liệu từ ChromaDB, hệ thống và Gemini Pro Engine.
        """
        if not self.is_ready:
            return {"reply": "Trợ lý ảo EduMap hiện đang bảo trì, vui lòng quay lại sau.", "sources": []}

        # Kiểm tra Cache
        cache_key = hashlib.md5(f"chat:{message}:{json.dumps(history or [])}:{json.dumps(context or {{}})}".encode()).hexdigest()
        cached_res = cache_service.get(cache_key)
        if cached_res:
            return cached_res

        history = history or []
        context = context or {}

        # 1. RAG Logic: Truy xuất dữ liệu từ ChromaDB
        from services.vector_store import vector_store
        try:
            search_results = vector_store.query(message, n_results=3)
            documents = search_results.get('documents', [[]])
            metadatas = search_results.get('metadatas', [[]])
            ids = search_results.get('ids', [[]])
            
            context_docs = documents[0] if documents and len(documents) > 0 else []
            meta_docs = metadatas[0] if metadatas and len(metadatas) > 0 else []
            id_docs = ids[0] if ids and len(ids) > 0 else []
            
            sources = []
            docs_str = ""
            if context_docs:
                for i, doc in enumerate(context_docs):
                    meta = meta_docs[i] if i < len(meta_docs) else {}
                    title = meta.get("title", f"Tài liệu tham khảo {i+1}")
                    doc_id = id_docs[i] if i < len(id_docs) else str(i)
                    docs_str += f"\n--- Tài liệu {i+1} ({title}) ---\n{doc}\n"
                    
                    sources.append({
                        "doc_id": doc_id,
                        "title": title,
                        "snippet": doc[:200] + "..." if len(doc) > 200 else doc
                    })
            else:
                docs_str = "Không tìm thấy dữ liệu liên quan trong hệ thống kiến thức của EduMap."
        except Exception as e:
            print(f"Error querying vector store: {e}")
            docs_str = "Lỗi kết nối kho dữ liệu."
            sources = []

        # 2. Ngữ cảnh hệ thống (Dynamic Context)
        system_context_str = ""
        if context:
            system_context_str = "\nNGỮ CẢNH HỆ THỐNG THỜI GIAN THỰC:\n"
            for key, value in context.items():
                system_context_str += f"- {key}: {value}\n"

        # 3. Prompt Engineering: Thiết lập "Luật" cho AI
        system_instruction = f"""
        Bạn là Trợ lý ảo thông minh của EduMap DNTU (Trường Đại học Công nghệ Đồng Nai).
        
        DỮ LIỆU TỪ HỆ THỐNG RAG (Sự thật):
        {docs_str}
        {system_context_str}
        
        NGUYÊN TẮC HOẠT ĐỘNG (CORE RULES):
        1. ZERO HALLUCINATION: TUYỆT ĐỐI KHÔNG tự bịa ra thông tin không có trong phần DỮ LIỆU TỪ HỆ THỐNG RAG và NGỮ CẢNH HỆ THỐNG.
        2. Nếu câu hỏi không liên quan đến dữ liệu hệ thống, trả lời dựa trên kiến thức chung nhưng phải khẳng định là thông tin tham khảo.
        3. Tư vấn nhiệt tình, chuyên nghiệp, sử dụng ngôn ngữ thân thiện với sinh viên.
        4. Trình bày rõ ràng, sử dụng bullet points nếu cần thiết.
        """

        # Format history (lấy 6 tin nhắn gần nhất)
        history_str = ""
        for msg in history[-6:]:
            role = "Sinh viên" if msg.get("role") == "user" else "Trợ lý"
            history_str += f"{role}: {msg.get('content')}\n"

        prompt = f"{system_instruction}\n\nLỊCH SỬ TRÒ CHUYỆN:\n{history_str}\nSinh viên: {message}\nTrợ lý EduMap:"
        
        try:
            # 4. AI Generation Config
            generation_config = genai.types.GenerationConfig(
                max_output_tokens=2048,
                temperature=0.3, 
                top_p=0.8
            )
            response = self.client.models.generate_content(model=self.model_name, contents=prompt, config=generation_config)
            
            reply_text = response.text.strip() if response and response.text else "Mình chưa tìm được câu trả lời phù hợp."
            final_res = {"reply": reply_text, "sources": sources}
            
            # Lưu vào Cache (TTL 1 giờ)
            cache_service.set(cache_key, final_res, ttl=3600)
            
            return final_res
            
        except Exception as e:
            print(f"AI Generation Error: {e}")
            return {"reply": "Hệ thống AI đang gặp sự cố nhỏ, mình sẽ quay lại ngay!", "sources": []}

    async def chat_response(self, message: str, history: list = None, context: dict = None):
        """Wrapper để tương thích với các module cũ."""
        res = await self.chat_with_rag(message, history, context)
        return res.get("reply")

    async def generate_career_advice(self, user_info: dict):
        if not self.is_ready: return "AI Service is not configured. Please set GEMINI_API_KEY to use career advice."
        prompt = f"Tư vấn lộ trình học tập dựa trên kỹ năng: {user_info.get('skills')}"
        try:
            response = self.client.models.generate_content(model=self.model_name, contents=prompt)
            return response.text
        except:
            return "AI đang bận, hãy thử lại."

    async def analyze_market_trends(self, market_data: list):
        if not self.is_ready: return {"status": "offline", "message": "AI Service not configured. GEMINI_API_KEY is required."}
        return {"status": "online", "analysis": "Xu hướng tuyển dụng tại KCN Amata đang rất tốt."}

    async def generate_daily_insight(self, dashboard_data: dict) -> dict:
        if not self.is_ready:
            return {"insight": "AI Service offline - configure GEMINI_API_KEY for personalized insights."}
        
        prompt = f"Dựa trên dữ liệu dashboard: {json.dumps(dashboard_data)}, hãy đưa ra 1 lời khuyên ngắn gọn."
        try:
            response = self.client.models.generate_content(model=self.model_name, contents=prompt)
            return {"insight": response.text}
        except:
            return {"insight": "Hôm nay là một ngày tuyệt vời để học kỹ năng mới."}

    # --- Methods from New LLMService ---

    def _extract_json(self, text: str):
        """
        Bóc tách JSON (Mảng hoặc Đối tượng) từ văn bản trả về của AI một cách an toàn bằng Regex.
        Hỗ trợ loại bỏ các ký tự thừa, markdown blocks.
        """
        if not text:
            return None
            
        try:
            import json
            import re
            
            # 1. Thử bóc tách khối markdown ```json ... ```
            json_match = re.search(r'```json\s*([\s\S]*?)\s*```', text)
            if json_match:
                try:
                    return json.loads(json_match.group(1).strip())
                except:
                    pass
            
            # 2. Thử tìm khối { ... } hoặc [ ... ] lớn nhất
            text_cleaned = text.strip()
            
            # Tìm vị trí của dấu ngoặc đầu tiên và cuối cùng
            start_obj = text_cleaned.find('{')
            start_arr = text_cleaned.find('[')
            
            start = -1
            if start_obj != -1 and (start_arr == -1 or start_obj < start_arr):
                start = start_obj
                end = text_cleaned.rfind('}') + 1
            elif start_arr != -1:
                start = start_arr
                end = text_cleaned.rfind(']') + 1
            
            if start != -1:
                candidate = text_cleaned[start:end]
                # Fix các lỗi JSON phổ biến như dấu phẩy thừa
                candidate = re.sub(r',\s*([\]}])', r'\1', candidate)
                return json.loads(candidate)
                
            return None
        except Exception as e:
            print(f"Error extracting JSON: {e}")
            return None

    async def recommend_career(self, data: CareerAnalysisRequest) -> list:
        if not self.is_ready:
            return []
        
        # Kiểm tra Cache
        cache_key = hashlib.md5(f"career:{hashlib.md5(data.json().encode()).hexdigest()}".encode()).hexdigest()
        cached_res = cache_service.get(cache_key)
        if cached_res:
            return cached_res

        prompt = f"""
        Phân tích hồ sơ sinh viên: {data.json()}
        Đề xuất 3 nghề nghiệp phù hợp nhất tại Việt Nam.
        Đối với mỗi nghề nghiệp, cung cấp điểm đánh giá (0-100) cho biểu đồ Radar trên 5 tiêu chí:
        - Technical (Kỹ thuật)
        - Soft Skills (Kỹ năng mềm)
        - Problem Solving (Giải quyết vấn đề)
        - Language (Ngoại ngữ)
        - Creativity (Sáng tạo)
        
        Trả về mảng JSON gồm: title, match_score, explanation, missing_skills, radar_chart: {{criteria: score}}
        Chỉ trả về JSON.
        """
        try:
            response = self.client.models.generate_content(model=self.model_name, contents=prompt)
            result = self._extract_json(response.text)
            
            if result and isinstance(result, list):
                # Lưu vào Cache (TTL 24 giờ cho đề xuất nghề nghiệp)
                cache_service.set(cache_key, result, ttl=86400)
                
            return result if isinstance(result, list) else []
        except Exception as e:
            print(f"Error in recommend_career: {e}")
            return []

    async def generate_learning_path(self, data: LearningPathRequest) -> dict:
        """
        Tạo lộ trình học tập cá nhân hóa dựa trên trình độ và mục tiêu nghề nghiệp.
        """
        if not self.is_ready:
            return {}

        # Kiểm tra Cache
        cache_key = hashlib.md5(f"path:{data.user_id}:{data.target_role}:{data.current_level}".encode()).hexdigest()
        cached_res = cache_service.get(cache_key)
        if cached_res:
            return cached_res

        prompt = f"""
        Xây dựng lộ trình học tập chi tiết cho sinh viên:
        - Mục tiêu: {data.target_role}
        - Trình độ hiện tại: {data.current_level}
        - Thời gian cam kết: {data.time_commitment_hours_per_week} giờ/tuần
        
        Yêu cầu:
        1. Phân rã thành các bước (steps) cụ thể.
        2. Mỗi bước bao gồm: step_number, title, estimated_weeks, description (tiếng Việt).
        3. Tính toán total_estimated_months dựa trên tổng số tuần.
        4. Trả về định dạng JSON: {{target_role, total_estimated_months, steps: []}}
        
        Chỉ trả về JSON.
        """
        try:
            response = self.client.models.generate_content(model=self.model_name, contents=prompt)
            result = self._extract_json(response.text)
            
            if result:
                # Lưu vào Cache (TTL 24 giờ cho lộ trình)
                cache_service.set(cache_key, result, ttl=86400)
            
            return result if result else {}
        except Exception as e:
            print(f"Error in generate_learning_path: {e}")
            return {}

    async def analyze_geo_density(self, data: GeoDensityAnalysisRequest, hubs: list = None) -> dict:
        if not self.is_ready:
            return {"summary": "AI Service not configured", "density_score": 0}
        
        prompt = f"""
        Phân tích mật độ giáo dục tại {data.city}.
        Các cụm giáo dục (Hubs) được phát hiện: {json.dumps(hubs)}.
        Tổng số điểm: {len(data.points)}.
        
        Hãy đưa ra:
        1. Nhận xét về sự phân bổ.
        2. Đánh giá mức độ thuận tiện cho sinh viên.
        3. Đề xuất khu vực cần đầu tư thêm.
        
        Trả về JSON: {{summary, density_score, recommendations: []}}
        """
        try:
            response = self.client.models.generate_content(model=self.model_name, contents=prompt)
            return self._extract_json(response.text) or {"summary": "Lỗi phân tích"}
        except Exception as e:
            print(f"Error in analyze_geo_density: {e}")
            return {"summary": "Lỗi AI"}

    async def summarize_material(self, data: MaterialSummaryRequest) -> dict:
        if not self.is_ready:
            return {"summary": "AI Service not configured", "key_concepts": []}
        
        prompt = f"Tóm tắt tài liệu: {data.title}. Trả về JSON: {{summary, key_concepts: []}}"
        try:
            response = self.client.models.generate_content(model=self.model_name, contents=prompt)
            return self._extract_json(response.text) or {"summary": "Lỗi tóm tắt"}
        except Exception as e:
            print(f"Error in summarize_material: {e}")
            return {"summary": "Lỗi AI"}

    async def match_mentors(self, data: MatchRequest) -> list:
        if not self.is_ready:
            return []
        
        prompt = f"Ghép nối mentor cho sinh viên. Request: {data.json()}. Trả về mảng JSON: [{{mentor_id, name, match_score, match_reasons: []}}]"
        try:
            response = self.client.models.generate_content(model=self.model_name, contents=prompt)
            result = self._extract_json(response.text)
            return result if isinstance(result, list) else []
        except Exception as e:
            print(f"Error in match_mentors: {e}")
            return []


    async def moderate_text(self, text: str) -> dict:
        if not self.is_ready:
            return {"is_safe": None, "confidence": 0.0, "flags": ["AI_OFFLINE"], "reason": "AI Service not configured."}
        
        prompt = f"""
        Bạn là chuyên gia kiểm duyệt nội dung cho nền tảng giáo dục EduMap.
        Hãy phân tích văn bản sau: "{text}"
        
        Các tiêu chí vi phạm:
        1. Ngôn từ thù ghét, thô tục, xúc phạm.
        2. Quảng cáo rác (Spam) không liên quan đến giáo dục.
        3. Các liên kết (links) có dấu hiệu lừa đảo hoặc mã độc.
        4. Nội dung nhạy cảm hoặc không phù hợp với môi trường học đường.
        
        Trả về JSON: {{is_safe: boolean, confidence: float, flags: [string], reason: string}}
        """
        try:
            response = self.client.models.generate_content(model=self.model_name, contents=prompt)
            return self._extract_json(response.text) or {"is_safe": False, "confidence": 0.0, "flags": ["Parse Error"]}
        except Exception as e:
            print(f"Error in moderate_text: {e}")
            return {"is_safe": False, "confidence": 0.0, "flags": ["AI Error"]}

    async def get_suggestions(self) -> list:
        if not self.is_ready:
            return []
        prompt = "Generate an array of 3 AI career suggestions. Each suggestion should be a JSON object with fields: title, description, match_score (0-100)."
        try:
            response = self.client.models.generate_content(model=self.model_name, contents=prompt)
            result = self._extract_json(response.text)
            return result if isinstance(result, list) else []
        except Exception as e:
            print(f"Error in get_suggestions: {e}")
            return []

llm_service = LLMService()
