/* Chapter 3 — Data Models and Query Languages: widgets + glossary */
(function () {
  'use strict';
  const { h, s, clear, fmt, fmtMs, pct, rng, clamp, sleep, slider, seg, button, checkbox, stat, log, jsonHTML, widget, glossary, nextId } = window.DDIA;

  // ---------- shared helpers ----------
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const KW = new Set(('SELECT FROM WHERE JOIN ON GROUP BY ORDER LIMIT WITH RECURSIVE UNION AS AND OR NOT CREATE TABLE INDEX PRIMARY KEY REFERENCES ' +
    'MATCH RETURN ALTER ADD COLUMN UPDATE SET DEFAULT NULL PREFIX DESC SUM INSERT INTO VALUES IS ' +
    'const let var function return if else for of new await async query').split(' '));
  function hlLine(line) {
    const re = /(--.*$|\/\/.*$|\/\*.*?\*\/)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|\b(\d+(?:\.\d+)?)\b|([A-Za-z_][A-Za-z_0-9]*)/g;
    let out = '', last = 0, m;
    while ((m = re.exec(line))) {
      out += esc(line.slice(last, m.index));
      if (m[1]) out += `<span class="c">${esc(m[1])}</span>`;
      else if (m[2]) out += `<span class="s">${esc(m[2])}</span>`;
      else if (m[3]) out += `<span class="n">${esc(m[3])}</span>`;
      else out += KW.has(m[4]) ? `<span class="k">${esc(m[4])}</span>` : esc(m[4]);
      last = re.lastIndex;
    }
    return out + esc(line.slice(last));
  }
  /** code block with simple highlighting; opts.mark = array of 0-based line indexes to highlight */
  function code(text, opts = {}) {
    const lines = text.replace(/^\n/, '').replace(/\n$/, '').split('\n');
    const mark = new Set(opts.mark || []);
    return h('pre', { class: 'code', html: lines.map((ln, i) => (mark.has(i) ? `<mark>${hlLine(ln) || ' '}</mark>` : hlLine(ln))).join('\n') });
  }
  /** compact table. o.hit(row,i) -> bool; o.cell(row,i,j) -> class; o.onRow(row,i) click */
  function tbl(cols, rows, o = {}) {
    const t = h('table', { class: 'data c3-mini' + (o.cls ? ' ' + o.cls : '') });
    t.appendChild(h('thead', h('tr', cols.map((c) => h('th', c)))));
    const tb = h('tbody');
    rows.forEach((r, i) => {
      const cls = [o.hit && o.hit(r, i) ? 'hit' : '', o.rowCls ? o.rowCls(r, i) : ''].join(' ').trim();
      const tr = h('tr', cls ? { class: cls } : null);
      if (o.onRow) { tr.style.cursor = 'pointer'; tr.addEventListener('click', () => o.onRow(r, i)); }
      r.forEach((cell, j) => {
        const td = h('td', o.cell ? { class: o.cell(r, i, j) || '' } : null);
        if (cell instanceof Node) td.appendChild(cell); else td.textContent = cell == null ? 'NULL' : String(cell);
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    return h('div', { class: 'table-wrap' }, t);
  }
  const box = (title, ...kids) => h('div', { class: 'box' }, title ? h('h5', title) : null, ...kids);
  const pill = (text, tone) => h('span', { class: 'pill' + (tone ? ' ' + tone : '') }, text);
  const note = (text) => h('p', { class: 'lab-note' }, text);
  function select(label, options, value, onChange) {
    const id = nextId('sel');
    const el = h('select', { id }, options.map(([v, t]) => h('option', { value: v }, t)));
    el.value = value;
    el.addEventListener('change', () => onChange && onChange(el.value));
    return { el: h('div', { class: 'ctl' }, h('label', { for: id }, h('span', label)), el), input: el, get value() { return el.value; } };
  }
  /** horizontal bar comparison (SVG, to scale). items: [{label, value, cls, text}] */
  function bars(items, o = {}) {
    const W = 520, rowH = 30, padL = o.padL || 130, padR = 90, H = items.length * rowH + 10;
    const max = o.max || Math.max(...items.map((i) => i.value), 1e-9);
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': o.label || 'so sánh' });
    items.forEach((it, k) => {
      const y = 6 + k * rowH, w = Math.max(2, ((W - padL - padR) * it.value) / max);
      svg.appendChild(s('text', { x: padL - 8, y: y + 15, 'text-anchor': 'end', class: it.strong ? 'lbl-strong' : '' }, it.label));
      svg.appendChild(s('rect', { x: padL, y: y + 3, width: W - padL - padR, height: 16, rx: 3, class: 'f-surface2' }));
      svg.appendChild(s('rect', { x: padL, y: y + 3, width: w, height: 16, rx: 3, class: it.cls || 'f-accent' }));
      svg.appendChild(s('text', { x: padL + w + 6, y: y + 15, class: 'lbl-strong' }, it.text));
    });
    return h('div', { class: 'viz' }, svg);
  }

  // ---------- shared graph (Figure 3-6) ----------
  const GV = [
    ['namerica', 'Location', { name: 'North America', type: 'continent' }, 110, 40],
    ['usa', 'Location', { name: 'United States', type: 'country' }, 110, 115],
    ['idaho', 'Location', { name: 'Idaho', type: 'state' }, 110, 190],
    ['europe', 'Location', { name: 'Europe', type: 'continent' }, 525, 40],
    ['uk', 'Location', { name: 'United Kingdom', type: 'country' }, 400, 115],
    ['england', 'Location', { name: 'England', type: 'country' }, 400, 190],
    ['london', 'Location', { name: 'London', type: 'city' }, 400, 265],
    ['france', 'Location', { name: 'France', type: 'country' }, 655, 115],
    ['normandy', 'Location', { name: 'Normandy', type: 'région' }, 655, 190],
    ['manche', 'Location', { name: 'Manche', type: 'département' }, 655, 265],
    ['saintlo', 'Location', { name: 'Saint-Lô', type: 'city' }, 655, 340],
    ['lucy', 'Person', { name: 'Lucy', birth_year: 1989 }, 230, 345],
    ['alain', 'Person', { name: 'Alain' }, 505, 370],
  ];
  const GE = [
    ['idaho', 'WITHIN', 'usa'], ['usa', 'WITHIN', 'namerica'],
    ['london', 'WITHIN', 'england'], ['england', 'WITHIN', 'uk'], ['uk', 'WITHIN', 'europe'],
    ['saintlo', 'WITHIN', 'manche'], ['manche', 'WITHIN', 'normandy'], ['normandy', 'WITHIN', 'france'], ['france', 'WITHIN', 'europe'],
    ['lucy', 'BORN_IN', 'idaho'], ['lucy', 'LIVES_IN', 'london'],
    ['alain', 'BORN_IN', 'saintlo'], ['alain', 'LIVES_IN', 'london'],
    ['lucy', 'MARRIED_TO', 'alain'],
  ];
  const V = Object.fromEntries(GV.map(([id, label, props, x, y], i) => [id, { id, num: i + 1, label, props, x, y }]));
  const nodeW = (id) => Math.max(56, V[id].props.name.length * 6.6 + 22);
  const NH = 24;
  const byName = (name) => GV.find((v) => v[2].name === name)[0];

  /** graph SVG. o.onNode(id). returns {el, set({sel, nodes:{id:'hit'|'dim'|'used'}, edges:{i:'hit'|'dim'}})} */
  function graphView(o = {}) {
    const W = 760, H = 395;
    const mkD = nextId('arr'), mkH = nextId('arrh');
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Graph Lucy và Alain (Hình 3-6)' });
    const marker = (id, cls) => s('marker', { id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 8, markerHeight: 8, markerUnits: 'userSpaceOnUse', orient: 'auto' }, s('path', { d: 'M0,0 L10,5 L0,10 z', class: cls }));
    svg.appendChild(s('defs', marker(mkD, 'f-ink3'), marker(mkH, 'f-mark')));
    const clip = (id, dx, dy) => {
      const v = V[id], w = nodeW(id) / 2 + 2, hh = NH / 2 + 2;
      const t = Math.min(dx ? w / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
      return [v.x + dx * t, v.y + dy * t];
    };
    const edgeEls = GE.map(([t, lab, hd], i) => {
      const a = V[t], b = V[hd], dx = b.x - a.x, dy = b.y - a.y;
      const [x1, y1] = clip(t, dx, dy), [x2, y2] = clip(hd, -dx, -dy);
      const line = s('line', { x1, y1, x2, y2, class: 's-ink3 f-none', 'stroke-width': 1.4, 'marker-end': `url(#${mkD})` });
      const vertical = Math.abs(dx) < 10;
      const mx = (x1 + x2) / 2 + (vertical ? 6 : 0), my = (y1 + y2) / 2 + (vertical ? 3 : -4);
      const txt = s('text', { x: mx, y: my, class: 'c3-elabel', 'text-anchor': vertical ? 'start' : 'middle' }, lab);
      const g = s('g', null, line, txt);
      svg.appendChild(g);
      return { g, line, txt };
    });
    const nodeEls = {};
    GV.forEach(([id, label]) => {
      const v = V[id], w = nodeW(id);
      const base = label === 'Person' ? 'f-violet-soft s-violet' : 'f-accent-soft s-accent';
      const rect = s('rect', { x: v.x - w / 2, y: v.y - NH / 2, width: w, height: NH, rx: label === 'Person' ? 12 : 5, class: base, 'stroke-width': 1.3 });
      const txt = s('text', { x: v.x, y: v.y + 4, 'text-anchor': 'middle', class: 'lbl-strong' }, v.props.name);
      const g = s('g', { class: 'node' + (o.onNode ? ' clickable' : ''), tabindex: o.onNode ? 0 : null, role: o.onNode ? 'button' : null, 'aria-label': v.props.name }, rect, txt);
      if (o.onNode) {
        g.addEventListener('click', () => o.onNode(id));
        g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); o.onNode(id); } });
      }
      svg.appendChild(g);
      nodeEls[id] = { g, rect, base };
    });
    function set(st = {}) {
      const nodes = st.nodes || {}, edges = st.edges || {};
      Object.entries(nodeEls).forEach(([id, n]) => {
        const k = st.sel === id ? 'sel' : nodes[id];
        n.rect.setAttribute('class', k === 'sel' ? 'f-mark-soft s-ink' : k === 'hit' ? 'f-mark-soft s-mark' : k === 'used' ? 'f-surface s-accent' : n.base);
        n.rect.setAttribute('stroke-width', k === 'sel' ? 2.6 : k === 'hit' ? 2.4 : 1.3);
        n.g.setAttribute('class', 'node' + (o.onNode ? ' clickable' : '') + (k === 'dim' ? ' c3-node-dim' : ''));
      });
      edgeEls.forEach((e, i) => {
        const k = edges[i];
        e.line.setAttribute('class', (k === 'hit' ? 's-mark' : 's-ink3') + ' f-none');
        e.line.setAttribute('stroke-width', k === 'hit' ? 2.6 : 1.4);
        e.line.setAttribute('marker-end', `url(#${k === 'hit' ? mkH : mkD})`);
        e.g.setAttribute('class', k === 'dim' ? 'c3-node-dim' : '');
      });
    }
    set();
    return { el: h('div', { class: 'viz' }, svg), set };
  }

  // ================= 3.1 declarative =================
  widget('declarative', (root) => {
    const animals = [
      ['Great white shark', 'Sharks'], ['Bottlenose dolphin', 'Dolphins'], ['Hammerhead shark', 'Sharks'], ['Humpback whale', 'Whales'],
      ['Tiger shark', 'Sharks'], ['Orca', 'Dolphins'], ['Blue whale', 'Whales'], ['Whale shark', 'Sharks'],
    ];
    let index = false, par = false, big = false;
    const cbI = checkbox('Thêm index trên cột family', false, (v) => { index = v; render(); });
    const cbP = checkbox('Chạy song song trên 4 CPU', false, (v) => { par = v; render(); });
    const sz = seg({ options: [{ value: 'small', label: '8 hàng' }, { value: 'big', label: '10 triệu hàng' }], value: 'small', onChange: (v) => { big = v === 'big'; render(); } });
    const left = h('div'), right = h('div'), plan = h('div'), stats = h('div', { class: 'stats' }), result = h('div');
    root.append(h('div', { class: 'controls' }, cbI.el, cbP.el, h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Kích thước bảng animals'), sz.el)),
      h('div', { class: 'c3-code-pair' }, left, right), plan, stats, result);
    const IMP = {
      base: `// Code mệnh lệnh: bạn tự viết thuật toán
function getSharks(animals) {
  const sharks = [];
  for (const a of animals) {
    if (a.family === 'Sharks') sharks.push(a);
  }
  return sharks;
}`,
      index: `// Muốn nhanh, bạn tự xây và cập nhật index
const byFamily = new Map();
function insertAnimal(a) {
  animals.push(a);
  if (!byFamily.has(a.family)) byFamily.set(a.family, []);
  byFamily.get(a.family).push(a);   // nhớ sửa cả update/delete!
}
function getSharks() {
  return byFamily.get('Sharks') || [];
}`,
      par: `// Muốn song song, bạn tự chia việc cho worker
async function getSharks(animals) {
  const chunk = Math.ceil(animals.length / 4);
  const parts = await Promise.all([0, 1, 2, 3].map((i) =>
    runInWorker(filterSharks, animals.slice(i * chunk, (i + 1) * chunk))));
  return parts.flat();   // gộp kết quả, giữ thứ tự nếu cần
}`,
      both: `// Index + song song: hai thay đổi chồng lên nhau
const byFamily = new Map();       // phải đồng bộ khi ghi
function insertAnimal(a) { /* ... như trên ... */ }
async function getSharks() {
  const ids = byFamily.get('Sharks') || [];
  const chunk = Math.ceil(ids.length / 4);
  const parts = await Promise.all([0, 1, 2, 3].map((i) =>
    runInWorker(loadRows, ids.slice(i * chunk, (i + 1) * chunk))));
  return parts.flat();
}`,
    };
    const baseLines = IMP.base.split('\n').length;
    function render() {
      const key = index && par ? 'both' : index ? 'index' : par ? 'par' : 'base';
      const imp = IMP[key];
      clear(left).append(h('h5', { class: 'lab-note', style: { margin: '0 0 6px' } }, 'JavaScript (mệnh lệnh)'), code(imp));
      clear(right).append(h('h5', { class: 'lab-note', style: { margin: '0 0 6px' } }, 'SQL (khai báo)'),
        code(`SELECT * FROM animals\nWHERE family = 'Sharks';`),
        index ? h('p', { class: 'lab-note' }, 'Index được tạo một lần bằng ', h('code', 'CREATE INDEX ON animals (family)'), '. Đó là thay đổi schema, không phải thay đổi truy vấn.') : null);
      const N = big ? 1e7 : animals.length, matches = big ? N / 4 : 4;
      const rows = index ? matches : N;
      const nsPerRow = 20, cpus = par ? 4 : 1;
      const ms = (rows * nsPerRow) / 1e6 / cpus + (big ? 0 : 0.01);
      const planText = index && par ? 'Gather (workers: 4)\n  -> Parallel Index Scan using animals_family_idx\n       Index Cond: (family = \'Sharks\')'
        : index ? 'Index Scan using animals_family_idx on animals\n  Index Cond: (family = \'Sharks\')'
          : par ? 'Gather (workers: 4)\n  -> Parallel Seq Scan on animals\n       Filter: (family = \'Sharks\')'
            : 'Seq Scan on animals\n  Filter: (family = \'Sharks\')';
      clear(plan).append(box('Kế hoạch bộ tối ưu chọn (EXPLAIN)', h('pre', { class: 'json' }, planText)));
      const changed = key === 'base' ? 0 : imp.split('\n').length;
      clear(stats).append(
        stat('Dòng SQL phải sửa', '0', 'ok', 'truy vấn giữ nguyên'),
        stat('Dòng JS phải viết lại', key === 'base' ? '0' : String(changed), key === 'base' ? '' : 'bad', key === 'base' ? 'phiên bản gốc ' + baseLines + ' dòng' : 'so với bản gốc ' + baseLines + ' dòng'),
        stat('Hàng phải đọc', fmt(rows), index ? 'ok' : '', index ? 'chỉ hàng khớp' : 'quét toàn bảng'),
        stat('Thời gian ước tính', fmtMs(ms), '', 'số liệu minh hoạ, ~20 ns/hàng'));
      clear(result).append(tbl(['name', 'family'], animals.filter((a) => a[1] === 'Sharks')));
    }
    render();
  });

  // ================= 3.2 model timeline =================
  widget('model-timeline', (root) => {
    const eras = [
      { y: 1968, name: 'Mô hình phân cấp & mạng', ex: 'IMS của IBM, CODASYL', promise: 'Dữ liệu là cây (phân cấp) hoặc mạng con trỏ giữa các bản ghi. Đi theo con trỏ rất nhanh trên phần cứng thời đó.', result: 'Lập trình viên phải tự “đi đường” qua các con trỏ, gắn chặt code với cấu trúc lưu trữ. Thập niên 1970–80, mô hình quan hệ thay thế chúng.', today: 'Ý tưởng duyệt theo liên kết sống lại trong graph database.' },
      { y: 1970, name: 'Mô hình quan hệ (Codd)', ex: 'Bài báo của Edgar Codd, 1970', promise: 'Dữ liệu là các relation (bảng), mỗi relation là tập tuple không thứ tự. Truy vấn khai báo, database tự chọn đường truy cập.', result: 'Ban đầu chỉ là lý thuyết, nhiều người nghi ngờ hiệu năng. Đến giữa thập niên 1980 thì trở thành lựa chọn mặc định.', today: 'Vẫn thống trị phân tích kinh doanh và rất nhiều hệ OLTP sau hơn 50 năm.' },
      { y: 1985, name: 'RDBMS và SQL thống trị', ex: 'Oracle, DB2, sau này PostgreSQL, MySQL', promise: 'Một công cụ cho mọi dữ liệu có cấu trúc đều đặn.', result: 'Thành công lớn. SQL lớn dần và hấp thụ dần tính năng của đối thủ.', today: 'SQL hiện có XML, JSON, và sắp có truy vấn graph (GQL).' },
      { y: 1990, name: 'Object database', ex: 'Cuối 1980 – đầu 1990', promise: 'Lưu thẳng object của ngôn ngữ hướng đối tượng, xoá bỏ impedance mismatch.', result: 'Tạo nhiều tiếng vang rồi lặng đi. Sách viết: “came and went again”.', today: 'Vấn đề mismatch được giải quyết phần nào bằng ORM và document model.' },
      { y: 2003, name: 'XML database', ex: 'Đầu những năm 2000', promise: 'Dữ liệu bán cấu trúc dạng cây, truy vấn bằng XQuery/XPath.', result: 'Chỉ được dùng trong một số ngách.', today: 'Database quan hệ hỗ trợ cột XML với tuỳ chọn kiểm tra schema.' },
      { y: 2010, name: 'NoSQL', ex: 'MongoDB, Couchbase, Cassandra…', promise: 'Mô hình dữ liệu mới, schema linh hoạt, mở rộng dễ, mã nguồn mở. Không phải một công nghệ mà là một tập ý tưởng.', result: 'Di sản bền nhất là mô hình document (JSON). Thuật ngữ “NoSQL” dần ít được dùng khi ý tưởng đã phổ biến.', today: 'Document model có mặt khắp nơi, kể cả trong database quan hệ.' },
      { y: 2013, name: 'NewSQL', ex: 'Các hệ phân tán giữ SQL và transaction', promise: 'Khả năng mở rộng của NoSQL cùng mô hình quan hệ và đảm bảo transaction.', result: 'Ý tưởng được chấp nhận rộng rãi, nhãn “NewSQL” mờ dần.', today: 'Nhiều database cloud-native là quan hệ phân tán (xem Chương 1).' },
      { y: 2020, name: 'Hội tụ', ex: 'JSON trong PostgreSQL; $lookup trong MongoDB; GQL', promise: 'Kết hợp quan hệ và document trong cùng một database.', result: 'Database quan hệ thêm JSON và index trong document; database document thêm join, secondary index, truy vấn khai báo.', today: 'Hybrid quan hệ–document là tổ hợp mạnh. Chọn database ít còn là chọn phe.' },
    ];
    let cur = 1;
    const W = 760, H = 120, x0 = 40, x1 = 720, ymin = 1960, ymax = 2030;
    const X = (y) => x0 + ((y - ymin) / (ymax - ymin)) * (x1 - x0);
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Dòng thời gian mô hình dữ liệu' });
    svg.appendChild(s('line', { x1: x0, y1: 60, x2: x1, y2: 60, class: 'axis' }));
    for (let y = 1960; y <= 2030; y += 10) {
      svg.appendChild(s('line', { x1: X(y), y1: 56, x2: X(y), y2: 64, class: 'axis' }));
      svg.appendChild(s('text', { x: X(y), y: 80, 'text-anchor': 'middle' }, String(y)));
    }
    const dots = eras.map((e, i) => {
      const up = i % 2 === 0;
      const c = s('circle', { cx: X(e.y), cy: 60, r: 7, class: 'f-accent-soft s-accent', 'stroke-width': 1.5 });
      const t = s('text', { x: X(e.y), y: up ? 38 : 104, 'text-anchor': 'middle', class: 'lbl-strong' }, e.y + '');
      const g = s('g', { class: 'c3-era', tabindex: 0, role: 'button', 'aria-label': e.name }, s('line', { x1: X(e.y), y1: up ? 42 : 68, x2: X(e.y), y2: up ? 53 : 92, class: 's-line f-none' }), c, t);
      g.addEventListener('click', () => { cur = i; render(); });
      g.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); cur = i; render(); } });
      svg.appendChild(g);
      return c;
    });
    const detail = h('div');
    const nav = h('div', { class: 'btn-row' }, button('← Mốc trước', () => { cur = Math.max(0, cur - 1); render(); }, 'ghost'), button('Mốc sau →', () => { cur = Math.min(eras.length - 1, cur + 1); render(); }, 'ghost'));
    root.append(h('div', { class: 'viz' }, svg), nav, detail);
    function render() {
      dots.forEach((d, i) => { d.setAttribute('class', i === cur ? 'f-accent s-accent' : 'f-accent-soft s-accent'); d.setAttribute('r', i === cur ? 9 : 7); });
      const e = eras[cur];
      clear(detail).append(h('div', { class: 'c3-flex' }, pill(String(e.y), 'accent'), h('b', e.name), h('span', { class: 'lab-note' }, e.ex)),
        h('div', { class: 'lab-split' }, box('Hứa hẹn', h('p', { style: { margin: 0 } }, e.promise)), box('Kết cục', h('p', { style: { margin: 0 } }, e.result))),
        box('Còn lại đến hôm nay', h('p', { style: { margin: 0 } }, e.today)));
    }
    render();
  });

  // ================= 3.3 N+1 =================
  widget('n-plus-one', (root) => {
    let mode = 'lazy', running = false;
    const n = slider({ label: 'Số bình luận N', min: 1, max: 50, value: 20, onInput: render });
    const rtt = slider({ label: 'Độ trễ mỗi lượt đi về DB', min: 0.5, max: 20, step: 0.5, value: 2, format: (v) => fmt(v, 1) + ' ms', onInput: render });
    const md = seg({ options: [{ value: 'lazy', label: 'Lazy loading (N+1)' }, { value: 'eager', label: 'Eager loading (JOIN)' }], value: mode, onChange: (v) => { mode = v; render(); } });
    const runBtn = button('Chạy truy vấn', run);
    const orm = h('div'), stats = h('div', { class: 'stats' }), chart = h('div'), lg = log(80);
    root.append(h('div', { class: 'controls' }, n.el, rtt.el), h('div', { class: 'btn-row' }, md.el, runBtn), orm, stats, chart, lg);
    const cost = (m) => {
      const N = n.value, r = rtt.value;
      return m === 'lazy' ? { q: N + 1, t: (N + 1) * r + (N + 1) * 0.2 } : { q: 1, t: r + 0.3 + N * 0.02 };
    };
    function render() {
      clear(orm).append(mode === 'lazy'
        ? code(`// ORM, lazy loading\nconst comments = await Comment.findAll({ where: { postId: 42 } });\nfor (const c of comments) {\n  render(c.text, (await c.getAuthor()).name);   // mỗi vòng lặp = 1 truy vấn\n}`)
        : code(`// ORM, eager loading\nconst comments = await Comment.findAll({\n  where: { postId: 42 },\n  include: [{ model: User, as: 'author' }],    // nạp kèm tác giả\n});\n-- SQL sinh ra:\n-- SELECT c.*, u.name FROM comments c JOIN users u ON u.id = c.author_id WHERE c.post_id = 42;`));
      const a = cost('lazy'), b = cost('eager'), cur = cost(mode);
      clear(stats).append(stat('Số truy vấn', String(cur.q), mode === 'lazy' ? 'bad' : 'ok'), stat('Tổng thời gian', fmtMs(cur.t), mode === 'lazy' ? 'warn' : 'ok', 'số liệu minh hoạ'),
        stat('Lazy chậm hơn', fmt(a.t / b.t, 1) + '×', 'accent', 'so với eager'));
      clear(chart).append(bars([
        { label: 'Lazy (N+1)', value: a.t, cls: 'f-bad', text: fmtMs(a.t) + ' · ' + a.q + ' query', strong: mode === 'lazy' },
        { label: 'Eager (JOIN)', value: b.t, cls: 'f-ok', text: fmtMs(b.t) + ' · 1 query', strong: mode === 'eager' },
      ], { label: 'So sánh thời gian' }));
    }
    async function run() {
      if (running) return;
      running = true; runBtn.disabled = true; lg.reset();
      const N = n.value, r = rtt.value;
      let t = 0;
      if (mode === 'lazy') {
        t += r; lg.add(`[${fmt(t, 1)} ms] SELECT * FROM comments WHERE post_id = 42;   -> ${N} hàng`, 'acc');
        for (let i = 0; i < N; i++) {
          await sleep(N > 25 ? 25 : 60);
          t += r + 0.2;
          lg.add(`[${fmt(t, 1)} ms] SELECT name FROM users WHERE id = ${1000 + ((i * 7) % 13)};`, 'warn');
        }
        lg.add(`Xong: ${N + 1} truy vấn, ${fmtMs(t)}`, 'bad');
      } else {
        await sleep(200);
        t = cost('eager').t;
        lg.add(`[${fmt(t, 1)} ms] SELECT c.*, u.name FROM comments c JOIN users u ON u.id = c.author_id WHERE c.post_id = 42;   -> ${N} hàng`, 'acc');
        lg.add(`Xong: 1 truy vấn, ${fmtMs(t)}`, 'ok');
      }
      running = false; runBtn.disabled = false;
    }
    render();
    lg.add('Bấm “Chạy truy vấn” để xem từng lượt truy vấn được gửi đi.', 't');
  });

  // ================= 3.4 résumé =================
  widget('resume-model', (root) => {
    const users = [[251, 'Barack', 'Obama', 'Former President of the United States of America', 'us:91'], [252, 'An', 'Nguyễn', 'Kỹ sư dữ liệu', 'vn:hn']];
    const positions = [[458, 251, 'President', 'United States of America'], [457, 251, 'US Senator (D-IL)', 'United States Senate'], [459, 252, 'Data Engineer', 'Công ty ABC']];
    const education = [[807, 251, 'Harvard University', 1985, 1990], [806, 251, 'Columbia University', 1979, 1983], [808, 252, 'ĐH Bách khoa Hà Nội', 2012, 2017]];
    const contact = [[155, 251, 'website', 'https://barackobama.com'], [156, 251, 'twitter', 'https://twitter.com/barackobama'], [157, 252, 'website', 'https://example.com/an']];
    const doc = {
      user_id: 251, first_name: 'Barack', last_name: 'Obama', headline: 'Former President of the United States of America', region_id: 'us:91',
      positions: [{ job_title: 'President', organization: 'United States of America' }, { job_title: 'US Senator (D-IL)', organization: 'United States Senate' }],
      education: [{ school_name: 'Harvard University', start: 1985, end: 1990 }, { school_name: 'Columbia University', start: 1979, end: 1983 }],
      contact_info: { website: 'https://barackobama.com', twitter: 'https://twitter.com/barackobama' },
    };
    let view = 'rel', loaded = false, relMode = 'multi';
    const v = seg({ options: [{ value: 'rel', label: 'Bảng quan hệ' }, { value: 'doc', label: 'Document JSON' }, { value: 'tree', label: 'Cây' }], value: view, onChange: (x) => { view = x; loaded = false; render(); } });
    const rm = seg({ options: [{ value: 'multi', label: '4 truy vấn riêng' }, { value: 'join', label: '1 JOIN nhiều chiều' }], value: relMode, onChange: (x) => { relMode = x; render(); } });
    const loadBtn = button('Tải hồ sơ user 251', () => { loaded = true; render(); });
    const body = h('div'), stats = h('div', { class: 'stats' }), q = h('div');
    root.append(h('div', { class: 'btn-row' }, v.el, loadBtn), body, q, stats);
    const hit = (r) => loaded && (r[0] === 251 || r[1] === 251);
    function render() {
      clear(body); clear(q); clear(stats);
      if (view === 'rel') {
        body.append(h('div', { class: 'lab-split' },
          box('users', tbl(['user_id', 'first_name', 'last_name', 'headline', 'region_id'], users, { hit: (r) => loaded && r[0] === 251 })),
          box('positions', tbl(['id', 'user_id', 'job_title', 'organization'], positions, { hit }))),
        h('div', { class: 'lab-split' },
          box('education', tbl(['id', 'user_id', 'school_name', 'start', 'end'], education, { hit })),
          box('contact_info', tbl(['id', 'user_id', 'type', 'url'], contact, { hit }))));
        if (loaded) {
          q.append(h('div', { class: 'btn-row' }, rm.el));
          if (relMode === 'multi') {
            q.append(code(`SELECT * FROM users        WHERE user_id = 251;\nSELECT * FROM positions    WHERE user_id = 251;\nSELECT * FROM education    WHERE user_id = 251;\nSELECT * FROM contact_info WHERE user_id = 251;`));
            stats.append(stat('Truy vấn', '4', 'warn'), stat('Lần tra index', '4', 'warn', 'mỗi bảng một lần'), stat('Hàng đọc được', '7', '', '1 + 2 + 2 + 2'));
          } else {
            q.append(code(`SELECT * FROM users u\n  JOIN positions p    ON p.user_id = u.user_id\n  JOIN education e    ON e.user_id = u.user_id\n  JOIN contact_info c ON c.user_id = u.user_id\nWHERE u.user_id = 251;`));
            const rows = [];
            positions.filter((p) => p[1] === 251).forEach((p) => education.filter((e) => e[1] === 251).forEach((e) => contact.filter((c) => c[1] === 251).forEach((c) => rows.push([p[2], e[2], c[2]]))));
            q.append(note('Kết quả: tích Descartes 2 vị trí × 2 trường × 2 liên lạc. Mỗi thông tin bị lặp nhiều lần, ứng dụng phải tự gỡ trùng.'), tbl(['job_title', 'school_name', 'contact'], rows));
            stats.append(stat('Truy vấn', '1', 'ok'), stat('Hàng trả về', String(rows.length), 'bad', 'cho một hồ sơ 7 hàng dữ liệu'), stat('Bảng phải join', '4', 'warn'));
          }
        } else stats.append(stat('Trạng thái', 'chưa tải', '', 'bấm “Tải hồ sơ”'));
      } else if (view === 'doc') {
        body.append(box('Collection users · document _id 251', h('pre', { class: 'json', html: jsonHTML(doc) })));
        if (loaded) {
          q.append(code(`db.users.findOne({ _id: 251 })`));
          stats.append(stat('Truy vấn', '1', 'ok'), stat('Lần tra index', '1', 'ok', 'theo khoá chính'), stat('Đọc từ đĩa', '1 vùng liên tục', 'ok', 'nhờ locality'));
        } else stats.append(stat('Trạng thái', 'chưa tải', '', 'bấm “Tải hồ sơ”'));
      } else {
        const li = (label, kids, tone) => h('li', null, tone ? pill(label, tone) : label, kids && kids.length ? h('ul', kids) : null);
        body.append(box('Cấu trúc cây (Hình 3-2)', h('div', { class: 'c3-tree' }, h('ul',
          li('user 251: Barack Obama', [
            li('region_id: us:91'),
            li('positions', doc.positions.map((p) => li(`${p.job_title} · ${p.organization}`)), 'accent'),
            li('education', doc.education.map((e) => li(`${e.school_name} ${e.start}–${e.end}`)), 'accent'),
            li('contact_info', [li('website: barackobama.com'), li('twitter: @barackobama')], 'accent'),
          ], loaded ? 'violet' : '')))));
        q.append(note('Các quan hệ một-nhiều tạo thành cây có gốc là hồ sơ. Document JSON là cách viết cây này ra một chỗ; bảng quan hệ cắt cây thành nhiều bảng (shredding).'));
        if (loaded) stats.append(stat('Đọc cả cây', '1 lần', 'ok', 'document'), stat('Đọc cả cây', '4 bảng', 'warn', 'quan hệ'));
        else stats.append(stat('Nhánh một-nhiều', '3', 'accent', 'positions, education, contact_info'));
      }
    }
    render();
  });

  // ================= 3.5 normalize =================
  widget('normalize', (root) => {
    const PEOPLE = [['An', 'r1', 'o1'], ['Bình', 'r1', 'o2'], ['Chi', 'r2', 'o1'], ['Dũng', 'r1', 'o1'], ['Giang', 'r3', 'o2'], ['Hà', 'r2', 'o1']];
    let regions, orgs, denorm, crash = false, last = null, flash = new Map();
    function reset() {
      regions = { r1: 'Bombay', r2: 'Hà Nội', r3: 'Washington, DC' };
      orgs = { o1: { name: 'Acme Corp', logo: 'acme-v1.png' }, o2: { name: 'Initech', logo: 'initech-v1.png' } };
      denorm = PEOPLE.map(([n, r, o]) => ({ n, r, o, region: regions[r], org: orgs[o].name, logo: orgs[o].logo }));
      last = null; flash = new Map();
    }
    reset();
    const cb = checkbox('Mô phỏng crash giữa chừng', false, (v) => { crash = v; });
    const left = h('div'), right = h('div'), stats = h('div', { class: 'stats' }), msg = h('div');
    root.append(h('div', { class: 'btn-row' },
      button('Đổi tên vùng: Bombay ↔ Mumbai', () => apply('region')),
      button('Đổi logo Acme Corp', () => apply('logo')),
      button('Đồng bộ lại bản sao', repair, 'ghost'),
      button('Đặt lại', () => { reset(); render(); }, 'ghost'), cb.el),
    msg, h('div', { class: 'lab-split' }, left, right), stats);
    function apply(kind) {
      flash = new Map();
      let targets, write;
      if (kind === 'region') {
        regions.r1 = regions.r1 === 'Bombay' ? 'Mumbai' : 'Bombay';
        targets = denorm.map((d, i) => [d, i]).filter(([d]) => d.r === 'r1');
        write = (d) => { d.region = regions.r1; };
      } else {
        const ver = +orgs.o1.logo.match(/v(\d+)/)[1] + 1;
        orgs.o1.logo = `acme-v${ver}.png`;
        targets = denorm.map((d, i) => [d, i]).filter(([d]) => d.o === 'o1');
        write = (d) => { d.logo = orgs.o1.logo; };
      }
      const done = crash ? Math.ceil(targets.length / 2) : targets.length;
      targets.slice(0, done).forEach(([d, i]) => { write(d); flash.set(i, 'fresh'); });
      last = { kind, total: targets.length, done };
      render();
    }
    function repair() {
      flash = new Map();
      let n = 0;
      denorm.forEach((d, i) => {
        const want = { region: regions[d.r], logo: orgs[d.o].logo };
        if (d.region !== want.region || d.logo !== want.logo) { d.region = want.region; d.logo = want.logo; flash.set(i, 'fresh'); n++; }
      });
      last = { kind: 'repair', total: n, done: n };
      render();
    }
    function render() {
      const incons = denorm.filter((d) => d.region !== regions[d.r] || d.logo !== orgs[d.o].logo).length;
      clear(left).append(h('h5', { class: 'lab-note', style: { margin: '0 0 6px' } }, 'Chuẩn hoá: 3 bảng, mỗi thông tin một chỗ'),
        tbl(['user', 'region_id', 'org_id'], PEOPLE.map(([n, r, o]) => [n, r, o])),
        h('div', { class: 'lab-split', style: { marginTop: '8px' } },
          tbl(['id', 'region_name'], Object.entries(regions), { hit: (r) => last && last.kind === 'region' && r[0] === 'r1' }),
          tbl(['id', 'name', 'logo'], Object.entries(orgs).map(([k, o]) => [k, o.name, o.logo]), { hit: (r) => last && last.kind === 'logo' && r[0] === 'o1' })));
      clear(right).append(h('h5', { class: 'lab-note', style: { margin: '0 0 6px' } }, 'Phi chuẩn hoá: chép chữ vào từng hồ sơ'),
        tbl(['user', 'region', 'org', 'logo'], denorm.map((d) => [d.n, d.region, d.org, d.logo]), {
          cell: (r, i, j) => {
            const d = denorm[i];
            if (j === 1 && d.region !== regions[d.r]) return 'c3-stale';
            if (j === 3 && d.logo !== orgs[d.o].logo) return 'c3-stale';
            if (flash.get(i) === 'fresh' && (j === 1 || j === 3)) return 'c3-fresh';
            return '';
          },
        }));
      clear(msg);
      if (last && last.kind !== 'repair') {
        msg.append(h('div', { class: 'c3-flex' }, pill(`Chuẩn hoá: 1 lượt ghi`, 'ok'), pill(`Phi chuẩn hoá: ${last.done}/${last.total} lượt ghi`, last.done < last.total ? 'bad' : 'warn'),
          last.done < last.total ? h('span', { class: 'lab-note' }, 'Tiến trình crash sau khi ghi được một nửa. Các ô đỏ là bản sao lỗi thời.') : null));
      } else if (last) msg.append(note(`Đã sửa ${last.total} hồ sơ lệch. Quy trình đồng bộ này chính là cái giá của dữ liệu dẫn xuất.`));
      clear(stats).append(
        stat('Đọc 1 hồ sơ (chuẩn hoá)', '2 lookup', 'warn', 'join regions + orgs'),
        stat('Đọc 1 hồ sơ (phi chuẩn hoá)', '0 lookup', 'ok', 'mọi thứ có sẵn'),
        stat('Hồ sơ lệch dữ liệu', String(incons), incons ? 'bad' : 'ok', incons ? 'bản sao chưa cập nhật' : 'nhất quán'));
    }
    render();
  });

  // ================= 3.6 hydrate =================
  widget('hydrate', (root) => {
    let users, posts, snapshot, lookups = 0, reads = 0;
    const timeline = [[104, 'u1'], [103, 'u3'], [102, 'u2'], [101, 'u1']];
    function reset() {
      users = { u1: { username: 'alice', avatar: 'alice-1.jpg' }, u2: { username: 'binh', avatar: 'binh-1.jpg' }, u3: { username: 'chi', avatar: 'chi-1.jpg' } };
      posts = { 101: { text: 'Ra mắt tính năng mới', likes: 12 }, 102: { text: 'Ảnh hoàng hôn ở Đà Nẵng', likes: 40 }, 103: { text: 'Đang đọc DDIA chương 3', likes: 7 }, 104: { text: 'Ai đi cà phê không?', likes: 3 } };
      snapshot = timeline.map(([pid, uid]) => ({ pid, uid, username: users[uid].username, avatar: users[uid].avatar, text: posts[pid].text, likes: posts[pid].likes }));
      reads = 0;
    }
    reset();
    const r = rng(7);
    const left = h('div'), right = h('div'), stats = h('div', { class: 'stats' }), idbox = h('div');
    root.append(h('div', { class: 'btn-row' },
      button('Mô phỏng 1 giây like', () => { for (let i = 0; i < 6; i++) { const ids = Object.keys(posts); posts[ids[Math.floor(r() * ids.length)]].likes += 1 + Math.floor(r() * 4); } render(); }),
      button('Đổi username alice → alice.dev', () => { users.u1.username = users.u1.username === 'alice' ? 'alice.dev' : 'alice'; render(); }),
      button('Đổi ảnh đại diện của chi', () => { const n = +users.u3.avatar.match(/(\d+)/)[1] + 1; users.u3.avatar = `chi-${n}.jpg`; render(); }),
      button('Đặt lại', () => { reset(); render(); }, 'ghost')),
    idbox, h('div', { class: 'lab-split' }, left, right), stats);
    function render() {
      reads++;
      const distinctUsers = new Set(timeline.map((t) => t[1])).size;
      lookups = timeline.length + distinctUsers;
      clear(idbox).append(box('Materialized timeline lưu gì (đã dựng sẵn bằng fan-out)', h('div', { class: 'c3-flex' },
        timeline.map(([p, u]) => h('code', `{post: ${p}, sender: ${u}}`)))));
      const hydrated = timeline.map(([pid, uid]) => [`@${users[uid].username}`, users[uid].avatar, posts[pid].text, posts[pid].likes]);
      clear(left).append(h('h5', { class: 'lab-note', style: { margin: '0 0 6px' } }, `Hydrate lúc đọc (lần đọc #${reads})`),
        tbl(['người đăng', 'ảnh', 'nội dung', 'like'], hydrated, { cell: (row, i, j) => (j === 0 || j === 1 || j === 3 ? 'c3-fresh' : 'c3-wrap') }));
      clear(right).append(h('h5', { class: 'lab-note', style: { margin: '0 0 6px' } }, 'Bản sao phi chuẩn hoá (chụp lúc fan-out)'),
        tbl(['người đăng', 'ảnh', 'nội dung', 'like'], snapshot.map((x) => [`@${x.username}`, x.avatar, x.text, x.likes]), {
          cell: (row, i, j) => {
            const x = snapshot[i];
            if (j === 0 && x.username !== users[x.uid].username) return 'c3-stale';
            if (j === 1 && x.avatar !== users[x.uid].avatar) return 'c3-stale';
            if (j === 3 && x.likes !== posts[x.pid].likes) return 'c3-stale';
            return j === 2 ? 'c3-wrap' : '';
          },
        }));
      const stale = snapshot.reduce((a, x) => a + (x.username !== users[x.uid].username) + (x.avatar !== users[x.uid].avatar) + (x.likes !== posts[x.pid].likes), 0);
      clear(stats).append(
        stat('Lookup mỗi lần đọc', String(lookups), 'accent', `${timeline.length} post + ${distinctUsers} user, chạy song song`),
        stat('Phụ thuộc số follower?', 'Không', 'ok', 'chỉ phụ thuộc độ dài trang'),
        stat('Ô lỗi thời ở bản sao', String(stale), stale ? 'bad' : 'ok', stale ? 'like/tên/ảnh đã cũ' : 'chưa có thay đổi'));
    }
    render();
  });
