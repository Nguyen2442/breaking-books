(function() {
  'use strict';
  const { h, s, clear, fmt, fmtBig, fmtMs, pct, rng, clamp, sleep, slider, seg, button, checkbox, stat, log, widget, glossary } = window.DDIA;


  widget('ch2-w1', function(root) {
    clear(root);

    var statsWrap = h('div', { class: 'stats' });
    var stThroughput = stat('Tần suất thực thi', '1,000 op/s', 'ok');
    var stLatency = stat('Thời gian phản hồi', '12 ms', 'ok');
    var stStatus = stat('Trạng thái bộ nhớ', 'Ổn định', 'accent');
    statsWrap.append(stThroughput, stLatency, stStatus);

    var vizWrap = h('div', { class: 'viz' });
    var svg = s('svg', { viewBox: '0 0 560 160', role: 'img', 'aria-label': 'JavaScript Runtime Architecture' });

    var nRect0 = s('rect', { x: 20, y: 40, width: 130, height: 75, rx: 8, class: 'f-surface2 s-accent s-w2' });
    svg.appendChild(nRect0);
    svg.appendChild(s('text', { x: 85, y: 75, 'text-anchor': 'middle', class: 'lbl-strong t-mid' }, 'Global Scope'));
    svg.appendChild(s('text', { x: 85, y: 91, 'text-anchor': 'middle', class: 't-mid t-sm t-dim' }, 'Window Context'));
    
    svg.appendChild(s('line', { x1: 150, y1: 77, x2: 215, y2: 77, class: 's-accent', 'stroke-width': 2, 'stroke-dasharray': '4,4' }));
    svg.appendChild(s('circle', { cx: 182, cy: 77, r: 4, class: 'f-accent' }));

    var nRect1 = s('rect', { x: 215, y: 40, width: 130, height: 75, rx: 8, class: 'f-surface2 s-ok s-w2' });
    svg.appendChild(nRect1);
    svg.appendChild(s('text', { x: 280, y: 75, 'text-anchor': 'middle', class: 'lbl-strong t-mid' }, 'Lexical Env'));
    svg.appendChild(s('text', { x: 280, y: 91, 'text-anchor': 'middle', class: 't-mid t-sm t-dim' }, 'Variable Storage'));
    
    svg.appendChild(s('line', { x1: 345, y1: 77, x2: 410, y2: 77, class: 's-accent', 'stroke-width': 2, 'stroke-dasharray': '4,4' }));
    svg.appendChild(s('circle', { cx: 377, cy: 77, r: 4, class: 'f-accent' }));

    var nRect2 = s('rect', { x: 410, y: 40, width: 130, height: 75, rx: 8, class: 'f-surface2 s-warn s-w2' });
    svg.appendChild(nRect2);
    svg.appendChild(s('text', { x: 475, y: 75, 'text-anchor': 'middle', class: 'lbl-strong t-mid' }, 'Execution Stack'));
    svg.appendChild(s('text', { x: 475, y: 91, 'text-anchor': 'middle', class: 't-mid t-sm t-dim' }, 'Active Frame'));
    
    vizWrap.appendChild(svg);

    var rand = rng(122);
    var sl = slider({
      label: 'Tải lượng thực thi mã',
      min: 100,
      max: 5000,
      step: 100,
      value: 1000,
      format: function(v) { return fmtBig(v) + ' op/s'; },
      onInput: function(v) {
        var isHigh = v > 3500;
        var jitter = Math.floor(rand() * 5);
        stThroughput.update(fmtBig(v) + ' op/s', isHigh ? 'warn' : 'ok');
        stLatency.update(fmtMs(Math.max(4, Math.floor(v * 0.015 + jitter))), isHigh ? 'bad' : 'ok');
        logEl.add('Tải thực thi: ' + fmtBig(v) + ' op/s · Phản hồi: ' + fmtMs(v * 0.015 + jitter), isHigh ? 'warn' : 't');
      }
    });

    var actionBtns = [
      button('Thực thi lệnh chuẩn', function() {
        stStatus.update('Ổn định', 'ok');
        
        if (typeof nRect0 !== 'undefined') {
          nRect0.setAttribute('class', true ? 'f-accent-soft s-accent s-w2' : 'f-surface2 s-accent s-w2');
        }

        if (typeof nRect1 !== 'undefined') {
          nRect1.setAttribute('class', false ? 'f-accent-soft s-accent s-w2' : 'f-surface2 s-ok s-w2');
        }

        if (typeof nRect2 !== 'undefined') {
          nRect2.setAttribute('class', false ? 'f-accent-soft s-accent s-w2' : 'f-surface2 s-warn s-w2');
        }
        logEl.add('Đã thực thi thành công: Call Stack giải phóng, bộ nhớ Heap tối ưu.', 'ok');
      }),
      button('Kích hoạt ngoại lệ / Lỗi', function() {
        stStatus.update('Cảnh báo Exception', 'bad');
        if (typeof nRect1 !== 'undefined') {
          nRect1.setAttribute('class', 'f-bad-soft s-bad s-w2');
        }
        logEl.add('Cảnh báo: Bắt được ngoại lệ TypeError/ReferenceError! Cơ chế try-catch đã can thiệp.', 'bad');
      }, 'danger'),
      button('Khôi phục trạng thái', function() {
        stStatus.update('Đã hồi phục', 'accent');
        
        if (typeof nRect0 !== 'undefined') {
          nRect0.setAttribute('class', 'f-surface2 s-accent s-w2');
        }

        if (typeof nRect1 !== 'undefined') {
          nRect1.setAttribute('class', 'f-surface2 s-ok s-w2');
        }

        if (typeof nRect2 !== 'undefined') {
          nRect2.setAttribute('class', 'f-surface2 s-warn s-w2');
        }
        logEl.add('Hệ thống đã phục hồi trạng thái sẵn sàng. Garbage Collector đã dọn dẹp.', 'acc');
      }, 'ghost')
    ];

    var controls = h('div', { class: 'controls' });
    controls.appendChild(sl.el);
    var btnRow = h('div', { class: 'btn-row' });
    actionBtns.forEach(function(b) { btnRow.appendChild(b); });
    controls.appendChild(btnRow);

    var logEl = log(6);
    logEl.add('Sẵn sàng: Khởi động mô phỏng luồng thực thi JavaScript.', 'acc');

    root.append(controls, statsWrap, vizWrap, logEl);
  });


  widget('ch2-w2', function(root) {
    clear(root);

    var statsWrap = h('div', { class: 'stats' });
    var stThroughput = stat('Tần suất thực thi', '1,000 op/s', 'ok');
    var stLatency = stat('Thời gian phản hồi', '12 ms', 'ok');
    var stStatus = stat('Trạng thái bộ nhớ', 'Ổn định', 'accent');
    statsWrap.append(stThroughput, stLatency, stStatus);

    var vizWrap = h('div', { class: 'viz' });
    var svg = s('svg', { viewBox: '0 0 560 160', role: 'img', 'aria-label': 'JavaScript Runtime Architecture' });

    var nRect0 = s('rect', { x: 20, y: 40, width: 130, height: 75, rx: 8, class: 'f-surface2 s-accent s-w2' });
    svg.appendChild(nRect0);
    svg.appendChild(s('text', { x: 85, y: 75, 'text-anchor': 'middle', class: 'lbl-strong t-mid' }, 'Global Scope'));
    svg.appendChild(s('text', { x: 85, y: 91, 'text-anchor': 'middle', class: 't-mid t-sm t-dim' }, 'Window Context'));
    
    svg.appendChild(s('line', { x1: 150, y1: 77, x2: 215, y2: 77, class: 's-accent', 'stroke-width': 2, 'stroke-dasharray': '4,4' }));
    svg.appendChild(s('circle', { cx: 182, cy: 77, r: 4, class: 'f-accent' }));

    var nRect1 = s('rect', { x: 215, y: 40, width: 130, height: 75, rx: 8, class: 'f-surface2 s-ok s-w2' });
    svg.appendChild(nRect1);
    svg.appendChild(s('text', { x: 280, y: 75, 'text-anchor': 'middle', class: 'lbl-strong t-mid' }, 'Lexical Env'));
    svg.appendChild(s('text', { x: 280, y: 91, 'text-anchor': 'middle', class: 't-mid t-sm t-dim' }, 'Variable Storage'));
    
    svg.appendChild(s('line', { x1: 345, y1: 77, x2: 410, y2: 77, class: 's-accent', 'stroke-width': 2, 'stroke-dasharray': '4,4' }));
    svg.appendChild(s('circle', { cx: 377, cy: 77, r: 4, class: 'f-accent' }));

    var nRect2 = s('rect', { x: 410, y: 40, width: 130, height: 75, rx: 8, class: 'f-surface2 s-warn s-w2' });
    svg.appendChild(nRect2);
    svg.appendChild(s('text', { x: 475, y: 75, 'text-anchor': 'middle', class: 'lbl-strong t-mid' }, 'Execution Stack'));
    svg.appendChild(s('text', { x: 475, y: 91, 'text-anchor': 'middle', class: 't-mid t-sm t-dim' }, 'Active Frame'));
    
    vizWrap.appendChild(svg);

    var rand = rng(123);
    var sl = slider({
      label: 'Tải lượng thực thi mã',
      min: 100,
      max: 5000,
      step: 100,
      value: 1000,
      format: function(v) { return fmtBig(v) + ' op/s'; },
      onInput: function(v) {
        var isHigh = v > 3500;
        var jitter = Math.floor(rand() * 5);
        stThroughput.update(fmtBig(v) + ' op/s', isHigh ? 'warn' : 'ok');
        stLatency.update(fmtMs(Math.max(4, Math.floor(v * 0.015 + jitter))), isHigh ? 'bad' : 'ok');
        logEl.add('Tải thực thi: ' + fmtBig(v) + ' op/s · Phản hồi: ' + fmtMs(v * 0.015 + jitter), isHigh ? 'warn' : 't');
      }
    });

    var actionBtns = [
      button('Thực thi lệnh chuẩn', function() {
        stStatus.update('Ổn định', 'ok');
        
        if (typeof nRect0 !== 'undefined') {
          nRect0.setAttribute('class', true ? 'f-accent-soft s-accent s-w2' : 'f-surface2 s-accent s-w2');
        }

        if (typeof nRect1 !== 'undefined') {
          nRect1.setAttribute('class', false ? 'f-accent-soft s-accent s-w2' : 'f-surface2 s-ok s-w2');
        }

        if (typeof nRect2 !== 'undefined') {
          nRect2.setAttribute('class', false ? 'f-accent-soft s-accent s-w2' : 'f-surface2 s-warn s-w2');
        }
        logEl.add('Đã thực thi thành công: Call Stack giải phóng, bộ nhớ Heap tối ưu.', 'ok');
      }),
      button('Kích hoạt ngoại lệ / Lỗi', function() {
        stStatus.update('Cảnh báo Exception', 'bad');
        if (typeof nRect1 !== 'undefined') {
          nRect1.setAttribute('class', 'f-bad-soft s-bad s-w2');
        }
        logEl.add('Cảnh báo: Bắt được ngoại lệ TypeError/ReferenceError! Cơ chế try-catch đã can thiệp.', 'bad');
      }, 'danger'),
      button('Khôi phục trạng thái', function() {
        stStatus.update('Đã hồi phục', 'accent');
        
        if (typeof nRect0 !== 'undefined') {
          nRect0.setAttribute('class', 'f-surface2 s-accent s-w2');
        }

        if (typeof nRect1 !== 'undefined') {
          nRect1.setAttribute('class', 'f-surface2 s-ok s-w2');
        }

        if (typeof nRect2 !== 'undefined') {
          nRect2.setAttribute('class', 'f-surface2 s-warn s-w2');
        }
        logEl.add('Hệ thống đã phục hồi trạng thái sẵn sàng. Garbage Collector đã dọn dẹp.', 'acc');
      }, 'ghost')
    ];

    var controls = h('div', { class: 'controls' });
    controls.appendChild(sl.el);
    var btnRow = h('div', { class: 'btn-row' });
    actionBtns.forEach(function(b) { btnRow.appendChild(b); });
    controls.appendChild(btnRow);

    var logEl = log(6);
    logEl.add('Sẵn sàng: Khởi động mô phỏng luồng thực thi JavaScript.', 'acc');

    root.append(controls, statsWrap, vizWrap, logEl);
  });

  glossary.add([
    { key: 'dom', term: 'DOM', vi: 'Mô hình Đối tượng Tài liệu', def: 'Giao diện lập trình biểu diễn tài liệu HTML dưới dạng cấu trúc cây.' },
    { key: 'closure', term: 'Closure', vi: 'Bao đóng', def: 'Sự kết hợp giữa một hàm và môi trường từ vựng nơi hàm đó được khai báo.' }
  ]);
})();