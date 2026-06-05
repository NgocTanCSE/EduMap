from pydantic import BaseModel, Field
from typing import List, Optional

# --- CẤU TRÚC ĐẦU VÀO (INPUT) ---
class ChatMessage(BaseModel):
    role: str = Field(..., description="'user' hoặc 'model'")
    content: str = Field(..., description="Nội dung tin nhắn")

class ChatRequest(BaseModel):
    user_id: str = Field(..., description="ID của sinh viên đang chat")
    message: str = Field(..., description="Câu hỏi mới nhất")
    history: List[ChatMessage] = Field(default_factory=list, description="Lịch sử trò chuyện trước đó")

# --- CẤU TRÚC ĐẦU RA (OUTPUT) ---
class SourceDocument(BaseModel):
    doc_id: str = Field(..., description="ID tài liệu")
    title: str = Field(..., description="Tên tài liệu trích dẫn")
    snippet: str = Field(..., description="Đoạn văn bản gốc được AI sử dụng")

class ChatResponse(BaseModel):
    reply: str = Field(..., description="Câu trả lời của AI")
    sources: List[SourceDocument] = Field(default_factory=list, description="Danh sách tài liệu tham khảo")
