/**
 * Smart, Book-Quality Formatter for raw PDF-extracted text.
 * - Heals broken hyphenated words across lines (e.g. "dis-\ntributed" -> "distributed")
 * - Detects true paragraph breaks based on line length (< 62 chars) & punctuation
 * - Strips running headers, footers, page numbers, watermarks
 * - Reassembles sentences broken across PDF page breaks
 * - Formats headings, quotes, lists, code blocks, and prose with book-grade typography
 */

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isHeaderLine(line) {
  if (!line || line.length > 70) return false;
  // If ends with typical sentence punctuation, it is NOT a header
  if (/[.,;]$/.test(line)) return false;
  // Common header indicators
  if (/^(?:Chapter|Chương|Section|Part|Mục|Phần)\s+\d+/i.test(line)) return true;
  if (/^[0-9]+(?:\.[0-9]+)+\s+[A-ZÀ-Ỹ]/i.test(line)) return true;
  if (/^(?:A\s+NOTE|PREFACE|FOREWORD|INTRODUCTION|OVERVIEW|SUMMARY|ABOUT\s+THE\s+AUTHOR|PRAISE\s+FOR)\b/i.test(line)) return true;
  // Standalone uppercase title (e.g. "ARCHITECTURE", "DATA MODELS")
  if (line === line.toUpperCase() && /[A-Z]/.test(line) && line.length >= 3 && line.length <= 45) return true;
  // Title-cased short phrase without conjunction at end
  if (/^[A-ZÀ-Ỹ][A-Za-zÀ-ỹ0-9\s:,-]{3,50}$/.test(line) && !/\b(to|the|and|or|with|of|for|in|on|at|from|by|is|are|a|an)\s*$/i.test(line)) {
    // Has at least 2 capitalized words
    const words = line.split(/\s+/);
    if (words.length <= 7 && words.filter(w => /^[A-ZÀ-Ỹ]/.test(w)).length >= Math.ceil(words.length / 2)) {
      return true;
    }
  }
  return false;
}

export function formatRawSourceTextHtml(raw) {
  if (!raw || typeof raw !== "string") return "";

  // 1. Sanitize text & unwrap broken line hyphens
  let text = raw
    .replace(/\0/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  // Fix words broken with hyphens across line breaks: e.g. "com-\npute" -> "compute"
  text = text.replace(/([A-Za-zÀ-ỹ]{2,})-\s*\n\s*([a-zà-ỹ]{2,})/g, "$1$2");

  const lines = text.split("\n");
  const filteredLines = [];

  // Filter out running headers, footers, standalone page numbers, and download watermarks
  const watermarkRegex = /^(?:_?oceanofpdf\.com_?|downloaded\s+from|www\.[\w.-]+|https?:\/\/|page\s+\d+(\s+of\s+\d+)?|\d+\s*\|\s*chapter|\bchapter\s+\d+\s*\|\s*)/i;
  const pageNumRegex = /^\s*\d{1,4}\s*$/;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      filteredLines.push("");
      continue;
    }

    // Skip isolated page numbers
    if (pageNumRegex.test(trimmed)) continue;

    // Skip running headers and watermarks
    if (watermarkRegex.test(trimmed)) continue;

    // Skip repetitive copyright notices
    if (/^(all rights reserved|copyright\s+©|\(c\)\s*\d{4})/i.test(trimmed)) continue;

    filteredLines.push(trimmed);
  }

  // 2. Intelligent Line Grouping with Paragraph & Header Detection
  const blocks = [];
  let curPara = [];

  function flushPara() {
    if (curPara.length === 0) return;
    const joined = curPara.join(" ").replace(/\s+/g, " ").trim();
    if (joined) blocks.push({ type: "p", text: joined });
    curPara = [];
  }

  for (let i = 0; i < filteredLines.length; i++) {
    const line = filteredLines[i];

    if (!line) {
      flushPara();
      continue;
    }

    // Check if line is an Attribution (—Author, --Author)
    if (/^[—–-]\s*[A-ZÀ-Ỹ]/.test(line)) {
      flushPara();
      blocks.push({ type: "attribution", text: line });
      continue;
    }

    // Check if line is a Bullet or List item
    if (/^([*•\-–]|\d+[\.)])\s+/.test(line)) {
      flushPara();
      blocks.push({ type: "bullet", text: line.replace(/^([*•\-–]|\d+[\.)])\s+/, "") });
      continue;
    }

    // Check if standalone Header
    if (curPara.length === 0 && isHeaderLine(line)) {
      blocks.push({ type: "h3", text: line });
      continue;
    }

    curPara.push(line);

    // Check if this line is likely the natural end of a paragraph
    const nextLine = (i + 1 < filteredLines.length) ? filteredLines[i + 1] : "";
    if (nextLine) {
      const endsWithPeriod = /[.!?:]\s*$/.test(line);
      const isShortLine = line.length < 62;
      const nextStartsCapital = /^[A-ZÀ-Ỹ0-9“"‘'—–-]/.test(nextLine);

      if (endsWithPeriod && isShortLine && nextStartsCapital) {
        flushPara();
      }
    }
  }
  flushPara();

  // 3. Stitched and Format Blocks to HTML
  const htmlParts = [];
  let inList = false;

  function flushList() {
    if (inList) {
      htmlParts.push("</ul>");
      inList = false;
    }
  }

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];

    if (b.type === "bullet") {
      if (!inList) {
        htmlParts.push('<ul class="my-4 space-y-2.5 pl-6 list-disc marker:text-orange-500 text-slate-700 dark:text-slate-300 text-[15px] sm:text-[16px] leading-relaxed">');
        inList = true;
      }
      htmlParts.push(`<li>${escapeHtml(b.text)}</li>`);
      continue;
    } else {
      flushList();
    }

    if (b.type === "h3") {
      htmlParts.push(`
        <h3 class="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white mt-8 mb-3 pb-2 border-b border-slate-100 dark:border-white/[0.08] tracking-tight flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-orange-500 shrink-0"></span>
          <span>${escapeHtml(b.text)}</span>
        </h3>
      `);
      continue;
    }

    if (b.type === "attribution") {
      htmlParts.push(`
        <div class="text-xs sm:text-sm font-semibold text-orange-600 dark:text-orange-400 pl-4 border-l-2 border-orange-500/60 italic mb-5">
          ${escapeHtml(b.text)}
        </div>
      `);
      continue;
    }

    // Check if paragraph is a quote (starts and ends with quotation marks or immediately precedes an attribution)
    const nextIsAttr = (i + 1 < blocks.length && blocks[i + 1].type === "attribution");
    const isQuote = (b.text.startsWith("“") || b.text.startsWith('"')) || nextIsAttr;

    if (isQuote) {
      htmlParts.push(`
        <blockquote class="my-5 pl-4 sm:pl-5 border-l-3 border-orange-500 bg-orange-50/60 dark:bg-orange-500/[0.05] p-4 sm:p-5 rounded-r-2xl space-y-1">
          <p class="text-slate-800 dark:text-slate-200 italic leading-relaxed text-[15px] sm:text-[16px]">
            ${escapeHtml(b.text)}
          </p>
        </blockquote>
      `);
      continue;
    }

    // Regular Prose Paragraph
    htmlParts.push(`
      <p class="text-slate-700 dark:text-slate-300 leading-relaxed text-[15px] sm:text-[16px] mb-4 selection:bg-orange-500/20">
        ${escapeHtml(b.text)}
      </p>
    `);
  }

  flushList();

  return htmlParts.join("\n");
}
