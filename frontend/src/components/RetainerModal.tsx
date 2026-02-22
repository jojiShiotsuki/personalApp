import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, RefreshCw, DollarSign, Calendar, FileText } from 'lucide-react';
import { dealApi } from '@/lib/api';
import { BillingFrequency, DealStage, ServiceStatus } from '@/types';
import type { Project } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format, addMonths } from 'date-fns';

const inputClasses = cn(
  "w-full px-4 py-2.5 rounded-lg",
  "bg-stone-800/50 border border-stone-600/40",
  "text-[--exec-text] placeholder:text-[--exec-text-muted]",
  "focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50",
  "transition-all text-sm"
);

const FREQUENCY_OPTIONS: { value: BillingFrequency; label: string; months: number }[] = [
  { value: BillingFrequency.MONTHLY, label: 'Monthly', months: 1 },
  { value: BillingFrequency.QUARTERLY, label: 'Quarterly', months: 3 },
  { value: BillingFrequency.SEMI_ANNUAL, label: 'Semi-Annual', months: 6 },
  { value: BillingFrequency.ANNUAL, label: 'Annual', months: 12 },
];

interface RetainerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  project: Project;
}

export default function RetainerModal({ isOpen, onClose, onSuccess, project }: RetainerModalProps) {
  const queryClient = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');

  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<BillingFrequency>(BillingFrequency.MONTHLY);
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(today);

  const getNextBillingDate = (start: string, freq: BillingFrequency): string => {
    const date = new Date(start + 'T00:00:00');
    const months = FREQUENCY_OPTIONS.find(f => f.value === freq)?.months ?? 1;
    return format(addMonths(date, months), 'yyyy-MM-dd');
  };

  const createServiceMutation = useMutation({
    mutationFn: () =>
      dealApi.create({
        contact_id: project.contact_id!,
        title: `${project.name} - Retainer`,
        description: description || undefined,
        value: parseFloat(amount),
        stage: DealStage.CLOSED_WON,
        probability: 100,
        is_recurring: true,
        billing_frequency: frequency,
        recurring_amount: parseFloat(amount),
        service_status: ServiceStatus.ACTIVE,
        service_start_date: startDate,
        next_billing_date: getNextBillingDate(startDate, frequency),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Retainer service created');
      resetForm();
      onSuccess();
    },
    onError: () => {
      toast.error('Failed to create retainer service');
    },
  });

  const resetForm = () => {
    setAmount('');
    setFrequency(BillingFrequency.MONTHLY);
    setDescription('');
    setStartDate(today);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid retainer amount');
      return;
    }
    createServiceMutation.mutate();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  const nextBilling = getNextBillingDate(startDate, frequency);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-lg mx-4 border border-stone-600/40 transform transition-all animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold text-[--exec-text]">Set Up Retainer</h2>
              <p className="text-sm text-[--exec-text-muted] mt-1">
                Create a recurring service for {project.name}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Retainer Amount */}
            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Retainer Amount <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[--exec-text-muted]" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={cn(inputClasses, 'pl-9')}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            {/* Billing Frequency */}
            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Billing Frequency <span className="text-red-400">*</span>
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as BillingFrequency)}
                className={inputClasses}
              >
                {FREQUENCY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputClasses}
              />
            </div>

            {/* Next Billing Date Preview */}
            <div className="flex items-center gap-2 px-4 py-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <Calendar className="w-4 h-4 text-purple-400 flex-shrink-0" />
              <span className="text-sm text-purple-300">
                Next billing: {format(new Date(nextBilling + 'T00:00:00'), 'MMM d, yyyy')}
              </span>
            </div>

            {/* Description */}
            <div className="pt-4 border-t border-stone-700/30">
              <h3 className="text-sm font-semibold text-[--exec-text] mb-3 flex items-center">
                <FileText className="w-4 h-4 mr-2 text-[--exec-accent]" />
                Additional Details
              </h3>
              <div>
                <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                  Service Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={cn(inputClasses, 'resize-none')}
                  rows={3}
                  placeholder="What does this retainer include?"
                />
              </div>
            </div>

            {/* Summary */}
            <div className="pt-4 border-t border-stone-700/30">
              <h3 className="text-sm font-semibold text-[--exec-text] mb-3 flex items-center">
                <RefreshCw className="w-4 h-4 mr-2 text-[--exec-accent]" />
                Service Summary
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[--exec-text-muted]">Client</span>
                  <span className="text-[--exec-text] font-medium">{project.contact_name || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[--exec-text-muted]">Service</span>
                  <span className="text-[--exec-text] font-medium">{project.name} - Retainer</span>
                </div>
                {amount && (
                  <div className="flex justify-between">
                    <span className="text-[--exec-text-muted]">Amount</span>
                    <span className="text-[--exec-text] font-medium">
                      ${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} / {FREQUENCY_OPTIONS.find(f => f.value === frequency)?.label.toLowerCase()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 justify-end pt-4 border-t border-stone-700/30 mt-6">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createServiceMutation.isPending || !amount}
                className="px-4 py-2 text-sm font-medium text-white bg-[--exec-accent] rounded-lg hover:bg-[--exec-accent-dark] shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createServiceMutation.isPending ? 'Creating...' : 'Create Retainer'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
