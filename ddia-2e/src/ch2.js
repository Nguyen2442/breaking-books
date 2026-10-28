/* Chapter 2 — Defining Nonfunctional Requirements: widgets + glossary */
(function () {
  const { h, s, clear, fmt, fmtBig, fmtMs, pct, rng, normal, percentile, clamp, sleep,
          slider, seg, button, checkbox, stat, log, widget, glossary, reducedMotion } = window.DDIA;

  // ---------- shared chart helper ----------
  /** chart({w,h,m:{l,r,t,b}, x:[min,max], y:[min,max], logY, xTicks, yTicks, xFmt, yFmt, xLabel, yLabel}) */
  function chart(o) {
    const W = o.w || 640, H = o.h || 260, m = Object.assign({ l: 70, r: 16, t: 14, b: 38 }, o.m || {});
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': o.aria || '' });
    const [x0, x1] = o.x, [y0, y1] = o.y;
    const ly = (v) => Math.log10(Math.max(v, y0));
    const x = (v) => m.l + ((v - x0) / (x1 - x0)) * (W - m.l - m.r);
    const y = o.logY
      ? (v) => H - m.b - ((ly(v) - Math.log10(y0)) / (Math.log10(y1) - Math.log10(y0))) * (H - m.t - m.b)
      : (v) => H - m.b - ((v - y0) / (y1 - y0)) * (H - m.t - m.b);
    const g = s('g');
    (o.yTicks || []).forEach((t) => {
      g.appendChild(s('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: 'grid' }));
      g.appendChild(s('text', { x: m.l - 6, y: y(t) + 4, 'text-anchor': 'end' }, o.yFmt ? o.yFmt(t) : String(t)));
    });
    (o.xTicks || []).forEach((t) => {
      g.appendChild(s('line', { x1: x(t), x2: x(t), y1: H - m.b, y2: H - m.b + 4, class: 'axis' }));
      g.appendChild(s('text', { x: x(t), y: H - m.b + 16, 'text-anchor': 'middle' }, o.xFmt ? o.xFmt(t) : String(t)));
    });
    g.appendChild(s('line', { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b, class: 'axis' }));
    g.appendChild(s('line', { x1: m.l, x2: m.l, y1: m.t, y2: H - m.b, class: 'axis' }));
    if (o.xLabel) g.appendChild(s('text', { x: (m.l + W - m.r) / 2, y: H - 4, 'text-anchor': 'middle' }, o.xLabel));
    if (o.yLabel) g.appendChild(s('text', { x: 12, y: (m.t + H - m.b) / 2, 'text-anchor': 'middle', transform: `rotate(-90 12 ${(m.t + H - m.b) / 2})` }, o.yLabel));
    svg.appendChild(g);
    const layer = s('g');
    svg.appendChild(layer);
    return { svg, x, y, layer, W, H, m };
  }
  const pathOf = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const viz = (svg) => h('div', { class: 'viz' }, svg);

  // ============ 2.1 req-sort ============
  widget('req-sort', (root) => {
    const KINDS = [
      ['', '— chọn loại —'], ['f', 'Chức năng'], ['perf', 'Phi chức năng · hiệu năng'], ['rel', 'Phi chức năng · độ tin cậy'],
      ['scale', 'Phi chức năng · mở rộng'], ['maint', 'Phi chức năng · bảo trì'], ['other', 'Phi chức năng · khác (bảo mật, pháp lý)'],
    ];
    const CARDS = [
      { t: 'Người dùng tìm nhà hàng theo tên món ăn.', a: ['f'], why: 'Mô tả app làm gì: một tính năng cụ thể.' },
      { t: 'Trang danh sách nhà hàng tải dưới 300 ms cho 99% lượt xem.', a: ['perf'], why: 'Mục tiêu response time đo bằng percentile (p99): yêu cầu hiệu năng.' },
      { t: 'Khi một máy chủ thanh toán hỏng, khách vẫn đặt được đơn.', a: ['rel'], why: 'Fault của một thành phần không được biến thành failure: độ tin cậy, chịu lỗi.' },
      { t: 'Giờ trưa tải gấp 8 lần; phải phục vụ được bằng cách thêm máy.', a: ['scale'], why: 'Câu hỏi về cách thêm tài nguyên khi tải tăng: khả năng mở rộng.' },
      { t: 'Kỹ sư mới thêm được một phương thức thanh toán trong một tuần.', a: ['maint'], why: 'Hệ thống dễ hiểu và dễ thay đổi: simplicity và evolvability.' },
      { t: 'Khách có thể huỷ đơn trong vòng 2 phút sau khi đặt.', a: ['f'], why: 'Có con số “2 phút” nhưng vẫn là một quy tắc nghiệp vụ, tức chức năng.' },
      { t: 'Không mất đơn đã xác nhận kể cả khi cả một datacenter mất điện.', a: ['rel'], why: 'Chịu mất cả datacenter: độ tin cậy ở mức availability zone.' },
      { t: 'Đội vận hành vá hệ điều hành mà không cần dừng dịch vụ.', a: ['maint', 'rel'], why: 'Operability (bảo trì) nhờ rolling upgrade; cũng có thể xem là độ tin cậy vì tránh downtime có kế hoạch.' },
      { t: 'Dữ liệu vị trí của khách được xoá khi không còn cần cho mục đích đã nêu.', a: ['other'], why: 'Yêu cầu pháp lý (GDPR, data minimization), ngoài bốn loại chính của chương.' },
    ];
    const score = stat('Điểm', '—', '', 'Chưa kiểm tra');
    const grid = h('div', { class: 'req-grid' });
    const rows = CARDS.map((c, i) => {
      const id = 'req-' + i;
      const sel = h('select', { id, 'aria-label': 'Loại yêu cầu' }, KINDS.map(([v, l]) => h('option', { value: v }, l)));
      const why = h('p', { class: 'why', hidden: true }, c.why);
      const card = h('div', { class: 'req-card' }, h('p', c.t), sel, why);
      grid.appendChild(card);
      return { c, sel, why, card };
    });
    const check = () => {
      let ok = 0;
      rows.forEach((r) => {
        const right = r.c.a.includes(r.sel.value);
        if (right) ok++;
        r.card.classList.toggle('right', right);
        r.card.classList.toggle('wrong', !right);
        r.why.hidden = false;
        r.why.textContent = (right ? 'Đúng. ' : 'Đáp án: ' + r.c.a.map((k) => KINDS.find((x) => x[0] === k)[1]).join(' hoặc ') + '. ') + r.c.why;
      });
      score.update(`${ok}/${rows.length}`, ok === rows.length ? 'ok' : ok >= rows.length / 2 ? 'accent' : 'warn', ok === rows.length ? 'Chính xác hết' : 'Đọc giải thích ở từng thẻ');
    };
    const reset = () => { rows.forEach((r) => { r.sel.value = ''; r.card.classList.remove('right', 'wrong'); r.why.hidden = true; }); score.update('—', '', 'Chưa kiểm tra'); };
    root.append(grid, h('div', { class: 'controls' }, h('div', { class: 'btn-row' }, button('Kiểm tra', check), button('Làm lại', reset, 'ghost')), h('div', { class: 'stats', style: { flex: '1 1 160px' } }, score)));
  });

  // ============ 2.2 timeline-calc ============
  widget('timeline-calc', (root) => {
    const posts = slider({ label: 'Bài đăng mỗi giây', min: 1000, max: 150000, step: 100, value: 5700, format: (v) => fmt(v), onInput: render });
    const fol = slider({ label: 'Số người theo dõi / follower trung bình', min: 10, max: 2000, step: 10, value: 200, format: (v) => fmt(v), onInput: render });
    const online = slider({ label: 'Người dùng online cùng lúc', min: 1, max: 100, step: 1, value: 10, format: (v) => fmt(v) + ' triệu', onInput: render });
    const poll = slider({ label: 'Chu kỳ polling', min: 1, max: 60, step: 1, value: 5, format: (v) => v + ' s', onInput: render });
    const sQ = stat('Pull: truy vấn timeline/giây', '');
    const sL = stat('Pull: tra bài theo người gửi/giây', '', 'bad');
    const sW = stat('Push: ghi timeline/giây', '', 'accent');
    const sR = stat('Pull tốn gấp', '', 'warn', 'so với push');
    const bars = h('div', { class: 'bars' });
    const lo = 3, hi = 12; // log10 range
    function bar(label, v, cls) {
      const w = clamp((Math.log10(Math.max(v, 1)) - lo) / (hi - lo), 0.02, 1) * 100;
      return h('div', { class: 'bar-row' }, h('span', label), h('div', { class: 'track' }, h('div', { class: 'fill', style: { width: w + '%', background: `var(--${cls})` } }), h('span', fmtBig(v) + '/s')));
    }
    function render() {
      const q = (online.value * 1e6) / poll.value;
      const lookups = q * fol.value;
      const writes = posts.value * fol.value;
      sQ.update(fmtBig(q));
      sL.update(fmtBig(lookups));
      sW.update(fmtBig(writes));
      sR.update(fmt(lookups / writes, 1) + '×', lookups > writes ? 'warn' : 'ok', lookups > writes ? 'so với push' : 'push đắt hơn pull ở giả định này');
      clear(bars).append(
        bar('Pull · truy vấn timeline', q, 'ink-3'),
        bar('Pull · tra bài từng người gửi', lookups, 'bad'),
        bar('Push · ghi vào timeline', writes, 'accent'),
        h('p', { class: 'lab-note' }, 'Thang log: thanh dài gấp đôi không có nghĩa gấp đôi; mỗi 1/9 độ dài là ×10 (từ 1 nghìn đến 1.000 tỷ/giây).'));
    }
    const presets = h('div', { class: 'btn-row' },
      button('Số liệu trong sách', () => { posts.set(5700); fol.set(200); online.set(10); poll.set(5); render(); }, 'ghost'),
      button('Đỉnh 150.000 bài/s', () => { posts.set(150000); render(); }, 'ghost'));
    root.append(h('div', { class: 'controls' }, posts.el, fol.el, online.el, poll.el), presets,
      h('div', { class: 'stats' }, sQ, sL, sW, sR), bars,
      h('p', { class: 'lab-note' }, 'Ở đỉnh 150.000 bài/s, push cần khoảng 30 triệu lần ghi/giây. Sách gợi ý: xếp hàng các lần giao bài và chấp nhận bài hiện chậm vài giây; timeline vẫn đọc nhanh từ cache.'));
    render();
  });

  // ============ 2.3 fanout-sim ============
  widget('fanout-sim', (root) => {
    const USERS = ['An', 'Bình', 'Chi', 'Dũng', 'Hà', 'Khoa'];
    const FOLLOWERS = { An: ['Bình', 'Chi', 'Hà'], Bình: ['An', 'Dũng'], Chi: ['An', 'Khoa', 'Hà'], Dũng: ['Bình', 'Chi'], Hà: ['Khoa'], Khoa: ['An', 'Dũng', 'Hà'] };
    const CELEB_FOLLOWERS = 1000000; // 6 shown + 999,994 others
    const W = 600, H = 330, cx = 300, cy = 160, R = 120;
    const pos = { Sao: [cx, cy] };
    USERS.forEach((u, i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / USERS.length; pos[u] = [cx + R * 1.55 * Math.cos(a), cy + R * Math.sin(a)]; });
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Đồ thị follower' });
    const edgeG = s('g'), dotG = s('g'), nodeG = s('g');
    svg.append(edgeG, dotG, nodeG);
    const edges = {};
    const addEdge = (a, b, cls) => {
      const [x1, y1] = pos[a], [x2, y2] = pos[b];
      const ln = s('line', { x1, y1, x2, y2, class: 's-line f-none', 'stroke-width': 1.2 });
      edgeG.appendChild(ln);
      edges[a + '>' + b] = ln;
    };
    USERS.forEach((u) => FOLLOWERS[u].forEach((f) => { if (!edges[f + '>' + u]) addEdge(u, f); else edges[u + '>' + f] = edges[f + '>' + u]; }));
    USERS.forEach((u) => addEdge('Sao', u));
    const nodeEls = {};
    const mkNode = (name, r, cls, label) => {
      const [x, y] = pos[name];
      const g = s('g', { class: 'node clickable', tabindex: 0, role: 'button', 'aria-label': name + ' đăng bài' },
        s('circle', { cx: x, cy: y, r, class: cls + ' s-ink' }),
        s('text', { x, y: y + 4, 'text-anchor': 'middle', class: 'lbl-strong' }, name));
      if (label) g.appendChild(s('text', { x, y: y + r + 14, 'text-anchor': 'middle' }, label));
      g.addEventListener('click', () => post(name));
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); post(name); } });
      nodeG.appendChild(g);
      nodeEls[name] = g;
    };
    USERS.forEach((u) => mkNode(u, 22, 'f-surface', FOLLOWERS[u].length + ' follower'));
    mkNode('Sao', 32, 'f-mark-soft', fmt(CELEB_FOLLOWERS) + ' follower');

    const timelines = Object.fromEntries(USERS.map((u) => [u, []]));
    const celebStore = [];
    const counts = { An: 0, Bình: 0, Chi: 0, Dũng: 0, Hà: 0, Khoa: 0, Sao: 0 };
    let totalWrites = 0, busy = false, seq = 0;
    const hybrid = checkbox('Xử lý riêng người nổi tiếng (trộn lúc đọc)', false, () => renderTL());
    const sTotal = stat('Tổng lần ghi timeline', '0', 'accent');
    const sLast = stat('Bài vừa đăng gây ra', '—');
    const sRead = stat('Việc thêm mỗi lần đọc timeline', '0', '', 'không cần trộn');
    const tlWrap = h('div', { class: 'tl-boxes' });
    const store = h('div', { class: 'tl-box' });

    function renderTL() {
      clear(tlWrap);
      USERS.forEach((u) => {
        let items = timelines[u].slice();
        if (hybrid.value) items = items.concat(celebStore.map((p) => ({ ...p, merged: true })));
        items.sort((a, b) => b.seq - a.seq);
        tlWrap.appendChild(h('div', { class: 'tl-box' }, h('b', 'Timeline của ' + u),
          items.slice(0, 5).map((p) => h('div', { class: 'it' + (p.from === 'Sao' ? ' celeb' : '') + (p.merged ? ' merged' : ''), title: p.merged ? 'Trộn vào lúc đọc' : 'Đã materialize' }, p.label)),
          items.length > 5 ? h('div', { class: 'lab-note' }, '+' + (items.length - 5) + ' bài cũ hơn') : null));
      });
      clear(store).append(h('b', 'Kho bài người nổi tiếng'), celebStore.length ? celebStore.slice(-4).reverse().map((p) => h('div', { class: 'it merged' }, p.label)) : h('div', { class: 'lab-note' }, hybrid.value ? 'Chưa có bài' : 'Không dùng (đang fan-out)'));
      tlWrap.appendChild(store);
      sRead.update(hybrid.value ? '1 truy vấn trộn' : '0', hybrid.value ? 'warn' : '', hybrid.value ? 'mỗi người theo dõi Sao' : 'không cần trộn');
    }

    function animateDot(from, to, cls) {
      const [x1, y1] = pos[from], [x2, y2] = pos[to];
      if (reducedMotion) return Promise.resolve();
      const dot = s('circle', { cx: x1, cy: y1, r: 5, class: cls });
      dotG.appendChild(dot);
      return new Promise((res) => {
        const t0 = performance.now(), dur = 450;
        const step = (t) => {
          const k = Math.min(1, (t - t0) / dur);
          dot.setAttribute('cx', x1 + (x2 - x1) * k); dot.setAttribute('cy', y1 + (y2 - y1) * k);
          if (k < 1) requestAnimationFrame(step); else { dot.remove(); res(); }
        };
        requestAnimationFrame(step);
      });
    }

    async function post(name) {
      if (busy) return;
      busy = true;
      counts[name]++;
      const p = { from: name, label: `${name} #${counts[name]}`, seq: ++seq };
      const targets = name === 'Sao' ? USERS : FOLLOWERS[name];
      Object.values(edges).forEach((e) => e.setAttribute('class', 's-line f-none'));
      if (name === 'Sao' && hybrid.value) {
        celebStore.push(p);
        totalWrites += 1;
        sLast.update('1 lần ghi', 'ok', 'lưu riêng, follower trộn khi đọc');
      } else {
        targets.forEach((t) => edges[name + '>' + t]?.setAttribute('class', name === 'Sao' ? 's-mark f-none' : 's-accent f-none'));
        await Promise.all(targets.map((t) => animateDot(name, t, name === 'Sao' ? 'f-mark' : 'f-accent')));
        targets.forEach((t) => timelines[t].push(p));
        const n = name === 'Sao' ? CELEB_FOLLOWERS : targets.length;
        totalWrites += n;
        sLast.update(fmt(n) + ' lần ghi', name === 'Sao' ? 'bad' : '', name === 'Sao' ? 'fan-out tới mọi follower' : 'mỗi follower một lần');
      }
      sTotal.update(fmt(totalWrites));
      renderTL();
      busy = false;
    }
    const reset = () => {
      USERS.forEach((u) => (timelines[u] = []));
      celebStore.length = 0; totalWrites = 0; seq = 0;
      Object.keys(counts).forEach((k) => (counts[k] = 0));
      sTotal.update('0'); sLast.update('—', '', '');
      Object.values(edges).forEach((e) => e.setAttribute('class', 's-line f-none'));
      renderTL();
    };
    root.append(viz(svg), h('div', { class: 'controls' }, hybrid.el, h('div', { class: 'btn-row' }, button('Sao đăng bài', () => post('Sao')), button('An đăng bài', () => post('An'), 'ghost'), button('Xoá timeline', reset, 'ghost'))),
      h('div', { class: 'stats' }, sTotal, sLast, sRead), tlWrap,
      h('p', { class: 'lab-note' }, 'Ô xanh: bài đã được ghi sẵn vào timeline. Ô vàng: bài của Sao được fan-out. Ô tím: bài của Sao trộn vào lúc đọc.'));
    // open with a little history
    counts.Bình = 1; counts.Chi = 1;
    timelines.An.push({ from: 'Bình', label: 'Bình #1', seq: ++seq }); timelines.Dũng.push({ from: 'Bình', label: 'Bình #1', seq });
    ['An', 'Khoa', 'Hà'].forEach((u) => timelines[u].push({ from: 'Chi', label: 'Chi #1', seq: seq + 1 })); seq++;
    totalWrites = 5; sTotal.update('5');
    renderTL();
  });

  // ============ 2.4 queue-curve ============
  widget('queue-curve', (root) => {
    const S = 10; // ms service time, capacity 100 req/s
    const c = chart({ x: [0, 100], y: [0, 1000], xTicks: [0, 20, 40, 60, 80, 100], yTicks: [0, 200, 400, 600, 800, 1000], xFmt: (v) => v + '%', yFmt: (v) => v + ' ms', xLabel: 'Mức sử dụng (throughput / công suất)', yLabel: 'Response time', aria: 'Đường cong response time' });
    const ptsMean = [], ptsP99 = [];
    for (let u = 0; u <= 99.5; u += 0.5) {
      const r = S / (1 - u / 100);
      ptsMean.push([c.x(u), c.y(Math.min(r, 1000))]);
      ptsP99.push([c.x(u), c.y(Math.min(r * Math.log(100), 1000))]);
    }
    c.layer.append(
      s('path', { d: pathOf(ptsP99), class: 's-warn f-none', 'stroke-width': 2, 'stroke-dasharray': '5 4' }),
      s('path', { d: pathOf(ptsMean), class: 's-accent f-none', 'stroke-width': 2.5 }));
    const mk = s('g');
    c.layer.appendChild(mk);
    c.layer.append(s('text', { x: c.x(4), y: c.y(940), class: 'lbl-strong' }, 'Đường liền: trung bình · Đường đứt: p99'));
    const u = slider({ label: 'Mức sử dụng', min: 0, max: 98, step: 1, value: 60, format: (v) => v + '%', onInput: render });
    const sR = stat('Response time trung bình', ''), sP = stat('p99', ''), sQ = stat('Request đang chờ (trung bình)', ''), sT = stat('Throughput', '');
    function render() {
      const rho = u.value / 100, r = S / (1 - rho), p99 = r * Math.log(100);
      clear(mk).append(
        s('line', { x1: c.x(u.value), x2: c.x(u.value), y1: c.y(0), y2: c.y(Math.min(p99, 1000)), class: 's-ink3 f-none dash' }),
        s('circle', { cx: c.x(u.value), cy: c.y(Math.min(r, 1000)), r: 6, class: 'f-accent s-ink' }),
        s('circle', { cx: c.x(u.value), cy: c.y(Math.min(p99, 1000)), r: 5, class: 'f-warn s-ink' }));
      const tone = rho < 0.7 ? 'ok' : rho < 0.9 ? 'warn' : 'bad';
      sR.update(fmtMs(r), tone, 'gấp ' + fmt(r / S, 1) + '× service time');
      sP.update(fmtMs(p99), tone);
      sQ.update(fmt(rho * rho / (1 - rho), 1));
      sT.update(fmt(rho * 100) + ' req/s', '', 'công suất 100 req/s');
    }
    root.append(h('div', { class: 'controls' }, u.el), h('div', { class: 'stats' }, sR, sP, sQ, sT), viz(c.svg),
      h('p', { class: 'lab-note' }, 'Mô hình M/M/1: thời gian phục vụ S = 10 ms, request đến ngẫu nhiên. Trung bình = S/(1 − ρ); với phân bố mũ, p99 ≈ 4,6 × trung bình. Từ 50% lên 90% sử dụng, response time tăng gấp 5.'));
    render();
  });

  // ============ 2.4 retry-storm ============
  widget('retry-storm', (root) => {
    const T = 120, CAP = 100, BASE = 80, SPIKE = [20, 30], SPIKE_LOAD = 180, TIMEOUT = 3, MAXTRY = 3;
    const optRetry = checkbox('Client gửi lại khi timeout', true, () => run(false));
    const optBackoff = checkbox('Exponential backoff + jitter, giới hạn retry (token bucket)', false, () => run(false));
    const optShed = checkbox('Server load shedding (bỏ request đã quá hạn, từ chối khi hàng quá dài)', false, () => run(false));
    const sGood = stat('Goodput 20 giây cuối', ''), sQ = stat('Hàng đợi cuối', ''), sState = stat('Trạng thái', '');
    const holder = h('div');
    let running = false;

    function simulate() {
      const r = rng(7);
      let queue = []; // {t: enqueue tick, born, attempt}
      const retryAt = new Map();
      let tokens = 10;
      const out = [];
      for (let t = 0; t < T; t++) {
        const fresh = BASE + (t >= SPIKE[0] && t < SPIKE[1] ? SPIKE_LOAD - BASE : 0);
        let arrivals = [];
        for (let i = 0; i < fresh; i++) arrivals.push({ t, attempt: 1 });
        const ret = retryAt.get(t) || [];
        retryAt.delete(t);
        arrivals = arrivals.concat(ret.map((a) => ({ t, attempt: a })));
        const offered = arrivals.length;
        const timedOut = [];
        // load shedding: reject on arrival if queue too long
        if (optShed.value) {
          const room = Math.max(0, CAP * TIMEOUT - queue.length);
          if (arrivals.length > room) arrivals.splice(room).forEach((a) => timedOut.push(a));
        }
        queue = queue.concat(arrivals);
        // shed stale requests before working on them (no cost)
        if (optShed.value) queue = queue.filter((q) => t - q.t < TIMEOUT);
        // process CAP requests from head
        let good = 0;
        const batch = queue.splice(0, CAP);
        batch.forEach((q) => { if (t - q.t < TIMEOUT) good++; });
        // clients whose request has waited TIMEOUT ticks give up now (request stays queued unless shed)
        queue.forEach((q) => { if (t - q.t === TIMEOUT - 1) timedOut.push(q); });
        if (optRetry.value) {
          if (optBackoff.value) tokens = Math.min(50, tokens + fresh * 0.1);
          timedOut.forEach((q) => {
            if (q.attempt >= MAXTRY) return;
            let delay = 1;
            if (optBackoff.value) {
              if (tokens < 1) return;
              tokens -= 1;
              delay = Math.max(1, Math.round(Math.pow(2, q.attempt) * 2 * (0.5 + r())));
            }
            const at = t + delay;
            if (!retryAt.has(at)) retryAt.set(at, []);
            retryAt.get(at).push(q.attempt + 1);
          });
        }
        out.push({ t, offered, good, q: queue.length });
      }
      return out;
    }

    function draw(data, upto) {
      const maxQ = Math.max(600, ...data.map((d) => d.q));
      const c1 = chart({ h: 220, x: [0, T], y: [0, 400], xTicks: [0, 20, 40, 60, 80, 100, 120], yTicks: [0, 100, 200, 300, 400], xFmt: (v) => v + 's', yLabel: 'request/giây', aria: 'Tải và goodput theo thời gian' });
      c1.layer.append(
        s('rect', { x: c1.x(SPIKE[0]), y: c1.y(400), width: c1.x(SPIKE[1]) - c1.x(SPIKE[0]), height: c1.y(0) - c1.y(400), class: 'f-mark-soft' }),
        s('text', { x: c1.x(SPIKE[0]) + 4, y: c1.y(380) }, 'đột biến'),
        s('line', { x1: c1.x(0), x2: c1.x(T), y1: c1.y(CAP), y2: c1.y(CAP), class: 's-ink3 f-none dash' }),
        s('text', { x: c1.x(T) - 4, y: c1.y(CAP) - 5, 'text-anchor': 'end' }, 'công suất 100'));
      const d = data.slice(0, upto);
      c1.layer.append(
        s('path', { d: pathOf(d.map((p) => [c1.x(p.t), c1.y(Math.min(p.offered, 400))])), class: 's-bad f-none', 'stroke-width': 2 }),
        s('path', { d: pathOf(d.map((p) => [c1.x(p.t), c1.y(p.good)])), class: 's-ok f-none', 'stroke-width': 2.5 }),
        s('text', { x: c1.x(62), y: c1.y(380), class: 'lbl-strong' }, 'Đỏ: tải đến (gồm retry) · Xanh: goodput'));
      const c2 = chart({ h: 150, x: [0, T], y: [0, maxQ], xTicks: [0, 20, 40, 60, 80, 100, 120], yTicks: [0, Math.round(maxQ / 2), maxQ], xFmt: (v) => v + 's', xLabel: 'Thời gian', yLabel: 'hàng đợi', aria: 'Độ dài hàng đợi' });
      c2.layer.append(s('path', { d: pathOf(d.map((p) => [c2.x(p.t), c2.y(p.q)])) + (d.length ? ` L${c2.x(d[d.length - 1].t)} ${c2.y(0)} L${c2.x(0)} ${c2.y(0)} Z` : ''), class: 'f-violet-soft s-violet', 'stroke-width': 1.5 }));
      clear(holder).append(viz(c1.svg), viz(c2.svg));
    }
    function summarize(data) {
      const tail = data.slice(-20);
      const good = tail.reduce((a, b) => a + b.good, 0) / tail.length;
      const q = data[data.length - 1].q;
      sGood.update(fmt(good) + ' req/s', good >= BASE * 0.95 ? 'ok' : 'bad', 'tải gốc ' + BASE + ' req/s');
      sQ.update(fmt(q), q < CAP ? 'ok' : 'bad');
      const ok = good >= BASE * 0.95;
      sState.update(ok ? 'Đã hồi phục' : 'Kẹt quá tải', ok ? 'ok' : 'bad', ok ? 'sau khi hết đột biến' : 'dù tải gốc đã trở lại 80');
    }
    async function run(animate) {
      const data = simulate();
      if (!animate || reducedMotion) { draw(data, data.length); summarize(data); return; }
      if (running) return;
      running = true; runBtn.disabled = true;
      for (let k = 2; k <= data.length; k += 2) { draw(data, k); await sleep(25); }
      summarize(data);
      running = false; runBtn.disabled = false;
    }
    const runBtn = button('Chạy mô phỏng', () => run(true));
    root.append(h('div', { class: 'controls' }, h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } }, optRetry.el, optBackoff.el, optShed.el), runBtn),
      h('div', { class: 'stats' }, sGood, sQ, sState), holder,
      h('p', { class: 'lab-note' }, 'Mô hình: công suất 100 req/s, tải gốc 80 req/s, đột biến 180 req/s từ giây 20 đến 30; client timeout sau 3 s và thử tối đa 3 lần. Không có load shedding, server vẫn tốn công xử lý request mà client đã bỏ đi, nên goodput về 0. Số liệu minh hoạ.'));
    run(false);
  });

  // ============ 2.5 hol-blocking ============
  widget('hol-blocking', (root) => {
    const NET = 15, GAP = 5;
    let reqs = [20, 20, 400, 20, 20, 20];
    const workers = seg({ options: [{ value: 1, label: '1 worker' }, { value: 2, label: '2 worker' }], value: 1, onChange: render });
    const sSrv = stat('Service time trung bình (server đo)', ''), sCli = stat('Response time trung bình (client thấy)', ''), sVictim = stat('Request nhanh chậm nhất', '');
    const holder = h('div');
    function compute() {
      const free = new Array(workers.value).fill(0);
      return reqs.map((svc, i) => {
        const sent = i * GAP, arrive = sent + NET;
        let w = 0; for (let k = 1; k < free.length; k++) if (free[k] < free[w]) w = k;
        const start = Math.max(arrive, free[w]);
        const end = start + svc;
        free[w] = end;
        return { i, svc, sent, arrive, start, end, done: end + NET, queue: start - arrive, resp: end + NET - sent };
      });
    }
    function render() {
      const rows = compute();
      const tMax = Math.max(...rows.map((r) => r.done)) * 1.05;
      const rowH = 26, top = 10, W = 640, left = 70, right = 16;
      const H = top + rows.length * rowH + 40;
      const x = (t) => left + (t / tMax) * (W - left - right);
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Biểu đồ Gantt request' });
      const step = tMax > 600 ? 100 : 50;
      for (let t = 0; t <= tMax; t += step) {
        svg.append(s('line', { x1: x(t), x2: x(t), y1: top, y2: H - 30, class: 'grid' }), s('text', { x: x(t), y: H - 16, 'text-anchor': 'middle' }, t + ' ms'));
      }
      rows.forEach((r, k) => {
        const y = top + k * rowH;
        const slow = r.svc > 100;
        svg.append(
          s('text', { x: 4, y: y + 16, class: slow ? 'lbl-strong' : '' }, `#${k + 1} ${slow ? 'chậm' : 'nhanh'}`),
          s('rect', { x: x(r.sent), y: y + 5, width: x(r.arrive) - x(r.sent), height: 14, class: 'f-ink3' }),
          s('rect', { x: x(r.arrive), y: y + 5, width: Math.max(0, x(r.start) - x(r.arrive)), height: 14, class: 'f-bad-soft s-bad', 'stroke-width': 1 }),
          s('rect', { x: x(r.start), y: y + 5, width: Math.max(1, x(r.end) - x(r.start)), height: 14, class: slow ? 'f-mark' : 'f-accent' }),
          s('rect', { x: x(r.end), y: y + 5, width: x(r.done) - x(r.end), height: 14, class: 'f-ink3' }),
          s('text', { x: Math.min(x(r.done) + 4, W - right - 50), y: y + 16 }, fmtMs(r.resp)));
      });
      svg.append(s('text', { x: left, y: H - 2 }, 'Xám: mạng · Đỏ nhạt: chờ trong hàng · Xanh/vàng: đang xử lý'));
      clear(holder).append(viz(svg));
      const avgS = rows.reduce((a, r) => a + r.svc, 0) / rows.length;
      const avgR = rows.reduce((a, r) => a + r.resp, 0) / rows.length;
      const fast = rows.filter((r) => r.svc <= 100);
      const worst = fast.length ? Math.max(...fast.map((r) => r.resp)) : 0;
      sSrv.update(fmtMs(avgS)); sCli.update(fmtMs(avgR), avgR > 2 * avgS ? 'warn' : 'ok');
      sVictim.update(fast.length ? fmtMs(worst) : '—', worst > 200 ? 'bad' : 'ok', 'dù chỉ cần 20 ms xử lý');
    }
    const add = (ms) => { if (reqs.length < 12) { reqs.push(ms); render(); } };
    root.append(h('div', { class: 'controls' }, workers.el, h('div', { class: 'btn-row' },
      button('Thêm request nhanh (20 ms)', () => add(20), 'ghost'), button('Thêm request chậm (400 ms)', () => add(400), 'ghost'),
      button('Đưa request chậm lên đầu', () => { reqs = [400, ...reqs.filter((v) => v !== 400)]; render(); }, 'ghost'),
      button('Khôi phục', () => { reqs = [20, 20, 400, 20, 20, 20]; workers.set(1); render(); }, 'ghost'))),
      h('div', { class: 'stats' }, sSrv, sCli, sVictim), holder,
      h('p', { class: 'lab-note' }, 'Client gửi request cách nhau 5 ms, mạng mỗi chiều 15 ms, server xử lý theo thứ tự đến (FIFO). Thêm worker thứ hai giảm head-of-line blocking nhưng không xoá được nó.'));
    render();
  });

  // ============ 2.6 percentiles ============
  widget('percentiles', (root) => {
    let seed = 3;
    const share = slider({ label: 'Tỉ lệ request chậm (outlier)', min: 0, max: 20, step: 1, value: 5, format: (v) => v + '%', onInput: render });
    const size = slider({ label: 'Outlier chậm gấp', min: 2, max: 30, step: 1, value: 8, format: (v) => v + '×', onInput: render });
    const order = seg({ options: [{ value: 'time', label: 'Theo thời gian đến' }, { value: 'sorted', label: 'Đã sắp xếp' }], value: 'time', onChange: render });
    const sMean = stat('Trung bình', ''), s50 = stat('p50 (median)', '', 'accent'), s95 = stat('p95', '', 'warn'), s99 = stat('p99', '', 'bad'), sBelow = stat('Request nhanh hơn trung bình', '');
    const holder = h('div');
    function sample() {
      const r = rng(seed);
      const n = 100, k = Math.round(share.value);
      const slowIdx = new Set();
      while (slowIdx.size < k) slowIdx.add(Math.floor(r() * n));
      return Array.from({ length: n }, (_, i) => {
        const base = Math.exp(Math.log(90) + 0.35 * normal(r));
        return slowIdx.has(i) ? base * size.value * (0.6 + 0.8 * r()) : base;
      });
    }
    function render() {
      const data = sample();
      const sorted = data.slice().sort((a, b) => a - b);
      const shown = order.value === 'sorted' ? sorted : data;
      const mean = data.reduce((a, b) => a + b, 0) / data.length;
      const p50 = percentile(sorted, 0.5), p95 = percentile(sorted, 0.95), p99 = percentile(sorted, 0.99);
      const yMax = Math.max(400, Math.ceil(sorted[sorted.length - 1] * 1.08 / 200) * 200);
      const ticks = []; const tStep = yMax > 2000 ? 1000 : yMax > 1000 ? 500 : 100;
      for (let t = 0; t <= yMax; t += tStep) ticks.push(t);
      const c = chart({ h: 260, x: [0, 100], y: [0, yMax], yTicks: ticks, xTicks: [0, 25, 50, 75, 100], xFmt: (v) => v === 0 ? '' : '#' + v, yFmt: (v) => fmtMs(v), xLabel: order.value === 'sorted' ? 'Request, sắp xếp nhanh → chậm' : 'Request theo thứ tự đến', aria: 'Phân bố response time' });
      const bw = (c.x(1) - c.x(0)) * 0.78;
      shown.forEach((v, i) => c.layer.appendChild(s('rect', { x: c.x(i) + 1, y: c.y(v), width: bw, height: c.y(0) - c.y(v), class: v > p95 ? 'f-ink2' : 'f-ink3' })));
      const line = (v, cls, label, dy) => {
        c.layer.append(s('line', { x1: c.x(0), x2: c.x(100), y1: c.y(v), y2: c.y(v), class: cls + ' f-none', 'stroke-width': 2, 'stroke-dasharray': cls === 's-violet' ? '6 4' : '' }),
          s('text', { x: c.x(100) - 4, y: c.y(v) - 4 + (dy || 0), 'text-anchor': 'end', class: 'lbl-strong' }, label + ' ' + fmtMs(v)));
      };
      line(p50, 's-accent', 'p50', 0); line(mean, 's-violet', 'trung bình', mean - p50 < yMax * 0.05 ? -12 : 0); line(p95, 's-warn', 'p95'); line(p99, 's-bad', 'p99');
      clear(holder).append(viz(c.svg));
      sMean.update(fmtMs(mean), '', 'kéo lên ' + fmt((mean / p50 - 1) * 100) + '% so với median');
      s50.update(fmtMs(p50), 'accent'); s95.update(fmtMs(p95), 'warn'); s99.update(fmtMs(p99), 'bad');
      sBelow.update(data.filter((v) => v < mean).length + '/100', '', 'trung bình ≠ “điển hình”');
    }
    root.append(h('div', { class: 'controls' }, share.el, size.el), h('div', { class: 'controls' }, order.el, button('Lấy mẫu mới', () => { seed++; render(); }, 'ghost')),
      h('div', { class: 'stats' }, s50, sMean, s95, s99, sBelow), holder,
      h('p', { class: 'lab-note' }, 'Thời gian thường quanh 90 ms (phân bố log-normal), cộng thêm một tỉ lệ outlier. Dữ liệu minh hoạ, cố định theo hạt giống ngẫu nhiên.'));
    render();
  });

  // ============ 2.6 percentile-merge ============
  widget('percentile-merge', (root) => {
    const shareB = slider({ label: 'Phần traffic vào server B', min: 5, max: 50, step: 1, value: 10, format: (v) => v + '%', onInput: render });
    const slowB = slider({ label: 'Server B chậm gấp', min: 1, max: 10, step: 0.5, value: 5, format: (v) => fmt(v, 1) + '×', onInput: render });
    const sA = stat('p99 server A', ''), sB = stat('p99 server B', ''), sAvg = stat('Trung bình hai p99 (sai)', '', 'bad'), sTrue = stat('p99 của dữ liệu gộp (đúng)', '', 'ok');
    const holder = h('div');
    function render() {
      const N = 10000, nB = Math.round(N * shareB.value / 100), nA = N - nB;
      const r = rng(11);
      const A = Array.from({ length: nA }, () => Math.exp(Math.log(60) + 0.45 * normal(r)));
      const B = Array.from({ length: nB }, () => Math.exp(Math.log(60 * slowB.value) + 0.55 * normal(r)));
      const sa = A.slice().sort((a, b) => a - b), sb = B.slice().sort((a, b) => a - b), all = sa.concat(sb).sort((a, b) => a - b);
      const pa = percentile(sa, 0.99), pb = percentile(sb, 0.99), avg = (pa + pb) / 2, tr = percentile(all, 0.99);
      sA.update(fmtMs(pa), '', fmt(nA) + ' request'); sB.update(fmtMs(pb), '', fmt(nB) + ' request');
      sAvg.update(fmtMs(avg), 'bad', 'lệch ' + fmt(Math.abs(avg - tr) / tr * 100) + '% so với đúng');
      sTrue.update(fmtMs(tr), 'ok', 'cộng histogram rồi mới tính');
      // log-binned stacked histogram
      const lo = Math.log10(10), hi = Math.log10(10000), bins = 40;
      const binOf = (v) => clamp(Math.floor((Math.log10(v) - lo) / (hi - lo) * bins), 0, bins - 1);
      const hA = new Array(bins).fill(0), hB = new Array(bins).fill(0);
      A.forEach((v) => hA[binOf(v)]++); B.forEach((v) => hB[binOf(v)]++);
      const maxC = Math.max(...hA.map((v, i) => v + hB[i]));
      const yTop = Math.ceil(maxC / 200) * 200;
      const c = chart({ h: 240, x: [lo, hi], y: [0, yTop], xTicks: [1, 2, 3, 4], xFmt: (v) => fmtMs(Math.pow(10, v)), yTicks: [0, yTop / 2, yTop], yFmt: (v) => fmt(v), xLabel: 'Response time (thang log)', yLabel: 'số request', aria: 'Histogram gộp' });
      const bwid = (c.x(hi) - c.x(lo)) / bins;
      for (let i = 0; i < bins; i++) {
        const x0 = c.x(lo) + i * bwid;
        if (hA[i]) c.layer.appendChild(s('rect', { x: x0 + 0.5, y: c.y(hA[i]), width: bwid - 1, height: c.y(0) - c.y(hA[i]), class: 'f-accent' }));
        if (hB[i]) c.layer.appendChild(s('rect', { x: x0 + 0.5, y: c.y(hA[i] + hB[i]), width: bwid - 1, height: c.y(hA[i]) - c.y(hA[i] + hB[i]), class: 'f-violet' }));
      }
      const vl = (v, cls, label, yy) => c.layer.append(
        s('line', { x1: c.x(Math.log10(v)), x2: c.x(Math.log10(v)), y1: c.y(0), y2: c.y(yTop), class: cls + ' f-none', 'stroke-width': 2, 'stroke-dasharray': '5 3' }),
        s('text', { x: c.x(Math.log10(v)) + 4, y: c.y(yTop * yy), class: 'lbl-strong' }, label));
      vl(tr, 's-ok', 'p99 đúng', 0.92); vl(avg, 's-bad', 'TB hai p99', 0.78);
      c.layer.append(s('text', { x: c.x(lo) + 6, y: c.y(yTop * 0.92) }, 'Xanh: server A · Tím: server B'));
      clear(holder).append(viz(c.svg));
    }
    root.append(h('div', { class: 'controls' }, shareB.el, slowB.el), h('div', { class: 'stats' }, sA, sB, sAvg, sTrue), holder,
      h('p', { class: 'lab-note' }, 'Tổng 10.000 request, số liệu minh hoạ. Trung bình hai p99 bỏ qua việc mỗi server phục vụ bao nhiêu request và hình dạng phân bố của nó.'));
    render();
  });

  // ============ 2.7 tail-amplify ============
  widget('tail-amplify', (root) => {
    let seed = 5;
    const n = slider({ label: 'Số cuộc gọi backend mỗi request', min: 1, max: 100, step: 1, value: 10, format: (v) => String(v), onInput: render });
    const p = slider({ label: 'Xác suất một cuộc gọi chậm', min: 0.1, max: 10, step: 0.1, value: 1, format: (v) => fmt(v, 1) + '%', onInput: render });
    const sTheo = stat('Request người dùng bị chậm (lý thuyết)', '', 'bad'), sSim = stat('Trong mẫu 100 request', ''), sOne = stat('Một cuộc gọi backend chậm', '');
    const grid = h('div'), curve = h('div');
    function render() {
      const N = n.value, P = p.value / 100;
      const theo = 1 - Math.pow(1 - P, N);
      const r = rng(seed);
      const cells = Array.from({ length: 100 }, () => Array.from({ length: N }, () => r() < P));
      const slowCount = cells.filter((c) => c.some(Boolean)).length;
      sTheo.update(pct(theo), theo > 0.2 ? 'bad' : theo > 0.05 ? 'warn' : 'ok', '1 − (1 − p)^n');
      sSim.update(slowCount + '/100', slowCount > 20 ? 'bad' : slowCount > 5 ? 'warn' : 'ok', 'ô có viền đỏ');
      sOne.update(fmt(p.value, 1) + '%', '', 'của từng backend');
      const W = 640, cols = 20, cw = W / cols, ch = 30, H = 5 * ch + 4;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Lưới 100 request người dùng' });
      const side = Math.ceil(Math.sqrt(N)), showDots = N <= 49;
      cells.forEach((calls, i) => {
        const cx = (i % cols) * cw + 2, cy = Math.floor(i / cols) * ch + 2;
        const bad = calls.some(Boolean);
        svg.appendChild(s('rect', { x: cx, y: cy, width: cw - 4, height: ch - 4, rx: 4, class: bad ? 'f-bad-soft s-bad' : 'f-surface2 s-line', 'stroke-width': bad ? 2 : 1 }));
        if (showDots) {
          const step = (Math.min(cw, ch) - 10) / side;
          calls.forEach((sl, j) => svg.appendChild(s('circle', { cx: cx + (cw - 4 - step * side) / 2 + step * ((j % side) + 0.5), cy: cy + 5 + step * (Math.floor(j / side) + 0.5) - 3 + (ch - 10 - step * side) / 2, r: Math.max(1, step * 0.32), class: sl ? 'f-bad' : 'f-accent' })));
        } else if (bad) {
          svg.appendChild(s('text', { x: cx + (cw - 4) / 2, y: cy + ch / 2 + 2, 'text-anchor': 'middle', class: 'lbl-strong' }, String(calls.filter(Boolean).length)));
        }
      });
      clear(grid).append(viz(svg), h('p', { class: 'lab-note' }, showDots ? 'Mỗi ô là một request người dùng, mỗi chấm là một cuộc gọi backend (đỏ = chậm).' : 'Nhiều cuộc gọi quá để vẽ chấm: số trong ô là số cuộc gọi chậm.'));
      const c = chart({ h: 170, x: [1, 100], y: [0, 1], xTicks: [1, 20, 40, 60, 80, 100], yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: (v) => fmt(v * 100) + '%', xLabel: 'Số cuộc gọi backend n', aria: 'Đường cong khuếch đại' });
      const pts = []; for (let k = 1; k <= 100; k++) pts.push([c.x(k), c.y(1 - Math.pow(1 - P, k))]);
      c.layer.append(s('path', { d: pathOf(pts), class: 's-bad f-none', 'stroke-width': 2.5 }), s('circle', { cx: c.x(N), cy: c.y(theo), r: 6, class: 'f-bad s-ink' }));
      clear(curve).append(viz(c.svg));
    }
    root.append(h('div', { class: 'controls' }, n.el, p.el, button('Lấy mẫu mới', () => { seed++; render(); }, 'ghost')), h('div', { class: 'stats' }, sOne, sTheo, sSim), grid, curve);
    render();
  });

  // ============ 2.7 slo-check ============
  widget('slo-check', (root) => {
    const med = slider({ label: 'Thời gian điển hình', min: 50, max: 400, step: 10, value: 120, format: (v) => v + ' ms', onInput: render });
    const tail = slider({ label: 'Tỉ lệ request rất chậm (~1,5 s)', min: 0, max: 5, step: 0.1, value: 0.5, format: (v) => fmt(v, 1) + '%', onInput: render });
    const err = slider({ label: 'Tỉ lệ lỗi', min: 0, max: 0.5, step: 0.01, value: 0.05, format: (v) => fmt(v, 2) + '%', onInput: render });
    const table = h('div', { class: 'table-wrap' });
    function render() {
      const r = rng(21), N = 20000;
      const lat = Array.from({ length: N }, () => (r() < tail.value / 100 ? 1500 * (0.7 + 0.6 * r()) : Math.exp(Math.log(med.value) + 0.4 * normal(r)))).sort((a, b) => a - b);
      const errors = Array.from({ length: N }, () => r() < err.value / 100).filter(Boolean).length;
      const ok = 1 - errors / N;
      const rows = [
        ['Median (p50)', '< 200 ms', fmtMs(percentile(lat, 0.5)), percentile(lat, 0.5) < 200],
        ['p99', '< 1 s', fmtMs(percentile(lat, 0.99)), percentile(lat, 0.99) < 1000],
        ['Request không lỗi', '≥ 99,9%', fmt(ok * 100, 2) + '%', ok >= 0.999],
      ];
      clear(table).append(h('table', { class: 'data' },
        h('thead', h('tr', h('th', 'Chỉ tiêu'), h('th', 'Mục tiêu SLO'), h('th', { class: 'num' }, 'Đo được'), h('th', 'Kết quả'))),
        h('tbody', rows.map(([a, b, c, pass]) => h('tr', h('td', a), h('td', b), h('td', { class: 'num' }, c), h('td', h('span', { class: 'pill ' + (pass ? 'ok' : 'bad') }, pass ? 'Đạt' : 'Vi phạm')))))));
    }
    root.append(h('div', { class: 'controls' }, med.el, tail.el, err.el), table,
      h('p', { class: 'lab-note' }, 'Mẫu 20.000 request. Để ý: tỉ lệ request rất chậm vượt khoảng 1% thì p99 vỡ ngay, dù median vẫn đẹp.'));
    render();
  });

  // ============ 2.8 fault-tolerance ============
  widget('fault-tolerance', (root) => {
    const comps = {
      lb1: { label: 'LB 1', kind: 'lb', x: 150, y: 60 }, lb2: { label: 'LB 2', kind: 'lb', x: 150, y: 150, opt: true },
      app1: { label: 'App 1', kind: 'app', x: 330, y: 40 }, app2: { label: 'App 2', kind: 'app', x: 330, y: 105 }, app3: { label: 'App 3', kind: 'app', x: 330, y: 170 },
      db1: { label: 'DB leader', kind: 'db', x: 510, y: 70 }, db2: { label: 'DB replica', kind: 'db', x: 510, y: 150 },
    };
    const dead = new Set();
    const redundantLB = checkbox('Có load balancer dự phòng (LB 2)', false, () => { if (!redundantLB.value) dead.delete('lb2'); render(); });
    const sState = stat('Trạng thái hệ thống', ''), sSpof = stat('SPOF hiện tại', '');
    const lg = log(40);
    const holder = h('div');
    const active = (k) => !comps[k].opt || redundantLB.value;
    const alive = (kind) => Object.keys(comps).filter((k) => comps[k].kind === kind && active(k) && !dead.has(k));
    function status(deadSet) {
      const al = (kind) => Object.keys(comps).filter((k) => comps[k].kind === kind && active(k) && !deadSet.has(k)).length;
      if (!al('lb') || !al('app') || !al('db')) return 'fail';
      if (al('app') < 2) return 'degraded';
      return deadSet.size ? 'tolerated' : 'ok';
    }
    function spofs() {
      return Object.keys(comps).filter((k) => active(k) && !dead.has(k) && status(new Set([...dead, k])) === 'fail' && status(dead) !== 'fail');
    }
    function toggle(k) {
      if (dead.has(k)) { dead.delete(k); lg.add(`Sửa ${comps[k].label}.`, 'ok'); }
      else { dead.add(k); const st = status(dead); lg.add(`${comps[k].label} hỏng → ${st === 'fail' ? 'FAILURE: người dùng không được phục vụ' : st === 'degraded' ? 'fault được chịu, nhưng chỉ còn 1 app node, quá tải giờ cao điểm' : 'fault được chịu, dịch vụ vẫn đạt SLO'}.`, st === 'fail' ? 'bad' : st === 'degraded' ? 'warn' : 'acc'); }
      render();
    }
    function render() {
      const W = 620, H = 220;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Sơ đồ cụm' });
      const st = status(dead);
      const ux = 40, uy = 105;
      svg.append(s('circle', { cx: ux, cy: uy, r: 22, class: st === 'fail' ? 'f-bad-soft s-bad' : 'f-ok s-ink', 'stroke-width': 1.5 }), s('text', { x: ux, y: uy + 4, 'text-anchor': 'middle', class: 'lbl-strong' }, 'Users'));
      const link = (a, b) => {
        const A = a === 'users' ? { x: ux + 22, y: uy } : comps[a], B = comps[b];
        const on = (a === 'users' || !dead.has(a)) && !dead.has(b);
        svg.appendChild(s('line', { x1: A.x + (a === 'users' ? 0 : 45), y1: A.y, x2: B.x - 45, y2: B.y, class: (on ? 's-accent' : 's-line') + ' f-none' + (on ? '' : ' dash'), 'stroke-width': 1.5 }));
      };
      const lbs = ['lb1', 'lb2'].filter(active), apps = ['app1', 'app2', 'app3'];
      lbs.forEach((l) => { link('users', l); apps.forEach((a) => link(l, a)); });
      apps.forEach((a) => link(a, 'db1'));
      svg.appendChild(s('line', { x1: comps.db1.x, y1: comps.db1.y + 18, x2: comps.db2.x, y2: comps.db2.y - 18, class: 's-violet f-none dash', 'stroke-width': 1.5 }));
      svg.appendChild(s('text', { x: comps.db1.x + 50, y: 114 }, 'replicate'));
      const sp = new Set(spofs());
      Object.entries(comps).forEach(([k, c]) => {
        if (!active(k)) return;
        const isDead = dead.has(k);
        const g = s('g', { class: 'node clickable', tabindex: 0, role: 'button', 'aria-label': (isDead ? 'Sửa ' : 'Làm hỏng ') + c.label },
          s('rect', { x: c.x - 45, y: c.y - 18, width: 90, height: 36, rx: 7, class: (isDead ? 'f-bad-soft s-bad' : sp.has(k) ? 'f-mark-soft s-mark' : 'f-surface s-ink'), 'stroke-width': sp.has(k) ? 2.5 : 1.5 }),
          s('text', { x: c.x, y: c.y + 4, 'text-anchor': 'middle', class: 'lbl-strong' }, (isDead ? '✕ ' : '') + c.label));
        g.addEventListener('click', () => toggle(k));
        g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(k); } });
        svg.appendChild(g);
      });
      svg.appendChild(s('text', { x: 10, y: H - 8 }, 'Viền vàng = SPOF: hỏng thứ này là hệ thống ngừng phục vụ.'));
      clear(holder).append(viz(svg));
      const map = { ok: ['Bình thường', 'ok', 'không có fault'], tolerated: ['Có fault, vẫn phục vụ', 'accent', dead.size + ' thành phần hỏng, chưa thành failure'], degraded: ['Chạy nhưng suy giảm', 'warn', 'chỉ còn 1 app node'], fail: ['FAILURE', 'bad', 'fault đã leo thang'] };
      sState.update(...map[st]);
      sSpof.update(sp.size ? [...sp].map((k) => comps[k].label).join(', ') : 'Không có', sp.size ? 'warn' : 'ok', sp.size ? 'một fault ở đây gây failure' : 'không thành phần đơn lẻ nào làm sập hệ thống');
    }
    const chaos = () => {
      const cand = Object.keys(comps).filter((k) => active(k) && !dead.has(k));
      if (!cand.length) return;
      const k = cand[Math.floor(Math.random() * cand.length)];
      lg.add('Chaos Monkey chọn ' + comps[k].label + '.', 't');
      toggle(k);
    };
    root.append(h('div', { class: 'controls' }, redundantLB.el, h('div', { class: 'btn-row' }, button('Chaos Monkey: giết ngẫu nhiên', chaos), button('Sửa tất cả', () => { dead.clear(); lg.add('Đã sửa mọi thành phần.', 'ok'); render(); }, 'ghost'))),
      h('div', { class: 'stats' }, sState, sSpof), holder, lg);
    lg.add('Cụm đang chạy bình thường. Bấm vào một thành phần để làm hỏng nó.', 't');
    render();
  });

  // ============ 2.9 disk-failures ============
  widget('disk-failures', (root) => {
    const SIZES = [100, 500, 1000, 5000, 10000, 50000, 100000];
    let seed = 9;
    const disks = slider({ label: 'Số ổ đĩa trong cụm', min: 0, max: SIZES.length - 1, step: 1, value: 4, format: (v) => fmt(SIZES[v]), onInput: render });
    const afr = slider({ label: 'Tỉ lệ hỏng mỗi năm (AFR)', min: 0.5, max: 5, step: 0.25, value: 3, format: (v) => fmt(v, 2) + '%', onInput: () => { kind.set(''); render(); } });
    const kind = seg({ options: [{ value: 'hdd', label: 'HDD 2–5%' }, { value: 'ssd', label: 'SSD 0,5–1%' }], value: 'hdd', onChange: (v) => { afr.set(v === 'hdd' ? 3 : 0.75); render(); } });
    const corr = checkbox('Lỗi phần mềm tương quan (một bug kích hoạt cùng lúc trên mọi node)', false, render);
    const sYear = stat('Kỳ vọng ổ hỏng mỗi năm', '', 'accent'), sDay = stat('Kỳ vọng mỗi ngày', ''), sZero = stat('Ngày không có ổ nào hỏng', ''), sMax = stat('Nhiều nhất trong một ngày', '');
    const holder = h('div');
    function poisson(r, lam) { if (lam > 30) return Math.max(0, Math.round(lam + Math.sqrt(lam) * normal(r))); let L = Math.exp(-lam), k = 0, p = 1; do { k++; p *= r(); } while (p > L); return k - 1; }
    function render() {
      const N = SIZES[disks.value], rate = afr.value / 100;
      const perYear = N * rate, perDay = perYear / 365;
      const r = rng(seed);
      const days = Array.from({ length: 365 }, () => poisson(r, perDay));
      const BUG_DAY = 181;
      sYear.update(fmt(perYear)); sDay.update(fmt(perDay, perDay < 10 ? 2 : 0), '', perDay >= 0.9 && perDay <= 1.1 ? 'khoảng một ổ mỗi ngày' : '');
      sZero.update(days.filter((d) => d === 0).length + '/365');
      const maxHW = Math.max(...days);
      sMax.update(corr.value ? fmt(N) : fmt(maxHW), corr.value ? 'bad' : '', corr.value ? 'ngày bug kích hoạt (mọi node)' : 'do phần cứng độc lập');
      const W = 640, cols = 61, cw = W / cols, rows = Math.ceil(365 / cols), ch = 16, H = rows * ch + 30;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Dải 365 ngày' });
      days.forEach((d, i) => {
        const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
        const bug = corr.value && i === BUG_DAY;
        const cls = bug ? 'f-bad' : d === 0 ? 'f-surface2' : d === 1 ? 'f-accent-soft' : d <= 3 ? 'f-accent' : 'f-ink';
        const rect = s('rect', { x: x + 1, y: y + 1, width: cw - 2, height: ch - 2, rx: 2, class: cls });
        rect.appendChild(s('title', `Ngày ${i + 1}: ${bug ? 'bug phần mềm làm sập toàn bộ ' + fmt(N) + ' node' : d + ' ổ hỏng'}`));
        svg.appendChild(rect);
      });
      svg.append(s('text', { x: 0, y: H - 8 }, 'Xám: 0 · Xanh nhạt: 1 · Xanh: 2–3 · Đậm: ≥4 ổ hỏng' + (corr.value ? ' · Đỏ: bug tương quan' : '') + '. Rê chuột lên ô để xem.'));
      clear(holder).append(viz(svg));
    }
    root.append(h('div', { class: 'controls' }, disks.el, afr.el), h('div', { class: 'controls' }, kind.el, corr.el, button('Mô phỏng năm khác', () => { seed++; render(); }, 'ghost')),
      h('div', { class: 'stats' }, sYear, sDay, sZero, sMax), holder,
      h('p', { class: 'lab-note' }, 'Hỏng phần cứng độc lập: dự phòng (RAID, bản sao) xử lý từng ổ một. Bug tương quan như giây nhuận 2012 hay firmware SSD hỏng sau 32.768 giờ đánh vào mọi bản sao cùng lúc, nên dự phòng phần cứng không cứu được.'));
    render();
  });

  // ============ 2.10 postmortem ============
  widget('postmortem', (root) => {
    const STEPS = [
      { story: 'Thứ Sáu 17:40, Bình (kỹ sư backend) đổi cấu hình connection pool của service thanh toán. 3 phút sau, 60% lượt checkout lỗi trong 40 phút. Sáng thứ Hai, bạn chủ trì buổi postmortem.',
        q: 'Câu mở đầu của bạn?',
        choices: [
          { t: '“Ai deploy thay đổi này? Bình cần cẩn thận hơn.”', good: false, fb: 'Đổ lỗi làm mọi người giấu thông tin ở lần sau. Sách gọi “lỗi con người” là triệu chứng, không phải nguyên nhân.' },
          { t: '“Hãy kể lại từng bước đã xảy ra. Không ai bị phạt vì nói thật.”', good: true, fb: 'Đúng tinh thần blameless postmortem: người trong cuộc kể đầy đủ chi tiết để cả tổ chức học được.' },
          { t: '“Từ nay cấm deploy chiều thứ Sáu; ai vi phạm bị kỷ luật.”', good: false, fb: 'Siết quy định và kỷ luật là cố kiểm soát hành vi con người, không chạm tới vì sao hệ thống cho phép sự cố xảy ra.' },
        ] },
      { story: 'Bình kể: thay đổi cấu hình đi thẳng lên toàn bộ 40 server cùng lúc, không qua staging. Không có dashboard tỉ lệ lỗi checkout; khách báo qua mạng xã hội trước. Rollback phải sửa tay file trên từng máy.',
        q: 'Nguyên nhân gốc bạn ghi vào báo cáo?',
        choices: [
          { t: '“Lỗi con người.”', good: false, fb: 'Quá đơn giản. Ai cũng có thể mắc sai sót này; câu hỏi là vì sao một sai sót nhỏ lại thành outage 40 phút.' },
          { t: '“Quy trình cho phép thay đổi cấu hình chưa kiểm thử lên 100% server cùng lúc, không có giám sát và không có rollback nhanh.”', good: true, fb: 'Mô tả hệ thống kỹ thuật–xã hội: thiếu roll-out dần, thiếu monitoring, thiếu rollback. Mỗi thứ là một điểm có thể cải thiện.' },
          { t: '“Backend viết bằng ngôn ngữ cũ, phải viết lại bằng Haskell.”', good: false, fb: 'Chính ví dụ sách chế giễu: một giải pháp công nghệ to tát cũng là câu trả lời đơn giản hoá như đổ lỗi cho người.' },
        ] },
      { story: 'Nhóm đề xuất nhiều hành động. Ngân sách chỉ đủ cho hai việc trong quý này.',
        q: 'Bạn ưu tiên hai việc nào?', multi: 2,
        choices: [
          { t: 'Roll-out cấu hình dần (1% → 10% → 100%) kèm nút rollback một chạm', good: true, fb: 'Giới hạn phạm vi ảnh hưởng và rút ngắn thời gian khắc phục: hai biện pháp sách nêu trực tiếp.' },
          { t: 'Dashboard và cảnh báo theo tỉ lệ lỗi checkout', good: true, fb: 'Giám sát rõ ràng giúp phát hiện trong vài phút thay vì chờ khách phàn nàn.' },
          { t: 'Bắt mọi thay đổi cấu hình phải có chữ ký của 5 quản lý', good: false, fb: 'Làm chậm mọi thay đổi mà không phát hiện được lỗi tốt hơn; dễ thành thủ tục hình thức.' },
          { t: 'Trừ thưởng quý của Bình', good: false, fb: 'Phạt người làm hỏng văn hoá báo cáo sự cố và không ngăn được lần sau.' },
        ] },
      { story: 'Ban giám đốc hỏi: “Sao trước giờ không làm những việc này?”',
        q: 'Câu trả lời trung thực nhất?',
        choices: [
          { t: '“Vì đội lười.”', good: false, fb: 'Vẫn là đổ lỗi, chỉ là cho cả nhóm.' },
          { t: '“Vì tổ chức luôn ưu tiên tính năng mới hơn test và hạ tầng vận hành. Cần quyết định lại ưu tiên đó.”', good: true, fb: 'Sách: khi chọn tính năng thay vì kiểm thử, sự cố có thể phòng tránh là hệ quả của ưu tiên tổ chức. Postmortem tốt đưa vấn đề hệ thống lên bàn ban lãnh đạo.' },
          { t: '“Vì không ai dự đoán được.”', good: false, fb: 'Thiếu rollback và giám sát là rủi ro đã biết, không phải bất ngờ.' },
        ] },
    ];
    const wrap = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } });
    const sScore = stat('Lựa chọn tốt', '0/0');
    let good = 0, total = 0;
    function showStep(i) {
      if (i >= STEPS.length) {
        wrap.appendChild(h('div', { class: 'callout callout-key' }, h('b', 'Kết thúc'), h('p', `Bạn chọn đúng hướng ${good}/${total} lần. Mục tiêu của postmortem là hiểu hệ thống từ góc nhìn của người làm việc với nó hằng ngày, rồi cải thiện nó.`)));
        return;
      }
      const st = STEPS[i];
      const fb = h('p', { class: 'feedback' });
      const list = h('div', { class: 'choice-list' });
      const card = h('div', { class: 'step-card' }, h('p', { class: 'lab-note' }, `Bước ${i + 1}/${STEPS.length}`), h('p', st.story), h('p', h('strong', st.q)), list, fb);
      const picked = [];
      const btns = st.choices.map((c, j) => {
        const b = h('button', { type: 'button' }, c.t);
        b.addEventListener('click', () => {
          if (picked.includes(j)) return;
          picked.push(j);
          b.classList.add(c.good ? 'good' : 'badc');
          b.disabled = true;
          total++; if (c.good) good++;
          fb.appendChild(h('div', (c.good ? 'Tốt. ' : 'Chưa ổn. ') + c.fb));
          sScore.update(`${good}/${total}`, good === total ? 'ok' : 'warn');
          if (picked.length >= (st.multi || 1)) { btns.forEach((x) => (x.disabled = true)); showStep(i + 1); }
        });
        list.appendChild(b);
        return b;
      });
      wrap.appendChild(card);
    }
    const restart = () => { clear(wrap); good = 0; total = 0; sScore.update('0/0'); showStep(0); };
    root.append(h('div', { class: 'controls' }, h('div', { class: 'stats', style: { flex: '1 1 200px' } }, sScore), button('Làm lại từ đầu', restart, 'ghost')), wrap);
    showStep(0);
  });

  // ============ 2.11 scaling-arch ============
  widget('scaling-arch', (root) => {
    const ARCH = {
      mem: { name: 'Shared-memory (scale up)', cls: 's-warn', fcls: 'f-warn', cost: (L) => (L <= 12 ? Math.pow(L, 1.55) : Infinity), note: 'Một máy to hơn: giá tăng nhanh hơn tài nguyên; máy lớn nhất có giới hạn (ở đây ×12).' },
      disk: { name: 'Shared-disk (NAS/SAN)', cls: 's-violet', fcls: 'f-violet', cost: (L) => { const capOf = (n) => n / (1 + 0.12 * (n - 1)); for (let n = 1; n <= 200; n++) if (capOf(n) >= L) return n * 1.0 + 4; return Infinity; }, note: 'Nhiều máy chung một dãy đĩa: tranh chấp và khoá làm mỗi máy thêm vào đóng góp ít dần, chạm trần khoảng ×8.' },
      nothing: { name: 'Shared-nothing (scale out)', cls: 's-accent', fcls: 'f-accent', cost: (L) => Math.ceil(L) * 1.15 + 1.5, note: 'Mỗi node tự đủ CPU, RAM, đĩa: chi phí gần tuyến tính; thêm chi phí phối hợp và độ phức tạp phân tán.' },
    };
    const arch = seg({ options: [{ value: 'mem', label: 'Shared-memory' }, { value: 'disk', label: 'Shared-disk' }, { value: 'nothing', label: 'Shared-nothing' }], value: 'nothing', onChange: render });
    const load = slider({ label: 'Tải (bội số của tải hiện tại)', min: 1, max: 16, step: 1, value: 6, format: (v) => '×' + v, onInput: render });
    const diag = h('div'), plot = h('div'), stats = h('div', { class: 'stats' }), note = h('p', { class: 'lab-note' });
    function diagram(kind) {
      const W = 640, H = 170, svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Sơ đồ kiến trúc' });
      const box = (x, y, w, hh, label, cls) => svg.append(s('rect', { x, y, width: w, height: hh, rx: 6, class: cls + ' s-ink', 'stroke-width': 1.2 }), s('text', { x: x + w / 2, y: y + hh / 2 + 4, 'text-anchor': 'middle' }, label));
      if (kind === 'mem') {
        svg.append(s('rect', { x: 200, y: 10, width: 240, height: 150, rx: 10, class: 'f-surface2 s-ink', 'stroke-width': 1.5 }), s('text', { x: 320, y: 28, 'text-anchor': 'middle', class: 'lbl-strong' }, 'Một máy rất lớn'));
        for (let i = 0; i < 4; i++) box(214 + i * 54, 40, 48, 30, 'CPU', 'f-accent-soft');
        box(214, 80, 210, 30, 'RAM dùng chung', 'f-violet-soft'); box(214, 118, 210, 30, 'Đĩa', 'f-mark-soft');
      } else if (kind === 'disk') {
        for (let i = 0; i < 4; i++) { const x = 40 + i * 150; svg.append(s('rect', { x, y: 10, width: 120, height: 82, rx: 8, class: 'f-surface2 s-ink', 'stroke-width': 1.2 })); box(x + 8, 18, 104, 28, 'CPU', 'f-accent-soft'); box(x + 8, 54, 104, 28, 'RAM', 'f-violet-soft'); svg.appendChild(s('line', { x1: x + 60, y1: 92, x2: 320, y2: 124, class: 's-ink3 f-none', 'stroke-width': 1.2 })); }
        box(180, 124, 280, 36, 'Dãy đĩa dùng chung (NAS/SAN) · khoá, tranh chấp', 'f-mark-soft');
      } else {
        for (let i = 0; i < 4; i++) { const x = 40 + i * 150; svg.append(s('rect', { x, y: 10, width: 120, height: 118, rx: 8, class: 'f-surface2 s-ink', 'stroke-width': 1.2 })); box(x + 8, 18, 104, 28, 'CPU', 'f-accent-soft'); box(x + 8, 54, 104, 28, 'RAM', 'f-violet-soft'); box(x + 8, 90, 104, 28, 'Đĩa', 'f-mark-soft'); }
        svg.append(s('line', { x1: 40, x2: 600, y1: 150, y2: 150, class: 's-accent f-none', 'stroke-width': 2 }), s('text', { x: 320, y: 166, 'text-anchor': 'middle' }, 'Mạng thông thường · phối hợp ở tầng phần mềm'));
        for (let i = 0; i < 4; i++) svg.appendChild(s('line', { x1: 100 + i * 150, x2: 100 + i * 150, y1: 128, y2: 150, class: 's-accent f-none', 'stroke-width': 1.5 }));
      }
      return svg;
    }
    function render() {
      const L = load.value;
      clear(diag).append(viz(diagram(arch.value)));
      const yMax = 70;
      const c = chart({ h: 240, x: [1, 16], y: [0, yMax], xTicks: [1, 4, 8, 12, 16], yTicks: [0, 20, 40, 60], xFmt: (v) => '×' + v, xLabel: 'Tải', yLabel: 'Chi phí (đơn vị minh hoạ)', aria: 'Chi phí theo tải' });
      Object.entries(ARCH).forEach(([k, a]) => {
        const pts = []; for (let l = 1; l <= 16; l += 0.25) { const v = a.cost(l); if (!isFinite(v) || v > yMax) break; pts.push([c.x(l), c.y(v)]); }
        c.layer.appendChild(s('path', { d: pathOf(pts), class: a.cls + ' f-none', 'stroke-width': k === arch.value ? 3.5 : 1.5, opacity: k === arch.value ? 1 : 0.55 }));
        const last = pts[pts.length - 1];
        if (last) c.layer.appendChild(s('circle', { cx: last[0], cy: last[1], r: 3, class: a.fcls }));
        const v = a.cost(L);
        if (isFinite(v) && v <= yMax) c.layer.appendChild(s('circle', { cx: c.x(L), cy: c.y(v), r: k === arch.value ? 6 : 4, class: a.fcls + ' s-ink' }));
      });
      c.layer.appendChild(s('line', { x1: c.x(L), x2: c.x(L), y1: c.y(0), y2: c.y(yMax), class: 's-ink3 f-none dash' }));
      clear(plot).append(viz(c.svg));
      clear(stats).append(...Object.entries(ARCH).map(([k, a]) => { const v = a.cost(L); return stat(a.name, isFinite(v) ? fmt(v, 1) : 'Không đạt được', !isFinite(v) ? 'bad' : k === arch.value ? 'accent' : '', !isFinite(v) ? 'chạm giới hạn kiến trúc' : 'chi phí ở tải ×' + L); }));
      note.textContent = ARCH[arch.value].note + ' Đường đậm là kiến trúc đang chọn; đường dừng giữa chừng nghĩa là kiến trúc đó không đạt được mức tải lớn hơn.';
    }
    root.append(h('div', { class: 'controls' }, arch.el, load.el), diag, stats, plot, note);
    render();
  });

  // ============ 2.12 same-throughput ============
  widget('same-throughput', (root) => {
    const OVERHEAD_MS = 0.2, BW = 125; // ms CPU per request, MB/s per stream
    const panel = (title, rate, size, rateToS, sizeToMB) => {
      const out = h('div', { class: 'stats' });
      const box = h('div', { class: 'box' }, h('h5', title), h('div', { class: 'controls' }, rate.el, size.el), out);
      return { box, out, rate, size, rateToS, sizeToMB };
    };
    const A = panel('Workload A',
      slider({ label: 'Tần suất', min: 3, max: 6, step: 0.1, value: 5, format: (v) => fmt(Math.pow(10, v)) + ' req/s', onInput: render }),
      slider({ label: 'Kích thước', min: -1, max: 2, step: 0.1, value: 0, format: (v) => fmt(Math.pow(10, v), 1) + ' kB', onInput: render }),
      (v) => Math.pow(10, v), (v) => Math.pow(10, v) / 1000);
    const B = panel('Workload B',
      slider({ label: 'Tần suất', min: 1, max: 60, step: 1, value: 3, format: (v) => v + ' req/phút', onInput: render }),
      slider({ label: 'Kích thước', min: 0.1, max: 10, step: 0.1, value: 2, format: (v) => fmt(v, 1) + ' GB', onInput: render }),
      (v) => v / 60, (v) => v * 1000);
    function fill(p) {
      const rps = p.rateToS(p.rate.value), mb = p.sizeToMB(p.size.value);
      const thr = rps * mb, cores = rps * OVERHEAD_MS / 1000;
      const dur = OVERHEAD_MS / 1000 + mb / BW, inflight = rps * dur, mem = inflight * mb;
      const fmtMB = (x) => (x >= 1000 ? fmt(x / 1000, 1) + ' GB' : x >= 1 ? fmt(x, 1) + ' MB' : fmt(x * 1000, 1) + ' kB');
      const cpuBound = cores > 1;
      clear(p.out).append(
        stat('Throughput dữ liệu', fmt(thr, 0) + ' MB/s', 'accent'),
        stat('Core CPU cho chi phí cố định', fmt(cores, cores < 0.01 ? 5 : 1), cpuBound ? 'bad' : '', '0,2 ms mỗi request'),
        stat('Thời gian một request', fmtMs(dur * 1000), dur > 5 ? 'bad' : '', 'qua đường 1 Gbit/s'),
        stat('Bộ nhớ cho request đang xử lý', fmtMB(mem), mem > 500 ? 'bad' : '', fmt(inflight, inflight < 10 ? 1 : 0) + ' request cùng lúc'),
        h('p', { class: 'lab-note', style: { gridColumn: '1 / -1' } }, cpuBound ? 'Nút thắt: chi phí cố định cho từng request (kết nối, parse, tra index). Cần nhiều core, batch, giảm overhead.' : dur > 5 ? 'Nút thắt: băng thông và bộ nhớ cho từng request. Một lỗi giữa chừng phải gửi lại cả khối lớn; cần streaming, chia nhỏ, resume.' : 'Chưa có nút thắt rõ ràng ở mức này.'));
    }
    function render() { fill(A); fill(B); }
    root.append(h('div', { class: 'lab-split' }, A.box, B.box),
      h('p', { class: 'lab-note' }, 'Mặc định là ví dụ trong sách: 100.000 request 1 kB mỗi giây và 3 request 2 GB mỗi phút, cùng 100 MB/s. Chi phí 0,2 ms CPU mỗi request và băng thông 125 MB/s mỗi luồng là giả định minh hoạ.'));
    render();
  });

  // ============ 2.13 reversibility ============
  widget('reversibility', (root) => {
    const plan = seg({ options: [{ value: 'bigbang', label: 'Big-bang, không đường lui' }, { value: 'dual', label: 'Ghi kép + chuyển đọc dần' }], value: 'dual', onChange: () => resetView() });
    const sDown = stat('Downtime', '—'), sUsers = stat('Người dùng bị ảnh hưởng', '—'), sRecover = stat('Thời gian khắc phục bug', '—'), sBack = stat('Quay lại được hệ cũ?', '—');
    const lg = log(40);
    const phase = h('div');
    let running = false;
    const PHASES = {
      bigbang: ['Dừng ghi', 'Copy toàn bộ dữ liệu', 'Chuyển 100% sang DB mới', 'Tắt DB cũ'],
      dual: ['Ghi vào cả hai DB', 'Backfill dữ liệu cũ', 'Shadow read: so sánh kết quả', 'Chuyển đọc 1% → 10% → 100%', 'Tắt DB cũ'],
    };
    function drawPhases(k, active, badAt) {
      const steps = PHASES[plan.value];
      const W = 640, H = 56, w = W / steps.length;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Các pha chuyển đổi' });
      steps.forEach((t, i) => {
        const cls = i === badAt ? 'f-bad-soft s-bad' : i < active ? 'f-accent-soft s-accent' : i === active ? 'f-mark-soft s-mark' : 'f-surface2 s-line';
        svg.append(s('rect', { x: i * w + 3, y: 6, width: w - 6, height: 40, rx: 6, class: cls, 'stroke-width': 1.5 }), s('text', { x: i * w + w / 2, y: 30, 'text-anchor': 'middle' }, t));
      });
      clear(phase).append(viz(svg));
    }
    function resetView() { lg.reset(); [sDown, sUsers, sRecover, sBack].forEach((x) => x.update('—', '', '')); drawPhases(plan.value, -1, -1); lg.add('Chọn kế hoạch rồi bấm “Chạy kế hoạch”. Một bug sắp xếp sai thứ tự đơn hàng (2% truy vấn) đang ẩn trong DB mới.', 't'); }
    async function run() {
      if (running) return;
      running = true; runBtn.disabled = true;
      lg.reset();
      const p = plan.value;
      if (p === 'bigbang') {
        drawPhases(p, 0, -1); lg.add('T+0: dừng mọi lần ghi, bảo trì toàn hệ thống.', 'warn'); await sleep(500);
        drawPhases(p, 1, -1); lg.add('T+0 → T+6 giờ: copy 2 TB sang DB mới. Người dùng không đặt được đơn.', 'warn'); await sleep(500);
        drawPhases(p, 2, -1); lg.add('T+6 giờ: chuyển 100% traffic. DB cũ ngừng nhận ghi.', 'acc'); await sleep(500);
        drawPhases(p, 3, -1); lg.add('T+1 ngày: tắt DB cũ để tiết kiệm chi phí.', 't'); await sleep(500);
        drawPhases(p, 4, 3); lg.add('T+3 ngày: khách báo đơn hiển thị sai thứ tự. Bug đã ảnh hưởng mọi người dùng 3 ngày.', 'bad'); await sleep(500);
        lg.add('Không quay lại được: DB cũ đã thiếu 3 ngày dữ liệu ghi. Phải sửa tiến dưới áp lực, viết script vá dữ liệu.', 'bad');
        sDown.update('6 giờ', 'bad'); sUsers.update('100%', 'bad', 'trong 3 ngày'); sRecover.update('≈ 2 ngày', 'bad', 'sửa tiến + vá dữ liệu'); sBack.update('Không', 'bad', 'hành động không đảo ngược');
      } else {
        drawPhases(p, 0, -1); lg.add('Tuần 1: app ghi vào cả hai DB; mọi lần đọc vẫn từ DB cũ.', 'acc'); await sleep(450);
        drawPhases(p, 1, -1); lg.add('Tuần 2: backfill dữ liệu lịch sử sang DB mới ở nền. Không downtime.', 'acc'); await sleep(450);
        drawPhases(p, 2, -1); lg.add('Tuần 3: shadow read so sánh kết quả hai DB, người dùng vẫn đọc DB cũ.', 'acc'); await sleep(450);
        drawPhases(p, 3, 2); lg.add('Phát hiện: 2% truy vấn trả thứ tự khác. Chưa người dùng nào thấy. Sửa bug, chạy lại so sánh.', 'warn'); await sleep(500);
        drawPhases(p, 3, -1); lg.add('Tuần 4: chuyển đọc 1% → 10% → 100%. Nếu có vấn đề mới: lật cờ về DB cũ trong 1 phút.', 'ok'); await sleep(450);
        drawPhases(p, 5, -1); lg.add('Tuần 6: mọi thứ ổn định, tắt DB cũ.', 'ok');
        sDown.update('0', 'ok'); sUsers.update('0%', 'ok', 'bug lộ ra ở shadow read'); sRecover.update('vài giờ', 'ok', 'không áp lực'); sBack.update('Có', 'ok', 'tới tận bước cuối');
      }
      running = false; runBtn.disabled = false;
    }
    const runBtn = button('Chạy kế hoạch', run);
    root.append(h('div', { class: 'controls' }, plan.el, runBtn), phase, h('div', { class: 'stats' }, sDown, sUsers, sRecover, sBack), lg,
      h('p', { class: 'lab-note' }, 'Kế hoạch ghi kép tốn công hơn và kéo dài hơn, nhưng giữ được đường lui tới bước cuối. Số liệu minh hoạ.'));
    resetView();
  });

  // ============ glossary ============
  const G = (key, term, vi, topic, def) => ({ key, term, vi, ch: 2, topic, def });
  glossary.add([
    G('functional-req', 'Functional requirement', 'yêu cầu chức năng', 'ch2-intro', 'Điều ứng dụng phải làm: màn hình, nút, kết quả của từng thao tác.'),
    G('nonfunctional-req', 'Nonfunctional requirement', 'yêu cầu phi chức năng', 'ch2-intro', 'Ứng dụng phải làm điều đó tốt đến mức nào: nhanh, tin cậy, mở rộng được, dễ bảo trì, an toàn, đúng luật.'),
    G('home-timeline', 'Home timeline', 'dòng thời gian', 'ch2-timeline', 'Danh sách bài gần nhất của những người bạn theo dõi; thao tác đọc chính trong case study mạng xã hội.'),
    G('polling', 'Polling', 'hỏi định kỳ', 'ch2-timeline', 'Client lặp lại cùng một truy vấn theo chu kỳ để kiểm tra dữ liệu mới. Đơn giản nhưng tốn tài nguyên khi có nhiều client.'),
    G('fan-out', 'Fan-out', 'toả ra', 'ch2-fanout', 'Khi một request ban đầu kéo theo nhiều request phía sau; hệ số fan-out là số lần nhân lên. Ví dụ: một bài đăng ghi vào timeline của 200 follower.'),
    G('materialization', 'Materialization', 'tính sẵn', 'ch2-fanout', 'Tính trước và cập nhật dần kết quả của một truy vấn, để lúc đọc chỉ việc lấy ra.'),
    G('materialized-view', 'Materialized view', 'khung nhìn tính sẵn', 'ch2-fanout', 'Kết quả truy vấn được lưu lại và giữ cập nhật khi dữ liệu gốc đổi, như timeline cache của từng người dùng.'),
    G('response-time', 'Response time', 'thời gian phản hồi', 'ch2-throughput', 'Thời gian từ khi người dùng gửi request đến khi nhận được câu trả lời, tính mọi độ trễ dọc đường. Đo ở phía client.'),
    G('throughput', 'Throughput', 'thông lượng', 'ch2-throughput', 'Số request hoặc lượng dữ liệu hệ thống xử lý mỗi giây. Quyết định cần bao nhiêu phần cứng.'),
    G('service-time', 'Service time', 'thời gian phục vụ', 'ch2-latency', 'Khoảng thời gian service thực sự đang xử lý request, không gồm thời gian chờ và đi trên mạng.'),
    G('queueing-delay', 'Queueing delay', 'độ trễ hàng đợi', 'ch2-latency', 'Thời gian request phải chờ trước khi được xử lý, ví dụ chờ CPU rảnh. Thường gây phần lớn biến động response time.'),
    G('latency', 'Latency', 'độ trễ', 'ch2-latency', 'Thời gian request đang “nằm chờ”, không được xử lý. Network latency là thời gian đi trên mạng.'),
    G('jitter', 'Jitter', 'độ dao động trễ', 'ch2-latency', 'Sự biến động của network delay giữa các request.'),
    G('head-of-line-blocking', 'Head-of-line blocking', 'chặn đầu hàng', 'ch2-latency', 'Vài request chậm ở đầu hàng đợi làm các request nhanh phía sau phải chờ, nên response time của chúng cũng chậm.'),
    G('mean', 'Mean (average)', 'trung bình cộng', 'ch2-percentiles', 'Tổng các giá trị chia cho số lượng. Dễ bị outlier kéo lệch và không cho biết bao nhiêu người thực sự chịu mức đó.'),
    G('median', 'Median (p50)', 'trung vị', 'ch2-percentiles', 'Giá trị ở giữa khi sắp xếp: một nửa request nhanh hơn, một nửa chậm hơn. Thước đo tốt cho thời gian chờ điển hình.'),
    G('percentile', 'Percentile', 'phân vị', 'ch2-percentiles', 'Ngưỡng mà một tỉ lệ request nhanh hơn: p95 là ngưỡng mà 95% request nhanh hơn.'),
    G('p99', 'p95 / p99 / p999', 'phân vị cao', 'ch2-percentiles', 'Các ngưỡng mà 95%, 99%, 99,9% request nhanh hơn. Dùng để đo trải nghiệm của nhóm người dùng chậm nhất.'),
    G('tail-latency', 'Tail latency', 'độ trễ đuôi', 'ch2-percentiles', 'Response time ở các percentile cao. Ảnh hưởng trực tiếp tới trải nghiệm, thường của những khách hàng nhiều dữ liệu nhất.'),
    G('tail-amplification', 'Tail latency amplification', 'khuếch đại độ trễ đuôi', 'ch2-slo', 'Khi một request gọi nhiều backend, chỉ cần một cuộc gọi chậm là cả request chậm, nên tỉ lệ request người dùng bị chậm cao hơn nhiều so với từng backend.'),
    G('slo', 'SLO (service level objective)', 'mục tiêu mức dịch vụ', 'ch2-slo', 'Mục tiêu đo được cho hiệu năng và availability, ví dụ median < 200 ms, p99 < 1 s, 99,9% request không lỗi.'),
    G('sla', 'SLA (service level agreement)', 'thoả thuận mức dịch vụ', 'ch2-slo', 'Hợp đồng quy định điều gì xảy ra khi SLO không đạt, ví dụ hoàn tiền cho khách.'),
    G('metastable-failure', 'Metastable failure', 'sự cố siêu bền', 'ch2-throughput', 'Hệ thống quá tải tự duy trì trạng thái quá tải (ví dụ do retry) ngay cả khi tải gốc đã giảm, cho đến khi bị reset.'),
    G('retry-storm', 'Retry storm', 'bão thử lại', 'ch2-throughput', 'Client timeout và gửi lại request, làm tải tăng thêm, gây thêm timeout: vòng xoáy làm quá tải nặng hơn.'),
    G('exponential-backoff', 'Exponential backoff', 'lùi theo cấp số nhân', 'ch2-throughput', 'Mỗi lần thử lại chờ lâu gấp đôi lần trước, thường kèm jitter ngẫu nhiên để các client không thử lại cùng lúc.'),
    G('circuit-breaker', 'Circuit breaker', 'cầu dao', 'ch2-throughput', 'Tạm ngừng gửi request tới service vừa lỗi hoặc timeout, cho nó thời gian hồi phục. Token bucket là cách giới hạn số retry tương tự.'),
    G('load-shedding', 'Load shedding', 'cắt bớt tải', 'ch2-throughput', 'Server chủ động từ chối một phần request khi sắp quá tải, để phục vụ tốt phần còn lại.'),
    G('backpressure', 'Backpressure', 'áp lực ngược', 'ch2-throughput', 'Server báo cho client gửi chậm lại khi không theo kịp.'),
    G('fault', 'Fault', 'lỗi thành phần', 'ch2-faults', 'Một phần của hệ thống ngừng hoạt động đúng: một ổ đĩa, một máy, một service phụ thuộc.'),
    G('failure', 'Failure', 'sự cố hệ thống', 'ch2-faults', 'Cả hệ thống ngừng cung cấp dịch vụ cần thiết cho người dùng, tức không đạt SLO.'),
    G('fault-tolerance', 'Fault tolerance', 'khả năng chịu lỗi', 'ch2-faults', 'Hệ thống tiếp tục phục vụ dù có một số fault nhất định. Luôn giới hạn ở những loại và số lượng fault cụ thể.'),
    G('spof', 'SPOF (single point of failure)', 'điểm lỗi đơn', 'ch2-faults', 'Thành phần mà nếu hỏng thì fault leo thang thành failure của cả hệ thống.'),
    G('chaos-engineering', 'Chaos engineering', 'kỹ thuật hỗn loạn', 'ch2-faults', 'Cố tình gây fault (ví dụ giết ngẫu nhiên tiến trình) để chắc chắn cơ chế chịu lỗi thật sự hoạt động.'),
    G('redundancy', 'Redundancy', 'dự phòng', 'ch2-hw-sw-faults', 'Có thêm bản sao của thành phần (RAID, nguồn kép, node dự phòng) để một cái hỏng không làm mất dịch vụ. Hiệu quả nhất khi các fault độc lập.'),
    G('availability-zone', 'Availability zone', 'vùng sẵn sàng', 'ch2-hw-sw-faults', 'Nhóm tài nguyên cloud đặt cùng một chỗ vật lý; tài nguyên cùng zone dễ hỏng cùng lúc hơn tài nguyên ở xa nhau.'),
    G('rolling-upgrade', 'Rolling upgrade', 'nâng cấp cuốn chiếu', 'ch2-hw-sw-faults', 'Vá hoặc nâng cấp bằng cách khởi động lại từng node một, không cần dừng cả dịch vụ.'),
    G('cascading-failure', 'Cascading failure', 'sự cố dây chuyền', 'ch2-hw-sw-faults', 'Vấn đề ở một thành phần làm thành phần khác quá tải và chậm lại, rồi kéo sập thành phần tiếp theo.'),
    G('blameless-postmortem', 'Blameless postmortem', 'rút kinh nghiệm không đổ lỗi', 'ch2-humans', 'Sau sự cố, người liên quan kể đầy đủ chuyện đã xảy ra mà không sợ bị phạt, để tổ chức tìm và sửa vấn đề hệ thống.'),
    G('scalability', 'Scalability', 'khả năng mở rộng', 'ch2-scalability', 'Khả năng đối phó với tải tăng, thường bằng cách thêm tài nguyên. Không phải nhãn có/không mà là câu hỏi: tăng theo hướng nào thì ta có lựa chọn gì.'),
    G('linear-scalability', 'Linear scalability', 'mở rộng tuyến tính', 'ch2-scalability', 'Gấp đôi tài nguyên xử lý được gấp đôi tải với cùng hiệu năng.'),
    G('vertical-scaling', 'Vertical scaling (scale up)', 'mở rộng theo chiều dọc', 'ch2-scalability', 'Chuyển sang máy mạnh hơn. Giá tăng nhanh hơn tài nguyên và có giới hạn máy lớn nhất.'),
    G('shared-memory', 'Shared-memory architecture', 'kiến trúc chung bộ nhớ', 'ch2-scalability', 'Nhiều thread/tiến trình trên một máy dùng chung RAM; cách mở rộng bằng scale up.'),
    G('shared-disk', 'Shared-disk architecture', 'kiến trúc chung đĩa', 'ch2-scalability', 'Nhiều máy có CPU, RAM riêng nhưng dùng chung dãy đĩa qua mạng (NAS/SAN). Bị giới hạn bởi tranh chấp và khoá.'),
    G('shared-nothing', 'Shared-nothing (scale out)', 'kiến trúc không chia sẻ', 'ch2-scalability', 'Mỗi node có CPU, RAM, đĩa riêng, phối hợp qua mạng ở tầng phần mềm. Mở rộng gần tuyến tính nhưng cần phân vùng dữ liệu.'),
    G('operability', 'Operability', 'tính dễ vận hành', 'ch2-maintainability', 'Mức dễ dàng để đội vận hành giữ hệ thống chạy ổn: giám sát tốt, không phụ thuộc từng máy, hành vi dễ đoán.'),
    G('simplicity', 'Simplicity', 'tính đơn giản', 'ch2-maintainability', 'Hệ thống dễ hiểu cho kỹ sư mới nhờ các mẫu quen thuộc, nhất quán và tránh độ phức tạp không cần thiết.'),
    G('big-ball-of-mud', 'Big ball of mud', 'cục bùn lớn', 'ch2-maintainability', 'Dự án phần mềm sa lầy trong độ phức tạp đến mức khó hiểu và khó sửa.'),
    G('accidental-complexity', 'Accidental complexity', 'độ phức tạp ngẫu nhiên', 'ch2-maintainability', 'Độ phức tạp sinh ra do giới hạn của công cụ, đối lập với essential complexity vốn có của bài toán. Ranh giới dịch chuyển khi công cụ tiến bộ.'),
    G('abstraction', 'Abstraction', 'trừu tượng hoá', 'ch2-maintainability', 'Giấu chi tiết cài đặt sau một giao diện gọn gàng, ví dụ SQL giấu cấu trúc dữ liệu trên đĩa và xử lý đồng thời.'),
    G('evolvability', 'Evolvability', 'khả năng tiến hoá', 'ch2-maintainability', 'Mức dễ dàng để thay đổi hệ thống khi yêu cầu đổi. Tăng lên khi hệ thống đơn giản và ít hành động không thể đảo ngược.'),
  ]);
})();
