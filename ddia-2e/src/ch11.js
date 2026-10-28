/* ch11 — Batch Processing (nguồn: DDIA ấn bản 1, Chương 10) */
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
  // 11.1 three-systems — Services, Batch, Stream + Derived rebuild
  // =====================================================================
  widget('three-systems', (root) => {
    const period = slider({ label: 'Chu kỳ chạy Batch', min: 1, max: 24, step: 1, value: 6, format: (v) => v + ' giờ', onInput: render });
    const jobDur = slider({ label: 'Thời gian chạy Batch job', min: 10, max: 120, step: 10, value: 40, format: (v) => v + ' phút', onInput: render });
    let derivedDropped = false;
    const btnDrop = button('Xoá bảng dẫn xuất (Derived View)', () => { derivedDropped = true; render(); }, 'danger');
    const btnRebuild = button('Tính lại từ Log gốc (System of Record)', () => { derivedDropped = false; render(); });

    const svg = mkSvg(640, 195, 'Độ trễ từ lúc sự kiện xảy ra tới lúc hiển thị ở 3 kiểu hệ thống');
    const layer = s('g'); svg.appendChild(layer);
    const s1 = stat('Dịch vụ (Online)', '12 ms', 'ok', 'Trả lời từng request ngay'),
          s2 = stat('Xử lý luồng (Nearline)', '~2 giây', 'accent', 'Cập nhật cửa sổ trượt'),
          s3 = stat('Xử lý theo lô (Offline)', '–'),
          s4 = stat('Trạng thái Bảng dẫn xuất', '–');

    root.append(
      h('div', { class: 'controls' }, period.el, jobDur.el),
      h('div', { class: 'btn-row' }, btnDrop, btnRebuild),
      h('div', { class: 'viz' }, svg),
      h('div', { class: 'stats' }, s1, s2, s3, s4)
    );

    function render() {
      clear(layer);
      const P = period.value, J = jobDur.value / 60;
      const maxDelayHrs = P + J;
      const X0 = 135, X1 = 620;
      const x = (hr) => X0 + (hr / 26) * (X1 - X0);

      const lanes = [
        { name: 'Online Service', y: 42, desc: 'Request/Response tức thời (~10 ms)', tone: 'ok' },
        { name: 'Stream (Nearline)', y: 96, desc: 'Xử lý luồng liên tục (~vài giây)', tone: 'accent' },
        { name: 'Batch (Offline)', y: 152, desc: `Định kỳ mỗi ${P}h + chạy ${jobDur}p`, tone: 'violet' },
      ];
      lanes.forEach((ln) => {
        layer.append(
          L(X0, ln.y, X1, ln.y, 'grid'),
          T(10, ln.y - 2, ln.name, 'lbl-strong sm'),
          T(10, ln.y + 13, ln.desc, 'sm f-ink3')
        );
      });

      for (let hr = 0; hr <= 24; hr += 4) {
        layer.append(L(x(hr), 16, x(hr), 175, 'axis'), TM(x(hr), 190, hr + 'h', 'sm'));
      }

      // Online dots
      for (let hr = 1; hr <= 24; hr += 1.5) {
        layer.append(C(x(hr), 42, 3.5, 'f-ok'));
      }
      // Stream bar
      layer.append(R(X0, 88, x(24) - X0, 16, 'f-accent-soft s-accent', { rx: 4 }));
      // Batch windows
      for (let t = P; t <= 24; t += P) {
        const bx = x(t - P), bw = x(t) - bx, jw = Math.max(6, x(t + J) - x(t));
        layer.append(
          R(bx, 138, bw, 12, 'f-surface2 s-line', { rx: 2 }),
          R(x(t), 134, jw, 24, derivedDropped ? 'f-bad-soft s-bad dash' : 'f-violet-soft s-violet', { rx: 4 }),
          TM(x(t) + jw / 2, 150, derivedDropped ? 'X' : 'Job', 'sm lbl-strong')
        );
      }

      s3.update(`Tới ${fmt(maxDelayHrs, 1)} giờ`, 'warn', `Chu kỳ ${P}h + chạy ${jobDur} phút`);
      s4.update(derivedDropped ? 'ĐÃ MẤT (0 dòng)' : 'Sẵn sàng (3.420 dòng)', derivedDropped ? 'bad' : 'ok',
        derivedDropped ? 'Log gốc vẫn còn nguyên — bấm Tính lại!' : 'Được dẫn xuất tất định từ Log gốc');
    }
    render();
  });

  // =====================================================================
  // 11.2 unix-pipeline — Step-by-step nginx log analysis
  // =====================================================================
  widget('unix-pipeline', (root) => {
    const sampleLogs = [
      '216.58.210.78 - - [27/Feb/2015:17:55:11 +0000] "GET /css/typography.css HTTP/1.1" 200 3377',
      '198.51.100.12 - - [27/Feb/2015:17:55:12 +0000] "GET /favicon.ico HTTP/1.1" 200 1040',
      '203.0.113.5 - - [27/Feb/2015:17:55:14 +0000] "GET /2013/05/24/ssh-keys.html HTTP/1.1" 200 8412',
      '198.51.100.12 - - [27/Feb/2015:17:55:15 +0000] "GET /favicon.ico HTTP/1.1" 200 1040',
      '192.0.2.88 - - [27/Feb/2015:17:55:16 +0000] "GET /css/typography.css HTTP/1.1" 200 3377',
      '203.0.113.5 - - [27/Feb/2015:17:55:19 +0000] "GET /favicon.ico HTTP/1.1" 200 1040',
      '216.58.210.78 - - [27/Feb/2015:17:55:20 +0000] "GET /2013/05/24/ssh-keys.html HTTP/1.1" 200 8412',
      '192.0.2.88 - - [27/Feb/2015:17:55:22 +0000] "GET /index.html HTTP/1.1" 200 5120',
      '198.51.100.44 - - [27/Feb/2015:17:55:25 +0000] "GET /favicon.ico HTTP/1.1" 200 1040',
      '203.0.113.99 - - [27/Feb/2015:17:55:29 +0000] "GET /2013/05/24/ssh-keys.html HTTP/1.1" 200 8412',
    ];
    let stepIdx = 5;
    let fieldChoice = 'url';

    const fieldSeg = seg({
      label: 'Trường cần trích xuất (awk)',
      options: [
        { value: 'url', label: "awk '{print $7}' (URL)" },
        { value: 'ip', label: "awk '{print $1}' (Client IP)" },
        { value: 'nocss', label: "Bỏ file .css" },
      ],
      value: 'url',
      onChange: (v) => { fieldChoice = v; render(); },
    });

    const strip = h('div', { class: 'stage-strip' });
    const termOut = h('pre', { class: 'term-out' });
    const s1 = stat('Số dòng đầu vào', '–'), s2 = stat('Số dòng ở bước đang chọn', '–'), s3 = stat('Khoá đứng đầu', '–');

    root.append(
      h('div', { class: 'controls' }, fieldSeg.el),
      strip,
      termOut,
      h('div', { class: 'stats' }, s1, s2, s3)
    );

    function computeStages() {
      const s0 = sampleLogs.slice();
      const s1Awk = s0.map((ln) => {
        const parts = ln.split(/\s+/);
        return fieldChoice === 'ip' ? parts[0] : parts[6];
      }).filter((v) => !(fieldChoice === 'nocss' && /\.css$/.test(v)));
      const s2Sort = s1Awk.slice().sort();
      const s3Uniq = [];
      for (const item of s2Sort) {
        if (!s3Uniq.length || s3Uniq[s3Uniq.length - 1].k !== item) s3Uniq.push({ k: item, c: 1 });
        else s3Uniq[s3Uniq.length - 1].c++;
      }
      const s3Lines = s3Uniq.map((x) => `${String(x.c).padStart(4, ' ')} ${x.k}`);
      const s4SortNum = s3Uniq.slice().sort((a, b) => b.c - a.c || a.k.localeCompare(b.k)).map((x) => `${String(x.c).padStart(4, ' ')} ${x.k}`);
      const s5Head = s4SortNum.slice(0, 5);
      return [
        { cmd: 'cat access.log', desc: 'Đọc file gốc', lines: s0 },
        { cmd: fieldChoice === 'ip' ? "awk '{print $1}'" : fieldChoice === 'nocss' ? "awk '$7 !~ /\\.css$/ {print $7}'" : "awk '{print $7}'", desc: 'Trích trường', lines: s1Awk },
        { cmd: 'sort', desc: 'Gom dòng giống nhau', lines: s2Sort },
        { cmd: 'uniq -c', desc: 'Đếm dòng liền kề', lines: s3Lines },
        { cmd: 'sort -r -n', desc: 'Xếp giảm dần theo số', lines: s4SortNum },
        { cmd: 'head -n 5', desc: 'Lấy top 5', lines: s5Head },
      ];
    }

    function render() {
      const stages = computeStages();
      clear(strip);
      stages.forEach((st, idx) => {
        if (idx > 0) strip.appendChild(h('span', { class: 'arrow' }, ' | '));
        const btn = h('button', {
          type: 'button',
          'aria-pressed': String(idx === stepIdx),
          onClick: () => { stepIdx = idx; render(); },
        }, st.cmd, h('small', `${st.desc} (${st.lines.length} dòng)`));
        strip.appendChild(btn);
      });
      const cur = stages[stepIdx];
      termOut.textContent = cur.lines.join('\n');
      s1.update(String(sampleLogs.length), 'accent', 'File access.log mẫu');
      s2.update(`${cur.lines.length} dòng`, 'ok', `Sau lệnh: ${cur.cmd}`);
      s3.update(stages[5].lines[0] ? stages[5].lines[0].trim() : '–', 'ok', 'Kết quả cuối pipeline');
    }
    render();
  });

  // =====================================================================
  // 11.3 sort-vs-hash — In-memory hash table vs External mergesort
  // =====================================================================
  widget('sort-vs-hash', (root) => {
    const distinctSl = slider({ label: 'Số URL khác nhau (Working set)', min: 1, max: 40, step: 1, value: 18, format: (v) => v + ' triệu URL', onInput: render });
    const ramSl = slider({ label: 'Dung lượng RAM khả dụng', min: 1, max: 4, step: 0.5, value: 1.5, format: (v) => fmt(v, 1) + ' GB', onInput: render });
    const svg = mkSvg(640, 210, 'So sánh thời gian chạy của Bảng băm trong bộ nhớ và Sắp xếp ngoài');
    const layer = s('g'); svg.appendChild(layer);
    const s1 = stat('Kích thước Working Set', '–'), s2 = stat('Thời gian Bảng băm (Hash)', '–'), s3 = stat('Thời gian Sắp xếp ngoài (Sort)', '–');

    root.append(
      h('div', { class: 'controls' }, distinctSl.el, ramSl.el),
      h('div', { class: 'viz' }, svg),
      h('div', { class: 'stats' }, s1, s2, s3)
    );

    function render() {
      clear(layer);
      const ramGB = ramSl.value;
      const curM = distinctSl.value;
      // 1 million distinct URLs ~ 100 MB working set in hash table
      const wsGB = (m) => m * 0.1;
      const hashTime = (m) => {
        const w = wsGB(m);
        if (w <= ramGB) return 8 + m * 0.8;
        const spill = w - ramGB;
        return 8 + ramGB * 0.8 + spill * 55; // Random I/O thrashing penalty
      };
      const sortTime = (m) => 18 + m * 1.1; // Sequential I/O mergesort

      const X0 = 55, X1 = 615, Y0 = 175, Y1 = 24;
      const x = (m) => X0 + ((m - 1) / 39) * (X1 - X0);
      const y = (sec) => Y0 - (Math.min(sec, 120) / 120) * (Y0 - Y1);

      for (let sVal = 0; sVal <= 120; sVal += 30) {
        layer.append(L(X0, y(sVal), X1, y(sVal), 'grid'), TE(X0 - 8, y(sVal) + 4, sVal + 's', 'sm'));
      }
      layer.append(L(X0, Y0, X1, Y0, 'axis'), TE(X1, Y0 + 26, 'Số triệu URL khác nhau', 'sm'));

      const ramLimitM = ramGB / 0.1;
      if (ramLimitM <= 40) {
        layer.append(
          L(x(ramLimitM), Y1, x(ramLimitM), Y0, 's-warn dash'),
          T(x(ramLimitM) + 5, Y1 + 12, `Ngưỡng tràn RAM (${fmt(ramGB, 1)} GB)`, 'sm f-warn lbl-strong')
        );
      }

      let dHash = '', dSort = '';
      for (let m = 1; m <= 40; m++) {
        dHash += (m === 1 ? 'M' : 'L') + `${x(m)},${y(hashTime(m))}`;
        dSort += (m === 1 ? 'M' : 'L') + `${x(m)},${y(sortTime(m))}`;
      }
      layer.append(
        s('path', { d: dSort, class: 'f-none s-accent sw2' }),
        s('path', { d: dHash, class: 'f-none s-bad sw2' }),
        C(x(curM), y(sortTime(curM)), 5, 'f-accent'),
        C(x(curM), y(hashTime(curM)), 5, 'f-bad'),
        T(X1 - 150, y(sortTime(40)) - 8, 'GNU sort (I/O tuần tự)', 'sm f-accent lbl-strong'),
        T(X0 + 20, Y1 + 28, 'Bảng băm Ruby (tràn đĩa = đọc ngẫu nhiên)', 'sm f-bad lbl-strong')
      );

      const curWS = wsGB(curM), hSec = hashTime(curM), sSec = sortTime(curM);
      s1.update(fmt(curWS, 2) + ' GB', curWS <= ramGB ? 'ok' : 'bad', curWS <= ramGB ? 'Vừa gọn trong RAM' : 'Vượt quá RAM → Thrashing!');
      s2.update(fmt(hSec, 1) + ' giây', hSec <= sSec ? 'ok' : 'bad', hSec <= sSec ? 'Nhanh hơn vì không cần sort' : 'Chậm gấp nhiều lần do swap ngẫu nhiên');
      s3.update(fmt(sSec, 1) + ' giây', sSec < hSec ? 'ok' : 'accent', 'Tăng tuyến tính nhờ mergesort tuần tự');
    }
    render();
  });

  // =====================================================================
  // 11.4 pipe-builder — Unix philosophy interactive pipeline builder
  // =====================================================================
  widget('pipe-builder', (root) => {
    const rawLines = [
      '216.58.210.78 /favicon.ico',
      '198.51.100.12 /ssh-keys.html',
      '216.58.210.78 /favicon.ico',
      '203.0.113.5 /typography.css',
      '198.51.100.12 /favicon.ico',
      '203.0.113.5 /ssh-keys.html',
    ];
    let chain = ['awk-url', 'sort', 'uniq-c', 'sort-rn'];
    let inspectIdx = 3;

    const TOOLS = {
      'awk-url': { label: "awk '{print $2}'", desc: 'Lấy cột URL', fn: (arr) => arr.map((x) => x.split(/\s+/)[1] || x) },
      'geo-ip': { label: 'ip-to-country (tự viết)', desc: 'Đổi IP → Quốc gia', fn: (arr) => arr.map((x) => x.replace('216.58.210.78', 'US').replace('198.51.100.12', 'VN').replace('203.0.113.5', 'JP')) },
      'grep-nocss': { label: "grep -v '\\.css$'", desc: 'Lọc bỏ CSS', fn: (arr) => arr.filter((x) => !x.endsWith('.css')) },
      'sort': { label: 'sort', desc: 'Sắp thứ tự từ điển', fn: (arr) => arr.slice().sort() },
      'uniq-c': {
        label: 'uniq -c', desc: 'Gộp dòng kề nhau', fn: (arr) => {
          const out = [];
          for (const ln of arr) {
            if (!out.length || out[out.length - 1].k !== ln) out.push({ k: ln, c: 1 });
            else out[out.length - 1].c++;
          }
          return out.map((o) => `${o.c} ${o.k}`);
        }
      },
      'sort-rn': { label: 'sort -r -n', desc: 'Sắp giảm theo số', fn: (arr) => arr.slice().sort((a, b) => parseInt(b, 10) - parseInt(a, 10)) },
      'head-2': { label: 'head -n 2', desc: 'Giữ 2 dòng đầu', fn: (arr) => arr.slice(0, 2) },
    };

    const toolbox = h('div', { class: 'toolbox' });
    Object.keys(TOOLS).forEach((k) => {
      toolbox.appendChild(button('+ ' + TOOLS[k].label, () => {
        chain.push(k);
        inspectIdx = chain.length - 1;
        render();
      }, 'ghost'));
    });

    const strip = h('div', { class: 'stage-strip' });
    const termOut = h('pre', { class: 'term-out' });
    const note = h('p', { class: 'lab-note' });

    root.append(
      h('div', { class: 'lbl' }, 'Hộp đồ nghề (bấm để nối thêm vào ống pipe):'),
      toolbox,
      strip,
      termOut,
      note
    );

    function render() {
      clear(strip);
      let curLines = rawLines.slice();
      const snapshots = [curLines];
      chain.forEach((k) => {
        curLines = TOOLS[k].fn(curLines);
        snapshots.push(curLines);
      });
      if (inspectIdx >= chain.length) inspectIdx = Math.max(-1, chain.length - 1);

      chain.forEach((k, idx) => {
        if (idx > 0) strip.appendChild(h('span', { class: 'arrow' }, ' | '));
        const wrap = h('span', { class: 'chipwrap' });
        const b = h('button', {
          type: 'button',
          'aria-pressed': String(idx === inspectIdx),
          onClick: () => { inspectIdx = idx; render(); },
        }, TOOLS[k].label, h('small', TOOLS[k].desc));
        const xBtn = h('button', {
          type: 'button',
          class: 'xbtn',
          onClick: () => { chain.splice(idx, 1); render(); },
        }, '×');
        wrap.append(b, xBtn);
        strip.appendChild(wrap);
      });

      const shown = inspectIdx >= 0 ? snapshots[inspectIdx + 1] : rawLines;
      termOut.textContent = shown.join('\n');

      const uniqIdx = chain.indexOf('uniq-c');
      const hasSortBeforeUniq = uniqIdx > 0 && chain[uniqIdx - 1] === 'sort';
      if (uniqIdx >= 0 && !hasSortBeforeUniq) {
        note.textContent = 'Cảnh báo: uniq -c đang chạy mà không có sort ngay trước nó — các dòng giống nhau nhưng nằm cách xa nhau sẽ bị đếm tách rời!';
      } else {
        note.textContent = 'Mọi công cụ đều đọc stdin và ghi stdout theo giao diện dòng văn bản thống nhất, kể cả công cụ ip-to-country tự viết.';
      }
    }
    render();
  });

  // =====================================================================
  // 11.5 hdfs-blocks — HDFS blocks across 6 DataNodes
  // =====================================================================
  widget('hdfs-blocks', (root) => {
    const numBlocksSl = slider({ label: 'Số block của file', min: 3, max: 6, step: 1, value: 4, format: (v) => v + ' block (mỗi block 128 MB)', onInput: resetPlacement });
    const repSl = slider({ label: 'Hệ số nhân bản (Replication factor)', min: 1, max: 3, step: 1, value: 3, format: (v) => v + ' bản sao', onInput: resetPlacement });
    const nodes = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, alive: true, blocks: [] }));

    function resetPlacement() {
      const nb = numBlocksSl.value, rf = repSl.value;
      nodes.forEach((n) => { n.blocks = []; });
      for (let b = 0; b < nb; b++) {
        for (let r = 0; r < rf; r++) {
          const nid = (b * 2 + r) % 6;
          nodes[nid].blocks.push(b);
        }
      }
      render();
    }

    const btnRerep = button('NameNode nhân bản lại các block thiếu', () => {
      const nb = numBlocksSl.value, rf = repSl.value;
      const aliveNodes = nodes.filter((n) => n.alive);
      if (!aliveNodes.length) return;
      for (let b = 0; b < nb; b++) {
        const holders = aliveNodes.filter((n) => n.blocks.includes(b));
        if (holders.length > 0 && holders.length < rf) {
          for (const cand of aliveNodes) {
            if (holders.length >= rf) break;
            if (!cand.blocks.includes(b)) { cand.blocks.push(b); holders.push(cand); }
          }
        }
      }
      render();
    });
    const btnRevive = button('Khôi phục toàn bộ 6 DataNode', () => {
      nodes.forEach((n) => { n.alive = true; });
      resetPlacement();
    }, 'ghost');

    const grid = h('div', { class: 'card-grid' });
    const s1 = stat('Block đủ bản sao', '–'), s2 = stat('Block còn đúng 1 bản', '–'), s3 = stat('Block mất hoàn toàn', '–');

    root.append(
      h('div', { class: 'controls' }, numBlocksSl.el, repSl.el),
      h('div', { class: 'btn-row' }, btnRerep, btnRevive),
      grid,
      h('div', { class: 'stats' }, s1, s2, s3)
    );

    function render() {
      clear(grid);
      const nb = numBlocksSl.value, rf = repSl.value;
      const liveCounts = Array(nb).fill(0);
      nodes.forEach((n) => {
        if (n.alive) n.blocks.forEach((b) => { if (b < nb) liveCounts[b]++; });
      });

      nodes.forEach((n) => {
        const card = h('button', {
          type: 'button',
          class: 'mcard' + (n.alive ? '' : ' down'),
          onClick: () => { n.alive = !n.alive; render(); },
        },
          h('h5', h('span', `DataNode ${n.id}`), h('span', { class: 'pill ' + (n.alive ? 'ok' : 'bad') }, n.alive ? 'ONLINE' : 'DEAD')),
          h('div', { class: 'sub' }, 'Bấm để bật/tắt máy'),
          h('div', n.blocks.filter((b) => b < nb).map((b) =>
            h('span', { class: 'kc p' + (b % 4) + (liveCounts[b] === 0 ? ' bad' : '') }, `blk_${b}`)
          ))
        );
        grid.appendChild(card);
      });

      const full = liveCounts.filter((c) => c >= rf).length;
      const fragile = liveCounts.filter((c) => c === 1 && rf > 1).length;
      const lost = liveCounts.filter((c) => c === 0).length;

      s1.update(`${full}/${nb}`, full === nb ? 'ok' : 'warn', `Đạt hệ số nhân bản ≥ ${rf}`);
      s2.update(String(fragile), fragile ? 'warn' : 'ok', 'Cần NameNode nhân bản lại ngay');
      s3.update(String(lost), lost ? 'bad' : 'ok', lost ? 'MẤT DỮ LIỆU!' : 'An toàn');
    }
    resetPlacement();
  });

  // =====================================================================
  // 11.6 mr-job — MapReduce job execution & deterministic hash shuffle
  // =====================================================================
  widget('mr-job', (root) => {
    const numRedSl = slider({ label: 'Số lượng Reducer', min: 2, max: 3, step: 1, value: 2, format: (v) => v + ' Reducer', onInput: render });
    const stageSeg = seg({
      label: 'Giai đoạn thực thi',
      options: [
        { value: 1, label: '1. Map (rút khoá)' },
        { value: 2, label: '2. Partition & Sort' },
        { value: 3, label: '3. Shuffle & Reduce' },
      ],
      value: 3,
      onChange: render,
    });
    let selKey = '/favicon.ico';

    const mappers = [
      ['/favicon.ico', '/ssh.html', '/favicon.ico', '/index.html'],
      ['/css.css', '/favicon.ico', '/ssh.html', '/about.html'],
      ['/ssh.html', '/index.html', '/css.css', '/favicon.ico'],
    ];
    const keyHash = (k, R) => {
      let sum = 0;
      for (let i = 0; i < k.length; i++) sum = (sum * 31 + k.charCodeAt(i)) >>> 0;
      return sum % R;
    };

    const vizWrap = h('div', { class: 'card-grid wide' });
    const s1 = stat('Khoá đang theo dõi', '–'), s2 = stat('Hash(key) mod R', '–'), s3 = stat('Tổng đếm tại Reducer', '–');

    root.append(
      h('div', { class: 'controls' }, numRedSl.el, stageSeg.el),
      vizWrap,
      h('div', { class: 'stats' }, s1, s2, s3)
    );

    function render() {
      clear(vizWrap);
      const RCount = numRedSl.value;
      const st = stageSeg.value;

      // Mapper cards
      mappers.forEach((records, mi) => {
        const card = h('div', { class: 'mcard' }, h('h5', `Mapper ${mi + 1} (Block ${mi + 1})`));
        if (st === 1) {
          card.appendChild(h('div', { class: 'sub' }, 'Đầu ra (key, 1):'));
          records.forEach((k) => {
            card.appendChild(h('span', {
              class: 'kc p' + keyHash(k, RCount) + (k === selKey ? ' on' : ''),
              onClick: () => { selKey = k; render(); },
            }, `${k}:1`));
          });
        } else {
          for (let r = 0; r < RCount; r++) {
            const part = records.filter((k) => keyHash(k, RCount) === r).sort();
            card.appendChild(h('div', { class: 'sub' }, `Phân vùng R${r + 1} (đã sort):`));
            part.forEach((k) => {
              card.appendChild(h('span', {
                class: 'kc p' + r + (k === selKey ? ' on' : ''),
                onClick: () => { selKey = k; render(); },
              }, `${k}:1`));
            });
          }
        }
        vizWrap.appendChild(card);
      });

      if (st >= 3) {
        for (let r = 0; r < RCount; r++) {
          const allForR = mappers.flat().filter((k) => keyHash(k, RCount) === r).sort();
          const counts = {};
          allForR.forEach((k) => { counts[k] = (counts[k] || 0) + 1; });
          const rCard = h('div', { class: 'mcard active' },
            h('h5', `Reducer ${r + 1}`, h('span', { class: 'pill accent' }, 'Đã trộn & gộp')),
            h('div', { class: 'sub' }, 'Đầu ra trên HDFS:')
          );
          Object.entries(counts).forEach(([k, c]) => {
            rCard.appendChild(h('span', {
              class: 'kc p' + r + (k === selKey ? ' on' : ''),
              onClick: () => { selKey = k; render(); },
            }, `${k} → ${c}`));
          });
          vizWrap.appendChild(rCard);
        }
      }

      const targetR = keyHash(selKey, RCount);
      const totalSel = mappers.flat().filter((k) => k === selKey).length;
      s1.update(selKey, 'accent', 'Bấm vào khoá bất kỳ để đổi');
      s2.update(`Reducer ${targetR + 1}`, 'ok', 'Mọi mapper tính cùng hàm băm');
      s3.update(`${totalSel} lượt`, 'ok', `Gom hết về Reducer ${targetR + 1}`);
    }
    render();
  });

  // =====================================================================
  // 11.7 mr-workflow — Chained MapReduce jobs & straggler barrier
  // =====================================================================
  widget('mr-workflow', (root) => {
    const stragglerSl = slider({ label: 'Độ trễ của Task lề mề ở Job 1', min: 0, max: 20, step: 2, value: 10, format: (v) => '+' + v + ' phút', onInput: render });
    const failJob2 = checkbox('Cho Job 2 thất bại giữa chừng (đầu ra tạm bị huỷ)', false, render);
    const svg = mkSvg(640, 210, 'Dòng thời gian của Workflow 4 Job MapReduce');
    const layer = s('g'); svg.appendChild(layer);
    const s1 = stat('Job 1 hoàn tất lúc', '–'), s2 = stat('Job 3 bắt đầu lúc', '–'), s3 = stat('Tổng thời gian Workflow', '–');

    root.append(
      h('div', { class: 'controls' }, stragglerSl.el),
      failJob2.el,
      h('div', { class: 'viz' }, svg),
      h('div', { class: 'stats' }, s1, s2, s3)
    );

    function render() {
      clear(layer);
      const strag = stragglerSl.value;
      const failed = failJob2.input.checked;
      const X0 = 105, X1 = 620, TMAX = 65;
      const x = (t) => X0 + (t / TMAX) * (X1 - X0);

      // Job 1 (3 tasks: 12m, 10m, 12+strag m)
      // Job 2 (parallel input B: 14m)
      // Job 3 depends on Job 1 & Job 2 -> duration 15m
      // Job 4 depends on Job 3 -> duration 12m
      const j1End = 12 + strag;
      const j2End = 14;
      const j3Start = Math.max(j1End, j2End);
      const j3End = j3Start + 15;
      const j4End = j3End + 12;

      const jobs = [
        { name: 'Job 1 (Đếm URL)', y: 24, start: 0, tasks: [12, 10, j1End], ok: true },
        { name: 'Job 2 (Bảng User)', y: 72, start: 0, tasks: [14, 11, 13], ok: !failed },
        { name: 'Job 3 (Join 1+2)', y: 120, start: j3Start, tasks: [15, 13, 14], ok: !failed },
        { name: 'Job 4 (Xếp hạng)', y: 168, start: j3End, tasks: [12, 11, 12], ok: !failed },
      ];

      jobs.forEach((jb, ji) => {
        layer.append(T(8, jb.y + 18, jb.name, 'lbl-strong sm'));
        jb.tasks.forEach((dur, ti) => {
          const ty = jb.y + ti * 11;
          const isBlocked = failed && ji >= 2;
          const isStrag = ji === 0 && ti === 2 && strag > 0;
          const cls = !jb.ok ? 'f-bad-soft s-bad dash' : isBlocked ? 'f-surface2 s-line dash' : isStrag ? 'f-mark-soft s-warn' : 'f-accent-soft s-accent';
          layer.append(R(x(jb.start), ty, x(jb.start + dur) - x(jb.start), 9, cls, { rx: 2 }));
        });
      });

      // Barrier lines
      layer.append(
        L(x(j3Start), 16, x(j3Start), 198, 's-warn dash'),
        T(x(j3Start) + 4, 204, `Rào cản HDFS (${j3Start}p)`, 'sm f-warn lbl-strong')
      );

      s1.update(j1End + ' phút', strag > 0 ? 'warn' : 'ok', strag > 0 ? `Bị giữ chân bởi 1 task chậm (+${strag}p)` : 'Không có straggler');
      s2.update(failed ? 'BỊ CHẶN' : j3Start + ' phút', failed ? 'bad' : 'accent', failed ? 'Chờ Job 2 chạy lại thành công' : 'Phải đợi cả Job 1 & Job 2 ghi xong HDFS');
      s3.update(failed ? 'Chưa hoàn tất' : j4End + ' phút', failed ? 'bad' : 'ok', 'Mỗi bước phải đợi bước trước 100%');
    }
    render();
  });

  // =====================================================================
  // 11.8 sort-merge-join — Reduce-side join with secondary sort
  // =====================================================================
  widget('sort-merge-join', (root) => {
    const secSort = checkbox('Bật Secondary Sort (bản ghi User luôn đứng trước các sự kiện Activity)', true, render);
    let selUser = 'u101';

    const users = [
      { uid: 'u101', birth: '1992 (33 tuổi)' },
      { uid: 'u204', birth: '2001 (24 tuổi)' },
    ];
    const events = [
      { uid: 'u101', url: '/home', t: '10:01' },
      { uid: 'u204', url: '/pricing', t: '10:02' },
      { uid: 'u101', url: '/checkout', t: '10:05' },
      { uid: 'u204', url: '/docs', t: '10:09' },
    ];

    const userPick = seg({
      label: 'Theo dõi User ID',
      options: [{ value: 'u101', label: 'User u101' }, { value: 'u204', label: 'User u204' }],
      value: 'u101',
      onChange: (v) => { selUser = v; render(); },
    });

    const split = h('div', { class: 'card-grid wide' });
    const s1 = stat('Thứ tự bản ghi tới Reducer', '–'), s2 = stat('Bộ nhớ đệm tại Reducer', '–'), s3 = stat('Số lần gọi DB qua mạng', '0 lần', 'ok', 'Tính toán cục bộ 100%');

    root.append(
      h('div', { class: 'controls' }, userPick.el),
      secSort.el,
      split,
      h('div', { class: 'stats' }, s1, s2, s3)
    );

    function render() {
      clear(split);
      const isSec = secSort.input.checked;
      const uRec = users.find((u) => u.uid === selUser);
      const evRecs = events.filter((e) => e.uid === selUser);

      const mapCard = h('div', { class: 'mcard' },
        h('h5', 'Hai nhóm Mapper phát cùng khoá = user_id'),
        h('div', { class: 'sub' }, 'Mapper Bảng Users:'),
        h('span', { class: 'kc p1 on' }, `(${uRec.uid}, [0: USER ${uRec.birth}])`),
        h('div', { class: 'sub' }, 'Mapper Log Sự kiện:'),
        evRecs.map((e) => h('span', { class: 'kc p0 on' }, `(${e.uid}, [1: CLICK ${e.url}])`))
      );

      const ordered = isSec
        ? [`USER: ${uRec.birth}`, ...evRecs.map((e) => `EVENT: ${e.url} (${e.t})`)]
        : [evRecs[0] && `EVENT: ${evRecs[0].url}`, `USER: ${uRec.birth}`, evRecs[1] && `EVENT: ${evRecs[1].url}`];

      const redCard = h('div', { class: 'mcard active' },
        h('h5', `Reducer xử lý khoá ${selUser}`),
        h('div', { class: 'sub' }, 'Chuỗi giá trị nhận từ Iterator:'),
        ordered.map((txt) => h('div', { class: 'kc ' + (txt.startsWith('USER') ? 'p1' : 'p0') }, txt)),
        h('div', { class: 'sub' }, 'Đầu ra đã Join (url, tuổi):'),
        evRecs.map((e) => h('div', { class: 'grp-res' }, `→ (${e.url}, ${uRec.birth})`))
      );

      split.append(mapCard, redCard);
      s1.update(isSec ? 'User trước → Event sau' : 'Lộn xộn (Event đến trước User)', isSec ? 'ok' : 'warn', isSec ? 'Nhờ nhãn phụ [0] < [1]' : 'Tốn RAM đệm sự kiện');
      s2.update(isSec ? 'O(1) — đúng 1 biến' : `Phải đệm ${evRecs.length} sự kiện`, isSec ? 'ok' : 'bad', isSec ? 'Streaming qua iterator' : 'Nguy cơ tràn RAM nếu user có triệu sự kiện');
    }
    render();
  });

  // =====================================================================
  // 11.9 group-by — GROUP BY & Sessionization A/B test
  // =====================================================================
  widget('group-by', (root) => {
    const mode = seg({
      label: 'Phép gom nhóm (Mapper Key)',
      options: [
        { value: 'url', label: 'GROUP BY url (Đếm lượt xem)' },
        { value: 'status', label: 'GROUP BY status_code' },
        { value: 'hour', label: 'GROUP BY giờ' },
        { value: 'session', label: 'Sessionization (Theo user_id / A-B test)' },
      ],
      value: 'session',
      onChange: render,
    });

    const sqlBox = h('pre', { class: 'code' });
    const outGrid = h('div', { class: 'card-grid wide' });
    const s1 = stat('Khoá phát ra từ Mapper', '–'), s2 = stat('Hàm gộp tại Reducer', '–'), s3 = stat('Tỉ lệ mua hàng (A/B test)', 'B: 67% vs A: 33%', 'ok', 'Nhờ gom chuỗi phiên');

    root.append(mode.el, sqlBox, outGrid, h('div', { class: 'stats' }, s1, s2, s3));

    function render() {
      clear(outGrid);
      const m = mode.value;
      if (m === 'url') {
        sqlBox.textContent = 'SELECT request_url, COUNT(*) FROM access_log GROUP BY request_url;';
        s1.update('key = request_url', 'accent', 'Gom mọi lượt xem cùng trang');
        s2.update('COUNT(*)', 'ok', 'Cộng dồn số bản ghi');
        [['/home', 420], ['/pricing', 185], ['/checkout', 92]].forEach(([k, c]) => {
          outGrid.appendChild(h('div', { class: 'mcard' }, h('h5', k), h('div', { class: 'grp-res' }, `COUNT = ${c}`)));
        });
      } else if (m === 'status') {
        sqlBox.textContent = 'SELECT status_code, COUNT(*) FROM access_log GROUP BY status_code;';
        s1.update('key = status_code', 'accent', 'Gom theo mã HTTP');
        s2.update('COUNT(*)', 'ok', 'Theo dõi tỉ lệ lỗi 500/404');
        [['200 OK', 640], ['404 Not Found', 45], ['500 Error', 12]].forEach(([k, c]) => {
          outGrid.appendChild(h('div', { class: 'mcard' }, h('h5', k), h('div', { class: 'grp-res' }, `COUNT = ${c}`)));
        });
      } else if (m === 'hour') {
        sqlBox.textContent = 'SELECT date_trunc(\'hour\', ts) AS hr, COUNT(*) FROM access_log GROUP BY hr;';
        s1.update('key = hour(timestamp)', 'accent', 'Gom theo khung giờ');
        s2.update('COUNT(*)', 'ok', 'Thống kê lưu lượng theo giờ');
        [['10:00', 210], ['11:00', 315], ['12:00', 172]].forEach(([k, c]) => {
          outGrid.appendChild(h('div', { class: 'mcard' }, h('h5', k), h('div', { class: 'grp-res' }, `COUNT = ${c}`)));
        });
      } else {
        sqlBox.textContent = '-- Sessionization: gom mọi sự kiện của cùng session_id từ nhiều web server\nSELECT session_id, array_agg(event ORDER BY ts) FROM activity GROUP BY session_id;';
        s1.update('key = session_id', 'accent', 'Gom sự kiện rải rác về 1 chỗ');
        s2.update('Sắp theo giờ → Chuỗi hành động', 'ok', 'Đánh giá chuyển đổi phiên bản A/B');
        const sessions = [
          { id: 'sess_91 (Bản B)', chain: 'Xem trang → Thêm giỏ → Thanh toán ✓' },
          { id: 'sess_42 (Bản A)', chain: 'Xem trang → Thoát' },
          { id: 'sess_77 (Bản B)', chain: 'Xem trang → Xem giá → Thanh toán ✓' },
        ];
        sessions.forEach((ss) => {
          outGrid.appendChild(h('div', { class: 'mcard active' }, h('h5', ss.id), h('div', { class: 'grp-res' }, ss.chain)));
        });
      }
    }
    render();
  });

  // =====================================================================
  // 11.10 skew — Handling hot keys / linchpin objects across 8 reducers
  // =====================================================================
  widget('skew', (root) => {
    const hotPctSl = slider({ label: 'Tỉ lệ bản ghi thuộc Khoá nóng (@celebrity)', min: 5, max: 80, step: 5, value: 55, format: (v) => v + '% tổng dữ liệu', onInput: render });
    const strat = seg({
      label: 'Chiến lược xử lý lệch tải',
      options: [
        { value: 'hash', label: 'Băm chuẩn (Tất định 1 Reducer)' },
        { value: 'skewed', label: 'Pig Skewed Join (Rải ngẫu nhiên + nhân bản)' },
        { value: 'twostage', label: 'Gộp 2 giai đoạn (Two-stage aggregation)' },
      ],
      value: 'hash',
      onChange: render,
    });

    const svg = mkSvg(640, 200, 'Tải của 8 Reducer khi có khoá nóng');
    const layer = s('g'); svg.appendChild(layer);
    const s1 = stat('Reducer bận nhất', '–'), s2 = stat('Reducer nhàn nhất', '–'), s3 = stat('Thời gian hoàn tất Job', '–');

    root.append(
      h('div', { class: 'controls' }, hotPctSl.el, strat.el),
      h('div', { class: 'viz' }, svg),
      h('div', { class: 'stats' }, s1, s2, s3)
    );

    function render() {
      clear(layer);
      const TOTAL = 100000;
      const hotTotal = Math.round(TOTAL * (hotPctSl.value / 100));
      const normalEach = Math.round((TOTAL - hotTotal) / 8);
      const st = strat.value;

      const hotPerR = Array(8).fill(0);
      if (st === 'hash') {
        hotPerR[2] = hotTotal;
      } else {
        for (let i = 0; i < 8; i++) hotPerR[i] = Math.round(hotTotal / 8);
      }
      const maxLoad = Math.max(...hotPerR.map((hVal) => hVal + normalEach));
      const minLoad = Math.min(...hotPerR.map((hVal) => hVal + normalEach));

      const X0 = 60, X1 = 620, Y0 = 168, Y1 = 24;
      const scaleMax = Math.max(85000, maxLoad);
      const y = (v) => Y0 - (v / scaleMax) * (Y0 - Y1);

      layer.append(L(X0, Y0, X1, Y0, 'axis'));
      for (let i = 0; i < 8; i++) {
        const bx = X0 + 14 + i * 68, bw = 46;
        const hNorm = Y0 - y(normalEach);
        const hHot = Y0 - y(hotPerR[i]);
        layer.append(
          R(bx, y(normalEach), bw, hNorm, 'f-accent-soft s-accent', { rx: 3 }),
          R(bx, y(normalEach + hotPerR[i]), bw, hHot, 'f-mark-soft s-warn', { rx: 3 }),
          TM(bx + bw / 2, Y0 + 18, `R${i + 1}`, 'sm lbl-strong'),
          TM(bx + bw / 2, y(normalEach + hotPerR[i]) - 6, fmtBig(normalEach + hotPerR[i]), 'sm')
        );
      }

      s1.update(fmt(maxLoad) + ' bản ghi', maxLoad > 25000 ? 'bad' : 'ok', 'Quyết định tổng thời gian chạy Job');
      s2.update(fmt(minLoad) + ' bản ghi', 'accent', 'Các khoá bình thường chia đều');
      const speedup = ((hotTotal + normalEach) / maxLoad).toFixed(1);
      s3.update(fmt(maxLoad / 1000, 1) + ' giây', st === 'hash' && hotPctSl.value >= 25 ? 'bad' : 'ok',
        st === 'hash' ? 'Chờ đúng 1 reducer xử lý hết @celebrity' : `Nhanh gấp ${speedup}× nhờ chia tải khoá nóng`);
    }
    render();
  });

  // =====================================================================
  // 11.11 join-picker — Map-side vs Reduce-side join algorithm picker
  // =====================================================================
  widget('join-picker', (root) => {
    const smallSizeSl = slider({ label: 'Kích thước bảng nhỏ (Users)', min: 50, max: 4000, step: 50, value: 300, format: (v) => v + ' MB', onInput: render });
    const ramSl = slider({ label: 'Bộ nhớ RAM mỗi Mapper', min: 512, max: 2048, step: 256, value: 1024, format: (v) => v + ' MB', onInput: render });
    const coPart = checkbox('Hai đầu vào đã được phân vùng giống hệt nhau (cùng số partition, cùng hàm hash)', false, render);
    const coSort = checkbox('Hai đầu vào còn được sắp xếp sẵn theo khoá join trong mỗi phân vùng', false, render);

    const grid = h('div', { class: 'card-grid wide' });
    const s1 = stat('Thuật toán tối ưu nhất', '–'), s2 = stat('Cần Shuffle qua mạng?', '–'), s3 = stat('Mỗi Mapper đọc từ HDFS', '–');

    root.append(
      h('div', { class: 'controls' }, smallSizeSl.el, ramSl.el),
      coPart.el,
      coSort.el,
      grid,
      h('div', { class: 'stats' }, s1, s2, s3)
    );

    function render() {
      clear(grid);
      const sz = smallSizeSl.value, ram = ramSl.value;
      const isPart = coPart.input.checked;
      const isSort = isPart && coSort.input.checked;
      const numParts = 10;
      const partSize = sz / numParts;

      const canBroadcast = sz <= ram * 0.75;
      const canPartHash = isPart && partSize <= ram * 0.75;
      const canMapMerge = isSort;

      let picked = 'reduce-merge';
      if (canMapMerge) picked = 'map-merge';
      else if (canPartHash) picked = 'part-hash';
      else if (canBroadcast) picked = 'broadcast';

      const algos = [
        {
          id: 'broadcast', name: 'Broadcast Hash Join', ok: canBroadcast,
          desc: `Nạp toàn bộ bảng nhỏ (${sz} MB) vào bảng băm trong RAM của mỗi Mapper.`,
        },
        {
          id: 'part-hash', name: 'Partitioned Hash Join (Bucketed)', ok: canPartHash,
          desc: `Mỗi Mapper chỉ nạp 1/${numParts} bảng nhỏ (${fmt(partSize, 0)} MB) tương ứng phân vùng của mình.`,
        },
        {
          id: 'map-merge', name: 'Map-Side Merge Join', ok: canMapMerge,
          desc: 'Đọc và trộn tuần tự hai file đã đồng phân vùng & đồng sắp xếp ngay tại Mapper, không giới hạn RAM.',
        },
        {
          id: 'reduce-merge', name: 'Reduce-Side Sort-Merge Join', ok: true,
          desc: 'Luôn dùng được cho mọi dữ liệu, nhưng phải sắp xếp và shuffle cả hai bảng qua mạng.',
        },
      ];

      algos.forEach((a) => {
        grid.appendChild(h('div', {
          class: 'algo-card ' + (a.id === picked ? 'pick' : a.ok ? 'ok' : 'no'),
        },
          h('b', a.name + (a.id === picked ? ' ★ ĐƯỢC CHỌN' : a.ok ? ' (Dùng được)' : ' (Không thoả điều kiện)')),
          h('p', a.desc)
        ));
      });

      const names = {
        'broadcast': 'Broadcast Hash Join',
        'part-hash': 'Partitioned Hash Join',
        'map-merge': 'Map-Side Merge Join',
        'reduce-merge': 'Reduce-Side Sort-Merge Join',
      };
      s1.update(names[picked], 'ok', 'Tự động chọn theo metadata');
      s2.update(picked === 'reduce-merge' ? 'CÓ (Tốn băng thông)' : 'KHÔNG (Map-only job)', picked === 'reduce-merge' ? 'warn' : 'ok', 'Bỏ được Reducer khi join ở Map');
      s3.update(
        picked === 'broadcast' ? `1 block lớn + ${sz} MB nhỏ` :
        picked === 'part-hash' ? `1 block lớn + ${fmt(partSize, 0)} MB nhỏ` :
        picked === 'map-merge' ? 'Đọc tuần tự 2 phân vùng' : 'Đọc & Shuffle toàn bộ',
        'accent', 'Dựa vào cách bố trí vật lý'
      );
    }
    render();
  });

  // =====================================================================
  // 11.12 batch-output — Direct DB writes vs Immutable bulk files
  // =====================================================================
  widget('batch-output', (root) => {
    const mode = seg({
      label: 'Cách xuất đầu ra',
      options: [
        { value: 'immutable', label: 'Dựng file bất biến trên HDFS + Chuyển nguyên tử' },
        { value: 'direct', label: 'Ghi trực tiếp từng bản ghi vào DB Production' },
      ],
      value: 'immutable',
      onChange: render,
    });
    const fault = seg({
      label: 'Sự cố khi chạy Job v2',
      options: [
        { value: 'ok', label: 'Chạy suôn sẻ' },
        { value: 'crash', label: 'Job sập ở 50%' },
        { value: 'bug', label: 'Code v2 có bug (gợi ý sai)' },
      ],
      value: 'bug',
      onChange: render,
    });
    let rolledBack = false;
    const btnRollback = button('Trỏ con trỏ Server về lại bản v1 cũ (Rollback)', () => { rolledBack = true; render(); });
    const btnRunAgain = button('Chạy lại Job v2', () => { rolledBack = false; render(); }, 'ghost');

    const box = h('div', { class: 'box' });
    const s1 = stat('Độ trễ truy vấn của User', '–'), s2 = stat('Dữ liệu người dùng nhìn thấy', '–'), s3 = stat('Khôi phục sau lỗi (Rollback)', '–');

    root.append(
      h('div', { class: 'controls' }, mode.el, fault.el),
      h('div', { class: 'btn-row' }, btnRollback, btnRunAgain),
      box,
      h('div', { class: 'stats' }, s1, s2, s3)
    );

    function render() {
      const isImm = mode.value === 'immutable';
      const f = fault.value;

      if (isImm) {
        if (f === 'crash') {
          s1.update('Ổn định (2 ms)', 'ok', 'Không làm phiền DB đang phục vụ');
          s2.update('100% Bản v1 (Đúng)', 'ok', 'Thư mục /out/v2 dở dang bị bỏ qua');
          s3.update('Tự động hoàn toàn', 'ok', 'Chưa chuyển con trỏ sang v2');
          box.innerHTML = '<h5>File bất biến khi Job sập</h5><p>Job ghi vào thư mục tạm <code>/output/v2_tmp</code> trên HDFS. Khi sập ở 50%, các server Voldemort/HBase vẫn đang phục vụ file <code>/output/v1</code> nguyên vẹn.</p>';
        } else if (f === 'bug') {
          const showingV1 = rolledBack;
          s1.update('Ổn định (2 ms)', 'ok', 'Tách biệt hoàn toàn tải ghi batch');
          s2.update(showingV1 ? '100% Bản v1 (Đã khôi phục)' : 'Bản v2 (Bị lỗi logic)', showingV1 ? 'ok' : 'warn', showingV1 ? 'Đã trỏ lại về thư mục /output/v1' : 'Bấm nút Rollback bên trên để quay về v1');
          s3.update('Tức thời (< 1 giây)', 'ok', 'Human fault tolerance: file v1 cũ vẫn còn nguyên');
          box.innerHTML = `<h5>Khả năng chịu lỗi của con người (Human Fault Tolerance)</h5><p>${showingV1 ? 'Đã chuyển nguyên tử con trỏ phục vụ về lại thư mục <code>/output/v1</code>! Dữ liệu tốt phục hồi ngay lập tức.' : 'Phát hiện code v2 tính sai gợi ý! Vì file <code>/output/v1</code> cũ không hề bị ghi đè, hãy bấm nút <b>Rollback</b> để quay về v1 ngay.'}</p>`;
        } else {
          s1.update('Ổn định (2 ms)', 'ok', 'Nạp bulk-load tuần tự');
          s2.update('100% Bản v2 mới', 'ok', 'Chuyển đổi nguyên tử khi file hoàn tất');
          s3.update('Sẵn sàng (v1 được giữ lại)', 'ok', 'Có thể quay lui bất cứ lúc nào');
          box.innerHTML = '<h5>Hoàn tất nạp hàng loạt (Bulk Load)</h5><p>Job xây xong SSTable/index bất biến trên HDFS, các node tải về đĩa cục bộ và chuyển con trỏ nguyên tử sang v2.</p>';
        }
      } else {
        s1.update('Tăng vọt 450 ms!', 'bad', 'Hàng trăm mapper bắn request ghi làm nghẽn DB');
        if (f === 'crash') {
          s2.update('Nửa v1, nửa v2 (Hỗn tạp!)', 'bad', '50% bản ghi đã bị ghi đè trực tiếp');
          s3.update('Không thể tự phục hồi', 'bad', 'Phải khôi phục từ bản backup hôm qua');
          box.innerHTML = '<h5>Thảm hoạ ghi trực tiếp khi Job sập giữa chừng</h5><p>Các task đã ghi đè một nửa số dòng trong database production trước khi job sập. Người dùng nhìn thấy trạng thái nửa cũ nửa mới không nhất quán.</p>';
        } else if (f === 'bug') {
          s2.update('Dữ liệu gốc đã bị ghi đè sai!', 'bad', 'Rollback code không cứu được dữ liệu đã hỏng');
          s3.update('Rất khó & chậm', 'bad', 'Bản v1 cũ đã bị xoá đè tại chỗ');
          box.innerHTML = '<h5>Ghi đè tại chỗ làm mất đường lùi</h5><p>Dù bạn bấm Rollback hay deploy lại code v1, những dòng dữ liệu cũ trong DB đã bị ghi đè mất. Bạn buộc phải chạy lại job từ đầu và chờ hàng giờ.</p>';
        } else {
          s2.update('Chuyển dần từ v1 sang v2', 'warn', 'Trong lúc job chạy, người dùng thấy dữ liệu đang biến đổi');
          s3.update('Không có bản cũ tức thời', 'warn', 'Ghi đè trực tiếp (in-place mutation)');
          box.innerHTML = '<h5>Ghi trực tiếp từng bản ghi qua mạng</h5><p>Mỗi bản ghi tốn một vòng mạng tới DB, vừa chậm vừa làm ảnh hưởng trực tiếp tới truy vấn của người dùng thật.</p>';
        }
      }
    }
    render();
  });

  // =====================================================================
  // 11.13 preemption — Google Borg task preemption (5%/hr, 100 tasks)
  // =====================================================================
  widget('preemption', (root) => {
    const numTasksSl = slider({ label: 'Số lượng Task của Job', min: 20, max: 100, step: 10, value: 100, format: (v) => v + ' task', onInput: render });
    const riskSl = slider({ label: 'Rủi ro 1 task bị Preempt mỗi giờ', min: 1, max: 20, step: 1, value: 5, format: (v) => v + '% / giờ', onInput: render });
    let seed = 11;
    const btnSim = button('Chạy mô phỏng lần mới', () => { seed++; render(); });

    const cellsBox = h('div', { class: 'cells' });
    const s1 = stat('Xác suất ≥ 1 task bị huỷ', '–'), s2 = stat('Số task bị huỷ thực tế', '–'), s3 = stat('Chi phí làm lại (MapReduce vs MPP)', '–');

    root.append(
      h('div', { class: 'controls' }, numTasksSl.el, riskSl.el),
      h('div', { class: 'btn-row' }, btnSim),
      cellsBox,
      h('div', { class: 'stats' }, s1, s2, s3)
    );

    function render() {
      clear(cellsBox);
      const N = numTasksSl.value;
      const ratePerHr = riskSl.value / 100;
      // Each task runs 10 minutes = 1/6 hour
      const pTask = 1 - Math.pow(1 - ratePerHr, 1 / 6);
      const pJobAtLeastOne = 1 - Math.pow(1 - pTask, N);

      const r = rng(seed * 97 + N + riskSl.value);
      let killed = 0;
      for (let i = 0; i < N; i++) {
        const isKilled = r() < pTask;
        if (isKilled) killed++;
        cellsBox.appendChild(h('i', { class: isKilled ? 'killed' : '', title: isKilled ? `Task #${i + 1}: Bị Preempt — chạy lại riêng task này` : `Task #${i + 1}: Hoàn tất` }));
      }

      s1.update(pct(pJobAtLeastOne, 1), pJobAtLeastOne > 0.4 ? 'warn' : 'ok', `Mỗi task chạy 10 phút (${pct(pTask, 2)} rủi ro/task)`);
      s2.update(`${killed}/${N} task`, killed ? 'warn' : 'ok', 'Ô màu đỏ là task bị huỷ nhường máy');
      s3.update(killed ? `MR: làm lại ${killed} task · MPP: làm lại cả ${N} task!` : 'Không tốn làm lại', killed ? 'accent' : 'ok', 'Vì sao MapReduce phục hồi ở mức từng task');
    }
    render();
  });

  // =====================================================================
  // 11.14 dataflow — Materialization (MapReduce) vs Pipelined Dataflow (Spark/Flink)
  // =====================================================================
  widget('dataflow', (root) => {
    const stragSl = slider({ label: 'Độ chậm của 1 task lề mề (Straggler)', min: 0, max: 12, step: 2, value: 6, format: (v) => '+' + v + 's', onInput: render });
    const hasSort = checkbox('Giai đoạn 2 có bước Sắp xếp toàn cục (Sort barrier)', false, render);
    const nodeCrash = checkbox('1 máy hỏng ở Giai đoạn 2 (So sánh đọc lại HDFS vs tính lại theo RDD Lineage)', false, render);

    const svg = mkSvg(640, 205, 'So sánh thời gian thực thi của MapReduce và Dataflow Engine');
    const layer = s('g'); svg.appendChild(layer);
    const s1 = stat('Workflow MapReduce', '–'), s2 = stat('Dataflow Engine (Spark/Flink)', '–'), s3 = stat('Khi 1 máy hỏng', '–');

    root.append(
      h('div', { class: 'controls' }, stragSl.el),
      hasSort.el,
      nodeCrash.el,
      h('div', { class: 'viz' }, svg),
      h('div', { class: 'stats' }, s1, s2, s3)
    );

    function render() {
      clear(layer);
      const st = stragSl.value;
      const sort = hasSort.input.checked;
      const crash = nodeCrash.input.checked;

      // MapReduce always materializes 3x to HDFS between stages and waits for stragglers
      const mrS1 = 10 + st;
      const mrS2 = mrS1 + 10 + (crash ? 6 : 0);
      const mrS3 = mrS2 + 8;

      // Dataflow pipelines records immediately unless there's a sort barrier
      const dfS1 = 8 + st;
      const dfS2Start = sort ? dfS1 : 3;
      const dfS2End = Math.max(dfS1 + 3, dfS2Start + 8) + (crash ? 8 : 0);
      const dfS3End = dfS2End + 5;

      const X0 = 140, X1 = 620, TMAX = 50;
      const x = (t) => X0 + (t / TMAX) * (X1 - X0);

      layer.append(
        T(10, 42, 'MapReduce', 'lbl-strong sm'),
        T(10, 58, '(Ghi HDFS 3× mỗi bước)', 'sm f-ink3'),
        R(x(0), 28, x(mrS1) - x(0), 18, 'f-bad-soft s-bad', { rx: 3 }),
        R(x(mrS1), 50, x(mrS2) - x(mrS1), 18, 'f-bad-soft s-bad', { rx: 3 }),
        R(x(mrS2), 72, x(mrS3) - x(mrS2), 18, 'f-bad-soft s-bad', { rx: 3 }),

        T(10, 134, 'Dataflow Engine', 'lbl-strong sm'),
        T(10, 150, '(Truyền qua bộ nhớ/pipe)', 'sm f-ink3'),
        R(x(0), 120, x(dfS1) - x(0), 18, 'f-ok-soft s-ok', { rx: 3 }),
        R(x(dfS2Start), 142, x(dfS2End) - x(dfS2Start), 18, 'f-ok-soft s-ok', { rx: 3 }),
        R(x(dfS2End - 3), 164, x(dfS3End) - x(dfS2End - 3), 18, 'f-ok-soft s-ok', { rx: 3 })
      );

      for (let t = 0; t <= TMAX; t += 10) {
        layer.append(L(x(t), 16, x(t), 188, 'grid'), TM(x(t), 201, t + 's', 'sm'));
      }

      s1.update(mrS3 + ' giây', 'warn', 'Phải đợi task chậm nhất ở mọi rào cản job');
      s2.update(dfS3End + ' giây', 'ok', `Tiết kiệm ${mrS3 - dfS3End}s nhờ pipelining & bỏ mapper thừa`);
      s3.update(crash ? 'MR: đọc file tạm · Spark: tính lại theo Lineage' : 'Không có lỗi', crash ? 'accent' : 'ok',
        crash ? 'Toán tử trong Spark/Flink cần phải tất định!' : 'Bật hộp kiểm lỗi máy để so sánh');
    }
    render();
  });

  // =====================================================================
  // 11.15 pregel — Iterative PageRank with Bulk Synchronous Parallel (BSP)
  // =====================================================================
  widget('pregel', (root) => {
    // 5 vertices on 2 machines:
    // Edges: A->B, A->C, B->C, C->A, D->C, E->D, E->B
    const V = ['A', 'B', 'C', 'D', 'E'];
    const edges = {
      A: ['B', 'C'],
      B: ['C'],
      C: ['A'],
      D: ['C'],
      E: ['B', 'D'],
    };
    const pos = {
      A: [130, 65],
      B: [290, 55],
      C: [230, 155],
      D: [430, 155],
      E: [510, 65],
    };
    const machine = { A: 1, B: 1, C: 1, D: 2, E: 2 };
    let ranks = { A: 0.2, B: 0.2, C: 0.2, D: 0.2, E: 0.2 };
    let step = 0;
    let selV = 'C';

    function stepOnce() {
      const incoming = { A: 0, B: 0, C: 0, D: 0, E: 0 };
      V.forEach((u) => {
        const outs = edges[u];
        outs.forEach((v) => { incoming[v] += ranks[u] / outs.length; });
      });
      const d = 0.85, next = {};
      V.forEach((u) => { next[u] = (1 - d) / V.length + d * incoming[u]; });
      ranks = next;
      step++;
    }

    const btnNext = button('Superstep tiếp (+1 vòng)', () => { stepOnce(); render(); });
    const btnConv = button('Chạy tới hội tụ (15 vòng)', () => { for (let i = 0; i < 15; i++) stepOnce(); render(); }, 'ghost');
    const btnReset = button('Đặt lại (Superstep 0)', () => {
      ranks = { A: 0.2, B: 0.2, C: 0.2, D: 0.2, E: 0.2 };
      step = 0;
      render();
    }, 'ghost');

    const svg = mkSvg(640, 210, 'Đồ thị PageRank theo mô hình Pregel BSP');
    const layer = s('g'); svg.appendChild(layer);
    const s1 = stat('Superstep hiện tại', '–'), s2 = stat('Đỉnh đang chọn', '–'), s3 = stat('Tin nhắn qua mạng liên máy', '2 cạnh / vòng', 'warn', 'D→C và E→B đi từ Máy 2 sang Máy 1');

    root.append(
      h('div', { class: 'btn-row' }, btnNext, btnConv, btnReset),
      h('div', { class: 'viz' }, svg),
      h('div', { class: 'stats' }, s1, s2, s3)
    );

    function render() {
      clear(layer);
      // Machine partitions background
      layer.append(
        R(40, 15, 310, 180, 'f-accent-soft s-accent dash', { rx: 10 }),
        T(52, 34, 'Máy 1 (Giữ trạng thái đỉnh A, B, C)', 'sm lbl-strong f-accent'),
        R(370, 15, 230, 180, 'f-violet-soft s-violet dash', { rx: 10 }),
        T(382, 34, 'Máy 2 (Giữ đỉnh D, E)', 'sm lbl-strong f-violet')
      );

      // Draw edges
      V.forEach((u) => {
        const [x1, y1] = pos[u];
        edges[u].forEach((v) => {
          const [x2, y2] = pos[v];
          const cross = machine[u] !== machine[v];
          const msgVal = fmt(ranks[u] / edges[u].length, 3);
          layer.append(
            L(x1, y1, x2, y2, cross ? 's-warn sw2' : 's-ink3 sw15'),
            TM((x1 + x2) / 2, (y1 + y2) / 2 - 5, msgVal, 'sm ' + (v === selV ? 'f-ok lbl-strong' : 'f-ink3'))
          );
        });
      });

      // Draw vertices
      V.forEach((u) => {
        const [cx, cy] = pos[u];
        const r = 18 + ranks[u] * 26;
        const g = s('g', { style: { cursor: 'pointer' }, onClick: () => { selV = u; render(); } });
        g.append(
          C(cx, cy, r, (u === selV ? 'f-ok-soft s-ok sw2' : 'f-surface s-ink')),
          TM(cx, cy - 2, `Đỉnh ${u}`, 'sm lbl-strong'),
          TM(cx, cy + 12, fmt(ranks[u], 3), 'sm')
        );
        layer.append(g);
      });

      const inFrom = V.filter((u) => edges[u].includes(selV));
      s1.update('Vòng ' + step, 'accent', 'Checkpoint trạng thái ở cuối mỗi vòng');
      s2.update(`Đỉnh ${selV}: PR = ${fmt(ranks[selV], 3)}`, 'ok', `Nhận tin từ: ${inFrom.join(', ')}`);
    }
    render();
  });

  // =====================================================================
  // 11.16 optimizer — Opaque callbacks vs Declarative query optimizer
  // =====================================================================
  widget('optimizer', (root) => {
    const styleSeg = seg({
      label: 'Phong cách viết',
      options: [
        { value: 'decl', label: 'Khai báo (SQL / DataFrame API)' },
        { value: 'cb', label: 'Callback hộp đen (Hàm Java/Python tuỳ ý)' },
      ],
      value: 'decl',
      onChange: render,
    });
    const formatSeg = seg({
      label: 'Định dạng lưu trữ trên HDFS',
      options: [
        { value: 'parquet', label: 'Lưu theo cột (Parquet)' },
        { value: 'json', label: 'Văn bản theo dòng (JSON/CSV)' },
      ],
      value: 'parquet',
      onChange: render,
    });

    const planList = h('ul', { class: 'plan' });
    const s1 = stat('Dữ liệu phải đọc từ đĩa', '–'), s2 = stat('Tối ưu thứ tự Join', '–'), s3 = stat('Thực thi CPU', '–');

    root.append(
      h('div', { class: 'controls' }, styleSeg.el, formatSeg.el),
      planList,
      h('div', { class: 'stats' }, s1, s2, s3)
    );

    function render() {
      clear(planList);
      const isDecl = styleSeg.value === 'decl';
      const isCol = formatSeg.value === 'parquet';

      const steps = isDecl ? [
        { good: isCol, title: isCol ? '1. Column Pruning: Chỉ đọc 2/25 cột (user_id, country, url)' : '1. Đọc toàn bộ 25 cột vì file lưu theo dòng JSON', sub: isCol ? 'Giảm 90% lượng đọc đĩa nhờ Parquet' : 'Định dạng dòng không tách riêng cột được' },
        { good: true, title: '2. Predicate Pushdown: Lọc country = \'VN\' ngay khi đọc (còn 5% số dòng)', sub: 'Đẩy điều kiện lọc xuống trước bước Join để giảm trạng thái trung gian' },
        { good: true, title: '3. Cost-Based Join: Bảng Users sau khi lọc chỉ còn 40 MB → Tự chuyển sang Broadcast Hash Join!', sub: 'Không cần Shuffle bảng sự kiện khổng lồ qua mạng' },
        { good: true, title: '4. Vectorized Execution: Sinh bytecode chạy vòng lặp chặt trên mảng cột trong L1/L2 cache', sub: 'Tránh chi phí gọi hàm виртуаль/boxing trên từng bản ghi' },
      ] : [
        { good: false, title: '1. Đọc toàn bộ 25 cột của mọi bản ghi để dựng đối tượng truyền vào hàm callback', sub: 'Bộ tối ưu không biết bên trong hàm map(record) đọc những trường nào' },
        { good: false, title: '2. Không thể đẩy lọc xuống tầng lưu trữ', sub: 'Phải gọi hàm người dùng trên 100% số dòng' },
        { good: false, title: '3. Thực hiện Join theo đúng thứ tự viết tay trong code (Sort-Merge Join toàn bộ)', sub: 'Shuffle toàn bộ 500 GB qua mạng' },
      ];

      steps.forEach((st) => {
        planList.appendChild(h('li', { class: st.good ? 'good' : 'bad' }, st.title, h('small', st.sub)));
      });

      const readGB = isDecl ? (isCol ? 18 : 180) : (isCol ? 240 : 500);
      s1.update(readGB + ' GB / 500 GB', readGB < 50 ? 'ok' : 'warn', isDecl && isCol ? 'Kết hợp khai báo + lưu cột Parquet' : 'Đọc thừa các cột/dòng không cần');
      s2.update(isDecl ? 'Broadcast Join (Tự động)' : 'Cố định theo code', isDecl ? 'ok' : 'warn', isDecl ? 'CBO ước lượng kích thước sau khi lọc' : 'Người lập trình phải tự chọn');
      s3.update(isDecl ? 'Vector hoá (SIMD / Codegen)' : 'Gọi hàm từng bản ghi', isDecl ? 'ok' : 'bad', 'Khai báo cho phép engine tối ưu cấp thấp');
    }
    render();
  });

  // =====================================================================
  // Glossary for Chapter 11
  // =====================================================================
  glossary.add([
    { key: 'system-of-record', term: 'System of record (source of truth)', vi: 'Hệ thống gốc (nguồn chân lý)', ch: 11, topic: 'ch11-derived',
      def: 'Hệ thống giữ phiên bản chuẩn xác, có thẩm quyền của dữ liệu nơi mọi dữ liệu mới được ghi vào đầu tiên.' },
    { key: 'derived-data', term: 'Derived data', vi: 'Dữ liệu dẫn xuất', ch: 11, topic: 'ch11-derived',
      def: 'Dữ liệu được tính toán hoặc biến đổi từ một nguồn dữ liệu khác (như chỉ mục tìm kiếm, cache, materialized view, mô hình gợi ý); có thể xoá đi và tạo lại từ nguồn gốc.' },
    { key: 'online-system', term: 'Online system (service)', vi: 'Hệ thống trực tuyến (dịch vụ)', ch: 11, topic: 'ch11-derived',
      def: 'Hệ thống chờ yêu cầu từ client và cố gắng trả lời nhanh nhất có thể; được đo lường chủ yếu bằng thời gian phản hồi và tính sẵn sàng.' },
    { key: 'batch-job', term: 'Batch processing system (offline)', vi: 'Hệ thống xử lý theo lô', ch: 11, topic: 'ch11-derived',
      def: 'Hệ thống nhận một lượng lớn dữ liệu đầu vào có giới hạn (bounded), chạy không tương tác để tạo ra dữ liệu đầu ra; đo lường chủ yếu bằng thông lượng (throughput).' },
    { key: 'stream-processing', term: 'Stream processing (nearline)', vi: 'Xử lý luồng (cận thời gian thực)', ch: 11, topic: 'ch11-derived',
      def: 'Hệ thống tiêu thụ đầu vào không giới hạn (unbounded) và xử lý các sự kiện ngay sau khi chúng xảy ra với độ trễ thấp hơn nhiều so với batch.' },
    { key: 'unix-pipe', term: 'Unix pipe', vi: 'Đường ống dẫn Unix (pipe)', ch: 11, topic: 'ch11-unix-log',
      def: 'Cơ chế nối stdout của tiến trình này thẳng vào stdin của tiến trình tiếp theo thông qua bộ đệm trong bộ nhớ mà không cần ghi toàn bộ dữ liệu trung gian ra đĩa.' },
    { key: 'working-set', term: 'Working set', vi: 'Tập dữ liệu làm việc', ch: 11, topic: 'ch11-sort-vs-hash',
      def: 'Phần dữ liệu đang hoạt động mà thuật toán cần truy cập thường xuyên trong bộ nhớ (ví dụ: bảng băm giữ số lượng của mọi URL khác nhau).' },
    { key: 'external-sort', term: 'External mergesort', vi: 'Sắp xếp trộn ngoài', ch: 11, topic: 'ch11-sort-vs-hash',
      def: 'Thuật toán sắp xếp tập dữ liệu lớn hơn RAM bằng cách sắp từng khúc trong bộ nhớ, ghi ra đĩa thành các file segment đã sắp xếp rồi trộn tuần tự chúng lại.' },
    { key: 'unix-philosophy', term: 'Unix philosophy', vi: 'Triết lý thiết kế Unix', ch: 11, topic: 'ch11-unix-philosophy',
      def: 'Nguyên tắc thiết kế phần mềm của Doug McIlroy: viết những chương trình nhỏ làm thật tốt một việc và giao tiếp với nhau qua luồng văn bản chuẩn.' },
    { key: 'uniform-interface', term: 'Uniform interface', vi: 'Giao diện kết nối thống nhất', ch: 11, topic: 'ch11-unix-philosophy',
      def: 'Quy ước dữ liệu chung (như chuỗi byte/dòng văn bản ASCII trong Unix, hoặc file trên HDFS) cho phép hai chương trình bất kỳ ghép nối được với nhau.' },
    { key: 'mapreduce', term: 'MapReduce', vi: 'Mô hình xử lý lô MapReduce', ch: 11, topic: 'ch11-hdfs',
      def: 'Framework xử lý dữ liệu phân tán song song do Google công bố năm 2004, chia công việc thành hai pha callback không trạng thái: Map và Reduce, nối bằng bước sắp xếp/shuffle.' },
    { key: 'hdfs', term: 'HDFS (Hadoop Distributed File System)', vi: 'Hệ thống file phân tán Hadoop', ch: 11, topic: 'ch11-hdfs',
      def: 'Hệ thống file phân tán mã nguồn mở lấy cảm hứng từ Google File System (GFS), gom dung lượng đĩa của hàng nghìn máy thường thành một kho lưu trữ chung.' },
    { key: 'shared-nothing', term: 'Shared-nothing architecture', vi: 'Kiến trúc không chia sẻ phần cứng', ch: 11, topic: 'ch11-hdfs',
      def: 'Kiến trúc trong đó mỗi node có CPU, RAM và đĩa riêng độc lập, phối hợp với nhau hoàn toàn qua mạng thông thường.' },
    { key: 'namenode', term: 'NameNode', vi: 'Nút quản lý siêu dữ liệu HDFS', ch: 11, topic: 'ch11-hdfs',
      def: 'Dịch vụ trung tâm trong HDFS theo dõi xem mỗi file được chia thành những block nào và bản sao của từng block đang nằm trên những DataNode nào.' },
    { key: 'erasure-coding', term: 'Erasure coding', vi: 'Mã hoá xoá (Reed–Solomon)', ch: 11, topic: 'ch11-hdfs',
      def: 'Kỹ thuật bảo vệ dữ liệu phân tán cho phép khôi phục các khối bị mất với chi phí dung lượng lưu trữ thấp hơn nhiều so với nhân bản nguyên chiếc 3 lần.' },
    { key: 'mapper', term: 'Mapper', vi: 'Hàm ánh xạ (Mapper)', ch: 11, topic: 'ch11-mapreduce',
      def: 'Hàm callback được gọi một lần cho mỗi bản ghi đầu vào để trích xuất ra không, một hoặc nhiều cặp khoá–giá trị trung gian.' },
    { key: 'reducer', term: 'Reducer', vi: 'Hàm thu gọn (Reducer)', ch: 11, topic: 'ch11-mapreduce',
      def: 'Hàm callback nhận một khoá cùng bộ lặp duyệt qua toàn bộ các giá trị trung gian có cùng khoá đó để gộp hoặc join thành đầu ra.' },
    { key: 'data-locality', term: 'Data locality', vi: 'Đặt tính toán gần dữ liệu', ch: 11, topic: 'ch11-mapreduce',
      def: 'Nguyên tắc điều phối map task chạy ngay trên máy vật lý đang lưu trữ bản sao block file đầu vào để tiết kiệm băng thông mạng.' },
    { key: 'shuffle', term: 'Shuffle', vi: 'Pha phân vùng, sắp xếp và truyền mạng', ch: 11, topic: 'ch11-mapreduce',
      def: 'Quá trình trong MapReduce băm khoá đầu ra của mapper, sắp xếp trên đĩa cục bộ và truyền qua mạng về đúng reducer phụ trách khoá đó.' },
    { key: 'workflow-scheduler', term: 'Workflow scheduler', vi: 'Bộ lập lịch luồng công việc', ch: 11, topic: 'ch11-workflows',
      def: 'Công cụ (như Airflow, Luigi, Oozie, Azkaban) quản lý sự phụ thuộc giữa hàng chục job batch và kích hoạt job tiếp theo khi các đầu vào của nó đã hoàn tất.' },
    { key: 'sort-merge-join', term: 'Sort-merge join', vi: 'Kết nối sắp xếp–trộn', ch: 11, topic: 'ch11-reduce-join',
      def: 'Thuật toán join phía reducer trong đó mapper phát khoá join cho cả hai bảng, bước shuffle sắp xếp và gom mọi bản ghi cùng khoá về một lần gọi reducer.' },
    { key: 'secondary-sort', term: 'Secondary sort', vi: 'Sắp xếp phụ (bậc hai)', ch: 11, topic: 'ch11-reduce-join',
      def: 'Kỹ thuật sắp xếp thêm theo trường thứ hai sau khoá chính để đảm bảo reducer luôn nhận thấy bản ghi bảng nhỏ (ví dụ thông tin User) trước dòng sự kiện.' },
    { key: 'sessionization', term: 'Sessionization', vi: 'Gom nhóm theo phiên hoạt động', ch: 11, topic: 'ch11-group-by',
      def: 'Quá trình gom mọi sự kiện hoạt động của cùng một người dùng trong một khoảng thời gian về một chỗ để phân tích hành trình người dùng.' },
    { key: 'hot-key', term: 'Hot key (linchpin object)', vi: 'Khoá nóng (đối tượng tâm điểm)', ch: 11, topic: 'ch11-skew',
      def: 'Một giá trị khoá xuất hiện trong số lượng bản ghi nhiều đột biến (ví dụ tài khoản người nổi tiếng), gây lệch tải nặng nề lên một reducer duy nhất.' },
    { key: 'skewed-join', term: 'Skewed join', vi: 'Kết nối xử lý lệch dữ liệu', ch: 11, topic: 'ch11-skew',
      def: 'Kỹ thuật join chia nhỏ các bản ghi thuộc khoá nóng ra nhiều reducer ngẫu nhiên và nhân bản bản ghi tương ứng của bảng kia tới tất cả các reducer đó.' },
    { key: 'map-side-join', term: 'Map-side join', vi: 'Kết nối ngay tại phía Mapper', ch: 11, topic: 'ch11-map-join',
      def: 'Họ các thuật toán thực hiện join hoàn toàn trong map task mà không cần bước sắp xếp hay reducer, nhờ tận dụng tính chất kích thước hoặc cách phân vùng của đầu vào.' },
    { key: 'broadcast-hash-join', term: 'Broadcast hash join (replicated join)', vi: 'Kết nối băm phát quảng bá', ch: 11, topic: 'ch11-map-join',
      def: 'Thuật toán join phía map trong đó mỗi mapper đọc toàn bộ bảng nhỏ vào một bảng băm trong bộ nhớ rồi quét qua block bảng lớn của mình.' },
    { key: 'partitioned-hash-join', term: 'Partitioned hash join (bucketed map join)', vi: 'Kết nối băm đồng phân vùng', ch: 11, topic: 'ch11-map-join',
      def: 'Biến thể của hash join khi hai bảng đã được chia thành cùng số phân vùng bằng cùng khoá và hàm băm; mỗi mapper chỉ cần nạp đúng một phân vùng bảng nhỏ vào RAM.' },
    { key: 'map-side-merge-join', term: 'Map-side merge join', vi: 'Kết nối trộn phía Mapper', ch: 11, topic: 'ch11-map-join',
      def: 'Thuật toán join phía map khi cả hai bảng vừa đồng phân vùng vừa đã được sắp xếp sẵn theo khoá join, cho phép mapper đọc trộn tuần tự mà không tốn RAM.' },
    { key: 'inverted-index', term: 'Inverted index', vi: 'Chỉ mục đảo ngược', ch: 11, topic: 'ch11-output',
      def: 'Cấu trúc chỉ mục tìm kiếm toàn văn ánh xạ mỗi từ khoá sang danh sách các ID tài liệu (postings list) có chứa từ đó.' },
    { key: 'human-fault-tolerance', term: 'Human fault tolerance', vi: 'Khả năng chịu lỗi của con người', ch: 11, topic: 'ch11-output',
      def: 'Khả năng nhanh chóng khôi phục hệ thống khi lập trình viên vô tình deploy code có bug nhờ giữ nguyên đầu vào bất biến và các phiên bản file đầu ra cũ.' },
    { key: 'mpp-database', term: 'MPP (Massively Parallel Processing) database', vi: 'Cơ sở dữ liệu xử lý song song quy mô lớn', ch: 11, topic: 'ch11-hadoop-mpp',
      def: 'Kho dữ liệu phân tán chuyên chạy truy vấn SQL phân tích song song trên nhiều node (như Teradata, Vertica, Impala, Presto).' },
    { key: 'data-lake', term: 'Data lake', vi: 'Hồ dữ liệu thô', ch: 11, topic: 'ch11-hadoop-mpp',
      def: 'Kho lưu trữ tập trung (thường trên HDFS hoặc S3) giữ mọi dữ liệu ở định dạng gốc chưa qua chuẩn hoá để các đội tuỳ ý phân tích sau.' },
    { key: 'schema-on-read', term: 'Schema-on-read', vi: 'Áp lược đồ lúc đọc', ch: 11, topic: 'ch11-hadoop-mpp',
      def: 'Cách tiếp cận lưu dữ liệu thô trước mà không ép buộc schema cố định lúc ghi; việc diễn giải cấu trúc do từng chương trình đọc quyết định.' },
    { key: 'sushi-principle', term: 'Sushi principle', vi: 'Nguyên tắc sushi (dữ liệu thô tốt hơn)', ch: 11, topic: 'ch11-hadoop-mpp',
      def: 'Quan điểm rằng dữ liệu ở dạng nguyên bản, chưa qua biến đổi luôn giữ nhiều thông tin nhất để có thể tái phân tích theo những cách mới.' },
    { key: 'preemption', term: 'Task preemption', vi: 'Thu hồi tài nguyên ưu tiên (Preemption)', ch: 11, topic: 'ch11-hadoop-mpp',
      def: 'Hành động bộ lập lịch cụm chủ động giết một tác vụ batch ưu tiên thấp để nhường CPU/RAM ngay lập tức cho dịch vụ trực tuyến ưu tiên cao.' },
    { key: 'materialization', term: 'Materialization of intermediate state', vi: 'Hiện thực hoá trạng thái trung gian ra đĩa', ch: 11, topic: 'ch11-dataflow',
      def: 'Việc ghi trọn vẹn dữ liệu đầu ra tạm thời của một bước tính toán xuống hệ thống file phân tán trước khi bước tiếp theo được phép đọc.' },
    { key: 'straggler', term: 'Straggler task', vi: 'Tác vụ lề mề (chậm đuôi)', ch: 11, topic: 'ch11-dataflow',
      def: 'Một vài task cuối cùng của job chạy chậm hơn hẳn phần còn lại (do lệch dữ liệu hoặc tranh chấp tài nguyên máy), giữ chân toàn bộ các bước phía sau.' },
    { key: 'dataflow-engine', term: 'Dataflow engine', vi: 'Bộ máy thực thi luồng dữ liệu', ch: 11, topic: 'ch11-dataflow',
      def: 'Thế hệ hệ thống xử lý phân tán kế nhiệm MapReduce (Spark, Flink, Tez) biểu diễn toàn bộ workflow thành một đồ thị có hướng (DAG) các toán tử linh hoạt.' },
    { key: 'rdd', term: 'RDD (Resilient Distributed Dataset)', vi: 'Tập dữ liệu phân tán đàn hồi', ch: 11, topic: 'ch11-dataflow',
      def: 'Trừu tượng dữ liệu cốt lõi của Spark lưu lại lịch sử phép biến đổi (lineage) để tự động tính lại phân vùng bị mất khi một máy hỏng mà không cần nhân bản ra HDFS.' },
    { key: 'pagerank', term: 'PageRank', vi: 'Thuật toán xếp hạng trang PageRank', ch: 11, topic: 'ch11-pregel',
      def: 'Thuật toán đồ thị lặp tính mức độ quan trọng của mỗi đỉnh dựa trên trọng số của các đỉnh khác có cạnh trỏ tới nó.' },
    { key: 'pregel', term: 'Pregel (Bulk Synchronous Parallel — BSP)', vi: 'Mô hình xử lý đồ thị đồng bộ theo vòng Pregel', ch: 11, topic: 'ch11-pregel',
      def: 'Mô hình tính toán đồ thị phân tán theo từng vòng (superstep) trong đó mỗi đỉnh nhận tin nhắn từ vòng trước, cập nhật trạng thái trong bộ nhớ và gửi tin dọc theo cạnh ra.' },
    { key: 'cost-based-optimizer', term: 'Cost-based optimizer (CBO)', vi: 'Bộ tối ưu truy vấn dựa trên chi phí', ch: 11, topic: 'ch11-high-level',
      def: 'Thành phần của engine phân tích thống kê kích thước bảng để tự động chọn thứ tự join và thuật toán join (broadcast vs sort-merge) tốn ít I/O và mạng nhất.' },
    { key: 'vectorized-execution', term: 'Vectorized execution', vi: 'Thực thi vector hoá', ch: 11, topic: 'ch11-high-level',
      def: 'Kỹ thuật xử lý dữ liệu lưu theo cột bằng các vòng lặp chặt trên mảng liên tiếp trong bộ nhớ đệm CPU và lệnh SIMD thay vì gọi hàm trên từng bản ghi.' },
    { key: 'bounded-input', term: 'Bounded dataset', vi: 'Tập dữ liệu đầu vào hữu hạn', ch: 11, topic: 'ch11-review',
      def: 'Tập dữ liệu có kích thước cố định đã biết trước khi job bắt đầu, đối lập với luồng sự kiện không giới hạn (unbounded stream) ở Chương 12.' },
  ]);
})();
