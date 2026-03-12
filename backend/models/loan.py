import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field
from enum import Enum
from sqlalchemy import Column, String, Index

class LoanStatus(str, Enum):
    ACTIVE = "active"
    RETURNED = "returned"
    OVERDUE = "overdue"

class Loan(SQLModel, table=True):
    __tablename__ = "loans"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    book_id: str = Field(foreign_key="books.id")
    user_id: str = Field(foreign_key="users.id")
    loan_date: datetime = Field(default_factory=datetime.utcnow)
    due_date: datetime
    return_date: Optional[datetime] = None
    status: LoanStatus = Field(default=LoanStatus.ACTIVE)

    # Added explicit indexes as per instructions
    __table_args__ = (
        Index("idx_loans_user", "user_id", "status"),
        Index("idx_loans_book", "book_id", "status"),
    )