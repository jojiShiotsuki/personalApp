import { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import Papa from 'papaparse';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  FileSpreadsheet,
  Upload,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertCircle,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { primaryButtonClasses, secondaryButtonClasses } from '@/lib/outreachStyles';
import { coldCallsApi } from '@/lib/api';
import { CallProspectCsvColumnMapping } from '@/types';

interface ColdCallCsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** If set, every imported lead is assigned to this campaign. */
  campaignId?: number | null;
}

type Step = 'upload' | 'map' | 'preview';

const STEP_CONFIG = [
  { key: 'upload' as const, label: 'Upload', number: 1 },
  { key: 'map' as const, label: 'Map Columns', number: 2 },
  { key: 'preview' as const, label: 'Preview & Import', number: 3 },
];

// Target fields a CSV column can map to in this import.
type TargetField =
  | 'ignore'
  | 'business_name'
  | 'first_name'
  | 'last_name'
  | 'position'
  | 'email'
  | 'linkedin_url'
  | 'phone'
  | 'vertical'
  | 'address'
  | 'website'
  | 'facebook_url'
  | 'source'
  | 'rating'
  | 'reviews_count'
  | 'google_maps_url'
  | 'working_hours'
  | 'description'
  | 'notes'
  | 'append_notes';

interface TargetOption {
  value: TargetField;
  label: string;
  required?: boolean;
  singleton?: boolean; // Can only be assigned to one CSV header
}

const TARGET_OPTIONS: TargetOption[] = [
  { value: 'ignore', label: 'Ignore' },
  { value: 'business_name', label: 'Business Name', required: true, singleton: true },
  // phone is intentionally NOT singleton — Apollo splits phone across
  // Mobile/Work Direct/Corporate/Home/Other and any single column is empty
  // for many rows. Mapping multiple columns lets the backend fall back to
  // whichever has data per row.
  { value: 'phone', label: 'Phone (map all phone columns)', required: true },
  { value: 'first_name', label: 'First Name', singleton: true },
  { value: 'last_name', label: 'Last Name', singleton: true },
  { value: 'position', label: 'Position / Job Title', singleton: true },
  { value: 'email', label: 'Email', singleton: true },
  { value: 'linkedin_url', label: 'LinkedIn URL', singleton: true },
  { value: 'vertical', label: 'Category (Vertical)', singleton: true },
  { value: 'address', label: 'Address', singleton: true },
  { value: 'website', label: 'Website', singleton: true },
  { value: 'facebook_url', label: 'Facebook URL', singleton: true },
  { value: 'source', label: 'Source', singleton: true },
  { value: 'rating', label: 'Rating', singleton: true },
  { value: 'reviews_count', label: 'Reviews count', singleton: true },
  { value: 'google_maps_url', label: 'Google Maps URL', singleton: true },
  { value: 'working_hours', label: 'Working hours', singleton: true },
  { value: 'description', label: 'Description', singleton: true },
  { value: 'notes', label: 'Notes (replace)', singleton: true },
  { value: 'append_notes', label: 'Append to notes' },
];

const SINGLETON_TARGETS: readonly TargetField[] = TARGET_OPTIONS.filter(
  (t) => t.singleton
).map((t) => t.value);

// Bumped to v2 when `name`/`name_for_emails` were added to HEADER_ALIASES —
// pre-v2 saved mappings for Outscraper CSVs had `name` as "ignore" and fell
// back to the sparse `company_name` column for business_name, silently
// skipping most rows. Invalidating forces auto-map to re-run with the new
// aliases; users can re-save their mapping on the next successful import.
const LOCAL_STORAGE_PREFIX = 'vertex:cold-calls:csv-mapping:v2:';

const selectClasses = cn(
  'w-full px-3 py-2 rounded-lg',
  'bg-stone-800/50 border border-stone-600/40',
  'text-[--exec-text] text-sm',
  'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
  'transition-all cursor-pointer'
);

// --- Header normalization + auto-detect ---------------------------

