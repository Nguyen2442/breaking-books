#!/usr/bin/env python3
"""
Extract TOC and per-chapter text from a PDF file using PyMuPDF (fitz).
Usage:
  uv run --with pymupdf python3 tools/pdf_extract.py <pdf_path> <out_dir>
Outputs JSON summary to stdout and writes text/ch1.txt ... text/chN.txt.
"""
import json
import os
import re
import sys
import fitz  # PyMuPDF


def clean_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_pdf(pdf_path: str, out_dir: str):
    doc = fitz.open(pdf_path)
    total_pages = len(doc)
    toc = doc.get_toc()  # [[lvl, title, page], ...]

    text_dir = os.path.join(out_dir, "text")
    os.makedirs(text_dir, exist_ok=True)

    # Save raw TOC
    with open(os.path.join(text_dir, "toc.txt"), "w", encoding="utf-8") as f:
        f.write(f"pages {total_pages}\n")
        for row in toc:
            f.write(repr(row) + "\n")

    # Filter top-level chapters from TOC (level 1 or 2 that look like chapters/sections)
    candidates = []
    skip_words = (
        "cover", "title page", "copyright", "table of contents", "contents",
        "preface", "foreword", "acknowledgment", "index", "colophon", "about the author"
    )
    for lvl, title, page in toc:
        t_clean = " ".join(title.split())
        if not t_clean:
            continue
        low = t_clean.lower()
        if any(low.startswith(w) or low == w for w in skip_words):
            continue
        if lvl == 1 or (lvl == 2 and re.match(r"^(chapter\s+\d+|\d+[\.\s])", low)):
            candidates.append({"title": t_clean, "page": max(1, min(page, total_pages))})

    # Deduplicate consecutive chapters starting on the same page or Part headers
    filtered = []
    for item in candidates:
        low = item["title"].lower()
        if re.match(r"^part\s+[ivx\d]+", low):
            continue
        if filtered and filtered[-1]["page"] == item["page"]:
            filtered[-1] = item
        else:
            filtered.append(item)

    # Fallback if PDF has no usable TOC: chunk every ~25 pages
    if not filtered:
        step = max(10, min(25, max(1, total_pages // 10)))
        idx = 1
        for start_p in range(1, total_pages + 1, step):
            filtered.append({
                "title": f"Chapter {idx} (Pages {start_p}–{min(total_pages, start_p + step - 1)})",
                "page": start_p
            })
            idx += 1

    # Cap at 25 chapters max to stay manageable
    filtered = filtered[:25]

    chapters = []
    full_chunks = []

    for i, ch in enumerate(filtered):
        n = i + 1
        start_page = ch["page"]  # 1-based
        end_page = filtered[i + 1]["page"] - 1 if i + 1 < len(filtered) else total_pages
        if end_page < start_page:
            end_page = start_page

        pages_text = []
        for pno in range(start_page - 1, end_page):
            if 0 <= pno < total_pages:
                pages_text.append(f"--- [Page {pno + 1}] ---\n" + doc[pno].get_text("text"))

        ch_text = clean_text("\n\n".join(pages_text))
        full_chunks.append(ch_text)

        ch_file = os.path.join(text_dir, f"ch{n}.txt")
        with open(ch_file, "w", encoding="utf-8") as f:
            f.write(ch_text)

        # Clean up leading chapter number in title if present (e.g., "1. Trade-offs..." -> "Trade-offs...")
        en_title = re.sub(r"^(?:Chapter\s+\d+[:\.\s-]*|\d+[:\.\s-]+)", "", ch["title"], flags=re.I).strip() or ch["title"]

        chapters.append({
            "n": n,
            "en": en_title,
            "vi": "",
            "src": f"tr.{start_page}–{end_page}",
            "pageStart": start_page,
            "pageEnd": end_page,
            "chars": len(ch_text)
        })

    with open(os.path.join(text_dir, "full.txt"), "w", encoding="utf-8") as f:
        f.write("\n\n====================\n\n".join(full_chunks))

    meta = doc.metadata or {}
    print(json.dumps({
        "ok": True,
        "totalPages": total_pages,
        "title": (meta.get("title") or "").strip(),
        "author": (meta.get("author") or "").strip(),
        "chapters": chapters
    }, ensure_ascii=False))


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"ok": False, "error": "Usage: pdf_extract.py <pdf_path> <out_dir>"}))
        sys.exit(1)
    extract_pdf(sys.argv[1], sys.argv[2])
