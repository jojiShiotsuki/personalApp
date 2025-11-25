import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskApi, goalApi, projectApi } from '@/lib/api';
import type { Task, TaskCreate, TaskUpdate } from '@/types';
import { TaskStatus, TaskPriority, RecurrenceType } from '@/types';
import TaskList from '@/components/TaskList';
import TaskKanbanBoard from '@/components/TaskKanbanBoard';
import AIChatPanel from '@/components/AIChatPanel';
import RecurrenceCustomModal from '@/components/RecurrenceCustomModal';
import ConfirmModal from '@/components/ConfirmModal';
import { Filter, Plus, X, Repeat, LayoutList, Kanban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getNextOccurrences, getRecurrenceText } from '@/lib/recurrence';
import { useRecurrence } from '@/hooks/useRecurrence';
import { isDateStringToday, isDateStringThisWeek, isDateStringThisMonth, isDateStringOverdue } from '@/lib/dateUtils';
import { toast } from 'sonner';

type FilterValue = TaskStatus | 'all' | 'today' | 'this_week' | 'this_month' | 'overdue';
type SortOption = 'dueDate' | 'priority' | 'createdDate' | 'title';

// Sort comparison functions
const sortFunctions: Record<SortOption, (a: Task, b: Task) => number> = {
  dueDate: (a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1; // null dates last
    if (!b.due_date) return -1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  },
  priority: (a, b) => {
    const priorityOrder: Record<string, number> = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3
    };
    const aPriority = priorityOrder[a.priority] ?? 999;
    const bPriority = priorityOrder[b.priority] ?? 999;
    return aPriority - bPriority;
  },
  createdDate: (a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); // newest first
  },
  title: (a, b) => {
    return a.title.localeCompare(b.title);
  }
};

