# Lead Discovery Feature Design

## Overview

Add AI-powered lead discovery to Vertex CRM, enabling users to find B2B prospects using Google Gemini with real-time web search. Discovered leads import directly into Cold Outreach campaigns.

**Based on:** [LeadScout AI](C:\Apps\leadscout-AI) - a standalone lead generation tool using Gemini.

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Location in app | Separate page under Cold Outreach | Dedicated workspace for research |
| Workflow | Search → Preview → Bulk import | Quick quality check before committing |
| AI Provider | Google Gemini | Native Google Search integration |
| API location | Backend | Security - keeps API key server-side |
| Deduplication | Skip duplicates automatically | Check email against all existing prospects |
| Navigation | Sidebar under Cold Outreach | Groups related features together |

---

## User Flow

1. **Navigate** to Lead Discovery (sidebar, under Cold Outreach)

2. **Search for leads:**
   - Enter niche/industry (e.g., "Digital Marketing Agencies")
   - Enter location (e.g., "California" or "United Kingdom")
   - Select count (5, 10, or 15 leads)
   - Click "Search"

3. **Review results** (10-30 seconds):
   - Table shows: Agency Name, Email, Contact Person, Website, Niche
   - Email validation badges (valid format / invalid / not found)
   - Duplicate indicator if lead already exists
   - Duplicates auto-excluded from import count

4. **Add to campaign:**
   - Click "Add to Campaign" button
   - Select Cold Outreach campaign from modal
   - Leads imported as new prospects (status: QUEUED)
   - Success toast: "Added 9 leads to [Campaign Name]"

5. **Continue or clear:**
   - Search again to accumulate more results
   - Or clear results and start fresh

---

## Technical Architecture

### Backend

**New file:** `backend/app/routes/lead_discovery.py`

**Endpoints:**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/lead-discovery/search` | Search for leads via Gemini |
| `POST` | `/api/lead-discovery/import` | Import leads to a campaign |

**Search endpoint:**

```python
@router.post("/search")
async def search_leads(request: LeadSearchRequest):
    """
    1. Call Gemini API with Google Search tool
    2. Parse structured JSON response
    3. Check each lead against existing prospects (by email)
    4. Return leads with duplicate flags
    """
    pass
```

Request:
```python
class LeadSearchRequest(BaseModel):
    niche: str          # e.g., "Digital Marketing Agencies"
    location: str       # e.g., "California"
    count: int = 10     # 5, 10, or 15
```

Response:
```python
class LeadSearchResponse(BaseModel):
    leads: list[DiscoveredLead]
    duplicates_found: int
    valid_for_import: int
```

**Import endpoint:**

```python
@router.post("/import")
async def import_leads(request: LeadImportRequest):
    """
    1. Filter to valid, non-duplicate leads
    2. Create OutreachProspect records
    3. Return import summary
    """
    pass
```

Request:
```python
class LeadImportRequest(BaseModel):
    leads: list[DiscoveredLead]
    campaign_id: int
```

Response:
```python
class LeadImportResponse(BaseModel):
    imported: int
    campaign_name: str
```

### Gemini Integration

**New file:** `backend/app/services/gemini_service.py`

```python
from google import genai

async def find_businesses(niche: str, location: str, count: int) -> list[dict]:
    """
    Call Gemini 2.0 Flash with Google Search tool.
    Returns structured lead data.
    """
    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    prompt = f"""Find {count} businesses matching "{niche}" in "{location}".
    IMPORTANT: If "{location}" is a country, search across major states/provinces.
    Get their agency name, email, contact person, website, and niche."""

    response = await client.models.generate_content(
        model="gemini-2.0-flash",
        contents=prompt,
        config={
            "tools": [{"google_search": {}}],
            "response_mime_type": "application/json",
            "response_schema": LEAD_SCHEMA
        }
    )

    return json.loads(response.text)
