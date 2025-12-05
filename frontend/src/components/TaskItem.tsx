import { useState } from 'react';
import type { Task, Goal } from '@/types';
import { TaskStatus, TaskPriority } from '@/types';
import { format, isPast, isToday, isTomorrow, parseISO } from 'date-fns';
import { Check, Clock, AlertCircle, Trash2, Edit, Calendar, Target, Repeat, Play, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import ConfirmModal from './ConfirmModal';
import { useTimer, formatElapsedTime } from '@/contexts/TimerContext';
import { toast } from 'sonner';

interface TaskItemProps {
  task: Task;
  onStatusChange: (id: number, status: TaskStatus) => void;
  onClick: () => void;
  onDelete?: (id: number) => void;
  isUpdating?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: number) => void;
  goals?: Goal[];
}

// Priority configuration with thin border + badge
const priorityConfig = {
  [TaskPriority.URGENT]: {
    border: 'border-l-red-500',
    badge: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
    dot: 'bg-red-500',
    label: 'Urgent'
  },
  [TaskPriority.HIGH]: {
    border: 'border-l-orange-500',
    badge: 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800',
    dot: 'bg-orange-500',
    label: 'High'
  },
  [TaskPriority.MEDIUM]: {
    border: 'border-l-blue-500',
    badge: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    dot: 'bg-blue-500',
    label: 'Medium'
  },
  [TaskPriority.LOW]: {
    border: 'border-l-gray-400',
    badge: 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600',
    dot: 'bg-gray-400',
    label: 'Low'
  }
};

// Status configuration with dot + text
const statusConfig = {
  [TaskStatus.PENDING]: {
    dot: 'bg-gray-400',
    text: 'text-gray-600 dark:text-gray-400',
    label: 'Pending'
  },
  [TaskStatus.IN_PROGRESS]: {
    dot: 'bg-blue-500',
    text: 'text-blue-600 dark:text-blue-400',
    label: 'In Progress'
  },
  [TaskStatus.COMPLETED]: {
    dot: 'bg-green-500',
    text: 'text-green-600 dark:text-green-400',
    label: 'Completed'
  },
  [TaskStatus.DELAYED]: {
    dot: 'bg-yellow-500',
    text: 'text-yellow-600 dark:text-yellow-400',
    label: 'Delayed'
  }
};

export default function TaskItem({ task, onStatusChange, onClick, onDelete, isUpdating, isSelected, onToggleSelect, goals }: TaskItemProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { currentTimer, startTimer, stopTimer, elapsedSeconds } = useTimer();
  const isCompleted = task.status === TaskStatus.COMPLETED;
  const priority = priorityConfig[task.priority];
  const status = statusConfig[task.status];
  const isTimerRunningForThis = currentTimer?.task_id === task.id;

  // Find linked goal
  const linkedGoal = goals?.find(g => g.id === task.goal_id);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      setShowDeleteConfirm(true);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick();
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the edit modal
  };

  const handleCheckboxChange = (_e: React.ChangeEvent<HTMLInputElement>) => {
    if (onToggleSelect) {
      onToggleSelect(task.id);
    }
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
          'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30',
          'border border-red-200 dark:border-red-800',
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
          'text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30',
          'border border-yellow-200 dark:border-yellow-800',
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
          'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30',
          'border border-blue-200 dark:border-blue-800',
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
        'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700',
        'border border-gray-200 dark:border-gray-600',
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

  const handleTimerClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTimerRunningForThis) {
      await stopTimer();
      toast.success('Timer stopped');
    } else {
      await startTimer({
        task_id: task.id,
        description: task.title,
        project_id: task.project_id || undefined,
      });
      toast.success('Timer started');
    }
  };

  return (
    <div
      className={cn(
        'group',
        'flex flex-col gap-3',
        'p-5',
        'bg-white dark:bg-gray-800',
        'border-l',
        priority.border,
        'rounded-xl shadow-sm',
        'transition-all duration-200 ease-out',
        'hover:shadow-lg hover:-translate-y-1',
        'cursor-pointer'
      )}
      onClick={onClick}
    >
      {/* Top row: Selection Checkbox + Checkbox + Title + Priority Badge */}
      <div className="flex items-start gap-3">
        {/* Selection Checkbox */}
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={isSelected}
            onClick={handleCheckboxClick}
            onChange={handleCheckboxChange}
            className="flex-shrink-0 w-4 h-4 mt-1 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:bg-gray-700"
          />
        )}

        {/* Completion Checkbox */}
        <button
          onClick={handleCheckbox}
          disabled={isUpdating}
          className={cn(
            'flex-shrink-0',
            'flex items-center justify-center',
            'w-5 h-5 mt-0.5',
            'border rounded',
            'transition-all duration-200',
            isCompleted
              ? 'bg-green-500 border-green-500'
              : 'border-gray-300 dark:border-gray-600 hover:border-green-400 dark:hover:border-green-500 hover:scale-110',
            isUpdating && 'opacity-50 cursor-not-allowed'
          )}
        >
          {isCompleted && <Check className="w-3.5 h-3.5 text-white" />}
        </button>

        {/* Title */}
        <h3
          className={cn(
            'flex-1 text-base font-semibold leading-snug',
            isCompleted ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'
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
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed pl-8">
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
            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {task.due_time}
            </span>
          )}

          {/* Goal Badge */}
          {linkedGoal && (
            <span className={cn(
              'inline-flex items-center gap-1.5',
              'px-2.5 py-1',
              'text-xs font-medium',
              'text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30',
              'border border-purple-200 dark:border-purple-800',
              'rounded-full',
              'transition-all duration-200'
            )}>
              <Target className="w-3 h-3" />
              {linkedGoal.title}
            </span>
          )}

          {/* Recurring Task Badge */}
          {task.is_recurring && (
            <span className={cn(
              'inline-flex items-center gap-1.5',
              'px-2.5 py-1',
              'text-xs font-medium',
              'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30',
              'border border-green-200 dark:border-green-800',
              'rounded-full',
              'transition-all duration-200'
            )}
            title={`Repeats ${task.recurrence_type}${task.occurrences_created > 0 ? ` (${task.occurrences_created} created)` : ''}`}
            >
              <Repeat className="w-3 h-3" />
              Recurring
            </span>
          )}
        </div>

        {/* Timer indicator if running */}
        {isTimerRunningForThis && (
          <span className="text-xs font-mono font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-lg animate-pulse">
            {formatElapsedTime(elapsedSeconds)}
          </span>
        )}

        {/* Action Buttons (group-hover pattern) */}
        <div className={cn(
          "flex gap-1 transition-opacity duration-200",
          (isTimerRunningForThis || showDeleteConfirm) ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}>
          {/* Timer Button */}
          {!isCompleted && (
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
              {isTimerRunningForThis ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
          )}

          <button
            onClick={handleEdit}
            className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            title="Edit task"
          >
            <Edit className="w-4 h-4" />
          </button>

          {onDelete && (
            <button
              onClick={handleDelete}
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
              title="Delete task"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          // Close modal first to prevent visual glitch when TaskItem unmounts
          setShowDeleteConfirm(false);
          // Small delay to allow modal to close before component unmounts
          setTimeout(() => {
            if (onDelete) onDelete(task.id);
          }, 100);
        }}
        title="Delete Task"
        message="Are you sure you want to delete this task? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
