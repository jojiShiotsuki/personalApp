from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class OutreachNiche(Base):
    __tablename__ = "outreach_niches"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    templates = relationship("OutreachTemplate", back_populates="niche", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<OutreachNiche(id={self.id}, name={self.name})>"


class OutreachSituation(Base):
    __tablename__ = "outreach_situations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    templates = relationship("OutreachTemplate", back_populates="situation", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<OutreachSituation(id={self.id}, name={self.name})>"


class OutreachTemplate(Base):
    __tablename__ = "outreach_templates"

    id = Column(Integer, primary_key=True, index=True)
    niche_id = Column(Integer, ForeignKey("outreach_niches.id", ondelete="CASCADE"), nullable=False)
    situation_id = Column(Integer, ForeignKey("outreach_situations.id", ondelete="CASCADE"), nullable=False)
    dm_number = Column(Integer, nullable=False, default=1)  # 1-5 for DM sequence
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Ensure unique combination of niche + situation + dm_number
    __table_args__ = (
        UniqueConstraint('niche_id', 'situation_id', 'dm_number', name='uq_niche_situation_dm'),
    )

    niche = relationship("OutreachNiche", back_populates="templates")
    situation = relationship("OutreachSituation", back_populates="templates")

    def __repr__(self):
        return f"<OutreachTemplate(id={self.id}, niche_id={self.niche_id}, situation_id={self.situation_id})>"
