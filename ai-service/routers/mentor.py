from fastapi import APIRouter
from models.mentor_models import MatchRequest, MentorMatchResponse, MatchResult

router = APIRouter(prefix="/api/ai/mentor", tags=["5. AI Mentor Matching"])

# Bảng tra cứu độ tương thích tính cách (MBTI Compatibility Matrix - Đơn giản hóa)
MBTI_COMPATIBILITY = {
    "INTJ": ["ENTP", "ENFP", "INTJ", "INTP"],
    "ENFP": ["INTJ", "INFJ"],
    # ... (Có thể mở rộng thêm)
}

@router.post("/match", response_model=MentorMatchResponse)
async def match_mentor(request: MatchRequest):
    matches = []
    
    for mentor in request.available_mentors:
        score = 0.0
        reasons = []

        # 1. Tiêu chí Kỹ năng (Trọng số 40%)
        # Đếm số kỹ năng mentor có trùng với kỹ năng sinh viên cần
        matched_skills = set(request.student_skills_needed).intersection(set(mentor.skills))
        skill_score = len(matched_skills) / max(1, len(request.student_skills_needed)) * 40
        score += skill_score
        if matched_skills:
            reasons.append(f"Khớp kỹ năng chuyên môn: {', '.join(matched_skills)}")

        # 2. Tiêu chí Tính cách (Trọng số 30%)
        mbti_score = 0
        if request.student_mbti == mentor.mbti:
            mbti_score = 30 # Cùng tính cách
        elif mentor.mbti in MBTI_COMPATIBILITY.get(request.student_mbti, []):
            mbti_score = 25 # Tính cách bổ trợ nhau
        else:
            mbti_score = 10 # Ít tương thích
        score += mbti_score
        reasons.append(f"Độ tương thích tính cách ({request.student_mbti} & {mentor.mbti}): Tốt")

        # 3. Tiêu chí Thời gian (Trọng số 30%)
        matched_days = set(request.preferred_days).intersection(set(mentor.available_days))
        time_score = len(matched_days) / max(1, len(request.preferred_days)) * 30
        score += time_score
        if matched_days:
            reasons.append(f"Trùng lịch rảnh: {', '.join(matched_days)}")

        matches.append(MatchResult(
            mentor_id=mentor.mentor_id,
            name=mentor.name,
            match_score=round(score, 1),
            match_reasons=reasons
        ))

    # Sắp xếp từ cao xuống thấp và lấy Top 3
    matches.sort(key=lambda x: x.match_score, reverse=True)
    top_3 = matches[:3]

    return MentorMatchResponse(
        student_id=request.student_id,
        top_matches=top_3
    )
