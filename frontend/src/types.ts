export type Applicant = {
  name: string;
  reference: string;
  date_of_birth: string | null;
};

export type TimelineEvent = {
  date: string;
  event: string;
  note: string;
};

export type RawCase = {
  case_id: string;
  case_type: string;
  status: string;
  applicant: Applicant;
  assigned_to: string;
  created_date: string;
  last_updated: string;
  timeline: TimelineEvent[];
  case_notes: string;
};

export type AiStatus = string;

export type RequiredAction = {
  label: string;
  items: string[];
  severity?: "info" | "warning" | "critical";
};

export type EnrichedCase = RawCase & {
  state: string;
  score: number;
  ai_status: AiStatus;
  explanation: string;
  rejection_reason?: string;
  required_action?: RequiredAction;
  /** Supabase storage bucket name */
  storage_bucket?: string;
  /** Folder name inside the bucket */
  folder_name?: string;
};

export type WorkflowState = {
  state: string;
  label: string;
  description: string;
  allowed_transitions: string[];
  required_actions: string[];
  escalation_thresholds?: {
    reminder_days?: number;
    escalation_days?: number;
  };
};

export type StatesFile = {
  case_types: Record<string, { states: WorkflowState[] }>;
};
