import axios from 'axios';
import type {
  Task,
  TaskCreate,
  TaskUpdate,
  Contact,
  ContactCreate,
  Deal,
  DealCreate,
  Interaction,
  InteractionCreate,
  ContextExport,
  Goal,
  GoalCreate,
  GoalUpdate,
  GoalBulkParseResponse,
  Project,
  ProjectCreate,
  ProjectUpdate,
  SocialContent,
  SocialContentCreate,
  SocialContentUpdate,
  YearSummary,
  TimeEntry,
  TimeEntryStart,
  TimeEntryCreate,
  TimeEntryUpdate,
  TimeSummary,
  TimeSummaryResponse,
} from '../types/index';
import {
  TaskStatus,
  DealStage,
  Quarter,
} from '../types/index';

// In production, API is served from same domain. In dev, use localhost:8000
const API_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? '' : 'http://localhost:8000');

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Task API
export const taskApi = {
  getAll: async (status?: TaskStatus, goalId?: number): Promise<Task[]> => {
    const params: Record<string, any> = {};
    if (status) params.status = status;
    if (goalId !== undefined) params.goal_id = goalId;
    const response = await api.get('/api/tasks', { params });
    return response.data;
  },

  getById: async (id: number): Promise<Task> => {
    const response = await api.get(`/api/tasks/${id}`);
    return response.data;
  },

  create: async (task: TaskCreate): Promise<Task> => {
    const response = await api.post('/api/tasks', task);
    return response.data;
  },

  update: async (id: number, task: TaskUpdate): Promise<Task> => {
    const response = await api.put(`/api/tasks/${id}`, task);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/tasks/${id}`);
  },

  bulkDelete: async (ids: number[]): Promise<{ deleted_count: number; message: string }> => {
    const response = await api.post('/api/tasks/bulk-delete', ids);
    return response.data;
  },

  updateStatus: async (id: number, status: TaskStatus): Promise<Task> => {
    const response = await api.patch(`/api/tasks/${id}/status`, null, {
      params: { status },
    });
    return response.data;
  },

  parse: async (text: string): Promise<Task> => {
    const response = await api.post('/api/task-parser/parse', { text });
    return response.data;
  },

  parseBulk: async (lines: string[]): Promise<Task[]> => {
    const response = await api.post('/api/task-parser/parsebulk', { lines });
    return response.data;
  },
};

// Contact API
export const contactApi = {
  getAll: async (search?: string): Promise<Contact[]> => {
    const params = search ? { search } : {};
    const response = await api.get('/api/crm/contacts', { params });
    return response.data;
  },

  getById: async (id: number): Promise<Contact> => {
    const response = await api.get(`/api/crm/contacts/${id}`);
    return response.data;
  },

  create: async (contact: ContactCreate): Promise<Contact> => {
    const response = await api.post('/api/crm/contacts', contact);
    return response.data;
  },

  update: async (id: number, contact: Partial<ContactCreate>): Promise<Contact> => {
    const response = await api.put(`/api/crm/contacts/${id}`, contact);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/crm/contacts/${id}`);
  },
};

