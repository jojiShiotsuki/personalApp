import { useState, useEffect } from 'react';
import { X, Calendar } from 'lucide-react';
import type { SocialContent, ContentType, ContentStatus, EditingStyle } from '@/types';
import {
  ContentType as ContentTypeEnum,
  ContentStatus as ContentStatusEnum,
  EditingStyle as EditingStyleEnum,
} from '@/types';
import { formatDateForApi } from '@/lib/dateUtils';

interface DayContentModalProps {
  isOpen: boolean;
  selectedDate: Date | null;
  existingContent?: SocialContent | null;
  onClose: () => void;
  onSubmit: (data: Partial<SocialContent>) => void;
  isLoading?: boolean;
}

const PLATFORMS = ['instagram', 'tiktok', 'facebook', 'youtube', 'linkedin', 'twitter'];

export default function DayContentModal({
  isOpen,
  selectedDate,
  existingContent,
  onClose,
  onSubmit,
  isLoading = false,
}: DayContentModalProps) {
  const [formData, setFormData] = useState<Partial<SocialContent>>({
    content_date: '',
    content_type: 'reel',
    status: 'not_started',
    script: '',
    editing_style: undefined,
    editing_notes: '',
    platforms: [],
    hashtags: '',
    music_audio: '',
    thumbnail_reference: '',
    notes: '',
    project_id: undefined,
  });

  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  useEffect(() => {
    if (existingContent) {
      setFormData(existingContent);
      setSelectedPlatforms(existingContent.platforms || []);
    } else if (selectedDate) {
      setFormData((prev) => ({
        ...prev,
        content_date: formatDateForApi(selectedDate),
      }));
      setSelectedPlatforms([]);
    }
  }, [existingContent, selectedDate, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.content_date || !formData.content_type) return;

    onSubmit({
      ...formData,
      platforms: selectedPlatforms.length > 0 ? selectedPlatforms : undefined,
    });
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold dark:text-white">
            {existingContent ? 'Edit Content' : 'New Content'}
          </h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Date */}
          <div>
            <label className="block text-sm font-semibold mb-2 dark:text-gray-200">
              Content Date *
            </label>
            <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <Calendar className="w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={formData.content_date || ''}
                onChange={(e) =>
                  setFormData({ ...formData, content_date: e.target.value })
                }
                className="flex-1 bg-transparent dark:text-white outline-none"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Content Type */}
          <div>
            <label className="block text-sm font-semibold mb-2 dark:text-gray-200">
              Content Type *
            </label>
            <select
              value={formData.content_type || 'reel'}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  content_type: e.target.value as ContentType,
                })
              }
              className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <label className="block text-sm font-semibold mb-2 dark:text-gray-200">
              Status
            </label>
            <select
              value={formData.status || 'not_started'}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  status: e.target.value as ContentStatus,
                })
              }
              className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <label className="block text-sm font-semibold mb-2 dark:text-gray-200">
              Script / Caption
            </label>
            <textarea
              value={formData.script || ''}
              onChange={(e) =>
                setFormData({ ...formData, script: e.target.value })
              }
              placeholder="Full script with hooks, body, and CTA..."
              rows={4}
              className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
          </div>

          {/* Editing Style */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold mb-2 dark:text-gray-200">
                Editing Style
              </label>
              <select
                value={formData.editing_style || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    editing_style: (e.target.value || undefined) as EditingStyle | undefined,
                  })
                }
                className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              >
                <option value="">None</option>
                <option value="fast_paced">Fast-Paced</option>
                <option value="cinematic">Cinematic</option>
                <option value="educational">Educational</option>
                <option value="behind_scenes">Behind the Scenes</option>
                <option value="trending">Trending</option>
                <option value="tutorial">Tutorial</option>
                <option value="interview">Interview</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2 dark:text-gray-200">
                Music / Audio
              </label>
              <input
                type="text"
                value={formData.music_audio || ''}
                onChange={(e) =>
                  setFormData({ ...formData, music_audio: e.target.value })
                }
                placeholder="Track name or audio reference"
                className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Editing Notes */}
          <div>
            <label className="block text-sm font-semibold mb-2 dark:text-gray-200">
              Editing Notes
            </label>
            <textarea
              value={formData.editing_notes || ''}
              onChange={(e) =>
                setFormData({ ...formData, editing_notes: e.target.value })
              }
              placeholder="Custom editing requirements, references, effects..."
              rows={3}
              className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
          </div>

          {/* Platforms */}
          <div>
            <label className="block text-sm font-semibold mb-3 dark:text-gray-200">
              Platforms
            </label>
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
                  <span className="text-sm dark:text-gray-300 capitalize">
                    {platform}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Hashtags */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold mb-2 dark:text-gray-200">
                Hashtags
              </label>
              <textarea
                value={formData.hashtags || ''}
                onChange={(e) =>
                  setFormData({ ...formData, hashtags: e.target.value })
                }
                placeholder="#hashtag1 #hashtag2"
                rows={2}
                className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2 dark:text-gray-200">
                Thumbnail Reference
              </label>
              <input
                type="text"
                value={formData.thumbnail_reference || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    thumbnail_reference: e.target.value,
                  })
                }
                placeholder="Image URL or reference"
                className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Production Notes */}
          <div>
            <label className="block text-sm font-semibold mb-2 dark:text-gray-200">
              Production Notes
            </label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Additional production notes, filming requirements, etc."
              rows={3}
              className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
          </div>

          {/* Project Linking (optional) */}
          <div>
            <label className="block text-sm font-semibold mb-2 dark:text-gray-200">
              Link to Project (Optional)
            </label>
            <input
              type="number"
              value={formData.project_id || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  project_id: e.target.value ? parseInt(e.target.value) : undefined,
                })
              }
              placeholder="Project ID"
              className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Leave empty for no project link
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end border-t border-gray-200 dark:border-gray-700 pt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !formData.content_date || !formData.content_type}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading
                ? existingContent
                  ? 'Updating...'
                  : 'Creating...'
                : existingContent
                  ? 'Update Content'
                  : 'Create Content'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
