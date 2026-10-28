(function () {
  const { h, s, clear, fmt, fmtMs, pct, clamp, sleep,
          slider, seg, button, checkbox, stat, log, jsonHTML, widget, glossary, reducedMotion } = window.DDIA;

  // ---------- shared helpers ----------
  const svgEl = (w, ht) => s('svg', { viewBox: `0 0 ${w} ${ht}`, role: 'img' });

  function boxNode(parent, x, y, w, ht, label, opt) {
    const o = opt || {};
    const g = s('g', { class: 'node' + (o.click ? ' clickable' : '') });
    g.append(s('rect', {
      x, y, width: w, height: ht, rx: o.rx == null ? 8 : o.rx,
      class: (o.fill || 'f-surface') + ' ' + (o.stroke || 's-line') + (o.dash ? ' dash' : ''),
      'stroke-width': o.sw || 1.5,
    }));
    const lines = Array.isArray(label) ? label : [label];
    const fs = o.fs || 11;
    const top = y + ht / 2 - ((lines.length - 1) * (fs + 3)) / 2 + fs * 0.36;
    lines.forEach((t, i) => g.append(s('text', {
      x: x + w / 2, y: top + i * (fs + 3), 'text-anchor': 'middle', 'font-size': fs,
      class: i === 0 && !o.plain ? 'lbl-strong' : '',
    }, t)));
    if (o.click) {
      g.setAttribute('tabindex', '0');
      g.addEventListener('click', o.click);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); o.click(); } });
    }
    parent.append(g);
    return g;
  }

  function arrow(parent, x1, y1, x2, y2, tone, opt) {
    const o = opt || {};
    const t = tone || 'ink3';
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const L = 8;
    parent.append(s('line', {
      x1, y1, x2: x2 - Math.cos(ang) * 3, y2: y2 - Math.sin(ang) * 3,
      class: 'f-none s-' + t + (o.dash ? ' dash' : ''), 'stroke-width': o.sw || 1.6,
    }));
    const p1 = [x2 - L * Math.cos(ang - 0.42), y2 - L * Math.sin(ang - 0.42)];
    const p2 = [x2 - L * Math.cos(ang + 0.42), y2 - L * Math.sin(ang + 0.42)];
    parent.append(s('polygon', { points: `${x2},${y2} ${p1.join(',')} ${p2.join(',')}`, class: 'f-' + t }));
    if (o.label) {
      parent.append(s('text', {
        x: (x1 + x2) / 2 + (o.dx || 0), y: (y1 + y2) / 2 + (o.dy == null ? -6 : o.dy),
        'text-anchor': 'middle', 'font-size': o.fs || 10,
      }, o.label));
    }
  }

  function txt(parent, x, y, t, opt) {
    const o = opt || {};
    const el = s('text', { x, y, 'text-anchor': o.anchor || 'middle', 'font-size': o.fs || 11, class: o.cls || '' }, t);
    parent.append(el);
    return el;
  }

  function labeled(label, el) {
    return h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, label), el);
  }

  function selectCtl(label, options, value, onChange) {
    const sel = h('select', { 'aria-label': label });
    options.forEach((o) => sel.append(h('option', { value: o.value }, o.label)));
    sel.value = value;
    sel.addEventListener('change', () => onChange(sel.value));
    return { el: h('label', { class: 'ch2-sel' }, label, sel), sel };
  }

  const pill = (text, tone) => h('span', { class: 'pill' + (tone ? ' ' + tone : '') }, text);
  const viz = (svg) => h('div', { class: 'viz' }, svg);
  const tableWrap = (head, rows) => h('div', { class: 'table-wrap' },
    h('table', { class: 'data' },
      h('thead', h('tr', head.map((c) => h('th', c)))),
      h('tbody', rows)));

  // =====================================================================
  // 2.1 Information hiding — exposed details become assumptions
  // =====================================================================
  widget('ch2-assumptions', (root) => {
    const DETAILS = [
      { id: 'db', name: 'Tên bảng & cột trong DB', ex: 'customer_tbl.email_addr', users: ['Notifications', 'Loyalty'], change: 'Đổi tên cột email_addr → email' },
      { id: 'id', name: 'Định dạng ID nội bộ', ex: 'số tự tăng: 1, 2, 3…', users: ['Order Processor', 'Loyalty'], change: 'Chuyển ID sang UUID' },
      { id: 'lang', name: 'Ngôn ngữ & thư viện client dùng chung', ex: 'Java + customer-client.jar', users: ['Order Processor'], change: 'Viết lại service bằng Kotlin' },
      { id: 'tier', name: 'Thuật toán xếp hạng thành viên', ex: 'tổng chi tiêu 12 tháng', users: ['Loyalty'], change: 'Tính hạng theo 6 tháng gần nhất' },
      { id: 'cache', name: 'Bộ nhớ đệm nội bộ', ex: 'Redis key cust:{id}', users: ['Notifications'], change: 'Bỏ Redis, dùng cache trong tiến trình' },
      { id: 'down', name: 'Service mà Customer gọi tiếp', ex: 'Customer → Address Lookup', users: ['Order Processor'], change: 'Tự lưu địa chỉ, bỏ Address Lookup' },
    ];
    const exposed = new Set(['db', 'id']);
    const sConn = stat('Số giả định (kết nối)', '0');
    const sFree = stat('Thay đổi triển khai độc lập', '0/6');
    const sCons = stat('Consumer bị kéo theo', '0');
    const list = h('div', { class: 'ch2-list' });
    const tbody = h('tbody');
    const items = DETAILS.map((d) => {
      const cb = checkbox('Lộ ra cho consumer', exposed.has(d.id), (v) => { v ? exposed.add(d.id) : exposed.delete(d.id); render(); });
      const who = h('small');
      const el = h('div', { class: 'ch2-item' }, h('b', d.name), h('small', 'Ví dụ: ', h('code', d.ex)), cb.el, who);
      list.append(el);
      return { d, el, cb, who };
    });
    const allBtns = h('div', { class: 'btn-row' },
      button('Giấu tất cả chi tiết', () => { exposed.clear(); items.forEach((i) => (i.cb.input.checked = false)); render(); }),
      button('Lộ tất cả', () => { DETAILS.forEach((d) => exposed.add(d.id)); items.forEach((i) => (i.cb.input.checked = true)); render(); }, 'ghost'));
    root.append(
      h('p', { class: 'lab-note' }, 'Hợp đồng công khai luôn chia sẻ: ', h('code', 'GET /customers/{id} → { id, name, email }'), '. Mọi thứ khác là chi tiết nội bộ.'),
      list, allBtns,
      h('div', { class: 'stats' }, sConn, sFree, sCons),
      h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
        h('thead', h('tr', h('th', 'Thay đổi nội bộ dự kiến'), h('th', 'Kết quả'))), tbody)));

    function render() {
      let conn = 0, free = 0;
      const cons = new Set();
      clear(tbody);
      items.forEach(({ d, el, who }) => {
        const on = exposed.has(d.id);
        el.classList.toggle('hit', on);
        who.textContent = on ? 'Consumer đang giả định điều này: ' + d.users.join(', ') : 'Đang được giấu sau ranh giới.';
        if (on) { conn += d.users.length; d.users.forEach((u) => cons.add(u)); } else free++;
        tbody.append(h('tr', h('td', d.change),
          h('td', on ? [pill('Phải phối hợp', 'bad'), ' ', d.users.join(', ') + ' phải sửa theo'] : pill('Triển khai riêng Customer', 'ok'))));
      });
      sConn.update(String(conn), conn === 0 ? 'ok' : conn > 4 ? 'bad' : 'warn', 'cặp consumer × chi tiết bị lộ');
      sFree.update(free + '/6', free === 6 ? 'ok' : free >= 4 ? 'warn' : 'bad', 'không cần ai khác triển khai cùng');
      sCons.update(String(cons.size), cons.size === 0 ? 'ok' : 'warn', cons.size ? [...cons].join(', ') : 'không ai');
    }
    render();
  });

  // =====================================================================
  // 2.2 Cohesion & coupling — assign 9 blocks to 3 services
  // =====================================================================
  widget('ch2-cohesion', (root) => {
    const DOM = { cat: 'Catalog', cus: 'Customer', ord: 'Order' };
    const LAYER = { ui: 'Giao diện', logic: 'Logic', data: 'Dữ liệu' };
    const FUNCS = [
      { id: 'catUi', name: 'Trang danh mục CD', dom: 'cat', layer: 'ui' },
      { id: 'catLogic', name: 'Tính giá & khuyến mãi', dom: 'cat', layer: 'logic' },
      { id: 'catData', name: 'Bảng sản phẩm', dom: 'cat', layer: 'data' },
      { id: 'cusUi', name: 'Trang hồ sơ khách', dom: 'cus', layer: 'ui' },
      { id: 'cusLogic', name: 'Quy tắc hạng thành viên', dom: 'cus', layer: 'logic' },
      { id: 'cusData', name: 'Bảng khách hàng', dom: 'cus', layer: 'data' },
      { id: 'ordUi', name: 'Trang thanh toán', dom: 'ord', layer: 'ui' },
      { id: 'ordLogic', name: 'Quy trình đặt hàng', dom: 'ord', layer: 'logic' },
      { id: 'ordData', name: 'Bảng đơn hàng', dom: 'ord', layer: 'data' },
    ];
    const EDGES = [
      ['catUi', 'catLogic'], ['catLogic', 'catData'], ['cusUi', 'cusLogic'], ['cusLogic', 'cusData'],
      ['ordUi', 'ordLogic'], ['ordLogic', 'ordData'], ['ordLogic', 'catLogic'], ['ordLogic', 'cusLogic'], ['catLogic', 'cusLogic'],
    ];
    const CHANGES = [
      { name: 'Thêm khuyến mãi theo mùa', f: ['catUi', 'catLogic', 'catData'] },
      { name: 'Lưu ngày sinh để tặng quà', f: ['cusUi', 'cusLogic', 'cusData'] },
      { name: 'Cho đặt trước CD sắp phát hành', f: ['ordUi', 'ordLogic', 'ordData', 'catData'] },
      { name: 'Giá ưu đãi theo hạng thành viên', f: ['catUi', 'catLogic', 'cusLogic'] },
      { name: 'Đổi luồng thanh toán thành 2 bước', f: ['ordUi', 'ordLogic'] },
    ];
    const SVCS = ['A', 'B', 'C'];
    const PRESETS = {
      layer: { map: (f) => ({ ui: 'A', logic: 'B', data: 'C' })[f.layer], names: { A: 'Frontend', B: 'Business logic', C: 'Data' } },
      domain: { map: (f) => ({ cat: 'A', cus: 'B', ord: 'C' })[f.dom], names: { A: 'Catalog', B: 'Customer', C: 'Order' } },
    };
    let assign = {};
    let names = PRESETS.layer.names;
    const preset = seg({
      options: [{ value: 'layer', label: 'Cắt theo tầng kỹ thuật' }, { value: 'domain', label: 'Cắt theo nghiệp vụ' }, { value: 'custom', label: 'Tự gán' }],
      value: 'layer', onChange: (v) => applyPreset(v),
    });
    const rowSegs = {};
    const assignBody = h('tbody');
    FUNCS.forEach((f) => {
      const sg = seg({ options: SVCS.map((x) => ({ value: x, label: x })), value: 'A', onChange: (v) => { assign[f.id] = v; preset.set('custom'); names = { A: 'Service A', B: 'Service B', C: 'Service C' }; render(); } });
      rowSegs[f.id] = sg;
      assignBody.append(h('tr', h('td', f.name, h('br'), h('small', { class: 'lab-note' }, DOM[f.dom] + ' · ' + LAYER[f.layer])), h('td', sg.el)));
    });
    const sAvg = stat('TB service phải sửa / yêu cầu', '–');
    const sMulti = stat('Yêu cầu phải phối hợp ≥ 2 service', '–');
    const sCross = stat('Lời gọi xuyên service', '–');
    const sVerdict = stat('Theo định luật Constantine', '–');
    const chBody = h('tbody');
    const vizBox = h('div', { class: 'viz' });
    root.append(
      labeled('Cách chia', preset.el),
      vizBox,
      h('div', { class: 'stats' }, sAvg, sMulti, sCross, sVerdict),
      h('div', { class: 'lab-split' },
        h('div', { class: 'table-wrap' }, h('table', { class: 'data' }, h('thead', h('tr', h('th', 'Khối chức năng'), h('th', 'Service'))), assignBody)),
        h('div', { class: 'table-wrap' }, h('table', { class: 'data' }, h('thead', h('tr', h('th', 'Yêu cầu thay đổi'), h('th', 'Service phải sửa'))), chBody))));

    function applyPreset(v) {
      if (v === 'custom') { names = { A: 'Service A', B: 'Service B', C: 'Service C' }; render(); return; }
      const p = PRESETS[v];
      names = p.names;
      FUNCS.forEach((f) => { assign[f.id] = p.map(f); rowSegs[f.id].set(assign[f.id]); });
      render();
    }

    function draw() {
      const W = 640, H = 250, colW = 190, gap = 25, x0 = 15;
      const svg = svgEl(W, H);
      const pos = {};
      SVCS.forEach((sv, i) => {
        const x = x0 + i * (colW + gap);
        const fs = FUNCS.filter((f) => assign[f.id] === sv);
        svg.append(s('rect', { x, y: 8, width: colW, height: H - 16, rx: 10, class: 'f-surface2 s-line', 'stroke-width': 1.5 }));
        txt(svg, x + colW / 2, 28, sv + ' · ' + names[sv], { cls: 'lbl-strong' });
        fs.forEach((f, j) => { pos[f.id] = { x: x + 12, y: 40 + j * 22, w: colW - 24 }; });
      });
      const cross = EDGES.filter(([a, b]) => assign[a] !== assign[b]);
      cross.forEach(([a, b]) => {
        const pa = pos[a], pb = pos[b];
        if (!pa || !pb) return;
        const ax = pa.x < pb.x ? pa.x + pa.w : pa.x, bx = pa.x < pb.x ? pb.x : pb.x + pb.w;
        svg.append(s('line', { x1: ax, y1: pa.y + 9, x2: bx, y2: pb.y + 9, class: 'f-none s-bad', 'stroke-width': 1.3, opacity: 0.7 }));
      });
      FUNCS.forEach((f) => {
        const p = pos[f.id];
        if (!p) return;
        const fill = { cat: 'f-accent-soft', cus: 'f-violet-soft', ord: 'f-mark-soft' }[f.dom];
        svg.append(s('rect', { x: p.x, y: p.y, width: p.w, height: 18, rx: 4, class: fill + ' s-line', 'stroke-width': 1 }));
        txt(svg, p.x + 6, p.y + 13, f.name, { anchor: 'start', fs: 10 });
      });
      txt(svg, W / 2, H - 1, 'Màu = domain (xanh: Catalog, tím: Customer, cam: Order) · đường đỏ = lời gọi xuyên service', { fs: 9 });
      clear(vizBox).append(svg);
      return cross.length;
    }

    function render() {
      const cross = draw();
      clear(chBody);
      let total = 0, multi = 0;
      CHANGES.forEach((c) => {
        const svcs = [...new Set(c.f.map((id) => assign[id]))].sort();
        total += svcs.length;
        if (svcs.length > 1) multi++;
        chBody.append(h('tr', h('td', c.name),
          h('td', svcs.map((x) => pill(x + ' · ' + names[x], svcs.length > 1 ? 'warn' : 'ok')))));
      });
      const avg = total / CHANGES.length;
      sAvg.update(fmt(avg, 1), avg <= 1.5 ? 'ok' : avg >= 2.2 ? 'bad' : 'warn', 'càng gần 1 càng gắn kết');
      sMulti.update(multi + '/' + CHANGES.length, multi <= 2 ? 'ok' : 'bad', 'cần phát hành nhiều service');
      sCross.update(String(cross), cross <= 3 ? 'ok' : cross >= 6 ? 'bad' : 'warn', 'trên ' + EDGES.length + ' phụ thuộc');
      const stable = avg <= 1.5 && cross <= 3;
      sVerdict.update(stable ? 'Ổn định' : avg >= 2.2 || cross >= 6 ? 'Kém ổn định' : 'Tạm được', stable ? 'ok' : avg >= 2.2 || cross >= 6 ? 'bad' : 'warn',
        stable ? 'gắn kết mạnh, ghép nối thấp' : 'thay đổi lan qua ranh giới');
    }
    applyPreset('layer');
  });

  // =====================================================================
  // 2.3 Domain & temporal coupling
  // =====================================================================
  widget('ch2-temporal', (root) => {
    const EXTRA = ['Loyalty', 'Notifications', 'Shipping', 'Inventory', 'Fraud Detection'];
    const LAT = { Warehouse: 120, Payment: 200, extra: 80 };
    let mode = 'sync', down = true, extra = 0, running = false;
    let ok = 0, fail = 0, queue = 0, blocked = 0, orders = 0;
    const modeSeg = seg({ options: [{ value: 'sync', label: 'HTTP đồng bộ' }, { value: 'async', label: 'Qua message broker' }], value: mode, onChange: (v) => { mode = v; draw(); } });
    const downCb = checkbox('Warehouse đang sập', down, (v) => { down = v; if (!v) drain(); draw(); });
    const exSl = slider({ label: 'Service hạ lưu thêm (minh hoạ)', min: 0, max: 5, value: 0, format: (v) => '+' + v, onInput: (v) => { extra = v; draw(); } });
    const runBtn = button('Đặt 12 đơn hàng', () => run(true));
    const sOk = stat('Đơn thành công', '0');
    const sFail = stat('Đơn thất bại', '0');
    const sQ = stat('Đang chờ trong broker', '0');
    const sBlk = stat('Luồng bị chặn / đơn', '–');
    const sDom = stat('Domain coupling', '2 service');
    const lg = log();
    const vizBox = h('div', { class: 'viz' });
    root.append(
      h('div', { class: 'controls' }, labeled('Order Processor → Warehouse', modeSeg.el), exSl.el, h('div', { class: 'ctl' }, downCb.el)),
      h('div', { class: 'btn-row' }, runBtn),
      vizBox,
      h('div', { class: 'stats' }, sOk, sFail, sQ, sBlk, sDom),
      lg);

    function draw() {
      const svcs = ['Warehouse', 'Payment', ...EXTRA.slice(0, extra)];
      const rowH = 38, H = Math.max(150, 30 + svcs.length * rowH);
      const W = 620;
      const svg = svgEl(W, H);
      const opY = H / 2 - 22;
      boxNode(svg, 14, opY, 140, 44, ['Order Processor', 'gọi ' + svcs.length + ' service'], { fill: 'f-accent-soft', stroke: 's-accent' });
      svcs.forEach((name, i) => {
        const y = 15 + i * rowH;
        const isWh = name === 'Warehouse';
        const isDown = isWh && down;
        boxNode(svg, 450, y, 150, 30, isDown ? [name + ' (SẬP)'] : [name], {
          fill: isDown ? 'f-bad-soft' : i >= 2 ? 'f-surface2' : 'f-surface', stroke: isDown ? 's-bad' : 's-line', dash: i >= 2,
        });
        if (isWh && mode === 'async') {
          boxNode(svg, 250, y - 2, 120, 34, ['Message broker', 'hàng đợi: ' + queue], { fill: 'f-violet-soft', stroke: 's-violet', fs: 10 });
          arrow(svg, 154, opY + 18, 250, y + 15, 'violet', { label: 'publish', dy: -4 });
          arrow(svg, 370, y + 15, 450, y + 15, isDown ? 'bad' : 'violet', { dash: isDown, label: isDown ? 'chờ' : 'consume' });
        } else {
          arrow(svg, 154, opY + 22, 450, y + 15, isWh && isDown ? 'bad' : 'ink3', { label: isWh ? 'HTTP: giữ hàng' : name === 'Payment' ? 'HTTP: trừ tiền' : '', dy: -4, dash: i >= 2 });
        }
      });
      clear(vizBox).append(svg);
      const n = svcs.length;
      sDom.update(n + ' service', n >= 5 ? 'bad' : n >= 4 ? 'warn' : 'ok', n >= 5 ? 'có thể đang làm quá nhiều' : 'phụ thuộc hạ lưu');
      sQ.update(String(queue), queue ? 'warn' : '', mode === 'async' ? 'sẽ xử lý khi Warehouse sống lại' : 'không dùng broker');
    }

    function stats() {
      sOk.update(String(ok), ok ? 'ok' : '', 'trên ' + orders + ' đơn');
      sFail.update(String(fail), fail ? 'bad' : 'ok', fail ? 'không giữ được CD' : '');
      sBlk.update(orders ? fmtMs(blocked / orders) : '–', blocked / Math.max(1, orders) > 1000 ? 'bad' : 'accent', 'Order Processor đứng chờ');
    }

    function oneOrder(i) {
      orders++;
      const extraLat = extra * LAT.extra;
      if (mode === 'sync') {
        if (down) {
          fail++; blocked += 2000;
          lg.add(`Đơn #${i}: chờ Warehouse tới timeout 2 s → thất bại, không giữ được hàng`, 'bad');
        } else {
          ok++; blocked += LAT.Warehouse + LAT.Payment + extraLat;
          lg.add(`Đơn #${i}: giữ hàng ${LAT.Warehouse} ms + trừ tiền ${LAT.Payment} ms${extra ? ' + ' + extraLat + ' ms service khác' : ''} → OK`, 'ok');
        }
      } else {
        blocked += 5 + LAT.Payment + extraLat;
        if (down) {
          queue++;
          lg.add(`Đơn #${i}: gửi yêu cầu giữ hàng vào broker (5 ms), Warehouse chưa nhận → xếp hàng chờ`, 'warn');
        } else {
          ok++;
          lg.add(`Đơn #${i}: broker chuyển yêu cầu giữ hàng; Warehouse xử lý → OK`, 'ok');
        }
      }
    }

    function reset() { ok = 0; fail = 0; queue = 0; blocked = 0; orders = 0; lg.reset(); }

    async function run(animate) {
      if (running) return;
      running = true; runBtn.disabled = true;
      reset();
      lg.add(`— ${mode === 'sync' ? 'HTTP đồng bộ' : 'Message broker'}, Warehouse ${down ? 'đang sập' : 'hoạt động'} —`, 't');
      for (let i = 1; i <= 12; i++) {
        oneOrder(i);
        if (animate) { stats(); draw(); await sleep(70); }
      }
      stats(); draw();
      running = false; runBtn.disabled = false;
    }

    function drain() {
      if (!queue) return;
      lg.add(`Warehouse hoạt động lại: xử lý ${queue} yêu cầu giữ hàng đang chờ trong broker`, 'acc');
      ok += queue; queue = 0;
      stats();
    }

    draw();
    run(false);
  });

  // =====================================================================
  // 2.4 Pass-through coupling
  // =====================================================================
  widget('ch2-pass-through', (root) => {
    const NAMES = { op: 'Order Processor', wh: 'Warehouse', sh: 'Shipping' };
    const ROLL = {
      free: ['Độc lập', 'ok', 'chỉ triển khai Shipping'],
      coord: ['Phối hợp 2 service', 'warn', 'hai bên cùng đổi hợp đồng'],
      phased: ['Theo pha', 'warn', 'sửa cả ba nhưng triển khai lần lượt'],
      lock: ['Lock-step cả 3', 'bad', 'phải phát hành đồng thời'],
    };
    const M = {
      A: {
        fmt: [['op', 'wh', 'sh'], 'lock', 'Order Processor tạo manifest, Warehouse đọc và chuyển tiếp nó: Shipping đổi định dạng thì cả ba có thể phải đổi.'],
        opt: [['sh'], 'free', 'Customs Declaration là tham số tuỳ chọn: triển khai Shipping mới là đủ; phía trên bổ sung sau.'],
        req: [['op', 'wh', 'sh'], 'lock', 'Customs Declaration bắt buộc: với pass-through chặt như ban đầu, có thể phải rollout lock-step cả ba service.'],
      },
      B: {
        fmt: [['op', 'sh'], 'coord', 'Warehouse thoát khỏi chuyện manifest, nhưng Order Processor giờ phải biết Shipping và điều phối: giữ hàng → giao → cập nhật tồn kho.'],
        opt: [['sh'], 'free', 'Tham số tuỳ chọn: chỉ Shipping đổi.'],
        req: [['op', 'sh'], 'coord', 'Bắt buộc: Order Processor và Shipping cùng đổi; Warehouse không liên quan.'],
      },
      C: {
        fmt: [['wh', 'sh'], 'coord', 'Warehouse tự dựng manifest từ dữ liệu nó đã có: Order Processor hoàn toàn không hay biết thay đổi.'],
        opt: [['sh'], 'free', 'Tham số tuỳ chọn: chỉ Shipping đổi; Warehouse bổ sung khi tiện.'],
        req: [['op', 'wh', 'sh'], 'phased', 'Bắt buộc và cần dữ liệu mới từ Order Processor: vẫn sửa cả ba, nhưng ta chủ động chọn thời điểm — triển khai theo pha thay vì lock-step.'],
      },
      D: {
        fmt: [['op', 'sh'], 'coord', 'Warehouse coi manifest là blob, không đọc nội dung, nên không phải đổi. Order Processor (bên tạo) và Shipping (bên đọc) vẫn đổi.'],
        opt: [['sh'], 'free', 'Tham số tuỳ chọn: chỉ Shipping đổi.'],
        req: [['op', 'sh'], 'coord', 'Bắt buộc: Order Processor phải thêm tờ khai vào blob; Warehouse vẫn chỉ chuyển tiếp.'],
      },
    };
    let design = 'A', change = 'fmt';
    const dSeg = seg({
      options: [{ value: 'A', label: 'Truyền qua (ban đầu)' }, { value: 'B', label: 'Gọi thẳng Shipping' }, { value: 'C', label: 'Warehouse tự dựng manifest' }, { value: 'D', label: 'Manifest là blob' }],
      value: design, onChange: (v) => { design = v; render(); },
    });
    const cSeg = seg({
      options: [{ value: 'fmt', label: 'Shipping đổi định dạng manifest' }, { value: 'opt', label: '+ Customs Declaration (tuỳ chọn)' }, { value: 'req', label: '+ Customs Declaration (bắt buộc)' }],
      value: change, onChange: (v) => { change = v; render(); },
    });
    const sN = stat('Service phải sửa', '–');
    const sR = stat('Kiểu triển khai', '–');
    const sK = stat('Order Processor phải biết', '–');
    const note = h('p', { class: 'lab-note' });
    const vizBox = h('div', { class: 'viz' });
    const json = h('pre', { class: 'json' });
    root.append(
      labeled('Thiết kế', dSeg.el), labeled('Thay đổi ở Shipping', cSeg.el),
      vizBox,
      h('div', { class: 'stats' }, sN, sR, sK), note,
      h('div', { class: 'box' }, h('h5', 'Payload Order Processor gửi đi'), json));

    function payload() {
      const order = { orderId: 'ord-1042', items: [{ sku: 'CD-0815', qty: 1 }] };
      const manifest = { address: '12 Abbey Road, London', shippingType: 'express' };
      if (change === 'req') manifest.customsDeclaration = { hsCode: '8523.49', value: 12.99 };
      if (design === 'A') return { 'POST /warehouse/dispatch': { ...order, shippingManifest: manifest } };
      if (design === 'B') return { 'POST /warehouse/reserve': order, 'POST /shipping/shipments': { orderId: order.orderId, shippingManifest: manifest } };
      if (design === 'C') {
        const p = { ...order, address: manifest.address, shippingType: 'express' };
        if (change === 'req') p.goodsValue = 12.99;
        return { 'POST /warehouse/dispatch': p };
      }
      return { 'POST /warehouse/dispatch': { ...order, shippingManifest: '<blob ' + (change === 'req' ? 212 : 148) + ' byte, Warehouse không đọc>' } };
    }

    function render() {
      const [svcs, roll, why] = M[design][change];
      const W = 620, H = 190;
      const svg = svgEl(W, H);
      const P = { op: [15, 95], wh: [235, 95], sh: [455, 95] };
      const bw = 150, bh = 46;
      const edge = (a, b, label, tone, curve) => {
        const [ax, ay] = P[a], [bx, by] = P[b];
        if (curve) {
          const x1 = ax + bw / 2, x2 = bx + bw / 2, y = ay;
          svg.append(s('path', { d: `M${x1},${y} C${x1},${y - 80} ${x2},${y - 80} ${x2},${y - 4}`, class: 'f-none s-' + tone, 'stroke-width': 1.6 }));
          svg.append(s('polygon', { points: `${x2},${y} ${x2 - 5},${y - 9} ${x2 + 5},${y - 9}`, class: 'f-' + tone }));
          txt(svg, (x1 + x2) / 2, y - 64, label, { fs: 10 });
        } else {
          arrow(svg, ax + bw, ay + bh / 2, bx, by + bh / 2, tone, { label, fs: 10 });
        }
      };
      if (design === 'A') { edge('op', 'wh', 'order + manifest', 'ink3'); edge('wh', 'sh', 'manifest (chuyển nguyên)', 'ink3'); }
      if (design === 'B') { edge('op', 'wh', 'giữ hàng, cập nhật kho', 'ink3'); edge('op', 'sh', 'manifest gửi thẳng', 'accent', true); }
      if (design === 'C') { edge('op', 'wh', 'order + địa chỉ, loại ship', 'ink3'); edge('wh', 'sh', 'manifest do Warehouse dựng', 'accent'); }
      if (design === 'D') { edge('op', 'wh', 'order + blob', 'ink3'); edge('wh', 'sh', 'blob (không đọc)', 'ink3'); }
      Object.keys(P).forEach((k) => {
        const hit = svcs.includes(k);
        boxNode(svg, P[k][0], P[k][1], bw, bh, [NAMES[k], hit ? 'phải sửa' : 'không đổi'], { fill: hit ? 'f-bad-soft' : 'f-ok-soft', stroke: hit ? 's-bad' : 's-ok' });
      });
      clear(vizBox).append(svg);
      const r = ROLL[roll];
      sN.update(svcs.length + '/3', svcs.length === 1 ? 'ok' : svcs.length === 2 ? 'warn' : 'bad', svcs.map((x) => NAMES[x]).join(', '));
      sR.update(r[0], r[1], r[2]);
      sK.update(design === 'B' ? 'Warehouse + Shipping' : 'Warehouse', design === 'B' ? 'warn' : 'ok', design === 'B' ? 'domain coupling tăng, logic điều phối dồn về' : 'chỉ một service hạ lưu');
      note.textContent = why;
      json.innerHTML = jsonHTML(payload());
    }
    render();
  });

  // =====================================================================
  // 2.5 Common & content coupling — order state machine
  // =====================================================================
  widget('ch2-order-fsm', (root) => {
    const ST = ['PLACED', 'PAID', 'PICKING', 'SHIPPED', 'COMPLETED'];
    const valid = (from, to) => ST.indexOf(to) === ST.indexOf(from) + 1;
    let mode = 'shared', cur = 'PLACED', lastBad = false;
    let okN = 0, badN = 0, rejN = 0, schema = null;
    const mSeg = seg({
      options: [{ value: 'shared', label: 'Bảng Order dùng chung' }, { value: 'service', label: 'Service Order là nguồn sự thật' }, { value: 'content', label: 'Warehouse ghi thẳng DB của Order' }],
      value: mode, onChange: (v) => { mode = v; schema = null; newOrder(); },
    });
    const lg = log();
    const sOk = stat('Chuyển hợp lệ', '0');
    const sBad = stat('Chuyển sai lọt qua', '0');
    const sRej = stat('Bị từ chối', '0');
    const sSch = stat('Đổi tên cột STATUS', 'chưa thử');
    const archBox = h('div', { class: 'viz' });
    const fsmBox = h('div', { class: 'viz' });
    const opBtns = ['PAID', 'COMPLETED'].map((t) => button('→ ' + t, () => act('op', t)));
    const whBtns = ['PICKING', 'SHIPPED'].map((t) => button('→ ' + t, () => act('wh', t), 'ghost'));
    root.append(
      labeled('Kiến trúc', mSeg.el),
      h('div', { class: 'lab-split' }, archBox, fsmBox),
      h('div', { class: 'controls' },
        h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Order Processor'), h('div', { class: 'btn-row' }, opBtns)),
        h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Warehouse'), h('div', { class: 'btn-row' }, whBtns)),
        h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Thao tác khác'), h('div', { class: 'btn-row' },
          button('Đơn mới (PLACED)', () => newOrder(), 'ghost'),
          button('Đổi tên cột STATUS → ORDER_STATE', () => renameColumn(), 'danger')))),
      h('div', { class: 'stats' }, sOk, sBad, sRej, sSch),
      lg);

    function drawArch() {
      const W = 320, H = 210;
      const svg = svgEl(W, H);
      boxNode(svg, 10, 10, 130, 36, 'Order Processor', { fill: 'f-accent-soft', stroke: 's-accent', fs: 10.5 });
      boxNode(svg, 180, 10, 130, 36, 'Warehouse', { fill: 'f-violet-soft', stroke: 's-violet', fs: 10.5 });
      const dbTone = mode === 'shared' ? 's-warn' : 's-line';
      boxNode(svg, 85, 160, 150, 40, ['Bảng Order', mode === 'shared' ? 'cột STATUS dùng chung' : 'nội bộ của Order'], { fill: 'f-surface2', stroke: dbTone, rx: 14, fs: 10.5 });
      if (mode === 'shared') {
        arrow(svg, 75, 46, 130, 160, 'warn', { label: 'UPDATE', dx: -24 });
        arrow(svg, 245, 46, 190, 160, 'warn', { label: 'UPDATE', dx: 24 });
      } else {
        boxNode(svg, 95, 88, 130, 36, ['Service Order', 'kiểm tra chuyển trạng thái'], { fill: 'f-ok-soft', stroke: 's-ok', fs: 10 });
        arrow(svg, 75, 46, 120, 88, 'ok', { label: 'yêu cầu', dx: -26, dy: 0 });
        arrow(svg, 160, 124, 160, 160, 'ink3');
        if (mode === 'service') arrow(svg, 245, 46, 200, 88, 'ok', { label: 'yêu cầu', dx: 26, dy: 0 });
        else arrow(svg, 270, 46, 220, 160, 'bad', { label: 'ghi thẳng DB', dx: 30, dash: true });
      }
      clear(archBox).append(svg);
    }

    function drawFsm() {
      const W = 320, H = 210;
      const svg = svgEl(W, H);
      txt(svg, W / 2, 16, 'Máy trạng thái (giản lược, Hình 2-9)', { fs: 10 });
      ST.forEach((st, i) => {
        const y = 26 + i * 36;
        const on = st === cur;
        boxNode(svg, 95, y, 130, 26, st, { fill: on ? (lastBad ? 'f-bad-soft' : 'f-accent-soft') : 'f-surface', stroke: on ? (lastBad ? 's-bad' : 's-accent') : 's-line', fs: 10.5 });
        if (i < ST.length - 1) arrow(svg, 160, y + 26, 160, y + 36, 'ink3', { sw: 1.2 });
        txt(svg, 236, y + 17, i < 2 || i === 4 ? 'Order Processor' : 'Warehouse', { anchor: 'start', fs: 9 });
      });
      clear(fsmBox).append(svg);
    }

    function stats() {
      sOk.update(String(okN), okN ? 'ok' : '');
      sBad.update(String(badN), badN ? 'bad' : 'ok', badN ? 'đơn ở trạng thái kỳ quặc' : '');
      sRej.update(String(rejN), rejN ? 'accent' : '', rejN ? 'Order đã nói “không”' : '');
      if (schema) sSch.update(schema[0], schema[1], schema[2]);
      else sSch.update('chưa thử', '', 'bấm nút đỏ để thử');
    }

    function act(actor, to) {
      const who = actor === 'op' ? 'Order Processor' : 'Warehouse';
      const ok = valid(cur, to);
      const vetted = mode === 'service' || (mode === 'content' && actor === 'op');
      if (vetted) {
        if (ok) { lg.add(`${who} yêu cầu ${cur} → ${to}: Order chấp nhận`, 'ok'); cur = to; okN++; lastBad = false; }
        else { lg.add(`${who} yêu cầu ${cur} → ${to}: Order từ chối (không phải bước kế tiếp)`, 'acc'); rejN++; }
      } else {
        const how = mode === 'content' ? ' (bỏ qua service Order)' : '';
        lg.add(`${who}: UPDATE order SET status='${to}'${how}` + (ok ? ' → hợp lệ' : ` → SAI: nhảy từ ${cur}`), ok ? 'ok' : 'bad');
        if (ok) okN++; else badN++;
        lastBad = !ok; cur = to;
      }
      drawFsm(); stats();
    }

    function renameColumn() {
      if (mode === 'shared') {
        schema = ['2 service hỏng', 'bad', 'Order Processor và Warehouse phải sửa và phát hành cùng lúc'];
        lg.add('Đổi tên cột STATUS trong bảng dùng chung → cả Order Processor lẫn Warehouse lỗi truy vấn', 'bad');
      } else if (mode === 'service') {
        schema = ['0 service hỏng', 'ok', 'chỉ code nội bộ của Order đổi; API giữ nguyên'];
        lg.add('Order đổi tên cột nội bộ → không consumer nào biết, API không đổi', 'ok');
      } else {
        schema = ['Warehouse hỏng', 'bad', 'DB nội bộ đã thành hợp đồng ngầm'];
        lg.add('Order đổi tên cột nội bộ → Warehouse (đang ghi thẳng DB) lỗi; Order Processor không sao', 'bad');
      }
      stats();
    }

    function newOrder() {
      cur = 'PLACED'; lastBad = false; okN = 0; badN = 0; rejN = 0;
      lg.reset();
      lg.add(`— ${{ shared: 'Bảng dùng chung', service: 'Service Order là nguồn sự thật', content: 'Warehouse ghi thẳng DB' }[mode]} · đơn mới ở PLACED —`, 't');
      drawArch(); drawFsm(); stats();
    }

    newOrder();
    act('op', 'PAID');
    act('op', 'COMPLETED');
  });

  // =====================================================================
  // 2.6 Volatility & bimodal IT
  // =====================================================================
  widget('ch2-volatility', (root) => {
    const MODS = [
      { id: 'web', name: 'Website', mode: 2 },
      { id: 'order', name: 'Đặt hàng', mode: 1 },
      { id: 'wh', name: 'Kho', mode: 1 },
      { id: 'pay', name: 'Thanh toán', mode: 1 },
      { id: 'fin', name: 'Tài chính', mode: 1 },
      { id: 'dig', name: 'Nhạc số', mode: 0 },
    ];
    const ERAS = {
      e1: { label: 'Giữa thập niên 90: trang web liệt kê', v: { web: 12, order: 1, wh: 0, pay: 1, fin: 1, dig: 0 }, note: 'Chỉ có trang web liệt kê hàng; muốn mua phải gọi điện. Bimodal IT phân loại hệ thống ở thời điểm này.' },
      e2: { label: 'Đặt hàng online', v: { web: 10, order: 14, wh: 16, pay: 9, fin: 3, dig: 0 }, note: 'Đặt hàng online ra đời: cả nhà kho vốn dùng giấy phải số hoá. Những phần “Mode 1” giờ thay đổi dữ dội.' },
      e3: { label: 'Nhạc số (có thể trong tương lai)', v: { web: 8, order: 6, wh: 4, pay: 11, fin: 6, dig: 18 }, note: 'Nếu MusicCorp phải bán nhạc số: xuất hiện một phần hoàn toàn mới, và thanh toán lại phải đổi.' },
    };
    let era = 'e2', th = 8, goal = 'ttm';
    const eSeg = seg({ options: Object.entries(ERAS).map(([k, e]) => ({ value: k, label: e.label })), value: era, onChange: (v) => { era = v; render(); } });
    const gSeg = seg({ options: [{ value: 'ttm', label: 'Ra thị trường nhanh' }, { value: 'scale', label: 'Mở rộng chịu tải' }], value: goal, onChange: (v) => { goal = v; render(); } });
    const thSl = slider({ label: 'Ngưỡng tách service', min: 2, max: 18, value: th, format: (v) => v + ' thay đổi/quý', onInput: (v) => { th = v; render(); } });
    const sEx = stat('Nên tách theo volatility', '–');
    const sCon = stat('“Mode 1” nhưng biến động', '–');
    const sM1 = stat('Thay đổi rơi vào Mode 1', '–');
    const note = h('p', { class: 'lab-note' });
    const goalNote = h('p', { class: 'lab-note' });
    const vizBox = h('div', { class: 'viz' });
    root.append(
      labeled('Giai đoạn', eSeg.el),
      h('div', { class: 'controls' }, thSl.el, labeled('Động lực chính', gSeg.el)),
      vizBox, note,
      h('div', { class: 'stats' }, sEx, sCon, sM1), goalNote);

    function render() {
      const e = ERAS[era];
      const W = 620, H = 260, x0 = 50, y0 = 20, ch = 170, max = 20;
      const bw = (W - x0 - 20) / MODS.length;
      const svg = svgEl(W, H);
      const Y = (v) => y0 + ch - (v / max) * ch;
      [0, 5, 10, 15, 20].forEach((v) => {
        svg.append(s('line', { x1: x0, x2: W - 15, y1: Y(v), y2: Y(v), class: 'grid' }));
        txt(svg, x0 - 6, Y(v) + 4, String(v), { anchor: 'end', fs: 10 });
      });
      const ty = s('text', { x: 14, y: y0 + ch / 2, 'text-anchor': 'middle', 'font-size': 10, transform: `rotate(-90 14 ${y0 + ch / 2})` }, 'thay đổi / quý');
      svg.append(ty);
      let ex = 0, con = 0, m1 = 0, tot = 0;
      MODS.forEach((m, i) => {
        const v = e.v[m.id];
        tot += v; if (m.mode === 1) m1 += v;
        const x = x0 + i * bw + 10, w = bw - 20;
        const above = v >= th && v > 0;
        const conflict = above && m.mode === 1;
        if (above) ex++;
        if (conflict) con++;
        svg.append(s('rect', { x, y: Y(v), width: w, height: Math.max(1, (v / max) * ch), rx: 3, class: (above ? 'f-accent' : 'f-surface2') + (conflict ? ' s-bad' : ' s-line'), 'stroke-width': conflict ? 2.5 : 1 }));
        txt(svg, x + w / 2, Y(v) - 5, String(v), { fs: 10, cls: 'lbl-strong' });
        txt(svg, x + w / 2, y0 + ch + 16, m.name, { fs: 10.5, cls: 'lbl-strong' });
        txt(svg, x + w / 2, y0 + ch + 30, m.mode === 2 ? 'Mode 2' : m.mode === 1 ? 'Mode 1' : 'chưa phân loại', { fs: 9.5 });
        if (conflict) txt(svg, x + w / 2, y0 + ch + 44, 'Mode 1 mà biến động!', { fs: 9, cls: 'lbl-strong' });
      });
      svg.append(s('line', { x1: x0, x2: W - 15, y1: Y(th), y2: Y(th), class: 'f-none s-mark dash', 'stroke-width': 1.5 }));
      txt(svg, W - 18, Y(th) - 4, 'ngưỡng ' + th, { anchor: 'end', fs: 10 });
      clear(vizBox).append(svg);
      note.textContent = e.note + ' Nhãn Mode 1/Mode 2 được “đóng băng” từ giai đoạn đầu.';
      sEx.update(ex + ' phần', ex ? 'accent' : '', 'vượt ngưỡng');
      sCon.update(String(con), con ? 'bad' : 'ok', con ? 'Bimodal IT đã xếp nhầm' : 'phân loại còn đúng');
      sM1.update(tot ? pct(m1 / tot, 0) : '0%', tot && m1 / tot > 0.5 ? 'bad' : 'ok', 'của tổng số thay đổi');
      goalNote.textContent = goal === 'scale'
        ? 'Mục tiêu là scale: phần hay thay đổi chưa chắc là phần chịu tải, nên phân rã theo volatility khó mang lại lợi ích. Hãy chọn cơ chế khác.'
        : 'Mục tiêu là ra thị trường nhanh: tách các phần đang (hoặc cần) thay đổi thường xuyên là hoàn toàn hợp lý.';
      goalNote.className = 'lab-note';
      sEx.update(ex + ' phần', goal === 'scale' ? 'warn' : ex ? 'accent' : '', goal === 'scale' ? 'ít tác dụng với scale' : 'vượt ngưỡng');
    }
    render();
  });

  // =====================================================================
  // 2.7 Data — PaymentCo red/green zones
  // =====================================================================
  widget('ch2-pci-zones', (root) => {
    const SV = [
      { id: 'gw', name: 'Gateway', card: true, fixed: true },
      { id: 'proc', name: 'Card Processing', card: true },
      { id: 'token', name: 'Tokenization', card: true },
      { id: 'fraud', name: 'Fraud Detection', card: false },
      { id: 'merchant', name: 'Merchant Portal', card: false },
      { id: 'report', name: 'Reporting', card: false },
      { id: 'notify', name: 'Notifications', card: false },
      { id: 'settle', name: 'Settlement', card: false },
    ];
    const red = new Set(['gw', 'proc', 'token']);
    let leak = false;
    const chips = h('div', { class: 'ch2-chips', role: 'group', 'aria-label': 'Đặt service vào vùng đỏ' });
    const chipBtns = SV.map((sv) => {
      const b = h('button', { type: 'button', class: 'red', 'aria-pressed': 'false', disabled: !!sv.fixed }, sv.name);
      b.addEventListener('click', () => toggle(sv.id));
      chips.append(b);
      return [sv.id, b];
    });
    const leakCb = checkbox('Service vùng xanh được gọi API trả về số thẻ đầy đủ', leak, (v) => { leak = v; render(); });
    const sScope = stat('Service trong phạm vi PCI', '–');
    const sAudit = stat('Đánh giá bên ngoài hằng quý', '–');
    const sBound = stat('Ranh giới vùng', '–');
    const note = h('p', { class: 'lab-note' });
    const vizBox = h('div', { class: 'viz' });
    root.append(
      h('p', { class: 'lab-note' }, 'Bấm vào service trên sơ đồ hoặc nút dưới đây (nút được nhấn = vùng đỏ). Service có dấu ● cần số thẻ đầy đủ để làm việc.'),
      chips, leakCb.el, vizBox,
      h('div', { class: 'stats' }, sScope, sAudit, sBound), note,
      h('div', { class: 'btn-row' },
        button('Thiết kế của PaymentCo', () => { red.clear(); ['gw', 'proc', 'token'].forEach((x) => red.add(x)); leak = false; leakCb.input.checked = false; render(); }, 'ghost'),
        button('Cả hệ thống trong vùng đỏ', () => { SV.forEach((x) => red.add(x.id)); render(); }, 'ghost')));

    function toggle(id) {
      const sv = SV.find((x) => x.id === id);
      if (sv.fixed) return;
      red.has(id) ? red.delete(id) : red.add(id);
      render();
    }

    function render() {
      chipBtns.forEach(([id, b]) => b.setAttribute('aria-pressed', String(red.has(id))));
      const reds = SV.filter((x) => red.has(x.id)), greens = SV.filter((x) => !red.has(x.id));
      const leakers = greens.filter((x) => x.card);
      const broken = leak || leakers.length > 0;
      const W = 640, H = 290;
      const svg = svgEl(W, H);
      const redW = reds.length > 4 ? 380 : 230;
      svg.append(s('rect', { x: 8, y: 30, width: redW, height: H - 40, rx: 12, class: 'f-bad-soft s-bad dash', 'stroke-width': 1.6 }));
      txt(svg, 20, 48, 'VÙNG ĐỎ — thấy số thẻ đầy đủ', { anchor: 'start', fs: 10.5, cls: 'lbl-strong' });
      const gx = redW + 20;
      svg.append(s('rect', { x: gx, y: 30, width: W - gx - 8, height: H - 40, rx: 12, class: (broken ? 'f-bad-soft s-bad' : 'f-ok-soft s-ok'), 'stroke-width': 1.6, 'stroke-dasharray': '1 4', 'stroke-linecap': 'round' }));
      txt(svg, gx + 12, 48, broken ? 'VÙNG XANH — đã nhiễm dữ liệu thẻ' : 'VÙNG XANH — không bao giờ thấy số thẻ', { anchor: 'start', fs: 10.5, cls: 'lbl-strong' });
      txt(svg, 8, 16, 'Khách hàng / merchant', { anchor: 'start', fs: 10 });
      const pos = {};
      const place = (list, x, w, cols) => list.forEach((sv, i) => {
        const c = i % cols, r = Math.floor(i / cols);
        const bw = (w - 20 - (cols - 1) * 10) / cols;
        pos[sv.id] = { x: x + 10 + c * (bw + 10), y: 62 + r * 54, w: bw };
      });
      place(reds, 8, redW, reds.length > 4 ? 3 : 2);
      place(greens, gx, W - gx - 8, greens.length > 4 ? 3 : 2);
      const gw = pos.gw;
      arrow(svg, 60, 20, gw.x + gw.w / 2, gw.y, 'ink3', { sw: 1.2 });
      SV.forEach((sv) => {
        if (sv.id === 'gw') return;
        const p = pos[sv.id];
        arrow(svg, gw.x + gw.w / 2, gw.y + 36, p.x + p.w / 2, p.y, red.has(sv.id) || !sv.card ? 'ink3' : 'bad', { sw: 1, dash: !red.has(sv.id) && !sv.card });
      });
      SV.forEach((sv) => {
        const p = pos[sv.id];
        const isRed = red.has(sv.id);
        const bad = !isRed && (sv.card || leak);
        boxNode(svg, p.x, p.y, p.w, 36, [(sv.card ? '● ' : '') + sv.name, isRed ? 'trong PCI' : bad ? 'nhiễm số thẻ' : 'miễn PCI đầy đủ'], {
          fill: isRed ? 'f-surface' : bad ? 'f-bad-soft' : 'f-surface', stroke: isRed ? 's-bad' : bad ? 's-bad' : 's-ok', fs: 10,
          click: sv.fixed ? null : () => toggle(sv.id),
        });
      });
      clear(vizBox).append(svg);
      const scope = broken ? SV.length : reds.length;
      sScope.update(scope + '/' + SV.length, scope <= 3 ? 'ok' : scope >= 6 ? 'bad' : 'warn', pct(scope / SV.length, 0) + ' hệ thống');
      sAudit.update(scope + ' service', scope <= 3 ? 'ok' : 'bad', 'PCI Level 1');
      sBound.update(broken ? 'Bị phá' : 'Kín', broken ? 'bad' : 'ok', broken ? 'dữ liệu thẻ chảy sang vùng xanh' : 'số thẻ không ra khỏi vùng đỏ');
      if (leakers.length) note.textContent = leakers.map((x) => x.name).join(', ') + ' cần số thẻ đầy đủ nhưng nằm ở vùng xanh: số thẻ phải chảy sang vùng xanh, nên cả vùng xanh quay lại phạm vi kiểm toán.';
      else if (leak) note.textContent = 'Chỉ cần vùng xanh có thể yêu cầu số thẻ là đường phân tách sụp đổ — toàn bộ hệ thống bị kiểm toán.';
      else if (reds.length > 3) note.textContent = 'Ranh giới vẫn kín, nhưng vùng đỏ to hơn cần thiết: service không cần số thẻ cũng bị kiểm toán hằng quý.';
      else note.textContent = 'Đúng tinh thần PaymentCo: thu nhỏ vùng đỏ hết mức, gateway nằm trong vùng đỏ vì số thẻ đi qua nó.';
    }
    render();
  });

  // =====================================================================
  // 2.8 Organizational — horizontal vs vertical slice
  // =====================================================================
  widget('ch2-onion', (root) => {
    const FEATURES = [
      { name: 'Thêm bộ lọc tìm kiếm', slice: 'A', layers: ['ui', 'data'] },
      { name: 'Đổi giao diện trang chủ', slice: 'A', layers: ['ui'] },
      { name: 'Lưu lịch sử xem', slice: 'A', layers: ['ui', 'data'] },
      { name: 'Báo cáo cho quản trị', slice: 'B', layers: ['ui', 'data'] },
      { name: 'Thêm trường hồ sơ người dùng', slice: 'B', layers: ['ui', 'data'] },
      { name: 'Tối ưu truy vấn danh sách', slice: 'B', layers: ['data'] },
    ];
    const RPC_MS = 2;
    let cut = 'horizontal', rpc = 30;
    const cSeg = seg({ options: [{ value: 'horizontal', label: 'Cắt ngang (như dự án thật)' }, { value: 'vertical', label: 'Cắt dọc theo nghiệp vụ' }], value: cut, onChange: (v) => { cut = v; render(); } });
    const rSl = slider({ label: 'Lời gọi RPC mỗi lượt xem trang (khi cắt ngang)', min: 5, max: 60, value: rpc, onInput: (v) => { rpc = v; render(); } });
    const sCo = stat('Tính năng cần 2 đội phối hợp', '–');
    const sNet = stat('Lời gọi mạng / lượt xem', '–');
    const sLat = stat('Độ trễ mạng thêm', '–', null, RPC_MS + ' ms/lời gọi, tuần tự (minh hoạ)');
    const sBatch = stat('Cần cơ chế gom RPC?', '–');
    const vizBox = h('div', { class: 'viz' });
    const tbody = h('tbody');
    root.append(
      h('div', { class: 'controls' }, labeled('Cách chia việc California / Brazil', cSeg.el), rSl.el),
      vizBox,
      h('div', { class: 'stats' }, sCo, sNet, sLat, sBatch),
      h('div', { class: 'table-wrap' }, h('table', { class: 'data' }, h('thead', h('tr', h('th', 'Tính năng'), h('th', 'Đội phải tham gia'))), tbody)));

    const owner = (layer, slice) => (cut === 'horizontal' ? (layer === 'data' ? 'Brazil' : 'California') : (slice === 'A' ? 'California' : 'Brazil'));

    function render() {
      const W = 600, H = 230;
      const svg = svgEl(W, H);
      const LAYERS = [['ui', 'Giao diện web'], ['logic', 'Logic'], ['data', 'Truy cập dữ liệu']];
      const x0 = 120, cw = 220, rh = 46, y0 = 34;
      txt(svg, x0 + cw / 2, 22, 'Phần nghiệp vụ A', { cls: 'lbl-strong' });
      txt(svg, x0 + cw + 20 + cw / 2, 22, 'Phần nghiệp vụ B', { cls: 'lbl-strong' });
      LAYERS.forEach(([id, name], r) => {
        txt(svg, x0 - 10, y0 + r * (rh + 8) + rh / 2 + 4, name, { anchor: 'end', fs: 10.5 });
        ['A', 'B'].forEach((sl, c) => {
          const o = owner(id, sl);
          svg.append(s('rect', { x: x0 + c * (cw + 20), y: y0 + r * (rh + 8), width: cw, height: rh, rx: 6, class: (o === 'California' ? 'f-accent-soft s-accent' : 'f-violet-soft s-violet'), 'stroke-width': 1 }));
          txt(svg, x0 + c * (cw + 20) + cw / 2, y0 + r * (rh + 8) + rh / 2 + 4, 'Đội ' + o, { fs: 10.5 });
        });
      });
      if (cut === 'horizontal') {
        svg.append(s('rect', { x: x0 - 6, y: y0 - 4, width: cw * 2 + 32, height: rh * 2 + 16, rx: 10, class: 'f-none s-ink dash', 'stroke-width': 2 }));
        svg.append(s('rect', { x: x0 - 6, y: y0 + 2 * (rh + 8) - 4, width: cw * 2 + 32, height: rh + 8, rx: 10, class: 'f-none s-ink dash', 'stroke-width': 2 }));
        arrow(svg, x0 + cw + 10, y0 + 2 * rh + 6, x0 + cw + 10, y0 + 2 * (rh + 8) - 4, 'bad', { sw: 2 });
        txt(svg, x0 + cw + 24, y0 + 2 * rh + 14, rpc + ' lời gọi RPC / trang', { anchor: 'start', fs: 10, cls: 'lbl-strong' });
      } else {
        [0, 1].forEach((c) => svg.append(s('rect', { x: x0 + c * (cw + 20) - 5, y: y0 - 5, width: cw + 10, height: 3 * rh + 26, rx: 10, class: 'f-none s-ink dash', 'stroke-width': 2 })));
      }
      txt(svg, W / 2, H - 6, 'Nét đứt = ranh giới service. Màu = đội sở hữu.', { fs: 9.5 });
      clear(vizBox).append(svg);

      clear(tbody);
      let co = 0;
      FEATURES.forEach((f) => {
        const teams = [...new Set(f.layers.map((l) => owner(l, f.slice)))];
        if (teams.length > 1) co++;
        tbody.append(h('tr', h('td', f.name), h('td', teams.map((t) => pill(t, teams.length > 1 ? 'warn' : t === 'California' ? 'accent' : 'violet')))));
      });
      const calls = cut === 'horizontal' ? rpc : 1;
      sCo.update(co + '/' + FEATURES.length, co ? 'bad' : 'ok', co ? 'hai service phải sửa cùng nhau' : 'mỗi đội tự làm trọn');
      sNet.update(String(calls), calls > 10 ? 'bad' : 'ok', cut === 'horizontal' ? 'giao diện “lắm lời”' : 'logic & dữ liệu trong cùng tiến trình');
      sLat.update(fmtMs(calls * RPC_MS), calls * RPC_MS > 30 ? 'bad' : 'ok');
      const batch = cut === 'horizontal' && rpc >= 20;
      sBatch.update(batch ? 'Có' : 'Không', batch ? 'bad' : 'ok', batch ? 'phải chế batching RPC phức tạp' : '');
    }
    render();
  });

  // =====================================================================
  // 2.9 Different goals, different drivers
  // =====================================================================
  widget('ch2-drivers', (root) => {
    const GOALS = [
      { id: 'ttm', label: 'Ra thị trường nhanh hơn' },
      { id: 'scale', label: 'Mở rộng để chịu tải' },
      { id: 'data', label: 'Giới hạn phạm vi dữ liệu nhạy cảm (PII, PCI)' },
      { id: 'tech', label: 'Một phần cần runtime khác (Rust, C++…)' },
      { id: 'teams', label: 'Nhiều đội làm song song, tự chủ' },
    ];
    const MECH = [
      { id: 'domain', name: 'Domain' },
      { id: 'org', name: 'Tổ chức' },
      { id: 'volatility', name: 'Volatility' },
      { id: 'data', name: 'Dữ liệu' },
      { id: 'tech', name: 'Công nghệ' },
    ];
    const on = new Set(['ttm', 'teams']);
    const boxes = h('div', { class: 'ch2-list' });
    GOALS.forEach((g) => boxes.append(h('div', { class: 'ch2-item' }, checkbox(g.label, on.has(g.id), (v) => { v ? on.add(g.id) : on.delete(g.id); render(); }).el)));
    const vizBox = h('div', { class: 'viz' });
    const cav = h('div', { class: 'box' });
    root.append(boxes, vizBox, cav);

    function render() {
      const sc = { domain: 3, org: 3, volatility: 0, data: 0, tech: 0 };
      if (on.has('ttm')) { sc.volatility += 4; sc.domain += 1; }
      if (on.has('scale')) { sc.volatility -= 2; sc.domain += 1; }
      if (on.has('data')) sc.data += 5;
      if (on.has('tech')) sc.tech += 4;
      if (on.has('teams')) { sc.org += 2; sc.domain += 1; }
      Object.keys(sc).forEach((k) => (sc[k] = Math.max(0, sc[k])));
      const W = 600, rh = 34, H = MECH.length * rh + 40, x0 = 100, max = 8;
      const svg = svgEl(W, H);
      [0, 2, 4, 6, 8].forEach((v) => {
        const x = x0 + (v / max) * (W - x0 - 140);
        svg.append(s('line', { x1: x, x2: x, y1: 8, y2: H - 26, class: 'grid' }));
        txt(svg, x, H - 12, String(v), { fs: 10 });
      });
      txt(svg, W - 135, H - 12, 'mức ưu tiên (minh hoạ)', { anchor: 'start', fs: 9.5 });
      const top = Math.max(...Object.values(sc));
      MECH.forEach((m, i) => {
        const y = 12 + i * rh, v = Math.min(max, sc[m.id]);
        const w = (v / max) * (W - x0 - 140);
        txt(svg, x0 - 8, y + 16, m.name, { anchor: 'end', cls: 'lbl-strong' });
        svg.append(s('rect', { x: x0, y, width: Math.max(2, w), height: 22, rx: 4, class: sc[m.id] === top ? 'f-accent' : 'f-accent-soft' }));
        const tag = (m.id === 'domain' || m.id === 'org') ? 'điểm khởi đầu mặc định' : (m.id === 'volatility' && on.has('scale') ? 'ít tác dụng với scale' : '');
        if (tag) txt(svg, x0 + w + 8, y + 15, tag, { anchor: 'start', fs: 10 });
      });
      clear(vizBox).append(svg);

      const notes = [];
      if (!on.size) notes.push(['Chưa có mục tiêu: microservice không phải đích đến. Hãy xác định điều mà kiến trúc hiện tại không làm được trước đã.', 'bad']);
      if (on.has('ttm') && on.has('teams')) notes.push(['Tách theo volatility mà service cắt ngang ranh giới tổ chức thì tốc độ thay đổi sẽ giảm vì tranh chấp bàn giao (delivery contention).', 'warn']);
      if (on.has('scale')) notes.push(['Nếu vấn đề lớn nhất là scale, phân rã theo volatility khó mang lại nhiều lợi ích.', 'warn']);
      if (on.has('tech')) notes.push(['Warehouse thiết kế theo domain nhưng một phần cần C++, một phần Kotlin: phải tách thêm theo đường kỹ thuật.', 'accent']);
      if (on.has('data')) notes.push(['Giống PaymentCo: mối lo về dữ liệu dẫn dắt quyết định — giữ vùng xử lý dữ liệu nhạy cảm nhỏ nhất có thể.', 'accent']);
      notes.push(['Ai nói “Cách duy nhất là X!” thì nhiều khả năng đang bán thêm một giáo điều.', '']);
      clear(cav).append(h('h5', 'Lưu ý từ sách'), ...notes.map(([t, tone]) => h('p', { style: { margin: '4px 0' } }, tone ? pill(tone === 'bad' ? 'Dừng lại' : tone === 'warn' ? 'Cẩn thận' : 'Kết hợp', tone) : pill('Nhắc nhở'), ' ', t)));
    }
    render();
  });

  // =====================================================================
  // 2.10 Ubiquitous language
  // =====================================================================
  widget('ch2-ubiquitous', (root) => {
    const TERMS = [
      ['Tập đoàn (corporate entity)', 'Arrangement (ARR_TYPE_01)', 'CorporateGroup'],
      ['Tài khoản con', 'Arrangement con (ARR_TYPE_07)', 'SubAccount'],
      ['Tài khoản tổng', 'Arrangement cha (ARR_TYPE_02)', 'MasterAccount'],
      ['End-of-day sweep', 'Arrangement (ARR_TYPE_12) + batch job', 'EndOfDaySweep'],
      ['Haircut', 'getAttr("ARR_PARAM_3")', 'Haircut'],
    ];
    const CODE = {
      ibm: '<span class="c">// Story: end-of-day sweep với haircut 2%</span>\n' +
        'Arrangement a = arrRepo.<span class="fn">find</span>(arrId);\n' +
        '<span class="k">for</span> (Arrangement c : a.<span class="fn">children</span>(<span class="n">ARR_TYPE_07</span>)) {\n' +
        '  <span class="k">if</span> (c.<span class="fn">getAttr</span>(<span class="s">"BAL_THRESHOLD_IND"</span>) == <span class="n">1</span>) {\n' +
        '    Arrangement t = <span class="k">new</span> Arrangement(<span class="n">ARR_TYPE_12</span>);\n' +
        '    t.<span class="fn">setAttr</span>(<span class="s">"ADJ_PCT"</span>, a.<span class="fn">getAttr</span>(<span class="s">"ARR_PARAM_3"</span>));\n' +
        '    t.<span class="fn">link</span>(c, a.<span class="fn">parent</span>(<span class="n">ARR_TYPE_02</span>));\n' +
        '  }\n}',
      ul: '<span class="c">// Story: end-of-day sweep với haircut 2%</span>\n' +
        'CorporateGroup group = groups.<span class="fn">find</span>(groupId);\n' +
        'EndOfDaySweep sweep = group.<span class="fn">startSweep</span>(today);\n' +
        '<span class="k">for</span> (SubAccount acc : group.<span class="fn">subAccounts</span>()) {\n' +
        '  Money excess = acc.<span class="fn">balanceAbove</span>(sweep.<span class="fn">threshold</span>());\n' +
        '  sweep.<span class="fn">moveTo</span>(group.<span class="fn">masterAccount</span>(),\n' +
        '               group.<span class="fn">haircut</span>().<span class="fn">applyTo</span>(excess));\n}',
    };
    let mode = 'ibm', stories = 8;
    const mSeg = seg({ options: [{ value: 'ibm', label: 'Mô hình ngân hàng IBM (arrangement)' }, { value: 'ul', label: 'Ngôn ngữ chung' }], value: mode, onChange: (v) => { mode = v; render(); } });
    const sl = slider({ label: 'User story mỗi sprint', min: 2, max: 20, value: stories, onInput: (v) => { stories = v; render(); } });
    const pre = h('pre', { class: 'code' });
    const tbody = h('tbody');
    const sHit = stat('Thuật ngữ của PO có trong code', '–');
    const sTr = stat('Lượt “phiên dịch” / sprint', '–', null, '3 thuật ngữ mỗi story (minh hoạ)');
    const sBa = stat('Thời gian BA giải thích', '–', null, '10 phút mỗi lượt (minh hoạ)');
    root.append(
      h('div', { class: 'box' }, h('h5', 'User story của product owner'),
        h('p', { style: { margin: 0 } }, 'Cuối mỗi ngày, chạy ', h('em', 'end-of-day sweep'), ' cho tập đoàn: chuyển phần số dư vượt ngưỡng từ các tài khoản con về tài khoản tổng, sau khi áp ', h('em', 'haircut'), ' 2%.')),
      h('div', { class: 'controls' }, labeled('Code được viết bằng', mSeg.el), sl.el),
      h('div', { class: 'lab-split' }, pre,
        h('div', { class: 'table-wrap' }, h('table', { class: 'data' }, h('thead', h('tr', h('th', 'PO nói'), h('th', 'Code nói'))), tbody))),
      h('div', { class: 'stats' }, sHit, sTr, sBa));

    function render() {
      pre.innerHTML = CODE[mode];
      clear(tbody);
      TERMS.forEach(([po, ibm, ul]) => tbody.append(h('tr', h('td', po), h('td', mode === 'ibm' ? [h('code', ibm), ' ', pill('phải dịch', 'bad')] : [h('code', ul), ' ', pill('khớp', 'ok')]))));
      const hit = mode === 'ibm' ? 0 : TERMS.length;
      const tr = mode === 'ibm' ? stories * 3 : 0;
      sHit.update(hit + '/' + TERMS.length, hit ? 'ok' : 'bad');
      sTr.update(String(tr), tr ? 'bad' : 'ok');
      sBa.update(fmt((tr * 10) / 60, 1) + ' giờ', tr ? 'bad' : 'ok');
    }
    render();
  });

  // =====================================================================
  // 2.11 Aggregate
  // =====================================================================
  widget('ch2-aggregate', (root) => {
    const SVCS = [{ value: 'cust', label: 'Customer service' }, { value: 'order', label: 'Order service' }, { value: 'fin', label: 'Finance service' }];
    const SVN = { cust: 'Customer service', order: 'Order service', fin: 'Finance service' };
    const AGG = [
      { id: 'Customer', def: 'cust' }, { id: 'Order', def: 'order' }, { id: 'Wishlist', def: 'cust' }, { id: 'Payment', def: 'fin' },
    ];
    const REL = [['Order', 'Customer', 'orders.customer'], ['Wishlist', 'Customer', 'wishlists.customer'], ['Payment', 'Customer', 'ledger.customer']];
    const own = {};
    AGG.forEach((a) => (own[a.id] = a.def));
    const sels = h('div', { class: 'controls' });
    AGG.forEach((a) => sels.append(selectCtl('Aggregate ' + a.id, SVCS, own[a.id], (v) => { own[a.id] = v; renderLeft(); }).el));
    const vizBox = h('div', { class: 'viz' });
    const relBox = h('pre', { class: 'json' });

    // right: Order aggregate state machine
    let st, lines;
    const lg = log();
    const ordJson = h('pre', { class: 'json' });
    const CDS = ['Kind of Blue — Miles Davis', 'Abbey Road — The Beatles', 'Blue Train — John Coltrane', 'Rumours — Fleetwood Mac'];
    const req = (name, fn) => button(name, () => { const r = fn(); lg.add((r[0] ? 'Chấp nhận: ' : 'Từ chối: ') + r[1], r[0] ? 'ok' : 'bad'); renderRight(); }, 'ghost');
    const btns = h('div', { class: 'btn-row' },
      req('Thêm 1 CD', () => (st === 'PLACED' ? (lines.push({ sku: CDS[lines.length % CDS.length], qty: 1 }), [true, 'thêm dòng hàng vào đơn ' + st]) : [false, 'đơn đã ' + st + ', không thêm dòng hàng được'])),
      req('Thanh toán', () => (st === 'PLACED' ? ((st = 'PAID'), [true, 'PLACED → PAID']) : [false, 'chỉ thanh toán được đơn PLACED (đang ' + st + ')'])),
      req('Giao hàng', () => (st === 'PAID' ? ((st = 'SHIPPED'), [true, 'PAID → SHIPPED']) : [false, 'chỉ giao được đơn PAID (đang ' + st + ')'])),
      req('Huỷ đơn', () => (st === 'PLACED' || st === 'PAID' ? ((st = 'CANCELLED'), [true, 'huỷ đơn']) : [false, 'đơn ' + st + ' không huỷ được nữa'])),
      button('Đơn mới', () => { newOrder(); renderRight(); }));
    root.append(h('div', { class: 'lab-split' },
      h('div', h('div', { class: 'box' }, h('h5', 'Sở hữu & quan hệ'), sels, vizBox, relBox)),
      h('div', h('div', { class: 'box' }, h('h5', 'Aggregate Order (quy tắc minh hoạ)'), btns, ordJson, lg))));

    function renderLeft() {
      const W = 360, H = 230;
      const svg = svgEl(W, H);
      const cols = { cust: 8, order: 128, fin: 248 };
      const pos = {};
      Object.entries(cols).forEach(([k, x]) => {
        svg.append(s('rect', { x, y: 6, width: 104, height: H - 12, rx: 10, class: 'f-surface2 s-line', 'stroke-width': 1.2 }));
        txt(svg, x + 52, 24, SVN[k].replace(' service', ''), { cls: 'lbl-strong', fs: 10.5 });
        txt(svg, x + 52, 37, 'service', { fs: 9 });
        AGG.filter((a) => own[a.id] === k).forEach((a, i) => { pos[a.id] = { x: x + 10, y: 50 + i * 44 }; });
      });
      REL.forEach(([a, b]) => {
        const pa = pos[a], pb = pos[b];
        const same = own[a] === own[b];
        svg.append(s('line', { x1: pa.x + 42, y1: pa.y + 15, x2: pb.x + 42, y2: pb.y + 15, class: 'f-none ' + (same ? 's-ok' : 's-accent dash'), 'stroke-width': 2 }));
      });
      AGG.forEach((a) => boxNode(svg, pos[a.id].x, pos[a.id].y, 84, 30, a.id, { fill: 'f-mark-soft', stroke: 's-mark', fs: 10.5 }));
      txt(svg, W / 2, H - 2, 'xanh lá = khoá ngoại · nét đứt = tham chiếu URI', { fs: 9 });
      clear(vizBox).append(svg);
      const out = {};
      REL.forEach(([a, b, field]) => { out[field] = own[a] === own[b] ? 123 : '/customers/123'; });
      relBox.innerHTML = jsonHTML(out);
    }

    function newOrder() {
      st = 'PLACED';
      lines = [{ sku: CDS[0], qty: 1 }, { sku: CDS[1], qty: 1 }];
      lg.reset();
      lg.add('Đơn mới ở PLACED với 2 dòng hàng', 't');
    }

    function renderRight() {
      ordJson.innerHTML = jsonHTML({ orderId: 'ord-1042', status: st, customer: '/customers/123', lineItems: lines });
    }

    renderLeft();
    newOrder();
    lg.add('Chấp nhận: PLACED → PAID', 'ok'); st = 'PAID';
    lg.add('Từ chối: đơn đã PAID, không thêm dòng hàng được', 'bad');
    renderRight();
  });

  // =====================================================================
  // 2.12 Bounded context map
  // =====================================================================
  widget('ch2-context-map', (root) => {
    const C = [
      { id: 'picker', name: 'Picker', ctx: 'wh', desc: 'Người nhặt hàng theo đơn. Chỉ kho cần biết.', internal: { pickerId: 'p-07', zone: 'B', currentOrder: 'ord-1042' } },
      { id: 'shelf', name: 'Shelf', ctx: 'wh', desc: 'Kệ — biểu diễn vị trí lưu hàng trong kho.', internal: { shelfId: 'B-14-3', capacity: 120 } },
      { id: 'forklift', name: 'Forklift', ctx: 'wh', desc: 'Xe nâng. Loại xe nâng nào thì ngoài kho chẳng ai quan tâm.', internal: { model: 'FL-200', raceWins: 3 } },
      { id: 'ledger', name: 'General Ledger', ctx: 'fin', desc: 'Sổ cái — gắn liền với tài chính, không chia sẻ ra ngoài.', internal: { entry: 'GL-5531', debit: 1299, credit: 0 } },
      { id: 'payroll', name: 'Payroll', ctx: 'fin', desc: 'Bảng lương; bên ngoài chỉ thấy phiếu lương (pay slip).', internal: { period: '2026-10', employees: 48 } },
      { id: 'stock', name: 'Stock Item', ctx: 'shared', desc: 'Mô hình chia sẻ: kho giữ bản đầy đủ, tài chính cần số lượng để định giá công ty.' },
      { id: 'cust', name: 'Customer', ctx: 'shared', desc: 'Có ở cả hai ngữ cảnh với vai trò khác nhau, liên kết qua định danh toàn cục.' },
    ];
    let sel = 'stock', share = 'count';
    const shSeg = seg({ options: [{ value: 'count', label: 'Chỉ chia sẻ Stock Count' }, { value: 'full', label: 'Lộ nguyên Stock Item' }], value: share, onChange: (v) => { share = v; render(); } });
    const chips = h('div', { class: 'ch2-chips', role: 'group', 'aria-label': 'Chọn khái niệm' });
    const chipBtns = C.map((c) => { const b = h('button', { type: 'button' }, c.name); b.addEventListener('click', () => { sel = c.id; render(); }); chips.append(b); return [c.id, b]; });
    const vizBox = h('div', { class: 'viz' });
    const detail = h('div', { class: 'lab-split' });
    const note = h('p', { class: 'lab-note' });
    root.append(labeled('Cách chia sẻ Stock Item', shSeg.el), chips, vizBox, note, detail);

    function views(c) {
      if (c.id === 'stock') {
        const whv = { sku: 'CD-0815', title: 'Kind of Blue', quantity: 42, shelfLocations: ['B-14-3', 'C-02-1'] };
        const fin = share === 'count' ? { name: 'Stock Count', sku: 'CD-0815', quantity: 42 } : { name: 'Stock Item', ...whv };
        return [['Warehouse — Stock Item (nội bộ)', whv], ['Finance thấy', fin]];
      }
      if (c.id === 'cust') {
        return [['Warehouse gọi là Recipient', { customer: '/customers/123', shipments: ['shp-881', 'shp-902'], deliveryAddress: '12 Abbey Road' }],
          ['Finance gọi là Customer', { customer: '/customers/123', payments: [1299, 2450], refunds: [450] }]];
      }
      const other = c.ctx === 'wh' ? 'Finance' : 'Warehouse';
      return [[(c.ctx === 'wh' ? 'Warehouse' : 'Finance') + ' — nội bộ', c.internal], [other + ' thấy', null]];
    }

    function render() {
      chipBtns.forEach(([id, b]) => b.setAttribute('aria-pressed', String(id === sel)));
      const W = 640, H = 240;
      const svg = svgEl(W, H);
      svg.append(s('rect', { x: 8, y: 8, width: 360, height: H - 16, rx: 16, class: 'f-violet-soft s-violet dash', 'stroke-width': 1.6 }));
      svg.append(s('rect', { x: 272, y: 8, width: 360, height: H - 16, rx: 16, class: 'f-accent-soft s-accent dash', 'stroke-width': 1.6, 'fill-opacity': 0.6 }));
      txt(svg, 20, 28, 'Bounded context: Warehouse', { anchor: 'start', cls: 'lbl-strong' });
      txt(svg, 620, 28, 'Bounded context: Finance', { anchor: 'end', cls: 'lbl-strong' });
      txt(svg, 320, 52, 'mô hình chia sẻ', { fs: 10 });
      const P = { picker: [28, 60], shelf: [28, 110], forklift: [28, 160], ledger: [500, 80], payroll: [500, 140], stock: [272, 80], cust: [272, 150] };
      C.forEach((c) => {
        const [x, y] = P[c.id];
        const on = c.id === sel;
        const label = c.id === 'stock' ? [share === 'count' ? 'Stock Item → Count' : 'Stock Item (đầy đủ)'] : c.id === 'cust' ? ['Recipient ↔ Customer'] : [c.name];
        boxNode(svg, x, y, c.ctx === 'shared' ? 96 : 112, 36, label, {
          fill: on ? 'f-mark-soft' : 'f-surface', stroke: on ? 's-mark' : (c.id === 'stock' && share === 'full' ? 's-bad' : 's-line'), sw: on ? 2.2 : 1.4, fs: c.ctx === 'shared' ? 9.5 : 10.5,
          click: () => { sel = c.id; render(); },
        });
      });
      clear(vizBox).append(svg);
      const c = C.find((x) => x.id === sel);
      note.textContent = c.desc + (c.id === 'stock' && share === 'full' ? ' Lộ nguyên: tài chính giờ thấy cả vị trí kệ — kho đổi cách xếp kệ cũng có thể ảnh hưởng tài chính.' : '');
      clear(detail);
      views(c).forEach(([title, obj]) => detail.append(h('div', { class: 'box' }, h('h5', title),
        obj ? h('pre', { class: 'json', html: jsonHTML(obj) }) : h('p', { class: 'lab-note', style: { margin: 0 } }, 'Không thấy gì — mô hình ẩn nằm sau ranh giới.'))));
    }
    render();
  });

  // =====================================================================
  // 2.13a Turtles all the way down
  // =====================================================================
  widget('ch2-nesting', (root) => {
    let split = true, hide = true;
    const cbSplit = checkbox('Tách nội bộ Warehouse thành Inventory + Shipping', split, (v) => { split = v; render(); });
    const cbHide = checkbox('Giấu sau API thô của Warehouse', hide, (v) => { hide = v; render(); });
    const sKnow = stat('Service consumer phải biết', '–');
    const sFix = stat('Consumer phải sửa khi tách', '–');
    const sStub = stat('Stub khi test một consumer', '–');
    const vizBox = h('div', { class: 'viz' });
    root.append(h('div', { class: 'controls' }, h('div', { class: 'ctl' }, cbSplit.el), h('div', { class: 'ctl' }, cbHide.el)), vizBox, h('div', { class: 'stats' }, sKnow, sFix, sStub));

    function render() {
      cbHide.input.disabled = !split;
      const W = 620, H = 220;
      const svg = svgEl(W, H);
      boxNode(svg, 10, 40, 140, 40, 'Order Processor', { fill: 'f-accent-soft', stroke: 's-accent' });
      boxNode(svg, 10, 130, 140, 40, 'Finance', { fill: 'f-accent-soft', stroke: 's-accent' });
      svg.append(s('rect', { x: 230, y: 10, width: 380, height: H - 20, rx: 14, class: 'f-surface2 s-ink3 dash', 'stroke-width': 1.5 }));
      txt(svg, 600, 28, 'Bounded context Warehouse', { anchor: 'end', fs: 10.5, cls: 'lbl-strong' });
      let know, fix, stubs;
      if (!split) {
        boxNode(svg, 330, 75, 190, 60, ['Warehouse', 'Stock Items · Shipments'], { fill: 'f-violet-soft', stroke: 's-violet' });
        arrow(svg, 150, 60, 330, 95, 'ink3'); arrow(svg, 150, 150, 330, 115, 'ink3');
        know = 1; fix = 0; stubs = 1;
      } else if (hide) {
        boxNode(svg, 245, 80, 120, 50, ['Warehouse API', 'API thô'], { fill: 'f-violet-soft', stroke: 's-violet' });
        boxNode(svg, 440, 40, 150, 46, ['Inventory', 'quản lý Stock Items'], { fill: 'f-surface', stroke: 's-violet' });
        boxNode(svg, 440, 130, 150, 46, ['Shipping', 'quản lý Shipments'], { fill: 'f-surface', stroke: 's-violet' });
        arrow(svg, 150, 60, 245, 98, 'ink3'); arrow(svg, 150, 150, 245, 112, 'ink3');
        arrow(svg, 365, 98, 440, 63, 'violet'); arrow(svg, 365, 112, 440, 153, 'violet');
        know = 1; fix = 0; stubs = 1;
      } else {
        boxNode(svg, 400, 40, 170, 46, ['Inventory', 'quản lý Stock Items'], { fill: 'f-surface', stroke: 's-bad' });
        boxNode(svg, 400, 130, 170, 46, ['Shipping', 'quản lý Shipments'], { fill: 'f-surface', stroke: 's-bad' });
        arrow(svg, 150, 55, 400, 58, 'bad'); arrow(svg, 150, 70, 400, 148, 'bad');
        arrow(svg, 150, 145, 400, 72, 'bad'); arrow(svg, 150, 160, 400, 160, 'bad');
        know = 2; fix = 2; stubs = 2;
      }
      clear(vizBox).append(svg);
      sKnow.update(String(know), know === 1 ? 'ok' : 'warn', know === 1 ? 'chỉ một API Warehouse' : 'Inventory và Shipping');
      sFix.update(String(fix), fix ? 'bad' : 'ok', fix ? 'quyết định cài đặt bị lộ' : 'consumer không hay biết');
      sStub.update(String(stubs), stubs === 1 ? 'ok' : 'warn', stubs === 1 ? 'stub API thô của Warehouse' : 'stub từng service bên trong');
    }
    render();
  });

  // =====================================================================
  // 2.13b SnapCI timeline
  // =====================================================================
  widget('ch2-snapci', (root) => {
    const MONTHS = 24;
    const actual = (m) => (m < 1 ? 1.4 : m < 5 ? 1.4 + (m - 1) * 0.45 : m < 17 ? 1.5 : m < 18 ? 1.3 : 1.0);
    const stuck = (m) => (m < 1 ? 1.4 : Math.min(3.6, 1.4 + (m - 1) * 0.3));
    const phase = (m) => (m < 1 ? ['Tách microservice dựa trên kinh nghiệm Go-CD', 'accent']
      : m < 5 ? ['Ranh giới sai lộ rõ: nhiều thay đổi phải sửa xuyên service', 'bad']
        : m < 17 ? ['Đã gộp lại thành monolith: học domain, chưa tách', 'warn']
          : m < 18 ? ['Một năm sau: tách lại thành microservice', 'accent']
            : ['Ranh giới mới ổn định hơn nhiều', 'ok']);
    let month = 3, running = false, showStuck = true;
    const sl = slider({ label: 'Tháng', min: 0, max: MONTHS, value: month, format: (v) => 'tháng ' + v, onInput: (v) => { month = v; render(); } });
    const cb = checkbox('Hiện kịch bản giả định: cố giữ ranh giới sai', showStuck, (v) => { showStuck = v; render(); });
    const play = button('Phát dòng thời gian', async () => {
      if (running) return;
      running = true; play.disabled = true;
      for (let m = 0; m <= MONTHS; m++) { month = m; sl.set(m); render(); await sleep(110); }
      running = false; play.disabled = false;
    });
    const sPh = stat('Giai đoạn', '–');
    const sCost = stat('Chi phí thay đổi tương đối', '–', null, '1,0 = ranh giới ổn định (minh hoạ)');
    const vizBox = h('div', { class: 'viz' });
    root.append(h('div', { class: 'controls' }, sl.el, h('div', { class: 'ctl' }, cb.el)), h('div', { class: 'btn-row' }, play), vizBox, h('div', { class: 'stats' }, sPh, sCost));

    function render() {
      const W = 620, H = 240, x0 = 46, y0 = 16, cw = W - x0 - 16, ch = 170, max = 4;
      const svg = svgEl(W, H);
      const X = (m) => x0 + (m / MONTHS) * cw, Y = (v) => y0 + ch - (v / max) * ch;
      [0, 1, 2, 3, 4].forEach((v) => { svg.append(s('line', { x1: x0, x2: x0 + cw, y1: Y(v), y2: Y(v), class: 'grid' })); txt(svg, x0 - 6, Y(v) + 4, String(v), { anchor: 'end', fs: 10 }); });
      [0, 6, 12, 18, 24].forEach((m) => txt(svg, X(m), y0 + ch + 16, 'tháng ' + m, { fs: 10 }));
      svg.append(s('rect', { x: X(5), y: y0, width: X(17) - X(5), height: ch, class: 'f-warn-soft', opacity: 0.6 }));
      txt(svg, (X(5) + X(17)) / 2, y0 + 14, 'monolith (gộp lại)', { fs: 10, cls: 'lbl-strong' });
      const line = (fn, cls, dash) => {
        let d = '';
        for (let m = 0; m <= MONTHS; m += 0.25) d += (m ? 'L' : 'M') + X(m).toFixed(1) + ',' + Y(fn(m)).toFixed(1);
        svg.append(s('path', { d, class: 'f-none ' + cls + (dash ? ' dash' : ''), 'stroke-width': 2.4 }));
      };
      if (showStuck) line(stuck, 's-bad', true);
      line(actual, 's-accent');
      svg.append(s('line', { x1: X(month), x2: X(month), y1: y0, y2: y0 + ch, class: 'f-none s-ink', 'stroke-width': 1.2 }));
      svg.append(s('circle', { cx: X(month), cy: Y(actual(month)), r: 5, class: 'f-accent s-ink', 'stroke-width': 1 }));
      txt(svg, x0 + 6, y0 + ch + 34, '— SnapCI thực tế', { anchor: 'start', fs: 10, cls: 'lbl-strong' });
      if (showStuck) txt(svg, x0 + 140, y0 + ch + 34, '- - nếu cố giữ ranh giới sai (giả định)', { anchor: 'start', fs: 10 });
      const ty = y0 + ch / 2;
      svg.append(s('text', { x: 12, y: ty, 'text-anchor': 'middle', 'font-size': 10, transform: `rotate(-90 12 ${ty})` }, 'chi phí thay đổi'));
      clear(vizBox).append(svg);
      const [p, tone] = phase(month);
      sPh.update(p, tone);
      sCost.update(fmt(actual(month), 1), actual(month) > 2 ? 'bad' : actual(month) > 1.2 ? 'warn' : 'ok', showStuck ? 'giả định giữ ranh giới sai: ' + fmt(stuck(month), 1) : undefined);
    }
    render();
  });

  // =====================================================================
  // 2.14 Event storming
  // =====================================================================
  widget('ch2-event-storming', (root) => {
    const AGGS = [
      { id: 'cust', name: 'Customer', bc: 0 }, { id: 'order', name: 'Order', bc: 0 },
      { id: 'pay', name: 'Payment', bc: 1 },
      { id: 'ship', name: 'Shipment', bc: 2 }, { id: 'stock', name: 'Stock Item', bc: 2 },
    ];
    const BCS = ['Bán hàng', 'Tài chính', 'Kho'];
    const EV = [
      { ev: 'Stock Received', cmd: 'Receive Stock', agg: 'stock' },
      { ev: 'Customer Registered', cmd: 'Register', agg: 'cust' },
      { ev: 'Order Placed', cmd: 'Place Order', agg: 'order' },
      { ev: 'Payment Received', cmd: 'Pay for Order', agg: 'pay' },
      { ev: 'Order Shipped', cmd: 'Ship Order', agg: 'ship' },
    ];
    const STEPS = [
      'Bước 1 — Domain event: những sự việc ta quan tâm, xếp theo dòng thời gian (giấy cam).',
      'Bước 2 — Command: quyết định của con người khiến event xảy ra (giấy xanh dương). Người kỹ thuật chủ yếu lắng nghe.',
      'Bước 3 — Aggregate: danh từ trong event (Order trong “Order Placed”) là ứng viên aggregate (giấy vàng); gom command và event quanh nó.',
      'Bước 4 — Bounded context: nhóm aggregate theo phần tổ chức sử dụng chúng.',
    ];
    const W = 720, H = 330, NW = 124, NH = 32;
    const svg = svgEl(W, H);
    const bcLayer = s('g'), noteLayer = s('g');
    svg.append(bcLayer, noteLayer);
    const mk = (label, fill, stroke) => {
      const g = s('g');
      g.append(s('rect', { x: 0, y: 0, width: NW, height: NH, rx: 4, class: fill + ' ' + stroke, 'stroke-width': 1.5 }));
      g.append(s('text', { x: NW / 2, y: NH / 2 + 4, 'text-anchor': 'middle', 'font-size': 10.5, class: 'lbl-strong' }, label));
      if (!reducedMotion) g.style.transition = 'transform .45s ease, opacity .3s';
      noteLayer.append(g);
      return g;
    };
    const evG = EV.map((e) => mk(e.ev, 'f-mark-soft', 's-mark'));
    const cmdG = EV.map((e) => mk(e.cmd, 'f-violet-soft', 's-violet'));
    const aggG = AGGS.map((a) => mk(a.name, 'f-accent-soft', 's-accent'));
    const place = (g, x, y, show) => { g.style.transform = `translate(${x}px, ${y}px)`; g.style.opacity = show ? 1 : 0; };
    let step = 0;
    const cap = h('p', { class: 'lab-note' });
    const prev = button('← Bước trước', () => { step = Math.max(0, step - 1); render(); }, 'ghost');
    const next = button('Bước tiếp →', () => { step = Math.min(3, step + 1); render(); });
    root.append(
      h('div', { class: 'btn-row' }, prev, next, button('Làm lại', () => { step = 0; render(); }, 'ghost')),
      cap, viz(svg),
      h('div', { class: 'ch2-row' }, pill('Domain event — giấy cam', 'warn'), pill('Command — giấy xanh dương', 'violet'), pill('Aggregate — giấy vàng', 'accent'), pill('Bounded context — khung nét đứt')));

    function render() {
      prev.disabled = step === 0; next.disabled = step === 3;
      cap.textContent = STEPS[step];
      const colX = (i) => 12 + i * 142;
      if (step <= 1) {
        txt(clear(bcLayer), W / 2, H - 12, 'dòng thời gian →', { fs: 10 });
        bcLayer.append(s('line', { x1: 12, x2: W - 12, y1: H - 26, y2: H - 26, class: 'axis' }));
        EV.forEach((e, i) => {
          place(evG[i], colX(i), 150, true);
          place(cmdG[i], colX(i), 100, step >= 1);
        });
        AGGS.forEach((a, i) => place(aggG[i], colX(i), 40, false));
      } else {
        clear(bcLayer);
        AGGS.forEach((a, i) => {
          place(aggG[i], colX(i), 60, true);
          const k = EV.findIndex((e) => e.agg === a.id);
          place(cmdG[k], colX(i), 110, true);
          place(evG[k], colX(i), 160, true);
        });
        if (step === 3) {
          BCS.forEach((name, b) => {
            const idx = AGGS.map((a, i) => (a.bc === b ? i : -1)).filter((i) => i >= 0);
            const x1 = colX(idx[0]) - 6, x2 = colX(idx[idx.length - 1]) + NW + 6;
            bcLayer.append(s('rect', { x: x1, y: 26, width: x2 - x1, height: 186, rx: 12, class: 'f-none s-ink3 dash', 'stroke-width': 1.8 }));
            bcLayer.append(s('text', { x: (x1 + x2) / 2, y: 44, 'text-anchor': 'middle', 'font-size': 11, class: 'lbl-strong' }, name));
          });
        }
        txt(bcLayer, W / 2, 250, step === 3 ? 'Ba bounded context — ứng viên ranh giới cho microservice' : 'Command và event được gom quanh aggregate', { fs: 10.5 });
      }
    }
    render();
  });

  // =====================================================================
  // 2.★ Coupling classifier
  // =====================================================================
  widget('ch2-classifier', (root) => {
    const TYPES = [{ value: 'domain', label: 'Domain' }, { value: 'pass', label: 'Pass-through' }, { value: 'common', label: 'Common' }, { value: 'content', label: 'Content' }];
    const TN = { domain: 'Domain', pass: 'Pass-through', common: 'Common', content: 'Content' };
    const SC = [
      ['Nhiều service cùng đọc bảng danh sách quốc gia tĩnh trong một DB dùng chung.', 'common', 'Dùng chung một tập dữ liệu. Vì dữ liệu tĩnh và chỉ đọc nên khá vô hại.'],
      ['Order Processor gọi Payment để trừ tiền khách.', 'domain', 'Cần chức năng do service khác cung cấp: dạng ghép nối lỏng, khó tránh.'],
      ['Warehouse chạy UPDATE thẳng vào bảng đơn hàng nội bộ của service Order.', 'content', 'Thò vào nội bộ service khác và sửa trạng thái, bỏ qua logic kiểm tra của Order.'],
      ['Order Processor gửi Shipping Manifest cho Warehouse, Warehouse chuyển nguyên cho Shipping.', 'pass', 'Dữ liệu đi qua Warehouse chỉ vì Shipping ở hạ lưu cần nó.'],
      ['Order Processor và Warehouse cùng ghi cột STATUS của bảng Order dùng chung.', 'common', 'Cùng đọc–ghi một tập dữ liệu dùng chung mà cả hai đều biết là phụ thuộc bên ngoài.'],
      ['Notifications gọi API của Customer để lấy email gửi thư chào mừng.', 'domain', 'Gọi qua hợp đồng công khai để dùng chức năng của Customer.'],
      ['Một service đọc và ghi trực tiếp DB riêng của Customer vì “gọi API chậm quá”.', 'content', 'DB nội bộ trở thành hợp đồng ngầm; Customer mất khả năng đổi cấu trúc dữ liệu.'],
      ['Frontend gửi thêm “mã thuế” cho Order chỉ vì service Invoice ở cuối chuỗi cần.', 'pass', 'Bên gọi phải biết nhu cầu của một service cách nó hai bước.'],
    ];
    const ans = new Array(SC.length).fill(null);
    const score = stat('Đúng', '0/' + SC.length);
    const list = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } });
    const rows = SC.map(([q, a, why], i) => {
      const res = h('p', { class: 'lab-note' });
      const sg = seg({ options: TYPES, value: null, label: 'Kiểu ghép nối', onChange: (v) => { ans[i] = v; upd(); } });
      list.append(h('div', { class: 'ch2-scn' }, h('p', h('b', (i + 1) + '. '), q), sg.el, res));
      return { sg, res, a, why };
    });
    root.append(h('div', { class: 'stats' }, score), list, h('div', { class: 'btn-row' }, button('Làm lại', () => { ans.fill(null); rows.forEach((r) => r.sg.set(null)); upd(); }, 'ghost')));

    function upd() {
      let right = 0, done = 0;
      rows.forEach((r, i) => {
        clear(r.res);
        if (!ans[i]) return;
        done++;
        const ok = ans[i] === r.a;
        if (ok) right++;
        r.res.append(pill(ok ? 'Đúng' : 'Chưa đúng — đáp án: ' + TN[r.a], ok ? 'ok' : 'bad'), ' ', r.why);
      });
      score.update(right + '/' + SC.length, done ? (right === done ? 'ok' : 'warn') : '', done + ' tình huống đã trả lời');
    }
    ans[0] = 'common'; rows[0].sg.set('common');
    upd();
  });

  /* 2.7 Content Coupling & Schema Refactor */
  widget('ch2-content-refactor', (root) => {
    const accessMode = seg({
      label: 'Phương thức Warehouse truy cập Đơn hàng',
      value: 'api',
      options: [
        { label: 'Qua Service API (Đúng ranh giới)', value: 'api' },
        { label: 'Ghi thẳng vào SQL Table (Content Coupling)', value: 'direct_sql' }
      ]
    });
    const changeType = seg({
      label: 'Đội Order thay đổi Database nội bộ',
      value: 'rename_col',
      options: [
        { label: 'Đổi tên cột: STATUS -> order_state', value: 'rename_col' },
        { label: 'Tách bảng: items -> order_items', value: 'split_table' },
        { label: 'Thêm kiểm tra trạng thái (Invariants)', value: 'add_validation' }
      ]
    });
    const sBlast = stat('Phạm vi ảnh hưởng (Blast Radius)', '0 sự cố', 'ok');
    const sIndep = stat('Khả năng Deploy độc lập', 'Được bảo toàn', 'ok');
    const logBox = log(5);

    root.appendChild(
      h('div', { class: 'widget' },
        h('div', { class: 'controls' }, accessMode.el, changeType.el),
        h('div', { class: 'stats' }, sBlast, sIndep),
        logBox
      )
    );

    function update() {
      const isApi = accessMode.value === 'api';
      const c = changeType.value;
      if (isApi) {
        sBlast.update('0 sự cố phía Warehouse', 'ok', 'API Adapter che giấu thay đổi SQL nội bộ');
        sIndep.update('Triển khai độc lập 100%', 'ok', 'Đội Order tự do refactor DB');
        logBox.add('✓ API Contract được giữ nguyên. Schema thay đổi chỉ nằm trong Order Service.', 'ok');
      } else {
        if (c === 'rename_col') {
          sBlast.update('SẬP WAREHOUSE SERVICE!', 'bad', 'Warehouse SELECT cột cũ bị lỗi column not found');
          sIndep.update('Mất khả năng Deploy độc lập', 'bad', 'Buộc phải sửa và deploy cả 2 service cùng lúc');
          logBox.add('✕ LỖI RUNTIME: Warehouse gọi "SELECT STATUS FROM orders" bị crash!', 'bad');
        } else if (c === 'split_table') {
          sBlast.update('SẬP TOÀN BỘ QUY TRÌNH XUẤT KHO!', 'bad', 'Bảng items cũ bị xoá, Warehouse truy vấn 404');
          sIndep.update('Lock-step Deployment bắt buộc', 'bad', 'Cần 3 tuần họp bàn liên đội');
          logBox.add('✕ CRITICAL: Warehouse không tìm thấy bảng `items`. Đơn hàng bị treo.', 'bad');
        } else {
          sBlast.update('ĐƠN HÀNG SAI TRẠNG THÁI!', 'warn', 'Warehouse ghi thẳng SQL bỏ qua rule validation mới');
          sIndep.update('Rủi ro hỏng dữ liệu', 'warn', 'Dữ liệu trong DB rơi vào trạng thái kỳ quặc');
          logBox.add('⚠ CẢNH BÁO: Warehouse bypass rule kiểm tra, ghi trạng thái không hợp lệ.', 'warn');
        }
      }
    }
    accessMode.onChange = update;
    changeType.onChange = update;
    update();
  });

  /* Alias HTML widget names */
  widget('ch2-constantine', (root, fig) => { (widgets['ch2-cohesion'] || widgets['ch2-assumptions'])(root, fig); });
  widget('ch2-coupling-classify', (root, fig) => { (widgets['ch2-classifier'] || widgets['ch2-cohesion'])(root, fig); });
  widget('ch2-language', (root, fig) => { (widgets['ch2-ubiquitous'] || widgets['ch2-assumptions'])(root, fig); });
  widget('ch2-aggregate-refs', (root, fig) => { (widgets['ch2-aggregate'] || widgets['ch2-assumptions'])(root, fig); });
  widget('ch2-boundary-checklist', (root, fig) => { (widgets['ch2-drivers'] || widgets['ch2-assumptions'])(root, fig); });

  // =====================================================================
  // Glossary
  // =====================================================================
  glossary.add([
    { key: 'independent-deployability', term: 'Independent deployability', vi: 'khả năng triển khai độc lập', ch: 2, topic: 'ch2-information-hiding', def: 'Thay đổi, triển khai và phát hành một microservice mà không cần triển khai bất kỳ service nào khác. Là mục tiêu cốt lõi khi vẽ ranh giới.' },
    { key: 'modular-decomposition', term: 'Modular decomposition', vi: 'phân rã module', ch: 2, topic: 'ch2-information-hiding', def: 'Chia hệ thống thành các module có ranh giới rõ. Microservice là một dạng phân rã module có thêm mạng giữa các module.' },
    { key: 'information-hiding', term: 'Information hiding', vi: 'che giấu thông tin', ch: 2, topic: 'ch2-information-hiding', def: 'Nguyên tắc của David Parnas: giấu càng nhiều chi tiết càng tốt sau ranh giới module, để giảm giả định giữa các module và tự do thay đổi phần bên trong.' },
    { key: 'cohesion', term: 'Cohesion', vi: 'độ gắn kết', ch: 2, topic: 'ch2-cohesion-coupling', def: '“Code thay đổi cùng nhau thì ở cùng nhau.” Gắn kết mạnh nghĩa là một thay đổi nghiệp vụ chỉ chạm vào ít chỗ, lý tưởng là một service.' },
    { key: 'coupling', term: 'Coupling', vi: 'độ ghép nối', ch: 2, topic: 'ch2-cohesion-coupling', def: 'Mức độ thay đổi ở một service buộc service khác phải đổi theo. Ghép nối lỏng: service biết càng ít càng tốt về các bên cộng tác.' },
    { key: 'chatty-communication', term: 'Chatty communication', vi: 'giao tiếp lắm lời', ch: 2, topic: 'ch2-cohesion-coupling', def: 'Hai service trao đổi rất nhiều lời gọi nhỏ, nhiều loại khác nhau. Ngoài hiệu năng kém, đây thường là dấu hiệu ghép nối chặt.' },
    { key: 'constantines-law', term: 'Constantine’s Law', vi: 'định luật Constantine', ch: 2, topic: 'ch2-cohesion-coupling', def: '“A structure is stable if cohesion is strong and coupling is low.” Phát biểu của Endres & Rombach, tóm lược công trình của Larry Constantine.' },
    { key: 'service-contract', term: 'Service contract', vi: 'hợp đồng của service', ch: 2, topic: 'ch2-cohesion-coupling', def: 'Phần mà service công bố cho bên ngoài dùng (API, event, định dạng dữ liệu). Thay đổi phá vỡ tương thích ngược ở đây buộc consumer phải đổi theo.' },
    { key: 'domain-coupling', term: 'Domain coupling', vi: 'ghép nối miền', ch: 2, topic: 'ch2-domain-coupling', def: 'Một service tương tác với service khác vì cần chức năng nó cung cấp (Order Processor gọi Warehouse, Payment). Dạng lỏng nhất, khó tránh.' },
    { key: 'temporal-coupling', term: 'Temporal coupling', vi: 'ghép nối thời gian', ch: 2, topic: 'ch2-domain-coupling', def: 'Khi gọi đồng bộ, cả hai service phải cùng sống và với tới nhau đúng lúc đó thì thao tác mới hoàn tất. Là mối lo ở thời điểm chạy.' },
    { key: 'message-broker', term: 'Message broker', vi: 'bộ môi giới thông điệp', ch: 2, topic: 'ch2-domain-coupling', def: 'Hạ tầng trung gian nhận và chuyển thông điệp giữa các service, cho phép giao tiếp bất đồng bộ và giảm temporal coupling.' },
    { key: 'pass-through-coupling', term: 'Pass-through coupling', vi: 'ghép nối truyền qua', ch: 2, topic: 'ch2-pass-through', def: 'Service gửi dữ liệu cho service khác chỉ vì một service xa hơn ở hạ lưu cần nó. Page-Jones gọi là tramp coupling.' },
    { key: 'lock-step-release', term: 'Lock-step release', vi: 'phát hành đồng loạt', ch: 2, topic: 'ch2-pass-through', def: 'Nhiều service buộc phải triển khai cùng lúc vì một thay đổi. Đi ngược lại mục tiêu triển khai độc lập.' },
    { key: 'common-coupling', term: 'Common coupling', vi: 'ghép nối dữ liệu chung', ch: 2, topic: 'ch2-common-content', def: 'Hai hay nhiều service dùng chung một tập dữ liệu (DB, bộ nhớ, filesystem). Đổi cấu trúc dữ liệu ảnh hưởng nhiều service cùng lúc.' },
    { key: 'source-of-truth', term: 'Source of truth', vi: 'nguồn sự thật', ch: 2, topic: 'ch2-common-content', def: 'Service duy nhất sở hữu và quyết định trạng thái của một thực thể (như service Order cho đơn hàng); bên khác chỉ gửi yêu cầu.' },
    { key: 'finite-state-machine', term: 'Finite state machine', vi: 'máy trạng thái hữu hạn', ch: 2, topic: 'ch2-common-content', def: 'Mô hình quản lý việc chuyển trạng thái của thực thể, chặn các bước chuyển không hợp lệ (ví dụ PLACED không nhảy thẳng sang PICKING).' },
    { key: 'crud-wrapper', term: 'CRUD wrapper service', vi: 'service vỏ CRUD', ch: 2, topic: 'ch2-common-content', def: 'Service chỉ ánh xạ yêu cầu thẳng thành thao tác database. Dấu hiệu gắn kết yếu: logic quản lý dữ liệu rò ra consumer.' },
    { key: 'resource-contention', term: 'Resource contention', vi: 'tranh chấp tài nguyên', ch: 2, topic: 'ch2-common-content', def: 'Nhiều service cùng dùng một tài nguyên (DB, filesystem) có thể làm nó quá tải; một truy vấn SQL đắt có thể làm cả DB quỵ.' },
    { key: 'content-coupling', term: 'Content coupling', vi: 'ghép nối nội dung', ch: 2, topic: 'ch2-common-content', def: 'Service bên ngoài thò vào nội bộ service khác (thường là DB) và sửa trạng thái của nó. Kiểu chặt nhất, còn gọi là pathological coupling.' },
    { key: 'static-reference-data', term: 'Static reference data', vi: 'dữ liệu tham chiếu tĩnh', ch: 2, topic: 'ch2-common-content', def: 'Dữ liệu ít thay đổi, chỉ đọc, như danh sách quốc gia. Chia sẻ loại dữ liệu này tương đối vô hại.' },
    { key: 'volatility-based-decomposition', term: 'Volatility-based decomposition', vi: 'phân rã theo tần suất thay đổi', ch: 2, topic: 'ch2-volatility', def: 'Tách những phần thay đổi thường xuyên ra service riêng. Hợp với mục tiêu ra thị trường nhanh, ít tác dụng khi cần scale.' },
    { key: 'bimodal-it', term: 'Bimodal IT', vi: 'CNTT hai chế độ', ch: 2, topic: 'ch2-volatility', def: 'Khái niệm của Gartner: Mode 1 (Systems of Record, ít đổi) và Mode 2 (Systems of Innovation, đổi nhanh). Sam Newman cho rằng nó quá đơn giản và cố định.' },
    { key: 'pii', term: 'PII (Personally Identifiable Information)', vi: 'thông tin định danh cá nhân', ch: 2, topic: 'ch2-data', def: 'Dữ liệu xác định được một người. Giới hạn số service xử lý PII giúp giảm rủi ro rò rỉ và đơn giản hoá tuân thủ GDPR.' },
    { key: 'pci-dss', term: 'PCI Level 1', vi: 'cấp tuân thủ PCI cao nhất', ch: 2, topic: 'ch2-data', def: 'Mức khắt khe nhất của Payment Card Industry cho bên xử lý dữ liệu thẻ khối lượng lớn; đòi hỏi đánh giá bên ngoài hằng quý.' },
    { key: 'three-tier-architecture', term: 'Three-tier architecture', vi: 'kiến trúc ba tầng', ch: 2, topic: 'ch2-data', def: 'Chia hệ thống theo công nghệ: giao diện, logic, dữ liệu. Ví dụ của phân rã theo kỹ thuật, thường không lý tưởng cho thay đổi nghiệp vụ.' },
    { key: 'conways-law', term: 'Conway’s Law', vi: 'định luật Conway', ch: 2, topic: 'ch2-tech-org', def: 'Cấu trúc giao tiếp của tổ chức sẽ phản chiếu vào kiến trúc hệ thống mà tổ chức đó tạo ra.' },
    { key: 'rpc', term: 'RPC (Remote Procedure Call)', vi: 'gọi thủ tục từ xa', ch: 2, topic: 'ch2-tech-org', def: 'Kiểu giao tiếp gọi hàm ở tiến trình khác như gọi hàm cục bộ. RPC kiểu phương thức mức thấp dễ giòn và lắm lời.' },
    { key: 'onion-architecture', term: 'Onion architecture (theo Sam Newman)', vi: 'kiến trúc củ hành', ch: 2, topic: 'ch2-tech-org', def: 'Cách Sam Newman gọi hệ thống bị cắt ngang thành nhiều lớp service: nhiều lớp, và làm ông muốn khóc mỗi khi phải cắt xuyên qua.' },
    { key: 'vertical-slice', term: 'Vertical slice', vi: 'lát cắt dọc', ch: 2, topic: 'ch2-tech-org', def: 'Một phần hệ thống trọn vẹn từ giao diện tới dữ liệu cho một mảng nghiệp vụ, do một đội sở hữu. Ngược với cắt ngang theo tầng kỹ thuật.' },
    { key: 'delivery-contention', term: 'Delivery contention', vi: 'tranh chấp bàn giao', ch: 2, topic: 'ch2-goals-mixing', def: 'Nhiều đội cùng phải thay đổi và phát hành một phần mã, giẫm chân nhau và làm chậm tốc độ thay đổi.' },
    { key: 'domain-driven-design', term: 'Domain-Driven Design (DDD)', vi: 'thiết kế hướng miền', ch: 2, topic: 'ch2-ubiquitous-language', def: 'Phương pháp của Eric Evans (2004) để thể hiện domain nghiệp vụ trong phần mềm: ngôn ngữ chung, aggregate, bounded context…' },
    { key: 'ubiquitous-language', term: 'Ubiquitous language', vi: 'ngôn ngữ chung', ch: 2, topic: 'ch2-ubiquitous-language', def: 'Dùng trong code đúng những thuật ngữ người dùng và chuyên gia nghiệp vụ dùng, để mô hình hoá dễ hơn và giao tiếp tốt hơn.' },
    { key: 'aggregate', term: 'Aggregate', vi: 'tập hợp (DDD)', ch: 2, topic: 'ch2-aggregate', def: 'Biểu diễn một khái niệm domain thật (Order, Invoice) có trạng thái, định danh, vòng đời; do đúng một microservice quản lý và có thể từ chối yêu cầu chuyển trạng thái.' },
    { key: 'bounded-context', term: 'Bounded context', vi: 'ngữ cảnh giới hạn', ch: 2, topic: 'ch2-bounded-context', def: 'Ranh giới (thường ứng với bộ phận tổ chức) có trách nhiệm rõ ràng và giao diện tường minh, chứa một hoặc nhiều aggregate, che giấu chi tiết bên trong.' },
    { key: 'hidden-model', term: 'Hidden model', vi: 'mô hình ẩn', ch: 2, topic: 'ch2-bounded-context', def: 'Khái niệm chỉ có nghĩa bên trong một bounded context (xe nâng, kệ hàng trong kho) và không cần lộ ra ngoài.' },
    { key: 'shared-model', term: 'Shared model', vi: 'mô hình chia sẻ', ch: 2, topic: 'ch2-bounded-context', def: 'Khái niệm xuất hiện ở nhiều bounded context; chỉ chia sẻ phần cần thiết, có thể đặt tên khác (Stock Item → Stock Count, Customer → Recipient).' },
    { key: 'coarse-grained-api', term: 'Coarse-grained API', vi: 'API thô (mức hạt lớn)', ch: 2, topic: 'ch2-nesting-premature', def: 'API ở mức bounded context lớn, che giấu việc bên trong đã được tách thành nhiều service nhỏ hơn.' },
    { key: 'premature-decomposition', term: 'Premature decomposition', vi: 'phân rã quá sớm', ch: 2, topic: 'ch2-nesting-premature', def: 'Tách hệ thống thành microservice khi chưa hiểu rõ domain, dẫn tới ranh giới sai và chi phí thay đổi cao — như SnapCI.' },
    { key: 'event-storming', term: 'Event Storming', vi: 'bão sự kiện', ch: 2, topic: 'ch2-event-storming', def: 'Kỹ thuật brainstorm cộng tác của Alberto Brandolini: người kỹ thuật và nghiệp vụ cùng dán giấy nhớ để làm lộ ra event, command, aggregate và bounded context.' },
    { key: 'domain-event', term: 'Domain event', vi: 'sự kiện miền', ch: 2, topic: 'ch2-event-storming', def: 'Sự việc đã xảy ra trong domain mà ta quan tâm, như “Order Placed” hay “Payment Received”. Giấy cam trong Event Storming.' },
    { key: 'command', term: 'Command (Event Storming)', vi: 'lệnh', ch: 2, topic: 'ch2-event-storming', def: 'Quyết định của con người (người dùng) khiến một domain event xảy ra. Giấy xanh dương trong Event Storming.' },
  ]);
})();
