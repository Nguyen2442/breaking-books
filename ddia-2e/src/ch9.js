/* Chương 9 — The Trouble with Distributed Systems (nguồn: ấn bản 1, chương 8) */
(function () {
  'use strict';
  const { h, s, clear, fmt, fmtBig, fmtMs, pct, rng, clamp, sleep,
          slider, seg, button, checkbox, stat, log, widget, glossary } = window.DDIA;

  const ctl = (label, el) => h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, label), el);
  const pill = (text, tone) => h('span', { class: 'pill' + (tone ? ' ' + tone : '') }, text);

  // =====================================================================
  // 9.1a HPC (stop-all + checkpoint) vs Cloud (online fault tolerance)
  widget('hpc-vs-cloud', (root) => {
    let nodes = 500, mtbfDays = 100, ckptHours = 4;
    const slNodes = slider({ label: 'Số node trong cụm', min: 50, max: 4000, step: 50, value: nodes, onInput: (v) => { nodes = v; render(); } });
    const slMtbf = slider({ label: 'Độ bền trung bình mỗi node (MTBF)', min: 30, max: 365, step: 5, value: mtbfDays, format: (v) => v + ' ngày', onInput: (v) => { mtbfDays = v; render(); } });
    const slCkpt = slider({ label: 'Chu kỳ ghi Checkpoint (HPC)', min: 1, max: 12, step: 1, value: ckptHours, format: (v) => v + ' giờ', onInput: (v) => { ckptHours = v; render(); } });

    const viz = h('div', { class: 'viz' });
    const stats = h('div', { class: 'stats' });
    root.append(h('div', { class: 'controls' }, slNodes.el, slMtbf.el, slCkpt.el), viz, stats);

    function render() {
      const clusterFailuresPerHour = nodes / (mtbfDays * 24);
      const avgRollbackHours = ckptHours * 0.5 + 0.5; // half checkpoint + restart time
      const hpcUsefulRatio = clamp(1 - clusterFailuresPerHour * avgRollbackHours, 0.02, 1);
      const cloudUsefulRatio = clamp(1 - (clusterFailuresPerHour * 0.5) / nodes, 0.95, 1);

      const W = 600, H = 190, L = 52, R = 20, T = 18, B = 32;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Tiến độ công việc trong 168 giờ (1 tuần)' });
      const x = (hr) => L + (hr / 168) * (W - L - R);
      const y = (p) => H - B - clamp(p / 100, 0, 1) * (H - T - B);

      [0, 24, 48, 72, 96, 120, 144, 168].forEach((hr) => {
        svg.append(
          s('line', { x1: x(hr), x2: x(hr), y1: T, y2: H - B, class: 'grid' }),
          s('text', { x: x(hr), y: H - B + 15, 'text-anchor': 'middle' }, hr + 'h')
        );
      });
      [0, 50, 100].forEach((p) => {
        svg.append(
          s('line', { x1: L, x2: W - R, y1: y(p), y2: y(p), class: 'grid' }),
          s('text', { x: L - 6, y: y(p) + 4, 'text-anchor': 'end' }, p + '%')
        );
      });

      // Sawtooth progress for HPC vs smooth line for Cloud
      const ptsHpc = [];
      let prog = 0;
      const failInterval = Math.max(2, Math.round(1 / Math.max(0.008, clusterFailuresPerHour)));
      for (let hr = 0; hr <= 168; hr += 2) {
        if (hr > 0 && hr % failInterval === 0 && hpcUsefulRatio < 0.95) {
          prog = Math.max(0, prog - (ckptHours / 168) * 90);
        } else {
          prog = Math.min(100, prog + (2 / 168) * 100 * Math.max(0.15, hpcUsefulRatio));
        }
        ptsHpc.push(`${ptsHpc.length ? 'L' : 'M'}${x(hr).toFixed(1)} ${y(prog).toFixed(1)}`);
      }

      svg.append(
        s('line', { x1: x(0), y1: y(0), x2: x(168), y2: y(100 * cloudUsefulRatio), class: 'f-none s-violet', 'stroke-width': 2.5 }),
        s('path', { d: ptsHpc.join(' '), class: 'f-none s-accent', 'stroke-width': 2.2 }),
        s('text', { x: L + 10, y: T + 12, class: 'lbl-strong' }, 'Tím: Cloud (chịu lỗi cục bộ) · Xanh: HPC (dừng cả cụm & quay lại checkpoint)')
      );
      clear(viz).append(svg);

      clear(stats).append(
        stat('Tần suất có 1 node hỏng trong cụm', fmt(clusterFailuresPerHour * 24, 1) + ' lần/ngày', clusterFailuresPerHour * 24 > 5 ? 'bad' : 'warn'),
        stat('Hiệu suất hữu ích của HPC', pct(hpcUsefulRatio, 0), hpcUsefulRatio < 0.5 ? 'bad' : hpcUsefulRatio < 0.8 ? 'warn' : 'ok', 'Mất thời gian rollback về checkpoint'),
        stat('Công suất phục vụ của Cloud', pct(cloudUsefulRatio, 2), 'ok', 'Cô lập lỗi cục bộ và chạy tiếp')
      );
    }
    render();
  });

  // =====================================================================
  // 9.1b TCP reliable byte stream over unreliable IP packets
  widget('tcp-over-ip', (root) => {
    let lossRate = 25, dupRate = 20, reorderRate = 30;
    const slLoss = slider({ label: 'Tỉ lệ mất gói IP', min: 0, max: 60, step: 5, value: lossRate, format: (v) => v + '%', onInput: (v) => { lossRate = v; render(); } });
    const slDup = slider({ label: 'Tỉ lệ nhân đôi gói IP', min: 0, max: 50, step: 5, value: dupRate, format: (v) => v + '%', onInput: (v) => { dupRate = v; render(); } });
    const slReo = slider({ label: 'Tỉ lệ đảo thứ tự gói IP', min: 0, max: 60, step: 5, value: reorderRate, format: (v) => v + '%', onInput: (v) => { reorderRate = v; render(); } });

    const ipBox = h('div', { class: 'box' });
    const tcpBox = h('div', { class: 'box' });
    const stats = h('div', { class: 'stats' });

    root.append(h('div', { class: 'controls' }, slLoss.el, slDup.el, slReo.el), ipBox, tcpBox, stats);

    function render() {
      const r = rng(101 + lossRate * 7 + dupRate * 13 + reorderRate * 19);
      const ipArr = [];
      let retransmits = 0;

      for (let seq = 1; seq <= 8; seq++) {
        if (r() * 100 < lossRate) {
          ipArr.push({ seq, status: 'lost', label: `#${seq} (mất)` });
          retransmits++;
          ipArr.push({ seq, status: 're', label: `#${seq} (gửi lại)` });
        } else {
          ipArr.push({ seq, status: 'ok', label: `#${seq}` });
          if (r() * 100 < dupRate) {
            ipArr.push({ seq, status: 'dup', label: `#${seq} (trùng)` });
          }
        }
      }
      // Reorder adjacent pairs
      for (let i = 0; i < ipArr.length - 1; i++) {
        if (r() * 100 < reorderRate) {
          const tmp = ipArr[i]; ipArr[i] = ipArr[i + 1]; ipArr[i + 1] = tmp; i++;
        }
      }

      clear(ipBox).append(
        h('div', { class: 'row-lbl' }, 'Tầng IP nhận được (có thể mất, trùng, đảo thứ tự, và gói gửi lại):'),
        h('div', { class: 'pk-row' }, ipArr.map((p) => h('span', { class: 'pk ' + (p.status === 'ok' ? '' : p.status) }, p.label)))
      );

      clear(tcpBox).append(
        h('div', { class: 'row-lbl' }, 'Tầng TCP giao cho ứng dụng (đã khử trùng, xếp lại đúng thứ tự 1 → 8):'),
        h('div', { class: 'pk-row' }, [1, 2, 3, 4, 5, 6, 7, 8].map((n) => h('span', { class: 'pk' }, `#${n}`)))
      );

      const totalTimeMs = 40 + retransmits * 220 + (reorderRate > 0 ? 35 : 0);
      clear(stats).append(
        stat('Số gói phải truyền lại (Retransmit)', String(retransmits), retransmits > 2 ? 'warn' : 'ok'),
        stat('Tính toàn vẹn luồng byte TCP', 'Đúng 100% (#1 → #8)', 'ok'),
        stat('Tổng thời gian hoàn tất', fmtMs(totalTimeMs), totalTimeMs > 300 ? 'bad' : 'ok', 'TCP che được mất gói nhưng KHÔNG che được độ trễ!')
      );
    }
    render();
  });

  // =====================================================================
  // 9.2 Unreliable Networks — Six fates of a request (Figure 8-1)
  widget('request-fates', (root) => {
    const FATES = [
      { id: '1', label: '1. Request bị mất trên đường đi', serverRan: false, desc: 'Gói request rớt ở switch; Server chưa từng biết có request này.' },
      { id: '2', label: '2. Request kẹt trong hàng đợi', serverRan: true, desc: 'Request đến muộn sau khi Client đã timeout; Server vẫn thực thi nó về sau!' },
      { id: '3', label: '3. Node đích đã crash / mất điện', serverRan: false, desc: 'Server chết trước khi xử lý; dữ liệu không đổi.' },
      { id: '4', label: '4. Node đích bị GC pause dài', serverRan: true, desc: 'Server đứng hình 20s vì GC rồi tỉnh dậy xử lý tiếp request!' },
      { id: '5', label: '5. Server đã xử lý nhưng mất Response', serverRan: true, desc: 'Giao dịch ĐÃ COMMIT trên Server, nhưng gói trả lời bị rớt trên đường về.' },
      { id: '6', label: '6. Server đã xử lý nhưng Response về trễ', serverRan: true, desc: 'Giao dịch ĐÃ COMMIT; gói trả lời về tới nơi sau khi Client đã bỏ cuộc.' },
    ];
    let cur = '5', mystery = false, guess = null;
    const sg = seg({
      label: 'Tình huống thực tế bên dưới mạng (Hình 8-1)',
      options: FATES.map((f) => ({ value: f.id, label: '#' + f.id })),
      value: cur,
      onChange: (v) => { cur = v; guess = null; render(); },
    });
    const cbMys = checkbox('Chế độ bí ẩn (ẩn sự thật bên phía Server để bạn thử đoán)', mystery, (v) => { mystery = v; guess = null; render(); });

    const viz = h('div', { class: 'viz' });
    const stats = h('div', { class: 'stats' });
    const guessBox = h('div');

    root.append(
      h('div', { class: 'controls' }, ctl('Chọn kịch bản lỗi (Hình 8-1)', sg.el)),
      h('div', { class: 'btn-row' }, cbMys.el),
      viz, stats, guessBox
    );

    function render() {
      const f = FATES.find((x) => x.id === cur);
      const W = 580, H = 135;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Góc nhìn của Client và thực tế trên Server' });

      svg.append(
        // Client side (always identical!)
        s('rect', { x: 16, y: 18, width: 235, height: 98, rx: 10, class: 'f-accent-soft s-accent', 'stroke-width': 2 }),
        s('text', { x: 133, y: 42, 'text-anchor': 'middle', class: 'lbl-strong' }, 'Góc nhìn của Client'),
        s('text', { x: 133, y: 66, 'text-anchor': 'middle' }, 'Đã gửi Request lúc t = 0s'),
        s('text', { x: 133, y: 88, 'text-anchor': 'middle', class: 'f-bad lbl-strong' }, '⏱ Hết Timeout: Không có phản hồi!'),
        s('text', { x: 133, y: 106, 'text-anchor': 'middle' }, '(Giống hệt nhau ở cả 6 tình huống)'),

        // Server / Network truth
        s('rect', { x: 300, y: 18, width: 264, height: 98, rx: 10, class: mystery ? 'f-surface2 s-line dash' : f.serverRan ? 'f-warn s-warn' : 'f-bad-soft s-bad', 'stroke-width': 2 }),
        s('text', { x: 432, y: 42, 'text-anchor': 'middle', class: 'lbl-strong' }, mystery ? '❓ Sự thật phía Mạng & Server (Đang ẩn)' : f.label),
        s('text', { x: 432, y: 68, 'text-anchor': 'middle', class: 'lbl-strong' }, mystery ? 'Bạn có biết Server đã xử lý chưa?' : f.serverRan ? '⚠️ Server ĐÃ (hoặc SẼ) thực thi request!' : '✗ Server CHƯA thực thi request.'),
        s('text', { x: 432, y: 92, 'text-anchor': 'middle' }, mystery ? 'Chỉ dựa vào Timeout thì không thể phân biệt!' : f.desc)
      );
      clear(viz).append(svg);

      clear(stats).append(
        stat('Thông tin duy nhất Client có', 'Chưa nhận được phản hồi', 'warn'),
        stat('Trạng thái bên Server', mystery ? 'Không thể biết chắc!' : f.serverRan ? 'ĐÃ XỬ LÝ (Nguy cơ lặp nếu gửi lại)' : 'CHƯA XỬ LÝ', mystery ? 'warn' : f.serverRan ? 'bad' : 'accent')
      );

      clear(guessBox);
      if (mystery) {
        guessBox.append(
          h('div', { class: 'step-desc' },
            h('b', 'Thử đoán từ góc nhìn Client: '),
            'Nếu bây giờ Client tự động gửi lại (retry) request thanh toán này, có an toàn không? ',
            h('div', { class: 'btn-row', style: { marginTop: '8px' } },
              button('Đoán: Chưa xử lý (gửi lại an toàn)', () => { guess = 'no'; render(); }, 'ghost'),
              button('Đoán: Đã xử lý (gửi lại sẽ trừ tiền 2 lần)', () => { guess = 'yes'; render(); }, 'ghost'),
              button('Kết luận đúng: Không thể biết nếu không có Idempotency Key!', () => { guess = 'idk'; render(); })
            ),
            guess ? h('p', { class: 'lab-note', style: { marginTop: '6px' } },
              guess === 'idk'
                ? `✓ Chính xác! Sự thật của kịch bản #${f.id} là: "${f.label}". Vì Client không thể phân biệt 6 kịch bản, mọi lệnh retry đều phải kèm Idempotency Key.`
                : `✗ Bạn chỉ đang đoán mò! Ở kịch bản #${f.id} (${f.label}), thực tế là Server ${f.serverRan ? 'ĐÃ xử lý' : 'CHƯA xử lý'}.`
            ) : null
          )
        );
      }
    }
    render();
  });

  // =====================================================================
  // 9.3 Network Faults in Practice — Asymmetric Link Cutter
  widget('link-cutter', (root) => {
    const NODES = ['A1', 'A2', 'B1', 'B2'];
    // Links: 0 = ok (both ways), 1 = one-way (u -> v only, v drops incoming from u), 2 = dead
    const links = {
      'A1-A2': 1, // default book example: A1 NIC drops incoming packets but sends outgoing fine!
      'B1-B2': 0,
      'RACK': 0,  // inter-rack switch link between Rack A and Rack B
    };

    const viz = h('div', { class: 'viz' });
    const tblWrap = h('div', { class: 'table-wrap' });
    const stats = h('div', { class: 'stats' });

    const btnAsym = button('Ví dụ trong sách: Card mạng A1 gửi được nhưng rơi mọi gói đến', () => { links['A1-A2'] = 1; links['B1-B2'] = 0; links['RACK'] = 0; render(); }, 'ghost');
    const btnSplit = button('Đứt cáp nối giữa Rack A và Rack B (Netsplit)', () => { links['A1-A2'] = 0; links['B1-B2'] = 0; links['RACK'] = 2; render(); }, 'ghost');
    const btnHeal = button('Khôi phục toàn bộ mạng', () => { links['A1-A2'] = 0; links['B1-B2'] = 0; links['RACK'] = 0; render(); }, 'ghost');

    root.append(h('div', { class: 'btn-row' }, btnAsym, btnSplit, btnHeal), viz, tblWrap, stats);

    function canSendPacket(u, v) {
      if (u === v) return true;
      // If A1's NIC is in asymmetric mode (links['A1-A2'] === 1), A1 cannot RECEIVE any packet
      if (links['A1-A2'] === 1 && v === 'A1') return false;
      if (links['A1-A2'] === 2 && (u === 'A1' || v === 'A1')) return false;
      if (links['B1-B2'] === 1 && v === 'B1') return false;
      if (links['B1-B2'] === 2 && (u === 'B1' || v === 'B1')) return false;
      const rackU = u[0], rackV = v[0];
      if (rackU !== rackV) {
        if (links['RACK'] === 2) return false;
        if (links['RACK'] === 1 && rackV === 'B') return false;
      }
      return true;
    }

    function render() {
      const W = 580, H = 150;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Sơ đồ mạng hai Rack A và B' });

      const cycle = (k) => { links[k] = (links[k] + 1) % 3; render(); };
      const stLabel = (st, name) => st === 0 ? `${name}: Tốt 2 chiều` : st === 1 ? `${name}: Lỗi 1 chiều (rơi gói đến)` : `${name}: ĐỨT HẲN`;
      const stCls = (st) => st === 0 ? 'f-ok s-ok' : st === 1 ? 'f-warn s-warn' : 'f-bad-soft s-bad dash';

      svg.append(
        // Rack A box
        s('rect', { x: 16, y: 16, width: 200, height: 118, rx: 10, class: 'f-surface2 s-line' }),
        s('text', { x: 116, y: 36, 'text-anchor': 'middle', class: 'lbl-strong' }, 'Rack A (Switch ToR A)'),
        // Rack B box
        s('rect', { x: 364, y: 16, width: 200, height: 118, rx: 10, class: 'f-surface2 s-line' }),
        s('text', { x: 464, y: 36, 'text-anchor': 'middle', class: 'lbl-strong' }, 'Rack B (Switch ToR B)'),

        // Inter-rack link button
        s('g', { class: 'clickable', onClick: () => cycle('RACK') },
          s('line', { x1: 216, y1: 75, x2: 364, y2: 75, class: links['RACK'] === 0 ? 'f-none s-ok' : links['RACK'] === 1 ? 'f-none s-warn dash' : 'f-none s-bad dash', 'stroke-width': 3 }),
          s('rect', { x: 230, y: 56, width: 120, height: 36, rx: 6, class: stCls(links['RACK']) }),
          s('text', { x: 290, y: 78, 'text-anchor': 'middle', class: 'lbl-strong' }, stLabel(links['RACK'], 'Cáp liên Rack'))
        ),

        // Node A1 (clickable)
        s('g', { class: 'clickable', onClick: () => cycle('A1-A2') },
          s('rect', { x: 30, y: 50, width: 172, height: 34, rx: 6, class: stCls(links['A1-A2']) }),
          s('text', { x: 116, y: 71, 'text-anchor': 'middle', class: 'lbl-strong' }, stLabel(links['A1-A2'], 'NIC A1'))
        ),
        s('rect', { x: 30, y: 92, width: 172, height: 30, rx: 6, class: 'f-ok s-ok' }),
        s('text', { x: 116, y: 111, 'text-anchor': 'middle', class: 'lbl-strong' }, 'NIC A2: Tốt 2 chiều'),

        // Node B1 (clickable)
        s('g', { class: 'clickable', onClick: () => cycle('B1-B2') },
          s('rect', { x: 378, y: 50, width: 172, height: 34, rx: 6, class: stCls(links['B1-B2']) }),
          s('text', { x: 464, y: 71, 'text-anchor': 'middle', class: 'lbl-strong' }, stLabel(links['B1-B2'], 'NIC B1'))
        ),
        s('rect', { x: 378, y: 92, width: 172, height: 30, rx: 6, class: 'f-ok s-ok' }),
        s('text', { x: 464, y: 111, 'text-anchor': 'middle', class: 'lbl-strong' }, 'NIC B2: Tốt 2 chiều')
      );
      clear(viz).append(svg);

      // Matrix of Request + Response
      let okPairs = 0, oneWayPairs = 0, deadPairs = 0;
      const tbody = h('tbody');
      NODES.forEach((u) => {
        const tr = h('tr', h('th', `Từ ${u} gửi tới →`));
        NODES.forEach((v) => {
          if (u === v) {
            tr.append(h('td', { class: 'self' }, '—'));
            return;
          }
          const reqOk = canSendPacket(u, v);
          const respOk = reqOk && canSendPacket(v, u);
          if (respOk) {
            okPairs++;
            tr.append(h('td', { class: 'ok' }, '✓ Có phản hồi'));
          } else if (reqOk && !respOk) {
            oneWayPairs++;
            tr.append(h('td', { class: 'warn' }, '⚠️ Tới đích nhưng mất ACK!'));
          } else {
            deadPairs++;
            tr.append(h('td', { class: 'bad' }, '✗ Không tới được'));
          }
        });
        tbody.append(tr);
      });

      clear(tblWrap).append(
        h('table', { class: 'mx', style: { width: '100%' } },
          h('thead', h('tr', h('th', 'Gửi \\ Đích'), NODES.map((n) => h('th', n)))),
          tbody
        )
      );

      clear(stats).append(
        stat('Cặp giao tiếp hoàn chỉnh (2 chiều)', `${okPairs} / 12`, okPairs === 12 ? 'ok' : 'warn'),
        stat('Nguy hiểm: Đích đã xử lý nhưng mất đường về', `${oneWayPairs} cặp`, oneWayPairs > 0 ? 'warn' : 'ok', 'Gây bất đồng bộ trạng thái'),
        stat('Cặp mất liên lạc hoàn toàn', `${deadPairs} cặp`, deadPairs > 0 ? 'bad' : 'ok')
      );
    }
    render();
  });

  // =====================================================================
  // 9.4 Detecting Faults across layers
  widget('fault-detect', (root) => {
    const SCEN = {
      closed: {
        name: 'Tiến trình đóng cổng (OS còn sống)',
        signal: 'Gói TCP RST / FIN trả về ngay từ OS đích',
        time: '~1–5 ms (1 RTT)',
        know: 'Biết chắc không có tiến trình nào đang nghe cổng đó.',
        dontKnow: 'Nếu tiến trình vừa crash trong lúc đang xử lý request trước đó, bạn vẫn không biết nó đã ghi đĩa xong chưa.',
      },
      script: {
        name: 'Tiến trình DB crash (có script giám sát trên máy)',
        signal: 'Script watchdog chủ động báo cho các node khác',
        time: '~10–50 ms',
        know: 'Biết ngay tiến trình vừa thoát mà không phải chờ hết timeout dài.',
        dontKnow: 'Phụ thuộc vào việc OS và mạng của máy đó vẫn còn hoạt động.',
      },
      link: {
        name: 'Đứt cáp vật lý cắm vào Switch quản lý',
        signal: 'Giao diện quản lý Switch báo Link Down (nếu có quyền truy cập)',
        time: 'Tức thì (nếu nội bộ) / Timeout (nếu qua Internet)',
        know: 'Biết cổng vật lý mất tín hiệu điện/quang.',
        dontKnow: 'Trên cloud hoặc qua Internet, ứng dụng không có quyền hỏi switch nên vẫn phải chờ timeout.',
      },
      icmp: {
        name: 'Router không tìm được đường tới IP đích',
        signal: 'Bản tin ICMP Destination Unreachable',
        time: '~10–100 ms (không đảm bảo)',
        know: 'Biết router trung gian hiện không có tuyến đường.',
        dontKnow: 'Tường lửa thường chặn ICMP, và bản thân router cũng chỉ phát hiện lỗi bằng timeout của nó.',
      },
      silent: {
        name: 'Máy mất nguồn đột ngột / Treo cứng kernel',
        signal: 'KHÔNG CÓ TÍN HIỆU NÀO (Im lặng hoàn toàn)',
        time: 'Phải chờ hết Timeout (vài giây đến vài chục giây)',
        know: 'Chỉ biết là chưa nhận được phản hồi.',
        dontKnow: 'Không thể phân biệt máy chết thật với mạng nghẽn hay GC pause.',
      },
    };
    let cur = 'closed', canQuerySwitch = false;
    const sg = seg({
      label: 'Tình huống lỗi',
      options: [
        { value: 'closed', label: 'Đóng cổng (RST)' },
        { value: 'script', label: 'Crash + Watchdog' },
        { value: 'link', label: 'Đứt cáp Switch' },
        { value: 'icmp', label: 'Router (ICMP)' },
        { value: 'silent', label: 'Mất điện (Im lặng)' },
      ],
      value: cur,
      onChange: (v) => { cur = v; render(); },
    });
    const cbSw = checkbox('Có quyền truy cập quản trị Switch phần cứng trong Datacenter riêng', canQuerySwitch, (v) => { canQuerySwitch = v; render(); });
    const kvBox = h('div', { class: 'box' });
    const stats = h('div', { class: 'stats' });

    root.append(h('div', { class: 'controls' }, ctl('Chọn tình huống', sg.el)), h('div', { class: 'btn-row' }, cbSw.el), kvBox, stats);

    function render() {
      const d = SCEN[cur];
      const effectiveTime = cur === 'link' ? (canQuerySwitch ? '~5 ms (Đọc từ Switch MIB)' : 'Phải chờ Timeout (Cloud ẩn Switch)') : d.time;

      clear(kvBox).append(
        h('h5', d.name),
        h('dl', { class: 'kv' },
          h('dt', 'Tín hiệu nhận được'), h('dd', d.signal),
          h('dt', 'Thời gian phát hiện'), h('dd', effectiveTime),
          h('dt', 'Điều biết chắc'), h('dd', d.know),
          h('dt', 'Điều VẪN không biết'), h('dd', d.dontKnow)
        )
      );

      clear(stats).append(
        stat('Phản hồi lỗi sớm', cur === 'silent' || (cur === 'link' && !canQuerySwitch) ? 'Không có (Im lặng)' : 'Có tín hiệu hỗ trợ', cur === 'silent' ? 'bad' : 'ok'),
        stat('Công cụ dự phòng bắt buộc', 'Timeout ở tầng ứng dụng', 'accent', 'Luôn cần vì tín hiệu tầng dưới không được bảo đảm')
      );
    }
    render();
  });

  // =====================================================================
  // 9.5 Timeouts and Unbounded Delays (Phi Accrual vs Fixed Timeout)
  widget('timeout-sim', (root) => {
    let timeoutMs = 450, spike = false, adaptive = false;
    const slTo = slider({ label: 'Ngưỡng Timeout cố định', min: 150, max: 1000, step: 25, value: timeoutMs, format: (v) => v + ' ms', onInput: (v) => { timeoutMs = v; render(); } });
    const cbSpike = checkbox('Bật đợt tải tăng đột biến (Mạng nghẽn thoáng qua)', spike, (v) => { spike = v; render(); });
    const cbPhi = checkbox('Dùng Phi Accrual Failure Detector (tự co giãn theo độ trễ & jitter)', adaptive, (v) => { adaptive = v; render(); });

    const viz = h('div', { class: 'viz' });
    const stats = h('div', { class: 'stats' });
    root.append(h('div', { class: 'controls' }, slTo.el), h('div', { class: 'btn-row' }, cbSpike.el, cbPhi.el), viz, stats);

    function render() {
      const effTimeout = adaptive ? (spike ? 850 : 320) : timeoutMs;
      const W = 600, H = 185, L = 46, R = 20, T = 18, B = 32;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Phân bố RTT của các nhịp heartbeat' });
      const x = (ms) => L + (ms / 1000) * (W - L - R);

      [0, 200, 400, 600, 800, 1000].forEach((ms) => {
        svg.append(
          s('line', { x1: x(ms), x2: x(ms), y1: T, y2: H - B, class: 'grid' }),
          s('text', { x: x(ms), y: H - B + 15, 'text-anchor': 'middle' }, ms + ' ms')
        );
      });

      let falsePositives = 0;
      const bins = 40;
      for (let i = 0; i < bins; i++) {
        const ms = (i + 0.5) * (1000 / bins);
        const base = Math.exp(-Math.pow((ms - 120) / 70, 2)) * 95;
        const tail = (spike ? 38 : 12) * Math.exp(-ms / (spike ? 380 : 190));
        const hVal = clamp(base + tail, 2, 125);
        const isFalseDead = ms > effTimeout;
        if (isFalseDead) falsePositives += Math.round(hVal * 0.25);
        const bx = x(i * 25) + 1;
        const bw = (W - L - R) / bins - 2;
        svg.append(s('rect', { x: bx, y: H - B - hVal, width: bw, height: hVal, class: isFalseDead ? 'f-bad' : 'f-accent-soft s-accent' }));
      }

      svg.append(
        s('line', { x1: x(effTimeout), x2: x(effTimeout), y1: T, y2: H - B, class: 'f-none s-bad dash', 'stroke-width': 2.2 }),
        s('text', { x: clamp(x(effTimeout), L + 70, W - 80), y: T + 10, 'text-anchor': 'middle', class: 'f-bad lbl-strong' },
          `${adaptive ? 'Ngưỡng Phi Accrual' : 'Timeout cố định'} = ${effTimeout} ms`)
      );
      clear(viz).append(svg);

      clear(stats).append(
        stat('Báo chết nhầm (False Positive)', `${falsePositives} nhịp / giờ`, falsePositives === 0 ? 'ok' : falsePositives < 15 ? 'warn' : 'bad', falsePositives > 20 ? 'Nguy cơ gây lỗi dây chuyền (cascading failure)!' : 'Ổn định'),
        stat('Thời gian phát hiện khi chết thật', fmtMs(effTimeout), effTimeout > 700 ? 'warn' : 'ok'),
        stat('Bộ phát hiện đang dùng', adaptive ? 'Phi Accrual (Cassandra / Akka)' : 'Timeout cố định (2d + r)', 'accent')
      );
    }
    render();
  });

  // =====================================================================
  // 9.6 Network Congestion and Switch Queueing (Figure 8-2)
  widget('switch-queue', (root) => {
    let p1 = 35, p2 = 30, p4 = 25, bufSize = 16;
    const sl1 = slider({ label: 'Tải cổng 1 gửi sang cổng 3', min: 5, max: 60, step: 5, value: p1, format: (v) => v + '%', onInput: (v) => { p1 = v; render(); } });
    const sl2 = slider({ label: 'Tải cổng 2 gửi sang cổng 3', min: 5, max: 60, step: 5, value: p2, format: (v) => v + '%', onInput: (v) => { p2 = v; render(); } });
    const sl4 = slider({ label: 'Tải cổng 4 gửi sang cổng 3', min: 5, max: 60, step: 5, value: p4, format: (v) => { p4 = v; return v + '%'; }, onInput: (v) => { p4 = v; render(); } });
    const slBuf = slider({ label: 'Kích thước hàng đợi (Switch Buffer)', min: 4, max: 32, step: 4, value: bufSize, format: (v) => v + ' gói', onInput: (v) => { bufSize = v; render(); } });

    const viz = h('div', { class: 'viz' });
    const stats = h('div', { class: 'stats' });
    root.append(h('div', { class: 'controls' }, sl1.el, sl2.el, sl4.el, slBuf.el), viz, stats);

    function render() {
      const totalLoad = p1 + p2 + p4; // % of Port 3 capacity
      const rho = totalLoad / 100;
      const queuedPkts = rho < 1 ? Math.min(bufSize, Math.round((rho * rho) / (1 - rho + 0.04))) : bufSize;
      const dropPct = rho > 1 ? ((totalLoad - 100) / totalLoad) : (queuedPkts >= bufSize ? 0.03 : 0);
      const queueingDelayMs = 0.2 + queuedPkts * 1.8 + (dropPct > 0 ? 200 : 0); // TCP retransmit timeout if dropped

      const W = 600, H = 190;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Hàng đợi ở cổng 3 của Switch (Hình 8-2)' });

      // Ports 1, 2, 4 -> Switch Queue -> Port 3
      [
        [30, 'Cổng 1 (' + p1 + '%)', 'f-accent'],
        [85, 'Cổng 2 (' + p2 + '%)', 'f-violet'],
        [140, 'Cổng 4 (' + p4 + '%)', 'f-mark'],
      ].forEach(([y, lbl, cls]) => {
        svg.append(
          s('rect', { x: 16, y: y - 14, width: 115, height: 28, rx: 6, class: 'f-surface2 s-line' }),
          s('text', { x: 73, y: y + 4, 'text-anchor': 'middle', class: 'lbl-strong' }, lbl),
          s('line', { x1: 131, y1: y, x2: 210, y2: 85, class: 'f-none s-ink3', 'stroke-width': 2 }),
          s('circle', { cx: 170, cy: (y + 85) / 2, r: 4, class: cls })
        );
      });

      // Switch buffer slots
      svg.append(
        s('rect', { x: 210, y: 48, width: 230, height: 74, rx: 8, class: 'f-surface2 s-accent', 'stroke-width': 2 }),
        s('text', { x: 325, y: 40, 'text-anchor': 'middle', class: 'lbl-strong' }, `Hàng đợi Cổng 3 (${queuedPkts}/${bufSize} gói)`)
      );
      const slotW = 200 / bufSize;
      for (let i = 0; i < bufSize; i++) {
        const filled = i < queuedPkts;
        svg.append(s('rect', {
          x: 224 + i * slotW, y: 64, width: Math.max(2, slotW - 2), height: 42, rx: 2,
          class: filled ? (queuedPkts >= bufSize ? 'f-bad' : 'f-accent') : 'f-surface s-line',
        }));
      }

      // Port 3 egress
      svg.append(
        s('line', { x1: 440, y1: 85, x2: 500, y2: 85, class: 'f-none s-ok', 'stroke-width': 3 }),
        s('rect', { x: 500, y: 62, width: 84, height: 46, rx: 8, class: 'f-ok s-ok' }),
        s('text', { x: 542, y: 89, 'text-anchor': 'middle', class: 'lbl-strong' }, 'Cổng 3 Ra'),
        s('text', { x: 325, y: 155, 'text-anchor': 'middle', class: dropPct > 0 ? 'f-bad lbl-strong' : 'f-ink2' },
          dropPct > 0 ? '⚠️ Hàng đợi tràn → Rơi gói → TCP phải chờ Timeout để gửi lại!' : 'Độ trễ tăng vọt theo đường cong "gậy khúc côn cầu" khi tổng tải tiến sát 100%.')
      );
      clear(viz).append(svg);

      clear(stats).append(
        stat('Tổng tải dồn vào Cổng 3', totalLoad + '% công suất', totalLoad >= 100 ? 'bad' : totalLoad >= 85 ? 'warn' : 'ok'),
        stat('Tỉ lệ rơi gói do tràn Buffer', pct(dropPct, 1), dropPct > 0 ? 'bad' : 'ok'),
        stat('Độ trễ ứng dụng cảm nhận', fmtMs(queueingDelayMs), queueingDelayMs > 50 ? 'bad' : queueingDelayMs > 10 ? 'warn' : 'ok')
      );
    }
    render();
  });

  // =====================================================================
  // 9.7 Synchronous (Circuit-switched) vs Asynchronous (Packet-switched)
  widget('circuit-vs-packet', (root) => {
    let mode = 'packet', burstSize = 6;
    const sg = seg({
      label: 'Chế độ chia sẻ đường truyền (10 khe mỗi khung 250 µs)',
      options: [
        { value: 'circuit', label: 'Chuyển mạch kênh (ISDN / Điện thoại)' },
        { value: 'packet', label: 'Chuyển mạch gói (Ethernet / IP)' },
      ],
      value: mode,
      onChange: (v) => { mode = v; render(); },
    });
    const slBurst = slider({ label: 'Kích thước file tải bùng nổ (số khe cần truyền)', min: 2, max: 18, step: 2, value: burstSize, format: (v) => v + ' khe', onInput: (v) => { burstSize = v; render(); } });

    const viz = h('div', { class: 'viz' });
    const stats = h('div', { class: 'stats' });
    root.append(h('div', { class: 'controls' }, ctl('Chế độ mạng', sg.el), slBurst.el), viz, stats);

    function render() {
      // 10 slots total: 4 active voice calls (need 1 slot each per frame) + 1 bursty file transfer (allocated 1 slot in circuit, or uses all 6 free slots in packet)
      const W = 580, H = 130;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': '10 khe thời gian trên đường truyền' });

      for (let i = 0; i < 10; i++) {
        const x = 25 + i * 53;
        const isVoice = i < 4;
        const isFile = mode === 'circuit' ? i === 4 : i >= 4 && i < 4 + Math.min(6, burstSize);
        const cls = isVoice ? 'f-accent' : isFile ? 'f-violet' : 'f-surface2 s-line dash';
        const lbl = isVoice ? `Thoại #${i + 1}` : isFile ? 'Tải File' : 'Trống';

        svg.append(
          s('rect', { x, y: 26, width: 46, height: 64, rx: 6, class: cls }),
          s('text', { x: x + 23, y: 62, 'text-anchor': 'middle', class: 'lbl-strong ' + (isVoice || isFile ? 'f-surface' : '') }, lbl),
          s('text', { x: x + 23, y: 108, 'text-anchor': 'middle' }, `Khe ${i + 1}`)
        );
      }
      clear(viz).append(svg);

      const framesCircuit = burstSize; // 1 slot per frame
      const framesPacket = Math.ceil(burstSize / 6); // uses all 6 remaining slots!
      const utilCircuit = 5 / 10;
      const utilPacket = (4 + Math.min(6, burstSize)) / 10;

      clear(stats).append(
        stat('Mức tận dụng đường truyền', pct(mode === 'circuit' ? utilCircuit : utilPacket, 0), mode === 'circuit' ? 'warn' : 'ok', mode === 'circuit' ? '5 khe bỏ trống lãng phí!' : 'Tận dụng tối đa khe rảnh'),
        stat('Thời gian truyền xong File', mode === 'circuit' ? `${framesCircuit} khung (${framesCircuit * 0.25} ms)` : `${framesPacket} khung (${framesPacket * 0.25} ms)`, mode === 'packet' ? 'ok' : 'warn'),
        stat('Độ trễ tối đa (Bounded Delay)', mode === 'circuit' ? 'Có bảo đảm tuyệt đối (0 hàng đợi)' : 'Không giới hạn (có thể nghẽn hàng đợi)', mode === 'circuit' ? 'ok' : 'warn')
      );
    }
    render();
  });

  // =====================================================================
  // 9.8 Time-of-Day vs Monotonic Clocks
  widget('two-clocks', (root) => {
    let jumpMs = -3000, jumpAtSec = 4;
    const slJump = slider({ label: 'Cú nhảy của đồng hồ Time-of-Day khi NTP đồng bộ lại', min: -8000, max: 6000, step: 500, value: jumpMs, format: (v) => (v >= 0 ? '+' : '') + fmt(v / 1000, 1) + ' s', onInput: (v) => { jumpMs = v; render(); } });
    const slAt = slider({ label: 'Thời điểm NTP can thiệp (trong lúc thao tác chạy từ 2s → 7s)', min: 3, max: 6, step: 1, value: jumpAtSec, format: (v) => 'giây thứ ' + v, onInput: (v) => { jumpAtSec = v; render(); } });

    const viz = h('div', { class: 'viz' });
    const stats = h('div', { class: 'stats' });
    root.append(h('div', { class: 'controls' }, slJump.el, slAt.el), viz, stats);

    function render() {
      const realDurationSec = 5.0; // from t=2s to t=7s
      const todMeasuredSec = 5.0 + jumpMs / 1000;
      const monoMeasuredSec = 5.0; // monotonic never jumps!

      const W = 600, H = 190, L = 52, R = 20, T = 18, B = 32;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Đồng hồ Time-of-Day nhảy so với Monotonic' });
      const x = (t) => L + (t / 10) * (W - L - R);
      const y = (v) => H - B - clamp((v + 4) / 18, 0, 1) * (H - T - B);

      for (let t = 0; t <= 10; t += 2) {
        svg.append(
          s('line', { x1: x(t), x2: x(t), y1: T, y2: H - B, class: 'grid' }),
          s('text', { x: x(t), y: H - B + 15, 'text-anchor': 'middle' }, t + 's thật')
        );
      }

      // Highlight operation window [2s, 7s]
      svg.append(
        s('rect', { x: x(2), y: T, width: x(7) - x(2), height: H - T - B, class: 'f-mark-soft' }),
        s('text', { x: (x(2) + x(7)) / 2, y: T + 14, 'text-anchor': 'middle', class: 'lbl-strong' }, 'Thao tác chạy từ t = 2s đến t = 7s (Đúng 5,0 giây)')
      );

      // Monotonic line (smooth 0 -> 10)
      svg.append(s('line', { x1: x(0), y1: y(0), x2: x(10), y2: y(10), class: 'f-none s-ok', 'stroke-width': 2.5 }));

      // Time-of-day line with step at jumpAtSec
      const j = jumpMs / 1000;
      const dTod = `M${x(0)} ${y(0)} L${x(jumpAtSec)} ${y(jumpAtSec)} L${x(jumpAtSec)} ${y(jumpAtSec + j)} L${x(10)} ${y(10 + j)}`;
      svg.append(
        s('path', { d: dTod, class: 'f-none s-bad dash', 'stroke-width': 2.2 }),
        s('text', { x: L + 8, y: H - B - 8, class: 'lbl-strong' }, 'Xanh lá: CLOCK_MONOTONIC · Đỏ đứt: CLOCK_REALTIME (bị NTP nhảy)')
      );
      clear(viz).append(svg);

      clear(stats).append(
        stat('Đo bằng CLOCK_REALTIME (currentTimeMillis)', fmt(todMeasuredSec, 1) + ' giây', todMeasuredSec <= 0 ? 'bad' : jumpMs !== 0 ? 'warn' : 'ok', todMeasuredSec < 0 ? 'THỜI GIAN ÂM! (Nhảy lùi)' : 'Sai lệch ' + fmt(jumpMs / 1000, 1) + 's'),
        stat('Đo bằng CLOCK_MONOTONIC (nanoTime)', fmt(monoMeasuredSec, 1) + ' giây', 'ok', 'Luôn tiến về phía trước, chỉ slewing ≤ 0,05%')
      );
    }
    render();
  });

  // =====================================================================
  // 9.9 Clock Synchronization and Quartz Drift
  widget('clock-drift', (root) => {
    let driftPpm = 200, syncIntervalSec = 60, ntpErrorMs = 35, firewallBlocked = false;
    const slPpm = slider({ label: 'Độ trôi tinh thể thạch anh (ppm)', min: 10, max: 500, step: 10, value: driftPpm, format: (v) => v + ' ppm', onInput: (v) => { driftPpm = v; render(); } });
    const slInt = slider({ label: 'Chu kỳ đồng bộ NTP', min: 30, max: 3600, step: 30, value: syncIntervalSec, format: (v) => v + ' s', onInput: (v) => { syncIntervalSec = v; render(); } });
    const slNtp = slider({ label: 'Sai số mạng khi hỏi NTP', min: 5, max: 100, step: 5, value: ntpErrorMs, format: (v) => v + ' ms', onInput: (v) => { ntpErrorMs = v; render(); } });
    const cbFw = checkbox('Tường lửa cấu hình sai chặn cổng UDP 123 (NTP bị hỏng âm thầm)', firewallBlocked, (v) => { firewallBlocked = v; render(); });

    const viz = h('div', { class: 'viz' });
    const stats = h('div', { class: 'stats' });
    root.append(
      h('div', { class: 'controls' }, slPpm.el, slInt.el, slNtp.el),
      h('div', { class: 'btn-row' }, cbFw.el),
      viz, stats
    );

    function render() {
      const driftBetweenSyncMs = (driftPpm * syncIntervalSec) / 1000;
      const maxSkewMs = firewallBlocked ? (driftPpm * 86400) / 1000 : ntpErrorMs + driftBetweenSyncMs;

      const W = 600, H = 180, L = 52, R = 20, T = 18, B = 30;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Đồ thị răng cưa độ lệch đồng hồ' });

      const pts = [];
      const cycles = 4;
      const yMax = Math.max(120, ntpErrorMs + driftBetweenSyncMs * (firewallBlocked ? 4 : 1.2));
      const y = (ms) => H - B - clamp(ms / yMax, 0, 1) * (H - T - B);
      const x = (c) => L + (c / cycles) * (W - L - R);

      for (let i = 0; i < cycles; i++) {
        const startErr = firewallBlocked ? ntpErrorMs + i * driftBetweenSyncMs : ntpErrorMs;
        const endErr = startErr + driftBetweenSyncMs;
        pts.push(`${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(startErr).toFixed(1)}`);
        pts.push(`L${x(i + 1).toFixed(1)} ${y(endErr).toFixed(1)}`);
      }

      svg.append(
        s('line', { x1: L, x2: W - R, y1: H - B, y2: H - B, class: 'axis' }),
        s('line', { x1: L, x2: L, y1: T, y2: H - B, class: 'axis' }),
        s('path', { d: pts.join(' '), class: firewallBlocked ? 'f-none s-bad' : 'f-none s-accent', 'stroke-width': 2.5 }),
        s('text', { x: L + 10, y: T + 14, class: 'lbl-strong' },
          firewallBlocked ? 'NTP bị chặn: đồng hồ trôi tuột không giới hạn (~17 giây/ngày ở 200 ppm)!' : 'Đồ thị răng cưa: trôi dần rồi được NTP kéo về mỗi chu kỳ')
      );
      clear(viz).append(svg);

      clear(stats).append(
        stat('Trôi thêm giữa 2 lần NTP', fmtMs(driftBetweenSyncMs), driftBetweenSyncMs > 100 ? 'warn' : 'ok'),
        stat('Sai số tối đa (hay sau 1 ngày nếu mất NTP)', fmtMs(maxSkewMs), maxSkewMs > 500 ? 'bad' : maxSkewMs > 80 ? 'warn' : 'ok'),
        stat('Chuẩn Google (200 ppm, đồng bộ 30s)', 'Trôi 6 ms + RTT mạng', 'accent')
      );
    }
    render();
  });

  // =====================================================================
  // 9.10 Timestamps for Ordering Events — LWW Clock Skew (Figure 8-3)
  widget('lww-skew', (root) => {
    let skewNode1Ms = 3, clockType = 'wall';
    const slSkew = slider({ label: 'Độ lệch đồng hồ của Node 1 so với Node 3', min: -5, max: 8, step: 1, value: skewNode1Ms, format: (v) => (v >= 0 ? '+' : '') + v + ' ms', onInput: (v) => { skewNode1Ms = v; render(); } });
    const sgClk = seg({
      label: 'Loại đồng hồ dùng để gắn nhãn thứ tự',
      options: [
        { value: 'wall', label: 'Đồng hồ vật lý (Time-of-day + LWW)' },
        { value: 'logical', label: 'Đồng hồ logic (Lamport / Version Vector)' },
      ],
      value: clockType,
      onChange: (v) => { clockType = v; render(); },
    });

    const viz = h('div', { class: 'viz' });
    const stats = h('div', { class: 'stats' });
    root.append(h('div', { class: 'controls' }, slSkew.el, ctl('Loại đồng hồ', sgClk.el)), viz, stats);

    function render() {
      // Real time: Client A writes x=1 on Node 1 at t_real = 42.001s; replicates to Node 3; Client B reads x=1 and writes x=2 on Node 3 at t_real = 42.003s
      const ts1 = 42001 + skewNode1Ms; // default +3ms -> 42.004s (exact book Figure 8-3!)
      const ts2 = 42003;               // Node 3 has exact time 42.003s
      const dropped = clockType === 'wall' && ts2 < ts1;

      const W = 600, H = 175;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Hình 8-3: LWW đánh mất ghi xảy ra sau' });

      svg.append(
        s('rect', { x: 20, y: 20, width: 175, height: 52, rx: 8, class: 'f-accent-soft s-accent' }),
        s('text', { x: 107, y: 42, 'text-anchor': 'middle', class: 'lbl-strong' }, '1. Node 1: Ghi x = 1'),
        s('text', { x: 107, y: 60, 'text-anchor': 'middle' }, clockType === 'wall' ? `ts = ${(ts1 / 1000).toFixed(3)}s` : 'logical v = 1'),

        s('line', { x1: 195, y1: 46, x2: 245, y2: 46, class: 'f-none s-accent', 'stroke-width': 2 }),

        s('rect', { x: 245, y: 20, width: 195, height: 52, rx: 8, class: 'f-violet-soft s-violet' }),
        s('text', { x: 342, y: 42, 'text-anchor': 'middle', class: 'lbl-strong' }, '2. Node 3: Đọc x=1 → Ghi x = 2'),
        s('text', { x: 342, y: 60, 'text-anchor': 'middle' }, clockType === 'wall' ? `ts = ${(ts2 / 1000).toFixed(3)}s` : 'logical v = 2 (vì thấy v1)'),

        s('rect', { x: 110, y: 98, width: 380, height: 56, rx: 8, class: dropped ? 'f-bad-soft s-bad' : 'f-ok s-ok', 'stroke-width': 2 }),
        s('text', { x: 300, y: 122, 'text-anchor': 'middle', class: 'lbl-strong' },
          dropped ? `✗ Node 2 nhận cả hai và GIỮ x = 1, BỎ x = 2 (vì ${(ts1 / 1000).toFixed(3)} > ${(ts2 / 1000).toFixed(3)})!` : '✓ Node 2 giữ đúng x = 2 (phản ánh đúng quan hệ nhân quả A → B)'),
        s('text', { x: 300, y: 142, 'text-anchor': 'middle' },
          dropped ? 'Chỉ lệch 3 ms mà ghi xảy ra sau bị xoá sổ âm thầm!' : 'An toàn')
      );
      clear(viz).append(svg);

      clear(stats).append(
        stat('Nhãn của x = 1 (Node 1)', clockType === 'wall' ? `${(ts1 / 1000).toFixed(3)} s` : 'v = 1', 'accent'),
        stat('Nhãn của x = 2 (Node 3, ghi sau)', clockType === 'wall' ? `${(ts2 / 1000).toFixed(3)} s` : 'v = 2', dropped ? 'bad' : 'ok'),
        stat('Giá trị cuối cùng còn lại', dropped ? 'x = 1 (MẤT GHI x = 2!)' : 'x = 2 (Đúng nhân quả)', dropped ? 'bad' : 'ok')
      );
    }
    render();
  });

  // =====================================================================
  // 9.11 Confidence Intervals and Google Spanner's TrueTime
  widget('truetime', (root) => {
    let epsMs = 4, gapMs = 3, commitWait = true;
    const slEps = slider({ label: 'Sai số đồng hồ ε (bán kính khoảng tin cậy)', min: 1, max: 10, step: 1, value: epsMs, format: (v) => '±' + v + ' ms (2ε = ' + (2 * v) + ' ms)', onInput: (v) => { epsMs = v; render(); } });
    const slGap = slider({ label: 'Khoảng cách thực tế B bắt đầu sau A', min: 1, max: 20, step: 1, value: gapMs, format: (v) => '+' + v + ' ms', onInput: (v) => { gapMs = v; render(); } });
    const cbWait = checkbox('Bật Spanner Commit Wait (A chờ đúng 2ε trước khi hoàn tất commit)', commitWait, (v) => { commitWait = v; render(); });

    const viz = h('div', { class: 'viz' });
    const stats = h('div', { class: 'stats' });
    root.append(h('div', { class: 'controls' }, slEps.el, slGap.el), h('div', { class: 'btn-row' }, cbWait.el), viz, stats);

    function render() {
      const aCenter = 10;
      const aEarliest = aCenter - epsMs, aLatest = aCenter + epsMs;
      const bCenter = commitWait ? aCenter + 2 * epsMs + gapMs : aCenter + gapMs;
      const bEarliest = bCenter - epsMs, bLatest = bCenter + epsMs;
      const overlap = bEarliest <= aLatest;

      const W = 600, H = 155, L = 95, R = 25;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Khoảng tin cậy TrueTime của A và B' });
      const x = (ms) => L + (ms / 45) * (W - L - R);

      [0, 10, 20, 30, 40].forEach((ms) => {
        svg.append(
          s('line', { x1: x(ms), x2: x(ms), y1: 18, y2: 120, class: 'grid' }),
          s('text', { x: x(ms), y: 138, 'text-anchor': 'middle' }, ms + ' ms')
        );
      });

      // Interval A
      svg.append(
        s('text', { x: 10, y: 48, class: 'lbl-strong' }, 'Giao dịch A'),
        s('rect', { x: x(aEarliest), y: 32, width: x(aLatest) - x(aEarliest), height: 24, rx: 5, class: 'f-accent-soft s-accent', 'stroke-width': 2 }),
        s('text', { x: x(aCenter), y: 48, 'text-anchor': 'middle', class: 'lbl-strong' }, `[${aEarliest}, ${aLatest}]`),

        // Interval B
        s('text', { x: 10, y: 92, class: 'lbl-strong' }, 'Giao dịch B'),
        s('rect', { x: x(bEarliest), y: 76, width: x(bLatest) - x(bEarliest), height: 24, rx: 5, class: overlap ? 'f-bad-soft s-bad' : 'f-ok s-ok', 'stroke-width': 2 }),
        s('text', { x: x(bCenter), y: 92, 'text-anchor': 'middle', class: 'lbl-strong' }, `[${bEarliest}, ${bLatest}]`)
      );
      clear(viz).append(svg);

      clear(stats).append(
        stat('Khoảng TrueTime của A', `[${aEarliest} ms, ${aLatest} ms]`, 'accent', `Độ rộng 2ε = ${2 * epsMs} ms`),
        stat('Khoảng TrueTime của B', `[${bEarliest} ms, ${bLatest} ms]`, overlap ? 'bad' : 'ok'),
        stat('Thứ tự nhân quả A < B', overlap ? 'KHÔNG CHẮC CHẮN (Chồng lấn!)' : 'Chắc chắn 100% (Không chồng lấn)', overlap ? 'bad' : 'ok')
      );
    }
    render();
  });

  // =====================================================================
  // 9.12a Process Pauses & Lease Expiration
  widget('lease-pause', (root) => {
    let pauseSec = 15, pauseLine = 'afterCheck', skewSec = 0;
    const slPause = slider({ label: 'Độ dài cú tạm dừng (GC pause / VM suspend)', min: 0, max: 25, step: 1, value: pauseSec, format: (v) => v + ' giây', onInput: (v) => { pauseSec = v; render(); } });
    const sgLine = seg({
      label: 'Vị trí thread bị dừng trong vòng lặp',
      options: [
        { value: 'beforeCheck', label: 'Trước dòng if (lease.isValid())' },
        { value: 'afterCheck', label: 'Ngay SAU dòng if (lease.isValid())' },
      ],
      value: pauseLine,
      onChange: (v) => { pauseLine = v; render(); },
    });
    const slSkew = slider({ label: 'Đồng hồ Node 1 chậm hơn thực tế', min: 0, max: 12, step: 2, value: skewSec, format: (v) => v + ' giây', onInput: (v) => { skewSec = v; render(); } });

    const codeEl = h('pre', { class: 'code' });
    const stats = h('div', { class: 'stats' });
    root.append(h('div', { class: 'controls' }, slPause.el, ctl('Vị trí dừng', sgLine.el), slSkew.el), codeEl, stats);

    function render() {
      // Request arrives at t = 22s; lease expires at t = 30s (or Node 2 takes over at 30s)
      const tStart = 22;
      const tProcess = tStart + pauseSec;
      const leaseExpiredAtProcess = tProcess > 30;
      const unsafeWrite = leaseExpiredAtProcess && (pauseLine === 'afterCheck' || tProcess - skewSec <= 30);

      clear(codeEl).append(
        h('span', { class: 'ln' }, 'request = getIncomingRequest(); // tại t = 22s (Lease hết hạn lúc 30s)'),
        h('span', { class: 'ln' + (pauseLine === 'beforeCheck' && pauseSec > 0 ? ' pz' : '') },
          pauseLine === 'beforeCheck' && pauseSec > 0 ? `// ⏸ DỪNG ${pauseSec}s TẠI ĐÂY → tỉnh dậy lúc t = ${tProcess}s` : '// (không dừng trước khi kiểm tra)'),
        h('span', { class: 'ln hl' }, 'if (lease.isValid()) {'),
        h('span', { class: 'ln' + (pauseLine === 'afterCheck' && pauseSec > 0 ? ' pz' : '') },
          pauseLine === 'afterCheck' && pauseSec > 0 ? `    // ⏸ GC PAUSE ${pauseSec}s TẠI ĐÂY! Lease hết hạn lúc 30s, Node 2 đã lên làm Leader!` : '    // (kiểm tra xong chạy thẳng xuống process)'),
        h('span', { class: 'ln' + (unsafeWrite ? ' pz' : '') },
          `    process(request); // thực thi lúc t = ${tProcess}s ${unsafeWrite ? '→ 💥 GHI TRÁI PHÉP KHI ĐÃ MẤT LEASE!' : '→ An toàn'}`),
        h('span', { class: 'ln' }, '}')
      );

      clear(stats).append(
        stat('Thời điểm thực thi process(request)', `t = ${tProcess}s (Hết hạn @ 30s)`, leaseExpiredAtProcess ? 'bad' : 'ok'),
        stat('Tình trạng an toàn của Lease', unsafeWrite ? 'VI PHẠM (2 Leader cùng ghi!)' : 'An toàn', unsafeWrite ? 'bad' : 'ok',
          unsafeWrite ? 'Thread không biết mình vừa ngủ quên tới khi hết hạn lease!' : 'Chưa quá hạn lúc ghi')
      );
    }
    render();
  });

  // =====================================================================
  // 9.12b GC-aware Load Balancing
  widget('gc-aware', (root) => {
    let aware = false;
    const sg = seg({
      label: 'Chiến lược định tuyến của Load Balancer (4 Node)',
      options: [
        { value: false, label: 'Mù GC (Gửi đều vào cả node đang GC pause)' },
        { value: true, label: 'Biết trước GC (Rút lưu lượng trước khi node chạy GC)' },
      ],
      value: aware,
      onChange: (v) => { aware = v; render(); },
    });

    const viz = h('div', { class: 'viz' });
    const stats = h('div', { class: 'stats' });
    root.append(h('div', { class: 'controls' }, ctl('Chế độ Load Balancer', sg.el)), viz, stats);

    function render() {
      const W = 580, H = 155;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': '4 node và chu kỳ GC' });

      [0, 1, 2, 3].forEach((i) => {
        const y = 26 + i * 32;
        const gcStart = 180 + i * 95;
        svg.append(
          s('text', { x: 10, y: y + 12, class: 'lbl-strong' }, `Node ${i + 1}`),
          s('rect', { x: 80, y, width: 480, height: 18, rx: 4, class: 'f-ok' }),
          s('rect', { x: gcStart, y, width: 70, height: 18, rx: 4, class: aware ? 'f-warn' : 'f-bad' }),
          s('text', { x: gcStart + 35, y: y + 13, 'text-anchor': 'middle', class: 'lbl-strong f-surface' }, aware ? 'GC (né)' : 'GC kẹt!')
        );
      });
      clear(viz).append(svg);

      clear(stats).append(
        stat('Độ trễ trung vị (p50)', '4 ms', 'ok'),
        stat('Độ trễ đuôi (p99.9)', aware ? '11 ms' : '420 ms', aware ? 'ok' : 'bad', aware ? 'Không request nào phải chờ GC' : 'Request trúng lúc GC phải đợi cả trăm ms')
      );
    }
    render();
  });

  // =====================================================================
  // 9.13 The Truth Is Defined by the Majority (Network Partition + Quorum)
  widget('majority', (root) => {
    let n = 5, cutAfter = 2;
    const dead = new Set();
    const sgN = seg({
      label: 'Tổng số node trong cụm (n)',
      options: [{ value: 3, label: '3 node' }, { value: 5, label: '5 node' }, { value: 7, label: '7 node' }],
      value: n,
      onChange: (v) => { n = +v; cutAfter = Math.floor(n / 2); dead.clear(); render(); },
    });
    const slCut = slider({ label: 'Vị trí vết cắt mạng (Số node ở phía Trái)', min: 1, max: 6, step: 1, value: cutAfter, onInput: (v) => { cutAfter = clamp(v, 1, n - 1); render(); } });

    const viz = h('div', { class: 'viz' });
    const stats = h('div', { class: 'stats' });
    root.append(h('div', { class: 'controls' }, ctl('Cỡ cụm', sgN.el), slCut.el), viz, stats);

    function render() {
      cutAfter = clamp(cutAfter, 1, n - 1);
      slCut.set(cutAfter);
      const maj = Math.floor(n / 2) + 1;

      const W = 600, H = 140;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Hai phía của vết cắt mạng' });
      const stepX = (W - 40) / n;

      let leftAlive = 0, rightAlive = 0;
      for (let i = 0; i < n; i++) {
        const isDown = dead.has(i);
        if (!isDown) { if (i < cutAfter) leftAlive++; else rightAlive++; }
        const cx = 20 + stepX * (i + 0.5);
        const g = s('g', { class: 'clickable', onClick: () => { isDown ? dead.delete(i) : dead.add(i); render(); } },
          s('circle', { cx, cy: 65, r: 24, class: isDown ? 'f-bad-soft s-bad dash' : i < cutAfter ? 'f-accent-soft s-accent' : 'f-violet-soft s-violet', 'stroke-width': 2 }),
          s('text', { x: cx, y: 69, 'text-anchor': 'middle', class: 'lbl-strong' }, `N${i + 1}`)
        );
        svg.append(g);
      }

      const cutX = 20 + stepX * cutAfter;
      svg.append(
        s('line', { x1: cutX, x2: cutX, y1: 14, y2: 118, class: 'f-none s-bad dash', 'stroke-width': 3 }),
        s('text', { x: cutX, y: 128, 'text-anchor': 'middle', class: 'f-bad lbl-strong' }, '✂ Vết cắt mạng (Bấm vào node để tắt/bật)')
      );
      clear(viz).append(svg);

      const leftHasMaj = leftAlive >= maj;
      const rightHasMaj = rightAlive >= maj;

      clear(stats).append(
        stat('Đa số tối thiểu (Quorum)', `${maj} / ${n} node`, 'accent'),
        stat('Phía Trái (chứa Leader cũ N1)', `${leftAlive} node sống → ${leftHasMaj ? 'ĐỦ ĐA SỐ' : 'MẤT QUYỀN LEADER!'}`, leftHasMaj ? 'ok' : 'bad'),
        stat('Phía Phải', `${rightAlive} node sống → ${rightHasMaj ? 'ĐỦ ĐA SỐ (Bầu Leader mới)' : 'Không đủ đa số'}`, rightHasMaj ? 'ok' : 'warn')
      );
    }
    render();
  });

  // =====================================================================
  // 9.14 Leader, Lock, and Fencing Tokens (Figures 8-4 & 8-5)
  widget('fencing', (root) => {
    let useFencing = false, step = 4;
    const sg = seg({
      label: 'Cơ chế bảo vệ tại dịch vụ Lưu trữ (Storage)',
      options: [
        { value: false, label: 'Không có Fencing Token (Hình 8-4 · Hỏng dữ liệu!)' },
        { value: true, label: 'Có Fencing Token tăng đơn điệu (Hình 8-5 · An toàn)' },
      ],
      value: useFencing,
      onChange: (v) => { useFencing = v; render(); },
    });
    const btnPrev = button('← Bước trước', () => { step = Math.max(0, step - 1); render(); }, 'ghost');
    const btnNext = button('Bước tiếp →', () => { step = Math.min(4, step + 1); render(); });
    const btnAll = button('Chạy tới bước cuối', () => { step = 4; render(); }, 'ghost');

    const viz = h('div', { class: 'viz' });
    const descEl = h('div', { class: 'step-desc' });
    const stats = h('div', { class: 'stats' });

    root.append(h('div', { class: 'controls' }, ctl('Chế độ', sg.el), h('div', { class: 'btn-row' }, btnPrev, btnNext, btnAll)), viz, descEl, stats);

    const STEPS = [
      'Bước 1/5: Client 1 xin được Lease từ dịch vụ khoá (kèm Fencing Token = 33).',
      'Bước 2/5: Client 1 bước vào một cú GC pause rất dài; trong lúc đó Lease của Client 1 hết hạn!',
      'Bước 3/5: Client 2 xin Lease mới (nhận Fencing Token = 34) và gửi lệnh ghi kèm token 34 tới Storage.',
      'Bước 4/5: Storage chấp nhận ghi của Client 2 (và ghi nhớ token lớn nhất đã thấy = 34).',
      'Bước 5/5: Client 1 tỉnh dậy sau GC pause và gửi lệnh ghi trễ (mang token = 33) tới Storage!',
    ];

    function render() {
      btnPrev.disabled = step === 0;
      btnNext.disabled = step === 4;

      const W = 600, H = 175;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Biểu đồ thời gian Hình 8-4 và 8-5' });

      svg.append(
        s('text', { x: 10, y: 40, class: 'lbl-strong' }, 'Client 1 (token 33)'),
        s('text', { x: 10, y: 90, class: 'lbl-strong' }, 'Client 2 (token 34)'),
        s('text', { x: 10, y: 145, class: 'lbl-strong' }, 'Storage Server'),
        s('line', { x1: 135, x2: 580, y1: 36, y2: 36, class: 'grid' }),
        s('line', { x1: 135, x2: 580, y1: 86, y2: 86, class: 'grid' }),
        s('line', { x1: 135, x2: 580, y1: 141, y2: 141, class: 'grid' })
      );

      if (step >= 0) {
        svg.append(s('rect', { x: 145, y: 24, width: 90, height: 22, rx: 4, class: 'f-accent-soft s-accent' }), s('text', { x: 190, y: 39, 'text-anchor': 'middle' }, 'Giữ lease #33'));
      }
      if (step >= 1) {
        svg.append(s('rect', { x: 235, y: 24, width: 220, height: 22, rx: 4, class: 'f-warn s-warn dash' }), s('text', { x: 345, y: 39, 'text-anchor': 'middle', class: 'lbl-strong' }, '⏸ GC Pause (Lease hết hạn!)'));
      }
      if (step >= 2) {
        svg.append(
          s('rect', { x: 290, y: 74, width: 120, height: 22, rx: 4, class: 'f-violet-soft s-violet' }),
          s('text', { x: 350, y: 89, 'text-anchor': 'middle' }, 'Giữ lease #34')
        );
      }
      if (step >= 3) {
        svg.append(
          s('line', { x1: 350, y1: 96, x2: 380, y2: 141, class: 'f-none s-ok', 'stroke-width': 2.2 }),
          s('circle', { cx: 380, cy: 141, r: 5, class: 'f-ok' }),
          s('text', { x: 380, y: 162, 'text-anchor': 'middle', class: 'lbl-strong' }, 'Ghi OK (t=34)')
        );
      }
      if (step >= 4) {
        svg.append(
          s('line', { x1: 465, y1: 46, x2: 500, y2: 141, class: useFencing ? 'f-none s-bad dash' : 'f-none s-bad', 'stroke-width': 2.5 }),
          s('circle', { cx: 500, cy: 141, r: 6, class: 'f-bad' }),
          s('text', { x: 500, y: 162, 'text-anchor': 'middle', class: 'f-bad lbl-strong' }, useFencing ? '✗ TỪ CHỐI (33 < 34)' : '💥 GHI ĐÈ HỎNG FILE!')
        );
      }

      clear(viz).append(svg);
      descEl.innerHTML = `<b>${STEPS[step]}</b> ` + (step === 4
        ? (useFencing ? 'Nhờ kiểm tra Fencing Token, Storage thấy <code>33 &lt; 34</code> nên từ chối ngay lệnh ghi bóng ma của Client 1.' : 'Không có Fencing Token, Storage chấp nhận luôn lệnh ghi muộn của Client 1 và ghi đè làm hỏng dữ liệu của Client 2!')
        : '');

      clear(stats).append(
        stat('Token lớn nhất Storage đã nhận', step >= 3 ? '34 (từ Client 2)' : '33', 'accent'),
        stat('Số phận lệnh ghi muộn của Client 1', step < 4 ? 'Chưa gửi' : useFencing ? 'Bị Storage từ chối an toàn' : 'Ghi đè làm hỏng file!', step < 4 ? 'warn' : useFencing ? 'ok' : 'bad')
      );
    }
    render();
  });

  // =====================================================================
  // 9.15 Byzantine Faults (n >= 3f + 1) & Multi-Server NTP Outlier Filter
  widget('byzantine', (root) => {
    let totalNodes = 7, traitors = 2, badNtpCount = 1;
    const slN = slider({ label: 'Tổng số vị tướng / node (n)', min: 4, max: 13, step: 1, value: totalNodes, onInput: (v) => { totalNodes = v; traitors = clamp(traitors, 0, totalNodes); render(); } });
    const slF = slider({ label: 'Số kẻ phản bội / node nói dối (f)', min: 0, max: 6, step: 1, value: traitors, onInput: (v) => { traitors = clamp(v, 0, totalNodes); render(); } });
    const sgNtp = seg({
      label: 'Số server NTP báo giờ sai (lệch +3 giờ) trong 5 server',
      options: [
        { value: 0, label: '0 sai' },
        { value: 1, label: '1 sai (Lọc được)' },
        { value: 2, label: '2 sai (Lọc được)' },
        { value: 3, label: '3 sai (Đa số nói dối!)' },
      ],
      value: badNtpCount,
      onChange: (v) => { badNtpCount = +v; render(); },
    });

    const split = h('div', { class: 'lab-split' });
    const stats = h('div', { class: 'stats' });
    root.append(h('div', { class: 'controls' }, slN.el, slF.el, ctl('Thử nghiệm NTP (5 server)', sgNtp.el)), split, stats);

    function render() {
      slF.set(traitors);
      const minRequired = 3 * traitors + 1;
      const bftSafe = totalNodes >= minRequired;

      const ntpServers = [0, 1, 2, 3, 4].map((i) => ({
        name: `NTP Server ${i + 1}`,
        bad: i < badNtpCount,
        val: i < badNtpCount ? '15:00:00 (+3h!)' : '12:00:00 (Chuẩn)',
      }));

      clear(split).append(
        h('div', { class: 'box' },
          h('h5', `Bài toán Tướng Byzantine: cần n ≥ 3f + 1`),
          h('p', `Hiện có ${totalNodes} node, trong đó ${traitors} node có thể cố tình gửi tin nhắn giả mạo. Cần tối thiểu ${minRequired} node để đạt đồng thuận BFT.`),
          h('p', bftSafe ? pill('✓ Đạt siêu đa số (> 2/3 trung thực)', 'ok') : pill('✗ Không thể phân biệt thật/giả (n < 3f + 1)', 'bad'))
        ),
        h('div', { class: 'box' },
          h('h5', 'Client hỏi 5 Server NTP'),
          h('div', { class: 'chips' }, ntpServers.map((s0) => h('span', { class: 'chip ' + (s0.bad ? 'bad' : 'ok') }, `${s0.name}: ${s0.val}`)))
        )
      );

      clear(stats).append(
        stat('Điều kiện BFT (n ≥ 3f + 1)', `${totalNodes} ${bftSafe ? '≥' : '<'} ${minRequired}`, bftSafe ? 'ok' : 'bad'),
        stat('Kết quả lọc ngoại lai của NTP Client', badNtpCount <= 2 ? 'Loại bỏ server sai, lấy 12:00:00' : 'BỊ ĐÁNH LỪA sang 15:00:00!', badNtpCount <= 2 ? 'ok' : 'bad')
      );
    }
    render();
  });

  // =====================================================================
  // 9.16a System Models (Timing & Node Failure Assumptions)
  widget('system-models', (root) => {
    let timing = 'partial', fault = 'recovery';
    const sgTime = seg({
      label: 'Mô hình thời gian (Timing Model)',
      options: [
        { value: 'sync', label: 'Đồng bộ (Synchronous)' },
        { value: 'partial', label: 'Bán đồng bộ (Partially sync · Thực tế)' },
        { value: 'async', label: 'Bất đồng bộ (Asynchronous)' },
      ],
      value: timing,
      onChange: (v) => { timing = v; render(); },
    });
    const sgFault = seg({
      label: 'Mô hình lỗi node (Node Fault Model)',
      options: [
        { value: 'stop', label: 'Crash-stop' },
        { value: 'recovery', label: 'Crash-recovery (Thực tế)' },
        { value: 'byz', label: 'Byzantine' },
      ],
      value: fault,
      onChange: (v) => { fault = v; render(); },
    });

    const rowsEl = h('div', { class: 'model-rows' });
    const stats = h('div', { class: 'stats' });
    root.append(h('div', { class: 'controls' }, ctl('Mô hình thời gian', sgTime.el), ctl('Mô hình lỗi node', sgFault.el)), rowsEl, stats);

    function render() {
      const checks = [
        {
          phenom: 'Gói tin trễ vọt lên 10 giây do nghẽn hàng đợi switch hoặc GC pause',
          allowed: timing !== 'sync',
          why: timing === 'sync' ? 'Phá vỡ giả định Synchronous (luôn có chặn trên cố định)!' : 'Mô hình cho phép độ trễ đôi khi vượt ngưỡng.',
        },
        {
          phenom: 'Thuật toán cần dùng Timeout để bầu Leader mới',
          allowed: timing !== 'async',
          why: timing === 'async' ? 'Mô hình Asynchronous thuần tuý không có khái niệm đồng hồ hay timeout!' : 'Hỗ trợ dùng đồng hồ / timeout.',
        },
        {
          phenom: 'Node bị mất điện, khởi động lại từ đĩa và tham gia lại cụm',
          allowed: fault !== 'stop',
          why: fault === 'stop' ? 'Phá vỡ giả định Crash-stop (node đã chết là chết vĩnh viễn)!' : 'Mô hình cho phép node sống lại và đọc trạng thái bền.',
        },
        {
          phenom: 'Node gửi thông điệp giả mạo hoặc bị lật bit không phát hiện',
          allowed: fault === 'byz',
          why: fault === 'byz' ? 'Được bao phủ bởi mô hình Byzantine.' : 'Giả định node trung thực (cần checksum để bắt lỗi lật bit).',
        },
      ];

      clear(rowsEl);
      checks.forEach((c) => {
        rowsEl.append(
          h('div', { class: 'model-row' + (c.allowed ? '' : ' broken') },
            h('span', h('b', c.phenom), h('br'), h('small', c.why)),
            pill(c.allowed ? 'Mô hình xử lý được' : 'Thực tế phá vỡ giả định!', c.allowed ? 'ok' : 'bad')
          )
        );
      });

      const isRecommended = timing === 'partial' && fault === 'recovery';
      clear(stats).append(
        stat('Tổ hợp đang chọn', `${timing.toUpperCase()} + ${fault.toUpperCase()}`, isRecommended ? 'ok' : 'accent'),
        stat('Đánh giá thực tiễn', isRecommended ? 'Mô hình chuẩn cho hầu hết hệ phân tán thực tế' : timing === 'sync' ? 'Quá lạc quan (dễ hỏng khi GC/nghẽn mạng)' : 'Hữu ích cho lý thuyết / chuyên biệt', isRecommended ? 'ok' : 'warn')
      );
    }
    render();
  });

  // =====================================================================
  // 9.16b Safety vs Liveness Interactive Classifier
  widget('safety-liveness', (root) => {
    const PROPS = [
      {
        text: '1. Uniqueness: Không bao giờ có hai request nhận được cùng một giá trị Fencing Token.',
        ans: 'safety',
        why: 'Safety: “Điều xấu không xảy ra”. Nếu hai client nhận trùng token, ta chỉ ra được ngay thời điểm vi phạm.',
      },
      {
        text: '2. Availability: Mọi node gửi request và không crash thì CUỐI CÙNG sẽ nhận được phản hồi.',
        ans: 'liveness',
        why: 'Liveness: “Điều tốt cuối cùng sẽ xảy ra”. Chưa nhận được phản hồi lúc này không có nghĩa là đã vi phạm vĩnh viễn.',
      },
      {
        text: '3. Monotonic sequence: Nếu thao tác X hoàn tất trước khi Y bắt đầu, token của X luôn nhỏ hơn của Y.',
        ans: 'safety',
        why: 'Safety: Thứ tự sai là vi phạm tức khắc và không thể sửa lại bằng cách chờ thêm.',
      },
      {
        text: '4. Eventual Consistency: Khi ngừng ghi, CUỐI CÙNG mọi bản sao sẽ hội tụ về cùng một giá trị.',
        ans: 'liveness',
        why: 'Liveness: Dấu hiệu nhận biết là chữ “cuối cùng” (eventually) — luôn còn hy vọng thoả mãn trong tương lai.',
      },
      {
        text: '5. No Split-Brain: Tại mọi thời điểm, mỗi phân vùng có tối đa một Leader được đa số công nhận.',
        ans: 'safety',
        why: 'Safety: Chỉ cần xuất hiện hai Leader ở một khoảnh khắc là thuộc tính bị phá vỡ ngay.',
      },
    ];

    const picks = { 0: 'safety', 1: 'liveness' }; // first two pre-solved as stated in caption
    const grid = h('div', { class: 'prop-grid' });
    const stats = h('div', { class: 'stats' });
    root.append(grid, stats);

    function render() {
      clear(grid);
      let correct = 0, answered = 0;

      PROPS.forEach((p, i) => {
        const cur = picks[i];
        if (cur) { answered++; if (cur === p.ans) correct++; }
        const cls = !cur ? 'prop' : cur === p.ans ? 'prop right' : 'prop wrong';
        grid.append(
          h('div', { class: cls },
            h('p', h('b', p.text)),
            h('div', { class: 'btn-row' },
              button('Safety (An toàn)', () => { picks[i] = 'safety'; render(); }, cur === 'safety' ? '' : 'ghost'),
              button('Liveness (Sống động)', () => { picks[i] = 'liveness'; render(); }, cur === 'liveness' ? '' : 'ghost')
            ),
            cur ? h('div', { class: 'why' }, (cur === p.ans ? '✓ Đúng: ' : '✗ Chưa đúng: ') + p.why) : null
          )
        );
      });

      clear(stats).append(
        stat('Đã phân loại đúng', `${correct} / ${PROPS.length} thuộc tính`, correct === PROPS.length ? 'ok' : 'accent'),
        stat('Mẹo nhận diện nhanh', 'Safety = Không bao giờ sai · Liveness = Cuối cùng sẽ xong', 'accent')
      );
    }
    render();
  });

  // =====================================================================
  // Glossary terms for Chapter 9
  glossary.add([
    { key: 'partial-failure', term: 'Partial failure', vi: 'lỗi cục bộ (hỏng một phần)', ch: 9, topic: 'ch9-partial-failures',
      def: 'Hiện tượng trong hệ phân tán khi một số thành phần (node, đường mạng) bị lỗi theo cách bất định trong khi các thành phần khác vẫn chạy.' },
    { key: 'hpc', term: 'High-performance computing (HPC)', vi: 'tính toán hiệu năng cao (siêu máy tính)', ch: 9, topic: 'ch9-partial-failures',
      def: 'Kiến trúc siêu máy tính thường xử lý lỗi cục bộ bằng cách dừng toàn bộ cụm và chạy lại từ bản checkpoint gần nhất.' },
    { key: 'cloud-computing', term: 'Cloud computing', vi: 'điện toán đám mây', ch: 9, topic: 'ch9-partial-failures',
      def: 'Các dịch vụ trực tuyến chạy trên hàng nghìn máy phổ thông nối mạng IP, buộc phải chịu lỗi cục bộ ngay trong phần mềm mà không được dừng toàn hệ thống.' },
    { key: 'shared-nothing', term: 'Shared-nothing architecture', vi: 'kiến trúc không dùng chung', ch: 9, topic: 'ch9-unreliable-networks',
      def: 'Kiến trúc trong đó mỗi node có CPU, RAM, đĩa riêng và chỉ có thể phối hợp với nhau bằng cách gửi gói tin qua mạng.' },
    { key: 'async-packet-network', term: 'Asynchronous packet network', vi: 'mạng chuyển mạch gói bất đồng bộ', ch: 9, topic: 'ch9-unreliable-networks',
      def: 'Mạng (như Ethernet/IP) không bảo đảm gói tin sẽ tới đích trong một khoảng thời gian xác định hay thậm chí có tới đích hay không.' },
    { key: 'timeout', term: 'Timeout', vi: 'hết thời gian chờ', ch: 9, topic: 'ch9-unreliable-networks',
      def: 'Khoảng thời gian bên gửi chờ đợi trước khi bỏ cuộc và coi như request không nhận được phản hồi; nhưng không cho biết đích đã xử lý request hay chưa.' },
    { key: 'network-partition', term: 'Network partition (netsplit)', vi: 'phân vùng mạng (chia cắt mạng)', ch: 9, topic: 'ch9-network-faults',
      def: 'Sự cố khi một nhóm các node bị cắt đứt kết nối mạng với phần còn lại của cụm dù bản thân các node vẫn sống.' },
    { key: 'network-fault', term: 'Network fault', vi: 'lỗi mạng', ch: 9, topic: 'ch9-network-faults',
      def: 'Thuật ngữ chung trong sách cho mọi sự cố đứt cáp, hỏng switch, sai cấu hình định tuyến hoặc rớt gói một chiều trên mạng.' },
    { key: 'cascading-failure', term: 'Cascading failure', vi: 'lỗi dây chuyền', ch: 9, topic: 'ch9-timeouts',
      def: 'Hiệu ứng domino khi việc tuyên bố nhầm một node bận là đã chết làm tải của nó dồn sang các node khác, khiến các node đó cũng quá tải và sập theo.' },
    { key: 'unbounded-delay', term: 'Unbounded delay', vi: 'độ trễ không có chặn trên', ch: 9, topic: 'ch9-timeouts',
      def: 'Đặc tính của mạng gói bất đồng bộ: không có bất kỳ hằng số thời gian tối đa nào bảo đảm mọi gói tin hợp lệ phải đến đích trước mốc đó.' },
    { key: 'jitter', term: 'Jitter', vi: 'độ dao động độ trễ', ch: 9, topic: 'ch9-timeouts',
      def: 'Mức độ biến thiên của thời gian phản hồi mạng (RTT) quanh giá trị trung bình do hàng đợi thay đổi.' },
    { key: 'phi-accrual', term: 'Phi Accrual failure detector', vi: 'bộ phát hiện lỗi tích luỹ Phi', ch: 9, topic: 'ch9-timeouts',
      def: 'Thuật toán phát hiện lỗi (dùng trong Akka, Cassandra) liên tục đo phân bố RTT và jitter thực tế để tính xác suất node chết thay vì dùng một ngưỡng timeout cứng.' },
    { key: 'network-congestion', term: 'Network congestion & queueing', vi: 'nghẽn mạng và xếp hàng', ch: 9, topic: 'ch9-congestion',
      def: 'Hiện tượng nhiều luồng dữ liệu cùng đổ vào một cổng switch hoặc card mạng làm gói tin phải nằm chờ trong bộ đệm hoặc bị đánh rơi khi bộ đệm đầy.' },
    { key: 'tcp-flow-control', term: 'TCP flow control & congestion control', vi: 'điều khiển luồng và chống nghẽn của TCP', ch: 9, topic: 'ch9-congestion',
      def: 'Cơ chế TCP tự động hạn chế tốc độ gửi ngay tại máy gửi khi phát hiện mạng nghẽn hoặc máy nhận đọc không kịp, tạo thêm hàng đợi ở phía gửi.' },
    { key: 'noisy-neighbor', term: 'Noisy neighbor', vi: 'hàng xóm ồn ào (chiếm tài nguyên)', ch: 9, topic: 'ch9-congestion',
      def: 'Một máy ảo hoặc khách thuê khác trên cùng phần cứng cloud tiêu thụ đột biến băng thông mạng, CPU hoặc I/O đĩa làm tăng độ trễ của bạn.' },
    { key: 'circuit-switching', term: 'Circuit switching', vi: 'chuyển mạch kênh', ch: 9, topic: 'ch9-sync-async',
      def: 'Cách hoạt động của mạng điện thoại truyền thống (ISDN): dành riêng một lượng băng thông cố định dọc theo toàn tuyến cho mỗi cuộc gọi, không có hàng đợi.' },
    { key: 'bounded-delay', term: 'Bounded delay', vi: 'độ trễ có giới hạn trên', ch: 9, topic: 'ch9-sync-async',
      def: 'Bảo đảm rằng gói dữ liệu luôn đi từ nguồn tới đích trong một khoảng thời gian tối đa cố định (đạt được nhờ cấp phát tài nguyên tĩnh như chuyển mạch kênh).' },
    { key: 'packet-switching', term: 'Packet switching', vi: 'chuyển mạch gói', ch: 9, topic: 'ch9-sync-async',
      def: 'Chia dữ liệu thành các gói độc lập dùng chung đường truyền theo nhu cầu tức thời; tận dụng băng thông cực tốt cho lưu lượng bùng nổ nhưng chịu độ trễ hàng đợi.' },
    { key: 'time-of-day-clock', term: 'Time-of-day clock', vi: 'đồng hồ thời gian thực (wall-clock)', ch: 9, topic: 'ch9-clocks',
      def: 'Đồng hồ trả về ngày giờ theo lịch (ví dụ CLOCK_REALTIME, currentTimeMillis), được đồng bộ qua NTP nên có thể bị nhảy lùi hoặc nhảy tới.' },
    { key: 'ntp', term: 'Network Time Protocol (NTP)', vi: 'giao thức đồng bộ thời gian mạng', ch: 9, topic: 'ch9-clocks',
      def: 'Giao thức chuẩn để máy tính điều chỉnh đồng hồ cục bộ theo các máy chủ thời gian qua mạng.' },
    { key: 'monotonic-clock', term: 'Monotonic clock', vi: 'đồng hồ đơn điệu', ch: 9, topic: 'ch9-clocks',
      def: 'Bộ đếm thời gian luôn tiến về phía trước (CLOCK_MONOTONIC, System.nanoTime), dùng để đo khoảng thời gian trôi qua trên cùng một máy mà không sợ NTP nhảy lùi.' },
    { key: 'clock-slewing', term: 'Clock slewing', vi: 'điều chỉnh nhịp đồng hồ từ từ', ch: 9, topic: 'ch9-clocks',
      def: 'Cách NTP làm đồng hồ chạy nhanh hơn hoặc chậm hơn một chút (tối đa 0,05%) để bắt kịp giờ chuẩn mà không gây cú nhảy đột ngột.' },
    { key: 'clock-drift', term: 'Clock drift', vi: 'độ trôi đồng hồ', ch: 9, topic: 'ch9-clock-sync',
      def: 'Sự kiện tinh thể thạch anh chạy nhanh hoặc chậm hơn thời gian chuẩn theo nhiệt độ (thường khoảng vài chục đến 200 phần triệu — ppm).' },
    { key: 'leap-second', term: 'Leap second', vi: 'giây nhuận', ch: 9, topic: 'ch9-clock-sync',
      def: 'Một giây được chèn thêm (hoặc bớt đi) vào giờ UTC để khớp với chu kỳ quay của Trái Đất, tạo ra phút có 61 giây từng làm sập nhiều hệ thống.' },
    { key: 'ptp', term: 'Precision Time Protocol (PTP)', vi: 'giao thức đồng bộ thời gian chính xác cao', ch: 9, topic: 'ch9-clock-sync',
      def: 'Giao thức đồng bộ đồng hồ có hỗ trợ phần cứng mạng chuyên dụng để đạt độ chính xác cỡ micro giây trong datacenter.' },
    { key: 'leap-smearing', term: 'Leap smearing', vi: 'trải đều giây nhuận', ch: 9, topic: 'ch9-clock-sync',
      def: 'Kỹ thuật rải đều 1 giây nhuận thành sự thay đổi tốc độ cực nhỏ suốt 24 giờ để phần mềm không bao giờ phải đối mặt với giây thứ 60.' },
    { key: 'lww', term: 'Last write wins (LWW)', vi: 'ghi cuối cùng thắng', ch: 9, topic: 'ch9-lww',
      def: 'Phân xử xung đột bằng cách giữ bản ghi có timestamp đồng hồ lớn nhất; chỉ vài mili giây lệch đồng hồ cũng làm mất bản ghi xảy ra sau về mặt nhân quả.' },
    { key: 'logical-clock', term: 'Logical clock', vi: 'đồng hồ logic', ch: 9, topic: 'ch9-lww',
      def: 'Đồng hồ dựa trên các bộ đếm tăng dần (như đồng hồ Lamport và Version Vector) đo thứ tự nhân quả giữa các sự kiện thay vì đo thời gian vật lý.' },
    { key: 'physical-clock', term: 'Physical clock', vi: 'đồng hồ vật lý', ch: 9, topic: 'ch9-lww',
      def: 'Đồng hồ đếm thời gian thực tế trôi qua dựa trên dao động phần cứng (bao gồm cả time-of-day clock và monotonic clock).' },
    { key: 'clock-confidence', term: 'Clock confidence interval', vi: 'khoảng tin cậy của đồng hồ', ch: 9, topic: 'ch9-truetime',
      def: 'Khoảng thời gian [earliest, latest] mà thời gian thực sự chắc chắn nằm trong đó với xác suất cao, thay vì một con số điểm đơn lẻ.' },
    { key: 'truetime', term: 'TrueTime API (Google Spanner)', vi: 'API thời gian có khoảng sai số TrueTime', ch: 9, topic: 'ch9-truetime',
      def: 'Hệ thống đồng hồ dùng GPS và đồng hồ nguyên tử của Google Spanner, trả về rõ khoảng sai số [earliest, latest] (thường rộng khoảng 7 ms).' },
    { key: 'commit-wait', term: 'Commit wait', vi: 'chờ hết khoảng sai số trước khi commit', ch: 9, topic: 'ch9-truetime',
      def: 'Quy tắc của Spanner buộc giao dịch ghi phải chờ qua hết độ rộng khoảng sai số 2ε trước khi hoàn tất commit, đảm bảo giao dịch sau luôn có khoảng thời gian lớn hơn hẳn.' },
    { key: 'lease', term: 'Lease', vi: 'khoá có thời hạn (lease)', ch: 9, topic: 'ch9-process-pauses',
      def: 'Quyền làm leader hoặc quyền giữ khoá chỉ có hiệu lực trong một khoảng thời gian xác định và phải được gia hạn định kỳ trước khi hết hạn.' },
    { key: 'stop-the-world', term: 'Stop-the-world GC pause', vi: 'tạm dừng toàn bộ ứng dụng để dọn rác', ch: 9, topic: 'ch9-process-pauses',
      def: 'Khoảng thời gian bộ thu gom rác (Garbage Collector) của JVM/runtime tạm dừng mọi luồng thực thi ứng dụng, đôi khi kéo dài hàng chục giây.' },
    { key: 'steal-time', term: 'CPU steal time', vi: 'thời gian CPU bị hypervisor lấy cho máy ảo khác', ch: 9, topic: 'ch9-process-pauses',
      def: 'Khoảng thời gian một máy ảo sẵn sàng chạy nhưng phải đứng chờ vì bộ lập lịch hypervisor đang nhường lõi CPU vật lý cho máy ảo hàng xóm.' },
    { key: 'thrashing', term: 'Thrashing (page fault storm)', vi: 'nghẽn tráo trang bộ nhớ (swap)', ch: 9, topic: 'ch9-process-pauses',
      def: 'Tình trạng máy cạn RAM khiến hệ điều hành dành toàn bộ thời gian đọc/ghi trang nhớ giữa RAM và đĩa, làm tiến trình gần như đứng hình.' },
    { key: 'hard-real-time', term: 'Hard real-time system', vi: 'hệ thống thời gian thực cứng', ch: 9, topic: 'ch9-process-pauses',
      def: 'Hệ thống nhúng (hàng không, túi khí ô tô) sử dụng RTOS để cam kết toán học rằng mọi tác vụ luôn hoàn thành trước hạn chót (deadline) xác định.' },
    { key: 'quorum', term: 'Quorum (majority vote)', vi: 'túc số (biểu quyết đa số)', ch: 9, topic: 'ch9-majority',
      def: 'Số phiếu đồng thuận tối thiểu (thường là quá bán: hơn một nửa số node) để một quyết định trong hệ phân tán được công nhận là sự thật.' },
    { key: 'split-brain', term: 'Split brain', vi: 'não chẻ đôi (hai leader xung đột)', ch: 9, topic: 'ch9-fencing',
      def: 'Lỗi khi hai node cùng hành xử như thể mình là leader duy nhất và ghi đè lên tài nguyên dùng chung.' },
    { key: 'fencing-token', term: 'Fencing token', vi: 'mã chặn thứ tự tăng dần', ch: 9, topic: 'ch9-fencing',
      def: 'Con số tăng đơn điệu được cấp kèm mỗi lần lấy khoá/lease; dịch vụ lưu trữ kiểm tra và từ chối mọi thao tác mang token nhỏ hơn token lớn nhất từng thấy.' },
    { key: 'byzantine-fault', term: 'Byzantine fault', vi: 'lỗi Byzantine (node nói dối / làm phản)', ch: 9, topic: 'ch9-byzantine',
      def: 'Loại lỗi tổng quát và khó nhất khi một node không chỉ crash hay chậm mà còn gửi các thông điệp sai lệch, mâu thuẫn hoặc giả mạo.' },
    { key: 'byzantine-generals', term: 'Byzantine Generals Problem', vi: 'bài toán các vị tướng Byzantine', ch: 9, topic: 'ch9-byzantine',
      def: 'Bài toán lý thuyết về việc các vị tướng đạt được kế hoạch thống nhất qua tin nhắn khi trong hàng ngũ có những kẻ phản bội cố tình tung tin giả.' },
    { key: 'bft', term: 'Byzantine fault tolerance (BFT)', vi: 'khả năng chịu lỗi Byzantine', ch: 9, topic: 'ch9-byzantine',
      def: 'Hệ thống vẫn đạt đồng thuận đúng ngay cả khi có tối đa f node gian lận hoặc hỏng tuỳ ý, đòi hỏi tổng số node n ≥ 3f + 1.' },
    { key: 'system-model', term: 'System model', vi: 'mô hình hệ thống', ch: 9, topic: 'ch9-system-models',
      def: 'Tập hợp các giả định được định nghĩa rõ ràng về hành vi thời gian của mạng và các loại lỗi node mà một thuật toán phân tán được thiết kế để chịu đựng.' },
    { key: 'partial-synchrony', term: 'Partially synchronous model', vi: 'mô hình bán đồng bộ', ch: 9, topic: 'ch9-system-models',
      def: 'Mô hình giả định hệ thống cư xử đồng bộ (có giới hạn độ trễ) trong phần lớn thời gian, nhưng thỉnh thoảng có những giai đoạn bất đồng bộ với độ trễ không giới hạn.' },
    { key: 'crash-stop', term: 'Crash-stop (fail-stop) model', vi: 'mô hình lỗi dừng hẳn', ch: 9, topic: 'ch9-system-models',
      def: 'Mô hình giả định một node chỉ có thể hỏng bằng cách ngừng hoạt động vĩnh viễn và không bao giờ quay trở lại.' },
    { key: 'crash-recovery', term: 'Crash-recovery model', vi: 'mô hình lỗi có khởi động lại', ch: 9, topic: 'ch9-system-models',
      def: 'Mô hình giả định node có thể crash bất kỳ lúc nào rồi khởi động lại sau đó: bộ nhớ RAM bị mất nhưng dữ liệu trên đĩa bền vững vẫn còn.' },
    { key: 'safety', term: 'Safety property', vi: 'thuộc tính an toàn (Safety)', ch: 9, topic: 'ch9-system-models',
      def: 'Thuộc tính dạng “điều xấu không bao giờ xảy ra” (ví dụ không cấp trùng fencing token); nếu bị vi phạm, ta chỉ ra được đúng thời điểm xảy ra lỗi.' },
    { key: 'liveness', term: 'Liveness property', vi: 'thuộc tính sống động (Liveness)', ch: 9, topic: 'ch9-system-models',
      def: 'Thuộc tính dạng “điều tốt cuối cùng sẽ xảy ra” (ví dụ cuối cùng client sẽ nhận được câu trả lời khi mạng hồi phục).' },
    { key: 'limping-node', term: 'Limping node (gray failure)', vi: 'node khập khiễng (hỏng nửa vời)', ch: 9, topic: 'ch9-review',
      def: 'Node chưa chết hẳn để kích hoạt timeout nhưng hoạt động cực kỳ chậm chạp (ví dụ card mạng tụt xuống 1 Kb/s).' },
  ]);
})();
