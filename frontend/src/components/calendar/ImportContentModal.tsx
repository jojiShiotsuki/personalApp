import { useState, useMemo } from 'react';
import { X, Upload, FileText, Calendar, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateForApi } from '@/lib/dateUtils';
import { addDays, nextMonday, format } from 'date-fns';
import type { SocialContentCreate } from '@/types';

interface ParsedEntry {
  title: string;
  weekNumber: number;
  weekTheme: string;
  date: Date;
}

interface ImportContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (items: SocialContentCreate[]) => void;
  isLoading?: boolean;
}

function getNextMonday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // If today is Monday, use today. Otherwise, get next Monday.
  if (today.getDay() === 1) return today;
  return nextMonday(today);
}

function formatDateForInput(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function parseContentText(text: string, startDate: Date): ParsedEntry[] {
  const lines = text.split('\n');
  const entries: ParsedEntry[] = [];
  let currentWeek = 0;
  let currentTheme = '';
  let weekEntryIndex = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Match WEEK N: header (case-insensitive)
    const weekMatch = trimmed.match(/^WEEK\s+(\d+)\s*[:\-]\s*(.*)/i);
    if (weekMatch) {
      currentWeek = parseInt(weekMatch[1], 10);
      currentTheme = weekMatch[2].trim().replace(/^\(/, '').replace(/\)$/, '');
      weekEntryIndex = 0;
      continue;
    }

    // Skip lines that look like section markers without content
    if (trimmed.length < 5) continue;

    // If no week header was found yet, put in week 1
    if (currentWeek === 0) currentWeek = 1;

    // Calculate date: week offset + entry index within week
    const weekOffset = (currentWeek - 1) * 7;
    const dayOffset = weekOffset + weekEntryIndex;
    const entryDate = addDays(startDate, dayOffset);

    entries.push({
      title: trimmed,
      weekNumber: currentWeek,
      weekTheme: currentTheme,
      date: entryDate,
    });

    weekEntryIndex++;
  }

  return entries;
}

const inputClasses = cn(
  "w-full px-4 py-2.5 rounded-lg",
  "bg-stone-800/50 border border-stone-600/40",
  "text-[--exec-text] placeholder:text-[--exec-text-muted]",
  "focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50",
  "transition-all text-sm"
);

export default function ImportContentModal({
  isOpen,
  onClose,
  onImport,
  isLoading = false,
}: ImportContentModalProps) {
  const [rawText, setRawText] = useState('');
  const [startDate, setStartDate] = useState<Date>(getNextMonday());

  const parsed = useMemo(
    () => (rawText.trim() ? parseContentText(rawText, startDate) : []),
    [rawText, startDate]
  );

  // Group by week for preview
  const groupedByWeek = useMemo(() => {
    const groups: Record<number, { theme: string; entries: ParsedEntry[] }> = {};
    for (const entry of parsed) {
      if (!groups[entry.weekNumber]) {
        groups[entry.weekNumber] = { theme: entry.weekTheme, entries: [] };
      }
      groups[entry.weekNumber].entries.push(entry);
    }
    return groups;
  }, [parsed]);

  const handleImport = () => {
    const items: SocialContentCreate[] = parsed.map((entry) => ({
      content_date: formatDateForApi(entry.date),
      content_type: 'reel',
      status: 'not_started',
      title: entry.title,
      notes: entry.weekTheme ? `Week ${entry.weekNumber}: ${entry.weekTheme}` : undefined,
    }));
    onImport(items);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-3xl mx-4 border border-stone-600/40 transform transition-all animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold text-[--exec-text]">Import Content Plan</h2>
              <p className="text-sm text-[--exec-text-muted] mt-1">
                Paste your weekly content plan to auto-create calendar entries
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Start date picker */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
              <Calendar className="w-4 h-4 inline mr-1.5 text-[--exec-accent]" />
              Start date (Week 1 begins here)
            </label>
            <input
              type="date"
              value={formatDateForInput(startDate)}
              onChange={(e) => {
                const d = new Date(e.target.value + 'T00:00:00');
                if (!isNaN(d.getTime())) setStartDate(d);
              }}
              className={cn(inputClasses, "max-w-[220px]")}
            />
          </div>

          {/* Textarea */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
              <FileText className="w-4 h-4 inline mr-1.5 text-[--exec-accent]" />
              Content plan text
            </label>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={`WEEK 1: HOOKS + OFFERS\n\nWhy most web designers charge too little\nThe "dream outcome" formula\nI audited 3 random websites. Here's what I found.\n\nWEEK 2: LEAD NURTURE + TRUST\n\nThe 5-second rule - what happens when someone lands on your site\nWhy "just get a website" is terrible advice`}
              className={cn(inputClasses, "resize-none font-mono text-xs leading-relaxed")}
              rows={10}
            />
          </div>

          {/* Preview */}
          {parsed.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[--exec-text] flex items-center">
                  <Upload className="w-4 h-4 mr-2 text-[--exec-accent]" />
                  Preview ({parsed.length} entries)
                </h3>
              </div>

              <div className="bg-stone-800/30 rounded-xl border border-stone-600/30 max-h-[300px] overflow-y-auto">
                {Object.entries(groupedByWeek).map(([weekNum, group]) => (
                  <div key={weekNum}>
                    {/* Week header */}
                    <div className="sticky top-0 px-4 py-2 bg-stone-700/60 backdrop-blur-sm border-b border-stone-600/30">
                      <span className="text-xs font-bold text-[--exec-accent]">
                        WEEK {weekNum}
                      </span>
                      {group.theme && (
                        <span className="text-xs text-[--exec-text-muted] ml-2">
                          {group.theme}
                        </span>
                      )}
                    </div>

                    {/* Entries */}
                    {group.entries.map((entry, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 px-4 py-2.5 border-b border-stone-700/30 last:border-b-0"
                      >
                        <span className="text-xs font-medium text-[--exec-text-muted] min-w-[80px]">
                          {format(entry.date, 'EEE, MMM d')}
                        </span>
                        <span className="text-sm text-[--exec-text]">{entry.title}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state hint */}
          {rawText.trim() && parsed.length === 0 && (
            <div className="flex items-center gap-2 px-4 py-3 mb-4 rounded-lg bg-amber-900/20 border border-amber-700/30 text-amber-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Couldn't parse any entries. Make sure each content idea is on its own line.
            </div>
          )}

          {/* Footer */}
          <div className="flex gap-3 justify-end pt-4 border-t border-stone-700/30 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={parsed.length === 0 || isLoading}
              className="px-5 py-2 text-sm font-medium text-white bg-[--exec-accent] rounded-lg hover:bg-[--exec-accent-dark] shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {isLoading ? 'Importing...' : `Import ${parsed.length} Entries`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
