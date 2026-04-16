"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface RejectDialogProps {
  caseId: string | null;
  onClose: () => void;
  onConfirm: (id: string, reason: string) => Promise<void> | void;
}

export function RejectDialog({ caseId, onClose, onConfirm }: RejectDialogProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!caseId) {
      setReason("");
      setSubmitting(false);
      setError(null);
    }
  }, [caseId]);

  const handleConfirm = async () => {
    if (!caseId || !reason.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(caseId, reason.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed — try again.");
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!caseId} onOpenChange={(v) => !v && !submitting && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Reject triage decision</DialogTitle>
          <DialogDescription>
            Explain why the AI&apos;s label is wrong. This note is recorded in the
            audit log and feeds framework refinement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-sm font-medium">Reason</label>
          <Textarea
            autoFocus
            rows={5}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Framework section 1.2 does not apply here because the applicant is not in a care setting…"
            disabled={submitting}
          />
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>{error}</div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!reason.trim() || submitting}
            onClick={handleConfirm}
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Rejecting…
              </>
            ) : (
              "Reject"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
