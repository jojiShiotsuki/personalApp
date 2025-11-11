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
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to create interaction');
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-bold text-gray-900">Add Interaction</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type *
            </label>
            <select
              name="type"
              required
              defaultValue={InteractionType.MEETING}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={InteractionType.MEETING}>Meeting</option>
              <option value={InteractionType.EMAIL}>Email</option>
              <option value={InteractionType.CALL}>Call</option>
              <option value={InteractionType.NOTE}>Note</option>
              <option value={InteractionType.SOCIAL_MEDIA}>Social Media</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subject
            </label>
            <input
              type="text"
              name="subject"
              placeholder="e.g., Q1 Planning Call"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date & Time *
            </label>
            <input
              type="datetime-local"
              name="interaction_date"
              required
              defaultValue={getCurrentDateTime()}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              name="notes"
              rows={5}
              placeholder="Discussion points, outcomes, follow-ups..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
