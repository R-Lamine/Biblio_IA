import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, TEXT

class Book(SQLModel, table=True):
    __tablename__ = "books"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    title: str = Field(index=True)
    author: str = Field(index=True)
    isbn: Optional[str] = Field(default=None, unique=True, index=True)
    publication_year: Optional[int] = None
    category: Optional[str] = Field(default=None, index=True)
    resume_ia: Optional[str] = Field(default=None, sa_column=Column(TEXT))
    cover_image_url: Optional[str] = None
    shelf_row: Optional[str] = None
    shelf_number: Optional[str] = None
    quantity_total: int = Field(default=1)
    quantity_available: int = Field(default=1)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow, sa_column_kwargs={"onupdate": datetime.utcnow})