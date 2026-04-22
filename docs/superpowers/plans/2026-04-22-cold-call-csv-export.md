# Cold-Call CSV Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Export CSV" button to the Cold Calls kanban that downloads the currently-scoped prospects (selected campaign or all) as a CSV with every field.

**Architecture:** New `GET /api/cold-calls/export` FastAPI endpoint returning a `StreamingResponse` of CSV text with `Content-Disposition: attachment`. Frontend axios call with `responseType: 'blob'` pipes the response through a hidden `<a>` click to trigger the browser's download. No new DB objects, no migrations, no new frontend deps.

**Tech Stack:** FastAPI `StreamingResponse`, Python `csv.writer`, SQLAlchemy `.yield_per()`, React + axios blob download, `lucide-react` Download icon.

**Reference:**
- Spec: `docs/superpowers/specs/2026-04-22-cold-call-csv-export-design.md`
- Project conventions: `CLAUDE.md` (API patterns, React Query mutations, Outreach Hub button style)
- Project has NO pytest suite — recent features (callback, sort, tier tagging) all ship with manual smoke verification. This plan follows that convention. Each implementation task ends with a runnable smoke command that produces evidence the change works.

---

## File Structure

**Backend — 1 file modified:**
- `backend/app/routes/call_prospects.py` — add `GET /export` handler with inline CSV streaming and filename generation. Spec flagged the serializer could be extracted into `services/cold_call_export.py` but marked that optional; with no test suite to exercise the extracted module, keeping it inline reduces surface area. ~90 new lines.

**Frontend — 3 files changed:**
- `frontend/src/lib/contentDisposition.ts` *(new)* — `parseFilenameFromContentDisposition(header: string | undefined): string | null` helper. Pure, no deps.
- `frontend/src/lib/api.ts` — add `coldCallsApi.exportCsv(campaignId: number | null): Promise<{ blob: Blob; filename: string }>`.
- `frontend/src/components/outreach/ColdCallsTab.tsx` — add Export CSV button in the kanban header button cluster, `useMutation` for the download, toast wiring.

---

## Task 1: Backend — add `/api/cold-calls/export` endpoint

**Files:**
- Modify: `backend/app/routes/call_prospects.py` — add the route block between `bulk_update_tier` and `import_call_prospects` (preserves "bulk ops then I/O" grouping).

- [ ] **Step 1: Extend the top-of-file docstring + imports**

Edit the `call_prospects.py` module docstring to list the new endpoint. Also add the imports needed for streaming CSV and the outer join.

In `call_prospects.py`, replace the docstring at lines 1–12:

```python
"""
Cold Calls pipeline routes — CRUD, bulk ops, CSV import, CSV export.

Endpoints:
  GET    /api/cold-calls                    list (optional status filter)
  POST   /api/cold-calls                    create
  PUT    /api/cold-calls/{id}               update (stage, notes, fields)
  DELETE /api/cold-calls/{id}               delete
  POST   /api/cold-calls/bulk-delete        bulk delete by ID list
  POST   /api/cold-calls/bulk-update-label  bulk assign script_label
  POST   /api/cold-calls/bulk-update-tier   bulk assign tier
  POST   /api/cold-calls/import             bulk CSV import (Outscraper)
  GET    /api/cold-calls/export             CSV download (optional campaign scope)
"""
```

Then add three imports near the top of the imports block (after the existing `import re`):

```python
import csv
import io
import json
from datetime import datetime
from typing import Iterator
```

And add the outreach campaign model import near the other model import (after `from app.models.call_prospect import CallProspect, CallStatus`):

```python
from app.models.outreach import OutreachCampaign
```

Also add FastAPI's streaming response type to the existing `from fastapi import APIRouter, Depends, HTTPException` line:

```python
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
```

- [ ] **Step 2: Add the export column list + small formatters as module-level helpers**

In `call_prospects.py`, insert this block immediately BEFORE the existing `@router.post("/import", ...)` decorator (so it sits with the bulk ops, above the I/O handler):

