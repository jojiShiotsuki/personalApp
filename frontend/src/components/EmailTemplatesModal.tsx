import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coldOutreachApi } from '@/lib/api';
import type { OutreachEmailTemplate, EmailTemplateCreate } from '@/types';
import { X, Info, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface EmailTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: number;
}

const STEP_LABELS = ['Initial', 'Follow-up 1', 'Follow-up 2', 'Follow-up 3', 'Final'];
const AVAILABLE_VARIABLES = ['{agency_name}', '{contact_name}', '{niche}', '{website}'];

export default function EmailTemplatesModal({
  isOpen,
  onClose,
  campaignId,
}: EmailTemplatesModalProps) {
  const [selectedStep, setSelectedStep] = useState(1);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  const queryClient = useQueryClient();

  // Query templates for this campaign
  const { data: templates = [] } = useQuery<OutreachEmailTemplate[]>({
    queryKey: ['outreach-templates', campaignId],
    queryFn: () => coldOutreachApi.getTemplates(campaignId),
    enabled: isOpen && !!campaignId,
  });

  // Find template for the selected step
  const currentTemplate = templates.find((t) => t.step_number === selectedStep);

  // Load template content when step is selected or templates change
  useEffect(() => {
    if (currentTemplate) {
      setSubject(currentTemplate.subject);
      setBody(currentTemplate.body);
    } else {
      setSubject('');
      setBody('');
    }
    setIsDirty(false);
  }, [currentTemplate, selectedStep]);

  // Save mutation (upserts by step_number)
  const saveMutation = useMutation({
    mutationFn: (data: EmailTemplateCreate) =>
      coldOutreachApi.createTemplate(campaignId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-templates', campaignId] });
      toast.success(`Step ${selectedStep} template saved`);
      setIsDirty(false);
    },
    onError: () => {
      toast.error('Failed to save template');
    },
  });

  const handleSave = () => {
    if (!subject.trim() || !body.trim()) {
      toast.error('Please fill in both subject and body');
      return;
    }
    saveMutation.mutate({
      step_number: selectedStep,
      subject: subject.trim(),
      body: body.trim(),
    });
  };

  const handleClose = () => {
    if (isDirty) {
      if (!confirm('You have unsaved changes. Discard them?')) {
        return;
      }
    }
    onClose();
  };

  const handleStepChange = (step: number) => {
    if (isDirty) {
      if (!confirm('You have unsaved changes. Discard them?')) {
        return;
      }
    }
    setSelectedStep(step);
  };

  // Check which steps have templates
  const stepsWithTemplates = new Set(templates.map((t) => t.step_number));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-2xl mx-4 border border-[--exec-border] animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[--exec-border-subtle]">
          <h2 className="text-lg font-semibold text-[--exec-text]">
            Email Templates
          </h2>
          <button
            onClick={handleClose}
            className="text-[--exec-text-muted] hover:text-[--exec-text] p-1 hover:bg-[--exec-surface-alt] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Tabs */}
        <div className="flex flex-wrap items-center gap-2 px-6 py-4 border-b border-[--exec-border-subtle]" style={{ backgroundColor: '#1C1917' }}>
          {[1, 2, 3, 4, 5].map((step) => (
            <button
              key={step}
              onClick={() => handleStepChange(step)}
              className={cn(
                'relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                selectedStep === step
                  ? 'text-white shadow-lg scale-105'
                  : stepsWithTemplates.has(step)
                    ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30 hover:scale-105'
                    : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600 hover:text-white hover:scale-105'
              )}
              style={selectedStep === step ? { backgroundColor: 'var(--exec-accent)' } : undefined}
            >
              <span className="w-5 h-5 rounded-full bg-black/20 flex items-center justify-center text-xs">
                {step}
              </span>
              <span>{STEP_LABELS[step - 1]}</span>
              {/* Check indicator for steps with templates */}
              {stepsWithTemplates.has(step) && (
                <Check className={cn(
                  'w-4 h-4',
                  selectedStep === step ? 'text-white' : 'text-green-400'
                )} />
              )}
            </button>
          ))}
        </div>

        {/* Current Step Info */}
        <div className="px-6 pt-4 flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ backgroundColor: 'var(--exec-accent)' }}
          >
            {selectedStep}
          </div>
          <div>
            <h3 className="text-base font-semibold text-[--exec-text]">
              {STEP_LABELS[selectedStep - 1]}
            </h3>
            <p className="text-xs text-[--exec-text-muted]">
              {currentTemplate ? (
                <span className="text-green-400 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Template configured
                </span>
              ) : (
                'No template yet - create one below'
              )}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 flex-1 overflow-auto space-y-4">
          {/* Subject Line */}
          <div>
            <label
              htmlFor="template-subject"
              className="block text-sm font-medium text-[--exec-text-secondary] mb-2"
            >
              Subject Line
            </label>
            <input
              id="template-subject"
              type="text"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setIsDirty(true);
              }}
              placeholder="e.g., Quick question about {agency_name}"
              className={cn(
                'w-full px-4 py-2.5 rounded-xl',
                'bg-[--exec-surface-alt] border border-[--exec-border]',
                'text-[--exec-text] placeholder:text-[--exec-text-muted]',
                'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]',
                'transition-all duration-200'
              )}
            />
          </div>

          {/* Body */}
          <div>
            <label
              htmlFor="template-body"
              className="block text-sm font-medium text-[--exec-text-secondary] mb-2"
            >
              Body
            </label>
            <textarea
              id="template-body"
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                setIsDirty(true);
              }}
              placeholder="Hi {contact_name},&#10;&#10;I noticed your agency {agency_name} works in the {niche} space..."
              rows={10}
              className={cn(
                'w-full px-4 py-2.5 rounded-xl resize-none',
                'bg-[--exec-surface-alt] border border-[--exec-border]',
                'text-[--exec-text] placeholder:text-[--exec-text-muted]',
                'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]',
                'transition-all duration-200'
              )}
            />
          </div>

          {/* Variables Help Box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
                  Available Variables
                </h4>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_VARIABLES.map((variable) => (
                    <button
                      key={variable}
                      type="button"
                      onClick={() => {
                        // Insert variable at cursor position in body
                        const textarea = document.getElementById('template-body') as HTMLTextAreaElement;
                        if (textarea) {
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const newBody = body.substring(0, start) + variable + body.substring(end);
                          setBody(newBody);
                          setIsDirty(true);
                          // Set cursor position after variable
                          setTimeout(() => {
                            textarea.focus();
                            textarea.setSelectionRange(start + variable.length, start + variable.length);
                          }, 0);
                        }
                      }}
                      className={cn(
                        'px-2 py-1 rounded-lg text-xs font-mono',
                        'bg-blue-100 dark:bg-blue-800/50',
                        'text-blue-700 dark:text-blue-300',
                        'hover:bg-blue-200 dark:hover:bg-blue-800',
                        'transition-colors cursor-pointer'
                      )}
                    >
                      {variable}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                  Click a variable to insert it at cursor position in the body.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 justify-end px-6 py-4 border-t border-[--exec-border-subtle]">
          <button
            type="button"
            onClick={handleClose}
            className={cn(
              'px-5 py-2.5 rounded-xl font-medium',
              'bg-slate-600/50 text-slate-300',
              'hover:bg-slate-500 hover:text-white hover:scale-105',
              'active:scale-95 transition-all duration-200'
            )}
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saveMutation.isPending || !subject.trim() || !body.trim()}
            className={cn(
              'px-5 py-2.5 rounded-xl font-medium',
              'bg-[--exec-accent] text-white',
              'hover:brightness-110 hover:scale-105 hover:shadow-lg',
              'active:scale-95 transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'
            )}
          >
            {saveMutation.isPending ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  );
}
