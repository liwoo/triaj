"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FolderUp, Loader2, Upload } from "lucide-react";
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
import { supabaseEnabled } from "@/lib/supabase/client";
import { uploadQuarantineFolder } from "@/lib/storage";
import { createCaseInSupabase } from "@/lib/cases-api";
import { extractFilesFromDrop } from "@/lib/file-drop";
import type { EnrichedCase } from "@/types";

export function CreateCaseDialog() {
  const { open, setOpen } = useCreateDialog();
  const { addCase, refresh } = useCases();
  const router = useRouter();

  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [caseRef, setCaseRef] = useState("");
  const [applicantName, setApplicantName] = useState("");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedFolder, setUploadedFolder] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "creating">("idle");
  const [progress, setProgress] = useState<{ done: number; total: number }>({
    done: 0,
    total: 0,
  });

  const reset = () => {
    setFiles([]);
    setCaseRef("");
    setApplicantName("");
    setResult(null);
    setProcessing(false);
    setUploadError(null);
    setUploadedFolder(null);
    setPhase("idle");
    setProgress({ done: 0, total: 0 });
  };

  const onOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) reset();
  };

  const onPick = () => inputRef.current?.click();
  const onFiles = (list: FileList | null) => {
    if (!list) return;
    // webkitdirectory input returns real File objects per leaf; filter out any
    // zero-byte / untyped entries that sneak in as directory sentinels.
    setFiles(
      Array.from(list).filter((f) => !(f.size === 0 && f.type === "")),
    );
  };
  const onDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const expanded = await extractFilesFromDrop(e.dataTransfer);
    setFiles(expanded);
  };

  const onSubmit = async () => {
    if (files.length === 0 || !applicantName.trim()) return;
    setProcessing(true);
    setUploadError(null);

    const today = new Date().toISOString().slice(0, 10);
    const id = `CASE-${today.slice(0, 4)}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}99`;
    const caseType = "benefit_review";
    const applicant = applicantName.trim();
    const reference = caseRef.trim() || `REF-${Math.floor(Math.random() * 90000 + 10000)}`;

    if (!supabaseEnabled()) {
      setUploadError(
        "Supabase is not configured in this environment (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY). " +
          "Restart `npm run dev` after editing .env.local — env vars are loaded on server start.",
      );
      setProcessing(false);
      return;
    }

    let folder: string;
    setPhase("uploading");
    setProgress({ done: 0, total: files.length + 1 });
    try {
      const outcome = await uploadQuarantineFolder({
        caseId: id,
        applicantName: applicant,
        caseType,
        files,
        metadata: {
          case_id: id,
          case_type: caseType,
          applicant: { name: applicant, reference },
          created_date: today,
          file_count: files.length,
          source: "triaj-ui:create-dialog",
        },
        onProgress: (done, total) => setProgress({ done, total }),
      });
      console.info("[create-case] upload outcome", outcome);
      if (outcome.failed.length > 0) {
        setUploadError(
          `${outcome.failed.length} file${outcome.failed.length === 1 ? "" : "s"} failed to upload: ${outcome.failed.map((f) => `${f.name} (${f.message})`).join("; ")}`,
        );
        setProcessing(false);
        return;
      }
      folder = outcome.folder;
      setUploadedFolder(outcome.folder);
    } catch (err) {
      console.error("[create-case] upload threw", err);
      setUploadError(
        err instanceof Error ? err.message : "Upload failed — please try again.",
      );
      setProcessing(false);
      return;
    }

    setPhase("creating");
    try {
      await createCaseInSupabase({
        caseId: id,
        caseType,
        applicantName: applicant,
        applicantReference: reference,
        createdDate: today,
        uploadedFolder: folder,
      });
    } catch (err) {
      console.error("[create-case] DB insert threw", err);
      setUploadError(
        `Files uploaded to "${folder}" but the database insert failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      setProcessing(false);
      return;
    }

    void refresh();

    const newCase: EnrichedCase = {
      case_id: id,
      case_type: caseType,
      status: "processing",
      applicant: {
        name: applicant,
        reference,
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
      case_notes: `Uploaded to uploads-quarantine/${folder}`,
      state: "processing",
      score: 0,
      ai_status: "draft",
      explanation: "",
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
                  Row inserted into <code>cases</code> with status{" "}
                  <strong>processing</strong>. Triage agent will fill in the
                  rest.
                </p>
                {uploadedFolder && (
                  <p className="mt-1 break-all font-mono text-[11px] text-emerald-800/80 dark:text-emerald-200/80">
                    uploads-quarantine/{uploadedFolder}/
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : processing ? (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="font-medium">
                {phase === "uploading"
                  ? `Uploading ${progress.done} of ${progress.total} file${progress.total === 1 ? "" : "s"}…`
                  : phase === "creating"
                    ? "Creating case record…"
                    : "Preparing…"}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width:
                    phase === "creating"
                      ? "100%"
                      : progress.total > 0
                        ? `${Math.min(100, Math.round((progress.done / progress.total) * 100))}%`
                        : "0%",
                }}
              />
            </div>
            {phase === "uploading" && files.length > 0 && (
              <p className="break-all font-mono text-[11px] text-muted-foreground">
                → uploads-quarantine/
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {uploadError && (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-medium">Upload failed</div>
                  <div className="mt-0.5 text-xs">{uploadError}</div>
                </div>
              </div>
            )}
            <div>
              <Label className="mb-1.5 block">Complaint folder</Label>
              <div
                onClick={onPick}
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
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
