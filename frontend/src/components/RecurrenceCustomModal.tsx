import { useState, useEffect } from 'react';
import { RecurrenceType } from '@/types';
import { cn } from '@/lib/utils';

interface RecurrenceCustomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    recurrence_interval: number;
    recurrence_type: RecurrenceType;
    recurrence_days: string[];
    recurrence_end_type: 'never' | 'date' | 'count';
    recurrence_end_date?: string;
    recurrence_count?: number;
  }) => void;
  initialData: {
    recurrence_interval: number;
    recurrence_type: RecurrenceType;
    recurrence_days: string[];
    recurrence_end_type: 'never' | 'date' | 'count';
    recurrence_end_date?: string;
    recurrence_count?: number;
  };
}

const DAYS = [
  { label: 'S', value: 'Sun' },
  { label: 'M', value: 'Mon' },
  { label: 'T', value: 'Tue' },
  { label: 'W', value: 'Wed' },
  { label: 'T', value: 'Thu' },
  { label: 'F', value: 'Fri' },
  { label: 'S', value: 'Sat' },
];

export default function RecurrenceCustomModal({
  isOpen,
  onClose,
  onSave,
  initialData,
}: RecurrenceCustomModalProps) {
  const [interval, setInterval] = useState(1);
  const [type, setType] = useState<RecurrenceType>(RecurrenceType.WEEKLY);
  const [days, setDays] = useState<string[]>([]);
  const [endType, setEndType] = useState<'never' | 'date' | 'count'>('never');
  const [endDate, setEndDate] = useState('');
  const [count, setCount] = useState(13);

  useEffect(() => {
    if (isOpen) {
      setInterval(initialData.recurrence_interval || 1);
      setType(initialData.recurrence_type || RecurrenceType.WEEKLY);
      setDays(initialData.recurrence_days || []);
      setEndType(initialData.recurrence_end_type || 'never');
      setEndDate(initialData.recurrence_end_date || '');
      setCount(initialData.recurrence_count || 13);
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({
      recurrence_interval: interval,
      recurrence_type: type,
      recurrence_days: type === RecurrenceType.WEEKLY ? days : [],
      recurrence_end_type: endType,
      recurrence_end_date: endType === 'date' ? endDate : undefined,
      recurrence_count: endType === 'count' ? count : undefined,
    });
    onClose();
  };

  const toggleDay = (day: string) => {
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const inputClasses = cn(
    "px-3 py-2 rounded-lg",
    "bg-stone-800/50 border border-stone-600/40",
    "text-[--exec-text] text-sm",
    "focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50",
    "transition-all"
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[--exec-surface] rounded-2xl shadow-2xl border border-stone-600/40 flex flex-col animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-stone-700/30">
          <h3 className="text-lg font-semibold text-[--exec-text]">Custom recurrence</h3>
        </div>

        <div className="p-6 space-y-6">
          {/* Repeat every */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-[--exec-text-secondary] font-medium">Repeat every</span>
            <input
              type="number"
              min="1"
              value={interval}
              onChange={(e) => setInterval(parseInt(e.target.value) || 1)}
              className={cn(inputClasses, "w-16 text-center")}
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value as RecurrenceType)}
              className={cn(inputClasses, "flex-1")}
            >
              <option value={RecurrenceType.DAILY}>day{interval > 1 ? 's' : ''}</option>
              <option value={RecurrenceType.WEEKLY}>week{interval > 1 ? 's' : ''}</option>
              <option value={RecurrenceType.MONTHLY}>month{interval > 1 ? 's' : ''}</option>
              <option value={RecurrenceType.YEARLY}>year{interval > 1 ? 's' : ''}</option>
            </select>
          </div>

          {/* Days selection (only for Weekly) */}
          {type === RecurrenceType.WEEKLY && (
            <div className="space-y-2">
              <span className="text-sm text-[--exec-text-secondary] font-medium">Repeat on</span>
              <div className="flex justify-between">
                {DAYS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={cn(
                      "w-8 h-8 rounded-full text-xs font-medium transition-all flex items-center justify-center",
                      days.includes(day.value)
                        ? "bg-[--exec-accent] text-white shadow-sm"
                        : "bg-stone-700/50 text-[--exec-text-muted] hover:bg-stone-600/50"
                    )}
                    title={day.value}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Ends */}
          <div className="space-y-3">
            <span className="text-sm text-[--exec-text-secondary] font-medium">Ends</span>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="endType"
                  value="never"
                  checked={endType === 'never'}
                  onChange={() => setEndType('never')}
                  className="w-4 h-4 text-[--exec-accent] border-stone-600 bg-stone-700 focus:ring-[--exec-accent]/20"
                />
                <span className="text-sm text-[--exec-text-secondary]">Never</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="endType"
                  value="date"
                  checked={endType === 'date'}
                  onChange={() => setEndType('date')}
                  className="w-4 h-4 text-[--exec-accent] border-stone-600 bg-stone-700 focus:ring-[--exec-accent]/20"
                />
                <span className="text-sm text-[--exec-text-secondary] w-16">On</span>
                <input
                  type="date"
                  disabled={endType !== 'date'}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={cn(inputClasses, "flex-1 disabled:opacity-50 disabled:cursor-not-allowed")}
                />
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="endType"
                  value="count"
                  checked={endType === 'count'}
                  onChange={() => setEndType('count')}
                  className="w-4 h-4 text-[--exec-accent] border-stone-600 bg-stone-700 focus:ring-[--exec-accent]/20"
                />
                <span className="text-sm text-[--exec-text-secondary] w-16">After</span>
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="number"
                    min="1"
                    disabled={endType !== 'count'}
                    value={count}
                    onChange={(e) => setCount(parseInt(e.target.value) || 1)}
                    className={cn(inputClasses, "w-20 disabled:opacity-50 disabled:cursor-not-allowed")}
                  />
                  <span className="text-sm text-[--exec-text-muted]">occurrences</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-stone-700/30">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-[--exec-accent] rounded-lg hover:bg-[--exec-accent-dark] shadow-sm transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
