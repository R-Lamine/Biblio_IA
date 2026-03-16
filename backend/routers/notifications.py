from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from typing import List
from pydantic import BaseModel

from backend.core.database import get_session
from backend.core.security import require_role
from backend.models.book import Book
from backend.models.user import User

router = APIRouter(prefix="/notifications", tags=["notifications"])

class StockNotification(BaseModel):
    book_id: str
    title: str
    quantity_available: int
    level: str  # "CRITICAL" or "WARNING"

@router.get("/stock", response_model=List[StockNotification])
async def get_stock_notifications(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("bibliothecaire"))
):
    # Fetch books with quantity_available <= 1
    statement = select(Book).where(Book.quantity_available <= 1)
    result = await session.execute(statement)
    books = result.scalars().all()
    
    notifications = []
    for book in books:
        level = "CRITICAL" if book.quantity_available == 0 else "WARNING"
        notifications.append(StockNotification(
            book_id=book.id,
            title=book.title,
            quantity_available=book.quantity_available,
            level=level
        ))
    
    return notifications
