"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { supabaseEnabled } from "@/lib/supabase/client";
import {
  fetchPoliciesFromSupabase,
  formatFileSize,
  type PolicyDocument,
} from "@/lib/policies-api";
import { formatDate } from "@/lib/utils";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; policies: PolicyDocument[] }
  | { status: "error"; message: string };

function prettyName(path: string) {
  const last = path.split("/").pop() ?? path;
  return last.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
}

function extension(path: string) {
  const m = path.match(/\.([^.]+)$/);
  return m ? m[1].toUpperCase() : "FILE";
}

// Dummy handlers — uploads/deletes are done directly in the Supabase dashboard.
// Buttons are present for visual completeness and to mark where CRUD would live.
const noop = () => {};

export function PoliciesPage() {
  const [state, setState] = useState<State>({ status: "idle" });

  useEffect(() => {
    if (!supabaseEnabled()) {
      setState({
        status: "error",
        message:
          "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to show policy documents.",
      });
      return;
    }
    setState({ status: "loading" });
    fetchPoliciesFromSupabase()
      .then((policies) => setState({ status: "ready", policies }))
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "Failed to load policies.";
        setState({ status: "error", message });
      });
  }, []);

  return (
    <div>
      <PageHeader
        caption="Configuration"
        title="Policies"
        description="Institution prioritisation frameworks, guidance documents, and handbooks. Triage decisions must be reproducible against the framework version in force at the time — these documents are the canonical record."
        actions={<Button onClick={noop}>Upload policy</Button>}
      />

      {state.status === "loading" && (
        <p className="text-govuk-dark-grey dark:text-govuk-mid-grey">
          Loading policy documents…
        </p>
      )}

      {state.status === "error" && (
        <div className="border-l-[5px] border-govuk-red bg-govuk-white p-4 dark:bg-govuk-black">
          <p className="text-base font-bold text-govuk-red">
            There is a problem
          </p>
          <p className="mt-1 text-sm text-govuk-black dark:text-govuk-white">
            {state.message}
          </p>
        </div>
      )}

      {state.status === "ready" && state.policies.length === 0 && (
        <div className="border-l-[10px] border-govuk-blue bg-govuk-light-grey p-4 dark:bg-[#1a1a1a]">
          <p className="text-base text-govuk-black dark:text-govuk-white">
            No policy documents have been uploaded to the{" "}
            <code className="bg-govuk-white px-1 dark:bg-govuk-black">
              policy-documents
            </code>{" "}
            bucket yet.
          </p>
        </div>
      )}

      {state.status === "ready" && state.policies.length > 0 && (
        <>
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">
              Policy documents available in the policy-documents Supabase bucket
            </caption>
            <thead>
              <tr className="border-b-[1px] border-govuk-mid-grey">
                <th
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 align-bottom text-sm font-bold text-govuk-black dark:text-govuk-white"
                >
                  Document
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 align-bottom text-sm font-bold text-govuk-black dark:text-govuk-white"
                >
                  Type
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 align-bottom text-sm font-bold text-govuk-black dark:text-govuk-white"
                >
                  Size
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 align-bottom text-sm font-bold text-govuk-black dark:text-govuk-white"
                >
                  Last updated
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 align-bottom text-right text-sm font-bold text-govuk-black dark:text-govuk-white"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {state.policies.map((p) => (
                <tr
                  key={p.path}
                  className="border-b-[1px] border-govuk-mid-grey align-middle"
                >
                  <td className="px-4 py-3 text-sm">
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-govuk-blue underline decoration-1 underline-offset-[0.1em] hover:decoration-[3px] dark:text-govuk-light-blue"
                    >
                      {prettyName(p.path)}
                    </a>
                    <div className="mt-0.5 text-xs text-govuk-dark-grey dark:text-govuk-mid-grey">
                      {p.path}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-govuk-black dark:text-govuk-white">
                    {extension(p.path)}
                  </td>
                  <td className="px-4 py-3 text-sm text-govuk-black dark:text-govuk-white">
                    {formatFileSize(p.size)}
                  </td>
                  <td className="px-4 py-3 text-sm text-govuk-black dark:text-govuk-white">
                    {formatDate(p.updatedAt ?? p.createdAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={noop}>
                        Replace
                      </Button>
                      <Button size="sm" variant="destructive" onClick={noop}>
                        Remove
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="mt-6 text-sm text-govuk-dark-grey dark:text-govuk-mid-grey">
            {state.policies.length} document
            {state.policies.length === 1 ? "" : "s"} · Source: Supabase bucket{" "}
            <code className="bg-govuk-light-grey px-1 dark:bg-[#2a2a2a]">
              policy-documents
            </code>
            .
          </p>
        </>
      )}
    </div>
  );
}
