import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coldOutreachApi } from '@/lib/api';
import type { CampaignSearchKeyword } from '@/types';
import {
  Search,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  X,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type FilterMode = 'all' | 'not_searched' | 'searched';

interface Props {
  campaignId: number;
}

export default function CampaignKeywordTracker({ campaignId }: Props) {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  // Add form state
  const [newCategory, setNewCategory] = useState('');
  const [newKeywords, setNewKeywords] = useState('');

  // Leads found editing
  const [editingLeadsId, setEditingLeadsId] = useState<number | null>(null);
  const [editingLeadsValue, setEditingLeadsValue] = useState('');

  const { data: keywords = [] } = useQuery({
    queryKey: ['search-keywords', campaignId],
    queryFn: () => coldOutreachApi.getSearchKeywords(campaignId),
  });

  const bulkCreateMutation = useMutation({
    mutationFn: (data: { category: string; keywords: string[] }) =>
      coldOutreachApi.bulkCreateKeywords(campaignId, data),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['search-keywords', campaignId] });
      toast.success(`Added ${created.length} keywords`);
      setNewCategory('');
      setNewKeywords('');
    },
    onError: () => toast.error('Failed to add keywords'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, leadsFound }: { id: number; leadsFound?: number }) =>
      coldOutreachApi.toggleKeywordSearched(id, leadsFound),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['search-keywords', campaignId] });
    },
    onError: () => toast.error('Failed to toggle keyword'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { leads_found?: number } }) =>
      coldOutreachApi.updateKeyword(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['search-keywords', campaignId] });
    },
    onError: () => toast.error('Failed to update keyword'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => coldOutreachApi.deleteKeyword(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['search-keywords', campaignId] });
    },
    onError: () => toast.error('Failed to delete keyword'),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (category: string) =>
      coldOutreachApi.deleteKeywordCategory(campaignId, category),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['search-keywords', campaignId] });
      toast.success('Category deleted');
    },
    onError: () => toast.error('Failed to delete category'),
  });

  // Computed
  const totalCount = keywords.length;
  const searchedCount = keywords.filter((k) => k.is_searched).length;
  const progressPct = totalCount > 0 ? (searchedCount / totalCount) * 100 : 0;

  const grouped = useMemo(() => {
    const filtered =
      filter === 'all'
        ? keywords
        : filter === 'searched'
          ? keywords.filter((k) => k.is_searched)
          : keywords.filter((k) => !k.is_searched);

    const map = new Map<string, CampaignSearchKeyword[]>();
    for (const kw of filtered) {
      const list = map.get(kw.category) || [];
      list.push(kw);
      map.set(kw.category, list);
    }
    return map;
  }, [keywords, filter]);

  // Category-level stats (from unfiltered keywords)
  const categoryStats = useMemo(() => {
    const map = new Map<string, { total: number; searched: number }>();
    for (const kw of keywords) {
      const s = map.get(kw.category) || { total: 0, searched: 0 };
      s.total++;
      if (kw.is_searched) s.searched++;
      map.set(kw.category, s);
    }
    return map;
  }, [keywords]);

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleAddKeywords = () => {
    const category = newCategory.trim();
    const lines = newKeywords
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (!category) {
      toast.error('Please enter a category');
      return;
    }
    if (lines.length === 0) {
      toast.error('Please enter at least one keyword');
      return;
    }
    bulkCreateMutation.mutate({ category, keywords: lines });
  };

  if (totalCount === 0 && !isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-stone-800/30 border border-stone-700/30 rounded-xl text-[--exec-text-muted] hover:bg-stone-800/50 transition-colors text-sm"
      >
        <Search className="w-4 h-4" />
        <span>Search Keywords</span>
        <span className="text-xs opacity-60">Click to add keywords for this campaign</span>
        <ChevronRight className="w-4 h-4 ml-auto" />
      </button>
    );
  }

  return (
    <div className="bg-stone-800/30 border border-stone-700/30 rounded-xl overflow-hidden">
      {/* Header / collapsed bar */}
      <button
        onClick={() => setIsExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-stone-800/50 transition-colors"
      >
        <Search className="w-4 h-4 text-[--exec-text-muted]" />
        <span className="text-sm font-medium text-[--exec-text]">Search Keywords</span>
        <span className="text-xs text-[--exec-text-muted]">
          {searchedCount}/{totalCount} searched
        </span>
        {/* Progress bar */}
        <div className="flex-1 max-w-[160px] h-1.5 bg-stone-700/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-[--exec-text-muted] ml-auto" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[--exec-text-muted] ml-auto" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Add keywords form */}
          <div className="flex gap-2 items-start">
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Category"
              className={cn(
                'w-40 px-3 py-2 rounded-lg text-sm',
                'bg-stone-800/50 border border-stone-600/40',
                'text-[--exec-text] placeholder:text-[--exec-text-muted]',
                'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
                'transition-all',
              )}
            />
            <textarea
              value={newKeywords}
              onChange={(e) => setNewKeywords(e.target.value)}
              placeholder={'plumber sydney\nelectrician brisbane\n...'}
              rows={2}
              className={cn(
                'flex-1 px-3 py-2 rounded-lg text-sm resize-none',
                'bg-stone-800/50 border border-stone-600/40',
                'text-[--exec-text] placeholder:text-[--exec-text-muted]',
                'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
                'transition-all',
              )}
            />
            <button
              onClick={handleAddKeywords}
              disabled={bulkCreateMutation.isPending}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium',
                'bg-[--exec-accent] text-white hover:bg-[--exec-accent-dark]',
                'transition-all disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-1.5">
            {(['all', 'not_searched', 'searched'] as FilterMode[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                  filter === f
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'text-[--exec-text-muted] hover:bg-stone-700/50',
                )}
              >
                {f === 'all' ? 'All' : f === 'not_searched' ? 'Not Searched' : 'Searched'}
              </button>
            ))}
          </div>

          {/* Grouped keywords */}
          {grouped.size === 0 ? (
            <p className="text-xs text-[--exec-text-muted] text-center py-4">
              {totalCount === 0 ? 'No keywords yet. Add some above.' : 'No keywords match this filter.'}
            </p>
          ) : (
            <div className="space-y-2">
              {Array.from(grouped.entries()).map(([category, items]) => {
                const stats = categoryStats.get(category) || { total: 0, searched: 0 };
                const isCatCollapsed = collapsedCategories.has(category);

                return (
                  <div key={category}>
                    {/* Category header */}
                    <div className="flex items-center gap-2 bg-stone-800/30 rounded-lg px-3 py-2">
                      <button
                        onClick={() => toggleCategory(category)}
                        className="flex items-center gap-2 flex-1 min-w-0"
                      >
                        {isCatCollapsed ? (
                          <ChevronRight className="w-3.5 h-3.5 text-[--exec-text-muted] shrink-0" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-[--exec-text-muted] shrink-0" />
                        )}
                        <span className="text-sm font-medium text-[--exec-text] truncate">
                          {category}
                        </span>
                        <span className="text-xs text-[--exec-text-muted]">
                          {stats.searched}/{stats.total}
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete all keywords in "${category}"?`)) {
                            deleteCategoryMutation.mutate(category);
                          }
                        }}
                        className="p-1 text-[--exec-text-muted] hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Keywords list */}
                    {!isCatCollapsed && (
                      <div className="mt-1 space-y-px pl-2">
                        {items.map((kw) => (
                          <div
                            key={kw.id}
                            className="group flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-stone-700/30 transition-colors"
                          >
                            {/* Checkbox */}
                            <button
                              onClick={() =>
                                toggleMutation.mutate({ id: kw.id })
                              }
                              className={cn(
                                'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                                kw.is_searched
                                  ? 'bg-green-500 border-green-500 text-white'
                                  : 'border-stone-500 hover:border-stone-400',
                              )}
                            >
                              {kw.is_searched && <Check className="w-3 h-3" />}
                            </button>

                            {/* Keyword text */}
                            <span
                              className={cn(
                                'text-sm flex-1 min-w-0 truncate',
                                kw.is_searched
                                  ? 'line-through text-[--exec-text-muted]'
                                  : 'text-[--exec-text]',
                              )}
                            >
                              {kw.keyword}
                            </span>

                            {/* Leads found input (when searched) */}
                            {kw.is_searched && (
                              editingLeadsId === kw.id ? (
                                <input
                                  type="number"
                                  min={0}
                                  autoFocus
                                  value={editingLeadsValue}
                                  onChange={(e) => setEditingLeadsValue(e.target.value)}
                                  onBlur={() => {
                                    const val = parseInt(editingLeadsValue, 10);
                                    if (!isNaN(val) && val !== kw.leads_found) {
                                      updateMutation.mutate({ id: kw.id, data: { leads_found: val } });
                                    }
                                    setEditingLeadsId(null);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      (e.target as HTMLInputElement).blur();
                                    }
                                  }}
                                  className="w-16 px-2 py-0.5 text-xs rounded bg-stone-800/50 border border-stone-600/40 text-[--exec-text] focus:outline-none focus:ring-1 focus:ring-[--exec-accent]/30"
                                />
                              ) : (
                                <button
                                  onClick={() => {
                                    setEditingLeadsId(kw.id);
                                    setEditingLeadsValue(String(kw.leads_found));
                                  }}
                                  className="text-xs text-[--exec-text-muted] hover:text-[--exec-text] px-1.5 py-0.5 rounded hover:bg-stone-700/50 transition-colors"
                                  title="Edit leads found"
                                >
                                  {kw.leads_found} leads
                                </button>
                              )
                            )}

                            {/* Delete */}
                            <button
                              onClick={() => deleteMutation.mutate(kw.id)}
                              className="p-1 text-[--exec-text-muted] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded hover:bg-red-900/20"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
