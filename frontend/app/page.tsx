import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Triaj — AI Complaints Triage for the Public Sector",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  redirect("/dashboard");
}
