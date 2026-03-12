from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func
from typing import List

from backend.core.database import get_session
from backend.core.security import require_role
from backend.models.user import User
from backend.models.loan import Loan, LoanStatus

router = APIRouter(prefix="/members", tags=["members"])

@router.get("/")
async def list_members(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("bibliothecaire"))
):
    statement = select(User).where(User.role == "adherent")
    result = await session.execute(statement)
    users = result.scalars().all()
    
    # Enrich with active loans count
    response = []
    for user in users:
        loan_stmt = select(func.count(Loan.id)).where(
            Loan.user_id == user.id, 
            Loan.status != LoanStatus.RETURNED
        )
        loan_result = await session.execute(loan_stmt)
        active_loans = loan_result.scalar() or 0
        
        user_dict = user.dict()
        user_dict["active_loans"] = active_loans
        response.append(user_dict)
        
    return response

@router.get("/{user_id}")
async def get_member(
    user_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("bibliothecaire"))
):
    statement = select(User).where(User.id == user_id)
    result = await session.execute(statement)
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
        
    loan_stmt = select(Loan).where(Loan.user_id == user.id).order_by(Loan.loan_date.desc())
    loan_result = await session.execute(loan_stmt)
    loans = loan_result.scalars().all()
    
    return {
        "user": user,
        "loans": loans
    }

@router.put("/{user_id}/unblock")
async def unblock_member(
    user_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("bibliothecaire"))
):
    statement = select(User).where(User.id == user_id)
    result = await session.execute(statement)
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
        
    user.est_bloque = False
    session.add(user)
    await session.commit()
    return {"message": "Utilisateur débloqué"}