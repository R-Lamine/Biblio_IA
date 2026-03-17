from fastapi import APIRouter, Depends, HTTPException
from backend.core.security import require_role
from backend.schemas.ai import BookSummaryRequest
from backend.services.category_service import category_ai_service

router = APIRouter(prefix="/ai-tools", tags=["ai-tools"])

@router.post("/suggest-category")
async def suggest_category(
    request: BookSummaryRequest,
    current_user = Depends(require_role("bibliothecaire"))
):
    """
    Suggère une catégorie pour un livre donné.
    """
    if not request.title or not request.author:
        raise HTTPException(status_code=400, detail="Titre et auteur requis.")
        
    try:
        suggestion = await category_ai_service.suggest_category(request.title, request.author)
        return {"category": suggestion}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Erreur lors de la suggestion de catégorie.")
