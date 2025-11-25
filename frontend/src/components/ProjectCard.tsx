import { Project, ProjectStatus } from '@/types';
import { Folder, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface ProjectCardProps {
  project: Project;
}

const statusConfig = {
  [ProjectStatus.TODO]: {
    badge: 'bg-gray-100 text-gray-700 border-gray-200',
    label: 'To Do',
  },
  [ProjectStatus.IN_PROGRESS]: {
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    label: 'In Progress',
  },
  [ProjectStatus.COMPLETED]: {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    label: 'Completed',
  },
};

export default function ProjectCard({ project }: ProjectCardProps) {
  const navigate = useNavigate();

  const getProgressColor = (progress: number) => {
    if (progress < 34) return 'bg-rose-500';
    if (progress < 67) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div
      onClick={() => navigate(`/projects/${project.id}`)}
      className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-300 hover:-translate-y-1 cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 transition-colors">
            <Folder className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white line-clamp-1">{project.name}</h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">Updated recently</span>
          </div>
        </div>
        <span
          className={cn(
            'px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border',
            statusConfig[project.status].badge
          )}
        >
          {statusConfig[project.status].label}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 line-clamp-2 min-h-[40px]">
        {project.description || "No description provided."}
      </p>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Progress</span>
          <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{project.progress}%</span>
        </div>
        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', getProgressColor(project.progress))}
            style={{ width: `${project.progress}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-50 dark:border-gray-700">
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
          <CheckCircle2 className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          <span>
            {project.completed_task_count || 0}/{project.task_count || 0} tasks
          </span>
        </div>
        <div className="flex -space-x-2">
          {/* Placeholder for team members if added later */}
          <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 border-2 border-white dark:border-gray-800 flex items-center justify-center text-[10px] text-gray-500 dark:text-gray-400">
            +
          </div>
        </div>
      </div>
    </div>
  );
}
