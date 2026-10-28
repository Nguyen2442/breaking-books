import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { resolveBookCover } from './covers.js';

function cleanText(text) {
  return String(text || '')
    .replace(/[\x00\u0000]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Pure JavaScript PDF text extractor and chapter splitter.
 * Uses lightweight, standalone pdf-parse (v1.1.1) with ZERO worker files,
 * zero python/uv dependencies, and zero webpack chunk failures on Render/Cloud.
 */
export async function extractPdfToChapters(pdfPath, bookDir) {
  const textDir = join(bookDir, 'text');
  mkdirSync(textDir, { recursive: true });

  const buf = readFileSync(pdfPath);
  const data = await pdfParse(buf);

  const totalPages = data.numpages || 1;
  const fullText = cleanText(data.text || '');

  // Save raw full text
  writeFileSync(join(textDir, 'full.txt'), fullText, 'utf8');

  // Multi-pattern chapter detection
  const lines = fullText.split('\n');
  const hfRegex = /^this is a new chapter\s+([0-9]+)/i;
  // Match explicit chapter headings: Chapter 1: ..., Chương 1: ..., Part 1: ...
  // Exclude numbered list items like "1. Do this" or lines ending with page numbers (Table of Contents)
  const standardRegex = /^(?:(?:chapter|chương|part|phần)\s+([0-9ivxlcdm]+)[:.\s-]*([^\n]*))$/i;

  // Pre-scan to check if explicit chapter markers exist
  const detectedMarkers = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Skip Table of Contents lines (ending in page numbers or dots) in the first 250 lines
    if (i < 250 && (/\.{3,}\s*\d+$/.test(trimmed) || /\s+\d{1,4}$/.test(trimmed))) {
      continue;
    }

    const hfMatch = trimmed.match(hfRegex);
    if (hfMatch) {
      const line1 = cleanText(lines[i + 1] || '');
      const line2 = cleanText(lines[i + 2] || '');
      let title = line1;
      if (line2 && !line2.match(/^[0-9]+$/)) {
        title = `${line1} - ${line2}`.replace(/^[0-9\s.-]+/, '').trim();
      }
      detectedMarkers.push({ lineIndex: i, num: detectedMarkers.length + 1, title: cleanText(title) });
      continue;
    }

    const stdMatch = trimmed.match(standardRegex);
    if (stdMatch && i > 20) {
      const chNumStr = stdMatch[1];
      const rawTitle = stdMatch[2] ? stdMatch[2].trim() : `Chương ${chNumStr}`;
      const title = cleanText(rawTitle || `Chương ${chNumStr}`);
      detectedMarkers.push({ lineIndex: i, num: detectedMarkers.length + 1, title });
    }
  }

  const chapters = [];
  let currentNum = 1;
  let currentTitle = detectedMarkers[0]?.title || 'Mở đầu & Tổng quan';
  let currentLines = [];

  const useMarkers = detectedMarkers.length >= 2;

  function sanitizeChapterText(txt) {
    return String(txt || '')
      .replace(/\0/g, '')
      .replace(/([A-Za-zÀ-ỹ]{2,})-\s*\n\s*([a-zà-ỹ]{2,})/g, '$1$2')
      .replace(/^(?:_?oceanofpdf\.com_?|downloaded\s+from|www\.[\w.-]+|page\s+\d+(\s+of\s+\d+)?|\d+\s*\|\s*chapter)\b.*$/gim, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const marker = useMarkers ? detectedMarkers.find((m) => m.lineIndex === i) : null;
    const wordCount = currentLines.join(' ').split(/\s+/).length;

    // Split if marker hit (ensure chapter has at least 400 words) OR (when no markers) word budget exceeded (3500 words)
    if (((marker && wordCount >= 400) || (!useMarkers && wordCount >= 3500)) && currentLines.length > 30) {
      const chText = sanitizeChapterText(currentLines.join('\n'));
      const chFile = join(textDir, `ch${currentNum}.txt`);
      writeFileSync(chFile, chText, 'utf8');

      chapters.push({
        n: currentNum,
        num: currentNum,
        id: `ch${currentNum}`,
        en: currentTitle,
        vi: currentTitle,
        src: 'PDF',
        wordCount: chText.split(/\s+/).length,
      });

      currentNum++;
      currentTitle = marker ? marker.title : `Phần ${currentNum}`;
      currentLines = [];
    }

    currentLines.push(line);
  }

  // Save the last chapter
  if (currentLines.length > 0) {
    const chText = sanitizeChapterText(currentLines.join('\n'));
    const chFile = join(textDir, `ch${currentNum}.txt`);
    writeFileSync(chFile, chText, 'utf8');

    chapters.push({
      n: currentNum,
      num: currentNum,
      id: `ch${currentNum}`,
      en: currentTitle,
      vi: currentTitle,
      src: 'PDF',
      wordCount: chText.split(/\s+/).length,
    });
  }

  // Cap at 25 chapters
  const finalChapters = chapters.slice(0, 25);

  // Save generated TOC
  const tocSummary = `pages ${totalPages}\n` + finalChapters.map((c) => `Chương ${c.n}: ${c.vi}`).join('\n');
  writeFileSync(join(textDir, 'toc.txt'), tocSummary, 'utf8');

  // Resolve authentic book cover via Multi-Tier Resolution Pipeline
  const bookSlug = basename(bookDir);
  const cleanBookTitle = cleanText(basename(pdfPath, '.pdf').replace(/^_?OceanofPDF\.com_?/i, '').replace(/[-_]/g, ' '));
  const authorName = cleanText(data.info?.Author || data.info?.author || '');

  const coverUrl = await resolveBookCover({
    bookSlug,
    title: cleanBookTitle,
    author: authorName,
    pdfBuf: buf,
    firstPagesText: fullText.slice(0, 15000),
  });

  return {
    title: cleanBookTitle,
    author: authorName,
    totalPages,
    chapters: finalChapters,
    coverUrl,
  };
}
