import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from '@hello-pangea/dnd';
import {
  Upload,
  Plus,
  Circle,
  PhoneOutgoing,
  CheckCircle2,
  XCircle,
  Phone,
  Mail,
  Linkedin,
  MessageCircle,
  Heart,
  Reply,
  Video,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { coldCallsApi, coldOutreachApi } from '@/lib/api';
import { CallProspect, CallStatus, CampaignType, StepChannelType, type OutreachCampaign, type CampaignWithStats, type MultiTouchStep, type CallProspectUpdate } from '@/types';
import CallProspectDetailModal from './CallProspectDetailModal';
import ColdCallCsvImportModal from './ColdCallCsvImportModal';
import AddColdLeadModal from './AddColdLeadModal';
import HubStatsBar, { type HubStat } from './HubStatsBar';
import CampaignSelector from './CampaignSelector';
import NewCampaignModal from '@/components/NewCampaignModal';
import {
  kanbanColumnClasses,
  kanbanColumnAccents,
  kanbanColumnTitleAccents,
  kanbanCountBadgeAccents,
  prospectCardClasses,
  prospectCardHoverClasses,
  prospectCardDraggingClasses,
  type KanbanAccent,
} from '@/lib/outreachStyles';

interface ColumnConfig {
  status: CallStatus;
  label: string;
  accent: KanbanAccent;
}

const COLUMNS: ColumnConfig[] = [
  { status: CallStatus.NEW, label: 'New Leads', accent: 'blue' },
  { status: CallStatus.ATTEMPTED, label: 'Attempted', accent: 'amber' },
  { status: CallStatus.CONNECTED, label: 'Connected', accent: 'emerald' },
  { status: CallStatus.DEAD, label: 'Dead', accent: 'rose' },
];

const smallPrimaryButtonClasses = cn(
  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white',
  'bg-[--exec-accent] hover:bg-[--exec-accent-dark]',
  'transition-all duration-200 shadow-sm hover:shadow-md'
);

const CHANNEL_ICON: Record<string, typeof Phone> = {
  [StepChannelType.PHONE_CALL]: Phone,
  [StepChannelType.EMAIL]: Mail,
  [StepChannelType.FOLLOW_UP_EMAIL]: Reply,
  [StepChannelType.LINKEDIN_CONNECT]: Linkedin,
  [StepChannelType.LINKEDIN_MESSAGE]: MessageCircle,
  [StepChannelType.LINKEDIN_ENGAGE]: Heart,
  [StepChannelType.LOOM_EMAIL]: Video,
  [StepChannelType.CUSTOM]: Sparkles,
};

const CHANNEL_ACCENT: Record<string, string> = {
  [StepChannelType.PHONE_CALL]: 'text-orange-400',
  [StepChannelType.EMAIL]: 'text-blue-400',
  [StepChannelType.FOLLOW_UP_EMAIL]: 'text-purple-400',
  [StepChannelType.LINKEDIN_CONNECT]: 'text-sky-400',
  [StepChannelType.LINKEDIN_MESSAGE]: 'text-indigo-400',
  [StepChannelType.LINKEDIN_ENGAGE]: 'text-amber-400',
  [StepChannelType.LOOM_EMAIL]: 'text-rose-400',
  [StepChannelType.CUSTOM]: 'text-cyan-400',
};

const CHANNEL_LABEL: Record<string, string> = {
  [StepChannelType.PHONE_CALL]: 'Phone Call',
  [StepChannelType.EMAIL]: 'Email',
  [StepChannelType.FOLLOW_UP_EMAIL]: 'Follow-up',
  [StepChannelType.LINKEDIN_CONNECT]: 'LinkedIn Connect',
  [StepChannelType.LINKEDIN_MESSAGE]: 'LinkedIn Message',
  [StepChannelType.LINKEDIN_ENGAGE]: 'LinkedIn Engage',
  [StepChannelType.LOOM_EMAIL]: 'Loom Email',
  [StepChannelType.CUSTOM]: 'Custom',
};

// Channel-colored kanban column chrome for the step-based view.
const CHANNEL_BORDER_TOP: Record<string, string> = {
  [StepChannelType.PHONE_CALL]: 'border-t-orange-500',
  [StepChannelType.EMAIL]: 'border-t-blue-500',
  [StepChannelType.FOLLOW_UP_EMAIL]: 'border-t-purple-500',
  [StepChannelType.LINKEDIN_CONNECT]: 'border-t-sky-500',
  [StepChannelType.LINKEDIN_MESSAGE]: 'border-t-indigo-500',
  [StepChannelType.LINKEDIN_ENGAGE]: 'border-t-amber-500',
  [StepChannelType.LOOM_EMAIL]: 'border-t-rose-500',
  [StepChannelType.CUSTOM]: 'border-t-cyan-500',
};

const CHANNEL_COUNT_BADGE: Record<string, string> = {
  [StepChannelType.PHONE_CALL]: 'bg-orange-500/20 text-orange-400',
  [StepChannelType.EMAIL]: 'bg-blue-500/20 text-blue-400',
  [StepChannelType.FOLLOW_UP_EMAIL]: 'bg-purple-500/20 text-purple-400',
  [StepChannelType.LINKEDIN_CONNECT]: 'bg-sky-500/20 text-sky-400',
  [StepChannelType.LINKEDIN_MESSAGE]: 'bg-indigo-500/20 text-indigo-400',
  [StepChannelType.LINKEDIN_ENGAGE]: 'bg-amber-500/20 text-amber-400',
  [StepChannelType.LOOM_EMAIL]: 'bg-rose-500/20 text-rose-400',
  [StepChannelType.CUSTOM]: 'bg-cyan-500/20 text-cyan-400',
};

function firstNotePreview(notes: string | null): string | null {
  if (!notes) return null;
  const trimmed = notes.trim();
  if (!trimmed) return null;
  // Take the last non-empty line (most recent note if user timestamps them at the bottom)
  const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
  const last = lines[lines.length - 1] ?? '';
  return last.length > 80 ? last.slice(0, 80) + '…' : last;
}

interface CallProspectCardProps {
  prospect: CallProspect;
  index: number;
  onClick: (prospect: CallProspect) => void;
}

function CallProspectCard({ prospect, index, onClick }: CallProspectCardProps) {
  const preview = firstNotePreview(prospect.notes);
  return (
    <Draggable draggableId={`cp-${prospect.id}`} index={index}>
      {(provided, snapshot) => {
        const content = (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            onClick={() => onClick(prospect)}
            className={cn(
              prospectCardClasses,
              prospectCardHoverClasses,
              'cursor-pointer',
              snapshot.isDragging && prospectCardDraggingClasses
            )}
            style={provided.draggableProps.style}
          >
            <h4 className="text-sm font-semibold text-[--exec-text] line-clamp-2 leading-tight mb-1">
              {prospect.business_name}
            </h4>

            {prospect.phone && (
              <p className="text-xs text-[--exec-text-muted] font-mono mb-2">
                {prospect.phone}
              </p>
            )}

            {prospect.vertical && (
              <span className="inline-block text-[10px] uppercase tracking-wider font-medium text-[--exec-text-muted] bg-stone-700/60 px-2 py-0.5 rounded mb-2">
                {prospect.vertical}
              </span>
            )}

            {preview && (
              <p className="text-xs text-[--exec-text-muted] line-clamp-2">
                {preview}
              </p>
            )}
          </div>
        );

        // Portal the dragging clone to document.body to escape the
        // `animate-fade-slide-up` transform on OutreachHub's tab-content wrapper,
        // which creates a containing block and breaks @hello-pangea/dnd's
        // position:fixed drag clone.
        if (snapshot.isDragging) {
          return createPortal(content, document.body);
        }
        return content;
      }}
    </Draggable>
  );
}

interface StepColumnProps {
  step: MultiTouchStep;
  prospects: CallProspect[];
  onCardClick: (prospect: CallProspect) => void;
}

function StepColumn({ step, prospects, onCardClick }: StepColumnProps) {
  const chKey = (step.channel_type || '').toUpperCase();
  const Icon = CHANNEL_ICON[chKey] ?? Phone;
  const accent = CHANNEL_ACCENT[chKey] ?? 'text-stone-400';
  const borderClass = CHANNEL_BORDER_TOP[chKey] ?? 'border-t-stone-500';
  const countBadgeClass = CHANNEL_COUNT_BADGE[chKey] ?? 'bg-stone-500/20 text-stone-400';
  const channelLabel = CHANNEL_LABEL[chKey] ?? chKey;

  return (
    <Droppable droppableId={`step-${step.step_number}`}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={cn(
            'bg-stone-900/30 rounded-xl p-3 min-w-[240px] flex-1',
            'border-t-2 transition-all',
            borderClass,
            snapshot.isDraggingOver && 'ring-2 ring-[--exec-accent]/40 bg-stone-800/40'
          )}
        >
          {/* Column header */}
          <div className="flex items-start justify-between mb-2 gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-5 h-5 rounded-full bg-stone-700/60 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold text-[--exec-text-secondary]">
                  {step.step_number}
                </span>
              </div>
              <Icon className={cn('w-3.5 h-3.5 flex-shrink-0', accent)} />
              <span className={cn('text-xs font-semibold truncate', accent)} title={channelLabel}>
                Step {step.step_number}
              </span>
            </div>
            <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full flex-shrink-0', countBadgeClass)}>
              {prospects.length}
            </span>
          </div>

          {step.instruction_text && (
            <p className="text-[10px] text-[--exec-text-muted] mb-3 line-clamp-2">
              {step.instruction_text}
            </p>
          )}

          {/* Cards */}
          <div className="space-y-2">
            {prospects.map((prospect, index) => (
              <CallProspectCard
                key={prospect.id}
                prospect={prospect}
                index={index}
                onClick={onCardClick}
              />
            ))}
            {provided.placeholder}
            {prospects.length === 0 && !snapshot.isDraggingOver && (
              <p className="text-xs text-[--exec-text-muted] text-center py-4 italic">
                No prospects
              </p>
            )}
          </div>
        </div>
      )}
    </Droppable>
  );
}

