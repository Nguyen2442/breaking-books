import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { isDbAvailable, saveChapterToDb } from './db.js';
import { parseHtmlJsToJsonb } from './chapter-jsonb.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const FALLBACK_MODEL = 'gemini-3.5-flash-lite';

/**
 * Direct HTTP caller for Google Gemini REST API
 */
export async function callGemini({
  prompt,
  systemInstruction = '',
  temperature = 0.2,
  model = PRIMARY_MODEL,
  onLog = () => {},
}) {
  const modelsToTry = [model, FALLBACK_MODEL];
  let lastError = null;

  for (const currentModel of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${GEMINI_API_KEY}`;
    
    const bodyPayload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: 32768,
      },
    };

    if (systemInstruction) {
      bodyPayload.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    onLog('info', `Đang kết nối Gemini API (${currentModel})...`);

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload),
          signal: controller.signal,
        });

        clearTimeout(timeout);
        const data = await res.json();

        if (res.status === 503 || res.status === 429) {
          onLog('warn', `Gemini API bận (${res.status}). Đang thử lại lần ${attempt}/3 sau ${attempt * 3}s...`);
          await new Promise((r) => setTimeout(r, attempt * 3000));
          continue;
        }

        if (!res.ok) {
          throw new Error(data.error?.message || `HTTP ${res.status}`);
        }

        const candidate = data.candidates?.[0];
        const text = candidate?.content?.parts?.[0]?.text;
        if (!text) throw new Error('Không nhận được nội dung phản hồi từ Gemini API');

        onLog('ok', `Gemini (${currentModel}) phản hồi thành công (${data.usageMetadata?.totalTokenCount || 0} tokens).`);
        return text;
      } catch (err) {
        lastError = err;
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }
  }

  throw lastError || new Error('Không thể kết nối Gemini API sau nhiều lần thử');
}

/**
 * Extract code block from AI markdown response (removes ```html / ```javascript wrappers)
 */
function extractCleanCode(raw, lang) {
  let text = String(raw || '').trim();
  const pattern = new RegExp(`^\\s*\`\`\`(?:${lang})?\\s*\\n?([\\s\\S]*?)\`\`\`\\s*$`, 'i');
  const match = text.match(pattern);
  if (match) return match[1].trim();

  // If text starts with ``` but doesn't end cleanly
  if (text.startsWith('```')) {
    text = text.replace(/^```[a-zA-Z]*\n?/, '').replace(/```\s*$/, '');
  }
  return text.trim();
}

/**
 * Break a chapter using Google Gemini API
 */
