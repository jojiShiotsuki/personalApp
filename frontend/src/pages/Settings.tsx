import { useState } from 'react';
import { Settings as SettingsIcon, Moon, DollarSign, Database, Download, Keyboard, RefreshCw, Mail } from 'lucide-react';
import { CURRENCY_OPTIONS, getCurrencySymbol, setCurrencySymbol } from '@/lib/currency';
import { exportApi, jojiAiApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function Settings() {
  const [currency, setCurrency] = useState(getCurrencySymbol());
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isSyncingGmail, setIsSyncingGmail] = useState(false);

  const handleCurrencyChange = (symbol: string) => {
    setCurrencySymbol(symbol);
    setCurrency(symbol);
    toast.success('Currency updated — refresh pages to see changes');
  };

  const handleGmailSync = async () => {
    setIsSyncingGmail(true);
    try {
      const result = await jojiAiApi.gmailVaultSyncNow();
      if (result.status === 'skipped') {
        toast.info(result.reason || 'Gmail not connected');
      } else {
        toast.success(`Gmail synced — ${result.threads_indexed || 0} new threads indexed`);
      }
    } catch {
      toast.error('Gmail sync failed');
    } finally {
      setIsSyncingGmail(false);
    }
  };

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      await exportApi.downloadBackup();
      toast.success('Backup downloaded');
    } catch {
      toast.error('Failed to download backup');
    } finally {
      setIsBackingUp(false);
    }
  };

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

          {/* Currency Section */}
          <div className="bento-card-static p-6 mb-6">
            <div className="flex items-center gap-3 mb-6">
              <DollarSign className="w-6 h-6 text-[--exec-accent]" />
              <h2 className="text-lg font-semibold text-[--exec-text]">
                Currency
              </h2>
            </div>

            <p className="text-sm text-[--exec-text-muted] mb-4">
              Choose the currency symbol used throughout the app for deals, revenue, and budgets.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CURRENCY_OPTIONS.map((opt) => (
                <button
                  key={opt.code}
                  onClick={() => handleCurrencyChange(opt.symbol)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                    currency === opt.symbol
                      ? 'bg-[--exec-accent] text-white shadow-sm'
                      : 'bg-stone-800/50 border border-stone-600/40 text-stone-300 hover:bg-stone-700/50 hover:border-stone-500/50'
                  )}
                >
                  <span className="text-lg font-bold">{opt.symbol}</span>
                  <span className="text-xs opacity-80">{opt.code}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Data Section */}
          <div className="bento-card-static p-6 mb-6">
            <div className="flex items-center gap-3 mb-6">
              <Database className="w-6 h-6 text-[--exec-accent]" />
              <h2 className="text-lg font-semibold text-[--exec-text]">
                Data
              </h2>
            </div>

            <p className="text-sm text-[--exec-text-muted] mb-4">
              Export a complete backup of all your data as JSON. Includes contacts, deals, tasks, projects, time entries, and goals.
            </p>

            <button
              onClick={handleBackup}
              disabled={isBackingUp}
              className={cn(
                'flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                'bg-stone-800/50 border border-stone-600/40 text-stone-200',
                'hover:bg-stone-700/50 hover:border-stone-500/50',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isBackingUp ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download Full Backup
                </>
              )}
            </button>
          </div>

          {/* Sync Section */}
          <div className="bento-card-static p-6 mb-6">
            <div className="flex items-center gap-3 mb-6">
              <RefreshCw className="w-6 h-6 text-[--exec-accent]" />
              <h2 className="text-lg font-semibold text-[--exec-text]">
                Sync
              </h2>
            </div>

            <p className="text-sm text-[--exec-text-muted] mb-4">
              Manually trigger a Gmail-to-vault sync. This runs automatically every 30 minutes, but you can kick it off now.
            </p>

            <button
              onClick={handleGmailSync}
              disabled={isSyncingGmail}
              className={cn(
                'flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                'bg-stone-800/50 border border-stone-600/40 text-stone-200',
                'hover:bg-stone-700/50 hover:border-stone-500/50',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isSyncingGmail ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Syncing Gmail...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  Sync Gmail to Vault
                </>
              )}
            </button>
          </div>

          {/* Keyboard Shortcuts Section */}
          <div className="bento-card-static p-6 mb-6">
            <div className="flex items-center gap-3 mb-6">
              <Keyboard className="w-6 h-6 text-[--exec-accent]" />
              <h2 className="text-lg font-semibold text-[--exec-text]">
                Keyboard Shortcuts
              </h2>
            </div>

            <div className="space-y-2">
              {[
                { keys: 'Ctrl + K', desc: 'Open command palette' },
                { keys: 'Ctrl + N', desc: 'Quick add task' },
                { keys: '/', desc: 'Focus search' },
                { keys: '?', desc: 'Show all shortcuts' },
                { keys: 'Alt + 1-9', desc: 'Navigate to page' },
              ].map(({ keys, desc }) => (
                <div key={keys} className="flex items-center justify-between py-2 px-3 rounded-lg bg-stone-800/30">
                  <span className="text-sm text-[--exec-text-secondary]">{desc}</span>
                  <kbd className="px-2.5 py-1 text-xs font-mono bg-stone-800/80 border border-stone-600/40 rounded-md text-[--exec-text-secondary]">
                    {keys}
                  </kbd>
                </div>
              ))}
            </div>

            <p className="text-xs text-[--exec-text-muted] mt-3">
              Press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-stone-800/80 border border-stone-600/40 rounded">?</kbd> anywhere to see the full shortcut list.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
