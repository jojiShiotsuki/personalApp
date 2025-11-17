# AI Assistant Integration Design
**Date:** 2025-11-17
**Status:** Approved
**Approach:** Function Calling with Tool Use (Approach 1)

## Overview

Integration of Anthropic's Claude API as a context-aware AI assistant embedded in each page of the Vertex productivity app. The AI can read user data (tasks, deals, contacts, goals, projects) and take actions (create, update, delete) through function calling/tool use.

## Requirements

- **Context-Aware:** AI understands which page user is on (Tasks, Deals, Projects, etc.)
- **Actionable:** AI can create and modify data, not just provide suggestions
- **Embedded UI:** Chat panel on each page, not a separate modal or page
- **Cost-Effective:** Use Claude 3 Haiku by default (~$0.0004 per request)
- **Real-Time:** Streaming responses for better UX

## Architecture

### Three-Layer Design

```
Frontend (React)
├── AIChatPanel component (reusable)
├── Page integrations (Tasks, Deals, Projects)
└── API Client (SSE streaming)

Backend (FastAPI)
├── AI Router (/api/ai/chat)
├── AI Service (Anthropic orchestration)
├── Tool Registry (tool definitions)
└── Tool Executor (maps to existing services)

Anthropic API
└── Claude 3 Haiku (default) / Sonnet (optional)
```

### Backend Components

#### 1. AI Router (`/app/routes/ai.py`)
- **Endpoint:** `POST /api/ai/chat`
- **Input:** `{ messages: Message[], context: { page: string, filters?: object } }`
- **Output:** Server-Sent Events (SSE) stream
- **Responsibility:** Validate input, delegate to AI service, stream response

#### 2. AI Service (`/app/services/ai_service.py`)
- Initialize Anthropic client with API key from environment
- Build system prompt with page context
- Execute tool use loop:
  1. Send message + tools to Claude
  2. If Claude calls tool → execute via Tool Executor
  3. Send tool result back to Claude
  4. Continue until final response
- Stream responses back to router

#### 3. Tool Registry & Executor (`/app/services/ai_tools.py`)
Defines tools as Pydantic schemas:

**Tasks Page Tools:**
- `get_tasks(status?, priority?, date_range?)` → Query tasks
- `create_task(title, due_date?, priority?)` → Create new task
- `update_task(id, updates)` → Modify existing task
- `delete_task(id)` → Delete/complete task

**Deals Page Tools:**
- `get_deals(stage?, contact_id?)` → Query deals
- `create_deal(title, value, contact_id?, stage?)` → Create deal
- `update_deal_stage(id, stage)` → Move deal through pipeline
- `update_deal(id, updates)` → Modify deal details

**Contacts Page Tools:**
- `get_contacts(search?)` → Query contacts
- `create_contact(name, email?, phone?)` → Create contact
- `update_contact(id, updates)` → Modify contact

**Projects Page Tools:**
- `get_projects(status?)` → Query projects
- `create_project(name, description?, due_date?)` → Create project
- `get_project_tasks(project_id)` → Get tasks for project

**Goals Page Tools:**
- `get_goals(status?)` → Query goals
- `create_goal(title, target_date?, description?)` → Create goal

**Tool Executor** maps tool calls to existing services:
- Reuses TaskParser, CRM services, Project service
- No duplicate business logic
- Validates parameters via Pydantic
- Returns structured results to Claude

### Frontend Components

#### 1. AIChatPanel Component (`/frontend/src/components/AIChatPanel.tsx`)
**Props:**
```typescript
interface AIChatPanelProps {
  page: 'tasks' | 'deals' | 'contacts' | 'projects' | 'goals';
  context?: Record<string, any>;
  onDataChange?: () => void;
}
```

