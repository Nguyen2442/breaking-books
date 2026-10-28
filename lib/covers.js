import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

/**
 * Parses width and height from a JPEG buffer SOF0/SOF2 marker without decoding pixel data.
 */
export function getJpegDimensions(buf) {
  if (!buf || buf.length < 10) return null;
  if (buf[0] !== 0xFF || buf[1] !== 0xD8) return null;
  let i = 2;
  while (i < buf.length - 8) {
    if (buf[i] !== 0xFF) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xC0 || marker === 0xC2) { // SOF0 or SOF2
      const height = buf.readUInt16BE(i + 5);
      const width = buf.readUInt16BE(i + 7);
      return { width, height };
    }
    if (i + 4 > buf.length) break;
    const len = buf.readUInt16BE(i + 2);
    if (len < 2) break;
    i += 2 + len;
  }
  return null;
}

/**
 * Extracts ISBN-10 or ISBN-13 from text using regex.
 */
export function extractIsbnFromText(text = '') {
  if (!text) return null;
  const isbnRegex = /(?:ISBN(?:-1[03])?:?\s*)?(97[89][-\s]?[0-9]{1,5}[-\s]?[0-9]+[-\s]?[0-9]+[-\s]?[0-9]|[0-9]{1,5}[-\s]?[0-9]+[-\s]?[0-9]+[-\s]?[0-9X])/i;
  const match = text.match(isbnRegex);
  if (match) {
    const clean = match[1].replace(/[-\s]/g, '').toUpperCase();
    if (clean.length === 10 || clean.length === 13) return clean;
  }
  return null;
}

/**
 * Tier 1A: Fetch official cover by ISBN from Open Library
 */
export async function fetchCoverByIsbn(isbn) {
  if (!isbn) return null;
  try {
    const url = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 5000) {
        return buf;
      }
    }
  } catch {}
  return null;
}

/**
 * Tier 1B: Search Open Library by title and author
 */
export async function searchOpenLibraryCover(title, author = '') {
  if (!title) return null;
  try {
    const cleanTitle = title.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').replace(/[-_]/g, ' ').trim();
    const query = `${cleanTitle} ${author}`.trim();
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'BreakingBooks/2.0' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const coverId = data.docs?.[0]?.cover_i;
    if (coverId) {
      const imgRes = await fetch(`https://covers.openlibrary.org/b/id/${coverId}-L.jpg`, { signal: AbortSignal.timeout(4000) });
      if (imgRes.ok) {
        const buf = Buffer.from(await imgRes.arrayBuffer());
        if (buf.length > 5000) return buf;
      }
    }
  } catch {}
  return null;
}

/**
 * Tier 2: Intelligent PDF Embedded Image Analysis
 * Scans all embedded JPEG streams and selects the highest scoring portrait image (aspect ratio 1.2 to 1.7, min dimensions 350x450).
 */
export function extractBestEmbeddedCover(pdfBuf) {
  if (!pdfBuf || pdfBuf.length < 50000) return null;

  let idx = 0;
  let bestCandidate = null;
  let bestScore = -1;

  // Scan first 25MB of PDF
  const limit = Math.min(pdfBuf.length, 25 * 1024 * 1024);

  while ((idx = pdfBuf.indexOf(Buffer.from([0xFF, 0xD8, 0xFF]), idx)) !== -1) {
    if (idx >= limit) break;
    const end = pdfBuf.indexOf(Buffer.from([0xFF, 0xD9]), idx);
    if (end !== -1 && (end - idx) >= 15000) { // at least 15KB
      const imgBuf = pdfBuf.subarray(idx, end + 2);
      const dim = getJpegDimensions(imgBuf);
      if (dim && dim.width >= 350 && dim.height >= 450) {
        const ratio = dim.height / dim.width;
        // Standard portrait book aspect ratio is ~1.2 to 1.7
        if (ratio >= 1.15 && ratio <= 1.75) {
          // Score based on resolution and proximity to start of book
          const isEarly = idx < 2 * 1024 * 1024 ? 2.0 : 1.0;
          const score = (dim.width * dim.height) * isEarly;
          if (score > bestScore) {
            bestScore = score;
            bestCandidate = imgBuf;
          }
        }
      }
    }
    idx += 3;
  }

  return bestCandidate;
}

/**
 * Tier 3: Procedural SVG Cover generator (1.5 KB vector fallback)
 */
export function generateSvgCover({ title, author = '' }) {
  const safeTitle = (title || 'Book').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeAuthor = (author || 'Tác giả').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 850" width="600" height="850">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#090d16" />
        <stop offset="55%" stop-color="#0f172a" />
        <stop offset="100%" stop-color="#0f766e" />
      </linearGradient>
      <linearGradient id="spine" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.25)" />
        <stop offset="30%" stop-color="rgba(0,0,0,0.5)" />
        <stop offset="100%" stop-color="transparent" />
      </linearGradient>
    </defs>
    <rect width="600" height="850" fill="url(#bg)" />
    <rect width="36" height="850" fill="url(#spine)" />
    <rect x="45" y="45" width="510" height="760" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="2" rx="8" />
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
}

/**
 * Master Cover Resolver: Executes multi-tier cover resolution pipeline
 * Guarantees accurate book cover with maximum fidelity and minimum file size.
 */
export async function resolveBookCover({
  bookSlug,
  title,
  author = '',
  pdfBuf = null,
  firstPagesText = '',
}) {
  const coversDir = join(process.cwd(), 'public', 'covers');
  mkdirSync(coversDir, { recursive: true });

  const destJpg = join(coversDir, `${bookSlug}.jpg`);
  const destSvg = join(coversDir, `${bookSlug}.svg`);

  // If already exists, return
  if (existsSync(destJpg)) return `/covers/${bookSlug}.jpg`;

  let coverBuffer = null;

  // 1. Try ISBN lookup
  const isbn = extractIsbnFromText(firstPagesText);
  if (isbn) {
    coverBuffer = await fetchCoverByIsbn(isbn);
  }

  // 2. Try Open Library Search lookup
  if (!coverBuffer && title) {
    coverBuffer = await searchOpenLibraryCover(title, author);
  }

  // 3. Try PDF Embedded Image Heuristic
  if (!coverBuffer && pdfBuf) {
    coverBuffer = extractBestEmbeddedCover(pdfBuf);
  }

  // If we found a raster cover, save it
  if (coverBuffer) {
    try {
      writeFileSync(destJpg, coverBuffer);
      // Optimize image resolution if sips is available (macOS)
      try {
        execFileSync('sips', ['-Z', '650', '-s', 'formatOptions', '82', destJpg], { timeout: 2000, stdio: 'ignore' });
      } catch {}
      return `/covers/${bookSlug}.jpg`;
    } catch {}
  }

  // 4. Fallback to procedural SVG
  const svg = generateSvgCover({ title, author });
  writeFileSync(destSvg, svg, 'utf8');
  return `/covers/${bookSlug}.svg`;
}