// Normalize for alias lookup: lowercase, strip non-alnum → underscore,
// collapse repeats, trim. "Business Name" → "business_name", "Phone #" → "phone".
function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Normalized-header → canonical TargetField. Exact matches on the
// canonical field names AND common aliases across Outscraper/Apollo/Hunter.
const HEADER_ALIASES: Record<string, TargetField> = {
  // business_name (NOTE: do NOT alias "title" here — Apollo's "Title"
  // column means job title, mapped to `position` below.)
  // In Outscraper Google Maps exports the primary business column is
  // just "name" (with "name_for_emails" as the cleaned variant). Those
  // are 100% populated; "company_name" is sparse (~15%) because it only
  // has a value when Outscraper matched the listing to a linked entity.
  // Auto-map is first-match-wins on the header-order iteration, so
  // listing "name" first here ensures it claims the business_name
  // singleton before the sparse "company_name" column can.
  name: 'business_name',
  name_for_emails: 'business_name',
  business_name: 'business_name',
  businessname: 'business_name',
  company: 'business_name',
  company_name: 'business_name',
  company_name_for_emails: 'business_name',
  business: 'business_name',
  organization: 'business_name',
  organization_name: 'business_name',
  account_name: 'business_name',
  agency_name: 'business_name',
  // first_name
  first_name: 'first_name',
  firstname: 'first_name',
  given_name: 'first_name',
  fname: 'first_name',
  // last_name
  last_name: 'last_name',
  lastname: 'last_name',
  surname: 'last_name',
  family_name: 'last_name',
  lname: 'last_name',
  // position (job title)
  position: 'position',
  title: 'position',
  job_title: 'position',
  jobtitle: 'position',
  role: 'position',
  seniority: 'position',
  // email
  email: 'email',
  email_address: 'email',
  primary_email: 'email',
  work_email: 'email',
  // linkedin_url
  linkedin_url: 'linkedin_url',
  linkedin: 'linkedin_url',
  person_linkedin_url: 'linkedin_url',
  linkedin_profile: 'linkedin_url',
  // phone — non-singleton, all phone variants map here so the backend
  // can fall back to whichever has data per row.
  phone: 'phone',
  phone_number: 'phone',
  phone_1: 'phone',
  telephone: 'phone',
  mobile: 'phone',
  mobile_phone: 'phone',
  work_direct_phone: 'phone',
  corporate_phone: 'phone',
  home_phone: 'phone',
  other_phone: 'phone',
  company_phone: 'phone',
  contact: 'phone',
  // vertical
  vertical: 'vertical',
  category: 'vertical',
  subcategory: 'vertical',
  industry: 'vertical',
  niche: 'vertical',
  type: 'vertical',
  // address
  address: 'address',
  full_address: 'address',
  street: 'address',
  location: 'address',
  // website
  website: 'website',
  web: 'website',
  site: 'website',
  url: 'website',
  web_url: 'website',
  website_url: 'website',
  // facebook_url
  facebook_url: 'facebook_url',
  facebook: 'facebook_url',
  fb: 'facebook_url',
  fb_url: 'facebook_url',
  facebook_page: 'facebook_url',
  // source
  source: 'source',
  lead_source: 'source',
  // rating
  rating: 'rating',
  stars: 'rating',
  review_score: 'rating',
  avg_rating: 'rating',
  // reviews_count
  reviews: 'reviews_count',
  reviews_count: 'reviews_count',
  review_count: 'reviews_count',
  num_reviews: 'reviews_count',
  // google_maps_url
  google_maps_url: 'google_maps_url',
  location_link: 'google_maps_url',
  maps_link: 'google_maps_url',
  gmaps_url: 'google_maps_url',
  // working_hours
  working_hours: 'working_hours',
  working_hours_csv_compatible: 'working_hours',
  hours: 'working_hours',
  business_hours: 'working_hours',
  // description
  description: 'description',
  about: 'description',
  business_description: 'description',
  summary: 'description',
  // notes
  notes: 'notes',
  remarks: 'notes',
};

function inferTargetField(header: string): TargetField {
  const normalized = normalizeHeader(header);
  return HEADER_ALIASES[normalized] ?? 'ignore';
}

