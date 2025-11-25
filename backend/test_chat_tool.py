import requests
import json
import sys

def test_chat_tool():
    url = "http://localhost:8000/api/ai/chat"
    
    payload = {
        "messages": [
            {"role": "user", "content": "Create a task to buy milk tomorrow"}
        ],
        "context": {"page": "tasks"}
    }
    
    print(f"Sending request to {url}...")
    try:
        with requests.post(url, json=payload, stream=True, timeout=30) as response:
            print(f"Response status: {response.status_code}")
            if response.status_code != 200:
                print(f"Error: Status code {response.status_code}")
                print(response.text)
                return

            print("Response stream:")
            for line in response.iter_lines():
                if line:
                    decoded_line = line.decode('utf-8')
                    print(decoded_line)
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    test_chat_tool()
