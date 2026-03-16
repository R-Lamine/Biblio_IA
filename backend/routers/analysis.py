from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func
from datetime import datetime, timedelta
from typing import List

from backend.core.database import get_session
from backend.core.security import require_role
from backend.models.loan import Loan
from backend.models.book import Book
from backend.models.user import User
from backend.schemas.analysis import ManualAnalysisResponse, BookAnalysisInfo

router = APIRouter(prefix="/analysis", tags=["analysis"])

@router.get("/manual", response_model=ManualAnalysisResponse)
async def manual_analysis(
    period: int = Query(6, description="Période en mois"),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("bibliothecaire"))
):
    start_date = datetime.utcnow() - timedelta(days=period * 30)
    
    # Get all books to calculate stats
    all_books_stmt = select(Book)
    all_books_result = await session.execute(all_books_stmt)
    all_books = all_books_result.scalars().all()
    total_books = len(all_books)
    
    if total_books == 0:
        return ManualAnalysisResponse(
            period_months=period,
            top_borrowed=[],
            average_borrows=0.0,
            out_of_stock=[],
            rarely_borrowed=[],
            never_borrowed=[],
            total_books=0,
            total_loans_in_period=0
        )

    # Get loan counts per book in the period
    # We join with Loan to count, but we need to consider the date
    loan_counts_stmt = select(
        Loan.book_id, 
        func.count(Loan.id).label("borrow_count")
    ).where(
        Loan.loan_date >= start_date
    ).group_by(
        Loan.book_id
    )
    loan_counts_result = await session.execute(loan_counts_stmt)
    loan_counts_map = {row[0]: row[1] for row in loan_counts_result.all()}
    
    total_loans_in_period = sum(loan_counts_map.values())
    average_borrows = total_loans_in_period / total_books
    
    # Build list of books with borrow counts
    books_with_counts = []
    for book in all_books:
        count = loan_counts_map.get(book.id, 0)
        books_with_counts.append(BookAnalysisInfo(
            id=book.id,
            title=book.title,
            author=book.author,
            quantity_available=book.quantity_available,
            quantity_total=book.quantity_total,
            borrow_count=count
        ))
        
    # Sort for top borrowed (only if borrow_count > 0)
    top_borrowed = sorted([b for b in books_with_counts if b.borrow_count > 0], key=lambda x: x.borrow_count, reverse=True)[:5]
    
    # Filters
    out_of_stock = [b for b in books_with_counts if b.quantity_available == 0]
    rarely_borrowed = [b for b in books_with_counts if 0 < b.borrow_count < 2]
    never_borrowed = [b for b in books_with_counts if b.borrow_count == 0]
    
    return ManualAnalysisResponse(
        period_months=period,
        top_borrowed=top_borrowed,
        average_borrows=round(average_borrows, 2),
        out_of_stock=out_of_stock,
        rarely_borrowed=rarely_borrowed,
        never_borrowed=never_borrowed,
        total_books=total_books,
        total_loans_in_period=total_loans_in_period
    )
