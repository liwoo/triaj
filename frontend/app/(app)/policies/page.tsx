import type { Metadata } from "next";
import { PoliciesPage } from "@/screens/PoliciesPage";

export const metadata: Metadata = {
  title: "Policies",
  description:
    "Institution prioritisation frameworks. Upload PDFs and guidance documents — their logic is extracted and codified into the prompt bank.",
  alternates: { canonical: "/policies" },
  robots: { index: false, follow: false },
};

export default function Page() {
  return <PoliciesPage />;
}
