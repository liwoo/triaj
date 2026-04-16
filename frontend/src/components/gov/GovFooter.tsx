import Link from "next/link";

const LINKS = [
  { href: "#", label: "Help" },
  { href: "#", label: "Privacy" },
  { href: "#", label: "Cookies" },
  { href: "#", label: "Accessibility statement" },
  { href: "#", label: "Contact" },
  { href: "#", label: "Terms and conditions" },
];

function OGLCrown() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 483.2 195.7"
      className="h-[17px] w-[41px] text-govuk-dark-grey"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M421.5 142.8V.1l-50.7 32.3v161.1h112.4v-50.7zm-122.3-9.6A47.12 47.12 0 0 1 221 97.8c0-26 21.1-47.1 47.1-47.1 16.7 0 31.4 8.7 39.7 21.8l42.7-27.2A97.63 97.63 0 0 0 268.1 0c-36.5 0-68.3 20.1-85.1 49.7A98 98 0 0 0 97.8 0C43.9 0 0 43.9 0 97.8s43.9 97.8 97.8 97.8c36.5 0 68.3-20.1 85.1-49.7a97.76 97.76 0 0 0 149.6 25.4l19.4 22.2h3v-87.8h-80l24.3 27.5zM97.8 145c-26 0-47.1-21.1-47.1-47.1s21.1-47.1 47.1-47.1 47.2 21 47.2 47S123.8 145 97.8 145"
      />
    </svg>
  );
}

export function GovFooter() {
  return (
    <footer className="mt-auto border-t-[1px] border-govuk-mid-grey bg-govuk-light-grey pt-10 text-govuk-black dark:border-white/10 dark:bg-[#1a1a1a] dark:text-govuk-white">
      <div className="govuk-width pb-6">
        <nav aria-label="Support links" className="mb-8">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {LINKS.map((l) => (
              <li key={l.label}>
                <Link
                  href={l.href}
                  className="text-govuk-blue underline decoration-1 underline-offset-[0.1em] hover:decoration-[3px] dark:text-govuk-light-blue"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <hr className="mb-6 border-t border-govuk-mid-grey/60 dark:border-white/10" />

        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex items-start gap-4">
            <OGLCrown />
            <p className="max-w-md text-sm leading-snug text-govuk-dark-grey dark:text-govuk-mid-grey">
              All content is available under the{" "}
              <Link
                href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"
                className="text-govuk-blue underline dark:text-govuk-light-blue"
              >
                Open Government Licence v3.0
              </Link>
              , except where otherwise stated.
            </p>
          </div>
          <p className="text-sm text-govuk-dark-grey dark:text-govuk-mid-grey">
            © Crown copyright
          </p>
        </div>
      </div>
    </footer>
  );
}
