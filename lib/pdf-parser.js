import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { resolveBookCover } from './covers.js';

function cleanText(text) {
  return String(text || '')
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

  // Regex to split into chapters
  const lines = fullText.split('\n');
  const chapterRegex = /^(?:(?:chapter|chương|part|phần)\s+([0-9ivxlcdm]+)[:.\s-]*([^\n]*)|([0-9]{1,2})\.\s+([A-ZÀ-Ỹ][^\n]{3,60}))$/i;

  const chapters = [];
  let currentNum = 1;
  let currentTitle = 'Mở đầu & Tổng quan';
  let currentLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(chapterRegex);
    const wordCount = currentLines.join(' ').split(/\s+/).length;

    // Split if new chapter heading matched OR word budget exceeded (2500 - 4000 words)
    if ((match || wordCount >= 3500) && currentLines.length > 80) {
      const chText = cleanText(currentLines.join('\n'));
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
      if (match) {
        currentTitle = (match[2] || match[4] || `Chương ${match[1] || match[3]}`).trim();
      } else {
        currentTitle = `Phần ${currentNum}`;
      }
      currentLines = [];
    }

    currentLines.push(line);
  }

  // Save the last chapter
  if (currentLines.length > 0) {
    const chText = cleanText(currentLines.join('\n'));
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
  const cleanBookTitle = basename(pdfPath, '.pdf').replace(/^_?OceanofPDF\.com_?/i, '').replace(/[-_]/g, ' ').trim();
  const authorName = data.info?.Author || data.info?.author || '';

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
