"use client";

import { useState } from "react";
import { AlertTriangle, Check, Copy, X } from "lucide-react";
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
import {
  AI_STATUS_META,
  getStateColor,
  getWorkflowState,
} from "@/data/cases";
import { badgeColor, cn, formatDate } from "@/lib/utils";
import type { EnrichedCase } from "@/types";

interface CaseDetailModalProps {
  caseItem: EnrichedCase | null;
  onClose: () => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  readOnly?: boolean;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div>{children}</div>
    </section>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-sm text-foreground">{value}</div>
    </div>
  );
}

function ScorePill({ score }: { score: number }) {
  const color =
    score >= 75 ? "red" : score >= 50 ? "amber" : score >= 30 ? "sky" : "emerald";
  return (
    <Badge variant="outline" className={cn(badgeColor(color), "border")}>
      {score}
    </Badge>
  );
}

export function CaseDetailModal({
  caseItem,
  onClose,
  onApprove,
  onReject,
  readOnly,
}: CaseDetailModalProps) {
  const [copied, setCopied] = useState(false);

  if (!caseItem) return null;

  const stateMeta = getWorkflowState(caseItem.case_type, caseItem.state);
  const stateLabel = stateMeta?.label ?? caseItem.state;
  const stateColor = getStateColor(caseItem.state);
  const aiMeta = AI_STATUS_META[caseItem.ai_status];

  const copyExplanation = async () => {
    await navigator.clipboard.writeText(caseItem.explanation);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <Dialog open={!!caseItem} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <span>{caseItem.case_id}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-sm font-normal capitalize text-muted-foreground">
              {caseItem.case_type.replace(/_/g, " ")}
            </span>
          </DialogTitle>
          <DialogDescription>{caseItem.applicant.name}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] space-y-6 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-4 gap-4 rounded-lg bg-muted p-4">
            <KV
              label="State"
              value={
                <Badge
                  variant="outline"
                  className={cn(badgeColor(stateColor), "border")}
                >
                  {stateLabel}
                </Badge>
              }
            />
            <KV
              label="AI Status"
              value={
                <Badge
                  variant="outline"
                  className={cn(badgeColor(aiMeta.color), "border")}
                >
                  {aiMeta.label}
                </Badge>
              }
            />
            <KV label="Score" value={<ScorePill score={caseItem.score} />} />
            <KV label="Assigned to" value={caseItem.assigned_to} />
          </div>

          <Section title="AI Explanation">
            <div className="relative rounded-lg border bg-card p-3 pr-10 text-sm leading-relaxed text-foreground">
              {caseItem.explanation}
              <button
                onClick={copyExplanation}
                className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                title="Copy explanation"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            {caseItem.rejection_reason && (
              <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                <div className="text-[11px] font-semibold uppercase tracking-wider">
                  Rejection reason
                </div>
                <div className="mt-1">{caseItem.rejection_reason}</div>
              </div>
            )}
          </Section>

          {caseItem.required_action && (
            <Section title="Required action">
              <div
                className={cn(
                  "flex gap-3 rounded-lg border p-3 text-sm",
                  caseItem.required_action.severity === "critical"
                    ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-100"
                    : caseItem.required_action.severity === "warning"
                      ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100"
                      : "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-100",
                )}
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-1">
                  <div className="font-medium">
                    {caseItem.required_action.label}
                  </div>
                  {caseItem.required_action.items.length > 0 && (
                    <ul className="list-disc space-y-0.5 pl-5 text-xs leading-relaxed">
                      {caseItem.required_action.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </Section>
          )}

          {stateMeta && (
            <Section title={`${stateLabel} — policy requirements`}>
              <div className="rounded-lg border bg-card p-3 text-sm text-foreground">
                <div className="text-muted-foreground">
                  {stateMeta.description}
                </div>
                {stateMeta.required_actions.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                    {stateMeta.required_actions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                )}
                {stateMeta.escalation_thresholds && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Thresholds —
                    {stateMeta.escalation_thresholds.reminder_days !== undefined &&
                      ` reminder at ${stateMeta.escalation_thresholds.reminder_days} days`}
                    {stateMeta.escalation_thresholds.escalation_days !== undefined &&
                      `, escalation at ${stateMeta.escalation_thresholds.escalation_days} days`}
                    .
                  </div>
                )}
              </div>
            </Section>
          )}

          <Section title="Applicant">
            <div className="grid grid-cols-3 gap-4">
              <KV label="Name" value={caseItem.applicant.name} />
              <KV label="Reference" value={caseItem.applicant.reference} />
              <KV
                label="Date of birth"
                value={formatDate(caseItem.applicant.date_of_birth)}
              />
            </div>
          </Section>

          <Section title="Case Notes">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {caseItem.case_notes}
            </p>
          </Section>

          <Section title="Timeline">
            <ol className="relative space-y-3 border-l pl-4">
              {caseItem.timeline.map((t, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[22px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-muted-foreground" />
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {formatDate(t.date)} · {t.event.replace(/_/g, " ")}
                  </div>
                  <div className="text-sm text-foreground">{t.note}</div>
                </li>
              ))}
            </ol>
          </Section>

          <Separator />

          <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
            <div>
              Created: {formatDate(caseItem.created_date)}
            </div>
            <div>
              Last updated: {formatDate(caseItem.last_updated)}
            </div>
          </div>
        </div>

        {!readOnly && (
          <DialogFooter className="border-t bg-muted/30 px-6 py-3">
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
