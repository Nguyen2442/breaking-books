import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { breakChapterWithGemini } from './gemini.js';
import { extractPdfToChapters } from './pdf-parser.js';

export const ROOT = process.cwd();
export const BOOKS_PDF_DIR = join(ROOT, 'books');

mkdirSync(BOOKS_PDF_DIR, { recursive: true });

let cachedClaudeInfo = null;
export function detectClaudeCli() {
  if (cachedClaudeInfo) return cachedClaudeInfo;
  const candidates = ['/opt/homebrew/bin/claude', '/usr/local/bin/claude', 'claude'];
  for (const bin of candidates) {
    try {
      const ver = execFileSync(bin, ['--version'], { encoding: 'utf8', timeout: 3000 }).trim();
      cachedClaudeInfo = { available: true, bin, version: ver };
      return cachedClaudeInfo;
    } catch {
      // try next
    }
  }
  cachedClaudeInfo = { available: false, bin: null, version: null };
  return cachedClaudeInfo;
}

export function detectAiEngine() {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    return {
      available: true,
      provider: 'gemini',
      name: 'Google Gemini 3.5 AI Engine',
      version: 'Gemini 3.5 Flash',
      activeKey: `${geminiKey.slice(0, 6)}...${geminiKey.slice(-4)}`,
    };
  }
  const claude = detectClaudeCli();
  if (claude.available) {
    return {
      available: true,
      provider: 'claude',
      name: 'Claude Code CLI',
      version: claude.version,
    };
  }
  return { available: false, provider: null, name: 'None', version: null };
}

