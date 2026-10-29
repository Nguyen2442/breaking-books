(function() {
  'use strict';
  const { h, s, clear, fmt, fmtBig, fmtMs, pct, rng, clamp, sleep, slider, seg, button, checkbox, stat, log, widget, glossary } = window.DDIA;


  widget('ch11-w1', function(root) {
    clear(root);

    // 1. Metric Stats Cards
    var statsWrap = h('div', { class: 'stats' });
    var st1 = stat('Latency P99', '14 ms', 'ok');
    var st2 = stat('Throughput', '4,850 req/s', 'accent');
    var st3 = stat('Availability', '99.99%', 'ok');
    statsWrap.append(st1, st2, st3);

    // 2. Interactive SVG Visualization Canvas
    var vizWrap = h('div', { class: 'viz' });
    var svg = s('svg', { viewBox: '0 0 560 170', role: 'img', 'aria-label': 'Mô phỏng luồng thực thi Template Method & Hook' });

      var nRect0 = s('rect', { x: 20, y: 40, width: 130, height: 75, rx: 8, class: 'f-surface2 s-accent s-w2' });
      svg.appendChild(nRect0);
      svg.appendChild(s('text', { x: 85, y: 75, 'text-anchor': 'middle', class: 'lbl-strong t-mid' }, 'Client Request'));
      svg.appendChild(s('text', { x: 85, y: 91, 'text-anchor': 'middle', class: 't-mid t-sm t-dim' }, 'HTTP Ingress'));
      
      svg.appendChild(s('line', { x1: 150, y1: 77, x2: 215, y2: 77, class: 's-accent', 'stroke-width': 2, 'stroke-dasharray': '4,4' }));
      svg.appendChild(s('circle', { cx: 182, cy: 77, r: 4, class: 'f-accent' }));

      var nRect1 = s('rect', { x: 215, y: 40, width: 130, height: 75, rx: 8, class: 'f-surface2 s-ok s-w2' });
      svg.appendChild(nRect1);
      svg.appendChild(s('text', { x: 280, y: 75, 'text-anchor': 'middle', class: 'lbl-strong t-mid' }, 'CaffeineBeverage (Final)'));
      svg.appendChild(s('text', { x: 280, y: 91, 'text-anchor': 'middle', class: 't-mid t-sm t-dim' }, 'Khung thuật toán chuẩn'));
      
      svg.appendChild(s('line', { x1: 345, y1: 77, x2: 410, y2: 77, class: 's-accent', 'stroke-width': 2, 'stroke-dasharray': '4,4' }));
      svg.appendChild(s('circle', { cx: 377, cy: 77, r: 4, class: 'f-accent' }));

      var nRect2 = s('rect', { x: 410, y: 40, width: 130, height: 75, rx: 8, class: 'f-surface2 s-violet s-w2' });
      svg.appendChild(nRect2);
      svg.appendChild(s('text', { x: 475, y: 75, 'text-anchor': 'middle', class: 'lbl-strong t-mid' }, 'Subclass (Tea/Coffee)'));
      svg.appendChild(s('text', { x: 475, y: 91, 'text-anchor': 'middle', class: 't-mid t-sm t-dim' }, 'Thực thi primitive/hook'));
      
    vizWrap.appendChild(svg);

    // 3. Scenario Engine & Pedagogical Explanation Card

    var scenarios = [
      {
        label: '⚡ 1. Luồng Chuẩn (Happy Path)',
        title: 'Kịch bản 1: Xử lý Dữ liệu Thông suốt Không Nghẽn',
        obs: 'Yêu cầu di chuyển mượt mà qua các trạm xử lý: P50 = 12ms, P99 = 24ms, tỷ lệ thành công 100%.',
        mechanism: 'Dữ liệu được đệm qua hàng đợi bất đồng bộ và bộ nhớ đệm Cache giúp triệt tiêu độ trễ tầng I/O đĩa.',
        takeaway: 'Bài học: Thiết kế đường dẫn nóng (hot path) tối giản tối đa số lần network hop.',
        stat1: '24ms (Mượt)', tone1: 'ok',
        stat2: '1,000 req/s', tone2: 'ok',
        stat3: '100% Khả dụng', tone3: 'ok',
        apply: function() {
          if (typeof nRect0 !== 'undefined') nRect0.setAttribute('class', 'f-surface2 s-ok s-w2');
          if (typeof nRect1 !== 'undefined') nRect1.setAttribute('class', 'f-surface2 s-ok s-w2');
          if (typeof nRect2 !== 'undefined') nRect2.setAttribute('class', 'f-surface2 s-ok s-w2');
        }
      },
      {
        label: '⚠️ 2. Nghẽn Cổ Chai & Đứt Gãy',
        title: 'Kịch bản 2: Sự cố Dây chuyền (Cascading Failure)',
        obs: 'Trạm xử lý hạ tầng bị chậm khiến hàng đợi phía trước tràn ngập, P99 vọt lên 1,800ms, bộ nhớ RAM cảnh báo đỏ.',
        mechanism: 'Hiệu ứng tuyết lở (Thundering Herd): Các service phía trước liên tục retry khiến trạm xử lý phía sau càng ngộp thở.',
        takeaway: 'Bài học: Bắt buộc cấu hình Timeout ngắn kèm Backoff ngẫu nhiên (Jitter) khi gọi mạng ngoài.',
        stat1: '1,800ms (Nghẽn)', tone1: 'bad',
        stat2: '210 req/s', tone2: 'warn',
        stat3: 'Nghẽn dây chuyền', tone3: 'bad',
        apply: function() {
          if (typeof nRect0 !== 'undefined') nRect0.setAttribute('class', 'f-surface2 s-warn s-w2');
          if (typeof nRect1 !== 'undefined') nRect1.setAttribute('class', 'f-surface2 s-bad s-w2');
          if (typeof nRect2 !== 'undefined') nRect2.setAttribute('class', 'f-surface2 s-bad s-w2');
        }
      },
      {
        label: '🛡️ 3. Kích hoạt Circuit Breaker',
        title: 'Kịch bản 3: Tự động Ngắt mạch & Bảo vệ Hạ tầng',
        obs: 'Circuit Breaker ngắt mạch gọi sang dịch vụ lỗi, lập tức phục vụ dữ liệu dự phòng (Fallback), độ trễ hạ về 4ms.',
        mechanism: 'Ngắt kết nối tới vùng sập giúp bảo vệ phần còn lại của hệ thống không bị kéo đổ theo.',
        takeaway: 'Bài học: Thà trả về dữ liệu cũ (stale data) còn hơn làm treo toàn bộ ứng dụng của người dùng.',
        stat1: '4ms (Fallback)', tone1: 'ok',
        stat2: '950 req/s', tone2: 'ok',
        stat3: 'Đã tự ngắt mạch', tone3: 'accent',
        apply: function() {
          if (typeof nRect0 !== 'undefined') nRect0.setAttribute('class', 'f-surface2 s-ok s-w2');
          if (typeof nRect1 !== 'undefined') nRect1.setAttribute('class', 'f-accent-soft s-accent s-w2');
          if (typeof nRect2 !== 'undefined') nRect2.setAttribute('class', 'f-surface2 s-ok s-w2');
        }
      }
    ];
      

    // Insight Explanation Card DOM
    var insightCard = h('div', { class: 'lab-insight-card' });
    var insightBadge = h('span', { class: 'lab-insight-badge' }, '💡 Phân tích Cơ chế & Luồng Khái niệm');
    var insightTitle = h('h4', { class: 'lab-insight-title' }, scenarios[0].title);
    var insightDesc = h('p', { class: 'lab-insight-desc' }, scenarios[0].obs + ' ' + scenarios[0].mechanism);
    var insightTakeaway = h('div', { class: 'lab-insight-takeaway' }, scenarios[0].takeaway);
    insightCard.append(insightBadge, insightTitle, insightDesc, insightTakeaway);

    // Hoisted scenario selection handler
    function selectScenario(idx) {
      if (!scenarios || !scenarios[idx]) return;
      var sc = scenarios[idx];
      sc.apply();
      st1.update(sc.stat1, sc.tone1);
      st2.update(sc.stat2, sc.tone2);
      st3.update(sc.stat3, sc.tone3);

      insightTitle.textContent = sc.title;
      insightDesc.textContent = sc.obs + ' ' + sc.mechanism;
      insightTakeaway.textContent = sc.takeaway;

      if (typeof segControl !== 'undefined' && segControl.set) {
        segControl.set(idx);
      }
      if (typeof actionBtns !== 'undefined') {
        actionBtns.forEach(function(b, bIdx) {
          b.className = 'btn' + (bIdx === idx ? '' : ' btn-ghost');
        });
      }

      if (typeof logEl !== 'undefined' && logEl.add) {
        logEl.add('[' + sc.label + '] ' + sc.obs, sc.tone1 === 'bad' ? 'bad' : sc.tone1 === 'warn' ? 'warn' : 'ok');
      }
    }

    var actionBtns = scenarios.map(function(sc, idx) {
      return button(sc.label, function() {
        selectScenario(idx);
      }, idx === 0 ? '' : 'ghost');
    });

    var controls = h('div', { class: 'controls' });
    
    var sl = slider({
      label: 'Tải lượng giao dịch đồng thời',
      min: 100,
      max: 5000,
      step: 100,
      value: 1200,
      format: function(v) { return fmtBig(v) + ' req/s'; },
      onInput: function(v) {
        var isHigh = v > 3750;
        st2.update(fmtBig(v) + ' req/s', isHigh ? 'warn' : 'ok');
        if (typeof nodeCpuMeter !== 'undefined') {
          var w = Math.min(108, Math.max(20, Math.floor((v / 5000) * 108)));
          nodeCpuMeter.setAttribute('width', w);
          nodeCpuMeter.setAttribute('class', isHigh ? 'f-bad' : 'f-accent');
        }
        if (typeof logEl !== 'undefined' && logEl.add) {
          logEl.add('Điều chỉnh Tải lượng giao dịch đồng thời: ' + fmtBig(v) + ' req/s', isHigh ? 'warn' : 't');
        }
      }
    });
    controls.appendChild(sl.el);
    
    var btnRow = h('div', { class: 'btn-row' });
    actionBtns.forEach(function(b) { btnRow.appendChild(b); });
    controls.appendChild(btnRow);

    var logEl = log(6);
    logEl.add('Sẵn sàng khám phá: ' + scenarios[0].title, 'acc');

    root.append(controls, statsWrap, vizWrap, insightCard, logEl);
  });

  glossary.add([
    { key: 'template-method', term: 'Template Method Pattern', vi: 'Mẫu phương thức', def: 'Design pattern định nghĩa khung của một thuật toán, cho phép lớp con định nghĩa lại một số bước mà không thay đổi cấu trúc.' },
    { key: 'hollywood-principle', term: 'Hollywood Principle', vi: 'Nguyên lý Hollywood', def: 'Nguyên lý thiết kế \'Đừng gọi chúng tôi, chúng tôi sẽ gọi bạn\', giúp lớp cấp cao kiểm soát luồng gọi và ngăn chặn phụ thuộc vòng.' },
    { key: 'hook', term: 'Hook Method', vi: 'Phương thức neo', def: 'Phương thức được khai báo ở lớp cha với cài đặt mặc định (hoặc rỗng), cho phép lớp con tùy chọn ghi đè khi cần thiết.' }
  ]);
})();