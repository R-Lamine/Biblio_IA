import asyncio
import re
import unicodedata
from typing import List, Optional

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from backend.core.database import get_session
from backend.core.security import require_role
from backend.models.book import Book
from backend.models.user import User
from backend.schemas.analysis import ManualAnalysisResponse

router = APIRouter(prefix="/analysis/ai", tags=["analysis_ai"])


class ChatMessage(BaseModel):
    role: str
    content: str


class AIAnalysisRequest(BaseModel):
    stock_data: ManualAnalysisResponse
    question: str
    history: List[ChatMessage] = []


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text or "")
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", text.lower()).strip()


def _book_name(book: Book) -> str:
    return f"{book.title} ({book.author})"


def _dedupe_titles_by_id(books) -> List[str]:
    seen = set()
    titles = []
    for b in books:
        if b.id in seen:
            continue
        seen.add(b.id)
        titles.append(b.title)
    return titles


def _format_title_list(titles: List[str]) -> str:
    if not titles:
        return "Aucun"
    return ", ".join(titles)


def _extract_book_from_text(text: str, catalog: List[Book]) -> Optional[Book]:
    normalized_text = _normalize(text)
    if not normalized_text:
        return None

    # Prefer exact title inclusion and keep the longest match to avoid partial collisions.
    candidates = []
    for book in catalog:
        nt = _normalize(book.title)
        if nt and nt in normalized_text:
            candidates.append((len(nt), book))

    if candidates:
        candidates.sort(key=lambda item: item[0], reverse=True)
        return candidates[0][1]

    # Fallback on quoted title or text after "livre".
    quoted = re.search(r"['\"]([^'\"]{2,120})['\"]", text)
    if quoted:
        frag = _normalize(quoted.group(1))
        for book in catalog:
            if frag and frag in _normalize(book.title):
                return book

    m = re.search(r"livre\s+(.+)$", normalized_text)
    if m:
        frag = m.group(1).strip(" ?!.,")
        for book in catalog:
            nt = _normalize(book.title)
            if frag and (frag in nt or nt in frag):
                return book

    return None


def _resolve_book_from_question_or_history(question: str, history: List[ChatMessage], catalog: List[Book]) -> Optional[Book]:
    match = _extract_book_from_text(question, catalog)
    if match:
        return match

    # Resolve pronouns like "son résumé" with the most recent explicit title in history.
    for msg in reversed(history):
        found = _extract_book_from_text(msg.content, catalog)
        if found:
            return found

    return None


def _contains_any(text: str, needles: List[str]) -> bool:
    return any(n in text for n in needles)


def _book_borrow_count(book_id: str, data: ManualAnalysisResponse) -> int:
    for bucket in (data.top_borrowed, data.rarely_borrowed, data.never_borrowed, data.out_of_stock):
        for b in bucket:
            if b.id == book_id:
                return b.borrow_count
    return 0


def _build_summary_text(book: Book, data: ManualAnalysisResponse) -> str:
    raw_summary = (book.resume_ia or "").strip()
    borrow_count = _book_borrow_count(book.id, data)

    usage_label = "forte" if borrow_count >= 3 else "moyenne" if borrow_count >= 1 else "faible"
    availability = "en rupture" if book.quantity_available == 0 else f"{book.quantity_available} exemplaire(s) disponible(s)"
    category = book.category or "Non précisée"
    year = str(book.publication_year) if book.publication_year else "année non renseignée"

    if raw_summary:
        return (
            f"Résumé enrichi de {_book_name(book)} : {raw_summary} "
            f"Catégorie: {category}. Publication: {year}. "
            f"Disponibilité actuelle: {availability}. "
            f"Niveau de demande sur la période analysée: {usage_label} ({borrow_count} emprunt(s))."
        )

    return (
        f"Je n'ai pas encore de résumé éditorial pour {_book_name(book)}. "
        f"Fiche disponible: catégorie {category}, publication {year}, stock {availability}, "
        f"demande {usage_label} ({borrow_count} emprunt(s) sur la période)."
    )


def _build_purchase_advice(data: ManualAnalysisResponse) -> str:
    # Priorité 1: ruptures de stock, triées par nombre d'emprunts décroissant.
    out_sorted = sorted(data.out_of_stock, key=lambda b: b.borrow_count, reverse=True)
    if out_sorted:
        top_3 = out_sorted[:3]
        lines = [f"- {b.title} ({b.borrow_count} emprunt(s), stock: 0)" for b in top_3]
        return (
            "Conseil d'achat immédiat: priorise ces titres en rupture de stock :\n"
            + "\n".join(lines)
            + "\nEnsuite, complète avec les autres titres en rupture si le budget le permet."
        )

    # Priorité 2: titres très demandés avec stock bas.
    low_stock_top = [b for b in data.top_borrowed if b.quantity_available <= 1]
    low_stock_top = sorted(low_stock_top, key=lambda b: b.borrow_count, reverse=True)
    if low_stock_top:
        top_3 = low_stock_top[:3]
        lines = [f"- {b.title} ({b.borrow_count} emprunt(s), stock: {b.quantity_available})" for b in top_3]
        return (
            "Aucun titre en rupture, mais voici les achats recommandés (forte demande + stock faible) :\n"
            + "\n".join(lines)
        )

    return (
        "Aucun achat urgent détecté: pas de rupture de stock ni de titre à forte demande avec stock critique. "
        "Tu peux maintenir le stock actuel et réévaluer au prochain cycle."
    )


