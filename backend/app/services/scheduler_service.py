import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()

async def poll_gmail_job():
    """Scheduled job: poll Gmail for new replies for all active tokens."""
    from app.database.connection import SessionLocal
    from app.services.gmail_service import GmailService
    from app.models.autoresearch import GmailToken

    db = SessionLocal()
    try:
        tokens = db.query(GmailToken).filter(GmailToken.is_active == True).all()
        if not tokens:
            return

        try:
            gmail_service = GmailService()
        except ValueError:
            logger.debug("Gmail service not configured, skipping poll")
            return

        for token in tokens:
            try:
                result = await gmail_service.poll_inbox(db, token.user_id)
                if result.get("new_replies", 0) > 0 or result.get("new_sent_matches", 0) > 0:
                    logger.info("Gmail poll for user %d: %s", token.user_id, result)
            except Exception as e:
                logger.error("Gmail poll failed for user %d: %s", token.user_id, e)
    finally:
        db.close()

async def weekly_learning_refresh():
    """Weekly job: refresh learning insights."""
    from app.database.connection import SessionLocal
    from app.services.learning_service import LearningService

    db = SessionLocal()
    try:
        learning_service = LearningService()
        if learning_service.should_refresh(db):
            await learning_service.generate_insights(db)
            logger.info("Weekly learning refresh completed")
    except Exception as e:
        logger.error("Weekly learning refresh failed: %s", e)
    finally:
        db.close()


def start_scheduler():
    """Start the background scheduler with all jobs."""
    scheduler.add_job(
        poll_gmail_job,
        "interval",
        minutes=5,
        id="gmail_poll",
        replace_existing=True
    )
    scheduler.add_job(
        weekly_learning_refresh,
        "cron",
        day_of_week="sun",
        hour=22,
        id="weekly_learn",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduler started with Gmail polling every 5 minutes and weekly learning refresh")

def stop_scheduler():
    """Gracefully shut down the scheduler."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")
