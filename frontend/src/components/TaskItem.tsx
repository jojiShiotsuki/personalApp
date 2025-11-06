import { Task, TaskStatus, TaskPriority } from '@/types';
import { format, isPast, isToday, isTomorrow, parseISO } from 'date-fns';
import { Check, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskItemProps {
  task: Task;
  onStatusChange: (id: number, status: TaskStatus) => void;
  onClick: () => void;
  isUpdating?: boolean;
}

const priorityColors = {
  [TaskPriority.LOW]: 'border-l-gray-400',
  [TaskPriority.MEDIUM]: 'border-l-blue-400',
  [TaskPriority.HIGH]: 'border-l-orange-400',
  [TaskPriority.URGENT]: 'border-l-red-500',
};

const statusColors = {
  [TaskStatus.PENDING]: 'bg-gray-100',
  [TaskStatus.IN_PROGRESS]: 'bg-blue-50',
  [TaskStatus.COMPLETED]: 'bg-green-50',
  [TaskStatus.DELAYED]: 'bg-yellow-50',
};

export default function TaskItem({ task, onStatusChange, onClick, isUpdating }: TaskItemProps) {
  const isCompleted = task.status === TaskStatus.COMPLETED;

  const getDueDateBadge = () => {
    if (!task.due_date) return null;

    const dueDate = parseISO(task.due_date);
    const isOverdue = isPast(dueDate) && !isToday(dueDate);

    if (isOverdue && !isCompleted) {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded">
          <AlertCircle className="w-3 h-3 mr-1" />
          Overdue
        </span>
      );
    }

    if (isToday(dueDate)) {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-yellow-700 bg-yellow-100 rounded">
          <Clock className="w-3 h-3 mr-1" />
          Due Today
        </span>
      );
    }

    if (isTomorrow(dueDate)) {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded">
          <Clock className="w-3 h-3 mr-1" />
          Due Tomorrow
        </span>
      );
    }

    return (
      <span className="text-xs text-gray-500">
        Due {format(dueDate, 'MMM d')}
      </span>
    );
  };

  const handleCheckbox = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = isCompleted ? TaskStatus.PENDING : TaskStatus.COMPLETED;
    onStatusChange(task.id, newStatus);
  };

  return (
    <div
      className={cn(
        'flex items-center p-4 bg-white border-l-4 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow',
        priorityColors[task.priority],
        statusColors[task.status]
      )}
      onClick={onClick}
    >
      {/* Checkbox */}
      <button
        onClick={handleCheckbox}
        disabled={isUpdating}
        className={cn(
          'flex items-center justify-center w-5 h-5 mr-3 border-2 rounded',
          isCompleted
            ? 'bg-green-500 border-green-500'
            : 'border-gray-300 hover:border-green-400',
          isUpdating && 'opacity-50 cursor-not-allowed'
        )}
      >
        {isCompleted && <Check className="w-4 h-4 text-white" />}
      </button>

      {/* Task content */}
      <div className="flex-1 min-w-0">
        <h3
          className={cn(
            'text-sm font-medium',
            isCompleted ? 'line-through text-gray-400' : 'text-gray-900'
          )}
        >
          {task.title}
        </h3>

        <div className="flex items-center mt-1 space-x-2">
          {getDueDateBadge()}

          <span className="text-xs text-gray-500 capitalize">
            {task.priority.replace('_', ' ')}
          </span>

          {task.due_time && (
            <span className="text-xs text-gray-500">
              {task.due_time}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
