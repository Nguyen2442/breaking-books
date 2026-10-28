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

  // =====================================================================
  // 10.5 Causal consistency & Lamport timestamps
  // =====================================================================
  widget('c10-causal', (root) => {
    const mode = seg({
      label: 'Cơ chế đánh dấu',
      options: [
        { value: 'wall', label: 'Đồng hồ vật lý (LWW)' },
        { value: 'lamport', label: 'Lamport timestamp (c, node)' },
      ],
      value: 'lamport',
      onChange: render,
    });
    const skewA = slider({ label: 'Độ lệch đồng hồ Node 1', min: -5, max: 5, step: 1, value: 3, format: (v) => (v >= 0 ? '+' + v : v) + ' s', onInput: render });
    const netDelay = slider({ label: 'Trễ mạng sang Node 2', min: 1, max: 4, step: 1, value: 2, format: (v) => v + ' bước', onInput: render });
    const W = 640, H = 220;
    const svg = mkSvg(W, H, 'Quan hệ nhân quả và Lamport timestamp', 'mw');
    const mk = addMarkers(svg);
    const layer = s('g'); svg.appendChild(layer);
    const s1 = stat('Thứ tự sự kiện (A → B)', '–'), s2 = stat('Kết quả hội tụ', '–'), s3 = stat('Độc lập (concurrent)', '–');
    const vd = verdict();
    root.append(
      h('div', { class: 'controls' }, mode.el, skewA.el, netDelay.el),
      h('div', { class: 'viz' }, svg),
      h('div', { class: 'stats' }, s1, s2, s3),
      vd
    );

    function render() {
      clear(layer);
      const isLamport = mode.value === 'lamport';
      const sk = skewA.value, d = netDelay.value;
      const Y1 = 55, Y2 = 125, Y3 = 185, X0 = 85, X1 = 610;
      const x = (t) => X0 + (t / 10) * (X1 - X0);

      [['N1 (Client A)', Y1], ['N2 (Client B)', Y2], ['N3 (Đồng thời)', Y3]].forEach(([lbl, y]) => {
        layer.append(L(X0, y, X1, y, 'grid'), T(8, y + 4, lbl, 'lbl-strong sm'));
      });

      // Events:
      // E1 on N1 at t=2: "Câu hỏi: Có ai thấy Bob?"
      // Delivered to N2 at t = 2 + d
      // E2 on N2 at t = 3 + d: "Trả lời: Bob đang ăn trưa"
      // E3 on N3 at t = 4 (concurrent write)
      const t1e = 2, t2recv = 2 + d, t2e = 3 + d, t3e = 4;
      const c1 = isLamport ? 1 : t1e + sk;
      const c2recv = isLamport ? Math.max(1, c1) + 1 : t2recv;
      const c2 = isLamport ? c2recv + 1 : t2e;
      const c3 = isLamport ? 1 : t3e;

      // Draw causal arrow E1 -> E2
      layer.append(arrow(mk, x(t1e), Y1 + 6, x(t2recv), Y2 - 6, 'accent'));
      layer.append(arrow(mk, x(t2recv), Y2, x(t2e) - 6, Y2, 'ok'));

      // Draw nodes
      layer.append(
        C(x(t1e), Y1, 7, 'f-accent'),
        TM(x(t1e), Y1 - 12, isLamport ? `E1: (${c1}, N1)` : `E1: t=${c1}s`, 'sm lbl-strong f-accent'),
        C(x(t2recv), Y2, 5, 'f-violet'),
        TM(x(t2recv), Y2 + 18, isLamport ? `max→${c2recv}` : `nhận`, 'sm f-violet'),
        C(x(t2e), Y2, 7, 'f-ok'),
        TM(x(t2e), Y2 - 12, isLamport ? `E2: (${c2}, N2)` : `E2: t=${c2}s`, 'sm lbl-strong f-ok'),
        C(x(t3e), Y3, 7, 'f-warn'),
        TM(x(t3e), Y3 - 12, isLamport ? `E3: (${c3}, N3)` : `E3: t=${c3}s`, 'sm lbl-strong f-warn')
      );

      const orderedOk = isLamport ? c1 < c2 : c1 < c2;
      s1.update(`E1=${c1} vs E2=${c2}`, orderedOk ? 'ok' : 'bad', orderedOk ? 'E1 đứng trước E2' : 'Trả lời xếp trước câu hỏi!');
      s2.update(isLamport ? `(${c2},N2) > (${c1},N1)` : (orderedOk ? 'Đúng tình cờ' : 'Sai nhân quả'), isLamport ? 'ok' : (orderedOk ? 'warn' : 'bad'), isLamport ? 'Toàn phần theo (counter, nodeId)' : 'Phụ thuộc đồng hồ vật lý');
      s3.update('E1 || E3', 'accent', isLamport ? 'Lamport xếp (1,N1) < (1,N3), cần version vector nếu muốn tách' : 'Không phân biệt được nhân quả và đồng thời');

      if (isLamport) {
        vd.set('ok', 'Bảo toàn thứ tự nhân quả', `Khi N2 nhận thông điệp từ N1 mang bộ đếm <code>c=${c1}</code>, N2 nâng bộ đếm lên <code>max(local, ${c1}) + 1 = ${c2recv}</code> rồi mới phát sự kiện trả lời E2 ở <code>(${c2}, N2)</code>. Do đó mọi sự kiện có quan hệ nhân quả <i>E1 → E2</i> luôn thoả <code>L(E1) &lt; L(E2)</code> bất kể đồng hồ vật lý lệch bao nhiêu.`);
      } else if (!orderedOk) {
        vd.set('bad', 'Đảo ngược nhân quả do lệch đồng hồ', `Đồng hồ vật lý của N1 nhanh hơn (+${sk}s), nên câu hỏi E1 mang nhãn <code>t=${c1}s</code> lớn hơn câu trả lời E2 (<code>t=${c2}s</code>). Người đọc thấy câu trả lời xuất hiện trước câu hỏi!`);
      } else {
        vd.set('warn', 'Đúng tạm thời nhưng mong manh', `Hiện tại <code>t(E1)=${c1}s &lt; t(E2)=${c2}s</code>, nhưng thử kéo độ lệch đồng hồ Node 1 lên cao hơn để thấy đồng hồ vật lý làm đảo ngược nhân quả.`);
      }
    }
    render();
  });

  // =====================================================================
  // 10.6 Total Order Broadcast & Linearizable Compare-and-Set
  // =====================================================================
  widget('c10-tob', (root) => {
    const scenario = seg({
      label: 'Tình huống',
      options: [
        { value: 'cas', label: 'Đăng ký username @alice (CAS qua log)' },
        { value: 'stale', label: 'Đọc từ replica trễ vs đọc qua log' },
      ],
      value: 'cas',
      onChange: render,
    });
    const delayC2 = slider({ label: 'Thời điểm Client 2 gửi yêu cầu', min: 0, max: 4, step: 1, value: 1, format: (v) => 't = ' + v, onInput: render });
    const W = 640, H = 225;
    const svg = mkSvg(W, H, 'Total Order Broadcast tạo thứ tự tuần tự duy nhất', 'mw');
    const mk = addMarkers(svg);
    const layer = s('g'); svg.appendChild(layer);
    const s1 = stat('Vị trí log #0', '–'), s2 = stat('Vị trí log #1', '–'), s3 = stat('Người thắng @alice', '–');
    const vd = verdict();
    root.append(
      h('div', { class: 'controls' }, scenario.el, delayC2.el),
      h('div', { class: 'viz' }, svg),
      h('div', { class: 'stats' }, s1, s2, s3),
      vd
    );

    function render() {
      clear(layer);
      const t2 = delayC2.value;
      const c1First = 2 <= t2;
      const first = c1First ? 'Client 1' : 'Client 2';
      const second = c1First ? 'Client 2' : 'Client 1';

      // Draw Log slots in the middle
      layer.append(T(20, 32, 'Log Total Order Broadcast (chỉ append, mọi node nhận cùng thứ tự):', 'lbl-strong sm'));
      const slots = [
        { idx: 0, owner: first, status: 'THắng (gán @alice)', cls: 'f-ok-soft s-ok', tcls: 'f-ok' },
        { idx: 1, owner: second, status: 'THUA (đã tồn tại)', cls: 'f-bad-soft s-bad', tcls: 'f-bad' },
        { idx: 2, owner: scenario.value === 'stale' ? 'Read(x)' : 'Op #3', status: scenario.value === 'stale' ? 'Đọc tại vị trí #2' : 'Chờ...', cls: 'f-accent-soft s-accent', tcls: 'f-accent' },
      ];
      slots.forEach((sl, i) => {
        const bx = 60 + i * 185, by = 45;
        layer.append(
          R(bx, by, 170, 50, sl.cls, { rx: 6 }),
          T(bx + 10, by + 20, `Slot #${sl.idx}: ${sl.owner}`, 'lbl-strong sm'),
          T(bx + 10, by + 38, sl.status, 'sm ' + sl.tcls)
        );
      });

      // Draw 3 replicas below applying log in exact same order
      const reps = ['Replica A', 'Replica B', 'Replica C (trễ)'];
      reps.forEach((rName, ri) => {
        const rx = 60 + ri * 185, ry = 140;
        const isLag = ri === 2 && scenario.value === 'stale';
        layer.append(
          R(rx, ry, 170, 62, isLag ? 'f-mark-soft s-warn' : 'f-surface2 s-line', { rx: 6 }),
          T(rx + 10, ry + 20, rName, 'lbl-strong sm'),
          T(rx + 10, ry + 38, isLag ? `Đã áp đến: Slot #0` : `Đã áp đến: Slot #1`, 'sm'),
          T(rx + 10, ry + 54, `@alice → ${first}`, 'sm f-ok lbl-strong'),
          arrow(mk, rx + 85, 96, rx + 85, ry - 4, isLag ? 'warn' : 'accent', isLag ? 'dash' : '')
        );
      });

      s1.update(`#0: ${first}`, 'ok', 'Ghi thành công @alice');
      s2.update(`#1: ${second}`, 'bad', 'Bị từ chối tất định');
      s3.update(first, 'accent', 'Mọi replica đồng thuận 100%');

      if (scenario.value === 'cas') {
        vd.set('ok', 'Compare-and-Set tuyến tính từ Total Order Broadcast',
          `Cả hai client đều append yêu cầu <code>claim(@alice)</code> vào log. Log gán thứ tự toàn phần: <b>${first}</b> ở vị trí #0, <b>${second}</b> ở vị trí #1. Mọi replica thực thi tuần tự cùng một log nên tất cả đều công nhận <b>${first}</b> thắng và từ chối <b>${second}</b>.`);
      } else {
        vd.set('warn', 'Total Order Broadcast đảm bảo ghi tuần tự, nhưng đọc trực tiếp có thể cũ!',
          `Dù mọi replica nhận log theo đúng thứ tự, <b>Replica C</b> xử lý chậm hơn nên mới chỉ áp đến Slot #0. Đọc trực tiếp từ Replica C không tuyến tính! Để đọc tuyến tính (linearizable read), client phải: (1) append cả yêu cầu đọc vào log, hoặc (2) hỏi vị trí log mới nhất từ leader rồi chờ replica áp tới vị trí đó.`);
      }
    }
    render();
  });

  // =====================================================================
  // 10.7 Two-Phase Commit (2PC) & Coordinator Crash Blocking
  // =====================================================================
  widget('c10-2pc', (root) => {
    const fault = seg({
      label: 'Kịch bản lỗi',
      options: [
        { value: 'ok', label: 'Bình thường (Commit)' },
        { value: 'p2abort', label: 'Node 2 bỏ phiếu KHÔNG' },
        { value: 'coord_crash', label: 'Coordinator sập sau Pha 1 (In-doubt!)' },
      ],
      value: 'coord_crash',
      onChange: render,
    });
    const stepSl = slider({ label: 'Bước thời gian', min: 1, max: 4, step: 1, value: 4, format: (v) => 'Bước ' + v + '/4', onInput: render });
    const W = 640, H = 240;
    const svg = mkSvg(W, H, 'Giao thức Two-Phase Commit (2PC)', 'mw');
    const mk = addMarkers(svg);
    const layer = s('g'); svg.appendChild(layer);
    const s1 = stat('Trạng thái Coordinator', '–'), s2 = stat('Trạng thái Node 1 & 2', '–'), s3 = stat('Khoá (Locks)', '–');
    const vd = verdict();
    root.append(
      h('div', { class: 'controls' }, fault.el, stepSl.el),
      h('div', { class: 'viz' }, svg),
      h('div', { class: 'stats' }, s1, s2, s3),
      vd
    );

    function render() {
      clear(layer);
      const f = fault.value, st = stepSl.value;
      const YC = 48, Y1 = 128, Y2 = 200, X0 = 110, X1 = 600;
      const x = (p) => X0 + ((p - 0.5) / 4) * (X1 - X0);

      [['Coordinator', YC], ['Participant 1', Y1], ['Participant 2', Y2]].forEach(([lbl, y]) => {
        layer.append(L(X0, y, X1, y, 'grid'), T(10, y + 4, lbl, 'lbl-strong sm'));
      });

      // Step 1: Prepare request
      if (st >= 1) {
        layer.append(
          arrow(mk, x(1), YC + 4, x(1.6), Y1 - 4, 'accent'),
          arrow(mk, x(1), YC + 4, x(1.6), Y2 - 4, 'accent'),
          TM(x(1.3), YC - 10, '1. CanCommit? (Prepare)', 'sm f-accent lbl-strong')
        );
      }
      // Step 2: Votes
      if (st >= 2) {
        const p2yes = f !== 'p2abort';
        layer.append(
          arrow(mk, x(1.8), Y1 - 4, x(2.4), YC + 4, 'ok'),
          arrow(mk, x(1.8), Y2 - 4, x(2.4), YC + 4, p2yes ? 'ok' : 'bad'),
          T(x(1.8), Y1 - 10, '2a. CÓ (Đã ghi đĩa)', 'sm f-ok'),
          T(x(1.8), Y2 + 16, p2yes ? '2b. CÓ (Đã ghi đĩa)' : '2b. KHÔNG (Lỗi/Ràng buộc)', 'sm ' + (p2yes ? 'f-ok' : 'f-bad'))
        );
      }
      // Step 3: Coordinator Decision or Crash
      if (st >= 3) {
        if (f === 'coord_crash') {
          layer.append(
            R(x(2.6) - 45, YC - 18, 95, 34, 'f-bad-soft s-bad', { rx: 6 }),
            TM(x(2.6), YC + 4, 'SẬP! (Crash)', 'sm lbl-strong f-bad')
          );
        } else {
          const commit = f === 'ok';
          layer.append(
            C(x(2.7), YC, 7, commit ? 'f-ok' : 'f-bad'),
            TM(x(2.7), YC - 12, commit ? '3. Ghi WAL: COMMIT' : '3. Ghi WAL: ABORT', 'sm lbl-strong ' + (commit ? 'f-ok' : 'f-bad'))
          );
        }
      }
      // Step 4: Phase 2 broadcast or blocked
      if (st >= 4) {
        if (f === 'coord_crash') {
          layer.append(
            R(x(3.3) - 55, Y1 - 16, 150, 32, 'f-mark-soft s-warn', { rx: 6 }),
            TM(x(3.3) + 20, Y1 + 4, 'IN-DOUBT (Giữ khoá chờ!)', 'sm lbl-strong f-warn'),
            R(x(3.3) - 55, Y2 - 16, 150, 32, 'f-mark-soft s-warn', { rx: 6 }),
            TM(x(3.3) + 20, Y2 + 4, 'IN-DOUBT (Giữ khoá chờ!)', 'sm lbl-strong f-warn')
          );
        } else {
          const commit = f === 'ok';
          const tone = commit ? 'ok' : 'bad';
          layer.append(
            arrow(mk, x(2.9), YC + 4, x(3.7), Y1 - 4, tone),
            arrow(mk, x(2.9), YC + 4, x(3.7), Y2 - 4, tone),
            TM(x(3.5), Y1 - 10, commit ? '4. DoCommit → OK' : '4. DoAbort → Rollback', 'sm lbl-strong f-' + tone)
          );
        }
      }

      if (f === 'coord_crash' && st >= 3) {
        s1.update('Sập (Offline)', 'bad', 'Chưa kịp gửi quyết định Pha 2');
        s2.update('In-doubt (Uncertain)', 'warn', 'Đã hứa CÓ nên không được tự huỷ');
        s3.update('BỊ GIỮ CHẶT', 'bad', 'Chặn mọi transaction khác chạm cùng dòng');
        vd.set('bad', '2PC là giao thức Atomic Commit gây chặn (Blocking)',
          'Một khi Participant đã bỏ phiếu <b>CÓ</b> ở Pha 1, nó đã từ bỏ quyền tự quyết: nó không thể tự abort (nhỡ Coordinator đã quyết commit) và cũng không thể tự commit (nhỡ node kia bỏ phiếu KHÔNG). Cả hai phải <b>giữ khoá và chờ</b> cho tới khi Coordinator hồi phục và đọc lại log.');
      } else if (f === 'p2abort' && st >= 2) {
        s1.update('Quyết định ABORT', 'bad', 'Chỉ cần 1 phiếu KHÔNG là huỷ toàn bộ');
        s2.update('Đã Rollback', 'ok', 'Bảo toàn tính nguyên tử (Atomicity)');
        s3.update('Đã giải phóng', 'ok', 'Không bị kẹt');
        vd.set('ok', 'Huỷ nguyên tử an toàn', 'Vì Participant 2 bỏ phiếu KHÔNG ở Pha 1, Coordinator quyết định ABORT và thông báo cho mọi node giải phóng khoá.');
      } else {
        s1.update(st >= 3 ? 'Đã COMMIT' : 'Đang điều phối', 'ok', 'Ghi quyết định vào log của Coordinator');
        s2.update(st >= 4 ? 'Đã COMMIT cả 2' : 'Đang chuẩn bị', 'ok', '100% đồng bộ');
        s3.update(st >= 4 ? 'Đã mở khoá' : 'Đang giữ khoá', st >= 4 ? 'ok' : 'warn', 'Hoàn tất Pha 2');
        vd.set('ok', 'Cam kết hai pha thành công', 'Khi mọi Participant trả lời CÓ ở Pha 1, điểm không thể quay đầu (point of no return) là lúc Coordinator ghi bản ghi COMMIT vào đĩa của chính nó.');
      }
    }
    render();
  });

  // =====================================================================
  // 10.8 Raft / Consensus Leader Election & Log Replication
  // =====================================================================
  widget('c10-raft', (root) => {
    let nodes = [
      { id: 'N1', role: 'Leader', term: 3, alive: true, log: ['x=1 (t1)', 'y=2 (t2)', 'x=5 (t3)'] },
      { id: 'N2', role: 'Follower', term: 3, alive: true, log: ['x=1 (t1)', 'y=2 (t2)', 'x=5 (t3)'] },
      { id: 'N3', role: 'Follower', term: 3, alive: true, log: ['x=1 (t1)', 'y=2 (t2)', 'x=5 (t3)'] },
      { id: 'N4', role: 'Follower', term: 3, alive: true, log: ['x=1 (t1)', 'y=2 (t2)'] },
      { id: 'N5', role: 'Follower', term: 2, alive: false, log: ['x=1 (t1)'] },
    ];
    let curTerm = 3;

    const W = 640, H = 235;
    const svg = mkSvg(W, H, 'Cụm đồng thuận Raft 5 node', 'mw');
    const layer = s('g'); svg.appendChild(layer);
    const s1 = stat('Quorum (Đa số)', '–'), s2 = stat('Leader hiện tại', '–'), s3 = stat('Trạng thái ghi mới', '–');
    const vd = verdict();

    const btnKillLeader = button('Giết Leader hiện tại', () => {
      const ld = nodes.find((n) => n.role === 'Leader' && n.alive);
      if (ld) { ld.alive = false; ld.role = 'Dead'; }
      render();
    }, 'danger');

    const btnElect = button('Bầu Leader mới (Term + 1)', () => {
      const alive = nodes.filter((n) => n.alive);
      if (alive.length < 3) { render(); return; }
      curTerm++;
      nodes.forEach((n) => { if (n.alive) { n.role = 'Follower'; n.term = curTerm; } });
      // Pick alive node with longest log
      alive.sort((a, b) => b.log.length - a.log.length);
      alive[0].role = 'Leader';
      render();
    });

    const btnAppend = button('Ghi lệnh mới qua Leader', () => {
      const ld = nodes.find((n) => n.role === 'Leader' && n.alive);
      const alive = nodes.filter((n) => n.alive);
      if (!ld || alive.length < 3) { render(); return; }
      const entry = `z=${ld.log.length + 3} (t${curTerm})`;
      alive.forEach((n) => {
        if (n.log.length < ld.log.length) n.log = ld.log.slice();
        n.log.push(entry);
      });
      render();
    }, 'ghost');

    const btnReset = button('Khôi phục cả 5 node', () => {
      curTerm = 3;
      nodes = [
        { id: 'N1', role: 'Leader', term: 3, alive: true, log: ['x=1 (t1)', 'y=2 (t2)', 'x=5 (t3)'] },
        { id: 'N2', role: 'Follower', term: 3, alive: true, log: ['x=1 (t1)', 'y=2 (t2)', 'x=5 (t3)'] },
        { id: 'N3', role: 'Follower', term: 3, alive: true, log: ['x=1 (t1)', 'y=2 (t2)', 'x=5 (t3)'] },
        { id: 'N4', role: 'Follower', term: 3, alive: true, log: ['x=1 (t1)', 'y=2 (t2)'] },
        { id: 'N5', role: 'Follower', term: 3, alive: true, log: ['x=1 (t1)', 'y=2 (t2)', 'x=5 (t3)'] },
      ];
      render();
    }, 'ghost');

    root.append(
      h('div', { class: 'btn-row' }, btnKillLeader, btnElect, btnAppend, btnReset),
      h('div', { class: 'viz' }, svg),
      h('div', { class: 'stats' }, s1, s2, s3),
      vd
    );

    function render() {
      clear(layer);
      const aliveCount = nodes.filter((n) => n.alive).length;
      const leader = nodes.find((n) => n.role === 'Leader' && n.alive);
      const hasQuorum = aliveCount >= 3;

      nodes.forEach((n, idx) => {
        const y = 18 + idx * 42;
        const boxCls = !n.alive ? 'f-bad-soft s-bad dash' : n.role === 'Leader' ? 'f-accent-soft s-accent' : 'f-surface2 s-line';
        const g = s('g', { style: { cursor: 'pointer' }, onClick: () => {
          n.alive = !n.alive;
          if (!n.alive && n.role === 'Leader') n.role = 'Follower';
          render();
        } });
        g.append(
          R(12, y, 165, 34, boxCls, { rx: 6 }),
          T(22, y + 15, `${n.id} · ${n.alive ? n.role : 'OFFLINE'}`, 'lbl-strong sm'),
          T(22, y + 29, `Term ${n.term} (bấm bật/tắt)`, 'sm ' + (!n.alive ? 'f-bad' : 'f-ink3'))
        );
        layer.append(g);

        // Draw log cells
        n.log.forEach((entry, li) => {
          const lx = 192 + li * 88;
          if (lx + 82 <= W) {
            layer.append(
              R(lx, y + 3, 82, 28, n.alive ? 'f-ok-soft s-ok' : 'f-surface s-line', { rx: 4 }),
              TM(lx + 41, y + 21, entry, 'sm lbl-strong')
            );
          }
        });
      });

      s1.update(`${aliveCount}/5 node sống`, hasQuorum ? 'ok' : 'bad', 'Cần ít nhất 3/5 node (đa số)');
      s2.update(leader ? `${leader.id} (Term ${curTerm})` : 'CHƯA CÓ LEADER', leader ? 'accent' : 'warn', leader ? 'Sẵn sàng đề xuất log' : 'Bấm "Bầu Leader mới"');
      s3.update(hasQuorum && leader ? 'Commit được' : 'Dừng nhận ghi', hasQuorum && leader ? 'ok' : 'bad', hasQuorum ? 'Chịu được tối đa 2 node lỗi' : 'Mất đa số: hệ thống dừng để an toàn');

      if (!hasQuorum) {
        vd.set('bad', 'Không đủ Quorum (dưới 3/5 node)', 'Thuật toán đồng thuận ưu tiên tính an toàn (Safety) hơn tính sống (Liveness): khi dưới đa số node hoạt động, cụm từ chối bầu leader và từ chối commit để ngăn split-brain.');
      } else if (!leader) {
        vd.set('warn', 'Leader vừa sập — Cần bầu cử cho Term tiếp theo', 'Đang có đủ quorum sống. Bấm <b>“Bầu Leader mới (Term + 1)”</b>: ứng viên có log cập nhật nhất sẽ nhận phiếu bầu từ đa số node và trở thành Leader mới.');
      } else {
        vd.set('ok', `Cụm đồng thuận hoạt động ở Term ${curTerm} (Leader: ${leader.id})`, 'Bấm trực tiếp vào từng node trên hình để bật/tắt lỗi node, hoặc bấm <b>“Ghi lệnh mới qua Leader”</b> để nhân bản và commit mục log mới tới quorum.');
      }
    }
    render();
  });

  // =====================================================================
  // 10.9 Epoch numbering & Quorum overlap (Zombie Leader Fencing)
  // =====================================================================
  widget('c10-epoch', (root) => {
    const oldEpoch = slider({ label: 'Epoch của Leader cũ (zombie)', min: 1, max: 5, step: 1, value: 4, format: (v) => 'Epoch ' + v, onInput: render });
    const newEpoch = slider({ label: 'Epoch của Leader mới được bầu', min: 2, max: 7, step: 1, value: 5, format: (v) => 'Epoch ' + v, onInput: render });
    const voteQuorum = seg({
      label: 'Quorum bầu Leader mới',
      options: [
        { value: 'n234', label: '{N2, N3, N4}' },
        { value: 'n345', label: '{N3, N4, N5}' },
      ],
      value: 'n345',
      onChange: render,
    });
    const W = 640, H = 210;
    const svg = mkSvg(W, H, 'Giao nhau giữa Quorum bầu cử và Quorum ghi', 'mw');
    const mk = addMarkers(svg);
    const layer = s('g'); svg.appendChild(layer);
    const s1 = stat('Quorum đề xuất của Leader cũ', '{N1, N2, N3}', 'accent', '3/5 node'),
          s2 = stat('Quorum bầu Leader mới', '–'),
          s3 = stat('Node giao nhau (Overlap)', '–');
    const vd = verdict();
    root.append(
      h('div', { class: 'controls' }, oldEpoch.el, newEpoch.el, voteQuorum.el),
      h('div', { class: 'viz' }, svg),
      h('div', { class: 'stats' }, s1, s2, s3),
      vd
    );

    function render() {
      clear(layer);
      const eOld = oldEpoch.value, eNew = newEpoch.value;
      const qWrite = new Set(['N1', 'N2', 'N3']);
      const qVote = new Set(voteQuorum.value === 'n234' ? ['N2', 'N3', 'N4'] : ['N3', 'N4', 'N5']);
      const overlap = ['N1', 'N2', 'N3', 'N4', 'N5'].filter((n) => qWrite.has(n) && qVote.has(n));
      const fenced = eNew > eOld;

      // Draw Old Leader on left, New Leader on right, 5 nodes in middle
      layer.append(
        R(15, 75, 115, 56, 'f-bad-soft s-bad', { rx: 6 }),
        TM(72, 98, 'Leader cũ (N1)', 'lbl-strong sm f-bad'),
        TM(72, 116, `Đề xuất ở Epoch ${eOld}`, 'sm'),
        R(510, 75, 115, 56, 'f-ok-soft s-ok', { rx: 6 }),
        TM(567, 98, 'Leader mới (N5)', 'lbl-strong sm f-ok'),
        TM(567, 116, `Bầu ở Epoch ${eNew}`, 'sm')
      );

      ['N1', 'N2', 'N3', 'N4', 'N5'].forEach((nid, i) => {
        const ny = 18 + i * 38, nx = 245;
        const inW = qWrite.has(nid), inV = qVote.has(nid), both = inW && inV;
        const nodeEpoch = inV ? Math.max(eOld, eNew) : eOld;
        const cls = both ? 'f-mark-soft s-warn' : inV ? 'f-ok-soft s-ok' : 'f-accent-soft s-accent';
        layer.append(
          R(nx, ny, 150, 30, cls, { rx: 5 }),
          TM(nx + 75, ny + 19, `${nid} ( hứa ≥ Epoch ${nodeEpoch} )`, 'sm lbl-strong')
        );
        if (inW) {
          const rejected = both && fenced;
          layer.append(arrow(mk, 130, 103, nx - 4, ny + 15, rejected ? 'bad' : 'accent', rejected ? 'dash' : ''));
        }
        if (inV) {
          layer.append(arrow(mk, 510, 103, nx + 154, ny + 15, 'ok'));
        }
      });

      s2.update(`{${[...qVote].join(', ')}}`, 'ok', 'Đã ghi nhận Epoch ' + eNew);
      s3.update(overlap.join(', '), 'warn', 'Nằm trong cả 2 quorum');

      if (fenced) {
        vd.set('ok', `Leader cũ bị chặn (Fenced) tại node giao nhau: ${overlap.join(', ')}`,
          `Để được bầu ở <b>Epoch ${eNew}</b>, Leader mới phải thu thập phiếu từ một quorum 3/5 node. Khi Leader cũ (tưởng mình vẫn là leader ở <b>Epoch ${eOld}</b>) gửi đề xuất tới quorum <code>{N1, N2, N3}</code>, ít nhất node <b>${overlap.join(', ')}</b> đã hứa chỉ nghe Epoch ≥ ${eNew} nên lập tức <b>từ chối</b>. Hai leader không thể cùng commit!`);
      } else {
        vd.set('bad', 'Vi phạm đơn điệu Epoch!',
          `Epoch mới (${eNew}) không lớn hơn Epoch cũ (${eOld}). Trong thực tế, mọi cuộc bầu cử bắt buộc phải tăng số Epoch/Term đơn điệu để chặn zombie leader.`);
      }
    }
    render();
  });

  // =====================================================================
  // 10.10 ZooKeeper / etcd Coordination: Leases, Watches & Fencing Tokens
  // =====================================================================
  widget('c10-zk', (root) => {
    const ttl = slider({ label: 'Thời hạn Lease (Session TTL)', min: 2, max: 10, step: 1, value: 4, format: (v) => v + ' s', onInput: render });
    const gcPause = slider({ label: 'Node 1 bị GC pause kéo dài', min: 0, max: 10, step: 1, value: 6, format: (v) => v + ' s', onInput: render });
    const useFence = checkbox('Storage kiểm tra zxid / fencing token khi ghi', true, render);
    const W = 640, H = 225;
    const svg = mkSvg(W, H, 'ZooKeeper Ephemeral Node, Watch và Fencing Token', 'mw');
    const mk = addMarkers(svg);
    const layer = s('g'); svg.appendChild(layer);
    const s1 = stat('Trạng thái khoá /leader', '–'), s2 = stat('Watch thông báo N2', '–'), s3 = stat('An toàn dữ liệu Storage', '–');
    const vd = verdict();
    root.append(
      h('div', { class: 'controls' }, ttl.el, gcPause.el),
      useFence.el,
      h('div', { class: 'viz' }, svg),
      h('div', { class: 'stats' }, s1, s2, s3),
      vd
    );

    function render() {
      clear(layer);
      const Texp = ttl.value, Tgc = gcPause.value, fenced = useFence.input.checked;
      const expired = Tgc > Texp;
      const YZK = 45, YN1 = 105, YN2 = 155, YST = 205, X0 = 105, X1 = 615;
      const x = (t) => X0 + (Math.min(t, 12) / 12) * (X1 - X0);

      [['ZooKeeper', YZK], ['Node 1 (zxid=33)', YN1], ['Node 2 (zxid=34)', YN2], ['Storage Server', YST]].forEach(([lbl, y]) => {
        layer.append(L(X0, y, X1, y, 'grid'), T(8, y + 4, lbl, 'lbl-strong sm'));
      });

      // t=1: N1 creates ephemeral znode /leader (zxid=33)
      layer.append(
        C(x(1), YN1, 5, 'f-accent'),
        arrow(mk, x(1), YN1 - 4, x(1.4), YZK + 4, 'accent'),
        T(x(1.5), YZK - 8, 't=1s: Tạo ephemeral /leader (zxid=33)', 'sm f-accent')
      );

      // Pause bar on N1 from t=2 to t=2+Tgc
      const tResume = 2 + Tgc;
      if (Tgc > 0) {
        layer.append(
          R(x(2), YN1 - 11, x(tResume) - x(2), 22, 'f-bad-soft s-bad', { rx: 4 }),
          TM((x(2) + x(tResume)) / 2, YN1 + 4, `GC Pause (${Tgc}s) — mất heartbeat`, 'sm lbl-strong f-bad')
        );
      }

      if (expired) {
        const tExp = 2 + Texp;
        // Session expires at tExp -> ZK deletes /leader and triggers Watch to N2
        layer.append(
          C(x(tExp), YZK, 6, 'f-warn'),
          TM(x(tExp), YZK + 18, `Hết TTL (${tExp}s)`, 'sm f-warn lbl-strong'),
          arrow(mk, x(tExp), YZK + 4, x(tExp + 0.6), YN2 - 4, 'violet'),
          T(x(tExp + 0.7), YN2 - 8, 'Watch: /leader bị xoá → N2 nhận zxid=34', 'sm f-violet lbl-strong'),
          arrow(mk, x(tExp + 1.2), YN2 + 4, x(tExp + 1.8), YST - 4, 'ok'),
          T(x(tExp + 1.9), YST - 6, 'Ghi(token=34) → OK', 'sm f-ok lbl-strong')
        );
        // N1 wakes up at tResume and tries to write with zxid=33
        const tWrite1 = Math.min(11.4, Math.max(tResume + 0.3, tExp + 2.2));
        layer.append(
          arrow(mk, x(tResume), YN1 + 4, x(tWrite1), YST - 4, fenced ? 'bad' : 'warn', 'dash'),
          T(x(tWrite1) - 60, YST - 18, fenced ? 'Ghi(token=33 < 34) → TỪ CHỐI!' : 'Ghi(33) ĐÈ LÊN N2!', 'sm lbl-strong ' + (fenced ? 'f-bad' : 'f-warn'))
        );
      } else {
        layer.append(
          arrow(mk, x(tResume + 0.5), YN1 + 4, x(tResume + 1.2), YST - 4, 'ok'),
          T(x(tResume + 1.3), YST - 6, 'Heartbeat kịp trước TTL → N1 tiếp tục giữ khoá (zxid=33)', 'sm f-ok lbl-strong')
        );
      }

      s1.update(expired ? 'Chuyển sang Node 2' : 'Node 1 vẫn giữ', expired ? 'warn' : 'ok', expired ? `Ephemeral znode tự xoá lúc t=${2 + Texp}s` : 'Pause ngắn hơn TTL');
      s2.update(expired ? 'Đã kích hoạt (Push)' : 'Đang chờ (Idle)', expired ? 'accent' : 'ok', 'Không cần polling liên tục');
      s3.update(!expired || fenced ? 'An toàn tuyệt đối' : 'BỊ GHI ĐÈ (Split-brain!)', !expired || fenced ? 'ok' : 'bad', fenced ? 'Chặn zxid=33 vì đã thấy zxid=34' : 'Thiếu kiểm tra fencing token');

      if (!expired) {
        vd.set('ok', 'Lease còn hạn — Node 1 không mất quyền Leader',
          `Thời gian tạm dừng GC (${Tgc}s) ngắn hơn thời hạn Lease (${Texp}s), nên ZooKeeper vẫn giữ ephemeral node <code>/leader</code> của Node 1.`);
      } else if (fenced) {
        vd.set('ok', 'Chuyển đổi dự phòng tự động + Chặn Zombie bằng zxid',
          `Khi Node 1 ngừng gửi heartbeat quá ${Texp}s, ZooKeeper tự động xoá ephemeral node và bắn sự kiện <b>Watch</b> cho Node 2. Node 2 nhận khoá kèm số thứ tự giao dịch tuyến tính <code>zxid = 34</code>. Khi Node 1 tỉnh dậy với <code>zxid = 33</code>, Storage từ chối ngay.`);
      } else {
        vd.set('bad', 'Nguy hiểm: Khoá phân tán không có Fencing Token!',
          `Dù ZooKeeper cấp khoá tuyến tính hoá, nếu Storage không kiểm tra <code>zxid</code> tăng đơn điệu, Node 1 sau cơn GC pause vẫn ghi đè làm hỏng dữ liệu của Node 2.`);
      }
    }
    render();
  });

  // =====================================================================
  // Glossary for Chapter 10
  // =====================================================================
  glossary.add([
    { key: 'eventual-consistency', term: 'Eventual consistency', vi: 'Tính nhất quán cuối cùng', ch: 10, topic: 'ch10-eventual',
      def: 'Đảm bảo yếu rằng nếu ngừng ghi thêm dữ liệu mới, sau một khoảng thời gian mọi replica cuối cùng sẽ hội tụ về cùng một giá trị.' },
    { key: 'linearizability', term: 'Linearizability (atomic consistency)', vi: 'Tính tuyến tính hoá', ch: 10, topic: 'ch10-linearizability',
      def: 'Mô hình nhất quán mạnh nhất cho từng đối tượng đơn lẻ: hệ thống hành xử như thể chỉ có một bản sao dữ liệu duy nhất và mọi thao tác diễn ra nguyên tử tại một điểm thời gian giữa lúc bắt đầu và kết thúc.' },
    { key: 'recency-guarantee', term: 'Recency guarantee', vi: 'Đảm bảo độ tươi mới', ch: 10, topic: 'ch10-linearizability',
      def: 'Đảm bảo rằng một khi lần ghi hoặc đọc đã hoàn tất và thấy giá trị mới, mọi lần đọc bắt đầu sau đó bắt buộc phải thấy giá trị đó hoặc giá trị mới hơn.' },
    { key: 'linearization-point', term: 'Linearization point', vi: 'Điểm tuyến tính hoá', ch: 10, topic: 'ch10-history',
      def: 'Thời điểm tức thời nằm giữa lúc gửi yêu cầu và lúc nhận phản hồi mà tại đó thao tác đọc/ghi/CAS được coi là có hiệu lực nguyên tử.' },
    { key: 'compare-and-set', term: 'Compare-and-set (CAS)', vi: 'So sánh và gán nguyên tử', ch: 10, topic: 'ch10-history',
      def: 'Thao tác nguyên tử chỉ ghi giá trị mới vào thanh ghi nếu giá trị hiện tại của nó đúng bằng giá trị cũ mà client kỳ vọng.' },
    { key: 'serializability', term: 'Serializability', vi: 'Tính khả tuần tự', ch: 10, topic: 'ch10-lin-vs-ser',
      def: 'Tính chất cô lập của giao dịch nhiều đối tượng đảm bảo kết quả tương đương với một thứ tự thực thi tuần tự nào đó (không nhất thiết khớp với thời gian thực).' },
    { key: 'strict-serializability', term: 'Strict serializability (one-copy serializability)', vi: 'Tính khả tuần tự nghiêm ngặt', ch: 10, topic: 'ch10-lin-vs-ser',
      def: 'Kết hợp cả serializability và linearizability: thứ tự tuần tự của các transaction phải tuân theo đúng thứ tự thời gian thực.' },
    { key: 'cap-theorem', term: 'CAP theorem', vi: 'Định lý CAP', ch: 10, topic: 'ch10-lin-vs-ser',
      def: 'Phát biểu rằng khi xảy ra phân vùng mạng (Network Partition), hệ thống phải chọn giữa tính tuyến tính hoá (Consistency) và khả năng mọi node vẫn trả lời yêu cầu (Availability).' },
    { key: 'causal-consistency', term: 'Causal consistency', vi: 'Tính nhất quán nhân quả', ch: 10, topic: 'ch10-causal',
      def: 'Mức nhất quán bảo toàn thứ tự nhân quả: nếu thao tác A xảy ra trước và dẫn tới thao tác B, mọi node trong hệ thống đều phải thấy A trước B.' },
    { key: 'lamport-timestamp', term: 'Lamport timestamp', vi: 'Dấu thời gian Lamport', ch: 10, topic: 'ch10-causal',
      def: 'Cặp (bộ đếm logic, ID node) do Leslie Lamport đề xuất năm 1978, cung cấp một thứ tự toàn phần luôn tương thích với quan hệ nhân quả mà không cần đồng hồ vật lý.' },
    { key: 'total-order-broadcast', term: 'Total order broadcast (atomic broadcast)', vi: 'Phát quảng bá thứ tự toàn phần', ch: 10, topic: 'ch10-tob',
      def: 'Giao thức truyền thông điệp giữa các node đảm bảo hai tính chất: giao tin tin cậy (không mất tin) và giao tin theo đúng cùng một thứ tự ở mọi node.' },
    { key: 'state-machine-replication', term: 'State machine replication', vi: 'Nhân bản máy trạng thái', ch: 10, topic: 'ch10-tob',
      def: 'Nguyên lý rằng nếu mọi replica bắt đầu từ cùng trạng thái và xử lý cùng một chuỗi sự kiện tất định theo đúng thứ tự của total order broadcast, chúng sẽ luôn ở cùng trạng thái.' },
    { key: 'two-phase-commit', term: 'Two-phase commit (2PC)', vi: 'Cam kết hai pha', ch: 10, topic: 'ch10-2pc',
      def: 'Giao thức atomic commit cho giao dịch phân tán gồm pha chuẩn bị (bỏ phiếu) và pha quyết định (commit/abort) dưới sự điều phối của một coordinator.' },
    { key: 'coordinator', term: 'Coordinator (transaction manager)', vi: 'Bộ điều phối giao dịch', ch: 10, topic: 'ch10-2pc',
      def: 'Thành phần gửi yêu cầu Prepare tới các node tham gia trong 2PC, thu thập phiếu bầu và ghi quyết định cuối cùng vào write-ahead log.' },
    { key: 'in-doubt', term: 'In-doubt (uncertain) transaction', vi: 'Giao dịch chưa rõ số phận', ch: 10, topic: 'ch10-2pc',
      def: 'Trạng thái của một participant trong 2PC sau khi đã bỏ phiếu CÓ ở Pha 1 nhưng chưa nhận được quyết định từ coordinator; node bắt buộc phải giữ khoá và chờ.' },
    { key: 'xa-transactions', term: 'XA transactions', vi: 'Giao dịch chuẩn X/Open XA', ch: 10, topic: 'ch10-2pc',
      def: 'Chuẩn công nghiệp cho phép điều phối giao dịch hai pha xuyên qua nhiều cơ sở dữ liệu và message broker khác loại.' },
    { key: 'consensus', term: 'Fault-tolerant consensus', vi: 'Đồng thuận chịu lỗi', ch: 10, topic: 'ch10-raft',
      def: 'Bài toán làm cho nhiều node thống nhất về một quyết định sao cho thoả mãn: đồng thuận (agreement), toàn vẹn (integrity), hợp lệ (validity) và kết thúc (termination) khi đa số node còn sống.' },
    { key: 'flp-impossibility', term: 'FLP impossibility', vi: 'Định lý bất khả thi FLP', ch: 10, topic: 'ch10-raft',
      def: 'Kết quả của Fischer, Lynch và Paterson (1985) chứng minh không có thuật toán tất định nào luôn đạt đồng thuận trong mô hình mạng bất đồng bộ hoàn toàn nếu dù chỉ 1 node có thể sập.' },
    { key: 'epoch-number', term: 'Epoch number (term / ballot / view)', vi: 'Số thứ tự nhiệm kỳ (epoch/term)', ch: 10, topic: 'ch10-epoch',
      def: 'Con số tăng đơn điệu gắn với mỗi lần bầu leader trong Paxos, Raft, Zab; trong mỗi epoch chỉ có duy nhất một leader hợp lệ.' },
    { key: 'zookeeper', term: 'ZooKeeper / etcd', vi: 'Dịch vụ điều phối phân tán', ch: 10, topic: 'ch10-zk',
      def: 'Kho khoá–giá trị nhỏ dùng thuật toán đồng thuận để cung cấp đọc/ghi tuyến tính hoá, bầu chọn leader, quản lý cấu hình, khoá phân tán và thông báo thay đổi (watch).' },
    { key: 'ephemeral-node', term: 'Ephemeral node', vi: 'Nút tạm thời theo phiên', ch: 10, topic: 'ch10-zk',
      def: 'Loại bản ghi trong ZooKeeper gắn với phiên kết nối của client và tự động bị xoá ngay khi phiên hết hạn do mất heartbeat.' },
    { key: 'watch', term: 'Watch notification', vi: 'Thông báo theo dõi thay đổi', ch: 10, topic: 'ch10-zk',
      def: 'Cơ chế của ZooKeeper/etcd cho phép client đăng ký chờ một khoá thay đổi và được server thông báo ngay mà không cần polling.' },
  ]);
})();
