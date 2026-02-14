import { createPortal } from 'react-dom';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'default';
  isLoading?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: 'text-red-400',
      iconBg: 'bg-red-500/20',
      button: 'bg-red-600 hover:bg-red-700 text-white',
    },
    warning: {
      icon: 'text-amber-400',
      iconBg: 'bg-amber-500/20',
      button: 'bg-amber-600 hover:bg-amber-700 text-white',
    },
    default: {
      icon: 'text-blue-400',
      iconBg: 'bg-blue-500/20',
      button: 'bg-[--exec-accent] hover:bg-[--exec-accent-dark] text-white',
    },
  };

  const styles = variantStyles[variant];

  // Use portal to render modal outside parent DOM tree
  // This prevents hover state conflicts with parent components
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-[--exec-surface] rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden border border-stone-600/40">
        <div className="flex items-center justify-between p-4 border-b border-stone-700/30">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${styles.iconBg}`}>
              <AlertTriangle className={`w-5 h-5 ${styles.icon}`} />
            </div>
            <h3 className="text-lg font-semibold text-[--exec-text]">
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[--exec-text-muted] hover:text-[--exec-text] rounded-lg hover:bg-stone-700/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">
          <p className="text-[--exec-text-secondary]">{message}</p>
        </div>
        <div className="flex justify-end gap-3 p-4 border-t border-stone-700/30 bg-stone-800/30">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${styles.button}`}
          >
            {isLoading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
