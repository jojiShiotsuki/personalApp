import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  FileSpreadsheet,
  Upload,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { coldCallsApi } from '@/lib/api';
import { CallProspectCsvColumnMapping } from '@/types';

interface ColdCallCsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'upload' | 'map' | 'preview';

const STEP_CONFIG = [
  { key: 'upload' as const, label: 'Upload', number: 1 },
  { key: 'map' as const, label: 'Map Columns', number: 2 },
  { key: 'preview' as const, label: 'Preview & Import', number: 3 },
];

const selectClasses = cn(
  'flex-1 px-4 py-2.5 rounded-lg',
  'bg-stone-800/50 border border-stone-600/40',
  'text-[--exec-text] text-sm',
  'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
  'transition-all'
);

// Parse a CSV line, handling quoted fields correctly.
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && !inQuotes) {
      inQuotes = true;
    } else if (char === '"' && inQuotes) {
      if (nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = false;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function findHeader(
  lowerHeaders: string[],
  headers: string[],
  patterns: string[]
): string | undefined {
  for (const pattern of patterns) {
    const exactIdx = lowerHeaders.findIndex((h) => h === pattern);
    if (exactIdx !== -1) return headers[exactIdx];
  }
  for (const pattern of patterns) {
    const partialIdx = lowerHeaders.findIndex((h) => h.includes(pattern));
    if (partialIdx !== -1) return headers[partialIdx];
  }
  return undefined;
}

// Auto-detect Outscraper-style column names.
function autoDetectMapping(headers: string[]): Partial<CallProspectCsvColumnMapping> {
  const mapping: Partial<CallProspectCsvColumnMapping> = {};
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());

  mapping.business_name = findHeader(lowerHeaders, headers, [
    'name',
    'business_name',
    'business name',
    'company name',
    'company_name',
    'company',
    'title',
  ]);

  mapping.phone = findHeader(lowerHeaders, headers, [
    'phone',
    'phone_1',
    'phone 1',
    'phone number',
    'phone_number',
    'telephone',
    'contact',
    'mobile',
  ]);

  mapping.vertical = findHeader(lowerHeaders, headers, [
    'category',
    'subcategory',
    'type',
    'vertical',
    'niche',
    'industry',
  ]);

  mapping.address = findHeader(lowerHeaders, headers, [
    'full_address',
    'full address',
    'address',
    'street',
    'location',
  ]);

  return mapping;
}

export default function ColdCallCsvImportModal({
  isOpen,
  onClose,
}: ColdCallCsvImportModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Partial<CallProspectCsvColumnMapping>>({});
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: (data: {
      column_mapping: CallProspectCsvColumnMapping;
      data: Record<string, string>[];
    }) => coldCallsApi.import(data),
    onSuccess: (result) => {
      toast.success(
        `Imported ${result.imported_count} prospects${
          result.skipped_count > 0 ? `, skipped ${result.skipped_count}` : ''
        }`
      );
      if (result.errors.length > 0) {
        result.errors.slice(0, 3).forEach((error) => toast.error(error));
      }
      queryClient.invalidateQueries({ queryKey: ['call-prospects'] });
      handleClose();
    },
    onError: () => {
      toast.error('Failed to import prospects');
    },
  });

  const handleClose = () => {
    setStep('upload');
    setCsvHeaders([]);
    setCsvData([]);
    setMapping({});
    setIsDragging(false);
    onClose();
  };

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter((line) => line.trim());

      if (lines.length < 2) {
        toast.error('CSV file must have at least a header row and one data row');
        return;
      }

      const headers = parseCSVLine(lines[0]);
      const data = lines.slice(1).map((line) => {
        const values = parseCSVLine(line);
        const row: Record<string, string> = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx] || '';
        });
        return row;
      });

      setCsvHeaders(headers);
      setCsvData(data);
      setMapping(autoDetectMapping(headers));
      setStep('map');
    };

    reader.onerror = () => {
      toast.error('Failed to read file');
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

  const handleMappingChange = (
    field: keyof CallProspectCsvColumnMapping,
    value: string
  ) => {
    setMapping((prev) => ({
      ...prev,
      [field]: value || undefined,
    }));
  };

  const canProceedToPreview = Boolean(mapping.business_name);

  const handleImport = () => {
    if (!mapping.business_name) {
      toast.error('Business name column is required');
      return;
    }

    const mappedKeys = Object.values(mapping).filter(Boolean) as string[];
    const strippedData = csvData.map((row) => {
      const stripped: Record<string, string> = {};
      for (const key of mappedKeys) {
        if (key in row) stripped[key] = row[key];
      }
      return stripped;
    });

    importMutation.mutate({
      column_mapping: mapping as CallProspectCsvColumnMapping,
      data: strippedData,
    });
  };

  const previewData = csvData.slice(0, 5).map((row) => ({
    business_name: mapping.business_name ? row[mapping.business_name] : '',
    phone: mapping.phone ? row[mapping.phone] : '',
    vertical: mapping.vertical ? row[mapping.vertical] : '',
    address: mapping.address ? row[mapping.address] : '',
  }));

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col border border-stone-600/40 transition-all animate-in zoom-in-95 duration-200">
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
                  {step === 'upload' && 'Upload your Outscraper CSV export'}
                  {step === 'map' && 'Map your columns'}
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
              <div className="text-xs text-[--exec-text-muted]">
                Required:{' '}
                <span className="font-medium text-[--exec-text-secondary]">Business Name</span>
                <br />
                Optional:{' '}
                <span className="text-[--exec-text-secondary]">Phone, Vertical, Address</span>
                <br />
                <span className="text-[--exec-text-muted] mt-1 inline-block">
                  Compatible with Outscraper exports
                </span>
              </div>
            </div>
          )}

          {step === 'map' && (
            <div className="space-y-4">
              <p className="text-sm text-[--exec-text-secondary] mb-4">
                Match your CSV columns to the prospect fields. Fields marked with * are required.
              </p>

              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <label className="w-32 text-sm font-medium text-[--exec-text-secondary] shrink-0">
                    Business Name <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={mapping.business_name || ''}
                    onChange={(e) => handleMappingChange('business_name', e.target.value)}
                    className={cn(selectClasses, !mapping.business_name && 'border-red-400/60')}
                  >
                    <option value="">Select column...</option>
                    {csvHeaders.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-3 border-t border-stone-700/30">
                  <p className="text-xs font-medium text-[--exec-text-muted] mb-3 uppercase tracking-wider">
                    Optional Fields
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <label className="w-32 text-sm font-medium text-[--exec-text-secondary] shrink-0">
                    Phone
                  </label>
                  <select
                    value={mapping.phone || ''}
                    onChange={(e) => handleMappingChange('phone', e.target.value)}
                    className={selectClasses}
                  >
                    <option value="">Not mapped</option>
                    {csvHeaders.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-4">
                  <label className="w-32 text-sm font-medium text-[--exec-text-secondary] shrink-0">
                    Vertical
                  </label>
                  <select
                    value={mapping.vertical || ''}
                    onChange={(e) => handleMappingChange('vertical', e.target.value)}
                    className={selectClasses}
                  >
                    <option value="">Not mapped</option>
                    {csvHeaders.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-4">
                  <label className="w-32 text-sm font-medium text-[--exec-text-secondary] shrink-0">
                    Address
                  </label>
                  <select
                    value={mapping.address || ''}
                    onChange={(e) => handleMappingChange('address', e.target.value)}
                    className={selectClasses}
                  >
                    <option value="">Not mapped</option>
                    {csvHeaders.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!canProceedToPreview && (
                <div className="flex items-center gap-2 p-3 bg-[--exec-warning-bg] rounded-lg mt-4">
                  <AlertCircle className="w-4 h-4 text-[--exec-warning]" />
                  <p className="text-sm text-[--exec-warning]">
                    Please map the Business Name column to continue.
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-[--exec-text-secondary]">
                  Preview of first {Math.min(5, csvData.length)} rows ({csvData.length} total)
                </p>
              </div>

              <div className="overflow-x-auto rounded-lg border border-stone-600/40">
                <table className="min-w-full divide-y divide-stone-700/30">
                  <thead className="bg-stone-800/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                        Business
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                        Phone
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                        Vertical
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                        Address
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-700/30">
                    {previewData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-stone-800/30 transition-colors">
                        <td className="px-4 py-3 text-sm text-[--exec-text] whitespace-nowrap">
                          {row.business_name || (
                            <span className="text-[--exec-text-muted]">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-[--exec-text-secondary] whitespace-nowrap">
                          {row.phone || <span className="text-[--exec-text-muted]">-</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-[--exec-text-secondary] whitespace-nowrap">
                          {row.vertical || <span className="text-[--exec-text-muted]">-</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-[--exec-text-secondary] whitespace-nowrap truncate max-w-[200px]">
                          {row.address || <span className="text-[--exec-text-muted]">-</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-2 p-3 bg-[--exec-info-bg] rounded-lg">
                <AlertCircle className="w-4 h-4 text-[--exec-info]" />
                <p className="text-sm text-[--exec-info]">
                  Ready to import {csvData.length} prospects. Duplicates (by phone) will be skipped.
                  All rows go to New Leads.
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
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors"
            >
              Cancel
            </button>

            {step === 'map' && (
              <button
                onClick={() => setStep('preview')}
                disabled={!canProceedToPreview}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[--exec-accent] rounded-lg hover:bg-[--exec-accent-dark] shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {step === 'preview' && (
              <button
                onClick={handleImport}
                disabled={importMutation.isPending}
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
                    Import {csvData.length} Prospects
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
