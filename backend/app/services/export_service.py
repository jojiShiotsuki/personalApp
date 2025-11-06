from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date, timedelta
from typing import Optional
from decimal import Decimal

from app.models.task import Task, TaskStatus
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

        # Completed tasks
        completed_tasks = db.query(Task).filter(
            Task.status == TaskStatus.COMPLETED,
            Task.completed_at >= start_date,
            Task.completed_at <= end_date
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

        # Closed deals in date range
        closed_won = db.query(Deal).filter(
            Deal.stage == DealStage.CLOSED_WON,
            Deal.actual_close_date >= start_date,
            Deal.actual_close_date <= end_date
        ).all()

        closed_lost = db.query(Deal).filter(
            Deal.stage == DealStage.CLOSED_LOST,
            Deal.actual_close_date >= start_date,
            Deal.actual_close_date <= end_date
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
