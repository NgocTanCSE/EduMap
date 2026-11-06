from pydantic import BaseModel, Field
from typing import List, Optional


class Point(BaseModel):
    name: str
    type: str
    lat: float
    lng: float


class VisionDetectRequest(BaseModel):
    """Request body for POST /api/ai/geo/vision-detect.
    image_base64 — PNG/JPEG image (may be data-uri prefixed; prefix is stripped).
    labels       — optional candidate labels for zero-shot detection.
    """
    image_base64: str
    labels: Optional[List[str]] = Field(default=None)


class GeoDensityAnalysisRequest(BaseModel):



    city: Optional[str] = "Unknown"
    points: List[dict] = Field(default_factory=list)
