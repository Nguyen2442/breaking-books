/* Chương 3 — Microservice Communication Styles: widgets + glossary */
(function () {
  const { h, s, clear, fmt, fmtMs, pct, rng, clamp, sleep,
          slider, seg, button, checkbox, stat, log, jsonHTML, widget, glossary } = window.DDIA;

  // ---------- helpers dùng chung ----------
  function svgBox(w, ht) {
    return s('svg', { viewBox: `0 0 ${w} ${ht}`, role: 'img', preserveAspectRatio: 'xMidYMid meet' });
  }
  function txt(parent, x, y, str, o = {}) {
    const t = s('text', { x, y, 'text-anchor': o.anchor || 'middle', class: o.cls || '' }, str);
    parent.appendChild(t);
    return t;
  }
  function node(parent, x, y, w, ht, label, fillCls, strokeCls, sub) {
    const g = s('g', { class: 'node' });
    g.appendChild(s('rect', { x, y, width: w, height: ht, rx: 7, class: (fillCls || 'f-surface') + ' ' + (strokeCls || 's-ink3') }));
    txt(g, x + w / 2, y + (sub ? ht / 2 - 2 : ht / 2 + 4), label, { cls: 'lbl-strong' });
    if (sub) txt(g, x + w / 2, y + ht / 2 + 11, sub, { cls: 'sm' });
    parent.appendChild(g);
    return g;
  }
  // stroke class s-xxx → đầu mũi tên tô f-xxx (chỉ dùng s-ink3, s-ink, s-accent, s-ok, s-warn, s-bad, s-violet, s-mark)
  function arrow(parent, x1, y1, x2, y2, cls = 's-ink3', dashed = false, thick = false) {
    const ang = Math.atan2(y2 - y1, x2 - x1), L = 7;
    parent.appendChild(s('line', { x1, y1, x2: x2 - Math.cos(ang) * 3, y2: y2 - Math.sin(ang) * 3, class: `f-none ${cls} ${thick ? 's-thick' : 's-thin'}${dashed ? ' dash' : ''}` }));
    const pts = [[x2, y2], [x2 - L * Math.cos(ang - 0.42), y2 - L * Math.sin(ang - 0.42)], [x2 - L * Math.cos(ang + 0.42), y2 - L * Math.sin(ang + 0.42)]];
    parent.appendChild(s('polygon', { points: pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' '), class: cls.replace('s-', 'f-') }));
  }
  /** Thời gian theo mili-giây → chuỗi có đơn vị phù hợp (ns, µs, ms, s, phút) */
  function fmtT(ms) {
    if (!isFinite(ms)) return '∞';
    if (ms < 0.001) return fmt(ms * 1e6, 0) + ' ns';
    if (ms < 1) return fmt(ms * 1000, ms * 1000 < 10 ? 1 : 0) + ' µs';
    if (ms >= 120000) return fmt(ms / 60000, 1) + ' phút';
    return fmtMs(ms);
  }
  function fmtBytes(b) {
    if (b >= 1024 * 1024 * 1024) return fmt(b / 1024 / 1024 / 1024, 1) + ' GB';
    if (b >= 1024 * 1024) return fmt(b / 1024 / 1024, 1) + ' MB';
    if (b >= 1024) return fmt(b / 1024, 1) + ' KB';
    return fmt(b) + ' B';
  }
  function verdict(tone, title, body) {
    return h('div', { class: 'c3-verdict ' + (tone || '') }, h('b', title), body ? h('span', body) : null);
  }
  function viz(svg) { return h('div', { class: 'viz' }, svg); }

  // =====================================================================
  // 3.1 — chi phí lời gọi trong tiến trình vs qua mạng
  // =====================================================================
  widget('ch3-inproc-cost', (root) => {
    const IN_CALL_MS = 2e-6;        // ~2 ns mỗi lời gọi không inline (minh hoạ)
    const RTT_MS = 1;               // 1 ms vòng khứ hồi trong data center (sách: "measured in milliseconds")
    const SER_MS_PER_KB = 0.02;     // tuần tự hoá + giải tuần tự hoá, 2 phía (minh hoạ)
    const WIRE_MS_PER_KB = 0.008;   // 1 Gbps ≈ 8 µs/KB (minh hoạ)

    const nSl = slider({ label: 'Số lời gọi (N)', min: 1, max: 5000, value: 1000, format: (v) => fmt(v), onInput: render });
    const kbSl = slider({ label: 'Payload mỗi lời gọi', min: 1, max: 500, value: 4, format: (v) => v + ' KB', onInput: render });
    const inl = checkbox('Compiler inline lời gọi trong tiến trình', true, render);
    const coarse = checkbox('Gộp N lời gọi thành 1 lời gọi thô (coarse-grained)', false, render);

    const sIn = stat('Trong tiến trình', '', 'ok');
    const sNet = stat('Qua mạng', '', 'bad');
    const sRatio = stat('Chậm hơn', '', 'warn');
    const sBytes = stat('Byte phải tuần tự hoá', '', 'accent');
    const svgHost = h('div', { class: 'viz' });
    const note = h('p', { class: 'lab-note' });

    root.append(
      h('div', { class: 'controls' }, nSl.el, kbSl.el),
      h('div', { class: 'controls' }, inl.el, coarse.el),
      h('div', { class: 'stats' }, sIn, sNet, sRatio, sBytes),
      svgHost, note,
      h('p', { class: 'lab-note' }, 'Giả định (số liệu minh hoạ): 1 ms mỗi vòng khứ hồi, 0,02 ms/KB cho tuần tự hoá và giải tuần tự hoá, mạng 1 Gbps; lời gọi trong tiến trình khoảng 2 ns, hoặc 0 nếu đã inline. Trong tiến trình chỉ truyền con trỏ, không sao chép payload.')
    );

    function render() {
      const n = nSl.value, kb = kbSl.value;
      const inMs = inl.input.checked ? 0 : n * IN_CALL_MS;
      const perCall = (k) => RTT_MS + k * (SER_MS_PER_KB + WIRE_MS_PER_KB);
      const fineMs = n * perCall(kb);
      const coarseMs = perCall(n * kb);
      const netMs = coarse.input.checked ? coarseMs : fineMs;
      const calls = coarse.input.checked ? 1 : n;
      sIn.update(inMs === 0 ? '0 (inline)' : fmtT(inMs), 'ok', inl.input.checked ? 'như chưa từng có lời gọi' : fmt(n) + ' lời gọi × ~2 ns');
      sNet.update(fmtT(netMs), netMs > 1000 ? 'bad' : netMs > 100 ? 'warn' : 'accent', fmt(calls) + ' network call');
      const base = Math.max(inMs, IN_CALL_MS);
      sRatio.update('×' + fmt(netMs / base, 0), 'warn', inl.input.checked ? 'so với 1 lời gọi 2 ns' : 'so với trong tiến trình');
      sBytes.update(fmtBytes(n * kb * 1024), 'accent', 'trong tiến trình: 0 B sao chép');
      draw(inMs, fineMs, coarseMs);
      note.textContent = coarse.input.checked
        ? `Gộp lại: vẫn ${fmtBytes(n * kb * 1024)} dữ liệu nhưng chỉ trả 1 lần chi phí vòng khứ hồi, nhanh hơn khoảng ×${fmt(fineMs / coarseMs, 1)} so với ${fmt(n)} lời gọi nhỏ.`
        : `${fmt(n)} lời gọi nhỏ: riêng chi phí vòng khứ hồi đã là ${fmtT(n * RTT_MS)}. Thử bật “gộp thành 1 lời gọi thô”.`;
    }

    function draw(inMs, fineMs, coarseMs) {
      const W = 640, H = 170, L = 150, R = 610;
      const svg = svgBox(W, H);
      const lo = -6, hi = 5; // log10(ms): 1 ns … 100 s
      const x = (ms) => L + (clamp(Math.log10(Math.max(ms, 1e-6)), lo, hi) - lo) / (hi - lo) * (R - L);
      [[-6, '1 ns'], [-3, '1 µs'], [0, '1 ms'], [3, '1 s'], [5, '100 s']].forEach(([e, lab]) => {
        const xx = L + (e - lo) / (hi - lo) * (R - L);
        svg.appendChild(s('line', { x1: xx, y1: 14, x2: xx, y2: 130, class: 'grid' }));
        txt(svg, xx, 146, lab, { cls: 'sm' });
      });
      txt(svg, (L + R) / 2, 164, 'Tổng thời gian (thang log)', { cls: 'sm' });
      const rows = [
        ['Trong tiến trình', inMs, 'f-ok'],
        [`Mạng: ${fmt(nSl.value)} lời gọi`, fineMs, coarse.input.checked ? 'f-ink3' : 'f-bad'],
        ['Mạng: 1 lời gọi thô', coarseMs, coarse.input.checked ? 'f-accent' : 'f-ink3'],
      ];
      rows.forEach(([lab, ms, cls], i) => {
        const y = 22 + i * 38;
        txt(svg, L - 8, y + 15, lab, { anchor: 'end' });
        const w = ms <= 0 ? 0 : Math.max(2, x(ms) - L);
        svg.appendChild(s('rect', { x: L, y, width: w, height: 22, rx: 3, class: cls }));
        txt(svg, L + w + 6, y + 15, ms <= 0 ? '0 (inline)' : fmtT(ms), { anchor: 'start', cls: 'lbl-strong' });
      });
      svg.appendChild(s('line', { x1: L, y1: 14, x2: L, y2: 130, class: 'axis' }));
      clear(svgHost).appendChild(svg);
    }
    render();
  });

  // =====================================================================
  // 3.2 — ngữ nghĩa lỗi và quyết định thử lại
  // =====================================================================
  widget('ch3-error-semantics', (root) => {
    const SCN = [
      { id: '404', label: '404 Not Found', fam: '4xx — lỗi của request', transient: false, recover: 0, why: 'Tài nguyên không tồn tại. Gửi lại y hệt cũng sẽ nhận 404.' },
      { id: '400', label: '400 Bad Request', fam: '4xx — lỗi của request', transient: false, recover: 0, why: 'Request sai định dạng. Phải sửa request chứ không phải gửi lại.' },
      { id: '503', label: '503 Service Unavailable', fam: '5xx — sự cố phía hạ lưu', transient: true, recover: 3, why: 'Hạ lưu tạm thời không xử lý được, có thể chỉ là nhất thời.' },
      { id: '501', label: '501 Not Implemented', fam: '5xx — sự cố phía hạ lưu', transient: false, recover: 0, why: 'Hạ lưu không hỗ trợ thao tác này. Thử lại cũng không giúp gì.' },
      { id: 'timeout', label: 'Timeout mạng', fam: 'Không có status code', transient: true, recover: 2, why: 'Ví dụ đơn giản nhất của lỗi thoáng qua.' },
      { id: 'oom', label: 'Container bị kill (OOM)', fam: 'Kết nối bị ngắt giữa chừng', transient: true, recover: 2, why: 'Instance chết vì dùng quá nhiều bộ nhớ; instance khác có thể xử lý lần sau.' },
    ];
    const MAX = 4;
    const CLIENTS = [
      { value: 'smart', label: 'Hiểu ngữ nghĩa lỗi' },
      { value: 'always', label: 'Cứ lỗi là thử lại' },
      { value: 'never', label: 'Không bao giờ thử lại' },
    ];
    let cur = '503';
    const chips = h('div', { class: 'c3-chips', role: 'group', 'aria-label': 'Chọn sự cố' });
    const chipBtns = SCN.map((sc) => {
      const b = button(sc.label, () => { cur = sc.id; render(); }, 'ghost');
      chips.appendChild(b);
      return [sc.id, b];
    });
    const cli = seg({ label: 'Chiến lược client', options: CLIENTS, value: 'smart', onChange: render });
    const runBtn = button('Gửi request', run);
    const info = h('div');
    const sAtt = stat('Số lần gọi', '', 'accent');
    const sRes = stat('Kết quả', '', 'ok');
    const sWaste = stat('Lời gọi lãng phí', '', 'ok');
    const lg = log();
    const tbody = h('tbody');
    const table = h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
      h('thead', h('tr', h('th', 'Sự cố'), h('th', 'Thoáng qua?'), ...CLIENTS.map((c) => h('th', c.label)))), tbody));

    root.append(
      h('div', { class: 'ctl-label lab-note' }, 'Sự cố phía hạ lưu:'), chips,
      h('div', { class: 'controls' }, h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Chiến lược client'), cli.el), h('div', { class: 'btn-row' }, runBtn)),
      info,
      h('div', { class: 'stats' }, sAtt, sRes, sWaste),
      lg, table,
      h('p', { class: 'lab-note' }, `Tối đa ${MAX} lần gọi. Với lỗi thoáng qua, giả định hạ lưu hồi phục ở lần gọi thứ 2 hoặc 3 (số liệu minh hoạ).`)
    );

    function simulate(sc, client) {
      const lines = [];
      let att = 0, ok = false;
      while (att < MAX) {
        att++;
        const success = sc.transient && att >= sc.recover;
        if (success) { lines.push([`Lần ${att}: 200 OK`, 'ok']); ok = true; break; }
        lines.push([`Lần ${att}: ${sc.label}`, 'bad']);
        if (client === 'never') { lines.push(['Client bỏ cuộc ngay, không thử lại.', 'warn']); break; }
        if (client === 'smart' && !sc.transient) { lines.push(['Lỗi không thoáng qua → dừng, báo lỗi lên trên, không phí thêm lời gọi.', 'acc']); break; }
        if (att < MAX) lines.push([`  chờ ${fmt(100 * 2 ** (att - 1))} ms rồi thử lại…`, 't']);
      }
      if (!ok && att === MAX) lines.push(['Hết số lần thử.', 'warn']);
      const wasted = !sc.transient ? att - 1 : 0;
      const missed = sc.transient && !ok;
      return { att, ok, wasted, missed, lines };
    }
    function outcomeLabel(r) {
      if (r.ok) return h('span', { class: 'pill ok' }, `Thành công sau ${r.att} lần`);
      if (r.missed) return h('span', { class: 'pill warn' }, 'Bỏ lỡ cơ hội hồi phục');
      if (r.wasted) return h('span', { class: 'pill bad' }, `Phí ${r.wasted} lời gọi`);
      return h('span', { class: 'pill accent' }, 'Dừng đúng lúc');
    }
    function render() {
      const sc = SCN.find((x) => x.id === cur);
      chipBtns.forEach(([id, b]) => b.setAttribute('aria-pressed', String(id === cur)));
      clear(info).appendChild(h('dl', { class: 'c3-kv' },
        h('dt', 'Nhóm'), h('dd', sc.fam),
        h('dt', 'Thoáng qua?'), h('dd', sc.transient ? 'Có, đáng thử lại sau một khoảng chờ' : 'Không, thử lại vô ích'),
        h('dt', 'Ý nghĩa'), h('dd', sc.why)));
      const r = simulate(sc, cli.value);
      sAtt.update(String(r.att), 'accent', `tối đa ${MAX}`);
      sRes.update(r.ok ? 'Thành công' : 'Thất bại', r.ok ? 'ok' : r.missed ? 'warn' : 'bad', r.missed ? 'lẽ ra thử lại là được' : r.ok ? '' : 'client cần hành động bù trừ');
      sWaste.update(String(r.wasted), r.wasted ? 'bad' : 'ok', r.wasted ? 'gửi lại một lỗi không thể tự hết' : 'không phí lời gọi nào');
      lg.reset();
      r.lines.forEach(([t, tone]) => lg.add(t, tone));
      clear(tbody);
      SCN.forEach((x) => {
        tbody.appendChild(h('tr', { class: x.id === cur ? 'hit' : '' },
          h('td', x.label), h('td', x.transient ? 'Có' : 'Không'),
          ...CLIENTS.map((c) => h('td', outcomeLabel(simulate(x, c.value))))));
      });
    }
    async function run() {
      runBtn.disabled = true;
      const sc = SCN.find((x) => x.id === cur);
      const r = simulate(sc, cli.value);
      lg.reset();
      lg.add(`→ GET /loyalty/accounts/42  (${CLIENTS.find((c) => c.value === cli.value).label})`, 't');
      for (const [t, tone] of r.lines) { await sleep(tone === 't' ? 380 : 220); lg.add(t, tone); }
      runBtn.disabled = false;
    }
    render();
  });

  // =====================================================================
  // 3.3 — cây quyết định của Hình 3-1
  // =====================================================================
  widget('ch3-style-picker', (root) => {
    const PRESETS = [
      { v: 'chart', label: 'Chart hỏi Inventory tồn kho', q1: 'sync', q2: 'rr', why: 'Chart cần số liệu ngay để dựng bảng xếp hạng; thao tác ngắn (Hình 3-8).' },
      { v: 'dispatch', label: 'Order Processor nhờ Warehouse giao hàng', q1: 'async', q2: 'rr', why: 'Giao hàng mất nhiều giờ, có khi nhiều ngày; vẫn cần biết kết quả, nên Warehouse báo lại sau (Hình 3-5).' },
      { v: 'packed', label: 'Warehouse báo tiến độ đóng gói', q1: 'async', q2: 'event', why: 'Warehouse chỉ kể điều đã xảy ra; Notifications và Inventory tự quyết định phản ứng (Hình 3-11).' },
      { v: 'import', label: 'New Product Importer gửi file sản phẩm', q1: 'async', q2: 'common', why: 'Khối dữ liệu lớn, nhiều bên đọc, không cần độ trễ thấp (Hình 3-6).' },
      { v: 'loyalty', label: 'Order Processor cộng điểm Loyalty', q1: 'sync', q2: 'rr', why: 'Ví dụ của Hình 3-2: gọi và chờ để chắc điểm đã được cộng.' },
    ];
    const TECH = [
      { v: 'rest', label: 'HTTP/REST' }, { v: 'grpc', label: 'gRPC' }, { v: 'kafka', label: 'Kafka' },
      { v: 'rabbit', label: 'RabbitMQ (hàng đợi)' }, { v: 'file', label: 'Thư mục file chung' },
    ];
    const FIT = {
      'sync-rr': { rest: ['ok', 'Hợp: gửi request, chờ response trên cùng kết nối.'], grpc: ['ok', 'Hợp: lời gọi RPC đồng bộ là đất diễn của gRPC.'], kafka: ['bad', 'Newman: dùng Kafka cho request-response là ý tồi, vì nó được thiết kế cho tương tác dựa trên sự kiện.'], rabbit: ['warn', 'Làm được request-response qua hàng đợi, nhưng khi đó nó là bất đồng bộ; ép thành chặn đồng bộ là đi ngược công cụ.'], file: ['bad', 'Thả file rồi chờ polling không thể cho kết quả “ngay”.'] },
      'async-rr': { rest: ['warn', 'Được nếu bên nhận gọi lại (callback) hoặc bên gửi poll trạng thái; phải tự lo phần ghép phản hồi.'], grpc: ['warn', 'Có thể gọi không chặn, nhưng không có hàng đợi đệm khi bên nhận vắng mặt.'], kafka: ['bad', 'Vẫn là request-response; Kafka thiên về sự kiện.'], rabbit: ['ok', 'Hợp: request queue và reply queue như Hình 3-10, có đệm khi bên nhận bận.'], file: ['bad', 'Không có khái niệm phản hồi cho từng request.'] },
      'event': { rest: ['warn', 'Có thể dùng ATOM feed qua HTTP, nhưng độ trễ kém và phải tự xây nhiều thứ (xem 3.12).'], grpc: ['warn', 'Không tự nhiên: bên phát sẽ phải biết bên nhận.'], kafka: ['ok', 'Hợp: Kafka được thiết kế cho tương tác dựa trên sự kiện.'], rabbit: ['ok', 'Hợp: broker lo publish và subscription; Newman tự nhận là người ủng hộ.'], file: ['warn', 'Bên nhận phải polling, khó dùng khi cần phản ứng nhanh.'] },
      'common': { rest: ['bad', 'Đẩy file vài GB qua một request HTTP không phải ý hay.'], grpc: ['bad', 'Không hợp với khối dữ liệu rất lớn gửi một lần.'], kafka: ['warn', 'Sách: nếu cần khối lượng lớn mà xử lý gần thời gian thực thì streaming như Kafka hợp hơn. Nếu không, hệ thống cũ khó mà nói chuyện được với Kafka.'], rabbit: ['bad', 'Message lớn gây vấn đề hiệu năng; không phải công cụ cho file nhiều GB.'], file: ['ok', 'Hợp: công nghệ phổ biến, mainframe nào cũng đọc được file.'] },
    };
    const NAMES = { 'sync-rr': 'Đồng bộ chặn · Request-response', 'async-rr': 'Bất đồng bộ · Request-response', 'event': 'Bất đồng bộ · Event-driven', 'common': 'Bất đồng bộ · Common data' };

    let q1 = 'sync', q2 = 'rr', preset = 'chart', tech = 'kafka';
    const presetSeg = seg({ label: 'Tình huống', options: PRESETS.map((p) => ({ value: p.v, label: p.label })), value: preset,
      onChange: (v) => { preset = v; const p = PRESETS.find((x) => x.v === v); q1 = p.q1; q2 = p.q2; q1Seg.set(q1); q2Seg.set(q2); render(); } });
    const q1Seg = seg({ label: 'Câu 1', options: [{ value: 'sync', label: 'Cần kết quả ngay, chờ được' }, { value: 'async', label: 'Không nên/không thể chờ' }], value: q1,
      onChange: (v) => { q1 = v; preset = null; presetSeg.set(null); render(); } });
    const q2Seg = seg({ label: 'Câu 2', options: [{ value: 'rr', label: 'Nhờ làm việc, cần biết kết quả' }, { value: 'event', label: 'Kể lại điều đã xảy ra' }, { value: 'common', label: 'Chuyển khối dữ liệu lớn' }], value: q2,
      onChange: (v) => { q2 = v; preset = null; presetSeg.set(null); render(); } });
    const techSeg = seg({ label: 'Công nghệ', options: TECH.map((t) => ({ value: t.v, label: t.label })), value: tech, onChange: (v) => { tech = v; render(); } });
    const svgHost = h('div', { class: 'viz' });
    const out = h('div');
    const fitOut = h('div');

    root.append(
      h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Tình huống của MusicCorp'), presetSeg.el),
      h('div', { class: 'lab-split' },
        h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, '1. Bên gọi có chờ kết quả không?'), q1Seg.el),
        h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, '2. Nếu bất đồng bộ: mục đích là gì?'), q2Seg.el)),
      svgHost, out,
      h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Thử “ép” một công nghệ quen tay vào kiểu này'), techSeg.el),
      fitOut
    );

    function key() { return q1 === 'sync' ? 'sync-rr' : q2 === 'rr' ? 'async-rr' : q2; }
    function render() {
      q2Seg.el.style.opacity = q1 === 'sync' ? '0.45' : '1';
      const k = key();
      const W = 640, H = 230;
      const svg = svgBox(W, H);
      const on = (cond) => (cond ? ['f-accent-soft', 's-accent'] : ['f-surface', 's-ink3']);
      const N = {
        root: [250, 8, 140, 34, 'Tương tác'],
        sync: [40, 88, 170, 38, 'Đồng bộ chặn'], async: [345, 88, 190, 38, 'Bất đồng bộ không chặn'],
        srr: [40, 172, 170, 44, 'Request-response'], arr: [235, 172, 125, 44, 'Request-response'],
        ev: [372, 172, 125, 44, 'Event-driven'], cd: [509, 172, 125, 44, 'Common data'],
      };
      const act = { root: true, sync: q1 === 'sync', async: q1 === 'async', srr: k === 'sync-rr', arr: k === 'async-rr', ev: k === 'event', cd: k === 'common' };
      const mid = (n, bottom) => [N[n][0] + N[n][2] / 2, N[n][1] + (bottom ? N[n][3] : 0)];
      [['root', 'sync'], ['root', 'async'], ['sync', 'srr'], ['async', 'arr'], ['async', 'ev'], ['async', 'cd']].forEach(([a, b]) => {
        const [x1, y1] = mid(a, true), [x2, y2] = mid(b, false);
        arrow(svg, x1, y1, x2, y2, act[a] && act[b] ? 's-accent' : 's-ink3', !(act[a] && act[b]), act[a] && act[b]);
      });
      Object.entries(N).forEach(([id, [x, y, w, ht, label]]) => {
        const [f, st] = on(act[id]);
        const sub = id === 'srr' ? 'REST, gRPC' : id === 'arr' ? 'hàng đợi + reply queue' : id === 'ev' ? 'broker, topic' : id === 'cd' ? 'file, data lake' : null;
        node(svg, x, y, w, ht, label, f, st + (act[id] ? ' s-thick' : ''), sub);
      });
      txt(svg, 125, 160, 'gần như luôn là', { cls: 'sm' });
      clear(svgHost).appendChild(svg);
      const p = PRESETS.find((x) => x.v === preset);
      clear(out).appendChild(verdict('ok', 'Kiểu được chọn: ' + NAMES[k], p ? p.why : 'Bạn tự trả lời hai câu hỏi. Chọn lại một tình huống để xem ví dụ trong sách.'));
      const [tone, msg] = FIT[k][tech];
      const tl = TECH.find((t) => t.v === tech).label;
      clear(fitOut).appendChild(verdict(tone, (tone === 'ok' ? 'Khớp: ' : tone === 'warn' ? 'Gượng ép: ' : 'Lệch: ') + tl + ' cho ' + NAMES[k], msg));
    }
    render();
  });

  // =====================================================================
  // 3.4 — Order Processor gọi đồng bộ sang Loyalty
  // =====================================================================
  widget('ch3-sync-loyalty', (root) => {
    const POOL = 50, OWN_MS = 20, TIMEOUT = 1000;
    const latSl = slider({ label: 'Độ trễ bình thường của Loyalty', min: 10, max: 900, step: 10, value: 80, format: (v) => v + ' ms', onInput: render });
    const rateSl = slider({ label: 'Đơn hàng đến Order Processor', min: 5, max: 400, step: 5, value: 150, format: (v) => v + ' đơn/s', onInput: render });
    const st = seg({ label: 'Trạng thái Loyalty', options: [{ value: 'ok', label: 'Bình thường' }, { value: 'slow', label: 'Quá tải (chậm ×10)' }, { value: 'down', label: 'Không truy cập được' }], value: 'ok', onChange: render });
    const sResp = stat('Order Processor phản hồi', '', 'ok');
    const sThreads = stat('Luồng đang chờ Loyalty', '', 'ok');
    const sOk = stat('Đơn xử lý được', '', 'ok');
    const svgHost = h('div', { class: 'viz' });
    const out = h('div');
    root.append(
      h('div', { class: 'controls' }, latSl.el, rateSl.el),
      h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Trạng thái Loyalty'), st.el),
      h('div', { class: 'stats' }, sResp, sThreads, sOk),
      svgHost, out,
      h('p', { class: 'lab-note' }, `Số liệu minh hoạ: pool ${POOL} luồng, Order Processor tự xử lý ${OWN_MS} ms mỗi đơn, timeout gọi Loyalty ${fmt(TIMEOUT)} ms. Số luồng bận ≈ lưu lượng × thời gian giữ luồng (định luật Little).`)
    );
    function render() {
      const mode = st.value, rate = rateSl.value;
      const raw = mode === 'slow' ? latSl.value * 10 : latSl.value;
      const timedOut = mode === 'down' || raw > TIMEOUT;
      const wait = timedOut ? TIMEOUT : raw;
      const T = OWN_MS + wait;
      const busy = rate * T / 1000;
      const sat = busy > POOL;
      const capacity = POOL / (T / 1000);
      const okFrac = timedOut ? 0 : sat ? capacity / rate : 1;
      sResp.update(sat ? 'tăng không giới hạn' : fmtMs(T), sat || timedOut ? 'bad' : T > 300 ? 'warn' : 'ok', sat ? 'đơn xếp hàng chờ luồng trống' : `${OWN_MS} ms tự xử lý + ${fmtMs(wait)} chờ`);
      sThreads.update(`${fmt(Math.min(busy, POOL))}/${POOL}`, sat ? 'bad' : busy > POOL * 0.7 ? 'warn' : 'ok', sat ? `cần ${fmt(busy)} luồng` : 'luồng bị chặn chờ phản hồi');
      sOk.update(pct(okFrac, 0), okFrac === 1 ? 'ok' : okFrac > 0.5 ? 'warn' : 'bad', timedOut ? 'mọi lời gọi Loyalty hết thời gian chờ' : sat ? `chỉ phục vụ được ${fmt(capacity)} đơn/s` : '');
      // vẽ pool luồng
      const W = 640, H = 150, svg = svgBox(W, H);
      node(svg, 10, 52, 120, 44, 'Order Processor', 'f-surface', sat ? 's-bad s-thick' : 's-ink3');
      node(svg, 510, 52, 120, 44, 'Loyalty', mode === 'down' ? 'f-bad-soft' : mode === 'slow' ? 'f-warn-soft' : 'f-surface', mode === 'down' ? 's-bad' : mode === 'slow' ? 's-warn' : 's-ink3', mode === 'down' ? 'không truy cập được' : fmtMs(raw));
      arrow(svg, 132, 66, 508, 66, timedOut ? 's-bad' : 's-ink3', mode === 'down');
      txt(svg, 320, 60, timedOut ? 'chờ đến timeout…' : 'gọi đồng bộ, chặn chờ', { cls: 'sm' });
      arrow(svg, 508, 84, 132, 84, 's-ink3', true);
      txt(svg, 320, 98, 'response', { cls: 'sm' });
      const filled = Math.min(POOL, Math.round(busy));
      for (let i = 0; i < POOL; i++) {
        const cx = 150 + (i % 25) * 14, cy = 118 + Math.floor(i / 25) * 14;
        svg.appendChild(s('rect', { x: cx, y: cy, width: 10, height: 10, rx: 2, class: i < filled ? (sat ? 'f-bad' : 'f-warn') : 'f-surface2' }));
      }
      txt(svg, 150, 112, 'Pool luồng của Order Processor (ô tô màu = đang chặn chờ Loyalty)', { anchor: 'start', cls: 'sm' });
      clear(svgHost).appendChild(svg);
      clear(out).appendChild(
        timedOut ? verdict('bad', 'Ràng buộc thời gian lộ diện', 'Loyalty không trả lời kịp, mọi đơn đều phải chọn hành động bù trừ: thử lại ngay, đệm lại để thử sau, hay bỏ qua việc cộng điểm. Trong lúc chờ timeout, luồng vẫn bị giữ.')
        : sat ? verdict('bad', 'Sự cố lan ngược lên trên', `Mỗi đơn giữ một luồng ${fmtMs(T)}; ${POOL} luồng không đủ cho ${rate} đơn/s. Loyalty chậm, giờ Order Processor cũng chậm, và bên gọi Order Processor sẽ chậm theo.`)
        : verdict('ok', 'Ổn, trong lúc mọi thứ còn nhanh', 'Đơn giản, quen thuộc, dễ đọc code. Thử chuyển Loyalty sang “Quá tải”.'));
    }
    render();
  });

  // =====================================================================
  // 3.5 — chuỗi gọi & Fraud Detection chạy nền
  // =====================================================================
  widget('ch3-call-chain', (root) => {
    const HOP = 2, RATE = 100;
    const avSl = slider({ label: 'Độ khả dụng mỗi dịch vụ', min: 950, max: 9999, step: 1, value: 9900, format: (v) => fmt(v / 100, 2) + '%', onInput: render });
    const fdSl = slider({ label: 'Độ trễ Fraud Detection', min: 20, max: 2000, step: 10, value: 150, format: (v) => v + ' ms', onInput: render });
    const bg = checkbox('Đưa Fraud Detection ra chạy nền (Hình 3-4)', false, render);
    const sLat = stat('Độ trễ một lần mua', '', 'ok');
    const sAv = stat('Xác suất thành công', '', 'ok');
    const sCp = stat('Dịch vụ trên đường găng', '', 'accent');
    const sConn = stat('Kết nối mở đồng thời', '', 'ok');
    const svgHost = h('div', { class: 'viz' });
    root.append(
      h('div', { class: 'controls' }, avSl.el, fdSl.el),
      h('div', { class: 'controls' }, bg.el),
      h('div', { class: 'stats' }, sLat, sAv, sCp, sConn),
      svgHost,
      h('p', { class: 'lab-note' }, `Số liệu minh hoạ: Order Processor 20 ms, Payment 40 ms, Customer 30 ms, mỗi chặng mạng ${HOP} ms; ${RATE} lượt mua/giây để ước lượng số kết nối phải giữ mở cùng lúc.`)
    );
    function render() {
      const a = avSl.value / 10000, F = fdSl.value, back = bg.input.checked;
      const OP = 20, PAY = 40, CUS = 30;
      let lat, hold, cp;
      if (!back) {
        const custHold = HOP + CUS, fraudHold = HOP + F + custHold, payHold = HOP + PAY + fraudHold;
        lat = OP + payHold; hold = custHold + fraudHold + payHold; cp = 4;
      } else {
        lat = OP + HOP + PAY; hold = HOP + PAY; cp = 2;
      }
      const av = Math.pow(a, cp);
      const conns = RATE * hold / 1000;
      sLat.update(fmtMs(lat), lat > 1000 ? 'bad' : lat > 300 ? 'warn' : 'ok', back ? 'Fraud Detection không còn trong luồng' : 'cộng dồn cả ba chặng');
      sAv.update(pct(av, 2), av < 0.97 ? 'bad' : av < 0.99 ? 'warn' : 'ok', `= ${fmt(a * 100, 2)}%^${cp}`);
      sCp.update(String(cp), back ? 'ok' : 'accent', back ? 'Order Processor, Payment' : 'cả bốn dịch vụ');
      sConn.update(fmt(conns, 1), conns > 50 ? 'bad' : conns > 15 ? 'warn' : 'ok', back ? '1 kết nối mỗi lượt mua' : '3 kết nối lồng nhau mỗi lượt mua');

      const W = 640, H = back ? 214 : 170, svg = svgBox(W, H);
      const xs = [12, 170, 328, 486], bw = 142, y0 = 18;
      const names = ['Order Processor', 'Payment', 'Fraud Detection', 'Customer'];
      const subs = [`${OP} ms`, `${PAY} ms`, `${F} ms`, `${CUS} ms`];
      names.forEach((n, i) => {
        const onCrit = !back || i < 2;
        const y = onCrit ? y0 : 120;
        const fill = i === 2 && F > 500 ? 'f-warn-soft' : onCrit ? 'f-accent-soft' : 'f-surface';
        node(svg, xs[i], y, bw, 42, n, fill, onCrit ? 's-accent' : 's-ink3', subs[i]);
      });
      if (!back) {
        for (let i = 0; i < 3; i++) arrow(svg, xs[i] + bw, y0 + 21, xs[i + 1], y0 + 21, 's-accent', false, true);
        txt(svg, 320, 84, 'Mỗi mũi tên là một kết nối mở, giữ cho tới khi mọi chặng phía sau trả lời', { cls: 'sm' });
      } else {
        arrow(svg, xs[0] + bw, y0 + 21, xs[1], y0 + 21, 's-accent', false, true);
        arrow(svg, xs[2] + bw, 141, xs[3], 141, 's-ink3');
        arrow(svg, xs[2] + 20, 118, xs[1] + bw - 20, y0 + 44, 's-violet', true);
        txt(svg, 330, 98, 'chạy nền: cập nhật hồ sơ rủi ro của khách,', { anchor: 'start', cls: 'sm' });
        txt(svg, 330, 110, 'Payment kiểm tra sớm, không phải chờ', { anchor: 'start', cls: 'sm' });
      }
      // thanh thời gian
      const ty = H - 34, scale = 600 / Math.max(lat, 300);
      txt(svg, 12, ty - 6, 'Đường găng theo thời gian', { anchor: 'start', cls: 'sm' });
      const segs = back ? [[OP, 'f-accent'], [HOP, 'f-ink3'], [PAY, 'f-accent']]
        : [[OP, 'f-accent'], [HOP, 'f-ink3'], [PAY, 'f-accent'], [HOP, 'f-ink3'], [F, 'f-warn'], [HOP, 'f-ink3'], [CUS, 'f-accent']];
      let xx = 12;
      segs.forEach(([ms, cls]) => { const w = ms * scale; svg.appendChild(s('rect', { x: xx, y: ty, width: Math.max(w, 0.5), height: 14, class: cls })); xx += w; });
      txt(svg, Math.min(xx + 6, 560), ty + 11, fmtMs(lat), { anchor: 'start', cls: 'lbl-strong' });
      clear(svgHost).appendChild(svg);
    }
    render();
  });

  // =====================================================================
  // 3.6 — Warehouse: chặn chờ hàng giờ hay để Warehouse gọi lại
  // =====================================================================
  widget('ch3-async-warehouse', (root) => {
    const LB_TIMEOUT_S = 60; // minh hoạ: proxy/load balancer cắt kết nối nhàn rỗi
    const hrSl = slider({ label: 'Thời gian đóng gói & giao', min: 1, max: 72, value: 8, format: (v) => v + ' giờ', onInput: () => render() });
    const rateSl = slider({ label: 'Đơn cần giao mỗi giờ', min: 10, max: 500, step: 10, value: 120, format: (v) => v + ' đơn/giờ', onInput: () => render() });
    const mode = seg({ label: 'Chế độ', options: [{ value: 'sync', label: 'Đồng bộ chặn' }, { value: 'async', label: 'Bất đồng bộ không chặn' }], value: 'async', onChange: () => render() });
    const runBtn = button('Giao một đơn hàng', run);
    const sHeld = stat('Luồng/kết nối bị giữ cùng lúc', '', 'ok');
    const sPend = stat('Đơn đang chờ giao', '', 'accent');
    const sConn = stat('Một kết nối phải sống', '', 'ok');
    const svgHost = h('div', { class: 'viz' });
    const lg = log();
    root.append(
      h('div', { class: 'controls' }, hrSl.el, rateSl.el),
      h('div', { class: 'controls' }, h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Order Processor gọi Warehouse theo kiểu'), mode.el), h('div', { class: 'btn-row' }, runBtn)),
      h('div', { class: 'stats' }, sHeld, sPend, sConn),
      svgHost, lg,
      h('p', { class: 'lab-note' }, `Số liệu minh hoạ: proxy/load balancer cắt kết nối nhàn rỗi sau ${LB_TIMEOUT_S} giây; gửi một yêu cầu bất đồng bộ mất khoảng 50 ms.`)
    );
    let cursor = null;
    function render(progress) {
      const H = hrSl.value, rate = rateSl.value, sync = mode.value === 'sync';
      const pending = rate * H;
      sHeld.update(sync ? fmt(pending) : fmt(rate / 3600 * 0.05, 3), sync ? 'bad' : 'ok', sync ? 'mỗi đơn giữ một luồng suốt ' + H + ' giờ' : 'chỉ trong lúc gửi (~50 ms)');
      sPend.update(fmt(pending), 'accent', sync ? 'nằm trong luồng bị chặn' : 'nằm trong database, chờ Warehouse báo lại');
      sConn.update(sync ? H + ' giờ' : '~50 ms', sync ? 'bad' : 'ok', sync ? `vượt xa ${LB_TIMEOUT_S} s timeout` : 'Warehouse gọi lại khi có tiến độ');
      const W = 640, HH = 150, svg = svgBox(W, HH), L = 120, R = 620;
      const x = (f) => L + f * (R - L);
      txt(svg, L - 8, 46, 'Order Processor', { anchor: 'end', cls: 'lbl-strong' });
      txt(svg, L - 8, 98, 'Warehouse', { anchor: 'end', cls: 'lbl-strong' });
      svg.appendChild(s('rect', { x: L, y: 84, width: R - L, height: 22, rx: 3, class: 'f-violet-soft s-violet s-thin' }));
      txt(svg, (L + R) / 2, 99, 'tìm CD trên kệ → đóng gói → chờ đơn vị vận chuyển', { cls: 'sm' });
      if (sync) {
        svg.appendChild(s('rect', { x: L, y: 32, width: R - L, height: 22, rx: 3, class: 'f-bad-soft s-bad s-thin' }));
        txt(svg, (L + R) / 2, 47, 'luồng bị chặn, kết nối mở, chờ response…', { cls: 'sm' });
        const cut = L + Math.max(6, (LB_TIMEOUT_S / 3600 / H) * (R - L));
        svg.appendChild(s('line', { x1: cut, y1: 26, x2: cut, y2: 112, class: 'f-none s-bad s-thick' }));
        txt(svg, cut + 4, 22, `kết nối bị cắt sau ${LB_TIMEOUT_S} s`, { anchor: 'start', cls: 'sm' });
      } else {
        svg.appendChild(s('rect', { x: L, y: 32, width: R - L, height: 22, rx: 3, class: 'f-ok-soft s-ok s-thin' }));
        txt(svg, (L + R) / 2 + 20, 47, 'rảnh tay xử lý đơn khác', { cls: 'sm' });
        svg.appendChild(s('rect', { x: L, y: 32, width: 5, height: 22, class: 'f-accent' }));
        arrow(svg, L + 3, 56, L + 3, 82, 's-accent');
        [[0.25, 'đã lấy hàng'], [0.6, 'đã đóng gói'], [1, 'đã bàn giao']].forEach(([f, lab]) => {
          arrow(svg, x(f) - 3, 82, x(f) - 3, 56, 's-violet', true);
          txt(svg, x(f) - 6, 124, lab, { anchor: f === 1 ? 'end' : 'middle', cls: 'sm' });
        });
      }
      svg.appendChild(s('line', { x1: L, y1: 132, x2: R, y2: 132, class: 'axis' }));
      [0, 0.5, 1].forEach((f) => txt(svg, x(f), 146, fmt(f * H, 1) + ' giờ', { anchor: f === 0 ? 'start' : f === 1 ? 'end' : 'middle', cls: 'sm' }));
      if (progress != null) svg.appendChild(s('line', { x1: x(progress), y1: 26, x2: x(progress), y2: 132, class: 'f-none s-mark s-thick' }));
      clear(svgHost).appendChild(svg);
      cursor = progress;
    }
    async function run() {
      runBtn.disabled = true;
      lg.reset();
      const H = hrSl.value, sync = mode.value === 'sync';
      lg.add(`Đơn #1042 đã thu tiền. Order Processor gửi yêu cầu giao hàng tới Warehouse (${sync ? 'đồng bộ chặn' : 'bất đồng bộ'}).`, 't');
      render(0); await sleep(450);
      if (sync) {
        lg.add('Order Processor mở kết nối, gửi request, chặn luồng chờ response…', 'warn');
        render(Math.min(0.02, 60 / 3600 / H)); await sleep(650);
        lg.add(`Sau ${LB_TIMEOUT_S} giây: load balancer cắt kết nối nhàn rỗi.`, 'bad');
        await sleep(450);
        lg.add('Order Processor nhận lỗi, nhưng Warehouse vẫn đang đóng gói. Đơn đã giao hay chưa? Thử lại có gây giao trùng không?', 'bad');
      } else {
        lg.add('Gửi xong trong ~50 ms. Lưu “đang chờ giao” vào database, luồng quay lại xử lý đơn khác.', 'ok');
        for (const [f, msg] of [[0.25, 'Warehouse → Order Processor: đã lấy hàng khỏi kệ'], [0.6, 'Warehouse → Order Processor: đã đóng gói'], [1, 'Warehouse → Order Processor: đã bàn giao cho đơn vị vận chuyển']]) {
          for (let p = (cursor || 0); p <= f; p += 0.05) { render(p); await sleep(40); }
          lg.add(`[${fmt(f * H, 1)} giờ] ${msg}`, 'acc');
        }
        lg.add('Order Processor nạp trạng thái đơn #1042 từ database và cập nhật “đã giao”.', 'ok');
      }
      render();
      runBtn.disabled = false;
    }
    render();
    lg.add('Bấm “Giao một đơn hàng” để xem dòng thời gian của một đơn.', 't');
  });

  // =====================================================================
  // 3.7 — common data: thả file, polling
  // =====================================================================
  widget('ch3-common-data-polling', (root) => {
    const SIM = 180, PH_INV = 3, PH_CAT = 7;
    let files = [12, 70, 131];
    const r = rng(33);
    const invSl = slider({ label: 'Inventory polling mỗi', min: 1, max: 60, value: 15, format: (v) => v + ' phút', onInput: render });
    const catSl = slider({ label: 'Catalog polling mỗi', min: 1, max: 60, value: 60, format: (v) => v + ' phút', onInput: render });
    const notify = checkbox('Gửi kèm lời gọi báo “có file mới”', false, render);
    const size = seg({ label: 'Kích thước file', options: [{ value: 0.5, label: '500 KB' }, { value: 50, label: '50 MB' }, { value: 2048, label: '2 GB' }], value: 2048, onChange: render });
    const dropBtn = button('Thả file mới', () => { if (files.length < 8) files.push(Math.floor(r() * 170)); files.sort((a, b) => a - b); render(); });
    const resetBtn = button('Đặt lại', () => { files = [12, 70, 131]; render(); }, 'ghost');
    const sInv = stat('Độ trễ TB · Inventory', '', 'ok');
    const sCat = stat('Độ trễ TB · Catalog', '', 'ok');
    const sMax = stat('Chậm nhất', '', 'ok');
    const svgHost = h('div', { class: 'viz' });
    const out = h('div');
    root.append(
      h('div', { class: 'controls' }, invSl.el, catSl.el),
      h('div', { class: 'controls' }, notify.el, h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Kích thước mỗi file (minh hoạ)'), size.el)),
      h('div', { class: 'btn-row' }, dropBtn, resetBtn),
      h('div', { class: 'stats' }, sInv, sCat, sMax),
      svgHost, out
    );
    function pickup(t, iv, ph) {
      if (notify.input.checked) return t + 1;
      const k = Math.max(0, Math.ceil((t - ph) / iv));
      return ph + k * iv;
    }
    function render() {
      const iv = invSl.value, cv = catSl.value;
      const W = 640, H = 176, L = 110, R = 625, svg = svgBox(W, H);
      const x = (m) => L + m / SIM * (R - L);
      const lanes = [['New Product Importer', 30], ['Inventory', 80], ['Catalog', 130]];
      lanes.forEach(([n, y]) => { txt(svg, L - 8, y + 4, n, { anchor: 'end', cls: 'lbl-strong' }); svg.appendChild(s('line', { x1: L, y1: y, x2: R, y2: y, class: 'grid' })); });
      if (!notify.input.checked) {
        [[iv, PH_INV, 80], [cv, PH_CAT, 130]].forEach(([step, ph, y]) => {
          for (let t = ph; t <= SIM; t += step) svg.appendChild(s('line', { x1: x(t), y1: y - 6, x2: x(t), y2: y + 6, class: 'f-none s-ink3 s-thin' }));
        });
      }
      const dI = [], dC = [];
      files.forEach((t, i) => {
        const pi = pickup(t, iv, PH_INV), pc = pickup(t, cv, PH_CAT);
        dI.push(pi - t); dC.push(pc - t);
        svg.appendChild(s('rect', { x: x(t) - 6, y: 22, width: 12, height: 16, rx: 2, class: 'f-mark s-mark' }));
        txt(svg, x(t), 16, 'F' + (i + 1), { cls: 'sm' });
        [[pi, 80, 's-accent', 'f-accent'], [pc, 130, 's-violet', 'f-violet']].forEach(([p, y, sc, fc]) => {
          const px = x(Math.min(p, SIM + 6));
          svg.appendChild(s('line', { x1: x(t), y1: 38, x2: px, y2: y - 5, class: 'f-none dash s-thin ' + sc }));
          svg.appendChild(s('circle', { cx: px, cy: y, r: 4.5, class: fc }));
        });
      });
      svg.appendChild(s('line', { x1: L, y1: 152, x2: R, y2: 152, class: 'axis' }));
      for (let m = 0; m <= SIM; m += 30) txt(svg, x(m), 168, m + "'", { cls: 'sm' });
      clear(svgHost).appendChild(svg);
      const avg = (a) => a.reduce((p, c) => p + c, 0) / a.length;
      const mi = avg(dI), mc = avg(dC), mx = Math.max(...dI, ...dC);
      const tone = (v) => (v > 30 ? 'bad' : v > 10 ? 'warn' : 'ok');
      sInv.update(fmt(mi, 1) + ' phút', tone(mi), notify.input.checked ? 'nhận lời gọi báo ngay' : `lý thuyết ≈ ${fmt(iv / 2, 1)} phút (nửa chu kỳ)`);
      sCat.update(fmt(mc, 1) + ' phút', tone(mc), notify.input.checked ? 'nhận lời gọi báo ngay' : `lý thuyết ≈ ${fmt(cv / 2, 1)} phút`);
      sMax.update(fmt(mx, 0) + ' phút', tone(mx), `${files.length} file trong ${SIM} phút`);
      const mb = size.value;
      clear(out).append(
        verdict('ok', `File ${mb >= 1024 ? fmt(mb / 1024, 0) + ' GB' : mb < 1 ? '500 KB' : fmt(mb) + ' MB'} qua hệ thống file chung: được`, 'Ghi file và đọc file thì hệ thống nào cũng làm được, kể cả mainframe hay phần mềm COTS.'),
        mb > 1 ? verdict('bad', 'Nhét nguyên file vào một message Kafka: vượt giới hạn mặc định 1 MB', 'Khối lượng lớn gửi một lần là đất diễn của common data.')
          : verdict('warn', 'File nhỏ: một message cũng chở được', 'Khi dữ liệu nhỏ và cần độ trễ thấp, polling theo phút có lẽ không phải lựa chọn tốt nhất.'));
    }
    render();
  });

  // =====================================================================
  // 3.8 — data lake / data warehouse / shared database
  // =====================================================================
  widget('ch3-lake-warehouse', (root) => {
    const STORES = {
      lake: { label: 'Data lake', flow: 'Một chiều: nguồn → lake → bên đọc', who: 'Bên đọc phải hiểu định dạng thô của từng nguồn', change: 'Nguồn Order đổi định dạng thô (đổi tên trường total → amount)', breakP: [], breakC: [0, 1], warnC: [] },
      wh: { label: 'Data warehouse', flow: 'Một chiều: bên ghi → warehouse → bên đọc', who: 'Bên ghi phải biết cấu trúc của warehouse', change: 'Warehouse đổi schema bảng fact_orders', breakP: [0, 1], breakC: [], warnC: [0, 1] },
      db: { label: 'Database dùng chung', flow: 'Hai chiều: nhiều bên cùng đọc và ghi', who: 'Mọi bên đều phụ thuộc cấu trúc bảng orders', change: 'Đổi cột status từ chuỗi sang mã số', breakP: [0, 1], breakC: [], warnC: [] },
    };
    let kind = 'lake', changed = false;
    const kSeg = seg({ label: 'Loại kho', options: Object.entries(STORES).map(([v, o]) => ({ value: v, label: o.label })), value: kind, onChange: (v) => { kind = v; changed = false; lg.reset(); render(); } });
    const chBtn = button('Đổi cấu trúc dữ liệu', () => { changed = true; render(); });
    const raceBtn = button('Hai bên cùng ghi đơn #1042', race, 'ghost');
    const resetBtn = button('Đặt lại', () => { changed = false; lg.reset(); render(); }, 'ghost');
    const svgHost = h('div', { class: 'viz' });
    const info = h('div');
    const lg = log();
    root.append(
      h('div', { class: 'controls' }, h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Loại kho dùng chung'), kSeg.el)),
      h('div', { class: 'btn-row' }, chBtn, raceBtn, resetBtn),
      svgHost, info, lg
    );
    function render() {
      const st = STORES[kind];
      raceBtn.disabled = kind !== 'db';
      const W = 640, H = 190, svg = svgBox(W, H);
      if (kind === 'db') {
        const ps = ['Order Processor', 'Warehouse'];
        node(svg, 245, 70, 150, 50, 'orders (DB chung)', 'f-mark-soft', 's-mark', 'status, items, address…');
        ps.forEach((p, i) => {
          const x = i === 0 ? 20 : 470, broken = changed && st.breakP.includes(i);
          node(svg, x, 72, 150, 46, p, broken ? 'f-bad-soft' : 'f-surface', broken ? 's-bad s-thick' : 's-ink3', broken ? 'vỡ: đọc/ghi sai cột' : 'đọc + ghi');
          const [a, b] = i === 0 ? [170, 245] : [470, 395];
          arrow(svg, a, 88, b, 88, 's-ink'); arrow(svg, b, 104, a, 104, 's-ink');
        });
        txt(svg, 320, 150, 'Cả hai cùng ghi một bản ghi đơn hàng (Hình 3-7): common coupling', { cls: 'sm' });
      } else {
        const srcs = ['Order', 'Customer'], cons = ['Báo cáo doanh thu', 'Gợi ý sản phẩm'];
        node(svg, 245, 62, 150, 56, st.label, kind === 'lake' ? 'f-accent-soft' : 'f-violet-soft', kind === 'lake' ? 's-accent' : 's-violet', kind === 'lake' ? 'dữ liệu thô, định dạng tuỳ ý' : 'có cấu trúc, schema cố định');
        srcs.forEach((n, i) => {
          const y = 30 + i * 80, broken = changed && st.breakP.includes(i);
          const changedSrc = changed && kind === 'lake' && i === 0;
          node(svg, 20, y, 150, 44, n, broken ? 'f-bad-soft' : changedSrc ? 'f-mark-soft' : 'f-surface', broken ? 's-bad s-thick' : changedSrc ? 's-mark' : 's-ink3', broken ? 'vỡ: phải sửa code ghi' : changedSrc ? 'đã đổi định dạng' : 'bên ghi');
          arrow(svg, 170, y + 22, 245, 90, 's-ink');
        });
        cons.forEach((n, i) => {
          const y = 30 + i * 80, broken = changed && st.breakC.includes(i), warn = changed && st.warnC.includes(i);
          node(svg, 470, y, 150, 44, n, broken ? 'f-bad-soft' : warn ? 'f-warn-soft' : 'f-surface', broken ? 's-bad s-thick' : warn ? 's-warn' : 's-ink3', broken ? 'vỡ: không parse được' : warn ? 'kiểm tra truy vấn' : 'bên đọc');
          arrow(svg, 395, 90, 470, y + 22, 's-ink');
        });
        if (kind === 'wh' && changed) txt(svg, 320, 140, 'schema mới', { cls: 'lbl-strong' });
        txt(svg, 320, 178, 'Luồng một chiều: dễ suy luận hơn', { cls: 'sm' });
      }
      clear(svgHost).appendChild(svg);
      clear(info).append(h('dl', { class: 'c3-kv' },
        h('dt', 'Hướng luồng'), h('dd', st.flow),
        h('dt', 'Ai gánh ràng buộc'), h('dd', st.who),
        h('dt', 'Thay đổi thử'), h('dd', st.change)),
        changed ? verdict(kind === 'db' ? 'bad' : 'warn',
          kind === 'lake' ? 'Bên đọc vỡ, bên ghi không hay biết' : kind === 'wh' ? 'Bên ghi phải cập nhật theo cấu trúc kho' : 'Cả hai microservice cùng vỡ',
          kind === 'lake' ? 'Data lake đẩy sự hiểu biết về định dạng sang phía đọc: nguồn đổi gì, bên đọc gánh.' : kind === 'wh' ? 'Sách: microservice đẩy dữ liệu vào warehouse phải biết cấu trúc của nó, và phải được cập nhật khi cấu trúc thay đổi.' : 'Đổi cấu trúc kho có thể làm đứt giao tiếp giữa các microservice, và không ai thật sự sở hữu bản ghi.')
          : h('p', { class: 'lab-note' }, 'Bấm “Đổi cấu trúc dữ liệu” để xem bên nào bị ảnh hưởng.'));
    }
    async function race() {
      raceBtn.disabled = true;
      lg.reset();
      const steps = [
        ['Order Processor đọc đơn #1042: status = PAID', 't'],
        ['Warehouse đọc đơn #1042: status = PAID', 't'],
        ['Khách huỷ đơn. Order Processor ghi status = CANCELLED', 'warn'],
        ['Warehouse đóng gói xong, ghi status = DISPATCHED (đè lên CANCELLED)', 'bad'],
        ['Kết quả: đơn đã huỷ nhưng vẫn được giao. Không microservice nào sở hữu bản ghi để giữ quy tắc nghiệp vụ.', 'bad'],
      ];
      for (const [t, tone] of steps) { lg.add(t, tone); await sleep(380); }
      lg.add('(Minh hoạ cho common coupling; cách giải quyết là để một microservice sở hữu đơn hàng và các bên khác yêu cầu hoặc lắng nghe sự kiện.)', 't');
      raceBtn.disabled = kind !== 'db';
    }
    render();
  });

  // =====================================================================
  // 3.9 — request-response bất đồng bộ qua request queue & reply queue
  // =====================================================================
  widget('ch3-async-reqresp', (root) => {
    const ORDERS = [
      { id: 101, item: 'CD-A', from: 0 }, { id: 102, item: 'CD-B', from: 1 }, { id: 103, item: 'CD-A', from: 2 },
      { id: 104, item: 'CD-B', from: 0 }, { id: 105, item: 'CD-A', from: 1 }, { id: 106, item: 'CD-C', from: 2 },
    ];
    const STOCK0 = { 'CD-A': 2, 'CD-B': 1, 'CD-C': 1 };
    const dbChk = checkbox('Lưu trạng thái đơn vào database (mã đơn làm correlation ID)', true, () => {});
    const runBtn = button('Gửi 6 yêu cầu giữ hàng', () => run(false));
    const sQ = stat('Trong request queue', '0', 'accent');
    const sOk = stat('Đã giữ hàng', '0', 'ok');
    const sRej = stat('Bị từ chối', '0', 'warn');
    const sOrph = stat('Phản hồi mồ côi', '0', 'ok');
    const svgHost = h('div', { class: 'viz' });
    const lg = log();
    root.append(
      h('div', { class: 'controls' }, dbChk.el, h('div', { class: 'btn-row' }, runBtn)),
      h('div', { class: 'stats' }, sQ, sOk, sRej, sOrph),
      svgHost, lg,
      h('p', { class: 'lab-note' }, 'Tồn kho ban đầu (minh hoạ): CD-A ×2, CD-B ×1, CD-C ×1. Inventory xử lý từng request khi sẵn sàng; phản hồi được instance Order Processor nào rảnh lấy ra trước.')
    );
    let S;
    function fresh() { return { reqQ: [], repQ: [], stock: { ...STOCK0 }, ok: 0, rej: 0, orph: 0, busy: null, mem: [new Set(), new Set(), new Set()], hl: -1 }; }
    function draw() {
      const W = 640, H = 196, svg = svgBox(W, H);
      for (let i = 0; i < 3; i++) node(svg, 8, 18 + i * 58, 112, 40, 'Order Processor', S.hl === i ? 'f-accent-soft' : 'f-surface', S.hl === i ? 's-accent s-thick' : 's-ink3', 'OP-' + (i + 1));
      const qx = 180, qw = 270;
      [['Request queue', 30, S.reqQ, 'f-mark-soft', 's-mark'], ['Reply queue', 134, S.repQ, 'f-violet-soft', 's-violet']].forEach(([lab, y, q, f, st]) => {
        svg.appendChild(s('rect', { x: qx, y, width: qw, height: 34, rx: 6, class: 'f-surface2 s-ink3 s-thin' }));
        txt(svg, qx + qw / 2, y - 6, lab, { cls: 'sm' });
        q.slice(0, 6).forEach((m, i) => {
          const mx = qx + qw - 44 - i * 44;
          svg.appendChild(s('rect', { x: mx, y: y + 5, width: 40, height: 24, rx: 4, class: f + ' ' + st }));
          txt(svg, mx + 20, y + 21, '#' + m.id + (m.res ? (m.res === 'ok' ? ' ✓' : ' ✗') : ''), { cls: 'sm mono' });
        });
      });
      const inv = S.stock;
      node(svg, 500, 64, 132, 66, 'Inventory', S.busy ? 'f-accent-soft' : 'f-surface', S.busy ? 's-accent s-thick' : 's-ink3', S.busy ? 'đang xử lý #' + S.busy : 'chờ request');
      txt(svg, 566, 146, `A:${inv['CD-A']} · B:${inv['CD-B']} · C:${inv['CD-C']}`, { cls: 'sm mono' });
      arrow(svg, 120, 47, qx, 47, 's-ink3');
      arrow(svg, qx + qw, 47, 500, 80, 's-ink3');
      arrow(svg, 500, 114, qx + qw, 151, 's-ink3');
      arrow(svg, qx, 151, 120, 140, 's-ink3');
      clear(svgHost).appendChild(svg);
      sQ.update(String(S.reqQ.length), 'accent', 'request được đệm, chờ Inventory');
      sOk.update(String(S.ok), 'ok', 'tiếp tục thu tiền');
      sRej.update(String(S.rej), S.rej ? 'warn' : 'ok', 'hết hàng → huỷ thanh toán');
      sOrph.update(String(S.orph), S.orph ? 'bad' : 'ok', S.orph ? 'đơn bị treo, không ai xử lý tiếp' : 'mọi phản hồi đều ghép được');
    }
    async function run(instant) {
      runBtn.disabled = true;
      const wait = (ms) => (instant ? Promise.resolve() : sleep(ms));
      S = fresh(); lg.reset();
      const pick = rng(11);
      const useDb = dbChk.input.checked;
      for (const o of ORDERS) {
        S.reqQ.push({ ...o }); S.mem[o.from].add(o.id); S.hl = o.from;
        if (!instant) { lg.add(`OP-${o.from + 1} gửi “giữ ${o.item}” cho đơn #${o.id} → request queue`, 't'); draw(); }
        await wait(150);
      }
      S.hl = -1;
      if (!instant) { lg.add('6 request nằm trong hàng đợi. Inventory lấy từng cái khi sẵn sàng, không bị dồn ngập.', 'acc'); draw(); }
      await wait(400);
      while (S.reqQ.length) {
        const m = S.reqQ.shift(); S.busy = m.id;
        if (!instant) draw();
        await wait(380);
        const ok = S.stock[m.item] > 0;
        if (ok) S.stock[m.item]--;
        m.res = ok ? 'ok' : 'rej';
        S.busy = null; S.repQ.push(m);
        if (!instant) { lg.add(`Inventory ${ok ? 'giữ ' + m.item + ' cho' : 'TỪ CHỐI (hết ' + m.item + ')'} đơn #${m.id} → reply queue`, ok ? 'ok' : 'warn'); draw(); }
        await wait(250);
        const r = S.repQ.shift();
        const inst = Math.floor(pick() * 3);
        S.hl = inst;
        const known = S.mem[inst].has(r.id);
        let line, tone;
        if (known || useDb) {
          if (r.res === 'ok') S.ok++; else S.rej++;
          line = `OP-${inst + 1} nhận phản hồi #${r.id}` + (known ? ' (chính nó đã gửi)' : ' — nạp trạng thái đơn từ database') + (r.res === 'ok' ? ' → thu tiền' : ' → huỷ thanh toán');
          tone = r.res === 'ok' ? 'ok' : 'warn';
        } else {
          S.orph++;
          line = `OP-${inst + 1} nhận phản hồi #${r.id} nhưng đơn do OP-${r.from + 1} gửi và trạng thái chỉ nằm trong bộ nhớ OP-${r.from + 1} → không biết xử lý tiếp`;
          tone = 'bad';
        }
        lg.add(line, tone);
        if (!instant) draw();
        await wait(200);
      }
      S.hl = -1; draw();
      lg.add(S.orph ? `${S.orph} đơn bị treo. Bật lưu trạng thái vào database rồi chạy lại.` : 'Mọi phản hồi đều được ghép với đơn gốc nhờ trạng thái lưu bền và mã đơn.', S.orph ? 'bad' : 'ok');
      runBtn.disabled = false;
    }
    run(true);
  });

  // =====================================================================
  // 3.10 — gọi song song vs tuần tự
  // =====================================================================
  widget('ch3-parallel-calls', (root) => {
    const names = ['Nhà cung cấp A', 'Nhà cung cấp B', 'Nhà cung cấp C'];
    const sls = names.map((n) => slider({ label: n, min: 200, max: 5000, step: 100, value: 1000, format: (v) => fmt(v / 1000, 1) + ' s', onInput: () => draw() }));
    const mode = seg({ label: 'Cách gọi', options: [{ value: 'seq', label: 'Tuần tự' }, { value: 'par', label: 'Song song' }], value: 'par', onChange: () => draw() });
    const runBtn = button('Hỏi giá', run);
    const sSeq = stat('Tuần tự (tổng)', '', 'bad');
    const sPar = stat('Song song (chậm nhất)', '', 'ok');
    const sSave = stat('Tiết kiệm', '', 'accent');
    const svgHost = h('div', { class: 'viz' });
    root.append(
      h('div', { class: 'controls' }, ...sls.map((x) => x.el)),
      h('div', { class: 'controls' }, h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Cách gọi'), mode.el), h('div', { class: 'btn-row' }, runBtn)),
      h('div', { class: 'stats' }, sSeq, sPar, sSave), svgHost
    );
    function draw(progress) {
      const lat = sls.map((x) => x.value);
      const sum = lat.reduce((a, b) => a + b, 0), mx = Math.max(...lat);
      const seq = mode.value === 'seq';
      sSeq.update(fmt(sum / 1000, 1) + ' s', seq ? 'bad' : '', 'chờ từng lời gọi xong');
      sPar.update(fmt(mx / 1000, 1) + ' s', !seq ? 'ok' : '', 'bằng lời gọi chậm nhất');
      sSave.update(fmt((sum - mx) / 1000, 1) + ' s', 'accent', pct(1 - mx / sum, 0) + ' thời gian chờ');
      const W = 640, H = 164, L = 120, R = 620, svg = svgBox(W, H);
      const tmax = Math.ceil(sum / 1000) * 1000;
      const x = (ms) => L + ms / tmax * (R - L);
      for (let t = 0; t <= tmax; t += 1000) { svg.appendChild(s('line', { x1: x(t), y1: 12, x2: x(t), y2: 128, class: 'grid' })); txt(svg, x(t), 144, (t / 1000) + ' s', { cls: 'sm' }); }
      txt(svg, (L + R) / 2, 160, 'Thời gian (giây)', { cls: 'sm' });
      let start = 0;
      lat.forEach((ms, i) => {
        const y = 18 + i * 36, st = seq ? start : 0;
        txt(svg, L - 8, y + 16, names[i], { anchor: 'end' });
        svg.appendChild(s('rect', { x: x(st), y, width: x(st + ms) - x(st), height: 24, rx: 3, class: 'f-surface2 s-ink3 s-thin' }));
        if (progress != null) {
          const done = clamp(progress - st, 0, ms);
          if (done > 0) svg.appendChild(s('rect', { x: x(st), y, width: x(st + done) - x(st), height: 24, rx: 3, class: seq ? 'f-warn' : 'f-accent' }));
        } else svg.appendChild(s('rect', { x: x(st), y, width: x(st + ms) - x(st), height: 24, rx: 3, class: seq ? 'f-warn' : 'f-accent' }));
        start += ms;
      });
      const end = seq ? sum : mx, other = seq ? mx : sum;
      svg.appendChild(s('line', { x1: x(end), y1: 8, x2: x(end), y2: 128, class: 'f-none s-ink s-thick' }));
      txt(svg, x(end) + (end > tmax * 0.8 ? -4 : 4), 10, 'quyết định được', { anchor: end > tmax * 0.8 ? 'end' : 'start', cls: 'sm' });
      svg.appendChild(s('line', { x1: x(other), y1: 12, x2: x(other), y2: 128, class: 'f-none s-ink3 dash' }));
      if (progress != null) svg.appendChild(s('line', { x1: x(progress), y1: 12, x2: x(progress), y2: 128, class: 'f-none s-mark s-thick' }));
      clear(svgHost).appendChild(svg);
    }
    async function run() {
      runBtn.disabled = true;
      const lat = sls.map((x) => x.value);
      const end = mode.value === 'seq' ? lat.reduce((a, b) => a + b, 0) : Math.max(...lat);
      for (let t = 0; t <= end; t += Math.max(50, end / 40)) { draw(t); await sleep(30); }
      draw();
      runBtn.disabled = false;
    }
    draw();
  });

  /* 11. ch3-event-inversion */
  widget('ch3-event-inversion', (root) => {
    const hasEmail = checkbox('Dịch vụ Email', true);
    const hasLoyalty = checkbox('Dịch vụ Tích điểm Loyalty', true);
    const hasAnalytics = checkbox('Dịch vụ Phân tích BigData', true);
    const hasWarehouse = checkbox('Dịch vụ Kho vận', true);
    const sendBtn = button('Phát sự kiện OrderPlaced', run, 'accent');
    const logBox = log(6);
    const sSubs = stat('Consumers đang lắng nghe', '4 dịch vụ', 'ok');
    const svgHost = h('div');

    root.appendChild(
      h('div', { class: 'widget' },
        h('div', { class: 'controls' },
          hasEmail.el, hasLoyalty.el, hasAnalytics.el, hasWarehouse.el,
          h('div', { class: 'btn-row' }, sendBtn)
        ),
        h('div', { class: 'stats' }, sSubs),
        svgHost,
        logBox
      )
    );

    function draw() {
      const active = [hasEmail.value && 'Email', hasLoyalty.value && 'Loyalty', hasAnalytics.value && 'Analytics', hasWarehouse.value && 'Kho vận'].filter(Boolean);
      sSubs.update(`${active.length} dịch vụ`, active.length > 0 ? 'ok' : 'warn');
      const W = 640, H = 160, svg = svgBox(W, H);
      box(svg, 20, 50, 140, 60, 'Order Service\n(Producer)', 'accent');
      box(svg, 230, 50, 160, 60, 'Event Broker\nTopic: order_events', 'warn');
      arrow(svg, 160, 80, 230, 80, 'f-accent s-accent');

      const consumers = [
        { name: 'Email Svc', on: hasEmail.value, y: 20 },
        { name: 'Loyalty Svc', on: hasLoyalty.value, y: 55 },
        { name: 'Analytics Svc', on: hasAnalytics.value, y: 90 },
        { name: 'Warehouse Svc', on: hasWarehouse.value, y: 125 }
      ];
      consumers.forEach((c) => {
        box(svg, 470, c.y, 140, 28, c.name, c.on ? 'ok' : 'surface2');
        if (c.on) arrow(svg, 390, 80, 470, c.y + 14, 'f-ok s-ok');
      });
      clear(svgHost).appendChild(svg);
    }

    [hasEmail, hasLoyalty, hasAnalytics, hasWarehouse].forEach(c => c.input.addEventListener('change', draw));

    async function run() {
      sendBtn.disabled = true;
      logBox.add('Order Service phát tán: "OrderPlaced(order_id=#9421)"', 'accent');
      await sleep(200);
      const active = [
        hasEmail.value && 'Email Service gửi thư xác nhận',
        hasLoyalty.value && 'Loyalty Service cộng 50 điểm',
        hasAnalytics.value && 'Analytics ghi nhận phễu chuyển đổi',
        hasWarehouse.value && 'Kho vận bắt đầu in phiếu xuất kho'
      ].filter(Boolean);
      for (const msg of active) {
        logBox.add(`→ [Đã nhận] ${msg}`, 'ok');
        await sleep(150);
      }
      sendBtn.disabled = false;
    }
    draw();
  });

  /* 12. ch3-broker-atom */
  widget('ch3-broker-atom', (root) => {
    const brokerMode = seg({
      label: 'Cơ chế lưu trữ',
      value: 'durable',
      options: [
        { label: 'Durable Disk (Bền vững)', value: 'durable' },
        { label: 'In-Memory (Rủi ro mất)', value: 'memory' }
      ]
    });
    const sendBtn = button('Gửi tin nhắn & Khởi động lại Broker', run, 'accent');
    const logBox = log(6);
    const sStatus = stat('Trạng thái bản tin', 'Chờ kiểm tra', '');
    const svgHost = h('div');

    root.appendChild(
      h('div', { class: 'widget' },
        h('div', { class: 'controls' }, brokerMode.el, h('div', { class: 'btn-row' }, sendBtn)),
        h('div', { class: 'stats' }, sStatus),
        svgHost,
        logBox
      )
    );

    function draw() {
      const isDur = brokerMode.value === 'durable';
      const W = 640, H = 140, svg = svgBox(W, H);
      box(svg, 30, 40, 130, 60, 'Producer\n(App)', 'accent');
      box(svg, 230, 30, 180, 80, isDur ? 'Broker (Disk WAL)\nTin nhắn lưu trên ổ' : 'Broker (RAM Only)\nTin nhắn chỉ nằm ở RAM', isDur ? 'ok' : 'warn');
      box(svg, 480, 40, 130, 60, 'Consumer\n(Worker)', 'accent');
      arrow(svg, 160, 70, 230, 70, 'f-accent s-accent');
      arrow(svg, 410, 70, 480, 70, 'f-accent s-accent');
      clear(svgHost).appendChild(svg);
    }
    brokerMode.onChange = draw;

    async function run() {
      sendBtn.disabled = true;
      const isDur = brokerMode.value === 'durable';
      logBox.add('Producer ghi bản tin #4829 vào Broker...', 'accent');
      await sleep(250);
      logBox.add('BẤT NGỜ: Server Broker bị sập nguồn & khởi động lại!', 'bad');
      await sleep(300);
      if (isDur) {
        sStatus.update('Bản tin phục hồi thành công', 'ok', 'Consumer nhận và ACK an toàn');
        logBox.add('✓ Đĩa ghi WAL đã khôi phục bản tin. Consumer đã nhận và gửi ACK.', 'ok');
      } else {
        sStatus.update('Bản tin BỊ MẤT!', 'bad', 'Do RAM bị giải phóng khi restart');
        logBox.add('✕ Thất thoát dữ liệu: Bản tin trong RAM đã biến mất hoàn toàn.', 'bad');
      }
      sendBtn.disabled = false;
    }
    draw();
  });

  /* 13. ch3-event-content */
  widget('ch3-event-content', (root) => {
    const payloadType = seg({
      label: 'Kiểu Payload',
      value: 'ecst',
      options: [
        { label: 'Event-Carried State (Đầy đủ)', value: 'ecst' },
        { label: 'Thin Notification (Tối giản ID)', value: 'thin' }
      ]
    });
    const sSize = stat('Kích thước Payload', '1.8 KB', 'warn');
    const sCalls = stat('Số cuộc gọi ngược bổ sung', '0 cuộc gọi', 'ok');
    const jsonHost = h('pre', { class: 'code-view', style: { padding: '12px', borderRadius: '8px', background: '#090D16', color: '#E2E8F0', fontSize: '11px', fontFamily: 'monospace' } });

    root.appendChild(
      h('div', { class: 'widget' },
        h('div', { class: 'controls' }, payloadType.el),
        h('div', { class: 'stats' }, sSize, sCalls),
        jsonHost
      )
    );

    function update() {
      const isEcst = payloadType.value === 'ecst';
      if (isEcst) {
        sSize.update('1.8 KB (Lớn hơn)', 'warn', 'Chứa toàn bộ thông tin đơn hàng');
        sCalls.update('0 cuộc gọi ngược', 'ok', 'Consumer tự xử lý không cần gọi lại');
        jsonHost.textContent = JSON.stringify({
          eventType: 'OrderPlaced',
          orderId: 'ord_9841',
          timestamp: '2026-10-27T14:20:00Z',
          customer: { id: 'cust_112', name: 'Nguyễn Văn A', email: 'a@example.com' },
          items: [{ sku: 'VINYL-01', title: 'Abbey Road', qty: 1, price: 350000 }],
          shippingAddress: '123 Đường Lê Lợi, Q1, TP.HCM',
          totalAmount: 350000
        }, null, 2);
      } else {
        sSize.update('120 Bytes (Siêu nhẹ)', 'ok', 'Chỉ chứa ID và loại sự kiện');
        sCalls.update('1-3 cuộc gọi ngược', 'warn', 'Mỗi consumer phải gọi HTTP GET /orders/9841');
        jsonHost.textContent = JSON.stringify({
          eventType: 'OrderPlaced',
          orderId: 'ord_9841',
          resourceUri: 'https://api.musiccorp.vn/orders/ord_9841',
          timestamp: '2026-10-27T14:20:00Z'
        }, null, 2);
      }
    }
    payloadType.onChange = update;
    update();
  });

  /* 14. ch3-poison-message */
  widget('ch3-poison-message', (root) => {
    const slRetries = slider({ label: 'Số lần thử lại tối đa (Max Retries)', min: 1, max: 5, value: 3 });
    const sendBtn = button('Bơm bản tin lỗi (Malformed Message)', run, 'accent');
    const logBox = log(6);
    const sState = stat('Trạng thái bản tin', 'Sẵn sàng', '');
    const svgHost = h('div');

    root.appendChild(
      h('div', { class: 'widget' },
        h('div', { class: 'controls' }, slRetries.el, h('div', { class: 'btn-row' }, sendBtn)),
        h('div', { class: 'stats' }, sState),
        svgHost,
        logBox
      )
    );

    function draw(activeBox) {
      const W = 640, H = 140, svg = svgBox(W, H);
      box(svg, 20, 40, 140, 60, 'Main Queue\n(Incoming)', activeBox === 'main' ? 'accent' : 'surface2');
      box(svg, 230, 40, 160, 60, 'Consumer Worker\n(JSON Parse Error)', activeBox === 'worker' ? 'bad' : 'surface2');
      box(svg, 460, 40, 150, 60, 'Dead-Letter Queue\n(DLQ Phân tích)', activeBox === 'dlq' ? 'warn' : 'surface2');
      arrow(svg, 160, 70, 230, 70, 'f-accent s-accent');
      arrow(svg, 390, 70, 460, 70, 'f-warn s-warn');
      clear(svgHost).appendChild(svg);
    }

    async function run() {
      sendBtn.disabled = true;
      const max = slRetries.value;
      logBox.add('Phát bản tin độc: { invalid_json_syntax: true, corrupted }', 'warn');
      draw('main');
      await sleep(250);

      for (let i = 1; i <= max; i++) {
        draw('worker');
        sState.update(`Thử xử lý lần ${i}/${max}`, 'warn', 'Xảy ra ngoại lệ SyntaxError');
        logBox.add(`Thất bại lần ${i}: Consumer crash do không parse được JSON. Requeue...`, 'bad');
        await sleep(350);
      }

      draw('dlq');
      sState.update('Đã cách ly vào Dead-Letter Queue (DLQ)', 'ok', 'Hàng đợi chính không bị tắc');
      logBox.add(`✓ Đạt ngưỡng ${max} lần thử: Chuyển sang DLQ để kỹ sư kiểm tra độc lập.`, 'ok');
      sendBtn.disabled = false;
    }
    draw();
  });

  /* Glossary */
  glossary.add([
    { key: 'ipc', term: 'IPC (Inter-Process Communication)', vi: 'Giao tiếp liên tiến trình', def: 'Cơ chế truyền thông điệp giữa các tiến trình chạy trên các máy khác nhau qua mạng.' },
    { key: 'sync', term: 'Synchronous Blocking', vi: 'Đồng bộ chặn', def: 'Tiến trình gọi phải treo luồng chờ phản hồi từ máy đích trước khi tiếp tục thực thi.' },
    { key: 'async', term: 'Asynchronous', vi: 'Bất đồng bộ', def: 'Bên gửi phát thông điệp và tiếp tục công việc ngay mà không cần đợi phản hồi hoàn thành.' },
    { key: 'event-driven', term: 'Event-Driven Architecture', vi: 'Kiến trúc hướng sự kiện', def: 'Mô hình trong đó các dịch vụ phản ứng lại sự thay đổi trạng thái phát ra từ các dịch vụ khác.' },
    { key: 'ecst', term: 'Event-Carried State Transfer', vi: 'Truyền trạng thái qua sự kiện', def: 'Đóng gói toàn bộ dữ liệu cần thiết vào sự kiện để bên nhận không cần gọi ngược lại.' },
    { key: 'dlq', term: 'Dead-Letter Queue (DLQ)', vi: 'Hàng đợi thư chết', def: 'Nơi lưu trữ các bản tin không thể xử lý sau nhiều lần thử lại để tránh gây nghẽn hàng đợi chính.' }
  ]);
})();

