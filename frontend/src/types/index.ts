// Task types
export enum TaskPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  URGENT = "URGENT",
}

export enum TaskStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  DELAYED = "DELAYED",
  SKIPPED = "SKIPPED",
  WAITING_ON_CLIENT = "WAITING_ON_CLIENT",
}

export enum RecurrenceType {
  DAILY = "DAILY",
  WEEKLY = "WEEKLY",
  MONTHLY = "MONTHLY",
  YEARLY = "YEARLY",
}

export enum ProjectStatus {
  TODO = "TODO",
  SCOPING = "SCOPING",
  IN_PROGRESS = "IN_PROGRESS",
  REVIEW = "REVIEW",
  REVISIONS = "REVISIONS",
  COMPLETED = "COMPLETED",
  RETAINER = "RETAINER",
}

export type Project = {
  id: number;
  name: string;
  description?: string;
  status: ProjectStatus;
  progress: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  task_count?: number;
  completed_task_count?: number;
  hourly_rate?: number;
  deadline?: string;
  contact_id?: number;
  contact_name?: string;
  service_type?: string;
  notes?: string;
}

export type ProjectCreate = {
  name: string;
  description?: string;
  hourly_rate?: number;
  deadline?: string;
  template_id?: number;
  contact_id?: number;
  service_type?: string;
}

export type ProjectUpdate = {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  hourly_rate?: number;
  deadline?: string | null;
  contact_id?: number | null;
  service_type?: string | null;
  notes?: string | null;
}

export type ProjectTemplateTask = {
  id: number;
  title: string;
  description?: string;
  priority: TaskPriority;
  order: number;
  phase?: string;
}

export type ProjectTemplateTaskCreate = {
  title: string;
  description?: string;
  priority: TaskPriority;
  order: number;
  phase?: string;
}

export type ProjectTemplate = {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  tasks: ProjectTemplateTask[];
}

export type ProjectTemplateCreate = {
  name: string;
  description?: string;
  tasks: ProjectTemplateTaskCreate[];
}

export type TaskLink = {
  id: number;
  task_id: number;
  url: string;
  label?: string;
  created_at: string;
}

export type TaskNote = {
  id: number;
  task_id: number;
  content: string;
  created_at: string;
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
  sprint_day_id?: number;
  phase?: string;
  links?: TaskLink[];
  notes?: TaskNote[];

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
  sprint_day_id?: number;
  phase?: string;

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
  sprint_day_id?: number;
  phase?: string;

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
  LEAD = "LEAD",
  PROSPECT = "PROSPECT",
  CLIENT = "CLIENT",
  INACTIVE = "INACTIVE",
}

export enum TradeIndustry {
  ROOFER = "ROOFER",
  PLUMBER = "PLUMBER",
  ELECTRICIAN = "ELECTRICIAN",
  BUILDER = "BUILDER",
  HVAC = "HVAC",
  LANDSCAPER = "LANDSCAPER",
  PAINTER = "PAINTER",
  CARPENTER = "CARPENTER",
  TILER = "TILER",
  CONCRETER = "CONCRETER",
  OTHER = "OTHER",
}

export enum LeadSource {
  HIPAGES = "HIPAGES",
  SERVICE_SEEKING = "SERVICE_SEEKING",
  YELLOW_PAGES = "YELLOW_PAGES",
  TRUE_LOCAL = "TRUE_LOCAL",
  ONEFLARE = "ONEFLARE",
  GOOGLE_MAPS = "GOOGLE_MAPS",
  GOOGLE_SEARCH = "GOOGLE_SEARCH",
  LINKEDIN = "LINKEDIN",
  REFERRAL = "REFERRAL",
  COLD_EMAIL = "COLD_EMAIL",
  OTHER = "OTHER",
}

export enum DealStage {
  LEAD = "LEAD",
  PROSPECT = "PROSPECT",
  PROPOSAL = "PROPOSAL",
  NEGOTIATION = "NEGOTIATION",
  CLOSED_WON = "CLOSED_WON",
  CLOSED_LOST = "CLOSED_LOST",
}

