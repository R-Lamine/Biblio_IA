from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class LoanCreate(BaseModel):
    book_id: str

class LoanResponse(BaseModel):
    id: str
    book_id: str
    user_id: str
    loan_date: datetime
    due_date: datetime
    return_date: Optional[datetime] = None
    status: str