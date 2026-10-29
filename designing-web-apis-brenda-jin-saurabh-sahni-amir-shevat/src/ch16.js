(function() {
  'use strict';
  const { h, s, clear, fmt, fmtBig, fmtMs, pct, rng, clamp, sleep, slider, seg, button, checkbox, stat, log, widget, glossary } = window.DDIA;


  widget('ch16-w1', function(root) {
    clear(root);

    // 1. Metric Stats Cards
    var statsWrap = h('div', { class: 'stats' });
    var st1 = stat('Partner Retention', '94.5%', 'ok');
    var st2 = stat('Self-Serve Adoption', '78.2%', 'accent');
    var st3 = stat('Support Ticket Latency', '< 4h', 'ok');
    statsWrap.append(st1, st2, st3);

    // 2. Interactive SVG Visualization Canvas
    var vizWrap = h('div', { class: 'viz' });
    var svg = s('svg', { viewBox: '0 0 560 220', role: 'img', 'aria-label': 'Ma trận Phân bổ Nguồn lực DevRel (Chiều sâu vs Chiều rộng)' });

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


  widget('ch16-w2', function(root) {
    clear(root);

    // 1. Metric Stats Cards
    var statsWrap = h('div', { class: 'stats' });
    var st1 = stat('Beta Success Rate', '100%', 'ok');
    var st2 = stat('API Spec Feedback', '18 bugs fixed', 'accent');
    var st3 = stat('Launch Readiness', 'Ready', 'ok');
    statsWrap.append(st1, st2, st3);

    // 2. Interactive SVG Visualization Canvas
    var vizWrap = h('div', { class: 'viz' });
    var svg = s('svg', { viewBox: '0 0 560 170', role: 'img', 'aria-label': 'Luồng Vận hành Chương trình Beta (6 Bước chuẩn Slack & Google)' });

      var nRect0 = s('rect', { x: 20, y: 40, width: 130, height: 75, rx: 8, class: 'f-surface2 s-accent s-w2' });
      svg.appendChild(nRect0);
      svg.appendChild(s('text', { x: 85, y: 75, 'text-anchor': 'middle', class: 'lbl-strong t-mid' }, '1. Ideation & Mapping'));
      svg.appendChild(s('text', { x: 85, y: 91, 'text-anchor': 'middle', class: 't-mid t-sm t-dim' }, 'Chọn đối tác & use case'));
      
      svg.appendChild(s('line', { x1: 150, y1: 77, x2: 215, y2: 77, class: 's-accent', 'stroke-width': 2, 'stroke-dasharray': '4,4' }));
      svg.appendChild(s('circle', { cx: 182, cy: 77, r: 4, class: 'f-accent' }));

      var nRect1 = s('rect', { x: 215, y: 40, width: 130, height: 75, rx: 8, class: 'f-surface2 s-ok s-w2' });
      svg.appendChild(nRect1);
      svg.appendChild(s('text', { x: 280, y: 75, 'text-anchor': 'middle', class: 'lbl-strong t-mid' }, '2. Joint Building'));
      svg.appendChild(s('text', { x: 280, y: 91, 'text-anchor': 'middle', class: 't-mid t-sm t-dim' }, 'Họp tuần, fix bug spec'));
      
      svg.appendChild(s('line', { x1: 345, y1: 77, x2: 410, y2: 77, class: 's-accent', 'stroke-width': 2, 'stroke-dasharray': '4,4' }));
      svg.appendChild(s('circle', { cx: 377, cy: 77, r: 4, class: 'f-accent' }));

      var nRect2 = s('rect', { x: 410, y: 40, width: 130, height: 75, rx: 8, class: 'f-surface2 s-violet s-w2' });
      svg.appendChild(nRect2);
      svg.appendChild(s('text', { x: 475, y: 75, 'text-anchor': 'middle', class: 'lbl-strong t-mid' }, '6. Launch Day'));
      svg.appendChild(s('text', { x: 475, y: 91, 'text-anchor': 'middle', class: 't-mid t-sm t-dim' }, 'War room & PR release'));
      
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
      label: 'Số lượng đối tác Beta tham gia đồng thời',
      min: 1,
      max: 15,
      step: 1,
      value: 5,
      format: function(v) { return fmtBig(v) + ' partners'; },
      onInput: function(v) {
        var isHigh = v > 11.25;
        st2.update(fmtBig(v) + ' partners', isHigh ? 'warn' : 'ok');
        if (typeof nodeCpuMeter !== 'undefined') {
          var w = Math.min(108, Math.max(20, Math.floor((v / 15) * 108)));
          nodeCpuMeter.setAttribute('width', w);
          nodeCpuMeter.setAttribute('class', isHigh ? 'f-bad' : 'f-accent');
        }
        if (typeof logEl !== 'undefined' && logEl.add) {
          logEl.add('Điều chỉnh Số lượng đối tác Beta tham gia đồng thời: ' + fmtBig(v) + ' partners', isHigh ? 'warn' : 't');
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


  widget('ch16-w3', function(root) {
    clear(root);

    // 1. Metric Stats Cards
    var statsWrap = h('div', { class: 'stats' });
    var st1 = stat('Active Tokens Created', '1,250', 'ok');
    var st2 = stat('Community Reach', '15,000+', 'accent');
    var st3 = stat('Support Deflection', '82%', 'ok');
    statsWrap.append(st1, st2, st3);

    // 2. Interactive SVG Visualization Canvas
    var vizWrap = h('div', { class: 'viz' });
    var svg = s('svg', { viewBox: '0 0 560 170', role: 'img', 'aria-label': 'Mô phỏng Lan tỏa Cộng đồng (Broad Program Scaling)' });

      var nRect0 = s('rect', { x: 20, y: 40, width: 130, height: 75, rx: 8, class: 'f-surface2 s-accent s-w2' });
      svg.appendChild(nRect0);
      svg.appendChild(s('text', { x: 85, y: 75, 'text-anchor': 'middle', class: 'lbl-strong t-mid' }, 'Community Managers'));
      svg.appendChild(s('text', { x: 85, y: 91, 'text-anchor': 'middle', class: 't-mid t-sm t-dim' }, '1-3 full-time leads'));
      
      svg.appendChild(s('line', { x1: 150, y1: 77, x2: 215, y2: 77, class: 's-accent', 'stroke-width': 2, 'stroke-dasharray': '4,4' }));
      svg.appendChild(s('circle', { cx: 182, cy: 77, r: 4, class: 'f-accent' }));

      var nRect1 = s('rect', { x: 215, y: 40, width: 130, height: 75, rx: 8, class: 'f-surface2 s-ok s-w2' });
      svg.appendChild(nRect1);
      svg.appendChild(s('text', { x: 280, y: 75, 'text-anchor': 'middle', class: 'lbl-strong t-mid' }, 'GDG / Meetups'));
      svg.appendChild(s('text', { x: 280, y: 91, 'text-anchor': 'middle', class: 't-mid t-sm t-dim' }, 'Monthly cadence'));
      
      svg.appendChild(s('line', { x1: 345, y1: 77, x2: 410, y2: 77, class: 's-accent', 'stroke-width': 2, 'stroke-dasharray': '4,4' }));
      svg.appendChild(s('circle', { cx: 377, cy: 77, r: 4, class: 'f-accent' }));

      var nRect2 = s('rect', { x: 410, y: 40, width: 130, height: 75, rx: 8, class: 'f-surface2 s-violet s-w2' });
      svg.appendChild(nRect2);
      svg.appendChild(s('text', { x: 475, y: 75, 'text-anchor': 'middle', class: 'lbl-strong t-mid' }, 'API Developer Portal'));
      svg.appendChild(s('text', { x: 475, y: 91, 'text-anchor': 'middle', class: 't-mid t-sm t-dim' }, 'Self-serve platform'));
      
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
      label: 'Số lượng Sự kiện / Hackathon tổ chức mỗi quý',
      min: 1,
      max: 20,
      step: 1,
      value: 5,
      format: function(v) { return fmtBig(v) + ' events'; },
      onInput: function(v) {
        var isHigh = v > 15;
        st2.update(fmtBig(v) + ' events', isHigh ? 'warn' : 'ok');
        if (typeof nodeCpuMeter !== 'undefined') {
          var w = Math.min(108, Math.max(20, Math.floor((v / 20) * 108)));
          nodeCpuMeter.setAttribute('width', w);
          nodeCpuMeter.setAttribute('class', isHigh ? 'f-bad' : 'f-accent');
        }
        if (typeof logEl !== 'undefined' && logEl.add) {
          logEl.add('Điều chỉnh Số lượng Sự kiện / Hackathon tổ chức mỗi quý: ' + fmtBig(v) + ' events', isHigh ? 'warn' : 't');
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
    { key: 'developer-programs', term: 'Developer Programs', vi: 'Chương trình Nhà phát triển', def: 'Các hoạt động và sáng kiến có cấu trúc giúp thúc đẩy lập trình viên ở mọi quy mô xây dựng giải pháp và tích hợp với API của nền tảng.' },
    { key: 'deep-developer-audience', term: 'Deep Developer Audience', vi: 'Khán giả Nhà phát triển Chiều sâu', def: 'Nhóm đối tác hoặc khách hàng lớn hàng đầu sử dụng API với tác động lớn đến hệ sinh thái nhưng đòi hỏi mức độ hỗ trợ cao (high-touch).' },
    { key: 'broad-developer-audience', term: 'Broad Developer Audience', vi: 'Khán giả Nhà phát triển Chiều rộng', def: 'Nhóm doanh nghiệp vừa và nhỏ, lập trình viên độc lập, học sinh sinh viên xây dựng trên API với tiềm năng cộng hưởng kinh doanh khổng lồ.' },
    { key: 'beta-program', term: 'Beta Program', vi: 'Chương trình Beta', def: 'Chương trình hợp tác với các đối tác hàng đầu nhằm thử nghiệm, thu thập phản hồi và đồng hành ra mắt các tính năng API mới.' },
    { key: 'design-sprint', term: 'Design Sprint', vi: 'Sprint Thiết kế', def: 'Quy trình cấu trúc từ vài giờ đến vài ngày để giải quyết các câu hỏi sản phẩm quan trọng thông qua thiết kế, tạo mẫu và kiểm thử với nhà phát triển.' },
    { key: 'ambassador-program', term: 'Ambassador / Expert Program', vi: 'Chương trình Đại sứ / Chuyên gia', def: 'Chương trình liên kết với các thành viên xuất sắc nhất trong cộng đồng lập trình viên để họ trở thành đại sứ lan tỏa công nghệ (như Google Developers Experts).' }
  ]);
})();