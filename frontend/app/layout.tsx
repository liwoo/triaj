import type { Metadata, Viewport } from "next";
import { CasesProvider } from "@/store/cases";
import { CreateDialogProvider } from "@/store/create-dialog";
import { ThemeProvider } from "@/components/theme-provider";
import {
  seoKeywords,
  siteDescription,
  siteName,
  siteTagline,
  siteUrl,
} from "@/lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteName} — ${siteTagline}`,
    template: `%s · ${siteName}`,
  },
  description: siteDescription,
  keywords: seoKeywords,
  applicationName: siteName,
  authors: [{ name: siteName, url: siteUrl }],
  creator: siteName,
  publisher: siteName,
  category: "government technology",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: siteUrl,
    siteName,
    title: `${siteName} — ${siteTagline}`,
    description: siteDescription,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `${siteName} — ${siteTagline}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteName} — ${siteTagline}`,
    description: siteDescription,
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  referrer: "strict-origin-when-cross-origin",
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": siteName,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0a09" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: siteName,
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "CaseManagementSoftware",
  operatingSystem: "Web",
  url: siteUrl,
  description: siteDescription,
  license: "https://opensource.org/licenses/MIT",
  isAccessibleForFree: true,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "GBP",
  },
  creator: {
    "@type": "Organization",
    name: siteName,
    url: siteUrl,
  },
  audience: {
    "@type": "Audience",
    audienceType:
      "UK public sector institutions, including local authorities, NHS trusts, housing associations, ombudsman offices, and regulatory bodies",
  },
  featureList: [
    "Flexible complaint folder ingestion (emails, PDFs, transcripts, forms)",
    "On-premises PII filtering (Presidio, GLiNER, local LLM)",
    "Institution-defined prioritisation frameworks",
    "Framework-quoted AI explanations for every decision",
    "Human-in-the-loop review and correction",
    "Deduplication and cross-complaint pattern detection",
    "Auditable decision log with framework versioning",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
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
