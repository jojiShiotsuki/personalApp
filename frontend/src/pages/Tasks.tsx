import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskApi } from '@/lib/api';
import type { Task, TaskCreate, TaskUpdate } from '@/types';
import { TaskStatus, TaskPriority } from '@/types';
import TaskList from '@/components/TaskList';
import { Filter, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type FilterValue = TaskStatus | 'all' | 'today' | 'this_week' | 'this_month' | 'overdue'
  | 'week1' | 'week2' | 'week3' | 'week4' | 'week5' | 'week6' | 'week7' | 'week8'
  | 'week9' | 'week10' | 'week11' | 'week12';
type SortOption = 'dueDate' | 'priority' | 'createdDate' | 'title';

// Date helper functions
const isToday = (dateString: string | null): boolean => {
  if (!dateString) return false;
  const today = new Date();
  const taskDate = new Date(dateString);
  return taskDate.toDateString() === today.toDateString();
};

const isThisWeek = (dateString: string | null): boolean => {
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

const isThisMonth = (dateString: string | null): boolean => {
  if (!dateString) return false;
  const today = new Date();
  const taskDate = new Date(dateString);
  return taskDate.getMonth() === today.getMonth() &&
         taskDate.getFullYear() === today.getFullYear();
};

const isOverdue = (dateString: string | null): boolean => {
  if (!dateString) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const taskDate = new Date(dateString);
  taskDate.setHours(0, 0, 0, 0);
  return taskDate < today;
};

// Check if task falls within a specific week number (1-12)
// Week 1 = 0-6 days from today, Week 2 = 7-13 days, etc.
const isInWeek = (dateString: string | null, weekNumber: number): boolean => {
  if (!dateString) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const taskDate = new Date(dateString);
  taskDate.setHours(0, 0, 0, 0);

  const daysDiff = Math.floor((taskDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const weekStart = (weekNumber - 1) * 7;
  const weekEnd = weekNumber * 7;

  return daysDiff >= weekStart && daysDiff < weekEnd;
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
  const queryClient = useQueryClient();

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Note: Global Ctrl+K listener moved to App.tsx to avoid duplicate modals

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', filter],
    queryFn: () => taskApi.getAll(filter === 'all' ? undefined : filter),
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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: TaskCreate = {
      title: formData.get('title') as string,
      description: formData.get('description') as string || undefined,
      due_date: formData.get('due_date') as string || undefined,
      due_time: formData.get('due_time') as string || undefined,
      priority: (formData.get('priority') as TaskPriority) || TaskPriority.MEDIUM,
      status: (formData.get('status') as TaskStatus) || TaskStatus.PENDING,
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
    setIsModalOpen(true);
  };

  const handleNewTask = () => {
    setEditingTask(null);
    setIsModalOpen(true);
  };


  const filters: Array<{ label: string; value: FilterValue }> = [
    { label: 'All', value: 'all' },
    { label: 'Today', value: 'today' },
    { label: 'This Week', value: 'this_week' },
    { label: 'This Month', value: 'this_month' },
    { label: 'Overdue', value: 'overdue' },
    { label: 'Week 1', value: 'week1' },
    { label: 'Week 2', value: 'week2' },
    { label: 'Week 3', value: 'week3' },
    { label: 'Week 4', value: 'week4' },
    { label: 'Week 5', value: 'week5' },
    { label: 'Week 6', value: 'week6' },
    { label: 'Week 7', value: 'week7' },
    { label: 'Week 8', value: 'week8' },
    { label: 'Week 9', value: 'week9' },
    { label: 'Week 10', value: 'week10' },
    { label: 'Week 11', value: 'week11' },
    { label: 'Week 12', value: 'week12' },
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

          // Week-based filters (Week 1-12)
          if (filter === 'week1') return isInWeek(task.due_date, 1);
          if (filter === 'week2') return isInWeek(task.due_date, 2);
          if (filter === 'week3') return isInWeek(task.due_date, 3);
          if (filter === 'week4') return isInWeek(task.due_date, 4);
          if (filter === 'week5') return isInWeek(task.due_date, 5);
          if (filter === 'week6') return isInWeek(task.due_date, 6);
          if (filter === 'week7') return isInWeek(task.due_date, 7);
          if (filter === 'week8') return isInWeek(task.due_date, 8);
          if (filter === 'week9') return isInWeek(task.due_date, 9);
          if (filter === 'week10') return isInWeek(task.due_date, 10);
          if (filter === 'week11') return isInWeek(task.due_date, 11);
          if (filter === 'week12') return isInWeek(task.due_date, 12);

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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-8 py-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Tasks</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage your tasks and stay organized
            </p>
          </div>
          <button
            onClick={handleNewTask}
            className={cn(
              'group flex items-center',
              'px-4 py-2',
              'bg-blue-600 text-white',
              'rounded-lg',
              'hover:bg-blue-700',
              'transition-all duration-200',
              'shadow-sm hover:shadow'
            )}
          >
            <Plus className="w-5 h-5 mr-2 transition-transform duration-200 group-hover:rotate-90" />
            New Task
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gradient-to-r from-gray-50 to-white border-b px-8 py-4">
        <div className="flex items-start gap-2">
          <Filter className="w-4 h-4 text-gray-400 mt-2 flex-shrink-0" />
          <div className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-lg',
                  'transition-all duration-200',
                  'active:scale-95',
                  'whitespace-nowrap',
                  filter === f.value
                    ? 'bg-blue-100 text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search and Sort Toolbar */}
      <div className="bg-white border-b px-8 py-4">
        <div className="flex flex-col sm:flex-row gap-4">
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
                  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:shadow-md',
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
                'focus:outline-none focus:ring-2 focus:ring-blue-500',
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <TaskList
            tasks={filteredAndSortedTasks}
            onStatusChange={handleStatusChange}
            onTaskClick={handleTaskClick}
            onDelete={(id) => deleteMutation.mutate(id)}
            isUpdating={updateStatusMutation.isPending}
            searchQuery={searchQuery}
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={TaskStatus.PENDING}>Pending</option>
                  <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                  <option value={TaskStatus.COMPLETED}>Completed</option>
                  <option value={TaskStatus.DELAYED}>Delayed</option>
                </select>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingTask(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
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

    </div>
  );
}
