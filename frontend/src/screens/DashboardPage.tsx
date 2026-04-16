"use client";

import Link from "next/link";
import {
  CheckCircle2,
  ClipboardList,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import { PageHeader } from "@/components/Layout";
import { useCases } from "@/store/cases";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
        title="Dashboard"
        description="Triage health across the caseload."
      />

      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={<ClipboardList className="h-4 w-4" />}
          label="Pending review"
          value={pending.length}
          href="/cases/pending"
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
          label="Published"
          value={approved.length}
          href="/cases/approved"
        />
        <StatCard
          icon={<ShieldAlert className="h-4 w-4 text-destructive" />}
          label="Quarantined"
          value={quarantined.length}
          href="/cases/quarantined"
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
          label="Avg. AI score"
          value={avgScore}
        />
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Priority mix</CardTitle>
            <CardDescription>
              AI scores on all pending and published cases.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Bar label="Urgent (≥75)" count={urgent} total={all.length} color="bg-red-500" />
            <Bar
              label="High (50–74)"
              count={highScore}
              total={all.length}
              color="bg-amber-500"
            />
            <Bar
              label="Standard (<50)"
              count={all.length - urgent - highScore}
              total={all.length}
              color="bg-emerald-500"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">By state</CardTitle>
            <CardDescription>
              Current workflow state across the caseload.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(byState)
              .sort((a, b) => b[1].count - a[1].count)
              .map(([state, info]) => {
                const meta = getWorkflowState(info.sample, state);
                return (
                  <div
                    key={state}
                    className="flex items-center justify-between text-sm"
                  >
                    <Badge
                      variant="outline"
                      className={cn(badgeColor(getStateColor(state)), "border")}
                    >
                      {meta?.label ?? state.replace(/_/g, " ")}
                    </Badge>
                    <span className="font-medium">{info.count}</span>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  href?: string;
}) {
  const body = (
    <Card className="transition-colors hover:bg-accent/40">
      <CardContent className="pt-5">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          {icon} {label}
        </div>
        <div className="mt-2 text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

function Bar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-medium text-foreground">{count}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
