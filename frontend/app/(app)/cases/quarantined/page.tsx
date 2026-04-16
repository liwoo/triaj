import type { Metadata } from "next";
import { CasesQuarantinedPage } from "@/screens/CasesQuarantinedPage";

export const metadata: Metadata = {
  title: "Quarantined",
  description:
    "Cases the ingestion pipeline couldn't process. Each carries a recorded reason and can be reinstated by a case manager.",
  alternates: { canonical: "/cases/quarantined" },
  robots: { index: false, follow: false },
};

export default function Page() {
  return <CasesQuarantinedPage />;
}
