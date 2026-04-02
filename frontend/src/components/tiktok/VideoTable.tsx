import { useState } from 'react';
import { Search, ArrowUpDown, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TikTokVideo } from '@/types';

interface VideoTableProps {
  videos: TikTokVideo[];
  onDelete?: (id: number) => void;
}

type SortField = 'create_time' | 'views' | 'likes' | 'comments' | 'shares' | 'saves' | 'engagement_rate' | 'video_duration';

export default function VideoTable({ videos, onDelete }: VideoTableProps) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('views');
  const [sortDesc, setSortDesc] = useState(true);

  const filtered = videos.filter((v) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return v.caption?.toLowerCase().includes(q) || v.hashtags.some((h) => h.toLowerCase().includes(q));
  });

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortField] ?? 0;
    const bv = b[sortField] ?? 0;
    if (typeof av === 'string' && typeof bv === 'string') return sortDesc ? bv.localeCompare(av) : av.localeCompare(bv);
    return sortDesc ? (bv as number) - (av as number) : (av as number) - (bv as number);
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDesc(!sortDesc);
    else { setSortField(field); setSortDesc(true); }
  };

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th onClick={() => toggleSort(field)} className="px-4 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider cursor-pointer hover:text-[--exec-text] transition-colors">
      <span className="flex items-center gap-1">{label}<ArrowUpDown className={cn("w-3 h-3", sortField === field && "text-[--exec-accent]")} /></span>
    </th>
  );

  return (
    <div className="bento-card-static overflow-hidden">
      <div className="p-4 border-b border-stone-700/30">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[--exec-text-muted]" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search captions or hashtags..."
            className={cn("w-full pl-10 pr-4 py-2 rounded-lg", "bg-stone-800/50 border border-stone-600/40", "text-[--exec-text] placeholder:text-[--exec-text-muted]", "focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50", "transition-all text-sm")} />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-stone-700/30">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">Caption</th>
              <SortHeader field="create_time" label="Date" />
              <SortHeader field="views" label="Views" />
              <SortHeader field="likes" label="Likes" />
              <SortHeader field="comments" label="Comments" />
              <SortHeader field="shares" label="Shares" />
              <SortHeader field="engagement_rate" label="Eng %" />
              <SortHeader field="video_duration" label="Duration" />
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-700/30">
            {sorted.map((v) => (
              <tr key={v.id} className="group hover:bg-stone-700/20 transition-colors">
                <td className="px-4 py-3 max-w-[250px]">
                  <p className="text-sm text-[--exec-text] truncate">{v.caption || '(no caption)'}</p>
                  {v.hashtags.length > 0 && <p className="text-xs text-[--exec-text-muted] truncate mt-0.5">{v.hashtags.slice(0, 4).map((h) => `#${h}`).join(' ')}</p>}
                </td>
                <td className="px-4 py-3 text-sm text-[--exec-text-secondary] whitespace-nowrap">{v.create_time ? new Date(v.create_time).toLocaleDateString() : '\u2014'}</td>
                <td className="px-4 py-3 text-sm text-[--exec-text] font-medium whitespace-nowrap">{v.views.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-[--exec-text-secondary] whitespace-nowrap">{v.likes.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-[--exec-text-secondary] whitespace-nowrap">{v.comments.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-[--exec-text-secondary] whitespace-nowrap">{v.shares.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-[--exec-text-secondary] whitespace-nowrap">{(v.engagement_rate * 100).toFixed(2)}%</td>
                <td className="px-4 py-3 text-sm text-[--exec-text-muted] whitespace-nowrap">{v.video_duration ? `${v.video_duration}s` : '\u2014'}</td>
                <td className="px-4 py-3">
                  {onDelete && (
                    <button onClick={() => onDelete(v.id)} className="p-1.5 text-[--exec-text-muted] hover:text-red-400 hover:bg-red-900/30 rounded-md transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="p-12 text-center text-sm text-[--exec-text-muted]">{search ? 'No videos match your search.' : 'No videos imported yet.'}</div>
        )}
      </div>
    </div>
  );
}
