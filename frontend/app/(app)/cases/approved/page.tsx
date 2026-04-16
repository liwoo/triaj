import type { Metadata } from "next";
import { CasesApprovedPage } from "@/screens/CasesApprovedPage";

export const metadata: Metadata = {
  title: "Approved",
  description:
    "Published case records — a read-only audit trail of human-approved AI triage decisions.",
  alternates: { canonical: "/cases/approved" },
  robots: { index: false, follow: false },
};

export default function Page() {
  return <CasesApprovedPage />;
}
