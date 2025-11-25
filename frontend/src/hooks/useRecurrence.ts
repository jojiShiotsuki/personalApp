import { useState, useCallback } from 'react';
import { RecurrenceType } from '@/types';

interface RecurrenceState {
  isRecurring: boolean;
  recurrenceType: RecurrenceType;
  recurrenceInterval: number;
  recurrenceDays: string[];
  recurrenceEndType: 'never' | 'date' | 'count';
  recurrenceEndDate: string;
  recurrenceCount: number;
  isCustomRecurrenceOpen: boolean;
}

const defaultState: RecurrenceState = {
  isRecurring: false,
  recurrenceType: RecurrenceType.DAILY,
  recurrenceInterval: 1,
  recurrenceDays: [],
  recurrenceEndType: 'never',
  recurrenceEndDate: '',
  recurrenceCount: 13,
  isCustomRecurrenceOpen: false,
};

export function useRecurrence() {
  const [state, setState] = useState<RecurrenceState>(defaultState);

  const setIsRecurring = useCallback((value: boolean) => {
    setState(prev => ({ ...prev, isRecurring: value }));
  }, []);

  const setRecurrenceType = useCallback((value: RecurrenceType) => {
    setState(prev => ({ ...prev, recurrenceType: value }));
  }, []);

  const setRecurrenceInterval = useCallback((value: number) => {
    setState(prev => ({ ...prev, recurrenceInterval: value }));
  }, []);

  const setRecurrenceDays = useCallback((value: string[]) => {
    setState(prev => ({ ...prev, recurrenceDays: value }));
  }, []);

  const setRecurrenceEndType = useCallback((value: 'never' | 'date' | 'count') => {
    setState(prev => ({ ...prev, recurrenceEndType: value }));
  }, []);

  const setRecurrenceEndDate = useCallback((value: string) => {
    setState(prev => ({ ...prev, recurrenceEndDate: value }));
  }, []);

  const setRecurrenceCount = useCallback((value: number) => {
    setState(prev => ({ ...prev, recurrenceCount: value }));
  }, []);

  const setIsCustomRecurrenceOpen = useCallback((value: boolean) => {
    setState(prev => ({ ...prev, isCustomRecurrenceOpen: value }));
  }, []);

  const resetRecurrence = useCallback(() => {
    setState(defaultState);
  }, []);

  const initFromTask = useCallback((task: {
    is_recurring?: boolean;
    recurrence_type?: RecurrenceType;
    recurrence_interval?: number;
    recurrence_days?: string[];
    recurrence_end_date?: string;
    recurrence_count?: number;
  } | null) => {
    if (!task) {
      setState(defaultState);
      return;
    }

    setState({
      isRecurring: task.is_recurring || false,
      recurrenceType: task.recurrence_type || RecurrenceType.DAILY,
      recurrenceInterval: task.recurrence_interval || 1,
      recurrenceDays: task.recurrence_days || [],
      recurrenceEndType: task.recurrence_end_date
        ? 'date'
        : task.recurrence_count && task.recurrence_count > 0
          ? 'count'
          : 'never',
      recurrenceEndDate: task.recurrence_end_date || '',
      recurrenceCount: task.recurrence_count || 13,
      isCustomRecurrenceOpen: false,
    });
  }, []);

  return {
    ...state,
    setIsRecurring,
    setRecurrenceType,
    setRecurrenceInterval,
    setRecurrenceDays,
    setRecurrenceEndType,
    setRecurrenceEndDate,
    setRecurrenceCount,
    setIsCustomRecurrenceOpen,
    resetRecurrence,
    initFromTask,
  };
}
