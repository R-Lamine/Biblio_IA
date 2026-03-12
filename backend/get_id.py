import asyncio
from backend.core.database import engine
from backend.models.book import Book
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession

async def get_id():
    async with AsyncSession(engine) as s:
        r = await s.execute(select(Book))
        books = r.scalars().all()
        if books:
            print(f"BOOK_ID:{books[0].id}")
        else:
            print("NO_BOOKS_FOUND")

if __name__ == "__main__":
    asyncio.run(get_id())
