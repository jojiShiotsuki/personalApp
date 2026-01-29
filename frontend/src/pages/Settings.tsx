import { Settings as SettingsIcon, Moon } from 'lucide-react';

export default function Settings() {
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

            {/* Theme Info */}
            <div className="flex items-center gap-3 p-4 rounded-lg bg-stone-800/50 border border-stone-600/40">
              <Moon className="w-5 h-5 text-[--exec-accent]" />
              <div>
                <div className="text-sm font-medium text-[--exec-text]">Dark Mode</div>
                <div className="text-xs text-[--exec-text-muted]">Default theme for optimal viewing</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
