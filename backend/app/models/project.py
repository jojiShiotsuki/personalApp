from sqlalchemy import Column, Integer, String, Text, DateTime, Date, Enum, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import enum


class ProjectStatus(str, enum.Enum):
    TODO = "TODO"
    SCOPING = "SCOPING"
    IN_PROGRESS = "IN_PROGRESS"
    REVIEW = "REVIEW"
    REVISIONS = "REVISIONS"
    COMPLETED = "COMPLETED"
    RETAINER = "RETAINER"


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(ProjectStatus), default=ProjectStatus.SCOPING)
    progress = Column(Integer, default=0)  # 0-100
    hourly_rate = Column(Numeric(10, 2), nullable=True)  # For time tracking billing
    deadline = Column(Date, nullable=True)
    contact_id = Column(Integer, ForeignKey("crm_contacts.id", ondelete="SET NULL"), nullable=True, index=True)
    service_type = Column(String(50), nullable=True)  # wordpress, ghl, graphic_design, seo
    notes = Column(Text, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")
    contact = relationship("Contact", foreign_keys=[contact_id])

    def __repr__(self):
        return f"<Project(id={self.id}, name='{self.name}', status={self.status})>"
