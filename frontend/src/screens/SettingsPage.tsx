import { Construction } from "lucide-react";
import { PageHeader } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";

export function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="Settings"
        description="Institution configuration, column mapping, PII filter tuning, and integration endpoints."
      />

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-20 text-center">
          <Construction className="h-8 w-8 text-muted-foreground" />
          <div className="mt-3 text-sm font-medium">Settings — coming next</div>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">
            Column mapping, onboarding questionnaire, PII model thresholds, and
            case-management system integrations will live here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
