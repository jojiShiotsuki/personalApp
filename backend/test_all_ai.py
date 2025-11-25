import asyncio
import httpx
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

BASE_URL = "http://localhost:8000"

async def test_chat():
    print("\n=== Testing AI Chat (/api/ai/chat) ===")
    url = f"{BASE_URL}/api/ai/chat"
    payload = {
        "messages": [{"role": "user", "content": "Hello, who are you?"}],
        "context": {"page": "dashboard"}
    }
    
    print(f"Sending request to {url}...")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            async with client.stream("POST", url, json=payload) as response:
                if response.status_code != 200:
                    print(f"Error: Status code {response.status_code}")
                    print(await response.read())
                    return

                print("Response stream:")
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            print("\n[Stream Complete]")
                        else:
                            print(data, end="", flush=True)
    except Exception as e:
        print(f"Exception during chat test: {e}")

async def test_task_parser():
    print("\n=== Testing Task Parser (/api/task-parser/parse) ===")
    url = f"{BASE_URL}/api/task-parser/parse"
    payload = {"text": "Buy milk tomorrow at 5pm high priority"}
    
    print(f"Sending request to {url}...")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=payload)
            if response.status_code == 201:
                print("Success!")
                print(json.dumps(response.json(), indent=2))
            else:
                print(f"Error: Status code {response.status_code}")
                print(response.text)
    except Exception as e:
        print(f"Exception during task parser test: {e}")

async def test_goal_parser():
    print("\n=== Testing Goal Parser (/api/goal-parser/parse) ===")
    url = f"{BASE_URL}/api/goal-parser/parse"
    payload = {"text": "Lose 5kg by next month"}
    
    print(f"Sending request to {url}...")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=payload)
            if response.status_code == 201:
                print("Success!")
                print(json.dumps(response.json(), indent=2))
            else:
                print(f"Error: Status code {response.status_code}")
                print(response.text)
    except Exception as e:
        print(f"Exception during goal parser test: {e}")

async def main():
    print("Checking AI Features...")
    await test_chat()
    await test_task_parser()
    await test_goal_parser()

if __name__ == "__main__":
    asyncio.run(main())
