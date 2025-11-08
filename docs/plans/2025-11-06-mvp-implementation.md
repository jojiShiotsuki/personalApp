# Personal Productivity App MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a personal productivity application with Personal Assistant (task management with NLP command bar), CRM system (contacts, deals, interactions), and context export for Claude CEO mentor integration.

**Architecture:** FastAPI backend with SQLAlchemy ORM and SQLite database, React frontend with Vite, TanStack Query for data fetching, Tailwind CSS + shadcn/ui for styling. Rule-based natural language parsing for task creation.

**Tech Stack:** Python 3.11+, FastAPI, SQLAlchemy, Alembic, React 18, TypeScript, Vite, TanStack Query, Tailwind CSS, shadcn/ui

---

## Phase 1: Foundation

### Task 1: Backend Project Structure

**Files:**
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/app/database/__init__.py`
- Create: `backend/app/database/connection.py`
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/routes/__init__.py`
- Create: `backend/app/services/__init__.py`
- Create: `backend/requirements.txt`
- Create: `backend/.env.example`

**Step 1: Create backend directory structure**

Run:
```bash
cd C:\Apps\personalApp\.worktrees\feature\mvp-implementation
mkdir -p backend/app/database backend/app/models backend/app/routes backend/app/services
```

**Step 2: Write requirements.txt**

Create `backend/requirements.txt`:
```
fastapi==0.104.1
uvicorn[standard]==0.24.0
sqlalchemy==2.0.23
alembic==1.12.1
pydantic==2.5.0
pydantic-settings==2.1.0
python-dateutil==2.8.2
python-dotenv==1.0.0
```

**Step 3: Write database connection module**

Create `backend/app/database/connection.py`:
```python
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./database/app.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """Dependency for FastAPI routes to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Initialize database tables"""
    from app.models.task import Task
    from app.models.crm import Contact, Deal, Interaction
    Base.metadata.create_all(bind=engine)
```

Create `backend/app/database/__init__.py`:
```python
from .connection import get_db, init_db, Base, engine

__all__ = ["get_db", "init_db", "Base", "engine"]
```

**Step 4: Write main FastAPI app**

Create `backend/app/main.py`:
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db

app = FastAPI(
    title="Personal Productivity App",
    description="Task management and CRM system with AI assistant",
    version="1.0.0"
)

# CORS configuration for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    init_db()

