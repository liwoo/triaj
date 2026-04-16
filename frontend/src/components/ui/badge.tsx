import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Rendered as a GOV.UK tag: square corners, uppercase, bold.
// Colour pairs can be merged via className (see badgeColor() in lib/utils.ts).
const badgeVariants = cva(
  "inline-block max-w-full whitespace-nowrap px-2 py-1 text-[12px] font-bold uppercase leading-none tracking-wide align-middle",
  {
    variants: {
      variant: {
        default: "bg-govuk-blue text-govuk-white",
        secondary:
          "bg-[#eeefef] text-[#383f43] dark:bg-[#383f43] dark:text-[#eeefef]",
        destructive:
          "bg-govuk-light-red text-[#942514] dark:bg-[#942514] dark:text-govuk-light-red",
        outline:
          "bg-transparent text-govuk-black dark:text-govuk-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
