# AI Assistant Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate Anthropic Claude API as a context-aware AI assistant that can read and modify user data through function calling.

**Architecture:** Three-layer system with FastAPI backend (AI router + service + tools), React frontend (AIChatPanel component), and Anthropic API with tool use for tasks, deals, contacts, projects, and goals.

**Tech Stack:** Anthropic Python SDK, FastAPI SSE streaming, React hooks, EventSource API

---

## Task 1: Backend Foundation - Install Anthropic SDK

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/.env.example`

**Step 1: Add Anthropic SDK to requirements**

Add to `backend/requirements.txt`:
```
anthropic==0.39.0
```

**Step 2: Install the package**

Run: `cd backend && ./venv/Scripts/pip install anthropic`
Expected: Package installed successfully

**Step 3: Add environment variable template**

Add to `backend/.env.example`:
```bash
# Anthropic API Configuration
ANTHROPIC_API_KEY=sk-ant-your-key-here
ANTHROPIC_MODEL=claude-3-haiku-20240307
AI_RATE_LIMIT_REQUESTS=50
AI_RATE_LIMIT_WINDOW=3600
```

**Step 4: Commit**

```bash
git add backend/requirements.txt backend/.env.example
git commit -m "feat: add Anthropic SDK dependency and env config"
```

---

## Task 2: AI Service Module - Core Anthropic Integration

**Files:**
- Create: `backend/app/services/ai_service.py`
- Create: `backend/app/schemas/ai.py`

**Step 1: Create AI schemas**

Create `backend/app/schemas/ai.py`:
```python
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

