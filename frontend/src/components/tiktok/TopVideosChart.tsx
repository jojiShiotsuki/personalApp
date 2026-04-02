import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import type { TikTokVideo } from '@/types';

interface TopVideosChartProps {
  videos: TikTokVideo[];
}

const tooltipStyle = {
  backgroundColor: 'var(--exec-surface)',
  border: '1px solid var(--exec-border-subtle)',
  borderRadius: '12px',
  color: 'var(--exec-text)',
};
const axisTickStyle = { fontSize: 11, fill: '#94a3b8' };
const axisLineStyle = { stroke: '#475569' };

export default function TopVideosChart({ videos }: TopVideosChartProps) {
  const data = videos.slice(0, 10).map((v, i) => ({
    name: `#${i + 1}`,
    likes: v.likes,
    comments: v.comments,
    shares: v.shares,
    saves: v.saves,
    caption: v.caption?.slice(0, 40) || 'Untitled',
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
      <h3 className="text-sm font-semibold text-[--exec-text] mb-4">Top 10: Engagement Breakdown</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
          <XAxis dataKey="name" tick={axisTickStyle} axisLine={axisLineStyle} />
          <YAxis tick={axisTickStyle} axisLine={axisLineStyle} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(_, payload) => payload?.[0]?.payload?.caption || ''} />
          <Legend />
          <Bar dataKey="likes" stackId="a" fill="#ec4899" />
          <Bar dataKey="comments" stackId="a" fill="#3b82f6" />
          <Bar dataKey="shares" stackId="a" fill="#10b981" />
          <Bar dataKey="saves" stackId="a" fill="#f59e0b" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
