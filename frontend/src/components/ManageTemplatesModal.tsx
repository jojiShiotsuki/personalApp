import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Trash2, GripVertical, FileText } from 'lucide-react';
import { projectTemplateApi } from '@/lib/api';
import { TaskPriority } from '@/types';
import type { ProjectTemplateTaskCreate } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ConfirmModal from './ConfirmModal';

interface ManageTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const inputClasses = cn(
  "w-full px-4 py-2.5 rounded-lg",
  "bg-stone-800/50 border border-stone-600/40",
  "text-[--exec-text] placeholder:text-[--exec-text-muted]",
  "focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50",
  "transition-all text-sm"
);

const priorityOptions = [
  { value: TaskPriority.LOW, label: 'Low', color: 'text-stone-400' },
  { value: TaskPriority.MEDIUM, label: 'Medium', color: 'text-[--exec-accent]' },
  { value: TaskPriority.HIGH, label: 'High', color: 'text-[--exec-warning]' },
  { value: TaskPriority.URGENT, label: 'Urgent', color: 'text-[--exec-danger]' },
];

export default function ManageTemplatesModal({ isOpen, onClose }: ManageTemplatesModalProps) {
  const queryClient = useQueryClient();
  const [view, setView] = useState<'list' | 'create'>('list');
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [tasks, setTasks] = useState<ProjectTemplateTaskCreate[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [newTaskPhase, setNewTaskPhase] = useState('');

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['project-templates'],
    queryFn: projectTemplateApi.getAll,
    enabled: isOpen,
  });

  const createMutation = useMutation({
    mutationFn: projectTemplateApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-templates'] });
      toast.success('Template created');
      resetForm();
      setView('list');
    },
    onError: () => toast.error('Failed to create template'),
  });

  const deleteMutation = useMutation({
    mutationFn: projectTemplateApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-templates'] });
      toast.success('Template deleted');
      setDeleteId(null);
    },
    onError: () => toast.error('Failed to delete template'),
  });

  const resetForm = () => {
    setTemplateName('');
    setTemplateDesc('');
    setTasks([]);
    setNewTaskTitle('');
    setNewTaskPriority(TaskPriority.MEDIUM);
    setNewTaskPhase('');
  };

  const addTask = () => {
    if (!newTaskTitle.trim()) return;
    setTasks([...tasks, {
      title: newTaskTitle.trim(),
      priority: newTaskPriority,
      order: tasks.length,
      phase: newTaskPhase.trim() || undefined,
    }]);
    setNewTaskTitle('');
    setNewTaskPriority(TaskPriority.MEDIUM);
  };

  const removeTask = (index: number) => {
    setTasks(tasks.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!templateName.trim() || tasks.length === 0) return;
    createMutation.mutate({
      name: templateName.trim(),
      description: templateDesc.trim() || undefined,
      tasks,
    });
  };

  if (!isOpen) return null;

  const deleteTemplate = templates.find(t => t.id === deleteId);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-2xl mx-4 border border-stone-600/40 transform transition-all animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
        <div className="p-6 flex-shrink-0">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold text-[--exec-text]">
                {view === 'list' ? 'Project Templates' : 'Create Template'}
              </h2>
              <p className="text-sm text-[--exec-text-muted] mt-1">
                {view === 'list' ? 'Reusable task sets for new projects' : 'Define a name and add tasks'}
              </p>
            </div>
            <button
              onClick={() => { if (view === 'create') { resetForm(); setView('list'); } else { onClose(); } }}
              className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-6 pb-6 overflow-y-auto flex-1">
          {view === 'list' ? (
            <>
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[--exec-accent] mb-3" />
                  <p className="text-sm text-[--exec-text-muted]">Loading templates...</p>
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-10 h-10 text-[--exec-text-muted] mx-auto mb-3" />
                  <p className="text-[--exec-text-secondary] font-medium">No templates yet</p>
                  <p className="text-sm text-[--exec-text-muted] mt-1">Create one to speed up project setup</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {templates.map((template) => (
                    <div key={template.id} className="flex items-center justify-between p-4 rounded-xl bg-stone-800/30 border border-stone-700/30 group">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-[--exec-text] truncate">{template.name}</h4>
                        <p className="text-xs text-[--exec-text-muted] mt-0.5">
                          {template.tasks.length} task{template.tasks.length !== 1 ? 's' : ''}
                          {(() => {
                            const phases = new Set(template.tasks.map(t => t.phase).filter(Boolean));
                            return phases.size > 0 ? ` · ${phases.size} phase${phases.size !== 1 ? 's' : ''}` : '';
                          })()}
                          {template.description && ` · ${template.description}`}
                        </p>
                      </div>
                      <button
                        onClick={() => setDeleteId(template.id)}
                        className="p-1.5 rounded-md text-[--exec-text-muted] opacity-0 group-hover:opacity-100 transition-all hover:text-[--exec-danger] hover:bg-[--exec-danger]/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-6 pt-4 border-t border-stone-700/30">
                <button
                  onClick={() => setView('create')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[--exec-accent] to-[--exec-accent-dark] text-white rounded-xl hover:shadow-lg hover:shadow-[--exec-accent]/25 transition-all font-semibold text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Create Template
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                    Template Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className={inputClasses}
                    placeholder="e.g., Website Build"
                    maxLength={255}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                    Description
                  </label>
                  <input
                    type="text"
                    value={templateDesc}
                    onChange={(e) => setTemplateDesc(e.target.value)}
                    className={inputClasses}
                    placeholder="Brief description (optional)"
                    maxLength={2000}
                  />
                </div>

                <div className="pt-4 border-t border-stone-700/30">
                  <h3 className="text-sm font-semibold text-[--exec-text] mb-3 flex items-center">
                    <FileText className="w-4 h-4 mr-2 text-[--exec-accent]" />
                    Tasks ({tasks.length})
                  </h3>

                  {tasks.length > 0 && (() => {
                    const grouped: Record<string, { task: ProjectTemplateTaskCreate; originalIndex: number }[]> = {};
                    tasks.forEach((task, index) => {
                      const phase = task.phase || 'Ungrouped';
                      if (!grouped[phase]) grouped[phase] = [];
                      grouped[phase].push({ task, originalIndex: index });
                    });
                    const phases = Object.keys(grouped);
                    const hasPhases = phases.length > 1 || (phases.length === 1 && phases[0] !== 'Ungrouped');
                    return (
                      <div className="space-y-1 mb-4">
                        {phases.map(phase => (
                          <div key={phase}>
                            {hasPhases && (
                              <div className="text-[10px] font-bold uppercase tracking-wider text-[--exec-accent] mt-2 mb-1 px-1">
                                {phase}
                              </div>
                            )}
                            {grouped[phase].map(({ task, originalIndex }) => {
                              const pConfig = priorityOptions.find(p => p.value === task.priority);
                              return (
                                <div key={originalIndex} className="flex items-center gap-2 p-2.5 rounded-lg bg-stone-800/30 border border-stone-700/30">
                                  <GripVertical className="w-4 h-4 text-[--exec-text-muted] flex-shrink-0" />
                                  <span className="text-sm text-[--exec-text] flex-1 truncate">{task.title}</span>
                                  {task.phase && !hasPhases && (
                                    <span className="text-[10px] font-medium text-[--exec-accent] bg-[--exec-accent-bg] px-1.5 py-0.5 rounded flex-shrink-0">{task.phase}</span>
                                  )}
                                  <span className={cn('text-[10px] font-bold uppercase tracking-wide flex-shrink-0', pConfig?.color)}>
                                    {pConfig?.label}
                                  </span>
                                  <button
                                    onClick={() => removeTask(originalIndex)}
                                    className="p-1 rounded text-[--exec-text-muted] hover:text-[--exec-danger] transition-colors flex-shrink-0"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTask(); } }}
                      className={cn(inputClasses, 'flex-1')}
                      placeholder="Task title..."
                    />
                    <input
                      type="text"
                      value={newTaskPhase}
                      onChange={(e) => setNewTaskPhase(e.target.value)}
                      className={cn(inputClasses, 'w-36')}
                      placeholder="Phase..."
                    />
                    <select
                      value={newTaskPriority}
                      onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
                      className={cn(inputClasses, 'w-28')}
                    >
                      {priorityOptions.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={addTask}
                      disabled={!newTaskTitle.trim()}
                      className="px-3 py-2 bg-[--exec-accent] text-white rounded-lg hover:bg-[--exec-accent-dark] transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-stone-700/30 mt-6">
                <button
                  type="button"
                  onClick={() => { resetForm(); setView('list'); }}
                  className="px-4 py-2 text-sm font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!templateName.trim() || tasks.length === 0 || createMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-[--exec-accent] rounded-lg hover:bg-[--exec-accent-dark] shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create Template'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId); }}
        title="Delete Template"
        message={`Are you sure you want to delete "${deleteTemplate?.name}"? This won't affect existing projects.`}
        confirmText="Delete"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