export function parseChapterStats(bookDir, n, chMeta = {}) {
  const chId = `ch${n}`;
  const htmlPath = join(bookDir, 'src', `${chId}.html`);
  const jsPath = join(bookDir, 'src', `${chId}.js`);
  const txtPath = join(bookDir, 'text', `${chId}.txt`);
  const txtE1Path = join(bookDir, 'text', 'e1', `${chId}.txt`);

  const hasHtml = existsSync(htmlPath);
  const hasJs = existsSync(jsPath);
  const resolvedTxtPath = existsSync(txtPath) ? txtPath : (existsSync(txtE1Path) ? txtE1Path : null);
  const hasText = Boolean(resolvedTxtPath);

  const htmlSize = hasHtml ? statSync(htmlPath).size : 0;
  const jsSize = hasJs ? statSync(jsPath).size : 0;
  const textSize = hasText ? statSync(resolvedTxtPath).size : 0;

  let viTitle = chMeta.vi || '';
  const topics = [];
  const htmlWidgets = [];
  const htmlTerms = [];
  let quizCount = 0;

  if (hasHtml) {
    const html = readFileSync(htmlPath, 'utf8');
    const titleMatch = html.match(/<section[^>]*data-title="([^"]+)"/);
    if (titleMatch && !viTitle) viTitle = titleMatch[1];

    const topicRegex = /<article\s+class="topic"\s+id="([^"]+)"(?:[^>]*data-num="([^"]*)")?(?:[^>]*data-short="([^"]*)")?/g;
    for (const m of html.matchAll(topicRegex)) {
      const label = m[3] || m[1];
      topics.push({ id: m[1], num: m[2] || '', short: label, title: label });
    }
    for (const m of html.matchAll(/data-widget="([^"]+)"/g)) {
      if (!htmlWidgets.includes(m[1])) htmlWidgets.push(m[1]);
    }
    for (const m of html.matchAll(/<dfn[^>]*data-term="([^"]+)"/g)) {
      if (!htmlTerms.includes(m[1])) htmlTerms.push(m[1]);
    }
    quizCount = [...html.matchAll(/<div\s+class="q"\s+data-answer=/g)].length;
  }

  const jsWidgets = [];
  let jsTermsCount = 0;
  if (hasJs) {
    const js = readFileSync(jsPath, 'utf8');
    for (const m of js.matchAll(/widget\(\s*['"]([^'"]+)['"]/g)) {
      if (!jsWidgets.includes(m[1])) jsWidgets.push(m[1]);
    }
    jsTermsCount = [...js.matchAll(/\{\s*key:\s*['"]([^'"]+)['"]/g)].length;
  }

  const missingWidgets = htmlWidgets.filter((w) => !jsWidgets.includes(w));

  let status = 'pending';
  if (hasHtml && hasJs && missingWidgets.length === 0) {
    status = 'complete';
  } else if (hasHtml || hasJs) {
    status = 'partial';
  }

  const displayTitle = viTitle || chMeta.en || `Chương ${n}`;
  const displaySubtitle = viTitle ? (chMeta.en || '') : (chMeta.part || '');

  return {
    n,
    num: n,
    id: chId,
    en: chMeta.en || `Chapter ${n}`,
    vi: viTitle,
    title: displayTitle,
    subtitle: displaySubtitle,
    partTitle: chMeta.part || null,
    src: chMeta.src || '',
    e1: chMeta.e1 || null,
    part: chMeta.part || null,
    status,
    hasHtml,
    hasJs,
    hasText,
    textPath: resolvedTxtPath ? resolvedTxtPath.replace(bookDir + '/', '') : null,
    htmlSize,
    jsSize,
    textSize,
    topicsCount: topics.length,
    topicCount: topics.length,
    svgCount: jsWidgets.length || htmlWidgets.length,
    topics,
    htmlWidgets,
    jsWidgets,
    missingWidgets,
    htmlTermsCount: htmlTerms.length,
    jsTermsCount,
    quizCount,
  };
}

export function inspectBook(bookId) {
  const bookDir = join(ROOT, bookId);
  if (!existsSync(bookDir) || !statSync(bookDir).isDirectory()) return null;
  const metaPath = join(bookDir, 'book.json');
  const buildPath = join(bookDir, 'build.mjs');
  if (!existsSync(metaPath) && !existsSync(buildPath)) return null;

  const meta = existsSync(metaPath)
    ? JSON.parse(readFileSync(metaPath, 'utf8'))
    : { id: bookId, title: bookId, subtitle: '', author: '', chapters: Array.from({ length: 13 }, (_, i) => ({ n: i + 1, en: `Chapter ${i + 1}` })) };

  const chapters = (meta.chapters || []).map((c) => parseChapterStats(bookDir, c.n, c));
  const distIndex = join(bookDir, 'dist', 'index.html');
  const distExists = existsSync(distIndex);
  const distSize = distExists ? statSync(distIndex).size : 0;

  const completeCount = chapters.filter((c) => c.status === 'complete').length;
  const partialCount = chapters.filter((c) => c.status === 'partial').length;
  const totalTopics = chapters.reduce((s, c) => s + c.topicsCount, 0);
  const totalWidgets = chapters.reduce((s, c) => s + c.jsWidgets.length, 0);
  const totalQuizzes = chapters.reduce((s, c) => s + c.quizCount, 0);

  return {
    id: bookId,
    title: meta.title || bookId,
    shortTitle: meta.shortTitle || meta.title || bookId,
    subtitle: meta.subtitle || '',
    author: meta.author || '',
    edition: meta.edition || '',
    description: meta.description || '',
    sourcePdfs: meta.sourcePdfs || [],
    distExists,
    distSize,
    completeCount,
    partialCount,
    totalChapters: chapters.length,
    totalTopics,
    totalWidgets,
    totalQuizzes,
    stats: {
      completeChapters: completeCount,
      partialChapters: partialCount,
      totalChapters: chapters.length,
      totalTopics,
      totalSvgs: totalWidgets,
      totalQuizzes,
    },
    chapters,
    processing: getProcessingState(bookId),
  };
}

const IGNORE_DIRS = new Set(['books', 'studio', 'tools', 'node_modules', 'app', 'lib', 'components', 'public']);

export function listAllBooks() {
  const entries = readdirSync(ROOT, { withFileTypes: true });
  const books = [];
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith('.') || IGNORE_DIRS.has(e.name)) continue;
    const info = inspectBook(e.name);
    if (info) books.push(info);
  }
  return books;
}

