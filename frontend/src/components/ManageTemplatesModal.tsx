import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { outreachApi } from '@/lib/api';
import type { OutreachNiche, OutreachSituation, OutreachTemplate } from '@/types';
import { X, Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ManageTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'niches' | 'situations' | 'templates';

export default function ManageTemplatesModal({ isOpen, onClose }: ManageTemplatesModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('templates');
  const [newNiche, setNewNiche] = useState('');
  const [newSituation, setNewSituation] = useState('');
  const [selectedNicheId, setSelectedNicheId] = useState<number | null>(null);
  const [selectedSituationId, setSelectedSituationId] = useState<number | null>(null);
  const [selectedDmNumber, setSelectedDmNumber] = useState(1);
  const [templateContent, setTemplateContent] = useState('');
  const queryClient = useQueryClient();

  const { data: niches = [] } = useQuery<OutreachNiche[]>({
    queryKey: ['outreach-niches'],
    queryFn: outreachApi.getNiches,
  });

  const { data: situations = [] } = useQuery<OutreachSituation[]>({
    queryKey: ['outreach-situations'],
    queryFn: outreachApi.getSituations,
  });

  const { data: templates = [] } = useQuery<OutreachTemplate[]>({
    queryKey: ['outreach-templates'],
    queryFn: () => outreachApi.getTemplates(),
  });

  // Load template when niche/situation/dm_number changes
  const currentTemplate = templates.find(
    (t) => t.niche_id === selectedNicheId && t.situation_id === selectedSituationId && t.dm_number === selectedDmNumber
  );

  const createNicheMutation = useMutation({
    mutationFn: outreachApi.createNiche,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-niches'] });
      setNewNiche('');
      toast.success('Niche added');
    },
    onError: () => toast.error('Failed to add niche'),
  });

  const deleteNicheMutation = useMutation({
    mutationFn: outreachApi.deleteNiche,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-niches'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-templates'] });
      toast.success('Niche deleted');
    },
    onError: () => toast.error('Failed to delete niche'),
  });

  const createSituationMutation = useMutation({
    mutationFn: outreachApi.createSituation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-situations'] });
      setNewSituation('');
      toast.success('Situation added');
    },
    onError: () => toast.error('Failed to add situation'),
  });

  const deleteSituationMutation = useMutation({
    mutationFn: outreachApi.deleteSituation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-situations'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-templates'] });
      toast.success('Situation deleted');
    },
    onError: () => toast.error('Failed to delete situation'),
  });

  const saveTemplateMutation = useMutation({
    mutationFn: outreachApi.createOrUpdateTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-templates'] });
      toast.success('Template saved');
    },
    onError: () => toast.error('Failed to save template'),
  });

  const handleAddNiche = () => {
    if (!newNiche.trim()) return;
    createNicheMutation.mutate({ name: newNiche.trim() });
  };

  const handleAddSituation = () => {
    if (!newSituation.trim()) return;
    createSituationMutation.mutate({ name: newSituation.trim() });
  };

  const handleSaveTemplate = () => {
    if (!selectedNicheId || !selectedSituationId) {
      toast.error('Select a niche and situation first');
      return;
    }
    if (!templateContent.trim()) {
      toast.error('Template cannot be empty');
      return;
    }
    saveTemplateMutation.mutate({
      id: currentTemplate?.id,
      niche_id: selectedNicheId,
      situation_id: selectedSituationId,
      dm_number: selectedDmNumber,
      content: templateContent,
    });
  };

  const handleSelectionChange = (nicheId: number | null, situationId: number | null, dmNumber: number) => {
    setSelectedNicheId(nicheId);
    setSelectedSituationId(situationId);
    setSelectedDmNumber(dmNumber);

    // Load existing template if exists
    if (nicheId && situationId) {
      const existing = templates.find(
        (t) => t.niche_id === nicheId && t.situation_id === situationId && t.dm_number === dmNumber
      );
      setTemplateContent(existing?.content || '');
    } else {
      setTemplateContent('');
    }
  };

  if (!isOpen) return null;

  const inputClasses = cn(
    "w-full px-4 py-2 rounded-lg",
    "bg-stone-800/50 border border-stone-600/40",
    "text-[--exec-text] placeholder:text-[--exec-text-muted]",
    "focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50",
    "transition-all"
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col border border-stone-600/40">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-700/30">
          <h2 className="text-xl font-bold text-[--exec-text]">Manage Templates</h2>
          <button
            onClick={onClose}
            className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-700/30 px-6">
          {(['templates', 'niches', 'situations'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize',
                activeTab === tab
                  ? 'border-[--exec-accent] text-[--exec-accent]'
                  : 'border-transparent text-[--exec-text-muted] hover:text-[--exec-text-secondary]'
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'niches' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newNiche}
                  onChange={(e) => setNewNiche(e.target.value)}
                  placeholder="New niche name (e.g., Fitness)"
                  className={cn(inputClasses, "flex-1")}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNiche()}
                />
                <button
                  onClick={handleAddNiche}
                  disabled={!newNiche.trim() || createNicheMutation.isPending}
                  className="px-4 py-2 bg-[--exec-accent] text-white rounded-lg hover:bg-[--exec-accent-dark] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2">
                {niches.map((niche) => (
                  <div
                    key={niche.id}
                    className="flex items-center justify-between p-3 bg-stone-800/40 rounded-lg"
                  >
                    <span className="text-[--exec-text]">{niche.name}</span>
                    <button
                      onClick={() => deleteNicheMutation.mutate(niche.id)}
                      className="text-[--exec-text-muted] hover:text-red-400 transition-colors p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {niches.length === 0 && (
                  <p className="text-center text-[--exec-text-muted] py-4">
                    No niches yet. Add your first one above.
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'situations' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSituation}
                  onChange={(e) => setNewSituation(e.target.value)}
                  placeholder="New situation (e.g., No Site)"
                  className={cn(inputClasses, "flex-1")}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSituation()}
                />
                <button
                  onClick={handleAddSituation}
                  disabled={!newSituation.trim() || createSituationMutation.isPending}
                  className="px-4 py-2 bg-[--exec-accent] text-white rounded-lg hover:bg-[--exec-accent-dark] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2">
                {situations.map((situation) => (
                  <div
                    key={situation.id}
                    className="flex items-center justify-between p-3 bg-stone-800/40 rounded-lg"
                  >
                    <span className="text-[--exec-text]">{situation.name}</span>
                    <button
                      onClick={() => deleteSituationMutation.mutate(situation.id)}
                      className="text-[--exec-text-muted] hover:text-red-400 transition-colors p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {situations.length === 0 && (
                  <p className="text-center text-[--exec-text-muted] py-4">
                    No situations yet. Add your first one above.
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="space-y-4">
              {niches.length === 0 || situations.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-[--exec-text-muted] mb-4">
                    Add niches and situations first before creating templates.
                  </p>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => setActiveTab('niches')}
                      className="px-4 py-2 bg-[--exec-accent] text-white rounded-lg hover:bg-[--exec-accent-dark]"
                    >
                      Add Niches
                    </button>
                    <button
                      onClick={() => setActiveTab('situations')}
                      className="px-4 py-2 bg-[--exec-accent] text-white rounded-lg hover:bg-[--exec-accent-dark]"
                    >
                      Add Situations
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[--exec-text-secondary] mb-2">
                        Niche
                      </label>
                      <select
                        value={selectedNicheId || ''}
                        onChange={(e) => handleSelectionChange(
                          e.target.value ? Number(e.target.value) : null,
                          selectedSituationId,
                          selectedDmNumber
                        )}
                        className={inputClasses}
                      >
                        <option value="">Select niche</option>
                        {niches.map((niche) => (
                          <option key={niche.id} value={niche.id}>
                            {niche.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[--exec-text-secondary] mb-2">
                        Situation
                      </label>
                      <select
                        value={selectedSituationId || ''}
                        onChange={(e) => handleSelectionChange(
                          selectedNicheId,
                          e.target.value ? Number(e.target.value) : null,
                          selectedDmNumber
                        )}
                        className={inputClasses}
                      >
                        <option value="">Select situation</option>
                        {situations.map((situation) => (
                          <option key={situation.id} value={situation.id}>
                            {situation.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* DM Number Selection */}
                  <div>
                    <label className="block text-sm font-medium text-[--exec-text-secondary] mb-2">
                      DM Number
                    </label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((num) => (
                        <button
                          key={num}
                          onClick={() => handleSelectionChange(selectedNicheId, selectedSituationId, num)}
                          className={cn(
                            'w-10 h-10 rounded-lg border transition-all font-bold',
                            selectedDmNumber === num
                              ? 'bg-[--exec-accent] text-white border-[--exec-accent]'
                              : 'bg-stone-800/50 text-[--exec-text-secondary] border-stone-600/40 hover:border-[--exec-accent]/50'
                          )}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[--exec-text-secondary] mb-2">
                      Template Script
                    </label>
                    <div className="text-xs text-[--exec-text-muted] mb-2 space-y-1">
                      <p className="font-medium text-[--exec-text-secondary]">Available variables:</p>
                      <div className="flex flex-wrap gap-2">
                        <code className="px-1.5 py-0.5 bg-stone-700/50 rounded">{'{name}'}</code>
                        <code className="px-1.5 py-0.5 bg-stone-700/50 rounded">{'{company}'}</code>
                        <code className="px-1.5 py-0.5 bg-stone-700/50 rounded">{'{city}'}</code>
                        <code className="px-1.5 py-0.5 bg-stone-700/50 rounded">{'{niche}'}</code>
                        <code className="px-1.5 py-0.5 bg-stone-700/50 rounded">{'{issue1}'}</code>
                        <code className="px-1.5 py-0.5 bg-stone-700/50 rounded">{'{issue2}'}</code>
                        <code className="px-1.5 py-0.5 bg-stone-700/50 rounded">{'{issue3}'}</code>
                      </div>
                    </div>
                    <textarea
                      value={templateContent}
                      onChange={(e) => setTemplateContent(e.target.value)}
                      placeholder={selectedNicheId && selectedSituationId
                        ? "Enter your script template here...\n\nExample:\nHey {name}! I came across your {niche} content and love what you're doing..."
                        : "Select a niche and situation first"}
                      disabled={!selectedNicheId || !selectedSituationId}
                      rows={8}
                      className={cn(inputClasses, "resize-none disabled:opacity-50 disabled:cursor-not-allowed")}
                    />
                  </div>

                  <button
                    onClick={handleSaveTemplate}
                    disabled={!selectedNicheId || !selectedSituationId || !templateContent.trim() || saveTemplateMutation.isPending}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 px-4 py-3 text-white rounded-lg transition-colors",
                      "bg-[--exec-accent] hover:bg-[--exec-accent-dark]",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    <Save className="w-5 h-5" />
                    {saveTemplateMutation.isPending ? 'Saving...' : currentTemplate ? 'Update Template' : 'Save Template'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