// Deal API
export const dealApi = {
  getAll: async (stage?: DealStage): Promise<Deal[]> => {
    const params = stage ? { stage } : {};
    const response = await api.get('/api/crm/deals', { params });
    return response.data;
  },

  getById: async (id: number): Promise<Deal> => {
    const response = await api.get(`/api/crm/deals/${id}`);
    return response.data;
  },

  create: async (deal: DealCreate): Promise<Deal> => {
    const response = await api.post('/api/crm/deals', deal);
    return response.data;
  },

  update: async (id: number, deal: Partial<DealCreate>): Promise<Deal> => {
    const response = await api.put(`/api/crm/deals/${id}`, deal);
    return response.data;
  },

  updateStage: async (id: number, stage: DealStage): Promise<Deal> => {
    const response = await api.patch(`/api/crm/deals/${id}/stage`, null, {
      params: { stage },
    });
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/crm/deals/${id}`);
  },
  snooze: async (id: number): Promise<Deal> => {
    const response = await api.patch(`/api/crm/deals/${id}/snooze`);
    return response.data;
  },
  unsnooze: async (id: number): Promise<Deal> => {
    const response = await api.patch(`/api/crm/deals/${id}/unsnooze`);
    return response.data;
  },
};

// Interaction API
export const interactionApi = {
  getAll: async (contactId?: number): Promise<Interaction[]> => {
    const params = contactId ? { contact_id: contactId } : {};
    const response = await api.get('/api/crm/interactions', { params });
    return response.data;
  },

  getById: async (id: number): Promise<Interaction> => {
    const response = await api.get(`/api/crm/interactions/${id}`);
    return response.data;
  },

  create: async (interaction: InteractionCreate): Promise<Interaction> => {
    const response = await api.post('/api/crm/interactions', interaction);
    return response.data;
  },

  update: async (id: number, interaction: Partial<InteractionCreate>): Promise<Interaction> => {
    const response = await api.put(`/api/crm/interactions/${id}`, interaction);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/crm/interactions/${id}`);
  },
};

// Export API
export const exportApi = {
  getContext: async (startDate?: string, endDate?: string): Promise<ContextExport> => {
    const params: Record<string, string> = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await api.get('/api/export/context', { params });
    return response.data;
  },
};

