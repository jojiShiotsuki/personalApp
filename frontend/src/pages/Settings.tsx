import { Settings as SettingsIcon, Brain, Clock } from 'lucide-react';
import { useCoach } from '../contexts/CoachContext';
import { cn } from '../lib/utils';

export default function Settings() {
  const { settings, updateSettings } = useCoach();

  const coachLevels = [
    { value: 1, label: 'Minimal', description: 'Only critical business alerts' },
    { value: 2, label: 'Balanced', description: 'Helpful nudges at key moments' },
    { value: 3, label: 'Active Coach', description: 'Proactive tips and observations' },
  ] as const;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200/60 dark:border-slate-700/60 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              Settings
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              Configure your coaching preferences and alerts
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="max-w-3xl">
          {/* AI Business Coach Section */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 mb-6">
            <div className="flex items-center gap-3 mb-6">
              <Brain className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                AI Business Coach
              </h2>
            </div>

            {/* Enable/Disable Toggle */}
            <div className="mb-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.coach_enabled}
                  onChange={(e) => updateSettings({ coach_enabled: e.target.checked })}
                  className="w-4 h-4 text-blue-600 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:focus:ring-blue-400"
                />
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    Enable AI Business Coach
                  </div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">
                    Get proactive insights and recommendations to grow your business
                  </div>
                </div>
              </label>
            </div>

            {/* Coaching Intensity Selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">
                Coaching Intensity
              </label>
              <div className="flex gap-2">
                {coachLevels.map((level) => (
                  <button
                    key={level.value}
                    onClick={() => updateSettings({ coach_level: level.value })}
                    disabled={!settings.coach_enabled}
                    className={cn(
                      'flex-1 px-4 py-3 rounded-lg border transition-all duration-200',
                      'text-left',
                      settings.coach_level === level.value
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 dark:border-blue-600'
                        : 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500',
                      !settings.coach_enabled && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <div className={cn(
                      'text-sm font-medium mb-1',
                      settings.coach_level === level.value
                        ? 'text-blue-700 dark:text-blue-300'
                        : 'text-gray-900 dark:text-white'
                    )}>
                      {level.label}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-slate-400">
                      {level.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Alert Thresholds */}
            <div className="border-t border-gray-100 dark:border-slate-700 pt-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-gray-400 dark:text-slate-500" />
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                  Alert Thresholds
                </h3>
              </div>

              <div className="space-y-4">
                {/* Stale Lead Days */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                    Stale Lead Alert (days)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="90"
                      value={settings.stale_lead_days}
                      onChange={(e) => updateSettings({ stale_lead_days: parseInt(e.target.value) || 7 })}
                      disabled={!settings.coach_enabled}
                      className={cn(
                        'w-24 px-3 py-2',
                        'bg-gray-50 dark:bg-slate-700',
                        'border border-gray-200 dark:border-slate-600 rounded-lg',
                        'text-gray-900 dark:text-white',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
                        'transition-all duration-200',
                        !settings.coach_enabled && 'opacity-50 cursor-not-allowed'
                      )}
                    />
                    <span className="text-sm text-gray-500 dark:text-slate-400">
                      Alert me when leads haven't been contacted in this many days
                    </span>
                  </div>
                </div>

                {/* Stuck Deal Days */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                    Stuck Deal Alert (days)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="180"
                      value={settings.stuck_deal_days}
                      onChange={(e) => updateSettings({ stuck_deal_days: parseInt(e.target.value) || 14 })}
                      disabled={!settings.coach_enabled}
                      className={cn(
                        'w-24 px-3 py-2',
                        'bg-gray-50 dark:bg-slate-700',
                        'border border-gray-200 dark:border-slate-600 rounded-lg',
                        'text-gray-900 dark:text-white',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
                        'transition-all duration-200',
                        !settings.coach_enabled && 'opacity-50 cursor-not-allowed'
                      )}
                    />
                    <span className="text-sm text-gray-500 dark:text-slate-400">
                      Alert me when deals are stuck in a stage for this many days
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Note */}
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Note:</strong> The AI Business Coach analyzes your CRM activity in real-time and provides
                contextual recommendations based on your coaching intensity level.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
