import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadDiscoveryApi, coldOutreachApi, StoredLead } from '@/lib/api';
import type {
  DiscoveredLead,
  LeadSearchResponse,
  OutreachCampaign,
} from '@/types';
import {
  Search,
  Briefcase,
  MapPin,
  Globe,
  Mail,
  User,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Users,
  X,
  Pencil,
  Check,
  Database,
  UserPlus,
  Trash2,
  Calendar,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import SendDMPanel, { type SendDMSource } from '@/components/outreach/SendDMPanel';

// Loading messages that rotate
const LOADING_MESSAGES = [
  { text: 'Searching Google for matches...', icon: Search },
  { text: 'Scanning agency websites...', icon: Globe },
  { text: 'Extracting contact details...', icon: Mail },
  { text: 'Formatting lead data...', icon: Users },
];

// Email validation badge
function EmailBadge({ lead }: { lead: DiscoveredLead }) {
  if (!lead.email) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
        <XCircle className="w-3 h-3" />
        Not found
      </span>
    );
  }

  if (lead.is_duplicate) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
        <AlertCircle className="w-3 h-3" />
        Exists
      </span>
    );
  }

  if (lead.is_valid_email) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
        <CheckCircle className="w-3 h-3" />
        Valid
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
      <XCircle className="w-3 h-3" />
      Invalid
    </span>
  );
}

