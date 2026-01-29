import { Settings as SettingsIcon } from 'lucide-react';
import { useTheme } from '../components/ThemeProvider';
import { cn } from '../lib/utils';

export default function Settings() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex flex-col h-full bg-[--exec-bg]">
      {/* Header */}
      <div className="px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[--exec-text] tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              Settings
            </h1>
            <p className="mt-1 text-sm text-[--exec-text-muted]">
              Configure your application preferences
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="max-w-3xl">
          {/* Appearance Section */}
          <div className="bento-card-static p-6 mb-6">
            <div className="flex items-center gap-3 mb-6">
              <SettingsIcon className="w-6 h-6 text-[--exec-accent]" />
              <h2 className="text-lg font-semibold text-[--exec-text]">
                Appearance
              </h2>
            </div>

            {/* Theme Selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-3">
                Theme
              </label>
              <div className="flex gap-2">
                {[
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                  { value: 'system', label: 'System' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setTheme(option.value as 'light' | 'dark' | 'system')}
                    className={cn(
                      'flex-1 px-4 py-3 rounded-lg border transition-all duration-200',
                      'text-center',
                      theme === option.value
                        ? 'bg-[--exec-accent]/10 border-[--exec-accent] text-[--exec-accent]'
                        : 'bg-stone-800/50 border-stone-600/40 text-[--exec-text-secondary] hover:border-stone-500'
                    )}
                  >
                    <div className="text-sm font-medium">
                      {option.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
