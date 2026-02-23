# Report Builder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a comprehensive reports page with 4 tabs (Overview, Revenue, Time, Pipeline) using Recharts for visualizations and server-side aggregation endpoints.

**Architecture:** Single `/reports` page with tab navigation. Backend provides 4 dedicated aggregation endpoints under `/api/reports/`. Frontend uses Recharts for charts and TanStack Query for data fetching. Date range picker is shared across all tabs.

**Tech Stack:** FastAPI + SQLAlchemy (backend), React + Recharts + TailwindCSS (frontend), TanStack Query (state)

---

### Task 1: Install Recharts

**Files:**
- Modify: `frontend/package.json`

**Step 1: Install recharts**

Run: `cd frontend && npm install recharts`

**Step 2: Verify installation**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: add recharts dependency for report builder"
```

---

### Task 2: Backend Reports Service

**Files:**
- Create: `backend/app/services/reports.py`

**Step 1: Create the reports service**

Create `backend/app/services/reports.py` with a `ReportsService` class containing 4 static methods: `get_overview()`, `get_revenue()`, `get_time()`, `get_pipeline()`. Each accepts `db: Session`, `start_date: date`, `end_date: date`.

Key implementation details:

**`get_overview()`** queries:
- Total revenue: `SUM(Deal.value)` where `stage == closed_won` and `actual_close_date` between start/end
- Previous period: same query shifted back by the period length, compute `revenue_change_pct`
- Hours logged: `SUM(TimeEntry.duration_seconds) / 3600` where `start_time` between dates
- Previous period hours for `hours_change_pct`
- Deals closed: count of `closed_won` + `closed_lost` in period, win rate = won/total*100
- Active projects: count where `status not in (completed, cancelled)`
- Revenue by day: group deals by `actual_close_date`, time entries by date. Return `[{date, revenue, hours}]`
- Top clients: join `Deal` -> `Contact` on `contact_id`, group by contact name, sum value, order desc, limit 5

**`get_revenue()`** queries:
- Revenue over time: group `Deal.value` (closed_won) by `actual_close_date` bucketed by day or month
- MRR trend: filter `is_recurring=True, stage=closed_won`, group `recurring_amount` by `actual_close_date`
- Revenue by client: join Deal->Contact, group by contact.name, sum value, top 10
- Revenue by source: `{one_time: sum where !is_recurring, recurring: sum where is_recurring}`
- Avg deal size: group by period, `AVG(value)` for closed_won
- Won vs lost: group by period, count `closed_won` and `closed_lost`

**`get_time()`** queries:
- Hours by day: group `TimeEntry.duration_seconds / 3600` by `date(start_time)`
- Billable split: `{billable: sum where is_billable, non_billable: sum where !is_billable}`
- Time by project: join TimeEntry->Project, group by project.name, sum hours, top 10
- Time by category: group by `category`, sum hours
- Billable amount: `SUM(duration_seconds / 3600 * hourly_rate)` where is_billable
- Avg hours per day: total hours / distinct working days

**`get_pipeline()`** queries:
- Funnel: count deals by stage (all active deals, not date-filtered)
- Pipeline value over time: group active deals by `created_at` period
- Win rate trend: by period, `closed_won / (closed_won + closed_lost) * 100`
- Avg days to close: `AVG(actual_close_date - created_at)` for closed_won deals
- Deals by stage over time: group by stage + period
- Stalled deals: active deals where `updated_at < now - 14 days`

**Time bucketing logic:** If `(end_date - start_date).days >= 90`, bucket by month (`strftime('%Y-%m', date)`). Otherwise bucket by day (`strftime('%Y-%m-%d', date)`).

**Previous period logic:** `period_days = (end_date - start_date).days`. Previous period is `(start_date - timedelta(days=period_days), start_date - timedelta(days=1))`.

Models to import:
```python
from app.models.crm import Deal, Contact, DealStage
from app.models.task import Task
from app.models.time_entry import TimeEntry
from app.models.project import Project
```

**Step 2: Verify imports**

Run: `cd backend && venv/Scripts/python -c "from app.services.reports import ReportsService; print('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
git add backend/app/services/reports.py
git commit -m "feat: add reports aggregation service"
```

---

### Task 3: Backend Reports Route

**Files:**
- Create: `backend/app/routes/reports.py`
- Modify: `backend/app/main.py:17` (add import) and `:88` (register router)

**Step 1: Create the route file**

Create `backend/app/routes/reports.py`:
```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date, timedelta
from typing import Optional
from app.database import get_db
from app.services.reports import ReportsService

