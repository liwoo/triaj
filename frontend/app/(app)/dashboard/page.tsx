import type { Metadata } from "next";
import { DashboardPage } from "@/screens/DashboardPage";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Triage health across the caseload — pending review, published decisions, quarantined submissions, and priority mix.",
  alternates: { canonical: "/dashboard" },
  robots: { index: false, follow: false },
};

export default function Page() {
  return <DashboardPage />;
}
