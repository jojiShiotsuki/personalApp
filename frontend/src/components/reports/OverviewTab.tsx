import { useQuery } from '@tanstack/react-query';
import { DollarSign, Clock, Target, FolderOpen } from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { reportsApi } from '@/lib/api';
import { getCurrencySymbol, formatCurrency } from '@/lib/currency';
import MetricCard from './MetricCard';

interface OverviewTabProps {
  startDate: string;
  endDate: string;
}

interface RevenueByDay {
  date: string;
  revenue: number;
  hours: number;
}

interface TopClient {
  name: string;
  revenue: number;
}

interface OverviewData {
  total_revenue: number;
  revenue_change_pct: number;
  hours_logged: number;
  hours_change_pct: number;
  deals_closed: number;
  win_rate: number;
  active_projects: number;
  revenue_by_day: RevenueByDay[];
  top_clients: TopClient[];
}

export default function OverviewTab({ startDate, endDate }: OverviewTabProps) {
  const { data, isLoading, error } = useQuery<OverviewData>({
    queryKey: ['reports', 'overview', startDate, endDate],
    queryFn: () => reportsApi.getOverview(startDate, endDate),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 animate-pulse"
            >
              <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-24 mb-4" />
              <div className="h-8 bg-gray-200 dark:bg-slate-700 rounded w-32" />
            </div>
          ))}
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-48 mb-4" />
          <div className="h-[350px] bg-gray-200 dark:bg-slate-700 rounded" />
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-36 mb-4" />
          <div className="h-[300px] bg-gray-200 dark:bg-slate-700 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <p className="text-red-600 dark:text-red-400 text-sm">
          Failed to load overview data. Please try again.
        </p>
      </div>
    );
  }

  if (!data) return null;

  const currencySymbol = getCurrencySymbol();

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Revenue"
          value={data.total_revenue}
          prefix={currencySymbol}
          change={data.revenue_change_pct}
          icon={DollarSign}
        />
        <MetricCard
          title="Hours Logged"
          value={data.hours_logged}
          suffix="h"
          change={data.hours_change_pct}
          icon={Clock}
        />
        <MetricCard
          title="Deals Closed"
          value={data.deals_closed}
          suffix={` (${data.win_rate.toFixed(1)}% win)`}
          icon={Target}
        />
        <MetricCard
          title="Active Projects"
          value={data.active_projects}
          icon={FolderOpen}
        />
      </div>

      {/* Revenue vs Hours Chart */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          Revenue vs Hours
        </h3>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={data.revenue_by_day}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={{ stroke: '#475569' }}
            />
            <YAxis
              yAxisId="revenue"
              orientation="left"
              tick={{ fontSize: 12, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={{ stroke: '#475569' }}
              tickFormatter={(v: number) => `${currencySymbol}${v}`}
            />
            <YAxis
              yAxisId="hours"
              orientation="right"
              tick={{ fontSize: 12, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={{ stroke: '#475569' }}
              tickFormatter={(v: number) => `${v}h`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#f1f5f9',
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={((value: any, name: any) => {
                const v = Number(value ?? 0);
                if (name === 'revenue') return [formatCurrency(v), 'Revenue'];
                if (name === 'hours') return [`${v.toFixed(1)}h`, 'Hours'];
                return [v, name];
              }) as any}
              labelStyle={{ color: '#94a3b8' }}
            />
            <Legend
              wrapperStyle={{ color: '#94a3b8', fontSize: 12 }}
            />
            <Area
              yAxisId="revenue"
              type="monotone"
              dataKey="revenue"
              fill="rgba(59, 130, 246, 0.2)"
              stroke="#3b82f6"
              strokeWidth={2}
              name="revenue"
            />
            <Line
              yAxisId="hours"
              type="monotone"
              dataKey="hours"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              name="hours"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Top Clients Chart */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          Top Clients
        </h3>
        {data.top_clients.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.top_clients.slice(0, 5)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis
                type="number"
                tick={{ fontSize: 12, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={{ stroke: '#475569' }}
                tickFormatter={(v: number) => formatCurrency(v)}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={{ stroke: '#475569' }}
                width={120}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#f1f5f9',
                }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((value: any) => [formatCurrency(Number(value ?? 0)), 'Revenue']) as any}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Bar
                dataKey="revenue"
                fill="#3b82f6"
                radius={[0, 4, 4, 0]}
                name="Revenue"
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-12">
            No client data available for this period.
          </p>
        )}
      </div>
    </div>
  );
}
