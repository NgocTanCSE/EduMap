from pydantic import BaseModel, Field
from typing import List, Optional

class MaterialSummaryRequest(BaseModel):
    title: str = Field(..., description="Title of the material")
    description: Optional[str] = Field(None, description="Description or abstract")
    category: Optional[str] = Field(None, description="Category of the material")
    tags: Optional[List[str]] = Field(default_factory=list, description="Tags associated with the material")
    type: Optional[str] = Field(None, description="Type of material (e.g., video, pdf, document)")

class KeyConcept(BaseModel):
    concept: str = Field(..., description="Name of the key concept")
    explanation: str = Field(..., description="Brief explanation of the concept")

class MaterialSummaryResponse(BaseModel):
    summary: str = Field(..., description="A concise summary of the material based on metadata")
    key_concepts: List[KeyConcept] = Field(..., description="List of key concepts covered in the material")
    study_tips: List[str] = Field(..., description="Actionable study tips or next steps based on the material")
