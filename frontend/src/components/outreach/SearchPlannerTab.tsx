import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { searchPlannerApi } from '@/lib/api';
import {
  Loader2,
  CheckCircle,
  Globe,
  RotateCcw,
  Sparkles,
  Circle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function SearchPlannerTab() {
  const queryClient = useQueryClient();

  // Form state
  const [selectedCountry, setSelectedCountry] = useState('Australia');
  const [plannerNiche, setPlannerNiche] = useState('');
  const [activeNiche, setActiveNiche] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'not_searched' | 'searched'>('all');

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

  // Mark as searched mutation
  const markSearchedMutation = useMutation({
    mutationFn: (comboId: number) => searchPlannerApi.markSearched(comboId, 0),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planner-combinations'] });
      queryClient.invalidateQueries({ queryKey: ['planner-stats'] });
    },
  });

  // Reset mutation
  const resetMutation = useMutation({
    mutationFn: searchPlannerApi.resetCombination,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planner-combinations'] });
      queryClient.invalidateQueries({ queryKey: ['planner-stats'] });
    },
  });

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!plannerNiche.trim()) {
      toast.error('Please enter a business niche');
      return;
    }
    generateMutation.mutate({ country: selectedCountry, niche: plannerNiche.trim() });
  };

  const progressPercent = stats ? Math.round((stats.searched / Math.max(stats.total, 1)) * 100) : 0;

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

      {/* Stats + Progress */}
      {stats && stats.total > 0 && (
        <div className="bento-card p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-[--exec-text]">
                {stats.searched} / {stats.total} searched
              </span>
              <span className="text-sm text-[--exec-text-muted]">
                ({progressPercent}%)
              </span>
            </div>
            <span className={cn(
              'text-xs font-medium px-2.5 py-1 rounded-full',
              progressPercent === 100
                ? 'bg-green-900/30 text-green-400'
                : 'bg-blue-900/30 text-blue-400'
            )}>
              {stats.not_searched} remaining
            </span>
          </div>
          <div className="w-full h-2 bg-stone-700/50 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                progressPercent === 100 ? 'bg-green-500' : 'bg-blue-500'
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Filter Pills */}
      {activeNiche && combinations.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          {([
            { key: 'all' as const, label: 'All', count: combinations.length },
            { key: 'not_searched' as const, label: 'Not Searched', count: combinations.filter(c => !c.is_searched).length },
            { key: 'searched' as const, label: 'Searched', count: combinations.filter(c => c.is_searched).length },
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                      Action
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
                      <td className="px-6 py-3 whitespace-nowrap">
                        {combo.is_searched ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-900/30 text-green-400 border border-green-800">
                            <CheckCircle className="w-3 h-3" />
                            Searched
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-stone-700/50 text-[--exec-text-muted] border border-stone-600/40">
                            <Circle className="w-3 h-3" />
                            Not Searched
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        {combo.searched_at ? (
                          <span className="text-xs text-[--exec-text-muted]">
                            {new Date(combo.searched_at).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-sm text-[--exec-text-muted]">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-right">
                        {combo.is_searched ? (
                          <button
                            onClick={() => resetMutation.mutate(combo.id)}
                            disabled={resetMutation.isPending}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-stone-700/50 rounded-lg transition-colors"
                            title="Mark as not searched"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Undo
                          </button>
                        ) : (
                          <button
                            onClick={() => markSearchedMutation.mutate(combo.id)}
                            disabled={markSearchedMutation.isPending}
                            className={cn(
                              'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
                              'bg-green-600 text-white hover:bg-green-700',
                              'disabled:opacity-50 disabled:cursor-not-allowed'
                            )}
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Mark Searched
                          </button>
                        )}
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
                {statusFilter === 'not_searched' ? 'All combinations searched!' : 'No combinations found'}
              </h3>
              <p className="text-[--exec-text-muted]">
                {statusFilter === 'not_searched'
                  ? 'You\'ve searched all combinations. Try a different niche.'
                  : statusFilter === 'searched'
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
    </div>
  );
}
