import urllib.request
import json
import sys

def test_api():
    url = "http://localhost:8000/api/dashboard/briefing"
    print(f"Testing API: {url}")
    try:
        with urllib.request.urlopen(url) as response:
            print(f"Status: {response.status}")
            data = json.loads(response.read().decode())
            print("Response Data:")
            print(json.dumps(data, indent=2))
    except urllib.error.HTTPError as e:
        print(f"HTTP Error: {e.code} {e.reason}")
        print(e.read().decode())
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_api()
