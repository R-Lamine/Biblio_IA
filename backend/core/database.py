import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel
from backend.core.config import settings

# Import all models so SQLModel.metadata knows about them before create_all
from backend.models.user import User  # noqa
from backend.models.book import Book  # noqa
from backend.models.loan import Loan  # noqa
from backend.models.reservation import Reservation  # noqa
from backend.models.ai_analysis import AIAnalysis  # noqa

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True
)

async def init_db():
    retries = 5
    while retries > 0:
        try:
            async with engine.begin() as conn:
                await conn.run_sync(SQLModel.metadata.create_all)
            print("Database initialized successfully.")
            break
        except Exception as e:
            print(f"Database connection failed: {e}. Retrying in 5 seconds... ({retries} left)")
            retries -= 1
            await asyncio.sleep(5)
    if retries == 0:
        raise Exception("Could not connect to the database after multiple retries.")

async def get_session() -> AsyncSession:
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    async with async_session() as session:
        yield session