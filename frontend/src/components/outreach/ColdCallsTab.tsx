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
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { coldCallsApi, coldOutreachApi } from '@/lib/api';
import { CallProspect, CallStatus, CampaignType, type OutreachCampaign } from '@/types';
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

  const updateStageMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: CallStatus }) =>
      coldCallsApi.update(id, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['call-prospects', selectedCampaignId] });
      const previous = queryClient.getQueryData<CallProspect[]>(['call-prospects', selectedCampaignId]);
      queryClient.setQueryData<CallProspect[]>(['call-prospects', selectedCampaignId], (old) =>
        old
          ? old.map((p) =>
              p.id === id
                ? { ...p, status, updated_at: new Date().toISOString() }
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
      toast.error('Failed to update stage');
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
    const newStatus = destination.droppableId as CallStatus;
    updateStageMutation.mutate({ id, status: newStatus });
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
          <h3 className="text-sm font-semibold text-[--exec-text]">Call Pipeline</h3>
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
              {COLUMNS.map((col) => (
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
      />

      <AddColdLeadModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
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