export function listPdfFiles() {
  if (!existsSync(BOOKS_PDF_DIR)) return [];
  return readdirSync(BOOKS_PDF_DIR)
    .filter((f) => f.toLowerCase().endsWith('.pdf'))
    .map((f) => {
      const st = statSync(join(BOOKS_PDF_DIR, f));
      return { name: f, size: st.size, mtime: st.mtime.toISOString() };
    });
}

export function getChapterPayload(bookId, chNum) {
  const book = inspectBook(bookId);
  if (!book) return null;
  const ch = book.chapters.find((c) => c.n === Number(chNum));
  if (!ch) return null;

  const bookDir = join(ROOT, bookId);
  const htmlPath = join(bookDir, 'src', `ch${ch.n}.html`);
  const jsPath = join(bookDir, 'src', `ch${ch.n}.js`);

  const html = existsSync(htmlPath) ? readFileSync(htmlPath, 'utf8') : '';
  const js = existsSync(jsPath) ? readFileSync(jsPath, 'utf8') : '';

  return { book, ch, chapter: ch, html, js };
}

export function getAllGlossaryFromBook(bookId) {
  const bookDir = join(ROOT, bookId);
  const srcDir = join(bookDir, 'src');
  if (!existsSync(srcDir)) return [];
  const files = readdirSync(srcDir).filter((f) => /^ch\d+\.js$/.test(f));
  const terms = [];
  const seen = new Set();
  for (const file of files) {
    const chNum = Number(file.match(/\d+/)[0]);
    const code = readFileSync(join(srcDir, file), 'utf8');
    // Match glossary object entries
    const entryRegex = /\{\s*key:\s*['"]([^'"]+)['"]\s*,\s*term:\s*['"]([^'"]+)['"]\s*,\s*vi:\s*['"]([^'"]*)['"][^}]*?def:\s*['"]([^'"]+)['"][^}]*\}/g;
    for (const m of code.matchAll(entryRegex)) {
      if (seen.has(m[1])) continue;
      seen.add(m[1]);
      const topicMatch = m[0].match(/topic:\s*['"]([^'"]+)['"]/);
      terms.push({
        key: m[1],
        term: m[2],
        vi: m[3],
        def: m[4],
        ch: chNum,
        topic: topicMatch ? topicMatch[1] : `ch${chNum}`,
      });
    }
  }
  return terms.sort((a, b) => a.term.localeCompare(b.term, 'en'));
}

