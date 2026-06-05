import math

class PredictiveService:
    def __init__(self):
        # Bo du lieu mau ve ky nang thi truong (Mock Market Data)
        self.market_trends = {
            "AI Engineering": 0.95,
            "Sustainability": 0.80,
            "Cybersecurity": 0.75,
            "Cloud Computing": 0.70
        }

    def analyze_trends(self, recent_logs):
        """
        Phan tich xu huong tu cac log gan day
        """
        keyword_counts = {}
        for log in recent_logs:
            kw = log.get('keyword', '').lower()
            if kw:
                keyword_counts[kw] = keyword_counts.get(kw, 0) + 1
        
        # Sap xep va lay top trends
        sorted_trends = sorted(keyword_counts.items(), key=lambda x: x[1], reverse=True)
        return [{"skill": k, "score": v} for k, v in sorted_trends[:5]]

    def predict_career_path(self, user_history):
        """
        Du bao lo trinh dua tren lich su hoc tap
        """
        # Logic: So khop lich su voi xu huong thi truong
        recommendations = []
        if any("python" in h.lower() for h in user_history):
            recommendations.append("Ban nen theo duoi AI Engineering vi no dang co diem tang truong 0.95")
        
        if len(user_history) < 5:
            recommendations.append("Hay hoan thanh them cac khoa hoc ve Soft Skills de tang 20% co hoi trung tuyen")
            
        return recommendations[0] if recommendations else "Hay tiep tuc kham pha cac linh vuc moi!"

predictive_service = PredictiveService()
