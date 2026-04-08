# Outreach Hub — Design System Master

> **Source of truth for all visual design across `frontend/src/components/outreach/`** and `frontend/src/pages/OutreachHub.tsx`.
>
> When building or modifying any Outreach Hub component, the rules below are binding. If you find a component that violates them, fix the component — don't fork the rules.
>
> **Hierarchical override:** if a file exists at `design-system/vertex-outreach-hub/pages/<page-name>.md`, its rules override this Master file for that page only. Otherwise, this file is the canonical reference.

---

**Project:** Vertex CRM — Outreach Hub
**Scope:** `frontend/src/pages/OutreachHub.tsx` + everything in `frontend/src/components/outreach/`
**Phase:** 2 — design system spec (awaiting approval before implementation)
**Generated:** 2026-04-08 (Phase 2 of standardization initiative; supersedes the auto-generated baseline at this same path)
**Authoritative reference implementations:**
- `frontend/src/components/ContactModal.tsx` (canonical Standard Modal)
- `frontend/src/components/outreach/CallProspectDetailModal.tsx` (canonical Standard Modal — Outreach variant)
- `frontend/src/components/outreach/AddColdLeadModal.tsx` (canonical Standard Modal — Outreach variant)
- `frontend/src/components/outreach/ColdCallCsvImportModal.tsx` (canonical Large Modal)
- `frontend/src/components/outreach/ManageOutreachTemplatesModal.tsx` (canonical Large Modal)
- `frontend/src/components/outreach/SendDMPanel.tsx` (canonical Side Panel)
- `frontend/src/components/outreach/BulkGenerateBar.tsx` (canonical Floating Action Bar)
- `frontend/src/components/outreach/ColdCallsTab.tsx` (canonical Pipeline / Kanban)

---

## 0. Cheat Sheet (read this first)

| What | Use this | Never use |
|---|---|---|
| Page background (Outreach Hub only) | `bg-[--exec-bg]` (or omit — inherited) | `bg-gray-*`, `bg-slate-*` |
| Card / modal surface | `bg-[--exec-surface]` | `bg-white`, `bg-slate-800` |
| Subsurface (input bg, nested cards) | `bg-stone-800/50` | `bg-gray-700`, `bg-slate-700` |
| Primary text | `text-[--exec-text]` | `text-white`, `text-gray-900` |
| Secondary text / labels | `text-[--exec-text-secondary]` | `text-gray-600`, `text-slate-300` |
| Muted text / placeholders / icons | `text-[--exec-text-muted]` | `text-gray-400`, `text-slate-400` |
| Primary button background | `bg-[--exec-accent]` + `hover:bg-[--exec-accent-dark]` | `bg-blue-600`, `bg-[#E07A5F]`, inline `style={{backgroundColor:'var(--exec-accent)'}}` |
| Structural border (modals, inputs, cards) | `border-stone-600/40` | any other stone opacity |
| Section divider inside a modal | `border-stone-700/30` | any other stone opacity |
| Modal container radius | `rounded-2xl` | `rounded-xl`, `rounded-3xl` |
| Card / tab / kanban radius | `rounded-xl` | `rounded-lg`, `rounded-2xl` |
| Input / button radius | `rounded-lg` | `rounded-xl`, `rounded-md` |
| Pill badge radius | `rounded-full` | `rounded-md`, `rounded-lg` |
| Hover affordance on primary buttons | `hover:bg-[--exec-accent-dark]` (or `hover:brightness-110` if no dark variant) | `hover:scale-*`, `active:scale-*`, `hover:translate-*` |
| `dark:` prefix in any Outreach Hub file | **Never** — the app is forced dark via `ThemeProvider` | `dark:bg-*`, `dark:text-*` |

---

## 1. Theme System Rule (binding)

The entire CRM runs in **forced dark mode** — see `frontend/src/components/ThemeProvider.tsx` (`root.classList.add("dark")` is unconditional). This means:

- **Use `--exec-*` variables freely** for text and accent colors. They auto-resolve to dark-mode values defined in `frontend/src/index.css` (lines 64–84).
- **Never add `dark:` prefixes** in Outreach Hub files. The light branch never renders, and adding them is dead-code noise that misleads future devs.
- **Use hardcoded `stone-*` Tailwind classes** for background subsurfaces (`bg-stone-800/50`, `bg-stone-900`, etc.). The exec `--exec-surface` token is `#292524` in dark, which is also fine for top-level surfaces, but the stone scale gives finer control for nested layers.
- **Outreach Hub is dark-only by design.** Other CRM areas (Contacts, Tasks, Dashboard) historically used `bg-white dark:bg-slate-800` light/dark pairs — those are now dead light branches under the forced-dark ThemeProvider, but they're outside this spec's scope. **Do not import that pattern into Outreach Hub.**

---

## 2. Color Tokens

### 2.1 Exec theme variables (defined in `frontend/src/index.css:64-84`)

| Token | Dark-mode value | Use for |
|---|---|---|
| `--exec-bg` | `#1C1917` | Page background (rarely needed — set on `<body>`) |
| `--exec-surface` | `#292524` | Modal containers, cards, raised surfaces |
| `--exec-surface-alt` | `#292524` | Hover backgrounds, info chips |
| `--exec-surface-warm` | `#1C1917` | Same as bg, used by some components |
| `--exec-text` | `#FAFAF9` | Primary text, headings |
| `--exec-text-secondary` | `#D6D3D1` | Body text, labels |
| `--exec-text-muted` | `#78716C` | Placeholders, icons, helper text |
| `--exec-accent` | `#E07A5F` | **Primary CTA color** — buttons, links, focus rings |
| `--exec-accent-dark` | `#C65D42` | Primary button hover state |
| `--exec-accent-light` | `#F2A391` | Gradient stop, inactive accent variants (rare) |
| `--exec-accent-bg` | `rgba(224, 122, 95, 0.12)` | Accent badges, drag-drop highlights |
| `--exec-accent-bg-subtle` | `rgba(224, 122, 95, 0.06)` | Very subtle accent washes |
| `--exec-sage` | `#81A88D` | Secondary accent (sage green) — currently used in OutreachHub hero decoration |
| `--exec-warning` | `#D4915D` | Warning text (used in CSV import warnings) |
| `--exec-warning-bg` | `rgba(212, 145, 93, 0.12)` | Warning callout backgrounds |
| `--exec-info` | `#5B8FA8` | Info text (used in CSV import info banners) |
| `--exec-info-bg` | `rgba(91, 143, 168, 0.12)` | Info callout backgrounds |

