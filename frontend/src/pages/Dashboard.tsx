import { useQuery } from '@tanstack/react-query';
import { taskApi, dealApi, socialContentApi, goalApi } from '@/lib/api';
import { TaskStatus, DealStage } from '@/types';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  ArrowRight,
  ArrowUpRight,
  Calendar,
  Target,
  Zap,
  DollarSign,
  Activity,
  Instagram,
  Youtube,
  Linkedin,
  Twitter,
  Facebook,
  Video,
  Sparkles,
  Flame,
  Coffee,
} from 'lucide-react';
import { isPast, isToday, parseISO, format, addDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { formatDateForApi } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import MorningBriefing from '@/components/MorningBriefing';
import DailyOutreachTracker from '@/components/DailyOutreachTracker';
import SprintTracker from '@/components/SprintTracker';
import LoomAuditTracker from '@/components/LoomAuditTracker';
import PipelineCalculator from '@/components/PipelineCalculator';
import DiscoveryCallTracker from '@/components/DiscoveryCallTracker';
import TodayScorecard from '@/components/dashboard/TodayScorecard';

export default function Dashboard() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const currentHour = new Date().getHours();

  // Personal, friendly greeting with emoji hints
  const getGreeting = () => {
    if (currentHour < 12) return { text: 'Good morning', icon: Coffee, hint: 'Time to conquer' };
    if (currentHour < 17) return { text: 'Good afternoon', icon: Flame, hint: 'Keep the momentum' };
    return { text: 'Good evening', icon: Sparkles, hint: 'Wrap up strong' };
  };

  const greeting = getGreeting();

  const getPlatformIcon = (platform: string) => {
    const iconClass = 'w-3.5 h-3.5';
    switch (platform.toLowerCase()) {
      case 'instagram': return <Instagram className={iconClass} />;
      case 'youtube': return <Youtube className={iconClass} />;
      case 'linkedin': return <Linkedin className={iconClass} />;
      case 'twitter': return <Twitter className={iconClass} />;
      case 'facebook': return <Facebook className={iconClass} />;
      default: return <Video className={iconClass} />;
    }
  };

  const { data: allTasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', 'all'],
    queryFn: () => taskApi.getAll(),
  });

  const { data: allDeals = [], isLoading: dealsLoading } = useQuery({
    queryKey: ['deals', 'all'],
    queryFn: () => dealApi.getAll(),
  });

  const today = new Date();
  const nextWeek = addDays(today, 7);
  const { data: upcomingContent = [] } = useQuery({
    queryKey: ['social-content', 'upcoming'],
    queryFn: () => socialContentApi.list({
      start_date: formatDateForApi(today),
      end_date: formatDateForApi(nextWeek)
    }),
  });

  const { data: goals = [] } = useQuery({
    queryKey: ['goals', currentYear],
    queryFn: () => goalApi.getAll(undefined, currentYear),
  });

  const activeGoals = goals.filter(g => g.progress < 100).slice(0, 3);

  // Calculate metrics
  const todayTasks = allTasks.filter((task) =>
    task.due_date && isToday(parseISO(task.due_date))
  );
  const overdueTasks = allTasks.filter(
    (task) =>
      task.due_date &&
      task.status !== TaskStatus.COMPLETED &&
      isPast(parseISO(task.due_date)) &&
      !isToday(parseISO(task.due_date))
  );
  const inProgressTasks = allTasks.filter(
    (task) => task.status === TaskStatus.IN_PROGRESS
  );
  const completedToday = allTasks.filter(
    (task) => task.status === TaskStatus.COMPLETED && task.completed_at && isToday(parseISO(task.completed_at))
  );

  const activeDeals = Array.isArray(allDeals)
    ? allDeals.filter((deal) => deal.stage !== DealStage.CLOSED_WON && deal.stage !== DealStage.CLOSED_LOST)
    : [];

  const pipelineValue = activeDeals.reduce(
    (sum, deal) => sum + (Number(deal.value) || 0),
    0
  );

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toFixed(0)}`;
  };

  // Priority tasks
  const priorityTasks = [
    ...overdueTasks.slice(0, 2),
    ...todayTasks.filter(t => !overdueTasks.includes(t)).slice(0, 3),
  ].slice(0, 4);

  return (
    <div className="min-h-full bg-[--exec-bg] grain">
      {/* Hero Header */}
      <header className="relative overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[--exec-surface] via-[--exec-surface] to-[--exec-accent-bg-subtle]" />

        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-[--exec-accent]/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-gradient-to-t from-[--exec-sage]/5 to-transparent rounded-full blur-2xl" />

        <div className="relative px-8 pt-8 pb-6">
          {/* Date chip */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[--exec-surface-alt] rounded-full mb-4 animate-fade-slide-up">
            <greeting.icon className="w-3.5 h-3.5 text-[--exec-accent]" />
            <span className="text-xs font-medium text-[--exec-text-secondary]">
              {format(new Date(), 'EEEE, MMMM d')}
            </span>
            <span className="text-xs text-[--exec-text-muted]">·</span>
            <span className="text-xs text-[--exec-text-muted]">{greeting.hint}</span>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-4xl font-bold text-[--exec-text] tracking-tight animate-fade-slide-up delay-1" style={{ fontFamily: 'var(--font-display)' }}>
                {greeting.text}, <span className="text-[--exec-accent]">Joji</span>
              </h1>
              <p className="text-[--exec-text-secondary] mt-2 text-lg animate-fade-slide-up delay-2">
                {todayTasks.length === 0 && overdueTasks.length === 0
                  ? "Your schedule is clear. Time to focus on what matters."
                  : `You have ${todayTasks.length} task${todayTasks.length !== 1 ? 's' : ''} today${overdueTasks.length > 0 ? ` and ${overdueTasks.length} overdue` : ''}.`
                }
              </p>
            </div>

            {/* Quick Stats */}
            <div className="flex items-center gap-3 animate-fade-slide-up delay-3">
              {overdueTasks.length > 0 && (
                <button
                  onClick={() => navigate('/tasks')}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[--exec-danger-bg] text-[--exec-danger] rounded-2xl text-sm font-semibold hover:bg-[--exec-danger]/10 transition-colors group"
                >
                  <AlertCircle className="w-4 h-4" />
                  {overdueTasks.length} overdue
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}
              <button
                onClick={() => navigate('/tasks')}
                className="flex items-center gap-2 px-4 py-2.5 bg-[--exec-accent-bg] text-[--exec-accent] rounded-2xl text-sm font-semibold hover:bg-[--exec-accent]/10 transition-colors group"
              >
                <Zap className="w-4 h-4" />
                {todayTasks.length} today
                <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="px-8 py-6">
        {/* Today's Scorecard - Hero Widget */}
        <TodayScorecard />

        {/* Morning Briefing */}
        <div className="mt-6">
          <MorningBriefing />
        </div>

        {/* Daily Outreach Tracker */}
        <div className="mt-6">
          <DailyOutreachTracker />
        </div>

        {/* Sprint Tracker */}
        <div className="mt-6">
          <SprintTracker />
        </div>

        {/* Loom Audit Tracker */}
        <div className="mt-6">
          <LoomAuditTracker />
        </div>

        {/* Pipeline Calculator */}
        <div className="mt-6">
          <PipelineCalculator />
        </div>

        {/* Discovery Call Tracker */}
        <div className="mt-6">
          <DiscoveryCallTracker />
        </div>

        {/* Stats Grid - More visual impact */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          {/* Pipeline Value - Hero metric */}
          <div className="bento-card p-6 animate-fade-slide-up delay-1 card-glow">
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[--exec-accent] to-[--exec-accent-dark] flex items-center justify-center shadow-lg">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs font-bold text-[--exec-success] bg-[--exec-success-bg] px-2.5 py-1 rounded-full">
                +12%
              </span>
            </div>
            <p className="text-3xl font-bold text-[--exec-text] mt-4" style={{ fontFamily: 'var(--font-display)' }}>
              {formatCurrency(pipelineValue)}
            </p>
            <p className="text-sm text-[--exec-text-muted] mt-1 font-medium">Pipeline Value</p>
          </div>

          {/* In Progress */}
          <div className="bento-card p-6 animate-fade-slide-up delay-2">
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-2xl bg-[--exec-info-bg] flex items-center justify-center">
                <Activity className="w-6 h-6 text-[--exec-info]" />
              </div>
              <span className="text-xs font-medium text-[--exec-text-muted] bg-[--exec-surface-alt] px-2.5 py-1 rounded-full">
                {activeDeals.length} deals
              </span>
            </div>
            <p className="text-3xl font-bold text-[--exec-text] mt-4" style={{ fontFamily: 'var(--font-display)' }}>
              {inProgressTasks.length}
            </p>
            <p className="text-sm text-[--exec-text-muted] mt-1 font-medium">In Progress</p>
          </div>

          {/* Completed Today */}
          <div className="bento-card p-6 animate-fade-slide-up delay-3">
            <div className="w-12 h-12 rounded-2xl bg-[--exec-sage-bg] flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-[--exec-sage]" />
            </div>
            <p className="text-3xl font-bold text-[--exec-text] mt-4" style={{ fontFamily: 'var(--font-display)' }}>
              {completedToday.length}
            </p>
            <p className="text-sm text-[--exec-text-muted] mt-1 font-medium">Done Today</p>
          </div>

          {/* Active Goals */}
          <div className="bento-card p-6 animate-fade-slide-up delay-4">
            <div className="w-12 h-12 rounded-2xl bg-[--exec-accent-bg] flex items-center justify-center">
              <Target className="w-6 h-6 text-[--exec-accent]" />
            </div>
            <p className="text-3xl font-bold text-[--exec-text] mt-4" style={{ fontFamily: 'var(--font-display)' }}>
              {activeGoals.length}
            </p>
            <p className="text-sm text-[--exec-text-muted] mt-1 font-medium">Active Goals</p>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-12 gap-5 mt-6">

          {/* Priority Tasks - Large Card */}
          <div className="col-span-7 bento-card overflow-hidden animate-fade-slide-up delay-5">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[--exec-border-subtle]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[--exec-accent-bg] to-[--exec-accent-bg-subtle] flex items-center justify-center">
                  <Zap className="w-5 h-5 text-[--exec-accent]" />
                </div>
                <div>
                  <h2 className="font-semibold text-[--exec-text]">Priority Tasks</h2>
                  <p className="text-xs text-[--exec-text-muted]">Focus on what matters most</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/tasks')}
                className="flex items-center gap-2 text-sm text-[--exec-accent] hover:text-[--exec-accent-dark] transition-colors font-semibold group"
              >
                View all
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            <div className="p-4">
              {tasksLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 bg-[--exec-surface-alt] rounded-2xl animate-pulse" />
                  ))}
                </div>
              ) : priorityTasks.length > 0 ? (
                <div className="space-y-2">
                  {priorityTasks.map((task, idx) => {
                    const isOverdue = task.due_date && isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date));
                    return (
                      <button
                        key={task.id}
                        onClick={() => navigate('/tasks')}
                        className={cn(
                          "w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all duration-200 group",
                          isOverdue
                            ? "bg-[--exec-danger-bg] hover:bg-[--exec-danger]/10"
                            : "bg-[--exec-surface-alt] hover:bg-[--exec-surface-warm]"
                        )}
                      >
                        {/* Number indicator */}
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold",
                          isOverdue
                            ? "bg-[--exec-danger]/10 text-[--exec-danger]"
                            : "bg-[--exec-accent-bg] text-[--exec-accent]"
                        )}>
                          {isOverdue ? <AlertCircle className="w-4 h-4" /> : idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "font-medium truncate",
                            isOverdue ? "text-[--exec-danger]" : "text-[--exec-text] group-hover:text-[--exec-accent]"
                          )}>
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock className="w-3 h-3 text-[--exec-text-muted]" />
                            <p className="text-xs text-[--exec-text-muted]">
                              {isOverdue ? 'Overdue' : 'Due today'} · {task.due_date ? format(parseISO(task.due_date), 'MMM d') : 'No date'}
                            </p>
                          </div>
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-[--exec-text-muted] opacity-0 group-hover:opacity-100 group-hover:text-[--exec-accent] transition-all" />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-14 h-14 bg-[--exec-sage-bg] rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-7 h-7 text-[--exec-sage]" />
                  </div>
                  <p className="font-semibold text-[--exec-text]" style={{ fontFamily: 'var(--font-display)' }}>All caught up!</p>
                  <p className="text-sm text-[--exec-text-muted] mt-1">No priority tasks remaining</p>
                </div>
              )}
            </div>
          </div>

          {/* Goals Card */}
          <div className="col-span-5 bento-card overflow-hidden animate-fade-slide-up delay-6">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[--exec-border-subtle]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[--exec-sage-bg] flex items-center justify-center">
                  <Target className="w-5 h-5 text-[--exec-sage]" />
                </div>
                <h2 className="font-semibold text-[--exec-text]">Goals</h2>
              </div>
              <button
                onClick={() => navigate('/goals')}
                className="flex items-center gap-2 text-sm text-[--exec-text-muted] hover:text-[--exec-accent] transition-colors font-medium group"
              >
                View all
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {activeGoals.length > 0 ? (
                activeGoals.map((goal) => (
                  <div key={goal.id} className="group">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-[--exec-text] truncate flex-1 pr-2 font-medium group-hover:text-[--exec-accent] transition-colors">
                        {goal.title}
                      </span>
                      <span className="text-sm font-bold text-[--exec-sage]" style={{ fontFamily: 'var(--font-display)' }}>
                        {goal.progress}%
                      </span>
                    </div>
                    <div className="progress-exec">
                      <div
                        className="progress-exec-fill"
                        style={{ width: `${goal.progress}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-[--exec-text-muted]">
                  <Target className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No active goals</p>
                  <button
                    onClick={() => navigate('/goals')}
                    className="mt-3 text-xs font-medium text-[--exec-accent] hover:text-[--exec-accent-dark]"
                  >
                    Set your first goal →
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Deals Card */}
          <div className="col-span-6 bento-card overflow-hidden animate-fade-slide-up delay-7">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[--exec-border-subtle]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[--exec-success-bg] flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-[--exec-success]" />
                </div>
                <div>
                  <h2 className="font-semibold text-[--exec-text]">Active Deals</h2>
                  <p className="text-xs text-[--exec-text-muted]">{activeDeals.length} in pipeline</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/deals')}
                className="flex items-center gap-2 text-sm text-[--exec-text-muted] hover:text-[--exec-accent] transition-colors font-medium group"
              >
                View all
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            <div className="p-4">
              {dealsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-14 bg-[--exec-surface-alt] rounded-2xl animate-pulse" />
                  ))}
                </div>
              ) : activeDeals.length > 0 ? (
                <div className="space-y-2">
                  {activeDeals.slice(0, 4).map((deal) => (
                    <button
                      key={deal.id}
                      onClick={() => navigate('/deals')}
                      className="w-full flex items-center justify-between p-4 rounded-2xl bg-[--exec-surface-alt] hover:bg-[--exec-surface-warm] transition-all text-left group"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[--exec-text] truncate group-hover:text-[--exec-accent] transition-colors">
                          {deal.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-[--exec-text-muted] bg-[--exec-surface] px-2 py-0.5 rounded-full">
                            {deal.stage}
                          </span>
                        </div>
                      </div>
                      <span className="text-lg font-bold text-[--exec-success] shrink-0 ml-3" style={{ fontFamily: 'var(--font-display)' }}>
                        {formatCurrency(Number(deal.value) || 0)}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-[--exec-text-muted]">
                  <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No active deals</p>
                  <button
                    onClick={() => navigate('/deals')}
                    className="mt-3 text-xs font-medium text-[--exec-accent] hover:text-[--exec-accent-dark]"
                  >
                    Create your first deal →
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Content Calendar */}
          {upcomingContent.length > 0 && (
            <div className="col-span-6 bento-card overflow-hidden animate-fade-slide-up delay-8">
              <div className="flex items-center justify-between px-6 py-5 border-b border-[--exec-border-subtle]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[--exec-info-bg] flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-[--exec-info]" />
                  </div>
                  <h2 className="font-semibold text-[--exec-text]">Upcoming Content</h2>
                </div>
                <button
                  onClick={() => navigate('/social-calendar')}
                  className="flex items-center gap-2 text-sm text-[--exec-text-muted] hover:text-[--exec-accent] transition-colors font-medium group"
                >
                  Calendar
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              <div className="p-4 grid grid-cols-2 gap-3">
                {upcomingContent.slice(0, 4).map((content) => (
                  <div
                    key={content.id}
                    className="p-4 bg-[--exec-surface-alt] rounded-2xl hover:bg-[--exec-surface-warm] transition-all group cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-[--exec-accent]" style={{ fontFamily: 'var(--font-display)' }}>
                        {format(parseISO(content.content_date), 'MMM d')}
                      </span>
                      <span className={cn(
                        "text-xs px-2.5 py-1 rounded-full font-medium",
                        content.status === 'posted'
                          ? "bg-[--exec-success-bg] text-[--exec-success]"
                          : content.status === 'scheduled'
                            ? "bg-[--exec-accent-bg] text-[--exec-accent]"
                            : "bg-[--exec-surface] text-[--exec-text-muted]"
                      )}>
                        {content.status}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-[--exec-text] capitalize group-hover:text-[--exec-accent] transition-colors">
                      {content.content_type.replace('_', ' ')}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      {content.platforms?.slice(0, 3).map(p => (
                        <span key={p} className="w-6 h-6 rounded-full bg-[--exec-surface] flex items-center justify-center text-[--exec-text-muted]">
                          {getPlatformIcon(p)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
