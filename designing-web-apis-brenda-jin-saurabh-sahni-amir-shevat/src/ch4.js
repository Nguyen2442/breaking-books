(function() {
  'use strict';
  const { h, s, clear, fmt, fmtBig, fmtMs, pct, rng, clamp, sleep, slider, seg, button, checkbox, stat, log, widget, glossary } = window.DDIA;


  widget('ch4-w1', function(root) {
    clear(root);

    // 1. Metric Stats Cards
    var statsWrap = h('div', { class: 'stats' });
    var st1 = stat('Latency P99', '45ms', 'ok');
    var st2 = stat('Throughput', '1,450 req/s', 'accent');
    var st3 = stat('Availability', '99.95%', 'ok');
    statsWrap.append(st1, st2, st3);

    // 2. Interactive SVG Visualization Canvas
    var vizWrap = h('div', { class: 'viz' });
    var svg = s('svg', { viewBox: '0 0 560 170', role: 'img', 'aria-label': 'Mô phỏng Hiệu năng Truyền tải giữa REST, RPC và GraphQL' });

      var nRect0 = s('rect', { x: 20, y: 40, width: 130, height: 75, rx: 8, class: 'f-surface2 s-accent s-w2' });
      svg.appendChild(nRect0);
      svg.appendChild(s('text', { x: 85, y: 75, 'text-anchor': 'middle', class: 'lbl-strong t-mid' }, 'Mobile Client'));
      svg.appendChild(s('text', { x: 85, y: 91, 'text-anchor': 'middle', class: 't-mid t-sm t-dim' }, 'Gửi truy vấn'));
      
      svg.appendChild(s('line', { x1: 150, y1: 77, x2: 215, y2: 77, class: 's-accent', 'stroke-width': 2, 'stroke-dasharray': '4,4' }));
      svg.appendChild(s('circle', { cx: 182, cy: 77, r: 4, class: 'f-accent' }));

      var nRect1 = s('rect', { x: 215, y: 40, width: 130, height: 75, rx: 8, class: 'f-surface2 s-ok s-w2' });
      svg.appendChild(nRect1);
      svg.appendChild(s('text', { x: 280, y: 75, 'text-anchor': 'middle', class: 'lbl-strong t-mid' }, 'API Gateway'));
      svg.appendChild(s('text', { x: 280, y: 91, 'text-anchor': 'middle', class: 't-mid t-sm t-dim' }, 'Phân phối & Parse'));
      
      svg.appendChild(s('line', { x1: 345, y1: 77, x2: 410, y2: 77, class: 's-accent', 'stroke-width': 2, 'stroke-dasharray': '4,4' }));
      svg.appendChild(s('circle', { cx: 377, cy: 77, r: 4, class: 'f-accent' }));

      var nRect2 = s('rect', { x: 410, y: 40, width: 130, height: 75, rx: 8, class: 'f-surface2 s-violet s-w2' });
      svg.appendChild(nRect2);
      svg.appendChild(s('text', { x: 475, y: 75, 'text-anchor': 'middle', class: 'lbl-strong t-mid' }, 'Backend Services'));
      svg.appendChild(s('text', { x: 475, y: 91, 'text-anchor': 'middle', class: 't-mid t-sm t-dim' }, 'Xử lý dữ liệu'));
      
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
      label: 'Lưu lượng truy cập đồng thời',
      min: 100,
      max: 5000,
      step: 100,
      value: 1500,
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
          logEl.add('Điều chỉnh Lưu lượng truy cập đồng thời: ' + fmtBig(v) + ' req/s', isHigh ? 'warn' : 't');
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


  widget('ch4-w2', function(root) {
    clear(root);

    // 1. Metric Stats Cards
    var statsWrap = h('div', { class: 'stats' });
    var st1 = stat('Active Connections', '15,000', 'ok');
    var st2 = stat('Bandwidth Usage', '1.2 MB/s', 'accent');
    var st3 = stat('Event Latency', '12ms', 'ok');
    statsWrap.append(st1, st2, st3);

    // 2. Interactive SVG Visualization Canvas
    var vizWrap = h('div', { class: 'viz' });
    var svg = s('svg', { viewBox: '0 0 560 170', role: 'img', 'aria-label': 'Mô phỏng Kênh Thời gian thực: Polling vs WebHooks vs WebSockets' });

    // Node Host Frame
    svg.appendChild(s('rect', { x: 20, y: 15, width: 520, height: 145, rx: 12, class: 'f-surface s-dim s-w2' }));
    svg.appendChild(s('text', { x: 35, y: 34, class: 'lbl-strong t-mid' }, '🖥️ Worker Node (4 Cores CPU · 8 GB RAM)'));

    // Node Resource Meters (Top Right)
    svg.appendChild(s('text', { x: 350, y: 34, class: 't-mid t-xs t-dim' }, 'Node CPU:'));
    var nodeCpuMeter = s('rect', { x: 410, y: 24, width: 95, height: 11, rx: 4, class: 'f-accent' });
    svg.appendChild(s('rect', { x: 410, y: 24, width: 110, height: 11, rx: 4, class: 'f-surface2 s-dim', 'stroke-width': 1 }));
    svg.appendChild(nodeCpuMeter);

    // cgroups Boundary Wall
    var cgroupWall = s('line', { x1: 275, y1: 45, x2: 275, y2: 150, class: 's-dim', 'stroke-width': 2, 'stroke-dasharray': '4,4' });
    svg.appendChild(cgroupWall);

    // Left Container: Main Web API Pod
    var mainPodBox = s('rect', { x: 35, y: 50, width: 225, height: 98, rx: 8, class: 'f-surface2 s-ok s-w2' });
    svg.appendChild(mainPodBox);
    svg.appendChild(s('text', { x: 48, y: 72, class: 'lbl-strong t-mid' }, '🚀 Web API Container (Chính)'));
    var mainStatusTag = s('text', { x: 48, y: 92, class: 't-mid t-xs', fill: 'var(--ok)' }, 'Trạng thái: Ổn định (P99: 18ms)');
    svg.appendChild(mainStatusTag);

    svg.appendChild(s('text', { x: 48, y: 112, class: 't-mid t-xs t-dim' }, 'CPU:'));
    var mainCpuBar = s('rect', { x: 80, y: 104, width: 75, height: 9, rx: 3, class: 'f-ok' });
    svg.appendChild(s('rect', { x: 80, y: 104, width: 130, height: 9, rx: 3, class: 'f-surface', 'stroke-width': 1 }));
    svg.appendChild(mainCpuBar);

    var mainQoS = s('text', { x: 48, y: 134, class: 't-mid t-xs t-dim' }, 'QoS: Guaranteed (2.0 Cores)');
    svg.appendChild(mainQoS);

    // Right Container: Background Batch Worker
    var workerPodBox = s('rect', { x: 290, y: 50, width: 235, height: 98, rx: 8, class: 'f-surface2 s-accent s-w2' });
    svg.appendChild(workerPodBox);
    svg.appendChild(s('text', { x: 305, y: 72, class: 'lbl-strong t-mid' }, '⚙️ Worker Batch (Tác vụ nền)'));
    var workerStatusTag = s('text', { x: 305, y: 92, class: 't-mid t-xs', fill: 'var(--accent)' }, 'Trạng thái: Chờ tác vụ');
    svg.appendChild(workerStatusTag);

    svg.appendChild(s('text', { x: 305, y: 112, class: 't-mid t-xs t-dim' }, 'CPU:'));
    var workerCpuBar = s('rect', { x: 340, y: 104, width: 40, height: 9, rx: 3, class: 'f-accent' });
    svg.appendChild(s('rect', { x: 340, y: 104, width: 140, height: 9, rx: 3, class: 'f-surface', 'stroke-width': 1 }));
    svg.appendChild(workerCpuBar);

    var workerLimitTag = s('text', { x: 305, y: 134, class: 't-mid t-xs t-dim' }, 'Limit: Chưa cấu hình (0đ)');
    svg.appendChild(workerLimitTag);
      
    vizWrap.appendChild(svg);

    // 3. Scenario Engine & Pedagogical Explanation Card

    var scenarios = [
      {
        label: '🔴 1. Không giới hạn (No Limits)',
        title: 'Kịch bản 1: Tranh chấp CPU & Hiện tượng Noisy Neighbor',
        obs: 'Worker bão tải ngốn sạch 3.2 Cores CPU còn lại trên Node. Web App bị bỏ đói CPU (CPU Starvation), P99 vọt lên 1,450ms, request người dùng bị timeout.',
        mechanism: 'Khi không đặt limits, Linux kernel phân bổ CPU tự do theo CFS shares. Một tiến trình nền chạy vô hạn vòng lặp sẽ chiếm dụng toàn bộ tài nguyên rảnh rỗi trên cùng Node.',
        takeaway: 'Bài học: Trong môi trường Microservices/K8s đa người thuê (multi-tenant), không bao giờ để container chạy mà thiếu cấu hình resources.limits.',
        stat1: '1,450ms (Timeout)', tone1: 'bad',
        stat2: '98% (Bão tải)', tone2: 'bad',
        stat3: 'Nghẽn nghiêm trọng', tone3: 'bad',
        apply: function() {
          nodeCpuMeter.setAttribute('width', 108);
          nodeCpuMeter.setAttribute('class', 'f-bad');
          cgroupWall.setAttribute('class', 's-dim');
          mainPodBox.setAttribute('class', 'f-surface2 s-bad s-w2');
          mainStatusTag.textContent = 'Trạng thái: CPU Starvation (Lag)';
          mainStatusTag.setAttribute('fill', 'var(--bad)');
          mainCpuBar.setAttribute('width', 25);
          mainCpuBar.setAttribute('class', 'f-bad');
          workerPodBox.setAttribute('class', 'f-surface2 s-bad s-w2');
          workerStatusTag.textContent = 'Trạng thái: Độc chiếm CPU Node';
          workerStatusTag.setAttribute('fill', 'var(--bad)');
          workerCpuBar.setAttribute('width', 138);
          workerCpuBar.setAttribute('class', 'f-bad');
          workerLimitTag.textContent = 'Limit: Không có (Chiếm 3.2 Cores)';
        }
      },
      {
        label: '🟢 2. Bật cgroups CPU Limit',
        title: 'Kịch bản 2: Cô lập Tài nguyên với Linux cgroups & Throttling',
        obs: 'Worker bị bóp xung nhịp (Throttling) ở trần 1.0 Core. Web App giữ trọn 2.0 Cores, độ trễ hạ về 18ms hoàn toàn bình thường.',
        mechanism: 'Linux Completely Fair Scheduler (CFS) cgroup giới hạn hạn ngạch CPU time-slice (cpu.cfs_quota_us). Tác vụ nền chạy chậm lại nhưng SLA phản hồi của Web App được bảo đảm 100%.',
        takeaway: 'Bài học: Cấu hình resources.requests để cam kết sàn tài nguyên và resources.limits để chặn trần lấn chiếm.',
        stat1: '18ms (Mượt mà)', tone1: 'ok',
        stat2: '65% (Tối ưu)', tone2: 'ok',
        stat3: 'Đã cô lập (cgroups)', tone3: 'ok',
        apply: function() {
          nodeCpuMeter.setAttribute('width', 65);
          nodeCpuMeter.setAttribute('class', 'f-ok');
          cgroupWall.setAttribute('class', 's-ok');
          cgroupWall.setAttribute('stroke-width', '3');
          mainPodBox.setAttribute('class', 'f-surface2 s-ok s-w2');
          mainStatusTag.textContent = 'Trạng thái: Ổn định (P99: 18ms)';
          mainStatusTag.setAttribute('fill', 'var(--ok)');
          mainCpuBar.setAttribute('width', 75);
          mainCpuBar.setAttribute('class', 'f-ok');
          workerPodBox.setAttribute('class', 'f-surface2 s-accent s-w2');
          workerStatusTag.textContent = 'Trạng thái: Throttled (1.0 Core)';
          workerStatusTag.setAttribute('fill', 'var(--accent)');
          workerCpuBar.setAttribute('width', 45);
          workerCpuBar.setAttribute('class', 'f-accent');
          workerLimitTag.textContent = 'Limit: 1.0 Core CPU (cgroups)';
        }
      },
      {
        label: '⚠️ 3. Thử nghiệm Rò rỉ RAM (OOM)',
        title: 'Kịch bản 3: Xử lý Vượt trần Bộ nhớ với OOM-Killer',
        obs: 'Worker rò rỉ RAM vượt trần 2GB. Kernel OOM-Killer lập tức tiêu diệt (Exit 137) Worker và K8s tái sinh container mới. Web App không hề gián đoạn.',
        mechanism: 'Khi container vượt memory limit, cgroup subsystem gửi tín hiệu SIGKILL CHỈ đến cgroup vi phạm. Cơ chế này cô lập hoàn toàn sự cố và bảo vệ Node không sập diện rộng.',
        takeaway: 'Bài học: Memory limit không thể throttle như CPU; khi chạm trần container sẽ bị Kill. Cần giám sát alert sớm chỉ số memory working set.',
        stat1: '18ms (Bình an)', tone1: 'ok',
        stat2: '48% (Bình thường)', tone2: 'ok',
        stat3: 'OOMKilled (Exit 137)', tone3: 'warn',
        apply: function() {
          nodeCpuMeter.setAttribute('width', 50);
          nodeCpuMeter.setAttribute('class', 'f-ok');
          cgroupWall.setAttribute('class', 's-accent');
          mainPodBox.setAttribute('class', 'f-surface2 s-ok s-w2');
          mainStatusTag.textContent = 'Trạng thái: Ổn định (Không ảnh hưởng)';
          mainStatusTag.setAttribute('fill', 'var(--ok)');
          mainCpuBar.setAttribute('width', 75);
          mainCpuBar.setAttribute('class', 'f-ok');
          workerPodBox.setAttribute('class', 'f-surface2 s-warn s-w2');
          workerStatusTag.textContent = 'Trạng thái: OOMKilled (Tự hồi sinh)';
          workerStatusTag.setAttribute('fill', 'var(--warn)');
          workerCpuBar.setAttribute('width', 5);
          workerCpuBar.setAttribute('class', 'f-warn');
          workerLimitTag.textContent = 'Memory: Vượt 2GB -> Exit 137';
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
      label: 'Số lượng kết nối đồng thời',
      min: 1000,
      max: 50000,
      step: 1000,
      value: 15000,
      format: function(v) { return fmtBig(v) + ' clients'; },
      onInput: function(v) {
        var isHigh = v > 37500;
        st2.update(fmtBig(v) + ' clients', isHigh ? 'warn' : 'ok');
        if (typeof nodeCpuMeter !== 'undefined') {
          var w = Math.min(108, Math.max(20, Math.floor((v / 50000) * 108)));
          nodeCpuMeter.setAttribute('width', w);
          nodeCpuMeter.setAttribute('class', isHigh ? 'f-bad' : 'f-accent');
        }
        if (typeof logEl !== 'undefined' && logEl.add) {
          logEl.add('Điều chỉnh Số lượng kết nối đồng thời: ' + fmtBig(v) + ' clients', isHigh ? 'warn' : 't');
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
    { key: 'request-response-api', term: 'Request-Response API', vi: 'API Yêu cầu - Phản hồi', def: 'Mô hình giao tiếp đồng bộ nơi client gửi HTTP request tới endpoint và nhận về HTTP response chứa JSON hoặc XML.' },
    { key: 'rest', term: 'Representational State Transfer (REST)', vi: 'Chuyển đổi trạng thái biểu diễn', def: 'Trường phái API tập trung vào tài nguyên (resources), sử dụng danh từ trong URL và các HTTP methods chuẩn cho CRUD.' },
    { key: 'rpc', term: 'Remote Procedure Call (RPC)', vi: 'Gọi thủ tục từ xa', def: 'Trường phái API tập trung vào hành động (actions), nơi client truyền tên phương thức và tham số tới server.' },
    { key: 'graphql', term: 'GraphQL', vi: 'Ngôn ngữ truy vấn GraphQL', def: 'Ngôn ngữ truy vấn API do Facebook phát triển cho phép client định nghĩa chính xác cấu trúc dữ liệu trả về.' },
    { key: 'polling', term: 'Polling', vi: 'Thăm dò định kỳ', def: 'Kỹ thuật client liên tục gọi API ở một tần số cố định để kiểm tra dữ liệu mới, gây lãng phí tài nguyên mạng.' },
    { key: 'webhook', term: 'WebHook', vi: 'Cổng thông tin sự kiện HTTP', def: 'Cơ chế thông báo sự kiện thời gian thực bằng cách server chủ động gửi HTTP POST tới URL của client.' },
    { key: 'websocket', term: 'WebSocket', vi: 'Giao thức WebSocket', def: 'Giao thức thiết lập kênh truyền thông streaming song công toàn phần (full-duplex) qua một kết nối TCP duy nhất.' }
  ]);
})();