
  // ================= 3.7 many-to-many =================
  widget('many-to-many', (root) => {
    const people = [[251, 'Barack Obama'], [252, 'Joe Biden'], [253, 'Hillary Clinton']];
    const orgs = [[513, 'United States of America'], [514, 'United States Senate'], [515, 'U.S. Department of State']];
    const positions = [
      [251, 513, 'President', 2009, 2017], [251, 514, 'US Senator (D-IL)', 2005, 2008],
      [252, 514, 'US Senator (D-DE)', 1973, 2009], [252, 513, 'Vice President', 2009, 2017], [252, 513, 'President', 2021, 2025],
      [253, 514, 'US Senator (D-NY)', 2001, 2009], [253, 515, 'Secretary of State', 2009, 2013],
    ];
    let sel = { kind: 'person', id: 251 }, orgIdx = true;
    const W = 640, H = 190;
    const py = (i) => 40 + i * 55, ox = 470, px = 170;
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Người và tổ chức' });
    svg.appendChild(s('text', { x: px, y: 16, 'text-anchor': 'middle', class: 'lbl-strong' }, 'users'));
    svg.appendChild(s('text', { x: ox, y: 16, 'text-anchor': 'middle', class: 'lbl-strong' }, 'organizations'));
    const lines = positions.map((p, k) => {
      const a = people.findIndex((x) => x[0] === p[0]), b = orgs.findIndex((x) => x[0] === p[1]);
      const off = (k % 3 - 1) * 3;
      const ln = s('line', { x1: px + 80, y1: py(a) + off, x2: ox - 95, y2: py(b) + off, class: 's-line f-none', 'stroke-width': 1.5 });
      svg.appendChild(ln);
      return ln;
    });
    const mkNode = (x, y, w, label, cls, onClick) => {
      const r = s('rect', { x: x - w / 2, y: y - 13, width: w, height: 26, rx: 6, class: cls, 'stroke-width': 1.3 });
      const g = s('g', { class: 'node clickable', tabindex: 0, role: 'button', 'aria-label': label }, r, s('text', { x, y: y + 4, 'text-anchor': 'middle', class: 'lbl-strong' }, label));
      g.addEventListener('click', onClick);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } });
      svg.appendChild(g);
      return r;
    };
    const pR = people.map((p, i) => mkNode(px, py(i), 160, p[1], 'f-violet-soft s-violet', () => { sel = { kind: 'person', id: p[0] }; render(); }));
    const oR = orgs.map((o, i) => mkNode(ox, py(i), 190, o[1], 'f-accent-soft s-accent', () => { sel = { kind: 'org', id: o[0] }; render(); }));
    const cb = checkbox('Có index trên positions(org_id)', true, (v) => { orgIdx = v; render(); });
    const q = h('div'), stats = h('div', { class: 'stats' }), tb = h('div');
    root.append(h('div', { class: 'viz' }, svg), h('div', { class: 'controls' }, cb.el), q, stats, tb);
    function render() {
      const match = (p) => (sel.kind === 'person' ? p[0] === sel.id : p[1] === sel.id);
      lines.forEach((ln, k) => { const m = match(positions[k]); ln.setAttribute('class', (m ? 's-mark' : 's-line') + ' f-none'); ln.setAttribute('stroke-width', m ? 3 : 1.5); });
      pR.forEach((r, i) => r.setAttribute('class', sel.kind === 'person' && people[i][0] === sel.id ? 'f-mark-soft s-ink' : 'f-violet-soft s-violet'));
      oR.forEach((r, i) => r.setAttribute('class', sel.kind === 'org' && orgs[i][0] === sel.id ? 'f-mark-soft s-ink' : 'f-accent-soft s-accent'));
      const n = positions.filter(match).length;
      clear(q);
      if (sel.kind === 'person') {
        const name = people.find((p) => p[0] === sel.id)[1];
        q.append(note(`Chiều xuôi: ${name} từng làm ở đâu?`), code(`SELECT o.name, p.job_title FROM positions p\n  JOIN organizations o ON o.id = p.org_id\nWHERE p.user_id = ${sel.id};   -- dùng index positions(user_id)`));
        clear(stats).append(stat('Index dùng', 'positions(user_id)', 'ok'), stat('Hàng positions phải đọc', String(n), 'ok', `trên tổng ${positions.length}`), stat('Kết quả', n + ' vị trí', 'accent'));
      } else {
        const name = orgs.find((o) => o[0] === sel.id)[1];
        q.append(note(`Chiều ngược: ai từng làm ở ${name}?`), code(`SELECT u.name, p.job_title FROM positions p\n  JOIN users u ON u.id = p.user_id\nWHERE p.org_id = ${sel.id};   -- ${orgIdx ? 'dùng index positions(org_id)' : 'không có index: Seq Scan'}`));
        clear(stats).append(stat('Index dùng', orgIdx ? 'positions(org_id)' : 'không có', orgIdx ? 'ok' : 'bad'),
          stat('Hàng positions phải đọc', String(orgIdx ? n : positions.length), orgIdx ? 'ok' : 'bad', orgIdx ? `trên tổng ${positions.length}` : 'quét toàn bảng; với hàng triệu hàng sẽ rất chậm'),
          stat('Kết quả', n + ' vị trí', 'accent'));
      }
      clear(tb).append(box('Bảng nối positions (Hình 3-3)', tbl(['user_id', 'org_id', 'job_title', 'start', 'end'], positions, { hit: match })));
    }
    render();
  });

  // ================= 3.8 star schema =================
  widget('star-schema', (root) => {
    const T = {
      fact_sales: { cols: ['date_key', 'product_sk', 'store_sk', 'promotion_sk', 'customer_sk', 'quantity', 'net_price', 'discount_price'], rows: [[140102, 31, 3, null, null, 1, 2.49, 2.49], [140102, 69, 5, 19, null, 3, 14.99, 9.99], [140102, 74, 3, 23, 191, 1, 4.49, 3.89]] },
      dim_product: { cols: ['product_sk', 'sku', 'description', 'brand', 'category'], rows: [[30, 'OK4012', 'Bananas', 'Freshmax', 'Fresh fruit'], [31, 'KA9511', 'Fish food', 'Aquatech', 'Pet supplies'], [69, 'XB2218', 'Croissant', 'Dealicious', 'Bakery']] },
      dim_store: { cols: ['store_sk', 'state', 'city'], rows: [[1, 'WA', 'Seattle'], [3, 'CA', 'San Francisco'], [5, 'CA', 'Palo Alto']] },
      dim_date: { cols: ['date_key', 'year', 'month', 'day', 'weekday', 'is_holiday'], rows: [[140101, 2014, 'jan', 1, 'wed', 'yes'], [140102, 2014, 'jan', 2, 'thu', 'no'], [140103, 2014, 'jan', 3, 'fri', 'no']] },
      dim_customer: { cols: ['customer_sk', 'name', 'date_of_birth'], rows: [[190, 'Alice', '1979-03-29'], [191, 'Bob', '1961-09-02'], [192, 'Cecil', '1991-12-13']] },
      dim_promotion: { cols: ['promotion_sk', 'name', 'ad_type', 'coupon_type'], rows: [[18, 'New Year sale', 'poster', null], [19, 'Aquarium deal', 'direct mail', 'leaflet'], [23, 'Coffee & cake bundle', 'in-store sign', null]] },
      dim_category: { cols: ['category_sk', 'name', 'department'], rows: [[1, 'Fresh fruit', 'Produce'], [2, 'Pet supplies', 'Household'], [3, 'Bakery', 'Fresh food']] },
      dim_brand: { cols: ['brand_sk', 'name', 'manufacturer'], rows: [[7, 'Freshmax', 'Freshmax Ltd'], [8, 'Aquatech', 'Aquatech Inc'], [9, 'Dealicious', 'Dealicious Co']] },
      dim_region: { cols: ['region_sk', 'state', 'country'], rows: [[1, 'WA', 'US'], [2, 'CA', 'US']] },
      obt_sales: { cols: ['date_key', 'date_year', 'date_month', 'date_is_holiday', 'product_sku', 'product_description', 'product_brand', 'product_category', 'store_state', 'store_city', 'customer_name', 'promotion_name', 'quantity', 'net_price', '… (hàng trăm cột)'], rows: [[140102, 2014, 'jan', 'no', 'KA9511', 'Fish food', 'Aquatech', 'Pet supplies', 'CA', 'San Francisco', null, null, 1, 2.49, '…'], [140102, 2014, 'jan', 'no', 'XB2218', 'Croissant', 'Dealicious', 'Bakery', 'CA', 'Palo Alto', null, 'Aquarium deal', 3, 14.99, '…']] },
    };
    if (T.dim_product.cols) T.dim_product_sf = { cols: ['product_sk', 'sku', 'description', 'brand_sk', 'category_sk'], rows: [[30, 'OK4012', 'Bananas', 7, 1], [31, 'KA9511', 'Fish food', 8, 2], [69, 'XB2218', 'Croissant', 9, 3]] };
    T.dim_store_sf = { cols: ['store_sk', 'region_sk', 'city'], rows: [[1, 1, 'Seattle'], [3, 2, 'San Francisco'], [5, 2, 'Palo Alto']] };
    const LAYOUT = {
      star: { fact_sales: [380, 150], dim_date: [130, 50], dim_product: [630, 50], dim_store: [130, 250], dim_customer: [630, 250], dim_promotion: [380, 290] },
      snowflake: { fact_sales: [380, 150], dim_date: [130, 50], dim_product: [600, 60], dim_category: [690, 140], dim_brand: [690, 10], dim_store: [130, 250], dim_region: [130, 310], dim_customer: [630, 250], dim_promotion: [380, 290] },
      obt: { obt_sales: [380, 160] },
    };
    const LINKS = { star: [['fact_sales', 'dim_date'], ['fact_sales', 'dim_product'], ['fact_sales', 'dim_store'], ['fact_sales', 'dim_customer'], ['fact_sales', 'dim_promotion']],
      snowflake: [['fact_sales', 'dim_date'], ['fact_sales', 'dim_product'], ['dim_product', 'dim_category'], ['dim_product', 'dim_brand'], ['fact_sales', 'dim_store'], ['dim_store', 'dim_region'], ['fact_sales', 'dim_customer'], ['fact_sales', 'dim_promotion']], obt: [] };
    const Q = {
      holiday: {
        label: 'Doanh thu theo danh mục vào ngày lễ',
        star: { tables: ['fact_sales', 'dim_product', 'dim_date'], sql: `SELECT p.category, SUM(f.net_price * f.quantity) AS revenue\nFROM fact_sales f\nJOIN dim_product p ON f.product_sk = p.product_sk\nJOIN dim_date d    ON f.date_key   = d.date_key\nWHERE d.is_holiday = 'yes'\nGROUP BY p.category;` },
        snowflake: { tables: ['fact_sales', 'dim_product', 'dim_category', 'dim_date'], sql: `SELECT c.name, SUM(f.net_price * f.quantity) AS revenue\nFROM fact_sales f\nJOIN dim_product p  ON f.product_sk  = p.product_sk\nJOIN dim_category c ON p.category_sk = c.category_sk\nJOIN dim_date d     ON f.date_key    = d.date_key\nWHERE d.is_holiday = 'yes'\nGROUP BY c.name;` },
        obt: { tables: ['obt_sales'], sql: `SELECT product_category, SUM(net_price * quantity) AS revenue\nFROM obt_sales\nWHERE date_is_holiday = 'yes'\nGROUP BY product_category;` },
      },
      state: {
        label: 'Số lượng bán theo bang và tháng',
        star: { tables: ['fact_sales', 'dim_store', 'dim_date'], sql: `SELECT s.state, d.month, SUM(f.quantity)\nFROM fact_sales f\nJOIN dim_store s ON f.store_sk = s.store_sk\nJOIN dim_date d  ON f.date_key = d.date_key\nGROUP BY s.state, d.month;` },
        snowflake: { tables: ['fact_sales', 'dim_store', 'dim_region', 'dim_date'], sql: `SELECT r.state, d.month, SUM(f.quantity)\nFROM fact_sales f\nJOIN dim_store s  ON f.store_sk  = s.store_sk\nJOIN dim_region r ON s.region_sk = r.region_sk\nJOIN dim_date d   ON f.date_key  = d.date_key\nGROUP BY r.state, d.month;` },
        obt: { tables: ['obt_sales'], sql: `SELECT store_state, date_month, SUM(quantity)\nFROM obt_sales\nGROUP BY store_state, date_month;` },
      },
    };
    let layout = 'star', qk = 'holiday', open = 'fact_sales';
    const ls = seg({ options: [{ value: 'star', label: 'Star' }, { value: 'snowflake', label: 'Snowflake' }, { value: 'obt', label: 'One big table' }], value: layout, onChange: (v) => { layout = v; open = v === 'obt' ? 'obt_sales' : 'fact_sales'; render(); } });
    const qs = select('Câu hỏi phân tích', Object.entries(Q).map(([k, v]) => [k, v.label]), qk, (v) => { qk = v; render(); });
    const viz = h('div', { class: 'viz' }), sqlBox = h('div'), stats = h('div', { class: 'stats' }), sample = h('div');
    root.append(h('div', { class: 'controls' }, h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Kiểu schema'), ls.el), qs.el), viz, h('div', { class: 'lab-split' }, sqlBox, h('div', null, stats)), sample);
    const realName = (t) => (layout === 'snowflake' && t === 'dim_product' ? 'dim_product_sf' : layout === 'snowflake' && t === 'dim_store' ? 'dim_store_sf' : t);
    function render() {
      const L = LAYOUT[layout], used = new Set(Q[qk][layout].tables);
      const svg = s('svg', { viewBox: '0 0 760 330', role: 'img', 'aria-label': 'Sơ đồ schema kho dữ liệu' });
      LINKS[layout].forEach(([a, b]) => {
        const on = used.has(a) && used.has(b);
        svg.appendChild(s('line', { x1: L[a][0], y1: L[a][1], x2: L[b][0], y2: L[b][1], class: (on ? 's-mark' : 's-line') + ' f-none', 'stroke-width': on ? 3 : 1.5 }));
      });
      Object.entries(L).forEach(([t, [x, y]]) => {
        const isFact = t === 'fact_sales' || t === 'obt_sales';
        const w = t === 'obt_sales' ? 360 : isFact ? 150 : 130, hh = t === 'obt_sales' ? 170 : isFact ? 70 : 34;
        const cls = used.has(t) ? 'f-mark-soft s-mark' : isFact ? 'f-accent-soft s-accent' : 'f-surface s-line';
        const g = s('g', { class: 'node clickable', tabindex: 0, role: 'button', 'aria-label': t },
          s('rect', { x: x - w / 2, y: y - hh / 2, width: w, height: hh, rx: 6, class: cls, 'stroke-width': open === t ? 2.6 : 1.4 }),
          s('text', { x, y: y - hh / 2 + 17, 'text-anchor': 'middle', class: 'lbl-strong' }, t));
        if (isFact) {
          const cols = T[t].cols.slice(0, t === 'obt_sales' ? 15 : 3);
          cols.forEach((c, i) => {
            const cx = t === 'obt_sales' ? x - 165 + (i % 2) * 175 : x;
            const cy = y - hh / 2 + 34 + (t === 'obt_sales' ? Math.floor(i / 2) * 16 : i * 12);
            g.appendChild(s('text', { x: cx, y: cy, 'text-anchor': t === 'obt_sales' ? 'start' : 'middle' }, c));
          });
          if (t === 'fact_sales') g.appendChild(s('text', { x, y: y + hh / 2 - 6, 'text-anchor': 'middle' }, `+ ${T[t].cols.length - 3} cột`));
        }
        g.addEventListener('click', () => { open = t; render(); });
        g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open = t; render(); } });
        svg.appendChild(g);
      });
      clear(viz).append(svg);
      const q = Q[qk][layout];
      const joins = q.tables.length - 1;
      clear(sqlBox).append(code(q.sql));
      clear(stats).append(
        stat('Số JOIN', String(joins), joins === 0 ? 'ok' : joins > 2 ? 'warn' : 'accent'),
        stat('Bảng dùng', q.tables.length + ' bảng', '', q.tables.join(', ')),
        stat('Độ chuẩn hoá', layout === 'snowflake' ? 'cao' : layout === 'star' ? 'vừa' : 'thấp', '', layout === 'obt' ? 'tốn chỗ nhất, join đã tính sẵn' : layout === 'snowflake' ? 'thêm dimension con' : 'dễ dùng cho analyst'));
      const tn = realName(open);
      const tt = T[tn] || T[open];
      if (!LAYOUT[layout][open]) open = layout === 'obt' ? 'obt_sales' : 'fact_sales';
      clear(sample).append(box(`Hàng mẫu: ${tn}`, tbl(tt.cols, tt.rows)));
    }
    render();
  });

  // ================= 3.9 schema evolution =================
  widget('schema-evolution', (root) => {
    const NAMES = ['Lan Phạm', 'Minh Trần', 'Ngọc Lê', 'Quang Võ', 'Thảo Đỗ', 'Tuấn Hồ'];
    let mode = 'write', rows, docs, running = false, migrated = false, cheap = false;
    function reset() {
      rows = NAMES.map((n, i) => ({ id: i + 1, name: n, first_name: undefined }));
      docs = NAMES.slice(0, 4).map((n, i) => ({ _id: i + 1, name: n }));
      migrated = false;
    }
    reset();
    const md = seg({ options: [{ value: 'write', label: 'Schema-on-write (SQL)' }, { value: 'read', label: 'Schema-on-read (document)' }], value: mode, onChange: (v) => { mode = v; render(); } });
    const size = slider({ label: 'Số hàng thật trong bảng users', min: 3, max: 8, step: 0.5, value: 7, format: (v) => fmt(Math.round(10 ** v)) + ' hàng', onInput: () => render() });
    const body = h('div');
    root.append(h('div', { class: 'btn-row' }, md.el, button('Đặt lại', () => { reset(); render(); }, 'ghost')), body);
    function render() {
      clear(body);
      if (mode === 'write') renderWrite(); else renderRead();
    }
    function renderWrite() {
      const N = Math.round(10 ** size.value);
      const rate = 50000; // rows/s (illustrative)
      const secs = cheap ? 0.05 : N / rate;
      const cbCheap = checkbox('Chỉ ADD COLUMN DEFAULT NULL, điền first_name lúc đọc', cheap, (v) => { cheap = v; render(); });
      const prog = h('div', { class: 'c3-bar' + (cheap ? '' : ' warn') }, h('i'));
      const runBtn = button('Chạy migration', async () => {
        if (running) return; running = true; runBtn.disabled = true;
        for (let i = 0; i < rows.length; i++) {
          if (!cheap) rows[i].first_name = rows[i].name.split(' ')[0];
          else rows[i].first_name = null;
          prog.firstChild.style.width = ((i + 1) / rows.length) * 100 + '%';
          drawTable();
          await sleep(cheap ? 40 : 260);
        }
        migrated = true; running = false; runBtn.disabled = false; render();
      });
      const tableHost = h('div');
      function drawTable() {
        const cols = ['id', 'name'].concat(rows.some((r) => r.first_name !== undefined) ? ['first_name'] : []);
        clear(tableHost).append(tbl(cols, rows.map((r) => (cols.length === 3 ? [r.id, r.name, r.first_name === undefined ? '' : r.first_name] : [r.id, r.name])), {
          cell: (row, i, j) => (j === 2 ? (rows[i].first_name ? 'c3-fresh' : rows[i].first_name === null ? 'c3-dim' : '') : ''),
        }));
      }
      body.append(h('div', { class: 'controls' }, size.el, cbCheap.el),
        code(cheap ? `ALTER TABLE users ADD COLUMN first_name text DEFAULT NULL;   -- nhanh: chỉ đổi metadata\n-- first_name được tính lúc đọc khi còn NULL`
          : `ALTER TABLE users ADD COLUMN first_name text DEFAULT NULL;\nUPDATE users SET first_name = split_part(name, ' ', 1);   -- viết lại MỌI hàng`),
        h('div', { class: 'btn-row' }, runBtn), prog, tableHost,
        h('div', { class: 'stats' },
          stat('Hàng phải viết lại', cheap ? '0' : fmt(N), cheap ? 'ok' : 'warn'),
          stat('Thời gian ước tính', secs < 1 ? fmtMs(secs * 1000) : secs < 3600 ? fmt(secs / 60, 1) + ' phút' : fmt(secs / 3600, 1) + ' giờ', cheap ? 'ok' : secs > 600 ? 'bad' : 'warn', 'số liệu minh hoạ, ~50.000 hàng/s'),
          stat('Rủi ro', cheap ? 'thấp' : N > 1e6 ? 'khoá bảng lâu' : 'vừa phải', cheap ? 'ok' : N > 1e6 ? 'bad' : 'warn', cheap ? 'code đọc phải xử lý NULL' : 'ghi bị chặn trong lúc chạy, có thể downtime')));
      drawTable();
      if (migrated) body.append(note(cheap ? 'Xong ngay. Nhưng giờ code đọc phải tự tách first_name khi giá trị còn NULL, giống cách làm với document.' : 'Xong. Mọi hàng giờ có cùng cấu trúc và database đảm bảo điều đó.'));
    }
    function renderRead() {
      const readCode = `function readUser(user) {\n  if (user && user.name && !user.first_name) {\n    // Documents written before Dec 8, 2023 don't have first_name\n    user.first_name = user.name.split(" ")[0];\n  }\n  return user;\n}`;
      let k = docs.length;
      const add = button('Ghi user mới (định dạng mới)', () => {
        const pool = [['Hoa', 'Bùi'], ['Khánh', 'Đặng'], ['Long', 'Mai'], ['Vy', 'Trịnh']];
        const [f, l] = pool[(docs.length - 4) % pool.length];
        docs.push({ _id: ++k + 0, first_name: f, last_name: l });
        render();
      });
      const view = docs.map((d) => {
        const old = !d.first_name;
        const r = old ? { ...d, first_name: d.name.split(' ')[0] } : d;
        return [d._id, JSON.stringify(d), r.first_name, old ? pill('code đọc tự tách', 'warn') : pill('đã có sẵn', 'ok')];
      });
      body.append(h('div', { class: 'btn-row' }, add),
        h('div', { class: 'lab-split' },
          box('Code đọc (chạy với mỗi document)', code(readCode, { mark: [1, 2, 3] })),
          box('Collection users: định dạng cũ và mới lẫn lộn', tbl(['_id', 'document lưu trên đĩa', 'first_name đọc ra', 'nguồn'], view, { cell: (r, i, j) => (j === 1 ? 'c3-wrap' : '') }))),
        h('div', { class: 'stats' },
          stat('Document định dạng cũ', String(docs.filter((d) => !d.first_name).length), 'warn', 'vẫn nằm đó mãi mãi'),
          stat('Lượt ghi khi đổi schema', '0', 'ok', 'không có migration'),
          stat('Nơi phải biết schema cũ', 'mọi chỗ đọc', 'bad', 'mọi service đọc collection này')));
    }
    render();
  });

  // ================= 3.9 which model =================
  widget('which-model', (root) => {
    const QS = [
      { k: 'tree', q: 'Dữ liệu có dạng cây (một-nhiều) và thường được tải cả cây một lúc?', w: { doc: 3 } },
      { k: 'm2m', q: 'Có nhiều quan hệ nhiều-một hoặc nhiều-nhiều giữa các bản ghi?', w: { rel: 3, graph: 1, doc: -2 } },
      { k: 'deep', q: 'Truy vấn phải đi qua số bước không biết trước (đường đi, phân cấp lồng sâu, bạn của bạn)?', w: { graph: 4, rel: -1 } },
      { k: 'hetero', q: 'Bản ghi không đồng nhất, hoặc cấu trúc do hệ thống bên ngoài quyết định?', w: { doc: 2, graph: 1, rel: -1 } },
      { k: 'nested', q: 'Cần tham chiếu trực tiếp tới phần tử lồng bên trong (một vị trí công việc cụ thể)?', w: { rel: 2, doc: -1 } },
      { k: 'history', q: 'Cần lịch sử đầy đủ mọi thay đổi, ý định rõ ràng và nhiều cách đọc khác nhau?', w: { es: 4 } },
      { k: 'matrix', q: 'Mục đích chính là phân tích thống kê / ML trên ma trận số?', w: { df: 4 } },
    ];
    const MODELS = {
      rel: ['Quan hệ (SQL)', 'Hỗ trợ join, nhiều-một, nhiều-nhiều tốt nhất; schema tường minh; phổ biến nhất trong OLTP và kho dữ liệu.'],
      doc: ['Document (JSON)', 'Cây một-nhiều nằm gọn trong một document, locality tốt, schema linh hoạt cho dữ liệu không đồng nhất.'],
      graph: ['Graph', 'Mọi thứ có thể nối với mọi thứ; truy vấn đệ quy (Cypher WITHIN*0.., SPARQL, Datalog) diễn đạt ngắn gọn.'],
      es: ['Event sourcing + CQRS', 'Log sự kiện bất biến làm nguồn sự thật, dựng nhiều view tối ưu cho đọc, có sẵn audit log.'],
      df: ['Dataframe / mảng', 'Biến dữ liệu thành ma trận số cho đại số tuyến tính, machine learning, thống kê.'],
    };
    const PRESETS = {
      'Hồ sơ LinkedIn': { tree: 'y', m2m: 'n', deep: 'n', hetero: 'n', nested: 'n', history: 'n', matrix: 'n' },
      'Mạng xã hội': { tree: 'n', m2m: 'y', deep: 'y', hetero: 'y', nested: 'n', history: 'n', matrix: 'n' },
      'Đặt chỗ hội nghị': { tree: 'n', m2m: 'y', deep: 'n', hetero: 'n', nested: 'y', history: 'y', matrix: 'n' },
      'Gợi ý phim': { tree: 'n', m2m: 'y', deep: 'n', hetero: 'n', nested: 'n', history: 'n', matrix: 'y' },
    };
    const ans = { ...PRESETS['Hồ sơ LinkedIn'] };
    const segs = {};
    const qa = h('div', { class: 'c3-qa' });
    QS.forEach((q) => {
      segs[q.k] = seg({ options: [{ value: 'y', label: 'Có' }, { value: 'n', label: 'Không' }], value: ans[q.k], onChange: (v) => { ans[q.k] = v; render(); } });
      qa.append(h('span', q.q), segs[q.k].el);
    });
    const out = h('div');
    root.append(h('div', { class: 'btn-row' }, h('span', { class: 'lab-note' }, 'Tình huống mẫu:'),
      Object.keys(PRESETS).map((p) => button(p, () => { Object.assign(ans, PRESETS[p]); QS.forEach((q) => segs[q.k].set(ans[q.k])); render(); }, 'ghost'))), qa, out);
    function render() {
      const score = { rel: 1, doc: 0, graph: 0, es: 0, df: 0 };
      QS.forEach((q) => { if (ans[q.k] === 'y') Object.entries(q.w).forEach(([m, w]) => (score[m] += w)); });
      const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
      const max = Math.max(1, ranked[0][1]);
      const rank = h('div', { class: 'c3-rank' });
      ranked.forEach(([m, v], i) => rank.append(h('b', MODELS[m][0]), h('div', { class: 'c3-bar' + (i === 0 ? '' : ' warn') }, h('i', { style: { width: Math.max(0, (v / max) * 100) + '%' } })), h('span', { class: 'mono' }, String(v))));
      const [top] = ranked[0];
      clear(out).append(rank, box('Gợi ý: ' + MODELS[top][0], h('p', { style: { margin: 0 } }, MODELS[top][1]),
        ranked[1][1] > 0 && ranked[1][1] >= ranked[0][1] - 1 ? note(`Điểm của “${MODELS[ranked[1][0]][0]}” cũng gần bằng. Database hiện đại thường kết hợp được cả hai (hybrid quan hệ–document, truy vấn graph trong SQL).`) : null),
      note('Đây là công cụ gợi nhớ các lập luận trong chương, không phải công thức. Sách nhấn mạnh: không có mô hình tốt nhất, chỉ có mô hình hợp với kiểu quan hệ và kiểu truy vấn của bạn.'));
    }
    render();
  });

  // ================= 3.10 aggregation =================
  widget('aggregation', (root) => {
    const OBS = [
      [1, '2024-01-03', 'Sharks', 'Great white shark', 3], [2, '2024-01-15', 'Dolphins', 'Bottlenose dolphin', 12], [3, '2024-01-20', 'Sharks', 'Hammerhead shark', 2],
      [4, '2024-02-02', 'Sharks', 'Whale shark', 1], [5, '2024-02-11', 'Whales', 'Humpback whale', 2], [6, '2024-02-19', 'Sharks', 'Great white shark', 6],
      [7, '2024-03-05', 'Dolphins', 'Spinner dolphin', 30], [8, '2024-03-09', 'Sharks', 'Tiger shark', 2], [9, '2024-03-28', 'Sharks', 'Hammerhead shark', 8],
    ];
    const SQL = `SELECT date_trunc('month', observation_timestamp) AS observation_month,\n       sum(num_animals) AS total_animals\nFROM observations\nWHERE family = 'Sharks'\nGROUP BY observation_month;`;
    const MQL = `db.observations.aggregate([\n  { $match: { family: "Sharks" } },\n  { $group: {\n      _id: {\n        year:  { $year:  "$observationTimestamp" },\n        month: { $month: "$observationTimestamp" }\n      },\n      totalAnimals: { $sum: "$numAnimals" }\n  } }\n]);`;
    const STAGES = {
      sql: [
        { t: 'FROM observations', mark: [2], d: 'Bắt đầu từ toàn bộ bảng.' },
        { t: "WHERE family = 'Sharks'", mark: [3], d: 'Lọc chỉ giữ các hàng họ cá mập.' },
        { t: 'GROUP BY observation_month', mark: [0, 4], d: 'date_trunc làm tròn timestamp về đầu tháng, các hàng cùng tháng vào một nhóm.' },
        { t: 'SELECT … sum(num_animals)', mark: [0, 1], d: 'Mỗi nhóm thành một hàng kết quả với tổng số con.' },
      ],
      mongo: [
        { t: 'collection observations', mark: [0], d: 'Mỗi quan sát là một document.' },
        { t: '$match', mark: [1], d: 'Stage 1: chỉ cho document có family = "Sharks" đi tiếp.' },
        { t: '$group', mark: [2, 3, 4, 5, 6, 7, 8], d: 'Stage 2: nhóm theo {year, month} của timestamp và cộng numAnimals.' },
      ],
    };
    let lang = 'sql', step = 0;
    const ls = seg({ options: [{ value: 'sql', label: 'SQL (PostgreSQL)' }, { value: 'mongo', label: 'MongoDB pipeline' }], value: lang, onChange: (v) => { lang = v; step = 0; render(); } });
    const codeHost = h('div'), dataHost = h('div'), desc = h('div');
    const next = button('Bước tiếp →', () => { step = Math.min(STAGES[lang].length - 1, step + 1); render(); });
    const all = button('Chạy hết', () => { step = STAGES[lang].length - 1; render(); }, 'ghost');
    const rst = button('Về đầu', () => { step = 0; render(); }, 'ghost');
    root.append(h('div', { class: 'btn-row' }, ls.el, next, all, rst), h('div', { class: 'lab-split' }, codeHost, h('div', null, desc, dataHost)));
    const month = (d) => d.slice(0, 7);
    function render() {
      const st = STAGES[lang][step];
      clear(codeHost).append(code(lang === 'sql' ? SQL : MQL, { mark: st.mark }));
      next.disabled = step === STAGES[lang].length - 1;
      clear(desc).append(h('div', { class: 'c3-flex' }, pill(`Bước ${step + 1}/${STAGES[lang].length}`, 'accent'), h('b', { class: 'mono' }, st.t)), note(st.d));
      clear(dataHost);
      const sharks = OBS.filter((o) => o[2] === 'Sharks');
      const groups = {};
      sharks.forEach((o) => { (groups[month(o[1])] = groups[month(o[1])] || []).push(o); });
      const final = lang === 'sql' ? step === 3 : step === 2;
      if (final) {
        if (lang === 'sql') dataHost.append(tbl(['observation_month', 'total_animals'], Object.entries(groups).map(([m, g]) => [m + '-01 00:00:00', g.reduce((a, o) => a + o[4], 0)]), { hit: () => true }));
        else dataHost.append(h('pre', { class: 'json', html: Object.entries(groups).map(([m, g]) => jsonHTML({ _id: { year: +m.slice(0, 4), month: +m.slice(5) }, totalAnimals: g.reduce((a, o) => a + o[4], 0) }).replace(/\n\s*/g, ' ')).join('\n') }));
        dataHost.append(note('Tháng 1: 5 con, tháng 2: 7 con, tháng 3: 10 con. Hai ngôn ngữ, cùng một kết quả (dữ liệu minh hoạ).'));
      } else if (step === 0) {
        dataHost.append(lang === 'sql' ? tbl(['id', 'observation_timestamp', 'family', 'species', 'num_animals'], OBS, { hit: (r) => r[2] === 'Sharks' })
          : h('pre', { class: 'json', html: OBS.slice(0, 4).map((o) => jsonHTML({ _id: o[0], observationTimestamp: o[1], family: o[2], species: o[3], numAnimals: o[4] }).replace(/\n\s*/g, ' ')).join('\n') + '\n<span class="dim">… ' + (OBS.length - 4) + ' document nữa</span>' }));
      } else if ((lang === 'sql' && step === 1) || (lang === 'mongo' && step === 1)) {
        dataHost.append(tbl(['id', 'timestamp', 'family', 'num_animals'], sharks.map((o) => [o[0], o[1], o[2], o[4]])), note(`${sharks.length}/${OBS.length} hàng còn lại.`));
      } else {
        dataHost.append(tbl(['nhóm (tháng)', 'các hàng', 'num_animals'], Object.entries(groups).map(([m, g]) => [m, g.map((o) => '#' + o[0]).join(', '), g.map((o) => o[4]).join(' + ')])));
      }
    }
    render();
  });