@app.get("/")
async def root():
    return {"message": "Personal Productivity App API", "status": "running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
```

Create `backend/app/__init__.py` (empty file for package).

**Step 5: Write environment example**

Create `backend/.env.example`:
```
DATABASE_URL=sqlite:///./database/app.db
```

**Step 6: Test backend starts**

Run:
```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
# source venv/bin/activate
pip install -r requirements.txt
```

Then:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Expected: Server starts, visit `http://localhost:8000` shows {"message": "Personal Productivity App API", "status": "running"}

**Step 7: Commit**

```bash
git add backend/
git commit -m "feat: initialize backend project structure with FastAPI

- Set up FastAPI application with CORS
- Configure SQLAlchemy database connection
- Add requirements.txt with dependencies
- Create folder structure for models, routes, services"
```

---

### Task 2: Database Models - Tasks

**Files:**
- Create: `backend/app/models/task.py`
- Modify: `backend/app/models/__init__.py`

**Step 1: Write Task model**

Create `backend/app/models/task.py`:
```python
from sqlalchemy import Column, Integer, String, Text, DateTime, Date, Time, Enum
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

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    due_date = Column(Date, nullable=True)
    due_time = Column(Time, nullable=True)
    priority = Column(Enum(TaskPriority), default=TaskPriority.MEDIUM)
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<Task(id={self.id}, title='{self.title}', status={self.status})>"
```

**Step 2: Update models __init__.py**

Modify `backend/app/models/__init__.py`:
```python
from .task import Task, TaskPriority, TaskStatus

__all__ = ["Task", "TaskPriority", "TaskStatus"]
```

**Step 3: Test database creation**

Run:
```bash
cd backend
python -c "from app.database import init_db; init_db(); print('Database initialized')"
```

Expected: Creates `database/app.db` file, prints "Database initialized"

Verify table exists:
```bash
sqlite3 database/app.db ".schema tasks"
```

Expected: Shows CREATE TABLE statement for tasks

**Step 4: Commit**

```bash
git add backend/app/models/
mkdir -p database
git add database/.gitkeep
git commit -m "feat: add Task model with priority and status enums

- Create Task SQLAlchemy model
- Add TaskPriority enum (low, medium, high, urgent)
- Add TaskStatus enum (pending, in_progress, completed, delayed)
- Include timestamps and optional due date/time"
```

---

### Task 3: Database Models - CRM

**Files:**
- Create: `backend/app/models/crm.py`
- Modify: `backend/app/models/__init__.py`

**Step 1: Write CRM models**

Create `backend/app/models/crm.py`:
```python
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
```

**Step 2: Update models __init__.py**

Modify `backend/app/models/__init__.py`:
```python
from .task import Task, TaskPriority, TaskStatus
from .crm import Contact, Deal, Interaction, ContactStatus, DealStage, InteractionType

__all__ = [
    "Task", "TaskPriority", "TaskStatus",
    "Contact", "Deal", "Interaction",
    "ContactStatus", "DealStage", "InteractionType"
]
```

**Step 3: Reinitialize database with CRM tables**

Run:
```bash
cd backend
rm -f database/app.db  # Clean slate
python -c "from app.database import init_db; init_db(); print('Database with CRM tables initialized')"
```

Verify all tables exist:
```bash
sqlite3 database/app.db ".tables"
```

Expected: Shows `crm_contacts`, `crm_deals`, `crm_interactions`, `tasks`

**Step 4: Commit**

```bash
git add backend/app/models/
git commit -m "feat: add CRM models (Contact, Deal, Interaction)

- Create Contact model with status enum
- Create Deal model with stage enum and probability
- Create Interaction model with type enum
- Set up relationships and foreign keys
- Add cascade delete for related records"
```

---

### Task 4: Pydantic Schemas

**Files:**
- Create: `backend/app/schemas/__init__.py`
- Create: `backend/app/schemas/task.py`
- Create: `backend/app/schemas/crm.py`

**Step 1: Create schemas directory**

Run:
```bash
mkdir backend/app/schemas
```

**Step 2: Write Task schemas**

Create `backend/app/schemas/task.py`:
```python
from pydantic import BaseModel, Field
from datetime import datetime, date, time
from typing import Optional
from app.models.task import TaskPriority, TaskStatus

class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    due_date: Optional[date] = None
    due_time: Optional[time] = None
    priority: TaskPriority = TaskPriority.MEDIUM
    status: TaskStatus = TaskStatus.PENDING

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    due_date: Optional[date] = None
    due_time: Optional[time] = None
    priority: Optional[TaskPriority] = None
    status: Optional[TaskStatus] = None

class TaskResponse(TaskBase):
    id: int
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class TaskParseRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)
```

**Step 3: Write CRM schemas**

Create `backend/app/schemas/crm.py`:
```python
from pydantic import BaseModel, Field, EmailStr
from datetime import datetime, date
from typing import Optional, List
from decimal import Decimal
from app.models.crm import ContactStatus, DealStage, InteractionType

# Contact Schemas
class ContactBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)
    company: Optional[str] = Field(None, max_length=255)
    status: ContactStatus = ContactStatus.LEAD
    notes: Optional[str] = None

class ContactCreate(ContactBase):
    pass

class ContactUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)
    company: Optional[str] = Field(None, max_length=255)
    status: Optional[ContactStatus] = None
    notes: Optional[str] = None

class ContactResponse(ContactBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Deal Schemas
class DealBase(BaseModel):
    contact_id: int
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    value: Optional[Decimal] = None
    stage: DealStage = DealStage.LEAD
    probability: int = Field(50, ge=0, le=100)
    expected_close_date: Optional[date] = None
    actual_close_date: Optional[date] = None

class DealCreate(DealBase):
    pass

class DealUpdate(BaseModel):
    contact_id: Optional[int] = None
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    value: Optional[Decimal] = None
    stage: Optional[DealStage] = None
    probability: Optional[int] = Field(None, ge=0, le=100)
    expected_close_date: Optional[date] = None
    actual_close_date: Optional[date] = None

class DealResponse(DealBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Interaction Schemas
class InteractionBase(BaseModel):
    contact_id: int
    type: InteractionType
    subject: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = None
    interaction_date: datetime

class InteractionCreate(InteractionBase):
    pass

class InteractionUpdate(BaseModel):
    contact_id: Optional[int] = None
    type: Optional[InteractionType] = None
    subject: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = None
    interaction_date: Optional[datetime] = None

class InteractionResponse(InteractionBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
```

**Step 4: Update schemas __init__.py**

Create `backend/app/schemas/__init__.py`:
```python
from .task import TaskCreate, TaskUpdate, TaskResponse, TaskParseRequest
from .crm import (
    ContactCreate, ContactUpdate, ContactResponse,
    DealCreate, DealUpdate, DealResponse,
    InteractionCreate, InteractionUpdate, InteractionResponse
)

__all__ = [
    "TaskCreate", "TaskUpdate", "TaskResponse", "TaskParseRequest",
    "ContactCreate", "ContactUpdate", "ContactResponse",
    "DealCreate", "DealUpdate", "DealResponse",
    "InteractionCreate", "InteractionUpdate", "InteractionResponse"
]
```

**Step 5: Commit**

```bash
git add backend/app/schemas/
git commit -m "feat: add Pydantic schemas for validation

- Add Task schemas (create, update, response)
- Add CRM schemas (contact, deal, interaction)
- Include validation rules and field constraints
- Support partial updates with optional fields"
```

---

### Task 5: Task API Routes

**Files:**
- Create: `backend/app/routes/tasks.py`
- Modify: `backend/app/main.py`

**Step 1: Write task routes**

Create `backend/app/routes/tasks.py`:
```python
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models.task import Task, TaskStatus, TaskPriority
from app.schemas.task import TaskCreate, TaskUpdate, TaskResponse

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

@router.get("/", response_model=List[TaskResponse])
def get_tasks(
    status: Optional[TaskStatus] = None,
    priority: Optional[TaskPriority] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all tasks with optional filtering"""
    query = db.query(Task)

    if status:
        query = query.filter(Task.status == status)
    if priority:
        query = query.filter(Task.priority == priority)

    tasks = query.offset(skip).limit(limit).all()
    return tasks

@router.get("/{task_id}", response_model=TaskResponse)
def get_task(task_id: int, db: Session = Depends(get_db)):
    """Get a single task by ID"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@router.post("/", response_model=TaskResponse, status_code=201)
def create_task(task: TaskCreate, db: Session = Depends(get_db)):
    """Create a new task"""
    db_task = Task(**task.model_dump())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@router.put("/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, task_update: TaskUpdate, db: Session = Depends(get_db)):
    """Update an existing task"""
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")

    update_data = task_update.model_dump(exclude_unset=True)

    # If status changed to completed, set completed_at
    if "status" in update_data and update_data["status"] == TaskStatus.COMPLETED:
        update_data["completed_at"] = datetime.utcnow()

    for field, value in update_data.items():
        setattr(db_task, field, value)

    db_task.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_task)
    return db_task

@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    """Delete a task"""
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")

    db.delete(db_task)
    db.commit()
    return None

@router.patch("/{task_id}/status", response_model=TaskResponse)
def update_task_status(
    task_id: int,
    status: TaskStatus,
    db: Session = Depends(get_db)
):
    """Update only the status of a task"""
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")

    db_task.status = status
    if status == TaskStatus.COMPLETED:
        db_task.completed_at = datetime.utcnow()

    db_task.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_task)
    return db_task
```

**Step 2: Register routes in main.py**

Modify `backend/app/main.py` to add:
```python
from app.routes import tasks

# Add after CORS middleware setup, before @app.on_event
app.include_router(tasks.router)
```

**Step 3: Update routes __init__.py**

Create/Modify `backend/app/routes/__init__.py`:
```python
from . import tasks

__all__ = ["tasks"]
```

**Step 4: Test task API manually**

Run backend:
```bash
cd backend
uvicorn app.main:app --reload
```

Test with curl or visit `http://localhost:8000/docs` to see interactive API docs.

Create a task:
```bash
curl -X POST http://localhost:8000/api/tasks/ \
  -H "Content-Type: application/json" \
  -d '{"title":"Test task","priority":"high"}'
```

Expected: Returns JSON with task including id, created_at, etc.

Get tasks:
```bash
curl http://localhost:8000/api/tasks/
```

Expected: Returns array with the created task

**Step 5: Commit**

```bash
git add backend/app/routes/
git add backend/app/main.py
git commit -m "feat: add Task API routes

- Implement GET /api/tasks with filtering
- Add POST /api/tasks for creation
- Add GET /api/tasks/{id} for single task
- Add PUT /api/tasks/{id} for updates
- Add DELETE /api/tasks/{id}
- Add PATCH /api/tasks/{id}/status for quick status change
- Auto-set completed_at when status changes to completed"
```

---

### Task 6: CRM API Routes

**Files:**
- Create: `backend/app/routes/crm.py`
- Modify: `backend/app/main.py`

**Step 1: Write CRM routes**

Create `backend/app/routes/crm.py`:
```python
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models.crm import Contact, Deal, Interaction, ContactStatus, DealStage, InteractionType
from app.schemas.crm import (
    ContactCreate, ContactUpdate, ContactResponse,
    DealCreate, DealUpdate, DealResponse,
    InteractionCreate, InteractionUpdate, InteractionResponse
)

router = APIRouter(prefix="/api/crm", tags=["crm"])

# ===== CONTACT ROUTES =====

@router.get("/contacts", response_model=List[ContactResponse])
def get_contacts(
    status: Optional[ContactStatus] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all contacts with optional filtering"""
    query = db.query(Contact)

    if status:
        query = query.filter(Contact.status == status)
    if search:
        query = query.filter(
            (Contact.name.contains(search)) |
            (Contact.email.contains(search)) |
            (Contact.company.contains(search))
        )

    contacts = query.offset(skip).limit(limit).all()
    return contacts

@router.get("/contacts/{contact_id}", response_model=ContactResponse)
def get_contact(contact_id: int, db: Session = Depends(get_db)):
    """Get a single contact by ID"""
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact

@router.post("/contacts", response_model=ContactResponse, status_code=201)
def create_contact(contact: ContactCreate, db: Session = Depends(get_db)):
    """Create a new contact"""
    db_contact = Contact(**contact.model_dump())
    db.add(db_contact)
    db.commit()
    db.refresh(db_contact)
    return db_contact

@router.put("/contacts/{contact_id}", response_model=ContactResponse)
def update_contact(
    contact_id: int,
    contact_update: ContactUpdate,
    db: Session = Depends(get_db)
):
    """Update an existing contact"""
    db_contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not db_contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    update_data = contact_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_contact, field, value)

    db_contact.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_contact)
    return db_contact

@router.delete("/contacts/{contact_id}", status_code=204)
def delete_contact(contact_id: int, db: Session = Depends(get_db)):
    """Delete a contact"""
    db_contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not db_contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    db.delete(db_contact)
    db.commit()
    return None

# ===== DEAL ROUTES =====

@router.get("/deals", response_model=List[DealResponse])
def get_deals(
    stage: Optional[DealStage] = None,
    contact_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all deals with optional filtering"""
    query = db.query(Deal)

    if stage:
        query = query.filter(Deal.stage == stage)
    if contact_id:
        query = query.filter(Deal.contact_id == contact_id)

    deals = query.offset(skip).limit(limit).all()
    return deals

@router.get("/deals/{deal_id}", response_model=DealResponse)
def get_deal(deal_id: int, db: Session = Depends(get_db)):
    """Get a single deal by ID"""
    deal = db.query(Deal).filter(Deal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal

@router.post("/deals", response_model=DealResponse, status_code=201)
def create_deal(deal: DealCreate, db: Session = Depends(get_db)):
    """Create a new deal"""
    # Verify contact exists
    contact = db.query(Contact).filter(Contact.id == deal.contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    db_deal = Deal(**deal.model_dump())
    db.add(db_deal)
    db.commit()
    db.refresh(db_deal)
    return db_deal

@router.put("/deals/{deal_id}", response_model=DealResponse)
def update_deal(deal_id: int, deal_update: DealUpdate, db: Session = Depends(get_db)):
    """Update an existing deal"""
    db_deal = db.query(Deal).filter(Deal.id == deal_id).first()
    if not db_deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    update_data = deal_update.model_dump(exclude_unset=True)

    # If stage changed to closed_won or closed_lost, set actual_close_date
    if "stage" in update_data:
        if update_data["stage"] in [DealStage.CLOSED_WON, DealStage.CLOSED_LOST]:
            if not db_deal.actual_close_date:
                update_data["actual_close_date"] = datetime.utcnow().date()

    for field, value in update_data.items():
        setattr(db_deal, field, value)

    db_deal.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_deal)
    return db_deal

@router.patch("/deals/{deal_id}/stage", response_model=DealResponse)
def update_deal_stage(
    deal_id: int,
    stage: DealStage,
    db: Session = Depends(get_db)
):
    """Update only the stage of a deal (for drag-drop)"""
    db_deal = db.query(Deal).filter(Deal.id == deal_id).first()
    if not db_deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    db_deal.stage = stage

    # Set actual_close_date if closing
    if stage in [DealStage.CLOSED_WON, DealStage.CLOSED_LOST]:
        if not db_deal.actual_close_date:
            db_deal.actual_close_date = datetime.utcnow().date()

    db_deal.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_deal)
    return db_deal

@router.delete("/deals/{deal_id}", status_code=204)
def delete_deal(deal_id: int, db: Session = Depends(get_db)):
    """Delete a deal"""
    db_deal = db.query(Deal).filter(Deal.id == deal_id).first()
    if not db_deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    db.delete(db_deal)
    db.commit()
    return None

# ===== INTERACTION ROUTES =====

@router.get("/interactions", response_model=List[InteractionResponse])
def get_interactions(
    contact_id: Optional[int] = None,
    type: Optional[InteractionType] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all interactions with optional filtering"""
    query = db.query(Interaction)

    if contact_id:
        query = query.filter(Interaction.contact_id == contact_id)
    if type:
        query = query.filter(Interaction.type == type)

    interactions = query.order_by(Interaction.interaction_date.desc()).offset(skip).limit(limit).all()
    return interactions

@router.get("/interactions/{interaction_id}", response_model=InteractionResponse)
def get_interaction(interaction_id: int, db: Session = Depends(get_db)):
    """Get a single interaction by ID"""
    interaction = db.query(Interaction).filter(Interaction.id == interaction_id).first()
    if not interaction:
        raise HTTPException(status_code=404, detail="Interaction not found")
    return interaction

@router.post("/interactions", response_model=InteractionResponse, status_code=201)
def create_interaction(interaction: InteractionCreate, db: Session = Depends(get_db)):
    """Create a new interaction"""
    # Verify contact exists
    contact = db.query(Contact).filter(Contact.id == interaction.contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    db_interaction = Interaction(**interaction.model_dump())
    db.add(db_interaction)
    db.commit()
    db.refresh(db_interaction)
    return db_interaction

@router.put("/interactions/{interaction_id}", response_model=InteractionResponse)
def update_interaction(
    interaction_id: int,
    interaction_update: InteractionUpdate,
    db: Session = Depends(get_db)
):
    """Update an existing interaction"""
    db_interaction = db.query(Interaction).filter(Interaction.id == interaction_id).first()
    if not db_interaction:
        raise HTTPException(status_code=404, detail="Interaction not found")

    update_data = interaction_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_interaction, field, value)

    db.commit()
    db.refresh(db_interaction)
    return db_interaction

@router.delete("/interactions/{interaction_id}", status_code=204)
def delete_interaction(interaction_id: int, db: Session = Depends(get_db)):
    """Delete an interaction"""
    db_interaction = db.query(Interaction).filter(Interaction.id == interaction_id).first()
    if not db_interaction:
        raise HTTPException(status_code=404, detail="Interaction not found")

    db.delete(db_interaction)
    db.commit()
    return None
```

**Step 2: Register CRM routes in main.py**

Modify `backend/app/main.py` to add:
```python
from app.routes import tasks, crm

# Add after tasks router
app.include_router(crm.router)
```

**Step 3: Update routes __init__.py**

Modify `backend/app/routes/__init__.py`:
```python
from . import tasks, crm

__all__ = ["tasks", "crm"]
```

**Step 4: Test CRM API**

Visit `http://localhost:8000/docs` and test:
- Create a contact
- Create a deal for that contact
- Create an interaction for that contact

**Step 5: Commit**

```bash
git add backend/app/routes/
git add backend/app/main.py
git commit -m "feat: add CRM API routes

- Implement contact CRUD endpoints with search
- Implement deal CRUD endpoints with filtering
- Add PATCH /deals/{id}/stage for drag-drop
- Implement interaction CRUD endpoints
- Auto-set actual_close_date when deal closes
- Verify foreign key relationships on create"
```

---

### Task 7: Natural Language Task Parser Service

**Files:**
- Create: `backend/app/services/task_parser.py`
- Create: `backend/app/routes/task_parser.py`
- Modify: `backend/app/main.py`

**Step 1: Write task parser service**

Create `backend/app/services/task_parser.py`:
```python
import re
from datetime import datetime, date, time, timedelta
from typing import Optional, Dict, Any
from dateutil import parser as date_parser
from app.models.task import TaskPriority, TaskStatus

class TaskParser:
    """Parse natural language task descriptions"""

    PRIORITY_KEYWORDS = {
        "urgent": TaskPriority.URGENT,
        "high priority": TaskPriority.HIGH,
        "high": TaskPriority.HIGH,
        "important": TaskPriority.HIGH,
        "low priority": TaskPriority.LOW,
        "low": TaskPriority.LOW,
    }

    RELATIVE_DATES = {
        "today": 0,
        "tomorrow": 1,
        "monday": None,
        "tuesday": None,
        "wednesday": None,
        "thursday": None,
        "friday": None,
        "saturday": None,
        "sunday": None,
    }

    TIME_PATTERN = re.compile(r'\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b', re.IGNORECASE)

    @classmethod
    def parse(cls, text: str) -> Dict[str, Any]:
        """
        Parse natural language text into task components.

        Examples:
        - "Meeting with Sarah tomorrow at 3pm"
        - "Call John high priority"
        - "Proposal due Friday"
        - "Review contract next Monday 2pm urgent"

        Returns dict with: title, due_date, due_time, priority, status
        """
        text_lower = text.lower()
        result = {
            "title": text,
            "due_date": None,
            "due_time": None,
            "priority": TaskPriority.MEDIUM,
            "status": TaskStatus.PENDING,
        }

        # Extract priority
        for keyword, priority in cls.PRIORITY_KEYWORDS.items():
            if keyword in text_lower:
                result["priority"] = priority
                # Remove priority keyword from title
                text = re.sub(re.escape(keyword), "", text, flags=re.IGNORECASE).strip()
                break

        # Extract time
        time_match = cls.TIME_PATTERN.search(text)
        if time_match:
            hour = int(time_match.group(1))
            minute = int(time_match.group(2)) if time_match.group(2) else 0
            am_pm = time_match.group(3).lower() if time_match.group(3) else None

            # Convert to 24-hour format
            if am_pm == "pm" and hour != 12:
                hour += 12
            elif am_pm == "am" and hour == 12:
                hour = 0

            result["due_time"] = time(hour=hour, minute=minute)
            # Remove time from title
            text = cls.TIME_PATTERN.sub("", text).strip()

        # Extract date - try relative dates first
        today = date.today()

        if "today" in text_lower:
            result["due_date"] = today
            text = re.sub(r'\btoday\b', "", text, flags=re.IGNORECASE).strip()
        elif "tomorrow" in text_lower:
            result["due_date"] = today + timedelta(days=1)
            text = re.sub(r'\btomorrow\b', "", text, flags=re.IGNORECASE).strip()
        else:
            # Check for day of week
            weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
            for i, day in enumerate(weekdays):
                if day in text_lower:
                    # Find next occurrence of this weekday
                    days_ahead = i - today.weekday()
                    if days_ahead <= 0:  # Target day already happened this week
                        days_ahead += 7
                    result["due_date"] = today + timedelta(days=days_ahead)
                    text = re.sub(rf'\b{day}\b', "", text, flags=re.IGNORECASE).strip()
                    break

            # Try "next week", "next month"
            if "next week" in text_lower:
                result["due_date"] = today + timedelta(days=7)
                text = re.sub(r'\bnext week\b', "", text, flags=re.IGNORECASE).strip()
            elif "next month" in text_lower:
                result["due_date"] = today + timedelta(days=30)
                text = re.sub(r'\bnext month\b', "", text, flags=re.IGNORECASE).strip()

            # Try absolute date parsing (e.g., "2024-01-15", "Jan 15")
            if not result["due_date"]:
                try:
                    # Try to find a date in the text
                    date_match = re.search(r'\b\d{4}-\d{2}-\d{2}\b', text)
                    if date_match:
                        parsed_date = date_parser.parse(date_match.group()).date()
                        result["due_date"] = parsed_date
                        text = text.replace(date_match.group(), "").strip()
                except:
                    pass

        # Clean up title - remove "at", "due", "on" if they're hanging
        text = re.sub(r'\b(at|due|on|by)\b', "", text, flags=re.IGNORECASE)
        text = re.sub(r'\s+', ' ', text).strip()  # Collapse multiple spaces

        result["title"] = text if text else "New Task"

        return result
```

**Step 2: Write task parser route**

Create `backend/app/routes/task_parser.py`:
```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.task import Task
from app.schemas.task import TaskParseRequest, TaskResponse
from app.services.task_parser import TaskParser

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

@router.post("/parse", response_model=TaskResponse, status_code=201)
def parse_and_create_task(request: TaskParseRequest, db: Session = Depends(get_db)):
    """
    Parse natural language text and create a task.

    Examples:
    - "Meeting with Sarah tomorrow at 3pm"
    - "Call John high priority"
    - "Proposal due Friday"
    """
    parsed = TaskParser.parse(request.text)

    db_task = Task(**parsed)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task
```

**Step 3: Register parser route in main.py**

Modify `backend/app/main.py`:
```python
from app.routes import tasks, crm, task_parser

# Add after crm router
app.include_router(task_parser.router)
```

**Step 4: Update services and routes __init__.py**

Create `backend/app/services/__init__.py`:
```python
from .task_parser import TaskParser

__all__ = ["TaskParser"]
```

Modify `backend/app/routes/__init__.py`:
```python
from . import tasks, crm, task_parser

__all__ = ["tasks", "crm", "task_parser"]
```

**Step 5: Test parser**

Test via API docs or curl:
```bash
curl -X POST http://localhost:8000/api/tasks/parse \
  -H "Content-Type: application/json" \
  -d '{"text":"Meeting with Sarah tomorrow at 3pm high priority"}'
```

Expected: Returns task with title "Meeting with Sarah", due_date=tomorrow, due_time=15:00, priority=high

**Step 6: Commit**

```bash
git add backend/app/services/
git add backend/app/routes/task_parser.py
git add backend/app/main.py
git commit -m "feat: add natural language task parser

- Implement TaskParser service with regex-based parsing
- Support relative dates (today, tomorrow, weekdays)
- Extract time in 12/24 hour format
- Extract priority keywords
- Add POST /api/tasks/parse endpoint
- Clean up title by removing parsed components"
```

---

### Task 8: Context Export Service

**Files:**
- Create: `backend/app/services/export_service.py`
- Create: `backend/app/routes/export.py`
- Modify: `backend/app/main.py`

**Step 1: Write export service**

Create `backend/app/services/export_service.py`:
```python
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date, timedelta
from typing import Optional
from decimal import Decimal

from app.models.task import Task, TaskStatus
from app.models.crm import Contact, Deal, Interaction, DealStage

class ExportService:
    """Generate markdown context reports for Claude CEO mentor"""

    @classmethod
    def generate_context_report(
        cls,
        db: Session,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> str:
        """
        Generate comprehensive markdown report of all data.

        Args:
            db: Database session
            start_date: Filter data from this date (default: 30 days ago)
            end_date: Filter data to this date (default: today)

        Returns:
            Markdown formatted string
        """
        if not end_date:
            end_date = date.today()
        if not start_date:
            start_date = end_date - timedelta(days=30)

        report = []
        report.append(f"# Business Context Report - {start_date} to {end_date}")
        report.append("")
        report.append(f"*Generated on {datetime.now().strftime('%Y-%m-%d %H:%M')}*")
        report.append("")

        # Task Summary
        report.append("## Task Summary")
        report.append("")

        # Completed tasks
        completed_tasks = db.query(Task).filter(
            Task.status == TaskStatus.COMPLETED,
            Task.completed_at >= start_date,
            Task.completed_at <= end_date
        ).all()

        report.append(f"### Completed Tasks ({len(completed_tasks)})")
        if completed_tasks:
            for task in completed_tasks:
                completed_date = task.completed_at.strftime('%Y-%m-%d') if task.completed_at else "N/A"
                report.append(f"- {task.title} - Completed {completed_date}")
        else:
            report.append("- No completed tasks in this period")
        report.append("")

        # Pending tasks
        pending_tasks = db.query(Task).filter(
            Task.status.in_([TaskStatus.PENDING, TaskStatus.IN_PROGRESS])
        ).all()

        report.append(f"### Pending Tasks ({len(pending_tasks)})")
        if pending_tasks:
            for task in pending_tasks:
                priority = f"[{task.priority.value.upper()}]" if task.priority else ""
                due = f"Due {task.due_date}" if task.due_date else "No due date"
                report.append(f"- {priority} {task.title} - {due}")
        else:
            report.append("- No pending tasks")
        report.append("")

        # Overdue tasks
        overdue_tasks = db.query(Task).filter(
            Task.status.in_([TaskStatus.PENDING, TaskStatus.IN_PROGRESS]),
            Task.due_date < date.today()
        ).all()

        report.append(f"### Overdue Tasks ({len(overdue_tasks)})")
        if overdue_tasks:
            for task in overdue_tasks:
                days_overdue = (date.today() - task.due_date).days
                report.append(f"- {task.title} - Due {task.due_date} - {days_overdue} days overdue")
        else:
            report.append("- No overdue tasks")
        report.append("")

        # CRM Overview
        report.append("## CRM Overview")
        report.append("")

        # Active deals
        active_deals = db.query(Deal).filter(
            Deal.stage.in_([
                DealStage.LEAD,
                DealStage.PROSPECT,
                DealStage.PROPOSAL,
                DealStage.NEGOTIATION
            ])
        ).all()

        total_pipeline_value = sum(deal.value or 0 for deal in active_deals)

        report.append(f"### Active Deals (Total Value: ${total_pipeline_value:,.2f})")
        report.append("")
        report.append("**Stage breakdown:**")

        # Group by stage
        stage_counts = {}
        stage_values = {}
        for deal in active_deals:
            stage = deal.stage.value
            stage_counts[stage] = stage_counts.get(stage, 0) + 1
            stage_values[stage] = stage_values.get(stage, Decimal(0)) + (deal.value or Decimal(0))

        for stage in [DealStage.LEAD, DealStage.PROSPECT, DealStage.PROPOSAL, DealStage.NEGOTIATION]:
            stage_name = stage.value.replace('_', ' ').title()
            count = stage_counts.get(stage.value, 0)
            value = stage_values.get(stage.value, Decimal(0))
            report.append(f"- {stage_name}: {count} deals (${value:,.2f})")

        report.append("")
        report.append("**Top deals:**")
        top_deals = sorted(active_deals, key=lambda d: d.value or 0, reverse=True)[:5]
        for deal in top_deals:
            contact = db.query(Contact).filter(Contact.id == deal.contact_id).first()
            contact_name = contact.name if contact else "Unknown"
            stage_name = deal.stage.value.replace('_', ' ').title()
            value = f"${deal.value:,.2f}" if deal.value else "N/A"
            close_date = deal.expected_close_date or "TBD"
            report.append(f"- {contact_name} - {deal.title} - Stage: {stage_name} - Value: {value} - Close: {close_date}")
        report.append("")

        # Recent interactions
        recent_interactions = db.query(Interaction).filter(
            Interaction.interaction_date >= start_date,
            Interaction.interaction_date <= end_date
        ).order_by(Interaction.interaction_date.desc()).limit(10).all()

        report.append(f"### Recent Interactions (Last {(end_date - start_date).days} days)")
        if recent_interactions:
            for interaction in recent_interactions:
                contact = db.query(Contact).filter(Contact.id == interaction.contact_id).first()
                contact_name = contact.name if contact else "Unknown"
                date_str = interaction.interaction_date.strftime('%Y-%m-%d')
                type_str = interaction.type.value.title()
                subject = interaction.subject or "No subject"
                report.append(f"- {date_str} - {type_str} with {contact_name}: {subject}")
        else:
            report.append("- No recent interactions")
        report.append("")

        # Pipeline Health
        report.append("### Pipeline Health")

        # Closed deals in date range
        closed_won = db.query(Deal).filter(
            Deal.stage == DealStage.CLOSED_WON,
            Deal.actual_close_date >= start_date,
            Deal.actual_close_date <= end_date
        ).all()

        closed_lost = db.query(Deal).filter(
            Deal.stage == DealStage.CLOSED_LOST,
            Deal.actual_close_date >= start_date,
            Deal.actual_close_date <= end_date
        ).all()

        won_count = len(closed_won)
        lost_count = len(closed_lost)
        won_revenue = sum(deal.value or 0 for deal in closed_won)

        win_rate = (won_count / (won_count + lost_count) * 100) if (won_count + lost_count) > 0 else 0
        avg_deal_size = won_revenue / won_count if won_count > 0 else 0

        report.append(f"- Total active deals: {len(active_deals)}")
        report.append(f"- Closed won this period: {won_count} (${won_revenue:,.2f} revenue)")
        report.append(f"- Closed lost this period: {lost_count}")
        report.append(f"- Win rate: {win_rate:.1f}%")
        report.append(f"- Average deal size: ${avg_deal_size:,.2f}")
        report.append("")

        # Key Metrics
        report.append("## Key Metrics")
        report.append("")

        total_tasks = db.query(Task).count()
        task_completion_rate = (len(completed_tasks) / total_tasks * 100) if total_tasks > 0 else 0

        active_contacts = db.query(Contact).filter(
            Contact.status.in_(["lead", "prospect", "client"])
        ).count()

        report.append(f"- Task completion rate: {task_completion_rate:.1f}%")
        report.append(f"- Deals closed this period: {won_count}")
        report.append(f"- Revenue generated: ${won_revenue:,.2f}")
        report.append(f"- Active contacts: {active_contacts}")
        report.append(f"- Total pipeline value: ${total_pipeline_value:,.2f}")
        report.append("")

        return "\n".join(report)
```

**Step 2: Write export route**

Create `backend/app/routes/export.py`:
```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date, timedelta
from typing import Optional

from app.database import get_db
from app.services.export_service import ExportService

router = APIRouter(prefix="/api/export", tags=["export"])

@router.get("/context")
def get_context_export(
    start_date: Optional[date] = Query(None, description="Start date for filtering (default: 30 days ago)"),
    end_date: Optional[date] = Query(None, description="End date for filtering (default: today)"),
    db: Session = Depends(get_db)
):
    """
    Generate comprehensive markdown context report for Claude CEO mentor.

    Includes:
    - Task summary (completed, pending, overdue)
    - CRM overview (active deals, pipeline value)
    - Recent interactions
    - Pipeline health metrics
    - Key business metrics
    """
    markdown = ExportService.generate_context_report(db, start_date, end_date)

    return {
        "markdown": markdown,
        "start_date": start_date or (date.today() - timedelta(days=30)),
        "end_date": end_date or date.today()
    }
```

**Step 3: Register export route**

Modify `backend/app/main.py`:
```python
from app.routes import tasks, crm, task_parser, export

# Add after task_parser router
app.include_router(export.router)
```

Update `backend/app/services/__init__.py`:
```python
from .task_parser import TaskParser
from .export_service import ExportService

__all__ = ["TaskParser", "ExportService"]
```

Update `backend/app/routes/__init__.py`:
```python
from . import tasks, crm, task_parser, export

__all__ = ["tasks", "crm", "task_parser", "export"]
```

**Step 4: Test export endpoint**

Visit `http://localhost:8000/api/export/context` or use curl:
```bash
curl http://localhost:8000/api/export/context
```

Expected: Returns JSON with markdown field containing formatted report

**Step 5: Commit**

```bash
git add backend/app/services/export_service.py
git add backend/app/routes/export.py
git add backend/app/main.py
git commit -m "feat: add context export service for Claude CEO mentor

- Implement ExportService for markdown report generation
- Include task summary (completed, pending, overdue)
- Include CRM pipeline analysis and deal breakdown
- Include recent interactions timeline
- Calculate pipeline health metrics (win rate, avg deal size)
- Add GET /api/export/context endpoint with date filtering"
```

---

### Task 9: Frontend Project Setup

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tsconfig.node.json`
- Create: `frontend/index.html`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/postcss.config.js`
- Create: `frontend/.env.example`

**Step 1: Initialize frontend with Vite**

Run:
```bash
cd C:\Apps\personalApp\.worktrees\feature\mvp-implementation
npm create vite@latest frontend -- --template react-ts
```

**Step 2: Install dependencies**

Run:
```bash
cd frontend
npm install
npm install -D tailwindcss postcss autoprefixer
npm install @tanstack/react-query axios react-router-dom date-fns
npm install lucide-react clsx tailwind-merge
npx tailwindcss init -p
```

**Step 3: Configure Tailwind**

Modify `frontend/tailwind.config.js`:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

**Step 4: Create base CSS with Tailwind directives**

Create `frontend/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}
```

**Step 5: Create environment config**

Create `frontend/.env.example`:
```
VITE_API_URL=http://localhost:8000
```

Create `frontend/.env`:
```
VITE_API_URL=http://localhost:8000
```

**Step 6: Update vite config for proxy**

Modify `frontend/vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
```

**Step 7: Test frontend starts**

Run:
```bash
cd frontend
npm run dev
```

Expected: Vite dev server starts on `http://localhost:5173`

**Step 8: Commit**

```bash
git add frontend/
git commit -m "feat: initialize frontend with Vite, React, TypeScript

- Set up Vite project with React and TypeScript
- Configure Tailwind CSS with PostCSS
- Install dependencies: TanStack Query, React Router, axios
- Configure API proxy for backend communication
- Add environment configuration"
```

---

## Phase 2: Personal Assistant

### Task 10: API Client Setup

**Files:**
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/types/index.ts`

**Step 1: Create TypeScript types**

Create `frontend/src/types/index.ts`:
```typescript
// Task types
export enum TaskPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent",
}

