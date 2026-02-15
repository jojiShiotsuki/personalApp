import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Trash2, Edit3, Mail, Linkedin, Video, Building2, FileText } from 'lucide-react';
import { outreachApi } from '@/lib/api';
import type { OutreachNiche, OutreachSituation, OutreachTemplate, TemplateType } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ConfirmModal from '@/components/ConfirmModal';

interface ManageOutreachTemplatesModalProps {
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

const TEMPLATE_CATEGORIES = [
  {
    group: 'Email',
    icon: Mail,
    types: [
      { value: 'email_1' as TemplateType, label: 'Email 1' },
      { value: 'email_2' as TemplateType, label: 'Email 2' },
      { value: 'email_3' as TemplateType, label: 'Email 3' },
      { value: 'email_4' as TemplateType, label: 'Email 4' },
      { value: 'email_5' as TemplateType, label: 'Email 5' },
    ],
  },
  {
    group: 'LinkedIn Outreach',
    icon: Linkedin,
    types: [
      { value: 'linkedin_direct' as TemplateType, label: 'Direct' },
      { value: 'linkedin_compliment' as TemplateType, label: 'Compliment' },
      { value: 'linkedin_mutual_interest' as TemplateType, label: 'Mutual Interest' },
    ],
  },
  {
    group: 'LinkedIn Follow-up',
    icon: Linkedin,
    types: [
      { value: 'linkedin_followup_1' as TemplateType, label: 'Follow-up 1' },
      { value: 'linkedin_followup_2' as TemplateType, label: 'Follow-up 2' },
    ],
  },
  {
    group: 'Loom',
    icon: Video,
    types: [
      { value: 'loom_video_audit' as TemplateType, label: 'Video Audit' },
    ],
  },
  {
    group: 'Agency',
    icon: Building2,
    types: [
      { value: 'agency_email' as TemplateType, label: 'Agency Email' },
      { value: 'agency_linkedin' as TemplateType, label: 'Agency LinkedIn' },
    ],
  },
];

const allTemplateTypes = TEMPLATE_CATEGORIES.flatMap(c => c.types);

function getTemplateTypeLabel(type: string): string {
  return allTemplateTypes.find(t => t.value === type)?.label || type;
}

export default function ManageOutreachTemplatesModal({ isOpen, onClose }: ManageOutreachTemplatesModalProps) {
  const queryClient = useQueryClient();
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<OutreachTemplate | null>(null);

  // Form state
  const [templateType, setTemplateType] = useState<TemplateType>('email_1');
  const [nicheId, setNicheId] = useState<number | null>(null);
  const [situationId, setSituationId] = useState<number | null>(null);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');

  // Filter state
  const [filterType, setFilterType] = useState<string>('all');

  const { data: templates = [], isLoading } = useQuery<OutreachTemplate[]>({
    queryKey: ['outreach-templates'],
    queryFn: () => outreachApi.getTemplates(),
    enabled: isOpen,
  });

  const { data: niches = [] } = useQuery<OutreachNiche[]>({
    queryKey: ['outreach-niches'],
    queryFn: outreachApi.getNiches,
    enabled: isOpen,
  });

  const { data: situations = [] } = useQuery<OutreachSituation[]>({
    queryKey: ['outreach-situations'],
    queryFn: outreachApi.getSituations,
    enabled: isOpen,
  });

  const createMutation = useMutation({
    mutationFn: outreachApi.createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-templates'] });
      toast.success('Template saved');
      resetForm();
      setView('list');
    },
    onError: () => toast.error('Failed to save template'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof outreachApi.updateTemplate>[1] }) =>
      outreachApi.updateTemplate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-templates'] });
      toast.success('Template updated');
      resetForm();
      setView('list');
    },
    onError: () => toast.error('Failed to update template'),
  });

  const deleteMutation = useMutation({
    mutationFn: outreachApi.deleteTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-templates'] });
      toast.success('Template deleted');
      setDeleteId(null);
    },
    onError: () => toast.error('Failed to delete template'),
  });

  const resetForm = () => {
    setTemplateType('email_1');
    setNicheId(null);
    setSituationId(null);
    setSubject('');
    setContent('');
    setEditingTemplate(null);
  };

  const handleEdit = (template: OutreachTemplate) => {
    setEditingTemplate(template);
    setTemplateType(template.template_type);
    setNicheId(template.niche_id);
    setSituationId(template.situation_id);
    setSubject(template.subject || '');
    setContent(template.content);
    setView('edit');
  };

  const handleSubmit = () => {
    if (!content.trim()) {
      toast.error('Template content is required');
      return;
    }
    const data = {
      niche_id: nicheId,
      situation_id: situationId,
      template_type: templateType,
      subject: subject.trim() || null,
      content: content.trim(),
    };
    if (view === 'edit' && editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredTemplates = filterType === 'all'
    ? templates
    : templates.filter(t => t.template_type === filterType);

  // Group templates by type for display
  const groupedTemplates = TEMPLATE_CATEGORIES.map(cat => ({
    ...cat,
    templates: filteredTemplates.filter(t => cat.types.some(ct => ct.value === t.template_type)),
  })).filter(g => g.templates.length > 0);

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (!isOpen) return null;

  const deleteTemplate = templates.find(t => t.id === deleteId);

  const getNicheName = (id: number | null) => {
    if (!id) return 'All Niches';
    return niches.find(n => n.id === id)?.name || `Niche #${id}`;
  };

  const getSituationName = (id: number | null) => {
    if (!id) return 'All Situations';
    return situations.find(s => s.id === id)?.name || `Situation #${id}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-2xl mx-4 border border-stone-600/40 transform transition-all animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
        <div className="p-6 flex-shrink-0">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold text-[--exec-text]">
                {view === 'list' ? 'DM Script Templates' : view === 'edit' ? 'Edit Template' : 'Create Template'}
              </h2>
              <p className="text-sm text-[--exec-text-muted] mt-1">
                {view === 'list'
                  ? 'Manage your outreach message templates'
                  : 'Set the template type, niche/situation scope, and content'}
              </p>
            </div>
            <button
              onClick={() => {
                if (view !== 'list') { resetForm(); setView('list'); }
                else { onClose(); }
              }}
              className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-6 pb-6 overflow-y-auto flex-1">
          {view === 'list' ? (
            <>
              {/* Filter by template type */}
              <div className="flex gap-2 mb-4 flex-wrap">
                <button
                  onClick={() => setFilterType('all')}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
                    filterType === 'all'
                      ? 'bg-[--exec-accent] text-white'
                      : 'bg-stone-800/50 text-[--exec-text-muted] hover:bg-stone-700/50 hover:text-[--exec-text]'
                  )}
                >
                  All ({templates.length})
                </button>
                {TEMPLATE_CATEGORIES.map(cat => {
                  const count = templates.filter(t => cat.types.some(ct => ct.value === t.template_type)).length;
                  if (count === 0) return null;
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.group}
                      onClick={() => setFilterType(cat.types[0].value)}
                      className={cn(
                        'px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5',
                        cat.types.some(t => t.value === filterType)
                          ? 'bg-[--exec-accent] text-white'
                          : 'bg-stone-800/50 text-[--exec-text-muted] hover:bg-stone-700/50 hover:text-[--exec-text]'
                      )}
                    >
                      <Icon className="w-3 h-3" />
                      {cat.group} ({count})
                    </button>
                  );
                })}
              </div>

              {isLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[--exec-accent] mb-3" />
                  <p className="text-sm text-[--exec-text-muted]">Loading templates...</p>
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-10 h-10 text-[--exec-text-muted] mx-auto mb-3" />
                  <p className="text-[--exec-text-secondary] font-medium">No templates yet</p>
                  <p className="text-sm text-[--exec-text-muted] mt-1">Create templates for your outreach scripts</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {groupedTemplates.map(group => {
                    const Icon = group.icon;
                    return (
                      <div key={group.group}>
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="w-3.5 h-3.5 text-[--exec-accent]" />
                          <span className="text-xs font-bold uppercase tracking-wider text-[--exec-text-secondary]">
                            {group.group}
                          </span>
                          <span className="text-[10px] text-[--exec-text-muted]">({group.templates.length})</span>
                        </div>
                        <div className="space-y-2">
                          {group.templates.map((template) => (
                            <div key={template.id} className="flex items-start gap-3 p-3 rounded-xl bg-stone-800/30 border border-stone-700/30 group">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-semibold text-[--exec-accent] bg-[--exec-accent]/10 px-2 py-0.5 rounded">
                                    {getTemplateTypeLabel(template.template_type)}
                                  </span>
                                  <span className="text-[10px] text-[--exec-text-muted]">
                                    {getNicheName(template.niche_id)} &middot; {getSituationName(template.situation_id)}
                                  </span>
                                </div>
                                {template.subject && (
                                  <p className="text-xs font-medium text-[--exec-text-secondary] mb-0.5">
                                    Subject: {template.subject}
                                  </p>
                                )}
                                <p className="text-xs text-[--exec-text-muted] line-clamp-2">
                                  {template.content}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                <button
                                  onClick={() => handleEdit(template)}
                                  className="p-1.5 rounded-md text-[--exec-text-muted] hover:text-[--exec-accent] hover:bg-[--exec-accent]/10 transition-colors"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setDeleteId(template.id)}
                                  className="p-1.5 rounded-md text-[--exec-text-muted] hover:text-[--exec-danger] hover:bg-[--exec-danger]/10 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-stone-700/30">
                <button
                  onClick={() => { resetForm(); setView('create'); }}
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
                {/* Template Type */}
                <div>
                  <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                    Template Type <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={templateType}
                    onChange={(e) => setTemplateType(e.target.value as TemplateType)}
                    className={inputClasses}
                    disabled={view === 'edit'}
                  >
                    {TEMPLATE_CATEGORIES.map(cat => (
                      <optgroup key={cat.group} label={cat.group}>
                        {cat.types.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                {/* Niche & Situation */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                      Niche
                    </label>
                    <select
                      value={nicheId ?? ''}
                      onChange={(e) => setNicheId(e.target.value ? Number(e.target.value) : null)}
                      className={inputClasses}
                    >
                      <option value="">All Niches (default)</option>
                      {niches.map(n => (
                        <option key={n.id} value={n.id}>{n.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                      Situation
                    </label>
                    <select
                      value={situationId ?? ''}
                      onChange={(e) => setSituationId(e.target.value ? Number(e.target.value) : null)}
                      className={inputClasses}
                    >
                      <option value="">All Situations (default)</option>
                      {situations.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <p className="text-[10px] text-[--exec-text-muted] -mt-2">
                  Leave niche/situation as "All" to create a default template. Specific niche+situation combos override defaults.
                </p>

                {/* Subject (for email types) */}
                {templateType.startsWith('email') && (
                  <div>
                    <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                      Subject Line
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className={inputClasses}
                      placeholder="e.g., Quick question about {niche}"
                      maxLength={500}
                    />
                  </div>
                )}

                {/* Content */}
                <div>
                  <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                    Template Content <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className={cn(inputClasses, 'resize-none')}
                    rows={8}
                    placeholder="Hey {name}, I noticed your {niche} business..."
                  />
                  <p className="text-[10px] text-[--exec-text-muted] mt-1">
                    Variables: <code className="bg-stone-700/50 px-1 rounded">{'{name}'}</code> <code className="bg-stone-700/50 px-1 rounded">{'{niche}'}</code>
                  </p>
                </div>
              </div>

              {/* Footer */}
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
                  disabled={!content.trim() || isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-[--exec-accent] rounded-lg hover:bg-[--exec-accent-dark] shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? 'Saving...' : view === 'edit' ? 'Update Template' : 'Create Template'}
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
        message={`Are you sure you want to delete this "${deleteTemplate ? getTemplateTypeLabel(deleteTemplate.template_type) : ''}" template? This cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
