import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { socialContentApi } from '@/lib/api';
import type { SocialContent, SocialContentCreate, SocialContentUpdate } from '@/types';
import MonthView from '@/components/calendar/MonthView';
import ContentForm from '@/components/calendar/ContentForm';
import { getMonthName, formatDateForApi } from '@/lib/dateUtils';
import { Plus, ChevronLeft, ChevronRight, Instagram, Youtube, Facebook, Twitter, Linkedin, Video, Calendar, Sparkles, Film, LayoutGrid, FileText, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type ViewLevel = 'years' | 'months' | 'month' | 'day';

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'posted':
      return { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' };
    case 'scheduled':
      return { bg: 'bg-sky-100 dark:bg-sky-900/40', text: 'text-sky-700 dark:text-sky-300', dot: 'bg-sky-500' };
    case 'editing':
      return { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' };
    case 'filmed':
      return { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300', dot: 'bg-purple-500' };
    case 'scripted':
      return { bg: 'bg-rose-100 dark:bg-rose-900/40', text: 'text-rose-700 dark:text-rose-300', dot: 'bg-rose-500' };
    default:
      return { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-300', dot: 'bg-gray-400' };
  }
};

const getPlatformIcon = (platform: string) => {
  const iconClass = 'w-4 h-4';
  switch (platform.toLowerCase()) {
    case 'instagram':
      return <Instagram className={iconClass} />;
    case 'youtube':
    case 'youtube_shorts':
      return <Youtube className={iconClass} />;
    case 'facebook':
      return <Facebook className={iconClass} />;
    case 'twitter':
    case 'x':
      return <Twitter className={iconClass} />;
    case 'linkedin':
      return <Linkedin className={iconClass} />;
    case 'tiktok':
      return <span className="text-xs font-bold">TT</span>;
    default:
      return null;
  }
};

const getFormatIcon = (format: string) => {
  switch (format) {
    case 'reel':
      return Film;
    case 'carousel':
      return LayoutGrid;
    case 'long_caption':
      return FileText;
    default:
      return Film;
  }
};

const getFormatLabel = (format: string) => {
  switch (format) {
    case 'reel':
      return 'Reel';
    case 'carousel':
      return 'Carousel';
    case 'long_caption':
      return 'Long Caption';
    default:
      return format;
  }
};

export default function SocialCalendar() {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();

  const [viewLevel, setViewLevel] = useState<ViewLevel>('years');
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>();
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formContentDate, setFormContentDate] = useState<Date | null>(null);
  const [editingContent, setEditingContent] = useState<SocialContent | null>(null);

  // Queries
  const { data: yearSummary } = useQuery({
    queryKey: ['social-content', 'year', selectedYear],
    queryFn: () => socialContentApi.getYearSummary(selectedYear),
  });

  const { data: monthContent } = useQuery({
    queryKey: ['social-content', 'month', selectedYear, selectedMonth],
    queryFn: () => socialContentApi.getMonthContent(selectedYear, selectedMonth!),
    enabled: !!selectedMonth,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: socialContentApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-content'] });
      setShowForm(false);
      setFormContentDate(null);
      toast.success('Content created');
    },
    onError: () => toast.error('Failed to create content'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: SocialContentUpdate }) =>
      socialContentApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-content'] });
      setShowForm(false);
      setEditingContent(null);
      toast.success('Content updated');
    },
    onError: () => toast.error('Failed to update content'),
  });

  const deleteMutation = useMutation({
    mutationFn: socialContentApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-content'] });
      setShowForm(false);
      setEditingContent(null);
      toast.success('Content deleted');
    },
    onError: () => toast.error('Failed to delete content'),
  });

  // Navigation
  const handleYearClick = (year: number) => {
    setSelectedYear(year);
    setViewLevel('months');
  };

  const handleMonthClick = (month: number) => {
    setSelectedMonth(month);
    setViewLevel('month');
  };

  const handleDayClick = (date: Date) => {
    setSelectedDay(date);
    setViewLevel('day');
  };

  const handleBackToYears = () => {
    setViewLevel('years');
    setSelectedMonth(undefined);
    setSelectedDay(null);
  };

  const handleBackToMonths = () => {
    setViewLevel('months');
    setSelectedMonth(undefined);
    setSelectedDay(null);
  };

  const handleBackToMonth = () => {
    setViewLevel('month');
    setSelectedDay(null);
  };

  const handleAddContent = (date: Date) => {
    setFormContentDate(date);
    setEditingContent(null);
    setShowForm(true);
  };

  const handleEditContent = (content: SocialContent) => {
    setEditingContent(content);
    setFormContentDate(null);
    setShowForm(true);
  };

  const handleSubmitContent = async (data: SocialContentCreate | SocialContentUpdate) => {
    if (editingContent) {
      updateMutation.mutate({ id: editingContent.id, data: data as SocialContentUpdate });
    } else {
      createMutation.mutate(data as SocialContentCreate);
    }
  };

  const handleDeleteContent = (id: number) => {
    deleteMutation.mutate(id);
  };

  const contentForDay = selectedDay && monthContent
    ? monthContent.filter((c) => c.content_date === formatDateForApi(selectedDay))
    : [];

  // Get subtitle based on view
  const getSubtitle = () => {
    if (viewLevel === 'years') return 'Select a year to view your content calendar';
    if (viewLevel === 'months') return `Plan and track your content for ${selectedYear}`;
    if (viewLevel === 'month' && selectedMonth) {
      return `${getMonthName(selectedMonth)} ${selectedYear}`;
    }
    if (viewLevel === 'day' && selectedDay) {
      return selectedDay.toLocaleDateString('default', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    }
    return '';
  };

  return (
    <div className="min-h-full bg-[--exec-bg] grain overflow-auto">
      {/* Hero Header */}
      <header className="relative overflow-hidden sticky top-0 z-10">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[--exec-surface] via-[--exec-surface] to-[--exec-accent-bg-subtle]" />

        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-[--exec-accent]/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-gradient-to-t from-[--exec-sage]/5 to-transparent rounded-full blur-2xl" />

        <div className="relative px-8 pt-8 pb-6">
          {/* Breadcrumb chip */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[--exec-surface-alt] rounded-full mb-4 animate-fade-slide-up">
            <Sparkles className="w-3.5 h-3.5 text-[--exec-accent]" />
            <span className="text-xs font-medium text-[--exec-text-secondary]">Content Studio</span>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-4xl font-bold text-[--exec-text] tracking-tight animate-fade-slide-up delay-1" style={{ fontFamily: 'var(--font-display)' }}>
                Content <span className="text-[--exec-accent]">Calendar</span>
              </h1>
              <p className="text-[--exec-text-secondary] mt-2 text-lg animate-fade-slide-up delay-2">
                {getSubtitle()}
              </p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="group flex items-center gap-2 px-5 py-2.5 bg-orange-600 text-white rounded-2xl shadow-md shadow-orange-600/30 hover:bg-orange-700 hover:shadow-lg hover:shadow-orange-600/40 hover:-translate-y-0.5 transition-all duration-200 font-semibold animate-fade-slide-up delay-3"
            >
              <Plus className="w-5 h-5 transition-transform duration-200 group-hover:rotate-90" />
              New Post
            </button>
          </div>

          {/* Breadcrumb Navigation */}
          {viewLevel !== 'years' && (
            <div className="mt-4 flex items-center gap-2 text-sm text-[--exec-text-muted] animate-fade-slide-up delay-4">
              <button onClick={handleBackToYears} className="hover:text-[--exec-accent] transition-colors">
                Years
              </button>
              <span className="text-[--exec-border]">/</span>
              {viewLevel === 'months' ? (
                <span className="text-[--exec-text] font-medium">{selectedYear}</span>
              ) : (
                <button onClick={handleBackToMonths} className="hover:text-[--exec-accent] transition-colors">
                  {selectedYear}
                </button>
              )}
              {selectedMonth && (
                <>
                  <span className="text-[--exec-border]">/</span>
                  {viewLevel === 'day' ? (
                    <button onClick={handleBackToMonth} className="hover:text-[--exec-accent] transition-colors">
                      {getMonthName(selectedMonth)}
                    </button>
                  ) : (
                    <span className="text-[--exec-text] font-medium">{getMonthName(selectedMonth)}</span>
                  )}
                </>
              )}
              {viewLevel === 'day' && selectedDay && (
                <>
                  <span className="text-[--exec-border]">/</span>
                  <span className="text-[--exec-text] font-medium">
                    {selectedDay.getDate()}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="px-8 py-6">
        {/* Years View */}
        {viewLevel === 'years' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
            {Array.from({ length: 5 }, (_, i) => currentYear - 2 + i).map((year, idx) => (
              <button
                key={year}
                onClick={() => handleYearClick(year)}
                className={cn(
                  "group bento-card p-6 text-left animate-fade-slide-up",
                  year === currentYear && "ring-2 ring-[--exec-accent]/30"
                )}
                style={{ animationDelay: `${(idx + 5) * 50}ms` }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    year === currentYear
                      ? "bg-[--exec-accent-bg]"
                      : "bg-[--exec-surface-alt]"
                  )}>
                    <Calendar className={cn(
                      "w-5 h-5",
                      year === currentYear
                        ? "text-[--exec-accent]"
                        : "text-[--exec-text-muted]"
                    )} />
                  </div>
                  {year === currentYear && (
                    <span className="px-2.5 py-1 text-xs font-bold bg-[--exec-accent-bg] text-[--exec-accent] rounded-full">
                      Current
                    </span>
                  )}
                </div>
                <h2 className="text-3xl font-bold text-[--exec-text] group-hover:text-[--exec-accent] transition-colors" style={{ fontFamily: 'var(--font-display)' }}>
                  {year}
                </h2>
                <p className="text-sm text-[--exec-text-muted] mt-1">
                  {year < currentYear ? 'Past' : year > currentYear ? 'Upcoming' : 'This year'}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* Months View */}
        {viewLevel === 'months' && yearSummary && (
          <div className="space-y-6">
            {/* Year Navigation */}
            <div className="flex items-center justify-center gap-4 animate-fade-slide-up delay-5">
              <button
                onClick={() => setSelectedYear(selectedYear - 1)}
                className="p-2.5 rounded-xl bg-[--exec-surface] border border-[--exec-border] text-[--exec-text-secondary] hover:bg-[--exec-surface-alt] hover:border-[--exec-accent] hover:text-[--exec-accent] transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-3xl font-bold text-[--exec-text] min-w-[120px] text-center" style={{ fontFamily: 'var(--font-display)' }}>
                {selectedYear}
              </h2>
              <button
                onClick={() => setSelectedYear(selectedYear + 1)}
                className="p-2.5 rounded-xl bg-[--exec-surface] border border-[--exec-border] text-[--exec-text-secondary] hover:bg-[--exec-surface-alt] hover:border-[--exec-accent] hover:text-[--exec-accent] transition-all"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Months Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {yearSummary.months.map((monthData, idx) => {
                const hasContent = monthData.total_content > 0;
                return (
                  <button
                    key={monthData.month}
                    onClick={() => handleMonthClick(monthData.month)}
                    className="group bento-card p-5 text-left animate-fade-slide-up"
                    style={{ animationDelay: `${(idx + 6) * 50}ms` }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-bold text-[--exec-text] group-hover:text-[--exec-accent] transition-colors" style={{ fontFamily: 'var(--font-display)' }}>
                        {getMonthName(monthData.month)}
                      </h3>
                      {hasContent && (
                        <span className="px-2.5 py-1 text-xs font-bold bg-[--exec-accent-bg] text-[--exec-accent] rounded-full">
                          {monthData.total_content}
                        </span>
                      )}
                    </div>

                    {hasContent ? (
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(monthData.by_status).map(([status, count]) => {
                          const config = getStatusConfig(status);
                          return (
                            <div
                              key={status}
                              className={cn("flex items-center gap-1.5 px-2 py-1 rounded-lg", config.bg)}
                              title={`${count} ${status}`}
                            >
                              <div className={cn("w-2.5 h-2.5 rounded-full", config.dot)} />
                              <span className={cn("text-xs font-semibold", config.text)}>
                                {count as number}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-[--exec-text-muted]">No content</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Month Calendar View */}
        {viewLevel === 'month' && selectedMonth && monthContent && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Month Navigation */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => {
                  if (selectedMonth === 1) {
                    setSelectedMonth(12);
                    setSelectedYear(selectedYear - 1);
                  } else {
                    setSelectedMonth(selectedMonth - 1);
                  }
                }}
                className="p-2.5 rounded-xl bg-[--exec-surface] border border-[--exec-border] text-[--exec-text-secondary] hover:bg-[--exec-surface-alt] hover:border-[--exec-accent] hover:text-[--exec-accent] transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-2xl font-bold text-[--exec-text] min-w-[200px] text-center" style={{ fontFamily: 'var(--font-display)' }}>
                {getMonthName(selectedMonth)} {selectedYear}
              </h2>
              <button
                onClick={() => {
                  if (selectedMonth === 12) {
                    setSelectedMonth(1);
                    setSelectedYear(selectedYear + 1);
                  } else {
                    setSelectedMonth(selectedMonth + 1);
                  }
                }}
                className="p-2.5 rounded-xl bg-[--exec-surface] border border-[--exec-border] text-[--exec-text-secondary] hover:bg-[--exec-surface-alt] hover:border-[--exec-accent] hover:text-[--exec-accent] transition-all"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <MonthView
              year={selectedYear}
              month={selectedMonth}
              content={monthContent}
              onDayClick={handleDayClick}
            />
          </div>
        )}

        {/* Day View */}
        {viewLevel === 'day' && selectedDay && (
          <div className="space-y-6">
            {/* Day Navigation */}
            <div className="flex items-center justify-between animate-fade-slide-up delay-5">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    const prevDay = new Date(selectedDay);
                    prevDay.setDate(prevDay.getDate() - 1);
                    setSelectedDay(prevDay);
                    if (prevDay.getMonth() + 1 !== selectedMonth) {
                      setSelectedMonth(prevDay.getMonth() + 1);
                      setSelectedYear(prevDay.getFullYear());
                    }
                  }}
                  className="p-2.5 rounded-xl bg-[--exec-surface] border border-[--exec-border] text-[--exec-text-secondary] hover:bg-[--exec-surface-alt] hover:border-[--exec-accent] hover:text-[--exec-accent] transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-bold text-[--exec-text] min-w-[180px] text-center" style={{ fontFamily: 'var(--font-display)' }}>
                  {selectedDay.toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric' })}
                </h2>
                <button
                  onClick={() => {
                    const nextDay = new Date(selectedDay);
                    nextDay.setDate(nextDay.getDate() + 1);
                    setSelectedDay(nextDay);
                    if (nextDay.getMonth() + 1 !== selectedMonth) {
                      setSelectedMonth(nextDay.getMonth() + 1);
                      setSelectedYear(nextDay.getFullYear());
                    }
                  }}
                  className="p-2.5 rounded-xl bg-[--exec-surface] border border-[--exec-border] text-[--exec-text-secondary] hover:bg-[--exec-surface-alt] hover:border-[--exec-accent] hover:text-[--exec-accent] transition-all"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <button
                onClick={() => handleAddContent(selectedDay)}
                className="group flex items-center gap-2 px-5 py-2.5 bg-orange-600 text-white rounded-2xl shadow-md shadow-orange-600/30 hover:bg-orange-700 hover:shadow-lg hover:shadow-orange-600/40 hover:-translate-y-0.5 transition-all duration-200 font-semibold"
              >
                <Plus className="w-5 h-5 transition-transform duration-200 group-hover:rotate-90" />
                Add Content
              </button>
            </div>

            {contentForDay.length === 0 ? (
              <div className="bento-card-static p-12 text-center animate-fade-slide-up delay-6">
                <div className="w-16 h-16 rounded-2xl bg-[--exec-surface-alt] flex items-center justify-center mx-auto mb-4">
                  <Video className="w-8 h-8 text-[--exec-text-muted]" />
                </div>
                <h3 className="text-lg font-bold text-[--exec-text] mb-2" style={{ fontFamily: 'var(--font-display)' }}>No content scheduled</h3>
                <p className="text-[--exec-text-muted]">Plan your social media content for this day.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {contentForDay.map((item, idx) => {
                  const statusConfig = getStatusConfig(item.status);
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleEditContent(item)}
                      className="bento-card overflow-hidden animate-fade-slide-up cursor-pointer"
                      style={{ animationDelay: `${(idx + 6) * 50}ms` }}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between gap-4 p-6 border-b border-[--exec-border]">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <span className={cn(
                              "px-3 py-1 text-xs font-bold rounded-full capitalize",
                              statusConfig.bg, statusConfig.text
                            )}>
                              {item.status.replace('_', ' ')}
                            </span>
                            <span className="text-xs text-[--exec-text-muted] capitalize">
                              {item.content_type.replace('_', ' ')}
                            </span>
                            {item.content_type === 'reel' && item.reel_type && (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-[--exec-surface-alt] text-[--exec-text-secondary] capitalize">
                                {item.reel_type.replace('_', ' ')}
                              </span>
                            )}
                          </div>
                          <h2 className="text-2xl font-bold text-[--exec-text]" style={{ fontFamily: 'var(--font-display)' }}>
                            {item.title || <span className="capitalize text-[--exec-text-muted]">{item.content_type.replace('_', ' ')}</span>}
                          </h2>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditContent(item);
                          }}
                          className="px-4 py-2 bg-[--exec-surface-alt] text-[--exec-text-secondary] rounded-xl hover:bg-[--exec-accent] hover:text-white transition-all duration-200 text-sm font-medium"
                        >
                          Edit
                        </button>
                      </div>

                      {/* Body */}
                      <div className="p-6 space-y-6">
                        {/* Platforms */}
                        {item.platforms && item.platforms.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-[--exec-text-muted] uppercase tracking-wider mb-3">Platforms</h4>
                            <div className="flex flex-wrap gap-2">
                              {item.platforms.map((p) => (
                                <div
                                  key={p}
                                  className={cn(
                                    "flex items-center gap-2 px-3 py-2 rounded-xl text-white text-sm font-medium",
                                    p === 'instagram' ? 'bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500' :
                                    p === 'youtube' ? 'bg-red-600' :
                                    p === 'facebook' ? 'bg-blue-600' :
                                    p === 'twitter' ? 'bg-sky-500' :
                                    p === 'linkedin' ? 'bg-blue-700' :
                                    p === 'tiktok' ? 'bg-black' : 'bg-[--exec-surface-alt] text-[--exec-text]'
                                  )}
                                >
                                  {getPlatformIcon(p)}
                                  <span className="capitalize">{p}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Script/Caption */}
                        {item.script && (
                          <div>
                            <h4 className="text-xs font-semibold text-[--exec-text-muted] uppercase tracking-wider mb-3">Script / Caption</h4>
                            <div
                              className="prose prose-sm max-w-none text-[--exec-text-secondary] bg-[--exec-surface-alt] rounded-xl p-4"
                              dangerouslySetInnerHTML={{ __html: item.script }}
                            />
                          </div>
                        )}

                        {/* Repurpose Tracker */}
                        {item.repurpose_formats && item.repurpose_formats.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-[--exec-text-muted] uppercase tracking-wider mb-3">Repurpose Tracker</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              {item.repurpose_formats.map((rf) => {
                                const FormatIcon = getFormatIcon(rf.format);
                                const rfStatusConfig = getStatusConfig(rf.status);
                                return (
                                  <div
                                    key={rf.format}
                                    className={cn(
                                      "flex items-center gap-3 p-3 rounded-xl border",
                                      rfStatusConfig.bg,
                                      rf.status === 'posted' ? 'border-emerald-500/30' : 'border-transparent'
                                    )}
                                  >
                                    <FormatIcon className={cn("w-5 h-5", rfStatusConfig.text)} />
                                    <div className="flex-1 min-w-0">
                                      <p className={cn("font-medium text-sm", rfStatusConfig.text)}>
                                        {getFormatLabel(rf.format)}
                                      </p>
                                      <p className="text-xs text-[--exec-text-muted] capitalize">
                                        {rf.status.replace('_', ' ')}
                                      </p>
                                    </div>
                                    {rf.status === 'posted' && (
                                      <Check className="w-5 h-5 text-emerald-500" />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Details Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {item.editing_style && (
                            <div className="bg-[--exec-surface-alt] rounded-xl p-4">
                              <h4 className="text-xs font-semibold text-[--exec-text-muted] uppercase tracking-wider mb-1">Editing Style</h4>
                              <p className="text-[--exec-text] font-medium capitalize">{item.editing_style.replace('_', ' ')}</p>
                            </div>
                          )}
                          {item.music_audio && (
                            <div className="bg-[--exec-surface-alt] rounded-xl p-4">
                              <h4 className="text-xs font-semibold text-[--exec-text-muted] uppercase tracking-wider mb-1">Music / Audio</h4>
                              <p className="text-[--exec-text] font-medium">{item.music_audio}</p>
                            </div>
                          )}
                        </div>

                        {/* Hashtags */}
                        {item.hashtags && (
                          <div>
                            <h4 className="text-xs font-semibold text-[--exec-text-muted] uppercase tracking-wider mb-3">Hashtags</h4>
                            <p className="text-[--exec-accent] text-sm">{item.hashtags}</p>
                          </div>
                        )}

                        {/* Notes */}
                        {item.notes && (
                          <div>
                            <h4 className="text-xs font-semibold text-[--exec-text-muted] uppercase tracking-wider mb-3">Notes</h4>
                            <p className="text-[--exec-text-secondary] text-sm whitespace-pre-wrap">{item.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <ContentForm
          isOpen={showForm}
          onClose={() => {
            setShowForm(false);
            setEditingContent(null);
            setFormContentDate(null);
          }}
          onSubmit={handleSubmitContent}
          onDelete={editingContent ? () => handleDeleteContent(editingContent.id) : undefined}
          selectedDate={formContentDate || (editingContent ? new Date(editingContent.content_date) : null)}
          existingContent={editingContent || null}
        />
      )}
    </div>
  );
}
