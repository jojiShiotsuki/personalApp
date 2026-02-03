# Lead Discovery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add AI-powered lead discovery to Vertex CRM using Google Gemini with real-time web search, allowing users to find B2B prospects and import them directly into Cold Outreach campaigns.

**Architecture:** Backend FastAPI service calls Gemini API with Google Search tool, returns structured lead data. Frontend provides search form, results table with validation badges, and bulk import to campaigns. Reuses existing OutreachProspect model.

**Tech Stack:** Python (google-genai), FastAPI, React, TanStack Query, TailwindCSS

---

## Task 1: Add Gemini Dependency

**Files:**
- Modify: `backend/requirements.txt`

**Step 1: Add google-genai package**

Add to `backend/requirements.txt`:

```
google-genai>=0.3.0
```

**Step 2: Install the dependency**

Run:
```bash
cd backend && pip install google-genai
```

Expected: Package installs successfully

**Step 3: Commit**

```bash
git add backend/requirements.txt
git commit -m "$(cat <<'EOF'
chore: add google-genai dependency for lead discovery

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Create Pydantic Schemas

**Files:**
- Create: `backend/app/schemas/lead_discovery.py`

**Step 1: Create the schemas file**

Create `backend/app/schemas/lead_discovery.py`:

```python
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
import re


class LeadSearchRequest(BaseModel):
    """Request to search for business leads."""
    niche: str
    location: str
    count: int = 10

    @field_validator('count')
    @classmethod
    def validate_count(cls, v: int) -> int:
        if v < 1:
            return 5
        if v > 15:
            return 15
        return v

    @field_validator('niche', 'location')
    @classmethod
    def validate_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('Field cannot be empty')
        return v.strip()


class DiscoveredLead(BaseModel):
    """A lead discovered from AI search."""
    agency_name: str
    email: Optional[str] = None
    contact_name: Optional[str] = None
    website: Optional[str] = None
    niche: Optional[str] = None
    is_duplicate: bool = False
    is_valid_email: bool = False


class LeadSearchResponse(BaseModel):
    """Response from lead search."""
    leads: list[DiscoveredLead]
    duplicates_found: int
    valid_for_import: int


class LeadImportRequest(BaseModel):
    """Request to import leads to a campaign."""
    leads: list[DiscoveredLead]
    campaign_id: int


class LeadImportResponse(BaseModel):
    """Response from lead import."""
    imported: int
    campaign_name: str


# Email validation regex
EMAIL_REGEX = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')

# Placeholder values to filter out
PLACEHOLDER_VALUES = {
    'n/a', 'na', 'not listed', 'not found', 'contact via website',
    'see website', 'none', 'unknown', '-', 'null', 'undefined',
    'not available', 'no email', 'email not found'
}


def is_valid_email(email: Optional[str]) -> bool:
    """Check if email is valid and not a placeholder."""
    if not email:
        return False
    email_lower = email.lower().strip()
    if email_lower in PLACEHOLDER_VALUES:
        return False
    return bool(EMAIL_REGEX.match(email))


def clean_lead_data(lead: dict) -> DiscoveredLead:
    """Clean and validate lead data from AI response."""
    email = lead.get('email')
    email_valid = is_valid_email(email)

    # Clean email if it's a placeholder
    if email and email.lower().strip() in PLACEHOLDER_VALUES:
        email = None

    return DiscoveredLead(
        agency_name=lead.get('agency_name', '').strip(),
        email=email.strip() if email else None,
        contact_name=lead.get('contact_name', '').strip() if lead.get('contact_name') else None,
        website=lead.get('website', '').strip() if lead.get('website') else None,
        niche=lead.get('niche', '').strip() if lead.get('niche') else None,
        is_duplicate=False,
        is_valid_email=email_valid,
    )
```

**Step 2: Verify file syntax**

Run:
```bash
cd backend && python -c "from app.schemas.lead_discovery import *; print('OK')"
```

Expected: `OK`

**Step 3: Commit**

```bash
git add backend/app/schemas/lead_discovery.py
git commit -m "$(cat <<'EOF'
feat: add Pydantic schemas for lead discovery

- LeadSearchRequest with validation
- DiscoveredLead with email validation
- LeadSearchResponse and LeadImportResponse
- Helper functions for email validation

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Create Gemini Service

