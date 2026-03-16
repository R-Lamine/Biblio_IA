from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

class BookAnalysisInfo(BaseModel):
    id: str
    title: str
    author: str
    quantity_available: int
    quantity_total: int
    borrow_count: int

class ManualAnalysisResponse(BaseModel):
    period_months: int
    top_borrowed: List[BookAnalysisInfo]
    average_borrows: float
    out_of_stock: List[BookAnalysisInfo]
    rarely_borrowed: List[BookAnalysisInfo]
    never_borrowed: List[BookAnalysisInfo]
    total_books: int
    total_loans_in_period: int
