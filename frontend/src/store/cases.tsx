"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { EnrichedCase } from "@/types";
import { QUARANTINED_CASES, buildEnrichedCases } from "@/data/cases";
import {
  approveCaseInSupabase,
  fetchCasesFromSupabase,
  rejectCaseInSupabase,
} from "@/lib/cases-api";
import { supabaseEnabled } from "@/lib/supabase/client";

type CasesSource = "fixtures" | "supabase";

type CasesContextValue = {
  pending: EnrichedCase[];
  approved: EnrichedCase[];
  quarantined: EnrichedCase[];
  approve: (id: string) => Promise<void>;
  reject: (id: string, reason: string) => Promise<void>;
  reinstate: (id: string) => void;
  addCase: (c: EnrichedCase) => void;
  refresh: () => Promise<void>;
  source: CasesSource;
  loading: boolean;
  error: string | null;
};

const CasesContext = createContext<CasesContextValue | null>(null);

export function CasesProvider({ children }: { children: ReactNode }) {
  const fixtureCases = useMemo(
    () => [...buildEnrichedCases(), ...QUARANTINED_CASES],
    [],
  );

  const [cases, setCases] = useState<EnrichedCase[]>(fixtureCases);
  const [source, setSource] = useState<CasesSource>("fixtures");
  const [loading, setLoading] = useState<boolean>(supabaseEnabled());
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!supabaseEnabled()) return;
    setLoading(true);
    try {
      const rows = await fetchCasesFromSupabase();
      setCases(rows);
      setSource("supabase");
      setError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load cases";
      console.error("[cases] Supabase fetch failed, using fixtures:", err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabaseEnabled()) return;
    void refresh();
  }, [refresh]);

  const approve = useCallback(async (id: string) => {
    if (supabaseEnabled()) {
      await approveCaseInSupabase(id);
    }
    const nowIso = new Date().toISOString();
    setCases((prev) =>
      prev.map((c) =>
        c.case_id === id
          ? { ...c, ai_status: "published", last_updated: nowIso }
          : c,
      ),
    );
  }, []);

  const reject = useCallback(async (id: string, reason: string) => {
    if (supabaseEnabled()) {
      await rejectCaseInSupabase(id, reason);
    }
    const nowIso = new Date().toISOString();
    setCases((prev) =>
      prev.map((c) =>
        c.case_id === id
          ? {
              ...c,
              ai_status: "rejected",
              rejection_reason: reason,
              last_updated: nowIso,
            }
          : c,
      ),
    );
  }, []);

  const reinstate = useCallback((id: string) => {
    setCases((prev) =>
      prev.map((c) =>
        c.case_id === id
          ? { ...c, ai_status: "draft", state: "case_created" }
          : c,
      ),
    );
  }, []);

  const addCase = useCallback((c: EnrichedCase) => {
    setCases((prev) => [c, ...prev]);
  }, []);

  // Quarantine is sourced from whichever column the agent populated: ai_status,
  // the workflow status, or the derived state. Pending/approved explicitly
  // exclude quarantined rows so a quarantined case can never double-show.
  const isQuarantined = (c: EnrichedCase) =>
    c.ai_status === "quarantined" ||
    c.status === "quarantined" ||
    c.state === "quarantined";

  const quarantined = cases.filter(isQuarantined);
  const pending = cases.filter(
    (c) =>
      !isQuarantined(c) &&
      (c.ai_status === "draft" ||
        c.ai_status === "rejected" ||
        c.ai_status === "processing"),
  );
  const approved = cases.filter(
    (c) => !isQuarantined(c) && c.ai_status === "published",
  );

  return (
    <CasesContext.Provider
      value={{
        pending,
        approved,
        quarantined,
        approve,
        reject,
        reinstate,
        addCase,
        refresh,
        source,
        loading,
        error,
      }}
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
