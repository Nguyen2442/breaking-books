/* Chương 7 — Deployment: widgets + glossary */
(function () {
  const { h, s, clear, fmt, pct, rng, clamp, sleep,
    slider, seg, button, checkbox, stat, log, jsonHTML, widget, glossary } = window.DDIA;

  // ---------- local helpers ----------
  const svgBox = (w, hh, label) => s('svg', { viewBox: `0 0 ${w} ${hh}`, role: 'img', 'aria-label': label });
  const T = (x, y, str, cls, anchor) => s('text', { x, y, class: cls || null, 'text-anchor': anchor || null }, String(str));
  const R = (x, y, w, hh, cls, rx) => s('rect', { x, y, width: Math.max(0, w), height: Math.max(0, hh), rx: rx == null ? 6 : rx, class: cls });
  const L = (x1, y1, x2, y2, cls) => s('line', { x1, y1, x2, y2, class: 'f-none ' + (cls || 's-line') });
  const C = (cx, cy, r, cls) => s('circle', { cx, cy, r, class: cls });
  const P = (d, cls) => s('path', { d, class: cls });
  const ctl = (label, el) => h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, label), el);
  function meter(label) {
    const bar = h('i');
    const wrap = h('div', { class: 'meter' }, bar);
    const val = h('b');
    const el = h('div', { class: 'meter-row' }, h('span', label), wrap, val);
    el.update = (frac, tone, txt) => { bar.style.width = clamp(frac, 0, 1) * 100 + '%'; wrap.className = 'meter' + (tone ? ' ' + tone : ''); val.textContent = txt; };
    return el;
  }
  function verdict() {
    const b = h('b');
    const p = h('span');
    const el = h('div', { class: 'verdict', role: 'status' }, b, p);
    el.update = (tone, title, text) => { el.className = 'verdict' + (tone ? ' ' + tone : ''); b.textContent = title; p.textContent = text; };
    return el;
  }
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  // =====================================================================
  // 7.1 — Instances across availability zones
  // =====================================================================
  widget('ch7-az-spread', (root) => {
    const NEED = 2;
    let n = 4, azs = 2, fail = 'none';
    const sN = seg({ label: 'Số instance', options: [2, 4, 6].map((v) => ({ value: v, label: v + ' instance' })), value: n, onChange: (v) => { n = v; render(); } });
    const sA = seg({ label: 'Số AZ', options: [1, 2, 3].map((v) => ({ value: v, label: v + ' AZ' })), value: azs, onChange: (v) => { azs = v; render(); } });
    const sF = seg({ label: 'Sự cố', options: [{ value: 'none', label: 'Bình thường' }, { value: 'one', label: '1 instance chết' }, { value: 'az', label: 'Mất trọn AZ-A' }], value: fail, onChange: (v) => { fail = v; render(); } });
    const vz = h('div', { class: 'viz' });
    const stAlive = stat('Instance còn sống', '');
    const stCap = stat('Công suất so với nhu cầu', '');
    const stReach = stat('Invoice gọi được Order?', '');
    const vd = verdict();
    root.append(
      h('div', { class: 'controls' }, ctl('Số instance Order', sN.el), ctl('Rải qua', sA.el), ctl('Giả lập sự cố', sF.el)),
      vz, h('div', { class: 'stats' }, stAlive, stCap, stReach), vd,
      h('p', { class: 'lab-note' }, 'Giả định tải hiện tại cần ít nhất 2 instance Order mới phục vụ đủ (số liệu minh hoạ). Mỗi instance nằm trên một máy riêng.'));

    function render() {
      const W = 640, H = 290;
      const svg = svgBox(W, H, 'Topo triển khai Order qua các availability zone');
      const names = ['AZ-A', 'AZ-B', 'AZ-C'];
      const inst = Array.from({ length: n }, (_, i) => ({ i, az: i % azs }));
      inst.forEach((x) => { x.dead = (fail === 'one' && x.i === 0) || (fail === 'az' && x.az === 0); });
      const lines = s('g');
      svg.append(lines);
      svg.append(R(20, 18, 110, 40, 'f-violet-soft s-violet'), T(75, 43, 'Invoice', 'lbl-strong', 'middle'));
      svg.append(R(255, 18, 130, 40, 'f-surface2 s-ink3'), T(320, 36, 'Load balancer', 'lbl-strong', 'middle'), T(320, 50, 'trước Order', 't-sm', 'middle'));
      lines.append(L(130, 38, 255, 38, 'axis sw2'));
      const gap = 14, x0 = 20, aw = (W - 40 - gap * (azs - 1)) / azs, ay = 105, ah = 170;
      for (let a = 0; a < azs; a++) {
        const ax = x0 + a * (aw + gap);
        const azDead = fail === 'az' && a === 0;
        svg.append(R(ax, ay, aw, ah, (azDead ? 'f-bad-soft s-bad' : 'f-surface s-ink3') + ' dash', 10),
          T(ax + 10, ay + 18, names[a] + (azDead ? ' · mất kết nối' : ''), azDead ? 't-bad' : 'lbl-strong'));
        const mine = inst.filter((x) => x.az === a);
        const iw = 70, ih = 46;
        const cols = Math.max(1, Math.floor((aw - 12) / (iw + 8)));
        mine.forEach((x, k) => {
          const cx = ax + 10 + (k % cols) * (iw + 8), cy = ay + 32 + Math.floor(k / cols) * (ih + 10);
          x.cx = cx + iw / 2; x.cy = cy;
          svg.append(R(cx, cy, iw, ih, x.dead ? 'f-bad-soft s-bad' : 'f-accent-soft s-accent'),
            T(cx + iw / 2, cy + 20, 'Order #' + (x.i + 1), x.dead ? 't-bad' : 'lbl-strong', 'middle'),
            T(cx + iw / 2, cy + 35, x.dead ? 'đã chết' : 'máy ' + (x.i + 1), 't-sm', 'middle'));
        });
      }
      inst.forEach((x) => lines.append(L(320, 58, x.cx, x.cy, x.dead ? 's-bad dash' : 's-accent')));
      clear(vz).append(svg);

      const alive = inst.filter((x) => !x.dead).length;
      stAlive.update(`${alive}/${n}`, alive === n ? 'ok' : alive === 0 ? 'bad' : 'warn');
      stCap.update(pct(alive / NEED, 0), alive >= NEED ? 'ok' : alive > 0 ? 'warn' : 'bad', `cần ${NEED} instance`);
      stReach.update(alive > 0 ? 'Có' : 'Không', alive > 0 ? 'ok' : 'bad');
      if (alive === 0) vd.update('bad', 'Sập hoàn toàn.', azs === 1 ? 'Mọi instance nằm trong cùng một AZ. Cloud không cam kết SLA cho một AZ, nên đây là kịch bản bạn phải lường trước.' : 'Không còn instance nào để load balancer chuyển request tới.');
      else if (alive < NEED) vd.update('warn', 'Còn sống nhưng thiếu công suất.', 'Dịch vụ vẫn trả lời nhưng sẽ chậm hoặc từ chối bớt request. Thêm instance hoặc thêm AZ để mất một vùng vẫn còn đủ.');
      else if (fail === 'none') vd.update('accent', 'Đang khoẻ.', azs === 1 ? 'Thử chọn “Mất trọn AZ-A”: với 1 AZ, mọi trứng đang nằm trong một giỏ.' : 'Thử giả lập mất trọn AZ-A để xem việc rải qua nhiều AZ có đáng không.');
      else vd.update('ok', 'Chịu được sự cố.', 'Load balancer chỉ chuyển request tới các instance còn sống; Invoice không nhận ra có gì xảy ra.');
    }
    render();
  });

  // =====================================================================
  // 7.2 — Read replicas + shared DB infrastructure
  // =====================================================================
  widget('ch7-db-replicas', (root) => {
    const CAP = 2000;
    const sQ = slider({ label: 'Tổng truy vấn/giây', min: 1000, max: 6000, step: 500, value: 3000, format: (v) => fmt(v) + ' qps', onInput: drawRep });
    const sR = slider({ label: 'Tỉ lệ đọc', min: 50, max: 95, step: 5, value: 80, format: (v) => v + '%', onInput: drawRep });
    const sN = slider({ label: 'Số read replica', min: 0, max: 4, value: 0, onInput: drawRep });
    const vzA = h('div', { class: 'viz' });
    const stP = stat('Tải node primary', '');
    const stRp = stat('Tải mỗi replica', '');
    const noteA = h('p', { class: 'lab-note' });

    let mode = 'shared', crashed = false;
    const sM = seg({ label: 'Mô hình hạ tầng', options: [{ value: 'shared', label: 'Hạ tầng chung (on-prem)' }, { value: 'dedicated', label: 'Riêng từng service (cloud)' }], value: mode, onChange: (v) => { mode = v; crashed = false; drawInfra(); } });
    const bCrash = button('Làm sập hạ tầng DB của Order', () => { crashed = !crashed; drawInfra(); }, 'danger');
    const vzB = h('div', { class: 'viz' });
    const stHit = stat('Microservice bị ảnh hưởng', '');
    const stEng = stat('Engine DB phải vận hành', '');
    const noteB = h('p', { class: 'lab-note' });

    root.append(h('div', { class: 'lab-split' },
      h('div', { class: 'box' }, h('h5', 'Read replica cho Order'), h('div', { class: 'controls' }, sQ.el, sR.el, sN.el), vzA, h('div', { class: 'stats' }, stP, stRp), noteA),
      h('div', { class: 'box' }, h('h5', 'Hạ tầng database'), ctl('Mô hình', sM.el), h('div', { class: 'btn-row' }, bCrash), vzB, h('div', { class: 'stats' }, stHit, stEng), noteB)),
      h('p', { class: 'lab-note' }, 'Công suất mỗi node giả định 2.000 truy vấn/giây (số liệu minh hoạ).'));

    function drawRep() {
      const q = sQ.value, r = sR.value / 100, n = sN.value;
      const writes = q * (1 - r), reads = q * r;
      const nodes = [{ name: 'Primary', load: writes + (n === 0 ? reads : 0), w: writes }];
      for (let i = 0; i < n; i++) nodes.push({ name: 'Replica ' + (i + 1), load: reads / n, w: 0 });
      const W = 320, H = 210, top = 18, bot = 170, maxU = 2;
      const y = (u) => bot - (Math.min(u, maxU) / maxU) * (bot - top);
      const svg = svgBox(W, H, 'Mức tải của từng node database');
      [0, 0.5, 1, 1.5, 2].forEach((u) => { svg.append(L(36, y(u), W - 6, y(u), u === 1 ? 's-bad dash sw2' : 'grid'), T(30, y(u) + 4, (u * 100) + '%', 't-sm', 'end')); });
      const bw = Math.min(44, (W - 50) / nodes.length - 10);
      nodes.forEach((nd, i) => {
        const x = 44 + i * ((W - 50) / nodes.length);
        const u = nd.load / CAP;
        const tone = u > 1 ? 'f-bad' : u > 0.8 ? 'f-warn' : 'f-accent';
        svg.append(R(x, y(u), bw, bot - y(u), tone, 3));
        if (nd.w) svg.append(R(x, y(nd.w / CAP), bw, bot - y(nd.w / CAP), 'f-violet', 3));
        svg.append(T(x + bw / 2, bot + 14, i === 0 ? 'Primary' : 'R' + i, 'lbl-strong', 'middle'), T(x + bw / 2, Math.max(top + 10, y(u) - 4), pct(u, 0), 't-sm', 'middle'));
      });
      svg.append(T(W - 6, top - 6, 'vạch đỏ = 100% công suất', 't-sm t-bad', 'end'), T(44, H - 6, 'tím = phần tải ghi', 't-sm t-violet'));
      clear(vzA).append(svg);
      const pu = nodes[0].load / CAP;
      stP.update(pct(pu, 0), pu > 1 ? 'bad' : pu > 0.8 ? 'warn' : 'ok', fmt(nodes[0].load) + ' qps');
      if (n) { const ru = reads / n / CAP; stRp.update(pct(ru, 0), ru > 1 ? 'bad' : ru > 0.8 ? 'warn' : 'ok', fmt(reads / n) + ' qps'); } else stRp.update('—', null, 'chưa có replica');
      if (writes > CAP) noteA.textContent = 'Riêng tải ghi đã vượt công suất primary. Thêm replica không giúp gì; với database quan hệ, mở rộng ghi thường cần sharding và thêm độ phức tạp.';
      else if (pu > 1) noteA.textContent = 'Primary đang gánh cả đọc lẫn ghi và quá tải. Thêm một read replica để chuyển tải đọc đi.';
      else if (n && reads / n > CAP) noteA.textContent = 'Replica quá tải: tải đọc mở rộng được bằng cách thêm replica.';
      else noteA.textContent = n ? 'Tải đọc đi sang replica, primary còn dư địa cho tải ghi.' : 'Mọi truy vấn đang dồn vào primary. Thử tăng tổng tải hoặc thêm replica.';
    }

    function drawInfra() {
      const svcs = ['Invoice', 'Order', 'Catalog'];
      const W = 320, H = 210;
      const svg = svgBox(W, H, 'Database của ba microservice trên hạ tầng chung hoặc riêng');
      const sx = (i) => 14 + i * 102, sw = 88;
      const hit = (i) => crashed && (mode === 'shared' || i === 1);
      svcs.forEach((name, i) => {
        svg.append(R(sx(i), 12, sw, 34, hit(i) ? 'f-bad-soft s-bad' : 'f-violet-soft s-violet'), T(sx(i) + sw / 2, 34, name, hit(i) ? 't-bad' : 'lbl-strong', 'middle'));
        svg.append(L(sx(i) + sw / 2, 46, sx(i) + sw / 2, 112, hit(i) ? 's-bad dash' : 's-ink3'));
      });
      if (mode === 'shared') {
        svg.append(R(8, 92, W - 16, 100, (crashed ? 'f-bad-soft s-bad' : 'f-surface2 s-ink3'), 10), T(W / 2, 184, crashed ? 'Engine DB dùng chung · SẬP' : 'Một engine DB + phần cứng dùng chung', crashed ? 't-bad' : 'lbl-strong', 'middle'));
      }
      svcs.forEach((name, i) => {
        if (mode === 'dedicated') svg.append(R(sx(i) - 4, 92, sw + 8, 100, (hit(i) ? 'f-bad-soft s-bad' : 'f-surface2 s-ink3'), 10), T(sx(i) + sw / 2, 184, hit(i) ? 'SẬP' : 'engine riêng', hit(i) ? 't-bad' : 't-sm', 'middle'));
        svg.append(R(sx(i) + 10, 112, sw - 20, 50, hit(i) ? 'f-bad-soft s-bad' : 'f-accent-soft s-accent', 8), T(sx(i) + sw / 2, 141, name.toLowerCase() + '_db', hit(i) ? 't-bad' : 'lbl-strong', 'middle'));
      });
      clear(vzB).append(svg);
      bCrash.textContent = crashed ? 'Khôi phục hạ tầng' : 'Làm sập hạ tầng DB của Order';
      const nHit = crashed ? (mode === 'shared' ? 3 : 1) : 0;
      stHit.update(String(nHit), nHit === 0 ? 'ok' : nHit === 1 ? 'warn' : 'bad', crashed ? 'trên 3 service' : 'chưa có sự cố');
      stEng.update(mode === 'shared' ? '1' : '3', 'accent', mode === 'shared' ? 'gom phần cứng, ít bản quyền' : 'dịch vụ quản lý (như RDS) gánh bớt');
      noteB.textContent = mode === 'shared'
        ? 'Ba database vẫn cách ly logic, không can thiệp được vào nhau. Nhưng khi hạ tầng chung sập, cả ba microservice cùng chết.'
        : 'Mỗi service có hạ tầng riêng: chủ service kiểm soát nhiều hơn, và sự cố chỉ ảnh hưởng một service. Trên public cloud, chi phí của sự cách ly này thấp.';
    }
    drawRep();
    drawInfra();
  });

  // =====================================================================
  // 7.3 — Environments
  // =====================================================================
  widget('ch7-env-topology', (root) => {
    const ENVS = {
      laptop: { name: 'Laptop của dev', inst: 1, machines: 1, dcs: 1, fb: 0.95, like: 0.15, cfg: { env: 'local', instances: 1, logLevel: 'DEBUG', db: 'localhost:5432/catalog', dataCenters: 1 }, note: 'Một instance chạy local. Build và chạy rất nhanh, nhưng phần cứng khác xa production.' },
      ci: { name: 'Môi trường CI', inst: 2, machines: 1, dcs: 1, fb: 0.75, like: 0.4, cfg: { env: 'ci', instances: 2, logLevel: 'DEBUG', db: 'ci-db.internal/catalog', dataCenters: 1 }, note: 'Hai instance để kiểm tra logic cân bằng tải, đặt chung một máy cho rẻ và nhanh. Cả chặng test nhanh và test chậm đều deploy vào đây.' },
      preprod: { name: 'Pre-production', inst: 2, machines: 2, dcs: 1, fb: 0.4, like: 0.75, cfg: { env: 'preprod', instances: 2, logLevel: 'INFO', db: 'preprod-db.internal/catalog', dataCenters: 1 }, note: 'Nơi kiểm tra thủ công (không bắt buộc). Topo ở đây là số liệu minh hoạ: gần production hơn nhưng chưa trải qua hai data center.' },
      prod: { name: 'Production', inst: 4, machines: 4, dcs: 2, fb: 0.15, like: 1, cfg: { env: 'production', instances: 4, logLevel: 'WARN', db: 'catalog-db.prod/catalog', dataCenters: 2 }, note: 'Bốn pod trên bốn máy, trải qua hai data center (Hình 7-9). Lỗi phát hiện ở đây là đắt nhất.' },
    };
    let cur = 'laptop';
    const sE = seg({ label: 'Môi trường', options: [{ value: 'laptop', label: '1 · Laptop' }, { value: 'ci', label: '2 · CI' }, { value: 'preprod', label: '3 · Pre-prod' }, { value: 'prod', label: '4 · Production' }], value: cur, onChange: (v) => { cur = v; render(); } });
    const vz = h('div', { class: 'viz' });
    const mFb = meter('Tốc độ phản hồi');
    const mLike = meter('Giống production');
    const art = h('p', {}, h('span', { class: 'pill violet' }, 'catalog:1.4.2'), ' ', h('span', { class: 'lab-note' }, 'cùng một artifact, build đúng một lần, dùng cho mọi môi trường'));
    const cfg = h('pre', { class: 'json' });
    const note = h('p', { class: 'lab-note' });
    root.append(ctl('Chặng trong pipeline của Catalog', sE.el), vz,
      h('div', { class: 'lab-split' },
        h('div', { class: 'box' }, h('h5', 'Artifact & đánh đổi'), art, mFb, mLike, note),
        h('div', { class: 'box' }, h('h5', 'Cấu hình môi trường (nằm ngoài artifact)'), cfg)));

    function render() {
      const e = ENVS[cur];
      const W = 640, H = 200;
      const svg = svgBox(W, H, 'Topo của Catalog trong môi trường ' + e.name);
      const dw = (W - 20 - 14 * (e.dcs - 1)) / e.dcs;
      const perDc = Math.ceil(e.machines / e.dcs);
      for (let d = 0; d < e.dcs; d++) {
        const dx = 10 + d * (dw + 14);
        svg.append(R(dx, 10, dw, 180, 'f-surface s-ink3 dash', 10), T(dx + 10, 28, e.dcs > 1 ? 'Data center ' + (d + 1) : e.name, 'lbl-strong'));
        const mw = Math.min(130, (dw - 20 - 10 * (perDc - 1)) / perDc);
        for (let k = 0; k < perDc; k++) {
          const m = d * perDc + k;
          if (m >= e.machines) break;
          const mx = dx + 10 + k * (mw + 10);
          svg.append(R(mx, 42, mw, 136, 'f-surface2 s-line', 8), T(mx + mw / 2, 58, cur === 'laptop' ? 'laptop' : 'máy ' + (m + 1), 't-sm', 'middle'));
          const mine = Array.from({ length: e.inst }, (_, i) => i).filter((i) => i % e.machines === m);
          mine.forEach((i, j) => {
            const iy = 68 + j * 52;
            svg.append(R(mx + 8, iy, mw - 16, 44, 'f-accent-soft s-accent'), T(mx + mw / 2, iy + 19, cur === 'prod' ? 'pod ' + (i + 1) : 'instance ' + (i + 1), 'lbl-strong', 'middle'), T(mx + mw / 2, iy + 34, 'catalog:1.4.2', 't-sm t-violet', 'middle'));
          });
        }
      }
      clear(vz).append(svg);
      mFb.update(e.fb, e.fb > 0.6 ? 'ok' : e.fb > 0.3 ? 'warn' : 'bad', pct(e.fb, 0));
      mLike.update(e.like, e.like > 0.6 ? 'ok' : e.like > 0.3 ? 'warn' : 'bad', pct(e.like, 0));
      note.textContent = e.note + ' (Thang đo phản hồi và độ giống production là minh hoạ.)';
      cfg.innerHTML = jsonHTML(e.cfg);
    }
    render();
  });

  // =====================================================================
  // 7.4 — Noisy neighbour: shared host vs isolated hosts
  // =====================================================================
  widget('ch7-noisy-neighbor', (root) => {
    let model = 'shared';
    const BASE = { Catalog: 50, Order: 40, Invoice: 30 };
    const CPU = { Order: 25, Invoice: 20 };
    const sM = seg({ label: 'Mô hình', options: [{ value: 'shared', label: 'Nhiều service / 1 host' }, { value: 'isolated', label: '1 service / 1 host' }], value: model, onChange: (v) => { model = v; render(); } });
    const sL = slider({ label: 'Nhu cầu CPU của Catalog', min: 10, max: 150, step: 5, value: 80, format: (v) => v + '% một host', onInput: render });
    const cb = checkbox('Order cần thư viện X v1, Invoice cần X v2', true, render);
    const vz = h('div', { class: 'viz' });
    const stHosts = stat('Host phải quản lý', '');
    const stOrder = stat('Độ trễ Order', '');
    const stInv = stat('Độ trễ Invoice', '');
    const stDep = stat('Phụ thuộc', '');
    root.append(h('div', { class: 'controls' }, ctl('Mô hình đặt service', sM.el), sL.el), cb.el, vz,
      h('div', { class: 'stats' }, stHosts, stOrder, stInv, stDep),
      h('p', { class: 'lab-note' }, 'Độ trễ cơ sở và mức CPU là số liệu minh hoạ. Khi tổng nhu cầu vượt 100% một host, mọi process trên host đó phải xếp hàng chờ CPU.'));

    function render() {
      const cat = sL.value;
      const demand = { Catalog: cat, Order: CPU.Order, Invoice: CPU.Invoice };
      const factor = (tot) => (tot <= 100 ? 1 : Math.pow(tot / 100, 3));
      const hosts = model === 'shared' ? [{ name: 'host-1', svcs: ['Catalog', 'Order', 'Invoice'] }] : ['Catalog', 'Order', 'Invoice'].map((n, i) => ({ name: 'host-' + (i + 1), svcs: [n] }));
      const lat = {};
      hosts.forEach((ho) => { ho.total = ho.svcs.reduce((a, n) => a + demand[n], 0); ho.svcs.forEach((n) => { lat[n] = BASE[n] * factor(ho.total); }); });
      const W = 640, H = 120 + hosts.length * 34 + 20;
      const svg = svgBox(W, H, 'Mức CPU của các host và độ trễ của từng service');
      const x0 = 110, xw = 480, sc = (v) => (Math.min(v, 200) / 200) * xw;
      svg.append(T(10, 16, 'CPU host (vạch đỏ = 100%)', 'lbl-strong'));
      hosts.forEach((ho, i) => {
        const y = 26 + i * 34;
        svg.append(T(x0 - 8, y + 17, ho.name, 't-sm', 'end'), R(x0, y, xw, 24, 'f-surface2 s-line', 4));
        let acc = 0;
        ho.svcs.forEach((n) => {
          const cls = n === 'Catalog' ? 'f-mark' : n === 'Order' ? 'f-accent' : 'f-violet';
          svg.append(R(x0 + sc(acc), y, sc(Math.min(acc + demand[n], 200)) - sc(acc), 24, cls, 0));
          if (sc(Math.min(acc + demand[n], 200)) - sc(acc) > 44) svg.append(T(x0 + sc(acc) + 6, y + 16, n, 't-on t-sm'));
          acc += demand[n];
        });
        svg.append(T(x0 + xw + 4, y + 16, fmt(ho.total) + '%', ho.total > 100 ? 't-bad' : 't-ok'));
      });
      svg.append(L(x0 + sc(100), 20, x0 + sc(100), 26 + hosts.length * 34, 's-bad sw2'));
      const ly = 40 + hosts.length * 34;
      svg.append(T(10, ly, 'Độ trễ trung bình (ms, thang log)', 'lbl-strong'));
      const lx = (ms) => (Math.log10(Math.max(ms, 10)) - 1) / 2 * xw;
      ['Catalog', 'Order', 'Invoice'].forEach((n, i) => {
        const y = ly + 10 + i * 24;
        const bad = lat[n] > BASE[n] * 1.5;
        svg.append(T(x0 - 8, y + 13, n, 't-sm', 'end'), R(x0, y, Math.max(2, lx(lat[n])), 16, bad ? 'f-bad' : 'f-ok', 3), T(x0 + Math.max(2, lx(lat[n])) + 6, y + 13, fmt(lat[n]) + ' ms', bad ? 't-bad' : 't-ok'));
      });
      clear(vz).append(svg);
      stHosts.update(String(hosts.length), 'accent', model === 'shared' ? 'ít việc cho đội hạ tầng' : 'mỗi đội tự cấu hình host của mình');
      const tone = (n) => (lat[n] > BASE[n] * 1.5 ? 'bad' : 'ok');
      stOrder.update(fmt(lat.Order) + ' ms', tone('Order'), 'cơ sở ' + BASE.Order + ' ms');
      stInv.update(fmt(lat.Invoice) + ' ms', tone('Invoice'), 'cơ sở ' + BASE.Invoice + ' ms');
      if (!cb.value) stDep.update('Không xung đột', 'ok', '');
      else if (model === 'shared') stDep.update('Xung đột', 'bad', 'không cài được cả X v1 lẫn v2 trên cùng host');
      else stDep.update('Ổn', 'ok', 'mỗi host tự cài phiên bản riêng');
    }
    render();
  });

  // =====================================================================
  // 7.5 — Infrastructure as code: drift, plan/apply, recreate
  // =====================================================================
  widget('ch7-iac-drift', (root) => {
    const HISTORY = [
      { id: 'a1c3', date: '03/2018', msg: 'Khởi tạo hạ tầng Order', spec: { count: 2, type: 't2.medium', ami: 'ubuntu-2018-02-patched', ports: [443] } },
      { id: '7be2', date: '06/2019', msg: 'Tăng lên 3 máy', spec: { count: 3, type: 't3.medium', ami: 'ubuntu-2019-05-patched', ports: [443] } },
      { id: 'e9f0', date: '11/2019', msg: 'Vá bảo mật hệ điều hành', spec: { count: 3, type: 't3.medium', ami: 'ubuntu-2019-11-patched', ports: [443] } },
    ];
    const head = HISTORY[HISTORY.length - 1];
    const copy = (o) => JSON.parse(JSON.stringify(o));
    let live = copy(head.spec);
    let driftIdx = 0;
    const MANUAL = [
      { msg: 'Ai đó nâng cỡ máy lên m5.large trên console để chữa cháy', f: (st) => { st.type = 'm5.large'; } },
      { msg: 'Ai đó mở cổng 22 (SSH) để debug rồi quên đóng', f: (st) => { if (!st.ports.includes(22)) st.ports.push(22); } },
      { msg: 'Ai đó thêm 1 máy bằng tay lúc tải cao', f: (st) => { st.count += 1; } },
    ];
    const code = h('pre', { class: 'iac' });
    const liveEl = h('pre', { class: 'iac' });
    const lg = log();
    const stDrift = stat('Sai lệch so với mã', '');
    const stHist = stat('Thay đổi có lịch sử?', '');
    const bManual = button('Sửa tay trên console', () => { const m = MANUAL[driftIdx % MANUAL.length]; driftIdx++; m.f(live); lg.add('[console] ' + m.msg, 'warn'); render(); }, 'ghost');
    const bPlan = button('Chạy plan', () => {
      const d = diff();
      lg.add('$ terraform plan', 't');
      if (!d.length) lg.add('Không có thay đổi. Hạ tầng khớp với mã.', 'ok');
      d.forEach((x) => lg.add('  ' + x, 'acc'));
    }, 'ghost');
    const bApply = button('Apply theo mã', () => {
      const d = diff();
      lg.add('$ terraform apply', 't');
      if (!d.length) { lg.add('Không có gì để áp dụng.', 'ok'); return; }
      live = copy(head.spec);
      lg.add(`Áp dụng ${d.length} thay đổi. Hạ tầng đã về đúng commit ${head.id}.`, 'ok');
      render();
    });

    function hcl(st, ref) {
      const mark = (k, line) => (ref && JSON.stringify(ref[k]) !== JSON.stringify(st[k]) ? `<span class="chg">${line}</span>` : line);
      return [
        '<span class="dim"># infra/order.tf</span>',
        'resource "aws_instance" "order" {',
        mark('count', `  count         = ${st.count}`),
        mark('type', `  instance_type = "${esc(st.type)}"`),
        mark('ami', `  ami           = "${esc(st.ami)}"`),
        '}',
        'resource "aws_security_group" "order" {',
        mark('ports', `  ingress_ports = [${st.ports.join(', ')}]`),
        '}',
      ].join('\n');
    }
    function diff() {
      const out = [], sp = head.spec;
      if (live.count !== sp.count) out.push(`~ count: ${live.count} → ${sp.count}`);
      if (live.type !== sp.type) out.push(`~ instance_type: "${live.type}" → "${sp.type}"`);
      if (live.ami !== sp.ami) out.push(`~ ami: "${live.ami}" → "${sp.ami}"`);
      live.ports.filter((p) => !sp.ports.includes(p)).forEach((p) => out.push(`- ingress port ${p}`));
      return out;
    }

    // Recreate past environment
    let pick = '7be2';
    const sC = seg({ label: 'Commit', options: HISTORY.map((c) => ({ value: c.id, label: `${c.id} · ${c.date}` })), value: pick, onChange: (v) => { pick = v; recreate(); } });
    const cbIac = checkbox('Cấu hình hạ tầng nằm trong git', true, recreate);
    const vd = verdict();
    const past = h('pre', { class: 'iac' });
    function recreate() {
      const c = HISTORY.find((x) => x.id === pick);
      if (cbIac.value) {
        past.innerHTML = `<span class="dim">$ git checkout ${c.id} &amp;&amp; terraform apply</span>\n` + hcl(c.spec);
        vd.update('ok', `Dựng lại được trạng thái ${c.date} trong vài phút (minh hoạ).`, `Commit ${c.id} “${c.msg}” mô tả chính xác số máy, cỡ máy, bản vá hệ điều hành và cổng mở tại thời điểm đó.`);
      } else {
        past.innerHTML = '<span class="dim"># không có mã hạ tầng cho thời điểm này\n# chỉ còn email, release note và trí nhớ của mọi người</span>';
        vd.update('bad', 'Hơn ba tháng lục lọi, vẫn không chắc đúng.', 'Đúng như câu chuyện vụ kiện trong sách: khách hàng phải dựng lại môi trường từ email và release note, tới từng bản vá hệ điều hành và nội dung message broker.');
      }
    }

    root.append(
      h('div', { class: 'lab-split' },
        h('div', { class: 'box' }, h('h5', `Mã trong git (commit ${head.id})`), code),
        h('div', { class: 'box' }, h('h5', 'Hạ tầng đang chạy'), liveEl)),
      h('div', { class: 'btn-row' }, bManual, bPlan, bApply),
      h('div', { class: 'stats' }, stDrift, stHist), lg,
      h('div', { class: 'box' }, h('h5', 'Dựng lại môi trường của quá khứ'), h('div', { class: 'controls' }, ctl('Chọn commit', sC.el)), cbIac.el, past, vd));

    function render() {
      code.innerHTML = hcl(head.spec);
      liveEl.innerHTML = hcl(live, head.spec);
      const d = diff().length;
      stDrift.update(String(d), d ? 'warn' : 'ok', d ? 'chạy plan để xem chi tiết' : 'khớp hoàn toàn');
      stHist.update(d ? 'Không' : 'Có', d ? 'bad' : 'ok', d ? 'sửa tay không để lại commit' : 'mọi thay đổi đi qua git');
    }
    lg.add('Hạ tầng đang khớp với commit ' + head.id + '.', 'ok');
    render();
    recreate();
  });

  // =====================================================================
  // 7.6 — Rollout strategies
  // =====================================================================
  widget('ch7-rollout', (root) => {
    const DEMAND = 20, PER = 8;
    let strat = 'rolling', busy = false;
    const sS = seg({ label: 'Chiến lược', options: [{ value: 'bigbang', label: 'Tắt hết rồi bật v2' }, { value: 'rolling', label: 'Rolling upgrade' }, { value: 'bluegreen', label: 'Blue-green' }], value: strat, onChange: (v) => { if (busy) { sS.set(strat); return; } strat = v; draw(plan(strat), Infinity); } });
    const cbAsync = checkbox('Consumer giao tiếp bất đồng bộ qua message broker', false, () => { if (!busy) draw(plan(strat), Infinity); });
    const bRun = button('Triển khai v2', run);
    const vz = h('div', { class: 'viz' });
    const stFail = stat('Request lỗi', '');
    const stMin = stat('Instance phục vụ tối thiểu', '');
    const stPeak = stat('Instance chạy cùng lúc (đỉnh)', '');
    const stTime = stat('Thời gian hoàn tất', '');
    const note = h('p', { class: 'lab-note' });
    root.append(h('div', { class: 'controls' }, ctl('Chiến lược triển khai', sS.el)), cbAsync.el, h('div', { class: 'btn-row' }, bRun), vz,
      h('div', { class: 'stats' }, stFail, stMin, stPeak, stTime), note,
      h('p', { class: 'lab-note' }, `Mỗi bước = 10 giây; tải ${DEMAND} request/bước; mỗi instance xử lý ${PER} request/bước; instance mới cần 3 bước để khởi động (số liệu minh hoạ).`));

    function plan(st) {
      const out = [];
      const push = (v1, v2, idle1, idle2, starting, msg) => out.push({ v1, v2, idle1, idle2, starting, msg });
      if (st === 'bigbang') {
        push(4, 0, 0, 0, 0, 'v1 đang phục vụ');
        for (let k = 0; k < 3; k++) push(0, 0, 0, 0, 4, 'đã tắt v1, v2 đang khởi động');
        push(0, 4, 0, 0, 0, 'v2 phục vụ');
      } else if (st === 'rolling') {
        push(4, 0, 0, 0, 0, 'v1 đang phục vụ');
        for (let k = 0; k < 4; k++) for (let j = 0; j < 3; j++) push(4 - k, k, 0, 0, 1, `khởi động v2 #${k + 1}; xong thì tắt một v1`);
        push(0, 4, 0, 0, 0, 'hoàn tất');
      } else {
        push(4, 0, 0, 0, 0, 'blue (v1) đang phục vụ');
        for (let k = 0; k < 3; k++) push(4, 0, 0, 0, 4, 'dựng green (v2) song song');
        push(4, 0, 0, 4, 0, 'kiểm tra green, chưa nhận traffic');
        push(0, 4, 4, 0, 0, 'chuyển traffic sang green; giữ blue để rollback');
        push(0, 4, 0, 0, 0, 'tắt blue');
      }
      return out;
    }
    function draw(steps, upto) {
      const W = 640, H = 230, x0 = 40, top = 14, bot = 170, maxI = 8, NSTEP = 15;
      const bw = (W - x0 - 10) / NSTEP;
      const y = (v) => bot - (v / maxI) * (bot - top);
      const svg = svgBox(W, H, 'Số instance theo thời gian khi triển khai v2');
      for (let v = 0; v <= maxI; v += 2) svg.append(L(x0, y(v), W - 10, y(v), 'grid'), T(x0 - 6, y(v) + 4, v, 't-sm', 'end'));
      svg.append(L(x0, y(4), W - 10, y(4), 's-ink3 dash'), T(W - 12, y(4) - 4, 'cần 3 instance để đủ tải', 't-sm', 'end'));
      let failed = 0, minServe = Infinity, peak = 0;
      const asyncOn = cbAsync.value;
      steps.forEach((st, i) => {
        if (i > upto) return;
        const x = x0 + i * bw + 2, w = bw - 4;
        let acc = 0;
        const seg2 = (v, cls) => { if (!v) return; svg.append(R(x, y(acc + v), w, y(acc) - y(acc + v), cls, 2)); acc += v; };
        seg2(st.v1, 'f-violet'); seg2(st.v2, 'f-accent'); seg2(st.idle1, 'f-violet-soft s-violet'); seg2(st.idle2, 'f-accent-soft s-accent'); seg2(st.starting, 'f-surface2 s-ink3 dash');
        const serve = st.v1 + st.v2;
        const f = Math.max(0, DEMAND - serve * PER);
        if (f) svg.append(T(x + w / 2, y(acc) - 6, asyncOn ? 'xếp hàng' : '✕ ' + f, asyncOn ? 't-sm t-warn' : 't-sm t-bad', 'middle'));
        failed += f; minServe = Math.min(minServe, serve); peak = Math.max(peak, st.v1 + st.v2 + st.idle1 + st.idle2 + st.starting);
        svg.append(T(x + w / 2, bot + 14, i, 't-sm', 'middle'));
      });
      svg.append(T(x0, bot + 32, 'bước (10 s)', 't-sm'));
      const lg = [['f-violet', 'v1 phục vụ'], ['f-accent', 'v2 phục vụ'], ['f-accent-soft s-accent', 'đứng chờ'], ['f-surface2 s-ink3 dash', 'đang khởi động']];
      lg.forEach(([c, t], i) => { const lx = 150 + i * 120; svg.append(R(lx, H - 20, 12, 12, c, 2), T(lx + 18, H - 10, t, 't-sm')); });
      clear(vz).append(svg);
      const done = upto >= steps.length - 1;
      const last = steps[Math.min(upto, steps.length - 1)];
      note.textContent = 'Bước hiện tại: ' + last.msg + '.';
      if (asyncOn) stFail.update(failed ? fmt(failed) + ' xếp hàng' : '0', failed ? 'warn' : 'ok', failed ? 'message được xử lý khi service chạy lại' : '');
      else stFail.update(fmt(failed), failed ? 'bad' : 'ok', failed ? 'consumer thấy lỗi' : 'không ai nhận ra');
      stMin.update(String(minServe === Infinity ? 0 : minServe), minServe === 0 ? 'bad' : minServe < 3 ? 'warn' : 'ok');
      stPeak.update(String(peak), peak >= 8 ? 'warn' : 'accent', peak >= 8 ? 'chi phí gấp đôi trong lúc chuyển' : '');
      stTime.update(done ? fmt(steps.length * 10) + ' s' : '…', 'accent');
    }
    async function run() {
      if (busy) return;
      busy = true; bRun.disabled = true;
      const steps = plan(strat);
      for (let i = 0; i < steps.length; i++) { draw(steps, i); await sleep(260); }
      busy = false; bRun.disabled = false;
    }
    draw(plan(strat), Infinity);
  });

  // =====================================================================
  // 7.7 — Desired state reconcile loop + EC2 whack-a-mole
  // =====================================================================
  widget('ch7-reconcile', (root) => {
    const r = rng(7);
    let mode = 'heal';
    const sMode = seg({ label: 'Kịch bản', options: [{ value: 'heal', label: 'Tự phục hồi' }, { value: 'mole', label: 'Tắt cluster cuối ngày' }], value: mode, onChange: (v) => { mode = v; paneA.hidden = v !== 'heal'; paneB.hidden = v !== 'mole'; } });

    // ---- Pane A: reconcile ----
    let desired = 4, now = 0, seq = 0, gap = 0, looping = false;
    let pods = [];
    const LAUNCH = { fast: 10, mid: 60, slow: 180 };
    let launch = 'mid';
    const spawn = (ready) => ({ id: ++seq, state: ready ? 'run' : 'start', readyAt: now + LAUNCH[launch] });
    for (let i = 0; i < desired; i++) pods.push(spawn(true));
    const sD = slider({ label: 'Desired: số instance', min: 1, max: 8, value: desired, onInput: (v) => { desired = v; lgA.add(`[spec] desired = ${v}`, 'acc'); loop(); } });
    const sLaunch = seg({ label: 'Thời gian khởi động', options: [{ value: 'fast', label: '10 s' }, { value: 'mid', label: '60 s' }, { value: 'slow', label: '180 s' }], value: launch, onChange: (v) => { launch = v; } });
    const bKill = button('Giết instance ngẫu nhiên', () => {
      const alive = pods.filter((p) => p.state !== 'dead');
      if (!alive.length) return;
      const p = alive[Math.floor(r() * alive.length)];
      p.state = 'dead';
      lgA.add(`[t=${now}s] instance #${p.id} chết`, 'bad');
      loop();
    }, 'danger');
    const bGit = button('Commit vào git: replicas +2 (GitOps)', async () => {
      bGit.disabled = true;
      const next = Math.min(8, desired + 2);
      lgA.add(`[git] commit “order: replicas ${desired} → ${next}”`, 't');
      await sleep(500);
      desired = next; sD.set(next);
      lgA.add(`[flux] phát hiện thay đổi trong repo, áp desired = ${next}`, 'acc');
      bGit.disabled = false;
      loop();
    }, 'ghost');
    const vzA = h('div', { class: 'viz' });
    const stDes = stat('Desired', '');
    const stAct = stat('Actual (đang phục vụ)', '');
    const stGap = stat('Thời gian thiếu instance', '');
    const lgA = log();
    const paneA = h('div', {}, h('div', { class: 'controls' }, sD.el, ctl('Thời gian khởi động instance', sLaunch.el)), h('div', { class: 'btn-row' }, bKill, bGit), vzA, h('div', { class: 'stats' }, stDes, stAct, stGap), lgA);

    function drawA() {
      const W = 640, H = 120;
      const svg = svgBox(W, H, 'Trạng thái các instance so với trạng thái mong muốn');
      svg.append(T(10, 18, `Desired = ${desired}`, 'lbl-strong'), T(W - 10, 18, `t = ${now} s`, 't-sm', 'end'));
      const shown = pods.slice(-10);
      shown.forEach((p, i) => {
        const x = 20 + i * 62, y = 34;
        const cls = p.state === 'run' ? 'f-ok-soft s-ok' : p.state === 'start' ? 'f-warn-soft s-warn dash' : 'f-bad-soft s-bad';
        svg.append(R(x, y, 54, 54, cls, 8), T(x + 27, y + 24, '#' + p.id, p.state === 'dead' ? 't-bad' : 'lbl-strong', 'middle'),
          T(x + 27, y + 42, p.state === 'run' ? 'chạy' : p.state === 'start' ? 'khởi động' : 'chết', 't-sm', 'middle'));
      });
      svg.append(T(10, H - 8, 'xanh = đang chạy · vàng = đang khởi động · đỏ = vừa chết', 't-sm t-mute'));
      clear(vzA).append(svg);
      const run = pods.filter((p) => p.state === 'run').length;
      stDes.update(String(desired), 'accent');
      stAct.update(String(run), run === desired ? 'ok' : run < desired ? 'warn' : 'accent');
      stGap.update(gap + ' s', gap === 0 ? 'ok' : gap > 120 ? 'bad' : 'warn', 'cộng dồn từ lúc mở trang');
    }
    async function loop() {
      drawA();
      if (looping) return;
      looping = true;
      while (true) {
        const run = pods.filter((p) => p.state === 'run').length;
        const live = pods.filter((p) => p.state !== 'dead');
        if (run === desired && live.length === desired) break;
        pods = pods.filter((p) => p.state !== 'dead');
        // reconcile
        const liveNow = pods.length;
        if (liveNow < desired) for (let i = liveNow; i < desired; i++) { const p = spawn(false); pods.push(p); lgA.add(`[t=${now}s] nền tảng: actual ${liveNow} < desired ${desired}, khởi động #${p.id}`, 'warn'); }
        if (liveNow > desired) {
          const extra = liveNow - desired;
          const victims = [...pods].sort((a, b) => (a.state === 'start' ? -1 : 1) - (b.state === 'start' ? -1 : 1) || b.id - a.id).slice(0, extra);
          victims.forEach((v) => { lgA.add(`[t=${now}s] nền tảng: thừa instance, dừng #${v.id}`, 't'); });
          pods = pods.filter((p) => !victims.includes(p));
        }
        await sleep(240);
        const step = 10;
        now += step;
        if (pods.filter((p) => p.state === 'run').length < desired) gap += step;
        pods.forEach((p) => { if (p.state === 'start' && now >= p.readyAt) { p.state = 'run'; lgA.add(`[t=${now}s] #${p.id} sẵn sàng`, 'ok'); } });
        drawA();
      }
      looping = false;
      drawA();
    }

    // ---- Pane B: whack-a-mole ----
    const MIN = 3;
    let ec2 = [], kills = 0, billed = 0, minutes = 0, busyB = false, eid = 0;
    const resetB = () => { eid = 0; ec2 = Array.from({ length: MIN }, () => ({ id: 'i-0' + (++eid) })); kills = 0; billed = MIN; minutes = 0; lgB.reset(); lgB.add('17:45 · 3 máy EC2 của cluster dev đang chạy. Autoscaling group: min = 3.', 't'); drawB(); };
    const cbAsg = checkbox('Vô hiệu hoá autoscaling group trước khi tắt', false, () => drawB());
    const bShut = button('Tắt 1 máy EC2 bằng tay', async () => {
      if (busyB || !ec2.length) return;
      busyB = true; bShut.disabled = true;
      const v = ec2.shift(); kills++; minutes += 1.5;
      lgB.add(`Tắt ${v.id}.`, 'bad');
      drawB();
      await sleep(400);
      if (!cbAsg.value) {
        const nw = { id: 'i-0' + (++eid) };
        ec2.push(nw); billed++;
        lgB.add(`ASG: số máy (${ec2.length - 1}) < min ${MIN}, bật ${nw.id}. Bị tính tiền trọn 1 giờ.`, 'warn');
      }
      busyB = false; bShut.disabled = false;
      drawB();
    }, 'danger');
    const bResetB = button('Đặt lại', () => resetB(), 'ghost');
    const vzB = h('div', { class: 'viz' });
    const stRun = stat('Máy đang chạy', '');
    const stKill = stat('Số lần tắt', '');
    const stBill = stat('Giờ-máy bị tính', '');
    const stMin = stat('Thời gian loay hoay', '');
    const lgB = log();
    const paneB = h('div', { hidden: true }, cbAsg.el, h('div', { class: 'btn-row' }, bShut, bResetB), vzB, h('div', { class: 'stats' }, stRun, stKill, stBill, stMin), lgB,
      h('p', { class: 'lab-note' }, 'EC2 thời đó tính tiền theo giờ: máy chạy một phút cũng bị tính trọn giờ. Mỗi lần tắt mất khoảng 1,5 phút (minh hoạ); trong sách tác giả loay hoay 15 phút.'));
    function drawB() {
      const W = 640, H = 90;
      const svg = svgBox(W, H, 'Các máy EC2 trong autoscaling group');
      svg.append(R(8, 8, W - 16, 74, (cbAsg.value ? 'f-surface2 s-line' : 'f-accent-soft s-accent') + ' dash', 10), T(18, 26, cbAsg.value ? 'Autoscaling group: đã vô hiệu hoá' : `Autoscaling group: min = ${MIN}`, 'lbl-strong'));
      ec2.forEach((m, i) => { const x = 20 + i * 96; svg.append(R(x, 36, 86, 36, 'f-ok-soft s-ok'), T(x + 43, 59, m.id, 'lbl-strong', 'middle')); });
      if (!ec2.length) svg.append(T(W / 2, 60, 'Cluster đã tắt hẳn', 't-ok', 'middle'));
      clear(vzB).append(svg);
      stRun.update(String(ec2.length), ec2.length ? 'warn' : 'ok');
      stKill.update(String(kills), 'accent');
      stBill.update(String(billed), billed > MIN ? 'bad' : 'ok', billed > MIN ? `thừa ${billed - MIN} giờ-máy` : '');
      stMin.update(fmt(minutes, 1) + ' phút', minutes >= 10 ? 'bad' : minutes ? 'warn' : 'ok');
      if (kills >= 6 && !cbAsg.value && !lgB.dataset.hint) { lgB.dataset.hint = '1'; lgB.add('Gợi ý: máy vẫn bật lại vì desired state đang làm đúng việc của nó. Thử tích “vô hiệu hoá autoscaling group”.', 'acc'); }
    }

    root.append(ctl('Kịch bản', sMode.el), paneA, paneB);
    lgA.add(`[t=0s] 4 instance đang chạy, khớp desired = 4.`, 'ok');
    drawA();
    resetB();
  });

  /* 8. ch7-hypervisor */
  widget('ch7-hypervisor', (root) => {
    const hypType = seg({
      label: 'Loại Hypervisor',
      value: 'type1',
      options: [
        { label: 'Type 1: Bare Metal (ESXi, KVM)', value: 'type1' },
        { label: 'Type 2: Hosted (VirtualBox)', value: 'type2' }
      ]
    });
    const sOverhead = stat('Overhead tầng ảo hoá', '2 - 4%', 'ok');
    const sPerf = stat('Hiệu năng I/O', 'Gần Native', 'ok');
    const svgHost = h('div');
    root.appendChild(
      h('div', { class: 'widget' },
        h('div', { class: 'controls' }, hypType.el),
        h('div', { class: 'stats' }, sOverhead, sPerf),
        svgHost
      )
    );
    function draw() {
      const is1 = hypType.value === 'type1';
      sOverhead.update(is1 ? '2 - 4% (Rất thấp)' : '15 - 25% (Cao)', is1 ? 'ok' : 'warn');
      sPerf.update(is1 ? 'Gần Native Metal' : 'Chậm hơn do qua Host OS', is1 ? 'ok' : 'warn');
      const W = 640, H = 160, svg = svgBox(W, H);
      R(10, 10, W - 20, 30, 'f-accent-soft s-accent', 4);
      T(W / 2, 30, 'Phần cứng Vật lý (CPU, RAM, NIC, SAN Disk)', 'lbl-strong', 'middle');
      if (is1) {
        R(10, 50, W - 20, 35, 'f-ok-soft s-ok', 4);
        T(W / 2, 72, 'Type 1 Hypervisor (ESXi / KVM trực tiếp trên Hardware)', 'lbl-strong', 'middle');
        R(30, 95, 170, 55, 'f-surface2 s-ink3', 4);
        T(115, 125, 'Guest VM 1 (App + OS)', 't-sm', 'middle');
        R(235, 95, 170, 55, 'f-surface2 s-ink3', 4);
        T(320, 125, 'Guest VM 2 (App + OS)', 't-sm', 'middle');
        R(440, 95, 170, 55, 'f-surface2 s-ink3', 4);
        T(525, 125, 'Guest VM 3 (App + OS)', 't-sm', 'middle');
      } else {
        R(10, 45, W - 20, 25, 'f-surface2 s-ink3', 4);
        T(W / 2, 62, 'Host Operating System (macOS / Windows / Linux)', 't-sm', 'middle');
        R(10, 75, W - 20, 25, 'f-warn-soft s-warn', 4);
        T(W / 2, 92, 'Type 2 Hypervisor Software (VirtualBox, Parallels)', 'lbl-strong', 'middle');
        R(40, 105, 260, 45, 'f-surface2 s-ink3', 4);
        T(170, 130, 'Guest VM 1', 't-sm', 'middle');
        R(340, 105, 260, 45, 'f-surface2 s-ink3', 4);
        T(470, 130, 'Guest VM 2', 't-sm', 'middle');
      }
      clear(svgHost).appendChild(svg);
    }
    hypType.onChange = draw;
    draw();
  });

  /* 9. ch7-container-vs-vm */
  widget('ch7-container-vs-vm', (root) => {
    const mode = seg({
      label: 'Mô hình Đóng gói',
      value: 'container',
      options: [
        { label: 'Linux Container (Docker)', value: 'container' },
        { label: 'Virtual Machine (VM)', value: 'vm' }
      ]
    });
    const sBoot = stat('Thời gian khởi động', '250 ms', 'ok');
    const sRam = stat('RAM Overhead tĩnh', '~15 MB', 'ok');
    const sDensity = stat('Mật độ đóng gói', '50+ Pods / Node', 'ok');
    const svgHost = h('div');
    root.appendChild(
      h('div', { class: 'widget' },
        h('div', { class: 'controls' }, mode.el),
        h('div', { class: 'stats' }, sBoot, sRam, sDensity),
        svgHost
      )
    );
    function draw() {
      const isC = mode.value === 'container';
      sBoot.update(isC ? '150 - 500 ms' : '20 - 60 giây', isC ? 'ok' : 'warn', isC ? 'Khởi tạo process' : 'Boot Guest Kernel');
      sRam.update(isC ? '10 - 30 MB' : '1.5 - 4 GB', isC ? 'ok' : 'warn', isC ? 'Dùng chung Host Kernel' : 'Bộ nhớ dành riêng cho Guest OS');
      sDensity.update(isC ? 'Rất cao (50-100 / host)' : 'Trung bình (5-15 / host)', isC ? 'ok' : 'warn');
      const W = 640, H = 140, svg = svgBox(W, H);
      R(20, 20, 280, 100, isC ? 'f-ok-soft s-ok' : 'f-surface2 s-line', 6);
      T(160, 50, 'Container: Chung Kernel', isC ? 'lbl-strong' : 't-mute', 'middle');
      T(160, 75, 'Tách bằng cgroups + namespaces', 't-sm', 'middle');
      T(160, 100, 'Khởi động như một process bình thường', 't-sm', 'middle');

      R(340, 20, 280, 100, !isC ? 'f-accent-soft s-accent' : 'f-surface2 s-line', 6);
      T(480, 50, 'VM: Kernel riêng biệt', !isC ? 'lbl-strong' : 't-mute', 'middle');
      T(480, 75, 'Cô lập phần cứng cấp Hypervisor', 't-sm', 'middle');
      T(480, 100, 'An toàn cao nhất cho đa khách hàng (Multi-tenant)', 't-sm', 'middle');
      clear(svgHost).appendChild(svg);
    }
    mode.onChange = draw;
    draw();
  });

  /* 10. ch7-shared-runtime */
  widget('ch7-shared-runtime', (root) => {
    const actionBtn = button('Gây lỗi OutOfMemory ở Service A', run, 'danger');
    const sStatus = stat('Trạng thái Service B (Chạy cùng JVM)', 'Bình thường', 'ok');
    const logBox = log(5);
    root.appendChild(
      h('div', { class: 'widget' },
        h('div', { class: 'controls' }, h('div', { class: 'btn-row' }, actionBtn)),
        h('div', { class: 'stats' }, sStatus),
        logBox
      )
    );
    async function run() {
      actionBtn.disabled = true;
      logBox.add('Service A tiêu tốn toàn bộ Java Heap (Memory Leak)...', 'warn');
      await sleep(300);
      sStatus.update('BỊ CHẾT OOM THEO!', 'bad', 'Do chung 1 process JVM Tomcat');
      logBox.add('✕ CRITICAL: Java Virtual Machine crash vì java.lang.OutOfMemoryError!', 'bad');
      logBox.add('→ Service B không hề có lỗi code nhưng bị sập toàn diện vì chung runtime.', 'bad');
      actionBtn.disabled = false;
    }
  });

  /* 11. ch7-faas-burst */
  widget('ch7-faas-burst', (root) => {
    const burstBtn = button('Bơm 5,000 requests đột biến', run, 'accent');
    const sLatency = stat('P99 Latency', '15 ms', 'ok');
    const sInstances = stat('Số Functions đang chạy', '0 instance (Scale-to-Zero)', 'ok');
    const logBox = log(5);
    root.appendChild(
      h('div', { class: 'widget' },
        h('div', { class: 'controls' }, h('div', { class: 'btn-row' }, burstBtn)),
        h('div', { class: 'stats' }, sLatency, sInstances),
        logBox
      )
    );
    async function run() {
      burstBtn.disabled = true;
      sInstances.update('Đang Cold-Start 20 containers...', 'warn');
      sLatency.update('1,850 ms (Cold Start Spike)', 'bad');
      logBox.add('Lưu lượng tăng vọt: FaaS hạ tầng cấp phát 20 microVM mới.', 'warn');
      logBox.add('⚠ Cold start: Tải code + khởi tạo JVM/Node runtime mất 1.8s', 'bad');
      await sleep(500);
      sInstances.update('20 Warm instances', 'ok');
      sLatency.update('22 ms (Warm execution)', 'ok');
      logBox.add('✓ Đã warm: Các request tiếp theo xử lý với độ trễ 22ms.', 'ok');
      burstBtn.disabled = false;
    }
  });

  /* 12. ch7-faas-mapping */
  widget('ch7-faas-mapping', (root) => {
    const style = seg({
      label: 'Chiến lược ánh xạ Function',
      value: 'one_to_one',
      options: [
        { label: '1 Service = 1 Fat Function (Monolithic)', value: 'fat' },
        { label: '1 Service = 1 Microservice Container', value: 'one_to_one' },
        { label: '1 Endpoint = 1 Nano Function', value: 'nano' }
      ]
    });
    const sMgt = stat('Độ phức tạp quản lý', 'Tối ưu', 'ok');
    const sCold = stat('Rủi ro Cold Start', 'Thấp', 'ok');
    root.appendChild(
      h('div', { class: 'widget' },
        h('div', { class: 'controls' }, style.el),
        h('div', { class: 'stats' }, sMgt, sCold)
      )
    );
    function update() {
      const v = style.value;
      if (v === 'nano') {
        sMgt.update('Rất cao (Hàng trăm functions)', 'bad', 'Khó quản lý CI/CD & tracing');
        sCold.update('Cao (Nhiều function ít gọi bị lạnh)', 'warn');
      } else if (v === 'fat') {
        sMgt.update('Thấp', 'ok', 'Đóng gói cả service vào 1 handler');
        sCold.update('Cao (Package size lớn)', 'warn');
      } else {
        sMgt.update('Cân bằng & Chuẩn công nghiệp', 'ok', 'Ranh giới Bounded Context rõ ràng');
        sCold.update('Rất thấp (Có thể giữ warm)', 'ok');
      }
    }
    style.onChange = update;
    update();
  });

  /* 13. ch7-rules-of-thumb */
  widget('ch7-rules-of-thumb', (root) => {
    const stage = seg({
      label: 'Quy mô & Đội ngũ',
      value: 'early',
      options: [
        { label: 'Startup nhỏ / Ít kỹ sư DevOps', value: 'early' },
        { label: 'Doanh nghiệp vừa (5-15 services)', value: 'mid' },
        { label: 'Hệ thống lớn (50+ services, Platform team)', value: 'large' }
      ]
    });
    const sChoice = stat('Khuyến nghị kiến trúc', 'PaaS / Managed Containers', 'ok');
    root.appendChild(
      h('div', { class: 'widget' },
        h('div', { class: 'controls' }, stage.el),
        h('div', { class: 'stats' }, sChoice)
      )
    );
    function update() {
      const v = stage.value;
      if (v === 'early') {
        sChoice.update('PaaS / Serverless (Render, Fly.io, Cloud Run)', 'ok', 'Không tốn thời gian vận hành K8s');
      } else if (v === 'mid') {
        sChoice.update('Managed Kubernetes (EKS / GKE)', 'accent', 'Sử dụng cấu hình chuẩn, hạn chế tự quản lý etcd');
      } else {
        sChoice.update('Kubernetes Multi-Cluster + GitOps', 'ok', 'Cần Dedicated Platform Team để quản trị');
      }
    }
    stage.onChange = update;
    update();
  });

  /* 14. ch7-k8s-cluster */
  widget('ch7-k8s-cluster', (root) => {
    const killBtn = button('Đánh sập Worker Node 1', run, 'danger');
    const sPods = stat('Số Pods Order sống', '4/4 Pods', 'ok');
    const logBox = log(5);
    root.appendChild(
      h('div', { class: 'widget' },
        h('div', { class: 'controls' }, h('div', { class: 'btn-row' }, killBtn)),
        h('div', { class: 'stats' }, sPods),
        logBox
      )
    );
    async function run() {
      killBtn.disabled = true;
      sPods.update('2/4 Pods (Node 1 chết)', 'warn');
      logBox.add('Worker Node 1 mất kết nối mạng (Kubelet NotReady)...', 'bad');
      await sleep(350);
      logBox.add('Control Plane: Phát hiện thiếu 2 replicas so với Deployment spec.', 'warn');
      await sleep(350);
      logBox.add('Scheduler: Lập lịch tạo 2 Pods mới trên Worker Node 2 & 3.', 'ok');
      sPods.update('4/4 Pods (Đã tự phục hồi)', 'ok');
      killBtn.disabled = false;
    }
  });

  /* 15. ch7-progressive */
  widget('ch7-progressive', (root) => {
    const slTraffic = slider({ label: 'Tỷ lệ lưu lượng tới phiên bản mới V2 (%)', min: 0, max: 100, step: 10, value: 10 });
    const sV1 = stat('Traffic V1 (Ổn định)', '90%', 'ok');
    const sV2 = stat('Traffic V2 (Canary)', '10%', 'accent');
    const sHealth = stat('Tỷ lệ lỗi V2', '0.01%', 'ok');
    root.appendChild(
      h('div', { class: 'widget' },
        h('div', { class: 'controls' }, slTraffic.el),
        h('div', { class: 'stats' }, sV1, sV2, sHealth)
      )
    );
    function update() {
      const v2 = slTraffic.value;
      const v1 = 100 - v2;
      sV1.update(`${v1}%`, 'ok');
      sV2.update(`${v2}%`, v2 > 50 ? 'ok' : 'accent');
      if (v2 >= 80) sHealth.update('0.02% (An toàn để Release 100%)', 'ok');
      else sHealth.update('0.01% (Đang giám sát)', 'ok');
    }
    slTraffic.onInput = update;
    update();
  });

  /* Glossary */
  glossary.add([
    { key: 'independent-deployability', term: 'Independent Deployability', vi: 'Khả năng triển khai độc lập', def: 'Khả năng đưa một thay đổi của microservice lên production mà không cần phối hợp hay triển khai cùng bất kỳ service nào khác.' },
    { key: 'canary-release', term: 'Canary Release', vi: 'Phát hành chim hoàng yến', def: 'Kỹ thuật điều hướng một tỷ lệ nhỏ lưu lượng thực tế (e.g. 5%) tới phiên bản mới để phát hiện lỗi sớm trước khi mở rộng.' },
    { key: 'blue-green', term: 'Blue/Green Deployment', vi: 'Triển khai Xanh/Lam', def: 'Kỹ thuật duy trì hai môi trường sản xuất giống hệt nhau, chuyển đổi router để đạt zero-downtime và rollback tức thì.' },
    { key: 'serverless', term: 'Serverless / FaaS', vi: 'Điện toán không máy chủ', def: 'Mô hình thực thi mã theo sự kiện, tự động co giãn từ 0 đến hàng ngàn instances và tính phí chính xác theo tài nguyên sử dụng.' }
  ]);
})();
