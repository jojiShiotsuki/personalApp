import { X, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  if (!open) return null;

  const shortcuts = [
    { keys: ['Ctrl', 'K'], description: 'Open command palette' },
    { keys: ['Ctrl', 'N'], description: 'Quick add task' },
    { keys: ['/'], description: 'Focus search' },
    { keys: ['?'], description: 'Show keyboard shortcuts' },
    { keys: ['Esc'], description: 'Close modal / cancel' },
  ];

  const navShortcuts = [
    { keys: ['Alt', '1'], description: 'Dashboard' },
    { keys: ['Alt', '2'], description: 'Tasks' },
    { keys: ['Alt', '3'], description: 'Sprint' },
    { keys: ['Alt', '4'], description: 'Contacts' },
    { keys: ['Alt', '5'], description: 'Deals' },
    { keys: ['Alt', '6'], description: 'Projects' },
    { keys: ['Alt', '7'], description: 'Goals' },
    { keys: ['Alt', '8'], description: 'Time' },
    { keys: ['Alt', '9'], description: 'Settings' },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-stone-600/40 transform transition-all animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[--exec-accent]/10 rounded-lg">
                <Keyboard className="w-5 h-5 text-[--exec-accent]" />
              </div>
              <h2 className="text-xl font-semibold text-[--exec-text]">Keyboard Shortcuts</h2>
            </div>
            <button
              onClick={onClose}
              className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider px-3 mb-2">General</p>
            {shortcuts.map((shortcut, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-stone-700/30 transition-colors">
                <span className="text-sm text-[--exec-text-secondary]">{shortcut.description}</span>
                <div className="flex items-center gap-1">
                  {shortcut.keys.map((key, j) => (
                    <span key={j}>
                      {j > 0 && <span className="text-[--exec-text-muted] mx-1">+</span>}
                      <kbd className="px-2 py-1 text-xs font-mono bg-stone-800/80 border border-stone-600/40 rounded-md text-[--exec-text-secondary]">
                        {key}
                      </kbd>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-stone-700/30 space-y-1">
            <p className="text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider px-3 mb-2">Navigation</p>
            {navShortcuts.map((shortcut, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-stone-700/30 transition-colors">
                <span className="text-sm text-[--exec-text-secondary]">{shortcut.description}</span>
                <div className="flex items-center gap-1">
                  {shortcut.keys.map((key, j) => (
                    <span key={j}>
                      {j > 0 && <span className="text-[--exec-text-muted] mx-1">+</span>}
                      <kbd className="px-2 py-1 text-xs font-mono bg-stone-800/80 border border-stone-600/40 rounded-md text-[--exec-text-secondary]">
                        {key}
                      </kbd>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-stone-700/30">
            <p className="text-xs text-[--exec-text-muted] text-center">
              Press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-stone-800/80 border border-stone-600/40 rounded">?</kbd> anywhere to show this dialog
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
