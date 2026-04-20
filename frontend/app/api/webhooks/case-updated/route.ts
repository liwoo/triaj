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

function log(
  level: "info" | "warn" | "error",
  message: string,
  data?: Record<string, unknown>,
) {
  const entry = {
    timestamp: new Date().toISOString(),
    source: "webhook:case-updated",
    message,
    ...data,
  };
  if (level === "error") console.error(JSON.stringify(entry));
  else if (level === "warn") console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  log("info", "Webhook received", { requestId });

  // ── Auth: verify the webhook secret ────────────────────────────────
  const secret = process.env.WEBHOOK_SECRET;
  if (secret) {
    const provided =
      request.headers.get("x-webhook-secret") ??
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (provided !== secret) {
      log("warn", "Unauthorized — invalid or missing webhook secret", {
        requestId,
      });
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  } else {
    log("warn", "WEBHOOK_SECRET not set — accepting without auth", {
      requestId,
    });
  }

  // ── Parse payload ──────────────────────────────────────────────────
  let payload: WebhookPayload;
  try {
    payload = (await request.json()) as WebhookPayload;
  } catch {
    log("error", "Failed to parse request body as JSON", { requestId });
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  log("info", "Payload parsed", {
    requestId,
    type: payload.type,
    table: payload.table,
    schema: payload.schema,
    case_id: payload.record?.case_id as string | undefined,
  });

  if (payload.type !== "UPDATE" || !payload.record) {
    log("info", "Ignored — not an UPDATE with a record", {
      requestId,
      type: payload.type,
    });
    return NextResponse.json({ status: "ignored", reason: "not an update" });
  }

  const caseId = payload.record.case_id as string | undefined;
  if (!caseId) {
    log("warn", "Ignored — UPDATE has no case_id", { requestId });
    return NextResponse.json({ status: "ignored", reason: "no case_id" });
  }

  // ── Log what changed ───────────────────────────────────────────────
  const newExplanation = payload.record.explanation as string | undefined;
  const oldExplanation = payload.old_record?.explanation as string | undefined;
  const newStatus = payload.record.ai_status as string | undefined;
  const oldStatus = payload.old_record?.ai_status as string | undefined;
  const newScore = payload.record.score as number | undefined;
  const oldScore = payload.old_record?.score as number | undefined;
  const newState = payload.record.state as string | undefined;
  const oldState = payload.old_record?.state as string | undefined;

  log("info", "Case update details", {
    requestId,
    case_id: caseId,
    changes: {
      ai_status: oldStatus !== newStatus ? { from: oldStatus, to: newStatus } : "unchanged",
      score: oldScore !== newScore ? { from: oldScore, to: newScore } : "unchanged",
      state: oldState !== newState ? { from: oldState, to: newState } : "unchanged",
      explanation: {
        had: !!oldExplanation?.trim(),
        has: !!newExplanation?.trim(),
        length: newExplanation?.length ?? 0,
      },
    },
  });

  // ── Has the AI explanation just appeared? ───────────────────────────
  const hadExplanation = !!oldExplanation?.trim();
  const hasExplanation = !!newExplanation?.trim();

  if (hasExplanation && !hadExplanation) {
    log("info", "AI explanation detected — fetching full case", {
      requestId,
      case_id: caseId,
    });

    const supabase = createServiceClient();
    const { data: fullCase, error } = await supabase
      .from("cases")
      .select("*")
      .eq("case_id", caseId)
      .single();

    if (error) {
      log("error", "Failed to fetch case from DB", {
        requestId,
        case_id: caseId,
        error: error.message,
        code: error.code,
      });
      return NextResponse.json(
        { error: "failed to fetch case" },
        { status: 500 },
      );
    }

    log("info", "AI explanation received — case ready for review", {
      requestId,
      case_id: caseId,
      case_type: fullCase.case_type,
      score: fullCase.score,
      ai_status: fullCase.ai_status,
      state: fullCase.state,
      assigned_to: fullCase.assigned_to,
      explanation_length: newExplanation?.length,
    });

    // ── TODO: trigger downstream action here ──────────────────────────
    // Examples:
    //   - Notify reviewers (email, Slack, in-app notification)
    //   - Move case to a review queue
    //   - Kick off a secondary validation workflow
    //   - Update an external case management system

    return NextResponse.json({
      status: "processed",
      case_id: caseId,
      action: "ai_explanation_received",
    });
  }

  log("info", "No new explanation — no action taken", {
    requestId,
    case_id: caseId,
  });

  return NextResponse.json({
    status: "ignored",
    reason: "no new explanation",
    case_id: caseId,
  });
}
