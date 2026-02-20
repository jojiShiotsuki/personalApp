import { useState } from 'react';
import { Project, ProjectStatus } from '@/types';
import { Folder, CheckCircle2, Trash2, Calendar, Clock, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from './ConfirmModal';
import { format, isPast, isToday, differenceInDays } from 'date-fns';

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
  [ProjectStatus.SCOPING]: {
    badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    dot: 'bg-indigo-400',
    label: 'Scoping',
  },
  [ProjectStatus.IN_PROGRESS]: {
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    dot: 'bg-blue-400',
    label: 'In Progress',
  },
  [ProjectStatus.REVIEW]: {
    badge: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    dot: 'bg-violet-400',
    label: 'Review',
  },
  [ProjectStatus.REVISIONS]: {
    badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    dot: 'bg-orange-400',
    label: 'Revisions',
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

const serviceTagConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
  wordpress: { label: 'WordPress', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  ghl: { label: 'GHL', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  graphic_design: { label: 'Design', bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' },
  seo: { label: 'SEO', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
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
            <span className="text-xs text-[--exec-text-muted] flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {(() => {
                const start = new Date(project.created_at);
                const end = project.completed_at ? new Date(project.completed_at) : new Date();
                const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                if (project.status === ProjectStatus.COMPLETED) {
                  return `Done in ${days} day${days !== 1 ? 's' : ''}`;
                }
                return `Day ${days}`;
              })()}
            </span>
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
              className="p-1.5 rounded-md text-[--exec-text-muted] opacity-0 group-hover:opacity-100 transition-all duration-200 hover:text-red-400 hover:bg-red-500/15 hover:scale-110 active:scale-95"
              title="Delete project"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-[--exec-text-secondary] mb-4 line-clamp-2 min-h-[40px]">
        {project.description || "No description provided."}
      </p>

      {/* Service type + client tags */}
      {(project.service_type || project.contact_name) && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {project.service_type && serviceTagConfig[project.service_type] && (
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wide border',
              serviceTagConfig[project.service_type].bg,
              serviceTagConfig[project.service_type].text,
              serviceTagConfig[project.service_type].border,
            )}>
              <Tag className="w-2.5 h-2.5" />
              {serviceTagConfig[project.service_type].label}
            </span>
          )}
          {project.contact_name && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium text-[--exec-text-muted] bg-[--exec-surface-alt] border border-[--exec-border]">
              {project.contact_name}
            </span>
          )}
        </div>
      )}

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
        {project.deadline && (() => {
          const deadlineDate = new Date(project.deadline + 'T00:00:00');
          const isOverdue = isPast(deadlineDate) && !isToday(deadlineDate) && project.status !== ProjectStatus.COMPLETED;
          const isDueToday = isToday(deadlineDate);
          const daysLeft = differenceInDays(deadlineDate, new Date());
          const isUpcoming = daysLeft <= 7 && daysLeft > 0;
          return (
            <div className={cn(
              'flex items-center gap-1.5 text-xs font-medium',
              isOverdue ? 'text-red-400' :
              isDueToday ? 'text-amber-400' :
              isUpcoming ? 'text-amber-400/80' :
              'text-[--exec-text-muted]'
            )}>
              <Calendar className="w-3.5 h-3.5" />
              {isOverdue ? 'Overdue' : isDueToday ? 'Due today' : format(deadlineDate, 'MMM d')}
            </div>
          );
        })()}
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
