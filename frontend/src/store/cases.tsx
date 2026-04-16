"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { EnrichedCase } from "@/types";
import { QUARANTINED_CASES, buildEnrichedCases } from "@/data/cases";

type CasesContextValue = {
  pending: EnrichedCase[];
  approved: EnrichedCase[];
  quarantined: EnrichedCase[];
  approve: (id: string) => void;
  reject: (id: string, reason: string) => void;
  reinstate: (id: string) => void;
  addCase: (c: EnrichedCase) => void;
};

const CasesContext = createContext<CasesContextValue | null>(null);

export function CasesProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(() => buildEnrichedCases(), []);

  const [cases, setCases] = useState<EnrichedCase[]>(initial);
  const [quarantined, setQuarantined] =
    useState<EnrichedCase[]>(QUARANTINED_CASES);

  const approve = useCallback((id: string) => {
    setCases((prev) =>
      prev.map((c) => (c.case_id === id ? { ...c, ai_status: "published" } : c)),
    );
  }, []);

  const reject = useCallback((id: string, reason: string) => {
    setCases((prev) =>
      prev.map((c) =>
        c.case_id === id
          ? { ...c, ai_status: "rejected", rejection_reason: reason }
          : c,
      ),
    );
  }, []);

  const reinstate = useCallback((id: string) => {
    setQuarantined((prev) => {
      const found = prev.find((c) => c.case_id === id);
      if (!found) return prev;
      setCases((cs) => [
        ...cs,
        { ...found, ai_status: "draft", state: "case_created" },
      ]);
      return prev.filter((c) => c.case_id !== id);
    });
  }, []);

  const addCase = useCallback((c: EnrichedCase) => {
    setCases((prev) => [c, ...prev]);
  }, []);

  const pending = cases.filter(
    (c) => c.ai_status === "draft" || c.ai_status === "rejected",
  );
  const approved = cases.filter((c) => c.ai_status === "published");

  return (
    <CasesContext.Provider
      value={{ pending, approved, quarantined, approve, reject, reinstate, addCase }}
    >
      {children}
    </CasesContext.Provider>
  );
}

export function useCases() {
  const ctx = useContext(CasesContext);
  if (!ctx) throw new Error("useCases must be used within CasesProvider");
  return ctx;
}
