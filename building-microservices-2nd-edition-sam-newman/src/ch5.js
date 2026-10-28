/* Chương 5 — Workflow: transactions, two-phase commit, sagas. */
(function () {
  const { h, s, clear, fmt, pct, rng, clamp, sleep, slider, seg, button, checkbox, stat, log,
          widget, glossary, reducedMotion, nextId } = window.DDIA;

  // ---------- shared helpers ----------
  const pill = (text, tone) => h('span', { class: 'pill' + (tone ? ' ' + tone : '') }, text);
  const verdict = (tone, title, ...body) => h('div', { class: 'verdict ' + (tone || '') }, h('b', title), ...body);
  function dataTable(cols, rows, isHit) {
    return h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
      h('thead', null, h('tr', null, cols.map((c) => h('th', null, c)))),
      h('tbody', null, rows.map((r, i) => h('tr', { class: isHit && isHit(i) ? 'hit' : null },
        r.map((c) => h('td', null, c instanceof Node ? c : String(c))))))));
  }
  function svgRoot(w, hh, label) { return s('svg', { viewBox: `0 0 ${w} ${hh}`, role: 'img', 'aria-label': label || '' }); }
  function arrowDefs(svg) {
    const id = nextId('c5ar');
    svg.appendChild(s('defs', null, s('marker', { id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
      s('path', { d: 'M0,0 L10,5 L0,10 z', class: 'f-ink3' }))));
    return id;
  }
  /** Rect node with a title and an optional subtitle. Returns {g, rect, title, sub}. */
  function node(x, y, w, hh, title, sub, cls) {
    const rect = s('rect', { x, y, width: w, height: hh, rx: 8, class: cls || 'f-surface s-line-w' });
    const t = s('text', { x: x + w / 2, y: y + (sub != null ? hh / 2 - 4 : hh / 2 + 4), 'text-anchor': 'middle', class: 'lbl-strong' }, title);
    const sb = s('text', { x: x + w / 2, y: y + hh / 2 + 12, 'text-anchor': 'middle', class: 'small' }, sub || '');
    const g = s('g', { class: 'node' }, rect, t, sb);
    return { g, rect, title: t, sub: sb };
  }
  /** Animate a dot along a straight line. `fast` skips the animation. */
  async function moveDot(svg, x1, y1, x2, y2, cls, ms, fast) {
    if (fast || reducedMotion) return;
    const c = s('circle', { cx: x1, cy: y1, r: 6, class: cls });
    svg.appendChild(c);
    const steps = 14;
    for (let i = 1; i <= steps; i++) {
      c.setAttribute('cx', x1 + (x2 - x1) * i / steps);
      c.setAttribute('cy', y1 + (y2 - y1) * i / steps);
      await sleep(ms / steps);
    }
    c.remove();
  }
  function codeHTML(lines) { return lines.join('\n'); }

  // =====================================================================
  // 5.1 ACID
  // =====================================================================
  widget('ch5-acid', (root) => {
    const on = { A: true, C: true, I: true, D: true };
    const NAMES = { A: 'Atomicity', C: 'Consistency', I: 'Isolation', D: 'Durability' };
    const NEED = { crash: 'A', invalid: 'C', concurrent: 'I', power: 'D' };
    const scen = seg({ label: 'Sự cố', value: 'crash', onChange: render, options: [
      { value: 'crash', label: 'Sập giữa hai lệnh' },
      { value: 'invalid', label: 'Ghi giá trị sai' },
      { value: 'concurrent', label: 'Đọc chen ngang' },
      { value: 'power', label: 'Mất điện sau COMMIT' },
    ] });
    const cbs = ['A', 'C', 'I', 'D'].map((k) => checkbox(NAMES[k], true, (v) => { on[k] = v; render(); }));
    const code = h('pre', { class: 'code' });
    const tables = h('div', { class: 'mini-tables' });
    const out = h('div');
    root.append(
      h('div', { class: 'controls' }, h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Sự cố xảy ra'), scen.el)),
      h('div', { class: 'controls' }, h('span', { class: 'lab-note' }, 'Thuộc tính đang bật:'), cbs.map((c) => c.el)),
      h('div', { class: 'lab-split' }, h('div', null, code), h('div', null, tables)),
      out);

    const K = (t) => `<span class="k">${t}</span>`, S = (t) => `<span class="s">'${t}'</span>`, N = (t) => `<span class="n">${t}</span>`, C = (t) => `<span class="c">-- ${t}</span>`;
    function sql(sc) {
      const status = sc === 'invalid' ? 'VERIFED' : 'VERIFIED';
      const lines = [K('BEGIN') + ';',
        `${K('UPDATE')} Customer ${K('SET')} status = ${S(status)} ${K('WHERE')} id = ${N(42)};`];
      if (sc === 'crash') lines.push('<mark>' + C('tiến trình sập ở đây') + '</mark>');
      if (sc === 'concurrent') lines.push('<mark>' + C('giao dịch khác: SELECT * FROM PendingEnrollments JOIN Customer…') + '</mark>');
      lines.push(`${K('DELETE FROM')} PendingEnrollments ${K('WHERE')} customer_id = ${N(42)};`, K('COMMIT') + ';');
      if (sc === 'power') lines.push('<mark>' + C('mất điện ngay sau khi báo commit thành công') + '</mark>');
      if (sc === 'invalid') lines.push(C('ràng buộc: status IN (PENDING, VERIFIED)'));
      return codeHTML(lines);
    }
    function outcome(sc, ok) {
      switch (sc) {
        case 'crash': return ok
          ? { cust: 'PENDING', pend: true, tone: 'ok', title: 'Atomicity cứu bạn', msg: 'Giao dịch bị huỷ cả khối: như thể chưa có gì xảy ra. Chạy lại thao tác là đủ.' }
          : { cust: 'VERIFIED', pend: true, tone: 'bad', title: 'Trạng thái nửa vời', msg: 'Khách đã VERIFIED nhưng vẫn nằm trong PendingEnrollments. Không ai biết thao tác dừng ở đâu.' };
        case 'invalid': return ok
          ? { cust: 'PENDING', pend: true, tone: 'ok', title: 'Consistency chặn dữ liệu sai', msg: 'Ràng buộc từ chối giá trị VERIFED, giao dịch bị huỷ; database vẫn hợp lệ.' }
          : { cust: 'VERIFED', pend: false, tone: 'bad', title: 'Database ở trạng thái không hợp lệ', msg: 'Giá trị VERIFED lọt vào bảng. Mọi truy vấn tìm VERIFIED sẽ bỏ sót khách này.' };
        case 'concurrent': return ok
          ? { cust: 'VERIFIED', pend: false, tone: 'ok', title: 'Isolation che trạng thái trung gian', msg: 'Truy vấn chen ngang chỉ thấy ảnh chụp trước giao dịch (PENDING, còn trong danh sách chờ) — nhất quán.', seen: 'PENDING + có trong danh sách chờ' }
          : { cust: 'VERIFIED', pend: false, tone: 'bad', title: 'Có người nhìn thấy trạng thái trung gian', msg: 'Truy vấn chen ngang thấy khách đã VERIFIED nhưng vẫn trong danh sách chờ — một báo cáo mâu thuẫn.', seen: 'VERIFIED + vẫn trong danh sách chờ' };
        case 'power': return ok
          ? { cust: 'VERIFIED', pend: false, tone: 'ok', title: 'Durability giữ lời hứa', msg: 'Sau khi khởi động lại, thay đổi đã commit vẫn còn nguyên.' }
          : { cust: 'PENDING', pend: true, tone: 'bad', title: 'Commit đã báo thành công nhưng dữ liệu mất', msg: 'Ứng dụng đã báo khách "xác minh xong", nhưng sau khi khởi động lại mọi thứ quay về PENDING.' };
      }
      return null;
    }
    function render() {
      const sc = scen.value, need = NEED[sc], r = outcome(sc, on[need]);
      code.innerHTML = sql(sc);
      clear(tables).append(
        h('div', null, h('div', { class: 'lab-note' }, 'Bảng Customer (sau sự cố)'),
          dataTable(['id', 'status'], [[42, h('span', { class: 'pill ' + (r.cust === 'VERIFIED' ? 'ok' : r.cust === 'PENDING' ? '' : 'bad') }, r.cust)]])),
        h('div', null, h('div', { class: 'lab-note' }, 'Bảng PendingEnrollments'),
          dataTable(['customer_id'], [[r.pend ? '42' : '(trống)']])),
        r.seen ? h('div', null, h('div', { class: 'lab-note' }, 'Giao dịch chen ngang nhìn thấy'), h('div', { class: 'box' }, r.seen)) : null);
      clear(out).append(verdict(r.tone, r.title + ' ', pill('cần ' + NAMES[need], 'violet'), h('p', null, r.msg)));
    }
    render();
  });

  // =====================================================================
  // 5.2 One DB vs two DBs
  // =====================================================================
  widget('ch5-split', (root) => {
    const arch = seg({ value: 'two', onChange: render, options: [{ value: 'one', label: 'Một database (Hình 5-1)' }, { value: 'two', label: 'Hai database (Hình 5-2)' }] });
    const fail = seg({ value: 'pending', onChange: render, options: [{ value: 'none', label: 'Không lỗi' }, { value: 'customer', label: 'Lỗi khi cập nhật Customer' }, { value: 'pending', label: 'Lỗi khi xoá PendingEnrollments' }] });
    const seq = checkbox('Sắp thứ tự: chỉ xoá khi đã cập nhật được Customer', true, render);
    const viz = h('div', { class: 'viz' });
    const tables = h('div', { class: 'mini-tables' });
    const out = h('div');
    root.append(
      h('div', { class: 'controls' },
        h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Kiến trúc'), arch.el),
        h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Điểm hỏng'), fail.el)),
      h('div', { class: 'controls' }, seq.el),
      viz, tables, out);

    function simulate() {
      const a = arch.value, f = fail.value, sq = seq.value;
      // per-step result: 'ok' | 'fail' | 'skip' | 'aborted'
      let c, p;
      if (a === 'one') {
        if (f === 'none') { c = 'ok'; p = 'ok'; } else { c = f === 'customer' ? 'fail' : 'aborted'; p = f === 'pending' ? 'fail' : 'aborted'; }
      } else {
        c = f === 'customer' ? 'fail' : 'ok';
        if (f === 'pending') p = 'fail';
        else if (f === 'customer' && sq) p = 'skip';
        else p = 'ok';
      }
      const cust = c === 'ok' ? 'VERIFIED' : 'PENDING';
      const pend = p !== 'ok';
      return { a, f, c, p, cust, pend };
    }
    const TONE = { ok: 'f-ok-soft s-ok-w', fail: 'f-bad-soft s-bad-w', skip: 'f-surface2 s-line-w', aborted: 'f-warn-soft s-mark-w' };
    const WORD = { ok: 'đã commit', fail: 'thất bại', skip: 'không chạy', aborted: 'bị huỷ theo' };
    function draw(r) {
      const svg = svgRoot(560, 170, 'Phạm vi giao dịch');
      if (r.a === 'one') {
        svg.append(s('rect', { x: 20, y: 18, width: 520, height: 134, rx: 10, class: 'f-none s-accent-w dash' }),
          s('text', { x: 32, y: 36, class: 'lbl-strong' }, 'Một giao dịch ACID · một database'));
        const n1 = node(50, 58, 210, 70, 'Customer', 'status → VERIFIED · ' + WORD[r.c], TONE[r.c]);
        const n2 = node(300, 58, 210, 70, 'PendingEnrollments', 'xoá dòng · ' + WORD[r.p], TONE[r.p]);
        svg.append(n1.g, n2.g);
      } else {
        svg.append(s('rect', { x: 14, y: 18, width: 258, height: 134, rx: 10, class: 'f-none s-violet-w dash' }),
          s('rect', { x: 288, y: 18, width: 258, height: 134, rx: 10, class: 'f-none s-violet-w dash' }),
          s('text', { x: 26, y: 36, class: 'lbl-strong' }, 'Giao dịch 1 · DB của Customer'),
          s('text', { x: 300, y: 36, class: 'lbl-strong' }, 'Giao dịch 2 · DB của Enrollment'));
        const n1 = node(38, 58, 210, 70, 'Customer', 'status → VERIFIED · ' + WORD[r.c], TONE[r.c]);
        const n2 = node(312, 58, 210, 70, 'PendingEnrollments', 'xoá dòng · ' + WORD[r.p], TONE[r.p]);
        svg.append(n1.g, n2.g);
        if (seq.value) {
          const id = arrowDefs(svg);
          svg.append(s('line', { x1: 250, y1: 93, x2: 308, y2: 93, class: 's-ink3', 'marker-end': `url(#${id})` }),
            s('text', { x: 280, y: 145, 'text-anchor': 'middle', class: 'small' }, 'nếu 1 thành công'));
        }
      }
      clear(viz).append(svg);
    }
    function render() {
      const r = simulate();
      seq.input.disabled = r.a === 'one';
      draw(r);
      clear(tables).append(
        h('div', null, h('div', { class: 'lab-note' }, 'Customer'), dataTable(['id', 'status'], [[42, pill(r.cust, r.cust === 'VERIFIED' ? 'ok' : '')]])),
        h('div', null, h('div', { class: 'lab-note' }, 'PendingEnrollments'), dataTable(['customer_id'], [[r.pend ? '42' : '(trống)']])));
      const consistent = (r.cust === 'VERIFIED') === !r.pend;
      let v;
      if (consistent && r.f === 'none') v = verdict('ok', 'Nhất quán', h('p', null, 'Không có lỗi: cả hai thay đổi đều được ghi.'));
      else if (consistent && r.a === 'one') v = verdict('ok', 'Nhất quán nhờ atomicity', h('p', null, 'Một bước hỏng kéo theo cả giao dịch bị huỷ. Hai bảng vẫn khớp nhau.'));
      else if (consistent) v = verdict('ok', 'Nhất quán nhờ sắp thứ tự', h('p', null, 'Bước 1 hỏng nên bước 2 không chạy. Lần này may — nhưng đó là logic bạn tự viết, không phải database bảo đảm.'));
      else if (r.cust === 'VERIFIED') v = verdict('bad', 'Bất nhất: khách đã VERIFIED nhưng vẫn trong danh sách chờ', h('p', null, 'Giao dịch 1 đã commit và không thể rollback tự động. Bạn phải tự quyết: thử xoá lại (tiến) hay đổi khách về PENDING (lùi)?'));
      else v = verdict('bad', 'Bất nhất: khách biến khỏi danh sách chờ nhưng vẫn PENDING', h('p', null, 'Hai giao dịch chạy độc lập; một cái commit, một cái hỏng. Khách bị "kẹt" giữa hai trạng thái.'));
      clear(out).append(v);
    }
    render();
  });

  // =====================================================================
  // 5.3 Two-phase commit step by step
  // =====================================================================
  widget('ch5-2pc', (root) => {
    const voteA = seg({ value: 'yes', options: [{ value: 'yes', label: 'Đồng ý' }, { value: 'no', label: 'Từ chối' }], onChange: () => run(true) });
    const voteB = seg({ value: 'yes', options: [{ value: 'yes', label: 'Đồng ý' }, { value: 'no', label: 'Từ chối' }], onChange: () => run(true) });
    const runBtn = button('Chạy 2PC', () => run(false));
    const sPhase = stat('Pha', '—'), sLocks = stat('Khoá đang giữ', '0'), sRes = stat('Kết quả', '—');
    const lg = log();
    const viz = h('div', { class: 'viz' });
    root.append(
      h('div', { class: 'controls' },
        h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Phiếu của Worker A (Customer)'), voteA.el),
        h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Phiếu của Worker B (PendingEnrollments)'), voteB.el)),
      h('div', { class: 'btn-row' }, runBtn),
      viz, h('div', { class: 'stats' }, sPhase, sLocks, sRes), lg);

    const svg = svgRoot(560, 290, 'Sơ đồ two-phase commit');
    const ar = arrowDefs(svg);
    const co = node(190, 14, 180, 54, 'Coordinator', 'chờ', 'f-violet-soft s-violet-w');
    const wa = node(30, 196, 210, 70, 'Worker A', 'Customer #42: PENDING');
    const wb = node(320, 196, 210, 70, 'Worker B', 'PendingEnrollments: 1 dòng');
    const lockA = s('g', null, s('rect', { x: 186, y: 184, width: 58, height: 22, rx: 5, class: 'f-mark s-mark' }), s('text', { x: 215, y: 199, 'text-anchor': 'middle', class: 'lbl-strong' }, 'KHOÁ'));
    const lockB = s('g', null, s('rect', { x: 476, y: 184, width: 58, height: 22, rx: 5, class: 'f-mark s-mark' }), s('text', { x: 505, y: 199, 'text-anchor': 'middle', class: 'lbl-strong' }, 'KHOÁ'));
    const phaseT = s('text', { x: 280, y: 130, 'text-anchor': 'middle', class: 'lbl-strong' }, '');
    const msgT = s('text', { x: 280, y: 148, 'text-anchor': 'middle' }, '');
    svg.append(
      s('line', { x1: 250, y1: 68, x2: 135, y2: 192, class: 's-ink3', 'marker-end': `url(#${ar})` }),
      s('line', { x1: 310, y1: 68, x2: 425, y2: 192, class: 's-ink3', 'marker-end': `url(#${ar})` }),
      co.g, wa.g, wb.g, lockA, lockB, phaseT, msgT);
    viz.append(svg);

    let gen = 0;
    const W = { A: { n: wa, lock: lockA, x: 135, y: 196 }, B: { n: wb, lock: lockB, x: 425, y: 196 } };
    async function run(fast) {
      const my = ++gen;
      const wait = (ms) => (fast ? Promise.resolve() : sleep(ms));
      const alive = () => my === gen;
      runBtn.disabled = !fast;
      lg.reset();
      const locks = { A: false, B: false };
      const showLocks = () => { lockA.style.display = locks.A ? '' : 'none'; lockB.style.display = locks.B ? '' : 'none'; sLocks.update(String(+locks.A + +locks.B), locks.A || locks.B ? 'warn' : null); };
      wa.sub.textContent = 'Customer #42: PENDING'; wb.sub.textContent = 'PendingEnrollments: 1 dòng';
      wa.rect.setAttribute('class', 'f-surface s-line-w'); wb.rect.setAttribute('class', 'f-surface s-line-w');
      showLocks(); sRes.update('—'); co.sub.textContent = 'đang hỏi phiếu';
      phaseT.textContent = 'Pha 1 · Bỏ phiếu'; msgT.textContent = 'PREPARE →'; sPhase.update('1 · Bỏ phiếu', 'accent');
      lg.add('Pha 1: coordinator gửi PREPARE tới Worker A và Worker B', 'acc');
      await Promise.all(['A', 'B'].map((k) => moveDot(svg, 280, 68, W[k].x, W[k].y, 'f-accent', 600, fast)));
      if (!alive()) return;
      const votes = { A: voteA.value, B: voteB.value };
      for (const k of ['A', 'B']) {
        if (votes[k] === 'yes') {
          locks[k] = true;
          lg.add(`Worker ${k} khoá ${k === 'A' ? 'dòng Customer #42' : 'dòng PendingEnrollments'} để giữ lời hứa → ĐỒNG Ý`, 'warn');
        } else lg.add(`Worker ${k} → TỪ CHỐI (thay đổi vi phạm điều kiện cục bộ)`, 'bad');
        showLocks();
        await wait(250); if (!alive()) return;
      }
      msgT.textContent = '← phiếu';
      await Promise.all(['A', 'B'].map((k) => moveDot(svg, W[k].x, W[k].y, 280, 68, votes[k] === 'yes' ? 'f-ok' : 'f-bad', 600, fast)));
      if (!alive()) return;
      const allYes = votes.A === 'yes' && votes.B === 'yes';
      if (allYes) {
        phaseT.textContent = 'Pha 2 · Commit'; msgT.textContent = 'COMMIT →'; sPhase.update('2 · Commit', 'accent'); co.sub.textContent = 'mọi phiếu thuận';
        lg.add('Pha 2: mọi worker đồng ý → coordinator gửi COMMIT', 'acc');
        await moveDot(svg, 280, 68, W.A.x, W.A.y, 'f-ok', 500, fast); if (!alive()) return;
        wa.sub.textContent = 'Customer #42: VERIFIED'; wa.rect.setAttribute('class', 'f-ok-soft s-ok-w'); locks.A = false; showLocks();
        lg.add('Worker A áp dụng thay đổi, nhả khoá. Worker B CHƯA nhận commit — bên ngoài đang thấy trạng thái trung gian!', 'warn');
        await wait(700); if (!alive()) return;
        await moveDot(svg, 280, 68, W.B.x, W.B.y, 'f-ok', 500, fast); if (!alive()) return;
        wb.sub.textContent = 'PendingEnrollments: 0 dòng'; wb.rect.setAttribute('class', 'f-ok-soft s-ok-w'); locks.B = false; showLocks();
        lg.add('Worker B áp dụng thay đổi, nhả khoá. Giao dịch hoàn tất.', 'ok');
        sRes.update('Đã commit', 'ok'); co.sub.textContent = 'hoàn tất';
      } else {
        phaseT.textContent = 'Pha 2 · Rollback'; msgT.textContent = 'ROLLBACK →'; sPhase.update('2 · Rollback', 'warn'); co.sub.textContent = 'có phiếu chống';
        lg.add('Có worker từ chối → coordinator gửi ROLLBACK tới mọi bên', 'bad');
        await Promise.all(['A', 'B'].map((k) => moveDot(svg, 280, 68, W[k].x, W[k].y, 'f-bad', 600, fast)));
        if (!alive()) return;
        for (const k of ['A', 'B']) if (locks[k]) { locks[k] = false; lg.add(`Worker ${k} dọn dẹp cục bộ và nhả khoá`, 't'); }
        showLocks();
        sRes.update('Đã huỷ', 'bad'); co.sub.textContent = 'đã huỷ';
      }
      runBtn.disabled = false;
    }
    run(true);
  });

  // =====================================================================
  // 5.4 2PC timeline: lock spans and inconsistency window
  // =====================================================================
  widget('ch5-2pc-timeline', (root) => {
    let seed = 7;
    const nSl = slider({ label: 'Số worker', min: 2, max: 8, value: 3, onInput: render });
    const latSl = slider({ label: 'Độ trễ mạng trung bình', min: 5, max: 200, step: 5, value: 40, format: (v) => v + ' ms', onInput: render });
    const silent = checkbox('Worker cuối im lặng sau khi bỏ phiếu', false, render);
    const reseed = button('Gieo lại độ trễ', () => { seed++; render(); }, 'ghost');
    const viz = h('div', { class: 'viz' });
    const sT = stat('Coordinator quyết định lúc', '—'), sWin = stat('Cửa sổ bất nhất', '—'), sMax = stat('Khoá giữ lâu nhất', '—'), sSum = stat('Tổng thời gian khoá', '—');
    const out = h('div');
    root.append(h('div', { class: 'controls' }, nSl.el, latSl.el), h('div', { class: 'controls' }, silent.el, reseed),
      viz, h('div', { class: 'stats' }, sT, sWin, sMax, sSum), out,
      h('p', { class: 'lab-note' }, 'Số liệu minh hoạ: mỗi chặng mạng lấy ngẫu nhiên trong khoảng 0,5–1,5 lần độ trễ trung bình; mỗi worker xử lý 2–12 ms.'));

    function render() {
      const n = nSl.value, lat = latSl.value, r = rng(seed * 101 + n);
      const leg = () => lat * (0.5 + r());
      const proc = () => 2 + r() * 10;
      const ws = [];
      for (let i = 0; i < n; i++) { const p = leg(); const lockAt = p + proc(); const v = lockAt + leg(); ws.push({ p, lockAt, v }); }
      const T = Math.max(...ws.map((w) => w.v));
      ws.forEach((w, i) => { w.c = T + leg(); w.a = w.c + proc(); w.silent = silent.value && i === n - 1; });
      const applied = ws.filter((w) => !w.silent).map((w) => w.a);
      const maxA = Math.max(...applied), minA = Math.min(...applied);
      const tEnd = Math.max(maxA, T) * 1.18;

      const W = 560, L = 84, R = 16, top = 26, rowH = 28, H = top + n * rowH + 44;
      const x = (t) => L + (t / tEnd) * (W - L - R);
      const svg = svgRoot(W, H, 'Dòng thời gian two-phase commit');
      // axis + ticks
      const step = niceStep(tEnd / 5);
      for (let t = 0; t <= tEnd; t += step) {
        svg.append(s('line', { x1: x(t), y1: top - 6, x2: x(t), y2: top + n * rowH, class: 'grid' }),
          s('text', { x: x(t), y: top + n * rowH + 16, 'text-anchor': 'middle' }, fmt(t) + ''));
      }
      svg.append(s('text', { x: (L + W - R) / 2, y: H - 6, 'text-anchor': 'middle' }, 'thời gian từ lúc gửi PREPARE (ms)'));
      // inconsistency window
      if (!silent.value) svg.append(s('rect', { x: x(minA), y: top - 6, width: Math.max(1, x(maxA) - x(minA)), height: n * rowH + 6, class: 'f-bad-soft' }));
      else svg.append(s('rect', { x: x(minA), y: top - 6, width: x(tEnd) - x(minA), height: n * rowH + 6, class: 'f-bad-soft' }));
      // decision line
      svg.append(s('line', { x1: x(T), y1: top - 10, x2: x(T), y2: top + n * rowH, class: 's-violet dash', 'stroke-width': 1.5 }),
        s('text', { x: x(T) + 4, y: top - 12, class: 'small' }, 'quyết định commit'));
      ws.forEach((w, i) => {
        const y = top + i * rowH + rowH / 2;
        svg.append(s('text', { x: L - 8, y: y + 4, 'text-anchor': 'end', class: 'lbl-strong' }, 'Worker ' + String.fromCharCode(65 + i)));
        svg.append(s('line', { x1: x(0), y1: y, x2: x(w.lockAt), y2: y, class: 's-line', 'stroke-width': 1.5 }));
        const end = w.silent ? tEnd : w.a;
        svg.append(s('rect', { x: x(w.lockAt), y: y - 7, width: Math.max(1, x(end) - x(w.lockAt)), height: 14, rx: 3, class: w.silent ? 'f-bad s-bad' : 'f-mark-soft s-mark' }));
        if (w.silent) svg.append(s('text', { x: x(tEnd) - 4, y: y + 4, 'text-anchor': 'end', class: 'lbl-strong' }, 'khoá treo ?'));
        else svg.append(s('circle', { cx: x(w.a), cy: y, r: 4.5, class: 'f-ok' }));
      });
      clear(viz).append(svg);

      const holds = ws.filter((w) => !w.silent).map((w) => w.a - w.lockAt);
      sT.update(fmt(T) + ' ms', null, 'sau khi nhận đủ ' + n + ' phiếu');
      if (silent.value) {
        sWin.update('không xác định', 'bad', 'một worker chưa bao giờ commit');
        sMax.update('∞', 'bad', 'đến khi có người gỡ tay');
        sSum.update('∞', 'bad');
        clear(out).append(verdict('bad', 'Worker im lặng: hệ thống kẹt', h('p', null, 'Coordinator đã quyết định commit, các worker khác đã áp dụng, nhưng worker cuối giữ khoá và không trả lời. Không thể rollback những gì đã commit, cũng không chắc worker kia sẽ commit — cần người can thiệp.')));
      } else {
        const win = maxA - minA;
        sWin.update(fmt(win) + ' ms', win > lat ? 'bad' : 'warn', 'A thấy thay đổi, B chưa thấy');
        sMax.update(fmt(Math.max(...holds)) + ' ms', 'warn', '≈ ' + fmt(Math.max(...holds) / lat, 1) + ' × độ trễ');
        sSum.update(fmt(holds.reduce((a, b) => a + b, 0)) + ' ms', null, 'cộng dồn trên ' + n + ' worker');
        clear(out).append(verdict('warn', 'Khoá kéo dài ít nhất ba chặng mạng',
          h('p', null, 'Mỗi worker khoá từ lúc bỏ phiếu đến khi nhận commit, và coordinator phải chờ phiếu chậm nhất. Thêm worker hoặc tăng độ trễ, mọi khoá đều dài ra — vùng đỏ là lúc người ngoài có thể thấy trạng thái trung gian.')));
      }
    }
    function niceStep(raw) { const p = Math.pow(10, Math.floor(Math.log10(raw))); const m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
    render();
  });

  // =====================================================================
  // 5.5 Just say no — decision helper
  // =====================================================================
  widget('ch5-decide', (root) => {
    const q1 = seg({ value: 'yes', onChange: render, options: [{ value: 'yes', label: 'Có' }, { value: 'no', label: 'Không' }] });
    const q2 = seg({ value: 'no', onChange: render, options: [{ value: 'yes', label: 'Có' }, { value: 'no', label: 'Không' }] });
    const q3 = seg({ value: 'no', onChange: render, options: [{ value: 'yes', label: 'Có, bắt buộc' }, { value: 'no', label: 'Chưa cần' }] });
    const q4 = seg({ value: 'min', onChange: render, options: [{ value: 'ms', label: 'Vài mili giây' }, { value: 'min', label: 'Phút đến giờ' }, { value: 'day', label: 'Ngày đến tháng' }] });
    const qi = (label, ctl) => h('div', { class: 'qitem' }, h('span', null, label), ctl.el);
    const cards = h('div', { class: 'stats' });
    const out = h('div');
    root.append(h('div', { class: 'q-grid' },
      qi('1. Phần trạng thái này cần thay đổi nguyên tử và nhất quán tuyệt đối?', q1),
      qi('2. Có cách hợp lý để đạt điều đó mà không cần giao dịch ACID?', q2),
      qi('3. Có bắt buộc phải tách dữ liệu này ngay bây giờ?', q3),
      qi('4. Thao tác nghiệp vụ kéo dài bao lâu?', q4)), cards, out);

    function render() {
      const needAtomic = q1.value === 'yes' && q2.value === 'no';
      const mustSplit = q3.value === 'yes';
      const dur = q4.value;
      q2.el.style.opacity = q1.value === 'yes' ? '' : '.45';
      let keep, saga;
      const reasons = [];
      if (needAtomic && !mustSplit) {
        keep = ['Khuyến nghị', 'ok']; saga = ['Để sau', null];
        reasons.push('Bạn cần atomicity thật và chưa phải tách: để trạng thái này trong một database, do một service (hoặc monolith) quản lý.');
        reasons.push('Đang tách monolith? Làm phần khác của hệ thống trước, quay lại phần này sau.');
      } else if (needAtomic && mustSplit) {
        keep = ['Xem lại ranh giới', 'warn']; saga = ['Khuyến nghị, có điều kiện', 'warn'];
        reasons.push('Vùng khó nhất: cần atomicity nhưng buộc phải tách. Hãy kiểm tra lại ranh giới — có thể hai phần dữ liệu này thuộc cùng một service.');
        reasons.push('Nếu vẫn tách: dùng saga, chấp nhận mất atomicity ở cấp tổng thể và mô hình hoá tường minh các trạng thái trung gian cùng giao dịch bù trừ.');
      } else {
        keep = ['Không cần thiết', null]; saga = ['Khuyến nghị', 'ok'];
        reasons.push('Không đòi atomicity tuyệt đối (hoặc có cách khác để đạt nó): tách dữ liệu và điều phối bằng saga.');
      }
      let two = ['Tránh', 'bad'];
      if (dur === 'ms') reasons.push('Thao tác rất ngắn là trường hợp duy nhất 2PC "chịu được" — nhưng nó vẫn khoá phân tán, mất isolation và có ca hỏng phải gỡ tay. Sam vẫn khuyên tránh.');
      else reasons.push(`Thao tác kéo dài ${dur === 'min' ? 'hàng phút đến hàng giờ' : 'hàng ngày đến hàng tháng'}: 2PC sẽ khoá tài nguyên suốt chừng ấy thời gian — loại khỏi danh sách.`);
      clear(cards).append(
        stat('Không tách dữ liệu', keep[0], keep[1], 'một DB, một service'),
        stat('Saga', saga[0], saga[1], 'chuỗi giao dịch cục bộ'),
        stat('Giao dịch phân tán (2PC)', two[0], two[1], 'Just say no'));
      clear(out).append(verdict(needAtomic && !mustSplit ? 'accent' : 'ok', 'Lập luận', h('ul', null, reasons.map((t) => h('li', null, t)))));
    }
    render();
  });

  // =====================================================================
  // 5.6 LLT lock contention
  // =====================================================================
  widget('ch5-llt', (root) => {
    const RES = ['Stock', 'Reservation', 'Payment', 'Points', 'Package', 'Shipment'];
    const kSl = slider({ label: 'Số giao dịch con', min: 1, max: 6, value: 3, format: (v) => v === 1 ? '1 (một giao dịch dài)' : v + ' (saga)', onInput: render });
    const dSl = slider({ label: 'Thời lượng cả quy trình', min: 10, max: 240, step: 10, value: 60, format: (v) => v + ' phút', onInput: render });
    const qSl = slider({ label: 'Request khác mỗi giờ', min: 10, max: 200, step: 10, value: 60, onInput: render });
    const viz = h('div', { class: 'viz' });
    const sLock = stat('Phút-khoá', '—'), sBlk = stat('Request phải chờ', '—'), sWait = stat('Thời gian chờ TB', '—'), sCmp = stat('So với 1 giao dịch dài', '—');
    root.append(h('div', { class: 'controls' }, kSl.el, dSl.el, qSl.el), viz, h('div', { class: 'stats' }, sLock, sBlk, sWait, sCmp),
      h('p', { class: 'lab-note' }, 'Số liệu minh hoạ. Mỗi tài nguyên (bảng) thuộc về đúng một giao dịch con; giao dịch con chỉ khoá tài nguyên của mình trong lát thời gian của nó. Chấm đỏ = request phải chờ khoá.'));

    function simulate(k, D, perHour, seed) {
      const R = RES.length, r = rng(seed);
      const spans = RES.map((_, i) => { const g = Math.floor(i * k / R); return { g, from: g * D / k, to: (g + 1) * D / k }; });
      const count = Math.round(perHour * D / 60);
      const reqs = [];
      for (let i = 0; i < count; i++) {
        const t = r() * D, res = Math.floor(r() * R), sp = spans[res];
        const wait = t >= sp.from && t < sp.to ? sp.to - t : 0;
        reqs.push({ t, res, wait });
      }
      const lockMin = spans.reduce((a, sp) => a + (sp.to - sp.from), 0);
      const blocked = reqs.filter((q) => q.wait > 0);
      const avgWait = reqs.length ? reqs.reduce((a, q) => a + q.wait, 0) / reqs.length : 0;
      return { spans, reqs, lockMin, blocked: blocked.length, avgWait };
    }
    function render() {
      const k = kSl.value, D = dSl.value, q = qSl.value;
      const cur = simulate(k, D, q, 42), base = simulate(1, D, q, 42);
      const W = 560, L = 92, Rm = 14, top = 14, rowH = 28, H = top + RES.length * rowH + 40;
      const x = (t) => L + t / D * (W - L - Rm);
      const svg = svgRoot(W, H, 'Khoá theo thời gian');
      for (let i = 0; i <= 4; i++) {
        const t = D * i / 4;
        svg.append(s('line', { x1: x(t), y1: top, x2: x(t), y2: top + RES.length * rowH, class: 'grid' }),
          s('text', { x: x(t), y: top + RES.length * rowH + 15, 'text-anchor': 'middle' }, fmt(t)));
      }
      svg.append(s('text', { x: (L + W - Rm) / 2, y: H - 4, 'text-anchor': 'middle' }, 'thời gian (phút)'));
      RES.forEach((name, i) => {
        const y = top + i * rowH, sp = cur.spans[i];
        svg.append(s('text', { x: L - 8, y: y + rowH / 2 + 4, 'text-anchor': 'end' }, name),
          s('rect', { x: x(sp.from), y: y + 5, width: Math.max(1, x(sp.to) - x(sp.from)), height: rowH - 10, rx: 3, class: k === 1 ? 'f-bad-soft s-bad' : 'f-mark-soft s-mark' }));
      });
      cur.reqs.forEach((qq) => {
        const y = top + qq.res * rowH + rowH / 2;
        if (qq.wait > 0) svg.append(s('line', { x1: x(qq.t), y1: y, x2: x(qq.t + qq.wait), y2: y, class: 's-bad', 'stroke-width': 1 }));
        svg.append(s('circle', { cx: x(qq.t), cy: y, r: 2.6, class: qq.wait > 0 ? 'f-bad' : 'f-ok' }));
      });
      clear(viz).append(svg);
      const n = cur.reqs.length || 1;
      sLock.update(fmt(cur.lockMin) + ' phút', k === 1 ? 'bad' : 'ok', RES.length + ' tài nguyên × thời gian bị khoá');
      sBlk.update(pct(cur.blocked / n, 0), cur.blocked / n > 0.5 ? 'bad' : 'warn', cur.blocked + '/' + cur.reqs.length + ' request');
      sWait.update(fmt(cur.avgWait, 1) + ' phút', cur.avgWait > 5 ? 'bad' : null);
      sCmp.update(k === 1 ? 'chính là nó' : 'chờ ít hơn ' + fmt(base.avgWait / Math.max(cur.avgWait, 0.01), 1) + '×', k === 1 ? null : 'accent', 'thời gian chờ TB');
    }
    render();
  });

  // =====================================================================
  // 5.7 Order fulfillment saga step-through
  // =====================================================================
  const ORDER_STEPS = [
    { name: 'Kiểm tra & giữ hàng', svc: 'Warehouse', sql: ['<span class="k">INSERT INTO</span> Reservation (order_id, sku, qty)', '  <span class="k">VALUES</span> (<span class="n">1001</span>, <span class="s">\'CD-0042\'</span>, <span class="n">1</span>);'], view: ['stock', 'Đã giữ 1 đĩa'] },
    { name: 'Thu tiền', svc: 'Payment Gateway', sql: ['<span class="k">INSERT INTO</span> Payment (order_id, amount, status)', '  <span class="k">VALUES</span> (<span class="n">1001</span>, <span class="n">20</span>, <span class="s">\'CAPTURED\'</span>);'], view: ['money', 'Đã trừ 20'] },
    { name: 'Cộng điểm thưởng', svc: 'Loyalty', sql: ['<span class="k">UPDATE</span> Points <span class="k">SET</span> balance = balance + <span class="n">20</span>', '  <span class="k">WHERE</span> customer_id = <span class="n">42</span>;'], view: ['points', '+20 điểm'] },
    { name: 'Đóng gói & gửi hàng', svc: 'Warehouse', sql: ['<span class="k">UPDATE</span> Reservation <span class="k">SET</span> status = <span class="s">\'DISPATCHED\'</span>', '  <span class="k">WHERE</span> order_id = <span class="n">1001</span>;'], view: ['ship', 'Đã gửi'] },
  ];
  widget('ch5-order-saga', (root) => {
    let done = 2;
    const list = h('ol', { class: 'step-list' });
    const code = h('pre', { class: 'code' });
    const view = h('div');
    const state = h('div');
    const next = button('Bước tiếp', () => { if (done < ORDER_STEPS.length) { done++; render(); } });
    const all = button('Chạy hết', () => { done = ORDER_STEPS.length; render(); }, 'ghost');
    const reset = button('Đặt lại', () => { done = 0; render(); }, 'ghost');
    root.append(h('div', { class: 'btn-row' }, next, all, reset), state,
      h('div', { class: 'lab-split' }, h('div', null, list), h('div', null, h('div', { class: 'lab-note' }, 'Giao dịch ACID cục bộ của bước vừa chạy'), code, view)),
      h('p', { class: 'lab-note' }, 'Đơn 1001, khách 42, số tiền và điểm là số liệu minh hoạ.'));
    function render() {
      clear(list);
      ORDER_STEPS.forEach((st, i) => list.append(h('li', { class: i < done ? 'done' : i === done ? 'on' : '' },
        h('span', { class: 'grow' }, h('b', (i + 1) + '. ' + st.name)), pill(st.svc, 'violet'),
        i < done ? pill('đã commit cục bộ', 'ok') : i === done ? pill('kế tiếp', 'accent') : pill('chưa chạy'))));
      const last = ORDER_STEPS[done - 1];
      code.innerHTML = last ? '<span class="k">BEGIN</span>; <span class="c">-- trong DB của ' + last.svc + '</span>\n' + last.sql.join('\n') + '\n<span class="k">COMMIT</span>;' : '<span class="c">-- chưa có bước nào chạy</span>';
      const v = { stock: 'chưa giữ', money: 'chưa trừ', points: '0', ship: 'chưa gửi' };
      ORDER_STEPS.slice(0, done).forEach((st) => { v[st.view[0]] = st.view[1]; });
      clear(view).append(h('div', { class: 'lab-note' }, 'Thế giới bên ngoài nhìn thấy'),
        dataTable(['Hàng', 'Tiền', 'Điểm', 'Giao hàng'], [[v.stock, v.money, v.points, v.ship]]));
      let vd;
      if (done === 0) vd = verdict('', 'Saga chưa bắt đầu', h('p', null, 'Đơn 1001 vừa được đặt.'));
      else if (done === ORDER_STEPS.length) vd = verdict('ok', 'Saga hoàn tất', h('p', null, 'Bốn giao dịch cục bộ, bốn database, không có khoá nào giữ xuyên suốt cả quy trình.'));
      else vd = verdict('warn', `Saga đang ở bước ${done}/${ORDER_STEPS.length} — trạng thái trung gian`, h('p', null,
        done >= 2 ? 'Khách đã bị trừ tiền nhưng hàng chưa đi. Đây không phải lỗi: saga không có atomicity tổng thể, nó chỉ cho bạn biết chính xác mình đang ở đâu.' : 'Hàng đã được giữ nhưng chưa thu tiền. Các đơn khác vẫn đọc/ghi kho bình thường — không có khoá toàn cục.'));
      clear(state).append(vd);
      next.disabled = done >= ORDER_STEPS.length;
    }
    render();
  });

  // =====================================================================
  // 5.8 Recovery policies
  // =====================================================================
  widget('ch5-recovery', (root) => {
    const STEPS = [
      { name: 'Giữ hàng', svc: 'Warehouse', comp: 'Huỷ giữ hàng' },
      { name: 'Thu tiền', svc: 'Payment Gateway', comp: 'Hoàn tiền' },
      { name: 'Cộng điểm thưởng', svc: 'Loyalty', comp: 'Trừ lại điểm' },
      { name: 'Đóng gói', svc: 'Warehouse', comp: 'Dỡ gói, trả hàng lên kệ' },
      { name: 'Gửi hàng', svc: 'Warehouse', comp: '—' },
    ];
    const pol = ['back', 'back', 'back', 'back', 'fwd'];
    const list = h('ol', { class: 'step-list' });
    const failSeg = seg({ value: 4, onChange: render, options: [{ value: -1, label: 'Không lỗi' }].concat(STEPS.map((st, i) => ({ value: i, label: st.name }))) });
    const retrySeg = seg({ value: 'ok2', onChange: render, options: [{ value: 'ok2', label: 'Lần thử 2 thành công' }, { value: 'never', label: 'Luôn thất bại' }] });
    const runBtn = button('Chạy saga', () => render(true));
    const sOut = stat('Kết cục', '—'), sComp = stat('Giao dịch bù trừ', '0'), sRetry = stat('Lần thử lại', '0');
    const lg = log();
    root.append(
      h('div', { class: 'controls' },
        h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Bước bị lỗi'), failSeg.el),
        h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Khi thử lại (phục hồi tiến)'), retrySeg.el)),
      list, h('div', { class: 'btn-row' }, runBtn), h('div', { class: 'stats' }, sOut, sComp, sRetry), lg);

    function drawList(status) {
      clear(list);
      STEPS.forEach((st, i) => {
        const ps = seg({ value: pol[i], onChange: (v) => { pol[i] = v; render(); }, options: [{ value: 'back', label: 'Lùi' }, { value: 'fwd', label: 'Tiến' }] });
        list.append(h('li', { class: status[i] || '' },
          h('span', { class: 'grow' }, h('b', (i + 1) + '. ' + st.name), ' ', pill(st.svc, 'violet')),
          h('span', { class: 'lab-note' }, 'Khi lỗi:'), ps.el));
      });
    }
    let gen = 0;
    async function render(animate) {
      const my = ++gen;
      const fast = !animate;
      const wait = (ms) => (fast ? Promise.resolve() : sleep(ms));
      const f = +failSeg.value, never = retrySeg.value === 'never';
      const status = [];
      lg.reset(); runBtn.disabled = animate;
      let comps = 0, retries = 0, outcome = 'Hoàn tất', tone = 'ok';
      drawList(status);
      for (let i = 0; i < STEPS.length; i++) {
        if (my !== gen) return;
        const st = STEPS[i];
        if (i !== f) {
          status[i] = 'done'; lg.add(`${st.svc}: ${st.name} — commit cục bộ`, 'ok'); drawList(status); await wait(250); continue;
        }
        status[i] = 'fail'; drawList(status);
        lg.add(`${st.svc}: ${st.name} — THẤT BẠI`, 'bad'); await wait(300);
        if (pol[i] === 'back') {
          lg.add('Chính sách: phục hồi lùi → chạy giao dịch bù trừ theo thứ tự ngược', 'acc');
          for (let j = i - 1; j >= 0; j--) {
            if (my !== gen) return;
            status[j] = 'undo'; comps++; drawList(status);
            lg.add(`${STEPS[j].svc}: ${STEPS[j].comp}`, 'warn'); await wait(300);
          }
          outcome = 'Đã huỷ đơn'; tone = 'bad';
          break;
        }
        lg.add('Chính sách: phục hồi tiến → lưu trạng thái và thử lại' + (i === 4 ? ' (xếp sang ngày hôm sau)' : ''), 'acc');
        let ok = false;
        for (let a = 2; a <= 3; a++) {
          retries++; await wait(350); if (my !== gen) return;
          if (!never && a === 2) { ok = true; lg.add(`Thử lại lần ${a}: thành công`, 'ok'); break; }
          lg.add(`Thử lại lần ${a}: vẫn thất bại`, 'bad');
        }
        if (ok) { status[i] = 'done'; drawList(status); continue; }
        lg.add('Hết lượt thử → chuyển cho con người xử lý. Saga dừng ở trạng thái trung gian, không có gì bị hoàn tác.', 'warn');
        outcome = 'Chờ con người'; tone = 'warn';
        break;
      }
      if (my !== gen) return;
      sOut.update(outcome, tone); sComp.update(String(comps), comps ? 'warn' : null); sRetry.update(String(retries), retries ? 'accent' : null);
      runBtn.disabled = false;
    }
    render(false);
  });

  // =====================================================================
  // 5.9 Compensating transactions vs DB rollback
  // =====================================================================
  widget('ch5-compensate', (root) => {
    const keep = checkbox('Lưu bản ghi đơn bị huỷ trong service Order', true, () => run(true));
    const runBtn = button('Đóng gói thất bại → huỷ đơn', () => run(false));
    const left = h('div', { class: 'box' }), right = h('div', { class: 'box' });
    const lg = log();
    root.append(h('div', { class: 'controls' }, runBtn, keep.el), h('div', { class: 'lab-split' }, left, right), lg,
      h('p', { class: 'lab-note' }, 'Thế giới ACID giả định mọi thứ (kể cả hàng đợi email chưa gửi) nằm chung một database. Số tiền, số điểm là số liệu minh hoạ.'));
    const STEPS = [
      { name: 'Giữ hàng', svc: 'Warehouse', comp: 'Huỷ giữ hàng' },
      { name: 'Thu tiền 20', svc: 'Payment Gateway', comp: 'Hoàn tiền 20' },
      { name: 'Cộng 20 điểm', svc: 'Loyalty', comp: 'Trừ 20 điểm' },
      { name: 'Gửi email "đơn đang trên đường"', svc: 'Notifications', comp: 'Gửi email "đơn đã bị huỷ, xin lỗi"' },
    ];
    let gen = 0;
    function panel(el, title, w) {
      clear(el).append(h('h5', null, title),
        dataTable(['Nơi', 'Khách / hệ thống thấy gì'], [
          ['Kho', w.stock], ['Sao kê thanh toán', w.money], ['Điểm thưởng', w.points],
          ['Hộp thư khách', w.inbox.length ? h('div', { class: 'inbox' }, w.inbox.map((m) => h('div', null, m))) : '(trống)'],
          ['Service Order', w.order]]));
    }
    async function run(fast) {
      const my = ++gen;
      const wait = (ms) => (fast ? Promise.resolve() : sleep(ms));
      runBtn.disabled = !fast; lg.reset();
      const acid = { stock: '—', money: '—', points: '0', inbox: [], order: '—' };
      const saga = { stock: '—', money: '—', points: '0', inbox: [], order: 'Đơn 1001: đang xử lý' };
      const apply = (w, i) => {
        if (i === 0) w.stock = 'Giữ 1 đĩa';
        if (i === 1) w.money = '−20';
        if (i === 2) w.points = '+20';
        if (i === 3) w.inbox.push('Email 1: "Đơn hàng đang trên đường"');
      };
      const redraw = () => { panel(left, 'Rollback của database (ACID)', acid); panel(right, 'Rollback ngữ nghĩa (saga)', saga); };
      redraw();
      for (let i = 0; i < STEPS.length; i++) {
        apply(saga, i); apply(acid, i);
        if (i === 3) acid.inbox = ['(email nằm trong hàng đợi, chưa gửi)'];
        lg.add(`${STEPS[i].svc}: ${STEPS[i].name} — đã commit`, 'ok'); redraw();
        await wait(300); if (my !== gen) return;
      }
      lg.add('Warehouse: Đóng gói — không tìm thấy hàng trên kệ! Quyết định: huỷ cả đơn', 'bad');
      await wait(400); if (my !== gen) return;
      Object.assign(acid, { stock: '—', money: '—', points: '0', inbox: [], order: '—' });
      lg.add('ACID: ROLLBACK — như thể chưa có gì xảy ra', 't');
      redraw();
      for (let j = STEPS.length - 1; j >= 0; j--) {
        await wait(350); if (my !== gen) return;
        if (j === 3) saga.inbox.push('Email 2: "Đơn đã bị huỷ, xin lỗi bạn"');
        if (j === 2) saga.points = '+20, rồi −20 = 0';
        if (j === 1) saga.money = '−20, rồi +20 hoàn tiền';
        if (j === 0) saga.stock = 'Giữ rồi huỷ giữ';
        lg.add(`Saga: ${STEPS[j].svc} — ${STEPS[j].comp}`, 'warn'); redraw();
      }
      saga.order = keep.value ? 'Đơn 1001: ABORTED — lý do: không thấy hàng khi đóng gói' : '(không còn dấu vết)';
      redraw();
      lg.add(keep.value ? 'Order lưu lại đơn bị huỷ cùng lý do — dữ liệu quý cho CSKH và phân tích.' : 'Không lưu gì: CSKH sẽ không giải thích được vì sao khách nhận hai email.', keep.value ? 'acc' : 'warn');
      runBtn.disabled = false;
    }
    run(true);
  });

  // =====================================================================
  // 5.10 Reordering steps
  // =====================================================================
  widget('ch5-reorder', (root) => {
    const ALL = {
      reserve: { name: 'Giữ hàng', svc: 'Warehouse', p: 0.03 },
      pay: { name: 'Thu tiền', svc: 'Payment Gateway', p: 0.05 },
      points: { name: 'Cộng điểm thưởng', svc: 'Loyalty', p: 0.01 },
      pack: { name: 'Đóng gói & gửi', svc: 'Warehouse', p: 0.08 },
    };
    let order = ['reserve', 'pay', 'points', 'pack'];
    const packSl = slider({ label: 'Xác suất lỗi khi đóng gói (không thấy hàng)', min: 0, max: 20, value: 8, format: (v) => v + '%', onInput: (v) => { ALL.pack.p = v / 100; render(); } });
    const list = h('ol', { class: 'step-list' });
    const viz = h('div', { class: 'viz' });
    const sComp = stat('Giao dịch bù trừ / 1.000 đơn', '—'), sNeed = stat('Bước cần viết bù trừ', '—'), sFail = stat('Đơn thất bại / 1.000', '—');
    const warn = h('div');
    root.append(
      h('div', { class: 'btn-row' },
        button('Thứ tự Hình 5-7', () => { order = ['reserve', 'pay', 'points', 'pack']; render(); }, 'ghost'),
        button('Thứ tự Hình 5-8', () => { order = ['reserve', 'pay', 'pack', 'points']; render(); }, 'ghost')),
      h('div', { class: 'controls' }, packSl.el),
      h('div', { class: 'lab-split' }, list, h('div', null, viz)), h('div', { class: 'stats' }, sComp, sNeed, sFail), warn);

    function move(i, d) { const j = i + d; if (j < 0 || j >= order.length) return; [order[i], order[j]] = [order[j], order[i]]; render(); }
    function render() {
      // expected compensations: failure at position i forces compensating all i earlier (committed) steps
      let reach = 1, comp = 0, fail = 0;
      const contrib = order.map((k, i) => { const c = reach * ALL[k].p * i; comp += c; fail += reach * ALL[k].p; reach *= 1 - ALL[k].p; return c; });
      const needComp = order.filter((k, i) => order.slice(i + 1).some((k2) => ALL[k2].p > 0));
      clear(list);
      order.forEach((k, i) => {
        const up = button('↑', () => move(i, -1), 'ghost'), dn = button('↓', () => move(i, 1), 'ghost');
        up.classList.add('mini'); dn.classList.add('mini'); up.disabled = i === 0; dn.disabled = i === order.length - 1;
        up.setAttribute('aria-label', 'Đưa ' + ALL[k].name + ' lên'); dn.setAttribute('aria-label', 'Đưa ' + ALL[k].name + ' xuống');
        list.append(h('li', { class: needComp.includes(k) ? '' : 'done' },
          h('span', { class: 'grow' }, h('b', (i + 1) + '. ' + ALL[k].name), ' ', pill(ALL[k].svc, 'violet')),
          pill('lỗi ' + fmt(ALL[k].p * 100, 0) + '%', ALL[k].p >= 0.05 ? 'warn' : ''),
          needComp.includes(k) ? pill('cần bù trừ', 'bad') : pill('không cần bù trừ', 'ok'), up, dn));
      });
      // bar chart of contribution by position
      const W = 300, H = 170, L = 34, B = 30, T = 12, max = Math.max(0.02, ...contrib) * 1000;
      const svg = svgRoot(W, H, 'Bù trừ theo vị trí lỗi');
      const bw = (W - L - 10) / order.length;
      svg.append(s('line', { x1: L, y1: H - B, x2: W - 6, y2: H - B, class: 'axis' }));
      contrib.forEach((c, i) => {
        const v = c * 1000, hh = (v / max) * (H - B - T);
        svg.append(s('rect', { x: L + i * bw + 6, y: H - B - hh, width: bw - 12, height: Math.max(0.5, hh), class: 'f-mark' }),
          s('text', { x: L + i * bw + bw / 2, y: H - B - hh - 3, 'text-anchor': 'middle', class: 'small' }, fmt(v, 1)),
          s('text', { x: L + i * bw + bw / 2, y: H - B + 13, 'text-anchor': 'middle', class: 'small' }, 'lỗi ở bước ' + (i + 1)));
      });
      svg.append(s('text', { x: W / 2, y: H - 3, 'text-anchor': 'middle', class: 'small' }, 'giao dịch bù trừ / 1.000 đơn, theo vị trí bước lỗi'));
      clear(viz).append(svg);
      sComp.update(fmt(comp * 1000, 1), comp * 1000 > 15 ? 'warn' : 'ok', 'kỳ vọng');
      sNeed.update(needComp.length + '/' + order.length, null, needComp.length < 3 ? 'bước cuối không bao giờ cần rollback' : '');
      sFail.update(fmt(fail * 1000, 1), null, 'không đổi khi đổi thứ tự');
      const pos = (k) => order.indexOf(k);
      const issues = [];
      if (pos('pack') < pos('reserve')) issues.push('Không thể đóng gói khi chưa giữ hàng.');
      if (pos('pack') < pos('pay')) issues.push('Gửi hàng trước khi thu tiền: rủi ro nghiệp vụ (giao hàng mà không thu được tiền).');
      clear(warn).append(issues.length
        ? verdict('bad', 'Thứ tự vi phạm ràng buộc nghiệp vụ', h('ul', null, issues.map((t) => h('li', null, t))))
        : verdict('ok', 'Thứ tự hợp lệ', h('p', null, pos('points') === order.length - 1
          ? 'Cộng điểm ở cuối: Loyalty không cần giao dịch bù trừ, và lỗi đóng gói chỉ cần hoàn tác hai bước.'
          : 'Thử đưa bước cộng điểm xuống cuối (Hình 5-8) hoặc kéo bước dễ lỗi lên trước.')));
    }
    render();
  });

  // =====================================================================
  // 5.11 Orchestrated saga
  // =====================================================================
  widget('ch5-orchestration', (root) => {
    const view = seg({ value: 'order', onChange: draw, options: [{ value: 'order', label: 'Đặt hàng' }, { value: 'multi', label: 'Nhiều luồng' }] });
    const fail = seg({ value: 'pack', onChange: () => run(true), options: [{ value: 'none', label: 'Không lỗi' }, { value: 'pay', label: 'Thu tiền bị từ chối' }, { value: 'pack', label: 'Không thấy hàng khi đóng gói' }] });
    const runBtn = button('Chạy saga điều phối', () => run(false));
    const viz = h('div', { class: 'viz' });
    const sKnow = stat('Service orchestrator phải biết', '3', 'warn', 'domain coupling'), sCalls = stat('Lời gọi request-response', '0'), sState = stat('Trạng thái saga (xem tại Order Processor)', '—');
    const lg = log();
    const ctlFail = h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Điểm lỗi'), fail.el);
    root.append(h('div', { class: 'controls' }, h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Sơ đồ'), view.el), ctlFail),
      h('div', { class: 'btn-row' }, runBtn), viz, h('div', { class: 'stats' }, sKnow, sCalls, sState), lg);

    const POS = { Warehouse: [100, 232], 'Payment Gateway': [280, 232], Loyalty: [460, 232] };
    const OP = [280, 72];
    let svg, op, svcs, gen = 0;
    function draw() {
      gen++;
      const multi = view.value === 'multi';
      runBtn.disabled = multi; ctlFail.style.opacity = multi ? '.45' : '';
      svg = svgRoot(560, 290, multi ? 'Ba orchestrator dùng chung Warehouse' : 'Order Processor điều phối saga');
      const ar = arrowDefs(svg);
      if (multi) {
        const orch = { 'Order Processor': [100, 30], Returns: [280, 30], 'Goods Receiving': [460, 30] };
        const edges = { 'Order Processor': ['Warehouse', 'Payment Gateway', 'Loyalty'], Returns: ['Warehouse', 'Payment Gateway', 'Loyalty'], 'Goods Receiving': ['Warehouse'] };
        Object.entries(edges).forEach(([o, ts]) => ts.forEach((t) => svg.append(s('line', { x1: orch[o][0], y1: orch[o][1] + 46, x2: POS[t][0], y2: POS[t][1] - 2, class: t === 'Warehouse' ? 's-accent-w' : 's-ink3', 'marker-end': `url(#${ar})` }))));
        Object.entries(orch).forEach(([name, [x, y]]) => svg.append(node(x - 80, y, 160, 46, name, 'orchestrator', 'f-violet-soft s-violet-w').g));
        Object.entries(POS).forEach(([name, [x, y]]) => svg.append(node(x - 80, y, 160, 46, name, name === 'Warehouse' ? 'dùng chung bởi 3 luồng' : '', name === 'Warehouse' ? 'f-accent-soft s-accent-w' : undefined).g));
        clear(viz).append(svg);
        lg.reset();
        lg.add('Mỗi luồng có orchestrator riêng: Order Processor (đặt hàng), Returns (đổi trả, hoàn tiền), Goods Receiving (nhập hàng lên kệ).', 'acc');
        lg.add('Warehouse phục vụ cả ba → logic kho được giữ trong Warehouse để tái sử dụng, thay vì bị hút vào một orchestrator.', 't');
        sKnow.update('1–3', null, 'mỗi orchestrator chỉ biết luồng của nó');
        return;
      }
      Object.entries(POS).forEach(([, [x, y]]) => svg.append(s('line', { x1: OP[0], y1: OP[1] + 4, x2: x, y2: y - 2, class: 's-ink3', 'marker-end': `url(#${ar})` })));
      op = node(OP[0] - 100, OP[1] - 54, 200, 58, 'Order Processor', 'orchestrator · saga #1001', 'f-violet-soft s-violet-w');
      svg.append(op.g);
      svcs = {};
      Object.entries(POS).forEach(([name, [x, y]]) => { svcs[name] = node(x - 80, y, 160, 46, name, ''); svg.append(svcs[name].g); });
      clear(viz).append(svg);
      sKnow.update('3', 'warn', 'domain coupling');
      run(true);
    }
    const PLAN = [
      { svc: 'Warehouse', act: 'Giữ hàng', comp: 'Huỷ giữ hàng', key: 'reserve' },
      { svc: 'Payment Gateway', act: 'Thu tiền', comp: 'Hoàn tiền', key: 'pay' },
      { svc: 'Loyalty', act: 'Cộng điểm', comp: 'Trừ lại điểm', key: 'points' },
      { svc: 'Warehouse', act: 'Đóng gói & gửi', comp: '', key: 'pack' },
    ];
    async function call(svc, label, okResp, fast, my) {
      const [x, y] = POS[svc];
      svcs[svc].sub.textContent = label;
      await moveDot(svg, OP[0], OP[1] + 4, x, y, 'f-accent', 420, fast); if (my !== gen) return false;
      await moveDot(svg, x, y, OP[0], OP[1] + 4, okResp ? 'f-ok' : 'f-bad', 420, fast);
      svcs[svc].rect.setAttribute('class', okResp ? 'f-ok-soft s-ok-w' : 'f-bad-soft s-bad-w');
      return my === gen;
    }
    async function run(fast) {
      if (view.value !== 'order') return;
      const my = ++gen;
      runBtn.disabled = !fast; lg.reset();
      Object.values(svcs).forEach((n) => { n.rect.setAttribute('class', 'f-surface s-line-w'); n.sub.textContent = ''; });
      let calls = 0;
      const done = [];
      for (let i = 0; i < PLAN.length; i++) {
        const st = PLAN[i], ok = fail.value !== st.key;
        op.sub.textContent = `saga #1001 · bước ${i + 1}/4`; sState.update(`bước ${i + 1}/4: ${st.act}`, 'accent');
        lg.add(`Order Processor → ${st.svc}: ${st.act}?`, 't');
        calls++; sCalls.update(String(calls));
        if (!(await call(st.svc, st.act, ok, fast, my))) return;
        if (ok) { lg.add(`${st.svc} → Order Processor: OK`, 'ok'); done.push(st); continue; }
        lg.add(`${st.svc} → Order Processor: LỖI`, 'bad');
        lg.add('Order Processor quyết định: phục hồi lùi, gọi giao dịch bù trừ theo thứ tự ngược', 'acc');
        for (let j = done.length - 1; j >= 0; j--) {
          const d = done[j];
          lg.add(`Order Processor → ${d.svc}: ${d.comp}`, 'warn');
          calls++; sCalls.update(String(calls));
          if (!(await call(d.svc, d.comp, true, fast, my))) return;
          svcs[d.svc].rect.setAttribute('class', 'f-warn-soft s-mark-w');
        }
        op.sub.textContent = 'saga #1001 · đã huỷ'; sState.update('đã huỷ ở bước ' + (i + 1), 'bad');
        runBtn.disabled = false;
        return;
      }
      op.sub.textContent = 'saga #1001 · hoàn tất'; sState.update('hoàn tất', 'ok');
      runBtn.disabled = false;
    }
    draw();
  });

  // =====================================================================
  // 5.12 Choreographed saga with correlation IDs
  // =====================================================================
  widget('ch5-choreography', (root) => {
    const corr = checkbox('Gắn correlation ID vào mọi sự kiện', true, () => run(true));
    const runBtn = button('Phát sự kiện', () => run(false));
    const viz = h('div', { class: 'viz' });
    const proj = h('div');
    const lg = log();
    const sKnow = stat('Service biết về service khác', '0', 'ok', 'chỉ biết sự kiện'), sEv = stat('Sự kiện đã phát', '0'), sLost = stat('Sự kiện không ghép được', '0');
    root.append(h('div', { class: 'controls' }, runBtn, corr.el), viz, h('div', { class: 'stats' }, sKnow, sEv, sLost),
      h('div', { class: 'lab-split' }, h('div', null, h('div', { class: 'lab-note' }, 'Nhật ký broker'), lg), h('div', null, h('div', { class: 'lab-note' }, 'View do Saga tracker chiếu từ sự kiện'), proj)));

    const P = { 'Order Processor': [20, 20], Warehouse: [215, 20], 'Payment Gateway': [410, 20], Loyalty: [20, 222], Recommendation: [215, 222], 'Saga tracker': [410, 222] };
    const SUBS = {
      'Order Placed': ['Warehouse', 'Recommendation', 'Saga tracker'],
      'Stock Reserved': ['Payment Gateway', 'Saga tracker'],
      'Insufficient Stock': ['Order Processor', 'Saga tracker'],
      'Order Cancelled': ['Saga tracker'],
      'Payment Taken': ['Loyalty', 'Warehouse', 'Saga tracker'],
      'Points Awarded': ['Saga tracker'],
      'Order Shipped': ['Saga tracker'],
    };
    const LOCAL = { 'Stock Reserved': 'reservationId', 'Insufficient Stock': 'sku', 'Order Cancelled': 'orderId', 'Payment Taken': 'paymentId', 'Points Awarded': 'pointsTxId', 'Order Shipped': 'shipmentId' };
    const STATE = { 'Order Placed': ['Đã đặt', ''], 'Stock Reserved': ['Đã giữ hàng', 'accent'], 'Payment Taken': ['Đã thu tiền', 'accent'], 'Points Awarded': null, 'Order Shipped': ['Đã gửi hàng', 'ok'], 'Insufficient Stock': ['Thiếu hàng', 'bad'], 'Order Cancelled': ['Đã huỷ', 'bad'] };
    const SCRIPT = [
      ['Order Processor', 'Order Placed', 'ORD-1'], ['Order Processor', 'Order Placed', 'ORD-2'], ['Warehouse', 'Stock Reserved', 'ORD-1'],
      ['Order Processor', 'Order Placed', 'ORD-3'], ['Warehouse', 'Insufficient Stock', 'ORD-2'], ['Payment Gateway', 'Payment Taken', 'ORD-1'],
      ['Warehouse', 'Stock Reserved', 'ORD-3'], ['Order Processor', 'Order Cancelled', 'ORD-2'], ['Loyalty', 'Points Awarded', 'ORD-1'],
      ['Payment Gateway', 'Payment Taken', 'ORD-3'], ['Warehouse', 'Order Shipped', 'ORD-1'], ['Loyalty', 'Points Awarded', 'ORD-3'], ['Warehouse', 'Order Shipped', 'ORD-3'],
    ];
    const svg = svgRoot(600, 290, 'Saga vũ đạo qua message broker');
    const nodes = {};
    const brokerT = s('text', { x: 300, y: 150, 'text-anchor': 'middle', class: 'lbl-strong' }, 'Message broker · topics');
    svg.append(s('rect', { x: 20, y: 128, width: 560, height: 34, rx: 8, class: 'f-violet-soft s-violet-w' }), brokerT);
    Object.entries(P).forEach(([name, [x, y]]) => {
      const cy = y < 100 ? y + 48 : y;
      svg.append(s('line', { x1: x + 85, y1: cy, x2: x + 85, y2: y < 100 ? 128 : 162, class: 's-line dash', 'stroke-width': 1.5 }));
      nodes[name] = node(x, y, 170, 48, name, name === 'Saga tracker' ? 'hút mọi sự kiện' : '', name === 'Saga tracker' ? 'f-accent-soft s-accent-w' : undefined);
      svg.append(nodes[name].g);
    });
    viz.append(svg);
    const anchor = (name) => { const [x, y] = P[name]; return y < 100 ? [x + 85, y + 48] : [x + 85, y]; };

    let gen = 0;
    async function run(fast) {
      const my = ++gen;
      runBtn.disabled = !fast; lg.reset();
      const withId = corr.value;
      const view = new Map();
      let lost = 0, n = 0, seq = 10;
      const drawProj = () => {
        const rows = [...view.entries()].map(([id, st]) => [id, pill(st[0], st[1])]);
        if (lost) rows.push([h('i', null, 'không rõ đơn nào'), pill(lost + ' sự kiện', 'warn')]);
        clear(proj).append(dataTable(['Saga / đơn', 'Trạng thái'], rows.length ? rows : [['—', '—']]));
      };
      drawProj();
      Object.values(nodes).forEach((nd) => nd.rect.setAttribute('class', nd === nodes['Saga tracker'] ? 'f-accent-soft s-accent-w' : 'f-surface s-line-w'));
      for (const [pub, ev, id] of SCRIPT) {
        if (my !== gen) return;
        n++; seq++;
        const payload = withId ? `[${id}]` : (ev === 'Order Placed' ? `{orderId: ${id}}` : `{${LOCAL[ev]}: ${ev === 'Insufficient Stock' ? 'CD-0042' : 'X-' + seq}}`);
        nodes[pub].rect.setAttribute('class', ev === 'Insufficient Stock' || ev === 'Order Cancelled' ? 'f-bad-soft s-bad-w' : 'f-ok-soft s-ok-w');
        brokerT.textContent = ev + (withId ? ' · ' + id : '');
        const [px, py] = anchor(pub);
        if (!fast) await moveDot(svg, px, py, px, py < 145 ? 128 : 162, 'f-accent', 260, false);
        if (my !== gen) return;
        await Promise.all(SUBS[ev].map((sub) => { const [sx, sy] = anchor(sub); return moveDot(svg, sx, sy < 145 ? 128 : 162, sx, sy, 'f-violet', 260, fast); }));
        if (my !== gen) return;
        lg.add(`${pub} → ${ev} ${payload}  ⇒ ${SUBS[ev].join(', ')}`, ev === 'Insufficient Stock' || ev === 'Order Cancelled' ? 'bad' : 't');
        // tracker projection
        const st = STATE[ev];
        if (withId || ev === 'Order Placed') { if (st) view.set(id, st); }
        else lost++;
        sEv.update(String(n)); sLost.update(String(lost), lost ? 'bad' : 'ok', lost ? 'tracker không biết thuộc saga nào' : '');
        drawProj();
        if (!fast) await sleep(120);
      }
      brokerT.textContent = 'Message broker · topics';
      lg.add(withId ? 'Tracker ghép đủ 13 sự kiện về 3 saga: ORD-1, ORD-3 đã gửi, ORD-2 đã huỷ.' : 'Không có correlation ID: cả ba đơn trông như mãi "Đã đặt", tracker không thể phát hiện ORD-2 bị huỷ.', withId ? 'ok' : 'warn');
      runBtn.disabled = false;
    }
    run(true);
  });

  // =====================================================================
  // 5.13 Choosing a style
  // =====================================================================
  widget('ch5-choose', (root) => {
    const teams = slider({ label: 'Số đội sở hữu các bước của saga', min: 1, max: 6, value: 1, format: (v) => v + ' đội', onInput: render });
    const familiar = checkbox('Đội đã quen cộng tác hướng sự kiện', false, render);
    const ops = checkbox('Vận hành cần xem ngay trạng thái từng saga', true, render);
    const out = h('div'), tbl = h('div');
    root.append(h('div', { class: 'controls' }, teams.el), h('div', { class: 'controls' }, familiar.el, ops.el), out, tbl);
    const ROWS = [
      ['Quy trình được mô hình tường minh ở một chỗ', 'Có — trong orchestrator', 'Không — rải trong các service', 'o', 'one'],
      ['Xem trạng thái một saga', 'Hỏi orchestrator', 'Cần correlation ID + service chiếu view', 'o', 'ops'],
      ['Domain coupling', 'Cao — orchestrator biết mọi service', 'Thấp — chỉ biết sự kiện', 'c', 'multi'],
      ['Nguy cơ logic bị tập trung, service "thiếu máu"', 'Cao', 'Thấp', 'c', 'multi'],
      ['Chia trách nhiệm cho nhiều đội', 'Khó — một đội giữ "bộ não"', 'Dễ — mỗi đội lo phản ứng của mình', 'c', 'multi'],
      ['Độ quen thuộc với đa số đội', 'Request-response quen thuộc', 'Hướng sự kiện, ít người hiểu sâu', 'o', 'unfamiliar'],
    ];
    function render() {
      const t = teams.value, multi = t > 1;
      const active = { one: !multi, ops: ops.value, multi, unfamiliar: !familiar.value };
      let v;
      if (!multi) v = verdict('accent', 'Gợi ý: orchestration là ổn', h('p', null, 'Một đội sở hữu toàn bộ saga: kiến trúc ràng buộc hơn vẫn dễ quản lý trong ranh giới đội. Sam "rất thoải mái" với lựa chọn này. Nhớ dùng orchestrator khác nhau cho các luồng khác nhau.'));
      else v = verdict('ok', `Gợi ý: choreography (${t} đội)`, h('ul', null,
        h('li', null, 'Nhiều đội → dễ chia trách nhiệm, coupling lỏng giúp các đội làm việc độc lập.'),
        h('li', null, 'Bắt buộc: correlation ID trong mọi sự kiện' + (ops.value ? ', và một service chiếu trạng thái saga cho bộ phận vận hành.' : '.')),
        !familiar.value ? h('li', null, 'Đội chưa quen hướng sự kiện: tính trước chi phí học tập. Theo Sam, lợi ích coupling lỏng gần như luôn lớn hơn chi phí theo dõi.') : null,
        h('li', null, 'Bên trong ranh giới một đội (vd. đóng gói & gửi trong Warehouse) vẫn có thể dùng orchestration — trộn phong cách là hợp lệ.')));
      clear(out).append(v);
      clear(tbl).append(dataTable(['Tiêu chí', 'Orchestration', 'Choreography'],
        ROWS.map((r) => [r[0], r[3] === 'o' ? h('b', null, r[1]) : r[1], r[3] === 'c' ? h('b', null, r[2]) : r[2]]),
        (i) => active[ROWS[i][4]]));
    }
    render();
  });

  // =====================================================================
  // 5.14 Helland's airplane
  // =====================================================================
  widget('ch5-helland', (root) => {
    const nSl = slider({ label: 'Số bên tham gia (node)', min: 1, max: 20, value: 5, onInput: render });
    const aSl = slider({ label: 'Độ sẵn sàng của mỗi node', min: 9900, max: 9999, value: 9950, format: (v) => fmt(v / 100, 2) + '%', onInput: render });
    const simBtn = button('Mô phỏng 10.000 lần commit', () => { seed++; simulate(); });
    const viz = h('div', { class: 'viz' });
    const s2 = stat('2PC: commit chạy được', '—'), sDown = stat('2PC: thời gian treo mỗi năm', '—'), sSaga = stat('Saga: mỗi bước cần', '—');
    const out = h('div');
    let seed = 1;
    root.append(h('div', { class: 'controls' }, nSl.el, aSl.el), viz, h('div', { class: 'stats' }, s2, sDown, sSaga), h('div', { class: 'btn-row' }, simBtn), out,
      h('p', { class: 'lab-note' }, 'Số liệu minh hoạ, giả định các node hỏng độc lập nhau.'));
    function render() {
      const n = nSl.value, a = aSl.value / 10000;
      const all = Math.pow(a, n);
      const yMin = Math.max(0, Math.floor(Math.pow(a, 20) * 100 / 2) * 2 - 2);
      const W = 560, H = 240, L = 50, R = 16, T = 16, B = 40;
      const x = (k) => L + (k - 1) / 19 * (W - L - R), y = (p) => T + (100 - p) / (100 - yMin) * (H - T - B);
      const svg = svgRoot(W, H, 'Độ sẵn sàng theo số node');
      for (let i = 0; i <= 4; i++) {
        const p = yMin + (100 - yMin) * i / 4;
        svg.append(s('line', { x1: L, y1: y(p), x2: W - R, y2: y(p), class: 'grid' }), s('text', { x: L - 6, y: y(p) + 4, 'text-anchor': 'end' }, fmt(p, 1) + '%'));
      }
      [1, 5, 10, 15, 20].forEach((k) => svg.append(s('text', { x: x(k), y: H - B + 16, 'text-anchor': 'middle' }, String(k))));
      svg.append(s('text', { x: (L + W - R) / 2, y: H - 6, 'text-anchor': 'middle' }, 'số node phải cùng sống (n)'));
      let d2 = '';
      for (let k = 1; k <= 20; k++) d2 += (k === 1 ? 'M' : 'L') + x(k) + ',' + y(Math.pow(a, k) * 100);
      svg.append(s('line', { x1: x(1), y1: y(a * 100), x2: x(20), y2: y(a * 100), class: 's-ok dash', 'stroke-width': 2 }),
        s('text', { x: x(20), y: y(a * 100) - 6, 'text-anchor': 'end', class: 'small' }, 'saga: mỗi bước chỉ cần 1 node'),
        s('path', { d: d2, class: 'f-none s-bad', 'stroke-width': 2.5 }),
        s('text', { x: x(20), y: y(Math.pow(a, 20) * 100) + 14, 'text-anchor': 'end', class: 'small' }, '2PC: aⁿ'),
        s('circle', { cx: x(n), cy: y(all * 100), r: 6, class: 'f-bad' }),
        s('text', { x: x(n) + 8, y: y(all * 100) - 8, class: 'lbl-strong' }, pct(all, 2)));
      clear(viz).append(svg);
      s2.update(pct(all, 2), all < 0.97 ? 'bad' : all < 0.995 ? 'warn' : 'ok', `= ${fmt(a * 100, 2)}%^${n}`);
      sDown.update(fmt((1 - all) * 8760, 0) + ' giờ', all < 0.99 ? 'bad' : 'warn', 'khi bất kỳ node nào hỏng');
      sSaga.update(pct(a, 2), 'ok', 'node của bước đó; hỏng thì thử lại sau');
      simulate();
    }
    function simulate() {
      const n = nSl.value, a = aSl.value / 10000, r = rng(seed * 7919 + n);
      let stalled = 0, retries = 0;
      for (let i = 0; i < 10000; i++) {
        let down = 0;
        for (let k = 0; k < n; k++) if (r() > a) down++;
        if (down) stalled++;
        retries += down;
      }
      clear(out).append(verdict(stalled > 300 ? 'bad' : 'warn', `Lần mô phỏng #${seed}: ${fmt(stalled)} / 10.000 commit 2PC bị treo`,
        h('p', null, `Mỗi commit treo giữ khoá trên ${n - 1} node còn lại cho đến khi node hỏng quay lại. Với saga, cùng các sự cố đó chỉ tạo ra ${fmt(retries)} bước phải thử lại (phục hồi tiến), các bước khác và các đơn khác không bị khoá chờ.`)));
    }
    render();
  });

  // =====================================================================
  // Glossary
  // =====================================================================
  const T = (key, term, vi, topic, def) => ({ key, term, vi, ch: 5, topic, def });
  glossary.add([
    T('transaction', 'Transaction', 'giao dịch', 'ch5-transactions', 'Một hoặc nhiều thao tác được đối xử như một đơn vị duy nhất: hoặc tất cả hoàn tất, hoặc không thao tác nào có hiệu lực.'),
    T('acid', 'ACID', 'nguyên tử, nhất quán, cô lập, bền vững', 'ch5-transactions', 'Bốn thuộc tính của giao dịch database: Atomicity, Consistency, Isolation, Durability. Là nền tảng để tin cậy vào tính bền và nhất quán của dữ liệu.'),
    T('atomicity', 'Atomicity', 'tính nguyên tử', 'ch5-transactions', 'Mọi thao tác trong giao dịch cùng thành công hoặc cùng thất bại; nếu một thay đổi hỏng, cả giao dịch bị huỷ như chưa từng xảy ra. Là thuộc tính mất đi đầu tiên khi tách sang microservice.'),
    T('consistency', 'Consistency (ACID)', 'tính nhất quán', 'ch5-transactions', 'Sau mỗi giao dịch, database được để lại ở trạng thái hợp lệ, thoả mọi ràng buộc.'),
    T('isolation', 'Isolation', 'tính cô lập', 'ch5-transactions', 'Nhiều giao dịch chạy đồng thời mà không ảnh hưởng nhau: trạng thái trung gian của một giao dịch không lộ ra cho giao dịch khác. 2PC không giữ được thuộc tính này.'),
    T('durability', 'Durability', 'tính bền vững', 'ch5-transactions', 'Khi giao dịch đã hoàn tất, dữ liệu không bị mất dù hệ thống gặp sự cố.'),
    T('multi-document-transaction', 'Multi-document transaction (MongoDB 4.0)', 'giao dịch đa document', 'ch5-transactions', 'Trước MongoDB 4.0, ACID chỉ được đảm bảo trên một document; bản 4.0 bổ sung giao dịch ACID trải trên nhiều document.'),
    T('distributed-transaction', 'Distributed transaction', 'giao dịch phân tán', 'ch5-two-phase-commit', 'Giao dịch cố gắng thay đổi trạng thái của nhiều tiến trình/database riêng biệt như một đơn vị. Sam khuyên tránh dùng giữa các microservice.'),
    T('two-phase-commit', 'Two-phase commit (2PC)', 'commit hai pha', 'ch5-two-phase-commit', 'Thuật toán giao dịch phân tán gồm pha bỏ phiếu và pha commit, do một coordinator điều khiển. Thực chất là điều phối khoá phân tán; thêm độ trễ và có chế độ hỏng cần gỡ tay.'),
    T('transaction-coordinator', 'Transaction coordinator', 'bộ điều phối giao dịch', 'ch5-two-phase-commit', 'Thành phần trung tâm trong 2PC: hỏi phiếu các worker, rồi gửi lệnh commit hoặc rollback tới tất cả.'),
    T('voting-phase', 'Voting phase', 'pha bỏ phiếu', 'ch5-two-phase-commit', 'Pha 1 của 2PC: worker cho biết có thể thực hiện thay đổi hay không. Phiếu thuận là lời hứa cho tương lai, thường phải khoá bản ghi để giữ.'),
    T('commit-phase', 'Commit phase', 'pha commit', 'ch5-two-phase-commit', 'Pha 2 của 2PC: nếu mọi worker đồng ý, thay đổi thực sự được áp dụng và khoá được nhả; nếu không, mọi bên nhận lệnh rollback.'),
    T('inconsistency-window', 'Window of inconsistency', 'cửa sổ bất nhất', 'ch5-2pc-pitfalls', 'Khoảng thời gian một số worker đã commit còn số khác chưa, khiến bên ngoài thấy trạng thái trung gian. Rộng hơn khi độ trễ lớn hoặc worker xử lý chậm.'),
    T('distributed-lock', 'Distributed lock', 'khoá phân tán', 'ch5-2pc-pitfalls', 'Khoá trên tài nguyên được giữ phối hợp giữa nhiều tiến trình. 2PC về bản chất là điều phối các khoá như vậy, khó hơn nhiều so với khoá trong một tiến trình.'),
    T('deadlock', 'Deadlock', 'khoá chết', 'ch5-2pc-pitfalls', 'Hai hoặc nhiều bên chờ khoá của nhau mãi mãi. Khó tránh trong một tiến trình, càng khó khi khoá trải trên nhiều bên.'),
    T('saga', 'Saga', 'saga', 'ch5-sagas', 'Thuật toán điều phối nhiều thay đổi trạng thái bằng chuỗi giao dịch cục bộ độc lập, không khoá tài nguyên lâu. Không có atomicity ở cấp saga nhưng cho biết saga đang ở trạng thái nào.'),
    T('long-lived-transaction', 'Long-lived transaction (LLT)', 'giao dịch sống lâu', 'ch5-sagas', 'Giao dịch kéo dài hàng phút, giờ hoặc ngày. Ánh xạ thẳng thành giao dịch database sẽ khoá dữ liệu suốt thời gian đó; bài báo Sagas (1987) đề xuất chia nhỏ nó.'),
    T('local-transaction', 'Sub-transaction / local transaction', 'giao dịch con / giao dịch cục bộ', 'ch5-order-saga', 'Một bước của saga, thực hiện trong phạm vi database của một service và có thể là giao dịch ACID bình thường.'),
    T('lock-contention', 'Lock contention', 'tranh chấp khoá', 'ch5-sagas', 'Tình trạng nhiều tiến trình phải chờ nhau vì tài nguyên đang bị khoá. Giảm khi phạm vi và thời gian khoá giảm.'),
    T('backward-recovery', 'Backward recovery', 'phục hồi lùi', 'ch5-failure-modes', 'Hoàn tác lỗi và dọn dẹp bằng cách chạy các hành động bù trừ cho những giao dịch đã commit trước đó.'),
    T('forward-recovery', 'Forward recovery', 'phục hồi tiến', 'ch5-failure-modes', 'Tiếp tục saga từ điểm hỏng bằng cách thử lại; đòi hỏi hệ thống lưu đủ thông tin để thử lại được.'),
    T('compensating-transaction', 'Compensating transaction', 'giao dịch bù trừ', 'ch5-compensating', 'Thao tác mới đảo ngược tác động của một giao dịch đã commit, dùng để rollback saga (vd. hoàn tiền, trừ lại điểm).'),
    T('semantic-rollback', 'Semantic rollback', 'rollback ngữ nghĩa', 'ch5-compensating', 'Rollback ở mức nghiệp vụ chứ không xoá lịch sử: giao dịch gốc đã xảy ra, ta chỉ làm đủ để đảo ngược hậu quả trong ngữ cảnh saga. Email đã gửi thì gửi thêm email xin lỗi.'),
    T('rollback', 'Rollback', 'hoàn tác giao dịch', 'ch5-compensating', 'Với giao dịch ACID, huỷ mọi thay đổi trước khi commit để như thể chưa có gì xảy ra. Không áp dụng được cho các bước saga đã commit.'),
    T('orchestrated-saga', 'Orchestrated saga', 'saga điều phối', 'ch5-orchestration', 'Saga do một orchestrator trung tâm quyết định thứ tự bước và kích hoạt bù trừ. Dễ nhìn trạng thái nhưng domain coupling cao.'),
    T('orchestrator', 'Orchestrator', 'bộ điều phối', 'ch5-orchestration', 'Service trung tâm (vd. Order Processor) biết các service tham gia, gọi chúng theo thứ tự và quyết định xử lý khi lỗi.'),
    T('command-and-control', 'Command-and-control', 'ra lệnh và kiểm soát', 'ch5-orchestration', 'Cách mô tả orchestration: một bên trung tâm kiểm soát việc gì xảy ra và khi nào.'),
    T('domain-coupling', 'Domain coupling', 'ràng buộc miền', 'ch5-orchestration', 'Một microservice phải biết và tương tác với microservice khác để dùng chức năng của nó. Orchestrator thường có domain coupling cao.'),
    T('anemic-service', 'Anemic service', 'service thiếu máu', 'ch5-orchestration', 'Service có ít hành vi riêng, chỉ nhận lệnh từ orchestrator vì logic đã bị hút vào trung tâm. "Nếu logic có chỗ để tập trung, nó sẽ bị tập trung."'),
    T('bpm', 'Business process modeling (BPM) tools', 'công cụ mô hình hoá quy trình nghiệp vụ', 'ch5-orchestration', 'Công cụ kéo thả để nối quy trình. Sam không thích vì khó version control và test; nếu cần, gợi ý Camunda và Zeebe.'),
    T('request-response', 'Request-response', 'yêu cầu – phản hồi', 'ch5-orchestration', 'Kiểu giao tiếp gửi yêu cầu và chờ phản hồi cho biết thành công cùng kết quả; được orchestrator dùng nhiều.'),
    T('choreographed-saga', 'Choreographed saga', 'saga vũ đạo', 'ch5-choreography', 'Saga phân tán trách nhiệm cho các service, phối hợp bằng sự kiện. Coupling thấp, nhưng khó nắm quy trình và trạng thái nếu thiếu correlation ID.'),
    T('trust-but-verify', 'Trust-but-verify', 'tin nhưng kiểm chứng', 'ch5-choreography', 'Cách mô tả choreography: mỗi service tự làm phần việc của mình khi nhận sự kiện; trạng thái tổng thể được kiểm chứng qua sự kiện.'),
    T('event', 'Event', 'sự kiện', 'ch5-choreography', 'Thông báo một điều đã xảy ra, được phát ra mà không gửi tới ai cụ thể; service quan tâm tự nhận và phản ứng.'),
    T('message-broker', 'Message broker', 'môi giới thông điệp', 'ch5-choreography', 'Hạ tầng quản lý việc phát và giao sự kiện tin cậy, đảm bảo tính bền của topic và việc giao tới subscriber.'),
    T('topic', 'Topic', 'chủ đề (kênh sự kiện)', 'ch5-choreography', 'Kênh trên broker cho một loại sự kiện; nhiều subscriber có thể cùng đăng ký mà không cần biết nguồn phát.'),
    T('correlation-id', 'Correlation ID', 'mã tương quan', 'ch5-choreography', 'ID duy nhất của một saga, gắn vào mọi sự kiện/lời gọi liên quan để ghép chúng lại, dựng view trạng thái và truy vết. Thiết yếu cho saga vũ đạo.'),
    T('log-aggregation', 'Log aggregation', 'gom log tập trung', 'ch5-choosing', 'Thu thập log của mọi service về một chỗ; kết hợp correlation ID để truy vết toàn bộ lời gọi của một quy trình.'),
    T('business-process', 'Business process as a first-class concept', 'quy trình nghiệp vụ là khái niệm hạng nhất', 'ch5-sagas-vs-2pc', 'Mô hình hoá tường minh quy trình nghiệp vụ trong code (thường dưới dạng saga) thay vì để nó ngầm định, rải rác trong hệ thống.'),
  ]);
})();
