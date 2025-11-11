from sqlalchemy import Column, Integer, String, Text, DateTime, Date, Enum, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import enum

class ContactStatus(str, enum.Enum):
    LEAD = "lead"
    PROSPECT = "prospect"
    CLIENT = "client"
    INACTIVE = "inactive"

class DealStage(str, enum.Enum):
    LEAD = "lead"
    PROSPECT = "prospect"
    PROPOSAL = "proposal"
    NEGOTIATION = "negotiation"
    CLOSED_WON = "closed_won"
    CLOSED_LOST = "closed_lost"

class InteractionType(str, enum.Enum):
    MEETING = "meeting"
    EMAIL = "email"
    CALL = "call"
    NOTE = "note"
    SOCIAL_MEDIA = "social_media"

class Contact(Base):
    __tablename__ = "crm_contacts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    company = Column(String(255), nullable=True)
    status = Column(Enum(ContactStatus), default=ContactStatus.LEAD)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    deals = relationship("Deal", back_populates="contact", cascade="all, delete-orphan")
    interactions = relationship("Interaction", back_populates="contact", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Contact(id={self.id}, name='{self.name}', status={self.status})>"

class Deal(Base):
    __tablename__ = "crm_deals"

    id = Column(Integer, primary_key=True, index=True)
    contact_id = Column(Integer, ForeignKey("crm_contacts.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    value = Column(Numeric(12, 2), nullable=True)
    stage = Column(Enum(DealStage), default=DealStage.LEAD)
    probability = Column(Integer, default=50)  # 0-100
    expected_close_date = Column(Date, nullable=True)
    actual_close_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    contact = relationship("Contact", back_populates="deals")

    def __repr__(self):
        return f"<Deal(id={self.id}, title='{self.title}', stage={self.stage})>"

class Interaction(Base):
    __tablename__ = "crm_interactions"

    id = Column(Integer, primary_key=True, index=True)
    contact_id = Column(Integer, ForeignKey("crm_contacts.id"), nullable=False)
    type = Column(Enum(InteractionType), nullable=False)
    subject = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    interaction_date = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    contact = relationship("Contact", back_populates="interactions")

    def __repr__(self):
        return f"<Interaction(id={self.id}, type={self.type}, contact_id={self.contact_id})>"
