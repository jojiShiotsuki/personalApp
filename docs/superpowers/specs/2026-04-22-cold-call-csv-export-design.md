# Cold-Call Prospect CSV Export — Design

**Date:** 2026-04-22
**Scope:** Cold Calls tab in Outreach Hub
**Goal:** Let the user download all prospects in the currently selected campaign (or every cold-call prospect, when no campaign is selected) as a single CSV file, so the data can be worked off-line in Sheets/Excel or handed to another tool.

---

## Problem

The cold-call pipeline ingests hundreds of prospects per campaign via CSV import. There is no way out: to review data in Sheets, email a list to a caller, or take a snapshot before bulk edits, the user has to copy cards one at a time. A CSV export is the natural counterpart to the existing `/api/cold-calls/import` endpoint.

## Non-goals

- Column picker / per-export field selection — YAGNI for v1. Export everything; the user can trim in Sheets.
- Async / background generation, progress UI, or email delivery. Data fits in a few hundred KB even at 10k prospects; a single synchronous request with a blob download is instant.
- Round-trip fidelity with the import endpoint. The export is for human consumption and portability, not for re-import. Column set is deliberately richer (includes pipeline fields like `status`, `tier`, `callback_at`).
- Filtering export by kanban status / callback-filter / sort-key. Export always returns the full set in the chosen scope; filtering can be done in Sheets after download. Matching the UI's current filter would couple backend to frontend state and is out of scope for v1.
- CSV re-export of deleted prospects. Only currently-existing rows are included.

---

## Scope rules

| Frontend state | Rows exported |
|---|---|
| A campaign is selected (`selectedCampaignId !== null`) | Every `CallProspect` where `campaign_id = <selected>`. |
| No campaign selected (`selectedCampaignId === null`) | Every `CallProspect` in the table, regardless of `campaign_id`. |

**No filter coupling:** The Callbacks Due filter, the kanban status filter, and the sort dropdown do NOT narrow the export. Export always returns every prospect in the chosen campaign scope.

---

## Columns (30 total, in this order)

| # | Column | Source | Notes |
|---|---|---|---|
| 1 | `id` | `CallProspect.id` | Integer. |
| 2 | `business_name` | `CallProspect.business_name` | Required in the model. |
| 3 | `first_name` | `CallProspect.first_name` | Empty string if NULL. |
| 4 | `last_name` | `CallProspect.last_name` | Empty string if NULL. |
| 5 | `position` | `CallProspect.position` | Empty string if NULL. |
| 6 | `email` | `CallProspect.email` | Empty string if NULL. |
| 7 | `linkedin_url` | `CallProspect.linkedin_url` | Empty string if NULL. |
| 8 | `phone` | `CallProspect.phone` | Primary phone. |
| 9 | `additional_phones` | `CallProspect.additional_phones` | JSON-stringified array-of-objects. Empty string if NULL. |
| 10 | `vertical` | `CallProspect.vertical` | |
| 11 | `address` | `CallProspect.address` | |
| 12 | `facebook_url` | `CallProspect.facebook_url` | |
| 13 | `website` | `CallProspect.website` | |
| 14 | `source` | `CallProspect.source` | |
| 15 | `rating` | `CallProspect.rating` | Float, or empty if NULL. No quoting. |
| 16 | `reviews_count` | `CallProspect.reviews_count` | Integer, or empty if NULL. |
| 17 | `google_maps_url` | `CallProspect.google_maps_url` | |
| 18 | `working_hours` | `CallProspect.working_hours` | |
| 19 | `description` | `CallProspect.description` | Full `Text` — may contain newlines; CSV writer quotes appropriately. |
| 20 | `notes` | `CallProspect.notes` | Same as description. |
| 21 | `script_label` | `CallProspect.script_label` | |
| 22 | `tier` | `CallProspect.tier` | Enum string value (e.g. `S_TIER_FLAGSHIP`). |
| 23 | `callback_at` | `CallProspect.callback_at` | ISO 8601 UTC with `Z` suffix (e.g. `2026-04-22T09:50:04Z`). Empty if NULL. |
| 24 | `callback_notes` | `CallProspect.callback_notes` | |
| 25 | `status` | `CallProspect.status` | One of `NEW \| ATTEMPTED \| CONNECTED \| DEAD`. |
| 26 | `campaign_id` | `CallProspect.campaign_id` | Integer, or empty if unassigned. |
| 27 | `campaign_name` | `OutreachCampaign.name` via join | Joined in so the CSV is human-readable without a second lookup. Empty if unassigned. |
| 28 | `current_step` | `CallProspect.current_step` | Integer (defaults to 1). |
| 29 | `created_at` | `CallProspect.created_at` | ISO 8601 UTC with `Z` suffix. |
| 30 | `updated_at` | `CallProspect.updated_at` | ISO 8601 UTC with `Z` suffix. |

