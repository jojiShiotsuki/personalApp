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
  Project,
  ProjectCreate,
  ProjectUpdate,
  SocialContent,
  SocialContentCreate,
  SocialContentUpdate,
  YearSummary,
  OutreachCampaign,
  CampaignWithStats,
  CampaignCreate,
  OutreachProspect,
  ProspectCreate,
  CsvImportRequest,
  CsvImportResponse,
  MarkRepliedRequest,
  MarkRepliedResponse,
  OutreachEmailTemplate,
  EmailTemplateCreate,
  RenderedEmail,
  LeadSearchRequest,
  LeadSearchResponse,
  LeadImportRequest,
  LeadImportResponse,
  DailyOutreachStats,
  OutreachStreak,
  WeeklySummary,
  LogActivityRequest,
  LogActivityResponse,
  OutreachSettings,
  OutreachSettingsUpdate,
  OutreachActivityType,
  LoomAudit,
  LoomAuditCreate,
  LoomAuditUpdate,
  LoomAuditStats,
  LoomAuditListResponse,
  MarkWatchedRequest,
  MarkRespondedRequest,
  PipelineSettings,
  PipelineSettingsUpdate,
  PipelineCalculation,
  DiscoveryCall,
  DiscoveryCallCreate,
  DiscoveryCallUpdate,
  DiscoveryCallStats,
  DiscoveryCallListResponse,
  CallOutcome,
  SearchPlannerCombination,
  SearchPlannerStats,
  ProjectTemplate,
  ProjectTemplateCreate,
  TaskLink,
  TaskNote,
  MultiTouchStep,
  MultiTouchStepCreate,
  CampaignSearchKeyword,
  AuditListResponse,
  BatchAuditResponse,
  BatchProgress,
  ExperimentListResponse,
  AnalyticsOverview,
  IssueTypeStats,
  NicheStats,
  TimingStats,
  InsightRecord,
  AutoresearchSettings,
  TrackingPixelResponse,
  AIConversation,
  AIConversationWithMessages,
  VaultFile,
  VaultSyncStatus,
  JojiAISettings,
  JojiAISettingsUpdate,
  TikTokVideo,
  TikTokImportResult,
  TikTokSummary,
  TikTokPatterns,
  NurtureLead,
  NurtureStats,
  CallProspect,
  CallProspectCreate,
  CallProspectUpdate,
  CallProspectCsvImportRequest,
  CallProspectCsvImportResponse,
} from '../types/index';
import {
  TaskStatus,
  DealStage,
  CallStatus,
} from '../types/index';