export function buildChapterPrompt(book, ch, mode = 'auto', customPrompt = '') {
  if (mode === 'custom' && customPrompt.trim()) {
    return `Đọc kỹ CONTRACT.md trong thư mục hiện tại (${book.id}).\nYêu cầu cho Chương ${ch.n} (${ch.en}):\n${customPrompt.trim()}\n\nSau khi sửa xong, hãy chạy: node --check src/ch${ch.n}.js (nếu có file js) và chạy: node build.mjs`;
  }

  const txtHint = ch.textPath ? `File nguồn văn bản gốc của chương này nằm tại: \`${ch.textPath}\`.` : `Hãy dựa trên nội dung Chương ${ch.n}: "${ch.en}".`;
  const edHint = ch.src === '1e' && ch.e1
    ? `Lưu ý: Chương ${ch.n} đi theo thứ tự ấn bản 2 nhưng lấy nguồn từ Ấn bản 1 · Chương ${ch.e1} (nhớ thêm badge \`<span class="ed-badge">Nguồn: ấn bản 1 · Chương ${ch.e1}</span>\` ở eyebrow).`
    : '';

  if (mode === 'js' || (mode === 'auto' && ch.hasHtml && (!ch.hasJs || ch.missingWidgets.length > 0))) {
    const missingList = ch.missingWidgets.length ? ch.missingWidgets.join(', ') : ch.htmlWidgets.join(', ');
    return [
      `Hãy đọc kỹ file \`CONTRACT.md\` và \`src/core.js\` để nắm rõ quy ước viết widget và glossary.`,
      `Hiện tại Chương ${ch.n} ("${ch.en}") đã có file \`src/ch${ch.n}.html\`.`,
      ch.hasJs
        ? `File \`src/ch${ch.n}.js\` hiện đang THIẾU ${ch.missingWidgets.length} widget sau: ${missingList}.`
        : `File \`src/ch${ch.n}.js\` CHƯA tồn tại. Các widget cần cài đặt theo \`src/ch${ch.n}.html\` là: ${missingList}.`,
      txtHint,
      `Nhiệm vụ của bạn:`,
      `1. Đọc \`src/ch${ch.n}.html\` để xem tất cả các thẻ \`<figure class="lab" data-widget="...">\` và tất cả các thuật ngữ \`<dfn data-term="...">\`.`,
      `2. Viết hoặc bổ sung đầy đủ vào \`src/ch${ch.n}.js\` tất cả các widget còn thiếu (${missingList}) và đăng ký toàn bộ glossary terms (\`glossary.add([...])\`) cho Chương ${ch.n}.`,
      `3. Tuân thủ nghiêm ngặt quy tắc giao diện trong \`CONTRACT.md\`: dùng helper từ \`window.DDIA\`, không dùng màu cứng trong JS/SVG (dùng class \`f-accent\`, \`s-accent\`, \`f-ok\`, \`f-warn\`, \`f-bad\`...), mở lên có sẵn trạng thái mẫu, hoạt động tốt ở chiều rộng 400px.`,
      `4. Chạy \`node --check src/ch${ch.n}.js\` và \`node build.mjs\` để đảm bảo build thành công không có lỗi cú pháp.`
    ].filter(Boolean).join('\n');
  }

  if (mode === 'html' || (mode === 'auto' && !ch.hasHtml && ch.hasJs)) {
    return [
      `Hãy đọc kỹ file \`CONTRACT.md\` để nắm rõ cấu trúc HTML của một chương.`,
      txtHint,
      edHint,
      ch.hasJs
        ? `Lưu ý quan trọng: File \`src/ch${ch.n}.js\` ĐÃ TỒN TẠI và đăng ký sẵn các widget: ${ch.jsWidgets.join(', ')}. Hãy đọc \`src/ch${ch.n}.js\` để khớp chính xác tên \`data-widget="..."\` và các \`<dfn data-term="...">\` trong \`src/ch${ch.n}.html\`!`
        : '',
      `Nhiệm vụ của bạn:`,
      `1. Tạo file \`src/ch${ch.n}.html\` cho Chương ${ch.n}: "${ch.en}" theo đúng mẫu trong \`CONTRACT.md\`.`,
      `2. Chia thành 10–15 chủ đề (\`<article class="topic" id="ch${ch.n}-...">\`), mỗi chủ đề có \`.tldr\`, \`.prose\` tiếng Việt rõ ràng dễ hiểu, \`<figure class="lab" data-widget="...">\` và \`.callout\`. Cuối chương có \`ch${ch.n}-review\` kèm 6–8 câu hỏi \`.quiz\`.`,
      `3. Chạy \`node build.mjs\` sau khi hoàn tất.`
    ].filter(Boolean).join('\n');
  }

  return [
    `Hãy đọc kỹ file \`CONTRACT.md\` và \`src/core.js\` trước khi bắt đầu.`,
    `Nhiệm vụ: "Break" trọn vẹn Chương ${ch.n} ("${ch.en}") thành hai file \`src/ch${ch.n}.html\` và \`src/ch${ch.n}.js\`.`,
    txtHint,
    edHint,
    `Yêu cầu thực hiện:`,
    `1. Đọc kỹ văn bản nguồn của Chương ${ch.n}, chia thành 10–14 chủ đề (\`<article class="topic" id="ch${ch.n}-slug">\`) bám sát cấu trúc sách, cộng 1 bài tổng kết & quiz \`ch${ch.n}-review\` ở cuối chương.`,
    `2. Viết \`src/ch${ch.n}.html\` bằng tiếng Việt tự nhiên, giữ thuật ngữ tiếng Anh trong \`<dfn data-term="...">\`, dùng số liệu/ví dụ thật trong sách. Mỗi topic đều có một \`<figure class="lab" data-widget="...">\`.`,
    `3. Viết \`src/ch${ch.n}.js\` cài đặt toàn bộ các widget tương tác đã khai báo trong \`src/ch${ch.n}.html\` và đăng ký đầy đủ \`glossary.add([...])\` cho mọi \`data-term\`.`,
    `4. Kiểm tra bằng \`node --check src/ch${ch.n}.js\` và chạy \`node build.mjs\` để cập nhật \`dist/index.html\`.`
  ].filter(Boolean).join('\n');
}

