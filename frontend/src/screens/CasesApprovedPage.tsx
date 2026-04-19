"use client";

import { useState } from "react";
import { PageHeader } from "@/components/Layout";
import { DataTable } from "@/components/DataTable";
import { buildCaseColumns } from "@/components/caseColumns";
import { CaseDetailModal } from "@/components/CaseDetailModal";
import { useCases } from "@/store/cases";
import type { EnrichedCase } from "@/types";

export function CasesApprovedPage() {
  const { approved } = useCases();
  const [selected, setSelected] = useState<EnrichedCase | null>(null);

  const columns = buildCaseColumns({
    onView: (c) => setSelected(c),
    readOnly: true,
  });

  const caseTypes = Array.from(new Set(approved.map((c) => c.case_type))).map(
    (v) => ({ value: v, label: v.replace(/_/g, " ") }),
  );

  return (
    <div>
      <PageHeader
        title="Approved"
        description="Published case records — read-only audit trail of human-approved AI triage decisions."
      />

      <DataTable<EnrichedCase>
        data={approved}
        columns={columns}
        searchPlaceholder="Search approved cases…"
        rowClassName={(row) =>
          row.status === "processing" || row.state === "processing"
            ? "row-processing"
            : undefined
        }
        columnFilters={[
          {
            columnId: "case_type",
            label: "Type",
            options: caseTypes,
          },
        ]}
        emptyMessage="No approved cases yet."
      />

      <CaseDetailModal
        caseItem={selected}
        onClose={() => setSelected(null)}
        readOnly
      />
    </div>
  );
}
