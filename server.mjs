import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { join, resolve, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const BOOKS_PDF_DIR = join(ROOT, 'books');
const STUDIO_DIR = join(ROOT, 'studio');
const PORT = Number(process.env.PORT || 3456);

mkdirSync(BOOKS_PDF_DIR, { recursive: true });
mkdirSync(STUDIO_DIR, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

// ---------- Claude CLI Detection ----------
function detectClaudeCli() {
  const candidates = ['/opt/homebrew/bin/claude', '/usr/local/bin/claude', 'claude'];
  for (const bin of candidates) {
    try {
      const ver = execFileSync(bin, ['--version'], { encoding: 'utf8', timeout: 3000 }).trim();
      return { available: true, bin, version: ver };
    } catch {
      // try next
    }
  }
  return { available: false, bin: null, version: null };
}

const claudeInfo = detectClaudeCli();

// ---------- Book & Chapter Inspection ----------
function parseChapterStats(bookDir, n, chMeta = {}) {
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
      topics.push({ id: m[1], num: m[2] || '', short: m[3] || m[1] });
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

  return {
    n,
    id: chId,
    en: chMeta.en || `Chapter ${n}`,
    vi: viTitle,
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
    topics,
    htmlWidgets,
    jsWidgets,
    missingWidgets,
    htmlTermsCount: htmlTerms.length,
    jsTermsCount,
    quizCount,
  };
}

function inspectBook(bookId) {
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
    chapters,
  };
}

function listAllBooks() {
  const entries = readdirSync(ROOT, { withFileTypes: true });
  const books = [];
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith('.') || ['books', 'studio', 'tools', 'node_modules'].includes(e.name)) continue;
    const info = inspectBook(e.name);
    if (info) books.push(info);
  }
  return books;
}

function listPdfFiles() {
  if (!existsSync(BOOKS_PDF_DIR)) return [];
  return readdirSync(BOOKS_PDF_DIR)
    .filter((f) => f.toLowerCase().endsWith('.pdf'))
    .map((f) => {
      const st = statSync(join(BOOKS_PDF_DIR, f));
      return { name: f, size: st.size, mtime: st.mtime.toISOString() };
    });
}

// ---------- Prompt Builder for Claude CLI / VS Code Extension ----------
function buildChapterPrompt(book, ch, mode = 'auto', customPrompt = '') {
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

  // Full break (both chN.html and chN.js)
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

// ---------- Background Job Manager (Claude CLI Streaming) ----------
const jobs = new Map(); // jobId -> job object
const sseClients = new Set();
let jobCounter = 0;

function broadcastSSE(event, payload) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) {
    try { res.write(msg); } catch { sseClients.delete(res); }
  }
}

function startClaudeJob({ bookId, chNum, mode = 'auto', customPrompt = '' }) {
  if (!claudeInfo.available) {
    throw new Error('Không tìm thấy Claude CLI (/opt/homebrew/bin/claude) trên máy.');
  }
  const book = inspectBook(bookId);
  if (!book) throw new Error(`Không tìm thấy sách: ${bookId}`);
  const ch = book.chapters.find((c) => c.n === Number(chNum));
  if (!ch) throw new Error(`Không tìm thấy chương ${chNum}`);

  const prompt = buildChapterPrompt(book, ch, mode, customPrompt);
  const jobId = `job-${++jobCounter}-${Date.now()}`;
  const bookDir = join(ROOT, bookId);

  const job = {
    id: jobId,
    bookId,
    chNum: Number(chNum),
    chapterTitle: ch.en,
    mode,
    prompt,
    status: 'running', // running | done | error | stopped
    startedAt: new Date().toISOString(),
    finishedAt: null,
    logs: [],
    proc: null,
  };

  const addLog = (type, text) => {
    const entry = { ts: new Date().toISOString(), type, text };
    job.logs.push(entry);
    if (job.logs.length > 400) job.logs.shift();
    broadcastSSE('job-log', { jobId, bookId, chNum: job.chNum, entry });
  };

  addLog('info', `Khởi chạy Claude CLI (${claudeInfo.version}) cho ${bookId} · Chương ${ch.n} (${mode})...`);

  const env = { ...process.env };
  delete env.CLAUDECODE; // Allow spawning even if parent terminal had Claude Code env set
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
  jobs.set(jobId, job);
  broadcastSSE('job-update', sanitizeJob(job));

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
        handleClaudeStreamEvent(evt, addLog);
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
      addLog('ok', `Claude CLI hoàn tất (exit code 0). Đang chạy build.mjs...`);
      try {
        const out = execFileSync('node', ['build.mjs'], { cwd: bookDir, encoding: 'utf8' }).trim();
        addLog('ok', `Build thành công: ${out}`);
      } catch (e) {
        addLog('error', `Lỗi khi chạy build.mjs: ${e.message}`);
      }
    } else {
      job.status = 'error';
      addLog('error', `Claude CLI kết thúc với mã lỗi ${code}.`);
    }
    broadcastSSE('job-update', sanitizeJob(job));
    broadcastSSE('book-updated', { bookId });
  });

  return sanitizeJob(job);
}

