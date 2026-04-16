"use client";

import { createClient } from "@/lib/supabase/client";

const BUCKET = "policy-documents";

export type PolicyDocument = {
  name: string;
  path: string;
  size: number | null;
  mimetype: string | null;
  updatedAt: string | null;
  createdAt: string | null;
  url: string;
};

type StorageObject = {
  name: string;
  id?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  last_accessed_at?: string | null;
  metadata?: {
    size?: number;
    mimetype?: string;
    [key: string]: unknown;
  } | null;
};

/**
 * Recursively walk the policy-documents bucket and flatten every file into a
 * single list. Entries whose `id` is null are directories in Supabase storage —
 * we recurse into them.
 */
async function walk(prefix: string): Promise<StorageObject[]> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) throw error;
  if (!data) return [];

  const results: StorageObject[] = [];
  for (const entry of data) {
    if (entry.id) {
      results.push({
        ...entry,
        name: prefix ? `${prefix}/${entry.name}` : entry.name,
      });
    } else {
      const nested = await walk(prefix ? `${prefix}/${entry.name}` : entry.name);
      results.push(...nested);
    }
  }
  return results;
}

export async function fetchPoliciesFromSupabase(): Promise<PolicyDocument[]> {
  const supabase = createClient();
  const objects = await walk("");

  return objects
    .filter((o) => o.id !== null)
    .map((o): PolicyDocument => {
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(o.name);
      return {
        name: o.name,
        path: o.name,
        size: o.metadata?.size ?? null,
        mimetype: o.metadata?.mimetype ?? null,
        updatedAt: o.updated_at ?? null,
        createdAt: o.created_at ?? null,
        url: data.publicUrl,
      };
    });
}

export function formatFileSize(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
