from sqlalchemy import Column, Integer, String, Text, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
from app.models.task import TaskPriority


class ProjectTemplate(Base):
    __tablename__ = "project_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    tasks = relationship("ProjectTemplateTask", back_populates="template", cascade="all, delete-orphan", order_by="ProjectTemplateTask.order")

    def __repr__(self):
        return f"<ProjectTemplate(id={self.id}, name='{self.name}')>"


class ProjectTemplateTask(Base):
    __tablename__ = "project_template_tasks"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("project_templates.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(Enum(TaskPriority), default=TaskPriority.MEDIUM)
    order = Column(Integer, default=0)
    phase = Column(String(255), nullable=True)

    template = relationship("ProjectTemplate", back_populates="tasks")
