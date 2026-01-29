import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timeApi, taskApi, projectApi, dealApi } from '@/lib/api';
import type { TimeEntry, TimeEntryCreate, Task, Project, Deal } from '@/types';
import { useTimer, formatElapsedTime } from '@/contexts/TimerContext';
import { Clock, Play, Plus, Trash2, DollarSign, Calendar, Timer, X, Hourglass } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function Time() {
  const queryClient = useQueryClient();
  const { currentTimer, startTimer, elapsedSeconds } = useTimer();
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [startDescription, setStartDescription] = useState('');
  const [startTaskId, setStartTaskId] = useState<number | undefined>();
  const [startProjectId, setStartProjectId] = useState<number | undefined>();
  const [startDealId, setStartDealId] = useState<number | undefined>();

  // Fetch data
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['time-summary'],
    queryFn: timeApi.getSummary,
  });

  const { data: entries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ['time-entries'],
    queryFn: () => timeApi.listEntries({ limit: 50 }),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => taskApi.getAll(),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectApi.getAll(),
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['deals'],
    queryFn: () => dealApi.getAll(),
  });

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: timeApi.deleteEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['time-summary'] });
      toast.success('Time entry deleted');
    },
  });

  const handleStartTimer = async () => {
    await startTimer({
      description: startDescription || undefined,
      task_id: startTaskId,
      project_id: startProjectId,
      deal_id: startDealId,
    });
    setStartDescription('');
    setStartTaskId(undefined);
    setStartProjectId(undefined);
    setStartDealId(undefined);
    queryClient.invalidateQueries({ queryKey: ['time-entries'] });
    queryClient.invalidateQueries({ queryKey: ['time-summary'] });
    toast.success('Timer started');
  };

  return (
    <div className="min-h-full bg-[--exec-bg] grain">
      {/* Hero Header */}
      <header className="relative overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[--exec-surface] via-[--exec-surface] to-[--exec-accent-bg-subtle]" />

        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-[--exec-accent]/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-gradient-to-t from-[--exec-sage]/5 to-transparent rounded-full blur-2xl" />

        <div className="relative px-8 pt-8 pb-6">
          {/* Breadcrumb chip */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[--exec-surface-alt] rounded-full mb-4 animate-fade-slide-up">
            <Hourglass className="w-3.5 h-3.5 text-[--exec-accent]" />
            <span className="text-xs font-medium text-[--exec-text-secondary]">Productivity</span>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-4xl font-bold text-[--exec-text] tracking-tight animate-fade-slide-up delay-1" style={{ fontFamily: 'var(--font-display)' }}>
                Time <span className="text-[--exec-accent]">Tracking</span>
              </h1>
              <p className="text-[--exec-text-secondary] mt-2 text-lg animate-fade-slide-up delay-2">
                Track your time for billing and productivity insights
              </p>
            </div>
            <button
              onClick={() => setIsManualEntryOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[--exec-surface] border border-[--exec-border] text-[--exec-text-secondary] rounded-2xl hover:bg-[--exec-surface-alt] hover:border-[--exec-accent] hover:text-[--exec-accent] transition-all duration-200 font-medium text-sm animate-fade-slide-up delay-3"
            >
              <Plus className="w-4 h-4" />
              Manual Entry
            </button>
          </div>
        </div>
      </header>

      <div className="px-8 py-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
          <SummaryCard
            title="Today"
            hours={summary?.today.total_hours ?? 0}
            billable={summary?.today.total_billable ?? 0}
            entries={summary?.today.entry_count ?? 0}
            isLoading={summaryLoading}
            delay={4}
          />
          <SummaryCard
            title="This Week"
            hours={summary?.this_week.total_hours ?? 0}
            billable={summary?.this_week.total_billable ?? 0}
            entries={summary?.this_week.entry_count ?? 0}
            isLoading={summaryLoading}
            delay={5}
          />
          <SummaryCard
            title="This Month"
            hours={summary?.this_month.total_hours ?? 0}
            billable={summary?.this_month.total_billable ?? 0}
            entries={summary?.this_month.entry_count ?? 0}
            isLoading={summaryLoading}
            delay={6}
          />
        </div>

        {/* Start Timer Section */}
        {!currentTimer && (
          <div className="bento-card-static p-6 mb-6 animate-fade-slide-up delay-7">
            <h2 className="text-lg font-bold text-[--exec-text] mb-4 flex items-center gap-3" style={{ fontFamily: 'var(--font-display)' }}>
              <div className="w-9 h-9 rounded-xl bg-[--exec-success-bg] flex items-center justify-center">
                <Play className="w-4 h-4 text-[--exec-success]" />
              </div>
              Start Timer
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input
                type="text"
                value={startDescription}
                onChange={(e) => setStartDescription(e.target.value)}
                placeholder="What are you working on?"
                className="col-span-1 md:col-span-2 px-4 py-3 bg-[--exec-surface-alt] border border-[--exec-border] rounded-xl focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent] transition-all text-sm text-[--exec-text] placeholder-[--exec-text-muted]"
              />
              <select
                value={startTaskId ?? ''}
                onChange={(e) => setStartTaskId(e.target.value ? Number(e.target.value) : undefined)}
                className="px-4 py-3 bg-[--exec-surface-alt] border border-[--exec-border] rounded-xl focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent] transition-all text-sm text-[--exec-text] cursor-pointer"
              >
                <option value="">Select Task (optional)</option>
                {tasks.filter(t => t.status !== 'completed').map(task => (
                  <option key={task.id} value={task.id}>{task.title}</option>
                ))}
              </select>
              <select
                value={startProjectId ?? ''}
                onChange={(e) => setStartProjectId(e.target.value ? Number(e.target.value) : undefined)}
                className="px-4 py-3 bg-[--exec-surface-alt] border border-[--exec-border] rounded-xl focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent] transition-all text-sm text-[--exec-text] cursor-pointer"
              >
                <option value="">Select Project (optional)</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
              <select
                value={startDealId ?? ''}
                onChange={(e) => setStartDealId(e.target.value ? Number(e.target.value) : undefined)}
                className="px-4 py-3 bg-[--exec-surface-alt] border border-[--exec-border] rounded-xl focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent] transition-all text-sm text-[--exec-text] cursor-pointer"
              >
                <option value="">Select Deal (optional)</option>
                {deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage)).map(deal => (
                  <option key={deal.id} value={deal.id}>{deal.title}</option>
                ))}
              </select>
              <div className="col-span-1 md:col-span-3 flex justify-end">
                <button
                  onClick={handleStartTimer}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[--exec-sage] to-[--exec-sage-light] text-white rounded-xl hover:shadow-lg hover:shadow-[--exec-sage]/25 hover:-translate-y-0.5 transition-all duration-200 font-semibold text-sm"
                >
                  <Play className="w-4 h-4" />
                  Start Timer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Current Timer Display */}
        {currentTimer && (
          <div className="bg-[--exec-success-bg] rounded-2xl border border-[--exec-success]/20 p-6 mb-6 animate-fade-slide-up">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[--exec-success] flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
                  <div className="w-3 h-3 rounded-full bg-[--exec-success] animate-pulse" />
                  Timer Running
                </h2>
                <p className="text-sm text-[--exec-text-secondary] mt-1">
                  {currentTimer.task_title || currentTimer.project_name || currentTimer.deal_title || currentTimer.description || 'No description'}
                </p>
              </div>
              <div className="text-4xl font-mono font-bold text-[--exec-success]" style={{ fontFamily: 'var(--font-display)' }}>
                {formatElapsedTime(elapsedSeconds)}
              </div>
            </div>
          </div>
        )}

        {/* Recent Entries */}
        <div className="bento-card-static overflow-hidden animate-fade-slide-up delay-8">
          <div className="px-6 py-5 border-b border-[--exec-border-subtle]">
            <h2 className="text-lg font-bold text-[--exec-text] flex items-center gap-3" style={{ fontFamily: 'var(--font-display)' }}>
              <div className="w-9 h-9 rounded-xl bg-[--exec-accent-bg] flex items-center justify-center">
                <Clock className="w-4 h-4 text-[--exec-accent]" />
              </div>
              Recent Time Entries
            </h2>
          </div>
          {entriesLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[--exec-accent]" />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[--exec-text-muted]">
              <div className="w-16 h-16 rounded-2xl bg-[--exec-surface-alt] flex items-center justify-center mb-4">
                <Timer className="w-8 h-8" />
              </div>
              <p className="font-medium">No time entries yet</p>
              <p className="text-sm mt-1">Start tracking to see your entries here</p>
            </div>
          ) : (
            <div className="divide-y divide-[--exec-border-subtle]">
              {entries.map((entry) => (
                <TimeEntryRow
                  key={entry.id}
                  entry={entry}
                  onDelete={() => deleteMutation.mutate(entry.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Manual Entry Modal */}
      {isManualEntryOpen && (
        <ManualEntryModal
          onClose={() => setIsManualEntryOpen(false)}
          tasks={tasks}
          projects={projects}
          deals={deals}
        />
      )}
    </div>
  );
}

// Summary Card Component
function SummaryCard({
  title,
  hours,
  billable,
  entries,
  isLoading,
  delay = 0,
}: {
  title: string;
  hours: number;
  billable: number;
  entries: number;
  isLoading: boolean;
  delay?: number;
}) {
  return (
    <div
      className="bento-card p-6 animate-fade-slide-up"
      style={{ animationDelay: `${delay * 50}ms` }}
    >
      <h3 className="text-xs font-bold text-[--exec-text-muted] uppercase tracking-wider">
        {title}
      </h3>
      {isLoading ? (
        <div className="animate-pulse mt-3">
          <div className="h-10 bg-[--exec-surface-alt] rounded-lg w-24" />
        </div>
      ) : (
        <>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-4xl font-bold text-[--exec-text]" style={{ fontFamily: 'var(--font-display)' }}>
              {hours.toFixed(1)}h
            </span>
            <span className="text-sm text-[--exec-text-muted]">
              ({entries} {entries === 1 ? 'entry' : 'entries'})
            </span>
          </div>
          {billable > 0 && (
            <div className="mt-3 flex items-center gap-1.5 text-[--exec-success]">
              <DollarSign className="w-4 h-4" />
              <span className="font-bold">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                }).format(billable)}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Time Entry Row Component
function TimeEntryRow({
  entry,
  onDelete,
}: {
  entry: TimeEntry;
  onDelete: () => void;
}) {
  const formatDuration = (seconds: number | undefined): string => {
    if (!seconds) return '0m';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getLabel = () => {
    if (entry.task_title) return entry.task_title;
    if (entry.project_name) return entry.project_name;
    if (entry.deal_title) return entry.deal_title;
    if (entry.description) return entry.description;
    return 'No description';
  };

  const getContext = () => {
    const parts = [];
    if (entry.task_title && entry.project_name) parts.push(entry.project_name);
    if (entry.deal_title && !parts.includes(entry.deal_title)) parts.push(entry.deal_title);
    return parts.join(' • ');
  };

  return (
    <div className="px-6 py-4 flex items-center justify-between hover:bg-[--exec-surface-alt] transition-colors group">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[--exec-text] truncate">
          {getLabel()}
        </p>
        <div className="flex items-center gap-3 mt-1.5 text-sm text-[--exec-text-muted]">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3" />
            {format(new Date(entry.start_time), 'MMM d, yyyy')}
          </span>
          <span>
            {format(new Date(entry.start_time), 'h:mm a')}
            {entry.end_time && ` - ${format(new Date(entry.end_time), 'h:mm a')}`}
          </span>
          {getContext() && <span className="text-[--exec-text-muted]">• {getContext()}</span>}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="font-mono font-bold text-[--exec-text]" style={{ fontFamily: 'var(--font-display)' }}>
          {formatDuration(entry.duration_seconds)}
        </span>
        {entry.billable_amount && (
          <span className="text-[--exec-success] font-bold">
            ${entry.billable_amount.toFixed(2)}
          </span>
        )}
        <button
          onClick={onDelete}
          className="p-2 text-[--exec-text-muted] hover:text-[--exec-danger] hover:bg-[--exec-danger-bg] rounded-lg transition-colors opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Manual Entry Modal
function ManualEntryModal({
  onClose,
  tasks,
  projects,
  deals,
}: {
  onClose: () => void;
  tasks: Task[];
  projects: Project[];
  deals: Deal[];
}) {
  const queryClient = useQueryClient();
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [endTime, setEndTime] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [taskId, setTaskId] = useState<number | undefined>();
  const [projectId, setProjectId] = useState<number | undefined>();
  const [dealId, setDealId] = useState<number | undefined>();
  const [hourlyRate, setHourlyRate] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: TimeEntryCreate) => timeApi.createEntry(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['time-summary'] });
      toast.success('Time entry created');
      onClose();
    },
    onError: () => {
      toast.error('Failed to create time entry');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      description: description || undefined,
      start_time: startTime,
      end_time: endTime,
      task_id: taskId,
      project_id: projectId,
      deal_id: dealId,
      hourly_rate: hourlyRate ? Number(hourlyRate) : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-[--exec-border-subtle]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[--exec-border-subtle]">
          <h2 className="text-xl font-bold text-[--exec-text]" style={{ fontFamily: 'var(--font-display)' }}>
            Add Manual Time Entry
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-[--exec-surface-alt] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-[--exec-text] mb-2">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What did you work on?"
              className="w-full px-4 py-3 bg-[--exec-surface-alt] border border-[--exec-border] rounded-xl focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent] transition-all text-sm text-[--exec-text] placeholder-[--exec-text-muted]"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[--exec-text] mb-2">
                Start Time
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="w-full px-4 py-3 bg-[--exec-surface-alt] border border-[--exec-border] rounded-xl focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent] transition-all text-sm text-[--exec-text]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[--exec-text] mb-2">
                End Time
              </label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                className="w-full px-4 py-3 bg-[--exec-surface-alt] border border-[--exec-border] rounded-xl focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent] transition-all text-sm text-[--exec-text]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[--exec-text] mb-2">
                Task (optional)
              </label>
              <select
                value={taskId ?? ''}
                onChange={(e) => setTaskId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-4 py-3 bg-[--exec-surface-alt] border border-[--exec-border] rounded-xl focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent] transition-all text-sm text-[--exec-text] cursor-pointer"
              >
                <option value="">None</option>
                {tasks.map(task => (
                  <option key={task.id} value={task.id}>{task.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[--exec-text] mb-2">
                Project (optional)
              </label>
              <select
                value={projectId ?? ''}
                onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-4 py-3 bg-[--exec-surface-alt] border border-[--exec-border] rounded-xl focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent] transition-all text-sm text-[--exec-text] cursor-pointer"
              >
                <option value="">None</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[--exec-text] mb-2">
                Deal (optional)
              </label>
              <select
                value={dealId ?? ''}
                onChange={(e) => setDealId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-4 py-3 bg-[--exec-surface-alt] border border-[--exec-border] rounded-xl focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent] transition-all text-sm text-[--exec-text] cursor-pointer"
              >
                <option value="">None</option>
                {deals.map(deal => (
                  <option key={deal.id} value={deal.id}>{deal.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[--exec-text] mb-2">
                Hourly Rate (optional)
              </label>
              <input
                type="number"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full px-4 py-3 bg-[--exec-surface-alt] border border-[--exec-border] rounded-xl focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent] transition-all text-sm text-[--exec-text] placeholder-[--exec-text-muted]"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-4 border-t border-[--exec-border-subtle]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 text-sm font-medium text-[--exec-text-secondary] border border-[--exec-border] hover:bg-[--exec-surface-alt] rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-[--exec-accent] to-[--exec-accent-dark] hover:shadow-lg hover:shadow-[--exec-accent]/25 text-white rounded-xl transition-all text-sm font-semibold disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