```

**Environment:**
```
# backend/.env
GEMINI_API_KEY=your_key_here
```

**Dependencies:**
```
# backend/requirements.txt
google-genai>=1.0.0
```

### Frontend

**New file:** `frontend/src/pages/LeadDiscovery.tsx`

**API client addition:** `frontend/src/lib/api.ts`

```typescript
export const leadDiscoveryApi = {
  search: async (data: LeadSearchRequest): Promise<LeadSearchResponse> => {
    const res = await fetch(`${API_BASE}/lead-discovery/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  import: async (data: LeadImportRequest): Promise<LeadImportResponse> => {
    const res = await fetch(`${API_BASE}/lead-discovery/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
};
```

**Types:** `frontend/src/types/index.ts`

```typescript
export interface DiscoveredLead {
  agency_name: string;
  email: string | null;
  contact_name: string | null;
  website: string | null;
  niche: string | null;
  is_duplicate: boolean;
  is_valid_email: boolean;
}

export interface LeadSearchRequest {
  niche: string;
  location: string;
  count: number;
}

export interface LeadSearchResponse {
  leads: DiscoveredLead[];
  duplicates_found: number;
  valid_for_import: number;
}

export interface LeadImportRequest {
  leads: DiscoveredLead[];
  campaign_id: number;
}

export interface LeadImportResponse {
  imported: number;
  campaign_name: string;
}
```

---

## Data Model

**No new tables required.** Discovered leads map to existing `OutreachProspect`:

| LeadScout Field | OutreachProspect Field |
|-----------------|------------------------|
| agency_name | agency_name |
| email | email |
| contact_name | contact_name |
| website | website |
| niche | niche |
| (selected) | campaign_id |
| (default) | status = "queued" |
| (default) | current_step = 1 |
| (default) | next_action_date = today |

**Validation rules:**
- Email required (skip leads without)
- Email must pass format validation
- Email must not exist in any campaign
- Filter placeholders: "N/A", "Contact via Website", etc.

---

## UI Design

### Page Structure

```
┌─────────────────────────────────────────────────────────────┐
│ [Chip: Lead Discovery]                                      │
│                                                             │
│ Lead Discovery                          [Powered by Gemini] │
│ Find prospects with AI-powered search                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [Briefcase] Niche        [MapPin] Location    Count     │ │
│ │ ┌──────────────────┐    ┌──────────────────┐  ┌──────┐  │ │
│ │ │ Marketing Agencies│    │ California       │  │ 10 ▼│  │ │
│ │ └──────────────────┘    └──────────────────┘  └──────┘  │ │
│ │                                                         │ │
│ │                                    [🔍 Search for Leads] │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Found 12 leads • 3 duplicates • 9 ready to import          │
│                          [Add to Campaign]  [Clear Results] │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Agency          Email              Contact    Website   │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ Acme Digital    hello@acme.com ✓   John Doe   acme.com  │ │
│ │ Beta Agency     info@beta.io ✓     Jane S.    beta.io   │ │
│ │ Gamma Co        [Invalid] ⚠        Mike R.    gamma.co  │ │
│ │ Delta Inc       sam@delta.com      [Exists]   delta.com │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Loading State

Centered card with:
- Animated spinner
- Rotating messages (every 2.5s):
  1. "Searching Google for matches..."
  2. "Scanning agency websites..."
  3. "Extracting contact details..."
  4. "Formatting lead data..."

### Campaign Selection Modal

```
┌────────────────────────────────────────┐
│ Add Leads to Campaign              [X] │
├────────────────────────────────────────┤
│                                        │
│ Select Campaign                        │
│ ┌────────────────────────────────────┐ │
│ │ Q1 Agency Outreach           (42) ▼│ │
│ └────────────────────────────────────┘ │
│                                        │
│ 9 leads will be added                  │
│                                        │
│              [Cancel]  [Add to Campaign]│
└────────────────────────────────────────┘
```

### Empty States

**No results:**
> No leads found for this search. Try broadening your location or adjusting the niche.

**All duplicates:**
> All 8 leads found already exist in your campaigns.

**No campaigns:**
> Create a campaign first to import leads.
> [Go to Cold Outreach]

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Gemini API failure | Toast: "Search failed. Please try again." Retry 3x with 2s delay |
| Rate limit exceeded | Toast: "Too many searches. Please wait a moment." |
| No valid leads | "Add to Campaign" button disabled with tooltip |
| Network error | Toast with retry option |
| Import failure | Toast: "Import failed" with details |

---

## Navigation

**Sidebar update:** Add "Lead Discovery" under Cold Outreach section

```typescript
// Layout.tsx sidebar items
{ name: 'Cold Outreach', href: '/cold-outreach', icon: Mail },
{ name: 'Lead Discovery', href: '/lead-discovery', icon: Search },
```

**Route:** `frontend/src/App.tsx`
```typescript
<Route path="/lead-discovery" element={<LeadDiscovery />} />
```

---

## Security

- Gemini API key stored in backend `.env` only
- No API keys exposed to frontend
- Consider rate limiting: 50 searches/day (adjustable)
- No sensitive data logged

---

## Files to Create/Modify

### New Files
- `backend/app/routes/lead_discovery.py` - API endpoints
- `backend/app/services/gemini_service.py` - Gemini integration
- `backend/app/schemas/lead_discovery.py` - Pydantic schemas
- `frontend/src/pages/LeadDiscovery.tsx` - UI page

### Modified Files
- `backend/app/main.py` - Register new router
- `backend/requirements.txt` - Add google-genai
- `backend/.env` - Add GEMINI_API_KEY
- `frontend/src/lib/api.ts` - Add leadDiscoveryApi
- `frontend/src/types/index.ts` - Add types
- `frontend/src/App.tsx` - Add route
- `frontend/src/components/Layout.tsx` - Add sidebar item

---

## Testing Checklist

- [ ] Search returns leads for valid niche + location
- [ ] Duplicates correctly identified and marked
- [ ] Invalid emails flagged, excluded from import count
- [ ] Import creates OutreachProspect records correctly
- [ ] Imported prospects appear in Cold Outreach campaign
- [ ] Dark mode styling correct
- [ ] Loading states display properly
- [ ] Error states handled gracefully
- [ ] Empty states show appropriate messages