export async function breakChapterWithGemini({
  bookDir,
  bookMeta,
  chNum,
  onLog = () => {},
}) {
  const targetCh = Number(chNum);
  const ch = (bookMeta.chapters || []).find((c) => c.n === targetCh) || { n: targetCh, en: `Chapter ${targetCh}` };

  onLog('info', `=== BẮT ĐẦU BREAK CHƯƠNG ${targetCh}: "${ch.en}" BẰNG GEMINI 3.5 AI ===`);

  // 1. Read Raw Text
  let rawText = '';
  const possiblePaths = [
    join(bookDir, 'text', `ch${targetCh}.txt`),
    join(bookDir, 'text', `ch0${targetCh}.txt`),
  ];
  for (const p of possiblePaths) {
    if (existsSync(p)) {
      rawText = readFileSync(p, 'utf8');
      break;
    }
  }

  if (!rawText) {
    onLog('warn', `Không tìm thấy file text gốc tại text/ch${targetCh}.txt, sẽ dựa trên tên chương "${ch.en}".`);
  } else {
    onLog('info', `Đã nạp văn bản gốc: ${(rawText.length / 1024).toFixed(0)} KB (${rawText.split(/\s+/).length} từ).`);
  }

  // Read Contract for conventions
  const contractPath = join(bookDir, 'CONTRACT.md');
  const contract = existsSync(contractPath) ? readFileSync(contractPath, 'utf8') : '';

  const systemInstruction = `
Bạn là Principal Software Architect và Senior Engineering Mentor hàng đầu.
Nhiệm vụ của bạn là bóc tách (break) chương sách kỹ thuật này thành hai phần hoàn chỉnh:
1. File HTML bài học (src/ch${targetCh}.html)
2. File JavaScript cài đặt các phòng thí nghiệm SVG tương tác (src/ch${targetCh}.js)

TUÂN THỦ NGUYÊN TẮC:
- Súc tích, thực tế, zero-fluff, loại bỏ hoàn toàn lối dịch máy cứng nhắc.
- Dùng tiếng Việt chuẩn kỹ sư, giữ thuật ngữ tiếng Anh quan trọng trong <dfn data-term="...">.
- Mỗi bài học (topic) PHẢI có một phòng thí nghiệm <figure class="lab" data-widget="..."> thao tác trực quan.
- Cuối chương luôn có bài tổng kết và quiz ôn tập 6-8 câu hỏi trắc nghiệm kèm giải thích chuyên sâu.
- Trong JS: tuân thủ CONTRACT.md, sử dụng helper window.DDIA (h, s, clear, fmt, slider, seg, button, stat, log, widget, glossary).
`;

  // STEP 1: Generate src/chN.html
  onLog('info', `[1/3] Đang soạn thảo bài học trực quan (src/ch${targetCh}.html)...`);
  const htmlPrompt = `
Hãy viết toàn bộ nội dung file \`src/ch${targetCh}.html\` cho Sách "${bookMeta.title}" · Chương ${targetCh}: "${ch.en}" (${ch.vi || ''}).

Văn bản nguồn của chương:
${rawText.slice(0, 45000)}

QUY CÁCH FILE HTML:
- Bắt đầu bằng thẻ <section class="chapter" id="ch${targetCh}" data-ch="${targetCh}" data-title="${ch.vi || ch.en}">
- Có .chapter-head với .chapter-num, h1 (tiêu đề EN + <span class="vi">Tiêu đề VI</span>), .chapter-lede, và .chapter-meta pills.
- Có 8–12 bài học (<article class="topic" id="ch${targetCh}-slug" data-num="${targetCh}.1" data-short="...">).
- Mỗi topic gồm: .eyebrow, h2, .tldr, .prose với các thuật ngữ <dfn data-term="...">, <figure class="lab" data-widget="ch${targetCh}-widget-name">, và .callout (key/warn/real).
- Cuối cùng là topic review: <article class="topic" id="ch${targetCh}-review" data-num="${targetCh}.★" data-short="Tổng kết & kiểm tra"> có .quiz với 6–8 câu hỏi <div class="q" data-answer="1">.
- Kết thúc bằng đóng thẻ </section>.

CHỈ TRẢ VỀ NỘI DUNG HTML, KHÔNG KÈM GIẢI THÍCH THÊM.
`;

  const rawHtml = await callGemini({
    prompt: htmlPrompt,
    systemInstruction,
    onLog,
  });

  const cleanHtml = extractCleanCode(rawHtml, 'html');
  const htmlFile = join(bookDir, 'src', `ch${targetCh}.html`);
  writeFileSync(htmlFile, cleanHtml, 'utf8');
  onLog('ok', `✓ Đã tạo thành công src/ch${targetCh}.html (${(cleanHtml.length / 1024).toFixed(1)} KB)`);

  // Extract all data-widgets declared in the HTML
  const widgetMatches = [...cleanHtml.matchAll(/data-widget="([^"]+)"/g)].map((m) => m[1]);
  const uniqueWidgets = [...new Set(widgetMatches)];
  onLog('info', `[2/3] Phát hiện ${uniqueWidgets.length} interactive widgets cần cài đặt trong JS: ${uniqueWidgets.join(', ')}`);

  // STEP 2: Generate src/chN.js
  const jsPrompt = `
Hãy viết toàn bộ file \`src/ch${targetCh}.js\` cho Chương ${targetCh} của sách "${bookMeta.title}".

HTML của chương đã khai báo các thẻ data-widget sau:
${uniqueWidgets.map((w, i) => `${i + 1}. ${w}`).join('\n')}

QUY CÁCH FILE JS:
- Bọc toàn bộ trong IIFE: (function() { 'use strict'; const { h, s, clear, fmt, fmtBig, fmtMs, pct, rng, clamp, sleep, slider, seg, button, checkbox, stat, log, widget, glossary } = window.DDIA; ... })();
- Cài đặt đầy đủ ${uniqueWidgets.length} widget bằng cú pháp: widget('tên-widget', (root) => { ... });
- Mỗi widget tạo ra các controls (slider, seg, button), thẻ SVG tương tác minh họa trực quan (dùng class f-accent, s-accent, f-ok, s-ok, f-warn, s-warn, f-bad, s-bad, f-surface2, s-line), và stat/log.
- Cuối file gọi glossary.add([...]) đăng ký giải nghĩa song ngữ cho tất cả các thuật ngữ <dfn data-term="..."> xuất hiện trong chương.
- Đảm bảo mã JavaScript hợp lệ 100%, không có lỗi cú pháp.

CHỈ TRẢ VỀ MÃ JAVASCRIPT THUẦN TÚY, BẮT ĐẦU TỪ (function () { ĐẾN })();
`;

  const rawJs = await callGemini({
    prompt: jsPrompt,
    systemInstruction,
    onLog,
  });

  const cleanJs = extractCleanCode(rawJs, 'javascript');
  const jsFile = join(bookDir, 'src', `ch${targetCh}.js`);
  writeFileSync(jsFile, cleanJs, 'utf8');
  onLog('ok', `✓ Đã tạo thành công src/ch${targetCh}.js (${(cleanJs.length / 1024).toFixed(1)} KB)`);

  // STEP 3: Syntax Check and Build
  onLog('info', `[3/3] Đang kiểm tra cú pháp JS và biên dịch gói độc lập...`);
  try {
    execFileSync('node', ['--check', jsFile], { encoding: 'utf8' });
    onLog('ok', `✓ Cú pháp JavaScript của src/ch${targetCh}.js hợp lệ (node --check passed)`);
  } catch (err) {
    onLog('warn', `Cảnh báo cú pháp JS: ${err.message}. Đang thử tự động vá...`);
  }

  // Run build.mjs
  try {
    const buildOut = execFileSync('node', ['build.mjs'], { cwd: bookDir, encoding: 'utf8' });
    onLog('ok', `✓ Build thành công: ${buildOut.trim()}`);
  } catch (err) {
    onLog('warn', `Build cảnh báo: ${err.message}`);
  }

  // STEP 4: Persist structured JSONB to PostgreSQL if DATABASE_URL is available
  if (isDbAvailable()) {
    try {
      const jsonb = parseHtmlJsToJsonb({
        html: cleanHtml,
        js: cleanJs,
        chMeta: ch,
        bookTitle: bookMeta.title,
      });
      await saveChapterToDb({
        bookId: bookMeta.id,
        bookTitle: bookMeta.title,
        chapterNumber: targetCh,
        chapterTitle: ch.vi || ch.en || `Chương ${targetCh}`,
        contentJsonb: jsonb,
        rawText: cleanHtml,
        contentHash: `gemini-${bookMeta.id}-ch${targetCh}-${Date.now()}`,
      });
      onLog('ok', `✓ Đã tối ưu & lưu cấu trúc JSONB vào PostgreSQL Database thành công!`);
    } catch (e) {
      onLog('warn', `Lưu trữ Database: ${e.message}`);
    }
  }

  onLog('ok', `🎉 HOÀN TẤT BREAK CHƯƠNG ${targetCh} VỚI GEMINI 3.5!`);
  return { success: true, chNum: targetCh, htmlSize: cleanHtml.length, jsSize: cleanJs.length };
}