function handleClaudeStreamEvent(evt, addLog) {
  if (evt.type === 'system' && evt.subtype === 'init') {
    addLog('info', `Model: ${evt.model || 'Claude'} · Session: ${evt.session_id || ''}`);
    return;
  }
  if (evt.type === 'assistant' && evt.message?.content) {
    for (const block of evt.message.content) {
      if (block.type === 'text' && block.text) {
        addLog('assistant', block.text);
      } else if (block.type === 'tool_use') {
        const inputPreview = block.input
          ? (block.input.file_path || block.input.command || block.input.pattern || JSON.stringify(block.input).slice(0, 120))
          : '';
        addLog('tool', `🔧 ${block.name}: ${inputPreview}`);
      }
    }
    return;
  }
  if (evt.type === 'result') {
    const cost = evt.total_cost_usd != null ? ` · $${evt.total_cost_usd.toFixed(4)}` : '';
    const dur = evt.duration_ms != null ? ` · ${(evt.duration_ms / 1000).toFixed(1)}s` : '';
    addLog('ok', `Hoàn thành${dur}${cost}`);
  }
}

function sanitizeJob(job) {
  const { proc, ...rest } = job;
  return rest;
}

// ---------- Scaffold New Book from PDF ----------
function createNewBook({ id, title, subtitle, author, pdfFile }) {
  const slug = String(id || title || 'book')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `book-${Date.now()}`;

  const bookDir = join(ROOT, slug);
  if (existsSync(bookDir)) {
    throw new Error(`Thư mục sách "${slug}" đã tồn tại.`);
  }
  const pdfPath = join(BOOKS_PDF_DIR, pdfFile);
  if (!existsSync(pdfPath)) {
    throw new Error(`Không tìm thấy file PDF: ${pdfFile}`);
  }

  mkdirSync(join(bookDir, 'src'), { recursive: true });
  mkdirSync(join(bookDir, 'dist'), { recursive: true });
  mkdirSync(join(bookDir, 'text'), { recursive: true });

  // Copy core engine from ddia-2e
  const templateDir = join(ROOT, 'ddia-2e');
  copyFileSync(join(templateDir, 'src', 'core.js'), join(bookDir, 'src', 'core.js'));
  copyFileSync(join(templateDir, 'src', 'styles.css'), join(bookDir, 'src', 'styles.css'));
  copyFileSync(join(templateDir, 'build.mjs'), join(bookDir, 'build.mjs'));

  // Extract chapters from PDF using uv + pymupdf
  let extracted = { chapters: [] };
  try {
    const raw = execFileSync(
      '/Users/elysion/.local/bin/uv',
      ['run', '--with', 'pymupdf', 'python3', join(ROOT, 'tools', 'pdf_extract.py'), pdfPath, bookDir],
      { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
    );
    extracted = JSON.parse(raw.trim());
  } catch (err) {
    throw new Error(`Không thể trích xuất PDF: ${err.message}`);
  }

  const chapters = extracted.chapters?.length
    ? extracted.chapters
    : [{ n: 1, en: 'Chapter 1', vi: 'Chương 1', src: 'PDF' }];

  const bookMeta = {
    id: slug,
    title: title || slug,
    subtitle: subtitle || pdfFile.replace(/\.pdf$/i, ''),
    author: author || '',
    edition: `${extracted.totalPages || '?'} trang · Nguồn: ${pdfFile}`,
    description: `Sổ tay đọc tương tác cho ${title || pdfFile}: tóm tắt, giải nghĩa và ví dụ thao tác được.`,
    sourcePdfs: [pdfFile],
    chapters,
  };
  writeFileSync(join(bookDir, 'book.json'), JSON.stringify(bookMeta, null, 2), 'utf8');

  // Generate shell-top.html & shell-bottom.html for this book
  const shellTop = `<title>${bookMeta.title}</title>
<meta name="viewport-fit-sides" content="cover">
<meta name="description" content="${bookMeta.description.replace(/"/g, '&quot;')}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,500;0,7..72,600;1,7..72,400&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
/*__STYLES__*/
</style>

<header class="topbar">
  <button type="button" class="icon-btn rail-toggle" aria-label="Mở mục lục">☰</button>
  <a class="brand" href="#home"><b>${bookMeta.title}</b><span>${bookMeta.subtitle}</span></a>
  <div class="search">
    <input id="site-search" type="search" placeholder="Tìm chủ đề hoặc thuật ngữ…" autocomplete="off" aria-label="Tìm kiếm">
    <kbd>/</kbd>
    <div class="search-results" hidden></div>
  </div>
  <div class="top-progress" title="Tiến độ đọc (lưu trên trình duyệt này)"><span class="bar"><i></i></span><span class="txt">0/0</span></div>
  <button type="button" class="icon-btn theme-toggle" aria-label="Đổi giao diện sáng/tối">☾</button>
</header>

<div class="shell">
  <nav class="rail" aria-label="Mục lục"></nav>
  <main>
    <div class="page">
      <section id="home" class="home-hero">
        <p class="kicker">${bookMeta.subtitle}${bookMeta.author ? ' · ' + bookMeta.author : ''}</p>
        <h1>${bookMeta.title}</h1>
        <p class="sub">${bookMeta.description}</p>
        <div class="book-map" aria-label="Bản đồ cuốn sách"></div>
      </section>`;

  const optionsHtml = chapters.map((c) => `            <option value="${c.n}">Chương ${c.n}</option>`).join('\n');
  const shellBottom = `
      <section id="glossary" class="chapter">
        <header class="chapter-head">
          <p class="eyebrow">Tra cứu</p>
          <h1>Thuật ngữ <span class="vi">Từ điển nhỏ Anh–Việt cho cả cuốn sách</span></h1>
        </header>
        <div class="gloss-tools">
          <input id="gloss-filter" type="search" placeholder="Lọc thuật ngữ… (có thể gõ không dấu)" aria-label="Lọc thuật ngữ">
          <select id="gloss-ch" aria-label="Lọc theo chương" class="icon-btn">
            <option value="">Tất cả chương</option>
${optionsHtml}
          </select>
          <span class="lab-note gloss-count" style="align-self:center"></span>
        </div>
        <div class="gloss-list"></div>
      </section>

      <footer class="foot">
        Sổ tay học tập tương tác dựa trên <em>${bookMeta.subtitle}</em>${bookMeta.author ? ' của ' + bookMeta.author : ''}.Được tạo bởi Breaking Books Studio.
      </footer>
    </div>
  </main>
</div>
/*__SCRIPTS__*/`;

  writeFileSync(join(bookDir, 'src', 'shell-top.html'), shellTop, 'utf8');
  writeFileSync(join(bookDir, 'src', 'shell-bottom.html'), shellBottom, 'utf8');

  // Copy CONTRACT.md adapted for the book
  const contractRaw = readFileSync(join(templateDir, 'CONTRACT.md'), 'utf8');
  writeFileSync(join(bookDir, 'CONTRACT.md'), contractRaw, 'utf8');

  // Run initial build
  execFileSync('node', ['build.mjs'], { cwd: bookDir });
  return inspectBook(slug);
}

// ---------- HTTP Helpers ----------
function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function readBodyBuffer(req) {
  return new Promise((resolvePromise, rejectPromise) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolvePromise(Buffer.concat(chunks)));
    req.on('error', rejectPromise);
  });
}

