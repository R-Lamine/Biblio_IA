from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from datetime import datetime, timedelta
from typing import List, Optional

from backend.core.database import get_session
from backend.core.security import get_current_user, require_role
from backend.models.loan import Loan, LoanStatus
from backend.models.book import Book
from backend.models.user import User
from backend.models.reservation import Reservation, ReservationStatus
from backend.schemas.loan import LoanResponse

router = APIRouter(prefix="/loans", tags=["loans"])

@router.post("/", response_model=LoanResponse, status_code=status.HTTP_201_CREATED)
async def create_loan(
    book_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.est_bloque:
        raise HTTPException(status_code=403, detail="Votre compte est bloqué")
        
    statement = select(Book).where(Book.id == book_id)
    result = await session.execute(statement)
    book = result.scalars().first()
    
    if not book:
        raise HTTPException(status_code=404, detail="Livre non trouvé")
        
    if book.quantity_available <= 0:
        raise HTTPException(status_code=400, detail="Livre indisponible")
        
    due_date = datetime.utcnow() + timedelta(days=14)
    loan = Loan(book_id=book_id, user_id=current_user.id, due_date=due_date)
    book.quantity_available -= 1
    
    session.add(loan)
    session.add(book)
    await session.commit()
    await session.refresh(loan)
    return loan

@router.get("/my", response_model=List[LoanResponse])
async def my_loans(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    statement = select(Loan).where(Loan.user_id == current_user.id).order_by(Loan.loan_date.desc())
    result = await session.execute(statement)
    return result.scalars().all()

@router.get("/", response_model=List[LoanResponse])
async def list_loans(
    status_filter: Optional[LoanStatus] = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("bibliothecaire"))
):
    statement = select(Loan)
    if status_filter:
        statement = statement.where(Loan.status == status_filter)
    result = await session.execute(statement)
    return result.scalars().all()

@router.put("/{loan_id}/return", response_model=LoanResponse)
async def return_loan(
    loan_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("bibliothecaire"))
):
    statement = select(Loan).where(Loan.id == loan_id)
    result = await session.execute(statement)
    loan = result.scalars().first()
    
    if not loan:
        raise HTTPException(status_code=404, detail="Prêt non trouvé")
        
    if loan.status == LoanStatus.RETURNED:
        raise HTTPException(status_code=400, detail="Livre déjà retourné")
        
    loan.status = LoanStatus.RETURNED
    loan.return_date = datetime.utcnow()
    
    statement = select(Book).where(Book.id == loan.book_id)
    result = await session.execute(statement)
    book = result.scalars().first()
    
    if book:
        book.quantity_available += 1
        session.add(book)
        
        # Check reservations
        res_stmt = select(Reservation).where(
            Reservation.book_id == book.id,
            Reservation.status == ReservationStatus.PENDING
        ).order_by(Reservation.reservation_date.asc())
        res_result = await session.execute(res_stmt)
        pending_reservation = res_result.scalars().first()
        
        if pending_reservation:
            pending_reservation.status = ReservationStatus.FULFILLED
            session.add(pending_reservation)
            # In a real app, we'd notify the user here.
            
    session.add(loan)
    await session.commit()
    await session.refresh(loan)
    return loan