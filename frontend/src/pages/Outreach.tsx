import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { outreachApi } from '@/lib/api';
import { Copy, Check, UserPlus, Settings2, Send } from 'lucide-react';
import { toast } from 'sonner';
import ManageTemplatesModal from '@/components/ManageTemplatesModal';
import { cn } from '@/lib/utils';

export default function Outreach() {
  const [name, setName] = useState('');
  const [selectedNicheId, setSelectedNicheId] = useState<number | null>(null);
  const [selectedSituationId, setSelectedSituationId] = useState<number | null>(null);
  const [selectedDmNumber, setSelectedDmNumber] = useState(1);
  const [copied, setCopied] = useState(false);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: niches = [] } = useQuery({
    queryKey: ['outreach-niches'],
    queryFn: outreachApi.getNiches,
  });

  const { data: situations = [] } = useQuery({
    queryKey: ['outreach-situations'],
    queryFn: outreachApi.getSituations,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['outreach-templates'],
    queryFn: () => outreachApi.getTemplates(),
  });

  const addToPipelineMutation = useMutation({
    mutationFn: outreachApi.addToPipeline,
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      setName('');
    },
    onError: () => {
      toast.error('Failed to add to pipeline');
    },
  });

  // Find the template for current niche + situation + dm_number
  const currentTemplate = templates.find(
    (t) => t.niche_id === selectedNicheId && t.situation_id === selectedSituationId && t.dm_number === selectedDmNumber
  );

  const selectedNiche = niches.find((n) => n.id === selectedNicheId);
  const selectedSituation = situations.find((s) => s.id === selectedSituationId);

  // Replace variables in template
  const getProcessedScript = () => {
    if (!currentTemplate) return '';
    let script = currentTemplate.content;
    script = script.replace(/\{name\}/g, name || '[name]');
    script = script.replace(/\{niche\}/g, selectedNiche?.name || '[niche]');
    return script;
  };

  const handleCopy = async () => {
    const script = getProcessedScript();
    if (!script) {
      toast.error('No script to copy');
      return;
    }
    await navigator.clipboard.writeText(script);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddToPipeline = () => {
    if (!name.trim()) {
      toast.error('Please enter a name');
      return;
    }
    if (!selectedNiche || !selectedSituation) {
      toast.error('Please select a niche and situation');
      return;
    }
    addToPipelineMutation.mutate({
      name: name.trim(),
      niche: selectedNiche.name,
      situation: selectedSituation.name,
    });
  };

  const processedScript = getProcessedScript();

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      {/* Header */}
      <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-b border-gray-200/60 dark:border-gray-700 px-8 py-6 sticky top-0 z-10 transition-colors duration-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">
              Outreach
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Quick cold DM scripts for TikTok outreach
            </p>
          </div>
          <button
            onClick={() => setIsManageOpen(true)}
            className="flex items-center px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm hover:shadow-md font-medium text-sm"
          >
            <Settings2 className="w-4 h-4 mr-2" />
            Manage Templates
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-8">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Name Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Name / Handle
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="@username or Name"
                className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900 dark:text-white placeholder-gray-400"
              />
            </div>

            {/* Niche Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Niche
              </label>
              {niches.length > 0 ? (
                <select
                  value={selectedNicheId || ''}
                  onChange={(e) => setSelectedNicheId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900 dark:text-white"
                >
                  <option value="">Select a niche</option>
                  {niches.map((niche) => (
                    <option key={niche.id} value={niche.id}>
                      {niche.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-3">
                  No niches yet.{' '}
                  <button
                    onClick={() => setIsManageOpen(true)}
                    className="text-blue-600 hover:underline"
                  >
                    Add one
                  </button>
                </p>
              )}
            </div>

            {/* Situation Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Situation
              </label>
              {situations.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {situations.map((situation) => (
                    <button
                      key={situation.id}
                      onClick={() => setSelectedSituationId(situation.id)}
                      className={cn(
                        'px-4 py-2 rounded-xl border transition-all font-medium text-sm',
                        selectedSituationId === situation.id
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
                      )}
                    >
                      {situation.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-3">
                  No situations yet.{' '}
                  <button
                    onClick={() => setIsManageOpen(true)}
                    className="text-blue-600 hover:underline"
                  >
                    Add one
                  </button>
                </p>
              )}
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
                    onClick={() => setSelectedDmNumber(num)}
                    className={cn(
                      'w-12 h-12 rounded-xl border transition-all font-bold text-lg',
                      selectedDmNumber === num
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
                    )}
                  >
                    {num}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Select which DM in your sequence (1st contact, 2nd follow-up, etc.)
              </p>
            </div>

            {/* Script Preview */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Script Preview
              </label>
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 min-h-[150px]">
                {processedScript ? (
                  <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                    {processedScript}
                  </p>
                ) : selectedNicheId && selectedSituationId ? (
                  <p className="text-gray-400 dark:text-gray-500 italic">
                    No template for this combination.{' '}
                    <button
                      onClick={() => setIsManageOpen(true)}
                      className="text-blue-600 hover:underline"
                    >
                      Create one
                    </button>
                  </p>
                ) : (
                  <p className="text-gray-400 dark:text-gray-500 italic">
                    Select a niche and situation to see the script
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleCopy}
                disabled={!processedScript}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all',
                  processedScript
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                )}
              >
                {copied ? (
                  <>
                    <Check className="w-5 h-5" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    Copy Script
                  </>
                )}
              </button>
              <button
                onClick={handleAddToPipeline}
                disabled={!name.trim() || !selectedNicheId || !selectedSituationId || addToPipelineMutation.isPending}
                className={cn(
                  'flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all',
                  name.trim() && selectedNicheId && selectedSituationId
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                )}
              >
                <UserPlus className="w-5 h-5" />
                {addToPipelineMutation.isPending ? 'Adding...' : 'Add to Pipeline'}
              </button>
            </div>

            {/* Quick Stats */}
            {niches.length > 0 && situations.length > 0 && (
              <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-xl">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Send className="w-4 h-4" />
                  <span>
                    {templates.length} templates configured for {niches.length} niches and {situations.length} situations
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

      {/* Manage Templates Modal */}
      <ManageTemplatesModal
        isOpen={isManageOpen}
        onClose={() => setIsManageOpen(false)}
      />
    </div>
  );
}
