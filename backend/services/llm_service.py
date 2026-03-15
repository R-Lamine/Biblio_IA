import json, re, logging, httpx
from typing import List, Optional, Tuple
from backend.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Table de correspondance : mots naturels → catégorie exacte en BDD
# ---------------------------------------------------------------------------
CATEGORY_KEYWORDS = {
    "Policier":       ["policier", "polar", "crime", "enquête", "détective", "thriller",
                       "meurtre", "mystère", "inspecteur", "commissaire"],
    "SF/Fantastique": ["sf", "science-fiction", "science fiction", "fantastique", "fantasy",
                       "magie", "magique", "sorcier", "dragon", "elfe", "futuriste",
                       "espace", "robot", "extraterrestre", "harry potter", "tolkien"],
    "Romance":        ["romance", "amour", "romantique", "sentimental", "coup de foudre",
                       "histoire d'amour", "passion"],
    "Histoire":       ["histoire", "historique", "guerre", "médiéval", "antiquité",
                       "révolution", "empire", "moyen-âge", "napoléon"],
    "Jeunesse":       ["jeunesse", "enfant", "enfants", "jeune", "ado", "adolescent",
                       "conte", "illustration"],
    "Classique":      ["classique", "littérature classique", "19ème", "balzac", "hugo",
                       "zola", "flaubert", "stendhal"],
    "Psychologie":    ["psychologie", "psycho", "développement personnel", "bien-être",
                       "mental", "comportement", "thérapie"],
    "Dystopie":       ["dystopie", "dystopique", "post-apocalyptique", "futur sombre",
                       "société totalitaire", "orwell", "1984", "sombre", "ambiance sombre"],
    "Biographie":     ["biographie", "autobiographie", "mémoires", "vie de", "portrait"],
    "Philosophie":    ["philosophie", "philo", "éthique", "existence", "pensée",
                       "nietzsche", "sartre", "camus"],
}

# Mots à ignorer lors de la recherche par mots-clés
STOP_WORDS = {
    "je", "un", "une", "des", "le", "la", "les", "du", "de", "cherche", "veux",
    "voudrais", "aimerais", "trouve", "livre", "roman", "bouquin", "me", "recommande",
    "suggère", "avoir", "lire", "sur", "avec", "pour", "mais", "qui", "que", "quoi",
    "comme", "genre", "type", "style", "envie", "quelque", "chose", "peu", "très",
    "plus", "aussi", "même", "pas", "non", "oui", "merci", "bonjour", "svp",
    "stp", "vous", "avez", "est", "sont", "dans", "par", "and", "the",
}


def extract_category_from_query(query: str) -> Optional[str]:
    """
    Détecte si la requête correspond à une catégorie connue.
    Retourne le nom exact tel qu'en BDD (ex: 'SF/Fantastique').
    """
    query_lower = query.lower()
    for db_category, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in query_lower:
                return db_category
    return None


def search_books_in_catalog(query: str, catalog: List[dict], max_results: int = 8) -> Tuple[List[dict], str]:
    """
    Recherche intelligente dans le catalogue :
    1. Par catégorie détectée (le plus fiable)
    2. Par mots-clés dans titre/auteur/résumé IA (pour les requêtes descriptives)
    Retourne (liste de livres trouvés, type de recherche effectuée)
    """
    # 1. Détection de catégorie
    category = extract_category_from_query(query)
    if category:
        matches = [b for b in catalog if b.get("category", "").lower() == category.lower()]
        if matches:
            return matches[:max_results], f"category:{category}"

    # 2. Recherche par mots-clés significatifs dans titre/auteur/résumé
    keywords = [
        w.strip(".,!?\"'") for w in query.lower().split()
        if w.strip(".,!?\"'") not in STOP_WORDS and len(w.strip(".,!?\"'")) > 2
    ]

    if keywords:
        scored = []
        for book in catalog:
            text = (
                f"{book.get('title', '')} {book.get('author', '')} "
                f"{book.get('category', '')} {book.get('resume_ia', '')}"
            ).lower()
            score = sum(1 for kw in keywords if kw in text)
            if score > 0:
                scored.append((score, book))

        scored.sort(key=lambda x: x[0], reverse=True)
        matches = [b for _, b in scored[:max_results]]
        if matches:
            return matches, "keywords"

    return [], "none"


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
        Chat streamé intelligent :
        - Si des livres correspondent à la demande → réponse construite en Python
          (pas de LLM) pour éviter les hallucinations de TinyLlama.
        - Si aucun livre trouvé → message informatif sans LLM.
        - Si pas de catalogue → appel LLM pour question générale.
        """
        if catalog:
            matching_books, search_type = search_books_in_catalog(message, catalog)

            if matching_books:
                book_lines = "\n".join(
                    [f"  • « {b['title']} » de {b['author']} ({b.get('category', '')})"
                     for b in matching_books]
                )

                if search_type.startswith("category:"):
                    category = search_type.split(":")[1]
                    intro = f"Bien sûr ! Voici les ouvrages de type {category} disponibles dans notre bibliothèque :"
                else:
                    intro = "J'ai trouvé des ouvrages qui pourraient correspondre à votre recherche :"

                available = [b for b in matching_books if b.get("quantity_available", 0) > 0]
                unavailable = len(matching_books) - len(available)

                footer_parts = []
                if unavailable > 0:
                    footer_parts.append(f"({unavailable} ouvrage(s) momentanément indisponible(s) en rayon)")
                footer_parts.append(
                    "Cliquez sur « Lancer la recherche basée sur notre discussion » "
                    "pour les voir en détail et les emprunter 📚"
                )

                response_text = f"{intro}\n\n{book_lines}\n\n" + "\n".join(footer_parts)
                for char in response_text:
                    yield char
                return

            # Aucun livre trouvé
            response_text = (
                "Je n'ai pas trouvé d'ouvrages correspondant exactement à votre demande dans notre catalogue. "
                "Essayez avec d'autres mots-clés, ou utilisez la recherche classique en haut de page. "
                "N'hésitez pas à reformuler ! 😊"
            )
            for char in response_text:
                yield char
            return

        # Pas de catalogue → appel LLM pour question générale
        prompt = (
            "<|system|>\nTu es un bibliothécaire amical. "
            "Réponds TOUJOURS en français. Sois chaleureux et bref (3 phrases max).</s>\n"
        )
        for msg in history[-2:]:
            role = "user" if msg.get("role") == "user" else "assistant"
            content = msg.get("content", "")
            prompt += f"<|{role}|>\n{content}</s>\n"
        prompt += f"<|user|>\n{message}</s>\n<|assistant|>\n"

        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": True,
            "options": {"num_predict": 150, "temperature": 0.7, "top_p": 0.9}
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
        Recherche des livres pour le bouton 'Lancer la recherche'.
        Priorité : catégorie > mots-clés > LLM fallback
        """
        matching_books, search_type = search_books_in_catalog(user_query, catalog, max_results=5)

        if matching_books:
            logger.info(f"Search '{search_type}': {len(matching_books)} books found")
            return [b["id"] for b in matching_books]

        # Fallback LLM si vraiment rien trouvé
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

        return []

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