import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Trash2, Plus, Clock, Briefcase, CheckCircle2, ListTodo, LayoutGrid, FileText, ChevronDown } from 'lucide-react';
import { projectApi, taskApi, projectTemplateApi } from '@/lib/api';
import type { Project } from '@/types';
import { ProjectStatus, TaskStatus, TaskCreate, TaskPriority } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import TaskItem from '@/components/TaskItem';
import ConfirmModal from '@/components/ConfirmModal';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { format } from 'date-fns';

type Tab = 'overview' | 'list' | 'board';

const tabConfig: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: Briefcase },
  { id: 'list', label: 'List', icon: ListTodo },
  { id: 'board', label: 'Board', icon: LayoutGrid },
];

const statusConfig = {
  [ProjectStatus.TODO]: {
    label: 'To Do',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    dot: 'bg-amber-400',
  },
  [ProjectStatus.IN_PROGRESS]: {
    label: 'In Progress',
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    dot: 'bg-blue-400',
  },
  [ProjectStatus.COMPLETED]: {
    label: 'Completed',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    dot: 'bg-emerald-400',
  },
};

const inputClasses = cn(
  "w-full px-4 py-2.5 rounded-lg",
  "bg-stone-800/50 border border-stone-600/40",
  "text-[--exec-text] placeholder:text-[--exec-text-muted]",
  "focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50",
  "transition-all text-sm"
);

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id || '0');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setStatusDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { data: project, isLoading, isError } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectApi.getById(projectId),
    enabled: projectId > 0,
  });

  const updateMutation = useMutation({
    mutationFn: (data: { status: ProjectStatus }) =>
      projectApi.update(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project updated');
    },
    onError: () => {
      toast.error('Failed to update project');
    },
  });

  const saveTemplateMutation = useMutation({
    mutationFn: () => projectTemplateApi.createFromProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-templates'] });
      toast.success('Project saved as template');
    },
    onError: () => {
      toast.error('Failed to save as template');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => projectApi.delete(projectId),
    onSuccess: () => {
      toast.success('Project deleted');
      navigate('/projects');
    },
    onError: () => {
      toast.error('Failed to delete project');
    },
  });

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-[--exec-bg]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[--exec-accent] mb-4" />
          <p className="text-[--exec-text-muted]">Loading project...</p>
        </div>
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="h-full flex items-center justify-center bg-[--exec-bg]">
        <div className="text-center">
          <p className="text-[--exec-danger] mb-4">
            {isError ? 'Failed to load project' : 'Project not found'}
          </p>
          <button
            onClick={() => navigate('/projects')}
            className="text-[--exec-text-muted] hover:text-[--exec-accent] transition-colors"
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[--exec-bg] grain">
      {/* Header */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[--exec-surface] via-[--exec-surface] to-[--exec-accent-bg-subtle]" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-[--exec-accent]/5 to-transparent rounded-full blur-3xl" />

        <div className="relative px-8 pt-6 pb-0">
          {/* Back button */}
          <button
            onClick={() => navigate('/projects')}
            className="flex items-center gap-2 text-[--exec-text-muted] hover:text-[--exec-accent] mb-5 transition-colors group"
          >
            <div className="p-1 rounded-full group-hover:bg-[--exec-accent-bg] transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium">Back to Projects</span>
          </button>

          <div className="flex justify-between items-start">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[--exec-surface-alt] rounded-full mb-3">
                <Briefcase className="w-3.5 h-3.5 text-[--exec-accent]" />
                <span className="text-xs font-medium text-[--exec-text-secondary]">Project</span>
              </div>
              <h1 className="text-3xl font-bold text-[--exec-text] tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                {project.name}
              </h1>
              {project.description && (
                <p className="text-[--exec-text-secondary] mt-2 text-base max-w-2xl">{project.description}</p>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Save as Template */}
              <button
                onClick={() => saveTemplateMutation.mutate()}
                disabled={saveTemplateMutation.isPending}
                className="flex items-center gap-2 px-3.5 py-2 bg-[--exec-surface-alt] border border-[--exec-border] text-[--exec-text-secondary] rounded-xl hover:bg-[--exec-surface] hover:text-[--exec-text] hover:border-[--exec-accent]/30 transition-all duration-200 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                title="Save as Template"
              >
                <FileText className="w-3.5 h-3.5" />
                {saveTemplateMutation.isPending ? 'Saving...' : 'Save as Template'}
              </button>

              {/* Status Selector */}
              <div className="relative" ref={statusDropdownRef}>
                <button
                  onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                  className={cn(
                    'inline-flex items-center gap-2 pl-3 pr-2.5 py-2 border rounded-xl font-bold text-xs uppercase tracking-wide cursor-pointer',
                    'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 transition-all',
                    statusConfig[project.status].badge
                  )}
                >
                  <span className={cn('w-2 h-2 rounded-full', statusConfig[project.status].dot)} />
                  {statusConfig[project.status].label}
                  <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', statusDropdownOpen && 'rotate-180')} />
                </button>

                {statusDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-44 bg-stone-800 border border-stone-600/50 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                    {Object.entries(statusConfig).map(([value, config]) => (
                      <button
                        key={value}
                        onClick={() => {
                          if (value !== project.status) {
                            updateMutation.mutate({ status: value as ProjectStatus });
                          }
                          setStatusDropdownOpen(false);
                        }}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wide transition-colors',
                          value === project.status
                            ? cn(config.badge, 'border-0')
                            : 'text-stone-300 hover:bg-stone-700/50'
                        )}
                      >
                        <span className={cn('w-2 h-2 rounded-full flex-shrink-0', config.dot)} />
                        {config.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Delete Button */}
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 text-[--exec-text-muted] rounded-xl transition-all duration-200 hover:text-[--exec-danger] hover:bg-[--exec-danger]/10"
                title="Delete Project"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-6 border-b border-[--exec-border-subtle]">
            {tabConfig.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 pb-3 px-4 font-medium transition-all relative text-sm',
                    activeTab === tab.id
                      ? 'text-[--exec-accent]'
                      : 'text-[--exec-text-muted] hover:text-[--exec-text]'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[--exec-accent] rounded-t-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto px-8 py-8">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'overview' && <OverviewTab project={project} />}
          {activeTab === 'list' && <ListTab projectId={projectId} />}
          {activeTab === 'board' && <BoardTab projectId={projectId} />}
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          deleteMutation.mutate();
          setShowDeleteConfirm(false);
        }}
        title="Delete Project"
        message={`Are you sure you want to delete "${project?.name}"? This will also delete ${project?.task_count || 0} tasks. This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}

function OverviewTab({ project }: { project: Project }) {
  const getProgressColor = (progress: number) => {
    if (progress < 34) return 'text-[--exec-danger]';
    if (progress < 67) return 'text-[--exec-warning]';
    return 'text-[--exec-sage]';
  };

  const getProgressStroke = (progress: number) => {
    if (progress < 34) return 'var(--exec-danger)';
    if (progress < 67) return 'var(--exec-warning)';
    return 'var(--exec-sage)';
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Progress Circle */}
      <div className="bento-card-static p-8">
        <div className="flex flex-col items-center justify-center">
          <div className="relative inline-flex items-center justify-center mb-4">
            <svg className="w-48 h-48 transform -rotate-90">
              <circle
                stroke="var(--exec-border)"
                strokeWidth="12"
                fill="transparent"
                r="88"
                cx="96"
                cy="96"
              />
              <circle
                stroke={getProgressStroke(project.progress)}
                className="transition-all duration-1000 ease-out"
                strokeWidth="12"
                strokeDasharray={88 * 2 * Math.PI}
                strokeDashoffset={88 * 2 * Math.PI * (1 - project.progress / 100)}
                strokeLinecap="round"
                fill="transparent"
                r="88"
                cx="96"
                cy="96"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className={cn('text-5xl font-bold tracking-tight', getProgressColor(project.progress))} style={{ fontFamily: 'var(--font-display)' }}>
                {project.progress}%
              </span>
              <span className="text-sm font-medium text-[--exec-text-muted] uppercase tracking-wider mt-1">Complete</span>
            </div>
          </div>
          <p className="text-[--exec-text-secondary] text-center max-w-md">
            {project.progress === 100
              ? "All tasks completed! Great job!"
              : `${project.completed_task_count || 0} of ${project.task_count || 0} tasks completed`}
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bento-card p-5">
          <div className="text-xs font-bold text-[--exec-text-muted] mb-2 uppercase tracking-wider">Total Tasks</div>
          <div className="text-3xl font-bold text-[--exec-text]" style={{ fontFamily: 'var(--font-display)' }}>{project.task_count || 0}</div>
        </div>

        <div className="bento-card p-5">
          <div className="text-xs font-bold text-[--exec-text-muted] mb-2 uppercase tracking-wider">Completed</div>
          <div className="text-3xl font-bold text-[--exec-sage]" style={{ fontFamily: 'var(--font-display)' }}>
            {project.completed_task_count || 0}
          </div>
        </div>

        <div className="bento-card p-5">
          <div className="text-xs font-bold text-[--exec-text-muted] mb-2 uppercase tracking-wider">Remaining</div>
          <div className="text-3xl font-bold text-[--exec-info]" style={{ fontFamily: 'var(--font-display)' }}>
            {(project.task_count || 0) - (project.completed_task_count || 0)}
          </div>
        </div>

        <div className="bento-card p-5">
          <div className="text-xs font-bold text-[--exec-text-muted] mb-2 uppercase tracking-wider">Status</div>
          <span className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide border',
            statusConfig[project.status].badge
          )}>
            <span className={cn('w-2 h-2 rounded-full', statusConfig[project.status].dot)} />
            {statusConfig[project.status].label}
          </span>
        </div>
      </div>

      {/* Completion Celebration */}
      {project.progress === 100 && (
        <div className="bento-card-static bg-[--exec-success-bg] border-[--exec-success]/20 p-8 text-center animate-in zoom-in duration-500">
          <div className="w-16 h-16 bg-[--exec-success]/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-[--exec-success]" />
          </div>
          <h3 className="text-xl font-bold text-[--exec-text] mb-2" style={{ fontFamily: 'var(--font-display)' }}>Project Completed!</h3>
          <p className="text-[--exec-text-secondary]">You've finished all tasks in this project.</p>
        </div>
      )}
    </div>
  );
}

function ListTab({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient();
  const [showAddTask, setShowAddTask] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['projects', projectId, 'tasks'],
    queryFn: () => projectApi.getTasks(projectId),
  });

  const createTaskMutation = useMutation({
    mutationFn: (data: TaskCreate) => projectApi.createTask(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
      setShowAddTask(false);
      toast.success('Task created successfully');
    },
    onError: () => {
      toast.error('Failed to create task');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: number; status: TaskStatus }) =>
      taskApi.update(taskId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
      toast.success('Task status updated');
    },
    onError: () => {
      toast.error('Failed to update task status');
    },
  });

  const handleStatusChange = (taskId: number, status: TaskStatus) => {
    updateStatusMutation.mutate({ taskId, status });
  };

  const filteredTasks = tasks.filter((task) => {
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
    return true;
  });

  const selectClasses = cn(
    "px-4 py-2 rounded-lg text-sm font-medium cursor-pointer appearance-none",
    "bg-[--exec-surface] border border-[--exec-border-subtle]",
    "text-[--exec-text-secondary]",
    "focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50",
    "transition-all"
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div className="flex gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={selectClasses}
          >
            <option value="all">All Status</option>
            <option value={TaskStatus.PENDING}>Pending</option>
            <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
            <option value={TaskStatus.COMPLETED}>Completed</option>
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className={selectClasses}
          >
            <option value="all">All Priority</option>
            <option value={TaskPriority.HIGH}>High</option>
            <option value={TaskPriority.MEDIUM}>Medium</option>
            <option value={TaskPriority.LOW}>Low</option>
          </select>
        </div>
        <button
          onClick={() => setShowAddTask(true)}
          className="group flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[--exec-accent] to-[--exec-accent-dark] text-white rounded-xl hover:shadow-lg hover:shadow-[--exec-accent]/25 hover:-translate-y-0.5 transition-all duration-200 font-semibold text-sm"
        >
          <Plus className="w-4 h-4 transition-transform duration-200 group-hover:rotate-90" />
          Add Task
        </button>
      </div>

      {showAddTask && (
        <div className="bento-card-static p-6 animate-in slide-in-from-top-2 duration-300">
          <h3 className="text-lg font-bold text-[--exec-text] mb-4" style={{ fontFamily: 'var(--font-display)' }}>New Task</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              createTaskMutation.mutate({
                title: formData.get('title') as string,
                description: formData.get('description') as string,
                priority: (formData.get('priority') as TaskPriority) || TaskPriority.MEDIUM,
                status: TaskStatus.PENDING,
                project_id: projectId,
              });
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Title
              </label>
              <input
                name="title"
                required
                className={inputClasses}
                placeholder="What needs to be done?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Description
              </label>
              <textarea
                name="description"
                rows={3}
                className={cn(inputClasses, 'resize-none')}
                placeholder="Add details..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Priority
              </label>
              <select name="priority" className={inputClasses}>
                <option value={TaskPriority.LOW}>Low</option>
                <option value={TaskPriority.MEDIUM}>Medium</option>
                <option value={TaskPriority.HIGH}>High</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-stone-700/30">
              <button
                type="button"
                onClick={() => setShowAddTask(false)}
                className="px-4 py-2 text-sm font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createTaskMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-[--exec-accent] rounded-lg hover:bg-[--exec-accent-dark] shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createTaskMutation.isPending ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[--exec-accent] mb-4" />
            <p className="text-[--exec-text-muted]">Loading tasks...</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="bento-card-static p-12 text-center border-dashed">
            <ListTodo className="w-10 h-10 text-[--exec-text-muted] mx-auto mb-3" />
            <p className="text-[--exec-text-secondary] font-medium">No tasks found</p>
            <p className="text-sm text-[--exec-text-muted] mt-1">
              {tasks.length === 0
                ? "Get started by adding a task to this project"
                : "Try adjusting your filters"}
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onStatusChange={handleStatusChange}
              onClick={() => {}}
            />
          ))
        )}
      </div>
    </div>
  );
}

function BoardTab({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient();
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['projects', projectId, 'tasks'],
    queryFn: () => projectApi.getTasks(projectId),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: number; status: TaskStatus }) =>
      taskApi.update(taskId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
    },
  });

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { draggableId, destination } = result;
    const newStatus = destination.droppableId as TaskStatus;
    const taskId = parseInt(draggableId);

    updateStatusMutation.mutate({ taskId, status: newStatus });
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[--exec-accent] mb-4" />
        <p className="text-[--exec-text-muted]">Loading board...</p>
      </div>
    );
  }

  const columns = [
    { id: TaskStatus.PENDING, title: 'To Do', bg: 'bg-[--exec-surface-alt]' },
    { id: TaskStatus.IN_PROGRESS, title: 'In Progress', bg: 'bg-[--exec-info-bg]' },
    { id: TaskStatus.COMPLETED, title: 'Completed', bg: 'bg-[--exec-success-bg]' },
  ];

  const priorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.HIGH:
      case TaskPriority.URGENT:
        return 'bg-[--exec-danger]/10 text-[--exec-danger]';
      case TaskPriority.MEDIUM:
        return 'bg-[--exec-warning]/10 text-[--exec-warning]';
      default:
        return 'bg-[--exec-info]/10 text-[--exec-info]';
    }
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full min-h-[500px]">
        {columns.map((column) => (
          <div key={column.id} className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-4 px-1">
              <h3 className="font-bold text-[--exec-text]">{column.title}</h3>
              <span className="bg-[--exec-surface-alt] text-[--exec-text-muted] px-2.5 py-0.5 rounded-full text-xs font-bold">
                {tasks.filter((t) => t.status === column.id).length}
              </span>
            </div>
            <Droppable droppableId={column.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    'flex-1 rounded-2xl p-4 transition-all border border-transparent',
                    column.bg,
                    snapshot.isDraggingOver && 'ring-2 ring-[--exec-accent]/30 bg-[--exec-surface]'
                  )}
                >
                  <div className="space-y-3">
                    {tasks
                      .filter((task) => task.status === column.id)
                      .map((task, index) => (
                        <Draggable
                          key={task.id}
                          draggableId={task.id.toString()}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={cn(
                                'bento-card p-4 group',
                                snapshot.isDragging && 'shadow-lg rotate-2 scale-105 z-50'
                              )}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <span
                                  className={cn(
                                    'text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide',
                                    priorityBadge(task.priority)
                                  )}
                                >
                                  {task.priority}
                                </span>
                              </div>
                              <h4 className="font-medium text-[--exec-text] mb-1 group-hover:text-[--exec-accent] transition-colors">
                                {task.title}
                              </h4>
                              {task.description && (
                                <p className="text-sm text-[--exec-text-muted] line-clamp-2 mb-3">
                                  {task.description}
                                </p>
                              )}
                              {task.due_date && (
                                <div className="flex items-center text-xs text-[--exec-text-muted] mt-2 pt-2 border-t border-[--exec-border-subtle]">
                                  <Clock className="w-3 h-3 mr-1" />
                                  {format(new Date(task.due_date), 'MMM d')}
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}
