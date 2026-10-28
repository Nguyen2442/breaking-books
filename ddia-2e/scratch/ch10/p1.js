/* ch10 — Consistency and Consensus (nguồn: DDIA ấn bản 1, Chương 9) */
(function () {
  'use strict';
  const D = window.DDIA;
  const { h, s, clear, fmt, fmtMs, pct, rng, percentile, clamp, sleep, slider, seg, button, checkbox, stat, log, widget, glossary } = D;
  const uid = (p) => D.nextId(p);

  // ---------- SVG helpers ----------
  function mkSvg(w, hh, label, cls) {
    return s('svg', { viewBox: `0 0 ${w} ${hh}`, role: 'img', 'aria-label': label || '', class: cls || '' });
  }
  function addMarkers(svg) {
    const defs = s('defs');
    const ids = {};
    ['ink3', 'ink', 'accent', 'bad', 'ok', 'violet', 'mark', 'warn'].forEach((t) => {
      const id = uid('c10m');
      ids[t] = id;
      defs.appendChild(s('marker', { id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
        s('path', { d: 'M0,0 L10,5 L0,10 z', class: 'f-' + t })));
    });
    svg.appendChild(defs);
    return ids;
  }
  const T = (x, y, txt, cls, extra) => s('text', Object.assign({ x, y, class: cls || '' }, extra || {}), txt);
  const TM = (x, y, txt, cls, extra) => T(x, y, txt, cls, Object.assign({ 'text-anchor': 'middle' }, extra || {}));
  const TE = (x, y, txt, cls, extra) => T(x, y, txt, cls, Object.assign({ 'text-anchor': 'end' }, extra || {}));
  const L = (x1, y1, x2, y2, cls, extra) => s('line', Object.assign({ x1, y1, x2, y2, class: 'f-none ' + (cls || 's-line') }, extra || {}));
  const R = (x, y, w, hh, cls, extra) => s('rect', Object.assign({ x, y, width: Math.max(0, w), height: Math.max(0, hh), class: cls }, extra || {}));
  const C = (cx, cy, r, cls, extra) => s('circle', Object.assign({ cx, cy, r, class: cls }, extra || {}));
  function arrow(mk, x1, y1, x2, y2, tone, extraCls, extra) {
    return L(x1, y1, x2, y2, 's-' + tone + ' sw15 ' + (extraCls || ''), Object.assign({ 'marker-end': `url(#${mk[tone]})` }, extra || {}));
  }
  function svgPt(svg, ev) {
    const p = svg.createSVGPoint();
    p.x = ev.clientX; p.y = ev.clientY;
    const m = svg.getScreenCTM();
    return m ? p.matrixTransform(m.inverse()) : { x: 0, y: 0 };
  }
  function verdict() {
    const pill = h('span', { class: 'pill' });
    const txt = h('div', { class: 'vtext' });
    const el = h('div', { class: 'box verdict' }, pill, txt);
    el.set = (tone, label, html) => { pill.className = 'pill ' + tone; pill.textContent = label; txt.innerHTML = html; };
    return el;
  }
  const t1 = (v) => fmt(v, 1);

  // ---------- Linearizability checker (shared by several widgets) ----------
  // op: {c: client, k: 'w'|'r'|'cas', v, old, nw, ok, s, e}
  function applyOp(op, val) {
    if (op.k === 'r') return op.v === val ? val : undefined;
    if (op.k === 'w') return op.v;
    if (op.ok) return val === op.old ? op.nw : undefined;
    return val !== op.old ? val : undefined;
  }
  function linCheck(ops, init) {
    const n = ops.length, fail = new Set(), order = [];
    let best = [];
    function dfs(mask, val) {
      if (order.length === n) return true;
      const key = mask + ':' + val;
      if (fail.has(key)) return false;
      for (let i = 0; i < n; i++) {
        if (mask & (1 << i)) continue;
        let ok = true;
        for (let j = 0; j < n; j++) if (j !== i && !(mask & (1 << j)) && ops[j].e < ops[i].s) { ok = false; break; }
        if (!ok) continue;
        const nv = applyOp(ops[i], val);
        if (nv === undefined) continue;
        order.push(i);
        if (order.length > best.length) best = order.slice();
        if (dfs(mask | (1 << i), nv)) return true;
        order.pop();
      }
      fail.add(key);
      return false;
    }
    const ok = dfs(0, init);
    return { ok, order: ok ? order.slice() : null, best };
  }
  function linPoints(ops, order) {
    for (const eps of [0.6, 0.3, 0.1, 0.02, 0]) {
      let prev = -Infinity, good = true;
      const pts = [];
      for (const i of order) {
        const o = ops[i];
        const p = Math.max(o.s + Math.min(eps, (o.e - o.s) / 2), prev + eps);
        if (p > o.e) { good = false; break; }
        pts[i] = p; prev = p;
      }
      if (good) return pts;
    }
    return null;
  }
  const produces = (o) => (o.k === 'w' ? o.v : o.k === 'cas' && o.ok ? o.nw : undefined);
  const observed = (o) => (o.k === 'r' ? o.v : produces(o));
  function opDesc(o) {
    if (o.k === 'w') return `ghi(${o.v})`;
    if (o.k === 'r') return `đọc → ${o.v}`;
    return `cas(${o.old}→${o.nw}) → ${o.ok ? 'ok' : 'lỗi'}`;
  }
  const opLab = (o) => `${o.c}: ${opDesc(o)}`;
  function linExplain(ops, init, res) {
    const idx = ops.map((o, i) => i).sort((a, b) => ops[a].s - ops[b].s);
    for (const i of idx) {
      const r = ops[i];
      const need = r.k === 'r' ? r.v : r.k === 'cas' && r.ok ? r.old : undefined;
      if (need === undefined) continue;
      const prods = ops.map((o, j) => j).filter((j) => j !== i && produces(ops[j]) === need);
      if (need !== init && !prods.length)
        return { i, text: `<b>${opLab(r)}</b> cần thấy x = ${need}, nhưng không có thao tác nào từng ghi giá trị ${need}.` };
      if (need !== init && prods.every((j) => ops[j].s > r.e))
        return { i, text: `<b>${opLab(r)}</b> kết thúc lúc t = ${t1(r.e)} mà đã thấy x = ${need}, trong khi mọi thao tác ghi ${need} đều bắt đầu sau thời điểm đó. Không thể đọc thấy “tương lai”.` };
      for (const j of idx) {
        if (j === i) continue;
        const a = ops[j];
        if (!(a.e < r.s)) continue;
        const w = observed(a);
        if (w === undefined || w === need) continue;
        if (prods.every((p) => ops[p].e < a.s)) {
          const src = need === init && !prods.length ? `${need} là giá trị ban đầu` : `mọi lần ghi ${need} đều xong trước khi <b>${a.c}</b> bắt đầu`;
          return { i, text: `<b>${opLab(a)}</b> đã ${a.k === 'r' ? 'đọc thấy' : 'đặt'} x = ${w} và kết thúc lúc t = ${t1(a.e)}, <i>trước khi</i> <b>${opLab(r)}</b> bắt đầu (t = ${t1(r.s)}). Vì ${src}, khi ${r.c} chạy thì ${need} đã bị ghi đè. Trả về ${need} là đọc lùi về quá khứ — đúng tình huống Alice và Bob.` };
        }
      }
    }
    const seq = (res.best || []).map((k) => opLab(ops[k])).join(' → ') || '(không có)';
    return { i: -1, text: `Không có cách nào xếp các thao tác thành một dãy tuần tự vừa tôn trọng thứ tự thời gian thực, vừa đúng ngữ nghĩa của register. Bộ kiểm tra chỉ xếp được ${(res.best || []).length}/${ops.length} thao tác: ${seq}.` };
  }

  // =====================================================================
  // 10.1 Eventual consistency
  // =====================================================================
  widget('c10-eventual', (root) => {
    const lag1 = slider({ label: 'Trễ sao chép tới Follower 1', min: 0, max: 3000, step: 100, value: 400, format: fmtMs, onInput: render });
    const lag2 = slider({ label: 'Trễ sao chép tới Follower 2', min: 0, max: 3000, step: 100, value: 1800, format: fmtMs, onInput: render });
    const mode = seg({ label: 'Đọc từ đâu', options: [{ value: 'any', label: 'Đọc từ replica ngẫu nhiên' }, { value: 'leader', label: 'Chỉ đọc từ leader' }], value: 'any', onChange: render });
    let seed = 7;
    const reroll = button('Bốc thăm lại replica', () => { seed++; render(); }, 'ghost');
    const W = 640, H = 236, X0 = 48, X1 = 624, Y0 = 190, Y1 = 34, TMAX = 6;
    const svg = mkSvg(W, H, 'Giá trị x mà client đọc được theo thời gian', 'mw');
    const layer = s('g'); svg.appendChild(layer);
    const s1 = stat('Lần đọc trả giá trị cũ', '–'), s2 = stat('Lần đọc “lùi thời gian”', '–'), s3 = stat('Mọi replica hội tụ lúc', '–');
    root.append(
      h('div', { class: 'controls' }, lag1.el, lag2.el),
      h('div', { class: 'btn-row' }, mode.el, reroll),
      h('div', { class: 'viz' }, svg),
      h('div', { class: 'stats' }, s1, s2, s3),
      h('p', { class: 'lab-note' }, 'Leader nhận ba lần ghi x = 1, 2, 3 (lúc 0,5 s, 1,5 s, 2,5 s). Một client đọc x mỗi 0,2 s, mỗi lần rơi vào một replica bất kỳ (chữ dưới chấm: L = leader, 1/2 = follower). Chấm đỏ = giá trị cũ hơn giá trị mới nhất. Độ trễ dao động ±30% quanh giá trị thanh trượt (số liệu minh hoạ).'));
    const writes = [0.5, 1.5, 2.5];
    function render() {
      clear(layer);
      const r = rng(seed * 101 + 3);
      const arrive = [writes.slice()];
      [lag1.value, lag2.value].forEach((lg) => {
        let prev = 0;
        arrive.push(writes.map((w) => { prev = Math.max(prev, w + (lg / 1000) * (0.7 + 0.6 * r())); return prev; }));
      });
      const valAt = (rep, t) => arrive[rep].filter((a) => a <= t + 1e-9).length;
      const x = (t) => X0 + (t / TMAX) * (X1 - X0), y = (v) => Y0 - (v / 3) * (Y0 - Y1);
      for (let v = 0; v <= 3; v++) layer.append(L(X0, y(v), X1, y(v), 'grid'), TE(X0 - 8, y(v) + 4, 'x = ' + v));
      for (let t = 0; t <= TMAX; t++) layer.append(L(x(t), Y0, x(t), Y0 + 4, 'axis'), TM(x(t), Y0 + 17, t + ' s'));
      layer.append(L(X0, Y0, X1, Y0, 'axis'), TE(X1, Y0 + 32, 'thời gian (giây)', 'sm'));
      let d = `M${x(0)},${y(0)}`;
      writes.forEach((w, i) => { d += ` H${x(w)} V${y(i + 1)}`; });
      d += ` H${x(TMAX)}`;
      layer.append(s('path', { d, class: 'f-none s-accent sw2' }));
      layer.append(T(x(writes[2]) + 4, y(3) - 8, 'giá trị mới nhất (ở leader)', 'sm f-accent'));
      const conv = Math.max(...arrive.map((a) => a[2]));
      if (conv <= TMAX) layer.append(L(x(conv), Y1 - 10, x(conv), Y0, 's-violet dash'), T(x(conv) + 4, Y1 - 12, 'hội tụ', 'sm f-violet'));
      let stale = 0, back = 0, last = 0;
      for (let k = 1; k <= 30; k++) {
        const t = k * 0.2;
        const rep = mode.value === 'leader' ? 0 : Math.floor(r() * 3);
        const v = valAt(rep, t), truth = valAt(0, t);
        if (v < truth) stale++;
        if (v < last) back++;
        last = v;
        layer.append(C(x(t), y(v), 4.5, v < truth ? 'f-bad' : 'f-ok'), TM(x(t), y(v) + 16, ['L', '1', '2'][rep], 'sm'));
      }
      s1.update(stale + '/30', stale ? 'bad' : 'ok', mode.value === 'leader' ? 'đọc leader luôn mới nhất' : 'đọc nhầm replica đang trễ');
      s2.update(String(back), back ? 'warn' : 'ok', 'lần sau thấy giá trị nhỏ hơn lần trước');
      s3.update(fmt(conv, 2) + ' s', 'accent', 'sau lần ghi cuối ' + fmtMs((conv - 2.5) * 1000));
    }
    render();
  });

  // =====================================================================
  // 10.2 Alice & Bob — World Cup 2014
  // =====================================================================
  widget('c10-worldcup', (root) => {
    const tA = slider({ label: 'Alice bấm tải lại lúc', min: 0.6, max: 4, step: 0.1, value: 1.6, format: (v) => t1(v) + ' s', onInput: render });
    const lag1 = slider({ label: 'Trễ của replica Alice đọc (Follower 1)', min: 0, max: 3, step: 0.1, value: 0.3, format: (v) => t1(v) + ' s', onInput: render });
    const lag2 = slider({ label: 'Trễ của replica Bob đọc (Follower 2)', min: 0, max: 5, step: 0.1, value: 3.5, format: (v) => t1(v) + ' s', onInput: render });
    const react = slider({ label: 'Bob tải lại sau khi nghe Alice', min: 0, max: 3, step: 0.1, value: 0.5, format: (v) => t1(v) + ' s', onInput: render });
    const lin = checkbox('Hệ thống tuyến tính hoá (mọi lần đọc thấy giá trị mới nhất)', false, render);
    const W = 660, H = 262, X0 = 96, X1 = 646, TMAX = 8.6;
    const svg = mkSvg(W, H, 'Biểu đồ thời gian: Alice, Bob và các replica', 'mw');
    const mk = addMarkers(svg);
    const layer = s('g'); svg.appendChild(layer);
    const vd = verdict();
    root.append(h('div', { class: 'controls' }, tA.el, lag1.el, lag2.el, react.el), lin.el, h('div', { class: 'viz' }, svg), vd);
    const Y = { L: 36, F1: 78, F2: 120, A: 176, B: 226 };
    const x = (t) => X0 + (Math.min(t, TMAX) / TMAX) * (X1 - X0);
    function render() {
      clear(layer);
      const names = [['L', 'Leader'], ['F1', 'Follower 1'], ['F2', 'Follower 2'], ['A', 'Alice'], ['B', 'Bob']];
      names.forEach(([k, n]) => layer.append(L(X0, Y[k], X1, Y[k], k.length === 1 && k !== 'L' ? 's-ink3' : 'grid'), T(8, Y[k] + 4, n, 'lbl-strong')));
      for (let t = 0; t <= 8; t++) layer.append(TM(x(t), H - 6, t + ' s', 'sm'));
      const F = 1.0, a1 = F + lag1.value, a2 = F + lag2.value, L1 = lin.input.checked;
      layer.append(C(x(F), Y.L, 5, 'f-accent'), T(x(F) + 7, Y.L - 8, 'Trọng tài thổi còi: Đức 1–0 Argentina', 'sm f-accent'));
      layer.append(arrow(mk, x(F), Y.L, x(a1), Y.F1 - 2, 'violet', 'dash'), arrow(mk, x(F), Y.L, x(a2), Y.F2 - 2, 'violet', 'dash'));
      if (a2 <= TMAX) layer.append(T(x(a2) + 4, Y.F2 + 14, 'F2 nhận tỉ số', 'sm f-violet'));
      // Alice
      const ta = tA.value, aSrv = ta + 0.2, aTarget = L1 ? Y.L : Y.F1;
      const aSaw = L1 ? aSrv >= F : aSrv >= a1;
      layer.append(arrow(mk, x(ta), Y.A, x(aSrv), aTarget + 3, 'ink3'), arrow(mk, x(aSrv), aTarget + 3, x(ta + 0.4), Y.A - 2, aSaw ? 'ok' : 'bad'));
      layer.append(T(x(ta + 0.4) + 4, Y.A - 6, aSaw ? '“Đức 1–0, hết trận”' : '“Trận đấu đang diễn ra”', 'sm ' + (aSaw ? 'f-ok' : 'f-bad')));
      let html;
      if (!aSaw) {
        html = 'Alice tải lại quá sớm, replica của cô chưa có tỉ số cuối. Cô chẳng hô gì, Bob cũng không có lý do để nghi ngờ. Kéo “Alice bấm tải lại lúc” sang phải.';
        vd.set('', 'Chưa có gì để so', html);
        return;
      }
      const shout = ta + 0.5, hear = ta + 0.75, tb = hear + react.value, bSrv = tb + 0.2, bTarget = L1 ? Y.L : Y.F2;
      const bSaw = L1 ? bSrv >= F : bSrv >= a2;
      layer.append(arrow(mk, x(shout), Y.A + 3, x(hear), Y.B - 3, 'mark'), T(x(hear) + 4, (Y.A + Y.B) / 2 + 4, 'Alice hô: “Đức vô địch rồi!”', 'sm f-warn'));
      layer.append(arrow(mk, x(tb), Y.B, x(bSrv), bTarget + 3, 'ink3'), arrow(mk, x(bSrv), bTarget + 3, x(tb + 0.4), Y.B - 2, bSaw ? 'ok' : 'bad'));
      layer.append(T(x(tb + 0.4) + 4, Y.B + 16, bSaw ? '“Đức 1–0, hết trận”' : '“Trận đấu đang diễn ra”', 'sm ' + (bSaw ? 'f-ok' : 'f-bad')));
      if (bSaw) {
        vd.set('ok', 'Không thấy vi phạm', L1
          ? 'Với hệ thống tuyến tính hoá, lần đọc của Bob bắt đầu <i>sau khi</i> lần đọc của Alice đã kết thúc nên chắc chắn thấy giá trị ít nhất mới bằng của Alice.'
          : `Replica của Bob đã nhận tỉ số (lúc ${t1(a2)} s) trước khi Bob đọc (lúc ${t1(bSrv)} s), nên lần này may mắn không lộ vấn đề. Hệ thống vẫn không đảm bảo điều đó.`);
      } else {
        vd.set('bad', 'Vi phạm tuyến tính hoá', `Bob bấm tải lại lúc ${t1(tb)} s, <i>sau khi</i> nghe Alice (lần đọc của cô kết thúc lúc ${t1(ta + 0.4)} s), nhưng Follower 2 đến ${t1(a2)} s mới có tỉ số. Bob nhận kết quả cũ hơn Alice dù yêu cầu của anh bắt đầu sau. Thử bật “Hệ thống tuyến tính hoá” hoặc giảm độ trễ của Follower 2.`);
      }
    }
    render();
  });

  // =====================================================================
  // 10.3 Register history checker
  // =====================================================================
  widget('c10-linchecker', (root) => {
    const P = {
      f92: { label: 'Hình 9-2', clients: ['A', 'B', 'C'], note: 'C ghi x = 1 trong khi A và B liên tục đọc. Các lần đọc chồng thời gian với lần ghi có thể thấy 0 hoặc 1.', ops: [
        { c: 'A', k: 'r', v: 0, s: 0.5, e: 2.5 }, { c: 'A', k: 'r', v: 1, s: 5, e: 8 }, { c: 'A', k: 'r', v: 1, s: 14.5, e: 17 },
        { c: 'B', k: 'r', v: 0, s: 4, e: 7 }, { c: 'B', k: 'r', v: 1, s: 9, e: 12 }, { c: 'C', k: 'w', v: 1, s: 3, e: 13 }] },
      f93: { label: 'Hình 9-3', clients: ['A', 'B', 'C'], note: 'A đã đọc thấy 1, rồi B bắt đầu đọc sau đó mà lại thấy 0. Kéo thanh của B sang trái cho chồng lên lần đọc của A xem sao.', ops: [
        { c: 'A', k: 'r', v: 0, s: 0, e: 1.5 }, { c: 'A', k: 'r', v: 1, s: 4, e: 7.5 }, { c: 'A', k: 'r', v: 1, s: 13, e: 15.5 },
        { c: 'B', k: 'r', v: 0, s: 8.5, e: 11.5 }, { c: 'B', k: 'r', v: 1, s: 17.5, e: 20 }, { c: 'C', k: 'w', v: 1, s: 2, e: 16 }] },
      f94: { label: 'Hình 9-4 (có cas)', clients: ['A', 'B', 'C', 'D'], note: 'Bốn client, có compare-and-set. Lần đọc cuối của B (thanh đỏ) không tuyến tính: A đã thấy 4 trước khi B bắt đầu. Bấm vào thanh đó hai lần để đổi kết quả thành 4.', ops: [
        { c: 'B', k: 'r', v: 1, s: 0.5, e: 5 }, { c: 'D', k: 'w', v: 0, s: 1, e: 3 }, { c: 'A', k: 'w', v: 1, s: 2, e: 6 },
        { c: 'C', k: 'r', v: 1, s: 6.5, e: 8 }, { c: 'B', k: 'cas', old: 1, nw: 2, ok: true, s: 8.5, e: 11 }, { c: 'D', k: 'cas', old: 0, nw: 3, ok: false, s: 11.5, e: 14 },
        { c: 'C', k: 'r', v: 2, s: 12, e: 13.5 }, { c: 'C', k: 'cas', old: 2, nw: 4, ok: true, s: 15, e: 22 }, { c: 'A', k: 'r', v: 4, s: 16, e: 18 },
        { c: 'B', k: 'r', v: 2, s: 19, e: 21 }] },
      q96: { label: 'Quorum (Hình 9-6)', clients: ['W', 'A', 'B'], note: 'Lịch sử mà client thấy trong ví dụ quorum w + r > n ở mục 10.6: A đọc được 1 từ một quorum, B đọc sau mà vẫn được 0.', ops: [
        { c: 'W', k: 'w', v: 1, s: 1, e: 14 }, { c: 'A', k: 'r', v: 1, s: 2, e: 6 }, { c: 'B', k: 'r', v: 0, s: 7, e: 11 }] },
      fut: { label: 'Đọc trước khi ghi', clients: ['A', 'B'], note: 'A đọc thấy 5 trước khi B kịp bắt đầu ghi 5. Kéo lần ghi của B sang trái.', ops: [
        { c: 'A', k: 'r', v: 5, s: 1, e: 3.5 }, { c: 'B', k: 'w', v: 5, s: 5, e: 9 }, { c: 'A', k: 'r', v: 5, s: 10, e: 12 }] },
    };
    const W = 660, X0 = 40, X1 = 646, TMAX = 24, LH = 46, TOP = 14;
    let ops = [], clients = [], sel = -1, key = 'f94';
    const pick = seg({ label: 'Lịch sử mẫu', options: Object.keys(P).map((k) => ({ value: k, label: P[k].label })), value: key, onChange: load });
    const svg = mkSvg(W, 200, 'Lịch sử thao tác trên register x', 'mw');
    const layer = s('g'); svg.appendChild(layer);
    const note = h('p', { class: 'lab-note' });
    const selInfo = h('p', { class: 'lab-note' });
    const vd = verdict();
    const move = (d) => { if (sel < 0) return; const o = ops[sel], len = o.e - o.s; o.s = clamp(o.s + d, 0, TMAX - len); o.e = o.s + len; render(); };
    root.append(pick.el, note, h('div', { class: 'viz' }, svg), selInfo,
      h('div', { class: 'btn-row' }, button('◀ Sớm hơn', () => move(-0.5), 'ghost'), button('Muộn hơn ▶', () => move(0.5), 'ghost'),
        button('Đổi kết quả', () => { if (sel >= 0) cycle(sel); }, 'ghost'), button('Đặt lại ví dụ', () => load(key), 'ghost')), vd);
    const xs = (t) => X0 + (t / TMAX) * (X1 - X0);
    const laneY = (c) => TOP + clients.indexOf(c) * LH + LH / 2;
    function load(k) {
      key = k; pick.set(k);
      ops = P[k].ops.map((o) => Object.assign({}, o));
      clients = P[k].clients; note.textContent = P[k].note;
      sel = -1;
      const res = linCheck(ops, 0);
      if (!res.ok) sel = linExplain(ops, 0, res).i;
      render();
    }
    function cycle(i) {
      const o = ops[i];
      if (o.k === 'r') {
        const vals = [...new Set([0, ...ops.map(produces).filter((v) => v !== undefined)])].sort((a, b) => a - b);
        o.v = vals[(vals.indexOf(o.v) + 1) % vals.length];
      } else if (o.k === 'cas') o.ok = !o.ok;
      else o.v = (o.v + 1) % 5;
      sel = i; render();
    }
    function render() {
      const Hh = TOP + clients.length * LH + 34;
      svg.setAttribute('viewBox', `0 0 ${W} ${Hh}`);
      clear(layer);
      const yAx = TOP + clients.length * LH + 4;
      layer.append(L(X0, yAx, X1, yAx, 'axis'));
      for (let t = 0; t <= TMAX; t += 2) layer.append(L(xs(t), yAx, xs(t), yAx + 4, 'axis'), TM(xs(t), yAx + 16, String(t), 'sm'));
      layer.append(TE(X0 - 6, yAx + 16, 't =', 'sm'));
      clients.forEach((c) => { const y = laneY(c); layer.append(L(X0, y, X1, y, 'grid'), TE(X0 - 10, y + 5, c, 'lbl-strong big')); });
      const res = linCheck(ops, 0);
      const ex = res.ok ? null : linExplain(ops, 0, res);
      const culprit = ex ? ex.i : -1;
      ops.forEach((o, i) => {
        const y = laneY(o.c), a = xs(o.s), b = xs(o.e);
        const tone = i === culprit ? 'bad' : o.k === 'w' ? 'violet' : o.k === 'cas' ? 'warn' : 'accent';
        const fill = i === culprit ? 'f-bad-soft' : o.k === 'w' ? 'f-violet-soft' : o.k === 'cas' ? 'f-mark-soft' : 'f-accent-soft';
        const g = s('g', { class: 'op' + (i === sel ? ' sel' : ''), 'data-op': i });
        g.append(R(a, y - 14, b - a, 28, fill + ' s-' + tone, { rx: 6 }), TM((a + b) / 2, y + 4, opDesc(o), 'sm lbl-strong'));
        layer.append(g);
      });
      if (res.ok) {
        const pts = linPoints(ops, res.order);
        if (pts) {
          const poly = res.order.map((i) => `${xs(pts[i])},${laneY(ops[i].c)}`).join(' ');
          layer.append(s('polyline', { points: poly, class: 'f-none s-ink sw15 nohit' }));
          res.order.forEach((i) => { const y = laneY(ops[i].c), px = xs(pts[i]); layer.append(L(px, y - 14, px, y + 14, 's-ink sw2 nohit'), C(px, y, 3, 'f-ink nohit')); });
        }
        vd.set('ok', 'Tuyến tính hoá được', `Tìm được một thứ tự tuần tự hợp lệ: ${res.order.map((i) => opLab(ops[i])).join(' → ')}. Vạch đen trong mỗi thanh là thời điểm thao tác “có hiệu lực”; đường nối các vạch luôn đi từ trái sang phải.`);
      } else {
        vd.set('bad', 'Không tuyến tính hoá được', ex.text);
      }
      selInfo.textContent = sel >= 0 ? `Đang chọn: ${opLab(ops[sel])} (t = ${t1(ops[sel].s)}–${t1(ops[sel].e)}). Kéo thanh để dời; bấm lần nữa hoặc “Đổi kết quả” để đổi giá trị trả về.` : 'Bấm vào một thanh để chọn. Kéo ngang để dời thao tác; bấm lại thanh đang chọn để đổi kết quả.';
    }
    let drag = null;
    svg.addEventListener('pointerdown', (ev) => {
      const g = ev.target.closest && ev.target.closest('[data-op]');
      if (!g) return;
      const i = +g.getAttribute('data-op'), p = svgPt(svg, ev);
      drag = { i, x0: p.x, s0: ops[i].s, e0: ops[i].e, moved: false };
      try { svg.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
      ev.preventDefault();
    });
    svg.addEventListener('pointermove', (ev) => {
      if (!drag) return;
      const p = svgPt(svg, ev), du = ((p.x - drag.x0) / (X1 - X0)) * TMAX;
      if (Math.abs(du) > 0.3) drag.moved = true;
      if (!drag.moved) return;
      const len = drag.e0 - drag.s0, ns = clamp(drag.s0 + Math.round(du * 2) / 2, 0, TMAX - len);
      if (ns !== ops[drag.i].s || sel !== drag.i) { ops[drag.i].s = ns; ops[drag.i].e = ns + len; sel = drag.i; render(); }
    });
    svg.addEventListener('pointerup', (ev) => {
      if (!drag) return;
      const d = drag; drag = null;
      try { svg.releasePointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
      if (!d.moved) { if (sel === d.i) cycle(d.i); else { sel = d.i; render(); } }
    });
    svg.addEventListener('pointercancel', () => { drag = null; });
    load(key);
  });

  // =====================================================================
  // 10.4 Linearizability vs serializability
  // =====================================================================
  widget('c10-linser', (root) => {
    const SC = {
      serial: { label: 'Thực thi tuần tự', lin: true, ser: true, text: 'Mọi transaction chạy lần lượt trên một luồng, trên một bản dữ liệu duy nhất (như VoltDB, Redis). Thứ tự tuần tự chính là thứ tự thời gian thực, nên vừa serializable vừa tuyến tính: <b>strict serializability</b>.' },
      tpl: { label: 'Two-phase locking', lin: true, ser: true, text: 'Transaction giữ khoá đến lúc commit; transaction đến sau phải chờ và khi chạy thì thấy bản đã commit mới nhất. Cài đặt 2PL thông thường vì vậy cũng tuyến tính.' },
      ssi: { label: 'SSI (đọc từ snapshot)', lin: false, ser: true, text: 'T1 bắt đầu lúc 10:00:00 và chụp snapshot. T2 ghi x = 1, commit lúc 10:00:01. T1 đọc x lúc 10:00:02, vẫn thấy x = 0. Kết quả vẫn serializable (coi như T1 chạy trước T2), nhưng không tuyến tính: lần đọc bắt đầu sau khi lần ghi đã xong mà vẫn thấy giá trị cũ. Snapshot cố ý không chứa các lần ghi mới hơn nó.' },
      reg: { label: 'Register trong etcd', lin: true, ser: false, text: 'Mỗi key là một register tuyến tính, nhưng không có transaction nhiều object. Hai bác sĩ Alice và Bob (ví dụ write skew ở <a href="#ch8">Chương 8</a>) cùng đọc “đang có 2 người trực”, rồi mỗi người đặt key của mình thành <code>false</code>. Từng key vẫn tuyến tính, nhưng kết quả cuối không ai trực: không serializable.' },
      async: { label: 'Đọc follower bất đồng bộ', lin: false, ser: false, text: 'Đọc từ follower sao chép bất đồng bộ, không có transaction: có thể thấy dữ liệu cũ (không tuyến tính) và không có gì ngăn write skew (không serializable). Đây là mức đảm bảo yếu nhất trong bảng.' },
    };
    const cells = {};
    const grid = h('div', { class: 'ls-grid' },
      h('div', { class: 'ls-h' }), h('div', { class: 'ls-h' }, 'Serializable'), h('div', { class: 'ls-h' }, 'Không serializable'),
      h('div', { class: 'ls-h side' }, 'Tuyến tính'), cells.tt = h('div', { class: 'ls-c' }), cells.tf = h('div', { class: 'ls-c' }),
      h('div', { class: 'ls-h side' }, 'Không tuyến tính'), cells.ft = h('div', { class: 'ls-c' }), cells.ff = h('div', { class: 'ls-c' }));
    const txt = h('div', { class: 'box' });
    const pick = seg({ label: 'Hệ thống', options: Object.keys(SC).map((k) => ({ value: k, label: SC[k].label })), value: 'ssi', onChange: render });
    root.append(pick.el, grid, txt);
    function render() {
      const sc = SC[pick.value];
      const names = { tt: 'Strict serializability', tf: 'Chỉ tuyến tính', ft: 'Chỉ serializable', ff: 'Không có cả hai' };
      Object.keys(cells).forEach((k) => {
        const on = k === (sc.lin ? 't' : 'f') + (sc.ser ? 't' : 'f');
        cells[k].className = 'ls-c' + (on ? ' on' : '');
        clear(cells[k]).append(h('b', names[k]), on ? h('span', { class: 'pill accent' }, sc.label) : '');
      });
      txt.innerHTML = `<h5>${sc.label}</h5>${sc.text}`;
    }
    render();
  });
