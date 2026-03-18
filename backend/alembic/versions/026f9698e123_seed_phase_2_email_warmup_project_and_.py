"""seed phase 2 email warmup project and tasks

Revision ID: 026f9698e123
Revises: d5b441059794
Create Date: 2026-03-18 08:42:40.992975

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from datetime import datetime


# revision identifiers, used by Alembic.
revision: str = '026f9698e123'
down_revision: Union[str, None] = 'd5b441059794'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (title, description, due_date, priority)
TASKS = [
    ('Day 22: Send 20 Step 1 cold emails', 'Target: 20 emails sent', '2026-03-18', 'high'),
    ('Day 22: Process all sequence steps due today (Steps 3-7)', 'Target: All steps actioned', '2026-03-18', 'medium'),
    ('Day 22: Check Mailsuite: review opens, note who opened multiple times or reopened', 'Target: Hot prospects noted', '2026-03-18', 'medium'),
    ('Day 22: Check Google Postmaster Tools: domain reputation must show High, spam rate must stay under 0.1%', 'Target: Reputation confirmed', '2026-03-18', 'medium'),
    ('Day 23: Send 20 Step 1 cold emails', 'Target: 20 emails sent', '2026-03-19', 'high'),
    ('Day 23: Process all sequence steps due today (Steps 3-7)', 'Target: All steps actioned', '2026-03-19', 'medium'),
    ('Day 23: Check Mailsuite: review opens, note who opened multiple times or reopened', 'Target: Hot prospects noted', '2026-03-19', 'medium'),
    ('Day 23: Check Google Postmaster Tools: domain reputation must show High, spam rate must stay under 0.1%', 'Target: Reputation confirmed', '2026-03-19', 'medium'),
    ('Day 24: Send 20 Step 1 cold emails', 'Target: 20 emails sent', '2026-03-20', 'high'),
    ('Day 24: Process all sequence steps due today (Steps 3-7)', 'Target: All steps actioned', '2026-03-20', 'medium'),
    ('Day 24: Check Mailsuite: review opens, note who opened multiple times or reopened', 'Target: Hot prospects noted', '2026-03-20', 'medium'),
    ('Day 24: Check Google Postmaster Tools: domain reputation must show High, spam rate must stay under 0.1%', 'Target: Reputation confirmed', '2026-03-20', 'medium'),
    ('Day 25: Send 20 Step 1 cold emails', 'Target: 20 emails sent', '2026-03-21', 'high'),
    ('Day 25: Process all sequence steps due today (Steps 3-7)', 'Target: All steps actioned', '2026-03-21', 'medium'),
    ('Day 25: Check Mailsuite: review opens, note who opened multiple times or reopened', 'Target: Hot prospects noted', '2026-03-21', 'medium'),
    ('Day 25: Check Google Postmaster Tools: domain reputation must show High, spam rate must stay under 0.1%', 'Target: Reputation confirmed', '2026-03-21', 'medium'),
    ('Day 26: Send 20 Step 1 cold emails', 'Target: 20 emails sent', '2026-03-22', 'high'),
    ('Day 26: Process all sequence steps due today (Steps 3-7)', 'Target: All steps actioned', '2026-03-22', 'medium'),
    ('Day 26: Check Mailsuite: review opens, note who opened multiple times or reopened', 'Target: Hot prospects noted', '2026-03-22', 'medium'),
    ('Day 26: Check Google Postmaster Tools: domain reputation must show High, spam rate must stay under 0.1%', 'Target: Reputation confirmed', '2026-03-22', 'medium'),
    ('Day 27: Send 20 Step 1 cold emails', 'Target: 20 emails sent', '2026-03-23', 'high'),
    ('Day 27: Process all sequence steps due today (Steps 3-7)', 'Target: All steps actioned', '2026-03-23', 'medium'),
    ('Day 27: Check Mailsuite: review opens, note who opened multiple times or reopened', 'Target: Hot prospects noted', '2026-03-23', 'medium'),
    ('Day 27: Check Google Postmaster Tools: domain reputation must show High, spam rate must stay under 0.1%', 'Target: Reputation confirmed', '2026-03-23', 'medium'),
    ('Day 28: Send 20 Step 1 cold emails', 'Target: 20 emails sent', '2026-03-24', 'high'),
    ('Day 28: Process all sequence steps due today (Steps 3-7)', 'Target: All steps actioned', '2026-03-24', 'medium'),
    ('Day 28: Check Mailsuite: review opens, note who opened multiple times or reopened', 'Target: Hot prospects noted', '2026-03-24', 'medium'),
    ('Day 28: Check Google Postmaster Tools: domain reputation must show High, spam rate must stay under 0.1%', 'Target: Reputation confirmed', '2026-03-24', 'medium'),
    ('Day 28: Full deliverability check: SPF, DKIM, DMARC + Blacklist at mxtoolbox.com', 'Target: All green confirmed', '2026-03-24', 'high'),
    ('Day 28: Weekly review: total emails sent, replies, reply rate, calls booked, revenue', 'Target: Metrics recorded', '2026-03-24', 'high'),
    ('Day 29: Send 25 Step 1 cold emails', 'Target: 25 emails sent', '2026-03-25', 'high'),
    ('Day 29: Process all sequence steps due today (Steps 3-7)', 'Target: All steps actioned', '2026-03-25', 'medium'),
    ('Day 29: Check Mailsuite: review opens, note who opened multiple times or reopened', 'Target: Hot prospects noted', '2026-03-25', 'medium'),
    ('Day 29: Check Google Postmaster Tools: domain reputation must show High, spam rate must stay under 0.1%', 'Target: Reputation confirmed', '2026-03-25', 'medium'),
    ('Day 30: Send 25 Step 1 cold emails', 'Target: 25 emails sent', '2026-03-26', 'high'),
    ('Day 30: Process all sequence steps due today (Steps 3-7)', 'Target: All steps actioned', '2026-03-26', 'medium'),
    ('Day 30: Check Mailsuite: review opens, note who opened multiple times or reopened', 'Target: Hot prospects noted', '2026-03-26', 'medium'),
    ('Day 30: Check Google Postmaster Tools: domain reputation must show High, spam rate must stay under 0.1%', 'Target: Reputation confirmed', '2026-03-26', 'medium'),
    ('Day 31: Send 25 Step 1 cold emails', 'Target: 25 emails sent', '2026-03-27', 'high'),
    ('Day 31: Process all sequence steps due today (Steps 3-7)', 'Target: All steps actioned', '2026-03-27', 'medium'),
    ('Day 31: Check Mailsuite: review opens, note who opened multiple times or reopened', 'Target: Hot prospects noted', '2026-03-27', 'medium'),
    ('Day 31: Check Google Postmaster Tools: domain reputation must show High, spam rate must stay under 0.1%', 'Target: Reputation confirmed', '2026-03-27', 'medium'),
    ('Day 32: Send 25 Step 1 cold emails', 'Target: 25 emails sent', '2026-03-28', 'high'),
    ('Day 32: Process all sequence steps due today (Steps 3-7)', 'Target: All steps actioned', '2026-03-28', 'medium'),
    ('Day 32: Check Mailsuite: review opens, note who opened multiple times or reopened', 'Target: Hot prospects noted', '2026-03-28', 'medium'),
    ('Day 32: Check Google Postmaster Tools: domain reputation must show High, spam rate must stay under 0.1%', 'Target: Reputation confirmed', '2026-03-28', 'medium'),
    ('Day 33: Send 25 Step 1 cold emails', 'Target: 25 emails sent', '2026-03-29', 'high'),
    ('Day 33: Process all sequence steps due today (Steps 3-7)', 'Target: All steps actioned', '2026-03-29', 'medium'),
    ('Day 33: Check Mailsuite: review opens, note who opened multiple times or reopened', 'Target: Hot prospects noted', '2026-03-29', 'medium'),
    ('Day 33: Check Google Postmaster Tools: domain reputation must show High, spam rate must stay under 0.1%', 'Target: Reputation confirmed', '2026-03-29', 'medium'),
    ('Day 34: Send 25 Step 1 cold emails', 'Target: 25 emails sent', '2026-03-30', 'high'),
    ('Day 34: Process all sequence steps due today (Steps 3-7)', 'Target: All steps actioned', '2026-03-30', 'medium'),
    ('Day 34: Check Mailsuite: review opens, note who opened multiple times or reopened', 'Target: Hot prospects noted', '2026-03-30', 'medium'),
    ('Day 34: Check Google Postmaster Tools: domain reputation must show High, spam rate must stay under 0.1%', 'Target: Reputation confirmed', '2026-03-30', 'medium'),
    ('Day 35: Send 25 Step 1 cold emails', 'Target: 25 emails sent', '2026-03-31', 'high'),
    ('Day 35: Process all sequence steps due today (Steps 3-7)', 'Target: All steps actioned', '2026-03-31', 'medium'),
    ('Day 35: Check Mailsuite: review opens, note who opened multiple times or reopened', 'Target: Hot prospects noted', '2026-03-31', 'medium'),
    ('Day 35: Check Google Postmaster Tools: domain reputation must show High, spam rate must stay under 0.1%', 'Target: Reputation confirmed', '2026-03-31', 'medium'),
    ('Day 35: Full deliverability check: SPF, DKIM, DMARC + Blacklist at mxtoolbox.com', 'Target: All green confirmed', '2026-03-31', 'high'),
    ('Day 35: Weekly review: total emails sent, replies, reply rate, calls booked, revenue', 'Target: Metrics recorded', '2026-03-31', 'high'),
    ('Day 35: Load 100 new prospects into Apollo', 'Target: 100 prospects loaded', '2026-03-31', 'medium'),
    ('Day 36: Send 30 Step 1 cold emails', 'Target: 30 emails sent', '2026-04-01', 'high'),
    ('Day 36: Process all sequence steps due today (Steps 3-7)', 'Target: All steps actioned', '2026-04-01', 'medium'),
    ('Day 36: Check Mailsuite: review opens, note who opened multiple times or reopened', 'Target: Hot prospects noted', '2026-04-01', 'medium'),
    ('Day 36: Check Google Postmaster Tools: domain reputation must show High, spam rate must stay under 0.1%', 'Target: Reputation confirmed', '2026-04-01', 'medium'),
    ('Day 37: Send 30 Step 1 cold emails', 'Target: 30 emails sent', '2026-04-02', 'high'),
    ('Day 37: Process all sequence steps due today (Steps 3-7)', 'Target: All steps actioned', '2026-04-02', 'medium'),
    ('Day 37: Check Mailsuite: review opens, note who opened multiple times or reopened', 'Target: Hot prospects noted', '2026-04-02', 'medium'),
    ('Day 37: Check Google Postmaster Tools: domain reputation must show High, spam rate must stay under 0.1%', 'Target: Reputation confirmed', '2026-04-02', 'medium'),
    ('Day 38: Send 30 Step 1 cold emails', 'Target: 30 emails sent', '2026-04-03', 'high'),
    ('Day 38: Process all sequence steps due today (Steps 3-7)', 'Target: All steps actioned', '2026-04-03', 'medium'),
    ('Day 38: Check Mailsuite: review opens, note who opened multiple times or reopened', 'Target: Hot prospects noted', '2026-04-03', 'medium'),
    ('Day 38: Check Google Postmaster Tools: domain reputation must show High, spam rate must stay under 0.1%', 'Target: Reputation confirmed', '2026-04-03', 'medium'),
    ('Day 39: Send 30 Step 1 cold emails', 'Target: 30 emails sent', '2026-04-04', 'high'),
    ('Day 39: Process all sequence steps due today (Steps 3-7)', 'Target: All steps actioned', '2026-04-04', 'medium'),
    ('Day 39: Check Mailsuite: review opens, note who opened multiple times or reopened', 'Target: Hot prospects noted', '2026-04-04', 'medium'),
    ('Day 39: Check Google Postmaster Tools: domain reputation must show High, spam rate must stay under 0.1%', 'Target: Reputation confirmed', '2026-04-04', 'medium'),
    ('Day 40: Send 30 Step 1 cold emails', 'Target: 30 emails sent', '2026-04-05', 'high'),
    ('Day 40: Process all sequence steps due today (Steps 3-7)', 'Target: All steps actioned', '2026-04-05', 'medium'),
    ('Day 40: Check Mailsuite: review opens, note who opened multiple times or reopened', 'Target: Hot prospects noted', '2026-04-05', 'medium'),
    ('Day 40: Check Google Postmaster Tools: domain reputation must show High, spam rate must stay under 0.1%', 'Target: Reputation confirmed', '2026-04-05', 'medium'),
    ('Day 41: Send 30 Step 1 cold emails', 'Target: 30 emails sent', '2026-04-06', 'high'),
    ('Day 41: Process all sequence steps due today (Steps 3-7)', 'Target: All steps actioned', '2026-04-06', 'medium'),
    ('Day 41: Check Mailsuite: review opens, note who opened multiple times or reopened', 'Target: Hot prospects noted', '2026-04-06', 'medium'),
    ('Day 41: Check Google Postmaster Tools: domain reputation must show High, spam rate must stay under 0.1%', 'Target: Reputation confirmed', '2026-04-06', 'medium'),
    ('Day 42: Send 30 Step 1 cold emails', 'Target: 30 emails sent', '2026-04-07', 'high'),
    ('Day 42: Process all sequence steps due today (Steps 3-7)', 'Target: All steps actioned', '2026-04-07', 'medium'),
    ('Day 42: Check Mailsuite: review opens, note who opened multiple times or reopened', 'Target: Hot prospects noted', '2026-04-07', 'medium'),
    ('Day 42: Check Google Postmaster Tools: domain reputation must show High, spam rate must stay under 0.1%', 'Target: Reputation confirmed', '2026-04-07', 'medium'),
    ('Day 42: Full deliverability check: SPF, DKIM, DMARC + Blacklist at mxtoolbox.com', 'Target: All green confirmed', '2026-04-07', 'high'),
    ('Day 42: Weekly review: total emails sent, replies, reply rate, calls booked, revenue', 'Target: Metrics recorded', '2026-04-07', 'high'),
    ('Day 42: Load 100 new prospects into Apollo', 'Target: 100 prospects loaded', '2026-04-07', 'medium'),
    ('Day 43: Send 40 Step 1 cold emails', 'Target: 40 emails sent', '2026-04-08', 'high'),
    ('Day 43: Process all sequence steps due today (Steps 3-7)', 'Target: All steps actioned', '2026-04-08', 'medium'),
    ('Day 43: Check Mailsuite: review opens, note who opened multiple times or reopened', 'Target: Hot prospects noted', '2026-04-08', 'medium'),
    ('Day 43: Check Google Postmaster Tools: domain reputation must show High, spam rate must stay under 0.1%', 'Target: Reputation confirmed', '2026-04-08', 'medium'),
    ('Day 44: Send 40 Step 1 cold emails', 'Target: 40 emails sent', '2026-04-09', 'high'),
    ('Day 44: Process all sequence steps due today (Steps 3-7)', 'Target: All steps actioned', '2026-04-09', 'medium'),
    ('Day 44: Check Mailsuite: review opens, note who opened multiple times or reopened', 'Target: Hot prospects noted', '2026-04-09', 'medium'),
    ('Day 44: Check Google Postmaster Tools: domain reputation must show High, spam rate must stay under 0.1%', 'Target: Reputation confirmed', '2026-04-09', 'medium'),
    ('Day 45: Send 40 Step 1 cold emails', 'Target: 40 emails sent', '2026-04-10', 'high'),
    ('Day 45: Process all sequence steps due today (Steps 3-7)', 'Target: All steps actioned', '2026-04-10', 'medium'),
    ('Day 45: Check Mailsuite: review opens, note who opened multiple times or reopened', 'Target: Hot prospects noted', '2026-04-10', 'medium'),
    ('Day 45: Check Google Postmaster Tools: domain reputation must show High, spam rate must stay under 0.1%', 'Target: Reputation confirmed', '2026-04-10', 'medium'),
    ('Day 46: Send 40 Step 1 cold emails', 'Target: 40 emails sent', '2026-04-11', 'high'),
    ('Day 46: Process all sequence steps due today (Steps 3-7)', 'Target: All steps actioned', '2026-04-11', 'medium'),
    ('Day 46: Check Mailsuite: review opens, note who opened multiple times or reopened', 'Target: Hot prospects noted', '2026-04-11', 'medium'),
    ('Day 46: Check Google Postmaster Tools: domain reputation must show High, spam rate must stay under 0.1%', 'Target: Reputation confirmed', '2026-04-11', 'medium'),
    ('Day 47: Send 40 Step 1 cold emails', 'Target: 40 emails sent', '2026-04-12', 'high'),
    ('Day 47: Process all sequence steps due today (Steps 3-7)', 'Target: All steps actioned', '2026-04-12', 'medium'),
    ('Day 47: Check Mailsuite: review opens, note who opened multiple times or reopened', 'Target: Hot prospects noted', '2026-04-12', 'medium'),
    ('Day 47: Check Google Postmaster Tools: domain reputation must show High, spam rate must stay under 0.1%', 'Target: Reputation confirmed', '2026-04-12', 'medium'),
    ('Day 48: Send 40 Step 1 cold emails', 'Target: 40 emails sent', '2026-04-13', 'high'),
    ('Day 48: Process all sequence steps due today (Steps 3-7)', 'Target: All steps actioned', '2026-04-13', 'medium'),
    ('Day 48: Check Mailsuite: review opens, note who opened multiple times or reopened', 'Target: Hot prospects noted', '2026-04-13', 'medium'),
    ('Day 48: Check Google Postmaster Tools: domain reputation must show High, spam rate must stay under 0.1%', 'Target: Reputation confirmed', '2026-04-13', 'medium'),
    ('Day 49: Send 40 Step 1 cold emails', 'Target: 40 emails sent', '2026-04-14', 'high'),
    ('Day 49: Process all sequence steps due today (Steps 3-7)', 'Target: All steps actioned', '2026-04-14', 'medium'),
    ('Day 49: Check Mailsuite: review opens, note who opened multiple times or reopened', 'Target: Hot prospects noted', '2026-04-14', 'medium'),
    ('Day 49: Check Google Postmaster Tools: domain reputation must show High, spam rate must stay under 0.1%', 'Target: Reputation confirmed', '2026-04-14', 'medium'),
    ('Day 49: Full deliverability check: SPF, DKIM, DMARC + Blacklist at mxtoolbox.com', 'Target: All green confirmed', '2026-04-14', 'high'),
    ('Day 49: Weekly review: total emails sent, replies, reply rate, calls booked, revenue', 'Target: Metrics recorded', '2026-04-14', 'high'),
    ('Day 49: Load 100 new prospects into Apollo', 'Target: 100 prospects loaded', '2026-04-14', 'medium'),
    ('Day 50: Send 50 Step 1 cold emails', 'Target: 50 emails sent', '2026-04-15', 'high'),
    ('Day 50: Process all sequence steps due today (Steps 3-7)', 'Target: All steps actioned', '2026-04-15', 'medium'),
    ('Day 50: Check Mailsuite: review opens, note who opened multiple times or reopened', 'Target: Hot prospects noted', '2026-04-15', 'medium'),
    ('Day 50: Check Google Postmaster Tools: domain reputation must show High, spam rate must stay under 0.1%', 'Target: Reputation confirmed', '2026-04-15', 'medium'),
    ('Day 51: Send 50 Step 1 cold emails', 'Target: 50 emails sent', '2026-04-16', 'high'),
    ('Day 51: Process all sequence steps due today (Steps 3-7)', 'Target: All steps actioned', '2026-04-16', 'medium'),
    ('Day 51: Check Mailsuite: review opens, note who opened multiple times or reopened', 'Target: Hot prospects noted', '2026-04-16', 'medium'),
    ('Day 51: Check Google Postmaster Tools: domain reputation must show High, spam rate must stay under 0.1%', 'Target: Reputation confirmed', '2026-04-16', 'medium'),
]


def upgrade() -> None:
    conn = op.get_bind()
    now = datetime.utcnow().isoformat()

    # Check if project already exists (idempotent)
    result = conn.execute(
        sa.text("SELECT id FROM projects WHERE name = :name"),
        {"name": "Phase 2 Email Warmup and Cold Outreach"}
    ).fetchone()

    if result:
        return  # Already seeded

    # Detect dialect to handle enum differences (SQLite uses lowercase, PostgreSQL uses uppercase)
    dialect = conn.dialect.name
    if dialect == 'sqlite':
        proj_status = 'active'
        task_status_val = 'pending'
        def task_priority_val(p): return p  # 'high', 'medium' etc.
    else:
        proj_status = 'IN_PROGRESS'
        task_status_val = 'PENDING'
        def task_priority_val(p): return p.upper()  # 'HIGH', 'MEDIUM' etc.

    # Insert project
    conn.execute(sa.text(
        "INSERT INTO projects (name, description, status, created_at, updated_at) "
        "VALUES (:name, :desc, :status, :created, :updated)"
    ), {
        "name": "Phase 2 Email Warmup and Cold Outreach",
        "desc": "Days 22-51 Outreach Task Plan. Volume ramp: 20/day (Days 22-28) > 25/day (29-35) > 30/day (36-42) > 40/day (43-49) > 50/day (50-51). Target by Day 51: 1,000+ Step 1 emails sent, 3%+ reply rate, first deal closed.",
        "status": proj_status,
        "created": now,
        "updated": now,
    })

    # Get the project id
    project_id = conn.execute(
        sa.text("SELECT id FROM projects WHERE name = :name"),
        {"name": "Phase 2 Email Warmup and Cold Outreach"}
    ).fetchone()[0]

    # Insert all tasks
    for title, description, due_date, priority in TASKS:
        conn.execute(sa.text(
            "INSERT INTO tasks (title, description, due_date, priority, status, project_id, created_at, updated_at) "
            "VALUES (:title, :desc, :due, :priority, :status, :project_id, :created, :updated)"
        ), {
            "title": title,
            "desc": description,
            "due": due_date,
            "priority": task_priority_val(priority),
            "status": task_status_val,
            "project_id": project_id,
            "created": now,
            "updated": now,
        })


def downgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(
        sa.text("SELECT id FROM projects WHERE name = :name"),
        {"name": "Phase 2 Email Warmup and Cold Outreach"}
    ).fetchone()

    if result:
        project_id = result[0]
        conn.execute(
            sa.text("DELETE FROM tasks WHERE project_id = :pid"),
            {"pid": project_id}
        )
        conn.execute(
            sa.text("DELETE FROM projects WHERE id = :pid"),
            {"pid": project_id}
        )
