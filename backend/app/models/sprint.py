from sqlalchemy import Column, Integer, String, Text, DateTime, Date, Enum as SQLEnum, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, date, timedelta
from app.database import Base
import enum
import json


class SprintStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    PAUSED = "paused"
    ABANDONED = "abandoned"


# Default tasks for each day based on the 30-day playbook
SPRINT_DAY_TASKS = {
    # Week 1: Foundation
    1: [
        {"title": "Gather proof: Screenshot Pundok Studios ranking", "completed": False},
        {"title": "Gather proof: Screenshot You% ranking", "completed": False},
    ],
    2: [
        {"title": "Request testimonial from Pundok Studios", "completed": False},
        {"title": "Request testimonial from You%", "completed": False},
        {"title": "Request testimonial from Best Roofing Now", "completed": False},
    ],
    3: [
        {"title": "Update LinkedIn headline (AU-focused)", "completed": False},
        {"title": "Update LinkedIn About section", "completed": False},
    ],
    4: [
        {"title": "Create portfolio page focused on tradies", "completed": False},
    ],
    5: [
        {"title": "Build target list: Find 50 Australian tradies with bad websites", "completed": False},
    ],
    6: [
        {"title": "Write 5 personalised cold emails", "completed": False},
    ],
    7: [
        {"title": "Send first 5 emails", "completed": False},
        {"title": "Send 10 LinkedIn connection requests", "completed": False},
    ],
    # Week 2: Volume - Days 8-14
    8: [
        {"title": "Send 10 cold emails", "completed": False},
        {"title": "Send 10 LinkedIn connections", "completed": False},
    ],
    9: [
        {"title": "Follow up on Day 1-5 emails", "completed": False},
        {"title": "Send 10 new LinkedIn connections", "completed": False},
    ],
    10: [
        {"title": "Send 10 cold emails", "completed": False},
        {"title": "Record 2 Loom audits for hot prospects", "completed": False},
    ],
    11: [
        {"title": "Send 10 cold emails", "completed": False},
        {"title": "Send 10 LinkedIn connections", "completed": False},
    ],
    12: [
        {"title": "Follow up on Week 1 emails (break-up emails)", "completed": False},
    ],
    13: [
        {"title": "Find 10 AU agencies", "completed": False},
        {"title": "Send 10 agency outreach emails", "completed": False},
    ],
    14: [
        {"title": "Review responses", "completed": False},
        {"title": "Book discovery calls", "completed": False},
        {"title": "Adjust messaging if needed", "completed": False},
    ],
    # Week 3: Momentum - Days 15-21
    15: [
        {"title": "Send 10 cold emails", "completed": False},
        {"title": "Follow up LinkedIn connections", "completed": False},
    ],
    16: [
        {"title": "Send 10 cold emails", "completed": False},
        {"title": "Send 10 LinkedIn connections", "completed": False},
    ],
    17: [
        {"title": "Record 3 Loom audits for engaged prospects", "completed": False},
    ],
    18: [
        {"title": "Send 10 cold emails", "completed": False},
        {"title": "Agency follow-ups", "completed": False},
    ],
    19: [
        {"title": "Send 10 cold emails", "completed": False},
        {"title": "Send 10 LinkedIn connections", "completed": False},
    ],
    20: [
        {"title": "Follow up all non-responders with break-up emails", "completed": False},
    ],
    21: [
        {"title": "Review results", "completed": False},
        {"title": "Refine scripts based on what's working", "completed": False},
    ],
    # Week 4: Close - Days 22-30
    22: [
        {"title": "Continue daily outreach: 10 emails + 10 LinkedIn", "completed": False},
    ],
    23: [
        {"title": "Focus on warm leads", "completed": False},
        {"title": "Send Loom audits to hot prospects", "completed": False},
        {"title": "Book calls", "completed": False},
    ],
    24: [
        {"title": "Discovery calls (use SPIN framework)", "completed": False},
        {"title": "Present offer", "completed": False},
    ],
    25: [
        {"title": "Send proposals to interested prospects", "completed": False},
    ],
    26: [
        {"title": "Follow up proposals", "completed": False},
        {"title": "Handle objections", "completed": False},
    ],
    27: [
        {"title": "Continue outreach: 10 emails + 10 LinkedIn", "completed": False},
    ],
    28: [
        {"title": "Discovery calls + proposal follow-ups", "completed": False},
    ],
    29: [
        {"title": "Close deals", "completed": False},
        {"title": "Collect deposits", "completed": False},
    ],
    30: [
        {"title": "Review month", "completed": False},
        {"title": "Document what worked", "completed": False},
        {"title": "Plan next month", "completed": False},
    ],
}

