/* Chương 5 — Encoding and Evolution (từ ấn bản 1, Chương 4) */
(function () {
  const { h, s, clear, fmt, fmtBig, fmtMs, pct, rng, percentile, clamp, sleep,
          slider, seg, button, checkbox, stat, log, jsonHTML, widget, glossary } = window.DDIA;

  // ---------------------------------------------------------------- byte helpers
  const TE = new TextEncoder();
  const TD = new TextDecoder('utf-8', { fatal: false });
  const utf8 = (str) => Array.from(TE.encode(str));
  const hex2 = (b) => b.toString(16).padStart(2, '0');
  const hexs = (arr) => arr.map(hex2).join(' ');
  const U64 = (1n << 64n) - 1n;
  const INT64_MIN = -(1n << 63n), INT64_MAX = (1n << 63n) - 1n;

  /** unsigned LEB128 varint of a non-negative BigInt */
  function varintU(n) {
    n = BigInt(n);
    const out = [];
    do {
      let b = Number(n & 0x7fn);
      n >>= 7n;
      if (n > 0n) b |= 0x80;
      out.push(b);
    } while (n > 0n);
    return out;
  }
  const zigzag = (n) => ((BigInt(n) << 1n) ^ (BigInt(n) >> 63n)) & U64;
  const unzigzag = (u) => (u >> 1n) ^ -(u & 1n);
  /** big-endian two's complement bytes */
  function beBytes(n, len) {
    let u = BigInt.asUintN(len * 8, BigInt(n));
    const out = new Array(len);
    for (let i = len - 1; i >= 0; i--) { out[i] = Number(u & 0xffn); u >>= 8n; }
    return out;
  }
  function readVarint(bytes, pos) {
    let shift = 0n, result = 0n, i = pos;
    for (;;) {
      if (i >= bytes.length) throw new Error('hết dữ liệu giữa chừng một varint');
      const b = bytes[i++];
      result |= BigInt(b & 0x7f) << shift;
      shift += 7n;
      if (!(b & 0x80)) break;
      if (shift > 70n) throw new Error('varint quá dài');
    }
    return { value: result, next: i };
  }
  const printable = (b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '');
  function parseInt64(str) {
    const t = String(str).trim();
    if (t === '') return { ok: true, value: null };
    if (!/^-?\d+$/.test(t)) return { ok: false, msg: 'cần số nguyên' };
    const v = BigInt(t);
    if (v < INT64_MIN || v > INT64_MAX) return { ok: false, msg: 'vượt quá 64 bit' };
    return { ok: true, value: v };
  }
  const SAMPLE = { userName: 'Martin', favoriteNumber: 1337n, interests: ['daydreaming', 'hacking'] };

  // ---------------------------------------------------------------- encoders
  // Each returns an array of segments: {b:[bytes], k: kind, t: short label, d: description, ch: show ascii}
  // kinds: type, tag, len, name, val, punct
  const seg5 = (b, k, t, d, ch) => ({ b, k, t, d, ch: !!ch });

  function encJSON(r) {
    const out = [];
    const p = (txt, d) => out.push(seg5(utf8(txt), 'punct', txt, d || 'Ký tự cú pháp JSON.', true));
    const name = (n) => out.push(seg5(utf8(JSON.stringify(n)), 'name', 'tên “' + n + '”', 'Tên trường ' + n + ' viết đầy đủ kèm dấu nháy: ' + (n.length + 2) + ' byte lặp lại trong <em>mọi</em> bản ghi.', true));
    const str = (v, what) => out.push(seg5(utf8(JSON.stringify(v)), 'val', what, 'Giá trị chuỗi kèm dấu nháy (UTF-8, ký tự đặc biệt phải escape).', true));
    p('{', 'Mở object.');
    const fields = [];
    fields.push(() => { name('userName'); p(':'); str(r.userName, 'chuỗi'); });
    if (r.favoriteNumber != null) fields.push(() => { name('favoriteNumber'); p(':'); out.push(seg5(utf8(String(r.favoriteNumber)), 'val', 'số ' + r.favoriteNumber, 'Số viết bằng chữ số thập phân: mỗi chữ số 1 byte. JSON không nói đây là số nguyên hay số thực, cũng không nói độ chính xác.', true)); });
    fields.push(() => {
      name('interests'); p(':'); p('[', 'Mở mảng.');
      r.interests.forEach((it, i) => { if (i) p(','); str(it, 'chuỗi'); });
      p(']', 'Đóng mảng.');
    });
    fields.forEach((f, i) => { if (i) p(','); f(); });
    p('}', 'Đóng object.');
    return out;
  }

  function mpStrHeader(n) {
    if (n < 32) return { b: [0xa0 | n], d: `0x${hex2(0xa0 | n)} = 0xa0 (fixstr) | ${n} (độ dài)` };
    if (n < 256) return { b: [0xd9, n], d: `0xd9 (str8) + 1 byte độ dài ${n}` };
    return { b: [0xda, n >> 8, n & 255], d: `0xda (str16) + 2 byte độ dài ${n}` };
  }
  function mpInt(v) {
    if (v >= 0n && v <= 127n) return { b: [Number(v)], d: 'positive fixint: số 0–127 nằm gọn trong chính byte kiểu.' };
    if (v < 0n && v >= -32n) return { b: beBytes(v, 1), d: 'negative fixint: số −32…−1 nằm gọn trong 1 byte.' };
    if (v >= 0n) {
      if (v <= 0xffn) return { b: [0xcc, ...beBytes(v, 1)], d: '0xcc (uint8) + 1 byte.' };
      if (v <= 0xffffn) return { b: [0xcd, ...beBytes(v, 2)], d: '0xcd (uint16) + 2 byte big-endian.' };
      if (v <= 0xffffffffn) return { b: [0xce, ...beBytes(v, 4)], d: '0xce (uint32) + 4 byte big-endian.' };
      return { b: [0xcf, ...beBytes(v, 8)], d: '0xcf (uint64) + 8 byte big-endian.' };
    }
    if (v >= -128n) return { b: [0xd0, ...beBytes(v, 1)], d: '0xd0 (int8) + 1 byte.' };
    if (v >= -32768n) return { b: [0xd1, ...beBytes(v, 2)], d: '0xd1 (int16) + 2 byte.' };
    if (v >= -2147483648n) return { b: [0xd2, ...beBytes(v, 4)], d: '0xd2 (int32) + 4 byte.' };
    return { b: [0xd3, ...beBytes(v, 8)], d: '0xd3 (int64) + 8 byte.' };
  }
  function encMsgpack(r) {
    const out = [];
    const nf = r.favoriteNumber != null ? 3 : 2;
    out.push(seg5([0x80 | nf], 'type', `map ${nf} trường`, `0x${hex2(0x80 | nf)}: 4 bit cao 0x80 = object (fixmap), 4 bit thấp = ${nf} trường.`));
    const s = (txt, k, lbl) => {
      const bytes = utf8(txt); const hd = mpStrHeader(bytes.length);
      out.push(seg5(hd.b, 'type', 'str ' + bytes.length, hd.d));
      out.push(seg5(bytes, k, lbl, k === 'name' ? `Tên trường “${txt}” vẫn phải có, vì MessagePack không có schema.` : 'Byte UTF-8 của chuỗi; không cần ký tự kết thúc vì độ dài đã biết.', true));
    };
    s('userName', 'name', 'userName'); s(r.userName, 'val', r.userName || '(rỗng)');
    if (r.favoriteNumber != null) {
      s('favoriteNumber', 'name', 'favoriteNumber');
      const iv = mpInt(r.favoriteNumber);
      out.push(seg5(iv.b, 'val', 'số ' + r.favoriteNumber, iv.d));
    }
    s('interests', 'name', 'interests');
    const n = r.interests.length;
    out.push(seg5(n < 16 ? [0x90 | n] : [0xdc, n >> 8, n & 255], 'type', `mảng ${n}`, n < 16 ? `0x${hex2(0x90 | n)} = 0x90 (fixarray) | ${n} phần tử.` : `0xdc (array16) + 2 byte số phần tử.`));
    r.interests.forEach((it) => s(it, 'val', it || '(rỗng)'));
    return out;
  }

  function encThriftBinary(r) {
    const out = [];
    const fh = (type, tname, tag) => out.push(seg5([type, 0, tag], 'tag', `kiểu ${type}, tag ${tag}`, `Byte kiểu 0x${hex2(type)} (${tname}) + 2 byte field tag = ${tag}. Không có tên trường.`));
    const str = (txt, lbl) => {
      const b = utf8(txt);
      out.push(seg5(beBytes(b.length, 4), 'len', 'dài ' + b.length, `Độ dài chuỗi: 4 byte big-endian = ${b.length}.`));
      out.push(seg5(b, 'val', lbl || txt, 'Byte UTF-8 của chuỗi.', true));
    };
    fh(0x0b, 'string', 1); str(r.userName, r.userName || '(rỗng)');
    if (r.favoriteNumber != null) {
      fh(0x0a, 'i64', 2);
      out.push(seg5(beBytes(r.favoriteNumber, 8), 'val', 'i64 ' + r.favoriteNumber, `Số nguyên 64-bit luôn chiếm đủ 8 byte big-endian, dù giá trị nhỏ cỡ ${r.favoriteNumber}.`));
    }
    fh(0x0f, 'list', 3);
    out.push(seg5([0x0b], 'type', 'phần tử: string', '0x0b: kiểu của các phần tử trong list là string.'));
    out.push(seg5(beBytes(r.interests.length, 4), 'len', r.interests.length + ' phần tử', `Số phần tử: 4 byte = ${r.interests.length}.`));
    r.interests.forEach((it) => str(it));
    out.push(seg5([0x00], 'type', 'hết struct', '0x00: kết thúc struct (stop field).'));
    return out;
  }

  function encThriftCompact(r) {
    const out = [];
    let last = 0;
    const fh = (tag, type, tname) => {
      const delta = tag - last; last = tag;
      out.push(seg5([(delta << 4) | type], 'tag', `tag ${tag}, ${tname}`, `0x${hex2((delta << 4) | type)}: 4 bit cao = độ chênh tag (${delta}, so với tag trước), 4 bit thấp = kiểu ${type} (${tname}). Tag và kiểu gói trong 1 byte.`));
    };
    const str = (txt, lbl) => {
      const b = utf8(txt);
      out.push(seg5(varintU(b.length), 'len', 'dài ' + b.length, `Độ dài chuỗi dạng varint: ${b.length}.`));
      out.push(seg5(b, 'val', lbl || txt, 'Byte UTF-8 của chuỗi.', true));
    };
    fh(1, 8, 'binary/string'); str(r.userName, r.userName || '(rỗng)');
    if (r.favoriteNumber != null) {
      fh(2, 6, 'i64');
      const z = zigzag(r.favoriteNumber); const vb = varintU(z);
      out.push(seg5(vb, 'val', 'số ' + r.favoriteNumber, `Varint zigzag: ${r.favoriteNumber} → zigzag ${z} → ${vb.length} byte (${hexs(vb)}). Bit cao của mỗi byte báo “còn byte nữa”.`));
    }
    fh(3, 9, 'list');
    const n = r.interests.length;
    out.push(seg5(n < 15 ? [(n << 4) | 8] : [0xf8, ...varintU(n)], 'type', `${n} × string`, n < 15 ? `0x${hex2((n << 4) | 8)}: 4 bit cao = ${n} phần tử, 4 bit thấp = kiểu 8 (string).` : '0xf8 + varint số phần tử (≥ 15).'));
    r.interests.forEach((it) => str(it));
    out.push(seg5([0x00], 'type', 'hết struct', '0x00: kết thúc struct.'));
    return out;
  }

  function encProtobuf(r) {
    const out = [];
    const key = (tag, wire, wname) => out.push(seg5(varintU((tag << 3) | wire), 'tag', `tag ${tag}, ${wname}`, `0x${hex2((tag << 3) | wire)} = (tag ${tag} &lt;&lt; 3) | wire type ${wire} (${wname}).`));
    const str = (tag, txt) => {
      const b = utf8(txt);
      key(tag, 2, 'length-delimited');
      out.push(seg5(varintU(b.length), 'len', 'dài ' + b.length, `Độ dài varint: ${b.length}.`));
      out.push(seg5(b, 'val', txt || '(rỗng)', 'Byte UTF-8 của chuỗi.', true));
    };
    str(1, r.userName);
    if (r.favoriteNumber != null) {
      key(2, 0, 'varint');
      const u = BigInt.asUintN(64, r.favoriteNumber); const vb = varintU(u);
      out.push(seg5(vb, 'val', 'số ' + r.favoriteNumber, `Varint (int64, không zigzag): ${vb.length} byte. ` + (r.favoriteNumber < 0n ? 'Số âm kiểu int64 luôn tốn 10 byte vì được coi như số không dấu 64-bit rất lớn; muốn gọn hãy dùng sint64 (zigzag).' : 'Số càng nhỏ càng ít byte.')));
    }
    r.interests.forEach((it) => str(3, it));
    if (!r.interests.length) out.push(seg5([], 'punct', '(không có interests)', 'Trường repeated rỗng không ghi byte nào.'));
    return out.filter((x) => x.b.length || x.k === 'punct');
  }

  function encAvro(r) {
    const out = [];
    const str = (txt, lbl) => {
      const b = utf8(txt); const z = varintU(zigzag(b.length));
      out.push(seg5(z, 'len', 'dài ' + b.length, `Độ dài dạng varint zigzag: ${b.length} → ${hexs(z)}. Không có gì cho biết đây là chuỗi; chỉ schema biết.`));
      out.push(seg5(b, 'val', lbl || txt || '(rỗng)', 'Byte UTF-8 của chuỗi.', true));
    };
    str(r.userName);
    if (r.favoriteNumber != null) {
      out.push(seg5([0x02], 'type', 'union nhánh 1', '0x02 = zigzag(1): chọn nhánh thứ 1 (long) của union { null, long }.'));
      const vb = varintU(zigzag(r.favoriteNumber));
      out.push(seg5(vb, 'val', 'long ' + r.favoriteNumber, `long dạng varint zigzag: ${vb.length} byte.`));
    } else {
      out.push(seg5([0x00], 'type', 'union: null', '0x00 = zigzag(0): chọn nhánh 0 (null) của union. Avro vẫn ghi 1 byte, vì không có tag để “bỏ qua” trường.'));
    }
    const n = r.interests.length;
    if (n) {
      out.push(seg5(varintU(zigzag(n)), 'len', `khối ${n} phần tử`, `Mảng được ghi theo khối: số phần tử của khối (zigzag) = ${n}.`));
      r.interests.forEach((it) => str(it));
    }
    out.push(seg5([0x00], 'type', 'hết mảng', '0x00: khối rỗng, đánh dấu hết mảng.'));
    return out;
  }

  const FORMATS = [
    { id: 'json', name: 'JSON', fn: encJSON, book: 81 },
    { id: 'msgpack', name: 'MessagePack', fn: encMsgpack, book: 66 },
    { id: 'thrift-binary', name: 'Thrift Binary', fn: encThriftBinary, book: 59 },
    { id: 'thrift-compact', name: 'Thrift Compact', fn: encThriftCompact, book: 34 },
    { id: 'protobuf', name: 'Protocol Buffers', fn: encProtobuf, book: 33 },
    { id: 'avro', name: 'Avro', fn: encAvro, book: 32 },
  ];
  const segBytes = (segs) => segs.reduce((a, x) => a.concat(x.b), []);

  /** Render a list of segments as byte groups. onPick(seg) when a group is clicked. */
  function byteView(segs, onPick, selIdx) {
    const wrap = h('div', { class: 'bytes' });
    segs.forEach((sg, i) => {
      const cells = h('div', { class: 'cells' }, sg.b.length ? sg.b.map((b) => h('span', { class: 'bcell' }, hex2(b), h('i', sg.ch ? printable(b) : ''))) : h('span', { class: 'bcell' }, '—', h('i', '')));
      const g = h('div', { class: 'bgrp k-' + sg.k + (i === selIdx ? ' sel' : ''), role: 'button', tabindex: '0', title: sg.t }, cells, h('small', sg.t));
      const pick = () => { wrap.querySelectorAll('.bgrp.sel').forEach((x) => x.classList.remove('sel')); g.classList.add('sel'); onPick && onPick(sg, i); };
      g.addEventListener('click', pick);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
      wrap.appendChild(g);
    });
    return wrap;
  }
  function legend5(items) {
    const L = { type: 'kiểu / cấu trúc', tag: 'field tag (+ kiểu)', len: 'độ dài / số phần tử', name: 'tên trường', val: 'giá trị', punct: 'cú pháp' };
    return h('div', { class: 'legend5' }, items.map((k) => h('span', h('b', { class: 'k-' + k }), L[k])));
  }
  function hbars(rows, max) {
    return h('div', { class: 'hbars' }, rows.map((r) => {
      const row = h('div', { class: 'hrow' + (r.onClick ? ' clickable' : '') }, h('span', r.label),
        h('div', { class: 'track' }, h('div', { class: 'fill ' + (r.tone || ''), style: { width: (max ? (r.value / max) * 100 : 0) + '%' } }), h('span', r.text)));
      if (r.onClick) row.addEventListener('click', r.onClick);
      return row;
    }));
  }
  function field(label, input) { return h('label', { class: 'fld' }, h('span', label), input); }
  function textInput(value, onInput, attrs) {
    const el = h('input', Object.assign({ type: 'text', value, spellcheck: 'false', autocomplete: 'off' }, attrs || {}));
    el.value = value;
    el.addEventListener('input', () => onInput(el.value));
    return el;
  }
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const jsonSafe = (v) => JSON.parse(JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? Number(x) <= Number.MAX_SAFE_INTEGER && Number(x) >= -Number.MAX_SAFE_INTEGER ? Number(x) : String(x) : x)));
  const pre = (obj) => h('pre', { class: 'json', html: jsonHTML(jsonSafe(obj)) });

  // ---------------------------------------------------------------- widget: byte-encoder
  widget('byte-encoder', (root, fig) => {
    let fmtId = fig.dataset.format || 'msgpack';
    const st = { name: SAMPLE.userName, num: String(SAMPLE.favoriteNumber), ints: SAMPLE.interests.join(', ') };
    let sel = 0;
    const warn = h('span', { class: 'pill bad', hidden: true });
    const inName = textInput(st.name, (v) => { st.name = v; render(); }, { 'aria-label': 'userName' });
    const inNum = textInput(st.num, (v) => { st.num = v; render(); }, { inputmode: 'numeric', 'aria-label': 'favoriteNumber' });
    const inInts = textInput(st.ints, (v) => { st.ints = v; render(); }, { 'aria-label': 'interests' });
    const fsel = seg({ options: FORMATS.map((f) => ({ value: f.id, label: f.name })), value: fmtId, onChange: (v) => { fmtId = v; sel = 0; render(); } });
    const reset = button('Khôi phục ví dụ của sách', () => {
      st.name = SAMPLE.userName; st.num = String(SAMPLE.favoriteNumber); st.ints = SAMPLE.interests.join(', ');
      inName.value = st.name; inNum.value = st.num; inInts.value = st.ints; render();
    }, 'ghost');
    const sTotal = stat('Tổng kích thước', '—', 'accent');
    const sVs = stat('So với JSON', '—');
    const sNames = stat('Byte dành cho tên trường', '—');
    const bytesBox = h('div');
    const detail = h('div', { class: 'detail' });
    const bars = h('div');
    root.append(
      h('div', { class: 'controls' }, field('userName (chuỗi)', inName), field('favoriteNumber (số nguyên 64-bit, để trống = không có)', inNum), field('interests (ngăn bằng dấu phẩy)', inInts)),
      h('div', { class: 'btn-row' }, warn, reset),
      fsel.el,
      h('div', { class: 'stats' }, sTotal, sVs, sNames),
      bytesBox, detail,
      h('div', { class: 'box' }, h('h5', 'Cùng bản ghi, sáu định dạng (byte)'), bars, h('p', { class: 'lab-note' }, 'Bấm một thanh để chuyển sang định dạng đó.'))
    );
    function rec() {
      const pn = parseInt64(st.num);
      warn.hidden = pn.ok; if (!pn.ok) warn.textContent = 'favoriteNumber: ' + pn.msg + ' (đang bỏ qua trường)';
      const ints = st.ints.split(',').map((x) => x.trim()).filter((x) => x.length);
      return { userName: st.name, favoriteNumber: pn.ok ? pn.value : null, interests: ints };
    }
    function render() {
      const r = rec();
      const F = FORMATS.find((f) => f.id === fmtId);
      const segs = F.fn(r);
      const total = segBytes(segs).length;
      const jsonTotal = segBytes(encJSON(r)).length;
      const names = segs.filter((x) => x.k === 'name').reduce((a, x) => a + x.b.length, 0);
      const isBook = r.userName === 'Martin' && r.favoriteNumber === 1337n && r.interests.join('|') === 'daydreaming|hacking';
      sTotal.update(fmt(total) + ' byte', 'accent', isBook ? `sách: ${F.book} byte ✓` : 'bản ghi đã sửa');
      sVs.update(fmt(total / jsonTotal * 100) + '%', total < jsonTotal ? 'ok' : '', `JSON: ${jsonTotal} byte`);
      sNames.update(fmt(names) + ' byte', names ? 'bad' : 'ok', names ? 'tên trường trong mỗi bản ghi' : 'không có tên trường');
      clear(bytesBox).append(legend5([...new Set(segs.map((x) => x.k))]), byteView(segs, (sg) => showDetail(sg), sel));
      if (sel >= segs.length) sel = 0;
      showDetail(segs[sel]);
      const all = FORMATS.map((f) => ({ f, n: segBytes(f.fn(r)).length }));
      const max = Math.max(...all.map((x) => x.n));
      clear(bars).append(hbars(all.map(({ f, n }) => ({ label: f.name, value: n, text: n + ' byte', tone: f.id === fmtId ? 'cur' : '', onClick: () => { fmtId = f.id; fsel.set(f.id); sel = 0; render(); } })), max));
    }
    function showDetail(sg) {
      if (!sg) { detail.textContent = ''; return; }
      detail.innerHTML = `<b>${esc(sg.t)}</b> · <code>${hexs(sg.b) || '(0 byte)'}</code> · ${sg.b.length} byte<br>${sg.d}`;
    }
    render();
  });

  // ---------------------------------------------------------------- widget: varint
  widget('varint', (root) => {
    let val = '1337';
    const inp = textInput(val, (v) => { val = v; render(); }, { inputmode: 'numeric', 'aria-label': 'Số nguyên' });
    const presets = [['1', '1'], ['63', '63'], ['64', '64'], ['1337', '1337'], ['−1', '-1'], ['8191', '8191'], ['8192', '8192'], ['2⁵³+1', '9007199254740993']];
    const pr = h('div', { class: 'btn-row' }, presets.map(([l, v]) => button(l, () => { val = v; inp.value = v; render(); }, 'ghost')));
    const out = h('div');
    root.append(h('div', { class: 'controls' }, field('Số nguyên (64-bit có dấu)', inp)), pr, out);
    function septets(bytes) {
      return h('div', bytes.map((b) => h('span', { class: 'septet', title: '0x' + hex2(b) }, h('b', (b >> 7) & 1), h('span', (b & 0x7f).toString(2).padStart(7, '0')))));
    }
    function render() {
      clear(out);
      const p = parseInt64(val);
      if (!p.ok || p.value == null) { out.append(h('p', { class: 'pill bad' }, 'Hãy nhập số nguyên trong phạm vi 64-bit.')); return; }
      const v = p.value;
      const fixed = beBytes(v, 8);
      const pb = varintU(BigInt.asUintN(64, v));
      const z = zigzag(v); const zz = varintU(z);
      out.append(
        h('div', { class: 'stats' },
          stat('Thrift Binary (i64 cố định)', fixed.length + ' byte', '', hexs(fixed)),
          stat('Protobuf int64 (varint)', pb.length + ' byte', pb.length <= 2 ? 'ok' : pb.length >= 9 ? 'bad' : 'warn', hexs(pb)),
          stat('Compact / Avro (zigzag varint)', zz.length + ' byte', zz.length <= 2 ? 'ok' : zz.length >= 9 ? 'bad' : 'warn', hexs(zz))),
        h('div', { class: 'lab-split' },
          h('div', { class: 'box' }, h('h5', 'Protobuf int64: các byte varint'), septets(pb),
            h('p', { class: 'lab-note' }, v < 0n ? 'Số âm được coi như số không dấu 64-bit (2⁶⁴ + n), nên luôn tốn 10 byte.' : 'Đọc từ trái sang phải: nhóm 7 bit đầu tiên là 7 bit thấp nhất của số.')),
          h('div', { class: 'box' }, h('h5', `Zigzag: ${v} → ${z}`), septets(zz),
            h('p', { class: 'lab-note' }, 'Zigzag xếp 0, −1, 1, −2, 2… thành 0, 1, 2, 3, 4…, nên số âm nhỏ cũng gọn. Một byte chứa −64…63, hai byte chứa −8192…8191.'))),
      );
    }
    render();
  });
