import type { Metadata } from "next";
import { CasesPendingPage } from "@/screens/CasesPendingPage";

export const metadata: Metadata = {
  title: "Pending review",
  description:
    "AI-triaged cases awaiting human approval. Every decision is explainable and auditable.",
  alternates: { canonical: "/cases/pending" },
  robots: { index: false, follow: false },
};

export default function Page() {
  return <CasesPendingPage />;
}
