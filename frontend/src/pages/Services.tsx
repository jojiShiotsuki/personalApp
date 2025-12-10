import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dealApi, contactApi } from '@/lib/api';
import type { Deal, Contact } from '@/types';
import { BillingFrequency, ServiceStatus } from '@/types';
import { RefreshCw, DollarSign, Calendar, AlertCircle, CheckCircle, PauseCircle, Clock, X, Edit2 } from 'lucide-react';
import { toast } from 'sonner';

const billingFrequencyLabels: Record<string, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semi_annual: 'Semi-Annual',
  annual: 'Annual',
};

const serviceStatusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  active: { label: 'Active', color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400', icon: CheckCircle },
  paused: { label: 'Paused', color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400', icon: PauseCircle },
  pending: { label: 'Pending', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400', icon: Clock },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400', icon: AlertCircle },
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
    <div className="p-8 bg-gray-50 dark:bg-slate-900 min-h-full">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Recurring Services</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          Track and manage your recurring client services and subscriptions
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Monthly Recurring</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">${monthlyRecurringRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Annual Recurring</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">${annualRecurringRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Active Services</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{services.filter((s: Deal) => s.service_status === 'active').length}</p>
            </div>
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Total Services</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{services.length}</p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <RefreshCw className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-6">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 dark:text-white"
        >
          <option value="all">All Services</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="paused">Paused</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Services List */}
      {sortedServices.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-12 text-center">
          <RefreshCw className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No recurring services</h3>
          <p className="text-gray-500 dark:text-slate-400">
            Create a deal and mark it as recurring to track it here.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
            <thead className="bg-gray-50 dark:bg-slate-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Service
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Frequency
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Next Billing
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
              {sortedServices.map((service: Deal) => {
                const billingStatus = getBillingStatus(service.next_billing_date);
                const statusConfig = service.service_status
                  ? serviceStatusConfig[service.service_status]
                  : serviceStatusConfig.pending;
                const StatusIcon = statusConfig.icon;

                return (
                  <tr key={service.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{service.title}</div>
                      {service.description && (
                        <div className="text-sm text-gray-500 dark:text-slate-400 truncate max-w-xs">{service.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">{getContactName(service.contact_id)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        ${Number(service.recurring_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-slate-400">
                        ${getMonthlyAmount(Number(service.recurring_amount || 0), service.billing_frequency || 'monthly').toLocaleString('en-US', { minimumFractionDigits: 2 })}/mo
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {service.billing_frequency ? billingFrequencyLabels[service.billing_frequency] : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {service.next_billing_date ? (
                        <div className={`text-sm ${
                          billingStatus === 'overdue' ? 'text-red-600 dark:text-red-400 font-medium' :
                          billingStatus === 'upcoming' ? 'text-yellow-600 dark:text-yellow-400 font-medium' :
                          'text-gray-900 dark:text-white'
                        }`}>
                          {new Date(service.next_billing_date).toLocaleDateString()}
                          {billingStatus === 'overdue' && (
                            <span className="ml-2 text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 px-2 py-0.5 rounded">Overdue</span>
                          )}
                          {billingStatus === 'upcoming' && (
                            <span className="ml-2 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 px-2 py-0.5 rounded">Due Soon</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 dark:text-slate-500">Not set</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {statusConfig.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => handleEditService(service)}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 p-1"
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

      {/* Edit Modal */}
      {isEditModalOpen && editingService && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Service</h2>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingService(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Service Name
                </label>
                <input
                  type="text"
                  value={editingService.title}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Billing Frequency
                </label>
                <select
                  name="billing_frequency"
                  defaultValue={editingService.billing_frequency || ''}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-white"
                >
                  <option value="">Select frequency</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="semi_annual">Semi-Annual</option>
                  <option value="annual">Annual</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Recurring Amount ($)
                </label>
                <input
                  type="number"
                  name="recurring_amount"
                  defaultValue={editingService.recurring_amount || ''}
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Service Status
                </label>
                <select
                  name="service_status"
                  defaultValue={editingService.service_status || 'pending'}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-white"
                >
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="paused">Paused</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Service Start Date
                </label>
                <input
                  type="date"
                  name="service_start_date"
                  defaultValue={editingService.service_start_date || ''}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Next Billing Date
                </label>
                <input
                  type="date"
                  name="next_billing_date"
                  defaultValue={editingService.next_billing_date || ''}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-white"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingService(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
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
