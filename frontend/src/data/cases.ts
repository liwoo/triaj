import rawCases from "@data/sample-cases.json";
import statesFile from "@data/states.json";
import type {
  AiStatus,
  EnrichedCase,
  RawCase,
  RequiredAction,
  StatesFile,
  WorkflowState,
} from "@/types";

export const STATES = statesFile as StatesFile;

export function getWorkflowState(
  caseType: string,
  stateKey: string,
): WorkflowState | undefined {
  return STATES.case_types[caseType]?.states.find((s) => s.state === stateKey);
}

export function getStatesForCaseType(caseType: string): WorkflowState[] {
  return STATES.case_types[caseType]?.states ?? [];
}

export function allStateKeys(): string[] {
  const set = new Set<string>();
  for (const ct of Object.values(STATES.case_types)) {
    for (const s of ct.states) set.add(s.state);
  }
  return Array.from(set);
}

const STATE_COLORS: Record<string, string> = {
  case_created: "slate",
  awaiting_evidence: "amber",
  under_review: "indigo",
  pending_decision: "indigo",
  escalated: "red",
  closed: "emerald",
  quarantined: "stone",
};

export function getStateColor(stateKey: string): string {
  return STATE_COLORS[stateKey] ?? "slate";
}

type AiStatusMeta = { label: string; color: string };

const AI_STATUS_DEFINITIONS: Record<string, AiStatusMeta> = {
  draft: { label: "Draft", color: "amber" },
  published: { label: "Published", color: "emerald" },
  rejected: { label: "Rejected", color: "red" },
  quarantined: { label: "Quarantined", color: "stone" },
};

