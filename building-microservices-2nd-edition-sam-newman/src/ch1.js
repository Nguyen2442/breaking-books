(function () {
  const { h, s, clear, fmt, pct, rng, clamp, sleep,
          slider, seg, button, checkbox, stat, log, widget, glossary, nextId } = window.DDIA;

  /* ---------- small SVG + control helpers used across this chapter ---------- */
  const T = (x, y, str, cls) => s('text', { x, y, class: cls || '' }, str);
  const R = (x, y, w, hh, cls, rx) => s('rect', { x, y, width: w, height: hh, rx: rx == null ? 6 : rx, class: cls });
  const L = (x1, y1, x2, y2, cls) => s('line', { x1, y1, x2, y2, class: 'f-none ' + (cls || 's-ink3') });
  /** arrow from (x1,y1) to (x2,y2); tone = accent|ok|bad|warn|violet|ink|ink3 */
  function arrow(x1, y1, x2, y2, tone, extra) {
    const a = Math.atan2(y2 - y1, x2 - x1), sz = 7;
    const p = [[x2, y2], [x2 - sz * Math.cos(a - 0.45), y2 - sz * Math.sin(a - 0.45)], [x2 - sz * Math.cos(a + 0.45), y2 - sz * Math.sin(a + 0.45)]];
    return s('g', null,
      L(x1, y1, x2 - 4 * Math.cos(a), y2 - 4 * Math.sin(a), 's-' + tone + ' ' + (extra || '')),
      s('polygon', { points: p.map((q) => q.map((n) => n.toFixed(1)).join(',')).join(' '), class: 'f-' + tone }));
  }
  /** labelled box centred at (cx, cy) */
  function node(cx, cy, w, hh, label, cls, sub, subCls) {
    const g = s('g', { class: 'node' }, R(cx - w / 2, cy - hh / 2, w, hh, cls));
    g.appendChild(T(cx, sub ? cy - 2 : cy + 4, label, 'lbl-strong t-mid'));
    if (sub) g.appendChild(T(cx, cy + 12, sub, 't-mid t-sm ' + (subCls || '')));
    return g;
  }
  function select(o) {
    const id = nextId('sel');
    const el = h('select', { id }, o.options.map((op) => h('option', { value: op.value }, op.label)));
    el.value = o.value;
    el.addEventListener('change', () => o.onChange && o.onChange(el.value));
    const wrap = h('div', { class: 'ctl' }, h('label', { for: id }, h('span', o.label)), el);
    return { el: wrap, input: el, get value() { return el.value; }, set(v) { el.value = v; } };
  }
  /** tab strip: defs = [{value, label, build(panel)}] */
  function tabs(root, defs, value) {
    const panels = {};
    const sg = seg({ label: 'Chọn tab', options: defs.map((d) => ({ value: d.value, label: d.label })), value, onChange: show });
    root.append(h('div', { class: 'controls' }, sg.el));
    defs.forEach((d) => {
      const p = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } });
      panels[d.value] = p;
      root.append(p);
      d.build(p);
    });
    function show(v) { defs.forEach((d) => { panels[d.value].style.display = d.value === v ? 'flex' : 'none'; }); }
    show(value);
  }
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  /* ========== 1.1 Black box ========== */
  widget('ch1-blackbox', (root) => {
    const CHANGES = [
      { v: 'lang', label: 'Viết lại bên trong bằng Kotlin thay cho Java', part: 'lang', kind: 'internal', affects: [] },
      { v: 'db', label: 'Chuyển database từ MySQL sang PostgreSQL', part: 'db', kind: 'internal', affects: [] },
      { v: 'cache', label: 'Thêm cache nội bộ để trả lời nhanh hơn', part: 'fw', kind: 'internal', affects: [] },
      { v: 'add', label: 'Thêm trường mới “tier” vào response REST', part: 'rest', kind: 'compatible', affects: [] },
      { v: 'rename', label: 'Đổi tên trường “email” thành “emailAddress”', part: 'rest', kind: 'breaking', affects: ['order', 'web'] },
      { v: 'event', label: 'Đổi cấu trúc sự kiện CustomerUpdated trên queue', part: 'queue', kind: 'breaking', affects: ['loyalty'] },
    ];
    const sel = select({ label: 'Thay đổi trong service Customer', options: CHANGES.map((c) => ({ value: c.v, label: c.label })), value: 'db', onChange: render });
    const stScope = stat('Phạm vi thay đổi', '', 'ok');
    const stCons = stat('Consumer phải sửa theo', '', 'ok');
    const stRel = stat('Release độc lập?', '', 'ok');
    const viz = h('div', { class: 'viz' });
    const note = h('p', { class: 'lab-note' });
    root.append(h('div', { class: 'controls' }, sel.el), h('div', { class: 'stats' }, stScope, stCons, stRel), viz, note);

    function render() {
      const c = CHANGES.find((x) => x.v === sel.value);
      const svg = s('svg', { viewBox: '0 0 480 250', role: 'img', 'aria-label': 'Service Customer như một hộp đen' });
      // the black box
      svg.appendChild(R(14, 20, 250, 214, 'f-surface2 s-ink s-w2', 10));
      svg.appendChild(T(26, 40, 'Customer (hộp đen)', 'lbl-strong'));
      svg.appendChild(R(26, 52, 168, 168, 'f-none s-ink3 dash', 8));
      svg.appendChild(T(110, 70, 'Bên trong: dễ thay đổi', 't-mid t-sm t-dim'));
      const inner = [
        ['lang', c.v === 'lang' ? 'Ngôn ngữ: Kotlin' : 'Ngôn ngữ: Java', 80],
        ['fw', c.v === 'cache' ? 'Framework + cache' : 'Framework', 128],
        ['db', c.v === 'db' ? 'DB: PostgreSQL' : 'DB: MySQL', 176],
      ];
      inner.forEach(([k, label, y]) => {
        const hit = c.part === k;
        svg.appendChild(R(38, y, 144, 34, hit ? 'f-accent-soft s-accent s-w2' : 'f-surface s-line'));
        svg.appendChild(T(110, y + 21, label, 't-mid' + (hit ? ' lbl-strong' : '')));
      });
      // endpoints (the contract)
      const ep = { rest: { y: 86, label: 'REST /customers' }, queue: { y: 168, label: 'Queue sự kiện' } };
      svg.appendChild(T(232, 232 - 4, 'Hợp đồng', 't-mid t-sm t-dim'));
      Object.entries(ep).forEach(([k, e]) => {
        const hit = c.part === k;
        const cls = !hit ? 'f-surface s-ink' : c.kind === 'breaking' ? 'f-bad-soft s-bad s-w2' : 'f-ok-soft s-ok s-w2';
        svg.appendChild(R(200, e.y, 64, 40, cls, 6));
        svg.appendChild(T(232, e.y + 17, k === 'rest' ? 'REST' : 'Queue', 't-mid lbl-strong'));
        svg.appendChild(T(232, e.y + 31, k === 'rest' ? '/customers' : 'events', 't-mid t-sm'));
      });
      // consumers
      const cons = [
        { k: 'order', label: 'Order', y: 50, via: 'rest' },
        { k: 'web', label: 'Web app', y: 112, via: 'rest' },
        { k: 'loyalty', label: 'Loyalty', y: 190, via: 'queue' },
      ];
      cons.forEach((cn) => {
        const broken = c.affects.includes(cn.k);
        const tone = broken ? 'bad' : 'ok';
        const e = ep[cn.via];
        if (cn.via === 'rest') svg.appendChild(arrow(350, cn.y, 268, e.y + 20, tone, broken ? 's-w2' : ''));
        else svg.appendChild(arrow(268, e.y + 20, 350, cn.y, tone, broken ? 's-w2' : ''));
        svg.appendChild(node(410, cn.y, 112, 40, cn.label, broken ? 'f-bad-soft s-bad s-w2' : 'f-ok-soft s-ok', broken ? 'phải sửa + deploy' : 'không ảnh hưởng', broken ? 't-bad' : 't-ok'));
      });
      clear(viz).appendChild(svg);

      const n = c.affects.length;
      if (c.kind === 'internal') {
        stScope.update('Nội bộ', 'ok', 'không ai bên ngoài thấy');
        note.textContent = 'Thay đổi nằm trọn trong hộp đen. Consumer chỉ nhìn thấy endpoint nên không hề biết bên trong đã đổi. Customer có thể release ngay.';
      } else if (c.kind === 'compatible') {
        stScope.update('Hợp đồng, tương thích', 'accent', 'chỉ thêm, không bớt');
        note.textContent = 'Thêm trường mới vào response là thay đổi tương thích ngược: consumer cũ cứ bỏ qua trường lạ. Hợp đồng lớn thêm một chút, nhưng chưa ai phải sửa.';
      } else {
        stScope.update('Hợp đồng, phá vỡ', 'bad', 'breaking change');
        note.textContent = 'Thay đổi này phá hợp đồng mạng. Mọi consumer dùng phần đó phải sửa và deploy theo, nếu không sẽ lỗi. Đây chính là thứ information hiding muốn tránh.';
      }
      stCons.update(n + '/3', n ? 'bad' : 'ok', n ? cons.filter((x) => c.affects.includes(x.k)).map((x) => x.label).join(', ') : 'không ai');
      stRel.update(n ? 'Không' : 'Có', n ? 'bad' : 'ok', n ? 'phải phối hợp release' : 'deploy Customer một mình');
    }
    render();
  });

  /* ========== 1.2 SOA vs microservices ========== */
  widget('ch1-soa', (root) => {
    const TRAITS = [
      { k: 'net', label: 'Chức năng chia thành nhiều service, gọi nhau qua mạng' },
      { k: 'own', label: 'Mỗi service tự sở hữu dữ liệu (không dùng chung DB)' },
      { k: 'indep', label: 'Từng service deploy được độc lập' },
      { k: 'domain', label: 'Ranh giới service vẽ theo nghiệp vụ' },
      { k: 'esb', label: 'Logic nghiệp vụ nằm trong ESB/middleware của nhà cung cấp' },
    ];
    const SCEN = {
      mono: { net: 0, own: 0, indep: 0, domain: 0, esb: 0 },
      esb: { net: 1, own: 0, indep: 0, domain: 0, esb: 1 },
      shared: { net: 1, own: 0, indep: 0, domain: 1, esb: 0 },
      micro: { net: 1, own: 1, indep: 1, domain: 1, esb: 0 },
    };
    const state = Object.assign({}, SCEN.shared);
    const sg = seg({
      label: 'Kịch bản mẫu',
      options: [{ value: 'mono', label: 'Monolith' }, { value: 'esb', label: 'SOA + ESB' }, { value: 'shared', label: 'Nhiều service, DB chung' }, { value: 'micro', label: 'Microservices' }],
      value: 'shared',
      onChange: (v) => { Object.assign(state, SCEN[v]); boxes.forEach((b) => { b.input.checked = !!state[b.k]; }); render(); },
    });
    const boxes = TRAITS.map((t) => {
      const cb = checkbox(t.label, !!state[t.k], (v) => { state[t.k] = v ? 1 : 0; sg.set('custom'); render(); });
      cb.k = t.k;
      return cb;
    });
    const stCls = stat('Phân loại', '', 'accent');
    const stScore = stat('Đặc điểm microservices đạt', '', 'accent');
    const viz = h('div', { class: 'viz' });
    const reasons = h('ul', { class: 'ch1-reasons' });
    root.append(
      h('div', { class: 'controls' }, sg.el),
      h('div', { class: 'lab-split' },
        h('div', { class: 'box' }, h('h5', 'Đặc điểm của hệ thống'), h('div', { class: 'ch1-chk' }, boxes.map((b) => b.el))),
        h('div', { class: 'box' }, h('h5', 'Vì sao'), reasons)),
      h('div', { class: 'stats' }, stCls, stScore), viz);

    function render() {
      const met = ['own', 'indep', 'domain'].filter((k) => state[k]).length + (state.esb ? 0 : 1);
      const isSoa = !!state.net;
      const isMicro = isSoa && met === 4;
      clear(reasons);
      const add = (ok, text) => reasons.appendChild(h('li', { class: ok ? 'pro' : 'con' }, text));
      add(isSoa, isSoa ? 'Nhiều service hợp tác qua mạng: đúng định nghĩa SOA.' : 'Mọi thứ gọi nhau trong một tiến trình: chưa phải SOA.');
      if (isSoa) {
        add(!!state.own, state.own ? 'Mỗi service giấu database của mình.' : 'Dùng chung database: schema thành hợp đồng ngầm.');
        add(!!state.indep, state.indep ? 'Release từng service một.' : 'Phải deploy đồng loạt: release lock-step.');
        add(!!state.domain, state.domain ? 'Ranh giới theo nghiệp vụ, thay đổi ít khi lan ra.' : 'Không có hướng dẫn chia service: ranh giới tuỳ tiện.');
        add(!state.esb, state.esb ? 'Logic nằm trong middleware: các service khó thay đổi độc lập.' : 'Đường ống mạng “ngốc”, logic nằm trong service.');
      }
      stCls.update(isMicro ? 'Microservices' : isSoa ? 'SOA, chưa phải microservices' : 'Chưa phải SOA', isMicro ? 'ok' : isSoa ? 'warn' : 'bad');
      stScore.update(isSoa ? met + '/4' : '—', isMicro ? 'ok' : 'warn', isSoa ? 'DB riêng, deploy độc lập, nghiệp vụ, không ESB' : 'cần nhiều service trước đã');

      const svg = s('svg', { viewBox: '0 0 440 230', role: 'img', 'aria-label': 'Sơ đồ tập hợp SOA và microservices' });
      svg.appendChild(R(6, 6, 428, 218, 'f-surface s-line', 10));
      svg.appendChild(T(18, 26, 'Mọi hệ thống', 't-sm t-dim'));
      svg.appendChild(s('ellipse', { cx: 270, cy: 122, rx: 155, ry: 96, class: 'f-accent-soft s-accent' }));
      svg.appendChild(T(170, 52, 'SOA', 'lbl-strong t-accent'));
      svg.appendChild(s('ellipse', { cx: 320, cy: 132, rx: 82, ry: 58, class: 'f-ok-soft s-ok s-w2' }));
      svg.appendChild(T(320, 100, 'Microservices', 'lbl-strong t-mid t-ok'));
      let x, y;
      if (!isSoa) { x = 60; y = 150; }
      else if (isMicro) { x = 320; y = 140; }
      else { x = 150 + met * 18; y = 150; }
      svg.appendChild(s('circle', { cx: x, cy: y, r: 9, class: (isMicro ? 'f-ok' : isSoa ? 'f-warn' : 'f-bad') + ' pulse' }));
      svg.appendChild(T(x, y + 26, 'hệ thống của bạn', 't-mid t-sm lbl-strong'));
      clear(viz).appendChild(svg);
    }
    render();
  });

  /* ========== 1.3 Independent deployability ========== */
  widget('ch1-independent-deploy', (root) => {
    const NODES = {
      web: { label: 'Web UI', x: 240, y: 30 },
      order: { label: 'Order', x: 110, y: 110 },
      customer: { label: 'Customer', x: 370, y: 110 },
      shipping: { label: 'Shipping', x: 110, y: 210 },
      inventory: { label: 'Inventory', x: 240, y: 210 },
    };
    const EDGES = [['web', 'order'], ['web', 'customer'], ['order', 'customer'], ['order', 'inventory'], ['shipping', 'order']]; // consumer -> provider
    const SHARED = ['order', 'customer', 'inventory'];
    const DB = { x: 380, y: 210 };
    let running = false, active = null;
    const sgSvc = seg({ label: 'Service cần sửa', options: Object.entries(NODES).map(([k, n]) => ({ value: k, label: n.label })), value: 'customer', onChange: render });
    const cbShared = checkbox('Order, Customer, Inventory dùng chung database', true, render);
    const cbBreak = checkbox('Thay đổi phá vỡ hợp đồng (breaking change)', false, render);
    const btn = button('Deploy thay đổi', run);
    const stN = stat('Service phải deploy', '', 'ok');
    const stKind = stat('Kiểu release', '', 'ok');
    const stTeams = stat('Đội phải phối hợp', '', 'ok');
    const viz = h('div', { class: 'viz' });
    const lg = log();
    root.append(
      h('div', { class: 'controls' }, sgSvc.el),
      h('div', { class: 'ch1-chk' }, cbShared.el, cbBreak.el),
      h('div', { class: 'btn-row' }, btn),
      h('div', { class: 'stats' }, stN, stKind, stTeams), viz, lg,
      h('p', { class: 'lab-note' }, 'Giả định: khi dùng chung database, thay đổi có đụng tới bảng của service được sửa, nên mọi service đọc chung database phải deploy theo.'));

    function plan() {
      const c = sgSvc.value;
      const why = new Map([[c, 'service được sửa']]);
      if (cbBreak.value) EDGES.filter((e) => e[1] === c).forEach((e) => { if (!why.has(e[0])) why.set(e[0], 'consumer của hợp đồng bị phá'); });
      if (cbShared.value && SHARED.includes(c)) SHARED.forEach((k) => { if (!why.has(k)) why.set(k, 'đọc chung bảng vừa đổi schema'); });
      return why;
    }
    function draw(why, done) {
      const svg = s('svg', { viewBox: '0 0 460 245', role: 'img', 'aria-label': 'Sơ đồ phụ thuộc giữa các service' });
      const c = sgSvc.value;
      if (cbShared.value) {
        SHARED.forEach((k) => svg.appendChild(L(NODES[k].x, NODES[k].y, DB.x, DB.y, 's-warn dash')));
        svg.appendChild(s('ellipse', { cx: DB.x, cy: DB.y, rx: 44, ry: 18, class: 'f-warn-soft s-warn s-w2' }));
        svg.appendChild(T(DB.x, DB.y + 4, 'DB chung', 't-mid lbl-strong'));
      }
      EDGES.forEach(([a, b]) => {
        const A = NODES[a], B = NODES[b];
        const hot = cbBreak.value && b === c;
        const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy);
        const ox = Math.abs(dx) / len > 0.8 ? 52 : 18, oy = Math.abs(dy) / len > 0.5 ? 19 : 6;
        const ux = dx / len, uy = dy / len;
        const k = Math.min(ox / Math.max(Math.abs(ux), 1e-3), oy / Math.max(Math.abs(uy), 1e-3));
        svg.appendChild(arrow(A.x + ux * k, A.y + uy * k, B.x - ux * k, B.y - uy * k, hot ? 'bad' : 'ink3', hot ? 's-w2' : ''));
      });
      Object.entries(NODES).forEach(([k, n]) => {
        let cls = 'f-surface s-line', sub = cbShared.value ? '' : 'DB riêng', subCls = 't-dim';
        if (why.has(k)) {
          cls = (k === c ? 'f-accent-soft s-accent' : 'f-bad-soft s-bad') + ' s-w2';
          sub = done.has(k) ? 'đã deploy' : 'phải deploy';
          subCls = k === c ? 't-accent' : 't-bad';
          if (k === active) cls += ' pulse';
        }
        if (SHARED.includes(k) && cbShared.value && !why.has(k)) sub = '';
        if (!SHARED.includes(k) && cbShared.value && !why.has(k)) sub = 'DB riêng';
        svg.appendChild(node(n.x, n.y, 100, 38, n.label, cls, sub, subCls));
      });
      clear(viz).appendChild(svg);
    }
    function render() {
      if (running) return;
      const why = plan();
      draw(why, new Set());
      const n = why.size;
      stN.update(String(n), n === 1 ? 'ok' : 'bad', [...why.keys()].map((k) => NODES[k].label).join(', '));
      stKind.update(n === 1 ? 'Độc lập' : 'Lock-step', n === 1 ? 'ok' : 'bad', n === 1 ? 'chỉ một service lên production' : 'phải deploy cùng nhau, đúng thứ tự');
      stTeams.update(String(n), n === 1 ? 'ok' : 'warn', 'giả sử mỗi service một đội');
      lg.reset();
      [...why.entries()].forEach(([k, r]) => lg.add(`${NODES[k].label}: ${r}`, k === sgSvc.value ? 'acc' : 'bad'));
    }
    async function run() {
      if (running) return;
      running = true; btn.disabled = true;
      const why = plan(), done = new Set();
      lg.reset();
      lg.add(`Bắt đầu release thay đổi của ${NODES[sgSvc.value].label}`, 't');
      for (const [k, r] of why) {
        active = k;
        draw(why, done);
        lg.add(`Deploy ${NODES[k].label} (${r})…`, k === sgSvc.value ? 'acc' : 'warn');
        await sleep(650);
        done.add(k);
      }
      active = null;
      draw(why, done);
      lg.add(why.size === 1 ? 'Xong. Không service nào khác phải đụng tới.' : `Xong sau ${why.size} lần deploy phải phối hợp.`, why.size === 1 ? 'ok' : 'bad');
      running = false; btn.disabled = false;
    }
    render();
  });

  /* ========== 1.4 Horizontal vs vertical slicing ========== */
  widget('ch1-slicing', (root) => {
    const DOMAINS = ['Khách hàng', 'Danh mục', 'Đơn hàng'];
    const LAYERS = ['UI', 'Logic', 'Dữ liệu'];
    const TONES = [['f-accent-soft', 's-accent'], ['f-violet-soft', 's-violet'], ['f-ok-soft', 's-ok']];
    const N = 20;
    let runs = 0, running = false;
    const slUi = slider({ label: 'Tỉ lệ yêu cầu chỉ đổi giao diện', min: 0, max: 80, step: 5, value: 20, format: (v) => v + '%', onInput: () => { if (!running) show(simulate(1)); } });
    const btn = button('Mô phỏng yêu cầu thay đổi', run);
    const stH = stat('Cắt ngang: yêu cầu xuyên service', '', 'bad');
    const stV = stat('Cắt dọc: yêu cầu xuyên service', '', 'ok');
    const stHt = stat('Cắt ngang: lượt deploy', '', 'warn');
    const stVt = stat('Cắt dọc: lượt deploy', '', 'ok');
    const vizH = h('div', { class: 'viz' }), vizV = h('div', { class: 'viz' });
    const lg = log();
    root.append(
      h('div', { class: 'controls' }, slUi.el, h('div', { class: 'btn-row' }, btn)),
      h('div', { class: 'lab-split' },
        h('div', { class: 'box' }, h('h5', 'Cắt ngang theo tầng kỹ thuật'), vizH),
        h('div', { class: 'box' }, h('h5', 'Cắt dọc theo nghiệp vụ'), vizV)),
      h('div', { class: 'stats' }, stH, stV, stHt, stVt), lg);

    function simulate(seed) {
      const r = rng(seed * 7919 + slUi.value);
      const pUi = slUi.value / 100, pCross = 0.15;
      const reqs = [];
      for (let i = 0; i < N; i++) {
        const x = r(), d = Math.floor(r() * 3);
        if (x < pUi) reqs.push({ name: `Đổi giao diện trang ${DOMAINS[d]}`, cells: [[d, 0]] });
        else if (x < 1 - pCross) reqs.push({ name: `Thêm trường nghiệp vụ mới cho ${DOMAINS[d]}`, cells: [[d, 0], [d, 1], [d, 2]] });
        else { const e = (d + 1 + Math.floor(r() * 2)) % 3; reqs.push({ name: `Nối ${DOMAINS[d]} với ${DOMAINS[e]}`, cells: [[d, 1], [d, 2], [e, 1], [e, 2]] }); }
      }
      return reqs.map((q) => ({ ...q, h: new Set(q.cells.map((c) => c[1])).size, v: new Set(q.cells.map((c) => c[0])).size }));
    }
    function grid(mode, cells) {
      const svg = s('svg', { viewBox: '0 0 260 190', role: 'img', 'aria-label': 'Lưới 3 nghiệp vụ nhân 3 tầng' });
      DOMAINS.forEach((d, i) => svg.appendChild(T(80 + i * 60 + 27, 16, d, 't-mid t-sm')));
      LAYERS.forEach((l, j) => {
        svg.appendChild(T(66, 28 + j * 52 + 30, l, 't-end t-sm'));
        DOMAINS.forEach((_, i) => {
          const svc = mode === 'h' ? j : i;
          const hit = cells && cells.some((c) => c[0] === i && c[1] === j);
          svg.appendChild(R(80 + i * 60, 26 + j * 52, 54, 46, TONES[svc].join(' ') + (hit ? ' s-w3' : ''), 6));
          if (hit) svg.appendChild(s('circle', { cx: 80 + i * 60 + 27, cy: 26 + j * 52 + 23, r: 6, class: 'f-mark' }));
        });
      });
      // service outlines
      for (let k = 0; k < 3; k++) {
        if (mode === 'h') svg.appendChild(R(76, 22 + k * 52, 182, 54, 'f-none ' + TONES[k][1] + ' dash', 8));
        else svg.appendChild(R(76 + k * 60, 22, 62, 158, 'f-none ' + TONES[k][1] + ' dash', 8));
      }
      return svg;
    }
    function show(reqs, cur) {
      const upto = cur == null ? reqs : reqs.slice(0, cur + 1);
      const cells = cur == null ? null : reqs[cur].cells;
      clear(vizH).appendChild(grid('h', cells));
      clear(vizV).appendChild(grid('v', cells));
      const hx = upto.filter((q) => q.h > 1).length, vx = upto.filter((q) => q.v > 1).length;
      const ht = upto.reduce((a, q) => a + q.h, 0), vt = upto.reduce((a, q) => a + q.v, 0);
      stH.update(`${hx}/${upto.length}`, 'bad', 'cần nhiều đội phối hợp');
      stV.update(`${vx}/${upto.length}`, vx > hx ? 'bad' : 'ok', 'cần nhiều đội phối hợp');
      stHt.update(String(ht), 'warn', 'tổng số service bị chạm');
      stVt.update(String(vt), 'ok', 'tổng số service bị chạm');
      if (cur == null) {
        lg.reset();
        reqs.forEach((q, i) => lg.add(`#${i + 1} ${q.name} — ngang: ${q.h} · dọc: ${q.v} service`, q.h > q.v ? 'warn' : 't'));
      }
    }
    async function run() {
      if (running) return;
      running = true; btn.disabled = true;
      runs++;
      const reqs = simulate(runs + 1);
      lg.reset();
      for (let i = 0; i < reqs.length; i++) {
        show(reqs, i);
        const q = reqs[i];
        lg.add(`#${i + 1} ${q.name} — ngang: ${q.h} · dọc: ${q.v} service`, q.h > q.v ? 'warn' : 't');
        await sleep(160);
      }
      show(reqs);
      running = false; btn.disabled = false;
    }
    show(simulate(1));
  });

  /* ========== 1.5 Owning their own state ========== */
  widget('ch1-own-state', (root) => {
    const CH = {
      none: { label: 'Chưa đổi gì', schema: 'customer(id, name, <b>email</b>, <b>city</b>, tier)', breaks: [] },
      rename: { label: 'Đổi tên cột email thành email_address', schema: 'customer(id, name, <mark>email_address</mark>, city, tier)', breaks: ['order'] },
      split: { label: 'Tách địa chỉ sang bảng customer_address', schema: 'customer(id, name, email, tier)\n<mark>customer_address(customer_id, city, street)</mark>', breaks: ['loyalty'] },
      engine: { label: 'Chuyển từ MySQL sang MongoDB', schema: '<mark>collection customers { _id, name, email, address: {city} }</mark>', breaks: ['order', 'loyalty'] },
    };
    const sgMode = seg({ label: 'Cách lấy dữ liệu', options: [{ value: 'db', label: 'Đọc thẳng bảng của Customer' }, { value: 'api', label: 'Gọi API của Customer' }], value: 'db', onChange: render });
    const sel = select({ label: 'Thay đổi nội bộ của Customer', options: Object.entries(CH).map(([v, c]) => ({ value: v, label: c.label })), value: 'rename', onChange: render });
    const stBroken = stat('Consumer bị vỡ', '', 'ok');
    const stDeploy = stat('Phải deploy cùng lúc', '', 'ok');
    const stInd = stat('Customer release độc lập?', '', 'ok');
    const viz = h('div', { class: 'viz' });
    const schema = h('pre', { class: 'code' });
    const boxO = h('div', { class: 'box' }), boxL = h('div', { class: 'box' });
    root.append(
      h('div', { class: 'controls' }, sgMode.el, sel.el),
      h('div', { class: 'stats' }, stBroken, stDeploy, stInd), viz,
      h('div', { class: 'box' }, h('h5', 'Schema nội bộ của Customer'), schema),
      h('div', { class: 'lab-split' }, boxO, boxL));

    function fill(box, title, broken, code, status) {
      clear(box);
      box.append(h('h5', title), h('pre', { class: 'code', style: { margin: '0 0 8px' }, html: code }),
        h('span', { class: 'pill ' + (broken ? 'bad' : 'ok') }, status));
    }
    function render() {
      const c = CH[sel.value], db = sgMode.value === 'db';
      const br = db ? c.breaks : [];
      schema.innerHTML = c.schema;
      if (db) {
        fill(boxO, 'Order', br.includes('order'),
          '<span class="k">SELECT</span> name, email\n<span class="k">FROM</span> customer <span class="k">WHERE</span> id = <span class="n">42</span>;',
          br.includes('order') ? (sel.value === 'engine' ? 'Lỗi: không còn bảng SQL' : 'Lỗi: unknown column email') : 'Chạy được (cho tới lần đổi sau)');
        fill(boxL, 'Loyalty', br.includes('loyalty'),
          '<span class="k">SELECT</span> id, name, city\n<span class="k">FROM</span> customer <span class="k">WHERE</span> tier = <span class="s">\'gold\'</span>;',
          br.includes('loyalty') ? (sel.value === 'engine' ? 'Lỗi: không còn bảng SQL' : 'Lỗi: unknown column city') : 'Chạy được (cho tới lần đổi sau)');
      } else {
        fill(boxO, 'Order', false,
          '<span class="k">GET</span> /customers/42\n<span class="c">→</span> {"id": <span class="n">42</span>, "name": <span class="s">"Lan"</span>,\n   "email": <span class="s">"lan@example.com"</span>}',
          sel.value === 'none' ? 'OK' : 'OK: Customer tự ánh xạ sang hợp đồng cũ');
        fill(boxL, 'Loyalty', false,
          '<span class="k">GET</span> /customers?tier=gold\n<span class="c">→</span> [{"id": <span class="n">42</span>, "name": <span class="s">"Lan"</span>,\n    "city": <span class="s">"Hà Nội"</span>}]',
          sel.value === 'none' ? 'OK' : 'OK: response không đổi');
      }
      const n = br.length;
      stBroken.update(n + '/2', n ? 'bad' : 'ok', n ? 'đọc thẳng schema nội bộ' : 'chỉ thấy hợp đồng API');
      stDeploy.update(String(1 + n), n ? 'bad' : 'ok', n ? 'Customer + consumer bị vỡ (lock-step)' : 'chỉ Customer');
      stInd.update(n ? 'Không' : 'Có', n ? 'bad' : 'ok');

      const svg = s('svg', { viewBox: '0 0 460 170', role: 'img', 'aria-label': 'Order và Loyalty truy cập dữ liệu của Customer' });
      svg.appendChild(R(150, 14, 160, 142, 'f-surface2 s-ink s-w2', 10));
      svg.appendChild(T(230, 34, 'Customer', 'lbl-strong t-mid'));
      svg.appendChild(R(176, 46, 108, 30, db ? 'f-surface s-line' : 'f-accent-soft s-accent s-w2', 6));
      svg.appendChild(T(230, 66, 'API (hợp đồng)', 't-mid t-sm lbl-strong'));
      svg.appendChild(s('ellipse', { cx: 230, cy: 120, rx: 50, ry: 20, class: sel.value === 'none' ? 'f-surface s-ink3' : 'f-mark-soft s-mark s-w2' }));
      svg.appendChild(T(230, 124, sel.value === 'engine' ? 'MongoDB' : 'bảng customer', 't-mid t-sm'));
      [['order', 'Order', 60], ['loyalty', 'Loyalty', 400]].forEach(([k, label, x]) => {
        const broken = br.includes(k), tone = broken ? 'bad' : 'ok';
        const tx = x < 230 ? 176 : 284;
        if (db) svg.appendChild(arrow(x + (x < 230 ? 50 : -50), 110, x < 230 ? 182 : 278, 118, tone, 's-w2' + (broken ? ' dash' : '')));
        else svg.appendChild(arrow(x + (x < 230 ? 50 : -50), 70, tx, 61, tone, 's-w2'));
        svg.appendChild(node(x, db ? 110 : 70, 96, 40, label, broken ? 'f-bad-soft s-bad s-w2' : 'f-ok-soft s-ok', broken ? 'bị vỡ' : 'ổn', broken ? 't-bad' : 't-ok'));
      });
      clear(viz).appendChild(svg);
    }
    render();
  });

  /* ========== 1.6 Size ========== */
  widget('ch1-size', (root) => {
    const LOC = { java: 1250, clojure: 500 }; // per feature; ratio 25:10 from the book
    const sgLang = seg({ label: 'Ngôn ngữ', options: [{ value: 'java', label: 'Java' }, { value: 'clojure', label: 'Clojure' }], value: 'java', onChange: render });
    const slFeat = slider({ label: 'Số tính năng nghiệp vụ trong service', min: 1, max: 30, value: 8, onInput: render });
    const slExp = slider({ label: 'Kinh nghiệm của người đọc với codebase', min: 0, max: 15, value: 1, format: (v) => v + ' năm', onInput: render });
    const slOps = slider({ label: 'Số thao tác service lộ ra (interface)', min: 1, max: 40, value: 5, onInput: render });
    const stLoc = stat('Dòng code', '', 'accent');
    const stHead = stat('“To bằng cái đầu bạn”?', '', 'ok');
    const stIf = stat('Bề mặt interface', '', 'ok');
    const viz = h('div', { class: 'viz' });
    const note = h('p', { class: 'lab-note' });
    root.append(
      h('div', { class: 'controls' }, h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Ngôn ngữ viết service'), sgLang.el), slFeat.el, slExp.el, slOps.el),
      h('div', { class: 'stats' }, stLoc, stHead, stIf), viz, note,
      h('p', { class: 'lab-note' }, 'Số dòng mỗi tính năng và “sức chứa” của người đọc là số liệu minh hoạ; tỉ lệ 25 dòng Java ≈ 10 dòng Clojure và mốc 100.000 dòng / 15 năm lấy từ sách.'));

    function render() {
      const loc = slFeat.value * LOC[sgLang.value];
      const cap = 8000 + 6000 * slExp.value;
      const ratio = loc / cap, ops = slOps.value;
      stLoc.update(fmt(loc), 'accent', sgLang.value === 'java' ? 'Java: dài dòng hơn' : 'Clojure: gọn hơn 2,5 lần');
      stHead.update(ratio <= 0.8 ? 'Vừa' : ratio <= 1.2 ? 'Sát giới hạn' : 'Quá tải', ratio <= 0.8 ? 'ok' : ratio <= 1.2 ? 'warn' : 'bad', `người đọc nắm được khoảng ${fmt(cap)} dòng`);
      stIf.update(ops + ' thao tác', ops <= 6 ? 'ok' : ops <= 15 ? 'warn' : 'bad', ops <= 6 ? 'interface nhỏ, ít ghép nối' : ops <= 15 ? 'consumer bám vào nhiều chỗ' : 'rất dễ thành mớ ghép nối');

      const svg = s('svg', { viewBox: '0 0 460 170', role: 'img', 'aria-label': 'Ba thước đo kích thước service' });
      const rows = [
        ['Dòng code', loc / (30 * LOC.java), fmt(loc) + ' dòng', 'f-accent'],
        ['So với sức chứa', Math.min(ratio / 2, 1), pct(ratio, 0) + ' sức chứa', ratio <= 0.8 ? 'f-ok' : ratio <= 1.2 ? 'f-warn' : 'f-bad'],
        ['Interface', ops / 40, ops + ' thao tác', ops <= 6 ? 'f-ok' : ops <= 15 ? 'f-warn' : 'f-bad'],
      ];
      rows.forEach(([label, f, val, cls], i) => {
        const y = 22 + i * 50;
        svg.appendChild(T(10, y + 4, label, 'lbl-strong'));
        svg.appendChild(R(10, y + 12, 440, 16, 'f-surface2 s-line', 4));
        svg.appendChild(R(10, y + 12, Math.max(3, 440 * clamp(f, 0, 1)), 16, cls, 4));
        svg.appendChild(T(450, y + 4, val, 't-end t-sm'));
      });
      // 100% line on the "capacity" bar (scale is 0..200%)
      svg.appendChild(L(230, 64, 230, 92, 's-ink s-w2'));
      svg.appendChild(T(230, 104, '100%', 't-mid t-sm t-dim'));
      clear(viz).appendChild(svg);
      note.textContent = `Đổi Java ↔ Clojure làm số dòng thay đổi 2,5 lần, đổi người đọc làm “vừa cái đầu” thay đổi, nhưng chỉ thanh trượt interface mới thay đổi mức ghép nối với consumer: hiện tại là ${ops} thao tác mà bên ngoài có thể phụ thuộc vào.`;
    }
    render();
  });

  /* ========== 1.7 Dial, not switch ========== */
  widget('ch1-dial', (root) => {
    const K = { new: 1.6, mid: 0.8, pro: 0.4 };
    const MILESTONES = [
      { n: 2, label: 'Log aggregation + correlation ID (nên có từ đầu)' },
      { n: 8, label: 'Distributed tracing (Jaeger, Honeycomb…)' },
      { n: 15, label: 'Cân nhắc Kubernetes managed' },
      { n: 25, label: 'Contract testing thay phần lớn test end-to-end' },
    ];
    const benefit = (n) => 100 * (1 - Math.exp(-(n - 1) / 10));
    const cost = (n, k) => k * Math.pow(n - 1, 1.3);
    const slN = slider({ label: 'Số microservice', min: 1, max: 60, value: 6, onInput: render });
    const sgM = seg({ label: 'Mức trưởng thành vận hành', options: [{ value: 'new', label: 'Mới bắt đầu' }, { value: 'mid', label: 'Đã có kinh nghiệm' }, { value: 'pro', label: 'Thành thạo' }], value: 'new', onChange: render });
    const stB = stat('Lợi ích (lựa chọn mua được)', '', 'ok');
    const stC = stat('Chi phí (độ phức tạp)', '', 'bad');
    const stNet = stat('Giá trị ròng', '', 'accent');
    const stBest = stat('Điểm dừng hợp lý', '', 'accent');
    const viz = h('div', { class: 'viz' });
    const pills = h('div', { class: 'ch1-pills' });
    root.append(
      h('div', { class: 'controls' }, slN.el, h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Mức trưởng thành vận hành của đội'), sgM.el)),
      h('div', { class: 'stats' }, stB, stC, stNet, stBest), viz,
      h('p', { class: 'ch1-sub-title' }, 'Công nghệ nên có ở mức này'), pills);

    function render() {
      const n = slN.value, k = K[sgM.value];
      let best = 1, bestV = -Infinity;
      for (let i = 1; i <= 60; i++) { const v = benefit(i) - cost(i, k); if (v > bestV) { bestV = v; best = i; } }
      const b = benefit(n), c = cost(n, k), net = b - c;
      stB.update(fmt(b, 0), 'ok', 'tăng nhanh rồi chững lại');
      stC.update(fmt(c, 0), 'bad', 'tăng nhanh dần theo số service');
      stNet.update(fmt(net, 0), net > 0 ? 'ok' : 'bad', net > 0 ? 'đáng tiền' : 'trả giá nhiều hơn nhận');
      stBest.update('≈ ' + best + ' service', 'accent', 'với mức trưởng thành này');

      const W = 460, H = 240, x0 = 40, x1 = 450, y0 = 205, y1 = 15, ymax = 120;
      const X = (v) => x0 + (v - 1) / 59 * (x1 - x0), Y = (v) => y0 - v / ymax * (y0 - y1);
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Đường lợi ích và chi phí theo số microservice' });
      [0, 40, 80, 120].forEach((v) => { svg.appendChild(L(x0, Y(v), x1, Y(v), 'grid')); svg.appendChild(T(x0 - 6, Y(v) + 4, String(v), 't-end t-sm')); });
      svg.appendChild(L(x0, Y(0), x1, Y(0), 'axis'));
      [1, 10, 20, 30, 40, 50, 60].forEach((v) => svg.appendChild(T(X(v), y0 + 16, String(v), 't-mid t-sm')));
      svg.appendChild(T((x0 + x1) / 2, H - 2, 'số microservice', 't-mid t-sm t-dim'));
      svg.appendChild(T(x0 - 30, y1 - 4, 'điểm', 't-sm t-dim'));
      MILESTONES.forEach((m) => svg.appendChild(L(X(m.n), y0, X(m.n), y1, 's-line dash')));
      const curve = (f, cls) => {
        const pts = [];
        for (let i = 1; i <= 60; i += 0.5) { const v = f(i); if (v > ymax || v < -10) break; pts.push(X(i).toFixed(1) + ',' + Y(Math.max(v, 0)).toFixed(1)); }
        return s('polyline', { points: pts.join(' '), class: 'f-none s-w2 ' + cls });
      };
      svg.appendChild(curve(benefit, 's-ok'));
      svg.appendChild(curve((i) => cost(i, k), 's-bad'));
      svg.appendChild(curve((i) => benefit(i) - cost(i, k), 's-accent dash'));
      svg.appendChild(L(X(n), y0, X(n), y1, 's-ink s-w2'));
      svg.appendChild(s('circle', { cx: X(best), cy: Y(Math.max(bestV, 0)), r: 5, class: 'f-accent' }));
      // legend
      [['Lợi ích', 's-ok', 't-ok'], ['Chi phí', 's-bad', 't-bad'], ['Ròng', 's-accent dash', 't-accent']].forEach(([lb, cls, tc], i) => {
        const lx = 300 + (i % 3) * 52;
        svg.appendChild(L(lx, 26, lx + 14, 26, cls + ' s-w2'));
        svg.appendChild(T(lx + 18, 30, lb, 't-sm ' + tc));
      });
      clear(viz).appendChild(svg);

      clear(pills);
      MILESTONES.forEach((m) => pills.appendChild(h('span', { class: 'pill ' + (n >= m.n ? 'accent' : '') }, (n >= m.n ? '✓ ' : '') + m.label)));
      pills.appendChild(h('p', { class: 'lab-note', style: { width: '100%', margin: '6px 0 0' } }, 'Đường cong và mốc 8/15/25 service là số liệu minh hoạ. Theo sách: log aggregation là điều kiện tiên quyết, còn “you don’t need a Kubernetes cluster when you have three services”.'));
    }
    render();
  });

  /* ========== 1.8 Music Corp ========== */
  widget('ch1-musiccorp', (root) => {
    const PLANS = {
      tier: {
        teams: 3, handoffs: 2, deploys: 3,
        steps: [
          { part: 'db', team: 'Đội DBA', text: 'Thêm cột favorite_genre vào bảng customer, deploy database' },
          { part: 'h1', team: '', text: 'Bàn giao: báo đội backend là schema đã sẵn sàng' },
          { part: 'be', team: 'Đội backend', text: 'Thêm API đọc/ghi thể loại yêu thích, deploy backend' },
          { part: 'h2', team: '', text: 'Bàn giao: báo đội frontend là API đã có' },
          { part: 'ui', team: 'Đội frontend', text: 'Thêm ô chọn thể loại trên web, deploy UI' },
        ],
      },
      domain: {
        teams: 1, handoffs: 0, deploys: 1,
        steps: [
          { part: 'cust', team: 'Đội Customer', text: 'Thêm trường lưu thể loại, logic và ô chọn trong UI của service Customer' },
          { part: 'cat', team: 'Đội Customer', text: 'Lấy danh sách thể loại từ API sẵn có của Catalog (Catalog không đổi)' },
          { part: 'dep', team: 'Đội Customer', text: 'Deploy service Customer: tính năng hoàn tất' },
          { part: 'rec', team: 'Đội Recommendations', text: 'Một lần release sau: Recommendations dùng thể loại yêu thích để gợi ý' },
        ],
      },
    };
    let cur = 99, running = false;
    const sg = seg({ label: 'Kiến trúc', options: [{ value: 'tier', label: 'Ba tầng, đội theo kỹ năng' }, { value: 'domain', label: 'Theo nghiệp vụ, đội đa kỹ năng' }], value: 'tier', onChange: () => { cur = 99; render(); } });
    const btn = button('Triển khai tính năng', run);
    const stTeams = stat('Đội tham gia', '', 'ok');
    const stHand = stat('Lần bàn giao', '', 'ok');
    const stDep = stat('Deploy theo thứ tự', '', 'ok');
    const viz = h('div', { class: 'viz' });
    const lg = log();
    root.append(h('div', { class: 'controls' }, sg.el, h('div', { class: 'btn-row' }, btn)), h('div', { class: 'stats' }, stTeams, stHand, stDep), viz, lg);

    function draw() {
      const p = PLANS[sg.value];
      const doneParts = new Set(p.steps.slice(0, cur + 1).map((x) => x.part));
      const activePart = cur < p.steps.length ? p.steps[cur] && p.steps[cur].part : null;
      const on = (k) => doneParts.has(k);
      const cls = (k, base) => (on(k) ? 'f-accent-soft s-accent s-w2' : base || 'f-surface s-line') + (running && activePart === k ? ' pulse' : '');
      const svg = s('svg', { viewBox: '0 0 460 240', role: 'img', 'aria-label': 'Kiến trúc Music Corp' });
      if (sg.value === 'tier') {
        const layers = [['ui', 'Web UI', 'Đội frontend', 30], ['be', 'Backend monolith', 'Đội backend (Java)', 100], ['db', 'Database', 'Đội DBA', 170]];
        layers.forEach(([k, label, team, y]) => {
          svg.appendChild(R(20, y, 280, 46, cls(k), 8));
          svg.appendChild(T(160, y + 20, label, 'lbl-strong t-mid'));
          svg.appendChild(T(160, y + 36, on(k) ? 'đã sửa + deploy' : 'chưa đổi', 't-mid t-sm ' + (on(k) ? 't-accent' : 't-dim')));
          svg.appendChild(R(316, y + 8, 132, 30, 'f-surface2 s-line', 15));
          svg.appendChild(T(382, y + 27, team, 't-mid t-sm lbl-strong'));
        });
        svg.appendChild(arrow(440, 178, 440, 140, on('h1') ? 'warn' : 'ink3', 's-w2'));
        svg.appendChild(arrow(440, 108, 440, 70, on('h2') ? 'warn' : 'ink3', 's-w2'));
        svg.appendChild(T(452, 160, '1', 't-sm t-warn'));
        svg.appendChild(T(452, 90, '2', 't-sm t-warn'));
      } else {
        // Customer service: vertical slice
        svg.appendChild(R(14, 14, 170, 212, cls('cust', 'f-surface s-ink'), 10));
        svg.appendChild(T(99, 34, 'Customer', 'lbl-strong t-mid'));
        ['UI hồ sơ', 'Logic', 'Dữ liệu khách'].forEach((l, i) => {
          svg.appendChild(R(30, 48 + i * 50, 138, 38, on('cust') ? 'f-ok-soft s-ok' : 'f-surface2 s-line', 6));
          svg.appendChild(T(99, 72 + i * 50, l + (on('cust') ? ' +genre' : ''), 't-mid t-sm'));
        });
        svg.appendChild(T(99, 218, on('dep') ? 'đã deploy' : 'Đội Customer', 't-mid t-sm ' + (on('dep') ? 't-accent lbl-strong' : '')));
        svg.appendChild(R(270, 24, 176, 64, on('cat') ? 'f-surface s-ok s-w2' : 'f-surface s-line', 10));
        svg.appendChild(T(358, 50, 'Catalog', 'lbl-strong t-mid'));
        svg.appendChild(T(358, 68, 'không đổi, chỉ được gọi', 't-mid t-sm t-dim'));
        svg.appendChild(arrow(186, 70, 268, 56, on('cat') ? 'ok' : 'ink3', 's-w2'));
        svg.appendChild(T(226, 50, 'thể loại?', 't-mid t-sm'));
        svg.appendChild(R(270, 140, 176, 64, on('rec') ? 'f-violet-soft s-violet s-w2' : 'f-surface s-line dash', 10));
        svg.appendChild(T(358, 166, 'Recommendations', 'lbl-strong t-mid'));
        svg.appendChild(T(358, 184, on('rec') ? 'dùng genre (release sau)' : 'release sau, không bắt buộc', 't-mid t-sm t-dim'));
        svg.appendChild(arrow(268, 172, 186, 160, on('rec') ? 'violet' : 'ink3', 'dash'));
      }
      clear(viz).appendChild(svg);
      stTeams.update(String(p.teams), p.teams > 1 ? 'bad' : 'ok', p.teams > 1 ? 'mỗi tầng một đội' : 'một đội làm trọn');
      stHand.update(String(p.handoffs), p.handoffs ? 'bad' : 'ok', p.handoffs ? 'chờ đội khác xong' : 'không phải chờ ai');
      stDep.update(String(p.deploys), p.deploys > 1 ? 'warn' : 'ok', p.deploys > 1 ? 'DB → backend → UI' : 'chỉ Customer');
    }
    function render() {
      draw();
      lg.reset();
      PLANS[sg.value].steps.forEach((st, i) => lg.add(`${i + 1}. ${st.team ? st.team + ': ' : ''}${st.text}`, st.part.startsWith('h') ? 'warn' : st.part === 'rec' ? 't' : 'acc'));
    }
    async function run() {
      if (running) return;
      running = true; btn.disabled = true;
      const steps = PLANS[sg.value].steps;
      lg.reset();
      for (cur = 0; cur < steps.length; cur++) {
        draw();
        const st = steps[cur];
        lg.add(`${cur + 1}. ${st.team ? st.team + ': ' : ''}${st.text}`, st.part.startsWith('h') ? 'warn' : st.part === 'rec' ? 't' : 'acc');
        await sleep(700);
      }
      cur = 99; running = false; btn.disabled = false;
      draw();
      lg.add(sg.value === 'tier' ? 'Xong sau 3 đội, 2 lần bàn giao, 3 lần deploy theo đúng thứ tự.' : 'Xong: một đội, một lần deploy.', sg.value === 'tier' ? 'bad' : 'ok');
    }
    render();
  });

  /* ========== 1.9 Monolith types ========== */
  widget('ch1-monolith-types', (root) => {
    const MODS = ['Customer', 'Catalog', 'Order', 'Payment'];
    const CRIT = ['Topo triển khai đơn giản', 'Nhiều đội làm song song', 'Tách ra sau này', 'Release độc lập', 'Gặp lỗi của hệ phân tán'];
    const RATE = {
      single: [['ok', 'Rất đơn giản'], ['bad', 'Hay giẫm chân'], ['warn', 'Khó nếu code rối'], ['bad', 'Không'], ['ok', 'Ít']],
      modular: [['ok', 'Đơn giản'], ['ok', 'Được, nếu ranh giới tốt'], ['warn', 'Vướng DB chung'], ['bad', 'Không'], ['ok', 'Ít']],
      dist: [['bad', 'Phức tạp'], ['warn', 'Vẫn giẫm chân'], ['bad', 'Khó'], ['bad', 'Không'], ['bad', 'Đủ cả']],
      micro: [['bad', 'Phức tạp'], ['ok', 'Tốt'], ['ok', 'Đã tách'], ['ok', 'Có'], ['bad', 'Đủ cả']],
    };
    const DESC = {
      single: 'Toàn bộ code trong một tiến trình, có thể chạy nhiều instance. Đơn giản nhất, nhưng khi nhiều người cùng sửa thì dễ giẫm chân nhau.',
      modular: 'Một tiến trình, chia thành module có ranh giới rõ. Nhiều đội làm song song được mà vẫn chỉ có một đơn vị triển khai. Shopify là ví dụ thành công.',
      dist: 'Nhiều service chạy riêng nhưng vẫn phải deploy cùng nhau. Mang nhược điểm của hệ phân tán lẫn monolith, không có lợi ích của cả hai.',
      micro: 'Mỗi service một tiến trình, một database, một đơn vị triển khai. Linh hoạt nhất, nhưng phải trả đủ chi phí của hệ phân tán.',
    };
    const sg = seg({ label: 'Kiểu kiến trúc', options: [{ value: 'single', label: 'Single-process' }, { value: 'modular', label: 'Modular' }, { value: 'dist', label: 'Distributed monolith' }, { value: 'micro', label: 'Microservices' }], value: 'modular', onChange: render });
    const cbDb = checkbox('Modular: chia cả database theo module', false, render);
    const stUnit = stat('Đơn vị triển khai', '', 'accent');
    const stProc = stat('Số tiến trình', '', 'accent');
    const viz = h('div', { class: 'viz' });
    const desc = h('p', { class: 'lab-note' });
    const tbody = h('tbody');
    root.append(h('div', { class: 'controls' }, sg.el), cbDb.el, h('div', { class: 'stats' }, stUnit, stProc), viz, desc,
      h('div', { class: 'table-wrap' }, h('table', { class: 'data' }, h('thead', h('tr', h('th', 'Tiêu chí'), h('th', 'Đánh giá'))), tbody)));

    function render() {
      const t = sg.value, split = cbDb.value && t === 'modular';
      cbDb.input.disabled = t !== 'modular';
      const svg = s('svg', { viewBox: '0 0 460 230', role: 'img', 'aria-label': 'Cấu trúc tiến trình, module và database' });
      const db = (cx, cy, rx, label) => { svg.appendChild(s('ellipse', { cx, cy, rx, ry: 14, class: 'f-warn-soft s-warn' })); svg.appendChild(T(cx, cy + 4, label, 't-mid t-sm')); };
      if (t === 'single' || t === 'modular') {
        svg.appendChild(R(70, 24, 328, 120, 'f-surface2 s-line', 10));
        svg.appendChild(R(64, 18, 328, 120, 'f-surface s-ink s-w2', 10));
        svg.appendChild(T(76, 36, 'Một tiến trình (chạy nhiều instance)', 't-sm lbl-strong'));
        if (t === 'single') {
          const r = rng(5);
          for (let i = 0; i < 26; i++) svg.appendChild(R(80 + r() * 280, 48 + r() * 72, 18 + r() * 20, 10, ['f-accent-soft', 'f-violet-soft', 'f-ok-soft', 'f-mark-soft'][i % 4], 3));
          svg.appendChild(T(228, 132, 'code trộn lẫn, không ranh giới rõ', 't-mid t-sm t-dim'));
        } else {
          MODS.forEach((m, i) => { svg.appendChild(R(78 + i * 78, 48, 70, 76, 'f-accent-soft s-accent', 6)); svg.appendChild(T(113 + i * 78, 90, m, 't-mid t-sm lbl-strong')); });
        }
        if (split) MODS.forEach((m, i) => { svg.appendChild(L(113 + i * 78, 124, 113 + i * 78, 172, 's-ink3')); db(113 + i * 78, 186, 32, 'DB ' + (i + 1)); });
        else { svg.appendChild(L(228, 138, 228, 172, 's-ink3')); db(228, 186, 70, 'Database chung'); }
        svg.appendChild(R(54, 10, 352, 210, 'f-none s-bad s-w2 dash', 12));
        svg.appendChild(T(400, 216, 'deploy cùng nhau', 't-end t-sm t-bad'));
      } else {
        const xs = MODS.map((_, i) => 62 + i * 112);
        if (t === 'dist') {
          [[0, 1], [0, 2], [1, 2], [2, 3], [1, 3], [0, 3]].forEach(([a, b]) => svg.appendChild(s('path', { d: `M${xs[a]},70 Q${(xs[a] + xs[b]) / 2},${18 - Math.abs(a - b) * 4} ${xs[b]},70`, class: 'f-none s-bad' })));
        } else {
          [[0, 2], [2, 3], [1, 2]].forEach(([a, b]) => svg.appendChild(arrow(xs[a] + (a < b ? 42 : -42), 92, xs[b] + (a < b ? -42 : 42), 92, 'ink3')));
        }
        MODS.forEach((m, i) => {
          svg.appendChild(R(xs[i] - 42, 70, 84, 46, 'f-surface s-ink s-w2', 8));
          svg.appendChild(T(xs[i], 92, m, 't-mid t-sm lbl-strong'));
          svg.appendChild(T(xs[i], 107, 'tiến trình', 't-mid t-sm t-dim'));
          if (t === 'micro') {
            svg.appendChild(L(xs[i], 116, xs[i], 156, 's-ink3'));
            db(xs[i], 170, 34, 'DB riêng');
            svg.appendChild(R(xs[i] - 50, 54, 100, 140, 'f-none s-ok s-w2 dash', 10));
          } else svg.appendChild(L(xs[i], 116, 230, 170, 's-ink3'));
        });
        if (t === 'dist') {
          db(230, 184, 80, 'Database chung');
          svg.appendChild(R(10, 10, 440, 210, 'f-none s-bad s-w2 dash', 12));
          svg.appendChild(T(444, 216, 'vẫn phải deploy cùng nhau', 't-end t-sm t-bad'));
        } else svg.appendChild(T(230, 218, 'mỗi khung xanh deploy riêng', 't-mid t-sm t-ok'));
      }
      clear(viz).appendChild(svg);
      desc.textContent = DESC[t] + (split ? ' Chia database theo module giúp việc tách sau này dễ hơn nhiều.' : '');
      stUnit.update(t === 'micro' ? '4' : '1', t === 'micro' ? 'ok' : 'warn', t === 'dist' ? 'dù có 4 service' : t === 'micro' ? 'mỗi service một' : 'cả hệ thống');
      stProc.update(t === 'single' || t === 'modular' ? '1' : '4', 'accent', t === 'single' || t === 'modular' ? 'gọi hàm trong tiến trình' : 'gọi nhau qua mạng');
      clear(tbody);
      const rates = RATE[t].map((r, i) => (split && i === 2 ? ['ok', 'Dễ hơn: DB đã chia'] : r));
      CRIT.forEach((c, i) => tbody.appendChild(h('tr', h('td', c), h('td', h('span', { class: 'pill ' + rates[i][0] }, rates[i][1])))));
    }
    render();
  });

  /* ========== 1.10 Delivery contention ========== */
  widget('ch1-contention', (root) => {
    const TEAM = 6;
    const DOT = ['f-accent', 'f-violet', 'f-ok', 'f-warn', 'f-bad', 'f-ink2', 'f-mark', 'f-ink'];
    const slDev = slider({ label: 'Số developer', min: 2, max: 60, value: 24, onInput: render });
    const sg = seg({ label: 'Cách tổ chức code', options: [{ value: 'mono', label: 'Monolith' }, { value: 'modular', label: 'Modular monolith' }, { value: 'micro', label: 'Microservices theo đội' }], value: 'mono', onChange: render });
    const stConf = stat('Xung đột khi sửa code / tuần', '', 'ok');
    const stTrain = stat('Người chung một chuyến release', '', 'ok');
    const stOps = stat('Đơn vị phải vận hành', '', 'ok');
    const viz = h('div', { class: 'viz' });
    const note = h('p', { class: 'lab-note' });
    root.append(h('div', { class: 'controls' }, slDev.el, sg.el), h('div', { class: 'stats' }, stConf, stTrain, stOps), viz, note);

    function render() {
      const n = slDev.value, mode = sg.value;
      const teams = Math.ceil(n / TEAM);
      const sizes = Array.from({ length: teams }, (_, i) => Math.min(TEAM, n - i * TEAM));
      const pairs = (k) => k * (k - 1) / 2;
      let conflicts, train, units;
      if (mode === 'mono') { conflicts = pairs(n) * 0.02; train = n; units = 1; }
      else if (mode === 'modular') { conflicts = sizes.reduce((a, k) => a + pairs(k), 0) * 0.02 + n * 0.05; train = n; units = 1; }
      else { conflicts = sizes.reduce((a, k) => a + pairs(k), 0) * 0.02; train = Math.max(...sizes); units = teams; }
      stConf.update(fmt(conflicts, 1), conflicts < 3 ? 'ok' : conflicts < 8 ? 'warn' : 'bad', 'số liệu minh hoạ');
      stTrain.update(String(train), train <= TEAM ? 'ok' : train <= 20 ? 'warn' : 'bad', mode === 'micro' ? 'mỗi đội release riêng' : 'mọi người chờ chung một lần release');
      stOps.update(String(units), units <= 2 ? 'ok' : units <= 5 ? 'warn' : 'bad', units === 1 ? 'một thứ để deploy và giám sát' : 'mỗi service phải deploy, giám sát riêng');

      const svg = s('svg', { viewBox: '0 0 460 230', role: 'img', 'aria-label': 'Developer và các đơn vị code' });
      const dots = (x, y, w, list) => { // list: [teamIdx]
        const cols = Math.max(1, Math.floor((w - 12) / 14));
        list.forEach((ti, i) => svg.appendChild(s('circle', { cx: x + 12 + (i % cols) * 14, cy: y + 14 + Math.floor(i / cols) * 14, r: 5, class: DOT[ti % DOT.length] })));
      };
      const all = sizes.flatMap((k, ti) => Array(k).fill(ti));
      if (mode === 'mono') {
        svg.appendChild(R(10, 24, 440, 190, 'f-surface s-ink s-w2', 10));
        svg.appendChild(T(20, 16, 'Một codebase, một chuyến release', 't-sm lbl-strong'));
        const r = rng(n);
        all.map((ti) => [ti, r()]).sort((a, b) => a[1] - b[1]).forEach(([ti], i) => {
          svg.appendChild(s('circle', { cx: 28 + (i % 29) * 14.5, cy: 44 + Math.floor(i / 29) * 16, r: 5, class: DOT[ti % DOT.length] }));
        });
        if (n > 10) svg.appendChild(T(230, 200, 'ai cũng có thể sửa mọi chỗ: không rõ ai sở hữu gì', 't-mid t-sm t-bad'));
      } else {
        const cols = Math.min(teams, 5), rows = Math.ceil(teams / cols);
        const bw = (420 - (cols - 1) * 8) / cols, bh = Math.min(80, (170 - (rows - 1) * 8) / rows);
        if (mode === 'modular') {
          svg.appendChild(R(8, 22, 444, 200, 'f-none s-bad s-w2 dash', 12));
          svg.appendChild(T(20, 16, 'Nhiều module, nhưng vẫn một chuyến release', 't-sm lbl-strong t-bad'));
        } else svg.appendChild(T(20, 16, 'Mỗi đội một service, release riêng', 't-sm lbl-strong t-ok'));
        sizes.forEach((k, ti) => {
          const c = ti % cols, rr = Math.floor(ti / cols);
          const x = 20 + c * (bw + 8), y = 34 + rr * (bh + 8);
          svg.appendChild(R(x, y, bw, bh, mode === 'micro' ? 'f-surface s-ok s-w2' : 'f-surface s-line', 8));
          dots(x, y, bw, Array(k).fill(ti));
          svg.appendChild(T(x + bw - 6, y + bh - 6, (mode === 'micro' ? 'service ' : 'module ') + (ti + 1), 't-end t-sm t-dim'));
        });
      }
      clear(viz).appendChild(svg);
      note.textContent = mode === 'mono'
        ? 'Mọi cặp developer đều có thể đụng nhau trong cùng một chỗ code, nên xung đột tăng gần theo bình phương số người.'
        : mode === 'modular'
          ? 'Module có chủ sở hữu rõ ràng nên ít đụng code hơn, nhưng mọi người vẫn phải chờ chung một lần release.'
          : 'Ranh giới service cho đường sở hữu rõ ràng và chuyến release riêng. Đổi lại, số thứ phải vận hành tăng theo số đội.';
    }
    render();
  });

  /* ========== 1.11 Correlation ID ========== */
  widget('ch1-correlation-id', (root) => {
    const SVCS = ['gateway', 'order', 'inventory', 'payment', 'notification'];
    const FLOWS = [
      { id: 'req-3f9a', who: 'A', order: 1041, t: 0, fail: false },
      { id: 'req-8c21', who: 'B', order: 1042, t: 7, fail: false },
      { id: 'req-b704', who: 'C', order: 1043, t: 13, fail: true },
    ];
    function spans(f) {
      const sp = [
        { svc: 'gateway', s: 0, d: f.fail ? 2090 : 140 },
        { svc: 'order', s: 4, d: f.fail ? 2080 : 130 },
        { svc: 'inventory', s: 10, d: 30 },
        { svc: 'payment', s: 45, d: f.fail ? 2000 : 55, bad: f.fail },
      ];
      if (f.fail) sp.push({ svc: 'inventory', s: 2050, d: 25, note: 'hoàn kho' });
      else sp.push({ svc: 'notification', s: 105, d: 25 });
      return sp;
    }
    function lines(f) {
      const L0 = [
        [0, 'gateway', 'POST /orders'],
        [4, 'order', `Tạo đơn #${f.order} cho khách ${f.who}`],
        [10, 'inventory', 'Giữ 1 sản phẩm trong kho'],
        [40, 'inventory', 'Giữ hàng thành công'],
        [45, 'payment', 'Gọi cổng thanh toán'],
      ];
      if (f.fail) L0.push([2045, 'payment', 'Timeout sau 2000 ms', 'bad'], [2050, 'order', 'Huỷ đơn, yêu cầu hoàn kho', 'warn'], [2075, 'inventory', 'Trả lại 1 sản phẩm', 'warn'], [2090, 'gateway', '502 Bad Gateway', 'bad']);
      else L0.push([100, 'payment', 'Thanh toán thành công'], [105, 'notification', 'Gửi email xác nhận'], [140, 'gateway', '201 Created']);
      return L0.map(([at, svc, text, tone]) => ({ ms: f.t + at, svc, text, tone, id: f.id }));
    }
    const ALL = FLOWS.flatMap(lines).sort((a, b) => a.ms - b.ms);
    const ts = (ms) => { const t = 7000 + ms; return `10:42:${String(Math.floor(t / 1000)).padStart(2, '0')}.${String(t % 1000).padStart(3, '0')}`; };

    const cbId = checkbox('Gắn correlation ID vào mọi dòng log', true, render);
    const sel = select({ label: 'Lọc theo correlation ID', options: [{ value: 'all', label: 'Tất cả (không lọc)' }, ...FLOWS.map((f) => ({ value: f.id, label: f.id }))], value: 'req-b704', onChange: render });
    const stLines = stat('Dòng log đang xem', '', 'accent');
    const stSvc = stat('Service liên quan', '', 'accent');
    const stCause = stat('Nguyên nhân', '', 'warn');
    const lg = log();
    const viz = h('div', { class: 'viz' });
    root.append(h('div', { class: 'controls' }, h('div', { class: 'ctl' }, cbId.el), sel.el), h('div', { class: 'stats' }, stLines, stSvc, stCause), lg,
      h('p', { class: 'ch1-sub-title' }, 'Trace của luồng đang lọc'), viz,
      h('p', { class: 'lab-note' }, 'Log và thời gian là số liệu minh hoạ. Mỗi đơn hàng là một luồng gọi qua tối đa 5 service.'));

    function render() {
      const withId = cbId.value;
      sel.input.disabled = !withId;
      const f = withId && sel.value !== 'all' ? FLOWS.find((x) => x.id === sel.value) : null;
      const shown = f ? ALL.filter((l) => l.id === f.id) : ALL;
      lg.reset();
      shown.forEach((l) => lg.add(`${ts(l.ms)} [${l.svc}]${withId ? ' ' + l.id : ''} ${l.text}`, l.tone || ''));
      lg.scrollTop = 0;
      stLines.update(`${shown.length}/${ALL.length}`, f ? 'ok' : 'warn', f ? 'chỉ một luồng' : '3 đơn hàng xen kẽ');
      stSvc.update(String(new Set(shown.map((l) => l.svc)).size), 'accent', f ? 'luồng này đi qua' : 'trên toàn hệ thống');
      if (!withId) stCause.update('Không rõ', 'bad', 'timeout của payment thuộc đơn nào?');
      else if (!f) stCause.update('Chưa lọc', 'warn', 'chọn một ID để cô lập');
      else if (f.fail) stCause.update('Payment timeout', 'bad', `đơn #${f.order} của khách ${f.who}`);
      else stCause.update('Không có lỗi', 'ok', `đơn #${f.order} chạy trơn tru`);

      const svg = s('svg', { viewBox: '0 0 460 170', role: 'img', 'aria-label': 'Biểu đồ trace thời gian của một luồng' });
      if (!f) {
        svg.appendChild(R(10, 20, 440, 130, 'f-surface2 s-line dash', 10));
        svg.appendChild(T(230, 80, withId ? 'Chọn một correlation ID để xem trace' : 'Không có correlation ID: không ghép được', 't-mid lbl-strong'));
        svg.appendChild(T(230, 100, withId ? 'mọi dòng log cùng ID thuộc một luồng' : 'các dòng log thành một chuỗi rời rạc', 't-mid t-sm t-dim'));
      } else {
        const sp = spans(f), total = sp[0].d, x0 = 90, x1 = 448;
        const X = (ms) => x0 + ms / total * (x1 - x0);
        const ticks = total > 1000 ? [0, 500, 1000, 1500, 2000] : [0, 50, 100];
        ticks.forEach((t) => { svg.appendChild(L(X(t), 14, X(t), 22 + sp.length * 24, 'grid')); svg.appendChild(T(X(t), 34 + sp.length * 24, t + ' ms', 't-mid t-sm')); });
        sp.forEach((p, i) => {
          const y = 18 + i * 24;
          svg.appendChild(T(x0 - 6, y + 13, p.svc + (p.note ? ' *' : ''), 't-end t-sm'));
          svg.appendChild(R(X(p.s), y, Math.max(3, X(p.s + p.d) - X(p.s)), 17, p.bad ? 'f-bad' : p.note ? 'f-warn' : ['f-accent', 'f-violet', 'f-ok', 'f-accent', 'f-ok'][SVCS.indexOf(p.svc)], 3));
          if (p.bad) svg.appendChild(T(X(p.s) + 8, y + 13, 'timeout 2000 ms', 't-sm lbl-strong'));
        });
        svg.setAttribute('viewBox', `0 0 460 ${44 + sp.length * 24}`);
      }
      clear(viz).appendChild(svg);
    }
    render();
  });

  /* ========== 1.12 Advantages ========== */
  widget('ch1-advantages', (root) => {
    tabs(root, [
      { value: 'scale', label: 'Scale có chọn lọc', build: buildScale },
      { value: 'bulk', label: 'Vách ngăn', build: buildBulk },
      { value: 'release', label: 'Release nhỏ', build: buildRelease },
    ], 'scale');

    function buildScale(p) {
      const PARTS = [['Catalog', 'f-accent'], ['Order', 'f-violet'], ['Customer', 'f-ok'], ['Payment', 'f-warn']];
      const sl = slider({ label: 'Tải lên Catalog (so với bình thường)', min: 1, max: 10, value: 4, format: (v) => '× ' + v, onInput: render });
      const stM = stat('Monolith: đơn vị phần cứng', '', 'bad');
      const stS = stat('Microservices: đơn vị phần cứng', '', 'ok');
      const stSave = stat('Tiết kiệm', '', 'ok');
      const viz = h('div', { class: 'viz' });
      p.append(h('div', { class: 'controls' }, sl.el), h('div', { class: 'stats' }, stM, stS, stSave), viz,
        h('p', { class: 'lab-note' }, 'Mỗi ô là một đơn vị phần cứng (số liệu minh hoạ). Monolith phải nhân bản cả khối dù chỉ Catalog quá tải.'));
      function render() {
        const n = sl.value, mono = n * 4, micro = n + 3;
        stM.update(String(mono), 'bad', `${n} instance × 4 phần`);
        stS.update(String(micro), 'ok', `${n} Catalog + 3 service khác`);
        stSave.update(pct(1 - micro / mono, 0), 'ok', 'chỉ scale phần cần scale');
        const svg = s('svg', { viewBox: '0 0 460 250', role: 'img', 'aria-label': 'So sánh số instance khi scale' });
        svg.appendChild(T(10, 16, 'Monolith', 'lbl-strong'));
        for (let i = 0; i < n; i++) PARTS.forEach(([, cls], j) => svg.appendChild(R(10 + i * 44 + (j % 2) * 19, 24 + Math.floor(j / 2) * 19, 17, 17, cls, 3)));
        svg.appendChild(T(10, 126, 'Microservices', 'lbl-strong'));
        PARTS.forEach(([label, cls], j) => {
          const y = 134 + j * 28;
          svg.appendChild(T(76, y + 14, label, 't-end t-sm'));
          const cnt = j === 0 ? n : 1;
          for (let i = 0; i < cnt; i++) svg.appendChild(R(84 + i * 24, y, 20, 20, cls, 3));
        });
        clear(viz).appendChild(svg);
      }
      render();
    }

    function buildBulk(p) {
      const SVC = [['catalog', 'Catalog'], ['recs', 'Recommendations'], ['payment', 'Payment'], ['customer', 'Customer']];
      const FEAT = [['Duyệt danh mục', ['catalog']], ['Gợi ý nhạc', ['recs']], ['Đặt hàng & thanh toán', ['catalog', 'payment', 'customer']], ['Hồ sơ khách hàng', ['customer']]];
      const dead = new Set(['recs']);
      const cbs = SVC.map(([k, label]) => checkbox('Tắt ' + label, dead.has(k), (v) => { v ? dead.add(k) : dead.delete(k); render(); }));
      const stM = stat('Monolith: chức năng còn chạy', '', 'bad');
      const stS = stat('Microservices: chức năng còn chạy', '', 'ok');
      const colM = h('div', { class: 'ch1-pills' }), colS = h('div', { class: 'ch1-pills' });
      p.append(h('div', { class: 'ch1-chk' }, cbs.map((c) => c.el)), h('div', { class: 'stats' }, stM, stS),
        h('div', { class: 'lab-split' }, h('div', { class: 'box' }, h('h5', 'Monolith'), colM), h('div', { class: 'box' }, h('h5', 'Microservices'), colS)),
        h('p', { class: 'lab-note' }, 'Giả định lỗi làm sập tiến trình chứa nó. Trong monolith, đó là cả ứng dụng. Với microservices, hệ thống phải được thiết kế để chịu được service phụ thuộc bị chết.'));
      function render() {
        const monoUp = dead.size === 0;
        clear(colM); clear(colS);
        let upS = 0;
        FEAT.forEach(([name, needs]) => {
          const ok = needs.every((k) => !dead.has(k));
          if (ok) upS++;
          colM.appendChild(h('span', { class: 'pill ' + (monoUp ? 'ok' : 'bad') }, (monoUp ? '✓ ' : '✕ ') + name));
          colS.appendChild(h('span', { class: 'pill ' + (ok ? 'ok' : 'bad') }, (ok ? '✓ ' : '✕ ') + name));
        });
        stM.update(`${monoUp ? FEAT.length : 0}/${FEAT.length}`, monoUp ? 'ok' : 'bad', monoUp ? 'mọi thứ bình thường' : 'một chỗ hỏng, cả khối dừng');
        stS.update(`${upS}/${FEAT.length}`, upS === FEAT.length ? 'ok' : upS ? 'warn' : 'bad', 'xuống cấp từng phần');
      }
      render();
    }

    function buildRelease(p) {
      const PER_DAY = 4, P_BAD = 0.01;
      const sl = slider({ label: 'Chu kỳ release của monolith', min: 1, max: 90, value: 30, format: (v) => v + ' ngày', onInput: render });
      const stD = stat('Thay đổi trong một lần release', '', 'warn');
      const stR = stat('Xác suất lần release có lỗi', '', 'warn');
      const stS = stat('Microservices (release hằng ngày, từng service)', '', 'ok');
      const viz = h('div', { class: 'viz' });
      p.append(h('div', { class: 'controls' }, sl.el), h('div', { class: 'stats' }, stD, stR, stS), viz,
        h('p', { class: 'lab-note' }, `Giả định: ${PER_DAY} thay đổi mỗi ngày trên toàn hệ thống, mỗi thay đổi có ${pct(P_BAD, 0)} khả năng gây lỗi (số liệu minh hoạ). Delta càng lớn, rủi ro càng cao và càng khó biết thay đổi nào gây lỗi.`));
      function render() {
        const delta = sl.value * PER_DAY, risk = 1 - Math.pow(1 - P_BAD, delta);
        stD.update(String(delta), delta > 40 ? 'bad' : 'warn', 'phải rollback cả khối nếu hỏng');
        stR.update(pct(risk, 0), risk > 0.3 ? 'bad' : 'warn');
        stS.update(pct(P_BAD, 0), 'ok', '≈1 thay đổi mỗi lần, rollback một service');
        const svg = s('svg', { viewBox: '0 0 460 200', role: 'img', 'aria-label': 'Rủi ro release theo chu kỳ' });
        const x0 = 40, x1 = 450, y0 = 170, y1 = 14;
        const X = (d) => x0 + (d - 1) / 89 * (x1 - x0), Y = (r) => y0 - r * (y0 - y1);
        [0, 0.25, 0.5, 0.75, 1].forEach((r) => { svg.appendChild(L(x0, Y(r), x1, Y(r), 'grid')); svg.appendChild(T(x0 - 6, Y(r) + 4, pct(r, 0), 't-end t-sm')); });
        [1, 30, 60, 90].forEach((d) => svg.appendChild(T(X(d), y0 + 16, d + ' ngày', 't-mid t-sm')));
        const pts = [];
        for (let d = 1; d <= 90; d++) pts.push(X(d).toFixed(1) + ',' + Y(1 - Math.pow(1 - P_BAD, d * PER_DAY)).toFixed(1));
        svg.appendChild(s('polyline', { points: pts.join(' '), class: 'f-none s-bad s-w2' }));
        svg.appendChild(L(x0, Y(P_BAD), x1, Y(P_BAD), 's-ok s-w2 dash'));
        svg.appendChild(T(x1, Y(P_BAD) - 6, 'microservices', 't-end t-sm t-ok'));
        svg.appendChild(s('circle', { cx: X(sl.value), cy: Y(risk), r: 6, class: 'f-bad' }));
        svg.appendChild(T(X(sl.value) + (sl.value > 70 ? -10 : 10), Y(risk) + 18, 'monolith', (sl.value > 70 ? 't-end ' : '') + 't-sm t-bad lbl-strong'));
        clear(viz).appendChild(svg);
      }
      render();
    }
  });

  /* ========== 1.13 Pain points ========== */
  widget('ch1-pain-points', (root) => {
    tabs(root, [
      { value: 'dev', label: 'Máy dev', build: buildDev },
      { value: 'lat', label: 'Độ trễ', build: buildLat },
      { value: 'e2e', label: 'Test end-to-end', build: buildE2E },
    ], 'dev');

    function buildDev(p) {
      const RAM = 8, PER = { jvm: 1.6, light: 0.3 };
      const sl = slider({ label: 'Số service cần chạy trên laptop', min: 1, max: 30, value: 10, onInput: render });
      const sg = seg({ label: 'Runtime', options: [{ value: 'jvm', label: 'JVM' }, { value: 'light', label: 'Runtime nhẹ (Go, Node)' }], value: 'jvm', onChange: render });
      const stNeed = stat('RAM cần', '', 'warn');
      const stMax = stat('Chạy được tối đa', '', 'accent');
      const stState = stat('Trạng thái', '', 'ok');
      const viz = h('div', { class: 'viz' });
      p.append(h('div', { class: 'controls' }, sl.el, h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Runtime của các service'), sg.el)), h('div', { class: 'stats' }, stNeed, stMax, stState), viz,
        h('p', { class: 'lab-note' }, `Giả định ${RAM} GB RAM trống cho service; JVM ≈ ${fmt(PER.jvm, 1)} GB, runtime nhẹ ≈ ${fmt(PER.light, 1)} GB mỗi service (số liệu minh hoạ). Sách: một laptop chạy được khoảng 4–5 service JVM.`));
      function render() {
        const n = sl.value, per = PER[sg.value], need = n * per, max = Math.floor(RAM / per);
        stNeed.update(fmt(need, 1) + ' GB', need <= RAM ? 'ok' : 'bad', `${n} × ${fmt(per, 1)} GB`);
        stMax.update(max + ' service', 'accent', `trong ${RAM} GB`);
        stState.update(need <= RAM ? 'Chạy được' : 'Không đủ RAM', need <= RAM ? 'ok' : 'bad', need <= RAM ? 'vòng phản hồi nhanh' : 'phải stub, chạy trên cloud hoặc thu hẹp phạm vi');
        const svg = s('svg', { viewBox: '0 0 460 110', role: 'img', 'aria-label': 'RAM laptop so với nhu cầu' });
        const scale = 420 / Math.max(RAM * 1.25, need);
        svg.appendChild(R(20, 30, RAM * scale, 34, 'f-surface2 s-line', 4));
        for (let i = 0; i < n; i++) svg.appendChild(R(20 + i * per * scale + 1, 34, Math.max(1, per * scale - 2), 26, (i + 1) * per <= RAM ? 'f-accent' : 'f-bad', 2));
        svg.appendChild(L(20 + RAM * scale, 20, 20 + RAM * scale, 76, 's-ink s-w2'));
        svg.appendChild(T(20 + RAM * scale, 92, `giới hạn ${RAM} GB`, 't-mid t-sm lbl-strong'));
        svg.appendChild(T(20, 18, 'RAM laptop', 't-sm'));
        clear(viz).appendChild(svg);
      }
      render();
    }

    function buildLat(p) {
      const WORK = 30;
      const slHop = slider({ label: 'Số chặng gọi qua mạng', min: 1, max: 10, value: 4, onInput: render });
      const slMs = slider({ label: 'Độ trễ mỗi chặng (tuần tự hoá + mạng)', min: 1, max: 40, value: 10, format: (v) => v + ' ms', onInput: render });
      const slOk = slider({ label: 'Ngưỡng “đủ nhanh”', min: 40, max: 300, step: 10, value: 80, format: (v) => v + ' ms', onInput: render });
      const stMono = stat('Monolith (gọi hàm)', '', 'ok');
      const stMicro = stat('Microservices', '', 'warn');
      const stVerdict = stat('So với ngưỡng', '', 'ok');
      const viz = h('div', { class: 'viz' });
      p.append(h('div', { class: 'controls' }, slHop.el, slMs.el, slOk.el), h('div', { class: 'stats' }, stMono, stMicro, stVerdict), viz,
        h('p', { class: 'lab-note' }, `Giả định ${WORK} ms xử lý nghiệp vụ như nhau ở hai bên (số liệu minh hoạ). Lời khuyên trong sách: đổi từng chút, đo bằng công cụ như Jaeger, và biết trước thế nào là đủ nhanh.`));
      function render() {
        const hops = slHop.value, ms = slMs.value, lim = slOk.value;
        const mono = WORK + hops * 0.01, micro = WORK + hops * ms;
        stMono.update(fmt(mono, 0) + ' ms', 'ok', 'gọi trong tiến trình gần như miễn phí');
        stMicro.update(fmt(micro, 0) + ' ms', micro <= lim ? 'warn' : 'bad', `${hops} × ${ms} ms thêm vào`);
        stVerdict.update(micro <= lim ? 'Chấp nhận được' : 'Quá chậm', micro <= lim ? 'ok' : 'bad', micro <= lim ? 'chậm hơn một chút vẫn ổn' : 'giảm số chặng hoặc gộp lời gọi');
        const svg = s('svg', { viewBox: '0 0 460 140', role: 'img', 'aria-label': 'Độ trễ monolith so với microservices' });
        const max = Math.max(lim, micro) * 1.1, sc = 330 / max, x0 = 110;
        svg.appendChild(T(x0 - 8, 40, 'Monolith', 't-end lbl-strong'));
        svg.appendChild(R(x0, 26, mono * sc, 22, 'f-ok', 3));
        svg.appendChild(T(x0 - 8, 90, 'Microservices', 't-end lbl-strong'));
        svg.appendChild(R(x0, 76, WORK * sc, 22, 'f-ok', 3));
        for (let i = 0; i < hops; i++) svg.appendChild(R(x0 + (WORK + i * ms) * sc + 1, 76, Math.max(1, ms * sc - 2), 22, 'f-warn', 2));
        svg.appendChild(L(x0 + lim * sc, 14, x0 + lim * sc, 110, 's-bad s-w2 dash'));
        svg.appendChild(T(x0 + lim * sc, 126, 'ngưỡng ' + lim + ' ms', 't-mid t-sm t-bad'));
        clear(viz).appendChild(svg);
      }
      render();
    }

    function buildE2E(p) {
      const slN = slider({ label: 'Số service trong môi trường test', min: 1, max: 40, value: 10, onInput: render });
      const slR = slider({ label: 'Độ tin cậy của mỗi service trong môi trường test', min: 950, max: 999, value: 980, format: (v) => fmt(v / 10, 1) + '%', onInput: render });
      const stFalse = stat('Xác suất báo đỏ sai', '', 'warn');
      const stSetup = stat('Thời gian dựng môi trường', '', 'warn');
      const stAdv = stat('Gợi ý', '', 'accent');
      const viz = h('div', { class: 'viz' });
      p.append(h('div', { class: 'controls' }, slN.el, slR.el), h('div', { class: 'stats' }, stFalse, stSetup, stAdv), viz,
        h('p', { class: 'lab-note' }, 'Báo đỏ sai: test hỏng vì một instance chết hay mạng time-out, không phải vì code sai. Độ tin cậy và 3 phút dựng mỗi service là số liệu minh hoạ.'));
      function render() {
        const n = slN.value, r = slR.value / 1000, fail = 1 - Math.pow(r, n);
        stFalse.update(pct(fail, 0), fail < 0.1 ? 'ok' : fail < 0.3 ? 'warn' : 'bad', 'mỗi lần chạy bộ test');
        stSetup.update(n * 3 + ' phút', n * 3 < 20 ? 'ok' : 'warn', 'deploy và cấu hình từng service');
        stAdv.update(fail < 0.1 ? 'Vẫn ổn' : 'Contract test', fail < 0.1 ? 'ok' : 'accent', fail < 0.1 ? 'giữ một ít test end-to-end' : 'và test trên production');
        const svg = s('svg', { viewBox: '0 0 460 190', role: 'img', 'aria-label': 'Xác suất báo đỏ sai theo số service' });
        const x0 = 44, x1 = 450, y0 = 160, y1 = 12;
        const X = (k) => x0 + (k - 1) / 39 * (x1 - x0), Y = (v) => y0 - v * (y0 - y1);
        [0, 0.25, 0.5, 0.75, 1].forEach((v) => { svg.appendChild(L(x0, Y(v), x1, Y(v), 'grid')); svg.appendChild(T(x0 - 6, Y(v) + 4, pct(v, 0), 't-end t-sm')); });
        [1, 10, 20, 30, 40].forEach((k) => svg.appendChild(T(X(k), y0 + 16, String(k), 't-mid t-sm')));
        svg.appendChild(T((x0 + x1) / 2, y0 + 29, 'số service', 't-mid t-sm t-dim'));
        const pts = [];
        for (let k = 1; k <= 40; k++) pts.push(X(k).toFixed(1) + ',' + Y(1 - Math.pow(r, k)).toFixed(1));
        svg.appendChild(s('polyline', { points: pts.join(' '), class: 'f-none s-bad s-w2' }));
        svg.appendChild(s('circle', { cx: X(n), cy: Y(fail), r: 6, class: 'f-bad' }));
        svg.setAttribute('viewBox', '0 0 460 196');
        clear(viz).appendChild(svg);
      }
      render();
    }
  });

  /* ========== 1.14 Should I use microservices? ========== */
  widget('ch1-decision', (root) => {
    const slDev = slider({ label: 'Số developer', min: 1, max: 300, value: 5, onInput: render });
    const sgDom = seg({ label: 'Domain', options: [{ value: 'pmf', label: 'Đang tìm product-market fit' }, { value: 'mid', label: 'Khá ổn định' }, { value: 'stable', label: 'Ổn định, hiểu rõ' }], value: 'pmf', onChange: render });
    const sgOps = seg({ label: 'Ai vận hành', options: [{ value: 'saas', label: 'Bạn vận hành (SaaS 24/7)' }, { value: 'onprem', label: 'Khách hàng tự cài' }], value: 'saas', onChange: render });
    const cbCh = checkbox('Cần phục vụ nhiều kênh (web, mobile, đối tác)', false, render);
    const cbCloud = checkbox('Muốn tận dụng dịch vụ managed của public cloud', true, render);
    const cbScale = checkbox('Một phần hệ thống cần scale khác hẳn phần còn lại', false, render);
    const cbLog = checkbox('Đã có log aggregation và kinh nghiệm vận hành', false, render);
    const verdict = h('p', { class: 'ch1-verdict' });
    const stScore = stat('Điểm tóm tắt', '', 'accent');
    const stTax = stat('Microservice tax', '', 'warn');
    const reasons = h('ul', { class: 'ch1-reasons' });
    const viz = h('div', { class: 'viz' });
    root.append(
      h('div', { class: 'controls' }, slDev.el),
      h('div', { class: 'controls' },
        h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Mức ổn định của domain'), sgDom.el),
        h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Ai triển khai và vận hành phần mềm'), sgOps.el)),
      h('div', { class: 'ch1-chk' }, cbCh.el, cbCloud.el, cbScale.el, cbLog.el),
      h('div', { class: 'stats' }, stScore, stTax), viz, verdict,
      h('div', { class: 'box' }, h('h5', 'Lập luận theo sách'), reasons));

    function render() {
      const items = [];
      const add = (w, text) => items.push([w, text]);
      const n = slDev.value;
      if (n < 10) add(-3, `Đội ${n} người: chi phí cố định của microservices rất nặng. Một người lo hạ tầng là mất ${pct(1 / n, 0)} năng lực làm sản phẩm.`);
      else if (n < 30) add(0, 'Đội cỡ vừa: delivery contention bắt đầu xuất hiện nhưng chưa phải vấn đề lớn.');
      else if (n < 80) add(2, 'Nhiều developer cần làm việc độc lập: microservices giúp giảm delivery contention.');
      else add(3, 'Tổ chức lớn đang tăng trưởng (như scale-up trăm người): microservices giúp mở rộng đội ngũ dễ hơn.');
      if (sgDom.value === 'pmf') add(-3, 'Domain còn thay đổi mạnh: ranh giới service sẽ phải dời liên tục (Uber khởi đầu với xe limo, Flickr từ một game online).');
      else if (sgDom.value === 'mid') add(0, 'Domain khá ổn định: có thể bắt đầu với modular monolith rồi tách dần.');
      else add(2, 'Domain ổn định: vẽ ranh giới service ổn định là khả thi.');
      if (sgOps.value === 'onprem') add(-4, 'Khách hàng tự cài: họ không có kỹ năng vận hành hệ phân tán (“cứ đặt 20 pod này lên cluster Kubernetes của bạn”).');
      else add(2, 'SaaS chạy 24/7: release độc lập và scale theo tải là lợi thế lớn.');
      if (cbCh.value) add(1, 'Nhiều kênh: microservices mở ra nhiều seam để dùng lại chức năng.');
      if (cbCloud.value) add(1, 'Không phụ thuộc công nghệ giúp tận dụng FaaS, VM managed, PaaS cho từng service.');
      if (cbScale.value) add(1, 'Scale có chọn lọc: chỉ scale phần cần scale.');
      if (cbLog.value) add(1, 'Đã có log aggregation, điều kiện tiên quyết theo sách.');
      else add(-1, 'Chưa có log aggregation: hãy làm việc đó trước khi tách service.');
      const score = items.reduce((a, x) => a + x[0], 0);
      clear(reasons);
      items.forEach(([w, t]) => reasons.appendChild(h('li', { class: w > 0 ? 'pro' : w < 0 ? 'con' : '' }, t)));
      const tone = score <= -2 ? 'bad' : score <= 2 ? 'warn' : 'ok';
      verdict.textContent = score <= -2 ? 'Nghiêng mạnh về monolith (tốt nhất là modular monolith). Chuyển sau sẽ dễ hơn, khi đã biết nỗi đau nằm ở đâu.'
        : score <= 2 ? 'Chưa rõ ràng: bắt đầu với modular monolith, tách dần khi một nỗi đau cụ thể xuất hiện.'
          : 'Microservices có thể đáng giá. Vẫn nên vặn núm từ từ: tách vài service, đo tác động, rồi đi tiếp.';
      stScore.update((score > 0 ? '+' : '') + score, tone, 'chỉ là cách tóm tắt');
      stTax.update(pct(1 / n, 0), n < 10 ? 'bad' : n < 30 ? 'warn' : 'ok', 'năng lực mất nếu 1 người lo hạ tầng');

      const svg = s('svg', { viewBox: '0 0 460 70', role: 'img', 'aria-label': 'Thang điểm từ monolith đến microservices' });
      const lo = -12, hi = 12, X = (v) => 20 + (clamp(v, lo, hi) - lo) / (hi - lo) * 420;
      svg.appendChild(R(X(lo), 22, X(-2) - X(lo), 14, 'f-bad-soft', 3));
      svg.appendChild(R(X(-2), 22, X(2) - X(-2), 14, 'f-warn-soft', 0));
      svg.appendChild(R(X(2), 22, X(hi) - X(2), 14, 'f-ok-soft', 3));
      svg.appendChild(T(X(lo), 14, 'Monolith', 't-sm t-bad lbl-strong'));
      svg.appendChild(T(X(hi), 14, 'Microservices', 't-end t-sm t-ok lbl-strong'));
      svg.appendChild(s('polygon', { points: `${X(score)},40 ${X(score) - 7},54 ${X(score) + 7},54`, class: 'f-ink' }));
      svg.appendChild(T(X(score), 66, String(score), 't-mid t-sm lbl-strong'));
      clear(viz).appendChild(svg);
    }
    render();
  });

  /* ========== Glossary ========== */
  const G = (key, term, vi, topic, def) => ({ key, term, vi, ch: 1, topic, def });
  glossary.add([
    G('microservices', 'Microservices', 'vi dịch vụ', 'ch1-at-a-glance', 'Các service release độc lập, được mô hình hoá quanh một miền nghiệp vụ, đóng gói chức năng và cung cấp nó qua mạng. Là một dạng SOA có quan điểm rõ ràng về ranh giới.'),
    G('network-endpoint', 'Network endpoint', 'điểm cuối mạng', 'ch1-at-a-glance', 'Điểm mà bên ngoài dùng để gọi một service, ví dụ REST API hay một hàng đợi. Là phần duy nhất của microservice mà consumer nhìn thấy.'),
    G('information-hiding', 'Information hiding', 'che giấu thông tin', 'ch1-at-a-glance', 'Nguyên lý của David Parnas (1971): giấu nhiều nhất có thể bên trong một thành phần, lộ ra ít nhất có thể qua interface, để phần bên trong được tự do thay đổi.'),
    G('loose-coupling', 'Loose coupling', 'ghép nối lỏng', 'ch1-at-a-glance', 'Mức phụ thuộc thấp giữa các service: thay đổi một service hiếm khi buộc service khác phải thay đổi theo.'),
    G('cohesion', 'Cohesion', 'tính gắn kết', 'ch1-at-a-glance', 'Mức độ các thứ thay đổi cùng nhau được đặt cùng một chỗ. Microservices hướng tới gắn kết cao theo nghiệp vụ.'),
    G('soa', 'Service-oriented architecture (SOA)', 'kiến trúc hướng dịch vụ', 'ch1-soa', 'Cách thiết kế trong đó nhiều service (thường là tiến trình riêng) phối hợp qua lời gọi mạng. Microservices là một cách làm SOA cụ thể.'),
    G('technology-agnostic', 'Technology agnostic', 'không phụ thuộc công nghệ', 'ch1-at-a-glance', 'Microservices không áp đặt ngôn ngữ, framework hay database: mỗi service tự chọn công nghệ bên trong, miễn là giữ đúng hợp đồng mạng.'),
    G('upstream-consumer', 'Consumer', 'bên gọi, bên tiêu thụ', 'ch1-at-a-glance', 'Microservice hoặc chương trình khác gọi tới endpoint của một service. Consumer chỉ biết hợp đồng, không biết cài đặt bên trong.'),
    G('backward-compatibility', 'Backward compatibility', 'tương thích ngược', 'ch1-at-a-glance', 'Thay đổi interface mà consumer cũ vẫn hoạt động, ví dụ thêm trường mới thay vì đổi tên hay xoá trường. Phá vỡ tương thích ngược buộc consumer sửa theo.'),
    G('vendor-middleware', 'Vendor middleware', 'middleware của nhà cung cấp', 'ch1-soa', 'Sản phẩm trung gian như ESB do nhà cung cấp bán. Theo Newman, đây là một nguyên nhân khiến nhiều dự án SOA thất bại.'),
    G('independent-deployability', 'Independent deployability', 'khả năng triển khai độc lập', 'ch1-independent-deploy', 'Có thể sửa, deploy và release một microservice tới người dùng mà không phải deploy service nào khác. Là khái niệm quan trọng nhất của cuốn sách.'),
    G('service-contract', 'Service contract', 'hợp đồng service', 'ch1-independent-deploy', 'Thoả thuận tường minh về những gì service cung cấp qua mạng: endpoint, định dạng dữ liệu, ngữ nghĩa. Hợp đồng ổn định là điều kiện để triển khai độc lập.'),
    G('forcing-function', 'Forcing function', 'yếu tố ép buộc', 'ch1-independent-deploy', 'Một mục tiêu mà khi cố đạt được sẽ buộc bạn làm đúng nhiều thứ khác. Triển khai độc lập ép bạn có ghép nối lỏng và hợp đồng ổn định.'),
    G('lock-step-release', 'Lock-step release', 'release đồng loạt', 'ch1-independent-deploy', 'Tình trạng nhiều service phải deploy cùng nhau, theo đúng thứ tự, vì thay đổi ở một service kéo theo service khác.'),
    G('domain-driven-design', 'Domain-driven design (DDD)', 'thiết kế hướng miền', 'ch1-business-domain', 'Cách tiếp cận để cấu trúc code phản ánh miền nghiệp vụ thật. Microservices dùng ý tưởng này để vẽ ranh giới service.'),
    G('three-tier-architecture', 'Three-tier architecture', 'kiến trúc ba tầng', 'ch1-business-domain', 'Kiến trúc chia theo chức năng kỹ thuật: trình bày, ứng dụng, dữ liệu. Gắn kết cao về công nghệ nhưng thấp về nghiệp vụ.'),
    G('vertical-slice', 'Vertical slice', 'lát cắt dọc', 'ch1-business-domain', 'Một service chứa trọn một mảng nghiệp vụ từ UI, logic tới dữ liệu, để thay đổi nghiệp vụ không phải xuyên qua nhiều service.'),
    G('encapsulation', 'Encapsulation', 'đóng gói', 'ch1-own-state', 'Gói dữ liệu và hành vi lại với nhau, chỉ cho bên ngoài truy cập qua interface. Microservice giấu database của nó cũng theo tinh thần này.'),
    G('shared-database', 'Shared database', 'database dùng chung', 'ch1-own-state', 'Nhiều service đọc/ghi trực tiếp cùng một database. Schema thành hợp đồng ngầm, nên đây là một trong những điều tệ nhất cho triển khai độc lập.'),
    G('incremental-migration', 'Incremental migration', 'di chuyển dần dần', 'ch1-size', 'Chuyển sang microservices từng bước nhỏ: tách vài service, đo tác động, học kỹ năng mới rồi mới đi tiếp.'),
    G('dial-not-switch', 'Dial, not a switch', 'núm xoay, không phải công tắc', 'ch1-flexibility', 'Hình ảnh của Newman: áp dụng microservices là vặn dần một núm, không phải bật một lần. Vặn lên thì linh hoạt hơn nhưng cũng đau hơn.'),
    G('conways-law', 'Conway’s law', 'định luật Conway', 'ch1-conway', 'Tổ chức thiết kế hệ thống sẽ tạo ra thiết kế có cấu trúc giống cấu trúc giao tiếp của chính nó (Melvin Conway).'),
    G('poly-skilled-team', 'Poly-skilled team', 'đội đa kỹ năng', 'ch1-conway', 'Đội gồm người có nhiều kỹ năng (UI, backend, dữ liệu) để làm trọn một mảng nghiệp vụ, giảm bàn giao giữa các đội.'),
    G('monolith', 'Monolith', 'nguyên khối', 'ch1-monolith', 'Theo sách: một hệ thống mà mọi chức năng phải deploy cùng nhau, tức chỉ có một đơn vị triển khai.'),
    G('single-process-monolith', 'Single-process monolith', 'monolith một tiến trình', 'ch1-monolith', 'Toàn bộ code đóng gói và chạy trong một tiến trình, có thể chạy nhiều instance để tăng độ bền hay khả năng mở rộng.'),
    G('modular-monolith', 'Modular monolith', 'monolith dạng module', 'ch1-monolith', 'Một tiến trình được chia thành các module có ranh giới rõ, làm song song được nhưng vẫn deploy chung. Shopify là ví dụ thành công.'),
    G('distributed-monolith', 'Distributed monolith', 'monolith phân tán', 'ch1-monolith', 'Hệ thống nhiều service nhưng vẫn phải deploy cùng nhau. Mang nhược điểm của cả hệ phân tán lẫn monolith.'),
    G('delivery-contention', 'Delivery contention', 'tranh chấp khi giao hàng', 'ch1-contention', 'Khi nhiều người làm chung một chỗ: cùng sửa một đoạn code, muốn release vào thời điểm khác nhau, không rõ ai sở hữu gì.'),
    G('log-aggregation', 'Log aggregation', 'tập trung log', 'ch1-enabling-tech', 'Gom log từ mọi service về một chỗ để tìm kiếm, phân tích và cảnh báo. Newman coi đây là điều kiện tiên quyết trước khi dùng microservices.'),
    G('correlation-id', 'Correlation ID', 'mã tương quan', 'ch1-enabling-tech', 'Một ID gắn vào mọi lời gọi và mọi dòng log bắt nguồn từ cùng một thao tác người dùng, giúp lọc ra toàn bộ một luồng xử lý.'),
    G('distributed-tracing', 'Distributed tracing', 'truy vết phân tán', 'ch1-enabling-tech', 'Ghi lại và phân tích một luồng gọi đi qua nhiều service theo thời gian (ví dụ Jaeger) để tìm lỗi và nút thắt cổ chai.'),
    G('container', 'Container', 'container', 'ch1-enabling-tech', 'Cách chạy tiến trình cô lập, nhẹ hơn máy ảo, khởi động nhanh và rẻ. Phù hợp để chạy từng instance microservice riêng.'),
    G('kubernetes', 'Kubernetes', 'nền tảng điều phối container', 'ch1-enabling-tech', 'Nền tảng điều phối container trên nhiều máy. Hữu ích khi có nhiều service, nhưng khó biện minh khi mới có vài service; nên dùng bản managed.'),
    G('apache-kafka', 'Apache Kafka', 'nền tảng streaming Kafka', 'ch1-enabling-tech', 'Nền tảng streaming phổ biến cho microservices: lưu bền message, compaction, mở rộng cho khối lượng lớn, kèm KSQL để xử lý stream.'),
    G('debezium', 'Debezium', 'công cụ CDC Debezium', 'ch1-enabling-tech', 'Công cụ stream thay đổi từ các nguồn dữ liệu có sẵn (như database cũ) vào Kafka.'),
    G('serverless', 'Serverless', 'phi máy chủ', 'ch1-enabling-tech', 'Nhóm sản phẩm giấu hẳn máy chủ bên dưới: bạn dùng dịch vụ hoặc deploy code mà không quản lý máy.'),
    G('faas', 'Function as a Service (FaaS)', 'hàm như một dịch vụ', 'ch1-enabling-tech', 'Dạng serverless trong đó bạn chỉ deploy code; nền tảng tự khởi chạy instance theo nhu cầu.'),
    G('technology-heterogeneity', 'Technology heterogeneity', 'đa dạng công nghệ', 'ch1-advantages', 'Mỗi service có thể dùng công nghệ khác nhau: chọn đúng công cụ cho từng việc và thử công nghệ mới ở chỗ ít rủi ro.'),
    G('bulkhead', 'Bulkhead', 'vách ngăn', 'ch1-advantages', 'Ranh giới cô lập lỗi, như vách ngăn trên tàu: một phần hỏng không kéo cả hệ thống chìm theo, hệ thống xuống cấp từng phần.'),
    G('composability', 'Composability', 'khả năng kết hợp', 'ch1-advantages', 'Khả năng ghép các service theo cách mới để phục vụ kênh và tính năng mới (web, mobile, thiết bị đeo…).'),
    G('seam', 'Seam', 'đường nối', 'ch1-advantages', 'Chỗ trong hệ thống có thể tách ra hoặc dùng lại độc lập. Microservices mở ra nhiều seam; monolith thường chỉ có một seam thô.'),
    G('technology-overload', 'Technology overload', 'quá tải công nghệ', 'ch1-pain-points', 'Áp dụng quá nhiều công nghệ mới cùng lúc khi chuyển sang microservices, làm đội ngũ quá tải và chậm ship tính năng.'),
    G('end-to-end-test', 'End-to-end test', 'test đầu-cuối', 'ch1-pain-points', 'Test chạy qua toàn bộ hệ thống. Với nhiều service, nó tốn công dựng, chạy lâu, hay báo lỗi sai và kém hiệu quả dần.'),
    G('contract-testing', 'Contract testing', 'kiểm thử hợp đồng', 'ch1-pain-points', 'Kiểm tra từng service có giữ đúng hợp đồng mà consumer mong đợi, thay cho nhiều test end-to-end tốn kém.'),
    G('testing-in-production', 'Testing in production', 'kiểm thử trên production', 'ch1-pain-points', 'Các kỹ thuật kiểm tra hệ thống ngay trên môi trường thật (theo dõi, release dần) để bổ sung cho test trước khi release.'),
    G('latency', 'Latency', 'độ trễ', 'ch1-pain-points', 'Thời gian chờ một thao tác hoàn tất. Với microservices, mỗi chặng gọi mạng thêm chi phí tuần tự hoá, truyền và giải tuần tự hoá.'),
    G('saga', 'Saga', 'saga', 'ch1-pain-points', 'Cách điều phối một thao tác nghiệp vụ trải qua nhiều service bằng chuỗi bước và bước bù trừ, thay cho transaction phân tán.'),
    G('eventual-consistency', 'Eventual consistency', 'nhất quán cuối cùng', 'ch1-pain-points', 'Dữ liệu ở các nơi có thể tạm thời lệch nhau nhưng sẽ hội tụ về cùng giá trị sau một thời gian.'),
    G('read-replica', 'Read replica', 'bản sao chỉ đọc', 'ch1-pain-points', 'Bản sao của database dùng cho truy vấn đọc, ví dụ để chạy báo cáo mà không làm chậm database chính.'),
    G('data-lake', 'Data lake', 'hồ dữ liệu', 'ch1-pain-points', 'Kho lưu dữ liệu thô từ nhiều nguồn ở một chỗ để phân tích và báo cáo sau này.'),
    G('man-in-the-middle', 'Man-in-the-middle attack', 'tấn công xen giữa', 'ch1-pain-points', 'Kẻ tấn công chen vào giữa hai bên đang giao tiếp để nghe lén hoặc sửa dữ liệu. Microservices có nhiều dữ liệu đi qua mạng hơn nên dễ bị hơn.'),
    G('distributed-transaction', 'Distributed transaction', 'transaction phân tán', 'ch1-pain-points', 'Transaction trải qua nhiều tiến trình hoặc database. Theo Newman, hầu như luôn gây rắc rối; nên dùng saga.'),
    G('microservice-tax', 'Microservice tax', 'thuế microservice', 'ch1-should-i', 'Chi phí cố định để deploy và vận hành microservices. Càng nặng khi đội càng nhỏ: một trong năm người lo hạ tầng là mất 20% năng lực.'),
    G('saas', 'Software as a Service (SaaS)', 'phần mềm như một dịch vụ', 'ch1-should-i', 'Phần mềm do nhà cung cấp vận hành và phục vụ qua mạng, thường chạy 24/7. Là nơi microservices phát huy tốt.'),
    G('product-market-fit', 'Product-market fit', 'độ khớp sản phẩm - thị trường', 'ch1-should-i', 'Lúc sản phẩm thực sự đáp ứng nhu cầu thị trường. Trước đó domain thay đổi mạnh nên ranh giới service khó ổn định.'),
    G('paas', 'Platform as a Service (PaaS)', 'nền tảng như một dịch vụ', 'ch1-should-i', 'Nền tảng managed để chạy ứng dụng mà không phải quản lý máy chủ và hệ điều hành.'),
  ]);
})();
