import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { interactionApi } from '@/lib/api';
import type { InteractionCreate } from '@/types';
import { InteractionType } from '@/types';
import { X } from 'lucide-react';

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

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[60] animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md mx-4 border border-gray-100 dark:border-gray-700 transform transition-all animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add Interaction</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Type <span className="text-rose-500">*</span>
            </label>
            <select
              name="type"
              required
              defaultValue={InteractionType.MEETING}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-500/40 focus:border-blue-500 dark:focus:border-blue-400 transition-all text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            >
              <option value={InteractionType.MEETING}>Meeting</option>
              <option value={InteractionType.EMAIL}>Email</option>
              <option value={InteractionType.CALL}>Call</option>
              <option value={InteractionType.NOTE}>Note</option>
              <option value={InteractionType.SOCIAL_MEDIA}>Social Media</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Subject
            </label>
            <input
              type="text"
              name="subject"
              placeholder="e.g., Q1 Planning Call"
              className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-500/40 focus:border-blue-500 dark:focus:border-blue-400 transition-all text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Date & Time <span className="text-rose-500">*</span>
            </label>
            <input
              type="datetime-local"
              name="interaction_date"
              required
              defaultValue={getCurrentDateTime()}
              className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-500/40 focus:border-blue-500 dark:focus:border-blue-400 transition-all text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Notes
            </label>
            <textarea
              name="notes"
              rows={5}
              placeholder="Discussion points, outcomes, follow-ups..."
              className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-500/40 focus:border-blue-500 dark:focus:border-blue-400 transition-all text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 resize-none"
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-50 dark:border-gray-700 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-xl hover:bg-blue-700 dark:hover:bg-blue-600 shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
