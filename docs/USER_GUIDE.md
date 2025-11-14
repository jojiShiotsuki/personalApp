# Personal Productivity App - User Guide

## Overview

Your personal assistant for task management, CRM, and strategic insights.

## Features

### 1. Personal Assistant (Ctrl+K)

**Quick Add Tasks with Natural Language**

Press `Ctrl+K` (or `Cmd+K` on Mac) anywhere in the app to open the command bar.

**Examples:**
- "meeting tomorrow at 3pm" → Creates task due tomorrow at 3pm
- "call John high priority" → Creates high priority task to call John
- "proposal due Friday" → Creates task due this Friday
- "review contract next Monday 2pm urgent" → Creates urgent task for next Monday at 2pm

**Supported Patterns:**
- **Dates:** today, tomorrow, Monday-Sunday, next week, next month, YYYY-MM-DD
- **Times:** 3pm, 14:00, 2:30pm
- **Priorities:** low, medium, high, urgent, important

### 2. Task Management

**Create Tasks:**
- Use Ctrl+K for quick natural language input
- Or click "New Task" button for form-based input

**Organize:**
- Filter by status: All, Pending, In Progress, Completed
- See overdue tasks highlighted in red
- Mark tasks complete with checkbox

**Priority Levels:**
- 🔴 Urgent - Critical, needs immediate attention
- 🟠 High - Important, high priority
- 🔵 Medium - Normal priority (default)
- ⚪ Low - Nice to have

### 3. Lead Tracking (CRM)

**Contact Management:**
- Store contacts with email, phone, company
- Track status: Lead → Prospect → Client → Inactive

**Deal Pipeline:**
- Visual kanban board
- Stages: Lead → Prospect → Proposal → Negotiation → Closed Won/Lost
- Drag-and-drop to update stage
- Track deal value and probability
- Automatically records close date when deal is won/lost

**Win Rate Tracking:**
- Dashboard shows win rate percentage
- Export includes closed won/lost analysis

### 4. Context Export for CEO AI

**Generate Comprehensive Reports:**

Navigate to Export page to generate markdown reports including:
- Task summary (completed, pending, overdue)
- Active deals and pipeline value
- Recent interactions
- Win rate and key metrics

**How to Use:**
1. Select date range (last 7 days, 30 days, or custom)
2. Click "Copy to Clipboard"
3. Paste into Claude.ai
4. Ask for strategic advice: "Based on this context, what should I focus on this week?"

**Example Prompts for Claude:**
- "What are my biggest bottlenecks?"
- "Which deals should I prioritize?"
- "Am I overcommitted on tasks?"
- "What's my execution pattern?"

## Keyboard Shortcuts

- `Ctrl+K` / `Cmd+K` - Open command bar (personal assistant)
- `Esc` - Close command bar

## Tips & Best Practices

1. **Use Natural Language Daily**
   - Capture tasks immediately as they come up
   - Don't worry about perfect syntax - the parser is smart

2. **Update Deal Stages Regularly**
   - Drag deals through the pipeline as they progress
   - The system tracks when deals close automatically

3. **Weekly Export to CEO AI**
   - Export last 7 days every Monday
   - Ask Claude for weekly focus areas
   - Review metrics and adjust priorities

4. **Dashboard as Morning Routine**
   - Check overdue tasks first
   - Review today's tasks
   - Glance at pipeline value

## Troubleshooting

**Command bar not opening?**
- Make sure you're not in an input field
- Try Cmd+K if Ctrl+K doesn't work (Mac)

**Natural language not parsing correctly?**
- Use explicit dates: "Nov 10" instead of "next week"
- Include time: "at 3pm" or "14:00"
- Spell out priority: "high priority" or "urgent"

**Export showing no data?**
- Adjust date range
- Ensure you have tasks/deals created
- Check that backend is connected

## Support

For issues or feature requests, see the GitHub repository.
