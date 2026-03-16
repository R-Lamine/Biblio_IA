import json, re, logging, httpx, asyncio
from typing import List, Optional, Tuple
from backend.core.config import settings

logger = logging.getLogger(__name__)
CATEGORY_KEYWORDS = {
    "Policier":       ["policier", "polar", "crime", "enquête", "détective", "thriller",
                       "meurtre", "mystère", "inspecteur", "commissaire"],
    "SF/Fantastique": ["science-fiction", "science fiction", "fantastique", "fantasy",
                       "magie", "magique", "sorcier", "dragon", "elfe", "futuriste",
                       "espace", "robot", "extraterrestre", "tolkien"],
    "Romance":        ["romance", "romantique", "sentimental", "coup de foudre",
                       "histoire d'amour", "passion"],
    "Histoire":       ["histoire", "historique", "guerre", "médiéval", "antiquité",
                       "révolution", "empire", "moyen-âge", "napoléon", "hist"],
    "Jeunesse":       ["jeunesse", "enfants", "ado", "adolescent", "conte", "illustration"],
    "Classique":      ["classique", "littérature classique", "19ème", "balzac", "hugo",
                       "zola", "flaubert", "stendhal"],
    "Psychologie":    ["psychologie", "développement personnel", "bien-être",
                       "mental", "comportement", "thérapie"],
    "Dystopie":       ["dystopie", "dystopique", "post-apocalyptique", "futur sombre",
                       "société totalitaire", "orwell", "1984"],
    "Biographie":     ["biographie", "autobiographie", "mémoires", "vie de", "portrait"],
    "Philosophie":    ["philosophie", "éthique", "existence", "nietzsche", "sartre", "camus"],
}

STOP_WORDS = {
    "je", "un", "une", "des", "le", "la", "les", "du", "de", "cherche", "veux",
    "voudrais", "aimerais", "trouve", "livre", "roman", "bouquin", "me", "recommande",
    "suggère", "avoir", "lire", "sur", "avec", "pour", "mais", "qui", "que", "quoi",
    "comme", "genre", "type", "style", "envie", "quelque", "chose", "peu", "très",
    "plus", "aussi", "même", "pas", "non", "oui", "merci", "bonjour", "svp",
    "stp", "vous", "avez", "est", "sont", "dans", "par", "and", "the",
    "special", "spécial", "bien", "bon", "bonne", "super", "nouveau", "nouvelle",
    "intéressant", "intéressante", "sympa", "cool",
}


def extract_category_from_query(query: str) -> Optional[str]:
    """Détecte la catégorie depuis la requête. Teste les phrases longues avant les mots courts."""
    query_lower = query.lower()
    # Trier par longueur décroissante pour matcher "science-fiction" avant "sf"
    all_pairs = []
    for db_category, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            all_pairs.append((len(kw), kw, db_category))
    all_pairs.sort(reverse=True)

    for _, kw, db_category in all_pairs:
        if kw in query_lower:
            return db_category
    return None


def search_books_in_catalog(query: str, catalog: List[dict], max_results: int = 20) -> Tuple[List[dict], str]:
    """
    Priorité de recherche :
    1. Titre ou auteur direct dans la BDD
    2. Mots-clés dans titre/auteur/résumé IA
    3. Catégorie détectée
    """
    query_lower = query.lower()

    # Mots significatifs pour recherche titre/auteur
    title_words = [
        w.strip(".,!?\"'") for w in query_lower.split()
        if w.strip(".,!?\"'") not in STOP_WORDS and len(w.strip(".,!?\"'")) > 2
    ]

    # 1. Recherche titre/auteur direct
    if title_words:
        direct_matches = []
        for book in catalog:
            title = book.get("title", "").lower()
            author = book.get("author", "").lower()
            score = sum(1 for w in title_words if w in title or w in author)
            if score > 0:
                direct_matches.append((score, book))

        direct_matches.sort(key=lambda x: x[0], reverse=True)
        if direct_matches:
            return [b for _, b in direct_matches[:max_results]], "title_author"

    # 2. Détection de catégorie (avant mots-clés résumé pour être plus fiable)
    category = extract_category_from_query(query)
    if category:
        matches = [b for b in catalog if b.get("category", "").lower() == category.lower()]
        if matches:
            return matches[:max_results], f"category:{category}"

    # 3. Recherche élargie dans résumé IA
    if title_words:
        scored = []
        for book in catalog:
            text = (
                f"{book.get('title', '')} {book.get('author', '')} "
                f"{book.get('resume_ia', '')}"
            ).lower()
            score = sum(1 for kw in title_words if kw in text)
            if score > 0:
                scored.append((score, book))
        scored.sort(key=lambda x: x[0], reverse=True)
        if scored:
            return [b for _, b in scored[:max_results]], "keywords"

    return [], "none"


async def stream_text(text: str):
    """
    Génère le texte mot par mot avec un délai pour simuler
    une vraie réponse IA en temps réel.
    """
    words = text.split(" ")
    for i, word in enumerate(words):
        # Ajouter l'espace sauf pour le dernier mot
        chunk = word + (" " if i < len(words) - 1 else "")
        yield chunk
        # Délai variable : plus court sur les mots courts, plus long sur la ponctuation
        if word.endswith((".", "!", "?", ":\n")):
            await asyncio.sleep(0.08)
        elif word.endswith(","):
            await asyncio.sleep(0.04)
        else:
            await asyncio.sleep(0.02)


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
        Chat streamé intelligent avec effet de frappe progressive.
        """
        if catalog:
            matching_books, search_type = search_books_in_catalog(message, catalog)

            if matching_books:
                book_lines = "\n".join(
                    [f"  • « {b['title']} » de {b['author']} ({b.get('category', '')})"
                     for b in matching_books]
                )

                if search_type == "title_author":
                    intro = "Voici ce que j'ai trouvé dans notre catalogue :"
                elif search_type.startswith("category:"):
                    category = search_type.split(":")[1]
                    intro = f"Voici les ouvrages de type {category} disponibles dans notre bibliothèque :"
                else:
                    intro = "Voici les ouvrages qui correspondent à votre recherche :"

                unavailable = sum(1 for b in matching_books if b.get("quantity_available", 0) == 0)
                footer_parts = []
                if unavailable > 0:
                    footer_parts.append(f"({unavailable} ouvrage(s) momentanément indisponible(s) en rayon)")
                footer_parts.append(
                    "Cliquez sur « Lancer la recherche basée sur notre discussion » "
                    "pour les voir en détail et les emprunter 📚"
                )

                response_text = f"{intro}\n\n{book_lines}\n\n" + "\n".join(footer_parts)

            else:
                response_text = (
                    "Je n'ai pas trouvé d'ouvrages correspondant à votre demande dans notre catalogue. 😕\n\n"
                    "Quelques conseils :\n"
                    "  • Essayez le titre exact ou le nom de l'auteur\n"
                    "  • Précisez un genre : policier, fantastique, romance, histoire...\n"
                    "  • Décrivez l'ambiance : sombre, aventure, futuriste, historique...\n\n"
                    "Vous pouvez aussi utiliser la recherche classique en haut de page."
                )

            # Streaming mot par mot avec délai
            async for chunk in stream_text(response_text):
                yield chunk
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
        Recherche pour le bouton 'Lancer la recherche' — retourne TOUS les livres trouvés.
        """
        matching_books, search_type = search_books_in_catalog(user_query, catalog, max_results=20)

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
                    return result_ids
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