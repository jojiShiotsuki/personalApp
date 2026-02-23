import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { coldOutreachApi } from '@/lib/api';
import type { OutreachCampaign, MultiTouchStepCreate } from '@/types';
import { CampaignType, StepChannelType } from '@/types';
import { X, Plus, Trash2, Mail, Linkedin, MessageCircle, Heart, Reply } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const CHANNEL_CONFIG: Record<StepChannelType, { label: string; icon: typeof Mail; color: string; defaultDelay: number; defaultInstruction: string }> = {
  [StepChannelType.EMAIL]: { label: 'Cold Email', icon: Mail, color: 'text-blue-400', defaultDelay: 0, defaultInstruction: 'Send initial cold email' },
  [StepChannelType.LINKEDIN_CONNECT]: { label: 'LinkedIn Connect', icon: Linkedin, color: 'text-sky-400', defaultDelay: 1, defaultInstruction: 'Send LinkedIn connection request' },
  [StepChannelType.LINKEDIN_ENGAGE]: { label: 'LinkedIn Engage', icon: Heart, color: 'text-amber-400', defaultDelay: 2, defaultInstruction: 'Like or comment on a recent post' },
  [StepChannelType.LINKEDIN_MESSAGE]: { label: 'LinkedIn Message', icon: MessageCircle, color: 'text-indigo-400', defaultDelay: 1, defaultInstruction: 'Send LinkedIn message referencing your email' },
  [StepChannelType.FOLLOW_UP_EMAIL]: { label: 'Follow-up Email', icon: Reply, color: 'text-purple-400', defaultDelay: 2, defaultInstruction: 'Send follow-up email if no reply' },
};

const DEFAULT_MT_STEPS: MultiTouchStepCreate[] = [
  { step_number: 1, channel_type: StepChannelType.EMAIL, delay_days: 0, instruction_text: 'Send initial cold email' },
  { step_number: 2, channel_type: StepChannelType.LINKEDIN_CONNECT, delay_days: 1, instruction_text: 'Send LinkedIn connection request' },
  { step_number: 3, channel_type: StepChannelType.LINKEDIN_ENGAGE, delay_days: 2, instruction_text: 'Like or comment on a recent post' },
  { step_number: 4, channel_type: StepChannelType.LINKEDIN_MESSAGE, delay_days: 1, instruction_text: 'Send LinkedIn message referencing your email' },
  { step_number: 5, channel_type: StepChannelType.FOLLOW_UP_EMAIL, delay_days: 2, instruction_text: 'Send follow-up email if no reply' },
];

interface NewCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (campaignId: number) => void;
  editCampaign?: OutreachCampaign | null;
  defaultCampaignType?: CampaignType;
}

