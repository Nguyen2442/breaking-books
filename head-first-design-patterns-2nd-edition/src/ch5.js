(function() {
  'use strict';
  const { h, s, clear, fmt, fmtBig, fmtMs, pct, rng, clamp, sleep, slider, seg, button, checkbox, stat, log, widget, glossary } = window.DDIA;


  widget('ch5-w1', function(root) {
    clear(root);

    // 1. Metric Stats Cards
    var statsWrap = h('div', { class: 'stats' });
    var st1 = stat('Latency P99', '1.2 ms', 'ok');
    var st2 = stat('Throughput', '45,000 req/s', 'ok');
    var st3 = stat('Heap Overhead', 'Low (<5%)', 'ok');
    statsWrap.append(st1, st2, st3);

    // 2. Interactive SVG Visualization Canvas
    var vizWrap = h('div', { class: 'viz' });
    var svg = s('svg', { viewBox: '0 0 560 170', role: 'img', 'aria-label': 'Mô phỏng chuỗi bọc Decorator (Beverage & Condiments)' });

    // Baseline and grid
    svg.appendChild(s('line', { x1: 40, y1: 135, x2: 520, y2: 135, class: 's-dim', 'stroke-width': 1 }));
    svg.appendChild(s('line', { x1: 40, y1: 30, x2: 40, y2: 135, class: 's-dim', 'stroke-width': 1 }));

    var barLabels = ['Hiện tại', 'Mục tiêu', 'Đột phá'];
    var barH = [45, 80, 65];
    var bars = [];
    for (var b = 0; b < 3; b++) {
      var bx = 90 + b * 150;
      var by = 135 - barH[b];
      var rect = s('rect', { x: bx, y: by, width: 65, height: barH[b], rx: 8, class: b === 1 ? 'f-accent s-accent s-w2' : 'f-surface2 s-dim s-w2' });
      svg.appendChild(rect);
      bars.push(rect);
      svg.appendChild(s('text', { x: bx + 32, y: 152, 'text-anchor': 'middle', class: 't-mid t-sm t-dim' }, barLabels[b]));
    }
    var chartTitleText = s('text', { x: 280, y: 22, 'text-anchor': 'middle', class: 'lbl-strong t-mid' }, '📊 Biểu đồ Tăng trưởng & Phân bổ Chỉ số');
    svg.appendChild(chartTitleText);
      
    vizWrap.appendChild(svg);

    // 3. Scenario Engine & Pedagogical Explanation Card

    var scenarios = [
      {
        label: '📈 1. Tăng trưởng Tự nhiên (Baseline)',
        title: 'Kịch bản 1: Tăng trưởng Tuyến tính Không Đòn bẩy',
        obs: 'Quy mô mở rộng tuyến tính ổn định, chi phí vận hành tăng tương ứng với doanh thu.',
        mechanism: 'Mô hình hoạt động phụ thuộc vào nhân lực tuyến tính, hiệu suất biên (marginal gain) không có bước nhảy vọt.',
        takeaway: 'Bài học: Tăng trưởng hữu cơ cần kết hợp chuẩn hóa quy trình để tránh nghẽn cổ chai.',
        stat1: 'Tuyến tính', tone1: 'ok',
        stat2: '+12% / năm', tone2: 'ok',
        stat3: 'Cân bằng', tone3: 'ok',
        apply: function() {
          bars[0].setAttribute('height', 45); bars[0].setAttribute('y', 90);
          bars[1].setAttribute('height', 60); bars[1].setAttribute('y', 75);
          bars[2].setAttribute('height', 50); bars[2].setAttribute('y', 85);
        }
      },
      {
        label: '🚀 2. Đòn bẩy Công nghệ (Scale)',
        title: 'Kịch bản 2: Hiệu ứng Đòn bẩy & Chi phí Biên gần bằng Không',
        obs: 'Doanh thu và thông lượng vọt lên 400%, trong khi chi phí hạ tầng và vận hành chỉ tăng nhẹ 15%.',
        mechanism: 'Tự động hóa và kiến trúc phi trạng thái cho phép hệ thống nhân bản công suất mà không cần tuyển dụng tỷ lệ 1:1.',
        takeaway: 'Bài học: Đầu tư sớm vào chuẩn hóa dữ liệu và API là chìa khóa để đạt đòn bẩy công nghệ.',
        stat1: 'Hàm số mũ', tone1: 'accent',
        stat2: '+380% Doanh thu', tone2: 'accent',
        stat3: 'Đột phá quy mô', tone3: 'ok',
        apply: function() {
          bars[0].setAttribute('height', 35); bars[0].setAttribute('y', 100);
          bars[1].setAttribute('height', 105); bars[1].setAttribute('y', 30); bars[1].setAttribute('class', 'f-accent s-accent s-w2');
          bars[2].setAttribute('height', 90); bars[2].setAttribute('y', 45);
        }
      },
      {
        label: '🛡️ 3. Kiểm thử Khủng hoảng (Stress Test)',
        title: 'Kịch bản 3: Thử thách Khủng hoảng & Khả năng Chống chịu',
        obs: 'Dòng tiền hoặc tài nguyên giảm 50% trong ngắn hạn, hệ thống kích hoạt chế độ tinh gọn bảo toàn lõi.',
        mechanism: 'Cắt giảm các nhánh lãng phí phụ trợ giúp doanh nghiệp/hệ thống bảo toàn quỹ thanh khoản tối thiểu.',
        takeaway: 'Bài học: Luôn có kịch bản dự phòng 6 tháng chi phí duy trì hoạt động.',
        stat1: 'Thu hẹp lõi', tone1: 'warn',
        stat2: '-35% Biến phí', tone2: 'warn',
        stat3: 'Bảo toàn quỹ', tone3: 'ok',
        apply: function() {
          bars[0].setAttribute('height', 30); bars[0].setAttribute('y', 105);
          bars[1].setAttribute('height', 40); bars[1].setAttribute('y', 95);
          bars[2].setAttribute('height', 35); bars[2].setAttribute('y', 100);
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
      label: 'Số lượng lớp bọc (Decorators)',
      min: 1,
      max: 5,
      step: 1,
      value: 3,
      format: function(v) { return fmtBig(v) + ' lớp'; },
      onInput: function(v) {
        var isHigh = v > 3.75;
        st2.update(fmtBig(v) + ' lớp', isHigh ? 'warn' : 'ok');
        if (typeof nodeCpuMeter !== 'undefined') {
          var w = Math.min(108, Math.max(20, Math.floor((v / 5) * 108)));
          nodeCpuMeter.setAttribute('width', w);
          nodeCpuMeter.setAttribute('class', isHigh ? 'f-bad' : 'f-accent');
        }
        if (typeof logEl !== 'undefined' && logEl.add) {
          logEl.add('Điều chỉnh Số lượng lớp bọc (Decorators): ' + fmtBig(v) + ' lớp', isHigh ? 'warn' : 't');
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
    { key: 'decorator-pattern', term: 'Decorator Pattern', vi: 'Mẫu thiết kế Decorator', def: 'Mẫu thiết kế cấu trúc cho phép gắn thêm trách nhiệm vào đối tượng một cách động bằng cách bọc chúng trong các đối tượng wrapper.' },
    { key: 'open-closed-principle', term: 'Open-Closed Principle', vi: 'Nguyên lý Đóng-Mở', def: 'Nguyên lý khẳng định các thực thể phần mềm nên mở cho việc mở rộng nhưng đóng cho việc sửa đổi mã nguồn.' },
    { key: 'object-composition', term: 'Object Composition', vi: 'Thành phần hóa đối tượng', def: 'Kỹ thuật lắp ráp các đối tượng lại với nhau để tạo ra các hành vi phức tạp hơn thay vì sử dụng quan hệ kế thừa lớp.' },
    { key: 'delegation', term: 'Delegation', vi: 'Ủy quyền', def: 'Mẫu thiết kế trong đó một đối tượng xử lý một yêu cầu bằng cách ủy thác cho một đối tượng hỗ trợ (helper/wrapped object).' }
  ]);
})();