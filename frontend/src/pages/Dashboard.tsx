import { useQuery } from '@tanstack/react-query';
import { taskApi, dealApi, projectApi } from '@/lib/api';
import { TaskStatus, DealStage, ProjectStatus } from '@/types';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  Briefcase,
  DollarSign,
  Folder,
  Sparkles,
  ListTodo,
  Target,
} from 'lucide-react';
import { isPast, isToday, parseISO, format } from 'date-fns';
import { formatCurrency } from '@/lib/currency';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();

  const { data: allTasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', 'all'],
    queryFn: () => taskApi.getAll(),
  });

  const { data: allDeals = [], isLoading: dealsLoading } = useQuery({
    queryKey: ['deals', 'all'],
    queryFn: () => dealApi.getAll(),
  });

  // Fetch active projects
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectApi.getAll,
  });

  const activeProjects = projects.filter(
    (p) => p.status === ProjectStatus.IN_PROGRESS
  ).slice(0, 5);

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
  const activeDeals = allDeals.filter(
    (deal) =>
      deal.stage !== DealStage.CLOSED_WON &&
      deal.stage !== DealStage.CLOSED_LOST
  );
  const pipelineValue = activeDeals.reduce(
    (sum, deal) => {
      const value = Number(deal.value) || 0;
      return sum + value;
    },
    0
  );
  const wonDeals = allDeals.filter(
    (deal) => deal.stage === DealStage.CLOSED_WON
  );
  const lostDeals = allDeals.filter(
    (deal) => deal.stage === DealStage.CLOSED_LOST
  );
  const winRate =
    wonDeals.length + lostDeals.length > 0
      ? (wonDeals.length / (wonDeals.length + lostDeals.length)) * 100
      : 0;

  return (
    <div className="h-full bg-gray-50 overflow-auto">
      {/* Header with gradient */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-gray-600" />
          <h1 className="text-4xl font-bold text-gray-900">Dashboard</h1>
        </div>
        <p className="mt-2 text-gray-500 text-base">
          Welcome back! Here's your overview for today
        </p>
      </div>

      {/* Content */}
      <div className="p-8">
        {/* Command Bar Hint - Enhanced */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-8 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Sparkles className="h-5 w-5 text-gray-600" />
              </div>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm text-gray-700">
                <strong className="text-gray-700">Pro tip:</strong> Press{' '}
                <kbd className="px-2.5 py-1 bg-white rounded-lg border border-slate-300 text-xs font-mono shadow-sm">
                  Ctrl+K
                </kbd>{' '}
                to quickly add tasks using natural language like "meeting tomorrow at 3pm"
              </p>
            </div>
          </div>
        </div>
        {/* Metric Cards with Loading States */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {tasksLoading ? (
            // Loading Skeletons
            <>
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-lg p-6 animate-pulse"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-20 mb-3"></div>
                      <div className="h-8 bg-gray-300 rounded w-16"></div>
                    </div>
                    <div className="w-14 h-14 bg-gray-200 rounded-full"></div>
                  </div>
                  <div className="h-3 bg-gray-200 rounded w-24 mt-4"></div>
                </div>
              ))}
            </>
          ) : (
            <>
              {/* Today's Tasks - Enhanced */}
              <div className="group bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-xl p-6 transition-all duration-300 hover:scale-105 border border-blue-100/50 hover:border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                      Today
                    </p>
                    <p className="text-4xl font-bold text-gray-900 mt-2 transition-all duration-300 group-hover:scale-110">
                      {todayTasks.length}
                    </p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl group-hover:from-blue-200 group-hover:to-blue-300 transition-all duration-300 shadow-md">
                    <Clock className="w-7 h-7 text-blue-600" />
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-4 font-medium">Tasks due today</p>
              </div>

              {/* Overdue Tasks - Enhanced */}
              <div className="group bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-xl p-6 transition-all duration-300 hover:scale-105 border border-red-100/50 hover:border-red-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                      Overdue
                    </p>
                    <p className="text-4xl font-bold text-red-600 mt-2 transition-all duration-300 group-hover:scale-110">
                      {overdueTasks.length}
                    </p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-red-100 to-red-200 rounded-2xl group-hover:from-red-200 group-hover:to-red-300 transition-all duration-300 shadow-md">
                    <AlertCircle className="w-7 h-7 text-red-600" />
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-4 font-medium">Need attention</p>
              </div>

              {/* Completed Tasks - Enhanced */}
              <div className="group bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-xl p-6 transition-all duration-300 hover:scale-105 border border-green-100/50 hover:border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                      Completed
                    </p>
                    <p className="text-4xl font-bold text-green-600 mt-2 transition-all duration-300 group-hover:scale-110">
                      {completedTasks.length}
                    </p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-green-100 to-green-200 rounded-2xl group-hover:from-green-200 group-hover:to-green-300 transition-all duration-300 shadow-md">
                    <CheckCircle2 className="w-7 h-7 text-green-600" />
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-4 font-medium">Tasks done</p>
              </div>

              {/* Pipeline Value - Enhanced */}
              <div className="group bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-xl p-6 transition-all duration-300 hover:scale-105 border border-purple-100/50 hover:border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                      Pipeline
                    </p>
                    <p className="text-4xl font-bold text-gray-900 mt-2 transition-all duration-300 group-hover:scale-110">
                      {formatCurrency(pipelineValue)}
                    </p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-purple-100 to-purple-200 rounded-2xl group-hover:from-purple-200 group-hover:to-purple-300 transition-all duration-300 shadow-md">
                    <DollarSign className="w-7 h-7 text-purple-600" />
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Task List Widget - Enhanced */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300">
            <div className="px-6 py-5 bg-gradient-to-r from-blue-500/5 to-purple-500/5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <ListTodo className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-bold text-gray-900">
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
                    .map((task, index) => (
                      <div
                        key={task.id}
                        className="group flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-blue-50/30 rounded-xl hover:shadow-md transition-all duration-300 hover:scale-102 cursor-pointer border border-transparent hover:border-blue-200"
                        style={{
                          animationDelay: `${index * 50}ms`,
                          animation: 'fadeInUp 0.5s ease-out forwards',
                        }}
                      >
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                            {task.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-1 font-medium">
                            {task.due_date
                              ? format(parseISO(task.due_date), 'MMM d')
                              : 'No due date'}
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg shadow-sm ${
                            task.priority === 'urgent'
                              ? 'bg-gradient-to-r from-red-100 to-red-200 text-red-700'
                              : task.priority === 'high'
                              ? 'bg-gradient-to-r from-orange-100 to-orange-200 text-orange-700'
                              : 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700'
                          }`}
                        >
                          {task.priority}
                        </span>
                      </div>
                    ))}
                </div>
              ) : (
                // Enhanced empty state
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
                    <CheckCircle2 className="w-8 h-8 text-blue-600" />
                  </div>
                  <p className="text-gray-600 font-medium mb-1">All caught up!</p>
                  <p className="text-sm text-gray-500">No pending tasks at the moment</p>
                </div>
              )}
            </div>
          </div>

          {/* Active Projects Widget - Enhanced */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300">
            <div className="px-6 py-5 bg-gradient-to-r from-purple-500/5 to-pink-500/5 border-b border-gray-100">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Folder className="w-5 h-5 text-purple-600" />
                  <h2 className="text-lg font-bold text-gray-900">
                    Active Projects
                  </h2>
                </div>
                <button
                  onClick={() => navigate('/projects')}
                  className="text-sm text-purple-600 hover:text-purple-700 font-semibold hover:underline transition-all"
                >
                  View All →
                </button>
              </div>
            </div>

            <div className="p-6">
              {projectsLoading ? (
                // Loading skeleton
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="p-4 border border-gray-200 rounded-xl animate-pulse"
                    >
                      <div className="h-4 bg-gray-200 rounded w-2/3 mb-3"></div>
                      <div className="h-2 bg-gray-200 rounded w-full"></div>
                    </div>
                  ))}
                </div>
              ) : activeProjects.length === 0 ? (
                // Enhanced empty state
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 mb-4">
                    <Target className="w-8 h-8 text-purple-600" />
                  </div>
                  <p className="text-gray-600 font-medium mb-1">No active projects</p>
                  <p className="text-sm text-gray-500">Start a new project to see it here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeProjects.map((project, index) => (
                    <div
                      key={project.id}
                      onClick={() => navigate(`/projects/${project.id}`)}
                      className="group p-4 border-2 border-gray-200 rounded-xl hover:border-purple-300 hover:bg-gradient-to-r hover:from-purple-50/50 hover:to-pink-50/50 cursor-pointer transition-all duration-300 hover:shadow-md hover:scale-102"
                      style={{
                        animationDelay: `${index * 50}ms`,
                        animation: 'fadeInUp 0.5s ease-out forwards',
                      }}
                    >
                      <div className="font-semibold text-gray-900 mb-3 group-hover:text-purple-600 transition-colors">
                        {project.name}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-gray-200 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-purple-500 to-pink-500 h-2.5 rounded-full transition-all duration-500 shadow-sm"
                            style={{ width: `${project.progress}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-gray-700 min-w-[3rem] text-right">
                          {project.progress}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>


          {/* CRM Stats Widget - Enhanced */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300">
            <div className="px-6 py-5 bg-gradient-to-r from-green-500/5 to-emerald-500/5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-green-600" />
                <h2 className="text-lg font-bold text-gray-900">
                  CRM Overview
                </h2>
              </div>
            </div>
            <div className="p-6">
              {dealsLoading ? (
                // Loading skeleton
                <div className="space-y-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-3 animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-24"></div>
                      <div className="h-6 bg-gray-300 rounded w-16"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Win Rate */}
                  <div className="group flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl hover:shadow-md transition-all duration-300 border border-green-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-green-100 rounded-lg group-hover:scale-110 transition-transform">
                        <TrendingUp className="w-5 h-5 text-green-600" />
                      </div>
                      <span className="text-sm font-semibold text-gray-700">
                        Win Rate
                      </span>
                    </div>
                    <span className="text-2xl font-bold text-green-600">
                      {winRate.toFixed(0)}%
                    </span>
                  </div>

                  {/* Active Deals */}
                  <div className="group flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl hover:shadow-md transition-all duration-300 border border-blue-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-blue-100 rounded-lg group-hover:scale-110 transition-transform">
                        <Briefcase className="w-5 h-5 text-blue-600" />
                      </div>
                      <span className="text-sm font-semibold text-gray-700">
                        Active Deals
                      </span>
                    </div>
                    <span className="text-2xl font-bold text-gray-900">
                      {activeDeals.length}
                    </span>
                  </div>

                  {/* Won Deals */}
                  <div className="group flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl hover:shadow-md transition-all duration-300 border border-emerald-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-emerald-100 rounded-lg group-hover:scale-110 transition-transform">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      </div>
                      <span className="text-sm font-semibold text-gray-700">
                        Closed Won
                      </span>
                    </div>
                    <span className="text-2xl font-bold text-gray-900">
                      {wonDeals.length}
                    </span>
                  </div>

                  {/* Total Pipeline - Highlighted */}
                  <div className="mt-6 pt-6 border-t-2 border-gray-200">
                    <div className="p-5 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white/90 uppercase tracking-wide">
                          Total Pipeline Value
                        </span>
                        <span className="text-3xl font-bold text-white drop-shadow-md">
                          {formatCurrency(pipelineValue)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