// Goal API
export const goalApi = {
  getAll: async (quarter?: Quarter, year?: number): Promise<Goal[]> => {
    const params: Record<string, string | number> = {};
    if (quarter) params.quarter = quarter;
    if (year) params.year = year;
    const response = await api.get('/api/goals', { params });
    return response.data;
  },

  getById: async (id: number): Promise<Goal> => {
    const response = await api.get(`/api/goals/${id}`);
    return response.data;
  },

  create: async (goal: GoalCreate): Promise<Goal> => {
    const response = await api.post('/api/goals', goal);
    return response.data;
  },

  update: async (id: number, goal: GoalUpdate): Promise<Goal> => {
    const response = await api.put(`/api/goals/${id}`, goal);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/goals/${id}`);
  },

  updateProgress: async (id: number, progress: number): Promise<Goal> => {
    const response = await api.patch(`/api/goals/${id}/progress`, null, {
      params: { progress }
    });
    return response.data;
  },

  parse: async (text: string): Promise<Goal> => {
    const response = await api.post('/api/goal-parser/parse', { text });
    return response.data;
  },

  parseBulk: async (text: string): Promise<GoalBulkParseResponse> => {
    const response = await api.post('/api/goal-parser/parse-bulk', { text });
    return response.data;
  },
};

// Project API
export const projectApi = {
  getAll: async (): Promise<Project[]> => {
    const response = await api.get('/api/projects');
    return response.data;
  },

  getById: async (id: number): Promise<Project> => {
    const response = await api.get(`/api/projects/${id}`);
    return response.data;
  },

  create: async (data: ProjectCreate): Promise<Project> => {
    const response = await api.post('/api/projects', data);
    return response.data;
  },

  update: async (id: number, data: ProjectUpdate): Promise<Project> => {
    const response = await api.put(`/api/projects/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/projects/${id}`);
  },

  getTasks: async (projectId: number): Promise<Task[]> => {
    const response = await api.get(`/api/projects/${projectId}/tasks`);
    return response.data;
  },

  createTask: async (projectId: number, data: TaskCreate): Promise<Task> => {
    const response = await api.post(`/api/projects/${projectId}/tasks`, data);
    return response.data;
  },
};

// Social Content API
export const socialContentApi = {
  list: async (params?: {
    start_date?: string;
    end_date?: string;
    status?: string;
    content_type?: string;
  }): Promise<SocialContent[]> => {
    const response = await api.get('/api/social-content', { params });
    return response.data;
  },

  getYearSummary: async (year: number): Promise<YearSummary> => {
    const response = await api.get(`/api/social-content/calendar-summary/${year}`);
    return response.data;
  },

  getMonthContent: async (year: number, month: number): Promise<SocialContent[]> => {
    const response = await api.get(`/api/social-content/by-date/${year}/${month}`);
    return response.data;
  },

  create: async (data: SocialContentCreate): Promise<SocialContent> => {
    const response = await api.post('/api/social-content', data);
    return response.data;
  },

  update: async (id: number, data: SocialContentUpdate): Promise<SocialContent> => {
    const response = await api.put(`/api/social-content/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/social-content/${id}`);
  },
};

export const dashboardApi = {
  getBriefing: async () => {
    const response = await api.get('/api/dashboard/briefing');
    return response.data;
  },

  // Quick actions from briefing
  completeTask: async (taskId: number) => {
    const response = await api.post(`/api/dashboard/actions/task/${taskId}/complete`);
    return response.data;
  },

  rescheduleTask: async (taskId: number, days: number = 1) => {
    const response = await api.post(`/api/dashboard/actions/task/${taskId}/reschedule`, { days });
    return response.data;
  },

  snoozeDeal: async (dealId: number) => {
    const response = await api.post(`/api/dashboard/actions/deal/${dealId}/snooze`);
    return response.data;
  },

  logDealFollowup: async (dealId: number) => {
    const response = await api.post(`/api/dashboard/actions/deal/${dealId}/log-followup`);
    return response.data;
  },
};

// Time Tracking API
export const timeApi = {
  // Timer control
  getCurrent: async (): Promise<TimeEntry | null> => {
    const response = await api.get('/api/time/current');
    return response.data;
  },

  start: async (data: TimeEntryStart): Promise<TimeEntry> => {
    const response = await api.post('/api/time/start', data);
    return response.data;
  },

  stop: async (): Promise<TimeEntry> => {
    const response = await api.post('/api/time/stop');
    return response.data;
  },

  pause: async (): Promise<TimeEntry> => {
    const response = await api.post('/api/time/pause');
    return response.data;
  },

  resume: async (): Promise<TimeEntry> => {
    const response = await api.post('/api/time/resume');
    return response.data;
  },

  // Time entries CRUD
  listEntries: async (params?: {
    start_date?: string;
    end_date?: string;
    task_id?: number;
    project_id?: number;
    deal_id?: number;
    limit?: number;
    offset?: number;
  }): Promise<TimeEntry[]> => {
    const response = await api.get('/api/time/entries', { params });
    return response.data;
  },

  createEntry: async (data: TimeEntryCreate): Promise<TimeEntry> => {
    const response = await api.post('/api/time/entries', data);
    return response.data;
  },

  getEntry: async (id: number): Promise<TimeEntry> => {
    const response = await api.get(`/api/time/entries/${id}`);
    return response.data;
  },

  updateEntry: async (id: number, data: TimeEntryUpdate): Promise<TimeEntry> => {
    const response = await api.put(`/api/time/entries/${id}`, data);
    return response.data;
  },

  deleteEntry: async (id: number): Promise<void> => {
    await api.delete(`/api/time/entries/${id}`);
  },

  // Summaries
  getSummary: async (): Promise<TimeSummaryResponse> => {
    const response = await api.get('/api/time/summary');
    return response.data;
  },

  getDealSummary: async (dealId: number): Promise<TimeSummary> => {
    const response = await api.get(`/api/time/summary/deal/${dealId}`);
    return response.data;
  },

  getProjectSummary: async (projectId: number): Promise<TimeSummary> => {
    const response = await api.get(`/api/time/summary/project/${projectId}`);
    return response.data;
  },

  getTaskSummary: async (taskId: number): Promise<TimeSummary> => {
    const response = await api.get(`/api/time/summary/task/${taskId}`);
    return response.data;
  },
};
