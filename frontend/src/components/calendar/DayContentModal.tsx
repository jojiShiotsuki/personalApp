import { X, Calendar } from 'lucide-react';
import type { SocialContent } from '@/types';
import { cn } from '@/lib/utils';

interface DayContentModalProps {
  isOpen: boolean;
  selectedDate: Date | null;
  dayContent: SocialContent[];
  onClose: () => void;
  onSubmit: (data: Partial<SocialContent>) => void;
  isLoading?: boolean;
}

export default function DayContentModal({
  isOpen,
  selectedDate,
  dayContent,
  onClose,
  isLoading = false,
}: DayContentModalProps) {
  if (!isOpen) return null;

  const formattedDate = selectedDate?.toLocaleDateString('default', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col border border-stone-600/40 transform transition-all animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="border-b border-stone-700/30 p-6 flex justify-between items-center rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-bold text-[--exec-text]">Content for {formattedDate}</h2>
            <p className="text-sm text-[--exec-text-muted] mt-1">
              {dayContent.length} {dayContent.length === 1 ? 'item' : 'items'} scheduled
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {dayContent.length === 0 ? (
            <div className="text-center py-12 text-[--exec-text-muted]">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-[--exec-text-muted]" />
              <p>No content scheduled for this day</p>
            </div>
          ) : (
            dayContent.map((item) => (
              <div
                key={item.id}
                className="bg-stone-800/40 border border-stone-600/40 rounded-xl p-6 shadow-sm hover:shadow-md transition-all"
              >
                {/* Header Row */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-[--exec-accent]" />
                    <div>
                      <h3 className="text-lg font-semibold capitalize text-[--exec-text]">
                        {item.content_type.replace('_', ' ')}
                      </h3>
                      <span className="inline-block mt-1 px-3 py-1 text-xs font-medium rounded-full capitalize bg-blue-500/20 text-blue-400">
                        {item.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Content Details Grid */}
                <div className="space-y-4">
                  {/* Script/Caption */}
                  {item.script && (
                    <div>
                      <p className="text-sm font-semibold text-[--exec-text-secondary] mb-2">Script / Caption</p>
                      <div
                        className="text-sm text-[--exec-text-secondary] bg-stone-800/50 p-3 rounded-lg [&_h1]:text-lg [&_h1]:font-bold [&_h2]:font-bold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                        dangerouslySetInnerHTML={{ __html: item.script }}
                      />
                    </div>
                  )}

                  {/* Platforms */}
                  {item.platforms && item.platforms.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-[--exec-text-secondary] mb-2">Platforms</p>
                      <div className="flex flex-wrap gap-2">
                        {item.platforms.map((platform) => (
                          <span
                            key={platform}
                            className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-xs font-medium capitalize"
                          >
                            {platform}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Two Column Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Editing Style */}
                    {item.editing_style && (
                      <div>
                        <p className="text-sm font-semibold text-[--exec-text-secondary] mb-1">Editing Style</p>
                        <p className="text-sm text-[--exec-text-muted] capitalize">
                          {item.editing_style.replace('_', ' ')}
                        </p>
                      </div>
                    )}

                    {/* Music/Audio */}
                    {item.music_audio && (
                      <div>
                        <p className="text-sm font-semibold text-[--exec-text-secondary] mb-1">Music / Audio</p>
                        <p className="text-sm text-[--exec-text-muted]">{item.music_audio}</p>
                      </div>
                    )}
                  </div>

                  {/* Editing Notes */}
                  {item.editing_notes && (
                    <div>
                      <p className="text-sm font-semibold text-[--exec-text-secondary] mb-2">Editing Notes</p>
                      <p className="text-sm text-[--exec-text-muted] bg-stone-800/50 p-3 rounded-lg">
                        {item.editing_notes}
                      </p>
                    </div>
                  )}

                  {/* Hashtags */}
                  {item.hashtags && (
                    <div>
                      <p className="text-sm font-semibold text-[--exec-text-secondary] mb-2">Hashtags</p>
                      <p className="text-sm text-[--exec-accent]">{item.hashtags}</p>
                    </div>
                  )}

                  {/* Thumbnail Reference */}
                  {item.thumbnail_reference && (
                    <div>
                      <p className="text-sm font-semibold text-[--exec-text-secondary] mb-1">Thumbnail Reference</p>
                      <p className="text-sm text-[--exec-text-muted] truncate">{item.thumbnail_reference}</p>
                    </div>
                  )}

                  {/* Production Notes */}
                  {item.notes && (
                    <div>
                      <p className="text-sm font-semibold text-[--exec-text-secondary] mb-2">Production Notes</p>
                      <p className="text-sm text-[--exec-text-muted] bg-stone-800/50 p-3 rounded-lg">
                        {item.notes}
                      </p>
                    </div>
                  )}

                  {/* Project Link */}
                  {item.project_id && (
                    <div>
                      <p className="text-sm font-semibold text-[--exec-text-secondary] mb-1">Linked Project</p>
                      <p className="text-sm text-[--exec-accent]">Project #{item.project_id}</p>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-stone-700/30 p-6 bg-stone-900/50 rounded-b-2xl">
          <button
            onClick={onClose}
            className={cn(
              "w-full px-4 py-2 text-white rounded-lg transition-colors",
              "bg-[--exec-accent] hover:bg-[--exec-accent-dark]"
            )}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
