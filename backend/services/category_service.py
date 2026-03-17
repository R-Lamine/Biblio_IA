import json, logging, httpx
from backend.core.config import settings
from backend.services.llm_service import build_prompt

logger = logging.getLogger(__name__)

CATEGORIES = [
    "SF/Fantastique", "Classique", "Histoire", "Psychologie", 
    "Dystopie", "Policier", "Romance", "Biographie", "Jeunesse"
]

class CategoryAIService:
    def __init__(self):
        self.ollama_url = f"{settings.OLLAMA_URL}/api/generate"
        self.model = settings.OLLAMA_MODEL

    async def suggest_category(self, title: str, author: str) -> str:
        """
        Suggère une catégorie parmi la liste prédéfinie.
        """
        categories_list = ", ".join(CATEGORIES)
        prompt = build_prompt(
            system=(
                f"Tu es un bibliothécaire expert. Ta tâche est de classer un livre dans UNE SEULE catégorie "
                f"parmi cette liste exacte : [{categories_list}].\n"
                "Règles strictes :\n"
                f"1. Réponds UNIQUEMENT avec le nom exact de la catégorie.\n"
                "2. Aucun autre mot, aucune explication, aucune ponctuation supplémentaire.\n"
                f"3. Si tu hésites, choisis la plus proche. Si tu ne sais vraiment pas, réponds 'Classique'."
            ),
            user=f"Livre : \"{title}\" de {author}. Catégorie ?"
        )

        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "num_predict": 20,
                "temperature": 0.2,
                "top_p": 0.9,
                "stop": ["<|im_end|>", "\n"]
            }
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(self.ollama_url, json=payload)
                response.raise_for_status()
                suggestion = response.json().get("response", "").strip()
                
                # Validation de la catégorie
                for cat in CATEGORIES:
                    if cat.lower() in suggestion.lower():
                        return cat
                
                return "Classique"  # Valeur par défaut si l'IA divague
        except Exception as e:
            logger.error(f"Category suggestion error: {e}")
            return "Classique"

category_ai_service = CategoryAIService()