def _build_response_text(data: ManualAnalysisResponse, question: str, history: List[ChatMessage], catalog: List[Book]) -> str:
    qn = _normalize(question)

    top_by_id = {b.id: b for b in data.top_borrowed}
    out_by_id = {b.id: b for b in data.out_of_stock}
    rarely_by_id = {b.id: b for b in data.rarely_borrowed}
    never_by_id = {b.id: b for b in data.never_borrowed}

    if _contains_any(qn, ["racheter", "reappro", "priorite", "prioritaire"]):
        return (
            "En priorité, il est recommandé de racheter les livres actuellement en rupture de stock : "
            f"{_format_title_list(_dedupe_titles_by_id(data.out_of_stock))}."
        )

    if _contains_any(qn, ["retirer", "enlever", "supprimer", "sortir du catalogue"]):
        return (
            "Pour optimiser l'espace, vous pouvez envisager de retirer les livres jamais empruntés : "
            f"{_format_title_list(_dedupe_titles_by_id(data.never_borrowed))}."
        )

    if _contains_any(qn, ["etat general", "etat du stock", "global", "general"]):
        return (
            f"L'état général est stable avec {data.total_books} références. "
            f"Nous notons {len(data.out_of_stock)} rupture(s) et {len(data.top_borrowed)} titre(s) très demandés."
        )

    if _contains_any(qn, ["danger", "risque", "rupture"]):
        if data.top_borrowed:
            return (
                "Les livres les plus demandés à surveiller pour éviter une rupture sont : "
                f"{_format_title_list(_dedupe_titles_by_id(data.top_borrowed))}."
            )
        return "Aucun risque de rupture détecté sur les titres les plus empruntés pour la période analysée."

    if _contains_any(qn, ["resumer", "resume", "synopsis"]):
        book = _resolve_book_from_question_or_history(question, history, catalog)
        if not book:
            return "Je peux donner le résumé, mais précise le titre du livre (ex: 'donne moi le résumé de Dune')."
        return _build_summary_text(book, data)

    if _contains_any(qn, ["conseil d achat", "conseil achat", "quoi acheter", "j achete quoi", "j'achete quoi", "j achte quoi", "j'achte quoi", "achat"]):
        return _build_purchase_advice(data)

    if _contains_any(qn, ["acheter", "achete", "racheter", "dois-je", "est ce que j achete", "faut il acheter"]):
        book = _resolve_book_from_question_or_history(question, history, catalog)
        if not book:
            return _build_purchase_advice(data)

        if book.id in out_by_id:
            return (
                f"Oui, {_book_name(book)} est actuellement en rupture de stock, donc c'est un achat prioritaire."
            )
        if book.id in top_by_id and book.quantity_available <= 1:
            return (
                f"Oui, {_book_name(book)} est très demandé et le stock est bas ({book.quantity_available} dispo), "
                "un réassort est recommandé."
            )
        if book.id in never_by_id:
            return (
                f"Non en priorité: {_book_name(book)} n'a pas été emprunté sur la période analysée."
            )
        if book.id in rarely_by_id:
            return (
                f"Pas urgent: {_book_name(book)} est peu emprunté. À reconsidérer seulement si une demande locale existe."
            )
        return (
            f"Décision modérée pour {_book_name(book)}: le livre n'est pas en rupture actuellement "
            f"(stock disponible: {book.quantity_available})."
        )

    return (
        "Je peux répondre de manière fiable sur: rachat prioritaire, retrait du catalogue, état du stock, "
        "risque de rupture, conseil d'achat d'un titre précis, et résumé d'un livre."
    )

async def simple_streamer(text: str):
    # Simule un streaming mot par mot pour garder l'effet visuel
    for word in text.split(" "):
        yield word + " "
        await asyncio.sleep(0.05)

@router.post("/stock")
async def analyze_stock_ai(
    request: AIAnalysisRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("bibliothecaire"))
):
    data = request.stock_data

    result = await session.execute(select(Book))
    catalog = result.scalars().all()

    response_text = _build_response_text(data, request.question, request.history, catalog)
    return StreamingResponse(simple_streamer(response_text), media_type="text/event-stream")
