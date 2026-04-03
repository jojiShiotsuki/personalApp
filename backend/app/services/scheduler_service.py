import asyncio
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

async def vault_sync_job():
    """Scheduled job: sync Obsidian vault from GitHub for all configured users."""
    from app.database.connection import SessionLocal
    from app.models.joji_ai import JojiAISettings
    from app.services.vault_sync_service import VaultSyncService

    db = SessionLocal()
    try:
        settings_list = (
            db.query(JojiAISettings)
            .filter(JojiAISettings.github_repo_url.isnot(None))
            .all()
        )
        if not settings_list:
            return

        vault_service = VaultSyncService()

        for settings in settings_list:
            try:
                result = await vault_service.sync_vault(db, settings)
                if result.get("files_synced", 0) > 0:
                    logger.info(
                        "Vault sync for user %d: %s", settings.user_id, result
                    )
            except Exception as e:
                logger.error(
                    "Vault sync failed for user %d: %s", settings.user_id, e
                )
    except Exception as e:
        logger.error("Vault sync job failed: %s", e)
    finally:
        db.close()


async def daily_learning_refresh():
    """Daily job: refresh learning insights and style patterns."""
    from app.database.connection import SessionLocal
    from app.services.learning_service import LearningService

    db = SessionLocal()
    try:
        learning_service = LearningService()
        if learning_service.should_refresh(db):
            await learning_service.generate_insights(db)
            logger.info("Daily learning refresh completed")
    except Exception as e:
        logger.error("Weekly learning refresh failed: %s", e)
    finally:
        db.close()


async def crm_batch_sync_job():
    """Scheduled job: batch sync recently modified CRM data to vault."""
    from app.database.connection import SessionLocal
    from app.services.crm_vault_sync import CRMVaultSync

    db = SessionLocal()
    try:
        syncer = CRMVaultSync()
        result = syncer.batch_crm_sync(db)
        if result.get("files_written", 0) > 0:
            logger.info("CRM batch sync: %s", result)
    except Exception as e:
        logger.error("CRM batch sync job failed: %s", e)
    finally:
        db.close()


def _gmail_vault_sync_blocking():
    """Blocking Gmail vault sync — runs in a thread to avoid blocking the event loop."""
    from app.database.connection import SessionLocal
    from app.models.autoresearch import GmailToken
    from app.services.gmail_vault_service import GmailVaultService

    db = SessionLocal()
    try:
        tokens = db.query(GmailToken).filter(GmailToken.is_active == True).all()
        if not tokens:
            return

        vault_service = GmailVaultService()
        for token in tokens:
            try:
                result = vault_service.incremental_sync(db, token.user_id)
                if result.get("threads_indexed", 0) > 0:
                    logger.info("Gmail vault sync for user %d: %s", token.user_id, result)
            except Exception as e:
                logger.error("Gmail vault sync failed for user %d: %s", token.user_id, e)
    except Exception as e:
        logger.error("Gmail vault sync job failed: %s", e)
    finally:
        db.close()


async def gmail_vault_sync_job():
    """Scheduled job: sync recent Gmail threads to vault.

    Runs the blocking sync in a thread executor so it doesn't block the
    async event loop (Gmail API + Claude summarization + git push can take minutes).
    """
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _gmail_vault_sync_blocking)


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
        vault_sync_job,
        "interval",
        minutes=30,
        id="vault_sync",
        replace_existing=True,
    )
    scheduler.add_job(
        crm_batch_sync_job,
        "interval",
        minutes=30,
        id="crm_batch_sync",
        replace_existing=True,
    )
    scheduler.add_job(
        gmail_vault_sync_job,
        "interval",
        minutes=30,
        id="gmail_vault_sync",
        replace_existing=True,
    )
    scheduler.add_job(
        daily_learning_refresh,
        "cron",
        hour=22,
        id="daily_learn",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(
        "Scheduler started with Gmail polling every 5 min, "
        "vault sync every 30 min, CRM batch sync every 30 min, "
        "Gmail vault sync every 30 min, "
        "and daily learning refresh at 22:00"
    )

def stop_scheduler():
    """Gracefully shut down the scheduler."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")
