from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from typing import List

from backend.core.database import get_session
from backend.core.security import get_current_user
from backend.models.reservation import Reservation, ReservationStatus
from backend.models.book import Book
from backend.models.user import User

router = APIRouter(prefix="/reservations", tags=["reservations"])

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_reservation(
    book_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    statement = select(Book).where(Book.id == book_id)
    result = await session.execute(statement)
    book = result.scalars().first()
    
    if not book:
        raise HTTPException(status_code=404, detail="Livre non trouvé")
        
    if book.quantity_available > 0:
        raise HTTPException(status_code=400, detail="Le livre est disponible, vous pouvez l'emprunter directement")
        
    # Check if already reserved
    res_stmt = select(Reservation).where(
        Reservation.book_id == book_id,
        Reservation.user_id == current_user.id,
        Reservation.status == ReservationStatus.PENDING
    )
    res_result = await session.execute(res_stmt)
    if res_result.scalars().first():
        raise HTTPException(status_code=400, detail="Vous avez déjà réservé ce livre")
        
    reservation = Reservation(book_id=book_id, user_id=current_user.id)
    session.add(reservation)
    await session.commit()
    await session.refresh(reservation)
    return reservation

@router.get("/my")
async def my_reservations(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    statement = select(Reservation).where(Reservation.user_id == current_user.id).order_by(Reservation.reservation_date.desc())
    result = await session.execute(statement)
    return result.scalars().all()

@router.delete("/{reservation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_reservation(
    reservation_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    statement = select(Reservation).where(Reservation.id == reservation_id, Reservation.user_id == current_user.id)
    result = await session.execute(statement)
    reservation = result.scalars().first()
    
    if not reservation:
        raise HTTPException(status_code=404, detail="Réservation non trouvée")
        
    reservation.status = ReservationStatus.CANCELLED
    session.add(reservation)
    await session.commit()
    return None