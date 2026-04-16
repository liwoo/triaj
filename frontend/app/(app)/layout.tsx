import { GovHeader } from "@/components/gov/GovHeader";
import { GovPhaseBanner } from "@/components/gov/GovPhaseBanner";
import { GovFooter } from "@/components/gov/GovFooter";
import { GovSkipLink } from "@/components/gov/GovSkipLink";
import { CreateCaseDialog } from "@/components/CreateCaseDialog";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-govuk-white dark:bg-govuk-black">
      <GovSkipLink />
      <GovHeader />
      <GovPhaseBanner phase="alpha" />
      <main id="main-content" role="main" className="flex-1 py-8">
        <div className="govuk-width">{children}</div>
      </main>
      <GovFooter />
      <CreateCaseDialog />
    </div>
  );
}
