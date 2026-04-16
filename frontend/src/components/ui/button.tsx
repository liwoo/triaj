import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// GOV.UK-style buttons: 2px bottom shadow, press-down on active, no radius,
// Arial font. Focus ring comes from the global :focus-visible rule in
// globals.css (yellow background + 4px black bar).
const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-normal leading-tight transition-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-govuk-green text-govuk-white shadow-[0_2px_0_#002d18] hover:bg-[#005a30] active:top-[2px] active:shadow-none",
        destructive:
          "bg-govuk-red text-govuk-white shadow-[0_2px_0_#55150b] hover:bg-[#aa2a16] active:top-[2px] active:shadow-none",
        secondary:
          "bg-govuk-light-grey text-govuk-black shadow-[0_2px_0_#929191] hover:bg-[#dbdad9] active:top-[2px] active:shadow-none dark:bg-[#383f43] dark:text-govuk-white dark:shadow-[0_2px_0_#14191c] dark:hover:bg-[#4a5459]",
        outline:
          "bg-govuk-light-grey text-govuk-black shadow-[0_2px_0_#929191] hover:bg-[#dbdad9] active:top-[2px] active:shadow-none dark:bg-[#383f43] dark:text-govuk-white dark:shadow-[0_2px_0_#14191c] dark:hover:bg-[#4a5459]",
        ghost:
          "bg-transparent text-govuk-black hover:bg-govuk-light-grey dark:text-govuk-white dark:hover:bg-[#2a2a2a]",
        link:
          "h-auto p-0 text-govuk-blue underline underline-offset-[0.1em] shadow-none hover:decoration-[3px] dark:text-govuk-light-blue",
      },
      size: {
        default: "px-4 py-2 text-base",
        sm: "px-2.5 py-1 text-sm",
        lg: "px-5 py-2.5 text-lg font-bold",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
