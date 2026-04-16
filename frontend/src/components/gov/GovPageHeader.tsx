interface GovPageHeaderProps {
  caption?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function GovPageHeader({
  caption,
  title,
  description,
  actions,
}: GovPageHeaderProps) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {caption && (
          <span className="mb-1 block text-base text-govuk-dark-grey dark:text-govuk-mid-grey">
            {caption}
          </span>
        )}
        <h1 className="text-[32px] font-bold leading-tight text-govuk-black dark:text-govuk-white sm:text-[36px]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-3xl text-base text-govuk-black dark:text-govuk-mid-grey">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// Backwards-compatible alias for screens that still import PageHeader.
export const PageHeader = GovPageHeader;
