/* Chương 8 — Transactions (nguồn: ấn bản 1, Chương 7) */
(function () {
  'use strict';
  const { h, s, clear, fmt, fmtBig, pct, rng, percentile, slider, seg, button, checkbox, stat, log, widget, glossary, sleep } = window.DDIA;

  const tm = (x) => String(Math.floor(x)).padStart(2, '0') + ':' + String(Math.round((x % 1) * 60)).padStart(2, '0');
  const usd = (v) => '$' + fmt(v);
  const ctl = (label, el) => h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, label), el);
  const pill = (text, tone) => h('span', { class: 'pill' + (tone ? ' ' + tone : '') }, text);
  const verdictBox = (v) => h('div', { class: 'verdict ' + (v.tone || '') }, h('b', v.title), h('p', v.text));

  /* =====================================================================
   * Interleaving scheduler: a tiny simulated database with several
   * isolation levels. Two transactions = two columns of operations.
   * ===================================================================== */
  const LEVEL_LABEL = {
    none: 'Không cô lập', ru: 'Read uncommitted', rc: 'Read committed', 'si-nd': 'Snapshot (MySQL)',
    si: 'Snapshot isolation', '2pl': 'Serializable · 2PL', ssi: 'Serializable · SSI',
  };

  function makeSim(sc, o) {
    const level = o.level;
    const rows = new Map();
    const status = new Map([[0, 'committed']]);
    const txns = [];
    const cols = [];
    const events = [];
    const notes = [];
    const locks = new Map();
    let plocks = [];
    let nextId = sc.baseTxid || 1;
    let pos = 0;
    const seq = o.seq || [];
    const readMode = level === 'none' || level === 'ru' ? 'any' : level === 'rc' || level === '2pl' ? 'committed' : 'snap';
    const locking = level !== 'none';
    const pgSnap = level === 'si' || level === 'ssi'; // PostgreSQL-style: detects concurrent updates
    const tag = (T) => 'T' + T.id;
    const ev = (text, tone) => events.push({ text, tone });
    const st = (id) => status.get(id) || 'active';
    const byId = (id) => txns.find((t) => t.id === id);
    const fv = (row, v) => sc.fmt(row, v);

    sc.rows(o).forEach((r) => rows.set(r.id, { id: r.id, table: r.table, label: r.label, versions: [{ val: r.val, by: 0 }] }));
    sc.txns(o).forEach((d, i) => newAttempt(i));

    function newAttempt(i) {
      const d = sc.txns(o)[i];
      const prev = cols[i] || null;
      const T = {
        id: nextId++, col: i, name: d.name, short: d.short || d.name, ops: d.ops, pc: 0, ctx: {}, status: 'idle', snap: null,
        res: [], locks: new Set(), wrote: new Set(), reads: [], ignored: [], readLog: [], attempt: prev ? prev.attempt + 1 : 1, prev, waitFor: null,
      };
      txns.push(T);
      cols[i] = T;
      if (prev) ev(`${d.name} thử lại bằng giao dịch mới ${tag(T)}`, 'acc');
      return T;
    }

    // ---- MVCC visibility ----
    function ownVer(row, T) { for (let i = row.versions.length - 1; i >= 0; i--) if (row.versions[i].by === T.id) return row.versions[i]; return null; }
    function ver(row, T, mode) {
      const own = T && ownVer(row, T);
      if (own) return own;
      for (let i = row.versions.length - 1; i >= 0; i--) {
        const v = row.versions[i];
        const sv = st(v.by);
        if (sv === 'aborted') continue;
        if (mode === 'any') return v;
        if (mode === 'committed' && sv === 'committed') return v;
        if (mode === 'snap' && T && T.snap.has(v.by)) return v;
      }
      return null;
    }
    const valOf = (v) => (v ? v.val : null);
    function concurrentWriter(T, row) {
      const v = row.versions.find((x) => x.by !== T.id && x.by !== 0 && st(x.by) === 'committed' && !T.snap.has(x.by));
      return v ? byId(v.by) : null;
    }

    // ---- locks ----
    function L(id) { if (!locks.has(id)) locks.set(id, { S: new Set(), X: null }); return locks.get(id); }
    function getX(T, id) {
      const l = L(id);
      const b = new Set();
      if (l.X != null && l.X !== T.id) b.add(l.X);
      if (level === '2pl') l.S.forEach((x) => { if (x !== T.id) b.add(x); });
      if (b.size) return b;
      l.X = T.id; l.S.delete(T.id); T.locks.add(id);
      return null;
    }
    function getS(T, id) {
      const l = L(id);
      if (l.X != null && l.X !== T.id) return new Set([l.X]);
      if (l.X !== T.id) l.S.add(T.id);
      T.locks.add(id);
      return null;
    }
    function predBlockers(T, table, vals) {
      const b = new Set();
      if (level !== '2pl') return b;
      plocks.forEach((p) => { if (p.by !== T.id && p.table === table && vals.some((v) => v != null && p.pred(v))) b.add(p.by); });
      return b;
    }
    function predLock(T, op) {
      const b = new Set();
      rows.forEach((r) => {
        if (r.table !== op.table) return;
        const l = locks.get(r.id);
        if (!l || l.X == null || l.X === T.id) return;
        if (r.versions.some((v) => st(v.by) !== 'aborted' && v.val != null && op.pred(v.val))) b.add(l.X);
      });
      if (b.size) return b;
      if (!plocks.some((p) => p.by === T.id && p.label === op.label)) plocks.push({ by: T.id, table: op.table, pred: op.pred, label: op.label, desc: op.desc || op.table });
      return null;
    }
    function release(T) {
      T.locks.forEach((id) => { const l = locks.get(id); if (!l) return; if (l.X === T.id) l.X = null; l.S.delete(T.id); });
      T.locks.clear();
      plocks = plocks.filter((p) => p.by !== T.id);
    }

    // ---- SSI bookkeeping ----
    function covers(T, row) {
      return T.reads.some((rd) => (rd.kind === 'row' ? rd.id === row.id : rd.table === row.table && row.versions.some((v) => v.val != null && rd.pred(v.val))));
    }
    function recordIgnored(T, row, chosen) {
      row.versions.forEach((v) => {
        if (v === chosen || v.by === T.id || v.by === 0 || st(v.by) === 'aborted') return;
        if (chosen && row.versions.indexOf(v) < row.versions.indexOf(chosen)) return;
        if (!T.ignored.some((g) => g.id === row.id && g.by === v.by)) {
          T.ignored.push({ id: row.id, by: v.by });
          notes.push(`${tag(T)} đọc ${row.label}: MVCC bỏ qua ghi chưa commit của T${v.by} → ghi nhận lại`);
        }
      });
    }
    function tripwire(T, row) {
      if (level !== 'ssi') return;
      txns.forEach((U) => {
        if (U === T || (U.status !== 'active' && U.status !== 'waiting')) return;
        if (covers(U, row)) notes.push(`${tag(T)} ghi ${row.label}: ${tag(U)} đã đọc dữ liệu này → báo “tiền đề của ${tag(U)} có thể đã cũ” (không chặn ai)`);
      });
    }
    function ssiCheck(T) {
      for (const U of txns) {
        if (U === T || U.status !== 'committed' || T.snap.has(U.id)) continue;
        for (const id of U.wrote) {
          const row = rows.get(id);
          if (!row || !covers(T, row)) continue;
          const stale = T.ignored.some((g) => g.by === U.id && g.id === id);
          return stale
            ? `SSI: lúc ${tag(T)} đọc, ${tag(U)} đã ghi ${row.label} nhưng chưa commit (MVCC bỏ qua). Nay ${tag(U)} đã commit → tiền đề của ${tag(T)} đã cũ → huỷ`
            : `SSI: ${tag(U)} ghi ${row.label} sau khi ${tag(T)} đọc và đã commit trước → tiền đề của ${tag(T)} đã cũ → huỷ`;
        }
      }
      return null;
    }

    function put(T, row, val) {
      const own = ownVer(row, T);
      if (own) own.val = val; else row.versions.push({ val, by: T.id });
      T.wrote.add(row.id);
      tripwire(T, row);
    }
    const lockedReadMode = () => (pgSnap ? 'snap' : 'committed');

    // ---- operation semantics ----
    function exec(T, op) {
      const c = T.ctx;
      if (op.guard && !op.guard(c)) return { appAbort: op.guardFail || 'Điều kiện không thoả → ứng dụng ROLLBACK' };
      switch (op.type) {
        case 'read': {
          const row = rows.get(op.id);
          const fu = op.forUpdate && locking;
          if (fu) {
            const b = getX(T, row.id); if (b) return { wait: b };
            if (pgSnap) { const U = concurrentWriter(T, row); if (U) return { abort: `${tag(U)} đã sửa ${row.label} sau khi ${tag(T)} bắt đầu → lỗi “could not serialize access”, huỷ ${tag(T)}` }; }
          } else if (level === '2pl') { const b = getS(T, row.id); if (b) return { wait: b }; }
          const v = ver(row, T, fu ? lockedReadMode() : readMode);
          const dirty = !!(v && v.by !== T.id && st(v.by) !== 'committed');
          if (level === 'ssi') { T.reads.push({ kind: 'row', id: row.id }); recordIgnored(T, row, v); }
          c[op.into] = valOf(v);
          T.readLog.push({ into: op.into, val: valOf(v), dirty });
          return { text: '→ ' + fv(row, valOf(v)) + (dirty ? ' (chưa commit!)' : '') + (fu ? ' · khoá dòng' : ''), tone: dirty ? 'bad' : '' };
        }
        case 'query': {
          const cand = [...rows.values()].filter((r) => r.table === op.table && r.versions.length);
          const fu = op.forUpdate && locking;
          let lockedN = 0;
          if (fu) {
            const match = cand.filter((r) => [ver(r, T, readMode), ver(r, T, 'committed')].some((v) => v && v.val != null && op.pred(v.val)));
            for (const r of match) { const b = getX(T, r.id); if (b) return { wait: b }; }
            if (pgSnap) for (const r of match) { const U = concurrentWriter(T, r); if (U) return { abort: `${tag(U)} đã sửa ${r.label} sau khi ${tag(T)} bắt đầu → lỗi “could not serialize access”, huỷ ${tag(T)}` }; }
            lockedN = match.length;
          }
          if (level === '2pl') {
            const b = predLock(T, op); if (b) return { wait: b };
            for (const r of cand) { const v = ver(r, T, 'committed'); if (v && v.val != null && op.pred(v.val)) { const b2 = getS(T, r.id); if (b2) return { wait: b2 }; } }
          }
          const mode = fu ? lockedReadMode() : readMode;
          const vis = cand.map((r) => ({ r, v: ver(r, T, mode) })).filter((x) => x.v && x.v.val != null && op.pred(x.v.val));
          const dirty = vis.some((x) => x.v.by !== T.id && st(x.v.by) !== 'committed');
          if (level === 'ssi') {
            T.reads.push({ kind: 'pred', table: op.table, pred: op.pred });
            cand.forEach((r) => { const v = ver(r, T, mode); if (r.versions.some((x) => x.val != null && op.pred(x.val))) recordIgnored(T, r, v); });
          }
          c[op.into] = vis.length;
          T.readLog.push({ into: op.into, val: vis.length, dirty });
          const shown = op.show ? op.show(vis.length) : vis.length + ' dòng';
          return { text: '→ ' + shown + (dirty ? ' (gồm dữ liệu chưa commit!)' : '') + (fu ? ` · khoá ${lockedN} dòng` : '') + (level === '2pl' ? ' · khoá vị từ' : ''), tone: dirty ? 'bad' : '' };
        }
        case 'write': case 'update': case 'cas': {
          const row = rows.get(op.id);
          if (locking) { const b = getX(T, row.id); if (b) return { wait: b }; }
          if (pgSnap) { const U = concurrentWriter(T, row); if (U) return { abort: `${tag(U)} đã sửa ${row.label} sau khi ${tag(T)} bắt đầu → CSDL phát hiện lost update, huỷ ${tag(T)}` }; }
          const cur = valOf(ver(row, T, level === 'none' ? 'any' : lockedReadMode()));
          let nv;
          if (op.type === 'write') nv = op.fn(c);
          else if (op.type === 'update') nv = op.fn(cur, c);
          else {
            if (!op.match(cur, c)) {
              c.casFails = (c.casFails || 0) + 1;
              if (c.casFails >= 3) return { appAbort: `CAS thất bại ${c.casFails} lần liền (giá trị thật là ${fv(row, cur)} nhưng lần đọc vẫn thấy ${fv(row, c[op.expect])}) → ứng dụng bỏ cuộc` };
              return { jump: op.retryTo, text: `→ 0 dòng được cập nhật (giá trị hiện là ${fv(row, cur)}) → đọc lại và thử lại`, tone: 'warn' };
            }
            nv = op.fn(c);
          }
          const pb = predBlockers(T, row.table, [cur, nv]); if (pb.size) return { wait: pb };
          put(T, row, nv);
          return { text: '→ ' + fv(row, nv) + (op.type === 'update' ? ` (từ ${fv(row, cur)})` : '') };
        }
        case 'insert': {
          const id = op.id + '-' + T.id;
          const val = op.val(c);
          const pb = predBlockers(T, op.table, [val]); if (pb.size) return { wait: pb };
          let row = rows.get(id);
          if (!row) { row = { id, table: op.table, label: op.rowLabel || id, versions: [] }; rows.set(id, row); }
          if (locking) { L(id).X = T.id; T.locks.add(id); }
          put(T, row, val);
          return { text: '→ thêm ' + fv(row, val) };
        }
        case 'fail':
          return o.atomic ? { abort: op.msg + ' → huỷ giao dịch, rollback mọi ghi trước đó' } : { partial: op.msg + ' → không có atomicity: các ghi trước đó vẫn nằm lại' };
        case 'rollback':
          return { appAbort: 'Ứng dụng chủ động ROLLBACK' };
        case 'commit': {
          if (level === 'ssi' && T.wrote.size) { const r = ssiCheck(T); if (r) return { abort: r }; }
          return { commit: true };
        }
        default: return { text: '' };
      }
    }

    function abort(T, reason, app) {
      T.status = 'aborted'; T.abortReason = reason; T.appAbort = !!app; T.waitFor = null;
      status.set(T.id, 'aborted');
      rows.forEach((r) => { r.versions = r.versions.filter((v) => v.by !== T.id); });
      release(T);
      ev(`${tag(T)} ${app ? 'ROLLBACK' : 'bị huỷ'}: ${reason}`, 'bad');
      resume();
    }
    function commit(T) {
      T.status = 'committed'; status.set(T.id, 'committed');
      release(T);
      ev(`${tag(T)} COMMIT`, 'ok');
      resume();
    }
    function detectDeadlock(T) {
      const seen = new Set();
      const path = [];
      function dfs(U) {
        if (!U || U.status !== 'waiting' || !U.waitFor || seen.has(U.id)) return false;
        seen.add(U.id); path.push(U);
        for (const id of U.waitFor) { if (id === T.id) return true; if (dfs(byId(id))) return true; }
        path.pop();
        return false;
      }
      return dfs(T) ? path.map(tag).join(' chờ ') + ' chờ ' + tag(T) : null;
    }

    function run(T) {
      const op = T.ops[T.pc];
      const idx = T.pc;
      const was = T.status === 'waiting';
      const r = exec(T, op);
      if (r.wait) {
        T.status = 'waiting'; T.waitFor = r.wait;
        const who = [...r.wait].map((i) => 'T' + i).join(', ');
        T.res[idx] = { text: `đang chờ khoá của ${who}…`, tone: 'warn' };
        if (!was) ev(`${tag(T)}: ${op.label} → phải chờ khoá của ${who}`, 'warn');
        const cyc = detectDeadlock(T);
        if (cyc) { const msg = `Deadlock: ${cyc}. CSDL phát hiện vòng chờ và huỷ ${tag(T)}`; T.res[idx] = { text: msg, tone: 'bad' }; abort(T, msg); }
        return;
      }
      T.waitFor = null;
      if (was) { T.status = 'active'; ev(`${tag(T)} được cấp khoá, chạy tiếp`, 'acc'); }
      if (r.abort) { T.res[idx] = { text: r.abort, tone: 'bad' }; abort(T, r.abort); return; }
      if (r.appAbort) { T.res[idx] = { text: r.appAbort, tone: 'warn' }; abort(T, r.appAbort, true); return; }
      if (r.partial) {
        T.res[idx] = { text: r.partial, tone: 'bad' };
        T.status = 'committed'; T.partial = true; status.set(T.id, 'committed'); release(T); T.pc = T.ops.length;
        ev(`${tag(T)}: ${r.partial}`, 'bad'); resume(); return;
      }
      if (r.jump != null) { T.res[idx] = { text: r.text, tone: r.tone }; ev(`${tag(T)}: ${op.label} ${r.text}`, 'warn'); for (let k = r.jump; k < T.ops.length; k++) if (k !== idx) delete T.res[k]; T.pc = r.jump; return; }
      if (r.commit) { T.res[idx] = { text: '→ đã commit', tone: 'ok' }; T.pc++; commit(T); return; }
      T.res[idx] = { text: r.text, tone: r.tone };
      T.pc++;
      ev(`${tag(T)}: ${op.label} ${r.text}`, r.tone === 'bad' ? 'bad' : '');
    }
    let resuming = false, again = false;
    function resume() {
      if (resuming) { again = true; return; }
      resuming = true;
      do {
        again = false;
        for (const T of txns) if (T.status === 'waiting') { run(T); if (T.status !== 'waiting') again = true; }
      } while (again);
      resuming = false;
    }
    const runnable = (T) => (T.status === 'idle' || T.status === 'active') && T.pc < T.ops.length;
    function step(T) {
      if (!runnable(T)) return false;
      if (T.status === 'idle') {
        T.status = 'active';
        T.snap = new Set([...status].filter(([, v]) => v === 'committed').map(([k]) => k));
        status.set(T.id, 'active');
        ev(`${tag(T)} (${T.name}) BEGIN` + (readMode === 'snap' ? ' — chụp snapshot' : ''), 't');
      }
      run(T);
      return true;
    }
    function next() {
      while (pos < seq.length) { const T = cols[seq[pos]]; pos++; if (T && runnable(T)) { step(T); return true; } }
      const T = cols.find(runnable);
      if (T) { step(T); return true; }
      return false;
    }
    return {
      level, cols, events, notes, txns,
      next, pos: () => pos,
      stepCol: (i) => step(cols[i]),
      retry: (i) => { if (cols[i] && cols[i].status === 'aborted') newAttempt(i); },
      hasRunnable: () => cols.some(runnable),
      done: () => cols.every((T) => T.status === 'committed' || T.status === 'aborted'),
      rows: () => [...rows.values()].filter((r) => r.versions.length),
      committed: (id) => { const r = rows.get(id); return r ? valOf(ver(r, null, 'committed')) : null; },
      committedRows: (table) => [...rows.values()].filter((r) => r.table === table).map((r) => valOf(ver(r, null, 'committed'))).filter((v) => v != null),
      uncommitted: (r) => r.versions.filter((v) => v.by !== 0 && st(v.by) === 'active'),
      lockOf: (id) => locks.get(id),
      plocks: () => plocks,
      locking,
    };
  }

  function statusPill(T) {
    if (T.status === 'idle') return pill('chưa bắt đầu');
    if (T.status === 'active') return pill('đang chạy', 'accent');
    if (T.status === 'waiting') return pill('đang chờ khoá', 'warn');
    if (T.status === 'committed') return T.partial ? pill('dừng giữa chừng', 'bad') : pill('đã commit', 'ok');
    return T.appAbort ? pill('ứng dụng rollback', 'warn') : pill('bị CSDL huỷ', 'bad');
  }

  function scheduler(root, fig, sc, over) {
    over = over || {};
    const levels = over.levels || sc.levels;
    const variants = sc.variants ? (over.variants ? sc.variants.filter((v) => over.variants.includes(v.value)) : sc.variants) : null;
    const presets = over.presets ? sc.presets.filter((p) => over.presets.includes(p.value)) : sc.presets;
    const cfg = { level: over.level || sc.level, variant: variants ? over.variant || variants[0].value : null, preset: over.preset || presets[0].value };
    const opts = {};
    (sc.options || []).forEach((x) => { opts[x.key] = x.value; });
    let sim = null;
    let actions = [['all']];

    const top = h('div', { class: 'controls' });
    const lv = seg({ label: 'Mức cô lập', options: levels.map((l) => ({ value: l, label: (sc.levelLabels && sc.levelLabels[l]) || LEVEL_LABEL[l] })), value: cfg.level, onChange: (v) => { cfg.level = v; rebuild(); } });
    top.append(ctl('Mức cô lập', lv.el));
    if (variants && variants.length > 1) {
      const vs = seg({ label: 'Cách viết', options: variants, value: cfg.variant, onChange: (v) => { cfg.variant = v; rebuild(); } });
      top.append(ctl(sc.variantLabel || 'Cách viết giao dịch', vs.el));
    }
    if (presets.length > 1) {
      const ps = seg({ label: 'Lịch', options: presets.map((p) => ({ value: p.value, label: p.label })), value: cfg.preset, onChange: (v) => { cfg.preset = v; actions = [['all']]; rebuild(); } });
      top.append(ctl('Lịch xen kẽ', ps.el));
    }
    const optRow = h('div', { class: 'btn-row' });
    (sc.options || []).forEach((x) => optRow.append(checkbox(x.label, opts[x.key], (v) => { opts[x.key] = v; rebuild(); }).el));
    const bNext = button('Bước tiếp theo lịch', () => doAct(['n']));
    const bAll = button('Chạy hết', () => doAct(['all']), 'ghost');
    const bReset = button('Đặt lại', () => { actions = []; rebuild(); }, 'ghost');
    const chips = h('div', { class: 'sch-chips' });
    const colsEl = h('div', { class: 'sch-cols' });
    const verdictEl = h('div');
    const dbEl = h('div');
    const notesEl = h('div');
    const lg = log();
    root.append(top, sc.options && sc.options.length ? optRow : null, h('div', { class: 'btn-row' }, bNext, bAll, bReset), chips, colsEl, verdictEl, dbEl, notesEl,
      h('div', { class: 'box' }, h('h5', 'Nhật ký thực thi'), lg));

    function apply(a) {
      if (a[0] === 'n') sim.next();
      else if (a[0] === 'all') { let k = 0; while (k++ < 80 && sim.next()); }
      else if (a[0] === 'c') sim.stepCol(a[1]);
      else if (a[0] === 'r') sim.retry(a[1]);
    }
    function doAct(a) { actions.push(a); apply(a); render(); }
    function rebuild() {
      const p = presets.find((x) => x.value === cfg.preset);
      sim = makeSim(sc, Object.assign({ level: cfg.level, variant: cfg.variant, seq: p.seq }, opts));
      actions.forEach(apply);
      render();
    }
    function render() {
      const p = presets.find((x) => x.value === cfg.preset);
      clear(chips);
      chips.append(h('span', { class: 'lab-note' }, 'Lịch:'));
      p.seq.forEach((ci, k) => chips.append(h('span', { class: 'pill ' + (ci === 0 ? 'accent' : 'violet') + (k < sim.pos() ? ' chip-done' : '') }, sim.cols[ci].short)));

      clear(colsEl);
      sim.cols.forEach((T, i) => {
        const ol = h('ol', { class: 'sch-ops' });
        const over2 = T.status === 'committed' || T.status === 'aborted';
        T.ops.forEach((op, k) => {
          let cls = k < T.pc ? 'done' : 'todo';
          if (k === T.pc && !over2) cls = T.status === 'waiting' ? 'cur wait' : 'cur';
          if (k === T.pc && T.status === 'aborted') cls = 'fail';
          const r = T.res[k];
          const li = h('li', { class: cls }, h('code', op.label), r ? h('div', { class: 'res ' + (r.tone || '') }, r.text) : null);
          if (k === T.pc && (T.status === 'idle' || T.status === 'active')) li.append(h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onClick: () => doAct(['c', i]) }, 'Chạy bước này'));
          ol.append(li);
        });
        const prevs = [];
        for (let q = T.prev; q; q = q.prev) prevs.push('T' + q.id + (q.appAbort ? ' rollback' : ' bị huỷ'));
        const box = h('div', { class: 'box sch-col' },
          h('h5', `${T.name} · T${T.id}`), statusPill(T),
          prevs.length ? h('div', { class: 'lab-note' }, 'Lần trước: ' + prevs.join(', ')) : null, ol);
        if (T.status === 'aborted') box.append(h('button', { type: 'button', class: 'btn btn-sm', onClick: () => doAct(['r', i]) }, 'Thử lại (giao dịch mới)'));
        colsEl.append(box);
      });

      clear(verdictEl);
      const v = sc.verdict(sim, cfg) || { tone: 'accent', title: 'Đang chạy', text: 'Bấm “Bước tiếp theo lịch” hoặc “Chạy bước này” ở từng cột để thực thi tiếp.' };
      verdictEl.append(verdictBox(v));

      clear(dbEl);
      const tb = h('tbody');
      sim.rows().forEach((r) => {
        const un = sim.uncommitted(r);
        const l = sim.lockOf(r.id);
        const lk = [];
        if (l && l.X != null) lk.push('X: T' + l.X);
        if (l && l.S.size) lk.push('S: ' + [...l.S].map((x) => 'T' + x).join(', '));
        tb.append(h('tr', { class: un.length ? 'hit' : '' },
          h('td', h('code', r.label)),
          h('td', sc.fmt(r, sim.committed(r.id))),
          h('td', un.length ? un.map((x) => sc.fmt(r, x.val) + ' (T' + x.by + ')').join(' · ') : '—'),
          sim.locking ? h('td', lk.join(' · ') || '—') : null));
      });
      dbEl.append(h('div', { class: 'table-wrap' }, h('table', { class: 'data compact' },
        h('thead', h('tr', h('th', 'Bản ghi'), h('th', 'Đã commit'), h('th', 'Ghi chưa commit'), sim.locking ? h('th', 'Khoá') : null)), tb)));
      const pl = sim.plocks();
      if (pl.length) dbEl.append(h('p', { class: 'lab-note' }, 'Khoá vị từ (shared): ' + pl.map((x) => `T${x.by} trên ${x.desc}`).join(' · ')));

      clear(notesEl);
      if (sim.level === 'ssi') {
        const ul = h('ul', { class: 'sch-notes' });
        (sim.notes.length ? sim.notes : ['Chưa có gì: SSI chỉ ghi chép khi một giao dịch đọc dữ liệu đang bị người khác sửa, hoặc ghi lên dữ liệu người khác đã đọc.']).forEach((n) => ul.append(h('li', n)));
        notesEl.append(h('div', { class: 'box' }, h('h5', 'Sổ theo dõi của SSI'), ul));
      }

      lg.reset();
      sim.events.forEach((e) => lg.add(e.text, e.tone));
      bNext.disabled = !sim.hasRunnable();
      bAll.disabled = !sim.hasRunnable();
    }
    rebuild();
  }

  /* ---------------- scenarios ---------------- */
  const doneMsg = (sim) => sim.done();
  const SCN = {};

  SCN.dirtyRead = {
    baseTxid: 1, levels: ['ru', 'rc', 'si', '2pl'], level: 'ru',
    options: [{ key: 'abort', label: 'User 1 ROLLBACK thay vì COMMIT', value: false }],
    presets: [{ value: 'book', label: 'Như Hình 7-4', seq: [0, 1, 0, 0, 1, 1] }, { value: 'serial', label: 'User 1 xong rồi đến User 2', seq: [0, 0, 0, 1, 1, 1] }],
    rows: () => [{ id: 'x', table: 'kv', label: 'x', val: 2 }, { id: 'y', table: 'kv', label: 'y', val: 2 }],
    fmt: (r, v) => (v == null ? '—' : String(v)),
    txns: (o) => [
      { name: 'User 1', ops: [{ type: 'write', id: 'x', fn: () => 3, label: 'SET x = 3' }, { type: 'write', id: 'y', fn: () => 3, label: 'SET y = 3' }, o.abort ? { type: 'rollback', label: 'ROLLBACK' } : { type: 'commit', label: 'COMMIT' }] },
      { name: 'User 2', ops: [{ type: 'read', id: 'x', into: 'x1', label: 'GET x' }, { type: 'read', id: 'x', into: 'x2', label: 'GET x (lần 2)' }, { type: 'commit', label: 'COMMIT' }] },
    ],
    verdict(sim) {
      const T = sim.cols[1], U = sim.cols[0];
      if (!T.readLog.length) return null;
      const d = T.readLog.find((r) => r.dirty);
      if (d) return { tone: 'bad', title: 'Dirty read', text: `User 2 đọc x = ${d.val} trong lúc User 1 chưa commit.` + (U.status === 'aborted' ? ' Sau đó User 1 rollback: User 2 đã thấy một giá trị chưa từng tồn tại trong CSDL.' : ' Nếu User 1 rollback, User 2 sẽ thấy một giá trị chưa từng tồn tại.') };
      if (!sim.done()) return { tone: 'accent', title: 'Đang chạy', text: 'Đến giờ User 2 chỉ đọc giá trị đã commit.' };
      return { tone: 'ok', title: 'Không có dirty read', text: `User 2 đọc ${T.readLog.map((r) => 'x = ' + r.val).join(', ')}: chỉ thấy giá trị đã commit.` };
    },
  };

  SCN.dirtyWrite = {
    baseTxid: 1, levels: ['none', 'rc', 'si', '2pl'], level: 'none',
    presets: [{ value: 'book', label: 'Như Hình 7-5', seq: [0, 1, 1, 0, 0, 1] }, { value: 'serial', label: 'Alice xong rồi đến Bob', seq: [0, 0, 0, 1, 1, 1] }],
    rows: () => [{ id: 'listing', table: 'listings', label: 'listings[1234].buyer', val: null }, { id: 'invoice', table: 'invoices', label: 'invoices[1234].recipient', val: null }],
    fmt: (r, v) => (v == null ? '—' : v),
    txns: () => ['Alice', 'Bob'].map((n) => ({
      name: n, ops: [
        { type: 'write', id: 'listing', fn: () => n, label: `UPDATE listings SET buyer = '${n}' WHERE id = 1234` },
        { type: 'write', id: 'invoice', fn: () => n, label: `UPDATE invoices SET recipient = '${n}' WHERE listing_id = 1234` },
        { type: 'commit', label: 'COMMIT' }],
    })),
    verdict(sim) {
      if (!sim.done()) return null;
      const l = sim.committed('listing'), i = sim.committed('invoice');
      const ab = sim.cols.find((T) => T.status === 'aborted');
      if (l && i && l !== i) return { tone: 'bad', title: 'Dirty write', text: `Xe được bán cho ${l} nhưng hoá đơn lại gửi cho ${i}: hai giao dịch ghi đè lên dữ liệu chưa commit của nhau.` };
      return { tone: 'ok', title: 'Nhất quán', text: `Cả xe lẫn hoá đơn đều thuộc về ${l || '—'}.` + (ab ? ` ${ab.name} bị huỷ (có thể thử lại).` : ' Giao dịch thứ hai phải chờ khoá của giao dịch đầu.') };
    },
  };

  SCN.unread = {
    baseTxid: 1, levels: ['none', 'rc'], level: 'none',
    levelLabels: { none: 'Không cô lập', rc: 'Có cô lập (read committed)' },
    options: [{ key: 'fail', label: 'Lỗi khi tăng bộ đếm (Hình 7-3)', value: false }, { key: 'atomic', label: 'Có atomicity (rollback khi lỗi)', value: true }],
    presets: [{ value: 'book', label: 'Như Hình 7-2', seq: [0, 1, 1, 0, 0, 1] }, { value: 'serial', label: 'User 1 xong rồi đến User 2', seq: [0, 0, 0, 1, 1, 1] }],
    rows: () => [{ id: 'mbox', table: 'mailboxes', label: 'mailboxes[user 2].unread', val: 0 }, { id: 'e1', table: 'emails', label: 'emails#1', val: { from: 'Carol', subj: 'Lịch họp', unread: false } }],
    fmt: (r, v) => (v == null ? '—' : typeof v === 'number' ? String(v) : `${v.from}: “${v.subj}” · ${v.unread ? 'chưa đọc' : 'đã đọc'}`),
    txns: (o) => {
      const upd = 'UPDATE mailboxes SET unread = unread + 1 WHERE recipient_id = 2';
      return [
        { name: 'User 1 gửi thư', short: 'User 1', ops: [
          { type: 'insert', table: 'emails', id: 'email', rowLabel: 'emails#2 (thư mới)', val: () => ({ from: 'User 1', subj: 'Hello', unread: true }), label: "INSERT INTO emails (recipient_id, subject, unread_flag) VALUES (2, 'Hello', true)" },
          o.fail ? { type: 'fail', label: upd, msg: 'LỖI khi cập nhật bộ đếm' } : { type: 'update', id: 'mbox', fn: (c) => c + 1, label: upd },
          { type: 'commit', label: 'COMMIT' }] },
        { name: 'User 2 xem hộp thư', short: 'User 2', ops: [
          { type: 'query', table: 'emails', pred: (v) => v.unread, into: 'list', label: 'SELECT * FROM emails WHERE recipient_id = 2 AND unread_flag = true', show: (n) => n + ' thư chưa đọc' },
          { type: 'read', id: 'mbox', into: 'cnt', label: 'SELECT unread FROM mailboxes WHERE recipient_id = 2' },
          { type: 'commit', label: 'COMMIT' }] },
      ];
    },
    verdict(sim) {
      const U = sim.cols[0], T = sim.cols[1];
      if (U.status === 'committed' || U.status === 'aborted') {
        const n = sim.committedRows('emails').filter((v) => v.unread).length, c = sim.committed('mbox');
        if (n !== c) return { tone: 'bad', title: 'Dữ liệu lệch vĩnh viễn', text: `Sau khi User 1 dừng, hộp thư có ${n} thư chưa đọc nhưng bộ đếm = ${c}. Không có atomicity nên thư đã chèn không được gỡ ra.` };
      }
      const c = T.ctx;
      if (c.list != null && c.cnt != null) {
        if (c.list !== c.cnt) return { tone: 'bad', title: 'Vi phạm isolation', text: `User 2 thấy ${c.list} thư chưa đọc trong danh sách nhưng bộ đếm hiện ${c.cnt}: đã đọc được ghi chưa commit của User 1 (dirty read).` };
        if (sim.done()) return { tone: 'ok', title: 'Nhất quán', text: `User 2 thấy ${c.list} thư chưa đọc và bộ đếm = ${c.cnt}: hoặc thấy cả hai thay đổi, hoặc không thấy cái nào.` + (U.status === 'aborted' ? ' Giao dịch của User 1 bị rollback trọn vẹn.' : '') };
      }
      return null;
    },
  };

  SCN.readSkew = {
    baseTxid: 1, levels: ['rc', 'si', '2pl', 'ssi'], level: 'rc',
    options: [{ key: 'reread', label: 'Alice đọc lại tài khoản 1 ở cuối', value: false }],
    presets: [{ value: 'book', label: 'Như Hình 7-6', seq: [0, 1, 1, 1, 0, 0, 0] }, { value: 'serial', label: 'Chuyển khoản xong rồi Alice mới xem', seq: [1, 1, 1, 0, 0, 0, 0] }],
    rows: () => [{ id: 'a1', table: 'accounts', label: 'accounts[1].balance', val: 500 }, { id: 'a2', table: 'accounts', label: 'accounts[2].balance', val: 500 }],
    fmt: (r, v) => (v == null ? '—' : usd(v)),
    txns: (o) => [
      { name: 'Alice xem số dư', short: 'Alice', ops: [
        { type: 'read', id: 'a1', into: 'b1', label: 'SELECT balance FROM accounts WHERE id = 1' },
        { type: 'read', id: 'a2', into: 'b2', label: 'SELECT balance FROM accounts WHERE id = 2' },
        o.reread ? { type: 'read', id: 'a1', into: 'b3', label: 'SELECT balance FROM accounts WHERE id = 1 -- đọc lại' } : null,
        { type: 'commit', label: 'COMMIT' }].filter(Boolean) },
      { name: 'Chuyển $100', short: 'Chuyển', ops: [
        { type: 'update', id: 'a1', fn: (v) => v + 100, label: 'UPDATE accounts SET balance = balance + 100 WHERE id = 1' },
        { type: 'update', id: 'a2', fn: (v) => v - 100, label: 'UPDATE accounts SET balance = balance - 100 WHERE id = 2' },
        { type: 'commit', label: 'COMMIT' }] },
    ],
    verdict(sim) {
      const c = sim.cols[0].ctx;
      if (c.b1 == null || c.b2 == null) return null;
      const tot = c.b1 + c.b2;
      if (tot !== 1000) return { tone: 'bad', title: 'Read skew', text: `Alice thấy ${usd(c.b1)} + ${usd(c.b2)} = ${usd(tot)}: có vẻ ${usd(1000 - tot)} đã bốc hơi. Mỗi con số đều đã commit, nhưng chúng thuộc hai thời điểm khác nhau.` + (c.b3 != null && c.b3 !== c.b1 ? ` Đọc lại tài khoản 1 thấy ${usd(c.b3)} thay vì ${usd(c.b1)} (nonrepeatable read).` : '') };
      if (c.b3 != null && c.b3 !== c.b1) return { tone: 'bad', title: 'Nonrepeatable read', text: `Đọc lại tài khoản 1 thấy ${usd(c.b3)} thay vì ${usd(c.b1)}.` };
      return { tone: 'ok', title: 'Nhất quán', text: `Alice thấy ${usd(c.b1)} + ${usd(c.b2)} = ${usd(tot)}: mọi lần đọc thuộc cùng một thời điểm.` };
    },
  };

  SCN.lostUpdate = {
    baseTxid: 1, levels: ['rc', 'si-nd', 'si', '2pl', 'ssi'], level: 'rc',
    levelLabels: { 'si-nd': 'Snapshot (MySQL InnoDB)', si: 'Snapshot (PostgreSQL)' },
    variantLabel: 'Cách tăng bộ đếm',
    variants: [{ value: 'naive', label: 'Đọc–sửa–ghi' }, { value: 'atomic', label: 'UPDATE nguyên tử' }, { value: 'forupdate', label: 'SELECT FOR UPDATE' }, { value: 'cas', label: 'Compare-and-set' }],
    presets: [{ value: 'book', label: 'Như Hình 7-1', seq: [0, 1, 0, 0, 1, 1] }, { value: 'serial', label: 'Tuần tự', seq: [0, 0, 0, 1, 1, 1] }],
    rows: () => [{ id: 'ctr', table: 'counters', label: "counters['foo']", val: 42 }],
    fmt: (r, v) => (v == null ? '—' : String(v)),
    txns: (o) => [1, 2].map((k) => {
      const rd = { type: 'read', id: 'ctr', into: 'v', label: "SELECT value FROM counters WHERE key = 'foo'" };
      const wr = { type: 'write', id: 'ctr', fn: (c) => c.v + 1, label: "UPDATE counters SET value = v + 1 WHERE key = 'foo'" };
      const cm = { type: 'commit', label: 'COMMIT' };
      let ops;
      if (o.variant === 'atomic') ops = [{ type: 'update', id: 'ctr', fn: (v) => v + 1, label: "UPDATE counters SET value = value + 1 WHERE key = 'foo'" }, cm];
      else if (o.variant === 'forupdate') ops = [Object.assign({}, rd, { forUpdate: true, label: "SELECT value FROM counters WHERE key = 'foo' FOR UPDATE" }), wr, cm];
      else if (o.variant === 'cas') ops = [rd, { type: 'cas', id: 'ctr', expect: 'v', match: (cur, c) => cur === c.v, fn: (c) => c.v + 1, retryTo: 0, label: "UPDATE counters SET value = v + 1 WHERE key = 'foo' AND value = v" }, cm];
      else ops = [rd, wr, cm];
      return { name: 'Client ' + k, short: 'C' + k, ops };
    }),
    verdict(sim) {
      if (!sim.done()) return null;
      const fin = sim.committed('ctr');
      const okN = sim.cols.filter((T) => T.status === 'committed').length;
      const ab = sim.cols.find((T) => T.status === 'aborted');
      if (fin !== 42 + okN) return { tone: 'bad', title: 'Lost update', text: `${okN} lần tăng đã commit nhưng counter chỉ = ${fin}: một lần ghi đã đè mất thay đổi của lần kia.` };
      if (ab) return { tone: 'warn', title: 'Đã chặn, cần thử lại', text: `${ab.name} không được commit (${ab.appAbort ? 'ứng dụng bỏ cuộc' : 'CSDL huỷ'}), nên không có thay đổi nào bị đè mất. Counter = ${fin}. Bấm “Thử lại” để chạy lại giao dịch đó.` };
      return { tone: 'ok', title: 'Không mất cập nhật', text: `${okN} lần tăng, counter = ${fin}.` };
    },
  };

  const DOCS = (o) => {
    const pred = (v) => v.on;
    const mk = (name, id, readOnly) => {
      const fu = o.variant === 'forupdate';
      const q = { type: 'query', table: 'doctors', pred, into: 'n', forUpdate: fu, desc: 'doctors WHERE on_call AND shift_id = 1234',
        label: fu ? 'SELECT * FROM doctors WHERE on_call = true AND shift_id = 1234 FOR UPDATE' : 'SELECT COUNT(*) FROM doctors WHERE on_call = true AND shift_id = 1234',
        show: (n) => n + ' bác sĩ đang trực' };
      const u = { type: 'update', id, fn: (v) => Object.assign({}, v, { on: false }), guard: (c) => c.n >= 2, guardFail: 'n < 2: chỉ còn mình mình trực → ứng dụng ROLLBACK',
        label: `IF n ≥ 2: UPDATE doctors SET on_call = false WHERE name = '${name}' AND shift_id = 1234` };
      return { name, ops: readOnly ? [q, { type: 'commit', label: 'COMMIT' }] : [q, u, { type: 'commit', label: 'COMMIT' }] };
    };
    return [mk('Alice', 'alice'), mk('Bob', 'bob', o.variant === 'readonly')];
  };
  SCN.writeSkew = {
    baseTxid: 42, levels: ['rc', 'si', '2pl', 'ssi'], level: 'si',
    variants: [{ value: 'plain', label: 'Như sách (không khoá)' }, { value: 'forupdate', label: 'SELECT … FOR UPDATE' }, { value: 'readonly', label: 'Bob chỉ đọc' }],
    presets: [
      { value: 'book', label: 'Hình 7-8 / 7-11', seq: [0, 1, 0, 1, 0, 1] },
      { value: 'stale', label: 'Hình 7-10', seq: [0, 0, 1, 0, 1, 1] },
      { value: 'serial', label: 'Tuần tự', seq: [0, 0, 0, 1, 1, 1] }],
    rows: () => [
      { id: 'alice', table: 'doctors', label: 'doctors[Alice]', val: { name: 'Alice', on: true } },
      { id: 'bob', table: 'doctors', label: 'doctors[Bob]', val: { name: 'Bob', on: true } }],
    fmt: (r, v) => (v == null ? '—' : 'on_call = ' + v.on),
    txns: DOCS,
    verdict(sim) {
      if (!sim.done()) return null;
      const on = sim.committedRows('doctors').filter((v) => v.on).length;
      const ab = sim.cols.filter((T) => T.status === 'aborted');
      if (on === 0) return { tone: 'bad', title: 'Write skew', text: 'Cả Alice và Bob đều đã nghỉ: không còn bác sĩ nào trực. Mỗi giao dịch đều thấy “2 người trực” rồi sửa bản ghi của riêng mình, nên không có xung đột ghi nào để phát hiện.' };
      if (ab.length) return { tone: 'ok', title: 'Ràng buộc được giữ', text: `Còn ${on} bác sĩ trực. ${ab.map((T) => T.name + (T.appAbort ? ' bị ứng dụng rollback' : ' bị CSDL huỷ')).join(', ')}.` + (ab.some((T) => !T.appAbort) ? ' Bấm “Thử lại”: lần này giao dịch sẽ thấy chỉ còn 1 người trực.' : '') };
      return { tone: 'ok', title: 'Ràng buộc được giữ', text: `Còn ${on} bác sĩ trực.` };
    },
  };

  const bookingOps = (o, user, s0, e0, withSlots) => {
    const ops = [];
    if (withSlots) ops.push({ type: 'query', table: 'slots', pred: (v) => v.t >= s0 && v.t < e0, into: 'k', forUpdate: true, desc: 'room_slots',
      label: `SELECT * FROM room_slots WHERE room_id = 123 AND slot >= '${tm(s0)}' AND slot < '${tm(e0)}' FOR UPDATE`, show: (n) => n + ' slot' });
    const fu = o.variant === 'forupdate';
    ops.push({ type: 'query', table: 'bookings', pred: (v) => v.room === 123 && v.e > s0 && v.s < e0, into: 'n', forUpdate: fu, desc: `bookings phòng 123, ${tm(s0)}–${tm(e0)}`,
      label: (fu ? 'SELECT * ' : 'SELECT COUNT(*) ') + `FROM bookings WHERE room_id = 123 AND end_time > '${tm(s0)}' AND start_time < '${tm(e0)}'` + (fu ? ' FOR UPDATE' : ''),
      show: (n) => n + ' lịch trùng' });
    ops.push({ type: 'insert', table: 'bookings', id: 'bk', rowLabel: `bookings (user ${user})`, val: () => ({ room: 123, s: s0, e: e0, user }), guard: (c) => c.n === 0, guardFail: 'Đã có lịch trùng → ứng dụng ROLLBACK',
      label: `IF n = 0: INSERT INTO bookings (room_id, start_time, end_time, user_id) VALUES (123, '${tm(s0)}', '${tm(e0)}', ${user})` });
    ops.push({ type: 'commit', label: 'COMMIT' });
    return ops;
  };
  const bookingVerdict = (sim) => {
    if (!sim.done()) return null;
    const b = sim.committedRows('bookings').filter((v) => v.room === 123);
    let clash = null;
    for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) if (b[i].s < b[j].e && b[j].s < b[i].e) clash = [b[i], b[j]];
    const ab = sim.cols.filter((T) => T.status === 'aborted');
    if (clash) return { tone: 'bad', title: 'Đặt trùng phòng', text: `Phòng 123 có hai lịch chồng nhau: ${tm(clash[0].s)}–${tm(clash[0].e)} (user ${clash[0].user}) và ${tm(clash[1].s)}–${tm(clash[1].e)} (user ${clash[1].user}). Mỗi giao dịch kiểm tra thấy 0 lịch trùng vì lịch kia chưa tồn tại.` };
    return { tone: 'ok', title: 'Không đặt trùng', text: 'Phòng 123 không có hai lịch chồng nhau.' + (ab.length ? ' ' + ab.map((T) => T.name + (T.appAbort ? ' thấy đã có lịch nên rollback' : ' bị CSDL huỷ (thử lại sẽ thấy lịch đã có)')).join('; ') + '.' : '') };
  };
  const fmtBooking = (r, v) => (v == null ? '—' : v.t != null ? `phòng 123 · ${tm(v.t)}` : `phòng ${v.room} · ${tm(v.s)}–${tm(v.e)} · user ${v.user}`);
  SCN.phantom = {
    baseTxid: 1, levels: ['rc', 'si', '2pl', 'ssi'], level: 'si',
    variants: [{ value: 'plain', label: 'Như Ví dụ 7-2' }, { value: 'forupdate', label: 'Thêm FOR UPDATE' }],
    presets: [{ value: 'book', label: 'Xen kẽ', seq: [0, 1, 0, 1, 0, 1] }, { value: 'serial', label: 'Tuần tự', seq: [0, 0, 0, 1, 1, 1] }],
    rows: () => [
      { id: 'b1', table: 'bookings', label: 'bookings#1', val: { room: 123, s: 10, e: 11, user: 111 } },
      { id: 'b2', table: 'bookings', label: 'bookings#2', val: { room: 124, s: 12, e: 13, user: 222 } }],
    fmt: fmtBooking,
    txns: (o) => [{ name: 'User 666', short: '666', ops: bookingOps(o, 666, 12, 13) }, { name: 'User 777', short: '777', ops: bookingOps(o, 777, 12.5, 13.5) }],
    verdict: bookingVerdict,
  };
  SCN.materialize = {
    baseTxid: 1, levels: ['rc', 'si'], level: 'rc',
    variants: [{ value: 'slots', label: 'Khoá bảng room_slots' }, { value: 'plain', label: 'Không có bảng slot' }],
    presets: [{ value: 'book', label: 'Xen kẽ', seq: [0, 1, 0, 1, 0, 1, 0, 1] }, { value: 'serial', label: 'Tuần tự', seq: [0, 0, 0, 0, 1, 1, 1, 1] }],
    rows: () => {
      const r = [{ id: 'b1', table: 'bookings', label: 'bookings#1', val: { room: 123, s: 10, e: 11, user: 111 } }];
      for (let t = 12; t < 13.5; t += 0.25) r.push({ id: 'slot' + t, table: 'slots', label: `room_slots[123, ${tm(t)}]`, val: { room: 123, t } });
      return r;
    },
    fmt: fmtBooking,
    txns: (o) => {
      const sl = o.variant === 'slots';
      return [{ name: 'User 666', short: '666', ops: bookingOps({}, 666, 12, 13, sl) }, { name: 'User 777', short: '777', ops: bookingOps({}, 777, 12.5, 13.5, sl) }];
    },
    verdict: bookingVerdict,
  };

  widget('sched-dirty-read', (root, fig) => scheduler(root, fig, SCN.dirtyRead));
  widget('sched-dirty-write', (root, fig) => scheduler(root, fig, SCN.dirtyWrite));
  widget('sched-unread', (root, fig) => scheduler(root, fig, SCN.unread));
  widget('sched-read-skew', (root, fig) => scheduler(root, fig, SCN.readSkew));
  widget('sched-lost-update', (root, fig) => scheduler(root, fig, SCN.lostUpdate));
  widget('sched-write-skew', (root, fig) => scheduler(root, fig, SCN.writeSkew, { variants: ['plain', 'forupdate'], presets: ['book', 'serial'] }));
  widget('sched-phantom', (root, fig) => scheduler(root, fig, SCN.phantom));
  widget('sched-materialize', (root, fig) => scheduler(root, fig, SCN.materialize));
  widget('sched-ssi', (root, fig) => scheduler(root, fig, SCN.writeSkew, { levels: ['si', '2pl', 'ssi'], level: 'ssi', variants: ['plain', 'readonly'], presets: ['stale', 'book', 'serial'] }));

  /* =====================================================================
   * 8.1 Partial failure: transfer with / without a transaction
   * ===================================================================== */
  widget('tx-partial', (root) => {
    let A = 500, B = 500, tries = 0, useTx = true, fault = 'crash';
    const faults = { none: 'Không lỗi', crash: 'App crash giữa chừng', net: 'Mất kết nối mạng', disk: 'Đĩa đầy', constraint: 'Vi phạm ràng buộc' };
    const lg = log();
    const sA = stat('Tài khoản A', usd(A)), sB = stat('Tài khoản B', usd(B)), sT = stat('Tổng tiền', usd(A + B), 'ok', 'phải luôn là $1.000'), sN = stat('Số lần chạy', '0');
    const fs = seg({ label: 'Sự cố', options: Object.entries(faults).map(([value, label]) => ({ value, label })), value: fault, onChange: (v) => { fault = v; } });
    const cb = checkbox('Bọc hai lệnh trong một giao dịch (BEGIN … COMMIT)', useTx, (v) => { useTx = v; });
    const runB = button('Chạy chuyển $100 từ A sang B', run);
    const resetB = button('Đặt lại số dư', () => { A = 500; B = 500; tries = 0; lg.reset(); lg.add('Số dư đặt lại: A = $500, B = $500.', 't'); upd(); }, 'ghost');
    root.append(h('div', { class: 'controls' }, ctl('Sự cố xảy ra ở lần chạy đầu tiên', fs.el)), h('div', { class: 'btn-row' }, cb.el), h('div', { class: 'btn-row' }, runB, resetB),
      h('div', { class: 'stats' }, sA, sB, sT, sN), lg,
      h('p', { class: 'lab-note' }, 'Sự cố tạm thời (crash, mạng, đĩa đầy) chỉ xảy ra ở lần chạy đầu; lần sau là “thử lại”. Vi phạm ràng buộc là lỗi vĩnh viễn: lần nào cũng hỏng.'));
    function upd() {
      sA.update(usd(A)); sB.update(usd(B));
      sT.update(usd(A + B), A + B === 1000 ? 'ok' : 'bad', A + B === 1000 ? 'phải luôn là $1.000' : 'tiền bị mất hoặc sinh ra!');
      sN.update(String(tries));
    }
    function run() {
      tries++;
      const hit = fault !== 'none' && (tries === 1 || fault === 'constraint');
      lg.add(`Lần ${tries}: ${useTx ? 'BEGIN; ' : ''}UPDATE accounts SET balance = balance - 100 WHERE id = 'A'  → A = ${usd(A - 100)}`, '');
      const a0 = A;
      A -= 100;
      if (hit) {
        const why = { crash: 'tiến trình ứng dụng chết', net: 'kết nối tới CSDL bị cắt', disk: 'đĩa đầy, không ghi được', constraint: "tài khoản B đã bị khoá (CHECK constraint)" }[fault];
        lg.add(`  ✗ Lỗi trước lệnh thứ hai: ${why}.`, 'bad');
        if (useTx) { A = a0; lg.add(`  ROLLBACK: CSDL huỷ lệnh đã chạy, A trở về ${usd(A)}. Ứng dụng có thể thử lại an toàn.`, 'ok'); }
        else lg.add(`  Không có giao dịch: A đã bị trừ và không ai hoàn lại. Chạy lại sẽ trừ A thêm lần nữa.`, 'bad');
      } else {
        B += 100;
        lg.add(`  UPDATE accounts SET balance = balance + 100 WHERE id = 'B'  → B = ${usd(B)}${useTx ? '; COMMIT' : ''}`, 'ok');
      }
      upd();
    }
    run();
    tries = 1;
  });

  /* =====================================================================
   * 8.2 ACID explorer
   * ===================================================================== */
  widget('acid', (root) => {
    const L = {
      A: { name: 'Atomicity', myth: 'Nguyên tử như trong lập trình đa luồng: không ai thấy được trạng thái làm dở.', truth: 'Khả năng huỷ (abortability): nếu lỗi xảy ra giữa chừng, mọi ghi của giao dịch bị bỏ, nên ứng dụng có thể thử lại an toàn. Việc “người khác thấy gì” thuộc về chữ I.', owner: 'CSDL' },
      C: { name: 'Consistency', myth: 'CSDL tự đảm bảo dữ liệu luôn “đúng”.', truth: 'Các bất biến (invariant) của ứng dụng, ví dụ tổng nợ bằng tổng có. CSDL chỉ kiểm tra được vài loại ràng buộc (khoá ngoại, unique, CHECK); phần còn lại là trách nhiệm của code ứng dụng. Chữ C “được thêm vào cho đủ từ viết tắt”.', owner: 'Ứng dụng' },
      I: { name: 'Isolation', myth: 'Giao dịch chạy đồng thời luôn như chạy lần lượt.', truth: 'Về lý thuyết là serializability. Thực tế đa số CSDL mặc định dùng mức yếu hơn (read committed, snapshot isolation), nên vẫn có race condition.', owner: 'CSDL' },
      D: { name: 'Durability', myth: 'Đã commit là không bao giờ mất.', truth: 'Lời hứa không quên dữ liệu đã commit: ghi xuống đĩa (kèm write-ahead log) hoặc sao chép sang vài node trước khi báo thành công. Không có độ bền tuyệt đối, chỉ có các kỹ thuật giảm rủi ro.', owner: 'CSDL' },
    };
    let cur = 'A';
    const sg = seg({ label: 'Chữ cái', options: Object.keys(L).map((k) => ({ value: k, label: k + ' · ' + L[k].name })), value: cur, onChange: (v) => { cur = v; render(); } });
    const body = h('div');
    root.append(h('div', { class: 'controls' }, ctl('Chọn một chữ trong ACID', sg.el)), body);
    // demo state
    let failAt = 2;
    let accA = 500, accB = 500, check = false, cmsg = 'Bất biến: A + B = $1.000.';
    let raceIso = false;
    function render() {
      clear(body);
      const d = L[cur];
      body.append(h('div', { class: 'lab-split' },
        h('div', { class: 'box' }, h('h5', 'Hay bị hiểu là'), h('p', d.myth)),
        h('div', { class: 'box' }, h('h5', 'Thực chất'), h('p', d.truth), h('p', 'Ai chịu trách nhiệm: ', pill(d.owner, d.owner === 'CSDL' ? 'accent' : 'warn')))));
      if (cur === 'A') body.append(demoA());
      if (cur === 'C') body.append(demoC());
      if (cur === 'I') body.append(demoI());
      if (cur === 'D') body.append(h('p', { class: 'lab-note' }, 'Xem thí nghiệm “Kỹ thuật nào cứu được dữ liệu?” ngay bên dưới để thử từng loại sự cố.'));
    }
    function demoA() {
      const steps = ["INSERT INTO emails … (thư mới)", 'UPDATE mailboxes SET unread = unread + 1', "INSERT INTO audit_log … (ghi nhật ký)"];
      const wrap = h('div');
      const sl = slider({ label: 'Lỗi xảy ra ngay sau bước', min: 0, max: 3, value: failAt, format: (v) => (v === 3 ? 'không lỗi' : v === 0 ? 'trước bước 1' : 'bước ' + v), onInput: (v) => { failAt = v; draw(); } });
      const ol = h('ol', { class: 'sch-ops' });
      const out = h('div');
      wrap.append(h('div', { class: 'controls' }, sl.el), ol, out);
      function draw() {
        clear(ol); clear(out);
        steps.forEach((t, i) => {
          const ran = i < failAt;
          const cls = failAt === 3 ? 'done' : ran ? 'fail' : 'todo';
          ol.append(h('li', { class: cls }, h('code', t), h('div', { class: 'res ' + (failAt === 3 ? 'ok' : ran ? 'bad' : '') }, failAt === 3 ? '→ đã ghi' : ran ? '→ đã ghi, rồi bị huỷ khi abort' : '→ chưa chạy')));
        });
        out.append(verdictBox(failAt === 3 ? { tone: 'ok', title: 'COMMIT', text: 'Cả ba ghi cùng có hiệu lực.' } : { tone: 'warn', title: 'ABORT', text: `Đã ghi ${failAt} bước trước khi lỗi, nhưng CSDL bỏ hết: trạng thái như thể giao dịch chưa từng chạy. Ứng dụng thử lại mà không sợ ghi trùng.` }));
      }
      draw();
      return wrap;
    }
    function demoC() {
      const wrap = h('div');
      const sA = stat('A', usd(accA)), sB = stat('B', usd(accB)), sT = stat('A + B', usd(accA + accB));
      const note = h('p', { class: 'lab-note' });
      const cb = checkbox('CSDL có ràng buộc CHECK (balance ≥ 0)', check, (v) => { check = v; });
      const tx = (da, db, label) => () => {
        if (check && (accA + da < 0 || accB + db < 0)) { cmsg = `${label}: CSDL từ chối vì vi phạm CHECK (balance ≥ 0). Đây là loại bất biến CSDL kiểm tra được.`; }
        else { accA += da; accB += db; cmsg = `${label}: CSDL commit bình thường.` + (accA + accB !== 1000 ? ' Bất biến A + B = $1.000 đã vỡ, nhưng CSDL không biết bất biến này tồn tại.' : ''); }
        draw();
      };
      const btns = h('div', { class: 'btn-row' },
        button('Chuyển đúng: A −100, B +100', tx(-100, 100, 'Chuyển đúng')),
        button('Code có bug: A −100, B +10', tx(-100, 10, 'Code có bug'), 'ghost'),
        button('Rút quá số dư: A −900', tx(-900, 900, 'Rút quá số dư'), 'ghost'),
        button('Đặt lại', () => { accA = 500; accB = 500; cmsg = 'Bất biến: A + B = $1.000.'; draw(); }, 'ghost'));
      wrap.append(h('div', { class: 'btn-row' }, cb.el), btns, h('div', { class: 'stats' }, sA, sB, sT), note);
      function draw() {
        sA.update(usd(accA), accA < 0 ? 'bad' : ''); sB.update(usd(accB)); sT.update(usd(accA + accB), accA + accB === 1000 ? 'ok' : 'bad', accA + accB === 1000 ? 'bất biến đúng' : 'bất biến bị vi phạm');
        note.textContent = cmsg;
      }
      draw();
      return wrap;
    }
    function demoI() {
      const wrap = h('div');
      const s2 = seg({ label: 'Cô lập', options: [{ value: false, label: 'Không cô lập' }, { value: true, label: 'Serializable' }], value: raceIso, onChange: (v) => { raceIso = v; draw(); } });
      const lg = log();
      const out = h('div');
      wrap.append(h('div', { class: 'controls' }, ctl('Hai client cùng tăng counter = 42', s2.el)), lg, out);
      function draw() {
        lg.reset(); clear(out);
        const lines = raceIso
          ? ['Client 1: get counter → 42', 'Client 1: set counter = 43', 'Client 2: (phải chờ Client 1) get counter → 43', 'Client 2: set counter = 44']
          : ['Client 1: get counter → 42', 'Client 2: get counter → 42', 'Client 1: set counter = 43', 'Client 2: set counter = 43'];
        lines.forEach((l) => lg.add(l));
        out.append(verdictBox(raceIso ? { tone: 'ok', title: 'counter = 44', text: 'Kết quả như thể hai giao dịch chạy lần lượt.' } : { tone: 'bad', title: 'counter = 43', text: 'Race condition (Hình 7-1): một lần tăng bị mất. Thử lại chi tiết ở mục 8.8.' }));
      }
      draw();
      return wrap;
    }
    render();
  });

  /* ---- durability matrix ---- */
  widget('durability', (root) => {
    const TECH = { disk: 'Ghi xuống đĩa (fsync + WAL)', sync: 'Sao chép đồng bộ sang node khác', async: 'Sao chép bất đồng bộ', backup: 'Backup định kỳ (giữ bản cũ)' };
    const FAULT = {
      machine: 'Một máy chết hẳn', power: 'Mất điện cả trung tâm dữ liệu', bug: 'Bug làm sập mọi node với cùng một input',
      leader: 'Leader chết trước khi kịp sao chép', ssd: 'SSD “nói dối” fsync khi mất điện', rot: 'Dữ liệu hỏng âm thầm nhiều tuần',
    };
    // outcome per technique per fault, for [vừa commit, dữ liệu cũ]
    const R = {
      disk: { machine: ['down', 'down'], power: ['safe', 'safe'], bug: ['safe', 'safe'], leader: ['down', 'down'], ssd: ['maybe', 'safe'], rot: ['lost', 'lost'] },
      sync: { machine: ['safe', 'safe'], power: ['lost', 'lost'], bug: ['lost', 'lost'], leader: ['safe', 'safe'], ssd: ['safe', 'safe'], rot: ['lost', 'lost'] },
      async: { machine: ['maybe', 'safe'], power: ['lost', 'lost'], bug: ['lost', 'lost'], leader: ['lost', 'safe'], ssd: ['maybe', 'safe'], rot: ['lost', 'lost'] },
      backup: { machine: ['lost', 'restore'], power: ['lost', 'restore'], bug: ['lost', 'restore'], leader: ['lost', 'restore'], ssd: ['lost', 'restore'], rot: ['lost', 'restore'] },
    };
    const RANK = { safe: 4, restore: 2, down: 3, maybe: 1, lost: 0 };
    const TXT = { safe: ['Còn và vẫn phục vụ', 'ok'], down: ['Còn trên đĩa, nhưng tạm không truy cập được', 'warn'], restore: ['Khôi phục được từ backup (mất thời gian)', 'warn'], maybe: ['Có thể mất', 'bad'], lost: ['Mất', 'bad'] };
    const on = { disk: true, sync: false, async: false, backup: false };
    let fault = 'power';
    const boxes = Object.keys(TECH).map((k) => checkbox(TECH[k], on[k], (v) => { on[k] = v; render(); }).el);
    const fs = seg({ label: 'Sự cố', options: Object.entries(FAULT).map(([value, label]) => ({ value, label })), value: fault, onChange: (v) => { fault = v; render(); } });
    const out = h('div', { class: 'stats' });
    const why = h('p', { class: 'lab-note' });
    root.append(h('div', { class: 'btn-row' }, boxes), h('div', { class: 'controls' }, ctl('Sự cố', fs.el)), out, why);
    const WHY = {
      machine: 'Ổ đĩa còn nguyên nhưng nằm trong máy chết: phải sửa máy hoặc chuyển đĩa sang máy khác. Bản sao trên node khác giúp hệ thống tiếp tục chạy.',
      power: 'Lỗi tương quan: mọi bản sao chỉ nằm trong RAM đều mất cùng lúc. Vì vậy ghi xuống đĩa vẫn quan trọng, kể cả với CSDL in-memory.',
      bug: 'Một input đặc biệt làm sập tất cả node: sao chép không giúp gì nếu bản sao chỉ ở trong bộ nhớ.',
      leader: 'Với sao chép bất đồng bộ, các ghi gần nhất có thể chưa tới follower khi leader chết; failover sẽ làm mất chúng.',
      ssd: 'Nghiên cứu cho thấy SSD đôi khi vi phạm cam kết khi mất điện đột ngột: fsync cũng không chắc chắn. Bản sao trên máy khác (nguồn điện khác) cứu được ghi mới nhất.',
      rot: 'Hỏng dữ liệu không bị phát hiện thì bản sao và backup gần đây cũng hỏng theo; chỉ còn backup lịch sử đủ cũ. Ghi vừa commit thì chưa có trong backup nào.',
    };
    function best(i) {
      let b = 'lost';
      Object.keys(on).forEach((k) => { if (on[k] && RANK[R[k][fault][i]] > RANK[b]) b = R[k][fault][i]; });
      return b;
    }
    function render() {
      clear(out);
      ['Ghi vừa commit 1 giây trước', 'Dữ liệu commit từ tuần trước'].forEach((lbl, i) => {
        const r = best(i);
        out.append(stat(lbl, TXT[r][0], TXT[r][1]));
      });
      why.textContent = WHY[fault] + ' Không kỹ thuật nào tuyệt đối: nên kết hợp đĩa, sao chép và backup.';
    }
    render();
  });

  /* =====================================================================
   * 8.5 Retrying aborted transactions
   * ===================================================================== */
  widget('retry', (root) => {
    const ERR = { deadlock: 'Deadlock (lỗi tạm thời)', ack: 'Commit xong nhưng mất ACK', overload: 'CSDL quá tải', constraint: 'Vi phạm ràng buộc (vĩnh viễn)', crash: 'Client chết khi đang retry' };
    let err = 'ack';
    const o = { idem: false, backoff: false, transient: false, emailAfter: false };
    const es = seg({ label: 'Lỗi', options: Object.entries(ERR).map(([value, label]) => ({ value, label })), value: err, onChange: (v) => { err = v; run(); } });
    const cbs = [
      ['idem', 'Có khoá chống trùng (mã yêu cầu duy nhất)'], ['backoff', 'Backoff luỹ thừa + tối đa 3 lần'],
      ['transient', 'Chỉ retry lỗi tạm thời'], ['emailAfter', 'Chỉ gửi email sau khi commit thành công'],
    ].map(([k, l]) => checkbox(l, o[k], (v) => { o[k] = v; run(); }).el);
    const lg = log();
    const sTry = stat('Số lần gửi', '0'), sOrd = stat('Đơn hàng trong CSDL', '0'), sMail = stat('Email đã gửi', '0'), sRes = stat('Kết quả', '');
    root.append(h('div', { class: 'controls' }, ctl('Đặt hàng: ghi đơn + gửi email xác nhận. Lỗi gặp phải', es.el)), h('div', { class: 'btn-row' }, cbs),
      h('div', { class: 'btn-row' }, button('Chạy lại kịch bản', run)), h('div', { class: 'stats' }, sTry, sOrd, sMail, sRes), lg);
    function run() {
      lg.reset();
      let tries = 0, orders = 0, mails = 0, res = ['', ''];
      const max = o.backoff ? 3 : 8;
      const permanent = err === 'constraint';
      let load = 95;
      for (let k = 1; k <= max; k++) {
        tries = k;
        let ok = false, committed = false, why = '';
        if (err === 'deadlock') { ok = k > 1; why = 'deadlock, CSDL huỷ giao dịch'; committed = ok; }
        else if (err === 'ack') { committed = true; ok = k > 1; why = 'commit thành công nhưng mạng rớt trước khi client nhận ACK'; }
        else if (err === 'overload') {
          ok = load < 100 && k > 1; why = `CSDL quá tải (tải ${fmt(load)}%)`; committed = ok;
        } else if (err === 'constraint') { why = 'vi phạm UNIQUE: email đã được dùng'; }
        else if (err === 'crash') { if (k === 1) why = 'deadlock'; else { lg.add(`Lần ${k}: client chết trước khi kịp gửi lại. Dữ liệu người dùng nhập chỉ nằm trong bộ nhớ của client → mất.`, 'bad'); res = ['Mất dữ liệu', 'bad']; break; } }
        if (!o.emailAfter && (committed || err === 'deadlock' || err === 'overload')) { mails++; }
        if (committed) {
          if (o.idem && orders > 0) lg.add(`Lần ${k}: CSDL nhận ra mã yêu cầu đã xử lý → không ghi thêm đơn.`, 'ok');
          else { orders++; lg.add(`Lần ${k}: ghi đơn hàng #${orders}.` + (ok ? ' COMMIT, client nhận ACK.' : ''), ok ? 'ok' : ''); }
        }
        if (ok) { if (o.emailAfter) mails++; res = ['Thành công', orders > 1 ? 'warn' : 'ok']; break; }
        lg.add(`Lần ${k}: lỗi: ${why}.`, 'warn');
        if (o.transient && permanent) { lg.add('Lỗi vĩnh viễn → không retry, báo người dùng sửa thông tin.', 'ok'); res = ['Báo lỗi cho người dùng', 'ok']; break; }
        if (err === 'overload') {
          if (o.backoff) { lg.add(`  chờ ${100 * 2 ** (k - 1)} ms rồi mới thử lại; các client khác cũng lùi lại → tải giảm.`, 't'); load = Math.max(70, load - 15); }
          else { load = Math.round(load * 1.6); lg.add(`  thử lại ngay lập tức; mọi client cùng làm vậy → tải ${fmt(load)}%.`, 'bad'); }
        } else if (o.backoff && k < max) lg.add(`  chờ ${100 * 2 ** (k - 1)} ms rồi thử lại.`, 't');
        if (k === max) res = [o.backoff ? 'Dừng sau 3 lần, báo lỗi' : 'Bỏ cuộc sau 8 lần', o.backoff ? 'warn' : 'bad'];
      }
      if (err === 'overload' && !o.backoff && load > 300) res = ['CSDL sập vì retry dồn dập', 'bad'];
      sTry.update(String(tries)); sOrd.update(String(orders), orders > 1 ? 'bad' : orders === 1 ? 'ok' : '', orders > 1 ? 'đơn bị ghi trùng!' : '');
      sMail.update(String(mails), mails > 1 ? 'bad' : '', mails > 1 ? 'khách nhận nhiều email' : ''); sRes.update(res[0], res[1]);
    }
    run();
  });

  /* =====================================================================
   * 8.6 Implementing read committed: read locks vs remembering old value
   * ===================================================================== */
  widget('rc-impl', (root) => {
    let D = 6, mode = 'lock';
    const sl = slider({ label: 'Giao dịch ghi giữ khoá trong', min: 1, max: 12, value: D, format: (v) => v + ' s', onInput: (v) => { D = v; draw(); } });
    const sg = seg({ label: 'Cách chống dirty read', options: [{ value: 'lock', label: 'Reader cũng phải lấy khoá' }, { value: 'old', label: 'Nhớ giá trị cũ đã commit' }], value: mode, onChange: (v) => { mode = v; draw(); } });
    const viz = h('div', { class: 'viz' });
    const sB = stat('Reader bị chặn', ''), sAvg = stat('Chờ trung bình', ''), sMax = stat('Chờ lâu nhất', '');
    root.append(h('div', { class: 'controls' }, sl.el, ctl('Cách chống dirty read', sg.el)), viz, h('div', { class: 'stats' }, sB, sAvg, sMax),
      h('p', { class: 'lab-note' }, 'Số liệu minh hoạ: 10 giao dịch chỉ đọc x, đến lần lượt; giao dịch ghi đặt x = 3 lúc t = 1 s và commit sau đó.'));
    function draw() {
      const W = 640, x0 = 70, x1 = 620, T = 16, X = (t) => x0 + ((x1 - x0) * t) / T;
      const svg = s('svg', { viewBox: `0 0 ${W} 250`, role: 'img', 'aria-label': 'Dòng thời gian giao dịch ghi và các reader' });
      for (let t = 0; t <= T; t += 2) { svg.append(s('line', { x1: X(t), x2: X(t), y1: 18, y2: 228, class: 'grid' }), s('text', { x: X(t), y: 244, 'text-anchor': 'middle' }, t + ' s')); }
      const w0 = 1, w1 = 1 + D;
      svg.append(s('text', { x: 4, y: 34, class: 'lbl-strong' }, 'Ghi x = 3'), s('rect', { x: X(w0), y: 24, width: X(w1) - X(w0), height: 14, rx: 3, class: 'f-mark' }),
        s('text', { x: X(w1) + 4, y: 35 }, 'COMMIT'));
      const waits = [];
      for (let i = 0; i < 10; i++) {
        const t = 0.5 + i * 1.4, y = 60 + i * 17;
        const blocked = mode === 'lock' && t >= w0 && t < w1;
        const tr = blocked ? w1 : t;
        waits.push(tr - t);
        const val = tr >= w1 ? 3 : 2;
        svg.append(s('text', { x: 4, y: y + 4 }, 'Reader ' + (i + 1)));
        if (blocked) svg.append(s('line', { x1: X(t), x2: X(tr), y1: y, y2: y, class: 's-bad', 'stroke-width': 3 }));
        svg.append(s('circle', { cx: X(t), cy: y, r: 3.5, class: 'f-ink3' }), s('circle', { cx: X(tr), cy: y, r: 5, class: blocked ? 'f-bad' : 'f-ok' }),
          s('text', { x: X(tr) + 8, y: y + 4 }, 'đọc x = ' + val));
      }
      clear(viz).append(svg);
      const nB = waits.filter((w) => w > 0).length;
      sB.update(nB + '/10', nB ? 'bad' : 'ok');
      sAvg.update(fmt(waits.reduce((a, b) => a + b, 0) / 10, 1) + ' s', nB ? 'warn' : 'ok');
      sMax.update(fmt(Math.max(...waits), 1) + ' s', nB ? 'bad' : 'ok', mode === 'lock' ? 'một giao dịch ghi chậm kéo chậm mọi reader' : 'reader không bao giờ phải chờ');
    }
    draw();
  });

  /* =====================================================================
   * 8.9 MVCC: created_by / deleted_by and visibility rules (Figure 7-7)
   * ===================================================================== */
  widget('mvcc', (root) => {
    let V, status, readers, sel, nextReader;
    const lg = log();
    function reset() {
      V = [{ acc: 1, bal: 500, cb: 3, db: null }, { acc: 2, bal: 500, cb: 3, db: null }];
      status = { 3: 'committed', 12: 'active', 13: 'active' };
      readers = [{ id: 12, inprog: new Set() }];
      sel = 12; nextReader = 14;
      w13(2, -100); w13(1, 100);
      lg.reset();
      lg.add('T3 tạo hai tài khoản, mỗi tài khoản $500 (đã commit từ lâu).', 't');
      lg.add('T12 bắt đầu (giao dịch đọc, như Hình 7-7).', 't');
      lg.add('T13 bắt đầu sau T12: trừ $100 tài khoản 2, cộng $100 tài khoản 1. Chưa commit.', '');
    }
    function w13(acc, d) {
      const v = V.find((x) => x.acc === acc && x.db == null);
      v.db = 13;
      V.push({ acc, bal: v.bal + d, cb: 13, db: null });
    }
    const sees = (w, R) => w === R.id || (w < R.id && !R.inprog.has(w) && status[w] === 'committed');
    const reason = (w, R) => status[w] === 'aborted' ? `T${w} đã bị huỷ (quy tắc 2)` : w > R.id ? `T${w} bắt đầu sau T${R.id} (quy tắc 3)` : R.inprog.has(w) ? `T${w} đang chạy khi T${R.id} bắt đầu (quy tắc 1)` : `T${w} đã commit trước khi T${R.id} bắt đầu`;
    function vis(v, R) {
      if (!sees(v.cb, R)) return [false, 'ẩn: ' + reason(v.cb, R)];
      if (v.db != null && sees(v.db, R)) return [false, `ẩn: đã bị T${v.db} xoá (${reason(v.db, R)})`];
      if (v.db != null) return [true, `thấy: lệnh xoá của T${v.db} bị bỏ qua vì ${reason(v.db, R)}`];
      return [true, 'thấy: ' + reason(v.cb, R)];
    }
    const ctrl = h('div', { class: 'controls' });
    const btns = h('div', { class: 'btn-row' });
    const tableEl = h('div');
    const statsEl = h('div', { class: 'stats' });
    root.append(ctrl, btns, tableEl, statsEl, lg);
    function render() {
      clear(ctrl); clear(btns); clear(tableEl); clear(statsEl);
      const active = readers.filter((R) => status[R.id] === 'active');
      if (!readers.some((R) => R.id === sel)) sel = readers[0] && readers[0].id;
      const sg = seg({ label: 'Giao dịch đọc', options: readers.map((R) => ({ value: R.id, label: 'T' + R.id + (status[R.id] === 'active' ? '' : ' (đã xong)') })), value: sel, onChange: (v) => { sel = v; render(); } });
      ctrl.append(ctl('Nhìn từ góc của giao dịch đọc', sg.el));
      const t13 = status[13] === 'active';
      btns.append(
        button('T13: COMMIT', () => { status[13] = 'committed'; lg.add('T13 COMMIT.', 'ok'); render(); }),
        button('T13: ABORT', () => { status[13] = 'aborted'; lg.add('T13 ABORT: các phiên bản nó tạo trở thành vô hình (quy tắc 2).', 'bad'); render(); }, 'danger'),
        button('Bắt đầu giao dịch đọc mới', () => {
          const R = { id: nextReader++, inprog: new Set(Object.keys(status).map(Number).filter((k) => status[k] === 'active')) };
          status[R.id] = 'active'; readers.push(R); sel = R.id;
          lg.add(`T${R.id} bắt đầu. Danh sách đang chạy lúc đó: {${[...R.inprog].map((x) => 'T' + x).join(', ') || 'trống'}}.`, 'acc');
          render();
        }, 'ghost'),
        button('Kết thúc giao dịch đọc này', () => { status[sel] = 'committed'; lg.add(`T${sel} kết thúc.`, 't'); render(); }, 'ghost'),
        button('Dọn rác (GC)', () => {
          const act = readers.filter((R) => status[R.id] === 'active');
          const before = V.length;
          V = V.filter((v) => !(status[v.cb] === 'aborted' || (v.db != null && status[v.db] === 'committed' && act.every((R) => sees(v.db, R)))));
          lg.add(before - V.length ? `GC xoá ${before - V.length} phiên bản không còn giao dịch nào nhìn thấy.` : 'GC: chưa xoá được gì vì vẫn còn giao dịch đang chạy có thể cần các phiên bản cũ.', before - V.length ? 'ok' : 'warn');
          render();
        }, 'ghost'),
        button('Đặt lại', () => { reset(); render(); }, 'ghost'));
      btns.children[0].disabled = !t13; btns.children[1].disabled = !t13;
      btns.children[3].disabled = status[sel] !== 'active';
      const R = readers.find((x) => x.id === sel);
      const tb = h('tbody');
      V.slice().sort((a, b) => a.acc - b.acc || a.cb - b.cb).forEach((v) => {
        const [ok, why] = R ? vis(v, R) : [false, ''];
        tb.append(h('tr', { class: ok ? 'hit' : '' }, h('td', 'Tài khoản ' + v.acc), h('td', { class: 'num' }, usd(v.bal)),
          h('td', { class: 'num' }, 'T' + v.cb + (status[v.cb] === 'aborted' ? ' (huỷ)' : status[v.cb] === 'active' ? ' (đang chạy)' : '')),
          h('td', { class: 'num' }, v.db == null ? '—' : 'T' + v.db + (status[v.db] === 'aborted' ? ' (huỷ)' : status[v.db] === 'active' ? ' (đang chạy)' : '')),
          h('td', h('span', { class: 'pill ' + (ok ? 'ok' : '') }, ok ? '✓' : '✗'), ' ', why)));
      });
      tableEl.append(h('div', { class: 'table-wrap' }, h('table', { class: 'data compact' },
        h('thead', h('tr', h('th', 'Hàng'), h('th', { class: 'num' }, 'balance'), h('th', { class: 'num' }, 'created_by'), h('th', { class: 'num' }, 'deleted_by'), h('th', 'Với T' + sel))), tb)));
      readers.forEach((Rd) => {
        const tot = [1, 2].map((a) => V.filter((v) => v.acc === a && vis(v, Rd)[0]).map((v) => v.bal)[0]);
        const sum = tot.reduce((x, y) => x + (y || 0), 0);
        statsEl.append(stat('T' + Rd.id + ' đọc được', usd(tot[0] || 0) + ' + ' + usd(tot[1] || 0), sum === 1000 ? 'ok' : 'bad', 'tổng ' + usd(sum) + (status[Rd.id] === 'active' ? '' : ' · đã kết thúc')));
      });
    }
    reset();
    render();
  });

  /* =====================================================================
   * 8.12 Weak isolation summary table
   * ===================================================================== */
  widget('iso-table', (root) => {
    const LV = ['Read uncommitted', 'Read committed', 'Snapshot isolation', 'Serializable'];
    const A = [
      { name: 'Dirty write', topic: 'ch8-read-committed', c: ['ok', 'ok', 'ok', 'ok'], why: ['Ngay cả mức thấp nhất cũng giữ khoá ghi theo dòng tới khi commit.', 'Khoá ghi theo dòng: người ghi thứ hai phải chờ.', 'Vẫn dùng khoá ghi như read committed.', 'Mọi cách cài đặt serializable đều ngăn.'] },
      { name: 'Dirty read', topic: 'ch8-read-committed', c: ['bad', 'ok', 'ok', 'ok'], why: ['Read uncommitted cho phép đọc giá trị chưa commit: đó chính là định nghĩa.', 'Reader nhận giá trị cũ đã commit cho tới khi người ghi commit.', 'Snapshot chỉ chứa dữ liệu đã commit lúc giao dịch bắt đầu.', 'Ngăn được.'] },
      { name: 'Read skew', topic: 'ch8-snapshot', c: ['bad', 'bad', 'ok', 'ok'], why: ['Không có gì ngăn.', 'Mỗi câu lệnh thấy dữ liệu đã commit tại thời điểm của nó, nên hai câu đọc có thể thuộc hai thời điểm khác nhau.', 'Mọi câu đọc trong giao dịch dùng cùng một snapshot.', 'Ngăn được.'] },
      { name: 'Lost update', topic: 'ch8-lost-update', c: ['bad', 'bad', 'warn', 'ok'], why: ['Không có gì ngăn.', 'Lần ghi thứ hai xảy ra sau khi lần đầu commit nên không phải dirty write, nhưng vẫn đè mất dữ liệu. Phải dùng UPDATE nguyên tử hoặc FOR UPDATE.', 'Tuỳ CSDL: PostgreSQL (repeatable read), Oracle (serializable), SQL Server (snapshot) tự phát hiện và huỷ; MySQL InnoDB (repeatable read) thì không.', 'Ngăn được.'] },
      { name: 'Write skew', topic: 'ch8-write-skew', c: ['bad', 'bad', 'bad', 'ok'], why: ['Không có gì ngăn.', 'Không ngăn.', 'Hai giao dịch sửa hai đối tượng khác nhau nên không có xung đột ghi nào để phát hiện. Cần FOR UPDATE hoặc serializable.', 'Chỉ serializable mới ngăn tự động.'] },
      { name: 'Phantom gây write skew', topic: 'ch8-phantoms', c: ['bad', 'bad', 'bad', 'ok'], why: ['Không có gì ngăn.', 'Không ngăn.', 'Snapshot ngăn phantom trong truy vấn chỉ đọc, nhưng không ngăn khi giao dịch quyết định ghi dựa trên kết quả tìm kiếm.', 'Cần khoá vị từ / index-range lock (2PL) hoặc SSI.'] },
    ];
    const ICON = { ok: ['Ngăn', 'ok'], bad: ['Có thể xảy ra', 'bad'], warn: ['Tuỳ CSDL', 'warn'] };
    let sel = [3, 2];
    const tw = h('div', { class: 'table-wrap' });
    const det = h('div');
    root.append(h('p', { class: 'lab-note' }, 'Bấm vào một ô để xem lý do.'), tw, det);
    function render() {
      const tb = h('tbody');
      A.forEach((a, i) => {
        tb.append(h('tr', { class: sel[0] === i ? 'hit' : '' }, h('th', a.name), a.c.map((c, j) => h('td', h('button', { type: 'button', class: 'cellbtn' + (sel[0] === i && sel[1] === j ? ' on' : ''), onClick: () => { sel = [i, j]; render(); } }, h('span', { class: 'pill ' + ICON[c][1] }, ICON[c][0]))))));
      });
      clear(tw).append(h('table', { class: 'data compact' }, h('thead', h('tr', h('th', 'Hiện tượng'), LV.map((l) => h('th', l)))), tb));
      const a = A[sel[0]];
      clear(det).append(verdictBox({ tone: a.c[sel[1]] === 'ok' ? 'ok' : a.c[sel[1]] === 'bad' ? 'bad' : 'warn', title: `${a.name} · ${LV[sel[1]]}: ${ICON[a.c[sel[1]]][0]}`, text: a.why[sel[1]] }),
        h('p', { class: 'lab-note' }, h('a', { href: '#' + a.topic }, 'Thử hiện tượng này trong bộ lập lịch →')));
    }
    render();
  });

  /* =====================================================================
   * 8.13 Actual serial execution
   * ===================================================================== */
  widget('serial-exec', (root) => {
    let n = 4, rtt = 0.5, parts = 4, cross = 0;
    const CPU = 0.02; // ms per statement (số liệu minh hoạ)
    const slN = slider({ label: 'Số câu lệnh mỗi giao dịch', min: 1, max: 10, value: n, onInput: (v) => { n = v; draw(); } });
    const slR = slider({ label: 'Độ trễ mạng app ↔ CSDL (khứ hồi)', min: 0.1, max: 2, step: 0.1, value: rtt, format: (v) => fmt(v, 1) + ' ms', onInput: (v) => { rtt = v; draw(); } });
    const slP = slider({ label: 'Số partition (mỗi partition một lõi CPU)', min: 1, max: 16, value: parts, onInput: (v) => { parts = v; draw(); } });
    const slC = slider({ label: 'Tỉ lệ giao dịch đa partition', min: 0, max: 20, step: 0.5, value: cross, format: (v) => fmt(v, 1) + '%', onInput: (v) => { cross = v; draw(); } });
    const viz1 = h('div', { class: 'viz' }), viz2 = h('div', { class: 'viz' });
    const sI = stat('Tương tác (interactive)', ''), sS = stat('Stored procedure', ''), sIdle = stat('Luồng CSDL ngồi chờ mạng', '');
    const sT = stat('Tổng thông lượng', ''), sX = stat('Giới hạn do giao dịch đa partition', '');
    root.append(h('h4', { class: 'lab-h' }, '1 · Một luồng duy nhất'), h('div', { class: 'controls' }, slN.el, slR.el), viz1, h('div', { class: 'stats' }, sI, sS, sIdle),
      h('h4', { class: 'lab-h' }, '2 · Chia partition để dùng nhiều lõi'), h('div', { class: 'controls' }, slP.el, slC.el), viz2, h('div', { class: 'stats' }, sT, sX),
      h('p', { class: 'lab-note' }, 'Số liệu minh hoạ: mỗi câu lệnh tốn 20 µs CPU khi dữ liệu nằm trong RAM. Giao dịch đa partition chiếm mọi partition khoảng 1 ms, khớp con số sách trích từ VoltDB: khoảng 1.000 ghi đa partition mỗi giây.'));
    function draw() {
      const tI = n * (CPU + rtt), tS = n * CPU;
      const tpsI = 1000 / tI, tpsS = 1000 / tS;
      sI.update(fmtBig(tpsI) + ' tx/s', 'bad'); sS.update(fmtBig(tpsS) + ' tx/s', 'ok');
      sIdle.update(pct(1 - CPU / (CPU + rtt), 0), 'warn', 'thời gian luồng duy nhất bị giữ mà không làm gì');
      const W = 640, x0 = 110, x1 = 625, span = Math.max(tI * 2, 0.5), X = (t) => x0 + ((x1 - x0) * t) / span;
      const svg = s('svg', { viewBox: `0 0 ${W} 120`, role: 'img', 'aria-label': 'Thời gian của luồng CSDL' });
      svg.append(s('text', { x: 4, y: 38, class: 'lbl-strong' }, 'Tương tác'), s('text', { x: 4, y: 78, class: 'lbl-strong' }, 'Stored proc.'));
      for (let k = 0, t = 0; t < span; k++) {
        for (let j = 0; j < n && t < span; j++) {
          svg.append(s('rect', { x: X(t), y: 26, width: Math.max(1, X(Math.min(span, t + CPU)) - X(t)), height: 18, class: k % 2 ? 'f-accent' : 'f-violet' }));
          t += CPU;
          svg.append(s('rect', { x: X(t), y: 30, width: Math.max(0, X(Math.min(span, t + rtt)) - X(t)), height: 10, class: 'f-mark-soft' }));
          t += rtt;
        }
      }
      for (let k = 0, t = 0; t < span && k < 600; k++) { svg.append(s('rect', { x: X(t), y: 66, width: Math.max(0.6, X(Math.min(span, t + tS)) - X(t)), height: 18, class: k % 2 ? 'f-accent' : 'f-violet' })); t += tS; }
      svg.append(s('line', { x1: x0, x2: x1, y1: 96, y2: 96, class: 'axis' }), s('text', { x: x0, y: 112 }, '0'), s('text', { x: x1, y: 112, 'text-anchor': 'end' }, fmt(span, 2) + ' ms'),
        s('rect', { x: x0 + 120, y: 103, width: 10, height: 8, class: 'f-mark-soft' }), s('text', { x: x0 + 134, y: 111 }, 'luồng chờ câu lệnh tiếp theo qua mạng'),
        s('rect', { x: x0 + 370, y: 103, width: 10, height: 8, class: 'f-accent' }), s('text', { x: x0 + 384, y: 111 }, 'CPU đang chạy (mỗi màu một giao dịch)'));
      clear(viz1).append(svg);
      // partitioning
      const P = tpsS, c = 0.001, f = cross / 100;
      const thr = (k, ff) => 1 / ((1 - ff) / (k * P) + ff * c);
      const max = thr(16, 0);
      const W2 = 640, H2 = 220, l = 80, r = 620, t0 = 16, b = 180;
      const XX = (k) => l + ((r - l) * (k - 1)) / 15, YY = (v) => b - ((b - t0) * v) / max;
      const svg2 = s('svg', { viewBox: `0 0 ${W2} ${H2}`, role: 'img', 'aria-label': 'Thông lượng theo số partition' });
      for (let i = 0; i <= 4; i++) { const v = (max * i) / 4; svg2.append(s('line', { x1: l, x2: r, y1: YY(v), y2: YY(v), class: 'grid' }), s('text', { x: l - 6, y: YY(v) + 4, 'text-anchor': 'end' }, fmtBig(v))); }
      [1, 4, 8, 12, 16].forEach((k) => svg2.append(s('text', { x: XX(k), y: b + 16, 'text-anchor': 'middle' }, String(k))));
      svg2.append(s('text', { x: (l + r) / 2, y: b + 34, 'text-anchor': 'middle' }, 'số partition / lõi CPU'), s('text', { x: 4, y: 12 }, 'tx/s'));
      const path = (ff) => Array.from({ length: 16 }, (_, i) => (i ? 'L' : 'M') + XX(i + 1) + ' ' + YY(thr(i + 1, ff))).join(' ');
      svg2.append(s('path', { d: path(0), class: 'f-none s-ink3 dash', 'stroke-width': 1.5 }), s('path', { d: path(f), class: 'f-none s-accent', 'stroke-width': 2.5 }),
        s('circle', { cx: XX(parts), cy: YY(thr(parts, f)), r: 5, class: 'f-accent' }),
        s('text', { x: XX(16) - 4, y: YY(thr(16, 0)) + 16, 'text-anchor': 'end' }, 'chỉ giao dịch một partition'));
      clear(viz2).append(svg2);
      sT.update(fmtBig(thr(parts, f)) + ' tx/s', f > 0.02 ? 'warn' : 'ok', `${parts} lõi × ${fmtBig(P)} tx/s nếu không có giao dịch đa partition`);
      sX.update(f ? fmtBig(1000 / f) + ' tx/s' : 'không', f ? 'bad' : 'ok', f ? 'thêm lõi cũng không vượt được trần này' : 'thông lượng tăng tuyến tính theo số lõi');
    }
    draw();
  });

  /* =====================================================================
   * 8.14 Two-phase locking: shared/exclusive locks and deadlock
   * ===================================================================== */
  widget('locks-2pl', (root) => {
    const OBJ = ['A', 'B'];
    let T, held, nextN, busy = false;
    const lg = log();
    const rowsEl = h('div', { class: 'lk-rows' });
    const tableEl = h('div');
    const viz = h('div', { class: 'viz lk-graph' });
    const bDemo = button('Tạo deadlock theo kịch bản', demo);
    const bReset = button('Đặt lại', () => { init(); render(); }, 'ghost');
    root.append(h('div', { class: 'btn-row' }, bDemo, bReset), rowsEl, h('div', { class: 'lab-split' }, tableEl, viz), lg);
    function init() {
      T = [1, 2, 3].map((id) => ({ id, status: 'active', wait: null }));
      held = { A: new Map(), B: new Map() };
      nextN = 4;
      lg.reset();
    }
    const tx = (id) => T.find((t) => t.id === id);
    function conflicts(t, o, mode) {
      const b = [];
      held[o].forEach((m, id) => { if (id !== t.id && (mode === 'X' || m === 'X')) b.push(id); });
      return b;
    }
    function request(t, o, mode, quiet) {
      const cur = held[o].get(t.id);
      if (cur === 'X' || (cur === 'S' && mode === 'S')) { if (!quiet) lg.add(`T${t.id} đã giữ khoá ${cur} trên ${o}.`, 't'); return true; }
      const b = conflicts(t, o, mode);
      if (!b.length) {
        held[o].set(t.id, mode);
        lg.add(`T${t.id} ${mode === 'S' ? 'đọc' : 'ghi'} ${o}: được cấp khoá ${mode === 'S' ? 'shared' : 'exclusive'}${cur === 'S' ? ' (nâng cấp từ shared)' : ''}.`, 'ok');
        t.wait = null;
        return true;
      }
      if (!t.wait) lg.add(`T${t.id} ${mode === 'S' ? 'đọc' : 'ghi'} ${o}: phải chờ ${b.map((x) => 'T' + x).join(', ')} (đang giữ khoá ${b.map((x) => held[o].get(x)).join('/')}).`, 'warn');
      t.wait = { o, mode, b };
      t.status = 'waiting';
      const cyc = findCycle(t);
      if (cyc) {
        lg.add(`Deadlock: ${cyc.map((x) => 'T' + x).join(' → ')} → T${cyc[0]}. CSDL huỷ T${t.id}; ứng dụng cần thử lại.`, 'bad');
        finish(t, 'aborted');
      }
      return false;
    }
    function findCycle(t) {
      const path = [];
      const seen = new Set();
      function dfs(u) {
        if (!u || !u.wait || seen.has(u.id)) return false;
        seen.add(u.id); path.push(u.id);
        for (const id of u.wait.b) { if (id === t.id) return true; if (dfs(tx(id))) return true; }
        path.pop();
        return false;
      }
      return dfs(t) ? path : null;
    }
    function finish(t, st) {
      t.status = st; t.wait = null;
      OBJ.forEach((o) => held[o].delete(t.id));
      if (st === 'committed') lg.add(`T${t.id} COMMIT: nhả mọi khoá (pha 2).`, 'ok');
      else if (st === 'aborted') lg.add(`T${t.id} bị huỷ: nhả mọi khoá.`, 'bad');
      let prog = true;
      while (prog) {
        prog = false;
        T.forEach((u) => { if (u.status === 'waiting' && u.wait) { const w = u.wait; u.wait.b = conflicts(u, w.o, w.mode); if (!u.wait.b.length) { u.status = 'active'; request(u, w.o, w.mode); prog = true; } } });
      }
    }
    function act(t, kind, o) {
      if (kind === 'R') request(t, o, 'S');
      else if (kind === 'W') request(t, o, 'X');
      else if (kind === 'C') finish(t, 'committed');
      else if (kind === 'A') finish(t, 'aborted');
      render();
    }
    async function demo() {
      if (busy) return;
      busy = true; bDemo.disabled = true; bReset.disabled = true;
      init(); render();
      lg.add('Kịch bản: T1 đọc A, T2 đọc B, rồi mỗi bên muốn ghi vào đối tượng bên kia đang đọc.', 't');
      const steps = [[1, 'R', 'A'], [2, 'R', 'B'], [1, 'W', 'B'], [2, 'W', 'A']];
      for (const [id, k, o] of steps) { await sleep(550); act(tx(id), k, o); }
      busy = false; bDemo.disabled = false; bReset.disabled = false;
    }
    function render() {
      clear(rowsEl);
      T.forEach((t, i) => {
        const can = t.status === 'active';
        const tone = { active: 'accent', waiting: 'warn', committed: 'ok', aborted: 'bad' }[t.status];
        const label = { active: 'đang chạy', waiting: 'đang chờ', committed: 'đã commit', aborted: 'bị huỷ' }[t.status];
        const holds = OBJ.filter((o) => held[o].has(t.id)).map((o) => held[o].get(t.id) + '(' + o + ')').join(' ') || 'không giữ khoá';
        const b = (txt, k, o) => { const el = button(txt, () => act(t, k, o), k === 'A' ? 'danger' : 'ghost'); el.classList.add('btn-sm'); el.disabled = !can || busy; return el; };
        const row = h('div', { class: 'lk-row' }, h('b', 'T' + t.id), pill(label, tone), h('span', { class: 'lab-note' }, holds),
          h('div', { class: 'btn-row' }, b('Đọc A', 'R', 'A'), b('Đọc B', 'R', 'B'), b('Ghi A', 'W', 'A'), b('Ghi B', 'W', 'B'), b('Commit', 'C'), b('Abort', 'A')));
        if (t.status === 'committed' || t.status === 'aborted') {
          const nb = button('Giao dịch mới', () => { T[i] = { id: nextN++, status: 'active', wait: null }; lg.add(`T${T[i].id} bắt đầu.`, 't'); render(); });
          nb.classList.add('btn-sm'); nb.disabled = busy; row.append(nb);
        }
        rowsEl.append(row);
      });
      const tb = h('tbody');
      OBJ.forEach((o) => {
        const hs = [...held[o]].map(([id, m]) => `T${id}: ${m === 'X' ? 'exclusive' : 'shared'}`).join(', ') || '—';
        const ws = T.filter((t) => t.wait && t.wait.o === o).map((t) => `T${t.id} (muốn ${t.wait.mode === 'X' ? 'exclusive' : 'shared'})`).join(', ') || '—';
        tb.append(h('tr', h('td', h('b', o)), h('td', hs), h('td', ws)));
      });
      clear(tableEl).append(h('div', { class: 'table-wrap' }, h('table', { class: 'data compact' }, h('thead', h('tr', h('th', 'Đối tượng'), h('th', 'Đang giữ khoá'), h('th', 'Đang chờ'))), tb)));
      // wait-for graph
      const P = [[160, 34], [60, 150], [260, 150]];
      const svg = s('svg', { viewBox: '0 0 320 190', role: 'img', 'aria-label': 'Đồ thị chờ (wait-for graph)' });
      svg.append(s('text', { x: 4, y: 14, class: 'lbl-strong' }, 'Đồ thị chờ'));
      const cyc = new Set();
      T.forEach((t) => { if (t.wait) t.wait.b.forEach((b0) => { const u = tx(b0); if (u && u.wait && u.wait.b.includes(t.id)) { cyc.add(t.id); cyc.add(b0); } }); });
      T.forEach((t, i) => {
        if (!t.wait) return;
        t.wait.b.forEach((bid) => {
          const j = T.findIndex((u) => u.id === bid);
          if (j < 0) return;
          const [ax, ay] = P[i], [bx, by] = P[j];
          const dx = bx - ax, dy = by - ay, L0 = Math.hypot(dx, dy), ux = dx / L0, uy = dy / L0;
          const off = 6;
          const sx = ax + ux * 26 - uy * off, sy = ay + uy * 26 + ux * off, ex = bx - ux * 28 - uy * off, ey = by - uy * 28 + ux * off;
          const cls = cyc.has(t.id) && cyc.has(bid) ? 's-bad' : 's-warn';
          svg.append(s('line', { x1: sx, y1: sy, x2: ex, y2: ey, class: cls + ' f-none', 'stroke-width': 2 }),
            s('polygon', { points: `${ex},${ey} ${ex - ux * 9 - uy * 5},${ey - uy * 9 + ux * 5} ${ex - ux * 9 + uy * 5},${ey - uy * 9 - ux * 5}`, class: cls === 's-bad' ? 'f-bad' : 'f-warn' }));
        });
      });
      T.forEach((t, i) => {
        const cls = t.status === 'aborted' ? 'f-bad-soft s-bad' : t.status === 'committed' ? 'f-surface2 s-ok' : t.status === 'waiting' ? 'f-mark-soft s-warn' : 'f-accent-soft s-accent';
        svg.append(s('circle', { cx: P[i][0], cy: P[i][1], r: 22, class: cls, 'stroke-width': 2 }), s('text', { x: P[i][0], y: P[i][1] + 4, 'text-anchor': 'middle', class: 'lbl-strong' }, 'T' + t.id));
      });
      svg.append(s('text', { x: 160, y: 186, 'text-anchor': 'middle' }, 'mũi tên X → Y: X đang chờ khoá Y giữ'));
      clear(viz).append(svg);
    }
    init();
    request(tx(1), 'A', 'S'); request(tx(2), 'A', 'S'); request(tx(3), 'B', 'X');
    lg.add('Hai giao dịch cùng giữ shared lock trên A được; T3 giữ exclusive lock trên B. Thử cho T1 ghi A, hoặc bấm “Tạo deadlock”.', 't');
    render();
  });

  /* =====================================================================
   * 8.15 Predicate locks vs index-range locks
   * ===================================================================== */
  widget('predicate-locks', (root) => {
    let mode = 'pred', room = 124, start = 12, dur = 1;
    const hist = { ok: 0, need: 0, extra: 0 };
    const MODES = { pred: 'Khoá vị từ (predicate lock)', room: 'Index-range: chỉ mục room_id', time: 'Index-range: chỉ mục thời gian', table: 'Khoá cả bảng' };
    const sm = seg({ label: 'Loại khoá', options: Object.entries(MODES).map(([value, label]) => ({ value, label })), value: mode, onChange: (v) => { mode = v; draw(); } });
    const sr = seg({ label: 'Phòng', options: [{ value: 123, label: 'Phòng 123' }, { value: 124, label: 'Phòng 124' }], value: room, onChange: (v) => { room = v; draw(); } });
    const ss = slider({ label: 'Giờ bắt đầu', min: 10, max: 14.5, step: 0.5, value: start, format: tm, onInput: (v) => { start = v; draw(); } });
    const sd = seg({ label: 'Thời lượng', options: [{ value: 0.5, label: '30 phút' }, { value: 1, label: '1 giờ' }], value: dur, onChange: (v) => { dur = v; draw(); } });
    const viz = h('div', { class: 'viz' });
    const res = h('div');
    const sOk = stat('Cho phép', '0', 'ok'), sNeed = stat('Bị chặn đúng', '0', 'accent', 'thật sự trùng với truy vấn của T1'), sExtra = stat('Bị chặn thừa', '0', 'warn', 'không trùng nhưng vẫn phải chờ');
    const bTry = button('T2: thử INSERT lịch này', () => { const r = judge(); hist[r.blocked ? (r.real ? 'need' : 'extra') : 'ok']++; draw(); });
    root.append(h('div', { class: 'controls' }, ctl('T1 đã chạy truy vấn tìm lịch phòng 123, 12:00–13:00 và giữ', sm.el)),
      h('div', { class: 'controls' }, ctl('T2 muốn đặt', sr.el), ss.el, ctl('Thời lượng', sd.el)), h('div', { class: 'btn-row' }, bTry), viz, res, h('div', { class: 'stats' }, sOk, sNeed, sExtra));
    const EX = [{ room: 123, s: 10, e: 11 }, { room: 124, s: 12, e: 13 }, { room: 123, s: 14, e: 15 }];
    function region() {
      if (mode === 'pred') return { rooms: [123], s: 12, e: 13 };
      if (mode === 'room') return { rooms: [123], s: 10, e: 15 };
      if (mode === 'time') return { rooms: [123, 124], s: 12, e: 13 };
      return { rooms: [123, 124], s: 10, e: 15 };
    }
    function judge() {
      const e = start + dur, g = region();
      const blocked = g.rooms.includes(room) && start < g.e && e > g.s;
      const real = room === 123 && start < 13 && e > 12;
      return { blocked, real };
    }
    function draw() {
      const W = 640, x0 = 90, x1 = 620, X = (t) => x0 + ((x1 - x0) * (t - 10)) / 5;
      const Y = { 123: 40, 124: 110 };
      const svg = s('svg', { viewBox: `0 0 ${W} 190`, role: 'img', 'aria-label': 'Lịch đặt phòng và vùng bị khoá' });
      for (let t = 10; t <= 15; t++) svg.append(s('line', { x1: X(t), x2: X(t), y1: 20, y2: 160, class: 'grid' }), s('text', { x: X(t), y: 176, 'text-anchor': 'middle' }, tm(t)));
      [123, 124].forEach((r) => svg.append(s('text', { x: 4, y: Y[r] + 24, class: 'lbl-strong' }, 'Phòng ' + r), s('rect', { x: x0, y: Y[r], width: x1 - x0, height: 40, class: 'f-surface2', rx: 4 })));
      const g = region();
      g.rooms.forEach((r) => svg.append(s('rect', { x: X(g.s), y: Y[r] - 6, width: X(g.e) - X(g.s), height: 52, rx: 5, class: 'f-mark-soft s-mark', 'stroke-width': 1.5 })));
      svg.append(s('rect', { x: X(12), y: Y[123] - 3, width: X(13) - X(12), height: 46, rx: 4, class: 'f-none s-accent dash', 'stroke-width': 2 }),
        s('text', { x: X(12.5), y: 16, 'text-anchor': 'middle', class: 'lbl-strong' }, 'Truy vấn của T1'));
      EX.forEach((b) => svg.append(s('rect', { x: X(b.s) + 2, y: Y[b.room] + 8, width: X(b.e) - X(b.s) - 4, height: 24, rx: 3, class: 'f-ink3' }), s('text', { x: X(b.s) + 8, y: Y[b.room] + 24, class: 'f-surface' }, 'đã đặt')));
      const r = judge();
      svg.append(s('rect', { x: X(start) + 2, y: Y[room] + 12, width: X(start + dur) - X(start) - 4, height: 16, rx: 3, class: r.blocked ? 'f-bad' : 'f-ok' }));
      clear(viz).append(svg);
      const txt = r.blocked ? (r.real ? 'T2 phải chờ: lịch này trùng đúng điều kiện T1 đã tìm, nên đây là chặn cần thiết để ngăn phantom.' : 'T2 phải chờ dù lịch này không ảnh hưởng tới truy vấn của T1: khoá xấp xỉ rộng hơn cần thiết. An toàn nhưng giảm song song.') : (r.real ? '' : 'T2 được INSERT ngay: lịch này không đụng tới vùng bị khoá.');
      clear(res).append(verdictBox({ tone: r.blocked ? (r.real ? 'accent' : 'warn') : 'ok', title: `Phòng ${room}, ${tm(start)}–${tm(start + dur)}: ${r.blocked ? 'bị chặn' : 'cho phép'}`, text: txt + ' ' + { pred: 'Khoá vị từ chính xác nhưng mỗi lần ghi phải so với mọi vị từ đang bị khoá: chậm khi có nhiều khoá.', room: 'Khoá gắn vào mục room_id = 123 trong chỉ mục: mọi lịch của phòng 123 đều bị chặn.', time: 'Khoá gắn vào dải 12:00–13:00 của chỉ mục thời gian: mọi phòng trong khung giờ này đều bị chặn.', table: 'Không có chỉ mục phù hợp thì khoá cả bảng: an toàn nhưng chặn mọi ghi.' }[mode] }));
      sOk.update(String(hist.ok)); sNeed.update(String(hist.need)); sExtra.update(String(hist.extra));
    }
    draw();
  });

  /* =====================================================================
   * 8.16 Pessimistic (2PL) vs optimistic (SSI) under contention
   * ===================================================================== */
  widget('occ-contention', (root) => {
    const MS = [2, 4, 8, 16, 32, 64, 128, 256];
    let mi = 4, C = 8;
    const sM = slider({ label: 'Số đối tượng được truy cập (ít = tranh chấp cao)', min: 0, max: MS.length - 1, value: mi, format: (v) => String(MS[v]), onInput: (v) => { mi = v; draw(); } });
    const sC = slider({ label: 'Số giao dịch chạy đồng thời', min: 2, max: 24, value: C, onInput: (v) => { C = v; draw(); } });
    const viz = h('div', { class: 'viz' });
    const grid = h('div', { class: 'lab-split' });
    root.append(h('div', { class: 'controls' }, sM.el, sC.el), viz, grid,
      h('p', { class: 'lab-note' }, 'Số liệu minh hoạ: mỗi giao dịch đọc 2 đối tượng ngẫu nhiên, ghi 1 trong 2, chạy 10 ms. 2PL lấy đủ khoá trước khi chạy (chờ nếu bị giữ). SSI chạy luôn, đến lúc commit mới kiểm tra và huỷ nếu dữ liệu đã đọc bị người khác commit đè lên.'));
    function sim(mode, M, Cn) {
      const r = rng(7 + M * 31 + Cn);
      const D = 10, TICKS = 3000;
      let committed = 0, aborts = 0;
      const lat = [];
      const X = new Map(), S = new Map(), lastW = new Map();
      const mk = (t) => { const a = Math.floor(r() * M); let b = Math.floor(r() * M); while (b === a) b = Math.floor(r() * M); return { w: a, rd: b, arrive: t, start: null, prog: 0 }; };
      const slots = Array.from({ length: Cn }, () => mk(0));
      for (let t = 0; t < TICKS; t++) {
        for (let i = 0; i < Cn; i++) {
          const x = slots[i];
          if (mode === '2pl') {
            if (x.start === null) {
              if (!X.has(x.w) && !(S.get(x.w) > 0) && !X.has(x.rd)) { X.set(x.w, 1); S.set(x.rd, (S.get(x.rd) || 0) + 1); x.start = t; } else continue;
            }
            if (++x.prog >= D) { X.delete(x.w); S.set(x.rd, S.get(x.rd) - 1); committed++; lat.push(t + 1 - x.arrive); slots[i] = mk(t + 1); }
          } else {
            if (x.start === null) x.start = t;
            if (++x.prog >= D) {
              const stale = [x.w, x.rd].some((o) => (lastW.has(o) ? lastW.get(o) : -1) >= x.start);
              if (stale) { aborts++; x.start = t + 1; x.prog = 0; }
              else { lastW.set(x.w, t); committed++; lat.push(t + 1 - x.arrive); slots[i] = mk(t + 1); }
            }
          }
        }
      }
      lat.sort((a, b) => a - b);
      return { tps: (committed / TICKS) * 1000, abortRate: aborts / (aborts + committed || 1), p50: percentile(lat, 0.5), p99: percentile(lat, 0.99) };
    }
    function draw() {
      const res = MS.map((M) => ({ M, a: sim('2pl', M, C), b: sim('ssi', M, C) }));
      const max = Math.max(...res.map((x) => Math.max(x.a.tps, x.b.tps))) * 1.1;
      const W = 640, H = 220, l = 70, r = 600, t0 = 16, bt = 176;
      const XX = (i) => l + ((r - l) * i) / (MS.length - 1), YY = (v) => bt - ((bt - t0) * v) / max;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Thông lượng 2PL và SSI theo mức tranh chấp' });
      for (let i = 0; i <= 4; i++) { const v = (max * i) / 4; svg.append(s('line', { x1: l, x2: r, y1: YY(v), y2: YY(v), class: 'grid' }), s('text', { x: l - 6, y: YY(v) + 4, 'text-anchor': 'end' }, fmt(v))); }
      MS.forEach((M, i) => svg.append(s('text', { x: XX(i), y: bt + 16, 'text-anchor': 'middle' }, String(M))));
      svg.append(s('text', { x: (l + r) / 2, y: bt + 34, 'text-anchor': 'middle' }, 'số đối tượng (trục log): trái = tranh chấp cao, phải = thấp'), s('text', { x: 4, y: 12 }, 'tx/s commit'));
      const path = (k) => res.map((x, i) => (i ? 'L' : 'M') + XX(i) + ' ' + YY(x[k].tps)).join(' ');
      svg.append(s('line', { x1: XX(mi), x2: XX(mi), y1: t0, y2: bt, class: 's-ink3 dash f-none' }),
        s('path', { d: path('a'), class: 'f-none s-accent', 'stroke-width': 2.5 }), s('path', { d: path('b'), class: 'f-none s-violet', 'stroke-width': 2.5 }));
      res.forEach((x, i) => svg.append(s('circle', { cx: XX(i), cy: YY(x.a.tps), r: 3.5, class: 'f-accent' }), s('circle', { cx: XX(i), cy: YY(x.b.tps), r: 3.5, class: 'f-violet' })));
      svg.append(s('rect', { x: r - 150, y: bt - 40, width: 10, height: 10, class: 'f-accent' }), s('text', { x: r - 136, y: bt - 31 }, '2PL (bi quan)'),
        s('rect', { x: r - 150, y: bt - 22, width: 10, height: 10, class: 'f-violet' }), s('text', { x: r - 136, y: bt - 13 }, 'SSI (lạc quan)'));
      clear(viz).append(svg);
      const cur = res[mi];
      clear(grid).append(
        h('div', { class: 'box' }, h('h5', '2PL · ' + MS[mi] + ' đối tượng'), h('div', { class: 'stats' }, stat('Thông lượng', fmt(cur.a.tps) + ' tx/s', 'accent'), stat('Bị huỷ', '0%', 'ok', 'chờ khoá thay vì huỷ'), stat('Độ trễ p50 / p99', fmt(cur.a.p50) + ' / ' + fmt(cur.a.p99) + ' ms', cur.a.p99 > 60 ? 'bad' : ''))),
        h('div', { class: 'box' }, h('h5', 'SSI · ' + MS[mi] + ' đối tượng'), h('div', { class: 'stats' }, stat('Thông lượng', fmt(cur.b.tps) + ' tx/s', 'accent'), stat('Bị huỷ', pct(cur.b.abortRate, 0), cur.b.abortRate > 0.3 ? 'bad' : cur.b.abortRate > 0.1 ? 'warn' : 'ok', 'phải chạy lại từ đầu'), stat('Độ trễ p50 / p99', fmt(cur.b.p50) + ' / ' + fmt(cur.b.p99) + ' ms', cur.b.p99 > 60 ? 'bad' : ''))));
    }
    draw();
  });

  glossary.add([
    { key: 'transaction', term: 'Transaction', vi: 'giao dịch', ch: 8, topic: 'ch8-concept', def: 'Cách gom nhiều lệnh đọc và ghi thành một đơn vị logic: hoặc tất cả thành công (commit), hoặc tất cả bị huỷ (abort) để ứng dụng thử lại an toàn.' },
    { key: 'commit', term: 'Commit', vi: 'xác nhận giao dịch', ch: 8, topic: 'ch8-concept', def: 'Kết thúc giao dịch thành công: mọi ghi của nó có hiệu lực và (nếu bền vững) không bị mất.' },
    { key: 'abort', term: 'Abort / rollback', vi: 'huỷ giao dịch', ch: 8, topic: 'ch8-concept', def: 'Kết thúc giao dịch thất bại: CSDL bỏ mọi ghi mà giao dịch đã làm, như thể nó chưa từng chạy.' },
    { key: 'acid', term: 'ACID', vi: 'atomicity, consistency, isolation, durability', ch: 8, topic: 'ch8-acid', def: 'Bộ bốn đảm bảo an toàn của giao dịch, đặt tên năm 1983. Thực tế mỗi CSDL hiểu khác nhau, nên “tuân thủ ACID” gần như đã thành thuật ngữ tiếp thị.' },
    { key: 'base', term: 'BASE', vi: 'basically available, soft state, eventual consistency', ch: 8, topic: 'ch8-acid', def: 'Tên gọi cho hệ thống không đáp ứng ACID. Còn mơ hồ hơn ACID; định nghĩa hợp lý duy nhất là “không phải ACID”.' },
    { key: 'atomicity', term: 'Atomicity', vi: 'tính nguyên tử (khả năng huỷ)', ch: 8, topic: 'ch8-acid', def: 'Trong ACID: nếu lỗi xảy ra giữa chừng, mọi ghi của giao dịch bị bỏ. Đáng lẽ nên gọi là abortability. Không liên quan đến đồng thời.' },
    { key: 'consistency-acid', term: 'Consistency (ACID)', vi: 'tính nhất quán', ch: 8, topic: 'ch8-acid', def: 'Các bất biến của ứng dụng luôn đúng. Đây là thuộc tính của ứng dụng chứ không phải của CSDL: CSDL chỉ lưu những gì ứng dụng ghi.' },
    { key: 'invariant', term: 'Invariant', vi: 'bất biến', ch: 8, topic: 'ch8-acid', def: 'Mệnh đề về dữ liệu phải luôn đúng, ví dụ tổng nợ bằng tổng có, hay ít nhất một bác sĩ trực mỗi ca.' },
    { key: 'isolation', term: 'Isolation', vi: 'tính cô lập', ch: 8, topic: 'ch8-acid', def: 'Các giao dịch chạy đồng thời không giẫm chân nhau. Định nghĩa kinh điển là serializability; thực tế thường dùng các mức yếu hơn.' },
    { key: 'durability', term: 'Durability', vi: 'tính bền vững', ch: 8, topic: 'ch8-acid', def: 'Lời hứa dữ liệu đã commit không bị quên: ghi xuống đĩa không mất khi tắt nguồn, hoặc sao chép sang vài node. Không bao giờ tuyệt đối.' },
    { key: 'race-condition', term: 'Race condition', vi: 'điều kiện tranh chấp', ch: 8, topic: 'ch8-acid', def: 'Lỗi chỉ xuất hiện khi các thao tác đồng thời xen kẽ theo một thứ tự “xui”. Khó tái hiện, khó phát hiện bằng test.' },
    { key: 'multi-object-transaction', term: 'Multi-object transaction', vi: 'giao dịch nhiều đối tượng', ch: 8, topic: 'ch8-multi-object', def: 'Giao dịch sửa nhiều hàng/tài liệu/khoá cùng lúc, cần khi dữ liệu phi chuẩn hoá, khoá ngoại hay chỉ mục phụ phải giữ đồng bộ.' },
    { key: 'compare-and-set', term: 'Compare-and-set (CAS)', vi: 'so sánh rồi gán', ch: 8, topic: 'ch8-lost-update', def: 'Thao tác chỉ ghi nếu giá trị hiện tại vẫn bằng giá trị đã đọc trước đó; nếu không, không làm gì và ứng dụng phải thử lại.' },
    { key: 'deduplication', term: 'Deduplication (idempotency key)', vi: 'chống ghi trùng', ch: 8, topic: 'ch8-retry', def: 'Cơ chế ở tầng ứng dụng gắn mã duy nhất cho mỗi yêu cầu để khi thử lại, CSDL nhận ra yêu cầu đã xử lý và không làm lần hai.' },
    { key: 'dirty-read', term: 'Dirty read', vi: 'đọc bẩn', ch: 8, topic: 'ch8-read-committed', def: 'Đọc được dữ liệu một giao dịch khác đã ghi nhưng chưa commit (và có thể sẽ bị rollback).' },
    { key: 'dirty-write', term: 'Dirty write', vi: 'ghi bẩn', ch: 8, topic: 'ch8-read-committed', def: 'Ghi đè lên dữ liệu một giao dịch khác đã ghi nhưng chưa commit. Gần như mọi CSDL đều ngăn bằng khoá ghi theo dòng.' },
    { key: 'read-uncommitted', term: 'Read uncommitted', vi: 'đọc chưa commit', ch: 8, topic: 'ch8-read-committed', def: 'Mức cô lập yếu nhất: ngăn dirty write nhưng cho phép dirty read.' },
    { key: 'read-committed', term: 'Read committed', vi: 'đọc đã commit', ch: 8, topic: 'ch8-read-committed', def: 'Mức cô lập cơ bản, mặc định ở PostgreSQL, Oracle, SQL Server: chỉ đọc dữ liệu đã commit, chỉ ghi đè dữ liệu đã commit.' },
    { key: 'row-level-lock', term: 'Row-level lock', vi: 'khoá theo dòng', ch: 8, topic: 'ch8-read-committed', def: 'Khoá trên từng hàng: giao dịch muốn ghi phải lấy khoá và giữ tới khi commit/abort; người ghi khác phải chờ.' },
    { key: 'read-skew', term: 'Read skew (nonrepeatable read)', vi: 'đọc lệch thời điểm', ch: 8, topic: 'ch8-snapshot', def: 'Một giao dịch thấy các phần khác nhau của CSDL ở những thời điểm khác nhau, ví dụ Alice thấy tổng số dư chỉ còn $900.' },
    { key: 'snapshot-isolation', term: 'Snapshot isolation', vi: 'cô lập theo ảnh chụp', ch: 8, topic: 'ch8-snapshot', def: 'Mỗi giao dịch đọc từ một ảnh chụp nhất quán của CSDL tại lúc nó bắt đầu. Người đọc không chặn người ghi và ngược lại.' },
    { key: 'mvcc', term: 'MVCC (multi-version concurrency control)', vi: 'điều khiển đồng thời đa phiên bản', ch: 8, topic: 'ch8-mvcc', def: 'Giữ nhiều phiên bản đã commit của mỗi đối tượng, gắn mã giao dịch đã tạo/xoá, để mỗi giao dịch thấy đúng snapshot của mình.' },
    { key: 'txid', term: 'Transaction ID (txid)', vi: 'mã giao dịch', ch: 8, topic: 'ch8-mvcc', def: 'Số tăng dần cấp cho mỗi giao dịch khi bắt đầu; dữ liệu ghi ra được gắn txid của người ghi (created_by, deleted_by).' },
    { key: 'repeatable-read', term: 'Repeatable read', vi: 'đọc lặp lại được', ch: 8, topic: 'ch8-mvcc', def: 'Tên mức cô lập trong chuẩn SQL. PostgreSQL và MySQL dùng tên này cho snapshot isolation; DB2 dùng nó cho serializable. Không ai thật sự biết nó nghĩa là gì.' },
    { key: 'lost-update', term: 'Lost update', vi: 'mất cập nhật', ch: 8, topic: 'ch8-lost-update', def: 'Hai giao dịch cùng đọc–sửa–ghi một giá trị; lần ghi sau không bao gồm thay đổi của lần trước nên thay đổi đó bị mất.' },
    { key: 'read-modify-write', term: 'Read-modify-write cycle', vi: 'chu trình đọc–sửa–ghi', ch: 8, topic: 'ch8-lost-update', def: 'Đọc giá trị, tính giá trị mới trong code ứng dụng, rồi ghi lại. Không an toàn khi chạy đồng thời nếu không có biện pháp bảo vệ.' },
    { key: 'atomic-write-op', term: 'Atomic write operation', vi: 'thao tác ghi nguyên tử', ch: 8, topic: 'ch8-lost-update', def: 'Lệnh để CSDL tự đọc và sửa, ví dụ UPDATE … SET value = value + 1. Thường là cách tốt nhất để tránh lost update.' },
    { key: 'select-for-update', term: 'SELECT … FOR UPDATE', vi: 'khoá tường minh', ch: 8, topic: 'ch8-lost-update', def: 'Yêu cầu CSDL khoá mọi hàng truy vấn trả về, để giao dịch khác muốn đọc-để-sửa các hàng đó phải chờ.' },
    { key: 'write-skew', term: 'Write skew', vi: 'ghi lệch', ch: 8, topic: 'ch8-write-skew', def: 'Hai giao dịch đọc cùng dữ liệu, quyết định dựa trên kết quả, rồi ghi vào các đối tượng khác nhau. Khi ghi xong, tiền đề của quyết định không còn đúng.' },
    { key: 'phantom', term: 'Phantom', vi: 'bóng ma', ch: 8, topic: 'ch8-phantoms', def: 'Một ghi ở giao dịch này làm thay đổi kết quả của truy vấn tìm kiếm ở giao dịch khác, thường là thêm một hàng mà truy vấn kia đã kiểm tra là “không có”.' },
    { key: 'materializing-conflicts', term: 'Materializing conflicts', vi: 'cụ thể hoá xung đột', ch: 8, topic: 'ch8-materialize', def: 'Tạo sẵn các hàng giả (ví dụ mỗi phòng × mỗi khung 15 phút) chỉ để làm vật khoá, biến phantom thành xung đột khoá trên hàng có thật. Phương án cuối cùng.' },
    { key: 'serializability', term: 'Serializability', vi: 'khả tuần tự', ch: 8, topic: 'ch8-serializability', def: 'Mức cô lập mạnh nhất: kết quả giống như các giao dịch chạy lần lượt từng cái một, dù thực tế chạy song song. Ngăn mọi race condition.' },
    { key: 'serial-execution', term: 'Actual serial execution', vi: 'thực thi tuần tự thật', ch: 8, topic: 'ch8-serializability', def: 'Chạy từng giao dịch một trên một luồng duy nhất (VoltDB, Redis, Datomic). Khả thi khi dữ liệu vừa RAM và giao dịch ngắn.' },
    { key: 'stored-procedure', term: 'Stored procedure', vi: 'thủ tục lưu trữ', ch: 8, topic: 'ch8-serializability', def: 'Code giao dịch được gửi trước cho CSDL và chạy trọn bên trong CSDL, không phải chờ ứng dụng qua mạng giữa các câu lệnh.' },
    { key: 'cross-partition-txn', term: 'Cross-partition transaction', vi: 'giao dịch đa partition', ch: 8, topic: 'ch8-serializability', def: 'Giao dịch đụng tới nhiều partition, phải chạy đồng bộ trên tất cả. VoltDB chỉ đạt khoảng 1.000 ghi loại này mỗi giây.' },
    { key: 'two-phase-locking', term: 'Two-phase locking (2PL)', vi: 'khoá hai pha', ch: 8, topic: 'ch8-2pl', def: 'Cài đặt serializable kinh điển: đọc cần shared lock, ghi cần exclusive lock, giữ mọi khoá đến cuối giao dịch. Người ghi chặn người đọc và ngược lại. Khác hẳn 2PC.' },
    { key: 'shared-lock', term: 'Shared lock', vi: 'khoá chia sẻ', ch: 8, topic: 'ch8-2pl', def: 'Khoá để đọc: nhiều giao dịch có thể cùng giữ, nhưng không ai được giữ exclusive lock cùng lúc.' },
    { key: 'exclusive-lock', term: 'Exclusive lock', vi: 'khoá độc quyền', ch: 8, topic: 'ch8-2pl', def: 'Khoá để ghi: chỉ một giao dịch giữ, không ai khác được giữ bất kỳ khoá nào trên đối tượng đó.' },
    { key: 'deadlock', term: 'Deadlock', vi: 'khoá chết', ch: 8, topic: 'ch8-2pl', def: 'Các giao dịch chờ khoá của nhau thành vòng tròn nên không ai tiến được. CSDL phát hiện và huỷ một giao dịch; ứng dụng cần thử lại.' },
    { key: 'predicate-lock', term: 'Predicate lock', vi: 'khoá vị từ', ch: 8, topic: 'ch8-predicate', def: 'Khoá trên mọi đối tượng khớp một điều kiện tìm kiếm, kể cả đối tượng chưa tồn tại. Ngăn phantom nhưng kiểm tra chậm.' },
    { key: 'index-range-lock', term: 'Index-range lock (next-key lock)', vi: 'khoá dải chỉ mục', ch: 8, topic: 'ch8-predicate', def: 'Xấp xỉ khoá vị từ bằng cách khoá một mục hoặc một dải trong chỉ mục. Khoá rộng hơn cần thiết nhưng rẻ hơn nhiều.' },
    { key: 'ssi', term: 'Serializable snapshot isolation (SSI)', vi: 'snapshot isolation khả tuần tự', ch: 8, topic: 'ch8-ssi', def: 'Thuật toán lạc quan (2008): chạy trên snapshot isolation, theo dõi đọc/ghi và huỷ giao dịch lúc commit nếu nó đã hành động dựa trên tiền đề đã cũ. Dùng trong PostgreSQL từ 9.1.' },
    { key: 'pessimistic-cc', term: 'Pessimistic concurrency control', vi: 'điều khiển đồng thời bi quan', ch: 8, topic: 'ch8-ssi', def: 'Nếu có gì có thể sai thì chờ cho tới khi an toàn (như 2PL, hay thực thi tuần tự).' },
    { key: 'optimistic-cc', term: 'Optimistic concurrency control', vi: 'điều khiển đồng thời lạc quan', ch: 8, topic: 'ch8-ssi', def: 'Cứ chạy tiếp, đến lúc commit mới kiểm tra có vi phạm cô lập không; nếu có thì huỷ và thử lại. Tốt khi tranh chấp thấp, tệ khi tranh chấp cao.' },
    { key: 'outdated-premise', term: 'Outdated premise', vi: 'tiền đề đã cũ', ch: 8, topic: 'ch8-ssi', def: 'Sự thật giao dịch đọc được lúc đầu (ví dụ “đang có 2 bác sĩ trực”) đã không còn đúng khi nó commit. SSI phát hiện và huỷ các giao dịch như vậy.' },
  ]);
})();