// ---------- Global Singleton for Claude CLI Jobs across Next.js hot reloads ----------
const g = globalThis;
if (!g.__bbJobs) g.__bbJobs = new Map();
if (!g.__bbListeners) g.__bbListeners = new Set();
if (!g.__bbCounter) g.__bbCounter = 0;

export function getJobsList() {
  return [...g.__bbJobs.values()].map(sanitizeJob);
}

export function subscribeJobEvents(fn) {
  g.__bbListeners.add(fn);
  return () => g.__bbListeners.delete(fn);
}

function emitEvent(event, payload) {
  for (const fn of g.__bbListeners) {
    try { fn(event, payload); } catch { /* ignore */ }
  }
}

function sanitizeJob(job) {
  const { proc, ...rest } = job;
  return rest;
}

export function startClaudeJob({ bookId, chNum, chapter, mode = 'auto', customPrompt = '', onDone }) {
  const targetCh = Number(chNum || chapter || 1);
  const aiEngine = detectAiEngine();
  if (!aiEngine.available) {
    throw new Error('Chưa cấu hình API Key AI (Gemini API Key hoặc Claude CLI).');
  }
  const book = inspectBook(bookId);
  if (!book) throw new Error(`Không tìm thấy sách: ${bookId}`);
  const ch = book.chapters.find((c) => c.n === targetCh);
  if (!ch) throw new Error(`Không tìm thấy chương ${targetCh}`);

  const prompt = buildChapterPrompt(book, ch, mode, customPrompt);
  const jobId = `job-${++g.__bbCounter}-${Date.now()}`;
  const bookDir = join(ROOT, bookId);

  const job = {
    id: jobId,
    bookId,
    chNum: targetCh,
    chapter: targetCh,
    chapterTitle: ch.en,
    mode,
    prompt,
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    logs: [],
    proc: null,
    engine: aiEngine.name,
  };

  const addLog = (type, text) => {
    const line = `[${type.toUpperCase()}] ${text}\n`;
    job.logs.push(line);
    if (job.logs.length > 400) job.logs.shift();
    emitEvent('job-log', { type: 'job-log', jobId, bookId, chNum: job.chNum, line });
  };

  // IF GEMINI IS CONFIGURED -> RUN DIRECTLY WITH GEMINI 3.5 API
  if (aiEngine.provider === 'gemini') {
    addLog('info', `Khởi chạy ${aiEngine.name} (${aiEngine.version}) cho ${bookId} · Chương ${ch.n} (${mode})...`);
    g.__bbJobs.set(jobId, job);
    emitEvent('job-update', sanitizeJob(job));

    // Run async in background without blocking response
    breakChapterWithGemini({
      bookDir,
      bookMeta: book,
      chNum: targetCh,
      onLog: addLog,
    })
      .then(() => {
        job.status = 'done';
        job.finishedAt = new Date().toISOString();
        addLog('ok', `Gemini AI đã hoàn tất bóc tách trọn vẹn Chương ${targetCh}!`);
        emitEvent('job-update', sanitizeJob(job));
        emitEvent('book-updated', { bookId });
        if (onDone) onDone(job);
      })
      .catch((err) => {
        job.status = 'error';
        job.finishedAt = new Date().toISOString();
        addLog('error', `Lỗi Gemini AI: ${err.message}`);
        emitEvent('job-update', sanitizeJob(job));
        emitEvent('book-updated', { bookId });
        if (onDone) onDone(job);
      });

    return sanitizeJob(job);
  }

  // Fallback to Claude CLI if Gemini is not used
  const claudeInfo = detectClaudeCli();
  if (!claudeInfo.available) {
    throw new Error('Không tìm thấy Claude CLI hoặc Gemini API Key trên máy.');
  }

  addLog('info', `Khởi chạy Claude CLI (${claudeInfo.version}) cho ${bookId} · Chương ${ch.n} (${mode})...`);

  const env = { ...process.env };
  delete env.CLAUDECODE;
  env.PATH = `/opt/homebrew/bin:/Users/elysion/.local/bin:/usr/local/bin:/usr/bin:/bin:${env.PATH || ''}`;

  const args = [
    '-p', prompt,
    '--output-format', 'stream-json',
    '--verbose',
    '--dangerously-skip-permissions',
  ];

  const proc = spawn(claudeInfo.bin, args, {
    cwd: bookDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  job.proc = proc;
  g.__bbJobs.set(jobId, job);
  emitEvent('job-update', sanitizeJob(job));

  let stdoutBuf = '';
  proc.stdout.on('data', (chunk) => {
    stdoutBuf += chunk.toString('utf8');
    const lines = stdoutBuf.split('\n');
    stdoutBuf = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const evt = JSON.parse(trimmed);
        if (evt.type === 'assistant' && evt.message?.content) {
          for (const block of evt.message.content) {
            if (block.type === 'text' && block.text) addLog('assistant', block.text);
            else if (block.type === 'tool_use') {
              const p = block.input ? (block.input.file_path || block.input.command || JSON.stringify(block.input).slice(0, 100)) : '';
              addLog('tool', `🔧 ${block.name}: ${p}`);
            }
          }
        } else if (evt.type === 'result') {
          const cost = evt.total_cost_usd != null ? ` · $${evt.total_cost_usd.toFixed(4)}` : '';
          const dur = evt.duration_ms != null ? ` · ${(evt.duration_ms / 1000).toFixed(1)}s` : '';
          addLog('ok', `Hoàn thành${dur}${cost}`);
        }
      } catch {
        addLog('raw', trimmed);
      }
    }
  });

  proc.stderr.on('data', (chunk) => {
    const msg = chunk.toString('utf8').trim();
    if (msg) addLog('warn', msg);
  });

  proc.on('close', (code) => {
    job.proc = null;
    job.finishedAt = new Date().toISOString();
    if (job.status === 'stopped') {
      addLog('warn', 'Đã dừng tiến trình theo yêu cầu.');
    } else if (code === 0) {
      job.status = 'done';
      addLog('ok', `Claude CLI hoàn tất. Đang chạy build.mjs...`);
      try {
        const out = execFileSync('node', ['build.mjs'], { cwd: bookDir, encoding: 'utf8' }).trim();
        addLog('ok', `Build thành công: ${out}`);
      } catch (e) {
        addLog('error', `Lỗi build.mjs: ${e.message}`);
      }
    } else {
      job.status = 'error';
      addLog('error', `Claude CLI kết thúc với mã lỗi ${code}.`);
    }
    emitEvent('job-update', sanitizeJob(job));
    emitEvent('book-updated', { bookId });
    if (onDone) onDone(job);
  });

  return sanitizeJob(job);
}

