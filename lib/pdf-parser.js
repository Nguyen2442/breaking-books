import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { PDFParse } from 'pdf-parse';

function cleanText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Pure JavaScript PDF text extractor and chapter splitter.
 * Zero external binary dependencies (no uv, no python, no poppler).
 * Runs seamlessly on Render, Vercel, Docker, Linux, macOS, and Windows.
 */
export async function extractPdfToChapters(pdfPath, bookDir) {
  const textDir = join(bookDir, 'text');
  mkdirSync(textDir, { recursive: true });

  const buf = readFileSync(pdfPath);
  const parser = new PDFParse({ data: buf });
  await parser.load();

  let info = {};
  try {
    info = await parser.getInfo();
  } catch {}

  const textResult = await parser.getText();
  const totalPages = textResult.total || (textResult.pages ? textResult.pages.length : 1);
  const fullText = cleanText(textResult.text || '');

  // Save raw full text
  writeFileSync(join(textDir, 'full.txt'), fullText, 'utf8');

  // Detect chapter markers from text:
  // e.g. "Chapter 1: ...", "Chương 1: ...", "1. Title", etc.
  const pageArray = textResult.pages || [];
  const candidates = [];

  const chapterRegex = /(?:^|\n)(?:(?:chapter|chương|part|phần)\s+([0-9ivxlcdm]+)[:.\s-]*([^\n]*)|([0-9]{1,2})\.\s+([A-ZÀ-Ỹ][^\n]{3,60}))/i;

  if (pageArray.length > 0) {
    for (let pIdx = 0; pIdx < pageArray.length; pIdx++) {
      const pageNum = pIdx + 1;
      const pageText = pageArray[pIdx].text || '';
      const match = pageText.match(chapterRegex);

      if (match) {
        const rawNum = match[1] || match[3];
        const rawTitle = (match[2] || match[4] || '').trim();
        const cleanTitle = rawTitle.replace(/^[0-9.:\s-]+/, '').trim() || `Chương ${rawNum}`;

        // Skip table of contents references or duplicate triggers
        const low = cleanTitle.toLowerCase();
        if (
          low.includes('table of contents') ||
          low.includes('mục lục') ||
          low.startsWith('copyright') ||
          low.startsWith('preface')
        ) {
          continue;
        }

        if (candidates.length === 0 || candidates[candidates.length - 1].page !== pageNum) {
          candidates.push({
            title: cleanTitle,
            page: pageNum,
            num: rawNum,
          });
        }
      }
    }
  }

  // Fallback: If no headings detected, split by page chunks (20-30 pages per chapter)
  let filtered = candidates;
  if (!filtered || filtered.length === 0) {
    const step = Math.max(15, Math.min(30, Math.ceil(totalPages / 10)));
    filtered = [];
    let idx = 1;
    for (let p = 1; p <= totalPages; p += step) {
      filtered.push({
        title: `Phần ${idx} (Trang ${p}–${Math.min(totalPages, p + step - 1)})`,
        page: p,
        num: idx,
      });
      idx++;
    }
  }

  // Cap maximum chapters at 25 for manageable learning chunks
  filtered = filtered.slice(0, 25);

  const chapters = [];
  for (let i = 0; i < filtered.length; i++) {
    const ch = filtered[i];
    const n = i + 1;
    const startPage = ch.page;
    const endPage = i + 1 < filtered.length ? filtered[i + 1].page - 1 : totalPages;

    let chText = '';
    if (pageArray.length > 0) {
      const chunks = [];
      for (let p = startPage - 1; p < endPage; p++) {
        if (pageArray[p]) {
          chunks.push(`--- [Trang ${p + 1}] ---\n` + (pageArray[p].text || ''));
        }
      }
      chText = cleanText(chunks.join('\n\n'));
    }

    if (!chText || chText.length < 100) {
      // Slice from fullText as fallback
      const roughFraction = Math.floor(fullText.length / filtered.length);
      chText = fullText.slice((n - 1) * roughFraction, n * roughFraction);
    }

    const chFile = join(textDir, `ch${n}.txt`);
    writeFileSync(chFile, chText, 'utf8');

    chapters.push({
      n,
      num: n,
      id: `ch${n}`,
      en: ch.title,
      vi: ch.title,
      src: 'PDF',
      page: startPage,
      pageCount: Math.max(1, endPage - startPage + 1),
    });
  }

  // Save generated TOC
  const tocSummary = `pages ${totalPages}\n` + chapters.map((c) => `Chương ${c.n}: ${c.vi} (Trang ${c.page})`).join('\n');
  writeFileSync(join(textDir, 'toc.txt'), tocSummary, 'utf8');

  return {
    title: info?.title || basename(pdfPath, '.pdf').replace(/[-_]/g, ' '),
    author: info?.author || '',
    totalPages,
    chapters,
  };
}