async function readBodyJSON(req) {
  const buf = await readBodyBuffer(req);
  if (!buf.length) return {};
  return JSON.parse(buf.toString('utf8'));
}

// ---------- Server Router ----------
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = decodeURIComponent(url.pathname);

    // 1. SSE Stream for live job updates
    if (req.method === 'GET' && pathname === '/api/jobs/stream') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write(`event: init\ndata: ${JSON.stringify([...jobs.values()].map(sanitizeJob))}\n\n`);
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return;
    }

    // 2. API: Overview
    if (req.method === 'GET' && pathname === '/api/overview') {
      return sendJSON(res, 200, {
        ok: true,
        claude: claudeInfo,
        pdfs: listPdfFiles(),
        books: listAllBooks(),
        jobs: [...jobs.values()].map(sanitizeJob),
      });
    }

    // 3. API: Get single book details
    const bookMatch = pathname.match(/^\/api\/books\/([^/]+)$/);
    if (req.method === 'GET' && bookMatch) {
      const book = inspectBook(bookMatch[1]);
      if (!book) return sendJSON(res, 404, { ok: false, error: 'Book not found' });
      return sendJSON(res, 200, { ok: true, book });
    }

    // 4. API: Generate Prompt for a chapter
    const promptMatch = pathname.match(/^\/api\/books\/([^/]+)\/chapters\/(\d+)\/prompt$/);
    if (req.method === 'GET' && promptMatch) {
      const book = inspectBook(promptMatch[1]);
      if (!book) return sendJSON(res, 404, { ok: false, error: 'Book not found' });
      const ch = book.chapters.find((c) => c.n === Number(promptMatch[2]));
      if (!ch) return sendJSON(res, 404, { ok: false, error: 'Chapter not found' });
      const mode = url.searchParams.get('mode') || 'auto';
      const prompt = buildChapterPrompt(book, ch, mode);
      return sendJSON(res, 200, { ok: true, prompt, ch });
    }

    // 5. API: Read chapter source text preview
    const textMatch = pathname.match(/^\/api\/books\/([^/]+)\/chapters\/(\d+)\/text$/);
    if (req.method === 'GET' && textMatch) {
      const bookId = textMatch[1];
      const chNum = Number(textMatch[2]);
      const book = inspectBook(bookId);
      const ch = book?.chapters.find((c) => c.n === chNum);
      if (!ch || !ch.textPath) return sendJSON(res, 404, { ok: false, error: 'Không có file text nguồn cho chương này.' });
      const content = readFileSync(join(ROOT, bookId, ch.textPath), 'utf8');
      return sendJSON(res, 200, { ok: true, text: content.slice(0, 60000), totalChars: content.length });
    }

    // 6. API: Build book (`node build.mjs`)
    const buildMatch = pathname.match(/^\/api\/books\/([^/]+)\/build$/);
    if (req.method === 'POST' && buildMatch) {
      const bookId = buildMatch[1];
      const bookDir = join(ROOT, bookId);
      const out = execFileSync('node', ['build.mjs'], { cwd: bookDir, encoding: 'utf8' }).trim();
      return sendJSON(res, 200, { ok: true, output: out, book: inspectBook(bookId) });
    }

    // 7. API: Run Playwright Smoke Check
    const smokeMatch = pathname.match(/^\/api\/books\/([^/]+)\/smoke$/);
    if (req.method === 'POST' && smokeMatch) {
      const bookId = smokeMatch[1];
      const body = await readBodyJSON(req);
      const args = [join(ROOT, 'tools', 'smoke.mjs'), bookId];
      if (body.ch) args.push(body.ch);
      const out = execFileSync('node', args, { cwd: ROOT, encoding: 'utf8', timeout: 45000 }).trim();
      return sendJSON(res, 200, JSON.parse(out));
    }

    // 8. API: Upload PDF file
    if (req.method === 'POST' && pathname === '/api/books/upload-pdf') {
      const rawName = req.headers['x-filename'] ? decodeURIComponent(String(req.headers['x-filename'])) : `upload-${Date.now()}.pdf`;
      const safeName = basename(rawName).replace(/[^a-zA-Z0-9._ -]/g, '_');
      const buf = await readBodyBuffer(req);
      writeFileSync(join(BOOKS_PDF_DIR, safeName), buf);
      return sendJSON(res, 200, { ok: true, file: safeName, pdfs: listPdfFiles() });
    }

    // 9. API: Create New Book from PDF
    if (req.method === 'POST' && pathname === '/api/books/create') {
      const body = await readBodyJSON(req);
      const book = createNewBook(body);
      return sendJSON(res, 200, { ok: true, book });
    }

    // 10. API: Start Claude CLI Job
    if (req.method === 'POST' && pathname === '/api/jobs/start') {
      const body = await readBodyJSON(req);
      const job = startClaudeJob(body);
      return sendJSON(res, 200, { ok: true, job });
    }

    // 11. API: Stop Claude CLI Job
    const stopMatch = pathname.match(/^\/api\/jobs\/([^/]+)\/stop$/);
    if (req.method === 'POST' && stopMatch) {
      const job = jobs.get(stopMatch[1]);
      if (!job) return sendJSON(res, 404, { ok: false, error: 'Job not found' });
      if (job.proc) {
        job.status = 'stopped';
        job.proc.kill('SIGTERM');
      }
      return sendJSON(res, 200, { ok: true, job: sanitizeJob(job) });
    }

    // 12. Serve built book Reader: /read/:bookId[/...]
    const readMatch = pathname.match(/^\/read\/([^/]+)(?:\/(.*))?$/);
    if (req.method === 'GET' && readMatch) {
      const bookId = readMatch[1];
      const subPath = readMatch[2] || 'index.html';
      const targetPath = join(ROOT, bookId, 'dist', subPath);
      if (!existsSync(targetPath)) {
        const buildScript = join(ROOT, bookId, 'build.mjs');
        if (existsSync(buildScript)) {
          execFileSync('node', ['build.mjs'], { cwd: join(ROOT, bookId) });
        }
      }
      if (existsSync(targetPath) && statSync(targetPath).isFile()) {
        const ext = extname(targetPath);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(readFileSync(targetPath));
        return;
      }
      res.writeHead(404);
      res.end('Reader build not found');
      return;
    }

    // 13. Serve Studio UI static files (DaisyUI + Tailwind App Shell)
    const studioFile = pathname === '/' ? join(STUDIO_DIR, 'index.html') : join(STUDIO_DIR, pathname.slice(1));
    if (existsSync(studioFile) && statSync(studioFile).isFile()) {
      const ext = extname(studioFile);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain; charset=utf-8' });
      res.end(readFileSync(studioFile));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  } catch (err) {
    console.error(err);
    sendJSON(res, 500, { ok: false, error: err.message || String(err) });
  }
});

server.listen(PORT, () => {
  console.log(`\n📚 Breaking Books Studio đang chạy tại: http://localhost:${PORT}`);
  console.log(`🤖 Claude CLI: ${claudeInfo.available ? `${claudeInfo.version} (${claudeInfo.bin})` : 'Chưa cài đặt'}\n`);
});
