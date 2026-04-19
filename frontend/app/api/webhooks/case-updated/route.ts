import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/webhooks/case-updated
 *
 * Supabase Database Webhook target. Fires on UPDATE to the `cases` table.
 *
 * The webhook payload shape (Supabase default):
 * {
 *   type: "UPDATE",
 *   table: "cases",
 *   schema: "public",
 *   record: { ...new row },
 *   old_record: { ...previous row }
 * }
 *
 * This endpoint checks whether the updated row now has an AI explanation.
 * If it does — and the previous row did not — we know the triage agent just
 * finished processing. A downstream action can be triggered here later
 * (e.g. notify reviewers, update a queue, kick off a secondary workflow).
 */

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: Record<string, unknown> | null;
  old_record: Record<string, unknown> | null;
};

export async function POST(request: NextRequest) {
  // ── Auth: verify the webhook secret ────────────────────────────────
  const secret = process.env.WEBHOOK_SECRET;
  if (secret) {
    const provided =
      request.headers.get("x-webhook-secret") ??
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (provided !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  // ── Parse payload ──────────────────────────────────────────────────
  let payload: WebhookPayload;
  try {
    payload = (await request.json()) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (payload.type !== "UPDATE" || !payload.record) {
    return NextResponse.json({ status: "ignored", reason: "not an update" });
  }

  const caseId = payload.record.case_id as string | undefined;
  const newExplanation = payload.record.explanation as string | undefined;
  const oldExplanation = payload.old_record?.explanation as string | undefined;

  if (!caseId) {
    return NextResponse.json({ status: "ignored", reason: "no case_id" });
  }

  // ── Has the AI explanation just appeared? ───────────────────────────
  const hadExplanation = !!oldExplanation?.trim();
  const hasExplanation = !!newExplanation?.trim();

  if (hasExplanation && !hadExplanation) {
    // The triage agent has just written an explanation for this case.
    // Fetch the full row so downstream logic has complete context.
    const supabase = createServiceClient();
    const { data: fullCase, error } = await supabase
      .from("cases")
      .select("*")
      .eq("case_id", caseId)
      .single();

    if (error) {
      console.error(
        `[webhook:case-updated] Failed to fetch case ${caseId}:`,
        error.message,
      );
      return NextResponse.json(
        { error: "failed to fetch case" },
        { status: 500 },
      );
    }

    console.log(
      `[webhook:case-updated] AI explanation received for ${caseId}`,
      {
        score: fullCase.score,
        ai_status: fullCase.ai_status,
        explanation_length: newExplanation?.length,
      },
    );

    // ── TODO: trigger downstream action here ──────────────────────────
    // Examples:
    //   - Notify reviewers (email, Slack, in-app notification)
    //   - Move case to a review queue
    //   - Kick off a secondary validation workflow
    //   - Update an external case management system
    //
    // For now we just log and return success.

    return NextResponse.json({
      status: "processed",
      case_id: caseId,
      action: "ai_explanation_received",
    });
  }

  // Explanation didn't change — nothing to do
  return NextResponse.json({
    status: "ignored",
    reason: "no new explanation",
    case_id: caseId,
  });
}
