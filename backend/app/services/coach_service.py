# backend/app/services/coach_service.py
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, Any
from datetime import datetime, timedelta
from app.models.coach_insight import CoachInsight, InsightType, InsightPriority
from app.models.crm import Deal, Contact
from app.models.task import Task, TaskStatus
from app.services.activity_service import log_activity


class CoachService:
    def __init__(self, db: Session, coach_level: int = 2):
        self.db = db
        self.coach_level = coach_level  # 1=minimal, 2=balanced, 3=active

    def check_action(
        self,
        action: str,
        entity_type: str,
        entity_id: Optional[int] = None,
        metadata: Optional[dict[str, Any]] = None
    ) -> Optional[CoachInsight]:
        """Check if an action should trigger a coach insight."""
        # Log the activity
        log_activity(self.db, action, entity_type, entity_id, metadata)

        # Generate insight based on action
        insight = self._generate_action_insight(action, entity_type, entity_id, metadata)

        if insight and self._should_show_insight(insight):
            self.db.add(insight)
            self.db.commit()
            self.db.refresh(insight)
            return insight

        return None

    def _generate_action_insight(
        self,
        action: str,
        entity_type: str,
        entity_id: Optional[int],
        metadata: Optional[dict[str, Any]]
    ) -> Optional[CoachInsight]:
        """Generate an insight based on the action performed."""
        metadata = metadata or {}

        # Deal closed won
        if action == "deal_closed" and metadata.get("won"):
            contact = self.db.query(Contact).filter(
                Contact.id == metadata.get("contact_id")
            ).first()
            contact_name = contact.name if contact else "the client"

            return CoachInsight(
                type=InsightType.ACTION,
                priority=InsightPriority.HIGH,
                message=f"Great close! This is the perfect moment to ask {contact_name} for a referral while they're happy.",
                suggested_action="create_task",
                action_params={
                    "title": f"Ask {contact_name} for referral",
                    "priority": "high"
                },
                entity_type=entity_type,
                entity_id=entity_id
            )

        # Task completed
        if action == "task_completed" and self.coach_level >= 2:
            # Find next high priority task
            next_task = self.db.query(Task).filter(
                Task.status == TaskStatus.PENDING,
                Task.priority.in_(["high", "urgent"])
            ).order_by(Task.due_date.asc().nullslast()).first()

            if next_task:
                return CoachInsight(
                    type=InsightType.ACTION,
                    priority=InsightPriority.MEDIUM,
                    message=f"Nice work! Next priority: {next_task.title}",
                    suggested_action="view_task",
                    action_params={"task_id": next_task.id},
                    entity_type="task",
                    entity_id=next_task.id
                )

        # Deal created
        if action == "deal_created" and self.coach_level >= 3:
            return CoachInsight(
                type=InsightType.ACTION,
                priority=InsightPriority.LOW,
                message="Tip: Deals with a follow-up task in the first 24 hours close 2x faster. Add a follow-up task?",
                suggested_action="create_task",
                action_params={
                    "title": "Follow up on new deal",
                    "priority": "high"
                },
                entity_type=entity_type,
                entity_id=entity_id
            )

        return None

    def get_time_based_insights(self, stale_lead_days: int = 7, stuck_deal_days: int = 14) -> list[CoachInsight]:
        """Generate time-based insights about stale leads, stuck deals, etc."""
        insights = []

        # Check for stale leads (contacts not contacted recently)
        if self.coach_level >= 1:
            stale_date = datetime.utcnow() - timedelta(days=stale_lead_days)
            stale_contacts = self.db.query(Contact).filter(
                Contact.status.in_(["LEAD", "PROSPECT"]),
                Contact.updated_at < stale_date
            ).limit(5).all()

            if stale_contacts:
                names = ", ".join([c.name for c in stale_contacts[:3]])
                remaining = len(stale_contacts) - 3
                suffix = f" and {remaining} more" if remaining > 0 else ""

                existing = self.db.query(CoachInsight).filter(
                    CoachInsight.suggested_action == "view_stale_leads",
                    CoachInsight.dismissed == False,
                    CoachInsight.created_at > datetime.utcnow() - timedelta(hours=24)
                ).first()

                if not existing:
                    insights.append(CoachInsight(
                        type=InsightType.TIME,
                        priority=InsightPriority.HIGH,
                        message=f"Warm leads going cold: {names}{suffix} haven't been contacted in {stale_lead_days}+ days.",
                        suggested_action="view_stale_leads",
                        action_params={"contact_ids": [c.id for c in stale_contacts]}
                    ))

        # Check for stuck deals
        if self.coach_level >= 1:
            stuck_date = datetime.utcnow() - timedelta(days=stuck_deal_days)
            stuck_deals = self.db.query(Deal).filter(
                Deal.stage.notin_(["Closed Won", "Closed Lost"]),
                Deal.updated_at < stuck_date
            ).limit(5).all()

            if stuck_deals:
                for deal in stuck_deals[:2]:
                    existing = self.db.query(CoachInsight).filter(
                        CoachInsight.entity_type == "deal",
                        CoachInsight.entity_id == deal.id,
                        CoachInsight.dismissed == False,
                        CoachInsight.created_at > datetime.utcnow() - timedelta(hours=24)
                    ).first()

                    if not existing:
                        days_stuck = (datetime.utcnow() - deal.updated_at).days
                        insights.append(CoachInsight(
                            type=InsightType.TIME,
                            priority=InsightPriority.MEDIUM,
                            message=f"Deal '{deal.title}' has been in {deal.stage} stage for {days_stuck} days. Time to move it forward?",
                            suggested_action="view_deal",
                            action_params={"deal_id": deal.id},
                            entity_type="deal",
                            entity_id=deal.id
                        ))

        # Overdue tasks
        if self.coach_level >= 2:
            overdue_count = self.db.query(func.count(Task.id)).filter(
                Task.status != TaskStatus.COMPLETED,
                Task.due_date < datetime.utcnow().date()
            ).scalar()

            if overdue_count and overdue_count > 0:
                existing = self.db.query(CoachInsight).filter(
                    CoachInsight.suggested_action == "view_overdue_tasks",
                    CoachInsight.dismissed == False,
                    CoachInsight.created_at > datetime.utcnow() - timedelta(hours=12)
                ).first()

                if not existing:
                    insights.append(CoachInsight(
                        type=InsightType.TIME,
                        priority=InsightPriority.HIGH,
                        message=f"You have {overdue_count} overdue task{'s' if overdue_count > 1 else ''}. Let's clear the backlog!",
                        suggested_action="view_overdue_tasks"
                    ))

        return insights

    def get_pattern_insights(self) -> list[CoachInsight]:
        """Generate pattern-based insights from historical data."""
        insights = []

        if self.coach_level < 3:
            return insights

        # This is a placeholder for more sophisticated pattern analysis
        # In a full implementation, you'd analyze:
        # - Best times for task completion
        # - Deal conversion patterns by source
        # - Response time correlations

        return insights

    def _should_show_insight(self, insight: CoachInsight) -> bool:
        """Check if insight meets the current coach level threshold."""
        level_thresholds = {
            1: [InsightPriority.HIGH],
            2: [InsightPriority.HIGH, InsightPriority.MEDIUM],
            3: [InsightPriority.HIGH, InsightPriority.MEDIUM, InsightPriority.LOW]
        }

        return insight.priority in level_thresholds.get(self.coach_level, [])

    def get_pending_insights(self, limit: int = 10) -> list[CoachInsight]:
        """Get pending (unseen, not dismissed) insights."""
        return self.db.query(CoachInsight).filter(
            CoachInsight.dismissed == False
        ).order_by(
            CoachInsight.priority.desc(),
            CoachInsight.created_at.desc()
        ).limit(limit).all()

    def mark_seen(self, insight_id: int) -> bool:
        """Mark an insight as seen."""
        insight = self.db.query(CoachInsight).filter(CoachInsight.id == insight_id).first()
        if insight:
            insight.seen = True
            self.db.commit()
            return True
        return False

    def dismiss_insight(self, insight_id: int) -> bool:
        """Dismiss an insight."""
        insight = self.db.query(CoachInsight).filter(CoachInsight.id == insight_id).first()
        if insight:
            insight.dismissed = True
            self.db.commit()
            return True
        return False
