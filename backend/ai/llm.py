import json
import httpx
import logging
import re
from typing import List, Optional
from backend.core.config import settings

logger = logging.getLogger(__name__)

class LLMService:
    def __init__(self):
        self.ollama_url = f"{settings.OLLAMA_URL}/api/generate"
        self.model = "tinyllama"

    async def _call_ollama(self, prompt: str) -> str:
        payload = {"model": self.model, "prompt": prompt, "stream": False}
        try:
            # High timeout for local LLM
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(self.ollama_url, json=payload)
                response.raise_for_status()
                return response.json().get("response", "").strip()
        except Exception as e:
            logger.error(f"AI Error: {e}")
            return ""

    async def chat(self, user_message: str, history: List[dict]) -> str:
        prompt = "Tu es un assistant de bibliothèque expert. Aide l'utilisateur à trouver un livre. Réponds de manière très concise (2-3 phrases) et amicale en français.\n"
        for msg in history:
            role = "Utilisateur" if msg['role'] == 'user' else "Assistant"
            prompt += f"{role}: {msg['content']}\n"
        prompt += f"Utilisateur: {user_message}\nAssistant:"
        return await self._call_ollama(prompt)

    async def generate_book_summary(self, title: str, author: str) -> str:
        prompt = f"Livre: {title} par {author}. Écris un résumé très court (2 lignes max) en français :"
        return await self._call_ollama(prompt)

    async def natural_language_search(self, user_query: str, catalog_data: List[dict]) -> List[str]:
        # HYBRID SEARCH: Keyword matching first (instant)
        keywords = user_query.lower().split()
        matched_ids = []
        
        for book in catalog_data:
            text = f"{book['title']} {book['author']} {book['category']} {book.get('resume_ia', '')}".lower()
            if any(kw in text for kw in keywords):
                matched_ids.append(book['id'])
        
        if len(matched_ids) >= 3:
            return matched_ids[:5]

        # 2. AI Reasoning (if keywords not enough)
        # Only send a small snippet to avoid overloading
        catalog_snippet = json.dumps([{ "id": b['id'], "t": b['title'], "a": b['author'] } for b in catalog_data[:15]])
        prompt = (
            f"User query: '{user_query}'. "
            f"Catalog: {catalog_snippet}. "
            f"Return ONLY a JSON list of relevant IDs: {{\"ids\": [\"...\"]}}"
        )
        response_text = await self._call_ollama(prompt)
        try:
            match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if match:
                return json.loads(match.group()).get("ids", [])
        except:
            pass
            
        return matched_ids[:5]

llm_service = LLMService()