**Encoding:** UTF-8 (no BOM). RFC 4180 line endings (`\r\n`). Python's `csv.writer` handles quoting for embedded commas, quotes, and newlines.

**NULL rendering:** empty string. (Not the literal text `"null"`.)

---

## Backend

### New endpoint

`GET /api/cold-calls/export?campaign_id=<int|omitted>`

**Request:**
- Optional query param `campaign_id` (integer). Absent or empty → all campaigns.
- Standard Bearer auth header (same as other cold-call endpoints).

**Response:**
- `200 OK` with body = streamed CSV text.
- `Content-Type: text/csv; charset=utf-8`
- `Content-Disposition: attachment; filename="<slug>.csv"` (see filename rules below).
- Error responses follow the existing API conventions (`401` when unauthenticated, `404` if a non-existent `campaign_id` is passed — optional, see "Open questions").

**Filename slug** (backend-chosen so download works without extra frontend work):
- With campaign: `cold-calls-<slug>-<YYYY-MM-DD>.csv` where `<slug>` is the campaign `name` lowercased, non-alphanumerics collapsed to `-`, trimmed. Example: `"Cebu Aircon"` → `cold-calls-cebu-aircon-2026-04-22.csv`.
- Without campaign: `cold-calls-all-<YYYY-MM-DD>.csv`.
- Date is server-side UTC date at the time of the request.

### Streaming

Use FastAPI `StreamingResponse` with a generator that yields one row of CSV text at a time. Avoids building the full file in memory, keeps latency low for the user, and is mandatory if we ever exceed 10k prospects. Implementation: wrap a generator that iterates the SQLAlchemy query and runs each row through `csv.writer` over an `io.StringIO` buffer, yielding and resetting per row.

### Query

```python
(
    db.query(CallProspect, OutreachCampaign.name)
    .outerjoin(OutreachCampaign, CallProspect.campaign_id == OutreachCampaign.id)
    .filter(CallProspect.campaign_id == campaign_id) if campaign_id else <no filter>
    .order_by(CallProspect.id.asc())
)
```

Deterministic order by `id ASC` so repeated exports of the same data produce identical CSVs (useful for diffing / spreadsheet stability).

### Timezone invariant

`callback_at`, `created_at`, `updated_at` are stored in the DB as naive UTC (this is an existing project invariant documented in `memory/feedback`-style notes). The export must emit them as `YYYY-MM-DDTHH:MM:SSZ` — append `Z` after serializing. Mirrors the frontend's `parseBackendDatetime` helper that exists for the same reason.

---

## Frontend

### Button

Placement: Cold Calls kanban header row, between "Add Lead" and "Import CSV". Outreach Hub secondary button style (reuses `secondaryButtonClasses` from `outreachStyles.ts`).

```
[All Campaigns ▼]   [Sort ▼]   [+ Add Lead] [↓ Export CSV] [↑ Import CSV]
```

- Icon: `Download` from lucide-react.
- Label: `Export CSV`.
- Disabled states: none — button always works. When no prospects match the scope, the CSV will still download, just with only a header row.

### Download mechanism

Axios with `responseType: 'blob'`, then programmatic download via a hidden `<a>` element:

```typescript
const response = await api.get('/api/cold-calls/export', {
  params: campaignId ? { campaign_id: campaignId } : undefined,
  responseType: 'blob',
});
const filename = parseFilenameFromContentDisposition(
  response.headers['content-disposition']
) ?? 'cold-calls.csv';
const url = URL.createObjectURL(response.data as Blob);
const a = document.createElement('a');
a.href = url;
a.download = filename;
document.body.appendChild(a);
a.click();
a.remove();
URL.revokeObjectURL(url);
```

The `parseFilenameFromContentDisposition` helper pulls the filename the backend provided. Falls back to `cold-calls.csv` if the header is absent or malformed.

### Click handler

