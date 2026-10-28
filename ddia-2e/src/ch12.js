/* ch12 — Stream Processing (nguồn: DDIA ấn bản 1, Chương 11) */
(function () {
  'use strict';
  const D = window.DDIA;
  const { h, s, clear, fmt, fmtBig, fmtMs, pct, rng, clamp, slider, seg, button, checkbox, stat, widget, glossary } = D;

  function mkSvg(w, hh, label) {
    return s('svg', { viewBox: `0 0 ${w} ${hh}`, role: 'img', 'aria-label': label || '' });
  }
  const T = (x, y, txt, cls, extra) => s('text', Object.assign({ x, y, class: cls || '' }, extra || {}), txt);
  const TM = (x, y, txt, cls, extra) => T(x, y, txt, cls, Object.assign({ 'text-anchor': 'middle' }, extra || {}));
  const TE = (x, y, txt, cls, extra) => T(x, y, txt, cls, Object.assign({ 'text-anchor': 'end' }, extra || {}));
  const L = (x1, y1, x2, y2, cls, extra) => s('line', Object.assign({ x1, y1, x2, y2, class: 'f-none ' + (cls || 's-line') }, extra || {}));
  const R = (x, y, w, hh, cls, extra) => s('rect', Object.assign({ x, y, width: Math.max(0, w), height: Math.max(0, hh), class: cls }, extra || {}));
  const C = (cx, cy, r, cls, extra) => s('circle', Object.assign({ cx, cy, r, class: cls }, extra || {}));

  // =====================================================================
  // 12.1 poll-push — Polling vs Push notifications
  // =====================================================================
  widget('poll-push', (root) => {
    const evRate = slider({ label: 'Số sự kiện xảy ra trong 20s', min: 2, max: 12, step: 1, value: 4, format: (v) => v + ' event', onInput: render });
    const pollInt = slider({ label: 'Chu kỳ Polling của Consumer', min: 1, max: 8, step: 0.5, value: 2, format: (v) => fmt(v, 1) + ' s', onInput: render });
    const svg = mkSvg(640, 175, 'So sánh Polling định kỳ và Push thông báo');
    const layer = s('g'); svg.appendChild(layer);
    const s1 = stat('Tổng số lần Poll', '–'), s2 = stat('Tỉ lệ Poll về tay không', '–'), s3 = stat('Độ trễ trung bình (Poll vs Push)', '–');

    root.append(
      h('div', { class: 'controls' }, evRate.el, pollInt.el),
      h('div', { class: 'viz' }, svg),
      h('div', { class: 'stats' }, s1, s2, s3)
    );

    function render() {
      clear(layer);
      const nEv = evRate.value, pStep = pollInt.value;
      const X0 = 115, X1 = 620, TMAX = 20;
      const x = (t) => X0 + (t / TMAX) * (X1 - X0);

      const evTimes = [];
      for (let i = 1; i <= nEv; i++) evTimes.push((i / (nEv + 1)) * TMAX);

      [['Sự kiện gốc', 38], ['Polling DB', 92], ['Push / Stream', 146]].forEach(([lbl, y]) => {
        layer.append(L(X0, y, X1, y, 'grid'), T(8, y + 4, lbl, 'lbl-strong sm'));
      });

      evTimes.forEach((et) => {
        layer.append(C(x(et), 38, 5, 'f-accent'), C(x(et + 0.15), 146, 5, 'f-ok'), L(x(et), 43, x(et + 0.15), 141, 's-ok dash'));
      });

      let polls = 0, empty = 0, waitSum = 0, prevPoll = 0;
      for (let t = pStep; t <= TMAX + 1e-6; t += pStep) {
        polls++;
        const caught = evTimes.filter((et) => et > prevPoll && et <= t);
        if (!caught.length) {
          empty++;
          layer.append(L(x(t), 82, x(t), 102, 's-ink3'), TM(x(t), 114, '∅', 'sm f-ink3'));
        } else {
          caught.forEach((et) => { waitSum += t - et; });
          layer.append(C(x(t), 92, 5, 'f-warn'), L(x(caught[0]), 43, x(t), 87, 's-warn dash'));
        }
        prevPoll = t;
      }

      const avgWait = evTimes.length ? (waitSum / evTimes.length) * 1000 : 0;
      s1.update(`${polls} request`, 'accent', `Hỏi mỗi ${fmt(pStep, 1)}s`);
      s2.update(pct(empty / Math.max(1, polls), 0), empty / Math.max(1, polls) > 0.5 ? 'warn' : 'ok', `${empty}/${polls} lần hỏi không có gì mới`);
      s3.update(`Poll: ${fmtMs(avgWait)} · Push: ~15 ms`, 'ok', 'Push vừa nhanh vừa không lãng phí');
    }
    render();
  });

  // =====================================================================
  // 12.2 overload — Drop, Buffer, or Backpressure + Broker crash
  // =====================================================================
  widget('overload', (root) => {
    const prodSl = slider({ label: 'Tốc độ Producer gửi', min: 50, max: 300, step: 25, value: 200, format: (v) => v + ' msg/s', onInput: render });
    const consSl = slider({ label: 'Tốc độ Consumer xử lý', min: 50, max: 300, step: 25, value: 125, format: (v) => v + ' msg/s', onInput: render });
    const strat = seg({
      label: 'Chiến lược khi quá tải',
      options: [
        { value: 'drop', label: 'Bỏ message (Drop)' },
        { value: 'buffer', label: 'Đệm vào hàng đợi (Buffer)' },
        { value: 'bp', label: 'Chặn Producer (Backpressure)' },
      ],
      value: 'buffer',
      onChange: render,
    });
    const crashChk = checkbox('Broker sập ở giây 40 (chỉ giữ trong RAM vs có ghi đĩa)', false, render);

    const svg = mkSvg(640, 185, 'Hàng đợi và thông lượng qua 60 giây');
    const layer = s('g'); svg.appendChild(layer);
    const s1 = stat('Message xử lý thành công', '–'), s2 = stat('Message bị bỏ / mất', '–'), s3 = stat('Độ dài hàng đợi cuối', '–');

    root.append(
      h('div', { class: 'controls' }, prodSl.el, consSl.el, strat.el),
      crashChk.el,
      h('div', { class: 'viz' }, svg),
      h('div', { class: 'stats' }, s1, s2, s3)
    );

    function render() {
      clear(layer);
      const P = prodSl.value, C_rate = consSl.value, st = strat.value, crash = crashChk.input.checked;
      const X0 = 55, X1 = 620, Y0 = 155, Y1 = 22;
      const x = (t) => X0 + (t / 60) * (X1 - X0);
      const y = (q) => Y0 - (Math.min(q, 5000) / 5000) * (Y0 - Y1);

      layer.append(L(X0, Y0, X1, Y0, 'axis'), TE(X0 - 6, Y1 + 8, 'Queue', 'sm'));
      let q = 0, processed = 0, dropped = 0, dPath = `M${x(0)},${y(0)}`;
      for (let t = 1; t <= 60; t++) {
        if (st === 'drop') {
          const take = Math.min(P, C_rate);
          processed += take;
          dropped += Math.max(0, P - C_rate);
          q = 0;
        } else if (st === 'bp') {
          const cap = 300;
          const send = Math.min(P, Math.max(0, C_rate + (cap - q)));
          q = q + send - Math.min(C_rate, q + send);
          processed += Math.min(C_rate, q + send);
        } else {
          q += P;
          const done = Math.min(C_rate, q);
          q -= done;
          processed += done;
        }
        if (crash && t === 40) {
          dropped += q;
          q = 0;
        }
        dPath += ` L${x(t)},${y(q)}`;
      }
      layer.append(s('path', { d: dPath, class: 'f-none s-accent sw2' }));
      if (crash) {
        layer.append(L(x(40), Y1, x(40), Y0, 's-bad dash'), T(x(40) + 4, Y1 + 12, 'Broker sập ở 40s!', 'sm f-bad lbl-strong'));
      }

      s1.update(fmt(processed) + ' msg', 'ok', 'Consumer đã tiêu thụ');
      s2.update(fmt(dropped) + ' msg', dropped ? 'bad' : 'ok', st === 'drop' ? 'Bị vứt bỏ vì quá tốc độ' : crash ? 'Mất bộ đệm RAM khi sập' : 'Không mất tin nào');
      s3.update(fmt(q) + ' msg', q > 2000 ? 'warn' : 'accent', st === 'bp' ? 'Giữ ổn định nhờ chặn Producer' : 'Tích tụ khi P > C');
    }
    render();
  });

  // =====================================================================
  // 12.3 direct-broker — Direct messaging vs Message broker
  // =====================================================================
  widget('direct-broker', (root) => {
    const mode = seg({
      label: 'Kiến trúc truyền tin',
      options: [
        { value: 'udp', label: 'Trực tiếp (UDP / Webhook không đệm)' },
        { value: 'direct-retry', label: 'Trực tiếp + Producer giữ bộ đệm gửi lại' },
        { value: 'broker', label: 'Qua Message Broker bền vững' },
      ],
      value: 'broker',
      onChange: render,
    });
    const consDown = checkbox('Consumer tạm offline ở m3, m4, m5', true, render);
    const prodCrash = checkbox('Producer bị sập ngay sau khi gửi m5 (mất RAM của Producer)', true, render);

    const laneWrap = h('div');
    const s1 = stat('Message gửi đi', '8 (m1..m8)', 'accent', '1 message/giây'),
          s2 = stat('Consumer nhận được', '–'),
          s3 = stat('Message bị mất', '–');

    root.append(mode.el, consDown.el, prodCrash.el, laneWrap, h('div', { class: 'stats' }, s1, s2, s3));

    function render() {
      clear(laneWrap);
      const m = mode.value, cOff = consDown.input.checked, pDie = prodCrash.input.checked;
      const msgs = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8'];
      const received = [], lost = [];

      msgs.forEach((id, idx) => {
        const num = idx + 1;
        const duringOff = cOff && (num >= 3 && num <= 5);
        if (!duringOff) {
          received.push(id);
        } else if (m === 'broker') {
          received.push(id);
        } else if (m === 'direct-retry') {
          if (pDie) lost.push(id);
          else received.push(id);
        } else {
          lost.push(id);
        }
      });

      const mkRow = (title, items) => h('div', { class: 'lane' }, h('b', title), h('div', { class: 'msgs' }, items));
      laneWrap.append(
        mkRow('Producer phát:', msgs.map((id, i) => h('span', { class: 'm ' + (cOff && i >= 2 && i <= 4 ? 'warn' : 'acc') }, id))),
        mkRow('Consumer nhận:', msgs.map((id) =>
          received.includes(id)
            ? h('span', { class: 'm ok' }, id)
            : h('span', { class: 'm bad dim' }, id + ' (mất)')
        ))
      );

      s2.update(`${received.length}/8`, received.length === 8 ? 'ok' : 'warn', received.join(', '));
      s3.update(lost.length ? lost.join(', ') : '0 (Không mất)', lost.length ? 'bad' : 'ok',
        m === 'broker' ? 'Broker giữ hộ trên đĩa khi Consumer offline' :
        m === 'direct-retry' && pDie ? 'Producer sập làm mất bộ đệm retry m3..m5' : 'Gửi trực tiếp đòi cả 2 bên cùng online');
    }
    render();
  });

  // =====================================================================
  // 12.4a lb-fanout — Load balancing vs Fan-out vs Combined
  // =====================================================================
  widget('lb-fanout', (root) => {
    const mode = seg({
      label: 'Mô hình phân phối',
      options: [
        { value: 'lb', label: 'Load balancing (Chia việc trong 1 nhóm)' },
        { value: 'fanout', label: 'Fan-out (Phát cho mọi Consumer)' },
        { value: 'both', label: 'Kết hợp (2 nhóm Fan-out, mỗi nhóm 2 Consumer chia việc)' },
      ],
      value: 'both',
      onChange: render,
    });
    const lanes = h('div');
    root.append(mode.el, lanes);

    function render() {
      clear(lanes);
      const m = mode.value;
      const msgs = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'];
      const row = (lbl, list, tone) => h('div', { class: 'lane' }, h('b', lbl), h('div', { class: 'msgs' }, list.map((x) => h('span', { class: 'm ' + tone }, x))));

      if (m === 'lb') {
        lanes.append(
          row('Nhóm A · Consumer 1', ['m1', 'm3', 'm5'], 'acc'),
          row('Nhóm A · Consumer 2', ['m2', 'm4', 'm6'], 'acc')
        );
      } else if (m === 'fanout') {
        lanes.append(
          row('Consumer 1 (Search)', msgs, 'acc'),
          row('Consumer 2 (Analytics)', msgs, 'vio')
        );
      } else {
        lanes.append(
          row('Nhóm A · Consumer A1', ['m1', 'm3', 'm5'], 'acc'),
          row('Nhóm A · Consumer A2', ['m2', 'm4', 'm6'], 'acc'),
          row('Nhóm B · Consumer B1', ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'], 'vio')
        );
      }
    }
    render();
  });

  // =====================================================================
  // 12.4b redelivery — Acknowledgments & Redelivery reordering (Fig 11-2)
  // =====================================================================
  widget('redelivery', (root) => {
    const scen = seg({
      label: 'Kịch bản',
      options: [
        { value: 'crash', label: 'Consumer 2 sập khi đang xử lý m3 (Hình 11-2)' },
        { value: 'lostack', label: 'Ack của m3 bị mất trên mạng (Xử lý lặp 2 lần)' },
      ],
      value: 'crash',
      onChange: () => { step = 3; render(); },
    });
    let step = 3;
    const btnStep = button('Bước tiếp ▶', () => { step = (step % 4) + 1; render(); });
    const note = h('div', { class: 'step-note' });
    const lanes = h('div');

    root.append(
      h('div', { class: 'btn-row' }, scen.el, btnStep),
      note,
      lanes
    );

    function render() {
      clear(lanes);
      const isCrash = scen.value === 'crash';
      const stepsDesc = [
        'Bước 1/4: Broker giao m1, m2 rồi giao m3 cho Consumer 2, và giao m4 cho Consumer 1.',
        isCrash
          ? 'Bước 2/4: Consumer 1 xử lý xong m4 và gửi Ack. Cùng lúc đó Consumer 2 bị SẬP khi đang xử lý m3!'
          : 'Bước 2/4: Consumer 2 xử lý xong m3 nhưng gói tin Ack bị rớt mạng! Consumer 1 xử lý xong m4.',
        'Bước 3/4: Hết timeout chờ Ack của m3, Broker đưa m3 trở lại hàng đợi và giao lại m3 cho Consumer 1.',
        'Bước 4/4: Consumer 1 nhận m3 SAU KHI đã xử lý m4! Thứ tự tại Consumer 1 bị đảo thành: m1 → m4 → m3 → m5.',
      ];
      note.textContent = stepsDesc[step - 1];

      const c1 = step === 1 ? ['m1', 'm4 (đang chạy)'] : step === 2 ? ['m1', 'm4 ✓'] : step === 3 ? ['m1', 'm4 ✓', 'm3 (giao lại!)'] : ['m1', 'm4 ✓', 'm3 ✓ (ĐẢO THỨ TỰ!)', 'm5 ✓'];
      const c2 = step === 1 ? ['m2 ✓', 'm3 (đang chạy)'] : isCrash ? ['m2 ✓', 'm3 ✗ (SẬP!)'] : ['m2 ✓', 'm3 ✓ (Ack mất → bị chạy lần 2 ở C1!)'];

      lanes.append(
        h('div', { class: 'lane' }, h('b', 'Consumer 1'), h('div', { class: 'msgs' }, c1.map((x) => h('span', { class: 'm ' + (x.includes('m3') ? 'warn' : 'ok') }, x)))),
        h('div', { class: 'lane' }, h('b', 'Consumer 2'), h('div', { class: 'msgs' }, c2.map((x) => h('span', { class: 'm ' + (x.includes('m3') ? 'bad' : 'acc') }, x))))
      );
    }
    render();
  });

  // =====================================================================
  // 12.5 kafka-log — Partitioned log, offsets, consumer groups & replay
  // =====================================================================
  widget('kafka-log', (root) => {
    const numConsA = slider({ label: 'Số Consumer trong Nhóm A', min: 1, max: 4, step: 1, value: 3, format: (v) => v + ' consumer', onInput: render });
    let offB = 4;
    const btnAppend = button('Producer gửi thêm 3 message', () => {
      parts[0].push('k1:' + parts[0].length);
      parts[1].push('k2:' + parts[1].length);
      parts[2].push('k3:' + parts[2].length);
      render();
    });
    const btnRewindB = button('Tua Nhóm B về offset 0 (Replay)', () => { offB = 0; render(); }, 'ghost');
    const btnStepB = button('Nhóm B đọc +1 offset', () => { offB = Math.min(parts[0].length, offB + 1); render(); }, 'ghost');

    const parts = [
      ['u1:login', 'u4:view', 'u1:cart', 'u7:view', 'u1:pay'],
      ['u2:view', 'u5:login', 'u2:cart', 'u8:view', 'u5:pay'],
      ['u3:login', 'u6:view', 'u3:pay', 'u9:login', 'u6:cart'],
    ];

    const lanes = h('div');
    const s1 = stat('Phân công Nhóm A', '–'), s2 = stat('Offset của Nhóm B', '–'), s3 = stat('Đọc có xoá message?', 'KHÔNG BAO GIỜ', 'ok', 'Chỉ dời con trỏ offset');

    root.append(
      h('div', { class: 'controls' }, numConsA.el),
      h('div', { class: 'btn-row' }, btnAppend, btnRewindB, btnStepB),
      lanes,
      h('div', { class: 'stats' }, s1, s2, s3)
    );

    function render() {
      clear(lanes);
      const nA = numConsA.value;
      const ownerA = (pIdx) => (nA === 1 ? 'A1' : nA === 2 ? (pIdx < 2 ? 'A1' : 'A2') : `A${pIdx + 1}`);

      parts.forEach((logArr, pIdx) => {
        lanes.appendChild(h('div', { class: 'lane' },
          h('b', `Partition ${pIdx} (→ ${ownerA(pIdx)})`),
          h('div', { class: 'msgs' }, logArr.map((msg, off) =>
            h('span', { class: 'm ' + (off < offB ? 'ok' : 'acc') }, `#${off} ${msg}`)
          ))
        ));
      });

      s1.update(nA <= 3 ? `${nA} consumer chia 3 partition` : 'A4 ngồi chơi (Idle)!', nA <= 3 ? 'ok' : 'warn',
        nA > 3 ? 'Số consumer trong 1 nhóm không vượt được số partition' : 'Mỗi partition chỉ do 1 consumer trong nhóm đọc');
      s2.update(`Offset = ${offB}`, 'accent', offB === 0 ? 'Đã tua về đầu log để tính lại!' : `Đã đọc ${offB}/${parts[0].length} bản ghi mỗi partition`);
    }
    render();
  });

  // =====================================================================
  // 12.6a hol — Head-of-line blocking: per-message queue vs partitioned log
  // =====================================================================
  widget('hol', (root) => {
    const slowDur = slider({ label: 'Thời gian xử lý message khó m3', min: 1, max: 10, step: 1, value: 7, format: (v) => v + ' s (bình thường 1 s)', onInput: render });
    const svg = mkSvg(640, 175, 'So sánh chia từng message (AMQP) và chia theo Partition (Kafka) khi m3 bị chậm');
    const layer = s('g'); svg.appendChild(layer);
    const s1 = stat('JMS/AMQP (Chia từng message)', '–'), s2 = stat('Log (Gắn cố định Partition)', '–'), s3 = stat('Message bị chặn sau m3', 'm6, m9, m12', 'warn', 'Head-of-line blocking trong Partition 0');

    root.append(
      h('div', { class: 'controls' }, slowDur.el),
      h('div', { class: 'viz' }, svg),
      h('div', { class: 'stats' }, s1, s2, s3)
    );

    function render() {
      clear(layer);
      const sd = slowDur.value;
      const X0 = 135, X1 = 620, TMAX = 15;
      const x = (t) => X0 + (t / TMAX) * (X1 - X0);

      // Partition 0 gets m3 (slow), m6, m9, m12 -> total time = sd + 3
      const p0Total = sd + 3;
      // Work queue with 3 consumers shares non-slow messages around m3
      const mqTotal = Math.max(sd, Math.ceil((11 + sd) / 3));

      layer.append(
        T(8, 38, 'AMQP Queue (3 worker)', 'lbl-strong sm'),
        R(x(0), 22, x(sd) - x(0), 22, 'f-mark-soft s-warn', { rx: 4 }),
        TM(x(sd / 2), 37, `W1: m3 (${sd}s)`, 'sm lbl-strong'),
        R(x(0), 48, x(mqTotal) - x(0), 18, 'f-ok-soft s-ok', { rx: 4 }),
        TM(x(mqTotal / 2), 61, 'W2 & W3 chia nhau m4..m12 (không chờ m3)', 'sm'),

        T(8, 118, 'Kafka Partition 0', 'lbl-strong sm'),
        R(x(0), 102, x(sd) - x(0), 24, 'f-bad-soft s-bad', { rx: 4 }),
        TM(x(sd / 2), 118, `m3 (${sd}s)`, 'sm lbl-strong f-bad'),
        R(x(sd), 102, x(p0Total) - x(sd), 24, 'f-accent-soft s-accent', { rx: 4 }),
        TM(x((sd + p0Total) / 2), 118, 'm6, m9, m12 bị chặn!', 'sm lbl-strong')
      );

      for (let t = 0; t <= TMAX; t += 3) {
        layer.append(L(x(t), 14, x(t), 145, 'grid'), TM(x(t), 162, t + 's', 'sm'));
      }

      s1.update(`${mqTotal} giây`, 'ok', 'Worker khác xử lý hộ các message sau m3');
      s2.update(`${p0Total} giây`, p0Total > mqTotal ? 'bad' : 'ok', 'Giữ đúng thứ tự nhưng m6, m9, m12 phải xếp hàng chờ m3');
    }
    render();
  });

  // =====================================================================
  // 12.6b retention — Log as circular buffer on disk (6 TB, 150 MB/s)
  // =====================================================================
  widget('retention', (root) => {
    const diskTB = slider({ label: 'Dung lượng đĩa dành cho Log', min: 1, max: 12, step: 1, value: 6, format: (v) => v + ' TB', onInput: render });
    const rateMB = slider({ label: 'Tốc độ ghi tuần tự', min: 15, max: 300, step: 15, value: 150, format: (v) => v + ' MB/s', onInput: render });
    const lagHrs = slider({ label: 'Consumer bị tụt lại (Lag)', min: 1, max: 24, step: 1, value: 8, format: (v) => v + ' giờ', onInput: render });

    const s1 = stat('Thời gian lưu tối đa (Retention)', '–'), s2 = stat('Vị trí đọc của Consumer', '–'), s3 = stat('Trạng thái dữ liệu', '–');
    root.append(
      h('div', { class: 'controls' }, diskTB.el, rateMB.el, lagHrs.el),
      h('div', { class: 'stats' }, s1, s2, s3)
    );

    function render() {
      const capHours = (diskTB.value * 1e6) / (rateMB.value * 3600);
      const lag = lagHrs.value;
      const safe = lag <= capHours;
      s1.update(fmt(capHours, 1) + ' giờ', 'accent', `${diskTB.value} TB / ${rateMB.value} MB/s`);
      s2.update(`Cách đầu log ${lag} giờ`, safe ? 'ok' : 'bad', `Chiếm ${pct(Math.min(1.5, lag / capHours), 0)} bộ đệm vòng`);
      s3.update(safe ? 'An toàn (Đọc bù được)' : 'MẤT MESSAGE (Segment đã bị xoá!)', safe ? 'ok' : 'bad',
        safe ? 'Chỉ đọc từ đĩa, không làm chậm Producer' : 'Consumer tụt quá xa ngoài cửa sổ lưu trữ');
    }
    render();
  });

  // =====================================================================
  // 12.7 dual-writes — Dual writes race condition (Fig 11-4) vs CDC
  // =====================================================================
  widget('dual-writes', (root) => {
    const mode = seg({
      label: 'Kiến trúc đồng bộ',
      options: [
        { value: 'dual', label: 'Dual Writes (Ứng dụng tự ghi cả DB và Search Index)' },
        { value: 'cdc', label: 'Change Data Capture (DB là Leader → Index đọc Changelog)' },
      ],
      value: 'dual',
      onChange: render,
    });
    const orderSeg = seg({
      label: 'Thứ tự gói tin tới Search Index',
      options: [
        { value: 'race', label: 'Hình 11-4 (Index nhận B trước A → Lệch vĩnh viễn!)' },
        { value: 'lucky', label: 'May mắn cùng thứ tự (A trước B)' },
      ],
      value: 'race',
      onChange: render,
    });

    const svg = mkSvg(640, 185, 'Dual Writes vs Change Data Capture');
    const layer = s('g'); svg.appendChild(layer);
    const s1 = stat('Giá trị cuối trong Database', '–'), s2 = stat('Giá trị cuối trong Search Index', '–'), s3 = stat('Trạng thái nhất quán', '–');

    root.append(
      h('div', { class: 'controls' }, mode.el, orderSeg.el),
      h('div', { class: 'viz' }, svg),
      h('div', { class: 'stats' }, s1, s2, s3)
    );

    function render() {
      clear(layer);
      const isCDC = mode.value === 'cdc';
      const isRace = orderSeg.value === 'race' && !isCDC;

      const dbFinal = 'B';
      const idxFinal = isRace ? 'A' : 'B';

      layer.append(
        R(40, 24, 150, 52, 'f-accent-soft s-accent', { rx: 6 }),
        TM(115, 46, 'Client 1: X = A', 'sm lbl-strong'),
        TM(115, 64, 'Client 2: X = B', 'sm lbl-strong'),

        R(245, 24, 175, 52, 'f-ok-soft s-ok', { rx: 6 }),
        TM(332, 46, 'Database (System of Record)', 'sm lbl-strong'),
        TM(332, 64, `Thứ tự: A → B (Cuối: X = ${dbFinal})`, 'sm f-ok lbl-strong'),

        R(245, 110, 175, 52, isRace ? 'f-bad-soft s-bad' : 'f-ok-soft s-ok', { rx: 6 }),
        TM(332, 132, 'Search Index', 'sm lbl-strong'),
        TM(332, 150, isRace ? 'Thứ tự: B → A (Cuối: X = A!)' : 'Thứ tự: A → B (Cuối: X = B)', 'sm lbl-strong ' + (isRace ? 'f-bad' : 'f-ok'))
      );

      if (isCDC) {
        layer.append(
          L(332, 76, 332, 110, 's-accent sw2'),
          T(344, 98, 'CDC Changelog giữ đúng thứ tự A → B', 'sm f-accent lbl-strong')
        );
      } else {
        layer.append(
          L(190, 42, 245, 42, 's-ink3'),
          L(190, 58, 245, 136, isRace ? 's-bad dash' : 's-ink3'),
          T(435, 138, isRace ? 'Đua mạng: Ghi kép lệch nhau mãi mãi!' : 'Ghi kép tình cờ đúng thứ tự', 'sm ' + (isRace ? 'f-bad' : 'f-warn'))
        );
      }

      s1.update('X = ' + dbFinal, 'ok', 'Ghi tuần tự A rồi B');
      s2.update('X = ' + idxFinal, isRace ? 'bad' : 'ok', isRace ? 'A ghi đè lên B ở Index!' : 'Khớp với Database');
      s3.update(isRace ? 'LỆCH VĨNH VIỄN!' : 'Nhất quán', isRace ? 'bad' : 'ok',
        isCDC ? 'Một Leader duy nhất (DB) quyết định thứ tự' : 'Không có lỗi mạng nào báo về nhưng dữ liệu sai');
    }
    render();
  });

  // =====================================================================
  // 12.8 cdc-snapshot — Initial snapshot + changelog offset
  // =====================================================================
  widget('cdc-snapshot', (root) => {
    const strat = seg({
      label: 'Cách dựng Search Index mới (Log chỉ còn giữ từ offset #10)',
      options: [
        { value: 'logonly', label: 'Chỉ đọc phần Changelog còn lại (từ #10)' },
        { value: 'unaligned', label: 'Chụp Snapshot lúc #12 nhưng đọc Log từ #14 (Lệch offset)' },
        { value: 'aligned', label: 'Snapshot nhất quán tại đúng offset #10 + Đọc Log từ #11' },
      ],
      value: 'aligned',
      onChange: render,
    });

    const wrap = h('div', { class: 'table-wrap' });
    const s1 = stat('Tổng số khoá trong DB', '4 khoá (k1..k4)', 'ok', 'k1 ghi ở #3, k2 ở #7, k3 ở #11, k4 ở #13'),
          s2 = stat('Số khoá khớp trong Index', '–'),
          s3 = stat('Kết luận', '–');

    root.append(strat.el, wrap, h('div', { class: 'stats' }, s1, s2, s3));

    function render() {
      clear(wrap);
      const st = strat.value;
      const rows = [
        { k: 'k1 (ghi lúc #3)', db: 'Áo khoác', idx: st === 'logonly' ? 'THIẾU (Log #3 đã xoá)' : 'Áo khoác' },
        { k: 'k2 (ghi lúc #7)', db: 'Giày chạy', idx: st === 'logonly' ? 'THIẾU (Log #7 đã xoá)' : 'Giày chạy' },
        { k: 'k3 (cập nhật lúc #11)', db: 'Balo v2', idx: 'Balo v2' },
        { k: 'k4 (cập nhật lúc #13)', db: 'Mũ len v2', idx: st === 'unaligned' ? 'Mũ len v1 (Bỏ sót #13!)' : 'Mũ len v2' },
      ];

      const tbl = h('table', { class: 'data' },
        h('thead', h('tr', h('th', 'Khoá'), h('th', 'Giá trị trong Database'), h('th', 'Giá trị trong Search Index'))),
        h('tbody', rows.map((r) =>
          h('tr', { class: r.db !== r.idx ? 'hit' : '' }, h('td', r.k), h('td', r.db), h('td', r.idx))
        ))
      );
      wrap.appendChild(tbl);

      const matched = rows.filter((r) => r.db === r.idx).length;
      s2.update(`${matched}/4 khoá`, matched === 4 ? 'ok' : 'bad', matched === 4 ? 'Đầy đủ 100%' : 'Dòng tô màu bị thiếu hoặc cũ');
      s3.update(matched === 4 ? 'Chuẩn xác' : 'Index bị khuyết dữ liệu!', matched === 4 ? 'ok' : 'bad',
        'Snapshot ban đầu bắt buộc phải gắn với một offset xác định trong log');
    }
    render();
  });

  // =====================================================================
  // 12.9 compaction — Log compaction & tombstones
  // =====================================================================
  widget('compaction', (root) => {
    let entries = [
      { off: 0, k: 'u1', v: 'An' },
      { off: 1, k: 'u2', v: 'Bình' },
      { off: 2, k: 'u1', v: 'An_v2' },
      { off: 3, k: 'u3', v: 'Chi' },
      { off: 4, k: 'u2', v: null }, // tombstone
      { off: 5, k: 'u1', v: 'An_v3' },
    ];
    let compacted = false;

    const btnAdd = button('Ghi cập nhật u3 = Chi_v2', () => {
      entries.push({ off: entries.length, k: 'u3', v: 'Chi_v' + (entries.length - 1) });
      compacted = false;
      render();
    });
    const btnTomb = button('Xoá u3 (Ghi Tombstone null)', () => {
      entries.push({ off: entries.length, k: 'u3', v: null });
      compacted = false;
      render();
    }, 'ghost');
    const btnCompact = button('Chạy Log Compaction ngay', () => { compacted = true; render(); });
    const btnReset = button('Đặt lại Log', () => {
      entries = [
        { off: 0, k: 'u1', v: 'An' },
        { off: 1, k: 'u2', v: 'Bình' },
        { off: 2, k: 'u1', v: 'An_v2' },
        { off: 3, k: 'u3', v: 'Chi' },
        { off: 4, k: 'u2', v: null },
        { off: 5, k: 'u1', v: 'An_v3' },
      ];
      compacted = false;
      render();
    }, 'ghost');

    const msgBox = h('div', { class: 'msgs' });
    const s1 = stat('Tổng bản ghi trong Log', '–'), s2 = stat('Bản ghi giữ lại sau Compaction', '–'), s3 = stat('Cần Snapshot khi dựng Index mới?', 'Không cần (Đọc từ offset 0)', 'ok', 'Log đã nén chỉ giữ bản mới nhất mỗi key');

    root.append(
      h('div', { class: 'btn-row' }, btnAdd, btnTomb, btnCompact, btnReset),
      msgBox,
      h('div', { class: 'stats' }, s1, s2, s3)
    );

    function render() {
      clear(msgBox);
      const lastOffByKey = {};
      entries.forEach((e) => { lastOffByKey[e.k] = e.off; });

      let kept = 0;
      entries.forEach((e) => {
        const isLatest = lastOffByKey[e.k] === e.off;
        if (isLatest) kept++;
        if (compacted && !isLatest) return;
        const txt = `#${e.off} ${e.k}: ${e.v === null ? 'null (tombstone)' : e.v}`;
        msgBox.appendChild(h('span', {
          class: 'm ' + (!isLatest ? 'dim' : e.v === null ? 'bad' : 'ok'),
        }, txt));
      });

      s1.update(`${entries.length} bản ghi`, 'accent', 'Trước khi dọn dẹp');
      s2.update(`${kept} bản ghi`, 'ok', compacted ? 'Đã xoá bỏ các bản ghi cũ bị ghi đè' : 'Các ô gạch ngang sẽ bị loại khi chạy Compaction');
    }
    render();
  });

  // =====================================================================
  // 12.10 cmd-event — Event Sourcing: Command validated -> Event logged
  // =====================================================================
  widget('cmd-event', (root) => {
    let events = [
      { seat: '1A', user: 'Lan' },
      { seat: '2B', user: 'Minh' },
    ];
    let lastMsg = 'Sẵn sàng: chọn ghế hoặc bấm thử nghiệm tranh chấp.';

    const bookSeat = (seat, user) => {
      const taken = events.find((e) => e.seat === seat);
      if (taken) {
        lastMsg = `TỪ CHỐI Command: Ghế ${seat} đã có người đặt (${taken.user})! Command bị bác bỏ trước khi vào Event Log.`;
      } else {
        events.push({ seat, user });
        lastMsg = `CHẤP NHẬN Command → Đã ghi Event bất biến: SeatReserved(${seat}, ${user}).`;
      }
      render();
    };

    const btnRace = button('Hai khách (Hùng & Mai) cùng đặt ghế 1B và 2B', () => {
      bookSeat('1B', 'Hùng');
      bookSeat('2B', 'Mai'); // 2B already taken by Minh -> rejected!
    });
    const btnReset = button('Đặt lại sơ đồ ghế', () => {
      events = [{ seat: '1A', user: 'Lan' }, { seat: '2B', user: 'Minh' }];
      lastMsg = 'Đã đặt lại log về 2 sự kiện ban đầu.';
      render();
    }, 'ghost');

    const seatGrid = h('div', { class: 'seat-grid' });
    const logView = h('div', { class: 'msgs' });
    const note = h('div', { class: 'step-note' });

    root.append(
      h('div', { class: 'btn-row' }, btnRace, btnReset),
      note,
      h('div', { class: 'lab-split' },
        h('div', { class: 'box' }, h('h5', 'Trạng thái ghế (Dẫn xuất từ Event Log — bấm ghế để đặt)'), seatGrid),
        h('div', { class: 'box' }, h('h5', 'Event Log (Sự thật bất biến)'), logView)
      )
    );

    function render() {
      clear(seatGrid);
      clear(logView);
      note.textContent = lastMsg;

      const allSeats = ['1A', '1B', '1C', '1D', '2A', '2B', '2C', '2D'];
      const map = {};
      events.forEach((e) => { map[e.seat] = e.user; });

      allSeats.forEach((st) => {
        const owner = map[st];
        seatGrid.appendChild(h('button', {
          type: 'button',
          class: 'seat' + (owner ? ' taken' : ''),
          onClick: () => bookSeat(st, 'Khách_' + (events.length + 1)),
        }, owner ? `${st}: ${owner}` : `${st} (Trống)`));
      });

      events.forEach((e, i) => {
        logView.appendChild(h('span', { class: 'm ok' }, `#${i} Reserved(${e.seat}, ${e.user})`));
      });
    }
    render();
  });

  // =====================================================================
  // 12.11a log-views — State as integral of stream & CQRS multiple views
  // =====================================================================
  widget('log-views', (root) => {
    const allEvs = [
      { t: 1, type: 'ADD', item: 'Sách DDIA', qty: 1 },
      { t: 2, type: 'ADD', item: 'Bút chì', qty: 2 },
      { t: 3, type: 'ADD', item: 'Áo thun', qty: 1 },
      { t: 4, type: 'REMOVE', item: 'Bút chì', qty: 2 },
      { t: 5, type: 'CHECKOUT', item: 'Đơn #99', qty: 1 },
    ];
    const replaySl = slider({ label: 'Phát lại Event Log đến vị trí', min: 1, max: 5, step: 1, value: 5, format: (v) => `Event #${v}/${allEvs.length}`, onInput: render });

    const split = h('div', { class: 'card-grid wide' });
    root.append(
      h('div', { class: 'controls' }, replaySl.el),
      split
    );

    function render() {
      clear(split);
      const upto = replaySl.value;
      const slice = allEvs.slice(0, upto);
      const cart = {};
      const considered = new Set();
      slice.forEach((e) => {
        if (e.type === 'ADD') { cart[e.item] = (cart[e.item] || 0) + e.qty; considered.add(e.item); }
        if (e.type === 'REMOVE') { delete cart[e.item]; }
      });

      split.append(
        h('div', { class: 'mcard' },
          h('h5', 'Event Log (Append-only)'),
          slice.map((e) => h('div', { class: 'm acc' }, `#${e.t} ${e.type}: ${e.item}`))
        ),
        h('div', { class: 'mcard active' },
          h('h5', 'View 1: Giỏ hàng hiện tại (OLTP)'),
          Object.keys(cart).length
            ? Object.entries(cart).map(([k, v]) => h('div', { class: 'grp-res' }, `${k} × ${v}`))
            : h('div', { class: 'sub' }, '(Trống)')
        ),
        h('div', { class: 'mcard active' },
          h('h5', 'View 2: Phân tích hành vi (Analytics)'),
          h('div', { class: 'grp-res' }, `Đã từng cân nhắc: ${[...considered].join(', ')}`),
          h('div', { class: 'sub' }, 'Dù đã xoá Bút chì khỏi giỏ, Event Log vẫn giữ lại thông tin khách từng quan tâm!')
        )
      );
    }
    render();
  });

  // =====================================================================
  // 12.11b async-view — Read-your-writes lag on asynchronous CQRS view
  // =====================================================================
  widget('async-view', (root) => {
    const lagSl = slider({ label: 'Độ trễ Consumer cập nhật View', min: 50, max: 1000, step: 50, value: 350, format: fmtMs, onInput: render });
    const readSl = slider({ label: 'Thời điểm người dùng đọc lại trang hồ sơ', min: 50, max: 1000, step: 50, value: 200, format: fmtMs, onInput: render });

    const s1 = stat('Tỉ lệ người dùng thấy tên cũ', '–'), s2 = stat('Khoảng trống bất nhất', '–'), s3 = stat('Cách khắc phục', 'Chờ Offset hoặc Gắn phiên', 'accent', 'Read-your-writes consistency');
    root.append(
      h('div', { class: 'controls' }, lagSl.el, readSl.el),
      h('div', { class: 'stats' }, s1, s2, s3)
    );

    function render() {
      const lag = lagSl.value, rd = readSl.value;
      // Assume consumer lag fluctuates +/- 40% around lag
      const ratio = clamp((lag * 1.4 - rd) / (lag * 0.8), 0, 1);
      s1.update(pct(ratio, 0), ratio > 0.1 ? 'bad' : 'ok', `${Math.round(ratio * 1000)}/1.000 người dùng tưởng việc lưu bị lỗi`);
      s2.update(fmtMs(Math.max(0, lag - rd)), lag > rd ? 'warn' : 'ok', lag > rd ? 'Đọc sớm hơn lúc View kịp cập nhật' : 'View đã cập nhật xong trước khi đọc');
    }
    render();
  });

  // =====================================================================
  // 12.12 stored-queries — CEP & Percolator (stored queries, streaming data)
  // =====================================================================
  widget('stored-queries', (root) => {
    const sampleEvents = [
      { text: 'Căn hộ Quận 1 · 2PN · 3,2 tỷ', q1: true, q2: false },
      { text: 'Nhà phố Thủ Đức · 3PN · 5,8 tỷ', q1: false, q2: true },
      { text: 'Căn hộ Quận 7 · 1PN · 2,1 tỷ', q1: false, q2: false },
      { text: 'Căn hộ Quận 1 · 3PN · 3,4 tỷ', q1: true, q2: true },
    ];
    let idx = 2;
    const btnPush = button('Phát thêm Event mới qua bộ lọc', () => { idx = (idx % sampleEvents.length) + 1; render(); });
    const lanes = h('div');

    root.append(h('div', { class: 'btn-row' }, btnPush), lanes);

    function render() {
      clear(lanes);
      const evs = sampleEvents.slice(0, idx);
      lanes.append(
        h('div', { class: 'lane' }, h('b', 'Luồng Event mới vào:'), h('div', { class: 'msgs' }, evs.map((e) => h('span', { class: 'm acc' }, e.text)))),
        h('div', { class: 'lane' }, h('b', 'Query #1 (Quận 1 ≤ 3,5 tỷ):'), h('div', { class: 'msgs' }, evs.filter((e) => e.q1).map((e) => h('span', { class: 'm ok' }, 'KHỚP: ' + e.text)))),
        h('div', { class: 'lane' }, h('b', 'Query #2 (≥ 3 Phòng ngủ):'), h('div', { class: 'msgs' }, evs.filter((e) => e.q2).map((e) => h('span', { class: 'm vio' }, 'KHỚP: ' + e.text))))
      );
    }
    render();
  });

  // =====================================================================
  // 12.13a event-time — Event time vs Processing time (Fig 11-7 backlog spike)
  // =====================================================================
  widget('event-time', (root) => {
    const outage = checkbox('Stream processor dừng 1 phút ở phút thứ 3 để redeploy (tạo backlog)', true, render);
    const stragMode = seg({
      label: 'Xử lý Straggler đến muộn',
      options: [
        { value: 'drop', label: 'Bỏ qua sự kiện đến sau khi đóng cửa sổ' },
        { value: 'retract', label: 'Phát bản cập nhật sửa lại cửa sổ cũ' },
      ],
      value: 'retract',
      onChange: render,
    });

    const svg = mkSvg(640, 185, 'Đếm sự kiện mỗi phút theo Processing Time và Event Time');
    const layer = s('g'); svg.appendChild(layer);
    const s1 = stat('Theo Processing Time', '–'), s2 = stat('Theo Event Time', '–'), s3 = stat('Straggler đến muộn', '–');

    root.append(
      outage.el,
      h('div', { class: 'controls' }, stragMode.el),
      h('div', { class: 'viz' }, svg),
      h('div', { class: 'stats' }, s1, s2, s3)
    );

    function render() {
      clear(layer);
      const hasOutage = outage.input.checked;
      const isRetract = stragMode.value === 'retract';
      const procCounts = hasOutage ? [10, 10, 0, 20, 10, 10] : [10, 10, 10, 10, 10, 10];
      const evCounts = isRetract ? [10, 10, 10, 10, 10, 10] : [10, 10, 8, 10, 10, 10];

      const X0 = 65, X1 = 610, Y0 = 152, Y1 = 24;
      const y = (v) => Y0 - (v / 24) * (Y0 - Y1);
      layer.append(L(X0, Y0, X1, Y0, 'axis'));

      for (let i = 0; i < 6; i++) {
        const bx = X0 + 20 + i * 86;
        const pc = procCounts[i], ec = evCounts[i];
        layer.append(
          R(bx, y(pc), 28, Y0 - y(pc), pc === 20 || pc === 0 ? 'f-bad-soft s-bad' : 'f-surface2 s-line', { rx: 3 }),
          R(bx + 32, y(ec), 28, Y0 - y(ec), 'f-ok-soft s-ok', { rx: 3 }),
          TM(bx + 30, Y0 + 18, `Phút ${i + 1}`, 'sm lbl-strong'),
          TM(bx + 14, y(pc) - 5, String(pc), 'sm f-bad'),
          TM(bx + 46, y(ec) - 5, String(ec), 'sm f-ok')
        );
      }

      s1.update(hasOutage ? 'Phút 3: 0 · Phút 4: 20 (Cú vọt giả!)' : 'Đều 10/phút', hasOutage ? 'bad' : 'ok', 'Nhầm tốc độ xử lý backlog thành tăng vọt lưu lượng');
      s2.update(isRetract ? 'Đều 10/phút (Chính xác)' : 'Phút 3 thiếu 2 straggler', isRetract ? 'ok' : 'warn', 'Dựa vào timestamp bên trong bản thân event');
      s3.update(isRetract ? 'Đã cộng bù (+2)' : 'Bị loại (2 event)', isRetract ? 'ok' : 'warn', 'Khi phát hiện event muộn sau watermark');
    }
    render();
  });

  // =====================================================================
  // 12.13b three-clocks — Estimating mobile device clock offset with 3 timestamps
  // =====================================================================
  widget('three-clocks', (root) => {
    const skewMin = slider({ label: 'Đồng hồ điện thoại bị chạy nhanh', min: -30, max: 60, step: 5, value: 25, format: (v) => (v >= 0 ? '+' + v : v) + ' phút', onInput: render });
    const offlineMin = slider({ label: 'Người dùng offline trước khi gửi lên Server', min: 0, max: 180, step: 15, value: 60, format: (v) => v + ' phút', onInput: render });

    const s1 = stat('t1 (Xảy ra theo máy khách)', '–'),
          s2 = stat('t2 (Gửi theo máy khách) & t3 (Server nhận)', '–'),
          s3 = stat('Thời điểm xảy ra ước lượng đúng', '10:00 (Chuẩn xác!)', 'ok', 't_true ≈ t1 + (t3 - t2)');

    root.append(
      h('div', { class: 'controls' }, skewMin.el, offlineMin.el),
      h('div', { class: 'stats' }, s1, s2, s3)
    );

    function render() {
      const sk = skewMin.value, off = offlineMin.value;
      const fmtClock = (minsFrom10) => {
        const total = 10 * 60 + minsFrom10;
        const hh = Math.floor(total / 60), mm = ((total % 60) + 60) % 60;
        return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      };
      const t1 = sk;
      const t2 = off + sk;
      const t3 = off;
      const est = t1 + (t3 - t2);

      s1.update(fmtClock(t1), sk !== 0 ? 'warn' : 'ok', `Lệch ${sk >= 0 ? '+' : ''}${sk} phút so với thực tế (10:00)`);
      s2.update(`t2=${fmtClock(t2)} · t3=${fmtClock(t3)}`, 'accent', `Độ lệch đo được: t3 - t2 = ${-sk} phút`);
      s3.update(fmtClock(est), 'ok', 'Khử được cả thời gian offline lẫn đồng hồ sai');
    }
    render();
  });

  // =====================================================================
  // 12.14 windows — Tumbling, Hopping, Sliding, Session windows
  // =====================================================================
  widget('windows', (root) => {
    const wType = seg({
      label: 'Loại cửa sổ thời gian',
      options: [
        { value: 'tumbling', label: 'Tumbling (Cố định, không chồng)' },
        { value: 'hopping', label: 'Hopping (Độ dài 6p, bước nhảy 3p)' },
        { value: 'sliding', label: 'Sliding (Khoảng cách ≤ 4p)' },
        { value: 'session', label: 'Session (Đóng khi im lặng ≥ 3p)' },
      ],
      value: 'tumbling',
      onChange: render,
    });
    const evs = [1, 2, 3.2, 6.5, 7.2, 8.1, 12.0, 12.8, 13.5, 17.2];
    const svg = mkSvg(640, 170, 'Bốn loại cửa sổ trên cùng chuỗi sự kiện');
    const layer = s('g'); svg.appendChild(layer);
    const s1 = stat('Số cửa sổ tạo ra', '–'), s2 = stat('Một event thuộc mấy cửa sổ?', '–'), s3 = stat('Đặc điểm', '–');

    root.append(wType.el, h('div', { class: 'viz' }, svg), h('div', { class: 'stats' }, s1, s2, s3));

    function render() {
      clear(layer);
      const X0 = 40, X1 = 615, TMAX = 20;
      const x = (t) => X0 + (t / TMAX) * (X1 - X0);

      layer.append(L(X0, 45, X1, 45, 'axis'));
      evs.forEach((et) => layer.append(C(x(et), 45, 5, 'f-accent')));

      let wins = [];
      const tp = wType.value;
      if (tp === 'tumbling') {
        wins = [[0, 5], [5, 10], [10, 15], [15, 20]];
        s2.update('Đúng 1 cửa sổ', 'ok', 'Không chồng lấp, không khoảng trống');
        s3.update('Độ dài cố định 5 phút', 'accent', 'Dễ cài đặt nhất');
      } else if (tp === 'hopping') {
        wins = [[0, 6], [3, 9], [6, 12], [9, 15], [12, 18]];
        s2.update('2 cửa sổ chồng nhau', 'accent', 'Độ dài 6p, nhảy mỗi 3p');
        s3.update('Làm mượt đường trung bình', 'ok', 'Có thể gộp từ các ô 3 phút');
      } else if (tp === 'sliding') {
        wins = [[0.5, 4.5], [5.5, 9.5], [11.5, 15.5]];
        s2.update('Tuỳ khoảng cách giữa 2 event', 'accent', 'Gom mọi cặp cách nhau ≤ 4p');
        s3.update('Không có ranh giới cố định', 'ok', 'Giữ bộ đệm trượt theo thời gian');
      } else {
        wins = [[0.8, 3.6], [6.2, 8.5], [11.7, 14.0], [16.9, 17.6]];
        s2.update('1 phiên hoạt động', 'ok', 'Tự ngắt khi người dùng nghỉ ≥ 3p');
        s3.update('Độ dài co giãn theo hành vi', 'accent', 'Dùng cho phân tích phiên truy cập');
      }

      wins.forEach(([a, b], i) => {
        const wy = 75 + (i % 2) * 36;
        const cnt = evs.filter((e) => e >= a && e <= b).length;
        layer.append(
          R(x(a), wy, x(b) - x(a), 26, 'f-violet-soft s-violet', { rx: 5 }),
          TM((x(a) + x(b)) / 2, wy + 17, `[${a}..${b}p]: ${cnt} event`, 'sm lbl-strong')
        );
      });
      s1.update(`${wins.length} cửa sổ`, 'ok', 'Trên trục 20 phút');
    }
    render();
  });

  // =====================================================================
  // 12.15 ss-join — Stream-stream join (Search + Click window join)
  // =====================================================================
  widget('ss-join', (root) => {
    const winSl = slider({ label: 'Độ dài cửa sổ chờ Click (Join Window)', min: 2, max: 15, step: 1, value: 10, format: (v) => v + ' phút', onInput: render });
    const searches = [
      { sess: 's1', q: '"ddia book"', t: 1 },
      { sess: 's2', q: '"kafka log"', t: 2 },
      { sess: 's3', q: '"raft consensus"', t: 4 },
    ];
    const clicks = [
      { sess: 's1', url: '/books/ddia', t: 3 },
      { sess: 's2', url: '/blog/kafka', t: 9 },
    ];

    const outBox = h('div', { class: 'card-grid wide' });
    const s1 = stat('Khớp Search + Click', '–'), s2 = stat('Hết hạn (Không Click / Quá cửa sổ)', '–'), s3 = stat('Trạng thái giữ trong Processor', 'Hai chỉ mục theo session_id', 'accent', 'Xoá khi hết hạn cửa sổ');

    root.append(h('div', { class: 'controls' }, winSl.el), outBox, h('div', { class: 'stats' }, s1, s2, s3));

    function render() {
      clear(outBox);
      const W = winSl.value;
      let matched = 0, expired = 0;
      const results = searches.map((sr) => {
        const cl = clicks.find((c) => c.sess === sr.sess);
        if (cl && cl.t - sr.t <= W) {
          matched++;
          return { sess: sr.sess, status: 'JOINED', detail: `${sr.q} → Click ${cl.url} (sau ${cl.t - sr.t}p)`, tone: 'ok' };
        }
        expired++;
        return { sess: sr.sess, status: 'TIMEOUT', detail: `${sr.q} → Không có click trong ${W}p`, tone: 'warn' };
      });

      results.forEach((r) => {
        outBox.appendChild(h('div', { class: 'mcard active' },
          h('h5', `Session ${r.sess}`, h('span', { class: 'pill ' + r.tone }, r.status)),
          h('div', { class: 'grp-res' }, r.detail)
        ));
      });

      s1.update(`${matched}/3 phiên`, 'ok', 'Phát sự kiện CTR thành công');
      s2.update(`${expired}/3 phiên`, expired > 1 ? 'warn' : 'accent', 'Khi cửa sổ đóng mà chưa thấy click');
    }
    render();
  });

  // =====================================================================
  // 12.16 enrich — Stream-table join (Remote DB RPC vs Local table + CDC)
  // =====================================================================
  widget('enrich', (root) => {
    const mode = seg({
      label: 'Cách làm giàu sự kiện (Stream Enrichment)',
      options: [
        { value: 'cdc', label: 'Bản sao cục bộ trong Processor + cập nhật qua CDC' },
        { value: 'rpc', label: 'Truy vấn Database từ xa qua mạng cho từng Event' },
      ],
      value: 'cdc',
      onChange: render,
    });
    const orderSeg = seg({
      label: 'Thời điểm nhận bản ghi CDC đổi địa chỉ u1 → Hà Nội',
      options: [
        { value: 'before', label: 'CDC đến trước Event mua hàng' },
        { value: 'after', label: 'CDC đến sau Event mua hàng' },
      ],
      value: 'before',
      onChange: render,
    });

    const s1 = stat('Thông lượng tối đa', '–'), s2 = stat('Kết quả Join của đơn hàng u1', '–'), s3 = stat('Tải gây ra cho DB chính', '–');
    root.append(h('div', { class: 'controls' }, mode.el, orderSeg.el), h('div', { class: 'stats' }, s1, s2, s3));

    function render() {
      const isCDC = mode.value === 'cdc';
      const city = orderSeg.value === 'before' ? 'Hà Nội (Profile mới)' : 'Đà Nẵng (Profile cũ)';
      s1.update(isCDC ? '~50.000 event/s' : '~500 event/s', isCDC ? 'ok' : 'bad', isCDC ? 'Tra bảng băm/RocksDB cục bộ (< 0,02 ms)' : 'Bị chặn bởi vòng mạng RTT (~2 ms/event)');
      s2.update(`u1 mua hàng tại: ${city}`, 'accent', 'Phụ thuộc thứ tự tương đối giữa 2 luồng');
      s3.update(isCDC ? 'Chỉ đọc 1 luồng CDC' : 'Nguy cơ đánh sập DB!', isCDC ? 'ok' : 'bad', 'Giống Broadcast/Partitioned Hash Join nhưng chạy liên tục');
    }
    render();
  });

  // =====================================================================
  // 12.17 timeline-join — Table-table join (Twitter home timeline maintenance)
  // =====================================================================
  widget('timeline-join', (root) => {
    let follows = { An: ['Bình', 'Chi'] };
    let tweets = [
      { id: 't1', author: 'Bình', text: 'Bình: Xin chào buổi sáng!' },
      { id: 't2', author: 'Chi', text: 'Chi: Đang đọc Chương 12 DDIA' },
      { id: 't3', author: 'Dũng', text: 'Dũng: Xử lý luồng rất thú vị' },
    ];
    let lastOp = 'Khởi tạo: An đang theo dõi Bình và Chi.';

    const btnFollowDung = button('An bấm Follow Dũng (+uv\')', () => {
      if (!follows.An.includes('Dũng')) follows.An.push('Dũng');
      lastOp = 'Follow(An → Dũng): Join với bảng tweets hiện tại của Dũng → thêm tweet của Dũng vào timeline An!';
      render();
    });
    const btnUnfollowChi = button('An bấm Unfollow Chi (-uv\')', () => {
      follows.An = follows.An.filter((x) => x !== 'Chi');
      lastOp = 'Unfollow(An → Chi): Gỡ toàn bộ tweet của Chi khỏi timeline của An!';
      render();
    }, 'ghost');
    const btnNewTweet = button('Bình đăng Tweet mới (+u\'v)', () => {
      tweets.unshift({ id: 't' + (tweets.length + 1), author: 'Bình', text: 'Bình: Tweet mới #' + (tweets.length + 1) });
      lastOp = 'Tweet mới từ Bình: Join với danh sách follower hiện tại của Bình → đẩy ngay vào timeline An!';
      render();
    });
    const btnReset = button('Đặt lại', () => {
      follows = { An: ['Bình', 'Chi'] };
      tweets = [
        { id: 't1', author: 'Bình', text: 'Bình: Xin chào buổi sáng!' },
        { id: 't2', author: 'Chi', text: 'Chi: Đang đọc Chương 12 DDIA' },
        { id: 't3', author: 'Dũng', text: 'Dũng: Xử lý luồng rất thú vị' },
      ];
      lastOp = 'Đã khôi phục trạng thái ban đầu.';
      render();
    }, 'ghost');

    const note = h('div', { class: 'step-note' });
    const boxes = h('div', { class: 'tl-boxes' });
    root.append(h('div', { class: 'btn-row' }, btnFollowDung, btnUnfollowChi, btnNewTweet, btnReset), note, boxes);

    function render() {
      clear(boxes);
      note.textContent = lastOp;
      const timelineAn = tweets.filter((tw) => follows.An.includes(tw.author));
      boxes.append(
        h('div', { class: 'tl-box' }, h('b', 'Bảng follows của An'), follows.An.map((f) => h('div', { class: 'it' }, 'An → ' + f))),
        h('div', { class: 'tl-box' }, h('b', 'Bảng tweets gốc'), tweets.map((t) => h('div', { class: 'it' }, t.text))),
        h('div', { class: 'tl-box' }, h('b', 'Materialized View: Timeline của An'), timelineAn.map((t) => h('div', { class: 'it new' }, t.text)))
      );
    }
    render();
  });

  // =====================================================================
  // 12.18 scd — Time-dependence of joins & Slowly Changing Dimensions (SCD)
  // =====================================================================
  widget('scd', (root) => {
    const mode = seg({
      label: 'Cách thiết kế khoá Join',
      options: [
        { value: 'mutable', label: 'Join theo mã quốc gia (Không lưu phiên bản thuế suất)' },
        { value: 'scd', label: 'Slowly Changing Dimension (Gắn ID phiên bản tax_v1 / tax_v2)' },
      ],
      value: 'scd',
      onChange: render,
    });
    const runTime = seg({
      label: 'Thời điểm chạy Job',
      options: [
        { value: 'live', label: 'Chạy trực tiếp ngày 15/06 (Thuế đang là 10%)' },
        { value: 'replay', label: 'Chạy lại (Reprocess) vào tháng 8 (Thuế hiện tại đã đổi thành 8%)' },
      ],
      value: 'replay',
      onChange: render,
    });

    const s1 = stat('Hoá đơn ngày 15/06 (1.000 $)', '–'), s2 = stat('Tiền thuế tính ra', '–'), s3 = stat('Tính tất định khi chạy lại (Reprocess)', '–');
    root.append(h('div', { class: 'controls' }, mode.el, runTime.el), h('div', { class: 'stats' }, s1, s2, s3));

    function render() {
      const isSCD = mode.value === 'scd';
      const isReplay = runTime.value === 'replay';
      const wrong = !isSCD && isReplay;
      const rate = wrong ? 8 : 10;

      s1.update(isSCD ? 'Tham chiếu tax_id = v1 (10%)' : 'Chỉ ghi country = VN', isSCD ? 'ok' : 'warn', 'Bán trước ngày đổi thuế 01/07');
      s2.update(`${rate * 10} $ (Thuế ${rate}%)`, wrong ? 'bad' : 'ok', wrong ? 'SAI! Áp nhầm thuế tháng 8 cho hoá đơn tháng 6' : 'Đúng mức thuế 10% lúc bán');
      s3.update(isSCD ? '100% Tất định (Deterministic)' : 'Không tất định (Sai lệch sổ sách!)', isSCD ? 'ok' : 'bad',
        isSCD ? 'Đổi lại không dùng Log Compaction xoá v1 được' : 'Thứ tự xen kẽ giữa 2 luồng làm đổi kết quả');
    }
    render();
  });

  // =====================================================================
  // 12.19 checkpoint — Microbatching vs Checkpointing + Atomic commit
  // =====================================================================
  widget('checkpoint', (root) => {
    const sizeSl = slider({ label: 'Kích thước Microbatch / Khoảng cách Checkpoint', min: 2, max: 10, step: 2, value: 5, format: (v) => v + ' event', onInput: render });
    const crashAt = slider({ label: 'Sự cố sập xảy ra ở Event thứ', min: 6, max: 19, step: 1, value: 13, format: (v) => 'Event #' + v, onInput: render });
    const atomic = checkbox('Bật Transactional / Atomic Sink cho tác dụng phụ ra ngoài', true, render);

    const s1 = stat('Checkpoint đã lưu gần nhất', '–'), s2 = stat('Số event phải phát lại sau khi sập', '–'), s3 = stat('Tác dụng phụ bên ngoài (Email/DB)', '–');
    root.append(
      h('div', { class: 'controls' }, sizeSl.el, crashAt.el),
      atomic.el,
      h('div', { class: 'stats' }, s1, s2, s3)
    );

    function render() {
      const sz = sizeSl.value, cr = crashAt.value, isAtom = atomic.input.checked;
      const lastCk = Math.floor((cr - 1) / sz) * sz;
      const replayCount = cr - lastCk;

      s1.update(`Tại Event #${lastCk}`, 'accent', `Chu kỳ mỗi ${sz} event`);
      s2.update(`${replayCount} event (#${lastCk + 1}..#${cr})`, 'warn', 'Khôi phục trạng thái nội bộ từ checkpoint #' + lastCk);
      s3.update(isAtom ? 'Đúng 1 lần (Exactly-once)' : `Bị bắn LẶP ${replayCount} lần!`, isAtom ? 'ok' : 'bad',
        isAtom ? 'Commit đầu ra cùng lúc với checkpoint' : 'Checkpoint nội bộ không tự thu hồi được email đã gửi');
    }
    render();
  });

  // =====================================================================
  // 12.20 idempotence — Idempotent writes using log offset
  // =====================================================================
  widget('idempotence', (root) => {
    const mode = seg({
      label: 'Cách ghi vào Database khi xử lý Message',
      options: [
        { value: 'naive', label: 'UPDATE views = views + 1 (Không lưu offset)' },
        { value: 'idem', label: 'UPDATE views = views + 1, last_offset = msg.offset WHERE last_offset < msg.offset' },
      ],
      value: 'idem',
      onChange: render,
    });

    const wrap = h('div', { class: 'msgs' });
    const s1 = stat('Các message thực sự xảy ra', '6 message (#0..#5)', 'accent', 'Sập sau khi ghi DB #5 nhưng trước khi commit offset (commit gần nhất = #2)'),
          s2 = stat('Các message bị phát lại sau khi sống dậy', '#3, #4, #5 (3 message)', 'warn', 'Đọc lại từ offset đã commit #3'),
          s3 = stat('Giá trị bộ đếm cuối cùng trong DB', '–');

    root.append(mode.el, wrap, h('div', { class: 'stats' }, s1, s2, s3));

    function render() {
      clear(wrap);
      const isIdem = mode.value === 'idem';
      const seq = [
        { off: 0, note: 'Ghi +1' }, { off: 1, note: 'Ghi +1' }, { off: 2, note: 'Ghi +1 (Commit offset=2)' },
        { off: 3, note: 'Ghi +1' }, { off: 4, note: 'Ghi +1' }, { off: 5, note: 'Ghi +1 → SẬP!' },
        { off: 3, replay: true }, { off: 4, replay: true }, { off: 5, replay: true },
      ];
      seq.forEach((it) => {
        if (!it.replay) {
          wrap.appendChild(h('span', { class: 'm acc' }, `#${it.off}: ${it.note}`));
        } else {
          wrap.appendChild(h('span', { class: 'm ' + (isIdem ? 'ok' : 'bad') },
            isIdem ? ` Phát lại #${it.off}: Bỏ qua (last_offset=5 ≥ ${it.off})` : ` Phát lại #${it.off}: Cộng trùng lần 2!`
          ));
        }
      });

      s3.update(isIdem ? 'views = 6 (ĐÚNG!)' : 'views = 9 (SAI — Đếm trùng 3 lần!)', isIdem ? 'ok' : 'bad',
        isIdem ? 'Nhờ lưu kèm last_offset nguyên tử trong cùng bản ghi DB' : 'Cộng thêm 1 không tự nhiên idempotent');
    }
    render();
  });

  // =====================================================================
  // 12.21 rebuild — Rebuilding stream state after failure (5 strategies)
  // =====================================================================
  widget('rebuild', (root) => {
    const stateGB = slider({ label: 'Kích thước trạng thái cục bộ (RocksDB)', min: 2, max: 60, step: 2, value: 20, format: (v) => v + ' GB', onInput: render });
    const ckInterval = slider({ label: 'Khoảng cách giữa 2 lần Snapshot (Flink)', min: 10, max: 120, step: 10, value: 60, format: (v) => v + ' s', onInput: render });

    const wrap = h('div', { class: 'table-wrap' });
    root.append(h('div', { class: 'controls' }, stateGB.el, ckInterval.el), wrap);

    function render() {
      clear(wrap);
      const gb = stateGB.value, ck = ckInterval.value;
      // Network transfer ~ 200 MB/s = 0.2 GB/s
      const tFlink = gb / 0.2 + ck * 0.15;
      const tKafkaChangelog = gb / 0.18;
      const tReplayWindow = 12; // short 5-minute window replay

      const rows = [
        { name: '1. Giữ trạng thái ở DB từ xa (Remote Datastore)', thr: 'Chậm (~500 msg/s vì gọi mạng mỗi event)', rec: '0 giây (Không cần dựng lại trên worker)' },
        { name: '2. Cục bộ + Định kỳ Snapshot ra HDFS (Apache Flink)', thr: 'Rất nhanh (~50.000 msg/s)', rec: `~${fmt(tFlink, 0)} giây (Tải ${gb} GB snapshot + phát lại ${ck}s log)` },
        { name: '3. Cục bộ + Gửi thay đổi vào Compacted Topic (Kafka Streams / Samza)', thr: 'Rất nhanh (~50.000 msg/s)', rec: `~${fmt(tKafkaChangelog, 0)} giây (Đọc lại changelog đã compaction, hoặc 0s nếu có standby replica)` },
        { name: '4. Xử lý dư thừa song song trên nhiều node (VoltDB)', thr: 'Cao (nhưng tốn gấp N lần CPU/RAM)', rec: '0 giây (Node kia đã có sẵn trạng thái)' },
        { name: '5. Không sao lưu, chỉ phát lại luồng đầu vào (Cửa sổ ngắn)', thr: 'Tối đa (Không tốn chi phí sao lưu)', rec: `~${tReplayWindow} giây (Chỉ hợp khi cửa sổ ngắn vài phút)` },
      ];

      wrap.appendChild(h('table', { class: 'data' },
        h('thead', h('tr', h('th', 'Chiến lược quản lý trạng thái'), h('th', 'Thông lượng lúc chạy thường'), h('th', 'Thời gian khôi phục khi máy sập'))),
        h('tbody', rows.map((r) => h('tr', h('td', { class: 'wrap' }, r.name), h('td', { class: 'wrap' }, r.thr), h('td', { class: 'wrap' }, r.rec))))
      ));
    }
    render();
  });

  // =====================================================================
  // Glossary for Chapter 12
  // =====================================================================
  glossary.add([
    { key: 'unbounded', term: 'Unbounded dataset', vi: 'Tập dữ liệu không giới hạn', ch: 12, topic: 'ch12-transmitting',
      def: 'Luồng dữ liệu đến liên tục theo thời gian và không bao giờ kết thúc, đối lập với đầu vào hữu hạn (bounded) của xử lý theo lô.' },
    { key: 'event', term: 'Event', vi: 'Sự kiện', ch: 12, topic: 'ch12-transmitting',
      def: 'Một bản ghi nhỏ, tự chứa đủ thông tin và bất biến, ghi lại chi tiết một việc đã xảy ra tại một thời điểm (kèm timestamp).' },
    { key: 'producer', term: 'Producer (publisher / sender)', vi: 'Bên sản xuất sự kiện', ch: 12, topic: 'ch12-transmitting',
      def: 'Tiến trình hoặc dịch vụ phát sinh ra bản ghi sự kiện mới và gửi vào hệ thống truyền luồng.' },
    { key: 'consumer', term: 'Consumer (subscriber / recipient)', vi: 'Bên tiêu thụ sự kiện', ch: 12, topic: 'ch12-transmitting',
      def: 'Tiến trình đăng ký đọc và xử lý các sự kiện từ một hoặc nhiều topic.' },
    { key: 'topic', term: 'Topic (stream)', vi: 'Chủ đề / kênh sự kiện', ch: 12, topic: 'ch12-transmitting',
      def: 'Tên nhóm logic gom các sự kiện có liên quan cùng loại lại với nhau (tương đương tên file hoặc thư mục trong batch).' },
    { key: 'polling', term: 'Polling', vi: 'Hỏi thăm định kỳ', ch: 12, topic: 'ch12-transmitting',
      def: 'Cơ chế trong đó client lặp đi lặp lại việc gửi truy vấn tới cơ sở dữ liệu xem có bản ghi mới hay không.' },
    { key: 'backpressure', term: 'Backpressure (flow control)', vi: 'Áp lực ngược (điều tiết luồng)', ch: 12, topic: 'ch12-messaging',
      def: 'Cơ chế làm chậm hoặc chặn bên gửi (producer) khi bên nhận (consumer) không theo kịp tốc độ, như trong TCP và Unix pipe.' },
    { key: 'webhook', term: 'Webhook', vi: 'Hàm gọi lại qua HTTP (Webhook)', ch: 12, topic: 'ch12-brokers',
      def: 'Mẫu giao tiếp trực tiếp trong đó dịch vụ A gửi request HTTP POST tới một URL callback đã đăng ký của dịch vụ B mỗi khi có sự kiện.' },
    { key: 'message-broker', term: 'Message broker (message queue)', vi: 'Bộ môi giới thông điệp (hàng đợi)', ch: 12, topic: 'ch12-brokers',
      def: 'Máy chủ trung gian chuyên nhận, lưu đệm và chuyển tiếp các thông điệp giữa nhiều producer và nhiều consumer.' },
    { key: 'load-balancing', term: 'Load balancing (shared subscription)', vi: 'Chia tải giữa các consumer', ch: 12, topic: 'ch12-consumers',
      def: 'Mẫu phân phối trong đó mỗi thông điệp trong topic chỉ được giao cho một trong các consumer để chia sẻ công việc xử lý.' },
    { key: 'fan-out', term: 'Fan-out', vi: 'Phát quảng bá cho mọi consumer', ch: 12, topic: 'ch12-consumers',
      def: 'Mẫu phân phối trong đó mỗi thông điệp được nhân bản tới tất cả các consumer hoặc nhóm consumer độc lập đang đăng ký.' },
    { key: 'acknowledgment', term: 'Acknowledgment (ack)', vi: 'Báo nhận hoàn tất (Ack)', ch: 12, topic: 'ch12-consumers',
      def: 'Tín hiệu consumer gửi trả cho broker sau khi đã xử lý xong một thông điệp để broker yên tâm xoá thông điệp đó khỏi hàng đợi.' },
    { key: 'log-based-broker', term: 'Log-based message broker', vi: 'Message broker dựa trên nhật ký (Log)', ch: 12, topic: 'ch12-partitioned-logs',
      def: 'Loại broker (như Apache Kafka, Kinesis) lưu trữ mọi thông điệp vào một file log chỉ-append phân vùng trên đĩa thay vì xoá ngay sau khi giao.' },
    { key: 'offset', term: 'Log offset', vi: 'Số thứ tự vị trí trong log (Offset)', ch: 12, topic: 'ch12-partitioned-logs',
      def: 'Số nguyên tăng đơn điệu gắn cho mỗi thông điệp bên trong một phân vùng log, cho phép consumer theo dõi tiến độ đọc và tua lại.' },
    { key: 'consumer-group', term: 'Consumer group', vi: 'Nhóm người tiêu thụ', ch: 12, topic: 'ch12-partitioned-logs',
      def: 'Tập hợp các tiến trình consumer phối hợp chia nhau các phân vùng của một topic sao cho mỗi phân vùng chỉ do một thành viên trong nhóm đọc.' },
    { key: 'head-of-line-blocking', term: 'Head-of-line blocking', vi: 'Chặn đầu hàng', ch: 12, topic: 'ch12-logs-vs-mq',
      def: 'Hiện tượng một thông điệp tốn nhiều thời gian xử lý làm tắc nghẽn toàn bộ các thông điệp đứng sau nó trong cùng một phân vùng tuần tự.' },
    { key: 'circular-buffer', term: 'Circular buffer (ring buffer)', vi: 'Bộ đệm vòng', ch: 12, topic: 'ch12-logs-vs-mq',
      def: 'Cách tổ chức log giới hạn dung lượng trên đĩa trong đó các segment cũ nhất tự động bị xoá đi để nhường chỗ cho dữ liệu mới.' },
    { key: 'dual-writes', term: 'Dual writes', vi: 'Ghi kép từ tầng ứng dụng', ch: 12, topic: 'ch12-dual-writes',
      def: 'Việc code ứng dụng tự gửi lệnh ghi trực tiếp vào hai hệ thống lưu trữ khác nhau (như DB và Search Index), dễ gây lệch dữ liệu vĩnh viễn khi có ghi đồng thời.' },
    { key: 'change-data-capture', term: 'Change Data Capture (CDC)', vi: 'Bắt giữ dữ liệu thay đổi', ch: 12, topic: 'ch12-cdc',
      def: 'Quy trình trích xuất mọi thay đổi được ghi vào cơ sở dữ liệu nguồn (thường bằng cách đọc replication log/WAL) thành một luồng sự kiện giữ nguyên thứ tự.' },
    { key: 'initial-snapshot', term: 'Initial snapshot', vi: 'Bản chụp trạng thái ban đầu', ch: 12, topic: 'ch12-cdc',
      def: 'Bản sao toàn bộ dữ liệu tại một offset xác định dùng để khởi tạo hệ thống dẫn xuất trước khi tiếp tục áp dụng các thay đổi từ changelog.' },
    { key: 'change-stream', term: 'Change stream', vi: 'Luồng thông báo thay đổi', ch: 12, topic: 'ch12-cdc',
      def: 'API hạng nhất của một số cơ sở dữ liệu (RethinkDB, MongoDB, CouchDB, Firebase) cho phép ứng dụng đăng ký nhận các thay đổi theo thời gian thực.' },
    { key: 'log-compaction', term: 'Log compaction', vi: 'Đầm nén nhật ký theo khoá', ch: 12, topic: 'ch12-log-compaction',
      def: 'Cơ chế chạy nền trong log-based broker định kỳ loại bỏ các bản ghi cũ trùng khoá và chỉ giữ lại bản cập nhật mới nhất của mỗi khoá.' },
    { key: 'tombstone', term: 'Tombstone', vi: 'Bia mộ đánh dấu xoá', ch: 12, topic: 'ch12-log-compaction',
      def: 'Bản ghi đặc biệt có giá trị null được ghi vào log để báo cho các consumer và bộ log compaction biết khoá đó đã bị xoá.' },
    { key: 'event-sourcing', term: 'Event sourcing', vi: 'Lưu trữ nguồn bằng sự kiện', ch: 12, topic: 'ch12-event-sourcing',
      def: 'Phong cách thiết kế lưu mọi thay đổi trạng thái ứng dụng dưới dạng một nhật ký các sự kiện nghiệp vụ bất biến ở mức cao.' },
    { key: 'command', term: 'Command', vi: 'Mệnh lệnh yêu cầu', ch: 12, topic: 'ch12-event-sourcing',
      def: 'Yêu cầu thao tác từ người dùng gửi vào hệ thống; chỉ sau khi được kiểm tra hợp lệ thành công thì command mới được chấp nhận và chuyển thành sự kiện bất biến (event).' },
    { key: 'changelog', term: 'Changelog', vi: 'Nhật ký thay đổi trạng thái', ch: 12, topic: 'ch12-immutability',
      def: 'Luồng ghi lại tuần tự các phép biến đổi của một bảng dữ liệu theo thời gian (đạo hàm của trạng thái).' },
    { key: 'cqrs', term: 'CQRS (Command Query Responsibility Segregation)', vi: 'Tách biệt trách nhiệm Lệnh ghi và Truy vấn đọc', ch: 12, topic: 'ch12-immutability',
      def: 'Kiến trúc tách riêng mô hình ghi dữ liệu (thường qua log sự kiện chuẩn hoá) khỏi một hoặc nhiều mô hình view phi chuẩn hoá tối ưu cho việc đọc.' },
    { key: 'excision', term: 'Excision (shunning)', vi: 'Cắt bỏ lịch sử dữ liệu', ch: 12, topic: 'ch12-immutability',
      def: 'Thao tác xoá bỏ thực sự một mẩu dữ liệu ra khỏi cả lịch sử bất biến để tuân thủ quy định quyền riêng tư (như GDPR).' },
    { key: 'cep', term: 'Complex Event Processing (CEP)', vi: 'Xử lý sự kiện phức hợp', ch: 12, topic: 'ch12-uses',
      def: 'Cách tiếp cận cho phép khai báo các quy tắc hoặc mẫu chuỗi sự kiện (như biểu thức chính quy) để phát hiện tình huống đặc biệt khi luồng dữ liệu chảy qua.' },
    { key: 'stream-analytics', term: 'Stream analytics', vi: 'Phân tích thống kê trên luồng', ch: 12, topic: 'ch12-uses',
      def: 'Việc tính toán liên tục các phép tổng hợp, đếm, trung bình trượt hoặc phân vị trên các cửa sổ thời gian của luồng sự kiện.' },
    { key: 'materialized-view', term: 'Materialized view', vi: 'Khung nhìn vật lý hoá', ch: 12, topic: 'ch12-uses',
      def: 'Bảng kết quả truy vấn đã được tính sẵn và lưu trữ vật lý trên đĩa/RAM, được cập nhật tự động mỗi khi dữ liệu nguồn thay đổi.' },
    { key: 'percolator', term: 'Percolator (search on streams)', vi: 'Tìm kiếm đảo ngược trên luồng', ch: 12, topic: 'ch12-uses',
      def: 'Tính năng lưu sẵn hàng nghìn câu truy vấn tìm kiếm rồi cho từng tài liệu mới chảy qua để xem tài liệu đó khớp với những truy vấn nào.' },
    { key: 'event-time', term: 'Event time', vi: 'Thời gian sự kiện thực tế xảy ra', ch: 12, topic: 'ch12-event-time',
      def: 'Dấu thời gian gắn bên trong bản thân sự kiện ghi nhận lúc hành động diễn ra trên thiết bị gốc.' },
    { key: 'processing-time', term: 'Processing time', vi: 'Thời gian máy chủ xử lý', ch: 12, topic: 'ch12-event-time',
      def: 'Thời gian theo đồng hồ hệ thống của máy chủ stream processor tại lúc nó đọc và xử lý sự kiện đó.' },
    { key: 'straggler', term: 'Straggler (late event)', vi: 'Sự kiện đến muộn', ch: 12, topic: 'ch12-event-time',
      def: 'Sự kiện có event timestamp thuộc về một cửa sổ thời gian trong quá khứ nhưng đến tay processor sau khi cửa sổ đó đã được tuyên bố đóng.' },
    { key: 'tumbling-window', term: 'Tumbling window', vi: 'Cửa sổ lật cố định (không chồng lấp)', ch: 12, topic: 'ch12-windows',
      def: 'Cửa sổ chia thời gian thành các đoạn có độ dài cố định nối tiếp nhau sao cho mỗi sự kiện thuộc về đúng một cửa sổ duy nhất.' },
    { key: 'hopping-window', term: 'Hopping window', vi: 'Cửa sổ nhảy chồng lấp', ch: 12, topic: 'ch12-windows',
      def: 'Cửa sổ có độ dài cố định (ví dụ 5 phút) nhưng dịch chuyển theo một bước nhảy nhỏ hơn (ví dụ 1 phút) để tạo hiệu ứng làm mượt.' },
    { key: 'sliding-window', term: 'Sliding window', vi: 'Cửa sổ trượt liên tục', ch: 12, topic: 'ch12-windows',
      def: 'Cửa sổ gom mọi nhóm sự kiện có khoảng cách thời gian với nhau nhỏ hơn một ngưỡng nhất định mà không phụ thuộc mốc tròn phút.' },
    { key: 'session-window', term: 'Session window', vi: 'Cửa sổ theo phiên hoạt động', ch: 12, topic: 'ch12-windows',
      def: 'Cửa sổ có độ dài co giãn tự động gom các sự kiện liên tiếp của cùng một người dùng và chỉ đóng lại khi người đó không hoạt động quá một khoảng timeout.' },
    { key: 'stream-stream-join', term: 'Stream-stream join (window join)', vi: 'Kết nối luồng với luồng trong cửa sổ', ch: 12, topic: 'ch12-stream-stream',
      def: 'Phép join giữ chỉ mục trạng thái của hai luồng sự kiện trong một cửa sổ thời gian để ghép các sự kiện có cùng khoá (như tìm kiếm và nhấp chuột).' },
    { key: 'stream-table-join', term: 'Stream-table join (stream enrichment)', vi: 'Kết nối luồng với bảng (làm giàu luồng)', ch: 12, topic: 'ch12-stream-table',
      def: 'Phép join làm giàu từng sự kiện trên luồng bằng dữ liệu từ một bản sao bảng cục bộ được giữ cập nhật liên tục qua CDC changelog.' },
    { key: 'table-table-join', term: 'Table-table join', vi: 'Kết nối hai bảng qua hai luồng changelog', ch: 12, topic: 'ch12-table-table',
      def: 'Phép join nhận đầu vào là hai luồng thay đổi (changelog) của hai bảng để duy trì liên tục một materialized view của kết quả join.' },
    { key: 'slowly-changing-dimension', term: 'Slowly Changing Dimension (SCD)', vi: 'Chiều dữ liệu thay đổi chậm', ch: 12, topic: 'ch12-join-time',
      def: 'Kỹ thuật trong kho dữ liệu gắn mã phiên bản hoặc khoảng hiệu lực thời gian cho bảng tham chiếu (như thuế suất, giá) để join tái tạo đúng lịch sử.' },
    { key: 'exactly-once', term: 'Exactly-once (effectively-once) semantics', vi: 'Ngữ nghĩa tác động đúng một lần', ch: 12, topic: 'ch12-microbatch',
      def: 'Đảm bảo rằng dù có lỗi và phải chạy lại, kết quả cuối cùng nhìn thấy được vẫn giống hệt như khi mỗi sự kiện chỉ được xử lý đúng một lần duy nhất.' },
    { key: 'microbatching', term: 'Microbatching', vi: 'Chia lô siêu nhỏ', ch: 12, topic: 'ch12-microbatch',
      def: 'Kỹ thuật của Spark Streaming cắt luồng liên tục thành các lô nhỏ khoảng 0,5–2 giây và xử lý từng lô như một batch job tí hon.' },
    { key: 'checkpointing', term: 'Checkpointing', vi: 'Chụp điểm kiểm tra trạng thái', ch: 12, topic: 'ch12-microbatch',
      def: 'Kỹ thuật của Apache Flink dùng các rào cản (barrier) chảy trong luồng để định kỳ lưu ảnh chụp nhất quán trạng thái của mọi operator ra kho lưu trữ bền.' },
    { key: 'idempotence', term: 'Idempotence', vi: 'Tính luỹ đẳng (làm lại không đổi kết quả)', ch: 12, topic: 'ch12-idempotence',
      def: 'Tính chất của một phép toán mà khi thực hiện nhiều lần liên tiếp vẫn tạo ra đúng kết quả như khi thực hiện một lần duy nhất.' },
  ]);
})();
