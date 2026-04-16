"use client";

import { createClient } from "@/lib/supabase/client";

const BUCKET = "uploads-quarantine";

export type UploadOutcome = {
  folder: string;
  uploaded: string[];
  failed: { name: string; message: string }[];
};

function humanCaseType(caseType: string) {
  return caseType
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildFolderKey(
  caseId: string,
  applicantName: string,
  caseType: string,
) {
  const safeName = applicantName.trim().replace(/[/\\]/g, "_");
  return `${caseId}_${safeName} - ${humanCaseType(caseType)}`;
}

export async function uploadQuarantineFolder(params: {
  caseId: string;
  applicantName: string;
  caseType: string;
  files: File[];
  metadata?: Record<string, unknown>;
}): Promise<UploadOutcome> {
  const supabase = createClient();
  const folder = buildFolderKey(
    params.caseId,
    params.applicantName,
    params.caseType,
  );

  const uploaded: string[] = [];
  const failed: { name: string; message: string }[] = [];

  const tasks: Promise<void>[] = params.files.map(async (file) => {
    const safeFileName = file.name.replace(/[/\\]/g, "_");
    const path = `${folder}/${safeFileName}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (error) failed.push({ name: file.name, message: error.message });
    else uploaded.push(safeFileName);
  });

  if (params.metadata) {
    tasks.push(
      (async () => {
        const blob = new Blob([JSON.stringify(params.metadata, null, 2)], {
          type: "application/json",
        });
        const path = `${folder}/case_data.json`;
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, blob, {
            contentType: "application/json",
            upsert: true,
          });
        if (error) failed.push({ name: "case_data.json", message: error.message });
        else uploaded.push("case_data.json");
      })(),
    );
  }

  await Promise.all(tasks);
  return { folder, uploaded, failed };
}