// Production API URL - hardcoded for reliability
const API_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? 'https://vertex-api-smg3.onrender.com' : 'http://localhost:8000');

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth: attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth: redirect to login on 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      // Don't redirect for auth endpoints themselves
      if (!url.includes('/api/auth/')) {
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (username: string, password: string): Promise<{ access_token: string; token_type: string }> => {
    const response = await api.post('/api/auth/login', { username, password });
    return response.data;
  },

  setup: async (username: string, password: string): Promise<{ access_token: string; token_type: string }> => {
    const response = await api.post('/api/auth/setup', { username, password });
    return response.data;
  },

  me: async (): Promise<{ id: number; username: string }> => {
    const response = await api.get('/api/auth/me');
    return response.data;
  },

  status: async (): Promise<{ needs_setup: boolean }> => {
    const response = await api.get('/api/auth/status');
    return response.data;
  },
};

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

  bulkUpdate: async (taskIds: number[], updates: Record<string, string | null>): Promise<{ updated_count: number; message: string }> => {
    const response = await api.put('/api/tasks/bulk-update', { task_ids: taskIds, updates });
    return response.data;
  },

  updateStatus: async (id: number, status: TaskStatus): Promise<Task> => {
    const response = await api.patch(`/api/tasks/${id}/status`, null, {
      params: { status },
    });
    return response.data;
  },

  updateAllRecurring: async (id: number, task: TaskUpdate): Promise<{ updated_count: number; message: string }> => {
    const response = await api.put(`/api/tasks/${id}/update-all-recurring`, task);
    return response.data;
  },

  deleteAllRecurring: async (id: number): Promise<{ deleted_count: number; message: string }> => {
    const response = await api.delete(`/api/tasks/${id}/delete-all-recurring`);
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

  addLink: async (taskId: number, data: { url: string; label?: string }): Promise<TaskLink> => {
    const response = await api.post(`/api/tasks/${taskId}/links`, data);
    return response.data;
  },

  removeLink: async (taskId: number, linkId: number): Promise<void> => {
    await api.delete(`/api/tasks/${taskId}/links/${linkId}`);
  },

  addNote: async (taskId: number, data: { content: string }): Promise<TaskNote> => {
    const response = await api.post(`/api/tasks/${taskId}/notes`, data);
    return response.data;
  },

  removeNote: async (taskId: number, noteId: number): Promise<void> => {
    await api.delete(`/api/tasks/${taskId}/notes/${noteId}`);
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

  bulkDelete: async (ids: number[]): Promise<{ deleted_count: number; message: string }> => {
    const response = await api.post('/api/crm/deals/bulk-delete', ids);
    return response.data;
  },

  bulkStageUpdate: async (ids: number[], stage: DealStage): Promise<{ updated_count: number; message: string }> => {
    const response = await api.post('/api/crm/deals/bulk-stage-update', null, {
      params: { deal_ids: ids, stage },
      paramsSerializer: {
        indexes: null, // This serializes arrays as deal_ids=1&deal_ids=2
      },
    });
    return response.data;
  },

  snooze: async (id: number): Promise<Deal> => {
    const response = await api.patch(`/api/crm/deals/${id}/snooze`);
    return response.data;
  },
  unsnooze: async (id: number): Promise<Deal> => {
    const response = await api.patch(`/api/crm/deals/${id}/unsnooze`);
    return response.data;
  },
  convertToProject: async (id: number): Promise<{ project_id: number; project_name: string; message: string }> => {
    const response = await api.post(`/api/crm/deals/${id}/convert-to-project`);
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
  downloadCsv: async (entity: 'contacts' | 'deals' | 'tasks') => {
    const response = await api.get(`/api/export/${entity}.csv`, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entity}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
  downloadProspectsCsv: async (campaignId?: number) => {
    const params = campaignId ? { campaign_id: campaignId } : undefined;
    const response = await api.get('/api/export/prospects.csv', {
      responseType: 'blob',
      params,
    });
    const url = URL.createObjectURL(response.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = campaignId ? `prospects-campaign-${campaignId}.csv` : 'prospects-all.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
  downloadBackup: async () => {
    const response = await api.get('/api/export/backup.json', { responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vertex-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

  applyTemplate: async (projectId: number, templateId: number): Promise<{ tasks_added: number }> => {
    const response = await api.post(`/api/projects/${projectId}/apply-template/${templateId}`);
    return response.data;
  },

  autoSchedule: async (projectId: number): Promise<{ message: string; updated_count: number; total_tasks: number }> => {
    const response = await api.post(`/api/projects/${projectId}/auto-schedule`);
    return response.data;
  },
};

// Project Template API
export const projectTemplateApi = {
  getAll: async (): Promise<ProjectTemplate[]> => {
    const response = await api.get('/api/project-templates/');
    return response.data;
  },

  create: async (data: ProjectTemplateCreate): Promise<ProjectTemplate> => {
    const response = await api.post('/api/project-templates/', data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/project-templates/${id}`);
  },

  createFromProject: async (projectId: number): Promise<ProjectTemplate> => {
    const response = await api.post(`/api/project-templates/from-project/${projectId}`);
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

  bulkCreate: async (items: SocialContentCreate[]): Promise<SocialContent[]> => {
    const response = await api.post('/api/social-content/bulk', items);
    return response.data;
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

  getAiSpend: async (): Promise<{
    total_spend_usd: number;
    breakdown: { audits: number; classification: number; chat: number };
  }> => {
    const response = await api.get('/api/dashboard/ai-spend');
    return response.data;
  },
};

// Outreach API
export const outreachApi = {
  // Niches
  getNiches: async () => {
    const response = await api.get('/api/outreach/niches');
    return response.data;
  },

  // Situations
  getSituations: async () => {
    const response = await api.get('/api/outreach/situations');
    return response.data;
  },

  // Templates
  getTemplates: async (nicheId?: number, situationId?: number) => {
    const params: Record<string, number> = {};
    if (nicheId) params.niche_id = nicheId;
    if (situationId) params.situation_id = situationId;
    const response = await api.get('/api/outreach/templates', { params });
    return response.data;
  },

  createTemplate: async (data: { niche_id: number | null; situation_id: number | null; template_type: string; subject?: string | null; content: string }) => {
    const response = await api.post('/api/outreach/templates', data);
    return response.data;
  },

  updateTemplate: async (id: number, data: { niche_id: number | null; situation_id: number | null; template_type: string; subject?: string | null; content: string }) => {
    const response = await api.put(`/api/outreach/templates/${id}`, data);
    return response.data;
  },

  deleteTemplate: async (id: number) => {
    await api.delete(`/api/outreach/templates/${id}`);
  },

  // Quick Actions
  addToPipeline: async (data: { name: string; niche: string; situation: string }) => {
    const response = await api.post('/api/outreach/add-to-pipeline', data);
    return response.data;
  },
};

// Cold Outreach API
export const coldOutreachApi = {
  // Campaigns
  getCampaigns: async (campaignType?: string): Promise<OutreachCampaign[]> => {
    const params: Record<string, string> = {};
    if (campaignType) params.campaign_type = campaignType;
    const response = await api.get('/api/outreach/campaigns/', { params });
    return response.data;
  },

  getCampaign: async (id: number): Promise<CampaignWithStats> => {
    const response = await api.get(`/api/outreach/campaigns/${id}`);
    return response.data;
  },

  createCampaign: async (data: CampaignCreate): Promise<OutreachCampaign> => {
    const response = await api.post('/api/outreach/campaigns/', data);
    return response.data;
  },

  updateCampaign: async (id: number, data: Partial<CampaignCreate>): Promise<OutreachCampaign> => {
    const response = await api.put(`/api/outreach/campaigns/${id}`, data);
    return response.data;
  },

  deleteCampaign: async (id: number): Promise<void> => {
    const res = await api.delete(`/api/outreach/campaigns/${id}`);
    return res.data;
  },

  // Prospects
  searchProspects: async (query: string): Promise<OutreachProspect[]> => {
    const response = await api.get(`/api/outreach/campaigns/search/prospects`, {
      params: { q: query },
    });
    return response.data;
  },

  getProspects: async (campaignId: number, search?: string): Promise<OutreachProspect[]> => {
    const response = await api.get(`/api/outreach/campaigns/${campaignId}/prospects`, {
      params: search ? { search } : undefined,
    });
    return response.data;
  },

  getTodayQueue: async (campaignId: number): Promise<OutreachProspect[]> => {
    const response = await api.get(`/api/outreach/campaigns/${campaignId}/prospects/today`);
    return response.data;
  },

  createProspect: async (campaignId: number, data: ProspectCreate): Promise<OutreachProspect> => {
    const response = await api.post(`/api/outreach/campaigns/${campaignId}/prospects`, data);
    return response.data;
  },

  importProspects: async (campaignId: number, data: CsvImportRequest): Promise<CsvImportResponse> => {
    const response = await api.post(`/api/outreach/campaigns/${campaignId}/prospects/import`, data);
    return response.data;
  },

  updateProspect: async (prospectId: number, data: Partial<OutreachProspect>): Promise<OutreachProspect> => {
    const response = await api.put(`/api/outreach/campaigns/prospects/${prospectId}`, data);
    return response.data;
  },

  deleteProspect: async (prospectId: number): Promise<void> => {
    await api.delete(`/api/outreach/campaigns/prospects/${prospectId}`);
  },

  markSent: async (prospectId: number): Promise<{ prospect: OutreachProspect; next_action_date?: string; message: string }> => {
    const response = await api.post(`/api/outreach/campaigns/prospects/${prospectId}/mark-sent`);
    return response.data;
  },

  markReplied: async (prospectId: number, data: MarkRepliedRequest): Promise<MarkRepliedResponse> => {
    const response = await api.post(`/api/outreach/campaigns/prospects/${prospectId}/mark-replied`, data);
    return response.data;
  },

  // Email Templates
  getTemplates: async (campaignId: number): Promise<OutreachEmailTemplate[]> => {
    const response = await api.get(`/api/outreach/campaigns/${campaignId}/templates`);
    return response.data;
  },

  createTemplate: async (campaignId: number, data: EmailTemplateCreate): Promise<OutreachEmailTemplate> => {
    const response = await api.post(`/api/outreach/campaigns/${campaignId}/templates`, data);
    return response.data;
  },

  deleteTemplate: async (templateId: number): Promise<void> => {
    await api.delete(`/api/outreach/campaigns/templates/${templateId}`);
  },

  // Render email for prospect
  renderEmail: async (prospectId: number, templateType?: string): Promise<RenderedEmail> => {
    const params: Record<string, string> = {};
    if (templateType) params.template_type = templateType;
    const response = await api.get(`/api/outreach/campaigns/prospects/${prospectId}/render-email`, { params });
    return response.data;
  },

  // LinkedIn-specific actions
  markConnectionSent: async (prospectId: number): Promise<{ prospect: OutreachProspect; next_action_date?: string; message: string }> => {
    const response = await api.post(`/api/outreach/campaigns/prospects/${prospectId}/mark-connection-sent`);
    return response.data;
  },

  markConnected: async (prospectId: number): Promise<{ prospect: OutreachProspect; next_action_date?: string; message: string }> => {
    const response = await api.post(`/api/outreach/campaigns/prospects/${prospectId}/mark-connected`);
    return response.data;
  },

  markMessageSent: async (prospectId: number): Promise<{ prospect: OutreachProspect; next_action_date?: string; message: string }> => {
    const response = await api.post(`/api/outreach/campaigns/prospects/${prospectId}/mark-message-sent`);
    return response.data;
  },

  skipProspect: async (prospectId: number): Promise<{ message: string }> => {
    const response = await api.post(`/api/outreach/campaigns/prospects/${prospectId}/skip`);
    return response.data;
  },

  unskipProspect: async (prospectId: number): Promise<{ message: string }> => {
    const response = await api.post(`/api/outreach/campaigns/prospects/${prospectId}/unskip`);
    return response.data;
  },

  // Multi-touch endpoints
  getCampaignSteps: async (campaignId: number): Promise<MultiTouchStep[]> => {
    const response = await api.get(`/api/outreach/campaigns/${campaignId}/steps`);
    return response.data;
  },

  updateCampaignSteps: async (campaignId: number, steps: MultiTouchStepCreate[]): Promise<MultiTouchStep[]> => {
    const response = await api.put(`/api/outreach/campaigns/${campaignId}/steps`, steps);
    return response.data;
  },

  advanceProspect: async (campaignId: number, prospectId: number): Promise<{ prospect: OutreachProspect; next_action_date?: string; message: string }> => {
    const response = await api.post(`/api/outreach/campaigns/${campaignId}/prospects/${prospectId}/advance`);
    return response.data;
  },

  markEngaged: async (campaignId: number, prospectId: number): Promise<{ prospect: OutreachProspect; next_action_date?: string; message: string }> => {
    const response = await api.post(`/api/outreach/campaigns/${campaignId}/prospects/${prospectId}/mark-engaged`);
    return response.data;
  },

  markMtConnected: async (campaignId: number, prospectId: number): Promise<{ prospect: OutreachProspect; next_action_date?: string; message: string }> => {
    const response = await api.post(`/api/outreach/campaigns/${campaignId}/prospects/${prospectId}/mark-mt-connected`);
    return response.data;
  },

  advanceLinkedinFollowup: async (campaignId: number, prospectId: number): Promise<{ prospect_id: number; message: string; linkedin_followup_count: number; next_action_date: string | null }> => {
    const response = await api.post(`/api/outreach/campaigns/${campaignId}/prospects/${prospectId}/advance-linkedin-followup`);
    return response.data;
  },

  markEmailOpened: async (campaignId: number, prospectId: number): Promise<{ message: string }> => {
    const response = await api.post(`/api/outreach/campaigns/${campaignId}/prospects/${prospectId}/mark-email-opened`);
    return response.data;
  },

  markEmailBounced: async (campaignId: number, prospectId: number): Promise<{ message: string }> => {
    const response = await api.post(`/api/outreach/campaigns/${campaignId}/prospects/${prospectId}/mark-email-bounced`);
    return response.data;
  },

  markLinkedinReplied: async (campaignId: number, prospectId: number): Promise<{ message: string }> => {
    const response = await api.post(`/api/outreach/campaigns/${campaignId}/prospects/${prospectId}/mark-linkedin-replied`);
    return response.data;
  },

  // Search Keywords
  getSearchKeywords: async (campaignId: number): Promise<CampaignSearchKeyword[]> => {
    const response = await api.get(`/api/outreach/campaigns/${campaignId}/search-keywords`);
    return response.data;
  },

  bulkCreateKeywords: async (campaignId: number, data: { category: string; keywords: string[] }): Promise<CampaignSearchKeyword[]> => {
    const response = await api.post(`/api/outreach/campaigns/${campaignId}/search-keywords/bulk`, data);
    return response.data;
  },

  toggleKeywordSearched: async (keywordId: number, leadsFound?: number): Promise<CampaignSearchKeyword> => {
    const params: Record<string, string> = {};
    if (leadsFound !== undefined) params.leads_found = String(leadsFound);
    const response = await api.patch(`/api/outreach/campaigns/search-keywords/${keywordId}/toggle`, null, { params });
    return response.data;
  },

  updateKeyword: async (keywordId: number, data: { is_searched?: boolean; leads_found?: number }): Promise<CampaignSearchKeyword> => {
    const response = await api.patch(`/api/outreach/campaigns/search-keywords/${keywordId}`, data);
    return response.data;
  },

  deleteKeyword: async (keywordId: number): Promise<void> => {
    await api.delete(`/api/outreach/campaigns/search-keywords/${keywordId}`);
  },

  deleteKeywordCategory: async (campaignId: number, category: string): Promise<void> => {
    await api.delete(`/api/outreach/campaigns/${campaignId}/search-keywords/category/${encodeURIComponent(category)}`);
  },
};

// Lead Discovery API
export interface StoredLead {
  id: number;
  agency_name: string;
  contact_name: string | null;
  email: string | null;
  website: string | null;
  niche: string | null;
  location: string | null;
  created_at: string | null;
  is_valid_email: boolean;
  is_duplicate: boolean;
  confidence: 'high' | 'medium' | 'low' | null;
  confidence_signals: Record<string, unknown> | null;
  linkedin_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  email_source: 'scraped' | 'ai_found' | 'manual' | null;
  website_issues: string[];
  last_enriched_at: string | null;
  in_campaign: boolean;
  is_disqualified: boolean;
  search_query: string | null;
}

export interface StoredLeadsResponse {
  total: number;
  leads: StoredLead[];
}

export const leadDiscoveryApi = {
  search: async (data: LeadSearchRequest): Promise<LeadSearchResponse> => {
    const response = await api.post('/api/lead-discovery/search', data);
    return response.data;
  },

  importLeads: async (data: LeadImportRequest): Promise<LeadImportResponse> => {
    const response = await api.post('/api/lead-discovery/import', data);
    return response.data;
  },

  getStoredLeads: async (params?: { skip?: number; limit?: number; niche?: string; location?: string }): Promise<StoredLeadsResponse> => {
    const response = await api.get('/api/lead-discovery/stored', { params });
    return response.data;
  },

  getStats: async (): Promise<{ total_leads: number; with_email: number; without_email: number; high_confidence: number; medium_confidence: number }> => {
    const response = await api.get('/api/lead-discovery/stored/stats');
    return response.data;
  },

  reVerifyLead: async (leadId: number): Promise<{
    id: number;
    email: string | null;
    linkedin_url: string | null;
    facebook_url: string | null;
    instagram_url: string | null;
    confidence: string;
    confidence_signals: Record<string, unknown>;
    last_enriched_at: string;
  }> => {
    const response = await api.post(`/api/lead-discovery/stored/${leadId}/re-verify`);
    return response.data;
  },

  convertToContact: async (leadId: number): Promise<{ message: string; contact: { id: number; name: string; email: string; company: string; status: string } }> => {
    const response = await api.post(`/api/lead-discovery/convert-to-contact/${leadId}`);
    return response.data;
  },

  deleteStoredLead: async (leadId: number): Promise<void> => {
    await api.delete(`/api/lead-discovery/stored/${leadId}`);
  },

  bulkDeleteStoredLeads: async (leadIds: number[]): Promise<{ message: string; deleted_count: number }> => {
    const response = await api.post('/api/lead-discovery/stored/bulk-delete', leadIds);
    return response.data;
  },

  bulkImportToCampaign: async (data: { lead_ids: number[]; campaign_id: number }): Promise<{
    imported_count: number;
    skipped_count: number;
    skipped_reasons: string[];
  }> => {
    const response = await api.post('/api/lead-discovery/stored/bulk-import-to-campaign', data);
    return response.data;
  },

  bulkEnrich: async (leadIds?: number[]): Promise<{
    enriched: number;
    emails_found: number;
    skipped: number;
    results: { id: number; agency_name: string; email: string | null; email_found: boolean; updated: boolean }[];
  }> => {
    const response = await api.post('/api/lead-discovery/stored/bulk-enrich', leadIds || null);
    return response.data;
  },

  updateWebsiteIssues: async (leadId: number, issues: string[]): Promise<{ id: number; website_issues: string[] }> => {
    const response = await api.patch(`/api/lead-discovery/stored/${leadId}/website-issues`, issues);
    return response.data;
  },

  toggleDisqualify: async (leadId: number): Promise<{ id: number; is_disqualified: boolean }> => {
    const response = await api.patch(`/api/lead-discovery/stored/${leadId}/disqualify`);
    return response.data;
  },

  updateStoredLead: async (leadId: number, data: { agency_name?: string; contact_name?: string; email?: string; website?: string; niche?: string }): Promise<StoredLead> => {
    const response = await api.put(`/api/lead-discovery/stored/${leadId}`, data);
    return response.data;
  },

  createManualLead: async (data: { agency_name: string; contact_name?: string; email?: string; website?: string; niche?: string; location?: string }): Promise<StoredLead> => {
    const response = await api.post('/api/lead-discovery/stored/manual', data);
    return response.data;
  },
};

// Search Planner API
export const searchPlannerApi = {
  getCountries: async (): Promise<string[]> => {
    const response = await api.get('/api/lead-discovery/planner/countries');
    return response.data;
  },

  getNiches: async (country?: string): Promise<string[]> => {
    const response = await api.get('/api/lead-discovery/planner/niches', { params: country ? { country } : {} });
    return response.data;
  },

  generateCombinations: async (data: { country: string; niche: string }): Promise<{ created: number; already_existed: number; total: number }> => {
    const response = await api.post('/api/lead-discovery/planner/generate', data);
    return response.data;
  },

  getCombinations: async (params?: { country?: string; niche?: string; is_searched?: boolean }): Promise<SearchPlannerCombination[]> => {
    const response = await api.get('/api/lead-discovery/planner/combinations', { params });
    return response.data;
  },

  getStats: async (params?: { country?: string; niche?: string }): Promise<SearchPlannerStats> => {
    const response = await api.get('/api/lead-discovery/planner/stats', { params });
    return response.data;
  },

  markSearched: async (combinationId: number, leadsFound: number): Promise<SearchPlannerCombination> => {
    const response = await api.patch(`/api/lead-discovery/planner/combinations/${combinationId}/mark-searched`, { leads_found: leadsFound });
    return response.data;
  },

  resetCombination: async (combinationId: number): Promise<SearchPlannerCombination> => {
    const response = await api.patch(`/api/lead-discovery/planner/combinations/${combinationId}/reset`);
    return response.data;
  },

  markLinkedinSearched: async (combinationId: number, leadsFound: number): Promise<SearchPlannerCombination> => {
    const response = await api.patch(`/api/lead-discovery/planner/combinations/${combinationId}/mark-linkedin-searched`, { leads_found: leadsFound });
    return response.data;
  },

  resetLinkedinCombination: async (combinationId: number): Promise<SearchPlannerCombination> => {
    const response = await api.patch(`/api/lead-discovery/planner/combinations/${combinationId}/reset-linkedin`);
    return response.data;
  },

};

// Daily Outreach Tracking API
export const dailyOutreachApi = {
  getTodayStats: async (): Promise<DailyOutreachStats> => {
    const response = await api.get('/api/daily-outreach/today');
    return response.data;
  },

  getStreak: async (): Promise<OutreachStreak> => {
    const response = await api.get('/api/daily-outreach/streak');
    return response.data;
  },

  getWeeklySummary: async (): Promise<WeeklySummary> => {
    const response = await api.get('/api/daily-outreach/weekly');
    return response.data;
  },

  logActivity: async (
    activityType: OutreachActivityType,
    data?: LogActivityRequest
  ): Promise<LogActivityResponse> => {
    const response = await api.post(`/api/daily-outreach/log/${activityType}`, data || {});
    return response.data;
  },

  deductActivity: async (
    activityType: OutreachActivityType
  ): Promise<LogActivityResponse> => {
    const response = await api.delete(`/api/daily-outreach/deduct/${activityType}`);
    return response.data;
  },

  getSettings: async (): Promise<OutreachSettings> => {
    const response = await api.get('/api/daily-outreach/settings');
    return response.data;
  },

  updateSettings: async (settings: OutreachSettingsUpdate): Promise<OutreachSettings> => {
    const response = await api.put('/api/daily-outreach/settings', settings);
    return response.data;
  },
};

// Loom Audit API
export const loomAuditApi = {
  getAll: async (params?: {
    contact_id?: number;
    pending_only?: boolean;
    needs_follow_up?: boolean;
    limit?: number;
  }): Promise<LoomAuditListResponse> => {
    const response = await api.get('/api/loom-audits', { params });
    return response.data;
  },

  getStats: async (): Promise<LoomAuditStats> => {
    const response = await api.get('/api/loom-audits/stats');
    return response.data;
  },

  getPending: async (limit?: number): Promise<LoomAudit[]> => {
    const response = await api.get('/api/loom-audits/pending', {
      params: { limit },
    });
    return response.data;
  },

  getNeedsFollowUp: async (limit?: number): Promise<LoomAudit[]> => {
    const response = await api.get('/api/loom-audits/needs-follow-up', {
      params: { limit },
    });
    return response.data;
  },

  getById: async (id: number): Promise<LoomAudit> => {
    const response = await api.get(`/api/loom-audits/${id}`);
    return response.data;
  },

  getByContact: async (contactId: number, limit?: number): Promise<LoomAudit[]> => {
    const response = await api.get(`/api/loom-audits/contact/${contactId}`, {
      params: { limit },
    });
    return response.data;
  },

  create: async (data: LoomAuditCreate): Promise<LoomAudit> => {
    const response = await api.post('/api/loom-audits', data);
    return response.data;
  },

  update: async (id: number, data: LoomAuditUpdate): Promise<LoomAudit> => {
    const response = await api.put(`/api/loom-audits/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/loom-audits/${id}`);
  },

  markWatched: async (id: number, data?: MarkWatchedRequest): Promise<LoomAudit> => {
    const response = await api.post(`/api/loom-audits/${id}/watched`, data || {});
    return response.data;
  },

  markResponded: async (id: number, data: MarkRespondedRequest): Promise<LoomAudit> => {
    const response = await api.post(`/api/loom-audits/${id}/responded`, data);
    return response.data;
  },

  markFollowUpSent: async (id: number, notes?: string): Promise<LoomAudit> => {
    const response = await api.post(`/api/loom-audits/${id}/follow-up-sent`, { notes });
    return response.data;
  },
};

// Pipeline Calculator API
export const pipelineApi = {
  getSettings: async (): Promise<PipelineSettings> => {
    const response = await api.get('/api/pipeline/settings');
    return response.data;
  },

  updateSettings: async (data: PipelineSettingsUpdate): Promise<PipelineSettings> => {
    const response = await api.put('/api/pipeline/settings', data);
    return response.data;
  },

  calculate: async (): Promise<PipelineCalculation> => {
    const response = await api.get('/api/pipeline/calculate');
    return response.data;
  },

  calculateCustom: async (data: PipelineSettingsUpdate): Promise<PipelineCalculation> => {
    const response = await api.post('/api/pipeline/calculate', data);
    return response.data;
  },
};

// Discovery Call API
export const discoveryCallApi = {
  getAll: async (params?: {
    contact_id?: number;
    deal_id?: number;
    outcome?: CallOutcome;
    limit?: number;
  }): Promise<DiscoveryCallListResponse> => {
    const response = await api.get('/api/discovery-calls', { params });
    return response.data;
  },

  getStats: async (): Promise<DiscoveryCallStats> => {
    const response = await api.get('/api/discovery-calls/stats');
    return response.data;
  },

  getUpcomingFollowUps: async (days?: number): Promise<DiscoveryCall[]> => {
    const response = await api.get('/api/discovery-calls/upcoming-follow-ups', {
      params: { days },
    });
    return response.data;
  },

  getById: async (id: number): Promise<DiscoveryCall> => {
    const response = await api.get(`/api/discovery-calls/${id}`);
    return response.data;
  },

  getByContact: async (contactId: number, limit?: number): Promise<DiscoveryCall[]> => {
    const response = await api.get(`/api/discovery-calls/contact/${contactId}`, {
      params: { limit },
    });
    return response.data;
  },

  getByDeal: async (dealId: number, limit?: number): Promise<DiscoveryCall[]> => {
    const response = await api.get(`/api/discovery-calls/deal/${dealId}`, {
      params: { limit },
    });
    return response.data;
  },

  create: async (data: DiscoveryCallCreate): Promise<DiscoveryCall> => {
    const response = await api.post('/api/discovery-calls', data);
    return response.data;
  },

  update: async (id: number, data: DiscoveryCallUpdate): Promise<DiscoveryCall> => {
    const response = await api.put(`/api/discovery-calls/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/discovery-calls/${id}`);
  },
};

// Reports API
export const reportsApi = {
  getOverview: async (startDate: string, endDate: string) => {
    const res = await api.get('/api/reports/overview', { params: { start_date: startDate, end_date: endDate } });
    return res.data;
  },

  getRevenue: async (startDate: string, endDate: string) => {
    const res = await api.get('/api/reports/revenue', { params: { start_date: startDate, end_date: endDate } });
    return res.data;
  },

  getPipeline: async (startDate: string, endDate: string) => {
    const res = await api.get('/api/reports/pipeline', { params: { start_date: startDate, end_date: endDate } });
    return res.data;
  },
};

// Autoresearch API
export const autoresearchApi = {
  auditProspect: async (prospectId: number) => {
    const { data } = await api.post(`/api/autoresearch/audit/${prospectId}`);
    return data;
  },
  batchAudit: async (campaignId: number, limit: number = 50): Promise<BatchAuditResponse> => {
    const { data } = await api.post(`/api/autoresearch/audit/batch/${campaignId}?limit=${limit}`);
    return data;
  },
  getBatchProgress: async (batchId: string): Promise<BatchProgress> => {
    const { data } = await api.get(`/api/autoresearch/audit/batch/${batchId}/progress`);
    return data;
  },
  cancelBatch: async (batchId: string) => {
    const { data } = await api.post(`/api/autoresearch/audit/batch/${batchId}/cancel`);
    return data;
  },
  listAudits: async (params?: { campaign_id?: number; status?: string; confidence?: string; page?: number; page_size?: number }): Promise<AuditListResponse> => {
    const { data } = await api.get('/api/autoresearch/audits', { params });
    return data;
  },
  approveAudit: async (auditId: number, body?: { edited_subject?: string; edited_body?: string; subject_variant_used?: string }) => {
    const { data } = await api.put(`/api/autoresearch/audits/${auditId}/approve`, body || {});
    return data;
  },
  rejectAudit: async (auditId: number, reason: string, category?: string) => {
    const { data } = await api.put(`/api/autoresearch/audits/${auditId}/reject`, { rejection_reason: reason, rejection_category: category });
    return data;
  },
  submitFeedback: async (auditId: number, feedback: string) => {
    const { data } = await api.put(`/api/autoresearch/audits/${auditId}/feedback`, { feedback });
    return data;
  },
  deleteAudit: async (auditId: number) => {
    const { data } = await api.delete(`/api/autoresearch/audits/${auditId}`);
    return data;
  },
  regenerateAudit: async (auditId: number, instruction: string) => {
    const { data } = await api.post(`/api/autoresearch/audits/${auditId}/regenerate`, { instruction });
    return data;
  },
  trackEmail: async (prospectId: number, stepNumber: number, subject: string, body: string, wasEdited: boolean, loomScript?: string, ctaUsed?: string, angleUsed?: string) => {
    const { data } = await api.post('/api/autoresearch/track-email', {
      prospect_id: prospectId,
      step_number: stepNumber,
      subject,
      body,
      was_edited: wasEdited,
      loom_script: loomScript || undefined,
      cta_used: ctaUsed || undefined,
      angle_used: angleUsed || undefined,
    });
    return data;
  },
  listExperiments: async (params?: { campaign_id?: number; prospect_id?: number; niche?: string; issue_type?: string; status?: string; page?: number; page_size?: number }): Promise<ExperimentListResponse> => {
    const { data } = await api.get('/api/autoresearch/experiments', { params });
    return data;
  },
  getAnalyticsOverview: async (): Promise<AnalyticsOverview> => {
    const { data } = await api.get('/api/autoresearch/analytics/overview');
    return data;
  },
  getAnalyticsByIssueType: async (): Promise<{ stats: IssueTypeStats[] }> => {
    const { data } = await api.get('/api/autoresearch/analytics/by-issue-type');
    return data;
  },
  getAnalyticsByNiche: async (): Promise<{ stats: NicheStats[] }> => {
    const { data } = await api.get('/api/autoresearch/analytics/by-niche');
    return data;
  },
  getAnalyticsByTiming: async (): Promise<{ stats: TimingStats[] }> => {
    const { data } = await api.get('/api/autoresearch/analytics/by-timing');
    return data;
  },
  getInsights: async (): Promise<InsightRecord[]> => {
    const { data } = await api.get('/api/autoresearch/insights');
    return data;
  },
  refreshInsights: async () => {
    const { data } = await api.post('/api/autoresearch/insights/refresh');
    return data;
  },
  getGmailAuthUrl: async (): Promise<{ auth_url: string }> => {
    const { data } = await api.get('/api/autoresearch/gmail/auth-url');
    return data;
  },
  getGmailStatus: async () => {
    const { data } = await api.get('/api/autoresearch/gmail/status');
    return data;
  },
  disconnectGmail: async () => {
    const { data } = await api.post('/api/autoresearch/gmail/disconnect');
    return data;
  },
  pollGmail: async () => {
    const { data } = await api.post('/api/autoresearch/gmail/poll');
    return data;
  },
  getSettings: async (): Promise<AutoresearchSettings> => {
    const { data } = await api.get('/api/autoresearch/settings');
    return data;
  },
  updateSettings: async (updates: Partial<AutoresearchSettings>) => {
    const { data } = await api.put('/api/autoresearch/settings', updates);
    return data;
  },
  generateTrackingPixel: async (prospectId: number): Promise<TrackingPixelResponse> => {
    const { data } = await api.post(`/api/autoresearch/track/generate/${prospectId}`);
    return data;
  },
  updateLoomStatus: async (experimentId: number, payload: { loom_sent?: boolean; loom_url?: string; loom_watched?: boolean }) => {
    const { data } = await api.put(`/api/autoresearch/experiments/${experimentId}/loom`, payload);
    return data;
  },
  updateLinkedInReply: async (experimentId: number, payload: { replied?: boolean; sentiment?: string; full_reply_text?: string }) => {
    const { data } = await api.put(`/api/autoresearch/experiments/${experimentId}/linkedin-reply`, payload);
    return data;
  },
  sendEmail: async (prospectId: number, subject: string, body: string) => {
    const { data } = await api.post(`/api/autoresearch/send-email/${prospectId}`, { subject, body });
    return data;
  },
  generateFollowup: async (prospectId: number, customInstruction?: string): Promise<{ subject: string; body: string; loom_script?: string; word_count: number; step_number: number; follow_up_number: number; model: string; cost_usd: number; cta_used?: string; angle_used?: string }> => {
    const { data } = await api.post(`/api/autoresearch/generate-followup/${prospectId}`, {
      custom_instruction: customInstruction || undefined,
    });
    return data;
  },

  bulkGenerateFollowups: async (prospectIds: number[]): Promise<{
    results: Array<{
      prospect_id: number;
      status: string;
      subject?: string;
      word_count?: number;
      angle_used?: string;
      cost_usd?: number;
      error?: string;
    }>;
    total: number;
    succeeded: number;
    failed: number;
    total_cost_usd: number;
  }> => {
    // Start background job
    const { data: startData } = await api.post('/api/autoresearch/bulk-generate-followup', {
      prospect_ids: prospectIds,
    });
    const jobId = startData.job_id;

    // Poll for completion
    while (true) {
      await new Promise((r) => setTimeout(r, 2000)); // poll every 2s
      const { data: job } = await api.get(`/api/autoresearch/bulk-generate-followup/${jobId}`);
      if (job.status === 'done' || job.status === 'error') {
        return {
          results: job.results || [],
          total: job.total,
          succeeded: job.succeeded,
          failed: job.failed,
          total_cost_usd: job.total_cost_usd,
        };
      }
    }
  },
};

// ============ Joji AI API ============

export const jojiAiApi = {
  // Chat -- returns raw Response for SSE streaming
  chat: async (message: string, conversationId?: number, model?: string): Promise<Response> => {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_URL}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        message,
        conversation_id: conversationId,
        model,
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Chat request failed' }));
      throw new Error(error.detail || 'Chat request failed');
    }
    return response;
  },

  getConversations: async (limit = 20, offset = 0): Promise<AIConversation[]> => {
    const { data } = await api.get('/api/ai/conversations', { params: { limit, offset } });
    return data;
  },

  getConversation: async (id: number, limit = 50, offset = 0): Promise<AIConversationWithMessages> => {
    const { data } = await api.get(`/api/ai/conversations/${id}`, { params: { limit, offset } });
    return data;
  },

  deleteConversation: async (id: number): Promise<void> => {
    await api.delete(`/api/ai/conversations/${id}`);
  },

  renameConversation: async (id: number, title: string): Promise<AIConversation> => {
    const { data } = await api.post(`/api/ai/conversations/${id}/title`, { title });
    return data;
  },

  syncVault: async (): Promise<{ status: string }> => {
    const { data } = await api.post('/api/ai/vault/sync');
    return data;
  },

  generateVaultTemplates: async (): Promise<{ status: string; files_written: number }> => {
    const { data } = await api.post('/api/ai/vault/generate-templates');
    return data;
  },

  gmailVaultBackfill: async (): Promise<{ status: string; message?: string; threads_indexed?: number; threads_skipped?: number }> => {
    const { data } = await api.post('/api/ai/vault/gmail-backfill');
    return data;
  },

  gmailVaultSyncNow: async (): Promise<{ status: string; threads_indexed?: number; threads_skipped?: number; reason?: string; message?: string }> => {
    const { data } = await api.post('/api/ai/vault/gmail-sync-now', {}, { timeout: 120000 });
    return data;
  },

  getVaultStatus: async (): Promise<VaultSyncStatus> => {
    const { data } = await api.get('/api/ai/vault/status');
    return data;
  },

  getVaultFiles: async (): Promise<VaultFile[]> => {
    const { data } = await api.get('/api/ai/vault/files');
    return data;
  },

  uploadToLibrary: async (file?: File, text?: string, title?: string): Promise<{
    status: string;
    file_path: string;
    title: string;
    preview: string;
  }> => {
    const formData = new FormData();
    if (file) formData.append('file', file);
    if (text) formData.append('text', text);
    if (title) formData.append('title', title);
    // Delete Content-Type so axios auto-sets multipart/form-data with boundary
    const { data } = await api.post('/api/ai/library/upload', formData, {
      timeout: 60000,
      headers: { 'Content-Type': undefined as any },
    });
    return data;
  },

  getObsidianStatus: async (): Promise<{ connected: boolean; url: string; has_api_key: boolean }> => {
    const { data } = await api.get('/api/ai/vault/obsidian-status');
    return data;
  },

  getSettings: async (): Promise<JojiAISettings> => {
    const { data } = await api.get('/api/ai/settings');
    return data;
  },

  updateSettings: async (settings: JojiAISettingsUpdate): Promise<JojiAISettings> => {
    const { data } = await api.put('/api/ai/settings', settings);
    return data;
  },
};

// ===== TikTok Analytics API =====

export const tiktokApi = {
  importData: async (file: File): Promise<TikTokImportResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/api/tiktok/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  listVideos: async (params?: {
    search?: string;
    hashtag?: string;
    date_from?: string;
    date_to?: string;
    sort_by?: string;
    sort_order?: string;
    limit?: number;
    offset?: number;
  }): Promise<TikTokVideo[]> => {
    const response = await api.get('/api/tiktok/videos', { params });
    return response.data;
  },

  getVideo: async (id: number): Promise<TikTokVideo> => {
    const response = await api.get(`/api/tiktok/videos/${id}`);
    return response.data;
  },

  deleteVideo: async (id: number): Promise<void> => {
    await api.delete(`/api/tiktok/videos/${id}`);
  },

  bulkDelete: async (): Promise<void> => {
    await api.delete('/api/tiktok/videos', { params: { confirm: true } });
  },

  getSummary: async (): Promise<TikTokSummary> => {
    const response = await api.get('/api/tiktok/summary');
    return response.data;
  },

  getPatterns: async (): Promise<TikTokPatterns> => {
    const response = await api.get('/api/tiktok/patterns');
    return response.data;
  },

  getTopPerformers: async (sortBy = 'views', limit = 10): Promise<TikTokVideo[]> => {
    const response = await api.get('/api/tiktok/top-performers', {
      params: { sort_by: sortBy, limit },
    });
    return response.data;
  },
};

export const nurtureApi = {
  getStats: async (): Promise<NurtureStats> => {
    const res = await api.get('/api/nurture/stats');
    return res.data;
  },

  getLeads: async (params?: {
    status?: string;
    current_step?: number;
    needs_followup?: boolean;
    search?: string;
    campaign_id?: number;
  }): Promise<NurtureLead[]> => {
    const res = await api.get('/api/nurture/leads', { params });
    return res.data;
  },

  getLead: async (id: number): Promise<NurtureLead> => {
    const res = await api.get(`/api/nurture/leads/${id}`);
    return res.data;
  },

  createManual: async (data: {
    company_name: string;
    contact_name?: string;
    email?: string;
    website?: string;
    linkedin_url?: string;
    niche?: string;
    source_channel?: string;
    notes?: string;
  }): Promise<NurtureLead> => {
    const res = await api.post('/api/nurture/leads', data);
    return res.data;
  },

  createFromProspect: async (prospectId: number, data: {
    source_channel?: string;
    notes?: string;
  }): Promise<NurtureLead> => {
    const res = await api.post(`/api/nurture/from-prospect/${prospectId}`, data);
    return res.data;
  },

  updateLead: async (id: number, data: {
    notes?: string;
    status?: string;
    current_step?: number;
    source_channel?: string;
  }): Promise<NurtureLead> => {
    const res = await api.put(`/api/nurture/leads/${id}`, data);
    return res.data;
  },

  completeStep: async (id: number, data?: { notes?: string }): Promise<NurtureLead> => {
    const res = await api.post(`/api/nurture/leads/${id}/complete-step`, data || {});
    return res.data;
  },

  logFollowup: async (id: number, data?: { notes?: string }): Promise<NurtureLead> => {
    const res = await api.post(`/api/nurture/leads/${id}/log-followup`, data || {});
    return res.data;
  },

  convert: async (id: number, data?: {
    deal_title?: string;
    deal_value?: number;
    deal_stage?: string;
  }): Promise<NurtureLead> => {
    const res = await api.post(`/api/nurture/leads/${id}/convert`, data || {});
    return res.data;
  },

  markLost: async (id: number, data?: { notes?: string }): Promise<NurtureLead> => {
    const res = await api.post(`/api/nurture/leads/${id}/mark-lost`, data || {});
    return res.data;
  },
};

// Cold Calls Pipeline API
export const coldCallsApi = {
  list: async (options?: { status?: CallStatus; campaign_id?: number }): Promise<CallProspect[]> => {
    const params: Record<string, string | number> = {};
    if (options?.status) params.status = options.status;
    if (options?.campaign_id !== undefined) params.campaign_id = options.campaign_id;
    const response = await api.get('/api/cold-calls', {
      params: Object.keys(params).length ? params : undefined,
    });
    return response.data;
  },

  create: async (data: CallProspectCreate): Promise<CallProspect> => {
    const response = await api.post('/api/cold-calls', data);
    return response.data;
  },

  update: async (id: number, data: CallProspectUpdate): Promise<CallProspect> => {
    const response = await api.put(`/api/cold-calls/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/cold-calls/${id}`);
  },

  import: async (data: CallProspectCsvImportRequest): Promise<CallProspectCsvImportResponse> => {
    const response = await api.post('/api/cold-calls/import', data);
    return response.data;
  },
};