```python
# -- CSV export -----------------------------------------------------

EXPORT_HEADERS = [
    "id",
    "business_name",
    "first_name",
    "last_name",
    "position",
    "email",
    "linkedin_url",
    "phone",
    "additional_phones",
    "vertical",
    "address",
    "facebook_url",
    "website",
    "source",
    "rating",
    "reviews_count",
    "google_maps_url",
    "working_hours",
    "description",
    "notes",
    "script_label",
    "tier",
    "callback_at",
    "callback_notes",
    "status",
    "campaign_id",
    "campaign_name",
    "current_step",
    "created_at",
    "updated_at",
]


def _export_fmt_dt(dt: Optional[datetime]) -> str:
    """Naive-UTC datetime → ISO 8601 with Z suffix. Empty string if None.

    Matches the frontend's `parseBackendDatetime` invariant: backend stores
    naive UTC, append `Z` on serialization so JS parses it as UTC rather
    than local time.
    """
    if dt is None:
        return ""
    return dt.replace(microsecond=0).isoformat() + "Z"


def _export_fmt_json(value) -> str:
    """JSON blob → compact stringified JSON. Empty string if None."""
    if value is None:
        return ""
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _export_fmt_scalar(value) -> str:
    """Any scalar → str. Empty string if None. Not `"None"`."""
    if value is None:
        return ""
    return str(value)


def _export_slugify(name: str) -> str:
    """Campaign name → filename-safe slug. Empty name falls back to 'campaign'."""
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "campaign"
```

- [ ] **Step 3: Add the endpoint handler**

Immediately after the helpers block (still before `@router.post("/import", ...)`), add:

```python
@router.get("/export")
def export_call_prospects(
    campaign_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Stream all cold-call prospects as CSV, optionally scoped to a campaign.

    - `campaign_id` absent or None → every prospect in the table.
    - `campaign_id` set → only prospects with that campaign_id.
    - Unknown `campaign_id` returns an empty CSV (header row only), not 404 —
      mirrors the "no rows match" case; simpler contract for the frontend.
    """
    query = (
        db.query(CallProspect, OutreachCampaign.name)
        .outerjoin(
            OutreachCampaign, CallProspect.campaign_id == OutreachCampaign.id
        )
        .order_by(CallProspect.id.asc())
    )
    if campaign_id is not None:
        query = query.filter(CallProspect.campaign_id == campaign_id)

    # Resolve the campaign name for the filename separately so we still get
    # the right slug when the query returns zero rows.
    campaign_name_for_filename: Optional[str] = None
    if campaign_id is not None:
        campaign_name_for_filename = (
            db.query(OutreachCampaign.name)
            .filter(OutreachCampaign.id == campaign_id)
            .scalar()
        )

    def _generate() -> Iterator[str]:
        buffer = io.StringIO()
        writer = csv.writer(buffer, lineterminator="\r\n")
        writer.writerow(EXPORT_HEADERS)
        yield buffer.getvalue()
        buffer.seek(0)
        buffer.truncate()

        for prospect, camp_name in query.yield_per(500):
            writer.writerow(
                [
                    _export_fmt_scalar(prospect.id),
                    _export_fmt_scalar(prospect.business_name),
                    _export_fmt_scalar(prospect.first_name),
                    _export_fmt_scalar(prospect.last_name),
                    _export_fmt_scalar(prospect.position),
                    _export_fmt_scalar(prospect.email),
                    _export_fmt_scalar(prospect.linkedin_url),
                    _export_fmt_scalar(prospect.phone),
                    _export_fmt_json(prospect.additional_phones),
                    _export_fmt_scalar(prospect.vertical),
                    _export_fmt_scalar(prospect.address),
                    _export_fmt_scalar(prospect.facebook_url),
                    _export_fmt_scalar(prospect.website),
                    _export_fmt_scalar(prospect.source),
                    _export_fmt_scalar(prospect.rating),
                    _export_fmt_scalar(prospect.reviews_count),
                    _export_fmt_scalar(prospect.google_maps_url),
                    _export_fmt_scalar(prospect.working_hours),
                    _export_fmt_scalar(prospect.description),
                    _export_fmt_scalar(prospect.notes),
                    _export_fmt_scalar(prospect.script_label),
                    _export_fmt_scalar(prospect.tier),
                    _export_fmt_dt(prospect.callback_at),
                    _export_fmt_scalar(prospect.callback_notes),
                    _export_fmt_scalar(prospect.status),
                    _export_fmt_scalar(prospect.campaign_id),
                    _export_fmt_scalar(camp_name),
                    _export_fmt_scalar(prospect.current_step),
                    _export_fmt_dt(prospect.created_at),
                    _export_fmt_dt(prospect.updated_at),
                ]
            )
            yield buffer.getvalue()
            buffer.seek(0)
            buffer.truncate()

    today = datetime.utcnow().strftime("%Y-%m-%d")
    if campaign_id is not None and campaign_name_for_filename:
        filename = (
            f"cold-calls-{_export_slugify(campaign_name_for_filename)}-{today}.csv"
        )
    else:
        filename = f"cold-calls-all-{today}.csv"

    return StreamingResponse(
        _generate(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
```

