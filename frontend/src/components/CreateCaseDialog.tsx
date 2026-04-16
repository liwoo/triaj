"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FolderUp, Loader2, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCases } from "@/store/cases";
import { useCreateDialog } from "@/store/create-dialog";
import type { EnrichedCase } from "@/types";

export function CreateCaseDialog() {
  const { open, setOpen } = useCreateDialog();
  const { addCase } = useCases();
  const router = useRouter();

  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [caseRef, setCaseRef] = useState("");
  const [applicantName, setApplicantName] = useState("");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const reset = () => {
    setFiles([]);
    setCaseRef("");
    setApplicantName("");
    setResult(null);
    setProcessing(false);
  };

  const onOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) reset();
  };

  const onPick = () => inputRef.current?.click();
  const onFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles(Array.from(list));
  };

  const onSubmit = async () => {
    if (files.length === 0 || !applicantName.trim()) return;
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 900));

    const today = new Date().toISOString().slice(0, 10);
    const id = `CASE-${today.slice(0, 4)}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}99`;

    const newCase: EnrichedCase = {
      case_id: id,
      case_type: "benefit_review",
      status: "case_created",
      applicant: {
        name: applicantName.trim(),
        reference: caseRef.trim() || `REF-${Math.floor(Math.random() * 90000 + 10000)}`,
        date_of_birth: null,
      },
      assigned_to: "unassigned",
      created_date: today,
      last_updated: today,
      timeline: [
        {
          date: today,
          event: "case_created",
          note: `Folder uploaded via create dialog (${files.length} file${files.length === 1 ? "" : "s"}).`,
        },
      ],
      case_notes: `Newly ingested case — ${files.length} file(s) uploaded. Pending anonymisation and triage.`,
      state: "case_created",
      score: 40,
      ai_status: "draft",
      explanation:
        "Placeholder explanation — this case has not yet been run through the triage agent. Score shown is a pre-triage default until the agent assigns a framework-backed label.",
    };

    addCase(newCase);
    setProcessing(false);
    setResult(id);
  };

  const viewInPending = () => {
    setOpen(false);
    reset();
    router.push("/cases/pending");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Create a new case</DialogTitle>
          <DialogDescription>
            Upload one complaint folder. For this demo only a single folder is
            supported.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/40">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                  Case {result} created
                </div>
                <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200">
                  The folder has been queued. It will appear in Pending once
                  pre-processing and triage complete.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block">Complaint folder</Label>
              <div
                onClick={onPick}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  onFiles(e.dataTransfer.files);
                }}
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed bg-muted/30 px-6 py-8 text-center hover:bg-muted/50"
              >
                <FolderUp className="h-6 w-6 text-muted-foreground" />
                <div className="mt-2 text-sm font-medium">
                  Click to browse or drop a folder here
                </div>
                <div className="text-xs text-muted-foreground">
                  Any format — emails, PDFs, transcripts, forms
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  /* @ts-expect-error — webkitdirectory is not in the React types */
                  webkitdirectory=""
                  directory=""
                  className="hidden"
                  onChange={(e) => onFiles(e.target.files)}
                />
              </div>
              {files.length > 0 && (
                <div className="mt-2 rounded-md border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
                  {files.length} file{files.length === 1 ? "" : "s"} selected —
                  first:{" "}
                  <span className="font-medium text-foreground">
                    {files[0].name}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="dlg-applicant">Applicant name *</Label>
                <Input
                  id="dlg-applicant"
                  value={applicantName}
                  onChange={(e) => setApplicantName(e.target.value)}
                  placeholder="e.g. Jordan Smith"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dlg-ref">External reference</Label>
                <Input
                  id="dlg-ref"
                  value={caseRef}
                  onChange={(e) => setCaseRef(e.target.value)}
                  placeholder="e.g. REF-77291"
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {result ? (
            <>
              <Button variant="outline" onClick={reset}>
                Create another
              </Button>
              <Button onClick={viewInPending}>View in Pending</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                disabled={
                  files.length === 0 || !applicantName.trim() || processing
                }
                onClick={onSubmit}
              >
                {processing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Ingesting…
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5" /> Ingest folder
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