router = APIRouter(prefix="/api/reports", tags=["reports"])

@router.get("/overview")
def get_overview_report(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db)
):
    start = start_date or (date.today() - timedelta(days=30))
    end = end_date or date.today()
    return ReportsService.get_overview(db, start, end)

@router.get("/revenue")
def get_revenue_report(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db)
):
    start = start_date or (date.today() - timedelta(days=30))
    end = end_date or date.today()
    return ReportsService.get_revenue(db, start, end)

@router.get("/time")
def get_time_report(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db)
):
    start = start_date or (date.today() - timedelta(days=30))
    end = end_date or date.today()
    return ReportsService.get_time(db, start, end)

@router.get("/pipeline")
def get_pipeline_report(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db)
):
    start = start_date or (date.today() - timedelta(days=30))
    end = end_date or date.today()
    return ReportsService.get_pipeline(db, start, end)
```

**Step 2: Register the router in main.py**

In `backend/app/main.py`:
- Line 17: Add `reports` to the import list
- After line 88: Add `app.include_router(reports.router, dependencies=auth_dep)`

**Step 3: Verify routes are registered**

Run: `cd backend && venv/Scripts/python -c "from app.main import app; [print(r.path) for r in app.routes if 'reports' in getattr(r, 'path', '')]"`
Expected: 4 routes printed

**Step 4: Commit**

```bash
git add backend/app/routes/reports.py backend/app/main.py
git commit -m "feat: add report API endpoints"
```

---

### Task 4: Frontend Types and API Client

**Files:**
- Modify: `frontend/src/lib/api.ts` (add reportsApi)

**Step 1: Add report API methods**

Add to `frontend/src/lib/api.ts`:
```typescript
export const reportsApi = {
  getOverview: async (startDate: string, endDate: string) => {
    const res = await api.get('/api/reports/overview', { params: { start_date: startDate, end_date: endDate } });
    return res.data;
  },
  getRevenue: async (startDate: string, endDate: string) => {
    const res = await api.get('/api/reports/revenue', { params: { start_date: startDate, end_date: endDate } });
    return res.data;
  },
  getTime: async (startDate: string, endDate: string) => {
    const res = await api.get('/api/reports/time', { params: { start_date: startDate, end_date: endDate } });
    return res.data;
  },
  getPipeline: async (startDate: string, endDate: string) => {
    const res = await api.get('/api/reports/pipeline', { params: { start_date: startDate, end_date: endDate } });
    return res.data;
  },
};
```

**Step 2: Verify TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: add reports API client methods"
```

---

### Task 5: MetricCard Component

**Files:**
- Create: `frontend/src/components/reports/MetricCard.tsx`

**Step 1: Create the MetricCard component**

A reusable card showing a big number, label, and optional % change indicator. Props: `title: string`, `value: string | number`, `change?: number` (percentage), `icon?: LucideIcon`, `prefix?: string` (e.g. "$"). Uses `cn()` for conditional styling. Green arrow up for positive change, red arrow down for negative.

Follow the card pattern from CLAUDE.md: `bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6`.

**Step 2: Verify TypeScript**

Run: `cd frontend && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add frontend/src/components/reports/MetricCard.tsx
git commit -m "feat: add MetricCard component for reports"
```

---

### Task 6: DateRangePicker Component

**Files:**
- Create: `frontend/src/components/reports/DateRangePicker.tsx`

**Step 1: Create the DateRangePicker component**

Props: `startDate: string`, `endDate: string`, `onChange: (start: string, end: string) => void`.

Renders a row of preset buttons (7d, 30d, 90d, 12mo) plus two date inputs for custom range. Uses the filter pills pattern from CLAUDE.md. Active preset gets the active style (`bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300`).

