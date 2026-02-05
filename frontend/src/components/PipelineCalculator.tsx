import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pipelineApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Calculator,
  DollarSign,
  Target,
  Users,
  Trophy,
  Mail,
  Linkedin,
  Phone,
  Video,
  Settings,
  TrendingUp,
  Loader2,
  X,
} from 'lucide-react';
import type { PipelineSettings, PipelineSettingsUpdate } from '@/types';
import { useState } from 'react';

const FUNNEL_COLORS = [
  'from-blue-500 to-blue-600',
  'from-cyan-500 to-cyan-600',
  'from-emerald-500 to-emerald-600',
  'from-green-500 to-green-600',
];

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  'Cold Emails': <Mail className="w-4 h-4" />,
  'LinkedIn': <Linkedin className="w-4 h-4" />,
  'Follow-up Calls': <Phone className="w-4 h-4" />,
  'Loom Audits': <Video className="w-4 h-4" />,
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PipelineSettings;
}

function SettingsModal({ isOpen, onClose, settings }: SettingsModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<PipelineSettingsUpdate>({
    monthly_revenue_goal: settings.monthly_revenue_goal,
    average_deal_value: settings.average_deal_value,
    lead_to_qualified_rate: settings.lead_to_qualified_rate,
    qualified_to_proposal_rate: settings.qualified_to_proposal_rate,
    proposal_to_close_rate: settings.proposal_to_close_rate,
    cold_email_response_rate: settings.cold_email_response_rate,
    linkedin_connection_rate: settings.linkedin_connection_rate,
    call_to_meeting_rate: settings.call_to_meeting_rate,
    loom_response_rate: settings.loom_response_rate,
  });

  const updateMutation = useMutation({
    mutationFn: pipelineApi.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-settings'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-calculation'] });
      onClose();
    },
  });

  if (!isOpen) return null;

  const handleChange = (field: keyof PipelineSettingsUpdate, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: parseFloat(value) || 0,
    }));
  };

  const inputClasses = cn(
    "w-full px-4 py-2.5 rounded-lg",
    "bg-stone-800/50 border border-stone-600/40",
    "text-[--exec-text] placeholder:text-[--exec-text-muted]",
    "focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50",
    "transition-all text-sm"
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden border border-stone-600/40 animate-in zoom-in-95 duration-200">
        <div className="p-6 pb-0">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold text-[--exec-text]">Pipeline Settings</h2>
              <p className="text-sm text-[--exec-text-muted] mt-1">Configure your conversion rates</p>
            </div>
            <button
              onClick={onClose}
              className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Revenue Targets */}
          <div>
            <h3 className="text-sm font-semibold text-[--exec-text-secondary] mb-3">
              Revenue Targets
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-[--exec-text-muted] mb-1.5">
                  Monthly Revenue Goal ($)
                </label>
                <input
                  type="number"
                  value={formData.monthly_revenue_goal}
                  onChange={(e) => handleChange('monthly_revenue_goal', e.target.value)}
                  className={inputClasses}
                />
              </div>
              <div>
                <label className="block text-xs text-[--exec-text-muted] mb-1.5">
                  Average Deal Value ($)
                </label>
                <input
                  type="number"
                  value={formData.average_deal_value}
                  onChange={(e) => handleChange('average_deal_value', e.target.value)}
                  className={inputClasses}
                />
              </div>
            </div>
          </div>

          {/* Funnel Conversion Rates */}
          <div>
            <h3 className="text-sm font-semibold text-[--exec-text-secondary] mb-3">
              Funnel Conversion Rates (%)
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-[--exec-text-muted] mb-1.5">
                  Lead → Qualified
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={formData.lead_to_qualified_rate}
                  onChange={(e) => handleChange('lead_to_qualified_rate', e.target.value)}
                  className={inputClasses}
                />
              </div>
              <div>
                <label className="block text-xs text-[--exec-text-muted] mb-1.5">
                  Qualified → Proposal
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={formData.qualified_to_proposal_rate}
                  onChange={(e) => handleChange('qualified_to_proposal_rate', e.target.value)}
                  className={inputClasses}
                />
              </div>
              <div>
                <label className="block text-xs text-[--exec-text-muted] mb-1.5">
                  Proposal → Close
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={formData.proposal_to_close_rate}
                  onChange={(e) => handleChange('proposal_to_close_rate', e.target.value)}
                  className={inputClasses}
                />
              </div>
            </div>
          </div>

          {/* Activity Conversion Rates */}
          <div>
            <h3 className="text-sm font-semibold text-[--exec-text-secondary] mb-3">
              Activity Response Rates (%)
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-[--exec-text-muted] mb-1.5">
                  Cold Email Response
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={formData.cold_email_response_rate}
                  onChange={(e) => handleChange('cold_email_response_rate', e.target.value)}
                  className={inputClasses}
                />
              </div>
              <div>
                <label className="block text-xs text-[--exec-text-muted] mb-1.5">
                  LinkedIn Connection
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={formData.linkedin_connection_rate}
                  onChange={(e) => handleChange('linkedin_connection_rate', e.target.value)}
                  className={inputClasses}
                />
              </div>
              <div>
                <label className="block text-xs text-[--exec-text-muted] mb-1.5">
                  Call → Meeting
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={formData.call_to_meeting_rate}
                  onChange={(e) => handleChange('call_to_meeting_rate', e.target.value)}
                  className={inputClasses}
                />
              </div>
              <div>
                <label className="block text-xs text-[--exec-text-muted] mb-1.5">
                  Loom Response
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={formData.loom_response_rate}
                  onChange={(e) => handleChange('loom_response_rate', e.target.value)}
                  className={inputClasses}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end px-6 py-4 border-t border-stone-600/40">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-stone-700/50 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => updateMutation.mutate(formData)}
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-[--exec-accent] text-white rounded-xl hover:bg-[--exec-accent-dark] transition-colors disabled:opacity-50"
          >
            {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PipelineCalculator() {
  const [showSettings, setShowSettings] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ['pipeline-settings'],
    queryFn: pipelineApi.getSettings,
  });

  const { data: calculation, isLoading } = useQuery({
    queryKey: ['pipeline-calculation'],
    queryFn: pipelineApi.calculate,
  });

  if (isLoading || !calculation) {
    return (
      <div className="bento-card p-6 animate-pulse">
        <div className="h-6 bg-[--exec-surface-alt] rounded w-48 mb-4" />
        <div className="grid grid-cols-4 gap-4 mb-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-[--exec-surface-alt] rounded-xl" />
          ))}
        </div>
        <div className="h-32 bg-[--exec-surface-alt] rounded-xl" />
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toFixed(0)}`;
  };

  return (
    <>
      <div className="bento-card overflow-hidden animate-fade-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[--exec-border-subtle]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[--exec-accent-bg] to-[--exec-accent-bg-subtle] flex items-center justify-center">
              <Calculator className="w-5 h-5 text-[--exec-accent]" />
            </div>
            <div>
              <h2 className="font-semibold text-[--exec-text]">Pipeline Calculator</h2>
              <p className="text-xs text-[--exec-text-muted]">
                {formatCurrency(calculation.monthly_revenue_goal)}/mo goal
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-[--exec-surface-alt] rounded-lg transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-4 gap-4 p-6 border-b border-[--exec-border-subtle]">
          <div className="text-center">
            <div className="w-10 h-10 rounded-xl bg-[--exec-sage-bg] flex items-center justify-center mx-auto mb-2">
              <DollarSign className="w-5 h-5 text-[--exec-sage]" />
            </div>
            <p className="text-2xl font-bold text-[--exec-text]">
              {formatCurrency(calculation.monthly_revenue_goal)}
            </p>
            <p className="text-xs text-[--exec-text-muted]">Monthly Goal</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 rounded-xl bg-[--exec-accent-bg] flex items-center justify-center mx-auto mb-2">
              <Trophy className="w-5 h-5 text-[--exec-accent]" />
            </div>
            <p className="text-2xl font-bold text-[--exec-text]">{calculation.deals_needed}</p>
            <p className="text-xs text-[--exec-text-muted]">Deals Needed</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 rounded-xl bg-[--exec-info-bg] flex items-center justify-center mx-auto mb-2">
              <Users className="w-5 h-5 text-[--exec-info]" />
            </div>
            <p className="text-2xl font-bold text-[--exec-text]">{calculation.total_leads_needed}</p>
            <p className="text-xs text-[--exec-text-muted]">Leads Needed</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 rounded-xl bg-[--exec-warning-bg] flex items-center justify-center mx-auto mb-2">
              <TrendingUp className="w-5 h-5 text-[--exec-warning]" />
            </div>
            <p className="text-2xl font-bold text-[--exec-text]">{calculation.overall_conversion_rate}%</p>
            <p className="text-xs text-[--exec-text-muted]">Close Rate</p>
          </div>
        </div>

        {/* Funnel Visualization */}
        <div className="p-6 border-b border-[--exec-border-subtle]">
          <h3 className="text-sm font-semibold text-[--exec-text-secondary] mb-4">
            Sales Funnel
          </h3>
          <div className="space-y-3">
            {calculation.funnel.map((stage, idx) => {
              const widthPercent = 100 - idx * 15; // Narrowing funnel
              return (
                <div key={stage.name} className="flex items-center gap-4">
                  <div className="w-24 text-right">
                    <p className="text-sm font-medium text-[--exec-text]">{stage.name}</p>
                    <p className="text-xs text-[--exec-text-muted]">{stage.conversion_rate}%</p>
                  </div>
                  <div className="flex-1">
                    <div
                      className={cn(
                        'h-10 rounded-lg bg-gradient-to-r flex items-center justify-center text-white font-bold text-sm transition-all',
                        FUNNEL_COLORS[idx]
                      )}
                      style={{ width: `${widthPercent}%` }}
                    >
                      {stage.count}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Daily Activity Targets */}
        <div className="p-6">
          <h3 className="text-sm font-semibold text-[--exec-text-secondary] mb-4">
            Daily Activity Targets
          </h3>
          <div className="grid grid-cols-4 gap-4">
            {calculation.activities.map((activity) => (
              <div
                key={activity.channel}
                className="p-4 rounded-xl bg-[--exec-surface-alt] text-center"
              >
                <div className="w-8 h-8 rounded-lg bg-[--exec-accent-bg] flex items-center justify-center mx-auto mb-2 text-[--exec-accent]">
                  {ACTIVITY_ICONS[activity.channel] || <Target className="w-4 h-4" />}
                </div>
                <p className="text-2xl font-bold text-[--exec-text]">{activity.daily}</p>
                <p className="text-xs text-[--exec-text-muted] truncate">{activity.channel}</p>
                <p className="text-[10px] text-[--exec-text-muted] mt-1 truncate">
                  {activity.description}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 p-4 rounded-xl bg-[--exec-accent-bg] flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[--exec-accent]">
                Total Daily Outreach
              </p>
              <p className="text-xs text-[--exec-accent]/70">
                Across all channels to hit your goal
              </p>
            </div>
            <p className="text-3xl font-bold text-[--exec-accent]">
              {calculation.daily_outreach_target}
            </p>
          </div>
        </div>
      </div>

      {settings && (
        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          settings={settings}
        />
      )}
    </>
  );
}
