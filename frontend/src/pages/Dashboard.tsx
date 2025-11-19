import { useQuery } from '@tanstack/react-query';
import { taskApi, dealApi, socialContentApi, goalApi } from '@/lib/api';
import { TaskStatus, DealStage } from '@/types';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  DollarSign,
  ListTodo,
  Briefcase,
  Sparkles,
  ChevronRight,
  Activity,
  Instagram,
  Youtube,
  Linkedin,
  Twitter,
  Facebook,
  Video,
  Target,
} from 'lucide-react';
import { isPast, isToday, parseISO, format, addDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { formatDateForApi } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'instagram': return <Instagram className="w-3 h-3" />;
      case 'youtube': return <Youtube className="w-3 h-3" />;
      case 'linkedin': return <Linkedin className="w-3 h-3" />;
      case 'twitter': return <Twitter className="w-3 h-3" />;
      case 'facebook': return <Facebook className="w-3 h-3" />;
      default: return <Video className="w-3 h-3" />;
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

  // Fetch upcoming social content
  const today = new Date();
  const nextWeek = addDays(today, 7);
  const { data: upcomingContent = [] } = useQuery({
    queryKey: ['social-content', 'upcoming'],
    queryFn: () => socialContentApi.list({
      start_date: formatDateForApi(today),
      end_date: formatDateForApi(nextWeek)
    }),
  });

  // Fetch active goals
  const { data: goals = [] } = useQuery({
    queryKey: ['goals', currentYear],
    queryFn: () => goalApi.getAll(undefined, currentYear),
  });

  const activeGoals = goals.filter(g => g.progress < 100).slice(0, 3);

  // Calculate task metrics
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
  const completedTasks = allTasks.filter(
    (task) => task.status === TaskStatus.COMPLETED
  );

  // Calculate CRM metrics
  const activeDeals = Array.isArray(allDeals)
    ? allDeals.filter((deal) => deal.stage !== DealStage.CLOSED_WON && deal.stage !== DealStage.CLOSED_LOST)
    : [];

  const pipelineValue = activeDeals.reduce(
    (sum, deal) => sum + (deal.value || 0),
    0
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="h-full bg-gray-50 overflow-auto">
      {/* Header with gradient */}
      <div className="bg-white/50 backdrop-blur-sm border-b border-gray-200/60 px-8 py-6 sticky top-0 z-10">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">
              Welcome back! Here's your overview for today
            </p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              {format(new Date(), 'EEEE')}
            </p>
            <p className="text-xl font-semibold text-gray-900">
              {format(new Date(), 'MMMM do, yyyy')}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        {/* Command Bar Hint - Enhanced */}
        <div className="bg-white border border-gray-200/60 rounded-2xl p-4 mb-8 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="p-2 bg-blue-50 rounded-xl">
                <Sparkles className="h-5 w-5 text-blue-600" />
              </div>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm text-gray-700">
                <strong className="text-gray-900 font-semibold">Pro tip:</strong> Press{' '}
                <kbd className="px-2.5 py-1 bg-gray-50 rounded-lg border border-gray-200 text-xs font-mono shadow-sm text-gray-600 mx-1">
                  Ctrl+K
                </kbd>{' '}
                to quickly add tasks using natural language like "meeting tomorrow at 3pm"
              </p>
            </div>
          </div>
        </div>
        {/* Metric Cards with Loading States */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 animate-in fade-in duration-500">
          {tasksLoading ? (
            // Loading Skeletons
            <>
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl shadow-sm p-6 animate-pulse border border-gray-200/60"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="h-4 bg-gray-100 rounded w-20 mb-3"></div>
                      <div className="h-8 bg-gray-200 rounded w-16"></div>
                    </div>
                    <div className="w-14 h-14 bg-gray-100 rounded-full"></div>
                  </div>
                  <div className="h-3 bg-gray-100 rounded w-24 mt-4"></div>
                </div>
              ))}
            </>
          ) : (
            <>
              {/* Today's Tasks - Enhanced */}
              <div className="group bg-white rounded-2xl shadow-sm hover:shadow-md p-6 transition-all duration-300 border border-gray-200/60 hover:border-blue-200 hover:-translate-y-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Today
                    </p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {todayTasks.length}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-xl transition-all duration-300 group-hover:bg-blue-100">
                    <Clock className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-4 font-medium">Tasks due today</p>
              </div>

              {/* Overdue Tasks - Enhanced */}
              <div className="group bg-white rounded-2xl shadow-sm hover:shadow-md p-6 transition-all duration-300 border border-gray-200/60 hover:border-rose-200 hover:-translate-y-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Overdue
                    </p>
                    <p className="text-3xl font-bold text-rose-500 mt-2">
                      {overdueTasks.length}
                    </p>
                  </div>
                  <div className="p-3 bg-rose-50 rounded-xl transition-all duration-300 group-hover:bg-rose-100">
                    <AlertCircle className="w-6 h-6 text-rose-600" />
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-4 font-medium">Need attention</p>
              </div>

              {/* Completed Tasks - Enhanced */}
              <div className="group bg-white rounded-2xl shadow-sm hover:shadow-md p-6 transition-all duration-300 border border-gray-200/60 hover:border-emerald-200 hover:-translate-y-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Completed
                    </p>
                    <p className="text-3xl font-bold text-emerald-600 mt-2">
                      {completedTasks.length}
                    </p>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-xl transition-all duration-300 group-hover:bg-emerald-100">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-4 font-medium">Tasks done</p>
              </div>

              {/* Pipeline Value - Enhanced */}
              <div className="group bg-white rounded-2xl shadow-sm hover:shadow-md p-6 transition-all duration-300 border border-gray-200/60 hover:border-purple-200 hover:-translate-y-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Pipeline
                    </p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {formatCurrency(pipelineValue)}
                    </p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-xl transition-all duration-300 group-hover:bg-purple-100">
                    <DollarSign className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-4 font-medium">
                  {activeDeals.length} active deals
                </p>
              </div>
            </>
          )}
        </div>

        {/* Three Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
          {/* Task List Widget - Enhanced */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/60 overflow-hidden hover:shadow-md transition-all duration-300">
            <div className="px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 rounded-lg">
                  <ListTodo className="w-4 h-4 text-blue-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Upcoming Tasks
                </h2>
              </div>
            </div>
            <div className="p-6">
              {tasksLoading ? (
                // Loading skeleton
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="p-4 bg-gray-50 rounded-xl animate-pulse"
                    >
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : allTasks.filter((task) => task.status !== TaskStatus.COMPLETED).length > 0 ? (
                <div className="space-y-3">
                  {allTasks
                    .filter((task) => task.status !== TaskStatus.COMPLETED)
                    .slice(0, 5)
                    .map((task) => (
                      <div
                        key={task.id}
                        className="group flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:shadow-md transition-all duration-300 cursor-pointer border border-transparent hover:border-gray-200 hover:bg-white"
                        onClick={() => navigate('/tasks')}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              task.priority === 'high'
                                ? 'bg-rose-500'
                                : task.priority === 'medium'
                                ? 'bg-amber-500'
                                : 'bg-blue-500'
                            }`}
                          />
                          <div>
                            <p className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                              {task.title}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {task.due_date
                                ? format(new Date(task.due_date), 'MMM d')
                                : 'No date'}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-gray-500 font-medium">No upcoming tasks</p>
                  <p className="text-sm text-gray-400 mt-1">You're all caught up!</p>
                </div>
              )}
            </div>
          </div>

          {/* Deals Widget - Enhanced */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/60 overflow-hidden hover:shadow-md transition-all duration-300">
            <div className="px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-50 rounded-lg">
                  <Briefcase className="w-4 h-4 text-purple-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Active Deals
                </h2>
              </div>
            </div>
            <div className="p-6">
              {dealsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="p-4 bg-gray-50 rounded-xl animate-pulse"
                    >
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : activeDeals.length > 0 ? (
                <div className="space-y-3">
                  {activeDeals.slice(0, 5).map((deal) => (
                    <div
                      key={deal.id}
                      className="group flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:shadow-md transition-all duration-300 cursor-pointer border border-transparent hover:border-gray-200 hover:bg-white"
                      onClick={() => navigate('/deals')}
                    >
                      <div>
                        <p className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                          {deal.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatCurrency(deal.value || 0)} • {deal.stage}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <DollarSign className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-gray-500 font-medium">No active deals</p>
                  <p className="text-sm text-gray-400 mt-1">Time to find new opportunities!</p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity Widget - Enhanced */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/60 overflow-hidden hover:shadow-md transition-all duration-300">
            <div className="px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-slate-100 rounded-lg">
                  <Activity className="w-4 h-4 text-slate-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Recent Activity
                </h2>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-6 relative before:absolute before:left-[27px] before:top-8 before:bottom-8 before:w-0.5 before:bg-gray-100">
                {/* Mock Activity Items */}
                {/*
                  {
                    text: 'Completed "Update website content"',
                    time: '2 hours ago',
                    icon: CheckCircle2,
                    color: 'text-emerald-600',
                    bg: 'bg-emerald-50',
                  },
                  {
                    text: 'New deal "Tech Corp Project" created',
                    time: '4 hours ago',
                    icon: DollarSign,
                    color: 'text-purple-600',
                    bg: 'bg-purple-50',
                  },
                  {
                    text: 'Meeting with John Doe',
                    time: 'Yesterday',
                    icon: Users,
                    color: 'text-blue-600',
                    bg: 'bg-blue-50',
                  },
                */}
                {/*
                  .map((activity, i) => (
                  <div key={i} className="relative flex gap-4">
                    <div
                      className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center border-2 border-white shadow-sm ${activity.bg}`}
                    >
                      <activity.icon className={`w-4 h-4 ${activity.color}`} />
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="text-sm font-medium text-gray-900">
                        {activity.text}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {activity.time}
                      </p>
                    </div>
                  </div>
                ))}
                */}
              </div>
            </div>
          </div>
        </div>

        {/* Second Row - Enhanced Widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          {/* Social Content Widget */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/60 overflow-hidden hover:shadow-md transition-all duration-300 lg:col-span-2">
            <div className="px-6 py-5 bg-white border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-pink-50 rounded-lg">
                  <Video className="w-4 h-4 text-pink-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Upcoming Social Content
                </h2>
              </div>
            </div>
            <div className="p-6">
              {upcomingContent.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No upcoming content scheduled</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {upcomingContent.map((content) => (
                    <div
                      key={content.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:shadow-md transition-all duration-300 border border-transparent hover:border-gray-200 hover:bg-white"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
                          <span className="text-lg font-bold text-gray-900">
                            {format(parseISO(content.content_date), 'd')}
                          </span>
                          <span className="block text-xs text-gray-500 uppercase font-bold text-center">
                            {format(parseISO(content.content_date), 'MMM')}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 capitalize">
                            {content.content_type.replace('_', ' ')}
                          </p>
                          <div className="flex gap-1 mt-1">
                            {content.platforms?.slice(0, 3).map(p => (
                              <span key={p} className="flex items-center justify-center w-6 h-6 bg-white rounded-full border border-gray-200 text-gray-600 shadow-sm" title={p}>
                                {getPlatformIcon(p)}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <span className={cn(
                        "text-xs px-2 py-1 rounded-lg font-medium border",
                        content.status === 'posted' ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                        content.status === 'scheduled' ? "bg-sky-50 text-sky-600 border-sky-200" :
                        "bg-gray-100 text-gray-600 border-gray-200"
                      )}>
                        {content.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Goals Widget */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/60 overflow-hidden hover:shadow-md transition-all duration-300">
            <div className="px-6 py-5 bg-white border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-50 rounded-lg">
                  <Target className="w-4 h-4 text-amber-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Active Goals
                </h2>
              </div>
            </div>
            <div className="p-6">
              {activeGoals.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No active goals</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeGoals.map((goal) => (
                    <div
                      key={goal.id}
                      className="p-4 bg-gray-50 rounded-xl hover:shadow-md transition-all duration-300 border border-transparent hover:border-gray-200 hover:bg-white"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-gray-900 text-sm line-clamp-1">
                          {goal.title}
                        </h3>
                        <span className="text-xs font-medium px-2 py-1 bg-white text-gray-600 rounded-lg border border-gray-200 shadow-sm">
                          {goal.quarter}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-rose-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${goal.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 font-bold w-8 text-right">
                          {goal.progress}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
