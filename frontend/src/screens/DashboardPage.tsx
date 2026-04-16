"use client";

import Link from "next/link";
import { PageHeader } from "@/components/Layout";
import { useCases } from "@/store/cases";
import { Badge } from "@/components/ui/badge";
import { getStateColor, getWorkflowState } from "@/data/cases";
import { badgeColor, cn } from "@/lib/utils";

export function DashboardPage() {
  const { pending, approved, quarantined } = useCases();
  const all = [...pending, ...approved];

  const urgent = all.filter((c) => c.score >= 75).length;
  const highScore = all.filter((c) => c.score >= 50 && c.score < 75).length;
  const avgScore =
    all.length > 0
      ? Math.round(all.reduce((sum, c) => sum + c.score, 0) / all.length)
      : 0;

  const byState = all.reduce<Record<string, { count: number; sample: string }>>(
    (acc, c) => {
      const key = c.state;
      if (!acc[key]) acc[key] = { count: 0, sample: c.case_type };
      acc[key].count += 1;
      return acc;
    },
    {},
  );

  return (
    <div>
      <PageHeader
        caption="Triaj"
        title="Complaints triage dashboard"
        description="Service health across the caseload — pending review, published decisions, and priority mix."
      />

      <div className="grid grid-cols-2 gap-0 border-t-[1px] border-govuk-mid-grey sm:grid-cols-4">
        <StatTile label="Pending review" value={pending.length} href="/cases/pending" />
        <StatTile label="Published" value={approved.length} href="/cases/approved" />
        <StatTile
          label="Quarantined"
          value={quarantined.length}
          href="/cases/quarantined"
        />
        <StatTile label="Avg. AI score" value={avgScore} />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="text-[24px] font-bold text-govuk-black dark:text-govuk-white">
            Priority mix
          </h2>
          <p className="mt-1 text-base text-govuk-dark-grey dark:text-govuk-mid-grey">
            AI scores across all pending and published cases.
          </p>
          <div className="mt-4 space-y-4">
            <Bar label="Urgent (≥75)" count={urgent} total={all.length} tone="red" />
            <Bar
              label="High (50–74)"
              count={highScore}
              total={all.length}
              tone="amber"
            />
            <Bar
              label="Standard (<50)"
              count={all.length - urgent - highScore}
              total={all.length}
              tone="green"
            />
          </div>
        </section>

        <section>
          <h2 className="text-[24px] font-bold text-govuk-black dark:text-govuk-white">
            By state
          </h2>
          <p className="mt-1 text-base text-govuk-dark-grey dark:text-govuk-mid-grey">
            Current workflow state.
          </p>
          <dl className="mt-4 divide-y divide-govuk-mid-grey/60 border-t border-govuk-mid-grey dark:divide-white/10 dark:border-white/10">
            {Object.entries(byState)
              .sort((a, b) => b[1].count - a[1].count)
              .map(([state, info]) => {
                const meta = getWorkflowState(info.sample, state);
                return (
                  <div
                    key={state}
                    className="flex items-center justify-between py-2"
                  >
                    <dt>
                      <Badge
                        variant="outline"
                        className={cn(badgeColor(getStateColor(state)))}
                      >
                        {meta?.label ?? state.replace(/_/g, " ")}
                      </Badge>
                    </dt>
                    <dd className="font-bold text-govuk-black dark:text-govuk-white">
                      {info.count}
                    </dd>
                  </div>
                );
              })}
          </dl>
        </section>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href?: string;
}) {
  const body = (
    <div className="h-full border-b-[1px] border-r-0 border-govuk-mid-grey py-5 pr-6 sm:border-r-[1px]">
      <div className="text-sm font-normal text-govuk-dark-grey dark:text-govuk-mid-grey">
        {label}
      </div>
      <div className="mt-1 text-[36px] font-bold leading-none text-govuk-black dark:text-govuk-white">
        {value}
      </div>
    </div>
  );
  if (!href) return body;
  return (
    <Link
      href={href}
      className="block h-full text-govuk-black no-underline hover:bg-govuk-light-grey dark:text-govuk-white dark:hover:bg-[#2a2a2a]"
    >
      {body}
    </Link>
  );
}

const BAR_TONE: Record<string, string> = {
  red: "bg-govuk-red",
  amber: "bg-[#f47738]",
  green: "bg-govuk-green",
};

function Bar({
  label,
  count,
  total,
  tone,
}: {
  label: string;
  count: number;
  total: number;
  tone: keyof typeof BAR_TONE;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-govuk-black dark:text-govuk-white">{label}</span>
        <span className="font-bold text-govuk-black dark:text-govuk-white">
          {count}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden bg-govuk-light-grey dark:bg-[#2a2a2a]">
        <div
          className={cn("h-full", BAR_TONE[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
