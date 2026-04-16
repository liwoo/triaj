"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FilePlus2,
  FileText,
  Folders,
  LayoutDashboard,
  Settings,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCreateDialog } from "@/store/create-dialog";
import { ModeToggle } from "@/components/ModeToggle";

const rowBase =
  "flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground";
const rowActive =
  "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        {title}
      </div>
      {children}
    </div>
  );
}

function NavItem({
  href,
  icon,
  children,
  small,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  small?: boolean;
}) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={cn(rowBase, small && "py-1", active && rowActive)}
    >
      {icon} {children}
    </Link>
  );
}

function CreateTrigger() {
  const { setOpen } = useCreateDialog();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(rowBase, "text-left")}
    >
      <FilePlus2 className="h-4 w-4" /> Create
    </button>
  );
}

export function Sidebar() {
  return (
    <aside className="flex h-full w-60 flex-col border-r bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShieldAlert className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">Triaj</div>
          <div className="text-[11px] text-muted-foreground">
            Complaints triage
          </div>
        </div>
        <ModeToggle />
      </div>

      <nav className="flex-1 space-y-3 overflow-y-auto p-2">
        <Section title="Work">
          <CreateTrigger />
          <NavItem
            href="/dashboard"
            icon={<LayoutDashboard className="h-4 w-4" />}
          >
            Dashboard
          </NavItem>
        </Section>

        <Section title="Cases">
          <div className="flex items-center gap-2 px-3 py-1 text-sm text-muted-foreground">
            <Folders className="h-4 w-4" /> Cases
          </div>
          <div className="ml-5 space-y-0.5 border-l pl-2">
            <NavItem
              href="/cases/pending"
              icon={<ClipboardList className="h-3.5 w-3.5" />}
              small
            >
              Pending
            </NavItem>
            <NavItem
              href="/cases/quarantined"
              icon={<ShieldAlert className="h-3.5 w-3.5" />}
              small
            >
              Quarantined
            </NavItem>
            <NavItem
              href="/cases/approved"
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
              small
            >
              Approved
            </NavItem>
          </div>
        </Section>

        <Section title="Observability">
          <a
            href="https://cloud.langfuse.com"
            target="_blank"
            rel="noreferrer"
            className={cn(rowBase, "justify-between")}
          >
            <span className="inline-flex items-center gap-2.5">
              <Activity className="h-4 w-4" /> Logs
            </span>
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>
        </Section>

        <Section title="Configuration">
          <NavItem href="/policies" icon={<FileText className="h-4 w-4" />}>
            Policies
          </NavItem>
          <NavItem href="/settings" icon={<Settings className="h-4 w-4" />}>
            Settings
          </NavItem>
        </Section>
      </nav>

      <div className="border-t px-4 py-3 text-[11px] text-muted-foreground">
        AI governance · on-prem PII · explainable
      </div>
    </aside>
  );
}
