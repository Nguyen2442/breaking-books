/* Breaking Books — Interactive Chapter Runtime (window.DDIA) for Next.js Single-Chapter Pages */
(function () {
  'use strict';
  if (window.DDIA && window.DDIA.__nextjs) return;

  const SVGNS = 'http://www.w3.org/2000/svg';
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function applyAttrs(el, attrs, isSvg) {
    if (!attrs) return;
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.setAttribute('class', v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (!isSvg && (k in el) && typeof v !== 'string' && k !== 'list') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  function append(el, children) {
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
  }
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs instanceof Node || typeof attrs === 'string' || Array.isArray(attrs)) { children.unshift(attrs); attrs = null; }
    applyAttrs(el, attrs, false);
    append(el, children);
    return el;
  }
  function s(tag, attrs, ...children) {
    const el = document.createElementNS(SVGNS, tag);
    if (attrs instanceof Node || typeof attrs === 'string' || Array.isArray(attrs)) { children.unshift(attrs); attrs = null; }
    applyAttrs(el, attrs, true);
    append(el, children);
    return el;
  }
  function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); return el; }

  const nf = new Intl.NumberFormat('vi-VN');
  function fmt(n, digits) {
    if (!isFinite(n)) return '∞';
    if (digits != null) return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(n);
    return nf.format(Math.round(n));
  }
  function fmtBig(n) {
    const a = Math.abs(n);
    if (a >= 1e9) return fmt(n / 1e9, 1) + ' tỷ';
    if (a >= 1e6) return fmt(n / 1e6, 1) + ' triệu';
    if (a >= 1e4) return fmt(n / 1e3, 1) + ' nghìn';
    return fmt(n, a < 10 ? 2 : 0);
  }
  function fmtMs(ms) {
    if (!isFinite(ms)) return '∞';
    if (ms >= 1000) return fmt(ms / 1000, 2) + ' s';
    return fmt(ms, ms < 10 ? 1 : 0) + ' ms';
  }
  function pct(x, digits = 1) { return fmt(x * 100, digits) + '%'; }

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function normal(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function percentile(sorted, p) {
    if (!sorted.length) return NaN;
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
    return sorted[idx];
  }
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const sleep = (ms) => new Promise((r) => setTimeout(r, reducedMotion ? 0 : ms));

  let uid = 0;
  const nextId = (p) => `${p || 'c'}-${++uid}`;

  function slider(o) {
    const id = o.id || nextId('sl');
    const out = h('output', { for: id });
    const input = h('input', { type: 'range', id, min: o.min, max: o.max, step: o.step || 1 });
    input.value = o.value;
    const show = () => { out.textContent = o.format ? o.format(+input.value) : input.value; };
    input.addEventListener('input', () => { show(); o.onInput && o.onInput(+input.value); });
    show();
    const el = h('div', { class: 'ctl' }, h('label', { for: id }, h('span', o.label), out), input);
    return { el, input, get value() { return +input.value; }, set(v) { input.value = v; show(); } };
  }
  function seg(o) {
    const el = h('div', { class: 'seg', role: 'group', 'aria-label': o.label || '' });
    let cur = o.value;
    const btns = o.options.map((opt) => {
      const b = h('button', { type: 'button', 'aria-pressed': String(opt.value === cur) }, opt.label);
      b.addEventListener('click', () => { api.set(opt.value); o.onChange && o.onChange(opt.value); });
      el.appendChild(b);
      return [opt.value, b];
    });
    const api = { el, get value() { return cur; }, set(v) { cur = v; btns.forEach(([val, b]) => b.setAttribute('aria-pressed', String(val === v))); } };
    return api;
  }
  function button(label, onClick, variant) {
    return h('button', { type: 'button', class: 'btn' + (variant ? ' btn-' + variant : ''), onClick }, label);
  }
  function checkbox(label, checked, onChange) {
    const id = nextId('cb');
    const input = h('input', { type: 'checkbox', id });
    input.checked = !!checked;
    input.addEventListener('change', () => onChange && onChange(input.checked));
    return { el: h('label', { class: 'chk-ctl', for: id }, input, label), input, get value() { return input.checked; } };
  }
  function stat(label, value, tone, sub) {
    const v = h('span', { class: 'val' }, value);
    const sb = h('span', { class: 'sub' }, sub || '');
    const el = h('div', { class: 'stat' + (tone ? ' ' + tone : '') }, h('span', { class: 'lbl' }, label), v, sb);
    el.update = (val, t, sbt) => { v.textContent = val; el.className = 'stat' + (t ? ' ' + t : ''); if (sbt != null) sb.textContent = sbt; };
    return el;
  }
  function log(maxLines = 200) {
    const el = h('div', { class: 'log', role: 'log', 'aria-live': 'polite' });
    el.add = (text, tone) => {
      const line = h('div', { class: tone || '' }, text);
      el.appendChild(line);
      while (el.childNodes.length > maxLines) el.removeChild(el.firstChild);
      el.scrollTop = el.scrollHeight;
      return line;
    };
    el.reset = () => clear(el);
    return el;
  }
  function jsonHTML(value, indent = 0) {
    const pad = '  '.repeat(indent);
    const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    if (value === null) return '<span class="dim">null</span>';
    if (Array.isArray(value)) {
      if (!value.length) return '[]';
      return '[\n' + value.map((v) => pad + '  ' + jsonHTML(v, indent + 1)).join(',\n') + '\n' + pad + ']';
    }
    if (typeof value === 'object') {
      const keys = Object.keys(value);
      if (!keys.length) return '{}';
      return '{\n' + keys.map((k) => `${pad}  <span class="key">"${esc(k)}"</span>: ${jsonHTML(value[k], indent + 1)}`).join(',\n') + '\n' + pad + '}';
    }
    if (typeof value === 'string') return `<span class="str">"${esc(value)}"</span>`;
    return `<span class="num">${esc(value)}</span>`;
  }

  const widgets = {};
  function widget(name, init) { widgets[name] = init; }

  const glossary = new Map();
  function addGlossary(list) { list.forEach((g) => glossary.set(g.key, g)); }

  function initWidgets(root) {
    (root || document).querySelectorAll('[data-widget]').forEach((fig) => {
      if (fig.dataset.ready) return;
      const name = fig.dataset.widget;
      const body = fig.querySelector('.lab-body') || fig;
      clear(body);
      const init = widgets[name];
      if (!init) {
        body.appendChild(h('p', { class: 'lab-note' }, `Mô phỏng "${name}" đang chờ biên soạn trong file JS của chương.`));
        return;
      }
      try { init(body, fig); fig.dataset.ready = '1'; }
      catch (err) { console.error('widget', name, err); body.appendChild(h('p', { class: 'lab-note' }, 'Không tải được ví dụ này.')); }
    });
  }

  function initQuizzes(root) {
    (root || document).querySelectorAll('.quiz').forEach((quiz) => {
      if (quiz.dataset.ready) return;
      quiz.dataset.ready = '1';
      const qs = [...quiz.querySelectorAll('.q')];
      const score = h('p', { class: 'quiz-score' });
      let answered = 0, right = 0;
      const upd = () => { score.textContent = answered ? `Đúng ${right}/${answered} câu đã trả lời (tổng ${qs.length} câu)` : `${qs.length} câu hỏi. Chọn một đáp án để xem giải thích.`; };
      qs.forEach((q) => {
        const ans = +q.dataset.answer;
        const exp = q.querySelector('.explain');
        if (exp) exp.hidden = true;
        const items = [...q.querySelectorAll('ol > li')];
        const btns = items.map((li, idx) => {
          const b = h('button', { type: 'button' });
          while (li.firstChild) b.appendChild(li.firstChild);
          li.appendChild(b);
          b.addEventListener('click', () => {
            btns.forEach((x) => (x.disabled = true));
            if (btns[ans]) btns[ans].classList.add('right');
            if (idx !== ans) b.classList.add('wrong'); else right++;
            answered++;
            if (exp) exp.hidden = false;
            upd();
          });
          return b;
        });
      });
      const reset = h('button', { type: 'button', class: 'btn btn-ghost' }, 'Làm lại');
      reset.addEventListener('click', () => {
        answered = 0; right = 0;
        quiz.querySelectorAll('.q li button').forEach((b) => { b.disabled = false; b.classList.remove('right', 'wrong'); });
        quiz.querySelectorAll('.explain').forEach((e) => (e.hidden = true));
        upd();
      });
      quiz.appendChild(h('div', { class: 'btn-row' }, score, reset));
      upd();
    });
  }

  let activePop = null, popOwner = null;
  function closePop() { if (activePop) activePop.remove(); activePop = null; popOwner = null; }

  function initTerms(root) {
    const open = (el) => {
      const g = glossary.get(el.dataset.term);
      if (!g) return;
      if (popOwner === el) return;
      closePop();
      popOwner = el;
      activePop = h('div', { class: 'term-pop', role: 'tooltip' }, h('span', { class: 'vi' }, g.vi || ''), h('b', g.term), h('p', g.def));
      document.body.appendChild(activePop);
      const r = el.getBoundingClientRect();
      const pw = Math.min(340, window.innerWidth - 32);
      activePop.style.maxWidth = pw + 'px';
      let left = r.left + window.scrollX;
      left = Math.max(16, Math.min(left, window.scrollX + window.innerWidth - pw - 16));
      activePop.style.left = left + 'px';
      activePop.style.top = (r.bottom + window.scrollY + 8) + 'px';
    };
    (root || document).querySelectorAll('dfn[data-term]').forEach((el) => {
      if (el.dataset.termReady) return;
      el.dataset.termReady = '1';
      el.tabIndex = 0;
      el.addEventListener('mouseenter', () => open(el));
      el.addEventListener('mouseleave', () => setTimeout(() => { if (popOwner === el && !el.matches(':hover')) closePop(); }, 120));
      el.addEventListener('focus', () => open(el));
      el.addEventListener('blur', closePop);
      el.addEventListener('click', (e) => { e.stopPropagation(); popOwner === el ? closePop() : open(el); });
    });
  }
  document.addEventListener('click', closePop);

  function mountChapter(root, bookId = 'ddia-2e', onProgressChange) {
    if (!root) return;
    const storeKey = `${bookId}:read`;
    const notesKey = `${bookId}:notes`;
    const bmKey = `${bookId}:bookmarks`;
    let readSet = new Set();
    let notesMap = {};
    let bookmarksList = [];
    try { readSet = new Set(JSON.parse(localStorage.getItem(storeKey) || '[]')); } catch { /* ignore */ }
    try { notesMap = JSON.parse(localStorage.getItem(notesKey) || '{}'); } catch { /* ignore */ }
    try { bookmarksList = JSON.parse(localStorage.getItem(bmKey) || '[]'); } catch { /* ignore */ }

    const saveNotes = () => {
      try { localStorage.setItem(notesKey, JSON.stringify(notesMap)); } catch { /* ignore */ }
      window.dispatchEvent(new CustomEvent('bb:notes-updated', { detail: { notes: notesMap } }));
    };

    const saveBookmarks = () => {
      try { localStorage.setItem(bmKey, JSON.stringify(bookmarksList)); } catch { /* ignore */ }
      window.dispatchEvent(new CustomEvent('bb:bookmarks-updated', { detail: { bookmarks: bookmarksList } }));
    };

    const topicNum = (t) => t.dataset.num || '';
    const topicTitle = (t) => t.dataset.short || t.querySelector('h2')?.childNodes[0]?.textContent.trim() || t.id;
    const chSection = root.querySelector('section.chapter');
    const chNum = chSection?.dataset?.ch || '';

    // Build chapter map chips
    root.querySelectorAll('section.chapter').forEach((ch) => {
      const map = ch.querySelector('.chapter-map');
      if (map) {
        clear(map);
        ch.querySelectorAll('article.topic').forEach((t) => {
          map.appendChild(h('a', { href: '#' + t.id }, (topicNum(t) ? topicNum(t) + ' ' : '') + topicTitle(t)));
        });
      }
    });

    // Add topic footers ("Đánh dấu đã đọc" + "Ghi chú cá nhân")
    const topics = [...root.querySelectorAll('article.topic')];
    const emitProgress = () => {
      const done = topics.filter((t) => readSet.has(t.id)).length;
      const payload = { done, total: topics.length, read: [...readSet] };
      if (onProgressChange) onProgressChange(payload);
      window.dispatchEvent(new CustomEvent('bb:read-updated', { detail: payload }));
    };
    const saveRead = () => {
      try { localStorage.setItem(storeKey, JSON.stringify([...readSet])); } catch { /* ignore */ }
      emitProgress();
    };

    topics.forEach((t, i) => {
      if (t.querySelector('.topic-foot')) return;
      const btn = h('button', { type: 'button', class: 'mark-read', 'aria-pressed': String(readSet.has(t.id)) });
      const label = () => {
        btn.textContent = readSet.has(t.id) ? '✓ Đã đọc mục này' : 'Đánh dấu đã đọc';
        btn.setAttribute('aria-pressed', String(readSet.has(t.id)));
      };
      label();
      btn.addEventListener('click', () => {
        readSet.has(t.id) ? readSet.delete(t.id) : readSet.add(t.id);
        label();
        saveRead();
      });

      const existingNote = notesMap[t.id]?.text || '';
      const noteBtn = h('button', {
        type: 'button',
        class: 'mark-read note-toggle',
        'aria-pressed': String(Boolean(existingNote)),
      });
      const updateNoteBtnLabel = () => {
        const hasTxt = Boolean(notesMap[t.id]?.text?.trim());
        noteBtn.textContent = hasTxt ? '📝 Có ghi chú' : '+ Ghi chú';
        noteBtn.setAttribute('aria-pressed', String(hasTxt));
      };
      updateNoteBtnLabel();

      const textarea = h('textarea', {
        class: 'topic-note-input',
        rows: 3,
        placeholder: `Ghi chú cá nhân của bạn cho mục ${topicNum(t)} ${topicTitle(t)}... (tự động lưu)`,
      });
      textarea.value = existingNote;
      const savedStatus = h('span', { class: 'topic-note-status' }, existingNote ? 'Đã lưu' : '');

      textarea.addEventListener('input', () => {
        const val = textarea.value;
        if (val.trim()) {
          notesMap[t.id] = {
            id: t.id,
            chNum: Number(chNum) || 1,
            num: topicNum(t),
            title: topicTitle(t),
            text: val,
            updatedAt: new Date().toISOString(),
          };
          savedStatus.textContent = '✓ Đã lưu tự động';
        } else {
          delete notesMap[t.id];
          savedStatus.textContent = 'Đã xoá ghi chú';
        }
        updateNoteBtnLabel();
        saveNotes();
      });

      const noteBox = h(
        'div',
        { class: 'topic-note-box', hidden: !existingNote },
        h('div', { class: 'topic-note-head' }, h('b', `Ghi chú cá nhân · ${topicNum(t)} ${topicTitle(t)}`), savedStatus),
        textarea
      );

      noteBtn.addEventListener('click', () => {
        noteBox.hidden = !noteBox.hidden;
        if (!noteBox.hidden) textarea.focus();
      });

      const isBm = () => bookmarksList.some((b) => b.topicId === t.id);
      const bmBtn = h('button', {
        type: 'button',
        class: 'mark-read bm-toggle',
        'aria-pressed': String(isBm()),
      });
      const updateBmBtn = () => {
        const has = isBm();
        bmBtn.textContent = has ? '🔖 Đã đánh dấu' : '🔖 Đánh dấu';
        bmBtn.setAttribute('aria-pressed', String(has));
      };
      updateBmBtn();
      bmBtn.addEventListener('click', () => {
        if (isBm()) {
          bookmarksList = bookmarksList.filter((b) => b.topicId !== t.id);
        } else {
          bookmarksList.push({
            bookId,
            chNum: Number(chNum) || 1,
            topicId: t.id,
            topicTitle: topicTitle(t),
            bookmarkedAt: new Date().toISOString(),
          });
        }
        updateBmBtn();
        saveBookmarks();
      });

      const leftGroup = h('div', { class: 'topic-foot-actions' }, btn, noteBtn, bmBtn);
      const foot = h('footer', { class: 'topic-foot' }, leftGroup);
      const next = topics[i + 1];
      if (next) foot.appendChild(h('a', { class: 'next', href: '#' + next.id }, 'Tiếp: ' + (topicNum(next) ? topicNum(next) + ' ' : '') + topicTitle(next) + ' →'));
      t.appendChild(noteBox);
      t.appendChild(foot);
    });

    initWidgets(root);
    initQuizzes(root);
    initTerms(root);
    emitProgress();
  }

  window.DDIA = {
    __nextjs: true,
    h, s, clear, fmt, fmtBig, fmtMs, pct, rng, normal, percentile, clamp, sleep,
    slider, seg, button, checkbox, stat, log, jsonHTML,
    widget, initWidgets, glossary: { add: addGlossary, map: glossary },
    reducedMotion, nextId, mountChapter,
  };
})();
