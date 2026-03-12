import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from datetime import datetime, timedelta
import traceback

from backend.core.database import engine
from backend.models.user import User, UserRole
from backend.core.security import hash_password
from backend.models.book import Book
from backend.models.loan import Loan, LoanStatus
from backend.models.reservation import Reservation, ReservationStatus

async def seed():
    async with AsyncSession(engine) as session:
        try:
            # 1. Create or reuse users
            user_result = await session.execute(select(User).where(User.username == "admin"))
            admin = user_result.scalars().first()
            if not admin:
                admin = User(
                    username="admin",
                    email="bibliothecaire@biblioia.fr",
                    password_hash=hash_password("admin123"),
                    role=UserRole.BIBLIOTHECAIRE
                )
                session.add(admin)
            else:
                admin.est_bloque = False

            user_result = await session.execute(select(User).where(User.username == "adherent"))
            adherent = user_result.scalars().first()
            if not adherent:
                adherent = User(
                    username="adherent",
                    email="adherent@biblioia.fr",
                    password_hash=hash_password("adherent123"),
                    role=UserRole.ADHERENT
                )
                session.add(adherent)
            else:
                adherent.est_bloque = False

            await session.flush()

            # Only skip catalog creation when books already exist, but still keep demo accounts valid.
            statement = select(Book)
            result = await session.execute(statement)
            if result.scalars().first():
                await session.commit()
                print("Database already seeded. Demo users refreshed.")
                return

            print("Starting seed process...")

            # 2. Create books
            books_data = [
                {"title": "Le Nom du Vent", "author": "Patrick Rothfuss", "category": "SF/Fantastique", "isbn": "978-2266258", "year": 2007},
                {"title": "Germinal", "author": "Émile Zola", "category": "Classique", "isbn": "978-2070409", "year": 1885},
                {"title": "Sapiens", "author": "Yuval Noah Harari", "category": "Histoire", "isbn": "978-2226257", "year": 2015},
                {"title": "L'Étranger", "author": "Albert Camus", "category": "Classique", "isbn": "978-2070360", "year": 1942},
                {"title": "1984", "author": "George Orwell", "category": "Dystopie", "isbn": "978-2070368", "year": 1949},
                {"title": "Le Petit Prince", "author": "Antoine de Saint-Exupéry", "category": "Jeunesse", "isbn": "978-2070612", "year": 1943},
                {"title": "Dune", "author": "Frank Herbert", "category": "SF/Fantastique", "isbn": "978-2266320", "year": 1965},
                {"title": "Le Comte de Monte-Cristo", "author": "Alexandre Dumas", "category": "Classique", "isbn": "978-2070405", "year": 1846},
                {"title": "Thinking, Fast and Slow", "author": "Daniel Kahneman", "category": "Psychologie", "isbn": "978-2081211", "year": 2011},
                {"title": "Le Meilleur des mondes", "author": "Aldous Huxley", "category": "Dystopie", "isbn": "978-2266283", "year": 1932},
                {"title": "Sherlock Holmes", "author": "Arthur Conan Doyle", "category": "Policier", "isbn": "978-2070408", "year": 1892},
                {"title": "Orgueil et Préjugés", "author": "Jane Austen", "category": "Romance", "isbn": "978-2070413", "year": 1813},
                {"title": "Steve Jobs", "author": "Walter Isaacson", "category": "Biographie", "isbn": "978-2709638", "year": 2011},
                {"title": "Les Misérables", "author": "Victor Hugo", "category": "Classique", "isbn": "978-20704091", "year": 1862},
                {"title": "Fahrenheit 451", "author": "Ray Bradbury", "category": "Dystopie", "isbn": "978-2070415", "year": 1953},
                {"title": "La Nuit des temps", "author": "René Barjavel", "category": "SF/Fantastique", "isbn": "978-2266025", "year": 1968},
                {"title": "L'Art de la guerre", "author": "Sun Tzu", "category": "Histoire", "isbn": "978-2080700", "year": -500},
                {"title": "Le Parfum", "author": "Patrick Süskind", "category": "Policier", "isbn": "978-2253044", "year": 1985},
                {"title": "Madame Bovary", "author": "Gustave Flaubert", "category": "Classique", "isbn": "978-20704131", "year": 1857},
                {"title": "La Vague", "author": "Todd Strasser", "category": "Psychologie", "isbn": "978-2266186", "year": 1981},
            ]

            db_books = []
            for i, b in enumerate(books_data):
                book = Book(
                    title=b["title"],
                    author=b["author"],
                    category=b["category"],
                    isbn=b["isbn"],
                    publication_year=b["year"],
                    resume_ia=f"Ceci est un résumé généré automatiquement pour le livre {b['title']}. Il explore des thèmes profonds.",
                    shelf_row=f"R. {i%5 + 1}",
                    shelf_number=chr(65 + i%3),
                    quantity_total=2,
                    quantity_available=2
                )
                session.add(book)
                db_books.append(book)

            await session.flush()

            # 3. Create Loans
            now = datetime.utcnow()
            loan1 = Loan(book_id=db_books[0].id, user_id=adherent.id, due_date=now + timedelta(days=10))
            loan2 = Loan(book_id=db_books[1].id, user_id=adherent.id, due_date=now + timedelta(days=5))
            db_books[0].quantity_available -= 1
            db_books[1].quantity_available -= 1

            loan3 = Loan(book_id=db_books[2].id, user_id=adherent.id, due_date=now - timedelta(days=5), status=LoanStatus.RETURNED, return_date=now - timedelta(days=2))
            loan4 = Loan(book_id=db_books[3].id, user_id=adherent.id, due_date=now - timedelta(days=10), status=LoanStatus.RETURNED, return_date=now - timedelta(days=8))
            loan5 = Loan(book_id=db_books[4].id, user_id=adherent.id, due_date=now - timedelta(days=10), status=LoanStatus.OVERDUE)
            db_books[4].quantity_available -= 1

            session.add_all([loan1, loan2, loan3, loan4, loan5])

            # 4. Create Reservations
            res1 = Reservation(book_id=db_books[5].id, user_id=adherent.id, status=ReservationStatus.PENDING)
            res2 = Reservation(book_id=db_books[6].id, user_id=adherent.id, status=ReservationStatus.FULFILLED)
            session.add_all([res1, res2])

            await session.commit()
            print("Seed complete: 2 users, 20 books, 5 loans, 2 reservations")
        except Exception:
            await session.rollback()
            traceback.print_exc()
            raise

if __name__ == "__main__":
    from backend.core.database import init_db
    async def run():
        await init_db()
        await seed()
    asyncio.run(run())