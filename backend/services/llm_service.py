import json, re, logging, httpx
from typing import List, Optional
from backend.core.config import settings

logger = logging.getLogger(__name__)

# Mapping des mots courants vers les catégories de la BDD
CATEGORY_KEYWORDS = {
    "policier": ["Policier", "policier", "polar", "crime", "enquête", "détective", "thriller"],
    "sf": ["SF/Fantastique", "science-fiction", "sci-fi", "sf", "fantastique", "fantasy", "magie"],
    "romance": ["Romance", "amour", "romantique", "romance"],
    "histoire": ["Histoire", "historique", "histoire"],
    "jeunesse": ["Jeunesse", "enfant", "jeunesse", "jeune"],
    "classique": ["Classique", "classique", "littérature"],
    "psychologie": ["Psychologie", "psycho", "développement personnel"],
    "dystopie": ["Dystopie", "dystopie", "post-apocalyptique", "futur"],
    "biographie": ["Biographie", "biographie", "autobiographie", "mémoires"],
    "philosophie": ["Philosophie", "philosophie", "philo"],
}

def extract_category_from_query(query: str) -> Optional[str]:
    """Extrait la catégorie de livre depuis une requête en langage naturel."""
    query_lower = query.lower()
    for db_category, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw.lower() in query_lower:
                # Retourne le nom exact de la catégorie BDD (premier élément)
                return keywords[0]
    return None


class LLMService:
    def __init__(self):
        self.ollama_url = f"{settings.OLLAMA_URL}/api/generate"
        self.model = "tinyllama"

    async def _call_ollama(self, prompt: str, timeout: float = 120.0) -> str:
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {"num_predict": 300}
        }
        logger.info(f"AI Call - Model: {self.model}, Prompt Length: {len(prompt)}")
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(self.ollama_url, json=payload)
                response.raise_for_status()
                result = response.json().get("response", "").strip()
                logger.info(f"AI Success - Response Length: {len(result)}")
                return result
        except httpx.TimeoutException:
            logger.error("Ollama timeout")
            raise
        except Exception as e:
            logger.error(f"Ollama error: {e}")
            raise

    async def stream_chat(self, message: str, history: List[dict], catalog: List[dict] = None):
        """
        Chat streamé.
        - Si une catégorie est détectée ET des livres trouvés → réponse construite directement
          en Python (pas de LLM) pour éviter les hallucinations de TinyLlama.
        - Sinon → appel LLM normal.
        """
        # 1. Détecter si l'utilisateur cherche un type de livre
        category = extract_category_from_query(message)

        if catalog and category:
            matching_books = [
                b for b in catalog
                if b.get("category", "").lower() == category.lower()
            ][:8]

            if matching_books:
                # On construit la réponse nous-mêmes, sans passer par le LLM
                book_lines = "\n".join(
                    [f"• « {b['title']} » — {b['author']}" for b in matching_books]
                )
                response_text = (
                    f"Bien sûr ! Voici les livres de type {category} disponibles dans notre bibliothèque :\n\n"
                    f"{book_lines}\n\n"
                    f"Cliquez sur « Lancer la recherche » pour les voir en détail 📚"
                )
                # On yield caractère par caractère pour garder l'effet streaming
                for char in response_text:
                    yield char
                return  # On s'arrête là, pas besoin du LLM

        # 2. Pas de catégorie détectée → appel LLM normal
        prompt = "<|system|>\nTu es un bibliothécaire amical. Réponds TOUJOURS en français. Sois bref (3 phrases max).</s>\n"

        for msg in history[-2:]:
            role = "user" if msg.get("role") == "user" else "assistant"
            content = msg.get("content", "")
            prompt += f"<|{role}|>\n{content}</s>\n"

        prompt += f"<|user|>\n{message}</s>\n<|assistant|>\n"

        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": True,
            "options": {
                "num_predict": 150,
                "temperature": 0.7,
                "top_p": 0.9
            }
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", self.ollama_url, json=payload) as response:
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        if data.get("done"):
                            break
                        yield data.get("response", "")
                    except json.JSONDecodeError:
                        continue

    async def generate_book_summary(self, title: str, author: str) -> str:
        prompt = (
            f"<|system|>\nTu es un bibliothécaire. Résume ce livre en 2 phrases courtes en français.</s>\n"
            f"<|user|>\nLivre: '{title}' par {author}</s>\n"
            f"<|assistant|>\n"
        )
        return await self._call_ollama(prompt, timeout=60.0)

    async def natural_language_search(self, user_query: str, catalog: List[dict]) -> List[str]:
        """
        Recherche des livres correspondant à la requête.
        Priorité : catégorie détectée > mots-clés > LLM fallback
        """
        # 1. Détection de catégorie (le cas le plus courant : "je veux un policier")
        category = extract_category_from_query(user_query)
        if category:
            category_matches = [
                b["id"] for b in catalog
                if b.get("category", "").lower() == category.lower()
            ]
            if category_matches:
                logger.info(f"Category match '{category}': {len(category_matches)} books found")
                return category_matches[:5]

        # 2. Recherche par mots-clés sur titre/auteur/catégorie
        # On filtre les mots trop courts ou trop génériques
        stop_words = {"je", "un", "une", "des", "le", "la", "les", "du", "de", "cherche",
                      "veux", "voudrais", "aimerais", "trouve", "livre", "roman", "bouquin",
                      "me", "recommande", "suggère", "avoir", "lire", "sur", "avec", "pour"}
        keywords = [w for w in user_query.lower().split() if w not in stop_words and len(w) > 2]

        matched_ids = []
        for book in catalog:
            text = f"{book['title']} {book['author']} {book['category']} {book.get('resume_ia', '')}".lower()
            if any(kw in text for kw in keywords):
                matched_ids.append(book["id"])

        if len(matched_ids) >= 2:
            return matched_ids[:5]

        # 3. Fallback LLM si rien trouvé
        catalog_compact = [
            {"id": str(b["id"])[-4:], "t": b["title"][:25], "c": b.get("category", "")}
            for b in catalog[:15]
        ]
        prompt = (
            f"<|system|>\nRéponds uniquement avec un JSON. Format: {{\"ids\": [\"...\", \"...\"]}}</s>\n"
            f"<|user|>\nCatalogue: {json.dumps(catalog_compact)}\nQuestion: {user_query}\n"
            f"Retourne les IDs (derniers 4 chiffres) des livres pertinents.</s>\n"
            f"<|assistant|>\n"
        )
        response_text = await self._call_ollama(prompt, timeout=40.0)
        try:
            match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if match:
                short_ids = json.loads(match.group()).get("ids", [])
                result_ids = []
                for short_id in short_ids:
                    for b in catalog:
                        if str(b["id"]).endswith(short_id):
                            result_ids.append(b["id"])
                if result_ids:
                    return result_ids[:5]
        except Exception:
            pass

        return matched_ids[:5]

    async def analyze_stock(self, stats: dict) -> str:
        return "Analyse désactivée."

    async def chat(self, message: str, history: List[dict]) -> str:
        prompt = "<|system|>\nTu es un bibliothécaire amical. Réponds en français. Très bref.</s>\n"
        for msg in history[-2:]:
            role = "user" if msg.get("role") == "user" else "assistant"
            prompt += f"<|{role}|>\n{msg.get('content', '')}</s>\n"
        prompt += f"<|user|>\n{message}</s>\n<|assistant|>\n"
        return await self._call_ollama(prompt, timeout=40.0)


llm_service = LLMService()