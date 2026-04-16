import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Triaj — AI Complaints Triage for the Public Sector";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background:
            "radial-gradient(ellipse at top left, #1e293b 0%, #0f172a 60%, #020617 100%)",
          color: "#f8fafc",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#ffffff",
              color: "#0f172a",
              borderRadius: 16,
              fontSize: 42,
              fontWeight: 800,
              letterSpacing: "-0.05em",
            }}
          >
            T
          </div>
          <div
            style={{
              fontSize: 34,
              fontWeight: 600,
              color: "#e2e8f0",
              letterSpacing: "-0.02em",
            }}
          >
            Triaj
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 78,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.035em",
              maxWidth: 980,
            }}
          >
            AI-Powered Complaints Triage
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 400,
              lineHeight: 1.3,
              color: "#94a3b8",
              maxWidth: 980,
            }}
          >
            Built for UK public sector institutions. Explainable by design,
            on-premises PII, framework-quoted rationales.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            fontSize: 20,
            color: "#64748b",
          }}
        >
          <span
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: "1px solid #334155",
            }}
          >
            Open source · MIT
          </span>
          <span
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: "1px solid #334155",
            }}
          >
            On-prem PII
          </span>
          <span
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: "1px solid #334155",
            }}
          >
            Framework-quoted
          </span>
          <span
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: "1px solid #334155",
            }}
          >
            Audit-ready
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
