import type { Metadata } from "next";
import { SettingsPage } from "@/screens/SettingsPage";

export const metadata: Metadata = {
  title: "Settings",
  description:
    "Institution configuration, column mapping, PII filter tuning, and integration endpoints.",
  alternates: { canonical: "/settings" },
  robots: { index: false, follow: false },
};

export default function Page() {
  return <SettingsPage />;
}
