import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Task, TaskStatus, TaskPriority, Project, Goal } from '@/types';
import { format, isPast, isToday } from 'date-fns';
import { Clock, Folder, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskKanbanBoardProps {
  tasks: Task[];
  projects?: Project[];
  goals?: Goal[];
  onStatusChange: (id: number, status: TaskStatus) => void;
  onTaskClick: (task: Task) => void;
}

const columns = [
  { 
    id: TaskStatus.PENDING, 
    title: 'To Do', 
    color: 'bg-gray-50 dark:bg-gray-800/50', 
    headerColor: 'border-t-4 border-t-gray-400 dark:border-t-gray-500',
    badgeColor: 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
  },
  { 
    id: TaskStatus.IN_PROGRESS, 
    title: 'In Progress', 
    color: 'bg-blue-50/30 dark:bg-blue-900/10', 
    headerColor: 'border-t-4 border-t-blue-500 dark:border-t-blue-400',
    badgeColor: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
  },
  { 
    id: TaskStatus.COMPLETED, 
    title: 'Completed', 
    color: 'bg-green-50/30 dark:bg-green-900/10', 
    headerColor: 'border-t-4 border-t-green-500 dark:border-t-green-400',
    badgeColor: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
  },
  {
    id: TaskStatus.DELAYED,
    title: 'Delayed',
    color: 'bg-yellow-50/30 dark:bg-yellow-900/10',
    headerColor: 'border-t-4 border-t-yellow-500 dark:border-t-yellow-400',
    badgeColor: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
  },
  {
    id: TaskStatus.SKIPPED,
    title: 'Skipped',
    color: 'bg-gray-50/30 dark:bg-gray-800/30',
    headerColor: 'border-t-4 border-t-gray-400 dark:border-t-gray-500',
    badgeColor: 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
  },
];

const priorityConfig = {
  [TaskPriority.URGENT]: { color: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800', label: 'Urgent' },
  [TaskPriority.HIGH]: { color: 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800', label: 'High' },
  [TaskPriority.MEDIUM]: { color: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800', label: 'Medium' },
  [TaskPriority.LOW]: { color: 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700', label: 'Low' },
};

export default function TaskKanbanBoard({ tasks, projects = [], goals = [], onStatusChange, onTaskClick }: TaskKanbanBoardProps) {
  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const taskId = parseInt(draggableId);
    const newStatus = destination.droppableId as TaskStatus;

    onStatusChange(taskId, newStatus);
  };

  const getTasksByStatus = (status: TaskStatus) => {
    return tasks.filter((task) => task.status === status);
  };

  const getProjectName = (projectId?: number) => {
    if (!projectId) return null;
    return projects.find(p => p.id === projectId)?.name;
  };

  const getGoalTitle = (goalId?: number) => {
    if (!goalId) return null;
    return goals.find(g => g.id === goalId)?.title;
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex h-full overflow-x-auto gap-6 p-6 pb-4">
        {columns.map((column) => (
          <div
            key={column.id}
            className={cn(
              "flex-shrink-0 w-80 flex flex-col rounded-xl border border-gray-200/60 dark:border-gray-700 max-h-full transition-colors duration-300",
              column.color
            )}
          >
            {/* Column Header */}
            <div className={cn("p-4 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-t-xl border-b border-gray-100 dark:border-gray-700 flex items-center justify-between sticky top-0 z-10", column.headerColor)}>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-700 dark:text-gray-300 text-sm uppercase tracking-wide">{column.title}</h3>
                <span className={cn("px-2 py-0.5 rounded-full text-xs font-bold", column.badgeColor)}>
                  {getTasksByStatus(column.id).length}
                </span>
              </div>
            </div>

            {/* Droppable Area */}
            <Droppable droppableId={column.id}>
              {(provided, snapshot) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className={cn(
                    "flex-1 p-3 overflow-y-auto space-y-3 transition-colors min-h-[150px] scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent",
                    snapshot.isDraggingOver ? "bg-gray-100/50 dark:bg-gray-700/50" : ""
                  )}
                >
                  {getTasksByStatus(column.id).map((task, index) => (
                    <Draggable
                      key={task.id}
                      draggableId={task.id.toString()}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          onClick={() => onTaskClick(task)}
                          style={{
                            ...provided.draggableProps.style,
                          }}
                          className={cn(
                            "bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 group hover:shadow-md transition-all duration-200 cursor-grab active:cursor-grabbing relative overflow-hidden",
                            snapshot.isDragging ? "shadow-xl ring-2 ring-blue-500/20 rotate-2 scale-105 z-50" : "hover:-translate-y-0.5"
                          )}
                        >
                          {/* Priority Stripe */}
                          <div className={cn("absolute left-0 top-0 bottom-0 w-1", priorityConfig[task.priority].color.split(' ')[0].replace('bg-', 'bg-').replace('50', '500'))} />

                          <div className="pl-2">
                            <div className="flex justify-between items-start mb-2">
                              <span className={cn(
                                "text-[10px] px-2 py-0.5 rounded-md border font-semibold uppercase tracking-wider",
                                priorityConfig[task.priority].color
                              )}>
                                {priorityConfig[task.priority].label}
                              </span>
                              {task.due_date && (
                                <div className={cn(
                                  "flex items-center gap-1 text-xs font-medium",
                                  isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date)) && task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.SKIPPED
                                    ? "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 px-1.5 py-0.5 rounded" 
                                    : "text-gray-400 dark:text-gray-500"
                                )}>
                                  <Clock className="w-3 h-3" />
                                  {format(new Date(task.due_date), 'MMM d')}
                                </div>
                              )}
                            </div>
                            
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1.5 line-clamp-2 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {task.title}
                            </h4>
                            
                            {task.description && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3 leading-relaxed">
                                {task.description}
                              </p>
                            )}

                            {/* Footer: Project & Goal Tags */}
                            {(task.project_id || task.goal_id) && (
                              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-50 dark:border-gray-700">
                                {task.project_id && getProjectName(task.project_id) && (
                                  <div className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 px-1.5 py-0.5 rounded border border-gray-100 dark:border-gray-600 max-w-full truncate">
                                    <Folder className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">{getProjectName(task.project_id)}</span>
                                  </div>
                                )}
                                {task.goal_id && getGoalTitle(task.goal_id) && (
                                  <div className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 px-1.5 py-0.5 rounded border border-gray-100 dark:border-gray-600 max-w-full truncate">
                                    <Target className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">{getGoalTitle(task.goal_id)}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}
