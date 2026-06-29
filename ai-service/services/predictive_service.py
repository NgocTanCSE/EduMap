import math
import os
from typing import List, Dict, Any

class PredictiveService:
    def __init__(self):
        self.db_host = os.getenv("DB_HOST", "localhost")
        self.db_port = os.getenv("DB_PORT", "5432")
        self.db_name = os.getenv("DB_DATABASE", "edumap_db")
        self.db_user = os.getenv("DB_USERNAME", "admin")
        self.db_password = os.getenv("DB_PASSWORD", "password123")

    def analyze_trends(self, recent_logs: List[Dict]) -> List[Dict]:
        if not recent_logs:
            return []
        
        keyword_counts: Dict[str, int] = {}
        for log in recent_logs:
            kw = log.get('keyword', '')
            if kw and isinstance(kw, str):
                keyword_counts[kw.lower()] = keyword_counts.get(kw.lower(), 0) + 1
        
        sorted_trends = sorted(keyword_counts.items(), key=lambda x: x[1], reverse=True)
        return [{"skill": k, "score": v} for k, v in sorted_trends[:5]]

    def predict_career_path(self, user_history: List[str]) -> str:
        if not user_history:
            return "Hãy khám phá các lĩnh vực kỹ năng để nhận đề xuất lộ trình phù hợp."
        
        recommendations = []
        history_lower = [h.lower() for h in user_history if h]
        
        if any("python" in h for h in history_lower):
            recommendations.append("Bạn nên theo đuổi AI Engineering vì nó đang có điểm tăng trưởng cao.")
        
        if any("web" in h or "javascript" in h for h in history_lower):
            recommendations.append("Bạn có thể cân nhắc Full-stack Developer với xu hướng tuyển dụng tăng.")
        
        if len(user_history) < 5:
            recommendations.append("Hãy hoàn thành thêm các khoá học về Soft Skills để tăng 20% cơ hội trúng tuyển.")
        
        return recommendations[0] if recommendations else "Hãy tiếp tục khám phá các lĩnh vực mới!"

    def get_market_trends(self) -> Dict[str, float]:
        market_trends = {
            "AI Engineering": 0.95,
            "Sustainability": 0.80,
            "Cybersecurity": 0.75,
            "Cloud Computing": 0.70
        }
        return market_trends

predictive_service = PredictiveService()