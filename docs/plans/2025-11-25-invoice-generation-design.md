# Invoice Generation System Design

## Overview

Add invoice generation from time entries, allowing users to bill clients for time tracked against deals and projects.

## Requirements

- Invoice by **deal** or **project**
- Mark time entries as invoiced (prevent double-billing)
- Full professional invoices: logo, tax/VAT support, multiple currencies
- View in app + download as PDF
- Status tracking: Draft → Sent → Paid
- Business info configured once in settings
- Tax optional per invoice

---

## Data Model

### Invoice

| Field | Type | Description |
|-------|------|-------------|
| id | Integer | Primary key |
| invoice_number | String | Auto-generated (INV-2025-001) |
| status | Enum | DRAFT, SENT, PAID |
| contact_id | FK | Who to bill (required) |
| deal_id | FK | Optional link to deal |
| project_id | FK | Optional link to project |
| issue_date | Date | When invoice was created |
| due_date | Date | Payment due date |
| sent_date | Date | When marked as sent |
| paid_date | Date | When marked as paid |
| currency | String | USD, EUR, GBP, etc. |
| tax_enabled | Boolean | Whether to apply tax |
| tax_rate | Decimal | Tax percentage (e.g., 20.00) |
| tax_label | String | "VAT", "GST", "Tax", etc. |
| notes | Text | Payment instructions, messages |
| subtotal | Decimal | Sum of line items (calculated) |
| tax_amount | Decimal | Tax amount (calculated) |
| total | Decimal | Final total (calculated) |
| created_at | DateTime | Record creation |
| updated_at | DateTime | Last update |

### InvoiceLineItem

| Field | Type | Description |
|-------|------|-------------|
| id | Integer | Primary key |
| invoice_id | FK | Parent invoice |
| description | String | What was done |
| quantity | Decimal | Hours or units |
| unit_price | Decimal | Hourly rate or unit price |
| amount | Decimal | quantity × unit_price |
| time_entry_id | FK | Optional link to time entry |
| sort_order | Integer | Display order |

### BusinessSettings (single row)

| Field | Type | Description |
|-------|------|-------------|
| id | Integer | Primary key (always 1) |
| business_name | String | Company/freelancer name |
| address | Text | Full address |
| email | String | Business email |
| phone | String | Business phone |
| logo_url | String | Logo image URL |
| tax_id | String | VAT number, EIN, etc. |
| default_currency | String | Default currency code |
| default_payment_terms | String | "Net 30", etc. |
| default_tax_rate | Decimal | Default tax % |
| default_tax_label | String | Default tax name |
| invoice_prefix | String | "INV" for INV-2025-001 |
| next_invoice_number | Integer | Counter for invoice numbers |

### TimeEntry Updates

Add to existing TimeEntry model:
- `invoice_id` (FK, nullable) - Links to invoice when billed

---

## User Workflow

### Creating an Invoice

1. Navigate to **Invoices** page (new sidebar item)
2. Click **"New Invoice"**
3. Select **Contact** (client to bill)
4. Optionally select **Deal** or **Project** to filter time entries
5. System shows all **unbilled time entries** for that selection
6. Check which entries to include → auto-populates line items
7. Optionally add **manual line items** (flat fees, expenses)
8. Set due date, toggle tax, add notes
9. Save as **Draft**

### Managing Invoices

- **Draft** - Still editing, can modify line items freely
- **Mark as Sent** - Records sent_date, linked time entries get invoice_id set
- **Mark as Paid** - Records paid_date

### Viewing Time Entries

- Invoiced entries show badge/indicator in Time page
- Filter option: "Unbilled only" to see what can still be billed

### PDF Generation

- "Download PDF" button triggers browser print dialog
- Print-optimized CSS hides UI chrome
- User saves as PDF from print dialog

---

## UI Components

### New Pages

1. **Invoices** (`/invoices`) - List all invoices
2. **Invoice Detail** (`/invoices/:id`) - View/edit invoice
3. **Invoice Settings** (`/settings/invoices`) - Business info

### Invoices List Page

- Header: "Invoices" title + "New Invoice" button
- Filter tabs: All | Draft | Sent | Paid
- Table columns: Invoice #, Client, Amount, Status, Due Date, Actions
- Quick actions: View, Download PDF, Mark Paid

### Invoice Detail/Editor Page

- Header: Invoice number + status badge
- Client selector dropdown
- Deal/Project selector (optional)
- "Import Time Entries" button → modal with unbilled entries
- Line items table with add/remove
- Summary: Subtotal, Tax toggle, Total
- Notes textarea
- Actions: Save Draft | Mark as Sent | Download PDF | Mark as Paid

### Invoice Settings Page

- Business info form
- Logo upload/preview
- Default values (currency, payment terms, tax)
- Invoice numbering prefix

---

## PDF Layout

```
┌─────────────────────────────────────────┐
│  [LOGO]              INVOICE            │
│  Your Business Name      INV-2025-001   │
│  Address, City           Date: Jan 15   │
│  Tax ID: XX-XXXXX        Due: Feb 14    │
├─────────────────────────────────────────┤
│  BILL TO:                               │
│  Client Name                            │
│  Client Company                         │
│  client@email.com                       │
├─────────────────────────────────────────┤
│  Description          Qty   Rate   Amt  │
│  ─────────────────────────────────────  │
│  Website development  10h   $100  $1000 │
│  Design consultation   5h   $100   $500 │
├─────────────────────────────────────────┤
│                      Subtotal:  $1,500  │
│                      Tax (20%):   $300  │
│                      TOTAL:     $1,800  │
├─────────────────────────────────────────┤
│  Payment Terms: Net 30                  │
│  Notes: Thank you for your business!    │
└─────────────────────────────────────────┘
```

---

## API Endpoints

### Invoices

- `GET /api/invoices` - List invoices (with status filter)
- `POST /api/invoices` - Create invoice
- `GET /api/invoices/:id` - Get invoice with line items
- `PUT /api/invoices/:id` - Update invoice
- `DELETE /api/invoices/:id` - Delete invoice (draft only)
- `POST /api/invoices/:id/send` - Mark as sent
- `POST /api/invoices/:id/pay` - Mark as paid

### Time Entries (for invoice creation)

- `GET /api/time/entries/unbilled` - Get unbilled entries
- `GET /api/time/entries/unbilled?contact_id=X` - Filter by contact
- `GET /api/time/entries/unbilled?deal_id=X` - Filter by deal
- `GET /api/time/entries/unbilled?project_id=X` - Filter by project

### Business Settings

- `GET /api/settings/business` - Get business settings
- `PUT /api/settings/business` - Update business settings

---

## Implementation Order

1. **Backend: Models** - Invoice, InvoiceLineItem, BusinessSettings
2. **Backend: Migration** - Add invoice_id to TimeEntry
3. **Backend: API routes** - CRUD for invoices and settings
4. **Frontend: Settings page** - Business info configuration
5. **Frontend: Invoices list** - View all invoices
6. **Frontend: Invoice editor** - Create/edit invoices
7. **Frontend: Time entry import** - Select unbilled entries
8. **Frontend: PDF styles** - Print-optimized stylesheet
9. **Frontend: Sidebar** - Add Invoices link
10. **Testing & polish**
