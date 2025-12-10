# Vertex CRM - Project Conventions

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS
- **Backend**: FastAPI + SQLAlchemy + SQLite (Alembic migrations)
- **State Management**: TanStack Query (React Query)
- **Styling**: TailwindCSS with dark mode support
- **Icons**: Lucide React
- **Utilities**: `cn()` from `@/lib/utils` for conditional classes

---

## Dark Mode Styling Guide

This app supports dark mode using Tailwind's `dark:` prefix. **ALWAYS** include dark mode variants when styling components.

### Core Color Mappings

#### Backgrounds (Light -> Dark)
| Light | Dark | Usage |
|-------|------|-------|
| `bg-white` | `dark:bg-slate-800` | Cards, modals, containers |
| `bg-gray-50` | `dark:bg-slate-900` | Page backgrounds, inputs |
| `bg-gray-100` | `dark:bg-slate-700` | Secondary backgrounds, toggles |
| `bg-gray-200` | `dark:bg-slate-600` | Tertiary, hover states |

#### Text Colors (Light -> Dark)
| Light | Dark | Usage |
|-------|------|-------|
| `text-gray-900` | `dark:text-white` | Primary headings, important text |
| `text-gray-800` | `dark:text-slate-100` | Secondary headings |
| `text-gray-700` | `dark:text-slate-200` | Body text, labels |
| `text-gray-600` | `dark:text-slate-300` | Secondary body text |
| `text-gray-500` | `dark:text-slate-400` | Muted text, descriptions |
| `text-gray-400` | `dark:text-slate-500` | Placeholder text, icons |

#### Borders (Light -> Dark)
| Light | Dark | Usage |
|-------|------|-------|
| `border-gray-100` | `dark:border-slate-700` | Subtle dividers |
| `border-gray-200` | `dark:border-slate-700` | Card borders, inputs |
| `border-gray-300` | `dark:border-slate-600` | More prominent borders |
| `border-gray-200/60` | `dark:border-slate-700/60` | Semi-transparent borders |

---

### Colored Status Badges Pattern

For status badges with background colors, use `900/30` opacity for dark mode:

```tsx
// Green (Success, Active, Completed)
className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"

// Blue (Info, In Progress, Default)
className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800"

// Red (Error, Urgent, Overdue)
className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800"

// Yellow/Amber (Warning, Due Today, Pending)
className="bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800"
className="bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"

// Orange (High Priority)
className="bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800"

// Purple (Goals, Special)
className="bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800"

// Emerald (Positive states)
className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
```

---

## Component Patterns

### Page Container
```tsx
<div className="p-8 bg-gray-50 dark:bg-slate-900 min-h-full">
  {/* Header Section */}
  <div className="bg-white dark:bg-slate-900 border-b border-gray-200/60 dark:border-slate-700/60 px-8 py-6">
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Page Title</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          Page description
        </p>
      </div>
      <button className="group flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md">
        <Plus className="w-5 h-5 mr-2 transition-transform duration-200 group-hover:rotate-90" />
        Action Button
      </button>
    </div>
  </div>

  {/* Content */}
  <div className="flex-1 overflow-auto px-8 py-6">
    {/* ... */}
  </div>
</div>
```

### Cards
```tsx
// Standard Card
<div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
  <h3 className="font-bold text-gray-900 dark:text-white">Title</h3>
  <p className="text-sm text-gray-500 dark:text-slate-400">Description</p>
</div>

// Interactive Card (with hover)
<div className={cn(
  "bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-5",
  "transition-all duration-200 ease-out",
  "hover:shadow-lg hover:-translate-y-1 hover:border-gray-300 dark:hover:border-slate-600",
  "cursor-pointer group"
)}>
  {/* Content */}
</div>

// Card with colored left border (priority indicator)
<div className={cn(
  "bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5",
  "border-l-4 border-l-blue-500", // Change color for priority
  "transition-all duration-200 hover:shadow-lg hover:-translate-y-1"
)}>
  {/* Content */}
</div>
```

