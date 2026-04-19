"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Copy, ExternalLink, FileText, Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AI_STATUS_META,
  getStateColor,
  getWorkflowState,
} from "@/data/cases";
import { badgeColor, cn, formatDate } from "@/lib/utils";
import {
  fetchCaseDocuments,
  fileExtension,
  formatFileSize,
  type CaseDocument,
} from "@/lib/case-documents";
import { supabaseEnabled } from "@/lib/supabase/client";
import type { EnrichedCase } from "@/types";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface CaseDetailModalProps {
  caseItem: EnrichedCase | null;
  onClose: () => void;
  onApprove?: (id: string) => void | Promise<void>;
  onReject?: (id: string) => void;
  readOnly?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Small helpers                                                      */
/* ------------------------------------------------------------------ */

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wider text-govuk-dark-grey dark:text-govuk-mid-grey">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-govuk-black dark:text-govuk-white">
        {value ?? "—"}
      </dd>
    </div>
  );
}

function ScorePill({ score }: { score: number }) {
  const color =
    score >= 75 ? "red" : score >= 50 ? "amber" : score >= 30 ? "sky" : "emerald";
  return (
    <Badge variant="outline" className={cn(badgeColor(color))}>
      {score}
    </Badge>
  );
}

function hasRealExplanation(text: string | undefined | null): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return !(
    lower.includes("pending triage") ||
    lower.includes("no ai assessment") ||
    lower.includes("placeholder") ||
    lower.includes("not yet been run") ||
    lower.includes("not available for this case")
  );
}

/* ------------------------------------------------------------------ */
/*  JSON case_notes parser                                             */
/* ------------------------------------------------------------------ */

