(function() {
  'use strict';
  const { h, s, clear, fmt, fmtBig, fmtMs, pct, rng, clamp, sleep, slider, seg, button, checkbox, stat, log, widget, glossary } = window.DDIA;


  widget('ch18-w1', function(root) {
    clear(root);

    // 1. Metric Stats Cards
    var statsWrap = h('div', { class: 'stats' });
    var st1 = stat('Latency P99', '24ms', 'ok');
    var st2 = stat('Throughput', '9,850 req/s', 'ok');
    var st3 = stat('Availability', '99.99%', 'accent');
    statsWrap.append(st1, st2, st3);

    // 2. Interactive SVG Visualization Canvas
    var vizWrap = h('div', { class: 'viz' });
    var svg = s('svg', { viewBox: '0 0 560 170', role: 'img', 'aria-label': 'Mô phỏng cân bằng Lực lượng (Forces Balance)' });

      var nRect0 = s('rect', { x: 20, y: 40, width: 130, height: 75, rx: 8, class: 'f-surface2 s-accent s-w2' });
      svg.appendChild(nRect0);
      svg.appendChild(s('text', { x: 85, y: 75, 'text-anchor': 'middle', class: 'lbl-strong t-mid' }, 'API Gateway'));
      svg.appendChild(s('text', { x: 85, y: 91, 'text-anchor': 'middle', class: 't-mid t-sm t-dim' }, 'Nhận request'));
      
      svg.appendChild(s('line', { x1: 150, y1: 77, x2: 215, y2: 77, class: 's-accent', 'stroke-width': 2, 'stroke-dasharray': '4,4' }));
      svg.appendChild(s('circle', { cx: 182, cy: 77, r: 4, class: 'f-accent' }));

      var nRect1 = s('rect', { x: 215, y: 40, width: 130, height: 75, rx: 8, class: 'f-surface2 s-ok s-w2' });
      svg.appendChild(nRect1);
      svg.appendChild(s('text', { x: 280, y: 75, 'text-anchor': 'middle', class: 'lbl-strong t-mid' }, 'Pattern Layer'));
      svg.appendChild(s('text', { x: 280, y: 91, 'text-anchor': 'middle', class: 't-mid t-sm t-dim' }, 'Xử lý logic'));
      
      svg.appendChild(s('line', { x1: 345, y1: 77, x2: 410, y2: 77, class: 's-accent', 'stroke-width': 2, 'stroke-dasharray': '4,4' }));
      svg.appendChild(s('circle', { cx: 377, cy: 77, r: 4, class: 'f-accent' }));

      var nRect2 = s('rect', { x: 410, y: 40, width: 130, height: 75, rx: 8, class: 'f-surface2 s-violet s-w2' });
      svg.appendChild(nRect2);
      svg.appendChild(s('text', { x: 475, y: 75, 'text-anchor': 'middle', class: 'lbl-strong t-mid' }, 'Storage Engine'));
      svg.appendChild(s('text', { x: 475, y: 91, 'text-anchor': 'middle', class: 't-mid t-sm t-dim' }, 'Lưu trữ bền vững'));
      
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
      label: 'Tải lượng đồng thời (Req/s)',
      min: 100,
      max: 10000,
      step: 200,
      value: 2500,
      format: function(v) { return fmtBig(v) + ' req/s'; },
      onInput: function(v) {
        var isHigh = v > 7500;
        st2.update(fmtBig(v) + ' req/s', isHigh ? 'warn' : 'ok');
        if (typeof nodeCpuMeter !== 'undefined') {
          var w = Math.min(108, Math.max(20, Math.floor((v / 10000) * 108)));
          nodeCpuMeter.setAttribute('width', w);
          nodeCpuMeter.setAttribute('class', isHigh ? 'f-bad' : 'f-accent');
        }
        if (typeof logEl !== 'undefined' && logEl.add) {
          logEl.add('Điều chỉnh Tải lượng đồng thời (Req/s): ' + fmtBig(v) + ' req/s', isHigh ? 'warn' : 't');
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


  widget('ch18-w2', function(root) {
    clear(root);

    // 1. Metric Stats Cards
    var statsWrap = h('div', { class: 'stats' });
    var st1 = stat('Design Clarity', '95%', 'ok');
    var st2 = stat('Coupling Level', 'Low', 'ok');
    var st3 = stat('Maintainability', 'High', 'accent');
    statsWrap.append(st1, st2, st3);

    // 2. Interactive SVG Visualization Canvas
    var vizWrap = h('div', { class: 'viz' });
    var svg = s('svg', { viewBox: '0 0 680 260', role: 'img', 'aria-label': 'Cây quyết định lựa chọn Nhóm Pattern' });

    // Background Subtle Guide Frame
    svg.appendChild(s('rect', { x: 10, y: 8, width: 660, height: 244, rx: 16, class: 'f-surface s-dim', 'stroke-width': 1, 'stroke-dasharray': '4,4' }));

    // Radiating Mind Map Bezier Curves
    var bCurve0 = s('path', { d: 'M 195 125 C 240 125, 240 37, 275 37', fill: 'none', class: 'mind-curve s-accent', 'stroke-width': 2.5 });
    var bCurve1 = s('path', { d: 'M 195 125 C 240 125, 240 95, 275 95', fill: 'none', class: 'mind-curve s-ok', 'stroke-width': 2.5 });
    var bCurve2 = s('path', { d: 'M 195 125 C 240 125, 240 153, 275 153', fill: 'none', class: 'mind-curve s-warn', 'stroke-width': 2.5 });
    var bCurve3 = s('path', { d: 'M 195 125 C 240 125, 240 211, 275 211', fill: 'none', class: 'mind-curve s-accent', 'stroke-width': 2.5 });
    svg.append(bCurve0, bCurve1, bCurve2, bCurve3);

    // Sub-leaf Connecting Lines
    svg.appendChild(s('line', { x1: 465, y1: 37, x2: 488, y2: 37, class: 's-dim', 'stroke-width': 1.5 }));
    svg.appendChild(s('line', { x1: 465, y1: 95, x2: 488, y2: 95, class: 's-dim', 'stroke-width': 1.5 }));
    svg.appendChild(s('line', { x1: 465, y1: 153, x2: 488, y2: 153, class: 's-dim', 'stroke-width': 1.5 }));
    svg.appendChild(s('line', { x1: 465, y1: 211, x2: 488, y2: 211, class: 's-dim', 'stroke-width': 1.5 }));

    // Center Core Root Node
    var rootNode = s('rect', { x: 25, y: 96, width: 170, height: 58, rx: 14, class: 'mind-node f-surface2 s-accent s-w2' });
    svg.appendChild(rootNode);
    svg.appendChild(s('text', { x: 110, y: 122, 'text-anchor': 'middle', class: 'lbl-strong t-mid' }, '🧠 Phân loại Pattern'));
    svg.appendChild(s('text', { x: 110, y: 140, 'text-anchor': 'middle', class: 't-mid t-xs t-dim' }, 'Tâm điểm Luận đề'));
    rootNode.addEventListener('click', function() { selectScenario(0); });

    // Branch 0: Tiền đề & Bối cảnh
    var nRect0 = s('rect', { x: 275, y: 17, width: 190, height: 40, rx: 8, class: 'mind-node f-surface2 s-accent s-w2' });
    svg.appendChild(nRect0);
    svg.appendChild(s('text', { x: 285, y: 34, class: 'lbl-strong t-mid t-sm' }, '🌿 1. Bài toán hệ thống'));
    svg.appendChild(s('text', { x: 285, y: 49, class: 't-mid t-xs t-dim' }, 'Xác định điểm nghẽn'));
    nRect0.addEventListener('click', function() { selectScenario(0); });

    var leaf0 = s('rect', { x: 488, y: 21, width: 172, height: 32, rx: 6, class: 'mind-leaf f-surface s-dim', 'stroke-width': 1 });
    svg.appendChild(leaf0);
    svg.appendChild(s('text', { x: 498, y: 41, class: 't-mid t-xs' }, 'Cội nguồn & Tiên đề'));
    leaf0.addEventListener('click', function() { selectScenario(0); });

    // Branch 1: Luận điểm Cốt lõi
    var nRect1 = s('rect', { x: 275, y: 75, width: 190, height: 40, rx: 8, class: 'mind-node f-surface2 s-ok s-w2' });
    svg.appendChild(nRect1);
    svg.appendChild(s('text', { x: 285, y: 92, class: 'lbl-strong t-mid t-sm' }, '⚡ 2. Phân tích Mục đích'));
    svg.appendChild(s('text', { x: 285, y: 107, class: 't-mid t-xs t-dim' }, 'Khởi tạo / Cấu trúc '));
    nRect1.addEventListener('click', function() { selectScenario(1); });

    var leaf1 = s('rect', { x: 488, y: 79, width: 172, height: 32, rx: 6, class: 'mind-leaf f-surface s-dim', 'stroke-width': 1 });
    svg.appendChild(leaf1);
    svg.appendChild(s('text', { x: 498, y: 99, class: 't-mid t-xs' }, 'Quy luật & Cơ chế'));
    leaf1.addEventListener('click', function() { selectScenario(1); });

    // Branch 2: Phản biện & Đánh đổi
    var nRect2 = s('rect', { x: 275, y: 133, width: 190, height: 40, rx: 8, class: 'mind-node f-surface2 s-warn s-w2' });
    svg.appendChild(nRect2);
    svg.appendChild(s('text', { x: 285, y: 150, class: 'lbl-strong t-mid t-sm' }, '⚖️ 3. Lựa chọn Pattern'));
    svg.appendChild(s('text', { x: 285, y: 165, class: 't-mid t-xs t-dim' }, 'Triển khai mã nguồn'));
    nRect2.addEventListener('click', function() { selectScenario(2); });

    var leaf2 = s('rect', { x: 488, y: 137, width: 172, height: 32, rx: 6, class: 'mind-leaf f-surface s-dim', 'stroke-width': 1 });
    svg.appendChild(leaf2);
    svg.appendChild(s('text', { x: 498, y: 157, class: 't-mid t-xs' }, 'Giới hạn & Điểm mù'));
    leaf2.addEventListener('click', function() { selectScenario(2); });

    // Branch 3: Ứng dụng Thực tiễn
    var nRect3 = s('rect', { x: 275, y: 191, width: 190, height: 40, rx: 8, class: 'mind-node f-surface2 s-accent s-w2' });
    svg.appendChild(nRect3);
    svg.appendChild(s('text', { x: 285, y: 208, class: 'lbl-strong t-mid t-sm' }, '🎯 4. Ứng dụng Thực tiễn'));
    svg.appendChild(s('text', { x: 285, y: 223, class: 't-mid t-xs t-dim' }, 'Hành động & Chuyển g'));
    nRect3.addEventListener('click', function() { selectScenario(3); });

    var leaf3 = s('rect', { x: 488, y: 195, width: 172, height: 32, rx: 6, class: 'mind-leaf f-surface s-dim', 'stroke-width': 1 });
    svg.appendChild(leaf3);
    svg.appendChild(s('text', { x: 498, y: 215, class: 't-mid t-xs' }, 'Thói quen & Chuyển giao'));
    leaf3.addEventListener('click', function() { selectScenario(3); });
      
    vizWrap.appendChild(svg);

    // 3. Scenario Engine & Pedagogical Explanation Card

    var scenarios = [
      {
        label: '🌿 1. Tiền đề: Bài toán hệ thống',
        title: 'Trụ cột 1: Tiền đề Tri thức & Bối cảnh Khởi sinh',
        obs: 'Khảo sát nền tảng lịch sử và các giả định ngầm cấu thành nên luận đề.',
        mechanism: 'Mọi luận điểm triết học hay tâm lý học đều không ra đời trong chân không; nó phản ánh nỗ lực giải quyết một mâu thuẫn nhận thức hoặc xung đột xã hội cụ thể.',
        takeaway: 'Bài học cốt lõi: Để thấu hiểu một học thuyết, trước tiên cần nắm rõ bối cảnh và điều kiện tiên quyết mà tác giả đặt ra.',
        stat1: 'Tiên đề', tone1: 'accent',
        stat2: 'Bối cảnh vững', tone2: 'ok',
        stat3: 'Nền tảng', tone3: 'ok',
        apply: function() {
          nRect0.setAttribute('class', 'mind-node f-accent-soft s-accent s-w2');
          nRect1.setAttribute('class', 'mind-node f-surface2 s-dim');
          nRect2.setAttribute('class', 'mind-node f-surface2 s-dim');
          nRect3.setAttribute('class', 'mind-node f-surface2 s-dim');
          bCurve0.setAttribute('class', 'mind-curve s-accent');
          bCurve1.setAttribute('class', 'mind-curve s-dim');
          bCurve2.setAttribute('class', 'mind-curve s-dim');
          bCurve3.setAttribute('class', 'mind-curve s-dim');
        }
      },
      {
        label: '⚡ 2. Luận điểm: Phân tích Mục đích',
        title: 'Trụ cột 2: Luận điểm Trung tâm & Quy luật Vận hành',
        obs: 'Làm sáng tỏ nguyên lý đệ nhất và quy luật logic chi phối toàn bộ chương sách.',
        mechanism: 'Quy luật đệ nhất (First Principles): Khi lược bỏ mọi định kiến và phân tích vấn đề về các chân lý căn bản nhất, chúng ta giải phóng tư duy khỏi lối mòn sao chép.',
        takeaway: 'Bài học cốt lõi: Nắm vững quy luật cốt lõi giúp bạn tự suy luận và ứng biến trong mọi bối cảnh phức tạp mới.',
        stat1: 'Hạt nhân', tone1: 'ok',
        stat2: 'Quy luật gốc', tone2: 'ok',
        stat3: 'Đã xác lập', tone3: 'ok',
        apply: function() {
          nRect0.setAttribute('class', 'mind-node f-surface2 s-dim');
          nRect1.setAttribute('class', 'mind-node f-ok-soft s-ok s-w2');
          nRect2.setAttribute('class', 'mind-node f-surface2 s-dim');
          nRect3.setAttribute('class', 'mind-node f-surface2 s-dim');
          bCurve0.setAttribute('class', 'mind-curve s-dim');
          bCurve1.setAttribute('class', 'mind-curve s-ok');
          bCurve2.setAttribute('class', 'mind-curve s-dim');
          bCurve3.setAttribute('class', 'mind-curve s-dim');
        }
      },
      {
        label: '⚖️ 3. Phản biện: Lựa chọn Pattern',
        title: 'Trụ cột 3: Biện chứng Phản đề & Đánh đổi Thực tế',
        obs: 'Kiểm tra giới hạn áp dụng, chi phí cơ hội và các điểm mù nhận thức.',
        mechanism: 'Tư duy phản biện (Critical Thinking): Bất kỳ giải pháp hay tư tưởng nào cũng có cái giá phải trả và vùng giới hạn hiệu lực. Nhận thức rõ đánh đổi giúp tránh bẫy cuồng tín.',
        takeaway: 'Bài học cốt lõi: Luôn chủ động đặt câu hỏi: "Luận điểm này thất bại khi nào và ai chịu ảnh hưởng tiêu cực nhất?"',
        stat1: 'Phản biện', tone1: 'warn',
        stat2: 'Đánh đổi rõ', tone2: 'warn',
        stat3: 'Kiểm soát', tone3: 'ok',
        apply: function() {
          nRect0.setAttribute('class', 'mind-node f-surface2 s-dim');
          nRect1.setAttribute('class', 'mind-node f-surface2 s-dim');
          nRect2.setAttribute('class', 'mind-node f-warn-soft s-warn s-w2');
          nRect3.setAttribute('class', 'mind-node f-surface2 s-dim');
          bCurve0.setAttribute('class', 'mind-curve s-dim');
          bCurve1.setAttribute('class', 'mind-curve s-dim');
          bCurve2.setAttribute('class', 'mind-curve s-warn');
          bCurve3.setAttribute('class', 'mind-curve s-dim');
        }
      },
      {
        label: '🎯 4. Ứng dụng: Ứng dụng Thực tiễn',
        title: 'Trụ cột 4: Chuyển giao Thực nghiệm & Thói quen Vi mô',
        obs: 'Biến tư tưởng lý thuyết thành hành động cụ thể, có thể đo lường và duy trì mỗi ngày.',
        mechanism: 'Kiến trúc lựa chọn (Choice Architecture): Giảm rào cản ma sát và thiết kế môi trường kích hoạt hành vi giúp tri thức biến thành thói quen phản xạ tự nhiên.',
        takeaway: 'Bài học cốt lõi: Chia nhỏ lý thuyết thành 1 hành động nguyên tử (atomic step) có thể làm ngay trong 2 phút.',
        stat1: 'Hành động ngay', tone1: 'accent',
        stat2: 'Thực nghiệm', tone2: 'ok',
        stat3: 'Chuyển hóa', tone3: 'ok',
        apply: function() {
          nRect0.setAttribute('class', 'mind-node f-surface2 s-dim');
          nRect1.setAttribute('class', 'mind-node f-surface2 s-dim');
          nRect2.setAttribute('class', 'mind-node f-surface2 s-dim');
          nRect3.setAttribute('class', 'mind-node f-accent-soft s-accent s-w2');
          bCurve0.setAttribute('class', 'mind-curve s-dim');
          bCurve1.setAttribute('class', 'mind-curve s-dim');
          bCurve2.setAttribute('class', 'mind-curve s-dim');
          bCurve3.setAttribute('class', 'mind-curve s-accent');
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
      label: 'Lăng kính Tư duy',
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
    { key: 'design-pattern', term: 'Design Pattern', vi: 'Mẫu thiết kế', def: 'Giải pháp tổng quát tối ưu cho các bài toán thiết kế lặp đi lặp lại trong phần mềm.' },
    { key: 'forces', term: 'Forces', vi: 'Lực lượng', def: 'Sự kết hợp giữa mục tiêu cần đạt và các ràng buộc kỹ thuật chi phối giải pháp.' },
    { key: 'gof', term: 'Gang of Four (GoF)', vi: 'Nhóm bốn tác giả', def: 'Bốn tác giả (Gamma, Helm, Johnson, Vlissides) đã viết cuốn sách kinh điển về 23 mẫu thiết kế.' },
    { key: 'rule-of-three', term: 'Rule of Three', vi: 'Quy luật số ba', def: 'Nguyên tắc yêu cầu một pattern phải được áp dụng thành công ở 3 hệ thống thực tế mới được công nhận.' }
  ]);
})();