### Form Inputs
```tsx
// Text Input
<input
  type="text"
  className={cn(
    "w-full px-4 py-2.5",
    "bg-gray-50 dark:bg-slate-700",
    "border border-gray-200 dark:border-slate-600 rounded-xl",
    "text-gray-900 dark:text-white",
    "placeholder:text-gray-400 dark:placeholder:text-slate-400",
    "focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500",
    "transition-all duration-200"
  )}
  placeholder="Placeholder text..."
/>

// Select Dropdown
<select
  className={cn(
    "w-full px-4 py-2.5",
    "bg-gray-50 dark:bg-slate-700",
    "border border-gray-200 dark:border-slate-600 rounded-xl",
    "text-gray-900 dark:text-white",
    "focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500",
    "transition-all duration-200",
    "cursor-pointer appearance-none"
  )}
>
  <option>Option 1</option>
</select>

// Textarea
<textarea
  className={cn(
    "w-full px-4 py-2.5",
    "bg-gray-50 dark:bg-slate-700",
    "border border-gray-200 dark:border-slate-600 rounded-xl",
    "text-gray-900 dark:text-white",
    "placeholder:text-gray-400 dark:placeholder:text-slate-400",
    "focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500",
    "transition-all duration-200 resize-none"
  )}
  rows={3}
/>

// Checkbox
<input
  type="checkbox"
  className="w-4 h-4 text-blue-600 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:focus:ring-blue-400"
/>
```

### Buttons

```tsx
// Primary Button
<button className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
  Primary Action
</button>

// Secondary Button
<button className="px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-600 transition-all duration-200">
  Secondary
</button>

// Ghost/Outline Button
<button className="px-4 py-2 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-all duration-200">
  Ghost Button
</button>

// Danger Button
<button className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all duration-200">
  Delete
</button>

// Icon Button (hover reveal pattern)
<button className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors">
  <Edit className="w-4 h-4" />
</button>

// Danger Icon Button
<button className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors">
  <Trash2 className="w-4 h-4" />
</button>
```

### Badges

```tsx
// Status Badge (pill with dot)
<div className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400">
  <div className="w-2 h-2 rounded-full bg-green-500" />
  Active
</div>

// Full Badge (with background)
<span className={cn(
  "inline-flex items-center gap-1.5",
  "px-2.5 py-1",
  "text-xs font-medium",
  "bg-blue-50 dark:bg-blue-900/30",
  "text-blue-700 dark:text-blue-400",
  "border border-blue-200 dark:border-blue-800",
  "rounded-full"
)}>
  <Icon className="w-3 h-3" />
  Label
</span>

// Count Badge
<span className="text-xs bg-white/50 dark:bg-black/20 px-2 py-0.5 rounded-full font-semibold">
  {count}
</span>
```

### Tables

```tsx
<div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
  <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
    <thead className="bg-gray-50 dark:bg-slate-700/50">
      <tr>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
          Column Header
        </th>
      </tr>
    </thead>
    <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
      <tr className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="text-sm font-medium text-gray-900 dark:text-white">Primary</div>
          <div className="text-sm text-gray-500 dark:text-slate-400">Secondary</div>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

### Modals

```tsx
<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 animate-in zoom-in-95 duration-200">
    {/* Header */}
    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">Modal Title</h2>
      <button className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
        <X className="w-5 h-5" />
      </button>
    </div>

    {/* Body */}
    <div className="p-6">
      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
        Label
      </label>
      {/* Form fields */}
    </div>

    {/* Footer */}
    <div className="flex gap-3 justify-end px-6 py-4 border-t border-gray-100 dark:border-slate-700">
      <button className="px-4 py-2 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl transition-colors">
        Cancel
      </button>
      <button className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors">
        Confirm
      </button>
    </div>
  </div>
</div>
```

### Empty States

```tsx
<div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-12 text-center">
  <Icon className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No items found</h3>
  <p className="text-gray-500 dark:text-slate-400">
    Get started by creating your first item.
  </p>
</div>
```

---

## Interactive Patterns

### Group Hover (Show actions on card hover)
```tsx
<div className="group ...">
  {/* Always visible content */}

  {/* Actions - hidden until hover */}
  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
    <button>Edit</button>
    <button>Delete</button>
  </div>
</div>
```

### Toggle Buttons (Tab-like)
```tsx
<div className="flex items-center bg-gray-100 dark:bg-slate-700 p-1 rounded-xl">
  <button
    className={cn(
      "p-2 rounded-lg transition-all",
      isActive
        ? "bg-white dark:bg-slate-600 text-gray-900 dark:text-white shadow-sm"
        : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
    )}
  >
    Option 1
  </button>
</div>
```

### Filter Pills
```tsx
<button
  className={cn(
    "px-3 py-1.5 text-sm font-medium rounded-lg",
    "transition-all duration-200",
    isActive
      ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
      : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700"
  )}
>
  Filter Label
