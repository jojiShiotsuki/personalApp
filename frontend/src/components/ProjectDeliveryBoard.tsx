import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { projectApi } from '@/lib/api';
import { Project, ProjectStatus } from '@/types';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Calendar, CheckCircle2, User } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import { toast } from 'sonner';

const DELIVERY_COLUMNS: ProjectStatus[] = [
  ProjectStatus.SCOPING,
  ProjectStatus.IN_PROGRESS,
  ProjectStatus.REVIEW,
  ProjectStatus.REVISIONS,
  ProjectStatus.COMPLETED,
];

const COLUMN_CONFIG: Record<string, { label: string; headerBg: string; headerText: string; headerBorder: string }> = {
  [ProjectStatus.SCOPING]: {
    label: 'Scoping',
    headerBg: 'bg-indigo-500/10',
    headerText: 'text-indigo-400',
    headerBorder: 'border-indigo-500/20',
  },
  [ProjectStatus.IN_PROGRESS]: {
    label: 'In Progress',
    headerBg: 'bg-blue-500/10',
    headerText: 'text-blue-400',
    headerBorder: 'border-blue-500/20',
  },
  [ProjectStatus.REVIEW]: {
    label: 'Review',
    headerBg: 'bg-violet-500/10',
    headerText: 'text-violet-400',
    headerBorder: 'border-violet-500/20',
  },
  [ProjectStatus.REVISIONS]: {
    label: 'Revisions',
    headerBg: 'bg-orange-500/10',
    headerText: 'text-orange-400',
    headerBorder: 'border-orange-500/20',
  },
  [ProjectStatus.COMPLETED]: {
    label: 'Completed',
    headerBg: 'bg-emerald-500/10',
    headerText: 'text-emerald-400',
    headerBorder: 'border-emerald-500/20',
  },
};

const SERVICE_TAG_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  wordpress: { label: 'WordPress', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  ghl: { label: 'GHL', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  graphic_design: { label: 'Design', bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' },
  seo: { label: 'SEO', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
};

interface ProjectDeliveryBoardProps {
  projects: Project[];
}

export default function ProjectDeliveryBoard({ projects }: ProjectDeliveryBoardProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: ProjectStatus }) =>
      projectApi.update(id, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['projects'] });
      const previous = queryClient.getQueryData<Project[]>(['projects']);
      queryClient.setQueryData<Project[]>(['projects'], (old) =>
        old ? old.map(p => p.id === id ? { ...p, status } : p) : []
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['projects'], context.previous);
      toast.error('Failed to update project stage');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const projectId = parseInt(draggableId.replace('project-', ''));
    const newStatus = destination.droppableId as ProjectStatus;
    updateStatusMutation.mutate({ id: projectId, status: newStatus });
  };

  // Group projects by status for delivery columns
  const projectsByStatus = DELIVERY_COLUMNS.reduce((acc, status) => {
    acc[status] = projects.filter(p => p.status === status);
    return acc;
  }, {} as Record<ProjectStatus, Project[]>);

  const getProgressColor = (progress: number) => {
    if (progress < 34) return 'bg-[--exec-danger]';
    if (progress < 67) return 'bg-[--exec-warning]';
    return 'bg-[--exec-sage]';
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 pt-2 px-1 h-full [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-600 [&::-webkit-scrollbar-track]:bg-transparent">
        {DELIVERY_COLUMNS.map((status) => {
          const config = COLUMN_CONFIG[status];
          const columnProjects = projectsByStatus[status];
          return (
            <div key={status} className="flex flex-col min-w-[260px] w-[280px] flex-shrink-0">
              {/* Column header */}
              <div className={cn(
                'flex items-center justify-between px-3 py-2 rounded-xl border font-medium text-sm mb-3',
                config.headerBg, config.headerText, config.headerBorder,
              )}>
                <span>{config.label}</span>
                <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full font-semibold">
                  {columnProjects.length}
                </span>
              </div>

              {/* Droppable column */}
              <Droppable droppableId={status}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      'flex-1 space-y-3 min-h-[200px] rounded-xl p-2 transition-colors duration-200',
                      snapshot.isDraggingOver ? 'bg-[--exec-accent]/5 ring-1 ring-[--exec-accent]/20' : '',
                    )}
                  >
                    {columnProjects.map((project, index) => (
                      <Draggable
                        key={project.id}
                        draggableId={`project-${project.id}`}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={cn(
                              'bento-card-static p-4 cursor-pointer',
                              'transition-all duration-200',
                              snapshot.isDragging
                                ? 'shadow-2xl rotate-1 scale-105 border-[--exec-accent]/30'
                                : 'hover:border-[--exec-accent]/20 hover:shadow-md',
                            )}
                            onClick={() => !snapshot.isDragging && navigate(`/projects/${project.id}`)}
                          >
                            {/* Project name + service tag */}
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h4 className="font-semibold text-[--exec-text] text-sm line-clamp-2">
                                {project.name}
                              </h4>
                              {project.service_type && SERVICE_TAG_CONFIG[project.service_type] && (
                                <span className={cn(
                                  'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border flex-shrink-0',
                                  SERVICE_TAG_CONFIG[project.service_type].bg,
                                  SERVICE_TAG_CONFIG[project.service_type].text,
                                  SERVICE_TAG_CONFIG[project.service_type].border,
                                )}>
                                  {SERVICE_TAG_CONFIG[project.service_type].label}
                                </span>
                              )}
                            </div>

                            {/* Client name */}
                            {project.contact_name && (
                              <div className="flex items-center gap-1.5 text-xs text-[--exec-text-muted] mb-3">
                                <User className="w-3 h-3" />
                                {project.contact_name}
                              </div>
                            )}

                            {/* Description */}
                            {project.description && (
                              <p className="text-xs text-[--exec-text-secondary] mb-3 line-clamp-2">
                                {project.description}
                              </p>
                            )}

                            {/* Task progress bar */}
                            {(project.task_count ?? 0) > 0 && (
                              <div className="mb-3">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-xs text-[--exec-text-muted] flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    {project.completed_task_count ?? 0}/{project.task_count ?? 0} tasks
                                  </span>
                                  <span className="text-xs font-semibold text-[--exec-text]">
                                    {project.progress}%
                                  </span>
                                </div>
                                <div className="h-1 bg-[--exec-border] rounded-full overflow-hidden">
                                  <div
                                    className={cn('h-full rounded-full transition-all duration-500', getProgressColor(project.progress))}
                                    style={{ width: `${project.progress}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Deadline */}
                            {project.deadline && (() => {
                              const deadlineDate = new Date(project.deadline + 'T00:00:00');
                              const isOverdue = isPast(deadlineDate) && !isToday(deadlineDate) && project.status !== ProjectStatus.COMPLETED;
                              const isDueToday = isToday(deadlineDate);
                              return (
                                <div className={cn(
                                  'flex items-center gap-1 text-xs',
                                  isOverdue ? 'text-red-400' : isDueToday ? 'text-amber-400' : 'text-[--exec-text-muted]',
                                )}>
                                  <Calendar className="w-3 h-3" />
                                  {isOverdue ? 'Overdue' : isDueToday ? 'Due today' : format(deadlineDate, 'MMM d')}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
