import { useQuery } from '@tanstack/react-query';
import { DollarSign, Target, Clock, AlertTriangle } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { reportsApi } from '@/lib/api';
import { formatCurrency } from '@/lib/currency';
import { cn } from '@/lib/utils';
import MetricCard from './MetricCard';

interface PipelineTabProps {
  startDate: string;
  endDate: string;
}

interface FunnelStage {
  stage: string;
  count: number;
  value: number;
}

interface PipelineOverTime {
  date: string;
  value: number;
}

interface WinRateTrend {
  date: string;
  rate: number;
}

interface StalledDeal {
  id: number;
  title: string;
  stage: string;
  value: number;
  days_stalled: number;
}

interface PipelineData {
  pipeline_value: number;
  win_rate: number;
  avg_days_to_close: number;
  funnel: FunnelStage[];
  pipeline_over_time: PipelineOverTime[];
  win_rate_trend: WinRateTrend[];
  stalled_deals: StalledDeal[];
}

const tooltipStyle = {
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '8px',
  color: '#f1f5f9',
};

const axisTickStyle = { fontSize: 12, fill: '#94a3b8' };
const axisLineStyle = { stroke: '#475569' };

const FUNNEL_COLORS = ['#93c5fd', '#60a5fa', '#3b82f6', '#2563eb'];

export default function PipelineTab({ startDate, endDate }: PipelineTabProps) {
  const { data, isLoading, error } = useQuery<PipelineData>({
    queryKey: ['reports', 'pipeline', startDate, endDate],
    queryFn: () => reportsApi.getPipeline(startDate, endDate),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Metric card skeletons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 animate-pulse"
            >
              <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-24 mb-4" />
              <div className="h-8 bg-gray-200 dark:bg-slate-700 rounded w-32" />
            </div>
          ))}
        </div>
        {/* Funnel skeleton */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-32 mb-4" />
          <div className="space-y-2">
            {[100, 75, 50, 30].map((w, i) => (
              <div
                key={i}
                className="h-10 bg-gray-200 dark:bg-slate-700 rounded"
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
        </div>
        {/* Two-column chart skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 animate-pulse"
            >
              <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-40 mb-4" />
              <div className="h-[300px] bg-gray-200 dark:bg-slate-700 rounded" />
            </div>
          ))}
        </div>
        {/* Table skeleton */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-36 mb-4" />
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-200 dark:bg-slate-700 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <p className="text-red-600 dark:text-red-400 text-sm">
          Failed to load pipeline data. Please try again.
        </p>
      </div>
    );
  }

  if (!data) return null;

  const maxCount = Math.max(...data.funnel.map((s) => s.count), 1);

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Pipeline Value"
          value={formatCurrency(data.pipeline_value)}
          icon={DollarSign}
        />
        <MetricCard
          title="Win Rate"
          value={data.win_rate}
          suffix="%"
          icon={Target}
        />
        <MetricCard
          title="Avg Days to Close"
          value={data.avg_days_to_close}
          suffix=" days"
          icon={Clock}
        />
      </div>

      {/* Deal Funnel */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          Deal Funnel
        </h3>
        <div className="space-y-2">
          {data.funnel.map((stage, index) => {
            const widthPercent = Math.max((stage.count / maxCount) * 100, 5);
            const color = FUNNEL_COLORS[index % FUNNEL_COLORS.length];
            return (
              <div key={stage.stage} className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700 dark:text-slate-200 w-28 shrink-0">
                  {stage.stage}
                </span>
                <div className="flex-1 relative">
                  <div
                    className="h-10 rounded-r-lg flex items-center transition-all duration-300"
                    style={{
                      width: `${widthPercent}%`,
                      backgroundColor: color,
                      minWidth: '5%',
                    }}
                  >
                    <span className="text-sm font-semibold text-white px-3 whitespace-nowrap drop-shadow-sm">
                      {stage.count} deals
                    </span>
                  </div>
                </div>
                <span className="text-sm font-medium text-gray-500 dark:text-slate-400 w-24 text-right shrink-0">
                  {formatCurrency(stage.value)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pipeline Value Over Time + Win Rate Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Value Over Time */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
            Pipeline Value Over Time
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data.pipeline_over_time}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis
                dataKey="date"
                tick={axisTickStyle}
                tickLine={false}
                axisLine={axisLineStyle}
              />
              <YAxis
                tick={axisTickStyle}
                tickLine={false}
                axisLine={axisLineStyle}
                tickFormatter={(v: number) => formatCurrency(v)}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((value: any) => [formatCurrency(Number(value ?? 0)), 'Pipeline Value']) as any}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="rgba(59, 130, 246, 0.2)"
                name="Pipeline Value"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Win Rate Trend */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
            Win Rate Trend
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.win_rate_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis
                dataKey="date"
                tick={axisTickStyle}
                tickLine={false}
                axisLine={axisLineStyle}
              />
              <YAxis
                tick={axisTickStyle}
                tickLine={false}
                axisLine={axisLineStyle}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((value: any) => [`${Number(value ?? 0).toFixed(1)}%`, 'Win Rate']) as any}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Line
                type="monotone"
                dataKey="rate"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                name="Win Rate"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stalled Deals Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Stalled Deals
            </h3>
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Deals with no activity for 14+ days
          </p>
        </div>
        {data.stalled_deals.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
            <thead className="bg-gray-50 dark:bg-slate-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Deal Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Stage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Value
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Days Stalled
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              {data.stalled_deals.map((deal) => (
                <tr key={deal.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {deal.title}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">
                    {deal.stage}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {formatCurrency(deal.value)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={cn(
                        'inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full border',
                        deal.days_stalled > 30
                          ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
                          : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                      )}
                    >
                      {deal.days_stalled} days
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-6 pb-6 pt-2 text-center">
            <p className="text-sm text-gray-500 dark:text-slate-400 py-8">
              No stalled deals -- all deals are progressing on schedule.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
