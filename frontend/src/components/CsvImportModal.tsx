import { useState, useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { coldOutreachApi } from '@/lib/api';
import type { CsvColumnMapping } from '@/types';
import { X, FileSpreadsheet, Upload, ChevronRight, ChevronLeft, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: number;
  isLinkedIn?: boolean;
}

type Step = 'upload' | 'map' | 'preview';

const STEP_CONFIG = [
  { key: 'upload' as const, label: 'Upload', number: 1 },
  { key: 'map' as const, label: 'Map Columns', number: 2 },
  { key: 'preview' as const, label: 'Preview & Import', number: 3 },
];

// Parse a CSV line, handling quoted fields correctly
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
        // Escaped quote
        current += '"';
        i++; // Skip next quote
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

// Auto-detect column mapping based on column names
function autoDetectMapping(headers: string[]): Partial<CsvColumnMapping> {
  const mapping: Partial<CsvColumnMapping> = {};
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());

  // Agency name detection
  const agencyPatterns = ['agency_name', 'agency name', 'company', 'company_name', 'company name', 'business', 'business_name', 'name', 'agency'];
  for (const pattern of agencyPatterns) {
    const idx = lowerHeaders.findIndex((h) => h === pattern || h.includes(pattern));
    if (idx !== -1) {
      mapping.agency_name = headers[idx];
      break;
    }
  }

  // Email detection
  const emailPatterns = ['email', 'email_address', 'email address', 'e-mail', 'mail'];
  for (const pattern of emailPatterns) {
    const idx = lowerHeaders.findIndex((h) => h === pattern || h.includes(pattern));
    if (idx !== -1) {
      mapping.email = headers[idx];
      break;
    }
  }

  // Contact name detection
  const contactPatterns = ['contact_name', 'contact name', 'contact', 'person', 'first_name', 'first name', 'full_name', 'full name'];
  for (const pattern of contactPatterns) {
    const idx = lowerHeaders.findIndex((h) => h === pattern || h.includes(pattern));
    if (idx !== -1) {
      mapping.contact_name = headers[idx];
      break;
    }
  }

  // Website detection
  const websitePatterns = ['website', 'url', 'site', 'web', 'domain'];
  for (const pattern of websitePatterns) {
    const idx = lowerHeaders.findIndex((h) => h === pattern || h.includes(pattern));
    if (idx !== -1) {
      mapping.website = headers[idx];
      break;
    }
  }

  // Niche detection
  const nichePatterns = ['niche', 'industry', 'category', 'vertical', 'sector'];
  for (const pattern of nichePatterns) {
    const idx = lowerHeaders.findIndex((h) => h === pattern || h.includes(pattern));
    if (idx !== -1) {
      mapping.niche = headers[idx];
      break;
    }
  }

  // LinkedIn URL detection
  const linkedinPatterns = ['linkedin_url', 'linkedin url', 'linkedin', 'linkedin_profile', 'linkedin profile', 'li_url'];
  for (const pattern of linkedinPatterns) {
    const idx = lowerHeaders.findIndex((h) => h === pattern || h.includes(pattern));
    if (idx !== -1) {
      mapping.linkedin_url = headers[idx];
      break;
    }
  }

  return mapping;
}