**Files:**
- Create: `backend/app/services/gemini_service.py`

**Step 1: Create the Gemini service**

Create `backend/app/services/gemini_service.py`:

```python
import os
import json
import asyncio
from typing import Optional
from google import genai
from google.genai import types


# Initialize client lazily
_client: Optional[genai.Client] = None


def get_client() -> genai.Client:
    """Get or create Gemini client."""
    global _client
    if _client is None:
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable not set")
        _client = genai.Client(api_key=api_key)
    return _client


# Schema for structured lead output
LEAD_SCHEMA = types.Schema(
    type=types.Type.ARRAY,
    items=types.Schema(
        type=types.Type.OBJECT,
        properties={
            "agency_name": types.Schema(
                type=types.Type.STRING,
                description="The name of the business or agency."
            ),
            "email": types.Schema(
                type=types.Type.STRING,
                description="Email address if found, otherwise return 'Not Listed'."
            ),
            "contact_name": types.Schema(
                type=types.Type.STRING,
                description="Name of a key contact person or founder."
            ),
            "website": types.Schema(
                type=types.Type.STRING,
                description="The official website URL."
            ),
            "niche": types.Schema(
                type=types.Type.STRING,
                description="The specific industry niche they serve."
            ),
        },
        required=["agency_name", "website"],
    ),
)


async def find_businesses(
    niche: str,
    location: str,
    count: int = 10,
    max_retries: int = 3
) -> list[dict]:
    """
    Search for businesses using Gemini with Google Search.

    Args:
        niche: Industry/service type to search for
        location: Geographic location
        count: Number of leads to find (5-15)
        max_retries: Number of retry attempts

    Returns:
        List of business lead dictionaries
    """
    client = get_client()

    prompt = f"""Find {count} businesses matching "{niche}" in "{location}".
IMPORTANT: If "{location}" is a country, you must search across its major states, provinces, or territories to ensure a broad and diverse list of results.
Get their agency name, email, contact person, website, and niche.
Return ONLY real businesses you can verify exist. Do not make up fake businesses."""

    for attempt in range(max_retries):
        try:
            response = await asyncio.to_thread(
                client.models.generate_content,
                model="gemini-2.0-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    tools=[types.Tool(google_search=types.GoogleSearch())],
                    response_mime_type="application/json",
                    response_schema=LEAD_SCHEMA,
                ),
            )

            text = response.text
            if not text:
                raise ValueError("No data received from AI")

            try:
                data = json.loads(text)
                if isinstance(data, list):
                    return data
                raise ValueError("Response is not a list")
            except json.JSONDecodeError as e:
                raise ValueError(f"Failed to parse AI response: {e}")

        except Exception as e:
            if attempt < max_retries - 1:
                await asyncio.sleep(2)
                continue
            raise

    return []
```

**Step 2: Verify file syntax**

Run:
```bash
cd backend && python -c "from app.services.gemini_service import find_businesses; print('OK')"
```

Expected: `OK`

**Step 3: Commit**

