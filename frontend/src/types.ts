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

export type AiStatus = "draft" | "published" | "rejected" | "quarantined";

export type EnrichedCase = RawCase & {
  state: string;
  score: number;
  ai_status: AiStatus;
  explanation: string;
  rejection_reason?: string;
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
