/* Chương 6 — Replication (nguồn: ấn bản 1, chương 5) */
(function () {
  'use strict';
  const { h, s, clear, fmt, fmtBig, fmtMs, pct, rng, clamp, sleep,
          slider, seg, button, checkbox, stat, log, widget, glossary } = window.DDIA;

  const ctl = (label, el) => h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, label), el);
  const pill = (text, tone) => h('span', { class: 'pill' + (tone ? ' ' + tone : '') }, text);

  // =====================================================================
  // 6.1 Scaling architectures & Replication vs Partitioning
  widget('ch6-arch', (root) => {
    let load = 4, layout = 'both';
    const dead = new Set([1]);
    const slLoad = slider({ label: 'Mức tải hệ thống (×1 = 1 máy chuẩn)', min: 1, max: 10, step: 1, value: load, format: (v) => '×' + v, onInput: (v) => { load = v; render(); } });
    const sgLay = seg({
      label: 'Cách bố trí dữ liệu trên 4 node',
      options: [
        { value: 'repl', label: 'Chỉ sao chép (Replication)' },
        { value: 'part', label: 'Chỉ phân vùng (Partitioning)' },
        { value: 'both', label: 'Cả hai (như Hình II-1)' },
      ],
      value: layout,
      onChange: (v) => { layout = v; render(); },
    });
    const vizCost = h('div', { class: 'viz' });
    const statsCost = h('div', { class: 'stats' });
    const nodesGrid = h('div', { class: 'nodes' });
    const statsCluster = h('div', { class: 'stats' });

    root.append(
      h('div', { class: 'controls' }, slLoad.el, ctl('Bố trí dữ liệu (bấm vào node để tắt/bật)', sgLay.el)),
      vizCost,
      statsCost,
      nodesGrid,
      statsCluster
    );

    function render() {
      // Cost curve SVG
      const W = 600, H = 190, L = 54, R = 20, T = 18, B = 34;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Chi phí mở rộng theo tải' });
      const x = (v) => L + ((v - 1) / 9) * (W - L - R);
      const y = (c) => H - B - clamp(c / 40, 0, 1) * (H - T - B);

      for (let i = 1; i <= 10; i++) {
        svg.append(
          s('line', { x1: x(i), x2: x(i), y1: T, y2: H - B, class: 'grid' }),
          s('text', { x: x(i), y: H - B + 15, 'text-anchor': 'middle' }, '×' + i)
        );
      }
      [0, 10, 20, 30, 40].forEach((c) => {
        svg.append(
          s('line', { x1: L, x2: W - R, y1: y(c), y2: y(c), class: 'grid' }),
          s('text', { x: L - 6, y: y(c) + 4, 'text-anchor': 'end' }, c + ' đv')
        );
      });
      svg.append(
        s('line', { x1: L, x2: W - R, y1: H - B, y2: H - B, class: 'axis' }),
        s('line', { x1: L, x2: L, y1: T, y2: H - B, class: 'axis' })
      );

      const smCost = (v) => Math.pow(v, 1.65);
      const sdCost = (v) => v * 1.35 + Math.pow(v, 1.35) * 0.4;
      const snCost = (v) => v * 1.1;
      const poly = (fn) => Array.from({ length: 10 }, (_, i) => `${i ? 'L' : 'M'}${x(i + 1).toFixed(1)} ${y(fn(i + 1)).toFixed(1)}`).join(' ');

      svg.append(
        s('path', { d: poly(smCost), class: 'f-none s-bad', 'stroke-width': 2.2 }),
        s('path', { d: poly(sdCost), class: 'f-none s-warn dash', 'stroke-width': 2 }),
        s('path', { d: poly(snCost), class: 'f-none s-accent', 'stroke-width': 2.5 }),
        s('line', { x1: x(load), x2: x(load), y1: T, y2: H - B, class: 'f-none s-ink3 dash' }),
        s('circle', { cx: x(load), cy: y(smCost(load)), r: 4.5, class: 'f-bad' }),
        s('circle', { cx: x(load), cy: y(sdCost(load)), r: 4.5, class: 'f-warn' }),
        s('circle', { cx: x(load), cy: y(snCost(load)), r: 5, class: 'f-accent' }),
        s('text', { x: L + 10, y: T + 12, class: 'lbl-strong' }, 'Đỏ: Shared-memory · Vàng: Shared-disk · Xanh: Shared-nothing (số liệu minh hoạ)')
      );
      clear(vizCost).append(svg);

      clear(statsCost).append(
        stat('Shared-memory (Scale up)', fmt(smCost(load), 1) + ' đv', load > 5 ? 'bad' : 'warn', 'Chi phí tăng nhanh hơn tuyến tính, 1 địa điểm'),
        stat('Shared-disk', fmt(sdCost(load), 1) + ' đv', 'warn', 'Tranh chấp khoá giới hạn mở rộng ghi'),
        stat('Shared-nothing (Scale out)', fmt(snCost(load), 1) + ' đv', 'ok', load + ' node độc lập nối qua mạng')
      );

      // Node cards
      clear(nodesGrid);
      const nodeData = [0, 1, 2, 3].map((i) => {
        if (layout === 'repl') return [{ label: 'Toàn bộ DB (bản sao)', cls: i === 0 ? 'acc' : 'ok', part: 'ALL' }];
        if (layout === 'part') return [{ label: `Partition P${i + 1} (duy nhất)`, cls: 'mark', part: `P${i + 1}` }];
        return [
          { label: `P${i + 1} (Leader)`, cls: 'acc', part: `P${i + 1}` },
          { label: `P${((i + 3) % 4) + 1} (Follower)`, cls: 'ok', part: `P${((i + 3) % 4) + 1}` },
        ];
      });

      nodeData.forEach((items, i) => {
        const isDown = dead.has(i);
        const card = h('div', {
          class: 'node-card' + (isDown ? ' down' : i === 0 && layout === 'repl' ? ' lead' : ''),
          style: { cursor: 'pointer' },
          onClick: () => { isDown ? dead.delete(i) : dead.add(i); render(); },
        },
          h('h5', `Node ${i + 1}`, pill(isDown ? 'Đang sập' : 'Sống', isDown ? 'bad' : 'ok')),
          h('div', { class: 'chips' }, items.map((it) => h('span', { class: 'chip ' + (isDown ? 'bad' : it.cls) }, it.label))),
          h('div', { class: 'meta' }, isDown ? 'Bấm để khởi động lại' : 'Bấm để làm sập node này')
        );
        nodesGrid.append(card);
      });

      const aliveIdx = [0, 1, 2, 3].filter((i) => !dead.has(i));
      let availPct = 0, capText = '';
      if (layout === 'repl') {
        availPct = aliveIdx.length > 0 ? 100 : 0;
        capText = 'Tối đa 1 máy (mỗi node phải giữ trọn DB)';
      } else if (layout === 'part') {
        availPct = (aliveIdx.length / 4) * 100;
        capText = 'Gấp 4 lần 1 máy (chia 4 partition)';
      } else {
        let okParts = 0;
        for (let p = 1; p <= 4; p++) {
          const has = aliveIdx.some((idx) => nodeData[idx].some((it) => it.part === `P${p}`));
          if (has) okParts++;
        }
        availPct = (okParts / 4) * 100;
        capText = 'Gấp 2 lần 1 máy (4 partition × 2 bản sao)';
      }

      clear(statsCluster).append(
        stat('Node đang hoạt động', `${aliveIdx.length}/4 node`, aliveIdx.length === 4 ? 'ok' : aliveIdx.length >= 2 ? 'warn' : 'bad'),
        stat('Dữ liệu truy cập được', fmt(availPct, 0) + '%', availPct === 100 ? 'ok' : 'bad', availPct < 100 ? 'Có phân vùng mất toàn bộ bản sao!' : 'Đủ 100% dữ liệu'),
        stat('Dung lượng chứa tối đa', capText, 'accent')
      );
    }
    render();
  });

  // =====================================================================
  // 6.2 Leaders, followers & sync vs async replication
  widget('ch6-sync', (root) => {
    let mode = 'semi', f1Lat = 35, f2Lat = 180, f1Down = false, leaderCrashAfterOk = false, ver = 1;
    const sgMode = seg({
      label: 'Chế độ sao chép',
      options: [
        { value: 'sync', label: 'Đồng bộ cả 2' },
        { value: 'semi', label: 'Bán đồng bộ (Hình 5-2)' },
        { value: 'async', label: 'Bất đồng bộ hoàn toàn' },
      ],
      value: mode,
      onChange: (v) => { mode = v; render(); },
    });
    const slF1 = slider({ label: 'Độ trễ Follower 1', min: 10, max: 300, step: 5, value: f1Lat, format: (v) => v + ' ms', onInput: (v) => { f1Lat = v; render(); } });
    const slF2 = slider({ label: 'Độ trễ Follower 2', min: 20, max: 500, step: 10, value: f2Lat, format: (v) => v + ' ms', onInput: (v) => { f2Lat = v; render(); } });
    const cbF1Down = checkbox('Làm Follower 1 sập / treo', f1Down, (v) => { f1Down = v; render(); });
    const cbCrash = checkbox('Leader chết ngay sau khi báo OK cho client', leaderCrashAfterOk, (v) => { leaderCrashAfterOk = v; render(); });
    const btnSend = button('Gửi write mới (avatar_v' + (ver + 1) + '.jpg)', () => { ver++; render(); });

    const viz = h('div', { class: 'viz' });
    const stats = h('div', { class: 'stats' });
    const note = h('div', { class: 'step-note' });

    root.append(
      h('div', { class: 'controls' }, ctl('Chế độ', sgMode.el), slF1.el, slF2.el),
      h('div', { class: 'btn-row' }, cbF1Down.el, cbCrash.el, btnSend),
      viz, stats, note
    );

    function render() {
      btnSend.textContent = `Gửi write mới (avatar_v${ver + 1}.jpg)`;
      const f1Sync = mode === 'sync' || (mode === 'semi' && !f1Down);
      const f2Sync = mode === 'sync' || (mode === 'semi' && f1Down); // promoted in semi-sync!
      const blocked = mode === 'sync' && f1Down;

      let clientWaitMs = 15; // local write
      if (blocked) clientWaitMs = Infinity;
      else if (mode === 'sync') clientWaitMs = 15 + Math.max(f1Lat, f2Lat);
      else if (mode === 'semi') clientWaitMs = 15 + (f1Down ? f2Lat : f1Lat);

      const leaderHas = true;
      const f1Has = !f1Down && (!leaderCrashAfterOk || f1Sync || f1Lat <= clientWaitMs - 15);
      const f2Has = !leaderCrashAfterOk || f2Sync || f2Lat <= clientWaitMs - 15;
      const survivingCopies = (leaderCrashAfterOk ? 0 : 1) + (f1Has ? 1 : 0) + (f2Has ? 1 : 0);

      // Sequence diagram SVG
      const W = 620, H = 210;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'seqw', role: 'img', 'aria-label': 'Biểu đồ tuần tự sao chép' });
      const rows = [
        { y: 35, name: 'Client (User)', cls: 'f-ink' },
        { y: 80, name: leaderCrashAfterOk ? 'Leader (CHẾT sau OK)' : 'Leader', cls: leaderCrashAfterOk ? 'f-bad' : 'f-accent' },
        { y: 130, name: `Follower 1 (${mode === 'async' ? 'async' : 'sync'})`, cls: f1Down ? 'f-bad' : 'f-ok' },
        { y: 180, name: `Follower 2 (${f2Sync ? 'nâng lên sync' : 'async'})`, cls: f2Sync ? 'f-ok' : 'f-violet' },
      ];
      rows.forEach((r) => {
        svg.append(
          s('text', { x: 8, y: r.y + 4, class: 'lbl-strong' }, r.name),
          s('line', { x1: 155, x2: W - 20, y1: r.y, y2: r.y, class: 'grid' })
        );
      });

      const tx = (ms) => 165 + clamp(ms / 520, 0, 1) * (W - 205);
      // Client -> Leader
      svg.append(
        s('line', { x1: tx(0), x2: tx(15), y1: 35, y2: 80, class: 'f-none s-accent', 'stroke-width': 2 }),
        s('circle', { cx: tx(15), cy: 80, r: 4, class: 'f-accent' })
      );

      // Leader -> F1
      if (!f1Down) {
        svg.append(
          s('line', { x1: tx(15), x2: tx(15 + f1Lat * 0.6), y1: 80, y2: 130, class: f1Has ? 'f-none s-ok' : 'f-none s-bad dash', 'stroke-width': 2 }),
          s('circle', { cx: tx(15 + f1Lat * 0.6), cy: 130, r: 4, class: f1Has ? 'f-ok' : 'f-bad' })
        );
        if (f1Has) {
          svg.append(s('line', { x1: tx(15 + f1Lat * 0.6), x2: tx(15 + f1Lat), y1: 130, y2: 80, class: 'f-none s-ok dash', 'stroke-width': 1.6 }));
        }
      } else {
        svg.append(s('text', { x: tx(80), y: 125, class: 'f-bad lbl-strong' }, '✗ Follower 1 không phản hồi (timeout)'));
      }

      // Leader -> F2
      svg.append(
        s('line', { x1: tx(15), x2: tx(15 + f2Lat * 0.6), y1: 80, y2: 180, class: f2Has ? 'f-none s-violet' : 'f-none s-bad dash', 'stroke-width': 2 }),
        s('circle', { cx: tx(15 + f2Lat * 0.6), cy: 180, r: 4, class: f2Has ? 'f-violet' : 'f-bad' })
      );
      if (f2Has) {
        svg.append(s('line', { x1: tx(15 + f2Lat * 0.6), x2: tx(15 + f2Lat), y1: 180, y2: 80, class: 'f-none s-violet dash', 'stroke-width': 1.6 }));
      }

      // Leader -> Client OK
      if (!blocked) {
        svg.append(
          s('line', { x1: tx(clientWaitMs - 5), x2: tx(clientWaitMs), y1: 80, y2: 35, class: 'f-none s-accent', 'stroke-width': 2.2 }),
          s('circle', { cx: tx(clientWaitMs), cy: 35, r: 4.5, class: 'f-ok' }),
          s('text', { x: tx(clientWaitMs) + 6, y: 32, class: 'lbl-strong' }, `OK (${fmtMs(clientWaitMs)})`)
        );
        if (leaderCrashAfterOk) {
          svg.append(s('text', { x: tx(clientWaitMs) + 6, y: 76, class: 'f-bad lbl-strong' }, '⚡ Leader sập!'));
        }
      } else {
        svg.append(s('text', { x: tx(160), y: 28, class: 'f-bad lbl-strong' }, '⏳ GHI BỊ CHẶN (chờ Follower 1 đồng bộ)'));
      }

      clear(viz).append(svg);

      clear(stats).append(
        stat('Thời gian phản hồi ghi', blocked ? 'Bị chặn (∞)' : fmtMs(clientWaitMs), blocked ? 'bad' : clientWaitMs > 150 ? 'warn' : 'ok'),
        stat('Bản ghi mới (v' + ver + ') còn sống', blocked ? 'Chưa xong' : `${survivingCopies} node`, survivingCopies === 0 ? 'bad' : survivingCopies >= 2 ? 'ok' : 'warn'),
        stat('Trạng thái dữ liệu', blocked ? 'Hệ thống ngừng nhận ghi' : survivingCopies === 0 ? 'MẤT DỮ LIỆU ĐÃ COMMIT!' : 'An toàn', blocked || survivingCopies === 0 ? 'bad' : 'ok')
      );

      note.innerHTML = blocked
        ? '<b>Đồng bộ toàn phần bị treo:</b> Chỉ cần 1 follower đồng bộ sập là cả hệ thống không ghi được. Đó là lý do thực tế không đồng bộ tất cả follower.'
        : survivingCopies === 0
          ? '<b>Mất dữ liệu dù đã báo OK:</b> Ở chế độ bất đồng bộ, leader báo OK trước khi follower kịp nhận. Khi leader chết ngay sau đó, bản ghi <code>avatar_v' + ver + '.jpg</code> biến mất hoàn toàn.'
          : mode === 'semi' && f1Down
            ? '<b>Bán đồng bộ (Semi-synchronous):</b> Khi Follower 1 sập, Leader tự động nâng Follower 2 lên làm đồng bộ để luôn giữ ít nhất 2 bản sao cập nhật.'
            : '<b>Bình thường:</b> Bản ghi được lưu trên Leader và sao chép sang các Follower theo replication log.';
    }
    render();
  });

  // =====================================================================
  // 6.3 Setting up new followers
  widget('ch6-newfollower', (root) => {
    let method = 'snap', step = 3;
    const sgMethod = seg({
      label: 'Cách dựng follower mới',
      options: [
        { value: 'raw', label: '1. Copy file dữ liệu sống (sai)' },
        { value: 'lock', label: '2. Khoá toàn DB rồi copy' },
        { value: 'snap', label: '3. Snapshot + LSN catch-up (chuẩn)' },
      ],
      value: method,
      onChange: (v) => { method = v; step = 3; render(); },
    });
    const btnPrev = button('← Bước trước', () => { step = Math.max(0, step - 1); render(); }, 'ghost');
    const btnNext = button('Bước tiếp →', () => { step = Math.min(3, step + 1); render(); });
    const split = h('div', { class: 'lab-split' });
    const stats = h('div', { class: 'stats' });
    const note = h('div', { class: 'step-note' });

    root.append(
      h('div', { class: 'controls' }, ctl('Phương pháp', sgMethod.el), h('div', { class: 'btn-row' }, btnPrev, btnNext)),
      split, stats, note
    );

    const STEPS = {
      raw: [
        { lsnL: 100, lsnF: '—', aL: 500, bL: 500, aF: '—', bF: '—', writeOk: true, msg: 'Bước 1/4: Bắt đầu copy từng file bảng từ Leader sang Follower mới mà không chụp snapshot.' },
        { lsnL: 101, lsnF: '?', aL: 400, bL: 600, aF: 500, bF: '—', writeOk: true, msg: 'Bước 2/4: Đã copy xong Tài khoản A ($500). Đúng lúc đó Client chuyển $100 từ A sang B trên Leader (A=$400, B=$600).' },
        { lsnL: 102, lsnF: '?', aL: 400, bL: 600, aF: 500, bF: 600, writeOk: true, msg: 'Bước 3/4: Copy tiếp Tài khoản B ở thời điểm sau giao dịch ($600). Bản copy bị trộn hai thời điểm khác nhau!' },
        { lsnL: 102, lsnF: 'lệch', aL: 400, bL: 600, aF: 500, bF: 600, writeOk: true, msg: 'Bước 4/4: Follower có A=$500, B=$600 (tổng $1.100 — tiền tự sinh ra!) và không biết nối tiếp từ LSN nào.' },
      ],
      lock: [
        { lsnL: 100, lsnF: '—', aL: 500, bL: 500, aF: '—', bF: '—', writeOk: false, msg: 'Bước 1/4: Khoá ghi toàn bộ Leader tại LSN 100. Mọi lệnh ghi của client bị chặn.' },
        { lsnL: 100, lsnF: '—', aL: 500, bL: 500, aF: 500, bF: 500, writeOk: false, msg: 'Bước 2/4: Copy file sang Follower trong khi Leader vẫn bị khoá (downtime kéo dài nhiều phút/giờ).' },
        { lsnL: 101, lsnF: 100, aL: 400, bL: 600, aF: 500, bF: 500, writeOk: true, msg: 'Bước 3/4: Mở khoá Leader; giao dịch chuyển $100 tại LSN 101 được xử lý.' },
        { lsnL: 101, lsnF: 101, aL: 400, bL: 600, aF: 400, bF: 600, writeOk: true, msg: 'Bước 4/4: Follower xin log từ LSN 100 → 101 và bắt kịp. Nhất quán nhưng vi phạm mục tiêu sẵn sàng cao.' },
      ],
      snap: [
        { lsnL: 100, lsnF: 'snap@100', aL: 500, bL: 500, aF: '—', bF: '—', writeOk: true, msg: 'Bước 1/4: Chụp snapshot nhất quán của Leader tại LSN = 100 (nhờ MVCC, không cần khoá ghi).' },
        { lsnL: 102, lsnF: 'snap@100', aL: 350, bL: 650, aF: 500, bF: 500, writeOk: true, msg: 'Bước 2/4: Đang copy snapshot (LSN 100) qua mạng. Trong lúc đó Leader vẫn nhận ghi mới tới LSN 102.' },
        { lsnL: 102, lsnF: 100, aL: 350, bL: 650, aF: 500, bF: 500, writeOk: true, msg: 'Bước 3/4: Follower nạp xong snapshot, kết nối vào Leader và xin mọi thay đổi trong log từ sau LSN 100.' },
        { lsnL: 102, lsnF: 102, aL: 350, bL: 650, aF: 350, bF: 650, writeOk: true, msg: 'Bước 4/4: Follower áp dụng LSN 101, 102 → đã bắt kịp (caught up), tổng tiền luôn đúng $1.000 và không dừng hệ thống!' },
      ],
    };

    function render() {
      const cur = STEPS[method][step];
      btnPrev.disabled = step === 0;
      btnNext.disabled = step === 3;

      const sumF = typeof cur.aF === 'number' && typeof cur.bF === 'number' ? cur.aF + cur.bF : null;
      const diff = sumF != null && sumF !== 1000;

      const makeTbl = (title, lsn, a, b, isF) => h('div', { class: 'box' },
        h('h5', `${title} · LSN: ${lsn}`),
        h('table', { class: 'mini' },
          h('thead', h('tr', h('th', 'Tài khoản'), h('th', { class: 'num' }, 'Số dư'))),
          h('tbody',
            h('tr', h('td', 'Acc A'), h('td', { class: 'num' + (isF && diff ? ' diff' : '') }, typeof a === 'number' ? '$' + a : a)),
            h('tr', h('td', 'Acc B'), h('td', { class: 'num' + (isF && diff ? ' diff' : '') }, typeof b === 'number' ? '$' + b : b))
          )
        )
      );

      clear(split).append(
        makeTbl('Leader (đang chạy)', cur.lsnL, cur.aL, cur.bL, false),
        makeTbl('Follower mới', cur.lsnF, cur.aF, cur.bF, true)
      );

      clear(stats).append(
        stat('Bước hiện tại', `${step + 1} / 4`, 'accent'),
        stat('Ghi trên Leader', cur.writeOk ? 'Hoạt động bình thường' : 'BỊ KHOÁ (Downtime)', cur.writeOk ? 'ok' : 'bad'),
        stat('Tổng tiền trên Follower', sumF == null ? 'Đang chép…' : '$' + fmt(sumF), sumF == null ? 'warn' : sumF === 1000 ? 'ok' : 'bad', sumF === 1000 ? 'Nhất quán ($1.000)' : sumF != null ? 'Lệch dữ liệu!' : '')
      );
      note.innerHTML = `<b>${cur.msg}</b>`;
    }
    render();
  });

  // =====================================================================
  // 6.4 Node outages, failover, discarded writes & split-brain (GitHub bug)
  widget('ch6-failover', (root) => {
    let st, lg = log();
    const nodesEl = h('div', { class: 'nodes' });
    const redisBox = h('div', { class: 'box' });
    const statsEl = h('div', { class: 'stats' });

    function reset() {
      st = {
        phase: 0,
        fencing: true,
        n1: { role: 'leader', alive: true, rows: [{ id: 1, u: 'Alice' }, { id: 2, u: 'Bob' }, { id: 3, u: 'Carol (chưa kịp replicate)' }] },
        n2: { role: 'follower', alive: true, rows: [{ id: 1, u: 'Alice' }, { id: 2, u: 'Bob' }] },
        n3: { role: 'follower', alive: true, rows: [{ id: 1, u: 'Alice' }, { id: 2, u: 'Bob' }] },
        redis: { 1: 'Alice', 2: 'Bob', 3: 'Carol (dữ liệu riêng tư)' },
      };
      lg.reset();
      lg.add('Khởi tạo: N1 là Leader. Bản ghi #3 (Carol) vừa commit trên N1 và lưu vào Redis, nhưng chưa kịp sao chép bất đồng bộ sang N2, N3.', 't');
      render();
    }

    const btnKillN1 = button('1. Giết Leader N1 & bầu N2 lên thay', () => {
      st.phase = 1;
      st.n1.alive = false;
      st.n2.role = 'leader';
      lg.add('N1 mất kết nối quá timeout! Cụm bầu N2 (LSN = 2) làm Leader mới.', 'warn');
      render();
    });
    const btnWriteN2 = button('2. Ghi bản ghi mới của Dave vào N2', () => {
      st.phase = 2;
      st.n2.rows.push({ id: 3, u: 'Dave' });
      st.n3.rows.push({ id: 3, u: 'Dave' });
      lg.add('Sự cố GitHub: N2 dùng lại khoá tự tăng id = 3 cho Dave! Trong khi Redis vẫn giữ id = 3 của Carol → Dave đọc được dữ liệu riêng tư của Carol!', 'bad');
      render();
    });
    const btnReviveN1 = button('3. N1 sống lại', () => {
      st.phase = 3;
      st.n1.alive = true;
      if (st.fencing) {
        st.n1.role = 'follower';
        st.n1.rows = [{ id: 1, u: 'Alice' }, { id: 2, u: 'Bob' }, { id: 3, u: 'Dave' }];
        lg.add('N1 quay lại làm Follower: bản ghi #3 cũ của Carol trên N1 bị huỷ bỏ (discarded write) dù từng báo OK.', 'warn');
      } else {
        st.n1.role = 'leader';
        st.n1.rows.push({ id: 4, u: 'Eve (ghi vào N1)' });
        lg.add('SPLIT BRAIN! Cả N1 và N2 đều tưởng mình là Leader và cùng nhận ghi độc lập, dữ liệu phân nhánh!', 'bad');
      }
      render();
    });
    const cbFence = checkbox('Bật cơ chế hạ cấp / fencing khi N1 quay lại (tránh Split Brain)', true, (v) => { st.fencing = v; if (st.phase === 3) btnReviveN1.click(); });
    const btnReset = button('Đặt lại kịch bản', reset, 'ghost');

    root.append(
      h('div', { class: 'btn-row' }, btnKillN1, btnWriteN2, btnReviveN1, btnReset),
      h('div', { class: 'btn-row' }, cbFence.el),
      nodesEl, redisBox, statsEl, lg
    );

    function render() {
      btnKillN1.disabled = st.phase !== 0;
      btnWriteN2.disabled = st.phase !== 1;
      btnReviveN1.disabled = st.phase !== 2;

      clear(nodesEl);
      [['Node N1', st.n1], ['Node N2', st.n2], ['Node N3', st.n3]].forEach(([name, nd]) => {
        const isSplit = st.phase === 3 && !st.fencing && nd.role === 'leader';
        const card = h('div', { class: 'node-card' + (!nd.alive ? ' down' : isSplit ? ' danger' : nd.role === 'leader' ? ' lead' : '') },
          h('h5', name, pill(!nd.alive ? 'Đã sập' : nd.role === 'leader' ? 'LEADER' : 'Follower', !nd.alive ? 'bad' : isSplit ? 'bad' : nd.role === 'leader' ? 'accent' : 'ok')),
          h('div', { class: 'chips' }, nd.rows.map((r) => h('span', { class: 'chip ' + (r.u.includes('Carol') ? 'mark' : r.u === 'Dave' ? 'violet' : 'ok') }, `#${r.id}: ${r.u}`))),
          h('div', { class: 'meta' }, `Auto-increment kế tiếp: ${nd.rows.length + 1}`)
        );
        nodesEl.append(card);
      });

      const leak = st.phase >= 2;
      clear(redisBox).append(
        h('h5', 'Cache ngoài (Redis) · ánh xạ primary key → dữ liệu phiên'),
        h('div', { class: 'chips' },
          h('span', { class: 'chip' }, 'id:1 → Alice'),
          h('span', { class: 'chip' }, 'id:2 → Bob'),
          h('span', { class: 'chip ' + (leak ? 'bad' : 'mark') }, leak ? 'id:3 → Redis giữ Carol, nhưng MySQL gán cho Dave (RÒ RỈ DỮ LIỆU!)' : 'id:3 → Carol')
        )
      );

      const leadersCount = [st.n1, st.n2, st.n3].filter((x) => x.alive && x.role === 'leader').length;
      clear(statsEl).append(
        stat('Số Leader đang chạy', String(leadersCount), leadersCount === 1 ? 'ok' : 'bad', leadersCount > 1 ? 'SPLIT BRAIN!' : 'Bình thường'),
        stat('Bản ghi #3 của Carol', st.phase === 0 ? 'Chưa sao chép' : 'BỊ MẤT (Discarded)', st.phase === 0 ? 'warn' : 'bad'),
        stat('Khớp MySQL ↔ Redis', leak ? 'Lệch khoá id=3' : 'Khớp', leak ? 'bad' : 'ok')
      );
    }
    reset();
  });

  // =====================================================================
  // 6.5 Choosing the failover timeout
  widget('ch6-timeout', (root) => {
    let timeoutSec = 30, spikeScale = 1.0;
    const slTo = slider({ label: 'Ngưỡng Timeout phát hiện lỗi', min: 10, max: 90, step: 5, value: timeoutSec, format: (v) => v + ' giây', onInput: (v) => { timeoutSec = v; render(); } });
    const slSp = slider({ label: 'Cường độ các đợt tải tăng vọt', min: 0.5, max: 2.0, step: 0.1, value: spikeScale, format: (v) => '×' + fmt(v, 1), onInput: (v) => { spikeScale = v; render(); } });
    const viz = h('div', { class: 'viz' });
    const stats = h('div', { class: 'stats' });

    root.append(h('div', { class: 'controls' }, slTo.el, slSp.el), viz, stats);

    // 24 hours, sample every 0.5h = 49 points
    const baseSpikes = { 6: 22, 11: 38, 15: 28, 21: 48 };
    function render() {
      const W = 620, H = 200, L = 46, R = 18, T = 18, B = 32;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Biểu đồ heartbeat và ngưỡng timeout trong 24 giờ' });
      const x = (hr) => L + (hr / 24) * (W - L - R);
      const y = (sec) => H - B - clamp(sec / 100, 0, 1) * (H - T - B);

      for (let hr = 0; hr <= 24; hr += 4) {
        svg.append(
          s('line', { x1: x(hr), x2: x(hr), y1: T, y2: H - B, class: 'grid' }),
          s('text', { x: x(hr), y: H - B + 15, 'text-anchor': 'middle' }, hr + 'h')
        );
      }
      [0, 30, 60, 90].forEach((sec) => {
        svg.append(
          s('line', { x1: L, x2: W - R, y1: y(sec), y2: y(sec), class: 'grid' }),
          s('text', { x: L - 6, y: y(sec) + 4, 'text-anchor': 'end' }, sec + 's')
        );
      });

      let falseFailovers = 0;
      const pts = [];
      for (let i = 0; i <= 48; i++) {
        const hr = i * 0.5;
        let val = 3 + Math.sin(i * 1.3) * 1.5;
        if (baseSpikes[hr]) {
          val = baseSpikes[hr] * spikeScale;
          if (val >= timeoutSec) falseFailovers++;
        }
        if (hr === 18) val = 98; // real crash at 18h
        pts.push([hr, val]);
      }

      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)}`).join(' ');
      svg.append(
        s('path', { d, class: 'f-none s-accent', 'stroke-width': 2 }),
        s('line', { x1: L, x2: W - R, y1: y(timeoutSec), y2: y(timeoutSec), class: 'f-none s-bad dash', 'stroke-width': 2 }),
        s('text', { x: W - R - 4, y: y(timeoutSec) - 6, 'text-anchor': 'end', class: 'f-bad lbl-strong' }, `Timeout = ${timeoutSec}s`)
      );

      pts.forEach(([hr, val]) => {
        if (hr === 18) {
          svg.append(s('circle', { cx: x(hr), cy: y(val), r: 5, class: 'f-bad' }), s('text', { x: x(hr) - 8, y: y(val) + 4, 'text-anchor': 'end', class: 'f-bad lbl-strong' }, 'Leader sập thật (18h)'));
        } else if (baseSpikes[hr] && val >= timeoutSec) {
          svg.append(s('circle', { cx: x(hr), cy: y(val), r: 4.5, class: 'f-warn' }));
        }
      });

      clear(viz).append(svg);

      clear(stats).append(
        stat('Thời gian chờ khi Leader chết thật', timeoutSec + ' giây', timeoutSec > 45 ? 'bad' : timeoutSec > 25 ? 'warn' : 'ok', 'Không nhận ghi trong khoảng này'),
        stat('Số lần Failover nhầm (do tải cao)', falseFailovers + ' lần / ngày', falseFailovers === 0 ? 'ok' : falseFailovers === 1 ? 'warn' : 'bad', falseFailovers ? 'Đổi leader đúng lúc hệ thống đang quá tải!' : 'Không bị kích hoạt nhầm'),
        stat('Đánh giá cấu hình', falseFailovers === 0 && timeoutSec <= 40 ? 'Cân bằng tốt' : falseFailovers > 0 ? 'Quá nhạy (dễ bão tải)' : 'Phục hồi chậm', falseFailovers === 0 && timeoutSec <= 40 ? 'ok' : 'warn')
      );
    }
    render();
  });

  // =====================================================================
  // 6.6 Implementation of Replication Logs
  widget('ch6-logformats', (root) => {
    let stmt = 'now', fmtType = 'stmt';
    const sgStmt = seg({
      label: 'Câu lệnh SQL trên Leader',
      options: [
        { value: 'now', label: 'INSERT … NOW()' },
        { value: 'rand', label: 'UPDATE … RAND()' },
        { value: 'det', label: 'UPDATE +100 (tất định)' },
      ],
      value: stmt,
      onChange: (v) => { stmt = v; render(); },
    });
    const sgFmt = seg({
      label: 'Định dạng Replication Log',
      options: [
        { value: 'stmt', label: 'Statement-based' },
        { value: 'wal', label: 'WAL shipping' },
        { value: 'row', label: 'Logical (row-based)' },
        { value: 'trig', label: 'Trigger-based' },
      ],
      value: fmtType,
      onChange: (v) => { fmtType = v; render(); },
    });

    const split = h('div', { class: 'lab-split' });
    const stats = h('div', { class: 'stats' });
    root.append(h('div', { class: 'controls' }, ctl('Câu lệnh', sgStmt.el), ctl('Phương pháp', sgFmt.el)), split, stats);

    function render() {
      const data = {
        now: {
          sql: "INSERT INTO logins (user, ts) VALUES ('alice', NOW());",
          lVal: '2025-05-01 12:00:00.105',
          fValStmt: '2025-05-01 12:00:00.480',
          wal: 'BLOCK 0x04A2 OFFSET 128:\n  WRITE BYTES [61 6c 69 63 65 00 00 01 96 8b 52 29]',
          row: 'ROW_INSERT table=logins:\n  col[user] = "alice"\n  col[ts]   = "2025-05-01 12:00:00.105"\nCOMMIT_TXN #841',
          trig: 'AFTER INSERT ON logins → INSERT INTO repl_outbox:\n  {"op":"I","pk":"alice","ts":"2025-05-01 12:00:00.105"}',
        },
        rand: {
          sql: "UPDATE promos SET code = FLOOR(RAND()*1000) WHERE id = 7;",
          lVal: 'code = 742',
          fValStmt: 'code = 119',
          wal: 'BLOCK 0x011F OFFSET 64:\n  OVERWRITE 4 BYTES: 0x000002E6 (742)',
          row: 'ROW_UPDATE table=promos pk=7:\n  before: { code: 0 }\n  after:  { code: 742 }\nCOMMIT_TXN #842',
          trig: 'AFTER UPDATE ON promos → INSERT INTO repl_outbox:\n  {"op":"U","id":7,"new_code":742}',
        },
        det: {
          sql: 'UPDATE accounts SET bal = bal + 100 WHERE id = 1;',
          lVal: 'bal = 600',
          fValStmt: 'bal = 600',
          wal: 'BLOCK 0x008C OFFSET 32:\n  OVERWRITE 8 BYTES: 0x00000258 (600)',
          row: 'ROW_UPDATE table=accounts pk=1:\n  before: { bal: 500 }\n  after:  { bal: 600 }\nCOMMIT_TXN #843',
          trig: 'AFTER UPDATE ON accounts → INSERT INTO repl_outbox:\n  {"op":"U","id":1,"bal":600}',
        },
      }[stmt];

      const shipped = fmtType === 'stmt' ? data.sql : fmtType === 'wal' ? data.wal : fmtType === 'row' ? data.row : data.trig;
      const isDiff = fmtType === 'stmt' && stmt !== 'det';
      const fVal = isDiff ? data.fValStmt : data.lVal;

      clear(split).append(
        h('div', { class: 'box' },
          h('h5', 'Nội dung Leader gửi qua mạng'),
          h('pre', { class: 'ship' }, shipped)
        ),
        h('div', { class: 'box' },
          h('h5', 'So sánh dữ liệu sau khi áp dụng'),
          h('table', { class: 'mini' },
            h('thead', h('tr', h('th', 'Node'), h('th', 'Giá trị lưu trên đĩa'))),
            h('tbody',
              h('tr', h('td', 'Leader'), h('td', data.lVal)),
              h('tr', h('td', 'Follower'), h('td', { class: isDiff ? 'diff' : '' }, fVal + (isDiff ? ' (LỆCH!)' : ' (Khớp)')))
            )
          )
        )
      );

      clear(stats).append(
        stat('Tính nhất quán', isDiff ? 'Bị lệch dữ liệu!' : 'Khớp 100%', isDiff ? 'bad' : 'ok', isDiff ? 'Hàm không tất định sinh giá trị khác trên Follower' : 'An toàn'),
        stat('Nâng cấp khác phiên bản DB', fmtType === 'wal' ? 'Không (gắn chặt byte đĩa)' : 'Được (tách khỏi engine)', fmtType === 'wal' ? 'warn' : 'ok'),
        stat('Đọc cho Change Data Capture (CDC)', fmtType === 'row' || fmtType === 'trig' ? 'Rất dễ' : 'Khó', fmtType === 'row' ? 'ok' : 'accent')
      );
    }
    render();
  });

  // =====================================================================
  // 6.7 Problems with Replication Lag
  widget('ch6-lag', (root) => {
    let readAt = 220, overloaded = false;
    const slRead = slider({ label: 'Thời điểm client đọc (sau khi ghi lúc t = 0 ms)', min: 20, max: 1500, step: 20, value: readAt, format: (v) => v + ' ms', onInput: (v) => { readAt = v; render(); } });
    const cbOver = checkbox('Hệ thống gần quá tải / mạng chập chờn (đuôi độ trễ dài ra)', overloaded, (v) => { overloaded = v; render(); });
    const viz = h('div', { class: 'viz' });
    const stats = h('div', { class: 'stats' });

    root.append(h('div', { class: 'controls' }, slRead.el), h('div', { class: 'btn-row' }, cbOver.el), viz, stats);

    function render() {
      const lags = overloaded ? [90, 280, 620, 1050, 1420] : [40, 80, 140, 210, 320];
      const maxT = 1500;
      const W = 600, H = 195, L = 95, R = 25, T = 20, B = 28;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Độ trễ sao chép trên 5 follower' });
      const x = (ms) => L + (ms / maxT) * (W - L - R);

      [0, 300, 600, 900, 1200, 1500].forEach((ms) => {
        svg.append(
          s('line', { x1: x(ms), x2: x(ms), y1: T, y2: H - B, class: 'grid' }),
          s('text', { x: x(ms), y: H - B + 15, 'text-anchor': 'middle' }, ms + ' ms')
        );
      });

      let freshCount = 0;
      lags.forEach((lag, i) => {
        const y = T + 18 + i * 28;
        const fresh = readAt >= lag;
        if (fresh) freshCount++;
        svg.append(
          s('text', { x: 8, y: y + 4, class: 'lbl-strong' }, `Follower ${i + 1}`),
          s('rect', { x: L, y: y - 7, width: x(lag) - L, height: 14, rx: 4, class: 'f-warn' }),
          s('rect', { x: x(lag), y: y - 7, width: x(maxT) - x(lag), height: 14, rx: 4, class: 'f-ok' }),
          s('text', { x: x(lag) + 6, y: y + 4, class: 'lbl-strong' }, `bắt kịp @ ${lag} ms`)
        );
      });

      svg.append(
        s('line', { x1: x(readAt), x2: x(readAt), y1: T, y2: H - B, class: 'f-none s-accent', 'stroke-width': 2.5 }),
        s('text', { x: clamp(x(readAt), L + 50, W - 60), y: T - 5, 'text-anchor': 'middle', class: 'f-accent lbl-strong' }, `Đọc @ ${readAt} ms`)
      );
      clear(viz).append(svg);

      const staleProb = (5 - freshCount) / 5;
      clear(stats).append(
        stat('Follower đã có dữ liệu mới', `${freshCount} / 5`, freshCount === 5 ? 'ok' : freshCount >= 3 ? 'warn' : 'bad'),
        stat('Xác suất đọc phải dữ liệu cũ (stale)', pct(staleProb, 0), staleProb === 0 ? 'ok' : staleProb <= 0.4 ? 'warn' : 'bad'),
        stat('Khi ngừng ghi & chờ tới 1.500 ms', '5 / 5 khớp (Eventual)', 'accent', 'Nhất quán cuối cùng')
      );
    }
    render();
  });

  // =====================================================================
  // 6.8 Reading Your Own Writes
  widget('ch6-ryw', (root) => {
    let tech = 'none', lagMs = 800, readAfterMs = 250, crossDevice = false;
    const sgTech = seg({
      label: 'Kỹ thuật đảm bảo Read-Your-Writes',
      options: [
        { value: 'none', label: 'Không bảo vệ (đọc follower bất kỳ)' },
        { value: 'owner', label: 'Hồ sơ của chính mình → đọc Leader' },
        { value: 'window', label: 'Trong 60s sau khi ghi → đọc Leader' },
        { value: 'lsn', label: 'Client nhớ LSN lần ghi cuối' },
      ],
      value: tech,
      onChange: (v) => { tech = v; render(); },
    });
    const slLag = slider({ label: 'Độ trễ sao chép của Follower', min: 100, max: 2000, step: 100, value: lagMs, format: (v) => v + ' ms', onInput: (v) => { lagMs = v; render(); } });
    const slRead = slider({ label: 'User 1234 tải lại trang sau', min: 50, max: 2000, step: 50, value: readAfterMs, format: (v) => v + ' ms', onInput: (v) => { readAfterMs = v; render(); } });
    const cbCross = checkbox('Đọc lại từ thiết bị thứ 2 (điện thoại qua 4G, khác với laptop vừa ghi)', crossDevice, (v) => { crossDevice = v; render(); });

    const viz = h('div', { class: 'viz' });
    const stats = h('div', { class: 'stats' });
    const note = h('div', { class: 'step-note' });

    root.append(
      h('div', { class: 'controls' }, ctl('Kỹ thuật', sgTech.el), slLag.el, slRead.el),
      h('div', { class: 'btn-row' }, cbCross.el),
      viz, stats, note
    );

    function render() {
      const followerCaughtUp = readAfterMs >= lagMs;
      let target = 'Follower', seesNew = followerCaughtUp, why = '';

      if (tech === 'none') {
        target = 'Follower';
        seesNew = followerCaughtUp;
        why = seesNew ? 'Đọc từ Follower nhưng may mắn Follower đã bắt kịp.' : 'Đọc trúng Follower chưa bắt kịp → User 1234 tưởng bình luận/hồ sơ vừa sửa bị mất!';
      } else if (tech === 'owner') {
        target = 'Leader';
        seesNew = true;
        why = 'Quy tắc: hồ sơ của chính User 1234 luôn định tuyến về Leader (kể cả trên điện thoại), hồ sơ người khác mới đọc Follower.';
      } else if (tech === 'window') {
        if (crossDevice) {
          target = 'Follower (điện thoại không biết laptop vừa ghi)';
          seesNew = followerCaughtUp;
          why = 'Mốc thời gian ghi lưu cục bộ trên laptop; điện thoại không biết nên vẫn đọc Follower đang trễ!';
        } else {
          target = 'Leader (vì mới ghi chưa quá 60s)';
          seesNew = true;
          why = 'Cùng thiết bị nhớ vừa ghi cách đây ' + readAfterMs + ' ms (< 60s) nên gửi đọc về Leader.';
        }
      } else if (tech === 'lsn') {
        if (crossDevice) {
          target = 'Follower (điện thoại chưa có LSN mới)';
          seesNew = followerCaughtUp;
          why = 'LSN lưu ở client trên laptop; điện thoại chưa biết LSN=42 nên không yêu cầu replica phải đạt LSN=42.';
        } else {
          target = followerCaughtUp ? 'Follower (đã đạt LSN=42)' : 'Chờ / đổi sang Leader (vì Follower < LSN 42)';
          seesNew = true;
          why = 'Client gửi kèm LSN=42; hệ thống chỉ trả kết quả từ replica đã áp dụng tới LSN 42.';
        }
      }

      const W = 580, H = 135;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Luồng đọc-sau-ghi của User 1234' });
      svg.append(
        s('rect', { x: 14, y: 20, width: 135, height: 40, rx: 8, class: 'f-accent-soft s-accent' }),
        s('text', { x: 81, y: 44, 'text-anchor': 'middle', class: 'lbl-strong' }, '1. Laptop ghi (LSN 42)'),
        s('rect', { x: 14, y: 74, width: 135, height: 40, rx: 8, class: crossDevice ? 'f-violet-soft s-violet' : 'f-accent-soft s-accent' }),
        s('text', { x: 81, y: 98, 'text-anchor': 'middle', class: 'lbl-strong' }, crossDevice ? '2. Điện thoại đọc' : '2. Laptop đọc lại'),

        s('rect', { x: 230, y: 18, width: 145, height: 44, rx: 8, class: 'f-surface2 s-accent' }),
        s('text', { x: 302, y: 38, 'text-anchor': 'middle', class: 'lbl-strong' }, 'Leader (LSN 42)'),
        s('text', { x: 302, y: 53, 'text-anchor': 'middle' }, 'bio = "Mới cập nhật"'),

        s('rect', { x: 230, y: 74, width: 145, height: 44, rx: 8, class: followerCaughtUp ? 'f-ok s-ok' : 'f-warn s-warn' }),
        s('text', { x: 302, y: 94, 'text-anchor': 'middle', class: 'lbl-strong' }, followerCaughtUp ? 'Follower (LSN 42)' : 'Follower (LSN 41 - trễ)'),
        s('text', { x: 302, y: 109, 'text-anchor': 'middle' }, followerCaughtUp ? 'bio = "Mới cập nhật"' : 'bio = "Bản cũ"'),

        s('rect', { x: 420, y: 42, width: 145, height: 50, rx: 8, class: seesNew ? 'f-ok s-ok' : 'f-bad-soft s-bad' }),
        s('text', { x: 492, y: 64, 'text-anchor': 'middle', class: 'lbl-strong' }, seesNew ? '✓ Thấy bản mới' : '✗ Thấy bản cũ!'),
        s('text', { x: 492, y: 80, 'text-anchor': 'middle' }, seesNew ? 'Read-your-writes OK' : 'Vi phạm RYW'),

        s('line', { x1: 149, x2: 230, y1: 40, y2: 40, class: 'f-none s-accent', 'stroke-width': 2 }),
        s('line', { x1: 149, x2: 230, y1: 94, y2: target.startsWith('Leader') || target.startsWith('Chờ') ? 45 : 94, class: 'f-none ' + (seesNew ? 's-ok' : 's-bad'), 'stroke-width': 2.2 }),
        s('line', { x1: 375, x2: 420, y1: target.startsWith('Leader') || target.startsWith('Chờ') ? 45 : 94, y2: 67, class: 'f-none ' + (seesNew ? 's-ok' : 's-bad'), 'stroke-width': 2 })
      );
      clear(viz).append(svg);

      clear(stats).append(
        stat('Đọc được định tuyến tới', target, 'accent'),
        stat('Kết quả User 1234 nhìn thấy', seesNew ? 'Thấy dữ liệu vừa ghi' : 'Không thấy (dữ liệu cũ)', seesNew ? 'ok' : 'bad')
      );
      note.innerHTML = `<b>Giải thích:</b> ${why}`;
    }
    render();
  });

  // =====================================================================
  // 6.9 Monotonic Reads
  widget('ch6-monotonic', (root) => {
    let routing = 'random', f1Down = false, history = [];
    const lags = [150, 1200, 2600]; // ms lag of Follower 1, 2, 3
    const seqRandom = [0, 2, 0, 1, 2, 0]; // F1 (fast) -> F3 (slow) -> ...

    const sgRoute = seg({
      label: 'Chiến lược chọn Replica cho User 2345',
      options: [
        { value: 'random', label: 'Ngẫu nhiên (Round-robin / Random)' },
        { value: 'hash', label: 'Cố định theo hash(user_id)' },
      ],
      value: routing,
      onChange: (v) => { routing = v; reset(); },
    });
    const cbDown = checkbox('Làm hỏng Follower 1 (buộc đổi sang Follower 2)', f1Down, (v) => { f1Down = v; render(); });
    const btnReload = button('Tải lại trang (+0,7 giây)', stepRead);
    const btnReset = button('Đặt lại', reset, 'ghost');

    const readsEl = h('div', { class: 'reads' });
    const stats = h('div', { class: 'stats' });
    const note = h('div', { class: 'step-note' });

    root.append(
      h('div', { class: 'controls' }, ctl('Định tuyến đọc', sgRoute.el), h('div', { class: 'btn-row' }, btnReload, btnReset)),
      h('div', { class: 'btn-row' }, cbDown.el),
      readsEl, stats, note
    );

    function stepRead() {
      const idx = history.length;
      const tMs = 300 + idx * 700;
      let fIdx = routing === 'hash' ? 0 : seqRandom[idx % seqRandom.length];
      if (f1Down && fIdx === 0) fIdx = 1;
      const hasComment = tMs >= lags[fIdx];
      const maxSeenBefore = history.some((h0) => h0.hasComment);
      const backward = maxSeenBefore && !hasComment;
      history.push({ step: idx + 1, tMs, fIdx, hasComment, backward });
      render();
    }

    function reset() {
      history = [];
      stepRead();
      stepRead();
    }

    function render() {
      clear(readsEl);
      history.forEach((item) => {
        readsEl.append(
          h('div', { class: 'read-card ' + (item.backward ? 'bad' : item.hasComment ? 'ok' : 'warn') },
            h('b', `Lần đọc #${item.step} (${fmt(item.tMs / 1000, 1)}s)`),
            h('div', `→ Follower ${item.fIdx + 1} (trễ ${lags[item.fIdx]}ms)`),
            h('div', item.hasComment ? 'Thấy bình luận mới' : item.backward ? 'Bình luận BIẾN MẤT!' : 'Chưa thấy bình luận')
          )
        );
      });

      const violations = history.filter((x) => x.backward).length;
      clear(stats).append(
        stat('Số lần tải trang', String(history.length), 'accent'),
        stat('Vi phạm Monotonic Reads', violations ? `${violations} lần (thời gian chạy lùi!)` : '0 lần (Đơn điệu)', violations ? 'bad' : 'ok'),
        stat('Follower cố định của User 2345', routing === 'hash' ? (f1Down ? 'F1 sập → chuyển sang F2' : 'Luôn là Follower 1') : 'Đổi mỗi lần đọc', 'accent')
      );

      note.innerHTML = violations
        ? '<b>Thời gian chạy lùi (Hình 5-4):</b> Lần đọc đầu vào Follower 1 (ít trễ) nên đã thấy bình luận của User 1234; lần đọc kế tiếp rơi vào Follower 3 (trễ 2.600 ms) nên bình luận biến mất!'
        : '<b>Đọc đơn điệu được giữ:</b> Khi gắn mỗi user với một replica theo hash(user_id), user không bao giờ bị nhảy từ replica mới về replica cũ hơn (trừ khi replica đó sập).';
    }
    reset();
  });

  // =====================================================================
  // 6.10 Consistent Prefix Reads (Mr. Poons & Mrs. Cake)
  widget('ch6-prefix', (root) => {
    let lagP1 = 900, lagP2 = 150, fix = 'none';
    const slP1 = slider({ label: 'Độ trễ Follower của Partition 1 (chứa câu hỏi của ông Poons)', min: 50, max: 1200, step: 50, value: lagP1, format: (v) => v + ' ms', onInput: (v) => { lagP1 = v; render(); } });
    const slP2 = slider({ label: 'Độ trễ Follower của Partition 2 (chứa câu trả lời của bà Cake)', min: 50, max: 1200, step: 50, value: lagP2, format: (v) => v + ' ms', onInput: (v) => { lagP2 = v; render(); } });
    const sgFix = seg({
      label: 'Cách khắc phục',
      options: [
        { value: 'none', label: 'Không (2 partition độc lập)' },
        { value: 'same', label: 'Ghi cùng hội thoại vào 1 partition' },
        { value: 'causal', label: 'Theo dõi phụ thuộc nhân quả' },
      ],
      value: fix,
      onChange: (v) => { fix = v; render(); },
    });

    const split = h('div', { class: 'lab-split' });
    const stats = h('div', { class: 'stats' });
    root.append(h('div', { class: 'controls' }, slP1.el, slP2.el, ctl('Cách khắc phục', sgFix.el)), split, stats);

    function render() {
      const tAsk = 100, tAns = 300;
      const seeAskAt = tAsk + lagP1;
      const seeAnsAt = fix === 'same' ? tAns + lagP1 : fix === 'causal' ? Math.max(tAns + lagP2, seeAskAt + 20) : tAns + lagP2;
      const inverted = seeAnsAt < seeAskAt;

      const msgAsk = h('div', { class: 'bubble p' },
        h('b', 'Ông Poons (Partition 1): '),
        '“How far into the future can you see, Mrs. Cake?”',
        h('small', `Ghi @ ${tAsk} ms · Tới người đọc @ ${seeAskAt} ms`)
      );
      const msgAns = h('div', { class: 'bubble c' },
        h('b', 'Bà Cake (' + (fix === 'same' ? 'Partition 1' : 'Partition 2') + '): '),
        '“About ten seconds usually, Mr. Poons.”',
        h('small', `Ghi @ ${tAns} ms · Tới người đọc @ ${seeAnsAt} ms`)
      );

      clear(split).append(
        h('div', { class: 'box' },
          h('h5', 'Thứ tự thực tế (Quan hệ nhân quả)'),
          h('div', { class: 'chat' }, msgAsk.cloneNode(true), msgAns.cloneNode(true))
        ),
        h('div', { class: 'box' },
          h('h5', 'Thứ tự người thứ ba đọc được từ Follower'),
          h('div', { class: 'chat' }, inverted ? [msgAns, msgAsk] : [msgAsk, msgAns])
        )
      );

      clear(stats).append(
        stat('Người đọc thấy câu hỏi lúc', fmtMs(seeAskAt), 'accent'),
        stat('Người đọc thấy câu trả lời lúc', fmtMs(seeAnsAt), inverted ? 'bad' : 'ok'),
        stat('Consistent Prefix Reads', inverted ? 'VI PHẠM (Trả lời đến trước câu hỏi!)' : 'Thoả mãn (Đúng thứ tự nhân quả)', inverted ? 'bad' : 'ok')
      );
    }
    render();
  });

  // =====================================================================
  // 6.11 Multi-Leader Replication across Datacenters
  widget('ch6-multidc', (root) => {
    let arch = 'multi', userDc = 1, wanCut = false, euDown = false;
    const dcs = ['DC1 · Mỹ (US)', 'DC2 · Châu Âu (EU)', 'DC3 · Châu Á (AP)'];
    const sgArch = seg({
      label: 'Kiến trúc sao chép liên Datacenter',
      options: [
        { value: 'single', label: 'Single-Leader (Leader ở Mỹ)' },
        { value: 'multi', label: 'Multi-Leader (Mỗi DC 1 Leader)' },
      ],
      value: arch,
      onChange: (v) => { arch = v; render(); },
    });
    const sgUser = seg({
      label: 'Vị trí người dùng ghi dữ liệu',
      options: [
        { value: 0, label: 'Mỹ (US)' },
        { value: 1, label: 'Châu Âu (EU)' },
        { value: 2, label: 'Châu Á (AP)' },
      ],
      value: userDc,
      onChange: (v) => { userDc = +v; render(); },
    });
    const cbWan = checkbox('Đứt đường mạng WAN giữa Mỹ ↔ Châu Âu', wanCut, (v) => { wanCut = v; render(); });
    const cbEuDown = checkbox('Sập toàn bộ DC2 (Châu Âu)', euDown, (v) => { euDown = v; render(); });

    const viz = h('div', { class: 'viz' });
    const stats = h('div', { class: 'stats' });
    root.append(
      h('div', { class: 'controls' }, ctl('Kiến trúc', sgArch.el), ctl('Người dùng ở', sgUser.el)),
      h('div', { class: 'btn-row' }, cbWan.el, cbEuDown.el),
      viz, stats
    );

    function render() {
      const W = 600, H = 175;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'mapw', role: 'img', 'aria-label': 'Ba datacenter' });
      const pos = [[105, 85], [300, 85], [495, 85]];

      // WAN links
      svg.append(
        s('line', { x1: pos[0][0] + 65, x2: pos[1][0] - 65, y1: 85, y2: 85, class: wanCut ? 'f-none s-bad dash' : 'f-none s-accent', 'stroke-width': 2.2 }),
        s('text', { x: 202, y: 74, 'text-anchor': 'middle', class: wanCut ? 'f-bad lbl-strong' : '' }, wanCut ? '✗ Đứt WAN' : 'WAN 90 ms'),
        s('line', { x1: pos[1][0] + 65, x2: pos[2][0] - 65, y1: 85, y2: 85, class: 'f-none s-accent', 'stroke-width': 2.2 }),
        s('text', { x: 397, y: 74, 'text-anchor': 'middle' }, 'WAN 140 ms')
      );

      pos.forEach(([cx, cy], i) => {
        const down = i === 1 && euDown;
        const isLeader = arch === 'multi' || i === 0;
        const isUser = i === userDc;
        svg.append(
          s('rect', { x: cx - 65, y: cy - 42, width: 130, height: 84, rx: 10, class: down ? 'f-bad-soft s-bad dash' : isUser ? 'f-accent-soft s-accent' : 'f-surface2 s-line', 'stroke-width': 2 }),
          s('text', { x: cx, y: cy - 18, 'text-anchor': 'middle', class: 'lbl-strong' }, dcs[i]),
          s('text', { x: cx, y: cy + 4, 'text-anchor': 'middle', class: isLeader && !down ? 'f-accent lbl-strong' : '' }, down ? 'ĐÃ SẬP' : isLeader ? '★ Có Leader' : 'Chỉ có Follower'),
          s('text', { x: cx, y: cy + 24, 'text-anchor': 'middle' }, isUser ? '👤 User đang ở đây' : 'Độ trễ nội bộ ~8 ms')
        );
      });
      clear(viz).append(svg);

      let writeMs = 8, statusText = 'Ghi thành công tại chỗ', tone = 'ok';
      if (arch === 'single') {
        if (userDc === 0) {
          writeMs = 8;
        } else if (userDc === 1) {
          if (euDown || wanCut) { writeMs = Infinity; statusText = 'Thất bại (không tới được Leader ở Mỹ)'; tone = 'bad'; }
          else { writeMs = 98; statusText = 'Phải đi vòng qua WAN tới Mỹ'; tone = 'warn'; }
        } else {
          writeMs = 158; statusText = 'Đi qua WAN tới Leader ở Mỹ'; tone = 'warn';
        }
      } else {
        if (userDc === 1 && euDown) {
          writeMs = 98; statusText = 'DC2 sập → định tuyến sang DC gần nhất'; tone = 'warn';
        } else {
          writeMs = 8; statusText = 'Leader cục bộ nhận ngay, sao chép nền sang DC khác'; tone = 'ok';
        }
      }

      clear(stats).append(
        stat('Độ trễ ghi người dùng cảm nhận', fmtMs(writeMs), tone),
        stat('Trạng thái đường ghi', statusText, tone),
        stat('Đánh đổi chính', arch === 'multi' ? 'Phải giải quyết xung đột ghi đồng thời' : 'Nhạy cảm với độ trễ & lỗi mạng liên DC', 'accent')
      );
    }
    render();
  });

  // =====================================================================
  // 6.12 Handling Write Conflicts (Wiki Title A -> B vs A -> C)
  widget('ch6-conflict', (root) => {
    let strategy = 'lww', skewMs = 0, userChoice = 'B / C (hợp nhất)';
    const sgStrat = seg({
      label: 'Cách giải quyết xung đột',
      options: [
        { value: 'naive', label: 'Áp theo thứ tự nhận (Lệch!)' },
        { value: 'lww', label: 'Last Write Wins (LWW)' },
        { value: 'rep', label: 'Replica ID cao hơn thắng' },
        { value: 'merge', label: 'Tự động gộp ("B/C")' },
        { value: 'user', label: 'Lưu sibling & hỏi người dùng' },
      ],
      value: strategy,
      onChange: (v) => { strategy = v; render(); },
    });
    const slSkew = slider({ label: 'Độ lệch đồng hồ của Leader 2 so với thực tế', min: -500, max: 500, step: 50, value: skewMs, format: (v) => (v >= 0 ? '+' : '') + v + ' ms', onInput: (v) => { skewMs = v; render(); } });
    const sgUserPick = seg({
      label: 'Người dùng chọn khi đọc thấy 2 phiên bản',
      options: [
        { value: 'B', label: 'Giữ "B"' },
        { value: 'C', label: 'Giữ "C"' },
        { value: 'B / C (hợp nhất)', label: 'Gộp "B / C (hợp nhất)"' },
      ],
      value: userChoice,
      onChange: (v) => { userChoice = v; render(); },
    });

    const split = h('div', { class: 'lab-split' });
    const stats = h('div', { class: 'stats' });
    root.append(
      h('div', { class: 'controls' }, ctl('Chiến lược', sgStrat.el), slSkew.el),
      strategy === 'user' ? h('div', { class: 'controls' }, ctl('Quyết định của ứng dụng / người dùng', sgUserPick.el)) : null,
      split, stats
    );

    function render() {
      // Real time: User 1 writes "B" at t=1000ms on L1; User 2 writes "C" at t=1200ms on L2
      const ts1 = 1000;
      const ts2 = 1200 + skewMs;
      let valL1 = '', valL2 = '', lost = '';

      if (strategy === 'naive') {
        valL1 = 'C (nhận B rồi đè C)';
        valL2 = 'B (nhận C rồi đè B)';
        lost = 'Hai replica KHÔNG HỘI TỤ (lệch nhau vĩnh viễn)!';
      } else if (strategy === 'lww') {
        const win = ts2 >= ts1 ? 'C' : 'B';
        valL1 = valL2 = win;
        lost = win === 'C' ? 'Mất bản sửa "B" của User 1' : 'Mất bản sửa "C" của User 2 (dù C ghi sau ngoài đời thực, vì đồng hồ L2 chậm!)';
      } else if (strategy === 'rep') {
        valL1 = valL2 = 'C (vì Leader 2 > Leader 1)';
        lost = 'Mất bản sửa "B" của Leader 1';
      } else if (strategy === 'merge') {
        valL1 = valL2 = 'B/C';
        lost = 'Không mất dữ liệu';
      } else {
        valL1 = valL2 = userChoice;
        lost = 'Không mất tự động; ứng dụng giải quyết';
      }

      const converged = valL1 === valL2;
      clear(split).append(
        h('div', { class: 'box' },
          h('h5', `Leader 1 · User 1 sửa A → "B" (ts = ${ts1} ms)`),
          h('p', 'Giá trị cuối trên Leader 1: ', h('b', valL1))
        ),
        h('div', { class: 'box' },
          h('h5', `Leader 2 · User 2 sửa A → "C" (ts đồng hồ = ${ts2} ms)`),
          h('p', 'Giá trị cuối trên Leader 2: ', h('b', valL2))
        )
      );

      clear(stats).append(
        stat('Trạng thái hội tụ (Convergence)', converged ? `Hội tụ về "${valL1}"` : 'KHÔNG HỘI TỤ!', converged ? 'ok' : 'bad'),
        stat('Rủi ro mất dữ liệu', lost, lost.startsWith('Không') ? 'ok' : 'warn')
      );
    }
    render();
  });

  // =====================================================================
  // 6.13 Multi-Leader Replication Topologies
  widget('ch6-topology', (root) => {
    let topo = 'circular', origin = 0, downNode = 2;
    const sgTopo = seg({
      label: 'Topology sao chép (5 Leader)',
      options: [
        { value: 'circular', label: 'Vòng tròn (Circular)' },
        { value: 'star', label: 'Hình sao (Star · L1 ở tâm)' },
        { value: 'all', label: 'Mọi-tới-mọi (All-to-all)' },
      ],
      value: topo,
      onChange: (v) => { topo = v; render(); },
    });
    const sgOrig = seg({
      label: 'Leader nhận ghi ban đầu',
      options: [0, 1, 2, 3, 4].map((i) => ({ value: i, label: 'L' + (i + 1) })),
      value: origin,
      onChange: (v) => { origin = +v; if (downNode === origin) downNode = -1; render(); },
    });

    const viz = h('div', { class: 'viz' });
    const stats = h('div', { class: 'stats' });
    const note = h('div', { class: 'step-note' });

    root.append(h('div', { class: 'controls' }, ctl('Topology', sgTopo.el), ctl('Ghi tại', sgOrig.el)), viz, stats, note);

    function render() {
      const W = 580, H = 220;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Topology sao chép 5 leader' });
      const coords = [0, 1, 2, 3, 4].map((i) => {
        if (topo === 'star' && i === 0) return [170, 110];
        const idx = topo === 'star' ? i - 1 : i;
        const cnt = topo === 'star' ? 4 : 5;
        const ang = -Math.PI / 2 + (idx * 2 * Math.PI) / cnt;
        return [170 + Math.cos(ang) * 78, 110 + Math.sin(ang) * 78];
      });

      // Build adjacency
      const adj = [[], [], [], [], []];
      if (topo === 'circular') {
        for (let i = 0; i < 5; i++) adj[i].push((i + 1) % 5);
      } else if (topo === 'star') {
        for (let i = 1; i < 5; i++) { adj[0].push(i); adj[i].push(0); }
      } else {
        for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) if (i !== j) adj[i].push(j);
      }

      // BFS reachability from origin avoiding downNode
      const reached = new Set();
      const parent = {};
      if (origin !== downNode) {
        const q = [origin];
        reached.add(origin);
        while (q.length) {
          const u = q.shift();
          for (const v of adj[u]) {
            if (v !== downNode && !reached.has(v)) {
              reached.add(v);
              parent[v] = u;
              q.push(v);
            }
          }
        }
      }

      // Draw edges
      for (let u = 0; u < 5; u++) {
        for (const v of adj[u]) {
          const activeEdge = parent[v] === u;
          svg.append(s('line', {
            x1: coords[u][0], y1: coords[u][1], x2: coords[v][0], y2: coords[v][1],
            class: activeEdge ? 'f-none s-accent' : 'f-none s-line',
            'stroke-width': activeEdge ? 2.5 : 1.2,
          }));
        }
      }

      // Draw nodes (clickable to toggle down)
      coords.forEach(([cx, cy], i) => {
        const isDown = i === downNode;
        const ok = reached.has(i);
        const g = s('g', { class: 'clickable', onClick: () => { if (i !== origin) { downNode = isDown ? -1 : i; render(); } } },
          s('circle', { cx, cy, r: 21, class: isDown ? 'f-bad-soft s-bad dash' : i === origin ? 'f-accent s-accent' : ok ? 'f-ok s-ok' : 'f-surface2 s-warn', 'stroke-width': 2 }),
          s('text', { x: cx, y: cy + 4, 'text-anchor': 'middle', class: 'lbl-strong ' + (i === origin ? 'f-surface' : '') }, 'L' + (i + 1))
        );
        svg.append(g);
      });

      // Right side: Figure 5-9 causality overtake box in SVG
      svg.append(
        s('rect', { x: 310, y: 18, width: 255, height: 184, rx: 10, class: 'f-surface2 s-line' }),
        s('text', { x: 324, y: 40, class: 'lbl-strong' }, 'Vấn đề của All-to-All (Hình 5-9):'),
        s('text', { x: 324, y: 62 }, '1. L1 nhận: INSERT row A'),
        s('text', { x: 324, y: 82 }, '2. L3 nhận từ L1, rồi UPDATE row A'),
        s('text', { x: 324, y: 106, class: 'f-bad lbl-strong' }, '3. Đường L1 → L2 bị trễ mạng:'),
        s('text', { x: 324, y: 126 }, '   L2 nhận UPDATE (từ L3) TRƯỚC'),
        s('text', { x: 324, y: 144 }, '   khi nhận INSERT (từ L1)!'),
        s('text', { x: 324, y: 170, class: 'lbl-strong' }, '→ Cần Version Vector để giữ nhân quả.'),
        s('text', { x: 324, y: 190 }, '(Bấm vào node bên trái để tắt/bật)')
      );
      clear(viz).append(svg);

      const aliveTotal = downNode === -1 ? 5 : 4;
      clear(stats).append(
        stat('Node đang sập', downNode === -1 ? 'Không có' : 'Leader L' + (downNode + 1), downNode === -1 ? 'ok' : 'warn'),
        stat('Số node nhận được bản ghi', `${reached.size} / ${aliveTotal} node sống`, reached.size === aliveTotal ? 'ok' : 'bad'),
        stat('Chịu lỗi đứt 1 mắt xích', topo === 'all' ? 'Tốt (đi đường trực tiếp)' : 'Kém (cắt đứt dây chuyền)', topo === 'all' ? 'ok' : 'bad')
      );

      note.innerHTML = topo === 'all'
        ? '<b>All-to-all:</b> Dù L' + (downNode + 1 || 3) + ' sập, mọi node còn sống vẫn nhận được bản ghi trực tiếp. Tuy nhiên các gói tin có thể vượt nhau trên mạng như Hình 5-9.'
        : reached.size < aliveTotal
          ? `<b>Đứt luồng sao chép:</b> Trong topology ${topo}, chỉ một node trung gian (L${downNode + 1}) sập đã làm các node phía sau không nhận được thay đổi!`
          : '<b>Đang thông suốt:</b> Mỗi bản ghi mang theo danh sách ID các node đã đi qua (ví dụ <code>via=[L1, L2]</code>) để không bị lặp vô hạn.';
    }
    render();
  });

  // =====================================================================
  // 6.14 Leaderless Replication, Read Repair & Anti-Entropy
  widget('ch6-leaderless', (root) => {
    let reps = [
      { name: 'Replica 1', v: 7, val: 'avatar_v7.png', down: false },
      { name: 'Replica 2', v: 7, val: 'avatar_v7.png', down: false },
      { name: 'Replica 3', v: 6, val: 'avatar_v6_old.png', down: false },
    ];
    let readRepair = true, nextVer = 7;
    const lg = log();
    const nodesEl = h('div', { class: 'nodes' });
    const stats = h('div', { class: 'stats' });

    const cbRR = checkbox('Tự động Read Repair khi phát hiện bản cũ lúc đọc', readRepair, (v) => { readRepair = v; });
    const btnWrite = button('Ghi phiên bản mới (song song cả 3 replica)', () => {
      const up = reps.filter((r) => !r.down);
      if (up.length < 2) {
        lg.add(`Ghi thất bại: chỉ có ${up.length}/3 replica phản hồi (cần quorum w = 2).`, 'bad');
      } else {
        nextVer++;
        up.forEach((r) => { r.v = nextVer; r.val = `avatar_v${nextVer}.png`; });
        lg.add(`Ghi v${nextVer} thành công trên ${up.length}/3 replica (${up.map((r) => r.name).join(', ')}).`, 'ok');
      }
      render();
    });
    const btnRead = button('Client đọc song song (r = 2)', () => {
      const up = reps.filter((r) => !r.down);
      if (up.length < 2) {
        lg.add(`Đọc thất bại: chỉ có ${up.length}/3 replica sống (cần r = 2).`, 'bad');
        render();
        return;
      }
      const best = up.reduce((a, b) => (a.v >= b.v ? a : b));
      const stale = up.filter((r) => r.v < best.v);
      lg.add(`Đọc nhận [${up.map((r) => `${r.name}: v${r.v}`).join(', ')}] → chọn bản mới nhất v${best.v}.`, 'acc');
      if (stale.length && readRepair) {
        stale.forEach((r) => { r.v = best.v; r.val = best.val; });
        lg.add(`  Read repair: client gửi bản v${best.v} cập nhật lại cho ${stale.map((r) => r.name).join(', ')}.`, 'ok');
      } else if (stale.length) {
        lg.add(`  (${stale.map((r) => r.name).join(', ')} vẫn giữ bản cũ vì tắt Read Repair)`, 'warn');
      }
      render();
    });
    const btnAnti = button('Chạy tiến trình Anti-entropy nền', () => {
      const up = reps.filter((r) => !r.down);
      if (!up.length) return;
      const best = up.reduce((a, b) => (a.v >= b.v ? a : b));
      let fixed = 0;
      up.forEach((r) => { if (r.v < best.v) { r.v = best.v; r.val = best.val; fixed++; } });
      lg.add(fixed ? `Anti-entropy: đã đồng bộ ${fixed} replica tụt hậu lên v${best.v}.` : 'Anti-entropy: mọi replica đang sống đều đã đồng bộ.', 'ok');
      render();
    }, 'ghost');

    root.append(
      h('div', { class: 'btn-row' }, btnWrite, btnRead, btnAnti),
      h('div', { class: 'btn-row' }, cbRR.el),
      nodesEl, stats, lg
    );

    function render() {
      const maxV = Math.max(...reps.map((r) => r.v));
      clear(nodesEl);
      reps.forEach((r) => {
        const card = h('div', {
          class: 'node-card' + (r.down ? ' down' : r.v === maxV ? ' lead' : ''),
          style: { cursor: 'pointer' },
          onClick: () => { r.down = !r.down; lg.add(`${r.name} ${r.down ? 'đã bị tắt (down)' : 'đã sống lại'}.`, 't'); render(); },
        },
          h('h5', r.name, pill(r.down ? 'Đang sập' : r.v === maxV ? `v${r.v} (Mới nhất)` : `v${r.v} (Cũ)`, r.down ? 'bad' : r.v === maxV ? 'ok' : 'warn')),
          h('div', { class: 'chips' }, h('span', { class: 'chip ' + (r.v === maxV ? 'acc' : 'mark') }, `${r.val} · version=${r.v}`)),
          h('div', { class: 'meta' }, 'Bấm vào thẻ để bật/tắt replica này')
        );
        nodesEl.append(card);
      });

      const upCount = reps.filter((r) => !r.down).length;
      const staleCount = reps.filter((r) => !r.down && r.v < maxV).length;
      clear(stats).append(
        stat('Replica đang sống', `${upCount} / 3`, upCount >= 2 ? 'ok' : 'bad', 'Quorum n=3, w=2, r=2'),
        stat('Replica sống đang bị cũ', String(staleCount), staleCount === 0 ? 'ok' : 'warn'),
        stat('Phiên bản mới nhất', 'v' + maxV, 'accent')
      );
    }
    lg.add('Hình 5-10: Replica 3 vừa khởi động lại sau bảo trì nên đang giữ v6 cũ, trong khi Replica 1 & 2 đã có v7.', 't');
    render();
  });

  // =====================================================================
  // 6.15 Quorums for Reading and Writing (w + r > n)
  widget('ch6-quorum', (root) => {
    let n = 5, w = 3, r = 3, down = 1, offset = 0;
    const slN = slider({ label: 'Tổng số replica (n)', min: 3, max: 7, step: 1, value: n, onInput: (v) => { n = v; w = clamp(w, 1, n); r = clamp(r, 1, n); down = clamp(down, 0, n); render(); } });
    const slW = slider({ label: 'Quorum ghi (w)', min: 1, max: 7, step: 1, value: w, onInput: (v) => { w = clamp(v, 1, n); render(); } });
    const slR = slider({ label: 'Quorum đọc (r)', min: 1, max: 7, step: 1, value: r, onInput: (v) => { r = clamp(v, 1, n); render(); } });
    const slD = slider({ label: 'Số node đang sập', min: 0, max: 5, step: 1, value: down, onInput: (v) => { down = clamp(v, 0, n); render(); } });
    const btnSample = button('Đổi tập node đọc (lấy mẫu)', () => { offset = (offset + 1) % n; render(); }, 'ghost');

    const viz = h('div', { class: 'viz' });
    const stats = h('div', { class: 'stats' });

    root.append(
      h('div', { class: 'controls' }, slN.el, slW.el, slR.el, slD.el),
      h('div', { class: 'btn-row' }, btnSample),
      viz, stats
    );

    function render() {
      slW.set(w); slR.set(r); slD.set(down);
      const alive = n - down;
      const canWrite = alive >= w;
      const canRead = alive >= r;
      const strictQuorum = w + r > n;

      // Write hits first w nodes [0 .. w-1]; Read picks r nodes starting from worst-case end of alive nodes
      const wSet = new Set(Array.from({ length: w }, (_, i) => i));
      const rSet = new Set();
      for (let k = 0; k < r && k < alive; k++) {
        const idx = (n - 1 - k - offset + n * 2) % alive;
        rSet.add(idx);
      }
      const overlap = [...wSet].filter((i) => rSet.has(i));

      const W = 600, H = 135;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Tập ghi W và tập đọc R trên n replica' });
      const stepX = (W - 40) / n;

      for (let i = 0; i < n; i++) {
        const cx = 20 + stepX * (i + 0.5);
        const isDown = i >= alive;
        const inW = canWrite && wSet.has(i);
        const inR = canRead && rSet.has(i);
        const both = inW && inR;

        svg.append(
          s('rect', {
            x: cx - 34, y: 20, width: 68, height: 85, rx: 10,
            class: isDown ? 'f-bad-soft s-bad dash' : both ? 'f-ok s-ok' : inW ? 'f-accent-soft s-accent' : inR ? 'f-violet-soft s-violet' : 'f-surface2 s-line',
            'stroke-width': both ? 3 : 1.8,
          }),
          s('text', { x: cx, y: 44, 'text-anchor': 'middle', class: 'lbl-strong' }, `Node ${i + 1}`),
          s('text', { x: cx, y: 66, 'text-anchor': 'middle', class: 'lbl-strong' }, isDown ? 'SẬP' : [inW ? 'W' : '', inR ? 'R' : ''].filter(Boolean).join(' ∩ ') || '—'),
          s('text', { x: cx, y: 88, 'text-anchor': 'middle' }, isDown ? 'down' : both ? 'Giao nhau!' : inW ? 'Đã ghi' : inR ? 'Được đọc' : 'Rảnh')
        );
      }
      clear(viz).append(svg);

      clear(stats).append(
        stat('Điều kiện w + r > n', `${w} + ${r} = ${w + r} ${strictQuorum ? '>' : '≤'} ${n}`, strictQuorum ? 'ok' : 'warn', strictQuorum ? 'Đảm bảo W và R giao nhau' : 'Có thể đọc không trúng node đã ghi!'),
        stat('Số node giao nhau (W ∩ R)', canWrite && canRead ? `${overlap.length} node` : 'Không đủ quorum', overlap.length > 0 ? 'ok' : 'bad'),
        stat('Chịu lỗi tối đa', `Ghi: ${n - w} node · Đọc: ${n - r} node`, canWrite && canRead ? 'ok' : 'bad', !canWrite ? 'GHI THẤT BẠI!' : !canRead ? 'ĐỌC THẤT BẠI!' : 'Đủ quorum')
      );
    }
    render();
  });

  // =====================================================================
  // 6.16 Sloppy Quorums and Hinted Handoff
  widget('ch6-sloppy', (root) => {
    let policy = 'sloppy', netPart = true, handoffDone = false;
    const sgPol = seg({
      label: 'Chính sách Quorum (n=3, w=2, r=2)',
      options: [
        { value: 'strict', label: 'Strict Quorum (Chỉ ghi vào node nhà A, B, C)' },
        { value: 'sloppy', label: 'Sloppy Quorum (Cho phép giữ hộ ở D, E)' },
      ],
      value: policy,
      onChange: (v) => { policy = v; handoffDone = false; render(); },
    });
    const btnPart = button('1. Đứt mạng (Client 1 chỉ thấy A, D, E)', () => { netPart = true; handoffDone = false; render(); }, 'ghost');
    const btnHeal = button('2. Mạng hồi phục → Chạy Hinted Handoff', () => { netPart = false; handoffDone = true; render(); });

    const nodesEl = h('div', { class: 'nodes' });
    const stats = h('div', { class: 'stats' });
    const note = h('div', { class: 'step-note' });

    root.append(
      h('div', { class: 'controls' }, ctl('Chính sách', sgPol.el), h('div', { class: 'btn-row' }, btnPart, btnHeal)),
      nodesEl, stats, note
    );

    function render() {
      const writeSucceeded = !netPart || policy === 'sloppy';
      const nodes = [
        { id: 'A', home: true, reachC1: true, val: writeSucceeded ? 'v2 (mới)' : 'v1 (cũ)' },
        { id: 'B', home: true, reachC1: !netPart, val: !netPart || handoffDone ? 'v2 (mới)' : 'v1 (cũ)' },
        { id: 'C', home: true, reachC1: !netPart, val: 'v1 (cũ)' },
        { id: 'D', home: false, reachC1: true, val: netPart && policy === 'sloppy' ? 'v2 (hint → B)' : '—' },
        { id: 'E', home: false, reachC1: true, val: '—' },
        { id: 'F', home: false, reachC1: !netPart, val: '—' },
      ];

      clear(nodesEl);
      nodes.forEach((nd) => {
        const hasNew = nd.val.startsWith('v2');
        nodesEl.append(
          h('div', { class: 'node-card' + (!nd.reachC1 ? ' down' : hasNew ? ' lead' : '') },
            h('h5', `Node ${nd.id}`, pill(nd.home ? 'Node nhà' : 'Hàng xóm', nd.home ? 'accent' : '')),
            h('div', { class: 'chips' }, h('span', { class: 'chip ' + (hasNew ? 'ok' : 'mark') }, nd.val)),
            h('div', { class: 'meta' }, nd.reachC1 ? 'Client 1 kết nối được' : 'Bị cắt mạng với Client 1')
          )
        );
      });

      const c2SeesNew = !netPart || handoffDone;
      clear(stats).append(
        stat('Lệnh ghi của Client 1 (w=2)', writeSucceeded ? 'THÀNH CÔNG (2 ack)' : 'THẤT BẠI (chỉ tới được A)', writeSucceeded ? 'ok' : 'bad'),
        stat('Client 2 đọc từ B, C (r=2)', policy === 'strict' ? 'v1 (vì ghi đã bị từ chối)' : c2SeesNew ? 'v2 (Mới nhất)' : 'v1 (ĐỌC CŨ dù w+r > n!)', c2SeesNew ? 'ok' : 'warn'),
        stat('Trạng thái Hinted Handoff', handoffDone ? 'Node D đã trả v2 về Node B' : netPart && policy === 'sloppy' ? 'Node D đang giữ hộ bản ghi cho B' : 'Không dùng', 'accent')
      );

      note.innerHTML = policy === 'strict' && netPart
        ? '<b>Strict Quorum:</b> Client 1 chỉ tới được 1 node nhà (A), không đủ w = 2 nên lệnh ghi bị từ chối để giữ tính nhất quán.'
        : netPart && policy === 'sloppy'
          ? '<b>Sloppy Quorum:</b> Client 1 ghi 1 bản vào A và nhờ Node D giữ hộ 1 bản (kèm hint "dành cho B"). Ghi thành công, nhưng Client 2 đọc từ 2 node nhà B, C sẽ vẫn thấy giá trị cũ v1 cho tới khi mạng liền lại!'
          : '<b>Hinted Handoff hoàn tất:</b> Khi mạng thông suốt, Node D đẩy bản ghi v2 trả về cho Node B rồi xoá bản giữ hộ.';
    }
    render();
  });

  // =====================================================================
  // 6.17a Detecting Concurrent Writes & LWW
  widget('ch6-lww', (root) => {
    let mode = 'overwrite', bClockSlow = false, bCausalAfterA = false;
    const sgMode = seg({
      label: 'Cách mỗi node xử lý các lệnh ghi',
      options: [
        { value: 'overwrite', label: 'Ghi đè theo thứ tự gói tin tới (Hình 5-12)' },
        { value: 'lww', label: 'Last Write Wins (LWW theo timestamp)' },
        { value: 'sibling', label: 'Giữ cả hai làm Sibling' },
      ],
      value: mode,
      onChange: (v) => { mode = v; render(); },
    });
    const cbSlow = checkbox('Đồng hồ của Client B bị chậm 5 ms so với Client A', bClockSlow, (v) => { bClockSlow = v; render(); });
    const cbCausal = checkbox('Client B đọc giá trị của A rồi mới ghi (B xảy ra sau A về nhân quả)', bCausalAfterA, (v) => { bCausalAfterA = v; render(); });

    const nodesEl = h('div', { class: 'nodes' });
    const stats = h('div', { class: 'stats' });

    root.append(
      h('div', { class: 'controls' }, ctl('Cơ chế tại Replica', sgMode.el)),
      h('div', { class: 'btn-row' }, cbSlow.el, cbCausal.el),
      nodesEl, stats
    );

    function render() {
      const tsA = 100;
      const tsB = (bCausalAfterA ? 103 : 101) + (bClockSlow ? -5 : 0); // if slow, tsB < tsA!
      const winLww = tsB >= tsA ? `B (ts=${tsB})` : `A (ts=${tsA})`;

      const n1Val = mode === 'overwrite' ? 'A (bỏ lỡ gói B)' : mode === 'lww' ? winLww : '{A, B}';
      const n2Val = mode === 'overwrite' ? 'B (nhận A rồi B)' : mode === 'lww' ? winLww : '{A, B}';
      const n3Val = mode === 'overwrite' ? 'A (nhận B rồi A)' : mode === 'lww' ? winLww : '{A, B}';

      clear(nodesEl);
      [['Node 1 (nhận A)', n1Val], ['Node 2 (nhận A → B)', n2Val], ['Node 3 (nhận B → A)', n3Val]].forEach(([title, val]) => {
        nodesEl.append(
          h('div', { class: 'node-card' + (mode === 'overwrite' ? ' danger' : ' lead') },
            h('h5', title),
            h('div', { class: 'chips' }, h('span', { class: 'chip ' + (mode === 'overwrite' ? 'bad' : 'ok') }, `X = ${val}`))
          )
        );
      });

      const converged = n1Val === n2Val && n2Val === n3Val;
      const causalLost = mode === 'lww' && bCausalAfterA && bClockSlow;

      clear(stats).append(
        stat('Timestamp gắn vào lệnh ghi', `A: ${tsA} ms · B: ${tsB} ms`, bClockSlow ? 'warn' : 'accent'),
        stat('Hội tụ giữa 3 Node', converged ? `Cùng hội tụ về ${n2Val}` : 'LỆCH NHAU VĨNH VIỄN!', converged ? 'ok' : 'bad'),
        stat('Bảo toàn dữ liệu', causalLost ? 'MẤT GHI NHÂN QUẢ CỦA B!' : mode === 'lww' ? 'Mất 1 trong 2 ghi (âm thầm)' : mode === 'sibling' ? 'Giữ trọn cả hai' : 'Hỏng nhất quán', causalLost || mode === 'overwrite' ? 'bad' : mode === 'lww' ? 'warn' : 'ok')
      );
    }
    render();
  });

  // =====================================================================
  // 6.17b Happens-Before vs Concurrent interactive classifier
  widget('ch6-hb', (root) => {
    const CASES = [
      {
        title: 'Tình huống 1 (Hình 5-9): Client A chạy INSERT dòng X trên Node 1; dòng đó sao chép sang Node 3; Client B đọc X trên Node 3 rồi chạy UPDATE tăng X lên.',
        ans: 'a-before-b',
        why: 'B đọc và sửa dựa trên kết quả của A → B phụ thuộc nhân quả vào A (A happens-before B).',
      },
      {
        title: 'Tình huống 2 (Hình 5-12): Lúc 12:00:00.001 Client A ghi X="mèo" vào Node 1; lúc 12:00:00.050 Client B (không đọc trước) ghi X="chó" vào Node 3.',
        ans: 'concurrent',
        why: 'Dù lệch nhau 49 ms trên đồng hồ vật lý, không thao tác nào biết về thao tác kia → hai thao tác là ĐỒNG THỜI (concurrent).',
      },
      {
        title: 'Tình huống 3: Client B thêm "bacon" vào giỏ hàng sau khi đã đọc giỏ hàng chứa [milk, eggs] do Client A ghi ở phiên bản v3.',
        ans: 'a-before-b',
        why: 'Client B gửi kèm phiên bản v3 đã biết → ghi của A tại v3 xảy ra trước ghi mới của B.',
      },
    ];
    const picks = {};
    const wrap = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } });
    root.append(wrap);

    function render() {
      clear(wrap);
      CASES.forEach((c, idx) => {
        const cur = picks[idx];
        const opts = [
          ['a-before-b', 'A xảy ra trước B (A → B)'],
          ['b-before-a', 'B xảy ra trước A (B → A)'],
          ['concurrent', 'Hai thao tác đồng thời (A ∥ B)'],
        ];
        const card = h('div', { class: 'hb-card' },
          h('p', h('b', c.title)),
          h('div', { class: 'btn-row' }, opts.map(([val, label]) => {
            const btn = button(label, () => { picks[idx] = val; render(); }, 'ghost');
            if (cur === val) btn.classList.add(val === c.ans ? 'good' : 'badc');
            return btn;
          })),
          cur ? h('p', { class: 'lab-note', style: { marginTop: '8px' } }, (cur === c.ans ? '✓ Chính xác: ' : '✗ Chưa đúng: ') + c.why) : null
        );
        wrap.append(card);
      });
    }
    picks[0] = 'a-before-b';
    render();
  });

  // =====================================================================
  // 6.18a Shopping Cart: Version Numbers & Siblings (Figure 5-13)
  widget('ch6-cart', (root) => {
    const BOOK_STEPS = [
      { step: 1, who: 'Client 1', base: 0, write: ['milk'], server: [{ v: 1, items: ['milk'] }], desc: 'Bước 1: Giỏ hàng trống. Client 1 thêm [milk] (kèm version=0) → Server tạo v1: [milk].' },
      { step: 2, who: 'Client 2', base: 0, write: ['eggs'], server: [{ v: 1, items: ['milk'] }, { v: 2, items: ['eggs'] }], desc: 'Bước 2: Client 2 chưa đọc v1, thêm [eggs] (version=0). Vì 0 < 1, v1 không bị đè → Server giữ 2 sibling: v1 [milk] và v2 [eggs].' },
      { step: 3, who: 'Client 1', base: 1, write: ['milk', 'flour'], server: [{ v: 2, items: ['eggs'] }, { v: 3, items: ['milk', 'flour'] }], desc: 'Bước 3: Client 1 chỉ mới biết v1, thêm flour → gửi [milk, flour] kèm version=1. Server đè v1 (≤ 1), giữ v2 (> 1) và tạo v3 [milk, flour].' },
      { step: 4, who: 'Client 2', base: 2, write: ['eggs', 'milk', 'ham'], server: [{ v: 3, items: ['milk', 'flour'] }, { v: 4, items: ['eggs', 'milk', 'ham'] }], desc: 'Bước 4: Client 2 đọc lúc trước thấy {v1 [milk], v2 [eggs]}, gộp lại rồi thêm ham → gửi [eggs, milk, ham] kèm version=2. Server đè v2 (≤ 2), giữ v3 (> 2), tạo v4.' },
      { step: 5, who: 'Client 1', base: 3, write: ['milk', 'flour', 'eggs', 'bacon'], server: [{ v: 4, items: ['eggs', 'milk', 'ham'] }, { v: 5, items: ['milk', 'flour', 'eggs', 'bacon'] }], desc: 'Bước 5: Client 1 trước đó đọc thấy {v2 [eggs], v3 [milk, flour]}, gộp và thêm bacon → gửi kèm version=3. Server đè v3 (≤ 3), giữ v4 (> 3), tạo v5.' },
    ];
    let idx = 4, extraMerged = false;

    const btnPrev = button('← Bước trước', () => { extraMerged = false; idx = Math.max(0, idx - 1); render(); }, 'ghost');
    const btnNext = button('Bước tiếp →', () => { extraMerged = false; idx = Math.min(4, idx + 1); render(); });
    const btnMergeAll = button('Client đọc v4 & v5 rồi gộp lại (Bước 6)', () => { extraMerged = true; render(); }, 'ghost');

    const nodesEl = h('div', { class: 'nodes' });
    const stats = h('div', { class: 'stats' });
    const note = h('div', { class: 'step-note' });

    root.append(h('div', { class: 'btn-row' }, btnPrev, btnNext, btnMergeAll), nodesEl, stats, note);

    function render() {
      btnPrev.disabled = idx === 0 && !extraMerged;
      btnNext.disabled = idx === 4;
      const cur = BOOK_STEPS[idx];
      const siblings = extraMerged
        ? [{ v: 6, items: ['milk', 'flour', 'eggs', 'bacon', 'ham'] }]
        : cur.server;

      clear(nodesEl);
      siblings.forEach((sib) => {
        nodesEl.append(
          h('div', { class: 'node-card lead' },
            h('h5', `Phiên bản Server v${sib.v}`, pill('Sibling đang giữ', 'accent')),
            h('div', { class: 'chips' }, sib.items.map((it) => h('span', { class: 'chip ok' }, it))),
            h('div', { class: 'meta' }, `Quy tắc: ghi kèm version k sẽ đè mọi bản ≤ k`)
          )
        );
      });

      clear(stats).append(
        stat('Trạng thái Hình 5-13', extraMerged ? 'Sau khi gộp hợp (Union)' : `Bước ${cur.step} / 5 (${cur.who})`, 'accent'),
        stat('Số Sibling trên Server', String(siblings.length), siblings.length === 1 ? 'ok' : 'warn', siblings.length > 1 ? 'Có ghi đồng thời chưa gộp' : 'Đã hội tụ thành 1 giá trị'),
        stat('Dữ liệu bị mất', '0 món', 'ok', 'Không món hàng nào bị rơi mất')
      );

      note.innerHTML = extraMerged
        ? '<b>Hợp nhất hoàn tất (v6):</b> Client đọc cả v4 và v5, lấy phép hợp <code>[milk, flour, eggs, bacon, ham]</code> rồi ghi lại kèm <code>version = 5</code> → đè cả v4 và v5!'
        : `<b>${cur.desc}</b>`;
    }
    render();
  });

  // =====================================================================
  // 6.18b Merging Siblings with Tombstones
  widget('ch6-tombstone', (root) => {
    let useTombstone = true;
    const sg = seg({
      label: 'Cách xử lý khi User xoá món "ham" ở Sibling 2',
      options: [
        { value: false, label: 'Xoá thẳng khỏi mảng (Không có Tombstone)' },
        { value: true, label: 'Đánh dấu xoá bằng Tombstone (ham 🪦 @ v5)' },
      ],
      value: useTombstone,
      onChange: (v) => { useTombstone = v; render(); },
    });

    const nodesEl = h('div', { class: 'nodes' });
    const stats = h('div', { class: 'stats' });

    root.append(h('div', { class: 'controls' }, ctl('Cơ chế xoá', sg.el)), nodesEl, stats);

    function render() {
      const sib1 = ['milk', 'eggs', 'ham', 'bacon'];
      const sib2 = useTombstone ? ['milk', 'eggs', 'flour', 'TOMBSTONE(ham)'] : ['milk', 'eggs', 'flour'];
      const merged = useTombstone
        ? ['milk', 'eggs', 'bacon', 'flour']
        : ['milk', 'eggs', 'ham', 'bacon', 'flour'];

      clear(nodesEl).append(
        h('div', { class: 'node-card' },
          h('h5', 'Sibling A (thêm bacon)'),
          h('div', { class: 'chips' }, sib1.map((x) => h('span', { class: 'chip' }, x)))
        ),
        h('div', { class: 'node-card' },
          h('h5', 'Sibling B (đã xoá ham, thêm flour)'),
          h('div', { class: 'chips' }, sib2.map((x) => h('span', { class: 'chip ' + (x.startsWith('TOMB') ? 'bad' : '') }, x)))
        ),
        h('div', { class: 'node-card ' + (useTombstone ? 'lead' : 'danger') },
          h('h5', 'Kết quả sau khi gộp (Union)'),
          h('div', { class: 'chips' }, merged.map((x) => h('span', { class: 'chip ' + (x === 'ham' ? 'bad' : 'ok') }, x === 'ham' ? 'ham (HIỆN LẠI!)' : x)))
        )
      );

      clear(stats).append(
        stat('Món đã xoá ("ham")', useTombstone ? 'Đã được loại bỏ đúng' : 'BỊ HIỆN LẠI TRONG GIỎ HÀNG!', useTombstone ? 'ok' : 'bad'),
        stat('Cấu trúc dữ liệu tự động', 'CRDT (Riak 2.0 Set)', 'accent', 'Tự giữ tombstone kèm version')
      );
    }
    render();
  });

  // =====================================================================
  // 6.19 Version Vectors
  widget('ch6-vv', (root) => {
    let vA = [2, 1, 0], vB = [1, 2, 0], scenIdx = 0;
    const SCEN = [
      { a: [1, 0, 0], b: [1, 1, 0], note: 'Replica 1 ghi [1,0,0]; sau đó Replica 2 đọc bản đó rồi ghi tiếp → [1,1,0]. Mọi phần tử của B ≥ A nên B đè A.' },
      { a: [2, 1, 0], b: [1, 2, 0], note: 'Replica 1 và Replica 2 cùng nhận ghi độc lập: A lớn hơn ở R1 (2 > 1), B lớn hơn ở R2 (2 > 1) → ĐỒNG THỜI (giữ cả 2 làm sibling).' },
      { a: [2, 2, 1], b: [2, 1, 0], note: 'Client gộp hai sibling rồi ghi vào Replica 3 → [2,2,1] lớn hơn hoặc bằng ở mọi vị trí nên ghi đè được [2,1,0].' },
    ];

    const split = h('div', { class: 'lab-split' });
    const stats = h('div', { class: 'stats' });
    const note = h('div', { class: 'step-note' });
    const presets = h('div', { class: 'btn-row' },
      SCEN.map((sc, i) => button(`Kịch bản mẫu #${i + 1}`, () => { vA = [...sc.a]; vB = [...sc.b]; scenIdx = i; render(); }, 'ghost'))
    );

    root.append(presets, split, stats, note);

    function makeVecEditor(title, vec) {
      return h('div', { class: 'box' },
        h('h5', title),
        h('div', { class: 'vv' }, vec.map((val, i) =>
          h('div', { class: 'cell' },
            h('span', `R${i + 1}`),
            h('b', String(val)),
            h('div',
              h('button', { type: 'button', onClick: () => { vec[i] = Math.max(0, vec[i] - 1); render(); } }, '−'),
              h('button', { type: 'button', onClick: () => { vec[i] = Math.min(9, vec[i] + 1); render(); } }, '+')
            )
          )
        ))
      );
    }

    function render() {
      clear(split).append(
        makeVecEditor('Version Vector A', vA),
        makeVecEditor('Version Vector B', vB)
      );

      const eq = vA.every((x, i) => x === vB[i]);
      const aGeB = vA.every((x, i) => x >= vB[i]) && !eq;
      const bGeA = vB.every((x, i) => x >= vA[i]) && !eq;
      const merged = vA.map((x, i) => Math.max(x, vB[i]));

      let rel = 'Đồng thời (A ∥ B) → Giữ cả 2 làm Sibling', tone = 'warn';
      if (eq) { rel = 'Cùng một phiên bản (A = B)'; tone = 'ok'; }
      else if (aGeB) { rel = 'A xảy ra sau B → A ghi đè B'; tone = 'ok'; }
      else if (bGeA) { rel = 'B xảy ra sau A → B ghi đè A'; tone = 'ok'; }

      clear(stats).append(
        stat('Vector A vs Vector B', `[${vA.join(', ')}] vs [${vB.join(', ')}]`, 'accent'),
        stat('Quan hệ nhân quả', rel, tone),
        stat('Vector sau khi gộp (Causal Context)', `[${merged.join(', ')}]`, 'ok')
      );

      note.innerHTML = `<b>Quy tắc so sánh Version Vector:</b> Vector X đè được Y khi và chỉ khi mọi thành phần <code>X[r] ≥ Y[r]</code> và có ít nhất một thành phần lớn hơn hẳn. ${SCEN[scenIdx].note}`;
    }
    render();
  });

  // =====================================================================
  // Glossary terms for Chapter 6
  glossary.add([
    { key: 'shared-memory', term: 'Shared-memory architecture', vi: 'kiến trúc bộ nhớ dùng chung', ch: 6, topic: 'ch6-distributed',
      def: 'Nhiều CPU và RAM gắn vào một hệ điều hành duy nhất (vertical scaling / scale up). Chi phí tăng nhanh hơn tuyến tính và giới hạn ở một địa điểm.' },
    { key: 'shared-disk', term: 'Shared-disk architecture', vi: 'kiến trúc đĩa dùng chung', ch: 6, topic: 'ch6-distributed',
      def: 'Nhiều máy có CPU, RAM riêng nhưng truy cập chung một hệ thống lưu trữ qua mạng nhanh; bị giới hạn bởi tranh chấp khoá.' },
    { key: 'shared-nothing', term: 'Shared-nothing architecture', vi: 'kiến trúc không dùng chung', ch: 6, topic: 'ch6-distributed',
      def: 'Mỗi node có CPU, RAM và đĩa độc lập, phối hợp với nhau hoàn toàn qua mạng ở tầng phần mềm (horizontal scaling / scale out).' },
    { key: 'replication', term: 'Replication', vi: 'sao chép dữ liệu', ch: 6, topic: 'ch6-distributed',
      def: 'Giữ bản sao của cùng một dữ liệu trên nhiều node nối mạng để chịu lỗi, giảm độ trễ và tăng thông lượng đọc.' },
    { key: 'partitioning', term: 'Partitioning (sharding)', vi: 'phân vùng dữ liệu', ch: 6, topic: 'ch6-distributed',
      def: 'Chia một cơ sở dữ liệu lớn thành các phần nhỏ (partition/shard) đặt trên các node khác nhau.' },
    { key: 'node', term: 'Node', vi: 'nút (máy chủ trong cụm)', ch: 6, topic: 'ch6-distributed',
      def: 'Một máy tính hoặc máy ảo độc lập chạy phần mềm cơ sở dữ liệu trong hệ phân tán.' },
    { key: 'replica', term: 'Replica', vi: 'bản sao (node giữ bản sao)', ch: 6, topic: 'ch6-leaders',
      def: 'Một node lưu trữ một bản sao của dữ liệu trong cụm sao chép.' },
    { key: 'leader-based', term: 'Leader-based replication', vi: 'sao chép dựa trên leader', ch: 6, topic: 'ch6-leaders',
      def: 'Mô hình active/passive (master–slave): mọi lệnh ghi đi vào một leader duy nhất, rồi được truyền sang các follower qua replication log.' },
    { key: 'leader', term: 'Leader (primary / master)', vi: 'node dẫn đầu (nhận ghi)', ch: 6, topic: 'ch6-leaders',
      def: 'Replica được chỉ định nhận mọi thao tác ghi từ client và quyết định thứ tự thực thi các ghi đó.' },
    { key: 'replication-log', term: 'Replication log (change stream)', vi: 'nhật ký sao chép', ch: 6, topic: 'ch6-leaders',
      def: 'Luồng các thay đổi đã xảy ra trên leader được gửi sang follower để áp dụng theo đúng thứ tự.' },
    { key: 'follower', term: 'Follower (read replica / secondary)', vi: 'node theo sau (nhận bản sao)', ch: 6, topic: 'ch6-leaders',
      def: 'Replica không nhận ghi trực tiếp từ client mà chỉ nhận replication log từ leader và phục vụ các truy vấn đọc.' },
    { key: 'sync-replication', term: 'Synchronous replication', vi: 'sao chép đồng bộ', ch: 6, topic: 'ch6-leaders',
      def: 'Leader chờ cho tới khi follower xác nhận đã ghi xong thay đổi rồi mới báo thành công cho client.' },
    { key: 'async-replication', term: 'Asynchronous replication', vi: 'sao chép bất đồng bộ', ch: 6, topic: 'ch6-leaders',
      def: 'Leader gửi thay đổi cho follower nhưng báo thành công cho client ngay lập tức mà không chờ follower xác nhận.' },
    { key: 'semi-sync', term: 'Semi-synchronous replication', vi: 'sao chép bán đồng bộ', ch: 6, topic: 'ch6-leaders',
      def: 'Cấu hình trong đó đúng một follower được sao chép đồng bộ, các follower còn lại bất đồng bộ; nếu follower đồng bộ hỏng thì nâng một follower khác lên thay.' },
    { key: 'chain-replication', term: 'Chain replication', vi: 'sao chép dạng chuỗi', ch: 6, topic: 'ch6-leaders',
      def: 'Biến thể sao chép đồng bộ truyền ghi lần lượt qua một chuỗi các node từ đầu chuỗi (head) tới cuối chuỗi (tail).' },
    { key: 'snapshot', term: 'Consistent snapshot', vi: 'ảnh chụp nhất quán', ch: 6, topic: 'ch6-new-follower',
      def: 'Bản chụp toàn bộ cơ sở dữ liệu tại một thời điểm xác định (gắn với một vị trí LSN trong log), dùng để dựng follower mới mà không khoá DB.' },
    { key: 'lsn', term: 'Log sequence number (LSN)', vi: 'số thứ tự trong log', ch: 6, topic: 'ch6-new-follower',
      def: 'Định danh vị trí chính xác và tăng đơn điệu của mỗi thay đổi trong write-ahead log / replication log (PostgreSQL gọi là LSN, MySQL gọi là binlog coordinates).' },
    { key: 'catch-up', term: 'Catch-up recovery', vi: 'hồi phục bắt kịp', ch: 6, topic: 'ch6-outages',
      def: 'Quá trình follower sau khi khởi động lại kết nối tới leader và xin mọi thay đổi xảy ra kể từ giao dịch cuối cùng nó đã ghi nhận.' },
    { key: 'failover', term: 'Failover', vi: 'chuyển đổi dự phòng khi leader hỏng', ch: 6, topic: 'ch6-outages',
      def: 'Quy trình phát hiện leader đã chết, bầu một follower lên làm leader mới, và cấu hình lại hệ thống để gửi ghi tới leader mới.' },
    { key: 'split-brain', term: 'Split brain', vi: 'não chẻ đôi (hai leader cùng lúc)', ch: 6, topic: 'ch6-outages',
      def: 'Tình huống lỗi nguy hiểm khi hai node cùng tin mình là leader và cùng nhận ghi độc lập, làm dữ liệu mâu thuẫn hoặc hỏng.' },
    { key: 'fencing', term: 'Fencing (STONITH)', vi: 'cô lập / chặn leader cũ', ch: 6, topic: 'ch6-outages',
      def: 'Cơ chế buộc tắt hoặc chặn các thao tác từ một node đã bị tước quyền leader để ngăn split brain.' },
    { key: 'statement-based', term: 'Statement-based replication', vi: 'sao chép theo câu lệnh', ch: 6, topic: 'ch6-repl-logs',
      def: 'Gửi nguyên văn câu lệnh SQL (INSERT, UPDATE, DELETE) từ leader sang follower để chạy lại; dễ lệch nếu có hàm không tất định như NOW(), RAND().' },
    { key: 'wal-shipping', term: 'Write-ahead log (WAL) shipping', vi: 'gửi trực tiếp write-ahead log', ch: 6, topic: 'ch6-repl-logs',
      def: 'Sao chép bằng cách gửi các byte thay đổi ở mức khối đĩa trong WAL của storage engine; gắn chặt với định dạng vật lý và phiên bản DB.' },
    { key: 'logical-log', term: 'Logical (row-based) replication log', vi: 'log sao chép logic (theo dòng)', ch: 6, topic: 'ch6-repl-logs',
      def: 'Định dạng log mô tả thay đổi ở mức từng dòng dữ liệu (giá trị các cột được thêm/sửa/xoá), độc lập với biểu diễn vật lý của storage engine.' },
    { key: 'cdc', term: 'Change data capture (CDC)', vi: 'bắt giữ thay đổi dữ liệu', ch: 6, topic: 'ch6-repl-logs',
      def: 'Đọc luồng thay đổi từ logical log của cơ sở dữ liệu để đồng bộ sang kho dữ liệu, bộ máy tìm kiếm hoặc cache bên ngoài.' },
    { key: 'trigger-based', term: 'Trigger-based replication', vi: 'sao chép dựa trên trigger', ch: 6, topic: 'ch6-repl-logs',
      def: 'Dùng trigger hoặc mã tầng ứng dụng ghi lại các thay đổi vào bảng riêng để tiến trình ngoài đọc và sao chép linh hoạt.' },
    { key: 'eventual-consistency', term: 'Eventual consistency', vi: 'nhất quán cuối cùng', ch: 6, topic: 'ch6-lag',
      def: 'Đảm bảo rằng nếu ngừng ghi thêm, sau một khoảng thời gian không xác định mọi replica cuối cùng sẽ hội tụ về cùng một trạng thái.' },
    { key: 'replication-lag', term: 'Replication lag', vi: 'độ trễ sao chép', ch: 6, topic: 'ch6-lag',
      def: 'Khoảng thời gian chênh lệch từ lúc một ghi được áp dụng trên leader cho tới khi nó xuất hiện trên một follower.' },
    { key: 'read-after-write', term: 'Read-after-write consistency (read-your-writes)', vi: 'nhất quán đọc-sau-ghi', ch: 6, topic: 'ch6-ryw',
      def: 'Bảo đảm rằng khi một người dùng tải lại trang sau khi gửi cập nhật, họ luôn nhìn thấy thay đổi do chính họ vừa ghi.' },
    { key: 'monotonic-reads', term: 'Monotonic reads', vi: 'đọc đơn điệu', ch: 6, topic: 'ch6-monotonic',
      def: 'Bảo đảm rằng sau khi một người dùng đã nhìn thấy dữ liệu tại một thời điểm, các lần đọc tiếp theo của họ sẽ không bao giờ trả về trạng thái cũ hơn thời điểm đó.' },
    { key: 'consistent-prefix', term: 'Consistent prefix reads', vi: 'đọc tiền tố nhất quán', ch: 6, topic: 'ch6-prefix',
      def: 'Bảo đảm rằng nếu một chuỗi các thao tác ghi có thứ tự nhân quả thì bất kỳ ai đọc cũng sẽ thấy chúng xuất hiện theo đúng thứ tự đó.' },
    { key: 'multi-leader', term: 'Multi-leader replication', vi: 'sao chép nhiều leader', ch: 6, topic: 'ch6-multi-leader',
      def: 'Cấu hình master–master (active/active) cho phép nhiều hơn một node nhận lệnh ghi và chuyển tiếp thay đổi cho các leader còn lại.' },
    { key: 'conflict-avoidance', term: 'Conflict avoidance', vi: 'tránh xung đột ghi', ch: 6, topic: 'ch6-conflicts',
      def: 'Chiến lược định tuyến mọi lệnh ghi cho cùng một bản ghi (hoặc cùng một người dùng) về đúng một leader cố định để không phát sinh xung đột.' },
    { key: 'lww', term: 'Last write wins (LWW)', vi: 'ghi cuối cùng thắng', ch: 6, topic: 'ch6-conflicts',
      def: 'Cách giải quyết xung đột chỉ giữ lại giá trị có timestamp lớn nhất và âm thầm huỷ bỏ các giá trị còn lại; dễ gây mất dữ liệu.' },
    { key: 'crdt', term: 'Conflict-free replicated datatype (CRDT)', vi: 'kiểu dữ liệu sao chép tự gộp không xung đột', ch: 6, topic: 'ch6-conflicts',
      def: 'Họ các cấu trúc dữ liệu (tập hợp, bộ đếm, map…) được thiết kế để nhiều replica có thể cập nhật đồng thời và tự động gộp lại theo cách hội tụ.' },
    { key: 'topology', term: 'Replication topology', vi: 'hình trạng (topology) sao chép', ch: 6, topic: 'ch6-topologies',
      def: 'Đồ thị đường đi truyền các thay đổi giữa các leader: vòng tròn (circular), hình sao (star) hoặc mọi-tới-mọi (all-to-all).' },
    { key: 'leaderless', term: 'Leaderless replication', vi: 'sao chép không leader', ch: 6, topic: 'ch6-leaderless',
      def: 'Kiến trúc kiểu Dynamo nơi không có node nào làm leader; client gửi lệnh ghi và lệnh đọc trực tiếp tới nhiều replica song song.' },
    { key: 'read-repair', term: 'Read repair', vi: 'sửa bản sao cũ khi đọc', ch: 6, topic: 'ch6-leaderless',
      def: 'Cơ chế trong đó khi client đọc song song từ nhiều replica và phát hiện một replica giữ phiên bản cũ, client ghi ngược phiên bản mới nhất vào replica đó.' },
    { key: 'anti-entropy', term: 'Anti-entropy process', vi: 'tiến trình đồng bộ nền anti-entropy', ch: 6, topic: 'ch6-leaderless',
      def: 'Tiến trình chạy nền liên tục tìm kiếm sự khác biệt giữa các replica trong hệ không leader và sao chép những dữ liệu còn thiếu.' },
    { key: 'quorum', term: 'Quorum (w + r > n)', vi: 'túc số đọc/ghi', ch: 6, topic: 'ch6-quorum',
      def: 'Quy tắc trong cụm n replica: nếu ghi chờ w node xác nhận và đọc hỏi r node sao cho w + r > n, tập đọc và tập ghi chắc chắn giao nhau ít nhất 1 node.' },
    { key: 'sloppy-quorum', term: 'Sloppy quorum', vi: 'quorum lỏng', ch: 6, topic: 'ch6-sloppy',
      def: 'Khi đứt mạng làm không đủ w node nhà cho một khoá, hệ thống vẫn chấp nhận ghi tạm vào các node khác đang kết nối được để ưu tiên tính sẵn sàng ghi.' },
    { key: 'hinted-handoff', term: 'Hinted handoff', vi: 'chuyển trả bản ghi giữ hộ', ch: 6, topic: 'ch6-sloppy',
      def: 'Quá trình node giữ hộ dữ liệu trong lúc sloppy quorum gửi trả các bản ghi đó về đúng các node nhà sau khi mạng hồi phục.' },
    { key: 'happens-before', term: 'Happens-before relationship', vi: 'quan hệ xảy-ra-trước', ch: 6, topic: 'ch6-concurrent',
      def: 'Thao tác A xảy ra trước B nếu B biết về A, phụ thuộc vào kết quả của A hoặc xây dựng tiếp trên giá trị do A tạo ra.' },
    { key: 'concurrent', term: 'Concurrent operations', vi: 'các thao tác đồng thời', ch: 6, topic: 'ch6-concurrent',
      def: 'Hai thao tác là đồng thời nếu không thao tác nào biết về thao tác kia (không có quan hệ nhân quả), bất kể thời điểm đồng hồ vật lý của chúng.' },
    { key: 'siblings', term: 'Siblings', vi: 'các giá trị anh em (xung đột đồng thời)', ch: 6, topic: 'ch6-cart',
      def: 'Nhiều phiên bản giá trị cùng tồn tại song song cho một khoá do các lệnh ghi đồng thời tạo ra, cần được client đọc và gộp lại.' },
    { key: 'tombstone', term: 'Tombstone', vi: 'bia mộ (dấu xoá có phiên bản)', ch: 6, topic: 'ch6-cart',
      def: 'Bản ghi đánh dấu rằng một phần tử đã bị xoá tại một phiên bản nhất định, để khi hợp nhất các sibling thì phần tử đã xoá không bị hồi sinh.' },
    { key: 'version-vector', term: 'Version vector', vi: 'vector phiên bản', ch: 6, topic: 'ch6-version-vectors',
      def: 'Tập hợp các bộ đếm phiên bản (mỗi replica một con số) cho phép phân biệt bản ghi nào ghi đè bản ghi nào và bản ghi nào là đồng thời trên nhiều replica.' },
  ]);
})();
