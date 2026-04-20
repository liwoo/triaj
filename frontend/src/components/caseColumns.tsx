"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertTriangle,
  Check,
  Copy,
  Eye,
  MoreHorizontal,
  RotateCcw,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AI_STATUS_META,
  getStateColor,
  getWorkflowState,
} from "@/data/cases";
import { badgeColor, cn, formatDate } from "@/lib/utils";
import type { EnrichedCase, RequiredAction } from "@/types";

export interface CaseColumnActions {
  onView: (c: EnrichedCase) => void;
  onApprove?: (c: EnrichedCase) => void;
  onReject?: (c: EnrichedCase) => void;
  onReinstate?: (c: EnrichedCase) => void;
  readOnly?: boolean;
}

const REQUIRED_ACTION_TONE: Record<
  NonNullable<RequiredAction["severity"]>,
  string
> = {
  info: "text-sky-600 hover:text-sky-700",
  warning: "text-amber-600 hover:text-amber-700",
  critical: "text-red-600 hover:text-red-700",
};

function RequiredActionIndicator({ action }: { action: RequiredAction }) {
  const tone =
    REQUIRED_ACTION_TONE[action.severity ?? "warning"] ??
    REQUIRED_ACTION_TONE.warning;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={cn(
              "inline-flex h-5 w-5 items-center justify-center rounded-full transition",
              tone,
            )}
            aria-label={action.label}
            type="button"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider">
            {action.label}
          </div>
          {action.items.length > 0 && (
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs leading-relaxed">
              {action.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const STATUS_DOT: Record<string, string> = {
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  red: "bg-red-500",
  stone: "bg-stone-400",
  slate: "bg-slate-400",
  sky: "bg-sky-500",
  indigo: "bg-indigo-500",
};

function ScorePill({ score }: { score: number }) {
  const color =
    score >= 75 ? "red" : score >= 50 ? "amber" : score >= 30 ? "sky" : "emerald";
  return (
    <span className="inline-flex items-center gap-2">
      <Badge variant="outline" className={cn(badgeColor(color), "border")}>
        {score}
      </Badge>
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-foreground"
          style={{ width: `${Math.min(100, score)}%` }}
        />
      </span>
    </span>
  );
}

function CaseIdCell({
  caseId,
  onView,
}: {
  caseId: string;
  onView: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(caseId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  return (
    <div className="group inline-flex items-center gap-1.5">
      <button
        onClick={onView}
        className="font-medium hover:text-muted-foreground hover:underline"
      >
        {caseId}
      </button>
      <TooltipProvider delayDuration={200}>
        <Tooltip open={copied || undefined}>
          <TooltipTrigger asChild>
            <button
              onClick={handleCopy}
              className="rounded p-1 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100 focus:opacity-100"
              aria-label="Copy case ID"
            >
              {copied ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {copied ? "Copied" : "Copy case ID"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

function ExplanationHoverCard({ explanation }: { explanation: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    await navigator.clipboard.writeText(explanation);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };
  return (
    <HoverCard openDelay={100} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button className="text-xs text-primary underline decoration-dotted underline-offset-2 hover:opacity-80">
          view
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-96 text-xs leading-relaxed" align="start">
        <div className="max-h-64 overflow-auto whitespace-pre-wrap">
          {explanation}
        </div>
        <div className="mt-2 flex justify-end border-t pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCopy}
            className="h-7 px-2 text-[11px]"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" /> Copy
              </>
            )}
          </Button>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function ActionsMenu({
  row,
  onView,
  onApprove,
  onReject,
  onReinstate,
  readOnly,
}: {
  row: EnrichedCase;
} & CaseColumnActions) {
  const canApprove = !readOnly && onApprove && row.ai_status !== "published";
  const canReject = !readOnly && onReject && row.ai_status !== "rejected";
  const canReinstate = !!onReinstate;

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            aria-label="Row actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => onView(row)}>
            <Eye className="h-3.5 w-3.5" />
            View details
          </DropdownMenuItem>
          {(canApprove || canReject || canReinstate) && (
            <DropdownMenuSeparator />
          )}
          {canApprove && (
            <DropdownMenuItem onClick={() => onApprove!(row)}>
              <Check className="h-3.5 w-3.5" />
              Approve
            </DropdownMenuItem>
          )}
          {canReject && (
            <DropdownMenuItem
              onClick={() => onReject!(row)}
              className="text-destructive focus:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
              Reject
            </DropdownMenuItem>
          )}
          {canReinstate && (
            <DropdownMenuItem onClick={() => onReinstate!(row)}>
              <RotateCcw className="h-3.5 w-3.5" />
              Reinstate
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function buildCaseColumns({
  onView,
  onApprove,
  onReject,
  onReinstate,
  readOnly,
}: CaseColumnActions): ColumnDef<EnrichedCase, any>[] {
  return [
    {
      accessorKey: "case_id",
      header: "Case ID",
      cell: (info) => {
        const c = info.row.original;
        const humanReviewed =
          c.ai_status === "published" || c.ai_status === "rejected";
        return (
          <span className="inline-flex items-center gap-1.5">
            {!humanReviewed && (
              <span title="Pending human review" className="text-sm leading-none">
                🤖
              </span>
            )}
            <CaseIdCell
              caseId={info.getValue() as string}
              onView={() => onView(c)}
            />
          </span>
        );
      },
    },
    {
      id: "applicant",
      header: "Applicant",
      accessorFn: (r) => r.applicant.name,
      cell: (info) => (
        <span className="inline-flex items-center gap-2 whitespace-nowrap">
          <span>{info.row.original.applicant.name}</span>
          <span className="text-muted-foreground/60">·</span>
          <span className="text-[11px] text-muted-foreground">
            {info.row.original.applicant.reference}
          </span>
        </span>
      ),
    },
    {
      accessorKey: "case_type",
      header: "Type",
      cell: (info) => (
        <span className="capitalize">
          {(info.getValue() as string).replace(/_/g, " ")}
        </span>
      ),
      filterFn: (row, id, value) =>
        !value || row.getValue(id) === value,
    },
    {
      accessorKey: "state",
      header: "State",
      cell: (info) => {
        const c = info.row.original;
        const meta = getWorkflowState(c.case_type, c.state);
        const humanReviewed =
          c.ai_status === "published" || c.ai_status === "rejected";
        return (
          <span className="inline-flex items-center gap-1.5">
            {!humanReviewed && (
              <span className="inline-flex items-center rounded bg-indigo-100 px-1 py-0.5 text-[9px] font-bold uppercase leading-none tracking-wide text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                AI
              </span>
            )}
            <Badge
              variant="outline"
              className={cn(badgeColor(getStateColor(c.state)), "border")}
            >
              {meta?.label ?? c.state}
            </Badge>
            {c.required_action && (
              <RequiredActionIndicator action={c.required_action} />
            )}
          </span>
        );
      },
      filterFn: (row, id, value) =>
        !value || row.getValue(id) === value,
    },
    {
      accessorKey: "score",
      header: "Score",
      cell: (info) => <ScorePill score={info.getValue() as number} />,
      sortingFn: "basic",
    },
    {
      accessorKey: "ai_status",
      header: "Status",
      cell: (info) => {
        const meta = AI_STATUS_META[info.getValue() as keyof typeof AI_STATUS_META];
        return (
          <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs font-medium text-foreground">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                STATUS_DOT[meta.color] ?? "bg-slate-400",
              )}
            />
            {meta.label}
          </span>
        );
      },
      filterFn: (row, id, value) =>
        !value || row.getValue(id) === value,
    },
    {
      id: "explanation",
      header: "Explanation",
      accessorFn: (r) => r.explanation,
      enableSorting: false,
      cell: (info) => <ExplanationHoverCard explanation={info.row.original.explanation} />,
    },
    {
      accessorKey: "last_updated",
      header: "Updated",
      cell: (info) => (
        <span className="text-xs text-muted-foreground">
          {formatDate(info.getValue() as string)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      meta: { sticky: "right" },
      cell: (info) => (
        <ActionsMenu
          row={info.row.original}
          onView={onView}
          onApprove={onApprove}
          onReject={onReject}
          onReinstate={onReinstate}
          readOnly={readOnly}
        />
      ),
    },
  ];
}
