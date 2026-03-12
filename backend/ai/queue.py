import redis.asyncio as redis
import asyncio
from typing import Callable, Any
from backend.core.config import settings

class QueueService:
    def __init__(self):
        # We still keep redis connection for future use if needed
        self.redis = redis.from_url(settings.REDIS_URL, decode_responses=True)

    async def enqueue_llm_task(self, task_fn: Callable, *args, **kwargs) -> Any:
        # Removed lock to avoid blocking UI during local LLM calls
        # This might load the CPU but provides better feedback than a 60s wait
        try:
            return await task_fn(*args, **kwargs)
        except Exception as e:
            # Re-raise to be handled by the router
            raise e

queue_service = QueueService()
