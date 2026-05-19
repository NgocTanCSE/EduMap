from pydantic import BaseModel, Field
from typing import List

class LearningPathRequest(BaseModel):
    user_id: str
    current_level: str = Field(..., description="Trình độ hiện tại (VD: Beginner, Intermediate)")
    target_role: str = Field(..., description="Mục tiêu nghề nghiệp (VD: Data Scientist)")
    time_commitment_hours_per_week: int = Field(..., description="Số giờ có thể học mỗi tuần")

class PathStep(BaseModel):
    step_number: int
    title: str = Field(..., description="Tên môn học / Kỹ năng cần học")
    estimated_weeks: int = Field(..., description="Thời gian dự kiến (tuần)")
    description: str

class LearningPathResponse(BaseModel):
    target_role: str
    total_estimated_months: float
    steps: List[PathStep]