Preset logic:
- 7d: today - 7 days → today
- 30d: today - 30 days → today
- 90d: today - 90 days → today
- 12mo: today - 365 days → today

Use `format(date, 'yyyy-MM-dd')` from date-fns for date formatting.

**Step 2: Verify TypeScript**

Run: `cd frontend && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add frontend/src/components/reports/DateRangePicker.tsx
git commit -m "feat: add DateRangePicker component for reports"
```

---

### Task 7: OverviewTab Component

**Files:**
- Create: `frontend/src/components/reports/OverviewTab.tsx`

**Step 1: Create OverviewTab**

Props: `startDate: string`, `endDate: string`.

Uses `useQuery` with key `['reports', 'overview', startDate, endDate]` to fetch from `reportsApi.getOverview()`.

Layout:
1. **4 MetricCards in a row** (grid-cols-4): Total Revenue, Hours Logged, Deals Closed, Active Projects
2. **Revenue vs Hours line chart** (full width): Recharts `ComposedChart` with `Area` for revenue (blue) and `Line` for hours (amber). Use `ResponsiveContainer` wrapper. Dual Y-axes.
3. **Top 5 Clients bar chart** (full width): Recharts `BarChart` with horizontal layout (`layout="vertical"`), blue bars.

Loading state: Show skeleton/spinner. Error state: Show error message.

Recharts imports needed: `ResponsiveContainer, ComposedChart, Area, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend`.

Use the executive theme CSS variables for chart colors: `var(--exec-accent)` for primary, `var(--exec-warning)` for secondary.

**Step 2: Verify TypeScript**

Run: `cd frontend && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add frontend/src/components/reports/OverviewTab.tsx
git commit -m "feat: add OverviewTab with metric cards and charts"
```

---

### Task 8: RevenueTab Component

**Files:**
- Create: `frontend/src/components/reports/RevenueTab.tsx`

**Step 1: Create RevenueTab**

Props: `startDate: string`, `endDate: string`.

Uses `useQuery` with key `['reports', 'revenue', startDate, endDate]`.

Layout:
1. **Revenue over time** — `AreaChart` (blue gradient fill)
2. **MRR trend** — `LineChart` (green line)
3. **Two-column row:**
   - Revenue by client — `BarChart` vertical (top 10)
   - Revenue by source — `PieChart` with `Pie` + `Cell` (one-time blue, recurring green)
4. **Two-column row:**
   - Avg deal size trend — `LineChart`
   - Won vs Lost — `BarChart` grouped (green won, red lost)

Wrap each chart in a card container (`bg-white dark:bg-slate-800 rounded-xl shadow-sm border...`) with a title heading.

**Step 2: Verify TypeScript**

Run: `cd frontend && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add frontend/src/components/reports/RevenueTab.tsx
git commit -m "feat: add RevenueTab with revenue charts"
```

---

### Task 9: TimeTab Component

**Files:**
- Create: `frontend/src/components/reports/TimeTab.tsx`

**Step 1: Create TimeTab**

Props: `startDate: string`, `endDate: string`.

Uses `useQuery` with key `['reports', 'time', startDate, endDate]`.

Layout:
1. **3 MetricCards**: Total Hours, Billable Amount, Avg Hours/Day
2. **Hours over time** — `BarChart` (blue bars)
3. **Two-column row:**
   - Billable vs Non-billable — `PieChart` donut (set `innerRadius` prop)
   - Time by category — `PieChart` with different colors per category
4. **Time by project** — `BarChart` horizontal (top 10)

**Step 2: Verify TypeScript**

Run: `cd frontend && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add frontend/src/components/reports/TimeTab.tsx
git commit -m "feat: add TimeTab with time tracking charts"
```

---

### Task 10: PipelineTab Component

**Files:**
- Create: `frontend/src/components/reports/PipelineTab.tsx`

**Step 1: Create PipelineTab**

Props: `startDate: string`, `endDate: string`.

Uses `useQuery` with key `['reports', 'pipeline', startDate, endDate]`.

