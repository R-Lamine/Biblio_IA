import json, re, logging, httpx
from typing import List, Optional
from backend.core.config import settings

logger = logging.getLogger(__name__)

class LLMService:
    def __init__(self):
        self.ollama_url = f"{settings.OLLAMA_URL}/api/generate"
        self.model = "mistral"   # ⚠️ PAS tinyllama !

    async def _call_ollama(self, prompt: str, timeout: float = 120.0) -> str:
        payload = {"model": self.model, "prompt": prompt, "stream": False}
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(self.ollama_url, json=payload)
                response.raise_for_status()
                return response.json().get("response", "").strip()
        except httpx.TimeoutException:
            logger.error("Ollama timeout")
            raise
        except Exception as e:
            logger.error(f"Ollama error: {e}")
            raise

    async def generate_book_summary(self, title: str, author: str) -> str:
        prompt = (
            f"Génère un résumé de 10 lignes pour le livre intitulé '{title}' de '{author}'. "
            f"Inclus les thèmes principaux, le style d'écriture et le public cible. "
            f"Réponds uniquement avec le résumé, sans introduction."
        )
        return await self._call_ollama(prompt)

    async def natural_language_search(self, user_query: str, catalog: List[dict]) -> List[str]:
        # 1) Recherche par mots-clés (instantanée)
        keywords = user_query.lower().split()
        matched_ids = []
        for book in catalog:
            text = f"{book['title']} {book['author']} {book['category']} {book.get('resume_ia', '')}".lower()
            if any(kw in text for kw in keywords):
                matched_ids.append(book['id'])
        if len(matched_ids) >= 3:
            return matched_ids[:5]

        # 2) Appel LLM si pas assez de résultats
        catalog_json = json.dumps(
            [{"id": str(b["id"]), "title": b["title"], "author": b["author"], "category": b["category"]}
             for b in catalog],
            ensure_ascii=False
        )
        prompt = (
            f"Voici une liste de livres disponibles dans notre catalogue: {catalog_json}. "
            f"Un utilisateur cherche: '{user_query}'. "
            f"Retourne UNIQUEMENT une liste JSON des IDs des livres les plus pertinents "
            f"dans cet ordre de pertinence, format: {{\"ids\": [\"id1\", \"id2\", ...]}}. "
            f"Maximum 5 résultats."
        )
        response_text = await self._call_ollama(prompt)
        try:
            match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if match:
                data = json.loads(match.group())
                return data.get("ids", [])[:5]
        except (json.JSONDecodeError, AttributeError):
            logger.warning("LLM JSON parse failed, using keyword results")
        return matched_ids[:5]

    async def analyze_stock(self, stats: dict) -> str:
        stats_json = json.dumps(stats, ensure_ascii=False, indent=2)
        prompt = (
            f"Voici les statistiques d'emprunts des 6 derniers mois de notre bibliothèque:\n"
            f"{stats_json}\n\n"
            f"Identifie:\n"
            f"1) Les livres en tension (taux de rotation > 90%) à racheter en priorité.\n"
            f"2) Les livres dormants (0 emprunts depuis 1 an) à désherber.\n"
            f"Formule des recommandations concrètes et chiffrées.\n"
            f"Réponds en français, de manière concise et professionnelle."
        )
        return await self._call_ollama(prompt)

    async def chat(self, message: str, history: List[dict]) -> str:
        conversation = ""
        for msg in history[-6:]:
            role = "Utilisateur" if msg.get("role") == "user" else "Assistant"
            conversation += f"{role}: {msg.get('content', '')}\n"
        conversation += f"Utilisateur: {message}\n"

        prompt = (
            "Tu es un bibliothécaire IA expert. Tu aides les lecteurs à trouver des livres, "
            "tu donnes des recommandations littéraires et tu réponds aux questions sur la lecture. "
            "Réponds en français, de manière chaleureuse et concise.\n\n"
            f"{conversation}"
            "Assistant:"
        )
        return await self._call_ollama(prompt)

llm_service = LLMService()