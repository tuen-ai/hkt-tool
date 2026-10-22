/* 麥座正式單匯出 — 面板＋統計／票數＋新分頁開啟（合併） */
(async function () {
  'use strict';
  if (!/maizuo\.imaitix\.com$/i.test(location.hostname)) {
    alert('請先打開並登入 https://maizuo.imaitix.com');
    return;
  }


  function installMzNewtab() {
    var MODE_TAB = 'tab';
    var MODE_WINDOW = 'window';
    var GESTURE_MS = 1500;
    var state = window.__MZ_NEWTAB__;
    function toast(text) {
      try {
        var el = document.createElement('div');
        el.textContent = text;
        el.style.cssText = [
          'position:fixed', 'z-index:2147483647', 'left:0', 'right:0', 'top:24px',
          'margin:0 auto', 'width:max-content', 'max-width:90vw',
          'padding:8px 16px', 'border-radius:6px',
          'background:rgba(0,0,0,.82)', 'color:#fff', 'font-size:13px',
          'font-family:system-ui,-apple-system,"PingFang HK","Microsoft JhengHei",sans-serif',
          'pointer-events:none', 'box-shadow:0 4px 14px rgba(0,0,0,.25)',
          'opacity:0', 'transition:opacity .15s'
        ].join(';');
        (document.body || document.documentElement).appendChild(el);
        requestAnimationFrame(function () { el.style.opacity = '1'; });
        setTimeout(function () {
          el.style.opacity = '0';
          setTimeout(function () { el.remove(); }, 200);
        }, 1500);
      } catch (err) {}
    }
    if (state && state.installed) {
      if (typeof state.rehook === 'function') state.rehook();
      return { already: true, toast: toast };
    }
    var pending = null;
    var patched = typeof WeakSet !== 'undefined' ? new WeakSet() : { _s: [], has: function (h) { return this._s.indexOf(h) >= 0; }, add: function (h) { this._s.push(h); } };
    function arm(mode) { pending = { mode: mode, ts: Date.now() }; }
    function disarm() { pending = null; }
    function takeMode() {
      if (!pending) return null;
      var m = (Date.now() - pending.ts <= GESTURE_MS) ? pending.mode : null;
      pending = null;
      return m;
    }
    document.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      if (e.ctrlKey || e.metaKey) arm(MODE_TAB);
      else if (e.shiftKey) arm(MODE_WINDOW);
      else disarm();
    }, true);
    document.addEventListener('auxclick', function (e) {
      if (e.button !== 1) return;
      var t = e.target && e.target.closest
        ? e.target.closest('button, [role="button"], .ant-btn, td, a')
        : null;
      if (!t) return;
      e.preventDefault();
      e.stopPropagation();
      arm(MODE_TAB);
      t.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    }, true);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') disarm();
    }, true);
    function toHref(h, to) {
      try {
        if (h && typeof h.createHref === 'function') {
          var s = h.createHref(to);
          if (s) return new URL(s, location.origin).href;
        }
      } catch (err) {}
      var path = (typeof to === 'string')
        ? to
        : ((to && to.pathname) || '') + ((to && to.search) || '') + ((to && to.hash) || '');
      if (!path) return null;
      var base = String(window.routerBase || '/').replace(/\/+$/, '');
      if (base && path.indexOf(base + '/') !== 0) {
        path = base + (path.charAt(0) === '/' ? '' : '/') + path;
      }
      try { return new URL(path, location.origin).href; } catch (err) { return null; }
    }
    function patch(h) {
      if (!h || typeof h !== 'object' || typeof h.push !== 'function' || patched.has(h)) return h;
      patched.add(h);
      var origPush = h.push.bind(h);
      h.push = function (to, stateArg) {
        var mode = takeMode();
        if (!mode) return origPush(to, stateArg);
        var url = toHref(h, to);
        if (!url) return origPush(to, stateArg);
        var win = (mode === MODE_WINDOW)
          ? window.open(url, '_blank', 'noopener,noreferrer,width=1500,height=950')
          : window.open(url, '_blank', 'noopener,noreferrer');
        if (!win) {
          toast('新分頁被瀏覽器擋咗：撳網址列右邊個圖示 → 一律允許');
          return undefined;
        }
        toast(mode === MODE_WINDOW ? '已喺新視窗開啟' : '已喺新分頁開啟');
        return undefined;
      };
      return h;
    }
    function hook(name) {
      var current = window[name];
      if (current) patch(current);
      try {
        var desc = Object.getOwnPropertyDescriptor(window, name);
        if (!desc || desc.configurable) {
          Object.defineProperty(window, name, {
            configurable: true,
            get: function () { return current; },
            set: function (v) { current = v; patch(v); }
          });
        }
      } catch (err) {
        var tries = 0;
        var timer = setInterval(function () {
          if (window[name]) patch(window[name]);
          if (++tries > 60) clearInterval(timer);
        }, 500);
      }
    }
    function rehook() {
      if (window.g_history) patch(window.g_history);
      if (window.historyService) patch(window.historyService);
    }
    hook('g_history');
    hook('historyService');
    window.__MZ_NEWTAB__ = { installed: true, rehook: rehook };
    return { already: false, toast: toast };
  }

  var _nt = installMzNewtab();
  if (_nt && _nt.toast && !_nt.already) {
    _nt.toast('已啟用麥座新分頁：Ctrl+Click / 中鍵 開新分頁，Shift+Click 開新視窗');
  }

  var old = document.getElementById('mz-closed-export-panel');
  if (old) {
    old.classList.remove('mz-min');
    var fab0 = old.querySelector('#mz-fab');
    if (fab0) fab0.style.display = 'none';
    var card0 = old.querySelector('#mz-card');
    if (card0) card0.style.display = '';
    return;
  }

  var TRADE = 'https://trade-sig.imaitix.com';
  var SYS = 'https://sys-sig.imaitix.com';
  var PMS = 'https://pms-sig.imaitix.com';
  var PAGE_SIZE = 200;
  var PREVIEW_LIMIT = 20;

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function ymd(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function parseUserTime(s, endOfDay) {
    s = (s || '').trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s + (endOfDay ? ' 23:59' : ' 00:00');
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) return s.slice(0, 16);
    return s;
  }
  function daysBetween(a, b) {
    var t0 = Date.parse(a.replace(/-/g, '/'));
    var t1 = Date.parse(b.replace(/-/g, '/'));
    if (isNaN(t0) || isNaN(t1)) return null;
    return Math.floor(Math.abs(t1 - t0) / 864e5);
  }
  function friendlyErr(msg) {
    var s = String(msg || '');
    if (s.indexOf('15010033') >= 0) {
      return '請選擇下單時間，範圍不超過 1 年（15010033）。';
    }
    return s;
  }
  function getCookie(name) {
    var parts = (document.cookie || '').split(';');
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      if (p.indexOf(name + '=') === 0) return decodeURIComponent(p.slice(name.length + 1));
    }
    return '';
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  // Excel 會把超長數字變科學記數；呢啲欄強制當文字（="…"）
  var EXCEL_TEXT_COLS = {
    orderId: 1,
    projectId: 1,
    customerId: 1,
    customerTel: 1,
    customerEmail: 1,
    orderTime: 1,
    outerOrderId: 1
  };
  var EXCEL_COL_WIDTHS = {
    orderId: 180,
    orderState: 90,
    orderStateName: 120,
    projectId: 150,
    projectName: 320,
    customerId: 110,
    orderTime: 170,
    customerName: 120,
    customerTel: 140,
    customerEmail: 200,
    orderTicketCount: 80,
    orderTotalMoney: 100,
    orderReceiveMoney: 100,
    orderReceiptMoney: 100,
    orderPayStateName: 120,
    exitTicketStateName: 120,
    printTicketStateName: 120,
    firstChannelName: 140,
    operatorName: 110
  };
  function downloadExcel(filename, rows, cols) {
    var colgroup = cols.map(function (c) {
      var w = EXCEL_COL_WIDTHS[c] || 110;
      return '<col style="width:' + w + 'px" />';
    }).join('');
    var thead = '<tr>' + cols.map(function (c) {
      return '<th>' + esc(c) + '</th>';
    }).join('') + '</tr>';
    var body = rows.map(function (r) {
      return '<tr>' + cols.map(function (c) {
        var v = r[c];
        var s = v == null ? '' : String(v);
        var style = EXCEL_TEXT_COLS[c] ? ' style="mso-number-format:\'\\@\'"' : '';
        return '<td' + style + '>' + esc(s) + '</td>';
      }).join('') + '</tr>';
    }).join('');
    var html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">' +
      '<head><meta charset="utf-8" /><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>' +
      '<x:Name>orders</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>' +
      '</x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body>' +
      '<table border="1"><colgroup>' + colgroup + '</colgroup><thead>' + thead + '</thead><tbody>' + body + '</tbody></table>' +
      '</body></html>';
    var blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }
  function money(v) {
    if (v == null || v === '') return '';
    var n = Number(v);
    return isNaN(n) ? String(v) : n.toLocaleString('en-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async function api(method, url, data) {
    var opts = {
      method: method,
      credentials: 'include',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'X-XSRF-TOKEN': getCookie('XSRF-TOKEN') || ''
      }
    };
    if (method === 'GET') {
      if (data) {
        var q = Object.keys(data).filter(function (k) {
          return data[k] !== undefined && data[k] !== null && data[k] !== '';
        }).map(function (k) {
          return encodeURIComponent(k) + '=' + encodeURIComponent(data[k]);
        }).join('&');
        if (q) url += (url.indexOf('?') >= 0 ? '&' : '?') + q;
      }
    } else {
      opts.headers['Content-Type'] = 'application/json;charset=UTF-8';
      opts.body = JSON.stringify(data || {});
    }
    var res = await fetch(url, opts);
    var json = await res.json().catch(function () { return null; });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    if (json && json.success === false) {
      var code = json.code != null ? String(json.code) : '';
      var em = json.errorMsg || json.message || '';
      throw new Error((em ? em + ' ' : '') + (code ? '(' + code + ')' : '') || '請求失敗');
    }
    return json;
  }

  var end = new Date();
  var start = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  var state = {
    ptnrId: '',
    statusList: [],
    presets: [],
    projects: [],
    selectedProject: null,
    selectedProjects: [],
    events: [],
    previewOrders: [],
    countBlocks: [],
    running: false,
    viewMode: 'event',
    rawCountBlocks: []
  };

  var css = [
    '#mz-closed-export-panel{position:fixed;z-index:2147483646;right:16px;bottom:16px;font-family:system-ui,-apple-system,"PingFang HK","Microsoft JhengHei",sans-serif;color:#0f172a}',
    '#mz-closed-export-panel *{box-sizing:border-box}',
    '#mz-closed-export-panel.mz-min{right:16px;bottom:16px}',
    '#mz-fab{display:none;align-items:center;gap:10px;padding:14px 18px;border:0;border-radius:999px;',
    'background:linear-gradient(135deg,#1677ff 0%,#69b1ff 100%);color:#fff;font-size:18px;font-weight:700;',
    'box-shadow:0 12px 28px rgba(22,119,255,.45);cursor:pointer}',
    '#mz-fab:hover{filter:brightness(1.05)}',
    '#mz-card{position:fixed;right:16px;bottom:16px;width:min(920px,calc(100vw - 24px));max-height:min(88vh,920px);overflow:auto;background:#fff;border-radius:16px;',
    'box-shadow:0 25px 50px -12px rgba(0,0,0,.35);border:1px solid #e2e8f0}',
    '#mz-card .mz-head{display:flex;justify-content:space-between;align-items:flex-start;padding:18px 20px 14px;cursor:move;user-select:none;',
    'background:linear-gradient(135deg,#1677ff 0%,#69b1ff 100%);color:#fff;border-radius:16px 16px 0 0;position:sticky;top:0;z-index:2}',
    '#mz-card .mz-head h2{margin:0;font-size:26px;font-weight:700}',
    '#mz-card .mz-head p{margin:6px 0 0;font-size:16px;opacity:.92}',
    '#mz-card .mz-head-actions{display:flex;gap:8px;align-items:center}',
    '#mz-card .mz-x,#mz-card .mz-minbtn{border:0;background:rgba(255,255,255,.22);color:#fff;min-width:40px;height:40px;border-radius:10px;cursor:pointer;font-size:22px;line-height:1;padding:0 10px}',
    '#mz-card .mz-minbtn{font-size:18px;font-weight:700}',
    '#mz-card .mz-body{padding:18px 22px 10px}',
    '#mz-card .mz-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}',
    '#mz-card label.mz-lab{display:block;font-size:17px;font-weight:600;color:#475569;margin:0 0 8px}',
    '#mz-card .mz-field{margin-bottom:14px}',
    '#mz-card input[type=date],#mz-card input[type=text],#mz-card select{width:100%;padding:12px 14px;border:1px solid #cbd5e1;border-radius:10px;',
    'font-size:20px;line-height:1.45;background:#fff;outline:none}',
    '#mz-card input:focus,#mz-card select:focus{border-color:#1677ff;box-shadow:0 0 0 3px rgba(22,119,255,.15)}',
    '#mz-card select[multiple]{min-height:150px}',
    '#mz-card #mz-preset{font-size:20px;line-height:1.45}',
    '#mz-card .mz-row{display:flex;gap:8px;align-items:center}',
    '#mz-card .mz-row input{flex:1}',
    '#mz-card .mz-chips{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 0}',
    '#mz-card .mz-chip{border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;border-radius:999px;padding:7px 14px;font-size:15px;cursor:pointer}',
    '#mz-card .mz-chip:hover{background:#dbeafe}',
    '#mz-card .mz-sec{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px;flex-wrap:wrap}',
    '#mz-card .mz-link{border:0;background:transparent;color:#1677ff;cursor:pointer;font-size:16px;padding:0}',
    '#mz-card .mz-panel{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin:0 0 14px}',
    '#mz-card .mz-panel h3{margin:0 0 10px;font-size:18px;color:#0f172a}',
    '#mz-card .mz-panel h4{margin:12px 0 8px;font-size:16px;color:#334155;font-weight:700}',
    '#mz-card .mz-stat{display:flex;flex-wrap:wrap;gap:10px}',
    '#mz-card .mz-pill{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;min-width:140px}',
    '#mz-card .mz-pill .n{font-size:26px;font-weight:700;color:#0f172a}',
    '#mz-card .mz-pill .t{font-size:15px;color:#64748b;margin-top:4px}',
    '#mz-card .mz-pill.on{border-color:#93c5fd;background:#eff6ff}',
    '#mz-card .mz-pill.zero{opacity:.55}',
    '#mz-card .mz-pill.ticket{border-color:#fcd34d;background:#fffbeb}',
    '#mz-card .mz-pill.ticket.on{border-color:#f59e0b;background:#fef3c7}',
    '#mz-card table.mz-table{width:100%;border-collapse:collapse;font-size:16px}',
    '#mz-card table.mz-table th{text-align:left;padding:10px 8px;border-bottom:1px solid #e2e8f0;color:#64748b;font-weight:600;white-space:nowrap}',
    '#mz-card table.mz-table td{padding:10px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top}',
    '#mz-card table.mz-table tr:hover td{background:#f8fafc}',
    '#mz-card .mz-badge{display:inline-block;padding:4px 12px;border-radius:999px;background:#e2e8f0;font-size:14px;color:#334155}',
    '#mz-card .mz-badge.closed{background:#fee2e2;color:#b91c1c}',
    '#mz-card .mz-badge.ok{background:#dcfce7;color:#166534}',
    '#mz-card .mz-msg{min-height:24px;font-size:16px;color:#64748b;margin:4px 0 10px}',
    '#mz-card .mz-foot{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;padding:14px 20px 18px;border-top:1px solid #f1f5f9;background:#fff;position:sticky;bottom:0}',
    '#mz-card .mz-btn{padding:13px 18px;border-radius:10px;font-size:17px;font-weight:600;cursor:pointer;border:1px solid transparent}',
    '#mz-card .mz-btn:disabled{opacity:.55;cursor:not-allowed}',
    '#mz-card .mz-btn.ghost{background:#fff;border-color:#cbd5e1;color:#334155}',
    '#mz-card .mz-btn.soft{background:#eff6ff;border-color:#bfdbfe;color:#1d4ed8}',
    '#mz-card .mz-btn.primary{background:#1677ff;color:#fff}',
    '#mz-card .mz-empty{color:#94a3b8;font-size:16px;padding:8px 0}',
    '@media (max-width:640px){#mz-card .mz-grid2{grid-template-columns:1fr}#mz-card{width:calc(100vw - 16px);right:0}}'
  ].join('');


  var style = document.createElement('style');
  style.textContent = css;
  document.documentElement.appendChild(style);

  var root = document.createElement('div');
  root.id = 'mz-closed-export-panel';
  root.innerHTML = [
    '<button type="button" id="mz-fab" aria-label="展開正式單匯出">正式單匯出 · 展開</button>',
    '<div id="mz-card">',
    '<div class="mz-head">',
    '<div><h2>正式單匯出</h2></div>',
    '<div class="mz-head-actions">',
    '<button type="button" class="mz-minbtn" id="mz-minimize" title="收起">收起</button>',
    '<button type="button" class="mz-x" id="mz-x" aria-label="收起">×</button>',
    '</div></div>',
    '<div class="mz-body">',
    '<div class="mz-grid2">',
    '<div class="mz-field"><label class="mz-lab">下單開始時間</label><input id="mz-start" type="date" /></div>',
    '<div class="mz-field"><label class="mz-lab">下單結束時間</label><input id="mz-end" type="date" /></div>',
    '</div>',
    '<div class="mz-field"><label class="mz-lab">近期項目（今日起 1 年有場）</label>',
    '<select id="mz-preset"><option value="">載入中…</option></select></div>',
    '<div class="mz-field"><label class="mz-lab">搜尋項目</label>',
    '<div class="mz-row"><input id="mz-proj-q" type="text" />',
    '<button type="button" class="mz-btn soft" id="mz-proj-search">搜尋</button></div></div>',
    '<div class="mz-field"><div class="mz-sec"><label class="mz-lab" style="margin:0">項目（可多選）</label>',
    '<span><button type="button" class="mz-link" id="mz-proj-clear">取消勾選</button> · ',
    '<button type="button" class="mz-link" id="mz-proj-remove">移除已選</button> · ',
    '<button type="button" class="mz-link" id="mz-proj-clear-all">清空清單</button></span></div>',
    '<select id="mz-proj" multiple size="5"></select></div>',
    '<div class="mz-field"><div class="mz-sec"><label class="mz-lab" style="margin:0">場次（可唔揀＝成個項目）</label>',
    '<button type="button" class="mz-link" id="mz-ev-clear">清空場次</button></div>',
    '<select id="mz-events" multiple size="4"></select></div>',
    '<div class="mz-field"><div class="mz-sec"><label class="mz-lab" style="margin:0">訂單狀態（可多選）</label>',
    '<span><button type="button" class="mz-link" id="mz-st-all">全選</button> · ',
    '<button type="button" class="mz-link" id="mz-st-closed">只已關閉</button> · ',
    '<button type="button" class="mz-link" id="mz-st-none">清空</button></span></div>',
    '<select id="mz-status" multiple size="6"></select>',
    '<div class="mz-chips" id="mz-selected-chips"></div></div>',
    '<div class="mz-field" id="mz-view-mode-wrap" style="display:none">',
    '<label class="mz-lab">統計顯示</label>',
    '<div class="mz-row" style="gap:16px;flex-wrap:wrap">',
    '<label style="font-size:17px;display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="mz-view" id="mz-view-event" value="event" checked /> 按場次</label>',
    '<label style="font-size:17px;display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="mz-view" id="mz-view-total" value="total" /> 總數（場次加埋）</label>',
    '</div></div>',
    '<div class="mz-field" id="mz-want-tickets-wrap">',
    '<label style="font-size:17px;display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600;color:#334155">',
    '<input type="checkbox" id="mz-want-tickets" /> 計算票數（較慢，要拉齊全部單）</label>',
    '<div style="font-size:14px;color:#94a3b8;margin-top:4px">唔勾只統計單量；要票張數先勾再撳「① 統計單量」</div>',
    '</div>',
    '<div class="mz-panel" id="mz-count-box" style="display:none"></div>',
    '<div class="mz-panel" id="mz-preview-box" style="display:none"></div>',
    '<div class="mz-msg" id="mz-msg"></div>',
    '</div>',
    '<div class="mz-foot">',
    '<button type="button" class="mz-btn ghost" id="mz-reset">全清空重置</button>',
    '<button type="button" class="mz-btn ghost" id="mz-cancel">收起</button>',
    '<button type="button" class="mz-btn soft" id="mz-count">① 統計單量</button>',
    '<button type="button" class="mz-btn soft" id="mz-preview">② 預覽訂單</button>',
    '<button type="button" class="mz-btn primary" id="mz-run">③ 匯出 Excel</button>',
    '</div></div>'
  ].join('');

  document.body.appendChild(root);

  var elStart = root.querySelector('#mz-start');
  var elEnd = root.querySelector('#mz-end');
  var elQ = root.querySelector('#mz-proj-q');
  var elPreset = root.querySelector('#mz-preset');
  var elProj = root.querySelector('#mz-proj');
  var elEvents = root.querySelector('#mz-events');
  var elStatus = root.querySelector('#mz-status');
  var elMsg = root.querySelector('#mz-msg');
  var elCountBox = root.querySelector('#mz-count-box');
  var elViewWrap = root.querySelector('#mz-view-mode-wrap');
  var elViewEvent = root.querySelector('#mz-view-event');
  var elViewTotal = root.querySelector('#mz-view-total');
  var elWantTickets = root.querySelector('#mz-want-tickets');
  var elPreviewBox = root.querySelector('#mz-preview-box');
  var elChips = root.querySelector('#mz-selected-chips');
  elStart.value = ymd(start);
  elEnd.value = ymd(end);

  function setMsg(t) { elMsg.textContent = t || ''; }
  var elFab = root.querySelector('#mz-fab');
  var elCard = root.querySelector('#mz-card');
  function minimize() {
    root.classList.add('mz-min');
    elCard.style.display = 'none';
    elFab.style.display = 'flex';
    setMsg('');
  }
  function expand() {
    root.classList.remove('mz-min');
    elCard.style.display = '';
    elFab.style.display = 'none';
  }
  function close() { minimize(); }
  (function enableDrag() {
    var head = root.querySelector('.mz-head');
    if (!head || !elCard) return;
    var dragging = false, ox = 0, oy = 0, startX = 0, startY = 0;
    head.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      if (e.target && e.target.closest && e.target.closest('button')) return;
      dragging = true;
      var rect = elCard.getBoundingClientRect();
      elCard.style.left = rect.left + 'px';
      elCard.style.top = rect.top + 'px';
      elCard.style.right = 'auto';
      elCard.style.bottom = 'auto';
      startX = e.clientX; startY = e.clientY;
      ox = rect.left; oy = rect.top;
      e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var nx = ox + (e.clientX - startX);
      var ny = oy + (e.clientY - startY);
      var maxX = Math.max(0, window.innerWidth - 80);
      var maxY = Math.max(0, window.innerHeight - 40);
      if (nx < -120) nx = -120;
      if (ny < 0) ny = 0;
      if (nx > maxX) nx = maxX;
      if (ny > maxY) ny = maxY;
      elCard.style.left = nx + 'px';
      elCard.style.top = ny + 'px';
    });
    document.addEventListener('mouseup', function () { dragging = false; });
  })();
  function setBusy(on) {
    state.running = on;
    ['#mz-count', '#mz-preview', '#mz-run', '#mz-proj-search'].forEach(function (sel) {
      var b = root.querySelector(sel);
      if (b) b.disabled = !!on;
    });
  }
  root.querySelector('#mz-x').onclick = minimize;
  root.querySelector('#mz-cancel').onclick = minimize;
  root.querySelector('#mz-minimize').onclick = minimize;
  elFab.onclick = expand;
  function onViewModeChange() {
    if (state.rawCountBlocks && state.rawCountBlocks.length) renderCounts(state.rawCountBlocks);
  }
  if (elViewEvent) elViewEvent.addEventListener('change', onViewModeChange);
  if (elViewTotal) elViewTotal.addEventListener('change', onViewModeChange);
  root.querySelector('#mz-ev-clear').onclick = function () {
    Array.prototype.forEach.call(elEvents.options, function (o) { o.selected = false; });
    setMsg('已清空場次＝成個項目');
  };

  function isClosedLabel(lab) {
    lab = String(lab || '');
    return lab.indexOf('已关闭') >= 0 || lab.indexOf('已關閉') >= 0;
  }
  function selectedStatusCodes() {
    return Array.prototype.map.call(elStatus.selectedOptions, function (o) { return o.value; });
  }
  function selectedEventIds() {
    return Array.prototype.map.call(elEvents.selectedOptions, function (o) { return o.value; }).filter(Boolean);
  }
  function selectedProjectIds() {
    return Array.prototype.map.call(elProj.selectedOptions, function (o) { return o.value; }).filter(Boolean);
  }
  function syncSelectedProjects() {
    var ids = selectedProjectIds();
    var map = {};
    state.projects.forEach(function (pr) { map[String(pr.projectId)] = pr; });
    state.selectedProjects = ids.map(function (id) { return map[id]; }).filter(Boolean);
    state.selectedProject = state.selectedProjects[0] || null;
    return state.selectedProjects;
  }
  function refreshChips() {
    var opts = Array.prototype.slice.call(elStatus.selectedOptions);
    if (!opts.length) {
      elChips.innerHTML = '<span class="mz-empty">未揀狀態</span>';
      return;
    }
    elChips.innerHTML = opts.map(function (o) {
      var closed = isClosedLabel(o.textContent);
      return '<span class="mz-badge' + (closed ? ' closed' : '') + '">' + esc(o.textContent.split(' [')[0]) + '</span>';
    }).join('');
  }


  function normalizeSelectItem(it) {
    if (it == null) return null;
    if (typeof it === 'string' || typeof it === 'number') {
      return { k: String(it), v: String(it) };
    }
    var k = it.k != null ? it.k : (it.key != null ? it.key : (it.value != null ? it.value : it.code));
    var v = it.v != null ? it.v : (it.label != null ? it.label : (it.name != null ? it.name : (it.text != null ? it.text : k)));
    if (k == null || k === '') return null;
    return { k: String(k), v: String(v == null ? k : v) };
  }
  function normalizeSelects(data) {
    if (Array.isArray(data)) return data.map(normalizeSelectItem).filter(Boolean);
    if (!data || typeof data !== 'object') return [];
    var arr = data.commonSelects || data.list || data.selects || data.enums || data.items;
    if (Array.isArray(arr)) return arr.map(normalizeSelectItem).filter(Boolean);
    // sometimes map { code: name }
    var keys = Object.keys(data);
    if (keys.length && keys.every(function (k) { return typeof data[k] === 'string' || typeof data[k] === 'number'; })) {
      return keys.map(function (k) { return { k: String(k), v: String(data[k]) }; });
    }
    return [];
  }

  function fillStatuses(list) {
    state.statusList = (list || []).map(normalizeSelectItem).filter(Boolean);
    elStatus.innerHTML = '';
    if (!state.statusList.length) {
      var empty = document.createElement('option');
      empty.disabled = true;
      empty.textContent = '（未載入到狀態）';
      elStatus.appendChild(empty);
      refreshChips();
      return;
    }
    state.statusList.forEach(function (it) {
      var o = document.createElement('option');
      o.value = String(it.k);
      o.textContent = (it.v || it.k) + ' [' + it.k + ']';
      o.selected = isClosedLabel(it.v);
      elStatus.appendChild(o);
    });
    refreshChips();
  }
  elStatus.addEventListener('change', refreshChips);
  root.querySelector('#mz-st-all').onclick = function () {
    Array.prototype.forEach.call(elStatus.options, function (o) { o.selected = true; });
    refreshChips();
  };
  root.querySelector('#mz-st-none').onclick = function () {
    Array.prototype.forEach.call(elStatus.options, function (o) { o.selected = false; });
    refreshChips();
  };
  root.querySelector('#mz-st-closed').onclick = function () {
    Array.prototype.forEach.call(elStatus.options, function (o) { o.selected = isClosedLabel(o.textContent); });
    refreshChips();
  };



  function parseEventDate(ev) {
    var raw = ev && (ev.eventStartTime || ev.startTime || ev.showTime || ev.eventTime || ev.beginTime || ev.eventName || ev.name || '');
    raw = String(raw || '');
    var m = raw.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    m = raw.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    var t0 = Date.parse(raw);
    if (!isNaN(t0)) return new Date(t0);
    return null;
  }
  function projectListFrom(data) {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== 'object') return [];
    if (Array.isArray(data.commonSelects)) return data.commonSelects;
    if (Array.isArray(data.list)) return data.list;
    if (Array.isArray(data.dataList)) return data.dataList;
    return [];
  }
  function projectHasEventInRange(p, from, to) {
    var evs = (p && (p.eventComboBoxVOList || p.eventList || p.events)) || [];
    if (!Array.isArray(evs) || !evs.length) return false;
    for (var i = 0; i < evs.length; i++) {
      var d = parseEventDate(evs[i]);
      if (d && d >= from && d <= to) return true;
    }
    return false;
  }
  function fillPresets(items) {
    state.presets = items || [];
    elPreset.innerHTML = '';
    var ph = document.createElement('option');
    ph.value = '';
    ph.textContent = state.presets.length
      ? ('— 揀項目（' + state.presets.length + '）—')
      : '— 冇搵到未來 1 年有場嘅項目 —';
    elPreset.appendChild(ph);
    state.presets.forEach(function (it, idx) {
      var o = document.createElement('option');
      o.value = String(idx);
      o.textContent = it.label;
      elPreset.appendChild(o);
    });
  }
  async function loadUpcomingPresets() {
    var from = new Date();
    from.setHours(0, 0, 0, 0);
    var to = new Date(from.getTime());
    to.setFullYear(to.getFullYear() + 1);
    var list = [];
    try {
      var res1 = await api('GET', PMS + '/pms/project/getProjectComboBox', {
        comboBoxCode: 1, filterPtnrId: state.ptnrId
      });
      list = projectListFrom(res1 && res1.data);
    } catch (e1) { list = []; }
    if (!list.length) {
      try {
        var res2 = await api('GET', PMS + '/pms/project/getProjectComboBoxFuzzy', {
          projectName: ' ', comboBoxCode: 1, filterPtnrId: state.ptnrId
        });
        list = projectListFrom(res2 && res2.data);
      } catch (e2) {}
    }
    var items = [];
    var seen = {};
    list.forEach(function (pr) {
      if (!pr || pr.projectId == null) return;
      var id = String(pr.projectId);
      if (seen[id]) return;
      var evs = (pr.eventComboBoxVOList || pr.eventList || pr.events) || [];
      if (!Array.isArray(evs)) evs = [];
      var inRange = [];
      evs.forEach(function (ev) {
        var d = parseEventDate(ev);
        if (d && d >= from && d <= to) {
          inRange.push({
            ev: ev,
            date: d,
            name: ev.eventName || ev.name || ev.showTime || ('場次 ' + ev.eventId)
          });
        }
      });
      if (!inRange.length) return;
      seen[id] = 1;
      inRange.sort(function (a, b) { return a.date - b.date; });
      var pname = pr.projectName || pr.name || ('項目 ' + pr.projectId);
      var evSummary = inRange.map(function (x) { return ymd(x.date) + ' ' + x.name; }).join(' ／ ');
      items.push({
        project: pr,
        inRangeEvents: inRange,
        label: pname + ' [' + pr.projectId + '] · 含 ' + inRange.length + ' 場：' + evSummary
      });
    });
    items.forEach(function (it) {
      var dates = (it.inRangeEvents || []).map(function (x) { return x.date && x.date.getTime(); }).filter(Boolean);
      it.sortKey = dates.length ? Math.min.apply(null, dates) : Number.MAX_SAFE_INTEGER;
    });
    items.sort(function (a, b) {
      if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
      return String(a.label).localeCompare(String(b.label), 'zh-Hant');
    });
    fillPresets(items);
    return items.length;
  }
  function applyPreset(idx) {
    var it = state.presets[idx];
    if (!it) return;
    var pr = it.project;
    var keep = selectedProjectIds();
    if (keep.indexOf(String(pr.projectId)) < 0) keep = keep.concat([String(pr.projectId)]);
    var found = false;
    for (var i = 0; i < state.projects.length; i++) {
      if (String(state.projects[i].projectId) === String(pr.projectId)) { found = true; break; }
    }
    if (!found) state.projects = [pr].concat(state.projects);
    fillProjects(state.projects, keep);
    var pre = (it.inRangeEvents || []).map(function (x) { return x.ev.eventId; });
    refreshEventsFromSelectedProjects(pre);
    elCountBox.style.display = 'none';
    elPreviewBox.style.display = 'none';
    setMsg('已加入項目：' + (pr.projectName || pr.projectId) + '（可再多選其他項目）');
  }

  function fillProjects(list, keepSelectedIds) {
    var keep = keepSelectedIds || selectedProjectIds();
    state.projects = list || [];
    elProj.innerHTML = '';
    if (!state.projects.length) {
      var o = document.createElement('option');
      o.disabled = true;
      o.textContent = '（無結果）';
      elProj.appendChild(o);
      syncSelectedProjects();
      return;
    }
    state.projects.forEach(function (pr, idx) {
      var o = document.createElement('option');
      o.value = String(pr.projectId);
      o.textContent = (pr.projectName || pr.name || ('項目 ' + pr.projectId)) + ' [' + pr.projectId + ']';
      o.dataset.idx = String(idx);
      if (keep.indexOf(String(pr.projectId)) >= 0) o.selected = true;
      elProj.appendChild(o);
    });
    syncSelectedProjects();
  }
  function fillEvents(list) {
    state.events = list || [];
    elEvents.innerHTML = '';
    if (!state.events.length) {
      var o = document.createElement('option');
      o.disabled = true;
      o.textContent = '（無場次清單／可直接用成個項目）';
      elEvents.appendChild(o);
      return;
    }
    state.events.forEach(function (ev) {
      var o = document.createElement('option');
      o.value = String(ev.eventId);
      var label = ev.eventName || ev.name || ev.showTime || ('場次 ' + ev.eventId);
      if (ev.showTime && label.indexOf(String(ev.showTime)) < 0) label += ' · ' + ev.showTime;
      o.textContent = label + ' [' + ev.eventId + ']';
      elEvents.appendChild(o);
    });
  }

  function readDatesOrThrow() {
    var createStartTime = parseUserTime(elStart.value, false);
    var createEndTime = parseUserTime(elEnd.value, true);
    if (!createStartTime || !createEndTime) throw new Error('請填下單開始同結束時間');
    var span = daysBetween(createStartTime.slice(0, 10), createEndTime.slice(0, 10));
    if (span == null) throw new Error('日期格式無效');
    if (span > 365) throw new Error('下單時間範圍不可超過 1 年（而家約 ' + span + ' 日）');
    if (Date.parse(createStartTime.replace(/-/g, '/')) > Date.parse(createEndTime.replace(/-/g, '/'))) {
      throw new Error('下單開始時間唔可以晚過下單結束時間');
    }
    return { createStartTime: createStartTime, createEndTime: createEndTime };
  }
  function baseFilter(dates) {
    syncSelectedProjects();
    if (!state.selectedProjects.length) throw new Error('請先搜尋／下拉並至少揀一個項目');
    return {
      ptnrId: state.ptnrId,
      createStartTime: dates.createStartTime,
      createEndTime: dates.createEndTime
    };
  }
  function projectScopes() {
    return syncSelectedProjects().map(function (pr) {
      return {
        projectId: pr.projectId,
        label: (pr.projectName || pr.name || ('項目 ' + pr.projectId))
      };
    });
  }
  async function totalFor(body) {
    var res = await api('POST', TRADE + '/trade/order/formal/list', Object.assign({}, body, { page: 1, pageSize: 1 }));
    var data = (res && res.data) || {};
    return Number(data.totalRow != null ? data.totalRow : 0);
  }
  function ticketOf(row) {
    var v = row && (row.orderTicketCount != null ? row.orderTicketCount : row.ticketCount);
    var n = Number(v);
    return isNaN(n) ? 0 : n;
  }
  async function mapPool(items, limit, asyncFn) {
    var results = new Array(items.length);
    var next = 0;
    async function worker() {
      while (true) {
        var i = next++;
        if (i >= items.length) return;
        results[i] = await asyncFn(items[i], i);
      }
    }
    if (!items.length) return results;
    var n = Math.max(1, Math.min(limit, items.length));
    var workers = [];
    for (var w = 0; w < n; w++) workers.push(worker());
    await Promise.all(workers);
    return results;
  }
  async function sumTicketsFor(body, expectedOrders, progressLabel) {
    if (progressLabel) setMsg(progressLabel + ' · 票數加總中…');
    var all = await fetchAllPages(body);
    var tickets = 0;
    for (var i = 0; i < all.length; i++) tickets += ticketOf(all[i]);
    var totalRow = expectedOrders != null ? Number(expectedOrders) : all.length;
    if (progressLabel) {
      setMsg(progressLabel + ' · 票數加總完成 ' + all.length +
        (totalRow != null && !isNaN(totalRow) ? '／' + totalRow : '') + ' 單');
    }
    return { tickets: tickets, orders: all.length, totalRow: totalRow };
  }
  async function fetchPage(body, page, pageSize) {
    var listRes = await api('POST', TRADE + '/trade/order/formal/list', Object.assign({}, body, { page: page, pageSize: pageSize || PAGE_SIZE }));
    var data = (listRes && listRes.data) || {};
    return { list: data.dataList || [], totalRow: data.totalRow };
  }
  async function fetchAllPages(body) {
    var first;
    try {
      first = await fetchPage(body, 1, PAGE_SIZE);
    } catch (err) {
      throw new Error('第 1 頁拉取失敗：' + (err && err.message ? err.message : String(err)));
    }
    var totalRow = first.totalRow != null ? Number(first.totalRow) : null;
    var page1 = first.list || [];
    var received = page1.length;
    setMsg('拉取中… 已收 ' + received +
      (totalRow != null && !isNaN(totalRow) ? '／' + totalRow : '') + '（並行）');
    if (!page1.length) return [];

    // totalRow 未知：維持順拉
    if (totalRow == null || isNaN(totalRow)) {
      if (page1.length < PAGE_SIZE) return page1;
      var allSeq = page1.slice();
      var page = 2;
      var guard = 1;
      while (guard++ < 500) {
        var got;
        try {
          got = await fetchPage(body, page, PAGE_SIZE);
        } catch (err) {
          throw new Error('第 ' + page + ' 頁拉取失敗：' + (err && err.message ? err.message : String(err)));
        }
        if (!got.list.length) break;
        allSeq = allSeq.concat(got.list);
        setMsg('拉取中… 已收 ' + allSeq.length + '（順拉）');
        if (got.list.length < PAGE_SIZE) break;
        page += 1;
      }
      return allSeq;
    }

    var totalPages = Math.ceil(totalRow / PAGE_SIZE);
    if (totalPages > 500) totalPages = 500;
    if (totalPages <= 1) return page1;

    var pageNums = [];
    for (var p = 2; p <= totalPages; p++) pageNums.push(p);
    var chunks = [{ page: 1, list: page1 }];
    await mapPool(pageNums, 5, async function (pageNum) {
      var got;
      try {
        got = await fetchPage(body, pageNum, PAGE_SIZE);
      } catch (err) {
        throw new Error('第 ' + pageNum + ' 頁拉取失敗：' + (err && err.message ? err.message : String(err)));
      }
      chunks.push({ page: pageNum, list: got.list || [] });
      received += (got.list || []).length;
      setMsg('拉取中… 已收 ' + received + '／' + totalRow + '（並行）');
    });
    chunks.sort(function (a, b) { return a.page - b.page; });
    var all = [];
    for (var i = 0; i < chunks.length; i++) all = all.concat(chunks[i].list);
    return all;
  }
    async function forEachEventScope(base, fn) {
    var evIds = selectedEventIds();
    if (!evIds.length) return fn(base, '成個項目');
    var acc = [];
    for (var i = 0; i < evIds.length; i++) {
      var part = await fn(Object.assign({}, base, { eventId: evIds[i] }), '場次 ' + (i + 1) + '/' + evIds.length);
      if (Array.isArray(part)) acc = acc.concat(part);
      else acc.push(part);
    }
    return acc;
  }

  async function bootstrap() {
    setMsg('載入商戶／訂單狀態…');
    var merchantRes = await api('GET', SYS + '/auth/sys/org/api/queryMerchantListVO');
    var merchantData = (merchantRes && merchantRes.data) || {};
    state.ptnrId = merchantData.defaultKey || '';
    if (!state.ptnrId && merchantData.commonSelects && merchantData.commonSelects[0]) {
      state.ptnrId = merchantData.commonSelects[0].k;
    }
    if (!state.ptnrId) throw new Error('攞唔到商戶，請確認已登入');
    var enumRes = await api('GET', SYS + '/common/enum/detail', { enumKey: 'OrderStateEnum' });
    var selects = normalizeSelects(enumRes && enumRes.data);
    if (!selects.length) {
      // 少數環境 data 包一層 / 或回傳喺根
      selects = normalizeSelects(enumRes);
    }
    if (!selects.length) {
      throw new Error('訂單狀態枚舉空白（OrderStateEnum）。請重新登入後再試；若仍然空白話我知。');
    }
    fillStatuses(selects);
    setMsg('已載入 ' + selects.length + ' 種狀態。載入近期項目…');
    try {
      var n = await loadUpcomingPresets();
      setMsg('已載入 ' + selects.length + ' 種狀態；近期項目 ' + n + ' 個。可下拉揀或搜尋。');
    } catch (pe) {
      fillPresets([]);
      setMsg('已載入 ' + selects.length + ' 種狀態。近期項目載入失敗，可用搜尋。');
    }
  }

  async function searchProjects() {
    var q = (elQ.value || '').trim();
    if (!q) { setMsg('請輸入項目關鍵字'); return; }
    setMsg('搜尋項目中…');
    var res = await api('GET', PMS + '/pms/project/getProjectComboBoxFuzzy', {
      projectName: q, comboBoxCode: 1, filterPtnrId: state.ptnrId
    });
    var list = (res && res.data) || [];
    if (!Array.isArray(list)) list = list.commonSelects || list.list || [];
    var keep = selectedProjectIds();
    var map = {};
    state.projects.forEach(function (pr) { map[String(pr.projectId)] = pr; });
    (list || []).forEach(function (pr) { map[String(pr.projectId)] = pr; });
    var merged = Object.keys(map).map(function (k) { return map[k]; });
    fillProjects(merged, keep);
    refreshEventsFromSelectedProjects();
    elCountBox.style.display = 'none';
    elPreviewBox.style.display = 'none';
    setMsg('今次搜尋 ' + (list || []).length + ' 個；清單合共 ' + state.projects.length + ' 個（可多選）');
  }

  function refreshEventsFromSelectedProjects(preselectEventIds) {
    var ps = syncSelectedProjects();
    var allEv = [];
    var seenEv = {};
    ps.forEach(function (pr) {
      var evs = (pr && (pr.eventComboBoxVOList || pr.eventList || pr.events)) || [];
      evs.forEach(function (ev) {
        var id = String(ev.eventId);
        if (seenEv[id]) return;
        seenEv[id] = 1;
        allEv.push(ev);
      });
    });
    fillEvents(allEv);
    if (preselectEventIds && preselectEventIds.length) {
      var want = {};
      preselectEventIds.forEach(function (id) { want[String(id)] = 1; });
      Array.prototype.forEach.call(elEvents.options, function (o) {
        if (want[String(o.value)]) o.selected = true;
      });
    }
    return ps;
  }
  elProj.addEventListener('change', function () {
    var ps = refreshEventsFromSelectedProjects();
    elCountBox.style.display = 'none';
    elPreviewBox.style.display = 'none';
    if (!ps.length) setMsg('未揀項目');
    else setMsg('已揀 ' + ps.length + ' 個項目');
  });
  function clearProjectSelection() {
    Array.prototype.forEach.call(elProj.options, function (o) { o.selected = false; });
    refreshEventsFromSelectedProjects();
    setMsg('已取消勾選項目');
  }
  function removeSelectedProjectsFromList() {
    var remove = {};
    selectedProjectIds().forEach(function (id) { remove[String(id)] = 1; });
    if (!Object.keys(remove).length) { setMsg('未有勾選要移除嘅項目'); return; }
    state.projects = state.projects.filter(function (pr) { return !remove[String(pr.projectId)]; });
    fillProjects(state.projects, []);
    refreshEventsFromSelectedProjects();
    elPreset.value = '';
    setMsg('已移除 ' + Object.keys(remove).length + ' 個項目');
  }
  function clearProjectList() {
    state.projects = [];
    fillProjects([], []);
    fillEvents([]);
    elPreset.value = '';
    setMsg('已清空項目清單');
  }
  function fullReset() {
    var today = ymd(new Date());
    elStart.value = today;
    elEnd.value = today;
    elQ.value = '';
    elPreset.value = '';
    state.projects = [];
    state.selectedProject = null;
    state.selectedProjects = [];
    state.previewOrders = [];
    state.countBlocks = [];
    state.rawCountBlocks = [];
    fillProjects([], []);
    fillEvents([]);
    // restore statuses default: closed only if possible
    Array.prototype.forEach.call(elStatus.options, function (o) {
      o.selected = isClosedLabel(o.textContent);
    });
    refreshChips();
    elCountBox.style.display = 'none';
    elCountBox.innerHTML = '';
    if (elViewWrap) elViewWrap.style.display = 'none';
    if (elViewEvent) elViewEvent.checked = true;
    if (elWantTickets) elWantTickets.checked = false;
    elPreviewBox.style.display = 'none';
    elPreviewBox.innerHTML = '';
    setMsg('已全清空重置（商戶／狀態枚舉／近期項目下拉保留）');
  }
  if (root.querySelector('#mz-proj-clear')) {
    root.querySelector('#mz-proj-clear').onclick = clearProjectSelection;
  }
  if (root.querySelector('#mz-proj-remove')) {
    root.querySelector('#mz-proj-remove').onclick = removeSelectedProjectsFromList;
  }
  if (root.querySelector('#mz-proj-clear-all')) {
    root.querySelector('#mz-proj-clear-all').onclick = clearProjectList;
  }
  if (root.querySelector('#mz-reset')) {
    root.querySelector('#mz-reset').onclick = fullReset;
  }
  elPreset.addEventListener('change', function () {
    var v = elPreset.value;
    if (v === '') return;
    applyPreset(Number(v));
  });
  root.querySelector('#mz-proj-search').onclick = function () {
    searchProjects().catch(function (e) { setMsg(friendlyErr(e.message)); alert(friendlyErr(e.message)); });
  };
  elQ.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); root.querySelector('#mz-proj-search').click(); }
  });

  function aggregateBlocks(blocks) {
    var byCode = {};
    var order = [];
    (blocks || []).forEach(function (b) {
      (b.rows || []).forEach(function (r) {
        var k = String(r.code);
        if (!byCode[k]) {
          byCode[k] = { code: r.code, name: r.name, count: 0, tickets: 0, ticketPending: false };
          order.push(k);
        }
        byCode[k].count += Number(r.count) || 0;
        if (r.tickets == null) byCode[k].ticketPending = true;
        else byCode[k].tickets += Number(r.tickets) || 0;
      });
    });
    var rows = order.map(function (k) {
      var r = byCode[k];
      return {
        code: r.code,
        name: r.name,
        count: r.count,
        tickets: r.ticketPending ? null : r.tickets
      };
    });
    var sum = 0, sumTickets = 0, anyT = false, pending = false;
    rows.forEach(function (r) {
      sum += r.count;
      if (r.tickets == null) pending = true;
      else { sumTickets += r.tickets; anyT = true; }
    });
    var nBlocks = (blocks || []).length;
    return [{
      label: '合計（' + nBlocks + ' 個場次／範圍加埋）',
      rows: rows,
      sum: sum,
      sumTickets: pending ? null : (anyT ? sumTickets : 0),
      sc: null
    }];
  }
  function renderCounts(blocks) {
    state.rawCountBlocks = blocks || [];
    var mode = (elViewTotal && elViewTotal.checked) ? 'total' : 'event';
    state.viewMode = mode;
    if (elViewWrap) elViewWrap.style.display = state.rawCountBlocks.length ? 'block' : 'none';
    var view = mode === 'total' ? aggregateBlocks(state.rawCountBlocks) : state.rawCountBlocks;
    // Hide 票張數 when every row.tickets is still null/undefined (order-only stats).
    // Once any numeric value exists (incl. 0), show section; remaining nulls render as …
    var showTickets = false;
    (state.rawCountBlocks || []).forEach(function (b) {
      (b.rows || []).forEach(function (r) {
        if (r.tickets != null) showTickets = true;
      });
    });
    var html = view.map(function (b) {
      var orderPills = b.rows.map(function (r) {
        var on = selectedStatusCodes().indexOf(String(r.code)) >= 0;
        return '<div class="mz-pill' + (on ? ' on' : '') + (r.count ? '' : ' zero') + '">' +
          '<div class="n">' + r.count + '</div><div class="t">' + esc(r.name) + ' · 單</div></div>';
      }).join('');
      var ticketSection = '';
      var sumTicketTxt = '';
      if (showTickets) {
        var ticketPills = b.rows.map(function (r) {
          var on = selectedStatusCodes().indexOf(String(r.code)) >= 0;
          var tv = r.tickets == null ? '…' : r.tickets;
          return '<div class="mz-pill ticket' + (on ? ' on' : '') + (r.count ? '' : ' zero') + '">' +
            '<div class="n">' + tv + '</div><div class="t">' + esc(r.name) + ' · 票</div></div>';
        }).join('');
        var sumT = b.sumTickets;
        sumTicketTxt = sumT == null ? '' : (' · 票 ' + sumT);
        ticketSection = '<h4>票張數</h4><div class="mz-stat">' + ticketPills + '</div>';
      }
      return '<div style="margin-bottom:14px">' +
        '<div style="font-weight:700;margin-bottom:8px;font-size:17px">' + esc(b.label) +
        ' <span style="color:#64748b;font-weight:500">合計 ' + b.sum + ' 單' + sumTicketTxt + '</span></div>' +
        '<h4>單量</h4><div class="mz-stat">' + orderPills + '</div>' +
        ticketSection + '</div>';
    }).join('');
    elCountBox.style.display = 'block';
    var title = showTickets ? '各訂單狀態 · 單量／票張數' : '各訂單狀態 · 單量';
    elCountBox.innerHTML = '<h3>' + title +
      (mode === 'total' ? '（總數）' : '（按場次）') + '</h3>' + html;
  }

  function renderPreview(orders, note) {
    state.previewOrders = orders || [];
    if (!orders.length) {
      elPreviewBox.style.display = 'block';
      elPreviewBox.innerHTML = '<h3>訂單預覽</h3><div class="mz-empty">呢段條件下冇樣本可預覽。</div>';
      return;
    }
    var rows = orders.slice(0, PREVIEW_LIMIT).map(function (r) {
      var closed = isClosedLabel(r.orderStateName);
      return '<tr>' +
        '<td>' + esc(r.orderId) + '</td>' +
        '<td><span class="mz-badge' + (closed ? ' closed' : ' ok') + '">' + esc(r.orderStateName || r.orderState || '') + '</span></td>' +
        '<td>' + esc(r.customerId || '') + '</td>' +
        '<td>' + esc(r.orderTime || '') + '</td>' +
        '<td>' + esc(r.customerName || '') + '<div style="color:#94a3b8">' + esc(r.customerTel || '') + '</div></td>' +
        '<td style="text-align:right">' + esc(ticketOf(r)) + '</td>' +
        '<td style="text-align:right">' + esc(money(r.orderTotalMoney)) + '</td>' +
        '</tr>';
    }).join('');
    elPreviewBox.style.display = 'block';
    elPreviewBox.innerHTML = '<h3>訂單預覽（最多 ' + PREVIEW_LIMIT + ' 張）' +
      (note ? '<span style="font-weight:500;color:#64748b"> · ' + esc(note) + '</span>' : '') + '</h3>' +
      '<div style="overflow:auto"><table class="mz-table"><thead><tr>' +
      '<th>單號</th><th>狀態</th><th>會員ID</th><th>下單時間</th><th>顧客</th><th>票</th><th>金額</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  root.querySelector('#mz-count').onclick = async function () {
    if (state.running) return;
    setBusy(true);
    try {
      var dates = readDatesOrThrow();
      var base = baseFilter(dates);
      var statuses = state.statusList.slice();
      if (!statuses.length) throw new Error('未載入訂單狀態枚舉');
      var projs = projectScopes();
      var evIds = selectedEventIds();
      var blocks = [];
      for (var pi = 0; pi < projs.length; pi++) {
        var pj = projs[pi];
        var eventScopes;
        if (!evIds.length) {
          eventScopes = [{ sc: { projectId: pj.projectId }, label: pj.label + ' · 成個項目' }];
        } else {
          // only events belonging to this project if we can tell; otherwise all selected events
          var pObj = state.selectedProjects.filter(function (x) { return String(x.projectId) === String(pj.projectId); })[0];
          var pEvIds = {};
          ((pObj && (pObj.eventComboBoxVOList || pObj.eventList || pObj.events)) || []).forEach(function (ev) {
            pEvIds[String(ev.eventId)] = 1;
          });
          var useIds = evIds.filter(function (id) { return !Object.keys(pEvIds).length || pEvIds[String(id)]; });
          if (!useIds.length) useIds = evIds;
          eventScopes = useIds.map(function (id) {
            var opt = Array.prototype.find.call(elEvents.options, function (o) { return o.value === String(id); });
            return { sc: { projectId: pj.projectId, eventId: id }, label: pj.label + ' · ' + ((opt && opt.textContent) || id) };
          });
        }
        for (var es = 0; es < eventScopes.length; es++) {
          var sc = eventScopes[es].sc;
          var lab = eventScopes[es].label;
          var rows = [];
          var sum = 0;
          for (var i = 0; i < statuses.length; i++) {
            var st = statuses[i];
            setMsg('統計單量… ' + lab + ' · ' + (st.v || st.k));
            var n = await totalFor(Object.assign({}, base, sc, { orderState: st.k }));
            rows.push({ code: st.k, name: st.v || String(st.k), count: n, tickets: null });
            sum += n;
          }
          blocks.push({ label: lab, rows: rows, sum: sum, sumTickets: null, sc: sc });
        }
      }
      renderCounts(blocks);
      var wantTickets = !!(elWantTickets && elWantTickets.checked);
      if (!wantTickets) {
        setMsg('統計完成（只單量）。勾「計算票數」再統計可加票張。');
      } else {
        for (var s2 = 0; s2 < blocks.length; s2++) {
          var b2 = blocks[s2];
          var sumTickets = 0;
          var anyTicket = false;
          for (var j = 0; j < b2.rows.length; j++) {
            var row = b2.rows[j];
            if (!row.count) { row.tickets = 0; continue; }
            var lab2 = '統計票數… ' + b2.label + ' · ' + row.name;
            var summed = await sumTicketsFor(
              Object.assign({}, base, b2.sc, { orderState: row.code }),
              row.count,
              lab2
            );
            row.tickets = summed.tickets;
            sumTickets += summed.tickets;
            anyTicket = true;
            renderCounts(blocks);
          }
          b2.sumTickets = anyTicket ? sumTickets : 0;
        }
        renderCounts(blocks);
        setMsg('統計完成（含票張數）。可預覽或匯出已選狀態。');
      }
    } catch (err) {
      console.error(err);
      setMsg('統計失敗：' + friendlyErr(err.message));
      alert(friendlyErr(err.message));
    } finally { setBusy(false); }
  };

  root.querySelector('#mz-preview').onclick = async function () {
    if (state.running) return;
    setBusy(true);
    try {
      var dates = readDatesOrThrow();
      var base = baseFilter(dates);
      var codes = selectedStatusCodes();
      if (!codes.length) throw new Error('請至少揀一種訂單狀態');
      var projs = projectScopes();
      var sample = [];
      for (var pi = 0; pi < projs.length && sample.length < PREVIEW_LIMIT; pi++) {
        var pj = projs[pi];
        for (var c = 0; c < codes.length && sample.length < PREVIEW_LIMIT; c++) {
          var code = codes[c];
          setMsg('預覽… ' + pj.label + ' · 狀態 ' + code);
          var part = await forEachEventScope(Object.assign({}, base, { projectId: pj.projectId, orderState: code }), async function (body) {
            var got = await fetchPage(body, 1, PREVIEW_LIMIT);
            return got.list;
          });
          sample = sample.concat(part);
        }
      }
      var seen = {};
      sample = sample.filter(function (r) {
        var id = String(r.orderId);
        if (seen[id]) return false;
        seen[id] = 1;
        return true;
      }).slice(0, PREVIEW_LIMIT);
      renderPreview(sample, '已選 ' + projs.length + ' 項目／' + codes.length + ' 種狀態');
      setMsg('預覽完成（' + sample.length + ' 張樣本）。確認無誤再匯出。');
    } catch (err) {
      console.error(err);
      setMsg('預覽失敗：' + friendlyErr(err.message));
      alert(friendlyErr(err.message));
    } finally { setBusy(false); }
  };

  root.querySelector('#mz-run').onclick = async function () {
    if (state.running) return;
    setBusy(true);
    try {
      var dates = readDatesOrThrow();
      var base = baseFilter(dates);
      var codes = selectedStatusCodes();
      if (!codes.length) throw new Error('請至少揀一種訂單狀態');
      var projs = projectScopes();
      var evIds = selectedEventIds();
      var units = [];
      for (var pi = 0; pi < projs.length; pi++) {
        var pj = projs[pi];
        for (var c = 0; c < codes.length; c++) {
          var code = codes[c];
          var baseBody = Object.assign({}, base, { projectId: pj.projectId, orderState: code });
          if (!evIds.length) {
            units.push({ body: baseBody, label: pj.label + ' · 成個項目 · 狀態 ' + code });
          } else {
            for (var ei = 0; ei < evIds.length; ei++) {
              units.push({
                body: Object.assign({}, baseBody, { eventId: evIds[ei] }),
                label: pj.label + ' · 場次 ' + (ei + 1) + '/' + evIds.length + ' · 狀態 ' + code
              });
            }
          }
        }
      }
      if (!units.length) throw new Error('冇可匯出範圍（請選項目）');
      setMsg('匯出… 範圍 0/' + units.length + ' · 已收 0');
      var finished = 0;
      var rowCount = 0;
      var parts = await mapPool(units, 3, async function (unit) {
        var list = await fetchAllPages(unit.body);
        finished += 1;
        rowCount += list.length;
        setMsg('匯出… 範圍 ' + finished + '/' + units.length + ' · 已收 ' + rowCount);
        return list;
      });
      var rows = [];
      for (var ri = 0; ri < parts.length; ri++) {
        if (parts[ri] && parts[ri].length) rows = rows.concat(parts[ri]);
      }
      var seen = {};
      rows = rows.filter(function (r) {
        var id = String(r.orderId);
        if (seen[id]) return false;
        seen[id] = 1;
        return true;
      });
      if (!rows.length) {
        alert('呢段條件下冇訂單。建議先統計／預覽。');
        setMsg('0 筆');
        return;
      }
      renderPreview(rows.slice(0, PREVIEW_LIMIT), '匯出前最後預覽');
      var cols = [
        'orderId', 'orderState', 'orderStateName',
        'projectId', 'projectName', 'customerId',
        'orderTime',
        'customerName', 'customerTel', 'customerEmail',
        'orderTicketCount', 'orderTotalMoney', 'orderReceiveMoney', 'orderReceiptMoney',
        'orderPayStateName', 'exitTicketStateName', 'printTicketStateName',
        'firstChannelName', 'operatorName'
      ];
      var stamp = new Date();
      var fname = 'maizuo-orders_multi_' +
        stamp.getFullYear() + pad(stamp.getMonth() + 1) + pad(stamp.getDate()) + '_' +
        pad(stamp.getHours()) + pad(stamp.getMinutes()) + '.xls';
      downloadExcel(fname, rows, cols);
      var ticketSum = 0;
      for (var ti = 0; ti < rows.length; ti++) ticketSum += ticketOf(rows[ti]);
      setMsg('完成：' + rows.length + ' 單／' + ticketSum + ' 票 → ' + fname);
      alert('完成：匯出 ' + rows.length + ' 單（' + projs.length + ' 個項目），合共 ' + ticketSum + ' 張票');
    } catch (err) {
      console.error(err);
      setMsg('失敗：' + friendlyErr(err.message));
      alert(friendlyErr(err.message));
    } finally { setBusy(false); }
  };

  bootstrap().catch(function (e) {
    setMsg('初始化失敗：' + friendlyErr(e.message));
    alert(friendlyErr(e.message));
  });
})();
