import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Square, Clock, ChevronUp, ChevronDown, GripHorizontal } from 'lucide-react';
import { useTimer, formatElapsedTime } from '../contexts/TimerContext';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'floating-timer-position';

interface Position {
  x: number;
  y: number;
}

function getDefaultPosition(): Position {
  // Default to bottom-left, offset from sidebar
  return {
    x: 300,
    y: window.innerHeight - 250,
  };
}

function loadPosition(): Position {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const pos = JSON.parse(saved);
      // Validate position is within viewport
      return {
        x: Math.max(0, Math.min(pos.x, window.innerWidth - 100)),
        y: Math.max(0, Math.min(pos.y, window.innerHeight - 100)),
      };
    }
  } catch {
    // Ignore errors
  }
  return getDefaultPosition();
}

function savePosition(pos: Position) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  } catch {
    // Ignore errors
  }
}

export default function FloatingTimer() {
  const {
    currentTimer,
    isLoading,
    elapsedSeconds,
    stopTimer,
    pauseTimer,
    resumeTimer,
  } = useTimer();

  const [isExpanded, setIsExpanded] = useState(true);
  const [position, setPosition] = useState<Position>(loadPosition);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle mouse move during drag
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !dragRef.current) return;

    const deltaX = e.clientX - dragRef.current.startX;
    const deltaY = e.clientY - dragRef.current.startY;

    const newX = Math.max(0, Math.min(dragRef.current.startPosX + deltaX, window.innerWidth - 100));
    const newY = Math.max(0, Math.min(dragRef.current.startPosY + deltaY, window.innerHeight - 100));

    setPosition({ x: newX, y: newY });
  }, [isDragging]);

  // Handle mouse up to end drag
  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      savePosition(position);
    }
  }, [isDragging, position]);

  // Add/remove event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Start dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: position.x,
      startPosY: position.y,
    };
  };

  // Don't render if no timer is running
  if (!currentTimer) {
    return null;
  }

  const isPaused = currentTimer.is_paused;

  // Get context label
  const getContextLabel = () => {
    if (currentTimer.task_title) return currentTimer.task_title;
    if (currentTimer.project_name) return currentTimer.project_name;
    if (currentTimer.deal_title) return currentTimer.deal_title;
    if (currentTimer.description) return currentTimer.description;
    return 'Timer';
  };

  return (
    <div
      ref={containerRef}
      className="fixed z-50"
      style={{
        left: position.x,
        top: position.y,
        cursor: isDragging ? 'grabbing' : 'default',
      }}
    >
      <div
        className={cn(
          'bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700',
          'transition-all duration-300 ease-in-out',
          isExpanded ? 'w-72' : 'w-auto',
          isDragging && 'shadow-2xl scale-105'
        )}
      >
        {/* Drag handle */}
        <div
          onMouseDown={handleMouseDown}
          className={cn(
            'flex items-center justify-center py-1 cursor-grab rounded-t-2xl',
            'bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700',
            isDragging && 'cursor-grabbing'
          )}
        >
          <GripHorizontal className="w-4 h-4 text-gray-400" />
        </div>

        {/* Collapsed view - just the time */}
        {!isExpanded && (
          <button
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-2 px-4 py-3 text-sm font-mono"
          >
            <div className={cn(
              'w-2 h-2 rounded-full',
              isPaused ? 'bg-yellow-500' : 'bg-green-500 animate-pulse'
            )} />
            <span className="font-semibold text-gray-900 dark:text-white">
              {formatElapsedTime(elapsedSeconds)}
            </span>
            <ChevronUp className="w-4 h-4 text-gray-400" />
          </button>
        )}

        {/* Expanded view */}
        {isExpanded && (
          <div className="p-4">
            {/* Header with collapse button */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {isPaused ? 'Paused' : 'Tracking'}
                </span>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Timer display */}
            <div className="text-center mb-3">
              <div className="text-3xl font-mono font-bold text-gray-900 dark:text-white">
                {formatElapsedTime(elapsedSeconds)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate max-w-full">
                {getContextLabel()}
              </div>
            </div>

            {/* Status indicator */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className={cn(
                'w-2 h-2 rounded-full',
                isPaused ? 'bg-yellow-500' : 'bg-green-500 animate-pulse'
              )} />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {isPaused ? 'Paused' : 'Running'}
              </span>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-2">
              {isPaused ? (
                <button
                  onClick={resumeTimer}
                  disabled={isLoading}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    'bg-green-500 hover:bg-green-600 text-white',
                    isLoading && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Play className="w-4 h-4" />
                  Resume
                </button>
              ) : (
                <button
                  onClick={pauseTimer}
                  disabled={isLoading}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    'bg-yellow-500 hover:bg-yellow-600 text-white',
                    isLoading && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Pause className="w-4 h-4" />
                  Pause
                </button>
              )}
              <button
                onClick={stopTimer}
                disabled={isLoading}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  'bg-red-500 hover:bg-red-600 text-white',
                  isLoading && 'opacity-50 cursor-not-allowed'
                )}
              >
                <Square className="w-4 h-4" />
                Stop
              </button>
            </div>

            {/* Billable info if hourly rate set */}
            {currentTimer.hourly_rate && (
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Est. billable:{' '}
                  <span className="font-medium text-green-600 dark:text-green-400">
                    ${((elapsedSeconds / 3600) * Number(currentTimer.hourly_rate)).toFixed(2)}
                  </span>
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
