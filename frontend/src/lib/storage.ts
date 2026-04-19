"use client";

import { createClient } from "@/lib/supabase/client";
import { BUCKET_QUARANTINE } from "@/lib/buckets";

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
  onProgress?: (done: number, total: number) => void;
}): Promise<UploadOutcome> {
  const supabase = createClient();
  const folder = buildFolderKey(
    params.caseId,
    params.applicantName,
    params.caseType,
  );

  const uploaded: string[] = [];
  const failed: { name: string; message: string }[] = [];

  // Skip folder-handle sentinels (size=0, no mime) that sneak through plain
  // DataTransfer.files drops.
  const realFiles = params.files.filter(
    (f) => !(f.size === 0 && f.type === ""),
  );

  const total = realFiles.length + (params.metadata ? 1 : 0);
  let done = 0;
  params.onProgress?.(0, total);
  const tick = () => {
    done += 1;
    params.onProgress?.(done, total);
  };

  const tasks: Promise<void>[] = realFiles.map(async (file) => {
    const safeFileName = file.name.replace(/[/\\]/g, "_");
    const path = `${folder}/${safeFileName}`;
    const { error } = await supabase.storage.from(BUCKET_QUARANTINE).upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (error) failed.push({ name: file.name, message: error.message });
    else uploaded.push(safeFileName);
    tick();
  });

  if (params.metadata) {
    tasks.push(
      (async () => {
        const blob = new Blob([JSON.stringify(params.metadata, null, 2)], {
          type: "application/json",
        });
        const path = `${folder}/case_data.json`;
        const { error } = await supabase.storage
          .from(BUCKET_QUARANTINE)
          .upload(path, blob, {
            contentType: "application/json",
            upsert: true,
          });
        if (error) failed.push({ name: "case_data.json", message: error.message });
        else uploaded.push("case_data.json");
        tick();
      })(),
    );
  }

  await Promise.all(tasks);
  return { folder, uploaded, failed };
}
