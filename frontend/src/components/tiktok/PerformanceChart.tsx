import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import type { TikTokVideo } from '@/types';

interface PerformanceChartProps {
  videos: TikTokVideo[];
}

const tooltipStyle = {
  backgroundColor: 'var(--exec-surface)',
  border: '1px solid var(--exec-border-subtle)',
  borderRadius: '12px',
  color: 'var(--exec-text)',
};
const axisTickStyle = { fontSize: 12, fill: '#94a3b8' };
const axisLineStyle = { stroke: '#475569' };

export default function PerformanceChart({ videos }: PerformanceChartProps) {
  const sorted = [...videos]
    .filter((v) => v.create_time)
    .sort((a, b) => new Date(a.create_time!).getTime() - new Date(b.create_time!).getTime());

  const data = sorted.map((v) => ({
    date: new Date(v.create_time!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    views: v.views,
    engagement: +(v.engagement_rate * 100).toFixed(2),
  }));

  if (data.length === 0) {
    return (
      <div className="bento-card-static p-6 h-[350px] flex items-center justify-center">
        <p className="text-sm text-[--exec-text-muted]">No data to display</p>
      </div>
    );
  }

  return (
    <div className="bento-card-static p-6">
      <h3 className="text-sm font-semibold text-[--exec-text] mb-4">Performance Over Time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
          <XAxis dataKey="date" tick={axisTickStyle} axisLine={axisLineStyle} />
          <YAxis yAxisId="views" tick={axisTickStyle} axisLine={axisLineStyle} />
          <YAxis yAxisId="engagement" orientation="right" tick={axisTickStyle} axisLine={axisLineStyle} unit="%" />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar yAxisId="views" dataKey="views" fill="#8b5cf6" opacity={0.7} />
          <Line yAxisId="engagement" dataKey="engagement" stroke="#f59e0b" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
