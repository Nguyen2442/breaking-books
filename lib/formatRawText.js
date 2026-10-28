/**
 * Smart formatter for raw PDF-extracted book chapters.
 * Unwraps broken lines, detects section headers, testimonials, quotes,
 * bullet lists, and formats them into a clean, legible reading layout.
 */
export function formatRawSourceTextHtml(raw) {
  if (!raw) return "";
  const clean = raw.replace(/\0/g, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rawLines = clean.split("\n");

  function isAttrContinuation(line, prevLine) {
    if (!line) return false;
    const p = prevLine.trim();
    if (/[.!?]$/.test(p)) return false;
    // If prevLine ends with preposition or comma, definitely continue
    if (/\b(at|of|for|in|to|with|and|by)\s*$/i.test(p) || /,\s*$/.test(p)) return true;
    if (/^[a-z,]/.test(line)) return true;
    if (/^(at|in|of|for|on|and|with|to)\b/i.test(line)) return true;
    if (/^[A-Za-z0-9&.,\-]+$/.test(line) && line.length < 30) return true;
    return false;
  }

  function isHeaderLine(line) {
    if (!line || line.length > 75) return false;
    if (/[.,:;]$/.test(line)) return false;
    if (/\b(to|the|and|or|with|of|for|in|on|at|from|by|is|are|was|were|have|has|had|that|which|who|as|an|a|into)\s*$/i.test(line)) return false;
    if (line === line.toUpperCase() && /[A-Z]/.test(line) && line.length < 50) return true;
    if (/^(Praise\s+for|Chapter\s+[0-9]+|Chương\s+[0-9]+|Section\s+[0-9]+|Part\s+[IVX0-9]+|Preface|Foreword|Introduction|Overview|Summary|About\s+the\s+Author)\b/i.test(line)) return true;
    if (/^[0-9]+(\.[0-9]+)*\s+[A-Z]/.test(line)) return true;
    return false;
  }

  const blocks = [];
  let curLines = [];

  function flushCur() {
    if (curLines.length === 0) return;
    const text = curLines.join(" ").replace(/\s+/g, " ").trim();
    if (text) blocks.push({ type: "p", text });
    curLines = [];
  }

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) {
      flushCur();
      continue;
    }

    // Check if line is an attribution (—Name or --Name)
    if (/^[—–-]\s*[A-Z]/.test(line)) {
      flushCur();
      let attrLines = [line];
      while (
        i + 1 < rawLines.length &&
        isAttrContinuation(rawLines[i + 1].trim(), attrLines[attrLines.length - 1])
      ) {
        i++;
        attrLines.push(rawLines[i].trim());
      }
      blocks.push({ type: "attribution", text: attrLines.join(" ") });
      continue;
    }

    // Check if bullet point
    if (/^([*•\-–]|\d+\.)\s+/.test(line)) {
      flushCur();
      blocks.push({ type: "bullet", text: line.replace(/^([*•\-–]|\d+\.)\s+/, "") });
      continue;
    }

    // Check if header
    if (curLines.length === 0 && isHeaderLine(line)) {
      blocks.push({ type: "h3", text: line });
      continue;
    }

    curLines.push(line);
  }
  flushCur();

  // Render HTML
  let html = [];
  let inList = false;

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];

    if (b.type === "bullet") {
      if (!inList) {
        html.push('<ul class="space-y-2.5 my-4 pl-6 list-disc marker:text-orange-500 text-slate-700 dark:text-slate-300 leading-relaxed text-[16px] sm:text-[17px]">');
        inList = true;
      }
      html.push(`<li>${escapeHtml(b.text)}</li>`);
      continue;
    } else if (inList) {
      html.push("</ul>");
      inList = false;
    }

    if (b.type === "h3") {
      html.push(`<h3 class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-10 mb-4 pb-2 border-b border-slate-200/80 dark:border-white/10 tracking-tight flex items-center gap-2.5">
        <span class="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0"></span>
        <span>${escapeHtml(b.text)}</span>
      </h3>`);
    } else if (b.type === "attribution") {
      html.push(`<div class="text-sm font-semibold text-orange-700 dark:text-orange-400 pl-4 border-l-2 border-orange-500/50 italic mb-6">
        ${escapeHtml(b.text)}
      </div>`);
    } else {
      // If the next block is an attribution, render this paragraph as a quote block
      const isQuote = (i + 1 < blocks.length && blocks[i + 1].type === "attribution");
      if (isQuote) {
        html.push(`<blockquote class="my-5 pl-4 sm:pl-5 border-l-3 border-orange-500/50 bg-orange-500/[0.04] dark:bg-orange-500/[0.06] p-4 sm:p-5 rounded-r-2xl space-y-2 shadow-xs">
          <p class="text-slate-800 dark:text-slate-200 italic leading-relaxed text-[16px] sm:text-[17px]">
            “${escapeHtml(b.text)}”
          </p>
        </blockquote>`);
      } else {
        html.push(`<p class="text-slate-700 dark:text-slate-300 leading-relaxed text-[16px] sm:text-[17px] mb-4">${escapeHtml(b.text)}</p>`);
      }
    }
  }
  if (inList) html.push("</ul>");

  return html.join("\n");
}
