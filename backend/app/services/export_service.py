from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date, timedelta
from typing import Optional
from decimal import Decimal

from app.models.task import Task, TaskStatus, TaskPriority
from app.models.crm import Contact, Deal, Interaction, DealStage

class ExportService:
    """Generate markdown context reports for Claude CEO mentor"""

    @classmethod
    def generate_context_report(
        cls,
        db: Session,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> str:
        """
        Generate comprehensive markdown report of all data.

        Args:
            db: Database session
            start_date: Filter data from this date (default: 30 days ago)
            end_date: Filter data to this date (default: today)

        Returns:
            Markdown formatted string
        """
        if not end_date:
            end_date = date.today()
        if not start_date:
            start_date = end_date - timedelta(days=30)

        report = []
        report.append(f"# Business Context Report - {start_date} to {end_date}")
        report.append("")
        report.append(f"*Generated on {datetime.now().strftime('%Y-%m-%d %H:%M')}*")
        report.append("")

        # Task Summary
        report.append("## Task Summary")
        report.append("")

        # Completed tasks - show all completed tasks regardless of date
        completed_tasks = db.query(Task).filter(
            Task.status == TaskStatus.COMPLETED
        ).all()

        report.append(f"### Completed Tasks ({len(completed_tasks)})")
        if completed_tasks:
            for task in completed_tasks:
                completed_date = task.completed_at.strftime('%Y-%m-%d') if task.completed_at else "N/A"
                report.append(f"- {task.title} - Completed {completed_date}")
        else:
            report.append("- No completed tasks in this period")
        report.append("")

        # Pending tasks
        pending_tasks = db.query(Task).filter(
            Task.status.in_([TaskStatus.PENDING, TaskStatus.IN_PROGRESS])
        ).all()

        report.append(f"### Pending Tasks ({len(pending_tasks)})")
        if pending_tasks:
            for task in pending_tasks:
                priority = f"[{task.priority.value.upper()}]" if task.priority else ""
                due = f"Due {task.due_date}" if task.due_date else "No due date"
                report.append(f"- {priority} {task.title} - {due}")
        else:
            report.append("- No pending tasks")
        report.append("")

        # Overdue tasks
        overdue_tasks = db.query(Task).filter(
            Task.status.in_([TaskStatus.PENDING, TaskStatus.IN_PROGRESS]),
            Task.due_date < date.today()
        ).all()

        report.append(f"### Overdue Tasks ({len(overdue_tasks)})")
        if overdue_tasks:
            for task in overdue_tasks:
                days_overdue = (date.today() - task.due_date).days
                report.append(f"- {task.title} - Due {task.due_date} - {days_overdue} days overdue")
        else:
            report.append("- No overdue tasks")
        report.append("")

        # CRM Overview
        report.append("## CRM Overview")
        report.append("")

        # Active deals
        active_deals = db.query(Deal).filter(
            Deal.stage.in_([
                DealStage.LEAD,
                DealStage.PROSPECT,
                DealStage.PROPOSAL,
                DealStage.NEGOTIATION
            ])
        ).all()

        total_pipeline_value = sum(deal.value or 0 for deal in active_deals)

        report.append(f"### Active Deals (Total Value: ${total_pipeline_value:,.2f})")
        report.append("")
        report.append("**Stage breakdown:**")

        # Group by stage
        stage_counts = {}
        stage_values = {}
        for deal in active_deals:
            stage = deal.stage.value
            stage_counts[stage] = stage_counts.get(stage, 0) + 1
            stage_values[stage] = stage_values.get(stage, Decimal(0)) + (deal.value or Decimal(0))

        for stage in [DealStage.LEAD, DealStage.PROSPECT, DealStage.PROPOSAL, DealStage.NEGOTIATION]:
            stage_name = stage.value.replace('_', ' ').title()
            count = stage_counts.get(stage.value, 0)
            value = stage_values.get(stage.value, Decimal(0))
            report.append(f"- {stage_name}: {count} deals (${value:,.2f})")

        report.append("")
        report.append("**Top deals:**")
        top_deals = sorted(active_deals, key=lambda d: d.value or 0, reverse=True)[:5]
        for deal in top_deals:
            contact = db.query(Contact).filter(Contact.id == deal.contact_id).first()
            contact_name = contact.name if contact else "Unknown"
            stage_name = deal.stage.value.replace('_', ' ').title()
            value = f"${deal.value:,.2f}" if deal.value else "N/A"
            close_date = deal.expected_close_date or "TBD"
            report.append(f"- {contact_name} - {deal.title} - Stage: {stage_name} - Value: {value} - Close: {close_date}")
        report.append("")

        # Recent interactions
        recent_interactions = db.query(Interaction).filter(
            Interaction.interaction_date >= start_date,
            Interaction.interaction_date <= end_date
        ).order_by(Interaction.interaction_date.desc()).limit(10).all()

        report.append(f"### Recent Interactions (Last {(end_date - start_date).days} days)")
        if recent_interactions:
            for interaction in recent_interactions:
                contact = db.query(Contact).filter(Contact.id == interaction.contact_id).first()
                contact_name = contact.name if contact else "Unknown"
                date_str = interaction.interaction_date.strftime('%Y-%m-%d')
                type_str = interaction.type.value.title()
                subject = interaction.subject or "No subject"
                report.append(f"- {date_str} - {type_str} with {contact_name}: {subject}")
        else:
            report.append("- No recent interactions")
        report.append("")

        # Pipeline Health
        report.append("### Pipeline Health")

        # Closed deals - show all closed deals regardless of date
        closed_won = db.query(Deal).filter(
            Deal.stage == DealStage.CLOSED_WON
        ).all()

        closed_lost = db.query(Deal).filter(
            Deal.stage == DealStage.CLOSED_LOST
        ).all()

        won_count = len(closed_won)
        lost_count = len(closed_lost)
        won_revenue = sum(deal.value or 0 for deal in closed_won)

        win_rate = (won_count / (won_count + lost_count) * 100) if (won_count + lost_count) > 0 else 0
        avg_deal_size = won_revenue / won_count if won_count > 0 else 0

        report.append(f"- Total active deals: {len(active_deals)}")
        report.append(f"- Closed won this period: {won_count} (${won_revenue:,.2f} revenue)")
        report.append(f"- Closed lost this period: {lost_count}")
        report.append(f"- Win rate: {win_rate:.1f}%")
        report.append(f"- Average deal size: ${avg_deal_size:,.2f}")
        report.append("")

        # Key Metrics
        report.append("## Key Metrics")
        report.append("")

        total_tasks = db.query(Task).count()
        task_completion_rate = (len(completed_tasks) / total_tasks * 100) if total_tasks > 0 else 0

        active_contacts = db.query(Contact).filter(
            Contact.status.in_(["lead", "prospect", "client"])
        ).count()

        report.append(f"- Task completion rate: {task_completion_rate:.1f}%")
        report.append(f"- Deals closed this period: {won_count}")
        report.append(f"- Revenue generated: ${won_revenue:,.2f}")
        report.append(f"- Active contacts: {active_contacts}")
        report.append(f"- Total pipeline value: ${total_pipeline_value:,.2f}")
        report.append("")

        return "\n".join(report)

    @classmethod
    def _get_stalled_deals(cls, db: Session, days: int = 14):
        """Get deals in active stages with no updates for N days"""
        from datetime import datetime, timedelta
        threshold = datetime.now() - timedelta(days=days)

        return db.query(Deal).filter(
            Deal.stage.in_([
                DealStage.LEAD,
                DealStage.PROSPECT,
                DealStage.PROPOSAL,
                DealStage.NEGOTIATION
            ]),
            Deal.updated_at < threshold
        ).all()

    @classmethod
    def _get_stuck_tasks(cls, db: Session, days: int = 7):
        """Get tasks in active status created more than N days ago"""
        from datetime import datetime, timedelta
        threshold = datetime.now() - timedelta(days=days)

        return db.query(Task).filter(
            Task.status.in_([TaskStatus.PENDING, TaskStatus.IN_PROGRESS]),
            Task.created_at < threshold
        ).all()

    @classmethod
    def _get_cold_contacts(cls, db: Session, days: int = 30):
        """Get contacts with active deals but no recent interactions"""
        from datetime import date, timedelta
        threshold = date.today() - timedelta(days=days)

        # Get contacts with active deals
        contacts_with_deals = db.query(Contact).join(Deal).filter(
            Deal.stage.in_([
                DealStage.LEAD,
                DealStage.PROSPECT,
                DealStage.PROPOSAL,
                DealStage.NEGOTIATION
            ])
        ).distinct().all()

        cold = []
        for contact in contacts_with_deals:
            last_interaction = db.query(Interaction).filter(
                Interaction.contact_id == contact.id
            ).order_by(Interaction.interaction_date.desc()).first()

            if not last_interaction or last_interaction.interaction_date < threshold:
                cold.append({
                    'contact': contact,
                    'last_interaction_date': last_interaction.interaction_date if last_interaction else None
                })

        return cold

    @classmethod
    def _calculate_activity_trends(cls, db: Session, start_date: date, end_date: date):
        """Calculate activity trends comparing current vs previous period"""
        from datetime import timedelta

        # Calculate period length
        period_length = (end_date - start_date).days
        prev_end = start_date
        prev_start = start_date - timedelta(days=period_length)

        # Tasks created
        tasks_current = db.query(Task).filter(
            Task.created_at >= start_date,
            Task.created_at <= end_date
        ).count()

        tasks_previous = db.query(Task).filter(
            Task.created_at >= prev_start,
            Task.created_at < prev_end
        ).count()

        # Deals created
        deals_current = db.query(Deal).filter(
            Deal.created_at >= start_date,
            Deal.created_at <= end_date
        ).count()

        deals_previous = db.query(Deal).filter(
            Deal.created_at >= prev_start,
            Deal.created_at < prev_end
        ).count()

        # Calculate percentage changes
        def calc_pct_change(current, previous):
            if previous == 0:
                return 0 if current == 0 else 100
            return ((current - previous) / previous) * 100

        return {
            'tasks_current': tasks_current,
            'tasks_previous': tasks_previous,
            'tasks_change_pct': calc_pct_change(tasks_current, tasks_previous),
            'deals_current': deals_current,
            'deals_previous': deals_previous,
            'deals_change_pct': calc_pct_change(deals_current, deals_previous),
        }

    @classmethod
    def _calculate_performance_metrics(cls, db: Session, start_date: date, end_date: date):
        """Calculate task completion rate and average completion time"""
        # Total tasks in period
        total_tasks = db.query(Task).filter(
            Task.created_at >= start_date,
            Task.created_at <= end_date
        ).count()

        # Completed tasks in period
        completed_tasks = db.query(Task).filter(
            Task.created_at >= start_date,
            Task.created_at <= end_date,
            Task.status == TaskStatus.COMPLETED
        ).count()

        completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0

        # Calculate average completion time for tasks completed in this period
        completed_with_times = db.query(Task).filter(
            Task.completed_at >= start_date,
            Task.completed_at <= end_date,
            Task.completed_at.isnot(None)
        ).all()

        if completed_with_times:
            completion_times = [
                (task.completed_at - task.created_at).days
                for task in completed_with_times
            ]
            avg_completion_time = sum(completion_times) / len(completion_times)
        else:
            avg_completion_time = 0

        return {
            'completion_rate': completion_rate,
            'avg_completion_time': avg_completion_time,
        }

    @classmethod
    def _generate_recommendations(cls, db: Session, start_date: date, end_date: date):
        """Generate strategic recommendations based on detected patterns"""
        recommendations = []

        # Check for stalled deals
        stalled_deals = cls._get_stalled_deals(db, days=14)
        if len(stalled_deals) >= 3:
            stages = list(set([deal.stage.value.replace('_', ' ').title() for deal in stalled_deals]))
            recommendations.append(
                f"Review and advance {len(stalled_deals)} stalled deals in {', '.join(stages)} stage(s)"
            )

        # Check win rate
        won_deals = db.query(Deal).filter(Deal.stage == DealStage.CLOSED_WON).count()
        lost_deals = db.query(Deal).filter(Deal.stage == DealStage.CLOSED_LOST).count()
        total_closed = won_deals + lost_deals
        win_rate = (won_deals / total_closed * 100) if total_closed > 0 else 0

        if win_rate < 40 and total_closed >= 5:
            recommendations.append(
                "Analyze lost deal patterns to improve conversion strategy"
            )

        # Check for overdue urgent tasks
        overdue_urgent = db.query(Task).filter(
            Task.status.in_([TaskStatus.PENDING, TaskStatus.IN_PROGRESS]),
            Task.due_date < date.today(),
            Task.priority == TaskPriority.URGENT
        ).all()

        if len(overdue_urgent) >= 5:
            recommendations.append(
                f"Clear {len(overdue_urgent)} urgent overdue tasks before adding new commitments"
            )

        # Check for high-value inactive deals
        inactive_threshold = datetime.now() - timedelta(days=14)

        inactive_high_value = db.query(Deal).filter(
            Deal.stage.in_([
                DealStage.LEAD,
                DealStage.PROSPECT,
                DealStage.PROPOSAL,
                DealStage.NEGOTIATION
            ]),
            Deal.value >= 10000,
            Deal.updated_at < inactive_threshold
        ).limit(2).all()

        for deal in inactive_high_value:
            contact = db.query(Contact).filter(Contact.id == deal.contact_id).first()
            days_inactive = (datetime.now() - deal.updated_at).days
            if contact:
                recommendations.append(
                    f"Schedule check-in with {contact.name} on '{deal.title}' (no activity in {days_inactive} days)"
                )

        # Check task completion rate
        metrics = cls._calculate_performance_metrics(db, start_date, end_date)
        if metrics['completion_rate'] < 50 and metrics['completion_rate'] > 0:
            recommendations.append(
                f"Review task load - only {metrics['completion_rate']:.0f}% completion rate suggests overcommitment"
            )

        return recommendations[:5]  # Max 5 recommendations
