import { useState } from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dealApi } from '@/lib/api';
import { Deal, DealStage } from '@/types';
import KanbanColumn from './KanbanColumn';
import { toast } from 'sonner';

import { Contact } from '@/types';

interface KanbanBoardProps {
  deals: Deal[];
  contacts: Contact[];
  onEditDeal: (deal: Deal) => void;
  onDeleteDeal: (id: number) => void;
}

const STAGE_ORDER = [
  DealStage.LEAD,
  DealStage.PROSPECT,
  DealStage.PROPOSAL,
  DealStage.NEGOTIATION,
  DealStage.CLOSED_WON,
  DealStage.CLOSED_LOST,
];

export default function KanbanBoard({
  deals,
  contacts,
  onEditDeal,
  onDeleteDeal,
}: KanbanBoardProps) {
  const queryClient = useQueryClient();
  const [collapsedColumns, setCollapsedColumns] = useState<Set<DealStage>>(
    new Set([DealStage.CLOSED_WON, DealStage.CLOSED_LOST])
  );

  const updateStageMutation = useMutation({
    mutationFn: ({ id, stage }: { id: number; stage: DealStage }) =>
      dealApi.update(id, { stage }),
    onMutate: async ({ id, stage }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['deals'] });

      // Snapshot previous value
      const previousDeals = queryClient.getQueryData<Deal[]>(['deals']);

      // Optimistically update
      queryClient.setQueryData<Deal[]>(['deals'], (old) =>
        old
          ? old.map((deal) =>
              deal.id === id ? { ...deal, stage, updated_at: new Date().toISOString() } : deal
            )
          : []
      );

      return { previousDeals };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousDeals) {
        queryClient.setQueryData(['deals'], context.previousDeals);
      }
      toast.error('Failed to update deal stage. Please try again.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast.success('Deal stage updated successfully');
    },
  });

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    // Dropped outside droppable area
    if (!destination) return;

    // Dropped in same position
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    // Extract deal ID from draggableId (format: "deal-123")
    const dealId = parseInt(draggableId.replace('deal-', ''));
    const newStage = destination.droppableId as DealStage;

    updateStageMutation.mutate({ id: dealId, stage: newStage });
  };

  const toggleCollapse = (stage: DealStage) => {
    setCollapsedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) {
        next.delete(stage);
      } else {
        next.add(stage);
      }
      return next;
    });
  };

  // Group deals by stage
  const dealsByStage = deals.reduce((acc, deal) => {
    if (!acc[deal.stage]) {
      acc[deal.stage] = [];
    }
    acc[deal.stage].push(deal);
    return acc;
  }, {} as Record<DealStage, Deal[]>);

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="relative">
        {/* Scroll hint for mobile */}
        <div className="sm:hidden absolute top-0 right-0 bg-gradient-to-l from-gray-100 to-transparent w-8 h-full pointer-events-none z-10" />

        <div className="flex gap-4 overflow-x-auto pb-4 pt-2 px-2">
        {STAGE_ORDER.map((stage) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            deals={dealsByStage[stage] || []}
            contacts={contacts}
            isCollapsed={collapsedColumns.has(stage)}
            onToggleCollapse={() => toggleCollapse(stage)}
            onEditDeal={onEditDeal}
            onDeleteDeal={onDeleteDeal}
          />
        ))}
        </div>
      </div>
    </DragDropContext>
  );
}
