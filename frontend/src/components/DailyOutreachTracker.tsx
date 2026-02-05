import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dailyOutreachApi } from '@/lib/api';
import CircularProgress from './CircularProgress';
import { cn } from '@/lib/utils';
import {
  Mail,
  Linkedin,
  Phone,
  Video,
  Plus,
  Minus,
  Flame,
  Settings,
  Check,
  Loader2,
} from 'lucide-react';
import type { OutreachActivityType, ActivityMetric } from '@/types';
import { useState } from 'react';

interface ActivityCardProps {
  label: string;
  metric: ActivityMetric;
  icon: React.ReactNode;
  color: string;
  colorVar: string;
  activityType: OutreachActivityType;
  onLog: (type: OutreachActivityType) => void;
  onDeduct: (type: OutreachActivityType) => void;
  isLogging: boolean;
  isDeducting: boolean;
}

function ActivityCard({
  label,
  metric,
  icon,
  color,
  colorVar,
  activityType,
  onLog,
  onDeduct,
  isLogging,
  isDeducting,
}: ActivityCardProps) {
  const isComplete = metric.percentage >= 100;
  const canDeduct = metric.current > 0;

  return (
    <div className="flex flex-col items-center gap-3">
      <CircularProgress
        percentage={metric.percentage}
        size={72}
        strokeWidth={5}
        color={isComplete ? 'var(--exec-sage)' : colorVar}
        bgColor="var(--exec-border-subtle)"
      >
        <div className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center',
          isComplete ? 'bg-[--exec-sage-bg]' : `bg-[${color}]/10`
        )} style={{ backgroundColor: isComplete ? undefined : `color-mix(in srgb, ${colorVar} 15%, transparent)` }}>
          {isComplete ? (
            <Check className="w-5 h-5 text-[--exec-sage]" />
          ) : (
            <span style={{ color: colorVar }}>{icon}</span>
          )}
        </div>
      </CircularProgress>

      <div className="text-center">
        <p className="text-sm font-semibold text-[--exec-text]">
          {metric.current}/{metric.target}
        </p>
        <p className="text-xs text-[--exec-text-muted]">{label}</p>
      </div>

      <div className="flex items-center gap-1.5">
        {/* Deduct button */}
        <button
          onClick={() => onDeduct(activityType)}
          disabled={isDeducting || !canDeduct}
          className={cn(
            'flex items-center justify-center w-7 h-7 rounded-lg text-xs font-medium transition-all duration-200',
            'hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed',
            'bg-[--exec-surface-alt] text-[--exec-text-muted] hover:bg-[--exec-warning-bg] hover:text-[--exec-warning]'
          )}
          title="Undo last"
        >
          {isDeducting ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Minus className="w-3 h-3" />
          )}
        </button>

        {/* Log button */}
        <button
          onClick={() => onLog(activityType)}
          disabled={isLogging}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200',
            'hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed',
            isComplete
              ? 'bg-[--exec-sage-bg] text-[--exec-sage] hover:bg-[--exec-sage]/20'
              : 'text-white hover:opacity-90'
          )}
          style={!isComplete ? { backgroundColor: colorVar } : undefined}
        >
          {isLogging ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Plus className="w-3 h-3" />
          )}
          Log
        </button>
      </div>
    </div>
  );
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ['outreach-settings'],
    queryFn: dailyOutreachApi.getSettings,
  });

  const [formData, setFormData] = useState({
    daily_cold_email_target: settings?.daily_cold_email_target ?? 10,
    daily_linkedin_target: settings?.daily_linkedin_target ?? 10,
    daily_call_target: settings?.daily_call_target ?? 5,
    daily_loom_target: settings?.daily_loom_target ?? 1,
  });

  const updateMutation = useMutation({
    mutationFn: dailyOutreachApi.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-settings'] });
      queryClient.invalidateQueries({ queryKey: ['daily-outreach-today'] });
      onClose();
    },
  });

  if (!isOpen) return null;

  const inputClasses = cn(
    "w-full px-4 py-2.5 rounded-lg",
    "bg-stone-800/50 border border-stone-600/40",
    "text-[--exec-text] placeholder:text-[--exec-text-muted]",
    "focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50",
    "transition-all text-sm"
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-stone-600/40 animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold text-[--exec-text]">Daily Targets</h2>
              <p className="text-sm text-[--exec-text-muted] mt-1">Configure your daily outreach goals</p>
            </div>
            <button
              onClick={onClose}
              className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors"
            >
              <span className="sr-only">Close</span>
              &times;
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Cold Emails
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={formData.daily_cold_email_target}
                onChange={(e) => setFormData(prev => ({ ...prev, daily_cold_email_target: parseInt(e.target.value) || 10 }))}
                className={inputClasses}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                LinkedIn Actions
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={formData.daily_linkedin_target}
                onChange={(e) => setFormData(prev => ({ ...prev, daily_linkedin_target: parseInt(e.target.value) || 10 }))}
                className={inputClasses}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Follow-up Calls
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={formData.daily_call_target}
                onChange={(e) => setFormData(prev => ({ ...prev, daily_call_target: parseInt(e.target.value) || 5 }))}
                className={inputClasses}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Loom Audits
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={formData.daily_loom_target}
                onChange={(e) => setFormData(prev => ({ ...prev, daily_loom_target: parseInt(e.target.value) || 1 }))}
                className={inputClasses}
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-stone-600/40">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-stone-700/50 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => updateMutation.mutate(formData)}
              disabled={updateMutation.isPending}
              className="px-4 py-2 bg-[--exec-accent] text-white rounded-xl hover:bg-[--exec-accent-dark] transition-colors disabled:opacity-50"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DailyOutreachTracker() {
  const queryClient = useQueryClient();
  const [showSettings, setShowSettings] = useState(false);
  const [loggingType, setLoggingType] = useState<OutreachActivityType | null>(null);
  const [deductingType, setDeductingType] = useState<OutreachActivityType | null>(null);

  const { data: todayStats, isLoading: statsLoading } = useQuery({
    queryKey: ['daily-outreach-today'],
    queryFn: dailyOutreachApi.getTodayStats,
    retry: 1,
  });

  const { data: streak } = useQuery({
    queryKey: ['daily-outreach-streak'],
    queryFn: dailyOutreachApi.getStreak,
  });

  const { data: weekly } = useQuery({
    queryKey: ['daily-outreach-weekly'],
    queryFn: dailyOutreachApi.getWeeklySummary,
  });

  const logMutation = useMutation({
    mutationFn: (type: OutreachActivityType) => dailyOutreachApi.logActivity(type),
    onMutate: (type) => setLoggingType(type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-outreach-today'] });
      queryClient.invalidateQueries({ queryKey: ['daily-outreach-streak'] });
      queryClient.invalidateQueries({ queryKey: ['daily-outreach-weekly'] });
    },
    onSettled: () => setLoggingType(null),
  });

  const deductMutation = useMutation({
    mutationFn: (type: OutreachActivityType) => dailyOutreachApi.deductActivity(type),
    onMutate: (type) => setDeductingType(type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-outreach-today'] });
      queryClient.invalidateQueries({ queryKey: ['daily-outreach-streak'] });
      queryClient.invalidateQueries({ queryKey: ['daily-outreach-weekly'] });
    },
    onSettled: () => setDeductingType(null),
  });

  const handleLog = (type: OutreachActivityType) => {
    logMutation.mutate(type);
  };

  const handleDeduct = (type: OutreachActivityType) => {
    deductMutation.mutate(type);
  };

  if (statsLoading) {
    return (
      <div className="bento-card p-6 animate-pulse">
        <div className="h-6 bg-[--exec-surface-alt] rounded w-40 mb-4" />
        <div className="grid grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-3">
              <div className="w-[72px] h-[72px] bg-[--exec-surface-alt] rounded-full" />
              <div className="h-4 bg-[--exec-surface-alt] rounded w-12" />
              <div className="h-8 bg-[--exec-surface-alt] rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Show fallback data when API fails or data not available
  const defaultStats = {
    date: new Date().toISOString().split('T')[0],
    cold_emails: { current: 0, target: 10, percentage: 0 },
    linkedin: { current: 0, target: 10, percentage: 0 },
    calls: { current: 0, target: 5, percentage: 0 },
    looms: { current: 0, target: 2, percentage: 0 },
    all_targets_met: false,
  };

  const stats = todayStats || defaultStats;

  const activities = [
    {
      label: 'Cold Emails',
      metric: stats.cold_emails,
      icon: <Mail className="w-5 h-5" />,
      color: '--exec-info',
      colorVar: 'var(--exec-info)',
      activityType: 'cold_email' as OutreachActivityType,
    },
    {
      label: 'LinkedIn',
      metric: stats.linkedin,
      icon: <Linkedin className="w-5 h-5" />,
      color: '--exec-accent',
      colorVar: 'var(--exec-accent)',
      activityType: 'linkedin' as OutreachActivityType,
    },
    {
      label: 'Calls',
      metric: stats.calls,
      icon: <Phone className="w-5 h-5" />,
      color: '--exec-sage',
      colorVar: 'var(--exec-sage)',
      activityType: 'call' as OutreachActivityType,
    },
    {
      label: 'Loom Audits',
      metric: stats.looms,
      icon: <Video className="w-5 h-5" />,
      color: '--exec-warning',
      colorVar: 'var(--exec-warning)',
      activityType: 'loom' as OutreachActivityType,
    },
  ];

  return (
    <>
      <div className="bento-card overflow-hidden animate-fade-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[--exec-border-subtle]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[--exec-accent-bg] to-[--exec-accent-bg-subtle] flex items-center justify-center">
              <Mail className="w-5 h-5 text-[--exec-accent]" />
            </div>
            <div>
              <h2 className="font-semibold text-[--exec-text]">Daily Outreach</h2>
              <p className="text-xs text-[--exec-text-muted]">Track your daily targets</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Streak badge */}
            {streak && streak.current_streak > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[--exec-warning-bg] rounded-full">
                <Flame className="w-4 h-4 text-[--exec-warning]" />
                <span className="text-sm font-bold text-[--exec-warning]">
                  {streak.current_streak} day{streak.current_streak !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {/* All targets met badge */}
            {stats.all_targets_met && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[--exec-sage-bg] rounded-full">
                <Check className="w-4 h-4 text-[--exec-sage]" />
                <span className="text-sm font-bold text-[--exec-sage]">Complete!</span>
              </div>
            )}

            {/* Settings button */}
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-[--exec-surface-alt] rounded-lg transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Activity cards */}
        <div className="p-6">
          <div className="grid grid-cols-4 gap-6">
            {activities.map((activity) => (
              <ActivityCard
                key={activity.activityType}
                {...activity}
                onLog={handleLog}
                onDeduct={handleDeduct}
                isLogging={loggingType === activity.activityType}
                isDeducting={deductingType === activity.activityType}
              />
            ))}
          </div>

          {/* Weekly dots */}
          {weekly && (
            <div className="mt-6 pt-5 border-t border-[--exec-border-subtle]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[--exec-text-muted]">This Week</span>
                <div className="flex items-center gap-2">
                  {weekly.days.map((day, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div
                        className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center transition-colors',
                          day.targets_met
                            ? 'bg-[--exec-sage] text-white'
                            : day.cold_emails > 0 || day.linkedin > 0 || day.calls > 0 || day.looms > 0
                              ? 'bg-[--exec-warning-bg] border-2 border-[--exec-warning]'
                              : 'bg-[--exec-surface-alt] border border-[--exec-border-subtle]'
                        )}
                      >
                        {day.targets_met && <Check className="w-3 h-3" />}
                      </div>
                      <span className="text-[10px] text-[--exec-text-muted]">{day.day_name}</span>
                    </div>
                  ))}
                </div>
                <span className="text-xs text-[--exec-text-muted]">
                  {weekly.days_met_target}/7 days
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}
