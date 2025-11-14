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
} from 'lucide-react';
import { isPast, isToday, parseISO, format } from 'date-fns';
import { formatCurrency } from '@/lib/currency';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();

  const { data: allTasks = [] } = useQuery({
    queryKey: ['tasks', 'all'],
    queryFn: () => taskApi.getAll(),
  });

  const { data: allDeals = [] } = useQuery({
    queryKey: ['deals', 'all'],
    queryFn: () => dealApi.getAll(),
  });

  // Fetch active projects
  const { data: projects = [] } = useQuery({
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
    <div className="h-full bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b px-8 py-6">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Welcome back! Here's your overview
        </p>
      </div>

      {/* Content */}
      <div className="p-8">
        {/* Command Bar Hint */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                <strong>Pro tip:</strong> Press{' '}
                <kbd className="px-2 py-0.5 bg-white rounded border border-blue-300 text-xs font-mono">
                  Ctrl+K
                </kbd>{' '}
                to quickly add tasks using natural language like "meeting tomorrow at 3pm"
              </p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Today's Tasks */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Today</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {todayTasks.length}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4">Tasks due today</p>
          </div>

          {/* Overdue Tasks */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Overdue</p>
                <p className="text-3xl font-bold text-red-600 mt-2">
                  {overdueTasks.length}
                </p>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4">Need attention</p>
          </div>

          {/* Completed Tasks */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-3xl font-bold text-green-600 mt-2">
                  {completedTasks.length}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4">Tasks done</p>
          </div>

          {/* Pipeline Value */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pipeline</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {formatCurrency(pipelineValue)}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <DollarSign className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4">{activeDeals.length} active deals</p>
          </div>
        </div>

        {/* Three Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Task List Widget */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                Upcoming Tasks
              </h2>
            </div>
            <div className="p-6">
              {allTasks.slice(0, 5).length > 0 ? (
                <div className="space-y-3">
                  {allTasks
                    .filter((task) => task.status !== TaskStatus.COMPLETED)
                    .slice(0, 5)
                    .map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {task.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {task.due_date
                              ? format(parseISO(task.due_date), 'MMM d')
                              : 'No due date'}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-1 text-xs rounded ${
                            task.priority === 'urgent'
                              ? 'bg-red-100 text-red-700'
                              : task.priority === 'high'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {task.priority}
                        </span>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">
                  No pending tasks
                </p>
              )}
            </div>
          </div>

          {/* Active Projects Widget */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Folder className="w-5 h-5" />
                Active Projects
              </h2>
              <button
                onClick={() => navigate('/projects')}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                View All
              </button>
            </div>

            {activeProjects.length === 0 ? (
              <p className="text-gray-500 text-sm">No active projects</p>
            ) : (
              <div className="space-y-3">
                {activeProjects.map((project) => (
                  <div
                    key={project.id}
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <div className="font-medium mb-2">{project.name}</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600">{project.progress}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>


          {/* CRM Stats Widget */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                CRM Overview
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {/* Win Rate */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <TrendingUp className="w-5 h-5 text-green-600 mr-3" />
                    <span className="text-sm font-medium text-gray-700">
                      Win Rate
                    </span>
                  </div>
                  <span className="text-lg font-bold text-green-600">
                    {winRate.toFixed(0)}%
                  </span>
                </div>

                {/* Active Deals */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Briefcase className="w-5 h-5 text-blue-600 mr-3" />
                    <span className="text-sm font-medium text-gray-700">
                      Active Deals
                    </span>
                  </div>
                  <span className="text-lg font-bold text-gray-900">
                    {activeDeals.length}
                  </span>
                </div>

                {/* Won Deals */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mr-3" />
                    <span className="text-sm font-medium text-gray-700">
                      Closed Won
                    </span>
                  </div>
                  <span className="text-lg font-bold text-gray-900">
                    {wonDeals.length}
                  </span>
                </div>

                {/* Total Pipeline */}
                <div className="mt-6 pt-6 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      Total Pipeline Value
                    </span>
                    <span className="text-2xl font-bold text-purple-600">
                      {formatCurrency(pipelineValue)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
