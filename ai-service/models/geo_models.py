from pydantic import BaseModel
from typing import List

class Point(BaseModel):
    name: str
    type: str
    lat: float
    lng: float

class GeoDensityAnalysisRequest(BaseModel):
    city: str
    points: List[Point]
