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

export type Task = {
  id: number;
  title: string;
  description?: string;
  due_date?: string;
  due_time?: string;
  priority: TaskPriority;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export type TaskCreate = {
  title: string;
  description?: string;
  due_date?: string;
  due_time?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
}

export type TaskUpdate = {
  title?: string;
  description?: string;
  due_date?: string;
  due_time?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
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
}

export type Contact = {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  status: ContactStatus;
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
  created_at: string;
  updated_at: string;
}

export type DealCreate = {
  contact_id: number;
  title: string;
  description?: string;
  value?: number;
  stage?: DealStage;
  probability?: number;
  expected_close_date?: string;
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

// Export types
export type ContextExport = {
  markdown: string;
  start_date: string;
  end_date: string;
}
