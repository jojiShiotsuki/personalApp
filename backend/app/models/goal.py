from sqlalchemy import Column, Integer, String, Text, DateTime, Enum, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum

class Quarter(str, enum.Enum):
    Q1 = "Q1"
    Q2 = "Q2"
    Q3 = "Q3"
    Q4 = "Q4"

class Month(str, enum.Enum):
    JANUARY = "January"
    FEBRUARY = "February"
    MARCH = "March"
    APRIL = "April"
    MAY = "May"
    JUNE = "June"
    JULY = "July"
    AUGUST = "August"
    SEPTEMBER = "September"
    OCTOBER = "October"
    NOVEMBER = "November"
    DECEMBER = "December"

class GoalPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class Goal(Base):
    __tablename__ = "goals"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    quarter = Column(Enum(Quarter), nullable=False)
    month = Column(Enum(Month), nullable=False)
    year = Column(Integer, nullable=False)
    target_date = Column(String(10), nullable=True)  # YYYY-MM-DD format
    progress = Column(Float, default=0.0)  # 0-100
    priority = Column(Enum(GoalPriority), default=GoalPriority.MEDIUM)
    key_results = Column(Text, nullable=True)  # JSON string of key results
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationship to Tasks
    tasks = relationship("Task", back_populates="goal")
