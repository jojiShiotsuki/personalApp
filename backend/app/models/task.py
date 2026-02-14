from sqlalchemy import Column, Integer, String, Text, DateTime, Date, Time, Enum, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import enum

class TaskPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"

class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    DELAYED = "delayed"

class RecurrenceType(str, enum.Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    due_date = Column(Date, nullable=True, index=True)
    due_time = Column(Time, nullable=True)
    priority = Column(Enum(TaskPriority), default=TaskPriority.MEDIUM)
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING, index=True)
    goal_id = Column(Integer, ForeignKey('goals.id', ondelete='SET NULL'), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # Project relationship
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, index=True)

    # Sprint day relationship (for tasks within a sprint)
    sprint_day_id = Column(Integer, ForeignKey("sprint_days.id", ondelete="SET NULL"), nullable=True, index=True)

    # Recurrence fields
    is_recurring = Column(Boolean, default=False, nullable=False)
    recurrence_type = Column(Enum(RecurrenceType), nullable=True)
    recurrence_interval = Column(Integer, default=1, nullable=True)
    recurrence_days = Column(String(255), nullable=True)
    phase = Column(String(255), nullable=True)
    recurrence_end_date = Column(Date, nullable=True)
    recurrence_count = Column(Integer, nullable=True)
    occurrences_created = Column(Integer, default=0, nullable=False)
    parent_task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    
    # Relationships
    project = relationship("Project", back_populates="tasks")
    goal = relationship("Goal", back_populates="tasks")
    parent_task = relationship("Task", remote_side=[id], foreign_keys=[parent_task_id], backref="child_tasks")
    sprint_day = relationship("SprintDay", back_populates="sprint_tasks")
    links = relationship("TaskLink", backref="task", cascade="all, delete-orphan", lazy="joined")

    def __repr__(self):
        return f"<Task(id={self.id}, title='{self.title}', status={self.status})>"


class TaskLink(Base):
    __tablename__ = "task_links"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    url = Column(String(2000), nullable=False)
    label = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
