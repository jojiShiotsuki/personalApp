import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Trash2, Plus, Clock } from 'lucide-react';
import { projectApi, taskApi } from '@/lib/api';
import { ProjectStatus, TaskStatus, TaskCreate, TaskPriority } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import TaskItem from '@/components/TaskItem';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { format } from 'date-fns';

type Tab = 'overview' | 'list' | 'board';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id || '0');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Fetch project
  const { data: project, isLoading, isError } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectApi.getById(projectId),
    enabled: projectId > 0,
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: { status: ProjectStatus }) =>
      projectApi.update(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
      toast.success('Project updated');
    },
    onError: () => {
      toast.error('Failed to update project');
    },
  });

  // Delete mutation
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

  const handleDelete = () => {
    if (
      confirm(
        `Delete "${project?.name}"? This will also delete ${project?.task_count || 0} tasks.`
      )
    ) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600 mb-4"></div>
          <p className="text-gray-500">Loading project...</p>
        </div>
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-500 mb-4">
            {isError ? 'Failed to load project' : 'Project not found'}
          </p>
          <button
            onClick={() => navigate('/projects')}
            className="text-slate-600 hover:text-slate-700"
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  const statusConfig = {
    [ProjectStatus.TODO]: { label: 'To Do', color: 'text-gray-700' },
    [ProjectStatus.IN_PROGRESS]: { label: 'In Progress', color: 'text-slate-700' },
    [ProjectStatus.COMPLETED]: { label: 'Completed', color: 'text-green-700' },
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white/50 backdrop-blur-sm border-b border-gray-200/60 px-8 py-6 sticky top-0 z-10">
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-6 transition-colors group"
        >
          <div className="p-1 rounded-full group-hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </div>
          <span className="font-medium">Back to Projects</span>
        </button>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">{project.name}</h1>
            {project.description && (
              <p className="text-gray-500 mt-2 text-base">{project.description}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Status Selector */}
            <div className="relative">
              <select
                value={project.status}
                onChange={(e) =>
                  updateMutation.mutate({ status: e.target.value as ProjectStatus })
                }
                className={cn(
                  'appearance-none pl-4 pr-10 py-2 border rounded-xl font-medium text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 transition-all cursor-pointer',
                  project.status === ProjectStatus.COMPLETED
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 focus:ring-emerald-500'
                    : project.status === ProjectStatus.IN_PROGRESS
                    ? 'bg-blue-50 border-blue-200 text-blue-700 focus:ring-blue-500'
                    : 'bg-white border-gray-200 text-gray-700 focus:ring-gray-500'
                )}
              >
                {Object.entries(statusConfig).map(([value, config]) => (
                  <option key={value} value={value}>
                    {config.label}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <div className={cn(
                  "w-2 h-2 border-r-2 border-b-2 rotate-45",
                  project.status === ProjectStatus.COMPLETED ? "border-emerald-600" :
                  project.status === ProjectStatus.IN_PROGRESS ? "border-blue-600" :
                  "border-gray-600"
                )} />
              </div>
            </div>

            {/* Delete Button */}
            <button
              onClick={handleDelete}
              className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all duration-200"
              title="Delete Project"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-8 mt-8 border-b border-gray-200/60">
          {(['overview', 'list', 'board'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'pb-4 font-medium capitalize transition-all relative text-sm',
                activeTab === tab
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto px-8 py-8">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'overview' && <OverviewTab project={project} />}
          {activeTab === 'list' && <ListTab projectId={projectId} />}
          {activeTab === 'board' && <BoardTab projectId={projectId} />}
        </div>
      </div>
    </div>
  );
}

// Placeholder components (will implement in next tasks)
function OverviewTab({ project }: { project: any }) {
  const progressColor =
    project.progress < 34 ? 'text-rose-600' :
    project.progress < 67 ? 'text-amber-600' :
    'text-emerald-600';

  const progressBg =
    project.progress < 34 ? 'bg-rose-500' :
    project.progress < 67 ? 'bg-amber-500' :
    'bg-emerald-500';

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Progress Circle */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
        <div className="flex flex-col items-center justify-center">
          <div className="relative inline-flex items-center justify-center mb-4">
            <svg className="w-48 h-48 transform -rotate-90">
              <circle
                className="text-gray-100"
                strokeWidth="12"
                stroke="currentColor"
                fill="transparent"
                r="88"
                cx="96"
                cy="96"
              />
              <circle
                className={cn("transition-all duration-1000 ease-out", progressBg.replace('bg-', 'text-'))}
                strokeWidth="12"
                strokeDasharray={88 * 2 * Math.PI}
                strokeDashoffset={88 * 2 * Math.PI * (1 - project.progress / 100)}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
                r="88"
                cx="96"
                cy="96"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className={cn('text-5xl font-bold tracking-tight', progressColor)}>
                {project.progress}%
              </span>
              <span className="text-sm font-medium text-gray-400 uppercase tracking-wider mt-1">Complete</span>
            </div>
          </div>
          <p className="text-gray-500 text-center max-w-md">
            {project.progress === 100 
              ? "All tasks completed! Great job!" 
              : `${project.completed_task_count || 0} of ${project.task_count || 0} tasks completed`}
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="text-sm font-medium text-gray-500 mb-2 uppercase tracking-wider">Total Tasks</div>
          <div className="text-3xl font-bold text-gray-900">{project.task_count || 0}</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="text-sm font-medium text-gray-500 mb-2 uppercase tracking-wider">Completed</div>
          <div className="text-3xl font-bold text-emerald-600">
            {project.completed_task_count || 0}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="text-sm font-medium text-gray-500 mb-2 uppercase tracking-wider">In Progress</div>
          <div className="text-3xl font-bold text-blue-600">
            {(project.task_count || 0) - (project.completed_task_count || 0)}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="text-sm font-medium text-gray-500 mb-2 uppercase tracking-wider">Status</div>
          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 capitalize">
            {project.status.replace('_', ' ')}
          </div>
        </div>
      </div>

      {/* Completion Message */}
      {project.progress === 100 && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-8 text-center animate-in zoom-in duration-500">
          <div className="text-4xl mb-4">🎉</div>
          <h3 className="text-xl font-bold text-emerald-900 mb-2">Project Completed!</h3>
          <p className="text-emerald-700">You've finished all tasks in this project. Ready to archive it?</p>
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

  // Fetch project tasks
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['projects', projectId, 'tasks'],
    queryFn: () => projectApi.getTasks(projectId),
  });

  // Create task mutation
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

  // Handle task status change
  const handleStatusChange = (taskId: number, status: TaskStatus) => {
    // TODO: Implement with taskApi.update when available
    console.log('Update task status', taskId, status);
  };

  const filteredTasks = tasks.filter((task) => {
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div className="flex gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          >
            <option value="all">All Status</option>
            <option value={TaskStatus.PENDING}>Pending</option>
            <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
            <option value={TaskStatus.COMPLETED}>Completed</option>
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          >
            <option value="all">All Priority</option>
            <option value={TaskPriority.HIGH}>High</option>
            <option value={TaskPriority.MEDIUM}>Medium</option>
            <option value={TaskPriority.LOW}>Low</option>
          </select>
        </div>
        <button
          onClick={() => setShowAddTask(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-sm hover:shadow-md font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Task
        </button>
      </div>

      {showAddTask && (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-lg animate-in slide-in-from-top-2 duration-300">
          <h3 className="text-lg font-bold text-gray-900 mb-4">New Task</h3>
          {/* Simple form for now */}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <input
                name="title"
                required
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                placeholder="What needs to be done?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                name="description"
                rows={3}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                placeholder="Add details..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                name="priority"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              >
                <option value={TaskPriority.LOW}>Low</option>
                <option value={TaskPriority.MEDIUM}>Medium</option>
                <option value={TaskPriority.HIGH}>High</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddTask(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createTaskMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50"
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
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-500">Loading tasks...</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
            <p className="text-gray-500 font-medium">No tasks found</p>
            <p className="text-sm text-gray-400 mt-1">
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

  const onDragEnd = (result: any) => {
    if (!result.destination) return;

    const { draggableId, destination } = result;
    const newStatus = destination.droppableId as TaskStatus;
    const taskId = parseInt(draggableId);

    updateStatusMutation.mutate({ taskId, status: newStatus });
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-500">Loading board...</p>
      </div>
    );
  }

  const columns = [
    { id: TaskStatus.PENDING, title: 'To Do', color: 'bg-gray-100' },
    { id: TaskStatus.IN_PROGRESS, title: 'In Progress', color: 'bg-blue-50' },
    { id: TaskStatus.COMPLETED, title: 'Completed', color: 'bg-emerald-50' },
  ];

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full min-h-[500px]">
        {columns.map((column) => (
          <div key={column.id} className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-4 px-1">
              <h3 className="font-bold text-gray-900">{column.title}</h3>
              <span className="bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full text-xs font-medium">
                {tasks.filter((t) => t.status === column.id).length}
              </span>
            </div>
            <Droppable droppableId={column.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    'flex-1 rounded-xl p-4 transition-colors border border-transparent',
                    column.color,
                    snapshot.isDraggingOver ? 'ring-2 ring-blue-500/20 bg-white' : ''
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
                                'bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all group',
                                snapshot.isDragging ? 'shadow-lg rotate-2 scale-105 z-50' : ''
                              )}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <span
                                  className={cn(
                                    'text-xs font-medium px-2 py-0.5 rounded-full',
                                    task.priority === TaskPriority.HIGH
                                      ? 'bg-rose-50 text-rose-700'
                                      : task.priority === TaskPriority.MEDIUM
                                      ? 'bg-amber-50 text-amber-700'
                                      : 'bg-blue-50 text-blue-700'
                                  )}
                                >
                                  {task.priority}
                                </span>
                              </div>
                              <h4 className="font-medium text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                                {task.title}
                              </h4>
                              {task.description && (
                                <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                                  {task.description}
                                </p>
                              )}
                              {task.due_date && (
                                <div className="flex items-center text-xs text-gray-400 mt-2 pt-2 border-t border-gray-50">
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
