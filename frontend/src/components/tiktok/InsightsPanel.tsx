import { Hash, Clock, Music, Timer } from 'lucide-react';
import type { TikTokPatterns } from '@/types';

interface InsightsPanelProps {
  patterns: TikTokPatterns;
}

export default function InsightsPanel({ patterns }: InsightsPanelProps) {
  return (
    <div className="bento-card-static p-6 space-y-6">
      <h3 className="text-sm font-semibold text-[--exec-text]">Insights</h3>

      <div>
        <div className="flex items-center gap-2 text-[--exec-text-muted] mb-3">
          <Hash className="w-4 h-4" />
          <span className="text-xs font-medium uppercase tracking-wider">Top Hashtags</span>
        </div>
        <div className="space-y-2">
          {patterns.top_hashtags.slice(0, 8).map((h) => (
            <div key={h.hashtag} className="flex items-center justify-between text-sm">
              <span className="text-[--exec-text-secondary]">#{h.hashtag}</span>
              <span className="text-[--exec-text-muted] text-xs">
                {h.count}x &middot; {h.avg_views >= 1000 ? `${(h.avg_views / 1000).toFixed(1)}K` : h.avg_views} avg
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 text-[--exec-text-muted] mb-3">
          <Clock className="w-4 h-4" />
          <span className="text-xs font-medium uppercase tracking-wider">Best Posting Time</span>
        </div>
        <div className="space-y-2">
          {patterns.best_posting_days.slice(0, 3).map((d) => (
            <div key={d.day} className="flex items-center justify-between text-sm">
              <span className="text-[--exec-text-secondary]">{d.day}</span>
              <span className="text-[--exec-text-muted] text-xs">
                {d.avg_views >= 1000 ? `${(d.avg_views / 1000).toFixed(1)}K` : d.avg_views} avg &middot; {d.video_count} videos
              </span>
            </div>
          ))}
          {patterns.best_posting_hours.slice(0, 3).map((h) => (
            <div key={h.hour} className="flex items-center justify-between text-sm">
              <span className="text-[--exec-text-secondary]">
                {h.hour === 0 ? '12 AM' : h.hour < 12 ? `${h.hour} AM` : h.hour === 12 ? '12 PM' : `${h.hour - 12} PM`}
              </span>
              <span className="text-[--exec-text-muted] text-xs">
                {h.avg_views >= 1000 ? `${(h.avg_views / 1000).toFixed(1)}K` : h.avg_views} avg
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 text-[--exec-text-muted] mb-3">
          <Music className="w-4 h-4" />
          <span className="text-xs font-medium uppercase tracking-wider">Top Sounds</span>
        </div>
        <div className="space-y-2">
          {patterns.top_sounds.slice(0, 5).map((s) => (
            <div key={s.sound} className="flex items-center justify-between text-sm">
              <span className="text-[--exec-text-secondary] truncate max-w-[60%]">{s.sound}</span>
              <span className="text-[--exec-text-muted] text-xs">{s.count}x</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 text-[--exec-text-muted] mb-3">
          <Timer className="w-4 h-4" />
          <span className="text-xs font-medium uppercase tracking-wider">Duration Sweet Spot</span>
        </div>
        <div className="space-y-2">
          {patterns.engagement_by_duration.map((d) => (
            <div key={d.range} className="flex items-center justify-between text-sm">
              <span className="text-[--exec-text-secondary]">{d.range}</span>
              <span className="text-[--exec-text-muted] text-xs">
                {(d.avg_engagement * 100).toFixed(2)}% eng &middot; {d.count} videos
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
