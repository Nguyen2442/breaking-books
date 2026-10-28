import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

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

  // Extract or generate lightweight book cover
  const bookSlug = basename(bookDir);
  const coversDir = join(process.cwd(), 'public', 'covers');
  mkdirSync(coversDir, { recursive: true });

  let coverUrl = null;
  try {
    // 1. Try to extract embedded cover photo from PDF
    let idx = 0;
    while ((idx = buf.indexOf(Buffer.from([0xFF, 0xD8, 0xFF]), idx)) !== -1) {
      const end = buf.indexOf(Buffer.from([0xFF, 0xD9]), idx);
      if (end !== -1 && (end - idx) >= 12000) { // >= 12KB
        const imgBuf = buf.subarray(idx, end + 2);
        writeFileSync(join(coversDir, `${bookSlug}.jpg`), imgBuf);
        coverUrl = `/covers/${bookSlug}.jpg`;
        break;
      }
      idx += 3;
      if (idx > 12 * 1024 * 1024) break;
    }

    // 2. If no embedded cover, generate an ultra-lightweight (1.5KB) responsive SVG cover
    if (!coverUrl) {
      const safeTitle = (basename(pdfPath, '.pdf').replace(/^_?OceanofPDF\.com_?/i, '').replace(/[-_]/g, ' ').trim() || 'Book')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const safeAuthor = (data.info?.Author || 'Tác giả').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 850" width="600" height="850">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0f172a" />
            <stop offset="60%" stop-color="#1e293b" />
            <stop offset="100%" stop-color="#0d9488" />
          </linearGradient>
          <linearGradient id="spine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="rgba(255,255,255,0.25)" />
            <stop offset="25%" stop-color="rgba(0,0,0,0.4)" />
            <stop offset="100%" stop-color="transparent" />
          </linearGradient>
        </defs>
        <rect width="600" height="850" fill="url(#bg)" />
        <rect width="36" height="850" fill="url(#spine)" />
        <rect x="45" y="45" width="510" height="760" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2" rx="8" />
        <circle cx="300" cy="240" r="110" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="40" />
        <text x="75" y="380" font-family="system-ui, -apple-system, sans-serif" font-size="34" font-weight="800" fill="#ffffff">
          ${safeTitle.slice(0, 30)}
        </text>
        ${safeTitle.length > 30 ? `<text x="75" y="425" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="700" fill="#ffffff">${safeTitle.slice(30, 60)}</text>` : ''}
        <text x="75" y="520" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="600" fill="#2dd4bf" letter-spacing="2">
          ${safeAuthor.toUpperCase()}
        </text>
        <line x1="75" y1="550" x2="180" y2="550" stroke="#2dd4bf" stroke-width="3" />
        <text x="75" y="740" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="600" fill="rgba(255,255,255,0.5)" letter-spacing="1.5">
          BREAKING BOOKS INTERACTIVE
        </text>
      </svg>`;
      writeFileSync(join(coversDir, `${bookSlug}.svg`), svg, 'utf8');
      coverUrl = `/covers/${bookSlug}.svg`;
    }
  } catch (err) {
    console.warn('Cover processing warning:', err.message);
  }

  return {
    title: basename(pdfPath, '.pdf').replace(/^_?OceanofPDF\.com_?/i, '').replace(/[-_]/g, ' ').trim(),
    author: data.info?.Author || data.info?.author || '',
    totalPages,
    chapters: finalChapters,
    coverUrl,
  };
}