// ---------- Break queue: chapters of a book are written by Claude a few at a time ----------
const QUEUE_CONCURRENCY = Number(process.env.BB_CONCURRENCY || 2);
if (!g.__bbQueue) g.__bbQueue = [];          // [{ bookId, chNum }]
if (!g.__bbRunning) g.__bbRunning = new Map(); // "bookId:chNum" -> jobId
if (!g.__bbFailed) g.__bbFailed = new Map();   // "bookId:chNum" -> error message

const qKey = (bookId, chNum) => `${bookId}:${chNum}`;
// A chapter may also be running from a job started outside the queue (e.g. the Studio page)
const runningJobFor = (bookId, chNum) =>
  [...g.__bbJobs.values()].find((j) => j.status === 'running' && j.bookId === bookId && Number(j.chNum) === Number(chNum));

function pumpQueue() {
  while (g.__bbRunning.size < QUEUE_CONCURRENCY && g.__bbQueue.length) {
    const { bookId, chNum } = g.__bbQueue.shift();
    const key = qKey(bookId, chNum);
    if (runningJobFor(bookId, chNum)) continue; // already being written, don't start a second writer
    try {
      const job = startClaudeJob({
        bookId,
        chNum,
        mode: 'auto',
        onDone: (finished) => {
          g.__bbRunning.delete(key);
          const ch = inspectBook(bookId)?.chapters.find((c) => c.n === chNum);
          if (finished.status !== 'done' || ch?.status !== 'complete') {
            g.__bbFailed.set(key, finished.status === 'stopped' ? 'Đã dừng' : 'AI chưa viết xong chương này');
          }
          pumpQueue();
        },
      });
      g.__bbRunning.set(key, job.id);
      g.__bbFailed.delete(key);
    } catch (err) {
      g.__bbFailed.set(key, err.message);
    }
  }
}

