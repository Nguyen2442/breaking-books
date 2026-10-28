/* Chương 4 — Storage and Retrieval (nguồn: ấn bản 1, Chương 3) */
(function () {
  'use strict';
  const { h, s, clear, fmt, fmtBig, pct, rng, clamp, sleep,
          slider, seg, button, checkbox, stat, log, widget, glossary, nextId } = window.DDIA;

  // ---------- shared helpers ----------
  const enc = new TextEncoder();
  const bytes = (str) => enc.encode(str).length;
  function fnv(str) { // FNV-1a 32-bit
    let x = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 0x01000193); }
    return x >>> 0;
  }
  const hex4 = (n) => (n & 0xffff).toString(16).padStart(4, '0');
  function fmtBytes(n) {
    const u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB'];
    let i = 0;
    while (Math.abs(n) >= 1000 && i < u.length - 1) { n /= 1000; i++; }
    return fmt(n, n < 10 && i > 0 ? 1 : 0) + ' ' + u[i];
  }
  function textCtl(label, value, opts) {
    opts = opts || {};
    const id = nextId('tx');
    const input = h('input', { type: 'text', id, value: String(value), spellcheck: 'false', autocomplete: 'off' });
    const el = h('div', { class: 'ctl' + (opts.narrow ? ' c4-narrow' : '') }, h('label', { for: id }, h('span', label)), input);
    if (opts.onEnter) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') opts.onEnter(); });
    return { el, input, get value() { return input.value.trim(); }, set(v) { input.value = v; } };
  }
  const boxEl = (title, ...kids) => h('div', { class: 'box' }, title ? h('h5', title) : null, ...kids);
  const pill = (txt, tone) => h('span', { class: 'pill' + (tone ? ' ' + tone : '') }, txt);
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  function svgEl(w, hgt, extra) { return s('svg', Object.assign({ viewBox: `0 0 ${w} ${hgt}`, role: 'img' }, extra || {})); }

  // =====================================================================
  // 4.1 — db_set / db_get bằng Bash
  // =====================================================================
  widget('simple-db', (root) => {
    let lines = [];
    let idx = new Map();
    let last = null; // {key, scanned:Set, hit, viaIdx}
    const key = textCtl('Khoá (key)', '42', { narrow: true, onEnter: () => doGet() });
    const val = textCtl('Giá trị (value)', '{"name":"San Francisco","attractions":["Exploratorium"]}');
    const useIdx = checkbox('Duy trì thêm một hash index trong RAM (khoá → byte offset)', false, () => { last = null; render(); });
    const file = h('div', { class: 'c4-file', 'aria-label': 'Nội dung file database' });
    const out = h('pre', { class: 'json c4-out' });
    const sRead = stat('Dòng phải đọc ở lần db_get gần nhất', '—');
    const sWrite = stat('Việc mỗi lần db_set', '1 append');
    const sN = stat('Số dòng trong file', '0');
    const sProj = stat('Nếu file có 1 triệu dòng', '—', null, 'chi phí một lần đọc');

    function offsetOf(i) { let o = 0; for (let j = 0; j < i; j++) o += bytes(lines[j].k + ',' + lines[j].v) + 1; return o; }
    function set(k, v) { idx.set(k, offsetOf(lines.length)); lines.push({ k, v }); }
    function doSet() {
      const k = key.value, v = val.value;
      if (!k || k.includes(',')) { out.textContent = 'Khoá không được rỗng hoặc chứa dấu phẩy.'; return; }
      set(k, v); last = null;
      out.textContent = `$ db_set ${k} '${v}'\n(đã append 1 dòng vào cuối file${useIdx.value ? ' và cập nhật hash index' : ''})`;
      render();
    }
    function doGet() {
      const k = key.value;
      if (useIdx.value) {
        const has = idx.has(k);
        const i = has ? lines.findIndex((l, j) => offsetOf(j) === idx.get(k)) : -1;
        last = { key: k, scanned: new Set(i >= 0 ? [i] : []), hit: i, viaIdx: true };
      } else {
        let hit = -1;
        const scanned = new Set();
        lines.forEach((l, i) => { scanned.add(i); if (l.k === k) hit = i; });
        last = { key: k, scanned, hit, viaIdx: false };
      }
      const r = last.hit >= 0 ? lines[last.hit].v : '(không có kết quả)';
      out.textContent = `$ db_get ${k}\n${r}`;
      render();
    }
    function addRandom() {
      const r = rng(lines.length * 7 + 3);
      for (let i = 0; i < 20; i++) set(String(100 + Math.floor(r() * 900)), `{"views":${Math.floor(r() * 5000)}}`);
      last = null; out.textContent = '(đã append 20 dòng ngẫu nhiên)'; render();
    }
    function reset() {
      lines = []; idx = new Map();
      set('123456', '{"name":"London","attractions":["Big Ben","London Eye"]}');
      set('42', '{"name":"San Francisco","attractions":["Golden Gate Bridge"]}');
      set('42', '{"name":"San Francisco","attractions":["Exploratorium"]}');
      key.set('42'); doGet();
    }
    function render() {
      clear(file);
      lines.forEach((l, i) => {
        const cl = ['c4-line'];
        if (last && last.scanned.has(i)) cl.push('scan');
        if (last && last.hit === i) cl.push('hit');
        file.appendChild(h('div', { class: cl.join(' ') }, h('span', { class: 'off' }, String(offsetOf(i))), h('span', { class: 'kv' }, l.k + ',' + l.v)));
      });
      sN.update(fmt(lines.length));
      const viaIdx = useIdx.value;
      sWrite.update(viaIdx ? '1 append + 1 cập nhật index' : '1 append', viaIdx ? 'warn' : 'ok', viaIdx ? 'ghi chậm hơn một chút' : 'nhanh nhất có thể');
      if (last) sRead.update(last.viaIdx ? '1 (seek thẳng tới offset)' : fmt(last.scanned.size), last.viaIdx ? 'ok' : (last.scanned.size > 10 ? 'bad' : 'warn'), last.viaIdx ? 'tra hash map trong RAM' : 'grep đọc từ đầu đến cuối file');
      else sRead.update('—', null, 'bấm “db_get” để đọc');
      sProj.update(viaIdx ? '1 seek' : '1.000.000 dòng', viaIdx ? 'ok' : 'bad', viaIdx ? 'O(1)' : 'O(n): gấp đôi dữ liệu, gấp đôi thời gian');
    }
    root.append(
      h('div', { class: 'controls' }, key.el, val.el),
      h('div', { class: 'btn-row' }, button('db_set', doSet), button('db_get', doGet, 'ghost'), button('Append 20 dòng ngẫu nhiên', addRandom, 'ghost'), button('Đặt lại', reset, 'ghost')),
      useIdx.el,
      h('div', { class: 'lab-split' }, boxEl('File “database” (byte offset · dòng)', file), boxEl('Terminal', out)),
      h('div', { class: 'stats' }, sRead, sWrite, sN, sProj),
    );
    reset();
  });

  // =====================================================================
  // 4.2 — Bitcask: log append-only + hash map trong RAM, segment, compaction, tombstone
  // =====================================================================
  widget('bitcask', (root) => {
    let maxRec = 4, segs = [], segSeq = 0, hilite = null;
    const lg = log(60);
    const key = textCtl('Khoá (video)', 'purr', { narrow: true, onEnter: () => doGet() });
    const val = textCtl('Giá trị (lượt xem)', '2110', { narrow: true });
    const size = seg({ label: 'Kích thước tối đa của một đoạn', options: [{ value: 3, label: '3 bản ghi' }, { value: 4, label: '4 bản ghi' }, { value: 5, label: '5 bản ghi' }], value: 4, onChange: (v) => { maxRec = v; reset(); } });
    const segWrap = h('div', { class: 'c4-segs' });
    const sSeg = stat('Số đoạn (segment)', '0');
    const sRec = stat('Bản ghi trên đĩa', '0');
    const sLive = stat('Khoá còn sống', '0');
    const sJunk = stat('Bản ghi cũ (rác)', '0%');

    function newSeg() { const sg = { id: ++segSeq, name: 'Đoạn ' + segSeq, recs: [], size: 0, idx: new Map() }; segs.push(sg); return sg; }
    function active() { return segs[segs.length - 1]; }
    function append(k, v, tomb) {
      let a = active();
      if (!a || a.recs.length >= maxRec) {
        if (a) lg.add(`${a.name} đầy → đóng băng (chỉ đọc). Mở ${'Đoạn ' + (segSeq + 1)} để ghi tiếp.`, 't');
        a = newSeg();
      }
      const line = k + ',' + (tomb ? '<tombstone>' : v);
      const rec = { k, v, tomb: !!tomb, off: a.size, sz: bytes(line) + 1 };
      a.recs.push(rec); a.size += rec.sz; a.idx.set(k, rec.off);
      return { seg: a, rec };
    }
    function latestMap() {
      const m = new Map();
      segs.forEach((sg) => sg.recs.forEach((r) => m.set(r.k, r)));
      return m;
    }
    function current(k) { const r = latestMap().get(k); return r && !r.tomb ? +r.v : null; }
    function doSet(k, v) {
      k = k || key.value; v = v != null ? v : val.value;
      if (!k || k.includes(',')) return;
      const { seg: sg, rec } = append(k, v, false);
      hilite = { seg: sg.id, off: rec.off, checked: [] };
      lg.add(`set ${k}=${v} → append vào ${sg.name} tại offset ${rec.off}; hash map[${k}] = ${rec.off}`, 'ok');
      render();
    }
    function doDel() {
      const k = key.value;
      const { seg: sg, rec } = append(k, null, true);
      hilite = { seg: sg.id, off: rec.off, checked: [] };
      lg.add(`delete ${k} → append bản ghi tombstone vào ${sg.name} tại offset ${rec.off}`, 'warn');
      render();
    }
    function doGet(k) {
      k = k || key.value;
      const checked = [];
      for (let i = segs.length - 1; i >= 0; i--) {
        const sg = segs[i];
        checked.push(sg.id);
        if (sg.idx.has(k)) {
          const off = sg.idx.get(k);
          const rec = sg.recs.find((r) => r.off === off);
          hilite = { seg: sg.id, off, checked };
          if (rec.tomb) lg.add(`get ${k}: hash map của ${sg.name} → offset ${off} là tombstone ⇒ khoá đã bị xoá`, 'warn');
          else lg.add(`get ${k}: kiểm tra ${checked.length} hash map, tìm thấy ở ${sg.name} offset ${off} → seek 1 lần, đọc ${rec.v}`, 'acc');
          render(); return;
        }
      }
      hilite = { seg: null, off: null, checked };
      lg.add(`get ${k}: đã kiểm tra hash map của cả ${checked.length} đoạn, không có khoá này`, 'bad');
      render();
    }
    function play() {
      const r = Math.random();
      const k = r < 0.45 ? 'purr' : r < 0.8 ? 'mew' : r < 0.93 ? 'yawn' : 'scratch';
      const cur = current(k);
      doSet(k, String((cur == null ? 0 : cur) + 1));
      key.set(k);
    }
    function compact() {
      const frozen = segs.slice(0, -1);
      if (!frozen.length) { lg.add('Chưa có đoạn nào bị đóng băng để gộp.', 't'); return; }
      const before = frozen.reduce((a, sg) => a + sg.recs.length, 0);
      const m = new Map();
      frozen.forEach((sg) => sg.recs.forEach((r) => { m.delete(r.k); m.set(r.k, r); }));
      const merged = { id: ++segSeq, name: frozen.length > 1 ? `Đoạn ${segSeq} (gộp ${frozen.map((x) => x.id).join('+')})` : `Đoạn ${segSeq} (nén ${frozen[0].id})`, recs: [], size: 0, idx: new Map(), merged: true };
      let dropped = 0;
      m.forEach((r) => {
        if (r.tomb) { dropped++; return; }
        const line = r.k + ',' + r.v;
        const nr = { k: r.k, v: r.v, tomb: false, off: merged.size, sz: bytes(line) + 1 };
        merged.recs.push(nr); merged.size += nr.sz; merged.idx.set(r.k, nr.off);
      });
      segs = [merged, active()];
      hilite = null;
      lg.add(`Compaction + merge: ${frozen.length} đoạn (${before} bản ghi) → 1 file mới (${merged.recs.length} bản ghi)${dropped ? `, bỏ ${dropped} khoá có tombstone` : ''}. Chuyển đọc sang file mới rồi xoá file cũ.`, 'ok');
      render();
    }
    function reset() {
      segs = []; segSeq = 0; lg.reset();
      const init = [['mew', 1078], ['purr', 2103], ['scratch', 252], ['purr', 2104], ['mew', 1079], ['mew', 1080], ['yawn', 511], ['purr', 2105], ['mew', 1081], ['purr', 2106], ['purr', 2107], ['yawn', 512], ['mew', 1082], ['purr', 2108]];
      init.forEach(([k, v]) => append(k, String(v), false));
      append('scratch', null, true);
      lg.add(`Đã nạp ${init.length + 1} lượt ghi mẫu (lượt xem video mèo, kèm 1 lệnh xoá “scratch”).`, 't');
      key.set('purr'); doGet('purr');
    }
    function render() {
      const latest = latestMap();
      clear(segWrap);
      let total = 0, stale = 0;
      [...segs].reverse().forEach((sg, ri) => {
        const isActive = sg === active();
        const cl = ['c4-seg'];
        if (isActive) cl.push('active');
        if (hilite && hilite.checked.includes(sg.id)) cl.push('checked');
        const recs = h('div', { class: 'c4-recs' });
        sg.recs.forEach((r) => {
          total++;
          const isLatest = latest.get(r.k) === r;
          if (!isLatest) stale++;
          const c = ['c4-line'];
          if (!isLatest) c.push('stale');
          if (r.tomb) c.push('tomb');
          if (hilite && hilite.seg === sg.id && hilite.off === r.off) c.push('hit');
          recs.appendChild(h('div', { class: c.join(' ') }, h('span', { class: 'off' }, String(r.off)), h('span', { class: 'kv' }, r.k + ',' + (r.tomb ? '␡ tombstone' : r.v))));
        });
        const hm = h('div', { class: 'c4-hash' }, h('span', { class: 'c4-mini' }, 'Hash map (RAM)'),
          ...[...sg.idx.entries()].map(([k, o]) => h('div', { class: 'c4-hrow' + (hilite && hilite.seg === sg.id && hilite.off === o ? ' hit' : '') }, h('span', k), h('span', { class: 'off' }, '→ ' + o))));
        segWrap.appendChild(h('div', { class: cl.join(' ') },
          h('div', { class: 'c4-seg-head' }, h('b', sg.name), isActive ? pill('đang ghi', 'accent') : pill(sg.merged ? 'đã gộp' : 'đóng băng'), ri === 0 ? null : null),
          recs, hm));
      });
      sSeg.update(fmt(segs.length), segs.length > 3 ? 'warn' : null, 'đọc phải xét tối đa ngần ấy hash map');
      sRec.update(fmt(total));
      const live = [...latest.values()].filter((r) => !r.tomb).length;
      sLive.update(fmt(live));
      sJunk.update(pct(total ? stale / total : 0, 0), stale / Math.max(1, total) > 0.4 ? 'warn' : 'ok', `${stale} bản ghi đã bị ghi đè hoặc xoá`);
    }
    root.append(
      h('div', { class: 'controls' }, key.el, val.el, h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Kích thước tối đa mỗi đoạn'), size.el)),
      h('div', { class: 'btn-row' }, button('Ghi (set)', () => doSet()), button('Đọc (get)', () => doGet(), 'ghost'), button('Xoá (tombstone)', doDel, 'ghost'), button('Phát 1 video ngẫu nhiên (+1)', play, 'ghost'), button('Gộp & nén các đoạn đã đóng', compact), button('Đặt lại', reset, 'ghost')),
      h('div', { class: 'viz' }, segWrap),
      h('p', { class: 'lab-note' }, 'Đoạn mới nhất ở bên trái. Viền vàng: hash map đã được kiểm tra trong lần đọc gần nhất. Gạch ngang: bản ghi đã bị một bản ghi mới hơn che khuất, chính là thứ compaction sẽ dọn.'),
      h('div', { class: 'stats' }, sSeg, sRec, sLive, sJunk),
      lg,
    );
    reset();
  });

  // =====================================================================
  // 4.2b — Crash recovery: checksum + hint file (snapshot hash map)
  // =====================================================================
  widget('crash-recovery', (root) => {
    const HDR = 12; // checksum(4) + timestamp(4) + độ dài khoá(2) + độ dài value(2): đơn giản hoá
    const KEYS = ['mew', 'purr', 'yawn', 'scratch', 'meow', 'hiss'];
    let segs, crashed, hm, seq, snap, lastRec;
    const lg = log(60);
    const vsz = slider({ label: 'Kích thước value trung bình', min: 20, max: 2000, step: 20, value: 400, format: (v) => v + ' B', onInput: () => { if (snap && lastRec) redo(false); render(); } });
    const mode = seg({ label: 'Cách khôi phục', options: [{ value: 'scan', label: 'Quét lại toàn bộ file' }, { value: 'hint', label: 'Nạp hint file (snapshot hash map)' }], value: 'hint', onChange: () => { if (snap && lastRec) redo(true); render(); } });
    const segWrap = h('div', { class: 'c4-segs' });
    const hmBox = h('div', { class: 'c4-hash c4-hash-wide' });
    const sRead = stat('Byte phải đọc khi khởi động', '—');
    const sKeys = stat('Khoá khôi phục được', '—');
    const sBad = stat('Bản ghi hỏng bị bỏ', '—');
    const btnCrash = button('Crash giữa lúc đang ghi', crash, 'danger');
    const btnRestart = button('Khởi động lại', () => { recover(true); render(); });
    const full = (r) => HDR + r.k.length + vsz.value + r.jit;
    const written = (r) => (r.partial ? Math.floor(full(r) * 0.55) : full(r));
    const hintSize = (sg) => sg.recs.reduce((a, r) => a + r.k.length + 12, 0);
    const copy = (x) => x.map((sg) => Object.assign({}, sg, { recs: sg.recs.map((r) => Object.assign({}, r)) }));

    function mk(partial) {
      const k = KEYS[(seq * 5 + 1) % KEYS.length];
      const r = { k, v: String(100 + seq * 3), jit: (seq % 5) * 7, partial: !!partial };
      r.crc = hex4(fnv(r.k + '|' + r.v));
      seq++;
      return r;
    }
    function doWrite() {
      if (crashed) { lg.add('Database đang dừng sau crash. Bấm “Khởi động lại” trước.', 'warn'); return; }
      const a = segs[segs.length - 1];
      const r = mk(false); a.recs.push(r); hm.set(r.k, { seg: a.id, i: a.recs.length - 1 });
      lg.add(`append ${r.k} (${full(r)} B, checksum ${r.crc}) vào đoạn đang ghi`, 'ok');
      snap = null; lastRec = null; render();
    }
    function crash() {
      if (crashed) return;
      const a = segs[segs.length - 1];
      const r = mk(true); a.recs.push(r);
      crashed = true; hm = null; lastRec = null; snap = copy(segs);
      lg.add(`Mất điện khi đang append ${r.k}: mới ghi được ${written(r)}/${full(r)} byte. Hash map trong RAM mất sạch.`, 'bad');
      render();
    }
    function recover(verbose) {
      if (!crashed) return;
      const m = mode.value;
      let read = 0, bad = 0;
      const nhm = new Map();
      if (verbose) lg.add(`Khởi động lại (${m === 'hint' ? 'nạp hint file của các đoạn đã đóng băng, chỉ quét đoạn đang ghi' : 'quét lại mọi file từ đầu đến cuối'})…`, 't');
      segs.forEach((sg, si) => {
        const isActive = si === segs.length - 1;
        if (m === 'hint' && !isActive) {
          read += hintSize(sg);
          sg.recs.forEach((r, i) => nhm.set(r.k, { seg: sg.id, i }));
          if (verbose) lg.add(`  ${sg.name}: đọc hint file ${fmtBytes(hintSize(sg))} (chỉ khoá + offset, không có value)`, 'acc');
        } else {
          let segRead = 0;
          sg.recs.forEach((r, i) => {
            segRead += written(r);
            if (r.partial) { bad++; if (verbose) lg.add(`  ${sg.name}: bản ghi ${r.k} có checksum không khớp (thiếu ${full(r) - written(r)} byte) → bỏ qua, cắt khỏi file`, 'warn'); return; }
            nhm.set(r.k, { seg: sg.id, i });
          });
          read += segRead;
          if (verbose) lg.add(`  ${sg.name}: quét ${fmtBytes(segRead)}`, 't');
        }
      });
      segs.forEach((sg) => { sg.recs = sg.recs.filter((r) => !r.partial); });
      hm = nhm; crashed = false;
      lastRec = { read, keys: nhm.size, bad, mode: m };
      if (verbose) lg.add(`Xong: hash map có ${nhm.size} khoá, đã đọc ${fmtBytes(read)} từ đĩa.`, 'ok');
    }
    // chạy lại lần khôi phục trên đúng trạng thái file ngay sau crash (để so sánh hai cách)
    function redo(verbose) { segs = copy(snap); crashed = true; recover(verbose); }
    function reset() {
      seq = 0; crashed = false; hm = new Map(); lastRec = null; snap = null; lg.reset();
      segs = [{ id: 1, name: 'Đoạn 1', recs: [] }, { id: 2, name: 'Đoạn 2', recs: [] }, { id: 3, name: 'Đoạn 3', recs: [] }];
      segs.forEach((sg, si) => { for (let j = 0; j < (si === 2 ? 3 : 5); j++) { const r = mk(false); sg.recs.push(r); hm.set(r.k, { seg: sg.id, i: sg.recs.length - 1 }); } });
      lg.add('Đã nạp 3 đoạn mẫu rồi gây crash và khởi động lại. Đổi “cách khôi phục” để so sánh trên cùng một lần crash.', 't');
      crash(); recover(true); render();
    }
    function render() {
      clear(segWrap);
      segs.forEach((sg, si) => {
        const isActive = si === segs.length - 1;
        const total = sg.recs.reduce((a, r) => a + written(r), 0);
        segWrap.appendChild(h('div', { class: 'c4-seg' + (isActive ? ' active' : '') },
          h('div', { class: 'c4-seg-head' }, h('b', sg.name), isActive ? pill('đang ghi', 'accent') : pill('có hint file')),
          h('div', { class: 'c4-mini' }, 'checksum · khoá · kích thước'),
          h('div', { class: 'c4-recs' }, sg.recs.map((r) => h('div', { class: 'c4-line' + (r.partial ? ' tomb' : '') },
            h('span', { class: 'off' }, r.crc), h('span', { class: 'kv' }, `${r.k} · ${r.partial ? written(r) + '/' + full(r) : full(r)} B${r.partial ? ' (dở dang)' : ''}`)))),
          h('div', { class: 'c4-mini' }, `File ${fmtBytes(total)}` + (isActive ? '' : ` · hint ${fmtBytes(hintSize(sg))}`))));
      });
      clear(hmBox);
      hmBox.appendChild(h('span', { class: 'c4-mini' }, 'Hash map trong RAM (khoá → đoạn, vị trí)'));
      if (!hm) hmBox.appendChild(h('div', { class: 'c4-empty' }, '(trống: RAM đã mất khi crash)'));
      else [...hm.entries()].sort((a, b) => cmp(a[0], b[0])).forEach(([k, p]) => hmBox.appendChild(h('div', { class: 'c4-hrow' }, h('span', k), h('span', { class: 'off' }, `→ đoạn ${p.seg}, #${p.i}`))));
      btnRestart.disabled = !crashed; btnCrash.disabled = crashed;
      if (lastRec) {
        sRead.update(fmtBytes(lastRec.read), lastRec.mode === 'hint' ? 'ok' : 'warn', lastRec.mode === 'hint' ? 'hint file + quét đoạn đang ghi' : 'đọc lại mọi value');
        sKeys.update(fmt(lastRec.keys), 'accent', '');
        sBad.update(fmt(lastRec.bad), lastRec.bad ? 'warn' : null, 'phát hiện nhờ checksum');
      } else { sRead.update('—', null, crashed ? 'chưa khởi động lại' : ''); sKeys.update(hm ? fmt(hm.size) : '0', null, ''); sBad.update('—', null, ''); }
    }
    root.append(
      h('div', { class: 'controls' }, vsz.el, h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Cách khôi phục hash map'), mode.el)),
      h('div', { class: 'btn-row' }, button('Ghi 1 bản ghi', doWrite, 'ghost'), btnCrash, btnRestart, button('Đặt lại', reset, 'ghost')),
      h('div', { class: 'viz' }, segWrap), hmBox,
      h('div', { class: 'stats' }, sRead, sKeys, sBad), lg,
    );
    reset();
  });

  // =====================================================================
  // 4.3a — Gộp các SSTable kiểu mergesort
  // =====================================================================
  widget('sstable-merge', (root) => {
    const SEGS = [
      { name: 'Đoạn 1 (cũ nhất)', recs: [['handbag', 8786], ['handful', 40308], ['handicap', 65995], ['handkerchief', 16324], ['handlebars', 3869], ['handprinted', 11150]] },
      { name: 'Đoạn 2', recs: [['handcuffs', 2729], ['handful', 42307], ['handicap', 67884], ['handiwork', 16912], ['handkerchief', 20952], ['handprinted', 15725]] },
      { name: 'Đoạn 3 (mới nhất)', recs: [['handful', 44662], ['handicap', 70836], ['handiwork', 45521], ['handlebars', 3869], ['handoff', 5741], ['handprinted', 33632]] },
    ];
    let ptr, out, state, running = false; // state[seg][i] = 'win' | 'lose'
    const lg = log(40);
    const cols = h('div', { class: 'c4-merge-in' });
    const outBox = h('div', { class: 'c4-recs' });
    const sOut = stat('Bản ghi đầu ra', '0');
    const sDrop = stat('Bản ghi cũ bị bỏ', '0');
    const sMem = stat('RAM cần cho việc gộp', '3 con trỏ', 'ok', 'không phụ thuộc kích thước file');
    const bStep = button('Bước tiếp', () => { step(); render(); });
    const bAll = button('Chạy hết', runAll, 'ghost');
    function done() { return ptr.every((p, i) => p >= SEGS[i].recs.length); }
    function step() {
      if (done()) return false;
      let min = null;
      ptr.forEach((p, i) => { if (p < SEGS[i].recs.length) { const k = SEGS[i].recs[p][0]; if (min == null || k < min) min = k; } });
      const holders = [];
      ptr.forEach((p, i) => { if (p < SEGS[i].recs.length && SEGS[i].recs[p][0] === min) holders.push(i); });
      const win = holders[holders.length - 1];
      holders.forEach((i) => { state[i][ptr[i]] = i === win ? 'win' : 'lose'; });
      const v = SEGS[win].recs[ptr[win]][1];
      out.push([min, v, win]);
      lg.add(holders.length > 1
        ? `“${min}” có ở ${holders.length} đoạn → giữ giá trị ${v} từ ${SEGS[win].name.replace(/ \(.*\)/, '')} (mới nhất), bỏ ${holders.length - 1} bản cũ`
        : `“${min}” là khoá nhỏ nhất ở đầu các đoạn → chép sang đầu ra`, holders.length > 1 ? 'warn' : 'ok');
      holders.forEach((i) => ptr[i]++);
      if (done()) lg.add('Xong: đoạn mới đã sắp xếp, mỗi khoá xuất hiện đúng một lần.', 'acc');
      return true;
    }
    async function runAll() {
      if (running) return; running = true; bStep.disabled = bAll.disabled = true;
      while (step()) { render(); await sleep(260); }
      running = false; render();
    }
    function reset() { ptr = [0, 0, 0]; out = []; state = SEGS.map((sg) => sg.recs.map(() => null)); lg.reset(); for (let i = 0; i < 3; i++) step(); render(); }
    function render() {
      clear(cols);
      SEGS.forEach((sg, si) => {
        cols.appendChild(h('div', { class: 'c4-seg' + (si === 2 ? ' active' : '') }, h('div', { class: 'c4-seg-head' }, h('b', sg.name)),
          h('div', { class: 'c4-recs' }, sg.recs.map(([k, v], i) => h('div', {
            class: 'c4-line' + (state[si][i] === 'win' ? ' used' : state[si][i] === 'lose' ? ' stale' : i === ptr[si] ? ' head' : ''),
          }, h('span', { class: 'kv' }, k), h('span', { class: 'off' }, String(v)))))));
      });
      clear(outBox);
      out.forEach(([k, v, from]) => outBox.appendChild(h('div', { class: 'c4-line used' }, h('span', { class: 'kv' }, k), h('span', { class: 'off' }, `${v} · từ đoạn ${from + 1}`))));
      if (!out.length) outBox.appendChild(h('div', { class: 'c4-empty' }, '(chưa có)'));
      sOut.update(fmt(out.length));
      sDrop.update(fmt(state.flat().filter((x) => x === 'lose').length), 'warn');
      if (!running) { bStep.disabled = done(); bAll.disabled = done(); }
    }
    root.append(
      h('div', { class: 'btn-row' }, bStep, bAll, button('Làm lại', reset, 'ghost')),
      h('div', { class: 'viz' }, cols),
      h('p', { class: 'lab-note' }, 'Viền vàng: khoá đang đứng đầu mỗi đoạn. Mỗi bước chọn khoá nhỏ nhất trong các đầu đoạn; nếu nhiều đoạn có cùng khoá thì đoạn mới nhất thắng.'),
      boxEl('Đoạn mới sau khi gộp (vẫn sắp xếp theo khoá)', outBox),
      h('div', { class: 'stats' }, sOut, sDrop, sMem), lg,
    );
    reset();
  });

  // =====================================================================
  // 4.3b — Sparse index trên một SSTable
  // =====================================================================
  widget('sparse-index', (root) => {
    const KEYS = ['handbag', 'handball', 'handbook', 'handbrake', 'handcart', 'handcuffs', 'handful', 'handgun', 'handheld', 'handicap', 'handicraft', 'handiwork', 'handkerchief', 'handlebars', 'handmade', 'handoff', 'handout', 'handover', 'handprint', 'handrail', 'handsaw', 'handset', 'handshake', 'handsome', 'handstand', 'handwriting', 'handy'].sort(cmp);
    const r = rng(33);
    const recs = []; let o = 0;
    KEYS.forEach((k) => { const v = String(1000 + Math.floor(r() * 90000)); const sz = k.length + v.length + 4; recs.push({ k, v, off: o, sz }); o += sz; });
    const every = slider({ label: 'Một mục index cho mỗi … bản ghi', min: 1, max: 9, value: 4, format: (v) => v + (v === 1 ? ' (index đầy đủ)' : ''), onInput: () => run() });
    const q = textCtl('Tìm khoá', 'handiwork', { narrow: true, onEnter: () => run() });
    const comp = checkbox('Nén từng block trước khi ghi (tỉ lệ nén ~40%, số liệu minh hoạ)', false, () => run());
    const idxBox = h('div', { class: 'c4-recs' });
    const fileBox = h('div', { class: 'c4-recs' });
    const msg = h('p', { class: 'c4-msg' });
    const sIdx = stat('Mục index trong RAM', '0');
    const sCmp = stat('So sánh trên index', '0');
    const sScan = stat('Bản ghi phải quét trên đĩa', '0');
    const sDisk = stat('Byte đọc từ đĩa', '0');
    function run() {
      const n = every.value, target = q.value;
      const blocks = [];
      for (let i = 0; i < recs.length; i += n) blocks.push(recs.slice(i, i + n));
      const index = blocks.map((b, bi) => ({ k: b[0].k, off: b[0].off, bi }));
      // binary search: last index entry with key <= target
      let lo = 0, hi = index.length - 1, pos = -1, comps = 0; const probed = new Set();
      while (lo <= hi) { const mid = (lo + hi) >> 1; comps++; probed.add(mid); if (index[mid].k <= target) { pos = mid; lo = mid + 1; } else hi = mid - 1; }
      const scanned = new Set(); let found = null;
      if (pos >= 0) {
        for (const rc of blocks[pos]) { scanned.add(rc.k); if (rc.k === target) { found = rc; break; } if (rc.k > target) break; }
      }
      const blockBytes = pos >= 0 ? blocks[pos].reduce((a, x) => a + x.sz, 0) : 0;
      const diskBytes = Math.round(blockBytes * (comp.value ? 0.4 : 1));
      clear(idxBox);
      index.forEach((e, i) => idxBox.appendChild(h('div', { class: 'c4-line' + (i === pos ? ' hit' : probed.has(i) ? ' scan' : '') }, h('span', { class: 'kv' }, e.k), h('span', { class: 'off' }, '→ ' + e.off))));
      clear(fileBox);
      blocks.forEach((b, bi) => {
        const bsz = b.reduce((a, x) => a + x.sz, 0);
        fileBox.appendChild(h('div', { class: 'c4-block' + (bi === pos ? ' on' : '') },
          h('div', { class: 'c4-mini' }, `Block ${bi + 1} · ${bsz} B` + (comp.value ? ` → nén còn ~${Math.round(bsz * 0.4)} B` : '')),
          b.map((rc) => h('div', { class: 'c4-line' + (found === rc ? ' hit' : scanned.has(rc.k) ? ' scan' : '') }, h('span', { class: 'off' }, String(rc.off)), h('span', { class: 'kv' }, rc.k + ' : ' + rc.v)))));
      });
      if (pos < 0) msg.textContent = `“${target}” nhỏ hơn khoá đầu tiên của file → chắc chắn không có, khỏi đọc đĩa.`;
      else if (found) msg.textContent = `“${target}” nằm giữa “${index[pos].k}” và ${index[pos + 1] ? '“' + index[pos + 1].k + '”' : 'cuối file'} → nhảy tới offset ${index[pos].off}, quét ${scanned.size} bản ghi và tìm thấy giá trị ${found.v}.`;
      else msg.textContent = `Quét block bắt đầu ở “${index[pos].k}” mà không gặp “${target}” → khoá không có trong file này.`;
      sIdx.update(`${index.length} / ${recs.length}`, n > 1 ? 'ok' : 'warn', n > 1 ? 'index thưa' : 'mỗi khoá một mục');
      sCmp.update(fmt(comps));
      sScan.update(fmt(scanned.size), scanned.size > 5 ? 'warn' : null);
      sDisk.update(diskBytes + ' B', comp.value ? 'ok' : null, comp.value ? 'đọc 1 block nén rồi giải nén' : 'đọc 1 block');
    }
    root.append(
      h('div', { class: 'controls' }, q.el, every.el),
      h('div', { class: 'btn-row' }, button('Tìm', run), ...['handiwork', 'handsome', 'handle', 'handy', 'aardvark'].map((k) => button(k, () => { q.set(k); run(); }, 'ghost'))),
      comp.el,
      h('div', { class: 'lab-split c4-split-13' }, boxEl('Sparse index (RAM)', idxBox), boxEl('File SSTable trên đĩa (đã sắp xếp)', fileBox)),
      msg, h('div', { class: 'stats' }, sIdx, sCmp, sScan, sDisk),
    );
    run();
  });
