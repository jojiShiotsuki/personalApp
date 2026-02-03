// Task types
export enum TaskPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent",
}

export enum TaskStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  DELAYED = "delayed",
}

export enum RecurrenceType {
  DAILY = "daily",
  WEEKLY = "weekly",
  MONTHLY = "monthly",
  YEARLY = "yearly",
}

export enum ProjectStatus {
  TODO = "todo",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
}

export type Project = {
  id: number;
  name: string;
  description?: string;
  status: ProjectStatus;
  progress: number;
  created_at: string;
  updated_at: string;
  task_count?: number;
  completed_task_count?: number;
  hourly_rate?: number;  // For time tracking billing
}

export type ProjectCreate = {
  name: string;
  description?: string;
  hourly_rate?: number;  // For time tracking billing
}

export type ProjectUpdate = {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  hourly_rate?: number;  // For time tracking billing
}

export type Task = {
  id: number;
  title: string;
  description?: string;
  due_date?: string;
  due_time?: string;
  priority: TaskPriority;
  status: TaskStatus;
  goal_id?: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  project_id?: number;

  // Recurrence fields
  is_recurring: boolean;
  recurrence_type?: RecurrenceType;
  recurrence_interval?: number;
  recurrence_days?: string[];
  recurrence_end_date?: string;
  recurrence_count?: number;
  occurrences_created: number;
  parent_task_id?: number;
}

export type TaskCreate = {
  title: string;
  description?: string;
  due_date?: string;
  due_time?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  project_id?: number;
  goal_id?: number;

  // Recurrence fields
  is_recurring?: boolean;
  recurrence_type?: RecurrenceType;
  recurrence_interval?: number;
  recurrence_days?: string[];
  recurrence_end_date?: string;
  recurrence_count?: number;
}

export type TaskUpdate = {
  title?: string;
  description?: string;
  due_date?: string;
  due_time?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  project_id?: number;
  goal_id?: number;

  // Recurrence fields
  is_recurring?: boolean;
  recurrence_type?: RecurrenceType;
  recurrence_interval?: number;
  recurrence_days?: string[];
  recurrence_end_date?: string;
  recurrence_count?: number;
}

// CRM types
export enum ContactStatus {
  LEAD = "lead",
  PROSPECT = "prospect",
  CLIENT = "client",
  INACTIVE = "inactive",
}

export enum DealStage {
  LEAD = "lead",
  PROSPECT = "prospect",
  PROPOSAL = "proposal",
  NEGOTIATION = "negotiation",
  CLOSED_WON = "closed_won",
  CLOSED_LOST = "closed_lost",
}

export enum InteractionType {
  MEETING = "meeting",
  EMAIL = "email",
  CALL = "call",
  NOTE = "note",
  SOCIAL_MEDIA = "social_media",
  FOLLOW_UP_EMAIL = "follow_up_email",
}

export enum BillingFrequency {
  MONTHLY = "monthly",
  QUARTERLY = "quarterly",
  SEMI_ANNUAL = "semi_annual",
  ANNUAL = "annual",
}

export enum ServiceStatus {
  ACTIVE = "active",
  PAUSED = "paused",
  CANCELLED = "cancelled",
  PENDING = "pending",
}

