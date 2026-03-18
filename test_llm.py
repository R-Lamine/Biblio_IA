import asyncio
import httpx
import time
import json

async def test():
    async with httpx.AsyncClient(timeout=120.0) as client:

        print("=== TEST 1 : 20 tokens ===")
        start = time.time()
        r = await client.post("http://ollama:11434/api/generate", json={
            "model": "tinyllama",
            "prompt": "Antigone de Sophocle est une tragedie grecque qui raconte",
            "stream": False,
            "options": {"num_predict": 20, "temperature": 0.3, "stop": ["\n\n"]}
        })
        print(f"Temps: {time.time()-start:.1f}s | Reponse: {repr(r.json().get('response',''))}")

        print("\n=== TEST 2 : 40 tokens ===")
        start = time.time()
        r = await client.post("http://ollama:11434/api/generate", json={
            "model": "tinyllama",
            "prompt": "Antigone de Sophocle est une tragedie grecque qui raconte",
            "stream": False,
            "options": {"num_predict": 40, "temperature": 0.3, "stop": ["\n\n"]}
        })
        print(f"Temps: {time.time()-start:.1f}s | Reponse: {repr(r.json().get('response',''))}")

        print("\n=== TEST 3 : streaming 40 tokens ===")
        start = time.time()
        first_token_time = None
        full_response = ""
        async with client.stream("POST", "http://ollama:11434/api/generate", json={
            "model": "tinyllama",
            "prompt": "Antigone de Sophocle est une tragedie grecque qui raconte",
            "stream": True,
            "options": {"num_predict": 40, "temperature": 0.3, "stop": ["\n\n"]}
        }) as resp:
            async for line in resp.aiter_lines():
                if not line:
                    continue
                data = json.loads(line)
                token = data.get("response", "")
                if token and first_token_time is None:
                    first_token_time = time.time() - start
                    print(f"  Premier token apres: {first_token_time:.1f}s")
                full_response += token
                if data.get("done"):
                    break
        print(f"Temps total: {time.time()-start:.1f}s")
        print(f"Reponse: {repr(full_response)}")

asyncio.run(test())