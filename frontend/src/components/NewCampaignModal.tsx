import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { coldOutreachApi } from '@/lib/api';
import type { OutreachCampaign } from '@/types';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface NewCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (campaignId: number) => void;
  editCampaign?: OutreachCampaign | null;
}

export default function NewCampaignModal({
  isOpen,
  onClose,
  onCreated,
  editCampaign,
}: NewCampaignModalProps) {
  const [name, setName] = useState('');
  const queryClient = useQueryClient();
  const isEditing = !!editCampaign;

  // Populate form when editing
  useEffect(() => {
    if (editCampaign) {
      setName(editCampaign.name);
    } else {
      setName('');
    }
  }, [editCampaign]);

  const createMutation = useMutation({
    mutationFn: (data: { name: string }) => coldOutreachApi.createCampaign(data),
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: ['outreach-campaigns'] });
      toast.success(`Campaign "${campaign.name}" created`);
      onCreated(campaign.id);
      handleClose();
    },
    onError: () => {
      toast.error('Failed to create campaign');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: number; name: string }) =>
      coldOutreachApi.updateCampaign(data.id, { name: data.name }),
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: ['outreach-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-campaign', campaign.id] });
      toast.success(`Campaign "${campaign.name}" updated`);
      handleClose();
    },
    onError: () => {
      toast.error('Failed to update campaign');
    },
  });

  const handleClose = () => {
    setName('');
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter a campaign name');
      return;
    }
    if (isEditing && editCampaign) {
      updateMutation.mutate({ id: editCampaign.id, name: name.trim() });
    } else {
      createMutation.mutate({ name: name.trim() });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-[--exec-border] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[--exec-border-subtle]">
          <h2 className="text-lg font-semibold text-[--exec-text]">
            {isEditing ? 'Edit Campaign' : 'New Campaign'}
          </h2>
          <button
            onClick={handleClose}
            className="text-[--exec-text-muted] hover:text-[--exec-text] p-1 hover:bg-[--exec-surface-alt] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6">
            <label
              htmlFor="campaign-name"
              className="block text-sm font-medium text-[--exec-text-secondary] mb-2"
            >
              Campaign Name
            </label>
            <input
              id="campaign-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Q1 Agency Outreach"
              autoFocus
              className={cn(
                'w-full px-4 py-2.5 rounded-xl',
                'bg-[--exec-surface-alt] border border-[--exec-border]',
                'text-[--exec-text] placeholder:text-[--exec-text-muted]',
                'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]',
                'transition-all duration-200'
              )}
            />
            <p className="mt-2 text-xs text-[--exec-text-muted]">
              {isEditing
                ? 'Update the campaign name.'
                : 'You can configure follow-up delays in campaign settings later.'}
            </p>
          </div>

          {/* Footer */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={handleClose}
              className={cn(
                'px-5 py-2.5 rounded-xl font-medium',
                'bg-slate-600/50 text-slate-300',
                'hover:bg-slate-500 hover:text-white hover:scale-105',
                'active:scale-95 transition-all duration-200'
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !name.trim()}
              className={cn(
                'px-5 py-2.5 rounded-xl font-medium',
                'bg-[--exec-accent] text-white',
                'hover:brightness-110 hover:scale-105 hover:shadow-lg',
                'active:scale-95 transition-all duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'
              )}
            >
              {isPending
                ? isEditing
                  ? 'Saving...'
                  : 'Creating...'
                : isEditing
                  ? 'Save Changes'
                  : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
