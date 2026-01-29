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

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Manage Templates</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-6">
          {(['templates', 'niches', 'situations'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize',
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
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
                  className="flex-1 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-gray-900 dark:text-white"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNiche()}
                />
                <button
                  onClick={handleAddNiche}
                  disabled={!newNiche.trim() || createNicheMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2">
                {niches.map((niche) => (
                  <div
                    key={niche.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <span className="text-gray-900 dark:text-white">{niche.name}</span>
                    <button
                      onClick={() => deleteNicheMutation.mutate(niche.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {niches.length === 0 && (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-4">
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
                  className="flex-1 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-gray-900 dark:text-white"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSituation()}
                />
                <button
                  onClick={handleAddSituation}
                  disabled={!newSituation.trim() || createSituationMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2">
                {situations.map((situation) => (
                  <div
                    key={situation.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <span className="text-gray-900 dark:text-white">{situation.name}</span>
                    <button
                      onClick={() => deleteSituationMutation.mutate(situation.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {situations.length === 0 && (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-4">
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
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    Add niches and situations first before creating templates.
                  </p>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => setActiveTab('niches')}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Add Niches
                    </button>
                    <button
                      onClick={() => setActiveTab('situations')}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Add Situations
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Niche
                      </label>
                      <select
                        value={selectedNicheId || ''}
                        onChange={(e) => handleSelectionChange(
                          e.target.value ? Number(e.target.value) : null,
                          selectedSituationId,
                          selectedDmNumber
                        )}
                        className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-gray-900 dark:text-white"
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Situation
                      </label>
                      <select
                        value={selectedSituationId || ''}
                        onChange={(e) => handleSelectionChange(
                          selectedNicheId,
                          e.target.value ? Number(e.target.value) : null,
                          selectedDmNumber
                        )}
                        className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-gray-900 dark:text-white"
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
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-300'
                          )}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Template Script
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      Use {'{name}'} and {'{niche}'} as placeholders
                    </p>
                    <textarea
                      value={templateContent}
                      onChange={(e) => setTemplateContent(e.target.value)}
                      placeholder={selectedNicheId && selectedSituationId
                        ? "Enter your script template here...\n\nExample:\nHey {name}! I came across your {niche} content and love what you're doing..."
                        : "Select a niche and situation first"}
                      disabled={!selectedNicheId || !selectedSituationId}
                      rows={8}
                      className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed resize-none"
                    />
                  </div>

                  <button
                    onClick={handleSaveTemplate}
                    disabled={!selectedNicheId || !selectedSituationId || !templateContent.trim() || saveTemplateMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
