/* DDIA reading companion — core runtime: helpers, widget registry, nav, progress, glossary, quiz, search. */
(function () {
  'use strict';

  const SVGNS = 'http://www.w3.org/2000/svg';
  const META = window.BOOK_META || null;
  const STORE_KEY = (META && META.id ? META.id : 'ddia2e') + ':read';
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- DOM helpers ----------
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
  /** h('div', {class:'x', onClick: fn}, 'text', child) */
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs instanceof Node || typeof attrs === 'string' || Array.isArray(attrs)) { children.unshift(attrs); attrs = null; }
    applyAttrs(el, attrs, false);
    append(el, children);
    return el;
  }
  /** s('rect', {x, y, class:'f-accent'}) — SVG element */
  function s(tag, attrs, ...children) {
    const el = document.createElementNS(SVGNS, tag);
    if (attrs instanceof Node || typeof attrs === 'string' || Array.isArray(attrs)) { children.unshift(attrs); attrs = null; }
    applyAttrs(el, attrs, true);
    append(el, children);
    return el;
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

  // ---------- number formatting (vi-VN) ----------
  const nf = new Intl.NumberFormat('vi-VN');
  function fmt(n, digits) {
    if (!isFinite(n)) return '∞';
    if (digits != null) return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(n);
    return nf.format(Math.round(n));
  }
  /** 1.2 triệu, 400 triệu, 3,4 tỷ */
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

  // ---------- randomness ----------
  function rng(seed) { // mulberry32
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

  // ---------- control builders ----------
  let uid = 0;
  const nextId = (p) => `${p || 'c'}-${++uid}`;

  /** slider({label, min, max, step, value, format:(v)=>str, onInput:(v)=>{}}) -> {el, get value(), set(v)} */
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
  /** seg({options:[{value,label}], value, onChange}) */
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
  /** stat('Nhãn', 'giá trị', 'ok'|'warn'|'bad'|'accent', 'phụ chú') -> element with .update(val, tone, sub) */
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
  /** Pretty JSON with token classes. highlightKeys: Set of keys to wrap in <mark>. */
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

  // ---------- widget registry ----------
  const widgets = {};
  function widget(name, init) { widgets[name] = init; }
  function initWidgets(root) {
    (root || document).querySelectorAll('[data-widget]').forEach((fig) => {
      if (fig.dataset.ready) return;
      const name = fig.dataset.widget;
      const body = fig.querySelector('.lab-body') || fig;
      const init = widgets[name];
      if (!init) { body.appendChild(h('p', { class: 'lab-note' }, `Widget "${name}" chưa được đăng ký.`)); return; }
      try { init(body, fig); fig.dataset.ready = '1'; }
      catch (err) { console.error('widget', name, err); body.appendChild(h('p', { class: 'lab-note' }, 'Không tải được ví dụ này.')); }
    });
  }

  // ---------- glossary ----------
  const glossary = new Map(); // key -> {key, term, vi, def, ch, topic}
  function addGlossary(list) { list.forEach((g) => glossary.set(g.key, g)); }

  // ---------- progress store ----------
  function loadRead() { try { return new Set(JSON.parse(localStorage.getItem(STORE_KEY) || '[]')); } catch (e) { return new Set(); } }
  function saveRead(set) { try { localStorage.setItem(STORE_KEY, JSON.stringify([...set])); } catch (e) { /* storage blocked */ } }
  const read = loadRead();

  // ---------- text normalize for search ----------
  const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

  // ---------- book structure (2nd-edition order; e1 = chapter in the 1st edition used as source) ----------
  const BOOK = (META && Array.isArray(META.chapters) && META.chapters.length) ? META.chapters : [
    { n: 1, en: 'Trade-offs in Data Systems Architecture', src: '2e' },
    { n: 2, en: 'Defining Nonfunctional Requirements', src: '2e', e1: 1 },
    { n: 3, en: 'Data Models and Query Languages', src: '2e', e1: 2 },
    { n: 4, en: 'Storage and Retrieval', src: '1e', e1: 3 },
    { n: 5, en: 'Encoding and Evolution', src: '1e', e1: 4 },
    { n: 6, en: 'Replication', src: '1e', e1: 5 },
    { n: 7, en: 'Partitioning', src: '1e', e1: 6 },
    { n: 8, en: 'Transactions', src: '1e', e1: 7 },
    { n: 9, en: 'The Trouble with Distributed Systems', src: '1e', e1: 8 },
    { n: 10, en: 'Consistency and Consensus', src: '1e', e1: 9 },
    { n: 11, en: 'Batch Processing', src: '1e', e1: 10 },
    { n: 12, en: 'Stream Processing', src: '1e', e1: 11 },
    { n: 13, en: 'The Future of Data Systems', src: '1e', e1: 12 },
  ];
  const PARTS = (META && META.parts) ? META.parts : { 1: 'Phần I · Nền tảng của hệ thống dữ liệu', 6: 'Phần II · Dữ liệu phân tán', 11: 'Phần III · Dữ liệu dẫn xuất' };

  function buildBookMap(chapters) {
    const map = document.querySelector('.book-map');
    if (!map) return;
    clear(map);
    const byNum = new Map(chapters.map((c) => [String(c.dataset.chapter), c]));
    BOOK.forEach((b) => {
      const partTitle = b.part || PARTS[b.n];
      if (partTitle) map.appendChild(h('div', { class: 'bm-part' }, partTitle));
      const chEl = byNum.get(String(b.n));
      const isReady = chEl && !chEl.dataset.missing;
      const numStr = String(b.n).padStart(2, '0');
      const viLabel = (chEl && chEl.dataset.title) || b.vi || '';
      const inner = [
        h('span', { class: 'n' }, 'Ch.' + numStr),
        h('b', b.en || b.title || ('Chương ' + b.n)),
        viLabel ? h('span', { class: 'src' }, viLabel) : null,
      ];
      if (isReady) {
        map.appendChild(h('a', { class: 'bm on', href: '#ch' + b.n }, inner, h('span', { class: 'lab-note cnt' }), h('span', { class: 'prog' }, h('i'))));
      } else {
        map.appendChild(h('a', { class: 'bm off', href: '#ch' + b.n }, inner, h('span', { class: 'lab-note' }, 'Chưa soạn')));
      }
    });
  }

  function ensureMissingChapters() {
    const page = document.querySelector('.page');
    const gloss = document.getElementById('glossary');
    if (!page) return;
    BOOK.forEach((b) => {
      if (document.getElementById('ch' + b.n)) return;
      const sec = h('section', {
        class: 'chapter',
        id: 'ch' + b.n,
        'data-chapter': String(b.n),
        'data-title': b.vi || b.en,
        'data-missing': '1',
      },
        h('header', { class: 'chapter-head' },
          h('p', { class: 'eyebrow' }, 'Chương ' + b.n),
          h('h1', b.en, b.vi ? h('span', { class: 'vi' }, b.vi) : null),
          h('p', { class: 'lede' }, 'Chương này chưa có bài viết tương tác. Bạn có thể bấm nút "Break chương này bằng Claude CLI" ở thanh công cụ phía trên để tự động biên soạn.')
        )
      );
      if (gloss) page.insertBefore(sec, gloss);
      else page.appendChild(sec);
    });
  }

  function addChapterPagers() {
    BOOK.forEach((b, idx) => {
      const ch = document.getElementById('ch' + b.n);
      if (!ch || ch.querySelector('.chapter-pager')) return;
      const prev = BOOK[idx - 1];
      const next = BOOK[idx + 1];
      const pager = h('nav', { class: 'chapter-pager', 'aria-label': 'Chuyển chương' });
      if (prev) {
        pager.appendChild(h('a', { class: 'prev-ch', href: '#ch' + prev.n },
          h('span', '← Chương ' + prev.n),
          h('b', prev.en)
        ));
      } else {
        pager.appendChild(h('a', { class: 'prev-ch', href: '#home' },
          h('span', '← Tổng quan'),
          h('b', 'Mục lục cuốn sách')
        ));
      }
      if (next) {
        pager.appendChild(h('a', { class: 'next-ch', href: '#ch' + next.n },
          h('span', 'Chương ' + next.n + ' →'),
          h('b', next.en)
        ));
      }
      ch.appendChild(pager);
    });
  }

  function activateView(rawHash, scrollTarget = true) {
    const id = (rawHash || '').replace(/^#/, '') || 'home';
    const targetEl = document.getElementById(id);
    let viewSection = document.getElementById('home');
    if (id === 'glossary') {
      viewSection = document.getElementById('glossary');
    } else if (targetEl) {
      viewSection = targetEl.closest('section.chapter, section.home-hero') || viewSection;
    } else if (/^ch(\d+)/.test(id)) {
      const m = id.match(/^ch(\d+)/);
      viewSection = document.getElementById('ch' + m[1]) || viewSection;
    }
    if (!viewSection) return;

    document.querySelectorAll('.home-hero, section.chapter').forEach((sec) => {
      sec.classList.toggle('active-view', sec === viewSection);
    });

    if (viewSection.classList.contains('chapter')) {
      initWidgets(viewSection);
    }

    const activeChId = viewSection.id;
    document.querySelectorAll('.rail details[data-ch]').forEach((det) => {
      const isAct = det.dataset.ch === activeChId;
      det.classList.toggle('active-ch', isAct);
      det.open = isAct;
    });
    document.querySelectorAll('.rail > a').forEach((a) => {
      a.classList.toggle('current', a.getAttribute('href') === '#' + activeChId);
    });

    if (scrollTarget) {
      if (targetEl && targetEl !== viewSection) {
        setTimeout(() => targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' }), 15);
      } else {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    }
    window.dispatchEvent(new CustomEvent('bb:viewchange', { detail: { viewId: viewSection.id, chapter: viewSection.dataset.chapter || null } }));
  }

  // ---------- boot ----------
  function boot() {
    document.body.classList.add('single-chapter');
    ensureMissingChapters();
    const chapters = [...document.querySelectorAll('section.chapter:not(#glossary)')].sort((a, b) => (+a.dataset.chapter) - (+b.dataset.chapter));
    const topics = [...document.querySelectorAll('article.topic')];
    buildRail(chapters);
    buildBookMap(chapters);
    buildChapterMaps(chapters);
    addTopicFooters(topics);
    addChapterPagers();
    initQuizzes();
    initWidgets();
    initTerms();
    buildGlossaryPage();
    initSearch(topics);
    initTheme();
    initScrollSpy(topics);
    refreshProgress();
    activateView(location.hash || '#home', Boolean(location.hash));
    window.addEventListener('hashchange', () => activateView(location.hash || '#home', true));
    document.querySelector('.rail-toggle')?.addEventListener('click', () => document.body.classList.toggle('rail-open'));
    document.querySelector('.rail')?.addEventListener('click', (e) => { if (e.target.closest('a')) document.body.classList.remove('rail-open'); });
  }

  function topicNum(t) { return t.dataset.num || ''; }
  function topicTitle(t) { return t.dataset.short || t.querySelector('h2')?.childNodes[0]?.textContent.trim() || t.id; }

  function buildRail(chapters) {
    const rail = document.querySelector('.rail');
    if (!rail) return;
    clear(rail);
    rail.appendChild(h('a', { href: '#home' }, h('span', { class: 'num' }, '00'), 'Tổng quan sách'));
    rail.appendChild(h('a', { href: '#glossary' }, h('span', { class: 'num' }, 'A–Z'), 'Từ điển thuật ngữ'));
    rail.appendChild(h('h4', 'Mục lục chương'));
    chapters.forEach((ch) => {
      const chNum = String(ch.dataset.chapter).padStart(2, '0');
      const isMissing = ch.dataset.missing === '1';
      const titleText = ch.dataset.title || ('Chương ' + ch.dataset.chapter);
      if (isMissing) {
        rail.appendChild(h('a', { href: '#' + ch.id, class: 'locked', 'data-ch-link': ch.id },
          h('span', { class: 'num' }, chNum),
          h('span', titleText),
          h('span', { class: 'status-dot draft', title: 'Chưa soạn' })
        ));
        return;
      }
      const det = h('details', { open: false, 'data-ch': ch.id });
      const sum = h('summary', h('a', { href: '#' + ch.id, class: 'ch-link' },
        h('span', { class: 'num' }, chNum),
        h('span', titleText)
      ));
      det.appendChild(sum);
      const topicsWrap = h('div', { class: 'ch-topics' });
      ch.querySelectorAll('article.topic').forEach((t) => {
        topicsWrap.appendChild(h('a', { href: '#' + t.id, 'data-topic': t.id },
          h('span', { class: 'num' }, topicNum(t)),
          h('span', topicTitle(t)),
          h('span', { class: 'chk', 'aria-hidden': 'true' }, '✓')
        ));
      });
      det.appendChild(topicsWrap);
      rail.appendChild(det);
    });
  }

  function buildChapterMaps(chapters) {
    chapters.forEach((ch) => {
      const map = ch.querySelector('.chapter-map');
      if (!map) return;
      clear(map);
      ch.querySelectorAll('article.topic').forEach((t) => map.appendChild(h('a', { href: '#' + t.id }, (topicNum(t) ? topicNum(t) + ' ' : '') + topicTitle(t))));
    });
  }

  function addTopicFooters(topics) {
    topics.forEach((t, i) => {
      if (t.querySelector('.topic-foot')) return;
      const btn = h('button', { type: 'button', class: 'mark-read', 'aria-pressed': String(read.has(t.id)) });
      const label = () => { btn.textContent = read.has(t.id) ? '✓ Đã đọc' : 'Đánh dấu đã đọc'; btn.setAttribute('aria-pressed', String(read.has(t.id))); };
      label();
      btn.addEventListener('click', () => { read.has(t.id) ? read.delete(t.id) : read.add(t.id); saveRead(read); label(); refreshProgress(); });
      const foot = h('footer', { class: 'topic-foot' }, btn);
      const next = topics[i + 1];
      if (next) foot.appendChild(h('a', { class: 'next', href: '#' + next.id }, 'Tiếp: ' + (topicNum(next) ? topicNum(next) + ' ' : '') + topicTitle(next) + ' →'));
      t.appendChild(foot);
    });
  }

  function refreshProgress() {
    const topics = [...document.querySelectorAll('article.topic')];
    const done = topics.filter((t) => read.has(t.id)).length;
    const bar = document.querySelector('.top-progress .bar i');
    const txt = document.querySelector('.top-progress .txt');
    if (bar) bar.style.width = (topics.length ? (done / topics.length) * 100 : 0) + '%';
    if (txt) txt.textContent = `${done}/${topics.length} chủ đề`;
    document.querySelectorAll('.rail a[data-topic]').forEach((a) => a.classList.toggle('done', read.has(a.dataset.topic)));
    document.querySelectorAll('section.chapter').forEach((ch) => {
      const ts = [...ch.querySelectorAll('article.topic')];
      const d = ts.filter((t) => read.has(t.id)).length;
      const w = (ts.length ? (d / ts.length) * 100 : 0) + '%';
      const railBar = document.querySelector(`.rail details[data-ch="${ch.id}"] .ch-prog i`);
      if (railBar) railBar.style.width = w;
      const card = document.querySelector(`.book-map a[href="#${ch.id}"]`);
      if (card) {
        const i = card.querySelector('.prog i'); if (i) i.style.width = w;
        const c = card.querySelector('.cnt'); if (c) c.textContent = `${d}/${ts.length} đã đọc`;
      }
    });
  }

  function initScrollSpy(topics) {
    if (!('IntersectionObserver' in window)) return;
    const links = new Map([...document.querySelectorAll('.rail a[data-topic]')].map((a) => [a.dataset.topic, a]));
    let current = null;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          if (current) current.classList.remove('current');
          current = links.get(e.target.id);
          if (current) current.classList.add('current');
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    topics.forEach((t) => io.observe(t));
  }

  function initTheme() {
    const btn = document.querySelector('.theme-toggle');
    if (!btn) return;
    const root = document.documentElement;
    let saved = null;
    try { saved = localStorage.getItem('ddia2e:theme'); } catch (e) { /* ignore */ }
    if (saved === 'dark' || saved === 'light') root.setAttribute('data-theme', saved);
    const isDark = () => root.getAttribute('data-theme') ? root.getAttribute('data-theme') === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    const label = () => { btn.textContent = isDark() ? '☀' : '☾'; btn.setAttribute('aria-label', isDark() ? 'Chuyển sang nền sáng' : 'Chuyển sang nền tối'); };
    label();
    btn.addEventListener('click', () => {
      const next = isDark() ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('ddia2e:theme', next); } catch (e) { /* ignore */ }
      label();
    });
  }

  // ---------- quizzes ----------
  // Markup: <div class="quiz"><div class="q" data-answer="2"><p>Câu hỏi</p><ol><li>A</li><li>B</li>...</ol><p class="explain" hidden>Giải thích</p></div></div>
  function initQuizzes() {
    document.querySelectorAll('.quiz').forEach((quiz) => {
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
            btns[ans].classList.add('right');
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

  // ---------- term popovers ----------
  function initTerms() {
    let pop = null, owner = null;
    const close = () => { if (pop) pop.remove(); pop = null; owner = null; };
    const open = (el) => {
      const g = glossary.get(el.dataset.term);
      if (!g) return;
      if (owner === el) return;
      close();
      owner = el;
      pop = h('div', { class: 'term-pop', role: 'tooltip' }, h('span', { class: 'vi' }, g.vi || ''), h('b', g.term), h('p', g.def));
      document.body.appendChild(pop);
      const r = el.getBoundingClientRect();
      const pw = Math.min(340, window.innerWidth - 32);
      pop.style.maxWidth = pw + 'px';
      let left = r.left + window.scrollX;
      left = Math.max(16, Math.min(left, window.scrollX + window.innerWidth - pw - 16));
      pop.style.left = left + 'px';
      pop.style.top = (r.bottom + window.scrollY + 8) + 'px';
    };
    document.querySelectorAll('dfn[data-term]').forEach((el) => {
      el.tabIndex = 0;
      el.addEventListener('mouseenter', () => open(el));
      el.addEventListener('mouseleave', () => setTimeout(() => { if (owner === el && !el.matches(':hover')) close(); }, 120));
      el.addEventListener('focus', () => open(el));
      el.addEventListener('blur', close);
      el.addEventListener('click', (e) => { e.stopPropagation(); owner === el ? close() : open(el); });
    });
    document.addEventListener('click', close);
    window.addEventListener('scroll', () => { if (pop && owner) { const r = owner.getBoundingClientRect(); pop.style.top = (r.bottom + window.scrollY + 8) + 'px'; } }, { passive: true });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  }

  function buildGlossaryPage() {
    const list = document.querySelector('.gloss-list');
    const input = document.querySelector('#gloss-filter');
    const chSel = document.querySelector('#gloss-ch');
    if (!list) return;
    const items = [...glossary.values()].sort((a, b) => a.term.localeCompare(b.term, 'en'));
    const render = () => {
      const q = norm(input?.value);
      const ch = chSel?.value || '';
      clear(list);
      const shown = items.filter((g) => (!ch || String(g.ch) === ch) && (!q || norm(g.term + ' ' + g.vi + ' ' + g.def).includes(q)));
      shown.forEach((g) => list.appendChild(h('div', { class: 'gloss-item' },
        h('span', { class: 'vi' }, (g.vi || '') + (g.ch ? ' · Ch.' + g.ch : '')),
        h('b', g.term), h('p', g.def),
        g.topic ? h('a', { href: '#' + g.topic }, 'Xem trong bài →') : null)));
      if (!shown.length) list.appendChild(h('p', { class: 'lab-note' }, 'Không có thuật ngữ nào khớp. Thử bỏ dấu hoặc gõ tiếng Anh.'));
      const cnt = document.querySelector('.gloss-count');
      if (cnt) cnt.textContent = `${shown.length}/${items.length} thuật ngữ`;
    };
    input?.addEventListener('input', render);
    chSel?.addEventListener('change', render);
    render();
  }

  // ---------- search ----------
  function initSearch(topics) {
    const input = document.querySelector('#site-search');
    const box = document.querySelector('.search-results');
    if (!input || !box) return;
    const idx = topics.map((t) => ({
      id: t.id, title: (topicNum(t) ? topicNum(t) + ' ' : '') + topicTitle(t),
      ch: t.closest('section.chapter')?.dataset.title || '',
      text: norm(t.querySelector('h2')?.textContent + ' ' + (t.querySelector('.tldr')?.textContent || '') + ' ' + (t.dataset.keywords || '')),
      full: norm(t.textContent),
    }));
    let active = -1, results = [];
    const render = () => {
      const q = norm(input.value.trim());
      clear(box);
      if (!q) { box.hidden = true; return; }
      const terms = [...glossary.values()].filter((g) => norm(g.term + ' ' + g.vi).includes(q)).slice(0, 5)
        .map((g) => ({ href: '#' + (g.topic || 'glossary'), title: g.term, sub: 'Thuật ngữ · ' + (g.vi || '') }));
      const ts = idx.map((x) => ({ x, score: x.text.includes(q) ? 2 : x.full.includes(q) ? 1 : 0 })).filter((r) => r.score).sort((a, b) => b.score - a.score).slice(0, 8)
        .map(({ x }) => ({ href: '#' + x.id, title: x.title, sub: x.ch }));
      results = [...terms, ...ts];
      active = results.length ? 0 : -1;
      if (!results.length) box.appendChild(h('div', { class: 'empty' }, 'Không tìm thấy. Thử từ khoá tiếng Anh, ví dụ "fan-out".'));
      results.forEach((r, i) => box.appendChild(h('a', { href: r.href, class: i === active ? 'active' : '' }, r.title, h('small', r.sub))));
      box.hidden = false;
    };
    input.addEventListener('input', render);
    input.addEventListener('keydown', (e) => {
      const links = [...box.querySelectorAll('a')];
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!links.length) return;
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
        links.forEach((a, i) => a.classList.toggle('active', i === active));
      } else if (e.key === 'Enter' && links[active]) { links[active].click(); }
      else if (e.key === 'Escape') { input.value = ''; render(); input.blur(); }
    });
    box.addEventListener('click', (e) => { if (e.target.closest('a')) { input.value = ''; render(); } });
    document.addEventListener('click', (e) => { if (!e.target.closest('.search')) box.hidden = true; });
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); }
    });
  }

  window.DDIA = { h, s, clear, fmt, fmtBig, fmtMs, pct, rng, normal, percentile, clamp, sleep, slider, seg, button, checkbox, stat, log, jsonHTML, widget, initWidgets, glossary: { add: addGlossary, map: glossary }, reducedMotion, nextId };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else setTimeout(boot, 0);
})();
