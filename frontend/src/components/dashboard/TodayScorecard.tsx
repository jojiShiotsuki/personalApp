import { useQuery } from '@tanstack/react-query';
import { taskApi, dealApi, timeApi, dailyOutreachApi } from '@/lib/api';
import { TaskStatus, DealStage } from '@/types';
import type { DailyOutreachStats, TimeEntry } from '@/types';
import {
  CheckCircle2,
  Send,
  Clock,
  TrendingUp,
  Zap,
  ArrowRight,
} from 'lucide-react';
import { isToday, parseISO, format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface ScoreCardProps {
  icon: React.ReactNode;
  label: string;
  current: number;
  target?: number;
  suffix?: string;
  color: string;
  bgColor: string;
  onClick?: () => void;
}

function ScoreCard({ icon, label, current, target, suffix = '', color, bgColor, onClick }: ScoreCardProps) {
  const percentage = target ? Math.min(100, (current / target) * 100) : 100;

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 p-5 rounded-2xl transition-all duration-200 group text-left",
        bgColor,
        onClick && "hover:scale-[1.02] hover:shadow-lg cursor-pointer"
      )}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", color)}>
          {icon}
        </div>
        {onClick && (
          <ArrowRight className="w-4 h-4 text-[--exec-text-muted] opacity-0 group-hover:opacity-100 ml-auto transition-opacity" />
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold text-[--exec-text]" style={{ fontFamily: 'var(--font-display)' }}>
          {current}
        </span>
        {target && (
          <span className="text-lg text-[--exec-text-muted]">/ {target}</span>
        )}
        {suffix && (
          <span className="text-sm text-[--exec-text-muted] ml-1">{suffix}</span>
        )}
      </div>
      <p className="text-sm text-[--exec-text-secondary] mt-1 font-medium">{label}</p>
      {target && (
        <div className="mt-3 h-1.5 bg-[--exec-surface] rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              percentage >= 100 ? "bg-[--exec-success]" : "bg-[--exec-accent]"
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </button>
  );
}

export default function TodayScorecard() {
  const navigate = useNavigate();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Fetch tasks
  const { data: allTasks = [] } = useQuery({
    queryKey: ['tasks', 'all'],
    queryFn: () => taskApi.getAll(),
  });

  // Fetch outreach stats
  const { data: outreachStats } = useQuery<DailyOutreachStats>({
    queryKey: ['daily-outreach-stats'],
    queryFn: dailyOutreachApi.getTodayStats,
  });

  // Fetch time entries for today
  const { data: timeEntries = [] } = useQuery({
    queryKey: ['time-entries', todayStr],
    queryFn: () => timeApi.listEntries({ start_date: todayStr, end_date: todayStr }),
  });

  // Fetch deals for pipeline
  const { data: allDeals = [] } = useQuery({
    queryKey: ['deals', 'all'],
    queryFn: () => dealApi.getAll(),
  });

  // Calculate task metrics
  const todayTasks = allTasks.filter((task) =>
    task.due_date && isToday(parseISO(task.due_date))
  );
  const completedToday = todayTasks.filter(
    (task) => task.status === TaskStatus.COMPLETED || task.status === TaskStatus.SKIPPED
  );

  // Calculate outreach metrics (total touches across all channels)
  const outreachCurrent = outreachStats
    ? (outreachStats.cold_emails?.current || 0) +
      (outreachStats.linkedin?.current || 0) +
      (outreachStats.calls?.current || 0) +
      (outreachStats.looms?.current || 0)
    : 0;
  const outreachTarget = outreachStats
    ? (outreachStats.cold_emails?.target || 0) +
      (outreachStats.linkedin?.target || 0) +
      (outreachStats.calls?.target || 0) +
      (outreachStats.looms?.target || 0)
    : 0;

  // Calculate time logged today (in hours)
  const totalSecondsToday = timeEntries.reduce((sum: number, entry: TimeEntry) => {
    return sum + (entry.duration_seconds || 0);
  }, 0);
  const hoursLogged = Math.round((totalSecondsToday / 3600) * 10) / 10;

  // Calculate pipeline value
  const activeDeals = Array.isArray(allDeals)
    ? allDeals.filter((deal) => deal.stage !== DealStage.CLOSED_WON && deal.stage !== DealStage.CLOSED_LOST)
    : [];
  const pipelineValue = activeDeals.reduce(
    (sum, deal) => sum + (Number(deal.value) || 0),
    0
  );

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${Math.round(amount / 1000)}K`;
    return `$${amount.toFixed(0)}`;
  };

  // Calculate overall progress
  const taskProgress = todayTasks.length > 0 ? (completedToday.length / todayTasks.length) * 100 : 100;
  const outreachProgress = outreachTarget > 0 ? (outreachCurrent / outreachTarget) * 100 : 100;
  const overallProgress = Math.round((taskProgress + outreachProgress) / 2);

  return (
    <div className="bento-card overflow-hidden animate-fade-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[--exec-border-subtle]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[--exec-accent] to-[--exec-accent-dark] flex items-center justify-center shadow-lg">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-[--exec-text]">Today's Progress</h2>
            <p className="text-xs text-[--exec-text-muted]">{format(new Date(), 'EEEE, MMMM d')}</p>
          </div>
        </div>

        {/* Overall Progress */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-2xl font-bold text-[--exec-accent]" style={{ fontFamily: 'var(--font-display)' }}>
              {overallProgress}%
            </span>
            <p className="text-xs text-[--exec-text-muted]">complete</p>
          </div>
          <div className="w-12 h-12 relative">
            <svg className="w-12 h-12 transform -rotate-90">
              <circle
                cx="24"
                cy="24"
                r="20"
                stroke="var(--exec-surface-alt)"
                strokeWidth="4"
                fill="none"
              />
              <circle
                cx="24"
                cy="24"
                r="20"
                stroke="var(--exec-accent)"
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${(overallProgress / 100) * 125.6} 125.6`}
                className="transition-all duration-500"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Score Cards Grid */}
      <div className="p-4 grid grid-cols-4 gap-3">
        <ScoreCard
          icon={<CheckCircle2 className="w-5 h-5 text-[--exec-sage]" />}
          label="Tasks Done"
          current={completedToday.length}
          target={todayTasks.length || undefined}
          color="bg-[--exec-sage-bg]"
          bgColor="bg-[--exec-surface-alt]"
          onClick={() => navigate('/tasks')}
        />

        <ScoreCard
          icon={<Send className="w-5 h-5 text-[--exec-info]" />}
          label="Outreach"
          current={outreachCurrent}
          target={outreachTarget || undefined}
          color="bg-[--exec-info-bg]"
          bgColor="bg-[--exec-surface-alt]"
          onClick={() => navigate('/outreach?tab=dm-scripts')}
        />

        <ScoreCard
          icon={<Clock className="w-5 h-5 text-[--exec-accent]" />}
          label="Time Logged"
          current={hoursLogged}
          suffix="hrs"
          color="bg-[--exec-accent-bg]"
          bgColor="bg-[--exec-surface-alt]"
          onClick={() => navigate('/time')}
        />

        <ScoreCard
          icon={<TrendingUp className="w-5 h-5 text-[--exec-success]" />}
          label="Pipeline"
          current={0}
          suffix={formatCurrency(pipelineValue)}
          color="bg-[--exec-success-bg]"
          bgColor="bg-[--exec-surface-alt]"
          onClick={() => navigate('/deals')}
        />
      </div>
    </div>
  );
}
