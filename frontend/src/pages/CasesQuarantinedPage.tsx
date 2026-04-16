"use client";

import { useState } from "react";
import { PageHeader } from "@/components/Layout";
import { DataTable } from "@/components/DataTable";
import { buildCaseColumns } from "@/components/caseColumns";
import { CaseDetailModal } from "@/components/CaseDetailModal";
import { useCases } from "@/store/cases";
import type { EnrichedCase } from "@/types";

export function CasesQuarantinedPage() {
  const { quarantined, reinstate } = useCases();
  const [selected, setSelected] = useState<EnrichedCase | null>(null);

  const columns = buildCaseColumns({
    onView: (c) => setSelected(c),
    onReinstate: (c) => reinstate(c.case_id),
    readOnly: true,
  });

  return (
    <div>
      <PageHeader
        title="Quarantined"
        description="Cases the ingestion pipeline couldn't process. Each has a recorded reason — nothing is silently discarded. Case managers can reinstate if misclassified."
      />

      <DataTable<EnrichedCase>
        data={quarantined}
        columns={columns}
        searchPlaceholder="Search quarantined cases…"
        globalFilterKeys={["case_id", "case_notes"]}
        emptyMessage="No cases currently quarantined."
      />

      <CaseDetailModal
        caseItem={selected}
        onClose={() => setSelected(null)}
        readOnly
      />
    </div>
  );
}
