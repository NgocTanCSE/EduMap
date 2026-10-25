from pydantic import BaseModel, Field, ConfigDict, AliasChoices
from typing import List, Optional

class MentorProfile(BaseModel):
    """Profile of a mentor candidate.

    ``populate_by_name`` + ``validation_alias`` allow the field to accept
    either ``mentor_id`` (canonical) or ``id`` (sent by the NestJS backend's
    ``mentor.service.ts``).  All fields beyond ``mentor_id`` / ``name`` are
    optional so that a minimal mentor payload (id + name + specialties) still
    validates — the backend only sends a subset of these fields.
    """
    model_config = ConfigDict(populate_by_name=True)

    mentor_id: str = Field(validation_alias=AliasChoices("mentor_id", "id"))
    name: str
    skills: List[str] = Field(default=[])
    mbti: str = Field(default="")
    available_days: List[str] = Field(default=[])

    # ── Extended fields (used by the pre-filter layer) ──────────────────────
    specialties: List[str] = Field(default=[])
    bio: Optional[str] = Field(default=None)
    location: Optional[str] = Field(default=None, description="Tỉnh/thành hoặc khu vực mentor hoạt động")
    experience_years: Optional[int] = Field(default=None)
    rating_avg: Optional[float] = Field(default=None)


class MatchRequest(BaseModel):
    """Request body for mentor matching.

    ``available_mentors`` is expected to be **pre-filtered** by the backend
    before being sent to the LLM.  The ``student_specialty`` / ``student_region``
    fields record which pre-filter criteria were applied so the LLM prompt can
    explain the narrowing to downstream consumers.
    """
    model_config = ConfigDict(populate_by_name=True)

    student_id: str
    student_skills_needed: List[str]
    student_mbti: str = Field(default="ENFP")
    preferred_days: List[str] = Field(default=[])

    available_mentors: List[MentorProfile]

    # ── Pre-filter metadata (added by mentor.service.ts getAIRecommendedMentors) ──
    student_region: Optional[str] = Field(
        default=None,
        description="Khu vực/quốc tỉ học sinh quan tâm — dùng để lọc mentor theo cự ly",
    )
    student_specialty: Optional[str] = Field(
        default=None,
        description="Chuyên ngành/môn học chính của sinh viên — lọc mentor theo chuyên môn",
    )
    max_mentors: int = Field(
        default=15,
        ge=1,
        le=50,
        description="Số mentor tối đa gửi vào prompt LLM (hard cap để tránh tràn token)",
    )


class MatchResult(BaseModel):
    mentor_id: str
    name: str
    match_score: float = Field(..., description="Điểm tương thích (0-100)")
    match_reasons: List[str] = Field(..., description="Lý do tại sao hợp")

class MentorMatchResponse(BaseModel):
    student_id: str
    top_matches: List[MatchResult]