function titleCase(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getAiStatusMeta(status: AiStatus): AiStatusMeta {
  return (
    AI_STATUS_DEFINITIONS[status] ?? {
      label: titleCase(status),
      color: "slate",
    }
  );
}

export const AI_STATUS_META = new Proxy(AI_STATUS_DEFINITIONS, {
  get: (target, prop: string) =>
    target[prop] ?? { label: titleCase(prop), color: "slate" },
}) as Record<string, AiStatusMeta>;

const REQUIRED_ACTIONS: Record<string, RequiredAction> = {
  "CASE-2026-00042": {
    label: "Evidence outstanding",
    severity: "info",
    items: [
      "Proof of new address (utility bill or tenancy agreement)",
      "Updated bank details for benefit payment",
    ],
  },
  "CASE-2026-00158": {
    label: "Evidence outstanding",
    severity: "warning",
    items: [
      "Annual income declaration (2025/26)",
      "Signed consent form for age-related review (POL-BR-015)",
    ],
  },
  "CASE-2026-00214": {
    label: "Overdue — escalation required",
    severity: "critical",
    items: [
      "Original evidence request (56+ days overdue)",
      "Team leader review per framework section 2.6",
      "Consider interim suspension",
    ],
  },
  "CASE-2026-00231": {
    label: "Review required",
    severity: "info",
    items: [
      "Review two public objections on file",
      "Assess applicant's revised noise-mitigation plan",
    ],
  },
  "CASE-2026-00248": {
    label: "Follow-up required",
    severity: "warning",
    items: [
      "Investigate 6-week incident log gap (autumn 2025)",
      "Request whistleblower corroboration if available",
    ],
  },
};

const EXPLANATIONS: Record<string, { score: number; explanation: string }> = {
  "CASE-2026-00042": {
    score: 42,
    explanation:
      "Framework section 2.1 (Change of Circumstances): medium priority. Applicant relocated and opened a new claim — routine change of address with outstanding evidence. No vulnerability markers on file. Framework section 3.4 requires standard 28-day reminder cycle.",
  },
  "CASE-2026-00091": {
    score: 31,
    explanation:
      "Framework section 4.2 (Licence Applications — Low Risk): low priority. Clean 4-year licensing history, inspection passed with no concerns, no objections received. Framework section 4.3 permits fast-track review where all indicators are green.",
  },
  "CASE-2026-00107": {
    score: 88,
    explanation:
      "Framework section 1.1 (Public Safety — First-Order Escalation): high priority. Two confirmed regulatory breaches including staff operating without required qualifications in a care context. Framework section 1.2 mandates immediate escalation where vulnerable adults may be at risk.",
  },
  "CASE-2026-00133": {
    score: 18,
    explanation:
      "Framework section 2.3 (Straightforward Award Adjustment): low priority. Documented change of employment, evidence complete, policy criteria clearly met. Framework section 2.5 treats this as a fast-track pattern.",
  },
  "CASE-2026-00158": {
    score: 55,
    explanation:
      "Framework section 2.2 (Annual Reassessment): medium priority. Applicant age 58 triggers framework section 5.1 soft-vulnerability flag for age-related review considerations. Evidence request outstanding but within 28-day window.",
  },
  "CASE-2026-00172": {
    score: 12,
    explanation:
      "Framework section 4.1 (Renewal — Clean History): lowest priority. 5-year clean record, no objections, no conditions. Framework section 4.4 classifies this as administrative — already closed.",
  },
  "CASE-2026-00199": {
    score: 28,
    explanation:
      "Framework section 3.1 (Routine Scheduled Compliance): low priority. Last inspection 18 months ago with no issues found. No adverse signals. Framework section 3.2 permits standard 28-day response window without expediting.",
  },
  "CASE-2026-00214": {
    score: 72,
    explanation:
      "Framework section 2.4 (Unresponsive Applicant — Extended Non-Compliance): high priority. Evidence outstanding 64 days, exceeds policy POL-BR-003 56-day threshold. Framework section 2.6 requires team leader review and consideration of interim suspension.",
  },
  "CASE-2026-00231": {
    score: 47,
    explanation:
      "Framework section 4.5 (Licence Application with Objections): medium priority. Two public objections received relating to noise — framework section 4.6 requires balanced review of objections against applicant's revised mitigation plan before decision.",
  },
  "CASE-2026-00248": {
    score: 64,
    explanation:
      "Framework section 3.3 (Whistleblower-Triggered Compliance): elevated priority. Documentation largely compliant but a 6-week incident log gap in autumn 2025 warrants framework section 3.5 follow-up. Not currently first-order but not routine.",
  },
};

function inferAiStatus(c: RawCase): AiStatus {
  if (c.status === "closed") return "published";
  return "draft";
}

export function buildEnrichedCases(): EnrichedCase[] {
  const raw = rawCases as RawCase[];
  return raw.map((c) => {
    const override = EXPLANATIONS[c.case_id];
    return {
      ...c,
      state: c.status,
      score: override?.score ?? 50,
      ai_status: inferAiStatus(c),
      explanation:
        override?.explanation ??
        "Framework match not available for this case in the demo dataset.",
      required_action: REQUIRED_ACTIONS[c.case_id],
    };
  });
}

export const QUARANTINED_CASES: EnrichedCase[] = [
  {
    case_id: "CASE-2026-00301",
    case_type: "unknown",
    status: "quarantined",
    applicant: {
      name: "[unparseable]",
      reference: "—",
      date_of_birth: null,
    },
    assigned_to: "—",
    created_date: "2026-04-05",
    last_updated: "2026-04-05",
    timeline: [
      {
        date: "2026-04-05",
        event: "quarantined",
        note: "Folder contained only a corrupted .eml file and no parseable attachments.",
      },
    ],
    case_notes: "Pre-processing rejected this case — no readable content.",
    state: "quarantined",
    score: 0,
    ai_status: "quarantined",
    explanation:
      "Quarantined by pre-processing. Reason: no processable content detected in the uploaded folder. Eligible for human reinstatement.",
  },
  {
    case_id: "CASE-2026-00304",
    case_type: "unknown",
    status: "quarantined",
    applicant: {
      name: "[missing]",
      reference: "—",
      date_of_birth: null,
    },
    assigned_to: "—",
    created_date: "2026-04-08",
    last_updated: "2026-04-08",
    timeline: [
      {
        date: "2026-04-08",
        event: "quarantined",
        note: "Submission is a vendor marketing email, not a complaint.",
      },
    ],
    case_notes: "Pre-processing classified this as out of scope (promotional content).",
    state: "quarantined",
    score: 0,
    ai_status: "quarantined",
    explanation:
      "Quarantined by pre-processing. Reason: classified as out-of-scope marketing communication. Eligible for human reinstatement if misclassified.",
  },
];