export type Contact = {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  status: ContactStatus;
  source?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type ContactCreate = {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  status?: ContactStatus;
  source?: string;
  notes?: string;
}

export type Deal = {
  id: number;
  contact_id: number;
  title: string;
  description?: string;
  value?: number;
  stage: DealStage;
  probability: number;
  expected_close_date?: string;
  actual_close_date?: string;
  next_followup_date?: string;
  hourly_rate?: number;  // For time tracking billing
  // Subscription fields
  is_recurring: boolean;
  billing_frequency?: BillingFrequency;
  recurring_amount?: number;
  next_billing_date?: string;
  service_status?: ServiceStatus;
  service_start_date?: string;
  created_at: string;
  updated_at: string;
  followup_count: number;
}

export type DealCreate = {
  contact_id: number;
  title: string;
  description?: string;
  value?: number;
  stage?: DealStage;
  probability?: number;
  expected_close_date?: string;
  hourly_rate?: number;  // For time tracking billing
  // Subscription fields
  is_recurring?: boolean;
  billing_frequency?: BillingFrequency;
  recurring_amount?: number;
  next_billing_date?: string;
  service_status?: ServiceStatus;
  service_start_date?: string;
}

export type Interaction = {
  id: number;
  contact_id: number;
  type: InteractionType;
  subject?: string;
  notes?: string;
  interaction_date: string;
  created_at: string;
}

export type InteractionCreate = {
  contact_id: number;
  type: InteractionType;
  subject?: string;
  notes?: string;
  interaction_date: string;
}

// Goal types
export enum Quarter {
  Q1 = "Q1",
  Q2 = "Q2",
  Q3 = "Q3",
  Q4 = "Q4",
}

export enum Month {
  JANUARY = "January",
  FEBRUARY = "February",
  MARCH = "March",
  APRIL = "April",
  MAY = "May",
  JUNE = "June",
  JULY = "July",
  AUGUST = "August",
  SEPTEMBER = "September",
  OCTOBER = "October",
  NOVEMBER = "November",
  DECEMBER = "December",
}

export enum GoalPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
}

export type KeyResult = {
  id: string;
  title: string;
  completed: boolean;
}

export type Goal = {
  id: number;
  title: string;
  description?: string;
  quarter: Quarter;
  month: Month;
  year: number;
  target_date?: string;
  progress: number;
  priority: GoalPriority;
  key_results?: KeyResult[];
  created_at: string;
  updated_at?: string;
}

export type GoalCreate = {
  title: string;
  description?: string;
  quarter: Quarter;
  month: Month;
  year: number;
  target_date?: string;
  progress?: number;
  priority?: GoalPriority;
  key_results?: KeyResult[];
}

export type GoalUpdate = {
  title?: string;
  description?: string;
  quarter?: Quarter;
  month?: Month;
  year?: number;
  target_date?: string;
  progress?: number;
  priority?: GoalPriority;
  key_results?: KeyResult[];
}

export type GoalParseError = {
  line_number: number;
  text: string;
  error: string;
}

export type GoalBulkParseResponse = {
  goals: Goal[];
  errors: GoalParseError[];
  total_lines: number;
  success_count: number;
  error_count: number;
}

// Export types
export type ContextExport = {
  markdown: string;
  start_date: string;
  end_date: string;
};

// Social Content Types
export type ContentType =
  | 'reel'
  | 'carousel'
  | 'single_post'
  | 'story'
  | 'tiktok'
  | 'youtube_short'
  | 'youtube_video'
  | 'blog_post';

export type ContentStatus =
  | 'not_started'
  | 'scripted'
  | 'filmed'
  | 'editing'
  | 'scheduled'
  | 'posted';

export type EditingStyle =
  | 'fast_paced'
  | 'cinematic'
  | 'educational'
  | 'behind_scenes'
  | 'trending'
  | 'tutorial'
  | 'interview'
  | 'custom';

export type ReelType =
  | 'educational'
  | 'before_after'
  | 'bts'
  | 'social_proof'
  | 'mini_audit'
  | 'seo_education'
  | 'client_results'
  | 'direct_cta'
  | 'full_redesign';

export type RepurposeFormat = 'reel' | 'carousel' | 'long_caption';

export interface RepurposeFormatStatus {
  format: RepurposeFormat;
  status: ContentStatus;
  posted_date?: string;
}

export interface SocialContent {
  id: number;
  content_date: string; // ISO date string
  content_type: ContentType;
  status: ContentStatus;
  title?: string;
  script?: string;
  reel_type?: ReelType;
  editing_style?: EditingStyle;
  editing_notes?: string;
  platforms?: string[]; // ['instagram', 'tiktok', etc.]
  hashtags?: string;
  music_audio?: string;
  thumbnail_reference?: string;
  notes?: string;
  project_id?: number;
  repurpose_formats?: RepurposeFormatStatus[];
  created_at: string;
  updated_at: string;
}

