import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { projectApi } from '@/lib/api';
import { ProjectStatus } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
  return <div>Overview content coming soon for project {project.id}</div>;
}

function ListTab({ projectId }: { projectId: number }) {
  return <div>List content coming soon for project {projectId}</div>;
}

function BoardTab({ projectId }: { projectId: number }) {
  return <div>Board content coming soon for project {projectId}</div>;
}
