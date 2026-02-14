import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, FileText, ChevronDown, Calendar } from 'lucide-react';
import { Project, ProjectCreate } from '@/types';
import type { ProjectTemplate } from '@/types';
import { projectTemplateApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ProjectCreate) => void;
  project?: Project;
}

export default function ProjectModal({
  isOpen,
  onClose,
  onSubmit,
  project,
}: ProjectModalProps) {
  const [formData, setFormData] = useState<ProjectCreate>({
    name: '',
    description: '',
  });
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);

  const { data: templates = [] } = useQuery({
    queryKey: ['project-templates'],
    queryFn: projectTemplateApi.getAll,
    enabled: isOpen && !project,
  });

  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name,
        description: project.description || '',
        deadline: project.deadline || '',
      });
      setSelectedTemplate(null);
    } else {
      setFormData({ name: '', description: '', deadline: '' });
      setSelectedTemplate(null);
    }
  }, [project, isOpen]);

  const handleTemplateChange = (templateId: string) => {
    if (!templateId) {
      setSelectedTemplate(null);
      setFormData({ ...formData, template_id: undefined });
      return;
    }
    const template = templates.find(t => t.id === parseInt(templateId));
    if (template) {
      setSelectedTemplate(template);
      setFormData({
        ...formData,
        name: formData.name || template.name,
        description: formData.description || template.description || '',
        template_id: template.id,
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    const submitData = { ...formData };
    if (!submitData.deadline) {
      delete submitData.deadline;
    }
    onSubmit(submitData);
    setFormData({ name: '', description: '' });
    setSelectedTemplate(null);
  };

  if (!isOpen) return null;

  const inputClasses = cn(
    "w-full px-4 py-2.5 rounded-lg",
    "bg-stone-800/50 border border-stone-600/40",
    "text-[--exec-text] placeholder:text-[--exec-text-muted]",
    "focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50",
    "transition-all text-sm"
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-stone-600/40 transform transition-all animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold text-[--exec-text]">
                {project ? 'Edit Project' : 'New Project'}
              </h2>
              <p className="text-sm text-[--exec-text-muted] mt-1">
                {project ? 'Update project details' : 'Create a new workspace for your tasks'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Template Selector - only show for new projects */}
            {!project && templates.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                  Start from Template
                </label>
                <div className="relative">
                  <select
                    value={selectedTemplate?.id || ''}
                    onChange={(e) => handleTemplateChange(e.target.value)}
                    className={cn(inputClasses, 'appearance-none cursor-pointer pr-10')}
                  >
                    <option value="">Blank project</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.tasks.length} tasks)
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[--exec-text-muted] pointer-events-none" />
                </div>
              </div>
            )}

            {/* Template task preview */}
            {selectedTemplate && selectedTemplate.tasks.length > 0 && (
              <div className="p-3 rounded-lg bg-[--exec-accent]/5 border border-[--exec-accent]/15">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-3.5 h-3.5 text-[--exec-accent]" />
                  <span className="text-xs font-semibold text-[--exec-accent] uppercase tracking-wide">
                    {selectedTemplate.tasks.length} tasks will be created
                  </span>
                </div>
                <div className="space-y-1">
                  {selectedTemplate.tasks.slice(0, 5).map((task, i) => (
                    <p key={i} className="text-xs text-[--exec-text-secondary] truncate">
                      {task.title}
                    </p>
                  ))}
                  {selectedTemplate.tasks.length > 5 && (
                    <p className="text-xs text-[--exec-text-muted]">
                      +{selectedTemplate.tasks.length - 5} more...
                    </p>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Project Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={inputClasses}
                placeholder="e.g., Website Redesign"
                required
                maxLength={255}
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className={cn(inputClasses, "resize-none")}
                rows={4}
                placeholder="What is this project about?"
                maxLength={2000}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Deadline
                </span>
              </label>
              <input
                type="date"
                value={formData.deadline || ''}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                className={cn(inputClasses, 'cursor-pointer')}
              />
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-stone-700/30 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!formData.name.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-[--exec-accent] rounded-lg hover:bg-[--exec-accent-dark] shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {project ? 'Save Changes' : 'Create Project'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
