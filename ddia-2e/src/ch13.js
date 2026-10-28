/* ch13 — The Future of Data Systems (nguồn: DDIA ấn bản 1, Chương 12) */
(function () {
  'use strict';
  const D = window.DDIA;
  const { h, s, clear, fmt, fmtBig, fmtMs, pct, rng, clamp, slider, seg, button, checkbox, stat, widget, glossary } = D;

  function mkSvg(w, hh, label, cls) {
    return s('svg', { viewBox: `0 0 ${w} ${hh}`, role: 'img', 'aria-label': label || '', class: cls || '' });
  }
  const T = (x, y, txt, cls, extra) => s('text', Object.assign({ x, y, class: cls || '' }, extra || {}), txt);
  const TM = (x, y, txt, cls, extra) => T(x, y, txt, cls, Object.assign({ 'text-anchor': 'middle' }, extra || {}));
  const TE = (x, y, txt, cls, extra) => T(x, y, txt, cls, Object.assign({ 'text-anchor': 'end' }, extra || {}));
  const L = (x1, y1, x2, y2, cls, extra) => s('line', Object.assign({ x1, y1, x2, y2, class: 'f-none ' + (cls || 's-line') }, extra || {}));
  const R = (x, y, w, hh, cls, extra) => s('rect', Object.assign({ x, y, width: Math.max(0, w), height: Math.max(0, hh), class: cls }, extra || {}));
  const C = (cx, cy, r, cls, extra) => s('circle', Object.assign({ cx, cy, r, class: cls }, extra || {}));

  // =====================================================================
  // 13.1 dataflow-map — Organization dataflow DAG
  // =====================================================================
  widget('dataflow-map', (root) => {
    const NODES = [
      { id: 'oltp', name: 'OLTP DB (Gốc)', x: 80, y: 95, up: [], down: ['log', 'search', 'cache', 'dw', 'ml'] },
      { id: 'log', name: 'CDC / Event Log', x: 255, y: 95, up: ['oltp'], down: ['search', 'cache', 'dw', 'ml'] },
      { id: 'search', name: 'Search Index', x: 470, y: 28, up: ['oltp', 'log'], down: [] },
      { id: 'cache', name: 'Object Cache', x: 470, y: 80, up: ['oltp', 'log'], down: [] },
      { id: 'dw', name: 'Data Warehouse', x: 470, y: 132, up: ['oltp', 'log'], down: ['ml'] },
      { id: 'ml', name: 'Mô hình Gợi ý ML', x: 470, y: 184, up: ['oltp', 'log', 'dw'], down: [] },
    ];
    let sel = 'log';
    let version = 1;
    const directBypass = checkbox('Phá vỡ kiến trúc: Cho ứng dụng ghi thẳng vào Search Index (Dual Write)', false, render);
    const btnWrite = button('Ghi một thay đổi mới vào OLTP DB', () => { version++; render(); });

    const svg = mkSvg(640, 220, 'Bản đồ luồng dữ liệu dẫn xuất của tổ chức', 'wide');
    const layer = s('g'); svg.appendChild(layer);
    const s1 = stat('Node đang chọn', '–'), s2 = stat('Phiên bản dữ liệu hội tụ', '–'), s3 = stat('Tính chất kiến trúc', '–');

    root.append(
      h('div', { class: 'btn-row' }, btnWrite, directBypass.el),
      h('div', { class: 'viz' }, svg),
      h('div', { class: 'stats' }, s1, s2, s3)
    );

    function render() {
      clear(layer);
      const cur = NODES.find((n) => n.id === sel);
      const bypass = directBypass.input.checked;

      const edges = [
        ['oltp', 'log'],
        ['log', 'search'],
        ['log', 'cache'],
        ['log', 'dw'],
        ['dw', 'ml'],
      ];
      edges.forEach(([u, v]) => {
        const nu = NODES.find((n) => n.id === u), nv = NODES.find((n) => n.id === v);
        layer.append(L(nu.x + 65, nu.y, nv.x - 65, nv.y, 's-accent sw2'));
      });
      if (bypass) {
        layer.append(
          L(80, 72, 405, 28, 's-bad sw2 dash'),
          T(175, 36, 'Ghi kép trực tiếp (Nguy cơ lệch thứ tự!)', 'sm f-bad lbl-strong')
        );
      }

      NODES.forEach((n) => {
        const isSel = n.id === sel;
        const isUp = cur.up.includes(n.id);
        const isDown = cur.down.includes(n.id);
        const cls = isSel ? 'f-accent-soft s-accent sw2' : isUp ? 'f-ok-soft s-ok' : isDown ? 'f-violet-soft s-violet' : 'f-surface s-line';
        const g = s('g', { style: { cursor: 'pointer' }, onClick: () => { sel = n.id; render(); } });
        g.append(
          R(n.x - 65, n.y - 20, 130, 40, cls, { rx: 7 }),
          TM(n.x, n.y - 2, n.name, 'sm lbl-strong'),
          TM(n.x, n.y + 13, `v${version}`, 'sm f-ink3')
        );
        layer.append(g);
      });

      s1.update(cur.name, 'accent', `Nuôi ${cur.down.length} hệ · Phụ thuộc ${cur.up.length} hệ`);
      s2.update(`v${version} trên mọi view`, bypass ? 'bad' : 'ok', bypass ? 'Search Index có thể lệch với OLTP DB!' : 'Mọi view dẫn xuất tất định từ Log');
      s3.update(bypass ? 'Vỡ tính đơn hướng!' : 'Luồng dữ liệu 1 chiều rõ ràng', bypass ? 'bad' : 'ok', 'Có thể xoá và dựng lại bất kỳ view nào');
    }
    render();
  });

  // =====================================================================
  // 13.2 dual-write — Dual writes vs Log-based total order (1000 trials)
  // =====================================================================
  widget('dual-write', (root) => {
    const mode = seg({
      label: 'Phương thức cập nhật',
      options: [
        { value: 'dual', label: 'Ghi kép (Dual Writes trực tiếp vào DB & Index)' },
        { value: 'log', label: 'Đi qua Log (Total Order Broadcast / CDC)' },
      ],
      value: 'dual',
      onChange: render,
    });
    const jitterSl = slider({ label: 'Biên độ dao động trễ mạng', min: 5, max: 50, step: 5, value: 25, format: fmtMs, onInput: render });
    let seed = 3;
    const btnRun = button('Chạy mô phỏng 1.000 lần ghi đồng thời', () => { seed++; render(); });

    const s1 = stat('Số lần DB & Index nhất quán', '–'),
          s2 = stat('Số lần lệch nhau vĩnh viễn', '–'),
          s3 = stat('Nguyên nhân', '–');

    root.append(
      h('div', { class: 'controls' }, mode.el, jitterSl.el),
      h('div', { class: 'btn-row' }, btnRun),
      h('div', { class: 'stats' }, s1, s2, s3)
    );

    function render() {
      const isLog = mode.value === 'log';
      const r = rng(seed * 73 + jitterSl.value);
      let mismatch = 0;
      if (!isLog) {
        for (let i = 0; i < 1000; i++) {
          const dA_db = r() * jitterSl.value, dB_db = r() * jitterSl.value;
          const dA_ix = r() * jitterSl.value, dB_ix = r() * jitterSl.value;
          if ((dA_db < dB_db) !== (dA_ix < dB_ix)) mismatch++;
        }
      }
      const okCount = 1000 - mismatch;
      s1.update(`${okCount}/1.000 (${pct(okCount / 1000, 1)})`, mismatch === 0 ? 'ok' : 'warn', 'Cả hai hội tụ về cùng giá trị');
      s2.update(`${mismatch}/1.000 (${pct(mismatch / 1000, 1)})`, mismatch === 0 ? 'ok' : 'bad', mismatch ? 'DB giữ B còn Index giữ A (hoặc ngược lại)' : 'Không bao giờ lệch');
      s3.update(isLog ? 'Log cố định 1 thứ tự duy nhất' : '2 hệ tự quyết thứ tự độc lập', isLog ? 'ok' : 'bad', 'Total order broadcast loại bỏ cuộc đua mạng');
    }
    render();
  });

  // =====================================================================
  // 13.3 unfriend — Ordering events to capture causality
  // =====================================================================
  widget('unfriend', (root) => {
    const friendDelay = slider({ label: 'Độ trễ của Partition Bạn bè ( chứa sự kiện Unfriend )', min: 10, max: 120, step: 10, value: 70, format: fmtMs, onInput: render });
    const strat = seg({
      label: 'Cơ chế tại Dịch vụ Thông báo',
      options: [
        { value: 'none', label: 'Xử lý ngay khi tin đến (Không kiểm tra nhân quả)' },
        { value: 'causal', label: 'Đính kèm Version / Causal Dependency của danh sách bạn bè' },
      ],
      value: 'none',
      onChange: render,
    });

    const svg = mkSvg(640, 180, 'Phụ thuộc nhân quả giữa Unfriend và Gửi tin nhắn');
    const layer = s('g'); svg.appendChild(layer);
    const s1 = stat('Thời điểm xử lý Gửi tin', '30 ms + 15 ms = 45 ms', 'accent', 'Đi qua Partition Tin nhắn'),
          s2 = stat('Thời điểm xử lý Unfriend', '–'),
          s3 = stat('Minh (người yêu cũ) có nhận thông báo?', '–');

    root.append(
      h('div', { class: 'controls' }, friendDelay.el, strat.el),
      h('div', { class: 'viz' }, svg),
      h('div', { class: 'stats' }, s1, s2, s3)
    );

    function render() {
      clear(layer);
      const tUnf = friendDelay.value;
      const tMsg = 45;
      const isCausal = strat.value === 'causal';
      const leaked = !isCausal && tUnf > tMsg;
      const X0 = 130, X1 = 610;
      const x = (ms) => X0 + (ms / 140) * (X1 - X0);

      [['1. Unfriend(Minh)', 45, tUnf], ['2. PostMsg("...")', 105, tMsg], ['3. Push Service', 150, isCausal ? Math.max(tUnf, tMsg) : tMsg]].forEach(([lbl, y]) => {
        layer.append(L(X0, y, X1, y, 'grid'), T(8, y + 4, lbl, 'lbl-strong sm'));
      });

      layer.append(
        L(x(0), 45, x(tUnf), 150, 's-accent sw2'),
        C(x(tUnf), 150, 5, 'f-accent'),
        TM(x(tUnf), 32, `Unfriend đến lúc ${tUnf}ms`, 'sm f-accent lbl-strong'),

        L(x(30), 105, x(tMsg), 150, leaked ? 's-bad sw2' : 's-ok sw2'),
        C(x(tMsg), 150, 5, leaked ? 'f-bad' : 'f-ok'),
        TM(x(tMsg), 92, `Tin nhắn đến lúc ${tMsg}ms`, 'sm lbl-strong ' + (leaked ? 'f-bad' : 'f-ok'))
      );

      s2.update(`${tUnf} ms`, tUnf > tMsg ? 'warn' : 'ok', tUnf > tMsg ? 'Đến muộn hơn tin nhắn!' : 'Đến trước tin nhắn');
      s3.update(leaked ? 'BỊ LỌT THÔNG BÁO!' : 'An toàn (Không gửi cho Minh)', leaked ? 'bad' : 'ok',
        isCausal ? `Chờ thấy trạng thái bạn bè v2 (lúc ${Math.max(tUnf, tMsg)}ms) mới gửi push` :
        leaked ? 'Không thể thu hồi thông báo đẩy đã gửi ra ngoài!' : 'May mắn đến đúng thứ tự');
    }
    render();
  });

  // =====================================================================
  // 13.4 gauge-migration — Dual-gauge railway gradual schema migration
  // =====================================================================
  widget('gauge-migration', (root) => {
    const pctNew = slider({ label: 'Tỉ lệ người dùng đọc View mới (Schema v2)', min: 0, max: 100, step: 10, value: 30, format: (v) => v + '%', onInput: render });
    const hasBug = checkbox('Phát hiện View mới có bug ở góc khuất!', false, render);
    let droppedOld = false;
    const btnRollback = button('Kéo ngay về 0% (Quay về View cũ tức thời)', () => {
      if (!droppedOld) { pctNew.set(0); render(); }
    });
    const btnDropOld = button('Tháo bỏ View cũ (Chỉ khi đã 100%)', () => {
      if (pctNew.value === 100) { droppedOld = true; render(); }
    }, 'danger');
    const btnReset = button('Khôi phục thử nghiệm', () => { droppedOld = false; pctNew.set(30); render(); }, 'ghost');

    const bars = h('div', { class: 'hbars' });
    const s1 = stat('Lưu lượng đọc View cũ (v1)', '–'), s2 = stat('Lưu lượng đọc View mới (v2)', '–'), s3 = stat('Khả năng đảo ngược (Reversibility)', '–');

    root.append(
      h('div', { class: 'controls' }, pctNew.el),
      hasBug.el,
      h('div', { class: 'btn-row' }, btnRollback, btnDropOld, btnReset),
      bars,
      h('div', { class: 'stats' }, s1, s2, s3)
    );

    function render() {
      clear(bars);
      const p2 = droppedOld ? 100 : pctNew.value;
      const p1 = 100 - p2;
      const bug = hasBug.input.checked;

      const mkBar = (lbl, val, cls) => h('div', { class: 'hbar' },
        h('span', lbl),
        h('div', { class: 'track' }, h('div', { class: 'fill ' + cls, style: { width: val + '%' } })),
        h('span', { class: 'v' }, val + '%')
      );

      bars.append(
        mkBar('View cũ (Schema v1)', p1, droppedOld ? 'bad' : 'ok'),
        mkBar('View mới (Schema v2)', p2, bug ? 'bad' : 'accent')
      );

      s1.update(droppedOld ? 'ĐÃ XOÁ' : p1 + '%', droppedOld ? 'warn' : 'ok', 'Dẫn xuất song song từ cùng Event Log');
      s2.update(p2 + '%', bug && p2 > 0 ? 'bad' : 'accent', bug && p2 > 0 ? 'Người dùng trên v2 đang gặp lỗi!' : 'Hoạt động bình thường');
      s3.update(droppedOld ? 'Không còn đường lùi' : 'Đảo ngược tức thời 100%', droppedOld ? 'warn' : 'ok',
        droppedOld ? 'Đã tháo thanh ray khổ cũ' : 'Giống đường sắt khổ kép thế kỷ 19');
    }
    render();
  });

  // =====================================================================
  // 13.5 lambda-lab — Lambda architecture vs Unified stream engine
  // =====================================================================
  widget('lambda-lab', (root) => {
    const mode = seg({
      label: 'Kiến trúc xử lý',
      options: [
        { value: 'lambda', label: 'Kiến trúc Lambda (Batch chính xác + Stream xấp xỉ)' },
        { value: 'unified', label: 'Hợp nhất Batch & Stream (1 Engine duy nhất + Event Time + Exactly-once)' },
      ],
      value: 'lambda',
      onChange: render,
    });
    const driftSl = slider({ label: 'Sai số xấp xỉ của Speed Layer trong Lambda', min: 0, max: 20, step: 2, value: 12, format: (v) => '±' + v + '%', onInput: render });

    const s1 = stat('Số hệ thống phải viết & vận hành', '–'),
          s2 = stat('Sai số ở các giờ chưa chạy Batch', '–'),
          s3 = stat('Phức tạp khi trộn kết quả (Merge)', '–');

    root.append(
      h('div', { class: 'controls' }, mode.el, driftSl.el),
      h('div', { class: 'stats' }, s1, s2, s3)
    );

    function render() {
      const isUni = mode.value === 'unified';
      s1.update(isUni ? '1 bộ code duy nhất (Beam/Flink)' : '2 bộ code (Hadoop + Storm)', isUni ? 'ok' : 'warn',
        isUni ? 'Phát lại lịch sử trên cùng engine luồng' : 'Tốn gấp đôi công bảo trì & dễ lệch logic');
      s2.update(isUni ? '0% (Chính xác ngay trên luồng)' : `Lệch ±${driftSl.value}% cho tới khi Batch chạy xong`, isUni ? 'ok' : 'warn',
        isUni ? 'Nhờ trạng thái exactly-once & cửa sổ event time' : 'Speed layer chỉ tính xấp xỉ tạm thời');
      s3.update(isUni ? 'Không cần trộn 2 nguồn' : 'Khó với Join & Sessionization', isUni ? 'ok' : 'bad', 'Kappa / Unified stream architecture');
    }
    render();
  });

  // =====================================================================
  // 13.6 fed-unbundled — Federated (unifying reads) vs Unbundled (unifying writes)
  // =====================================================================
  widget('fed-unbundled', (root) => {
    const arch = seg({
      label: 'Hướng ghép nối các công nghệ lưu trữ',
      options: [
        { value: 'unbundled', label: 'Unbundled DB (Hợp nhất ĐƯỜNG GHI qua Log + CDC)' },
        { value: 'federated', label: 'Federated / Polystore (Hợp nhất ĐƯỜNG ĐỌC lúc truy vấn)' },
      ],
      value: 'unbundled',
      onChange: render,
    });

    const pipeBox = h('div', { class: 'pipe' });
    const s1 = stat('Đường Ghi (Write Synchronization)', '–'),
          s2 = stat('Đường Đọc (Read Latency)', '–'),
          s3 = stat('Khi 1 hệ thống con bị sập', '–');

    root.append(arch.el, pipeBox, h('div', { class: 'stats' }, s1, s2, s3));

    function render() {
      const isUnb = arch.value === 'unbundled';
      pipeBox.textContent = isUnb
        ? '$ mysql-cdc --table=products | kafka-topic products | elasticsearch-sink --idempotent'
        : 'SELECT * FROM mysql_remote.orders JOIN elastic_remote.catalog ON ... (Truy vấn xuyên mạng đồng bộ)';

      s1.update(isUnb ? 'Đồng bộ tin cậy qua Log có thứ tự' : 'Không giải quyết đồng bộ ghi!', isUnb ? 'ok' : 'bad',
        isUnb ? 'Giống CREATE INDEX tháo rời khỏi một CSDL đơn' : 'Federated chỉ lo ánh xạ truy vấn đọc');
      s2.update(isUnb ? 'Đọc cục bộ từ đúng View chuyên biệt' : 'Phụ thuộc hệ chậm nhất trong câu truy vấn', isUnb ? 'ok' : 'warn', 'Mỗi view đã được tính sẵn');
      s3.update(isUnb ? 'Lỗi được cô lập (Log giữ hộ tin)' : 'Toàn bộ truy vấn liên hợp thất bại', isUnb ? 'ok' : 'bad', 'Ghép lỏng ở cả mức hệ thống và mức đội ngũ');
    }
    render();
  });

  // =====================================================================
  // 13.7 spreadsheet — Database as a reactive spreadsheet
  // =====================================================================
  widget('spreadsheet', (root) => {
    const priceSl = slider({ label: 'Giá sản phẩm gốc (Ô A1 trong bảng gốc)', min: 10, max: 100, step: 5, value: 40, format: (v) => v + ' $', onInput: onEdit });
    const stockSl = slider({ label: 'Tồn kho gốc (Ô B1)', min: 0, max: 20, step: 1, value: 5, format: (v) => v + ' chiếc', onInput: onEdit });
    const mode = seg({
      label: 'Cơ chế cập nhật View dẫn xuất',
      options: [
        { value: 'reactive', label: 'Dataflow (Đăng ký luồng thay đổi — Tự tính lại như bảng tính)' },
        { value: 'passive', label: 'CSDL thụ động (Bị cũ cho tới khi bấm Poll thủ công)' },
      ],
      value: 'reactive',
      onChange: render,
    });
    const btnPoll = button('Poll thủ công để làm mới các View', () => {
      seenPrice = priceSl.value;
      seenStock = stockSl.value;
      render();
    }, 'ghost');

    let seenPrice = 40, seenStock = 5;
    function onEdit() {
      if (mode.value === 'reactive') {
        seenPrice = priceSl.value;
        seenStock = stockSl.value;
      }
      render();
    }

    const grid = h('div', { class: 'derived-grid' });
    root.append(
      h('div', { class: 'controls' }, priceSl.el, stockSl.el, mode.el),
      h('div', { class: 'btn-row' }, btnPoll),
      grid
    );

    function render() {
      if (mode.value === 'reactive') {
        seenPrice = priceSl.value;
        seenStock = stockSl.value;
      }
      const isStale = seenPrice !== priceSl.value || seenStock !== stockSl.value;
      clear(grid);
      const cards = [
        { title: '1. Search Index', body: `Giá tìm kiếm: ${seenPrice} $ · Trạng thái: ${seenStock > 0 ? 'Còn hàng' : 'Hết hàng'}` },
        { title: '2. Cache Giao diện JSON', body: `{"price_vnd": "${fmt(seenPrice * 25000)} đ", "badge": "${seenStock < 3 ? 'Sắp hết!' : 'Sẵn hàng'}"}` },
        { title: '3. Tổng giá trị tồn kho', body: `Công thức (= A1 × B1): ${seenPrice * seenStock} $` },
      ];
      cards.forEach((c) => {
        grid.appendChild(h('div', { class: 'box flash' + (isStale ? ' stale' : '') },
          h('h5', c.title + (isStale ? ' (ĐANG CŨ!)' : ' (Tươi mới ✓)')),
          h('p', c.body)
        ));
      });
    }
    render();
  });

  // =====================================================================
  // 13.8 fx-rate — Synchronous RPC vs Stream-table join for exchange rates
  // =====================================================================
  widget('fx-rate', (root) => {
    const mode = seg({
      label: 'Cách lấy tỷ giá EUR → USD khi xử lý đơn hàng',
      options: [
        { value: 'stream', label: 'Đăng ký luồng tỷ giá + Tra bảng cục bộ (Dataflow)' },
        { value: 'rpc', label: 'Gọi RPC đồng bộ sang Service tỷ giá cho mỗi đơn' },
      ],
      value: 'stream',
      onChange: render,
    });
    const errRate = slider({ label: 'Tỉ lệ lỗi / timeout của Service tỷ giá từ xa', min: 0, max: 30, step: 5, value: 10, format: (v) => v + '%', onInput: render });

    const s1 = stat('Thời gian xử lý mỗi đơn', '–'), s2 = stat('Số đơn hàng bị thất bại (trong 200 đơn)', '–'), s3 = stat('Khi xử lý lại đơn hôm qua', 'Cần join theo Event Time', 'accent', 'Tra tỷ giá lịch sử tại đúng thời điểm mua');
    root.append(h('div', { class: 'controls' }, mode.el, errRate.el), h('div', { class: 'stats' }, s1, s2, s3));

    function render() {
      const isStream = mode.value === 'stream';
      const failed = isStream ? 0 : Math.round(200 * (errRate.value / 100));
      s1.update(isStream ? '0,05 ms (Đọc cục bộ)' : '18 ms (Chờ mạng RTT)', isStream ? 'ok' : 'warn', 'Request mạng nhanh nhất là request không phải gửi');
      s2.update(`${failed}/200 đơn lỗi`, failed ? 'bad' : 'ok', isStream ? 'Vẫn chạy bằng tỷ giá gần nhất trong DB cục bộ' : 'Chết chùm khi service tỷ giá chập chờn');
    }
    render();
  });

  // =====================================================================
  // 13.9 rw-boundary — Shifting the boundary between Write Path and Read Path
  // =====================================================================
  widget('rw-boundary', (root) => {
    const posSl = slider({ label: 'Vị trí ranh giới (0 = Làm hết lúc Đọc · 100 = Tính trước hết lúc Ghi)', min: 0, max: 100, step: 25, value: 50, format: (v) => v + '%', onInput: render });

    const svg = mkSvg(640, 140, 'Ranh giới giữa Đường Ghi (Eager) và Đường Đọc (Lazy)');
    const layer = s('g'); svg.appendChild(layer);
    const s1 = stat('Cấu trúc tại ranh giới', '–'), s2 = stat('Công việc trên Đường Ghi', '–'), s3 = stat('Công việc trên Đường Đọc', '–');

    root.append(
      h('div', { class: 'controls' }, posSl.el),
      h('div', { class: 'viz' }, svg),
      h('div', { class: 'stats' }, s1, s2, s3)
    );

    function render() {
      clear(layer);
      const p = posSl.value;
      const X0 = 30, X1 = 610, W = X1 - X0;
      const splitX = X0 + (p / 100) * W;

      layer.append(
        R(X0, 40, splitX - X0, 44, 'f-accent-soft s-accent', { rx: 6 }),
        R(splitX, 40, X1 - splitX, 44, 'f-violet-soft s-violet', { rx: 6 }),
        L(splitX, 24, splitX, 102, 's-ink sw2'),
        TM(Math.max(X0 + 65, (X0 + splitX) / 2), 66, 'Đường Ghi (Eager)', 'sm lbl-strong f-accent'),
        TM(Math.min(X1 - 65, (splitX + X1) / 2), 66, 'Đường Đọc (Lazy)', 'sm lbl-strong f-violet')
      );

      const configs = {
        0: ['File Log thô (Không chỉ mục)', 'Chỉ append (~0,1 ms)', 'Quét toàn bộ như grep (~5.000 ms)'],
        25: ['Chỉ mục thứ cấp (Secondary Index)', 'Cập nhật B-tree/LSM (~2 ms)', 'Tra index + Join lúc đọc (~40 ms)'],
        50: ['Inverted Index / Lai ghép Celebrity', 'Tách từ & ghi postings (~5 ms)', 'Giao các danh sách từ (~8 ms)'],
        75: ['Materialized View (Fan-out Timeline)', 'Đẩy vào hộp thư mọi follower (~25 ms)', 'Đọc 1 khoá duy nhất (~1 ms)'],
        100: ['Cache kết quả mọi truy vấn có thể', 'Tốn vô hạn thời gian/dung lượng', 'Tức thời (~0,1 ms)'],
      };
      const [name, wWork, rWork] = configs[p];
      s1.update(name, 'accent', 'Nơi đường ghi gặp đường đọc');
      s2.update(wWork, p === 100 ? 'bad' : 'ok', 'Tính trước khi sự kiện đến');
      s3.update(rWork, p === 0 ? 'bad' : 'ok', 'Tính khi người dùng hỏi');
    }
    render();
  });

  // =====================================================================
  // 13.10 push-offline — Stateful offline-capable client as log subscriber
  // =====================================================================
  widget('push-offline', (root) => {
    let serverLog = ['#0 Khởi tạo tài liệu', '#1 Thêm tiêu đề', '#2 Sửa đoạn mở đầu'];
    let clientOffset = 2;
    let isOffline = false;

    const btnOtherWrite = button('Người khác sửa tài liệu trên Server (+1 Event)', () => {
      serverLog.push(`#${serverLog.length} Cập nhật lúc t=${serverLog.length * 10}s`);
      if (!isOffline) clientOffset = serverLog.length - 1;
      render();
    });
    const btnToggleNet = button('Bật / Tắt mạng trên thiết bị (Offline / Online)', () => {
      isOffline = !isOffline;
      if (!isOffline) clientOffset = serverLog.length - 1; // Catch up from offset!
      render();
    }, 'ghost');

    const s1 = stat('Trạng thái kết nối Thiết bị', '–'),
          s2 = stat('Offset trên Server vs Thiết bị', '–'),
          s3 = stat('Sự kiện cần đọc bù khi có mạng', '–');

    root.append(
      h('div', { class: 'btn-row' }, btnOtherWrite, btnToggleNet),
      h('div', { class: 'stats' }, s1, s2, s3)
    );

    function render() {
      const latest = serverLog.length - 1;
      const lag = latest - clientOffset;
      s1.update(isOffline ? 'OFFLINE (Đang mất mạng)' : 'ONLINE (WebSocket / SSE)', isOffline ? 'warn' : 'ok',
        isOffline ? 'Vẫn đọc/tương tác trên CSDL cục bộ của máy' : 'Đường ghi kéo dài tới tận màn hình');
      s2.update(`Server #${latest} · Client #${clientOffset}`, lag ? 'warn' : 'ok', 'Mỗi thiết bị là 1 consumer giữ offset');
      s3.update(lag ? `${lag} sự kiện (#${clientOffset + 1}..#${latest})` : '0 (Đã đồng bộ 100%)', lag ? 'accent' : 'ok',
        isOffline && lag ? 'Bấm Online lại để tự động đọc bù từ offset #' + (clientOffset + 1) : 'Không cần tải lại toàn bộ trang');
    }
    render();
  });

  // =====================================================================
  // 13.11 reads-events — Reads as events (causal provenance & multi-partition)
  // =====================================================================
  widget('reads-events', (root) => {
    const logItems = [
      { off: 1, kind: 'WRITE', text: 'Kho cập nhật: Máy ảnh X còn 2 chiếc, giao ngày Thứ Sáu' },
      { off: 2, kind: 'READ', text: 'READ_EVENT #r10: Khách An xem trang → thấy "Còn 2 chiếc, giao Thứ Sáu"' },
      { off: 3, kind: 'WRITE', text: 'Kho cập nhật: Hết hàng, dời lịch giao sang tuần sau' },
      { off: 4, kind: 'BUY', text: 'ORDER #o99: Khách An bấm Mua (tham chiếu READ_EVENT #r10)', ref: 2 },
    ];
    let selOff = 4;

    const list = h('div', { class: 'evlist' });
    const s1 = stat('Sự kiện đang chọn', '–'),
          s2 = stat('Khách đã nhìn thấy gì trước khi bấm Mua?', 'Còn 2 chiếc · Giao Thứ Sáu (#r10)', 'ok', 'Nhờ ghi lại cả sự kiện Đọc vào log');

    root.append(list, h('div', { class: 'stats' }, s1, s2));

    function render() {
      clear(list);
      const cur = logItems.find((x) => x.off === selOff);
      logItems.forEach((it) => {
        const isRef = cur && cur.ref === it.off;
        list.appendChild(h('button', {
          type: 'button',
          class: 'ev' + (it.off === selOff ? ' sel' : isRef ? ' ref' : ''),
          onClick: () => { selOff = it.off; render(); },
        }, h('span', { class: 'off' }, '#' + it.off), h('span', it.text)));
      });
      s1.update(`#${cur.off} (${cur.kind})`, 'accent', cur.ref ? `Tham chiếu nhân quả tới #${cur.ref}` : 'Bấm vào ORDER #4 để truy vết');
    }
    render();
  });

  // =====================================================================
  // 13.12 double-pay — End-to-end operation ID vs duplicate form submission
  // =====================================================================
  widget('double-pay', (root) => {
    const mode = seg({
      label: 'Cơ chế chống trùng lặp',
      options: [
        { value: 'e2e', label: 'Có UUID request_id sinh từ Client + Ràng buộc UNIQUE trong CSDL' },
        { value: 'tcp', label: 'Chỉ dựa vào TCP & Giao dịch ACID chuẩn (Ví dụ 12-1)' },
      ],
      value: 'e2e',
      onChange: resetSim,
    });
    let balA = 100, balB = 50, reqTable = [];
    const reqUuid = '0286FDB8-D7E1';

    function sendPayment(isRetry) {
      const isE2E = mode.value === 'e2e';
      if (isE2E && reqTable.includes(reqUuid)) {
        // Deduplicated!
      } else {
        reqTable.push(reqUuid);
        balA -= 11;
        balB += 11;
      }
      render(isRetry);
    }
    function resetSim() {
      balA = 100; balB = 50; reqTable = [];
      sendPayment(false);
    }

    const btnRetry = button('Mạng rớt phản hồi sau COMMIT → Người dùng bấm "Gửi lại biểu mẫu" (Retry)', () => sendPayment(true));
    const btnReset = button('Đặt lại số dư (100 $ / 50 $)', resetSim, 'ghost');

    const s1 = stat('Số dư Tài khoản trả (4321)', '–'),
          s2 = stat('Số dư Tài khoản nhận (1234)', '–'),
          s3 = stat('Trạng thái đúng đắn đầu-cuối', '–');

    root.append(
      mode.el,
      h('div', { class: 'btn-row' }, btnRetry, btnReset),
      h('div', { class: 'stats' }, s1, s2, s3)
    );

    function render(retried) {
      const doubleCharged = balA < 89;
      s1.update(`${balA}.00 $`, doubleCharged ? 'bad' : 'ok', doubleCharged ? 'Bị trừ 22 $ thay vì 11 $!' : 'Đã trừ đúng 11 $');
      s2.update(`${balB}.00 $`, doubleCharged ? 'bad' : 'ok', doubleCharged ? 'Nhận 2 lần tiền!' : 'Đã cộng đúng 11 $');
      s3.update(doubleCharged ? 'SAI LỆCH (Trừ tiền 2 lần!)' : 'Đúng đắn (Idempotent đầu-cuối)', doubleCharged ? 'bad' : 'ok',
        retried ? (doubleCharged ? 'Giao dịch thứ 2 chạy trên kết nối TCP mới nên CSDL không biết là trùng' : `INSERT request_id '${reqUuid}' bị UNIQUE chặn lại`) : 'Đã thực hiện lần gửi đầu tiên (bấm nút Retry để thử)');
    }
    resetSim();
  });

  // =====================================================================
  // 13.13a username-log — Uniqueness constraint via partitioned log
  // =====================================================================
  widget('username-log', (root) => {
    const mode = seg({
      label: 'Kiến trúc kiểm tra trùng Username',
      options: [
        { value: 'log', label: 'Log phân vùng theo hash(username) + Stream Processor tuần tự' },
        { value: 'multileader', label: 'Multi-leader bất đồng bộ (2 datacenter tự quyết độc lập)' },
      ],
      value: 'log',
      onChange: render,
    });

    const s1 = stat('Yêu cầu #1: An đăng ký @ddia (tại DC1)', '–'),
          s2 = stat('Yêu cầu #2: Bình đăng ký @ddia (tại DC2)', '–'),
          s3 = stat('Ràng buộc duy nhất (Uniqueness)', '–');

    root.append(mode.el, h('div', { class: 'stats' }, s1, s2, s3));

    function render() {
      const isLog = mode.value === 'log';
      s1.update('THÀNH CÔNG (@ddia → An)', 'ok', isLog ? 'Vào Partition #2 ở offset 0' : 'Leader DC1 chấp nhận cục bộ');
      s2.update(isLog ? 'TỪ CHỐI (@ddia đã có chủ)' : 'THÀNH CÔNG GIẢ (@ddia → Bình!)', isLog ? 'ok' : 'bad',
        isLog ? 'Vào cùng Partition #2 ở offset 1 → Processor thấy đã có An' : 'Leader DC2 chưa nhận kịp bản sao từ DC1');
      s3.update(isLog ? 'Đảm bảo tuyệt đối' : 'VI PHẠM (2 người cùng giữ 1 username!)', isLog ? 'ok' : 'bad',
        'Ràng buộc duy nhất nghiêm ngặt bắt buộc cần đồng thuận / thứ tự toàn phần trên mỗi khoá');
    }
    render();
  });

  // =====================================================================
  // 13.13b transfer — Multi-partition money transfer without 2PC
  // =====================================================================
  widget('transfer', (root) => {
    const crashProc = checkbox('Cho Stream Processor bị crash và phát lại lệnh Ghi nợ / Ghi có lần 2', true, render);
    const dedup = checkbox('Các Partition tài khoản khử trùng lặp bằng request_id', true, render);

    const s1 = stat('Partition Yêu cầu (Log)', '1 bản ghi nguyên tử (req_88: A→B 11$)', 'ok', 'Không cần 2PC ở bước ghi đầu vào'),
          s2 = stat('Partition Tài khoản A (Ghi nợ)', '–'),
          s3 = stat('Partition Tài khoản B (Ghi có)', '–');

    root.append(crashProc.el, dedup.el, h('div', { class: 'stats' }, s1, s2, s3));

    function render() {
      const cr = crashProc.input.checked, dd = dedup.input.checked;
      const dupBug = cr && !dd;
      s2.update(dupBug ? '-22 $ (Bị trừ 2 lần!)' : '-11 $ (Chuẩn xác)', dupBug ? 'bad' : 'ok',
        dd ? 'Bỏ qua lệnh Debit trùng có cùng req_88' : 'Áp dụng lệnh Debit 2 lần');
      s3.update(dupBug ? '+22 $ (Cộng 2 lần!)' : '+11 $ (Chuẩn xác)', dupBug ? 'bad' : 'ok',
        'Bảo toàn tổng số tiền mà không cần giao thức khoá 2PC xuyên phân vùng');
    }
    render();
  });

  // =====================================================================
  // 13.14 timeliness-2x2 — Timeliness vs Integrity (Credit card statement)
  // =====================================================================
  widget('timeliness-2x2', (root) => {
    let sel = 'tf'; // timeliness violated, integrity intact
    let waited = false;

    const q2 = h('div', { class: 'q2' });
    const btnWait = button('Chờ 24 giờ để hệ thống bất đồng bộ hội tụ', () => { waited = !waited; render(); });
    const s1 = stat('Sao kê thẻ tín dụng hiển thị', '–'),
          s2 = stat('Sau khi chờ 24 giờ', '–'),
          s3 = stat('Bản chất lỗi', '–');

    root.append(q2, h('div', { class: 'btn-row' }, btnWait), h('div', { class: 'stats' }, s1, s2, s3));

    const CELLS = {
      tt: { title: 'Đúng Timeliness + Đúng Integrity', cls: 'good', desc: 'Mọi giao dịch hiện ngay lập tức và tổng số dư khớp tuyệt đối.' },
      tf: { title: 'Vi phạm Timeliness · Giữ nguyên Integrity', cls: 'warnc', desc: 'Giao dịch cà phê hôm qua chưa hiện lên sao kê, nhưng số dư vẫn khớp tổng các dòng đã hiện.' },
      ft: { title: 'Đúng Timeliness · Vi phạm Integrity!', cls: 'badc', desc: 'Giao dịch hiện ngay lập tức, nhưng bạn bị trừ tiền 2 lần hoặc tổng số dư cộng sai!' },
      ff: { title: 'Vi phạm cả Timeliness lẫn Integrity!', cls: 'badc', desc: 'Vừa cập nhật trễ, vừa làm mất tiền hoặc sai lệch sổ cái vĩnh viễn.' },
    };

    function render() {
      clear(q2);
      q2.append(
        h('div', { class: 'hd' }),
        h('div', { class: 'hd' }, 'Integrity ĐÚNG (Toàn vẹn)'),
        h('div', { class: 'hd' }, 'Integrity SAI (Hỏng dữ liệu)'),
        h('div', { class: 'hd' }, 'Timeliness ĐÚNG'),
        mkCell('tt'),
        mkCell('ft'),
        h('div', { class: 'hd' }, 'Timeliness TRỄ'),
        mkCell('tf'),
        mkCell('ff')
      );

      const hasIntegrity = sel === 'tt' || sel === 'tf';
      s1.update(CELLS[sel].title, hasIntegrity ? (sel === 'tt' ? 'ok' : 'warn') : 'bad', CELLS[sel].desc);
      s2.update(hasIntegrity ? 'Khớp hoàn hảo 100%!' : 'VẪN SAI LỆCH VĨNH VIỄN!', hasIntegrity ? 'ok' : 'bad',
        waited ? 'Đang ở thời điểm +24h' : 'Bấm nút Chờ 24 giờ để kiểm chứng');
      s3.update(hasIntegrity ? 'Eventual Consistency (Tự khỏi)' : 'Perpetual Inconsistency (Hỏng vĩnh viễn)', hasIntegrity ? 'ok' : 'bad',
        'Integrity quan trọng hơn Timeliness rất nhiều trong hầu hết ứng dụng');
    }

    function mkCell(k) {
      return h('button', {
        type: 'button',
        class: 'cell ' + CELLS[k].cls,
        'aria-pressed': String(sel === k),
        onClick: () => { sel = k; render(); },
      }, h('b', CELLS[k].title), CELLS[k].desc);
    }
    render();
  });

  // =====================================================================
  // 13.15 overbooking — Loosely interpreted constraints & apology curve
  // =====================================================================
  widget('overbooking', (root) => {
    const ticketsSl = slider({ label: 'Số vé mở bán cho máy bay 100 ghế', min: 95, max: 115, step: 1, value: 105, format: (v) => v + ' vé', onInput: render });
    const coordSl = slider({ label: 'Mức độ ép phối hợp đồng bộ xuyên vùng', min: 0, max: 100, step: 10, value: 30, format: (v) => v + '%', onInput: render });

    const s1 = stat('Số ghế trống lãng phí trung bình', '–'),
          s2 = stat('Lời xin lỗi do Overbook (Bồi thường)', '–'),
          s3 = stat('Tổng lời xin lỗi (Overbook + Sập hệ thống)', '–');

    root.append(
      h('div', { class: 'controls' }, ticketsSl.el, coordSl.el),
      h('div', { class: 'stats' }, s1, s2, s3)
    );

    function render() {
      const sold = ticketsSl.value;
      // Assume ~5% no-show rate -> expected passengers showing up = sold * 0.95
      const showUp = Math.round(sold * 0.95);
      const emptySeats = Math.max(0, 100 - showUp);
      const bumped = Math.max(0, showUp - 100);

      const c = coordSl.value;
      const apologiesInconsistency = Math.round((100 - c) * 0.18);
      const apologiesOutage = Math.round(c * c * 0.0035);
      const totalApologies = apologiesInconsistency + apologiesOutage;

      s1.update(`${emptySeats} ghế trống`, emptySeats > 4 ? 'warn' : 'ok', `Trung bình ${showUp} khách ra sân bay (5% vắng mặt)`);
      s2.update(`${bumped} khách / chuyến`, bumped > 2 ? 'bad' : 'ok', bumped ? 'Giải quyết bằng giao dịch bù: hoàn tiền + nâng hạng' : 'Đủ ghế cho mọi khách');
      s3.update(`${totalApologies} lời xin lỗi / ngày`, totalApologies > 18 ? 'warn' : 'ok',
        `Do xung đột: ${apologiesInconsistency} · Do nghẽn/timeout đồng bộ: ${apologiesOutage}`);
    }
    render();
  });

  // =====================================================================
  // 13.16 merkle — Merkle tree auditing & tampering detection
  // =====================================================================
  widget('merkle', (root) => {
    const baseRecords = ['Tx0: A→B 5$', 'Tx1: C→D 8$', 'Tx2: E→F 2$', 'Tx3: G→H 9$'];
    let tamperedIdx = -1;
    let proofIdx = 1;
    const mode = seg({
      label: 'Chế độ kiểm chứng',
      options: [
        { value: 'tamper', label: 'Phát hiện dữ liệu bị sửa lén / bit-flip' },
        { value: 'proof', label: 'Bằng chứng có mặt (Merkle Inclusion Proof)' },
      ],
      value: 'tamper',
      onChange: render,
    });
    const btnFlip = button('Lật 1 bit trong Tx1 (Giả lập hỏng đĩa / sửa lén)', () => {
      tamperedIdx = tamperedIdx === 1 ? -1 : 1;
      render();
    }, 'danger');

    const svg = mkSvg(640, 195, 'Cây băm Merkle Tree 4 lá');
    const layer = s('g'); svg.appendChild(layer);
    const s1 = stat('Root Hash (Đỉnh cây)', '–'), s2 = stat('Nhánh bị báo đỏ', '–'), s3 = stat('Số hash cần gửi để chứng minh 1 bản ghi', 'O(log N) = 2 hash', 'ok', 'Không cần tải toàn bộ sổ cái');

    root.append(
      h('div', { class: 'btn-row' }, mode.el, btnFlip),
      h('div', { class: 'viz' }, svg),
      h('div', { class: 'stats' }, s1, s2, s3)
    );

    function simpleHash(str) {
      let hVal = 2166136261 >>> 0;
      for (let i = 0; i < str.length; i++) hVal = Math.imul(hVal ^ str.charCodeAt(i), 16777619) >>> 0;
      return hVal.toString(16).slice(0, 6);
    }

    function render() {
      clear(layer);
      const isTamperMode = mode.value === 'tamper';
      const recs = baseRecords.map((r, i) => (i === tamperedIdx ? r.replace('8$', '800$') : r));
      const leafH = recs.map(simpleHash);
      const h01 = simpleHash(leafH[0] + leafH[1]);
      const h23 = simpleHash(leafH[2] + leafH[3]);
      const rootH = simpleHash(h01 + h23);

      const bad01 = tamperedIdx === 0 || tamperedIdx === 1;
      const bad23 = tamperedIdx === 2 || tamperedIdx === 3;
      const badRoot = tamperedIdx >= 0;

      // Draw edges
      layer.append(
        L(320, 44, 180, 92, bad01 ? 's-bad sw2' : 's-line'),
        L(320, 44, 460, 92, bad23 ? 's-bad sw2' : 's-line'),
        L(180, 118, 100, 152, tamperedIdx === 0 ? 's-bad sw2' : 's-line'),
        L(180, 118, 250, 152, tamperedIdx === 1 ? 's-bad sw2' : 's-line'),
        L(460, 118, 390, 152, tamperedIdx === 2 ? 's-bad sw2' : 's-line'),
        L(460, 118, 540, 152, tamperedIdx === 3 ? 's-bad sw2' : 's-line')
      );

      // Root
      layer.append(
        R(240, 14, 160, 30, badRoot ? 'f-bad-soft s-bad' : 'f-ok-soft s-ok', { rx: 6 }),
        TM(320, 34, `Root: 0x${rootH}`, 'sm lbl-strong')
      );
      // Internal nodes
      layer.append(
        R(110, 90, 140, 28, bad01 ? 'f-bad-soft s-bad' : (!isTamperMode && proofIdx >= 2 ? 'f-mark-soft s-warn' : 'f-surface2 s-line'), { rx: 6 }),
        TM(180, 108, `H01: 0x${h01}`, 'sm lbl-strong'),
        R(390, 90, 140, 28, bad23 ? 'f-bad-soft s-bad' : (!isTamperMode && proofIdx < 2 ? 'f-mark-soft s-warn' : 'f-surface2 s-line'), { rx: 6 }),
        TM(460, 108, `H23: 0x${h23}`, 'sm lbl-strong')
      );
      // Leaves
      const lx = [100, 250, 390, 540];
      recs.forEach((txt, i) => {
        const isBad = i === tamperedIdx;
        const isSiblingProof = !isTamperMode && (i === (proofIdx ^ 1));
        const cls = isBad ? 'f-bad-soft s-bad' : isSiblingProof ? 'f-mark-soft s-warn' : 'f-accent-soft s-accent';
        const g = s('g', { style: { cursor: 'pointer' }, onClick: () => {
          if (isTamperMode) tamperedIdx = tamperedIdx === i ? -1 : i;
          else proofIdx = i;
          render();
        } });
        g.append(
          R(lx[i] - 64, 150, 128, 36, cls, { rx: 5 }),
          TM(lx[i], 166, txt, 'sm lbl-strong'),
          TM(lx[i], 180, `0x${leafH[i]}`, 'sm f-ink3')
        );
        layer.append(g);
      });

      s1.update('0x' + rootH, badRoot ? 'bad' : 'ok', badRoot ? 'KHÔNG KHỚP với Root đã ký!' : 'Khớp 100% nguyên bản');
      s2.update(badRoot ? `Root → ${bad01 ? 'H01' : 'H23'} → Tx${tamperedIdx}` : 'Không có lỗi', badRoot ? 'bad' : 'ok', 'Bấm trực tiếp vào ô Tx0..Tx3 để thử sửa');
    }
    render();
  });

  // =====================================================================
  // 13.17a bias-proxy — Proxy discrimination via zip code & historical bias
  // =====================================================================
  widget('bias-proxy', (root) => {
    const segSl = slider({ label: 'Mức độ phân cách khu dân cư theo Mã bưu chính (Zip code correlation)', min: 0, max: 100, step: 10, value: 80, format: (v) => v + '%', onInput: render });
    const histBias = slider({ label: 'Thiên lệch có sẵn trong dữ liệu huấn luyện lịch sử', min: 0, max: 60, step: 10, value: 40, format: (v) => v + '%', onInput: render });

    const bars = h('div', { class: 'hbars' });
    const s1 = stat('Cột "Nhóm/Sắc tộc" trong mô hình', 'ĐÃ BỎ HOÀN TOÀN', 'accent', 'Blind to protected attribute'),
          s2 = stat('Chênh lệch tỉ lệ duyệt vay (Nhóm A vs Nhóm B)', '–'),
          s3 = stat('Nguyên nhân', 'Mã bưu chính đóng vai biến đại diện (Proxy)', 'bad', 'Money laundering for bias');

    root.append(
      h('div', { class: 'controls' }, segSl.el, histBias.el),
      bars,
      h('div', { class: 'stats' }, s1, s2, s3)
    );

    function render() {
      clear(bars);
      const corr = segSl.value / 100, hb = histBias.value / 100;
      const rateA = 75;
      const rateB = Math.round(75 - 65 * corr * hb);
      const gap = rateA - rateB;

      const mkBar = (lbl, val, cls) => h('div', { class: 'hbar' },
        h('span', lbl),
        h('div', { class: 'track' }, h('div', { class: 'fill ' + cls, style: { width: val + '%' } })),
        h('span', { class: 'v' }, val + '%')
      );
      bars.append(
        mkBar('Nhóm A (Năng lực trả nợ 80%)', rateA, 'ok'),
        mkBar('Nhóm B (Năng lực trả nợ cũng 80%!)', rateB, gap > 10 ? 'bad' : 'ok')
      );

      s2.update(`${rateA}% vs ${rateB}% (Lệch ${gap}%)`, gap > 10 ? 'bad' : 'ok',
        gap > 10 ? 'Mô hình học lại định kiến lịch sử qua mã vùng' : 'Công bằng giữa hai nhóm');
    }
    render();
  });

  // =====================================================================
  // 13.17b feedback-spiral — Self-reinforcing feedback loop (credit score & jobs)
  // =====================================================================
  widget('feedback-spiral', (root) => {
    const useCreditInHiring = checkbox('Nhà tuyển dụng dùng Điểm tín dụng để loại hồ sơ xin việc (Vòng phản hồi)', true, render);
    const penaltySl = slider({ label: 'Số điểm bị trừ mỗi tháng trễ hạn hoá đơn', min: 10, max: 40, step: 5, value: 25, format: (v) => '-' + v + ' điểm', onInput: render });

    const svg = mkSvg(640, 175, 'Vòng xoáy điểm tín dụng và cơ hội việc làm qua 12 tháng');
    const layer = s('g'); svg.appendChild(layer);
    const s1 = stat('Điểm tín dụng sau 12 tháng', '–'),
          s2 = stat('Tỉ lệ tìm lại được việc làm', '–'),
          s3 = stat('Hiệu ứng hệ thống', '–');

    root.append(
      useCreditInHiring.el,
      h('div', { class: 'controls' }, penaltySl.el),
      h('div', { class: 'viz' }, svg),
      h('div', { class: 'stats' }, s1, s2, s3)
    );

    function render() {
      clear(layer);
      const loopOn = useCreditInHiring.input.checked;
      const pen = penaltySl.value;
      const X0 = 55, X1 = 615, Y0 = 150, Y1 = 22;
      const x = (m) => X0 + ((m - 1) / 11) * (X1 - X0);
      const y = (sc) => Y0 - ((sc - 300) / 500) * (Y0 - Y1);

      layer.append(L(X0, Y0, X1, Y0, 'axis'), L(X0, y(620), X1, y(620), 's-warn dash'), T(X0 + 6, y(620) - 6, 'Ngưỡng lọc hồ sơ tuyển dụng (620 điểm)', 'sm f-warn'));

      let scoreLoop = 720, scoreNoLoop = 720;
      let dLoop = `M${x(1)},${y(720)}`, dNo = `M${x(1)},${y(720)}`;
      for (let m = 2; m <= 12; m++) {
        if (m >= 3 && m <= 5) {
          scoreLoop = Math.max(350, scoreLoop - pen);
          scoreNoLoop = Math.max(350, scoreNoLoop - pen);
        } else if (m > 5) {
          // Without credit filter in hiring, person finds job around month 6 and recovers
          scoreNoLoop = Math.min(740, scoreNoLoop + 22);
          // With credit filter, if score dropped below 620, they get rejected from jobs and keep spiraling down!
          if (scoreLoop < 620) scoreLoop = Math.max(350, scoreLoop - pen * 0.8);
          else scoreLoop = Math.min(740, scoreLoop + 20);
        }
        dLoop += ` L${x(m)},${y(scoreLoop)}`;
        dNo += ` L${x(m)},${y(scoreNoLoop)}`;
      }

      layer.append(
        s('path', { d: dNo, class: 'f-none s-ok sw2' }),
        s('path', { d: dLoop, class: 'f-none s-bad sw2' })
      );

      const finalScore = Math.round(loopOn ? scoreLoop : scoreNoLoop);
      s1.update(`${finalScore} điểm`, finalScore < 600 ? 'bad' : 'ok', 'Bắt đầu từ 720 điểm trước biến cố tháng 3');
      s2.update(finalScore < 600 ? '12% (Bị kẹt thất nghiệp)' : '88% (Phục hồi bình thường)', finalScore < 600 ? 'bad' : 'ok', 'Khi điểm thấp chặn mất nguồn thu nhập để trả nợ');
      s3.update(loopOn ? 'Vòng phản hồi khuếch đại bất công!' : 'Tách biệt tín dụng và tuyển dụng', loopOn ? 'bad' : 'ok', 'Cần tư duy hệ thống (Systems thinking)');
    }
    render();
  });

  // =====================================================================
  // 13.18 surveillance-rewrite — Thought experiment: replace "data" with "surveillance"
  // =====================================================================
  widget('surveillance-rewrite', (root) => {
    const SAMPLES = [
      {
        en: 'In our data-driven organization, we collect data from every device, store it in our data warehouse, and our data scientists build data-intensive applications.',
        vi: 'Trong tổ chức hướng dữ liệu của chúng tôi, chúng tôi thu thập dữ liệu từ mọi thiết bị, lưu vào kho dữ liệu, và các nhà khoa học dữ liệu xây dựng các ứng dụng chuyên sâu dữ liệu.',
      },
      {
        en: 'Big data is the new oil: monetizing user data streams gives our data platform a strong competitive moat.',
        vi: 'Dữ liệu lớn là dầu mỏ mới: kiếm tiền từ luồng dữ liệu người dùng giúp nền tảng dữ liệu của chúng ta có lợi thế cạnh tranh mạnh.',
      },
    ];
    let sampleIdx = 0;
    const replaceOn = checkbox('Thay thế "data / dữ liệu" → "surveillance / giám sát" (Thí nghiệm tư duy của Bernstein & Kleppmann)', true, render);
    const pick = seg({
      label: 'Câu mẫu',
      options: [{ value: 0, label: 'Câu mẫu #1 (Data-driven org)' }, { value: 1, label: 'Câu mẫu #2 (Big data is the new oil)' }],
      value: 0,
      onChange: (v) => { sampleIdx = v; render(); },
    });

    const box = h('div', { class: 'rewrite' });
    root.append(h('div', { class: 'controls' }, pick.el), replaceOn.el, box);

    function render() {
      const sObj = SAMPLES[sampleIdx];
      const on = replaceOn.input.checked;
      const en = on
        ? sObj.en.replace(/\bdata\b/gi, '<mark>surveillance</mark>')
        : sObj.en;
      const vi = on
        ? sObj.vi.replace(/dữ liệu/gi, '<mark>giám sát</mark>')
        : sObj.vi;
      box.innerHTML = `<p><b>EN:</b> ${en}</p><p><b>VI:</b> ${vi}</p>`;
    }
    render();
  });

  // =====================================================================
  // 13.19 data-hazard — Data as toxic asset / hazardous material
  // =====================================================================
  widget('data-hazard', (root) => {
    const FIELDS = [
      { id: 'addr', label: 'Địa chỉ giao đồ ăn hiện tại (Cần cho dịch vụ)', needed: true, risk: 10 },
      { id: 'order', label: 'Món ăn trong đơn hàng (Cần cho dịch vụ)', needed: true, risk: 5 },
      { id: 'gps247', label: 'Toạ độ GPS nền 24/7 kể cả khi không mở app', needed: false, risk: 35 },
      { id: 'contacts', label: 'Toàn bộ Danh bạ điện thoại của người dùng', needed: false, risk: 25 },
      { id: 'mic', label: 'Bản ghi âm micro nền và lịch sử duyệt web', needed: false, risk: 40 },
    ];
    const checked = { addr: true, order: true, gps247: true, contacts: false, mic: false };
    const retYears = slider({ label: 'Thời gian lưu trữ trước khi xoá (Retention / Purge)', min: 1, max: 10, step: 1, value: 5, format: (v) => v + ' năm', onInput: render });

    const fieldList = h('div', { class: 'fieldlist' });
    FIELDS.forEach((f) => {
      const cb = checkbox(f.label, checked[f.id], (val) => { checked[f.id] = val; render(); });
      fieldList.appendChild(cb.el);
    });

    const s1 = stat('Trường thu thập vượt mục đích', '–'),
          s2 = stat('Xác suất rò rỉ tích luỹ qua thời gian lưu', '–'),
          s3 = stat('Đánh giá mức độ độc hại (Toxic Asset)', '–');

    root.append(
      fieldList,
      h('div', { class: 'controls' }, retYears.el),
      h('div', { class: 'stats' }, s1, s2, s3)
    );

    function render() {
      const active = FIELDS.filter((f) => checked[f.id]);
      const excess = active.filter((f) => !f.needed);
      const yrs = retYears.value;
      // 8% annual breach probability
      const breachProb = 1 - Math.pow(0.92, yrs);
      const hazardScore = active.reduce((acc, f) => acc + f.risk, 0) * (0.5 + yrs * 0.15);

      s1.update(`${excess.length} trường thừa`, excess.length ? 'bad' : 'ok',
        excess.length ? 'Vi phạm nguyên tắc tối thiểu hoá dữ liệu (Data minimization)' : 'Chỉ thu thập đúng những gì cần để giao đồ ăn');
      s2.update(pct(breachProb, 1), breachProb > 0.25 ? 'warn' : 'ok', `Trong suốt ${yrs} năm lưu trữ`);
      s3.update(hazardScore > 45 ? 'NGUY HIỂM CAO!' : 'Trong tầm kiểm soát', hazardScore > 45 ? 'bad' : 'ok',
        'Dữ liệu chưa bao giờ thu thập là dữ liệu không bao giờ bị đánh cắp hay lạm dụng');
    }
    render();
  });

  // =====================================================================
  // Glossary for Chapter 13
  // =====================================================================
  glossary.add([
    { key: 'system-of-record', term: 'System of record', vi: 'Hệ thống ghi nhận gốc', ch: 13, topic: 'ch13-derived',
      def: 'Nơi dữ liệu được ghi vào đầu tiên và giữ vai trò nguồn chân lý có thẩm quyền để từ đó dẫn xuất ra mọi biểu diễn khác.' },
    { key: 'derived-data', term: 'Derived data', vi: 'Dữ liệu dẫn xuất', ch: 13, topic: 'ch13-derived',
      def: 'Các chỉ mục tìm kiếm, materialized view, cache, mô hình học máy được tạo ra một cách tất định từ hệ thống ghi nhận qua log.' },
    { key: 'cdc', term: 'Change Data Capture (CDC)', vi: 'Bắt giữ dữ liệu thay đổi', ch: 13, topic: 'ch13-derived',
      def: 'Cơ chế quan sát mọi thay đổi trong CSDL nguồn và phát ra thành một luồng sự kiện có thứ tự để cập nhật các hệ dẫn xuất.' },
    { key: 'event-sourcing', term: 'Event sourcing', vi: 'Lưu trữ nguồn bằng sự kiện', ch: 13, topic: 'ch13-derived',
      def: 'Mô hình ghi nhận mọi hành động ở tầng ứng dụng thành các sự kiện bất biến trong nhật ký và dẫn xuất trạng thái hiện tại từ đó.' },
    { key: 'dual-writes', term: 'Dual writes', vi: 'Ghi kép trực tiếp', ch: 13, topic: 'ch13-ordering',
      def: 'Mẫu phản kiến trúc trong đó code ứng dụng tự ghi song song vào hai hệ lưu trữ mà không có bộ quyết định thứ tự chung.' },
    { key: 'total-order-broadcast', term: 'Total order broadcast', vi: 'Phát quảng bá thứ tự toàn phần', ch: 13, topic: 'ch13-ordering',
      def: 'Việc đưa mọi thay đổi đi qua một log chung để đảm bảo mọi hệ thống dẫn xuất đều nhận và áp dụng các sự kiện theo đúng một thứ tự.' },
    { key: 'idempotence', term: 'Idempotence', vi: 'Tính luỹ đẳng', ch: 13, topic: 'ch13-ordering',
      def: 'Tính chất cho phép thực hiện lặp lại một thao tác ghi nhiều lần mà kết quả vẫn giống hệt như thực hiện một lần.' },
    { key: 'distributed-transaction', term: 'Distributed transaction', vi: 'Giao dịch phân tán', ch: 13, topic: 'ch13-ordering',
      def: 'Giao dịch phối hợp đồng bộ nhiều node hoặc nhiều hệ thống khác loại (như 2PC/XA), đảm bảo tính nguyên tử nhưng dễ khuếch đại lỗi.' },
    { key: 'consensus', term: 'Consensus', vi: 'Đồng thuận phân tán', ch: 13, topic: 'ch13-ordering',
      def: 'Bài toán để nhiều node thống nhất không mơ hồ về thứ tự sự kiện hoặc về việc chấp nhận/từ chối một giá trị duy nhất.' },
    { key: 'causal-dependency', term: 'Causal dependency', vi: 'Phụ thuộc nhân quả', ch: 13, topic: 'ch13-causality',
      def: 'Mối quan hệ trong đó sự kiện B xảy ra sau khi người dùng hoặc hệ thống đã quan sát thấy sự kiện A (ví dụ: huỷ kết bạn rồi mới nhắn tin).' },
    { key: 'logical-timestamp', term: 'Logical timestamp', vi: 'Dấu thời gian logic', ch: 13, topic: 'ch13-causality',
      def: 'Bộ đếm tăng dần (như đồng hồ Lamport hay version vector) dùng để nắm bắt quan hệ nhân quả thay vì dựa vào đồng hồ vật lý.' },
    { key: 'reprocessing', term: 'Data reprocessing', vi: 'Xử lý lại dữ liệu lịch sử', ch: 13, topic: 'ch13-reprocessing',
      def: 'Việc chạy lại code mới trên toàn bộ tập sự kiện bất biến từ đầu để tạo ra một view mới hoặc sửa lỗi dữ liệu do bug cũ.' },
    { key: 'gradual-migration', term: 'Gradual migration', vi: 'Chuyển đổi tiệm tiến song song', ch: 13, topic: 'ch13-reprocessing',
      def: 'Chiến lược duy trì song song cả view theo schema cũ lẫn view theo schema mới từ cùng một log để dịch chuyển người dùng dần dần và luôn có thể quay lui.' },
    { key: 'lambda-architecture', term: 'Lambda architecture', vi: 'Kiến trúc Lambda', ch: 13, topic: 'ch13-lambda',
      def: 'Đề xuất kết hợp một đường xử lý luồng nhanh nhưng xấp xỉ (speed layer) với một đường xử lý lô chậm nhưng chính xác (batch layer) trên cùng nguồn sự kiện.' },
    { key: 'exactly-once', term: 'Exactly-once semantics', vi: 'Ngữ nghĩa đúng một lần', ch: 13, topic: 'ch13-lambda',
      def: 'Đảm bảo rằng kết quả tính toán cuối cùng không bị sai lệch hay nhân đôi ngay cả khi tác vụ bị lỗi và phải chạy lại.' },
    { key: 'event-time', term: 'Event time', vi: 'Thời gian sự kiện xảy ra', ch: 13, topic: 'ch13-lambda',
      def: 'Việc chia cửa sổ và xử lý dựa trên dấu thời gian lúc sự việc thực sự diễn ra, cho phép dùng cùng một engine cho cả dữ liệu lịch sử lẫn luồng trực tiếp.' },
    { key: 'federated-database', term: 'Federated database (polystore)', vi: 'Cơ sở dữ liệu liên bang (hợp nhất đọc)', ch: 13, topic: 'ch13-unbundling',
      def: 'Hệ thống cung cấp một giao diện truy vấn đọc thống nhất đứng trước nhiều bộ máy lưu trữ khác loại bên dưới.' },
    { key: 'unbundling', term: 'Unbundling databases', vi: 'Tháo rời cơ sở dữ liệu (hợp nhất ghi)', ch: 13, topic: 'ch13-unbundling',
      def: 'Triết lý tách các thành phần của CSDL (nhật ký giao dịch, bộ duy trì chỉ mục, materialized view) thành các hệ thống độc lập được đồng bộ ghi qua luồng sự kiện.' },
    { key: 'materialized-view', term: 'Materialized view', vi: 'Khung nhìn vật lý hoá', ch: 13, topic: 'ch13-unbundling',
      def: 'Bản kết quả truy vấn được tính trước và cập nhật liên tục ở đường ghi để phục vụ đường đọc nhanh chóng.' },
    { key: 'database-inside-out', term: 'Turning the database inside-out', vi: 'Lộn ngược cơ sở dữ liệu ra ngoài', ch: 13, topic: 'ch13-dataflow-apps',
      def: 'Cách hình dung toàn bộ kiến trúc dữ liệu của một tổ chức như một siêu CSDL trong đó event log là WAL và các stream processor là bộ cập nhật chỉ mục/view.' },
    { key: 'derivation-function', term: 'Derivation function', vi: 'Hàm dẫn xuất dữ liệu', ch: 13, topic: 'ch13-dataflow-apps',
      def: 'Đoạn code ứng dụng hoặc toán tử luồng nhận đầu vào là các thay đổi từ log gốc để tính ra trạng thái mới của chỉ mục, cache hoặc mô hình ML.' },
    { key: 'polling', term: 'Polling', vi: 'Hỏi thăm định kỳ', ch: 13, topic: 'ch13-dataflow-apps',
      def: 'Việc client phải tự lặp lại câu truy vấn vì CSDL truyền thống không hỗ trợ đăng ký nhận thông báo khi kết quả truy vấn thay đổi.' },
    { key: 'stream-table-join', term: 'Stream-table join', vi: 'Kết nối luồng với bảng cục bộ', ch: 13, topic: 'ch13-stream-services',
      def: 'Mẫu kiến trúc thay thế lệnh gọi RPC đồng bộ giữa các microservice bằng cách đăng ký luồng thay đổi và tra cứu bản sao cục bộ.' },
    { key: 'time-dependent-join', term: 'Time-dependent join', vi: 'Phép kết nối phụ thuộc thời gian', ch: 13, topic: 'ch13-stream-services',
      def: 'Phép join mà kết quả phụ thuộc vào phiên bản trạng thái tại đúng thời điểm sự kiện diễn ra (như tỷ giá tiền tệ hay thuế suất lúc mua hàng).' },
    { key: 'write-path', term: 'Write path', vi: 'Đường ghi (tính trước / Eager)', ch: 13, topic: 'ch13-read-write-path',
      def: 'Toàn bộ chuỗi xử lý được kích hoạt sẵn ngay từ lúc dữ liệu được ghi vào hệ thống cho tới khi cập nhật xong các view dẫn xuất.' },
    { key: 'read-path', term: 'Read path', vi: 'Đường đọc (tính khi hỏi / Lazy)', ch: 13, topic: 'ch13-read-write-path',
      def: 'Chuỗi xử lý chỉ diễn ra khi có người dùng gửi yêu cầu đọc và kết thúc khi trả kết quả về cho họ.' },
    { key: 'offline-first', term: 'Offline-first application', vi: 'Ứng dụng ưu tiên hoạt động ngoại tuyến', ch: 13, topic: 'ch13-clients',
      def: 'Ứng dụng đọc và ghi trực tiếp trên cơ sở dữ liệu cục bộ của thiết bị người dùng, sau đó đồng bộ ngầm với server khi có kết nối mạng.' },
    { key: 'consumer-offset', term: 'Consumer offset', vi: 'Vị trí đọc luồng của thiết bị', ch: 13, topic: 'ch13-clients',
      def: 'Con số đánh dấu sự kiện cuối cùng mà thiết bị khách đã nhận được trước khi mất mạng, dùng để đọc bù chính xác khi kết nối lại.' },
    { key: 'data-provenance', term: 'Data provenance (lineage)', vi: 'Truy vết nguồn gốc dữ liệu', ch: 13, topic: 'ch13-reads-events',
      def: 'Khả năng xác định chính xác một quyết định hoặc trạng thái đã được hình thành từ những sự kiện đầu vào và những lần đọc nào.' },
    { key: 'operation-id', term: 'End-to-end operation ID (request ID)', vi: 'Định danh thao tác đầu-cuối', ch: 13, topic: 'ch13-end-to-end',
      def: 'Mã UUID duy nhất được sinh ngay tại giao diện người dùng và truyền xuyên suốt mọi tầng tới tận CSDL để khử trùng lặp tuyệt đối.' },
    { key: 'end-to-end-argument', term: 'End-to-end argument', vi: 'Lập luận đầu-cuối (Saltzer, Reed, Clark)', ch: 13, topic: 'ch13-end-to-end',
      def: 'Nguyên lý thiết kế hệ thống phát biểu rằng tính đúng đắn hoàn chỉnh (như chống trùng lặp hay kiểm tra toàn vẹn) chỉ có thể đạt được nhờ sự tham gia của hai điểm đầu-cuối ứng dụng.' },
    { key: 'uniqueness-constraint', term: 'Uniqueness constraint', vi: 'Ràng buộc duy nhất', ch: 13, topic: 'ch13-constraints',
      def: 'Yêu cầu đảm bảo không có hai bản ghi nào mang cùng một giá trị khoá (như username, email), đòi hỏi phân vùng theo khoá đó và xử lý tuần tự.' },
    { key: 'multi-partition-request', term: 'Multi-partition request processing', vi: 'Xử lý yêu cầu đa phân vùng qua luồng', ch: 13, topic: 'ch13-constraints',
      def: 'Kỹ thuật thực hiện giao dịch chạm nhiều phân vùng mà không cần 2PC bằng cách ghi một sự kiện yêu cầu nguyên tử rồi dẫn xuất các lệnh con tất định kèm request ID.' },
    { key: 'timeliness', term: 'Timeliness', vi: 'Tính kịp thời (độ tươi mới)', ch: 13, topic: 'ch13-integrity',
      def: 'Khía cạnh của tính nhất quán đảm bảo người dùng quan sát thấy trạng thái mới nhất; vi phạm timeliness chỉ là tạm thời (eventual consistency).' },
    { key: 'integrity', term: 'Integrity', vi: 'Tính toàn vẹn (không sai hỏng)', ch: 13, topic: 'ch13-integrity',
      def: 'Khía cạnh của tính nhất quán đảm bảo dữ liệu không bị mất, nhân đôi hay mâu thuẫn nội tại; vi phạm integrity gây sai lệch vĩnh viễn (perpetual inconsistency).' },
    { key: 'compensating-transaction', term: 'Compensating transaction (apology)', vi: 'Giao dịch bù trừ (xin lỗi & hoàn trả)', ch: 13, topic: 'ch13-loose',
      def: 'Hành động nghiệp vụ được thực hiện sau để khắc phục khi hệ thống chấp nhận ghi lạc quan và phát hiện vi phạm ràng buộc (như hoàn tiền, nâng hạng vé).' },
    { key: 'coordination-avoiding', term: 'Coordination-avoiding data system', vi: 'Hệ thống dữ liệu tránh phối hợp đồng bộ', ch: 13, topic: 'ch13-loose',
      def: 'Hệ thống phân tán duy trì tính toàn vẹn mạnh nhưng giảm thiểu việc khoá/chờ đồng bộ trên đường đi của request, xử lý xung đột bất đồng bộ qua giao dịch bù.' },
    { key: 'rowhammer', term: 'Rowhammer', vi: 'Kỹ thuật lật bit RAM Rowhammer', ch: 13, topic: 'ch13-verify',
      def: 'Hiện tượng vật lý trong đó việc truy cập lặp đi lặp lại vào một hàng ô nhớ DRAM làm nhiễu điện từ và lật bit ở hàng ô nhớ kế cận.' },
    { key: 'auditing', term: 'Auditing (end-to-end verification)', vi: 'Kiểm toán đối soát dữ liệu', ch: 13, topic: 'ch13-verify',
      def: 'Thực hành định kỳ đọc lại dữ liệu, chạy lại pipeline dẫn xuất và kiểm tra tổng băm để phát hiện lỗi phần cứng âm thầm hoặc bug phần mềm.' },
    { key: 'merkle-tree', term: 'Merkle tree (hash tree)', vi: 'Cây băm mật mã Merkle', ch: 13, topic: 'ch13-verify',
      def: 'Cấu trúc cây nhị phân các mã băm cho phép kiểm chứng nhanh tính toàn vẹn và chứng minh một bản ghi có mặt trong tập dữ liệu với chi phí O(log N).' },
    { key: 'predictive-analytics', term: 'Predictive analytics', vi: 'Phân tích dự đoán hành vi con người', ch: 13, topic: 'ch13-predictive',
      def: 'Việc dùng thuật toán học máy để chấm điểm và dự đoán rủi ro cá nhân (như vỡ nợ, tái phạm, xin việc), mang nguy cơ rập khuôn và tước đoạt cơ hội.' },
    { key: 'algorithmic-prison', term: 'Algorithmic prison', vi: 'Nhà tù thuật toán', ch: 13, topic: 'ch13-predictive',
      def: 'Tình trạng một cá nhân bị các hệ thống chấm điểm tự động từ chối hàng loạt quyền lợi xã hội mà không có bằng chứng cụ thể và không có quyền kháng nghị.' },
    { key: 'feedback-loop', term: 'Self-reinforcing feedback loop', vi: 'Vòng phản hồi tự củng cố', ch: 13, topic: 'ch13-predictive',
      def: 'Hiện tượng đầu ra của thuật toán tác động lên cuộc sống con người theo cách tạo ra dữ liệu mới củng cố thêm định kiến ban đầu của chính thuật toán đó.' },
    { key: 'systems-thinking', term: 'Systems thinking', vi: 'Tư duy hệ thống tổng thể', ch: 13, topic: 'ch13-predictive',
      def: 'Cách phân tích không chỉ nhìn vào đoạn code phần mềm mà xét cả các vòng tương tác ngược chiều giữa công nghệ, con người và xã hội.' },
    { key: 'surveillance', term: 'Surveillance-driven architecture', vi: 'Hạ tầng thu thập dữ liệu mang tính giám sát', ch: 13, topic: 'ch13-privacy',
      def: 'Hệ thống kinh doanh dựa trên việc theo dõi chi tiết mọi hành vi của người dùng để phục vụ lợi ích của bên thứ ba (như nhà quảng cáo) thay vì chính người dùng.' },
    { key: 'data-exhaust', term: 'Data exhaust', vi: 'Khí thải dữ liệu hành vi', ch: 13, topic: 'ch13-data-power',
      def: 'Cách gọi giảm nhẹ cho các dấu vết kỹ thuật số phát sinh khi người dùng sử dụng dịch vụ, thực chất là tài sản cốt lõi của mô hình kinh doanh quảng cáo.' },
    { key: 'data-broker', term: 'Data broker', vi: 'Bên môi giới dữ liệu cá nhân', ch: 13, topic: 'ch13-data-power',
      def: 'Các công ty chuyên thu mua, ghép nối, suy luận và bán lại hồ sơ dữ liệu cá nhân chi tiết của hàng triệu người mà họ thường không hề hay biết.' },
  ]);
})();