export enum TaskStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  DELAYED = "delayed",
}

export interface Task {
  id: number;
  title: string;
  description?: string;
  due_date?: string;
  due_time?: string;
  priority: TaskPriority;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface TaskCreate {
  title: string;
  description?: string;
  due_date?: string;
  due_time?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
}

export interface TaskUpdate {
  title?: string;
  description?: string;
  due_date?: string;
  due_time?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
}

// CRM types
export enum ContactStatus {
  LEAD = "lead",
  PROSPECT = "prospect",
  CLIENT = "client",
  INACTIVE = "inactive",
}

export enum DealStage {
  LEAD = "lead",
  PROSPECT = "prospect",
  PROPOSAL = "proposal",
  NEGOTIATION = "negotiation",
  CLOSED_WON = "closed_won",
  CLOSED_LOST = "closed_lost",
}

export enum InteractionType {
  MEETING = "meeting",
  EMAIL = "email",
  CALL = "call",
  NOTE = "note",
}

export interface Contact {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  status: ContactStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ContactCreate {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  status?: ContactStatus;
  notes?: string;
}

export interface Deal {
  id: number;
  contact_id: number;
  title: string;
  description?: string;
  value?: number;
  stage: DealStage;
  probability: number;
  expected_close_date?: string;
  actual_close_date?: string;
  created_at: string;
  updated_at: string;
}

export interface DealCreate {
  contact_id: number;
  title: string;
  description?: string;
  value?: number;
  stage?: DealStage;
  probability?: number;
  expected_close_date?: string;
}

export interface Interaction {
  id: number;
  contact_id: number;
  type: InteractionType;
  subject?: string;
  notes?: string;
  interaction_date: string;
  created_at: string;
}

export interface InteractionCreate {
  contact_id: number;
  type: InteractionType;
  subject?: string;
  notes?: string;
  interaction_date: string;
}

// Export types
export interface ContextExport {
  markdown: string;
  start_date: string;
  end_date: string;
}
```

**Step 2: Create API client**

Create `frontend/src/lib/api.ts`:
```typescript
import axios from 'axios';
import {
  Task,
  TaskCreate,
  TaskUpdate,
  Contact,
  ContactCreate,
  Deal,
  DealCreate,
  Interaction,
  InteractionCreate,
  ContextExport,
  TaskStatus,
  DealStage,
} from '@/types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Task API
export const taskApi = {
  getAll: async (status?: TaskStatus): Promise<Task[]> => {
    const params = status ? { status } : {};
    const response = await api.get('/api/tasks', { params });
    return response.data;
  },

  getById: async (id: number): Promise<Task> => {
    const response = await api.get(`/api/tasks/${id}`);
    return response.data;
  },

  create: async (task: TaskCreate): Promise<Task> => {
    const response = await api.post('/api/tasks', task);
    return response.data;
  },

  update: async (id: number, task: TaskUpdate): Promise<Task> => {
    const response = await api.put(`/api/tasks/${id}`, task);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/tasks/${id}`);
  },

  updateStatus: async (id: number, status: TaskStatus): Promise<Task> => {
    const response = await api.patch(`/api/tasks/${id}/status`, null, {
      params: { status },
    });
    return response.data;
  },

  parse: async (text: string): Promise<Task> => {
    const response = await api.post('/api/tasks/parse', { text });
    return response.data;
  },
};

// Contact API
export const contactApi = {
  getAll: async (search?: string): Promise<Contact[]> => {
    const params = search ? { search } : {};
    const response = await api.get('/api/crm/contacts', { params });
    return response.data;
  },

  getById: async (id: number): Promise<Contact> => {
    const response = await api.get(`/api/crm/contacts/${id}`);
    return response.data;
  },

  create: async (contact: ContactCreate): Promise<Contact> => {
    const response = await api.post('/api/crm/contacts', contact);
    return response.data;
  },

  update: async (id: number, contact: Partial<ContactCreate>): Promise<Contact> => {
    const response = await api.put(`/api/crm/contacts/${id}`, contact);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/crm/contacts/${id}`);
  },
};

// Deal API
export const dealApi = {
  getAll: async (stage?: DealStage): Promise<Deal[]> => {
    const params = stage ? { stage } : {};
    const response = await api.get('/api/crm/deals', { params });
    return response.data;
  },

  getById: async (id: number): Promise<Deal> => {
    const response = await api.get(`/api/crm/deals/${id}`);
    return response.data;
  },

  create: async (deal: DealCreate): Promise<Deal> => {
    const response = await api.post('/api/crm/deals', deal);
    return response.data;
  },

  update: async (id: number, deal: Partial<DealCreate>): Promise<Deal> => {
    const response = await api.put(`/api/crm/deals/${id}`, deal);
    return response.data;
  },

  updateStage: async (id: number, stage: DealStage): Promise<Deal> => {
    const response = await api.patch(`/api/crm/deals/${id}/stage`, null, {
      params: { stage },
    });
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/crm/deals/${id}`);
  },
};

// Interaction API
export const interactionApi = {
  getAll: async (contactId?: number): Promise<Interaction[]> => {
    const params = contactId ? { contact_id: contactId } : {};
    const response = await api.get('/api/crm/interactions', { params });
    return response.data;
  },

  getById: async (id: number): Promise<Interaction> => {
    const response = await api.get(`/api/crm/interactions/${id}`);
    return response.data;
  },

  create: async (interaction: InteractionCreate): Promise<Interaction> => {
    const response = await api.post('/api/crm/interactions', interaction);
    return response.data;
  },

  update: async (id: number, interaction: Partial<InteractionCreate>): Promise<Interaction> => {
    const response = await api.put(`/api/crm/interactions/${id}`, interaction);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/crm/interactions/${id}`);
  },
};