```bash
git add backend/app/services/gemini_service.py
git commit -m "$(cat <<'EOF'
feat: add Gemini service for AI lead discovery

- Calls Gemini 2.0 Flash with Google Search tool
- Structured JSON output with schema
- Retry logic with exponential backoff
- Lazy client initialization

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Create Lead Discovery API Routes

**Files:**
- Create: `backend/app/routes/lead_discovery.py`

**Step 1: Create the routes file**

Create `backend/app/routes/lead_discovery.py`:

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date

from app.database import get_db
from app.models.outreach import OutreachProspect, OutreachCampaign, ProspectStatus
from app.schemas.lead_discovery import (
    LeadSearchRequest,
    LeadSearchResponse,
    LeadImportRequest,
    LeadImportResponse,
    DiscoveredLead,
    clean_lead_data,
    is_valid_email,
)
from app.services.gemini_service import find_businesses

router = APIRouter(prefix="/api/lead-discovery", tags=["lead-discovery"])


def check_duplicate(email: str, db: Session) -> bool:
    """Check if email already exists in any campaign."""
    if not email:
        return False
    existing = db.query(OutreachProspect).filter(
        OutreachProspect.email == email
    ).first()
    return existing is not None


@router.post("/search", response_model=LeadSearchResponse)
async def search_leads(request: LeadSearchRequest, db: Session = Depends(get_db)):
    """
    Search for business leads using AI.

    Returns leads with duplicate and email validation flags.
    """
    try:
        raw_leads = await find_businesses(
            niche=request.niche,
            location=request.location,
            count=request.count,
        )
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

    # Process and validate leads
    leads: list[DiscoveredLead] = []
    duplicates_found = 0
    valid_for_import = 0

    for raw_lead in raw_leads:
        lead = clean_lead_data(raw_lead)

        # Skip if no agency name
        if not lead.agency_name:
            continue

        # Check for duplicate
        if lead.email and check_duplicate(lead.email, db):
            lead.is_duplicate = True
            duplicates_found += 1

        # Count valid for import (has valid email and not duplicate)
        if lead.is_valid_email and not lead.is_duplicate:
            valid_for_import += 1

        leads.append(lead)

    return LeadSearchResponse(
        leads=leads,
        duplicates_found=duplicates_found,
        valid_for_import=valid_for_import,
    )


@router.post("/import", response_model=LeadImportResponse)
async def import_leads(request: LeadImportRequest, db: Session = Depends(get_db)):
    """
    Import discovered leads into a campaign.

    Only imports leads with valid emails that don't already exist.
    """
    # Verify campaign exists
    campaign = db.query(OutreachCampaign).filter(
        OutreachCampaign.id == request.campaign_id
    ).first()

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    imported_count = 0
    today = date.today()

    for lead in request.leads:
        # Skip invalid or duplicate leads
        if not lead.is_valid_email or lead.is_duplicate:
            continue

        if not lead.email:
            continue

        # Double-check for duplicates (in case of race condition)
        if check_duplicate(lead.email, db):
            continue

        # Create prospect
        prospect = OutreachProspect(
            campaign_id=request.campaign_id,
            agency_name=lead.agency_name,
            contact_name=lead.contact_name,
            email=lead.email,
            website=lead.website,
            niche=lead.niche,
            status=ProspectStatus.QUEUED,
            current_step=1,
            next_action_date=today,
        )
        db.add(prospect)
        imported_count += 1

    db.commit()

    return LeadImportResponse(
        imported=imported_count,
        campaign_name=campaign.name,
    )
```

**Step 2: Verify file syntax**

Run:
```bash
cd backend && python -c "from app.routes.lead_discovery import router; print('OK')"
```

Expected: `OK`

**Step 3: Commit**

```bash
git add backend/app/routes/lead_discovery.py
git commit -m "$(cat <<'EOF'
feat: add lead discovery API endpoints

- POST /api/lead-discovery/search - AI-powered lead search
- POST /api/lead-discovery/import - Import leads to campaign
- Deduplication check against all existing prospects
- Email validation before import

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Register Router in Main App

**Files:**
- Modify: `backend/app/main.py`

**Step 1: Add import and register router**

In `backend/app/main.py`, add to imports (around line 12):

```python
from app.routes import tasks, crm, task_parser, export, goals, goal_parser, projects, social_content, dashboard, time, outreach, cold_outreach, lead_discovery
```

And add after line 50 (after `cold_outreach.router`):

```python
app.include_router(lead_discovery.router)
```

**Step 2: Verify backend starts**

Run:
```bash
cd backend && python -c "from app.main import app; print('OK')"
```

Expected: `OK`

**Step 3: Commit**

```bash
git add backend/app/main.py
git commit -m "$(cat <<'EOF'
feat: register lead discovery router

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Add Frontend Types

**Files:**
- Modify: `frontend/src/types/index.ts`

**Step 1: Add lead discovery types**

Add at the end of `frontend/src/types/index.ts`:

```typescript
// Lead Discovery Types
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

**Step 2: Verify TypeScript compiles**

Run:
```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "$(cat <<'EOF'
feat: add lead discovery TypeScript types

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Add Frontend API Client

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Step 1: Add imports**

Add to the imports at the top of `frontend/src/lib/api.ts`:

