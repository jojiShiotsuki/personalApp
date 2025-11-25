from app.database.connection import SessionLocal
from app.services.dashboard_service import DashboardService
import sys

def test_briefing():
    db = SessionLocal()
    try:
        print("Testing DashboardService.get_briefing...")
        briefing = DashboardService.get_briefing(db)
        print("Success!")
        print(briefing)
        import json
        # Custom encoder for Enums if needed, but let's see if default fails
        try:
            print("JSON dump:", json.dumps(briefing))
        except TypeError as e:
            print(f"JSON dump failed: {e}")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_briefing()