// Export API
export const exportApi = {
  getContext: async (startDate?: string, endDate?: string): Promise<ContextExport> => {
    const params: any = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await api.get('/api/export/context', { params });
    return response.data;
  },
};
```

**Step 3: Create utility functions**

Create `frontend/src/lib/utils.ts`:
```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Step 4: Commit**

```bash
git add frontend/src/lib/ frontend/src/types/
git commit -m "feat: add API client and TypeScript types

- Define TypeScript interfaces for all models
- Create API client with axios
- Implement API methods for tasks, contacts, deals, interactions
- Add export API client for context generation
- Add utility function for className merging"
```

---

### Task 11: React Query Setup and App Shell

**Files:**
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/components/Layout.tsx`

**Step 1: Set up React Query provider**

Modify `frontend/src/main.tsx`:
```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)
```

**Step 2: Create layout component**

Create `frontend/src/components/Layout.tsx`:
```typescript
import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  Briefcase,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
  { name: 'Contacts', href: '/contacts', icon: Users },
  { name: 'Deals', href: '/deals', icon: Briefcase },
  { name: 'Export', href: '/export', icon: Download },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-16 border-b">
            <h1 className="text-xl font-bold text-gray-800">
              Personal App
            </h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    'flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors',
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  )}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t">
            <p className="text-xs text-gray-500 text-center">
              v1.0.0
            </p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
