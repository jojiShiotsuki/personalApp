import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Clock, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { coldCallsApi } from '@/lib/api';
import { CallProspect, CallStatus } from '@/types';

interface CallProspectDetailModalProps {
  prospect: CallProspect;
  onClose: () => void;
}

const STATUS_OPTIONS: { value: CallStatus; label: string }[] = [
  { value: CallStatus.NEW, label: 'New' },
  { value: CallStatus.ATTEMPTED, label: 'Attempted' },
  { value: CallStatus.CONNECTED, label: 'Connected' },
  { value: CallStatus.DEAD, label: 'Dead' },
];

const inputClasses = cn(
  'w-full px-4 py-2.5 rounded-lg',
  'bg-stone-800/50 border border-stone-600/40',
  'text-[--exec-text] placeholder:text-[--exec-text-muted]',
  'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
  'transition-all text-sm'
);

function formatTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export default function CallProspectDetailModal({
  prospect,
  onClose,
}: CallProspectDetailModalProps) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(prospect.notes ?? '');
  const [status, setStatus] = useState<CallStatus>(prospect.status);

  // Reset form whenever a different prospect is opened
  useEffect(() => {
    setNotes(prospect.notes ?? '');
    setStatus(prospect.status);
  }, [prospect.id, prospect.notes, prospect.status]);

  const updateMutation = useMutation({
    mutationFn: () =>
      coldCallsApi.update(prospect.id, {
        notes: notes.trim() ? notes : null,
        status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-prospects'] });
      toast.success('Prospect saved');
      onClose();
    },
    onError: () => {
      toast.error('Failed to save prospect');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => coldCallsApi.delete(prospect.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-prospects'] });
      toast.success('Prospect deleted');
      onClose();
    },
    onError: () => {
      toast.error('Failed to delete prospect');
    },
  });

  const handleStampTime = () => {
    const stamp = `[${formatTimestamp()}] `;
    // Append on a new line if there's already content
    setNotes((prev) => {
      if (!prev.trim()) return stamp;
      if (prev.endsWith('\n')) return prev + stamp;
      return prev + '\n' + stamp;
    });
  };

  const handleDelete = () => {
    if (confirm(`Delete "${prospect.business_name}"? This cannot be undone.`)) {
      deleteMutation.mutate();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate();
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-lg mx-4 border border-stone-600/40 transform transition-all animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div className="min-w-0 flex-1 pr-4">
              <h2 className="text-xl font-semibold text-[--exec-text] truncate">
                {prospect.business_name}
              </h2>
              <div className="flex items-center gap-2 mt-1 text-sm text-[--exec-text-muted]">
                {prospect.phone && <span>{prospect.phone}</span>}
                {prospect.phone && prospect.vertical && <span>·</span>}
                {prospect.vertical && <span>{prospect.vertical}</span>}
              </div>
              {prospect.address && (
                <p className="text-xs text-[--exec-text-muted] mt-1 truncate">
                  {prospect.address}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors flex-shrink-0"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Status dropdown */}
            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Stage
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CallStatus)}
                className={cn(inputClasses, 'cursor-pointer appearance-none')}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes textarea with timestamp button */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-[--exec-text-secondary]">
                  Notes
                </label>
                <button
                  type="button"
                  onClick={handleStampTime}
                  className="flex items-center gap-1.5 text-xs font-medium text-[--exec-accent] hover:brightness-110 transition-all"
                >
                  <Clock className="w-3.5 h-3.5" />
                  Stamp time
                </button>
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={10}
                placeholder="Call notes, voicemail outcomes, owner name, etc."
                className={cn(inputClasses, 'resize-none font-mono')}
              />
              <p className="text-xs text-[--exec-text-muted] mt-1">
                Click "Stamp time" to insert a timestamp before typing your next call note.
              </p>
            </div>

            {/* Footer */}
            <div className="flex gap-3 justify-between items-center pt-4 border-t border-stone-700/30 mt-6">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-[--exec-accent] rounded-lg hover:bg-[--exec-accent-dark] shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
