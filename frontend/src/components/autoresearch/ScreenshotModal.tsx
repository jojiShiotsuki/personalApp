import { useState } from 'react';
import { createPortal } from 'react-dom';
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

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-[100] p-4 pt-8 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-5xl border border-stone-600/40 animate-in zoom-in-95 fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-stone-700/30">
          <div>
            <h2 className="text-lg font-semibold text-[--exec-text]">
              Website Screenshots
            </h2>
            <p className="text-sm text-[--exec-text-muted] mt-0.5">
              {audit.prospect_company || audit.prospect_name || `Prospect #${audit.prospect_id}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Tab toggle */}
            {hasDesktop && hasMobile && (
              <div className="flex items-center bg-stone-800/50 p-1 rounded-xl">
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
            <button
              onClick={onClose}
              className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Screenshot display */}
        <div className="p-4">
          {currentScreenshot ? (
            <div className={cn(
              'rounded-lg border border-stone-700/30 bg-stone-900/50 overflow-hidden',
              activeTab === 'mobile' && 'max-w-sm mx-auto'
            )}>
              <img
                src={`data:image/png;base64,${currentScreenshot}`}
                alt={`${activeTab} screenshot of ${audit.prospect_company || 'prospect website'}`}
                className="w-full h-auto"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-[--exec-text-muted] text-sm rounded-lg border border-stone-700/30 bg-stone-900/50">
              No {activeTab} screenshot available
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
