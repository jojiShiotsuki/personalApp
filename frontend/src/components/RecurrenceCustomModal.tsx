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

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white dark:bg-gray-800 rounded-xl shadow-2xl ring-1 ring-gray-900/5 dark:ring-white/10 flex flex-col animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Custom recurrence</h3>
        </div>

        <div className="p-6 space-y-6">
          {/* Repeat every */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Repeat every</span>
            <input
              type="number"
              min="1"
              value={interval}
              onChange={(e) => setInterval(parseInt(e.target.value) || 1)}
              className="w-16 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm text-center dark:text-white"
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value as RecurrenceType)}
              className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm dark:text-white"
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
              <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Repeat on</span>
              <div className="flex justify-between">
                {DAYS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={cn(
                      "w-8 h-8 rounded-full text-xs font-medium transition-all flex items-center justify-center",
                      days.includes(day.value)
                        ? "bg-blue-600 dark:bg-blue-500 text-white shadow-sm"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
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
            <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Ends</span>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="endType"
                  value="never"
                  checked={endType === 'never'}
                  onChange={() => setEndType('never')}
                  className="w-4 h-4 text-blue-600 dark:text-blue-500 border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Never</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="endType"
                  value="date"
                  checked={endType === 'date'}
                  onChange={() => setEndType('date')}
                  className="w-4 h-4 text-blue-600 dark:text-blue-500 border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 w-16">On</span>
                <input
                  type="date"
                  disabled={endType !== 'date'}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed dark:text-white"
                />
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="endType"
                  value="count"
                  checked={endType === 'count'}
                  onChange={() => setEndType('count')}
                  className="w-4 h-4 text-blue-600 dark:text-blue-500 border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 w-16">After</span>
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="number"
                    min="1"
                    disabled={endType !== 'count'}
                    value={count}
                    onChange={(e) => setCount(parseInt(e.target.value) || 1)}
                    className="w-20 px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed dark:text-white"
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">occurrences</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 rounded-lg shadow-sm transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
