import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dealApi, contactApi } from '@/lib/api';
import type { Deal, Contact } from '@/types';
import { BillingFrequency, ServiceStatus } from '@/types';
import { RefreshCw, DollarSign, AlertCircle, CheckCircle, PauseCircle, Clock, X, Edit2, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const billingFrequencyLabels: Record<string, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semi_annual: 'Semi-Annual',
  annual: 'Annual',
};

const serviceStatusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  active: { label: 'Active', color: 'bg-[--exec-success-bg] text-[--exec-success]', icon: CheckCircle },
  paused: { label: 'Paused', color: 'bg-[--exec-warning-bg] text-[--exec-warning]', icon: PauseCircle },
  pending: { label: 'Pending', color: 'bg-[--exec-info-bg] text-[--exec-info]', icon: Clock },
  cancelled: { label: 'Cancelled', color: 'bg-[--exec-danger-bg] text-[--exec-danger]', icon: AlertCircle },
};

// Convert any billing frequency to monthly amount for MRR calculation
const getMonthlyAmount = (amount: number, frequency: string): number => {
  switch (frequency) {
    case 'monthly': return amount;
    case 'quarterly': return amount / 3;
    case 'semi_annual': return amount / 6;
    case 'annual': return amount / 12;
    default: return amount;
  }
};