Wraps the download in a mutation-style flow: loading spinner on the button while the request is in-flight, `toast.success('Downloaded <filename>')` on success, `toast.error(...)` with the server-returned detail (same pattern as the import modal's onError) on failure.

Using `useMutation` keeps the spinner logic consistent with the rest of the app. The mutation's `mutationFn` performs the fetch + blob handling; `onSuccess` just toasts.

### New files / edits

| File | Change |
|---|---|
| `backend/app/routes/call_prospects.py` | Add `GET /export` handler — builds the query, serializes rows via `csv.writer`, returns `StreamingResponse` with `Content-Disposition`. |
| `backend/app/services/cold_call_export.py` *(new, optional)* | Extract the row→CSV serialization logic so it's unit-testable in isolation. See "Testing" below. |
| `frontend/src/lib/api.ts` | Add `coldCallsApi.exportCsv(campaignId: number \| null): Promise<{ blob: Blob; filename: string }>`. |
| `frontend/src/components/outreach/ColdCallsTab.tsx` | Add the "Export CSV" button, handler, and toast wiring. |

No new frontend deps. No DB migrations.

---

## Edge cases

- **Empty result set:** CSV has header row only (~200 bytes). Download still succeeds.
- **Commas, quotes, newlines inside fields:** Python's `csv.writer` with default dialect handles them — fields are quoted and internal quotes doubled.
- **Non-ASCII characters (Filipino accents, Japanese names):** UTF-8 preserves them. Excel on Windows may misinterpret without BOM, but Sheets and modern Excel handle UTF-8 correctly; skipping the BOM keeps the file clean for non-Excel consumers. (If Excel compatibility becomes a pain, add `﻿` later — deferred.)
- **`additional_phones` as JSON blob:** Stringified with `json.dumps`. Consumer tools typically show it as a single opaque cell; power users can parse it.
- **Large descriptions (thousands of chars):** CSV writer handles. Excel truncates cells over 32,767 chars but that's an Excel limit, not ours.
- **Deleted campaign with orphan prospects:** `campaign_id` column shows the stale integer, `campaign_name` is empty. The outer join gracefully returns NULL for the name.
- **Concurrent writes during export:** streaming means some rows may reflect writes that happened mid-export. Acceptable — this is a snapshot, not a consistent-read transaction. If point-in-time consistency becomes critical, the query can be wrapped in a repeatable-read transaction.

---

## Testing

### Backend

- **Unit tests** for the row→CSV serialization helper (if extracted into `cold_call_export.py`):
  - All-nulls row renders every field as empty string.
  - A row with commas, double quotes, and embedded newlines quotes correctly.
  - `callback_at` is a naive UTC datetime → rendered with `Z` suffix.
  - `additional_phones` is a list of dicts → rendered as compact JSON.
- **Integration test** (FastAPI `TestClient`):
  - Seed 3 prospects across 2 campaigns; `GET /api/cold-calls/export` returns 4 lines (1 header + 3 body) with `Content-Type: text/csv`.
  - `?campaign_id=<c1>` returns only the 2 prospects in campaign 1.
  - `Content-Disposition` filename matches the slug rules for both "selected campaign" and "all campaigns" cases.
  - Response parses cleanly back via `csv.DictReader` with every expected column present.

### Frontend

- **Unit test** for `parseFilenameFromContentDisposition`: covers the `filename="foo.csv"` and unquoted `filename=foo.csv` forms, returns `null` for malformed headers.
- **Manual smoke** (Playwright optional — the download itself is non-trivial to automate in headless without file-download config): click the Export button, verify a CSV downloads with the expected filename and a plausible row count.

---

## Rollout

- Single PR, single commit ideally, straight to `main` (matches the recent Cold Calls feature pattern).
- No feature flag — purely additive endpoint + button.
- No DB migration.
- No secrets, no env changes.

---

## Open questions

1. **Unknown `campaign_id`:** if someone passes a `campaign_id` that doesn't exist, do we return an empty CSV (treat as "no matching rows") or `404`? Leaning toward **empty CSV** — simpler, and the frontend only ever sends IDs from the campaign list so this is mostly a defensive edge. Final answer goes in the plan.
2. **Excel BOM:** skip for v1. If users report "Excel shows gibberish for ñ/é", add `﻿` at the start. Not blocking.

Both deferred; both have safe defaults.