### 2.2 Stone subsurface scale (Tailwind hardcoded)

| Token | Use for |
|---|---|
| `bg-stone-900` | Floating action bars, opaque overlays |
| `bg-stone-800/50` | Input field backgrounds, subtle nested surfaces |
| `bg-stone-800/30` | Heavily nested cards (groups inside a modal) |
| `bg-stone-800/60` | Vertical chips on cards |
| `bg-stone-700/50` | Hover background for icon-only buttons |

### 2.3 Status colors (single-style rule)

**All status badges use:** `bg-{color}-500/20 text-{color}-400`

| Color | Use for |
|---|---|
| `blue` | "New" / informational state |
| `amber` / `yellow` | "Attempted" / warning / pending |
| `emerald` / `green` | "Connected" / success / completed |
| `rose` / `red` | "Dead" / error / failed |
| `purple` | Goals, special states |
| `gray` | Neutral, low priority |

**Forbidden (must be migrated):** `bg-{color}-50 dark:bg-{color}-900/20 text-{color}-700 dark:text-{color}-300 border-{color}-200 dark:border-{color}-800` — this slate-pair form appears in `ColdCallsTab.tsx:25-50` and must be replaced. The `dark:` branch is the only one that renders, but it's verbose and inconsistent with WarmLeads.

---

## 3. Typography

**Fonts** (defined in `frontend/src/index.css:11-12`, already imported globally):

- `var(--font-sans)` → `Outfit` — body text, default
- `var(--font-display)` → `Fraunces` (serif) — large display headings only

**Scale** (use existing Tailwind classes; do not introduce custom sizes):

| Class | Use for |
|---|---|
| `text-4xl font-bold tracking-tight` + `style={{ fontFamily: 'var(--font-display)' }}` | Hero h1 (e.g., "Outreach Hub") — display only |
| `text-xl font-semibold` | Modal titles, section headers |
| `text-lg font-semibold` | Card titles, sub-section headings |
| `text-base font-semibold` | Card titles in cramped spaces |
| `text-sm font-medium` | Labels, button text, badge text |
| `text-sm` | Body text, descriptions |
| `text-xs` | Helper text, captions, metadata |
| `text-[10px]` | Ultra-small chips (use sparingly) |
| `font-mono` | Phone numbers, code, technical data |

---

## 4. Spacing & Layout

### 4.1 Padding scale

| Context | Padding |
|---|---|
| Modal outer wrapper | `p-6` (Standard Modal) |
| Modal large outer | `p-6 pb-0` header / `px-6` content / `px-6 py-4` footer (Large Modal) |
| Card | `p-4` (kanban card) or `p-5` / `p-6` (general card) |
| Page section | `px-8 py-6` (Outreach Hub tabs) |
| Button (primary/secondary) | `px-4 py-2` |
| Button (small / chip) | `px-3 py-1.5` |
| Input field | `px-4 py-2.5` |
| Icon-only button | `p-1.5` |
| Badge / pill | `px-2.5 py-1` (standard), `px-2 py-0.5` (compact) |

### 4.2 Gap scale

`gap-2` (tight) · `gap-3` (standard) · `gap-4` (sections) · `gap-6` (wide)

### 4.3 Border opacity rule (binding — only two values)

| Token | Role | Examples |
|---|---|---|
| `border-stone-600/40` | **Structural** — modal containers, inputs, primary surface borders, top-level cards | Modal `border border-stone-600/40`, input `border border-stone-600/40` |
| `border-stone-700/30` | **Subtle dividers** — section separators inside modals, inner card borders, nested grouping | `pt-4 border-t border-stone-700/30` |

**Forbidden:** `border-stone-700/40` (currently in `OutreachHub.tsx` search input + `MultiTouchCampaignsTab.tsx` filter inputs — must migrate to `/600/40` for inputs).

`border-stone-700/50` is acceptable **only** as the `hover:bg-stone-700/50` background for icon-only buttons. Not for borders.

### 4.4 Border radius scale (binding — exactly four values, no `rounded-md`)

| Token | Pixel value | Use for |
|---|---|---|
| `rounded-lg` | 8px | Inputs, buttons, small badges, icon-button backgrounds |
| `rounded-xl` | 12px | Cards, kanban columns, tabs, dropdowns, icon-chip headers |
| `rounded-2xl` | 16px | Modal containers, floating action bars |
| `rounded-full` | 9999px | Pill badges, count chips, breadcrumb chips, avatars |

**Forbidden:** `rounded-md` (currently in `MultiTouchCampaignsTab.tsx:1583` step editor — must migrate).

---

## 5. Modal Patterns

There are **two** canonical modal layouts. Both are valid and complementary — neither replaces the other.

### 5.1 Pattern A — Standard Form Modal (`max-w-lg`)

**When to use:** add/edit forms with up to ~10 fields, single concern, no internal scrolling beyond `max-h-[90vh]`, all content fits without sticky header/footer behavior.

**Reference implementations:**
- `ContactModal.tsx` (whole-app canonical)
- `AddColdLeadModal.tsx` (Outreach canonical — pure clone)
- `CallProspectDetailModal.tsx` (Outreach canonical — pure clone with delete on left)

**Structure:**

