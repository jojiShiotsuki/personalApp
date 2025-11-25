import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { socialContentApi } from '@/lib/api';
import type { SocialContent, SocialContentCreate, SocialContentUpdate } from '@/types';
import MonthView from '@/components/calendar/MonthView';
import ContentForm from '@/components/calendar/ContentForm';
import { getMonthName, formatDateForApi } from '@/lib/dateUtils';
import { Plus, Instagram, Youtube, Facebook, Twitter, Linkedin, Video, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type ViewLevel = 'months' | 'month' | 'day';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'posted':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800';
    case 'scheduled':
      return 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800';
    case 'editing':
      return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800';
    case 'filmed':
      return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800';
    case 'scripted':
      return 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800';
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700';
  }
};

const getPlatformIcon = (platform: string) => {
  switch (platform.toLowerCase()) {
    case 'instagram':
      return <Instagram className="w-3 h-3" />;
    case 'youtube':
    case 'youtube_shorts':
      return <Youtube className="w-3 h-3" />;
    case 'facebook':
      return <Facebook className="w-3 h-3" />;
    case 'twitter':
    case 'x':
      return <Twitter className="w-3 h-3" />;
    case 'linkedin':
      return <Linkedin className="w-3 h-3" />;
    case 'tiktok':
      return <span className="text-[8px] font-bold">TT</span>;
    default:
      return null;
  }
};

export default function SocialCalendar() {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();

  const [viewLevel, setViewLevel] = useState<ViewLevel>('months');
  const [selectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>();
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formContentDate, setFormContentDate] = useState<Date | null>(null);
  const [editingContent, setEditingContent] = useState<SocialContent | null>(null);

  // Queries - Fetch year summary for all month cards
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
      toast.success('Content created successfully');
    },
    onError: () => {
      toast.error('Failed to create content');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: SocialContentUpdate }) =>
      socialContentApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-content'] });
      setShowForm(false);
      setEditingContent(null);
      toast.success('Content updated successfully');
    },
    onError: () => {
      toast.error('Failed to update content');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: socialContentApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-content'] });
      setShowForm(false);
      setEditingContent(null);
      toast.success('Content deleted');
    },
    onError: () => {
      toast.error('Failed to delete content');
    },
  });

  // Navigation handlers
  const handleMonthClick = (month: number) => {
    setSelectedMonth(month);
    setViewLevel('month');
  };

  const handleDayClick = (date: Date) => {
    setSelectedDay(date);
    setViewLevel('day');
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

  // Find all content for selected day
  const contentForDay = selectedDay && monthContent
    ? monthContent.filter((c) => c.content_date === formatDateForApi(selectedDay))
    : [];

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900 overflow-auto transition-colors duration-200">
      {/* Header */}
      <div className="border-b border-gray-200/60 dark:border-gray-700 px-8 py-6 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm sticky top-0 z-10 transition-colors duration-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">
              Social Media Calendar
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {viewLevel === 'months' && `Plan and track your content for ${selectedYear}`}
              {viewLevel === 'month' && selectedMonth && `${new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long' })} ${selectedYear}`}
              {viewLevel === 'day' && selectedDay && selectedDay.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors shadow-sm hover:shadow-md"
            >
              <Plus className="w-4 h-4" />
              New Post
            </button>
          </div>
        </div>
        {/* Breadcrumb */}
        {(viewLevel === 'month' || viewLevel === 'day') && (
          <div className="mt-6 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <button onClick={handleBackToMonths} className="hover:text-gray-900 dark:hover:text-white transition-colors hover:underline">
              {selectedYear}
            </button>
            {selectedMonth && (
              <>
                <span className="text-gray-300 dark:text-gray-600">/</span>
                {viewLevel === 'day' ? (
                  <button onClick={handleBackToMonth} className="hover:text-gray-900 dark:hover:text-white transition-colors hover:underline">
                    {new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long' })}
                  </button>
                ) : (
                  <span className="text-gray-900 dark:text-white font-medium">
                    {new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long' })}
                  </span>
                )}
              </>
            )}
            {viewLevel === 'day' && selectedDay && (
              <>
                <span className="text-gray-300 dark:text-gray-600">/</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {selectedDay.toLocaleDateString('default', { day: 'numeric' })}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-8">
        {/* Views */}
        {viewLevel === 'months' && yearSummary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in duration-500">
            {yearSummary.months.map((monthData) => (
              <button
                key={monthData.month}
                onClick={() => handleMonthClick(monthData.month)}
                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/60 dark:border-gray-700 p-6 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 text-left group"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {getMonthName(monthData.month)}
                  </h2>
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    <Calendar className="w-4 h-4" />
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <span className="text-gray-500 dark:text-gray-400 font-medium">
                      Total Content
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white bg-white dark:bg-gray-800 px-2 py-0.5 rounded shadow-sm border border-gray-200 dark:border-gray-600">{monthData.total_content}</span>
                  </div>

                  {monthData.total_content > 0 && (
                    <>
                      <div className="pt-2">
                        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">By Status</p>
                        <div className="space-y-1.5">
                          {Object.entries(monthData.by_status).map(([status, count]) => (
                            <div key={status} className="flex justify-between text-xs items-center">
                              <span className="capitalize text-gray-500 dark:text-gray-400">{status.replace('_', ' ')}</span>
                              <span className="font-medium text-gray-900 dark:text-white">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {viewLevel === 'month' && selectedMonth && monthContent && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <MonthView
              year={selectedYear}
              month={selectedMonth}
              content={monthContent}
              onDayClick={handleDayClick}
            />
          </div>
        )}

        {viewLevel === 'day' && selectedDay && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Add Content Button */}
            <div className="flex justify-end">
              <button
                onClick={() => handleAddContent(selectedDay)}
                className="group flex items-center px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-xl hover:bg-blue-700 dark:hover:bg-blue-600 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <Plus className="w-5 h-5 mr-2 transition-transform duration-200 group-hover:rotate-90" />
                Add Content
              </button>
            </div>

            {contentForDay.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/60 dark:border-gray-700 shadow-sm">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                  <Video className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">No content scheduled</h3>
                <p className="text-gray-500 dark:text-gray-400">Plan your social media content for this day.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {contentForDay.map((item) => {
                  const platform = item.platforms?.[0] || 'default';
                  return (
                  <button
                    key={item.id}
                    onClick={() => handleEditContent(item)}
                    className="w-full text-left bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-blue-500/50 dark:hover:border-blue-400/50 transition-all duration-200 group"
                  >
                    {/* Header Row */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm",
                          platform === 'instagram' ? 'bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500' :
                          platform === 'youtube' ? 'bg-red-600' :
                          platform === 'facebook' ? 'bg-blue-600' :
                          platform === 'twitter' ? 'bg-sky-500' :
                          platform === 'linkedin' ? 'bg-blue-700' :
                          platform === 'tiktok' ? 'bg-black' : 'bg-gray-500'
                        )}>
                          {getPlatformIcon(platform)}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white capitalize group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {item.content_type.replace('_', ' ')}
                          </h3>
                          <span className={cn(
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize border mt-1",
                            getStatusColor(item.status)
                          )}>
                            {item.status}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {new Date(item.content_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="pl-16">
                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
                        {item.notes || (item.script ? item.script.replace(/<[^>]+>/g, '') : "No description")}
                      </p>
                    </div>
                  </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Modals */}
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
    </div>
  );
}