export default function CsvImportModal({ isOpen, onClose, campaignId, isLinkedIn = false }: CsvImportModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Partial<CsvColumnMapping>>({});
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: (data: { column_mapping: CsvColumnMapping; data: Record<string, any>[] }) =>
      coldOutreachApi.importProspects(campaignId, data),
    onSuccess: (result) => {
      toast.success(`Imported ${result.imported_count} prospects${result.skipped_count > 0 ? `, skipped ${result.skipped_count}` : ''}`);
      if (result.errors.length > 0) {
        result.errors.slice(0, 3).forEach((error) => toast.error(error));
      }
      queryClient.invalidateQueries({ queryKey: ['outreach-prospects', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['outreach-today-queue', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['outreach-campaign', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['linkedin-prospects', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['linkedin-today-queue', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['linkedin-campaign', campaignId] });
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
        const row: Record<string, any> = {};
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
      if (file) {
        processFile(file);
      }
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
      if (file) {
        processFile(file);
      }
    },
    [processFile]
  );

  const handleMappingChange = (field: keyof CsvColumnMapping, value: string) => {
    setMapping((prev) => ({
      ...prev,
      [field]: value || undefined,
    }));
  };

  const canProceedToPreview = mapping.agency_name && (isLinkedIn ? mapping.linkedin_url : mapping.email);

  const handleImport = () => {
    if (!mapping.agency_name) {
      toast.error('Agency name is required');
      return;
    }
    if (isLinkedIn && !mapping.linkedin_url) {
      toast.error('LinkedIn URL is required for LinkedIn campaigns');
      return;
    }
    if (!isLinkedIn && !mapping.email) {
      toast.error('Email is required');
      return;
    }

    importMutation.mutate({
      column_mapping: mapping as CsvColumnMapping,
      data: csvData,
    });
  };

  // Get preview data with mapped columns
  const previewData = csvData.slice(0, 5).map((row) => ({
    agency_name: mapping.agency_name ? row[mapping.agency_name] : '',
    email: mapping.email ? row[mapping.email] : '',
    contact_name: mapping.contact_name ? row[mapping.contact_name] : '',
    website: mapping.website ? row[mapping.website] : '',
    niche: mapping.niche ? row[mapping.niche] : '',
    linkedin_url: mapping.linkedin_url ? row[mapping.linkedin_url] : '',
  }));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col border border-[--exec-border]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[--exec-border]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[--exec-accent-bg] flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-[--exec-accent]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[--exec-text]">Import Prospects</h2>
              <p className="text-xs text-[--exec-text-muted]">
                {step === 'upload' && 'Upload your CSV file'}
                {step === 'map' && 'Map your columns'}
                {step === 'preview' && 'Review and import'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-[--exec-surface-alt] rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-3 px-6 py-4 border-b border-[--exec-border-subtle]" style={{ backgroundColor: '#1C1917' }}>
          {STEP_CONFIG.map((s, idx) => {
            const currentIdx = STEP_CONFIG.findIndex((c) => c.key === step);
            const isCompleted = idx < currentIdx;
            const isCurrent = step === s.key;

            return (
              <div key={s.key} className="flex items-center">
                <div
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                    isCurrent
                      ? 'text-white shadow-lg'
                      : isCompleted
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-slate-700/50 text-slate-400'
                  )}
                  style={isCurrent ? { backgroundColor: 'var(--exec-accent)' } : undefined}
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
                      isCompleted ? 'bg-green-500' : 'bg-slate-600'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Upload Step */}
          {step === 'upload' && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200',
                isDragging
                  ? 'border-[--exec-accent] bg-[--exec-accent-bg]'
                  : 'border-[--exec-border] hover:border-[--exec-accent] hover:bg-[--exec-accent-bg-subtle]'
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
                Required columns: <span className="font-medium text-[--exec-text-secondary]">agency_name</span>,{' '}
                <span className="font-medium text-[--exec-text-secondary]">{isLinkedIn ? 'linkedin_url' : 'email'}</span>
                <br />
                Optional: <span className="text-[--exec-text-secondary]">contact_name, website, niche{isLinkedIn ? ', email' : ', linkedin_url'}</span>
              </div>
            </div>
          )}

          {/* Map Step */}
          {step === 'map' && (
            <div className="space-y-4">
              <p className="text-sm text-[--exec-text-secondary] mb-6">
                Match your CSV columns to the prospect fields. Fields marked with * are required.
              </p>

              <div className="space-y-4">
                {/* Agency Name - Required */}
                <div className="flex items-center gap-4">
                  <label className="w-32 text-sm font-medium text-[--exec-text]">
                    Agency Name *
                  </label>
                  <select
                    value={mapping.agency_name || ''}
                    onChange={(e) => handleMappingChange('agency_name', e.target.value)}
                    className={cn(
                      'flex-1 px-4 py-2.5 rounded-xl',
                      'bg-[--exec-surface-alt] border border-[--exec-border]',
                      'text-[--exec-text] text-sm',
                      'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]',
                      'transition-all duration-200',
                      !mapping.agency_name && 'border-red-400'
                    )}
                  >
                    <option value="">Select column...</option>
                    {csvHeaders.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>

                {/* LinkedIn URL - Required for LinkedIn campaigns */}
                {isLinkedIn && (
                  <div className="flex items-center gap-4">
                    <label className="w-32 text-sm font-medium text-[--exec-text]">
                      LinkedIn URL *
                    </label>
                    <select
                      value={mapping.linkedin_url || ''}
                      onChange={(e) => handleMappingChange('linkedin_url', e.target.value)}
                      className={cn(
                        'flex-1 px-4 py-2.5 rounded-xl',
                        'bg-[--exec-surface-alt] border border-[--exec-border]',
                        'text-[--exec-text] text-sm',
                        'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]',
                        'transition-all duration-200',
                        !mapping.linkedin_url && 'border-red-400'
                      )}
                    >
                      <option value="">Select column...</option>
                      {csvHeaders.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Email - Required for email campaigns, optional for LinkedIn */}
                <div className="flex items-center gap-4">
                  <label className={cn('w-32 text-sm font-medium', isLinkedIn ? 'text-[--exec-text-secondary]' : 'text-[--exec-text]')}>
                    Email {!isLinkedIn && '*'}
                  </label>
                  <select
                    value={mapping.email || ''}
                    onChange={(e) => handleMappingChange('email', e.target.value)}
                    className={cn(
                      'flex-1 px-4 py-2.5 rounded-xl',
                      'bg-[--exec-surface-alt] border border-[--exec-border]',
                      'text-[--exec-text] text-sm',
                      'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]',
                      'transition-all duration-200',
                      !isLinkedIn && !mapping.email && 'border-red-400'
                    )}
                  >
                    <option value="">{isLinkedIn ? 'Not mapped' : 'Select column...'}</option>
                    {csvHeaders.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Contact Name - Optional */}
                <div className="flex items-center gap-4">
                  <label className="w-32 text-sm font-medium text-[--exec-text-secondary]">
                    Contact Name
                  </label>
                  <select
                    value={mapping.contact_name || ''}
                    onChange={(e) => handleMappingChange('contact_name', e.target.value)}
                    className={cn(
                      'flex-1 px-4 py-2.5 rounded-xl',
                      'bg-[--exec-surface-alt] border border-[--exec-border]',
                      'text-[--exec-text] text-sm',
                      'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]',
                      'transition-all duration-200'
                    )}
                  >
                    <option value="">Not mapped</option>
                    {csvHeaders.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Website - Optional */}
                <div className="flex items-center gap-4">
                  <label className="w-32 text-sm font-medium text-[--exec-text-secondary]">
                    Website
                  </label>
                  <select
                    value={mapping.website || ''}
                    onChange={(e) => handleMappingChange('website', e.target.value)}
                    className={cn(
                      'flex-1 px-4 py-2.5 rounded-xl',
                      'bg-[--exec-surface-alt] border border-[--exec-border]',
                      'text-[--exec-text] text-sm',
                      'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]',
                      'transition-all duration-200'
                    )}
                  >
                    <option value="">Not mapped</option>
                    {csvHeaders.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Niche - Optional */}
                <div className="flex items-center gap-4">
                  <label className="w-32 text-sm font-medium text-[--exec-text-secondary]">
                    Niche
                  </label>
                  <select
                    value={mapping.niche || ''}
                    onChange={(e) => handleMappingChange('niche', e.target.value)}
                    className={cn(
                      'flex-1 px-4 py-2.5 rounded-xl',
                      'bg-[--exec-surface-alt] border border-[--exec-border]',
                      'text-[--exec-text] text-sm',
                      'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]',
                      'transition-all duration-200'
                    )}
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
                <div className="flex items-center gap-2 p-3 bg-[--exec-warning-bg] rounded-xl mt-4">
                  <AlertCircle className="w-4 h-4 text-[--exec-warning]" />
                  <p className="text-sm text-[--exec-warning]">
                    Please map Agency Name and {isLinkedIn ? 'LinkedIn URL' : 'Email'} columns to continue.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Preview Step */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-[--exec-text-secondary]">
                  Preview of first {Math.min(5, csvData.length)} rows ({csvData.length} total)
                </p>
              </div>

              <div className="overflow-x-auto rounded-xl border border-[--exec-border]">
                <table className="min-w-full divide-y divide-[--exec-border]">
                  <thead className="bg-[--exec-surface-alt]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">Agency</th>
                      {isLinkedIn && (
                        <th className="px-4 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">LinkedIn</th>
                      )}
                      <th className="px-4 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">Contact</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">Website</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">Niche</th>
                    </tr>
                  </thead>
                  <tbody className="bg-[--exec-surface] divide-y divide-[--exec-border-subtle]">
                    {previewData.map((row, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-3 text-sm text-[--exec-text] whitespace-nowrap">
                          {row.agency_name || <span className="text-[--exec-text-muted]">-</span>}
                        </td>
                        {isLinkedIn && (
                          <td className="px-4 py-3 text-sm text-blue-400 whitespace-nowrap truncate max-w-[150px]">
                            {row.linkedin_url || <span className="text-[--exec-text-muted]">-</span>}
                          </td>
                        )}
                        <td className="px-4 py-3 text-sm text-[--exec-text-secondary] whitespace-nowrap">
                          {row.email || <span className="text-[--exec-text-muted]">-</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-[--exec-text-secondary] whitespace-nowrap">
                          {row.contact_name || <span className="text-[--exec-text-muted]">-</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-[--exec-text-secondary] whitespace-nowrap truncate max-w-[150px]">
                          {row.website || <span className="text-[--exec-text-muted]">-</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-[--exec-text-secondary] whitespace-nowrap">
                          {row.niche || <span className="text-[--exec-text-muted]">-</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-2 p-3 bg-[--exec-info-bg] rounded-xl">
                <AlertCircle className="w-4 h-4 text-[--exec-info]" />
                <p className="text-sm text-[--exec-info]">
                  Ready to import {csvData.length} prospects. Duplicates (by {isLinkedIn ? 'LinkedIn URL' : 'email'}) will be skipped.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[--exec-border]">
          <div>
            {step !== 'upload' && (
              <button
                onClick={() => setStep(step === 'preview' ? 'map' : 'upload')}
                className={cn(
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl',
                  'bg-slate-600/50 text-slate-300',
                  'hover:bg-slate-500 hover:text-white hover:scale-105',
                  'active:scale-95 transition-all duration-200',
                  'font-medium text-sm'
                )}
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className={cn(
                'px-5 py-2.5 rounded-xl',
                'bg-slate-600/50 text-slate-300',
                'hover:bg-slate-500 hover:text-white hover:scale-105',
                'active:scale-95 transition-all duration-200',
                'font-medium text-sm'
              )}
            >
              Cancel
            </button>

            {step === 'map' && (
              <button
                onClick={() => setStep('preview')}
                disabled={!canProceedToPreview}
                className={cn(
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl',
                  'bg-[--exec-accent] text-white',
                  'hover:brightness-110 hover:scale-105 hover:shadow-lg',
                  'active:scale-95 transition-all duration-200',
                  'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
                  'font-medium text-sm'
                )}
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {step === 'preview' && (
              <button
                onClick={handleImport}
                disabled={importMutation.isPending}
                className={cn(
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl',
                  'bg-green-600 text-white',
                  'hover:bg-green-500 hover:scale-105 hover:shadow-lg',
                  'active:scale-95 transition-all duration-200',
                  'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
                  'font-medium text-sm'
                )}
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
    </div>
  );
}