interface ColumnProps {
  column: ColumnConfig;
  prospects: CallProspect[];
  onCardClick: (prospect: CallProspect) => void;
}

function Column({ column, prospects, onCardClick }: ColumnProps) {
  return (
    <Droppable droppableId={column.status}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={cn(
            kanbanColumnClasses,
            kanbanColumnAccents[column.accent],
            snapshot.isDraggingOver && 'ring-2 ring-[--exec-accent]/40 bg-stone-800/40'
          )}
        >
          {/* Column header */}
          <div className="flex items-center justify-between mb-3">
            <span
              className={cn(
                'text-xs font-semibold',
                kanbanColumnTitleAccents[column.accent]
              )}
            >
              {column.label}
            </span>
            <span
              className={cn(
                'text-xs font-medium px-1.5 py-0.5 rounded-full',
                kanbanCountBadgeAccents[column.accent]
              )}
            >
              {prospects.length}
            </span>
          </div>

          {/* Cards */}
          <div className="space-y-2">
            {prospects.map((prospect, index) => (
              <CallProspectCard
                key={prospect.id}
                prospect={prospect}
                index={index}
                onClick={onCardClick}
              />
            ))}
            {provided.placeholder}
            {prospects.length === 0 && !snapshot.isDraggingOver && (
              <p className="text-xs text-[--exec-text-muted] text-center py-4 italic">
                No leads
              </p>
            )}
          </div>
        </div>
      )}
    </Droppable>
  );
}

