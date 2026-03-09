"""add ondelete to FK columns

Revision ID: a3b4c5d6e7f8
Revises: z2b3c4d5e6f7
Create Date: 2026-03-07

Uses raw SQL to rebuild SQLite tables with correct FK references and
ondelete actions.  Several tables had stale FK targets (e.g. 'contacts'
instead of 'crm_contacts') or missing FK constraints entirely (columns
added via ALTER TABLE).  This migration fixes all of them.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a3b4c5d6e7f8'
down_revision: Union[str, None] = 'z2b3c4d5e6f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _rebuild_table(table_name: str, create_sql: str, columns: str) -> None:
    """Rebuild a SQLite table by copying data through a temp table."""
    op.execute(f"ALTER TABLE {table_name} RENAME TO _{table_name}_old")
    op.execute(create_sql)
    op.execute(f"INSERT INTO {table_name} ({columns}) SELECT {columns} FROM _{table_name}_old")
    op.execute(f"DROP TABLE _{table_name}_old")


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != 'sqlite':
        _upgrade_postgres()
        return

    # Disable FK checks during rebuild to avoid transient constraint violations
    op.execute("PRAGMA foreign_keys=OFF")

    # Clean up leftover temp table from a previous incomplete migration
    op.execute("DROP TABLE IF EXISTS _alembic_tmp_tasks")

    # Order: rebuild referenced tables before referencing tables.
    # crm_deals is referenced by discovery_calls.
    # sprint_days is referenced by tasks.
    # projects is referenced by tasks and social_content.

    # 1. crm_deals (add ondelete CASCADE on contact_id)
    _rebuild_table(
        'crm_deals',
        """
        CREATE TABLE crm_deals (
            id INTEGER NOT NULL PRIMARY KEY,
            contact_id INTEGER NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            value NUMERIC(12, 2),
            stage VARCHAR(11),
            probability INTEGER,
            expected_close_date DATE,
            actual_close_date DATE,
            created_at DATETIME,
            updated_at DATETIME,
            next_followup_date DATE,
            hourly_rate NUMERIC(10, 2),
            is_recurring BOOLEAN DEFAULT 0,
            billing_frequency VARCHAR(20),
            recurring_amount NUMERIC(12, 2),
            next_billing_date DATE,
            service_status VARCHAR(20),
            service_start_date DATE,
            FOREIGN KEY(contact_id) REFERENCES crm_contacts (id) ON DELETE CASCADE
        )
        """,
        'id, contact_id, title, description, value, stage, probability, '
        'expected_close_date, actual_close_date, created_at, updated_at, '
        'next_followup_date, hourly_rate, is_recurring, billing_frequency, '
        'recurring_amount, next_billing_date, service_status, service_start_date'
    )
    op.create_index('ix_crm_deals_id', 'crm_deals', ['id'])
    op.create_index('ix_crm_deals_contact_id', 'crm_deals', ['contact_id'])

    # 2. crm_interactions (add ondelete CASCADE on contact_id)
    _rebuild_table(
        'crm_interactions',
        """
        CREATE TABLE crm_interactions (
            id INTEGER NOT NULL PRIMARY KEY,
            contact_id INTEGER NOT NULL,
            type VARCHAR(15) NOT NULL,
            subject VARCHAR(255),
            notes TEXT,
            interaction_date DATETIME NOT NULL,
            created_at DATETIME,
            FOREIGN KEY(contact_id) REFERENCES crm_contacts (id) ON DELETE CASCADE
        )
        """,
        'id, contact_id, type, subject, notes, interaction_date, created_at'
    )
    op.create_index('ix_crm_interactions_id', 'crm_interactions', ['id'])
    op.create_index('ix_crm_interactions_contact_id', 'crm_interactions', ['contact_id'])

    # 3. sprint_days (add ondelete CASCADE on sprint_id, SET NULL on outreach_log_id)
    _rebuild_table(
        'sprint_days',
        """
        CREATE TABLE sprint_days (
            id INTEGER NOT NULL PRIMARY KEY,
            sprint_id INTEGER NOT NULL,
            day_number INTEGER NOT NULL,
            week_number INTEGER NOT NULL,
            log_date DATE NOT NULL,
            outreach_log_id INTEGER,
            tasks TEXT,
            is_complete BOOLEAN,
            notes TEXT,
            created_at DATETIME,
            updated_at DATETIME,
            FOREIGN KEY(sprint_id) REFERENCES sprints (id) ON DELETE CASCADE,
            FOREIGN KEY(outreach_log_id) REFERENCES daily_outreach_logs (id) ON DELETE SET NULL
        )
        """,
        'id, sprint_id, day_number, week_number, log_date, outreach_log_id, '
        'tasks, is_complete, notes, created_at, updated_at'
    )
    op.create_index('ix_sprint_days_id', 'sprint_days', ['id'])
    op.create_index('ix_sprint_days_sprint_id', 'sprint_days', ['sprint_id'])
    op.create_index('ix_sprint_days_outreach_log_id', 'sprint_days', ['outreach_log_id'])

    # 4. projects (add missing FK constraint + ondelete SET NULL on contact_id)
    _rebuild_table(
        'projects',
        """
        CREATE TABLE projects (
            id INTEGER NOT NULL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            status VARCHAR(11),
            progress INTEGER,
            created_at DATETIME,
            updated_at DATETIME,
            hourly_rate NUMERIC(10, 2),
            deadline DATE,
            completed_at DATETIME,
            contact_id INTEGER,
            service_type VARCHAR(50),
            notes TEXT,
            FOREIGN KEY(contact_id) REFERENCES crm_contacts (id) ON DELETE SET NULL
        )
        """,
        'id, name, description, status, progress, created_at, updated_at, '
        'hourly_rate, deadline, completed_at, contact_id, service_type, notes'
    )
    op.create_index('ix_projects_id', 'projects', ['id'])
    op.create_index('ix_projects_contact_id', 'projects', ['contact_id'])

    # 5. tasks (add missing FK constraints + ondelete SET NULL on project_id, parent_task_id)
    _rebuild_table(
        'tasks',
        """
        CREATE TABLE tasks (
            id INTEGER NOT NULL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            due_date DATE,
            due_time TIME,
            priority VARCHAR(6),
            status VARCHAR(17),
            created_at DATETIME,
            updated_at DATETIME,
            completed_at DATETIME,
            goal_id INTEGER,
            project_id INTEGER,
            is_recurring BOOLEAN DEFAULT 0 NOT NULL,
            recurrence_type VARCHAR(7),
            recurrence_interval INTEGER,
            recurrence_end_date DATE,
            recurrence_count INTEGER,
            occurrences_created INTEGER DEFAULT 0 NOT NULL,
            parent_task_id INTEGER,
            recurrence_days VARCHAR(255),
            sprint_day_id INTEGER,
            phase VARCHAR(255),
            FOREIGN KEY(goal_id) REFERENCES goals (id) ON DELETE SET NULL,
            FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE SET NULL,
            FOREIGN KEY(sprint_day_id) REFERENCES sprint_days (id) ON DELETE SET NULL,
            FOREIGN KEY(parent_task_id) REFERENCES tasks (id) ON DELETE SET NULL
        )
        """,
        'id, title, description, due_date, due_time, priority, status, '
        'created_at, updated_at, completed_at, goal_id, project_id, '
        'is_recurring, recurrence_type, recurrence_interval, recurrence_end_date, '
        'recurrence_count, occurrences_created, parent_task_id, recurrence_days, '
        'sprint_day_id, phase'
    )
    op.create_index('ix_tasks_id', 'tasks', ['id'])
    op.create_index('ix_tasks_due_date', 'tasks', ['due_date'])
    op.create_index('ix_tasks_status', 'tasks', ['status'])
    op.create_index('ix_tasks_created_at', 'tasks', ['created_at'])
    op.create_index('ix_tasks_goal_id', 'tasks', ['goal_id'])
    op.create_index('ix_tasks_project_id', 'tasks', ['project_id'])
    op.create_index('ix_tasks_sprint_day_id', 'tasks', ['sprint_day_id'])
    op.create_index('ix_tasks_parent_task_id', 'tasks', ['parent_task_id'])

    # 6. social_content (add ondelete SET NULL on project_id)
    _rebuild_table(
        'social_content',
        """
        CREATE TABLE social_content (
            id INTEGER NOT NULL PRIMARY KEY,
            content_date DATE NOT NULL,
            content_type VARCHAR(13) NOT NULL,
            status VARCHAR(11),
            script TEXT,
            editing_style VARCHAR(13),
            editing_notes TEXT,
            platforms JSON,
            hashtags TEXT,
            music_audio VARCHAR(255),
            thumbnail_reference VARCHAR(500),
            notes TEXT,
            project_id INTEGER,
            created_at DATETIME,
            updated_at DATETIME,
            repurpose_formats JSON,
            title VARCHAR(255),
            reel_type VARCHAR(12),
            FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE SET NULL
        )
        """,
        'id, content_date, content_type, status, script, editing_style, editing_notes, '
        'platforms, hashtags, music_audio, thumbnail_reference, notes, project_id, '
        'created_at, updated_at, repurpose_formats, title, reel_type'
    )
    op.create_index('ix_social_content_id', 'social_content', ['id'])
    op.create_index('ix_social_content_content_date', 'social_content', ['content_date'])
    op.create_index('ix_social_content_project_id', 'social_content', ['project_id'])

    # 7. discovery_calls (fix: contacts->crm_contacts, deals->crm_deals, add ondelete)
    _rebuild_table(
        'discovery_calls',
        """
        CREATE TABLE discovery_calls (
            id INTEGER NOT NULL PRIMARY KEY,
            contact_id INTEGER NOT NULL,
            deal_id INTEGER,
            call_date DATE NOT NULL,
            call_duration_minutes INTEGER,
            attendees VARCHAR(500),
            situation TEXT,
            situation_questions TEXT,
            problem TEXT,
            problem_questions TEXT,
            implication TEXT,
            implication_questions TEXT,
            need_payoff TEXT,
            need_payoff_questions TEXT,
            objections TEXT,
            next_steps TEXT,
            budget_discussed BOOLEAN,
            budget_range VARCHAR(100),
            timeline_discussed BOOLEAN,
            timeline VARCHAR(100),
            decision_maker_present BOOLEAN,
            outcome VARCHAR(18),
            follow_up_date DATE,
            created_at DATETIME,
            updated_at DATETIME,
            FOREIGN KEY(contact_id) REFERENCES crm_contacts (id) ON DELETE CASCADE,
            FOREIGN KEY(deal_id) REFERENCES crm_deals (id) ON DELETE SET NULL
        )
        """,
        'id, contact_id, deal_id, call_date, call_duration_minutes, attendees, '
        'situation, situation_questions, problem, problem_questions, '
        'implication, implication_questions, need_payoff, need_payoff_questions, '
        'objections, next_steps, budget_discussed, budget_range, '
        'timeline_discussed, timeline, decision_maker_present, outcome, '
        'follow_up_date, created_at, updated_at'
    )
    op.create_index('ix_discovery_calls_id', 'discovery_calls', ['id'])
    op.create_index('ix_discovery_calls_contact_id', 'discovery_calls', ['contact_id'])
    op.create_index('ix_discovery_calls_deal_id', 'discovery_calls', ['deal_id'])

    # 8. loom_audits (fix: contacts->crm_contacts, add ondelete CASCADE)
    _rebuild_table(
        'loom_audits',
        """
        CREATE TABLE loom_audits (
            id INTEGER NOT NULL PRIMARY KEY,
            contact_id INTEGER NOT NULL,
            title VARCHAR(255) NOT NULL,
            loom_url VARCHAR(500) NOT NULL,
            thumbnail_url VARCHAR(500),
            sent_date DATE NOT NULL,
            sent_via VARCHAR(50),
            watched BOOLEAN,
            watched_date DATE,
            watch_count INTEGER,
            response_received BOOLEAN,
            response_date DATE,
            response_type VARCHAR(14),
            follow_up_date DATE,
            follow_up_sent BOOLEAN,
            notes TEXT,
            created_at DATETIME,
            updated_at DATETIME,
            FOREIGN KEY(contact_id) REFERENCES crm_contacts (id) ON DELETE CASCADE
        )
        """,
        'id, contact_id, title, loom_url, thumbnail_url, sent_date, sent_via, '
        'watched, watched_date, watch_count, response_received, response_date, '
        'response_type, follow_up_date, follow_up_sent, notes, created_at, updated_at'
    )
    op.create_index('ix_loom_audits_id', 'loom_audits', ['id'])
    op.create_index('ix_loom_audits_contact_id', 'loom_audits', ['contact_id'])

    # 9. task_links (fix stale _tasks_old -> tasks reference)
    _rebuild_table(
        'task_links',
        """
        CREATE TABLE task_links (
            id INTEGER NOT NULL PRIMARY KEY,
            task_id INTEGER NOT NULL,
            url VARCHAR(2000) NOT NULL,
            label VARCHAR(255),
            created_at DATETIME DEFAULT (CURRENT_TIMESTAMP),
            FOREIGN KEY(task_id) REFERENCES tasks (id) ON DELETE CASCADE
        )
        """,
        'id, task_id, url, label, created_at'
    )
    op.create_index('ix_task_links_id', 'task_links', ['id'])
    op.create_index('ix_task_links_task_id', 'task_links', ['task_id'])

    # 10. task_notes (fix stale _tasks_old -> tasks reference)
    _rebuild_table(
        'task_notes',
        """
        CREATE TABLE task_notes (
            id INTEGER NOT NULL PRIMARY KEY,
            task_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT (CURRENT_TIMESTAMP),
            FOREIGN KEY(task_id) REFERENCES tasks (id) ON DELETE CASCADE
        )
        """,
        'id, task_id, content, created_at'
    )
    op.create_index('ix_task_notes_id', 'task_notes', ['id'])
    op.create_index('ix_task_notes_task_id', 'task_notes', ['task_id'])

    # 11. invoices (fix stale _projects_old/_crm_deals_old references)
    _rebuild_table(
        'invoices',
        """
        CREATE TABLE invoices (
            id INTEGER NOT NULL PRIMARY KEY,
            invoice_number VARCHAR(50) NOT NULL,
            status VARCHAR(5) NOT NULL,
            contact_id INTEGER NOT NULL,
            deal_id INTEGER,
            project_id INTEGER,
            issue_date DATE NOT NULL,
            due_date DATE NOT NULL,
            sent_date DATE,
            paid_date DATE,
            currency VARCHAR(3) NOT NULL,
            tax_enabled BOOLEAN NOT NULL,
            tax_rate NUMERIC(5, 2) NOT NULL,
            tax_label VARCHAR(50) NOT NULL,
            notes TEXT,
            subtotal NUMERIC(12, 2) NOT NULL,
            tax_amount NUMERIC(12, 2) NOT NULL,
            total NUMERIC(12, 2) NOT NULL,
            created_at DATETIME,
            updated_at DATETIME,
            FOREIGN KEY(contact_id) REFERENCES crm_contacts (id) ON DELETE RESTRICT,
            FOREIGN KEY(deal_id) REFERENCES crm_deals (id) ON DELETE SET NULL,
            FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE SET NULL
        )
        """,
        'id, invoice_number, status, contact_id, deal_id, project_id, '
        'issue_date, due_date, sent_date, paid_date, currency, tax_enabled, '
        'tax_rate, tax_label, notes, subtotal, tax_amount, total, '
        'created_at, updated_at'
    )
    op.create_index('ix_invoices_id', 'invoices', ['id'])

    # 12. time_entries (fix stale _tasks_old/_projects_old/_crm_deals_old references)
    _rebuild_table(
        'time_entries',
        """
        CREATE TABLE time_entries (
            id INTEGER NOT NULL PRIMARY KEY,
            description TEXT,
            start_time DATETIME NOT NULL,
            end_time DATETIME,
            duration_seconds INTEGER,
            is_running BOOLEAN,
            is_paused BOOLEAN,
            paused_duration_seconds INTEGER,
            task_id INTEGER,
            project_id INTEGER,
            deal_id INTEGER,
            hourly_rate NUMERIC(10, 2),
            created_at DATETIME,
            updated_at DATETIME,
            invoice_id INTEGER,
            is_billable BOOLEAN DEFAULT 1,
            category VARCHAR(20),
            FOREIGN KEY(task_id) REFERENCES tasks (id) ON DELETE SET NULL,
            FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE SET NULL,
            FOREIGN KEY(deal_id) REFERENCES crm_deals (id) ON DELETE SET NULL,
            FOREIGN KEY(invoice_id) REFERENCES invoices (id) ON DELETE SET NULL
        )
        """,
        'id, description, start_time, end_time, duration_seconds, is_running, '
        'is_paused, paused_duration_seconds, task_id, project_id, deal_id, '
        'hourly_rate, created_at, updated_at, invoice_id, is_billable, category'
    )
    op.create_index('ix_time_entries_id', 'time_entries', ['id'])

    # 13. invoice_line_items (fix stale _invoices_old/_time_entries_old references)
    _rebuild_table(
        'invoice_line_items',
        """
        CREATE TABLE invoice_line_items (
            id INTEGER NOT NULL PRIMARY KEY,
            invoice_id INTEGER NOT NULL,
            description VARCHAR(500) NOT NULL,
            quantity NUMERIC(10, 2) NOT NULL,
            unit_price NUMERIC(10, 2) NOT NULL,
            amount NUMERIC(12, 2) NOT NULL,
            time_entry_id INTEGER,
            sort_order INTEGER NOT NULL,
            created_at DATETIME,
            FOREIGN KEY(invoice_id) REFERENCES invoices (id) ON DELETE CASCADE,
            FOREIGN KEY(time_entry_id) REFERENCES time_entries (id) ON DELETE SET NULL
        )
        """,
        'id, invoice_id, description, quantity, unit_price, amount, '
        'time_entry_id, sort_order, created_at'
    )
    op.create_index('ix_invoice_line_items_id', 'invoice_line_items', ['id'])

    # Re-enable FK checks
    op.execute("PRAGMA foreign_keys=ON")


def _upgrade_postgres() -> None:
    """PostgreSQL path: use standard ALTER TABLE to add/change ondelete."""
    # discovery_calls
    op.drop_constraint('discovery_calls_contact_id_fkey', 'discovery_calls', type_='foreignkey')
    op.drop_constraint('discovery_calls_deal_id_fkey', 'discovery_calls', type_='foreignkey')
    op.create_foreign_key('discovery_calls_contact_id_fkey', 'discovery_calls', 'crm_contacts', ['contact_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('discovery_calls_deal_id_fkey', 'discovery_calls', 'crm_deals', ['deal_id'], ['id'], ondelete='SET NULL')

    # loom_audits
    op.drop_constraint('loom_audits_contact_id_fkey', 'loom_audits', type_='foreignkey')
    op.create_foreign_key('loom_audits_contact_id_fkey', 'loom_audits', 'crm_contacts', ['contact_id'], ['id'], ondelete='CASCADE')

    # projects
    op.drop_constraint('projects_contact_id_fkey', 'projects', type_='foreignkey')
    op.create_foreign_key('projects_contact_id_fkey', 'projects', 'crm_contacts', ['contact_id'], ['id'], ondelete='SET NULL')

    # social_content
    op.drop_constraint('social_content_project_id_fkey', 'social_content', type_='foreignkey')
    op.create_foreign_key('social_content_project_id_fkey', 'social_content', 'projects', ['project_id'], ['id'], ondelete='SET NULL')

    # tasks
    op.drop_constraint('tasks_project_id_fkey', 'tasks', type_='foreignkey')
    op.drop_constraint('tasks_parent_task_id_fkey', 'tasks', type_='foreignkey')
    op.create_foreign_key('tasks_project_id_fkey', 'tasks', 'projects', ['project_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('tasks_parent_task_id_fkey', 'tasks', 'tasks', ['parent_task_id'], ['id'], ondelete='SET NULL')

    # sprint_days
    op.drop_constraint('sprint_days_sprint_id_fkey', 'sprint_days', type_='foreignkey')
    op.drop_constraint('sprint_days_outreach_log_id_fkey', 'sprint_days', type_='foreignkey')
    op.create_foreign_key('sprint_days_sprint_id_fkey', 'sprint_days', 'sprints', ['sprint_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('sprint_days_outreach_log_id_fkey', 'sprint_days', 'daily_outreach_logs', ['outreach_log_id'], ['id'], ondelete='SET NULL')

    # crm_deals
    op.drop_constraint('crm_deals_contact_id_fkey', 'crm_deals', type_='foreignkey')
    op.create_foreign_key('crm_deals_contact_id_fkey', 'crm_deals', 'crm_contacts', ['contact_id'], ['id'], ondelete='CASCADE')

    # crm_interactions
    op.drop_constraint('crm_interactions_contact_id_fkey', 'crm_interactions', type_='foreignkey')
    op.create_foreign_key('crm_interactions_contact_id_fkey', 'crm_interactions', 'crm_contacts', ['contact_id'], ['id'], ondelete='CASCADE')


def downgrade() -> None:
    # Downgrade is not practical for SQLite table rebuilds.
    # The FK references are now correct (were broken before), so reverting
    # would reintroduce broken references.
    pass
