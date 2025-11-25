import { useState } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Edit, Trash2, Plus, Play, Square } from 'lucide-react';
import { Deal, Contact } from '@/types';
import { formatCurrency } from '@/lib/currency';
import { cn } from '@/lib/utils';
import FollowUpBadge from './FollowUpBadge';
import NextFollowUpBadge from './NextFollowUpBadge';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dealApi } from '@/lib/api';
import { Timer } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { useTimer, formatElapsedTime } from '@/contexts/TimerContext';
import { toast } from 'sonner';

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const queryClient = useQueryClient();
  const { currentTimer, startTimer, stopTimer, elapsedSeconds } = useTimer();
  const isTimerRunningForThis = currentTimer?.deal_id === deal.id;

  const handleTimerClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTimerRunningForThis) {
      await stopTimer();
      toast.success('Timer stopped');
    } else {
      await startTimer({
        deal_id: deal.id,
        description: deal.title,
      });
      toast.success('Timer started');
    }
  };

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
            'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 group',
            // Only apply transitions when NOT dragging to avoid interfering with dnd transforms
            !snapshot.isDragging && 'transition-all duration-200 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 hover:-translate-y-0.5',
            snapshot.isDragging && 'shadow-2xl rotate-2 scale-105 z-50 cursor-grabbing'
          )}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 pr-2">
              <h3 className="font-bold text-gray-900 dark:text-white text-sm leading-snug line-clamp-2">
                {deal.title}
              </h3>
              {isTimerRunningForThis && (
                <span className="inline-flex items-center mt-1 text-xs font-mono font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded animate-pulse">
                  {formatElapsedTime(elapsedSeconds)}
                </span>
              )}
            </div>
            <div className={cn(
              "flex-shrink-0 flex gap-1 transition-opacity",
              isTimerRunningForThis ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}>
              {/* Timer Button */}
              <button
                onClick={handleTimerClick}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  isTimerRunningForThis
                    ? "text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                    : "text-green-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30"
                )}
                title={isTimerRunningForThis ? "Stop timer" : "Start timer"}
              >
                {isTimerRunningForThis ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(deal);
                }}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-md transition-colors"
                title="Edit deal"
              >
                <Edit className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(true);
                }}
                className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 rounded-md transition-colors"
                title="Delete deal"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {(() => {
            const contact = contacts.find(c => c.id === deal.contact_id);
            return contact && (
              <div className="flex items-center gap-2 mb-3 text-xs text-gray-500 dark:text-gray-400">
                <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300">
                  {contact.name.charAt(0)}
                </div>
                <span className="truncate font-medium">{contact.name}</span>
                {contact.company && (
                  <>
                    <span className="text-gray-300">•</span>
                    <span className="truncate text-gray-400">{contact.company}</span>
                  </>
                )}
              </div>
            );
          })()}

          <div className="flex items-end justify-between">
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              {formatCurrency(deal.value || 0)}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {daysInStage} day{daysInStage !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Follow-up badges with actions */}
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
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
                  className="flex-1 px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded flex items-center justify-center gap-1 transition-colors"
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
                className="flex-1 px-2 py-1 text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
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
                className="flex-1 px-2 py-1 text-xs bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                title="Snooze 3 days"
              >
                <Timer className="w-3 h-3" />
                +3d
              </button>
            </div>
          </div>

          <ConfirmModal
            isOpen={showDeleteConfirm}
            onClose={() => setShowDeleteConfirm(false)}
            onConfirm={() => {
              onDelete(deal.id);
              setShowDeleteConfirm(false);
            }}
            title="Delete Deal"
            message={`Are you sure you want to delete "${deal.title}"? This action cannot be undone.`}
            confirmText="Delete"
            variant="danger"
          />
        </div>
      )}
    </Draggable>
  );
}
