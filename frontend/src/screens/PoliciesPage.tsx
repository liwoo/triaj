"use client";

import { useRef, useState } from "react";
import { FileText, Upload, Trash2, FileUp } from "lucide-react";
import { PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { badgeColor, cn, formatDate } from "@/lib/utils";

interface Policy {
  id: string;
  name: string;
  version: string;
  uploaded: string;
  size: string;
  status: "active" | "draft";
}

const SEED: Policy[] = [
  {
    id: "POL-001",
    name: "Complaints Prioritisation Framework 2026",
    version: "v2.3",
    uploaded: "2026-01-12",
    size: "214 KB",
    status: "active",
  },
  {
    id: "POL-002",
    name: "Vulnerability Escalation Policy",
    version: "v1.4",
    uploaded: "2025-11-03",
    size: "98 KB",
    status: "active",
  },
  {
    id: "POL-003",
    name: "Benefits Review — Non-compliance (POL-BR-003)",
    version: "v3.1",
    uploaded: "2026-02-20",
    size: "142 KB",
    status: "active",
  },
];

export function PoliciesPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [policies, setPolicies] = useState<Policy[]>(SEED);

  const onAdd = (file: File) => {
    const p: Policy = {
      id: `POL-${String(policies.length + 1).padStart(3, "0")}`,
      name: file.name.replace(/\.[^.]+$/, ""),
      version: "v1.0",
      uploaded: new Date().toISOString().slice(0, 10),
      size: `${Math.round(file.size / 1024)} KB`,
      status: "draft",
    };
    setPolicies((prev) => [p, ...prev]);
  };

  const onRemove = (id: string) => {
    setPolicies((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div>
      <PageHeader
        title="Policies"
        description="Institution prioritisation frameworks. Upload PDFs, guidance docs, or internal handbooks — their logic is extracted and codified into the prompt bank."
        actions={
          <Button onClick={() => inputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" /> Upload policy
          </Button>
        }
      />

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.md,.txt"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onAdd(f);
          e.currentTarget.value = "";
        }}
      />

      <Card>
        {policies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <FileUp className="h-8 w-8 text-muted-foreground/50" />
            <div className="mt-2 text-sm text-muted-foreground">
              No policies uploaded yet.
            </div>
          </div>
        ) : (
          <ul className="divide-y">
            {policies.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-accent/40"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium">{p.name}</div>
                    <Badge
                      variant="outline"
                      className={cn(
                        badgeColor(p.status === "active" ? "emerald" : "amber"),
                        "border",
                      )}
                    >
                      {p.status}
                    </Badge>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {p.id} · {p.version} · {p.size} · uploaded{" "}
                    {formatDate(p.uploaded)}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRemove(p.id)}
                  title="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="mt-4 text-xs text-muted-foreground">
        Every framework change is versioned and attributable in the prompt bank.
        Past triage decisions remain reproducible against the framework version
        in effect at the time.
      </p>
    </div>
  );
}
