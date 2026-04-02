import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tiktokApi } from '@/lib/api';
import { Upload, Video } from 'lucide-react';
import { toast } from 'sonner';
import SummaryCards from '@/components/tiktok/SummaryCards';
import PerformanceChart from '@/components/tiktok/PerformanceChart';
import TopVideosChart from '@/components/tiktok/TopVideosChart';
import InsightsPanel from '@/components/tiktok/InsightsPanel';
import VideoTable from '@/components/tiktok/VideoTable';
import ImportModal from '@/components/tiktok/ImportModal';

export default function TikTokAnalytics() {
  const [importOpen, setImportOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['tiktok', 'summary'],
    queryFn: () => tiktokApi.getSummary(),
  });

  const { data: videos = [] } = useQuery({
    queryKey: ['tiktok', 'videos'],
    queryFn: () => tiktokApi.listVideos({ sort_by: 'views', sort_order: 'desc' }),
  });

  const { data: topPerformers = [] } = useQuery({
    queryKey: ['tiktok', 'top-performers'],
    queryFn: () => tiktokApi.getTopPerformers('views', 10),
  });

  const { data: patterns } = useQuery({
    queryKey: ['tiktok', 'patterns'],
    queryFn: () => tiktokApi.getPatterns(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => tiktokApi.deleteVideo(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiktok'] });
      toast.success('Video deleted');
    },
  });

  if (summaryLoading) {
    return (
      <div className="min-h-screen bg-[--exec-bg] flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[--exec-accent]" />
      </div>
    );
  }

  const isEmpty = !summary || summary.total_videos === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-[--exec-surface] border-b border-stone-700/40 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[--exec-text] tracking-tight">TikTok Analytics</h1>
            <p className="mt-1 text-sm text-[--exec-text-muted]">
              {summary ? `${summary.total_videos} videos \u00B7 ${summary.total_views.toLocaleString()} total views` : 'Import your TikTok data to get started'}
            </p>
          </div>
          <button
            onClick={() => setImportOpen(true)}
            className="group flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[--exec-accent] to-[--exec-accent-dark] text-white rounded-2xl hover:shadow-lg hover:shadow-[--exec-accent]/25 hover:-translate-y-0.5 transition-all duration-200 font-semibold"
          >
            <Upload className="w-5 h-5" />
            Import Data
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-8 py-6 space-y-6">
        {isEmpty ? (
          <div className="bento-card-static p-12 text-center">
            <Video className="w-12 h-12 text-[--exec-text-muted] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[--exec-text] mb-2">No TikTok data yet</h3>
            <p className="text-[--exec-text-muted] mb-4">
              Export your data from TikTok (Settings &gt; Privacy &gt; Download your data) and upload the JSON file.
            </p>
            <button
              onClick={() => setImportOpen(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-[--exec-accent] to-[--exec-accent-dark] text-white rounded-2xl hover:shadow-lg hover:shadow-[--exec-accent]/25 hover:-translate-y-0.5 transition-all duration-200 font-semibold"
            >
              Import Data
            </button>
          </div>
        ) : (
          <>
            {summary && <SummaryCards data={summary} />}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PerformanceChart videos={videos} />
              <TopVideosChart videos={topPerformers} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bento-card-static p-6">
                <h3 className="text-sm font-semibold text-[--exec-text] mb-4">Top Performers</h3>
                <div className="space-y-3">
                  {topPerformers.slice(0, 10).map((v, i) => (
                    <div key={v.id} className="flex items-center gap-3 py-2 border-b border-stone-700/20 last:border-0">
                      <span className="text-lg font-bold text-[--exec-text-muted] w-8 text-right">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[--exec-text] truncate">{v.caption || '(no caption)'}</p>
                        <p className="text-xs text-[--exec-text-muted]">{v.create_time ? new Date(v.create_time).toLocaleDateString() : ''}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-[--exec-text]">{v.views >= 1000 ? `${(v.views / 1000).toFixed(1)}K` : v.views}</p>
                        <p className="text-xs text-[--exec-text-muted]">{(v.engagement_rate * 100).toFixed(1)}% eng</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {patterns && <InsightsPanel patterns={patterns} />}
            </div>

            <VideoTable videos={videos} onDelete={(id) => deleteMutation.mutate(id)} />
          </>
        )}
      </div>

      <ImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
