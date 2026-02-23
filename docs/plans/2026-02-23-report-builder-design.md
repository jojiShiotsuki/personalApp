# Report Builder Design

**Date:** 2026-02-23
**Status:** Approved

## Overview

A comprehensive Report Builder page at `/reports` with 4 pre-built report tabs: Overview, Revenue, Time, and Pipeline. Uses Recharts for visualizations. All aggregation happens server-side via dedicated API endpoints.

## Page Structure

- **Route:** `/reports`
- **Sidebar:** "Reports" entry in Studio section, `BarChart3` icon
- **Header:** "Reports" title + shared date range picker
- **Date Ranges:** Last 7d, 30d, 90d, 12mo, custom (start/end date inputs). Default: 30 days.
- **Tabs:** Overview | Revenue | Time | Pipeline
- **Period Comparison:** Auto-calculated (selected range vs prior equivalent range)
- **Time Bucketing:** By day for ranges < 90 days, by month for >= 90 days

## Tab Contents

### Overview Tab

| Metric | Visualization |
|--------|--------------|
| Total Revenue (period) | Big number + % change vs previous period |
| Hours Logged | Big number + % change |
| Deals Closed | Big number + win rate % |
| Active Projects | Count |
| Revenue vs Hours (daily) | Dual-axis line chart |
| Top 5 Clients by Revenue | Horizontal bar chart |

### Revenue Tab

| Metric | Visualization |
|--------|--------------|
| Revenue over time | Area chart (monthly/weekly) |
| MRR trend | Line chart |
| Revenue by client | Horizontal bar chart (top 10) |
| Revenue by source | Pie/donut chart (one-time vs recurring) |
| Average deal size trend | Line chart |
| Deals won vs lost | Grouped bar chart by period |

### Time Tab

| Metric | Visualization |
|--------|--------------|
| Hours logged over time | Bar chart (daily/weekly) |
| Billable vs non-billable split | Donut chart + trend line |
| Time by project | Horizontal bar chart (top 10) |
| Time by category | Pie chart |
| Billable amount earned | Big number + area chart |
| Avg hours per day | Line chart with trend |

### Pipeline Tab

| Metric | Visualization |
|--------|--------------|
| Deal funnel | Horizontal funnel visualization |
| Pipeline value over time | Area chart |
| Win rate trend | Line chart (monthly) |
| Avg days to close | Big number + trend |
| Deals by stage | Stacked bar chart |
| Stalled deals | Table (deals with no activity >14 days) |

## Backend API

All endpoints under `GET /api/reports/`, accepting `start_date` and `end_date` query params.

### `GET /api/reports/overview`

```json
{
  "total_revenue": 5400,
  "revenue_change_pct": 12.5,
  "hours_logged": 142.5,
  "hours_change_pct": -3.2,
  "deals_closed": 4,
  "win_rate": 66.7,
  "active_projects": 3,
  "revenue_by_day": [{"date": "2026-02-01", "revenue": 200, "hours": 6.5}],
  "top_clients": [{"name": "Acme", "revenue": 2400}]
}
```

### `GET /api/reports/revenue`

Returns: revenue time series, MRR trend, revenue by client, by source (one-time vs recurring), avg deal size trend, won vs lost counts by period.

### `GET /api/reports/time`

Returns: hours by day/week, billable vs non-billable totals + trend, time by project, by category, billable amount, avg hours/day.

### `GET /api/reports/pipeline`

Returns: funnel counts per stage, pipeline value trend, win rate trend, avg days to close, deals by stage over time, stalled deals list.

## Tech Stack

- **Frontend:** React + Recharts (new dependency) + TailwindCSS
- **Backend:** FastAPI endpoints with SQLAlchemy aggregation queries
- **State:** TanStack Query with `['reports', tab, startDate, endDate]` cache keys

## File Structure

```
backend/app/routes/reports.py       # 4 report endpoints
backend/app/services/reports.py     # Aggregation logic
frontend/src/pages/Reports.tsx      # Main page with tabs
frontend/src/components/reports/    # Tab components
  OverviewTab.tsx
  RevenueTab.tsx
  TimeTab.tsx
  PipelineTab.tsx
  MetricCard.tsx                    # Reusable big-number card
  DateRangePicker.tsx               # Shared date range control
```
