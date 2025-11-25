import os
import sys
import asyncio
from dotenv import load_dotenv

# Add current directory to path so we can import app modules
sys.path.append(os.getcwd())

# Load environment variables from .env file
load_dotenv()

from app.database.connection import SessionLocal
from app.services.ai_service import AIService
from app.schemas.ai import Message

async def test_ai():
    print("Testing Anthropic API connection...")
    
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("Error: ANTHROPIC_API_KEY not found in environment variables.")
        return
    
    print(f"API Key found: {api_key[:10]}...{api_key[-4:]}")
    
    try:
        service = AIService()
        db = SessionLocal()
        
        messages = [
            Message(role="user", content="Hello, are you working?")
        ]
        context = {"page": "dashboard"}
        
        print("\nSending request to Claude...")
        print("-" * 50)
        
        async for chunk in service.chat(messages, context, db):
            print(chunk, end="", flush=True)
            
        print("\n" + "-" * 50)
        print("\nSuccess! API is working.")
        
    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if 'db' in locals():
            db.close()

if __name__ == "__main__":
    asyncio.run(test_ai())
