import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Trash2, Plus, Clock, Briefcase, CheckCircle2, ListTodo, LayoutGrid, FileText, ChevronDown, ChevronRight, Square, CheckSquare, MinusSquare, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
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
  [ProjectStatus.RETAINER]: {
    label: 'Retainer',
    badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    dot: 'bg-purple-400',
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
      <header className="relative overflow-visible">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[--exec-surface] via-[--exec-surface] to-[--exec-accent-bg-subtle]" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-[--exec-accent]/5 to-transparent rounded-full blur-3xl" />
        </div>

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
                className="flex items-center gap-2 px-3.5 py-2 bg-[--exec-surface-alt] border border-[--exec-border] text-[--exec-text-secondary] rounded-xl hover:bg-stone-600/40 hover:text-[--exec-text] hover:border-[--exec-accent]/40 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 transition-all duration-200 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <div className="absolute right-0 top-full mt-2 w-48 bg-stone-800 border border-stone-600/50 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150">
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
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 py-2.5 px-5 font-semibold transition-all relative text-sm rounded-t-xl',
                    isActive
                      ? 'text-[--exec-accent] bg-stone-700/50'
                      : 'text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-stone-700/30 active:bg-stone-700/50'
                  )}
                >
                  <Icon className={cn('w-4 h-4', isActive && 'text-[--exec-accent]')} />
                  {tab.label}
                  {isActive && (
                    <div className="absolute bottom-0 left-2 right-2 h-[3px] bg-[--exec-accent] rounded-t-full" />
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

function FilterDropdown({ value, onChange, options, label }: {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string; dot?: string }[];
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'inline-flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-medium cursor-pointer',
          'transition-all duration-200 hover:bg-stone-600/30 hover:border-[--exec-accent]/30',
          'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20',
          value !== 'all'
            ? 'bg-stone-700/40 border-[--exec-accent]/30 text-[--exec-text]'
            : 'bg-[--exec-surface] border-[--exec-border-subtle] text-[--exec-text-secondary]'
        )}
      >
        {selected?.dot && <span className={cn('w-2 h-2 rounded-full', selected.dot)} />}
        {selected?.label || label}
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-2 w-48 bg-stone-800 border border-stone-600/50 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={cn(
                'w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors',
                opt.value === value
                  ? 'bg-stone-700/50 text-[--exec-text]'
                  : 'text-stone-300 hover:bg-stone-700/30'
              )}
            >
              {opt.dot && <span className={cn('w-2 h-2 rounded-full', opt.dot)} />}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const statusFilterOptions = [
  { value: 'all', label: 'All Status' },
  { value: TaskStatus.PENDING, label: 'Pending', dot: 'bg-stone-400' },
  { value: TaskStatus.IN_PROGRESS, label: 'In Progress', dot: 'bg-blue-400' },
  { value: TaskStatus.COMPLETED, label: 'Completed', dot: 'bg-emerald-400' },
];

const priorityFilterOptions = [
  { value: 'all', label: 'All Priority' },
  { value: TaskPriority.URGENT, label: 'Urgent', dot: 'bg-red-400' },
  { value: TaskPriority.HIGH, label: 'High', dot: 'bg-orange-400' },
  { value: TaskPriority.MEDIUM, label: 'Medium', dot: 'bg-blue-400' },
  { value: TaskPriority.LOW, label: 'Low', dot: 'bg-stone-400' },
];

function ListTab({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient();
  const [showAddTask, setShowAddTask] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterPhase, setFilterPhase] = useState<string>('all');
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const templateMenuRef = useRef<HTMLDivElement>(null);
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
  const [showBulkStatus, setShowBulkStatus] = useState(false);
  const [showBulkPriority, setShowBulkPriority] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const bulkStatusRef = useRef<HTMLDivElement>(null);
  const bulkPriorityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (templateMenuRef.current && !templateMenuRef.current.contains(e.target as Node)) {
        setShowTemplateMenu(false);
      }
      if (bulkStatusRef.current && !bulkStatusRef.current.contains(e.target as Node)) {
        setShowBulkStatus(false);
      }
      if (bulkPriorityRef.current && !bulkPriorityRef.current.contains(e.target as Node)) {
        setShowBulkPriority(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['projects', projectId, 'tasks'],
    queryFn: () => projectApi.getTasks(projectId),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['project-templates'],
    queryFn: projectTemplateApi.getAll,
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

  const applyTemplateMutation = useMutation({
    mutationFn: (templateId: number) => projectApi.applyTemplate(projectId, templateId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
      setShowTemplateMenu(false);
      toast.success(`Added ${data.tasks_added} tasks from template`);
    },
    onError: () => {
      toast.error('Failed to apply template');
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

  const bulkUpdateMutation = useMutation({
    mutationFn: ({ ids, updates }: { ids: number[]; updates: Record<string, string | null> }) =>
      taskApi.bulkUpdate(ids, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
      setSelectedTasks(new Set());
      toast.success(`Updated ${data.updated_count} task(s)`);
    },
    onError: () => {
      toast.error('Failed to update tasks');
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => taskApi.bulkDelete(ids),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
      setSelectedTasks(new Set());
      setShowBulkDeleteConfirm(false);
      toast.success(`Deleted ${data.deleted_count} task(s)`);
    },
    onError: () => {
      toast.error('Failed to delete tasks');
    },
  });

  const handleStatusChange = (taskId: number, status: TaskStatus) => {
    updateStatusMutation.mutate({ taskId, status });
  };

  const filteredTasks = tasks.filter((task) => {
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
    if (filterPhase !== 'all') {
      const taskPhase = task.phase || 'Ungrouped';
      if (filterPhase !== taskPhase) return false;
    }
    return true;
  });

  // Group tasks by phase
  const phases = new Set(tasks.map(t => t.phase).filter(Boolean) as string[]);
  const hasPhases = phases.size > 0;
  const groupedTasks: { phase: string; tasks: typeof filteredTasks }[] = [];

  if (hasPhases) {
    const phaseMap = new Map<string, typeof filteredTasks>();
    filteredTasks.forEach(task => {
      const phase = task.phase || 'Ungrouped';
      if (!phaseMap.has(phase)) phaseMap.set(phase, []);
      phaseMap.get(phase)!.push(task);
    });
    // Preserve phase order from tasks (order they appear)
    const seenPhases = new Set<string>();
    tasks.forEach(task => {
      const phase = task.phase || 'Ungrouped';
      if (!seenPhases.has(phase) && phaseMap.has(phase)) {
        seenPhases.add(phase);
        groupedTasks.push({ phase, tasks: phaseMap.get(phase)! });
      }
    });
  } else {
    groupedTasks.push({ phase: '', tasks: filteredTasks });
  }

  const phaseFilterOptions = [
    { value: 'all', label: 'All Phases' },
    ...Array.from(phases).map(p => ({ value: p, label: p })),
    ...(tasks.some(t => !t.phase) && phases.size > 0 ? [{ value: 'Ungrouped', label: 'Ungrouped' }] : []),
  ];

  const togglePhase = (phase: string) => {
    setCollapsedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase);
      else next.add(phase);
      return next;
    });
  };

  const allPhaseNames = groupedTasks.map(g => g.phase).filter(Boolean);
  const allCollapsed = allPhaseNames.length > 0 && allPhaseNames.every(p => collapsedPhases.has(p));

  const collapseAll = () => {
    setCollapsedPhases(new Set(allPhaseNames));
  };

  const expandAll = () => {
    setCollapsedPhases(new Set());
  };

  const toggleTask = (taskId: number) => {
    setSelectedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedTasks.size === filteredTasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(filteredTasks.map(t => t.id)));
    }
  };

  const togglePhaseSelection = (phaseTasks: typeof filteredTasks) => {
    const phaseIds = phaseTasks.map(t => t.id);
    const allSelected = phaseIds.every(id => selectedTasks.has(id));
    setSelectedTasks(prev => {
      const next = new Set(prev);
      if (allSelected) {
        phaseIds.forEach(id => next.delete(id));
      } else {
        phaseIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div className="flex gap-3 items-center">
          <FilterDropdown
            value={filterStatus}
            onChange={setFilterStatus}
            options={statusFilterOptions}
            label="All Status"
          />
          <FilterDropdown
            value={filterPriority}
            onChange={setFilterPriority}
            options={priorityFilterOptions}
            label="All Priority"
          />
          {hasPhases && (
            <>
              <FilterDropdown
                value={filterPhase}
                onChange={setFilterPhase}
                options={phaseFilterOptions}
                label="All Phases"
              />
              <button
                onClick={allCollapsed ? expandAll : collapseAll}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-stone-700/30 rounded-lg transition-colors"
                title={allCollapsed ? 'Expand all phases' : 'Collapse all phases'}
              >
                {allCollapsed ? (
                  <ChevronsUpDown className="w-4 h-4" />
                ) : (
                  <ChevronsDownUp className="w-4 h-4" />
                )}
                {allCollapsed ? 'Expand All' : 'Collapse All'}
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {templates.length > 0 && (
            <div className="relative" ref={templateMenuRef}>
              <button
                onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                className="flex items-center gap-2 px-4 py-2 bg-[--exec-surface-alt] border border-[--exec-border] text-[--exec-text-secondary] rounded-xl hover:bg-stone-600/40 hover:text-[--exec-text] hover:border-[--exec-accent]/40 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 transition-all duration-200 font-medium text-sm"
              >
                <FileText className="w-4 h-4" />
                Add from Template
              </button>
              {showTemplateMenu && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-stone-800 border border-stone-600/50 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-4 py-2.5 border-b border-stone-700/50">
                    <p className="text-xs font-bold text-[--exec-text-muted] uppercase tracking-wide">Choose a template</p>
                  </div>
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => applyTemplateMutation.mutate(template.id)}
                      disabled={applyTemplateMutation.isPending}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-stone-700/50 disabled:opacity-50"
                    >
                      <FileText className="w-4 h-4 text-[--exec-accent] mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[--exec-text] truncate">{template.name}</p>
                        <p className="text-xs text-[--exec-text-muted]">{template.tasks.length} tasks</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => setShowAddTask(true)}
            className="group flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[--exec-accent] to-[--exec-accent-dark] text-white rounded-xl hover:shadow-lg hover:shadow-[--exec-accent]/25 hover:-translate-y-0.5 transition-all duration-200 font-semibold text-sm"
          >
            <Plus className="w-4 h-4 transition-transform duration-200 group-hover:rotate-90" />
            Add Task
          </button>
        </div>
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
                phase: (formData.get('phase') as string)?.trim() || undefined,
                status: TaskStatus.PENDING,
                project_id: projectId,
              });
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  name="title"
                  required
                  className={inputClasses}
                  placeholder="What needs to be done?"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                    Phase
                  </label>
                  <input
                    name="phase"
                    className={inputClasses}
                    placeholder="e.g., Discovery"
                    list="phase-suggestions"
                  />
                  {hasPhases && (
                    <datalist id="phase-suggestions">
                      {Array.from(phases).map(p => (
                        <option key={p} value={p} />
                      ))}
                    </datalist>
                  )}
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
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Description
              </label>
              <textarea
                name="description"
                rows={2}
                className={cn(inputClasses, 'resize-none')}
                placeholder="Add details..."
              />
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

      {/* Select All header */}
      {filteredTasks.length > 0 && (
        <div className="flex items-center gap-3 px-2">
          <button
            onClick={toggleAll}
            className="text-[--exec-text-muted] hover:text-[--exec-accent] transition-colors"
            title={selectedTasks.size === filteredTasks.length ? 'Deselect all' : 'Select all'}
          >
            {selectedTasks.size === 0 ? (
              <Square className="w-4.5 h-4.5" />
            ) : selectedTasks.size === filteredTasks.length ? (
              <CheckSquare className="w-4.5 h-4.5 text-[--exec-accent]" />
            ) : (
              <MinusSquare className="w-4.5 h-4.5 text-[--exec-accent]" />
            )}
          </button>
          <span className="text-xs font-medium text-[--exec-text-muted]">
            {selectedTasks.size > 0
              ? `${selectedTasks.size} selected`
              : `${filteredTasks.length} task${filteredTasks.length !== 1 ? 's' : ''}`}
          </span>
        </div>
      )}

      <div className="space-y-2">
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
          groupedTasks.map(({ phase, tasks: phaseTasks }) => {
            if (phaseTasks.length === 0) return null;
            const isCollapsed = collapsedPhases.has(phase);
            const phaseCompleted = phaseTasks.filter(t => t.status === TaskStatus.COMPLETED).length;
            const phaseIds = phaseTasks.map(t => t.id);
            const allPhaseSelected = phaseIds.every(id => selectedTasks.has(id));
            const somePhaseSelected = phaseIds.some(id => selectedTasks.has(id));

            return (
              <div key={phase || '_flat'}>
                {hasPhases && phase && (
                  <div className="flex items-center gap-2 py-2.5 px-2 mb-1 mt-3 first:mt-0">
                    <button
                      onClick={() => togglePhaseSelection(phaseTasks)}
                      className="text-[--exec-text-muted] hover:text-[--exec-accent] transition-colors"
                    >
                      {allPhaseSelected ? (
                        <CheckSquare className="w-4 h-4 text-[--exec-accent]" />
                      ) : somePhaseSelected ? (
                        <MinusSquare className="w-4 h-4 text-[--exec-accent]" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => togglePhase(phase)}
                      className="flex items-center gap-2 flex-1 group"
                    >
                      <ChevronRight className={cn(
                        'w-4 h-4 text-[--exec-text-muted] transition-transform duration-200',
                        !isCollapsed && 'rotate-90'
                      )} />
                      <span className="text-xs font-bold uppercase tracking-wider text-[--exec-accent]">
                        {phase}
                      </span>
                      <span className="text-[10px] font-medium text-[--exec-text-muted] bg-stone-700/40 px-2 py-0.5 rounded-full">
                        {phaseCompleted}/{phaseTasks.length}
                      </span>
                      <div className="flex-1 h-px bg-stone-700/30 ml-2" />
                    </button>
                  </div>
                )}
                {!isCollapsed && (
                  <div className="space-y-2">
                    {phaseTasks.map((task) => (
                      <div key={task.id} className="flex items-center gap-2">
                        <button
                          onClick={() => toggleTask(task.id)}
                          className="text-[--exec-text-muted] hover:text-[--exec-accent] transition-colors flex-shrink-0 ml-2"
                        >
                          {selectedTasks.has(task.id) ? (
                            <CheckSquare className="w-4 h-4 text-[--exec-accent]" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <TaskItem
                            task={task}
                            onStatusChange={handleStatusChange}
                            onClick={() => {}}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Bulk Action Bar */}
      {selectedTasks.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3 px-5 py-3 bg-stone-800 border border-stone-600/50 rounded-2xl shadow-2xl shadow-black/40">
            <span className="text-sm font-bold text-[--exec-text] mr-2">
              {selectedTasks.size} selected
            </span>

            <div className="w-px h-6 bg-stone-600/50" />

            {/* Bulk Status */}
            <div className="relative" ref={bulkStatusRef}>
              <button
                onClick={() => { setShowBulkStatus(!showBulkStatus); setShowBulkPriority(false); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[--exec-text-secondary] hover:text-[--exec-text] hover:bg-stone-700/50 rounded-lg transition-colors"
              >
                Status
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {showBulkStatus && (
                <div className="absolute bottom-full mb-2 left-0 w-44 bg-stone-800 border border-stone-600/50 rounded-xl shadow-xl overflow-hidden z-50">
                  {[
                    { value: TaskStatus.PENDING, label: 'Pending', dot: 'bg-stone-400' },
                    { value: TaskStatus.IN_PROGRESS, label: 'In Progress', dot: 'bg-blue-400' },
                    { value: TaskStatus.COMPLETED, label: 'Completed', dot: 'bg-emerald-400' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        bulkUpdateMutation.mutate({
                          ids: Array.from(selectedTasks),
                          updates: { status: opt.value },
                        });
                        setShowBulkStatus(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-stone-300 hover:bg-stone-700/50 transition-colors"
                    >
                      <span className={cn('w-2 h-2 rounded-full', opt.dot)} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Bulk Priority */}
            <div className="relative" ref={bulkPriorityRef}>
              <button
                onClick={() => { setShowBulkPriority(!showBulkPriority); setShowBulkStatus(false); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[--exec-text-secondary] hover:text-[--exec-text] hover:bg-stone-700/50 rounded-lg transition-colors"
              >
                Priority
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {showBulkPriority && (
                <div className="absolute bottom-full mb-2 left-0 w-44 bg-stone-800 border border-stone-600/50 rounded-xl shadow-xl overflow-hidden z-50">
                  {[
                    { value: TaskPriority.LOW, label: 'Low', dot: 'bg-stone-400' },
                    { value: TaskPriority.MEDIUM, label: 'Medium', dot: 'bg-blue-400' },
                    { value: TaskPriority.HIGH, label: 'High', dot: 'bg-orange-400' },
                    { value: TaskPriority.URGENT, label: 'Urgent', dot: 'bg-red-400' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        bulkUpdateMutation.mutate({
                          ids: Array.from(selectedTasks),
                          updates: { priority: opt.value },
                        });
                        setShowBulkPriority(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-stone-300 hover:bg-stone-700/50 transition-colors"
                    >
                      <span className={cn('w-2 h-2 rounded-full', opt.dot)} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="w-px h-6 bg-stone-600/50" />

            {/* Bulk Delete */}
            <button
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>

            <div className="w-px h-6 bg-stone-600/50" />

            <button
              onClick={() => setSelectedTasks(new Set())}
              className="text-xs font-medium text-[--exec-text-muted] hover:text-[--exec-text] transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showBulkDeleteConfirm}
        onClose={() => setShowBulkDeleteConfirm(false)}
        onConfirm={() => {
          bulkDeleteMutation.mutate(Array.from(selectedTasks));
        }}
        title="Delete Tasks"
        message={`Are you sure you want to delete ${selectedTasks.size} task(s)? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        isLoading={bulkDeleteMutation.isPending}
      />
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
