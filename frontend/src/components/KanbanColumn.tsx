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
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  yellow: 'bg-amber-50 text-amber-700 border-amber-200',
  orange: 'bg-orange-50 text-orange-700 border-orange-200',
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  red: 'bg-rose-50 text-rose-700 border-rose-200',
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
    <div className="flex flex-col min-w-[280px] w-[320px] flex-shrink-0 h-full max-h-full">
      {/* Column Header */}
      <div className="px-3 py-3 flex-shrink-0">
        <div
          className={cn(
            'flex items-center justify-between px-3 py-2 rounded-lg border transition-colors cursor-pointer',
            COLOR_CLASSES[config.color as keyof typeof COLOR_CLASSES],
            isClosedStage && "hover:bg-opacity-80"
          )}
          onClick={isClosedStage ? onToggleCollapse : undefined}
        >
          <div className="flex items-center gap-2 font-medium">
            {isClosedStage && (
              <span>
                {isCollapsed ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </span>
            )}
            <h2 className="text-sm tracking-tight">
              {config.label}
            </h2>
            <span className="text-xs bg-white/50 px-2 py-0.5 rounded-full font-semibold">
              {deals.length}
            </span>
          </div>
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
                'flex-1 px-3 pb-3 overflow-y-auto transition-colors duration-200',
                snapshot.isDraggingOver ? 'bg-blue-50/50 rounded-lg' : ''
              )}
              style={{ scrollbarWidth: 'thin' }}
            >
              <div className="space-y-3">
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
              </div>
            </div>
          )}
        </Droppable>
      )}
    </div>
  );
}
