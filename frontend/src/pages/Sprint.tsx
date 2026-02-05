import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sprintApi, taskApi, dailyOutreachApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Target,
  Check,
  Play,
  Pause,
  Calendar,
  Loader2,
  Rocket,
  ChevronDown,
  ChevronUp,
  Trophy,
  AlertCircle,
  FileText,
  X,
  Plus,
  Minus,
  Trash2,
  Pencil,
  SkipForward,
  SkipBack,
} from 'lucide-react';
import type { Sprint, SprintDay, SprintListItem, Task, TaskStatus, OutreachActivityType } from '@/types';
import { TaskStatus as TaskStatusEnum } from '@/types';
import { useState } from 'react';
import { format, parseISO, isToday, isPast, isFuture } from 'date-fns';

const WEEK_THEMES = ['Foundation', 'Volume', 'Momentum', 'Close'];
const WEEK_ICONS = [Target, Rocket, Loader2, Trophy];

// Export sprint data to downloadable files (AI Coach optimized)
function exportSprintData(sprint: Sprint) {
  const now = new Date();
  const timestamp = format(now, 'yyyy-MM-dd_HH-mm');

  // Calculate totals and metrics
  const totalOutreach = {
    cold_emails: { current: 0, target: 0 },
    linkedin: { current: 0, target: 0 },
    calls: { current: 0, target: 0 },
    looms: { current: 0, target: 0 },
  };

  let totalTasks = 0;
  let completedTasks = 0;
  let daysWithActivity = 0;
  let perfectDays = 0; // Days where all targets were met
  let totalDaysElapsed = 0;

  // Track daily performance for trends
  const dailyPerformance: Array<{
    day: number;
    date: string;
    tasksCompleted: number;
    totalTasks: number;
    outreachTotal: number;
    outreachTarget: number;
    isPerfect: boolean;
  }> = [];

  sprint.days?.forEach(day => {
    const dayDate = parseISO(day.log_date);
    const isElapsed = isPast(dayDate) || isToday(dayDate);
    if (isElapsed) totalDaysElapsed++;

    let dayOutreachCurrent = 0;
    let dayOutreachTarget = 0;

    if (day.outreach_stats) {
      totalOutreach.cold_emails.current += day.outreach_stats.cold_emails.current;
      totalOutreach.cold_emails.target += day.outreach_stats.cold_emails.target;
      totalOutreach.linkedin.current += day.outreach_stats.linkedin.current;
      totalOutreach.linkedin.target += day.outreach_stats.linkedin.target;
      totalOutreach.calls.current += day.outreach_stats.calls.current;
      totalOutreach.calls.target += day.outreach_stats.calls.target;
      totalOutreach.looms.current += day.outreach_stats.looms.current;
      totalOutreach.looms.target += day.outreach_stats.looms.target;

      dayOutreachCurrent = day.outreach_stats.cold_emails.current +
        day.outreach_stats.linkedin.current +
        day.outreach_stats.calls.current +
        day.outreach_stats.looms.current;
      dayOutreachTarget = day.outreach_stats.cold_emails.target +
        day.outreach_stats.linkedin.target +
        day.outreach_stats.calls.target +
        day.outreach_stats.looms.target;
    }

    const dayTasksCompleted = day.tasks.filter(t => t.status === 'completed').length;
    totalTasks += day.tasks.length;
    completedTasks += dayTasksCompleted;

    if (dayOutreachCurrent > 0 || dayTasksCompleted > 0) daysWithActivity++;

    const isPerfectDay = day.is_complete && dayOutreachCurrent >= dayOutreachTarget;
    if (isPerfectDay && isElapsed) perfectDays++;

    if (isElapsed) {
      dailyPerformance.push({
        day: day.day_number,
        date: day.log_date,
        tasksCompleted: dayTasksCompleted,
        totalTasks: day.tasks.length,
        outreachTotal: dayOutreachCurrent,
        outreachTarget: dayOutreachTarget,
        isPerfect: isPerfectDay,
      });
    }
  });

  // Calculate streak (consecutive days with activity)
  let currentStreak = 0;
  for (let i = dailyPerformance.length - 1; i >= 0; i--) {
    if (dailyPerformance[i].outreachTotal > 0 || dailyPerformance[i].tasksCompleted > 0) {
      currentStreak++;
    } else {
      break;
    }
  }

  // Calculate averages
  const avgDailyEmails = totalDaysElapsed > 0 ? totalOutreach.cold_emails.current / totalDaysElapsed : 0;
  const avgDailyLinkedIn = totalDaysElapsed > 0 ? totalOutreach.linkedin.current / totalDaysElapsed : 0;
  const avgDailyCalls = totalDaysElapsed > 0 ? totalOutreach.calls.current / totalDaysElapsed : 0;
  const avgDailyLooms = totalDaysElapsed > 0 ? totalOutreach.looms.current / totalDaysElapsed : 0;

  // Identify areas needing improvement
  const weakAreas: string[] = [];
  const strongAreas: string[] = [];

  const emailRate = totalOutreach.cold_emails.target > 0 ? (totalOutreach.cold_emails.current / totalOutreach.cold_emails.target) * 100 : 0;
  const linkedInRate = totalOutreach.linkedin.target > 0 ? (totalOutreach.linkedin.current / totalOutreach.linkedin.target) * 100 : 0;
  const callsRate = totalOutreach.calls.target > 0 ? (totalOutreach.calls.current / totalOutreach.calls.target) * 100 : 0;
  const loomsRate = totalOutreach.looms.target > 0 ? (totalOutreach.looms.current / totalOutreach.looms.target) * 100 : 0;

  if (emailRate < 50) weakAreas.push('Cold Emails');
  else if (emailRate >= 80) strongAreas.push('Cold Emails');
  if (linkedInRate < 50) weakAreas.push('LinkedIn Outreach');
  else if (linkedInRate >= 80) strongAreas.push('LinkedIn Outreach');
  if (callsRate < 50) weakAreas.push('Discovery Calls');
  else if (callsRate >= 80) strongAreas.push('Discovery Calls');
  if (loomsRate < 50) weakAreas.push('Loom Audits');
  else if (loomsRate >= 80) strongAreas.push('Loom Audits');

  // Generate AI-optimized Markdown report
  const markdownReport = `# 30-DAY CLIENT ACQUISITION SPRINT - PROGRESS REPORT
**Report Generated:** ${format(now, 'MMMM d, yyyy h:mm a')}
**Sprint:** ${sprint.title}

---

## EXECUTIVE SUMMARY FOR AI COACH

### Current Position
- **Sprint Day:** ${sprint.current_day} of 30 (${((sprint.current_day / 30) * 100).toFixed(0)}% through timeline)
- **Sprint Week:** ${sprint.current_week} - "${WEEK_THEMES[sprint.current_week - 1]}" phase
- **Status:** ${sprint.status.toUpperCase()}
- **Overall Progress:** ${sprint.progress_percentage.toFixed(1)}%

### Key Performance Indicators
| Metric | Value | Assessment |
|--------|-------|------------|
| Task Completion Rate | ${totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0}% (${completedTasks}/${totalTasks}) | ${totalTasks > 0 && (completedTasks / totalTasks) >= 0.7 ? 'On Track' : 'Needs Attention'} |
| Days with Activity | ${daysWithActivity}/${totalDaysElapsed} | ${totalDaysElapsed > 0 && (daysWithActivity / totalDaysElapsed) >= 0.8 ? 'Consistent' : 'Inconsistent'} |
| Perfect Days | ${perfectDays}/${totalDaysElapsed} | ${totalDaysElapsed > 0 && (perfectDays / totalDaysElapsed) >= 0.5 ? 'Good' : 'Needs Improvement'} |
| Current Streak | ${currentStreak} days | ${currentStreak >= 3 ? 'Building Momentum' : 'Start/Rebuild Momentum'} |

### Outreach Performance Summary
| Activity | Done | Target | Rate | Daily Avg | Status |
|----------|------|--------|------|-----------|--------|
| Cold Emails | ${totalOutreach.cold_emails.current} | ${totalOutreach.cold_emails.target} | ${emailRate.toFixed(1)}% | ${avgDailyEmails.toFixed(1)} | ${emailRate >= 70 ? '✓ Good' : emailRate >= 50 ? '~ Moderate' : '✗ Low'} |
| LinkedIn | ${totalOutreach.linkedin.current} | ${totalOutreach.linkedin.target} | ${linkedInRate.toFixed(1)}% | ${avgDailyLinkedIn.toFixed(1)} | ${linkedInRate >= 70 ? '✓ Good' : linkedInRate >= 50 ? '~ Moderate' : '✗ Low'} |
| Calls | ${totalOutreach.calls.current} | ${totalOutreach.calls.target} | ${callsRate.toFixed(1)}% | ${avgDailyCalls.toFixed(1)} | ${callsRate >= 70 ? '✓ Good' : callsRate >= 50 ? '~ Moderate' : '✗ Low'} |
| Looms | ${totalOutreach.looms.current} | ${totalOutreach.looms.target} | ${loomsRate.toFixed(1)}% | ${avgDailyLooms.toFixed(1)} | ${loomsRate >= 70 ? '✓ Good' : loomsRate >= 50 ? '~ Moderate' : '✗ Low'} |

### Areas Analysis
${strongAreas.length > 0 ? `**Strengths:** ${strongAreas.join(', ')}` : '**Strengths:** None identified yet - keep pushing!'}
${weakAreas.length > 0 ? `**Needs Improvement:** ${weakAreas.join(', ')}` : '**Needs Improvement:** All areas performing adequately'}

---

## WEEKLY BREAKDOWN

${sprint.weeks.map(week => {
  const weekDays = sprint.days?.filter(d => d.week_number === week.week_number) || [];
  const weekTasks = weekDays.reduce((sum, d) => sum + d.tasks.length, 0);
  const weekCompletedTasks = weekDays.reduce((sum, d) => sum + d.tasks.filter(t => t.status === 'completed').length, 0);
  const weekEmails = weekDays.reduce((sum, d) => sum + (d.outreach_stats?.cold_emails.current || 0), 0);
  const weekLinkedIn = weekDays.reduce((sum, d) => sum + (d.outreach_stats?.linkedin.current || 0), 0);
  const weekCalls = weekDays.reduce((sum, d) => sum + (d.outreach_stats?.calls.current || 0), 0);
  const weekLooms = weekDays.reduce((sum, d) => sum + (d.outreach_stats?.looms.current || 0), 0);
  const isCurrentWeek = sprint.current_week === week.week_number;

  return `### Week ${week.week_number}: ${WEEK_THEMES[week.week_number - 1]} ${isCurrentWeek ? '← CURRENT' : ''}
- **Days Progress:** ${week.days_completed}/${week.total_days} (${((week.days_completed / week.total_days) * 100).toFixed(0)}%)
- **Tasks:** ${weekCompletedTasks}/${weekTasks} completed
- **Week Outreach:** ${weekEmails} emails, ${weekLinkedIn} LinkedIn, ${weekCalls} calls, ${weekLooms} looms
`;
}).join('\n')}

---

## DETAILED DAILY LOG

${sprint.days?.map(day => {
  const dayDate = parseISO(day.log_date);
  const isElapsed = isPast(dayDate) || isToday(dayDate);
  const isCurrent = isToday(dayDate);
  const dayTasks = day.tasks;
  const completed = dayTasks.filter(t => t.status === 'completed');
  const pending = dayTasks.filter(t => t.status !== 'completed');

  const dayOutreachCurrent = (day.outreach_stats?.cold_emails.current || 0) +
    (day.outreach_stats?.linkedin.current || 0) +
    (day.outreach_stats?.calls.current || 0) +
    (day.outreach_stats?.looms.current || 0);
  const dayOutreachTarget = (day.outreach_stats?.cold_emails.target || 0) +
    (day.outreach_stats?.linkedin.target || 0) +
    (day.outreach_stats?.calls.target || 0) +
    (day.outreach_stats?.looms.target || 0);

  const dayStatus = isCurrent ? '🔵 TODAY' :
    day.is_complete ? '✅ COMPLETE' :
    isElapsed ? '⚠️ INCOMPLETE' : '⏳ UPCOMING';

  return `### Day ${day.day_number} - ${format(dayDate, 'EEEE, MMM d')} ${dayStatus}

**Tasks:** ${completed.length}/${dayTasks.length} | **Outreach:** ${dayOutreachCurrent}/${dayOutreachTarget}

${dayTasks.length > 0 ? `Tasks:
${completed.map(t => `- [x] ${t.title}`).join('\n')}
${pending.map(t => `- [ ] ${t.title}`).join('\n')}` : 'No tasks assigned'}

Outreach: ${day.outreach_stats?.cold_emails.current || 0} emails, ${day.outreach_stats?.linkedin.current || 0} LinkedIn, ${day.outreach_stats?.calls.current || 0} calls, ${day.outreach_stats?.looms.current || 0} looms
${day.notes ? `\nNotes: ${day.notes}` : ''}
`;
}).join('\n') || 'No days recorded yet.'}

---

## DATA FOR AI ANALYSIS

### Raw Metrics
\`\`\`
Total Outreach Activities: ${totalOutreach.cold_emails.current + totalOutreach.linkedin.current + totalOutreach.calls.current + totalOutreach.looms.current}
Total Outreach Target: ${totalOutreach.cold_emails.target + totalOutreach.linkedin.target + totalOutreach.calls.target + totalOutreach.looms.target}
Overall Outreach Rate: ${((totalOutreach.cold_emails.current + totalOutreach.linkedin.current + totalOutreach.calls.current + totalOutreach.looms.current) / Math.max(1, totalOutreach.cold_emails.target + totalOutreach.linkedin.target + totalOutreach.calls.target + totalOutreach.looms.target) * 100).toFixed(1)}%
Days Remaining: ${30 - sprint.current_day}
Projected Completion: ${totalDaysElapsed > 0 ? (((completedTasks / totalTasks) / (totalDaysElapsed / 30)) * 100).toFixed(1) : 'N/A'}%
\`\`\`

### Questions for AI Coach to Address
1. Based on my current pace, will I hit my 30-day goals?
2. What specific actions should I prioritize for the remaining ${30 - sprint.current_day} days?
3. Which outreach channel should I double down on based on my performance?
4. How can I improve my consistency (${daysWithActivity}/${totalDaysElapsed} active days)?
5. What adjustments should I make for Week ${sprint.current_week + 1 <= 4 ? sprint.current_week + 1 : sprint.current_week}?

---
*Exported from Vertex CRM Sprint Tracker - Optimized for AI Coach Analysis*
`;

  return markdownReport;
}

