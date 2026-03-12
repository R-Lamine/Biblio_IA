from pydantic import BaseModel
from typing import Optional

class BookCreate(BaseModel):
    title: str
    author: str
    isbn: Optional[str] = None
    publication_year: Optional[int] = None
    category: Optional[str] = None
    cover_image_url: Optional[str] = None
    shelf_row: Optional[str] = None
    shelf_number: Optional[str] = None
    quantity_total: int = 1

class BookUpdate(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    isbn: Optional[str] = None
    publication_year: Optional[int] = None
    category: Optional[str] = None
    cover_image_url: Optional[str] = None
    shelf_row: Optional[str] = None
    shelf_number: Optional[str] = None
    quantity_total: Optional[int] = None