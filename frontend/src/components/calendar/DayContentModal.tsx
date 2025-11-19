import { X, Calendar } from 'lucide-react';
import type { SocialContent } from '@/types';

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Content for {formattedDate}</h2>
            <p className="text-sm text-gray-600 mt-1">
              {dayContent.length} {dayContent.length === 1 ? 'item' : 'items'} scheduled
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {dayContent.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>No content scheduled for this day</p>
            </div>
          ) : (
            dayContent.map((item) => (
              <div
                key={item.id}
                className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all"
              >
                {/* Header Row */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <div>
                      <h3 className="text-lg font-semibold capitalize">
                        {item.content_type.replace('_', ' ')}
                      </h3>
                      <span className="inline-block mt-1 px-3 py-1 text-xs font-medium rounded-full capitalize bg-blue-100 text-blue-700">
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
                      <p className="text-sm font-semibold text-gray-700 mb-2">Script / Caption</p>
                      <div 
                        className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg [&_h1]:text-lg [&_h1]:font-bold [&_h2]:font-bold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                        dangerouslySetInnerHTML={{ __html: item.script }}
                      />
                    </div>
                  )}

                  {/* Platforms */}
                  {item.platforms && item.platforms.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">Platforms</p>
                      <div className="flex flex-wrap gap-2">
                        {item.platforms.map((platform) => (
                          <span
                            key={platform}
                            className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium capitalize"
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
                        <p className="text-sm font-semibold text-gray-700 mb-1">Editing Style</p>
                        <p className="text-sm text-gray-600 capitalize">
                          {item.editing_style.replace('_', ' ')}
                        </p>
                      </div>
                    )}

                    {/* Music/Audio */}
                    {item.music_audio && (
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-1">Music / Audio</p>
                        <p className="text-sm text-gray-600">{item.music_audio}</p>
                      </div>
                    )}
                  </div>

                  {/* Editing Notes */}
                  {item.editing_notes && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">Editing Notes</p>
                      <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                        {item.editing_notes}
                      </p>
                    </div>
                  )}

                  {/* Hashtags */}
                  {item.hashtags && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">Hashtags</p>
                      <p className="text-sm text-blue-600">{item.hashtags}</p>
                    </div>
                  )}

                  {/* Thumbnail Reference */}
                  {item.thumbnail_reference && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-1">Thumbnail Reference</p>
                      <p className="text-sm text-gray-600 truncate">{item.thumbnail_reference}</p>
                    </div>
                  )}

                  {/* Production Notes */}
                  {item.notes && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">Production Notes</p>
                      <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                        {item.notes}
                      </p>
                    </div>
                  )}

                  {/* Project Link */}
                  {item.project_id && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-1">Linked Project</p>
                      <p className="text-sm text-blue-600">Project #{item.project_id}</p>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
