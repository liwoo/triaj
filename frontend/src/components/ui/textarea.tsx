import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full border-[2px] border-govuk-black bg-govuk-white px-2 py-1 text-base text-govuk-black placeholder:text-govuk-dark-grey focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 dark:border-govuk-mid-grey dark:bg-govuk-black dark:text-govuk-white dark:placeholder:text-govuk-mid-grey",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
