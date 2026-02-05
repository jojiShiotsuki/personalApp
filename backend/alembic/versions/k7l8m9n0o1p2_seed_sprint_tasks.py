"""seed sprint tasks

Revision ID: k7l8m9n0o1p2
Revises: j6k7l8m9n0o1
Create Date: 2026-02-05 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from datetime import datetime, timedelta


# revision identifiers, used by Alembic.
revision: str = 'k7l8m9n0o1p2'
down_revision: Union[str, None] = 'j6k7l8m9n0o1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TASKS = {
    1: ["Screenshot Pundok Studios #1 Google ranking", "Screenshot You% Nutrition #1 Google ranking"],
    2: ["Message Pundok Studios for testimonial", "Message You% for testimonial", "Message Best Roofing Now for testimonial"],
    3: ["Update LinkedIn headline: AU tradies focus", "Update LinkedIn About section with proof"],
    4: ["Create portfolio page focused on tradies", "Add case studies to portfolio"],
    5: ["Find 25 tradies with bad websites (HiPages)", "Find 25 tradies with bad websites (Google Maps)"],
    6: ["Write 5 personalised cold emails", "Prepare email templates in outreach tool"],
    7: ["Send 5 cold emails", "Send 10 LinkedIn connection requests"],
    8: ["Send 10 cold emails", "Send 10 LinkedIn connections"],
    9: ["Follow up Day 1-5 emails", "Send 10 new LinkedIn connections"],
    10: ["Send 10 cold emails", "Record 2 Loom audits for hot prospects"],
    11: ["Send 10 cold emails", "Send 10 LinkedIn connections"],
    12: ["Send break-up emails to Week 1 non-responders", "Review which email templates work best"],
    13: ["Find 10 AU marketing agencies", "Send 10 agency outreach emails"],
    14: ["Review all responses", "Book discovery calls", "Adjust messaging based on feedback"],
    15: ["Send 10 cold emails", "Follow up LinkedIn connections"],
    16: ["Send 10 cold emails", "Send 10 LinkedIn connections"],
    17: ["Record 3 Loom audits for engaged prospects", "Send Loom videos to prospects"],
    18: ["Send 10 cold emails", "Follow up with agencies"],
    19: ["Send 10 cold emails", "Send 10 LinkedIn connections"],
    20: ["Send break-up emails to all non-responders", "Clean up prospect list"],
    21: ["Review results and metrics", "Refine scripts based on what's working", "Document winning approaches"],
    22: ["Send 10 cold emails", "Send 10 LinkedIn connections"],
    23: ["Send Loom audits to warm leads", "Book discovery calls"],
    24: ["Conduct 2-3 discovery calls (SPIN framework)", "Present offers on calls"],
    25: ["Send 2-3 proposals to interested prospects", "Follow up previous proposals"],
    26: ["Follow up proposals", "Handle objections", "Close deals"],
    27: ["Send 10 cold emails", "Send 10 LinkedIn connections"],
    28: ["Conduct discovery calls", "Follow up all proposals"],
    29: ["Close deals", "Collect deposits", "Onboard new clients"],
    30: ["Review entire month", "Document what worked", "Plan next month's sprint", "Celebrate wins!"],
}


def upgrade() -> None:
    conn = op.get_bind()

    # Check if sprint already exists
    result = conn.execute(sa.text("SELECT id FROM sprints WHERE title = '30-Day Client Acquisition Sprint' LIMIT 1"))
    existing = result.fetchone()
    if existing:
        return  # Sprint already seeded

    now = datetime.utcnow()
    start_date = now.date()
    end_date = start_date + timedelta(days=29)

    # Create the sprint
    conn.execute(sa.text("""
        INSERT INTO sprints (title, description, status, start_date, end_date, created_at, updated_at)
        VALUES (:title, :description, :status, :start_date, :end_date, :created_at, :updated_at)
    """), {
        "title": "30-Day Client Acquisition Sprint",
        "description": "Intensive 30-day sprint to acquire new clients through cold outreach",
        "status": "active",
        "start_date": start_date,
        "end_date": end_date,
        "created_at": now,
        "updated_at": now
    })

    # Get the sprint ID
    result = conn.execute(sa.text("SELECT id FROM sprints WHERE title = '30-Day Client Acquisition Sprint'"))
    sprint_id = result.fetchone()[0]

    # Create 30 sprint days
    for day_num in range(1, 31):
        week_num = ((day_num - 1) // 7) + 1
        if week_num > 4:
            week_num = 4
        log_date = start_date + timedelta(days=day_num - 1)

        conn.execute(sa.text("""
            INSERT INTO sprint_days (sprint_id, day_number, week_number, log_date, is_complete, created_at, updated_at)
            VALUES (:sprint_id, :day_number, :week_number, :log_date, :is_complete, :created_at, :updated_at)
        """), {
            "sprint_id": sprint_id,
            "day_number": day_num,
            "week_number": week_num,
            "log_date": log_date,
            "is_complete": False,
            "created_at": now,
            "updated_at": now
        })

    # Get sprint day IDs
    result = conn.execute(sa.text("""
        SELECT id, day_number FROM sprint_days WHERE sprint_id = :sprint_id ORDER BY day_number
    """), {"sprint_id": sprint_id})
    day_ids = {row[1]: row[0] for row in result.fetchall()}

    # Create tasks for each day
    for day_num, task_titles in TASKS.items():
        sprint_day_id = day_ids.get(day_num)
        if sprint_day_id:
            for title in task_titles:
                conn.execute(sa.text("""
                    INSERT INTO tasks (title, status, priority, sprint_day_id, is_recurring, created_at, updated_at)
                    VALUES (:title, :status, :priority, :sprint_day_id, :is_recurring, :created_at, :updated_at)
                """), {
                    "title": title,
                    "status": "PENDING",
                    "priority": "MEDIUM",
                    "sprint_day_id": sprint_day_id,
                    "is_recurring": False,
                    "created_at": now,
                    "updated_at": now
                })


def downgrade() -> None:
    conn = op.get_bind()

    # Get sprint ID
    result = conn.execute(sa.text("SELECT id FROM sprints WHERE title = '30-Day Client Acquisition Sprint'"))
    row = result.fetchone()
    if not row:
        return

    sprint_id = row[0]

    # Delete tasks linked to sprint days
    conn.execute(sa.text("""
        DELETE FROM tasks WHERE sprint_day_id IN (
            SELECT id FROM sprint_days WHERE sprint_id = :sprint_id
        )
    """), {"sprint_id": sprint_id})

    # Delete sprint days
    conn.execute(sa.text("DELETE FROM sprint_days WHERE sprint_id = :sprint_id"), {"sprint_id": sprint_id})

    # Delete sprint
    conn.execute(sa.text("DELETE FROM sprints WHERE id = :sprint_id"), {"sprint_id": sprint_id})
