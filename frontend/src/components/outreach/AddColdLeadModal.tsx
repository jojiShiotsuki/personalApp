import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { inputClasses, primaryButtonClasses, secondaryButtonClasses } from '@/lib/outreachStyles';
import { coldCallsApi } from '@/lib/api';
import { CallProspectCreate, CallStatus } from '@/types';

interface AddColdLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormState {
  business_name: string;
  phone: string;
  facebook_url: string;
  website: string;
  vertical: string;
  source: string;
  notes: string;
}

const INITIAL_FORM: FormState = {
  business_name: '',
  phone: '',
  facebook_url: '',
  website: '',
  vertical: 'Aircon cleaning',
  source: 'FB Ads',
  notes: '',
};

interface AxiosLikeError {
  response?: {
    status?: number;
    data?: { detail?: string };
  };
  message?: string;
}

function isDuplicatePhoneError(err: unknown): boolean {
  const e = err as AxiosLikeError;
  return e?.response?.status === 409;
}

function extractErrorMessage(err: unknown): string {
  const e = err as AxiosLikeError;
  return e?.response?.data?.detail ?? e?.message ?? 'Failed to create lead';
}

export default function AddColdLeadModal({ isOpen, onClose }: AddColdLeadModalProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const resetAndClose = () => {
    setForm(INITIAL_FORM);
    setPhoneError(null);
    onClose();
  };

  const createMutation = useMutation({
    mutationFn: (data: CallProspectCreate) => coldCallsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-prospects'] });
      toast.success('Lead added to New Leads');
      resetAndClose();
    },
    onError: (err: unknown) => {
      if (isDuplicatePhoneError(err)) {
        setPhoneError('Lead with this phone already exists');
        return;
      }
      toast.error(extractErrorMessage(err));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError(null);

    const businessName = form.business_name.trim();
    const phone = form.phone.trim();

    if (!businessName) {
      toast.error('Business name is required');
      return;
    }
    if (!phone) {
      setPhoneError('Phone is required');
      return;
    }

    const payload: CallProspectCreate = {
      business_name: businessName,
      phone,
      facebook_url: form.facebook_url.trim() || undefined,
      website: form.website.trim() || undefined,
      vertical: form.vertical.trim() || undefined,
      source: form.source.trim() || undefined,
      notes: form.notes.trim() || undefined,
      status: CallStatus.NEW,
    };

    createMutation.mutate(payload);
  };

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === 'phone' && phoneError) {
      setPhoneError(null);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-lg mx-4 border border-stone-600/40 transform transition-all animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold text-[--exec-text]">Add Cold Call Lead</h2>
              <p className="text-sm text-[--exec-text-muted] mt-1">
                Drops into New Leads. Use this for one-off prospects you spot in the wild.
              </p>
            </div>
            <button
              type="button"
              onClick={resetAndClose}
              className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Business Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.business_name}
                onChange={(e) => updateField('business_name', e.target.value)}
                className={inputClasses}
                placeholder="e.g., CoolBreeze Aircon Services"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Phone <span className="text-red-400">*</span>
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                className={cn(inputClasses, phoneError && 'border-red-500/60 focus:ring-red-500/20 focus:border-red-500/60')}
                placeholder="09XX XXX XXXX or 032 XXX XXXX"
                required
              />
              {phoneError && (
                <p className="mt-1.5 text-xs text-red-400">{phoneError}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Facebook Page URL
              </label>
              <input
                type="url"
                value={form.facebook_url}
                onChange={(e) => updateField('facebook_url', e.target.value)}
                className={inputClasses}
                placeholder="https://facebook.com/coolbreezeaircon"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Website
              </label>
              <input
                type="url"
                value={form.website}
                onChange={(e) => updateField('website', e.target.value)}
                className={inputClasses}
                placeholder="https://coolbreezeaircon.ph"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                  Category
                </label>
                <input
                  type="text"
                  value={form.vertical}
                  onChange={(e) => updateField('vertical', e.target.value)}
                  className={inputClasses}
                  placeholder="Aircon cleaning"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                  Source
                </label>
                <input
                  type="text"
                  value={form.source}
                  onChange={(e) => updateField('source', e.target.value)}
                  className={inputClasses}
                  placeholder="FB Ads"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Notes
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                className={cn(inputClasses, 'resize-none')}
                rows={4}
                placeholder="Ad creative seen, offer, owner name, anything worth remembering on the call..."
              />
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-stone-700/30 mt-6">
              <button
                type="button"
                onClick={resetAndClose}
                className={secondaryButtonClasses}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className={primaryButtonClasses}
              >
                {createMutation.isPending ? 'Adding...' : 'Add Lead'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