export default function ColdCallsTab() {
  const queryClient = useQueryClient();
  const [selectedProspect, setSelectedProspect] = useState<CallProspect | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [isNewCampaignOpen, setIsNewCampaignOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<OutreachCampaign | null>(null);

  const { data: campaigns = [], isLoading: isCampaignsLoading } = useQuery<OutreachCampaign[]>({
    queryKey: ['outreach-campaigns'],
    queryFn: () => coldOutreachApi.getCampaigns(),
  });

  const { data: selectedCampaignDetail } = useQuery<CampaignWithStats>({
    queryKey: ['outreach-campaign', selectedCampaignId],
    queryFn: () => coldOutreachApi.getCampaign(selectedCampaignId!),
    enabled: selectedCampaignId !== null,
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: (id: number) => coldOutreachApi.deleteCampaign(id),
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['outreach-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['call-prospects'] });
      if (selectedCampaignId === deletedId) setSelectedCampaignId(null);
      toast.success('Campaign deleted');
    },
    onError: () => toast.error('Failed to delete campaign'),
  });

  const handleEditCampaign = (c: OutreachCampaign) => {
    setEditingCampaign(c);
    setIsNewCampaignOpen(true);
  };

  const handleDeleteCampaign = (id: number) => {
    if (window.confirm('Delete this campaign? Prospects stay but become unassigned.')) {
      deleteCampaignMutation.mutate(id);
    }
  };

  const handleCloseCampaignModal = () => {
    setIsNewCampaignOpen(false);
    setEditingCampaign(null);
  };

  const {
    data: prospects = [],
    isLoading,
    isError,
  } = useQuery<CallProspect[]>({
    queryKey: ['call-prospects', selectedCampaignId],
    queryFn: () =>
      coldCallsApi.list(
        selectedCampaignId === null ? undefined : { campaign_id: selectedCampaignId },
      ),
  });

  const updateProspectMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Partial<CallProspectUpdate>) =>
      coldCallsApi.update(id, data),
    onMutate: async ({ id, ...data }) => {
      await queryClient.cancelQueries({ queryKey: ['call-prospects', selectedCampaignId] });
      const previous = queryClient.getQueryData<CallProspect[]>(['call-prospects', selectedCampaignId]);
      queryClient.setQueryData<CallProspect[]>(['call-prospects', selectedCampaignId], (old) =>
        old
          ? old.map((p) =>
              p.id === id
                ? { ...p, ...data, updated_at: new Date().toISOString() }
                : p
            )
          : []
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['call-prospects', selectedCampaignId], context.previous);
      }
      toast.error('Failed to update prospect');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-prospects'] });
    },
  });

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }
    const id = parseInt(draggableId.replace('cp-', ''), 10);
    const dest = destination.droppableId;
    if (dest.startsWith('step-')) {
      const newStep = parseInt(dest.slice(5), 10);
      if (!Number.isNaN(newStep)) {
        updateProspectMutation.mutate({ id, current_step: newStep });
      }
    } else {
      updateProspectMutation.mutate({ id, status: dest as CallStatus });
    }
  };

  const prospectsByStatus = useMemo(() => {
    const map: Record<CallStatus, CallProspect[]> = {
      [CallStatus.NEW]: [],
      [CallStatus.ATTEMPTED]: [],
      [CallStatus.CONNECTED]: [],
      [CallStatus.DEAD]: [],
    };
    for (const p of prospects) {
      if (map[p.status]) {
        map[p.status].push(p);
      }
    }
    return map;
  }, [prospects]);

  // Step-based view: active only when a specific campaign is selected and it
  // has configured multi_touch_steps. Otherwise fall back to status kanban.
  const stepColumns: MultiTouchStep[] =
    selectedCampaignId !== null && selectedCampaignDetail
      ? selectedCampaignDetail.multi_touch_steps ?? []
      : [];
  const isStepView = stepColumns.length > 0;

  const prospectsByStep = useMemo(() => {
    const map: Record<number, CallProspect[]> = {};
    for (const s of stepColumns) map[s.step_number] = [];
    if (stepColumns.length === 0) return map;
    for (const p of prospects) {
      const step = p.current_step ?? 1;
      if (map[step] !== undefined) {
        map[step].push(p);
      } else {
        // Out-of-range step: bucket into the first column rather than dropping.
        map[stepColumns[0].step_number].push(p);
      }
    }
    return map;
  }, [prospects, stepColumns]);

  const stats: HubStat[] = [
    {
      icon: Circle,
      label: 'New',
      value: prospectsByStatus[CallStatus.NEW].length,
      accent: 'blue',
    },
    {
      icon: PhoneOutgoing,
      label: 'Attempted',
      value: prospectsByStatus[CallStatus.ATTEMPTED].length,
      accent: 'amber',
    },
    {
      icon: CheckCircle2,
      label: 'Connected',
      value: prospectsByStatus[CallStatus.CONNECTED].length,
      accent: 'emerald',
    },
    {
      icon: XCircle,
      label: 'Dead',
      value: prospectsByStatus[CallStatus.DEAD].length,
      accent: 'rose',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Campaign selector row */}
      <div className="flex items-center justify-between">
        <CampaignSelector
          campaignTypes={[CampaignType.COLD_CALLS]}
          campaigns={campaigns}
          selectedId={selectedCampaignId}
          onSelect={setSelectedCampaignId}
          onNewClick={() => {
            setEditingCampaign(null);
            setIsNewCampaignOpen(true);
          }}
          onEditClick={handleEditCampaign}
          onDeleteClick={handleDeleteCampaign}
          isLoading={isCampaignsLoading}
        />
      </div>

      {/* Stats bar */}
      <HubStatsBar stats={stats} />

      {/* Kanban */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[--exec-text]">
            {isStepView ? 'Call Sequence' : 'Call Pipeline'}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddOpen(true)}
              className={smallPrimaryButtonClasses}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Lead
            </button>
            <button
              onClick={() => setIsImportOpen(true)}
              className={smallPrimaryButtonClasses}
            >
              <Upload className="w-3.5 h-3.5" />
              Import CSV
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-[--exec-text-muted]">
            Loading prospects...
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center h-64 text-red-400">
            Failed to load prospects. Refresh to retry.
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {isStepView
                ? stepColumns.map((step) => (
                    <StepColumn
                      key={step.step_number}
                      step={step}
                      prospects={prospectsByStep[step.step_number] ?? []}
                      onCardClick={setSelectedProspect}
                    />
                  ))
                : COLUMNS.map((col) => (
                    <Column
                      key={col.status}
                      column={col}
                      prospects={prospectsByStatus[col.status]}
                      onCardClick={setSelectedProspect}
                    />
                  ))}
            </div>
          </DragDropContext>
        )}
      </div>

      {selectedProspect && (
        <CallProspectDetailModal
          prospect={selectedProspect}
          onClose={() => setSelectedProspect(null)}
        />
      )}

      <ColdCallCsvImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        campaignId={selectedCampaignId}
      />

      <AddColdLeadModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        campaignId={selectedCampaignId}
      />

      <NewCampaignModal
        isOpen={isNewCampaignOpen}
        onClose={handleCloseCampaignModal}
        onCreated={(campaignId) => {
          if (!editingCampaign) setSelectedCampaignId(campaignId);
          handleCloseCampaignModal();
        }}
        defaultCampaignType={editingCampaign?.campaign_type ?? CampaignType.COLD_CALLS}
        editCampaign={editingCampaign}
      />
    </div>
  );
}
