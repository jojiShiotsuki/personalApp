import { useState } from 'react';
import { X, Monitor, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AuditResult } from '@/types';

interface ScreenshotModalProps {
  audit: AuditResult;
  isOpen: boolean;
  onClose: () => void;
}

export default function ScreenshotModal({ audit, isOpen, onClose }: ScreenshotModalProps) {
  const [activeTab, setActiveTab] = useState<'desktop' | 'mobile'>(
    audit.desktop_screenshot ? 'desktop' : 'mobile'
  );

  if (!isOpen) return null;

  const hasDesktop = !!audit.desktop_screenshot;
  const hasMobile = !!audit.mobile_screenshot;

  const currentScreenshot = activeTab === 'desktop'
    ? audit.desktop_screenshot
    : audit.mobile_screenshot;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-4xl mx-4 border border-stone-600/40 transform transition-all animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 flex flex-col min-h-0">
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-semibold text-[--exec-text]">
                Screenshots
              </h2>
              <p className="text-sm text-[--exec-text-muted] mt-1">
                {audit.prospect_company || audit.prospect_name || `Prospect #${audit.prospect_id}`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab toggle */}
          {hasDesktop && hasMobile && (
            <div className="flex items-center bg-stone-800/50 p-1 rounded-xl mb-4 self-start">
              <button
                onClick={() => setActiveTab('desktop')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                  activeTab === 'desktop'
                    ? 'bg-stone-600/80 text-white shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                )}
              >
                <Monitor className="w-3.5 h-3.5" />
                Desktop
              </button>
              <button
                onClick={() => setActiveTab('mobile')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                  activeTab === 'mobile'
                    ? 'bg-stone-600/80 text-white shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                )}
              >
                <Smartphone className="w-3.5 h-3.5" />
                Mobile
              </button>
            </div>
          )}

          {/* Screenshot display */}
          <div className="overflow-y-auto flex-1 min-h-0 rounded-lg border border-stone-700/30 bg-stone-900/50">
            {currentScreenshot ? (
              <img
                src={`data:image/png;base64,${currentScreenshot}`}
                alt={`${activeTab} screenshot of ${audit.prospect_company || 'prospect website'}`}
                className={cn(
                  'w-full h-auto',
                  activeTab === 'mobile' && 'max-w-sm mx-auto'
                )}
              />
            ) : (
              <div className="flex items-center justify-center h-64 text-[--exec-text-muted] text-sm">
                No {activeTab} screenshot available
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