export enum InteractionType {
  MEETING = "MEETING",
  EMAIL = "EMAIL",
  CALL = "CALL",
  NOTE = "NOTE",
  SOCIAL_MEDIA = "SOCIAL_MEDIA",
  FOLLOW_UP_EMAIL = "FOLLOW_UP_EMAIL",
  // Daily outreach activity types
  COLD_EMAIL = "COLD_EMAIL",
  LINKEDIN_ACTION = "LINKEDIN_ACTION",
  FOLLOW_UP_CALL = "FOLLOW_UP_CALL",
  LOOM_AUDIT = "LOOM_AUDIT",
}

export enum BillingFrequency {
  MONTHLY = "MONTHLY",
  QUARTERLY = "QUARTERLY",
  SEMI_ANNUAL = "SEMI_ANNUAL",
  ANNUAL = "ANNUAL",
}

export enum ServiceStatus {
  ACTIVE = "ACTIVE",
  PAUSED = "PAUSED",
  CANCELLED = "CANCELLED",
  PENDING = "PENDING",
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
  // Tradie-specific fields
  industry?: string;
  suburb?: string;
  city?: string;
  website_url?: string;
  website_issues?: string; // JSON string of issues
  website_speed_score?: number;
  // Outreach tracking fields
  email_stage?: string;
  email_last_sent?: string;
  linkedin_stage?: string;
  linkedin_last_action?: string;
  loom_audit_sent?: boolean;
  loom_audit_url?: string;
  next_followup_date?: string;
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
  // Tradie-specific fields
  industry?: string;
  suburb?: string;
  city?: string;
  website_url?: string;
  website_issues?: string;
  website_speed_score?: number;
  // Outreach tracking fields
  email_stage?: string;
  email_last_sent?: string;
  linkedin_stage?: string;
  linkedin_last_action?: string;
  loom_audit_sent?: boolean;
  loom_audit_url?: string;
  next_followup_date?: string;
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
  contact_name?: string;
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
  JANUARY = "JANUARY",
  FEBRUARY = "FEBRUARY",
  MARCH = "MARCH",
  APRIL = "APRIL",
  MAY = "MAY",
  JUNE = "JUNE",
  JULY = "JULY",
  AUGUST = "AUGUST",
  SEPTEMBER = "SEPTEMBER",
  OCTOBER = "OCTOBER",
  NOVEMBER = "NOVEMBER",
  DECEMBER = "DECEMBER",
}

export enum GoalPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
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
  | 'REEL'
  | 'CAROUSEL'
  | 'SINGLE_POST'
  | 'STORY'
  | 'TIKTOK'
  | 'YOUTUBE_SHORT'
  | 'YOUTUBE_VIDEO'
  | 'BLOG_POST';

export type ContentStatus =
  | 'NOT_STARTED'
  | 'SCRIPTED'
  | 'FILMED'
  | 'EDITING'
  | 'SCHEDULED'
  | 'POSTED';

export type EditingStyle =
  | 'FAST_PACED'
  | 'CINEMATIC'
  | 'EDUCATIONAL'
  | 'BEHIND_SCENES'
  | 'TRENDING'
  | 'TUTORIAL'
  | 'INTERVIEW'
  | 'CUSTOM';

export type ReelType =
  | 'EDUCATIONAL'
  | 'BEFORE_AFTER'
  | 'BTS'
  | 'SOCIAL_PROOF'
  | 'MINI_AUDIT'
  | 'SEO_EDUCATION'
  | 'CLIENT_RESULTS'
  | 'DIRECT_CTA'
  | 'FULL_REDESIGN';

export type RepurposeFormat =
  // Short-form Video
  | 'INSTAGRAM_REEL' | 'TIKTOK_REEL' | 'YOUTUBE_SHORT' | 'FACEBOOK_REEL' | 'LINKEDIN_REEL'
  // Carousel
  | 'INSTAGRAM_CAROUSEL' | 'LINKEDIN_CAROUSEL' | 'FACEBOOK_CAROUSEL' | 'TIKTOK_CAROUSEL'
  // Long Caption
  | 'INSTAGRAM_LONG_CAPTION' | 'TIKTOK_LONG_CAPTION' | 'FACEBOOK_LONG_CAPTION'
  // Text Post
  | 'FACEBOOK_POST' | 'LINKEDIN_POST' | 'THREADS_POST' | 'TWITTER_POST';

