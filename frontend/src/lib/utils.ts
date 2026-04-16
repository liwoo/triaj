import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// GOV.UK tag palette. Every colour pair uses the official GOV.UK light
// background + dark text combinations. Dark-mode inverts the pair so tags
// remain legible against a black body background.
const BADGE_COLORS: Record<string, string> = {
  // Neutral (grey)
  slate:
    "bg-[#eeefef] text-[#383f43] dark:bg-[#383f43] dark:text-[#eeefef]",
  stone:
    "bg-[#eeefef] text-[#383f43] dark:bg-[#383f43] dark:text-[#eeefef]",
  // Warning (yellow)
  amber:
    "bg-govuk-light-yellow text-[#594d00] dark:bg-[#594d00] dark:text-govuk-light-yellow",
  // Informational (blue)
  sky:
    "bg-[#d2e2f1] text-[#144e81] dark:bg-[#144e81] dark:text-[#d2e2f1]",
  // In-progress / review (purple)
  indigo:
    "bg-govuk-light-purple text-[#3d2375] dark:bg-[#3d2375] dark:text-govuk-light-purple",
  // Error / escalation (red)
  red:
    "bg-govuk-light-red text-[#942514] dark:bg-[#942514] dark:text-govuk-light-red",
  // Success (green)
  emerald:
    "bg-govuk-light-green text-[#005a30] dark:bg-[#005a30] dark:text-govuk-light-green",
};

export function badgeColor(color: string | undefined) {
  if (!color) return BADGE_COLORS.slate;
  return BADGE_COLORS[color] ?? BADGE_COLORS.slate;
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}
