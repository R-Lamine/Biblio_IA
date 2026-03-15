import json, re, logging, httpx
from typing import List, Optional
from backend.core.config import settings

logger = logging.getLogger(__name__)

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

    async def stream_chat(self, message: str, history: List[dict]):
        prompt = "<|system|>\nTu es un bibliothécaire amical. Réponds TOUJOURS en français. Sois très bref (2 phrases max).</s>\n"
        
        # Only take last 2 exchanges to save context and prevent confusion
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
                    if not line: continue
                    try:
                        data = json.loads(line)
                        if data.get("done"): break
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
        # 1) Recherche par mots-clés (instantanée)
        keywords = user_query.lower().split()
        matched_ids = []
        for book in catalog:
            text = f"{book['title']} {book['author']} {book['category']} {book.get('resume_ia', '')}".lower()
            if any(kw in text for kw in keywords):
                matched_ids.append(book['id'])
        if len(matched_ids) >= 2:
            return matched_ids[:5]

        # 2) Appel LLM si pas assez de résultats - Prompt réduit pour vitesse
        catalog_compact = [
            {"id": str(b["id"])[-4:], "t": b["title"][:20]}
            for b in catalog[:10]
        ]
        prompt = (
            f"<|system|>\nRéponds uniquement avec un ID du catalogue. Format: {{\"id\": \"...\"}}</s>\n"
            f"<|user|>\nCatalogue: {catalog_compact}\nQuestion: {user_query}</s>\n"
            f"<|assistant|>\n"
        )
        response_text = await self._call_ollama(prompt, timeout=40.0)
        try:
            match = re.search(r'\"id\":\s*\"(\w+)\"', response_text)
            if match:
                short_id = match.group(1)
                for b in catalog:
                    if str(b["id"]).endswith(short_id):
                        return [b["id"]]
        except:
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