- [ ] **Step 4: Smoke-verify against local dev backend**

The local backend is running on :8001 and connected to the live Render Postgres (via `.env`). Run this from the repo root:

```bash
"C:/Users/Shiot/Projects/personalApp/backend/venv/Scripts/python" -c "
import os, requests
# Log in with the usual creds to get a token
r = requests.post('http://127.0.0.1:8001/api/auth/login', json={'username':'admin','password':'admin123'})
token = r.json()['access_token']
headers = {'Authorization': f'Bearer {token}'}

# All-campaigns export
r = requests.get('http://127.0.0.1:8001/api/cold-calls/export', headers=headers)
print('ALL:', r.status_code, r.headers.get('content-type'), r.headers.get('content-disposition'))
body = r.content.decode('utf-8')
lines = body.splitlines()
print(f'  lines: {len(lines)} | first-header: {lines[0][:80]!r}')
print(f'  first-data: {lines[1][:80]!r}' if len(lines) > 1 else '  empty body')

# Single-campaign export (campaign 16 = cebu aircon)
r = requests.get('http://127.0.0.1:8001/api/cold-calls/export', headers=headers, params={'campaign_id': 16})
print('CAMPAIGN 16:', r.status_code, r.headers.get('content-disposition'))
print(f'  lines: {len(r.text.splitlines())}')

# Unknown campaign should be empty CSV, not 404
r = requests.get('http://127.0.0.1:8001/api/cold-calls/export', headers=headers, params={'campaign_id': 99999})
print('UNKNOWN:', r.status_code, '| lines:', len(r.text.splitlines()))
"
```

**Expected:**
- `ALL: 200 text/csv; charset=utf-8 attachment; filename="cold-calls-all-2026-04-22.csv"`
- `  lines: 159` (header + 158 data rows — matches current DB content in campaign 16 + other campaigns/unassigned)
- `  first-header` starts with `id,business_name,first_name,...`
- `CAMPAIGN 16: 200 ...filename="cold-calls-cebu-<slug>-2026-04-22.csv"` with 159 lines (header + 158 data — all current prospects ARE in campaign 16 at the time of writing this plan; adjust the expected count if you imported more between tasks).
- `UNKNOWN: 200 | lines: 1` (header only, empty body)

If any line count is 0 or the status is not 200, STOP and investigate before proceeding.

- [ ] **Step 5: Commit backend changes**

```bash
cd "C:/Users/Shiot/Projects/personalApp"
git add backend/app/routes/call_prospects.py
git commit -m "feat(cold-calls): add GET /api/cold-calls/export CSV download endpoint"
```

---

## Task 2: Frontend — `contentDisposition.ts` helper

**Files:**
- Create: `frontend/src/lib/contentDisposition.ts`

- [ ] **Step 1: Create the helper with the full implementation**

Create `frontend/src/lib/contentDisposition.ts` with exactly this content:

