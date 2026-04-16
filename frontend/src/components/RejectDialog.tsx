"use client";

import { useEffect, useState } from "react";
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
  onConfirm: (id: string, reason: string) => void;
}

export function RejectDialog({ caseId, onClose, onConfirm }: RejectDialogProps) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!caseId) setReason("");
  }, [caseId]);

  return (
    <Dialog open={!!caseId} onOpenChange={(v) => !v && onClose()}>
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
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!reason.trim()}
            onClick={() => caseId && onConfirm(caseId, reason.trim())}
          >
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