/** Queue every chapter of the book that is not complete yet (or only the given chapters). */
export function enqueueBook(bookId, onlyChapters) {
  const book = inspectBook(bookId);
  if (!book) throw new Error(`Không tìm thấy sách: ${bookId}`);
  const ai = detectAiEngine();
  if (!ai.available) throw new Error('Chưa cấu hình API Key AI (Gemini API Key hoặc Claude).');
  const wanted = onlyChapters ? new Set(onlyChapters.map(Number)) : null;
  let added = 0;
  for (const ch of book.chapters) {
    if (wanted ? !wanted.has(ch.n) : ch.status === 'complete') continue;
    const key = qKey(bookId, ch.n);
    if (g.__bbRunning.has(key) || runningJobFor(bookId, ch.n) || g.__bbQueue.some((q) => qKey(q.bookId, q.chNum) === key)) continue;
    g.__bbQueue.push({ bookId, chNum: ch.n });
    g.__bbFailed.delete(key);
    added++;
  }
  pumpQueue();
  return { added, ...getProcessingState(bookId) };
}

export function getProcessingState(bookId) {
  const running = [...new Set([...g.__bbJobs.values()].filter((j) => j.status === 'running' && j.bookId === bookId).map((j) => Number(j.chNum)))];
  const queued = g.__bbQueue.filter((q) => q.bookId === bookId).map((q) => q.chNum);
  const failed = [...g.__bbFailed.entries()].filter(([k]) => k.startsWith(bookId + ':')).map(([k, msg]) => ({ ch: Number(k.split(':').pop()), msg }));
  return { running, queued, failed, active: running.length + queued.length > 0 };
}

/** PDFs in books/ that no book.json lists as a source yet. */
export function listUnprocessedPdfs(books = listAllBooks()) {
  const used = new Set(books.flatMap((b) => b.sourcePdfs || []));
  return listPdfFiles().filter((p) => !used.has(p.name));
}

