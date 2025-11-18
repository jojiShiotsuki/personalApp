import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dealApi, contactApi } from '@/lib/api';
import type { DealCreate } from '@/types';
import { DealStage } from '@/types';
import { Plus, X } from 'lucide-react';
import KanbanBoard from '@/components/KanbanBoard';
import AddInteractionModal from '@/components/AddInteractionModal';
import AIChatPanel from '@/components/AIChatPanel';

const stages = [
  { id: DealStage.LEAD, title: 'Lead' },
  { id: DealStage.PROSPECT, title: 'Prospect' },
  { id: DealStage.PROPOSAL, title: 'Proposal' },
  { id: DealStage.NEGOTIATION, title: 'Negotiation' },
  { id: DealStage.CLOSED_WON, title: 'Closed Won' },
  { id: DealStage.CLOSED_LOST, title: 'Closed Lost' },
];

export default function Deals() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<any>(null);
  const [selectedStage, setSelectedStage] = useState<DealStage>(DealStage.LEAD);
  const [isAddInteractionOpen, setIsAddInteractionOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: deals = [] } = useQuery({
    queryKey: ['deals'],
    queryFn: () => dealApi.getAll(),
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => contactApi.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: (deal: DealCreate) => dealApi.create(deal),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      setIsModalOpen(false);
      setEditingDeal(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<DealCreate> }) =>
      dealApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      setIsModalOpen(false);
      setEditingDeal(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => dealApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
  });

  const handleAddInteraction = (contactId: number) => {
    setSelectedContactId(contactId);
    setIsAddInteractionOpen(true);
  };

  const handleDataChange = () => {
    // Refetch deals when AI makes changes
    queryClient.invalidateQueries({ queryKey: ['deals'] });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: DealCreate = {
      contact_id: parseInt(formData.get('contact_id') as string),
      title: formData.get('title') as string,
      description: formData.get('description') as string || undefined,
      value: parseFloat(formData.get('value') as string) || undefined,
      stage: selectedStage,
      probability: parseInt(formData.get('probability') as string) || 50,
      expected_close_date: formData.get('expected_close_date') as string || undefined,
    };

    if (editingDeal) {
      updateMutation.mutate({ id: editingDeal.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col bg-gray-100">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Deals Pipeline</h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage your sales pipeline visually
              </p>
            </div>
            <button
              onClick={() => {
                setEditingDeal(null);
                setSelectedStage(DealStage.LEAD);
                setIsModalOpen(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="inline-block w-5 h-5 mr-2 -mt-1" />
              Add Deal
            </button>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="flex-1 overflow-hidden">
          <KanbanBoard
            deals={deals}
            contacts={contacts}
            onEditDeal={(deal) => {
              setEditingDeal(deal);
              setSelectedStage(deal.stage);
              setIsModalOpen(true);
            }}
            onDeleteDeal={(id) => deleteMutation.mutate(id)}
            onAddInteraction={handleAddInteraction}
          />
        </div>
      </div>

      <AIChatPanel
        page="deals"
        onDataChange={handleDataChange}
      />

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {editingDeal ? 'Edit Deal' : 'New Deal'}
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingDeal(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  name="title"
                  defaultValue={editingDeal?.title}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact *
                </label>
                <select
                  name="contact_id"
                  defaultValue={editingDeal?.contact_id}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a contact</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Value ($)
                </label>
                <input
                  type="number"
                  name="value"
                  defaultValue={editingDeal?.value}
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stage
                </label>
                <select
                  value={selectedStage}
                  onChange={(e) => setSelectedStage(e.target.value as DealStage)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Probability (%)
                </label>
                <input
                  type="number"
                  name="probability"
                  min="0"
                  max="100"
                  defaultValue={editingDeal?.probability || 50}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expected Close Date
                </label>
                <input
                  type="date"
                  name="expected_close_date"
                  defaultValue={editingDeal?.expected_close_date}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  defaultValue={editingDeal?.description}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingDeal(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingDeal
                    ? 'Update'
                    : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Interaction Modal */}
      {isAddInteractionOpen && selectedContactId && (
        <AddInteractionModal
          contactId={selectedContactId}
          onClose={() => {
            setIsAddInteractionOpen(false);
            setSelectedContactId(null);
          }}
        />
      )}
    </div>
  );
}
