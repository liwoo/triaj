"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GovCrown } from "@/components/gov/GovCrown";
import { ModeToggle } from "@/components/ModeToggle";
import { useCreateDialog } from "@/store/create-dialog";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; matchPrefix?: boolean };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/cases/pending", label: "Pending", matchPrefix: true },
  { href: "/cases/quarantined", label: "Quarantined" },
  { href: "/cases/approved", label: "Approved" },
  { href: "/policies", label: "Policies" },
  { href: "/settings", label: "Settings" },
];

function isActive(pathname: string | null, item: NavItem) {
  if (!pathname) return false;
  if (item.matchPrefix) {
    return (
      pathname === item.href ||
      (item.href === "/cases/pending" && pathname === "/cases")
    );
  }
  return pathname === item.href;
}

export function GovHeader() {
  const pathname = usePathname();
  const { setOpen } = useCreateDialog();

  return (
    <header className="border-b-[10px] border-govuk-blue bg-govuk-black text-govuk-white">
      {/* Crown row */}
      <div className="border-b border-white/10">
        <div className="govuk-width flex items-center justify-between py-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-govuk-white no-underline hover:underline"
          >
            <GovCrown className="h-[30px] w-[36px] text-govuk-white" />
            <span className="text-[30px] font-bold leading-none tracking-tight">
              GOV.UK
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <ModeToggle />
          </div>
        </div>
      </div>

      {/* Service name + global actions */}
      <div>
        <div className="govuk-width flex flex-wrap items-center justify-between gap-3 py-3">
          <Link
            href="/dashboard"
            className="text-[24px] font-bold leading-tight text-govuk-white no-underline hover:underline"
          >
            Complaints triage
          </Link>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center bg-govuk-green px-4 py-2 text-base font-bold text-govuk-white shadow-[0_2px_0_#002d18] hover:bg-[#005a30] active:top-[2px]"
          >
            Create new case
          </button>
        </div>
      </div>

      {/* Primary nav */}
      <nav aria-label="Service" className="bg-govuk-black">
        <div className="govuk-width">
          <ul className="flex flex-wrap gap-x-6 gap-y-1 border-t border-white/10 py-2 text-base">
            {NAV.map((item) => {
              const active = isActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-block py-1 font-bold text-govuk-white no-underline underline-offset-4 hover:underline",
                      active && "underline decoration-[3px]",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </header>
  );
}