export interface SocialContentCreate {
  content_date: string;
  content_type: ContentType;
  status?: ContentStatus;
  title?: string;
  script?: string;
  reel_type?: ReelType;
  editing_style?: EditingStyle;
  editing_notes?: string;
  platforms?: string[];
  hashtags?: string;
  music_audio?: string;
  thumbnail_reference?: string;
  notes?: string;
  project_id?: number;
  repurpose_formats?: RepurposeFormatStatus[];
}

export interface SocialContentUpdate {
  content_date?: string;
  content_type?: ContentType;
  status?: ContentStatus;
  title?: string;
  script?: string;
  reel_type?: ReelType;
  editing_style?: EditingStyle;
  editing_notes?: string;
  platforms?: string[];
  hashtags?: string;
  music_audio?: string;
  thumbnail_reference?: string;
  notes?: string;
  project_id?: number;
  repurpose_formats?: RepurposeFormatStatus[];
}

export interface MonthSummary {
  month: number;
  total_content: number;
  by_status: Record<string, number>;
  by_type: Record<string, number>;
}

export interface YearSummary {
  year: number;
  months: MonthSummary[];
}

// Enums for UI
export const ContentType = {
  REEL: 'reel' as const,
  CAROUSEL: 'carousel' as const,
  SINGLE_POST: 'single_post' as const,
  STORY: 'story' as const,
  TIKTOK: 'tiktok' as const,
  YOUTUBE_SHORT: 'youtube_short' as const,
  YOUTUBE_VIDEO: 'youtube_video' as const,
  BLOG_POST: 'blog_post' as const,
};

export const ContentStatus = {
  NOT_STARTED: 'not_started' as const,
  SCRIPTED: 'scripted' as const,
  FILMED: 'filmed' as const,
  EDITING: 'editing' as const,
  SCHEDULED: 'scheduled' as const,
  POSTED: 'posted' as const,
};

export const EditingStyle = {
  FAST_PACED: 'fast_paced' as const,
  CINEMATIC: 'cinematic' as const,
  EDUCATIONAL: 'educational' as const,
  BEHIND_SCENES: 'behind_scenes' as const,
  TRENDING: 'trending' as const,
  TUTORIAL: 'tutorial' as const,
  INTERVIEW: 'interview' as const,
  CUSTOM: 'custom' as const,
}

// Time Tracking Types
export enum TimeEntryCategory {
  DEVELOPMENT = "development",
  DESIGN = "design",
  MEETING = "meeting",
  COMMUNICATION = "communication",
  RESEARCH = "research",
  ADMIN = "admin",
  SUPPORT = "support",
  OTHER = "other",
}

export interface TimeEntry {
  id: number;
  description?: string;
  start_time: string;
  end_time?: string;
  duration_seconds?: number;
  is_running: boolean;
  is_paused: boolean;
  paused_duration_seconds: number;
  task_id?: number;
  project_id?: number;
  deal_id?: number;
  hourly_rate?: number;
  is_billable: boolean;
  category?: TimeEntryCategory;
  created_at: string;
  updated_at: string;
  billable_amount?: number;
  task_title?: string;
  project_name?: string;
  deal_title?: string;
}

export interface TimeEntryStart {
  description?: string;
  task_id?: number;
  project_id?: number;
  deal_id?: number;
  hourly_rate?: number;
  is_billable?: boolean;
  category?: TimeEntryCategory;
}

export interface TimeEntryCreate {
  description?: string;
  start_time: string;
  end_time: string;
  duration_seconds?: number;
  task_id?: number;
  project_id?: number;
  deal_id?: number;
  hourly_rate?: number;
  is_billable?: boolean;
  category?: TimeEntryCategory;
}

export interface TimeEntryUpdate {
  description?: string;
  start_time?: string;
  end_time?: string;
  duration_seconds?: number;
  task_id?: number;
  project_id?: number;
  deal_id?: number;
  hourly_rate?: number;
  is_billable?: boolean;
  category?: TimeEntryCategory;
}

export interface TimeSummary {
  total_seconds: number;
  total_hours: number;
  total_billable: number;
  entry_count: number;
}

