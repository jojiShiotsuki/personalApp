import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Trash2, Plus } from 'lucide-react';
import { projectApi, taskApi } from '@/lib/api';
import { ProjectStatus, TaskStatus } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import TaskItem from '@/components/TaskItem';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

type Tab = 'overview' | 'list' | 'board';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id || '0');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Fetch project
  const { data: project, isLoading } = useQuery({
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
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => projectApi.delete(projectId),
    onSuccess: () => {
      toast.success('Project deleted');
      navigate('/projects');
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
    return <div className="p-6">Loading...</div>;
  }

  if (!project) {
    return <div className="p-6">Project not found</div>;
  }

  const statusConfig = {
    [ProjectStatus.TODO]: { label: 'To Do', color: 'text-gray-700' },
    [ProjectStatus.IN_PROGRESS]: { label: 'In Progress', color: 'text-blue-700' },
    [ProjectStatus.COMPLETED]: { label: 'Completed', color: 'text-green-700' },
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Projects
        </button>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">{project.name}</h1>
            {project.description && (
              <p className="text-gray-600">{project.description}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Status Selector */}
            <select
              value={project.status}
              onChange={(e) =>
                updateMutation.mutate({ status: e.target.value as ProjectStatus })
              }
              className={cn(
                'px-3 py-2 border border-gray-300 rounded-lg font-medium',
                statusConfig[project.status].color
              )}
            >
              {Object.entries(statusConfig).map(([value, config]) => (
                <option key={value} value={value}>
                  {config.label}
                </option>
              ))}
            </select>

            {/* Delete Button */}
            <button
              onClick={handleDelete}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
              title="Delete Project"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-6">
          {(['overview', 'list', 'board'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'pb-3 border-b-2 font-medium capitalize transition-colors',
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && <OverviewTab project={project} />}
        {activeTab === 'list' && <ListTab projectId={projectId} />}
        {activeTab === 'board' && <BoardTab projectId={projectId} />}
      </div>
    </div>
  );
}

// Placeholder components (will implement in next tasks)
function OverviewTab({ project }: { project: any }) {
  const progressColor =
    project.progress < 34 ? 'text-red-600' :
    project.progress < 67 ? 'text-yellow-600' :
    'text-green-600';

  const progressBg =
    project.progress < 34 ? 'bg-red-500' :
    project.progress < 67 ? 'bg-yellow-500' :
    'bg-green-500';

  return (
    <div className="space-y-6">
      {/* Progress Circle */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-center">
          <div className="relative inline-flex items-center justify-center">
            <svg className="w-48 h-48">
              <circle
                className="text-gray-200"
                strokeWidth="12"
                stroke="currentColor"
                fill="transparent"
                r="88"
                cx="96"
                cy="96"
              />
              <circle
                className={progressBg.replace('bg-', 'text-')}
                strokeWidth="12"
                strokeDasharray={88 * 2 * Math.PI}
                strokeDashoffset={88 * 2 * Math.PI * (1 - project.progress / 100)}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
                r="88"
                cx="96"
                cy="96"
                style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className={cn('text-4xl font-bold', progressColor)}>
                {project.progress}%
              </span>
              <span className="text-sm text-gray-500">Complete</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500 mb-1">Total Tasks</div>
          <div className="text-2xl font-bold">{project.task_count || 0}</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500 mb-1">Completed</div>
          <div className="text-2xl font-bold text-green-600">
            {project.completed_task_count || 0}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500 mb-1">In Progress</div>
          <div className="text-2xl font-bold text-blue-600">
            {(project.task_count || 0) - (project.completed_task_count || 0)}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500 mb-1">Status</div>
          <div className="text-lg font-semibold capitalize">
            {project.status.replace('_', ' ')}
          </div>
        </div>
      </div>

      {/* Completion Message */}
      {project.progress === 100 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <div className="text-2xl mb-2">🎉</div>
          <div className="font-semibold text-green-800">All tasks complete!</div>
          <div className="text-sm text-green-600">Ready to mark as completed?</div>
        </div>
      )}
    </div>
  );
}

function ListTab({ projectId }: { projectId: number }) {
  const [showAddTask, setShowAddTask] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');

  // Fetch project tasks
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['projects', projectId, 'tasks'],
    queryFn: () => projectApi.getTasks(projectId),
  });

  // Handle task status change - placeholder for now
  const handleStatusChange = (taskId: number, status: TaskStatus) => {
    // TODO: Implement with taskApi.update when available
    console.log('Status change:', taskId, status);
  };

  // Handle task click - open in edit mode
  const handleTaskClick = (taskId: number) => {
    // TODO: Open task edit modal
    console.log('Task clicked:', taskId);
  };

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
    return true;
  });

  // Group by status
  const groupedTasks = {
    pending: filteredTasks.filter((t) => t.status === TaskStatus.PENDING),
    in_progress: filteredTasks.filter((t) => t.status === TaskStatus.IN_PROGRESS),
    completed: filteredTasks.filter((t) => t.status === TaskStatus.COMPLETED),
    delayed: filteredTasks.filter((t) => t.status === TaskStatus.DELAYED),
  };

  if (isLoading) {
    return <div>Loading tasks...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4 items-center">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="delayed">Delayed</option>
        </select>

        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value="all">All Priority</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>

        <button
          onClick={() => setShowAddTask(true)}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Task
        </button>
      </div>

      {/* Task Groups */}
      {tasks.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 mb-4">No tasks yet</p>
          <button
            onClick={() => setShowAddTask(true)}
            className="text-blue-600 hover:text-blue-700"
          >
            Add your first task
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedTasks).map(([status, statusTasks]) => {
            if (statusTasks.length === 0) return null;
            return (
              <div key={status}>
                <h3 className="font-semibold text-lg mb-3 capitalize">
                  {status.replace('_', ' ')} ({statusTasks.length})
                </h3>
                <div className="space-y-2">
                  {statusTasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onStatusChange={handleStatusChange}
                      onClick={() => handleTaskClick(task.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Task Modal - placeholder for now */}
      {showAddTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg">
            <p>Add Task Modal - to be implemented</p>
            <button
              onClick={() => setShowAddTask(false)}
              className="mt-4 px-4 py-2 bg-gray-200 rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BoardTab({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient();

  // Fetch project tasks
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['projects', projectId, 'tasks'],
    queryFn: () => projectApi.getTasks(projectId),
  });

  // Update task status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: TaskStatus }) =>
      taskApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
      toast.success('Task status updated');
    },
    onError: () => {
      toast.error('Failed to update task status');
    },
  });

  const handleDragEnd = (result: any) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    const taskId = parseInt(draggableId.replace('task-', ''));
    const newStatus = destination.droppableId as TaskStatus;

    updateStatusMutation.mutate({ id: taskId, status: newStatus });
  };

  if (isLoading) {
    return <div>Loading tasks...</div>;
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <p className="text-gray-500 mb-4">No tasks yet</p>
        <p className="text-sm text-gray-400">
          Add tasks from the List tab to see them on the board
        </p>
      </div>
    );
  }

  // Group tasks by status
  const tasksByStatus = {
    [TaskStatus.PENDING]: tasks.filter(t => t.status === TaskStatus.PENDING),
    [TaskStatus.IN_PROGRESS]: tasks.filter(t => t.status === TaskStatus.IN_PROGRESS),
    [TaskStatus.COMPLETED]: tasks.filter(t => t.status === TaskStatus.COMPLETED),
    [TaskStatus.DELAYED]: tasks.filter(t => t.status === TaskStatus.DELAYED),
  };

  const statusConfig = {
    [TaskStatus.PENDING]: { label: 'Pending', color: 'bg-gray-100' },
    [TaskStatus.IN_PROGRESS]: { label: 'In Progress', color: 'bg-blue-100' },
    [TaskStatus.COMPLETED]: { label: 'Completed', color: 'bg-green-100' },
    [TaskStatus.DELAYED]: { label: 'Delayed', color: 'bg-red-100' },
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {Object.entries(tasksByStatus).map(([status, statusTasks]) => (
          <Droppable key={status} droppableId={status}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={cn(
                  'flex-shrink-0 w-80 bg-gray-50 rounded-lg p-4',
                  snapshot.isDraggingOver && 'bg-blue-50'
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-700">
                    {statusConfig[status as TaskStatus].label}
                  </h3>
                  <span className="text-sm text-gray-500">
                    {statusTasks.length}
                  </span>
                </div>

                <div className="space-y-2">
                  {statusTasks.map((task, index) => (
                    <Draggable
                      key={task.id}
                      draggableId={`task-${task.id}`}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={cn(
                            'bg-white p-3 rounded border border-gray-200',
                            'hover:shadow-md transition-shadow cursor-move',
                            snapshot.isDragging && 'shadow-lg opacity-90'
                          )}
                        >
                          <div className="font-medium text-sm mb-1">
                            {task.title}
                          </div>
                          {task.description && (
                            <div className="text-xs text-gray-500 line-clamp-2 mb-2">
                              {task.description}
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-xs">
                            {task.priority && (
                              <span
                                className={cn(
                                  'px-2 py-0.5 rounded',
                                  task.priority === 'urgent' && 'bg-red-100 text-red-700',
                                  task.priority === 'high' && 'bg-orange-100 text-orange-700',
                                  task.priority === 'medium' && 'bg-yellow-100 text-yellow-700',
                                  task.priority === 'low' && 'bg-gray-100 text-gray-700'
                                )}
                              >
                                {task.priority}
                              </span>
                            )}
                            {task.due_date && (
                              <span className="text-gray-500">
                                {new Date(task.due_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              </div>
            )}
          </Droppable>
        ))}
      </div>
    </DragDropContext>
  );
}
