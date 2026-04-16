"""Shared LangChain document loaders.

Factored out of `nodes.py` so `supabase_client.list_policy_documents()` can
extract text from bytes downloaded from the Supabase storage bucket without
a circular import on the nodes module.
"""

from __future__ import annotations

import tempfile
from pathlib import Path

from triaj_agent.state import ParsedDocument

_TEXT_EXTS = {".txt", ".md", ".log", ".eml", ".csv", ".json"}


def load_file(path: Path) -> list[ParsedDocument]:
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


def load_bytes_as_text(filename: str, data: bytes) -> str:
    """Extract plain text from in-memory bytes by writing to a temp file.

    Used by the policies-bucket reader — Supabase storage gives us bytes, the
    LangChain loaders want a filesystem path.
    """

    suffix = Path(filename).suffix
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(data)
        tmp = Path(f.name)
    try:
        docs = load_file(tmp)
        return "\n\n".join(d.content for d in docs if d.content)
    finally:
        tmp.unlink(missing_ok=True)
