import { Video, Eye, TrendingUp, Award, BarChart3 } from 'lucide-react';
import type { TikTokSummary } from '@/types';

interface SummaryCardsProps {
  data: TikTokSummary;
}

const cards = [
  { key: 'total_videos', label: 'Total Videos', icon: Video, format: (v: number) => v.toLocaleString() },
  { key: 'total_views', label: 'Total Views', icon: Eye, format: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toString() },
  { key: 'avg_engagement_rate', label: 'Avg Engagement', icon: TrendingUp, format: (v: number) => `${(v * 100).toFixed(2)}%` },
  { key: 'best_video_views', label: 'Best Video', icon: Award, format: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}K views` : `${v} views` },
  { key: 'avg_views_per_video', label: 'Avg Views', icon: BarChart3, format: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : Math.round(v).toString() },
] as const;

export default function SummaryCards({ data }: SummaryCardsProps) {
  const values: Record<string, number> = {
    total_videos: data.total_videos,
    total_views: data.total_views,
    avg_engagement_rate: data.avg_engagement_rate,
    best_video_views: data.best_video?.views ?? 0,
    avg_views_per_video: data.avg_views_per_video,
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {cards.map(({ key, label, icon: Icon, format }) => (
        <div key={key} className="bento-card-static p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[--exec-text-muted]">
            <Icon className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
          </div>
          <p className="text-2xl font-bold text-[--exec-text]">{format(values[key])}</p>
        </div>
      ))}
    </div>
  );
}
