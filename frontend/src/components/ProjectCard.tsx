import { Project, ProjectStatus } from '@/types';
import { Folder, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface ProjectCardProps {
  project: Project;
}

const statusConfig = {
  [ProjectStatus.TODO]: {
    badge: 'bg-gray-100 text-gray-700 border-gray-300',
    label: 'To Do',
  },
  [ProjectStatus.IN_PROGRESS]: {
    badge: 'bg-blue-100 text-blue-700 border-blue-300',
    label: 'In Progress',
  },
  [ProjectStatus.COMPLETED]: {
    badge: 'bg-green-100 text-green-700 border-green-300',
    label: 'Completed',
  },
};

export default function ProjectCard({ project }: ProjectCardProps) {
  const navigate = useNavigate();

  const getProgressColor = (progress: number) => {
    if (progress < 34) return 'bg-red-500';
    if (progress < 67) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div
      onClick={() => navigate(`/projects/${project.id}`)}
      className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-all cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Folder className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-lg">{project.name}</h3>
        </div>
        <span
          className={cn(
            'px-3 py-1 rounded-full text-xs font-medium border',
            statusConfig[project.status].badge
          )}
        >
          {statusConfig[project.status].label}
        </span>
      </div>

      {/* Description */}
      {project.description && (
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {project.description}
        </p>
      )}

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-gray-500">Progress</span>
          <span className="text-xs font-medium">{project.progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={cn('h-2 rounded-full transition-all', getProgressColor(project.progress))}
            style={{ width: `${project.progress}%` }}
          />
        </div>
      </div>

      {/* Task Count */}
      <div className="flex items-center gap-1 text-sm text-gray-600">
        <CheckCircle2 className="w-4 h-4" />
        <span>
          {project.completed_task_count || 0} of {project.task_count || 0} tasks
        </span>
      </div>
    </div>
  );
}
