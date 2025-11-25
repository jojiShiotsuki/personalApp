import os
import json
import logging
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
from anthropic import Anthropic

from app.models.task import Task, TaskStatus, TaskPriority
from app.models.crm import Deal, DealStage, Interaction, Contact
from app.models.social_content import SocialContent

logger = logging.getLogger(__name__)

class DashboardService:
    @staticmethod
    def get_briefing(db: Session) -> Dict[str, Any]:
        today = date.today()
        
        # 1. Greeting
        hour = datetime.now().hour
        if hour < 12:
            greeting = "Good morning"
        elif hour < 18:
            greeting = "Good afternoon"
        else:
            greeting = "Good evening"

        # 2. Today's Focus (Tasks due today or overdue, Meetings today)
        tasks_today = db.query(Task).filter(
            Task.status != TaskStatus.COMPLETED,
            or_(
                Task.due_date == today,
                and_(Task.due_date < today, Task.status != TaskStatus.COMPLETED)
            )
        ).order_by(Task.priority.desc(), Task.due_date).limit(5).all()

        meetings_today = db.query(Interaction).filter(
            func.date(Interaction.interaction_date) == today
        ).all()

        social_today = db.query(SocialContent).filter(
            SocialContent.content_date == today
        ).all()

        focus_items = []
        
        # Add meetings first
        for m in meetings_today:
            focus_items.append({
                "type": "meeting",
                "title": f"Meeting: {m.type} - {m.notes[:30] if m.notes else 'No details'}",
                "time": m.interaction_date.strftime("%H:%M") if m.interaction_date else "All day",
                "priority": "high"
            })

        # Add social content
        for s in social_today:
            focus_items.append({
                "type": "social",
                "title": f"Post: {s.content_type.replace('_', ' ').title()} ({s.status.replace('_', ' ')})",
                "priority": "medium"
            })

        # Add tasks
        for t in tasks_today:
            focus_items.append({
                "type": "task",
                "title": t.title,
                "priority": t.priority,
                "is_overdue": t.due_date < today if t.due_date else False
            })

        # 3. Key Findings (Simplified from ExportService)
        findings = []
        
        # Stalled Deals (>14 days no update)
        stalled_date = today - timedelta(days=14)
        stalled_deals_count = db.query(Deal).filter(
            Deal.stage.notin_([DealStage.CLOSED_WON, DealStage.CLOSED_LOST]),
            Deal.updated_at < stalled_date
        ).count()
        
        if stalled_deals_count > 0:
            findings.append(f"{stalled_deals_count} deals have stalled (no updates in 14+ days)")

        # Win Rate (Last 30 days)
        thirty_days_ago = today - timedelta(days=30)
        won = db.query(Deal).filter(
            Deal.stage == DealStage.CLOSED_WON,
            Deal.updated_at >= thirty_days_ago
        ).count()
        lost = db.query(Deal).filter(
            Deal.stage == DealStage.CLOSED_LOST,
            Deal.updated_at >= thirty_days_ago
        ).count()
        total_closed = won + lost
        
        if total_closed > 0:
            win_rate = int((won / total_closed) * 100)
            findings.append(f"Win rate is {win_rate}% over the last 30 days")

        # Task Velocity
        completed_today = db.query(Task).filter(
            Task.status == TaskStatus.COMPLETED,
            func.date(Task.updated_at) == today
        ).count()
        
        if completed_today > 0:
            findings.append(f"You've completed {completed_today} tasks today. Keep it up!")

        # 4. Summary Sentence
        summary_parts = []
        if len(tasks_today) > 0:
            summary_parts.append(f"{len(tasks_today)} tasks to handle")
        if len(meetings_today) > 0:
            summary_parts.append(f"{len(meetings_today)} meetings")
        if len(social_today) > 0:
            summary_parts.append(f"{len(social_today)} posts to publish")
            
        if not summary_parts:
            summary = "You're all caught up! No urgent items for today."
        else:
            summary = f"You have {', '.join(summary_parts)} today."

        return {
            "greeting": greeting,
            "summary": summary,
            "focus_items": focus_items,
            "key_findings": findings
        }

    @staticmethod
    def get_ai_briefing(db: Session) -> Dict[str, Any]:
        """
        Generate an AI-powered briefing with smart prioritization and insights.
        """
        today = date.today()
        now = datetime.now()

        # Greeting based on time
        hour = now.hour
        if hour < 12:
            greeting = "Good morning"
        elif hour < 18:
            greeting = "Good afternoon"
        else:
            greeting = "Good evening"

        # Gather comprehensive data for AI analysis

        # Tasks: overdue, due today, due this week, high priority
        overdue_tasks = db.query(Task).filter(
            Task.status != TaskStatus.COMPLETED,
            Task.due_date < today
        ).all()

        today_tasks = db.query(Task).filter(
            Task.status != TaskStatus.COMPLETED,
            Task.due_date == today
        ).all()

        high_priority_tasks = db.query(Task).filter(
            Task.status != TaskStatus.COMPLETED,
            Task.priority.in_([TaskPriority.HIGH, TaskPriority.URGENT])
        ).limit(10).all()

        # Deals: needing follow-up, high value, stalled
        deals_need_followup = db.query(Deal).filter(
            Deal.stage.notin_([DealStage.CLOSED_WON, DealStage.CLOSED_LOST]),
            Deal.next_followup_date <= today
        ).all()

        high_value_deals = db.query(Deal).filter(
            Deal.stage.notin_([DealStage.CLOSED_WON, DealStage.CLOSED_LOST]),
            Deal.value >= 10000
        ).order_by(Deal.value.desc()).limit(5).all()

        stalled_date = today - timedelta(days=14)
        stalled_deals = db.query(Deal).filter(
            Deal.stage.notin_([DealStage.CLOSED_WON, DealStage.CLOSED_LOST]),
            Deal.updated_at < stalled_date
        ).all()

        # Recent completions (for patterns)
        completed_this_week = db.query(Task).filter(
            Task.status == TaskStatus.COMPLETED,
            Task.completed_at >= today - timedelta(days=7)
        ).count()

        # Build data summary for AI
        data_for_ai = {
            "current_datetime": now.strftime("%Y-%m-%d %H:%M"),
            "day_of_week": now.strftime("%A"),
            "overdue_tasks": [
                {
                    "id": t.id,
                    "title": t.title,
                    "priority": t.priority.value if t.priority else "medium",
                    "due_date": t.due_date.isoformat() if t.due_date else None,
                    "days_overdue": (today - t.due_date).days if t.due_date else 0,
                    "created_at": t.created_at.isoformat() if t.created_at else None
                }
                for t in overdue_tasks
            ],
            "today_tasks": [
                {
                    "id": t.id,
                    "title": t.title,
                    "priority": t.priority.value if t.priority else "medium",
                    "due_time": t.due_time
                }
                for t in today_tasks
            ],
            "high_priority_tasks": [
                {
                    "id": t.id,
                    "title": t.title,
                    "priority": t.priority.value if t.priority else "medium",
                    "due_date": t.due_date.isoformat() if t.due_date else None
                }
                for t in high_priority_tasks
            ],
            "deals_needing_followup": [
                {
                    "id": d.id,
                    "title": d.title,
                    "value": d.value,
                    "stage": d.stage.value if d.stage else None,
                    "next_followup_date": d.next_followup_date.isoformat() if d.next_followup_date else None,
                    "followup_count": d.followup_count
                }
                for d in deals_need_followup
            ],
            "high_value_deals": [
                {
                    "id": d.id,
                    "title": d.title,
                    "value": d.value,
                    "stage": d.stage.value if d.stage else None
                }
                for d in high_value_deals
            ],
            "stalled_deals": [
                {
                    "id": d.id,
                    "title": d.title,
                    "value": d.value,
                    "days_since_update": (today - d.updated_at.date()).days if d.updated_at else 0
                }
                for d in stalled_deals
            ],
            "stats": {
                "tasks_completed_this_week": completed_this_week,
                "total_overdue": len(overdue_tasks),
                "total_deals_needing_attention": len(deals_need_followup) + len(stalled_deals)
            }
        }

        # Call AI to analyze and prioritize
        ai_response = DashboardService._analyze_with_ai(data_for_ai)

        if ai_response:
            return {
                "greeting": greeting,
                "summary": ai_response.get("summary", "Here's your daily overview."),
                "priority_items": ai_response.get("priority_items", []),
                "ai_observations": ai_response.get("observations", [])
            }

        # Fallback if AI fails
        return DashboardService._build_fallback_briefing(
            greeting, overdue_tasks, today_tasks, deals_need_followup
        )

    @staticmethod
    def _analyze_with_ai(data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Use Claude to analyze data and generate prioritized insights.
        """
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            logger.warning("No ANTHROPIC_API_KEY set, using fallback briefing")
            return None

        try:
            client = Anthropic(api_key=api_key)

            prompt = f"""Analyze this productivity data and create a prioritized daily briefing.

DATA:
{json.dumps(data, indent=2)}

Return a JSON object with this exact structure:
{{
  "summary": "A brief, encouraging 1-2 sentence summary of the day ahead",
  "priority_items": [
    {{
      "id": <item id>,
      "type": "task" or "deal",
      "title": "<item title>",
      "why_priority": "<brief reason this is priority, e.g. 'Overdue by 3 days'>",
      "priority_score": <1-100, higher = more urgent>,
      "insight": "<optional personalized insight or suggestion>",
      "suggested_actions": ["complete", "reschedule", "delegate"] or ["log_followup", "snooze", "schedule_call"],
      "context_for_chat": "<brief context if user wants to discuss>"
    }}
  ],
  "observations": [
    "<smart observation about patterns or suggestions>"
  ]
}}

Rules:
- Return ONLY valid JSON, no other text
- Include max 5 priority items, ranked by urgency
- Priority score: 90+ for overdue/urgent, 70-89 for due today/high priority, 50-69 for upcoming
- Keep insights brief and actionable
- Observations should be pattern-based insights (max 3)
- If no items need attention, return empty priority_items array with encouraging summary"""

            response = client.messages.create(
                model=os.getenv("ANTHROPIC_MODEL", "claude-3-haiku-20240307"),
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}]
            )

            # Parse JSON from response
            response_text = response.content[0].text.strip()

            # Try to extract JSON if wrapped in markdown
            if response_text.startswith("```"):
                lines = response_text.split("\n")
                json_lines = []
                in_json = False
                for line in lines:
                    if line.startswith("```") and not in_json:
                        in_json = True
                        continue
                    elif line.startswith("```") and in_json:
                        break
                    elif in_json:
                        json_lines.append(line)
                response_text = "\n".join(json_lines)

            return json.loads(response_text)

        except Exception as e:
            logger.error(f"AI analysis failed: {e}")
            return None

    @staticmethod
    def _build_fallback_briefing(
        greeting: str,
        overdue_tasks: List[Task],
        today_tasks: List[Task],
        deals_need_followup: List[Deal]
    ) -> Dict[str, Any]:
        """
        Build a basic briefing when AI is unavailable.
        """
        today = date.today()
        priority_items = []

        # Add overdue tasks
        for t in overdue_tasks[:3]:
            days_overdue = (today - t.due_date).days if t.due_date else 0
            priority_items.append({
                "id": t.id,
                "type": "task",
                "title": t.title,
                "why_priority": f"Overdue by {days_overdue} day{'s' if days_overdue != 1 else ''}",
                "priority_score": min(95, 80 + days_overdue * 2),
                "insight": None,
                "suggested_actions": ["complete", "reschedule"],
                "context_for_chat": f"{t.title} task, overdue {days_overdue} days"
            })

        # Add today's tasks
        for t in today_tasks[:2]:
            priority_items.append({
                "id": t.id,
                "type": "task",
                "title": t.title,
                "why_priority": "Due today",
                "priority_score": 75,
                "insight": None,
                "suggested_actions": ["complete", "reschedule"],
                "context_for_chat": f"{t.title} task, due today"
            })

        # Add deals needing follow-up
        for d in deals_need_followup[:2]:
            priority_items.append({
                "id": d.id,
                "type": "deal",
                "title": d.title,
                "why_priority": "Follow-up needed",
                "priority_score": 70,
                "insight": None,
                "suggested_actions": ["log_followup", "snooze", "schedule_call"],
                "context_for_chat": f"{d.title} deal, needs follow-up"
            })

        # Sort by priority score
        priority_items.sort(key=lambda x: x["priority_score"], reverse=True)

        total_items = len(overdue_tasks) + len(today_tasks) + len(deals_need_followup)
        if total_items == 0:
            summary = "You're all caught up! No urgent items today."
        else:
            summary = f"You have {total_items} items that need attention today."

        return {
            "greeting": greeting,
            "summary": summary,
            "priority_items": priority_items[:5],
            "ai_observations": []
        }