interface DayCardProps {
  day: SprintDay;
  sprint: Sprint;
  isExpanded: boolean;
  onToggle: () => void;
}

function DayCard({ day, sprint, isExpanded, onToggle }: DayCardProps) {
  const queryClient = useQueryClient();
  const [togglingTask, setTogglingTask] = useState<number | null>(null);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notes, setNotes] = useState(day.notes || '');

  // Task editing state
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState('');

  // Toggle task status using the Task API
  const toggleMutation = useMutation({
    mutationFn: ({ taskId, currentStatus }: { taskId: number; currentStatus: TaskStatus }) => {
      const newStatus = currentStatus === TaskStatusEnum.COMPLETED
        ? TaskStatusEnum.PENDING
        : TaskStatusEnum.COMPLETED;
      return taskApi.update(taskId, { status: newStatus });
    },
    onMutate: ({ taskId }) => setTogglingTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint-active'] });
      queryClient.invalidateQueries({ queryKey: ['sprint-day', sprint.id, day.day_number] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onSettled: () => setTogglingTask(null),
  });

  const notesMutation = useMutation({
    mutationFn: (notesText: string) =>
      sprintApi.updateNotes(sprint.id, day.day_number, notesText),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint-active'] });
      setIsEditingNotes(false);
    },
  });

  // Add task mutation
  const addTaskMutation = useMutation({
    mutationFn: (title: string) =>
      taskApi.create({
        title,
        status: TaskStatusEnum.PENDING,
        priority: 'medium',
        sprint_day_id: day.id,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint-active'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setNewTaskTitle('');
      setIsAddingTask(false);
    },
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, title }: { taskId: number; title: string }) =>
      taskApi.update(taskId, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint-active'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setEditingTaskId(null);
      setEditingTaskTitle('');
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: number) => taskApi.delete(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint-active'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // Outreach tracking state
  const [loggingOutreach, setLoggingOutreach] = useState<OutreachActivityType | null>(null);
  const [deductingOutreach, setDeductingOutreach] = useState<OutreachActivityType | null>(null);

  // Log outreach activity mutation
  const logOutreachMutation = useMutation({
    mutationFn: (type: OutreachActivityType) => dailyOutreachApi.logActivity(type),
    onMutate: (type) => setLoggingOutreach(type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint-active'] });
      queryClient.invalidateQueries({ queryKey: ['daily-outreach-today'] });
      queryClient.invalidateQueries({ queryKey: ['daily-outreach-streak'] });
      queryClient.invalidateQueries({ queryKey: ['daily-outreach-weekly'] });
    },
    onSettled: () => setLoggingOutreach(null),
  });

  // Deduct outreach activity mutation
  const deductOutreachMutation = useMutation({
    mutationFn: (type: OutreachActivityType) => dailyOutreachApi.deductActivity(type),
    onMutate: (type) => setDeductingOutreach(type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint-active'] });
      queryClient.invalidateQueries({ queryKey: ['daily-outreach-today'] });
      queryClient.invalidateQueries({ queryKey: ['daily-outreach-streak'] });
      queryClient.invalidateQueries({ queryKey: ['daily-outreach-weekly'] });
    },
    onSettled: () => setDeductingOutreach(null),
  });

  const dayDate = parseISO(day.log_date);
  const isCurrentDay = isToday(dayDate);
  const isPastDay = isPast(dayDate) && !isCurrentDay;
  const isFutureDay = isFuture(dayDate);
  const completedTasks = day.tasks.filter((t) => t.status === TaskStatusEnum.COMPLETED).length;

  return (
    <div
      className={cn(
        'rounded-xl border transition-all',
        isCurrentDay
          ? 'bg-[--exec-accent-bg] border-[--exec-accent] ring-2 ring-[--exec-accent]/20'
          : day.is_complete
            ? 'bg-[--exec-sage-bg] border-[--exec-sage]'
            : isPastDay && !day.is_complete
              ? 'bg-[--exec-warning-bg] border-[--exec-warning]'
              : 'bg-[--exec-surface] border-[--exec-border-subtle]'
      )}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center font-bold',
              isCurrentDay
                ? 'bg-[--exec-accent] text-white'
                : day.is_complete
                  ? 'bg-[--exec-sage] text-white'
                  : isPastDay
                    ? 'bg-[--exec-warning]/20 text-[--exec-warning]'
                    : 'bg-[--exec-surface-alt] text-[--exec-text-secondary]'
            )}
          >
            {day.is_complete ? <Check className="w-5 h-5" /> : day.day_number}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[--exec-text]">
                Day {day.day_number}
              </span>
              {isCurrentDay && (
                <span className="text-xs font-bold text-[--exec-accent] bg-[--exec-accent]/10 px-2 py-0.5 rounded-full">
                  TODAY
                </span>
              )}
              {isPastDay && !day.is_complete && (
                <span className="text-xs font-bold text-[--exec-warning] bg-[--exec-warning]/10 px-2 py-0.5 rounded-full">
                  INCOMPLETE
                </span>
              )}
            </div>
            <p className="text-xs text-[--exec-text-muted]">
              {format(dayDate, 'EEEE, MMMM d')} · {completedTasks}/{day.tasks.length} tasks
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-[--exec-text-muted]" />
        ) : (
          <ChevronDown className="w-5 h-5 text-[--exec-text-muted]" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Tasks */}
          <div className="space-y-2">
            {day.tasks.map((task) => {
              const isCompleted = task.status === TaskStatusEnum.COMPLETED;
              const isEditing = editingTaskId === task.id;

              return (
                <div
                  key={task.id}
                  className={cn(
                    'group flex items-center gap-3 p-3 rounded-lg transition-colors',
                    isCompleted
                      ? 'bg-[--exec-surface-alt]/50 opacity-60'
                      : 'bg-[--exec-surface-alt]'
                  )}
                >
                  <button
                    onClick={() => toggleMutation.mutate({ taskId: task.id, currentStatus: task.status })}
                    disabled={togglingTask === task.id || isFutureDay || isEditing}
                    className={cn(
                      'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0',
                      'hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed',
                      isCompleted
                        ? 'bg-[--exec-sage] border-[--exec-sage] text-white'
                        : 'border-[--exec-border] hover:border-[--exec-accent] bg-transparent'
                    )}
                  >
                    {togglingTask === task.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : isCompleted ? (
                      <Check className="w-3 h-3" />
                    ) : null}
                  </button>

                  {isEditing ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={editingTaskTitle}
                        onChange={(e) => setEditingTaskTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && editingTaskTitle.trim()) {
                            updateTaskMutation.mutate({ taskId: task.id, title: editingTaskTitle.trim() });
                          } else if (e.key === 'Escape') {
                            setEditingTaskId(null);
                            setEditingTaskTitle('');
                          }
                        }}
                        autoFocus
                        className="flex-1 px-2 py-1 text-sm bg-[--exec-surface] border border-[--exec-border] rounded text-[--exec-text] focus:outline-none focus:ring-1 focus:ring-[--exec-accent]"
                      />
                      <button
                        onClick={() => updateTaskMutation.mutate({ taskId: task.id, title: editingTaskTitle.trim() })}
                        disabled={!editingTaskTitle.trim() || updateTaskMutation.isPending}
                        className="p-1 text-[--exec-sage] hover:bg-[--exec-sage]/10 rounded transition-colors disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingTaskId(null);
                          setEditingTaskTitle('');
                        }}
                        className="p-1 text-[--exec-text-muted] hover:bg-[--exec-surface-alt] rounded transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span
                        className={cn(
                          'text-sm flex-1',
                          isCompleted
                            ? 'text-[--exec-text-muted] line-through'
                            : 'text-[--exec-text]'
                        )}
                      >
                        {task.title}
                      </span>

                      {/* Edit/Delete buttons - visible on hover */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingTaskId(task.id);
                            setEditingTaskTitle(task.title);
                          }}
                          className="p-1.5 text-[--exec-text-muted] hover:text-[--exec-accent] hover:bg-[--exec-accent]/10 rounded transition-colors"
                          title="Edit task"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Delete this task?')) {
                              deleteTaskMutation.mutate(task.id);
                            }
                          }}
                          disabled={deleteTaskMutation.isPending}
                          className="p-1.5 text-[--exec-text-muted] hover:text-[--exec-danger] hover:bg-[--exec-danger]/10 rounded transition-colors disabled:opacity-50"
                          title="Delete task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {/* Add Task UI */}
            {isAddingTask ? (
              <div className="flex items-center gap-2 p-3 bg-[--exec-surface-alt] rounded-lg border border-dashed border-[--exec-border]">
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTaskTitle.trim()) {
                      addTaskMutation.mutate(newTaskTitle.trim());
                    } else if (e.key === 'Escape') {
                      setIsAddingTask(false);
                      setNewTaskTitle('');
                    }
                  }}
                  placeholder="Enter task title..."
                  autoFocus
                  className="flex-1 px-2 py-1 text-sm bg-[--exec-surface] border border-[--exec-border] rounded text-[--exec-text] placeholder:text-[--exec-text-muted] focus:outline-none focus:ring-1 focus:ring-[--exec-accent]"
                />
                <button
                  onClick={() => addTaskMutation.mutate(newTaskTitle.trim())}
                  disabled={!newTaskTitle.trim() || addTaskMutation.isPending}
                  className="p-1.5 text-[--exec-sage] hover:bg-[--exec-sage]/10 rounded transition-colors disabled:opacity-50"
                >
                  {addTaskMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => {
                    setIsAddingTask(false);
                    setNewTaskTitle('');
                  }}
                  className="p-1.5 text-[--exec-text-muted] hover:bg-[--exec-surface-alt] rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingTask(true)}
                className="flex items-center gap-2 w-full p-3 text-sm text-[--exec-text-muted] hover:text-[--exec-accent] hover:bg-[--exec-accent]/5 rounded-lg border border-dashed border-[--exec-border-subtle] hover:border-[--exec-accent]/30 transition-all"
              >
                <Plus className="w-4 h-4" />
                Add task
              </button>
            )}
          </div>

          {/* Outreach Stats */}
          {day.outreach_stats && (
            <div className="p-3 rounded-lg bg-[--exec-surface-alt]">
              <p className="text-xs font-semibold text-[--exec-text-secondary] mb-2">
                Outreach Progress
              </p>
              <div className="grid grid-cols-4 gap-3">
                {/* Cold Emails */}
                <div className="text-center">
                  <p className="text-lg font-bold text-[--exec-text]">
                    {day.outreach_stats.cold_emails.current}/{day.outreach_stats.cold_emails.target}
                  </p>
                  <p className="text-[10px] text-[--exec-text-muted] mb-1.5">Emails</p>
                  {isCurrentDay && (
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => deductOutreachMutation.mutate('cold_email')}
                        disabled={deductingOutreach === 'cold_email' || day.outreach_stats!.cold_emails.current === 0}
                        className="p-1.5 rounded-md bg-[--exec-surface] text-[--exec-text-muted] transition-all duration-200 hover:bg-red-500/20 hover:text-red-400 hover:scale-110 hover:shadow-md active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none disabled:hover:bg-[--exec-surface] disabled:hover:text-[--exec-text-muted]"
                      >
                        {deductingOutreach === 'cold_email' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Minus className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => logOutreachMutation.mutate('cold_email')}
                        disabled={loggingOutreach === 'cold_email'}
                        className="p-1.5 rounded-md bg-[var(--exec-accent)] text-white transition-all duration-200 hover:brightness-110 hover:scale-110 hover:shadow-lg hover:shadow-[var(--exec-accent)]/30 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                      >
                        {loggingOutreach === 'cold_email' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                </div>
                {/* LinkedIn */}
                <div className="text-center">
                  <p className="text-lg font-bold text-[--exec-text]">
                    {day.outreach_stats.linkedin.current}/{day.outreach_stats.linkedin.target}
                  </p>
                  <p className="text-[10px] text-[--exec-text-muted] mb-1.5">LinkedIn</p>
                  {isCurrentDay && (
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => deductOutreachMutation.mutate('linkedin')}
                        disabled={deductingOutreach === 'linkedin' || day.outreach_stats!.linkedin.current === 0}
                        className="p-1.5 rounded-md bg-[--exec-surface] text-[--exec-text-muted] transition-all duration-200 hover:bg-red-500/20 hover:text-red-400 hover:scale-110 hover:shadow-md active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none disabled:hover:bg-[--exec-surface] disabled:hover:text-[--exec-text-muted]"
                      >
                        {deductingOutreach === 'linkedin' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Minus className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => logOutreachMutation.mutate('linkedin')}
                        disabled={loggingOutreach === 'linkedin'}
                        className="p-1.5 rounded-md bg-[var(--exec-accent)] text-white transition-all duration-200 hover:brightness-110 hover:scale-110 hover:shadow-lg hover:shadow-[var(--exec-accent)]/30 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                      >
                        {loggingOutreach === 'linkedin' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                </div>
                {/* Calls */}
                <div className="text-center">
                  <p className="text-lg font-bold text-[--exec-text]">
                    {day.outreach_stats.calls.current}/{day.outreach_stats.calls.target}
                  </p>
                  <p className="text-[10px] text-[--exec-text-muted] mb-1.5">Calls</p>
                  {isCurrentDay && (
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => deductOutreachMutation.mutate('call')}
                        disabled={deductingOutreach === 'call' || day.outreach_stats!.calls.current === 0}
                        className="p-1.5 rounded-md bg-[--exec-surface] text-[--exec-text-muted] transition-all duration-200 hover:bg-red-500/20 hover:text-red-400 hover:scale-110 hover:shadow-md active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none disabled:hover:bg-[--exec-surface] disabled:hover:text-[--exec-text-muted]"
                      >
                        {deductingOutreach === 'call' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Minus className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => logOutreachMutation.mutate('call')}
                        disabled={loggingOutreach === 'call'}
                        className="p-1.5 rounded-md bg-[var(--exec-accent)] text-white transition-all duration-200 hover:brightness-110 hover:scale-110 hover:shadow-lg hover:shadow-[var(--exec-accent)]/30 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                      >
                        {loggingOutreach === 'call' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                </div>
                {/* Looms */}
                <div className="text-center">
                  <p className="text-lg font-bold text-[--exec-text]">
                    {day.outreach_stats.looms.current}/{day.outreach_stats.looms.target}
                  </p>
                  <p className="text-[10px] text-[--exec-text-muted] mb-1.5">Looms</p>
                  {isCurrentDay && (
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => deductOutreachMutation.mutate('loom')}
                        disabled={deductingOutreach === 'loom' || day.outreach_stats!.looms.current === 0}
                        className="p-1.5 rounded-md bg-[--exec-surface] text-[--exec-text-muted] transition-all duration-200 hover:bg-[--exec-warning-bg] hover:text-[--exec-warning] hover:scale-110 hover:shadow-md active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
                      >
                        {deductingOutreach === 'loom' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Minus className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => logOutreachMutation.mutate('loom')}
                        disabled={loggingOutreach === 'loom'}
                        className="p-1.5 rounded-md bg-[var(--exec-accent)] text-white transition-all duration-200 hover:brightness-110 hover:scale-110 hover:shadow-lg hover:shadow-[var(--exec-accent)]/30 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                      >
                        {loggingOutreach === 'loom' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            {isEditingNotes ? (
              <div className="space-y-2">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes for this day..."
                  className="w-full px-3 py-2 bg-[--exec-surface-alt] border border-[--exec-border-subtle] rounded-lg text-sm text-[--exec-text] placeholder:text-[--exec-text-muted] resize-none focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]"
                  rows={3}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => notesMutation.mutate(notes)}
                    disabled={notesMutation.isPending}
                    className="px-3 py-1.5 bg-[var(--exec-accent)] text-white text-sm rounded-lg hover:bg-[var(--exec-accent-dark)] transition-colors disabled:opacity-50"
                  >
                    {notesMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => {
                      setNotes(day.notes || '');
                      setIsEditingNotes(false);
                    }}
                    className="px-3 py-1.5 text-[--exec-text-muted] text-sm hover:text-[--exec-text] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsEditingNotes(true)}
                className="flex items-center gap-2 text-sm text-[--exec-text-muted] hover:text-[--exec-accent] transition-colors"
              >
                <FileText className="w-4 h-4" />
                {day.notes ? 'Edit notes' : 'Add notes'}
              </button>
            )}
            {day.notes && !isEditingNotes && (
              <p className="mt-2 text-sm text-[--exec-text-secondary] bg-[--exec-surface-alt] p-3 rounded-lg">
                {day.notes}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface WeekSectionProps {
  weekNumber: number;
  theme: string;
  sprint: Sprint;
  days: SprintDay[];
}

function WeekSection({ weekNumber, theme, sprint, days }: WeekSectionProps) {
  const [isExpanded, setIsExpanded] = useState(
    sprint.current_week === weekNumber
  );
  const [expandedDay, setExpandedDay] = useState<number | null>(
    days.find((d) => isToday(parseISO(d.log_date)))?.day_number || null
  );

  const WeekIcon = WEEK_ICONS[weekNumber - 1] || Target;
  const week = sprint.weeks.find((w) => w.week_number === weekNumber);
  const isCurrentWeek = sprint.current_week === weekNumber;

  return (
    <div
      className={cn(
        'rounded-2xl border transition-all',
        isCurrentWeek
          ? 'border-[--exec-accent] bg-[--exec-accent-bg-subtle]'
          : 'border-[--exec-border-subtle] bg-[--exec-surface]'
      )}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-5"
      >
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center',
              isCurrentWeek
                ? 'bg-[--exec-accent] text-white'
                : 'bg-[--exec-surface-alt] text-[--exec-text-secondary]'
            )}
          >
            <WeekIcon className="w-6 h-6" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-[--exec-text]">
                Week {weekNumber}: {theme}
              </h3>
              {isCurrentWeek && (
                <span className="text-xs font-bold text-[--exec-accent] bg-[--exec-accent]/10 px-2 py-0.5 rounded-full">
                  CURRENT
                </span>
              )}
            </div>
            <p className="text-sm text-[--exec-text-muted]">
              {week?.days_completed || 0}/{week?.total_days || 7} days completed
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Week progress */}
          <div className="w-24 h-2 bg-[--exec-surface-alt] rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all',
                isCurrentWeek
                  ? 'bg-[--exec-accent]'
                  : 'bg-[--exec-sage]'
              )}
              style={{
                width: `${((week?.days_completed || 0) / (week?.total_days || 7)) * 100}%`,
              }}
            />
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-[--exec-text-muted]" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[--exec-text-muted]" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-5 pb-5 space-y-3">
          {days.map((day) => (
            <DayCard
              key={day.day_number}
              day={day}
              sprint={sprint}
              isExpanded={expandedDay === day.day_number}
              onToggle={() =>
                setExpandedDay(
                  expandedDay === day.day_number ? null : day.day_number
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface StartSprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (data?: { title?: string; start_date?: string }) => void;
  isStarting: boolean;
}

function StartSprintModal({ isOpen, onClose, onStart, isStarting }: StartSprintModalProps) {
  const [title, setTitle] = useState('30-Day Client Acquisition Sprint');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  if (!isOpen) return null;

  const inputClasses = cn(
    "w-full px-4 py-2.5 rounded-lg",
    "bg-stone-800/50 border border-stone-600/40",
    "text-[--exec-text] placeholder:text-[--exec-text-muted]",
    "focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50",
    "transition-all text-sm"
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-stone-600/40 transform transition-all animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold text-[--exec-text]">
                Start New Sprint
              </h2>
              <p className="text-sm text-[--exec-text-muted] mt-1">
                Launch your 30-day client acquisition journey
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Sprint Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClasses}
                placeholder="e.g., 30-Day Client Acquisition Sprint"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputClasses}
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-stone-700/30">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onStart({ title, start_date: startDate })}
              disabled={isStarting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[var(--exec-accent)] rounded-lg hover:bg-[var(--exec-accent-dark)] shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isStarting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Rocket className="w-4 h-4" />
              )}
              {isStarting ? 'Starting...' : 'Start Sprint'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface EditSprintModalProps {
  sprint: SprintListItem;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { title: string }) => void;
  isSaving: boolean;
}

interface ExportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportContent: string;
}

function ExportReportModal({ isOpen, onClose, reportContent }: ExportReportModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(reportContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col border border-stone-600/40 transform transition-all animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-4 border-b border-stone-700/30">
          <div>
            <h2 className="text-xl font-semibold text-[--exec-text]">
              Sprint Report
            </h2>
            <p className="text-sm text-[--exec-text-muted]">
              Copy this report for your AI coach
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all",
                copied
                  ? "bg-[--exec-sage] text-white"
                  : "bg-[var(--exec-accent)] text-white hover:bg-[var(--exec-accent-dark)]"
              )}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  Copy All
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <pre className="whitespace-pre-wrap text-sm text-[--exec-text] font-mono bg-[--exec-surface-alt] p-4 rounded-lg border border-[--exec-border-subtle]">
            {reportContent}
          </pre>
        </div>
      </div>
    </div>
  );
}

function EditSprintModal({ sprint, isOpen, onClose, onSave, isSaving }: EditSprintModalProps) {
  const [title, setTitle] = useState(sprint.title);

  if (!isOpen) return null;

  const inputClasses = cn(
    "w-full px-4 py-2.5 rounded-lg",
    "bg-stone-800/50 border border-stone-600/40",
    "text-[--exec-text] placeholder:text-[--exec-text-muted]",
    "focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50",
    "transition-all text-sm"
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-stone-600/40 transform transition-all animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold text-[--exec-text]">
                Edit Sprint
              </h2>
              <p className="text-sm text-[--exec-text-muted] mt-1">
                Update sprint details
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Sprint Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClasses}
                placeholder="e.g., 30-Day Client Acquisition Sprint"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-stone-700/30">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave({ title })}
              disabled={isSaving || !title.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[var(--exec-accent)] rounded-lg hover:bg-[var(--exec-accent-dark)] shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SprintPage() {
  const queryClient = useQueryClient();
  const [showStartModal, setShowStartModal] = useState(false);
  const [editingSprint, setEditingSprint] = useState<SprintListItem | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportContent, setExportContent] = useState('');

  const { data: sprint, isLoading } = useQuery({
    queryKey: ['sprint-active'],
    queryFn: sprintApi.getActive,
  });

  const { data: allSprints = [] } = useQuery({
    queryKey: ['sprints-all'],
    queryFn: sprintApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: (data?: { title?: string; start_date?: string }) =>
      sprintApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint-active'] });
      queryClient.invalidateQueries({ queryKey: ['sprints-all'] });
      setShowStartModal(false);
    },
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

  const completeMutation = useMutation({
    mutationFn: (id: number) => sprintApi.complete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint-active'] });
      queryClient.invalidateQueries({ queryKey: ['sprints-all'] });
    },
  });

  const abandonMutation = useMutation({
    mutationFn: (id: number) => sprintApi.abandon(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint-active'] });
      queryClient.invalidateQueries({ queryKey: ['sprints-all'] });
    },
  });

  const advanceDayMutation = useMutation({
    mutationFn: (id: number) => sprintApi.advanceDay(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint-active'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const goBackDayMutation = useMutation({
    mutationFn: (id: number) => sprintApi.goBackDay(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint-active'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const updateSprintMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { title?: string } }) =>
      sprintApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprints-all'] });
      setEditingSprint(null);
    },
  });

  const deleteSprintMutation = useMutation({
    mutationFn: (id: number) => sprintApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprints-all'] });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-full bg-[--exec-bg] p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-[--exec-surface-alt] rounded w-48" />
          <div className="h-64 bg-[--exec-surface-alt] rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[--exec-bg] grain">
      {/* Header */}
      <header className="bg-[--exec-surface] border-b border-[--exec-border-subtle] px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-2xl font-bold text-[--exec-text] tracking-tight"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              30-Day Sprint
            </h1>
            <p className="text-[--exec-text-muted] mt-1">
              {sprint
                ? `Day ${sprint.current_day} of 30 · Week ${sprint.current_week}: ${WEEK_THEMES[sprint.current_week - 1] || 'Sprint'}`
                : 'Launch your client acquisition sprint'}
            </p>
          </div>

          {!sprint ? (
            <button
              onClick={() => setShowStartModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--exec-accent)] text-white border border-[var(--exec-accent)] rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-[var(--exec-accent)]/20 hover:shadow-xl hover:shadow-[var(--exec-accent)]/30 hover:-translate-y-0.5"
            >
              <Rocket className="w-5 h-5" />
              Start Sprint
            </button>
          ) : (
            <div className="flex items-center gap-3">
              {/* Export Button - always visible when sprint exists */}
              <button
                onClick={() => {
                  const report = exportSprintData(sprint);
                  setExportContent(report);
                  setShowExportModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-[--exec-surface-alt] text-[--exec-text] border border-[--exec-border] rounded-xl font-medium text-sm transition-all duration-200 hover:bg-[--exec-surface] hover:border-[--exec-accent]/50 hover:-translate-y-0.5"
                title="View sprint report"
              >
                <FileText className="w-4 h-4" />
                Report
              </button>

              {sprint.status === 'active' && (
                <>
                  {/* Day Navigation */}
                  <div className="flex items-center gap-2">
                    {sprint.current_day > 1 && (
                      <button
                        onClick={() => goBackDayMutation.mutate(sprint.id)}
                        disabled={goBackDayMutation.isPending}
                        className="flex items-center gap-2 px-4 py-2.5 bg-[var(--exec-accent)] text-white border border-[var(--exec-accent)] rounded-xl font-medium text-sm transition-all duration-200 shadow-lg shadow-[var(--exec-accent)]/20 hover:shadow-xl hover:shadow-[var(--exec-accent)]/30 hover:-translate-y-0.5 disabled:opacity-50"
                        title="Go to previous day"
                      >
                        {goBackDayMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <SkipBack className="w-4 h-4" />
                        )}
                        Prev
                      </button>
                    )}
                    {sprint.current_day < 30 && (
                      <button
                        onClick={() => advanceDayMutation.mutate(sprint.id)}
                        disabled={advanceDayMutation.isPending}
                        className="flex items-center gap-2 px-4 py-2.5 bg-[var(--exec-accent)] text-white border border-[var(--exec-accent)] rounded-xl font-medium text-sm transition-all duration-200 shadow-lg shadow-[var(--exec-accent)]/20 hover:shadow-xl hover:shadow-[var(--exec-accent)]/30 hover:-translate-y-0.5 disabled:opacity-50"
                        title="Skip to next day"
                      >
                        {advanceDayMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <SkipForward className="w-4 h-4" />
                        )}
                        Next
                      </button>
                    )}
                  </div>

                  {/* Sprint Actions */}
                  <button
                    onClick={() => pauseMutation.mutate(sprint.id)}
                    disabled={pauseMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[var(--exec-accent)] text-white border border-[var(--exec-accent)] rounded-xl font-medium text-sm transition-all duration-200 shadow-lg shadow-[var(--exec-accent)]/20 hover:shadow-xl hover:shadow-[var(--exec-accent)]/30 hover:-translate-y-0.5 disabled:opacity-50"
                  >
                    {pauseMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Pause className="w-4 h-4" />
                    )}
                    Pause
                  </button>
                  {sprint.current_day >= 30 && (
                    <button
                      onClick={() => completeMutation.mutate(sprint.id)}
                      disabled={completeMutation.isPending}
                      className="flex items-center gap-2 px-4 py-2.5 bg-[var(--exec-accent)] text-white border border-[var(--exec-accent)] rounded-xl font-medium text-sm transition-all duration-200 shadow-lg shadow-[var(--exec-accent)]/20 hover:shadow-xl hover:shadow-[var(--exec-accent)]/30 hover:-translate-y-0.5 disabled:opacity-50"
                    >
                      {completeMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trophy className="w-4 h-4" />
                      )}
                      Complete
                    </button>
                  )}
                </>
              )}
              {sprint.status === 'paused' && (
                <button
                  onClick={() => resumeMutation.mutate(sprint.id)}
                  disabled={resumeMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[var(--exec-accent)] text-white border border-[var(--exec-accent)] rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-[var(--exec-accent)]/20 hover:shadow-xl hover:shadow-[var(--exec-accent)]/30 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resumeMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Resume
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="p-8">
        {!sprint ? (
          /* No active sprint - show CTA */
          <div className="max-w-2xl mx-auto text-center py-16">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[--exec-accent-bg] to-[--exec-accent-bg-subtle] flex items-center justify-center mx-auto mb-6">
              <Rocket className="w-10 h-10 text-[--exec-accent]" />
            </div>
            <h2
              className="text-3xl font-bold text-[--exec-text] mb-4"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Ready to Land Your First Client?
            </h2>
            <p className="text-lg text-[--exec-text-secondary] mb-8 max-w-lg mx-auto">
              Start your 30-day client acquisition sprint with structured daily tasks,
              weekly themes, and progress tracking. Based on the proven playbook for
              landing Australian tradie clients.
            </p>
            <div className="grid grid-cols-4 gap-4 mb-8">
              {WEEK_THEMES.map((theme, idx) => {
                const WeekIcon = WEEK_ICONS[idx];
                return (
                  <div
                    key={theme}
                    className="p-4 rounded-xl bg-[--exec-surface] border border-[--exec-border-subtle]"
                  >
                    <WeekIcon className="w-6 h-6 text-[--exec-accent] mx-auto mb-2" />
                    <p className="font-semibold text-[--exec-text] text-sm">
                      Week {idx + 1}
                    </p>
                    <p className="text-xs text-[--exec-text-muted]">{theme}</p>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => setShowStartModal(true)}
              className="inline-flex items-center gap-3 px-8 py-4 bg-[var(--exec-accent)] text-white border border-[var(--exec-accent)] rounded-2xl font-bold text-lg transition-all duration-200 shadow-lg shadow-[var(--exec-accent)]/20 hover:shadow-xl hover:shadow-[var(--exec-accent)]/30 hover:-translate-y-0.5"
            >
              <Rocket className="w-6 h-6" />
              Start Your Sprint
            </button>
          </div>
        ) : (
          /* Active sprint view */
          <div className="space-y-6">
            {/* Progress overview */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bento-card p-5">
                <p className="text-sm font-medium text-[--exec-text-muted] mb-1">
                  Progress
                </p>
                <p className="text-3xl font-bold text-[--exec-text]">
                  {sprint.progress_percentage.toFixed(0)}%
                </p>
                <div className="mt-3 h-2 bg-[--exec-surface-alt] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[--exec-accent] to-[--exec-sage] transition-all"
                    style={{ width: `${sprint.progress_percentage}%` }}
                  />
                </div>
              </div>
              <div className="bento-card p-5">
                <p className="text-sm font-medium text-[--exec-text-muted] mb-1">
                  Current Day
                </p>
                <p className="text-3xl font-bold text-[--exec-accent]">
                  {sprint.current_day}
                </p>
                <p className="text-sm text-[--exec-text-muted] mt-1">of 30</p>
              </div>
              <div className="bento-card p-5">
                <p className="text-sm font-medium text-[--exec-text-muted] mb-1">
                  Current Week
                </p>
                <p className="text-3xl font-bold text-[--exec-text]">
                  {sprint.current_week}
                </p>
                <p className="text-sm text-[--exec-text-muted] mt-1">
                  {WEEK_THEMES[sprint.current_week - 1]}
                </p>
              </div>
              <div className="bento-card p-5">
                <p className="text-sm font-medium text-[--exec-text-muted] mb-1">
                  Status
                </p>
                <div className="flex items-center gap-2 mt-2">
                  {sprint.status === 'active' ? (
                    <>
                      <div className="w-3 h-3 rounded-full bg-[--exec-sage] animate-pulse" />
                      <span className="font-bold text-[--exec-sage]">Active</span>
                    </>
                  ) : sprint.status === 'paused' ? (
                    <>
                      <Pause className="w-5 h-5 text-[--exec-warning]" />
                      <span className="font-bold text-[--exec-warning]">Paused</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5 text-[--exec-sage]" />
                      <span className="font-bold text-[--exec-sage]">
                        {sprint.status}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Today's card (prominent) */}
            {sprint.today && (
              <div className="bento-card overflow-hidden">
                <div className="flex items-center justify-between px-6 py-5 border-b border-[--exec-border-subtle] bg-gradient-to-r from-[--exec-accent-bg] to-transparent">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[--exec-accent] flex items-center justify-center text-white font-bold text-xl">
                      {sprint.today.day_number}
                    </div>
                    <div>
                      <h2 className="font-bold text-[--exec-text] text-lg">
                        Today - Day {sprint.today.day_number}
                      </h2>
                      <p className="text-sm text-[--exec-text-muted]">
                        {format(parseISO(sprint.today.log_date), 'EEEE, MMMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  {sprint.today.is_complete && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-[--exec-sage-bg] rounded-full">
                      <Check className="w-5 h-5 text-[--exec-sage]" />
                      <span className="font-bold text-[--exec-sage]">Complete!</span>
                    </div>
                  )}
                </div>
                <div className="p-6">
                  <DayCard
                    day={sprint.today}
                    sprint={sprint}
                    isExpanded={true}
                    onToggle={() => {}}
                  />
                </div>
              </div>
            )}

            {/* Week sections */}
            <div className="space-y-4">
              {WEEK_THEMES.map((theme, idx) => (
                <WeekSection
                  key={idx}
                  weekNumber={idx + 1}
                  theme={theme}
                  sprint={sprint}
                  days={sprint.days?.filter(d => d.week_number === idx + 1) || []}
                />
              ))}
            </div>

            {/* Past sprints */}
            {allSprints.length > 1 && (
              <div className="mt-12">
                <h3 className="text-lg font-bold text-[--exec-text] mb-4">
                  Past Sprints
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  {allSprints
                    .filter((s: SprintListItem) => s.id !== sprint?.id)
                    .map((pastSprint: SprintListItem) => (
                      <div
                        key={pastSprint.id}
                        className="bento-card p-5 group relative"
                      >
                        {/* Edit/Delete buttons - visible on hover */}
                        <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditingSprint(pastSprint)}
                            className="p-1.5 text-[--exec-text-muted] hover:text-[--exec-accent] hover:bg-[--exec-accent]/10 rounded-lg transition-colors"
                            title="Edit sprint"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete "${pastSprint.title}"? This cannot be undone.`)) {
                                deleteSprintMutation.mutate(pastSprint.id);
                              }
                            }}
                            disabled={deleteSprintMutation.isPending}
                            className="p-1.5 text-[--exec-text-muted] hover:text-[--exec-danger] hover:bg-[--exec-danger]/10 rounded-lg transition-colors disabled:opacity-50"
                            title="Delete sprint"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <p className="font-semibold text-[--exec-text] truncate pr-16">
                          {pastSprint.title}
                        </p>
                        <p className="text-sm text-[--exec-text-muted] mt-1">
                          {format(parseISO(pastSprint.start_date), 'MMM d')} -{' '}
                          {format(parseISO(pastSprint.end_date), 'MMM d, yyyy')}
                        </p>
                        <div className="flex items-center justify-between mt-3">
                          <span
                            className={cn(
                              'text-xs font-medium px-2 py-1 rounded-full',
                              pastSprint.status === 'completed'
                                ? 'bg-[--exec-sage-bg] text-[--exec-sage]'
                                : pastSprint.status === 'abandoned'
                                  ? 'bg-[--exec-danger-bg] text-[--exec-danger]'
                                  : 'bg-[--exec-surface-alt] text-[--exec-text-muted]'
                            )}
                          >
                            {pastSprint.status}
                          </span>
                          <span className="text-sm font-bold text-[--exec-text]">
                            {pastSprint.progress_percentage.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <StartSprintModal
        isOpen={showStartModal}
        onClose={() => setShowStartModal(false)}
        onStart={(data) => createMutation.mutate(data)}
        isStarting={createMutation.isPending}
      />

      {editingSprint && (
        <EditSprintModal
          sprint={editingSprint}
          isOpen={true}
          onClose={() => setEditingSprint(null)}
          onSave={(data) => updateSprintMutation.mutate({ id: editingSprint.id, data })}
          isSaving={updateSprintMutation.isPending}
        />
      )}

      <ExportReportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        reportContent={exportContent}
      />
    </div>
  );
}