WEEK_THEMES = ["Foundation", "Volume", "Momentum", "Close"]


class Sprint(Base):
    """30-day sprint for client acquisition."""
    __tablename__ = "sprints"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, default="30-Day Client Acquisition Sprint")
    description = Column(Text, nullable=True)

    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)  # start_date + 29 days

    status = Column(
        SQLEnum(SprintStatus, values_callable=lambda e: [x.value for x in e]),
        default=SprintStatus.ACTIVE
    )

    # Weekly themes stored as JSON
    week_themes = Column(Text, default=json.dumps(WEEK_THEMES))

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    days = relationship("SprintDay", back_populates="sprint", cascade="all, delete-orphan")

    @property
    def current_day(self) -> int:
        """Calculate current day number (1-30) based on today's date."""
        if self.status != SprintStatus.ACTIVE:
            return 0
        today = date.today()
        if today < self.start_date:
            return 0
        if today > self.end_date:
            return 30
        return (today - self.start_date).days + 1

    @property
    def current_week(self) -> int:
        """Calculate current week (1-4) based on current day."""
        day = self.current_day
        if day == 0:
            return 0
        return min(4, (day - 1) // 7 + 1)

    @property
    def progress_percentage(self) -> float:
        """Calculate completion percentage based on completed days."""
        if not self.days:
            return 0.0
        completed = sum(1 for d in self.days if d.is_complete)
        return round((completed / 30) * 100, 1)

    def get_week_themes_list(self) -> list:
        """Get week themes as a list."""
        try:
            return json.loads(self.week_themes) if self.week_themes else WEEK_THEMES
        except:
            return WEEK_THEMES

    def __repr__(self):
        return f"<Sprint(id={self.id}, title='{self.title}', status={self.status})>"


class SprintDay(Base):
    """A single day within a sprint."""
    __tablename__ = "sprint_days"

    id = Column(Integer, primary_key=True, index=True)
    sprint_id = Column(Integer, ForeignKey("sprints.id"), nullable=False)

    day_number = Column(Integer, nullable=False)  # 1-30
    week_number = Column(Integer, nullable=False)  # 1-4
    log_date = Column(Date, nullable=False)

    # Link to daily outreach log for that date
    outreach_log_id = Column(Integer, ForeignKey("daily_outreach_logs.id"), nullable=True)

    # Day-specific tasks as JSON
    tasks = Column(Text, nullable=True)  # [{"title": "...", "completed": bool}]

    # Completion status
    is_complete = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    sprint = relationship("Sprint", back_populates="days")
    sprint_tasks = relationship("Task", back_populates="sprint_day", lazy="joined")

    def get_tasks_list(self) -> list:
        """Get tasks as a list of dicts."""
        try:
            return json.loads(self.tasks) if self.tasks else []
        except:
            return []

    def set_tasks_list(self, tasks: list):
        """Set tasks from a list of dicts."""
        self.tasks = json.dumps(tasks)

    def check_completion(self) -> bool:
        """Check if all tasks are completed (real Task entities + JSON tasks)."""
        from app.models.task import TaskStatus

        has_real_tasks = bool(self.sprint_tasks)
        json_tasks = self.get_tasks_list()
        has_json_tasks = bool(json_tasks)

        if not has_real_tasks and not has_json_tasks:
            return False

        real_complete = all(t.status == TaskStatus.COMPLETED for t in self.sprint_tasks) if has_real_tasks else True
        json_complete = all(t.get("completed", False) for t in json_tasks) if has_json_tasks else True

        self.is_complete = real_complete and json_complete
        return self.is_complete

    def __repr__(self):
        return f"<SprintDay(id={self.id}, day={self.day_number}, complete={self.is_complete})>"
