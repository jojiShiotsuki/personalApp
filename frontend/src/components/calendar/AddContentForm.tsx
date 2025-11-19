import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import RichTextEditor from '../RichTextEditor';
import type { SocialContentCreate, ContentType, ContentStatus } from '@/types';
import { formatDateForApi } from '@/lib/dateUtils';

interface AddContentFormProps {
  isOpen: boolean;
  selectedDate: Date | null;
  onClose: () => void;
  onSubmit: (data: SocialContentCreate) => void;
  isLoading?: boolean;
}

const PLATFORMS = ['instagram', 'tiktok', 'facebook', 'youtube', 'linkedin', 'twitter'];

export default function AddContentForm({
  isOpen,
  selectedDate,
  onClose,
  onSubmit,
  isLoading = false,
}: AddContentFormProps) {
  const [formData, setFormData] = useState<Partial<SocialContentCreate>>({
    content_date: '',
    content_type: 'reel',
    status: 'not_started',
    script: '',
    platforms: [],
  });

  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  useEffect(() => {
    if (selectedDate) {
      setFormData((prev) => ({
        ...prev,
        content_date: formatDateForApi(selectedDate),
      }));
    }
  }, [selectedDate, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.content_date || !formData.content_type) return;

    onSubmit({
      ...formData,
      platforms: selectedPlatforms.length > 0 ? selectedPlatforms : undefined,
    } as SocialContentCreate);

    // Reset form
    setFormData({
      content_date: formatDateForApi(selectedDate!),
      content_type: 'reel',
      status: 'not_started',
      script: '',
      platforms: [],
    });
    setSelectedPlatforms([]);
  };

  const handlePlatformToggle = (platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold">Add New Content</h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Date */}
          <div>
            <label className="block text-sm font-semibold mb-2">Content Date *</label>
            <input
              type="date"
              value={formData.content_date || ''}
              onChange={(e) =>
                setFormData({ ...formData, content_date: e.target.value })
              }
              className="w-full border border-gray-200 bg-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={isLoading}
            />
          </div>

          {/* Content Type */}
          <div>
            <label className="block text-sm font-semibold mb-2">Content Type *</label>
            <select
              value={formData.content_type || 'reel'}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  content_type: e.target.value as ContentType,
                })
              }
              className="w-full border border-gray-200 bg-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={isLoading}
            >
              <option value="reel">Reel</option>
              <option value="carousel">Carousel</option>
              <option value="single_post">Single Post</option>
              <option value="story">Story</option>
              <option value="tiktok">TikTok</option>
              <option value="youtube_short">YouTube Short</option>
              <option value="youtube_video">YouTube Video</option>
              <option value="blog_post">Blog Post</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-semibold mb-2">Status</label>
            <select
              value={formData.status || 'not_started'}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  status: e.target.value as ContentStatus,
                })
              }
              className="w-full border border-gray-200 bg-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            >
              <option value="not_started">Not Started</option>
              <option value="scripted">Scripted</option>
              <option value="filmed">Filmed</option>
              <option value="editing">Editing</option>
              <option value="scheduled">Scheduled</option>
              <option value="posted">Posted</option>
            </select>
          </div>

          {/* Script/Caption */}
          <div>
            <label className="block text-sm font-semibold mb-2">Script / Caption</label>
            <RichTextEditor
              value={formData.script || ''}
              onChange={(value) =>
                setFormData({ ...formData, script: value })
              }
              className="min-h-[150px]"
              disabled={isLoading}
            />
          </div>

          {/* Platforms */}
          <div>
            <label className="block text-sm font-semibold mb-3">Platforms</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {PLATFORMS.map((platform) => (
                <label
                  key={platform}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedPlatforms.includes(platform)}
                    onChange={() => handlePlatformToggle(platform)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={isLoading}
                  />
                  <span className="text-sm capitalize">{platform}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end border-t border-gray-200 pt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !formData.content_date || !formData.content_type}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating...' : 'Create Content'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
