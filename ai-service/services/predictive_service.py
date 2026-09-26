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
            return "Hãy cung cấp kỹ năng/hoạt động để nhận đề xuất lộ trình phù hợp."
        recommendations = []
        history_lower = [h.lower() for h in user_history if h]
        if any("python" in h for h in history_lower):
            recommendations.append("AI Engineering — phù hợp với nền tảng lập trình của bạn.")
        if any("web" in h or "javascript" in h for h in history_lower):
            recommendations.append("Full-stack Developer — phù hợp với kinh nghiệm phát triển web của bạn.")
        if len(user_history) < 5:
            recommendations.append("Bạn nên bổ sung kỹ năng mềm để mở rộng cơ hội ứng tuyển.")
        return recommendations[0] if recommendations else "Hãy khám phá thêm lĩnh vực để nhận đề xuất."

    def get_market_trends(self) -> Dict[str, float]:
        # TODO: trả về xu hướng thị trường thật từ bảng DB market_trends.
        # Hiện chưa có nguồn dữ liệu thật → trả về rỗng (bỏ qua các con số mẫu old-mock-removed).
        return {}

predictive_service = PredictiveService()
