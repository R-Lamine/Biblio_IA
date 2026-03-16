from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio

from backend.core.config import settings
from backend.core.database import init_db
from backend.routers import auth, books, loans, reservations, members, ai, analysis, notifications, analysis_ai
from backend.tasks.overdue_checker import check_overdue_loans
from backend.seed.seed_data import seed
from backend.models import user as _user_model, book as _book_model, loan as _loan_model, reservation as _reservation_model, ai_analysis as _ai_analysis_model

async def periodic_overdue_check():
    while True:
        await check_overdue_loans()
        await asyncio.sleep(3600)  # Toutes les heures

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables
    await init_db()
    # Seed initial data without blocking app startup forever on partial failures
    try:
        await seed()
    except Exception as exc:
        print(f"Seed failed: {exc}")
    
    # Start background tasks
    task = asyncio.create_task(periodic_overdue_check())
    
    yield
    
    # Cleanup
    task.cancel()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:80", "http://localhost"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(books.router, prefix="/api")
app.include_router(loans.router, prefix="/api")
app.include_router(reservations.router, prefix="/api")
app.include_router(members.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(analysis.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(analysis_ai.router, prefix="/api")

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "version": settings.VERSION}