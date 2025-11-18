import { Draggable } from '@hello-pangea/dnd';
import { Edit, Trash2, Plus } from 'lucide-react';
import { Deal, Contact } from '@/types';
import { formatCurrency } from '@/lib/currency';
import { cn } from '@/lib/utils';
import FollowUpBadge from './FollowUpBadge';
import NextFollowUpBadge from './NextFollowUpBadge';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dealApi } from '@/lib/api';
import { Timer } from 'lucide-react';

interface DealCardProps {
  deal: Deal;
  index: number;
  contacts: Contact[];
  onEdit: (deal: Deal) => void;
  onDelete: (id: number) => void;
  onAddInteraction?: (contactId: number) => void;
}

function getDaysInStage(updatedAt: string): number {
  const now = new Date();
  const updated = new Date(updatedAt);
  const diffTime = Math.abs(now.getTime() - updated.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export default function DealCard({ deal, index, contacts, onEdit, onDelete, onAddInteraction }: DealCardProps) {
  const daysInStage = getDaysInStage(deal.updated_at);
  const queryClient = useQueryClient();

  const snoozeMutation = useMutation({
    mutationFn: (id: number) => dealApi.snooze(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
  });

  const unsnoozeMutation = useMutation({
    mutationFn: (id: number) => dealApi.unsnooze(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
  });

  return (
    <Draggable draggableId={`deal-${deal.id}`} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={cn(
            'bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-3 group',
            'min-h-[100px]',
            'hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing',
            snapshot.isDragging && 'shadow-lg rotate-2'
          )}
        >
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-semibold text-gray-900 text-sm leading-tight flex-1 pr-2">
              {deal.title}
            </h3>
            <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(deal);
                }}
                className="p-1 hover:bg-gray-100 rounded"
                title="Edit deal"
              >
                <Edit className="w-4 h-4 text-gray-500" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete "${deal.title}"?`)) {
                    onDelete(deal.id);
                  }
                }}
                className="p-1 hover:bg-gray-100 rounded"
                title="Delete deal"
              >
                <Trash2 className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>

          {(() => {
            const contact = contacts.find(c => c.id === deal.contact_id);
            return contact && (
              <p className="text-xs text-gray-500 mb-2">
                {contact.name}
                {contact.company && ` · ${contact.company}`}
              </p>
            );
          })()}

          <div className="flex items-end justify-between">
            <span className="text-lg font-bold text-gray-900">
              {formatCurrency(deal.value || 0)}
            </span>
            <span className="text-xs text-gray-500">
              {daysInStage} day{daysInStage !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Follow-up badges with actions */}
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FollowUpBadge count={deal.followup_count} />
                <NextFollowUpBadge date={deal.next_followup_date} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onAddInteraction && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddInteraction(deal.contact_id);
                  }}
                  className="flex-1 px-2 py-1 text-xs bg-slate-50 text-slate-600 hover:bg-slate-100 rounded flex items-center justify-center gap-1 transition-colors"
                  title="Add follow-up interaction"
                >
                  <Plus className="w-3 h-3" />
                  Add
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  unsnoozeMutation.mutate(deal.id);
                }}
                disabled={unsnoozeMutation.isPending}
                className="flex-1 px-2 py-1 text-xs bg-amber-50 text-amber-600 hover:bg-amber-100 rounded flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                title="Move closer by 3 days"
              >
                <Timer className="w-3 h-3" />
                -3d
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  snoozeMutation.mutate(deal.id);
                }}
                disabled={snoozeMutation.isPending}
                className="flex-1 px-2 py-1 text-xs bg-gray-50 text-gray-600 hover:bg-gray-100 rounded flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                title="Snooze 3 days"
              >
                <Timer className="w-3 h-3" />
                +3d
              </button>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}
