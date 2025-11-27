# Outreach Templates Feature Design

## Overview

A dedicated Outreach page for fast cold DM workflows. Users select a niche and situation, enter a name, and copy a pre-written script in 2-3 clicks. Optionally add the contact to the CRM pipeline.

## Core Workflow

1. **Enter Name** - Text field for their TikTok handle/name
2. **Select Niche** - Dropdown of user-defined niches (Fitness, Lifestyle, etc.)
3. **Select Situation** - Quick buttons (No Site, Has Site, Needs Work)
4. **Copy Script** - One click copies the generated message
5. **Add to Pipeline** (optional) - Creates contact + deal in one click

## Data Model

### Outreach Niches
- `id`: int
- `name`: string (e.g., "Fitness", "Lifestyle")
- `created_at`: datetime

### Outreach Situations
- `id`: int
- `name`: string (e.g., "No Site", "Has Site", "Needs Work")
- `created_at`: datetime

### Outreach Templates
- `id`: int
- `niche_id`: int (foreign key)
- `situation_id`: int (foreign key)
- `content`: text (script with variables like `{name}`, `{niche}`)
- `created_at`: datetime
- `updated_at`: datetime

## Template Variables

- `{name}` - Replaced with entered name/handle
- `{niche}` - Replaced with selected niche name

## UI Components

### Outreach Page (`/outreach`)
```
┌─────────────────────────────────────────────┐
│  Outreach                  [Manage Templates]│
├─────────────────────────────────────────────┤
│  Name: [_______________]                    │
│                                             │
│  Niche:     [Fitness ▼]                     │
│                                             │
│  Situation: [No Site] [Has Site] [Needs Work]│
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │ Hey @mike! I came across your       │    │
│  │ fitness content and love what...    │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  [Copy]  [+ Add to Pipeline]                │
└─────────────────────────────────────────────┘
```

### Manage Templates Modal
- Tab 1: Manage Niches (add/delete)
- Tab 2: Manage Situations (add/delete)
- Tab 3: Edit Templates (select niche + situation, edit script)

## Add to Pipeline Behavior

When "Add to Pipeline" is clicked:
1. Create Contact:
   - `name`: entered name
   - `source`: "TikTok Outreach"
   - `notes`: selected niche
   - `status`: Lead
2. Create Deal:
   - `contact_id`: new contact's ID
   - `title`: "{name} - {niche}"
   - `stage`: Lead

## API Endpoints

### Niches
- `GET /api/outreach/niches` - List all niches
- `POST /api/outreach/niches` - Create niche
- `DELETE /api/outreach/niches/{id}` - Delete niche

### Situations
- `GET /api/outreach/situations` - List all situations
- `POST /api/outreach/situations` - Create situation
- `DELETE /api/outreach/situations/{id}` - Delete situation

### Templates
- `GET /api/outreach/templates` - List all templates
- `GET /api/outreach/templates?niche_id=X&situation_id=Y` - Get specific template
- `POST /api/outreach/templates` - Create/update template (upsert by niche+situation)
- `DELETE /api/outreach/templates/{id}` - Delete template

### Quick Actions
- `POST /api/outreach/add-to-pipeline` - Create contact + deal in one call
  - Body: `{ name, niche, situation }`