export interface RepurposeFormatStatus {
  format: RepurposeFormat;
  status: ContentStatus;
  posted_date?: string;
  scheduled_date?: string;
  content?: string;
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
  REEL: 'REEL' as const,
  CAROUSEL: 'CAROUSEL' as const,
  SINGLE_POST: 'SINGLE_POST' as const,
  STORY: 'STORY' as const,
  TIKTOK: 'TIKTOK' as const,
  YOUTUBE_SHORT: 'YOUTUBE_SHORT' as const,
  YOUTUBE_VIDEO: 'YOUTUBE_VIDEO' as const,
  BLOG_POST: 'BLOG_POST' as const,
};

export const ContentStatus = {
  NOT_STARTED: 'NOT_STARTED' as const,
  SCRIPTED: 'SCRIPTED' as const,
  FILMED: 'FILMED' as const,
  EDITING: 'EDITING' as const,
  SCHEDULED: 'SCHEDULED' as const,
  POSTED: 'POSTED' as const,
};

export const EditingStyle = {
  FAST_PACED: 'FAST_PACED' as const,
  CINEMATIC: 'CINEMATIC' as const,
  EDUCATIONAL: 'EDUCATIONAL' as const,
  BEHIND_SCENES: 'BEHIND_SCENES' as const,
  TRENDING: 'TRENDING' as const,
  TUTORIAL: 'TUTORIAL' as const,
  INTERVIEW: 'INTERVIEW' as const,
  CUSTOM: 'CUSTOM' as const,
}

