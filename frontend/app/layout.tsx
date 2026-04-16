import type { Metadata } from "next";
import { CasesProvider } from "@/store/cases";
import { CreateDialogProvider } from "@/store/create-dialog";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Triaj — AI Complaints Triage",
  description:
    "Open-source, explainable AI-powered complaints triage for UK public sector institutions.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <CasesProvider>
            <CreateDialogProvider>{children}</CreateDialogProvider>
          </CasesProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
