from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, or_
from typing import List, Optional

from backend.core.database import get_session
from backend.core.security import get_current_user, require_role
from backend.models.book import Book
from backend.models.user import User
from backend.schemas.book import BookCreate, BookUpdate

router = APIRouter(prefix="/books", tags=["books"])

@router.get("/", response_model=List[Book])
async def list_books(
    search: Optional[str] = None,
    category: Optional[str] = None,
    available: Optional[bool] = None,
    session: AsyncSession = Depends(get_session)
):
    statement = select(Book)
    
    if search:
        search_filter = or_(
            Book.title.icontains(search),
            Book.author.icontains(search),
            Book.isbn.icontains(search)
        )
        statement = statement.where(search_filter)
        
    if category:
        statement = statement.where(Book.category == category)
        
    if available is not None:
        if available:
            statement = statement.where(Book.quantity_available > 0)
        else:
            statement = statement.where(Book.quantity_available == 0)
            
    result = await session.execute(statement)
    return result.scalars().all()

@router.get("/{book_id}", response_model=Book)
async def get_book(book_id: str, session: AsyncSession = Depends(get_session)):
    statement = select(Book).where(Book.id == book_id)
    result = await session.execute(statement)
    book = result.scalars().first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book

@router.post("/", response_model=Book, status_code=status.HTTP_201_CREATED)
async def create_book(
    book_in: BookCreate, 
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("bibliothecaire"))
):
    book = Book(**book_in.dict())
    book.quantity_available = book.quantity_total
    session.add(book)
    await session.commit()
    await session.refresh(book)
    return book

@router.put("/{book_id}", response_model=Book)
async def update_book(
    book_id: str, 
    book_in: BookUpdate, 
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("bibliothecaire"))
):
    statement = select(Book).where(Book.id == book_id)
    result = await session.execute(statement)
    book = result.scalars().first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
        
    update_data = book_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(book, key, value)
        
    session.add(book)
    await session.commit()
    await session.refresh(book)
    return book

@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_book(
    book_id: str, 
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("bibliothecaire"))
):
    statement = select(Book).where(Book.id == book_id)
    result = await session.execute(statement)
    book = result.scalars().first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
        
    # Soft delete
    book.quantity_total = 0
    book.quantity_available = 0
    session.add(book)
    await session.commit()
    return None