// Auto-generate an initial mapping. Each singleton target lands on at
// most one header (first match wins); subsequent matches on the same
// singleton fall back to "ignore" so the user can decide which one.
function autoMapHeaders(headers: string[]): Record<string, TargetField> {
  const result: Record<string, TargetField> = {};
  const usedSingletons = new Set<TargetField>();

  for (const h of headers) {
    const inferred = inferTargetField(h);
    if (inferred !== 'ignore' && SINGLETON_TARGETS.includes(inferred)) {
      if (usedSingletons.has(inferred)) {
        result[h] = 'ignore';
      } else {
        result[h] = inferred;
        usedSingletons.add(inferred);
      }
    } else {
      result[h] = inferred;
    }
  }

  return result;
}

// --- localStorage persistence --------------------------------------

// Fingerprint = sorted headers joined with "|". Identical header sets
// produce identical fingerprints regardless of column order.
function fingerprintHeaders(headers: string[]): string {
  return [...headers].map((h) => h.trim()).sort().join('|');
}

function storageKey(headers: string[]): string {
  return LOCAL_STORAGE_PREFIX + fingerprintHeaders(headers);
}

function loadSavedMapping(headers: string[]): Record<string, TargetField> | null {
  try {
    const raw = localStorage.getItem(storageKey(headers));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, TargetField>;
    // Only keep entries where the header exists in the current file
    const filtered: Record<string, TargetField> = {};
    for (const h of headers) {
      if (parsed[h]) filtered[h] = parsed[h];
    }
    // Require both business_name and phone to be present — otherwise
    // the saved mapping is stale/invalid and we fall back to auto-detect.
    const values = Object.values(filtered);
    if (!values.includes('business_name') || !values.includes('phone')) return null;
    return filtered;
  } catch {
    return null;
  }
}

function saveMapping(headers: string[], mapping: Record<string, TargetField>): void {
  try {
    localStorage.setItem(storageKey(headers), JSON.stringify(mapping));
  } catch {
    // localStorage full/disabled — persistence is best-effort, silently ignore.
  }
}

// --- Mapping → API payload + preview notes -------------------------

// Build the API's column_mapping payload from the UI's per-header state.
// Returns null if the two required targets aren't mapped yet.
function buildColumnMapping(
  headerMapping: Record<string, TargetField>
): CallProspectCsvColumnMapping | null {
  const payload: Partial<CallProspectCsvColumnMapping> = {
    phone: [],
    notes_append_columns: [],
  };

  for (const [header, target] of Object.entries(headerMapping)) {
    if (target === 'ignore') continue;
    if (target === 'append_notes') {
      payload.notes_append_columns = [...(payload.notes_append_columns ?? []), header];
      continue;
    }
    if (target === 'phone') {
      payload.phone = [...(payload.phone ?? []), header];
      continue;
    }
    (payload as Record<string, unknown>)[target] = header;
  }

  if (!payload.business_name || !payload.phone || payload.phone.length === 0) return null;

  return {
    business_name: payload.business_name,
    phone: payload.phone,
    first_name: payload.first_name,
    last_name: payload.last_name,
    position: payload.position,
    email: payload.email,
    linkedin_url: payload.linkedin_url,
    vertical: payload.vertical,
    address: payload.address,
    facebook_url: payload.facebook_url,
    website: payload.website,
    source: payload.source,
    rating: payload.rating,
    reviews_count: payload.reviews_count,
    google_maps_url: payload.google_maps_url,
    working_hours: payload.working_hours,
    description: payload.description,
    notes: payload.notes,
    notes_append_columns: payload.notes_append_columns ?? [],
  };
}

// Preview-time composite notes builder. Mirrors the backend _build_notes
// logic in routes/call_prospects.py so the preview matches reality.
function buildPreviewNotes(
  row: Record<string, string>,
  columnMapping: CallProspectCsvColumnMapping
): string {
  const parts: string[] = [];
  if (columnMapping.notes) {
    const direct = (row[columnMapping.notes] ?? '').trim();
    if (direct) parts.push(direct);
  }
  for (const col of columnMapping.notes_append_columns ?? []) {
    const val = (row[col] ?? '').trim();
    if (val) parts.push(`${col}: ${val}`);
  }
  return parts.join(' | ');
}

