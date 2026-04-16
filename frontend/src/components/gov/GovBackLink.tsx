import Link from "next/link";

export function GovBackLink({
  href,
  children = "Back",
}: {
  href: string;
  children?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-govuk-black underline decoration-1 underline-offset-[0.1em] hover:decoration-[3px] dark:text-govuk-white"
    >
      <svg
        viewBox="0 0 13 17"
        className="h-3 w-2.5"
        aria-hidden="true"
        fill="currentColor"
      >
        <path d="m0 8 6.5 8 1.5-1.5L3 8.5h10v-1H3L8 2.5 6.5 1z" />
      </svg>
      {children}
    </Link>
  );
}