</button>
```

---

## Animation & Transitions

### Standard Transitions
- Color/background: `transition-colors duration-200`
- All properties: `transition-all duration-200`
- Opacity: `transition-opacity duration-200`

### Hover Transforms
```tsx
// Lift on hover
"hover:-translate-y-1 hover:shadow-lg"

// Scale on hover
"hover:scale-105"

// Rotate icon on hover (use with group)
"group-hover:rotate-90"
```

### Loading States
```tsx
// Spinner
<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600" />

// Pulse (for active states)
<span className="animate-pulse">Active timer</span>
```

---

## Typography

### Headings
- Page title: `text-2xl font-bold text-gray-900 dark:text-white tracking-tight`
- Section title: `text-lg font-semibold text-gray-900 dark:text-white`
- Card title: `text-base font-semibold text-gray-900 dark:text-white` or `font-bold text-sm`

### Body Text
- Primary: `text-sm text-gray-900 dark:text-white`
- Secondary: `text-sm text-gray-600 dark:text-slate-300`
- Muted: `text-sm text-gray-500 dark:text-slate-400`
- Caption: `text-xs text-gray-400 dark:text-slate-500`

### Font Weights
- Bold: `font-bold` (700)
- Semibold: `font-semibold` (600)
- Medium: `font-medium` (500)
- Normal: `font-normal` (400)

---

## Spacing Conventions

### Padding
- Page: `p-8` or `px-8 py-6`
- Cards: `p-4`, `p-5`, or `p-6`
- Buttons: `px-4 py-2` or `px-3 py-1.5` (small)
- Badges: `px-2.5 py-1` or `px-2 py-0.5` (compact)

### Gaps
- Standard: `gap-3` or `gap-4`
- Tight: `gap-2`
- Wide: `gap-6`

### Margins
- Section spacing: `mb-6` or `mb-8`
- Element spacing: `mb-2` or `mb-4`

---

## Border Radius

- Cards/Modals: `rounded-xl` (12px) or `rounded-2xl` (16px)
- Buttons/Inputs: `rounded-xl` (12px) or `rounded-lg` (8px)
- Badges: `rounded-full` (pill) or `rounded-lg`
- Small elements: `rounded-md` (6px)

---

## Priority & Status Configurations

### Task Priority Config
```tsx
const priorityConfig = {
  urgent: {
    border: 'border-l-red-500',
    badge: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
    dot: 'bg-red-500',
  },
  high: {
    border: 'border-l-orange-500',
    badge: 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800',
    dot: 'bg-orange-500',
  },
  medium: {
    border: 'border-l-blue-500',
    badge: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    dot: 'bg-blue-500',
  },
  low: {
    border: 'border-l-gray-400',
    badge: 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600',
    dot: 'bg-gray-400',
  },
};
```

### Task Status Config
```tsx
const statusConfig = {
  pending: { dot: 'bg-gray-400', text: 'text-gray-600 dark:text-gray-400' },
  in_progress: { dot: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400' },
  completed: { dot: 'bg-green-500', text: 'text-green-600 dark:text-green-400' },
  delayed: { dot: 'bg-yellow-500', text: 'text-yellow-600 dark:text-yellow-400' },
};
```

---

## File Structure

```
frontend/
├── src/
│   ├── pages/           # Page components
│   ├── components/      # Reusable UI components
│   ├── contexts/        # React contexts (Theme, Timer)
│   ├── hooks/           # Custom hooks
│   ├── lib/
│   │   ├── api.ts       # API client with all endpoints
│   │   ├── utils.ts     # cn() and other utilities
│   │   └── currency.ts  # Currency formatting
│   └── types/           # TypeScript types and enums

backend/
├── app/
│   ├── routes/          # API endpoints
│   ├── models/          # SQLAlchemy models
│   ├── schemas/         # Pydantic schemas
│   └── services/        # Business logic
└── alembic/             # Database migrations
```

---

## Best Practices

1. **Always use `cn()`** for conditional classes
2. **Always include dark mode** variants for all colors
3. **Use semantic color names** (gray for neutral, blue for primary, etc.)
4. **Keep transitions consistent** - use `duration-200` everywhere
5. **Use standard spacing** - stick to the Tailwind scale (2, 3, 4, 6, 8)
6. **Test in both light and dark modes** before committing

---

## MANDATORY: Dark Mode Verification Checklist

**CRITICAL**: Before committing ANY frontend changes, verify dark mode is not broken. This checklist is MANDATORY.

### Pre-Commit Verification Steps

1. **Run the app in dark mode** (toggle via Settings or system preference)
2. **Visit every page you modified** and check:
   - [ ] Page background is `slate-900` (not white/gray)
   - [ ] Cards/containers are `slate-800` (not white)
   - [ ] Text is readable (white/slate-300/slate-400, not gray-900)
   - [ ] Borders are visible (`slate-700`, not gray-200)
   - [ ] Buttons have proper dark variants
   - [ ] Inputs/forms have dark backgrounds

### Quick Visual Check

In dark mode, you should see:
- **Page backgrounds**: Dark navy (`#0f172a` = slate-900)
- **Cards/panels**: Slightly lighter (`#1e293b` = slate-800)
- **Primary text**: White or very light
- **Secondary text**: Muted gray (`slate-400`)
- **Borders**: Subtle dark lines (`slate-700`)

**If you see any bright white backgrounds or unreadable text, STOP and fix it.**

### Common Dark Mode Mistakes to Avoid

1. **Missing `dark:` prefix**: Every `bg-white` needs `dark:bg-slate-800`
2. **Missing text colors**: Every `text-gray-900` needs `dark:text-white`
3. **Missing border colors**: Every `border-gray-200` needs `dark:border-slate-700`
4. **Forgetting hover states**: Include `dark:hover:bg-slate-600` etc.
5. **Hard-coded colors**: Never use hex colors; use Tailwind classes

### Required Dark Mode Pairs (Must Always Be Together)

```tsx
// These pairs must ALWAYS appear together:

// Page containers
bg-gray-50 dark:bg-slate-900

// Cards and panels
bg-white dark:bg-slate-800

// Headers with border
bg-white dark:bg-slate-900 border-b border-gray-200/60 dark:border-slate-700/60

// Primary headings
text-gray-900 dark:text-white

// Secondary text
text-gray-500 dark:text-slate-400

// Card borders
border-gray-200 dark:border-slate-700

// Table headers
bg-gray-50 dark:bg-slate-700/50

// Table body
bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700
```

### Using Playwright to Verify Dark Mode

```typescript
// Quick dark mode verification workflow:
1. mcp__playwright__browser_navigate({ url: "http://localhost:5173/page" })
2. // Click dark mode toggle in settings, or:
   mcp__playwright__browser_evaluate({
     function: "() => document.documentElement.classList.add('dark')"
   })
3. mcp__playwright__browser_take_screenshot({ filename: "dark-mode-check.png" })
4. // Review screenshot - no white backgrounds should appear
```

### If Dark Mode Breaks

1. Search for the broken element's classes
2. Add missing `dark:` variants using the color mappings above
3. Re-test in dark mode before committing
4. Update this checklist if you find a new pattern

---

## API Patterns

### Backend Structure

The backend uses FastAPI with SQLAlchemy ORM. All endpoints follow REST conventions.

**Route Organization:**
```
backend/app/routes/
├── contacts.py    # Contact CRUD + interactions
├── crm.py         # Deals, pipeline stages
├── tasks.py       # Task management
├── projects.py    # Project management
├── time.py        # Time tracking entries
├── dashboard.py   # Dashboard aggregations
├── ai.py          # AI chat endpoints
└── outreach.py    # Email templates
```

**Standard Endpoint Pattern:**
```python
# GET all (with optional filtering)
@router.get("/", response_model=list[Schema])
def get_all(search: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Model)
    if search:
        query = query.filter(Model.name.ilike(f"%{search}%"))
    return query.all()

# GET single
@router.get("/{id}", response_model=Schema)
def get_one(id: int, db: Session = Depends(get_db)):
    item = db.query(Model).filter(Model.id == id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return item

# POST create
@router.post("/", response_model=Schema)
def create(data: CreateSchema, db: Session = Depends(get_db)):
    item = Model(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

# PUT update
@router.put("/{id}", response_model=Schema)
def update(id: int, data: UpdateSchema, db: Session = Depends(get_db)):
    item = db.query(Model).filter(Model.id == id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item

# DELETE
@router.delete("/{id}")
def delete(id: int, db: Session = Depends(get_db)):
    item = db.query(Model).filter(Model.id == id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(item)
    db.commit()
    return {"message": "Deleted"}
```

### Frontend API Client

All API calls go through `frontend/src/lib/api.ts`:

```typescript
// API client structure
export const entityApi = {
  getAll: async (search?: string): Promise<Entity[]> => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    const res = await fetch(`${API_BASE}/entity?${params}`);
    return res.json();
  },

  get: async (id: number): Promise<Entity> => {
    const res = await fetch(`${API_BASE}/entity/${id}`);
    return res.json();
  },

  create: async (data: EntityCreate): Promise<Entity> => {
    const res = await fetch(`${API_BASE}/entity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  update: async (id: number, data: Partial<EntityCreate>): Promise<Entity> => {
    const res = await fetch(`${API_BASE}/entity/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  delete: async (id: number): Promise<void> => {
    await fetch(`${API_BASE}/entity/${id}`, { method: 'DELETE' });
  },
};
```

---

## State Management (React Query)

### Query Patterns

```typescript
// Basic query
const { data: items = [], isLoading } = useQuery({
  queryKey: ['items'],
  queryFn: () => itemApi.getAll(),
});

// Query with parameters
const { data: items = [] } = useQuery({
  queryKey: ['items', searchTerm, filter],  // Cache key includes params
  queryFn: () => itemApi.getAll(searchTerm, filter),
});

// Single item query
const { data: item } = useQuery({
  queryKey: ['items', id],
  queryFn: () => itemApi.get(id),
  enabled: !!id,  // Only fetch when id exists
});
```

### Mutation Patterns

```typescript
const queryClient = useQueryClient();

// Create mutation
const createMutation = useMutation({
  mutationFn: (data: ItemCreate) => itemApi.create(data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['items'] });
    setIsModalOpen(false);
  },
});

// Update mutation
const updateMutation = useMutation({
  mutationFn: ({ id, data }: { id: number; data: Partial<ItemCreate> }) =>
    itemApi.update(id, data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['items'] });
  },
});

// Delete mutation
const deleteMutation = useMutation({
  mutationFn: (id: number) => itemApi.delete(id),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['items'] });
  },
});
```

### Optimistic Updates (for drag-and-drop)

```typescript
const mutation = useMutation({
  mutationFn: updateItem,
  onMutate: async (newData) => {
    await queryClient.cancelQueries({ queryKey: ['items'] });
    const previous = queryClient.getQueryData(['items']);
    queryClient.setQueryData(['items'], (old) => /* optimistic update */);
    return { previous };
  },
  onError: (err, newData, context) => {
    queryClient.setQueryData(['items'], context?.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['items'] });
  },
});
```

---

## Data Models

### Core Entities

```
Contact
├── id, name, email, phone, company
├── status: LEAD | PROSPECT | CLIENT | INACTIVE
├── notes, created_at, updated_at
└── interactions[] (one-to-many)

Deal
├── id, title, value, stage
├── contact_id (foreign key)
├── expected_close_date, closed_at
├── notes, created_at, updated_at
└── tasks[] (one-to-many)

Task
├── id, title, description
├── status: pending | in_progress | completed | delayed
├── priority: low | medium | high | urgent
├── due_date, completed_at
├── deal_id, project_id (optional foreign keys)
└── time_entries[] (one-to-many)

Project
├── id, name, description, color
├── contact_id (optional)
├── status: active | completed | on_hold | cancelled
├── hourly_rate, budget
└── tasks[], time_entries[] (one-to-many)

TimeEntry
├── id, description, duration_seconds
├── started_at, ended_at
├── is_billable, category
├── task_id, project_id, deal_id (optional)
└── hourly_rate
```

### Enums (TypeScript)

```typescript
// frontend/src/types/index.ts
export enum ContactStatus {
  LEAD = 'LEAD',
  PROSPECT = 'PROSPECT',
  CLIENT = 'CLIENT',
  INACTIVE = 'INACTIVE',
}

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  DELAYED = 'delayed',
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum DealStage {
  LEAD = 'Lead',
  QUALIFIED = 'Qualified',
  PROPOSAL = 'Proposal',
  NEGOTIATION = 'Negotiation',
  CLOSED_WON = 'Closed Won',
  CLOSED_LOST = 'Closed Lost',
}
```

---

## Adding New Features

### Adding a New Entity (Full Stack)

1. **Backend Model** (`backend/app/models/`)
```python
class NewEntity(Base):
    __tablename__ = "new_entities"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
```

2. **Alembic Migration**
```bash
cd backend
venv/Scripts/alembic revision --autogenerate -m "add new_entity table"
venv/Scripts/alembic upgrade head
```

3. **Pydantic Schema** (`backend/app/schemas/`)
```python
class NewEntityBase(BaseModel):
    name: str

class NewEntityCreate(NewEntityBase):
    pass

class NewEntity(NewEntityBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
```

4. **FastAPI Route** (`backend/app/routes/`)
```python
router = APIRouter(prefix="/new-entities", tags=["new-entities"])

# Add CRUD endpoints...
```

5. **Register Route** (`backend/app/main.py`)
```python
from app.routes import new_entity
app.include_router(new_entity.router)
```

6. **Frontend Types** (`frontend/src/types/index.ts`)
```typescript
export interface NewEntity {
  id: number;
  name: string;
  created_at: string;
}
```

7. **Frontend API** (`frontend/src/lib/api.ts`)
```typescript
export const newEntityApi = {
  getAll: async (): Promise<NewEntity[]> => { ... },
  create: async (data: NewEntityCreate): Promise<NewEntity> => { ... },
  // ...
};
```

8. **Frontend Page** (`frontend/src/pages/NewEntity.tsx`)
- Follow existing page patterns (see Contacts.tsx, Tasks.tsx)

9. **Add to Router** (`frontend/src/App.tsx`)
```typescript
<Route path="/new-entity" element={<NewEntityPage />} />
```

10. **Add to Sidebar** (`frontend/src/components/Layout.tsx`)
```typescript
{ name: 'New Entity', href: '/new-entity', icon: IconName },
```

---

## Database Migrations

### Common Commands

```bash
cd backend

# Create new migration
venv/Scripts/alembic revision --autogenerate -m "description"

# Apply migrations
venv/Scripts/alembic upgrade head

# Check current migration
venv/Scripts/alembic current

# Rollback one migration
venv/Scripts/alembic downgrade -1

# View migration history
venv/Scripts/alembic history
```

### Migration Best Practices

1. Always review autogenerated migrations before applying
2. Test migrations on development database first
3. Include both `upgrade()` and `downgrade()` functions
4. For data migrations, use `op.execute()` for SQL

---

## Deployment (Render)

### Services

- **Backend**: Web Service (Python, uvicorn)
- **Frontend**: Static Site (Vite build)
- **Database**: PostgreSQL (Render managed)

### Environment Variables

Backend requires:
```
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...
```

### Deploy Commands

Backend:
```
Build: pip install -r requirements.txt && alembic upgrade head
Start: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Frontend:
```
Build: npm install && npm run build
Publish: dist
```

### Render MCP Tools

This project has Render MCP integration:
```typescript
// List services
mcp__render__list_services

// Get service details
mcp__render__get_service({ serviceId: "srv-xxx" })

// View logs
mcp__render__list_logs({ resource: ["srv-xxx"] })

// View deployments
mcp__render__list_deploys({ serviceId: "srv-xxx" })
```

---

## Local Development

### Start Backend
```bash
cd backend
venv/Scripts/activate
python -m uvicorn app.main:app --reload --port 8000
```

### Start Frontend
```bash
cd frontend
npm run dev
```

### Common Issues

1. **CORS errors**: Check backend CORS origins in `main.py`
2. **Database locked**: Only one connection at a time with SQLite
3. **Hot reload not working**: Restart uvicorn with `--reload`
4. **Type errors**: Run `npm run type-check` in frontend

---

## Testing Changes

### Manual Testing Checklist

Before committing UI changes:
- [ ] Test in light mode
- [ ] Test in dark mode
- [ ] Test responsive (mobile/tablet)
- [ ] Test loading states
- [ ] Test empty states
- [ ] Test error states

### Using Playwright MCP

```typescript
// Navigate to page
mcp__playwright__browser_navigate({ url: "http://localhost:5173/tasks" })

// Take screenshot
mcp__playwright__browser_take_screenshot({ filename: "test.png" })

// Get page snapshot (for accessibility)
mcp__playwright__browser_snapshot()

// Click element
mcp__playwright__browser_click({ element: "Button text", ref: "ref-from-snapshot" })
```

---

## Git Workflow

### Branch Naming
- Feature: `feature/description`
- Bugfix: `fix/description`
- Hotfix: `hotfix/description`

### Commit Message Format
```
type: short description

- Detail 1
- Detail 2

🤖 Generated with Claude Code
```

Types: `feat`, `fix`, `refactor`, `style`, `docs`, `chore`

### PR Process
1. Create feature branch from main
2. Make changes and test locally
3. Push and create PR via `gh pr create`
4. PR auto-deploys to Render preview
5. Merge to main for production deploy