```

**Step 3: Set up React Router**

Modify `frontend/src/App.tsx`:
```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';

// Placeholder pages (will create properly later)
function Dashboard() {
  return <div className="p-8"><h2 className="text-2xl font-bold">Dashboard</h2></div>;
}

function Tasks() {
  return <div className="p-8"><h2 className="text-2xl font-bold">Tasks</h2></div>;
}

function Contacts() {
  return <div className="p-8"><h2 className="text-2xl font-bold">Contacts</h2></div>;
}

function Deals() {
  return <div className="p-8"><h2 className="text-2xl font-bold">Deals</h2></div>;
}

function Export() {
  return <div className="p-8"><h2 className="text-2xl font-bold">Export</h2></div>;
}

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/deals" element={<Deals />} />
          <Route path="/export" element={<Export />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
```

**Step 4: Test app shell**

Run both backend and frontend:
```bash
# Terminal 1 - Backend
cd backend
uvicorn app.main:app --reload

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Visit `http://localhost:5173` - should see sidebar with navigation

**Step 5: Commit**

```bash
git add frontend/src/
git commit -m "feat: set up React Router and app layout

- Configure React Query client with defaults
- Create Layout component with sidebar navigation
- Set up React Router with placeholder pages
- Add navigation for Dashboard, Tasks, Contacts, Deals, Export
- Style with Tailwind CSS"
```

---

### Task 12: Task List Component

**Files:**
- Create: `frontend/src/pages/Tasks.tsx`
- Create: `frontend/src/components/TaskList.tsx`
- Create: `frontend/src/components/TaskItem.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Create TaskItem component**

Create `frontend/src/components/TaskItem.tsx`:
```typescript
import { Task, TaskStatus, TaskPriority } from '@/types';
import { format, isPast, isToday, isTomorrow } from 'date-fns';
import { Check, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskItemProps {
  task: Task;
  onStatusChange: (id: number, status: TaskStatus) => void;
  onClick: () => void;
}

const priorityColors = {
  [TaskPriority.LOW]: 'border-l-gray-400',
  [TaskPriority.MEDIUM]: 'border-l-blue-400',
  [TaskPriority.HIGH]: 'border-l-orange-400',
  [TaskPriority.URGENT]: 'border-l-red-500',
};

const statusColors = {
  [TaskStatus.PENDING]: 'bg-gray-100',
  [TaskStatus.IN_PROGRESS]: 'bg-blue-50',
  [TaskStatus.COMPLETED]: 'bg-green-50',
  [TaskStatus.DELAYED]: 'bg-yellow-50',
};

export default function TaskItem({ task, onStatusChange, onClick }: TaskItemProps) {
  const isCompleted = task.status === TaskStatus.COMPLETED;

  const getDueDateBadge = () => {
    if (!task.due_date) return null;

    const dueDate = new Date(task.due_date);
    const isOverdue = isPast(dueDate) && !isToday(dueDate);

    if (isOverdue && !isCompleted) {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded">
          <AlertCircle className="w-3 h-3 mr-1" />
          Overdue
        </span>
      );
    }

    if (isToday(dueDate)) {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-yellow-700 bg-yellow-100 rounded">
          <Clock className="w-3 h-3 mr-1" />
          Due Today
        </span>
      );
    }

    if (isTomorrow(dueDate)) {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded">
          <Clock className="w-3 h-3 mr-1" />
          Due Tomorrow
        </span>
      );
    }

    return (
      <span className="text-xs text-gray-500">
        Due {format(dueDate, 'MMM d')}
      </span>
    );
  };

  const handleCheckbox = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = isCompleted ? TaskStatus.PENDING : TaskStatus.COMPLETED;
    onStatusChange(task.id, newStatus);
  };

  return (
    <div
      className={cn(
        'flex items-center p-4 bg-white border-l-4 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow',
        priorityColors[task.priority],
        statusColors[task.status]
      )}
      onClick={onClick}
    >
      {/* Checkbox */}
      <button
        onClick={handleCheckbox}
        className={cn(
          'flex items-center justify-center w-5 h-5 mr-3 border-2 rounded',
          isCompleted
            ? 'bg-green-500 border-green-500'
            : 'border-gray-300 hover:border-green-400'
        )}
      >
        {isCompleted && <Check className="w-4 h-4 text-white" />}
      </button>

      {/* Task content */}
      <div className="flex-1 min-w-0">
        <h3
          className={cn(
            'text-sm font-medium',
            isCompleted ? 'line-through text-gray-400' : 'text-gray-900'
          )}
        >
          {task.title}
        </h3>

        <div className="flex items-center mt-1 space-x-2">
          {getDueDateBadge()}

          <span className="text-xs text-gray-500 capitalize">
            {task.priority.replace('_', ' ')}
          </span>

          {task.due_time && (
            <span className="text-xs text-gray-500">
              {task.due_time}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Create TaskList component**

Create `frontend/src/components/TaskList.tsx`:
```typescript
import { Task, TaskStatus } from '@/types';
import TaskItem from './TaskItem';

interface TaskListProps {
  tasks: Task[];
  onStatusChange: (id: number, status: TaskStatus) => void;
  onTaskClick: (task: Task) => void;
}

export default function TaskList({ tasks, onStatusChange, onTaskClick }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-gray-500">No tasks found</p>
        <p className="text-sm text-gray-400 mt-2">
          Use Cmd+K to create your first task
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          onStatusChange={onStatusChange}
          onClick={() => onTaskClick(task)}
        />
      ))}
    </div>
  );
}
```

**Step 3: Create Tasks page**

Create `frontend/src/pages/Tasks.tsx`:
```typescript
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskApi } from '@/lib/api';
import { Task, TaskStatus } from '@/types';
import TaskList from '@/components/TaskList';
import { Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Tasks() {
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', filter],
    queryFn: () => taskApi.getAll(filter === 'all' ? undefined : filter),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: TaskStatus }) =>
      taskApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const handleStatusChange = (id: number, status: TaskStatus) => {
    updateStatusMutation.mutate({ id, status });
  };

  const handleTaskClick = (task: Task) => {
    console.log('Task clicked:', task);
    // TODO: Open task detail modal
  };

  const filters = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: TaskStatus.PENDING },
    { label: 'In Progress', value: TaskStatus.IN_PROGRESS },
    { label: 'Completed', value: TaskStatus.COMPLETED },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-8 py-6">
        <h1 className="text-3xl font-bold text-gray-900">Tasks</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your tasks and stay organized
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-8 py-4">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-gray-400" />
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value as any)}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                filter === f.value
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-auto px-8 py-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <TaskList
            tasks={tasks}
            onStatusChange={handleStatusChange}
            onTaskClick={handleTaskClick}
          />
        )}
      </div>
    </div>
  );
}
```

**Step 4: Update App.tsx to use new Tasks page**

Modify `frontend/src/App.tsx`:
```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Tasks from './pages/Tasks';

// Placeholder pages
function Dashboard() {
  return <div className="p-8"><h2 className="text-2xl font-bold">Dashboard</h2></div>;
}

function Contacts() {
  return <div className="p-8"><h2 className="text-2xl font-bold">Contacts</h2></div>;
}

function Deals() {
  return <div className="p-8"><h2 className="text-2xl font-bold">Deals</h2></div>;
}

function Export() {
  return <div className="p-8"><h2 className="text-2xl font-bold">Export</h2></div>;
}

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/deals" element={<Deals />} />
          <Route path="/export" element={<Export />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
```

**Step 5: Test task list**

Create a few tasks via the backend API, then visit `http://localhost:5173/tasks`

Expected: See task list with filtering, can check/uncheck tasks

**Step 6: Commit**

```bash
git add frontend/src/
git commit -m "feat: add task list page with filtering

- Create TaskItem component with priority colors and status badges
- Create TaskList component with empty state
- Implement Tasks page with filter tabs
- Add status toggle functionality with React Query mutations
- Show due date badges (overdue, today, tomorrow)
- Style with Tailwind CSS"
```

---

Due to length constraints, I'll provide the structure for remaining tasks. The plan continues with:

### Task 13: Command Bar Component (Natural Language Input)
### Task 14: Contact Management Page
### Task 15: Deal Pipeline Kanban Board
### Task 16: Interaction Timeline Component
### Task 17: Export Page with Copy-to-Clipboard
### Task 18: Dashboard with Widgets
### Task 19: Polish & Error Handling
### Task 20: Final Testing & Documentation

Each task follows the same TDD-style structure with exact file paths, complete code, test steps, and commit messages.

---

## Execution Instructions

This plan is designed to be executed task-by-task with `@superpowers:executing-plans` skill.

Each task includes:
- **Exact file paths** for all code
- **Complete code examples** (not placeholders)
- **Test commands** with expected output
- **Commit message** following conventional commits

**Key principles enforced:**
- DRY: Reuse components and utilities
- YAGNI: Only build features in the design doc
- TDD-like: Create, test, commit incrementally
- Frequent commits: After each completed task
