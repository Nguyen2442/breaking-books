/* Chương 7 — Partitioning (nguồn: ấn bản 1, chương 6) */
(function () {
  const { h, s, clear, fmt, pct, rng, clamp, sleep, slider, seg, button, checkbox, stat, log, widget, glossary, nextId } = window.DDIA;

  // ---------- shared helpers ----------
  /** FNV-1a 32 bit (cùng họ với hàm Voldemort dùng) */
  function fnv(str) {
    let x = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 0x01000193); }
    return x >>> 0;
  }
  /** trộn bit thêm (murmur3 fmix32) để token ngẫu nhiên hơn */
  function mix(x) {
    x ^= x >>> 16; x = Math.imul(x, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16;
    return x >>> 0;
  }
  const TWO32 = 4294967296;
  const hex = (x) => '0x' + (x >>> 0).toString(16).toUpperCase().padStart(8, '0');
  const hashPart = (x, n) => Math.floor((x / TWO32) * n);
  const NODE_VARS = ['--accent', '--violet', '--mark', '--ok', '--warn', '--bad', '--ink-2', '--ink-3'];
  const NODE_S = ['s-accent', 's-violet', 's-mark', 's-ok', 's-warn', 's-bad', 's-ink', 's-ink3'];
  const NODE_F = ['f-accent', 'f-violet', 'f-mark', 'f-ok', 'f-warn', 'f-bad', 'f-ink', 'f-ink3'];
  const LETTERS = 'ABCDEFGH';

  function selectCtl(label, options, value, onChange) {
    const id = nextId('sel');
    const sel = h('select', { id });
    options.forEach((o) => sel.appendChild(h('option', { value: String(o.value) }, o.label)));
    sel.value = String(value);
    sel.addEventListener('change', () => onChange(sel.value));
    return { el: h('div', { class: 'ctl' }, h('label', { for: id }, h('span', label)), sel), sel };
  }
  function textCtl(label, value, onInput) {
    const id = nextId('tx');
    const inp = h('input', { type: 'text', id, autocomplete: 'off', spellcheck: 'false' });
    inp.value = value;
    if (onInput) inp.addEventListener('input', () => onInput(inp.value));
    return { el: h('div', { class: 'ctl' }, h('label', { for: id }, h('span', label)), inp), input: inp };
  }
  /** rows: [{label, value, max, tone, color, text, sel, cap}] */
  function barRows(container, rows) {
    clear(container);
    rows.forEach((r) => {
      const w = r.max > 0 ? clamp(r.value / r.max, 0, 1) * 100 : 0;
      const fill = h('span', { class: 'fill' + (r.tone ? ' ' + r.tone : ''), style: { width: w + '%' } });
      if (r.color) fill.style.background = 'var(' + r.color + ')';
      const track = h('div', { class: 'track' }, fill);
      if (r.cap != null && r.max > 0) track.appendChild(h('i', { class: 'cap', style: { left: clamp(r.cap / r.max, 0, 1) * 100 + '%' } }));
      track.appendChild(h('em', { style: { background: 'var(--surface)', padding: '0 5px', borderRadius: '3px', lineHeight: '18px', top: '2px' } }, r.text));
      container.appendChild(h('div', { class: 'bar-row' + (r.sel ? ' sel' : '') }, h('span', { title: r.label }, r.label), track));
    });
    return container;
  }
  function fmtSize(gb) {
    if (gb < 1) return fmt(gb * 1000, gb * 1000 < 10 ? 1 : 0) + ' MB';
    if (gb < 1000) return fmt(gb, gb < 10 ? 1 : 0) + ' GB';
    return fmt(gb / 1000, gb < 10000 ? 1 : 0) + ' TB';
  }
  /** log-scale chart frame. returns {svg, x(v), y(v)} */
  function logFrame(o) {
    const W = o.W || 600, H = o.H || 280, L = 58, R = 16, T = 14, B = 42;
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': o.aria || '' });
    const lx0 = Math.log10(o.x0), lx1 = Math.log10(o.x1), ly0 = Math.log10(o.y0), ly1 = Math.log10(o.y1);
    const x = (v) => L + ((Math.log10(v) - lx0) / (lx1 - lx0)) * (W - L - R);
    const y = (v) => H - B - ((Math.log10(v) - ly0) / (ly1 - ly0)) * (H - T - B);
    (o.xticks || []).forEach(([v, lab]) => {
      svg.appendChild(s('line', { x1: x(v), x2: x(v), y1: T, y2: H - B, class: 'grid' }));
      svg.appendChild(s('text', { x: x(v), y: H - B + 16, 'text-anchor': 'middle' }, lab));
    });
    (o.yticks || []).forEach(([v, lab]) => {
      svg.appendChild(s('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'grid' }));
      svg.appendChild(s('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end' }, lab));
    });
    svg.appendChild(s('line', { x1: L, x2: W - R, y1: H - B, y2: H - B, class: 'axis' }));
    svg.appendChild(s('line', { x1: L, x2: L, y1: T, y2: H - B, class: 'axis' }));
    svg.appendChild(s('text', { x: (L + W - R) / 2, y: H - 6, 'text-anchor': 'middle', class: 'lbl-strong' }, o.xlabel || ''));
    svg.appendChild(s('text', { x: 12, y: (T + H - B) / 2, 'text-anchor': 'middle', class: 'lbl-strong', transform: `rotate(-90 12 ${(T + H - B) / 2})` }, o.ylabel || ''));
    return { svg, x, y, W, H, L, R, T, B };
  }
  const poly = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');

  // =====================================================================
  // 7.1 Partition + replica placement
  widget('part-replicas', (root) => {
    let N = 4, P = 4, RF = 3;
    const dead = new Set();
    const slN = slider({ label: 'Số node', min: 3, max: 6, value: N, onInput: (v) => { N = v; [...dead].forEach((d) => { if (d >= N) dead.delete(d); }); render(); } });
    const slP = slider({ label: 'Số partition', min: 2, max: 8, value: P, onInput: (v) => { P = v; render(); } });
    const slR = slider({ label: 'Hệ số sao chép', min: 1, max: 3, value: RF, format: (v) => v + ' bản', onInput: (v) => { RF = v; render(); } });
    const grid = h('div', { class: 'nodes' });
    const stAvail = stat('Partition còn phục vụ', '', 'ok');
    const stPromo = stat('Follower được đề bạt', '0', '');
    const stLost = stat('Partition mất hết bản sao', '0', 'ok');
    const stPer = stat('Bản sao trên mỗi node', '', 'accent');
    const note = h('p', { class: 'lab-note' });
    const killBtn = button('Giết node ngẫu nhiên', () => {
      const alive = [...Array(N).keys()].filter((i) => !dead.has(i));
      if (alive.length) { dead.add(alive[Math.floor(Math.random() * alive.length)]); render(); }
    }, 'danger');
    const healBtn = button('Hồi phục tất cả', () => { dead.clear(); render(); }, 'ghost');
    root.append(h('div', { class: 'controls' }, slN.el, slP.el, slR.el), h('div', { class: 'btn-row' }, killBtn, healBtn), grid,
      h('div', { class: 'stats' }, stAvail, stPromo, stLost, stPer), note);

    function render() {
      const rf = Math.min(RF, N);
      const perNode = [...Array(N)].map(() => []);
      let avail = 0, promo = 0, lost = 0;
      for (let p = 0; p < P; p++) {
        const reps = [...Array(rf).keys()].map((j) => (p + j) % N);
        const li = reps.findIndex((n) => !dead.has(n));
        if (li < 0) lost++; else avail++;
        if (li > 0) promo++;
        reps.forEach((n, j) => perNode[n].push({ p, j, role: dead.has(n) ? 'off' : (j === li ? (j === 0 ? 'lead' : 'promo') : (li < 0 ? 'lost' : 'foll')) }));
      }
      clear(grid);
      for (let n = 0; n < N; n++) {
        const isDead = dead.has(n);
        const box = h('div', { class: 'node clickable' + (isDead ? ' dead' : ''), role: 'button', tabindex: '0', 'aria-pressed': String(isDead), title: isDead ? 'Bấm để hồi phục' : 'Bấm để làm node chết' },
          h('b', 'Node ' + (n + 1), h('small', isDead ? 'đã chết' : 'đang sống')),
          h('div', { class: 'chips' }, perNode[n].sort((a, b) => a.p - b.p).map((r) => h('span', { class: 'chip ' + r.role },
            'P' + r.p + ' ' + (r.role === 'lead' ? 'leader' : r.role === 'promo' ? 'leader mới' : r.role === 'off' ? (r.j === 0 ? 'leader' : 'follower') : 'follower')))));
        const toggle = () => { isDead ? dead.delete(n) : dead.add(n); render(); };
        box.addEventListener('click', toggle);
        box.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
        grid.appendChild(box);
      }
      stAvail.update(avail + '/' + P, avail === P ? 'ok' : 'bad');
      stPromo.update(String(promo), promo ? 'warn' : '');
      stLost.update(String(lost), lost ? 'bad' : 'ok', lost ? 'không còn bản sao nào sống' : '');
      stPer.update(fmt((P * rf) / N, 1), 'accent', 'trung bình, ' + rf + ' bản mỗi partition');
      note.textContent = dead.size === 0
        ? `Mỗi node là leader của một số partition và follower của một số khác, giống Hình 6-1. Leader của P${0} ở Node 1, follower ở các node kế tiếp. Bấm vào một node để làm nó chết.`
        : lost
          ? `Với ${rf} bản sao, chết ${dead.size} node đã làm ${lost} partition mất mọi bản sao. Dữ liệu trong đó không đọc được nữa (và mất hẳn nếu đĩa hỏng).`
          : `Chết ${dead.size} node nhưng mọi partition vẫn phục vụ được. ${promo} partition mất leader và có follower được đề bạt (failover, xem Chương 6).`;
    }
    render();
  });

  // =====================================================================
  // 7.2a Encyclopedia volumes
  widget('encyclopedia', (root) => {
    // ước lượng tỉ lệ mục từ tiếng Anh theo chữ cái đầu (số liệu minh hoạ)
    const RAW = { A: 6.1, B: 5.6, C: 9.4, D: 6.0, E: 4.2, F: 4.0, G: 3.3, H: 3.7, I: 3.9, J: 0.9, K: 1.0, L: 3.2, M: 5.6, N: 2.2, O: 2.6, P: 8.1, Q: 0.5, R: 5.3, S: 11.1, T: 5.2, U: 2.9, V: 1.5, W: 2.0, X: 0.1, Y: 0.3, Z: 0.2 };
    const total = Object.values(RAW).reduce((a, b) => a + b, 0);
    const share = (from, to) => { let t = 0; for (let c = from.charCodeAt(0); c <= to.charCodeAt(0); c++) t += RAW[String.fromCharCode(c)]; return t / total; };
    const TWO = []; for (let i = 0; i < 26; i += 2) TWO.push([String.fromCharCode(65 + i), String.fromCharCode(66 + i)]);
    const DATA = [['A', 'B'], ['C', 'C'], ['D', 'E'], ['F', 'G'], ['H', 'I'], ['J', 'L'], ['M', 'M'], ['N', 'O'], ['P', 'P'], ['Q', 'R'], ['S', 'S'], ['T', 'Z']];
    const vols = (m) => (m === 'two' ? TWO : DATA).map(([a, b], i) => ({ n: i + 1, a, b, share: share(a, b) }));
    const maxAll = Math.max(...vols('two').map((v) => v.share), ...vols('data').map((v) => v.share));
    let mode = 'two', word = 'Partition';
    const sg = seg({ label: 'Cách chia tập', options: [{ value: 'two', label: 'Mỗi tập 2 chữ cái (13 tập)' }, { value: 'data', label: 'Ranh giới theo dữ liệu (12 tập)' }], value: mode, onChange: (v) => { mode = v; render(); } });
    const tx = textCtl('Tra một từ tiếng Anh', word, (v) => { word = v; render(); });
    const bars = h('div', { class: 'bars' });
    const stMax = stat('Tập dày nhất', ''), stMin = stat('Tập mỏng nhất', ''), stRatio = stat('Chênh lệch', '');
    const found = h('p', { class: 'lab-note' });
    root.append(h('div', { class: 'controls' }, h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Cách chia tập'), sg.el), tx.el), found, bars,
      h('div', { class: 'stats' }, stMax, stMin, stRatio),
      h('p', { class: 'lab-note' }, 'Độ dày mỗi tập = tỉ lệ mục từ có chữ cái đầu trong dải đó. Tỉ lệ theo chữ cái là ước lượng cho từ điển tiếng Anh (số liệu minh hoạ). Tập 1 = A–B và tập 12 = T–Z như trong Hình 6-2.'));
    function render() {
      const vs = vols(mode);
      const first = (word.trim()[0] || '').toUpperCase();
      const hit = /[A-Z]/.test(first) ? vs.find((v) => first >= v.a && first <= v.b) : null;
      barRows(bars, vs.map((v) => ({ label: `Tập ${v.n} · ${v.a === v.b ? v.a : v.a + '–' + v.b}`, value: v.share, max: maxAll, text: pct(v.share), sel: v === hit, tone: v === hit ? 'mark' : '' })));
      const sorted = [...vs].sort((a, b) => b.share - a.share);
      const big = sorted[0], small = sorted[sorted.length - 1], ratio = big.share / small.share;
      stMax.update(pct(big.share), '', `Tập ${big.n} (${big.a}–${big.b})`);
      stMin.update(pct(small.share), '', `Tập ${small.n} (${small.a}–${small.b})`);
      stRatio.update('×' + fmt(ratio, 1), ratio > 5 ? 'bad' : ratio > 3 ? 'warn' : 'ok', 'tập dày nhất / mỏng nhất');
      found.textContent = hit
        ? `“${word.trim()}” bắt đầu bằng ${first}, nằm trong tập ${hit.n} (${hit.a}–${hit.b}). Biết ranh giới thì lấy thẳng đúng tập trên kệ, không cần mở tập khác.`
        : 'Gõ một từ bắt đầu bằng chữ cái A–Z.';
    }
    render();
  });

  // =====================================================================
  // 7.2b Sensor writes: timestamp vs sensor-prefixed key
  widget('sensor-hotspot', (root) => {
    const SENSORS = ['bien-hoa-01', 'can-tho-02', 'da-lat-03', 'hai-phong-04', 'hue-05', 'long-an-06', 'nha-trang-07', 'phu-quoc-08', 'quy-nhon-09', 'sa-pa-10', 'tay-ninh-11', 'vinh-12'];
    const PARTS = {
      ts: ['11/03', '12/03', '13/03', '14/03 (hôm nay)'].map((d, i) => ({ label: 'P' + i + ' · ngày ' + d })),
      pre: [['a', 'f'], ['g', 'm'], ['n', 'r'], ['s', 'z']].map(([a, b], i) => ({ label: `P${i} · cảm biến ${a}–${b}`, a, b })),
    };
    let mode = 'ts', minute = 0, counts = [0, 0, 0, 0], running = false, lastKey = '';
    const sg = seg({ label: 'Cách tạo khoá', options: [{ value: 'ts', label: 'Khoá = timestamp' }, { value: 'pre', label: 'Khoá = tên cảm biến + timestamp' }], value: mode, onChange: (v) => { mode = v; minute = 0; counts = [0, 0, 0, 0]; writeMinute(true).then(render); } });
    const runBtn = button('Ghi thêm 1 phút dữ liệu', () => writeMinute(false));
    const keyLine = h('pre', { class: 'json', style: { whiteSpace: 'pre-wrap' } });
    const bars = h('div', { class: 'bars' });
    const stHot = stat('Partition nóng nhất nhận', ''), stIdle = stat('Partition ngồi chơi', ''), stRq = stat('Range query cho “mọi cảm biến, 1 giờ”', '');
    root.append(h('div', { class: 'controls' }, h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Cách tạo khoá'), sg.el)), h('div', { class: 'btn-row' }, runBtn),
      h('div', { class: 'box' }, h('h5', 'Khoá vừa ghi'), keyLine), bars, h('div', { class: 'stats' }, stHot, stIdle, stRq),
      h('p', { class: 'lab-note' }, '12 cảm biến, mỗi cảm biến một số đo mỗi 10 giây. 4 partition theo khoảng khoá; ranh giới là số liệu minh hoạ.'));
    const pad = (n) => String(n).padStart(2, '0');
    function partOf(sensor) {
      if (mode === 'ts') return 3; // mọi số đo mới đều thuộc ngày hôm nay
      const c = sensor[0];
      return PARTS.pre.findIndex((p) => c >= p.a && c <= p.b);
    }
    async function writeMinute(instant) {
      if (running && !instant) return;
      running = true; runBtn.disabled = true;
      const m = minute++;
      for (let sec = 0; sec < 60; sec += 10) {
        const ts = `2025-03-14 09:${pad(m % 60)}:${pad(sec)}`;
        SENSORS.forEach((sn) => { counts[partOf(sn)]++; lastKey = mode === 'ts' ? ts : sn + ' ' + ts; });
        if (!instant) { render(); await sleep(140); }
      }
      running = false; runBtn.disabled = false;
      render();
    }
    function render() {
      const tot = counts.reduce((a, b) => a + b, 0) || 1, mx = Math.max(...counts);
      barRows(bars, PARTS[mode].map((p, i) => ({ label: p.label, value: counts[i], max: Math.max(mx, 1), text: fmt(counts[i]) + ' lần ghi', tone: counts[i] / tot > 0.5 ? 'bad' : '' })));
      keyLine.textContent = lastKey ? `${lastKey}   → P${partOf(lastKey.split(' ')[0])}` : '';
      stHot.update(pct(mx / tot, 0), mx / tot > 0.5 ? 'bad' : 'ok', 'tổng lượng ghi');
      const idle = counts.filter((c) => c === 0).length;
      stIdle.update(idle + '/4', idle ? 'bad' : 'ok');
      stRq.update(mode === 'ts' ? '1' : '12', mode === 'ts' ? 'ok' : 'warn', mode === 'ts' ? 'một lần quét liên tục theo thời gian' : 'mỗi cảm biến một range query');
    }
    writeMinute(true).then(render);
  });

  // =====================================================================
  // 7.3 Key-range vs hash distribution with live histogram
  widget('range-vs-hash', (root) => {
    const NAMES = ['an', 'anh', 'bao', 'binh', 'chau', 'chi', 'cuong', 'dung', 'duy', 'giang', 'ha', 'hai', 'hieu', 'hoa', 'hung', 'khanh', 'khoa', 'lan', 'linh', 'long', 'mai', 'minh', 'nam', 'nga', 'ngoc', 'nhung', 'phong', 'phuong', 'quan', 'quang', 'son', 'tam', 'thao', 'thu', 'trang', 'trung', 'tuan', 'uyen', 'viet', 'vy', 'xuan', 'yen'];
    const RB = ['g', 'n', 't']; // ranh giới khoảng khoá
    const RLAB = ['P0 · khoá < “g”', 'P1 · “g” … “n”', 'P2 · “n” … “t”', 'P3 · khoá ≥ “t”'];
    const HLAB = ['P0 · hash 0x0000…–0x3FFF…', 'P1 · 0x4000…–0x7FFF…', 'P2 · 0x8000…–0xBFFF…', 'P3 · 0xC000…–0xFFFF…'];
    const r = rng(7);
    let keys = [], strat = 'range', tsCounter = 0, lastAdded = null;
    const rangePart = (k) => { const x = k.toLowerCase(); let i = 0; while (i < RB.length && x >= RB[i]) i++; return i; };
    const part = (k, st) => (st || strat) === 'range' ? rangePart(k) : hashPart(fnv(k), 4);
    const pad = (n) => String(n).padStart(2, '0');
    function addTs(n) { for (let i = 0; i < n; i++) { const t = tsCounter++ * 15; keys.push(`2025-03-14 ${pad(10 + Math.floor(t / 3600))}:${pad(Math.floor(t / 60) % 60)}:${pad(t % 60)}`); } }
    function addNames(n) { for (let i = 0; i < n; i++) keys.push(NAMES[Math.floor(r() * NAMES.length)] + pad(Math.floor(r() * 100))); }
    addTs(40); addNames(40);

    const sg = seg({ label: 'Chiến lược', options: [{ value: 'range', label: 'Theo khoảng khoá' }, { value: 'hash', label: 'Theo hash của khoá' }], value: strat, onChange: (v) => { strat = v; render(); } });
    const tx = textCtl('Khoá mới', 'user:lan', () => render());
    const addBtn = button('Thêm khoá', () => { const k = tx.input.value.trim(); if (k) { keys.push(k); lastAdded = k; render(); } });
    tx.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') addBtn.click(); });
    const preview = h('p', { class: 'lab-note' });
    const bars = h('div', { class: 'bars' });
    const samples = h('div', { class: 'nodes' });
    const qFrom = textCtl('Range query: từ', '2025-03-14 10:00', () => render());
    const qTo = textCtl('đến (không gồm)', '2025-03-14 10:05', () => render());
    const qOut = h('div', { class: 'chips' });
    const qNote = h('p', { class: 'lab-note' });
    const stTot = stat('Tổng số khoá', ''), stSkew = stat('Partition đông nhất / trung bình', ''), stQ = stat('Partition phải hỏi', '');
    root.append(
      h('div', { class: 'controls' }, h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Chiến lược phân vùng (4 partition)'), sg.el)),
      h('div', { class: 'controls' }, tx.el, h('div', { class: 'btn-row' }, addBtn)), preview,
      h('div', { class: 'btn-row' }, button('Thêm 40 timestamp liên tiếp', () => { addTs(40); lastAdded = null; render(); }, 'ghost'),
        button('Thêm 40 tên người dùng', () => { addNames(40); lastAdded = null; render(); }, 'ghost'),
        button('Xoá hết', () => { keys = []; tsCounter = 0; lastAdded = null; render(); }, 'ghost')),
      bars, samples,
      h('div', { class: 'box' }, h('h5', 'Range query trên khoá chính'), h('div', { class: 'controls' }, qFrom.el, qTo.el), qOut, qNote),
      h('div', { class: 'stats' }, stTot, stSkew, stQ));

    function render() {
      const cnt = [0, 0, 0, 0], last = [[], [], [], []];
      keys.forEach((k) => { const p = part(k); cnt[p]++; last[p].push(k); });
      const mx = Math.max(1, ...cnt), avg = keys.length / 4;
      barRows(bars, cnt.map((c, i) => ({ label: (strat === 'range' ? RLAB : HLAB)[i], value: c, max: mx, text: fmt(c) + ' khoá', tone: keys.length >= 8 && c > 2 * avg ? 'bad' : '' })));
      clear(samples);
      last.forEach((ks, i) => samples.appendChild(h('div', { class: 'node' + (lastAdded && part(lastAdded) === i ? ' hit' : '') }, h('b', 'P' + i, h('small', fmt(ks.length) + ' khoá')),
        h('div', { class: 'keys' }, ks.length ? ks.slice(-4).join(' · ') + (ks.length > 4 ? ' …' : '') : '(trống)'))));
      const k = tx.input.value.trim();
      if (k) { const hv = fnv(k); preview.textContent = `“${k}”: hash FNV-1a = ${hex(hv)}. Theo khoảng khoá → P${rangePart(k)}; theo hash → P${hashPart(hv, 4)}.`; }
      else preview.textContent = 'Gõ một khoá để xem hash và partition của nó.';
      // range query
      const a = qFrom.input.value, b = qTo.input.value;
      const matched = keys.filter((x) => x >= a && x < b).length;
      let hit;
      if (strat === 'range') {
        const pa = rangePart(a), pb = rangePart(b || a);
        hit = [0, 1, 2, 3].filter((i) => a < b ? i >= pa && i <= pb : false);
      } else hit = a < b ? [0, 1, 2, 3] : [];
      clear(qOut);
      [0, 1, 2, 3].forEach((i) => qOut.appendChild(h('span', { class: 'chip ' + (hit.includes(i) ? 'hitc' : 'off') }, 'P' + i + (hit.includes(i) ? ' được hỏi' : ' bỏ qua'))));
      qNote.textContent = a < b
        ? (strat === 'range'
          ? `${fmt(matched)} khoá khớp. Khoá được sắp xếp nên chỉ cần quét liên tục trên ${hit.length} partition.`
          : `${fmt(matched)} khoá khớp, nhưng hash đã xoá thứ tự: khoá liền nhau bị rải khắp nơi, nên phải hỏi cả 4 partition (scatter/gather) rồi gộp.`)
        : 'Nhập “từ” nhỏ hơn “đến” (so sánh theo thứ tự chuỗi).';
      stTot.update(fmt(keys.length));
      const sk = avg ? mx / avg : 0;
      stSkew.update(keys.length ? '×' + fmt(sk, 2) : '—', sk > 1.6 ? 'bad' : sk > 1.25 ? 'warn' : 'ok', '1,00 = hoàn toàn đều');
      stQ.update(hit.length + '/4', hit.length > 1 ? 'warn' : 'ok');
    }
    render();
  });

  // =====================================================================
  // 7.4 Hash ring with random tokens
  widget('hash-ring', (root) => {
    const TOK = [1, 2, 4, 8, 16, 32, 64, 128, 256];
    let N = 4, ti = 0, prev = null, msg = '';
    const tokensFor = (n, t) => {
      const out = [];
      for (let i = 0; i < n; i++) for (let j = 0; j < t; j++) out.push({ v: mix(fnv('node-' + LETTERS[i] + '#' + j)), n: i });
      return out.sort((a, b) => a.v - b.v);
    };
    const ownerAt = (toks, x) => { // first token >= x (wrap)
      let lo = 0, hi = toks.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (toks[m].v < x) lo = m + 1; else hi = m; }
      return toks[lo % toks.length].n;
    };
    const shares = (toks, n) => {
      const sh = new Array(n).fill(0);
      toks.forEach((t, i) => { const p = i ? toks[i - 1].v : toks[toks.length - 1].v - TWO32; sh[t.n] += (t.v - p) / TWO32; });
      return sh;
    };
    function moved(a, b) {
      const pts = [...new Set([...a.map((t) => t.v), ...b.map((t) => t.v)])].sort((x, y) => x - y);
      let m = 0;
      pts.forEach((v, i) => { const p = i ? pts[i - 1] : pts[pts.length - 1] - TWO32; const mid = ((p + v) / 2 + TWO32) % TWO32; if (ownerAt(a, mid) !== ownerAt(b, mid)) m += (v - p) / TWO32; });
      return m;
    }
    const slN = slider({ label: 'Số node', min: 2, max: 8, value: N, onInput: (v) => change(v, ti) });
    const slT = slider({ label: 'Token mỗi node', min: 0, max: TOK.length - 1, value: ti, format: (v) => String(TOK[v]), onInput: (v) => change(N, v) });
    const addBtn = button('Thêm một node', () => { if (N < 8) { slN.set(N + 1); change(N + 1, ti); } });
    const rmBtn = button('Bớt một node', () => { if (N > 2) { slN.set(N - 1); change(N - 1, ti); } }, 'ghost');
    const viz = h('div', { class: 'viz' });
    const bars = h('div', { class: 'bars' });
    const stMax = stat('Node nặng nhất / mức lý tưởng', ''), stMove = stat('Dữ liệu di chuyển ở thay đổi vừa rồi', '—'), stMod = stat('Nếu dùng hash mod N', '—');
    const note = h('p', { class: 'lab-note' });
    root.append(h('div', { class: 'controls' }, slN.el, slT.el), h('div', { class: 'btn-row' }, addBtn, rmBtn),
      h('div', { class: 'lab-split' }, viz, h('div', {}, h('h5', { style: { margin: '0 0 8px', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-2)' } }, 'Phần vòng hash mỗi node giữ'), bars)),
      h('div', { class: 'stats' }, stMax, stMove, stMod), note);
    function change(n, t) {
      const before = tokensFor(N, TOK[ti]);
      const oldN = N;
      N = n; ti = t;
      const after = tokensFor(N, TOK[ti]);
      prev = { m: moved(before, after), oldN, newN: N };
      render();
    }
    function render() {
      const toks = tokensFor(N, TOK[ti]);
      const sh = shares(toks, N);
      const ideal = 1 / N, mx = Math.max(...sh);
      // ring
      const W = 300, cx = 150, cy = 150, R = 112;
      const svg = s('svg', { viewBox: `0 0 ${W} ${W}`, role: 'img', 'aria-label': 'Vòng hash với các token' });
      svg.appendChild(s('circle', { cx, cy, r: R, class: 'f-none s-line', 'stroke-width': 24 }));
      const ang = (v) => (v / TWO32) * Math.PI * 2 - Math.PI / 2;
      const pt = (a, rr) => [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
      // merge consecutive segments of same owner
      const segs = [];
      toks.forEach((t, i) => { const p = i ? toks[i - 1].v : toks[toks.length - 1].v - TWO32; const last = segs[segs.length - 1]; if (last && last.n === t.n) last.b = t.v; else segs.push({ a: p, b: t.v, n: t.n }); });
      segs.forEach((g) => {
        const a0 = ang(g.a), a1 = ang(g.b);
        const big = g.b - g.a > TWO32 / 2 ? 1 : 0;
        if (g.b - g.a >= TWO32 - 1) { svg.appendChild(s('circle', { cx, cy, r: R, class: 'f-none ' + NODE_S[g.n], 'stroke-width': 24 })); return; }
        const [x0, y0] = pt(a0, R), [x1, y1] = pt(a1, R);
        svg.appendChild(s('path', { d: `M${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 ${big} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`, class: 'f-none ' + NODE_S[g.n], 'stroke-width': 24 }));
      });
      if (toks.length <= 64) toks.forEach((t) => { const [x, y] = pt(ang(t.v), R + 17); svg.appendChild(s('circle', { cx: x, cy: y, r: 3.2, class: NODE_F[t.n] })); });
      [['0', 0], ['2³⁰', 0.25], ['2³¹', 0.5], ['3·2³⁰', 0.75]].forEach(([lab, f]) => { const [x, y] = pt(f * Math.PI * 2 - Math.PI / 2, R - 26); svg.appendChild(s('text', { x, y: y + 4, 'text-anchor': 'middle' }, lab)); });
      svg.appendChild(s('text', { x: cx, y: cy - 4, 'text-anchor': 'middle', class: 'lbl-strong' }, fmt(toks.length) + ' token'));
      svg.appendChild(s('text', { x: cx, y: cy + 12, 'text-anchor': 'middle' }, 'khoá thuộc token kế tiếp'));
      svg.appendChild(s('text', { x: cx, y: cy + 26, 'text-anchor': 'middle' }, 'theo chiều kim đồng hồ'));
      clear(viz).appendChild(svg);
      barRows(bars, sh.map((v, i) => ({ label: 'Node ' + LETTERS[i], value: v, max: Math.max(mx, ideal) * 1.05, color: NODE_VARS[i], cap: ideal, text: pct(v), sel: prev && prev.newN > prev.oldN && i === N - 1 })));
      const ratio = mx / ideal;
      stMax.update('×' + fmt(ratio, 2), ratio > 1.6 ? 'bad' : ratio > 1.2 ? 'warn' : 'ok', 'vạch đỏ trên thanh = 1/N');
      if (prev && prev.oldN !== prev.newN) {
        stMove.update(pct(prev.m), 'accent', `${prev.oldN} → ${prev.newN} node; tối thiểu ≈ ${pct(Math.abs(1 / Math.max(prev.newN, prev.oldN)))}`);
        const a = Math.min(prev.oldN, prev.newN), b = Math.max(prev.oldN, prev.newN);
        stMod.update(pct(1 - 1 / b), 'bad', `${a} ↔ ${b} node`);
      } else if (prev) {
        stMove.update(pct(prev.m), 'warn', 'đổi số token: mọi ranh giới đổi');
        stMod.update('—', '');
      }
      addBtn.disabled = N >= 8; rmBtn.disabled = N <= 2;
      note.textContent = TOK[ti] < 8
        ? `Với ${TOK[ti]} token mỗi node, ranh giới ngẫu nhiên cho các đoạn dài ngắn rất khác nhau, nên tải lệch. Tăng số token để sự ngẫu nhiên trung bình hoá.`
        : `Với ${TOK[ti]} token mỗi node, phần của mỗi node đã gần 1/${N}. Cassandra mặc định 256 token (vnode) mỗi node.`;
    }
    render();
  });

  // =====================================================================
  // 7.5 Cassandra compound key
  widget('compound-key', (root) => {
    const USERS = [[101, 'lan'], [102, 'minh'], [103, 'an'], [104, 'khoa'], [105, 'vy'], [106, 'son']];
    const TEXT = ['đã đăng ảnh', 'đổi ảnh đại diện', 'chia sẻ một liên kết', 'viết bài mới', 'bình luận', 'check-in'];
    const r = rng(42);
    const rows = [];
    USERS.forEach(([id]) => {
      const days = new Set();
      while (days.size < 4) days.add(1 + Math.floor(r() * 7));
      [...days].forEach((d) => rows.push({ uid: id, ts: `2025-03-0${d} ${String(8 + Math.floor(r() * 12)).padStart(2, '0')}:${String(Math.floor(r() * 60)).padStart(2, '0')}`, body: TEXT[Math.floor(r() * TEXT.length)] }));
    });
    // partition = hash(user_id) trên 3 partition; dữ liệu trong partition sắp theo (user_id, timestamp)
    const PART = {};
    USERS.forEach(([id], i) => { PART[id] = [0, 1, 2, 0, 1, 2][[0, 3, 1, 4, 2, 5].indexOf(i)]; });
    USERS.forEach(([id]) => { PART[id] = hashPart(mix(fnv(String(id))), 3); });
    // bảo đảm demo không có partition rỗng
    const used = new Set(Object.values(PART));
    if (used.size < 3) USERS.forEach(([id], i) => { PART[id] = i % 3; });
    rows.sort((a, b) => a.uid - b.uid || (a.ts < b.ts ? -1 : 1));
    let uid = '103', from = '2', to = '5';
    const uSel = selectCtl('user_id', [{ value: '', label: '(không chỉ định)' }, ...USERS.map(([id, n]) => ({ value: id, label: id + ' · ' + n }))], uid, (v) => { uid = v; render(); });
    const dOpts = [1, 2, 3, 4, 5, 6, 7].map((d) => ({ value: d, label: '0' + d + '/03' }));
    const fSel = selectCtl('Từ ngày', dOpts, from, (v) => { from = v; render(); });
    const tSel = selectCtl('Đến hết ngày', dOpts, to, (v) => { to = v; render(); });
    const cql = h('pre', { class: 'code' });
    const warnP = h('p', { class: 'lab-note' });
    const grid = h('div', { class: 'nodes' });
    const stP = stat('Partition bị chạm', ''), stRead = stat('Dòng phải đọc', ''), stM = stat('Dòng khớp', '');
    root.append(h('div', { class: 'controls' }, uSel.el, fSel.el, tSel.el), cql, warnP, grid, h('div', { class: 'stats' }, stP, stRead, stM));
    function render() {
      const lo = `2025-03-0${from}`, hi = `2025-03-0${+to + 1}`;
      const where = (uid ? `user_id = <span class="n">${uid}</span>\n  <span class="k">AND</span> ` : '') + `update_timestamp >= <span class="s">'${lo}'</span>\n  <span class="k">AND</span> update_timestamp &lt; <span class="s">'${hi}'</span>` + (uid ? '' : '\n  <span class="k">ALLOW FILTERING</span>');
      cql.innerHTML = `<span class="k">SELECT</span> * <span class="k">FROM</span> updates\n<span class="k">WHERE</span> ${where};`;
      const match = (x) => (!uid || x.uid === +uid) && x.ts >= lo && x.ts < hi;
      const touched = uid ? [PART[+uid]] : [0, 1, 2];
      let read = 0, m = 0;
      clear(grid);
      for (let p = 0; p < 3; p++) {
        const rs = rows.filter((x) => PART[x.uid] === p);
        const hitP = touched.includes(p);
        const tb = h('table', { class: 'mini' });
        rs.forEach((x) => {
          const isM = hitP && match(x);
          const scanned = hitP && (uid ? isM : true);
          if (scanned) read++;
          if (isM) m++;
          tb.appendChild(h('tr', { class: isM ? 'm' : scanned ? '' : 'x' }, h('td', String(x.uid)), h('td', x.ts.slice(5)), h('td', x.body)));
        });
        grid.appendChild(h('div', { class: 'node' + (hitP ? ' hit' : ' dim') }, h('b', 'Partition ' + p, h('small', hitP ? 'được hỏi' : 'không chạm')),
          h('div', { style: { overflowX: 'auto' } }, tb)));
      }
      stP.update(touched.length + '/3', touched.length === 1 ? 'ok' : 'bad');
      stRead.update(String(read), uid ? 'ok' : 'bad', uid ? 'tìm tới đầu dải rồi đọc liên tục' : 'quét mọi dòng của mọi partition');
      stM.update(String(m), 'accent');
      warnP.textContent = uid
        ? `hash(${uid}) chọn partition ${PART[+uid]}. Trong partition, các dòng của user ${uid} nằm liền nhau và đã sắp theo thời gian, nên chỉ cần một range scan ngắn (dòng tô vàng).`
        : 'Không có partition key: Cassandra không biết hỏi partition nào. Nó từ chối truy vấn trừ khi thêm ALLOW FILTERING, khi đó mọi partition bị quét và lọc từng dòng.';
    }
    render();
  });

  // =====================================================================
  // 7.6 Hot key with random suffix
  widget('hot-key', (root) => {
    const P = 10, CAP = 1000, BG = 2000, HOT = 8000;
    const r = rng(3);
    const bg = [...Array(P)].map(() => (BG / P) * (0.8 + r() * 0.4));
    let digits = 0, event = true;
    const sl = slider({ label: 'Số chữ số ngẫu nhiên thêm vào khoá nóng', min: 0, max: 2, value: 0, format: (v) => v + ' chữ số → ' + Math.pow(10, v) + ' khoá', onInput: (v) => { digits = v; render(); } });
    const cb = checkbox('Đang có sự kiện người nổi tiếng', true, (v) => { event = v; render(); });
    const bars = h('div', { class: 'bars' });
    const sub = h('div', { class: 'keys' });
    const stMax = stat('Partition nóng nhất', ''), stOver = stat('Partition quá tải', ''), stRead = stat('Mỗi lần đọc khoá nóng', ''), stBook = stat('Khoá phải ghi sổ “đang bị tách”', '');
    root.append(h('div', { class: 'controls' }, sl.el, h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Kịch bản'), cb.el)), bars,
      h('div', { class: 'box' }, h('h5', 'Khoá thực sự được ghi'), sub), h('div', { class: 'stats' }, stMax, stOver, stRead, stBook),
      h('p', { class: 'lab-note' }, `10 partition, mỗi partition chịu tối đa ${fmt(CAP)} lần ghi/giây (vạch đỏ). Nền: ${fmt(BG)} lần ghi/giây rải đều; sự kiện: ${fmt(HOT)} lần ghi/giây vào khoá post:9876. Số liệu minh hoạ.`));
    function render() {
      const k = Math.pow(10, digits);
      const keys = digits === 0 ? ['post:9876'] : [...Array(k).keys()].map((i) => 'post:9876_' + String(i).padStart(digits, '0'));
      const load = bg.slice();
      const parts = new Set();
      if (event) keys.forEach((key) => { const p = hashPart(mix(fnv(key)), P); load[p] += HOT / k; parts.add(p); });
      else keys.forEach((key) => parts.add(hashPart(mix(fnv(key)), P)));
      const mx = Math.max(...load);
      barRows(bars, load.map((v, i) => ({ label: 'P' + i, value: v, max: Math.max(mx, CAP * 1.25), cap: CAP, text: fmt(v) + ' ghi/s', tone: v > CAP ? 'bad' : v > CAP * 0.8 ? 'warn' : '' })));
      sub.textContent = (keys.length <= 10 ? keys : [...keys.slice(0, 6), '…', ...keys.slice(-2)]).map((x) => x === '…' ? x : x + '→P' + hashPart(mix(fnv(x)), P)).join('  ');
      const over = load.filter((v) => v > CAP).length;
      stMax.update(fmt(mx) + ' ghi/s', mx > CAP ? 'bad' : 'ok', 'sức chứa ' + fmt(CAP));
      stOver.update(over + '/' + P, over ? 'bad' : 'ok');
      stRead.update(k === 1 ? '1 khoá' : fmt(k) + ' khoá', k === 1 ? 'ok' : k > 10 ? 'bad' : 'warn', `trên ${parts.size} partition, rồi gộp`);
      stBook.update(digits ? '1 khoá' : '0', digits ? 'warn' : '', digits ? 'chỉ tách khoá nóng; khoá khác giữ nguyên' : '');
    }
    render();
  });

  // =====================================================================
  // Car data used by 7.7 and 7.8
  const CARS = [
    { id: 191, color: 'red', make: 'Honda' }, { id: 214, color: 'black', make: 'Dodge' }, { id: 306, color: 'red', make: 'Ford' },
    { id: 515, color: 'silver', make: 'Dodge' }, { id: 768, color: 'red', make: 'Volvo' }, { id: 893, color: 'silver', make: 'Audi' },
    { id: 1027, color: 'white', make: 'Toyota' }, { id: 1203, color: 'red', make: 'Honda' }, { id: 1388, color: 'black', make: 'Ford' },
    { id: 1544, color: 'silver', make: 'Volvo' }, { id: 1702, color: 'blue', make: 'Dodge' }, { id: 1931, color: 'white', make: 'Audi' },
  ];
  const VI_COLOR = { red: 'đỏ', silver: 'bạc', black: 'đen', white: 'trắng', blue: 'xanh dương', green: 'xanh lá' };
  const docPart = (id) => Math.floor(id / 500);
  const termPart = (term) => { const c = term.split(':')[1][0].toLowerCase(); return c <= 'f' ? 0 : c <= 'm' ? 1 : c <= 'r' ? 2 : 3; };
  const TP_LABEL = ['term a–f', 'term g–m', 'term n–r', 'term s–z'];
  function buildIndex(cars, filterPart) {
    const idx = {};
    cars.forEach((c) => {
      if (filterPart != null && docPart(c.id) !== filterPart) return;
      ['color:' + c.color, 'make:' + c.make].forEach((t) => { (idx[t] = idx[t] || []).push(c.id); });
    });
    return idx;
  }

  // 7.7 Local vs global index query
  widget('sec-index', (root, fig) => {
    const QUERIES = [
      { v: 'q1', label: 'color:red (màu đỏ)', terms: ['color:red'] },
      { v: 'q2', label: 'color:silver (màu bạc)', terms: ['color:silver'] },
      { v: 'q3', label: 'make:Dodge', terms: ['make:Dodge'] },
      { v: 'q4', label: 'color:red AND make:Honda', terms: ['color:red', 'make:Honda'] },
    ];
    let mode = fig.dataset.mode || 'local', qv = 'q1', running = false, lat = null, asked = [];
    const sgM = seg({ label: 'Kiểu index', options: [{ value: 'local', label: 'Theo document (local)' }, { value: 'global', label: 'Theo term (global)' }], value: mode, onChange: (v) => { mode = v; run(true); } });
    const qSel = selectCtl('Truy vấn', QUERIES.map((q) => ({ value: q.v, label: q.label })), qv, (v) => { qv = v; run(true); });
    const runBtn = button('Chạy truy vấn', () => run(false));
    const grid = h('div', { class: 'nodes' });
    const result = h('p', { class: 'lab-note' });
    const lg = log();
    const stAsk = stat('Partition được hỏi', ''), stHas = stat('Partition thực sự có kết quả', ''), stT = stat('Thời gian lần này', ''), stP99 = stat('p99 qua 2.000 lần chạy', '');
    root.append(h('div', { class: 'controls' }, h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Kiểu index'), sgM.el), qSel.el), h('div', { class: 'btn-row' }, runBtn),
      grid, result, h('div', { class: 'stats' }, stAsk, stHas, stT, stP99), lg,
      h('p', { class: 'lab-note' }, 'Dữ liệu phân vùng theo document ID (0–499, 500–999, …). Index toàn cục phân vùng theo chữ cái đầu của giá trị term. Độ trễ mỗi partition: thường 4–8 ms, 2% lần chậm 40–60 ms (số liệu minh hoạ).'));
    const lr = rng(11);
    const oneLat = (rr) => (rr() < 0.02 ? 40 + rr() * 20 : 4 + rr() * 4);
    function plan() {
      const q = QUERIES.find((x) => x.v === qv);
      if (mode === 'local') return { q, ask: [0, 1, 2, 3] };
      return { q, ask: [...new Set(q.terms.map(termPart))] };
    }
    function p99(n) { const rr = rng(99 + n); const arr = []; for (let i = 0; i < 2000; i++) { let m = 0; for (let j = 0; j < n; j++) m = Math.max(m, oneLat(rr)); arr.push(m); } arr.sort((a, b) => a - b); return arr[Math.floor(arr.length * 0.99)]; }
    async function run(instant) {
      if (running) return;
      running = true; runBtn.disabled = true;
      const { q, ask } = plan();
      lat = {}; asked = [];
      lg.reset();
      lg.add(`→ ${q.label} · ${mode === 'local' ? 'scatter tới mọi partition' : 'hỏi partition giữ term'}`, 'acc');
      for (const p of ask) {
        asked.push(p); lat[p] = oneLat(lr);
        if (!instant) { render(); await sleep(220); }
        lg.add(`  P${p} trả lời sau ${fmt(lat[p], 1)} ms`, lat[p] > 20 ? 'warn' : 't');
      }
      running = false; runBtn.disabled = false;
      render();
      const t = Math.max(...ask.map((p) => lat[p]));
      lg.add(`← gộp kết quả: ${fmt(t, 1)} ms (bằng partition chậm nhất)`, 'ok');
    }
    function render() {
      const { q, ask } = plan();
      const res = CARS.filter((c) => q.terms.every((t) => t === 'color:' + c.color || t === 'make:' + c.make)).map((c) => c.id);
      const gIdx = buildIndex(CARS);
      clear(grid);
      for (let p = 0; p < 4; p++) {
        const isAsk = asked.includes(p);
        const docs = CARS.filter((c) => docPart(c.id) === p);
        const idxBox = h('div', { class: 'idx' });
        if (mode === 'local') {
          const li = buildIndex(CARS, p);
          Object.keys(li).sort().forEach((t) => idxBox.appendChild(h('div', {}, h('span', { class: q.terms.includes(t) ? 'q' : '' }, t), ' → [' + li[t].join(', ') + ']')));
        } else {
          Object.keys(gIdx).filter((t) => termPart(t) === p).sort().forEach((t) => idxBox.appendChild(h('div', {}, h('span', { class: q.terms.includes(t) ? 'q' : '' }, t), ' → [' + gIdx[t].join(', ') + ']')));
        }
        grid.appendChild(h('div', { class: 'node' + (isAsk ? ' hit' : '') },
          h('b', 'Partition ' + p, h('small', isAsk && lat && lat[p] != null ? fmt(lat[p], 1) + ' ms' : 'ID ' + p * 500 + '–' + (p * 500 + 499))),
          h('div', { class: 'chips' }, docs.map((c) => h('span', { class: 'chip' + (res.includes(c.id) ? ' hitc' : '') }, '#' + c.id + ' ' + c.color + ' ' + c.make))),
          h('div', { class: 'lab-note', style: { marginTop: '6px', fontSize: '.68rem' } }, mode === 'local' ? 'Index cục bộ (chỉ document ở đây):' : 'Mảnh index toàn cục (' + TP_LABEL[p] + '):'),
          idxBox));
      }
      const hasRes = mode === 'local' ? [...new Set(res.map(docPart))] : ask;
      result.textContent = `Kết quả: ${res.length ? res.map((x) => '#' + x).join(', ') : '(không có)'}.` + (mode === 'local'
        ? ` Phải hỏi cả 4 partition dù chỉ ${hasRes.length} partition có xe khớp.`
        : q.terms.length > 1 ? ' Mỗi term một partition index; client giao (intersect) hai danh sách ID.' : ' Chỉ một partition index giữ toàn bộ danh sách ID cho term này.');
      stAsk.update(ask.length + '/4', ask.length === 1 ? 'ok' : ask.length === 4 ? 'warn' : 'accent');
      stHas.update(hasRes.length + '/4', '');
      const t = lat && asked.length === ask.length ? Math.max(...ask.map((p) => lat[p])) : null;
      stT.update(t != null ? fmt(t, 1) + ' ms' : '…', t != null && t > 20 ? 'bad' : '');
      const pv = p99(ask.length);
      stP99.update(fmt(pv, 1) + ' ms', pv > 20 ? 'bad' : 'ok', ask.length > 1 ? 'chờ partition chậm nhất trong ' + ask.length : '1 partition');
    }
    run(true);
  });

  // 7.8 Global index write path
  widget('global-write', (root) => {
    const cars = CARS.map((c) => ({ ...c }));
    const NEW_IDS = [457, 642, 1120, 1811, 77, 999, 1477, 1650, 333, 801];
    let mode = 'async', color = 'red', make = 'Toyota', delay = 1200, running = false, nid = 0;
    let applied = buildIndex(cars); // global index as currently visible
    let pending = []; // {term, id}
    let lastDoc = null;
    const sgM = seg({ label: 'Kiểu index', options: [{ value: 'local', label: 'Cục bộ' }, { value: 'async', label: 'Toàn cục, bất đồng bộ' }, { value: 'sync', label: 'Toàn cục, giao dịch phân tán' }], value: mode, onChange: (v) => { mode = v; render(); } });
    const cSel = selectCtl('Màu', Object.keys(VI_COLOR).map((k) => ({ value: k, label: k + ' (' + VI_COLOR[k] + ')' })), color, (v) => { color = v; render(); });
    const mSel = selectCtl('Hãng', ['Audi', 'Dodge', 'Ford', 'Honda', 'Toyota', 'Volvo'].map((k) => ({ value: k, label: k })), make, (v) => { make = v; render(); });
    const sl = slider({ label: 'Độ trễ lan truyền index', min: 200, max: 3000, step: 100, value: delay, format: (v) => fmt(v) + ' ms', onInput: (v) => { delay = v; } });
    const runBtn = button('Đăng tin và tìm ngay', () => run(false));
    const grid = h('div', { class: 'nodes' });
    const lg = log();
    const stW = stat('Partition phải ghi', ''), stWT = stat('Thời gian đến khi ghi được xác nhận', ''), stR = stat('Partition phải đọc', ''), stFresh = stat('Lần tìm ngay sau ghi', '');
    root.append(h('div', { class: 'controls' }, h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Kiểu index'), sgM.el)),
      h('div', { class: 'controls' }, cSel.el, mSel.el, sl.el), h('div', { class: 'btn-row' }, runBtn), grid, h('div', { class: 'stats' }, stW, stWT, stR, stFresh), lg,
      h('p', { class: 'lab-note' }, 'Mỗi lần ghi vào một partition mất khoảng 5 ms; giao dịch phân tán cần thêm một vòng xác nhận (two-phase commit, Chương 10). Số liệu minh hoạ.'));
    const visibleIds = (term) => (mode === 'local' ? cars.filter((c) => 'color:' + c.color === term || 'make:' + c.make === term).map((c) => c.id) : (applied[term] || []).slice());
    async function run(instant) {
      if (running) return;
      running = true; runBtn.disabled = true;
      const id = NEW_IDS[nid++ % NEW_IDS.length] + 2000 * Math.floor((nid - 1) / NEW_IDS.length) * 0; // giữ ID trong 0–1999
      const doc = { id: cars.some((c) => c.id === id) ? id + 1 : id, color, make };
      const terms = ['color:' + color, 'make:' + make];
      const dp = docPart(doc.id), tps = [...new Set(terms.map(termPart))];
      lastDoc = doc;
      lg.reset();
      const T = { t: 0 };
      const at = (txt, tone) => lg.add(`[${String(Math.round(T.t)).padStart(4, ' ')} ms] ${txt}`, tone);
      cars.push(doc);
      if (mode === 'local') {
        T.t += 5; at(`ghi #${doc.id} và index cục bộ vào P${dp} (cùng partition) → xác nhận`, 'ok');
        stW.update('1', 'ok', 'P' + dp); stWT.update('5 ms', 'ok');
      } else if (mode === 'sync') {
        const parts = [...new Set([dp, ...tps])];
        T.t += 5; at(`chuẩn bị: ghi #${doc.id} vào P${dp}, ${terms[0]} vào P${termPart(terms[0])}, ${terms[1]} vào P${termPart(terms[1])}`, 't');
        if (!instant) await sleep(250);
        T.t += 10; at('mọi partition đồng ý → commit cùng lúc', 'ok');
        terms.forEach((t) => { (applied[t] = applied[t] || []).push(doc.id); });
        stW.update(String(parts.length), parts.length > 1 ? 'warn' : 'ok', parts.map((p) => 'P' + p).join(', '));
        stWT.update('15 ms', 'warn', 'chờ partition chậm nhất + vòng commit');
      } else {
        T.t += 5; at(`ghi #${doc.id} vào P${dp} → xác nhận cho client ngay`, 'ok');
        terms.forEach((t) => pending.push({ term: t, id: doc.id }));
        at(`xếp hàng cập nhật ${terms.join(' (P' + termPart(terms[0]) + '), ')} (P${termPart(terms[1])})`, 'warn');
        const parts = [...new Set([dp, ...tps])];
        stW.update(String(parts.length), 'warn', '1 đồng bộ + ' + terms.length + ' bất đồng bộ');
        stWT.update('5 ms', 'ok', 'index chưa cập nhật');
      }
      if (!instant) { render(); await sleep(300); }
      // read immediately
      const q = 'color:' + color;
      const ids = visibleIds(q);
      const seen = ids.includes(doc.id);
      T.t += 1; at(`tìm ${q}: ${mode === 'local' ? 'scatter tới 4 partition' : 'hỏi P' + termPart(q)} → [${ids.join(', ')}]`, seen ? 'ok' : 'bad');
      if (!seen) at(`  không thấy #${doc.id}: index toàn cục chưa nhận cập nhật`, 'bad');
      stR.update(mode === 'local' ? '4' : '1', mode === 'local' ? 'warn' : 'ok');
      stFresh.update(seen ? 'thấy xe mới' : 'chưa thấy', seen ? 'ok' : 'bad');
      render();
      if (mode === 'async') {
        if (!instant) await sleep(delay);
        T.t += delay;
        pending.forEach((pd) => { (applied[pd.term] = applied[pd.term] || []).push(pd.id); });
        pending = [];
        at(`index toàn cục đã cập nhật (sau ${fmt(delay)} ms)`, 'acc');
        const ids2 = visibleIds(q);
        at(`tìm lại ${q} → [${ids2.join(', ')}]: đã thấy #${doc.id}`, 'ok');
        render();
      }
      running = false; runBtn.disabled = false;
    }
    function render() {
      clear(grid);
      const terms = ['color:' + color, 'make:' + make];
      const view = mode === 'local' ? null : applied;
      for (let p = 0; p < 4; p++) {
        const docs = cars.filter((c) => docPart(c.id) === p);
        const idx = h('div', { class: 'idx' });
        if (mode === 'local') {
          const li = buildIndex(cars, p);
          terms.forEach((t) => { if (li[t]) idx.appendChild(h('div', {}, h('span', { class: 'q' }, t), ' → [' + li[t].join(', ') + ']')); });
          if (!idx.childNodes.length) idx.appendChild(h('div', { class: 'lab-note' }, '(không có mục cho màu/hãng đã chọn)'));
        } else {
          terms.filter((t) => termPart(t) === p).forEach((t) => {
            const pend = pending.filter((x) => x.term === t).map((x) => x.id);
            idx.appendChild(h('div', {}, h('span', { class: 'q' }, t), ' → [' + (view[t] || []).join(', ') + ']', pend.length ? h('span', { class: 'pend pulse' }, ' + ' + pend.map((x) => '#' + x).join(', ') + ' đang chờ') : null));
          });
          if (!idx.childNodes.length) idx.appendChild(h('div', { class: 'lab-note' }, '(' + TP_LABEL[p] + ': không chứa term đã chọn)'));
        }
        const isDoc = lastDoc && docPart(lastDoc.id) === p;
        grid.appendChild(h('div', { class: 'node' + (isDoc ? ' newn' : '') }, h('b', 'Partition ' + p, h('small', 'ID ' + p * 500 + '–' + (p * 500 + 499))),
          h('div', { class: 'chips' }, docs.map((c) => h('span', { class: 'chip' + (lastDoc && c.id === lastDoc.id ? ' vio' : '') }, '#' + c.id + ' ' + c.color + ' ' + c.make))), idx));
      }
    }
    run(true);
  });

  // =====================================================================
  // 7.9 hash mod N vs fixed partitions
  widget('mod-n', (root) => {
    const r = rng(2024);
    const KEYS = [...Array(10000)].map(() => Math.floor(r() * TWO32));
    const NP = 1000;
    // fixed partitions: incremental steal assignment for 1..31 nodes
    const assigns = [];
    let own = new Array(NP).fill(0);
    assigns[1] = own.slice();
    for (let n = 2; n <= 31; n++) {
      own = own.slice();
      const cnt = new Array(n).fill(0); own.forEach((o) => cnt[o]++);
      const target = Math.floor(NP / n);
      for (let p = NP - 1; p >= 0 && cnt[n - 1] < target; p--) {
        const o = own[p];
        if (o !== n - 1 && cnt[o] > target) { cnt[o]--; own[p] = n - 1; cnt[n - 1]++; }
      }
      assigns[n] = own;
    }
    let N = 10, hv = 123456;
    const sl = slider({ label: 'Số node hiện tại N', min: 2, max: 30, value: N, format: (v) => v + ' → ' + (v + 1), onInput: (v) => { N = v; render(); } });
    const hin = h('input', { type: 'number', id: nextId('hv'), min: 0, step: 1 });
    hin.value = hv;
    hin.addEventListener('input', () => { hv = Math.max(0, Math.floor(+hin.value || 0)); render(); });
    const exTable = h('div', { class: 'table-wrap' });
    const gMod = h('div', { class: 'cells' }), gFix = h('div', { class: 'cells' });
    const stMod = stat('hash mod N: khoá phải chuyển', ''), stFix = stat('1.000 partition cố định', ''), stMin = stat('Tối thiểu cần thiết', '');
    root.append(h('div', { class: 'controls' }, sl.el, h('div', { class: 'ctl' }, h('label', { for: hin.id }, h('span', 'Thử một giá trị hash')), hin)), exTable,
      h('div', { class: 'lab-split' }, h('div', { class: 'box' }, h('h5', 'hash mod N (100 khoá mẫu)'), gMod), h('div', { class: 'box' }, h('h5', 'Partition cố định (100 khoá mẫu)'), gFix)),
      h('div', { class: 'stats' }, stMod, stFix, stMin),
      h('p', { class: 'lab-note' }, 'Đếm trên 10.000 khoá có hash ngẫu nhiên. “Partition cố định”: 1.000 partition, node mới lấy partition từ các node đang giữ nhiều hơn phần đều (7.10).'));
    function render() {
      let mMod = 0, mFix = 0;
      const a = assigns[N], b = assigns[N + 1];
      clear(gMod); clear(gFix);
      KEYS.forEach((k, i) => {
        const mv1 = k % N !== k % (N + 1), p = k % NP, mv2 = a[p] !== b[p];
        if (mv1) mMod++; if (mv2) mFix++;
        if (i < 100) { gMod.appendChild(h('i', { class: mv1 ? 'mv' : '', title: mv1 ? 'phải chuyển' : 'giữ nguyên' })); gFix.appendChild(h('i', { class: mv2 ? 'mv' : '' })); }
      });
      stMod.update(pct(mMod / KEYS.length), 'bad', fmt(mMod) + ' / 10.000 khoá');
      stFix.update(pct(mFix / KEYS.length), 'ok', fmt(mFix) + ' / 10.000 khoá');
      stMin.update(pct(1 / (N + 1)), 'accent', `1/${N + 1}: phần node mới phải nhận`);
      const t = h('table', { class: 'data' }, h('thead', h('tr', h('th', 'Số node'), h('th', 'Phép tính'), h('th', { class: 'num' }, 'Node chứa khoá'))),
        h('tbody', [N, N + 1, N + 2].map((n, i) => h('tr', { class: i === 0 ? '' : (hv % n !== hv % N ? 'hit' : '') }, h('td', String(n)), h('td', { class: 'mono' }, `${hv} mod ${n}`), h('td', { class: 'num' }, 'node ' + (hv % n))))));
      clear(exTable).appendChild(t);
    }
    render();
  });

  // =====================================================================
  // 7.10 Fixed number of partitions
  widget('fixed-parts', (root) => {
    let P = 20, nodes = [], owner = [], moved = new Set(), last = '', strong = false;
    function reset() {
      nodes = [1, 1, 1, 1]; owner = [...Array(P).keys()].map((p) => p % 4); moved = new Set(); last = '';
    }
    function targets() {
      const W = nodes.reduce((a, b) => a + b, 0);
      const raw = nodes.map((w) => (P * w) / W), base = raw.map(Math.floor);
      let left = P - base.reduce((a, b) => a + b, 0);
      raw.map((v, i) => [v - base[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).forEach(([, i]) => { if (left > 0) { base[i]++; left--; } });
      return base;
    }
    function rebalance() {
      const tg = targets();
      const cnt = nodes.map(() => 0); owner.forEach((o) => { if (o < nodes.length) cnt[o]++; });
      moved = new Set();
      // partitions on removed nodes are orphans
      const orphans = [];
      owner.forEach((o, p) => { if (o >= nodes.length) orphans.push(p); });
      // take from surplus nodes (highest partition numbers first)
      for (let p = P - 1; p >= 0; p--) { const o = owner[p]; if (o < nodes.length && cnt[o] > tg[o]) { cnt[o]--; orphans.push(p); } }
      orphans.sort((a, b) => a - b).forEach((p) => {
        let best = -1, gap = 0;
        nodes.forEach((_, i) => { const g = tg[i] - cnt[i]; if (g > gap) { gap = g; best = i; } });
        if (best < 0) best = 0;
        if (owner[p] !== best) moved.add(p);
        owner[p] = best; cnt[best]++;
      });
    }
    const sgP = seg({ label: 'Số partition', options: [{ value: 12, label: '12' }, { value: 20, label: '20' }, { value: 40, label: '40' }], value: P, onChange: (v) => { P = v; reset(); render(); } });
    const cb = checkbox('Node thêm tiếp theo mạnh gấp đôi', false, (v) => { strong = v; });
    const addBtn = button('Thêm node', () => { if (nodes.length < P) { nodes.push(strong ? 2 : 1); rebalance(); last = 'add'; render(); } });
    const rmBtn = button('Bớt node cuối', () => { if (nodes.length > 1) { nodes.pop(); rebalance(); last = 'rm'; render(); } }, 'ghost');
    const resetBtn = button('Đặt lại (4 node)', () => { reset(); render(); }, 'ghost');
    const grid = h('div', { class: 'nodes' });
    const stMv = stat('Partition chuyển ở bước vừa rồi', ''), stData = stat('Dữ liệu di chuyển', ''), stMaxN = stat('Số node tối đa', ''), stPer = stat('Partition mỗi node', '');
    const note = h('p', { class: 'lab-note' });
    root.append(h('div', { class: 'controls' }, h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Số partition (cố định từ đầu)'), sgP.el), h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Phần cứng'), cb.el)),
      h('div', { class: 'btn-row' }, addBtn, rmBtn, resetBtn), grid, h('div', { class: 'stats' }, stMv, stData, stMaxN, stPer), note);
    function render() {
      clear(grid);
      const cnt = nodes.map(() => 0); owner.forEach((o) => cnt[o]++);
      nodes.forEach((w, i) => {
        const ps = owner.map((o, p) => [o, p]).filter(([o]) => o === i).map(([, p]) => p);
        grid.appendChild(h('div', { class: 'node' + (last === 'add' && i === nodes.length - 1 ? ' newn' : '') },
          h('b', 'Node ' + i, h('small', (w > 1 ? 'mạnh ×2 · ' : '') + ps.length + ' partition')),
          h('div', { class: 'chips' }, ps.map((p) => h('span', { class: 'chip ' + (moved.has(p) ? 'moved' : 'foll') }, 'p' + p)))));
      });
      stMv.update(last ? String(moved.size) : '—', last ? 'warn' : '', last ? 'trên ' + P + ' partition' : 'chưa thay đổi');
      stData.update(last ? pct(moved.size / P, 0) : '—', last ? 'accent' : '', 'khoá → partition không đổi');
      stMaxN.update(String(P), '', 'mỗi node ít nhất 1 partition');
      stPer.update(Math.min(...cnt) + '–' + Math.max(...cnt), '');
      addBtn.disabled = nodes.length >= P; rmBtn.disabled = nodes.length <= 1;
      note.textContent = nodes.length >= P
        ? `Đã đạt ${P} node: mỗi node một partition, không thể thêm node nữa. Số partition chọn lúc đầu là giới hạn trên của cụm.`
        : last === 'add' ? `Node mới lấy ${moved.size} partition từ các node cũ (viền vàng). Chỉ partition nguyên vẹn được chuyển; trong lúc chuyển, đọc ghi vẫn đi theo phân công cũ.`
          : last === 'rm' ? `Node bị bớt trả ${moved.size} partition cho các node còn lại.` : 'Bấm “Thêm node” để xem node mới lấy partition từ mỗi node cũ.';
    }
    reset(); nodes.push(1); rebalance(); last = 'add'; render();
  });

  // =====================================================================
  // 7.11 Dynamic partitioning (split / merge)
  widget('dyn-split', (root) => {
    const NB = 104, SPLIT = 10, MERGE = 2, NN = 3;
    const SUB = ['', 'g', 'n', 't'];
    const bLabel = (b) => String.fromCharCode(97 + Math.floor(b / 4)) + SUB[b % 4];
    let sizes, parts, presplit = false;
    const r = rng(5);
    const lg = log();
    function reset() {
      sizes = new Array(NB).fill(0);
      parts = presplit ? [{ lo: 0, hi: 35, node: 0 }, { lo: 35, hi: 70, node: 1 }, { lo: 70, hi: NB, node: 2 }] : [{ lo: 0, hi: NB, node: 0 }];
      lg.reset();
      lg.add(presplit ? 'Cụm rỗng, pre-split thành 3 partition (a–i, j–r, s–z) trên 3 node.' : 'Cụm rỗng: chỉ có 1 partition (toàn bộ dải khoá) trên Node 0.', 't');
    }
    const psize = (p) => { let t = 0; for (let b = p.lo; b < p.hi; b++) t += sizes[b]; return t; };
    const nodeLoad = () => { const l = new Array(NN).fill(0); parts.forEach((p) => { l[p.node] += psize(p); }); return l; };
    const rangeLab = (p) => bLabel(p.lo) + '–' + (p.hi >= NB ? 'z' : bLabel(p.hi));
    function settle() {
      let changed = true;
      while (changed) {
        changed = false;
        for (let i = 0; i < parts.length; i++) {
          const p = parts[i], sz = psize(p);
          if (sz > SPLIT && p.hi - p.lo > 1) {
            let acc = 0, cut = p.lo + 1;
            for (let b = p.lo; b < p.hi; b++) { acc += sizes[b]; if (acc >= sz / 2) { cut = clamp(b + 1, p.lo + 1, p.hi - 1); break; } }
            const right = { lo: cut, hi: p.hi, node: p.node };
            p.hi = cut;
            const load = nodeLoad();
            let best = 0; load.forEach((v, n) => { if (v < load[best]) best = n; });
            right.node = best;
            parts.splice(i + 1, 0, right);
            lg.add(`Tách ${rangeLab({ lo: p.lo, hi: right.hi })} (${fmt(sz, 1)} GB) tại “${bLabel(cut)}” → ${rangeLab(p)} ${fmt(psize(p), 1)} GB + ${rangeLab(right)} ${fmt(psize(right), 1)} GB` + (best !== p.node ? `; nửa phải chuyển sang Node ${best}` : ''), 'acc');
            changed = true; break;
          }
        }
        if (changed) continue;
        for (let i = 0; i < parts.length - 1; i++) {
          const a = parts[i], b = parts[i + 1], sa = psize(a), sb = psize(b);
          if ((sa < MERGE || sb < MERGE) && sa + sb < SPLIT / 2 && parts.length > (presplit ? 3 : 1)) {
            lg.add(`Gộp ${rangeLab(a)} (${fmt(sa, 1)} GB) với ${rangeLab(b)} (${fmt(sb, 1)} GB)`, 'warn');
            a.hi = b.hi; parts.splice(i + 1, 1);
            changed = true; break;
          }
        }
      }
    }
    let lastWrite = null;
    function write(gb, lo, hi, label) {
      const before = parts.map((p) => ({ ...p }));
      const w = [];
      for (let b = lo; b < hi; b++) w.push(0.6 + r() * 0.8);
      const tw = w.reduce((a, b) => a + b, 0);
      const perNode = new Array(NN).fill(0);
      for (let b = lo; b < hi; b++) {
        const add = (gb * w[b - lo]) / tw;
        sizes[b] += add;
        const p = before.find((x) => b >= x.lo && b < x.hi);
        perNode[p.node] += add;
      }
      lastWrite = perNode;
      lg.add(label + ': ' + perNode.map((v, n) => `Node ${n} nhận ${fmt(v, 1)} GB`).join(', '), perNode.filter((v) => v > 0).length === 1 ? 'bad' : 't');
      settle();
      render();
    }
    const cb = checkbox('Pre-splitting khi bắt đầu lại', false, (v) => { presplit = v; });
    const viz = h('div', { class: 'viz' });
    const grid = h('div', { class: 'nodes' });
    const stN = stat('Số partition', ''), stBig = stat('Partition lớn nhất', ''), stTot = stat('Tổng dữ liệu', ''), stW = stat('Node nhận lượng ghi lần vừa rồi', '');
    root.append(
      h('div', { class: 'btn-row' },
        button('Ghi 8 GB, khoá rải đều', () => write(8, 0, NB, 'Ghi 8 GB rải đều')),
        button('Ghi 8 GB vào khoá m–n', () => write(8, 48, 56, 'Ghi 8 GB vào m–n'), 'ghost'),
        button('Xoá 60% dữ liệu', () => { sizes = sizes.map((v) => v * 0.4); lastWrite = null; lg.add('Xoá 60% dữ liệu ở mọi dải khoá', 'warn'); settle(); render(); }, 'ghost'),
        button('Bắt đầu lại', () => { reset(); lastWrite = null; render(); }, 'ghost')),
      h('div', { class: 'controls' }, h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Tuỳ chọn'), cb.el)),
      viz, grid, h('div', { class: 'stats' }, stN, stBig, stTot, stW), lg,
      h('p', { class: 'lab-note' }, `Ngưỡng tách ${SPLIT} GB như mặc định của HBase; gộp khi một partition dưới ${MERGE} GB và tổng hai partition kề nhau dưới ${SPLIT / 2} GB (số liệu minh hoạ). Nửa mới sau khi tách được chuyển sang node đang giữ ít dữ liệu nhất.`));
    function render() {
      const W = 600, H = 210, L = 44, R = 10, T = 22, B = 30;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Kích thước dữ liệu theo dải khoá và ranh giới partition' });
      const mx = Math.max(0.5, ...sizes);
      const bw = (W - L - R) / NB;
      const yOf = (v) => H - B - (v / mx) * (H - T - B);
      [0, mx / 2, mx].forEach((v) => { svg.appendChild(s('line', { x1: L, x2: W - R, y1: yOf(v), y2: yOf(v), class: 'grid' })); svg.appendChild(s('text', { x: L - 4, y: yOf(v) + 4, 'text-anchor': 'end' }, fmt(v, 1))); });
      parts.forEach((p) => {
        for (let b = p.lo; b < p.hi; b++) if (sizes[b] > 0) svg.appendChild(s('rect', { x: L + b * bw + 0.5, y: yOf(sizes[b]), width: Math.max(1, bw - 1), height: H - B - yOf(sizes[b]), class: NODE_F[p.node] }));
        const x = L + p.lo * bw;
        svg.appendChild(s('line', { x1: x, x2: x, y1: T - 8, y2: H - B, class: 's-ink f-none', 'stroke-width': 1.2 }));
      });
      svg.appendChild(s('line', { x1: W - R, x2: W - R, y1: T - 8, y2: H - B, class: 's-ink f-none', 'stroke-width': 1.2 }));
      svg.appendChild(s('line', { x1: L, x2: W - R, y1: H - B, y2: H - B, class: 'axis' }));
      for (let i = 0; i < 26; i += 2) svg.appendChild(s('text', { x: L + (i * 4 + 2) * bw, y: H - B + 14, 'text-anchor': 'middle' }, String.fromCharCode(97 + i)));
      svg.appendChild(s('text', { x: L, y: 12, class: 'lbl-strong' }, 'GB theo dải khoá; vạch đứng = ranh giới partition; màu = node'));
      svg.appendChild(s('text', { x: (L + W) / 2, y: H - 4, 'text-anchor': 'middle' }, 'khoá (a → z)'));
      clear(viz).appendChild(svg);
      clear(grid);
      const load = nodeLoad();
      for (let n = 0; n < NN; n++) {
        const ps = parts.filter((p) => p.node === n);
        grid.appendChild(h('div', { class: 'node' + (lastWrite && lastWrite[n] > 0 ? ' hit' : ' dim') },
          h('b', h('span', { style: { color: 'var(' + NODE_VARS[n] + ')' } }, '■ '), 'Node ' + n, h('small', fmt(load[n], 1) + ' GB')),
          h('div', { class: 'chips' }, ps.length ? ps.map((p) => h('span', { class: 'chip foll' }, rangeLab(p) + ' · ' + fmt(psize(p), 1) + ' GB')) : h('span', { class: 'lab-note' }, 'chưa có partition'))));
      }
      const tot = sizes.reduce((a, b) => a + b, 0), big = Math.max(0, ...parts.map(psize));
      stN.update(String(parts.length), 'accent');
      stBig.update(fmt(big, 1) + ' GB', big > SPLIT ? 'bad' : 'ok', 'ngưỡng ' + SPLIT + ' GB');
      stTot.update(fmt(tot, 1) + ' GB');
      const busy = lastWrite ? lastWrite.filter((v) => v > 0.01).length : 0;
      stW.update(lastWrite ? busy + '/' + NN : '—', lastWrite ? (busy === 1 ? 'bad' : 'ok') : '', lastWrite && busy === 1 ? 'các node khác ngồi chơi' : '');
    }
    reset();
    write(8, 0, NB, 'Ghi 8 GB rải đều');
    write(8, 0, NB, 'Ghi 8 GB rải đều');
    write(8, 0, NB, 'Ghi 8 GB rải đều');
  });

  // =====================================================================
  // 7.12 Strategy comparison: partition size vs dataset size
  widget('strategy-compare', (root) => {
    const VALS = [10, 30, 100, 300, 1000, 3000, 10000, 30000, 100000]; // GB
    let di = 4, grow = true;
    const nodesFor = (d) => (grow ? Math.max(3, Math.ceil(d / 1000)) : 10);
    const STRATS = [
      { k: 'fixed', name: 'Số partition cố định (1.000)', cls: 's-accent', fcls: 'f-accent', count: () => 1000 },
      { k: 'dyn', name: 'Phân vùng động (tách ở 10 GB)', cls: 's-violet', fcls: 'f-violet', count: (d) => Math.max(1, Math.round(d / 7.5)) },
      { k: 'prop', name: 'Tỉ lệ với node (256 mỗi node)', cls: 's-warn', fcls: 'f-warn', count: (d) => 256 * nodesFor(d) },
    ];
    const LO = 0.5, HI = 20; // vùng "vừa phải" minh hoạ (GB)
    const sl = slider({ label: 'Khối lượng dữ liệu', min: 0, max: VALS.length - 1, value: di, format: (v) => fmtSize(VALS[v]), onInput: (v) => { di = v; render(); } });
    const cb = checkbox('Thêm node khi dữ liệu tăng (≈ 1 TB mỗi node, tối thiểu 3)', true, (v) => { grow = v; render(); });
    const viz = h('div', { class: 'viz' });
    const tbl = h('div', { class: 'table-wrap' });
    root.append(h('div', { class: 'controls' }, sl.el, h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Cụm'), cb.el)), viz, tbl);
    function render() {
      const D = VALS[di];
      const f = logFrame({ x0: 10, x1: 100000, y0: 0.001, y1: 1000, aria: 'Kích thước partition theo khối lượng dữ liệu',
        xticks: [[10, '10 GB'], [100, '100 GB'], [1000, '1 TB'], [10000, '10 TB'], [100000, '100 TB']],
        yticks: [[0.001, '1 MB'], [0.01, '10 MB'], [0.1, '100 MB'], [1, '1 GB'], [10, '10 GB'], [100, '100 GB'], [1000, '1 TB']],
        xlabel: 'Tổng dữ liệu (thang log)', ylabel: 'Kích thước partition' });
      const svg = f.svg;
      svg.insertBefore(s('rect', { x: f.L, y: f.y(HI), width: f.W - f.L - f.R, height: f.y(LO) - f.y(HI), class: 'f-ok', opacity: 0.12 }), svg.firstChild);
      svg.appendChild(s('text', { x: f.W - f.R - 4, y: f.y(HI) + 12, 'text-anchor': 'end' }, 'vùng vừa phải (minh hoạ)'));
      STRATS.forEach((st) => {
        const pts = [];
        for (let i = 0; i <= 80; i++) { const d = Math.pow(10, 1 + (4 * i) / 80); pts.push([f.x(d), f.y(clamp(d / st.count(d), 0.001, 1000))]); }
        svg.appendChild(s('path', { d: poly(pts), class: 'f-none ' + st.cls, 'stroke-width': 2.5 }));
        svg.appendChild(s('circle', { cx: f.x(D), cy: f.y(clamp(D / st.count(D), 0.001, 1000)), r: 5, class: st.fcls }));
      });
      svg.appendChild(s('line', { x1: f.x(D), x2: f.x(D), y1: f.T, y2: f.H - f.B, class: 's-ink3 f-none dash' }));
      // legend
      STRATS.forEach((st, i) => {
        const y = f.T + 8 + i * 15;
        svg.appendChild(s('line', { x1: f.L + 10, x2: f.L + 30, y1: y, y2: y, class: 'f-none ' + st.cls, 'stroke-width': 3 }));
        svg.appendChild(s('text', { x: f.L + 36, y: y + 4 }, st.name));
      });
      clear(viz).appendChild(svg);
      const N = nodesFor(D);
      const verdict = (sz) => sz < LO ? h('span', { class: 'pill warn' }, 'quá nhỏ, tốn chi phí quản lý') : sz > HI ? h('span', { class: 'pill bad' }, 'quá lớn, rebalance đắt') : h('span', { class: 'pill ok' }, 'vừa phải');
      clear(tbl).appendChild(h('table', { class: 'data' },
        h('thead', h('tr', h('th', 'Chiến lược'), h('th', { class: 'num' }, 'Số partition'), h('th', { class: 'num' }, 'Kích thước TB'), h('th', 'Nhận xét'))),
        h('tbody', STRATS.map((st) => { const c = st.count(D), sz = D / c; return h('tr', {}, h('td', st.name), h('td', { class: 'num' }, fmt(c)), h('td', { class: 'num' }, fmtSize(sz)), h('td', verdict(sz))); }),
          h('tr', {}, h('td', { colspan: '4', class: 'lab-note' }, `${fmtSize(D)} dữ liệu, ${N} node. Số partition cố định giả định cụm 10 node lúc thiết lập (≈ 100 partition mỗi node như ví dụ của sách).`)))));
    }
    render();
  });

  // =====================================================================
  // 7.13 Automatic vs manual rebalancing (cascading failure)
  widget('auto-rebalance', (root) => {
    const NODES = ['A', 'B', 'C', 'D'], BASE = [60, 68, 65, 62], TICKS = 11, SLOW = 95;
    let policy = 'auto', running = false;
    function simulate(pol) {
      const declared = new Array(4).fill(false), slowFor = new Array(4).fill(0);
      const rebal = []; // {from, until}
      const hist = [], events = [];
      let moved = 0, reviewed = false;
      for (let t = 0; t < TICKS; t++) {
        const serving = [0, 1, 2, 3].filter((i) => !declared[i]);
        const totalReq = BASE.reduce((a, b) => a + b, 0);
        const baseServ = serving.reduce((a, i) => a + BASE[i], 0) || 1;
        const active = rebal.filter((x) => t >= x.start && t < x.start + 3);
        const load = [0, 1, 2, 3].map((i) => {
          let l = 0;
          if (!declared[i]) l += (BASE[i] / baseServ) * totalReq;
          if (i === 2 && t >= 1 && t <= 5) l += 32; // đợt tăng tải tạm thời ở node C
          active.forEach((x) => { if (x.from === i) l += 20; else if (!declared[i]) l += 12; });
          return Math.min(100, l);
        });
        hist.push({ load, declared: declared.slice() });
        if (!serving.length) { events.push([t, 'Không còn node nào được coi là sống: cụm ngừng phục vụ.', 'bad']); break; }
        load.forEach((l, i) => { slowFor[i] = !declared[i] && l >= SLOW ? slowFor[i] + 1 : 0; });
        if (t === 1) events.push([t, 'Node C nhận một đợt tăng tải, phản hồi chậm hơn timeout.', 'warn']);
        if (pol === 'auto') {
          const cand = [0, 1, 2, 3].filter((i) => slowFor[i] >= 2).sort((a, b) => load[b] - load[a])[0];
          if (cand != null) {
            declared[cand] = true; moved += 5;
            rebal.push({ from: cand, start: t + 1 });
            events.push([t, `Failure detector: Node ${NODES[cand]} không trả lời kịp 2 lần → coi là chết. Tự động chuyển 5 partition của ${NODES[cand]} sang các node còn lại.`, 'bad']);
          }
        } else {
          if (slowFor[2] === 2 && !reviewed) events.push([t, 'Cảnh báo: Node C chậm. Hệ thống đề xuất chuyển 5 partition của C sang A, B, D và chờ quản trị viên duyệt.', 'warn']);
          if (t === 3 && !reviewed) { reviewed = true; events.push([t, 'Quản trị viên xem: C vẫn sống, chỉ quá tải tạm thời. Không duyệt kế hoạch, tiếp tục theo dõi.', 'acc']); }
          if (t === 6) events.push([t, 'Đợt tăng tải qua đi, Node C trở lại bình thường. Không dữ liệu nào bị di chuyển.', 'ok']);
        }
      }
      return { hist, events, moved, declared: hist[hist.length - 1].declared };
    }
    const sg = seg({ label: 'Chính sách', options: [{ value: 'auto', label: 'Tự động hoàn toàn' }, { value: 'manual', label: 'Đề xuất, người duyệt' }], value: policy, onChange: (v) => { policy = v; play(true); } });
    const runBtn = button('Chạy kịch bản', () => play(false));
    const viz = h('div', { class: 'viz' });
    const lg = log();
    const stDead = stat('Node bị coi là chết', ''), stMv = stat('Partition bị di chuyển', ''), stEnd = stat('Trạng thái cuối', '');
    root.append(h('div', { class: 'controls' }, h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Chính sách rebalancing'), sg.el)), h('div', { class: 'btn-row' }, runBtn),
      viz, h('div', { class: 'stats' }, stDead, stMv, stEnd), lg,
      h('p', { class: 'lab-note' }, 'Mỗi node giữ 5 partition. Node được coi là chết thì client dồn request của nó sang node khác; trong lúc rebalance, node gửi dữ liệu tốn thêm 20% tải, node nhận thêm 12%. Số liệu minh hoạ.'));
    function draw(sim, upto) {
      const W = 600, H = 230, L = 40, R = 14, T = 14, B = 34;
      const x = (t) => L + (t / (TICKS - 1)) * (W - L - R), y = (v) => H - B - (v / 100) * (H - T - B);
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Tải của bốn node theo thời gian' });
      [0, 25, 50, 75, 100].forEach((v) => { svg.appendChild(s('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'grid' })); svg.appendChild(s('text', { x: L - 5, y: y(v) + 4, 'text-anchor': 'end' }, v + '%')); });
      svg.appendChild(s('line', { x1: L, x2: W - R, y1: y(SLOW), y2: y(SLOW), class: 's-bad f-none dash' }));
      svg.appendChild(s('text', { x: W - R, y: y(SLOW) - 4, 'text-anchor': 'end' }, 'ngưỡng chậm (timeout)'));
      for (let t = 0; t < TICKS; t++) svg.appendChild(s('text', { x: x(t), y: H - B + 15, 'text-anchor': 'middle' }, 't' + t));
      svg.appendChild(s('text', { x: (L + W) / 2, y: H - 3, 'text-anchor': 'middle' }, 'thời gian (bước)'));
      const hs = sim.hist.slice(0, upto + 1);
      [0, 1, 2, 3].forEach((i) => {
        svg.appendChild(s('path', { d: poly(hs.map((st, t) => [x(t), y(st.load[i])])), class: 'f-none ' + NODE_S[i], 'stroke-width': 2.5 }));
        hs.forEach((st, t) => { if (st.declared[i] && (t === 0 || !hs[t - 1].declared[i])) svg.appendChild(s('text', { x: x(t), y: y(st.load[i]) - 6, 'text-anchor': 'middle', class: 'lbl-strong' }, '✕')); });
        const lt = hs[hs.length - 1];
        svg.appendChild(s('text', { x: x(hs.length - 1) + 6, y: y(lt.load[i]) + 4 + (i - 1.5) * 3, class: 'lbl-strong' }, NODES[i]));
      });
      [0, 1, 2, 3].forEach((i) => { svg.appendChild(s('rect', { x: L + 8 + i * 70, y: T + 2, width: 12, height: 4, class: NODE_F[i] })); svg.appendChild(s('text', { x: L + 24 + i * 70, y: T + 8 }, 'Node ' + NODES[i])); });
      clear(viz).appendChild(svg);
    }
    async function play(instant) {
      if (running) return;
      running = true; runBtn.disabled = true;
      const sim = simulate(policy);
      lg.reset();
      for (let t = 0; t < sim.hist.length; t++) {
        draw(sim, t);
        sim.events.filter((e) => e[0] === t).forEach((e) => lg.add(`t${e[0]}: ${e[1]}`, e[2]));
        if (!instant) await sleep(380);
      }
      const nd = sim.declared.filter(Boolean).length;
      stDead.update(nd + '/4', nd ? 'bad' : 'ok', nd ? 'dù chỉ C thực sự có vấn đề, và chỉ tạm thời' : '');
      stMv.update(String(sim.moved), sim.moved ? 'bad' : 'ok');
      stEnd.update(nd >= 4 || sim.hist.length < TICKS ? 'cụm sập' : nd ? 'xuống cấp' : 'bình thường', nd >= 3 ? 'bad' : nd ? 'warn' : 'ok', nd >= 3 ? 'lỗi dây chuyền' : '');
      running = false; runBtn.disabled = false;
    }
    play(true);
  });

  // =====================================================================
  // 7.14 Request routing
  widget('routing', (root) => {
    const NODES = ['A', 'B', 'C', 'D'], NP = 8;
    let approach = 'tier', key = 'foo', stale = false, rr = 0, running = false;
    let zk = [...Array(NP).keys()].map((p) => p % 4);
    let routerMap = zk.slice(), clientMap = zk.slice(), gossipMap = zk.slice();
    const partOf = (k) => hashPart(fnv(k), NP);
    const sg = seg({ label: 'Cách định tuyến', options: [{ value: 'any', label: '1 · Node bất kỳ' }, { value: 'tier', label: '2 · Tầng định tuyến' }, { value: 'client', label: '3 · Client biết partition' }], value: approach, onChange: (v) => { approach = v; send(true); } });
    const tx = textCtl('Khoá', key, (v) => { key = v.trim() || 'foo'; render([]); });
    const sendBtn = button('Gửi request', () => send(false));
    const moveBtn = button('Chuyển partition của khoá này sang node khác', () => {
      const p = partOf(key), from = zk[p], to = (from + 1) % 4;
      zk[p] = to;
      lg.reset();
      lg.add(`Rebalancing: P${p} chuyển từ Node ${NODES[from]} sang Node ${NODES[to]}. ZooKeeper cập nhật bản đồ chính thức.`, 'acc');
      if (!stale) {
        routerMap[p] = to; clientMap[p] = to; gossipMap[p] = to;
        lg.add(approach === 'any' ? 'Gossip lan truyền thay đổi tới mọi node.' : `ZooKeeper thông báo cho ${approach === 'tier' ? 'tầng định tuyến' : 'client'}; bản đồ của họ đã mới.`, 'ok');
      } else lg.add('Thông báo bị trễ: bên định tuyến vẫn giữ bản đồ cũ.', 'warn');
      render([]);
    }, 'ghost');
    const cb = checkbox('Thông báo bị trễ (bên định tuyến giữ bản đồ cũ)', false, (v) => { stale = v; });
    const grid = h('div', { class: 'route-grid' });
    const path = h('div', { class: 'path' });
    const lg = log();
    const stHops = stat('Số bước mạng', ''), stWho = stat('Ai quyết định định tuyến', ''), stDep = stat('Phụ thuộc thêm', '');
    root.append(h('div', { class: 'controls' }, h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Cách định tuyến (Hình 6-7)'), sg.el), tx.el),
      h('div', { class: 'btn-row' }, sendBtn, moveBtn), h('div', { class: 'controls' }, h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Sự cố'), cb.el)),
      grid, h('div', { class: 'box' }, h('h5', 'Đường đi của request'), path), h('div', { class: 'stats' }, stHops, stWho, stDep), lg);
    const mapTxt = (m, p) => m.map((n, i) => (i === p ? '[' : '') + 'P' + i + '→' + NODES[n] + (i === p ? ']' : '')).join(' ');
    function render(lit, bad) {
      const p = partOf(key), on = (id) => lit.includes(id) ? (bad && bad.includes(id) ? ' bad' : ' on') : '';
      clear(grid);
      const actor = (id, title, sub, extra) => h('div', { class: 'actor' + on(id) + (extra || '') }, h('b', title), sub ? h('div', { class: 'map' }, sub) : null);
      const c1 = h('div', { class: 'col' }, h('h5', 'Client'),
        actor('client', 'Client', approach === 'client' ? 'bản đồ: ' + mapTxt(clientMap, p) : 'chỉ biết địa chỉ ' + (approach === 'tier' ? 'tầng định tuyến' : 'load balancer') + ' (qua DNS)'));
      const c2 = h('div', { class: 'col' }, h('h5', approach === 'any' ? 'Load balancer' : approach === 'tier' ? 'Tầng định tuyến' : 'Điều phối'),
        approach === 'any' ? actor('lb', 'Round-robin', 'không biết partition') : null,
        approach === 'tier' ? actor('tier', 'Routing tier', 'bản đồ: ' + mapTxt(routerMap, p)) : null,
        approach === 'any' ? actor('zk', 'Gossip giữa các node', 'mỗi node biết: ' + mapTxt(gossipMap, p)) : actor('zk', 'ZooKeeper', 'chính thức: ' + mapTxt(zk, p)));
      const c3 = h('div', { class: 'col' }, h('h5', 'Các node'), NODES.map((n, i) => actor('n' + i, 'Node ' + n, zk.map((o, j) => [o, j]).filter(([o]) => o === i).map(([, j]) => (j === p ? '[P' + j + ']' : 'P' + j)).join(' '))));
      grid.append(c1, c2, c3);
      stWho.update(approach === 'any' ? 'node nhận request' : approach === 'tier' ? 'tầng định tuyến' : 'client', '');
      stDep.update(approach === 'any' ? 'gossip trong node' : 'ZooKeeper', '', approach === 'any' ? 'kiểu Cassandra, Riak' : approach === 'tier' ? 'kiểu Espresso/Helix, mongos' : 'client phức tạp hơn');
    }
    async function send(instant) {
      if (running) return;
      running = true; sendBtn.disabled = true; moveBtn.disabled = true;
      const p = partOf(key), owner = zk[p];
      const steps = []; // [actorId, label, isBad]
      const hv = fnv(key);
      const say = [];
      say.push([`“${key}”: hash ${hex(hv)} → P${p}; ZooKeeper nói P${p} ở Node ${NODES[owner]}.`, 't']);
      if (approach === 'any') {
        const first = rr++ % 4;
        steps.push(['client', 'Client'], ['lb', 'load balancer'], ['n' + first, 'Node ' + NODES[first]]);
        if (first === owner) say.push([`Node ${NODES[first]} tình cờ giữ P${p}, xử lý luôn.`, 'ok']);
        else {
          const guess = gossipMap[p];
          if (guess !== owner) {
            steps.push(['n' + guess, 'Node ' + NODES[guess] + ' (cũ)', true]);
            say.push([`Node ${NODES[first]} theo gossip cũ chuyển tới Node ${NODES[guess]}; node này đã giao P${p} nên chuyển tiếp tới Node ${NODES[owner]}.`, 'warn']);
            gossipMap[p] = owner;
          } else say.push([`Node ${NODES[first]} không giữ P${p}, chuyển tiếp tới Node ${NODES[owner]} rồi trả kết quả về.`, 'acc']);
          if (guess !== owner || first !== owner) steps.push(['n' + owner, 'Node ' + NODES[owner]]);
        }
      } else {
        const map = approach === 'tier' ? routerMap : clientMap;
        steps.push(['client', 'Client']);
        if (approach === 'tier') steps.push(['tier', 'routing tier']);
        if (map[p] !== owner) {
          steps.push(['n' + map[p], 'Node ' + NODES[map[p]] + ' (cũ)', true]);
          say.push([`Bản đồ cũ trỏ P${p} tới Node ${NODES[map[p]]}: node này từ chối (“không còn giữ P${p}”).`, 'bad']);
          steps.push(['zk', 'hỏi lại ZooKeeper']);
          say.push(['Bên định tuyến đọc lại bản đồ từ ZooKeeper và gửi lại.', 'warn']);
          map[p] = owner;
        }
        steps.push(['n' + owner, 'Node ' + NODES[owner]]);
        say.push([`Node ${NODES[owner]} giữ P${p}, xử lý và trả kết quả.`, 'ok']);
      }
      if (!instant) lg.reset();
      else lg.reset();
      say.forEach(([t, tone]) => lg.add(t, tone));
      clear(path);
      const lit = [], bad = [];
      for (let i = 0; i < steps.length; i++) {
        const [id, lab, isBad] = steps[i];
        lit.push(id); if (isBad) bad.push(id);
        if (i) path.appendChild(h('span', { class: 'arrow' }, '→'));
        path.appendChild(h('span', { class: 'pill ' + (isBad ? 'bad' : i === steps.length - 1 ? 'ok' : 'accent') }, lab));
        if (!instant) { render([id], isBad ? [id] : []); await sleep(320); }
      }
      render(lit, bad);
      const hops = steps.length - 1;
      stHops.update(String(hops), hops <= 1 ? 'ok' : hops <= 2 ? 'accent' : 'warn', 'chưa tính đường trả lời');
      running = false; sendBtn.disabled = false; moveBtn.disabled = false;
    }
    render([]);
    send(true);
  });

  // =====================================================================
  // 7.15 Parallel query execution (MPP)
  widget('mpp', (root) => {
    const D = 1000; // GB, 1 GB/s mỗi node
    const stages = (n) => [
      { k: 'Quét và lọc', t: D / n, tone: 'accent' },
      { k: 'Tổng hợp cục bộ', t: (0.1 * D) / n, tone: 'violet' },
      { k: 'Shuffle theo vùng', t: 1 + 0.15 * n, tone: 'warn' },
      { k: 'Điều phối, khởi động', t: 0.5 + 0.05 * n, tone: 'mark' },
      { k: 'Gộp cuối', t: 1, tone: 'ok' },
    ];
    const total = (n) => stages(n).reduce((a, x) => a + x.t, 0);
    let N = 8;
    const sl = slider({ label: 'Số node', min: 0, max: 7, value: 3, format: (v) => String(Math.pow(2, v)), onInput: (v) => { N = Math.pow(2, v); render(); } });
    const bars = h('div', { class: 'bars' });
    const viz = h('div', { class: 'viz' });
    const stT = stat('Thời gian truy vấn', ''), stS = stat('Tăng tốc so với 1 node', ''), stE = stat('Hiệu suất (tăng tốc / N)', '');
    root.append(h('div', { class: 'controls' }, sl.el), bars, h('div', { class: 'stats' }, stT, stS, stE), viz,
      h('p', { class: 'lab-note' }, 'Giả định: 1 TB dữ liệu, mỗi node quét 1 GB/s; shuffle và điều phối tốn thêm theo số node. Số liệu minh hoạ.'));
    function render() {
      const st = stages(N), tot = total(N), t1 = total(1);
      barRows(bars, st.map((x) => ({ label: x.k, value: x.t, max: tot, tone: x.tone, text: fmt(x.t, 1) + ' s' })));
      const sp = t1 / tot;
      stT.update(fmt(tot, 1) + ' s', '', N + ' node');
      stS.update('×' + fmt(sp, 1), 'accent', 'lý tưởng ×' + N);
      stE.update(pct(sp / N, 0), sp / N > 0.7 ? 'ok' : sp / N > 0.4 ? 'warn' : 'bad');
      const f = logFrame({ x0: 1, x1: 128, y0: 1, y1: 128, H: 260, aria: 'Tăng tốc theo số node',
        xticks: [1, 2, 4, 8, 16, 32, 64, 128].map((v) => [v, String(v)]), yticks: [1, 2, 4, 8, 16, 32, 64, 128].map((v) => [v, '×' + v]),
        xlabel: 'Số node (thang log)', ylabel: 'Tăng tốc' });
      const ideal = [], real = [];
      for (let i = 0; i <= 70; i++) { const n = Math.pow(2, (7 * i) / 70); ideal.push([f.x(n), f.y(n)]); real.push([f.x(n), f.y(t1 / total(n))]); }
      f.svg.appendChild(s('path', { d: poly(ideal), class: 'f-none s-ink3 dash', 'stroke-width': 2 }));
      f.svg.appendChild(s('path', { d: poly(real), class: 'f-none s-accent', 'stroke-width': 2.5 }));
      f.svg.appendChild(s('circle', { cx: f.x(N), cy: f.y(sp), r: 5, class: 'f-accent' }));
      f.svg.appendChild(s('text', { x: f.x(N) + 8, y: f.y(sp) + 14 }, '×' + fmt(sp, 1)));
      f.svg.appendChild(s('text', { x: f.x(40), y: f.y(40) - 8, 'text-anchor': 'end' }, 'tuyến tính lý tưởng'));
      f.svg.appendChild(s('text', { x: f.x(100), y: f.y(t1 / total(100)) + 16, 'text-anchor': 'end' }, 'thực tế'));
      clear(viz).appendChild(f.svg);
    }
    render();
  });

  // =====================================================================
  glossary.add([
    { key: 'partition', term: 'Partition', vi: 'phân vùng', ch: 7, topic: 'ch7-intro', def: 'Một mảnh của cơ sở dữ liệu lớn. Mỗi bản ghi thuộc đúng một partition; mỗi partition giống một database nhỏ và có thể đặt trên node khác nhau. Còn gọi là shard, region (HBase), tablet (Bigtable), vnode (Cassandra, Riak), vBucket (Couchbase).' },
    { key: 'sharding', term: 'Sharding / shard', vi: 'phân mảnh', ch: 7, topic: 'ch7-intro', def: 'Tên gọi khác của partitioning, dùng trong MongoDB, Elasticsearch, SolrCloud. Không liên quan đến network partition (lỗi mạng).' },
    { key: 'shared-nothing', term: 'Shared-nothing architecture', vi: 'kiến trúc không chia sẻ', ch: 7, topic: 'ch7-intro', def: 'Mỗi node có CPU, RAM, đĩa riêng và chỉ phối hợp qua mạng. Phân vùng cho phép chia dữ liệu và tải truy vấn ra các node như vậy.' },
    { key: 'skew', term: 'Skew', vi: 'phân bố lệch', ch: 7, topic: 'ch7-keyrange', def: 'Khi một số partition có nhiều dữ liệu hoặc truy vấn hơn hẳn các partition khác. Skew làm phân vùng kém hiệu quả: trường hợp xấu nhất, 9 trên 10 node ngồi chơi.' },
    { key: 'hot-spot', term: 'Hot spot', vi: 'điểm nóng', ch: 7, topic: 'ch7-keyrange', def: 'Partition (hoặc node) chịu tải cao bất thường so với phần còn lại, trở thành nút cổ chai.' },
    { key: 'key-range-partitioning', term: 'Key range partitioning', vi: 'phân vùng theo khoảng khoá', ch: 7, topic: 'ch7-keyrange', def: 'Mỗi partition giữ một dải khoá liên tục, như các tập bách khoa toàn thư. Khoá được sắp xếp nên range query hiệu quả, nhưng dễ có hot spot. Dùng ở Bigtable, HBase, RethinkDB.' },
    { key: 'range-scan', term: 'Range scan / range query', vi: 'quét theo khoảng', ch: 7, topic: 'ch7-keyrange', def: 'Truy vấn lấy mọi khoá nằm giữa hai giá trị, ví dụ mọi số đo trong một tháng. Rẻ khi khoá được lưu theo thứ tự.' },
    { key: 'hash-function', term: 'Hash function (for partitioning)', vi: 'hàm băm', ch: 7, topic: 'ch7-hash', def: 'Biến khoá thành một số trông như ngẫu nhiên (ví dụ 0 … 2³² − 1), rải đều khoá dù đầu vào lệch. Không cần mạnh về mật mã (MD5, Fowler–Noll–Vo) nhưng phải cho cùng kết quả ở mọi process.' },
    { key: 'hash-partitioning', term: 'Hash partitioning', vi: 'phân vùng theo hash', ch: 7, topic: 'ch7-hash', def: 'Mỗi partition giữ một dải giá trị hash; khoá thuộc partition chứa hash của nó. Tải đều hơn nhưng mất thứ tự khoá, nên range query thành scatter/gather.' },
    { key: 'scatter-gather', term: 'Scatter/gather', vi: 'rải rồi gom', ch: 7, topic: 'ch7-index-doc', def: 'Gửi truy vấn tới mọi partition rồi gộp kết quả. Dùng cho range query trên hash partitioning hoặc secondary index cục bộ; đắt và dễ bị khuếch đại độ trễ đuôi.' },
    { key: 'consistent-hashing', term: 'Consistent hashing', vi: 'băm nhất quán', ch: 7, topic: 'ch7-consistent', def: 'Kỹ thuật của Karger và cộng sự (1997) để chia tải cho cache cỡ Internet bằng ranh giới chọn ngẫu nhiên, không cần điều phối trung tâm. “Consistent” không liên quan đến consistency; sách khuyên gọi là hash partitioning.' },
    { key: 'token', term: 'Token (hash ring)', vi: 'điểm trên vòng hash', ch: 7, topic: 'ch7-consistent', def: 'Một vị trí ngẫu nhiên trên không gian hash mà một node nhận làm ranh giới. Khoá thuộc token kế tiếp theo chiều kim đồng hồ. Cassandra mặc định 256 token (vnode) mỗi node.' },
    { key: 'compound-primary-key', term: 'Compound primary key', vi: 'khoá chính phức hợp', ch: 7, topic: 'ch7-compound', def: 'Khoá gồm nhiều cột (Cassandra): cột đầu được hash để chọn partition, các cột sau sắp xếp dữ liệu trong partition. Cố định cột đầu thì range scan các cột sau rất hiệu quả.' },
    { key: 'concatenated-index', term: 'Concatenated index', vi: 'index ghép', ch: 7, topic: 'ch7-compound', def: 'Index trên nhiều cột ghép nối theo thứ tự, ví dụ (user_id, update_timestamp): lấy được mọi bản ghi của một user trong một khoảng thời gian, đã sắp xếp.' },
    { key: 'hot-key', term: 'Hot key', vi: 'khoá nóng', ch: 7, topic: 'ch7-skew', def: 'Một khoá nhận lượng đọc/ghi cực lớn, ví dụ ID của người nổi tiếng. Hash không giúp được vì hash của cùng một khoá luôn như nhau; ứng dụng có thể thêm hậu tố ngẫu nhiên để tách nó thành nhiều khoá.' },
    { key: 'secondary-index', term: 'Secondary index', vi: 'chỉ mục phụ', ch: 7, topic: 'ch7-index-doc', def: 'Index để tìm mọi bản ghi có một giá trị (mọi xe màu đỏ), không xác định duy nhất bản ghi. Không ánh xạ gọn vào partition theo khoá chính.' },
    { key: 'local-index', term: 'Local index (document-partitioned)', vi: 'index cục bộ', ch: 7, topic: 'ch7-index-doc', def: 'Mỗi partition giữ secondary index chỉ cho document của nó. Ghi chạm một partition; đọc theo index phải scatter/gather mọi partition. Dùng ở MongoDB, Cassandra, Elasticsearch, SolrCloud, Riak, VoltDB.' },
    { key: 'global-index', term: 'Global index (term-partitioned)', vi: 'index toàn cục', ch: 7, topic: 'ch7-index-term', def: 'Một secondary index phủ mọi partition, được phân vùng theo term. Đọc chỉ hỏi partition giữ term; ghi có thể chạm nhiều partition và thường được cập nhật bất đồng bộ (DynamoDB GSI).' },
    { key: 'index-term', term: 'Term', vi: 'mục từ của index', ch: 7, topic: 'ch7-index-term', def: 'Giá trị được index, ví dụ color:red. Tên đến từ full-text index, nơi term là các từ xuất hiện trong văn bản.' },
    { key: 'tail-latency-amplification', term: 'Tail latency amplification', vi: 'khuếch đại độ trễ đuôi', ch: 7, topic: 'ch7-index-doc', def: 'Khi một request phải chờ nhiều lời gọi song song, thời gian của nó bằng lời gọi chậm nhất, nên xác suất gặp một lời gọi chậm tăng theo số lời gọi. Scatter/gather bị ảnh hưởng trực tiếp.' },
    { key: 'async-index', term: 'Asynchronous index update', vi: 'cập nhật index bất đồng bộ', ch: 7, topic: 'ch7-index-term', def: 'Ghi document được xác nhận trước khi các partition index toàn cục cập nhật xong; đọc ngay sau ghi có thể chưa thấy thay đổi. Tránh được giao dịch phân tán.' },
    { key: 'rebalancing', term: 'Rebalancing', vi: 'cân bằng lại', ch: 7, topic: 'ch7-modn', def: 'Di chuyển dữ liệu và request giữa các node khi thêm máy, mất máy hoặc tải đổi. Yêu cầu: tải đều sau đó, vẫn phục vụ trong lúc chạy, không chuyển nhiều dữ liệu hơn cần thiết.' },
    { key: 'hash-mod-n', term: 'hash mod N', vi: 'chia lấy dư theo số node', ch: 7, topic: 'ch7-modn', def: 'Gán khoá vào node bằng hash(key) % N. Sai lầm kinh điển: khi N đổi, gần như mọi khoá phải chuyển node (10 → 11 node: ~91% khoá).' },
    { key: 'fixed-partitions', term: 'Fixed number of partitions', vi: 'số partition cố định', ch: 7, topic: 'ch7-fixed', def: 'Tạo nhiều partition hơn số node từ đầu (ví dụ 1.000 cho 10 node); thêm node thì chỉ chuyển cả partition. Số partition là giới hạn số node. Dùng ở Riak, Elasticsearch, Couchbase, Voldemort.' },
    { key: 'dynamic-partitioning', term: 'Dynamic partitioning', vi: 'phân vùng động', ch: 7, topic: 'ch7-dynamic', def: 'Partition tự tách khi vượt ngưỡng (HBase: 10 GB) và gộp khi quá nhỏ, nên số partition theo khối lượng dữ liệu. Dùng ở HBase, RethinkDB, MongoDB.' },
    { key: 'partition-split', term: 'Partition split / merge', vi: 'tách / gộp partition', ch: 7, topic: 'ch7-dynamic', def: 'Tách một partition quá lớn thành hai nửa có lượng dữ liệu xấp xỉ nhau; gộp partition quá nhỏ với hàng xóm. Giống tầng trên cùng của B-tree.' },
    { key: 'pre-splitting', term: 'Pre-splitting', vi: 'chia sẵn', ch: 7, topic: 'ch7-dynamic', def: 'Cấu hình sẵn một tập partition cho database rỗng (HBase, MongoDB) để lượng ghi ban đầu không dồn vào một node. Với khoảng khoá, cần biết trước phân bố khoá.' },
    { key: 'partitions-per-node', term: 'Partitioning proportionally to nodes', vi: 'partition tỉ lệ với số node', ch: 7, topic: 'ch7-proportional', def: 'Mỗi node giữ một số partition cố định (Cassandra: 256). Node mới tách ngẫu nhiên một số partition và lấy một nửa. Kích thước partition khá ổn định vì dữ liệu nhiều thường đi kèm nhiều node.' },
    { key: 'vnode', term: 'vnode', vi: 'node ảo', ch: 7, topic: 'ch7-proportional', def: 'Tên Cassandra và Riak gọi partition: mỗi node vật lý giữ nhiều vnode (token) trên vòng hash.' },
    { key: 'automatic-rebalancing', term: 'Automatic vs manual rebalancing', vi: 'cân bằng tự động / thủ công', ch: 7, topic: 'ch7-ops', def: 'Tự động: hệ thống tự quyết khi nào chuyển partition. Thủ công: quản trị viên cấu hình. Couchbase, Riak, Voldemort tự đề xuất nhưng cần người duyệt.' },
    { key: 'cascading-failure', term: 'Cascading failure', vi: 'lỗi dây chuyền', ch: 7, topic: 'ch7-ops', def: 'Một sự cố gây ra thêm tải hoặc hành động khắc phục làm các thành phần khác hỏng theo, tự khuếch đại. Ví dụ: node chậm bị coi là chết, rebalance tự động làm mọi node quá tải.' },
    { key: 'request-routing', term: 'Request routing', vi: 'định tuyến request', ch: 7, topic: 'ch7-routing', def: 'Bài toán đưa request cho khoá X tới đúng node đang giữ partition của X, khi phân công partition thay đổi theo thời gian.' },
    { key: 'service-discovery', term: 'Service discovery', vi: 'khám phá dịch vụ', ch: 7, topic: 'ch7-routing', def: 'Bài toán tổng quát: một phần mềm truy cập qua mạng nằm ở IP và cổng nào. Request routing của database là một trường hợp riêng.' },
    { key: 'routing-tier', term: 'Routing tier', vi: 'tầng định tuyến', ch: 7, topic: 'ch7-routing', def: 'Lớp trung gian biết bản đồ partition, nhận request từ client và chuyển tới node đúng; bản thân không xử lý dữ liệu. Ví dụ mongos của MongoDB, moxi của Couchbase.' },
    { key: 'partition-aware-client', term: 'Partition-aware client', vi: 'client biết partition', ch: 7, topic: 'ch7-routing', def: 'Client tự giữ bản đồ partition → node và kết nối thẳng tới node đúng, không qua trung gian.' },
    { key: 'zookeeper', term: 'ZooKeeper', vi: 'dịch vụ điều phối', ch: 7, topic: 'ch7-routing', def: 'Dịch vụ điều phối giữ metadata cụm như bản đồ partition → node; các bên đăng ký theo dõi và được báo khi có thay đổi. Dùng bởi HBase, SolrCloud, Kafka, Helix (LinkedIn Espresso).' },
    { key: 'gossip-protocol', term: 'Gossip protocol', vi: 'giao thức tán gẫu', ch: 7, topic: 'ch7-routing', def: 'Các node trao đổi trạng thái cụm với nhau theo kiểu lan truyền, không cần dịch vụ điều phối ngoài. Cassandra và Riak dùng để biết partition nào ở đâu.' },
    { key: 'mpp', term: 'MPP (massively parallel processing)', vi: 'xử lý song song quy mô lớn', ch: 7, topic: 'ch7-parallel', def: 'Database quan hệ cho phân tích, tách một truy vấn phức tạp (join, lọc, nhóm, tổng hợp) thành nhiều giai đoạn chạy song song trên các partition ở nhiều node.' },
    { key: 'leader-follower-partition', term: 'Leader/follower per partition', vi: 'leader và follower theo partition', ch: 7, topic: 'ch7-intro', def: 'Khi kết hợp phân vùng và sao chép, mỗi partition có leader trên một node và follower trên node khác; một node thường là leader của vài partition và follower của vài partition khác.' },
  ]);
})();