```typescript
// Parse a Content-Disposition header and return the `filename` parameter,
// or null if absent. Handles both quoted (filename="foo.csv") and unquoted
// (filename=foo.csv) forms. Does NOT handle RFC 5987 `filename*=` extended
// syntax — we don't emit it server-side and ASCII-only filenames suffice
// for the cold-call CSV use case (slug is alphanumerics + dashes + date).
export function parseFilenameFromContentDisposition(
  header: string | undefined | null
): string | null {
  if (!header) return null;

  // Quoted form first: filename="foo bar.csv"
  const quoted = header.match(/filename="([^"]+)"/i);
  if (quoted) return quoted[1];

  // Unquoted: filename=foo.csv (stops at ; or end-of-string)
  const unquoted = header.match(/filename=([^;]+)/i);
  if (unquoted) return unquoted[1].trim();

  return null;
}
```

- [ ] **Step 2: Quick ad-hoc sanity check via node**

```bash
cd "C:/Users/Shiot/Projects/personalApp/frontend"
node -e "
const mod = {};
eval(require('fs').readFileSync('src/lib/contentDisposition.ts', 'utf8').replace('export function', 'mod.parseFilenameFromContentDisposition = function').replace(/: string \| undefined \| null| : string \| null/g, ''));
const fn = mod.parseFilenameFromContentDisposition;
console.log('quoted:', fn('attachment; filename=\"cold-calls-all-2026-04-22.csv\"'));
console.log('unquoted:', fn('attachment; filename=cold-calls.csv'));
console.log('missing:', fn('attachment'));
console.log('undefined:', fn(undefined));
console.log('empty:', fn(''));
"
```

**Expected:**
```
quoted: cold-calls-all-2026-04-22.csv
unquoted: cold-calls.csv
missing: null
undefined: null
empty: null
```

If any result is wrong, fix the regex in `contentDisposition.ts` before continuing.

- [ ] **Step 3: Type-check**

```bash
cd "C:/Users/Shiot/Projects/personalApp/frontend" && npx tsc -b
```

**Expected:** no output (success). If errors appear, fix before moving on — Render build runs `tsc -b` which is stricter than `tsc --noEmit`.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/Shiot/Projects/personalApp"
git add frontend/src/lib/contentDisposition.ts
git commit -m "feat(cold-calls): add Content-Disposition filename parser helper"
```

---

## Task 3: Frontend — `coldCallsApi.exportCsv` method

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add the import at the top of the file**

Near the other `@/lib/...` imports (right after `import axios from 'axios';` at line 1), add:

```typescript
import { parseFilenameFromContentDisposition } from '@/lib/contentDisposition';
```

- [ ] **Step 2: Add the `exportCsv` method to `coldCallsApi`**

Find the existing `coldCallsApi` object (starts around line 1611 with `export const coldCallsApi = {`). Find its `import:` method (around line 1663). Add this new method immediately after `import:` (before the closing `};` of the object):

```typescript
  exportCsv: async (
    campaignId: number | null
  ): Promise<{ blob: Blob; filename: string }> => {
    const response = await api.get('/api/cold-calls/export', {
      params: campaignId === null ? undefined : { campaign_id: campaignId },
      responseType: 'blob',
    });
    const filename =
      parseFilenameFromContentDisposition(
        response.headers['content-disposition']
      ) ?? 'cold-calls.csv';
    return { blob: response.data as Blob, filename };
  },
```

- [ ] **Step 3: Type-check**

```bash
cd "C:/Users/Shiot/Projects/personalApp/frontend" && npx tsc -b
```

**Expected:** no output.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/Shiot/Projects/personalApp"
git add frontend/src/lib/api.ts
git commit -m "feat(cold-calls): add coldCallsApi.exportCsv client method"
```

---

## Task 4: Frontend — Export CSV button in `ColdCallsTab.tsx`

**Files:**
- Modify: `frontend/src/components/outreach/ColdCallsTab.tsx`

- [ ] **Step 1: Add the `Download` icon import**

