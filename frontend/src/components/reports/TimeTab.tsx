import { useQuery } from '@tanstack/react-query';
import { Clock, DollarSign, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { reportsApi } from '@/lib/api';
import { formatCurrency } from '@/lib/currency';
import MetricCard from './MetricCard';

interface TimeTabProps {
  startDate: string;
  endDate: string;
}

interface HoursOverTime {
  date: string;
  hours: number;
}

interface BillableSplit {
  billable: number;
  non_billable: number;
}

interface TimeByProject {
  name: string;
  hours: number;
}

interface TimeByCategory {
  category: string;
  hours: number;
}

interface TimeData {
  total_hours: number;
  billable_amount: number;
  avg_hours_per_day: number;
  hours_over_time: HoursOverTime[];
  billable_split: BillableSplit;
  time_by_project: TimeByProject[];
  time_by_category: TimeByCategory[];
}

const tooltipStyle = {
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '8px',
  color: '#f1f5f9',
};

const axisTickStyle = { fontSize: 12, fill: '#94a3b8' };
const axisLineStyle = { stroke: '#475569' };

const BILLABLE_COLORS = ['#3b82f6', '#94a3b8'];

const CATEGORY_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
];

export default function TimeTab({ startDate, endDate }: TimeTabProps) {
  const { data, isLoading, error } = useQuery<TimeData>({
    queryKey: ['reports', 'time', startDate, endDate],
    queryFn: () => reportsApi.getTime(startDate, endDate),
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
        {/* Full-width chart skeleton */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-48 mb-4" />
          <div className="h-[300px] bg-gray-200 dark:bg-slate-700 rounded" />
        </div>
        {/* Two-column skeleton */}
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
        {/* Full-width chart skeleton */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-36 mb-4" />
          <div className="h-[350px] bg-gray-200 dark:bg-slate-700 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <p className="text-red-600 dark:text-red-400 text-sm">
          Failed to load time data. Please try again.
        </p>
      </div>
    );
  }

  if (!data) return null;

  const billableData = [
    { name: 'Billable', value: data.billable_split.billable },
    { name: 'Non-billable', value: data.billable_split.non_billable },
  ];

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Total Hours"
          value={data.total_hours}
          suffix="h"
          icon={Clock}
        />
        <MetricCard
          title="Billable Amount"
          value={formatCurrency(data.billable_amount)}
          icon={DollarSign}
        />
        <MetricCard
          title="Avg Hours/Day"
          value={data.avg_hours_per_day}
          suffix="h/day"
          icon={TrendingUp}
        />
      </div>

      {/* Hours Over Time — full width bar chart */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          Hours Over Time
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.hours_over_time}>
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
              tickFormatter={(v: number) => `${v}h`}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={((value: any) => [`${Number(value ?? 0).toFixed(1)}h`, 'Hours']) as any}
              labelStyle={{ color: '#94a3b8' }}
            />
            <Bar
              dataKey="hours"
              fill="#3b82f6"
              radius={[4, 4, 0, 0]}
              name="Hours"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Billable vs Non-billable + Time by Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Billable vs Non-billable — donut pie chart */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
            Billable vs Non-billable
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={billableData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                dataKey="value"
                nameKey="name"
                label={({ name, value }) => `${name}: ${value.toFixed(1)}h`}
                labelLine
              >
                {billableData.map((_, index) => (
                  <Cell key={`billable-${index}`} fill={BILLABLE_COLORS[index]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((value: any) => [`${Number(value ?? 0).toFixed(1)}h`]) as any}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Legend
                wrapperStyle={{ color: '#94a3b8', fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Time by Category — full pie chart */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
            Time by Category
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data.time_by_category}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="hours"
                nameKey="category"
                label={({ name }) => `${name}`}
                labelLine
              >
                {data.time_by_category.map((_, index) => (
                  <Cell
                    key={`category-${index}`}
                    fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((value: any) => [`${Number(value ?? 0).toFixed(1)}h`]) as any}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Legend
                wrapperStyle={{ color: '#94a3b8', fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Time by Project — full width horizontal bar chart */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          Time by Project
        </h3>
        {data.time_by_project.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={data.time_by_project} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis
                type="number"
                tick={axisTickStyle}
                tickLine={false}
                axisLine={axisLineStyle}
                tickFormatter={(v: number) => `${v}h`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={axisTickStyle}
                tickLine={false}
                axisLine={axisLineStyle}
                width={120}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((value: any) => [`${Number(value ?? 0).toFixed(1)}h`, 'Hours']) as any}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Bar
                dataKey="hours"
                fill="#3b82f6"
                radius={[0, 4, 4, 0]}
                name="Hours"
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-12">
            No project time data available for this period.
          </p>
        )}
      </div>
    </div>
  );
}
