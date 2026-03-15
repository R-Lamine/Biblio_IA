from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

class SearchQuery(BaseModel):
    query: str

class BookSummaryRequest(BaseModel):
    title: str
    author: str

class SummaryResponse(BaseModel):
    summary: str

class StockAnalysisResponse(BaseModel):
    analysis: str
    generated_at: datetime

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []

class ChatResponse(BaseModel):
    response: str