Locate the existing `lucide-react` import line in `ColdCallsTab.tsx` (near the top of the file). Add `Download` to the destructured icon list. For example, if the import currently reads:

```typescript
import { Plus, Upload, Layers, ... } from 'lucide-react';
```

Add `Download` alongside:

```typescript
import { Plus, Upload, Download, Layers, ... } from 'lucide-react';
```

(Keep the other icons in whatever order they appear — just slot `Download` in.)

- [ ] **Step 2: Add the export mutation near the other mutations**

Locate the `useMutation` blocks in `ColdCallsTab` (they live near the top of the component body, right after the `useQuery` for `campaigns` and prospects). Add this mutation after the existing `bulkUpdateTierMutation` (or any other convenient bulk mutation):

```typescript
  const exportCsvMutation = useMutation({
    mutationFn: (campaignId: number | null) => coldCallsApi.exportCsv(campaignId),
    onSuccess: ({ blob, filename }) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${filename}`);
    },
    onError: (error: unknown) => {
      const detail =
        axios.isAxiosError(error) && typeof error.response?.data?.detail === 'string'
          ? error.response.data.detail
          : error instanceof Error
            ? error.message
            : 'Failed to export CSV';
      toast.error(detail);
    },
  });
```

If `axios` is not yet imported at the top of the file, add:

```typescript
import axios from 'axios';
```

alongside the other imports.

- [ ] **Step 3: Add the Export CSV button to the kanban header**

Locate the button cluster in the kanban header that holds the existing "Add Lead" / "Import CSV" buttons. (Look for the button with the `Upload` icon and the text "Import CSV" — that's the Import button.)

Add a new button immediately BEFORE the Import CSV button so the visual order is `[+ Add Lead] [↓ Export CSV] [↑ Import CSV]`:

```tsx
<button
  type="button"
  onClick={() => exportCsvMutation.mutate(selectedCampaignId)}
  disabled={exportCsvMutation.isPending}
  className={cn('flex items-center gap-2', secondaryButtonClasses)}
>
  {exportCsvMutation.isPending ? (
    <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
  ) : (
    <Download className="w-4 h-4" />
  )}
  Export CSV
</button>
```

If `secondaryButtonClasses` is not yet imported from `@/lib/outreachStyles` at the top of the file, check the existing imports — `primaryButtonClasses` is already imported there. Add `secondaryButtonClasses` to the same import line.

- [ ] **Step 4: Type-check**

```bash
cd "C:/Users/Shiot/Projects/personalApp/frontend" && npx tsc -b
```

**Expected:** no output.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/Shiot/Projects/personalApp"
git add frontend/src/components/outreach/ColdCallsTab.tsx
git commit -m "feat(cold-calls): add Export CSV button to kanban header"
```

---

## Task 5: End-to-end smoke test

**Files:** none.

- [ ] **Step 1: Confirm dev servers are still running**

Backend should still be on :8001, frontend on :5174 (or :5173 if free). If the background tasks were killed, restart:

```bash
cd "C:/Users/Shiot/Projects/personalApp/backend" && ./venv/Scripts/python -m uvicorn app.main:app --reload --port 8001 &
cd "C:/Users/Shiot/Projects/personalApp/frontend" && npm run dev &
```

Wait for `Application startup complete` on the backend log and `ready in` on the frontend log.

- [ ] **Step 2: Download with no campaign selected (all prospects)**

In the browser at http://localhost:5174/, navigate to Outreach Hub → Cold Calls. With the default "All Campaigns" selected, click the new **Export CSV** button.

