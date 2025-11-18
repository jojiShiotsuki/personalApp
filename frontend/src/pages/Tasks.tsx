import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskApi, goalApi } from '@/lib/api';
import type { Task, TaskCreate, TaskUpdate } from '@/types';
import { TaskStatus, TaskPriority, RecurrenceType } from '@/types';
import TaskList from '@/components/TaskList';
import AIChatPanel from '@/components/AIChatPanel';
import { Filter, Plus, X, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';

type FilterValue = TaskStatus | 'all' | 'today' | 'this_week' | 'this_month' | 'overdue';
type SortOption = 'dueDate' | 'priority' | 'createdDate' | 'title';

// Date helper functions
const isToday = (dateString?: string | null): boolean => {
  if (!dateString) return false;
  const today = new Date();
  const taskDate = new Date(dateString);
  return taskDate.toDateString() === today.toDateString();
};

const isThisWeek = (dateString?: string | null): boolean => {
  if (!dateString) return false;
  const today = new Date();
  const taskDate = new Date(dateString);
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  return taskDate >= weekStart && taskDate < weekEnd;
};

const isThisMonth = (dateString?: string | null): boolean => {
  if (!dateString) return false;
  const today = new Date();
  const taskDate = new Date(dateString);
  return taskDate.getMonth() === today.getMonth() &&
         taskDate.getFullYear() === today.getFullYear();
};

const isOverdue = (dateString?: string | null): boolean => {
  if (!dateString) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const taskDate = new Date(dateString);
  taskDate.setHours(0, 0, 0, 0);
  return taskDate < today;
};

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
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceEndType, setRecurrenceEndType] = useState<'never' | 'date' | 'count'>('never');
  const queryClient = useQueryClient();

  const handleDataChange = () => {
    // Refetch tasks when AI makes changes
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  };

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

  const createMutation = useMutation({
    mutationFn: (task: TaskCreate) => taskApi.create(task),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsModalOpen(false);
      setEditingTask(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: TaskUpdate }) =>
      taskApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsModalOpen(false);
      setEditingTask(null);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: TaskStatus }) =>
      taskApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error) => {
      console.error('Failed to update task status:', error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => taskApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => taskApi.bulkDelete(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setSelectedTaskIds(new Set());
      setShowDeleteConfirm(false);
      setIsEditMode(false);
    },
  });

  const bulkStatusUpdateMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: number[]; status: TaskStatus }) => {
      await Promise.all(ids.map(id => taskApi.updateStatus(id, status)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setSelectedTaskIds(new Set());
      setShowBulkStatusChange(false);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const goalIdValue = formData.get('goal_id') as string;

    // DIAGNOSTIC: Log state variables
    console.log("=== FRONTEND SUBMIT DIAGNOSTIC ===");
    console.log("isRecurring state:", isRecurring);
    console.log("recurrenceEndType state:", recurrenceEndType);
    console.log("FormData recurrence_type:", formData.get('recurrence_type'));
    console.log("FormData recurrence_interval:", formData.get('recurrence_interval'));
    console.log("FormData recurrence_end_date:", formData.get('recurrence_end_date'));
    console.log("FormData recurrence_count:", formData.get('recurrence_count'));

    const data: TaskCreate = {
      title: formData.get('title') as string,
      description: formData.get('description') as string || undefined,
      due_date: formData.get('due_date') as string || undefined,
      due_time: formData.get('due_time') as string || undefined,
      priority: (formData.get('priority') as TaskPriority) || TaskPriority.MEDIUM,
      status: (formData.get('status') as TaskStatus) || TaskStatus.PENDING,
      goal_id: goalIdValue ? parseInt(goalIdValue, 10) : undefined,
      // Recurrence fields
      is_recurring: isRecurring,
      recurrence_type: isRecurring ? (formData.get('recurrence_type') as RecurrenceType) : undefined,
      recurrence_interval: isRecurring ? parseInt(formData.get('recurrence_interval') as string, 10) || 1 : undefined,
      recurrence_end_date: isRecurring && recurrenceEndType === 'date' ? (formData.get('recurrence_end_date') as string || undefined) : undefined,
      recurrence_count: isRecurring && recurrenceEndType === 'count' ? parseInt(formData.get('recurrence_count') as string, 10) || undefined : undefined,
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
    setIsRecurring(task.is_recurring);
    // Determine recurrence end type based on task data
    if (task.recurrence_end_date) {
      setRecurrenceEndType('date');
    } else if (task.recurrence_count) {
      setRecurrenceEndType('count');
    } else {
      setRecurrenceEndType('never');
    }
    setIsModalOpen(true);
  };

  const handleNewTask = () => {
    setEditingTask(null);
    setIsRecurring(false);
    setRecurrenceEndType('never');
    setIsModalOpen(true);
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
      if (filterValue === 'today') return isToday(task.due_date);
      if (filterValue === 'this_week') return isThisWeek(task.due_date);
      if (filterValue === 'this_month') return isThisMonth(task.due_date);
      if (filterValue === 'overdue') return isOverdue(task.due_date) && task.status !== TaskStatus.COMPLETED;

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
          if (filter === 'today') return isToday(task.due_date);
          if (filter === 'this_week') return isThisWeek(task.due_date);
          if (filter === 'this_month') return isThisMonth(task.due_date);
          if (filter === 'overdue') return isOverdue(task.due_date) && task.status !== TaskStatus.COMPLETED;

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

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-8 py-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Tasks</h1>
            <p className="mt-1 text-sm text-gray-500">
              {selectedTaskIds.size > 0
                ? `${selectedTaskIds.size} task(s) selected`
                : 'Manage your tasks and stay organized'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Bulk action buttons (show when tasks are selected in edit mode) */}
            {isEditMode && selectedTaskIds.size > 0 && (
              <>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={bulkDeleteMutation.isPending}
                  className={cn(
                    'flex items-center',
                    'px-4 py-2',
                    'bg-red-600 text-white',
                    'rounded-lg',
                    'hover:bg-red-700',
                    'transition-all duration-200',
                    'shadow-sm hover:shadow',
                    'disabled:opacity-50'
                  )}
                >
                  <X className="w-5 h-5 mr-2" />
                  Delete {selectedTaskIds.size}
                </button>

                <button
                  onClick={() => setShowBulkStatusChange(true)}
                  disabled={bulkStatusUpdateMutation.isPending}
                  className={cn(
                    'flex items-center',
                    'px-4 py-2',
                    'bg-green-600 text-white',
                    'rounded-lg',
                    'hover:bg-green-700',
                    'transition-all duration-200',
                    'shadow-sm hover:shadow',
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
                'rounded-lg',
                'transition-all duration-200',
                'shadow-sm hover:shadow',
                isEditMode
                  ? 'bg-gray-600 text-white hover:bg-gray-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                  'bg-slate-600 text-white',
                  'rounded-lg',
                  'hover:bg-slate-700',
                  'transition-all duration-200',
                  'shadow-sm hover:shadow'
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
      <div className="bg-gray-50 border-b px-8 py-4">
        <div className="flex items-start gap-2">
          <Filter className="w-4 h-4 text-gray-400 mt-2 flex-shrink-0" />
          <div className="flex flex-wrap gap-2">
            {filters.map((f) => {
              const count = getFilterCount(f.value);
              return (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    'px-4 py-2 text-sm font-medium rounded-lg',
                    'transition-all duration-200',
                    'whitespace-nowrap',
                    filter === f.value
                      ? 'bg-slate-100 text-slate-700 shadow-sm border border-slate-200'
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                >
                  {f.label} <span className="text-xs opacity-70">({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Search and Sort Toolbar */}
      <div className="bg-white border-b px-8 py-4">
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
              <label className="ml-2 text-sm text-gray-700">Select All</label>
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
                  'w-full px-4 py-2 pl-10',
                  'border border-gray-300 rounded-lg',
                  'shadow-sm',
                  'focus:outline-none focus:ring-2 focus:ring-slate-500 focus:shadow-md',
                  'transition-all duration-200'
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
                'w-full px-4 py-2',
                'border border-gray-300 rounded-lg',
                'shadow-sm',
                'focus:outline-none focus:ring-2 focus:ring-slate-500',
                'transition-all duration-200',
                'cursor-pointer'
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

      {/* Task List */}
      <div className="flex-1 overflow-auto px-8 py-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600"></div>
          </div>
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-xl font-bold text-gray-900">
                {editingTask ? 'Edit Task' : 'New Task'}
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingTask(null);
                  setIsRecurring(false);
                  setRecurrenceEndType('never');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  name="title"
                  defaultValue={editingTask?.title}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  defaultValue={editingTask?.description}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    name="due_date"
                    defaultValue={editingTask?.due_date}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Due Time
                  </label>
                  <input
                    type="time"
                    name="due_time"
                    defaultValue={editingTask?.due_time}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  name="priority"
                  defaultValue={editingTask?.priority || TaskPriority.MEDIUM}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                >
                  <option value={TaskPriority.LOW}>Low</option>
                  <option value={TaskPriority.MEDIUM}>Medium</option>
                  <option value={TaskPriority.HIGH}>High</option>
                  <option value={TaskPriority.URGENT}>Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  name="status"
                  defaultValue={editingTask?.status || TaskStatus.PENDING}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                >
                  <option value={TaskStatus.PENDING}>Pending</option>
                  <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                  <option value={TaskStatus.COMPLETED}>Completed</option>
                  <option value={TaskStatus.DELAYED}>Delayed</option>
                </select>
              </div>

              {/* Recurrence Section */}
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    id="is_recurring"
                    checked={isRecurring}
                    onChange={(e) => {
                      setIsRecurring(e.target.checked);
                      if (!e.target.checked) {
                        setRecurrenceEndType('never');
                      }
                    }}
                    className="w-4 h-4 text-slate-600 border-gray-300 rounded focus:ring-slate-500"
                  />
                  <label htmlFor="is_recurring" className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Repeat className="w-4 h-4" />
                    Repeat this task
                  </label>
                </div>

                {isRecurring && (
                  <div className="ml-6 space-y-3 p-3 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Repeat every
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            name="recurrence_interval"
                            min="1"
                            defaultValue={editingTask?.recurrence_interval || 1}
                            className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <select
                            name="recurrence_type"
                            defaultValue={editingTask?.recurrence_type || RecurrenceType.DAILY}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value={RecurrenceType.DAILY}>Day(s)</option>
                            <option value={RecurrenceType.WEEKLY}>Week(s)</option>
                            <option value={RecurrenceType.MONTHLY}>Month(s)</option>
                            <option value={RecurrenceType.YEARLY}>Year(s)</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Ends
                        </label>
                        <select
                          value={recurrenceEndType}
                          onChange={(e) => setRecurrenceEndType(e.target.value as 'never' | 'date' | 'count')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                        >
                          <option value="never">Never</option>
                          <option value="date">On date</option>
                          <option value="count">After occurrences</option>
                        </select>
                      </div>
                    </div>

                    {recurrenceEndType === 'date' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          End date
                        </label>
                        <input
                          type="date"
                          name="recurrence_end_date"
                          defaultValue={editingTask?.recurrence_end_date}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                        />
                      </div>
                    )}

                    {recurrenceEndType === 'count' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Number of occurrences
                        </label>
                        <input
                          type="number"
                          name="recurrence_count"
                          min="1"
                          defaultValue={editingTask?.recurrence_count}
                          placeholder="e.g., 10"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Link to Goal (Optional)
                </label>
                <select
                  name="goal_id"
                  defaultValue={editingTask?.goal_id || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                >
                  <option value="">No Goal</option>
                  {goals.map((goal) => (
                    <option key={goal.id} value={goal.id}>
                      {goal.title} ({goal.quarter} {goal.year})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingTask(null);
                    setIsRecurring(false);
                    setRecurrenceEndType('never');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingTask
                    ? 'Update'
                    : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Delete {selectedTaskIds.size} Task{selectedTaskIds.size !== 1 ? 's' : ''}?
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              This action cannot be undone. Are you sure you want to delete {selectedTaskIds.size === 1 ? 'this task' : 'these tasks'}?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={bulkDeleteMutation.isPending}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleteMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {bulkDeleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

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

      <AIChatPanel
        page="tasks"
        context={{ status: filter, priority: undefined }}
        onDataChange={handleDataChange}
      />
    </div>
  );
}
