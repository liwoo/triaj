import Link from "next/link";

interface GovPhaseBannerProps {
  phase?: "alpha" | "beta";
  feedbackHref?: string;
}

export function GovPhaseBanner({
  phase = "alpha",
  feedbackHref = "mailto:feedback@triaj.example",
}: GovPhaseBannerProps) {
  return (
    <div className="border-b border-govuk-mid-grey bg-govuk-white dark:bg-govuk-black">
      <div className="govuk-width-narrow py-2.5">
        <p className="flex items-center gap-3 text-sm text-govuk-black dark:text-govuk-white">
          <strong className="inline-flex items-center bg-govuk-blue px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-govuk-white">
            {phase}
          </strong>
          <span>
            This is a new service — your{" "}
            <Link
              href={feedbackHref}
              className="text-govuk-blue underline decoration-1 underline-offset-[0.1em] hover:decoration-[3px] dark:text-govuk-light-blue"
            >
              feedback
            </Link>{" "}
            will help us to improve it.
          </span>
        </p>
      </div>
    </div>
  );
}
