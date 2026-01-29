import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { interactionApi } from '@/lib/api';
import type { InteractionCreate } from '@/types';
import { InteractionType } from '@/types';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddInteractionModalProps {
  contactId: number;
  onClose: () => void;
}

export default function AddInteractionModal({
  contactId,
  onClose,
}: AddInteractionModalProps) {
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (interaction: InteractionCreate) =>
      interactionApi.create(interaction),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interactions', contactId] });
      onClose();
    },
    onError: (err: Error) => {
      const axiosError = err as Error & { response?: { data?: { detail?: string } } };
      setError(axiosError.response?.data?.detail || 'Failed to create interaction');
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data: InteractionCreate = {
      contact_id: contactId,
      type: formData.get('type') as InteractionType,
      subject: formData.get('subject') as string || undefined,
      notes: formData.get('notes') as string || undefined,
      interaction_date: new Date(formData.get('interaction_date') as string).toISOString(),
    };

    createMutation.mutate(data);
  };

  // Format current datetime for datetime-local input (YYYY-MM-DDTHH:MM)
  const getCurrentDateTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const inputClasses = cn(
    "w-full px-4 py-2.5 rounded-lg",
    "bg-stone-800/50 border border-stone-600/40",
    "text-[--exec-text] placeholder:text-[--exec-text-muted]",
    "focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50",
    "transition-all text-sm"
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] animate-in fade-in duration-200">
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-stone-600/40 transform transition-all animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-700/30">
          <h2 className="text-xl font-bold text-[--exec-text]">Add Interaction</h2>
          <button
            onClick={onClose}
            className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/20 border border-red-500/40 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
              Type <span className="text-red-400">*</span>
            </label>
            <select
              name="type"
              required
              defaultValue={InteractionType.MEETING}
              className={inputClasses}
            >
              <option value={InteractionType.MEETING}>Meeting</option>
              <option value={InteractionType.EMAIL}>Email</option>
              <option value={InteractionType.FOLLOW_UP_EMAIL}>Follow up email</option>
              <option value={InteractionType.CALL}>Call</option>
              <option value={InteractionType.NOTE}>Note</option>
              <option value={InteractionType.SOCIAL_MEDIA}>Social Media</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
              Subject
            </label>
            <input
              type="text"
              name="subject"
              placeholder="e.g., Q1 Planning Call"
              className={inputClasses}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
              Date & Time <span className="text-red-400">*</span>
            </label>
            <input
              type="datetime-local"
              name="interaction_date"
              required
              defaultValue={getCurrentDateTime()}
              className={inputClasses}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
              Notes
            </label>
            <textarea
              name="notes"
              rows={5}
              placeholder="Discussion points, outcomes, follow-ups..."
              className={cn(inputClasses, "resize-none")}
            />
          </div>

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
              disabled={createMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-[--exec-accent] rounded-lg hover:bg-[--exec-accent-dark] shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