Layout:
1. **3 MetricCards**: Pipeline Value, Win Rate, Avg Days to Close
2. **Deal funnel** — Custom horizontal funnel using styled divs (not a Recharts chart). Each stage is a bar with width proportional to count. Colors: blue gradient from light to dark.
3. **Two-column row:**
   - Pipeline value over time — `AreaChart`
   - Win rate trend — `LineChart`
4. **Stalled deals table** — Use the table pattern from CLAUDE.md. Columns: Deal Name, Stage, Value, Days Stalled. Sort by days stalled desc.

**Step 2: Verify TypeScript**

Run: `cd frontend && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add frontend/src/components/reports/PipelineTab.tsx
git commit -m "feat: add PipelineTab with pipeline charts and funnel"
```

---

### Task 11: Reports Page and Routing

**Files:**
- Create: `frontend/src/pages/Reports.tsx`
- Modify: `frontend/src/App.tsx` (add lazy import + route)
- Modify: `frontend/src/components/Layout.tsx` (add sidebar entry)

**Step 1: Create the Reports page**

`frontend/src/pages/Reports.tsx`:
- State: `activeTab` (overview/revenue/time/pipeline), `startDate`, `endDate`
- Default dates: 30 days ago → today
- Page header pattern from CLAUDE.md with title "Reports" and `BarChart3` icon
- DateRangePicker below header
- Tab bar: 4 buttons with active/inactive styling (use toggle button pattern from CLAUDE.md)
- Content: conditionally render the active tab component, passing startDate and endDate
- `export default Reports` (for lazy loading)

**Step 2: Add to App.tsx**

- Add lazy import: `const Reports = lazy(() => import('./pages/Reports'));`
- Add route inside the Layout routes: `<Route path="/reports" element={<Reports />} />`

**Step 3: Add to Layout.tsx sidebar**

In `frontend/src/components/Layout.tsx`:
- Import `BarChart3` from lucide-react
- Add `{ name: 'Reports', href: '/reports', icon: BarChart3 }` to the Studio navigation group (after Content)

**Step 4: Verify TypeScript**

Run: `cd frontend && npx tsc -b`
Expected: No errors (use strict `-b` that Render uses)

**Step 5: Commit**

```bash
git add frontend/src/pages/Reports.tsx frontend/src/App.tsx frontend/src/components/Layout.tsx
git commit -m "feat: add Reports page with routing and sidebar entry"
```

---

### Task 12: End-to-End Verification

**Step 1: Start backend**

Run: `cd backend && venv/Scripts/python -m uvicorn app.main:app --reload --port 8001`

**Step 2: Test API endpoints with curl**

```bash
TOKEN=$(curl -s -X POST http://localhost:8001/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}' | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -s "http://localhost:8001/api/reports/overview?start_date=2025-01-01&end_date=2026-02-23" -H "Authorization: Bearer $TOKEN" | python -m json.tool | head -20
curl -s "http://localhost:8001/api/reports/revenue?start_date=2025-01-01&end_date=2026-02-23" -H "Authorization: Bearer $TOKEN" | python -m json.tool | head -20
curl -s "http://localhost:8001/api/reports/time?start_date=2025-01-01&end_date=2026-02-23" -H "Authorization: Bearer $TOKEN" | python -m json.tool | head -20
curl -s "http://localhost:8001/api/reports/pipeline?start_date=2025-01-01&end_date=2026-02-23" -H "Authorization: Bearer $TOKEN" | python -m json.tool | head -20
```

Expected: All return valid JSON with expected shape.

**Step 3: Test frontend in browser**

Navigate to `http://localhost:5173/reports`. Verify:
- [ ] Page loads with "Reports" heading
- [ ] Date range picker visible with 30d active
- [ ] 4 tabs visible (Overview active by default)
- [ ] Metric cards show numbers
- [ ] Charts render with data
- [ ] Switching tabs loads different charts
- [ ] Changing date range refreshes data
- [ ] Dark mode works (all charts readable)

**Step 4: Run strict TypeScript build**

Run: `cd frontend && npx tsc -b`
Expected: 0 errors

**Step 5: Final commit and push**

```bash
git add -A
git commit -m "feat: complete Report Builder with 4 tabs and Recharts visualizations"
git push origin main
```