class Message(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    context: Dict[str, Any] = {}

class ChatResponse(BaseModel):
    message: str
    tool_calls: List[Dict[str, Any]] = []
```

**Step 2: Create AI service skeleton**

Create `backend/app/services/ai_service.py`:
```python
import os
from typing import List, Dict, Any, AsyncGenerator
from anthropic import Anthropic
from app.schemas.ai import Message

class AIService:
    def __init__(self):
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable not set")

        self.client = Anthropic(api_key=api_key)
        self.model = os.getenv("ANTHROPIC_MODEL", "claude-3-haiku-20240307")

    def build_system_prompt(self, context: Dict[str, Any]) -> str:
        """Build context-aware system prompt based on current page"""
        page = context.get("page", "unknown")

        base = "You are an AI assistant for Vertex, a personal productivity app."

        page_contexts = {
            "tasks": "You help manage tasks. You can view, create, update, and delete tasks.",
            "deals": "You help manage deals in the CRM. You can view, create, and update deals.",
            "contacts": "You help manage contacts. You can view, create, and update contact information.",
            "projects": "You help manage projects. You can view, create projects and their tasks.",
            "goals": "You help manage goals. You can view and create goals.",
        }

        context_text = page_contexts.get(page, "You provide general assistance.")
        return f"{base}\n\n{context_text}"

    async def chat(
        self,
        messages: List[Message],
        context: Dict[str, Any],
        tools: List[Dict[str, Any]] = []
    ) -> AsyncGenerator[str, None]:
        """
        Stream chat responses from Claude.
        Yields text chunks as they arrive.
        """
        system_prompt = self.build_system_prompt(context)

        # Convert messages to Anthropic format
        anthropic_messages = [
            {"role": msg.role, "content": msg.content}
            for msg in messages
        ]

        # For now, just send without tools (we'll add tool use in next task)
        with self.client.messages.stream(
            model=self.model,
            max_tokens=1024,
            system=system_prompt,
            messages=anthropic_messages,
        ) as stream:
            for text in stream.text_stream:
                yield text
```

**Step 3: Verify imports work**

Run: `cd backend && ./venv/Scripts/python -c "from app.services.ai_service import AIService; print('OK')"`
Expected: "OK"

**Step 4: Commit**

```bash
git add backend/app/services/ai_service.py backend/app/schemas/ai.py
git commit -m "feat: add AI service with streaming chat support"
```

---

## Task 3: AI Router - API Endpoint

**Files:**
- Create: `backend/app/routes/ai.py`
- Modify: `backend/app/main.py`

**Step 1: Create AI router with SSE streaming**

Create `backend/app/routes/ai.py`:
```python
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from app.schemas.ai import ChatRequest
from app.services.ai_service import AIService

router = APIRouter(prefix="/api/ai", tags=["ai"])

async def stream_response(ai_service: AIService, request: ChatRequest):
    """Generator for SSE streaming"""
    async for chunk in ai_service.chat(request.messages, request.context):
        # Server-Sent Events format
        yield f"data: {chunk}\n\n"

    # Send completion signal
    yield "data: [DONE]\n\n"

@router.post("/chat")
async def chat(request: ChatRequest):
    """
    Stream AI chat responses using Server-Sent Events.

    Request format:
    {
        "messages": [{"role": "user", "content": "Create a task..."}],
        "context": {"page": "tasks"}
    }
    """
    ai_service = AIService()

    return StreamingResponse(
        stream_response(ai_service, request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )
```

**Step 2: Register router in main app**

Modify `backend/app/main.py`, add import:
```python
from app.routes import tasks, crm, task_parser, export, goals, goal_parser, projects, ai
```

Add router registration after existing routers:
```python
app.include_router(ai.router)
```

**Step 3: Test endpoint manually**

Run backend server (in main worktree, not this one):
```bash
cd backend && ./venv/Scripts/python -m uvicorn app.main:app --reload --port 8001
```

Test with curl:
```bash
curl -X POST http://localhost:8001/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}],"context":{"page":"tasks"}}'
```

Expected: Streaming SSE response with text chunks

**Step 4: Commit**

```bash
git add backend/app/routes/ai.py backend/app/main.py
git commit -m "feat: add AI chat endpoint with SSE streaming"
```

---

## Task 4: Tool Registry - Define Available Tools

**Files:**
- Create: `backend/app/services/ai_tools.py`

**Step 1: Create tool definitions for Tasks**

Create `backend/app/services/ai_tools.py`:
```python
from typing import List, Dict, Any

# Tool definitions in Anthropic's format
TASK_TOOLS = [
    {
        "name": "get_tasks",
        "description": "Get list of tasks, optionally filtered by status, priority, or date range",
        "input_schema": {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "enum": ["pending", "in_progress", "completed"],
                    "description": "Filter by task status"
                },
                "priority": {
                    "type": "string",
                    "enum": ["low", "medium", "high"],
                    "description": "Filter by priority level"
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of tasks to return",
                    "default": 10
                }
            }
        }
    },
    {
        "name": "create_task",
        "description": "Create a new task with title and optional details",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "Task title/description"
                },
                "due_date": {
                    "type": "string",
                    "description": "Due date in YYYY-MM-DD format"
                },
                "priority": {
                    "type": "string",
                    "enum": ["low", "medium", "high"],
                    "description": "Task priority",
                    "default": "medium"
                }
            },
            "required": ["title"]
        }
    },
    {
        "name": "update_task",
        "description": "Update an existing task's properties",
        "input_schema": {
            "type": "object",
            "properties": {
                "task_id": {
                    "type": "integer",
                    "description": "ID of the task to update"
                },
                "title": {"type": "string"},
                "status": {"type": "string", "enum": ["pending", "in_progress", "completed"]},
                "priority": {"type": "string", "enum": ["low", "medium", "high"]},
                "due_date": {"type": "string"}
            },
            "required": ["task_id"]
        }
    }
]

DEAL_TOOLS = [
    {
        "name": "get_deals",
        "description": "Get list of deals, optionally filtered by stage",
        "input_schema": {
            "type": "object",
            "properties": {
                "stage": {
                    "type": "string",
                    "enum": ["lead", "qualified", "proposal", "negotiation", "closed"],
                    "description": "Filter by deal stage"
                },
                "limit": {"type": "integer", "default": 10}
            }
        }
    },
    {
        "name": "create_deal",
        "description": "Create a new deal",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Deal title"},
                "value": {"type": "number", "description": "Deal value in dollars"},
                "contact_id": {"type": "integer", "description": "Associated contact ID"},
                "stage": {
                    "type": "string",
                    "enum": ["lead", "qualified", "proposal", "negotiation", "closed"],
                    "default": "lead"
                }
            },
            "required": ["title"]
        }
    }
]

