import httpx
import asyncio

async def test():
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get('http://biblio_ia-ollama-1:11434/api/tags')
            print(f"STATUS: {r.status_code}")
            print(f"RESPONSE: {r.text}")
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(test())
