import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from datetime import datetime, timedelta
import logging

from backend.core.database import get_session, engine
from backend.models.loan import Loan, LoanStatus
from backend.models.user import User

logger = logging.getLogger(__name__)

async def check_overdue_loans():
    async with AsyncSession(engine) as session:
        try:
            # 1. UPDATE loans SET status='overdue' WHERE due_date < NOW() AND status='active'
            now = datetime.utcnow()
            statement = select(Loan).where(Loan.status == LoanStatus.ACTIVE, Loan.due_date < now)
            result = await session.execute(statement)
            active_overdue_loans = result.scalars().all()
            
            for loan in active_overdue_loans:
                loan.status = LoanStatus.OVERDUE
                session.add(loan)
                
            await session.commit()
            
            # 2. SELECT DISTINCT user_id FROM loans WHERE status='overdue' AND due_date < NOW() - INTERVAL 15 DAY
            fifteen_days_ago = now - timedelta(days=15)
            overdue_stmt = select(Loan.user_id).where(
                Loan.status == LoanStatus.OVERDUE,
                Loan.due_date < fifteen_days_ago
            ).distinct()
            
            overdue_result = await session.execute(overdue_stmt)
            user_ids_to_block = [row for row in overdue_result.scalars().all()]
            
            # 3. UPDATE users SET est_bloque=TRUE WHERE id IN (...)
            if user_ids_to_block:
                users_stmt = select(User).where(User.id.in_(user_ids_to_block), User.est_bloque == False)
                users_result = await session.execute(users_stmt)
                users_to_block = users_result.scalars().all()
                
                for user in users_to_block:
                    user.est_bloque = True
                    session.add(user)
                    
                await session.commit()
                logger.info(f"Blocked {len(users_to_block)} users due to long overdue loans.")
                
        except Exception as e:
            logger.error(f"Error in overdue checker task: {e}")