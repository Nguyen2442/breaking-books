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

  // ---------------------------------------------------------------- 5.1 compat-matrix
  widget('compat-matrix', (root) => {
    const N = 5;
    let up = 2, back = true, fwd = true, running = false;
    const sl = slider({ label: 'Số node đã nâng cấp lên v2', min: 0, max: N, value: up, format: (v) => `${v}/${N} node`, onInput: (v) => { up = v; render(); } });
    const cbB = checkbox('Tương thích ngược (v2 đọc được dữ liệu v1)', true, (v) => { back = v; render(); });
    const cbF = checkbox('Tương thích xuôi (v1 đọc được dữ liệu v2)', true, (v) => { fwd = v; render(); });
    const rollBtn = button('Nâng cấp từng node', async () => {
      if (running) return;
      running = true; rollBtn.disabled = true;
      for (let i = 0; i <= N; i++) {
        up = i; sl.set(i); render();
        await sleep(320);
      }
      running = false; rollBtn.disabled = false;
    });
    const nodesBox = h('div', { class: 'nodes' });
    const mxBox = h('div', { class: 'mx' });
    const stats = h('div', { class: 'stats' });
    root.append(h('div', { class: 'controls' }, sl.el, rollBtn), h('div', { class: 'chk-list' }, cbB.el, cbF.el), nodesBox, mxBox, stats);

    function render() {
      const p2 = up / N, p1 = 1 - p2;
      clear(nodesBox).append(
        ...Array.from({ length: N }, (_, i) => h('span', { class: 'node5' + (i < up ? ' v2' : '') }, `Node ${i + 1}: ${i < up ? 'code v2' : 'code v1'}`))
      );
      const cell = (title, prob, ok, desc) => {
        const active = prob > 1e-6;
        const cls = !active ? 'cell' : ok ? 'cell ok' : 'cell bad';
        return h('div', { class: cls }, h('b', `${title} (${pct(prob, 0)})`), h('span', active ? (ok ? '✓ Thành công — ' : '✗ Lỗi đọc — ') + desc : 'Không xảy ra ở bước này'));
      };
      clear(mxBox).append(
        h('div', { class: 'hd' }, 'Người đọc \\ Dữ liệu'),
        h('div', { class: 'hd' }, `Dữ liệu v1 (${pct(p1, 0)})`),
        h('div', { class: 'hd' }, `Dữ liệu v2 (${pct(p2, 0)})`),
        h('div', { class: 'hd' }, `Code v1 (${pct(p1, 0)})`),
        cell('v1 đọc v1', p1 * p1, true, 'Cùng phiên bản cũ'),
        cell('v1 đọc v2', p1 * p2, fwd, 'Cần tương thích xuôi (forward)'),
        h('div', { class: 'hd' }, `Code v2 (${pct(p2, 0)})`),
        cell('v2 đọc v1', p2 * p1, back, 'Cần tương thích ngược (backward)'),
        cell('v2 đọc v2', p2 * p2, true, 'Cùng phiên bản mới')
      );
      const failRate = (fwd ? 0 : p1 * p2) + (back ? 0 : p2 * p1);
      clear(stats).append(
        stat('Node chạy v1 / v2', `${N - up} / ${up}`, 'accent'),
        stat('Tỉ lệ lượt đọc thành công', pct(1 - failRate, 0), failRate === 0 ? 'ok' : 'bad'),
        stat('Tỉ lệ lượt đọc bị lỗi', pct(failRate, 0), failRate === 0 ? 'ok' : 'bad', failRate > 0 ? 'do thiếu tương thích' : 'an toàn suốt rolling upgrade')
      );
    }
    render();
  });

  // ---------------------------------------------------------------- 5.2 lang-formats
  widget('lang-formats', (root) => {
    const WRITERS = [
      { id: 'java', label: 'Java Serializable', lang: 'Java', magic: 'ac ed 00 05 73 72 00 06 50 65 72 73 6f 6e', bytes: 142 },
      { id: 'pickle', label: 'Python pickle', lang: 'Python', magic: '80 04 95 2b 00 00 00 00 00 00 00 8c 06 4d 61 72 74 69 6e', bytes: 68 },
      { id: 'marshal', label: 'Ruby Marshal', lang: 'Ruby', magic: '04 08 6f 3a 0b 50 65 72 73 6f 6e 06 3a 0e 40 75 73 65 72', bytes: 64 },
      { id: 'protobuf', label: 'Protocol Buffers', lang: 'Đa ngôn ngữ', magic: '0a 06 4d 61 72 74 69 6e 10 b9 0a 1a 0b 64 61 79', bytes: 33 },
    ];
    let wId = 'pickle', rLang = 'Java', scen = 'normal';
    const wSeg = seg({ options: WRITERS.map((w) => ({ value: w.id, label: w.label })), value: wId, onChange: (v) => { wId = v; render(); } });
    const rSeg = seg({ options: ['Python', 'Java', 'Ruby', 'Go'].map((l) => ({ value: l, label: 'Đọc bằng ' + l })), value: rLang, onChange: (v) => { rLang = v; render(); } });
    const sSeg = seg({
      options: [
        { value: 'normal', label: 'Đọc bình thường' },
        { value: 'evolve', label: 'Đổi tên/kiểu trường trong class' },
        { value: 'untrusted', label: 'Payload từ kẻ tấn công (untrusted)' },
      ],
      value: scen,
      onChange: (v) => { scen = v; render(); },
    });
    const out = h('div'), stats = h('div', { class: 'stats' });
    root.append(
      h('div', { class: 'controls' }, field('Định dạng phía ghi', wSeg.el), field('Ngôn ngữ phía đọc', rSeg.el)),
      sSeg.el, out, stats
    );

    function render() {
      const w = WRITERS.find((x) => x.id === wId);
      const isCross = w.id !== 'protobuf' && w.lang !== rLang;
      const isRce = w.id !== 'protobuf' && scen === 'untrusted';
      const isBrokenVer = w.id !== 'protobuf' && scen === 'evolve';
      const ok = !isCross && !isRce && !isBrokenVer;
      const tone = ok ? 'ok' : 'bad';
      let msg = 'Giải mã thành công sang cấu trúc dữ liệu trong bộ nhớ.';
      if (isRce) msg = 'NGUY HIỂM (RCE): Bộ giải mã khởi tạo class tuỳ ý từ luồng byte không tin cậy (__reduce__ trong pickle / Gadget chain trong Java Serializable), cho phép kẻ tấn công thực thi lệnh hệ thống!';
      else if (isCross) msg = `Không đọc được: ${w.label} gắn chặt với runtime của ${w.lang}, tiến trình ${rLang} không hiểu biểu diễn class nội bộ này.`;
      else if (isBrokenVer) msg = `Lỗi phiên bản (InvalidClassException / AttributeError): định dạng gắn với ngôn ngữ lưu tên class và cấu trúc nội bộ, đổi class làm dữ liệu cũ không nạp lại được.`;

      clear(out).append(
        h('div', { class: 'card5 ' + tone },
          h('h5', `${w.label} → ${rLang}`, h('span', { class: 'pill ' + tone }, ok ? 'Đọc an toàn' : 'Thất bại / Nguy hiểm')),
          h('div', { class: 'hexline' }, 'Magic & header bytes: ', h('code', w.magic + ' …')),
          h('p', msg)
        )
      );
      clear(stats).append(
        stat('Kích thước bản ghi', w.bytes + ' byte', w.id === 'protobuf' ? 'ok' : 'warn'),
        stat('Độc lập ngôn ngữ', w.id === 'protobuf' ? 'Có (IDL)' : 'Không (trói vào ' + w.lang + ')', w.id === 'protobuf' ? 'ok' : 'bad'),
        stat('An toàn với byte lạ', w.id === 'protobuf' ? 'An toàn (chỉ đọc dữ liệu)' : 'Rủi ro thực thi code (RCE)', w.id === 'protobuf' ? 'ok' : 'bad')
      );
    }
    render();
  });

  // ---------------------------------------------------------------- 5.3 json-pitfalls
  widget('json-pitfalls', (root) => {
    let tab = 'num', bigStr = '9007199254740993', binStr = 'Hello DDIA!', csvStr = '101,"San Francisco, CA",42';
    const tSeg = seg({
      options: [
        { value: 'num', label: '1. Số nguyên > 2⁵³ (IEEE 754)' },
        { value: 'b64', label: '2. Chuỗi nhị phân & Base64 (+33%)' },
        { value: 'csv', label: '3. CSV thiếu kiểu & bẫy dấu phẩy' },
        { value: 'xml', label: '4. XML/CSV: số hay chuỗi?' },
      ],
      value: tab,
      onChange: (v) => { tab = v; render(); },
    });
    const body = h('div');
    root.append(tSeg.el, body);

    function parseCsvRfc(line) {
      const out = [];
      let cur = '', inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
          else inQ = !inQ;
        } else if (c === ',' && !inQ) {
          out.push(cur); cur = '';
        } else cur += c;
      }
      out.push(cur);
      return out;
    }

    function render() {
      clear(body);
      if (tab === 'num') {
        const inp = textInput(bigStr, (v) => { bigStr = v.replace(/[^0-9-]/g, '') || '0'; render(); });
        let parsedNum = 0, roundTrip = '';
        try {
          parsedNum = JSON.parse(bigStr);
          roundTrip = String(parsedNum);
        } catch { roundTrip = '(lỗi cú pháp)'; }
        const lost = roundTrip !== bigStr.trim();
        body.append(
          h('div', { class: 'controls' }, field('ID 64-bit gốc (thử 9007199254740993 = 2⁵³ + 1)', inp)),
          h('div', { class: 'lab-split' },
            h('div', { class: 'card5 ' + (lost ? 'bad' : 'ok') },
              h('h5', 'JSON.parse(id) trong JavaScript'),
              pre({ id: parsedNum }),
              h('p', lost ? `Sai lệch! Đuôi "${bigStr.slice(-4)}" biến thành "${roundTrip.slice(-4)}" vì vượt quá 53 bit phần định trị của kiểu Number (double IEEE 754).` : 'Chính xác trong phạm vi 53 bit.')
            ),
            h('div', { class: 'card5 ok' },
              h('h5', 'Cách của Twitter/X: kèm thêm id_str'),
              pre({ id: parsedNum, id_str: bigStr.trim() }),
              h('p', 'Trả thêm chuỗi thập phân giúp client JavaScript giữ nguyên từng chữ số của ID 64-bit.')
            )
          ),
          h('div', { class: 'stats' },
            stat('Giá trị gốc', bigStr.trim(), 'accent'),
            stat('Sau JSON.parse', roundTrip, lost ? 'bad' : 'ok'),
            stat('Độ lệch', lost ? 'Mất độ chính xác!' : '0', lost ? 'bad' : 'ok')
          )
        );
      } else if (tab === 'b64') {
        const inp = textInput(binStr, (v) => { binStr = v; render(); });
        const rawBytes = utf8(binStr);
        const b64 = btoa(String.fromCharCode(...rawBytes));
        const ratio = rawBytes.length ? Math.round(((b64.length - rawBytes.length) / rawBytes.length) * 100) : 0;
        body.append(
          h('div', { class: 'controls' }, field('Dữ liệu nhị phân gốc', inp)),
          h('div', { class: 'lab-split' },
            h('div', { class: 'card5' }, h('h5', `Byte nhị phân thô (${rawBytes.length} B)`), h('div', { class: 'hexline' }, hexs(rawBytes))),
            h('div', { class: 'card5 warn' }, h('h5', `Mã hoá Base64 trong JSON (${b64.length} B)`), h('div', { class: 'mono' }, `"${b64}"`))
          ),
          h('div', { class: 'stats' },
            stat('Kích thước gốc', rawBytes.length + ' B', 'ok'),
            stat('Kích thước Base64', b64.length + ' B', 'warn', '3 byte nhị phân → 4 ký tự ASCII'),
            stat('Tăng kích thước', '+' + ratio + '%', 'bad', 'xấp xỉ +33% băng thông')
          )
        );
      } else if (tab === 'csv') {
        const inp = textInput(csvStr, (v) => { csvStr = v; render(); });
        const naive = csvStr.split(',');
        const rfc = parseCsvRfc(csvStr);
        body.append(
          h('div', { class: 'controls' }, field('Dòng CSV có dấu phẩy bên trong ngoặc kép', inp)),
          h('div', { class: 'lab-split' },
            h('div', { class: 'card5 ' + (naive.length !== rfc.length ? 'bad' : 'ok') },
              h('h5', `Parser ngây thơ: line.split(',') → ${naive.length} cột`),
              pre(naive),
              h('p', 'Bị tách nhầm tại dấu phẩy nằm trong "San Francisco, CA"!')
            ),
            h('div', { class: 'card5 ok' },
              h('h5', `Parser theo RFC 4180 → ${rfc.length} cột`),
              pre(rfc),
              h('p', 'Tôn trọng dấu ngoặc kép bao quanh trường, nhưng mọi giá trị vẫn chỉ là chuỗi (không phân biệt số 42 với chuỗi "42").')
            )
          )
        );
      } else {
        body.append(
          h('div', { class: 'lab-split' },
            h('div', { class: 'card5 warn' },
              h('h5', 'XML / CSV không tự phân biệt kiểu'),
              h('div', { class: 'mono' }, '<zip>01234</zip>  ·  <count>1337</count>'),
              h('p', 'Nếu không có schema bên ngoài, parser không biết "01234" là mã bưu điện (cần giữ số 0 ở đầu) hay số nguyên 1234.')
            ),
            h('div', { class: 'card5 ok' },
              h('h5', 'JSON phân biệt chuỗi và số (nhưng thiếu kiểu nguyên/thực)'),
              pre({ zip: '01234', count: 1337 }),
              h('p', 'JSON giữ được "01234" là chuỗi, nhưng lại không phân biệt int32, int64 hay float64.')
            )
          )
        );
      }
    }
    render();
  });

  // ---------------------------------------------------------------- 5.6 tag-evolution
  widget('tag-evolution', (root) => {
    const SCENARIOS = [
      {
        id: 'add-opt',
        label: 'Thêm trường optional (tag 4: email)',
        backOk: true,
        fwdOk: true,
        backNote: 'Code v2 đọc byte v1: không thấy tag 4 → điền giá trị mặc định / null cho email. An toàn!',
        fwdNote: 'Code v1 đọc byte v2: gặp tag 4 lạ (wire type 2 = length-delimited, dài 9 byte) → nhảy qua 9 byte đó và đọc xong. An toàn!',
      },
      {
        id: 'add-req',
        label: 'Thêm trường required (tag 4: email)',
        backOk: false,
        fwdOk: true,
        backNote: 'LỖI TƯƠNG THÍCH NGƯỢC: Code v2 đọc byte v1 không thấy tag 4 mà trường lại là required → ném ngoại lệ giải mã!',
        fwdNote: 'Code v1 đọc byte v2: vẫn bỏ qua tag 4 lạ như bình thường.',
      },
      {
        id: 'rename',
        label: 'Đổi tên userName → handle (giữ nguyên tag 1)',
        backOk: true,
        fwdOk: true,
        backNote: 'Code v2 đọc byte v1: trên đường truyền chỉ có tag 1 (không có chữ "userName" nào), nên ánh xạ thẳng vào trường handle.',
        fwdNote: 'Code v1 đọc byte v2: thấy tag 1, đọc vào trường userName bình thường.',
      },
      {
        id: 'change-tag',
        label: 'Đổi tag của userName từ 1 sang 5',
        backOk: false,
        fwdOk: false,
        backNote: 'HỎNG HOÀN TOÀN: Code v2 tìm tag 5 nhưng byte v1 chỉ có tag 1 → mất tên người dùng!',
        fwdNote: 'HỎNG HOÀN TOÀN: Code v1 tìm tag 1 nhưng byte v2 ghi tag 5 → coi tag 5 là trường lạ và bỏ qua!',
      },
      {
        id: 'reuse-tag',
        label: 'Xoá favoriteNumber (tag 2) rồi dùng lại tag 2 cho chuỗi badge',
        backOk: false,
        fwdOk: false,
        backNote: 'HỎNG DỮ LIỆU: Byte cũ mang tag 2 kiểu varint (1337), trong khi code v2 kỳ vọng tag 2 là chuỗi (wire type 2) → lỗi giải mã!',
        fwdNote: 'HỎNG DỮ LIỆU: Byte mới mang tag 2 kiểu chuỗi nhưng code v1 hiểu tag 2 là số nguyên favoriteNumber!',
      },
    ];
    let sId = 'add-opt';
    const sel = seg({ options: SCENARIOS.map((s) => ({ value: s.id, label: s.label })), value: sId, onChange: (v) => { sId = v; render(); } });
    const split = h('div', { class: 'lab-split' }), stats = h('div', { class: 'stats' });
    root.append(sel.el, split, stats);

    function render() {
      const sc = SCENARIOS.find((x) => x.id === sId);
      const v1DecodedByV2 = sId === 'add-opt' ? { userName: 'Martin', favoriteNumber: 1337, email: null }
        : sId === 'rename' ? { handle: 'Martin', favoriteNumber: 1337 }
          : { error: 'DecodeException / Mất dữ liệu' };
      const v2DecodedByV1 = (sId === 'add-opt' || sId === 'add-req' || sId === 'rename')
        ? { userName: 'Martin', favoriteNumber: 1337, _skippedTags: sId === 'rename' ? [] : ['tag 4 (9 bytes skipped)'] }
        : { error: 'DecodeException / Sai kiểu wire type' };

      clear(split).append(
        h('div', { class: 'card5 ' + (sc.backOk ? 'ok' : 'bad') },
          h('h5', 'Tương thích ngược: Code v2 đọc byte v1', h('span', { class: 'pill ' + (sc.backOk ? 'ok' : 'bad') }, sc.backOk ? 'OK' : 'Vỡ')),
          h('div', { class: 'hexline' }, 'Byte v1: ', h('code', '0a 06 4d 61 72 74 69 6e  10 b9 0a')),
          pre(v1DecodedByV2),
          h('p', sc.backNote)
        ),
        h('div', { class: 'card5 ' + (sc.fwdOk ? 'ok' : 'bad') },
          h('h5', 'Tương thích xuôi: Code v1 đọc byte v2', h('span', { class: 'pill ' + (sc.fwdOk ? 'ok' : 'bad') }, sc.fwdOk ? 'OK' : 'Vỡ')),
          h('div', { class: 'hexline' }, 'Byte v2: ', h('code', '0a 06 4d 61 72 74 69 6e  10 b9 0a  22 07 61 40 62 2e 63 6f 6d')),
          pre(v2DecodedByV1),
          h('p', sc.fwdNote)
        )
      );
      clear(stats).append(
        stat('Tương thích ngược (Backward)', sc.backOk ? 'Đạt' : 'Thất bại', sc.backOk ? 'ok' : 'bad'),
        stat('Tương thích xuôi (Forward)', sc.fwdOk ? 'Đạt' : 'Thất bại', sc.fwdOk ? 'ok' : 'bad'),
        stat('Kết luận nâng cấp cuốn chiếu', sc.backOk && sc.fwdOk ? 'An toàn' : 'Không được phép', sc.backOk && sc.fwdOk ? 'ok' : 'bad')
      );
    }
    render();
  });

  // ---------------------------------------------------------------- 5.6b type-change
  widget('type-change', (root) => {
    let mode = 'int', numVal = '5000000000', repVal = 'daydreaming, hacking, coding';
    const mSeg = seg({
      options: [
        { value: 'int', label: 'Đổi kiểu int32 ↔ int64' },
        { value: 'rep', label: 'Đổi optional string ↔ repeated string (Protobuf)' },
      ],
      value: mode,
      onChange: (v) => { mode = v; render(); },
    });
    const body = h('div');
    root.append(mSeg.el, body);

    function render() {
      clear(body);
      if (mode === 'int') {
        const inp = textInput(numVal, (v) => { numVal = v.replace(/[^0-9-]/g, '') || '0'; render(); });
        const p = parseInt64(numVal);
        const v64 = p.ok && p.value != null ? p.value : 0n;
        const v32 = BigInt.asIntN(32, v64);
        const truncated = v32 !== v64;
        body.append(
          h('div', { class: 'controls' }, field('Giá trị int64 do code v2 ghi (giới hạn 32-bit là 2.147.483.647)', inp)),
          h('div', { class: 'btn-row' },
            button('1337 (vừa 32-bit)', () => { numVal = '1337'; render(); }, 'ghost'),
            button('5.000.000.000 (tràn 32-bit)', () => { numVal = '5000000000'; render(); }, 'ghost')
          ),
          h('div', { class: 'lab-split' },
            h('div', { class: 'card5 ok' },
              h('h5', 'Code v2 (int64) đọc dữ liệu cũ (int32)'),
              pre({ value_int64: String(v64) }),
              h('p', 'Mở rộng từ 32-bit lên 64-bit không bao giờ mất bit.')
            ),
            h('div', { class: 'card5 ' + (truncated ? 'bad' : 'ok') },
              h('h5', 'Code v1 (int32) đọc dữ liệu mới (int64)'),
              pre({ value_int32: String(v32) }),
              h('p', truncated ? `BỊ CẮT CỤT 32 BIT CAO! Giá trị ${v64} bị đọc thành ${v32}.` : 'Giá trị nằm gọn trong 32 bit nên không bị cắt.')
            )
          )
        );
      } else {
        const inp = textInput(repVal, (v) => { repVal = v; render(); });
        const items = repVal.split(',').map((s) => s.trim()).filter(Boolean);
        const last = items.length ? items[items.length - 1] : null;
        body.append(
          h('div', { class: 'controls' }, field('Danh sách repeated string do code v2 ghi (ngăn bởi dấu phẩy)', inp)),
          h('div', { class: 'lab-split' },
            h('div', { class: 'card5 ok' },
              h('h5', 'Code v2 (repeated) đọc dữ liệu v1 (optional 1 phần tử)'),
              pre({ interests: items.length ? [items[0]] : [] }),
              h('p', 'Trên đường truyền, repeated và optional có cùng định dạng tag + giá trị, nên v2 đọc 1 phần tử thành mảng 1 phần tử.')
            ),
            h('div', { class: 'card5 warn' },
              h('h5', 'Code v1 (optional) đọc dữ liệu v2 (repeated nhiều phần tử)'),
              pre({ interest: last }),
              h('p', `Code v1 thấy tag 3 xuất hiện ${items.length} lần liên tiếp, mỗi lần ghi đè lên biến đơn nên chỉ giữ lại phần tử cuối cùng ("${last || ''}").`)
            )
          )
        );
      }
    }
    render();
  });

  // ---------------------------------------------------------------- 5.7 avro-misread
  widget('avro-misread', (root) => {
    const rawBytes = segBytes(encAvro(SAMPLE));
    let wrong = 'correct';
    const sel = seg({
      options: [
        { value: 'correct', label: 'Đúng schema người ghi' },
        { value: 'swap', label: 'Đảo thứ tự: favoriteNumber đứng trước userName' },
        { value: 'noorion', label: 'Bỏ union: tưởng favoriteNumber là long thuần' },
        { value: 'intfirst', label: 'Tưởng trường đầu là array<long>' },
      ],
      value: wrong,
      onChange: (v) => { wrong = v; render(); },
    });
    const out = h('div');
    root.append(sel.el, out);

    function render() {
      clear(out);
      let status = 'ok', parsed = null, explain = '';
      if (wrong === 'correct') {
        parsed = { userName: 'Martin', favoriteNumber: 1337, interests: ['daydreaming', 'hacking'] };
        explain = 'Đọc tuần tự theo đúng thứ tự và kiểu trong schema người ghi: 32 byte khớp hoàn hảo.';
      } else if (wrong === 'swap') {
        const firstByte = rawBytes[0]; // 0x0c -> zigzag(6)
        parsed = {
          favoriteNumber: Number(unzigzag(BigInt(firstByte))),
          userName: 'Martin\x02\x72\x14\x04\x16daydreaming… (đọc lệch toàn bộ phần còn lại!)',
          error: 'CorruptedRead: byte độ dài chuỗi 0x0c bị hiểu nhầm thành favoriteNumber = 6!',
        };
        status = 'bad';
        explain = 'Vì Avro không có tag đánh dấu trường, byte đầu tiên 0x0c (vốn là độ dài 6 của chuỗi "Martin") bị bộ giải mã đọc thành số long = 6, rồi byte "M" (0x4d = zigzag 38) bị tưởng là độ dài chuỗi 38 byte — vượt quá cả bản ghi!';
      } else if (wrong === 'noorion') {
        parsed = {
          userName: 'Martin',
          favoriteNumber: 1,
          interests_corrupted: 'Byte giá trị 1337 (f2 14) bị đẩy sang trường mảng interests → đọc sai số phần tử mảng!',
        };
        status = 'bad';
        explain = 'Sau "Martin" là byte 0x02 (chọn nhánh long của union). Nếu không biết có union, bộ giải mã tưởng 0x02 chính là toàn bộ giá trị favoriteNumber (= 1), làm mọi byte phía sau trượt lệch 1 vị trí!';
      } else {
        parsed = {
          numbers: [77, -39, 57, 58, -53, 55, 1, -121],
          error: 'Đọc các byte ASCII của "Martin" như những số nguyên varint zigzag!',
        };
        status = 'bad';
        explain = 'Byte đầu 0x0c = khối mảng 6 phần tử; 6 byte tiếp theo ("M", "a", "r", "t", "i", "n") đều có bit cao = 0 nên bị đọc thành 6 số nguyên 1 byte hoàn toàn vô nghĩa mà không hề báo lỗi!';
      }
      out.append(
        h('div', { class: 'card5 ' + status },
          h('h5', '32 byte Avro nguyên bản: ', h('code', hexs(rawBytes))),
          pre(parsed),
          h('p', explain)
        )
      );
    }
    render();
  });

  // ---------------------------------------------------------------- 5.8 avro-resolve
  widget('avro-resolve', (root) => {
    const FIELDS = [
      { name: 'userName', type: 'string', val: 'Martin', def: '"anonymous"' },
      { name: 'favoriteNumber', type: 'union {null, long}', val: 1337, def: 'null' },
      { name: 'interests', type: 'array<string>', val: ['daydreaming', 'hacking'], def: '[]' },
      { name: 'photoUrl', type: 'union {null, string}', val: 'https://img.example/m.png', def: 'null' },
      { name: 'email', type: 'string', val: 'martin@example.org', def: null },
    ];
    let wFields = ['userName', 'favoriteNumber', 'interests', 'photoUrl'];
    let rFields = ['userName', 'interests', 'email_opt'];
    let reversed = false;

    const PRESETS = [
      { label: 'Thêm trường có default (Tương thích ngược)', w: ['userName', 'favoriteNumber', 'interests'], r: ['userName', 'favoriteNumber', 'interests', 'photoUrl'] },
      { label: 'Người ghi có trường mới (Tương thích xuôi)', w: ['userName', 'favoriteNumber', 'interests', 'photoUrl'], r: ['userName', 'favoriteNumber', 'interests'] },
      { label: 'Đảo thứ tự trường', w: ['interests', 'favoriteNumber', 'userName'], r: ['userName', 'favoriteNumber', 'interests'] },
      { label: 'Lỗi: Người đọc cần email (không có default)', w: ['userName', 'favoriteNumber'], r: ['userName', 'favoriteNumber', 'email'] },
    ];
    rFields = [...PRESETS[0].r];
    wFields = [...PRESETS[0].w];

    const prRow = h('div', { class: 'btn-row' },
      ...PRESETS.map((p) => button(p.label, () => { wFields = [...p.w]; rFields = [...p.r]; render(); }, 'ghost')),
      button('Đảo thứ tự bên ghi', () => { wFields.reverse(); reversed = !reversed; render(); }, 'ghost')
    );
    const vizBox = h('div', { class: 'viz' }), resBox = h('div'), stats = h('div', { class: 'stats' });
    root.append(prRow, vizBox, resBox, stats);

    function render() {
      const W = 680, H = Math.max(wFields.length, rFields.length) * 38 + 44;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Đối chiếu schema Avro' });
      svg.append(
        s('text', { x: 130, y: 20, 'text-anchor': 'middle', class: 'lbl-strong' }, "Writer's Schema (Người ghi)"),
        s('text', { x: 550, y: 20, 'text-anchor': 'middle', class: 'lbl-strong' }, "Reader's Schema (Người đọc)")
      );
      const wy = (i) => 46 + i * 36;
      const ry = (i) => 46 + i * 36;

      wFields.forEach((fName, wi) => {
        const ri = rFields.indexOf(fName);
        if (ri >= 0) {
          svg.appendChild(s('line', { x1: 240, y1: wy(wi), x2: 440, y2: ry(ri), class: 's-ok f-none', 'stroke-width': 2.2 }));
        }
      });

      wFields.forEach((fName, wi) => {
        const matched = rFields.includes(fName);
        const y = wy(wi);
        const g = s('g', null,
          s('rect', { x: 20, y: y - 14, width: 220, height: 28, rx: 6, class: matched ? 'f-ok s-ok' : 'f-surface2 s-line', 'stroke-width': 1.4 }),
          s('text', { x: 130, y: y + 4, 'text-anchor': 'middle', class: 'lbl-strong' }, fName + (matched ? '' : ' (bỏ qua)'))
        );
        svg.appendChild(g);
      });

      const outObj = {};
      let hasError = false;
      rFields.forEach((fName, ri) => {
        const fDef = FIELDS.find((x) => x.name === fName) || FIELDS[0];
        const inW = wFields.includes(fName);
        const y = ry(ri);
        let cls = 'f-ok s-ok', suffix = '';
        if (inW) {
          outObj[fName] = fDef.val;
        } else if (fDef.def !== null) {
          cls = 'f-mark-soft s-mark dash';
          suffix = ` (default: ${fDef.def})`;
          outObj[fName] = fDef.def === 'null' ? null : fDef.def;
        } else {
          cls = 'f-bad-soft s-bad';
          suffix = ' (THIẾU DEFAULT → LỖI!)';
          hasError = true;
        }
        svg.appendChild(s('g', null,
          s('rect', { x: 440, y: y - 14, width: 220, height: 28, rx: 6, class: cls, 'stroke-width': 1.5 }),
          s('text', { x: 550, y: y + 4, 'text-anchor': 'middle', class: 'lbl-strong' }, fName + suffix)
        ));
      });

      clear(vizBox).append(svg);
      clear(resBox).append(
        h('div', { class: 'card5 ' + (hasError ? 'bad' : 'ok') },
          h('h5', hasError ? 'Đối chiếu schema thất bại (SchemaResolutionException)' : 'Bản ghi sau khi Avro đối chiếu sang Reader Schema'),
          pre(hasError ? { error: 'Reader field "email" missing in writer schema and has no default value' } : outObj)
        )
      );
      clear(stats).append(
        stat('Khớp theo tên trường', `${rFields.filter((f) => wFields.includes(f)).length} trường`, 'ok'),
        stat('Trường người ghi bị bỏ qua', String(wFields.filter((f) => !rFields.includes(f)).length), 'accent'),
        stat('Trạng thái đối chiếu', hasError ? 'Lỗi thiếu default' : 'Thành công', hasError ? 'bad' : 'ok')
      );
    }
    render();
  });

  // ---------------------------------------------------------------- 5.9 schema-overhead
  widget('schema-overhead', (root) => {
    const SCHEMA_BYTES = 218;
    const REC_BYTES = 32;
    let count = 100, dbVer = 2;
    const sl = slider({ label: 'Số bản ghi cần truyền / lưu', min: 1, max: 1000, value: count, format: (v) => fmt(v) + ' bản ghi', onInput: (v) => { count = v; render(); } });
    const vSeg = seg({
      options: [
        { value: 1, label: 'Đọc bản ghi cũ (schema v1)' },
        { value: 2, label: 'Đọc bản ghi mới (schema v2 + photoUrl)' },
      ],
      value: dbVer,
      onChange: (v) => { dbVer = v; render(); },
    });
    const barsBox = h('div'), dbBox = h('div'), stats = h('div', { class: 'stats' });
    root.append(sl.el, barsBox, stats, dbBox);

    function render() {
      const naive = count * (SCHEMA_BYTES + REC_BYTES);
      const container = SCHEMA_BYTES + count * REC_BYTES;
      const registry = count * (4 + REC_BYTES);
      const rpc = SCHEMA_BYTES + count * REC_BYTES;
      const max = Math.max(naive, 1);

      clear(barsBox).append(
        h('div', { class: 'box' },
          h('h5', `Tổng dung lượng cho ${fmt(count)} bản ghi (mỗi bản ghi 32 B, schema JSON 218 B)`),
          hbars([
            { label: 'Kèm schema mỗi bản ghi (ngây thơ)', value: naive, text: fmt(naive) + ' B', tone: 'bad' },
            { label: 'Object container file (Hadoop, 1 lần ở đầu file)', value: container, text: fmt(container) + ' B', tone: 'ok' },
            { label: 'Database / Kafka (4 B version ID mỗi bản ghi)', value: registry, text: fmt(registry) + ' B', tone: 'cur' },
            { label: 'Avro RPC (thương lượng 1 lần lúc bắt tay)', value: rpc, text: fmt(rpc) + ' B', tone: 'ok' },
          ], max)
        )
      );

      clear(stats).append(
        stat('Dữ liệu thật (payload)', fmt(count * REC_BYTES) + ' B', 'ok'),
        stat('Overhead file container', pct(SCHEMA_BYTES / container, 1), 'accent', '1 header 218 B cho cả file'),
        stat('Overhead version ID (4 B)', pct((4 * count) / registry, 1), 'ok', 'tra schema trong registry')
      );

      clear(dbBox).append(
        h('div', { class: 'card5' },
          h('h5', 'Cách làm trong Database (Espresso / Confluent Schema Registry)', vSeg.el),
          h('div', { class: 'hexline' },
            'Bản ghi trên đĩa: ',
            h('span', { class: 'k-tag' }, `00 00 00 0${dbVer} (schema_id = v${dbVer})`),
            ' + ',
            h('span', { class: 'k-val' }, '0c 4d 61 72 74 69 6e 02 f2 14 … (32 byte Avro)')
          ),
          h('p', `Bước 1: Đọc 4 byte đầu thấy version = v${dbVer}. Bước 2: Tra Schema Registry lấy schema người ghi v${dbVer} (đã cache trong RAM). Bước 3: Đối chiếu với Reader Schema hiện tại của ứng dụng.`)
        )
      );
    }
    render();
  });

  // ---------------------------------------------------------------- 5.10 dyn-schema
  widget('dyn-schema', (root) => {
    const V1_COLS = ['id', 'name', 'email', 'created_at'];
    const V1_VALS = { id: 101, name: 'Alice', email: 'alice@example.com', created_at: '2024-01-10' };
    let hasName = false, hasPhone = true;
    const cbName = checkbox('Giữ cột "name" (bỏ chọn = đã DROP COLUMN name)', hasName, (v) => { hasName = v; render(); });
    const cbPhone = checkbox('Thêm cột "phone" ở cuối (ADD COLUMN phone)', hasPhone, (v) => { hasPhone = v; render(); });
    const split = h('div', { class: 'lab-split' });
    root.append(h('div', { class: 'controls' }, cbName.el, cbPhone.el), split);

    function render() {
      const v2Cols = ['id'];
      if (hasName) v2Cols.push('name');
      v2Cols.push('email', 'created_at');
      if (hasPhone) v2Cols.push('phone');

      const avroOut = {};
      v2Cols.forEach((c) => { avroOut[c] = c in V1_VALS ? V1_VALS[c] : null; });

      const pbOut = {};
      let pbCorrupt = false;
      v2Cols.forEach((c, idx) => {
        const oldColAtSameTag = V1_COLS[idx];
        pbOut[`tag_${idx + 1}_${c}`] = oldColAtSameTag ? V1_VALS[oldColAtSameTag] : null;
        if (oldColAtSameTag && oldColAtSameTag !== c) pbCorrupt = true;
      });

      clear(split).append(
        h('div', { class: 'card5 ok' },
          h('h5', 'Avro: Sinh lại schema theo TÊN cột', h('span', { class: 'pill ok' }, 'Đúng nghĩa')),
          h('p', `Cột hiện tại: ${v2Cols.join(', ')}`),
          pre(avroOut),
          h('p', 'Avro khớp trường theo tên cột: cột "name" bị xoá thì tự bỏ qua, cột "phone" mới thêm thì nhận default null.')
        ),
        h('div', { class: 'card5 ' + (pbCorrupt ? 'bad' : 'ok') },
          h('h5', 'Protobuf ngây thơ: Gán tag 1..N theo VỊ TRÍ cột', h('span', { class: 'pill ' + (pbCorrupt ? 'bad' : 'ok') }, pbCorrupt ? 'Lệch cột!' : 'Khớp')),
          h('p', `Ánh xạ tag mới: ${v2Cols.map((c, i) => `${i + 1}:${c}`).join(', ')}`),
          pre(pbOut),
          h('p', pbCorrupt ? 'THẢM HOẠ: Xoá cột "name" ở vị trí 2 làm "email" dồn lên nhận tag 2, nên giá trị cũ "Alice" (tag 2) bị đọc nhầm thành email!' : 'Chưa xoá cột ở giữa nên thứ tự tag chưa bị trượt.')
        )
      );
    }
    render();
  });

  // ---------------------------------------------------------------- 5.11 compat-check
  widget('compat-check', (root) => {
    const CHANGES = [
      { id: 'addDef', label: 'Thêm trường "loyaltyPoints" có giá trị mặc định = 0', back: true, fwd: true },
      { id: 'addNoDef', label: 'Thêm trường "taxId" bắt buộc (KHÔNG có default)', back: false, fwd: true },
      { id: 'remDef', label: 'Xoá trường "faxNumber" (trường này vốn có default)', back: true, fwd: true },
      { id: 'remNoDef', label: 'Xoá trường "userName" (trường KHÔNG có default)', back: true, fwd: false },
      { id: 'renameAlias', label: 'Đổi tên trường kèm khai báo alias tên cũ trong schema mới', back: true, fwd: false },
    ];
    const picked = new Set(['addDef']);
    let mode = 'FULL';
    const mSeg = seg({
      options: [
        { value: 'BACKWARD', label: 'BACKWARD (code mới đọc dữ liệu cũ)' },
        { value: 'FORWARD', label: 'FORWARD (code cũ đọc dữ liệu mới)' },
        { value: 'FULL', label: 'FULL (cả hai chiều)' },
      ],
      value: mode,
      onChange: (v) => { mode = v; render(); },
    });
    const listBox = h('div', { class: 'chk-list' });
    CHANGES.forEach((c) => {
      const cb = checkbox(c.label, picked.has(c.id), (v) => {
        if (v) picked.add(c.id); else picked.delete(c.id);
        render();
      });
      listBox.appendChild(cb.el);
    });
    const resBox = h('div'), stats = h('div', { class: 'stats' });
    root.append(mSeg.el, h('div', { class: 'box' }, h('h5', 'Các thay đổi trong Pull Request cập nhật Schema'), listBox), resBox, stats);

    function render() {
      const active = CHANGES.filter((c) => picked.has(c.id));
      const backOk = active.every((c) => c.back);
      const fwdOk = active.every((c) => c.fwd);
      const pass = mode === 'BACKWARD' ? backOk : mode === 'FORWARD' ? fwdOk : (backOk && fwdOk);

      clear(resBox).append(
        h('div', { class: 'card5 ' + (pass ? 'ok' : 'bad') },
          h('h5', `Schema Registry (${mode})`, h('span', { class: 'pill ' + (pass ? 'ok' : 'bad') }, pass ? 'CHO PHÉP DEPLOY' : 'CHẶN DEPLOY (REJECTED)')),
          active.length === 0
            ? h('p', 'Chưa chọn thay đổi nào.')
            : h('ul', { style: { margin: '4px 0', paddingLeft: '18px' } }, active.map((c) => h('li', `${c.label} → Ngược: ${c.back ? '✓' : '✗'}, Xuôi: ${c.fwd ? '✓' : '✗'}`)))
        )
      );
      clear(stats).append(
        stat('Tương thích ngược', backOk ? 'Đạt' : 'Vỡ', backOk ? 'ok' : 'bad'),
        stat('Tương thích xuôi', fwdOk ? 'Đạt' : 'Vỡ', fwdOk ? 'ok' : 'bad'),
        stat('Quyết định của CI/CD', pass ? 'Pass ✓' : 'Block ✗', pass ? 'ok' : 'bad')
      );
    }
    render();
  });

  // ---------------------------------------------------------------- 5.12 lost-field
  widget('lost-field', (root) => {
    let preserve = false;
    const cb = checkbox('Code v1 giữ lại các trường lạ (unknown fields) khi giải mã rồi ghi lại', preserve, (v) => { preserve = v; render(); });
    const out = h('div');
    root.append(cb.el, out);

    function render() {
      const step1 = { userName: 'Martin', interests: ['daydreaming'], photoUrl: 'https://cdn.example/m.jpg' };
      const step2Mem = preserve
        ? { userName: 'Martin', interests: ['daydreaming', 'hacking'], _unknownFields: { 'tag 4 (photoUrl)': 'https://cdn.example/m.jpg' } }
        : { userName: 'Martin', interests: ['daydreaming', 'hacking'] };
      const step3Db = preserve
        ? { userName: 'Martin', interests: ['daydreaming', 'hacking'], photoUrl: 'https://cdn.example/m.jpg' }
        : { userName: 'Martin', interests: ['daydreaming', 'hacking'] };

      clear(out).append(
        h('div', { class: 'grid3' },
          h('div', { class: 'card5 ok' },
            h('h5', '1. Tiến trình v2 ghi bản ghi có photoUrl'),
            pre(step1),
            h('p', 'Trường mới photoUrl (tag 4) được lưu xuống database.')
          ),
          h('div', { class: 'card5 warn' },
            h('h5', '2. Tiến trình v1 đọc lên RAM & sửa interests'),
            pre(step2Mem),
            h('p', preserve ? 'v1 không hiểu tag 4 nhưng giữ nguyên byte của tag 4 trong bộ đệm _unknownFields.' : 'ORM / model object của v1 không có thuộc tính photoUrl nên quẳng luôn tag 4 khi tạo object!')
          ),
          h('div', { class: 'card5 ' + (preserve ? 'ok' : 'bad') },
            h('h5', '3. Tiến trình v1 ghi đè bản ghi về lại DB'),
            pre(step3Db),
            h('p', preserve ? 'Đã giữ toàn vẹn trường photoUrl của v2!' : 'MẤT DỮ LIỆU THẦM LẶNG: photoUrl biến mất hoàn toàn khỏi database!')
          )
        )
      );
    }
    render();
  });

  // ---------------------------------------------------------------- 5.12b db-eras
  widget('db-eras', (root) => {
    let view = 'storage', migrated = false, snapshot = false;
    const vSeg = seg({
      options: [
        { value: 'storage', label: 'Byte thực tế trên đĩa (nhiều thời kỳ)' },
        { value: 'logical', label: 'Nhìn qua Schema hiện tại (v3, năm 2025)' },
      ],
      value: view,
      onChange: (v) => { view = v; render(); },
    });
    const bMig = button('Chạy migration viết lại toàn bộ bảng sang v3', () => { migrated = true; render(); }, 'ghost');
    const bSnap = button('Xuất snapshot ra file Avro/Parquet (schema v3)', () => { snapshot = true; render(); }, 'ghost');
    const bReset = button('Đặt lại', () => { migrated = false; snapshot = false; render(); }, 'ghost');
    const rowsBox = h('div'), stats = h('div', { class: 'stats' });
    root.append(h('div', { class: 'btn-row' }, vSeg.el, bMig, bSnap, bReset), rowsBox, stats);

    const RECORDS = [
      { id: 1, era: '2020 (schema v1)', v: 1, raw: { userName: 'An' }, cur: { userName: 'An', country: 'VN (default)', tier: 'free (default)' } },
      { id: 2, era: '2022 (schema v2)', v: 2, raw: { userName: 'Bình', country: 'US' }, cur: { userName: 'Bình', country: 'US', tier: 'free (default)' } },
      { id: 3, era: 'Hôm nay (schema v3)', v: 3, raw: { userName: 'Chi', country: 'JP', tier: 'pro' }, cur: { userName: 'Chi', country: 'JP', tier: 'pro' } },
    ];

    function render() {
      clear(rowsBox).append(
        h('div', { class: 'rowlist' },
          RECORDS.map((r) => {
            const verNow = migrated ? 3 : r.v;
            const dataShown = (view === 'logical' || migrated) ? r.cur : r.raw;
            return h('div', { class: 'rowitem' },
              h('span', { class: 'pill ' + (verNow === 3 ? 'ok' : 'accent') }, `Row #${r.id} · mã hoá v${verNow}`),
              h('span', `Ghi lúc: ${r.era}`),
              h('code', { class: 'mono' }, JSON.stringify(dataShown))
            );
          }),
          snapshot ? h('div', { class: 'card5 ok' }, h('h5', 'Bản chụp Snapshot / Data Warehouse (Avro Object Container / Parquet)'), h('p', 'Đằng nào cũng chép toàn bộ dữ liệu ra file lưu trữ mới, tiến trình dump mã hoá luôn cả 3 bản ghi theo schema v3 mới nhất để phân tích đồng nhất.')) : null
        )
      );
      clear(stats).append(
        stat('Số phiên bản cùng tồn tại trên đĩa', migrated ? '1 (đã viết lại hết)' : '3 (v1, v2, v3)', migrated ? 'warn' : 'ok', migrated ? 'tốn I/O viết lại bảng lớn' : 'Data outlives code'),
        stat('Chi phí ADD COLUMN', migrated ? 'Viết lại mọi hàng' : '0 lượt ghi đĩa', migrated ? 'bad' : 'ok', 'điền default lúc đọc')
      );
    }
    render();
  });

  // ---------------------------------------------------------------- 5.13 rest-soap
  widget('rest-soap', (root) => {
    let style = 'rest', userId = '42';
    const sSeg = seg({
      options: [
        { value: 'rest', label: 'REST + JSON' },
        { value: 'soap', label: 'SOAP + XML (WSDL)' },
        { value: 'grpc', label: 'gRPC + Protocol Buffers' },
      ],
      value: style,
      onChange: (v) => { style = v; render(); },
    });
    const inp = textInput(userId, (v) => { userId = v || '42'; render(); });
    const split = h('div', { class: 'lab-split' }), stats = h('div', { class: 'stats' });
    root.append(h('div', { class: 'controls' }, field('Tham số userId', inp), sSeg.el), split, stats);

    function render() {
      const reqRest = `GET /v1/users/${userId} HTTP/1.1\nHost: api.example.com\nAccept: application/json`;
      const resRest = `{\n  "userId": ${Number(userId) || 42},\n  "userName": "Martin",\n  "active": true\n}`;
      const reqSoap = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"\n                  xmlns:usr="http://example.com/userservice">\n  <soapenv:Header/>\n  <soapenv:Body>\n    <usr:GetUserRequest>\n      <usr:userId>${esc(userId)}</usr:userId>\n    </usr:GetUserRequest>\n  </soapenv:Body>\n</soapenv:Envelope>`;
      const resSoap = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"\n                  xmlns:usr="http://example.com/userservice">\n  <soapenv:Body>\n    <usr:GetUserResponse>\n      <usr:userId>${esc(userId)}</usr:userId>\n      <usr:userName>Martin</usr:userName>\n      <usr:active>true</usr:active>\n    </usr:GetUserResponse>\n  </soapenv:Body>\n</soapenv:Envelope>`;
      const reqGrpc = `// Protobuf binary frame (4 B):\n08 ${hex2(Number(userId) & 0x7f)}   // tag 1 (user_id) = ${userId}`;
      const resGrpc = `// Protobuf binary frame (12 B):\n08 ${hex2(Number(userId) & 0x7f)} 12 06 4d 61 72 74 69 6e 18 01`;

      const reqTxt = style === 'rest' ? reqRest : style === 'soap' ? reqSoap : reqGrpc;
      const resTxt = style === 'rest' ? resRest : style === 'soap' ? resSoap : resGrpc;
      const bLen = style === 'grpc' ? 16 : utf8(reqTxt + resTxt).length;

      clear(split).append(
        h('div', { class: 'card5' }, h('h5', 'Request gửi đi'), h('pre', { class: 'code' }, reqTxt)),
        h('div', { class: 'card5' }, h('h5', 'Response trả về'), h('pre', { class: 'code' }, resTxt))
      );
      clear(stats).append(
        stat('Tổng byte payload', bLen + ' B', style === 'grpc' ? 'ok' : style === 'soap' ? 'bad' : 'accent'),
        stat('Đọc/gỡ lỗi bằng curl & trình duyệt', style === 'rest' ? 'Rất dễ' : style === 'soap' ? 'Rườm rà XML' : 'Cần schema + công cụ nhị phân', style === 'rest' ? 'ok' : 'warn'),
        stat('Ngữ cảnh phù hợp nhất', style === 'rest' ? 'API công khai' : style === 'grpc' ? 'Nội bộ giữa các microservice' : 'Hệ thống enterprise cũ', 'accent')
      );
    }
    render();
  });

  // ---------------------------------------------------------------- 5.14 rpc-sim
  widget('rpc-sim', (root) => {
    let dropPct = 15, retries = 2, idem = false, seed = 1;
    const slDrop = slider({ label: 'Xác suất rớt mạng (mất request hoặc mất ACK)', min: 0, max: 40, value: dropPct, format: (v) => v + '%', onInput: (v) => { dropPct = v; render(); } });
    const slRet = slider({ label: 'Số lần client tự động retry khi timeout', min: 0, max: 3, value: retries, format: (v) => v + ' lần', onInput: (v) => { retries = v; render(); } });
    const cbIdem = checkbox('Gửi kèm Idempotency-Key (server khử trùng lặp khi nhận lại request cũ)', idem, (v) => { idem = v; render(); });
    const bRun = button('Chạy lại 20 lệnh chargeCard($100)', () => { seed++; render(); });
    const vizBox = h('div', { class: 'viz' }), stats = h('div', { class: 'stats' });
    root.append(h('div', { class: 'controls' }, slDrop.el, slRet.el), h('div', { class: 'btn-row' }, cbIdem.el, bRun), vizBox, stats);

    function render() {
      const r = rng(seed);
      const N = 20;
      let okOnce = 0, dupCharge = 0, failed = 0, unknownTimeout = 0;
      const results = [];

      for (let i = 0; i < N; i++) {
        let charges = 0, clientKnowsOk = false, attempts = 0;
        for (let a = 0; a <= retries; a++) {
          attempts++;
          const reqLost = r() < (dropPct / 100) * 0.5;
          if (reqLost) continue;
          if (!idem || charges === 0) charges++;
          const ackLost = r() < (dropPct / 100) * 0.6;
          if (!ackLost) { clientKnowsOk = true; break; }
        }
        if (charges > 1) dupCharge++;
        else if (charges === 1 && clientKnowsOk) okOnce++;
        else if (charges === 1 && !clientKnowsOk) unknownTimeout++;
        else failed++;
        results.push({ i: i + 1, charges, clientKnowsOk, attempts });
      }

      const W = 680, H = 92;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Kết quả 20 lệnh gọi RPC' });
      results.forEach((x, idx) => {
        const bx = 8 + idx * 33;
        const cls = x.charges > 1 ? 'f-bad s-bad' : (x.charges === 1 && !x.clientKnowsOk) ? 'f-warn s-warn' : x.charges === 1 ? 'f-ok s-ok' : 'f-surface2 s-line';
        svg.appendChild(s('rect', { x: bx, y: 12, width: 28, height: 48, rx: 5, class: cls, 'stroke-width': 1.4 }));
        svg.appendChild(s('text', { x: bx + 14, y: 34, 'text-anchor': 'middle', class: 'lbl-strong' }, '$' + (x.charges * 100)));
        svg.appendChild(s('text', { x: bx + 14, y: 52, 'text-anchor': 'middle' }, x.attempts + '×'));
        svg.appendChild(s('text', { x: bx + 14, y: 76, 'text-anchor': 'middle' }, '#' + x.i));
      });
      clear(vizBox).append(svg);

      clear(stats).append(
        stat('Trừ tiền đúng 1 lần ($100)', `${okOnce}/${N}`, 'ok'),
        stat('Trừ tiền LẶP ($200–$400)', String(dupCharge), dupCharge ? 'bad' : 'ok', dupCharge ? 'do mất ACK rồi retry không luỹ đẳng!' : 'an toàn nhờ Idempotency-Key'),
        stat('Client timeout nhưng server ĐÃ trừ', String(unknownTimeout), unknownTimeout ? 'warn' : 'ok', 'kết cục thứ 4 của mạng: không biết'),
        stat('Chưa tới được server ($0)', String(failed), failed ? 'warn' : 'ok')
      );
    }
    render();
  });

  // ---------------------------------------------------------------- 5.15 api-versions
  widget('api-versions', (root) => {
    const CHANGES = [
      { id: 'safe', label: 'Thêm trường mới vào response & thêm tham số request tuỳ chọn', reqBack: true, resFwd: true },
      { id: 'reqBreak', label: 'Thêm tham số BẮT BUỘC mới vào request', reqBack: false, resFwd: true },
      { id: 'resBreak', label: 'Đổi tên / xoá một trường đang dùng trong response', reqBack: true, resFwd: false },
    ];
    let cId = 'safe', style = 'url';
    const cSeg = seg({ options: CHANGES.map((c) => ({ value: c.id, label: c.label })), value: cId, onChange: (v) => { cId = v; render(); } });
    const vSeg = seg({
      options: [
        { value: 'url', label: 'Phiên bản trong URL (/v1/...)' },
        { value: 'header', label: 'Trong Header Accept / Custom' },
        { value: 'key', label: 'Ghim theo API Key ở server (Stripe)' },
      ],
      value: style,
      onChange: (v) => { style = v; render(); },
    });
    const mxBox = h('div', { class: 'mx' }), verBox = h('div');
    root.append(cSeg.el, mxBox, vSeg.el, verBox);

    function render() {
      const ch = CHANGES.find((x) => x.id === cId);
      const oldToNewOk = ch.reqBack && ch.resFwd;
      clear(mxBox).append(
        h('div', { class: 'hd' }, 'Client \\ Server'),
        h('div', { class: 'hd' }, 'Server v1 (trước nâng cấp)'),
        h('div', { class: 'hd' }, 'Server v2 (nâng cấp trước)'),
        h('div', { class: 'hd' }, 'Client v1 (cũ)'),
        h('div', { class: 'cell ok' }, h('b', 'Client v1 ↔ Server v1'), '✓ Cùng phiên bản v1'),
        h('div', { class: 'cell ' + (oldToNewOk ? 'ok' : 'bad') },
          h('b', 'Client v1 ↔ Server v2'),
          `Request (ngược): ${ch.reqBack ? '✓' : '✗ Vỡ'} · Response (xuôi): ${ch.resFwd ? '✓' : '✗ Vỡ'}`
        ),
        h('div', { class: 'hd' }, 'Client v2 (mới)'),
        h('div', { class: 'cell warn' }, h('b', 'Client v2 ↔ Server v1'), 'Không xảy ra nếu luôn nâng cấp Server trước Client'),
        h('div', { class: 'cell ok' }, h('b', 'Client v2 ↔ Server v2'), '✓ Cùng phiên bản v2')
      );

      const ex = style === 'url'
        ? 'GET /v2/charges/ch_101 HTTP/1.1\nHost: api.example.com\n// Đơn giản, dễ thấy trên trình duyệt & log, nhưng đổi URL khi nâng cấp.'
        : style === 'header'
          ? 'GET /charges/ch_101 HTTP/1.1\nAccept: application/vnd.example.v2+json\n// Giữ nguyên URL của tài nguyên, chọn phiên bản qua thương lượng nội dung (content negotiation).'
          : 'GET /charges/ch_101 HTTP/1.1\nAuthorization: Bearer sk_live_abc...\nStripe-Version: 2024-06-20   // tuỳ chọn ghi đè phiên bản đã ghim trong tài khoản';
      clear(verBox).append(h('div', { class: 'card5' }, h('h5', 'Cách chỉ định phiên bản REST API'), h('pre', { class: 'code' }, ex)));
    }
    render();
  });

  // ---------------------------------------------------------------- 5.16 broker-sim
  widget('broker-sim', (root) => {
    let mode = 'queue', bAlive = false, sent = 5, aGot = 3, bGot = 0, qBuf = 2, dropped = 0;
    const mSeg = seg({
      options: [
        { value: 'rpc', label: 'RPC trực tiếp (không có broker)' },
        { value: 'queue', label: 'Message Queue (chia tải cho các worker)' },
        { value: 'topic', label: 'Pub/Sub Topic (nhân bản cho mọi subscriber)' },
      ],
      value: mode,
      onChange: (v) => { mode = v; reset(); },
    });
    const cbB = checkbox('Consumer B đang sống (bỏ chọn = đang sập hoặc khởi động lại)', bAlive, (v) => {
      bAlive = v;
      if (bAlive && qBuf > 0) {
        bGot += qBuf;
        qBuf = 0;
      }
      render();
    });
    const bSend = button('Producer gửi thêm 1 thông điệp', () => {
      sent++;
      if (mode === 'rpc') {
        if (sent % 2 === 1) aGot++;
        else if (bAlive) bGot++;
        else dropped++;
      } else if (mode === 'queue') {
        if (bAlive && sent % 2 === 0) bGot++;
        else if (!bAlive && sent % 2 === 0) qBuf++;
        else aGot++;
      } else {
        aGot++;
        if (bAlive) bGot++;
        else qBuf++;
      }
      render();
    });
    const bReset = button('Đặt lại', reset, 'ghost');
    const vizBox = h('div', { class: 'viz' }), stats = h('div', { class: 'stats' });
    root.append(mSeg.el, h('div', { class: 'btn-row' }, cbB.el, bSend, bReset), vizBox, stats);

    function reset() {
      sent = 5;
      if (mode === 'rpc') { aGot = 3; bGot = bAlive ? 2 : 0; qBuf = 0; dropped = bAlive ? 0 : 2; }
      else if (mode === 'queue') { aGot = 3; bGot = bAlive ? 2 : 0; qBuf = bAlive ? 0 : 2; dropped = 0; }
      else { aGot = 5; bGot = bAlive ? 5 : 0; qBuf = bAlive ? 0 : 5; dropped = 0; }
      render();
    }

    function render() {
      const W = 680, H = 140;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Mô phỏng Message Broker' });
      svg.append(
        s('rect', { x: 20, y: 46, width: 130, height: 48, rx: 8, class: 'f-accent-soft s-accent', 'stroke-width': 1.5 }),
        s('text', { x: 85, y: 74, 'text-anchor': 'middle', class: 'lbl-strong' }, `Producer (${sent})`),
        s('rect', { x: 245, y: 36, width: 180, height: 68, rx: 8, class: mode === 'rpc' ? 'f-surface2 s-line dash' : 'f-mark-soft s-mark', 'stroke-width': 1.5 }),
        s('text', { x: 335, y: 64, 'text-anchor': 'middle', class: 'lbl-strong' }, mode === 'rpc' ? 'Mạng trực tiếp' : mode === 'queue' ? 'Broker Queue' : 'Broker Topic'),
        s('text', { x: 335, y: 84, 'text-anchor': 'middle' }, mode === 'rpc' ? `Rớt: ${dropped}` : `Đang đệm: ${qBuf} msg`),
        s('rect', { x: 510, y: 16, width: 150, height: 44, rx: 8, class: 'f-ok s-ok', 'stroke-width': 1.5 }),
        s('text', { x: 585, y: 42, 'text-anchor': 'middle', class: 'lbl-strong' }, `Consumer A: ${aGot}`),
        s('rect', { x: 510, y: 80, width: 150, height: 44, rx: 8, class: bAlive ? 'f-ok s-ok' : 'f-bad-soft s-bad dash', 'stroke-width': 1.5 }),
        s('text', { x: 585, y: 106, 'text-anchor': 'middle', class: 'lbl-strong' }, `Consumer B (${bAlive ? 'ON' : 'SẬP'}): ${bGot}`),
        s('line', { x1: 150, y1: 70, x2: 245, y2: 70, class: 's-accent f-none', 'stroke-width': 2 }),
        s('line', { x1: 425, y1: 55, x2: 510, y2: 38, class: 's-ok f-none', 'stroke-width': 2 }),
        s('line', { x1: 425, y1: 85, x2: 510, y2: 102, class: (bAlive ? 's-ok' : 's-bad dash') + ' f-none', 'stroke-width': 2 })
      );
      clear(vizBox).append(svg);

      clear(stats).append(
        stat('Thông điệp đã gửi', String(sent), 'accent'),
        stat('Đang giữ trong Broker', String(qBuf), qBuf ? 'warn' : 'ok', bAlive ? 'đã giao hết cho B' : 'chờ B sống lại để giao'),
        stat('Thông điệp bị mất', String(dropped), dropped ? 'bad' : 'ok', mode === 'rpc' ? 'RPC lỗi khi B sập' : 'Broker đệm hộ nên không mất')
      );
    }
    render();
  });

  // ---------------------------------------------------------------- 5.16b actor-upgrade
  widget('actor-upgrade', (root) => {
    let ser = 'java', n2v2 = false, n3v2 = false;
    const sSeg = seg({
      options: [
        { value: 'java', label: 'Akka mặc định (Java Serializable) / Orleans mặc định' },
        { value: 'protobuf', label: 'Cắm serializer Protocol Buffers / Avro' },
      ],
      value: ser,
      onChange: (v) => { ser = v; render(); },
    });
    const cb2 = checkbox('Nâng cấp Node 2 lên v2', n2v2, (v) => { n2v2 = v; render(); });
    const cb3 = checkbox('Nâng cấp Node 3 lên v2', n3v2, (v) => { n3v2 = v; render(); });
    const vizBox = h('div', { class: 'viz' }), stats = h('div', { class: 'stats' });
    root.append(sSeg.el, h('div', { class: 'controls' }, cb2.el, cb3.el), vizBox, stats);

    function render() {
      const vers = ['v2', n2v2 ? 'v2' : 'v1', n3v2 ? 'v2' : 'v1'];
      const W = 640, H = 175;
      const pos = [[140, 42], [500, 42], [320, 138]];
      const pairs = [[0, 1], [1, 2], [0, 2]];
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Cụm 3 node actor khi rolling upgrade' });

      let okLinks = 0;
      pairs.forEach(([a, b]) => {
        const same = vers[a] === vers[b];
        const ok = same || ser === 'protobuf';
        if (ok) okLinks++;
        const [x1, y1] = pos[a], [x2, y2] = pos[b];
        svg.appendChild(s('line', { x1, y1, x2, y2, class: (ok ? 's-ok' : 's-bad dash') + ' f-none', 'stroke-width': 2.4 }));
        svg.appendChild(s('text', { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 6, 'text-anchor': 'middle', class: 'lbl-strong' }, ok ? '✓ thông điệp OK' : '✗ lỗi giải mã!'));
      });

      pos.forEach(([x, y], i) => {
        const isV2 = vers[i] === 'v2';
        svg.appendChild(s('rect', { x: x - 70, y: y - 20, width: 140, height: 40, rx: 8, class: isV2 ? 'f-accent-soft s-accent' : 'f-surface s-ink3', 'stroke-width': 1.6 }));
        svg.appendChild(s('text', { x, y: y + 5, 'text-anchor': 'middle', class: 'lbl-strong' }, `Actor Node ${i + 1} (${vers[i]})`));
      });
      clear(vizBox).append(svg);

      clear(stats).append(
        stat('Trạng thái cụm', vers.join(' · '), 'accent'),
        stat('Kênh giao tiếp actor sống', `${okLinks} / 3 cặp node`, okLinks === 3 ? 'ok' : 'bad'),
        stat('Rolling upgrade không downtime?', ser === 'protobuf' ? 'Được ✓' : okLinks === 3 ? 'Chỉ khi cùng version' : 'Vỡ khi trộn v1 & v2!', ser === 'protobuf' ? 'ok' : 'bad')
      );
    }
    render();
  });

  // ---------------------------------------------------------------- Glossary
  glossary.add([
    { key: 'rolling-upgrade', term: 'Rolling upgrade (staged rollout)', vi: 'nâng cấp cuốn chiếu', ch: 5, topic: 'ch5-compat', def: 'Triển khai phiên bản code mới lần lượt lên từng vài node một thay vì tắt toàn bộ hệ thống, đòi hỏi code cũ và code mới phải chung sống được.' },
    { key: 'backward-compat', term: 'Backward compatibility', vi: 'tương thích ngược', ch: 5, topic: 'ch5-compat', def: 'Code mới đọc được dữ liệu do code cũ đã ghi trước đó.' },
    { key: 'forward-compat', term: 'Forward compatibility', vi: 'tương thích xuôi', ch: 5, topic: 'ch5-compat', def: 'Code cũ đọc được dữ liệu do code mới ghi (thường bằng cách bỏ qua những trường hoặc nhánh mới mà code cũ chưa biết).' },
    { key: 'evolvability', term: 'Evolvability', vi: 'khả năng tiến hoá', ch: 5, topic: 'ch5-compat', def: 'Mức độ dễ dàng thay đổi schema dữ liệu và logic ứng dụng khi yêu cầu nghiệp vụ thay đổi mà không làm gián đoạn hệ thống.' },
    { key: 'encoding', term: 'Encoding (serialization / marshalling)', vi: 'mã hoá dữ liệu', ch: 5, topic: 'ch5-language', def: 'Quá trình chuyển cấu trúc dữ liệu trong bộ nhớ (có con trỏ) thành chuỗi byte tự chứa để ghi ra đĩa hoặc gửi qua mạng.' },
    { key: 'decoding', term: 'Decoding (parsing / deserialization / unmarshalling)', vi: 'giải mã dữ liệu', ch: 5, topic: 'ch5-language', def: 'Quá trình đọc chuỗi byte từ file hoặc mạng và khôi phục lại thành cấu trúc dữ liệu trong bộ nhớ.' },
    { key: 'serialization', term: 'Serialization', vi: 'tuần tự hoá (serialization)', ch: 5, topic: 'ch5-language', def: 'Tên gọi khác của encoding dữ liệu thành chuỗi byte (khác với khái niệm serializability trong giao dịch cơ sở dữ liệu).' },
    { key: 'insecure-deserialization', term: 'Insecure deserialization', vi: 'giải mã dữ liệu không tin cậy', ch: 5, topic: 'ch5-language', def: 'Lỗ hổng bảo mật nghiêm trọng khi bộ giải mã (như pickle hay Java Serializable) khởi tạo class tuỳ ý từ chuỗi byte của kẻ tấn công, dẫn tới thực thi mã từ xa (RCE).' },
    { key: 'base64', term: 'Base64 encoding', vi: 'mã hoá Base64', ch: 5, topic: 'ch5-json', def: 'Cách biểu diễn mảng byte nhị phân bất kỳ thành chuỗi ký tự ASCII an toàn để nhúng vào JSON/XML, làm kích thước dữ liệu tăng khoảng 33%.' },
    { key: 'messagepack', term: 'MessagePack', vi: 'MessagePack', ch: 5, topic: 'ch5-binary', def: 'Định dạng mã hoá nhị phân cho dữ liệu kiểu JSON; gọn hơn JSON văn bản một chút nhưng vẫn phải lưu đầy đủ chuỗi tên trường vì không có schema.' },
    { key: 'thrift', term: 'Apache Thrift', vi: 'Apache Thrift', ch: 5, topic: 'ch5-thrift-protobuf', def: 'Framework mã hoá nhị phân và RPC dựa trên schema (gốc từ Facebook), có BinaryProtocol và CompactProtocol dùng field tag thay cho tên trường.' },
    { key: 'protobuf', term: 'Protocol Buffers (Protobuf)', vi: 'Protocol Buffers', ch: 5, topic: 'ch5-thrift-protobuf', def: 'Định dạng mã hoá nhị phân dựa trên schema của Google, thay tên trường bằng số field tag và dùng varint để đóng gói rất gọn.' },
    { key: 'idl', term: 'Interface Definition Language (IDL)', vi: 'ngôn ngữ định nghĩa giao diện', ch: 5, topic: 'ch5-thrift-protobuf', def: 'Ngôn ngữ độc lập dùng để khai báo schema dữ liệu và giao diện dịch vụ (trong Thrift, Protobuf, Avro), từ đó sinh code cho các ngôn ngữ lập trình.' },
    { key: 'field-tag', term: 'Field tag', vi: 'số định danh trường (field tag)', ch: 5, topic: 'ch5-thrift-protobuf', def: 'Con số nguyên (1, 2, 3…) gắn với mỗi trường trong schema Thrift/Protobuf; được ghi vào dữ liệu nhị phân thay cho tên trường để tiết kiệm dung lượng và cho phép đổi tên trường.' },
    { key: 'varint', term: 'Variable-length integer (varint)', vi: 'số nguyên độ dài thay đổi', ch: 5, topic: 'ch5-thrift-protobuf', def: 'Cách mã hoá số nguyên dùng 7 bit mỗi byte cho giá trị và bit thứ 8 làm cờ báo còn byte tiếp theo, giúp số nhỏ chỉ tốn 1–2 byte thay vì 4 hay 8 byte cố định.' },
    { key: 'schema-evolution', term: 'Schema evolution', vi: 'tiến hoá schema', ch: 5, topic: 'ch5-field-tags', def: 'Khả năng thay đổi schema theo thời gian (thêm/xoá/đổi tên trường) mà vẫn giữ được tính tương thích ngược và xuôi giữa dữ liệu và code các phiên bản.' },
    { key: 'avro', term: 'Apache Avro', vi: 'Apache Avro', ch: 5, topic: 'ch5-avro', def: 'Định dạng mã hoá nhị phân dựa trên schema (ra đời trong hệ sinh thái Hadoop) không ghi cả tên trường lẫn field tag vào dữ liệu mà đối chiếu trực tiếp schema người ghi và người đọc.' },
    { key: 'writer-schema', term: "Writer's schema", vi: 'schema của người ghi', ch: 5, topic: 'ch5-avro-resolution', def: 'Phiên bản schema thực tế đã được tiến trình ghi dùng để mã hoá một bản ghi Avro.' },
    { key: 'reader-schema', term: "Reader's schema", vi: 'schema của người đọc', ch: 5, topic: 'ch5-avro-resolution', def: 'Phiên bản schema mà code của tiến trình đọc đang mong đợi; thư viện Avro sẽ tự động ánh xạ dữ liệu từ writer schema sang reader schema.' },
    { key: 'schema-resolution', term: 'Schema resolution', vi: 'đối chiếu và dịch schema', ch: 5, topic: 'ch5-avro-resolution', def: 'Cơ chế của Avro đặt writer schema và reader schema cạnh nhau, khớp các trường theo tên để bỏ qua trường thừa và điền giá trị mặc định cho trường mới.' },
    { key: 'default-value', term: 'Default value', vi: 'giá trị mặc định', ch: 5, topic: 'ch5-avro-resolution', def: 'Giá trị được điền khi schema của người đọc có trường mới mà bản ghi cũ của người ghi chưa có.' },
    { key: 'union-type', term: 'Union type', vi: 'kiểu hợp (union)', ch: 5, topic: 'ch5-avro-resolution', def: 'Kiểu trong Avro cho phép một trường nhận một trong nhiều kiểu dữ liệu khác nhau, ví dụ union { null, long } để cho phép giá trị null một cách tường minh.' },
    { key: 'object-container-file', term: 'Avro object container file', vi: 'file container tự mô tả của Avro', ch: 5, topic: 'ch5-writer-schema', def: 'Định dạng file lưu hàng loạt bản ghi Avro (thường dùng trong Hadoop), trong đó writer schema được nhúng một lần duy nhất ở phần đầu file.' },
    { key: 'schema-registry', term: 'Schema registry', vi: 'kho lưu trữ và quản lý schema', ch: 5, topic: 'ch5-writer-schema', def: 'Dịch vụ trung tâm lưu các phiên bản schema kèm ID số và kiểm tra quy tắc tương thích xuôi/ngược trước khi cho phép đăng ký schema mới.' },
    { key: 'dynamic-schema', term: 'Dynamically generated schema', vi: 'schema sinh tự động', ch: 5, topic: 'ch5-dynamic-schema', def: 'Schema được tạo tự động lúc chạy từ một nguồn khác (như lấy thẳng tên cột từ bảng SQL khi dump database sang file Avro) mà không cần gán field tag bằng tay.' },
    { key: 'code-generation', term: 'Code generation', vi: 'sinh mã nguồn từ schema', ch: 5, topic: 'ch5-dynamic-schema', def: 'Biên dịch schema IDL thành các class trong ngôn ngữ kiểu tĩnh (Java, C++, Go, Rust) để kiểm tra kiểu ngay lúc biên dịch.' },
    { key: 'asn1', term: 'ASN.1 (Abstract Syntax Notation One)', vi: 'chuẩn mô tả schema ASN.1', ch: 5, topic: 'ch5-merits', def: 'Chuẩn định nghĩa schema có từ năm 1984 (dùng mã hoá nhị phân DER trong chứng chỉ SSL/X.509), tiền thân của ý tưởng dùng số tag nhưng rất phức tạp.' },
    { key: 'data-outlives-code', term: 'Data outlives code', vi: 'dữ liệu sống lâu hơn code', ch: 5, topic: 'ch5-dataflow-db', def: 'Thực tế trong database: code mới có thể thay thế code cũ chỉ trong vài phút deploy, nhưng các bản ghi được viết từ nhiều năm trước vẫn nằm trên đĩa ở định dạng cũ.' },
    { key: 'microservices', term: 'Service-oriented / microservices architecture', vi: 'kiến trúc hướng dịch vụ / microservices', ch: 5, topic: 'ch5-services', def: 'Cách chia ứng dụng thành nhiều dịch vụ nhỏ triển khai và tiến hoá độc lập, giao tiếp với nhau qua mạng bằng API.' },
    { key: 'rest', term: 'REST (Representational State Transfer)', vi: 'triết lý thiết kế API REST', ch: 5, topic: 'ch5-services', def: 'Phong cách thiết kế API tận dụng trực tiếp các nguyên lý của HTTP (URL định danh tài nguyên, phương thức chuẩn, header, mã trạng thái).' },
    { key: 'soap', term: 'SOAP', vi: 'giao thức SOAP', ch: 5, topic: 'ch5-services', def: 'Giao thức web service dựa trên XML và các chuẩn WS-*, đóng gói lời gọi trong phong bì XML và mô tả bằng WSDL.' },
    { key: 'openapi', term: 'OpenAPI (Swagger)', vi: 'đặc tả OpenAPI / Swagger', ch: 5, topic: 'ch5-services', def: 'Định dạng chuẩn để mô tả các endpoint, tham số và cấu trúc JSON của RESTful API phục vụ làm tài liệu và sinh SDK.' },
    { key: 'wsdl', term: 'WSDL (Web Services Description Language)', vi: 'ngôn ngữ mô tả dịch vụ WSDL', ch: 5, topic: 'ch5-services', def: 'Định dạng XML mô tả giao diện của dịch vụ SOAP để trình biên dịch tự sinh code client gọi từ xa.' },
    { key: 'rpc', term: 'Remote Procedure Call (RPC)', vi: 'gọi thủ tục từ xa (RPC)', ch: 5, topic: 'ch5-rpc', def: 'Mô hình cho phép tiến trình này gọi một hàm chạy trên máy khác qua mạng gần giống như gọi hàm cục bộ.' },
    { key: 'location-transparency', term: 'Location transparency', vi: 'tính trong suốt vị trí', ch: 5, topic: 'ch5-rpc', def: 'Ý tưởng che giấu việc một lời gọi chạy cục bộ trong bộ nhớ hay đi qua mạng; thường là ảo tưởng nguy hiểm trong RPC vì lỗi mạng và độ trễ hoàn toàn khác gọi hàm cục bộ.' },
    { key: 'timeout', term: 'Timeout', vi: 'hết thời gian chờ (timeout)', ch: 5, topic: 'ch5-rpc', def: 'Ngưỡng thời gian tối đa client chờ phản hồi qua mạng trước khi bỏ cuộc; khi bị timeout, client không thể biết server đã thực thi request hay chưa.' },
    { key: 'idempotence', term: 'Idempotence', vi: 'tính luỹ đẳng (idempotence)', ch: 5, topic: 'ch5-rpc', def: 'Tính chất của một thao tác mà thực hiện một lần hay lặp lại nhiều lần (do retry) cũng chỉ tạo ra đúng một kết quả như nhau, không gây tác dụng phụ kép.' },
    { key: 'future', term: 'Future (Promise)', vi: 'đối tượng Future / Promise', ch: 5, topic: 'ch5-rpc', def: 'Trừu tượng trong lập trình đại diện cho một kết quả bất đồng bộ sẽ có (hoặc thất bại) trong tương lai, thể hiện rõ bản chất gọi qua mạng.' },
    { key: 'service-discovery', term: 'Service discovery', vi: 'khám phá dịch vụ', ch: 5, topic: 'ch5-rpc', def: 'Cơ chế giúp client tìm ra địa chỉ IP và cổng hiện tại của các instance đang chạy một dịch vụ đích.' },
    { key: 'api-versioning', term: 'API versioning', vi: 'quản lý phiên bản API', ch: 5, topic: 'ch5-api-evolution', def: 'Kỹ thuật duy trì nhiều phiên bản API song song (qua URL /v1, header Accept, hoặc cấu hình gắn với API key) khi không thể ép mọi client nâng cấp cùng lúc.' },
    { key: 'message-broker', term: 'Message broker', vi: 'bộ trung chuyển thông điệp', ch: 5, topic: 'ch5-messages', def: 'Hệ thống trung gian (như RabbitMQ, Kafka) nhận thông điệp từ producer, lưu đệm tạm thời và phân phối bất đồng bộ tới một hoặc nhiều consumer.' },
    { key: 'actor-model', term: 'Actor model', vi: 'mô hình lập trình Actor', ch: 5, topic: 'ch5-messages', def: 'Mô hình xử lý đồng thời và phân tán trong đó mỗi thực thể (actor) có trạng thái đóng kín và chỉ giao tiếp với nhau bằng cách gửi thông điệp bất đồng bộ (như Erlang, Akka, Orleans).' },
    { key: 'queue-topic', term: 'Queue and Topic', vi: 'hàng đợi (queue) và chủ đề (topic)', ch: 5, topic: 'ch5-messages', def: 'Đích danh tên trong message broker nơi producer gửi thông điệp vào và các consumer đăng ký đọc hoặc chia sẻ tải xử lý.' },
  ]);
})();