```tsx
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { inputClasses } from '@/lib/outreachStyles'; // see §11

interface MyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MyModal({ isOpen, onClose }: MyModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-lg mx-4 border border-stone-600/40 transform transition-all animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header — title + subtitle + close. NO border-b. */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold text-[--exec-text]">Modal Title</h2>
              <p className="text-sm text-[--exec-text-muted] mt-1">Optional subtitle</p>
            </div>
            <button
              onClick={onClose}
              className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form — space-y-4 between fields */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Field Label <span className="text-red-400">*</span>
              </label>
              <input className={inputClasses} {...} />
            </div>

            {/* Section grouping (optional) */}
            <div className="pt-4 border-t border-stone-700/30">
              <h3 className="text-sm font-semibold text-[--exec-text] mb-3">
                Section Title
              </h3>
              {/* …grouped fields */}
            </div>

            {/* Footer — inside the form, with border-t */}
            <div className="flex gap-3 justify-end pt-4 border-t border-stone-700/30 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-[--exec-accent] rounded-lg hover:bg-[--exec-accent-dark] shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
```

**Required tokens (every Standard Modal must have all of these):**
- `fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200` (backdrop)
- `bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-lg mx-4 border border-stone-600/40 transform transition-all animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto` (container)
- `transform` token is **mandatory** — it creates a stacking context and helps `zoom-in-95` animation perform smoothly
- Single `p-6` wrapper (NO separate header/body/footer divs with their own padding)
- `createPortal(..., document.body)` (escapes parent transforms — `OutreachHub.tsx`'s `animate-fade-slide-up` wrapper creates a containing block that breaks fixed positioning)

### 5.2 Pattern B — Large / Multi-step Modal (`max-w-2xl`)

**When to use:** content needs internal scrolling with sticky header and sticky footer; multi-step wizards; list-management or settings modals; anything that can't fit comfortably in `max-h-[90vh]` with a single `p-6`.

**Reference implementations:**
- `ColdCallCsvImportModal.tsx` (3-step CSV import wizard)
- `ManageOutreachTemplatesModal.tsx` (template list editor)

**Structure:**

```tsx
return createPortal(
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
    <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col border border-stone-600/40 transform transition-all animate-in zoom-in-95 duration-200">
      {/* Header — sticky top, no internal border between header and content */}
      <div className="p-6 pb-0">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {/* Optional icon chip */}
            <div className="w-10 h-10 rounded-xl bg-[--exec-accent-bg] flex items-center justify-center">
              <Icon className="w-5 h-5 text-[--exec-accent]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[--exec-text]">Title</h2>
              <p className="text-sm text-[--exec-text-muted] mt-1">Subtitle</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Optional: step indicators or sub-nav (canonical pattern from CSV import) */}
        {/* …step pills here */}
      </div>

      {/* Content — scrollable middle */}
      <div className="flex-1 overflow-auto px-6">
        {/* …main content */}
      </div>

      {/* Footer — sticky bottom, separated from content with a border */}
      <div className="flex items-center justify-between px-6 py-4 mt-4 border-t border-stone-700/30">
        <div>{/* Optional: "Back" or secondary action on the left */}</div>
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} className="px-4 py-2 text-sm font-medium text-white bg-[--exec-accent] rounded-lg hover:bg-[--exec-accent-dark] shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            Continue
          </button>
        </div>
      </div>
    </div>
  </div>,
  document.body
);
```

**Required tokens:**
- Same backdrop as Standard Modal
- Container: `max-w-2xl mx-4 max-h-[85vh] flex flex-col` (note: `85vh` not `90vh` — gives breathing room for sticky header/footer)
- **`transform` token is mandatory** (same reason as Pattern A)
- `flex flex-col` is **mandatory** — enables the sticky header / scrolling content / sticky footer layout
- Header: `p-6 pb-0` (note `pb-0` — bottom spacing comes from the inner `mb-6`)
- Content: `flex-1 overflow-auto px-6` (the `flex-1` and `overflow-auto` together make scrolling work)
- Footer: `px-6 py-4 mt-4 border-t border-stone-700/30` (the `mt-4` provides breathing room between content and footer)

### 5.3 Decision Rule — When to use Pattern A vs Pattern B

This is the question that always trips up the next dev. Use this flowchart:

```
┌─────────────────────────────────────────────────────────────────┐
│ Does the modal have internal sub-navigation                     │
│ (steps, tabs, nested lists, multi-page wizards)?                │
└──────────────┬──────────────────────────────────────────────────┘
               │
        ┌──────┴──────┐
        │             │
       YES            NO
        │             │
        ▼             ▼
   ┌────────┐    ┌────────────────────────────────────────────┐
   │Pattern │    │ Will the content reliably exceed 90vh on   │
   │   B    │    │ a 768px-tall window?                       │
   │ Large  │    └──────────────┬─────────────────────────────┘
   └────────┘                   │
                          ┌─────┴─────┐
                          │           │
                         YES          NO
                          │           │
                          ▼           ▼
                    ┌────────┐   ┌────────┐
                    │Pattern │   │Pattern │
                    │   B    │   │   A    │
                    │ Large  │   │Standard│
                    └────────┘   └────────┘
```

**Concrete examples:**
- "Edit a contact" → Pattern A (≤10 fields, fits)
- "Add a cold call lead" → Pattern A (8 fields, fits)
- "Edit a prospect" → Pattern A
- "View prospect details + edit notes" → Pattern A
- "Import CSV (upload → map columns → preview)" → Pattern B (3 steps = sub-navigation)
- "Manage outreach templates" → Pattern B (could have 50+ templates → reliable scroll)
- "Bulk generate confirmation" → Pattern A (single action, small)
- "Schedule editor with multiple sub-tools" → Pattern B

**Both patterns share these rules:**
- Same backdrop (`bg-black/50 backdrop-blur-sm` + `animate-in fade-in duration-200`)
- Same container border (`border border-stone-600/40`)
- Same container radius (`rounded-2xl`)
- Same `transform transition-all animate-in zoom-in-95 duration-200`
- Same primary button (`bg-[--exec-accent] hover:bg-[--exec-accent-dark]`)
- Same Cancel button (`bg-stone-700/50 hover:bg-stone-600/50`)
- Same divider (`border-stone-700/30`)
- Same close button (`text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg`)

The differences are only in the wrapper structure: Pattern A is single `p-6`, Pattern B is split header/content/footer.

### 5.4 Anti-patterns inside modals

- ❌ `dark:bg-*` or `dark:text-*` (the app is forced dark — these branches never render)
- ❌ Inline `style={{ backgroundColor: 'var(--exec-accent)' }}` for primary buttons (use the Tailwind class form)
- ❌ Hardcoded hex `bg-[#E07A5F]` (use the variable)
- ❌ `hover:scale-*` or `active:scale-*` on any button (see §10)
- ❌ Border opacities other than `/40` (structural) and `/30` (subtle)
- ❌ `rounded-md` (out of scale)
- ❌ Missing `transform` token on container
- ❌ Missing `createPortal` (will be clipped by `OutreachHub.tsx`'s tab-content `animate-fade-slide-up` wrapper)
- ❌ Missing `animate-in fade-in duration-200` on backdrop (some inline modals omit this — fix in Phase 3)

---

## 6. Side Panel Pattern (slide-in from right)

**When to use:** tool/utility panels that should keep the underlying page partially visible (template selectors, action panels, contextual editors). The user can see what they're working on through the dimmed backdrop.

**Reference implementation:** `SendDMPanel.tsx`

**Structure:**

```tsx
return (
  <>
    {/* Backdrop — z-40 (lower than panel) */}
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-in fade-in duration-200"
      onClick={onClose}
    />

    {/* Panel — slides from right edge */}
    <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-[--exec-surface] border-l border-stone-600/40 shadow-2xl z-50 animate-in slide-in-from-right duration-300 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-stone-600/40">
        <div>
          <h2 className="text-lg font-bold text-[--exec-text]">Panel Title</h2>
          <p className="text-sm text-[--exec-text-muted]">Subtitle / context</p>
        </div>
        <button onClick={onClose} className="p-2 text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-stone-700/50 rounded-lg transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content — scrollable middle */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* …main content with inputs (use canonical inputClasses, see §11) */}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-stone-600/40 space-y-3">
        {/* …actions */}
      </div>
    </div>
  </>
);
```

**Notes:**
- Header and footer borders use `border-stone-600/40` (structural — they separate the panel into 3 zones, not section dividers within content).
- Inputs inside the panel **must** use the canonical `inputClasses` (`px-4 py-2.5 rounded-lg`) — `SendDMPanel` currently uses `px-4 py-3 rounded-xl` which violates the spec and must migrate.

**Documented exception:** `SendDMPanel` uses **custom button-based dropdowns** instead of native `<select>` because it needs grouped options + search affordance. This UX cannot be replicated with native select. **Keep the custom dropdowns** — do not "fix" them to use `<select>`. (See §13.)

---

## 7. Floating Action Bar Pattern

**When to use:** ephemeral multi-select bulk actions, "selection mode" CTAs that appear when items are selected and disappear when the selection is cleared. The bar is always pinned to the bottom-center, above the page content.

**Reference implementation:** `BulkGenerateBar.tsx`

**Structure:**

```tsx
if (selectedCount === 0) return null;

return (
  <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-4 px-6 py-3 bg-stone-900 border border-stone-600/40 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
    <span className="text-sm font-medium text-[--exec-text-secondary]">
      {selectedCount} selected
    </span>

    <button
      onClick={onAction}
      disabled={isProcessing}
      className="px-4 py-2 text-sm font-medium text-white bg-[--exec-accent] hover:bg-[--exec-accent-dark] rounded-lg shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isProcessing ? 'Processing...' : 'Action'}
    </button>

    <button
      onClick={onClear}
      className="p-1.5 text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-stone-700/50 rounded-lg transition-colors"
    >
      <X className="w-4 h-4" />
    </button>
  </div>
);
```

**Notes:**
- Background is **solid `bg-stone-900`** (not translucent) — the bar must be fully readable against any underlying content.
- Container radius is `rounded-2xl` (matches modal containers — floating elements use the larger radius to feel "bigger").
- Z-index is `z-[100]` — must be above modals (`z-50`) so it remains visible if a modal opens behind it.
- Animation: `slide-in-from-bottom-4 duration-300` (slightly slower than modal entry to feel more deliberate).

---

## 8. Pipeline / Kanban Pattern

**When to use:** drag-and-drop pipelines with status columns. Currently the only instance is the Cold Calls tab.

**Reference implementation:** `ColdCallsTab.tsx`

**Column structure:**

```tsx
<div className="flex flex-col min-w-[300px] w-[320px] flex-shrink-0 h-full max-h-full">
  {/* Column header chip — uses status badge style */}
  <div className="px-3 py-3 flex-shrink-0">
    <div className="flex items-center justify-between px-3 py-2 rounded-lg border bg-blue-500/20 text-blue-400 border-blue-500/30">
      <h2 className="text-sm font-medium tracking-tight">Column Label</h2>
      <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full font-semibold">
        {count}
      </span>
    </div>
  </div>

  {/* Drop zone */}
  <Droppable droppableId={status}>
    {(provided, snapshot) => (
      <div
        ref={provided.innerRef}
        {...provided.droppableProps}
        className={cn(
          'flex-1 px-3 pb-3 overflow-y-auto transition-colors duration-200',
          '[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full',
          '[&::-webkit-scrollbar-thumb]:bg-stone-600 [&::-webkit-scrollbar-track]:bg-transparent',
          snapshot.isDraggingOver && 'bg-[--exec-accent]/10 rounded-lg'
        )}
      >
        <div className="space-y-3">
          {/* …cards */}
        </div>
        {empty && <EmptyState />}
      </div>
    )}
  </Droppable>
</div>
```

**Card structure:**

```tsx
<div
  ref={provided.innerRef}
  {...provided.draggableProps}
  {...provided.dragHandleProps}
  onClick={() => onClick(item)}
  className={cn(
    'bg-[--exec-surface] rounded-xl shadow-sm border border-stone-600/40 p-4',
    'cursor-pointer transition-all duration-150',
    'hover:border-[--exec-accent]/60 hover:shadow-md',
    snapshot.isDragging && 'ring-2 ring-[--exec-accent]/60 shadow-lg'
  )}
>
  {/* …card content */}
</div>
```

**Required tokens:**
- Card: `bg-[--exec-surface] rounded-xl shadow-sm border border-stone-600/40 p-4`
- Card hover: `hover:border-[--exec-accent]/60 hover:shadow-md` — **no scale, no translate**
- Card drag: `ring-2 ring-[--exec-accent]/60 shadow-lg`
- Drop zone hover: `bg-[--exec-accent]/10 rounded-lg`
- Card transition: `transition-all duration-150` (slightly faster than the standard 200ms because cards are interactive and benefit from snappier feedback)
- **Use `createPortal(content, document.body)` when dragging** — same reason as modals (parent `animate-fade-slide-up` transform breaks fixed positioning of dnd clones)

**Migration note:** `ColdCallsTab.tsx:25-50` currently uses the slate-pair status badge form (`bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800`). Phase 3 must migrate this to the canonical `bg-{color}-500/20 text-{color}-400 border-{color}-500/30` form.

---

## 9. Buttons

### 9.1 Primary button (canonical)

```tsx
<button
  onClick={onAction}
  disabled={isLoading}
  className="px-4 py-2 text-sm font-medium text-white bg-[--exec-accent] rounded-lg hover:bg-[--exec-accent-dark] shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
>
  {isLoading ? 'Saving...' : 'Save Changes'}
</button>
```

**Required tokens:**
- `bg-[--exec-accent]` — Tailwind arbitrary value form. **Never** inline `style={{}}`. **Never** hardcoded `#E07A5F`.
- `hover:bg-[--exec-accent-dark]` — uses the dark accent variant. **Never** `hover:scale-*`.
- `rounded-lg` (8px)
- `text-sm font-medium text-white`
- `px-4 py-2`
- `shadow-sm hover:shadow-md` (subtle elevation lift on hover)
- `transition-all` (no explicit duration — Tailwind defaults to 150ms which is correct for buttons)
- `disabled:opacity-50 disabled:cursor-not-allowed`

### 9.2 Secondary / Cancel button

```tsx
<button
  type="button"
  onClick={onCancel}
  className="px-4 py-2 text-sm font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors"
>
  Cancel
</button>
```

### 9.3 Ghost / outline button

```tsx
<button
  onClick={onAction}
  className="px-4 py-2 text-sm font-medium text-[--exec-text-secondary] border border-stone-600/40 rounded-lg hover:bg-stone-700/50 hover:text-[--exec-text] transition-all"
>
  Ghost Action
</button>
```

### 9.4 Icon-only button

```tsx
<button
  onClick={onAction}
  aria-label="Description of action"
  className="p-1.5 text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-stone-700/50 rounded-lg transition-colors"
>
  <Icon className="w-4 h-4" />
</button>
```

**`aria-label` is mandatory for icon-only buttons** (no visible text).

### 9.5 Danger icon button

```tsx
<button
  onClick={onDelete}
  aria-label="Delete"
  className="p-1.5 text-[--exec-text-muted] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
>
  <Trash2 className="w-4 h-4" />
</button>
```

### 9.6 Documented exception — `ColdCallCsvImportModal` Import button

The "Import N Prospects" button at the end of the CSV import wizard uses `bg-green-600 hover:bg-green-500` instead of `bg-[--exec-accent]`. **This is an intentional exception** approved in Phase 1 review:

> **Rationale:** "Continue" (next step, reversible) and "Import" (commit, destructive) need visual differentiation. Green-coded "Import" affordance prevents users from confusing "advance to next step" with "actually write rows to the database."

This exception is **scoped to the final commit-action button in multi-step write wizards**. Do not generalize it. Standard form modal save buttons stay on `bg-[--exec-accent]`. If you find yourself wanting `bg-green-*` for a primary button outside this narrow case, ask in PR review first.

### 9.7 Anti-patterns

- ❌ `hover:scale-105` or `hover:scale-*` — see §10
- ❌ `active:scale-95` or `active:scale-*` — see §10
- ❌ Inline `style={{ backgroundColor: 'var(--exec-accent)' }}` — use Tailwind arbitrary value
- ❌ Hardcoded hex `#E07A5F` — use the variable
- ❌ `bg-blue-600`, `bg-purple-600`, etc. for primary buttons — use `--exec-accent`
- ❌ Gradient backgrounds (`bg-gradient-to-r from-* to-*`) — flat color only
- ❌ Icon-only button without `aria-label`

---

## 10. Animation Rules (binding)

### 10.1 Allowed motion

| Motion | Use |
|---|---|
| `transition-colors duration-200` | Hover color changes (text/bg only) |
| `transition-all duration-200` | Multi-property hover (color + shadow + border) |
| `transition-all duration-150` | Snappier transitions for interactive cards (drag-and-drop) |
| `animate-in fade-in duration-200` | Modal/panel backdrop entry |
| `animate-in zoom-in-95 duration-200` | Modal container entry |
| `animate-in slide-in-from-right duration-300` | Side panel entry |
| `animate-in slide-in-from-bottom-4 duration-300` | Floating action bar entry |
| `animate-fade-slide-up` (existing keyframe) | Hero section reveal on page load |
| `hover:bg-[--exec-accent-dark]` | Primary button hover (preferred — uses defined token) |
| `hover:brightness-110` | Primary button hover **fallback** (only when no dark variant exists) |
| `hover:shadow-md` | Subtle elevation lift on cards/buttons |
| `hover:border-[--exec-accent]/60` | Card hover affordance |

### 10.2 Forbidden motion

| Motion | Why forbidden |
|---|---|
| `hover:scale-*` (any axis or amount) | **Full ban** — reference user feedback: "no gradients, no transforms, motion stays subtle." Scale transforms create cumulative motion noise across the dashboard and break the "calm dashboard, loud action" feel. |
| `active:scale-*` | Same reason. The press animation is implicit in the color change. |
| `hover:translate-*` | Causes layout-shift adjacent elements. |
| `hover:rotate-*` | Same. (Exception: the `Plus` icon `group-hover:rotate-90` on the global "+ Add" button on Tasks page is a separate decision and is NOT an Outreach pattern. Don't import it.) |
| Animation duration > 300ms | Feels sluggish. |
| Animation duration < 100ms | Feels jittery. |
| Custom keyframes per-component | Use Tailwind's `animate-in` family. |

**This ban is binding for every button in `components/outreach/` — primary, secondary, ghost, icon-only, all of them.** Phase 3 will sweep 27 sites across LinkedIn (18) and MultiTouch (9) to remove `hover:scale-105 active:scale-95`.

---

## 11. Form Inputs & the Shared Style Module

### 11.1 The shared module (Phase 3 batch 1)

**Create `frontend/src/lib/outreachStyles.ts`** with the canonical input classes lifted out of every modal:

```typescript
// frontend/src/lib/outreachStyles.ts
import { cn } from '@/lib/utils';

/**
 * Canonical input field classes for all Outreach Hub form inputs.
 * Use this for: <input>, <textarea>, <select>.
 *
 * For textareas, append 'resize-none' via cn():
 *   <textarea className={cn(inputClasses, 'resize-none')} />
 *
 * For selects with custom appearance, append 'cursor-pointer appearance-none':
 *   <select className={cn(inputClasses, 'cursor-pointer appearance-none')} />
 */
export const inputClasses = cn(
  'w-full px-4 py-2.5 rounded-lg',
  'bg-stone-800/50 border border-stone-600/40',
  'text-[--exec-text] placeholder:text-[--exec-text-muted]',
  'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
  'transition-all text-sm'
);

/**
 * Variant for slightly tighter selects in dense lists (e.g., CSV column mapping).
 */
export const selectClassesCompact = cn(
  'w-full px-3 py-2 rounded-lg',
  'bg-stone-800/50 border border-stone-600/40',
  'text-[--exec-text] text-sm',
  'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
  'transition-all cursor-pointer'
);

/**
 * Canonical primary button classes — use this directly or compose with cn().
 */
export const primaryButtonClasses = cn(
  'px-4 py-2 text-sm font-medium text-white',
  'bg-[--exec-accent] rounded-lg',
  'hover:bg-[--exec-accent-dark] shadow-sm hover:shadow-md',
  'transition-all',
  'disabled:opacity-50 disabled:cursor-not-allowed'
);

/**
 * Canonical secondary/cancel button classes.
 */
export const secondaryButtonClasses = cn(
  'px-4 py-2 text-sm font-medium text-[--exec-text-secondary]',
  'bg-stone-700/50 rounded-lg',
  'hover:bg-stone-600/50 transition-colors'
);

/**
 * Canonical icon-only button classes.
 */
export const iconButtonClasses = cn(
  'p-1.5 text-[--exec-text-muted]',
  'hover:text-[--exec-text] hover:bg-stone-700/50',
  'rounded-lg transition-colors'
);
```

**Why scoped to outreach (`outreachStyles.ts`) instead of app-wide (`styles.ts`):** YAGNI. Promotion later is cheap; premature abstraction is expensive. When a second area of the app (e.g., the Contacts page) actually needs the same constants, we promote them at that point — not before.

### 11.2 Usage in components

```tsx
import { inputClasses, primaryButtonClasses, secondaryButtonClasses } from '@/lib/outreachStyles';

// Instead of redefining inputClasses inline in every modal, just import it:
<input type="text" className={inputClasses} {...} />
<textarea className={cn(inputClasses, 'resize-none')} rows={3} {...} />
<select className={cn(inputClasses, 'cursor-pointer appearance-none')}>...</select>

<button type="submit" className={primaryButtonClasses}>Save</button>
<button type="button" className={secondaryButtonClasses}>Cancel</button>
```

### 11.3 Form labels

```tsx
<label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
  Label Text <span className="text-red-400">*</span>
</label>
```

### 11.4 Inline error message

```tsx
<input className={cn(inputClasses, hasError && 'border-red-500/60 focus:ring-red-500/20 focus:border-red-500/60')} {...} />
{error && (
  <p className="mt-1.5 text-xs text-red-400">{error}</p>
)}
```

### 11.5 Section heading inside a modal

```tsx
<div className="pt-4 border-t border-stone-700/30">
  <h3 className="text-sm font-semibold text-[--exec-text] mb-3 flex items-center">
    <Icon className="w-4 h-4 mr-2 text-[--exec-accent]" />
    Section Title
  </h3>
  {/* …grouped fields */}
</div>
```

---

## 12. Status Badges (single style)

**Canonical form:** `bg-{color}-500/20 text-{color}-400`

```tsx
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-blue-500/20 text-blue-400 rounded-full">
  <Icon className="w-3 h-3" />
  Status Label
</span>
```

**Color → meaning mapping:**

| Color | Meaning |
|---|---|
| `blue-500/20 text-blue-400` | New / informational |
| `amber-500/20 text-amber-400` | Pending / warning / due soon |
| `yellow-500/20 text-yellow-400` | Same as amber (use amber preferentially) |
| `emerald-500/20 text-emerald-400` | Connected / success / completed |
| `green-500/20 text-green-400` | Same as emerald (use emerald preferentially) |
| `rose-500/20 text-rose-400` | Dead / error / failed |
| `red-500/20 text-red-400` | Same as rose (use rose preferentially for status, red for errors) |
| `purple-500/20 text-purple-400` | Goals / special / high priority |
| `gray-500/20 text-gray-400` | Neutral / low priority |

**The slate-pair form is forbidden in Outreach Hub:** `bg-{color}-50 dark:bg-{color}-900/20 text-{color}-700 dark:text-{color}-300 border-{color}-200 dark:border-{color}-800`. Migrate `ColdCallsTab.tsx:25-50` to the canonical form in Phase 3.

**`ProspectStatusBadge.tsx` notes:** the status colors are externalized to `lib/outreachConstants.ts` (`PROSPECT_STATUS_CONFIG` and `LINKEDIN_STATUS_OVERRIDES`). Phase 3 must verify that file uses the canonical `bg-{color}-500/20 text-{color}-400` form across all status entries — if any use slate-pairs, they need migration too.

---

## 13. Documented Exceptions

Three intentional deviations from the canonical rules. Each is approved in Phase 1 review and **must be preserved** — do not "fix" them.

### Exception 1 — `ColdCallCsvImportModal` Import button uses `bg-green-600`

**Where:** `frontend/src/components/outreach/ColdCallCsvImportModal.tsx` final-step "Import N Prospects" button.

**Why:** Visual differentiation between "Continue" (reversible step navigation) and "Import" (destructive commit) is a meaningful UX affordance for irreversible bulk operations. Consistency-for-its-own-sake doesn't beat real UX value here.

**Scope of exception:** Limited to **the final commit-action button in multi-step write wizards**. Standard form modal save buttons stay on `bg-[--exec-accent]`. If a future feature has a similar "preview then commit" pattern, the commit button may use `bg-green-600` — but ask in PR review first.

### Exception 2 — `SendDMPanel` uses custom button-based dropdowns

**Where:** `frontend/src/components/outreach/SendDMPanel.tsx` Script Type and Template Type selectors.

**Why:** Native `<select>` cannot replicate the required UX:
- Grouped options with category headers ("Email", "LinkedIn Outreach", "LinkedIn Follow-up", "Loom", "Agency")
- Visually distinct active state with accent background
- Click-outside dismissal
- Smooth open/close animation with ChevronDown rotation

**Scope of exception:** Limited to `SendDMPanel`. All other Outreach Hub `<select>` fields use the canonical `inputClasses` with native `<select>`. If a future modal needs grouped/searchable dropdowns, you may copy this pattern — but document the second use in this file.

### Exception 3 — `SendDMPanel` is a slide-in side panel (not a modal)

**Where:** `frontend/src/components/outreach/SendDMPanel.tsx`.

**Why:** Slide-in panels keep the underlying page partially visible, which is essential when the user is composing a DM and wants to reference the underlying contact card. A modal would obscure the context entirely.

**Scope of exception:** Side panels are a **valid sibling pattern** to modals (see §6), not an exception per se. Documented here because it's the only side panel currently in Outreach Hub.

---

## 14. Pre-Delivery Checklist (Outreach Hub)

Before merging any change to `components/outreach/` or `pages/OutreachHub.tsx`, verify:

### Theme & color
- [ ] No `dark:` prefix used (the app is forced dark via ThemeProvider)
- [ ] No hardcoded hex colors — use `--exec-*` variables
- [ ] No `bg-blue-600`, `bg-purple-600`, etc. for primary buttons — use `--exec-accent`
- [ ] No slate-pair status badges (`bg-X-50 dark:bg-X-900/20 ...`) — use single-pair form (`bg-X-500/20 text-X-400`)
- [ ] No `bg-gradient-*` on buttons or surfaces (flat color only, per saved feedback)

### Layout & spacing
- [ ] Border opacities are only `/40` (structural) or `/30` (subtle dividers)
- [ ] Border radius uses only `lg`, `xl`, `2xl`, `full` — no `rounded-md`
- [ ] Inputs use `inputClasses` from `@/lib/outreachStyles` (or match `px-4 py-2.5 rounded-lg` exactly)
- [ ] Buttons use `primaryButtonClasses` / `secondaryButtonClasses` / `iconButtonClasses` from `@/lib/outreachStyles`

### Modals
- [ ] Modal uses Pattern A (Standard) or Pattern B (Large) per the §5.3 decision rule
- [ ] Container has `transform transition-all` (both tokens together)
- [ ] Container border is `border border-stone-600/40`
- [ ] Container radius is `rounded-2xl`
- [ ] Backdrop has `animate-in fade-in duration-200`
- [ ] Container has `animate-in zoom-in-95 duration-200`
- [ ] Modal is wrapped in `createPortal(..., document.body)`
- [ ] Section dividers (if any) use `border-stone-700/30`

### Buttons
- [ ] No `hover:scale-*` or `active:scale-*` anywhere (full ban)
- [ ] No `hover:translate-*` or `hover:rotate-*` (Outreach Hub doesn't use these)
- [ ] Primary button uses `bg-[--exec-accent] hover:bg-[--exec-accent-dark]` Tailwind class form
- [ ] Icon-only buttons have `aria-label`

### Accessibility
- [ ] All clickable elements have `cursor-pointer` (implicit on `<button>`, add explicitly on clickable `<div>`s)
- [ ] Focus states are visible (`focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50` on inputs)
- [ ] Tab order matches visual order
- [ ] No emoji icons (use Lucide SVG icons)
- [ ] `prefers-reduced-motion` is implicitly respected (we use only `animate-in` Tailwind utilities which honor it; no custom keyframes)

### Build & quality
- [ ] `npm run type-check` passes
- [ ] No `any` types
- [ ] No `console.log`
- [ ] No new npm dependencies (per Phase 1 hard rule)
- [ ] No backend or schema changes (per Phase 1 hard rule)

---

## 15. Migration Plan (Phase 3 — pending approval)

The migration is broken into 11 commits. Each is small (under ~50 lines), single-concern, type-safe, and reversible. None touch backend or schemas.

Approve the spec above first, then I'll execute these in batches with checkpoints.

### Batch 0 — Cleanup (1 commit)
0. `chore(outreach): remove dead tab components`
   - Delete `frontend/src/components/outreach/EmailCampaignsTab.tsx`
   - Delete `frontend/src/components/outreach/LeadDiscoveryTab.tsx`
   - Delete `frontend/src/components/outreach/SearchPlannerTab.tsx`
   - Verified unused via grep — no imports anywhere except internal cycle. Reduces audit surface for future devs.

### Batch 1 — Foundation (1 commit)
1. `refactor(outreach): add shared outreachStyles module`
   - Create `frontend/src/lib/outreachStyles.ts` with `inputClasses`, `selectClassesCompact`, `primaryButtonClasses`, `secondaryButtonClasses`, `iconButtonClasses`
   - This is purely additive — no existing files modified yet. Future batches will migrate consumers one-by-one.

### Batch 2 — Status color cleanup (2 commits)
2. `refactor(outreach): migrate ColdCallsTab kanban headers to canonical badge form`
   - `ColdCallsTab.tsx:25-50` — replace `bg-{color}-50 dark:bg-{color}-900/20 ...` with `bg-{color}-500/20 text-{color}-400 border-{color}-500/30`
3. `refactor(outreach): audit and normalize ProspectStatusBadge color config`
   - Read `lib/outreachConstants.ts` `PROSPECT_STATUS_CONFIG` and `LINKEDIN_STATUS_OVERRIDES`
   - Replace any slate-pair forms with canonical single-pair form
   - If already canonical, this commit is a no-op (no commit needed)

### Batch 3 — Hardcoded color cleanup (1 commit)
4. `refactor(outreach): replace literal hex with --exec-accent variable`
   - `BulkGenerateBar.tsx:30` — `bg-[#E07A5F] hover:bg-[#c9684f]` → `bg-[--exec-accent] hover:bg-[--exec-accent-dark]`
   - `BulkGenerateModal.tsx:137` — same replacement

### Batch 4 — Motion ban (2 commits)
5. `refactor(outreach): remove hover:scale-* from LinkedInCampaignsTab buttons`
   - 18 sites — replace `hover:scale-105 active:scale-95` with `hover:brightness-110` (or `hover:bg-[--exec-accent-dark]` where the button is `bg-[--exec-accent]`)
6. `refactor(outreach): remove hover:scale-* from MultiTouchCampaignsTab buttons`
   - 9 sites — same replacement

### Batch 5 — Modal token consistency (3 commits)
7. `refactor(outreach): add transform token to all modal containers missing it`
   - Sites: `LinkedInCampaignsTab.tsx:144`, `LinkedInCampaignsTab.tsx:268`, `MultiTouchCampaignsTab.tsx:220`, `MultiTouchCampaignsTab.tsx:422`, `MultiTouchCampaignsTab.tsx:1545`, `BulkGenerateModal.tsx:42`, `ColdCallCsvImportModal.tsx:523`
   - Add `transform` keyword before `transition-all` in each container className
8. `refactor(outreach): fix MultiTouch step editor backdrop animation`
   - `MultiTouchCampaignsTab.tsx:1544` — add `animate-in fade-in duration-200` to the backdrop
9. `refactor(outreach): standardize MultiTouch step editor radius and divider tokens`
   - `MultiTouchCampaignsTab.tsx:1544-1599` — replace any `rounded-md` with `rounded-lg`, normalize divider opacities

### Batch 6 — Border opacity normalization (1 commit)
10. `refactor(outreach): normalize border-stone-700/40 to canonical structural border`
    - `OutreachHub.tsx:239` (search input) — `border-stone-700/40` → `border-stone-600/40`
    - `MultiTouchCampaignsTab.tsx:1187` and `:1211` (search/filter inputs) — same replacement

### Batch 7 — Style module adoption (3 commits, optional sweep)
11. `refactor(outreach): adopt outreachStyles in canonical Cold Calls modals`
    - `AddColdLeadModal.tsx`, `CallProspectDetailModal.tsx`, `ColdCallCsvImportModal.tsx` — import `inputClasses` from `@/lib/outreachStyles` instead of redefining inline
12. `refactor(outreach): adopt outreachStyles in older campaign tabs`
    - `LinkedInCampaignsTab.tsx`, `MultiTouchCampaignsTab.tsx`, `WarmLeadsTab.tsx` — same migration
13. `refactor(outreach): adopt outreachStyles in shared modals and panel`
    - `BulkGenerateModal.tsx`, `ManageOutreachTemplatesModal.tsx`, `SendDMPanel.tsx`, `CampaignKeywordTracker.tsx` — same migration
    - SendDMPanel: also normalize input padding from `px-4 py-3 rounded-xl` → `px-4 py-2.5 rounded-lg` (the canonical form)

### Batch 8 — Documentation (1 commit)
14. `docs(outreach): update CLAUDE.md to reference design system master file`
    - Add a link from `CLAUDE.md` modal section to `frontend/design-system/vertex-outreach-hub/MASTER.md`
    - Add the §5.3 decision rule (Pattern A vs Pattern B) inline in CLAUDE.md
    - Document the three exceptions from §13

### Batch 9 — Verification (1 commit, no code change)
15. **Manual verification** (no commit, just review):
    - Run `npm run type-check` to confirm green build
    - Open every Outreach Hub tab in dev and visually compare to pre-migration screenshots
    - Confirm Cold Calls drag-drop still works
    - Confirm CSV import wizard still works end-to-end
    - Confirm SendDMPanel template selection still works

**Total: 14 commits + verification.** Realistic checkpoint structure: pause for review after Batch 0 (1 commit), Batch 4 (6 commits in), Batch 7 (12-13 commits in), then final review.

---

## 16. CLAUDE.md Updates Needed (Phase 3 Batch 8)

The project's `CLAUDE.md` modal section will need:

1. A new heading: `### Modal Patterns — Outreach Hub`
2. A pointer line: `> For all Outreach Hub modal work, see frontend/design-system/vertex-outreach-hub/MASTER.md (full design system spec).`
3. The §5.3 decision rule (Pattern A vs Pattern B) — copy inline so it's visible in the main CLAUDE.md without requiring a separate file open
4. The three §13 exceptions, each with a one-line summary and link to MASTER.md for full rationale

The existing slate-pair examples in CLAUDE.md remain valid for **non-Outreach** areas (Contacts, Tasks, Dashboard, etc.) — those areas predate the dark-only ThemeProvider and use the historical dark/light pair pattern. Phase 3 does not touch those areas.

---

## 17. What This Spec Is NOT

To set scope expectations clearly:

- **Not a redesign.** This is a standardization pass over an existing design that already works. The visual character of Outreach Hub does not change.
- **Not a refactor of business logic.** Mutations, queries, drag-and-drop handling, CSV parsing, template variable expansion — none of this is touched.
- **Not a backend change.** Schemas, API routes, database — none are touched.
- **Not an accessibility overhaul.** A11y concerns are noted in §14 (the checklist) but full accessibility audit is a separate task.
- **Not a performance optimization.** Bundle size, render performance, query optimization — separate concerns.
- **Not a mobile-responsive pass.** Cold Calls is desktop-only by design.
- **Not a test addition.** This is visual standardization. Tests are not currently in scope (would be a separate `test(outreach):` PR).

---

## 18. Open Questions for Phase 3 Kickoff

None. All Phase 1 questions answered. Phase 2 spec is complete. Awaiting your approval to proceed to Phase 3 (implementation).
