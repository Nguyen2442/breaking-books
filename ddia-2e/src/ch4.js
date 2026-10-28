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

  // ---------- Bloom filter helpers ----------
  function bloomPos(key, m, k) {
    const h1 = fnv(key), h2 = (fnv('#' + key + '!') | 1) >>> 0;
    const out = [];
    for (let i = 0; i < k; i++) out.push((h1 + Math.imul(i, h2) >>> 0) % m);
    return out;
  }
  function bitsEl(bits, probe, cls) {
    return h('div', { class: 'c4-bits' + (cls ? ' ' + cls : '') }, [...bits].map((b, i) => h('span', {
      class: 'c4-bit' + (b ? ' on' : '') + (probe && probe.includes(i) ? (b ? ' probe' : ' probe miss') : ''),
      title: 'bit ' + i,
    }, cls === 'big' ? String(i) : '')));
  }

  // =====================================================================
  // 4.4a — LSM-tree: memtable → SSTable, đường đọc, Bloom filter, compaction, WAL
  // =====================================================================
  widget('lsm', (root) => {
    const M = 32, K = 2, TOMB = '␡';
    let mem, wal, segs, segSeq, trace, threshold = 4;
    const lg = log(60);
    const key = textCtl('Khoá', 'dung', { narrow: true, onEnter: () => doGet() });
    const val = textCtl('Giá trị', '42', { narrow: true });
    const th = slider({ label: 'Ngưỡng flush memtable', min: 2, max: 6, value: 4, format: (v) => v + ' khoá', onInput: (v) => { threshold = v; } });
    const useBloom = checkbox('Dùng Bloom filter cho mỗi SSTable', true, () => { if (trace) doGet(trace.key, true); else render(); });
    const memBox = h('div', { class: 'c4-recs' });
    const walBox = h('div', { class: 'c4-recs' });
    const segWrap = h('div', { class: 'c4-segs' });
    const sDisk = stat('SSTable phải đọc từ đĩa', '—');
    const sSkip = stat('SSTable bỏ qua nhờ Bloom', '—');
    const sRes = stat('Kết quả', '—');
    const sSeg = stat('Số SSTable', '0');

    function mkSeg(entries) {
      const bits = new Uint8Array(M);
      entries.forEach(([k]) => bloomPos(k, M, K).forEach((p) => { bits[p] = 1; }));
      return { id: ++segSeq, recs: entries, bits };
    }
    function flush(auto) {
      if (!mem.size) { lg.add('Memtable đang rỗng.', 't'); return; }
      const entries = [...mem.entries()].sort((a, b) => cmp(a[0], b[0]));
      const sg = mkSeg(entries);
      segs.push(sg);
      lg.add(`${auto ? 'Memtable chạm ngưỡng → ' : ''}flush ${entries.length} khoá (đã sắp xếp sẵn) thành SSTable ${sg.id}. Bỏ WAL cũ, mở memtable mới.`, 'acc');
      mem = new Map(); wal = [];
    }
    function put(k, v, quiet) {
      wal.push([k, v]); mem.set(k, v);
      if (!quiet) lg.add(`${v === TOMB ? 'delete' : 'put'} ${k}${v === TOMB ? '' : '=' + v}: append vào WAL, chèn vào memtable`, v === TOMB ? 'warn' : 'ok');
      if (mem.size >= threshold) flush(true);
    }
    function doPut() { const k = key.value; if (!k) return; put(k, val.value || '0'); trace = null; render(); }
    function doDel() { const k = key.value; if (!k) return; put(k, TOMB); trace = null; render(); }
    function doGet(k, quiet) {
      k = k || key.value;
      const steps = [];
      let result = null, where = null, disk = 0, skipped = 0, fp = 0;
      if (mem.has(k)) { result = mem.get(k); where = 'memtable'; steps.push({ id: 'mem', st: 'hit' }); }
      else {
        steps.push({ id: 'mem', st: 'miss' });
        for (let i = segs.length - 1; i >= 0; i--) {
          const sg = segs[i];
          const probe = bloomPos(k, M, K);
          if (useBloom.value && probe.some((p) => !sg.bits[p])) { steps.push({ id: sg.id, st: 'skip', probe }); skipped++; continue; }
          disk++;
          const rec = sg.recs.find((r) => r[0] === k);
          if (rec) { steps.push({ id: sg.id, st: 'hit', probe }); result = rec[1]; where = 'SSTable ' + sg.id; break; }
          if (useBloom.value) fp++;
          steps.push({ id: sg.id, st: 'miss', probe });
        }
      }
      trace = { key: k, steps };
      const found = result != null && result !== TOMB;
      sRes.update(found ? String(result) : result === TOMB ? 'đã xoá' : 'không có', found ? 'ok' : 'warn', where ? 'tìm thấy ở ' + where : 'đã xét hết');
      sDisk.update(fmt(disk), disk > 1 ? 'warn' : 'ok', fp ? `${fp} lần Bloom báo nhầm (false positive)` : 'mỗi lần là một lần đọc đĩa');
      sSkip.update(useBloom.value ? fmt(skipped) : 'tắt', useBloom.value && skipped ? 'accent' : null, useBloom.value ? 'Bloom nói “chắc chắn không có”' : '');
      if (!quiet) lg.add(`get ${k}: memtable → ${steps.slice(1).map((x) => 'SST' + x.id + (x.st === 'skip' ? '(bỏ qua)' : x.st === 'hit' ? '(thấy)' : '(đọc, không có)')).join(' → ') || '(không cần đọc đĩa)'} ⇒ ${found ? result : result === TOMB ? 'tombstone: đã xoá' : 'không tồn tại'}`, found ? 'acc' : 'warn');
      render();
    }
    function compact() {
      if (segs.length < 2) { lg.add('Cần ít nhất 2 SSTable để gộp.', 't'); return; }
      const m = new Map();
      segs.forEach((sg) => sg.recs.forEach(([k, v]) => m.set(k, v)));
      let dropped = 0;
      const entries = [...m.entries()].filter(([, v]) => (v === TOMB ? (dropped++, false) : true)).sort((a, b) => cmp(a[0], b[0]));
      const before = segs.reduce((a, sg) => a + sg.recs.length, 0);
      const n = segs.length;
      segs = [mkSeg(entries)];
      lg.add(`Compaction: gộp ${n} SSTable (${before} bản ghi) → 1 SSTable (${entries.length} bản ghi)${dropped ? `, xoá hẳn ${dropped} khoá có tombstone` : ''}.`, 'ok');
      trace = null; render();
    }
    function crash() {
      const lost = mem.size;
      mem = new Map();
      lg.add(`Crash! Memtable (${lost} khoá) mất cùng RAM. Khởi động lại: đọc WAL (${wal.length} bản ghi) để dựng lại memtable…`, 'bad');
      wal.forEach(([k, v]) => mem.set(k, v));
      lg.add(`Đã khôi phục ${mem.size} khoá vào memtable. Không mất gì.`, 'ok');
      trace = null; render();
    }
    function reset() {
      mem = new Map(); wal = []; segs = []; segSeq = 0; trace = null; lg.reset();
      threshold = 4; th.set(4);
      [['binh', 10], ['lan', 7], ['an', 3], ['minh', 5], ['khoa', 2], ['binh', 11], ['son', 9], ['chi', 4], ['lan', 8], ['tam', 1], ['an', TOMB], ['hoa', 6], ['minh', 6], ['vy', 2]]
        .forEach(([k, v]) => put(k, String(v), true));
      lg.add('Đã ghi 14 lệnh mẫu: 3 SSTable trên đĩa, 2 khoá còn trong memtable. Đang tra “dung” (không tồn tại).', 't');
      key.set('dung'); doGet('dung', true);
    }
    function render() {
      const st = (id) => (trace ? trace.steps.find((x) => x.id === id) : null);
      clear(memBox);
      const ms = st('mem');
      [...mem.entries()].sort((a, b) => cmp(a[0], b[0])).forEach(([k, v]) => memBox.appendChild(h('div', { class: 'c4-line' + (trace && ms && ms.st === 'hit' && trace.key === k ? ' hit' : '') + (v === TOMB ? ' tomb' : '') }, h('span', { class: 'kv' }, k), h('span', { class: 'off' }, v))));
      if (!mem.size) memBox.appendChild(h('div', { class: 'c4-empty' }, '(rỗng)'));
      memBox.parentElement && memBox.parentElement.classList.toggle('checked', !!ms);
      clear(walBox);
      wal.forEach(([k, v]) => walBox.appendChild(h('div', { class: 'c4-line' }, h('span', { class: 'kv' }, k), h('span', { class: 'off' }, v))));
      if (!wal.length) walBox.appendChild(h('div', { class: 'c4-empty' }, '(rỗng)'));
      clear(segWrap);
      [...segs].reverse().forEach((sg, i) => {
        const x = st(sg.id);
        const cl = ['c4-seg'];
        if (x && x.st === 'skip') cl.push('skipped');
        else if (x) cl.push('checked');
        segWrap.appendChild(h('div', { class: cl.join(' ') },
          h('div', { class: 'c4-seg-head' }, h('b', 'SSTable ' + sg.id), i === 0 ? pill('mới nhất', 'accent') : null,
            x ? pill(x.st === 'skip' ? 'Bloom: bỏ qua' : x.st === 'hit' ? 'tìm thấy' : 'đọc đĩa: không có', x.st === 'skip' ? 'violet' : x.st === 'hit' ? 'ok' : 'warn') : null),
          h('div', { class: 'c4-recs' }, sg.recs.map(([k, v]) => h('div', { class: 'c4-line' + (x && x.st === 'hit' && trace.key === k ? ' hit' : '') + (v === TOMB ? ' tomb' : '') }, h('span', { class: 'kv' }, k), h('span', { class: 'off' }, v)))),
          useBloom.value ? h('div', null, h('span', { class: 'c4-mini' }, `Bloom filter (${M} bit, ${K} hàm băm)`), bitsEl(sg.bits, x ? x.probe : null)) : null));
      });
      sSeg.update(fmt(segs.length), segs.length > 3 ? 'warn' : null, 'bấm “Compaction” để gộp');
    }
    const memWrap = boxEl('Memtable (RAM, cây cân bằng đã sắp xếp)', memBox);
    root.append(
      h('div', { class: 'controls' }, key.el, val.el, th.el),
      h('div', { class: 'btn-row' }, button('Ghi (put)', doPut), button('Đọc (get)', () => doGet(), 'ghost'), button('Xoá', doDel, 'ghost'), button('Flush memtable', () => { flush(false); trace = null; render(); }, 'ghost'), button('Compaction', compact, 'ghost'), button('Crash & khôi phục', crash, 'danger'), button('Đặt lại', reset, 'ghost')),
      useBloom.el,
      h('div', { class: 'lab-split' }, memWrap, boxEl('WAL trên đĩa (append-only, chưa sắp xếp)', walBox)),
      h('div', { class: 'c4-mini' }, 'SSTable trên đĩa, mới nhất bên trái. Đường đọc: memtable → SSTable mới nhất → … → cũ nhất.'),
      h('div', { class: 'viz' }, segWrap),
      h('div', { class: 'stats' }, sRes, sDisk, sSkip, sSeg), lg,
    );
    memWrap.classList.add('c4-memwrap');
    reset();
  });

  // =====================================================================
  // 4.4b — Bloom filter riêng
  // =====================================================================
  widget('bloom', (root) => {
    let keys = ['handbag', 'handful', 'handicap', 'handiwork', 'handoff'];
    const m = slider({ label: 'Số bit (m)', min: 16, max: 64, step: 8, value: 32, onInput: () => render() });
    const k = slider({ label: 'Số hàm băm (k)', min: 1, max: 4, value: 2, onInput: () => render() });
    const add = textCtl('Thêm khoá vào tập', 'handsome', { narrow: true, onEnter: () => doAdd() });
    const q = textCtl('Kiểm tra khoá', 'handle', { narrow: true, onEnter: () => render() });
    const bitsWrap = h('div');
    const keyList = h('div', { class: 'c4-chips' });
    const verdict = h('p', { class: 'c4-msg' });
    const sFill = stat('Tỉ lệ bit đã bật', '—');
    const sTheory = stat('Xác suất báo nhầm (lý thuyết)', '—');
    const sMeas = stat('Báo nhầm khi thử 1.000 khoá lạ', '—');
    function doAdd() { const x = add.value; if (x && !keys.includes(x)) keys.push(x); render(); }
    function render() {
      const M = m.value, K = k.value;
      const bits = new Uint8Array(M);
      keys.forEach((x) => bloomPos(x, M, K).forEach((p) => { bits[p] = 1; }));
      const probe = bloomPos(q.value, M, K);
      const maybe = probe.every((p) => bits[p]);
      const really = keys.includes(q.value);
      clear(bitsWrap); bitsWrap.appendChild(bitsEl(bits, probe, 'big'));
      clear(keyList); keys.forEach((x) => keyList.appendChild(h('button', { type: 'button', class: 'pill accent c4-chip', title: 'Bỏ khỏi tập', onClick: () => { keys = keys.filter((y) => y !== x); render(); } }, x + ' ×')));
      verdict.innerHTML = '';
      verdict.append(`“${q.value}” → bit ${probe.join(', ')}: `,
        maybe ? (really ? pill('có thể có, và thật sự có', 'ok') : pill('có thể có, nhưng thật ra KHÔNG có (báo nhầm)', 'bad')) : pill('chắc chắn không có: khỏi đọc đĩa', 'violet'));
      const n = keys.length;
      const fill = bits.reduce((a, b) => a + b, 0) / M;
      sFill.update(pct(fill, 0), fill > 0.6 ? 'warn' : null, `${n} khoá trong ${M} bit`);
      const theory = Math.pow(1 - Math.exp(-K * n / M), K);
      sTheory.update(pct(theory, 1), theory > 0.1 ? 'warn' : 'ok', '(1 − e^(−kn/m))^k');
      let fp = 0; const r = rng(7);
      for (let i = 0; i < 1000; i++) { const x = 'zz' + Math.floor(r() * 1e9).toString(36); if (bloomPos(x, M, K).every((p) => bits[p])) fp++; }
      sMeas.update(pct(fp / 1000, 1), fp > 100 ? 'warn' : 'ok', `${fp} lần đọc đĩa thừa`);
    }
    root.append(
      h('div', { class: 'controls' }, m.el, k.el),
      h('div', { class: 'controls' }, add.el, h('div', { class: 'btn-row' }, button('Thêm', doAdd, 'ghost')), q.el, h('div', { class: 'btn-row' }, button('Kiểm tra', render))),
      h('div', null, h('span', { class: 'c4-mini' }, 'Tập khoá (bấm để bỏ):'), keyList),
      h('div', { class: 'viz' }, bitsWrap),
      verdict,
      h('div', { class: 'stats' }, sFill, sTheory, sMeas),
      h('p', { class: 'lab-note' }, 'Ô viền vàng: các bit mà khoá đang kiểm tra được băm vào. Chỉ cần một bit trong số đó là 0 là khoá chắc chắn không có.'),
    );
    render();
  });

  // =====================================================================
  // 4.5a — B-tree: chèn có tách trang, đường tra cứu, branching factor, sức chứa
  // =====================================================================
  widget('btree', (root) => {
    const INIT = [100, 200, 300, 400, 500, 210, 230, 250, 251, 270, 280, 310, 333, 345, 360, 120, 150, 180, 50, 20, 410, 450, 480, 520, 600, 255, 290];
    let maxKeys = 5, tree, inserted, lastPath = [], lastKey = null, lastSplit = [], lastFound = null, nid = 0;
    const lg = log(40);
    const q = textCtl('Khoá (số)', '251', { narrow: true, onEnter: () => lookup() });
    const fan = seg({ label: 'Số khoá tối đa mỗi trang', options: [3, 4, 5].map((v) => ({ value: v, label: `${v} khoá (branching ${v + 1})` })), value: 5, onChange: (v) => { maxKeys = v; rebuild(); lookup(lastKey != null ? lastKey : 251, true); } });
    const vizWrap = h('div', { class: 'viz' });
    const sDepth = stat('Độ sâu', '—');
    const sPages = stat('Số trang', '—');
    const sRead = stat('Trang đọc khi tra cứu', '—');
    const sSplit = stat('Trang bị tách (lần chèn cuối)', '—');
    const newNode = (leaf, keys, children) => ({ id: ++nid, leaf, keys, children: children || [] });
    const childIdx = (n, k) => { let i = 0; while (i < n.keys.length && k >= n.keys[i]) i++; return i; };
    function insert(k) {
      const path = []; let n = tree;
      while (!n.leaf) { const i = childIdx(n, k); path.push(n); n = n.children[i]; }
      if (n.keys.includes(k)) return null;
      n.keys.push(k); n.keys.sort((a, b) => a - b);
      const split = [];
      let node = n;
      while (node.keys.length > maxKeys) {
        let right, sep;
        if (node.leaf) {
          const mid = Math.ceil(node.keys.length / 2);
          right = newNode(true, node.keys.slice(mid)); node.keys = node.keys.slice(0, mid); sep = right.keys[0];
        } else {
          const mid = Math.floor(node.keys.length / 2);
          sep = node.keys[mid];
          right = newNode(false, node.keys.slice(mid + 1), node.children.slice(mid + 1));
          node.keys = node.keys.slice(0, mid); node.children = node.children.slice(0, mid + 1);
        }
        split.push(node.id, right.id);
        const parent = path.pop();
        if (!parent) { tree = newNode(false, [sep], [node, right]); split.push(tree.id); break; }
        const i = parent.children.indexOf(node);
        parent.keys.splice(i, 0, sep); parent.children.splice(i + 1, 0, right);
        node = parent;
      }
      inserted.push(k);
      return split;
    }
    function rebuild() { nid = 0; tree = newNode(true, []); const ks = inserted.slice(); inserted = []; ks.forEach((k) => insert(k)); lastSplit = []; }
    function pathTo(k) { const p = []; let n = tree; p.push(n.id); while (!n.leaf) { n = n.children[childIdx(n, k)]; p.push(n.id); } return { ids: p, leaf: n }; }
    function doInsert(k, quiet) {
      k = k != null ? k : parseInt(q.value, 10);
      if (!Number.isFinite(k) || k < 0 || k > 999) { lg.add('Nhập số nguyên từ 0 đến 999.', 'warn'); return; }
      const split = insert(k);
      if (split == null) { if (!quiet) lg.add(`${k} đã có trong cây.`, 't'); lookup(k, true); return; }
      lastSplit = split; lastKey = k;
      const p = pathTo(k); lastPath = p.ids; lastFound = true;
      if (!quiet) lg.add(split.length ? `Chèn ${k}: trang lá đầy → tách thành hai trang nửa đầy, cập nhật trang cha${split.length > 2 ? ' (tách lan lên trên' + (tree.id === split[split.length - 1] ? ', cây cao thêm một tầng' : '') + ')' : ''}.` : `Chèn ${k}: trang lá còn chỗ, chỉ ghi lại đúng trang đó.`, split.length ? 'warn' : 'ok');
      render();
    }
    function lookup(k, quiet) {
      k = k != null ? k : parseInt(q.value, 10);
      if (!Number.isFinite(k)) return;
      const p = pathTo(k); lastPath = p.ids; lastKey = k; lastFound = p.leaf.keys.includes(k); lastSplit = [];
      if (!quiet) lg.add(`Tra ${k}: đọc ${p.ids.length} trang từ gốc xuống lá → ${lastFound ? 'tìm thấy' : 'không có'}.`, lastFound ? 'acc' : 'warn');
      render();
    }
    function randomIns() { const r = Math.random; let c = 0; for (let t = 0; t < 30 && c < 5; t++) { const k = Math.floor(r() * 1000); if (!inserted.includes(k)) { doInsert(k, true); c++; } } lg.add(`Đã chèn 5 khoá ngẫu nhiên. Cây có ${inserted.length} khoá.`, 't'); render(); }
    function reset() { inserted = INIT.slice(); rebuild(); lg.reset(); q.set('251'); lookup(251, true); lg.add('Cây mẫu: 27 khoá, tối đa 5 khoá/trang (branching factor 6 như Hình 3-6). Đang tra 251.', 't'); }
    function render() {
      const levels = [];
      (function walk(n, d) { (levels[d] = levels[d] || []).push(n); n.children.forEach((c) => walk(c, d + 1)); })(tree, 0);
      const CW = 26, PADX = 6, GAP = 12, LH = 70, TOP = 14;
      const pw = maxKeys * CW + PADX * 2 - 2;
      const pos = new Map();
      const leaves = levels[levels.length - 1];
      leaves.forEach((n, i) => pos.set(n.id, 8 + i * (pw + GAP)));
      for (let d = levels.length - 2; d >= 0; d--) levels[d].forEach((n) => { const a = pos.get(n.children[0].id), b = pos.get(n.children[n.children.length - 1].id); pos.set(n.id, (a + b) / 2); });
      const W = Math.max(360, 16 + leaves.length * (pw + GAP)), H = TOP + levels.length * LH;
      const svg = svgEl(W, H, { 'aria-label': 'Sơ đồ B-tree' });
      svg.style.minWidth = Math.min(W, Math.max(0, W * 0.72)) + 'px';
      const onPath = new Set(lastPath);
      levels.forEach((lv, d) => lv.forEach((n) => {
        if (n.leaf) return;
        n.children.forEach((c, ci) => {
          const x1 = pos.get(n.id) + PADX + ci * CW - 1, y1 = TOP + d * LH + 26;
          const x2 = pos.get(c.id) + pw / 2, y2 = TOP + (d + 1) * LH;
          const hot = onPath.has(n.id) && onPath.has(c.id);
          svg.appendChild(s('line', { x1, y1, x2, y2, class: (hot ? 's-mark' : 's-line') + ' f-none', 'stroke-width': hot ? 2.5 : 1.2 }));
        });
      }));
      levels.forEach((lv, d) => lv.forEach((n) => {
        const x = pos.get(n.id), y = TOP + d * LH;
        const hot = onPath.has(n.id), sp = lastSplit.includes(n.id);
        const g = s('g', { class: 'node' });
        g.appendChild(s('rect', { x, y, width: pw, height: 26, rx: 4, class: (hot ? 'f-mark-soft s-mark' : sp ? 'f-violet-soft s-violet' : 'f-surface s-ink3') }));
        for (let i = 0; i < maxKeys; i++) {
          const kx = x + PADX + i * CW;
          const kv = n.keys[i];
          if (i > 0) g.appendChild(s('line', { x1: kx - 1, y1: y + 4, x2: kx - 1, y2: y + 22, class: 's-line f-none' }));
          if (kv != null) {
            const isT = kv === lastKey && n.leaf && hot && lastFound;
            if (isT) g.appendChild(s('rect', { x: kx, y: y + 3, width: CW - 2, height: 20, rx: 3, class: 'f-mark' }));
            g.appendChild(s('text', { x: kx + CW / 2 - 1, y: y + 17, 'text-anchor': 'middle', class: isT || !n.leaf ? 'lbl-strong' : '' }, String(kv)));
          } else g.appendChild(s('text', { x: kx + CW / 2 - 1, y: y + 17, 'text-anchor': 'middle', class: 'f-ink3' }, '·'));
        }
        svg.appendChild(g);
      }));
      levels.forEach((lv, d) => svg.appendChild(s('text', { x: 2, y: TOP + d * LH - 3, class: 'f-ink3' }, d === 0 ? 'gốc' : d === levels.length - 1 ? 'lá' : 'tầng ' + d)));
      clear(vizWrap).appendChild(svg);
      const pages = levels.reduce((a, lv) => a + lv.length, 0);
      sDepth.update(fmt(levels.length) + ' tầng', null, `${inserted.length} khoá`);
      sPages.update(fmt(pages), null, `mỗi trang ≤ ${maxKeys} khoá`);
      sRead.update(fmt(lastPath.length), 'accent', lastKey != null ? `tra ${lastKey}: ${lastFound ? 'thấy' : 'không có'}` : '');
      sSplit.update(fmt(lastSplit.length ? lastSplit.length - 1 : 0), lastSplit.length ? 'warn' : null, lastSplit.length ? 'tím: trang vừa tạo/ghi lại khi tách' : '');
    }
    // capacity calculator
    const b = slider({ label: 'Branching factor', min: 2, max: 1000, value: 500, onInput: () => cap() });
    const dpt = slider({ label: 'Số tầng', min: 1, max: 6, value: 4, onInput: () => cap() });
    const psz = seg({ label: 'Kích thước trang', options: [{ value: 4096, label: '4 KB' }, { value: 8192, label: '8 KB' }, { value: 16384, label: '16 KB' }], value: 4096, onChange: () => cap() });
    const sCap = stat('Dữ liệu tối đa', '—', 'accent');
    const sLeaf = stat('Số trang lá', '—');
    function cap() {
      const leaves = Math.pow(b.value, dpt.value);
      sCap.update(fmtBytes(leaves * psz.value), 'accent', `${fmt(b.value)}^${dpt.value} trang × ${psz.value / 1024} KB`);
      sLeaf.update(fmtBig(leaves), null, `chỉ cần đọc ${dpt.value} trang để tới bất kỳ lá nào`);
    }
    root.append(
      h('div', { class: 'controls' }, q.el, h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Số khoá tối đa mỗi trang'), fan.el)),
      h('div', { class: 'btn-row' }, button('Tra cứu', () => lookup()), button('Chèn khoá', () => doInsert(), 'ghost'), button('Chèn 5 khoá ngẫu nhiên', randomIns, 'ghost'), button('Đặt lại', reset, 'ghost')),
      vizWrap,
      h('p', { class: 'lab-note' }, 'Vàng: các trang đọc trên đường từ gốc xuống lá. Tím: các trang vừa bị tách hoặc ghi lại ở lần chèn cuối. Dấu “·” là chỗ trống trong trang.'),
      h('div', { class: 'stats' }, sDepth, sPages, sRead, sSplit), lg,
      boxEl('Máy tính sức chứa: một B-tree chứa được bao nhiêu?',
        h('div', { class: 'controls' }, b.el, dpt.el, h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Kích thước trang'), psz.el)),
        h('div', { class: 'stats' }, sCap, sLeaf)),
    );
    reset(); cap();
  });

  // =====================================================================
  // 4.5b — B-tree crash giữa lúc tách trang: không WAL / có WAL / copy-on-write
  // =====================================================================
  widget('btree-wal', (root) => {
    const BEFORE = [110, 150, 210, 230, 251, 270, 310, 350];
    const AFTER = BEFORE.concat([260]).sort((a, b) => a - b);
    const MODES = {
      nowal: { label: 'Ghi đè, không WAL', ops: [
        { t: 'Ghi đè trang L1 := [210, 230]', f: (d) => { d.L1 = { keys: [210, 230] }; } },
        { t: 'Ghi trang mới L3 := [251, 260, 270]', f: (d) => { d.L3 = { keys: [251, 260, 270] }; } },
        { t: 'Ghi đè trang cha P := [200 | 251 | 300]', f: (d) => { d.P = { keys: [200, 251, 300], ch: ['L0', 'L1', 'L3', 'L2'] }; } },
      ] },
      wal: { label: 'Ghi đè + WAL', ops: [
        { t: 'Append vào WAL: “chèn 260 → tách L1 thành L1 + L3, sửa P” (fsync)', f: (d) => { d.wal = true; } },
        { t: 'Ghi đè trang L1 := [210, 230]', f: (d) => { d.L1 = { keys: [210, 230] }; } },
        { t: 'Ghi trang mới L3 := [251, 260, 270]', f: (d) => { d.L3 = { keys: [251, 260, 270] }; } },
        { t: 'Ghi đè trang cha P := [200 | 251 | 300]', f: (d) => { d.P = { keys: [200, 251, 300], ch: ['L0', 'L1', 'L3', 'L2'] }; } },
      ] },
      cow: { label: 'Copy-on-write (kiểu LMDB)', ops: [
        { t: 'Ghi trang mới L4 := [210, 230] (L1 giữ nguyên)', f: (d) => { d.L4 = { keys: [210, 230] }; } },
        { t: 'Ghi trang mới L5 := [251, 260, 270]', f: (d) => { d.L5 = { keys: [251, 260, 270] }; } },
        { t: 'Ghi trang cha mới P2 := [200 | 251 | 300]', f: (d) => { d.P2 = { keys: [200, 251, 300], ch: ['L0', 'L4', 'L5', 'L2'] }; } },
        { t: 'Đổi con trỏ gốc → P2 (một lần ghi nguyên tử)', f: (d) => { d.root = 'P2'; } },
      ] },
    };
    const mode = seg({ label: 'Chiến lược', options: Object.entries(MODES).map(([value, m]) => ({ value, label: m.label })), value: 'nowal', onChange: () => { crashAt.input.max = MODES[mode.value].ops.length; render(); } });
    const crashAt = slider({ label: 'Mất điện sau khi hoàn tất … thao tác ghi', min: 0, max: 3, value: 1, format: (v) => v === MODES[mode.value].ops.length ? v + ' (không crash)' : String(v), onInput: () => render() });
    const opsBox = h('ol', { class: 'c4-ops' });
    const diskBox = h('div', { class: 'c4-disk' });
    const verdict = h('div', { class: 'c4-msg' });
    const sReach = stat('Khoá đọc được sau khởi động', '—');
    const sLost = stat('Khoá bị mất', '—');
    const sOrphan = stat('Trang mồ côi', '—');
    function init() { return { root: 'P', wal: false, P: { keys: [200, 300], ch: ['L0', 'L1', 'L2'] }, L0: { keys: [110, 150] }, L1: { keys: [210, 230, 251, 270] }, L2: { keys: [310, 350] } }; }
    function reach(d) {
      const seen = new Set(), keys = [];
      (function walk(id) { const p = d[id]; if (!p) return; seen.add(id); if (p.ch) p.ch.forEach(walk); else keys.push(...p.keys); })(d.root);
      return { seen, keys: keys.sort((a, b) => a - b) };
    }
    function render() {
      const m = MODES[mode.value];
      const n = Math.min(crashAt.value, m.ops.length);
      crashAt.set(n);
      const d = init();
      m.ops.slice(0, n).forEach((o) => o.f(d));
      const crashed = n < m.ops.length;
      // recovery
      let rec = '';
      if (mode.value === 'wal' && crashed && d.wal) { m.ops.slice(1).forEach((o) => o.f(d)); rec = 'Khởi động lại: đọc WAL, thấy thao tác tách trang chưa hoàn tất → làm lại (redo) cả ba lần ghi trang.'; }
      else if (mode.value === 'wal' && crashed) rec = 'Khởi động lại: WAL không có bản ghi này → coi như lệnh chèn chưa từng xảy ra (client chưa nhận xác nhận).';
      else if (mode.value === 'cow' && crashed) rec = 'Khởi động lại: con trỏ gốc vẫn trỏ vào P cũ → cây cũ còn nguyên vẹn; các trang mới ghi dở chỉ là rác, được thu hồi.';
      else if (crashed) rec = 'Khởi động lại: không có gì để đối chiếu. Database đọc thẳng các trang như đang nằm trên đĩa.';
      else rec = 'Không có crash: cả lần tách trang hoàn tất.';
      const r = reach(d);
      const pageIds = Object.keys(d).filter((x) => /^[PL]/.test(x));
      const orphans = pageIds.filter((x) => !r.seen.has(x) && !(mode.value === 'cow' && ['P', 'L1'].includes(x) && d.root === 'P2'));
      const garbage = mode.value === 'cow' ? pageIds.filter((x) => !r.seen.has(x)) : [];
      const okBefore = r.keys.join() === BEFORE.join(), okAfter = r.keys.join() === AFTER.join();
      const lost = BEFORE.filter((x) => !r.keys.includes(x));
      clear(opsBox);
      m.ops.forEach((o, i) => opsBox.appendChild(h('li', { class: i < n ? 'done' : i === n ? 'crash' : 'todo' }, h('span', { class: 'c4-mini' }, i < n ? 'đã ghi' : i === n ? 'mất điện ở đây' : 'chưa chạy'), ' ', o.t)));
      clear(diskBox);
      diskBox.appendChild(h('div', { class: 'c4-page root' }, h('b', 'Con trỏ gốc'), ' → ' + d.root));
      const draw = (id) => {
        const p = d[id];
        const cl = ['c4-page'];
        if (r.seen.has(id)) cl.push('live'); else if (mode.value === 'cow' ? garbage.includes(id) : true) cl.push(orphans.includes(id) ? 'orphan' : 'garbage');
        return h('div', { class: cl.join(' ') }, h('b', id), ' ', p.ch ? `[${p.ch.map((c, i) => (i ? p.keys[i - 1] + ' | ' : '') + c).join(' ')}]` : `[${p.keys.join(', ')}]`,
          !r.seen.has(id) ? h('span', { class: 'c4-mini' }, orphans.includes(id) ? ' mồ côi' : ' rác, thu hồi được') : null);
      };
      diskBox.appendChild(h('div', { class: 'c4-row' }, pageIds.filter((x) => x[0] === 'P').map(draw)));
      diskBox.appendChild(h('div', { class: 'c4-row' }, pageIds.filter((x) => x[0] === 'L').sort().map(draw)));
      if (mode.value === 'wal') diskBox.appendChild(h('div', { class: 'c4-page' + (d.wal ? ' live' : '') }, h('b', 'WAL'), d.wal ? ' có bản ghi “chèn 260”' : ' (chưa có bản ghi)'));
      const good = okBefore || okAfter;
      verdict.innerHTML = '';
      verdict.append(rec + ' ', good ? pill(okAfter ? 'Nhất quán: có 260' : 'Nhất quán: như trước lệnh chèn', 'ok') : pill('Index hỏng', 'bad'));
      sReach.update(r.keys.join(', '), good ? 'ok' : 'bad');
      sLost.update(lost.length ? lost.join(', ') : 'không', lost.length ? 'bad' : 'ok');
      sOrphan.update(orphans.length ? orphans.join(', ') : 'không', orphans.length ? 'bad' : 'ok');
    }
    root.append(
      h('div', { class: 'controls' }, h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Cách ghi'), mode.el), crashAt.el),
      h('p', { class: 'lab-note' }, 'Tình huống: lá L1 = [210, 230, 251, 270] đã đầy (tối đa 4 khoá). Chèn 260 buộc phải tách L1 và sửa trang cha P, tức là nhiều lần ghi trang riêng biệt.'),
      h('div', { class: 'lab-split' }, boxEl('Các thao tác ghi', opsBox), boxEl('Trạng thái đĩa sau khi khởi động lại', diskBox)),
      verdict, h('div', { class: 'stats' }, sReach, sLost, sOrphan),
    );
    crashAt.input.max = 3;
    render();
  });

  // =====================================================================
  // 4.6a — So sánh LSM-tree và B-tree: khuếch đại ghi, thông lượng, chi phí đọc
  // =====================================================================
  widget('write-amp', (root) => {
    const rec = slider({ label: 'Kích thước bản ghi', min: 50, max: 2000, step: 50, value: 100, format: (v) => v + ' B', onInput: () => render() });
    const data = slider({ label: 'Dung lượng dữ liệu', min: 0, max: 4, step: 1, value: 3, format: (v) => ['1 GB', '10 GB', '100 GB', '1 TB', '10 TB'][v], onInput: () => render() });
    const page = seg({ label: 'Trang B-tree', options: [{ value: 4096, label: '4 KB' }, { value: 16384, label: '16 KB' }], value: 4096, onChange: () => render() });
    const disk = seg({ label: 'Ổ đĩa', options: [{ value: 'hdd', label: 'HDD' }, { value: 'ssd', label: 'SSD' }], value: 'hdd', onChange: () => render() });
    const comp = seg({ label: 'Kiểu compaction', options: [{ value: 'leveled', label: 'Leveled' }, { value: 'tiered', label: 'Size-tiered' }], value: 'leveled', onChange: () => render() });
    const dbl = checkbox('B-tree ghi mỗi trang hai lần để chống ghi dở (kiểu doublewrite của InnoDB)', false, () => render());
    const bloom = checkbox('LSM dùng Bloom filter (1% báo nhầm)', true, () => render());
    const chart = h('div', { class: 'viz' });
    const tbl = h('div', { class: 'table-wrap' });
    const DISK = { hdd: { bw: 150e6, iops: 150 }, ssd: { bw: 500e6, iops: 50000 } };
    function render() {
      const R = rec.value, P = page.value, D = Math.pow(10, data.value) * 1e9, T = 10, MEM = 64e6;
      const L = Math.max(1, Math.ceil(Math.log10(D / MEM)));
      // B-tree: WAL + cả trang (trường hợp xấu: mỗi ghi làm bẩn một trang khác)
      const btWA = 1 + (P / R) * (dbl.value ? 2 : 1);
      const lsmWA = comp.value === 'leveled' ? 2 + (L - 1) * T / 2 : 2 + (L - 1);
      const dk = DISK[disk.value];
      const btPagesPerWrite = dbl.value ? 2 : 1;
      const btTput = Math.min(dk.bw / (R * btWA), dk.iops / btPagesPerWrite);
      const lsmTput = dk.bw / (R * lsmWA);
      const fanout = Math.floor(P / 24);
      const btDepth = Math.max(1, Math.ceil(Math.log(D / P) / Math.log(fanout)) + 1);
      const btReads = Math.max(1, btDepth - 2); // các tầng trên thường nằm trong cache
      const tables = comp.value === 'leveled' ? 4 + (L - 1) : 4 * L;
      const lsmMiss = bloom.value ? tables * 0.01 : tables;
      const lsmHit = bloom.value ? 1 + (tables - 1) * 0.01 : (tables + 1) / 2;
      const space = { bt: 1.45, lsm: comp.value === 'leveled' ? 1.1 : 2 };
      const rows = [
        ['Khuếch đại ghi (byte ghi xuống đĩa / byte ứng dụng ghi)', fmt(btWA, 1) + '×', fmt(lsmWA, 1) + '×', lsmWA < btWA],
        ['Số lượt ghi tối đa mỗi giây (ổ ' + disk.value.toUpperCase() + ')', fmtBig(btTput), fmtBig(lsmTput), lsmTput > btTput],
        ['Đọc đĩa khi tra 1 khoá có tồn tại (trung bình)', fmt(btReads, 1), fmt(lsmHit, 2), lsmHit < btReads],
        ['Đọc đĩa khi tra 1 khoá không tồn tại', fmt(btReads, 1), fmt(lsmMiss, 2), lsmMiss < btReads],
        ['Dung lượng đĩa / dữ liệu thật (phân mảnh, bản cũ)', fmt(space.bt, 2) + '×', fmt(space.lsm, 2) + '×', space.lsm < space.bt],
      ];
      clear(tbl).appendChild(h('table', { class: 'data' },
        h('thead', h('tr', h('th', 'Chỉ số (số liệu minh hoạ)'), h('th', { class: 'num' }, 'B-tree'), h('th', { class: 'num' }, 'LSM-tree'))),
        h('tbody', rows.map(([a, b1, c, lsmWins]) => h('tr', h('td', a), h('td', { class: 'num' }, lsmWins ? b1 : h('b', b1)), h('td', { class: 'num' }, lsmWins ? h('b', c) : c))))));
      // bar chart: writes/s on log scale
      const W = 600, H = 120, X0 = 90, X1 = 580;
      const svg = svgEl(W, H, { 'aria-label': 'Thông lượng ghi' });
      const lo = 1, hi = 1e7;
      const sx = (v) => X0 + (Math.log10(clamp(v, lo, hi)) - 0) / 7 * (X1 - X0);
      for (let e = 0; e <= 7; e++) { const x = sx(Math.pow(10, e)); svg.appendChild(s('line', { x1: x, y1: 10, x2: x, y2: 86, class: 'grid' })); svg.appendChild(s('text', { x, y: 100, 'text-anchor': 'middle' }, e === 0 ? '1' : '10' + ['', '', '²', '³', '⁴', '⁵', '⁶', '⁷'][e])); }
      [['B-tree', btTput, 'f-violet'], ['LSM-tree', lsmTput, 'f-accent']].forEach(([lbl, v, c], i) => {
        const y = 18 + i * 34;
        svg.appendChild(s('text', { x: X0 - 8, y: y + 15, 'text-anchor': 'end', class: 'lbl-strong' }, lbl));
        svg.appendChild(s('rect', { x: X0, y, width: Math.max(2, sx(v) - X0), height: 22, rx: 3, class: c }));
        svg.appendChild(s('text', { x: Math.min(sx(v) + 6, X1 - 60), y: y + 15, class: 'lbl-strong' }, fmtBig(v) + '/s'));
      });
      svg.appendChild(s('text', { x: (X0 + X1) / 2, y: 116, 'text-anchor': 'middle' }, 'lượt ghi tối đa mỗi giây (thang log), giới hạn bởi băng thông và IOPS của đĩa'));
      clear(chart).appendChild(svg);
      note.textContent = `LSM: ${L} tầng (memtable 64 MB, mỗi tầng lớn gấp ${T}). B-tree: ~${fmt(fanout)} con mỗi trang, sâu ${btDepth} tầng, giả sử ${btDepth - btReads} tầng trên luôn nằm trong cache. B-tree được tính ở trường hợp xấu: mỗi lần ghi làm bẩn một trang khác nhau.`;
    }
    const note = h('p', { class: 'lab-note' });
    root.append(
      h('div', { class: 'controls' }, rec.el, data.el),
      h('div', { class: 'controls' }, h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Trang B-tree'), page.el), h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Ổ đĩa'), disk.el), h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Compaction của LSM'), comp.el)),
      dbl.el, bloom.el, chart, tbl, note,
    );
    render();
  });

  // =====================================================================
  // 4.6b — Compaction không theo kịp tốc độ ghi
  // =====================================================================
  widget('compaction-backlog', (root) => {
    const w = slider({ label: 'Tốc độ ghi vào', min: 5, max: 90, value: 30, format: (v) => v + ' MB/s', onInput: () => render() });
    const bw = slider({ label: 'Băng thông ghi của đĩa', min: 100, max: 400, step: 10, value: 200, format: (v) => v + ' MB/s', onInput: () => render() });
    const kind = seg({ label: 'Kiểu compaction', options: [{ value: 1.5, label: 'Size-tiered (ghi lại ít)' }, { value: 3, label: 'Leveled (ghi lại nhiều)' }], value: 3, onChange: () => render() });
    const chart = h('div', { class: 'viz' });
    const sEnd = stat('SSTable chưa gộp sau 5 phút', '—');
    const sVerdict = stat('Trạng thái', '—');
    const sBudget = stat('Băng thông còn cho compaction', '—');
    function sim() {
      const W_ = w.value, B = bw.value, k = kind.value, SEG = 64, T = 300;
      const budgetRate = Math.max(0, B - 2 * W_) / k; // WAL + flush tốn 2× tốc độ ghi
      let pending = 0, segs = 2, budget = 0; const pts = [];
      for (let t = 0; t <= T; t++) {
        pending += W_;
        while (pending >= SEG) { segs++; pending -= SEG; }
        budget = Math.min(budget + budgetRate, 4 * SEG * 2);
        while (segs >= 5 && budget >= 4 * SEG) { segs -= 3; budget -= 4 * SEG; }
        pts.push(segs);
      }
      return { pts, budgetRate };
    }
    function render() {
      const { pts, budgetRate } = sim();
      const W = 600, H = 220, X0 = 44, X1 = 585, Y0 = 186, Y1 = 14;
      const maxY = Math.max(10, Math.ceil(Math.max(...pts) / 10) * 10);
      const sx = (t) => X0 + t / 300 * (X1 - X0), sy = (v) => Y0 - v / maxY * (Y0 - Y1);
      const svg = svgEl(W, H, { 'aria-label': 'Số SSTable theo thời gian' });
      for (let i = 0; i <= 5; i++) { const v = maxY * i / 5, y = sy(v); svg.appendChild(s('line', { x1: X0, y1: y, x2: X1, y2: y, class: 'grid' })); svg.appendChild(s('text', { x: X0 - 6, y: y + 4, 'text-anchor': 'end' }, fmt(v))); }
      for (let t = 0; t <= 300; t += 60) svg.appendChild(s('text', { x: sx(t), y: Y0 + 16, 'text-anchor': 'middle' }, t + ' s'));
      svg.appendChild(s('line', { x1: X0, y1: Y0, x2: X1, y2: Y0, class: 'axis' }));
      svg.appendChild(s('line', { x1: X0, y1: sy(5), x2: X1, y2: sy(5), class: 's-mark f-none dash' }));
      svg.appendChild(s('text', { x: X1, y: sy(5) - 4, 'text-anchor': 'end' }, 'ngưỡng kích hoạt compaction'));
      const growing = pts[pts.length - 1] > 12;
      svg.appendChild(s('path', { d: pts.map((v, t) => (t ? 'L' : 'M') + sx(t).toFixed(1) + ' ' + sy(v).toFixed(1)).join(' '), class: (growing ? 's-bad' : 's-accent') + ' f-none', 'stroke-width': 2 }));
      svg.appendChild(s('text', { x: X0, y: 10 }, 'Số SSTable chưa gộp (mỗi lần đọc có thể phải xét từng cái)'));
      svg.appendChild(s('text', { x: (X0 + X1) / 2, y: H - 2, 'text-anchor': 'middle' }, 'thời gian'));
      clear(chart).appendChild(svg);
      const end = pts[pts.length - 1];
      sEnd.update(fmt(end), growing ? 'bad' : 'ok', growing ? 'đọc ngày càng chậm, đĩa dần đầy' : 'dao động quanh mức ổn định');
      sVerdict.update(growing ? 'Không theo kịp' : 'Theo kịp', growing ? 'bad' : 'ok', 'cần giám sát: LSM thường không tự hãm tốc độ ghi');
      sBudget.update(fmt(Math.max(0, bw.value - 2 * w.value)) + ' MB/s', null, `sau WAL + flush (2 × ${w.value} MB/s)`);
    }
    root.append(h('div', { class: 'controls' }, w.el, bw.el, h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Kiểu compaction'), kind.el)), chart,
      h('div', { class: 'stats' }, sEnd, sVerdict, sBudget),
      h('p', { class: 'lab-note' }, 'Mô hình đơn giản, số liệu minh hoạ: memtable 64 MB; cứ đủ 5 SSTable thì compaction gộp 4 cái làm 1 nếu còn đủ băng thông. Kéo tốc độ ghi lên khoảng 40 MB/s để thấy đường đỏ đi lên mãi.'));
    render();
  });
})();
