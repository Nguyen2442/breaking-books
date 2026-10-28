/* Minimalist Readwise/Notion Studio Bridge — integrates book management & Claude CLI directly into the Reader */
(function () {
  'use strict';

  const BOOK_ID = (window.BOOK_META && window.BOOK_META.id) || 'ddia-2e';
  let overview = null;
  let currentChapterNum = null;
  let activeJob = null;

  // Inject minimalist CSS for Studio Bridge elements
  const style = document.createElement('style');
  style.textContent = `
    .sb-top-actions { display: inline-flex; align-items: center; gap: 6px; }
    .sb-book-select {
      height: 30px; padding: 0 8px; border-radius: 6px; border: 1px solid transparent;
      background: transparent; color: var(--ink); font: 600 .85rem var(--f-display); cursor: pointer;
    }
    .sb-book-select:hover { background: var(--surface-2); border-color: var(--line); }
    .sb-pill-btn {
      height: 30px; padding: 0 11px; border-radius: 6px; border: 1px solid var(--line);
      background: var(--surface); color: var(--ink-2); font: 500 .78rem var(--f-display);
      cursor: pointer; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;
      transition: all .12s;
    }
    .sb-pill-btn:hover { border-color: var(--ink-3); color: var(--ink); background: var(--surface-2); }
    .sb-pill-btn.primary { background: var(--ink); color: var(--surface); border-color: var(--ink); }
    .sb-pill-btn.primary:hover { opacity: .88; }
    .sb-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--ok); }
    .sb-dot.running { background: var(--warn); animation: ddia-pulse 1s infinite; }

    /* Minimalist Chapter Studio Banner inside chapter header */
    .sb-chapter-bar {
      max-width: var(--read-w); margin: -18px auto 32px;
      padding: 12px 16px; border-radius: 8px;
      background: var(--surface-2); border: 1px solid var(--line);
      font-family: var(--f-display); font-size: .82rem; color: var(--ink-2);
      display: flex; flex-direction: column; gap: 10px;
    }
    .sb-chapter-bar-row {
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px;
    }
    .sb-chapter-bar-actions { display: flex; flex-wrap: wrap; gap: 6px; }
    .sb-inline-log {
      font: 400 .74rem/1.5 var(--f-mono); background: var(--code-bg);
      border-top: 1px solid var(--line); padding: 8px 10px; border-radius: 6px;
      max-height: 150px; overflow-y: auto; color: var(--ink-2);
    }
    .sb-inline-log div { margin-bottom: 2px; word-break: break-word; }

    /* Minimalist Modal */
    .sb-backdrop {
      position: fixed; inset: 0; background: rgba(15, 15, 14, .45);
      backdrop-filter: blur(3px); z-index: 120;
      display: flex; align-items: center; justify-content: center; padding: 20px;
      font-family: var(--f-display);
    }
    .sb-backdrop[hidden] { display: none; }
    .sb-modal {
      background: var(--surface); border: 1px solid var(--line); border-radius: 12px;
      max-width: 620px; width: 100%; max-height: 84vh; display: flex; flex-direction: column;
      box-shadow: 0 20px 50px rgba(0,0,0,.22); overflow: hidden;
    }
    .sb-modal-head {
      padding: 14px 18px; border-bottom: 1px solid var(--line);
      display: flex; align-items: center; justify-content: space-between;
    }
    .sb-modal-head h3 { font-size: .95rem; font-weight: 600; margin: 0; }
    .sb-modal-body { padding: 16px 18px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; font-size: .85rem; }
    .sb-modal-foot {
      padding: 12px 18px; border-top: 1px solid var(--line);
      display: flex; justify-content: flex-end; gap: 8px; background: var(--bg);
    }
    .sb-field { display: flex; flex-direction: column; gap: 4px; }
    .sb-field label { font-size: .76rem; font-weight: 500; color: var(--ink-2); }
    .sb-field input, .sb-field select, .sb-field textarea {
      padding: 8px 10px; border-radius: 6px; border: 1px solid var(--line);
      background: var(--bg); color: var(--ink); font: .84rem var(--f-display);
    }
    .sb-field textarea { font: .78rem/1.55 var(--f-mono); min-height: 190px; resize: vertical; }
  `;
  document.head.appendChild(style);

  // Create Topbar Studio Controls
  const topbar = document.querySelector('.topbar');
  const themeBtn = document.querySelector('.theme-toggle');
  const topActions = document.createElement('div');
  topActions.className = 'sb-top-actions';
  topActions.innerHTML = `
    <button type="button" class="sb-pill-btn" id="sb-btn-claude" title="Break hoặc chỉnh sửa chương hiện tại với Claude">
      <span class="sb-dot" id="sb-cli-dot"></span>
      <span id="sb-cli-label">Claude Studio</span>
    </button>
    <button type="button" class="sb-pill-btn" id="sb-btn-newbook" title="Tạo sách mới từ file PDF">+ Sách PDF</button>
  `;
  if (topbar && themeBtn) {
    topbar.insertBefore(topActions, themeBtn);
  }

  // Create Modals
  const modalsWrap = document.createElement('div');
  modalsWrap.innerHTML = `
    <!-- Prompt & Claude Runner Modal -->
    <div class="sb-backdrop" id="sb-prompt-modal" hidden>
      <div class="sb-modal">
        <div class="sb-modal-head">
          <h3 id="sb-modal-title">Break chương với Claude</h3>
          <button type="button" class="sb-pill-btn" id="sb-close-prompt">Đóng</button>
        </div>
        <div class="sb-modal-body">
          <div class="sb-field">
            <label>Chế độ</label>
            <select id="sb-mode-select">
              <option value="auto">Tự động phát hiện phần còn thiếu (Khuyên dùng)</option>
              <option value="js">Chỉ viết / bổ sung mô phỏng JS (chN.js)</option>
              <option value="html">Chỉ viết bài đọc HTML (chN.html)</option>
              <option value="full">Break lại toàn bộ chương (HTML + JS)</option>
              <option value="custom">Tùy chỉnh yêu cầu (Custom Prompt)</option>
            </select>
          </div>
          <div class="sb-field">
            <label>Prompt (dùng để chạy ngầm qua Claude CLI hoặc Copy dán vào VS Code Extension)</label>
            <textarea id="sb-prompt-text"></textarea>
          </div>
        </div>
        <div class="sb-modal-foot">
          <button type="button" class="sb-pill-btn" id="sb-btn-text-src">Xem văn bản gốc</button>
          <button type="button" class="sb-pill-btn" id="sb-btn-copy">Copy cho VS Code</button>
          <button type="button" class="sb-pill-btn primary" id="sb-btn-run">Chạy ngầm bằng Claude CLI</button>
        </div>
      </div>
    </div>

    <!-- New Book from PDF Modal -->
    <div class="sb-backdrop" id="sb-newbook-modal" hidden>
      <div class="sb-modal">
        <div class="sb-modal-head">
          <h3>Khởi tạo sách tương tác từ PDF</h3>
          <button type="button" class="sb-pill-btn" id="sb-close-newbook">Đóng</button>
        </div>
        <div class="sb-modal-body">
          <div class="sb-field">
            <label>Chọn sách đã có trên kệ (chuyển nhanh)</label>
            <select id="sb-switch-book"></select>
          </div>
          <hr style="border:0;border-top:1px solid var(--line);margin:4px 0">
          <div class="sb-field">
            <label>Hoặc chọn file PDF trong thư mục /books để tạo sách mới</label>
            <div style="display:flex;gap:6px">
              <select id="sb-pdf-select" style="flex:1"></select>
              <label class="sb-pill-btn" style="cursor:pointer">
                Upload PDF
                <input type="file" id="sb-pdf-upload" accept=".pdf" hidden>
              </label>
            </div>
          </div>
          <div class="sb-field">
            <label>Mã sách (slug, ví dụ: clean-arch)</label>
            <input type="text" id="sb-nb-id" placeholder="clean-arch">
          </div>
          <div class="sb-field">
            <label>Tên hiển thị</label>
            <input type="text" id="sb-nb-title" placeholder="Sổ tay Clean Architecture">
          </div>
          <div class="sb-field">
            <label>Tên sách gốc & Tác giả</label>
            <input type="text" id="sb-nb-sub" placeholder="Clean Architecture · Robert C. Martin">
          </div>
        </div>
        <div class="sb-modal-foot">
          <button type="button" class="sb-pill-btn primary" id="sb-btn-create-book">Trích xuất PDF & Tạo sách</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modalsWrap);

  async function fetchOverview() {
    try {
      const res = await fetch('/api/overview');
      const data = await res.json();
      if (data.ok) {
        overview = data;
        updateSidebarDots();
        renderChapterStudioBar();
      }
    } catch { /* ignore offline */ }
  }

  function getBookInfo() {
    if (!overview) return null;
    return overview.books.find((b) => b.id === BOOK_ID) || overview.books[0];
  }

  function getChapterInfo(n) {
    const b = getBookInfo();
    if (!b) return null;
    return b.chapters.find((c) => c.n === Number(n));
  }

  function updateSidebarDots() {
    const b = getBookInfo();
    if (!b) return;
    b.chapters.forEach((ch) => {
      const link = document.querySelector(`.rail details[data-ch="ch${ch.n}"] > summary .ch-link, .rail a[data-ch-link="ch${ch.n}"]`);
      if (!link) return;
      let dot = link.querySelector('.status-dot');
      if (!dot) {
        dot = document.createElement('span');
        dot.className = 'status-dot';
        link.appendChild(dot);
      }
      if (ch.status === 'complete') {
        dot.style.background = 'var(--ok)';
        dot.style.opacity = '0.8';
        dot.title = 'Hoàn chỉnh';
      } else if (ch.status === 'partial') {
        dot.style.background = 'var(--warn)';
        dot.style.opacity = '0.85';
        dot.title = `Đang dở (thiếu ${ch.missingWidgets.length || 1} phần)`;
      } else {
        dot.style.background = 'var(--ink-3)';
        dot.style.opacity = '0.35';
        dot.title = 'Chưa break';
      }
    });
  }

  function renderChapterStudioBar() {
    document.querySelectorAll('.sb-chapter-bar').forEach((el) => el.remove());
    if (!currentChapterNum) return;
    const ch = getChapterInfo(currentChapterNum);
    if (!ch) return;

    const sec = document.getElementById('ch' + currentChapterNum);
    const head = sec?.querySelector('.chapter-head');
    if (!sec || !head) return;

    const isRunning = activeJob && activeJob.chNum === Number(currentChapterNum) && activeJob.status === 'running';

    // Only show inline banner automatically if chapter is incomplete OR a job is currently running on it
    if (ch.status === 'complete' && !isRunning) return;

    let msg = '';
    let btnLabel = 'Hoàn thiện với Claude CLI';
    if (isRunning) {
      msg = `Claude CLI đang xử lý Chương ${ch.n}…`;
    } else if (ch.hasHtml && !ch.hasJs) {
      msg = `Chương này đã có bài đọc (${ch.topicsCount} chủ đề), còn thiếu file mô phỏng tương tác src/ch${ch.n}.js (${ch.htmlWidgets.length} labs).`;
      btnLabel = `Tạo ${ch.htmlWidgets.length} mô phỏng bằng Claude CLI`;
    } else if (ch.hasHtml && ch.missingWidgets.length > 0) {
      msg = `Chương này đã có ${ch.jsWidgets.length}/${ch.htmlWidgets.length} mô phỏng, còn thiếu ${ch.missingWidgets.length} mô phỏng (${ch.missingWidgets.slice(0, 4).join(', ')}${ch.missingWidgets.length > 4 ? '…' : ''}).`;
      btnLabel = `Bù ${ch.missingWidgets.length} mô phỏng còn thiếu`;
    } else if (!ch.hasHtml && ch.hasJs) {
      msg = `Chương này đã có sẵn ${ch.jsWidgets.length} mô phỏng trong src/ch${ch.n}.js, chỉ còn thiếu bài đọc src/ch${ch.n}.html.`;
      btnLabel = `Viết bài đọc khớp ${ch.jsWidgets.length} mô phỏng`;
    } else {
      msg = `Chương này đã trích xuất văn bản gốc (${Math.round(ch.textSize / 1024)} KB), chưa được biên soạn.`;
      btnLabel = `Break Chương ${ch.n} bằng Claude CLI`;
    }

    const bar = document.createElement('div');
    bar.className = 'sb-chapter-bar';
    bar.innerHTML = `
      <div class="sb-chapter-bar-row">
        <span>${msg}</span>
        <div class="sb-chapter-bar-actions">
          ${isRunning
            ? `<button type="button" class="sb-pill-btn" id="sb-bar-stop">Dừng Claude</button>`
            : `<button type="button" class="sb-pill-btn primary" id="sb-bar-run">${btnLabel}</button>`
          }
          <button type="button" class="sb-pill-btn" id="sb-bar-prompt">Prompt / VS Code</button>
        </div>
      </div>
      <div class="sb-inline-log" id="sb-inline-log" ${isRunning ? '' : 'hidden'}></div>
    `;

    head.insertAdjacentElement('afterend', bar);

    bar.querySelector('#sb-bar-run')?.addEventListener('click', () => startClaudeJob(ch.n, 'auto', ''));
    bar.querySelector('#sb-bar-stop')?.addEventListener('click', () => stopClaudeJob());
    bar.querySelector('#sb-bar-prompt')?.addEventListener('click', () => openPromptModal(ch.n));
  }

  async function openPromptModal(chNum) {
    const n = chNum || currentChapterNum || 1;
    currentChapterNum = n;
    const ch = getChapterInfo(n);
    document.getElementById('sb-modal-title').textContent = `Chương ${n}: ${ch ? ch.en : ''}`;
    document.getElementById('sb-mode-select').value = 'auto';
    await loadPromptText(n, 'auto');
    document.getElementById('sb-prompt-modal').hidden = false;
  }

  async function loadPromptText(n, mode) {
    const ta = document.getElementById('sb-prompt-text');
    if (mode === 'custom') {
      ta.value = '';
      ta.placeholder = 'Nhập yêu cầu tùy chỉnh của bạn cho chương này...';
      return;
    }
    const res = await fetch(`/api/books/${encodeURIComponent(BOOK_ID)}/chapters/${n}/prompt?mode=${mode}`);
    const data = await res.json();
    if (data.ok) ta.value = data.prompt;
  }

  async function startClaudeJob(chNum, mode, customPrompt) {
    document.getElementById('sb-prompt-modal').hidden = true;
    const res = await fetch('/api/jobs/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId: BOOK_ID, chNum, mode, customPrompt }),
    });
    const data = await res.json();
    if (data.ok) {
      activeJob = data.job;
      document.getElementById('sb-cli-dot').classList.add('running');
      document.getElementById('sb-cli-label').textContent = `Đang chạy Ch.${chNum}…`;
      renderChapterStudioBar();
    } else {
      alert(data.error || 'Không thể khởi chạy Claude CLI');
    }
  }

  async function stopClaudeJob() {
    if (!activeJob) return;
    await fetch(`/api/jobs/${encodeURIComponent(activeJob.id)}/stop`, { method: 'POST' });
  }

  // Event Listeners
  window.addEventListener('bb:viewchange', (e) => {
    currentChapterNum = e.detail.chapter ? Number(e.detail.chapter) : null;
    renderChapterStudioBar();
  });

  document.getElementById('sb-btn-claude').addEventListener('click', () => {
    openPromptModal(currentChapterNum || 1);
  });
  document.getElementById('sb-close-prompt').addEventListener('click', () => {
    document.getElementById('sb-prompt-modal').hidden = true;
  });
  document.getElementById('sb-mode-select').addEventListener('change', (e) => {
    loadPromptText(currentChapterNum || 1, e.target.value);
  });
  document.getElementById('sb-btn-copy').addEventListener('click', async () => {
    await navigator.clipboard.writeText(document.getElementById('sb-prompt-text').value);
    const btn = document.getElementById('sb-btn-copy');
    btn.textContent = '✓ Đã Copy';
    setTimeout(() => (btn.textContent = 'Copy cho VS Code'), 1500);
  });
  document.getElementById('sb-btn-run').addEventListener('click', () => {
    const promptVal = document.getElementById('sb-prompt-text').value;
    startClaudeJob(currentChapterNum || 1, 'custom', promptVal);
  });
  document.getElementById('sb-btn-text-src').addEventListener('click', async () => {
    const n = currentChapterNum || 1;
    const res = await fetch(`/api/books/${encodeURIComponent(BOOK_ID)}/chapters/${n}/text`);
    const data = await res.json();
    if (data.ok) {
      document.getElementById('sb-prompt-text').value = data.text;
    }
  });

  // New Book / Switch Book Modal
  document.getElementById('sb-btn-newbook').addEventListener('click', async () => {
    await fetchOverview();
    const sw = document.getElementById('sb-switch-book');
    sw.innerHTML = '';
    (overview?.books || []).forEach((b) => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.selected = b.id === BOOK_ID;
      opt.textContent = `${b.title} (${b.completeCount}/${b.totalChapters} chương)`;
      sw.appendChild(opt);
    });
    sw.onchange = () => {
      if (sw.value && sw.value !== BOOK_ID) {
        location.href = `/read/${encodeURIComponent(sw.value)}/index.html`;
      }
    };

    const ps = document.getElementById('sb-pdf-select');
    ps.innerHTML = '';
    (overview?.pdfs || []).forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.name;
      opt.textContent = `${p.name} (${(p.size / (1024 * 1024)).toFixed(1)} MB)`;
      ps.appendChild(opt);
    });

    document.getElementById('sb-newbook-modal').hidden = false;
  });

  document.getElementById('sb-close-newbook').addEventListener('click', () => {
    document.getElementById('sb-newbook-modal').hidden = true;
  });

  document.getElementById('sb-pdf-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await fetch('/api/books/upload-pdf', {
      method: 'POST',
      headers: { 'x-filename': encodeURIComponent(file.name) },
      body: file,
    });
    await fetchOverview();
    document.getElementById('sb-btn-newbook').click();
  });

  document.getElementById('sb-btn-create-book').addEventListener('click', async () => {
    const btn = document.getElementById('sb-btn-create-book');
    btn.disabled = true;
    btn.textContent = 'Đang trích xuất chương từ PDF…';
    try {
      const subParts = document.getElementById('sb-nb-sub').value.split('·').map((s) => s.trim());
      const res = await fetch('/api/books/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfFile: document.getElementById('sb-pdf-select').value,
          id: document.getElementById('sb-nb-id').value.trim(),
          title: document.getElementById('sb-nb-title').value.trim(),
          subtitle: subParts[0] || '',
          author: subParts[1] || '',
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        alert(data.error || 'Lỗi tạo sách');
        return;
      }
      location.href = `/read/${encodeURIComponent(data.book.id)}/index.html`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Trích xuất PDF & Tạo sách';
    }
  });

  // SSE Live Job Stream
  const es = new EventSource('/api/jobs/stream');
  es.addEventListener('job-log', (e) => {
    const { entry } = JSON.parse(e.data);
    const logBox = document.getElementById('sb-inline-log');
    if (logBox) {
      logBox.hidden = false;
      const line = document.createElement('div');
      line.textContent = entry.text;
      logBox.appendChild(line);
      logBox.scrollTop = logBox.scrollHeight;
    }
  });
  es.addEventListener('job-update', (e) => {
    const job = JSON.parse(e.data);
    activeJob = job;
    const dot = document.getElementById('sb-cli-dot');
    const lbl = document.getElementById('sb-cli-label');
    if (job.status === 'running') {
      dot.classList.add('running');
      lbl.textContent = `Đang chạy Ch.${job.chNum}…`;
    } else {
      dot.classList.remove('running');
      lbl.textContent = 'Claude Studio';
      if (job.status === 'done') {
        setTimeout(() => location.reload(), 800);
      }
    }
    renderChapterStudioBar();
  });

  fetchOverview();
})();
