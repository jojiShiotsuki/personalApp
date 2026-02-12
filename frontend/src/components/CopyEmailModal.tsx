import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coldOutreachApi } from '@/lib/api';
import type { OutreachProspect, RenderedEmail } from '@/types';
import { X, Mail, Copy, Check, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CopyEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  prospect: OutreachProspect;
}

export default function CopyEmailModal({
  isOpen,
  onClose,
  prospect,
}: CopyEmailModalProps) {
  const [copiedField, setCopiedField] = useState<'to' | 'subject' | 'body' | 'all' | null>(null);
  const queryClient = useQueryClient();

  // Query rendered email
  const { data: email, isLoading, error } = useQuery<RenderedEmail>({
    queryKey: ['rendered-email', prospect.id],
    queryFn: () => coldOutreachApi.renderEmail(prospect.id),
    enabled: isOpen,
  });

  // Mark sent mutation
  const markSentMutation = useMutation({
    mutationFn: () => coldOutreachApi.markSent(prospect.id),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['outreach-today-queue'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-prospects'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-campaign'] });
      onClose();
    },
    onError: () => {
      toast.error('Failed to mark as sent');
    },
  });

  const handleCopy = async (field: 'to' | 'subject' | 'body', value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
      toast.success(`${field.charAt(0).toUpperCase() + field.slice(1)} copied!`);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleCopyAllAndMarkSent = async () => {
    if (!email) return;

    try {
      // Format full email for clipboard
      const fullEmail = `To: ${email.to_email}\nSubject: ${email.subject}\n\n${email.body}`;
      await navigator.clipboard.writeText(fullEmail);
      setCopiedField('all');
      toast.success('Full email copied!');

      // Mark as sent
      markSentMutation.mutate();
    } catch {
      toast.error('Failed to copy email');
    }
  };

  if (!isOpen) return null;

  const CopyButton = ({
    field,
    value,
  }: {
    field: 'to' | 'subject' | 'body';
    value: string;
  }) => (
    <button
      onClick={() => handleCopy(field, value)}
      className={cn(
        'p-1.5 rounded-lg transition-all duration-200',
        'hover:bg-[--exec-surface-alt]',
        copiedField === field
          ? 'text-green-500'
          : 'text-[--exec-text-muted] hover:text-[--exec-text]'
      )}
      title={copiedField === field ? 'Copied!' : 'Copy'}
    >
      {copiedField === field ? (
        <Check className="w-4 h-4" />
      ) : (
        <Copy className="w-4 h-4" />
      )}
    </button>
  );

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-2xl mx-4 border border-stone-600/40 transform transition-all animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[--exec-accent-bg] flex items-center justify-center">
                <Mail className="w-5 h-5 text-[--exec-accent]" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-[--exec-text]">
                  Copy Email
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-[--exec-text-muted]">
                    {prospect.agency_name}
                  </span>
                  <span className="text-xs text-[--exec-text-muted] px-2 py-0.5 bg-[--exec-surface-alt] rounded-full">
                    Step {prospect.current_step}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-[--exec-accent] animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-400 mb-2">Failed to load email template</p>
              <p className="text-sm text-[--exec-text-muted]">
                Make sure you have a template set up for step {prospect.current_step}
              </p>
            </div>
          ) : email ? (
            <div className="space-y-4">
              {/* To Field */}
              <div className="bg-[--exec-surface-alt] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                    To
                  </label>
                  <CopyButton field="to" value={email.to_email} />
                </div>
                <p className="text-sm text-[--exec-text] font-medium">
                  {email.to_email}
                </p>
              </div>

              {/* Subject Field */}
              <div className="bg-[--exec-surface-alt] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                    Subject
                  </label>
                  <CopyButton field="subject" value={email.subject} />
                </div>
                <p className="text-sm text-[--exec-text] font-medium">
                  {email.subject}
                </p>
              </div>

              {/* Body Field */}
              <div className="bg-[--exec-surface-alt] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                    Body
                  </label>
                  <CopyButton field="body" value={email.body} />
                </div>
                <div className="text-sm text-[--exec-text] whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                  {email.body}
                </div>
              </div>
            </div>
          ) : null}

          {/* Footer */}
          <div className="flex gap-3 justify-end pt-6 border-t border-stone-700/30 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCopyAllAndMarkSent}
              disabled={!email || markSentMutation.isPending}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg',
                'bg-[--exec-accent] hover:bg-[--exec-accent-dark]',
                'shadow-sm hover:shadow-md transition-all',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {markSentMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Marking as Sent...
                </>
              ) : copiedField === 'all' ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied & Marking Sent...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Copy All & Mark Sent
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
