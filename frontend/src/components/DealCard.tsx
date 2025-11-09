import { Draggable } from '@hello-pangea/dnd';
import { Edit, Trash2 } from 'lucide-react';
import { Deal, Contact } from '@/types';
import { formatCurrency } from '@/lib/currency';
import { cn } from '@/lib/utils';

interface DealCardProps {
  deal: Deal & { contact?: Contact };
  index: number;
  onEdit: (deal: Deal) => void;
  onDelete: (id: number) => void;
}

function getDaysInStage(updatedAt: string): number {
  const now = new Date();
  const updated = new Date(updatedAt);
  const diffTime = Math.abs(now.getTime() - updated.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export default function DealCard({ deal, index, onEdit, onDelete }: DealCardProps) {
  const daysInStage = getDaysInStage(deal.updated_at);

  return (
    <Draggable draggableId={`deal-${deal.id}`} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={cn(
            'bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-3 group',
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

          {deal.contact && (
            <p className="text-xs text-gray-500 mb-2">
              {deal.contact.name}
              {deal.contact.company && ` · ${deal.contact.company}`}
            </p>
          )}

          <div className="flex items-end justify-between">
            <span className="text-lg font-bold text-gray-900">
              {formatCurrency(deal.value || 0)}
            </span>
            <span className="text-xs text-gray-500">
              {daysInStage} day{daysInStage !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}
    </Draggable>
  );
}
