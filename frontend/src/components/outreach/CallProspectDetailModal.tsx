import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Clock,
  Trash2,
  Facebook,
  Globe,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { inputClasses, primaryButtonClasses, secondaryButtonClasses } from '@/lib/outreachStyles';
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

function formatTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

// Only treat as a clickable link if it's an http(s) URL — anything else
// (bare domain, javascript:, data:, etc.) renders as plain text so it's
// visible without becoming a footgun.
function isSafeHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

// Split "Sun: 8AM-5PM | Mon: 8AM-5PM" (or comma-separated fallback) into
// one segment per day. Empty input returns an empty array.
function parseWorkingHours(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  const pipeSplit = trimmed.split('|').map((s) => s.trim()).filter(Boolean);
  if (pipeSplit.length > 1) return pipeSplit;
  // Only fall back to comma-split if there was no pipe structure — embedded
  // commas inside time ranges are rare in practice but worth respecting.
  return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
}

export default function CallProspectDetailModal({
  prospect,
  onClose,
}: CallProspectDetailModalProps) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(prospect.notes ?? '');
  const [status, setStatus] = useState<CallStatus>(prospect.status);
  const [descExpanded, setDescExpanded] = useState(false);
  const [descOverflows, setDescOverflows] = useState(false);
  const descRef = useRef<HTMLDivElement>(null);

  // Reset form whenever a different prospect is opened
  useEffect(() => {
    setNotes(prospect.notes ?? '');
    setStatus(prospect.status);
    setDescExpanded(false);
  }, [prospect.id, prospect.notes, prospect.status]);

  // Detect whether the clamped description actually overflows. Only measures
  // while collapsed — when expanded, scrollHeight === clientHeight so
  // skipping the measurement preserves the previous overflow flag and lets
  // the "Show less" button keep rendering.
  useEffect(() => {
    if (!descRef.current || descExpanded) return;
    const el = descRef.current;
    setDescOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [prospect.id, prospect.description, descExpanded]);

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
          {/* Header (address moved into the Listing details section below) */}
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
            </div>
            <button
              onClick={onClose}
              className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors flex-shrink-0"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Lead metadata — source + links. Hidden entirely if all empty. */}
          {(prospect.source || prospect.facebook_url || prospect.website) && (
            <div className="mb-6 space-y-2">
              {prospect.source && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-[--exec-text-muted]">Source:</span>
                  <span className="text-[--exec-text-secondary]">{prospect.source}</span>
                </div>
              )}

              {prospect.facebook_url && (
                <div className="flex items-center gap-2 text-sm min-w-0">
                  <Facebook className="w-3.5 h-3.5 text-[--exec-text-muted] flex-shrink-0" />
                  {isSafeHttpUrl(prospect.facebook_url) ? (
                    <a
                      href={prospect.facebook_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[--exec-accent] hover:brightness-110 truncate transition-all min-w-0"
                    >
                      {prospect.facebook_url}
                    </a>
                  ) : (
                    <span className="text-[--exec-text-secondary] truncate min-w-0">
                      {prospect.facebook_url}
                    </span>
                  )}
                </div>
              )}

              {prospect.website && (
                <div className="flex items-center gap-2 text-sm min-w-0">
                  <Globe className="w-3.5 h-3.5 text-[--exec-text-muted] flex-shrink-0" />
                  {isSafeHttpUrl(prospect.website) ? (
                    <a
                      href={prospect.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[--exec-accent] hover:brightness-110 truncate transition-all min-w-0"
                    >
                      {prospect.website}
                    </a>
                  ) : (
                    <span className="text-[--exec-text-secondary] truncate min-w-0">
                      {prospect.website}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Listing details — rich data from the Google Maps listing. Each
              row is independently conditional, and the whole section hides
              if all 5 fields are null/empty. */}
          {(typeof prospect.rating === 'number' ||
            prospect.address ||
            prospect.google_maps_url ||
            prospect.working_hours ||
            prospect.description) && (
            <div className="mb-6 pt-4 border-t border-stone-700/30 space-y-3">
              <h3 className="text-sm font-semibold text-[--exec-text] mb-3">
                Listing details
              </h3>

              {typeof prospect.rating === 'number' && (
                <div className="flex items-center gap-2 text-sm">
                  <span aria-hidden="true">⭐</span>
                  <span className="font-semibold text-[--exec-text]">
                    {prospect.rating.toFixed(1)}
                  </span>
                  {typeof prospect.reviews_count === 'number' && (
                    <span className="text-[--exec-text-muted]">
                      ({prospect.reviews_count.toLocaleString()} reviews)
                    </span>
                  )}
                </div>
              )}

              {prospect.address && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="w-3.5 h-3.5 text-[--exec-text-muted] flex-shrink-0 mt-0.5" />
                  <span className="text-[--exec-text-secondary]">{prospect.address}</span>
                </div>
              )}

              {prospect.google_maps_url && isSafeHttpUrl(prospect.google_maps_url) && (
                <div className="flex items-center gap-2 text-sm">
                  <ExternalLink className="w-3.5 h-3.5 text-[--exec-text-muted] flex-shrink-0" />
                  <a
                    href={prospect.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[--exec-accent] hover:brightness-110 transition-all"
                  >
                    View on Google Maps
                  </a>
                </div>
              )}

              {prospect.working_hours && (
                <div className="flex items-start gap-2 text-sm">
                  <Clock className="w-3.5 h-3.5 text-[--exec-text-muted] flex-shrink-0 mt-0.5" />
                  <div className="text-[--exec-text-secondary] space-y-0.5 min-w-0">
                    {parseWorkingHours(prospect.working_hours).map((line, idx) => (
                      <div key={idx}>{line}</div>
                    ))}
                  </div>
                </div>
              )}

              {prospect.description && (
                <div className="text-sm text-[--exec-text-secondary]">
                  <div
                    ref={descRef}
                    className={cn(
                      'leading-relaxed whitespace-pre-wrap',
                      !descExpanded && 'line-clamp-3'
                    )}
                  >
                    {prospect.description}
                  </div>
                  {descOverflows && (
                    <button
                      type="button"
                      onClick={() => setDescExpanded((v) => !v)}
                      className="text-xs font-medium text-[--exec-accent] hover:brightness-110 transition-all mt-1"
                    >
                      {descExpanded ? 'Show less' : 'Show more'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

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
                  className={secondaryButtonClasses}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className={primaryButtonClasses}
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
