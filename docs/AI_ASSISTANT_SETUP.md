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