CONTACT_TOOLS = [
    {
        "name": "get_contacts",
        "description": "Get list of contacts, optionally filtered by search term",
        "input_schema": {
            "type": "object",
            "properties": {
                "search": {"type": "string", "description": "Search by name or email"},
                "limit": {"type": "integer", "default": 10}
            }
        }
    },
    {
        "name": "create_contact",
        "description": "Create a new contact",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Contact name"},
                "email": {"type": "string", "description": "Email address"},
                "phone": {"type": "string", "description": "Phone number"},
                "company": {"type": "string", "description": "Company name"}
            },
            "required": ["name"]
        }
    }
]

def get_tools_for_page(page: str) -> List[Dict[str, Any]]:
    """Return appropriate tools based on current page context"""
    tools_map = {
        "tasks": TASK_TOOLS,
        "deals": DEAL_TOOLS,
        "contacts": CONTACT_TOOLS,
    }
    return tools_map.get(page, [])
```

**Step 2: Verify tool definitions are valid**

Run: `cd backend && ./venv/Scripts/python -c "from app.services.ai_tools import get_tools_for_page; print(len(get_tools_for_page('tasks')))"`
Expected: "3"

**Step 3: Commit**

```bash
git add backend/app/services/ai_tools.py
git commit -m "feat: add tool definitions for tasks, deals, and contacts"
```

---

## Task 5: Tool Executor - Execute Tool Calls

**Files:**
- Create: `backend/app/services/tool_executor.py`

**Step 1: Create tool executor**

Create `backend/app/services/tool_executor.py`:
```python
from typing import Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.task import Task
from app.models.crm import Deal, Contact

