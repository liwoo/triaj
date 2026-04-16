import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Authenticated application surfaces — excluded from crawl even when
        // the instance is publicly reachable (demo deploys, preview envs).
        disallow: [
          "/dashboard",
          "/cases",
          "/cases/",
          "/policies",
          "/settings",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
