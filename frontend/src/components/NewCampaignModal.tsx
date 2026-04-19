import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { coldOutreachApi } from '@/lib/api';
import type { OutreachCampaign, MultiTouchStepCreate } from '@/types';
import { CampaignType, StepChannelType, ConditionType, CONDITION_LABELS } from '@/types';
import { X, Plus, Trash2, Mail, Linkedin, MessageCircle, Heart, Reply, ChevronDown, GripVertical, Video, GitBranch, Phone, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const CHANNEL_CONFIG: Record<StepChannelType, { label: string; icon: typeof Mail; color: string; defaultDelay: number; defaultInstruction: string }> = {
  [StepChannelType.EMAIL]: { label: 'Cold Email', icon: Mail, color: 'text-blue-400', defaultDelay: 0, defaultInstruction: 'Send initial cold email' },
  [StepChannelType.LINKEDIN_CONNECT]: { label: 'LinkedIn Connect', icon: Linkedin, color: 'text-sky-400', defaultDelay: 1, defaultInstruction: 'Send LinkedIn connection request' },
  [StepChannelType.LINKEDIN_ENGAGE]: { label: 'LinkedIn Engage', icon: Heart, color: 'text-amber-400', defaultDelay: 2, defaultInstruction: 'Like or comment on a recent post' },
  [StepChannelType.LINKEDIN_MESSAGE]: { label: 'LinkedIn Message', icon: MessageCircle, color: 'text-indigo-400', defaultDelay: 1, defaultInstruction: 'Send LinkedIn message referencing your email' },
  [StepChannelType.FOLLOW_UP_EMAIL]: { label: 'Follow-up Email', icon: Reply, color: 'text-purple-400', defaultDelay: 2, defaultInstruction: 'Send follow-up email if no reply' },
  [StepChannelType.LOOM_EMAIL]: { label: 'Loom Email', icon: Video, color: 'text-rose-400', defaultDelay: 2, defaultInstruction: 'Send email with Loom video walkthrough' },
  [StepChannelType.PHONE_CALL]: { label: 'Phone Call', icon: Phone, color: 'text-orange-400', defaultDelay: 2, defaultInstruction: 'Call and pitch — leave voicemail if no answer' },
  [StepChannelType.CUSTOM]: { label: 'Custom', icon: Sparkles, color: 'text-cyan-400', defaultDelay: 1, defaultInstruction: 'Describe the action to take at this step' },
};

const DEFAULT_MT_STEPS: MultiTouchStepCreate[] = [
  { step_number: 1, channel_type: StepChannelType.EMAIL, delay_days: 0, instruction_text: 'Send initial cold email' },
  { step_number: 2, channel_type: StepChannelType.LINKEDIN_CONNECT, delay_days: 1, instruction_text: 'Send LinkedIn connection request' },
  { step_number: 3, channel_type: StepChannelType.LINKEDIN_ENGAGE, delay_days: 2, instruction_text: 'Like or comment on a recent post' },
  { step_number: 4, channel_type: StepChannelType.LINKEDIN_MESSAGE, delay_days: 1, instruction_text: 'Send LinkedIn message referencing your email' },
  { step_number: 5, channel_type: StepChannelType.FOLLOW_UP_EMAIL, delay_days: 2, instruction_text: 'Send follow-up email if no reply' },
];

const DEFAULT_CC_STEPS: MultiTouchStepCreate[] = [
  { step_number: 1, channel_type: StepChannelType.PHONE_CALL, delay_days: 0, instruction_text: 'First call — introduce yourself, ask to speak with the owner' },
  { step_number: 2, channel_type: StepChannelType.PHONE_CALL, delay_days: 2, instruction_text: 'Second call — try a different time of day' },
  { step_number: 3, channel_type: StepChannelType.PHONE_CALL, delay_days: 3, instruction_text: 'Third call — leave voicemail if still no answer' },
];

/** Renumber steps sequentially starting from 1 */
function renumberSteps(steps: MultiTouchStepCreate[]): MultiTouchStepCreate[] {
  return steps.map((s, i) => ({ ...s, step_number: i + 1 }));
}

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
  const isLinkedIn = isEditing
    ? editCampaign?.campaign_type === CampaignType.LINKEDIN
    : defaultCampaignType === CampaignType.LINKEDIN;
  const isColdCalls = isEditing
    ? editCampaign?.campaign_type === CampaignType.COLD_CALLS
    : defaultCampaignType === CampaignType.COLD_CALLS;
  const hasStepBuilder = isMultiTouch || isColdCalls;

  // Populate form when editing or switching type
  useEffect(() => {
    if (editCampaign) {
      setName(editCampaign.name);
      const editType = editCampaign.campaign_type;
      const editHasSteps =
        (editType === CampaignType.MULTI_TOUCH || editType === CampaignType.COLD_CALLS)
        && editCampaign.multi_touch_steps?.length;
      if (editHasSteps) {
        setSteps(editCampaign.multi_touch_steps!.map(s => ({
          step_number: s.step_number,
          channel_type: (s.channel_type || '').toUpperCase() as StepChannelType,
          delay_days: s.delay_days,
          template_subject: s.template_subject,
          template_content: s.template_content,
          instruction_text: s.instruction_text,
          loom_script: s.loom_script,
          condition_type: s.condition_type,
          condition_step_ref: s.condition_step_ref,
          fallback_channel_type: s.fallback_channel_type,
          fallback_template_subject: s.fallback_template_subject,
          fallback_template_content: s.fallback_template_content,
          fallback_instruction_text: s.fallback_instruction_text,
        })));
      } else {
        setSteps([]);
      }
    } else {
      setName('');
      if (defaultCampaignType === CampaignType.MULTI_TOUCH) {
        setSteps([...DEFAULT_MT_STEPS]);
      } else if (defaultCampaignType === CampaignType.COLD_CALLS) {
        setSteps([...DEFAULT_CC_STEPS]);
      } else {
        setSteps([]);
      }
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
    if (hasStepBuilder && steps.length === 0) {
      toast.error('Add at least one step to the sequence');
      return;
    }
    if (isEditing && editCampaign) {
      updateMutation.mutate({
        id: editCampaign.id,
        name: name.trim(),
        steps: hasStepBuilder ? steps : undefined,
      });
    } else {
      createMutation.mutate({
        name: name.trim(),
        campaign_type: defaultCampaignType,
        steps: hasStepBuilder ? steps : undefined,
      });
    }
  };

  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  // Close add menu on outside click
  useEffect(() => {
    if (!showAddMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showAddMenu]);

  const addStep = (channelType: StepChannelType) => {
    if (steps.length >= 50) return;
    const config = CHANNEL_CONFIG[channelType];
    const newStep: MultiTouchStepCreate = {
      step_number: steps.length + 1,
      channel_type: channelType,
      delay_days: config.defaultDelay,
      instruction_text: config.defaultInstruction,
    };
    setSteps(renumberSteps([...steps, newStep]));
    setShowAddMenu(false);
  };

  const removeStep = (index: number) => {
    setSteps(renumberSteps(steps.filter((_, i) => i !== index)));
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

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) return;

    const reordered = [...steps];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    setSteps(renumberSteps(reordered));
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const getTitle = () => {
    if (isEditing) return 'Edit Campaign';
    if (isMultiTouch) return 'New Multi-Touch Campaign';
    if (isLinkedIn) return 'New LinkedIn Campaign';
    if (isColdCalls) return 'New Cold Calls Campaign';
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
        hasStepBuilder ? 'max-w-2xl max-h-[90vh] overflow-y-auto' : 'max-w-md'
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
                    : isColdCalls
                      ? 'Group phone prospects into a named calling campaign'
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
                placeholder={isMultiTouch ? 'e.g., Q1 Multi-Touch Outreach' : isLinkedIn ? 'e.g., LinkedIn Agency Outreach' : isColdCalls ? 'e.g., Sydney Cafes Apr 2026' : 'e.g., Q1 Agency Outreach'}
                autoFocus
                className={inputClasses}
              />
            </div>

            {/* Step Builder for Multi-Touch and Cold Calls */}
            {hasStepBuilder && (
              <div className="pt-4 border-t border-stone-700/30">
                <h3 className="text-sm font-semibold text-[--exec-text] mb-3 flex items-center justify-between">
                  <span>{isColdCalls ? 'Call Sequence' : 'Sequence Steps'} ({steps.length})</span>
                  {steps.length < 50 && (
                    <div className="relative" ref={addMenuRef}>
                      <button
                        type="button"
                        onClick={() => setShowAddMenu(!showAddMenu)}
                        className="flex items-center gap-1 text-xs font-medium text-[--exec-accent] hover:text-[--exec-accent-light] transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Step
                        <ChevronDown className={cn('w-3 h-3 transition-transform', showAddMenu && 'rotate-180')} />
                      </button>
                      {showAddMenu && (
                        <div className="absolute right-0 top-full mt-1 bg-stone-800 border border-stone-600/60 rounded-lg shadow-xl z-10 py-1 w-52 animate-in fade-in zoom-in-95 duration-150">
                          {Object.entries(CHANNEL_CONFIG).map(([key, cfg]) => {
                            const Icon = cfg.icon;
                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => addStep(key as StepChannelType)}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm text-[--exec-text-secondary] hover:text-[--exec-text] hover:bg-stone-700/60 transition-colors"
                              >
                                <Icon className={cn('w-4 h-4', cfg.color)} />
                                {cfg.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </h3>

                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="campaign-steps">
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="space-y-3"
                      >
                        {steps.map((step, index) => {
                          const config = CHANNEL_CONFIG[step.channel_type];
                          const Icon = config.icon;
                          return (
                            <Draggable key={`step-${index}`} draggableId={`step-${index}`} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={cn(
                                    'bg-stone-800/30 border border-stone-700/40 rounded-lg p-3',
                                    snapshot.isDragging && 'shadow-xl border-[--exec-accent]/40 bg-stone-800/60'
                                  )}
                                >
                                  <div className="flex items-start gap-2">
                                    {/* Drag handle */}
                                    <div
                                      {...provided.dragHandleProps}
                                      className="flex-shrink-0 mt-1.5 p-0.5 cursor-grab active:cursor-grabbing text-[--exec-text-muted] hover:text-[--exec-text] transition-colors rounded hover:bg-stone-700/40"
                                      title="Drag to reorder"
                                    >
                                      <GripVertical className="w-4 h-4" />
                                    </div>

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
                                          <span className="text-xs text-[--exec-text-muted] whitespace-nowrap">{index === 0 ? 'start:' : 'wait'}</span>
                                          <input
                                            type="number"
                                            min={0}
                                            max={30}
                                            value={step.delay_days}
                                            onChange={(e) => updateStep(index, { delay_days: parseInt(e.target.value) || 0 })}
                                            className={cn(inputClasses, 'w-16 py-1.5 text-center')}
                                          />
                                          <span className="text-xs text-[--exec-text-muted] whitespace-nowrap">{index === 0 ? (step.delay_days === 0 ? 'now' : step.delay_days === 1 ? 'day' : 'days') : step.delay_days === 1 ? 'day after' : 'days after'}</span>
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

                                      {/* Condition & Fallback Section */}
                                      <div className="mt-3 pt-3 border-t border-stone-700/30">
                                        <div className="flex items-center gap-2 mb-2">
                                          <GitBranch className="w-3.5 h-3.5 text-slate-400" />
                                          <span className="text-xs font-medium text-slate-400">Condition & Fallback</span>
                                        </div>

                                        {/* Condition selector */}
                                        <div className="mb-2">
                                          <label className="block text-xs text-slate-400 mb-1">If...</label>
                                          <select
                                            value={step.condition_type || ''}
                                            onChange={(e) => updateStep(index, {
                                              condition_type: (e.target.value || undefined) as ConditionType | undefined,
                                              condition_step_ref: undefined,
                                            })}
                                            className="w-full px-3 py-1.5 rounded-lg text-sm bg-stone-800/50 border border-stone-600/40 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                          >
                                            <option value="">Always (no condition)</option>
                                            {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                                              <option key={value} value={value}>{label}</option>
                                            ))}
                                          </select>
                                        </div>

                                        {/* Step reference selector — only for STEP_COMPLETED / STEP_SKIPPED */}
                                        {(step.condition_type === ConditionType.STEP_COMPLETED || step.condition_type === ConditionType.STEP_SKIPPED) && (
                                          <div className="mb-2">
                                            <label className="block text-xs text-slate-400 mb-1">Which step?</label>
                                            <select
                                              value={step.condition_step_ref || ''}
                                              onChange={(e) => updateStep(index, { condition_step_ref: Number(e.target.value) || undefined })}
                                              className="w-full px-3 py-1.5 rounded-lg text-sm bg-stone-800/50 border border-stone-600/40 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                            >
                                              <option value="">Select step...</option>
                                              {steps.filter((_, i) => i < index).map((s, i) => (
                                                <option key={i} value={s.step_number}>Step {s.step_number}</option>
                                              ))}
                                            </select>
                                          </div>
                                        )}

                                        {/* Fallback section — visible when condition is set */}
                                        {step.condition_type && (
                                          <div className="mt-2 p-2.5 bg-stone-800/30 rounded-lg border border-stone-700/30">
                                            <label className="block text-xs text-slate-400 mb-1">Then:</label>
                                            <select
                                              value={step.fallback_channel_type || 'skip'}
                                              onChange={(e) => updateStep(index, {
                                                fallback_channel_type: e.target.value === 'skip' ? undefined : e.target.value as StepChannelType,
                                              })}
                                              className="w-full px-3 py-1.5 rounded-lg text-sm mb-2 bg-stone-800/50 border border-stone-600/40 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                            >
                                              <option value="skip">Just run this step (skip if not met)</option>
                                              {Object.values(StepChannelType).map((ch) => (
                                                <option key={ch} value={ch}>{ch.replace(/_/g, ' ')}</option>
                                              ))}
                                            </select>

                                            {/* Fallback content fields — only when a fallback channel is selected */}
                                            {step.fallback_channel_type && (
                                              <>
                                                {['EMAIL', 'FOLLOW_UP_EMAIL', 'LOOM_EMAIL'].includes(step.fallback_channel_type) && (
                                                  <input
                                                    type="text"
                                                    value={step.fallback_template_subject || ''}
                                                    onChange={(e) => updateStep(index, { fallback_template_subject: e.target.value })}
                                                    placeholder="Fallback subject line..."
                                                    className="w-full px-3 py-1.5 rounded-lg text-sm mb-2 bg-stone-800/50 border border-stone-600/40 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                                  />
                                                )}
                                                <textarea
                                                  value={step.fallback_template_content || ''}
                                                  onChange={(e) => updateStep(index, { fallback_template_content: e.target.value })}
                                                  placeholder="Fallback content/template..."
                                                  rows={2}
                                                  className="w-full px-3 py-1.5 rounded-lg text-sm mb-2 resize-none bg-stone-800/50 border border-stone-600/40 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                                />
                                                <input
                                                  type="text"
                                                  value={step.fallback_instruction_text || ''}
                                                  onChange={(e) => updateStep(index, { fallback_instruction_text: e.target.value })}
                                                  placeholder="Fallback instruction..."
                                                  className="w-full px-3 py-1.5 rounded-lg text-sm bg-stone-800/50 border border-stone-600/40 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                                />
                                              </>
                                            )}
                                          </div>
                                        )}
                                      </div>

                                      {/* Template fields for email/message/connect steps */}
                                      {(step.channel_type === StepChannelType.EMAIL ||
                                        step.channel_type === StepChannelType.FOLLOW_UP_EMAIL ||
                                        step.channel_type === StepChannelType.LINKEDIN_MESSAGE ||
                                        step.channel_type === StepChannelType.LINKEDIN_CONNECT ||
                                        step.channel_type === StepChannelType.LOOM_EMAIL) && (
                                        <div className="space-y-1.5">
                                          {(step.channel_type === StepChannelType.EMAIL || step.channel_type === StepChannelType.FOLLOW_UP_EMAIL || step.channel_type === StepChannelType.LOOM_EMAIL) && (
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
                                            placeholder={step.channel_type === StepChannelType.LOOM_EMAIL ? "Email message to send with the Loom link..." : "Template content (optional, use {contact_name}, {agency_name}...)"}
                                            rows={2}
                                            className={cn(inputClasses, 'py-1.5 text-xs resize-none')}
                                          />
                                          {step.channel_type === StepChannelType.LOOM_EMAIL && (
                                            <textarea
                                              value={(step as any).loom_script || ''}
                                              onChange={(e) => updateStep(index, { loom_script: e.target.value } as any)}
                                              placeholder="Loom recording script — what to say in the video walkthrough..."
                                              rows={3}
                                              className={cn(inputClasses, 'py-1.5 text-xs resize-none border-rose-800/30')}
                                            />
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Channel type indicator */}
                                  <div className="flex items-center gap-1.5 mt-2 ml-16">
                                    <Icon className={cn('w-3 h-3', config.color)} />
                                    <span className={cn('text-[10px] font-medium', config.color)}>{config.label}</span>
                                    <span className="text-[10px] text-[--exec-text-muted] ml-1">
                                      {index === 0
                                        ? step.delay_days === 0 ? '(starts immediately)' : `(starts after ${step.delay_days}d)`
                                        : step.delay_days === 0 ? '(same day as prev step)' : `(${step.delay_days}d after prev step)`
                                      }
                                    </span>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}

                        {steps.length === 0 && (
                          <div className="text-center py-6 text-[--exec-text-muted] text-sm">
                            No steps yet. Click "Add Step" to build your sequence.
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
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
                disabled={isPending || !name.trim() || (hasStepBuilder && steps.length === 0)}
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
