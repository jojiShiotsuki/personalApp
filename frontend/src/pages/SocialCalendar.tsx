import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { socialContentApi } from '@/lib/api';
import type { SocialContent, SocialContentCreate, SocialContentUpdate } from '@/types';
import MonthView from '@/components/calendar/MonthView';
import ContentForm from '@/components/calendar/ContentForm';
import { getMonthName, formatDateForApi } from '@/lib/dateUtils';
import { Plus, Instagram, Youtube, Facebook, Twitter, Linkedin, Video, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

type ViewLevel = 'months' | 'month' | 'day';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'posted':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'scheduled':
      return 'bg-sky-100 text-sky-700 border-sky-200';
    case 'editing':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'filmed':
      return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'scripted':
      return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200';
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
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: SocialContentUpdate }) =>
      socialContentApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-content'] });
      setShowForm(false);
      setEditingContent(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: socialContentApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-content'] });
      setShowForm(false);
      setEditingContent(null);
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
    try {
      if (editingContent) {
        await updateMutation.mutateAsync({ id: editingContent.id, data: data as SocialContentUpdate });
      } else {
        await createMutation.mutateAsync(data as SocialContentCreate);
      }
    } catch (error) {
      console.error('Error submitting content:', error);
    }
  };

  const handleDeleteContent = async (id: number) => {
    try {
      await deleteMutation.mutateAsync(id);
    } catch (error) {
      console.error('Error deleting content:', error);
    }
  };

  // Find all content for selected day
  const contentForDay = selectedDay && monthContent
    ? monthContent.filter((c) => c.content_date === formatDateForApi(selectedDay))
    : [];

  return (
    <div className="h-full bg-gray-50 overflow-auto">
      {/* Header */}
      <div className="border-b border-gray-200/60 px-8 py-6 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
              Social Media Calendar
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {viewLevel === 'months' && `Plan and track your content for ${selectedYear}`}
              {viewLevel === 'month' && selectedMonth && `${new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long' })} ${selectedYear}`}
              {viewLevel === 'day' && selectedDay && selectedDay.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-sm hover:shadow-md"
            >
              <Plus className="w-4 h-4" />
              New Post
            </button>
          </div>
        </div>
        {/* Breadcrumb */}
        {(viewLevel === 'month' || viewLevel === 'day') && (
          <div className="mt-6 flex items-center gap-2 text-sm text-gray-600">
            <button onClick={handleBackToMonths} className="hover:text-gray-900 transition-colors hover:underline">
              {selectedYear}
            </button>
            {selectedMonth && (
              <>
                <span className="text-gray-300">/</span>
                {viewLevel === 'day' ? (
                  <button onClick={handleBackToMonth} className="hover:text-gray-900 transition-colors hover:underline">
                    {new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long' })}
                  </button>
                ) : (
                  <span className="text-gray-900 font-medium">
                    {new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long' })}
                  </span>
                )}
              </>
            )}
            {viewLevel === 'day' && selectedDay && (
              <>
                <span className="text-gray-300">/</span>
                <span className="text-gray-900 font-medium">
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
                className="bg-white rounded-2xl border border-gray-200/60 p-6 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 text-left group"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {getMonthName(monthData.month)}
                  </h2>
                  <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                    <Calendar className="w-4 h-4" />
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                    <span className="text-gray-600 font-medium">
                      Total Content
                    </span>
                    <span className="font-semibold text-gray-900 bg-white px-2 py-0.5 rounded shadow-sm border border-gray-100">{monthData.total_content}</span>
                  </div>

                  {monthData.total_content > 0 && (
                    <>
                      <div className="pt-2">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">By Status</p>
                        <div className="space-y-1.5">
                          {Object.entries(monthData.by_status).map(([status, count]) => (
                            <div key={status} className="flex justify-between text-xs items-center">
                              <span className="capitalize text-gray-600">{status.replace('_', ' ')}</span>
                              <span className="font-medium text-gray-900">{count}</span>
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
                className="group flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <Plus className="w-5 h-5 mr-2 transition-transform duration-200 group-hover:rotate-90" />
                Add Content
              </button>
            </div>

            {contentForDay.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl border border-gray-200/60 shadow-sm">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                  <Video className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">No content scheduled</h3>
                <p className="text-gray-500">Plan your social media content for this day.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {contentForDay.map((item) => {
                  const platform = item.platforms?.[0] || 'default';
                  return (
                  <button
                    key={item.id}
                    onClick={() => handleEditContent(item)}
                    className="w-full text-left bg-white border border-gray-200/60 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-200 group"
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
                          <h3 className="text-lg font-semibold text-gray-900 capitalize group-hover:text-blue-600 transition-colors">
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
                        <div className="text-sm font-medium text-gray-900">
                          {new Date(item.content_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="pl-16">
                      <p className="text-sm text-gray-600 line-clamp-2 mb-3">
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
