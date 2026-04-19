/**
 * Storage bucket names — read from env vars with sensible fallbacks.
 * Override in .env.local if your Supabase buckets are named differently.
 */

export const BUCKET_QUARANTINE =
  process.env.NEXT_PUBLIC_BUCKET_QUARANTINE ?? "uploads-quarantine";

export const BUCKET_VERIFIED =
  process.env.NEXT_PUBLIC_BUCKET_VERIFIED ?? "uploads-verified";

export const BUCKET_POLICIES =
  process.env.NEXT_PUBLIC_BUCKET_POLICIES ?? "policy-documents";
