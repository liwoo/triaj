import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type GovTagColor =
  | "blue"
  | "grey"
  | "green"
  | "red"
  | "yellow"
  | "orange"
  | "turquoise"
  | "purple"
  | "pink";

const BASE =
  "inline-block max-w-full whitespace-nowrap px-2 py-1 text-[12px] font-bold uppercase leading-none tracking-wide";

const COLORS: Record<GovTagColor, string> = {
  blue: "bg-[#d2e2f1] text-[#144e81] dark:bg-[#144e81] dark:text-[#d2e2f1]",
  grey: "bg-[#eeefef] text-[#383f43] dark:bg-[#383f43] dark:text-[#eeefef]",
  green: "bg-govuk-light-green text-[#005a30] dark:bg-[#005a30] dark:text-govuk-light-green",
  red: "bg-govuk-light-red text-[#942514] dark:bg-[#942514] dark:text-govuk-light-red",
  yellow: "bg-govuk-light-yellow text-[#594d00] dark:bg-[#594d00] dark:text-govuk-light-yellow",
  orange: "bg-[#fcd6c3] text-[#6e3619] dark:bg-[#6e3619] dark:text-[#fcd6c3]",
  turquoise: "bg-[#bfe3e0] text-[#10403c] dark:bg-[#10403c] dark:text-[#bfe3e0]",
  purple: "bg-govuk-light-purple text-[#3d2375] dark:bg-[#3d2375] dark:text-govuk-light-purple",
  pink: "bg-[#f7d7e6] text-[#80224d] dark:bg-[#80224d] dark:text-[#f7d7e6]",
};

interface GovTagProps extends HTMLAttributes<HTMLSpanElement> {
  color?: GovTagColor;
}

export function GovTag({ color = "blue", className, ...props }: GovTagProps) {
  return <span className={cn(BASE, COLORS[color], className)} {...props} />;
}

// Map legacy shadcn-era colour names used elsewhere to GOV.UK tag colours.
const LEGACY_TO_GOV: Record<string, GovTagColor> = {
  slate: "grey",
  stone: "grey",
  amber: "yellow",
  sky: "blue",
  indigo: "purple",
  red: "red",
  emerald: "green",
  blue: "blue",
  yellow: "yellow",
  green: "green",
  grey: "grey",
  orange: "orange",
  turquoise: "turquoise",
  purple: "purple",
  pink: "pink",
};

export function toGovTagColor(c: string | undefined): GovTagColor {
  if (!c) return "grey";
  return LEGACY_TO_GOV[c] ?? "grey";
}