```typescript
import type {
  // ... existing imports ...
  LeadSearchRequest,
  LeadSearchResponse,
  LeadImportRequest,
  LeadImportResponse,
} from '../types/index';
```

**Step 2: Add leadDiscoveryApi**

Add at the end of the file (before any closing brackets):

```typescript
// Lead Discovery API
export const leadDiscoveryApi = {
  search: async (data: LeadSearchRequest): Promise<LeadSearchResponse> => {
    const response = await api.post('/api/lead-discovery/search', data);
    return response.data;
  },

  importLeads: async (data: LeadImportRequest): Promise<LeadImportResponse> => {
    const response = await api.post('/api/lead-discovery/import', data);
    return response.data;
  },
};
```

**Step 3: Verify TypeScript compiles**

Run:
```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors

**Step 4: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "$(cat <<'EOF'
feat: add lead discovery API client

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Create Lead Discovery Page

**Files:**
- Create: `frontend/src/pages/LeadDiscovery.tsx`

**Step 1: Create the page component**

Create `frontend/src/pages/LeadDiscovery.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { leadDiscoveryApi, coldOutreachApi } from '@/lib/api';
import type {
  DiscoveredLead,
  LeadSearchResponse,
  OutreachCampaign,
} from '@/types';
import {
  Search,
  Briefcase,
  MapPin,
  Globe,
  Mail,
  User,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Users,
  Sparkles,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Loading messages that rotate
const LOADING_MESSAGES = [
  { text: 'Searching Google for matches...', icon: Search },
  { text: 'Scanning agency websites...', icon: Globe },
  { text: 'Extracting contact details...', icon: Mail },
  { text: 'Formatting lead data...', icon: Users },
];

// Email validation badge
function EmailBadge({ lead }: { lead: DiscoveredLead }) {
  if (!lead.email) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
        <XCircle className="w-3 h-3" />
        Not found
      </span>
    );
  }

  if (lead.is_duplicate) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
        <AlertCircle className="w-3 h-3" />
        Exists
      </span>
    );
  }

  if (lead.is_valid_email) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
        <CheckCircle className="w-3 h-3" />
        Valid
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
      <XCircle className="w-3 h-3" />
      Invalid
    </span>
  );
}