function tryParseJson(text: string): unknown | null {
  const trimmed = text.trim();
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

type ParsedComplaint = {
  category?: string;
  complainant?: Record<string, unknown>;
  interactions?: Array<Record<string, unknown>>;
  evidenceDocs?: string[];
  supportingDocs?: string[];
  raw?: Record<string, unknown>;
};

function parseNotes(notes: string): ParsedComplaint | null {
  if (!notes) return null;
  const outer = tryParseJson(notes);
  if (!outer || typeof outer !== "object") return null;
  const obj = outer as Record<string, unknown>;

  // The agent sometimes wraps everything in `anonymised_content`
  let data: Record<string, unknown>;
  const ac = obj.anonymised_content;
  if (typeof ac === "string") {
    const inner = tryParseJson(ac);
    data = (inner && typeof inner === "object" ? inner : obj) as Record<string, unknown>;
  } else if (ac && typeof ac === "object" && !Array.isArray(ac)) {
    data = ac as Record<string, unknown>;
  } else {
    data = obj;
  }

  const complainant =
    data.complainant && typeof data.complainant === "object" && !Array.isArray(data.complainant)
      ? (data.complainant as Record<string, unknown>)
      : undefined;

  const interactions = Array.isArray(data.interactions)
    ? (data.interactions as Array<Record<string, unknown>>)
    : undefined;

  const evidenceDocs = Array.isArray(data.evidence_documents)
    ? (data.evidence_documents as string[])
    : undefined;

  const supportingDocs = Array.isArray(data.supporting_documents)
    ? (data.supporting_documents as string[])
    : undefined;

  const category = typeof data.category === "string" ? data.category : undefined;

  return {
    category,
    complainant,
    interactions,
    evidenceDocs,
    supportingDocs,
    raw: data,
  };
}

const str = (v: unknown) => (v != null ? String(v) : null);

/* ------------------------------------------------------------------ */
/*  Tab: Overview                                                      */
/* ------------------------------------------------------------------ */

function OverviewTab({ c }: { c: EnrichedCase }) {
  const stateMeta = getWorkflowState(c.case_type, c.state);
  const stateLabel = stateMeta?.label ?? c.state?.replace(/_/g, " ") ?? "—";
  const stateColor = getStateColor(c.state);
  const aiMeta = AI_STATUS_META[c.ai_status];

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KV
          label="State"
          value={
            <Badge variant="outline" className={cn(badgeColor(stateColor))}>
              {stateLabel}
            </Badge>
          }
        />
        <KV
          label="AI status"
          value={
            <Badge variant="outline" className={cn(badgeColor(aiMeta.color))}>
              {aiMeta.label}
            </Badge>
          }
        />
        <KV label="Score" value={<ScorePill score={c.score} />} />
        <KV label="Assigned to" value={c.assigned_to} />
      </dl>

      <dl className="grid grid-cols-3 gap-4 border-t border-govuk-mid-grey pt-4 dark:border-white/10">
        <KV label="Applicant" value={c.applicant.name} />
        <KV label="Reference" value={c.applicant.reference} />
        <KV label="Date of birth" value={formatDate(c.applicant.date_of_birth)} />
      </dl>

      <dl className="grid grid-cols-2 gap-4 border-t border-govuk-mid-grey pt-4 dark:border-white/10">
        <KV label="Created" value={formatDate(c.created_date)} />
        <KV label="Last updated" value={formatDate(c.last_updated)} />
      </dl>

      {c.required_action && (
        <div
          className={cn(
            "flex gap-3 border-l-[5px] p-3 text-sm",
            c.required_action.severity === "critical"
              ? "border-govuk-red bg-govuk-light-red/30 dark:bg-[#942514]/20"
              : c.required_action.severity === "warning"
                ? "border-[#f47738] bg-[#fcd6c3]/30 dark:bg-[#6e3619]/20"
                : "border-govuk-blue bg-[#d2e2f1]/30 dark:bg-[#144e81]/20",
          )}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-bold">{c.required_action.label}</div>
            {c.required_action.items.length > 0 && (
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
                {c.required_action.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {stateMeta && (
        <div className="border-l-[5px] border-govuk-mid-grey bg-govuk-light-grey p-3 text-sm dark:bg-[#1a1a1a]">
          <div className="font-bold">
            {stateLabel} — policy requirements
          </div>
          <p className="mt-1 text-govuk-dark-grey dark:text-govuk-mid-grey">
            {stateMeta.description}
          </p>
          {stateMeta.required_actions.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs">
              {stateMeta.required_actions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab: AI Assessment                                                 */
/* ------------------------------------------------------------------ */

function AiTab({ c }: { c: EnrichedCase }) {
  const [copied, setCopied] = useState(false);
  const hasExplanation = hasRealExplanation(c.explanation);

  const onCopy = async () => {
    await navigator.clipboard.writeText(c.explanation);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="space-y-6">
      {hasExplanation ? (
        <div>
          <h3 className="text-sm font-bold text-govuk-black dark:text-govuk-white">
            AI explanation
          </h3>
          <div className="relative mt-2 border-l-[5px] border-govuk-blue bg-[#d2e2f1]/20 p-3 pr-10 text-sm leading-relaxed dark:bg-[#144e81]/20">
            {c.explanation}
            <button
              onClick={onCopy}
              className="absolute right-2 top-2 rounded-md p-1.5 text-govuk-dark-grey hover:bg-govuk-light-grey dark:hover:bg-[#2a2a2a]"
              title="Copy explanation"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      ) : (
        <div className="border-l-[5px] border-govuk-mid-grey bg-govuk-light-grey p-3 text-sm dark:bg-[#1a1a1a]">
          This case has not been assessed by the triage agent yet.
        </div>
      )}

      <dl className="grid grid-cols-3 gap-4">
        <KV label="Score" value={<ScorePill score={c.score} />} />
        <KV
          label="AI status"
          value={
            <Badge variant="outline" className={cn(badgeColor(AI_STATUS_META[c.ai_status].color))}>
              {AI_STATUS_META[c.ai_status].label}
            </Badge>
          }
        />
        <KV label="State" value={c.state?.replace(/_/g, " ") ?? "—"} />
      </dl>

      {c.rejection_reason && (
        <div className="border-l-[5px] border-govuk-red bg-govuk-light-red/30 p-3 text-sm dark:bg-[#942514]/20">
          <div className="font-bold">Rejection reason</div>
          <p className="mt-1">{c.rejection_reason}</p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab: Complaint                                                     */
/* ------------------------------------------------------------------ */

function ComplaintTab({ c }: { c: EnrichedCase }) {
  const parsed = c.case_notes ? parseNotes(c.case_notes) : null;

  if (!parsed) {
    if (!c.case_notes) {
      return (
        <p className="text-sm text-govuk-dark-grey dark:text-govuk-mid-grey">
          No case notes available.
        </p>
      );
    }
    return (
      <p className="whitespace-pre-wrap text-sm leading-relaxed">
        {c.case_notes}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {parsed.category && (
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-govuk-dark-grey dark:text-govuk-mid-grey">
            Category
          </span>
          <p className="mt-0.5 text-sm capitalize">
            {parsed.category.replace(/_/g, " ")}
          </p>
        </div>
      )}

      {parsed.complainant && (
        <div>
          <h3 className="text-sm font-bold">Complainant details</h3>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {str(parsed.complainant.name) && (
              <KV label="Name" value={str(parsed.complainant.name)} />
            )}
            {str(parsed.complainant.reference) && (
              <KV label="Reference" value={str(parsed.complainant.reference)} />
            )}
            {str(parsed.complainant.email) && (
              <KV label="Email" value={str(parsed.complainant.email)} />
            )}
            {str(parsed.complainant.phone) && (
              <KV label="Phone" value={str(parsed.complainant.phone)} />
            )}
            {str(parsed.complainant.date_of_birth) && (
              <KV label="Date of birth" value={formatDate(str(parsed.complainant.date_of_birth))} />
            )}
            {(() => {
              const addr = parsed.complainant?.address;
              if (!addr || typeof addr !== "object") return null;
              const parts = Object.values(addr as Record<string, string | null>).filter(Boolean);
              if (!parts.length) return null;
              return (
                <div className="col-span-2">
                  <KV label="Address" value={parts.join(", ")} />
                </div>
              );
            })()}
          </dl>
        </div>
      )}

      {parsed.interactions && parsed.interactions.length > 0 && (
        <div>
          <h3 className="text-sm font-bold">
            Correspondence ({parsed.interactions.length})
          </h3>
          <ol className="mt-3 space-y-4">
            {parsed.interactions.map((ix, i) => (
              <li key={i} className="border-l-[3px] border-govuk-mid-grey pl-3">
                <div className="flex flex-wrap gap-3 text-xs font-bold text-govuk-dark-grey dark:text-govuk-mid-grey">
                  <span>#{str(ix.interaction_number) ?? String(i + 1)}</span>
                  {str(ix.date) && <span>{str(ix.date)}</span>}
                  {str(ix.channel) && (
                    <span className="capitalize">
                      {str(ix.channel)!.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
                {str(ix.complaint) && (
                  <p className="mt-1.5 text-sm leading-relaxed">
                    {str(ix.complaint)}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {(parsed.evidenceDocs?.length || parsed.supportingDocs?.length) && (
        <div>
          <h3 className="text-sm font-bold">Referenced documents</h3>
          <table className="mt-2 w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-govuk-mid-grey">
                <th className="py-2 pr-4 text-xs font-bold">Document</th>
                <th className="py-2 pr-4 text-xs font-bold">Type</th>
              </tr>
            </thead>
            <tbody>
              {[
                ...(parsed.evidenceDocs ?? []).map((d) => ({ name: d, type: "Evidence" })),
                ...(parsed.supportingDocs ?? []).map((d) => ({ name: d, type: "Supporting" })),
              ].map((doc) => (
                <tr key={doc.name} className="border-b border-govuk-mid-grey/50">
                  <td className="py-2 pr-4 capitalize">
                    {doc.name.replace(/_/g, " ")}
                  </td>
                  <td className="py-2 pr-4">
                    <Badge variant="secondary">{doc.type}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-govuk-dark-grey dark:text-govuk-mid-grey">
            View uploaded files in the Documents tab.
          </p>
        </div>
      )}

      {!parsed.complainant && !parsed.interactions && parsed.raw && (
        <pre className="max-h-60 overflow-auto border bg-govuk-light-grey p-3 text-xs leading-relaxed dark:bg-[#1a1a1a]">
          {JSON.stringify(parsed.raw, null, 2)}
        </pre>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab: Timeline                                                      */
/* ------------------------------------------------------------------ */

function TimelineTab({ c }: { c: EnrichedCase }) {
  if (!c.timeline.length) {
    return (
      <p className="text-sm text-govuk-dark-grey dark:text-govuk-mid-grey">
        No timeline events recorded.
      </p>
    );
  }
  return (
    <ol className="relative space-y-4 border-l-[3px] border-govuk-mid-grey pl-5 dark:border-white/10">
      {c.timeline.map((t, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[26px] top-1.5 h-3 w-3 rounded-full border-[3px] border-govuk-white bg-govuk-dark-grey dark:border-govuk-black dark:bg-govuk-mid-grey" />
          <div className="text-xs font-bold uppercase tracking-wider text-govuk-dark-grey dark:text-govuk-mid-grey">
            {formatDate(t.date)} — {t.event.replace(/_/g, " ")}
          </div>
          <p className="mt-0.5 text-sm leading-relaxed">{t.note}</p>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab: Documents                                                     */
/* ------------------------------------------------------------------ */

function DocumentsTab({
  caseId,
  storageBucket,
  folderName,
}: {
  caseId: string;
  storageBucket?: string;
  folderName?: string;
}) {
  const [docs, setDocs] = useState<CaseDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseEnabled()) {
      setLoading(false);
      setError("Supabase is not configured — document listing unavailable.");
      return;
    }
    setLoading(true);
    fetchCaseDocuments(caseId, storageBucket, folderName)
      .then((files) => {
        setDocs(files);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : "Failed to load documents.",
        );
      })
      .finally(() => setLoading(false));
  }, [caseId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-govuk-dark-grey dark:text-govuk-mid-grey">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading documents…
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-l-[5px] border-govuk-red bg-govuk-white p-3 text-sm dark:bg-govuk-black">
        <p className="font-bold text-govuk-red">There is a problem</p>
        <p className="mt-1 text-govuk-black dark:text-govuk-white">{error}</p>
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="border-l-[5px] border-govuk-mid-grey bg-govuk-light-grey p-3 text-sm dark:bg-[#1a1a1a]">
        No uploaded documents found for this case.
      </div>
    );
  }

  return (
    <div>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-govuk-mid-grey">
            <th className="py-2 pr-4 text-xs font-bold text-govuk-black dark:text-govuk-white">
              File
            </th>
            <th className="py-2 pr-4 text-xs font-bold text-govuk-black dark:text-govuk-white">
              Type
            </th>
            <th className="py-2 pr-4 text-xs font-bold text-govuk-black dark:text-govuk-white">
              Size
            </th>
            <th className="py-2 pr-4 text-right text-xs font-bold text-govuk-black dark:text-govuk-white">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {docs.map((doc) => (
            <tr
              key={doc.path}
              className="border-b border-govuk-mid-grey/50 align-middle"
            >
              <td className="py-2.5 pr-4 text-sm">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-govuk-dark-grey" />
                  <div>
                    <div className="font-bold text-govuk-black dark:text-govuk-white">
                      {doc.name.replace(/_/g, " ").replace(/\.[^.]+$/, "")}
                    </div>
                    <div className="text-xs text-govuk-dark-grey dark:text-govuk-mid-grey">
                      {doc.name}
                    </div>
                  </div>
                </div>
              </td>
              <td className="py-2.5 pr-4 text-sm text-govuk-black dark:text-govuk-white">
                {fileExtension(doc.name)}
              </td>
              <td className="py-2.5 pr-4 text-sm text-govuk-black dark:text-govuk-white">
                {formatFileSize(doc.size)}
              </td>
              <td className="whitespace-nowrap py-2.5 text-right text-sm">
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-govuk-blue underline decoration-1 underline-offset-[0.1em] hover:decoration-[3px] dark:text-govuk-light-blue"
                >
                  Open <ExternalLink className="h-3 w-3" />
                  <span className="sr-only">
                    {doc.name} (opens in new tab)
                  </span>
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-govuk-dark-grey dark:text-govuk-mid-grey">
        {docs.length} file{docs.length === 1 ? "" : "s"}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main modal                                                         */
/* ------------------------------------------------------------------ */

export function CaseDetailModal({
  caseItem,
  onClose,
  onApprove,
  onReject,
  readOnly,
}: CaseDetailModalProps) {
  if (!caseItem) return null;

  const hasNotes = !!caseItem.case_notes;
  const hasTimeline = caseItem.timeline.length > 0;

  return (
    <Dialog open={!!caseItem} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden p-0">
        <DialogHeader className="border-b border-govuk-mid-grey px-6 py-4 dark:border-white/10">
          <DialogTitle className="text-[24px] font-bold leading-tight">
            {caseItem.case_id}
          </DialogTitle>
          <DialogDescription className="text-base capitalize">
            {caseItem.case_type.replace(/_/g, " ")} — {caseItem.applicant.name}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto px-6 py-4">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="ai">AI assessment</TabsTrigger>
              {hasNotes && (
                <TabsTrigger value="complaint">Complaint</TabsTrigger>
              )}
              <TabsTrigger value="documents">Documents</TabsTrigger>
              {hasTimeline && (
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="overview">
              <OverviewTab c={caseItem} />
            </TabsContent>

            <TabsContent value="ai">
              <AiTab c={caseItem} />
            </TabsContent>

            {hasNotes && (
              <TabsContent value="complaint">
                <ComplaintTab c={caseItem} />
              </TabsContent>
            )}

            <TabsContent value="documents">
              <DocumentsTab
                caseId={caseItem.case_id}
                storageBucket={caseItem.storage_bucket}
                folderName={caseItem.folder_name}
              />
            </TabsContent>

            {hasTimeline && (
              <TabsContent value="timeline">
                <TimelineTab c={caseItem} />
              </TabsContent>
            )}
          </Tabs>
        </div>

        {!readOnly && (
          <DialogFooter className="border-t border-govuk-mid-grey px-6 py-3 dark:border-white/10">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {onReject && (
              <Button
                variant="destructive"
                onClick={() => onReject(caseItem.case_id)}
              >
                <X className="h-3.5 w-3.5" /> Reject
              </Button>
            )}
            {onApprove && (
              <Button onClick={() => onApprove(caseItem.case_id)}>
                <Check className="h-3.5 w-3.5" /> Approve
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
