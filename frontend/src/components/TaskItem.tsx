import type { Task } from '@/types';
import { TaskStatus, TaskPriority } from '@/types';
import { format, isPast, isToday, isTomorrow, parseISO } from 'date-fns';
import { Check, Clock, AlertCircle, Trash2, Edit, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskItemProps {
  task: Task;
  onStatusChange: (id: number, status: TaskStatus) => void;
  onClick: () => void;
  onDelete?: (id: number) => void;
  isUpdating?: boolean;
}

// Priority configuration with thin border + badge
const priorityConfig = {
  [TaskPriority.URGENT]: {
    border: 'border-l-red-500',
    badge: 'bg-red-50 text-red-700 border-red-200',
    dot: 'bg-red-500',
    label: 'Urgent'
  },
  [TaskPriority.HIGH]: {
    border: 'border-l-orange-500',
    badge: 'bg-orange-50 text-orange-700 border-orange-200',
    dot: 'bg-orange-500',
    label: 'High'
  },
  [TaskPriority.MEDIUM]: {
    border: 'border-l-blue-500',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
    label: 'Medium'
  },
  [TaskPriority.LOW]: {
    border: 'border-l-gray-400',
    badge: 'bg-gray-50 text-gray-600 border-gray-200',
    dot: 'bg-gray-400',
    label: 'Low'
  }
};

// Status configuration with dot + text
const statusConfig = {
  [TaskStatus.PENDING]: {
    dot: 'bg-gray-400',
    text: 'text-gray-600',
    label: 'Pending'
  },
  [TaskStatus.IN_PROGRESS]: {
    dot: 'bg-blue-500',
    text: 'text-blue-600',
    label: 'In Progress'
  },
  [TaskStatus.COMPLETED]: {
    dot: 'bg-green-500',
    text: 'text-green-600',
    label: 'Completed'
  },
  [TaskStatus.DELAYED]: {
    dot: 'bg-yellow-500',
    text: 'text-yellow-600',
    label: 'Delayed'
  }
};

export default function TaskItem({ task, onStatusChange, onClick, onDelete, isUpdating }: TaskItemProps) {
  const isCompleted = task.status === TaskStatus.COMPLETED;
  const priority = priorityConfig[task.priority];
  const status = statusConfig[task.status];

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete && confirm('Delete this task?')) {
      onDelete(task.id);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick();
  };

  const getDueDateBadge = () => {
    if (!task.due_date) return null;

    const dueDate = parseISO(task.due_date);
    const isOverdue = isPast(dueDate) && !isToday(dueDate);

    if (isOverdue && !isCompleted) {
      return (
        <span className={cn(
          'inline-flex items-center gap-1.5',
          'px-2.5 py-1',
          'text-xs font-medium',
          'text-red-700 bg-red-50',
          'border border-red-200',
          'rounded-full',
          'transition-all duration-200'
        )}>
          <AlertCircle className="w-3 h-3" />
          Overdue
        </span>
      );
    }

    if (isToday(dueDate)) {
      return (
        <span className={cn(
          'inline-flex items-center gap-1.5',
          'px-2.5 py-1',
          'text-xs font-medium',
          'text-yellow-700 bg-yellow-50',
          'border border-yellow-200',
          'rounded-full',
          'transition-all duration-200'
        )}>
          <Clock className="w-3 h-3" />
          Due Today
        </span>
      );
    }

    if (isTomorrow(dueDate)) {
      return (
        <span className={cn(
          'inline-flex items-center gap-1.5',
          'px-2.5 py-1',
          'text-xs font-medium',
          'text-blue-700 bg-blue-50',
          'border border-blue-200',
          'rounded-full',
          'transition-all duration-200'
        )}>
          <Calendar className="w-3 h-3" />
          Tomorrow
        </span>
      );
    }

    return (
      <span className={cn(
        'inline-flex items-center gap-1.5',
        'px-2.5 py-1',
        'text-xs font-medium',
        'text-gray-600 bg-gray-50',
        'border border-gray-200',
        'rounded-full'
      )}>
        <Calendar className="w-3 h-3" />
        {format(dueDate, 'MMM d')}
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
        'group',
        'flex flex-col gap-3',
        'p-5',
        'bg-white',
        'border-l-2',
        priority.border,
        'rounded-xl shadow-sm',
        'transition-all duration-200 ease-out',
        'hover:shadow-lg hover:-translate-y-1',
        'cursor-pointer'
      )}
      onClick={onClick}
    >
      {/* Top row: Checkbox + Title + Priority Badge */}
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={handleCheckbox}
          disabled={isUpdating}
          className={cn(
            'flex-shrink-0',
            'flex items-center justify-center',
            'w-5 h-5 mt-0.5',
            'border-2 rounded',
            'transition-all duration-200',
            isCompleted
              ? 'bg-green-500 border-green-500'
              : 'border-gray-300 hover:border-green-400 hover:scale-110',
            isUpdating && 'opacity-50 cursor-not-allowed'
          )}
        >
          {isCompleted && <Check className="w-3.5 h-3.5 text-white" />}
        </button>

        {/* Title */}
        <h3
          className={cn(
            'flex-1 text-base font-semibold leading-snug',
            isCompleted ? 'line-through text-gray-400' : 'text-gray-900'
          )}
        >
          {task.title}
        </h3>

        {/* Priority Badge */}
        <div className={cn(
          'flex-shrink-0',
          'flex items-center gap-1.5',
          'px-2.5 py-1',
          'text-xs font-medium',
          'border rounded-full',
          'transition-all duration-200',
          priority.badge
        )}>
          <div className={cn('w-2 h-2 rounded-full', priority.dot)} />
          {priority.label}
        </div>
      </div>

      {/* Middle row: Description (if exists) */}
      {task.description && (
        <p className="text-sm text-gray-600 leading-relaxed pl-8">
          {task.description}
        </p>
      )}

      {/* Bottom row: Status + Due Date + Time + Actions */}
      <div className="flex items-center justify-between pl-8">
        <div className="flex items-center gap-3">
          {/* Status Badge */}
          <div className={cn(
            'flex items-center gap-1.5',
            'text-xs font-medium',
            status.text
          )}>
            <div className={cn('w-2 h-2 rounded-full', status.dot)} />
            {status.label}
          </div>

          {/* Due Date Badge */}
          {getDueDateBadge()}

          {/* Due Time */}
          {task.due_time && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {task.due_time}
            </span>
          )}
        </div>

        {/* Action Buttons (group-hover pattern) */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={handleEdit}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            title="Edit task"
          >
            <Edit className="w-4 h-4" />
          </button>

          {onDelete && (
            <button
              onClick={handleDelete}
              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
              title="Delete task"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