// Campaign selection modal
function CampaignSelectModal({
  isOpen,
  onClose,
  campaigns,
  validCount,
  onSelect,
  isImporting,
}: {
  isOpen: boolean;
  onClose: () => void;
  campaigns: OutreachCampaign[];
  validCount: number;
  onSelect: (campaignId: number) => void;
  isImporting: boolean;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(
    campaigns.length > 0 ? campaigns[0].id : null
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Add Leads to Campaign
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {campaigns.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400">
                No campaigns found. Create a campaign first.
              </p>
            </div>
          ) : (
            <>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Select Campaign
              </label>
              <select
                value={selectedId || ''}
                onChange={(e) => setSelectedId(Number(e.target.value))}
                className={cn(
                  'w-full px-4 py-2.5',
                  'bg-gray-50 dark:bg-slate-700',
                  'border border-gray-200 dark:border-slate-600 rounded-xl',
                  'text-gray-900 dark:text-white',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
                  'transition-all duration-200'
                )}
              >
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>

              <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                <span className="font-semibold text-gray-900 dark:text-white">
                  {validCount}
                </span>{' '}
                leads will be added
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 justify-end px-6 py-4 border-t border-gray-100 dark:border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => selectedId && onSelect(selectedId)}
            disabled={!selectedId || isImporting || campaigns.length === 0}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200',
              'bg-blue-600 text-white',
              'hover:bg-blue-700',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isImporting && <Loader2 className="w-4 h-4 animate-spin" />}
            Add to Campaign
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LeadDiscovery() {
  // Form state
  const [niche, setNiche] = useState('');
  const [location, setLocation] = useState('');
  const [count, setCount] = useState(10);

  // Results state
  const [results, setResults] = useState<LeadSearchResponse | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch campaigns for the modal
  const { data: campaigns = [] } = useQuery<OutreachCampaign[]>({
    queryKey: ['outreach-campaigns'],
    queryFn: coldOutreachApi.getCampaigns,
  });

  // Search mutation
  const searchMutation = useMutation({
    mutationFn: leadDiscoveryApi.search,
    onSuccess: (data) => {
      setResults(data);
      if (data.leads.length === 0) {
        toast.error('No leads found. Try adjusting your search criteria.');
      } else {
        toast.success(`Found ${data.leads.length} leads!`);
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Search failed. Please try again.');
    },
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: leadDiscoveryApi.importLeads,
    onSuccess: (data) => {
      toast.success(`Added ${data.imported} leads to ${data.campaign_name}!`);
      setIsModalOpen(false);
      setResults(null);
      setNiche('');
      setLocation('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Import failed. Please try again.');
    },
  });

  // Rotate loading messages
  useEffect(() => {
    if (!searchMutation.isPending) return;

    const interval = setInterval(() => {
      setLoadingStep((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2500);

    return () => clearInterval(interval);
  }, [searchMutation.isPending]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!niche.trim() || !location.trim()) {
      toast.error('Please enter both niche and location');
      return;
    }
    setLoadingStep(0);
    searchMutation.mutate({ niche, location, count });
  };

  const handleImport = (campaignId: number) => {
    if (!results) return;
    importMutation.mutate({
      leads: results.leads,
      campaign_id: campaignId,
    });
  };

  const handleClear = () => {
    setResults(null);
  };

  const validForImport = results?.valid_for_import || 0;

  return (
    <div className="min-h-full bg-[--exec-bg] grain">
      {/* Hero Header */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[--exec-surface] via-[--exec-surface] to-[--exec-accent-bg-subtle]" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-[--exec-accent]/5 to-transparent rounded-full blur-3xl" />

        <div className="relative px-8 pt-8 pb-6">
          {/* Breadcrumb chip */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[--exec-surface-alt] rounded-full mb-4">
            <Search className="w-3.5 h-3.5 text-[--exec-accent]" />
            <span className="text-xs font-medium text-[--exec-text-secondary]">
              Lead Discovery
            </span>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <h1
                className="text-4xl font-bold text-[--exec-text] tracking-tight"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Lead <span className="text-[--exec-accent]">Discovery</span>
              </h1>
              <p className="text-[--exec-text-secondary] mt-2 text-lg">
                Find prospects with AI-powered search
              </p>
            </div>

            {/* Powered by badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[--exec-surface-alt] rounded-full">
              <Sparkles className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-medium text-[--exec-text-secondary]">
                Powered by Gemini AI
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="px-8 py-6">
        {/* Search Form */}
        <div className="bento-card p-6 mb-6">
          <form onSubmit={handleSearch}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {/* Niche Input */}
              <div>
                <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                  Niche / Industry
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[--exec-text-muted]" />
                  <input
                    type="text"
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                    placeholder="e.g., Digital Marketing Agencies"
                    className={cn(
                      'w-full pl-10 pr-4 py-2.5',
                      'bg-gray-50 dark:bg-slate-700',
                      'border border-gray-200 dark:border-slate-600 rounded-xl',
                      'text-gray-900 dark:text-white',
                      'placeholder:text-gray-400 dark:placeholder:text-slate-400',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
                      'transition-all duration-200'
                    )}
                  />
                </div>
              </div>

              {/* Location Input */}
              <div>
                <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                  Location
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[--exec-text-muted]" />
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g., California, United States"
                    className={cn(
                      'w-full pl-10 pr-4 py-2.5',
                      'bg-gray-50 dark:bg-slate-700',
                      'border border-gray-200 dark:border-slate-600 rounded-xl',
                      'text-gray-900 dark:text-white',
                      'placeholder:text-gray-400 dark:placeholder:text-slate-400',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
                      'transition-all duration-200'
                    )}
                  />
                </div>
              </div>

              {/* Count Select */}
              <div>
                <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                  Number of Leads
                </label>
                <select
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className={cn(
                    'w-full px-4 py-2.5',
                    'bg-gray-50 dark:bg-slate-700',
                    'border border-gray-200 dark:border-slate-600 rounded-xl',
                    'text-gray-900 dark:text-white',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
                    'transition-all duration-200'
                  )}
                >
                  <option value={5}>5 leads</option>
                  <option value={10}>10 leads</option>
                  <option value={15}>15 leads</option>
                </select>
              </div>
            </div>

            {/* Search Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={searchMutation.isPending}
                className={cn(
                  'flex items-center gap-2 px-6 py-2.5 rounded-xl',
                  'text-white font-medium',
                  'transition-all duration-200',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'hover:brightness-110 hover:scale-105 hover:shadow-lg',
                  'active:scale-95'
                )}
                style={{ backgroundColor: 'var(--exec-accent)' }}
              >
                {searchMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Search for Leads
              </button>
            </div>
          </form>
        </div>

        {/* Loading State */}
        {searchMutation.isPending && (
          <div className="bento-card p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[--exec-accent-bg] mb-4">
              <Loader2 className="w-8 h-8 text-[--exec-accent] animate-spin" />
            </div>
            <div className="flex items-center justify-center gap-2 text-[--exec-text]">
              {(() => {
                const LoadingIcon = LOADING_MESSAGES[loadingStep].icon;
                return <LoadingIcon className="w-5 h-5 text-[--exec-accent]" />;
              })()}
              <span className="text-lg font-medium">
                {LOADING_MESSAGES[loadingStep].text}
              </span>
            </div>
            <div className="flex justify-center gap-1.5 mt-4">
              {LOADING_MESSAGES.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'w-2 h-2 rounded-full transition-all duration-300',
                    i === loadingStep
                      ? 'bg-[--exec-accent] scale-125'
                      : 'bg-gray-300 dark:bg-gray-600'
                  )}
                />
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {results && !searchMutation.isPending && (
          <>
            {/* Stats Bar */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-[--exec-text]">
                  Found{' '}
                  <span className="font-semibold">{results.leads.length}</span>{' '}
                  leads
                </span>
                {results.duplicates_found > 0 && (
                  <span className="text-amber-600 dark:text-amber-400">
                    • {results.duplicates_found} duplicates
                  </span>
                )}
                <span className="text-green-600 dark:text-green-400">
                  • {validForImport} ready to import
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsModalOpen(true)}
                  disabled={validForImport === 0}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl',
                    'text-white font-medium',
                    'transition-all duration-200',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'hover:brightness-110 hover:scale-105',
                    'active:scale-95'
                  )}
                  style={{ backgroundColor: 'var(--exec-accent)' }}
                >
                  <Users className="w-4 h-4" />
                  Add to Campaign
                </button>
                <button
                  onClick={handleClear}
                  className="px-4 py-2 text-[--exec-text-secondary] hover:bg-[--exec-surface-alt] rounded-xl transition-colors"
                >
                  Clear Results
                </button>
              </div>
            </div>

            {/* Results Table */}
            <div className="bento-card overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                <thead className="bg-gray-50 dark:bg-slate-700/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Agency
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Website
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Niche
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                  {results.leads.map((lead, index) => (
                    <tr
                      key={index}
                      className={cn(
                        'hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors',
                        lead.is_duplicate && 'opacity-60'
                      )}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {lead.agency_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600 dark:text-slate-300">
                            {lead.email || '-'}
                          </span>
                          <EmailBadge lead={lead} />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
                          {lead.contact_name ? (
                            <>
                              <User className="w-4 h-4 text-gray-400" />
                              {lead.contact_name}
                            </>
                          ) : (
                            '-'
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {lead.website ? (
                          <a
                            href={
                              lead.website.startsWith('http')
                                ? lead.website
                                : `https://${lead.website}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            <Globe className="w-4 h-4" />
                            {lead.website.replace(/^https?:\/\//, '').slice(0, 30)}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600 dark:text-slate-300">
                          {lead.niche || '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Empty State */}
        {!results && !searchMutation.isPending && (
          <div className="bento-card p-12 text-center">
            <Search className="w-12 h-12 text-[--exec-text-muted] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[--exec-text] mb-2">
              Search for leads to get started
            </h3>
            <p className="text-[--exec-text-muted]">
              Enter a niche and location to discover potential prospects.
            </p>
          </div>
        )}
      </div>

      {/* Campaign Selection Modal */}
      <CampaignSelectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        campaigns={campaigns}
        validCount={validForImport}
        onSelect={handleImport}
        isImporting={importMutation.isPending}
      />
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run:
```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/pages/LeadDiscovery.tsx
git commit -m "$(cat <<'EOF'
feat: add Lead Discovery page component

- Search form with niche, location, count inputs
- Loading state with rotating messages
- Results table with email validation badges
- Campaign selection modal for bulk import
- Dark mode support

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Add Route and Navigation

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout.tsx`

**Step 1: Add import and route in App.tsx**

In `frontend/src/App.tsx`, add import:

```typescript
import LeadDiscovery from './pages/LeadDiscovery';
```

And add route after the cold-outreach route (around line 65):

```typescript
<Route path="/lead-discovery" element={<LeadDiscovery />} />
```

**Step 2: Add navigation item in Layout.tsx**

In `frontend/src/components/Layout.tsx`, add the Search import:

```typescript
import {
  // ... existing imports ...
  Search,
} from 'lucide-react';
```

Then in the `navigationGroups` array, in the 'Clients' group, add after 'Cold Email':

```typescript
{ name: 'Lead Discovery', href: '/lead-discovery', icon: Search },
```

The Clients group should look like:

```typescript
{
  label: 'Clients',
  items: [
    { name: 'Contacts', href: '/contacts', icon: Users },
    { name: 'Deals', href: '/deals', icon: Briefcase },
    { name: 'Services', href: '/services', icon: RefreshCw },
    { name: 'Outreach', href: '/outreach', icon: Send },
    { name: 'Cold Email', href: '/cold-outreach', icon: Mail },
    { name: 'Lead Discovery', href: '/lead-discovery', icon: Search },
  ],
},
```

**Step 3: Verify build**

Run:
```bash
cd frontend && npm run build
```

Expected: Build succeeds

**Step 4: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/Layout.tsx
git commit -m "$(cat <<'EOF'
feat: add Lead Discovery route and navigation

- Add /lead-discovery route in App.tsx
- Add sidebar navigation item under Clients group

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Add GEMINI_API_KEY to Environment

**Files:**
- Modify: `backend/.env` (local only, not committed)

**Step 1: Add environment variable**

Add to `backend/.env`:

```
GEMINI_API_KEY=your_gemini_api_key_here
```

**Note:** Get API key from https://aistudio.google.com/app/apikey

**Step 2: Verify environment loads**

Run:
```bash
cd backend && python -c "import os; from dotenv import load_dotenv; load_dotenv(); print('GEMINI_API_KEY:', 'SET' if os.getenv('GEMINI_API_KEY') else 'NOT SET')"
```

Expected: `GEMINI_API_KEY: SET`

**DO NOT COMMIT the .env file.**

---

## Task 11: End-to-End Test

**Step 1: Start backend**

```bash
cd backend && python -m uvicorn app.main:app --reload --port 8000
```

**Step 2: Start frontend (new terminal)**

```bash
cd frontend && npm run dev
```

**Step 3: Manual test checklist**

- [ ] Navigate to Lead Discovery page via sidebar
- [ ] Enter niche: "Web Design Agencies"
- [ ] Enter location: "New York"
- [ ] Select count: 10
- [ ] Click Search - verify loading state appears
- [ ] Verify results table shows leads with validation badges
- [ ] Click "Add to Campaign" - verify modal opens
- [ ] Select a campaign and confirm - verify success toast
- [ ] Go to Cold Outreach - verify leads appear in selected campaign

**Step 4: Final commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: complete Lead Discovery feature

AI-powered B2B lead discovery using Google Gemini:
- Search by niche + location with configurable count
- Real-time web search via Gemini's Google Search tool
- Email validation and duplicate detection
- Bulk import to Cold Outreach campaigns

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add Gemini dependency | requirements.txt |
| 2 | Create Pydantic schemas | schemas/lead_discovery.py |
| 3 | Create Gemini service | services/gemini_service.py |
| 4 | Create API routes | routes/lead_discovery.py |
| 5 | Register router | main.py |
| 6 | Add frontend types | types/index.ts |
| 7 | Add API client | lib/api.ts |
| 8 | Create Lead Discovery page | pages/LeadDiscovery.tsx |
| 9 | Add route and navigation | App.tsx, Layout.tsx |
| 10 | Configure API key | .env (local) |
| 11 | End-to-end test | Manual verification |