**Expected:**
- A file named `cold-calls-all-2026-04-22.csv` (today's date) downloads.
- A green success toast shows: `Downloaded cold-calls-all-2026-04-22.csv`.
- Opening the file in a text editor shows the 30-column header row followed by every cold-call prospect currently in the DB.

- [ ] **Step 3: Download with a specific campaign selected**

Select the Cebu aircon campaign in the campaign selector. Click **Export CSV** again.

**Expected:**
- A file named `cold-calls-<slug>-2026-04-22.csv` downloads where `<slug>` matches the Cebu campaign's lowercased name.
- The file contains only prospects whose `campaign_id` equals the selected campaign's id.
- `campaign_id` column is the same integer on every row; `campaign_name` column is the selected campaign's actual name on every row.

- [ ] **Step 4: Spot-check tricky fields**

In a downloaded CSV, verify:

- `additional_phones` renders as JSON (e.g. `[{"label":"company_phone","value":"..."}]`) for any row that has it, empty otherwise.
- `callback_at`, `created_at`, `updated_at` render as `YYYY-MM-DDTHH:MM:SSZ` — not as local time, not with microseconds, not as Python `datetime(...)` repr.
- `rating` is a bare number (e.g. `4.5`), empty string for rows without a rating — not `None` or `null`.
- A row whose `description` or `notes` contains a comma, quote, or newline is properly RFC-4180 quoted (double-quoted field, internal quotes doubled). Look for any such row in the data and verify Sheets imports it into a single cell.

- [ ] **Step 5: Verify round-trip parse**

```bash
"C:/Users/Shiot/Projects/personalApp/backend/venv/Scripts/python" -c "
import csv, sys
path = r'<paste the downloaded path here>'
with open(path, 'r', encoding='utf-8', newline='') as f:
    reader = csv.DictReader(f)
    rows = list(reader)
print(f'Rows: {len(rows)}')
print(f'Columns: {len(reader.fieldnames)}')
print(f'Expected 30 columns: {len(reader.fieldnames) == 30}')
missing = [c for c in ['id','business_name','phone','campaign_name','callback_at'] if c not in reader.fieldnames]
print(f'Missing critical columns: {missing if missing else \"none\"}')"
```

**Expected:**
- `Rows: <158 or similar>`
- `Columns: 30`
- `Expected 30 columns: True`
- `Missing critical columns: none`

If any expectation fails, fix the issue (likely a typo in `EXPORT_HEADERS` or a wrong column order) and re-commit before proceeding.

---

## Task 6: Push to main

- [ ] **Step 1: Review the commit chain**

```bash
cd "C:/Users/Shiot/Projects/personalApp" && git log --oneline origin/main..HEAD
```

**Expected:** 4 new commits with messages matching Task 1–4:
- `feat(cold-calls): add GET /api/cold-calls/export CSV download endpoint`
- `feat(cold-calls): add Content-Disposition filename parser helper`
- `feat(cold-calls): add coldCallsApi.exportCsv client method`
- `feat(cold-calls): add Export CSV button to kanban header`

- [ ] **Step 2: Push**

```bash
cd "C:/Users/Shiot/Projects/personalApp" && git push origin main
```

**Expected:** successful push, 4 commits on `origin/main`.

- [ ] **Step 3: Confirm Render builds green**

The static-site frontend on Render runs `tsc -b && vite build` on every push to main. The backend web service restarts with the new route. Watch Render's deploy logs (or via the Render MCP workspace if selected) for a successful build. If the frontend build fails, the most likely cause is a TypeScript error that `tsc --noEmit` missed — read the error, fix inline, commit, push.

---

## Notes for the implementer

- **Outreach Hub design system constraints** (from `CLAUDE.md` and `frontend/design-system/vertex-outreach-hub/MASTER.md`): no `dark:*` prefixes, no `hover:scale-*` / `hover:translate-*`, no `rounded-md`, no hardcoded hex colors, no inline `style` for theme colors. The reuse of `secondaryButtonClasses` in Task 4 handles this automatically; don't invent new button styles.
- **Timezone invariant:** backend stores UTC naive. `_export_fmt_dt` appends `Z` so consumers parse it as UTC. Do not skip the `Z` or the whole pipeline from import timezone fix is undone for exports. See `feedback_timezone-invariant` in user memory if it exists.
- **Dedupe awareness:** the export does NOT deduplicate. If the DB has two rows with the same phone (the import endpoint dedupes at insert time but manual inserts or legacy data may have dups), both appear in the CSV. Acceptable — CSV is a mirror of the DB.
- **No migrations, no new deps, no env vars needed.**
