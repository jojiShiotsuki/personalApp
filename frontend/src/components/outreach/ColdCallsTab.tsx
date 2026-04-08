import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from '@hello-pangea/dnd';
import { Upload, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { coldCallsApi } from '@/lib/api';
import { CallProspect, CallStatus } from '@/types';
import CallProspectDetailModal from './CallProspectDetailModal';
import ColdCallCsvImportModal from './ColdCallCsvImportModal';

interface ColumnConfig {
  status: CallStatus;
  label: string;
  colorClasses: string;
}

const COLUMNS: ColumnConfig[] = [
  {
    status: CallStatus.NEW,
    label: 'New Leads',
    colorClasses:
      'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  },
  {
    status: CallStatus.ATTEMPTED,
    label: 'Attempted',
    colorClasses:
      'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
  {
    status: CallStatus.CONNECTED,
    label: 'Connected',
    colorClasses:
      'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  },
  {
    status: CallStatus.DEAD,
    label: 'Dead',
    colorClasses:
      'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  },
];

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
              'bg-[--exec-surface] rounded-xl shadow-sm border border-stone-600/40 p-4',
              'cursor-pointer transition-all duration-150',
              'hover:border-[--exec-accent]/60 hover:shadow-md',
              snapshot.isDragging && 'ring-2 ring-[--exec-accent]/60 shadow-lg'
            )}
            style={provided.draggableProps.style}
          >
            <h3 className="text-sm font-semibold text-[--exec-text] truncate">
              {prospect.business_name}
            </h3>

            {prospect.phone && (
              <p className="mt-1.5 text-xs text-[--exec-text-secondary] font-mono">
                {prospect.phone}
              </p>
            )}

            {prospect.vertical && (
              <div className="mt-2">
                <span className="inline-block text-[10px] uppercase tracking-wider font-medium text-[--exec-text-muted] bg-stone-800/60 px-2 py-0.5 rounded">
                  {prospect.vertical}
                </span>
              </div>
            )}

            {preview && (
              <p className="mt-2 text-xs text-[--exec-text-muted] line-clamp-2">
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
    <div className="flex flex-col min-w-[300px] w-[320px] flex-shrink-0 h-full max-h-full">
      <div className="px-3 py-3 flex-shrink-0">
        <div
          className={cn(
            'flex items-center justify-between px-3 py-2 rounded-lg border',
            column.colorClasses
          )}
        >
          <h2 className="text-sm font-medium tracking-tight">{column.label}</h2>
          <span className="text-xs bg-white/50 dark:bg-black/20 px-2 py-0.5 rounded-full font-semibold">
            {prospects.length}
          </span>
        </div>
      </div>

      <Droppable droppableId={column.status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              'flex-1 px-3 pb-3 overflow-y-auto transition-colors duration-200',
              '[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full',
              '[&::-webkit-scrollbar-thumb]:bg-stone-600 [&::-webkit-scrollbar-track]:bg-transparent',
              snapshot.isDraggingOver && 'bg-[--exec-accent]/10 rounded-lg'
            )}
            style={{ scrollbarWidth: 'thin' }}
          >
            <div className="space-y-3">
              {prospects.map((prospect, index) => (
                <CallProspectCard
                  key={prospect.id}
                  prospect={prospect}
                  index={index}
                  onClick={onCardClick}
                />
              ))}
              {provided.placeholder}
            </div>

            {prospects.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex items-center justify-center h-24 text-xs text-[--exec-text-muted] border border-dashed border-stone-700/40 rounded-lg">
                No prospects
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}

export default function ColdCallsTab() {
  const queryClient = useQueryClient();
  const [selectedProspect, setSelectedProspect] = useState<CallProspect | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);

  const {
    data: prospects = [],
    isLoading,
    isError,
  } = useQuery<CallProspect[]>({
    queryKey: ['call-prospects'],
    queryFn: () => coldCallsApi.list(),
  });

  const updateStageMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: CallStatus }) =>
      coldCallsApi.update(id, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['call-prospects'] });
      const previous = queryClient.getQueryData<CallProspect[]>(['call-prospects']);
      queryClient.setQueryData<CallProspect[]>(['call-prospects'], (old) =>
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
        queryClient.setQueryData(['call-prospects'], context.previous);
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

  return (
    <div className="px-8 py-6">
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[--exec-accent-bg] flex items-center justify-center">
            <Phone className="w-5 h-5 text-[--exec-accent]" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-[--exec-text]">
              Cold Calls Pipeline
            </h2>
            <p className="text-sm text-[--exec-text-muted] mt-0.5">
              PH service-business phone prospecting
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsImportOpen(true)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white',
            'transition-all duration-200 shadow-sm hover:shadow-md hover:brightness-110'
          )}
          style={{ backgroundColor: 'var(--exec-accent)' }}
        >
          <Upload className="w-4 h-4" />
          Import CSV
        </button>
      </div>

      {/* Board */}
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
          <div
            className={cn(
              'flex gap-4 overflow-x-auto pb-4 pt-2 px-2',
              'h-[calc(100vh-280px)]',
              '[&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full',
              '[&::-webkit-scrollbar-thumb]:bg-stone-600 [&::-webkit-scrollbar-track]:bg-transparent'
            )}
          >
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
    </div>
  );
}
