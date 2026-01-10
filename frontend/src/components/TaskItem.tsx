import { useState } from 'react';
import type { Task, Goal } from '@/types';
import { TaskStatus, TaskPriority } from '@/types';
import { format, isPast, isToday, isTomorrow, parseISO, differenceInDays, startOfDay } from 'date-fns';
import { Check, Clock, Trash2, Edit, Target, Repeat, Play, Square } from 'lucide-react';
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

// Priority configuration - simplified with dots
const priorityConfig = {
  [TaskPriority.URGENT]: {
    dot: 'bg-[--exec-danger]',
    text: 'text-[--exec-danger]',
    label: 'Urgent'
  },
  [TaskPriority.HIGH]: {
    dot: 'bg-[--exec-warning]',
    text: 'text-[--exec-warning]',
    label: 'High'
  },
  [TaskPriority.MEDIUM]: {
    dot: 'bg-[--exec-accent]',
    text: 'text-[--exec-accent]',
    label: 'Medium'
  },
  [TaskPriority.LOW]: {
    dot: 'bg-stone-500',
    text: 'text-stone-400',
    label: 'Low'
  }
};

// Status configuration with dot + text + subtle background - warm theme
const statusConfig = {
  [TaskStatus.PENDING]: {
    dot: 'bg-stone-500',
    text: 'text-[--exec-text-muted]',
    label: 'Pending',
    rowBg: 'hover:bg-stone-700/30'
  },
  [TaskStatus.IN_PROGRESS]: {
    dot: 'bg-[--exec-info]',
    text: 'text-[--exec-info]',
    label: 'In Progress',
    rowBg: 'bg-[--exec-info]/10 hover:bg-[--exec-info]/15'
  },
  [TaskStatus.COMPLETED]: {
    dot: 'bg-[--exec-sage]',
    text: 'text-[--exec-sage]',
    label: 'Completed',
    rowBg: 'bg-[--exec-sage]/10 hover:bg-[--exec-sage]/15'
  },
  [TaskStatus.DELAYED]: {
    dot: 'bg-[--exec-warning]',
    text: 'text-[--exec-warning]',
    label: 'Delayed',
    rowBg: 'bg-[--exec-warning]/10 hover:bg-[--exec-warning]/15'
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

  // Helper functions for simplified due date display
  const getDueDateColor = () => {
    if (!task.due_date) return 'text-[--exec-text-muted]';

    const dueDate = parseISO(task.due_date);
    const isOverdue = isPast(dueDate) && !isToday(dueDate);

    if (isOverdue && !isCompleted) return 'text-[--exec-danger]';
    if (isToday(dueDate)) return 'text-[--exec-warning]';
    if (isTomorrow(dueDate)) return 'text-[--exec-info]';
    return 'text-[--exec-text-muted]';
  };

  const getDueDateText = () => {
    if (!task.due_date) return '';

    const dueDate = parseISO(task.due_date);
    const isOverdue = isPast(dueDate) && !isToday(dueDate);

    if (isOverdue && !isCompleted) {
      const today = startOfDay(new Date());
      const daysOverdue = differenceInDays(today, dueDate);
      return daysOverdue === 1 ? '1 day overdue' : `${daysOverdue} days overdue`;
    }
    if (isToday(dueDate)) return 'Due today';
    if (isTomorrow(dueDate)) return 'Tomorrow';
    return format(dueDate, 'MMM d');
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
        'group relative py-4 transition-all duration-200',
        'cursor-pointer',
        status.rowBg
      )}
      onClick={onClick}
    >
      {/* Main row content */}
      <div className="flex items-start gap-3">
        {/* Priority dot indicator */}
        <div className="flex flex-col items-center pt-1.5">
          <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', priority.dot)} />
        </div>

        {/* Selection Checkbox (when in edit mode) */}
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={isSelected}
            onClick={handleCheckboxClick}
            onChange={handleCheckboxChange}
            className="flex-shrink-0 w-4 h-4 mt-0.5 text-[--exec-accent] bg-stone-700 border-stone-600 rounded focus:ring-[--exec-accent]/50"
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
              ? 'bg-[--exec-sage] border-[--exec-sage]'
              : 'border-stone-600 hover:border-[--exec-sage] hover:scale-110',
            isUpdating && 'opacity-50 cursor-not-allowed'
          )}
        >
          {isCompleted && <Check className="w-3.5 h-3.5 text-white" />}
        </button>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {/* Title */}
              <h3
                className={cn(
                  'font-medium text-[--exec-text] text-left transition-colors',
                  isCompleted && 'line-through text-[--exec-text-muted]'
                )}
              >
                {task.title}
              </h3>

              {/* Description preview */}
              {task.description && (
                <p className="text-sm text-[--exec-text-muted] mt-0.5 line-clamp-1">
                  {task.description}
                </p>
              )}
            </div>

            {/* Priority label (subtle, on the right) */}
            <span className={cn('text-[10px] font-medium uppercase tracking-wider flex-shrink-0', priority.text)}>
              {priority.label}
            </span>
          </div>

          {/* Metadata row */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {/* Status */}
            <div className={cn('flex items-center gap-1.5 text-xs font-medium', status.text)}>
              <div className={cn('w-1.5 h-1.5 rounded-full', status.dot)} />
              {status.label}
            </div>

            {/* Due Date */}
            {task.due_date && (
              <span className={cn(
                'text-xs',
                getDueDateColor()
              )}>
                {getDueDateText()}
              </span>
            )}

            {/* Due Time */}
            {task.due_time && (
              <span className="text-xs text-[--exec-text-muted] flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {task.due_time}
              </span>
            )}

            {/* Goal Badge */}
            {linkedGoal && (
              <span className="text-xs text-[--exec-accent] flex items-center gap-1">
                <Target className="w-3 h-3" />
                {linkedGoal.title}
              </span>
            )}

            {/* Recurring Badge */}
            {task.is_recurring && (
              <span className="text-xs text-[--exec-sage] flex items-center gap-1">
                <Repeat className="w-3 h-3" />
                Recurring
              </span>
            )}

            {/* Timer indicator if running */}
            {isTimerRunningForThis && (
              <span className="text-xs font-mono font-semibold text-[--exec-sage] bg-[--exec-sage-bg] px-2 py-0.5 rounded animate-pulse">
                {formatElapsedTime(elapsedSeconds)}
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons - Always visible */}
        <div className="flex gap-1 ml-2">
          {/* Timer Button */}
          {!isCompleted && (
            <button
              onClick={handleTimerClick}
              className={cn(
                "p-1.5 rounded-md transition-all duration-200",
                "hover:scale-110 active:scale-95",
                isTimerRunningForThis
                  ? "text-red-500 bg-red-500/10"
                  : "text-stone-500"
              )}
              style={{ ['--hover-color' as string]: isTimerRunningForThis ? '#ef4444' : '#10b981' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = isTimerRunningForThis ? '#ef4444' : '#10b981';
                e.currentTarget.style.backgroundColor = isTimerRunningForThis ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = isTimerRunningForThis ? '#ef4444' : '#78716c';
                e.currentTarget.style.backgroundColor = isTimerRunningForThis ? 'rgba(239,68,68,0.1)' : 'transparent';
              }}
              title={isTimerRunningForThis ? "Stop timer" : "Start timer"}
            >
              {isTimerRunningForThis ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
          )}

          <button
            onClick={handleEdit}
            className="p-1.5 text-stone-500 rounded-md transition-all duration-200 hover:scale-110 active:scale-95"
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#f97316';
              e.currentTarget.style.backgroundColor = 'rgba(249,115,22,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#78716c';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title="Edit task"
          >
            <Edit className="w-4 h-4" />
          </button>

          {onDelete && (
            <button
              onClick={handleDelete}
              className="p-1.5 text-stone-500 rounded-md transition-all duration-200 hover:scale-110 active:scale-95"
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ef4444';
                e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#78716c';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
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
