import { useState } from 'react';
import { Project, ProjectStatus } from '@/types';
import { Folder, CheckCircle2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from './ConfirmModal';

interface ProjectCardProps {
  project: Project;
  onDelete?: (id: number) => void;
}

const statusConfig = {
  [ProjectStatus.TODO]: {
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    dot: 'bg-amber-400',
    label: 'To Do',
  },
  [ProjectStatus.IN_PROGRESS]: {
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    dot: 'bg-blue-400',
    label: 'In Progress',
  },
  [ProjectStatus.COMPLETED]: {
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    dot: 'bg-emerald-400',
    label: 'Completed',
  },
  [ProjectStatus.RETAINER]: {
    badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    dot: 'bg-purple-400',
    label: 'Retainer',
  },
};

export default function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking the delete button or if confirm modal is open
    if ((e.target as HTMLElement).closest('button') || showDeleteConfirm) return;
    navigate(`/projects/${project.id}`);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setShowDeleteConfirm(true);
  };

  const getProgressColor = (progress: number) => {
    if (progress < 34) return 'bg-[--exec-danger]';
    if (progress < 67) return 'bg-[--exec-warning]';
    return 'bg-[--exec-sage]';
  };

  return (
    <div
      onClick={handleCardClick}
      className="bento-card p-5 cursor-pointer group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[--exec-accent-bg] flex items-center justify-center text-[--exec-accent] group-hover:bg-[--exec-accent] group-hover:text-white transition-all duration-300">
            <Folder className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-[--exec-text] line-clamp-1 group-hover:text-[--exec-accent] transition-colors">{project.name}</h3>
            <span className="text-xs text-[--exec-text-muted]">Updated recently</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border',
              statusConfig[project.status].badge
            )}
          >
            <span className={cn('w-1.5 h-1.5 rounded-full', statusConfig[project.status].dot)} />
            {statusConfig[project.status].label}
          </span>
          {onDelete && (
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-md text-[--exec-text-muted] opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110 active:scale-95"
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ef4444';
                e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '';
                e.currentTarget.style.backgroundColor = '';
              }}
              title="Delete project"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-[--exec-text-secondary] mb-6 line-clamp-2 min-h-[40px]">
        {project.description || "No description provided."}
      </p>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-medium text-[--exec-text-muted]">Progress</span>
          <span className="text-xs font-bold text-[--exec-text]" style={{ fontFamily: 'var(--font-display)' }}>{project.progress}%</span>
        </div>
        <div className="progress-exec">
          <div
            className={cn('h-full rounded-full transition-all duration-500', getProgressColor(project.progress))}
            style={{ width: `${project.progress}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-[--exec-border-subtle]">
        <div className="flex items-center gap-2 text-xs font-medium text-[--exec-text-muted]">
          <CheckCircle2 className="w-4 h-4 text-[--exec-sage]" />
          <span>
            {project.completed_task_count || 0}/{project.task_count || 0} tasks
          </span>
        </div>
        <div className="flex -space-x-2">
          {/* Placeholder for team members if added later */}
          <div className="w-7 h-7 rounded-full bg-[--exec-surface-alt] border-2 border-[--exec-surface] flex items-center justify-center text-[10px] font-bold text-[--exec-text-muted] group-hover:bg-[--exec-accent-bg] group-hover:text-[--exec-accent] transition-colors">
            +
          </div>
        </div>
      </div>
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          setShowDeleteConfirm(false);
          setTimeout(() => {
            if (onDelete) onDelete(project.id);
          }, 100);
        }}
        title="Delete Project"
        message={`Are you sure you want to delete "${project.name}"? This will also delete ${project.task_count || 0} tasks. This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
