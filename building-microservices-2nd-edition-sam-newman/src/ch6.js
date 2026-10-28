/* Chương 6 — Build: CI, pipeline, artifact, monorepo vs multi-repo */
(function () {
  const { h, s, clear, fmt, rng, clamp, sleep,
          slider, seg, button, checkbox, stat, log, widget, glossary } = window.DDIA;

  // ---------- local helpers ----------
  const svgBox = (w, ht, label) => s('svg', { viewBox: `0 0 ${w} ${ht}`, role: 'img', 'aria-label': label || '' });
  const txt = (x, y, str, attrs) => s('text', Object.assign({ x, y }, attrs || {}), str);
  function hashHex(str, len) {
    let a = 0x811c9dc5, b = 0x01000193;
    let out = '';
    for (let round = 0; out.length < len; round++) {
      let x = a ^ round;
      for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, b) >>> 0; }
      out += (x >>> 0).toString(16).padStart(8, '0');
    }
    return out.slice(0, len);
  }
  function stageRow(stages) {
    // stages: [{title, sub, tone}] tone: '', 'on', 'ok', 'bad', 'wait'
    return h('div', { class: 'ch6-stage' }, stages.map((st) =>
      h('div', { class: 'box' + (st.tone ? ' ' + st.tone : '') }, h('h5', st.title), st.body || null, st.sub ? h('small', st.sub) : null)));
  }
  const pill = (label, tone) => h('span', { class: 'pill' + (tone ? ' ' + tone : '') }, label);
  const minutes = (m) => (m >= 60 ? fmt(Math.floor(m / 60)) + ' giờ ' + (m % 60 ? fmt(m % 60) + ' phút' : '') : fmt(m) + ' phút').trim();

  // ======================================================================
  // 6.1 — Integration frequency sawtooth
  // ======================================================================
  widget('ch6-ci-sync', (root) => {
    const INTERVALS = [0.25, 0.5, 1, 2, 3, 5, 10];
    const LINES_PER_DAY = 40; // số liệu minh hoạ
    const DAYS = 20;
    const label = (d) => (d < 1 ? fmt(1 / d) + ' lần/ngày' : d === 1 ? 'mỗi ngày' : 'mỗi ' + fmt(d) + ' ngày');
    const slI = slider({ label: 'Khoảng cách giữa hai lần tích hợp', min: 0, max: INTERVALS.length - 1, value: 4, format: (i) => label(INTERVALS[i]), onInput: render });
    const slD = slider({ label: 'Số lập trình viên', min: 2, max: 12, value: 6, format: (v) => fmt(v) + ' người', onInput: render });
    const stOwn = stat('Thay đổi của bạn chưa tích hợp (đỉnh)', '');
    const stOthers = stat('Thay đổi của đồng đội bạn chưa thấy (đỉnh)', '');
    const stConf = stat('Xung đột dự kiến mỗi lần merge', '');
    const stCI = stat('Đạt mức tối thiểu của CI?', '');
    const viz = h('div', { class: 'viz' });
    const note = h('p', { class: 'lab-note' }, 'Số liệu minh hoạ: mỗi người tạo khoảng 40 dòng thay đổi mỗi ngày; xung đột tăng theo tích “thay đổi của bạn × thay đổi của người khác” mà hai bên chưa nhìn thấy.');
    root.append(h('div', { class: 'controls' }, slI.el, slD.el), h('div', { class: 'stats' }, stOwn, stOthers, stConf, stCI), viz, note);

    function render() {
      const iv = INTERVALS[slI.value], devs = slD.value;
      const own = LINES_PER_DAY * iv;
      const others = LINES_PER_DAY * iv * (devs - 1);
      const conflicts = 0.0004 * own * others / LINES_PER_DAY; // minh hoạ: tỉ lệ với tích
      stOwn.update(fmt(own) + ' dòng', own > 80 ? 'warn' : 'ok');
      stOthers.update(fmt(others) + ' dòng', others > 400 ? 'bad' : others > 160 ? 'warn' : 'ok');
      stConf.update(fmt(conflicts, 1), conflicts >= 3 ? 'bad' : conflicts >= 1 ? 'warn' : 'ok', 'tăng theo bình phương khoảng cách');
      stCI.update(iv <= 1 ? 'Có' : 'Chưa', iv <= 1 ? 'ok' : 'bad', iv <= 1 ? 'tích hợp ít nhất mỗi ngày' : 'tối thiểu là mỗi ngày một lần');

      const W = 620, H = 230, L = 56, R = 14, T = 16, B = 40;
      const svg = svgBox(W, H, 'Biểu đồ răng cưa lượng thay đổi chưa tích hợp');
      const yMax = Math.max(others, 200) * 1.15;
      const x = (d) => L + (d / DAYS) * (W - L - R);
      const y = (v) => H - B - (v / yMax) * (H - T - B);
      for (let i = 0; i <= 4; i++) {
        const v = (yMax / 4) * i;
        svg.append(s('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'grid' }), txt(L - 6, y(v) + 4, fmt(v), { 'text-anchor': 'end' }));
      }
      for (let d = 0; d <= DAYS; d += 5) svg.append(txt(x(d), H - B + 16, 'ngày ' + d, { 'text-anchor': 'middle' }));
      svg.append(s('line', { x1: L, x2: W - R, y1: H - B, y2: H - B, class: 'axis' }), s('line', { x1: L, x2: L, y1: T, y2: H - B, class: 'axis' }));
      svg.append(txt(12, T + 4, 'dòng', {}));
      const path = (rate) => {
        let p = `M${x(0)},${y(0)}`;
        for (let t = 0; t < DAYS - 1e-9; t += iv) {
          const end = Math.min(t + iv, DAYS);
          p += ` L${x(end)},${y(rate * (end - t))}`;
          if (end < DAYS) p += ` L${x(end)},${y(0)}`;
        }
        return p;
      };
      svg.append(s('path', { d: path(LINES_PER_DAY * (devs - 1)), class: 'f-none s-warn', 'stroke-width': 2 }));
      svg.append(s('path', { d: path(LINES_PER_DAY), class: 'f-none s-accent', 'stroke-width': 2 }));
      const merges = Math.floor(DAYS / iv);
      if (merges <= 40) for (let k = 1; k <= merges; k++) svg.append(s('circle', { cx: x(k * iv), cy: y(0), r: 3, class: 'f-ok' }));
      svg.append(s('rect', { x: W - 230, y: T, width: 12, height: 3, class: 'f-accent' }), txt(W - 212, T + 5, 'của bạn'),
        s('rect', { x: W - 150, y: T, width: 12, height: 3, class: 'f-warn' }), txt(W - 132, T + 5, 'của đồng đội'));
      svg.append(txt(L + 4, H - 6, merges + ' lần merge (chấm xanh) trong ' + DAYS + ' ngày làm việc'));
      clear(viz).append(svg);
    }
    render();
  });

  // ======================================================================
  // 6.2 — Jez Humble's three questions + broken build pile-up
  // ======================================================================
  widget('ch6-humble-test', (root) => {
    const q1 = checkbox('Check-in vào mainline ít nhất mỗi ngày', false, render);
    const q2 = checkbox('Có bộ test tự động xác minh thay đổi', true, render);
    const q3 = checkbox('Build hỏng thì sửa ngay là ưu tiên số 1', false, render);
    const sl = slider({ label: 'Commit tiếp tục đẩy lên khi build đỏ', min: 0, max: 20, value: 8, format: (v) => fmt(v) + ' commit', onInput: render });
    const verdict = h('div', { class: 'box' });
    const stFix = stat('Công sức sửa build (minh hoạ)', '');
    const stDays = stat('Build đỏ kéo dài', '');
    const viz = h('div', { class: 'viz' });
    root.append(
      h('div', { class: 'lab-split' },
        h('div', { class: 'box' }, h('h5', 'Ba câu hỏi'), h('div', { style: { display: 'grid', gap: '8px' } }, q1.el, q2.el, q3.el)),
        verdict),
      h('div', { class: 'controls' }, sl.el), h('div', { class: 'stats' }, stFix, stDays), viz);

    const effort = (n) => 1 * Math.pow(1 + n, 1.6); // giờ, minh hoạ: các thay đổi chồng nhau khó gỡ hơn tuyến tính
    function render() {
      const yes = [q1.value, q2.value, q3.value];
      const n = yes.filter(Boolean).length;
      clear(verdict).append(h('h5', 'Kết luận'),
        h('p', n === 3 ? pill('Đang làm CI', 'ok') : pill(`Chưa thực sự làm CI (${n}/3)`, n === 2 ? 'warn' : 'bad')),
        h('ul', { style: { margin: '6px 0 0', paddingLeft: '1.1em' } },
          !q1.value ? h('li', 'Đang trì hoãn tích hợp: lần merge sau sẽ khó hơn.') : null,
          !q2.value ? h('li', 'Chỉ biết mã tích hợp đúng cú pháp, không biết hành vi có bị phá.') : null,
          !q3.value ? h('li', 'Thay đổi tiếp tục chồng lên build đỏ.') : null,
          n === 3 ? h('li', 'Cả ba điều kiện đều thoả. Công cụ CI đang thực sự giúp bạn làm CI.') : null));
      const piled = q3.value ? 0 : sl.value;
      sl.input.disabled = q3.value;
      const e = effort(piled);
      stFix.update(fmt(e, 1) + ' giờ', e > 20 ? 'bad' : e > 6 ? 'warn' : 'ok', q3.value ? 'cả đội dừng lại sửa ngay' : piled + ' commit chồng lên lỗi gốc');
      const days = e / 6;
      stDays.update(days < 1 ? 'dưới 1 ngày' : fmt(days, 1) + ' ngày', days >= 2 ? 'bad' : days >= 1 ? 'warn' : 'ok', 'giả định 6 giờ làm việc hiệu quả/ngày');

      const W = 620, H = 200, L = 50, R = 14, T = 14, B = 36;
      const svg = svgBox(W, H, 'Công sức sửa build theo số commit chồng lên');
      const maxE = effort(20);
      const bw = (W - L - R) / 21;
      for (let i = 0; i <= 4; i++) {
        const v = (maxE / 4) * i, yy = H - B - (v / maxE) * (H - T - B);
        svg.append(s('line', { x1: L, x2: W - R, y1: yy, y2: yy, class: 'grid' }), txt(L - 6, yy + 4, fmt(v), { 'text-anchor': 'end' }));
      }
      for (let k = 0; k <= 20; k++) {
        const v = effort(k), bh = (v / maxE) * (H - T - B);
        svg.append(s('rect', { x: L + k * bw + 2, y: H - B - bh, width: bw - 4, height: bh, class: k === piled ? 'f-bad' : 'f-accent-soft' }));
        if (k % 5 === 0) svg.append(txt(L + k * bw + bw / 2, H - B + 14, String(k), { 'text-anchor': 'middle' }));
      }
      svg.append(txt(L, H - 4, 'số commit đẩy lên trong lúc build đỏ'), txt(8, T + 4, 'giờ'));
      clear(viz).append(svg);
    }
    render();
  });

  // ======================================================================
  // 6.3 — Branching vs DORA 2016 + patch bombs
  // ======================================================================
  widget('ch6-branching', (root) => {
    const LIFE = [2, 6, 24, 48, 72, 120, 240]; // giờ
    const lifeLabel = (hrs) => (hrs < 24 ? fmt(hrs) + ' giờ' : fmt(hrs / 24) + ' ngày');
    const slL = slider({ label: 'Thời gian sống của nhánh', min: 0, max: LIFE.length - 1, value: 4, format: (i) => lifeLabel(LIFE[i]), onInput: render });
    const slN = slider({ label: 'Số nhánh đang mở cùng lúc', min: 1, max: 8, value: 5, format: (v) => fmt(v), onInput: render });
    const preset = seg({ options: [{ value: 'tbd', label: 'Trunk-based' }, { value: 'fb', label: 'Feature branch' }, { value: 'gitflow', label: 'Nhánh dài kiểu GitFlow' }], value: 'fb',
      onChange: (v) => { const p = { tbd: [1, 2], fb: [4, 5], gitflow: [6, 7] }[v]; slL.set(p[0]); slN.set(p[1]); render(); } });
    const crit = h('div', { class: 'btn-row' });
    const viz = h('div', { class: 'viz' });
    const slP = slider({ label: 'Chia thay đổi 1.200 dòng thành', min: 1, max: 12, value: 1, format: (v) => fmt(v) + (v === 1 ? ' patch (patch bomb)' : ' patch'), onInput: renderPatch });
    const stPer = stat('Dòng mỗi patch', '');
    const stRev = stat('Tổng thời gian review (minh hoạ)', '');
    const stFirst = stat('Phần đầu tiên vào trunk sau', '');
    root.append(h('div', { class: 'controls' }, h('div', { class: 'ctl' }, h('label', h('span', 'Mẫu có sẵn')), preset.el), slL.el, slN.el), crit, viz,
      h('div', { class: 'box' }, h('h5', 'Patch nhỏ hay patch bomb (State of DevOps 2019)'), h('div', { class: 'controls' }, slP.el), h('div', { class: 'stats' }, stPer, stRev, stFirst)));

    function render() {
      const life = LIFE[slL.value], n = slN.value;
      const c1 = life < 24, c2 = n < 3, c3 = life <= 24;
      clear(crit).append(
        pill((c1 ? 'Đạt' : 'Chưa đạt') + ': nhánh sống dưới 1 ngày', c1 ? 'ok' : 'bad'),
        pill((c2 ? 'Đạt' : 'Chưa đạt') + ': dưới 3 nhánh đang mở', c2 ? 'ok' : 'bad'),
        pill((c3 ? 'Đạt' : 'Chưa đạt') + ': merge vào trunk hằng ngày', c3 ? 'ok' : 'bad'));
      const DAYS = 10, W = 620, L = 64, R = 14, T = 26, lane = 22;
      const H = T + 20 + n * lane + 26;
      const svg = svgBox(W, H, 'Các nhánh tách khỏi trunk trong 10 ngày');
      const x = (hr) => L + (hr / (DAYS * 24)) * (W - L - R);
      for (let d = 0; d <= DAYS; d += 2) svg.append(s('line', { x1: x(d * 24), x2: x(d * 24), y1: T - 6, y2: H - 22, class: 'grid' }), txt(x(d * 24), H - 8, 'ngày ' + d, { 'text-anchor': 'middle' }));
      svg.append(txt(6, T + 4, 'trunk', { class: 'lbl-strong' }), s('line', { x1: L, x2: W - R, y1: T, y2: T, class: 's-accent', 'stroke-width': 3 }));
      let merges = 0;
      for (let i = 0; i < n; i++) {
        const yy = T + 20 + i * lane + 8;
        svg.append(txt(6, yy + 4, 'nhánh ' + (i + 1)));
        const offset = ((i * 0.37) % 1) * Math.min(life, 24);
        for (let t = offset; t < DAYS * 24; t += life + 2) {
          const end = Math.min(t + life, DAYS * 24);
          const tone = life <= 24 ? 'f-ok' : life <= 72 ? 'f-warn' : 'f-bad';
          svg.append(s('rect', { x: x(t), y: yy - 5, width: Math.max(2, x(end) - x(t)), height: 10, rx: 3, class: tone }));
          if (end < DAYS * 24) { svg.append(s('line', { x1: x(end), x2: x(end), y1: yy - 5, y2: T, class: 's-ink3 dash f-none' })); merges++; }
        }
      }
      svg.append(txt(W - R, T - 10, merges + ' lần merge vào trunk', { 'text-anchor': 'end' }));
      clear(viz).append(svg);
    }
    function renderPatch() {
      const p = slP.value, per = 1200 / p;
      const reviewMin = (lines) => 6 * Math.pow(lines / 100, 1.4); // phút, minh hoạ: patch càng to càng khó đọc
      const total = p * reviewMin(per);
      stPer.update(fmt(per) + ' dòng', per > 400 ? 'bad' : per > 200 ? 'warn' : 'ok');
      stRev.update(minutes(Math.round(total)), total > 240 ? 'bad' : total > 120 ? 'warn' : 'ok');
      stFirst.update(minutes(Math.round(reviewMin(per))), p === 1 ? 'bad' : 'ok', p === 1 ? 'chờ review cả khối, dễ phải rebase' : 'phần còn lại theo sau');
    }
    render(); renderPatch();
  });

  // ======================================================================
  // 6.4 — Catalog pipeline: build-120 / 121 / 122
  // ======================================================================
  widget('ch6-pipeline', (root) => {
    const STAGES = [
      { key: 'fast', title: 'Biên dịch & test nhanh', min: 4 },
      { key: 'slow', title: 'Test chậm', min: 15 },
      { key: 'perf', title: 'Test hiệu năng', min: 30 },
      { key: 'prod', title: 'Production', min: 5 },
    ];
    const FAIL = { 'build-120': 'fast', 'build-121': 'perf', 'build-122': null };
    const selB = seg({ options: Object.keys(FAIL).map((b) => ({ value: b, label: b })), value: 'build-120', onChange: () => show(final()) });
    const selM = seg({ options: [{ value: 'staged', label: 'Pipeline nhiều chặng' }, { value: 'single', label: 'Một bước chạy mọi test' }], value: 'staged', onChange: () => show(final()) });
    const runBtn = button('Chạy build', run);
    const stagesEl = h('div');
    const stFeedback = stat('Lập trình viên biết kết quả sau', '');
    const stCost = stat('Phút máy CI đã dùng', '');
    const stDeploy = stat('Lên production?', '');
    const hist = h('tbody');
    root.append(h('div', { class: 'controls' }, h('div', { class: 'ctl' }, h('label', h('span', 'Bản build')), selB.el), h('div', { class: 'ctl' }, h('label', h('span', 'Kiểu build')), selM.el), runBtn),
      stagesEl, h('div', { class: 'stats' }, stFeedback, stCost, stDeploy),
      h('div', { class: 'table-wrap' }, h('table', { class: 'data' }, h('thead', h('tr', h('th', 'Lần chạy'), h('th', 'Kiểu'), h('th', 'Kết quả'), h('th', { class: 'num' }, 'Phản hồi sau'))), hist)),
      h('p', { class: 'lab-note' }, 'Thời lượng chặng là số liệu minh hoạ: test nhanh 4 phút, test chậm 15 phút, test hiệu năng 30 phút, triển khai 5 phút.'));

    function layout() {
      return selM.value === 'single'
        ? [{ key: 'all', title: 'Biên dịch + mọi test', min: 49, covers: ['fast', 'slow', 'perf'] }, STAGES[3]]
        : STAGES.map((x) => Object.assign({ covers: [x.key] }, x));
    }
    function final() {
      const lay = layout(), fail = FAIL[selB.value];
      const states = []; let t = 0, failedAt = null;
      for (const st of lay) {
        if (failedAt) { states.push('skip'); continue; }
        t += st.min;
        if (fail && st.covers.includes(fail)) { states.push('bad'); failedAt = t; } else states.push('ok');
      }
      return { lay, states, feedback: failedAt || t, cost: failedAt || t, deployed: !fail };
    }
    function show(r, activeIdx) {
      clear(stagesEl).append(stageRow(r.lay.map((st, i) => ({
        title: st.title,
        sub: i === activeIdx ? 'đang chạy…' : r.states[i] === 'ok' ? 'qua · ' + st.min + ' phút' : r.states[i] === 'bad' ? 'HỎNG · ' + st.min + ' phút' : r.states[i] === 'skip' ? 'không chạy' : 'chờ',
        body: h('div', { class: 'ch6-mono' }, selB.value),
        tone: i === activeIdx ? 'on' : r.states[i] === 'ok' ? 'ok' : r.states[i] === 'bad' ? 'bad' : '',
      }))));
      if (r.feedback != null) {
        stFeedback.update(minutes(r.feedback), r.feedback <= 5 ? 'ok' : r.feedback <= 20 ? 'warn' : 'bad');
        stCost.update(fmt(r.cost) + ' phút', r.cost <= 10 ? 'ok' : 'warn');
        stDeploy.update(r.deployed ? 'Có' : 'Không', r.deployed ? 'ok' : 'bad', r.deployed ? 'đã qua mọi chặng' : 'cần commit mới và chạy lại pipeline');
      }
    }
    async function run() {
      runBtn.disabled = true;
      const r = final();
      const live = { lay: r.lay, states: r.lay.map(() => 'wait'), feedback: null };
      for (let i = 0; i < r.lay.length; i++) {
        if (r.states[i] === 'skip') { live.states[i] = 'skip'; continue; }
        show(live, i);
        await sleep(Math.min(900, r.lay[i].min * 20));
        live.states[i] = r.states[i];
      }
      show(r);
      hist.prepend(h('tr', h('td', { class: 'ch6-mono' }, selB.value), h('td', selM.value === 'single' ? 'Một bước' : 'Nhiều chặng'),
        h('td', r.deployed ? pill('Lên production', 'ok') : pill('Hỏng', 'bad')), h('td', { class: 'num' }, minutes(r.feedback))));
      while (hist.children.length > 6) hist.lastChild.remove();
      runBtn.disabled = false;
    }
    show(final());
    hist.append(h('tr', h('td', { class: 'ch6-mono' }, 'build-120'), h('td', 'Nhiều chặng'), h('td', pill('Hỏng', 'bad')), h('td', { class: 'num' }, minutes(4))));
  });

  // ======================================================================
  // 6.5 — Continuous Delivery vs Continuous Deployment with manual UAT
  // ======================================================================
  widget('ch6-cd', (root) => {
    const r = rng(6);
    const mode = seg({ options: [{ value: 'delivery', label: 'Continuous Delivery' }, { value: 'deployment', label: 'Continuous Deployment' }], value: 'delivery', onChange: () => { renderHead(); advanceAll(); } });
    const commitBtn = button('Commit mới', commit);
    const head = h('div', { class: 'lab-note' });
    const tbody = h('tbody');
    const stRC = stat('Release candidate sẵn sàng', '');
    const stWait = stat('Đang chờ con người', '');
    const stProd = stat('Phiên bản đang chạy production', '');
    root.append(h('div', { class: 'controls' }, h('div', { class: 'ctl' }, h('label', h('span', 'Chế độ')), mode.el), commitBtn), head,
      h('div', { class: 'stats' }, stRC, stWait, stProd),
      h('div', { class: 'table-wrap' }, h('table', { class: 'data' }, h('thead', h('tr', h('th', 'Build'), h('th', 'Test nhanh'), h('th', 'Test chậm'), h('th', 'UAT'), h('th', 'Production'))), tbody)));

    let n = 0; let prodVersion = '—'; let busy = false;
    const builds = [];
    function newBuild(failSlow) { n++; return { id: 'build-' + n, st: ['pending', 'pending', 'pending', 'pending'], failSlow }; }
    function renderHead() {
      head.textContent = mode.value === 'delivery'
        ? 'UAT là chặng thủ công: bạn triển khai bản build vào môi trường UAT, kiểm tra, rồi đánh dấu đạt. Production cũng cần một người bấm nút.'
        : 'Mọi kiểm tra đều tự động (UAT được thay bằng test chức năng tự động). Bản nào qua hết sẽ tự lên production, không có người can thiệp.';
    }
    function cell(b, i) {
      const v = b.st[i];
      if (v === 'ok') return pill(i === 3 ? 'Đã triển khai' : 'Qua', 'ok');
      if (v === 'bad') return pill('Hỏng', 'bad');
      if (v === 'run') return pill('Đang chạy', 'accent');
      if (v === 'skip') return pill('Bỏ qua', '');
      if (v === 'wait') {
        const lbl = i === 2 ? 'Đánh dấu UAT đạt' : 'Triển khai lên production';
        return h('button', { type: 'button', class: 'btn btn-ghost', onClick: () => manual(b, i) }, lbl);
      }
      return h('span', { class: 'lab-note' }, 'chờ');
    }
    function render() {
      clear(tbody);
      builds.slice().reverse().forEach((b) => tbody.append(h('tr', h('td', { class: 'ch6-mono' }, b.id), [0, 1, 2, 3].map((i) => h('td', cell(b, i))))));
      const rc = builds.filter((b) => b.st[1] === 'ok' && b.st[3] !== 'ok' && b.st[3] !== 'skip').length;
      const wait = builds.filter((b) => b.st.includes('wait')).length;
      stRC.update(fmt(rc), rc ? 'accent' : '', 'đã qua test tự động, chưa lên production');
      stWait.update(fmt(wait), wait ? 'warn' : 'ok', mode.value === 'delivery' ? 'chặng thủ công' : 'không có chặng thủ công');
      stProd.update(prodVersion, prodVersion === '—' ? '' : 'ok');
    }
    function deploy(b) {
      b.st[3] = 'ok'; prodVersion = b.id;
      // bản cũ hơn đang chờ production thì không cần nữa
      builds.forEach((o) => { if (o !== b && o.st[3] === 'wait' && +o.id.slice(6) < +b.id.slice(6)) o.st[3] = 'skip'; });
    }
    async function advance(b) {
      for (let i = 0; i < 4; i++) {
        if (b.st[i] === 'ok' || b.st[i] === 'bad' || b.st[i] === 'skip') { if (b.st[i] !== 'ok') return; continue; }
        if (b.st[i] === 'wait' && mode.value === 'delivery') return;
        const manualStage = mode.value === 'delivery' && (i === 2 || i === 3);
        if (manualStage) { b.st[i] = 'wait'; render(); return; }
        b.st[i] = 'run'; render();
        await sleep(260);
        if (i === 1 && b.failSlow) { b.st[i] = 'bad'; render(); return; }
        if (i === 3) deploy(b); else b.st[i] = 'ok';
        render();
      }
    }
    async function advanceAll() {
      if (busy) return; busy = true; commitBtn.disabled = true;
      for (const b of builds) await advance(b);
      busy = false; commitBtn.disabled = false; render();
    }
    async function commit() {
      if (busy) return;
      builds.push(newBuild(r() < 0.25));
      while (builds.length > 6) builds.shift();
      await advanceAll();
    }
    async function manual(b, i) {
      if (busy) return;
      if (i === 3) { deploy(b); render(); return; }
      b.st[i] = 'ok'; render();
      busy = true; await advance(b); busy = false; render();
    }
    // trạng thái mở đầu
    const b1 = newBuild(false); b1.st = ['ok', 'ok', 'ok', 'ok']; prodVersion = b1.id;
    const b2 = newBuild(true); b2.st = ['ok', 'bad', 'pending', 'pending'];
    const b3 = newBuild(false); b3.st = ['ok', 'ok', 'wait', 'pending'];
    builds.push(b1, b2, b3);
    renderHead(); render();
  });

  // ======================================================================
  // 6.6 — Environments: fast feedback vs production-like
  // ======================================================================
  widget('ch6-environments', (root) => {
    const ENVS = [
      { key: 'laptop', name: 'Laptop lập trình viên', min: 1, like: 15, cost: 0, on: true },
      { key: 'ci', name: 'Máy CI (test nhanh)', min: 6, like: 30, cost: 1, on: true },
      { key: 'int', name: 'Môi trường test chậm', min: 25, like: 55, cost: 2, on: true },
      { key: 'uat', name: 'Môi trường UAT', min: 90, like: 75, cost: 3, on: false },
      { key: 'perf', name: 'Bản sao production (hiệu năng)', min: 180, like: 95, cost: 6, on: false },
    ];
    const boxes = ENVS.map((e) => checkbox(e.name, e.on, render));
    const stFirst = stat('Phản hồi đầu tiên sau', '');
    const stLike = stat('Giống production nhất trước khi lên production', '');
    const stTotal = stat('Tổng thời gian pipeline', '');
    const stCost = stat('Chi phí hạ tầng tương đối', '');
    const advice = h('p', { class: 'lab-note' });
    const viz = h('div', { class: 'viz' });
    root.append(h('div', { class: 'controls' }, boxes.map((b) => b.el)), h('div', { class: 'stats' }, stFirst, stLike, stTotal, stCost), viz, advice);

    function render() {
      const on = ENVS.filter((e, i) => boxes[i].value);
      const first = on.length ? Math.min(...on.map((e) => e.min)) : null;
      const like = on.length ? Math.max(...on.map((e) => e.like)) : 0;
      const total = on.reduce((a, e) => a + e.min, 0);
      const cost = on.reduce((a, e) => a + e.cost, 0);
      stFirst.update(first == null ? 'không có' : minutes(first), first == null ? 'bad' : first <= 6 ? 'ok' : first <= 30 ? 'warn' : 'bad');
      stLike.update(like + '%', like >= 75 ? 'ok' : like >= 50 ? 'warn' : 'bad');
      stTotal.update(minutes(total), total <= 60 ? 'ok' : total <= 180 ? 'warn' : 'bad');
      stCost.update(fmt(cost) + ' đơn vị', cost <= 3 ? 'ok' : cost <= 7 ? 'warn' : 'bad');
      advice.textContent = 'Số liệu minh hoạ. ' + (!on.length ? 'Không có môi trường nào: lỗi chỉ lộ ra trên production.'
        : first > 6 ? 'Không có môi trường rẻ ở đầu pipeline: lập trình viên phải chờ lâu mới biết lỗi đơn giản.'
        : like < 60 ? 'Phản hồi nhanh nhưng chưa có môi trường đủ giống production: lỗi hạ tầng sẽ lộ ra muộn.'
        : 'Pipeline có cả phản hồi nhanh ở đầu lẫn môi trường giống production ở cuối. Hãy tiếp tục xem lại sự cân bằng này.');

      const W = 620, H = 260, L = 50, R = 20, T = 18, B = 40;
      const svg = svgBox(W, H, 'Thời gian phản hồi và mức giống production của từng môi trường');
      const lx = (m) => L + (Math.log10(m) / Math.log10(300)) * (W - L - R);
      const y = (p) => H - B - (p / 100) * (H - T - B);
      [1, 3, 10, 30, 100, 300].forEach((m) => svg.append(s('line', { x1: lx(m), x2: lx(m), y1: T, y2: H - B, class: 'grid' }), txt(lx(m), H - B + 14, m + ' ph', { 'text-anchor': 'middle' })));
      [0, 25, 50, 75, 100].forEach((p) => svg.append(s('line', { x1: L, x2: W - R, y1: y(p), y2: y(p), class: 'grid' }), txt(L - 6, y(p) + 4, p + '%', { 'text-anchor': 'end' })));
      svg.append(txt(W - R, H - 6, 'thời gian tới khi có phản hồi (thang log) →', { 'text-anchor': 'end' }), txt(L, T - 6, '↑ mức giống production'));
      const pts = ENVS.map((e, i) => ({ e, on: boxes[i].value }));
      const path = pts.filter((p) => p.on).map((p, i) => (i ? 'L' : 'M') + lx(p.e.min) + ',' + y(p.e.like)).join(' ');
      if (path) svg.append(s('path', { d: path, class: 'f-none s-accent dash', 'stroke-width': 1.5 }));
      pts.forEach((p, i) => {
        const cx = lx(p.e.min), cy = y(p.e.like);
        svg.append(s('circle', { cx, cy, r: 7, class: p.on ? 'f-accent' : 'f-surface2 s-line', 'stroke-width': 1.5 }));
        const anchor = i === pts.length - 1 ? 'end' : 'start';
        svg.append(txt(cx + (anchor === 'end' ? -10 : 10), cy + 4, p.e.name, { 'text-anchor': anchor, class: p.on ? 'lbl-strong' : '' }));
      });
      clear(viz).append(svg);
    }
    render();
  });

  // ======================================================================
  // 6.7 — Build once vs rebuild per stage
  // ======================================================================
  widget('ch6-artifacts', (root) => {
    const STAGES = [
      { title: 'Biên dịch & test nhanh', log: '—' },
      { title: 'Slow Tests', log: 'DEBUG' },
      { title: 'Performance Tests', log: 'INFO' },
      { title: 'Production', log: 'INFO' },
    ];
    const BUILD_MIN = 6; // minh hoạ
    const strat = seg({ options: [{ value: 'once', label: 'Build một lần, thăng cấp' }, { value: 'rebuild', label: 'Build lại ở mỗi chặng' }], value: 'once', onChange: () => show(compute()) });
    const drift = checkbox('Cờ build khác ở chặng Production', true, () => show(compute()));
    const bake = checkbox('Nhúng mức log của môi trường vào artifact', false, () => show(compute()));
    const runBtn = button('Chạy pipeline', run);
    const stagesEl = h('div');
    const stBuilds = stat('Số lần build', '');
    const stMin = stat('Phút dành cho build', '');
    const stSame = stat('Artifact production = artifact đã kiểm thử?', '');
    const cfg = h('tbody');
    root.append(h('div', { class: 'controls' }, h('div', { class: 'ctl' }, h('label', h('span', 'Chiến lược')), strat.el), drift.el, bake.el, runBtn),
      stagesEl, h('div', { class: 'stats' }, stBuilds, stMin, stSame),
      h('div', { class: 'table-wrap' }, h('table', { class: 'data' }, h('thead', h('tr', h('th', 'Chặng'), h('th', 'LOG_LEVEL'), h('th', 'Lấy từ đâu'))), cfg)));

    function compute() {
      const once = strat.value === 'once' && !bake.value;
      const arts = STAGES.map((st, i) => {
        if (once) return { id: 'catalog:build-123', dig: hashHex('catalog-123', 12), built: i === 0 };
        let seed = 'catalog-123';
        if (bake.value) seed += '-' + st.log;
        if (strat.value === 'rebuild' && drift.value && i === 3) seed += '-flag';
        const id = bake.value ? 'catalog:build-123-' + (st.log === '—' ? 'base' : st.log.toLowerCase()) : 'catalog:build-123';
        return { id, dig: hashHex(seed, 12), built: strat.value === 'rebuild' || i === 0 || bake.value };
      });
      const builds = once ? 1 : bake.value && strat.value === 'once' ? 3 : 4;
      const tested = arts.slice(1, 3).map((a) => a.dig);
      const prod = arts[3].dig;
      let same;
      if (once) same = 'yes';
      else if (bake.value) same = 'partial';
      else if (!tested.includes(prod)) same = 'no';
      else same = 'unproven';
      return { arts, builds, same };
    }
    function show(r, active) {
      clear(stagesEl).append(stageRow(STAGES.map((st, i) => ({
        title: st.title,
        body: h('div', h('div', { class: 'ch6-mono' }, r.arts[i].id), h('div', { class: 'ch6-mono' }, 'sha256:' + r.arts[i].dig)),
        sub: (r.arts[i].built ? 'build tại đây' : 'lấy từ registry') + (i ? ' · LOG ' + st.log : ''),
        tone: active === i ? 'on' : active != null && i > active ? '' : (i === 3 && r.same === 'no') ? 'bad' : (i === 3 && r.same !== 'yes') ? 'wait' : 'ok',
      }))));
      stBuilds.update(fmt(r.builds), r.builds === 1 ? 'ok' : 'bad');
      stMin.update(fmt(r.builds * BUILD_MIN) + ' phút', r.builds === 1 ? 'ok' : 'warn', 'minh hoạ: ' + BUILD_MIN + ' phút mỗi lần build');
      const SAME = {
        yes: ['Có', 'ok', 'cùng một digest qua mọi chặng'],
        no: ['Không', 'bad', 'digest production khác bản đã test'],
        unproven: ['Không chứng minh được', 'warn', 'build lại thì không có gì bảo đảm hai bản giống nhau'],
        partial: ['Chỉ một phần', 'warn', 'mỗi môi trường một artifact: Slow Tests đã test một bản khác'],
      }[r.same];
      stSame.update(SAME[0], SAME[1], SAME[2]);
      clear(cfg);
      STAGES.slice(1).forEach((st) => cfg.append(h('tr', h('td', st.title), h('td', { class: 'ch6-mono' }, st.log),
        h('td', bake.value ? pill('nhúng trong artifact', 'bad') : pill('cấu hình bên ngoài artifact', 'ok')))));
    }
    async function run() {
      runBtn.disabled = true;
      const r = compute();
      for (let i = 0; i < STAGES.length; i++) { show(r, i); await sleep(380); }
      show(r);
      runBtn.disabled = false;
    }
    strat.set('rebuild');
    show(compute());
  });

  // ======================================================================
  // 6.8 — One giant repo, one giant build
  // ======================================================================
  widget('ch6-giant-repo', (root) => {
    const SVC = [
      { name: 'User', min: 6 }, { name: 'Catalog', min: 8 }, { name: 'Invoice', min: 5 }, { name: 'Shipping', min: 7 }, { name: 'Payment', min: 9 },
    ];
    const layout = seg({ options: [{ value: 'giant', label: 'Một repo, một build' }, { value: 'split', label: 'Mỗi service một build' }], value: 'giant', onChange: render });
    const changed = seg({ options: SVC.map((x) => ({ value: x.name, label: x.name })), value: 'User', onChange: render });
    const breaks = checkbox('Thay đổi này làm vỡ build', true, render);
    const stagesEl = h('div');
    const stT = stat('Thời gian chờ build', '');
    const stArt = stat('Artifact được tạo', '');
    const stDep = stat('Cần triển khai service nào?', '');
    const stBlock = stat('Đội khác bị chặn commit', '');
    root.append(h('div', { class: 'controls' }, h('div', { class: 'ctl' }, h('label', h('span', 'Tổ chức build')), layout.el),
      h('div', { class: 'ctl' }, h('label', h('span', 'Sửa một dòng ở')), changed.el), breaks.el),
      stagesEl, h('div', { class: 'stats' }, stT, stArt, stDep, stBlock),
      h('p', { class: 'lab-note' }, 'Thời gian build từng service là số liệu minh hoạ (5–9 phút). Mỗi service do một đội khác nhau phụ trách.'));

    function render() {
      const giant = layout.value === 'giant', ch = changed.value, br = breaks.value;
      clear(stagesEl).append(stageRow(SVC.map((x) => {
        const touched = x.name === ch;
        const built = giant || touched;
        let tone = built ? (touched && br ? 'bad' : 'ok') : '';
        let sub = built ? (touched ? (br ? 'HỎNG' : 'qua') : 'build lại dù không đổi') : 'không cần build';
        if (giant && br && !touched) { tone = 'wait'; sub = 'bị chặn: build chung đang đỏ'; }
        return { title: x.name, sub: sub + ' · ' + x.min + ' ph', tone };
      })));
      const t = giant ? SVC.reduce((a, x) => a + x.min, 0) : SVC.find((x) => x.name === ch).min;
      stT.update(fmt(t) + ' phút', giant ? 'bad' : 'ok', giant ? 'chạy kiểm tra cho cả 5 service' : 'chỉ service bị sửa');
      const arts = br ? 0 : giant ? SVC.length : 1;
      stArt.update(fmt(arts), br ? 'bad' : giant ? 'warn' : 'ok', br ? 'build hỏng nên không có artifact' : giant ? 'cùng gắn với một build' : ch.toLowerCase() + ' phiên bản mới');
      stDep.update(br ? '—' : giant ? 'Không rõ' : ch, br ? '' : giant ? 'bad' : 'ok', giant && !br ? 'đoán qua commit message, dễ thành triển khai tất cả' : '');
      stBlock.update(giant && br ? fmt(SVC.length - 1) + ' đội' : '0', giant && br ? 'bad' : 'ok', giant && br ? 'ai chịu trách nhiệm sửa?' : 'build của đội khác không bị ảnh hưởng');
    }
    render();
  });

  // ======================================================================
  // 6.9 — Multi-repo: rolling out Connection library
  // ======================================================================
  widget('ch6-multi-repo', (root) => {
    let latest, svcs;
    const top = h('div', { class: 'btn-row' });
    const tbody = h('tbody');
    const stLatest = stat('Connection mới nhất', '');
    const stProd = stat('Production đang chạy', '');
    const stDep = stat('Ngừng hỗ trợ bản cũ nhất được chưa?', '');
    const lg = log(40);
    root.append(top, h('div', { class: 'stats' }, stLatest, stProd, stDep),
      h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
        h('thead', h('tr', h('th', 'Service'), h('th', 'Phụ thuộc khai báo'), h('th', 'Artifact đã build'), h('th', 'Đang chạy'), h('th', 'Thao tác'))), tbody)), lg);

    function reset() {
      latest = 2;
      svcs = [
        { name: 'Invoice', declared: 2, built: 2, deployed: 1 },
        { name: 'Payroll', declared: 1, built: 1, deployed: 1 },
      ];
      lg.reset();
      lg.add('Repo connection: build qua, phát hành connection-2.0.jar', 'acc');
      lg.add('Repo invoice: nâng phụ thuộc lên connection 2, build invoice-57', 't');
      render();
    }
    function act(sv, kind) {
      if (kind === 'bump') { sv.declared = latest; lg.add(`Repo ${sv.name.toLowerCase()}: đổi phụ thuộc sang connection ${latest} (commit riêng ở repo này)`, 't'); }
      if (kind === 'build') { sv.built = sv.declared; lg.add(`Build ${sv.name}: tạo artifact mới với connection ${sv.built}`, 'ok'); }
      if (kind === 'deploy') { sv.deployed = sv.built; lg.add(`Triển khai ${sv.name} lên production (độc lập với service còn lại)`, 'ok'); }
      render();
    }
    function render() {
      clear(top).append(
        button('Phát hành Connection v' + (latest + 1), () => { latest++; lg.add(`Repo connection: build qua, phát hành connection-${latest}.0.jar`, 'acc'); render(); }),
        button('Làm lại', reset, 'ghost'));
      clear(tbody);
      svcs.forEach((sv) => tbody.append(h('tr',
        h('td', h('b', sv.name)),
        h('td', { class: 'ch6-mono' }, 'connection ' + sv.declared),
        h('td', { class: 'ch6-mono' }, 'connection ' + sv.built),
        h('td', pill('connection ' + sv.deployed, sv.deployed === latest ? 'ok' : 'warn')),
        h('td', h('div', { class: 'btn-row' },
          h('button', { type: 'button', class: 'btn btn-ghost', disabled: sv.declared === latest, onClick: () => act(sv, 'bump') }, 'Nâng phụ thuộc'),
          h('button', { type: 'button', class: 'btn btn-ghost', disabled: sv.built === sv.declared, onClick: () => act(sv, 'build') }, 'Build'),
          h('button', { type: 'button', class: 'btn btn-ghost', disabled: sv.deployed === sv.built, onClick: () => act(sv, 'deploy') }, 'Triển khai'))))));
      const running = [...new Set(svcs.map((x) => x.deployed))].sort();
      stLatest.update('v' + latest, 'accent');
      stProd.update(running.map((v) => 'v' + v).join(', '), running.length === 1 && running[0] === latest ? 'ok' : 'warn', running.length > 1 ? 'nhiều phiên bản thư viện cùng chạy' : '');
      const oldest = running[0];
      const still = svcs.filter((x) => x.deployed === oldest || x.declared === oldest).map((x) => x.name);
      const canDrop = oldest === latest;
      stDep.update(canDrop ? 'Không còn bản cũ' : 'Chưa: v' + oldest, canDrop ? 'ok' : 'bad', canDrop ? 'mọi service đã chạy bản mới nhất' : 'còn dùng ở: ' + still.join(', '));
    }
    reset();
  });

  // ======================================================================
  // 6.10 — Cross-repo change ordering: Inventory & Shipping
  // ======================================================================
  widget('ch6-cross-repo', (root) => {
    const order = seg({ options: [
      { value: 'inv', label: 'Inventory trước, Shipping sau' },
      { value: 'ship', label: 'Shipping trước, Inventory sau' },
      { value: 'lock', label: 'Triển khai cả hai cùng lúc' },
    ], value: 'ship', onChange: () => {} });
    const runBtn = button('Thực hiện', run);
    const lg = log(60);
    const stOk = stat('Lời gọi Shipping → Inventory thành công', '');
    const stCommits = stat('Commit cần thiết (multi-repo)', '2', 'một commit mỗi repo');
    const slX = slider({ label: 'Tỉ lệ thay đổi chạm từ 2 service trở lên', min: 0, max: 60, value: 30, format: (v) => v + '%', onInput: renderCoupling });
    const coup = h('p');
    root.append(h('div', { class: 'controls' }, h('div', { class: 'ctl' }, h('label', h('span', 'Thứ tự')), order.el), runBtn),
      h('div', { class: 'stats' }, stOk, stCommits), lg,
      h('div', { class: 'box' }, h('h5', 'Tín hiệu về ranh giới service'), h('div', { class: 'controls' }, slX.el), coup));

    async function run() {
      runBtn.disabled = true; lg.reset();
      const o = order.value;
      let inv = 1, ship = 1, ok = 0, total = 0;
      const call = () => {
        total += 3;
        if (ship === 2 && inv === 1) { lg.add('  Shipping gọi GET /stock/{sku}/reservations → 404 (Inventory chưa có API mới) ×3', 'bad'); }
        else { ok += 3; lg.add('  Shipping gọi Inventory → 200 OK ×3' + (ship === 2 ? ' (dùng API mới)' : ' (API cũ)'), 'ok'); }
      };
      const step = async (msg, fn, tone) => { lg.add(msg, tone || 'acc'); if (fn) fn(); await sleep(350); call(); };
      if (o === 'inv') {
        await step('1. Commit repo inventory: thêm endpoint mới, giữ endpoint cũ');
        await step('2. Triển khai Inventory v2', () => { inv = 2; });
        await step('3. Commit repo shipping: dùng endpoint mới');
        await step('4. Triển khai Shipping v2', () => { ship = 2; });
        lg.add('Mỗi bước đều triển khai độc lập; nếu bước 4 lỗi, chỉ cần rollback Shipping.', 'ok');
      } else if (o === 'ship') {
        await step('1. Commit repo shipping: dùng endpoint mới');
        await step('2. Triển khai Shipping v2', () => { ship = 2; }, 'warn');
        await step('3. Commit repo inventory: thêm endpoint mới');
        await step('4. Triển khai Inventory v2', () => { inv = 2; });
        lg.add('Mã client không có ích gì khi API phía Inventory chưa tồn tại.', 'warn');
      } else {
        lg.add('1. Gom hai thay đổi, chờ cửa sổ triển khai chung', 'warn');
        await sleep(350);
        await step('2. Triển khai Inventory v2 và Shipping v2 trong cùng một đợt', () => { inv = 2; ship = 2; }, 'warn');
        lg.add('Chạy được, nhưng đây là lock-step: hai service không còn triển khai độc lập. Nếu Inventory lỗi, phải rollback cả hai.', 'bad');
      }
      stOk.update(fmt(ok) + '/' + fmt(total), ok === total ? 'ok' : 'bad');
      stCommits.update(o === 'lock' ? '2 (cùng đợt)' : '2', o === 'lock' ? 'warn' : 'ok', o === 'lock' ? 'vẫn hai repo, nhưng triển khai bị trói vào nhau' : 'một commit mỗi repo, theo thứ tự');
      runBtn.disabled = false;
    }
    function renderCoupling() {
      const v = slX.value;
      const tone = v < 10 ? 'ok' : v < 25 ? 'warn' : 'bad';
      clear(coup).append(pill(v < 10 ? 'Ngoại lệ, chấp nhận được' : v < 25 ? 'Đáng theo dõi' : 'Ranh giới có thể đặt sai', tone), ' ',
        v < 10 ? 'Thay đổi chủ yếu nằm gọn trong một service, đúng như kiến trúc được tối ưu để vậy.'
          : v < 25 ? 'Thay đổi xuyên service bắt đầu thành thói quen. Xem service nào hay bị sửa cùng nhau.'
            : 'Các service đang bị ghép nối chặt. Sách gợi ý cân nhắc gộp chúng lại thay vì tìm cách commit nguyên tử.',
        h('span', { class: 'lab-note' }, ' (ngưỡng 10% và 25% là minh hoạ, sách không đưa con số cụ thể)'));
    }
    lg.add('Chọn thứ tự rồi bấm “Thực hiện”. Mặc định đang chọn thứ tự dễ gây lỗi: Shipping trước.', 't');
    stOk.update('—', '');
    renderCoupling();
  });

  // ======================================================================
  // 6.11 — Monorepo build mapping: folders vs dependency graph
  // ======================================================================
  widget('ch6-monorepo', (root) => {
    const SERVICES = ['user', 'catalog', 'invoice', 'shipping'];
    const BUILD_MIN = { user: 6, catalog: 8, invoice: 5, shipping: 7 };
    // graph: which builds depend on each file (kiểu Bazel)
    const FILES = [
      { path: 'user-service/src/UserController.java', folder: ['user'], graph: ['user'] },
      { path: 'catalog-service/src/CatalogApi.java', folder: ['catalog'], graph: ['catalog'] },
      { path: 'invoice-service/src/Invoice.java', folder: ['invoice'], graph: ['invoice'] },
      { path: 'invoice-service/README.md', folder: ['invoice'], graph: [] },
      { path: 'shipping-service/src/ShippingClient.java', folder: ['shipping'], graph: ['shipping'] },
      { path: 'common/logging/Logger.java', folder: SERVICES, graph: SERVICES },
      { path: 'common/money/Money.java', folder: SERVICES, graph: ['catalog', 'invoice'] },
      { path: 'docs/architecture.md', folder: [], graph: [] },
    ];
    const DEFAULT = new Set(['common/money/Money.java', 'shipping-service/src/ShippingClient.java']);
    const mode = seg({ options: [{ value: 'folder', label: 'Ánh xạ theo thư mục' }, { value: 'graph', label: 'Đồ thị phụ thuộc (kiểu Bazel)' }], value: 'folder', onChange: render });
    const checks = FILES.map((f) => checkbox(h('span', { class: 'ch6-mono' }, f.path), DEFAULT.has(f.path), render));
    const builds = h('div');
    const stC = stat('Số commit', '1', 'ok', 'atomic commit');
    const stB = stat('Build được kích hoạt', '');
    const stM = stat('Phút build', '');
    const stD = stat('Lần triển khai vẫn cần', '');
    root.append(h('div', { class: 'controls' }, h('div', { class: 'ctl' }, h('label', h('span', 'Cách ánh xạ')), mode.el)),
      h('div', { class: 'lab-split' },
        h('div', { class: 'box' }, h('h5', 'Tệp sửa trong commit'), h('ul', { class: 'ch6-tree' }, checks.map((c) => h('li', c.el)))),
        h('div', { class: 'box' }, h('h5', 'Build được kích hoạt'), builds)),
      h('div', { class: 'stats' }, stC, stB, stM, stD),
      h('p', { class: 'lab-note' }, 'common/money chỉ được Catalog và Invoice dùng. Thời gian build là số liệu minh hoạ.'));

    function render() {
      const sel = FILES.filter((f, i) => checks[i].value);
      const trig = new Set();
      const why = {};
      sel.forEach((f) => f[mode.value].forEach((sv) => { trig.add(sv); (why[sv] = why[sv] || []).push(f.path.split('/').slice(0, 2).join('/')); }));
      const changedServices = new Set(sel.flatMap((f) => f.graph));
      clear(builds).append(h('ul', { class: 'ch6-tree' }, SERVICES.map((sv) => h('li',
        pill(sv + '-build', trig.has(sv) ? 'accent' : ''),
        trig.has(sv) ? h('span', { class: 'lab-note' }, '← ' + [...new Set(why[sv])].join(', ')) : h('span', { class: 'lab-note' }, 'không chạy')))));
      const mins = [...trig].reduce((a, sv) => a + BUILD_MIN[sv], 0);
      stC.update(sel.length ? '1' : '0', sel.length ? 'ok' : '', sel.length > 1 ? 'nhiều tệp, một commit' : 'atomic commit');
      stB.update(fmt(trig.size) + '/' + SERVICES.length, trig.size <= 2 ? 'ok' : trig.size === 3 ? 'warn' : 'bad');
      stM.update(fmt(mins) + ' phút', mins <= 15 ? 'ok' : 'warn');
      stD.update(fmt(changedServices.size), changedServices.size > 1 ? 'warn' : 'ok', changedServices.size > 1 ? 'mỗi service vẫn triển khai riêng, theo thứ tự' : 'triển khai độc lập');
    }
    render();
  });

  // ======================================================================
  // 6.12 — CODEOWNERS matcher + ownership models
  // ======================================================================
  widget('ch6-ownership', (root) => {
    const CO = [
      '# Ví dụ 6-1 (tài liệu GitHub)',
      '/build/logs/ @doctocat',
      'apps/ @octocat',
      '/docs/ @doctocat',
      '# Thêm minh hoạ cho các service',
      '/services/inventory/ @team-inventory',
      '/services/shipping/ @team-shipping',
    ].join('\n');
    const PR = [
      'services/inventory/api/StockApi.java',
      'services/shipping/client/InventoryClient.java',
      'docs/deploy.md',
      'build/logs/README',
      'src/apps/mobile/main.js',
      'README.md',
    ].join('\n');
    const taCO = h('textarea', { 'aria-label': 'Nội dung tệp CODEOWNERS', spellcheck: 'false', rows: 8 });
    taCO.value = CO;
    const taPR = h('textarea', { 'aria-label': 'Danh sách tệp trong pull request', spellcheck: 'false', rows: 8 });
    taPR.value = PR;
    taCO.addEventListener('input', render); taPR.addEventListener('input', render);
    const model = seg({ options: [{ value: 'strong', label: 'Strong' }, { value: 'weak', label: 'Weak' }, { value: 'collective', label: 'Collective' }], value: 'weak', onChange: render });
    const slDev = slider({ label: 'Số lập trình viên dùng chung repo', min: 5, max: 200, step: 5, value: 60, format: (v) => fmt(v), onInput: render });
    const tbody = h('tbody');
    const stRev = stat('Người/đội phải duyệt', '');
    const outsider = h('div', { class: 'box' });
    root.append(
      h('div', { class: 'lab-split' },
        h('div', h('label', { class: 'lab-note' }, 'CODEOWNERS'), taCO),
        h('div', h('label', { class: 'lab-note' }, 'Tệp trong pull request (mỗi dòng một tệp)'), taPR)),
      h('div', { class: 'table-wrap' }, h('table', { class: 'data' }, h('thead', h('tr', h('th', 'Tệp'), h('th', 'Mẫu khớp cuối cùng'), h('th', 'Chủ sở hữu'))), tbody)),
      h('div', { class: 'stats' }, stRev),
      h('div', { class: 'controls' }, h('div', { class: 'ctl' }, h('label', h('span', 'Mô hình sở hữu')), model.el), slDev.el),
      outsider);

    function toRegex(pat) {
      let p = pat.trim();
      const anchored = p.startsWith('/');
      if (anchored) p = p.slice(1);
      const dir = p.endsWith('/');
      if (dir) p = p.slice(0, -1);
      const body = p.split('').map((c) => (c === '*' ? '[^/]*' : /[.+?^${}()|[\]\\]/.test(c) ? '\\' + c : c)).join('');
      const hasSlash = p.includes('/');
      const prefix = anchored || (hasSlash && !dir) ? '^' : '(^|.*/)';
      const suffix = dir ? '/.*$' : '(/.*)?$';
      return new RegExp(prefix + body + suffix);
    }
    function parse() {
      return taCO.value.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => {
        const [pat, ...owners] = l.split(/\s+/);
        let re = null; try { re = toRegex(pat); } catch (e) { re = null; }
        return { pat, owners, re };
      }).filter((r) => r.re);
    }
    function render() {
      const rules = parse();
      const files = taPR.value.split('\n').map((l) => l.trim().replace(/^\//, '')).filter(Boolean).slice(0, 30);
      const owners = new Set();
      clear(tbody);
      files.forEach((f) => {
        let hit = null;
        rules.forEach((r) => { if (r.re.test(f)) hit = r; });
        if (hit) hit.owners.forEach((o) => owners.add(o));
        tbody.append(h('tr', { class: hit ? '' : 'hit' }, h('td', { class: 'ch6-mono' }, f), h('td', { class: 'ch6-mono' }, hit ? hit.pat : '—'),
          h('td', hit ? hit.owners.map((o) => pill(o, 'violet')) : h('span', { class: 'lab-note' }, 'không có chủ'))));
      });
      stRev.update(fmt(owners.size), owners.size <= 1 ? 'ok' : owners.size <= 2 ? 'warn' : 'bad', owners.size ? [...owners].join(', ') : 'không ai được yêu cầu tự động');
      const list = [...owners].join(', ') || 'không ai';
      const m = model.value, devs = slDev.value;
      const text = {
        strong: `Bạn không tự sửa các tệp này. Bạn nhờ ${list} thay đổi giúp.`,
        weak: `Bạn được sửa và mở pull request, nhưng phải có ${list} review và chấp nhận trước khi merge. GitHub tự yêu cầu họ review.`,
        collective: 'Ai cũng sửa được mọi tệp. CODEOWNERS (nếu có) chỉ mang tính thông báo.',
      }[m];
      const fit = m === 'collective' ? (devs <= 20 ? ['ok', 'Hợp: khoảng 20 người trở xuống'] : ['bad', 'Rủi ro: quá 20 người, ranh giới trách nhiệm mờ'])
        : (devs <= 20 ? ['warn', 'Có thể chặt hơn mức cần với nhóm nhỏ'] : ['ok', 'Hợp với nhóm lớn hơn 20 người']);
      clear(outsider).append(h('h5', 'Một lập trình viên ngoài đội muốn sửa PR này'), h('p', { style: { margin: '0 0 6px' } }, text), pill(fit[1], fit[0]));
    }
    render();
  });

  // ======================================================================
  // 6.13 — Where are you on the monorepo pain curve?
  // ======================================================================
  widget('ch6-repo-chooser', (root) => {
    const DEVS = [5, 10, 20, 50, 100, 200, 500, 1000, 3000, 10000, 30000];
    const slD = slider({ label: 'Số lập trình viên', min: 0, max: DEVS.length - 1, value: 4, format: (i) => fmt(DEVS[i]), onInput: render });
    const slT = slider({ label: 'Người chuyên làm công cụ build/repo', min: 0, max: 150, step: 5, value: 0, format: (v) => fmt(v), onInput: render });
    const cross = checkbox('Hay phải sửa nhiều service cùng lúc', false, render);
    const rec = h('div', { class: 'box' });
    const viz = h('div', { class: 'viz' });
    root.append(h('div', { class: 'controls' }, slD.el, slT.el, cross.el), viz, rec,
      h('div', { class: 'table-wrap' }, h('table', { class: 'data' }, h('thead', h('tr', h('th', 'Con số trong sách'), h('th', 'Ý nghĩa'))), h('tbody',
        h('tr', h('td', 'Hơn 100 người (2007–2008)'), h('td', 'Duy trì công cụ cho lập trình viên ở Google, phần lớn để xử lý hệ quả của monorepo')),
        h('tr', h('td', '95% (2016)'), h('td', 'Tỉ lệ mã của Google nằm trong monorepo, theo bài báo ACM')),
        h('tr', h('td', '~270 GB'), h('td', 'Thư mục làm việc đầy đủ của mã Windows trên Git, lý do Microsoft xây VFS for Git')),
        h('tr', h('td', '2016'), h('td', 'Năm GitHub bắt đầu hỗ trợ CODEOWNERS')),
        h('tr', h('td', '≤ 20 lập trình viên'), h('td', 'Ngưỡng tham khảo để Collective Ownership còn khả thi')),
        h('tr', h('td', '10–20 lập trình viên'), h('td', 'Quy mô monorepo dễ quản lý ranh giới sở hữu và giữ build đơn giản'))))));

    // minh hoạ: nhu cầu công cụ tăng theo log(devs) vượt ngưỡng 20; năng lực công cụ giảm đau
    function monoPain(devs, tooling) {
      const need = Math.max(0, Math.log10(devs / 20)) * 40; // 0 ở 20 người
      const capacity = tooling * 1.4 * Math.min(1, Math.log10(Math.max(devs, 10)) / 4);
      return clamp(10 + need - capacity, 5, 100);
    }
    const multiPain = (devs) => clamp(18 + Math.log10(devs / 5) * 6, 5, 100);
    function render() {
      const devs = DEVS[slD.value], tool = slT.value;
      const W = 620, H = 230, L = 46, R = 14, T = 16, B = 40;
      const svg = svgBox(W, H, 'Độ đau minh hoạ của monorepo và multi-repo theo số lập trình viên');
      const lx = (d) => L + (Math.log10(d / 5) / Math.log10(30000 / 5)) * (W - L - R);
      const y = (p) => H - B - (p / 100) * (H - T - B);
      [5, 20, 100, 1000, 10000].forEach((d) => svg.append(s('line', { x1: lx(d), x2: lx(d), y1: T, y2: H - B, class: 'grid' }), txt(lx(d), H - B + 14, fmt(d), { 'text-anchor': 'middle' })));
      [0, 50, 100].forEach((p) => svg.append(s('line', { x1: L, x2: W - R, y1: y(p), y2: y(p), class: 'grid' }), txt(L - 6, y(p) + 4, String(p), { 'text-anchor': 'end' })));
      // tooling scales with org size for the curve: assume same ratio as current point
      const ratio = tool / Math.max(devs, 1);
      let pm = '', pmu = '';
      for (let i = 0; i <= 60; i++) {
        const d = 5 * Math.pow(30000 / 5, i / 60);
        pm += (i ? 'L' : 'M') + lx(d) + ',' + y(monoPain(d, Math.min(150, ratio * d)));
        pmu += (i ? 'L' : 'M') + lx(d) + ',' + y(multiPain(d));
      }
      svg.append(s('path', { d: pmu, class: 'f-none s-violet', 'stroke-width': 2 }), s('path', { d: pm, class: 'f-none s-warn', 'stroke-width': 2.5 }));
      const mp = monoPain(devs, tool), up = multiPain(devs);
      svg.append(s('line', { x1: lx(devs), x2: lx(devs), y1: T, y2: H - B, class: 's-ink3 dash f-none' }),
        s('circle', { cx: lx(devs), cy: y(mp), r: 6, class: 'f-warn' }), s('circle', { cx: lx(devs), cy: y(up), r: 6, class: 'f-violet' }));
      svg.append(s('rect', { x: L + 8, y: T + 2, width: 12, height: 3, class: 'f-warn' }), txt(L + 24, T + 7, 'monorepo'),
        s('rect', { x: L + 100, y: T + 2, width: 12, height: 3, class: 'f-violet' }), txt(L + 116, T + 7, 'multi-repo'),
        txt(W - R, H - 6, 'số lập trình viên (thang log) →', { 'text-anchor': 'end' }), txt(6, T + 4, 'độ đau'));
      clear(viz).append(svg);

      let head, body, tone;
      if (devs <= 20) {
        head = 'Cách nào cũng được'; tone = 'ok';
        body = 'Với 10–20 lập trình viên, monorepo dễ quản lý ranh giới sở hữu và giữ build đơn giản; Collective Ownership còn khả thi. Multi-repo cũng ổn.';
      } else if (mp > up + 10) {
        head = 'Vùng giữa: monorepo bắt đầu đau'; tone = 'bad';
        body = 'Đủ lớn để cần công cụ và cách làm mới, nhưng chưa có nguồn lực để đầu tư. Multi-repo đơn giản hơn; per-team monorepo là phương án nửa đường nếu các đội làm Collective Ownership.';
      } else {
        head = 'Monorepo khả thi nhờ đầu tư công cụ'; tone = 'warn';
        body = 'Kiểu Google, Microsoft, Facebook, Twitter, Uber: công ty lớn, tập trung vào công nghệ, có nguồn lực riêng cho công cụ. Nhưng hãy tự hỏi tổ chức bạn có thật sự có vấn đề và nguồn lực kiểu Google không.';
      }
      clear(rec).append(h('h5', 'Gợi ý theo sách'), h('p', { style: { margin: '0 0 6px' } }, pill(head, tone)), h('p', { style: { margin: 0 } }, body),
        cross.value ? h('p', { style: { margin: '6px 0 0' } }, pill('Cảnh báo', 'warn'), ' Hay sửa nhiều service cùng lúc là dấu hiệu ranh giới sai. Monorepo làm việc này dễ hơn, nhưng không chữa được nguyên nhân.') : null,
        h('p', { class: 'lab-note', style: { margin: '6px 0 0' } }, 'Lựa chọn của Sam Newman: multi-repo. Đường cong là minh hoạ định tính, không phải số liệu đo.'));
    }
    render();
  });

  // ======================================================================
  // 6.★ — Scenario → advice map
  // ======================================================================
  widget('ch6-review-map', (root) => {
    const CASES = [
      { q: 'Nhánh tính năng sống ba tuần rồi mới merge', a: 'Chuyển sang Trunk-Based Development với feature flag; nếu dùng nhánh thì dưới một ngày.', t: 'ch6-branching', n: '6.3' },
      { q: 'Build đỏ từ hôm qua, mọi người vẫn đẩy tính năng mới', a: 'Dừng mọi check-in không phục vụ việc sửa build. Sửa build là ưu tiên số 1.', t: 'ch6-really-ci', n: '6.2' },
      { q: 'Phải đợi 50 phút mới biết sai một unit test', a: 'Tách build pipeline: test nhanh ở chặng đầu, test chậm ở chặng sau.', t: 'ch6-pipeline', n: '6.4' },
      { q: 'Build lại image trước khi lên production “cho chắc”', a: 'Build một lần, triển khai đúng artifact đã kiểm thử; cấu hình môi trường để bên ngoài.', t: 'ch6-artifacts', n: '6.7' },
      { q: 'Muốn mọi bản qua test tự động lên production ngay', a: 'Đó là Continuous Deployment, một tập con của Continuous Delivery; cần tự động hoá cả các chặng thủ công.', t: 'ch6-cd', n: '6.5' },
      { q: 'Mỗi tính năng đều phải sửa Inventory và Shipping cùng lúc', a: 'Dấu hiệu ranh giới sai. Cân nhắc gộp service thay vì tìm cách commit nguyên tử.', t: 'ch6-cross-repo', n: '6.10' },
      { q: 'Một repo, một build, năm đội dùng chung', a: 'Tách build theo service (multi-repo hoặc ánh xạ thư mục trong monorepo) để tránh chặn nhau và tránh triển khai tất cả.', t: 'ch6-giant-repo', n: '6.8' },
      { q: '“Google dùng monorepo nên ta cũng dùng”', a: 'Tổ chức của bạn có lẽ không có vấn đề và nguồn lực kiểu Google. Ở quy mô vừa, multi-repo hoặc per-team monorepo thực tế hơn.', t: 'ch6-monorepo-scale', n: '6.13' },
    ];
    const list = h('div', { class: 'btn-row ch6-cases' });
    const out = h('div', { class: 'box' });
    root.append(list, out);
    let cur = 0;
    function render() {
      clear(list).append(CASES.map((c, i) => h('button', { type: 'button', class: 'btn' + (i === cur ? '' : ' btn-ghost'), 'aria-pressed': String(i === cur), onClick: () => { cur = i; render(); } }, c.q)));
      const c = CASES[cur];
      clear(out).append(h('h5', 'Sách khuyên'), h('p', { style: { margin: '0 0 6px' } }, c.a), h('a', { href: '#' + c.t }, 'Xem lại chủ đề ' + c.n + ' →'));
    }
    render();
  });

  // ======================================================================
  glossary.add([
    { key: 'continuous-integration', term: 'Continuous Integration (CI)', vi: 'tích hợp liên tục', ch: 6, topic: 'ch6-ci-basics',
      def: 'Thực hành giữ mọi người đồng bộ bằng cách thường xuyên (ít nhất mỗi ngày) đưa mã vào mainline và tự động xác minh rằng mã mới tích hợp đúng với mã hiện có.' },
    { key: 'ci-server', term: 'CI server', vi: 'máy chủ CI', ch: 6, topic: 'ch6-ci-basics',
      def: 'Hệ thống phát hiện commit mới, lấy mã về, biên dịch, chạy test và thường tạo artifact. Ví dụ: Jenkins, CircleCI, Travis.' },
    { key: 'deployable-artifact', term: 'Deployable artifact', vi: 'artifact triển khai được', ch: 6, topic: 'ch6-artifacts',
      def: 'Khối được build ra để triển khai một phiên bản microservice (container image, gói, JAR…). Nên build đúng một lần và dùng lại ở mọi chặng.' },
    { key: 'artifact-repository', term: 'Artifact repository', vi: 'kho lưu artifact', ch: 6, topic: 'ch6-artifacts',
      def: 'Nơi lưu artifact đã build để các chặng sau dùng lại, như Artifactory, Nexus hoặc container registry, hoặc kho do công cụ CI cung cấp.' },
    { key: 'mainline', term: 'Mainline / trunk', vi: 'nhánh chính', ch: 6, topic: 'ch6-really-ci',
      def: 'Nhánh mã nguồn duy nhất mà mọi người tích hợp vào. CI đòi hỏi check-in vào mainline ít nhất mỗi ngày.' },
    { key: 'broken-build', term: 'Broken build (red build)', vi: 'build hỏng', ch: 6, topic: 'ch6-really-ci',
      def: 'Build thất bại, cho thấy thay đổi gần nhất có thể chưa tích hợp được. Sửa nó phải là ưu tiên số 1; để thay đổi chồng lên sẽ làm thời gian sửa tăng mạnh.' },
    { key: 'feature-branching', term: 'Feature branching', vi: 'mỗi tính năng một nhánh', ch: 6, topic: 'ch6-branching',
      def: 'Phát triển từng tính năng trên nhánh riêng. Cho phép làm việc tách biệt nhưng trì hoãn tích hợp, khiến lần merge sau phức tạp hơn.' },
    { key: 'trunk-based-development', term: 'Trunk-Based Development', vi: 'phát triển trên trunk', ch: 6, topic: 'ch6-branching',
      def: 'Mọi người check-in vào cùng một trunk, dùng feature flag để ẩn phần chưa xong. Cách Sam Newman ưu tiên, được dữ liệu DORA ủng hộ.' },
    { key: 'feature-flag', term: 'Feature flag', vi: 'cờ tính năng', ch: 6, topic: 'ch6-branching',
      def: 'Công tắc trong mã để ẩn hoặc bật một tính năng chưa hoàn thiện, cho phép merge sớm vào trunk. Cũng hữu ích cho progressive delivery.' },
    { key: 'state-of-devops', term: 'State of DevOps Report', vi: 'báo cáo State of DevOps', ch: 6, topic: 'ch6-branching',
      def: 'Nghiên cứu hằng năm của DORA (2016 cùng Puppet) về thực hành chuyển giao phần mềm. Bản 2016 gắn nhánh dưới một ngày, dưới ba nhánh mở và merge hằng ngày với hiệu năng cao.' },
    { key: 'gitflow', term: 'GitFlow', vi: 'mô hình nhánh GitFlow', ch: 6, topic: 'ch6-branching',
      def: 'Mô hình nhiều nhánh phổ biến trong mã nguồn mở, nơi có nhiều người đóng góp không tin cậy cần được nhóm nhỏ duyệt. Không nhất thiết hợp với đội sản phẩm thường ngày.' },
    { key: 'patch-bomb', term: 'Patch bomb', vi: 'patch khổng lồ', ch: 6, topic: 'ch6-branching',
      def: 'Một thay đổi rất lớn gửi lên cùng lúc. Khó và chậm review, chậm merge hơn so với nhiều patch nhỏ dễ đọc (State of DevOps 2019).' },
    { key: 'progressive-delivery', term: 'Progressive delivery', vi: 'phát hành dần', ch: 6, topic: 'ch6-branching',
      def: 'Các kỹ thuật phát hành phần mềm từng phần cho người dùng, thường dựa trên feature flag. Được bàn ở Chương 7.' },
    { key: 'build-pipeline', term: 'Build pipeline', vi: 'dây chuyền build', ch: 6, topic: 'ch6-pipeline',
      def: 'Build chia thành nhiều chặng nối tiếp (test nhanh, test chậm, hiệu năng, production). Chặng sau chỉ chạy khi chặng trước qua; cùng một artifact đi qua mọi chặng.' },
    { key: 'fast-feedback', term: 'Fast feedback', vi: 'phản hồi nhanh', ch: 6, topic: 'ch6-pipeline',
      def: 'Cho lập trình viên biết có vấn đề càng sớm càng tốt; biết sớm thì sửa nhanh. Lý do đặt test nhanh ở đầu pipeline.' },
    { key: 'continuous-delivery', term: 'Continuous Delivery (CD)', vi: 'chuyển giao liên tục', ch: 6, topic: 'ch6-cd',
      def: 'Nhận phản hồi liên tục về mức sẵn sàng production của mỗi check-in và coi mỗi check-in là release candidate. Có thể có người quyết định triển khai.' },
    { key: 'release-candidate', term: 'Release candidate', vi: 'ứng viên phát hành', ch: 6, topic: 'ch6-cd',
      def: 'Một phiên bản có thể được phát hành nếu qua các chặng kiểm tra. Trong CD, mọi check-in đều là release candidate.' },
    { key: 'continuous-deployment', term: 'Continuous Deployment', vi: 'triển khai liên tục', ch: 6, topic: 'ch6-cd',
      def: 'Mọi check-in được xác minh tự động và bản nào qua được thì tự lên production, không có người can thiệp. Là tập con của Continuous Delivery.' },
    { key: 'uat', term: 'User Acceptance Testing (UAT)', vi: 'kiểm thử chấp nhận người dùng', ch: 6, topic: 'ch6-cd',
      def: 'Chặng kiểm tra thủ công trong pipeline. Công cụ CD tốt cho phép triển khai bản build vào UAT và đánh dấu đạt để chặng sau tự chạy.' },
    { key: 'production-like-environment', term: 'Production-like environment', vi: 'môi trường giống production', ch: 6, topic: 'ch6-environments',
      def: 'Môi trường gần với production để tăng độ chắc chắn ở cuối pipeline. Càng giống thì càng chậm và đắt; phải cân bằng với phản hồi nhanh.' },
    { key: 'build-once', term: 'Build once', vi: 'build một lần', ch: 6, topic: 'ch6-artifacts',
      def: 'Quy tắc build artifact đúng một lần, sớm trong pipeline, rồi dùng lại cho mọi chặng đến production để artifact triển khai chính là artifact đã kiểm thử.' },
    { key: 'environment-agnostic', term: 'Environment-agnostic artifact', vi: 'artifact không phụ thuộc môi trường', ch: 6, topic: 'ch6-artifacts',
      def: 'Artifact không chứa cấu hình riêng của môi trường (ví dụ mức log DEBUG hay INFO); cấu hình được đưa vào từ bên ngoài.' },
    { key: 'lock-step-release', term: 'Lock-step release', vi: 'phát hành đồng loạt', ch: 6, topic: 'ch6-giant-repo',
      def: 'Triển khai nhiều service cùng lúc vì chúng phụ thuộc nhau. Mâu thuẫn với khả năng triển khai độc lập, nên tránh.' },
    { key: 'cycle-time', term: 'Cycle time', vi: 'thời gian chu trình', ch: 6, topic: 'ch6-giant-repo',
      def: 'Tốc độ đưa một thay đổi từ lúc phát triển đến lúc chạy thật. Build khổng lồ kiểm tra mọi service làm cycle time tăng.' },
    { key: 'multi-repo', term: 'Multi-repo (one repository per microservice)', vi: 'mỗi service một repo', ch: 6, topic: 'ch6-multi-repo',
      def: 'Mã mỗi microservice nằm trong repo riêng; thay đổi trong repo kích hoạt đúng build của service đó. Lựa chọn của Sam Newman khi mở rộng quy mô.' },
    { key: 'shared-library', term: 'Shared library', vi: 'thư viện dùng chung', ch: 6, topic: 'ch6-multi-repo',
      def: 'Mã dùng lại được đóng gói thành artifact có phiên bản (như thư viện Connection). Muốn tung bản mới phải build và triển khai lại mọi service dùng nó.' },
    { key: 'service-boundary', term: 'Service boundary', vi: 'ranh giới service', ch: 6, topic: 'ch6-cross-repo',
      def: 'Đường phân chia trách nhiệm giữa các microservice. Nếu thay đổi thường xuyên phải chạm nhiều service, ranh giới có lẽ đặt sai.' },
    { key: 'monorepo', term: 'Monorepo', vi: 'kho mã đơn khối', ch: 6, topic: 'ch6-monorepo',
      def: 'Mã của nhiều microservice hoặc dự án nằm chung một repo. Cho phép commit nguyên tử và dùng lại mã chi tiết, nhưng cần ánh xạ build và công cụ sở hữu.' },
    { key: 'atomic-commit', term: 'Atomic commit', vi: 'commit nguyên tử', ch: 6, topic: 'ch6-monorepo',
      def: 'Một commit thay đổi nhiều dự án cùng lúc. Có được trong monorepo, không có với Git xuyên nhiều repo. Không đồng nghĩa với triển khai nguyên tử.' },
    { key: 'independent-deployability', term: 'Independent deployability', vi: 'khả năng triển khai độc lập', ch: 6, topic: 'ch6-monorepo',
      def: 'Khả năng triển khai một microservice mà không phải triển khai service khác. Nguyên tắc cốt lõi mà mọi lựa chọn build và tổ chức mã cần bảo vệ.' },
    { key: 'graph-based-build', term: 'Graph-based build tool', vi: 'công cụ build theo đồ thị', ch: 6, topic: 'ch6-monorepo',
      def: 'Công cụ như Bazel phân tích phụ thuộc giữa các tệp để chỉ build và test lại phần bị ảnh hưởng. Cần cho monorepo lớn nhưng triển khai tốn công.' },
    { key: 'strong-ownership', term: 'Strong Ownership', vi: 'sở hữu chặt', ch: 6, topic: 'ch6-ownership',
      def: 'Mã thuộc về một nhóm cụ thể; người ngoài muốn thay đổi phải nhờ nhóm đó làm.' },
    { key: 'weak-ownership', term: 'Weak Ownership', vi: 'sở hữu lỏng', ch: 6, topic: 'ch6-ownership',
      def: 'Có chủ sở hữu, nhưng người ngoài được thay đổi nếu một người trong nhóm sở hữu review và chấp nhận, ví dụ qua pull request.' },
    { key: 'collective-ownership', term: 'Collective Ownership', vi: 'sở hữu tập thể', ch: 6, topic: 'ch6-ownership',
      def: 'Bất kỳ lập trình viên nào cũng được sửa bất kỳ mã nào. Khả thi với khoảng 20 người trở xuống.' },
    { key: 'codeowners', term: 'CODEOWNERS', vi: 'tệp khai báo chủ sở hữu mã', ch: 6, topic: 'ch6-ownership',
      def: 'Tệp của GitHub (hỗ trợ từ 2016) ánh xạ đường dẫn thư mục hoặc tệp tới chủ sở hữu; chủ sở hữu được tự động yêu cầu review pull request liên quan.' },
    { key: 'piper', term: 'Piper', vi: 'hệ thống quản lý mã của Google', ch: 6, topic: 'ch6-monorepo-scale',
      def: 'Hệ thống quản lý mã nguồn độc quyền Google tự xây khi Perforce không còn đáp ứng quy mô monorepo của họ.' },
    { key: 'vfs-for-git', term: 'VFS for Git (GVFS)', vi: 'hệ thống tệp ảo cho Git', ch: 6, topic: 'ch6-monorepo-scale',
      def: 'Hệ thống tệp ảo Microsoft xây để chỉ tải những tệp lập trình viên cần từ repo Windows khoảng 270 GB.' },
    { key: 'lerna', term: 'Lerna', vi: 'công cụ monorepo JavaScript', ch: 6, topic: 'ch6-monorepo-scale',
      def: 'Công cụ do đội làm Babel tạo ra, giúp sinh nhiều artifact có phiên bản từ cùng một repo.' },
    { key: 'per-team-monorepo', term: 'Per-team monorepo', vi: 'monorepo theo đội', ch: 6, topic: 'ch6-monorepo-scale',
      def: 'Mỗi đội có một monorepo chứa mọi microservice của đội. Giữ phần lớn lợi ích monorepo, tránh nhiều vấn đề ở quy mô lớn, khớp ranh giới sở hữu.' },
  ]);
})();
