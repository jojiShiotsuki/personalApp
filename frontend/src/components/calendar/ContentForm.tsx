import { useState, useEffect } from 'react';
import { X, Trash2, Instagram, Youtube, Facebook, Twitter, Linkedin, Video, Film, LayoutGrid, FileText, Check, AtSign } from 'lucide-react';
import RichTextEditor from '../RichTextEditor';
import ConfirmModal from '../ConfirmModal';
import type { SocialContent, SocialContentCreate, SocialContentUpdate, ContentType, ContentStatus, EditingStyle, ReelType, RepurposeFormatStatus, RepurposeFormat } from '@/types';
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
  { id: 'tiktok', label: 'TikTok', icon: Video },
  { id: 'youtube', label: 'YouTube', icon: Youtube },
  { id: 'facebook', label: 'Facebook', icon: Facebook },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { id: 'twitter', label: 'Twitter', icon: Twitter },
];

type RepurposeGroup = {
  label: string;
  dayOffset: number;
  formats: { id: RepurposeFormat; label: string; icon: typeof Film }[];
};

const REPURPOSE_GROUPS: RepurposeGroup[] = [
  {
    label: 'Short-form Video',
    dayOffset: 0,
    formats: [
      { id: 'instagram_reel', label: 'Instagram Reel', icon: Instagram },
      { id: 'tiktok_reel', label: 'TikTok Reel', icon: Video },
      { id: 'youtube_short', label: 'YouTube Short', icon: Youtube },
      { id: 'facebook_reel', label: 'Facebook Reel', icon: Facebook },
      { id: 'linkedin_reel', label: 'LinkedIn Reel', icon: Linkedin },
    ],
  },
  {
    label: 'Carousel',
    dayOffset: 3,
    formats: [
      { id: 'instagram_carousel', label: 'Instagram Carousel', icon: Instagram },
      { id: 'linkedin_carousel', label: 'LinkedIn Carousel', icon: Linkedin },
      { id: 'facebook_carousel', label: 'Facebook Carousel', icon: Facebook },
      { id: 'tiktok_carousel', label: 'TikTok Carousel', icon: Video },
    ],
  },
  {
    label: 'Long Caption',
    dayOffset: 6,
    formats: [
      { id: 'instagram_long_caption', label: 'Instagram Long Caption', icon: Instagram },
      { id: 'tiktok_long_caption', label: 'TikTok Long Caption', icon: Video },
      { id: 'facebook_long_caption', label: 'Facebook Long Caption', icon: Facebook },
    ],
  },
  {
    label: 'Text Post',
    dayOffset: 9,
    formats: [
      { id: 'facebook_post', label: 'Facebook Post', icon: Facebook },
      { id: 'linkedin_post', label: 'LinkedIn Post', icon: Linkedin },
      { id: 'threads_post', label: 'Threads Post', icon: AtSign },
      { id: 'twitter_post', label: 'Twitter/X Post', icon: Twitter },
    ],
  },
];

