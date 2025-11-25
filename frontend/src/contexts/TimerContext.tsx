import { createContext, useContext, useState, useCallback, useEffect, ReactNode, useRef } from 'react';
import { timeApi } from '../lib/api';
import type { TimeEntry, TimeEntryStart } from '../types';

interface TimerContextType {
  currentTimer: TimeEntry | null;
  isLoading: boolean;
  elapsedSeconds: number;
  startTimer: (data: TimeEntryStart) => Promise<void>;
  stopTimer: () => Promise<TimeEntry | null>;
  pauseTimer: () => Promise<void>;
  resumeTimer: () => Promise<void>;
  refreshTimer: () => Promise<void>;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

export function TimerProvider({ children }: { children: ReactNode }) {
  const [currentTimer, setCurrentTimer] = useState<TimeEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const intervalRef = useRef<number | null>(null);

  // Calculate elapsed time from timer start
  const calculateElapsed = useCallback((timer: TimeEntry): number => {
    if (!timer.start_time) return 0;

    const startTime = new Date(timer.start_time).getTime();
    const now = Date.now();

    if (timer.is_paused && timer.end_time) {
      // Timer is paused - elapsed is time until pause
      const pauseTime = new Date(timer.end_time).getTime();
      return Math.floor((pauseTime - startTime) / 1000) - (timer.paused_duration_seconds || 0);
    }

    // Timer is running
    return Math.floor((now - startTime) / 1000) - (timer.paused_duration_seconds || 0);
  }, []);

  // Fetch current timer from server
  const refreshTimer = useCallback(async () => {
    try {
      const timer = await timeApi.getCurrent();
      setCurrentTimer(timer);
      if (timer) {
        setElapsedSeconds(calculateElapsed(timer));
      } else {
        setElapsedSeconds(0);
      }
    } catch (error) {
      console.error('Failed to fetch current timer:', error);
      setCurrentTimer(null);
      setElapsedSeconds(0);
    }
  }, [calculateElapsed]);

  // Start the elapsed time counter
  const startElapsedCounter = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = window.setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
  }, []);

  // Stop the elapsed time counter
  const stopElapsedCounter = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Start a new timer
  const startTimer = useCallback(async (data: TimeEntryStart) => {
    setIsLoading(true);
    try {
      const timer = await timeApi.start(data);
      setCurrentTimer(timer);
      setElapsedSeconds(0);
      startElapsedCounter();
    } finally {
      setIsLoading(false);
    }
  }, [startElapsedCounter]);

  // Stop the current timer
  const stopTimer = useCallback(async (): Promise<TimeEntry | null> => {
    setIsLoading(true);
    try {
      const stoppedTimer = await timeApi.stop();
      setCurrentTimer(null);
      setElapsedSeconds(0);
      stopElapsedCounter();
      return stoppedTimer;
    } catch (error) {
      console.error('Failed to stop timer:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [stopElapsedCounter]);

  // Pause the current timer
  const pauseTimer = useCallback(async () => {
    setIsLoading(true);
    try {
      const timer = await timeApi.pause();
      setCurrentTimer(timer);
      stopElapsedCounter();
    } finally {
      setIsLoading(false);
    }
  }, [stopElapsedCounter]);

  // Resume the paused timer
  const resumeTimer = useCallback(async () => {
    setIsLoading(true);
    try {
      const timer = await timeApi.resume();
      setCurrentTimer(timer);
      setElapsedSeconds(calculateElapsed(timer));
      startElapsedCounter();
    } finally {
      setIsLoading(false);
    }
  }, [calculateElapsed, startElapsedCounter]);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await refreshTimer();
      setIsLoading(false);
    };
    init();
  }, [refreshTimer]);

  // Start/stop counter based on timer state
  useEffect(() => {
    if (currentTimer?.is_running && !currentTimer?.is_paused) {
      startElapsedCounter();
    } else {
      stopElapsedCounter();
    }

    return () => {
      stopElapsedCounter();
    };
  }, [currentTimer?.is_running, currentTimer?.is_paused, startElapsedCounter, stopElapsedCounter]);

  return (
    <TimerContext.Provider
      value={{
        currentTimer,
        isLoading,
        elapsedSeconds,
        startTimer,
        stopTimer,
        pauseTimer,
        resumeTimer,
        refreshTimer,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  const context = useContext(TimerContext);
  if (context === undefined) {
    throw new Error('useTimer must be used within a TimerProvider');
  }
  return context;
}

// Utility function to format elapsed time
export function formatElapsedTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
