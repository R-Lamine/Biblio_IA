from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func
from datetime import datetime, timedelta

from backend.core.database import get_session
from backend.core.security import get_current_user, require_role
from backend.models.book import Book
from backend.models.user import User
from backend.models.loan import Loan
from backend.models.ai_analysis import AIAnalysis
from backend.schemas.ai import SearchQuery, SummaryResponse, StockAnalysisResponse, ChatRequest, ChatResponse, BookSummaryRequest
from backend.services.llm_service import llm_service
from backend.services.queue_service import queue_service

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/chat/stream")
async def chat_stream(
    request: ChatRequest,
    session: AsyncSession = Depends(get_session),          # <-- AJOUT : accès BDD
    current_user: User = Depends(get_current_user)
):
    history = [{"role": m.role, "content": m.content} for m in (request.history or [])]

    # Charger le catalogue complet pour que l'IA puisse citer les livres
    result = await session.execute(select(Book))
    books = result.scalars().all()
    catalog = [
        {
            "id": b.id,
            "title": b.title,
            "author": b.author,
            "category": b.category,
            "resume_ia": b.resume_ia
        }
        for b in books
    ]

    async def generate():
        async for chunk in llm_service.stream_chat(request.message, history, catalog=catalog):
            yield chunk

    return StreamingResponse(generate(), media_type="text/plain")


@router.post("/generate-summary", response_model=SummaryResponse)
async def generate_pre_summary(
    request: BookSummaryRequest,
    current_user: User = Depends(require_role("bibliothecaire"))
):
    try:
        summary = await queue_service.enqueue_llm_task(
            llm_service.generate_book_summary,
            request.title,
            request.author
        )
        return {"summary": summary}
    except TimeoutError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Service IA indisponible")


@router.post("/summary/{book_id}", response_model=SummaryResponse)
async def generate_summary(
    book_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("bibliothecaire"))
):
    statement = select(Book).where(Book.id == book_id)
    result = await session.execute(statement)
    book = result.scalars().first()

    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    try:
        summary = await queue_service.enqueue_llm_task(
            llm_service.generate_book_summary,
            book.title,
            book.author
        )
        book.resume_ia = summary
        session.add(book)

        analysis = AIAnalysis(
            analysis_type="book_summary",
            input_data={"book_id": book.id, "title": book.title},
            output_data={"summary": summary}
        )
        session.add(analysis)
        await session.commit()
        return {"summary": summary}
    except TimeoutError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Service IA indisponible")


@router.post("/search")
async def ai_search(
    query: SearchQuery,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    statement = select(Book)
    result = await session.execute(statement)
    books = result.scalars().all()

    catalog = [
        {
            "id": b.id,
            "title": b.title,
            "author": b.author,
            "category": b.category,
            "resume_ia": b.resume_ia
        }
        for b in books
    ]

    try:
        book_ids = await queue_service.enqueue_llm_task(
            llm_service.natural_language_search,
            query.query,
            catalog
        )

        results = []
        for bid in book_ids:
            for b in books:
                if b.id == bid:
                    results.append(b)
                    break

        analysis = AIAnalysis(
            analysis_type="natural_search",
            input_data={"query": query.query},
            output_data={"results_count": len(results), "result_ids": book_ids}
        )
        session.add(analysis)
        await session.commit()

        return results
    except TimeoutError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Service IA indisponible")


@router.get("/stock-analysis", response_model=StockAnalysisResponse)
async def stock_analysis(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("bibliothecaire"))
):
    try:
        six_months_ago = datetime.utcnow() - timedelta(days=180)

        stmt = select(Loan.book_id, func.count(Loan.id).label("loan_count")) \
            .where(Loan.loan_date >= six_months_ago) \
            .group_by(Loan.book_id)
        result = await session.execute(stmt)
        loan_counts = {row.book_id: row.loan_count for row in result.all()}

        books_stmt = select(Book)
        books_result = await session.execute(books_stmt)
        books = books_result.scalars().all()

        high_rotation = []
        dormant_books = []
        twelve_months_ago = datetime.utcnow() - timedelta(days=365)

        for book in books:
            count = loan_counts.get(book.id, 0)
            if book.quantity_total > 0:
                rotation_rate = count / book.quantity_total
                if rotation_rate > 0.9:
                    high_rotation.append({"title": book.title, "rotation_rate": round(rotation_rate, 2)})

            dormant_stmt = select(func.count(Loan.id)).where(
                Loan.book_id == book.id,
                Loan.loan_date >= twelve_months_ago
            )
            dormant_res = await session.execute(dormant_stmt)
            if dormant_res.scalar() == 0:
                dormant_books.append(book.title)

        stats = {
            "period": "6 derniers mois",
            "total_loans_6_months": sum(loan_counts.values()),
            "high_rotation_books": high_rotation,
            "dormant_books": dormant_books
        }

        analysis_text = await queue_service.enqueue_llm_task(llm_service.analyze_stock, stats)

        analysis = AIAnalysis(
            analysis_type="stock_analysis",
            input_data=stats,
            output_data={"analysis": analysis_text}
        )
        session.add(analysis)
        await session.commit()

        return {"analysis": analysis_text, "generated_at": datetime.utcnow()}
    except TimeoutError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Service IA indisponible")


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user)
):
    try:
        history = [{"role": m.role, "content": m.content} for m in (request.history or [])]
        response_text = await queue_service.enqueue_llm_task(
            llm_service.chat,
            request.message,
            history
        )
        return {"response": response_text}
    except TimeoutError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Service IA indisponible")