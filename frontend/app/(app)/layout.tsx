import { Sidebar } from "@/components/Sidebar";
import { CreateCaseDialog } from "@/components/CreateCaseDialog";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-muted/30">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1280px] px-8 py-8">{children}</div>
      </main>
      <CreateCaseDialog />
    </div>
  );
}