// Time Tracking Types
export enum TimeEntryCategory {
  DEVELOPMENT = "DEVELOPMENT",
  DESIGN = "DESIGN",
  MEETING = "MEETING",
  COMMUNICATION = "COMMUNICATION",
  RESEARCH = "RESEARCH",
  ADMIN = "ADMIN",
  SUPPORT = "SUPPORT",
  OTHER = "OTHER",
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

export type TemplateType =
  | 'email_1' | 'email_2' | 'email_3' | 'email_4' | 'email_5'
  | 'linkedin_direct' | 'linkedin_compliment' | 'linkedin_mutual_interest'
  | 'linkedin_followup_1' | 'linkedin_followup_2'
  | 'loom_video_audit'
  | 'agency_email' | 'agency_linkedin';

export interface OutreachTemplate {
  id: number;
  niche_id: number | null;
  situation_id: number | null;
  template_type: TemplateType;
  subject: string | null;
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
  SKIPPED = "SKIPPED",
  // LinkedIn-specific
  PENDING_CONNECTION = "PENDING_CONNECTION",
  // Multi-touch specific
  PENDING_ENGAGEMENT = "PENDING_ENGAGEMENT",
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

export enum CampaignType {
  EMAIL = "EMAIL",
  LINKEDIN = "LINKEDIN",
  MULTI_TOUCH = "MULTI_TOUCH",
}

export enum StepChannelType {
  EMAIL = "EMAIL",
  LINKEDIN_CONNECT = "LINKEDIN_CONNECT",
  LINKEDIN_MESSAGE = "LINKEDIN_MESSAGE",
  LINKEDIN_ENGAGE = "LINKEDIN_ENGAGE",
  FOLLOW_UP_EMAIL = "FOLLOW_UP_EMAIL",
  LOOM_EMAIL = "LOOM_EMAIL",
}

export interface MultiTouchStep {
  id: number;
  campaign_id: number;
  step_number: number;
  channel_type: StepChannelType;
  delay_days: number;
  template_subject?: string;
  template_content?: string;
  instruction_text?: string;
  requires_linkedin_connected?: boolean;
  loom_script?: string;
}

export interface MultiTouchStepCreate {
  step_number: number;
  channel_type: StepChannelType;
  delay_days: number;
  template_subject?: string;
  template_content?: string;
  instruction_text?: string;
  requires_linkedin_connected?: boolean;
  loom_script?: string;
}

export interface OutreachCampaign {
  id: number;
  name: string;
  campaign_type: CampaignType;
  status: CampaignStatus;
  step_1_delay: number;
  step_2_delay: number;
  step_3_delay: number;
  step_4_delay: number;
  step_5_delay: number;
  multi_touch_steps?: MultiTouchStep[];
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
  skipped: number;
  // LinkedIn-specific
  pending_connection: number;
  connected: number;
  // Multi-touch specific
  pending_engagement: number;
}

export interface CampaignWithStats extends OutreachCampaign {
  stats: CampaignStats;
}

export interface CampaignCreate {
  name: string;
  campaign_type?: CampaignType;
  step_1_delay?: number;
  step_2_delay?: number;
  step_3_delay?: number;
  step_4_delay?: number;
  step_5_delay?: number;
  steps?: MultiTouchStepCreate[];
}

export interface OutreachProspect {
  id: number;
  campaign_id: number;
  agency_name: string;
  contact_name?: string;
  email?: string | null;
  website?: string;
  niche?: string;
  custom_fields?: Record<string, any>;
  status: ProspectStatus;
  current_step: number;
  next_action_date?: string;
  last_contacted_at?: string;
  response_type?: ResponseType;
  notes?: string;
  custom_email_note?: string;
  custom_email_subject?: string;
  custom_email_body?: string;
  discovered_lead_id?: number;
  converted_contact_id?: number;
  converted_deal_id?: number;
  website_issues?: string[];
  linkedin_connected?: boolean;
  linkedin_url?: string;
  facebook_url?: string;
  instagram_url?: string;
  // Multi-touch enrichment
  current_step_detail?: MultiTouchStep;
  missing_data_warnings?: string[];
  created_at: string;
  updated_at: string;
}

export interface ProspectCreate {
  agency_name: string;
  contact_name?: string;
  email?: string;
  website?: string;
  niche?: string;
  linkedin_url?: string;
  custom_fields?: Record<string, any>;
}

export interface CsvColumnMapping {
  agency_name: string;
  contact_name?: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  email?: string;
  website?: string;
  niche?: string;
  linkedin_url?: string;
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
  confidence: 'high' | 'medium' | 'low' | null;
  confidence_signals: Record<string, unknown> | null;
  linkedin_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  email_source: 'scraped' | 'ai_found' | 'manual' | null;
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
  already_saved: number;
  search_exhausted: boolean;
  rounds_searched: number;
}

// Search Planner Types
export interface SearchPlannerCombination {
  id: number;
  country: string;
  city: string;
  niche: string;
  is_searched: boolean;
  searched_at: string | null;
  leads_found: number;
  linkedin_searched: boolean;
  linkedin_searched_at: string | null;
  linkedin_leads_found: number;
  created_at: string;
}

export interface GenerateCombinationsResponse {
  created: number;
  already_existed: number;
  total: number;
}

export interface SearchPlannerStats {
  total: number;
  searched: number;
  not_searched: number;
  total_leads_found: number;
  linkedin_searched: number;
  linkedin_not_searched: number;
  linkedin_leads_found: number;
}

// Campaign Search Keyword Types
export interface CampaignSearchKeyword {
  id: number;
  campaign_id: number;
  category: string;
  keyword: string;
  is_searched: boolean;
  searched_at: string | null;
  leads_found: number;
  created_at: string;
}

export interface LeadImportRequest {
  leads: DiscoveredLead[];
  campaign_id: number;
}

export interface LeadImportResponse {
  imported: number;
  campaign_name: string;
}

// Daily Outreach Tracking Types
export interface ActivityMetric {
  current: number;
  target: number;
  percentage: number;
}

export interface DailyOutreachStats {
  date: string;
  cold_emails: ActivityMetric;
  linkedin: ActivityMetric;
  calls: ActivityMetric;
  looms: ActivityMetric;
  all_targets_met: boolean;
}

export interface OutreachStreak {
  current_streak: number;
  best_streak: number;
  last_completed_date?: string;
}

export interface DailySummaryItem {
  date: string;
  day_name: string;
  cold_emails: number;
  linkedin: number;
  calls: number;
  looms: number;
  targets_met: boolean;
}

export interface WeeklySummary {
  days: DailySummaryItem[];
  total_cold_emails: number;
  total_linkedin: number;
  total_calls: number;
  total_looms: number;
  days_met_target: number;
}

export interface LogActivityRequest {
  contact_id?: number;
  notes?: string;
}

export interface LogActivityResponse {
  message: string;
  activity_type: string;
  new_count: number;
  target: number;
  interaction_id?: number;
}

export interface OutreachSettings {
  id: number;
  daily_cold_email_target: number;
  daily_linkedin_target: number;
  daily_call_target: number;
  daily_loom_target: number;
  created_at: string;
  updated_at: string;
}

export interface OutreachSettingsUpdate {
  daily_cold_email_target?: number;
  daily_linkedin_target?: number;
  daily_call_target?: number;
  daily_loom_target?: number;
}

export type OutreachActivityType = 'cold_email' | 'linkedin' | 'call' | 'loom';

// Sprint Types
export enum SprintStatus {
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
  PAUSED = "PAUSED",
  ABANDONED = "ABANDONED",
}

export interface SprintDayTask {
  title: string;
  completed: boolean;
}

export interface SprintDay {
  id: number;
  sprint_id: number;
  day_number: number;
  week_number: number;
  log_date: string;
  tasks: Task[];  // Now uses real Task entities
  is_complete: boolean;
  notes?: string;
  outreach_log_id?: number;
  outreach_stats?: DailyOutreachStats;
  created_at: string;
  updated_at: string;
}

export interface PlaybookSuggestion {
  title: string;
  description?: string;
}

export interface PlaybookSuggestionsResponse {
  day_number: number;
  suggestions: PlaybookSuggestion[];
}

export interface SprintWeekSummary {
  week_number: number;
  theme: string;
  days_completed: number;
  total_days: number;
  is_current_week: boolean;
}

export interface Sprint {
  id: number;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  status: SprintStatus;
  current_day: number;
  current_week: number;
  progress_percentage: number;
  weeks: SprintWeekSummary[];
  today?: SprintDay;
  days: SprintDay[];  // All 30 days
  created_at: string;
  updated_at: string;
}

export interface SprintListItem {
  id: number;
  title: string;
  start_date: string;
  end_date: string;
  status: SprintStatus;
  progress_percentage: number;
  created_at: string;
}

export interface SprintCreate {
  title?: string;
  description?: string;
  start_date?: string;
}

export interface ToggleTaskResponse {
  day: SprintDay;
  task_index: number;
  completed: boolean;
  message: string;
}

export interface UpdateNotesResponse {
  day_number: number;
  notes: string;
  message: string;
}

// Loom Audit Types
export enum LoomResponseType {
  INTERESTED = "INTERESTED",
  NOT_INTERESTED = "NOT_INTERESTED",
  QUESTIONS = "QUESTIONS",
  BOOKED_CALL = "BOOKED_CALL",
  NO_RESPONSE = "NO_RESPONSE",
}

export interface LoomAudit {
  id: number;
  contact_id: number;
  title: string;
  loom_url: string;
  thumbnail_url?: string;
  sent_date: string;
  sent_via?: string;
  watched: boolean;
  watched_date?: string;
  watch_count: number;
  response_received: boolean;
  response_date?: string;
  response_type?: LoomResponseType;
  follow_up_date?: string;
  follow_up_sent: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
  days_since_sent: number;
  needs_follow_up: boolean;
  contact_name?: string;
  contact_company?: string;
}

export interface LoomAuditCreate {
  contact_id: number;
  title: string;
  loom_url: string;
  thumbnail_url?: string;
  sent_via?: string;
  sent_date?: string;
  notes?: string;
}

export interface LoomAuditUpdate {
  title?: string;
  loom_url?: string;
  thumbnail_url?: string;
  sent_via?: string;
  notes?: string;
  follow_up_date?: string;
}

export interface LoomAuditStats {
  total_sent: number;
  total_watched: number;
  total_responded: number;
  total_pending: number;
  total_needs_follow_up: number;
  watch_rate: number;
  response_rate: number;
  booked_calls: number;
}

export interface LoomAuditListResponse {
  audits: LoomAudit[];
  stats: LoomAuditStats;
}

export interface MarkWatchedRequest {
  watched_date?: string;
  watch_count?: number;
}

export interface MarkRespondedRequest {
  response_type: LoomResponseType;
  response_date?: string;
  notes?: string;
}

// Pipeline Calculator Types
export interface PipelineSettings {
  id: number;
  monthly_revenue_goal: number;
  average_deal_value: number;
  lead_to_qualified_rate: number;
  qualified_to_proposal_rate: number;
  proposal_to_close_rate: number;
  cold_email_response_rate: number;
  linkedin_connection_rate: number;
  linkedin_to_conversation_rate: number;
  call_to_meeting_rate: number;
  loom_response_rate: number;
  loom_to_call_rate: number;
  created_at: string;
  updated_at: string;
}

export interface PipelineSettingsUpdate {
  monthly_revenue_goal?: number;
  average_deal_value?: number;
  lead_to_qualified_rate?: number;
  qualified_to_proposal_rate?: number;
  proposal_to_close_rate?: number;
  cold_email_response_rate?: number;
  linkedin_connection_rate?: number;
  linkedin_to_conversation_rate?: number;
  call_to_meeting_rate?: number;
  loom_response_rate?: number;
  loom_to_call_rate?: number;
}

export interface FunnelStage {
  name: string;
  count: number;
  conversion_rate: number;
  description: string;
}

export interface ActivityRequirement {
  channel: string;
  daily: number;
  weekly: number;
  monthly: number;
  description: string;
}

export interface PipelineCalculation {
  monthly_revenue_goal: number;
  deals_needed: number;
  average_deal_value: number;
  funnel: FunnelStage[];
  activities: ActivityRequirement[];
  total_leads_needed: number;
  overall_conversion_rate: number;
  daily_outreach_target: number;
  daily_cold_emails: number;
  daily_linkedin: number;
  daily_calls: number;
  daily_looms: number;
}

// Discovery Call Types
export enum CallOutcome {
  SCHEDULED_FOLLOWUP = "SCHEDULED_FOLLOWUP",
  SENT_PROPOSAL = "SENT_PROPOSAL",
  NOT_A_FIT = "NOT_A_FIT",
  NEEDS_MORE_INFO = "NEEDS_MORE_INFO",
  CLOSED_DEAL = "CLOSED_DEAL",
  NO_SHOW = "NO_SHOW",
  RESCHEDULED = "RESCHEDULED",
}

export interface DiscoveryCall {
  id: number;
  contact_id: number;
  deal_id?: number;
  call_date: string;
  call_duration_minutes?: number;
  attendees?: string;
  // SPIN Framework
  situation?: string;
  situation_questions?: string;
  problem?: string;
  problem_questions?: string;
  implication?: string;
  implication_questions?: string;
  need_payoff?: string;
  need_payoff_questions?: string;
  // Additional fields
  objections?: string;
  next_steps?: string;
  budget_discussed: boolean;
  budget_range?: string;
  timeline_discussed: boolean;
  timeline?: string;
  decision_maker_present: boolean;
  // Outcome
  outcome?: CallOutcome;
  follow_up_date?: string;
  // Computed/Display
  spin_completion: number;
  contact_name?: string;
  contact_company?: string;
  deal_title?: string;
  created_at: string;
  updated_at: string;
}

export interface DiscoveryCallCreate {
  contact_id: number;
  deal_id?: number;
  call_date?: string;
  call_duration_minutes?: number;
  attendees?: string;
  situation?: string;
  situation_questions?: string;
  problem?: string;
  problem_questions?: string;
  implication?: string;
  implication_questions?: string;
  need_payoff?: string;
  need_payoff_questions?: string;
  objections?: string;
  next_steps?: string;
  budget_discussed?: boolean;
  budget_range?: string;
  timeline_discussed?: boolean;
  timeline?: string;
  decision_maker_present?: boolean;
  outcome?: CallOutcome;
  follow_up_date?: string;
}

export interface DiscoveryCallUpdate {
  call_date?: string;
  call_duration_minutes?: number;
  attendees?: string;
  situation?: string;
  situation_questions?: string;
  problem?: string;
  problem_questions?: string;
  implication?: string;
  implication_questions?: string;
  need_payoff?: string;
  need_payoff_questions?: string;
  objections?: string;
  next_steps?: string;
  budget_discussed?: boolean;
  budget_range?: string;
  timeline_discussed?: boolean;
  timeline?: string;
  decision_maker_present?: boolean;
  outcome?: CallOutcome;
  follow_up_date?: string;
  deal_id?: number;
}

export interface DiscoveryCallStats {
  total_calls: number;
  calls_this_month: number;
  avg_spin_completion: number;
  outcome_breakdown: Record<string, number>;
  avg_duration_minutes?: number;
  follow_ups_scheduled: number;
  proposals_sent: number;
  deals_closed: number;
}

export interface DiscoveryCallListResponse {
  calls: DiscoveryCall[];
  stats: DiscoveryCallStats;
}

// --- Autoresearch Types ---

export enum AuditStatus {
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SKIPPED = 'skipped',
}

export enum AuditConfidence {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum SiteQuality {
  GOOD = 'good',
  MEDIUM = 'medium',
  POOR = 'poor',
}

export enum ExperimentStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  REPLIED = 'replied',
  NO_REPLY = 'no_reply',
  BOUNCED = 'bounced',
}

export interface AuditResult {
  id: number;
  prospect_id: number;
  campaign_id: number;
  issue_type: string | null;
  issue_detail: string | null;
  secondary_issue: string | null;
  secondary_detail: string | null;
  confidence: string;
  site_quality: string;
  needs_verification: boolean;
  pass_2_completed: boolean;
  generated_subject: string | null;
  generated_subject_variant: string | null;
  generated_body: string | null;
  word_count: number | null;
  desktop_screenshot: string | null;
  mobile_screenshot: string | null;
  status: string;
  rejection_reason: string | null;
  was_edited: boolean;
  edited_subject: string | null;
  edited_body: string | null;
  audit_duration_seconds: number | null;
  ai_cost_estimate: number | null;
  created_at: string;
  prospect_name: string | null;
  prospect_company: string | null;
  prospect_niche: string | null;
  prospect_email: string | null;
  prospect_website: string | null;
  prospect_city: string | null;
}

export interface AuditListResponse {
  audits: AuditResult[];
  total_count: number;
  page: number;
  page_size: number;
}

export interface BatchAuditResponse {
  batch_id: string;
  total: number;
  message: string;
}

export interface BatchProgress {
  batch_id: string;
  completed: number;
  total: number;
  errors: number;
  current_prospect: string | null;
  is_complete: boolean;
  is_cancelled: boolean;
}

export interface ExperimentRecord {
  id: number;
  prospect_id: number;
  campaign_id: number;
  audit_id: number;
  status: string;
  issue_type: string | null;
  issue_detail: string | null;
  secondary_issue: string | null;
  confidence: string | null;
  subject: string | null;
  body: string | null;
  word_count: number | null;
  was_edited: boolean;
  subject_variant_used: string | null;
  niche: string | null;
  city: string | null;
  company: string | null;
  sent_at: string | null;
  day_of_week: string | null;
  step_number: number;
  replied: boolean;
  reply_at: string | null;
  response_time_minutes: number | null;
  sentiment: string | null;
  category: string | null;
  converted_to_call: boolean;
  converted_to_client: boolean;
  deal_value: number | null;
  loom_sent: boolean;
  loom_url: string | null;
  loom_watched: boolean | null;
  created_at: string;
}

export interface TrackingPixelResponse {
  tracking_id: string;
  pixel_url: string;
  img_tag: string;
}

export interface ExperimentListResponse {
  experiments: ExperimentRecord[];
  total_count: number;
  page: number;
  page_size: number;
}

export interface IssueTypeStats {
  issue_type: string;
  sent: number;
  replied: number;
  reply_rate: number;
  confidence: string;
}

export interface NicheStats {
  niche: string;
  sent: number;
  replied: number;
  reply_rate: number;
  best_issue_type: string | null;
}

export interface TimingStats {
  day_of_week: string;
  sent: number;
  replied: number;
  reply_rate: number;
}

export interface AnalyticsOverview {
  total_experiments: number;
  total_sent: number;
  total_replied: number;
  overall_reply_rate: number;
  best_issue_type: string | null;
  best_niche: string | null;
  avg_response_time_minutes: number | null;
  total_ai_cost: number;
}

export interface InsightRecord {
  id: number;
  insight: string;
  confidence: string;
  sample_size: number;
  recommendation: string | null;
  applies_to: string;
  is_active: boolean;
  created_at: string;
}

export interface AutoresearchSettings {
  audit_prompt: string | null;
  audit_model: string;
  classifier_model: string;
  learning_model: string;
  min_page_load_wait: number;
  enable_pass_2: boolean;
  max_batch_size: number;
  gmail_connected: boolean;
  gmail_email: string | null;
  monthly_cost: number;
  total_audits: number;
}