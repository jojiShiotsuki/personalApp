import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timeApi, taskApi, projectApi, dealApi } from '@/lib/api';
import type { TimeEntry, TimeEntryCreate, Task, Project, Deal } from '@/types';
import { useTimer, formatElapsedTime } from '@/contexts/TimerContext';
import { Clock, Play, Plus, Trash2, DollarSign, Calendar, Timer } from 'lucide-react';
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
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      {/* Header */}
      <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-b border-gray-200/60 dark:border-gray-700 px-8 py-6 sticky top-0 z-10 transition-colors duration-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">
              Time Tracking
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Track your time for billing and productivity insights
            </p>
          </div>
          <button
            onClick={() => setIsManualEntryOpen(true)}
            className="flex items-center px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm hover:shadow-md font-medium text-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Manual Entry
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <SummaryCard
            title="Today"
            hours={summary?.today.total_hours ?? 0}
            billable={summary?.today.total_billable ?? 0}
            entries={summary?.today.entry_count ?? 0}
            isLoading={summaryLoading}
          />
          <SummaryCard
            title="This Week"
            hours={summary?.this_week.total_hours ?? 0}
            billable={summary?.this_week.total_billable ?? 0}
            entries={summary?.this_week.entry_count ?? 0}
            isLoading={summaryLoading}
          />
          <SummaryCard
            title="This Month"
            hours={summary?.this_month.total_hours ?? 0}
            billable={summary?.this_month.total_billable ?? 0}
            entries={summary?.this_month.entry_count ?? 0}
            isLoading={summaryLoading}
          />
        </div>

        {/* Start Timer Section */}
        {!currentTimer && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700 p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Play className="w-5 h-5 text-green-500" />
              Start Timer
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input
                type="text"
                value={startDescription}
                onChange={(e) => setStartDescription(e.target.value)}
                placeholder="What are you working on?"
                className="col-span-1 md:col-span-2 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-gray-900 dark:text-white"
              />
              <select
                value={startTaskId ?? ''}
                onChange={(e) => setStartTaskId(e.target.value ? Number(e.target.value) : undefined)}
                className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-gray-900 dark:text-white"
              >
                <option value="">Select Task (optional)</option>
                {tasks.filter(t => t.status !== 'completed').map(task => (
                  <option key={task.id} value={task.id}>{task.title}</option>
                ))}
              </select>
              <select
                value={startProjectId ?? ''}
                onChange={(e) => setStartProjectId(e.target.value ? Number(e.target.value) : undefined)}
                className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-gray-900 dark:text-white"
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
                className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-gray-900 dark:text-white"
              >
                <option value="">Select Deal (optional)</option>
                {deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage)).map(deal => (
                  <option key={deal.id} value={deal.id}>{deal.title}</option>
                ))}
              </select>
              <div className="col-span-1 md:col-span-3 flex justify-end">
                <button
                  onClick={handleStartTimer}
                  className="flex items-center px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-all shadow-sm hover:shadow-md font-medium text-sm"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Timer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Current Timer Display */}
        {currentTimer && (
          <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl shadow-sm border border-green-200 dark:border-green-800 p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-green-800 dark:text-green-200 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Timer Running
                </h2>
                <p className="text-sm text-green-600 dark:text-green-300 mt-1">
                  {currentTimer.task_title || currentTimer.project_name || currentTimer.deal_title || currentTimer.description || 'No description'}
                </p>
              </div>
              <div className="text-3xl font-mono font-bold text-green-700 dark:text-green-300">
                {formatElapsedTime(elapsedSeconds)}
              </div>
            </div>
          </div>
        )}

        {/* Recent Entries */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200/60 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" />
              Recent Time Entries
            </h2>
          </div>
          {entriesLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500 dark:text-gray-400">
              <Timer className="w-8 h-8 mb-2 opacity-50" />
              <p>No time entries yet. Start tracking!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
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
}: {
  title: string;
  hours: number;
  billable: number;
  entries: number;
  isLoading: boolean;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700 p-6">
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {title}
      </h3>
      {isLoading ? (
        <div className="animate-pulse mt-2">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-20" />
        </div>
      ) : (
        <>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900 dark:text-white">
              {hours.toFixed(1)}h
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              ({entries} {entries === 1 ? 'entry' : 'entries'})
            </span>
          </div>
          {billable > 0 && (
            <div className="mt-2 flex items-center gap-1 text-green-600 dark:text-green-400">
              <DollarSign className="w-4 h-4" />
              <span className="font-medium">
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
    <div className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 dark:text-white truncate">
          {getLabel()}
        </p>
        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {format(new Date(entry.start_time), 'MMM d, yyyy')}
          </span>
          <span>
            {format(new Date(entry.start_time), 'h:mm a')}
            {entry.end_time && ` - ${format(new Date(entry.end_time), 'h:mm a')}`}
          </span>
          {getContext() && <span className="text-gray-400">• {getContext()}</span>}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="font-mono font-semibold text-gray-900 dark:text-white">
          {formatDuration(entry.duration_seconds)}
        </span>
        {entry.billable_amount && (
          <span className="text-green-600 dark:text-green-400 font-medium">
            ${entry.billable_amount.toFixed(2)}
          </span>
        )}
        <button
          onClick={onDelete}
          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
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
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Add Manual Time Entry
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What did you work on?"
              className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-gray-900 dark:text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Time
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Time
              </label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-gray-900 dark:text-white"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Task (optional)
              </label>
              <select
                value={taskId ?? ''}
                onChange={(e) => setTaskId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-gray-900 dark:text-white"
              >
                <option value="">None</option>
                {tasks.map(task => (
                  <option key={task.id} value={task.id}>{task.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Project (optional)
              </label>
              <select
                value={projectId ?? ''}
                onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-gray-900 dark:text-white"
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Deal (optional)
              </label>
              <select
                value={dealId ?? ''}
                onChange={(e) => setDealId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-gray-900 dark:text-white"
              >
                <option value="">None</option>
                {deals.map(deal => (
                  <option key={deal.id} value={deal.id}>{deal.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Hourly Rate (optional)
              </label>
              <input
                type="number"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-gray-900 dark:text-white"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors text-sm font-medium disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
