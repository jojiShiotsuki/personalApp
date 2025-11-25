from app.database.connection import SessionLocal
from app.models.social_content import SocialContent
from datetime import date

def check_social_content():
    db = SessionLocal()
    try:
        count = db.query(SocialContent).count()
        print(f"Total SocialContent items: {count}")
        
        items = db.query(SocialContent).limit(5).all()
        for item in items:
            print(f"ID: {item.id}, Date: {item.content_date}, Type: {item.content_type}, Status: {item.status}")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_social_content()
