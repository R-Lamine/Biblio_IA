import redis.asyncio as redis
import asyncio, logging
from typing import Callable, Any
from backend.core.config import settings

logger = logging.getLogger(__name__)

LOCK_KEY = "llm_lock"
LOCK_TTL = 300   # 5 minutes max pour une tâche LLM
MAX_WAIT = 240   # 4 minutes d'attente max

class QueueService:
    def __init__(self):
        self.redis = redis.from_url(settings.REDIS_URL, decode_responses=True)

    async def enqueue_llm_task(self, task_fn: Callable, *args, **kwargs) -> Any:
        waited = 0
        while waited < MAX_WAIT:
            acquired = await self.redis.set(LOCK_KEY, "1", nx=True, ex=LOCK_TTL)
            if acquired:
                try:
                    return await task_fn(*args, **kwargs)
                finally:
                    await self.redis.delete(LOCK_KEY)
            await asyncio.sleep(1)
            waited += 1
        raise TimeoutError("Le service IA est occupé, réessayez dans quelques secondes.")

queue_service = QueueService()