import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { socialContentApi } from '@/lib/api';
import type { SocialContentCreate, SocialContentUpdate } from '@/types';
import YearView from '@/components/calendar/YearView';
import MonthView from '@/components/calendar/MonthView';
import WeekView from '@/components/calendar/WeekView';
import DayContentModal from '@/components/calendar/DayContentModal';
import CalendarBreadcrumb from '@/components/calendar/CalendarBreadcrumb';
import { getWeeksInMonth } from '@/lib/dateUtils';

type ViewLevel = 'year' | 'month' | 'week';

export default function SocialCalendar() {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();

  const [viewLevel, setViewLevel] = useState<ViewLevel>('year');
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>();
  const [selectedWeek, setSelectedWeek] = useState<number>();
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  const { data: weekContent } = useQuery({
    queryKey: ['social-content', 'week', selectedYear, selectedMonth, selectedWeek],
    queryFn: () =>
      socialContentApi.getWeekContent(selectedYear, selectedMonth!, selectedWeek!),
    enabled: !!selectedMonth && !!selectedWeek,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: socialContentApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-content'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: SocialContentUpdate }) =>
      socialContentApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-content'] });
    },
  });

  // Navigation handlers
  const handleMonthClick = (month: number) => {
    setSelectedMonth(month);
    setViewLevel('month');
  };

  const handleWeekClick = (weekNumber: number) => {
    setSelectedWeek(weekNumber);
    setViewLevel('week');
  };

  const handleDayClick = (date: Date) => {
    setSelectedDay(date);
    setIsModalOpen(true);
  };

  const handleBackToYear = () => {
    setViewLevel('year');
    setSelectedMonth(undefined);
    setSelectedWeek(undefined);
  };

  const handleBackToMonth = () => {
    setViewLevel('month');
    setSelectedWeek(undefined);
  };

  const handleBackToWeek = () => {
    setViewLevel('week');
  };

  // Modal handlers
  const handleSaveContent = (data: SocialContentCreate | SocialContentUpdate) => {
    // Check if we're editing existing content for this day
    const existingContent = weekContent?.find(
      (c) => c.content_date === (data as SocialContentCreate).content_date
    );

    if (existingContent) {
      updateMutation.mutate({ id: existingContent.id, data: data as SocialContentUpdate });
    } else {
      createMutation.mutate(data as SocialContentCreate);
    }
  };

  // Get week days for WeekView
  const weekDays =
    selectedMonth && selectedWeek
      ? getWeeksInMonth(selectedYear, selectedMonth).find(
          (w) => w.weekNumber === selectedWeek
        )?.days || []
      : [];

  // Find existing content for selected day
  const existingContentForDay = selectedDay
    ? weekContent?.find((c) => c.content_date === selectedDay.toISOString().split('T')[0])
    : undefined;

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Breadcrumb */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-6 py-4 mb-6">
        <CalendarBreadcrumb
          year={selectedYear}
          month={selectedMonth}
          weekNumber={selectedWeek}
          onYearClick={handleBackToYear}
          onMonthClick={handleBackToMonth}
          onWeekClick={handleBackToWeek}
        />
      </div>

        {/* Views */}
        {viewLevel === 'year' && yearSummary && (
          <YearView
            year={selectedYear}
            months={yearSummary.months}
            onMonthClick={handleMonthClick}
          />
        )}

        {viewLevel === 'month' && selectedMonth && monthContent && (
          <MonthView
            year={selectedYear}
            month={selectedMonth}
            content={monthContent}
            onWeekClick={handleWeekClick}
          />
        )}

        {viewLevel === 'week' &&
          selectedMonth &&
          selectedWeek &&
          weekContent && (
            <WeekView
              year={selectedYear}
              month={selectedMonth}
              weekNumber={selectedWeek}
              weekDays={weekDays}
              content={weekContent}
              onDayClick={handleDayClick}
            />
          )}

      {/* Day Content Modal */}
      {selectedDay && (
        <DayContentModal
          isOpen={isModalOpen}
          date={selectedDay}
          existingContent={existingContentForDay}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedDay(null);
          }}
          onSave={handleSaveContent}
        />
      )}
    </div>
  );
}
