"""Extract: parse every file in a case folder with LangChain loaders."""

from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

from triaj_agent import supabase_client
from triaj_agent.state import CaseState, ParsedDocument

_TEXT_EXTS = {".txt", ".md", ".log", ".eml", ".csv", ".json"}


def _load_file(path: Path) -> list[ParsedDocument]:
    ext = path.suffix.lower()
    try:
        if ext == ".pdf":
            from langchain_community.document_loaders import PyPDFLoader

            loader = PyPDFLoader(str(path))
        elif ext in {".docx", ".doc"}:
            from langchain_community.document_loaders import Docx2txtLoader

            loader = Docx2txtLoader(str(path))
        elif ext in _TEXT_EXTS or ext == "":
            from langchain_community.document_loaders import TextLoader

            loader = TextLoader(str(path), autodetect_encoding=True)
        else:
            return [
                ParsedDocument(
                    source=str(path),
                    content="",
                    metadata={"skipped": True, "reason": f"unsupported extension {ext}"},
                )
            ]
    except ImportError as e:
        raise RuntimeError(
            f"Missing LangChain loader dependency for '{ext}' files: {e}"
        ) from e

    return [
        ParsedDocument(source=str(path), content=d.page_content, metadata=dict(d.metadata))
        for d in loader.load()
    ]


def _list_local_folder(path: Path) -> list[ParsedDocument]:
    docs: list[ParsedDocument] = []
    for f in sorted(path.rglob("*")):
        if f.is_file():
            docs.extend(_load_file(f))
    return docs


def _download_supabase_folder(bucket: str, folder: str) -> Path:
    """Download every file at `{bucket}/{folder}` into a fresh temp dir.

    Uses the shared Supabase client (credentials from SUPABASE_URL /
    SUPABASE_ANON_KEY). Flat listing only — subfolders are skipped, matching
    the frontend's upload shape (`uploads-quarantine/{folder}/file.ext`).
    """

    client = supabase_client._lazy_client()
    if client is None:
        raise RuntimeError(
            "SUPABASE_URL / SUPABASE_ANON_KEY not set — cannot reach Storage"
        )

    storage = client.storage.from_(bucket)
    items = storage.list(folder) or []

    # `id is None` marks subfolder placeholders; `.emptyFolderPlaceholder` is
    # Supabase's zero-byte marker for manually-created folders. Everything else
    # is a real file (supabase-py 2.x returns list-of-dicts).
    files = [
        item
        for item in items
        if item.get("name")
        and item.get("name") != ".emptyFolderPlaceholder"
        and item.get("id") is not None
    ]

    if not files:
        # Include what the listing actually returned so the failure mode is
        # distinguishable in the trace — empty folder, RLS blocking, wrong
        # path, or only-subfolders all look the same from upstream otherwise.
        sample = [i.get("name") for i in items[:5]]
        raise RuntimeError(
            f"no downloadable files at '{bucket}/{folder}' "
            f"(list returned {len(items)} item(s); sample: {sample})"
        )

    tmp = Path(tempfile.mkdtemp(prefix="triaj-extract-"))
    for item in files:
        name = item["name"]
        data = storage.download(f"{folder}/{name}")
        (tmp / name).write_bytes(data)
    return tmp


def _extract_error(message: str) -> CaseState:
    return {
        "documents": [],
        "raw_content": "",
        "trace": [{"node": "extract", "status": "error", "message": message}],
    }


def extract(state: CaseState) -> CaseState:
    """Parse every file in the case folder with LangChain loaders.

    Reads from Supabase Storage using `storage_bucket` + `folder_name`
    (populated by `fetch_case` from the `cases` row) or from the local
    filesystem via `local_path` (dev/test escape hatch). Exactly one path
    must be resolvable.
    """

    local = (state.get("local_path") or "").strip()
    bucket = (state.get("storage_bucket") or "").strip()
    folder = (state.get("folder_name") or "").strip()

    source: str
    cleanup: Path | None = None

    if local:
        path = Path(local).expanduser().resolve()
        if not path.is_dir():
            return _extract_error(f"local folder not found: {path}")
        source = str(path)
    elif bucket and folder:
        try:
            path = _download_supabase_folder(bucket, folder)
        except Exception as e:
            return _extract_error(f"supabase download failed: {e}")
        source = f"supabase://{bucket}/{folder}"
        cleanup = path
    else:
        return _extract_error(
            "missing input: set `local_path`, or ensure fetch_case populated "
            "`storage_bucket` + `folder_name` from the case row"
        )

    try:
        docs = _list_local_folder(path)
    finally:
        if cleanup is not None:
            shutil.rmtree(cleanup, ignore_errors=True)

    raw = "\n\n".join(d.content for d in docs if d.content)
    return {
        "documents": docs,
        "raw_content": raw,
        "trace": [
            {
                "node": "extract",
                "status": "ok",
                "message": f"parsed {len(docs)} file(s) from {source}, {len(raw)} chars",
            }
        ],
    }
