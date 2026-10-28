/* Chương 1 — Trade-offs in Data Systems Architecture: widgets + glossary */
(function () {
  const { h, s, clear, fmt, fmtBig, pct, rng, clamp, sleep, slider, seg, button, checkbox, stat, log, jsonHTML, widget, glossary } = window.DDIA;

  const vnd = (n) => fmt(n) + ' đ';
  const usd = (n) => '$' + fmt(n);
  const svgRoot = (w, hgt, label) => s('svg', { viewBox: `0 0 ${w} ${hgt}`, role: 'img', 'aria-label': label || '' });

  // ---------------------------------------------------------------- 1.1 building blocks
  widget('building-blocks', (root) => {
    const BLOCKS = [
      ['app', 'Mã ứng dụng', 'backend, stateless'],
      ['db', 'Database', 'lưu để tìm lại sau'],
      ['cache', 'Cache', 'nhớ kết quả tốn kém'],
      ['search', 'Search index', 'tìm theo từ khoá, lọc'],
      ['stream', 'Stream processing', 'xử lý sự kiện ngay'],
      ['batch', 'Batch processing', 'xử lý dữ liệu tích luỹ'],
    ];
    const ACTIONS = [
      { v: 'view', label: 'Xem trang sản phẩm', flow: 'Trình duyệt → app → cache (trúng) → trả trang. Nếu trượt cache: app → database → ghi vào cache.', why: {
        app: 'Nhận request HTTP, ghép dữ liệu thành trang, rồi quên request.', cache: 'Trang sản phẩm được xem rất nhiều lần. Lưu sẵn để khỏi hỏi database mỗi lần.', db: 'Chỉ bị hỏi khi cache chưa có hoặc đã hết hạn.' } },
      { v: 'search', label: 'Tìm “giày chạy bộ”', flow: 'App → search index → danh sách id sản phẩm → app lấy chi tiết (thường từ cache).', why: {
        app: 'Chuyển câu tìm kiếm thành truy vấn tới index.', search: 'Database thường không tìm theo từ khoá hay lọc nhiều tiêu chí hiệu quả bằng index chuyên dụng.', cache: 'Lấy nhanh thông tin của các sản phẩm trong kết quả.' } },
      { v: 'order', label: 'Đặt hàng', flow: 'App ghi đơn + trừ kho trong database → phát sự kiện “OrderPlaced” → stream processor gửi email, kiểm tra gian lận, cập nhật cache tồn kho.', why: {
        app: 'Kiểm tra giỏ hàng, gọi thanh toán.', db: 'Đơn hàng phải được lưu bền vững. Đây là nguồn sự thật.', stream: 'Các việc phụ (email, chống gian lận) chạy ngay khi sự kiện xảy ra, không bắt người dùng chờ.', cache: 'Số lượng tồn kho trong cache đã cũ, phải cập nhật hoặc xoá.' } },
      { v: 'price', label: 'Đổi giá sản phẩm', flow: 'Nhân viên sửa giá → database → sự kiện thay đổi → cập nhật search index và xoá cache.', why: {
        app: 'Màn hình quản trị gửi lệnh sửa.', db: 'Giá mới được ghi vào nguồn trước tiên.', stream: 'Lan truyền thay đổi sang các hệ dẫn xuất.', search: 'Index phải biết giá mới, nếu không bộ lọc “dưới 1 triệu” sẽ sai.', cache: 'Bản sao cũ trong cache phải bị xoá.' } },
      { v: 'report', label: 'Báo cáo doanh thu cuối ngày', flow: 'Mỗi đêm batch job đọc toàn bộ đơn trong ngày → tính tổng theo cửa hàng, theo sản phẩm → ghi kết quả cho analyst.', why: {
        batch: 'Định kỳ “nghiền” một lượng lớn dữ liệu đã tích luỹ. Không cần trả lời trong vài mili giây.', db: 'Cung cấp dữ liệu đơn hàng (thường qua bản sao hoặc export, để không làm chậm khách đang mua).' } },
      { v: 'fraud', label: 'Chặn thẻ đáng ngờ', flow: 'Mỗi giao dịch là một sự kiện → stream processor so với mẫu gian lận trong vài giây → chặn hoặc cho qua.', why: {
        stream: 'Phải phản ứng trong vài giây. Báo cáo chạy hằng đêm là quá muộn.', db: 'Lưu lịch sử giao dịch để làm căn cứ so sánh.', app: 'Nhận quyết định chặn và báo cho người dùng.' } },
    ];
    const cards = {};
    const grid = h('div', { class: 'bb-grid' }, BLOCKS.map(([k, name, sub]) => {
      const why = h('span', { class: 'why' });
      const el = h('div', { class: 'bb' }, h('b', name), h('small', sub), why);
      cards[k] = { el, why };
      return el;
    }));
    const flow = h('p', { class: 'lab-note' });
    const sg = seg({ label: 'Hành động', options: ACTIONS.map((a) => ({ value: a.v, label: a.label })), value: 'order', onChange: render });
    root.append(sg.el, grid, h('div', { class: 'box' }, h('h5', 'Luồng dữ liệu'), flow));
    function render() {
      const a = ACTIONS.find((x) => x.v === sg.value);
      for (const [k] of BLOCKS) {
        const on = k in a.why;
        cards[k].el.classList.toggle('on', on);
        cards[k].why.textContent = on ? a.why[k] : '';
      }
      flow.textContent = a.flow;
    }
    render();
  });

  // ---------------------------------------------------------------- 1.2 OLTP vs OLAP
  widget('oltp-olap', (root) => {
    const N = 1600, COLS = 80;
    const r = rng(42);
    const PRODUCTS = [['Chuối', 25000], ['Sữa tươi', 32000], ['Bánh mì', 15000], ['Tã hãng X', 320000], ['Đồ ăn dặm Y', 85000], ['Gạo 5kg', 180000]];
    const rows = [];
    for (let i = 0; i < N; i++) {
      const month = 1 + Math.floor((i * 12) / N);
      const p = Math.floor(r() * PRODUCTS.length);
      const promo = PRODUCTS[p][0] === 'Chuối' && month === 6 && r() < 0.8;
      const qty = PRODUCTS[p][0] === 'Chuối' ? (promo ? 5 + Math.floor(r() * 4) : 2 + Math.floor(r() * 3)) : 1 + Math.floor(r() * 3);
      rows.push({ order_id: 1000 + i, customer_id: 1 + Math.floor(r() * 400), store: 'CH-' + (1 + Math.floor(r() * 8)), month, product: PRODUCTS[p][0], qty, unit_price: PRODUCTS[p][1], promo });
    }
    const QUERIES = [
      { v: 'p1', label: 'Point: đơn #2042', kind: 'oltp', sql: "SELECT * FROM orders WHERE order_id = 2042;", touch: () => [1042], match: (x) => x.order_id === 2042 },
      { v: 'p2', label: 'Point: đơn của khách #77', kind: 'oltp', sql: "SELECT * FROM orders WHERE customer_id = 77\nORDER BY order_id DESC LIMIT 5;", touch: () => rows.map((x, i) => (x.customer_id === 77 ? i : -1)).filter((i) => i >= 0).slice(-5), match: (x) => x.customer_id === 77 },
      { v: 'a1', label: 'Phân tích: doanh thu từng cửa hàng tháng 1', kind: 'olap', sql: "SELECT store, SUM(qty * unit_price) AS revenue\nFROM orders WHERE month = 1\nGROUP BY store;", match: (x) => x.month === 1 },
      { v: 'a2', label: 'Phân tích: chuối bán thêm khi khuyến mãi', kind: 'olap', sql: "SELECT promo, AVG(qty) FROM orders\nWHERE product = 'Chuối'\nGROUP BY promo;", match: (x) => x.product === 'Chuối' },
    ];
    const svg = svgRoot(COLS * 10, (N / COLS) * 10, 'Lưới 1.600 đơn hàng');
    const cells = rows.map((_, i) => {
      const c = s('rect', { x: (i % COLS) * 10, y: Math.floor(i / COLS) * 10, width: 9, height: 9, rx: 1.5, class: 'f-surface2' });
      svg.appendChild(c);
      return c;
    });
    const sg = seg({ label: 'Truy vấn', options: QUERIES.map((q) => ({ value: q.v, label: q.label })), value: 'p1', onChange: () => run(false) });
    const runBtn = button('Chạy truy vấn', () => run(true));
    const code = h('pre', { class: 'code' });
    const stRead = stat('Bản ghi phải đọc', '—'), stMatch = stat('Bản ghi khớp', '—'), stScale = stat('Nếu bảng có 1 tỷ đơn', '—');
    const result = h('div', { class: 'box' });
    root.append(
      h('div', { class: 'controls' }, sg.el, runBtn), code,
      h('div', { class: 'viz' }, svg),
      h('p', { class: 'lab-note' }, 'Ô xám: chưa đọc · ô vàng: đã đọc nhưng không khớp · ô xanh: khớp điều kiện. Mỗi ô là một đơn hàng, sắp theo thời gian (tháng 1 ở trên cùng).'),
      h('div', { class: 'stats' }, stRead, stMatch, stScale), result);
    let busy = false;
    async function run(animate) {
      if (busy) return;
      busy = true; runBtn.disabled = true;
      const q = QUERIES.find((x) => x.v === sg.value);
      code.textContent = q.sql;
      cells.forEach((c) => c.setAttribute('class', 'f-surface2'));
      clear(result);
      let read = 0, matched = [];
      if (q.kind === 'oltp') {
        const idx = q.touch();
        if (animate) await sleep(150);
        idx.forEach((i) => cells[i].setAttribute('class', 'f-accent'));
        read = idx.length; matched = idx.map((i) => rows[i]);
        stRead.update(fmt(read), 'ok', 'tra qua index trên khoá');
        stMatch.update(fmt(matched.length));
        stScale.update('vẫn ≈ ' + fmt(read), 'ok', 'index tìm thẳng tới bản ghi');
        result.append(h('h5', 'Kết quả (trả về từng bản ghi)'), h('pre', { class: 'json', html: jsonHTML(matched.length === 1 ? matched[0] : matched.map(({ order_id, product, qty, month }) => ({ order_id, product, qty, month }))) }));
      } else {
        for (let start = 0; start < N; start += COLS) {
          for (let i = start; i < start + COLS; i++) {
            const m = q.match(rows[i]);
            cells[i].setAttribute('class', m ? 'f-accent' : 'f-mark');
            if (m) matched.push(rows[i]);
          }
          read = start + COLS;
          stRead.update(fmt(read), 'warn', 'quét toàn bảng');
          stMatch.update(fmt(matched.length));
          if (animate) await sleep(35);
        }
        stScale.update('1 tỷ', 'bad', 'số bản ghi đọc tăng theo kích thước bảng');
        result.appendChild(h('h5', 'Kết quả (số liệu tổng hợp, không phải từng bản ghi)'));
        if (q.v === 'a1') {
          const by = {};
          matched.forEach((x) => (by[x.store] = (by[x.store] || 0) + x.qty * x.unit_price));
          const max = Math.max(...Object.values(by));
          Object.keys(by).sort().forEach((k) => result.appendChild(h('div', { style: { display: 'grid', gridTemplateColumns: '52px minmax(0,1fr) 110px', gap: '8px', alignItems: 'center', fontSize: '.8rem' } },
            h('span', k), h('span', { class: 'meter val' }, h('i', { style: { width: (by[k] / max) * 100 + '%' } })), h('span', { class: 'mono', style: { textAlign: 'right' } }, vnd(by[k])))));
        } else {
          const avg = (arr) => arr.reduce((a, x) => a + x.qty, 0) / arr.length;
          const yes = matched.filter((x) => x.promo), no = matched.filter((x) => !x.promo);
          const a = avg(yes), b = avg(no);
          result.append(h('p', `Trung bình mỗi đơn có khuyến mãi: ${fmt(a, 1)} nải (${yes.length} đơn). Không khuyến mãi: ${fmt(b, 1)} nải (${no.length} đơn).`),
            h('p', h('b', `Bán thêm khoảng ${pct(a / b - 1, 0)} mỗi đơn trong đợt khuyến mãi.`)));
        }
      }
      busy = false; runBtn.disabled = false;
    }
    run(false);
  });

  // ---------------------------------------------------------------- 1.3 ETL pipeline
  widget('etl-pipeline', (root) => {
    const raw = {
      pos: { txn_id: 'T-88123', store_code: 'HN-03', sku: 'BAN-001', qty: '6', unit_price: '25.000đ', customer: 'c_7781', ts: '14/01/2024 18:02:11 +07' },
      inv: { sku_code: 'ban001', ten_sp: 'Chuối Laba (nải)', nhom: 'trai_cay', ton_kho: 140 },
      crm: { contact: { id: 'c_7781', email: 'an.nguyen@example.com', phone: '0912 345 678', lifecycle: 'vip' } },
    };
    const fact = { date_key: 20240114, hour: 18, store_key: 'HN-03', product_key: 'BAN001', product_name: 'Chuối Laba (nải)', category: 'Trái cây', customer_segment: 'VIP', quantity: 6, unit_price_vnd: 25000, revenue_vnd: 150000 };
    const changes = ['Chuẩn hoá mã sản phẩm: “BAN-001” và “ban001” → “BAN001” để nối được hai nguồn', 'Đổi kiểu: qty "6" → 6, giá "25.000đ" → 25000', 'Tách thời gian thành date_key 20240114 và giờ 18 (chuẩn bị cho bảng ngày)', 'Nối tên và nhóm sản phẩm từ DB kho', 'Nối phân khúc khách từ CRM', 'Bỏ email và số điện thoại: phân tích không cần, giữ lại chỉ thêm rủi ro', 'Tính revenue_vnd = 6 × 25000', 'Đổi tên cột sang schema phân tích (fact_sales)'];
    const sqlT = "CREATE TABLE fact_sales AS\nSELECT CAST(strftime(p.ts, '%Y%m%d') AS INT) AS date_key,\n       p.store_code AS store_key,\n       upper(replace(p.sku, '-', '')) AS product_key,\n       i.ten_sp AS product_name, c.lifecycle AS customer_segment,\n       CAST(p.qty AS INT) * parse_vnd(p.unit_price) AS revenue_vnd\nFROM raw_pos p\nJOIN raw_inventory i ON upper(i.sku_code) = upper(replace(p.sku, '-', ''))\nJOIN raw_crm c       ON c.contact_id = p.customer;";
    const mode = seg({ label: 'Thứ tự', options: [{ value: 'etl', label: 'ETL: biến đổi trước khi nạp' }, { value: 'elt', label: 'ELT: nạp rồi biến đổi trong warehouse' }], value: 'etl', onChange: () => { step = 0; render(); } });
    let step = 3;
    const prev = button('← Bước trước', () => { step = Math.max(0, step - 1); render(); }, 'ghost');
    const next = button('Bước tiếp →', () => { step = Math.min(3, step + 1); render(); });
    const stages = h('div', { class: 'bb-grid' });
    const detail = h('div');
    root.append(h('div', { class: 'controls' }, mode.el, h('div', { class: 'btn-row' }, prev, next)), stages, detail);
    const boxJ = (title, obj) => h('div', { class: 'box' }, h('h5', title), h('pre', { class: 'json', html: jsonHTML(obj) }));
    function render() {
      const elt = mode.value === 'elt';
      const names = elt ? [['Nguồn', '3 hệ vận hành'], ['Extract', 'trích dữ liệu ra'], ['Load', 'nạp dữ liệu thô vào warehouse'], ['Transform', 'SQL chạy bên trong warehouse']]
        : [['Nguồn', '3 hệ vận hành'], ['Extract', 'trích ra vùng tạm'], ['Transform', 'chạy trên máy ETL riêng'], ['Load', 'nạp bản ghi sạch vào warehouse']];
      clear(stages);
      names.forEach(([n, sub], i) => stages.appendChild(h('div', { class: 'bb' + (i === step ? ' on' : '') }, h('b', `${i + 1}. ${n}`), h('small', sub))));
      clear(detail);
      prev.disabled = step === 0; next.disabled = step === 3;
      const three = (a, b, c) => h('div', { class: 'bb-grid', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' } }, a, b, c);
      if (step === 0) {
        detail.append(h('p', { class: 'lab-note' }, 'Cùng một lần mua chuối nằm ở ba hệ khác nhau, ba schema khác nhau, ba cách viết mã sản phẩm khác nhau. Đây là data silo.'),
          three(boxJ('POS DB (máy thu ngân)', raw.pos), boxJ('Inventory DB (kho)', raw.inv), boxJ('CRM SaaS (chỉ có API)', raw.crm)));
      } else if (step === 1) {
        detail.append(h('p', { class: 'lab-note' }, 'POS: dump định kỳ mỗi đêm. Kho: luồng cập nhật liên tục. CRM: connector gọi API của nhà cung cấp (Fivetran, Singer, Airbyte). Dữ liệu chưa đổi gì, chỉ được sao ra.'),
          three(boxJ(elt ? 'Đang chuyển đi' : 'Vùng tạm (staging)', raw.pos), boxJ('…', raw.inv), boxJ('…', raw.crm)));
      } else if (!elt && step === 2) {
        detail.append(h('div', { class: 'lab-split' }, h('div', { class: 'box' }, h('h5', 'Những gì bước Transform làm'), h('ol', { style: { margin: 0, paddingLeft: '1.2em' } }, changes.map((c) => h('li', c)))), boxJ('Bản ghi sau biến đổi', fact)));
      } else if (!elt && step === 3) {
        detail.append(h('div', { class: 'lab-split' }, boxJ('Warehouse · bảng fact_sales', fact),
          h('div', { class: 'box' }, h('h5', 'Analyst giờ có thể hỏi'), h('pre', { class: 'code', text: "SELECT category, SUM(revenue_vnd)\nFROM fact_sales\nWHERE customer_segment = 'VIP'\n  AND date_key BETWEEN 20240101 AND 20240131\nGROUP BY category;" }),
            h('p', { class: 'lab-note' }, 'Một truy vấn gộp dữ liệu từ cả ba nguồn mà không chạm vào hệ vận hành nào.'))));
      } else if (elt && step === 2) {
        detail.append(h('p', { class: 'lab-note' }, 'Dữ liệu thô được nạp nguyên trạng thành các bảng raw_* trong warehouse. Ưu điểm: giữ được bản gốc, muốn biến đổi kiểu khác thì chạy lại. Lưu ý: email và số điện thoại giờ đã nằm trong warehouse, cần kiểm soát quyền truy cập.'),
          three(boxJ('raw_pos', raw.pos), boxJ('raw_inventory', raw.inv), boxJ('raw_crm', { contact_id: 'c_7781', email: 'an.nguyen@example.com', phone: '0912 345 678', lifecycle: 'vip' })));
      } else {
        detail.append(h('div', { class: 'lab-split' }, h('div', { class: 'box' }, h('h5', 'Transform = SQL chạy trong warehouse'), h('pre', { class: 'code', text: sqlT })), boxJ('Kết quả · fact_sales', fact)));
      }
    }
    render();
  });

  // ---------------------------------------------------------------- 1.4 lake or warehouse
  widget('lake-or-warehouse', (root) => {
    const ITEMS = [
      { k: 'orders', name: 'Bảng đơn hàng', meta: 'hàng và cột, schema ổn định', tab: true, parquet: true, loss: null },
      { k: 'photos', name: 'Ảnh sản phẩm (JPEG)', meta: 'nhị phân, vài MB mỗi ảnh', tab: false, parquet: false, loss: 'Bảng quan hệ chỉ giữ được URL hoặc vài thuộc tính. Điểm ảnh, thứ mà computer vision cần, không truy vấn được bằng SQL.' },
      { k: 'reviews', name: 'Review của khách (văn bản)', meta: 'văn bản tự do', tab: true, parquet: true, loss: 'Lưu được dưới dạng cột text, nhưng thường chỉ còn số sao hoặc vài cột đã tách. Văn bản gốc cho NLP hay bị cắt hoặc bỏ.' },
      { k: 'sensor', name: 'Cảm biến nhiệt độ kho', meta: '1 điểm mỗi giây, hàng tỷ điểm', tab: true, parquet: true, loss: 'Để vừa warehouse, dữ liệu thường bị gộp theo giờ. Mất độ chi tiết từng giây mà mô hình phát hiện bất thường cần.' },
      { k: 'clicks', name: 'Clickstream (JSON lồng nhau)', meta: 'schema đổi liên tục', tab: false, parquet: true, loss: 'Phải “làm phẳng” vào cột cố định. Trường mới xuất hiện sau này bị bỏ qua cho tới khi ai đó sửa ETL.' },
      { k: 'features', name: 'Vector đặc trưng cho mô hình gợi ý', meta: 'ma trận số thưa', tab: false, parquet: true, loss: 'Ma trận hàng nghìn cột thưa không hợp với bảng quan hệ.' },
    ];
    const choice = { orders: 'wh', photos: 'wh', reviews: 'wh', sensor: 'wh', clicks: 'lake', features: 'lake' };
    let lakehouse = false;
    const list = h('div', { class: 'route-list' });
    const lh = checkbox('Có lakehouse (Trino, Spark SQL…) chạy SQL trên file trong lake', false, (v) => { lakehouse = v; render(); });
    const table = h('table', { class: 'data' });
    const lossBox = h('div', { class: 'box' });
    const sum = h('div', { class: 'stats' });
    ITEMS.forEach((it) => {
      const sg = seg({ label: it.name, options: [{ value: 'wh', label: 'Warehouse' }, { value: 'lake', label: 'Data lake' }], value: choice[it.k], onChange: (v) => { choice[it.k] = v; render(); } });
      list.appendChild(h('div', { class: 'route-row' }, h('div', h('b', it.name), h('span', { class: 'meta' }, it.meta)), sg.el));
    });
    root.append(list, lh.el, h('div', { class: 'table-wrap' }, table), lossBox, sum);
    function access(it, who) {
      const wh = choice[it.k] === 'wh';
      if (who === 'ba') {
        if (wh) return it.tab ? ['ok', 'SQL/BI'] : ['bad', 'không truy vấn được'];
        return lakehouse && it.parquet ? ['ok', 'qua lakehouse'] : ['bad', lakehouse ? 'không phải dạng bảng' : 'cần lakehouse'];
      }
      if (who === 'ds') {
        if (!wh) return ['ok', 'đọc file gốc'];
        return it.loss ? ['warn', 'chỉ còn bản đã biến đổi'] : ['ok', 'xuất ra pandas'];
      }
      if (!wh) return ['ok', 'dữ liệu thô'];
      return it.loss ? ['bad', 'thiếu dữ liệu gốc'] : ['warn', 'phải export'];
    }
    function render() {
      clear(table);
      table.append(h('thead', h('tr', h('th', 'Dữ liệu'), h('th', 'Analyst · dashboard SQL'), h('th', 'Data scientist · pandas/Spark'), h('th', 'Huấn luyện ML'))));
      const tb = h('tbody');
      let ok = 0;
      ITEMS.forEach((it) => {
        const cells = ['ba', 'ds', 'ml'].map((w) => { const [t, txt] = access(it, w); if (t === 'ok') ok++; return h('td', h('span', { class: 'pill ' + t }, txt)); });
        tb.appendChild(h('tr', h('td', it.name, ' ', h('span', { class: 'pill ' + (choice[it.k] === 'wh' ? 'accent' : 'violet') }, choice[it.k] === 'wh' ? 'WH' : 'Lake')), cells));
      });
      table.appendChild(tb);
      clear(lossBox);
      const lost = ITEMS.filter((it) => choice[it.k] === 'wh' && it.loss);
      lossBox.appendChild(h('h5', 'Mất gì khi ép vào warehouse'));
      if (!lost.length) lossBox.appendChild(h('p', { class: 'lab-note' }, 'Không có: mọi dữ liệu “khó” đang ở dạng thô trong lake (sushi principle: raw data is better).'));
      lost.forEach((it) => lossBox.appendChild(h('p', { style: { margin: '0 0 6px' } }, h('b', it.name + ': '), it.loss)));
      clear(sum);
      sum.append(stat('Cặp (dữ liệu, người dùng) dùng tốt', `${ok}/${ITEMS.length * 3}`, ok >= 15 ? 'ok' : ok >= 10 ? 'warn' : 'bad'),
        stat('Gợi ý', lakehouse ? 'Lake + lakehouse' : 'Lake → warehouse', 'accent', lakehouse ? 'SQL và ML cùng chạy trên một kho file' : 'lake là trạm trung gian, warehouse nhận phần dạng bảng'));
    }
    render();
  });

  // ---------------------------------------------------------------- 1.5 derived data
  widget('derived-data', (root) => {
    const INITIAL = [
      { id: 1, name: 'Giày chạy bộ Aero', cat: 'Giày', price: 1250000 },
      { id: 2, name: 'Áo chạy bộ thoáng khí', cat: 'Áo', price: 390000 },
      { id: 3, name: 'Giày trail Rock', cat: 'Giày', price: 1890000 },
      { id: 4, name: 'Bình nước 750ml', cat: 'Phụ kiện', price: 150000 },
      { id: 5, name: 'Áo gió chạy bộ', cat: 'Áo', price: 650000 },
    ];
    const HOT = [1, 3, 4];
    let source, derived;
    const build = (src) => {
      const cache = {}; HOT.forEach((id) => { const p = src.find((x) => x.id === id); cache['product:' + id] = p.name + ' · ' + vnd(p.price); });
      const index = {}; src.forEach((p) => p.name.toLowerCase().split(/\s+/).filter((w) => w.length > 2).forEach((w) => { (index[w] = index[w] || []).push(p.id); }));
      const totals = {}; src.forEach((p) => { const t = (totals[p.cat] = totals[p.cat] || { n: 0, sum: 0 }); t.n++; t.sum += p.price; });
      Object.values(totals).forEach((t) => (t.avg = Math.round(t.sum / t.n)));
      return { cache, index, totals };
    };
    const lg = log();
    const srcBox = h('div', { class: 'box' });
    const dBoxes = h('div', { class: 'bb-grid', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' } });
    const q = h('input', { type: 'text', value: 'aero', 'aria-label': 'Tìm trong search index', placeholder: 'từ khoá' });
    const qOut = h('span', { class: 'lab-note' });
    q.addEventListener('input', renderSearch);
    const status = h('div', { class: 'stats' });
    const bProp = button('Lan truyền thay đổi', async () => { if (!source) return; bProp.disabled = true; lg.add('→ Đọc thay đổi từ nguồn, cập nhật cache, index, bảng tổng…', 'acc'); await sleep(350); derived = build(source); lg.add('✓ Dữ liệu dẫn xuất khớp nguồn.', 'ok'); bProp.disabled = false; render(); });
    const bDrop = button('Xoá dữ liệu dẫn xuất', () => { derived = null; lg.add('✗ Đã xoá cache, search index và bảng tổng.', 'warn'); render(); }, 'ghost');
    const bRebuild = button('Dựng lại từ nguồn', async () => {
      if (!source) { lg.add('✗ Không dựng lại được: bảng nguồn đã mất. Thứ còn lại (nếu có) là bản sao dẫn xuất, có thể đã lỗi thời và thiếu dữ liệu.', 'bad'); return; }
      bRebuild.disabled = true; lg.add('→ Quét toàn bộ bảng nguồn và tính lại…', 'acc'); await sleep(350); derived = build(source); lg.add('✓ Dựng lại xong. Không mất gì vì nguồn còn nguyên.', 'ok'); bRebuild.disabled = false; render();
    }, 'ghost');
    const bKill = button('Xoá bảng nguồn', () => { source = null; lg.add('✗ Bảng nguồn (system of record) đã bị xoá.', 'bad'); render(); }, 'danger');
    const bReset = button('Khôi phục ví dụ', () => reset(), 'ghost');
    root.append(srcBox, h('div', { class: 'btn-row' }, bProp, bDrop, bRebuild, bKill, bReset), status, dBoxes,
      h('div', { class: 'controls' }, h('div', { class: 'ctl' }, h('label', h('span', 'Tìm qua search index')), q), qOut), lg);
    function reset() { source = INITIAL.map((p) => ({ ...p })); derived = build(source); lg.reset(); lg.add('Sẵn sàng. Thử đổi tên sản phẩm 1 thành “Giày chạy bộ Nova” rồi tìm “aero”.', 't'); render(); }
    function renderSource() {
      clear(srcBox);
      srcBox.appendChild(h('h5', 'System of record · bảng products (sửa trực tiếp được)'));
      if (!source) { srcBox.appendChild(h('p', { class: 'gone' }, 'Bảng nguồn không còn tồn tại.')); return; }
      const t = h('table', { class: 'mini-table' }, h('thead', h('tr', h('th', 'id'), h('th', 'name'), h('th', 'category'), h('th', { class: 'num' }, 'price (đ)'))));
      const tb = h('tbody');
      source.forEach((p) => {
        const nm = h('input', { type: 'text', value: p.name, 'aria-label': 'Tên sản phẩm ' + p.id, style: { width: '100%', minWidth: '120px' } });
        nm.addEventListener('input', () => { p.name = nm.value; renderDerived(); });
        nm.addEventListener('change', () => lg.add(`Ghi vào nguồn: products[${p.id}].name = “${p.name}”`));
        const pr = h('input', { type: 'number', value: p.price, step: 10000, min: 0, 'aria-label': 'Giá sản phẩm ' + p.id, style: { width: '100px' } });
        pr.addEventListener('input', () => { p.price = +pr.value || 0; renderDerived(); });
        pr.addEventListener('change', () => lg.add(`Ghi vào nguồn: products[${p.id}].price = ${fmt(p.price)}`));
        tb.appendChild(h('tr', h('td', String(p.id)), h('td', nm), h('td', p.cat), h('td', pr)));
      });
      t.appendChild(tb);
      srcBox.appendChild(h('div', { style: { overflowX: 'auto' } }, t));
    }
    function renderDerived() {
      clear(dBoxes); clear(status);
      const fresh = source ? build(source) : null;
      let staleCount = 0;
      const mk = (title, kind, rowsFn) => {
        const box = h('div', { class: 'box' });
        const d = derived ? derived[kind] : null;
        const rowsEl = h('table', { class: 'mini-table' });
        let stale = 0;
        if (!d) rowsEl.appendChild(h('tr', h('td', { class: 'gone' }, 'trống')));
        else rowsFn(d, fresh ? fresh[kind] : null).forEach(([k, v, isStale]) => { if (isStale) stale++; rowsEl.appendChild(h('tr', { class: isStale ? 'stale' : '' }, h('td', k), h('td', v))); });
        staleCount += stale;
        box.append(h('h5', title, ' ', d ? h('span', { class: 'pill ' + (!fresh ? 'warn' : stale ? 'warn' : 'ok') }, !fresh ? 'không còn nguồn' : stale ? `lỗi thời ${stale}` : 'khớp nguồn') : h('span', { class: 'pill bad' }, 'đã xoá')), h('div', { style: { overflowX: 'auto' } }, rowsEl));
        dBoxes.appendChild(box);
      };
      mk('Cache', 'cache', (d, f) => Object.keys(d).map((k) => [k, d[k], f && f[k] !== d[k]]));
      mk('Search index (từ → id)', 'index', (d, f) => {
        const keys = [...new Set([...Object.keys(d), ...(f ? Object.keys(f) : [])])].sort();
        return keys.map((k) => [k, d[k] ? d[k].join(', ') : '(thiếu)', f && String(f[k] || '') !== String(d[k] || '')]);
      });
      mk('Bảng tổng theo danh mục', 'totals', (d, f) => Object.keys(d).map((k) => [k, `${d[k].n} sp · TB ${fmtBig(d[k].avg)} đ`, f && (!f[k] || f[k].avg !== d[k].avg || f[k].n !== d[k].n)]));
      status.append(stat('Nguồn', source ? 'còn' : 'đã mất', source ? 'ok' : 'bad'), stat('Dẫn xuất', derived ? (staleCount ? `${staleCount} mục lỗi thời` : 'khớp nguồn') : 'trống', derived ? (staleCount ? 'warn' : 'ok') : 'bad'));
      renderSearch();
    }
    function renderSearch() {
      const w = q.value.trim().toLowerCase();
      if (!derived) { qOut.textContent = 'Index trống, không tìm được.'; return; }
      const ids = derived.index[w] || [];
      const names = ids.map((id) => (source ? source.find((p) => p.id === id)?.name : null) || `#${id}`);
      qOut.textContent = ids.length ? `Index trả về id ${ids.join(', ')} → ${names.join('; ')}` : 'Index không có từ này.';
    }
    function render() { renderSource(); renderDerived(); bProp.disabled = !source; }
    reset();
  });

  // ---------------------------------------------------------------- 1.6 build/buy spectrum
  widget('build-buy-spectrum', (root) => {
    const LAYERS = ['Code tính năng của bạn', 'Phần mềm hệ thống (cài, vá, tinh chỉnh)', 'Hệ điều hành & máy', 'Phần cứng & datacenter'];
    const POINTS = [
      { k: 'bespoke', t: 'Tự viết, tự chạy', sub: 'bespoke in-house', own: ['you', 'you', 'you', 'you'], ctrl: 'Toàn quyền: sửa code, tối ưu cho đúng workload, xem mọi log.', job: 'Viết, test, vận hành, mua và thay phần cứng.', ex: 'Hệ giao dịch tần suất cao, hệ lõi tạo lợi thế cạnh tranh.' },
      { k: 'onprem', t: 'Phần mềm có sẵn, tự host', sub: 'on-premises', own: ['you', 'you', 'you', 'you'], ctrl: 'Không viết phần mềm, nhưng tự cấu hình, nâng cấp khi muốn, đọc log và metrics của OS.', job: 'Cài đặt, vá lỗi, sao lưu, lập kế hoạch dung lượng, thay đĩa hỏng.', ex: 'Tải MySQL về cài trên máy chủ trong rack thuê ở datacenter.' },
      { k: 'iaas', t: 'Phần mềm có sẵn trên IaaS', sub: 'máy ảo cloud', own: ['you', 'you', 'mixed', 'vendor'], ctrl: 'Như tự host, nhưng máy được cấp trong vài phút và có nhiều cỡ.', job: 'Vẫn tự quản trị máy ảo và phần mềm. Không còn lo phần cứng vật lý.', ex: 'PostgreSQL tự cài trên một máy ảo EC2.' },
      { k: 'saas', t: 'Dịch vụ cloud / SaaS', sub: 'managed service', own: ['you', 'vendor', 'vendor', 'vendor'], ctrl: 'Chỉ dùng qua API hoặc giao diện web. Thiếu tính năng thì chỉ biết xin nhà cung cấp.', job: 'Chọn dịch vụ, tích hợp, theo dõi chi phí, chuẩn bị đường lui nếu phải chuyển đi.', ex: 'Amazon S3, Snowflake, một CRM SaaS.' },
    ];
    let cur = 'saas';
    const bar = h('div', { class: 'spectrum' });
    const btns = POINTS.map((p) => { const b = h('button', { type: 'button', 'aria-pressed': String(p.k === cur) }, p.t, h('span', p.sub)); b.addEventListener('click', () => { cur = p.k; render(); }); bar.appendChild(b); return [p.k, b]; });
    const stack = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } });
    const info = h('div', { class: 'lab-split' });
    root.append(h('div', { class: 'lab-note' }, '← Bạn tự làm nhiều hơn · Thuê ngoài nhiều hơn →'), bar, stack, info);
    function render() {
      btns.forEach(([k, b]) => b.setAttribute('aria-pressed', String(k === cur)));
      const p = POINTS.find((x) => x.k === cur);
      clear(stack);
      LAYERS.forEach((l, i) => {
        const o = p.own[i];
        stack.appendChild(h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: '8px', alignItems: 'center', padding: '7px 10px', borderRadius: '6px', background: o === 'you' ? 'var(--accent-soft)' : o === 'vendor' ? 'var(--violet-soft)' : 'var(--surface-2)' } },
          h('span', l), h('span', { class: 'pill ' + (o === 'you' ? 'accent' : o === 'vendor' ? 'violet' : '') }, o === 'you' ? 'bạn lo' : o === 'vendor' ? 'nhà cung cấp lo' : 'chia nhau')));
      });
      clear(info);
      info.append(h('div', { class: 'box' }, h('h5', 'Bạn kiểm soát được'), h('p', { style: { margin: 0 } }, p.ctrl), h('h5', { style: { marginTop: '10px' } }, 'Ví dụ'), h('p', { style: { margin: 0 } }, p.ex)),
        h('div', { class: 'box' }, h('h5', 'Việc bạn phải làm'), h('p', { style: { margin: 0 } }, p.job)));
    }
    render();
  });

  // ---------------------------------------------------------------- 1.6 cloud cost
  widget('cloud-cost', (root) => {
    const SERVER = 300, CLOUD_MARKUP = 2.2, FTE = 12000, HEAD = 1.2;
    const avgS = slider({ label: 'Tải trung bình (số máy tương đương)', min: 2, max: 40, value: 10, onInput: render });
    const ratioS = slider({ label: 'Tỉ lệ đỉnh / trung bình', min: 1, max: 8, step: 0.5, value: 1.5, format: (v) => '×' + fmt(v, 1), onInput: render });
    const knows = checkbox('Đội đã có kinh nghiệm vận hành hệ này', true, render);
    const vizBox = h('div', { class: 'viz' });
    const out = h('div', { class: 'stats' });
    const verdict = h('div', { class: 'callout' });
    root.append(h('div', { class: 'controls' }, avgS.el, ratioS.el, knows.el), vizBox, out, verdict,
      h('p', { class: 'lab-note' }, `Số liệu minh hoạ: máy tự host ${usd(SERVER)}/tháng (khấu hao + điện + chỗ đặt), mua dư ${Math.round((HEAD - 1) * 100)}% so với đỉnh. Cloud đắt hơn ${fmt(CLOUD_MARKUP, 1)} lần cho cùng sức mạnh nhưng chỉ tính phần dùng. Một kỹ sư vận hành ${usd(FTE)}/tháng.`));
    function curve(A, R) {
      const pts = [];
      const g = (t) => Math.exp(-((t - 20) ** 2) / 2);
      let mg = 0; for (let t = 0; t < 24; t += 0.25) mg += g(t); mg /= 96;
      let c = R > 1 ? (A * (R - 1)) / (1 - mg) : 0, b = A * R - c;
      if (b < 0) { b = 0; c = A / mg; }
      for (let t = 0; t <= 24; t += 0.25) pts.push([t, b + c * g(t)]);
      return pts;
    }
    function render() {
      const A = avgS.value, R = ratioS.value;
      const pts = curve(A, R);
      const peak = Math.max(...pts.map((p) => p[1]));
      const cap = Math.ceil(peak * HEAD);
      const selfHw = cap * SERVER;
      const selfOps = (knows.value ? 0.3 : 1.5) * FTE;
      const cloudUse = pts.reduce((a, p) => a + p[1] * 1.15, 0) / pts.length;
      const cloudHw = cloudUse * SERVER * CLOUD_MARKUP;
      const cloudOps = 0.3 * FTE + (knows.value ? 0 : 0.2 * FTE);
      const selfT = selfHw + selfOps, cloudT = cloudHw + cloudOps;
      const idle = 1 - A / cap;
      // chart
      const W = 640, H = 200, L = 40, B = 24, T = 12;
      const sx = (t) => L + (t / 24) * (W - L - 10), maxY = cap * 1.08, sy = (v) => T + (H - T - B) * (1 - v / maxY);
      const svg = svgRoot(W, H, 'Tải trong ngày và dung lượng');
      [0, 0.5, 1].forEach((f) => { const v = maxY * f; svg.append(s('line', { x1: L, x2: W - 10, y1: sy(v), y2: sy(v), class: 'grid' }), s('text', { x: L - 6, y: sy(v) + 4, 'text-anchor': 'end' }, fmt(v, 0))); });
      [0, 6, 12, 18, 24].forEach((t) => svg.appendChild(s('text', { x: sx(t), y: H - 6, 'text-anchor': 'middle' }, t + 'h')));
      const area = 'M' + pts.map((p) => `${sx(p[0])},${sy(p[1])}`).join('L') + `L${sx(24)},${sy(0)}L${sx(0)},${sy(0)}Z`;
      svg.appendChild(s('path', { d: area, class: 'f-accent-soft' }));
      svg.appendChild(s('path', { d: 'M' + pts.map((p) => `${sx(p[0])},${sy(p[1] * 1.15)}`).join('L'), class: 'f-none s-violet', 'stroke-width': 2 }));
      svg.appendChild(s('line', { x1: L, x2: W - 10, y1: sy(cap), y2: sy(cap), class: 'f-none s-bad dash', 'stroke-width': 2 }));
      svg.appendChild(s('text', { x: W - 12, y: sy(cap) - 5, 'text-anchor': 'end', class: 'lbl-strong' }, `Tự host: ${cap} máy chạy 24/7`));
      svg.appendChild(s('text', { x: L + 6, y: sy(pts[8][1] * 1.15) - 6, class: 'f-violet' }, 'Cloud: co giãn theo tải'));
      clear(vizBox).appendChild(svg);
      clear(out);
      out.append(stat('Tự host / tháng', usd(selfT), selfT <= cloudT ? 'ok' : '', `máy ${usd(selfHw)} + vận hành ${usd(selfOps)}`),
        stat('Cloud / tháng', usd(cloudT), cloudT < selfT ? 'ok' : '', `dùng ${usd(cloudHw)} + vận hành ${usd(cloudOps)}`),
        stat('Máy tự host nằm không', pct(idle, 0), idle > 0.6 ? 'bad' : idle > 0.35 ? 'warn' : 'ok', 'phần dung lượng mua cho đỉnh'));
      const reasons = [];
      if (R >= 3) reasons.push('tải biến động mạnh nên mua máy cho đỉnh rất lãng phí');
      if (R < 2) reasons.push('tải ổn định nên máy tự mua luôn có việc');
      if (!knows.value) reasons.push('đội chưa biết vận hành hệ này, phải thuê và đào tạo người');
      if (knows.value) reasons.push('đội đã có kinh nghiệm vận hành');
      verdict.className = 'callout ' + (cloudT < selfT ? 'callout-real' : 'callout-key');
      clear(verdict).append(h('b', 'Kết luận'), h('p', `${cloudT < selfT ? 'Cloud rẻ hơn' : 'Tự host rẻ hơn'} khoảng ${pct(Math.abs(selfT - cloudT) / Math.max(selfT, cloudT), 0)}: ${reasons.join('; ')}. Con số chỉ là một phần. Còn phải cân nhắc mất quyền kiểm soát và vendor lock-in.`));
    }
    render();
  });

  // ---------------------------------------------------------------- 1.7 storage vs compute
  widget('storage-compute', (root) => {
    const BLOCKS = ['A', 'B', 'C', 'D', 'E', 'F'];
    let mode = 'trad', nodes, lost, moved, busy = false;
    const lg = log();
    const sg = seg({ label: 'Kiến trúc', options: [{ value: 'trad', label: 'Truyền thống: đĩa gắn liền máy' }, { value: 'cloud', label: 'Cloud-native: tách storage' }], value: mode, onChange: (v) => { mode = v; reset(); } });
    const bKill = button('Giết node ngẫu nhiên', () => kill());
    const bAdd = button('Thêm node tính toán', () => scale(1), 'ghost');
    const bRem = button('Bớt node', () => scale(-1), 'ghost');
    const bReset = button('Khôi phục', () => reset(), 'ghost');
    const vizBox = h('div', { class: 'viz' });
    const stats = h('div', { class: 'stats' });
    root.append(sg.el, h('div', { class: 'btn-row' }, bKill, bAdd, bRem, bReset), vizBox, stats, lg);
    let nextId = 1;
    function reset() {
      nextId = 1; lost = new Set(); moved = 0;
      nodes = [0, 1, 2].map((i) => ({ id: nextId++, state: 'up', blocks: mode === 'trad' ? BLOCKS.slice(i * 2, i * 2 + 2) : [], cache: mode === 'cloud' ? BLOCKS.slice(i * 2, i * 2 + 2) : [] }));
      lg.reset();
      lg.add(mode === 'trad' ? 'Mỗi máy giữ 2 khối dữ liệu trên đĩa của chính nó.' : 'Toàn bộ dữ liệu nằm ở object store. Node chỉ tính toán và giữ cache cục bộ.', 't');
      render();
    }
    const live = () => nodes.filter((n) => n.state === 'up');
    function accessible() {
      if (mode === 'cloud') return BLOCKS.length;
      const on = new Set(); live().forEach((n) => n.blocks.forEach((b) => on.add(b)));
      return on.size;
    }
    async function kill() {
      if (busy) return;
      const cand = live(); if (!cand.length) return;
      busy = true;
      const n = cand[Math.floor(Math.random() * cand.length)];
      n.state = 'dead';
      if (mode === 'trad') {
        lg.add(`✗ Máy ${n.id} chết. Khối ${n.blocks.join(', ')} trên đĩa của nó không truy cập được.`, 'bad');
        render(); await sleep(900);
        lg.add(`Thay bằng máy mới: đĩa mới trống. Khối ${n.blocks.join(', ')} mất nếu không có bản sao hay backup.`, 'warn');
        n.blocks.forEach((b) => lost.add(b));
        n.state = 'up'; n.id = nextId++; n.blocks = [];
      } else {
        lg.add(`✗ Node ${n.id} chết. Mất cache cục bộ (${n.cache.join(', ') || 'trống'}). Dữ liệu vẫn nằm an toàn trong object store.`, 'bad');
        render(); await sleep(700);
        n.state = 'boot'; n.id = nextId++; n.cache = [];
        lg.add(`Khởi động node ${n.id} thay thế, gắn vào object store…`, 'acc');
        render(); await sleep(700);
        n.state = 'up';
        lg.add(`✓ Node ${n.id} chạy với cache lạnh. Vài truy vấn đầu chậm hơn trong lúc làm ấm cache.`, 'ok');
      }
      busy = false; render();
    }
    function scale(d) {
      if (busy) return;
      if (d > 0) {
        if (nodes.length >= 6) return;
        const n = { id: nextId++, state: 'up', blocks: [], cache: [] };
        nodes.push(n);
        if (mode === 'trad') {
          const donor = live().filter((x) => x !== n).sort((a, b) => b.blocks.length - a.blocks.length)[0];
          if (donor && donor.blocks.length > 1) { const b = donor.blocks.pop(); n.blocks.push(b); moved++; lg.add(`+ Máy ${n.id}. Phải copy khối ${b} từ máy ${donor.id} sang qua mạng (rebalance).`, 'warn'); }
          else lg.add(`+ Máy ${n.id}, chưa có dữ liệu để nhận.`, 't');
        } else lg.add(`+ Node ${n.id}: đọc thẳng từ object store, không cần copy dữ liệu.`, 'ok');
      } else {
        if (live().length <= 1) return;
        const n = live()[live().length - 1];
        if (mode === 'trad' && n.blocks.length) {
          const tgt = live().filter((x) => x !== n).sort((a, b) => a.blocks.length - b.blocks.length)[0];
          n.blocks.forEach((b) => { tgt.blocks.push(b); moved++; });
          lg.add(`− Trước khi tắt máy ${n.id}, phải chuyển khối ${n.blocks.join(', ')} sang máy ${tgt.id}.`, 'warn');
        } else lg.add(`− Tắt node ${n.id}. ${mode === 'cloud' ? 'Không có dữ liệu nào phải di chuyển.' : ''}`, 't');
        nodes.splice(nodes.indexOf(n), 1);
      }
      render();
    }
    function render() {
      const W = 640, H = mode === 'cloud' ? 230 : 170;
      const svg = svgRoot(W, H, 'Sơ đồ node và dữ liệu');
      const nw = Math.min(96, (W - 20) / nodes.length - 10);
      nodes.forEach((n, i) => {
        const x = 10 + i * ((W - 20) / nodes.length) + ((W - 20) / nodes.length - nw) / 2, y = 14;
        const tone = n.state === 'dead' ? 'f-bad-soft s-bad' : n.state === 'boot' ? 'f-mark-soft s-mark' : 'f-surface s-accent';
        svg.appendChild(s('rect', { x, y, width: nw, height: 120, rx: 8, class: tone, 'stroke-width': 1.5 }));
        svg.appendChild(s('text', { x: x + nw / 2, y: y + 18, 'text-anchor': 'middle', class: 'lbl-strong' }, (mode === 'trad' ? 'Máy ' : 'Node ') + n.id));
        svg.appendChild(s('text', { x: x + nw / 2, y: y + 34, 'text-anchor': 'middle' }, n.state === 'dead' ? 'đã chết' : n.state === 'boot' ? 'đang khởi động' : 'CPU + RAM'));
        const items = mode === 'trad' ? n.blocks : n.cache;
        svg.appendChild(s('text', { x: x + nw / 2, y: y + 56, 'text-anchor': 'middle' }, mode === 'trad' ? 'đĩa cục bộ' : 'cache tạm'));
        items.forEach((b, j) => {
          const bx = x + 8 + (j % 3) * ((nw - 16) / 3), by = y + 64 + Math.floor(j / 3) * 26;
          svg.appendChild(s('rect', { x: bx, y: by, width: (nw - 16) / 3 - 4, height: 22, rx: 4, class: n.state === 'dead' ? 'f-bad' : mode === 'trad' ? 'f-accent' : 'f-violet-soft' }));
          svg.appendChild(s('text', { x: bx + ((nw - 16) / 3 - 4) / 2, y: by + 15, 'text-anchor': 'middle', class: 'lbl-strong' }, b));
        });
      });
      if (mode === 'cloud') {
        svg.appendChild(s('rect', { x: 10, y: 170, width: W - 20, height: 50, rx: 8, class: 'f-violet-soft s-violet', 'stroke-width': 1.5 }));
        svg.appendChild(s('text', { x: 22, y: 190, class: 'lbl-strong' }, 'Object store (S3) · tự sao chép, đĩa hỏng không mất dữ liệu'));
        BLOCKS.forEach((b, i) => { svg.appendChild(s('rect', { x: 22 + i * 40, y: 196, width: 32, height: 18, rx: 3, class: 'f-violet' })); svg.appendChild(s('text', { x: 38 + i * 40, y: 209, 'text-anchor': 'middle', class: 'f-surface' }, b)); });
        nodes.forEach((n, i) => { const cx = 10 + i * ((W - 20) / nodes.length) + (W - 20) / nodes.length / 2; svg.appendChild(s('line', { x1: cx, y1: 134, x2: cx, y2: 170, class: 'f-none ' + (n.state === 'up' ? 's-violet' : 's-line') + ' dash', 'stroke-width': 1.5 })); });
      } else if (lost.size) {
        svg.appendChild(s('text', { x: 10, y: 160, class: 'f-bad' }, `Đã mất vĩnh viễn: khối ${[...lost].join(', ')}`));
      }
      clear(vizBox).appendChild(svg);
      const acc = accessible() - (mode === 'trad' ? 0 : 0);
      clear(stats);
      stats.append(stat('Dữ liệu truy cập được', `${acc}/${BLOCKS.length} khối`, acc === BLOCKS.length ? 'ok' : 'bad'),
        stat('Khối đã mất', String(mode === 'trad' ? lost.size : 0), (mode === 'trad' ? lost.size : 0) ? 'bad' : 'ok'),
        stat('Khối phải copy khi scale', String(moved), moved ? 'warn' : 'ok'),
        stat('Số node đang chạy', String(live().length)));
      bAdd.disabled = nodes.length >= 6; bRem.disabled = live().length <= 1;
    }
    reset();
  });

  // ---------------------------------------------------------------- 1.8 ops sort
  widget('ops-sort', (root) => {
    const TASKS = [
      ['Thay ổ cứng hỏng trong datacenter', 'v', 'Phần cứng vật lý là việc của nhà cung cấp. Bạn thậm chí không biết dữ liệu nằm trên ổ nào.'],
      ['Mua thêm đĩa trước khi hết dung lượng', 'v', 'Lưu trữ cloud tính tiền theo dung lượng thực dùng. Không còn khái niệm “hết đĩa”.'],
      ['Giữ dịch vụ managed chạy khi một máy bên dưới chết', 'v', 'Nhiều dịch vụ cloud vẫn sẵn sàng dù từng máy hỏng. Đó là thứ bạn trả tiền để mua.'],
      ['Vá hệ điều hành cho máy chạy database managed', 'v', 'Với dịch vụ managed, nhà cung cấp lo OS và phần mềm database.'],
      ['Chọn dịch vụ cloud phù hợp cho từng việc', 'y', 'Sách nêu rõ: khách hàng cloud vẫn phải chọn dịch vụ thích hợp nhất cho từng nhiệm vụ.'],
      ['Tích hợp các dịch vụ với nhau và di chuyển giữa chúng', 'y', 'Thiếu chuẩn chung nên tích hợp thường tốn nhiều công thủ công. ETL chỉ là một phần.'],
      ['Theo dõi chi phí, tắt tài nguyên không dùng', 'y', 'Capacity planning thành financial planning, tối ưu hiệu năng thành tối ưu chi phí.'],
      ['Biết trước quota và giới hạn của dịch vụ', 'y', 'Ví dụ số tiến trình chạy đồng thời tối đa. Phải lên kế hoạch trước khi đụng phải.'],
      ['Cập nhật thư viện có lỗ hổng trong code của bạn', 'y', 'Bảo mật ứng dụng và các thư viện nó dùng không thể giao hết cho cloud.'],
      ['Tìm nguyên nhân khi API của bạn chậm', 'y', 'Giám sát tải và truy tìm nguyên nhân sự cố vẫn là việc của đội bạn.'],
    ];
    const ans = {};
    const rows = TASKS.map(([t, a, ex], i) => {
      const exEl = h('span', { class: 'explain', hidden: true }, ex);
      const sg = seg({ label: t, options: [{ value: 'v', label: 'Cloud lo' }, { value: 'y', label: 'Bạn lo' }], value: null, onChange: (v) => { ans[i] = v; row.classList.remove('right', 'wrong'); exEl.hidden = true; upd(); } });
      const row = h('div', { class: 'ops-item' }, h('span', t), sg.el, exEl);
      return { row, sg, exEl, a };
    });
    const score = h('span', { class: 'lab-note' });
    const bCheck = button('Kiểm tra', () => {
      let r = 0;
      rows.forEach((x, i) => { const ok = ans[i] === x.a; if (ok) r++; x.row.classList.toggle('right', ok); x.row.classList.toggle('wrong', !ok); x.exEl.hidden = false; });
      score.textContent = `Đúng ${r}/${TASKS.length}.`;
    });
    const bShow = button('Hiện đáp án', () => { rows.forEach((x, i) => { ans[i] = x.a; x.sg.set(x.a); x.row.classList.add('right'); x.row.classList.remove('wrong'); x.exEl.hidden = false; }); upd(); score.textContent = 'Đã hiện đáp án.'; }, 'ghost');
    function upd() { score.textContent = `Đã xếp ${Object.keys(ans).length}/${TASKS.length} việc.`; }
    root.append(h('div', { class: 'route-list' }, rows.map((x) => x.row)), h('div', { class: 'btn-row', style: { alignItems: 'center' } }, bCheck, bShow, score));
    upd();
  });

  // ---------------------------------------------------------------- 1.9 go distributed?
  widget('go-distributed', (root) => {
    const REQS = [
      ['inherent', 'Người dùng tương tác với nhau từ thiết bị riêng (chat, cộng tác)', 'Vốn đã phân tán: thiết bị của các người dùng buộc phải nói chuyện qua mạng.'],
      ['services', 'Dữ liệu lưu ở dịch vụ cloud này, xử lý ở dịch vụ khác', 'Request giữa các dịch vụ: dữ liệu phải đi qua mạng.'],
      ['ha', 'Phải chạy tiếp khi một máy hoặc cả datacenter chết', 'Chịu lỗi / sẵn sàng cao: cần máy dự phòng để thay thế.'],
      ['scale', 'Dữ liệu hoặc tải vượt sức một máy lớn nhất mua được', 'Khả năng mở rộng: chia tải cho nhiều máy.'],
      ['geo', 'Người dùng ở nhiều châu lục, cần độ trễ thấp', 'Độ trễ: đặt server gần người dùng.'],
      ['elastic', 'Tải lúc rất bận lúc rất rảnh, muốn chỉ trả tiền phần dùng', 'Co giãn: thêm bớt máy theo nhu cầu.'],
      ['hw', 'Một phần hệ thống cần GPU, phần còn lại thì không', 'Phần cứng chuyên dụng: mỗi phần chạy trên loại máy hợp với nó.'],
      ['legal', 'Phục vụ người dùng ở nhiều nước có luật lưu trú dữ liệu', 'Tuân thủ pháp luật: dữ liệu phải nằm trong từng nước.'],
      ['hype', 'Muốn dùng kiến trúc giống các công ty công nghệ lớn', null],
      ['small', 'Dữ liệu vài chục GB, vài trăm request mỗi giây', null],
    ];
    const COSTS = [
      'Mọi lời gọi qua mạng có thể lỗi hoặc timeout, và timeout không cho biết server đã xử lý hay chưa.',
      'Gọi sang dịch vụ khác chậm hơn rất nhiều so với gọi hàm trong cùng tiến trình.',
      'Debug khó: cần observability và tracing (ví dụ OpenTelemetry) để biết chậm ở đâu.',
      'Giữ dữ liệu nhất quán giữa các dịch vụ trở thành việc của ứng dụng.',
      'Thêm node chưa chắc nhanh hơn: có lúc một chương trình đơn luồng thắng cả cluster hơn 100 lõi.',
    ];
    const chosen = new Set(['small']);
    const out = h('div');
    const list = h('div', { class: 'req-list' }, REQS.map(([k, label]) => checkbox(label, chosen.has(k), (v) => { v ? chosen.add(k) : chosen.delete(k); render(); }).el));
    root.append(list, out);
    function render() {
      clear(out);
      const reasons = REQS.filter(([k, , why]) => why && chosen.has(k));
      if (!reasons.length) {
        out.append(h('div', { class: 'callout callout-key' }, h('b', 'Kết luận: một node là đủ'),
          h('p', chosen.has('hype') ? 'Bắt chước kiến trúc của công ty lớn không phải lý do để phân tán. Bạn sẽ trả hết các cái giá bên dưới mà không nhận lợi ích.' : 'Không có yêu cầu nào buộc phải phân tán.'),
          h('p', 'Một máy hiện đại với DuckDB, SQLite hoặc PostgreSQL xử lý được rất nhiều. Cần thêm sức thì nâng cấp máy trước (scale up). Có thể giữ một bản sao dự phòng nếu cần.')));
      } else {
        out.append(h('div', { class: 'callout callout-real' }, h('b', `Kết luận: bạn có ${reasons.length} lý do chính đáng để phân tán`), h('ul', { style: { margin: 0, paddingLeft: '1.1em' } }, reasons.map(([, , why]) => h('li', why)))),
          h('div', { class: 'box' }, h('h5', 'Cái giá bạn nhận thêm'), h('ul', { style: { margin: 0, paddingLeft: '1.1em' } }, COSTS.map((c) => h('li', c)))));
      }
    }
    render();
  });

  // ---------------------------------------------------------------- 1.9 unsafe retry
  widget('unsafe-retry', (root) => {
    const AMOUNT = 200000, START = 1000000;
    const scen = seg({ label: 'Mạng', options: [{ value: 'ok', label: 'Mạng ổn' }, { value: 'req', label: 'Mất request' }, { value: 'resp', label: 'Mất phản hồi' }, { value: 'slow', label: 'Server chậm' }], value: 'resp' });
    const strat = seg({ label: 'Khi timeout', options: [{ value: 'none', label: 'Không retry' }, { value: 'naive', label: 'Retry ngây thơ' }, { value: 'key', label: 'Retry kèm mã giao dịch' }], value: 'naive' });
    const go = button('Gửi thanh toán 200.000 đ', () => run());
    const vizBox = h('div', { class: 'viz' });
    const stats = h('div', { class: 'stats' });
    const lg = log();
    root.append(h('div', { class: 'controls' }, h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Mạng'), scen.el), h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'Client làm gì khi timeout'), strat.el)), go, vizBox, stats, lg);
    let busy = false;
    function draw(arrows) {
      const W = 480, H = 40 + arrows.length * 34 + 16;
      const svg = svgRoot(W, H, 'Biểu đồ trình tự client và server');
      const cx = 70, sx = W - 90;
      svg.append(s('text', { x: cx, y: 18, 'text-anchor': 'middle', class: 'lbl-strong' }, 'Client'), s('text', { x: sx, y: 18, 'text-anchor': 'middle', class: 'lbl-strong' }, 'Server thanh toán'),
        s('line', { x1: cx, x2: cx, y1: 26, y2: H - 6, class: 'f-none s-ink3' }), s('line', { x1: sx, x2: sx, y1: 26, y2: H - 6, class: 'f-none s-ink3' }));
      arrows.forEach((a, i) => {
        const y = 46 + i * 34;
        const from = a.dir === 'r' ? cx : sx, full = a.dir === 'r' ? sx : cx;
        const to = a.lost ? (from + full) / 2 : full;
        const cls = a.lost ? 's-bad' : a.dir === 'r' ? 's-accent' : 's-violet';
        svg.appendChild(s('line', { x1: from, x2: to, y1: y, y2: y, class: 'f-none ' + cls + (a.lost ? ' dash' : ''), 'stroke-width': 2 }));
        if (a.lost) svg.appendChild(s('text', { x: to, y: y + 4, 'text-anchor': 'middle', class: 'f-bad lbl-strong' }, '✕'));
        else svg.appendChild(s('path', { d: a.dir === 'r' ? `M${to - 8},${y - 5}L${to},${y}L${to - 8},${y + 5}Z` : `M${to + 8},${y - 5}L${to},${y}L${to + 8},${y + 5}Z`, class: a.dir === 'r' ? 'f-accent' : 'f-violet' }));
        svg.appendChild(s('text', { x: (cx + sx) / 2, y: y - 6, 'text-anchor': 'middle' }, a.label));
        if (a.note) svg.appendChild(s('text', { x: a.noteSide === 'c' ? cx - 8 : sx + 8, y: y + 4, 'text-anchor': a.noteSide === 'c' ? 'end' : 'start', class: a.tone || '' }, a.note));
      });
      clear(vizBox).appendChild(svg);
    }
    function show(balance, charges, client) {
      clear(stats);
      stats.append(stat('Số dư thật trên server', vnd(balance), balance === START - AMOUNT ? 'ok' : balance < START - AMOUNT ? 'bad' : 'warn'),
        stat('Số lần trừ tiền', String(charges), charges === 1 ? 'ok' : charges > 1 ? 'bad' : 'warn'),
        stat('Client thấy', client, client.startsWith('Thành công') ? 'ok' : 'warn'));
    }
    async function run() {
      if (busy) return; busy = true; go.disabled = true;
      lg.reset();
      let balance = START, charges = 0;
      const seen = new Set();
      const arrows = [];
      const sc = scen.value, st = strat.value;
      const step = async (a, msg, tone) => { arrows.push(a); draw(arrows); if (msg) lg.add(msg, tone); await sleep(450); };
      const process = (key) => {
        if (st === 'key' && seen.has(key)) return 'dup';
        seen.add(key); balance -= AMOUNT; charges++; return 'charged';
      };
      const key = 'tx-7f3a';
      // attempt 1
      if (sc === 'req') await step({ dir: 'r', lost: true, label: `POST /pay ${st === 'key' ? '(mã ' + key + ')' : ''}` }, 'Request bị mất trên đường đi. Server không hề biết.', 'bad');
      else {
        await step({ dir: 'r', label: `POST /pay ${st === 'key' ? '(mã ' + key + ')' : ''}`, note: '−200.000 đ', noteSide: 's', tone: 'f-bad' }, 'Server nhận request và trừ 200.000 đ.', 'acc');
        process(key);
        if (sc === 'ok') { await step({ dir: 'l', label: '200 OK' }, 'Client nhận phản hồi thành công.', 'ok'); show(balance, charges, 'Thành công'); busy = false; go.disabled = false; return; }
        if (sc === 'resp') await step({ dir: 'l', lost: true, label: '200 OK' }, 'Phản hồi bị mất trên đường về.', 'bad');
        if (sc === 'slow') await step({ dir: 'l', label: '200 OK (đến sau timeout)', note: 'đã bỏ cuộc', noteSide: 'c', tone: 'f-ink3' }, 'Server trả lời, nhưng client đã hết kiên nhẫn từ trước.', 'warn');
      }
      lg.add('⏱ Client timeout. Server đã trừ tiền chưa? Client không thể biết.', 'warn');
      if (st === 'none') { show(balance, charges, 'Không rõ kết quả'); lg.add(charges ? 'Thực tế đã trừ tiền, nhưng người dùng tưởng thất bại và có thể thanh toán lại bằng cách khác.' : 'Thực tế chưa trừ tiền.', 't'); busy = false; go.disabled = false; return; }
      // retry
      const r = process(key);
      await step({ dir: 'r', label: `POST /pay (retry) ${st === 'key' ? '(mã ' + key + ')' : ''}`, note: r === 'dup' ? 'đã xử lý, bỏ qua' : '−200.000 đ', noteSide: 's', tone: r === 'dup' ? 'f-ok' : 'f-bad' },
        r === 'dup' ? 'Server nhận ra mã giao dịch đã xử lý, không trừ lần nữa.' : charges > 1 ? 'Server coi đây là thanh toán mới và trừ tiền lần nữa.' : 'Lần này server mới trừ tiền lần đầu.', r === 'dup' ? 'ok' : charges > 1 ? 'bad' : 'acc');
      await step({ dir: 'l', label: '200 OK' }, 'Client nhận phản hồi thành công.', 'ok');
      show(balance, charges, charges > 1 ? 'Thành công (nhưng bị trừ 2 lần)' : 'Thành công');
      if (charges > 1) lg.add('Retry ngây thơ đã trừ tiền hai lần. Các chương sau của sách bàn cách làm retry an toàn.', 'bad');
      busy = false; go.disabled = false;
    }
    draw([]); show(START, 0, 'chưa gửi');
    run();
  });

  // ---------------------------------------------------------------- 1.10 services
  widget('services', (root) => {
    const teams = slider({ label: 'Số đội kỹ sư', min: 1, max: 30, value: 4, onInput: render });
    const reqs = slider({ label: 'Request mỗi tháng (serverless vs VM)', min: 0, max: 100, value: 30, format: (v) => fmtBig(reqOf(v)), onInput: render });
    function reqOf(v) { return Math.round(10 ** (5 + (v / 100) * 4)); }
    const mono = (n) => 2 * n + 0.6 * n * n;
    const micro = (n) => 45 + 7 * n + 0.4 * n;
    const vizBox = h('div', { class: 'viz' });
    const out = h('div', { class: 'stats' });
    const verdict = h('p', { class: 'lab-note' });
    const bill = h('div', { class: 'stats' });
    root.append(teams.el, vizBox, out, verdict, h('hr', { style: { border: 0, borderTop: '1px solid var(--line)' } }), reqs.el, bill,
      h('p', { class: 'lab-note' }, 'Số liệu minh hoạ. Đơn vị bên trên là giờ kỹ sư mỗi tuần. VM: 2 máy chạy 24/7 ở $70/máy. Serverless: $3,5 cho mỗi triệu request, không tốn gì khi không có request.'));
    function render() {
      const n = teams.value;
      let cross = 1; while (cross <= 30 && mono(cross) < micro(cross)) cross++;
      const W = 640, H = 210, L = 46, B = 26, T = 10, maxY = mono(30);
      const sx = (x) => L + ((x - 1) / 29) * (W - L - 12), sy = (y) => T + (H - T - B) * (1 - Math.min(y, maxY) / maxY);
      const svg = svgRoot(W, H, 'Chi phí monolith và microservices theo số đội');
      [0, 0.5, 1].forEach((f) => svg.append(s('line', { x1: L, x2: W - 12, y1: sy(maxY * f), y2: sy(maxY * f), class: 'grid' }), s('text', { x: L - 6, y: sy(maxY * f) + 4, 'text-anchor': 'end' }, fmt(maxY * f))));
      [1, 10, 20, 30].forEach((x) => svg.appendChild(s('text', { x: sx(x), y: H - 8, 'text-anchor': 'middle' }, x + ' đội')));
      const line = (f) => 'M' + Array.from({ length: 30 }, (_, i) => `${sx(i + 1)},${sy(f(i + 1))}`).join('L');
      svg.append(s('path', { d: line(mono), class: 'f-none s-warn', 'stroke-width': 2.5 }), s('path', { d: line(micro), class: 'f-none s-violet', 'stroke-width': 2.5 }));
      if (cross <= 30) svg.append(s('line', { x1: sx(cross), x2: sx(cross), y1: T, y2: H - B, class: 'f-none s-ink3 dash' }), s('text', { x: sx(cross) + 4, y: T + 12 }, `hoà vốn ≈ ${cross} đội`));
      svg.append(s('line', { x1: sx(n), x2: sx(n), y1: T, y2: H - B, class: 'f-none s-accent', 'stroke-width': 2 }), s('circle', { cx: sx(n), cy: sy(mono(n)), r: 5, class: 'f-warn' }), s('circle', { cx: sx(n), cy: sy(micro(n)), r: 5, class: 'f-violet' }));
      svg.append(s('text', { x: sx(22), y: sy(mono(22)) - 8, class: 'f-warn lbl-strong' }, 'Monolith: phối hợp giữa các đội'), s('text', { x: sx(18), y: sy(micro(18)) - 10, class: 'f-violet lbl-strong' }, 'Microservices: vận hành nhiều dịch vụ'));
      clear(vizBox).appendChild(svg);
      clear(out);
      const better = mono(n) <= micro(n) ? 'mono' : 'micro';
      out.append(stat('Monolith', fmt(mono(n)) + ' giờ/tuần', better === 'mono' ? 'ok' : ''), stat('Microservices', fmt(micro(n)) + ' giờ/tuần', better === 'micro' ? 'ok' : ''));
      verdict.textContent = better === 'mono'
        ? `Với ${n} đội, chi phí cố định của hạ tầng microservices (deploy, giám sát, on-call, test cả cụm dịch vụ) lớn hơn chi phí phối hợp. Cách đơn giản nhất thắng.`
        : `Với ${n} đội, chi phí phối hợp trong một codebase chung tăng nhanh (gần như theo số cặp đội). Tách dịch vụ để các đội tự deploy độc lập bắt đầu đáng giá.`;
      const R = reqOf(reqs.value);
      const vm = 140, sl = (R / 1e6) * 3.5;
      clear(bill);
      bill.append(stat('VM luôn bật', usd(vm), vm <= sl ? 'ok' : '', 'trả cả khi không có ai dùng'), stat('Serverless', usd(sl), sl < vm ? 'ok' : '', 'trả theo thời gian code thực sự chạy'), stat('Hoà vốn', fmtBig((vm / 3.5) * 1e6) + ' request', 'accent'));
    }
    render();
  });

  // ---------------------------------------------------------------- 1.11 checkpoint
  widget('checkpoint', (root) => {
    const JOB = 24, CK_COST = 5 / 60, REPAIR = 1;
    const ivS = slider({ label: 'Checkpoint mỗi', min: 1, max: 12, value: 4, format: (v) => v + ' giờ', onInput: render });
    const fS = slider({ label: 'Node hỏng lúc', min: 1, max: 23, step: 0.5, value: 14.5, format: (v) => 'giờ thứ ' + fmt(v, 1), onInput: render });
    const vizBox = h('div', { class: 'viz' });
    const stats = h('div', { class: 'stats' });
    root.append(h('div', { class: 'controls' }, ivS.el, fS.el), vizBox, stats,
      h('p', { class: 'lab-note' }, 'Số liệu minh hoạ: job HPC cần 24 giờ tính toán, mỗi checkpoint ghi trạng thái ra đĩa mất 5 phút, sửa node mất 1 giờ. Dịch vụ cloud có 4 node, thay node hỏng mất 15 phút.'));
    function render() {
      const iv = ivS.value, f = fS.value;
      const lastCk = Math.floor(f / iv) * iv;
      const lost = f - lastCk;
      const nCk = Math.floor(JOB / iv);
      const total = JOB + lost + REPAIR + nCk * CK_COST;
      const W = 640, H = 200, L = 92, maxT = 40;
      const sx = (t) => L + (t / maxT) * (W - L - 10);
      const svg = svgRoot(W, H, 'Dòng thời gian HPC và cloud');
      for (let t = 0; t <= maxT; t += 8) svg.append(s('line', { x1: sx(t), x2: sx(t), y1: 20, y2: H - 22, class: 'grid' }), s('text', { x: sx(t), y: H - 6, 'text-anchor': 'middle' }, t + 'h'));
      svg.append(s('text', { x: L - 8, y: 52, 'text-anchor': 'end', class: 'lbl-strong' }, 'HPC job'), s('text', { x: L - 8, y: 138, 'text-anchor': 'end', class: 'lbl-strong' }, 'Dịch vụ cloud'));
      // HPC: done until lastCk (kept), lost segment, repair, rerun from lastCk to JOB
      const y = 36;
      svg.appendChild(s('rect', { x: sx(0), y, width: sx(lastCk) - sx(0), height: 26, class: 'f-accent' }));
      svg.appendChild(s('rect', { x: sx(lastCk), y, width: sx(f) - sx(lastCk), height: 26, class: 'f-bad' }));
      svg.appendChild(s('rect', { x: sx(f), y, width: sx(f + REPAIR) - sx(f), height: 26, class: 'f-ink3' }));
      svg.appendChild(s('rect', { x: sx(f + REPAIR), y, width: sx(total) - sx(f + REPAIR), height: 26, class: 'f-accent-soft s-accent', 'stroke-width': 1 }));
      for (let t = iv; t < JOB; t += iv) { const tt = t <= lastCk ? t : t + lost + REPAIR; svg.appendChild(s('rect', { x: sx(tt) - 1.5, y: y - 4, width: 3, height: 34, class: 'f-mark' })); }
      svg.appendChild(s('text', { x: sx(f), y: y - 8, 'text-anchor': 'middle', class: 'f-bad' }, '✕ hỏng'));
      svg.appendChild(s('text', { x: sx(total) + 4, y: y + 17 }, `xong ở ${fmt(total, 1)}h`));
      // cloud capacity line
      const y0 = 110, hh = 50, cap = (t) => (t >= f && t < f + 0.25 ? 0.75 : 1);
      const pts = []; for (let t = 0; t <= JOB; t += 0.05) pts.push(`${sx(t)},${y0 + hh * (1 - cap(t))}`);
      svg.appendChild(s('path', { d: 'M' + pts.join('L') + `L${sx(JOB)},${y0 + hh}L${sx(0)},${y0 + hh}Z`, class: 'f-violet-soft' }));
      svg.appendChild(s('path', { d: 'M' + pts.join('L'), class: 'f-none s-violet', 'stroke-width': 2 }));
      svg.appendChild(s('text', { x: sx(f) + 6, y: y0 + 22, class: 'f-violet' }, '3/4 node phục vụ trong 15 phút, rồi node mới thay vào'));
      svg.appendChild(s('text', { x: sx(JOB) + 4, y: y0 + 4 }, 'vẫn phục vụ'));
      clear(vizBox).appendChild(svg);
      clear(stats);
      stats.append(stat('HPC: công việc mất', fmt(lost, 1) + ' giờ', lost > 3 ? 'bad' : lost > 1 ? 'warn' : 'ok', 'từ checkpoint cuối tới lúc hỏng'),
        stat('HPC: tốn cho checkpoint', fmt(nCk * CK_COST * 60, 0) + ' phút', nCk > 12 ? 'warn' : '', `${nCk} lần ghi trạng thái`),
        stat('HPC: hoàn thành sau', fmt(total, 1) + ' giờ', '', 'so với 24 giờ nếu không hỏng'),
        stat('Cloud: thời gian ngừng phục vụ', '0', 'ok', 'chỉ giảm dung lượng ngắn'));
    }
    render();
  });

  // ---------------------------------------------------------------- 1.12 data minimization
  widget('data-minimization', (root) => {
    const PURPOSES = [['core', 'Tính năng cốt lõi'], ['analytics', 'Phân tích nội bộ'], ['ads', 'Chia sẻ cho đối tác quảng cáo'], ['maybe', 'Phòng khi sau này cần']];
    const RET = [['30d', '30 ngày', 0.6], ['1y', '1 năm', 1], ['forever', 'Mãi mãi', 1.6]];
    const FIELDS = [
      { k: 'email', name: 'Email đăng nhập', value: 9, risk: 2, store: true, purpose: 'core', ret: 'forever', places: ['db', 'backup', 'log'] },
      { k: 'stats', name: 'Quãng đường và thời gian mỗi lần chạy', value: 8, risk: 2, store: true, purpose: 'core', ret: '1y', places: ['db', 'backup', 'warehouse', 'ml'] },
      { k: 'gps', name: 'Lộ trình GPS chi tiết', value: 6, risk: 9, sensitive: 'Lộ ra nơi ở, nơi làm việc, thói quen đi lại.', store: true, purpose: 'maybe', ret: 'forever', places: ['db', 'backup', 'eventlog', 'warehouse', 'ml'] },
      { k: 'hr', name: 'Nhịp tim', value: 5, risk: 7, sensitive: 'Dữ liệu sức khoẻ là loại đặc biệt nhạy cảm.', store: true, purpose: 'ads', ret: 'forever', places: ['db', 'backup', 'warehouse'] },
      { k: 'dob', name: 'Ngày sinh đầy đủ', value: 2, risk: 4, store: true, purpose: 'analytics', ret: 'forever', places: ['db', 'backup', 'warehouse'] },
      { k: 'ip', name: 'Log địa chỉ IP theo thời gian', value: 2, risk: 6, sensitive: 'IP cho biết vị trí gần đúng theo thời gian.', store: true, purpose: 'maybe', ret: 'forever', places: ['log', 'eventlog', 'warehouse'] },
      { k: 'contacts', name: 'Danh bạ điện thoại', value: 1, risk: 8, sensitive: 'Là dữ liệu của cả những người chưa từng dùng app.', store: false, purpose: 'maybe', ret: 'forever', places: ['db', 'backup'] },
    ];
    const PLACES = {
      db: ['Database chính (system of record)', 'ok', 'DELETE được, nhưng phải tìm hết các bảng liên quan.'],
      backup: ['Backup và snapshot', 'warn', 'Bản chụp thường bất biến. Phải chờ hết hạn lưu hoặc mã hoá theo người dùng rồi xoá khoá.'],
      log: ['Log ứng dụng', 'warn', 'Rải rác ở nhiều file, nhiều máy.'],
      eventlog: ['Append-only event log', 'bad', 'Log bất biến không cho xoá một bản ghi ở giữa.'],
      warehouse: ['Data warehouse / data lake', 'warn', 'Dữ liệu dẫn xuất: phải xoá và chạy lại pipeline.'],
      ml: ['Mô hình ML đã huấn luyện', 'bad', 'Dữ liệu đã “ngấm” vào trọng số. Muốn chắc thì phải huấn luyện lại.'],
    };
    const list = h('div', { class: 'box', style: { padding: 0 } });
    const meters = h('div', { class: 'lab-split' });
    const flags = h('div');
    const delBox = h('div');
    const bDel = button('Người dùng yêu cầu xoá dữ liệu', () => { showDel = !showDel; renderDel(); });
    const bMin = button('Áp dụng data minimization', () => {
      FIELDS.forEach((f) => { if (f.value < 4 || f.risk > 6) f.store = false; if (f.purpose === 'maybe' || f.purpose === 'ads') f.purpose = f.value >= 6 ? 'core' : 'analytics'; if (f.ret === 'forever' && f.k !== 'email') f.ret = '1y'; });
      buildList(); render();
    }, 'ghost');
    let showDel = false;
    root.append(list, h('div', { class: 'btn-row' }, bMin, bDel), meters, flags, delBox);
    function buildList() {
      clear(list);
      FIELDS.forEach((f) => {
        const row = h('div', { class: 'field-row' + (f.store ? '' : ' off') });
        const cb = checkbox(h('span', h('b', f.name), f.sensitive ? h('span', { class: 'meta', style: { display: 'block' } }, f.sensitive) : null), f.store, (v) => { f.store = v; row.classList.toggle('off', !v); render(); });
        const ps = h('select', { 'aria-label': 'Mục đích: ' + f.name }, PURPOSES.map(([v, l]) => h('option', { value: v, selected: v === f.purpose }, l)));
        ps.addEventListener('change', () => { f.purpose = ps.value; render(); });
        const rs = h('select', { 'aria-label': 'Thời gian lưu: ' + f.name }, RET.map(([v, l]) => h('option', { value: v, selected: v === f.ret }, l)));
        rs.addEventListener('change', () => { f.ret = rs.value; render(); });
        row.append(cb.el, h('div', { class: 'btn-row' }, ps, rs));
        list.appendChild(row);
      });
    }
    function render() {
      const stored = FIELDS.filter((f) => f.store);
      const val = stored.reduce((a, f) => a + f.value * (f.purpose === 'maybe' ? 0.2 : 1), 0);
      const risk = stored.reduce((a, f) => a + f.risk * RET.find((r) => r[0] === f.ret)[2] * (f.purpose === 'ads' ? 1.5 : 1), 0);
      const maxV = FIELDS.reduce((a, f) => a + f.value, 0), maxR = FIELDS.reduce((a, f) => a + f.risk * 1.6 * 1.5, 0);
      clear(meters);
      const meter = (lbl, v, max, cls, note) => h('div', { class: 'box' }, h('h5', lbl), h('div', { class: 'meter ' + cls }, h('i', { style: { width: Math.min(100, (v / max) * 100) + '%' } })), h('p', { class: 'lab-note', style: { margin: '6px 0 0' } }, note));
      meters.append(meter('Giá trị cho sản phẩm', val, maxV, 'val', `${fmt(val, 0)}/${maxV}. Dữ liệu “phòng khi cần” gần như không tạo giá trị hôm nay.`),
        meter('Rủi ro (rò rỉ, phạt, bị buộc giao nộp)', risk, maxR, 'risk', `${fmt(risk, 0)}. Lưu càng lâu, càng nhạy cảm thì rủi ro càng cao.`));
      clear(flags);
      const issues = [];
      stored.forEach((f) => {
        if (f.purpose === 'maybe') issues.push(`${f.name}: không có mục đích cụ thể. GDPR yêu cầu mục đích rõ ràng khi thu thập.`);
        if (f.purpose === 'ads' && f.sensitive) issues.push(`${f.name}: dùng cho quảng cáo là mục đích khác với lý do người dùng cung cấp dữ liệu.`);
        if (f.ret === 'forever' && f.k !== 'email') issues.push(`${f.name}: giữ mãi mãi, lâu hơn mức cần cho mục đích.`);
      });
      flags.appendChild(h('div', { class: 'callout ' + (issues.length ? 'callout-warn' : 'callout-key') }, h('b', issues.length ? `${issues.length} điểm vướng GDPR` : 'Không thấy điểm vướng rõ ràng'),
        issues.length ? h('ul', { style: { margin: 0, paddingLeft: '1.1em' } }, issues.map((t) => h('li', t))) : h('p', 'Mỗi trường đều có mục đích cụ thể và thời gian lưu giới hạn.')));
      renderDel();
    }
    function renderDel() {
      clear(delBox);
      bDel.textContent = showDel ? 'Ẩn danh sách nơi cần xoá' : 'Người dùng yêu cầu xoá dữ liệu';
      if (!showDel) return;
      const places = new Set(); FIELDS.filter((f) => f.store).forEach((f) => f.places.forEach((p) => places.add(p)));
      const t = h('table', { class: 'data' }, h('thead', h('tr', h('th', 'Nơi dữ liệu đang nằm'), h('th', 'Độ khó'), h('th', 'Vì sao'))));
      const tb = h('tbody');
      Object.keys(PLACES).forEach((k) => { if (!places.has(k)) return; const [n, tone, why] = PLACES[k]; tb.appendChild(h('tr', h('td', n), h('td', h('span', { class: 'pill ' + tone }, tone === 'ok' ? 'dễ' : tone === 'warn' ? 'khó' : 'rất khó')), h('td', why))); });
      t.appendChild(tb);
      delBox.append(h('p', { class: 'lab-note' }, `Quyền được xoá: dữ liệu của người này đang nằm ở ${places.size} nơi. Bớt lưu trường nào thì danh sách này ngắn đi.`), h('div', { class: 'table-wrap' }, t));
    }
    buildList(); render();
  });

  // ---------------------------------------------------------------- glossary
  const T = (key, term, vi, topic, def) => ({ key, term, vi, ch: 1, topic, def });
  glossary.add([
    T('data-intensive', 'Data-intensive application', 'ứng dụng thiên về dữ liệu', 'ch1-intro', 'Ứng dụng mà thách thức chính là quản lý dữ liệu: khối lượng lớn, thay đổi liên tục, phải nhất quán khi có lỗi và phải luôn sẵn sàng.'),
    T('compute-intensive', 'Compute-intensive', 'thiên về tính toán', 'ch1-intro', 'Hệ thống mà thách thức chính là song song hoá một phép tính rất lớn, ví dụ mô phỏng khoa học.'),
    T('backend', 'Backend', 'phần phía server', 'ch1-intro', 'Mã chạy phía server xử lý request của người dùng. Backend quản lý dữ liệu thay mặt mọi người dùng, còn frontend chỉ lo dữ liệu của một người.'),
    T('stateless', 'Stateless', 'không giữ trạng thái', 'ch1-intro', 'Mã ứng dụng xử lý xong một request là quên nó. Thông tin cần giữ qua nhiều request phải lưu ở client hoặc trong hạ tầng dữ liệu.'),
    T('operational-system', 'Operational system', 'hệ thống vận hành', 'ch1-oltp-olap', 'Backend và hạ tầng dữ liệu nơi dữ liệu được tạo ra. Ứng dụng vừa đọc vừa sửa dữ liệu theo hành động của người dùng.'),
    T('analytical-system', 'Analytical system', 'hệ thống phân tích', 'ch1-oltp-olap', 'Hệ phục vụ business analyst và data scientist, chứa bản sao chỉ-đọc của dữ liệu vận hành, tối ưu cho truy vấn phân tích.'),
    T('oltp', 'OLTP (Online Transaction Processing)', 'xử lý giao dịch trực tuyến', 'ch1-oltp-olap', 'Kiểu truy cập tương tác: tra vài bản ghi theo key, tạo/sửa/xoá từng bản ghi theo thao tác của người dùng, qua một tập truy vấn cố định.'),
    T('olap', 'OLAP (Online Analytic Processing)', 'xử lý phân tích trực tuyến', 'ch1-oltp-olap', 'Kiểu truy cập phân tích: quét số lượng lớn bản ghi để tính tổng, đếm, trung bình. Analyst được tự viết truy vấn.'),
    T('point-query', 'Point query', 'truy vấn điểm', 'ch1-oltp-olap', 'Truy vấn lấy một số nhỏ bản ghi theo key, ví dụ “đơn hàng #2042”. Kiểu đọc chính của OLTP.'),
    T('data-warehouse', 'Data warehouse', 'kho dữ liệu', 'ch1-warehouse', 'Database riêng cho phân tích, chứa bản sao chỉ-đọc của dữ liệu từ nhiều hệ OLTP, để analyst truy vấn thoải mái mà không ảnh hưởng hệ vận hành.'),
    T('data-silo', 'Data silo', 'ốc đảo dữ liệu', 'ch1-warehouse', 'Tình trạng dữ liệu cần dùng nằm rải rác ở nhiều hệ độc lập, khó gộp trong một truy vấn.'),
    T('etl', 'ETL (Extract–Transform–Load)', 'trích – biến đổi – nạp', 'ch1-warehouse', 'Quy trình đưa dữ liệu vào warehouse: trích từ hệ nguồn, biến đổi sang schema phân tích và làm sạch, rồi nạp vào.'),
    T('elt', 'ELT', 'trích – nạp – biến đổi', 'ch1-warehouse', 'Biến thể của ETL: nạp dữ liệu thô vào warehouse trước, rồi biến đổi bằng SQL bên trong warehouse.'),
    T('htap', 'HTAP (Hybrid Transactional/Analytic Processing)', 'xử lý lai giao dịch/phân tích', 'ch1-warehouse', 'Hệ làm cả OLTP lẫn phân tích, không cần ETL. Bên trong thường vẫn là một engine OLTP ghép với một engine phân tích.'),
    T('data-lake', 'Data lake', 'hồ dữ liệu', 'ch1-lake', 'Kho tập trung chỉ chứa file, không áp đặt định dạng hay mô hình dữ liệu: bảng Parquet, text, ảnh, video, vector đặc trưng…'),
    T('lakehouse', 'Data lakehouse', 'lakehouse', 'ch1-lake', 'Kiến trúc chạy workload kiểu warehouse (SQL, BI) trực tiếp trên file của data lake, nhờ query engine và tầng metadata. Ví dụ Hive, Spark SQL, Presto, Trino.'),
    T('sushi-principle', 'Sushi principle', 'nguyên tắc sushi', 'ch1-lake', '“Raw data is better”: giữ dữ liệu thô để mỗi bên dùng tự biến đổi theo nhu cầu của mình.'),
    T('reverse-etl', 'Reverse ETL', 'ETL ngược', 'ch1-lake', 'Đưa kết quả của hệ phân tích ngược về hệ vận hành, ví dụ deploy mô hình gợi ý lên production.'),
    T('data-product', 'Data product', 'sản phẩm dữ liệu', 'ch1-lake', 'Đầu ra của hệ phân tích được triển khai để phục vụ người dùng, ví dụ “người mua X cũng mua Y”.'),
    T('feature-engineering', 'Feature engineering', 'kỹ thuật đặc trưng', 'ch1-lake', 'Biến hàng và cột dữ liệu thành vector số (features) sao cho mô hình ML huấn luyện tốt nhất. Thường cần code khó viết bằng SQL.'),
    T('system-of-record', 'System of record', 'nguồn sự thật', 'ch1-derived', 'Còn gọi là source of truth. Nơi giữ phiên bản chính thức của dữ liệu, được ghi vào trước tiên. Mỗi sự thật xuất hiện đúng một lần.'),
    T('derived-data', 'Derived data', 'dữ liệu dẫn xuất', 'ch1-derived', 'Dữ liệu tính ra từ dữ liệu ở hệ khác: cache, index, materialized view, mô hình ML. Dư thừa nhưng giúp đọc nhanh. Mất thì dựng lại từ nguồn.'),
    T('materialized-view', 'Materialized view', 'view vật chất hoá', 'ch1-derived', 'Kết quả truy vấn được tính sẵn và lưu lại, phải cập nhật khi dữ liệu nguồn thay đổi.'),
    T('saas', 'SaaS (Software as a Service)', 'phần mềm dạng dịch vụ', 'ch1-cloud', 'Phần mềm do nhà cung cấp viết và vận hành, bạn chỉ dùng qua web hoặc API.'),
    T('iaas', 'IaaS (Infrastructure as a Service)', 'hạ tầng dạng dịch vụ', 'ch1-cloud', 'Thuê máy ảo trên cloud với lượng CPU, RAM, đĩa, mạng nhất định. Bạn vẫn tự quản trị phần mềm trên đó.'),
    T('on-premises', 'On-premises', 'tự đặt máy', 'ch1-cloud', 'Chạy phần mềm trên phần cứng của chính mình, kể cả khi máy nằm trong rack thuê ở datacenter.'),
    T('vendor-lock-in', 'Vendor lock-in', 'bị khoá vào nhà cung cấp', 'ch1-cloud', 'Chi phí chuyển sang nhà cung cấp khác quá cao vì không có API chuẩn tương thích. Bạn phụ thuộc vào quyết định của nhà cung cấp.'),
    T('cloud-native', 'Cloud-native', 'thuần cloud', 'ch1-cloud-native', 'Kiến trúc được thiết kế để tận dụng dịch vụ cloud, xây dịch vụ cao tầng trên dịch vụ cloud thấp tầng. Ví dụ Aurora, Spanner, Snowflake, BigQuery.'),
    T('object-storage', 'Object storage', 'lưu trữ đối tượng', 'ch1-cloud-native', 'Dịch vụ lưu file lớn như Amazon S3, Azure Blob, Cloudflare R2. API đơn giản hơn filesystem nhưng tự phân tán dữ liệu và chịu được đĩa hỏng.'),
    T('storage-compute-separation', 'Separation of storage and compute', 'tách lưu trữ và tính toán', 'ch1-cloud-native', 'Lưu trữ và tính toán do các dịch vụ riêng đảm nhận (disaggregated). Node tính toán có thể thay hoặc co giãn mà không phải di chuyển dữ liệu, đổi lại dữ liệu phải đi qua mạng.'),
    T('multitenancy', 'Multitenancy', 'đa khách thuê', 'ch1-cloud-native', 'Dữ liệu và tính toán của nhiều khách hàng chạy trên cùng phần cứng, cùng dịch vụ. Tận dụng tài nguyên tốt hơn nhưng phải cách ly hiệu năng và bảo mật.'),
    T('sre', 'SRE (Site Reliability Engineering)', 'kỹ sư độ tin cậy', 'ch1-ops', 'Cách Google hiện thực DevOps: gộp phát triển và vận hành, đề cao tự động hoá, học từ sự cố và giữ tri thức của tổ chức.'),
    T('distributed-system', 'Distributed system', 'hệ phân tán', 'ch1-distributed', 'Hệ gồm nhiều máy giao tiếp qua mạng.'),
    T('node', 'Node', 'nút', 'ch1-distributed', 'Một tiến trình tham gia vào hệ phân tán.'),
    T('elasticity', 'Elasticity', 'tính co giãn', 'ch1-distributed', 'Khả năng tự thêm hoặc bớt tài nguyên theo tải để chỉ trả tiền cho phần đang dùng.'),
    T('observability', 'Observability', 'khả năng quan sát', 'ch1-distributed', 'Thu thập dữ liệu về quá trình thực thi để truy vấn cả metrics tổng lẫn từng sự kiện, giúp chẩn đoán hệ phân tán. Ví dụ tracing với OpenTelemetry.'),
    T('microservices', 'Microservices', 'kiến trúc vi dịch vụ', 'ch1-microservices', 'Chia ứng dụng thành nhiều dịch vụ, mỗi dịch vụ một mục đích, một API, một đội phụ trách và database riêng.'),
    T('serverless', 'Serverless / FaaS', 'không máy chủ', 'ch1-microservices', 'Nhà cung cấp cloud tự cấp và thu hồi tài nguyên theo request. Bạn chỉ trả cho thời gian code thực sự chạy. Code vẫn chạy trên server.'),
    T('hpc', 'HPC (High-performance computing)', 'tính toán hiệu năng cao', 'ch1-hpc', 'Siêu máy tính cho tính toán khoa học. Chạy batch job lớn, gặp lỗi thì dừng và chạy lại từ checkpoint.'),
    T('gdpr', 'GDPR', 'Quy định chung về bảo vệ dữ liệu (EU)', 'ch1-law', 'Luật EU từ 2018 trao cho người dân quyền kiểm soát dữ liệu cá nhân: giới hạn mục đích, giới hạn thời gian lưu, quyền được xoá.'),
    T('right-to-be-forgotten', 'Right to be forgotten', 'quyền được lãng quên', 'ch1-law', 'Quyền yêu cầu xoá dữ liệu cá nhân. Khó thực hiện với log bất biến, backup và dữ liệu dẫn xuất như mô hình ML.'),
    T('data-minimization', 'Data minimization', 'tối thiểu hoá dữ liệu', 'ch1-law', 'Datensparsamkeit: chỉ thu thập và giữ dữ liệu cần cho mục đích rõ ràng. Không lưu thứ có rủi ro lớn hơn giá trị.'),
    T('pci', 'PCI DSS', 'chuẩn bảo mật thẻ thanh toán', 'ch1-law', 'Chuẩn mà các công ty thẻ tín dụng yêu cầu bên xử lý thanh toán tuân thủ, có kiểm toán độc lập thường xuyên.'),
  ]);
})();
