import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, JSON

class AIAnalysis(SQLModel, table=True):
    __tablename__ = "ai_analyses"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    analysis_type: str = Field(index=True)
    input_data: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    output_data: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)