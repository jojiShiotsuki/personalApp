import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dealApi, contactApi } from '@/lib/api';
import type { Deal, DealCreate } from '@/types';
import { DealStage, BillingFrequency, ServiceStatus } from '@/types';
import { Plus, X, CheckSquare, Trash2, ArrowRightLeft } from 'lucide-react';
import KanbanBoard from '@/components/KanbanBoard';
import AddInteractionModal from '@/components/AddInteractionModal';
import ConfirmModal from '@/components/ConfirmModal';
import { toast } from 'sonner';

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
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [selectedStage, setSelectedStage] = useState<DealStage>(DealStage.LEAD);
  const [isAddInteractionOpen, setIsAddInteractionOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedDealIds, setSelectedDealIds] = useState<Set<number>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkStageTarget, setBulkStageTarget] = useState<DealStage | null>(null);
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
      toast.success('Deal created successfully');
    },
    onError: () => {
      toast.error('Failed to create deal. Please try again.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<DealCreate> }) =>
      dealApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      setIsModalOpen(false);
      setEditingDeal(null);
      toast.success('Deal updated successfully');
    },
    onError: () => {
      toast.error('Failed to update deal. Please try again.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => dealApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast.success('Deal deleted');
    },
    onError: () => {
      toast.error('Failed to delete deal. Please try again.');
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => dealApi.bulkDelete(ids),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      setSelectedDealIds(new Set());
      setShowBulkDeleteConfirm(false);
      toast.success(data.message);
    },
    onError: () => {
      toast.error('Failed to delete deals');
    },
  });

  const bulkStageUpdateMutation = useMutation({
    mutationFn: ({ ids, stage }: { ids: number[]; stage: DealStage }) =>
      dealApi.bulkStageUpdate(ids, stage),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      setSelectedDealIds(new Set());
      setBulkStageTarget(null);
      toast.success(data.message);
    },
    onError: () => {
      toast.error('Failed to update deal stages');
    },
  });

  const handleToggleSelect = (dealId: number) => {
    setSelectedDealIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dealId)) {
        newSet.delete(dealId);
      } else {
        newSet.add(dealId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedDealIds.size === deals.length) {
      setSelectedDealIds(new Set());
    } else {
      setSelectedDealIds(new Set(deals.map(d => d.id)));
    }
  };

  const handleExitEditMode = () => {
    setIsEditMode(false);
    setSelectedDealIds(new Set());
  };

  const handleAddInteraction = (contactId: number) => {
    setSelectedContactId(contactId);
    setIsAddInteractionOpen(true);
  };


  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // Validate required fields
    const contactId = formData.get('contact_id') as string;
    if (!contactId) {
      toast.error('Please select a contact');
      return;
    }

    const title = formData.get('title') as string;
    if (!title?.trim()) {
      toast.error('Please enter a title');
      return;
    }

    const data: DealCreate = {
      contact_id: parseInt(contactId),
      title: formData.get('title') as string,
      description: formData.get('description') as string || undefined,
      value: formData.get('value') ? parseFloat(formData.get('value') as string) : undefined,
      stage: selectedStage,
      probability: parseInt(formData.get('probability') as string) || 50,
      expected_close_date: formData.get('expected_close_date') as string || undefined,
      // Recurring service fields
      is_recurring: isRecurring,
      billing_frequency: isRecurring ? formData.get('billing_frequency') as BillingFrequency || undefined : undefined,
      recurring_amount: isRecurring && formData.get('recurring_amount') ? parseFloat(formData.get('recurring_amount') as string) : undefined,
      service_status: isRecurring ? formData.get('service_status') as ServiceStatus || undefined : undefined,
      service_start_date: isRecurring ? formData.get('service_start_date') as string || undefined : undefined,
      next_billing_date: isRecurring ? formData.get('next_billing_date') as string || undefined : undefined,
    };

    if (editingDeal) {
      updateMutation.mutate({ id: editingDeal.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="flex h-full bg-[--exec-bg] overflow-hidden">
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Header */}
        <div className="px-8 py-6 flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[--exec-text] tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Deals Pipeline</h1>
              <p className="mt-1 text-sm text-[--exec-text-muted]">
                {isEditMode ? (
                  <span className="text-[--exec-accent]">
                    {selectedDealIds.size} deal{selectedDealIds.size !== 1 ? 's' : ''} selected
                  </span>
                ) : (
                  'Manage your sales pipeline visually'
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Edit mode toggle */}
              <button
                onClick={() => isEditMode ? handleExitEditMode() : setIsEditMode(true)}
                className={`flex items-center px-4 py-2 rounded-xl transition-all duration-200 ${
                  isEditMode
                    ? 'bg-stone-600/50 text-[--exec-text] hover:bg-stone-500/50'
                    : 'bg-stone-700/50 text-[--exec-text-secondary] hover:bg-stone-600/50'
                }`}
              >
                <CheckSquare className="w-5 h-5 mr-2" />
                {isEditMode ? 'Exit Edit' : 'Edit Mode'}
              </button>

              {/* Bulk actions - only visible in edit mode with selection */}
              {isEditMode && selectedDealIds.size > 0 && (
                <>
                  {/* Select All / Deselect All */}
                  <button
                    onClick={handleSelectAll}
                    className="px-3 py-2 text-sm text-[--exec-text-secondary] hover:text-[--exec-text] hover:bg-stone-700/50 rounded-lg transition-colors"
                  >
                    {selectedDealIds.size === deals.length ? 'Deselect All' : 'Select All'}
                  </button>

                  {/* Change Stage dropdown */}
                  <div className="relative">
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          setBulkStageTarget(e.target.value as DealStage);
                        }
                      }}
                      className="appearance-none pl-4 pr-8 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-xl border-0 focus:ring-2 focus:ring-amber-500 cursor-pointer text-sm font-medium"
                    >
                      <option value="">Move to...</option>
                      {stages.map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.title}
                        </option>
                      ))}
                    </select>
                    <ArrowRightLeft className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-amber-600 pointer-events-none" />
                  </div>

                  {/* Delete selected */}
                  <button
                    onClick={() => setShowBulkDeleteConfirm(true)}
                    className="flex items-center px-4 py-2 bg-red-100 text-red-700 rounded-xl hover:bg-red-200 transition-all duration-200"
                  >
                    <Trash2 className="w-5 h-5 mr-2" />
                    Delete ({selectedDealIds.size})
                  </button>
                </>
              )}

              {/* Add Deal button - hide in edit mode */}
              {!isEditMode && (
                <button
                  onClick={() => {
                    setEditingDeal(null);
                    setSelectedStage(DealStage.LEAD);
                    setIsRecurring(false);
                    setIsModalOpen(true);
                  }}
                  className="group flex items-center px-4 py-2 bg-[--exec-accent] text-white rounded-xl hover:bg-[--exec-accent-dark] transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <Plus className="w-5 h-5 mr-2 transition-transform duration-200 group-hover:rotate-90" />
                  Add Deal
                </button>
              )}
            </div>
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
              setIsRecurring(deal.is_recurring || false);
              setIsModalOpen(true);
            }}
            onDeleteDeal={(id) => deleteMutation.mutate(id)}
            onAddInteraction={handleAddInteraction}
            isEditMode={isEditMode}
            selectedDealIds={selectedDealIds}
            onToggleSelect={handleToggleSelect}
          />
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-lg mx-4 border border-stone-600/40 transform transition-all animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-[--exec-text]">
                    {editingDeal ? 'Edit Deal' : 'New Deal'}
                  </h2>
                  <p className="text-sm text-[--exec-text-muted] mt-1">
                    {editingDeal ? 'Update deal details' : 'Add a new opportunity to your pipeline'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingDeal(null);
                  }}
                  className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                    Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="title"
                    defaultValue={editingDeal?.title}
                    required
                    autoFocus
                    placeholder="e.g., Website Redesign Project"
                    className="w-full px-4 py-2.5 rounded-lg bg-stone-800/50 border border-stone-600/40 text-[--exec-text] placeholder:text-[--exec-text-muted] focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50 transition-all text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                    Contact <span className="text-red-400">*</span>
                  </label>
                  <select
                    name="contact_id"
                    defaultValue={editingDeal?.contact_id}
                    required
                    className="w-full px-4 py-2.5 rounded-lg bg-stone-800/50 border border-stone-600/40 text-[--exec-text] focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50 transition-all text-sm"
                  >
                    <option value="">Select a contact</option>
                    {contacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                      Value ($)
                    </label>
                    <input
                      type="number"
                      name="value"
                      defaultValue={editingDeal?.value}
                      step="0.01"
                      placeholder="0.00"
                      className="w-full px-4 py-2.5 rounded-lg bg-stone-800/50 border border-stone-600/40 text-[--exec-text] placeholder:text-[--exec-text-muted] focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50 transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                      Probability (%)
                    </label>
                    <input
                      type="number"
                      name="probability"
                      min="0"
                      max="100"
                      defaultValue={editingDeal?.probability || 50}
                      className="w-full px-4 py-2.5 rounded-lg bg-stone-800/50 border border-stone-600/40 text-[--exec-text] placeholder:text-[--exec-text-muted] focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50 transition-all text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                      Stage
                    </label>
                    <select
                      value={selectedStage}
                      onChange={(e) => setSelectedStage(e.target.value as DealStage)}
                      className="w-full px-4 py-2.5 rounded-lg bg-stone-800/50 border border-stone-600/40 text-[--exec-text] focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50 transition-all text-sm"
                    >
                      {stages.map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                      Expected Close
                    </label>
                    <input
                      type="date"
                      name="expected_close_date"
                      defaultValue={editingDeal?.expected_close_date}
                      className="w-full px-4 py-2.5 rounded-lg bg-stone-800/50 border border-stone-600/40 text-[--exec-text] focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50 transition-all text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                    Description
                  </label>
                  <textarea
                    name="description"
                    defaultValue={editingDeal?.description}
                    rows={3}
                    placeholder="Additional details about this deal..."
                    className="w-full px-4 py-2.5 rounded-lg bg-stone-800/50 border border-stone-600/40 text-[--exec-text] placeholder:text-[--exec-text-muted] focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50 transition-all text-sm resize-none"
                  />
                </div>

                {/* Recurring Service Toggle */}
                <div className="pt-4 border-t border-stone-700/30">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="w-4 h-4 text-[--exec-accent] bg-stone-800/50 border-stone-600/40 rounded focus:ring-[--exec-accent]/20"
                    />
                    <div>
                      <span className="text-sm font-medium text-[--exec-text-secondary]">Recurring Service</span>
                      <p className="text-xs text-[--exec-text-muted]">Enable for subscriptions, retainers, or recurring billing</p>
                    </div>
                  </label>
                </div>

                {/* Recurring Service Fields */}
                {isRecurring && (
                  <div className="space-y-4 p-4 bg-[--exec-accent]/10 rounded-xl border border-[--exec-accent]/20">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                          Billing Frequency
                        </label>
                        <select
                          name="billing_frequency"
                          defaultValue={editingDeal?.billing_frequency || ''}
                          className="w-full px-4 py-2.5 rounded-lg bg-stone-800/50 border border-stone-600/40 text-[--exec-text] focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50 transition-all text-sm"
                        >
                          <option value="">Select frequency</option>
                          <option value="monthly">Monthly</option>
                          <option value="quarterly">Quarterly</option>
                          <option value="semi_annual">Semi-Annual</option>
                          <option value="annual">Annual</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                          Recurring Amount ($)
                        </label>
                        <input
                          type="number"
                          name="recurring_amount"
                          defaultValue={editingDeal?.recurring_amount || ''}
                          step="0.01"
                          placeholder="0.00"
                          className="w-full px-4 py-2.5 rounded-lg bg-stone-800/50 border border-stone-600/40 text-[--exec-text] placeholder:text-[--exec-text-muted] focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50 transition-all text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                          Service Status
                        </label>
                        <select
                          name="service_status"
                          defaultValue={editingDeal?.service_status || 'pending'}
                          className="w-full px-4 py-2.5 rounded-lg bg-stone-800/50 border border-stone-600/40 text-[--exec-text] focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50 transition-all text-sm"
                        >
                          <option value="pending">Pending</option>
                          <option value="active">Active</option>
                          <option value="paused">Paused</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                          Service Start Date
                        </label>
                        <input
                          type="date"
                          name="service_start_date"
                          defaultValue={editingDeal?.service_start_date || ''}
                          className="w-full px-4 py-2.5 rounded-lg bg-stone-800/50 border border-stone-600/40 text-[--exec-text] focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50 transition-all text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                        Next Billing Date
                      </label>
                      <input
                        type="date"
                        name="next_billing_date"
                        defaultValue={editingDeal?.next_billing_date || ''}
                        className="w-full px-4 py-2.5 rounded-lg bg-stone-800/50 border border-stone-600/40 text-[--exec-text] focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50 transition-all text-sm"
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-3 justify-end pt-4 border-t border-stone-700/30 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setEditingDeal(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-[--exec-accent] rounded-lg hover:bg-[--exec-accent-dark] shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {createMutation.isPending || updateMutation.isPending
                      ? 'Saving...'
                      : editingDeal
                      ? 'Save Changes'
                      : 'Create Deal'}
                  </button>
                </div>
              </form>
            </div>
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

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showBulkDeleteConfirm}
        onClose={() => setShowBulkDeleteConfirm(false)}
        onConfirm={() => bulkDeleteMutation.mutate(Array.from(selectedDealIds))}
        title="Delete Selected Deals"
        message={`Are you sure you want to delete ${selectedDealIds.size} deal${selectedDealIds.size !== 1 ? 's' : ''}? This action cannot be undone.`}
        confirmText="Delete All"
        variant="danger"
        isLoading={bulkDeleteMutation.isPending}
      />

      {/* Bulk Stage Update Confirmation Modal */}
      <ConfirmModal
        isOpen={bulkStageTarget !== null}
        onClose={() => setBulkStageTarget(null)}
        onConfirm={() => {
          if (bulkStageTarget) {
            bulkStageUpdateMutation.mutate({
              ids: Array.from(selectedDealIds),
              stage: bulkStageTarget,
            });
          }
        }}
        title="Move Deals to New Stage"
        message={`Are you sure you want to move ${selectedDealIds.size} deal${selectedDealIds.size !== 1 ? 's' : ''} to "${stages.find(s => s.id === bulkStageTarget)?.title || bulkStageTarget}"?`}
        confirmText="Move All"
        variant="warning"
        isLoading={bulkStageUpdateMutation.isPending}
      />
    </div>
  );
}
