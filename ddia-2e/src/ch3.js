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

  // ================= 3.7 many-to-many =================
  widget('many-to-many', (root) => {
    const people = [[251, 'Barack Obama'], [252, 'Joe Biden'], [253, 'Hillary Clinton']];
    const orgs = [[513, 'United States of America'], [514, 'United States Senate'], [515, 'U.S. Department of State']];
    const positions = [
      [251, 513, 'President', 2009, 2017], [251, 514, 'US Senator (D-IL)', 2005, 2008],
      [252, 514, 'US Senator (D-DE)', 1973, 2009], [252, 513, 'Vice President', 2009, 2017], [252, 513, 'President', 2021, 2025],
      [253, 514, 'US Senator (D-NY)', 2001, 2009], [253, 515, 'Secretary of State', 2009, 2013],
    ];
    let sel = { kind: 'person', id: 251 }, orgIdx = true;
    const W = 640, H = 190;
    const py = (i) => 40 + i * 55, ox = 470, px = 170;
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Người và tổ chức' });
    svg.appendChild(s('text', { x: px, y: 16, 'text-anchor': 'middle', class: 'lbl-strong' }, 'users'));
    svg.appendChild(s('text', { x: ox, y: 16, 'text-anchor': 'middle', class: 'lbl-strong' }, 'organizations'));
    const lines = positions.map((p, k) => {
      const a = people.findIndex((x) => x[0] === p[0]), b = orgs.findIndex((x) => x[0] === p[1]);
      const off = (k % 3 - 1) * 3;
      const ln = s('line', { x1: px + 80, y1: py(a) + off, x2: ox - 95, y2: py(b) + off, class: 's-line f-none', 'stroke-width': 1.5 });
      svg.appendChild(ln);
      return ln;
    });
    const mkNode = (x, y, w, label, cls, onClick) => {
      const r = s('rect', { x: x - w / 2, y: y - 13, width: w, height: 26, rx: 6, class: cls, 'stroke-width': 1.3 });
      const g = s('g', { class: 'node clickable', tabindex: 0, role: 'button', 'aria-label': label }, r, s('text', { x, y: y + 4, 'text-anchor': 'middle', class: 'lbl-strong' }, label));
      g.addEventListener('click', onClick);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } });
      svg.appendChild(g);
      return r;
    };
    const pR = people.map((p, i) => mkNode(px, py(i), 160, p[1], 'f-violet-soft s-violet', () => { sel = { kind: 'person', id: p[0] }; render(); }));
    const oR = orgs.map((o, i) => mkNode(ox, py(i), 190, o[1], 'f-accent-soft s-accent', () => { sel = { kind: 'org', id: o[0] }; render(); }));
    const cb = checkbox('Có index trên positions(org_id)', true, (v) => { orgIdx = v; render(); });
    const q = h('div'), stats = h('div', { class: 'stats' }), tb = h('div');
    root.append(h('div', { class: 'viz' }, svg), h('div', { class: 'controls' }, cb.el), q, stats, tb);
    function render() {
      const match = (p) => (sel.kind === 'person' ? p[0] === sel.id : p[1] === sel.id);
      lines.forEach((ln, k) => { const m = match(positions[k]); ln.setAttribute('class', (m ? 's-mark' : 's-line') + ' f-none'); ln.setAttribute('stroke-width', m ? 3 : 1.5); });
      pR.forEach((r, i) => r.setAttribute('class', sel.kind === 'person' && people[i][0] === sel.id ? 'f-mark-soft s-ink' : 'f-violet-soft s-violet'));
      oR.forEach((r, i) => r.setAttribute('class', sel.kind === 'org' && orgs[i][0] === sel.id ? 'f-mark-soft s-ink' : 'f-accent-soft s-accent'));
      const n = positions.filter(match).length;
      clear(q);
      if (sel.kind === 'person') {
        const name = people.find((p) => p[0] === sel.id)[1];
        q.append(note(`Chiều xuôi: ${name} từng làm ở đâu?`), code(`SELECT o.name, p.job_title FROM positions p\n  JOIN organizations o ON o.id = p.org_id\nWHERE p.user_id = ${sel.id};   -- dùng index positions(user_id)`));
        clear(stats).append(stat('Index dùng', 'positions(user_id)', 'ok'), stat('Hàng positions phải đọc', String(n), 'ok', `trên tổng ${positions.length}`), stat('Kết quả', n + ' vị trí', 'accent'));
      } else {
        const name = orgs.find((o) => o[0] === sel.id)[1];
        q.append(note(`Chiều ngược: ai từng làm ở ${name}?`), code(`SELECT u.name, p.job_title FROM positions p\n  JOIN users u ON u.id = p.user_id\nWHERE p.org_id = ${sel.id};   -- ${orgIdx ? 'dùng index positions(org_id)' : 'không có index: Seq Scan'}`));
        clear(stats).append(stat('Index dùng', orgIdx ? 'positions(org_id)' : 'không có', orgIdx ? 'ok' : 'bad'),
          stat('Hàng positions phải đọc', String(orgIdx ? n : positions.length), orgIdx ? 'ok' : 'bad', orgIdx ? `trên tổng ${positions.length}` : 'quét toàn bảng; với hàng triệu hàng sẽ rất chậm'),
          stat('Kết quả', n + ' vị trí', 'accent'));
      }
      clear(tb).append(box('Bảng nối positions (Hình 3-3)', tbl(['user_id', 'org_id', 'job_title', 'start', 'end'], positions, { hit: match })));
    }
    render();
  });

  // ================= 3.8 star schema =================
  widget('star-schema', (root) => {
    const T = {
      fact_sales: { cols: ['date_key', 'product_sk', 'store_sk', 'promotion_sk', 'customer_sk', 'quantity', 'net_price', 'discount_price'], rows: [[140102, 31, 3, null, null, 1, 2.49, 2.49], [140102, 69, 5, 19, null, 3, 14.99, 9.99], [140102, 74, 3, 23, 191, 1, 4.49, 3.89]] },
      dim_product: { cols: ['product_sk', 'sku', 'description', 'brand', 'category'], rows: [[30, 'OK4012', 'Bananas', 'Freshmax', 'Fresh fruit'], [31, 'KA9511', 'Fish food', 'Aquatech', 'Pet supplies'], [69, 'XB2218', 'Croissant', 'Dealicious', 'Bakery']] },
      dim_store: { cols: ['store_sk', 'state', 'city'], rows: [[1, 'WA', 'Seattle'], [3, 'CA', 'San Francisco'], [5, 'CA', 'Palo Alto']] },
      dim_date: { cols: ['date_key', 'year', 'month', 'day', 'weekday', 'is_holiday'], rows: [[140101, 2014, 'jan', 1, 'wed', 'yes'], [140102, 2014, 'jan', 2, 'thu', 'no'], [140103, 2014, 'jan', 3, 'fri', 'no']] },
      dim_customer: { cols: ['customer_sk', 'name', 'date_of_birth'], rows: [[190, 'Alice', '1979-03-29'], [191, 'Bob', '1961-09-02'], [192, 'Cecil', '1991-12-13']] },
      dim_promotion: { cols: ['promotion_sk', 'name', 'ad_type', 'coupon_type'], rows: [[18, 'New Year sale', 'poster', null], [19, 'Aquarium deal', 'direct mail', 'leaflet'], [23, 'Coffee & cake bundle', 'in-store sign', null]] },
      dim_category: { cols: ['category_sk', 'name', 'department'], rows: [[1, 'Fresh fruit', 'Produce'], [2, 'Pet supplies', 'Household'], [3, 'Bakery', 'Fresh food']] },
      dim_brand: { cols: ['brand_sk', 'name', 'manufacturer'], rows: [[7, 'Freshmax', 'Freshmax Ltd'], [8, 'Aquatech', 'Aquatech Inc'], [9, 'Dealicious', 'Dealicious Co']] },
      dim_region: { cols: ['region_sk', 'state', 'country'], rows: [[1, 'WA', 'US'], [2, 'CA', 'US']] },
      obt_sales: { cols: ['date_key', 'date_year', 'date_month', 'date_is_holiday', 'product_sku', 'product_description', 'product_brand', 'product_category', 'store_state', 'store_city', 'customer_name', 'promotion_name', 'quantity', 'net_price', '… (hàng trăm cột)'], rows: [[140102, 2014, 'jan', 'no', 'KA9511', 'Fish food', 'Aquatech', 'Pet supplies', 'CA', 'San Francisco', null, null, 1, 2.49, '…'], [140102, 2014, 'jan', 'no', 'XB2218', 'Croissant', 'Dealicious', 'Bakery', 'CA', 'Palo Alto', null, 'Aquarium deal', 3, 14.99, '…']] },
    };
    if (T.dim_product.cols) T.dim_product_sf = { cols: ['product_sk', 'sku', 'description', 'brand_sk', 'category_sk'], rows: [[30, 'OK4012', 'Bananas', 7, 1], [31, 'KA9511', 'Fish food', 8, 2], [69, 'XB2218', 'Croissant', 9, 3]] };
    T.dim_store_sf = { cols: ['store_sk', 'region_sk', 'city'], rows: [[1, 1, 'Seattle'], [3, 2, 'San Francisco'], [5, 2, 'Palo Alto']] };
    const LAYOUT = {
      star: { fact_sales: [380, 150], dim_date: [130, 50], dim_product: [630, 50], dim_store: [130, 250], dim_customer: [630, 250], dim_promotion: [380, 290] },
      snowflake: { fact_sales: [380, 150], dim_date: [130, 50], dim_product: [600, 60], dim_category: [690, 140], dim_brand: [690, 10], dim_store: [130, 250], dim_region: [130, 310], dim_customer: [630, 250], dim_promotion: [380, 290] },
      obt: { obt_sales: [380, 160] },
    };
    const LINKS = { star: [['fact_sales', 'dim_date'], ['fact_sales', 'dim_product'], ['fact_sales', 'dim_store'], ['fact_sales', 'dim_customer'], ['fact_sales', 'dim_promotion']],
      snowflake: [['fact_sales', 'dim_date'], ['fact_sales', 'dim_product'], ['dim_product', 'dim_category'], ['dim_product', 'dim_brand'], ['fact_sales', 'dim_store'], ['dim_store', 'dim_region'], ['fact_sales', 'dim_customer'], ['fact_sales', 'dim_promotion']], obt: [] };
    const Q = {
      holiday: {
        label: 'Doanh thu theo danh mục vào ngày lễ',
        star: { tables: ['fact_sales', 'dim_product', 'dim_date'], sql: `SELECT p.category, SUM(f.net_price * f.quantity) AS revenue\nFROM fact_sales f\nJOIN dim_product p ON f.product_sk = p.product_sk\nJOIN dim_date d    ON f.date_key   = d.date_key\nWHERE d.is_holiday = 'yes'\nGROUP BY p.category;` },
        snowflake: { tables: ['fact_sales', 'dim_product', 'dim_category', 'dim_date'], sql: `SELECT c.name, SUM(f.net_price * f.quantity) AS revenue\nFROM fact_sales f\nJOIN dim_product p  ON f.product_sk  = p.product_sk\nJOIN dim_category c ON p.category_sk = c.category_sk\nJOIN dim_date d     ON f.date_key    = d.date_key\nWHERE d.is_holiday = 'yes'\nGROUP BY c.name;` },
        obt: { tables: ['obt_sales'], sql: `SELECT product_category, SUM(net_price * quantity) AS revenue\nFROM obt_sales\nWHERE date_is_holiday = 'yes'\nGROUP BY product_category;` },
      },
      state: {
        label: 'Số lượng bán theo bang và tháng',
        star: { tables: ['fact_sales', 'dim_store', 'dim_date'], sql: `SELECT s.state, d.month, SUM(f.quantity)\nFROM fact_sales f\nJOIN dim_store s ON f.store_sk = s.store_sk\nJOIN dim_date d  ON f.date_key = d.date_key\nGROUP BY s.state, d.month;` },
        snowflake: { tables: ['fact_sales', 'dim_store', 'dim_region', 'dim_date'], sql: `SELECT r.state, d.month, SUM(f.quantity)\nFROM fact_sales f\nJOIN dim_store s  ON f.store_sk  = s.store_sk\nJOIN dim_region r ON s.region_sk = r.region_sk\nJOIN dim_date d   ON f.date_key  = d.date_key\nGROUP BY r.state, d.month;` },
        obt: { tables: ['obt_sales'], sql: `SELECT store_state, date_month, SUM(quantity)\nFROM obt_sales\nGROUP BY store_state, date_month;` },
      },
    };
    let layout = 'star', qk = 'holiday', open = 'fact_sales';
    const ls = seg({ options: [{ value: 'star', label: 'Star' }, { value: 'snowflake', label: 'Snowflake' }, { value: 'obt', label: 'One big table' }], value: layout, onChange: (v) => { layout = v; open = v === 'obt' ? 'obt_sales' : 'fact_sales'; render(); } });
    const qs = select('Câu hỏi phân tích', Object.entries(Q).map(([k, v]) => [k, v.label]), qk, (v) => { qk = v; render(); });
    const viz = h('div', { class: 'viz' }), sqlBox = h('div'), stats = h('div', { class: 'stats' }), sample = h('div');
    root.append(h('div', { class: 'controls' }, h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Kiểu schema'), ls.el), qs.el), viz, h('div', { class: 'lab-split' }, sqlBox, h('div', null, stats)), sample);
    const realName = (t) => (layout === 'snowflake' && t === 'dim_product' ? 'dim_product_sf' : layout === 'snowflake' && t === 'dim_store' ? 'dim_store_sf' : t);
    function render() {
      const L = LAYOUT[layout], used = new Set(Q[qk][layout].tables);
      const svg = s('svg', { viewBox: '0 0 760 330', role: 'img', 'aria-label': 'Sơ đồ schema kho dữ liệu' });
      LINKS[layout].forEach(([a, b]) => {
        const on = used.has(a) && used.has(b);
        svg.appendChild(s('line', { x1: L[a][0], y1: L[a][1], x2: L[b][0], y2: L[b][1], class: (on ? 's-mark' : 's-line') + ' f-none', 'stroke-width': on ? 3 : 1.5 }));
      });
      Object.entries(L).forEach(([t, [x, y]]) => {
        const isFact = t === 'fact_sales' || t === 'obt_sales';
        const w = t === 'obt_sales' ? 360 : isFact ? 150 : 130, hh = t === 'obt_sales' ? 170 : isFact ? 70 : 34;
        const cls = used.has(t) ? 'f-mark-soft s-mark' : isFact ? 'f-accent-soft s-accent' : 'f-surface s-line';
        const g = s('g', { class: 'node clickable', tabindex: 0, role: 'button', 'aria-label': t },
          s('rect', { x: x - w / 2, y: y - hh / 2, width: w, height: hh, rx: 6, class: cls, 'stroke-width': open === t ? 2.6 : 1.4 }),
          s('text', { x, y: y - hh / 2 + 17, 'text-anchor': 'middle', class: 'lbl-strong' }, t));
        if (isFact) {
          const cols = T[t].cols.slice(0, t === 'obt_sales' ? 15 : 3);
          cols.forEach((c, i) => {
            const cx = t === 'obt_sales' ? x - 165 + (i % 2) * 175 : x;
            const cy = y - hh / 2 + 34 + (t === 'obt_sales' ? Math.floor(i / 2) * 16 : i * 12);
            g.appendChild(s('text', { x: cx, y: cy, 'text-anchor': t === 'obt_sales' ? 'start' : 'middle' }, c));
          });
          if (t === 'fact_sales') g.appendChild(s('text', { x, y: y + hh / 2 - 6, 'text-anchor': 'middle' }, `+ ${T[t].cols.length - 3} cột`));
        }
        g.addEventListener('click', () => { open = t; render(); });
        g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open = t; render(); } });
        svg.appendChild(g);
      });
      clear(viz).append(svg);
      const q = Q[qk][layout];
      const joins = q.tables.length - 1;
      clear(sqlBox).append(code(q.sql));
      clear(stats).append(
        stat('Số JOIN', String(joins), joins === 0 ? 'ok' : joins > 2 ? 'warn' : 'accent'),
        stat('Bảng dùng', q.tables.length + ' bảng', '', q.tables.join(', ')),
        stat('Độ chuẩn hoá', layout === 'snowflake' ? 'cao' : layout === 'star' ? 'vừa' : 'thấp', '', layout === 'obt' ? 'tốn chỗ nhất, join đã tính sẵn' : layout === 'snowflake' ? 'thêm dimension con' : 'dễ dùng cho analyst'));
      const tn = realName(open);
      const tt = T[tn] || T[open];
      if (!LAYOUT[layout][open]) open = layout === 'obt' ? 'obt_sales' : 'fact_sales';
      clear(sample).append(box(`Hàng mẫu: ${tn}`, tbl(tt.cols, tt.rows)));
    }
    render();
  });

  // ================= 3.9 schema evolution =================
  widget('schema-evolution', (root) => {
    const NAMES = ['Lan Phạm', 'Minh Trần', 'Ngọc Lê', 'Quang Võ', 'Thảo Đỗ', 'Tuấn Hồ'];
    let mode = 'write', rows, docs, running = false, migrated = false, cheap = false;
    function reset() {
      rows = NAMES.map((n, i) => ({ id: i + 1, name: n, first_name: undefined }));
      docs = NAMES.slice(0, 4).map((n, i) => ({ _id: i + 1, name: n }));
      migrated = false;
    }
    reset();
    const md = seg({ options: [{ value: 'write', label: 'Schema-on-write (SQL)' }, { value: 'read', label: 'Schema-on-read (document)' }], value: mode, onChange: (v) => { mode = v; render(); } });
    const size = slider({ label: 'Số hàng thật trong bảng users', min: 3, max: 8, step: 0.5, value: 7, format: (v) => fmt(Math.round(10 ** v)) + ' hàng', onInput: () => render() });
    const body = h('div');
    root.append(h('div', { class: 'btn-row' }, md.el, button('Đặt lại', () => { reset(); render(); }, 'ghost')), body);
    function render() {
      clear(body);
      if (mode === 'write') renderWrite(); else renderRead();
    }
    function renderWrite() {
      const N = Math.round(10 ** size.value);
      const rate = 50000; // rows/s (illustrative)
      const secs = cheap ? 0.05 : N / rate;
      const cbCheap = checkbox('Chỉ ADD COLUMN DEFAULT NULL, điền first_name lúc đọc', cheap, (v) => { cheap = v; render(); });
      const prog = h('div', { class: 'c3-bar' + (cheap ? '' : ' warn') }, h('i'));
      const runBtn = button('Chạy migration', async () => {
        if (running) return; running = true; runBtn.disabled = true;
        for (let i = 0; i < rows.length; i++) {
          if (!cheap) rows[i].first_name = rows[i].name.split(' ')[0];
          else rows[i].first_name = null;
          prog.firstChild.style.width = ((i + 1) / rows.length) * 100 + '%';
          drawTable();
          await sleep(cheap ? 40 : 260);
        }
        migrated = true; running = false; runBtn.disabled = false; render();
      });
      const tableHost = h('div');
      function drawTable() {
        const cols = ['id', 'name'].concat(rows.some((r) => r.first_name !== undefined) ? ['first_name'] : []);
        clear(tableHost).append(tbl(cols, rows.map((r) => (cols.length === 3 ? [r.id, r.name, r.first_name === undefined ? '' : r.first_name] : [r.id, r.name])), {
          cell: (row, i, j) => (j === 2 ? (rows[i].first_name ? 'c3-fresh' : rows[i].first_name === null ? 'c3-dim' : '') : ''),
        }));
      }
      body.append(h('div', { class: 'controls' }, size.el, cbCheap.el),
        code(cheap ? `ALTER TABLE users ADD COLUMN first_name text DEFAULT NULL;   -- nhanh: chỉ đổi metadata\n-- first_name được tính lúc đọc khi còn NULL`
          : `ALTER TABLE users ADD COLUMN first_name text DEFAULT NULL;\nUPDATE users SET first_name = split_part(name, ' ', 1);   -- viết lại MỌI hàng`),
        h('div', { class: 'btn-row' }, runBtn), prog, tableHost,
        h('div', { class: 'stats' },
          stat('Hàng phải viết lại', cheap ? '0' : fmt(N), cheap ? 'ok' : 'warn'),
          stat('Thời gian ước tính', secs < 1 ? fmtMs(secs * 1000) : secs < 3600 ? fmt(secs / 60, 1) + ' phút' : fmt(secs / 3600, 1) + ' giờ', cheap ? 'ok' : secs > 600 ? 'bad' : 'warn', 'số liệu minh hoạ, ~50.000 hàng/s'),
          stat('Rủi ro', cheap ? 'thấp' : N > 1e6 ? 'khoá bảng lâu' : 'vừa phải', cheap ? 'ok' : N > 1e6 ? 'bad' : 'warn', cheap ? 'code đọc phải xử lý NULL' : 'ghi bị chặn trong lúc chạy, có thể downtime')));
      drawTable();
      if (migrated) body.append(note(cheap ? 'Xong ngay. Nhưng giờ code đọc phải tự tách first_name khi giá trị còn NULL, giống cách làm với document.' : 'Xong. Mọi hàng giờ có cùng cấu trúc và database đảm bảo điều đó.'));
    }
    function renderRead() {
      const readCode = `function readUser(user) {\n  if (user && user.name && !user.first_name) {\n    // Documents written before Dec 8, 2023 don't have first_name\n    user.first_name = user.name.split(" ")[0];\n  }\n  return user;\n}`;
      let k = docs.length;
      const add = button('Ghi user mới (định dạng mới)', () => {
        const pool = [['Hoa', 'Bùi'], ['Khánh', 'Đặng'], ['Long', 'Mai'], ['Vy', 'Trịnh']];
        const [f, l] = pool[(docs.length - 4) % pool.length];
        docs.push({ _id: ++k + 0, first_name: f, last_name: l });
        render();
      });
      const view = docs.map((d) => {
        const old = !d.first_name;
        const r = old ? { ...d, first_name: d.name.split(' ')[0] } : d;
        return [d._id, JSON.stringify(d), r.first_name, old ? pill('code đọc tự tách', 'warn') : pill('đã có sẵn', 'ok')];
      });
      body.append(h('div', { class: 'btn-row' }, add),
        h('div', { class: 'lab-split' },
          box('Code đọc (chạy với mỗi document)', code(readCode, { mark: [1, 2, 3] })),
          box('Collection users: định dạng cũ và mới lẫn lộn', tbl(['_id', 'document lưu trên đĩa', 'first_name đọc ra', 'nguồn'], view, { cell: (r, i, j) => (j === 1 ? 'c3-wrap' : '') }))),
        h('div', { class: 'stats' },
          stat('Document định dạng cũ', String(docs.filter((d) => !d.first_name).length), 'warn', 'vẫn nằm đó mãi mãi'),
          stat('Lượt ghi khi đổi schema', '0', 'ok', 'không có migration'),
          stat('Nơi phải biết schema cũ', 'mọi chỗ đọc', 'bad', 'mọi service đọc collection này')));
    }
    render();
  });

  // ================= 3.9 which model =================
  widget('which-model', (root) => {
    const QS = [
      { k: 'tree', q: 'Dữ liệu có dạng cây (một-nhiều) và thường được tải cả cây một lúc?', w: { doc: 3 } },
      { k: 'm2m', q: 'Có nhiều quan hệ nhiều-một hoặc nhiều-nhiều giữa các bản ghi?', w: { rel: 3, graph: 1, doc: -2 } },
      { k: 'deep', q: 'Truy vấn phải đi qua số bước không biết trước (đường đi, phân cấp lồng sâu, bạn của bạn)?', w: { graph: 4, rel: -1 } },
      { k: 'hetero', q: 'Bản ghi không đồng nhất, hoặc cấu trúc do hệ thống bên ngoài quyết định?', w: { doc: 2, graph: 1, rel: -1 } },
      { k: 'nested', q: 'Cần tham chiếu trực tiếp tới phần tử lồng bên trong (một vị trí công việc cụ thể)?', w: { rel: 2, doc: -1 } },
      { k: 'history', q: 'Cần lịch sử đầy đủ mọi thay đổi, ý định rõ ràng và nhiều cách đọc khác nhau?', w: { es: 4 } },
      { k: 'matrix', q: 'Mục đích chính là phân tích thống kê / ML trên ma trận số?', w: { df: 4 } },
    ];
    const MODELS = {
      rel: ['Quan hệ (SQL)', 'Hỗ trợ join, nhiều-một, nhiều-nhiều tốt nhất; schema tường minh; phổ biến nhất trong OLTP và kho dữ liệu.'],
      doc: ['Document (JSON)', 'Cây một-nhiều nằm gọn trong một document, locality tốt, schema linh hoạt cho dữ liệu không đồng nhất.'],
      graph: ['Graph', 'Mọi thứ có thể nối với mọi thứ; truy vấn đệ quy (Cypher WITHIN*0.., SPARQL, Datalog) diễn đạt ngắn gọn.'],
      es: ['Event sourcing + CQRS', 'Log sự kiện bất biến làm nguồn sự thật, dựng nhiều view tối ưu cho đọc, có sẵn audit log.'],
      df: ['Dataframe / mảng', 'Biến dữ liệu thành ma trận số cho đại số tuyến tính, machine learning, thống kê.'],
    };
    const PRESETS = {
      'Hồ sơ LinkedIn': { tree: 'y', m2m: 'n', deep: 'n', hetero: 'n', nested: 'n', history: 'n', matrix: 'n' },
      'Mạng xã hội': { tree: 'n', m2m: 'y', deep: 'y', hetero: 'y', nested: 'n', history: 'n', matrix: 'n' },
      'Đặt chỗ hội nghị': { tree: 'n', m2m: 'y', deep: 'n', hetero: 'n', nested: 'y', history: 'y', matrix: 'n' },
      'Gợi ý phim': { tree: 'n', m2m: 'y', deep: 'n', hetero: 'n', nested: 'n', history: 'n', matrix: 'y' },
    };
    const ans = { ...PRESETS['Hồ sơ LinkedIn'] };
    const segs = {};
    const qa = h('div', { class: 'c3-qa' });
    QS.forEach((q) => {
      segs[q.k] = seg({ options: [{ value: 'y', label: 'Có' }, { value: 'n', label: 'Không' }], value: ans[q.k], onChange: (v) => { ans[q.k] = v; render(); } });
      qa.append(h('span', q.q), segs[q.k].el);
    });
    const out = h('div');
    root.append(h('div', { class: 'btn-row' }, h('span', { class: 'lab-note' }, 'Tình huống mẫu:'),
      Object.keys(PRESETS).map((p) => button(p, () => { Object.assign(ans, PRESETS[p]); QS.forEach((q) => segs[q.k].set(ans[q.k])); render(); }, 'ghost'))), qa, out);
    function render() {
      const score = { rel: 1, doc: 0, graph: 0, es: 0, df: 0 };
      QS.forEach((q) => { if (ans[q.k] === 'y') Object.entries(q.w).forEach(([m, w]) => (score[m] += w)); });
      const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
      const max = Math.max(1, ranked[0][1]);
      const rank = h('div', { class: 'c3-rank' });
      ranked.forEach(([m, v], i) => rank.append(h('b', MODELS[m][0]), h('div', { class: 'c3-bar' + (i === 0 ? '' : ' warn') }, h('i', { style: { width: Math.max(0, (v / max) * 100) + '%' } })), h('span', { class: 'mono' }, String(v))));
      const [top] = ranked[0];
      clear(out).append(rank, box('Gợi ý: ' + MODELS[top][0], h('p', { style: { margin: 0 } }, MODELS[top][1]),
        ranked[1][1] > 0 && ranked[1][1] >= ranked[0][1] - 1 ? note(`Điểm của “${MODELS[ranked[1][0]][0]}” cũng gần bằng. Database hiện đại thường kết hợp được cả hai (hybrid quan hệ–document, truy vấn graph trong SQL).`) : null),
      note('Đây là công cụ gợi nhớ các lập luận trong chương, không phải công thức. Sách nhấn mạnh: không có mô hình tốt nhất, chỉ có mô hình hợp với kiểu quan hệ và kiểu truy vấn của bạn.'));
    }
    render();
  });

  // ================= 3.10 aggregation =================
  widget('aggregation', (root) => {
    const OBS = [
      [1, '2024-01-03', 'Sharks', 'Great white shark', 3], [2, '2024-01-15', 'Dolphins', 'Bottlenose dolphin', 12], [3, '2024-01-20', 'Sharks', 'Hammerhead shark', 2],
      [4, '2024-02-02', 'Sharks', 'Whale shark', 1], [5, '2024-02-11', 'Whales', 'Humpback whale', 2], [6, '2024-02-19', 'Sharks', 'Great white shark', 6],
      [7, '2024-03-05', 'Dolphins', 'Spinner dolphin', 30], [8, '2024-03-09', 'Sharks', 'Tiger shark', 2], [9, '2024-03-28', 'Sharks', 'Hammerhead shark', 8],
    ];
    const SQL = `SELECT date_trunc('month', observation_timestamp) AS observation_month,\n       sum(num_animals) AS total_animals\nFROM observations\nWHERE family = 'Sharks'\nGROUP BY observation_month;`;
    const MQL = `db.observations.aggregate([\n  { $match: { family: "Sharks" } },\n  { $group: {\n      _id: {\n        year:  { $year:  "$observationTimestamp" },\n        month: { $month: "$observationTimestamp" }\n      },\n      totalAnimals: { $sum: "$numAnimals" }\n  } }\n]);`;
    const STAGES = {
      sql: [
        { t: 'FROM observations', mark: [2], d: 'Bắt đầu từ toàn bộ bảng.' },
        { t: "WHERE family = 'Sharks'", mark: [3], d: 'Lọc chỉ giữ các hàng họ cá mập.' },
        { t: 'GROUP BY observation_month', mark: [0, 4], d: 'date_trunc làm tròn timestamp về đầu tháng, các hàng cùng tháng vào một nhóm.' },
        { t: 'SELECT … sum(num_animals)', mark: [0, 1], d: 'Mỗi nhóm thành một hàng kết quả với tổng số con.' },
      ],
      mongo: [
        { t: 'collection observations', mark: [0], d: 'Mỗi quan sát là một document.' },
        { t: '$match', mark: [1], d: 'Stage 1: chỉ cho document có family = "Sharks" đi tiếp.' },
        { t: '$group', mark: [2, 3, 4, 5, 6, 7, 8], d: 'Stage 2: nhóm theo {year, month} của timestamp và cộng numAnimals.' },
      ],
    };
    let lang = 'sql', step = 0;
    const ls = seg({ options: [{ value: 'sql', label: 'SQL (PostgreSQL)' }, { value: 'mongo', label: 'MongoDB pipeline' }], value: lang, onChange: (v) => { lang = v; step = 0; render(); } });
    const codeHost = h('div'), dataHost = h('div'), desc = h('div');
    const next = button('Bước tiếp →', () => { step = Math.min(STAGES[lang].length - 1, step + 1); render(); });
    const all = button('Chạy hết', () => { step = STAGES[lang].length - 1; render(); }, 'ghost');
    const rst = button('Về đầu', () => { step = 0; render(); }, 'ghost');
    root.append(h('div', { class: 'btn-row' }, ls.el, next, all, rst), h('div', { class: 'lab-split' }, codeHost, h('div', null, desc, dataHost)));
    const month = (d) => d.slice(0, 7);
    function render() {
      const st = STAGES[lang][step];
      clear(codeHost).append(code(lang === 'sql' ? SQL : MQL, { mark: st.mark }));
      next.disabled = step === STAGES[lang].length - 1;
      clear(desc).append(h('div', { class: 'c3-flex' }, pill(`Bước ${step + 1}/${STAGES[lang].length}`, 'accent'), h('b', { class: 'mono' }, st.t)), note(st.d));
      clear(dataHost);
      const sharks = OBS.filter((o) => o[2] === 'Sharks');
      const groups = {};
      sharks.forEach((o) => { (groups[month(o[1])] = groups[month(o[1])] || []).push(o); });
      const final = lang === 'sql' ? step === 3 : step === 2;
      if (final) {
        if (lang === 'sql') dataHost.append(tbl(['observation_month', 'total_animals'], Object.entries(groups).map(([m, g]) => [m + '-01 00:00:00', g.reduce((a, o) => a + o[4], 0)]), { hit: () => true }));
        else dataHost.append(h('pre', { class: 'json', html: Object.entries(groups).map(([m, g]) => jsonHTML({ _id: { year: +m.slice(0, 4), month: +m.slice(5) }, totalAnimals: g.reduce((a, o) => a + o[4], 0) }).replace(/\n\s*/g, ' ')).join('\n') }));
        dataHost.append(note('Tháng 1: 5 con, tháng 2: 7 con, tháng 3: 10 con. Hai ngôn ngữ, cùng một kết quả (dữ liệu minh hoạ).'));
      } else if (step === 0) {
        dataHost.append(lang === 'sql' ? tbl(['id', 'observation_timestamp', 'family', 'species', 'num_animals'], OBS, { hit: (r) => r[2] === 'Sharks' })
          : h('pre', { class: 'json', html: OBS.slice(0, 4).map((o) => jsonHTML({ _id: o[0], observationTimestamp: o[1], family: o[2], species: o[3], numAnimals: o[4] }).replace(/\n\s*/g, ' ')).join('\n') + '\n<span class="dim">… ' + (OBS.length - 4) + ' document nữa</span>' }));
      } else if ((lang === 'sql' && step === 1) || (lang === 'mongo' && step === 1)) {
        dataHost.append(tbl(['id', 'timestamp', 'family', 'num_animals'], sharks.map((o) => [o[0], o[1], o[2], o[4]])), note(`${sharks.length}/${OBS.length} hàng còn lại.`));
      } else {
        dataHost.append(tbl(['nhóm (tháng)', 'các hàng', 'num_animals'], Object.entries(groups).map(([m, g]) => [m, g.map((o) => '#' + o[0]).join(', '), g.map((o) => o[4]).join(' + ')])));
      }
    }
    render();
  });

  // ================= 3.11 graph-explorer =================
  widget('graph-explorer', (root) => {
    let sel = 'lucy', rep = 'tables';
    const g = graphView({ onNode: (id) => { sel = id; render(); } });
    const rs = seg({
      options: [
        { value: 'tables', label: 'Bảng vertices & edges' },
        { value: 'adjlist', label: 'Danh sách kề (adjacency list)' },
        { value: 'adjmat', label: 'Ma trận kề (adjacency matrix)' },
      ],
      value: rep,
      onChange: (v) => { rep = v; render(); },
    });
    const info = h('div'), repHost = h('div'), stats = h('div', { class: 'stats' });
    root.append(g.el, h('div', { class: 'btn-row' }, rs.el), info, repHost, stats);

    function render() {
      const outEdges = GE.map((e, i) => [e, i]).filter(([[t]]) => t === sel);
      const inEdges = GE.map((e, i) => [e, i]).filter(([[, , hd]]) => hd === sel);
      const nodes = {}, edges = {};
      outEdges.forEach(([[, , hd], i]) => { nodes[hd] = 'hit'; edges[i] = 'hit'; });
      inEdges.forEach(([[t], i]) => { nodes[t] = 'used'; edges[i] = 'hit'; });
      g.set({ sel, nodes, edges });

      const v = V[sel];
      clear(info).append(
        box(`Đỉnh đang chọn: ${v.props.name} (vertex_id = ${v.num})`,
          h('div', { class: 'c3-flex' },
            pill('label: ' + v.label, v.label === 'Person' ? 'violet' : 'accent'),
            h('code', JSON.stringify(v.props)),
            outEdges.length ? pill(`${outEdges.length} cạnh đi ra`, 'ok') : null,
            inEdges.length ? pill(`${inEdges.length} cạnh đi vào`, 'accent') : null
          ))
      );

      clear(repHost);
      if (rep === 'tables') {
        const vRows = GV.map(([id, label, props]) => [V[id].num, label, JSON.stringify(props)]);
        const eRows = GE.map(([t, lab, hd], i) => [i + 1, `${V[t].num} (${V[t].props.name})`, `${V[hd].num} (${V[hd].props.name})`, lab]);
        repHost.append(
          h('div', { class: 'lab-split' },
            box('Bảng vertices', tbl(['vertex_id', 'label', 'properties'], vRows, {
              hit: (r, i) => GV[i][0] === sel,
              onRow: (r, i) => { sel = GV[i][0]; render(); },
            })),
            box('Bảng edges', tbl(['edge_id', 'tail_vertex', 'head_vertex', 'label'], eRows, {
              hit: (r, i) => GE[i][0] === sel || GE[i][2] === sel,
            }))
          )
        );
      } else if (rep === 'adjlist') {
        const adjRows = GV.map(([id]) => {
          const outs = GE.filter(([t]) => t === id).map(([, lab, hd]) => `-${lab}-> ${V[hd].props.name}`).join(', ') || '—';
          const ins = GE.filter(([, , hd]) => hd === id).map(([t, lab]) => `<-${lab}- ${V[t].props.name}`).join(', ') || '—';
          return [V[id].props.name, outs, ins];
        });
        repHost.append(box('Danh sách kề (mỗi đỉnh lưu các cạnh ra/vào)', tbl(['Đỉnh', 'Cạnh đi ra (tail)', 'Cạnh đi vào (head)'], adjRows, {
          hit: (r, i) => GV[i][0] === sel,
          onRow: (r, i) => { sel = GV[i][0]; render(); },
        })));
      } else {
        const short = (id) => V[id].props.name.slice(0, 6);
        const cols = ['Từ \\ Tới', ...GV.map(([id]) => short(id))];
        const edgeSet = new Map();
        GE.forEach(([t, lab, hd]) => edgeSet.set(t + '>' + hd, lab));
        const matRows = GV.map(([rId]) => [
          V[rId].props.name,
          ...GV.map(([cId]) => edgeSet.has(rId + '>' + cId) ? '1' : '0'),
        ]);
        repHost.append(box('Ma trận kề (1 = có cạnh có hướng từ hàng tới cột)', tbl(cols, matRows, {
          cls: 'c3-matrix',
          hit: (r, i) => GV[i][0] === sel,
          onRow: (r, i) => { sel = GV[i][0]; render(); },
          cell: (r, i, j) => j === 0 ? '' : r[j] === '1' ? 'on' : 'empty',
        })));
      }

      clear(stats).append(
        stat('Tổng số đỉnh', String(GV.length), 'accent'),
        stat('Tổng số cạnh', String(GE.length), 'ok'),
        stat('Cạnh ra / vào của ' + v.props.name, `${outEdges.length} / ${inEdges.length}`, 'warn', 'nhờ index trên cả tail và head')
      );
    }
    render();
  });

  // ================= 3.12 graph-query =================
  widget('graph-query', (root) => {
    const LOCS = ['United States', 'North America', 'Europe', 'United Kingdom', 'France', 'England', 'London', 'Idaho'];
    let bornIn = 'United States', livesIn = 'Europe', strat = 'person', tab = 'cypher', running = false;
    const sBorn = select('Nơi sinh (BORN_IN → WITHIN*0..)', LOCS.map((l) => [l, l]), bornIn, (v) => { bornIn = v; render(); });
    const sLives = select('Nơi ở (LIVES_IN → WITHIN*0..)', LOCS.map((l) => [l, l]), livesIn, (v) => { livesIn = v; render(); });
    const stSeg = seg({
      options: [
        { value: 'person', label: 'Quét từ Person đi ra' },
        { value: 'loc', label: 'Đi ngược từ Location vào' },
      ],
      value: strat,
      onChange: (v) => { strat = v; render(); },
    });
    const tabSeg = seg({
      options: [
        { value: 'cypher', label: 'Cypher (4 dòng)' },
        { value: 'sql', label: 'SQL WITH RECURSIVE (31 dòng)' },
      ],
      value: tab,
      onChange: (v) => { tab = v; render(); },
    });
    const runBtn = button('Chạy truy vấn từng bước', animateRun);
    const g = graphView();
    const codeBox = h('div'), stats = h('div', { class: 'stats' }), lg = log(50);
    root.append(
      h('div', { class: 'controls' }, sBorn.el, sLives.el),
      h('div', { class: 'btn-row' }, stSeg.el, tabSeg.el, runBtn),
      g.el, codeBox, stats, lg
    );

    function withinChain(startId, targetName) {
      const targetId = byName(targetName);
      const nodes = [startId], edges = [];
      let cur = startId;
      while (cur !== targetId) {
        const idx = GE.findIndex(([t, lab]) => t === cur && lab === 'WITHIN');
        if (idx < 0) return null;
        edges.push(idx);
        cur = GE[idx][2];
        nodes.push(cur);
      }
      return { nodes, edges };
    }

    function solve() {
      const people = ['lucy', 'alain'];
      const matches = [];
      const visitedNodes = {}, visitedEdges = {};
      people.forEach((p) => {
        const bIdx = GE.findIndex(([t, lab]) => t === p && lab === 'BORN_IN');
        const lIdx = GE.findIndex(([t, lab]) => t === p && lab === 'LIVES_IN');
        const bChain = bIdx >= 0 ? withinChain(GE[bIdx][2], bornIn) : null;
        const lChain = lIdx >= 0 ? withinChain(GE[lIdx][2], livesIn) : null;
        if (bChain && lChain) {
          matches.push(V[p].props.name);
          visitedNodes[p] = 'hit';
          visitedEdges[bIdx] = 'hit';
          visitedEdges[lIdx] = 'hit';
          bChain.nodes.forEach((n) => { visitedNodes[n] = 'hit'; });
          lChain.nodes.forEach((n) => { visitedNodes[n] = 'hit'; });
          bChain.edges.forEach((e) => { visitedEdges[e] = 'hit'; });
          lChain.edges.forEach((e) => { visitedEdges[e] = 'hit'; });
        } else {
          visitedNodes[p] = 'used';
        }
      });
      return { matches, visitedNodes, visitedEdges };
    }

    async function animateRun() {
      if (running) return;
      running = true; runBtn.disabled = true; lg.reset();
      const nodes = {}, edges = {};
      if (strat === 'person') {
        lg.add('Chiến lược 1: bắt đầu từ mọi đỉnh :Person, đi xuôi theo cạnh BORN_IN / LIVES_IN và WITHIN*0..', 't');
        for (const p of ['lucy', 'alain']) {
          nodes[p] = 'used'; g.set({ nodes: { ...nodes }, edges: { ...edges } });
          lg.add(`Xét ${V[p].props.name}...`, 'acc');
          await sleep(220);
          const bIdx = GE.findIndex(([t, lab]) => t === p && lab === 'BORN_IN');
          const lIdx = GE.findIndex(([t, lab]) => t === p && lab === 'LIVES_IN');
          const bChain = withinChain(GE[bIdx][2], bornIn);
          const lChain = withinChain(GE[lIdx][2], livesIn);
          if (bChain && lChain) {
            nodes[p] = 'hit'; edges[bIdx] = 'hit'; edges[lIdx] = 'hit';
            bChain.nodes.forEach((n) => (nodes[n] = 'hit'));
            lChain.nodes.forEach((n) => (nodes[n] = 'hit'));
            bChain.edges.forEach((e) => (edges[e] = 'hit'));
            lChain.edges.forEach((e) => (edges[e] = 'hit'));
            lg.add(`  ✓ ${V[p].props.name}: BORN_IN → ${bChain.nodes.map((x) => V[x].props.name).join(' → ')}; LIVES_IN → ${lChain.nodes.map((x) => V[x].props.name).join(' → ')}`, 'ok');
          } else {
            lg.add(`  ✗ ${V[p].props.name}: không thoả cả hai điều kiện (${bornIn} / ${livesIn})`, 'warn');
          }
          g.set({ nodes: { ...nodes }, edges: { ...edges } });
          await sleep(260);
        }
      } else {
        const bId = byName(bornIn), lId = byName(livesIn);
        lg.add(`Chiến lược 2: tra index tìm "${bornIn}" và "${livesIn}", rồi đi ngược cạnh WITHIN...`, 't');
        nodes[bId] = 'used'; nodes[lId] = 'used';
        g.set({ nodes: { ...nodes }, edges: { ...edges } });
        await sleep(240);
        const { matches, visitedNodes, visitedEdges } = solve();
        g.set({ nodes: visitedNodes, edges: visitedEdges });
        lg.add(matches.length ? `Kết quả giao hai tập: ${matches.join(', ')}` : 'Không có người nào khớp cả hai nhánh.', matches.length ? 'ok' : 'warn');
      }
      running = false; runBtn.disabled = false;
    }

    function render() {
      const { matches, visitedNodes, visitedEdges } = solve();
      g.set({ nodes: visitedNodes, edges: visitedEdges });
      const cypherText = `MATCH\n  (person) -[:BORN_IN]->  () -[:WITHIN*0..]-> (:Location {name:'${bornIn}'}),\n  (person) -[:LIVES_IN]-> () -[:WITHIN*0..]-> (:Location {name:'${livesIn}'})\nRETURN person.name`;
      const sqlText = `WITH RECURSIVE\n  in_born(vertex_id) AS (\n    SELECT vertex_id FROM vertices WHERE properties->>'name' = '${bornIn}'\n    UNION\n    SELECT edges.tail_vertex FROM edges\n      JOIN in_born ON edges.head_vertex = in_born.vertex_id\n      WHERE edges.label = 'WITHIN'\n  ),\n  in_lives(vertex_id) AS (\n    SELECT vertex_id FROM vertices WHERE properties->>'name' = '${livesIn}'\n    UNION\n    SELECT edges.tail_vertex FROM edges\n      JOIN in_lives ON edges.head_vertex = in_lives.vertex_id\n      WHERE edges.label = 'WITHIN'\n  ),\n  born_people(vertex_id) AS (\n    SELECT edges.tail_vertex FROM edges\n      JOIN in_born ON edges.head_vertex = in_born.vertex_id\n      WHERE edges.label = 'BORN_IN'\n  ),\n  lives_people(vertex_id) AS (\n    SELECT edges.tail_vertex FROM edges\n      JOIN in_lives ON edges.head_vertex = in_lives.vertex_id\n      WHERE edges.label = 'LIVES_IN'\n  )\nSELECT vertices.properties->>'name' AS name\nFROM vertices\nJOIN born_people  ON vertices.vertex_id = born_people.vertex_id\nJOIN lives_people ON vertices.vertex_id = lives_people.vertex_id;`;
      clear(codeBox).append(code(tab === 'cypher' ? cypherText : sqlText));
      clear(stats).append(
        stat('Kết quả person.name', matches.length ? matches.join(', ') : '(trống)', matches.length ? 'ok' : 'warn'),
        stat('Số dòng truy vấn', tab === 'cypher' ? '4 dòng' : '31 dòng', tab === 'cypher' ? 'ok' : 'warn', tab === 'cypher' ? 'Cypher' : 'SQL WITH RECURSIVE'),
        stat('Cạnh khớp trên đường đi', String(Object.keys(visitedEdges).length), 'accent')
      );
      if (!lg.childNodes.length) {
        lg.add(`Kết quả hiện tại: ${matches.length ? matches.join(', ') : 'không có ai'}. Bấm "Chạy truy vấn từng bước" để xem quá trình duyệt.`, 't');
      }
    }
    render();
  });

  // ================= 3.13 triples =================
  widget('triples', (root) => {
    const TRIPLES = [];
    GV.forEach(([id, label, props]) => {
      TRIPLES.push({ s: '_:' + id, p: 'a', o: ':' + label, kind: 'prop', node: id });
      Object.entries(props).forEach(([k, v]) => {
        TRIPLES.push({ s: '_:' + id, p: ':' + k, o: typeof v === 'number' ? String(v) : `"${v}"`, kind: 'prop', node: id });
      });
    });
    GE.forEach(([t, lab, hd], idx) => {
      const pName = ':' + lab.toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      TRIPLES.push({ s: '_:' + t, p: pName, o: '_:' + hd, kind: 'edge', edgeIdx: idx, tail: t, head: hd });
    });

    let fSub = '?s', fPred = '?p', fObj = '?o', selIdx = 0;
    const mkInput = (label, val, onCh) => {
      const id = nextId('tr');
      const inp = h('input', { type: 'text', id, value: val, spellcheck: 'false' });
      inp.addEventListener('input', () => onCh(inp.value.trim()));
      return { el: h('div', { class: 'ctl' }, h('label', { for: id }, h('span', label)), inp), set: (v) => { inp.value = v; } };
    };
    const iS = mkInput('Subject', fSub, (v) => { fSub = v || '?s'; render(); });
    const iP = mkInput('Predicate', fPred, (v) => { fPred = v || '?p'; render(); });
    const iO = mkInput('Object', fObj, (v) => { fObj = v || '?o'; render(); });
    const presets = h('div', { class: 'btn-row' },
      button('Mọi triple của _:lucy', () => { fSub = '_:lucy'; fPred = '?p'; fObj = '?o'; iS.set(fSub); iP.set(fPred); iO.set(fObj); render(); }, 'ghost'),
      button('Các cạnh :within', () => { fSub = '?s'; fPred = ':within'; fObj = '?o'; iS.set(fSub); iP.set(fPred); iO.set(fObj); render(); }, 'ghost'),
      button('Đỉnh loại :Person', () => { fSub = '?person'; fPred = 'a'; fObj = ':Person'; iS.set(fSub); iP.set(fPred); iO.set(fObj); render(); }, 'ghost'),
      button('Hiện tất cả', () => { fSub = '?s'; fPred = '?p'; fObj = '?o'; iS.set(fSub); iP.set(fPred); iO.set(fObj); render(); }, 'ghost')
    );
    const g = graphView();
    const tblHost = h('div'), stats = h('div', { class: 'stats' });
    root.append(h('div', { class: 'controls' }, iS.el, iP.el, iO.el), presets, g.el, stats, tblHost);

    const matchPat = (pat, val) => !pat || pat.startsWith('?') || val.toLowerCase().includes(pat.toLowerCase());
    function render() {
      const matched = TRIPLES.map((t, i) => [t, i]).filter(([t]) => matchPat(fSub, t.s) && matchPat(fPred, t.p) && matchPat(fObj, t.o));
      if (!matched.some(([, i]) => i === selIdx) && matched.length) selIdx = matched[0][1];
      const cur = TRIPLES[selIdx];
      const nodes = {}, edges = {};
      if (cur) {
        if (cur.kind === 'prop') nodes[cur.node] = 'hit';
        else { nodes[cur.tail] = 'hit'; nodes[cur.head] = 'hit'; edges[cur.edgeIdx] = 'hit'; }
      }
      g.set({ nodes, edges });
      clear(stats).append(
        stat('Triple khớp mẫu', `${matched.length} / ${TRIPLES.length}`, 'accent'),
        stat('Triple là thuộc tính', String(matched.filter(([t]) => t.kind === 'prop').length), 'ok', 'object là literal / nhãn'),
        stat('Triple là cạnh graph', String(matched.filter(([t]) => t.kind === 'edge').length), 'warn', 'object là một đỉnh _:id')
      );
      clear(tblHost).append(tbl(['Subject', 'Predicate', 'Object', 'Vai trò'], matched.map(([t]) => [
        t.s, t.p, t.o, t.kind === 'prop' ? pill('Thuộc tính', 'ok') : pill('Cạnh nối 2 đỉnh', 'accent'),
      ]), {
        hit: (r, idx) => matched[idx][1] === selIdx,
        onRow: (r, idx) => { selIdx = matched[idx][1]; render(); },
      }));
    }
    render();
  });

  // ================= 3.14 datalog-steps =================
  widget('datalog-steps', (root) => {
    const BASE_FACTS = [
      'location(1, "North America", "continent")',
      'location(2, "United States", "country")',
      'location(3, "Idaho", "state")',
      'location(4, "Europe", "continent")',
      'location(5, "United Kingdom", "country")',
      'location(6, "England", "country")',
      'location(7, "London", "city")',
      'within(2, 1)', 'within(3, 2)',
      'within(5, 4)', 'within(6, 5)', 'within(7, 6)',
      'person(100, "Lucy")',
      'born_in(100, 3)',
      'lives_in(100, 7)',
    ];
    const STEPS = [
      {
        rule: 0,
        title: 'Rule 1 (cơ sở): mọi địa điểm nằm trong chính nó',
        used: ['location(3, "Idaho", "state")', 'location(2, "United States", "country")', 'location(7, "London", "city")', 'location(6, "England", "country")', 'location(5, "United Kingdom", "country")', 'location(4, "Europe", "continent")'],
        derived: ['within_recursive(3, "Idaho")', 'within_recursive(2, "United States")', 'within_recursive(7, "London")', 'within_recursive(6, "England")', 'within_recursive(5, "United Kingdom")', 'within_recursive(4, "Europe")'],
      },
      {
        rule: 1,
        title: 'Rule 2 (đệ quy vòng 1): đi qua 1 cạnh within(LocID, ViaID)',
        used: ['within(3, 2)', 'within_recursive(2, "United States")', 'within(7, 6)', 'within_recursive(6, "England")', 'within(6, 5)', 'within_recursive(5, "United Kingdom")', 'within(5, 4)', 'within_recursive(4, "Europe")'],
        derived: ['within_recursive(3, "United States")', 'within_recursive(7, "England")', 'within_recursive(6, "United Kingdom")', 'within_recursive(5, "Europe")'],
      },
      {
        rule: 1,
        title: 'Rule 2 (đệ quy vòng 2): nối tiếp chuỗi within_recursive',
        used: ['within(3, 2)', 'within(2, 1)', 'within(7, 6)', 'within_recursive(6, "United Kingdom")', 'within(6, 5)', 'within_recursive(5, "Europe")'],
        derived: ['within_recursive(3, "North America")', 'within_recursive(7, "United Kingdom")', 'within_recursive(6, "Europe")'],
      },
      {
        rule: 1,
        title: 'Rule 2 (đệ quy vòng 3): London nối tới Europe',
        used: ['within(7, 6)', 'within_recursive(6, "Europe")'],
        derived: ['within_recursive(7, "Europe")'],
      },
      {
        rule: 2,
        title: 'Rule 3: kết hợp person + born_in + lives_in + within_recursive',
        used: ['person(100, "Lucy")', 'born_in(100, 3)', 'within_recursive(3, "United States")', 'lives_in(100, 7)', 'within_recursive(7, "Europe")'],
        derived: ['migrated("Lucy", "Idaho", "London")', 'migrated("Lucy", "United States", "Europe")'],
      },
      {
        rule: 3,
        title: 'Rule 4 (điểm bất động): lọc migrated(Person, "United States", "Europe")',
        used: ['migrated("Lucy", "United States", "Europe")'],
        derived: ['us_to_europe("Lucy")'],
      },
    ];
    const RULES = [
      'Rule 1: within_recursive(LocID, PlaceName) :- location(LocID, PlaceName, _).',
      'Rule 2: within_recursive(LocID, PlaceName) :- within(LocID, ViaID), within_recursive(ViaID, PlaceName).',
      'Rule 3: migrated(PName, BornIn, LivingIn) :- person(PID, PName), born_in(PID, B), within_recursive(B, BornIn), lives_in(PID, L), within_recursive(L, LivingIn).',
      'Rule 4: us_to_europe(Person) :- migrated(Person, "United States", "Europe").',
    ];

    let step = 0;
    const bNext = button('Bước tiếp →', () => { step = Math.min(STEPS.length, step + 1); render(); });
    const bAll = button('Chạy tới điểm bất động', () => { step = STEPS.length; render(); }, 'ghost');
    const bReset = button('Đặt lại', () => { step = 0; render(); }, 'ghost');
    const rulesBox = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } });
    const factsBox = h('div');
    const stats = h('div', { class: 'stats' });
    root.append(h('div', { class: 'btn-row' }, bNext, bAll, bReset), rulesBox, stats, factsBox);

    function render() {
      bNext.disabled = step >= STEPS.length;
      const cur = step > 0 ? STEPS[step - 1] : null;
      clear(rulesBox).append(
        ...RULES.map((r, i) => h('div', { class: 'c3-rule' + (cur && cur.rule === i ? ' on' : '') }, r))
      );
      const usedSet = new Set(cur ? cur.used : []);
      const newSet = new Set(cur ? cur.derived : []);
      const allDerived = [];
      for (let i = 0; i < step; i++) allDerived.push(...STEPS[i].derived);

      clear(stats).append(
        stat('Bước suy diễn', `${step} / ${STEPS.length}`, 'accent', cur ? cur.title : 'chưa chạy rule nào'),
        stat('Fact cơ sở (EDB)', String(BASE_FACTS.length), ''),
        stat('Fact suy ra (IDB)', String(allDerived.length), step === STEPS.length ? 'ok' : 'warn', step === STEPS.length ? 'đã đạt điểm bất động (fixpoint)' : 'tăng dần sau mỗi bước')
      );

      clear(factsBox).append(
        h('div', { class: 'lab-split' },
          box('Fact có sẵn trong DB', h('div', { class: 'c3-facts' }, BASE_FACTS.map((f) => h('span', { class: 'c3-fact' + (usedSet.has(f) ? ' used' : '') }, f)))),
          box('Fact suy diễn được từ các Rule', allDerived.length
            ? h('div', { class: 'c3-facts' }, allDerived.map((f) => h('span', { class: 'c3-fact' + (newSet.has(f) ? ' new' : usedSet.has(f) ? ' used' : '') }, f)))
            : note('Bấm "Bước tiếp" để áp dụng Rule 1.'))
        )
      );
    }
    step = 1;
    render();
  });

  // ================= 3.15 graphql =================
  widget('graphql', (root) => {
    const st = {
      channelName: true,
      timestamp: true,
      text: true,
      senderName: true,
      senderAvatar: false,
      replyTo: true,
    };
    const MSGS = [
      { id: 'm1', timestamp: '2024-03-10T09:00:00Z', text: 'Ai trực ca sáng nay?', sender: { fullName: 'Alice Nguyễn', avatarUrl: 'https://cdn.example/alice.png' }, replyTo: null },
      { id: 'm2', timestamp: '2024-03-10T09:01:12Z', text: 'Mình trực tới 12h nhé!', sender: { fullName: 'Bình Trần', avatarUrl: 'https://cdn.example/binh.png' }, replyTo: { text: 'Ai trực ca sáng nay?', sender: { fullName: 'Alice Nguyễn' } } },
      { id: 'm3', timestamp: '2024-03-10T09:02:45Z', text: 'Cảm ơn Bình!', sender: { fullName: 'Alice Nguyễn', avatarUrl: 'https://cdn.example/alice.png' }, replyTo: null },
    ];
    const FULL_BYTES = JSON.stringify({ data: { channels: [{ name: '#backend-oncall', messages: MSGS }] } }).length;

    const fieldsBox = h('div', { class: 'box c3-fields' }, h('h5', 'Chọn trường cần lấy trong GraphQL'));
    const items = [
      ['channelName', 'channels.name (tên kênh)'],
      ['timestamp', 'messages.timestamp'],
      ['text', 'messages.text (nội dung tin nhắn)'],
      ['senderName', 'messages.sender.fullName'],
      ['senderAvatar', 'messages.sender.avatarUrl'],
      ['replyTo', 'messages.replyTo { text, sender { fullName } }'],
    ];
    items.forEach(([k, label]) => {
      const inp = h('input', { type: 'checkbox', checked: st[k] });
      inp.addEventListener('change', () => { st[k] = inp.checked; render(); });
      fieldsBox.appendChild(h('label', null, inp, label));
    });

    const pair = h('div', { class: 'c3-code-pair' }), stats = h('div', { class: 'stats' });
    root.append(fieldsBox, pair, stats);

    function render() {
      const qLines = ['query ChatScreen {', '  channels {'];
      if (st.channelName) qLines.push('    name');
      qLines.push('    messages(limit: 50) {');
      if (st.timestamp) qLines.push('      timestamp');
      if (st.text) qLines.push('      text');
      if (st.senderName || st.senderAvatar) {
        qLines.push('      sender {');
        if (st.senderName) qLines.push('        fullName');
        if (st.senderAvatar) qLines.push('        avatarUrl');
        qLines.push('      }');
      }
      if (st.replyTo) {
        qLines.push('      replyTo {');
        qLines.push('        text');
        qLines.push('        sender { fullName }');
        qLines.push('      }');
      }
      qLines.push('    }', '  }', '}');

      const resp = {
        data: {
          channels: [
            {
              ...(st.channelName ? { name: '#backend-oncall' } : {}),
              messages: MSGS.map((m) => {
                const o = {};
                if (st.timestamp) o.timestamp = m.timestamp;
                if (st.text) o.text = m.text;
                if (st.senderName || st.senderAvatar) {
                  o.sender = {};
                  if (st.senderName) o.sender.fullName = m.sender.fullName;
                  if (st.senderAvatar) o.sender.avatarUrl = m.sender.avatarUrl;
                }
                if (st.replyTo) o.replyTo = m.replyTo;
                return o;
              }),
            },
          ],
        },
      };
      const bytes = JSON.stringify(resp).length;
      clear(pair).append(
        box('Truy vấn GraphQL từ client', code(qLines.join('\n'))),
        box('Response JSON trả về', h('pre', { class: 'json', html: jsonHTML(resp) }))
      );
      clear(stats).append(
        stat('Số lượt gọi mạng (round-trip)', '1 request', 'ok', 'lấy đủ dữ liệu cho cả màn hình'),
        stat('Kích thước JSON trả về', fmt(bytes) + ' B', 'accent', `so với ${FULL_BYTES} B khi lấy mọi trường`),
        stat('Dữ liệu sender lặp lại', st.senderName ? '2 lần cho Alice' : '0', st.senderName ? 'warn' : 'ok', 'GraphQL chấp nhận lặp để UI dễ render')
      );
    }
    render();
  });

  // ================= 3.16 event-sourcing =================
  widget('event-sourcing', (root) => {
    let events, cursor, wrongOrder = false, nextIdSeq = 1;
    const lg = log(40);
    function initEvents() {
      nextIdSeq = 1;
      events = [
        { id: nextIdSeq++, type: 'RoomChanged', room: 'Hội trường A', cap: 5, del: false },
        { id: nextIdSeq++, type: 'SeatsBooked', user: 'Alice', qty: 2, paid: 200, del: false },
        { id: nextIdSeq++, type: 'SeatsBooked', user: 'Công ty X', qty: 2, paid: 200, del: false },
        { id: nextIdSeq++, type: 'BookingCancelled', user: 'Alice', refund: 200, del: false },
      ];
      cursor = events.length;
    }
    initEvents();

    function project(list) {
      let room = 'Chưa chọn', cap = 0, revenue = 0;
      const bookings = new Map();
      const seq = wrongOrder ? [...list].reverse() : list;
      seq.forEach((ev) => {
        if (ev.del) return;
        if (ev.type === 'RoomChanged') { room = ev.room; cap = ev.cap; }
        else if (ev.type === 'SeatsBooked') {
          const prev = bookings.get(ev.user) || { qty: 0, status: 'active' };
          bookings.set(ev.user, { qty: prev.qty + ev.qty, status: 'active' });
          revenue += ev.paid;
        } else if (ev.type === 'BookingCancelled') {
          if (bookings.has(ev.user)) bookings.set(ev.user, { qty: 0, status: 'cancelled' });
          else bookings.set(ev.user, { qty: 0, status: 'cancelled-before-book (lỗi thứ tự!)' });
          revenue -= ev.refund;
        }
      });
      let used = 0;
      bookings.forEach((v) => { if (v.status === 'active') used += v.qty; });
      const badges = [];
      bookings.forEach((v, u) => { for (let i = 0; i < v.qty; i++) badges.push(`${u} #${i + 1}`); });
      return { room, cap, used, left: cap - used, revenue, bookings, badges };
    }

    function sendCommand(cmd) {
      const state = project(events.slice(0, cursor));
      if (cmd.kind === 'book') {
        if (state.left < cmd.qty) {
          lg.add(`Command bị từ chối: ${cmd.user} muốn đặt ${cmd.qty} chỗ nhưng chỉ còn ${state.left} chỗ trống!`, 'bad');
          return;
        }
        events = events.slice(0, cursor);
        events.push({ id: nextIdSeq++, type: 'SeatsBooked', user: cmd.user, qty: cmd.qty, paid: cmd.qty * 100, del: false });
        cursor = events.length;
        lg.add(`Command hợp lệ → nối sự kiện SeatsBooked(${cmd.user}, ${cmd.qty} chỗ) vào cuối log.`, 'ok');
      } else if (cmd.kind === 'cancel') {
        const b = state.bookings.get(cmd.user);
        if (!b || b.qty <= 0) {
          lg.add(`Command bị từ chối: ${cmd.user} không có chỗ đang giữ để huỷ.`, 'warn');
          return;
        }
        events = events.slice(0, cursor);
        events.push({ id: nextIdSeq++, type: 'BookingCancelled', user: cmd.user, refund: b.qty * 100, del: false });
        cursor = events.length;
        lg.add(`Command hợp lệ → nối sự kiện BookingCancelled(${cmd.user}) vào cuối log.`, 'acc');
      } else if (cmd.kind === 'room') {
        events = events.slice(0, cursor);
        events.push({ id: nextIdSeq++, type: 'RoomChanged', room: cmd.room, cap: cmd.cap, del: false });
        cursor = events.length;
        lg.add(`Command hợp lệ → nối sự kiện RoomChanged(${cmd.room}, sức chứa ${cmd.cap}).`, 'ok');
      }
      render();
    }

    const slTime = slider({ label: 'Tua lịch sử (số sự kiện đã áp dụng)', min: 1, max: 10, value: cursor, onInput: (v) => { cursor = clamp(v, 1, events.length); render(); } });
    const cbWrong = checkbox('Giả lập xử lý sai thứ tự sự kiện (đảo ngược log)', false, (v) => { wrongOrder = v; render(); });
    const logHost = h('div', { class: 'c3-events' });
    const viewsHost = h('div', { class: 'lab-split' });
    const stats = h('div', { class: 'stats' });

    root.append(
      h('div', { class: 'btn-row' },
        button('Command: Bob đặt 2 chỗ', () => sendCommand({ kind: 'book', user: 'Bob', qty: 2 })),
        button('Command: Carol đặt 3 chỗ', () => sendCommand({ kind: 'book', user: 'Carol', qty: 3 }), 'ghost'),
        button('Command: Huỷ chỗ của Bob', () => sendCommand({ kind: 'cancel', user: 'Bob' }), 'ghost'),
        button('Command: Đổi sang Phòng lớn (8 chỗ)', () => sendCommand({ kind: 'room', room: 'Hội trường Lớn', cap: 8 }), 'ghost'),
        button('Đặt lại', () => { initEvents(); wrongOrder = false; cbWrong.input.checked = false; lg.reset(); render(); }, 'ghost')
      ),
      h('div', { class: 'controls' }, slTime.el, cbWrong.el),
      box('Event log bất biến (chỉ nối thêm; bấm "Xoá nhầm" để thử xoá sự kiện ghi nhầm và dựng lại view)', logHost),
      viewsHost, stats, lg
    );

    function render() {
      slTime.input.max = events.length;
      slTime.set(cursor);
      clear(logHost);
      events.forEach((ev, idx) => {
        const isFuture = idx >= cursor;
        const txt = ev.type === 'RoomChanged' ? `#${ev.id} RoomChanged { room: "${ev.room}", cap: ${ev.cap} }`
          : ev.type === 'SeatsBooked' ? `#${ev.id} SeatsBooked { user: "${ev.user}", qty: ${ev.qty}, paid: $${ev.paid} }`
            : `#${ev.id} BookingCancelled { user: "${ev.user}", refund: $${ev.refund} }`;
        const btn = button(ev.del ? 'Khôi phục' : 'Xoá nhầm', () => {
          ev.del = !ev.del;
          lg.add(`${ev.del ? 'Đã gạch bỏ' : 'Đã khôi phục'} sự kiện #${ev.id} và dựng lại cả 3 materialized view từ đầu log.`, 'warn');
          render();
        }, 'ghost');
        logHost.appendChild(h('div', { class: 'c3-eventrow' + (isFuture ? ' future' : '') + (ev.del ? ' del' : '') },
          pill('#' + ev.id, isFuture ? '' : 'accent'),
          h('span', { class: 'mono' }, txt),
          btn
        ));
      });

      const st = project(events.slice(0, cursor));
      const bRows = [...st.bookings.entries()].map(([u, b]) => [u, String(b.qty), b.status]);
      clear(viewsHost).append(
        box('View 1: Trạng thái đặt chỗ (Read Model)', tbl(['Người đặt', 'Số ghế', 'Trạng thái'], bRows)),
        box('View 2: Danh sách in thẻ đeo (Badges)', st.badges.length
          ? h('div', { class: 'c3-facts' }, st.badges.map((b) => pill(b, 'ok')))
          : note('Chưa có thẻ đeo nào cần in.'))
      );

      clear(stats).append(
        stat('Phòng & sức chứa', `${st.room} (${st.cap})`, 'accent'),
        stat('Chỗ đã đặt / còn trống', `${st.used} / ${st.left}`, st.left < 0 ? 'bad' : 'ok', st.left < 0 ? 'vượt sức chứa' : 'View 3: Dashboard'),
        stat('Doanh thu ròng', '$' + fmt(st.revenue), wrongOrder ? 'bad' : 'ok', wrongOrder ? 'sai thứ tự làm lệch trạng thái!' : 'tính từ đầu log')
      );
    }
    lg.add('Thử bấm "Bob đặt 2 chỗ" rồi "Carol đặt 3 chỗ" để thấy command vượt sức chứa bị từ chối trước khi vào log.', 't');
    render();
  });

  // ================= 3.17 pivot =================
  widget('pivot', (root) => {
    const USERS = ['Alice', 'Bob', 'Carol', 'Dũng'];
    const MOVIES = [
      { title: 'Inception', genre: 'Sci-Fi' },
      { title: 'Toy Story', genre: 'Animation' },
      { title: 'Parasite', genre: 'Thriller' },
      { title: 'Interstellar', genre: 'Sci-Fi' },
    ];
    const RATINGS = [
      [0, 0, 5], [0, 1, 3], [0, 3, 4],
      [1, 0, 4], [1, 2, 5],
      [2, 1, 5], [2, 2, 4], [2, 3, 2],
      [3, 0, 2], [3, 3, 5],
    ];
    let selIdx = 0, showOneHot = false;
    const cbOneHot = checkbox('Hiển thị thêm ma trận One-Hot Encoding cho cột thể loại (genre)', false, (v) => { showOneHot = v; render(); });
    const bNext = button('Hàng tiếp theo →', () => { selIdx = (selIdx + 1) % RATINGS.length; render(); });
    const split = h('div', { class: 'lab-split' }), oneHotHost = h('div'), stats = h('div', { class: 'stats' });
    root.append(h('div', { class: 'btn-row' }, bNext, cbOneHot.el), split, oneHotHost, stats);

    function render() {
      const [selU, selM] = RATINGS[selIdx];
      const relRows = RATINGS.map(([u, m, r]) => [USERS[u], MOVIES[m].title, MOVIES[m].genre, r + ' ★']);
      const matCols = ['User \\ Movie', ...MOVIES.map((m) => m.title)];
      const rMap = new Map(RATINGS.map(([u, m, r]) => [`${u}:${m}`, r]));
      const matRows = USERS.map((uName, u) => [
        uName,
        ...MOVIES.map((_, m) => (rMap.has(`${u}:${m}`) ? String(rMap.get(`${u}:${m}`)) : '·')),
      ]);

      clear(split).append(
        box('Bảng quan hệ ratings (bấm vào một hàng)', tbl(['user', 'movie', 'genre', 'rating'], relRows, {
          hit: (r, i) => i === selIdx,
          onRow: (r, i) => { selIdx = i; render(); },
        })),
        box('Ma trận người dùng × phim (Pivot / Sparse Matrix)', tbl(matCols, matRows, {
          cls: 'c3-matrix',
          cell: (r, i, j) => {
            if (j === 0) return '';
            if (i === selU && j - 1 === selM) return 'pop';
            return r[j] === '·' ? 'empty' : 'on';
          },
        }))
      );

      clear(oneHotHost);
      if (showOneHot) {
        const genres = ['Sci-Fi', 'Animation', 'Thriller'];
        const ohRows = MOVIES.map((m) => [
          m.title, m.genre,
          ...genres.map((g) => (m.genre === g ? '1' : '0')),
        ]);
        oneHotHost.append(box('One-Hot Encoding: biến cột phân loại (genre) thành các cột nhị phân 0/1 cho ML', tbl(['Phim', 'Thể loại gốc', ...genres.map((g) => 'is_' + g)], ohRows, {
          cls: 'c3-matrix',
          cell: (r, i, j) => (j < 2 ? '' : r[j] === '1' ? 'on' : 'empty'),
        })));
      }

      const totalCells = USERS.length * MOVIES.length;
      const filled = RATINGS.length;
      clear(stats).append(
        stat('Ô đang chiếu', `${USERS[selU]} → ${MOVIES[selM].title}`, 'accent', `hàng #${selIdx + 1} rơi vào (${selU + 1}, ${selM + 1})`),
        stat('Ô có dữ liệu', `${filled} / ${totalCells}`, 'ok', pct(filled / totalCells, 1) + ' lắp đầy'),
        stat('Độ thưa (sparsity)', pct(1 - filled / totalCells, 1), 'warn', 'hệ thật thường > 99% trống')
      );
    }
    render();
  });

  // ================= Glossary =================
  glossary.add([
    { key: 'declarative', term: 'Declarative query language', vi: 'ngôn ngữ truy vấn khai báo', ch: 3, topic: 'ch3-intro', def: 'Ngôn ngữ chỉ mô tả điều kiện kết quả cần thoả (như SQL, Cypher), để bộ tối ưu của database tự quyết định cách thực thi.' },
    { key: 'query-optimizer', term: 'Query optimizer', vi: 'bộ tối ưu truy vấn', ch: 3, topic: 'ch3-intro', def: 'Thành phần của database quyết định dùng index nào, thuật toán join nào và chạy song song ra sao cho một truy vấn khai báo.' },
    { key: 'relational-model', term: 'Relational model', vi: 'mô hình quan hệ', ch: 3, topic: 'ch3-history', def: 'Mô hình do Edgar Codd đề xuất năm 1970: dữ liệu tổ chức thành các relation (bảng), mỗi bảng là tập không thứ tự của các tuple (hàng).' },
    { key: 'nosql', term: 'NoSQL', vi: 'NoSQL', ch: 3, topic: 'ch3-history', def: 'Phong trào các hệ cơ sở dữ liệu phi quan hệ hướng tới schema linh hoạt, mở rộng ngang và mô hình dữ liệu mới (document, graph, key-value, cột rộng).' },
    { key: 'newsql', term: 'NewSQL', vi: 'NewSQL', ch: 3, topic: 'ch3-history', def: 'Các hệ cơ sở dữ liệu kết hợp khả năng mở rộng phân tán của NoSQL với mô hình quan hệ SQL và đảm bảo ACID transaction.' },
    { key: 'document-model', term: 'Document model', vi: 'mô hình tài liệu (document)', ch: 3, topic: 'ch3-history', def: 'Mô hình lưu dữ liệu thành các document JSON/BSON tự chứa, phù hợp với cấu trúc cây quan hệ một-nhiều.' },
    { key: 'impedance-mismatch', term: 'Impedance mismatch', vi: 'độ vênh mô hình object–quan hệ', ch: 3, topic: 'ch3-orm', def: 'Sự bất tương thích giữa cấu trúc object trên bộ nhớ của ngôn ngữ hướng đối tượng và các bảng/hàng/cột trong database quan hệ.' },
    { key: 'orm', term: 'Object-Relational Mapping (ORM)', vi: 'ánh xạ đối tượng – quan hệ', ch: 3, topic: 'ch3-orm', def: 'Framework tự động chuyển đổi giữa object trong code và bản ghi trong bảng quan hệ (như Hibernate, ActiveRecord, Prisma).' },
    { key: 'n-plus-one', term: 'N+1 query problem', vi: 'bài toán truy vấn N+1', ch: 3, topic: 'ch3-orm', def: 'Lỗi hiệu năng khi code chạy 1 truy vấn lấy N bản ghi cha rồi lặp N lần gửi thêm N truy vấn nhỏ để lấy dữ liệu liên quan thay vì dùng 1 phép JOIN.' },
    { key: 'one-to-many', term: 'One-to-many relationship', vi: 'quan hệ một-nhiều', ch: 3, topic: 'ch3-one-to-many', def: 'Quan hệ trong đó một bản ghi cha gắn với nhiều bản ghi con (ví dụ một người có nhiều vị trí công việc trong hồ sơ).' },
    { key: 'locality', term: 'Storage locality', vi: 'tính cục bộ lưu trữ', ch: 3, topic: 'ch3-one-to-many', def: 'Lưu các thông tin thường được đọc cùng nhau tại một vùng liên tục trên đĩa để giảm số lần tra cứu và seek.' },
    { key: 'one-to-few', term: 'One-to-few relationship', vi: 'quan hệ một-vài', ch: 3, topic: 'ch3-one-to-many', def: 'Trường hợp quan hệ một-nhiều nhưng số phần tử con luôn nhỏ (như vài bằng cấp của một người), rất hợp để nhúng vào một document.' },
    { key: 'normalization', term: 'Normalization', vi: 'chuẩn hoá dữ liệu', ch: 3, topic: 'ch3-normalization', def: 'Tổ chức dữ liệu sao cho mỗi thông tin có nghĩa chỉ lưu ở một nơi duy nhất và được tham chiếu qua ID để tránh dư thừa và bất nhất.' },
    { key: 'denormalization', term: 'Denormalization', vi: 'phi chuẩn hoá', ch: 3, topic: 'ch3-normalization', def: 'Chủ động nhân bản hoặc chép sẵn dữ liệu liên quan vào nhiều nơi để tăng tốc độ đọc và tránh join, đổi lại việc ghi và giữ đồng bộ phức tạp hơn.' },
    { key: 'join', term: 'Join', vi: 'phép kết nối (join)', ch: 3, topic: 'ch3-normalization', def: 'Thao tác ghép các bản ghi từ hai hay nhiều bảng dựa trên điều kiện khớp (thường là khoá ngoại bằng khoá chính) tại thời điểm truy vấn.' },
    { key: 'derived-data', term: 'Derived data', vi: 'dữ liệu dẫn xuất', ch: 3, topic: 'ch3-normalization', def: 'Dữ liệu được tính toán hoặc nhân bản từ một nguồn dữ liệu gốc (system of record); nếu mất có thể dựng lại từ nguồn.' },
    { key: 'hydrating', term: 'Hydrating', vi: 'hydrate (bơm đầy dữ liệu từ ID)', ch: 3, topic: 'ch3-hydration', def: 'Chỉ lưu danh sách ID trong cache/timeline rồi tra cứu thông tin chi tiết (nội dung, số like, tên người dùng) tại thời điểm đọc.' },
    { key: 'many-to-one', term: 'Many-to-one relationship', vi: 'quan hệ nhiều-một', ch: 3, topic: 'ch3-relationships', def: 'Nhiều bản ghi cùng tham chiếu tới một thực thể chung (ví dụ nhiều người cùng sống ở một vùng địa lý region_id).' },
    { key: 'many-to-many', term: 'Many-to-many relationship', vi: 'quan hệ nhiều-nhiều', ch: 3, topic: 'ch3-relationships', def: 'Một thực thể bên A liên kết với nhiều thực thể bên B và ngược lại (như người làm việc tại nhiều tổ chức, tổ chức có nhiều nhân viên).' },
    { key: 'join-table', term: 'Join table (associative table)', vi: 'bảng nối', ch: 3, topic: 'ch3-relationships', def: 'Bảng trung gian chứa các khoá ngoại trỏ tới hai hay nhiều bảng để biểu diễn quan hệ nhiều-nhiều trong mô hình quan hệ.' },
    { key: 'secondary-index', term: 'Secondary index', vi: 'chỉ mục phụ', ch: 3, topic: 'ch3-relationships', def: 'Chỉ mục tạo thêm trên các cột hoặc trường không phải khoá chính để tra cứu nhanh theo nhiều chiều.' },
    { key: 'fact-table', term: 'Fact table', vi: 'bảng sự kiện (fact)', ch: 3, topic: 'ch3-star', def: 'Bảng trung tâm trong kho dữ liệu ghi lại từng sự kiện phát sinh (như mỗi giao dịch mua hàng), chứa các số đo và khoá ngoại tới bảng dimension.' },
    { key: 'dimension-table', term: 'Dimension table', vi: 'bảng chiều (dimension)', ch: 3, topic: 'ch3-star', def: 'Bảng vệ tinh trong kho dữ liệu mô tả ngữ cảnh của sự kiện: ai, sản phẩm gì, ở đâu, ngày nào, khuyến mãi gì.' },
    { key: 'star-schema', term: 'Star schema', vi: 'lược đồ hình sao', ch: 3, topic: 'ch3-star', def: 'Mô hình kho dữ liệu gồm một bảng fact ở tâm nối trực tiếp với các bảng dimension một cấp xung quanh.' },
    { key: 'snowflake-schema', term: 'Snowflake schema', vi: 'lược đồ bông tuyết', ch: 3, topic: 'ch3-star', def: 'Biến thể chuẩn hoá hơn của star schema, trong đó các bảng dimension tiếp tục được tách thành các bảng dimension con.' },
    { key: 'obt', term: 'One Big Table (OBT)', vi: 'một bảng lớn duy nhất', ch: 3, topic: 'ch3-star', def: 'Cách phi chuẩn hoá hoàn toàn kho dữ liệu bằng cách gộp mọi cột của các bảng dimension thẳng vào bảng fact để không phải join khi đọc.' },
    { key: 'shredding', term: 'Shredding', vi: 'xé nhỏ document thành nhiều bảng', ch: 3, topic: 'ch3-schema', def: 'Kỹ thuật tách một cấu trúc dữ liệu dạng cây (JSON/XML) thành nhiều bảng quan hệ con, thường làm schema và code phức tạp.' },
    { key: 'schema-on-read', term: 'Schema-on-read', vi: 'schema khi đọc', ch: 3, topic: 'ch3-schema', def: 'Cấu trúc dữ liệu không bị database ép buộc lúc ghi mà chỉ được code ứng dụng ngầm định và diễn giải khi đọc (như trong document DB).' },
    { key: 'schema-on-write', term: 'Schema-on-write', vi: 'schema khi ghi', ch: 3, topic: 'ch3-schema', def: 'Cấu trúc dữ liệu được khai báo tường minh trong database và mọi bản ghi đều được kiểm tra tuân thủ ngay tại thời điểm ghi.' },
    { key: 'aggregation-pipeline', term: 'Aggregation pipeline', vi: 'đường ống tổng hợp', ch: 3, topic: 'ch3-doc-query', def: 'Ngôn ngữ truy vấn của MongoDB biểu diễn truy vấn dưới dạng chuỗi các bước biến đổi dữ liệu liên tiếp ($match, $group, $lookup…).' },
    { key: 'graph', term: 'Graph data model', vi: 'mô hình đồ thị (graph)', ch: 3, topic: 'ch3-graph', def: 'Mô hình dữ liệu gồm các đỉnh (vertex/node) và các cạnh (edge/relationship), lý tưởng cho dữ liệu có nhiều quan hệ nhiều-nhiều phức tạp.' },
    { key: 'adjacency-list', term: 'Adjacency list', vi: 'danh sách kề', ch: 3, topic: 'ch3-graph', def: 'Cách biểu diễn đồ thị trong đó mỗi đỉnh lưu danh sách các đỉnh láng giềng nối trực tiếp với nó.' },
    { key: 'knowledge-graph', term: 'Knowledge graph', vi: 'đồ thị tri thức', ch: 3, topic: 'ch3-graph', def: 'Đồ thị lưu trữ các sự thật và mối liên hệ giữa con người, tổ chức, địa điểm, khái niệm để phục vụ tìm kiếm và suy luận.' },
    { key: 'property-graph', term: 'Property graph', vi: 'đồ thị thuộc tính', ch: 3, topic: 'ch3-graph', def: 'Mô hình graph trong đó mỗi đỉnh và mỗi cạnh có hướng đều có nhãn (label) và một tập các thuộc tính dạng key-value (như trong Neo4j).' },
    { key: 'vertex', term: 'Vertex (node)', vi: 'đỉnh (nút)', ch: 3, topic: 'ch3-graph', def: 'Thực thể trong đồ thị (ví dụ một người hoặc một địa điểm), được nối với các đỉnh khác thông qua các cạnh.' },
    { key: 'edge', term: 'Edge (relationship)', vi: 'cạnh (quan hệ)', ch: 3, topic: 'ch3-graph', def: 'Liên kết có hướng nối từ đỉnh đuôi (tail) tới đỉnh đầu (head), biểu diễn mối quan hệ giữa hai đỉnh.' },
    { key: 'cypher', term: 'Cypher', vi: 'ngôn ngữ truy vấn Cypher', ch: 3, topic: 'ch3-cypher', def: 'Ngôn ngữ truy vấn khai báo cho property graph dùng cú pháp mũi tên trực quan như (a)-[:WITHIN*0..]->(b).' },
    { key: 'recursive-cte', term: 'Recursive CTE (WITH RECURSIVE)', vi: 'biểu thức bảng chung đệ quy', ch: 3, topic: 'ch3-cypher', def: 'Cú pháp của SQL cho phép một truy vấn tự tham chiếu chính nó để duyệt cây hoặc đồ thị có độ sâu không biết trước.' },
    { key: 'gql', term: 'GQL (Graph Query Language)', vi: 'chuẩn ngôn ngữ truy vấn đồ thị GQL', ch: 3, topic: 'ch3-cypher', def: 'Chuẩn ngôn ngữ truy vấn đồ thị mới của ISO phát triển song song với mở rộng SQL/PGQ để truy vấn property graph.' },
    { key: 'triple-store', term: 'Triple-store', vi: 'kho lưu trữ bộ ba', ch: 3, topic: 'ch3-triples', def: 'Cơ sở dữ liệu lưu mọi thông tin dưới dạng bộ ba (subject, predicate, object), trong đó object có thể là giá trị thuộc tính hoặc một đỉnh khác.' },
    { key: 'turtle', term: 'Turtle', vi: 'định dạng Turtle', ch: 3, topic: 'ch3-triples', def: 'Định dạng văn bản ngắn gọn, dễ đọc cho con người để viết dữ liệu RDF dưới dạng các bộ ba subject–predicate–object.' },
    { key: 'rdf', term: 'RDF (Resource Description Framework)', vi: 'khung mô tả tài nguyên RDF', ch: 3, topic: 'ch3-triples', def: 'Mô hình dữ liệu chuẩn của W3C cho Semantic Web, dùng URI để định danh subject, predicate và object nhằm kết nối dữ liệu từ nhiều nguồn.' },
    { key: 'sparql', term: 'SPARQL', vi: 'ngôn ngữ truy vấn SPARQL', ch: 3, topic: 'ch3-triples', def: 'Ngôn ngữ truy vấn khai báo cho dữ liệu RDF/triple-store dựa trên việc so khớp mẫu các bộ ba có biến (?person :bornIn ?place).' },
    { key: 'datalog', term: 'Datalog', vi: 'ngôn ngữ Datalog', ch: 3, topic: 'ch3-datalog', def: 'Ngôn ngữ truy vấn khai báo dựa trên logic vị từ, biểu diễn dữ liệu bằng các fact và xây dựng truy vấn phức tạp từ các rule có thể đệ quy.' },
    { key: 'graphql', term: 'GraphQL', vi: 'GraphQL', ch: 3, topic: 'ch3-graphql', def: 'Ngôn ngữ truy vấn API cho phép client chỉ định chính xác cấu trúc JSON và các trường cần lấy trong một lượt request duy nhất.' },
    { key: 'event-log', term: 'Event log', vi: 'nhật ký sự kiện', ch: 3, topic: 'ch3-event-sourcing', def: 'Chuỗi các sự kiện bất biến chỉ nối thêm (append-only), ghi lại mọi thay đổi trạng thái theo đúng thứ tự thời gian.' },
    { key: 'materialized-view', term: 'Materialized view (projection / read model)', vi: 'khung nhìn tính sẵn (read model)', ch: 3, topic: 'ch3-event-sourcing', def: 'Bản tổng hợp dữ liệu được dựng sẵn và cập nhật từ event log để tối ưu cho một kiểu truy vấn đọc cụ thể.' },
    { key: 'event-sourcing', term: 'Event sourcing', vi: 'lưu trữ dựa trên sự kiện', ch: 3, topic: 'ch3-event-sourcing', def: 'Cách thiết kế dùng log sự kiện bất biến làm nguồn sự thật (system of record) và dẫn xuất mọi trạng thái đọc từ log đó.' },
    { key: 'cqrs', term: 'CQRS (Command Query Responsibility Segregation)', vi: 'tách biệt trách nhiệm lệnh và truy vấn', ch: 3, topic: 'ch3-event-sourcing', def: 'Kiến trúc tách riêng mô hình ghi (nhận command, ghi sự kiện) khỏi một hoặc nhiều mô hình đọc (read model) được dẫn xuất bất đồng bộ.' },
    { key: 'command', term: 'Command', vi: 'mệnh lệnh (command)', ch: 3, topic: 'ch3-event-sourcing', def: 'Yêu cầu thực hiện một hành động từ người dùng; command có thể bị từ chối nếu không hợp lệ, và khi được chấp nhận sẽ sinh ra event bất biến.' },
    { key: 'dataframe', term: 'Dataframe', vi: 'dataframe', ch: 3, topic: 'ch3-dataframes', def: 'Cấu trúc dữ liệu dạng bảng trong R, pandas, Spark cho phép biến đổi từng bước và làm cầu nối sang ma trận số cho thống kê/ML.' },
    { key: 'sparse-matrix', term: 'Sparse matrix', vi: 'ma trận thưa', ch: 3, topic: 'ch3-dataframes', def: 'Ma trận có phần lớn các ô trống hoặc bằng 0 (như ma trận người dùng × phim trong hệ thống gợi ý).' },
    { key: 'one-hot', term: 'One-hot encoding', vi: 'mã hoá one-hot', ch: 3, topic: 'ch3-dataframes', def: 'Cách biến một cột phân loại có N giá trị thành N cột nhị phân 0/1 để đưa vào các mô hình đại số tuyến tính và machine learning.' },
    { key: 'array-database', term: 'Array database', vi: 'cơ sở dữ liệu mảng nhiều chiều', ch: 3, topic: 'ch3-dataframes', def: 'Hệ cơ sở dữ liệu chuyên lưu trữ và truy vấn mảng số nhiều chiều lớn (như dữ liệu vệ tinh, khí tượng, ảnh y khoa, TileDB).' },
  ]);
})();