export default function Services() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Deal | null>(null);
  const queryClient = useQueryClient();

  const { data: deals = [] } = useQuery({
    queryKey: ['deals'],
    queryFn: () => dealApi.getAll(),
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => contactApi.getAll(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Deal> }) =>
      dealApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      setIsEditModalOpen(false);
      setEditingService(null);
      toast.success('Service updated successfully');
    },
    onError: () => {
      toast.error('Failed to update service. Please try again.');
    },
  });

  // Filter to only recurring deals (services)
  const services = useMemo(() => {
    return deals.filter((deal: Deal) => deal.is_recurring);
  }, [deals]);

  // Apply status filter
  const filteredServices = useMemo(() => {
    if (statusFilter === 'all') return services;
    return services.filter((service: Deal) => service.service_status === statusFilter);
  }, [services, statusFilter]);

  // Sort by next billing date (soonest first, null last)
  const sortedServices = useMemo(() => {
    return [...filteredServices].sort((a: Deal, b: Deal) => {
      if (!a.next_billing_date && !b.next_billing_date) return 0;
      if (!a.next_billing_date) return 1;
      if (!b.next_billing_date) return -1;
      return new Date(a.next_billing_date).getTime() - new Date(b.next_billing_date).getTime();
    });
  }, [filteredServices]);

  // Calculate MRR (Monthly Recurring Revenue) for active services only
  const monthlyRecurringRevenue = useMemo(() => {
    return services
      .filter((s: Deal) => s.service_status === 'active')
      .reduce((total: number, service: Deal) => {
        if (service.recurring_amount && service.billing_frequency) {
          return total + getMonthlyAmount(Number(service.recurring_amount), service.billing_frequency);
        }
        return total;
      }, 0);
  }, [services]);

  // Calculate ARR (Annual Recurring Revenue)
  const annualRecurringRevenue = monthlyRecurringRevenue * 12;

  // Get contact name by ID
  const getContactName = (contactId: number): string => {
    const contact = contacts.find((c: Contact) => c.id === contactId);
    return contact?.name || 'Unknown';
  };

  // Check if billing is overdue or upcoming
  const getBillingStatus = (nextBillingDate: string | undefined): 'overdue' | 'upcoming' | 'normal' => {
    if (!nextBillingDate) return 'normal';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const billingDate = new Date(nextBillingDate);
    const daysUntil = Math.ceil((billingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) return 'overdue';
    if (daysUntil <= 7) return 'upcoming';
    return 'normal';
  };

  const handleEditService = (service: Deal) => {
    setEditingService(service);
    setIsEditModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingService) return;

    const formData = new FormData(e.currentTarget);

    // Validate required fields
    const billingFrequency = formData.get('billing_frequency') as string;
    if (!billingFrequency) {
      toast.error('Please select a billing frequency');
      return;
    }

    const recurringAmountStr = formData.get('recurring_amount') as string;
    const recurringAmount = parseFloat(recurringAmountStr);
    if (recurringAmountStr && (isNaN(recurringAmount) || recurringAmount < 0)) {
      toast.error('Please enter a valid recurring amount');
      return;
    }

    const data = {
      is_recurring: true,
      billing_frequency: billingFrequency as BillingFrequency,
      recurring_amount: recurringAmount || undefined,
      next_billing_date: formData.get('next_billing_date') as string || undefined,
      service_status: formData.get('service_status') as ServiceStatus,
      service_start_date: formData.get('service_start_date') as string || undefined,
    };

    updateMutation.mutate({ id: editingService.id, data });
  };

  return (
    <div className="min-h-full bg-[--exec-bg] grain">
      {/* Hero Header */}
      <header className="relative overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[--exec-surface] via-[--exec-surface] to-[--exec-accent-bg-subtle]" />

        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-[--exec-accent]/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-gradient-to-t from-[--exec-sage]/5 to-transparent rounded-full blur-2xl" />

        <div className="relative px-8 pt-8 pb-6">
          {/* Breadcrumb chip */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[--exec-surface-alt] rounded-full mb-4 animate-fade-slide-up">
            <RefreshCw className="w-3.5 h-3.5 text-[--exec-accent]" />
            <span className="text-xs font-medium text-[--exec-text-secondary]">Revenue Tracking</span>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-4xl font-bold text-[--exec-text] tracking-tight animate-fade-slide-up delay-1" style={{ fontFamily: 'var(--font-display)' }}>
                Recurring <span className="text-[--exec-accent]">Services</span>
              </h1>
              <p className="text-[--exec-text-secondary] mt-2 text-lg animate-fade-slide-up delay-2">
                Track and manage your recurring client services and subscriptions
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="px-8 py-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4">
          {/* MRR - Hero metric */}
          <div className="bento-card p-6 animate-fade-slide-up delay-1 card-glow">
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[--exec-success] to-[--exec-sage] flex items-center justify-center shadow-lg">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs font-bold text-[--exec-success] bg-[--exec-success-bg] px-2.5 py-1 rounded-full">
                MRR
              </span>
            </div>
            <p className="text-3xl font-bold text-[--exec-text] mt-4" style={{ fontFamily: 'var(--font-display)' }}>
              ${monthlyRecurringRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-sm text-[--exec-text-muted] mt-1 font-medium">Monthly Recurring</p>
          </div>

          {/* ARR */}
          <div className="bento-card p-6 animate-fade-slide-up delay-2">
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-2xl bg-[--exec-info-bg] flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-[--exec-info]" />
              </div>
              <span className="text-xs font-medium text-[--exec-text-muted] bg-[--exec-surface-alt] px-2.5 py-1 rounded-full">
                ARR
              </span>
            </div>
            <p className="text-3xl font-bold text-[--exec-text] mt-4" style={{ fontFamily: 'var(--font-display)' }}>
              ${annualRecurringRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p className="text-sm text-[--exec-text-muted] mt-1 font-medium">Annual Recurring</p>
          </div>

          {/* Active Services */}
          <div className="bento-card p-6 animate-fade-slide-up delay-3">
            <div className="w-12 h-12 rounded-2xl bg-[--exec-sage-bg] flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-[--exec-sage]" />
            </div>
            <p className="text-3xl font-bold text-[--exec-text] mt-4" style={{ fontFamily: 'var(--font-display)' }}>
              {services.filter((s: Deal) => s.service_status === 'active').length}
            </p>
            <p className="text-sm text-[--exec-text-muted] mt-1 font-medium">Active Services</p>
          </div>

          {/* Total Services */}
          <div className="bento-card p-6 animate-fade-slide-up delay-4">
            <div className="w-12 h-12 rounded-2xl bg-[--exec-accent-bg] flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-[--exec-accent]" />
            </div>
            <p className="text-3xl font-bold text-[--exec-text] mt-4" style={{ fontFamily: 'var(--font-display)' }}>
              {services.length}
            </p>
            <p className="text-sm text-[--exec-text-muted] mt-1 font-medium">Total Services</p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="mt-6 mb-4 flex items-center gap-2 animate-fade-slide-up delay-5">
          {[
            { value: 'all', label: 'All Services' },
            { value: 'active', label: 'Active' },
            { value: 'pending', label: 'Pending' },
            { value: 'paused', label: 'Paused' },
            { value: 'cancelled', label: 'Cancelled' },
          ].map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200",
                statusFilter === filter.value
                  ? "bg-[--exec-accent-bg] text-[--exec-accent] shadow-sm"
                  : "text-[--exec-text-muted] hover:bg-[--exec-surface-alt] hover:text-[--exec-text-secondary]"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Services List */}
        {sortedServices.length === 0 ? (
          <div className="bento-card-static p-12 text-center animate-fade-slide-up delay-6">
            <div className="w-14 h-14 bg-[--exec-surface-alt] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <RefreshCw className="w-7 h-7 text-[--exec-text-muted]" />
            </div>
            <h3 className="font-semibold text-[--exec-text] mb-2" style={{ fontFamily: 'var(--font-display)' }}>No recurring services</h3>
            <p className="text-[--exec-text-muted] text-sm">
              Create a deal and mark it as recurring to track it here.
            </p>
          </div>
        ) : (
          <div className="bento-card-static overflow-hidden animate-fade-slide-up delay-6">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-[--exec-border-subtle]">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[--exec-text-muted] uppercase tracking-wider">
                    Service
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[--exec-text-muted] uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[--exec-text-muted] uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[--exec-text-muted] uppercase tracking-wider">
                    Frequency
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[--exec-text-muted] uppercase tracking-wider">
                    Next Billing
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[--exec-text-muted] uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-[--exec-text-muted] uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[--exec-border-subtle]">
                {sortedServices.map((service: Deal, idx: number) => {
                  const billingStatus = getBillingStatus(service.next_billing_date);
                  const statusConfig = service.service_status
                    ? serviceStatusConfig[service.service_status]
                    : serviceStatusConfig.pending;
                  const StatusIcon = statusConfig.icon;

                  return (
                    <tr
                      key={service.id}
                      className="group hover:bg-[--exec-surface-alt] transition-colors duration-200"
                      style={{ animationDelay: `${(idx + 7) * 50}ms` }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-[--exec-text] group-hover:text-[--exec-accent] transition-colors">{service.title}</div>
                        {service.description && (
                          <div className="text-xs text-[--exec-text-muted] truncate max-w-xs">{service.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-[--exec-text-secondary]">{getContactName(service.contact_id)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-[--exec-success]" style={{ fontFamily: 'var(--font-display)' }}>
                          ${Number(service.recurring_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-[--exec-text-muted]">
                          ${getMonthlyAmount(Number(service.recurring_amount || 0), service.billing_frequency || 'monthly').toLocaleString('en-US', { minimumFractionDigits: 2 })}/mo
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-[--exec-text-secondary] bg-[--exec-surface-alt] px-2.5 py-1 rounded-lg">
                          {service.billing_frequency ? billingFrequencyLabels[service.billing_frequency] : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {service.next_billing_date ? (
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-sm font-medium",
                              billingStatus === 'overdue' ? 'text-[--exec-danger]' :
                              billingStatus === 'upcoming' ? 'text-[--exec-warning]' :
                              'text-[--exec-text-secondary]'
                            )}>
                              {new Date(service.next_billing_date).toLocaleDateString()}
                            </span>
                            {billingStatus === 'overdue' && (
                              <span className="text-xs bg-[--exec-danger-bg] text-[--exec-danger] px-2 py-0.5 rounded-full font-medium">Overdue</span>
                            )}
                            {billingStatus === 'upcoming' && (
                              <span className="text-xs bg-[--exec-warning-bg] text-[--exec-warning] px-2 py-0.5 rounded-full font-medium">Soon</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-[--exec-text-muted]">Not set</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleEditService(service)}
                          className="p-2 text-[--exec-text-muted] hover:text-[--exec-accent] hover:bg-[--exec-accent-bg] rounded-xl transition-all duration-200"
                          title="Edit service"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && editingService && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-[--exec-border-subtle] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[--exec-border-subtle]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[--exec-accent-bg] flex items-center justify-center">
                  <Edit2 className="w-5 h-5 text-[--exec-accent]" />
                </div>
                <h2 className="text-xl font-bold text-[--exec-text]" style={{ fontFamily: 'var(--font-display)' }}>Edit Service</h2>
              </div>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingService(null);
                }}
                className="p-2 text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-[--exec-surface-alt] rounded-xl transition-all duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-[--exec-text-secondary] mb-2">
                  Service Name
                </label>
                <input
                  type="text"
                  value={editingService.title}
                  disabled
                  className="w-full px-4 py-2.5 border border-[--exec-border] rounded-xl bg-[--exec-surface-alt] text-[--exec-text-muted] cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[--exec-text-secondary] mb-2">
                  Billing Frequency
                </label>
                <select
                  name="billing_frequency"
                  defaultValue={editingService.billing_frequency || ''}
                  className="w-full px-4 py-2.5 border border-[--exec-border] rounded-xl focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent] bg-[--exec-surface] text-[--exec-text] transition-all duration-200 cursor-pointer"
                >
                  <option value="">Select frequency</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="semi_annual">Semi-Annual</option>
                  <option value="annual">Annual</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[--exec-text-secondary] mb-2">
                  Recurring Amount ($)
                </label>
                <input
                  type="number"
                  name="recurring_amount"
                  defaultValue={editingService.recurring_amount || ''}
                  step="0.01"
                  className="w-full px-4 py-2.5 border border-[--exec-border] rounded-xl focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent] bg-[--exec-surface] text-[--exec-text] placeholder:text-[--exec-text-muted] transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[--exec-text-secondary] mb-2">
                  Service Status
                </label>
                <select
                  name="service_status"
                  defaultValue={editingService.service_status || 'pending'}
                  className="w-full px-4 py-2.5 border border-[--exec-border] rounded-xl focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent] bg-[--exec-surface] text-[--exec-text] transition-all duration-200 cursor-pointer"
                >
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="paused">Paused</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[--exec-text-secondary] mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    name="service_start_date"
                    defaultValue={editingService.service_start_date || ''}
                    className="w-full px-4 py-2.5 border border-[--exec-border] rounded-xl focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent] bg-[--exec-surface] text-[--exec-text] transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[--exec-text-secondary] mb-2">
                    Next Billing
                  </label>
                  <input
                    type="date"
                    name="next_billing_date"
                    defaultValue={editingService.next_billing_date || ''}
                    className="w-full px-4 py-2.5 border border-[--exec-border] rounded-xl focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent] bg-[--exec-surface] text-[--exec-text] transition-all duration-200"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingService(null);
                  }}
                  className="flex-1 px-4 py-2.5 border border-[--exec-border] text-[--exec-text-secondary] rounded-xl hover:bg-[--exec-surface-alt] transition-all duration-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[--exec-accent] to-[--exec-accent-dark] text-white rounded-xl hover:shadow-lg hover:shadow-[--exec-accent]/25 transition-all duration-200 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
