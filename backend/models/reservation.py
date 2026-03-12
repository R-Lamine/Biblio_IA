import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field
from enum import Enum

class ReservationStatus(str, Enum):
    PENDING = "pending"
    FULFILLED = "fulfilled"
    CANCELLED = "cancelled"

class Reservation(SQLModel, table=True):
    __tablename__ = "reservations"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    book_id: str = Field(foreign_key="books.id")
    user_id: str = Field(foreign_key="users.id")
    reservation_date: datetime = Field(default_factory=datetime.utcnow)
    status: ReservationStatus = Field(default=ReservationStatus.PENDING)