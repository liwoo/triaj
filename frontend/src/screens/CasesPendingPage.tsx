"use client";

import { useState } from "react";
import { PageHeader } from "@/components/Layout";
import { DataTable } from "@/components/DataTable";
import { buildCaseColumns } from "@/components/caseColumns";
import { CaseDetailModal } from "@/components/CaseDetailModal";
import { RejectDialog } from "@/components/RejectDialog";
import { useCases } from "@/store/cases";
import { AI_STATUS_META, allStateKeys, getWorkflowState } from "@/data/cases";
import type { EnrichedCase } from "@/types";

export function CasesPendingPage() {
  const { pending, approve, reject } = useCases();
  const [selected, setSelected] = useState<EnrichedCase | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);

  const columns = buildCaseColumns({
    onView: (c) => setSelected(c),
    onApprove: (c) => approve(c.case_id),
    onReject: (c) => setRejectId(c.case_id),
  });

  const caseTypes = Array.from(new Set(pending.map((c) => c.case_type))).map(
    (v) => ({ value: v, label: v.replace(/_/g, " ") }),
  );

  const stateOptions = allStateKeys().map((s) => {
    const label =
      getWorkflowState("benefit_review", s)?.label ??
      getWorkflowState("licence_application", s)?.label ??
      getWorkflowState("compliance_check", s)?.label ??
      s.replace(/_/g, " ");
    return { value: s, label };
  });

  return (
    <div>
      <PageHeader
        title="Pending review"
        description="AI-triaged cases awaiting human approval. Every decision is explainable and auditable."
      />

      <DataTable<EnrichedCase>
        data={pending}
        columns={columns}
        searchPlaceholder="Search by case ID, applicant, notes…"
        globalFilterKeys={["case_id", "case_type", "case_notes", "state"]}
        columnFilters={[
          {
            columnId: "case_type",
            label: "Type",
            options: caseTypes,
          },
          {
            columnId: "state",
            label: "State",
            options: stateOptions,
          },
          {
            columnId: "ai_status",
            label: "Status",
            options: (["draft", "rejected"] as const).map((k) => ({
              value: k,
              label: AI_STATUS_META[k].label,
            })),
          },
        ]}
        emptyMessage="No cases pending review."
      />

      <CaseDetailModal
        caseItem={selected}
        onClose={() => setSelected(null)}
        onApprove={(id) => {
          approve(id);
          setSelected(null);
        }}
        onReject={(id) => {
          setSelected(null);
          setRejectId(id);
        }}
      />

      <RejectDialog
        caseId={rejectId}
        onClose={() => setRejectId(null)}
        onConfirm={(id, reason) => {
          reject(id, reason);
          setRejectId(null);
        }}
      />
    </div>
  );
}