// --- Component -----------------------------------------------------

export default function ColdCallCsvImportModal({
  isOpen,
  onClose,
  campaignId = null,
}: ColdCallCsvImportModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [headerMapping, setHeaderMapping] = useState<Record<string, TargetField>>({});
  const [loadedFromStorage, setLoadedFromStorage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  // Rows the user has unchecked in the preview — these are skipped on import.
  // Stored as excluded (vs. included) so the default of "all selected" is just
  // an empty Set — no bookkeeping needed when csvData swaps on re-upload.
  const [excludedRowIndices, setExcludedRowIndices] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: (data: {
      column_mapping: CallProspectCsvColumnMapping;
      data: Record<string, string>[];
      campaign_id?: number | null;
    }) => coldCallsApi.import(data),
    onSuccess: (result) => {
      if (result.imported_count === 0 && result.skipped_count > 0) {
        toast.error(
          `Import failed — 0 imported, ${result.skipped_count} skipped`,
          { duration: 10_000 }
        );
      } else {
        toast.success(
          `Imported ${result.imported_count} prospects${
            result.skipped_count > 0 ? `, skipped ${result.skipped_count}` : ''
          }`
        );
      }
      if (result.errors.length > 0) {
        result.errors.slice(0, 3).forEach((err) => toast.error(err, { duration: 10_000 }));
      }
      // Persist mapping for this header shape only after a successful import
      if (result.imported_count > 0) {
        saveMapping(csvHeaders, headerMapping);
      }
      queryClient.invalidateQueries({ queryKey: ['call-prospects'] });
      // Leave modal open when everything failed so the user can review errors
      if (result.imported_count > 0) {
        handleClose();
      }
    },
    onError: (error: unknown) => {
      const detail =
        axios.isAxiosError(error) && typeof error.response?.data?.detail === 'string'
          ? error.response.data.detail
          : error instanceof Error
            ? error.message
            : 'Failed to import prospects';
      toast.error(detail, { duration: 10_000 });
    },
  });

  const handleClose = () => {
    setStep('upload');
    setCsvHeaders([]);
    setCsvData([]);
    setHeaderMapping({});
    setLoadedFromStorage(false);
    setIsDragging(false);
    setExcludedRowIndices(new Set());
    onClose();
  };

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    // Read as text first so we can normalize line endings before parsing.
    // Papaparse auto-detects the newline from the first occurrence, so a
    // single stray CRLF (e.g. header ends with \r\n but the rest is \n only)
    // makes it split on \r\n and merge every LF-terminated row into one
    // giant record. Normalizing to \n up front makes auto-detect moot.
    const reader = new FileReader();
    reader.onerror = () => toast.error('Failed to read file');
    reader.onload = (e) => {
      const raw = (e.target?.result as string) ?? '';
      const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

      Papa.parse<Record<string, string>>(normalized, {
        header: true,
        skipEmptyLines: true,
        transform: (value) => value.trim(),
        complete: (results) => {
        const headers = (results.meta.fields ?? []).map((h) => h.trim());
        const data = results.data;

        if (headers.length === 0 || data.length === 0) {
          toast.error('CSV file must have at least a header row and one data row');
          return;
        }

        // Rows papaparse flagged as malformed (column count mismatch). These
        // usually came from an unescaped quote that cascaded into merging
        // unrelated source rows, so the data landed in the wrong fields.
        // Pre-exclude them so the user doesn't have to hunt for the bad row
        // in a 300-row preview.
        const malformedRowIndices = new Set<number>();
        for (const err of results.errors) {
          if (
            (err.code === 'TooManyFields' || err.code === 'TooFewFields') &&
            typeof err.row === 'number'
          ) {
            malformedRowIndices.add(err.row);
          }
        }

        if (results.errors.length > 0) {
          // eslint-disable-next-line no-console
          console.warn('CSV parse warnings', results.errors);
        }

        if (malformedRowIndices.size > 0) {
          toast.info(
            `${malformedRowIndices.size} malformed row${
              malformedRowIndices.size === 1 ? '' : 's'
            } auto-excluded. The rest are ready to import.`,
            { duration: 8_000 }
          );
        }

        setCsvHeaders(headers);
        setCsvData(data);
        setExcludedRowIndices(malformedRowIndices);

        const saved = loadSavedMapping(headers);
        if (saved) {
          // Fill any new headers with 'ignore' so the state covers every column.
          // Self-heal stale saved mappings: phone became non-singleton (Apollo
          // splits phone across 5 columns), so upgrade any 'ignore' header that
          // auto-infers to 'phone' — over-mapping phone is strictly safer
          // because the backend just takes the first non-empty value per row.
          const filled: Record<string, TargetField> = {};
          for (const h of headers) {
            const savedTarget = saved[h] ?? 'ignore';
            if (savedTarget === 'ignore' && inferTargetField(h) === 'phone') {
              filled[h] = 'phone';
            } else {
              filled[h] = savedTarget;
            }
          }
          setHeaderMapping(filled);
          setLoadedFromStorage(true);
          setStep('preview');
        } else {
          setHeaderMapping(autoMapHeaders(headers));
          setLoadedFromStorage(false);
          setStep('map');
        }
        },
        error: (err) => {
          toast.error(`Failed to read CSV: ${err.message}`);
        },
      });
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  // Enforces singleton targets — if another header already holds this
  // target, we kick the old owner back to "ignore" so the invariant holds.
  const handleTargetChange = useCallback(
    (header: string, target: TargetField) => {
      setHeaderMapping((prev) => {
        const next = { ...prev };
        if (target !== 'ignore' && SINGLETON_TARGETS.includes(target)) {
          for (const h of Object.keys(next)) {
            if (h !== header && next[h] === target) {
              next[h] = 'ignore';
            }
          }
        }
        next[header] = target;
        return next;
      });
    },
    []
  );

  const columnMapping = useMemo(
    () => buildColumnMapping(headerMapping),
    [headerMapping]
  );

  const hasBusinessName = useMemo(
    () => Object.values(headerMapping).includes('business_name'),
    [headerMapping]
  );
  const hasPhone = useMemo(
    () => Object.values(headerMapping).includes('phone'),
    [headerMapping]
  );

  const canProceedToPreview = hasBusinessName && hasPhone;

  const previewRows = useMemo(() => {
    if (!columnMapping) return [];
    return csvData.map((row) => ({
      business_name: row[columnMapping.business_name] ?? '',
      phone:
        columnMapping.phone
          .map((h) => (row[h] ?? '').trim())
          .find((v) => v.length > 0) ?? '',
      notes: buildPreviewNotes(row, columnMapping),
    }));
  }, [columnMapping, csvData]);

  const selectedCount = csvData.length - excludedRowIndices.size;
  const allSelected = csvData.length > 0 && excludedRowIndices.size === 0;
  const someSelected =
    excludedRowIndices.size > 0 && excludedRowIndices.size < csvData.length;

  const toggleRow = useCallback((idx: number) => {
    setExcludedRowIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setExcludedRowIndices((prev) => {
      if (prev.size === 0) {
        // Currently all selected → deselect all.
        return new Set(csvData.map((_, i) => i));
      }
      // Any partial or fully-excluded state → select all.
      return new Set();
    });
  }, [csvData]);

  const handleImport = () => {
    if (!columnMapping) {
      toast.error('Business Name and Phone must both be mapped');
      return;
    }
    if (selectedCount === 0) {
      toast.error('Select at least one row to import');
      return;
    }
    const filteredData = csvData.filter((_, idx) => !excludedRowIndices.has(idx));
    importMutation.mutate({
      column_mapping: columnMapping,
      data: filteredData,
      campaign_id: campaignId,
    });
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col border border-stone-600/40 transform transition-all animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 pb-0">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[--exec-accent-bg] flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5 text-[--exec-accent]" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-[--exec-text]">
                  Import Cold Call Prospects
                </h2>
                <p className="text-sm text-[--exec-text-muted] mt-1">
                  {step === 'upload' && 'CSV from Outscraper, Apollo, Sheets, or any source'}
                  {step === 'map' && 'Match each CSV column to a Vertex field'}
                  {step === 'preview' && 'Review and import'}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Step indicators */}
          <div className="flex items-center justify-center gap-3 px-4 py-3 rounded-lg bg-stone-800/50 border border-stone-600/40 mb-6">
            {STEP_CONFIG.map((s, idx) => {
              const currentIdx = STEP_CONFIG.findIndex((c) => c.key === step);
              const isCompleted = idx < currentIdx;
              const isCurrent = step === s.key;

              return (
                <div key={s.key} className="flex items-center">
                  <div
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                      isCurrent
                        ? 'bg-[--exec-accent] text-white shadow-sm'
                        : isCompleted
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-stone-700/50 text-[--exec-text-muted]'
                    )}
                  >
                    <span
                      className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center text-xs',
                        isCurrent ? 'bg-black/20' : isCompleted ? 'bg-green-500/30' : 'bg-black/20'
                      )}
                    >
                      {isCompleted ? <Check className="w-3.5 h-3.5" /> : s.number}
                    </span>
                    <span>{s.label}</span>
                  </div>
                  {idx < STEP_CONFIG.length - 1 && (
                    <div
                      className={cn(
                        'w-8 h-0.5 mx-2',
                        isCompleted ? 'bg-green-500' : 'bg-stone-600'
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-6">
          {step === 'upload' && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200',
                isDragging
                  ? 'border-[--exec-accent] bg-[--exec-accent-bg]'
                  : 'border-stone-600/40 hover:border-[--exec-accent] hover:bg-stone-800/30'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Upload
                className={cn(
                  'w-12 h-12 mx-auto mb-4 transition-colors',
                  isDragging ? 'text-[--exec-accent]' : 'text-[--exec-text-muted]'
                )}
              />
              <h3 className="text-lg font-medium text-[--exec-text] mb-2">
                {isDragging ? 'Drop your file here' : 'Upload CSV file'}
              </h3>
              <p className="text-sm text-[--exec-text-muted] mb-4">
                Drag and drop or click to browse
              </p>
              <div className="text-xs text-[--exec-text-muted] leading-relaxed">
                <span className="font-medium text-[--exec-text-secondary]">Business Name</span>
                {' and '}
                <span className="font-medium text-[--exec-text-secondary]">Phone</span>
                {' are required. Other columns map to Vertex fields or append to notes.'}
              </div>
            </div>
          )}

          {step === 'map' && (
            <div className="space-y-4">
              <p className="text-sm text-[--exec-text-secondary]">
                For each CSV column, pick a target field.{' '}
                <span className="text-red-400">*</span> required.
              </p>

              <div className="rounded-lg border border-stone-600/40 overflow-hidden">
                <div className="grid grid-cols-[1fr_minmax(0,1fr)] gap-4 px-4 py-3 bg-stone-800/50 border-b border-stone-600/40">
                  <div className="text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                    CSV Column
                  </div>
                  <div className="text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                    Target Field
                  </div>
                </div>

                <div className="divide-y divide-stone-700/30">
                  {csvHeaders.map((header) => {
                    const target = headerMapping[header] ?? 'ignore';
                    return (
                      <div
                        key={header}
                        className="grid grid-cols-[1fr_minmax(0,1fr)] gap-4 px-4 py-2.5 items-center hover:bg-stone-800/30 transition-colors"
                      >
                        <div className="text-sm text-[--exec-text] truncate font-mono min-w-0">
                          {header}
                        </div>
                        <select
                          value={target}
                          onChange={(e) =>
                            handleTargetChange(header, e.target.value as TargetField)
                          }
                          className={selectClasses}
                        >
                          {TARGET_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                              {opt.required ? ' *' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              {!canProceedToPreview && (
                <div className="flex items-center gap-2 p-3 bg-[--exec-warning-bg] rounded-lg">
                  <AlertCircle className="w-4 h-4 text-[--exec-warning] flex-shrink-0" />
                  <p className="text-sm text-[--exec-warning]">
                    {!hasBusinessName && !hasPhone
                      ? 'Map Business Name and Phone to continue.'
                      : !hasBusinessName
                        ? 'Map Business Name to continue.'
                        : 'Map Phone to continue.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[--exec-text-secondary]">
                  {selectedCount} of {csvData.length} rows selected
                </p>
                {loadedFromStorage && (
                  <button
                    type="button"
                    onClick={() => {
                      setLoadedFromStorage(false);
                      setStep('map');
                    }}
                    className="flex items-center gap-1.5 text-xs font-medium text-[--exec-accent] hover:brightness-110 transition-all"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit mapping
                  </button>
                )}
              </div>

              {loadedFromStorage && (
                <div className="flex items-center gap-2 p-3 bg-[--exec-info-bg] rounded-lg">
                  <Check className="w-4 h-4 text-[--exec-info] flex-shrink-0" />
                  <p className="text-sm text-[--exec-info]">
                    Using saved mapping from a previous import with the same column layout.
                  </p>
                </div>
              )}

              <div className="overflow-x-auto rounded-lg border border-stone-600/40 max-h-[50vh]">
                <table className="min-w-full divide-y divide-stone-700/30">
                  <thead className="bg-stone-800/50 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-3 w-10 text-left">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = someSelected;
                          }}
                          onChange={toggleAll}
                          aria-label={allSelected ? 'Deselect all rows' : 'Select all rows'}
                          className="w-4 h-4 rounded border-stone-600/40 bg-stone-800/50 text-[--exec-accent] focus:ring-2 focus:ring-[--exec-accent]/20 cursor-pointer"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                        Business
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                        Phone
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                        Notes (built)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-700/30">
                    {previewRows.map((row, idx) => {
                      const isExcluded = excludedRowIndices.has(idx);
                      return (
                        <tr
                          key={idx}
                          className={cn(
                            'hover:bg-stone-800/30 transition-colors',
                            isExcluded && 'opacity-40'
                          )}
                        >
                          <td className="px-3 py-3 align-top">
                            <input
                              type="checkbox"
                              checked={!isExcluded}
                              onChange={() => toggleRow(idx)}
                              aria-label={`${isExcluded ? 'Include' : 'Exclude'} row ${idx + 1}`}
                              className="w-4 h-4 rounded border-stone-600/40 bg-stone-800/50 text-[--exec-accent] focus:ring-2 focus:ring-[--exec-accent]/20 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3 text-sm text-[--exec-text] align-top">
                            {row.business_name || (
                              <span className="text-[--exec-text-muted]">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-[--exec-text-secondary] whitespace-nowrap font-mono align-top">
                            {row.phone || <span className="text-[--exec-text-muted]">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-[--exec-text-secondary] align-top leading-relaxed">
                            {row.notes || <span className="text-[--exec-text-muted]">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-2 p-3 bg-[--exec-info-bg] rounded-lg">
                <AlertCircle className="w-4 h-4 text-[--exec-info] flex-shrink-0" />
                <p className="text-sm text-[--exec-info]">
                  Ready to import {selectedCount} prospects. Duplicates (by phone) will be
                  skipped. All rows go to New Leads.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 mt-4 border-t border-stone-700/30">
          <div>
            {step !== 'upload' && (
              <button
                onClick={() => setStep(step === 'preview' ? 'map' : 'upload')}
                className={cn('flex items-center gap-2', secondaryButtonClasses)}
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className={secondaryButtonClasses}
            >
              Cancel
            </button>

            {step === 'map' && (
              <button
                onClick={() => setStep('preview')}
                disabled={!canProceedToPreview}
                className={cn('flex items-center gap-2', primaryButtonClasses)}
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {step === 'preview' && (
              <button
                onClick={handleImport}
                disabled={importMutation.isPending || !columnMapping || selectedCount === 0}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-500 shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Import {selectedCount} Prospects
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