const REEL_TYPES: { value: ReelType; label: string }[] = [
  { value: 'educational', label: 'Educational' },
  { value: 'before_after', label: 'Before/After' },
  { value: 'bts', label: 'BTS (Behind the Scenes)' },
  { value: 'social_proof', label: 'Social Proof' },
  { value: 'mini_audit', label: 'Mini-Audit' },
  { value: 'seo_education', label: 'SEO Education' },
  { value: 'client_results', label: 'Client Results' },
  { value: 'direct_cta', label: 'Direct CTA' },
  { value: 'full_redesign', label: 'Full Redesign' },
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
    title: '',
    script: '',
    reel_type: undefined,
    editing_style: undefined,
    editing_notes: '',
    hashtags: '',
    music_audio: '',
    thumbnail_reference: '',
    notes: '',
    project_id: undefined,
  });

  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [repurposeFormats, setRepurposeFormats] = useState<RepurposeFormatStatus[]>([]);

  useEffect(() => {
    if (existingContent) {
      setFormData(existingContent);
      setSelectedPlatforms(existingContent.platforms || []);
      setRepurposeFormats(existingContent.repurpose_formats || []);
    } else if (selectedDate) {
      setFormData((prev) => ({
        ...prev,
        content_date: formatDateForApi(selectedDate),
      }));
      setSelectedPlatforms([]);
      setRepurposeFormats([]);
    }
  }, [selectedDate, existingContent, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.content_date || !formData.content_type) return;

    const submitData = {
      ...formData,
      platforms: selectedPlatforms.length > 0 ? selectedPlatforms : [],
      repurpose_formats: repurposeFormats,  // Always send, even if empty
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
    if (existingContent && onDelete) {
      setShowDeleteConfirm(true);
    }
  };

  const getScheduledDate = (formatId: RepurposeFormat): string | undefined => {
    if (!formData.content_date) return undefined;
    const group = REPURPOSE_GROUPS.find((g) => g.formats.some((f) => f.id === formatId));
    if (!group || group.dayOffset === 0) return formData.content_date;
    const base = new Date(formData.content_date + 'T00:00:00');
    base.setDate(base.getDate() + group.dayOffset);
    return base.toISOString().split('T')[0];
  };

  const handleRepurposeToggle = (formatId: RepurposeFormat) => {
    setRepurposeFormats((prev) => {
      const existing = prev.find((f) => f.format === formatId);
      if (existing) {
        return prev.filter((f) => f.format !== formatId);
      } else {
        return [...prev, {
          format: formatId,
          status: 'not_started' as ContentStatus,
          scheduled_date: getScheduledDate(formatId),
        }];
      }
    });
  };

  const handleRepurposeStatusChange = (formatId: RepurposeFormat, status: ContentStatus) => {
    setRepurposeFormats((prev) =>
      prev.map((f) =>
        f.format === formatId
          ? { ...f, status, posted_date: status === 'posted' ? new Date().toISOString().split('T')[0] : undefined }
          : f
      )
    );
  };

  const handleRepurposeContentChange = (formatId: RepurposeFormat, content: string) => {
    setRepurposeFormats((prev) =>
      prev.map((f) =>
        f.format === formatId ? { ...f, content } : f
      )
    );
  };

  const handleRepurposeScheduledDateChange = (formatId: RepurposeFormat, scheduled_date: string) => {
    setRepurposeFormats((prev) =>
      prev.map((f) =>
        f.format === formatId ? { ...f, scheduled_date: scheduled_date || undefined } : f
      )
    );
  };

  const getRepurposeScheduledDate = (formatId: RepurposeFormat): string => {
    const format = repurposeFormats.find((f) => f.format === formatId);
    return format?.scheduled_date || '';
  };

  const getRepurposeStatus = (formatId: RepurposeFormat): ContentStatus | null => {
    const format = repurposeFormats.find((f) => f.format === formatId);
    return format?.status || null;
  };

  const getRepurposeContent = (formatId: RepurposeFormat): string => {
    const format = repurposeFormats.find((f) => f.format === formatId);
    return format?.content || '';
  };

  const getStatusColor = (status: ContentStatus) => {
    switch (status) {
      case 'posted':
        return 'bg-emerald-500';
      case 'scheduled':
        return 'bg-sky-500';
      case 'editing':
        return 'bg-amber-500';
      case 'filmed':
        return 'bg-purple-500';
      case 'scripted':
        return 'bg-rose-500';
      default:
        return 'bg-stone-500';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-stone-900 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 border border-stone-700 transform transition-all animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-700 shrink-0">
          <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
            {isEditMode ? 'Edit Content' : 'New Content'}
          </h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-2 text-stone-400 hover:text-white hover:bg-stone-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body - Scrollable */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Date & Type Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Date */}
              <div>
                <label className="block text-sm font-semibold text-stone-300 mb-1.5">
                  Content Date
                </label>
                <input
                  type="date"
                  value={formData.content_date || ''}
                  onChange={(e) => setFormData({ ...formData, content_date: e.target.value })}
                  className={cn(
                    "w-full px-4 py-2.5 rounded-xl border border-stone-600",
                    "bg-stone-700 text-white",
                    "focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500",
                    "transition-all duration-200"
                  )}
                  required
                  disabled={isLoading}
                />
              </div>

              {/* Content Type */}
              <div>
                <label className="block text-sm font-semibold text-stone-300 mb-1.5">
                  Content Type
                </label>
                <select
                  value={formData.content_type || 'reel'}
                  onChange={(e) => setFormData({ ...formData, content_type: e.target.value as ContentType })}
                  className={cn(
                    "w-full px-4 py-2.5 rounded-xl border border-stone-600",
                    "bg-stone-700 text-white",
                    "focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500",
                    "transition-all duration-200 cursor-pointer"
                  )}
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
            </div>

            {/* Reel Type - Only shown when content type is reel */}
            {formData.content_type === 'reel' && (
              <div>
                <label className="block text-sm font-semibold text-stone-300 mb-1.5">
                  Reel Type
                </label>
                <select
                  value={formData.reel_type || ''}
                  onChange={(e) => setFormData({ ...formData, reel_type: e.target.value as ReelType || undefined })}
                  className={cn(
                    "w-full px-4 py-2.5 rounded-xl border border-stone-600",
                    "bg-stone-700 text-white",
                    "focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500",
                    "transition-all duration-200 cursor-pointer"
                  )}
                  disabled={isLoading}
                >
                  <option value="">Select reel type...</option>
                  {REEL_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Status */}
            <div>
              <label className="block text-sm font-semibold text-stone-300 mb-1.5">
                Status
              </label>
              <select
                value={formData.status || 'not_started'}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as ContentStatus })}
                className={cn(
                  "w-full px-4 py-2.5 rounded-xl border border-stone-600",
                  "bg-stone-700 text-white",
                  "focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500",
                  "transition-all duration-200 cursor-pointer"
                )}
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

            {/* Repurpose Tracking */}
            <div>
              <label className="block text-sm font-semibold text-stone-300 mb-2">
                Repurpose Tracker
              </label>
              <p className="text-xs text-stone-400 mb-3">
                Track status for each format you plan to repurpose this content into
              </p>
              <div className="space-y-4">
                {REPURPOSE_GROUPS.map((group) => (
                  <div key={group.label}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                        {group.label}
                      </h4>
                      {formData.content_date && (
                        <span className="text-xs text-stone-500">
                          {group.dayOffset === 0 ? 'Same day' : `+${group.dayOffset} days`}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {group.formats.map((format) => {
                        const Icon = format.icon;
                        const currentStatus = getRepurposeStatus(format.id);
                        const isTracked = currentStatus !== null;

                        return (
                          <div
                            key={format.id}
                            className={cn(
                              "rounded-xl border transition-all duration-200",
                              isTracked
                                ? "bg-stone-800 border-stone-600"
                                : "bg-stone-800/50 border-stone-700 hover:border-stone-600"
                            )}
                          >
                            <div className="flex items-center gap-3 p-3">
                              {/* Toggle checkbox */}
                              <button
                                type="button"
                                onClick={() => handleRepurposeToggle(format.id)}
                                disabled={isLoading}
                                className={cn(
                                  "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 shrink-0",
                                  isTracked
                                    ? "bg-orange-500 border-orange-500"
                                    : "border-stone-500 hover:border-stone-400"
                                )}
                              >
                                {isTracked && <Check className="w-3 h-3 text-white" />}
                              </button>

                              {/* Format info */}
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Icon className={cn("w-4 h-4", isTracked ? "text-orange-500" : "text-stone-400")} />
                                <span className={cn(
                                  "text-sm font-medium",
                                  isTracked ? "text-white" : "text-stone-400"
                                )}>
                                  {format.label}
                                </span>
                              </div>

                              {/* Status dropdown (only when tracked) */}
                              {isTracked && (
                                <div className="flex items-center gap-2">
                                  <div className={cn("w-2 h-2 rounded-full", getStatusColor(currentStatus))} />
                                  <select
                                    value={currentStatus}
                                    onChange={(e) => handleRepurposeStatusChange(format.id, e.target.value as ContentStatus)}
                                    disabled={isLoading}
                                    className={cn(
                                      "px-2 py-1 rounded-lg text-xs font-medium",
                                      "bg-stone-700 text-white border border-stone-600",
                                      "focus:outline-none focus:ring-1 focus:ring-orange-500",
                                      "cursor-pointer"
                                    )}
                                  >
                                    <option value="not_started">Not Started</option>
                                    <option value="scripted">Scripted</option>
                                    <option value="filmed">Filmed</option>
                                    <option value="editing">Editing</option>
                                    <option value="scheduled">Scheduled</option>
                                    <option value="posted">Posted</option>
                                  </select>
                                </div>
                              )}
                            </div>

                            {/* Scheduled date (only when tracked) */}
                            {isTracked && (
                              <div className="flex items-center gap-2 px-3 pb-2">
                                <label className="text-xs text-stone-400 shrink-0">Scheduled:</label>
                                <input
                                  type="date"
                                  value={getRepurposeScheduledDate(format.id)}
                                  onChange={(e) => handleRepurposeScheduledDateChange(format.id, e.target.value)}
                                  disabled={isLoading}
                                  className={cn(
                                    "px-2 py-1 rounded-lg text-xs",
                                    "bg-stone-700/50 text-white border border-stone-600/50",
                                    "focus:outline-none focus:ring-1 focus:ring-orange-500/30 focus:border-orange-500/50",
                                    "transition-all duration-200"
                                  )}
                                />
                              </div>
                            )}

                            {/* Content field (only when tracked) */}
                            {isTracked && (
                              <div className="px-3 pb-3">
                                <textarea
                                  value={getRepurposeContent(format.id)}
                                  onChange={(e) => handleRepurposeContentChange(format.id, e.target.value)}
                                  placeholder={`Write your ${format.label.toLowerCase()} content here...`}
                                  rows={3}
                                  disabled={isLoading}
                                  className={cn(
                                    "w-full px-3 py-2 rounded-lg text-sm",
                                    "bg-stone-700/50 text-white border border-stone-600/50",
                                    "placeholder:text-stone-500",
                                    "focus:outline-none focus:ring-1 focus:ring-orange-500/30 focus:border-orange-500/50",
                                    "transition-all duration-200 resize-none"
                                  )}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Platforms */}
            <div>
              <label className="block text-sm font-semibold text-stone-300 mb-2">
                Platforms
              </label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((platform) => {
                  const Icon = platform.icon;
                  const isSelected = selectedPlatforms.includes(platform.id);
                  return (
                    <button
                      key={platform.id}
                      type="button"
                      onClick={() => handlePlatformToggle(platform.id)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-200",
                        isSelected
                          ? "bg-orange-500/10 border-orange-500 text-orange-500"
                          : "bg-stone-800 border-stone-600 text-stone-400 hover:bg-stone-700 hover:border-stone-500"
                      )}
                      disabled={isLoading}
                    >
                      <Icon className={cn("w-4 h-4", isSelected && "text-orange-500")} />
                      <span className="text-sm font-medium">{platform.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-semibold text-stone-300 mb-1.5">
                Title
              </label>
              <input
                type="text"
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Give your content a memorable title..."
                className={cn(
                  "w-full px-4 py-2.5 rounded-xl border border-stone-600",
                  "bg-stone-700 text-white",
                  "placeholder:text-stone-400",
                  "focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500",
                  "transition-all duration-200"
                )}
                disabled={isLoading}
              />
            </div>

            {/* Script/Caption */}
            <div>
              <label className="block text-sm font-semibold text-stone-300 mb-1.5">
                Script / Caption
              </label>
              <RichTextEditor
                value={formData.script || ''}
                onChange={(value) => setFormData({ ...formData, script: value })}
                className="min-h-[150px]"
                disabled={isLoading}
              />
            </div>

            {/* Editing Style & Music Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-stone-300 mb-1.5">
                  Editing Style
                </label>
                <select
                  value={formData.editing_style || ''}
                  onChange={(e) => setFormData({ ...formData, editing_style: e.target.value as EditingStyle || undefined })}
                  className={cn(
                    "w-full px-4 py-2.5 rounded-xl border border-stone-600",
                    "bg-stone-700 text-white",
                    "focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500",
                    "transition-all duration-200 cursor-pointer"
                  )}
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

              <div>
                <label className="block text-sm font-semibold text-stone-300 mb-1.5">
                  Music / Audio
                </label>
                <input
                  type="text"
                  value={formData.music_audio || ''}
                  onChange={(e) => setFormData({ ...formData, music_audio: e.target.value })}
                  placeholder="Song name or audio details..."
                  className={cn(
                    "w-full px-4 py-2.5 rounded-xl border border-stone-600",
                    "bg-stone-700 text-white",
                    "placeholder:text-stone-400",
                    "focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500",
                    "transition-all duration-200"
                  )}
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Hashtags */}
            <div>
              <label className="block text-sm font-semibold text-stone-300 mb-1.5">
                Hashtags
              </label>
              <input
                type="text"
                value={formData.hashtags || ''}
                onChange={(e) => setFormData({ ...formData, hashtags: e.target.value })}
                placeholder="#hashtag1 #hashtag2 #hashtag3"
                className={cn(
                  "w-full px-4 py-2.5 rounded-xl border border-stone-600",
                  "bg-stone-700 text-white",
                  "placeholder:text-stone-400",
                  "focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500",
                  "transition-all duration-200"
                )}
                disabled={isLoading}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold text-stone-300 mb-1.5">
                Notes
              </label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add any additional notes..."
                rows={3}
                className={cn(
                  "w-full px-4 py-2.5 rounded-xl border border-stone-600",
                  "bg-stone-700 text-white",
                  "placeholder:text-stone-400",
                  "focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500",
                  "transition-all duration-200 resize-none"
                )}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-stone-700 bg-stone-800">
            {isEditMode && onDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            ) : (
              <div />
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 text-stone-300 hover:bg-stone-700 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !formData.content_date || !formData.content_type}
                className="px-5 py-2 bg-gradient-to-r from-orange-600 to-orange-700 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-orange-600/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Saving...' : isEditMode ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </form>

        <ConfirmModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={() => {
            if (existingContent && onDelete) {
              onDelete(existingContent.id);
            }
            setShowDeleteConfirm(false);
          }}
          title="Delete Content"
          message="Are you sure you want to delete this content? This action cannot be undone."
          confirmText="Delete"
          variant="danger"
        />
      </div>
    </div>
  );
}