export function savePdfUpload(fileName, buffer) {
  let safeName = basename(fileName || `upload-${Date.now()}.pdf`).replace(/[^a-zA-Z0-9._ ()-]/g, '_');
  if (!safeName.toLowerCase().endsWith('.pdf')) throw new Error('Chỉ nhận file PDF.');
  if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error('File này không phải PDF hợp lệ.');
  const stem = safeName.slice(0, -4);
  for (let i = 2; existsSync(join(BOOKS_PDF_DIR, safeName)); i++) safeName = `${stem} (${i}).pdf`;
  writeFileSync(join(BOOKS_PDF_DIR, safeName), buffer);
  return safeName;
}

export function stopClaudeJob(jobId) {
  const job = g.__bbJobs.get(jobId);
  if (!job) return null;
  if (job.proc) {
    job.status = 'stopped';
    job.proc.kill('SIGTERM');
  }
  return sanitizeJob(job);
}

const cleanTitle = (s) => String(s || '').replace(/\.pdf$/i, '').replace(/^_?OceanofPDF\.com_?/i, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();

export async function createNewBook({ id, title, subtitle, author, pdfFile }) {
  const pdfPath = join(BOOKS_PDF_DIR, pdfFile || '');
  if (!pdfFile || !existsSync(pdfPath)) {
    throw new Error(`Không tìm thấy file PDF: ${pdfFile}`);
  }
  const baseSlug = String(id || title || cleanTitle(pdfFile) || 'book')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || `book-${Date.now()}`;
  let slug = baseSlug;
  for (let i = 2; existsSync(join(ROOT, slug)) || IGNORE_DIRS.has(slug); i++) slug = `${baseSlug}-${i}`;
  const bookDir = join(ROOT, slug);

  mkdirSync(join(bookDir, 'src'), { recursive: true });
  mkdirSync(join(bookDir, 'dist'), { recursive: true });
  mkdirSync(join(bookDir, 'text'), { recursive: true });

  const templateDir = join(ROOT, 'ddia-2e');
  copyFileSync(join(templateDir, 'src', 'core.js'), join(bookDir, 'src', 'core.js'));
  copyFileSync(join(templateDir, 'src', 'styles.css'), join(bookDir, 'src', 'styles.css'));
  copyFileSync(join(templateDir, 'build.mjs'), join(bookDir, 'build.mjs'));
  copyFileSync(join(templateDir, 'CONTRACT.md'), join(bookDir, 'CONTRACT.md'));

  let extracted = { chapters: [] };
  try {
    // Pure Node.js PDF extraction with zero external binary dependencies
    extracted = await extractPdfToChapters(pdfPath, bookDir);
  } catch (err) {
    console.warn('Node.js PDF extract warning:', err.message);
    extracted = {
      title: title || cleanTitle(pdfFile) || slug,
      totalPages: 1,
      chapters: [{ n: 1, en: 'Chapter 1', vi: 'Chương 1', src: 'PDF' }],
    };
  }

  const chapters = extracted.chapters?.length
    ? extracted.chapters
    : [{ n: 1, en: 'Chapter 1', vi: 'Chương 1', src: 'PDF' }];

  const bookTitle = title || extracted.title || cleanTitle(pdfFile) || slug;
  const bookMeta = {
    id: slug,
    title: bookTitle,
    subtitle: subtitle || '',
    author: author || extracted.author || '',
    edition: `${extracted.totalPages || '?'} trang · Nguồn: ${pdfFile}`,
    description: `Sổ tay đọc tương tác cho ${bookTitle}: tóm tắt, giải nghĩa và ví dụ thao tác được.`,
    sourcePdfs: [pdfFile],
    chapters,
  };
  writeFileSync(join(bookDir, 'book.json'), JSON.stringify(bookMeta, null, 2), 'utf8');

  copyFileSync(join(templateDir, 'src', 'shell-top.html'), join(bookDir, 'src', 'shell-top.html'));
  copyFileSync(join(templateDir, 'src', 'shell-bottom.html'), join(bookDir, 'src', 'shell-bottom.html'));
  try {
    execFileSync('node', ['build.mjs'], { cwd: bookDir });
  } catch {}
  return inspectBook(slug);
}