export interface TimeSummaryResponse {
  today: TimeSummary;
  this_week: TimeSummary;
  this_month: TimeSummary;
}

// Outreach Types
export interface OutreachNiche {
  id: number;
  name: string;
  created_at?: string;
}

export interface OutreachSituation {
  id: number;
  name: string;
  created_at?: string;
}

export interface OutreachTemplate {
  id: number;
  niche_id: number;
  situation_id: number;
  dm_number: number;
  content: string;
  created_at?: string;
  updated_at?: string;
}

// Cold Outreach Types
export enum ProspectStatus {
  QUEUED = "QUEUED",
  IN_SEQUENCE = "IN_SEQUENCE",
  REPLIED = "REPLIED",
  NOT_INTERESTED = "NOT_INTERESTED",
  CONVERTED = "CONVERTED",
}

export enum ResponseType {
  INTERESTED = "INTERESTED",
  NOT_INTERESTED = "NOT_INTERESTED",
  OTHER = "OTHER",
}

export enum CampaignStatus {
  ACTIVE = "ACTIVE",
  ARCHIVED = "ARCHIVED",
}

export interface OutreachCampaign {
  id: number;
  name: string;
  status: CampaignStatus;
  step_1_delay: number;
  step_2_delay: number;
  step_3_delay: number;
  step_4_delay: number;
  step_5_delay: number;
  created_at: string;
  updated_at: string;
}

export interface CampaignStats {
  total_prospects: number;
  queued: number;
  in_sequence: number;
  replied: number;
  not_interested: number;
  converted: number;
  to_contact_today: number;
  response_rate: number;
  total_pipeline_value: number;
}

export interface CampaignWithStats extends OutreachCampaign {
  stats: CampaignStats;
}

export interface CampaignCreate {
  name: string;
  step_1_delay?: number;
  step_2_delay?: number;
  step_3_delay?: number;
  step_4_delay?: number;
  step_5_delay?: number;
}

export interface OutreachProspect {
  id: number;
  campaign_id: number;
  agency_name: string;
  contact_name?: string;
  email: string;
  website?: string;
  niche?: string;
  custom_fields?: Record<string, any>;
  status: ProspectStatus;
  current_step: number;
  next_action_date?: string;
  last_contacted_at?: string;
  response_type?: ResponseType;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ProspectCreate {
  agency_name: string;
  contact_name?: string;
  email: string;
  website?: string;
  niche?: string;
  custom_fields?: Record<string, any>;
}

export interface CsvColumnMapping {
  agency_name: string;
  contact_name?: string;
  email: string;
  website?: string;
  niche?: string;
}

export interface CsvImportRequest {
  column_mapping: CsvColumnMapping;
  data: Record<string, any>[];
}

export interface CsvImportResponse {
  imported_count: number;
  skipped_count: number;
  errors: string[];
}

export interface MarkRepliedRequest {
  response_type: ResponseType;
  notes?: string;
}

export interface MarkRepliedResponse {
  prospect: OutreachProspect;
  contact_id?: number;
  deal_id?: number;
  message: string;
}

export interface OutreachEmailTemplate {
  id: number;
  campaign_id: number;
  step_number: number;
  subject: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface EmailTemplateCreate {
  step_number: number;
  subject: string;
  body: string;
}

export interface RenderedEmail {
  to_email: string;
  subject: string;
  body: string;
  prospect_id: number;
  step_number: number;
}

// Lead Discovery Types
export interface DiscoveredLead {
  agency_name: string;
  email: string | null;
  contact_name: string | null;
  website: string | null;
  niche: string | null;
  is_duplicate: boolean;
  is_valid_email: boolean;
}

export interface LeadSearchRequest {
  niche: string;
  location: string;
  count: number;
}

export interface LeadSearchResponse {
  leads: DiscoveredLead[];
  duplicates_found: number;
  valid_for_import: number;
}

export interface LeadImportRequest {
  leads: DiscoveredLead[];
  campaign_id: number;
}

export interface LeadImportResponse {
  imported: number;
  campaign_name: string;
}