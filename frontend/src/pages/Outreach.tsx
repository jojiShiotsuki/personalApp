import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { outreachApi } from '@/lib/api';
import type { OutreachNiche, OutreachSituation, OutreachTemplate, TemplateType } from '@/types';
import { Copy, Check, UserPlus, Settings2, Send, MessageCircle, Zap, Mail, Linkedin, Video } from 'lucide-react';
import { toast } from 'sonner';
import ManageTemplatesModal from '@/components/ManageTemplatesModal';
import { cn } from '@/lib/utils';

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
];

export default function Outreach() {
  const [name, setName] = useState('');
  const [selectedNicheId, setSelectedNicheId] = useState<number | null>(null);
  const [selectedSituationId, setSelectedSituationId] = useState<number | null>(null);
  const [selectedTemplateType, setSelectedTemplateType] = useState<TemplateType>('email_1');
  const [copied, setCopied] = useState(false);
  const [isManageOpen, setIsManageOpen] = useState(false);
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

  // Find the template for current niche + situation + template_type
  // Fallback: try exact niche match first, then "All Niches" (niche_id === null) default
  const currentTemplate = templates.find(
    (t) => t.niche_id === selectedNicheId && t.situation_id === selectedSituationId && t.template_type === selectedTemplateType
  ) || (selectedNicheId !== null ? templates.find(
    (t) => t.niche_id === null && t.situation_id === selectedSituationId && t.template_type === selectedTemplateType
  ) : undefined);

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
    <div className="min-h-full bg-[--exec-bg] grain">
      {/* Hero Header */}
      <header className="relative overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[--exec-surface] via-[--exec-surface] to-[--exec-accent-bg-subtle]" />

        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-[--exec-accent]/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-gradient-to-t from-[--exec-sage]/5 to-transparent rounded-full blur-2xl" />

        <div className="relative px-8 pt-8 pb-6">
          {/* Breadcrumb chip */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[--exec-surface-alt] rounded-full mb-4 animate-fade-slide-up">
            <MessageCircle className="w-3.5 h-3.5 text-[--exec-accent]" />
            <span className="text-xs font-medium text-[--exec-text-secondary]">Cold Outreach</span>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-4xl font-bold text-[--exec-text] tracking-tight animate-fade-slide-up delay-1" style={{ fontFamily: 'var(--font-display)' }}>
                DM <span className="text-[--exec-accent]">Scripts</span>
              </h1>
              <p className="text-[--exec-text-secondary] mt-2 text-lg animate-fade-slide-up delay-2">
                Quick cold DM scripts for TikTok outreach
              </p>
            </div>

            <button
              onClick={() => setIsManageOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[--exec-surface] border border-[--exec-border] text-[--exec-text-secondary] rounded-2xl hover:bg-[--exec-surface-alt] hover:border-[--exec-accent] hover:text-[--exec-accent] transition-all duration-200 font-medium text-sm animate-fade-slide-up delay-3"
            >
              <Settings2 className="w-4 h-4" />
              Manage Templates
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="px-8 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Name Input */}
          <div className="bento-card p-6 animate-fade-slide-up delay-3">
            <label className="block text-sm font-semibold text-[--exec-text] mb-3">
              Name / Handle
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="@username or Name"
              className="w-full px-4 py-3 bg-[--exec-surface-alt] border border-[--exec-border] rounded-xl focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent] transition-all duration-200 text-[--exec-text] placeholder-[--exec-text-muted]"
            />
          </div>

          {/* Niche Selection */}
          <div className="bento-card p-6 animate-fade-slide-up delay-4">
            <label className="block text-sm font-semibold text-[--exec-text] mb-3">
              Niche
            </label>
            {niches.length > 0 ? (
              <select
                value={selectedNicheId ?? ''}
                onChange={(e) => setSelectedNicheId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-4 py-3 bg-[--exec-surface-alt] border border-[--exec-border] rounded-xl focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent] transition-all duration-200 text-[--exec-text] cursor-pointer"
              >
                <option value="">All Niches</option>
                {niches.map((niche) => (
                  <option key={niche.id} value={niche.id}>
                    {niche.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-[--exec-text-muted] py-3">
                No niches yet.{' '}
                <button
                  onClick={() => setIsManageOpen(true)}
                  className="text-[--exec-accent] hover:text-[--exec-accent-dark] font-medium"
                >
                  Add one →
                </button>
              </p>
            )}
          </div>

          {/* Situation Selection */}
          <div className="bento-card p-6 animate-fade-slide-up delay-5">
            <label className="block text-sm font-semibold text-[--exec-text] mb-3">
              Situation
            </label>
            {situations.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {situations.map((situation) => (
                  <button
                    key={situation.id}
                    onClick={() => setSelectedSituationId(situation.id)}
                    className={cn(
                      'px-4 py-2.5 rounded-xl border transition-all duration-200 font-medium text-sm',
                      selectedSituationId === situation.id
                        ? 'bg-[--exec-accent] text-white border-[--exec-accent] shadow-lg shadow-[--exec-accent]/20'
                        : 'bg-[--exec-surface-alt] text-[--exec-text-secondary] border-[--exec-border] hover:border-[--exec-accent] hover:text-[--exec-accent]'
                    )}
                  >
                    {situation.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[--exec-text-muted] py-3">
                No situations yet.{' '}
                <button
                  onClick={() => setIsManageOpen(true)}
                  className="text-[--exec-accent] hover:text-[--exec-accent-dark] font-medium"
                >
                  Add one →
                </button>
              </p>
            )}
          </div>

          {/* Template Type Selection */}
          <div className="bento-card p-6 animate-fade-slide-up delay-6">
            <label className="block text-sm font-semibold text-[--exec-text] mb-3">
              Template Type
            </label>
            <div className="space-y-3">
              {TEMPLATE_CATEGORIES.map((category) => {
                const Icon = category.icon;
                return (
                  <div key={category.group}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-3.5 h-3.5 text-[--exec-text-muted]" />
                      <span className="text-xs font-semibold text-[--exec-text-muted] uppercase tracking-wider">
                        {category.group}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {category.types.map((type) => (
                        <button
                          key={type.value}
                          onClick={() => setSelectedTemplateType(type.value)}
                          className={cn(
                            'px-4 py-2.5 rounded-xl border transition-all duration-200 font-medium text-sm',
                            selectedTemplateType === type.value
                              ? 'bg-[--exec-accent] text-white border-[--exec-accent] shadow-lg shadow-[--exec-accent]/20'
                              : 'bg-[--exec-surface-alt] text-[--exec-text-secondary] border-[--exec-border] hover:border-[--exec-accent] hover:text-[--exec-accent]'
                          )}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Script Preview */}
          <div className="bento-card p-6 animate-fade-slide-up delay-7">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-[--exec-info-bg] flex items-center justify-center">
                <Zap className="w-4 h-4 text-[--exec-info]" />
              </div>
              <label className="text-sm font-semibold text-[--exec-text]">
                Script Preview
              </label>
            </div>
            <div className="bg-[--exec-surface-alt] border border-[--exec-border-subtle] rounded-xl p-5 min-h-[150px]">
              {processedScript ? (
                <p className="text-[--exec-text] whitespace-pre-wrap leading-relaxed">
                  {processedScript}
                </p>
              ) : selectedSituationId ? (
                <p className="text-[--exec-text-muted] italic">
                  No template for this combination.{' '}
                  <button
                    onClick={() => setIsManageOpen(true)}
                    className="text-[--exec-accent] hover:text-[--exec-accent-dark] font-medium not-italic"
                  >
                    Create one →
                  </button>
                </p>
              ) : (
                <p className="text-[--exec-text-muted] italic">
                  Select a situation to see the script
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2 animate-fade-slide-up delay-8">
            <button
              onClick={handleCopy}
              disabled={!processedScript}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold transition-all duration-200',
                processedScript
                  ? 'bg-gradient-to-r from-[--exec-accent] to-[--exec-accent-dark] text-white hover:shadow-lg hover:shadow-[--exec-accent]/25 hover:-translate-y-0.5'
                  : 'bg-[--exec-surface-alt] text-[--exec-text-muted] cursor-not-allowed'
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
                'flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold transition-all duration-200',
                name.trim() && selectedNicheId && selectedSituationId
                  ? 'bg-gradient-to-r from-[--exec-sage] to-[--exec-sage-light] text-white hover:shadow-lg hover:shadow-[--exec-sage]/25 hover:-translate-y-0.5'
                  : 'bg-[--exec-surface-alt] text-[--exec-text-muted] cursor-not-allowed'
              )}
            >
              <UserPlus className="w-5 h-5" />
              {addToPipelineMutation.isPending ? 'Adding...' : 'Add to Pipeline'}
            </button>
          </div>

          {/* Quick Stats */}
          {niches.length > 0 && situations.length > 0 && (
            <div className="mt-4 p-4 bg-[--exec-surface-alt] border border-[--exec-border-subtle] rounded-2xl animate-fade-slide-up delay-8">
              <div className="flex items-center gap-3 text-sm text-[--exec-text-muted]">
                <div className="w-8 h-8 rounded-lg bg-[--exec-accent-bg] flex items-center justify-center">
                  <Send className="w-4 h-4 text-[--exec-accent]" />
                </div>
                <span>
                  <span className="font-semibold text-[--exec-text]">{templates.length}</span> templates configured for{' '}
                  <span className="font-semibold text-[--exec-text]">{niches.length}</span> niches and{' '}
                  <span className="font-semibold text-[--exec-text]">{situations.length}</span> situations
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
