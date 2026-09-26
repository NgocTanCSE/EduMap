import os
import json
import hashlib
import urllib.request
import urllib.error
from dotenv import load_dotenv
try:
    from services.cache_service import cache_service
except Exception as e:
    print(f"Cache service import failed: {e}")
    cache_service = None
try:
    from models.career_models import CareerAnalysisRequest
except Exception:
    CareerAnalysisRequest = None
try:
    from models.chat_models import ChatRequest, ChatResponse, ChatMessage
except Exception:
    ChatRequest = None
    ChatResponse = None
    ChatMessage = None
try:
    from models.learning_models import LearningPathRequest
except Exception:
    LearningPathRequest = None
try:
    from models.library_models import MaterialSummaryRequest
except Exception:
    MaterialSummaryRequest = None
try:
    from models.mentor_models import MatchRequest
except Exception:
    MatchRequest = None
try:
    from models.geo_models import GeoDensityAnalysisRequest
except Exception:
    GeoDensityAnalysisRequest = None

load_dotenv()

class LLMService:
    def __init__(self):
        # CHU Y: chat + embedding deu qua Google Gemini. Dung 1 key Google: GEMINI_API_KEY cho ca 2.
        self.api_key = os.getenv("GEMINI_API_KEY")
        # DSS model theo thu tu tu GEMINI_MODEL (CSV). Model dau tien = primary; con lai la fallback tu dong.
        self.model_candidates = [m.strip() for m in os.getenv("GEMINI_MODEL", "gemini-3.8-flash,gemini-3.6-flash,gemini-1.5-flash,gemini-flash-latest").split(",") if m.strip()]
        self.model_name = self.model_candidates[0] if self.model_candidates else "gemini-3.8-flash"
        if self.api_key:
            self.is_ready = True
        else:
            self.is_ready = False
            print("ERROR: GEMINI_API_KEY chua cau hinh. Dan Google API key (AIza...) vao GEMINI_API_KEY trong .env.")
            print("GEMINI_MODEL mac dinh: gemini-3.8-flash.")

    def _gemini_generate(self, prompt: str, temperature=0.7, max_tokens=None, top_p=None) -> str:
        """Goi Google :generateContent (urllib). Thu tu model trong GEMINI_MODEL (CSV); 404 -> thu ke."""
        if not self.is_ready:
            raise RuntimeError("AI Service chua san sang. Cau hinh GEMINI_API_KEY (Google).")
        cfg = {}
        if temperature is not None:
            cfg["temperature"] = temperature
        if max_tokens is not None:
            cfg["maxOutputTokens"] = max_tokens
        if top_p is not None:
            cfg["topP"] = top_p
        payload = {"contents": [{"role": "user", "parts": [{"text": prompt}]}]}
        if cfg:
            payload["generationConfig"] = cfg
        body_json = json.dumps(payload).encode("utf-8")
        last_err = None
        for model in self.model_candidates:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={self.api_key}"
            req = urllib.request.Request(url, data=body_json, headers={"Content-Type": "application/json"}, method="POST")
            try:
                with urllib.request.urlopen(req, timeout=30) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
            except urllib.error.HTTPError as e:
                b = e.read().decode("utf-8", "ignore")
                low = b.lower()
                if e.code == 404 or "not found" in low or "not supported" in low or "no longer available" in low:
                    last_err = f"{model}: HTTP {e.code} {b[:120]}"; print(f"Gemini model {model} khong kha dung, thu model ke tiep..."); continue
                if e.code in (401, 403):
                    raise RuntimeError(f"Google Gemini auth loi (HTTP {e.code}): {b[:200]}")
                raise RuntimeError(f"Google Gemini API loi (HTTP {e.code}): {b[:200]}")
            except Exception as e:
                raise RuntimeError(f"Error calling Google Gemini API: {e}")
            if "error" in data:
                err = data["error"]; code = err.get("code"); msg = err.get("message", ""); mlow = msg.lower()
                if code == 404 or "not found" in mlow or "not supported" in mlow or "no longer available" in mlow:
                    last_err = f"{model}: {msg[:120]}"; print(f"Gemini model {model} khong kha dung, thu model ke tiep..."); continue
                raise RuntimeError(f"Google Gemini API error: {err}")
            cands = data.get("candidates") or []
            if not cands:
                last_err = f"{model}: khong co candidate"; continue
            text = "".join("".join(pt.get("text","") for pt in c.get("content",{}).get("parts",[])) for c in cands).strip()
            if text:
                return text
            last_err = f"{model}: tra ve empty text"
            continue
        raise RuntimeError(f"Khong the sinh noi dung tu Gemini. Loi: {last_err}")

    # --- Methods from Legacy LLMService ---

    async def chat_with_rag(self, message: str, history: list = None, context: dict = None) -> dict:
        """
        Phương thức Chat RAG nâng cao với cơ chế chống ảo giác (Anti-Hallucination).
        Kết hợp dữ liệu từ ChromaDB, hệ thống và Google Gemini Engine.
        """
        if not self.is_ready:
            raise RuntimeError("AI Service chưa sẵn sàng. Cấu hình GEMINI_API_KEY.")

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
        2. Nếu câu hỏi không liên quan đến dữ liệu hệ thống, trả lời dựa trên kiến thuật chung nhưng phải khẳng định là thông tin tham khảo.
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
            response = self._gemini_generate(prompt,
                max_tokens=2048,
                temperature=0.3,
                top_p=0.8)
            
            reply_text = response.strip() if response and response else "Mình chưa tìm được câu trả lời phù hợp."
            final_res = {"reply": reply_text, "sources": sources}
            
            cache_service.set(cache_key, final_res, ttl=3600)
            
            return final_res
            
        except Exception as e:
            print(f"AI Generation Error: {e}")
            raise RuntimeError(f"AI Generation Error: {e}")

    async def chat_response(self, message: str, history: list = None, context: dict = None):
        """Wrapper để tương thích với các module cũ."""
        res = await self.chat_with_rag(message, history, context)
        return res.get("reply")

    async def generate_career_advice(self, user_info: dict):
        if not self.is_ready:
            raise RuntimeError("AI Service chưa sẵn sàng. Cấu hình GEMINI_API_KEY.")
        prompt = f"Tư vấn lộ trình học tập dựa trên kỹ năng: {user_info.get('skills')}"
        try:
            response = self._gemini_generate(prompt)
            return response
        except Exception as e:
            raise RuntimeError(f"Error in generate_career_advice: {e}")

    async def analyze_market_trends(self, market_data: list):
        if not self.is_ready:
            raise RuntimeError("AI Service chưa sẵn sàng. Cấu hình GEMINI_API_KEY.")
        prompt = f"Dựa trên dữ liệu thị trường sau: {json.dumps(market_data)}, hãy phân tích ngắn gọn xu hướng kỹ năng/nghề nghề nổi bật. Trả về JSON: {{status, analysis}}."
        try:
            response = self._gemini_generate(prompt)
            result = self._extract_json(response)
            return result if result else {"status": "ai", "analysis": response.strip()}
        except Exception as e:
            print(f"Error in analyze_market_trends: {e}")
            raise RuntimeError(f"Error in analyze_market_trends: {e}")

    async def generate_daily_insight(self, dashboard_data: dict) -> dict:
        if not self.is_ready:
            raise RuntimeError("AI Service chưa sẵn sàng. Cấu hình GEMINI_API_KEY.")
        
        prompt = f"Dựa trên dữ liệu dashboard: {json.dumps(dashboard_data)}, hãy đưa ra 1 lời khuyên ngắn gọn."
        try:
            response = self._gemini_generate(prompt)
            return {"insight": response}
        except Exception as e:
            print(f"Error in generate_daily_insight: {e}")
            raise RuntimeError(f"Error in generate_daily_insight: {e}")

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
            raise RuntimeError("AI Service chưa sẵn sàng. Cấu hình GEMINI_API_KEY.")
        
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
            response = self._gemini_generate(prompt)
            result = self._extract_json(response)
            
            if result and isinstance(result, list):
                # Lưu vào Cache (TTL 24 giờ cho đề xuất nghề nghiệp)
                cache_service.set(cache_key, result, ttl=86400)
                
            if result is None or not isinstance(result, list):
                raise RuntimeError("AI trả về JSON không hợp lệ cho recommend_career.")
            return result
        except Exception as e:
            print(f"Error in recommend_career: {e}")
            raise RuntimeError(f"Error in recommend_career: {e}")

    async def generate_learning_path(self, data: LearningPathRequest) -> dict:
        """
        Tạo lộ trình học tập cá nhân hóa dựa trên trình độ và mục tiêu nghề nghiệp.
        """
        if not self.is_ready:
            raise RuntimeError("AI Service chưa sẵn sàng. Cấu hình GEMINI_API_KEY.")

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
            response = self._gemini_generate(prompt)
            result = self._extract_json(response)
            
            if result:
                # Lưu vào Cache (TTL 24 giờ cho lộ trình)
                cache_service.set(cache_key, result, ttl=86400)
            
            if result is None:
                raise RuntimeError("AI trả về JSON không hợp lệ cho generate_learning_path.")
            return result
        except Exception as e:
            print(f"Error in generate_learning_path: {e}")
            raise RuntimeError(f"Error in generate_learning_path: {e}")

    async def analyze_geo_density(self, data: GeoDensityAnalysisRequest, hubs: list = None) -> dict:
        if not self.is_ready:
            raise RuntimeError("AI Service chưa sẵn sàng. Cấu hình GEMINI_API_KEY.")
        
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
            response = self._gemini_generate(prompt)
            result = self._extract_json(response)
            if result is None:
                raise RuntimeError("AI trả về JSON không hợp lệ cho analyze_geo_density.")
            return result
        except Exception as e:
            print(f"Error in analyze_geo_density: {e}")
            raise RuntimeError(f"Error in analyze_geo_density: {e}")

    async def summarize_material(self, data: MaterialSummaryRequest) -> dict:
        if not self.is_ready:
            raise RuntimeError("AI Service chưa sẵn sàng. Cấu hình GEMINI_API_KEY.")
        
        prompt = f"Tóm tắt tài liệu: {data.title}. Trả về JSON: {{summary, key_concepts: []}}"
        try:
            response = self._gemini_generate(prompt)
            result = self._extract_json(response)
            if result is None:
                raise RuntimeError("AI trả về JSON không hợp lệ cho summarize_material.")
            return result
        except Exception as e:
            print(f"Error in summarize_material: {e}")
            raise RuntimeError(f"Error in summarize_material: {e}")

    async def match_mentors(self, data: MatchRequest) -> list:
        if not self.is_ready:
            raise RuntimeError("AI Service chưa sẵn sàng. Cấu hình GEMINI_API_KEY.")
        
        prompt = f"Ghép nối mentor cho sinh viên. Request: {data.json()}. Trả về mảng JSON: [{{mentor_id, name, match_score, match_reasons: []}}]"
        try:
            response = self._gemini_generate(prompt)
            result = self._extract_json(response)
            if result is None or not isinstance(result, list):
                raise RuntimeError("AI trả về JSON không hợp lệ cho match_mentors.")
            return result
        except Exception as e:
            print(f"Error in match_mentors: {e}")
            raise RuntimeError(f"Error in match_mentors: {e}")


    async def moderate_text(self, text: str) -> dict:
        if not self.is_ready:
            raise RuntimeError("AI Service chưa sẵn sàng. Cấu hình GEMINI_API_KEY.")
        
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
            response = self._gemini_generate(prompt)
            result = self._extract_json(response)
            if result is None:
                raise RuntimeError("AI trả về JSON không hợp lệ cho moderate_text.")
            return result
        except Exception as e:
            print(f"Error in moderate_text: {e}")
            raise RuntimeError(f"Error in moderate_text: {e}")

    async def get_suggestions(self) -> list:
        if not self.is_ready:
            raise RuntimeError("AI Service chưa sẵn sàng. Cấu hình GEMINI_API_KEY.")
        prompt = "Generate an array of 3 AI career suggestions. Each suggestion should be a JSON object with fields: title, description, match_score (0-100)."
        try:
            response = self._gemini_generate(prompt)
            result = self._extract_json(response)
            if result is None or not isinstance(result, list):
                raise RuntimeError("AI trả về JSON không hợp lệ cho get_suggestions.")
            return result
        except Exception as e:
            print(f"Error in get_suggestions: {e}")
            raise RuntimeError(f"Error in get_suggestions: {e}")

llm_service = LLMService()
