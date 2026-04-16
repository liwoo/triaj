import type { EnrichedCase, RequiredAction, TimelineEvent } from "@/types";
import { createClient } from "@/lib/supabase/client";

type ApplicantRow = {
  name: string | null;
  reference: string | null;
  date_of_birth: string | null;
};

type TimelineRow = {
  event_date: string;
  event: string;
  note: string | null;
  actor: string | null;
};

type RequiredActionRow = {
  label: string;
  items: string[] | null;
  severity: string | null;
  resolved_at: string | null;
};

type CaseRow = {
  id: string;
  case_id: string;
  case_type: string;
  status: string;
  state: string | null;
  score: number | null;
  ai_status: string | null;
  explanation: string | null;
  rejection_reason: string | null;
  assigned_to: string | null;
  case_notes: string | null;
  created_date: string;
  last_updated: string | null;
  applicant: ApplicantRow | ApplicantRow[] | null;
  timeline: TimelineRow[] | null;
  required_actions: RequiredActionRow[] | null;
};

const CASE_SELECT = `
  id,
  case_id,
  case_type,
  status,
  state,
  score,
  ai_status,
  explanation,
  rejection_reason,
  assigned_to,
  case_notes,
  created_date,
  last_updated,
  applicant:applicants (
    name,
    reference,
    date_of_birth
  ),
  timeline:case_timeline (
    event_date,
    event,
    note,
    actor
  ),
  required_actions:case_required_actions (
    label,
    items,
    severity,
    resolved_at
  )
`;

function normaliseApplicant(raw: CaseRow["applicant"]) {
  const a = Array.isArray(raw) ? raw[0] : raw;
  return {
    name: a?.name ?? "Unknown applicant",
    reference: a?.reference ?? "—",
    date_of_birth: a?.date_of_birth ?? null,
  };
}

function toTimeline(rows: TimelineRow[] | null): TimelineEvent[] {
  if (!rows?.length) return [];
  return [...rows]
    .sort((a, b) => (a.event_date < b.event_date ? 1 : -1))
    .map((r) => ({
      date: r.event_date,
      event: r.event,
      note: r.note ?? "",
    }));
}

function toRequiredAction(
  rows: RequiredActionRow[] | null,
): RequiredAction | undefined {
  const active = rows?.find((r) => !r.resolved_at);
  if (!active) return undefined;
  const severity =
    active.severity === "info" ||
    active.severity === "warning" ||
    active.severity === "critical"
      ? active.severity
      : undefined;
  return {
    label: active.label,
    items: active.items ?? [],
    severity,
  };
}

// ai_status is the bucket the UI sorts on (draft / published / rejected /
// quarantined). Some agents only write the workflow `status` column and leave
// `ai_status` null — so coerce obvious quarantine/publish signals here rather
// than defaulting silently to "draft".
function inferAiStatus(row: CaseRow): string {
  if (row.ai_status) return row.ai_status;
  if (row.status === "quarantined" || row.state === "quarantined") {
    return "quarantined";
  }
  if (row.status === "closed") return "published";
  return "draft";
}

function toEnriched(row: CaseRow): EnrichedCase {
  return {
    case_id: row.case_id,
    case_type: row.case_type,
    status: row.status,
    state: row.state ?? row.status,
    applicant: normaliseApplicant(row.applicant),
    assigned_to: row.assigned_to ?? "—",
    case_notes: row.case_notes ?? "",
    created_date: row.created_date,
    last_updated: row.last_updated ?? row.created_date,
    timeline: toTimeline(row.timeline),
    score: row.score ?? 0,
    ai_status: inferAiStatus(row),
    explanation: row.explanation ?? "",
    rejection_reason: row.rejection_reason ?? undefined,
    required_action: toRequiredAction(row.required_actions),
  };
}

export async function approveCaseInSupabase(caseId: string): Promise<void> {
  const supabase = createClient();
  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);

  const { data, error } = await supabase
    .from("cases")
    .update({ ai_status: "published", last_updated: nowIso })
    .eq("case_id", caseId)
    .select("id")
    .single();

  if (error) throw new Error(`approve failed: ${error.message}`);

  const { error: timelineErr } = await supabase.from("case_timeline").insert({
    case_id: data.id,
    event_date: today,
    event: "approved",
    note: "Human reviewer approved the AI triage decision.",
    actor: "human_reviewer",
  });
  if (timelineErr) {
    console.warn(
      "[cases-api] approve succeeded but timeline insert failed:",
      timelineErr,
    );
  }
}

export async function rejectCaseInSupabase(
  caseId: string,
  reason: string,
): Promise<void> {
  const supabase = createClient();
  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);

  const { data, error } = await supabase
    .from("cases")
    .update({
      ai_status: "rejected",
      rejection_reason: reason,
      last_updated: nowIso,
    })
    .eq("case_id", caseId)
    .select("id")
    .single();

  if (error) throw new Error(`reject failed: ${error.message}`);

  const { error: timelineErr } = await supabase.from("case_timeline").insert({
    case_id: data.id,
    event_date: today,
    event: "rejected",
    note: reason,
    actor: "human_reviewer",
  });
  if (timelineErr) {
    console.warn(
      "[cases-api] reject succeeded but timeline insert failed:",
      timelineErr,
    );
  }
}

export async function createCaseInSupabase(params: {
  caseId: string;
  caseType: string;
  applicantName: string;
  applicantReference: string;
  createdDate: string;
  uploadedFolder?: string;
}): Promise<void> {
  const supabase = createClient();

  const { data: applicant, error: applicantErr } = await supabase
    .from("applicants")
    .insert({
      name: params.applicantName,
      reference: params.applicantReference,
      date_of_birth: null,
    })
    .select("id")
    .single();

  if (applicantErr) {
    throw new Error(`applicant insert failed: ${applicantErr.message}`);
  }

  const notes = params.uploadedFolder
    ? `Uploaded to uploads-quarantine/${params.uploadedFolder}`
    : "";

  const { error: caseErr } = await supabase.from("cases").insert({
    case_id: params.caseId,
    case_type: params.caseType,
    status: "processing",
    state: "processing",
    applicant_id: applicant.id,
    assigned_to: "unassigned",
    case_notes: notes,
    created_date: params.createdDate,
  });

  if (caseErr) {
    throw new Error(`case insert failed: ${caseErr.message}`);
  }
}

export async function fetchCasesFromSupabase(): Promise<EnrichedCase[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cases")
    .select(CASE_SELECT)
    .order("created_date", { ascending: false });

  if (error) throw error;
  return (data as unknown as CaseRow[] | null)?.map(toEnriched) ?? [];
}

export async function fetchQuarantinedCasesFromSupabase(): Promise<
  EnrichedCase[]
> {
  const supabase = createClient();
  // Match whichever column the agent wrote to: ai_status OR the workflow
  // status/state column. Supabase .or() takes a PostgREST filter string.
  const { data, error } = await supabase
    .from("cases")
    .select(CASE_SELECT)
    .or("ai_status.eq.quarantined,status.eq.quarantined,state.eq.quarantined")
    .order("created_date", { ascending: false });

  if (error) throw error;
  return (data as unknown as CaseRow[] | null)?.map(toEnriched) ?? [];
}