export default function NewCampaignModal({
  isOpen,
  onClose,
  onCreated,
  editCampaign,
  defaultCampaignType = CampaignType.EMAIL,
}: NewCampaignModalProps) {
  const [name, setName] = useState('');
  const [steps, setSteps] = useState<MultiTouchStepCreate[]>([]);
  const queryClient = useQueryClient();
  const isEditing = !!editCampaign;

  const isMultiTouch = isEditing
    ? editCampaign?.campaign_type === CampaignType.MULTI_TOUCH
    : defaultCampaignType === CampaignType.MULTI_TOUCH;

  // Populate form when editing or switching type
  useEffect(() => {
    if (editCampaign) {
      setName(editCampaign.name);
      if (editCampaign.campaign_type === CampaignType.MULTI_TOUCH && editCampaign.multi_touch_steps?.length) {
        setSteps(editCampaign.multi_touch_steps.map(s => ({
          step_number: s.step_number,
          channel_type: s.channel_type,
          delay_days: s.delay_days,
          template_subject: s.template_subject,
          template_content: s.template_content,
          instruction_text: s.instruction_text,
        })));
      } else {
        setSteps([]);
      }
    } else {
      setName('');
      setSteps(defaultCampaignType === CampaignType.MULTI_TOUCH ? [...DEFAULT_MT_STEPS] : []);
    }
  }, [editCampaign, defaultCampaignType]);

  const createMutation = useMutation({
    mutationFn: (data: { name: string; campaign_type: CampaignType; steps?: MultiTouchStepCreate[] }) =>
      coldOutreachApi.createCampaign(data),
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: ['outreach-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['linkedin-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['multi-touch-campaigns'] });
      toast.success(`Campaign "${campaign.name}" created`);
      onCreated(campaign.id);
      handleClose();
    },
    onError: () => {
      toast.error('Failed to create campaign');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: number; name: string; steps?: MultiTouchStepCreate[] }) => {
      const campaign = await coldOutreachApi.updateCampaign(data.id, { name: data.name });
      if (data.steps) {
        await coldOutreachApi.updateCampaignSteps(data.id, data.steps);
      }
      return campaign;
    },
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: ['outreach-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['linkedin-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['multi-touch-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-campaign', campaign.id] });
      queryClient.invalidateQueries({ queryKey: ['linkedin-campaign', campaign.id] });
      toast.success(`Campaign "${campaign.name}" updated`);
      handleClose();
    },
    onError: () => {
      toast.error('Failed to update campaign');
    },
  });

  const handleClose = () => {
    setName('');
    setSteps([]);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter a campaign name');
      return;
    }
    if (isMultiTouch && steps.length === 0) {
      toast.error('Add at least one step to the sequence');
      return;
    }
    if (isEditing && editCampaign) {
      updateMutation.mutate({
        id: editCampaign.id,
        name: name.trim(),
        steps: isMultiTouch ? steps : undefined,
      });
    } else {
      createMutation.mutate({
        name: name.trim(),
        campaign_type: defaultCampaignType,
        steps: isMultiTouch ? steps : undefined,
      });
    }
  };

  const addStep = () => {
    if (steps.length >= 50) return; // generous upper limit
    const nextNum = steps.length + 1;
    setSteps([...steps, {
      step_number: nextNum,
      channel_type: StepChannelType.EMAIL,
      delay_days: 1,
      instruction_text: '',
    }]);
  };

  const removeStep = (index: number) => {
    const newSteps = steps.filter((_, i) => i !== index).map((s, i) => ({
      ...s,
      step_number: i + 1,
    }));
    setSteps(newSteps);
  };

  const updateStep = (index: number, updates: Partial<MultiTouchStepCreate>) => {
    setSteps(steps.map((s, i) => i === index ? { ...s, ...updates } : s));
  };

  const handleChannelChange = (index: number, channel: StepChannelType) => {
    const config = CHANNEL_CONFIG[channel];
    updateStep(index, {
      channel_type: channel,
      delay_days: config.defaultDelay,
      instruction_text: config.defaultInstruction,
    });
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isLinkedIn = isEditing
    ? editCampaign?.campaign_type === CampaignType.LINKEDIN
    : defaultCampaignType === CampaignType.LINKEDIN;

  const getTitle = () => {
    if (isEditing) return 'Edit Campaign';
    if (isMultiTouch) return 'New Multi-Touch Campaign';
    if (isLinkedIn) return 'New LinkedIn Campaign';
    return 'New Campaign';
  };

  if (!isOpen) return null;

  const inputClasses = cn(
    'w-full px-4 py-2.5 rounded-lg',
    'bg-stone-800/50 border border-stone-600/40',
    'text-[--exec-text] placeholder:text-[--exec-text-muted]',
    'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
    'transition-all text-sm'
  );

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className={cn(
        'bg-[--exec-surface] rounded-2xl shadow-2xl w-full mx-4 border border-stone-600/40 animate-in zoom-in-95 duration-200',
        isMultiTouch ? 'max-w-2xl max-h-[90vh] overflow-y-auto' : 'max-w-md'
      )}>
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold text-[--exec-text]">{getTitle()}</h2>
              <p className="text-sm text-[--exec-text-muted] mt-1">
                {isMultiTouch
                  ? 'Coordinate across email and LinkedIn in one sequence'
                  : isLinkedIn
                    ? 'Connection Request \u2192 Message \u2192 Follow-ups'
                    : 'Configure your outreach campaign'}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Campaign Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isMultiTouch ? 'e.g., Q1 Multi-Touch Outreach' : isLinkedIn ? 'e.g., LinkedIn Agency Outreach' : 'e.g., Q1 Agency Outreach'}
                autoFocus
                className={inputClasses}
              />
            </div>

            {/* Step Builder for Multi-Touch */}
            {isMultiTouch && (
              <div className="pt-4 border-t border-stone-700/30">
                <h3 className="text-sm font-semibold text-[--exec-text] mb-3 flex items-center justify-between">
                  <span>Sequence Steps ({steps.length})</span>
                  {steps.length < 50 && (
                    <button
                      type="button"
                      onClick={addStep}
                      className="flex items-center gap-1 text-xs font-medium text-[--exec-accent] hover:text-[--exec-accent-light] transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Step
                    </button>
                  )}
                </h3>

                <div className="space-y-3">
                  {steps.map((step, index) => {
                    const config = CHANNEL_CONFIG[step.channel_type];
                    const Icon = config.icon;
                    return (
                      <div
                        key={index}
                        className="bg-stone-800/30 border border-stone-700/40 rounded-lg p-3"
                      >
                        <div className="flex items-start gap-3">
                          {/* Step number badge */}
                          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-stone-700/60 flex items-center justify-center mt-0.5">
                            <span className="text-xs font-bold text-[--exec-text-secondary]">{step.step_number}</span>
                          </div>

                          <div className="flex-1 space-y-2">
                            {/* Channel type + delay row */}
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <select
                                  value={step.channel_type}
                                  onChange={(e) => handleChannelChange(index, e.target.value as StepChannelType)}
                                  className={cn(inputClasses, 'py-1.5 cursor-pointer appearance-none')}
                                >
                                  {Object.entries(CHANNEL_CONFIG).map(([key, cfg]) => (
                                    <option key={key} value={key}>{cfg.label}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-[--exec-text-muted] whitespace-nowrap">+</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={30}
                                  value={step.delay_days}
                                  onChange={(e) => updateStep(index, { delay_days: parseInt(e.target.value) || 0 })}
                                  className={cn(inputClasses, 'w-16 py-1.5 text-center')}
                                />
                                <span className="text-xs text-[--exec-text-muted] whitespace-nowrap">days</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeStep(index)}
                                className="p-1 text-[--exec-text-muted] hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Instruction text */}
                            <input
                              type="text"
                              value={step.instruction_text || ''}
                              onChange={(e) => updateStep(index, { instruction_text: e.target.value })}
                              placeholder="Instruction shown in queue..."
                              className={cn(inputClasses, 'py-1.5 text-xs')}
                            />

                            {/* Template fields for email/message steps */}
                            {(step.channel_type === StepChannelType.EMAIL ||
                              step.channel_type === StepChannelType.FOLLOW_UP_EMAIL ||
                              step.channel_type === StepChannelType.LINKEDIN_MESSAGE) && (
                              <div className="space-y-1.5">
                                {(step.channel_type === StepChannelType.EMAIL || step.channel_type === StepChannelType.FOLLOW_UP_EMAIL) && (
                                  <input
                                    type="text"
                                    value={step.template_subject || ''}
                                    onChange={(e) => updateStep(index, { template_subject: e.target.value })}
                                    placeholder="Subject line (optional)"
                                    className={cn(inputClasses, 'py-1.5 text-xs')}
                                  />
                                )}
                                <textarea
                                  value={step.template_content || ''}
                                  onChange={(e) => updateStep(index, { template_content: e.target.value })}
                                  placeholder="Template content (optional, use {contact_name}, {agency_name}...)"
                                  rows={2}
                                  className={cn(inputClasses, 'py-1.5 text-xs resize-none')}
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Channel type indicator */}
                        <div className="flex items-center gap-1.5 mt-2 ml-10">
                          <Icon className={cn('w-3 h-3', config.color)} />
                          <span className={cn('text-[10px] font-medium', config.color)}>{config.label}</span>
                          {index === 0 && step.delay_days === 0 && (
                            <span className="text-[10px] text-[--exec-text-muted] ml-1">(starts immediately)</span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {steps.length === 0 && (
                    <div className="text-center py-6 text-[--exec-text-muted] text-sm">
                      No steps yet. Click "Add Step" to build your sequence.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex gap-3 justify-end pt-4 border-t border-stone-700/30 mt-6">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || !name.trim() || (isMultiTouch && steps.length === 0)}
                className="px-4 py-2 text-sm font-medium text-white bg-[--exec-accent] rounded-lg hover:bg-[--exec-accent-dark] shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending
                  ? isEditing ? 'Saving...' : 'Creating...'
                  : isEditing ? 'Save Changes' : 'Create Campaign'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
