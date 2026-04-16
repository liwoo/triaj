type FsFileEntry = {
  isFile: true;
  isDirectory: false;
  name: string;
  file: (onSuccess: (file: File) => void, onError?: (err: unknown) => void) => void;
};

type FsDirEntry = {
  isFile: false;
  isDirectory: true;
  name: string;
  createReader: () => { readEntries: (cb: (entries: FsEntry[]) => void) => void };
};

type FsEntry = FsFileEntry | FsDirEntry;

function getAsEntry(item: DataTransferItem): FsEntry | null {
  const anyItem = item as unknown as {
    webkitGetAsEntry?: () => FsEntry | null;
    getAsEntry?: () => FsEntry | null;
  };
  return (anyItem.webkitGetAsEntry?.() ?? anyItem.getAsEntry?.() ?? null);
}

function readAllEntries(dir: FsDirEntry): Promise<FsEntry[]> {
  return new Promise((resolve) => {
    const reader = dir.createReader();
    const all: FsEntry[] = [];
    const step = () => {
      reader.readEntries((batch) => {
        if (batch.length === 0) return resolve(all);
        all.push(...batch);
        step();
      });
    };
    step();
  });
}

function fileFromEntry(entry: FsFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

async function walk(entry: FsEntry, out: File[]): Promise<void> {
  if (entry.isFile) {
    try {
      out.push(await fileFromEntry(entry));
    } catch {
      // skip unreadable entries (permission quirks etc.)
    }
    return;
  }
  const children = await readAllEntries(entry);
  await Promise.all(children.map((c) => walk(c, out)));
}

export async function extractFilesFromDrop(
  dt: DataTransfer,
): Promise<File[]> {
  if (dt.items && dt.items.length > 0 && typeof (dt.items[0] as unknown as { webkitGetAsEntry?: () => unknown }).webkitGetAsEntry === "function") {
    const out: File[] = [];
    const items = Array.from(dt.items).filter((i) => i.kind === "file");
    await Promise.all(
      items.map(async (item) => {
        const entry = getAsEntry(item);
        if (entry) {
          await walk(entry, out);
        } else {
          const f = item.getAsFile();
          if (f) out.push(f);
        }
      }),
    );
    return out;
  }

  // Fallback: dataTransfer.files (browsers without entry API won't recurse
  // into folders). Filter out obvious folder sentinels: size=0 AND no type.
  return Array.from(dt.files).filter((f) => !(f.size === 0 && f.type === ""));
}