// Campaign selection modal
function CampaignSelectModal({
  isOpen,
  onClose,
  campaigns,
  validCount,
  onSelect,
  isImporting,
}: {
  isOpen: boolean;
  onClose: () => void;
  campaigns: OutreachCampaign[];
  validCount: number;
  onSelect: (campaignId: number) => void;
  isImporting: boolean;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(
    campaigns.length > 0 ? campaigns[0].id : null
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-stone-600/40">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-700/30">
          <h2 className="text-lg font-bold text-[--exec-text]">
            Add Leads to Campaign
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-stone-700/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {campaigns.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="w-12 h-12 text-[--exec-text-muted] mx-auto mb-3" />
              <p className="text-[--exec-text-secondary]">
                No campaigns found. Create a campaign first.
              </p>
            </div>
          ) : (
            <>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-2">
                Select Campaign
              </label>
              <select
                value={selectedId || ''}
                onChange={(e) => setSelectedId(Number(e.target.value))}
                className={cn(
                  'w-full px-4 py-2.5',
                  'bg-stone-800/50 border border-stone-600/40 rounded-xl',
                  'text-[--exec-text]',
                  'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
                  'transition-all duration-200'
                )}
              >
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>

              <p className="mt-4 text-sm text-[--exec-text-secondary]">
                <span className="font-semibold text-[--exec-text]">
                  {validCount}
                </span>{' '}
                leads will be added
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 justify-end px-6 py-4 border-t border-stone-700/30">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[--exec-text-secondary] bg-stone-700/50 rounded-xl hover:bg-stone-600/50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => selectedId && onSelect(selectedId)}
            disabled={!selectedId || isImporting || campaigns.length === 0}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200',
              'bg-[--exec-accent] text-white',
              'hover:bg-[--exec-accent-dark]',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isImporting && <Loader2 className="w-4 h-4 animate-spin" />}
            Add to Campaign
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LeadDiscoveryTab() {
  const queryClient = useQueryClient();

  // Tab state
  const [activeSubTab, setActiveSubTab] = useState<'search' | 'saved'>('search');

  // Form state
  const [niche, setNiche] = useState('');
  const [location, setLocation] = useState('');
  const [count, setCount] = useState(10);

  // Results state
  const [results, setResults] = useState<LeadSearchResponse | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Editing state (for search results)
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    email: '',
    contact_name: '',
    website: '',
    niche: '',
  });

  // Editing state (for saved leads)
  const [editingSavedId, setEditingSavedId] = useState<number | null>(null);
  const [savedEditForm, setSavedEditForm] = useState({
    agency_name: '',
    contact_name: '',
    email: '',
    website: '',
    niche: '',
  });

  // Bulk selection state (for saved leads)
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<number>>(new Set());

  // Send DM panel state
  const [isSendDMPanelOpen, setIsSendDMPanelOpen] = useState(false);
  const [selectedLeadForDM, setSelectedLeadForDM] = useState<SendDMSource | null>(null);

  // Fetch campaigns for the modal
  const { data: campaigns = [] } = useQuery<OutreachCampaign[]>({
    queryKey: ['outreach-campaigns'],
    queryFn: coldOutreachApi.getCampaigns,
  });

  // Fetch stored leads
  const { data: storedLeadsData, isLoading: isLoadingStored } = useQuery({
    queryKey: ['stored-leads'],
    queryFn: () => leadDiscoveryApi.getStoredLeads({ limit: 200 }),
    enabled: activeSubTab === 'saved',
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['lead-discovery-stats'],
    queryFn: leadDiscoveryApi.getStats,
  });

  // Convert to contact mutation
  const convertMutation = useMutation({
    mutationFn: leadDiscoveryApi.convertToContact,
    onSuccess: (data) => {
      toast.success(`Converted to contact: ${data.contact.name}`);
      queryClient.invalidateQueries({ queryKey: ['stored-leads'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to convert lead');
    },
  });

  // Delete stored lead mutation
  const deleteMutation = useMutation({
    mutationFn: leadDiscoveryApi.deleteStoredLead,
    onSuccess: () => {
      toast.success('Lead deleted');
      queryClient.invalidateQueries({ queryKey: ['stored-leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-discovery-stats'] });
    },
    onError: () => {
      toast.error('Failed to delete lead');
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: leadDiscoveryApi.bulkDeleteStoredLeads,
    onSuccess: (data) => {
      toast.success(`${data.deleted_count} leads deleted`);
      setSelectedLeadIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['stored-leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-discovery-stats'] });
    },
    onError: () => {
      toast.error('Failed to delete leads');
    },
  });

  // Update stored lead mutation
  const updateStoredMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { agency_name?: string; contact_name?: string; email?: string; website?: string; niche?: string } }) =>
      leadDiscoveryApi.updateStoredLead(id, data),
    onSuccess: () => {
      toast.success('Lead updated');
      setEditingSavedId(null);
      queryClient.invalidateQueries({ queryKey: ['stored-leads'] });
    },
    onError: () => {
      toast.error('Failed to update lead');
    },
  });

  // Start editing a saved lead
  const startEditingSaved = (lead: StoredLead) => {
    setEditingSavedId(lead.id);
    setSavedEditForm({
      agency_name: lead.agency_name || '',
      contact_name: lead.contact_name || '',
      email: lead.email || '',
      website: lead.website || '',
      niche: lead.niche || '',
    });
  };

  // Save edited saved lead
  const saveEditingSaved = () => {
    if (editingSavedId === null) return;
    updateStoredMutation.mutate({
      id: editingSavedId,
      data: savedEditForm,
    });
  };

  // Open Send DM panel for a stored lead
  const openSendDMPanel = (lead: StoredLead) => {
    setSelectedLeadForDM({
      type: 'lead',
      id: lead.id,
      name: lead.contact_name || lead.agency_name || 'Unknown',
      company: lead.agency_name || '',
      city: lead.location || undefined,
      niche: lead.niche || undefined,
      website: lead.website || undefined,
      email: lead.email || undefined,
    });
    setIsSendDMPanelOpen(true);
  };

  // Cancel editing saved lead
  const cancelEditingSaved = () => {
    setEditingSavedId(null);
  };

  // Toggle single lead selection
  const toggleLeadSelection = (leadId: number) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) {
        next.delete(leadId);
      } else {
        next.add(leadId);
      }
      return next;
    });
  };

  // Toggle select all
  const toggleSelectAll = () => {
    if (!storedLeadsData) return;
    if (selectedLeadIds.size === storedLeadsData.leads.length) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(storedLeadsData.leads.map((l: StoredLead) => l.id)));
    }
  };

  // Handle bulk delete
  const handleBulkDelete = () => {
    if (selectedLeadIds.size === 0) return;
    if (!confirm(`Delete ${selectedLeadIds.size} selected leads?`)) return;
    bulkDeleteMutation.mutate(Array.from(selectedLeadIds));
  };

  // Search mutation
  const searchMutation = useMutation({
    mutationFn: leadDiscoveryApi.search,
    onSuccess: (data) => {
      setResults(data);
      if (data.leads.length === 0) {
        toast.error('No leads found. Try adjusting your search criteria.');
      } else {
        toast.success(`Found ${data.leads.length} leads!`);
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Search failed. Please try again.');
    },
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: leadDiscoveryApi.importLeads,
    onSuccess: (data) => {
      toast.success(`Added ${data.imported} leads to ${data.campaign_name}!`);
      setIsModalOpen(false);
      setResults(null);
      setNiche('');
      setLocation('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Import failed. Please try again.');
    },
  });

  // Rotate loading messages
  useEffect(() => {
    if (!searchMutation.isPending) return;

    const interval = setInterval(() => {
      setLoadingStep((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2500);

    return () => clearInterval(interval);
  }, [searchMutation.isPending]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!niche.trim() || !location.trim()) {
      toast.error('Please enter both niche and location');
      return;
    }
    setLoadingStep(0);
    searchMutation.mutate({ niche, location, count });
  };

  const handleImport = (campaignId: number) => {
    if (!results) return;
    importMutation.mutate({
      leads: results.leads,
      campaign_id: campaignId,
    });
  };

  const handleClear = () => {
    setResults(null);
    setEditingIndex(null);
  };

  const startEditing = (index: number, lead: DiscoveredLead) => {
    setEditingIndex(index);
    setEditForm({
      email: lead.email || '',
      contact_name: lead.contact_name || '',
      website: lead.website || '',
      niche: lead.niche || '',
    });
  };

  const cancelEditing = () => {
    setEditingIndex(null);
  };

  const saveEditing = (index: number) => {
    if (!results) return;

    const updatedLeads = [...results.leads];
    const lead = updatedLeads[index];

    lead.email = editForm.email || null;
    lead.contact_name = editForm.contact_name || null;
    lead.website = editForm.website || null;
    lead.niche = editForm.niche || null;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    lead.is_valid_email = editForm.email ? emailRegex.test(editForm.email) : false;

    const validCount = updatedLeads.filter(
      (l) => l.is_valid_email && !l.is_duplicate
    ).length;

    setResults({
      ...results,
      leads: updatedLeads,
      valid_for_import: validCount,
    });

    setEditingIndex(null);
    toast.success('Lead updated!');
  };

  const validForImport = results?.valid_for_import || 0;

  return (
    <>
      {/* Sub-tab Navigation */}
      <div className="px-8 pt-4 flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveSubTab('search')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-200',
              activeSubTab === 'search'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-[--exec-surface-alt] text-[--exec-text-secondary] hover:bg-[--exec-surface-hover]'
            )}
          >
            <Search className="w-4 h-4" />
            Search New Leads
          </button>
          <button
            onClick={() => setActiveSubTab('saved')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-200',
              activeSubTab === 'saved'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-[--exec-surface-alt] text-[--exec-text-secondary] hover:bg-[--exec-surface-hover]'
            )}
          >
            <Database className="w-4 h-4" />
            Saved Leads
            {stats && stats.total_leads > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-white/20">
                {stats.total_leads}
              </span>
            )}
          </button>
        </div>

        {/* Stats badge */}
        {stats && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[--exec-surface-alt] rounded-full">
            <Database className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-medium text-[--exec-text-secondary]">
              {stats.total_leads} saved leads ({stats.with_email} with email)
            </span>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="px-8 py-4">
        {/* Search Tab */}
        {activeSubTab === 'search' && (
          <>
            {/* Search Form */}
            <div className="bento-card p-6 mb-6">
              <form onSubmit={handleSearch}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  {/* Niche Input */}
                  <div>
                    <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                      Niche / Industry
                    </label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[--exec-text-muted]" />
                      <input
                        type="text"
                        value={niche}
                        onChange={(e) => setNiche(e.target.value)}
                        placeholder="e.g., Digital Marketing Agencies"
                        className={cn(
                          'w-full pl-10 pr-4 py-2.5',
                          'bg-stone-800/50 border border-stone-600/40 rounded-xl',
                          'text-[--exec-text]',
                          'placeholder:text-[--exec-text-muted]',
                          'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
                          'transition-all duration-200'
                        )}
                      />
                    </div>
                  </div>

                  {/* Location Input */}
                  <div>
                    <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                      Location
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[--exec-text-muted]" />
                      <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="e.g., California, United States"
                        className={cn(
                          'w-full pl-10 pr-4 py-2.5',
                          'bg-stone-800/50 border border-stone-600/40 rounded-xl',
                          'text-[--exec-text]',
                          'placeholder:text-[--exec-text-muted]',
                          'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
                          'transition-all duration-200'
                        )}
                      />
                    </div>
                  </div>

                  {/* Count Select */}
                  <div>
                    <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                      Number of Leads
                    </label>
                    <select
                      value={count}
                      onChange={(e) => setCount(Number(e.target.value))}
                      className={cn(
                        'w-full px-4 py-2.5',
                        'bg-stone-800/50 border border-stone-600/40 rounded-xl',
                        'text-[--exec-text]',
                        'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
                        'transition-all duration-200'
                      )}
                    >
                      <option value={5}>5 leads</option>
                      <option value={10}>10 leads</option>
                      <option value={15}>15 leads</option>
                    </select>
                  </div>
                </div>

                {/* Search Button */}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={searchMutation.isPending}
                    className={cn(
                      'flex items-center gap-2 px-6 py-2.5 rounded-xl',
                      'text-white font-medium',
                      'transition-all duration-200',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      'hover:brightness-110 hover:scale-105 hover:shadow-lg',
                      'active:scale-95'
                    )}
                    style={{ backgroundColor: 'var(--exec-accent)' }}
                  >
                    {searchMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    Search for Leads
                  </button>
                </div>
              </form>
            </div>

            {/* Loading State */}
            {searchMutation.isPending && (
              <div className="bento-card p-12 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[--exec-accent-bg] mb-4">
                  <Loader2 className="w-8 h-8 text-[--exec-accent] animate-spin" />
                </div>
                <div className="flex items-center justify-center gap-2 text-[--exec-text]">
                  {(() => {
                    const LoadingIcon = LOADING_MESSAGES[loadingStep].icon;
                    return <LoadingIcon className="w-5 h-5 text-[--exec-accent]" />;
                  })()}
                  <span className="text-lg font-medium">
                    {LOADING_MESSAGES[loadingStep].text}
                  </span>
                </div>
                <div className="flex justify-center gap-1.5 mt-4">
                  {LOADING_MESSAGES.map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        'w-2 h-2 rounded-full transition-all duration-300',
                        i === loadingStep
                          ? 'bg-[--exec-accent] scale-125'
                          : 'bg-stone-600'
                      )}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Results */}
            {results && !searchMutation.isPending && (
              <>
                {/* Stats Bar */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-[--exec-text]">
                      Found{' '}
                      <span className="font-semibold">{results.leads.length}</span>{' '}
                      leads
                    </span>
                    {results.duplicates_found > 0 && (
                      <span className="text-amber-400">
                        • {results.duplicates_found} duplicates
                      </span>
                    )}
                    <span className="text-green-400">
                      • {validForImport} ready to import
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsModalOpen(true)}
                      disabled={validForImport === 0}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-xl',
                        'text-white font-medium',
                        'transition-all duration-200',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'hover:brightness-110 hover:scale-105',
                        'active:scale-95'
                      )}
                      style={{ backgroundColor: 'var(--exec-accent)' }}
                    >
                      <Users className="w-4 h-4" />
                      Add to Campaign
                    </button>
                    <button
                      onClick={handleClear}
                      className="px-4 py-2 text-[--exec-text-secondary] hover:bg-[--exec-surface-alt] rounded-xl transition-colors"
                    >
                      Clear Results
                    </button>
                  </div>
                </div>

                {/* Results Table */}
                <div className="bento-card overflow-x-auto">
                  <table className="min-w-full divide-y divide-[--exec-border]">
                    <thead className="bg-[--exec-surface-alt]">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                          Agency
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                          Contact
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                          Website
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                          Niche
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-[--exec-surface] divide-y divide-[--exec-border-subtle]">
                      {results.leads.map((lead, index) => (
                        <tr
                          key={index}
                          className={cn(
                            'hover:bg-[--exec-surface-alt] transition-colors',
                            lead.is_duplicate && 'opacity-60'
                          )}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {editingIndex === index ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => saveEditing(index)}
                                    className="p-1.5 text-green-400 hover:bg-green-900/30 rounded-lg transition-colors"
                                    title="Save"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={cancelEditing}
                                    className="p-1.5 text-[--exec-text-muted] hover:bg-stone-700 rounded-lg transition-colors"
                                    title="Cancel"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => startEditing(index, lead)}
                                  className="p-1.5 text-[--exec-text-muted] hover:text-blue-400 hover:bg-blue-900/30 rounded-lg transition-colors"
                                  title="Edit lead"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                              )}
                              <div className="text-sm font-medium text-[--exec-text]">
                                {lead.agency_name}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {editingIndex === index ? (
                              <input
                                type="email"
                                value={editForm.email}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, email: e.target.value })
                                }
                                placeholder="Enter email..."
                                className="w-full px-2 py-1 text-sm bg-stone-800/50 border border-stone-600/40 rounded-lg text-[--exec-text] focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20"
                              />
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-[--exec-text-secondary]">
                                  {lead.email || '-'}
                                </span>
                                <EmailBadge lead={lead} />
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {editingIndex === index ? (
                              <input
                                type="text"
                                value={editForm.contact_name}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, contact_name: e.target.value })
                                }
                                placeholder="Contact name..."
                                className="w-full px-2 py-1 text-sm bg-stone-800/50 border border-stone-600/40 rounded-lg text-[--exec-text] focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20"
                              />
                            ) : (
                              <div className="flex items-center gap-2 text-sm text-[--exec-text-secondary]">
                                {lead.contact_name ? (
                                  <>
                                    <User className="w-4 h-4 text-[--exec-text-muted]" />
                                    {lead.contact_name}
                                  </>
                                ) : (
                                  '-'
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {editingIndex === index ? (
                              <input
                                type="text"
                                value={editForm.website}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, website: e.target.value })
                                }
                                placeholder="Website URL..."
                                className="w-full px-2 py-1 text-sm bg-stone-800/50 border border-stone-600/40 rounded-lg text-[--exec-text] focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20"
                              />
                            ) : lead.website ? (
                              <a
                                href={
                                  lead.website.startsWith('http')
                                    ? lead.website
                                    : `https://${lead.website}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-sm text-blue-400 hover:underline"
                              >
                                <Globe className="w-4 h-4" />
                                {lead.website.replace(/^https?:\/\//, '').slice(0, 30)}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-sm text-[--exec-text-muted]">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {editingIndex === index ? (
                              <input
                                type="text"
                                value={editForm.niche}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, niche: e.target.value })
                                }
                                placeholder="Niche..."
                                className="w-full px-2 py-1 text-sm bg-stone-800/50 border border-stone-600/40 rounded-lg text-[--exec-text] focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20"
                              />
                            ) : (
                              <span className="text-sm text-[--exec-text-secondary]">
                                {lead.niche || '-'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Empty State */}
            {!results && !searchMutation.isPending && (
              <div className="bento-card p-12 text-center">
                <Search className="w-12 h-12 text-[--exec-text-muted] mx-auto mb-4" />
                <h3 className="text-lg font-medium text-[--exec-text] mb-2">
                  Search for leads to get started
                </h3>
                <p className="text-[--exec-text-muted]">
                  Enter a niche and location to discover potential prospects.
                </p>
              </div>
            )}
          </>
        )}

        {/* Saved Leads Tab */}
        {activeSubTab === 'saved' && (
          <div>
            {/* Bulk Action Bar */}
            {selectedLeadIds.size > 0 && (
              <div className="flex items-center justify-between px-4 py-3 mb-3 bg-red-900/20 border border-red-800/40 rounded-xl">
                <span className="text-sm font-medium text-red-400">
                  {selectedLeadIds.size} lead{selectedLeadIds.size !== 1 ? 's' : ''} selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedLeadIds(new Set())}
                    className="px-3 py-1.5 text-sm text-[--exec-text-secondary] hover:bg-stone-700/50 rounded-lg transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    disabled={bulkDeleteMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {bulkDeleteMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    Delete Selected
                  </button>
                </div>
              </div>
            )}

          <div className="bento-card overflow-hidden">
            {isLoadingStored ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : storedLeadsData && storedLeadsData.leads.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[--exec-border]">
                  <thead className="bg-[--exec-surface-alt]">
                    <tr>
                      <th className="px-3 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={storedLeadsData ? selectedLeadIds.size === storedLeadsData.leads.length && storedLeadsData.leads.length > 0 : false}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 text-blue-600 bg-stone-700 border-stone-600 rounded focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider w-10">
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                        Agency
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                        Website
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                        Niche
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-[--exec-surface] divide-y divide-[--exec-border-subtle]">
                    {storedLeadsData.leads.map((lead: StoredLead) => (
                      <tr key={lead.id} className={cn(
                        'hover:bg-[--exec-surface-alt]',
                        selectedLeadIds.has(lead.id) && 'bg-blue-900/10'
                      )}>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedLeadIds.has(lead.id)}
                            onChange={() => toggleLeadSelection(lead.id)}
                            className="w-4 h-4 text-blue-600 bg-stone-700 border-stone-600 rounded focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            {editingSavedId === lead.id ? (
                              <>
                                <button
                                  onClick={saveEditingSaved}
                                  disabled={updateStoredMutation.isPending}
                                  className="p-1.5 text-green-400 hover:bg-green-900/30 rounded-lg transition-colors"
                                  title="Save"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={cancelEditingSaved}
                                  className="p-1.5 text-[--exec-text-muted] hover:bg-stone-700 rounded-lg transition-colors"
                                  title="Cancel"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEditingSaved(lead)}
                                  className="p-1.5 text-[--exec-text-muted] hover:text-blue-400 hover:bg-blue-900/30 rounded-lg transition-colors"
                                  title="Edit lead"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => openSendDMPanel(lead)}
                                  className="p-1.5 text-[--exec-text-muted] hover:text-green-400 hover:bg-green-900/30 rounded-lg transition-colors"
                                  title="Send DM"
                                >
                                  <MessageSquare className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => convertMutation.mutate(lead.id)}
                                  disabled={convertMutation.isPending || lead.is_duplicate}
                                  className={cn(
                                    'p-1.5 rounded-lg transition-colors',
                                    lead.is_duplicate
                                      ? 'text-stone-600 cursor-not-allowed'
                                      : 'text-blue-500 hover:bg-blue-900/30'
                                  )}
                                  title={lead.is_duplicate ? 'Already in campaign' : 'Convert to Contact'}
                                >
                                  <UserPlus className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm('Delete this lead?')) {
                                      deleteMutation.mutate(lead.id);
                                    }
                                  }}
                                  className="p-1.5 text-[--exec-text-muted] hover:text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
                                  title="Delete lead"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {editingSavedId === lead.id ? (
                            <div className="space-y-1">
                              <input
                                type="text"
                                value={savedEditForm.agency_name}
                                onChange={(e) => setSavedEditForm({ ...savedEditForm, agency_name: e.target.value })}
                                placeholder="Agency name"
                                className="w-full px-2 py-1 text-sm bg-stone-800/50 border border-stone-600/40 rounded-lg text-[--exec-text] focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20"
                              />
                              <input
                                type="text"
                                value={savedEditForm.contact_name}
                                onChange={(e) => setSavedEditForm({ ...savedEditForm, contact_name: e.target.value })}
                                placeholder="Contact name"
                                className="w-full px-2 py-1 text-xs bg-stone-800/50 border border-stone-600/40 rounded-lg text-[--exec-text] focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20"
                              />
                            </div>
                          ) : (
                            <>
                              <div className="text-sm font-medium text-[--exec-text]">
                                {lead.agency_name}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-[--exec-text-muted]">
                                {lead.contact_name && <span>{lead.contact_name}</span>}
                                {lead.created_at && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(lead.created_at).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {editingSavedId === lead.id ? (
                            <input
                              type="email"
                              value={savedEditForm.email}
                              onChange={(e) => setSavedEditForm({ ...savedEditForm, email: e.target.value })}
                              placeholder="Email"
                              className="w-full px-2 py-1 text-sm bg-stone-800/50 border border-stone-600/40 rounded-lg text-[--exec-text] focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20"
                            />
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-[--exec-text-secondary] max-w-[180px] truncate">
                                {lead.email || '-'}
                              </span>
                              {lead.email && (
                                lead.is_duplicate ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded-full bg-amber-900/30 text-amber-400">
                                    <AlertCircle className="w-3 h-3" />
                                  </span>
                                ) : lead.is_valid_email ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded-full bg-green-900/30 text-green-400">
                                    <CheckCircle className="w-3 h-3" />
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded-full bg-red-900/30 text-red-400">
                                    <XCircle className="w-3 h-3" />
                                  </span>
                                )
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {editingSavedId === lead.id ? (
                            <input
                              type="text"
                              value={savedEditForm.website}
                              onChange={(e) => setSavedEditForm({ ...savedEditForm, website: e.target.value })}
                              placeholder="Website"
                              className="w-full px-2 py-1 text-sm bg-stone-800/50 border border-stone-600/40 rounded-lg text-[--exec-text] focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20"
                            />
                          ) : lead.website ? (
                            <a
                              href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-blue-400 hover:underline"
                            >
                              <Globe className="w-3 h-3" />
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-sm text-[--exec-text-muted]">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {editingSavedId === lead.id ? (
                            <input
                              type="text"
                              value={savedEditForm.niche}
                              onChange={(e) => setSavedEditForm({ ...savedEditForm, niche: e.target.value })}
                              placeholder="Niche"
                              className="w-full px-2 py-1 text-sm bg-stone-800/50 border border-stone-600/40 rounded-lg text-[--exec-text] focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20"
                            />
                          ) : (
                            <span className="text-sm text-[--exec-text-secondary] max-w-[120px] truncate block">
                              {lead.niche || '-'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center">
                <Database className="w-12 h-12 text-[--exec-text-muted] mx-auto mb-4" />
                <h3 className="text-lg font-medium text-[--exec-text] mb-2">
                  No saved leads yet
                </h3>
                <p className="text-[--exec-text-muted] mb-4">
                  Search for leads and they'll be automatically saved here.
                </p>
                <button
                  onClick={() => setActiveSubTab('search')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                >
                  <Search className="w-4 h-4" />
                  Search for Leads
                </button>
              </div>
            )}
          </div>
          </div>
        )}
      </div>

      {/* Campaign Selection Modal */}
      <CampaignSelectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        campaigns={campaigns}
        validCount={validForImport}
        onSelect={handleImport}
        isImporting={importMutation.isPending}
      />

      {/* Send DM Panel */}
      <SendDMPanel
        isOpen={isSendDMPanelOpen}
        onClose={() => setIsSendDMPanelOpen(false)}
        source={selectedLeadForDM}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['stored-leads'] });
        }}
      />
    </>
  );
}
