from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import httpx

from backend.core.config import settings
from backend.core.database import init_db
from backend.routers import auth, books, loans, reservations, members, ai, analysis, notifications, analysis_ai, category_ai
from backend.tasks.overdue_checker import check_overdue_loans
from backend.seed.seed_data import seed
from backend.models import user as _user_model, book as _book_model, loan as _loan_model, reservation as _reservation_model, ai_analysis as _ai_analysis_model


async def ensure_ollama_model_ready() -> None:
    """Ensure configured Ollama model exists; pull it automatically once if missing."""
    if not settings.OLLAMA_AUTO_PULL:
        return

    model_name = settings.OLLAMA_MODEL
    tags_url = f"{settings.OLLAMA_URL}/api/tags"
    pull_url = f"{settings.OLLAMA_URL}/api/pull"

    # Retry briefly while Ollama container becomes reachable.
    for attempt in range(1, 7):
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=5.0)) as client:
                tags_response = await client.get(tags_url)
                tags_response.raise_for_status()
                tags_payload = tags_response.json()

            available = {m.get("name", "") for m in tags_payload.get("models", [])}
            if model_name in available:
                print(f"Ollama model already available: {model_name}")
                return

            print(f"Ollama model missing, pulling: {model_name}")
            async with httpx.AsyncClient(timeout=httpx.Timeout(1800.0, connect=10.0)) as client:
                pull_response = await client.post(pull_url, json={"name": model_name, "stream": False})
                pull_response.raise_for_status()

            print(f"Ollama model pulled successfully: {model_name}")
            return
        except Exception as exc:
            if attempt == 6:
                print(f"Ollama auto-pull skipped after retries: {exc}")
                return
            await asyncio.sleep(3)

async def periodic_overdue_check():
    while True:
        await check_overdue_loans()
        await asyncio.sleep(3600)  # Toutes les heures

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables
    await init_db()

    # Ensure model exists in Ollama on first startup.
    await ensure_ollama_model_ready()

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
app.include_router(category_ai.router, prefix="/api")

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "version": settings.VERSION}