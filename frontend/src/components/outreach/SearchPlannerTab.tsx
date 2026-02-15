import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { searchPlannerApi } from '@/lib/api';
import {
  Loader2,
  CheckCircle,
  Globe,
  RotateCcw,
  Sparkles,
  Circle,
  Linkedin,
  Search,
  X,
  Users,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function SearchPlannerTab() {
  const queryClient = useQueryClient();

  // Form state
  const [selectedCountry, setSelectedCountry] = useState('Australia');
  const [plannerNiche, setPlannerNiche] = useState('');
  const [activeNiche, setActiveNiche] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'not_searched' | 'searched' | 'linkedin_not_searched' | 'linkedin_searched'>('all');

  // Mark searched modal state
  const [markModal, setMarkModal] = useState<{ comboId: number; city: string; platform: 'google' | 'linkedin' } | null>(null);
  const [leadsCount, setLeadsCount] = useState('0');
  const leadsInputRef = useRef<HTMLInputElement>(null);

  // Fetch countries
  const { data: countries = [] } = useQuery({
    queryKey: ['planner-countries'],
    queryFn: searchPlannerApi.getCountries,
  });

  // Fetch existing niches for selected country
  const { data: existingNiches = [] } = useQuery({
    queryKey: ['planner-niches', selectedCountry],
    queryFn: () => searchPlannerApi.getNiches(selectedCountry),
  });

  // Auto-select first niche when niches load and none is active
  useEffect(() => {
    if (!activeNiche && existingNiches.length > 0) {
      setActiveNiche(existingNiches[0]);
    }
  }, [existingNiches, activeNiche]);

  // Reset activeNiche when country changes (will re-select from new niches)
  const handleCountryChange = (country: string) => {
    setSelectedCountry(country);
    setActiveNiche('');
  };

  // Fetch combinations
  const { data: combinations = [], isLoading: isLoadingCombos } = useQuery({
    queryKey: ['planner-combinations', selectedCountry, activeNiche],
    queryFn: () => searchPlannerApi.getCombinations({
      country: selectedCountry,
      niche: activeNiche || undefined,
    }),
    enabled: !!activeNiche,
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['planner-stats', selectedCountry, activeNiche],
    queryFn: () => searchPlannerApi.getStats({
      country: selectedCountry,
      niche: activeNiche || undefined,
    }),
    enabled: !!activeNiche,
  });

  // Filtered combinations
  const filteredCombos = useMemo(() => {
    if (statusFilter === 'searched') return combinations.filter(c => c.is_searched);
    if (statusFilter === 'not_searched') return combinations.filter(c => !c.is_searched);
    if (statusFilter === 'linkedin_searched') return combinations.filter(c => c.linkedin_searched);
    if (statusFilter === 'linkedin_not_searched') return combinations.filter(c => !c.linkedin_searched);
    return combinations;
  }, [combinations, statusFilter]);

  // Generate mutation
  const generateMutation = useMutation({
    mutationFn: searchPlannerApi.generateCombinations,
    onSuccess: (data) => {
      const niche = plannerNiche.trim();
      setActiveNiche(niche);
      setPlannerNiche('');
      if (data.created > 0) {
        toast.success(`Generated ${data.created} combinations for ${niche} in ${selectedCountry}`);
      } else {
        toast.info(`All ${data.already_existed} combinations already exist`);
      }
      queryClient.invalidateQueries({ queryKey: ['planner-niches'] });
      queryClient.invalidateQueries({ queryKey: ['planner-combinations'] });
      queryClient.invalidateQueries({ queryKey: ['planner-stats'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to generate combinations');
    },
  });

  // Google mark as searched mutation
  const markSearchedMutation = useMutation({
    mutationFn: ({ comboId, leadsFound }: { comboId: number; leadsFound: number }) =>
      searchPlannerApi.markSearched(comboId, leadsFound),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planner-combinations'] });
      queryClient.invalidateQueries({ queryKey: ['planner-stats'] });
    },
  });

  // Google reset mutation
  const resetMutation = useMutation({
    mutationFn: searchPlannerApi.resetCombination,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planner-combinations'] });
      queryClient.invalidateQueries({ queryKey: ['planner-stats'] });
    },
  });

  // LinkedIn mark as searched mutation
  const markLinkedinSearchedMutation = useMutation({
    mutationFn: ({ comboId, leadsFound }: { comboId: number; leadsFound: number }) =>
      searchPlannerApi.markLinkedinSearched(comboId, leadsFound),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planner-combinations'] });
      queryClient.invalidateQueries({ queryKey: ['planner-stats'] });
    },
  });

  // LinkedIn reset mutation
  const resetLinkedinMutation = useMutation({
    mutationFn: searchPlannerApi.resetLinkedinCombination,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planner-combinations'] });
      queryClient.invalidateQueries({ queryKey: ['planner-stats'] });
    },
  });

  const openMarkModal = (comboId: number, city: string, platform: 'google' | 'linkedin') => {
    setMarkModal({ comboId, city, platform });
    setLeadsCount('0');
    setTimeout(() => leadsInputRef.current?.select(), 50);
  };

  const handleMarkSearched = () => {
    if (!markModal) return;
    const count = parseInt(leadsCount) || 0;
    if (markModal.platform === 'google') {
      markSearchedMutation.mutate({ comboId: markModal.comboId, leadsFound: count });
    } else {
      markLinkedinSearchedMutation.mutate({ comboId: markModal.comboId, leadsFound: count });
    }
    setMarkModal(null);
  };

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!plannerNiche.trim()) {
      toast.error('Please enter a business niche');
      return;
    }
    generateMutation.mutate({ country: selectedCountry, niche: plannerNiche.trim() });
  };

  const googlePercent = stats ? Math.round((stats.searched / Math.max(stats.total, 1)) * 100) : 0;
  const linkedinPercent = stats ? Math.round((stats.linkedin_searched / Math.max(stats.total, 1)) * 100) : 0;

  return (
    <div>
      {/* Generate Form */}
      <div className="bento-card p-6 mb-6">
        <form onSubmit={handleGenerate}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Country Select */}
            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Country
              </label>
              <select
                value={selectedCountry}
                onChange={(e) => handleCountryChange(e.target.value)}
                className={cn(
                  'w-full px-4 py-2.5',
                  'bg-stone-800/50 border border-stone-600/40 rounded-xl',
                  'text-[--exec-text]',
                  'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
                  'transition-all duration-200'
                )}
              >
                {countries.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Niche Input */}
            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Add New Niche
              </label>
              <input
                type="text"
                value={plannerNiche}
                onChange={(e) => setPlannerNiche(e.target.value)}
                placeholder="e.g., Roofing, Plumbing, Landscaping..."
                className={cn(
                  'w-full px-4 py-2.5',
                  'bg-stone-800/50 border border-stone-600/40 rounded-xl',
                  'text-[--exec-text]',
                  'placeholder:text-[--exec-text-muted]',
                  'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
                  'transition-all duration-200'
                )}
              />
            </div>

            {/* Generate Button */}
            <div className="flex items-end">
              <button
                type="submit"
                disabled={generateMutation.isPending || !plannerNiche.trim()}
                className={cn(
                  'w-full flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl',
                  'text-white font-medium',
                  'transition-all duration-200',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'hover:brightness-110 hover:shadow-lg',
                )}
                style={{ backgroundColor: 'var(--exec-accent)' }}
              >
                {generateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Generate Combinations
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Niche Selector — shows existing niches as pills */}
      {existingNiches.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider mr-1">
            Niches:
          </span>
          {existingNiches.map((niche) => (
            <button
              key={niche}
              onClick={() => { setActiveNiche(niche); setStatusFilter('all'); }}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200',
                activeNiche === niche
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-stone-800/50 text-[--exec-text-muted] hover:bg-stone-700/50 hover:text-[--exec-text-secondary]'
              )}
            >
              {niche}
            </button>
          ))}
        </div>
      )}

      {/* Stats + Progress - dual bars for Google and LinkedIn */}
      {stats && stats.total > 0 && (
        <div className="bento-card p-5 mb-4">
          <div className="space-y-3">
            {/* Google progress */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-sm font-medium text-[--exec-text]">
                    Google: {stats.searched} / {stats.total}
                  </span>
                  <span className="text-xs text-[--exec-text-muted]">
                    ({googlePercent}%)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {stats.total_leads_found > 0 && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-900/30 text-blue-400">
                      <Users className="w-3 h-3 inline mr-1" />{stats.total_leads_found} leads
                    </span>
                  )}
                  <span className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded-full',
                    googlePercent === 100
                      ? 'bg-green-900/30 text-green-400'
                      : 'bg-blue-900/30 text-blue-400'
                  )}>
                    {stats.not_searched} remaining
                  </span>
                </div>
              </div>
              <div className="w-full h-2 bg-stone-700/50 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    googlePercent === 100 ? 'bg-green-500' : 'bg-blue-500'
                  )}
                  style={{ width: `${googlePercent}%` }}
                />
              </div>
            </div>

            {/* LinkedIn progress */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Linkedin className="w-3.5 h-3.5 text-sky-400" />
                  <span className="text-sm font-medium text-[--exec-text]">
                    LinkedIn: {stats.linkedin_searched} / {stats.total}
                  </span>
                  <span className="text-xs text-[--exec-text-muted]">
                    ({linkedinPercent}%)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {stats.linkedin_leads_found > 0 && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-sky-900/30 text-sky-400">
                      <Users className="w-3 h-3 inline mr-1" />{stats.linkedin_leads_found} leads
                    </span>
                  )}
                  <span className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded-full',
                    linkedinPercent === 100
                      ? 'bg-green-900/30 text-green-400'
                      : 'bg-sky-900/30 text-sky-400'
                  )}>
                    {stats.linkedin_not_searched} remaining
                  </span>
                </div>
              </div>
              <div className="w-full h-2 bg-stone-700/50 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    linkedinPercent === 100 ? 'bg-green-500' : 'bg-sky-500'
                  )}
                  style={{ width: `${linkedinPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Pills */}
      {activeNiche && combinations.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {([
            { key: 'all' as const, label: 'All', count: combinations.length },
            { key: 'not_searched' as const, label: 'Google: Not Searched', count: combinations.filter(c => !c.is_searched).length },
            { key: 'searched' as const, label: 'Google: Searched', count: combinations.filter(c => c.is_searched).length },
            { key: 'linkedin_not_searched' as const, label: 'LinkedIn: Not Searched', count: combinations.filter(c => !c.linkedin_searched).length },
            { key: 'linkedin_searched' as const, label: 'LinkedIn: Searched', count: combinations.filter(c => c.linkedin_searched).length },
          ]).map((filter) => (
            <button
              key={filter.key}
              onClick={() => setStatusFilter(filter.key)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200',
                statusFilter === filter.key
                  ? 'bg-blue-600 text-white'
                  : 'text-[--exec-text-muted] hover:bg-stone-700/50'
              )}
            >
              {filter.label}
              <span className="ml-1.5 text-xs opacity-70">{filter.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Combinations Table */}
      {activeNiche && (
        <div className="bento-card overflow-hidden">
          {isLoadingCombos ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : filteredCombos.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[--exec-border]">
                <thead className="bg-[--exec-surface-alt]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                      City
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        <Search className="w-3 h-3" />
                        Google
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        <Linkedin className="w-3 h-3" />
                        LinkedIn
                      </div>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-[--exec-surface] divide-y divide-[--exec-border-subtle]">
                  {filteredCombos.map((combo) => (
                    <tr
                      key={combo.id}
                      className="hover:bg-[--exec-surface-alt] transition-colors"
                    >
                      <td className="px-6 py-3 whitespace-nowrap">
                        <span className="text-sm font-medium text-[--exec-text]">
                          {combo.city}
                        </span>
                      </td>

                      {/* Google Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {combo.is_searched ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-900/30 text-green-400 border border-green-800">
                              <CheckCircle className="w-3 h-3" />
                              {combo.leads_found > 0 ? `${combo.leads_found} leads` : 'Done'}
                            </span>
                            {combo.searched_at && (
                              <span className="block text-[10px] text-[--exec-text-muted] mt-0.5">
                                {new Date(combo.searched_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-stone-700/50 text-[--exec-text-muted] border border-stone-600/40">
                            <Circle className="w-3 h-3" />
                            Pending
                          </span>
                        )}
                      </td>

                      {/* LinkedIn Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {combo.linkedin_searched ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-900/30 text-green-400 border border-green-800">
                              <CheckCircle className="w-3 h-3" />
                              {combo.linkedin_leads_found > 0 ? `${combo.linkedin_leads_found} leads` : 'Done'}
                            </span>
                            {combo.linkedin_searched_at && (
                              <span className="block text-[10px] text-[--exec-text-muted] mt-0.5">
                                {new Date(combo.linkedin_searched_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-stone-700/50 text-[--exec-text-muted] border border-stone-600/40">
                            <Circle className="w-3 h-3" />
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Google action */}
                          {combo.is_searched ? (
                            <button
                              onClick={() => resetMutation.mutate(combo.id)}
                              disabled={resetMutation.isPending}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-stone-700/50 rounded-lg transition-colors"
                              title="Reset Google search"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Google
                            </button>
                          ) : (
                            <button
                              onClick={() => openMarkModal(combo.id, combo.city, 'google')}
                              className={cn(
                                'inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium rounded-lg transition-all',
                                'bg-blue-600 text-white hover:bg-blue-700',
                              )}
                            >
                              <Search className="w-3 h-3" />
                              Google
                            </button>
                          )}

                          {/* LinkedIn action */}
                          {combo.linkedin_searched ? (
                            <button
                              onClick={() => resetLinkedinMutation.mutate(combo.id)}
                              disabled={resetLinkedinMutation.isPending}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-stone-700/50 rounded-lg transition-colors"
                              title="Reset LinkedIn search"
                            >
                              <RotateCcw className="w-3 h-3" />
                              LinkedIn
                            </button>
                          ) : (
                            <button
                              onClick={() => openMarkModal(combo.id, combo.city, 'linkedin')}
                              className={cn(
                                'inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium rounded-lg transition-all',
                                'bg-sky-600 text-white hover:bg-sky-700',
                              )}
                            >
                              <Linkedin className="w-3 h-3" />
                              LinkedIn
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center">
              <Globe className="w-12 h-12 text-[--exec-text-muted] mx-auto mb-4" />
              <h3 className="text-lg font-medium text-[--exec-text] mb-2">
                {statusFilter === 'not_searched' || statusFilter === 'linkedin_not_searched'
                  ? 'All combinations searched!'
                  : 'No combinations found'}
              </h3>
              <p className="text-[--exec-text-muted]">
                {statusFilter === 'not_searched' || statusFilter === 'linkedin_not_searched'
                  ? 'You\'ve searched all combinations. Try a different niche.'
                  : statusFilter === 'searched' || statusFilter === 'linkedin_searched'
                  ? 'No searched combinations yet. Start searching!'
                  : 'Enter a niche and generate combinations to get started.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Empty State - No niches exist yet */}
      {!activeNiche && existingNiches.length === 0 && (
        <div className="bento-card p-12 text-center">
          <Sparkles className="w-12 h-12 text-[--exec-text-muted] mx-auto mb-4" />
          <h3 className="text-lg font-medium text-[--exec-text] mb-2">
            Plan your lead searches
          </h3>
          <p className="text-[--exec-text-muted]">
            Select a country and enter a business niche to generate all city combinations.
            Then work through them systematically.
          </p>
        </div>
      )}

      {/* Mark as Searched Modal */}
      {markModal && createPortal(
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200"
          onClick={() => setMarkModal(null)}
        >
          <div
            className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-sm mx-4 border border-stone-600/40 transform transition-all animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-[--exec-text]">
                    Mark as Searched
                  </h2>
                  <p className="text-sm text-[--exec-text-muted] mt-1">
                    {markModal.city} — {markModal.platform === 'google' ? 'Google' : 'LinkedIn'}
                  </p>
                </div>
                <button
                  onClick={() => setMarkModal(null)}
                  className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleMarkSearched(); }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                    Leads Found
                  </label>
                  <input
                    ref={leadsInputRef}
                    type="number"
                    min="0"
                    value={leadsCount}
                    onChange={(e) => setLeadsCount(e.target.value)}
                    className={cn(
                      'w-full px-4 py-2.5 rounded-lg',
                      'bg-stone-800/50 border border-stone-600/40',
                      'text-[--exec-text] placeholder:text-[--exec-text-muted]',
                      'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
                      'transition-all text-sm'
                    )}
                    placeholder="0"
                  />
                  <p className="text-xs text-[--exec-text-muted] mt-1">
                    How many leads did you find from this search?
                  </p>
                </div>

                <div className="flex gap-3 justify-end pt-4 border-t border-stone-700/30">
                  <button
                    type="button"
                    onClick={() => setMarkModal(null)}
                    className="px-4 py-2 text-sm font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={cn(
                      'px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm hover:shadow-md transition-all',
                      markModal.platform === 'google'
                        ? 'bg-blue-600 hover:bg-blue-700'
                        : 'bg-sky-600 hover:bg-sky-700'
                    )}
                  >
                    {markModal.platform === 'google' ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Search className="w-3.5 h-3.5" />
                        Mark Google Searched
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <Linkedin className="w-3.5 h-3.5" />
                        Mark LinkedIn Searched
                      </span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
