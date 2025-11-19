import { useState, useEffect } from 'react';
import { X, Trash2, Instagram, Youtube, Facebook, Twitter, Linkedin, Video } from 'lucide-react';
import RichTextEditor from '../RichTextEditor';
import type { SocialContent, SocialContentCreate, SocialContentUpdate, ContentType, ContentStatus, EditingStyle } from '@/types';
import { formatDateForApi } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

interface ContentFormProps {
  isOpen: boolean;
  selectedDate: Date | null;
  existingContent?: SocialContent | null;
  onClose: () => void;
  onSubmit: (data: SocialContentCreate | SocialContentUpdate) => void;
  onDelete?: (id: number) => void;
  isLoading?: boolean;
}

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: Instagram },
  { id: 'tiktok', label: 'TikTok', icon: Video }, // Using Video as generic for TikTok
  { id: 'youtube', label: 'YouTube', icon: Youtube },
  { id: 'facebook', label: 'Facebook', icon: Facebook },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { id: 'twitter', label: 'Twitter', icon: Twitter },
];

export default function ContentForm({
  isOpen,
  selectedDate,
  existingContent,
  onClose,
  onSubmit,
  onDelete,
  isLoading = false,
}: ContentFormProps) {
  const isEditMode = !!existingContent;

  const [formData, setFormData] = useState<Partial<SocialContent>>({
    content_date: '',
    content_type: 'reel',
    status: 'not_started',
    script: '',
    editing_style: undefined,
    editing_notes: '',
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
  }, [selectedDate, existingContent, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.content_date || !formData.content_type) return;

    const submitData = {
      ...formData,
      platforms: selectedPlatforms.length > 0 ? selectedPlatforms : undefined,
    };

    onSubmit(submitData as any);
  };

  const handlePlatformToggle = (platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  const handleDelete = () => {
    if (existingContent && onDelete && confirm('Are you sure you want to delete this content?')) {
      onDelete(existingContent.id);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center z-10">
          <h2 className="text-2xl font-bold text-gray-900">
            {isEditMode ? 'Edit Content' : 'Add New Content'}
          </h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Date */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Content Date *</label>
            <input
              type="date"
              value={formData.content_date || ''}
              onChange={(e) =>
                setFormData({ ...formData, content_date: e.target.value })
              }
              className="w-full border border-gray-200 bg-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
              required
              disabled={isLoading}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Content Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Content Type *</label>
              <select
                value={formData.content_type || 'reel'}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    content_type: e.target.value as ContentType,
                  })
                }
                className="w-full border border-gray-200 bg-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">Status *</label>
              <select
                value={formData.status || 'not_started'}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    status: e.target.value as ContentStatus,
                  })
                }
                className="w-full border border-gray-200 bg-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
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
          </div>

          {/* Script/Caption */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Script / Caption</label>
            <RichTextEditor
              value={formData.script || ''}
              onChange={(value) =>
                setFormData({ ...formData, script: value })
              }
              className="min-h-[200px]"
              disabled={isLoading}
            />
          </div>

          {/* Platforms */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Platforms</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {PLATFORMS.map((platform) => {
                const Icon = platform.icon;
                const isSelected = selectedPlatforms.includes(platform.id);
                return (
                  <button
                    key={platform.id}
                    type="button"
                    onClick={() => handlePlatformToggle(platform.id)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-200",
                      isSelected
                        ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm"
                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300"
                    )}
                    disabled={isLoading}
                  >
                    <Icon className={cn("w-4 h-4", isSelected ? "text-blue-600" : "text-gray-400")} />
                    <span className="text-sm font-medium">{platform.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Editing Style */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Editing Style</label>
              <select
                value={formData.editing_style || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    editing_style: e.target.value as EditingStyle || undefined,
                  })
                }
                className="w-full border border-gray-200 bg-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                disabled={isLoading}
              >
                <option value="">None</option>
                <option value="fast_paced">Fast Paced</option>
                <option value="cinematic">Cinematic</option>
                <option value="educational">Educational</option>
                <option value="behind_scenes">Behind Scenes</option>
                <option value="trending">Trending</option>
                <option value="tutorial">Tutorial</option>
                <option value="interview">Interview</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {/* Music/Audio */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Music / Audio</label>
              <input
                type="text"
                value={formData.music_audio || ''}
                onChange={(e) =>
                  setFormData({ ...formData, music_audio: e.target.value })
                }
                placeholder="Enter music or audio details..."
                className="w-full border border-gray-200 bg-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Editing Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Editing Notes</label>
            <textarea
              value={formData.editing_notes || ''}
              onChange={(e) =>
                setFormData({ ...formData, editing_notes: e.target.value })
              }
              placeholder="Add notes for the editor..."
              rows={3}
              className="w-full border border-gray-200 bg-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
              disabled={isLoading}
            />
          </div>

          {/* Hashtags */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Hashtags</label>
            <input
              type="text"
              value={formData.hashtags || ''}
              onChange={(e) =>
                setFormData({ ...formData, hashtags: e.target.value })
              }
              placeholder="#hashtag1 #hashtag2 #hashtag3"
              className="w-full border border-gray-200 bg-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
              disabled={isLoading}
            />
          </div>

          {/* Thumbnail Reference */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Thumbnail Reference</label>
            <input
              type="text"
              value={formData.thumbnail_reference || ''}
              onChange={(e) =>
                setFormData({ ...formData, thumbnail_reference: e.target.value })
              }
              placeholder="URL or description..."
              className="w-full border border-gray-200 bg-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
              disabled={isLoading}
            />
          </div>

          {/* Production Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Production Notes</label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Add production notes..."
              rows={3}
              className="w-full border border-gray-200 bg-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
              disabled={isLoading}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-between border-t border-gray-200 pt-6 sticky bottom-0 bg-white">
            <div>
              {isEditMode && onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isLoading}
                  className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 flex items-center gap-2 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !formData.content_date || !formData.content_type}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {isLoading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Content' : 'Create Content')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
