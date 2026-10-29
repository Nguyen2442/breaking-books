(function() {
  'use strict';
  const { h, s, clear, fmt, fmtBig, fmtMs, pct, rng, clamp, sleep, slider, seg, button, checkbox, stat, log, widget, glossary } = window.DDIA;


  widget('ch3-w1', function(root) {
    clear(root);

    // 1. Metric Stats Cards
    var statsWrap = h('div', { class: 'stats' });
    var st1 = stat('Latency P99', '45ms', 'ok');
    var st2 = stat('Throughput', '2400 req/s', 'accent');
    var st3 = stat('Availability', '99.95%', 'ok');
    statsWrap.append(st1, st2, st3);

    // 2. Interactive SVG Visualization Canvas
    var vizWrap = h('div', { class: 'viz' });
    var svg = s('svg', { viewBox: '0 0 560 220', role: 'img', 'aria-label': 'Mô phỏng tác động của Phân khúc Use Cases đến Hiệu năng API' });

    // 2x2 Grid Axes
    svg.appendChild(s('line', { x1: 280, y1: 20, x2: 280, y2: 155, class: 's-dim', 'stroke-width': 2 }));
    svg.appendChild(s('line', { x1: 40, y1: 88, x2: 520, y2: 88, class: 's-dim', 'stroke-width': 2 }));

    // Quadrant Boxes with Pointer Cursor & Direct Click Handlers
    var q1Box = s('rect', { x: 285, y: 25, width: 230, height: 58, rx: 8, class: 'mind-node f-surface2 s-ok s-w2' });
    svg.appendChild(q1Box);
    svg.appendChild(s('text', { x: 400, y: 48, 'text-anchor': 'middle', class: 'lbl-strong t-mid' }, '🔥 Q1: Tác động Cao · Làm ngay'));
    var q1Desc = s('text', { x: 400, y: 68, 'text-anchor': 'middle', class: 't-mid t-xs t-dim' }, 'Việc quan trọng mang lại 80% kết quả');
    svg.appendChild(q1Desc);
    q1Box.addEventListener('click', function() { selectScenario(0); });

    var q2Box = s('rect', { x: 45, y: 25, width: 230, height: 58, rx: 8, class: 'mind-node f-surface2 s-accent s-w2' });
    svg.appendChild(q2Box);
    svg.appendChild(s('text', { x: 160, y: 48, 'text-anchor': 'middle', class: 'lbl-strong t-mid' }, '⭐ Q2: Kế hoạch Dài hạn'));
    var q2Desc = s('text', { x: 160, y: 68, 'text-anchor': 'middle', class: 't-mid t-xs t-dim' }, 'Học hỏi, bồi dưỡng, chiến lược 5 năm');
    svg.appendChild(q2Desc);
    q2Box.addEventListener('click', function() { selectScenario(1); });

    var q3Box = s('rect', { x: 285, y: 94, width: 230, height: 58, rx: 8, class: 'mind-node f-surface2 s-warn s-w2' });
    svg.appendChild(q3Box);
    svg.appendChild(s('text', { x: 400, y: 118, 'text-anchor': 'middle', class: 'lbl-strong t-mid' }, '⚠️ Q3: Ủy quyền / Tự động hóa'));
    var q3Desc = s('text', { x: 400, y: 138, 'text-anchor': 'middle', class: 't-mid t-xs t-dim' }, 'Việc gấp nhưng ít giá trị lâu dài');
    svg.appendChild(q3Desc);
    q3Box.addEventListener('click', function() { selectScenario(2); });

    var q4Box = s('rect', { x: 45, y: 94, width: 230, height: 58, rx: 8, class: 'mind-node f-surface2 s-dim s-w2' });
    svg.appendChild(q4Box);
    svg.appendChild(s('text', { x: 160, y: 118, 'text-anchor': 'middle', class: 'lbl-strong t-mid' }, '🗑️ Q4: Loại bỏ thẳng tay'));
    var q4Desc = s('text', { x: 160, y: 138, 'text-anchor': 'middle', class: 't-mid t-xs t-dim' }, 'Lãng phí thời gian và năng lượng');
    svg.appendChild(q4Desc);
    q4Box.addEventListener('click', function() { selectScenario(2); });
      
    vizWrap.appendChild(svg);

    // 3. Scenario Engine & Pedagogical Explanation Card

    var scenarios = [
      {
        label: '🎯 1. Tập trung Q1 (Đột phá)',
        title: 'Kịch bản 1: Dồn 80% Năng lượng vào Nhiệm vụ Cốt lõi',
        obs: 'Lựa chọn các đầu việc mang tính bản lề giúp dỡ bỏ các nút thắt dây chuyền cho toàn bộ dự án.',
        mechanism: 'Quy luật Pareto (80/20): Phần lớn kết quả xuất phát từ số ít quyết định chiến lược.',
        takeaway: 'Bài học: Trước mỗi ngày làm việc, hãy chọn ra 1-2 việc quan trọng nhất ở ô Q1 để xử lý đầu tiên.',
        stat1: 'Tác động tối đa', tone1: 'ok',
        stat2: '80% Hiệu quả', tone2: 'ok',
        stat3: 'Ưu tiên số 1', tone3: 'ok',
        apply: function() {
          q1Box.setAttribute('class', 'mind-node f-ok-soft s-ok s-w2');
          q2Box.setAttribute('class', 'mind-node f-surface2 s-dim');
          q3Box.setAttribute('class', 'mind-node f-surface2 s-dim');
          q4Box.setAttribute('class', 'mind-node f-surface2 s-dim');
        }
      },
      {
        label: '🌱 2. Đầu tư Q2 (Dài hạn)',
        title: 'Kịch bản 2: Xây dựng Năng lực Nội tại Bền vững',
        obs: 'Dành 2 giờ mỗi tuần đọc sách, tối ưu hóa công cụ hoặc rèn luyện thể chất để không bao giờ rơi vào thế chữa cháy.',
        mechanism: 'Các nhiệm vụ Q2 ngăn ngừa khủng hoảng phát sinh trong tương lai bằng cách bồi đắp kiến trúc và quy trình.',
        takeaway: 'Bài học: Người thành công dành ít nhất 30-40% thời gian cho ô Q2.',
        stat1: 'Độ bền vững', tone1: 'accent',
        stat2: 'Tầm nhìn 3-5 năm', tone2: 'accent',
        stat3: 'Đầu tư chủ động', tone3: 'ok',
        apply: function() {
          q1Box.setAttribute('class', 'mind-node f-surface2 s-dim');
          q2Box.setAttribute('class', 'mind-node f-accent-soft s-accent s-w2');
          q3Box.setAttribute('class', 'mind-node f-surface2 s-dim');
          q4Box.setAttribute('class', 'mind-node f-surface2 s-dim');
        }
      },
      {
        label: '✂️ 3. Cắt giảm Q3 & Q4',
        title: 'Kịch bản 3: Triệt tiêu Bẫy Bận rộn Giả tạo',
        obs: 'Ủy quyền các cuộc họp vô nghĩa, từ chối việc bao đồng và xóa bỏ thói quen lướt mạng xã hội tiêu cực.',
        mechanism: 'Sự tập trung thực sự là khả năng nói "KHÔNG" với hàng trăm thứ hấp dẫn khác.',
        takeaway: 'Bài học: Tinh gọn lịch làm việc để giải phóng tâm trí cho các quyết định sinh tử.',
        stat1: 'Tiết kiệm 15h/tuần', tone1: 'ok',
        stat2: 'Năng lượng giải phóng', tone2: 'ok',
        stat3: 'Tinh gọn triệt để', tone3: 'ok',
        apply: function() {
          q1Box.setAttribute('class', 'mind-node f-surface2 s-dim');
          q2Box.setAttribute('class', 'mind-node f-surface2 s-dim');
          q3Box.setAttribute('class', 'mind-node f-warn-soft s-warn s-w2');
          q4Box.setAttribute('class', 'mind-node f-surface2 s-dim s-w2');
        }
      }
    ];
      

    // Insight Explanation Card DOM
    var insightCard = h('div', { class: 'lab-insight-card' });
    var insightBadge = h('span', { class: 'lab-insight-badge' }, '💡 Lăng kính & Luồng Khái niệm');
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
    
    var segControl = seg({
      label: 'Bộ lọc Ma trận',
      value: 0,
      options: scenarios.map(function(sc, idx) {
        var shortLbl = sc.label.split(':')[0].replace(/^[0-9.\s]+/, '');
        return { value: idx, label: shortLbl };
      }),
      onChange: function(val) {
        selectScenario(val);
      }
    });
    controls.appendChild(segControl.el);
    
    var btnRow = h('div', { class: 'btn-row' });
    actionBtns.forEach(function(b) { btnRow.appendChild(b); });
    controls.appendChild(btnRow);

    var logEl = log(6);
    logEl.add('Sẵn sàng khám phá: ' + scenarios[0].title, 'acc');

    root.append(controls, statsWrap, vizWrap, insightCard, logEl);
  });

  glossary.add([
    { key: 'developer-persona', term: 'Developer Persona', vi: 'Chân dung nhà phát triển', def: 'Mô tả chi tiết về đối tượng lập trình viên sử dụng API bao gồm kỹ năng, nhu cầu và điểm đau.' },
    { key: 'switching-cost', term: 'Switching Cost', vi: 'Chi phí chuyển đổi', def: 'Mức độ tốn kém về thời gian và công sức khi nhà phát triển phải thay đổi mã nguồn để thích ứng với API mới.' },
    { key: 'idempotency', term: 'Idempotency', vi: 'Tính bất biến', def: 'Đặc tính của API cho phép thực hiện một request nhiều lần mà vẫn cho ra kết quả duy nhất, không gây lặp dữ liệu.' }
  ]);
})();