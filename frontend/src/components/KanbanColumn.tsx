import { Droppable } from '@hello-pangea/dnd';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Deal, DealStage, Contact } from '@/types';
import DealCard from './DealCard';
import { cn } from '@/lib/utils';

interface KanbanColumnProps {
  stage: DealStage;
  deals: Deal[];
  contacts: Contact[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onEditDeal: (deal: Deal) => void;
  onDeleteDeal: (id: number) => void;
  onAddInteraction?: (contactId: number) => void;
}

const STAGE_CONFIG = {
  [DealStage.LEAD]: { label: 'Lead', color: 'blue' },
  [DealStage.PROSPECT]: { label: 'Prospect', color: 'purple' },
  [DealStage.PROPOSAL]: { label: 'Proposal', color: 'yellow' },
  [DealStage.NEGOTIATION]: { label: 'Negotiation', color: 'orange' },
  [DealStage.CLOSED_WON]: { label: 'Closed Won', color: 'green' },
  [DealStage.CLOSED_LOST]: { label: 'Closed Lost', color: 'red' },
};

const COLOR_CLASSES = {
  blue: 'bg-blue-50 border-blue-200',
  purple: 'bg-purple-50 border-purple-200',
  yellow: 'bg-yellow-50 border-yellow-200',
  orange: 'bg-orange-50 border-orange-200',
  green: 'bg-green-50 border-green-200',
  red: 'bg-red-50 border-red-200',
};

export default function KanbanColumn({
  stage,
  deals,
  contacts,
  isCollapsed,
  onToggleCollapse,
  onEditDeal,
  onDeleteDeal,
  onAddInteraction,
}: KanbanColumnProps) {
  const config = STAGE_CONFIG[stage];
  const isClosedStage =
    stage === DealStage.CLOSED_WON || stage === DealStage.CLOSED_LOST;

  return (
    <div className="flex flex-col min-w-[240px] sm:min-w-[280px] max-w-[320px] flex-shrink-0">
      {/* Column Header */}
      <div
        className={cn(
          'p-3 border-b flex items-center justify-between cursor-pointer',
          COLOR_CLASSES[config.color as keyof typeof COLOR_CLASSES]
        )}
        onClick={isClosedStage ? onToggleCollapse : undefined}
      >
        <div className="flex items-center gap-2">
          {isClosedStage && (
            <span>
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </span>
          )}
          <h2 className="font-semibold text-gray-900 text-sm">
            {config.label}
          </h2>
          <span className="text-xs text-gray-600 bg-white px-2 py-0.5 rounded-full">
            {deals.length}
          </span>
        </div>
      </div>

      {/* Column Content */}
      {!isCollapsed && (
        <Droppable droppableId={stage}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={cn(
                'flex-1 p-3 overflow-y-auto',
                'min-h-[200px] max-h-[calc(100vh-250px)]',
                snapshot.isDraggingOver && 'bg-gray-50'
              )}
              style={{ scrollbarWidth: 'thin' }}
            >
              {deals.map((deal, index) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  index={index}
                  contacts={contacts}
                  onEdit={onEditDeal}
                  onDelete={onDeleteDeal}
                  onAddInteraction={onAddInteraction}
                />
              ))}
              {provided.placeholder}
              {deals.length === 0 && (
                <p className="text-sm text-gray-400 text-center mt-8">
                  No deals in {config.label.toLowerCase()}
                </p>
              )}
            </div>
          )}
        </Droppable>
      )}
    </div>
  );
}