class ToolExecutor:
    def __init__(self, db: Session):
        self.db = db

    def execute(self, tool_name: str, tool_input: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool call and return results"""

        # Map tool names to methods
        handlers = {
            "get_tasks": self._get_tasks,
            "create_task": self._create_task,
            "update_task": self._update_task,
            "get_deals": self._get_deals,
            "create_deal": self._create_deal,
            "get_contacts": self._get_contacts,
            "create_contact": self._create_contact,
        }

        handler = handlers.get(tool_name)
        if not handler:
            return {"error": f"Unknown tool: {tool_name}"}

        try:
            return handler(tool_input)
        except Exception as e:
            return {"error": str(e)}

    # Task tools
    def _get_tasks(self, params: Dict[str, Any]) -> Dict[str, Any]:
        query = self.db.query(Task)

        if "status" in params:
            query = query.filter(Task.status == params["status"])
        if "priority" in params:
            query = query.filter(Task.priority == params["priority"])

        limit = params.get("limit", 10)
        tasks = query.limit(limit).all()

        return {
            "tasks": [
                {
                    "id": t.id,
                    "title": t.title,
                    "status": t.status,
                    "priority": t.priority,
                    "due_date": str(t.due_date) if t.due_date else None
                }
                for t in tasks
            ]
        }

    def _create_task(self, params: Dict[str, Any]) -> Dict[str, Any]:
        task = Task(
            title=params["title"],
            priority=params.get("priority", "medium"),
            status="pending"
        )

        if "due_date" in params:
            task.due_date = datetime.strptime(params["due_date"], "%Y-%m-%d").date()

        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)

        return {
            "success": True,
            "task_id": task.id,
            "message": f"Created task: {task.title}"
        }

    def _update_task(self, params: Dict[str, Any]) -> Dict[str, Any]:
        task = self.db.query(Task).filter(Task.id == params["task_id"]).first()

        if not task:
            return {"error": f"Task {params['task_id']} not found"}

        # Update fields
        for field in ["title", "status", "priority"]:
            if field in params:
                setattr(task, field, params[field])

        if "due_date" in params:
            task.due_date = datetime.strptime(params["due_date"], "%Y-%m-%d").date()

        self.db.commit()

        return {
            "success": True,
            "message": f"Updated task {task.id}"
        }

    # Deal tools
    def _get_deals(self, params: Dict[str, Any]) -> Dict[str, Any]:
        query = self.db.query(Deal)

        if "stage" in params:
            query = query.filter(Deal.stage == params["stage"])

        limit = params.get("limit", 10)
        deals = query.limit(limit).all()

        return {
            "deals": [
                {
                    "id": d.id,
                    "title": d.title,
                    "value": d.value,
                    "stage": d.stage
                }
                for d in deals
            ]
        }

    def _create_deal(self, params: Dict[str, Any]) -> Dict[str, Any]:
        deal = Deal(
            title=params["title"],
            value=params.get("value", 0),
            stage=params.get("stage", "lead"),
            contact_id=params.get("contact_id")
        )

        self.db.add(deal)
        self.db.commit()
        self.db.refresh(deal)

        return {
            "success": True,
            "deal_id": deal.id,
            "message": f"Created deal: {deal.title}"
        }

    # Contact tools
    def _get_contacts(self, params: Dict[str, Any]) -> Dict[str, Any]:
        query = self.db.query(Contact)

        if "search" in params:
            search = f"%{params['search']}%"
            query = query.filter(
                (Contact.name.ilike(search)) | (Contact.email.ilike(search))
            )

        limit = params.get("limit", 10)
        contacts = query.limit(limit).all()

        return {
            "contacts": [
                {
                    "id": c.id,
                    "name": c.name,
                    "email": c.email,
                    "company": c.company
                }
                for c in contacts
            ]
        }

    def _create_contact(self, params: Dict[str, Any]) -> Dict[str, Any]:
        contact = Contact(
            name=params["name"],
            email=params.get("email"),
            phone=params.get("phone"),
            company=params.get("company")
        )

        self.db.add(contact)
        self.db.commit()
        self.db.refresh(contact)

        return {
            "success": True,
            "contact_id": contact.id,
            "message": f"Created contact: {contact.name}"
        }
```

**Step 2: Verify executor loads**

Run: `cd backend && ./venv/Scripts/python -c "from app.services.tool_executor import ToolExecutor; print('OK')"`
Expected: "OK"

**Step 3: Commit**

```bash
git add backend/app/services/tool_executor.py
git commit -m "feat: add tool executor for database operations"
```

---

## Task 6: AI Service - Integrate Tool Use

**Files:**
- Modify: `backend/app/services/ai_service.py`

**Step 1: Add tool use to AI service**

Modify `backend/app/services/ai_service.py`, update imports:
```python
from sqlalchemy.orm import Session
from app.services.ai_tools import get_tools_for_page
from app.services.tool_executor import ToolExecutor
```

Update the `chat` method signature and implementation:
```python
async def chat(
    self,
    messages: List[Message],
    context: Dict[str, Any],
    db: Session
) -> AsyncGenerator[str, None]:
    """
    Stream chat responses from Claude with tool use support.
    """
    system_prompt = self.build_system_prompt(context)
    page = context.get("page", "unknown")
    tools = get_tools_for_page(page)
    executor = ToolExecutor(db)

    # Convert messages to Anthropic format
    anthropic_messages = [
        {"role": msg.role, "content": msg.content}
        for msg in messages
    ]

    # Tool use loop
    while True:
        response = self.client.messages.create(
            model=self.model,
            max_tokens=1024,
            system=system_prompt,
            messages=anthropic_messages,
            tools=tools if tools else None
        )

        # Check if Claude wants to use tools
        tool_use_blocks = [block for block in response.content if block.type == "tool_use"]

        if not tool_use_blocks:
            # No tools used, stream final text response
            for block in response.content:
                if hasattr(block, "text"):
                    yield block.text
            break

        # Execute tools
        tool_results = []
        for tool_block in tool_use_blocks:
            result = executor.execute(tool_block.name, tool_block.input)
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tool_block.id,
                "content": str(result)
            })

            # Yield status update
            yield f"[Using tool: {tool_block.name}]\n"

        # Add assistant response and tool results to conversation
        anthropic_messages.append({"role": "assistant", "content": response.content})
        anthropic_messages.append({"role": "user", "content": tool_results})
```

**Step 2: Verify it compiles**

Run: `cd backend && ./venv/Scripts/python -c "from app.services.ai_service import AIService; print('OK')"`
Expected: "OK"

**Step 3: Commit**

```bash
git add backend/app/services/ai_service.py
git commit -m "feat: integrate tool use into AI service"
```

---

## Task 7: AI Router - Add Database Session

**Files:**
- Modify: `backend/app/routes/ai.py`

**Step 1: Update router to pass database session**

Modify `backend/app/routes/ai.py`, add import:
```python
from sqlalchemy.orm import Session
from app.database import get_db
```

Update the `stream_response` function:
```python
async def stream_response(ai_service: AIService, request: ChatRequest, db: Session):
    """Generator for SSE streaming"""
    async for chunk in ai_service.chat(request.messages, request.context, db):
        yield f"data: {chunk}\n\n"

    yield "data: [DONE]\n\n"
```

Update the `chat` endpoint:
```python
@router.post("/chat")
async def chat(request: ChatRequest, db: Session = Depends(get_db)):
    """Stream AI chat responses with tool use support"""
    ai_service = AIService()

    return StreamingResponse(
        stream_response(ai_service, request, db),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )
```

**Step 2: Test endpoint with tool use**

Start backend server:
```bash
cd backend && ./venv/Scripts/python -m uvicorn app.main:app --reload --port 8001
```

Test creating a task:
```bash
curl -X POST http://localhost:8001/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Create a task to test the API"}],"context":{"page":"tasks"}}'
```

Expected: SSE stream showing tool use and task creation

**Step 3: Commit**

```bash
git add backend/app/routes/ai.py
git commit -m "feat: connect AI router to database for tool execution"
```

---

## Task 8: Frontend - AI Chat Panel Component

**Files:**
- Create: `frontend/src/components/AIChatPanel.tsx`

**Step 1: Create chat panel component**

Create `frontend/src/components/AIChatPanel.tsx`:
```typescript
import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIChatPanelProps {
  page: 'tasks' | 'deals' | 'contacts' | 'projects' | 'goals';
  context?: Record<string, any>;
  onDataChange?: () => void;
}

export default function AIChatPanel({ page, context = {}, onDataChange }: AIChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          context: { page, ...context }
        })
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                setMessages((prev) => [...prev, { role: 'assistant', content: assistantMessage }]);
                onDataChange?.();
              } else {
                assistantMessage += data;
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMsg = newMessages[newMessages.length - 1];
                  if (lastMsg?.role === 'assistant') {
                    lastMsg.content = assistantMessage;
                  } else {
                    newMessages.push({ role: 'assistant', content: assistantMessage });
                  }
                  return newMessages;
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('AI chat error:', error);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }
      ]);
    } finally {
      setIsStreaming(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 p-4 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700"
      >
        <Bot className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="w-96 border-l bg-white flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold">AI Assistant</h3>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <Bot className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>Ask me anything about your {page}!</p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={cn(
              'flex gap-3',
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-blue-600" />
              </div>
            )}
            <div
              className={cn(
                'rounded-lg px-4 py-2 max-w-[80%]',
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              )}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-gray-600" />
              </div>
            )}
          </div>
        ))}

        {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
            </div>
            <div className="bg-gray-100 rounded-lg px-4 py-2">
              <p className="text-sm text-gray-500">Thinking...</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ask me anything..."
            disabled={isStreaming}
            className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isStreaming ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify component compiles**

Run: `cd frontend && npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add frontend/src/components/AIChatPanel.tsx
git commit -m "feat: add AI chat panel component with streaming"
```

---

## Task 9: Frontend - Integrate into Tasks Page

**Files:**
- Modify: `frontend/src/pages/Tasks.tsx`

**Step 1: Add AI chat panel to Tasks page**

Modify `frontend/src/pages/Tasks.tsx`, add import:
```typescript
import AIChatPanel from '@/components/AIChatPanel';
import { useQueryClient } from '@tanstack/react-query';
```

Update the component structure to include the panel:
```typescript
export default function Tasks() {
  const queryClient = useQueryClient();
  // ... existing state and hooks ...

  const handleDataChange = () => {
    // Refetch tasks when AI makes changes
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 p-8">
        {/* Existing Tasks UI */}
        <div className="max-w-7xl mx-auto">
          {/* ... existing task list code ... */}
        </div>
      </div>

      <AIChatPanel
        page="tasks"
        context={{ status: currentStatus, priority: currentPriority }}
        onDataChange={handleDataChange}
      />
    </div>
  );
}
```

**Step 2: Test integration**

Run frontend:
```bash
cd frontend && npm run dev
```

Navigate to `/tasks` and verify:
- Chat panel appears on right side
- Can send messages
- Responses stream in

**Step 3: Commit**

```bash
git add frontend/src/pages/Tasks.tsx
git commit -m "feat: integrate AI chat panel into Tasks page"
```

---

## Task 10: Frontend - Integrate into Deals Page

**Files:**
- Modify: `frontend/src/pages/Deals.tsx`

**Step 1: Add AI chat panel to Deals page**

Modify `frontend/src/pages/Deals.tsx`:
```typescript
import AIChatPanel from '@/components/AIChatPanel';
import { useQueryClient } from '@tanstack/react-query';

export default function Deals() {
  const queryClient = useQueryClient();

  const handleDataChange = () => {
    queryClient.invalidateQueries({ queryKey: ['deals'] });
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 p-8">
        {/* Existing Deals kanban UI */}
      </div>

      <AIChatPanel
        page="deals"
        onDataChange={handleDataChange}
      />
    </div>
  );
}
```

**Step 2: Test**

Navigate to `/deals` and verify chat panel works

**Step 3: Commit**

```bash
git add frontend/src/pages/Deals.tsx
git commit -m "feat: integrate AI chat panel into Deals page"
```

---

## Task 11: Frontend - Integrate into Contacts Page

**Files:**
- Modify: `frontend/src/pages/Contacts.tsx`

**Step 1: Add AI chat panel**

Modify `frontend/src/pages/Contacts.tsx`:
```typescript
import AIChatPanel from '@/components/AIChatPanel';
import { useQueryClient } from '@tanstack/react-query';

export default function Contacts() {
  const queryClient = useQueryClient();

  const handleDataChange = () => {
    queryClient.invalidateQueries({ queryKey: ['contacts'] });
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 p-8">
        {/* Existing Contacts UI */}
      </div>

      <AIChatPanel
        page="contacts"
        onDataChange={handleDataChange}
      />
    </div>
  );
}
```

**Step 2: Test and commit**

```bash
git add frontend/src/pages/Contacts.tsx
git commit -m "feat: integrate AI chat panel into Contacts page"
```

---

## Task 12: Error Handling & Rate Limiting

**Files:**
- Create: `backend/app/middleware/rate_limit.py`
- Modify: `backend/app/routes/ai.py`

**Step 1: Create rate limiting middleware**

Create `backend/app/middleware/rate_limit.py`:
```python
import os
import time
from collections import defaultdict
from fastapi import HTTPException, Request
from typing import Dict

class RateLimiter:
    def __init__(self):
        self.requests: Dict[str, list] = defaultdict(list)
        self.max_requests = int(os.getenv("AI_RATE_LIMIT_REQUESTS", "50"))
        self.window = int(os.getenv("AI_RATE_LIMIT_WINDOW", "3600"))

    def check_rate_limit(self, client_id: str):
        """Check if client has exceeded rate limit"""
        now = time.time()

        # Clean old requests
        self.requests[client_id] = [
            req_time for req_time in self.requests[client_id]
            if now - req_time < self.window
        ]

        # Check limit
        if len(self.requests[client_id]) >= self.max_requests:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Max {self.max_requests} requests per hour.",
                headers={"Retry-After": str(self.window)}
            )

        # Add current request
        self.requests[client_id].append(now)

rate_limiter = RateLimiter()
```

**Step 2: Apply rate limiting to AI endpoint**

Modify `backend/app/routes/ai.py`, add import:
```python
from app.middleware.rate_limit import rate_limiter
```

Update `chat` endpoint:
```python
@router.post("/chat")
async def chat(request: ChatRequest, req: Request, db: Session = Depends(get_db)):
    """Stream AI chat responses with tool use and rate limiting"""

    # Rate limiting (use IP as client ID)
    client_id = req.client.host if req.client else "unknown"
    rate_limiter.check_rate_limit(client_id)

    ai_service = AIService()

    return StreamingResponse(
        stream_response(ai_service, request, db),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )
```

**Step 3: Test rate limiting**

Send 51 requests quickly and verify 429 response on 51st request

**Step 4: Commit**

```bash
git add backend/app/middleware/rate_limit.py backend/app/routes/ai.py
git commit -m "feat: add rate limiting to AI endpoint"
```

---

## Task 13: Environment Setup Instructions

**Files:**
- Create: `docs/AI_ASSISTANT_SETUP.md`

**Step 1: Create setup documentation**

Create `docs/AI_ASSISTANT_SETUP.md`:
```markdown
# AI Assistant Setup Guide

## Prerequisites

- Anthropic API key (get one at https://console.anthropic.com/)

## Backend Setup

1. Add your Anthropic API key to `.env`:

```bash
ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
ANTHROPIC_MODEL=claude-3-haiku-20240307
AI_RATE_LIMIT_REQUESTS=50
AI_RATE_LIMIT_WINDOW=3600
```

2. Install dependencies (if not already done):

```bash
cd backend
./venv/Scripts/pip install -r requirements.txt
```

3. Start the backend server:

```bash
cd backend
./venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

## Frontend Setup

No additional setup needed. The AI chat panel will appear automatically on:
- Tasks page (`/tasks`)
- Deals page (`/deals`)
- Contacts page (`/contacts`)

## Usage

1. Navigate to any supported page
2. The AI chat panel appears on the right side
3. Type your request (e.g., "Create a task to call John tomorrow")
4. The AI will automatically execute the appropriate actions

## Supported Commands

### Tasks Page
- "Show me my tasks"
- "Create a task to [description]"
- "What tasks are due this week?"
- "Mark task #5 as completed"

### Deals Page
- "Show me deals in negotiation stage"
- "Create a deal for Acme Corp worth $50k"
- "Move deal #3 to proposal stage"

### Contacts Page
- "Show me all contacts"
- "Create a contact for John Smith at Acme"
- "Find contacts at Microsoft"

## Cost Management

- Default model: Claude 3 Haiku (~$0.0004 per request)
- Rate limit: 50 requests per hour per user
- Estimated monthly cost: $0.02 - $0.40 per active user

## Troubleshooting

**"Rate limit exceeded"**
- Wait 1 hour or adjust `AI_RATE_LIMIT_REQUESTS` in `.env`

**"AI assistant temporarily unavailable"**
- Check Anthropic API key is valid
- Check API key environment variable is set
- Check Anthropic service status

**Chat panel not showing**
- Clear browser cache
- Check browser console for errors
- Verify backend is running on port 8000
```

**Step 2: Commit**

```bash
git add docs/AI_ASSISTANT_SETUP.md
git commit -m "docs: add AI assistant setup guide"
```

---

## Task 14: Final Testing & Verification

**Step 1: Start both servers**

Terminal 1 - Backend:
```bash
cd backend
./venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
```

**Step 2: Test complete workflow**

1. Navigate to `http://localhost:5173/tasks`
2. Open AI chat panel
3. Send: "Create a task to test the AI integration"
4. Verify:
   - Response streams in real-time
   - Task appears in task list
   - No console errors

5. Send: "Show me all my tasks"
6. Verify:
   - AI fetches and displays tasks

**Step 3: Test error handling**

1. Stop backend server
2. Try sending message
3. Verify: Error message appears

**Step 4: Test rate limiting**

Send 51 requests rapidly, verify 51st fails with 429

**Step 5: Create final commit**

```bash
git add -A
git commit -m "feat: complete AI assistant integration with testing"
```

---

## Success Criteria

- ✅ Backend: AI endpoint streams responses
- ✅ Backend: Tool use executes database operations
- ✅ Backend: Rate limiting prevents abuse
- ✅ Frontend: Chat panel appears on Tasks, Deals, Contacts pages
- ✅ Frontend: Messages stream in real-time
- ✅ Frontend: Data refreshes after AI actions
- ✅ Error handling: Graceful failures
- ✅ Documentation: Setup guide complete

## Next Steps (Future Enhancements)

1. Add AI to Projects and Goals pages
2. Implement conversation history persistence
3. Add markdown rendering for AI responses
4. Implement prompt caching for cost reduction
5. Add voice input support
6. Add analytics/usage tracking
