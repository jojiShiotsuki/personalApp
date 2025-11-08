import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable, DropResult, DroppableProvided, DroppableStateSnapshot, DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd';
import { dealApi, contactApi } from '@/lib/api';
import type { DealCreate } from '@/types';
import { DealStage } from '@/types';
import { Plus, DollarSign, Calendar, TrendingUp, X, Edit2, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

// Helper function to format currency with abbreviations
function formatCurrency(value: number): string {
  // Handle invalid values
  if (value === null || value === undefined || isNaN(value)) {
    return '$0';
  }

  // Handle 0 or negative values
  if (value === 0) return '$0';
  if (value < 0) return `-${formatCurrency(Math.abs(value))}`;

  // Billions
  if (value >= 1000000000) {
    return `$${(value / 1000000000).toFixed(1)}B`;
  }
  // Millions
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  // Tens of thousands and up
  if (value >= 10000) {
    return `$${Math.round(value / 1000)}k`;
  }
  // Thousands
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}k`;
  }
  // Under 1000
  return `$${Math.round(value)}`;
}

const stageColors: Record<DealStage, string> = {
  [DealStage.LEAD]: 'bg-gray-100 border-gray-300',
  [DealStage.PROSPECT]: 'bg-blue-100 border-blue-300',
  [DealStage.PROPOSAL]: 'bg-yellow-100 border-yellow-300',
  [DealStage.NEGOTIATION]: 'bg-orange-100 border-orange-300',
  [DealStage.CLOSED_WON]: 'bg-green-100 border-green-300',
  [DealStage.CLOSED_LOST]: 'bg-red-100 border-red-300',
};

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
  const queryClient = useQueryClient();

  const { data: deals = [] } = useQuery({
    queryKey: ['deals'],
    queryFn: () => dealApi.getAll(),
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => contactApi.getAll(),
  });

  const updateStageMutation = useMutation({
    mutationFn: ({ id, stage }: { id: number; stage: DealStage }) =>
      dealApi.updateStage(id, stage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
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

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const dealId = parseInt(result.draggableId);
    const newStage = result.destination.droppableId as DealStage;

    updateStageMutation.mutate({ id: dealId, stage: newStage });
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

  const getDealsByStage = (stage: DealStage) => {
    return deals.filter((deal) => deal.stage === stage);
  };

  const getStageValue = (stage: DealStage) => {
    return getDealsByStage(stage).reduce((sum, deal) => sum + (deal.value || 0), 0);
  };

  return (
    <div className="h-full flex flex-col bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Deals Pipeline</h1>
            <p className="mt-1 text-sm text-gray-500">
              Drag and drop deals to update their stage
            </p>
          </div>
          <button
            onClick={() => {
              setEditingDeal(null);
              setSelectedStage(DealStage.LEAD);
              setIsModalOpen(true);
            }}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Deal
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-8">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex space-x-4 h-full">
            {stages.map((stage) => {
              const stageDeals = getDealsByStage(stage.id);
              const stageValue = getStageValue(stage.id);

              return (
                <div key={stage.id} className="flex-shrink-0 w-80">
                  <div className="bg-white rounded-lg shadow-sm h-full flex flex-col">
                    {/* Column Header */}
                    <div className="px-4 py-3 border-b">
                      <h3 className="font-semibold text-gray-900">
                        {stage.title}
                      </h3>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-gray-500">
                          {stageDeals.length} deals
                        </span>
                        <span className="text-xs font-medium text-gray-700">
                          {formatCurrency(stageValue)}
                        </span>
                      </div>
                    </div>

                    {/* Droppable Area */}
                    <Droppable droppableId={stage.id}>
                      {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 p-4 overflow-y-auto ${
                            snapshot.isDraggingOver ? 'bg-blue-50' : ''
                          }`}
                        >
                          <div className="space-y-3">
                            {stageDeals.map((deal, index) => {
                              const contact = contacts.find(
                                (c) => c.id === deal.contact_id
                              );

                              return (
                                <Draggable
                                  key={deal.id}
                                  draggableId={deal.id.toString()}
                                  index={index}
                                >
                                  {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      className={`bg-white border-2 ${
                                        stageColors[deal.stage]
                                      } rounded-lg p-4 cursor-move ${
                                        snapshot.isDragging ? 'shadow-lg' : ''
                                      }`}
                                    >
                                      <h4 className="font-medium text-gray-900 mb-2">
                                        {deal.title}
                                      </h4>

                                      <div className="space-y-2">
                                        {contact && (
                                          <p className="text-sm text-gray-600">
                                            {contact.name}
                                          </p>
                                        )}

                                        {deal.value && (
                                          <div className="flex items-center text-sm text-gray-700">
                                            <DollarSign className="w-4 h-4 mr-1" />
                                            {formatCurrency(deal.value)}
                                          </div>
                                        )}

                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center text-sm text-gray-600">
                                            <TrendingUp className="w-4 h-4 mr-1" />
                                            {deal.probability}%
                                          </div>

                                          {deal.expected_close_date && (
                                            <div className="flex items-center text-xs text-gray-500">
                                              <Calendar className="w-3 h-3 mr-1" />
                                              {format(
                                                parseISO(deal.expected_close_date),
                                                'MMM d'
                                              )}
                                            </div>
                                          )}
                                        </div>

                                        {/* Edit and Delete buttons */}
                                        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingDeal(deal);
                                              setSelectedStage(deal.stage);
                                              setIsModalOpen(true);
                                            }}
                                            className="flex-1 flex items-center justify-center px-2 py-1.5 text-xs text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                                          >
                                            <Edit2 className="w-3 h-3 mr-1" />
                                            Edit
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (confirm('Delete this deal?')) {
                                                deleteMutation.mutate(deal.id);
                                              }
                                            }}
                                            className="flex-1 flex items-center justify-center px-2 py-1.5 text-xs text-red-700 bg-red-100 rounded hover:bg-red-200 transition-colors"
                                          >
                                            <Trash2 className="w-3 h-3 mr-1" />
                                            Delete
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </Draggable>
                              );
                            })}
                          </div>
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
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
    </div>
  );
}
