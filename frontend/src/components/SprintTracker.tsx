import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sprintApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Target,
  Check,
  ChevronRight,
  Play,
  Pause,
  Loader2,
  Calendar,
  Trophy,
  Rocket,
} from 'lucide-react';
import type { Sprint, Task } from '@/types';
import { TaskStatus } from '@/types';
import { useState } from 'react';
import { Link } from 'react-router-dom';

const WEEK_ICONS = [Target, Rocket, Loader2, Trophy];

interface SprintDayGridProps {
  sprint: Sprint;
}

function SprintDayGrid({ sprint }: SprintDayGridProps) {
  const daysPerWeek = [7, 7, 7, 9]; // Week 4 has 9 days
  let dayIndex = 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-[--exec-text-muted] w-16">Progress</span>
        <div className="flex-1 h-2 bg-[--exec-surface-alt] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[--exec-accent] to-[--exec-sage] transition-all duration-500"
            style={{ width: `${sprint.progress_percentage}%` }}
          />
        </div>
        <span className="text-xs font-medium text-[--exec-text-secondary] w-12 text-right">
          {sprint.progress_percentage.toFixed(0)}%
        </span>
      </div>
      <div className="flex gap-4">
        {sprint.weeks.map((week, weekIdx) => (
          <div key={week.week_number} className="flex flex-col gap-1">
            <span className="text-[10px] text-[--exec-text-muted] text-center mb-0.5">
              W{week.week_number}
            </span>
            <div className="flex gap-0.5">
              {Array.from({ length: daysPerWeek[weekIdx] }).map((_, i) => {
                const currentDayIndex = dayIndex++;
                const dayNumber = currentDayIndex + 1;
                const isComplete = sprint.today?.day_number
                  ? dayNumber < sprint.current_day
                    ? sprint.weeks[weekIdx].days_completed > i
                    : sprint.today.is_complete && dayNumber === sprint.current_day
                  : false;
                const isCurrent = dayNumber === sprint.current_day;
                const isFuture = dayNumber > sprint.current_day;

                return (
                  <div
                    key={i}
                    className={cn(
                      'w-3 h-3 rounded-sm transition-colors',
                      isComplete && 'bg-[--exec-sage]',
                      isCurrent && !isComplete && 'bg-[--exec-accent] ring-1 ring-[--exec-accent] ring-offset-1 ring-offset-[--exec-surface]',
                      !isComplete && !isCurrent && !isFuture && 'bg-[--exec-warning-bg] border border-[--exec-warning]',
                      isFuture && 'bg-[--exec-surface-alt] border border-[--exec-border-subtle]'
                    )}
                    title={`Day ${dayNumber}${isCurrent ? ' (Today)' : ''}`}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface TaskItemProps {
  task: Task;
  isToggling: boolean;
  onToggle: () => void;
}

function TaskItem({ task, isToggling, onToggle }: TaskItemProps) {
  const isCompleted = task.status === TaskStatus.COMPLETED;
  return (
    <div
      className={cn(
        'flex items-center gap-3 py-2 transition-colors',
        isCompleted && 'opacity-60'
      )}
    >
      <button
        onClick={onToggle}
        disabled={isToggling}
        className={cn(
          'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all',
          'hover:scale-110 active:scale-95 disabled:opacity-50',
          isCompleted
            ? 'bg-[--exec-sage] border-[--exec-sage] text-white'
            : 'border-[--exec-border] hover:border-[--exec-accent] bg-transparent'
        )}
      >
        {isToggling ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : isCompleted ? (
          <Check className="w-3 h-3" />
        ) : null}
      </button>
      <span
        className={cn(
          'text-sm',
          isCompleted
            ? 'text-[--exec-text-muted] line-through'
            : 'text-[--exec-text]'
        )}
      >
        {task.title}
      </span>
    </div>
  );
}

interface StartSprintProps {
  onStart: () => void;
  isStarting: boolean;
}

function StartSprintCard({ onStart, isStarting }: StartSprintProps) {
  return (
    <div className="bento-card overflow-hidden animate-fade-slide-up">
      <div className="p-6 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[--exec-accent-bg] to-[--exec-accent-bg-subtle] flex items-center justify-center mb-4">
          <Rocket className="w-8 h-8 text-[--exec-accent]" />
        </div>
        <h2 className="text-lg font-bold text-[--exec-text] mb-2">
          Start Your 30-Day Sprint
        </h2>
        <p className="text-sm text-[--exec-text-muted] mb-6 max-w-sm">
          Launch your client acquisition sprint with daily tasks, weekly themes, and progress tracking.
        </p>
        <button
          onClick={onStart}
          disabled={isStarting}
          className={cn(
            'flex items-center gap-2 px-6 py-3 rounded-xl font-semibold',
            'text-white',
            'hover:brightness-110 hover:scale-105 hover:shadow-lg',
            'active:scale-95 transition-all duration-200',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'shadow-sm'
          )}
          style={{ backgroundColor: 'var(--exec-accent)' }}
        >
          {isStarting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Play className="w-5 h-5" />
          )}
          {isStarting ? 'Starting...' : 'Start Sprint'}
        </button>
      </div>
    </div>
  );
}

export default function SprintTracker() {
  const queryClient = useQueryClient();
  const [togglingTask, setTogglingTask] = useState<number | null>(null);

  const { data: sprint, isLoading } = useQuery({
    queryKey: ['sprint-active'],
    queryFn: sprintApi.getActive,
  });

  const createMutation = useMutation({
    mutationFn: () => sprintApi.create(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint-active'] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ sprintId, dayNumber, taskIndex }: { sprintId: number; dayNumber: number; taskIndex: number }) =>
      sprintApi.toggleTask(sprintId, dayNumber, taskIndex),
    onMutate: ({ taskIndex }) => setTogglingTask(taskIndex),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint-active'] });
    },
    onSettled: () => setTogglingTask(null),
  });

  const pauseMutation = useMutation({
    mutationFn: (id: number) => sprintApi.pause(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint-active'] });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: (id: number) => sprintApi.resume(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint-active'] });
    },
  });

  const handleToggleTask = (taskIndex: number) => {
    if (!sprint || !sprint.today) return;
    toggleMutation.mutate({
      sprintId: sprint.id,
      dayNumber: sprint.today.day_number,
      taskIndex,
    });
  };

  if (isLoading) {
    return (
      <div className="bento-card p-6 animate-pulse">
        <div className="h-6 bg-[--exec-surface-alt] rounded w-48 mb-4" />
        <div className="h-4 bg-[--exec-surface-alt] rounded w-32 mb-6" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-5 h-5 bg-[--exec-surface-alt] rounded" />
              <div className="h-4 bg-[--exec-surface-alt] rounded flex-1" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!sprint) {
    return (
      <StartSprintCard
        onStart={() => createMutation.mutate()}
        isStarting={createMutation.isPending}
      />
    );
  }

  const isPaused = sprint.status === 'paused';
  const currentWeek = sprint.weeks.find((w) => w.is_current_week);

  return (
    <div className="bento-card overflow-hidden animate-fade-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-[--exec-border-subtle]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[--exec-accent-bg] to-[--exec-accent-bg-subtle] flex items-center justify-center">
            <Target className="w-5 h-5 text-[--exec-accent]" />
          </div>
          <div>
            <h2 className="font-semibold text-[--exec-text]">30-Day Sprint</h2>
            <p className="text-xs text-[--exec-text-muted]">
              {currentWeek ? `Week ${currentWeek.week_number}: ${currentWeek.theme}` : 'Sprint'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Day badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[--exec-accent-bg] rounded-full">
            <Calendar className="w-4 h-4 text-[--exec-accent]" />
            <span className="text-sm font-bold text-[--exec-accent]">
              Day {sprint.current_day}/30
            </span>
          </div>

          {/* All tasks complete badge */}
          {sprint.today?.is_complete && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[--exec-sage-bg] rounded-full">
              <Check className="w-4 h-4 text-[--exec-sage]" />
              <span className="text-sm font-bold text-[--exec-sage]">Done!</span>
            </div>
          )}

          {/* Status indicator for paused */}
          {isPaused && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[--exec-warning-bg] rounded-full">
              <Pause className="w-4 h-4 text-[--exec-warning]" />
              <span className="text-sm font-bold text-[--exec-warning]">Paused</span>
            </div>
          )}

          {/* Pause/Resume button */}
          {sprint.status === 'active' && (
            <button
              onClick={() => pauseMutation.mutate(sprint.id)}
              disabled={pauseMutation.isPending}
              className="p-2 text-[--exec-text-muted] hover:text-[--exec-warning] hover:bg-[--exec-warning-bg] rounded-lg transition-colors"
              title="Pause Sprint"
            >
              <Pause className="w-5 h-5" />
            </button>
          )}
          {isPaused && (
            <button
              onClick={() => resumeMutation.mutate(sprint.id)}
              disabled={resumeMutation.isPending}
              className="p-2 text-[--exec-text-muted] hover:text-[--exec-sage] hover:bg-[--exec-sage-bg] rounded-lg transition-colors"
              title="Resume Sprint"
            >
              <Play className="w-5 h-5" />
            </button>
          )}

          {/* View all link */}
          <Link
            to="/sprint"
            className="p-2 text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-[--exec-surface-alt] rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Week summary tabs */}
        <div className="flex gap-2 mb-5">
          {sprint.weeks.map((week, idx) => {
            const WeekIcon = WEEK_ICONS[idx] || Target;
            return (
              <div
                key={week.week_number}
                className={cn(
                  'flex-1 rounded-xl p-3 transition-all',
                  week.is_current_week
                    ? 'bg-[--exec-accent-bg] border-2 border-[--exec-accent]'
                    : 'bg-[--exec-surface-alt] border border-[--exec-border-subtle]'
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <WeekIcon
                    className={cn(
                      'w-4 h-4',
                      week.is_current_week
                        ? 'text-[--exec-accent]'
                        : 'text-[--exec-text-muted]'
                    )}
                  />
                  <span
                    className={cn(
                      'text-xs font-semibold',
                      week.is_current_week
                        ? 'text-[--exec-accent]'
                        : 'text-[--exec-text-secondary]'
                    )}
                  >
                    {week.theme}
                  </span>
                </div>
                <p className="text-xs text-[--exec-text-muted]">
                  {week.days_completed}/{week.total_days} days
                </p>
              </div>
            );
          })}
        </div>

        {/* Today's tasks */}
        {sprint.today && (
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-[--exec-text-secondary] mb-3">
              Today's Tasks
            </h3>
            <div className="space-y-1">
              {sprint.today.tasks.map((task, idx) => (
                <TaskItem
                  key={idx}
                  task={task}
                  isToggling={togglingTask === idx}
                  onToggle={() => handleToggleTask(idx)}
                />
              ))}
            </div>
          </div>
        )}

        {/* 30-day progress grid */}
        <SprintDayGrid sprint={sprint} />
      </div>
    </div>
  );
}
