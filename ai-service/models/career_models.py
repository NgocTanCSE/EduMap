from pydantic import BaseModel, Field
from typing import List

# --- CẤU TRÚC ĐẦU VÀO (INPUT) ---
class CareerQuizRequest(BaseModel):
    user_id: str = Field(..., description="ID của sinh viên")
    mbti_type: str = Field(..., description="Kết quả bài test tính cách MBTI (VD: INTJ, ENFP)")
    holland_code: str = Field(None, description="Kết quả bài test Holland (VD: RIA, SEC)")
    hard_skills: List[str] = Field(default_factory=list, description="Danh sách kỹ năng cứng (VD: Python, Java)")
    soft_skills: List[str] = Field(default_factory=list, description="Danh sách kỹ năng mềm (VD: Teamwork, Leader)")
    interests: List[str] = Field(default_factory=list, description="Sở thích học thuật")

# --- CẤU TRÚC ĐẦU RA (OUTPUT) ---
class RecommendedCareer(BaseModel):
    title: str = Field(..., description="Tên chức danh nghề nghiệp")
    match_score: int = Field(..., description="Điểm phù hợp (0-100%)")
    explanation: str = Field(..., description="AI giải thích lý do tại sao nghề này hợp với sinh viên")
    missing_skills: List[str] = Field(..., description="Các kỹ năng sinh viên cần học thêm để làm nghề này")

class CareerRecommendationResponse(BaseModel):
    user_id: str
    top_careers: List[RecommendedCareer]
