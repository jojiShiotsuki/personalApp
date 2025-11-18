import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { socialContentApi } from '@/lib/api';
import type { SocialContent, SocialContentCreate, SocialContentUpdate } from '@/types';
import MonthView from '@/components/calendar/MonthView';
import ContentForm from '@/components/calendar/ContentForm';
import { getMonthName, formatDateForApi } from '@/lib/dateUtils';
import { Plus } from 'lucide-react';

type ViewLevel = 'months' | 'month' | 'day';

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
      <div className="border-b border-gray-200 px-8 py-6 bg-white">
        <h1 className="text-3xl font-bold text-gray-900">
          Social Media Calendar
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          {viewLevel === 'months' && `Plan and track your content for ${selectedYear}`}
          {viewLevel === 'month' && selectedMonth && `${new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long' })} ${selectedYear}`}
          {viewLevel === 'day' && selectedDay && selectedDay.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
        {/* Breadcrumb */}
        {(viewLevel === 'month' || viewLevel === 'day') && (
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
            <button onClick={handleBackToMonths} className="hover:text-gray-900 transition-colors">
              {selectedYear}
            </button>
            {selectedMonth && (
              <>
                <span>/</span>
                {viewLevel === 'day' ? (
                  <button onClick={handleBackToMonth} className="hover:text-gray-900 transition-colors">
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
                <span>/</span>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {yearSummary.months.map((monthData) => (
              <button
                key={monthData.month}
                onClick={() => handleMonthClick(monthData.month)}
                className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all text-left group"
              >
                <h2 className="text-xl font-semibold mb-3">
                  {getMonthName(monthData.month)}
                </h2>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">
                      Total Content:
                    </span>
                    <span className="font-semibold">{monthData.total_content}</span>
                  </div>

                  {monthData.total_content > 0 && (
                    <>
                      <div className="border-t border-gray-200 pt-2 mt-2">
                        <p className="text-gray-600 mb-1">By Status:</p>
                        {Object.entries(monthData.by_status).map(([status, count]) => (
                          <div key={status} className="flex justify-between text-xs">
                            <span className="capitalize">{status.replace('_', ' ')}</span>
                            <span>{count}</span>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-gray-200 pt-2 mt-2">
                        <p className="text-gray-600 mb-1">By Type:</p>
                        {Object.entries(monthData.by_type).map(([type, count]) => (
                          <div key={type} className="flex justify-between text-xs">
                            <span className="capitalize">{type.replace('_', ' ')}</span>
                            <span>{count}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {viewLevel === 'month' && selectedMonth && monthContent && (
          <MonthView
            year={selectedYear}
            month={selectedMonth}
            content={monthContent}
            onDayClick={handleDayClick}
          />
        )}

        {viewLevel === 'day' && selectedDay && (
          <div className="space-y-4">
            {/* Add Content Button */}
            <div className="flex justify-end">
              <button
                onClick={() => handleAddContent(selectedDay)}
                className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add Content
              </button>
            </div>

            {contentForDay.length === 0 ? (
              <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-200">
                <p>No content scheduled for this day</p>
              </div>
            ) : (
              contentForDay.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleEditContent(item)}
                  className="w-full text-left bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md hover:border-gray-300 transition-all cursor-pointer"
                >
                  {/* Header Row */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div>
                        <h3 className="text-lg font-semibold capitalize">
                          {item.content_type.replace('_', ' ')}
                        </h3>
                        <span className="inline-block mt-1 px-3 py-1 text-xs font-medium rounded-full capitalize bg-slate-100 text-slate-600 border border-slate-200">
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
                        <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg whitespace-pre-wrap">
                          {item.script}
                        </p>
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
                              className="px-3 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-full text-xs font-medium capitalize"
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
                        <p className="text-sm text-slate-600">{item.hashtags}</p>
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
                        <p className="text-sm text-slate-600">Project #{item.project_id}</p>
                      </div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Content Form */}
      <ContentForm
        isOpen={showForm}
        selectedDate={formContentDate}
        existingContent={editingContent}
        onClose={() => {
          setShowForm(false);
          setFormContentDate(null);
          setEditingContent(null);
        }}
        onSubmit={handleSubmitContent}
        onDelete={handleDeleteContent}
        isLoading={createMutation.isPending || updateMutation.isPending || deleteMutation.isPending}
      />
    </div>
  );
}