export default function Tasks() {
  const [filter, setFilter] = useState<FilterValue>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('dueDate');
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showBulkStatusChange, setShowBulkStatusChange] = useState(false);
  // Recurrence state managed by custom hook
  const {
    isRecurring, setIsRecurring,
    recurrenceType, setRecurrenceType,
    recurrenceInterval, setRecurrenceInterval,
    recurrenceDays, setRecurrenceDays,
    recurrenceEndType, setRecurrenceEndType,
    recurrenceEndDate, setRecurrenceEndDate,
    recurrenceCount, setRecurrenceCount,
    isCustomRecurrenceOpen, setIsCustomRecurrenceOpen,
    resetRecurrence,
    initFromTask,
  } = useRecurrence();
  const [dueDate, setDueDate] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const queryClient = useQueryClient();


  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Note: Global Ctrl+K listener moved to App.tsx to avoid duplicate modals

  // Only pass status filters to API, handle time filters on frontend
  const getApiFilter = (filter: FilterValue): TaskStatus | undefined => {
    const statusFilters = [TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED, TaskStatus.DELAYED];
    return statusFilters.includes(filter as TaskStatus) ? (filter as TaskStatus) : undefined;
  };

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => taskApi.getAll(getApiFilter(filter)),
  });

  const { data: goals = [] } = useQuery({
    queryKey: ['goals'],
    queryFn: () => goalApi.getAll(),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: projectApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: (task: TaskCreate) => taskApi.create(task),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsModalOpen(false);
      setEditingTask(null);
      toast.success('Task created successfully');
    },
    onError: () => {
      toast.error('Failed to create task. Please try again.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: TaskUpdate }) =>
      taskApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsModalOpen(false);
      setEditingTask(null);
      toast.success('Task updated successfully');
    },
    onError: () => {
      toast.error('Failed to update task. Please try again.');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: TaskStatus }) =>
      taskApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: () => {
      toast.error('Failed to update task status. Please try again.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => taskApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: () => {
      toast.error('Failed to delete task. Please try again.');
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => taskApi.bulkDelete(ids),
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setSelectedTaskIds(new Set());
      setShowDeleteConfirm(false);
      setIsEditMode(false);
      toast.success(`Deleted ${ids.length} task${ids.length !== 1 ? 's' : ''} successfully`);
    },
    onError: () => {
      toast.error('Failed to delete tasks. Please try again.');
    },
  });

  const bulkStatusUpdateMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: number[]; status: TaskStatus }) => {
      await Promise.all(ids.map(id => taskApi.updateStatus(id, status)));
    },
    onSuccess: (_, { ids }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setSelectedTaskIds(new Set());
      setShowBulkStatusChange(false);
      toast.success(`Updated ${ids.length} task${ids.length !== 1 ? 's' : ''} successfully`);
    },
    onError: () => {
      toast.error('Failed to update tasks. Please try again.');
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const goalIdValue = formData.get('goal_id') as string;
    const projectIdValue = formData.get('project_id') as string;

    const data: TaskCreate = {
      title: formData.get('title') as string,
      description: formData.get('description') as string || undefined,
      due_date: dueDate || undefined,
      due_time: formData.get('due_time') as string || undefined,
      priority: (formData.get('priority') as TaskPriority) || TaskPriority.MEDIUM,
      status: (formData.get('status') as TaskStatus) || TaskStatus.PENDING,
      goal_id: goalIdValue ? parseInt(goalIdValue, 10) : undefined,
      project_id: projectIdValue ? parseInt(projectIdValue, 10) : undefined,
      // Recurrence fields
      is_recurring: isRecurring,
      recurrence_type: isRecurring ? recurrenceType : undefined,
      recurrence_interval: isRecurring ? recurrenceInterval : undefined,
      recurrence_days: isRecurring && recurrenceType === RecurrenceType.WEEKLY ? recurrenceDays : undefined,
      recurrence_end_date: isRecurring && recurrenceEndType === 'date' ? recurrenceEndDate : undefined,
      recurrence_count: isRecurring && recurrenceEndType === 'count' ? recurrenceCount : undefined,
    };

    if (editingTask) {
      updateMutation.mutate({ id: editingTask.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleStatusChange = (id: number, status: TaskStatus) => {
    updateStatusMutation.mutate({ id, status });
  };

  const handleTaskClick = (task: Task) => {
    setEditingTask(task);
    setDueDate(task.due_date || '');
    initFromTask(task);
    setIsModalOpen(true);
  };

  const handleNewTask = () => {
    setEditingTask(null);
    setDueDate(new Date().toISOString().split('T')[0]);
    resetRecurrence();
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTask(null);
    resetRecurrence();
  };

  const handleToggleSelect = (taskId: number) => {
    setSelectedTaskIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedTaskIds.size === filteredAndSortedTasks.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(filteredAndSortedTasks.map(t => t.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedTaskIds.size > 0) {
      bulkDeleteMutation.mutate(Array.from(selectedTaskIds));
    }
  };

  const handleBulkStatusChange = (status: TaskStatus) => {
    if (selectedTaskIds.size > 0) {
      bulkStatusUpdateMutation.mutate({ ids: Array.from(selectedTaskIds), status });
    }
  };

  const handleToggleEditMode = () => {
    setIsEditMode(!isEditMode);
    setSelectedTaskIds(new Set()); // Clear selections when toggling
  };

  // Get count for a specific filter
  const getFilterCount = (filterValue: FilterValue): number => {
    if (filterValue === 'all') return tasks.length;

    return tasks.filter(task => {
      // Time-based filters
      if (filterValue === 'today') return isDateStringToday(task.due_date);
      if (filterValue === 'this_week') return isDateStringThisWeek(task.due_date);
      if (filterValue === 'this_month') return isDateStringThisMonth(task.due_date);
      if (filterValue === 'overdue') return isDateStringOverdue(task.due_date) && task.status !== TaskStatus.COMPLETED;

      // Status-based filters
      if (filterValue === TaskStatus.PENDING) return task.status === TaskStatus.PENDING;
      if (filterValue === TaskStatus.IN_PROGRESS) return task.status === TaskStatus.IN_PROGRESS;
      if (filterValue === TaskStatus.COMPLETED) return task.status === TaskStatus.COMPLETED;
      if (filterValue === TaskStatus.DELAYED) return task.status === TaskStatus.DELAYED;

      return false;
    }).length;
  };

  const filters: Array<{ label: string; value: FilterValue }> = [
    { label: 'All', value: 'all' },
    { label: 'Today', value: 'today' },
    { label: 'This Week', value: 'this_week' },
    { label: 'This Month', value: 'this_month' },
    { label: 'Overdue', value: 'overdue' },
    { label: 'Pending', value: TaskStatus.PENDING },
    { label: 'In Progress', value: TaskStatus.IN_PROGRESS },
    { label: 'Completed', value: TaskStatus.COMPLETED },
  ];

  // Filter and sort tasks
  const filteredAndSortedTasks = useMemo(() => {
    // Filter by status or time period
    let result = filter === 'all'
      ? tasks
      : tasks.filter(task => {
          // Time-based filters
          if (filter === 'today') return isDateStringToday(task.due_date);
          if (filter === 'this_week') return isDateStringThisWeek(task.due_date);
          if (filter === 'this_month') return isDateStringThisMonth(task.due_date);
          if (filter === 'overdue') return isDateStringOverdue(task.due_date) && task.status !== TaskStatus.COMPLETED;

          // Status-based filters
          if (filter === TaskStatus.PENDING) return task.status === TaskStatus.PENDING;
          if (filter === TaskStatus.IN_PROGRESS) return task.status === TaskStatus.IN_PROGRESS;
          if (filter === TaskStatus.COMPLETED) return task.status === TaskStatus.COMPLETED;
          if (filter === TaskStatus.DELAYED) return task.status === TaskStatus.DELAYED;
          return true;
        });

    // Apply search filter
    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase().trim();
      result = result.filter(task =>
        task.title.toLowerCase().includes(query) ||
        (task.description && task.description.toLowerCase().includes(query))
      );
    }

    // Apply sorting
    result = [...result].sort(sortFunctions[sortBy]);

    return result;
  }, [tasks, filter, debouncedSearch, sortBy]);

  const currentDateObj = useMemo(() => dueDate ? new Date(dueDate) : new Date(), [dueDate]);
  const currentDayShort = currentDateObj.toLocaleDateString('en-US', { weekday: 'short' });
  const currentDayLong = currentDateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const currentMonthDay = currentDateObj.getDate();
  const currentMonthLong = currentDateObj.toLocaleDateString('en-US', { month: 'long' });

  const getRecurrenceValue = () => {
    if (!isRecurring) return 'none';
    if (recurrenceType === RecurrenceType.DAILY && recurrenceInterval === 1) return 'daily';
    
    if (recurrenceType === RecurrenceType.WEEKLY && recurrenceInterval === 1) {
      if (recurrenceDays.length === 1 && recurrenceDays[0] === currentDayShort) return 'weekly';
      if (recurrenceDays.length === 5 && 
          ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].every(d => recurrenceDays.includes(d)) &&
          recurrenceDays.length === 5) return 'weekday';
    }
    
    if (recurrenceType === RecurrenceType.MONTHLY && recurrenceInterval === 1) return 'monthly';
    if (recurrenceType === RecurrenceType.YEARLY && recurrenceInterval === 1) return 'yearly';
    
    return 'custom';
  };

  const handleRecurrenceChange = (value: string) => {
    if (value === 'custom') {
      setIsCustomRecurrenceOpen(true);
      return;
    }

    setIsRecurring(value !== 'none');
    
    if (value === 'none') {
      setRecurrenceInterval(1);
      setRecurrenceDays([]);
      setRecurrenceEndType('never');
      return;
    }

    setRecurrenceInterval(1);
    setRecurrenceEndType('never');
    setRecurrenceEndDate('');
    setRecurrenceCount(13);

    switch (value) {
      case 'daily':
        setRecurrenceType(RecurrenceType.DAILY);
        setRecurrenceDays([]);
        break;
      case 'weekly':
        setRecurrenceType(RecurrenceType.WEEKLY);
        setRecurrenceDays([currentDayShort]);
        break;
      case 'monthly':
        setRecurrenceType(RecurrenceType.MONTHLY);
        setRecurrenceDays([]);
        break;
      case 'yearly':
        setRecurrenceType(RecurrenceType.YEARLY);
        setRecurrenceDays([]);
        break;
      case 'weekday':
        setRecurrenceType(RecurrenceType.WEEKLY);
        setRecurrenceDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
        break;
    }
  };

  return (
    <div className="flex h-full bg-gray-50">
      <div className="flex-1 h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200/60 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Tasks</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage and track your daily tasks
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex items-center bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  viewMode === 'list' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
                title="List View"
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('board')}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  viewMode === 'board' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
                title="Board View"
              >
                <Kanban className="w-4 h-4" />
              </button>
            </div>

            {/* Bulk action buttons (show when tasks are selected in edit mode) */}
            {isEditMode && selectedTaskIds.size > 0 && (
              <>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={bulkDeleteMutation.isPending}
                  className={cn(
                    'flex items-center',
                    'px-4 py-2',
                    'bg-rose-50 text-rose-600 border border-rose-100',
                    'rounded-xl',
                    'hover:bg-rose-100',
                    'transition-all duration-200',
                    'text-sm font-medium',
                    'disabled:opacity-50'
                  )}
                >
                  <X className="w-4 h-4 mr-2" />
                  Delete {selectedTaskIds.size}
                </button>

                <button
                  onClick={() => setShowBulkStatusChange(true)}
                  disabled={bulkStatusUpdateMutation.isPending}
                  className={cn(
                    'flex items-center',
                    'px-4 py-2',
                    'bg-emerald-50 text-emerald-600 border border-emerald-100',
                    'rounded-xl',
                    'hover:bg-emerald-100',
                    'transition-all duration-200',
                    'text-sm font-medium',
                    'disabled:opacity-50'
                  )}
                >
                  Change Status
                </button>
              </>
            )}

            {/* Edit/Done toggle button */}
            <button
              onClick={handleToggleEditMode}
              className={cn(
                'flex items-center',
                'px-4 py-2',
                'rounded-xl',
                'transition-all duration-200',
                'text-sm font-medium',
                isEditMode
                  ? 'bg-gray-900 text-white hover:bg-gray-800 shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              )}
            >
              {isEditMode ? 'Done' : 'Edit'}
            </button>

            {/* New Task button (hide in edit mode) */}
            {!isEditMode && (
              <button
                onClick={handleNewTask}
                className={cn(
                  'group flex items-center',
                  'px-4 py-2',
                  'bg-blue-600 text-white',
                  'rounded-xl',
                  'hover:bg-blue-700',
                  'transition-all duration-200',
                  'shadow-sm hover:shadow-md',
                  'text-sm font-medium'
                )}
              >
                <Plus className="w-5 h-5 mr-2 transition-transform duration-200 group-hover:rotate-90" />
                New Task
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200/60 px-8 py-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
          <Filter className="w-4 h-4 text-gray-400 flex-shrink-0 mr-2" />
          <div className="flex gap-2">
            {filters.map((f) => {
              const count = getFilterCount(f.value);
              return (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium rounded-lg',
                    'transition-all duration-200',
                    'whitespace-nowrap',
                    filter === f.value
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  )}
                >
                  {f.label} <span className={cn("text-xs ml-1", filter === f.value ? "text-blue-500" : "text-gray-400")}>({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Search and Sort Toolbar */}
      <div className="bg-white border-b border-gray-200/60 px-8 py-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Select All Checkbox (only in edit mode) */}
          {isEditMode && filteredAndSortedTasks.length > 0 && (
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={selectedTaskIds.size === filteredAndSortedTasks.length && filteredAndSortedTasks.length > 0}
                onChange={handleSelectAll}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label className="ml-2 text-sm text-gray-700 font-medium">Select All</label>
            </div>
          )}
          {/* Search Input */}
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Search tasks by title or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  'w-full px-4 py-2.5 pl-10',
                  'bg-gray-50 border border-gray-200 rounded-xl',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
                  'transition-all duration-200',
                  'text-sm'
                )}
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>
          {/* Sort Dropdown */}
          <div className="sm:w-64">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className={cn(
                'w-full px-4 py-2.5',
                'bg-gray-50 border border-gray-200 rounded-xl',
                'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
                'transition-all duration-200',
                'cursor-pointer text-sm'
              )}
            >
              <option value="dueDate">Sort by: Due Date</option>
              <option value="priority">Sort by: Priority</option>
              <option value="createdDate">Sort by: Created Date</option>
              <option value="title">Sort by: Title</option>
            </select>
          </div>
        </div>
      </div>

      {/* Task List or Kanban Board */}
      <div className="flex-1 overflow-auto px-8 py-6 bg-gray-50/30">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600"></div>
          </div>
        ) : (
          <div className="h-full animate-in fade-in duration-300">
            {viewMode === 'board' ? (
              <TaskKanbanBoard
                tasks={filteredAndSortedTasks}
                projects={projects}
                goals={goals}
                onStatusChange={handleStatusChange}
                onTaskClick={handleTaskClick}
              />
            ) : (
              <TaskList
                tasks={filteredAndSortedTasks}
                onStatusChange={handleStatusChange}
                onTaskClick={handleTaskClick}
                onDelete={(id) => deleteMutation.mutate(id)}
                isUpdating={updateStatusMutation.isPending}
                searchQuery={searchQuery}
                selectedTaskIds={isEditMode ? selectedTaskIds : undefined}
                onToggleSelect={isEditMode ? handleToggleSelect : undefined}
                goals={goals}
              />
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl ring-1 ring-gray-900/5 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {editingTask ? 'Edit Task' : 'New Task'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  defaultValue={editingTask?.title}
                  required
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="What needs to be done?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Description
                </label>
                <textarea
                  name="description"
                  defaultValue={editingTask?.description}
                  rows={3}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                  placeholder="Add details..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {isRecurring ? 'Start Date' : 'Due Date'}
                  </label>
                  <input
                    type="date"
                    name="due_date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Due Time
                  </label>
                  <input
                    type="time"
                    name="due_time"
                    defaultValue={editingTask?.due_time}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Priority
                  </label>
                  <select
                    name="priority"
                    defaultValue={editingTask?.priority || TaskPriority.MEDIUM}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
                  >
                    <option value={TaskPriority.LOW}>Low</option>
                    <option value={TaskPriority.MEDIUM}>Medium</option>
                    <option value={TaskPriority.HIGH}>High</option>
                    <option value={TaskPriority.URGENT}>Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Status
                  </label>
                  <select
                    name="status"
                    defaultValue={editingTask?.status || TaskStatus.PENDING}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
                  >
                    <option value={TaskStatus.PENDING}>Pending</option>
                    <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                    <option value={TaskStatus.COMPLETED}>Completed</option>
                    <option value={TaskStatus.DELAYED}>Delayed</option>
                  </select>
                </div>
              </div>

              {/* Recurrence Section */}
              <div className="border-t border-gray-100 pt-5">
                <div className="flex items-center gap-3 mb-4">
                  <Repeat className="w-4 h-4 text-gray-400" />
                  <select
                    value={getRecurrenceValue()}
                    onChange={(e) => handleRecurrenceChange(e.target.value)}
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                  >
                    <option value="none">Does not repeat</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly on {currentDayLong}</option>
                    <option value="monthly">Monthly on the {currentMonthDay}{
                      currentMonthDay === 1 ? 'st' : 
                      currentMonthDay === 2 ? 'nd' : 
                      currentMonthDay === 3 ? 'rd' : 'th'
                    }</option>
                    <option value="yearly">Annually on {currentMonthLong} {currentMonthDay}</option>
                    <option value="weekday">Every weekday (Monday to Friday)</option>
                    <option value="custom">Custom...</option>
                  </select>
                </div>

                {/* Recurrence Summary & Preview */}
                {isRecurring && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm">
                    <p className="text-blue-800 font-medium mb-2">
                      {getRecurrenceText(
                        recurrenceType,
                        recurrenceInterval,
                        recurrenceDays,
                        recurrenceEndType,
                        recurrenceEndDate,
                        recurrenceCount
                      )}
                    </p>
                    <div className="text-blue-600 text-xs">
                      <span className="font-semibold block mb-1">Upcoming occurrences:</span>
                      <ul className="list-disc list-inside space-y-0.5">
                        {getNextOccurrences(
                          dueDate,
                          recurrenceType,
                          recurrenceInterval,
                          recurrenceDays,
                          recurrenceEndType,
                          recurrenceEndDate,
                          recurrenceCount
                        ).map((dateStr) => (
                          <li key={dateStr}>
                            {new Date(dateStr).toLocaleDateString(undefined, { 
                              weekday: 'short', 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Custom Recurrence Modal */}
              <RecurrenceCustomModal
                isOpen={isCustomRecurrenceOpen}
                onClose={() => setIsCustomRecurrenceOpen(false)}
                onSave={(data) => {
                  setIsRecurring(true);
                  setRecurrenceInterval(data.recurrence_interval);
                  setRecurrenceType(data.recurrence_type);
                  setRecurrenceDays(data.recurrence_days);
                  setRecurrenceEndType(data.recurrence_end_type);
                  setRecurrenceEndDate(data.recurrence_end_date || '');
                  setRecurrenceCount(data.recurrence_count || 13);
                }}
                initialData={{
                  recurrence_interval: recurrenceInterval,
                  recurrence_type: recurrenceType,
                  recurrence_days: recurrenceDays,
                  recurrence_end_type: recurrenceEndType,
                  recurrence_end_date: recurrenceEndDate,
                  recurrence_count: recurrenceCount,
                }}
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Project (Optional)
                  </label>
                  <select
                    name="project_id"
                    defaultValue={editingTask?.project_id || ''}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
                  >
                    <option value="">No Project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Goal (Optional)
                  </label>
                  <select
                    name="goal_id"
                    defaultValue={editingTask?.goal_id || ''}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
                  >
                    <option value="">No Goal</option>
                    {goals.map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.title} ({goal.quarter} {goal.year})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:shadow-none"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingTask
                    ? 'Update Task'
                    : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
        title={`Delete ${selectedTaskIds.size} Task${selectedTaskIds.size !== 1 ? 's' : ''}?`}
        message={`This action cannot be undone. Are you sure you want to delete ${selectedTaskIds.size === 1 ? 'this task' : 'these tasks'}?`}
        confirmText={bulkDeleteMutation.isPending ? 'Deleting...' : 'Delete'}
        variant="danger"
      />

      {/* Bulk Status Change Dialog */}
      {showBulkStatusChange && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Change Status for {selectedTaskIds.size} Task{selectedTaskIds.size !== 1 ? 's' : ''}
            </h3>
            <div className="space-y-2 mb-6">
              <button
                onClick={() => handleBulkStatusChange(TaskStatus.PENDING)}
                disabled={bulkStatusUpdateMutation.isPending}
                className="w-full px-4 py-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <span className="font-medium">Pending</span>
              </button>
              <button
                onClick={() => handleBulkStatusChange(TaskStatus.IN_PROGRESS)}
                disabled={bulkStatusUpdateMutation.isPending}
                className="w-full px-4 py-3 text-left border border-gray-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <span className="font-medium text-slate-600">In Progress</span>
              </button>
              <button
                onClick={() => handleBulkStatusChange(TaskStatus.COMPLETED)}
                disabled={bulkStatusUpdateMutation.isPending}
                className="w-full px-4 py-3 text-left border border-gray-300 rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50"
              >
                <span className="font-medium text-emerald-600">Completed</span>
              </button>
            </div>
            <button
              onClick={() => setShowBulkStatusChange(false)}
              disabled={bulkStatusUpdateMutation.isPending}
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      </div>
      <AIChatPanel />
    </div>
  );
}