**Features:**
- Message display with markdown rendering
- Streaming support (word-by-word via SSE)
- Loading states ("Thinking...", "Creating task...")
- Action indicators when tools are called
- Collapsible sidebar (doesn't block main content)
- Conversation history (last 10 messages)

#### 2. Page Integration Pattern
```tsx
// Example: Tasks.tsx
<div className="flex h-full">
  <div className="flex-1">
    {/* Existing tasks UI */}
  </div>
  <AIChatPanel
    page="tasks"
    context={{ status: currentStatus, priority: currentPriority }}
    onDataChange={() => queryClient.invalidateQueries(['tasks'])}
  />
</div>
```

When AI modifies data, `onDataChange` triggers React Query refetch.

#### 3. API Client (`/frontend/src/lib/aiClient.ts`)
- Handles SSE connection to `/api/ai/chat`
- Parses streamed chunks (text, tool calls, completions)
- Provides React hook: `useAIChat(page, context)`
- Manages conversation history

## Data Flow

**Example: User asks "Create a task to call John tomorrow at 2pm"**

1. User types in AIChatPanel on Tasks page
2. Frontend sends to `POST /api/ai/chat`:
   ```json
   {
     "messages": [{"role": "user", "content": "Create task..."}],
     "context": {"page": "tasks"}
   }
   ```
3. AI Service builds system prompt:
   ```
   You are an AI assistant helping manage tasks in Vertex.
   User is on the Tasks page.
   Available tools: get_tasks, create_task, update_task, delete_task
   ```
4. Anthropic API called with tools → Claude responds with tool call:
   ```json
   {
     "type": "tool_use",
     "name": "create_task",
     "input": {
       "title": "Call John",
       "due_date": "2025-11-18",
       "priority": "medium"
     }
   }
   ```
5. Tool Executor runs `create_task` → calls Task model/TaskParser
6. Tool result sent back to Claude: `{"success": true, "task_id": 123}`
7. Claude generates final response: "I've created a task to call John tomorrow at 2pm (task #123)"
8. Frontend streams response word-by-word
9. When complete, calls `onDataChange()` → React Query refetches tasks
10. New task appears in UI

**Time:** ~2-3 seconds end-to-end

## Error Handling

### Rate Limiting
- 50 requests per hour per user
- Track in-memory (or Redis for production)
- Return 429 with retry-after header

### Error Scenarios

**1. Anthropic API Failures (503, timeout, rate limit)**
- Retry with exponential backoff (3 attempts)
- Fallback: "AI assistant temporarily unavailable"
- Log error, don't expose API details to frontend

**2. Tool Execution Failures (invalid data, DB error)**
- Catch exception, send error to Claude as tool result
- Claude reformulates or asks for clarification
- Example: `create_task` missing due_date → Claude asks user

**3. Invalid Tool Calls (hallucinated tool)**
- Return "Tool not found" to Claude
- Log for monitoring (indicates prompt issue)

**4. Database Errors**
- Roll back transaction
- Return error to Claude → Claude informs user

## Security

- **API Key:** Stored in `.env`, never exposed to frontend
- **Tool Permissions:** Context-based (read-only on some pages, full CRUD on others)
- **Input Validation:** Pydantic schemas validate all tool parameters
- **SQL Injection:** Prevented via SQLAlchemy ORM (existing)
- **User Isolation:** Tools only access authenticated user's data (future: add auth)

## Cost Estimation

**Per Request (Claude 3 Haiku):**
- Input: ~1000 tokens × $0.25/1M = $0.00025
- Output: ~150 tokens × $1.25/1M = $0.00019
- **Total: ~$0.0004 per request**

**Monthly Usage Estimates:**
- Light user (50 requests/month): $0.02
- Average user (200 requests/month): $0.08
- Heavy user (1000 requests/month): $0.40

**Upgrade to Sonnet (for complex queries):**
- ~10x more expensive (~$0.005/request)
- Use selectively for analysis/planning tasks

## Testing Strategy

### Backend Tests
1. **Unit tests** for AI service:
   - Mock Anthropic API responses
   - Test tool execution with various inputs
   - Verify error handling

2. **Integration tests** for tool executor:
   - Test each tool end-to-end with real DB
   - Verify create_task actually creates tasks
   - Check transaction rollback

3. **API tests** for `/api/ai/chat`:
   - Test SSE streaming
   - Verify rate limiting
   - Test concurrent requests

### Frontend Tests
1. **Component tests** for AIChatPanel:
   - Mock SSE responses
   - Test message rendering
   - Verify loading states

2. **E2E tests** (optional):
   - User types → task appears
   - Test error states

### Manual Testing
- Create task via AI → verify in Tasks list
- Update deal stage → verify in Deals kanban
- Ask for task list → verify correct data
- Test streaming with slow network
- Test rate limit (50+ requests)

## Implementation Phases

### Phase 1: Backend Foundation
- Install `anthropic` Python SDK
- Create AI router and service
- Implement basic tool registry (tasks only)
- Test with Anthropic API

### Phase 2: Tool Expansion
- Add tools for Deals, Contacts, Projects, Goals
- Implement tool executor
- Add error handling and rate limiting

### Phase 3: Frontend Integration
- Build AIChatPanel component
- Implement SSE streaming
- Add to Tasks page (first integration)

### Phase 4: Full Integration
- Add AIChatPanel to all pages
- Polish UI/UX
- Add loading states and animations

### Phase 5: Testing & Optimization
- Write tests
- Optimize prompts for cost
- Monitor usage and errors

## Configuration

**Environment Variables (.env):**
```bash
# Anthropic API key
ANTHROPIC_API_KEY=sk-ant-...

# Model selection (haiku or sonnet)
ANTHROPIC_MODEL=claude-3-haiku-20240307

# Rate limiting
AI_RATE_LIMIT_REQUESTS=50
AI_RATE_LIMIT_WINDOW=3600
```

## Future Enhancements

- **Multi-turn conversations:** Keep context across multiple messages
- **Proactive suggestions:** "You have 3 overdue tasks, want me to reschedule?"
- **Analytics tools:** "Show me deal pipeline trends"
- **Voice input:** Speak to AI assistant
- **Custom instructions:** User preferences for AI behavior
- **Prompt caching:** Reduce costs with Anthropic's prompt caching (beta)

## Success Metrics

- **Usage:** Track AI requests per user per day
- **Cost:** Monitor Anthropic API spend
- **Effectiveness:** Measure task creation success rate via AI
- **Performance:** P95 response time < 3 seconds
- **Errors:** Tool execution failure rate < 5%

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| High API costs | Use Haiku by default, rate limiting, monitor usage |
| Claude hallucinates tools | Strict tool definitions, validate responses, log errors |
| Slow responses | Use streaming, show loading states, optimize prompts |
| Security issues | Input validation, tool permissions, API key protection |
| User confusion | Clear UI feedback, show what AI is doing, error messages |

## Approval

**Approved by:** User
**Date:** 2025-11-17
**Next Steps:** Set up worktree → Create implementation plan → Begin development
