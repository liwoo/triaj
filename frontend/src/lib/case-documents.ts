"use client";

import { createClient, supabaseEnabled } from "@/lib/supabase/client";

export type CaseDocument = {
  name: string;
  path: string;
  size: number | null;
  mimetype: string | null;
  updatedAt: string | null;
  url: string;
};

type StorageObject = {
  name: string;
  id?: string | null;
  updated_at?: string | null;
  metadata?: {
    size?: number;
    mimetype?: string;
    [key: string]: unknown;
  } | null;
};

/**
 * Normalise bucket names — the DB may store underscores where Supabase
 * uses hyphens (e.g. `uploads_verified` → `uploads-verified`).
 */
function normaliseBucket(name: string): string {
  return name.replace(/_/g, "-");
}

/**
 * Recursively list every file under `prefix` in the given bucket.
 * Supabase storage returns entries without an `id` for folders — we descend
 * into those automatically so we never miss nested files.
 */
async function listRecursive(
  bucketName: string,
  prefix: string,
): Promise<CaseDocument[]> {
  const supabase = createClient();
  const bucket = normaliseBucket(bucketName);
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(prefix, {
      limit: 1000,
      sortBy: { column: "name", order: "asc" },
    });

  if (error) {
    console.warn(
      `[case-documents] list(${bucket}, ${prefix}) failed:`,
      error.message,
    );
    return [];
  }
  if (!data?.length) return [];

  const results: CaseDocument[] = [];

  for (const entry of data as StorageObject[]) {
    const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (!entry.id) {
      const nested = await listRecursive(bucket, fullPath);
      results.push(...nested);
    } else {
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(fullPath);

      results.push({
        name: entry.name,
        path: fullPath,
        size: entry.metadata?.size ?? null,
        mimetype: entry.metadata?.mimetype ?? null,
        updatedAt: entry.updated_at ?? null,
        url: urlData.publicUrl,
      });
    }
  }

  return results;
}

/**
 * Query the cases table for all distinct storage buckets in use.
 * Returns normalised bucket names. Falls back to empty array on error.
 */
async function discoverBuckets(): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cases")
    .select("storage_bucket")
    .not("storage_bucket", "is", null);

  if (error || !data) return [];

  const unique = new Set<string>();
  for (const row of data as { storage_bucket: string }[]) {
    if (row.storage_bucket) unique.add(normaliseBucket(row.storage_bucket));
  }
  return Array.from(unique);
}

/**
 * List all uploaded files for a case.
 *
 * Resolution order:
 * 1. If explicit `bucket` + `folder` are provided (from the DB columns
 *    `storage_bucket` / `folder_name`), list that exact location.
 * 2. Fall back to discovering buckets from the cases table, then scanning
 *    each for folders whose name starts with `caseId`.
 */
export async function fetchCaseDocuments(
  caseId: string,
  bucket?: string,
  folder?: string,
): Promise<CaseDocument[]> {
  if (!supabaseEnabled()) return [];

  // Strategy 1: explicit path from DB
  if (bucket && folder) {
    const docs = await listRecursive(bucket, folder);
    if (docs.length > 0) return docs;
    // folder was set but empty or gone — fall through
  }

  // Strategy 2: discover buckets from DB, then prefix-scan each
  const buckets = await discoverBuckets();
  if (buckets.length === 0) return [];

  const supabase = createClient();
  const results: CaseDocument[] = [];

  for (const bucketName of buckets) {
    const b = normaliseBucket(bucketName);
    const { data: roots, error: rootErr } = await supabase.storage
      .from(b)
      .list("", { limit: 1000, sortBy: { column: "name", order: "asc" } });

    if (rootErr) {
      console.warn(`[case-documents] Bucket ${b} list failed:`, rootErr.message);
      continue;
    }
    if (!roots) continue;

    const matching = roots.filter(
      (entry) => !entry.id && entry.name.startsWith(caseId),
    );
    for (const dir of matching) {
      const docs = await listRecursive(b, dir.name);
      results.push(...docs);
    }
    if (results.length > 0) break;
  }

  return results;
}

export function formatFileSize(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileExtension(name: string): string {
  const m = name.match(/\.([^.]+)$/);
  return m ? m[1].toUpperCase() : "FILE";
}
