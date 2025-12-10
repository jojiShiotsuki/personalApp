// frontend/src/contexts/CoachContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coachApi } from '../lib/api';
import type { CoachInsight, CoachSettings, CheckInsightRequest } from '../types/index';

interface CoachContextType {
  insights: CoachInsight[];
  currentToast: CoachInsight | null;
  settings: CoachSettings;
  updateSettings: (settings: Partial<CoachSettings>) => void;
  dismissInsight: (id: number) => void;
  checkAction: (request: CheckInsightRequest) => Promise<void>;
  dismissCurrentToast: () => void;
}

const defaultSettings: CoachSettings = {
  coach_level: 2,
  coach_enabled: true,
  stale_lead_days: 7,
  stuck_deal_days: 14,
};

const CoachContext = createContext<CoachContextType | undefined>(undefined);

export function CoachProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<CoachSettings>(() => {
    const stored = localStorage.getItem('coachSettings');
    return stored ? JSON.parse(stored) : defaultSettings;
  });
  const [currentToast, setCurrentToast] = useState<CoachInsight | null>(null);
  const [toastQueue, setToastQueue] = useState<CoachInsight[]>([]);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('coachSettings', JSON.stringify(settings));
  }, [settings]);

  // Fetch insights
  const { data: insights = [] } = useQuery({
    queryKey: ['coachInsights', settings],
    queryFn: () => coachApi.getInsights(settings),
    enabled: settings.coach_enabled,
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  // Dismiss mutation
  const dismissMutation = useMutation({
    mutationFn: coachApi.dismissInsight,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coachInsights'] });
    },
  });

  // Show next toast from queue
  useEffect(() => {
    if (!currentToast && toastQueue.length > 0) {
      const [next, ...rest] = toastQueue;
      setCurrentToast(next);
      setToastQueue(rest);

      // Mark as seen
      coachApi.markSeen(next.id);
    }
  }, [currentToast, toastQueue]);

  // Queue new insights as toasts
  useEffect(() => {
    const unseenInsights = insights.filter(i => !i.seen && !i.dismissed);
    if (unseenInsights.length > 0) {
      setToastQueue(prev => {
        const existingIds = new Set(prev.map(i => i.id));
        const newInsights = unseenInsights.filter(i => !existingIds.has(i.id));
        return [...prev, ...newInsights];
      });
    }
  }, [insights]);

  // Auto-dismiss toast after delay
  useEffect(() => {
    if (currentToast) {
      const delay = settings.coach_level === 3 ? 15000 : settings.coach_level === 2 ? 10000 : 8000;
      const timer = setTimeout(() => {
        setCurrentToast(null);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [currentToast, settings.coach_level]);

  const updateSettings = useCallback((newSettings: Partial<CoachSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const dismissInsight = useCallback((id: number) => {
    dismissMutation.mutate(id);
    if (currentToast?.id === id) {
      setCurrentToast(null);
    }
  }, [dismissMutation, currentToast]);

  const dismissCurrentToast = useCallback(() => {
    if (currentToast) {
      dismissMutation.mutate(currentToast.id);
      setCurrentToast(null);
    }
  }, [currentToast, dismissMutation]);

  const checkAction = useCallback(async (request: CheckInsightRequest) => {
    if (!settings.coach_enabled) return;

    try {
      const insight = await coachApi.checkAction(request, settings);
      if (insight) {
        setToastQueue(prev => [...prev, insight]);
      }
    } catch (error) {
      console.error('Failed to check action for insights:', error);
    }
  }, [settings]);

  return (
    <CoachContext.Provider
      value={{
        insights,
        currentToast,
        settings,
        updateSettings,
        dismissInsight,
        checkAction,
        dismissCurrentToast,
      }}
    >
      {children}
    </CoachContext.Provider>
  );
}

export function useCoach() {
  const context = useContext(CoachContext);
  if (context === undefined) {
    throw new Error('useCoach must be used within a CoachProvider');
  }
  return context;
}
