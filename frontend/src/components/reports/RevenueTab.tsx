import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
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

interface RevenueTabProps {
  startDate: string;
  endDate: string;
}

interface RevenueOverTime {
  date: string;
  amount: number;
}

interface MrrTrend {
  date: string;
  amount: number;
}

interface RevenueByClient {
  name: string;
  revenue: number;
}

interface RevenueBySource {
  one_time: number;
  recurring: number;
}

interface AvgDealSize {
  date: string;
  amount: number;
}

interface WonVsLost {
  date: string;
  won: number;
  lost: number;
}

interface RevenueData {
  revenue_over_time: RevenueOverTime[];
  mrr_trend: MrrTrend[];
  revenue_by_client: RevenueByClient[];
  revenue_by_source: RevenueBySource;
  avg_deal_size: AvgDealSize[];
  won_vs_lost: WonVsLost[];
}

const tooltipStyle = {
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '8px',
  color: '#f1f5f9',
};

const axisTickStyle = { fontSize: 12, fill: '#94a3b8' };
const axisLineStyle = { stroke: '#475569' };

export default function RevenueTab({ startDate, endDate }: RevenueTabProps) {
  const { data, isLoading, error } = useQuery<RevenueData>({
    queryKey: ['reports', 'revenue', startDate, endDate],
    queryFn: () => reportsApi.getRevenue(startDate, endDate),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Full-width skeleton x2 */}
        {[...Array(2)].map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 animate-pulse"
          >
            <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-48 mb-4" />
            <div className="h-[300px] bg-gray-200 dark:bg-slate-700 rounded" />
          </div>
        ))}
        {/* Two-column skeleton rows x2 */}
        {[...Array(2)].map((_, i) => (
          <div key={`row-${i}`} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...Array(2)].map((_, j) => (
              <div
                key={j}
                className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 animate-pulse"
              >
                <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-40 mb-4" />
                <div className="h-[300px] bg-gray-200 dark:bg-slate-700 rounded" />
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <p className="text-red-600 dark:text-red-400 text-sm">
          Failed to load revenue data. Please try again.
        </p>
      </div>
    );
  }

  if (!data) return null;

  const sourceData = [
    { name: 'One-Time', value: data.revenue_by_source.one_time },
    { name: 'Recurring', value: data.revenue_by_source.recurring },
  ];

  const PIE_COLORS = ['#3b82f6', '#10b981'];

  return (
    <div className="space-y-6">
      {/* Revenue Over Time — full width */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          Revenue Over Time
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data.revenue_over_time}>
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
              formatter={((value: any) => [formatCurrency(Number(value ?? 0)), 'Revenue']) as any}
              labelStyle={{ color: '#94a3b8' }}
            />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="rgba(59, 130, 246, 0.2)"
              name="Revenue"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* MRR Trend — full width */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          MRR Trend
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data.mrr_trend}>
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
              formatter={((value: any) => [formatCurrency(Number(value ?? 0)), 'MRR']) as any}
              labelStyle={{ color: '#94a3b8' }}
            />
            <Line
              type="monotone"
              dataKey="amount"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              name="MRR"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Revenue by Client + Revenue by Source */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Client — horizontal bar chart */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
            Revenue by Client
          </h3>
          {data.revenue_by_client.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={data.revenue_by_client} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                <XAxis
                  type="number"
                  tick={axisTickStyle}
                  tickLine={false}
                  axisLine={axisLineStyle}
                  tickFormatter={(v: number) => formatCurrency(v)}
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
              No client revenue data available for this period.
            </p>
          )}
        </div>

        {/* Revenue by Source — donut pie chart */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
            Revenue by Source
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={sourceData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                dataKey="value"
                nameKey="name"
                label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
                labelLine
              >
                {sourceData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((value: any) => [formatCurrency(Number(value ?? 0))]) as any}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Legend
                wrapperStyle={{ color: '#94a3b8', fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Avg Deal Size + Won vs Lost */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Avg Deal Size Trend */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
            Avg Deal Size Trend
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.avg_deal_size}>
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
                formatter={((value: any) => [formatCurrency(Number(value ?? 0)), 'Avg Deal Size']) as any}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Line
                type="monotone"
                dataKey="amount"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                name="Avg Deal Size"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Won vs Lost */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
            Won vs Lost Deals
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.won_vs_lost}>
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
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Legend
                wrapperStyle={{ color: '#94a3b8', fontSize: 12 }}
              />
              <Bar
                dataKey="won"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
                name="Won"
              />
              <Bar
                dataKey="lost"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
                name="Lost"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
