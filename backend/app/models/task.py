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
    due_date = Column(Date, nullable=True)
    due_time = Column(Time, nullable=True)
    priority = Column(Enum(TaskPriority), default=TaskPriority.MEDIUM)
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING)
    goal_id = Column(Integer, ForeignKey('goals.id', ondelete='SET NULL'), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # Project relationship
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)

    # Recurrence fields
    is_recurring = Column(Boolean, default=False, nullable=False)
    recurrence_type = Column(Enum(RecurrenceType), nullable=True)
    recurrence_interval = Column(Integer, default=1, nullable=True)  # Repeat every N days/weeks/months
    recurrence_end_date = Column(Date, nullable=True)  # When to stop creating new instances
    recurrence_count = Column(Integer, nullable=True)  # Alternative: how many times to repeat
    occurrences_created = Column(Integer, default=0, nullable=False)  # Track how many have been created
    parent_task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)  # Link to parent recurring task
    
    # Relationships
    project = relationship("Project", back_populates="tasks")

    # Relationship to Goal
    goal = relationship("Goal", back_populates="tasks")

    # Self-referential relationship for recurring tasks
    parent_task = relationship("Task", remote_side=[id], foreign_keys=[parent_task_id], backref="child_tasks")

    def __repr__(self):
        return f"<Task(id={self.id}, title='{self.title}', status={self.status})>"
