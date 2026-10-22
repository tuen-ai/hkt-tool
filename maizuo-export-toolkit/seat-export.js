(async function () {
  'use strict';
  if (!/maizuo\.imaitix\.com$/i.test(location.hostname)) {
    alert('請先打開並登入 https://maizuo.imaitix.com');
    return;
  }

  var PMS = 'https://pms-sig.imaitix.com';
  var BI = 'https://bi-sig.imaitix.com';
  var MC = 'https://mc-sig.imaitix.com';
  var PANEL_ID = 'mz-seat-export-panel';
  var SLEEP_BETWEEN_MS = 2000;
  /* 兩個報表匯出都可能好耐——輪詢要夠長，唔好當 timeout 失敗 */
  var INFO_POLL_MAX = 300;       /* 座位信息：最多約 300×3s ≈ 15 分鐘 */
  var INFO_POLL_MS = 3000;
  var INFO_MC_AFTER = 3;         /* 連續幾次仍無 URL 且提示消息中心 → 改試 MC */
  var STATUS_POLL_MAX = 240;     /* 座位狀態：最多約 240×requestInterval(常 5s) ≈ 20 分鐘 */
  var MC_POLL_MAX = 80;          /* 消息中心等「點擊下載」：最多約 80×3s ≈ 4 分鐘 */
  var MC_POLL_MS = 3000;

  var old = document.getElementById(PANEL_ID);
  if (old) old.remove();

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
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
  function safeName(s) {
    return String(s == null ? '' : s).replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80) || 'event';
  }

  /** Unwrap Maizuo envelope: often {success, data} where data is URL / object / nested. */
  function unwrapData(json) {
    if (json == null) return null;
    if (typeof json !== 'object') return json;
    if (json.success === false) {
      var em = json.errorMsg || json.message || json.msg || '請求失敗';
      var code = json.code != null ? String(json.code) : '';
      var err = new Error(em + (code ? ' (' + code + ')' : ''));
      err.code = code;
      throw err;
    }
    if ('data' in json) return json.data;
    return json;
  }

  function isImageUrl(u) {
    if (!u) return false;
    var s = String(u).split('?')[0].toLowerCase();
    if (/\.(xlsx|xls|csv|zip|pdf)$/i.test(s)) return false;
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(s);
  }
  function isSpreadsheetUrl(u) {
    if (!u) return false;
    var s = String(u).split('?')[0].toLowerCase();
    return /\.(xlsx|xls|csv|zip)$/i.test(s) || /excel|spreadsheet|application\/vnd|disposition=attachment/i.test(String(u));
  }
  /** 報表下載鏈：xlsx／zip／pdf（座位狀態常見 PDF） */
  function isPdfUrl(u) {
    if (!u) return false;
    var s = String(u).split('?')[0].toLowerCase();
    return /\.pdf$/i.test(s) || /\/pdf|application\/pdf|\.pdf(\?|$)/i.test(String(u));
  }
  function isReportFileUrl(u) {
    return isSpreadsheetUrl(u) || isPdfUrl(u);
  }
  function extFromUrlOrKind(url, kind) {
    var s = String(url || '').split('?')[0].toLowerCase();
    var m = s.match(/\.(xlsx|xls|csv|zip|pdf)$/i);
    if (m) return '.' + m[1].toLowerCase();
    if (kind === '座位狀態') return '.pdf';
    return '.xlsx';
  }
  /** Extract spreadsheet download URL; ignore seatmap PNG/JPG. */
  function extractUrl(payload) {
    function pick(u) {
      if (!u || typeof u !== 'string') return '';
      u = u.trim();
      if (!/^https?:\/\//i.test(u)) return '';
      if (isImageUrl(u) && !isSpreadsheetUrl(u)) return '';
      return u;
    }
    if (payload == null || payload === false) return '';
    if (typeof payload === 'string') return pick(payload);
    if (typeof payload === 'object') {
      var keys = ['downloadUrl', 'fileUrl', 'excelUrl', 'xlsxUrl', 'ossUrl', 'url', 'filePath', 'path', 'link', 'data'];
      var firstAny = '';
      for (var i = 0; i < keys.length; i++) {
        var v = payload[keys[i]];
        if (typeof v !== 'string') continue;
        var p = pick(v);
        if (p && isSpreadsheetUrl(p)) return p;
        if (p && !firstAny) firstAny = p;
        if (!p && /^https?:\/\//i.test(v.trim()) && isImageUrl(v)) continue;
      }
      if (firstAny && !isImageUrl(firstAny)) return firstAny;
    }
    return '';
  }

  /** Truthy non-URL string from export (modal tip) — treat as "still processing" if not URL. */
  function isProcessingHint(payload) {
    if (payload == null || payload === false || payload === '') return true;
    if (typeof payload === 'string' && !/^https?:\/\//i.test(payload.trim())) return true;
    return false;
  }
  function payloadText(payload) {
    if (payload == null) return '';
    if (typeof payload === 'string') return payload;
    if (typeof payload === 'object') {
      return String(payload.msg || payload.message || payload.errorMsg || payload.tip || payload.data || '');
    }
    return String(payload);
  }
  /** 官方提示：匯出中／完成後去消息中心——唔當錯誤 */
  function mentionsMessageCenter(payload) {
    var t = payloadText(payload);
    return /消息中心|訊息中心|message\s*center|导出中|匯出中|導出中|导出完成|匯出完成/i.test(t);
  }
  function isHardExportError(payload) {
    var t = payloadText(payload);
    if (!t) return false;
    if (mentionsMessageCenter(payload)) return false;
    return /過於頻繁|过于频繁|無座|无座|無權|无权|失敗|失败|error/i.test(t) &&
      !/导出中|匯出中|導出中/.test(t);
  }

  async function api(method, url, data) {
    var opts = {
      method: method,
      credentials: 'include',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'X-XSRF-TOKEN': getCookie('XSRF-TOKEN') || '',
        'Origin': 'https://maizuo.imaitix.com'
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
      opts.body = JSON.stringify(data != null ? data : {});
    }
    var res = await fetch(url, opts);
    var json = await res.json().catch(function () { return null; });
    if (!res.ok) {
      var msg = (json && (json.errorMsg || json.message)) || ('HTTP ' + res.status);
      throw new Error(msg);
    }
    return json;
  }

  /** Cross-origin OSS often blocks fetch；只用隱藏 iframe 觸發一次下載（唔開新分頁、唔同時 a+iframe 以免重覆） */
  function triggerHiddenDownload(url, filename) {
    // 只觸發一次：隱藏 iframe（唔好同時 a.click，否則會重覆兩份）
    var iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    if (filename) iframe.setAttribute('data-filename', filename);
    iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;left:-9999px;top:-9999px;opacity:0;pointer-events:none';
    iframe.src = url;
    document.body.appendChild(iframe);
    setTimeout(function () { try { iframe.remove(); } catch (e2) {} }, 60000);
  }

  async function downloadBlob(url, filename) {
    if (isImageUrl(url) && !isReportFileUrl(url)) {
      var imgErr = new Error('連結係座位圖圖片而非報表，已忽略（唔開新分頁）');
      imgErr.code = 'SEATMAP_IMAGE';
      throw imgErr;
    }
    async function tryFetch(creds) {
      return fetch(url, { credentials: creds, mode: 'cors' }).catch(function () { return null; });
    }
    var res = await tryFetch('omit');
    if (!res || !res.ok) res = await tryFetch('include');
    if (res && res.ok) {
      var ct = (res.headers.get('content-type') || '').toLowerCase();
      if (/image\//.test(ct) && !/spreadsheet|excel|zip|pdf|octet-stream|officedocument/.test(ct)) {
        var imgErr2 = new Error('下載內容係圖片而非報表，已忽略');
        imgErr2.code = 'SEATMAP_IMAGE';
        throw imgErr2;
      }
      var blob = await res.blob();
      if (blob && blob.type && /^image\//i.test(blob.type) && blob.type.indexOf('officedocument') < 0) {
        var imgErr3 = new Error('下載內容係圖片而非報表，已忽略');
        imgErr3.code = 'SEATMAP_IMAGE';
        throw imgErr3;
      }
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
      return 'saved';
    }
    // CORS／網絡：唔開新分頁，隱藏 iframe + a[download] 觸發瀏覽器下載
    triggerHiddenDownload(url, filename);
    return 'triggered';
  }

  var state = {
    projects: [],
    events: [],
    treeSource: '',
    srcLabel: '',
    running: false,
    abort: false,
    downloadedUrls: {},
    downloadedKeys: {}
  };

  var root = document.createElement('div');
  root.id = PANEL_ID;
  root.innerHTML =
    '<style>' +
    '#' + PANEL_ID + '{position:fixed;z-index:2147483000;left:auto;right:16px;top:16px;width:min(520px,96vw);' +
    'max-height:92vh;overflow:auto;background:#fff;border-radius:16px;border:1px solid #dbe7f3;' +
    'box-shadow:0 16px 40px rgba(37,99,235,.14);' +
    'font:13px/1.5 system-ui,-apple-system,"PingFang HK","Microsoft JhengHei",sans-serif;color:#0f172a}' +
    '#' + PANEL_ID + ' .hd{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;' +
    'background:linear-gradient(135deg,#2563eb,#38bdf8);color:#fff;border-radius:16px 16px 0 0;' +
    'cursor:move;user-select:none}' +
    '#' + PANEL_ID + ' .hd b{font-size:16px;letter-spacing:.02em;font-weight:700}' +
    '#' + PANEL_ID + ' .bd{padding:14px 16px 16px;background:#f8fbff}' +
    '#' + PANEL_ID + ' .sec{margin-bottom:12px;padding:12px;background:#fff;border:1px solid #e2eaf4;border-radius:12px}' +
    '#' + PANEL_ID + ' .sec:last-of-type{margin-bottom:0}' +
    '#' + PANEL_ID + ' .sec-title{font-size:11px;font-weight:700;color:#3b82f6;margin:0 0 10px;letter-spacing:.03em}' +
    '#' + PANEL_ID + ' .row{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:10px;align-items:flex-end}' +
    '#' + PANEL_ID + ' .row:last-child{margin-bottom:0}' +
    '#' + PANEL_ID + ' label{display:flex;flex-direction:column;gap:5px;font-size:12px;color:#475569;min-width:120px;flex:1}' +
    '#' + PANEL_ID + ' input,#' + PANEL_ID + ' select{padding:9px 10px;border:1px solid #cfe0f5;border-radius:9px;font-size:13px;background:#fff}' +
    '#' + PANEL_ID + ' select[multiple]{min-height:118px}' +
    '#' + PANEL_ID + ' .btn{padding:9px 12px;border-radius:9px;border:1px solid #cfe0f5;background:#fff;cursor:pointer;font-weight:600;font-size:12.5px;color:#1e3a5f}' +
    '#' + PANEL_ID + ' .btn.primary{background:#2563eb;color:#fff;border-color:#2563eb}' +
    '#' + PANEL_ID + ' .btn.ghost{background:#eff6ff;border-color:#bfdbfe;color:#1d4ed8}' +
    '#' + PANEL_ID + ' .btn:disabled{opacity:.45;cursor:not-allowed}' +
    '#' + PANEL_ID + ' .msg{color:#334155;margin:10px 0 8px;min-height:1.2em;font-size:12.5px}' +
    '#' + PANEL_ID + ' .msg.err{color:#b91c1c}' +
    '#' + PANEL_ID + ' .x{background:rgba(255,255,255,.14);border:0;color:#fff;font-size:18px;cursor:pointer;' +
    'width:30px;height:30px;border-radius:8px;line-height:1}' +
    '#' + PANEL_ID + ' .hint{font-size:11px;color:#64748b;margin:6px 0 0;line-height:1.45}' +
    '#' + PANEL_ID + ' .chkrow{display:flex;flex-wrap:wrap;gap:16px;margin:2px 0 0;align-items:center}' +
    '#' + PANEL_ID + ' .chkrow label{flex-direction:row;align-items:center;gap:7px;min-width:0;color:#0f172a;font-size:13px}' +
    '#' + PANEL_ID + ' .log{background:#eff6ff;border:1px solid #dbeafe;border-radius:10px;padding:10px 12px;' +
    'max-height:220px;overflow:auto;font:12px/1.45 ui-monospace,monospace;white-space:pre-wrap;word-break:break-word;color:#1e3a5f}' +
    '#' + PANEL_ID + ' .log .ok{color:#047857}' +
    '#' + PANEL_ID + ' .log .warn{color:#b45309}' +
    '#' + PANEL_ID + ' .log .err{color:#b91c1c}' +
    '#' + PANEL_ID + ' a.link{color:#2563eb;font-weight:600}' +
    '#' + PANEL_ID + '.collapsed{max-height:none;overflow:visible}' +
    '#' + PANEL_ID + '.collapsed .bd{display:none!important}' +
    '#' + PANEL_ID + ' .hd .tools{display:flex;gap:4px;align-items:center}' +
    '#' + PANEL_ID + ' .actions{display:flex;gap:10px;margin-top:12px;flex-wrap:wrap}' +
    '</style>' +
    '<div class="hd"><div><b>座位報表導出工具</b></div>' +
    '<div class="tools"><button type="button" class="x" id="mz-se-min" title="疊起／展開">–</button>' +
    '<button type="button" class="x" id="mz-se-close" title="關閉">×</button></div></div>' +
    '<div class="bd" id="mz-se-body">' +
    '<div class="sec">' +
    '<div class="sec-title">1 · 篩選</div>' +
    '<div class="row">' +
    '<label style="flex:2">項目關鍵字<input id="mz-se-pq" placeholder="輸入即篩選（如 weeknd / Twins）" /></label>' +
    '<button type="button" class="btn ghost" id="mz-se-reload">重新載入</button>' +
    '</div>' +
    '<div class="row">' +
    '<label>活動開始（由）<input type="date" id="mz-se-from" /></label>' +
    '<label>活動開始（至）<input type="date" id="mz-se-to" /></label>' +
    '<button type="button" class="btn ghost" id="mz-se-apply-date">套用時段</button>' +
    '</div>' +
    '<div class="chkrow">' +
    '<label><input type="checkbox" id="mz-se-cross" /> 跨項目：時段內全部場次</label>' +
    '</div>' +
    '<div class="hint">時段會同時篩<strong>項目</strong>同<strong>場次</strong>（預設今日→未來半年）。清空日期＝唔限。</div>' +
    '</div>' +
    '<div class="sec">' +
    '<div class="sec-title">2 · 揀項目／場次</div>' +
    '<div class="row">' +
    '<label style="flex:1">項目（可多選）<select id="mz-se-proj" multiple size="8"></select>' +
    '<span class="hint" id="mz-se-src">載入中…</span></label>' +
    '<label style="flex:1.15">場次（可多選）' +
    '<select id="mz-se-events" multiple size="8"></select>' +
    '<span class="hint">Ctrl／⌘ 多選</span></label>' +
    '</div>' +
    '<div class="row">' +
    '<button type="button" class="btn ghost" id="mz-se-proj-all">全選可見項目</button>' +
    '<button type="button" class="btn ghost" id="mz-se-proj-none">清空項目</button>' +
    '<button type="button" class="btn ghost" id="mz-se-all">全選場次</button>' +
    '<button type="button" class="btn ghost" id="mz-se-none">清空場次</button>' +
    '</div>' +
    '</div>' +
    '<div class="sec">' +
    '<div class="sec-title">3 · 報表同導出</div>' +
    '<div class="chkrow">' +
    '<label><input type="checkbox" id="mz-se-info" checked /> 座位信息（xlsx）</label>' +
    '<label><input type="checkbox" id="mz-se-status" checked /> 座位狀態（消息中心自動下載）</label>' +
    '</div>' +
    '<div class="hint">完成後自動搵「点击下载」；座位狀態多數係 PDF，座位信息係 xlsx。</div>' +
    '<div class="actions">' +
    '<button type="button" class="btn primary" id="mz-se-go">開始導出</button>' +
    '<button type="button" class="btn" id="mz-se-stop" disabled>停止</button>' +
    '<button type="button" class="btn ghost" id="mz-se-close2">關閉</button>' +
    '</div>' +
    '<div class="msg" id="mz-se-msg">載入中…</div>' +
    '<div class="log" id="mz-se-log"></div>' +
    '</div>' +
    '</div>';
  document.body.appendChild(root);

  var elBody = root.querySelector('#mz-se-body');
  var elMsg = root.querySelector('#mz-se-msg');
  var elPq = root.querySelector('#mz-se-pq');
  var elProj = root.querySelector('#mz-se-proj');
  var elEvents = root.querySelector('#mz-se-events');
  var elSrc = root.querySelector('#mz-se-src');
  var elGo = root.querySelector('#mz-se-go');
  var elStop = root.querySelector('#mz-se-stop');
  var elLog = root.querySelector('#mz-se-log');
  var elInfo = root.querySelector('#mz-se-info');
  var elStatus = root.querySelector('#mz-se-status');
  var elFrom = root.querySelector('#mz-se-from');
  var elTo = root.querySelector('#mz-se-to');
  var elCross = root.querySelector('#mz-se-cross');
  state.eventsRaw = [];

  function pad2(n) { return n < 10 ? '0' + n : String(n); }
  function fmtYmd(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  /** 預設活動開始：開 tool 當日 → 未來半年 */
  function presetDateRange() {
    var from = new Date();
    from.setHours(0, 0, 0, 0);
    var to = new Date(from.getFullYear(), from.getMonth() + 6, from.getDate());
    elFrom.value = fmtYmd(from);
    elTo.value = fmtYmd(to);
  }
  presetDateRange();

  function setMsg(t, err) {
    elMsg.textContent = t || '';
    elMsg.className = 'msg' + (err ? ' err' : '');
  }
  function logLine(text, cls) {
    var line = document.createElement('div');
    if (cls) line.className = cls;
    line.textContent = text;
    elLog.appendChild(line);
    elLog.scrollTop = elLog.scrollHeight;
  }
  function clearLog() { elLog.innerHTML = ''; }

  root.querySelector('#mz-se-close').onclick = function () { root.remove(); };
  root.querySelector('#mz-se-close2').onclick = function () { root.remove(); };
  var elMin = root.querySelector('#mz-se-min');
  elMin.onclick = function (e) {
    e.stopPropagation();
    var collapsed = root.classList.toggle('collapsed');
    elMin.textContent = collapsed ? '+' : '–';
    elMin.title = collapsed ? '展開' : '疊起';
  };
  // 拖曳標題列
  (function enableDrag() {
    var hd = root.querySelector('.hd');
    var dragging = false, ox = 0, oy = 0;
    hd.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      if (e.target && e.target.closest && e.target.closest('button')) return;
      dragging = true;
      var rect = root.getBoundingClientRect();
      ox = e.clientX - rect.left;
      oy = e.clientY - rect.top;
      root.style.right = 'auto';
      root.style.left = rect.left + 'px';
      root.style.top = rect.top + 'px';
      e.preventDefault();
    });
    window.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var nx = e.clientX - ox;
      var ny = e.clientY - oy;
      var maxX = Math.max(0, window.innerWidth - root.offsetWidth);
      var maxY = Math.max(0, window.innerHeight - 40);
      if (nx < 0) nx = 0;
      if (ny < 0) ny = 0;
      if (nx > maxX) nx = maxX;
      if (ny > maxY) ny = maxY;
      root.style.left = nx + 'px';
      root.style.top = ny + 'px';
    });
    window.addEventListener('mouseup', function () { dragging = false; });
  })();
  elStop.onclick = function () {
    state.abort = true;
    setMsg('正在停止…（完成當前場次後停止）');
  };


  function parseDateFromText(s) {
    if (s == null || s === '') return null;
    s = String(s).trim();
    var m = s.match(/(\d{4})[-\/.年](\d{1,2})[-\/.月](\d{1,2})/);
    if (m) {
      var y = +m[1], mo = +m[2], d = +m[3];
      var dt = new Date(y, mo - 1, d);
      if (!isNaN(dt.getTime())) return dt;
    }
    var t = Date.parse(s.replace(/-/g, '/'));
    if (!isNaN(t)) {
      var dt2 = new Date(t);
      return new Date(dt2.getFullYear(), dt2.getMonth(), dt2.getDate());
    }
    return null;
  }
  /** 多日場／全程通門票：字串可能係「2026-11-17 09:00 ~ 2026-11-22 23:59」——攞第一個日期做開始、最後一個做結束 */
  function parseDateRangeFromText(s) {
    if (s == null || s === '') return { start: null, end: null };
    s = String(s);
    var all = [];
    var re = /(\d{4})[-\/.年](\d{1,2})[-\/.月](\d{1,2})/g;
    var m;
    while ((m = re.exec(s))) {
      var dt = new Date(+m[1], +m[2] - 1, +m[3]);
      if (!isNaN(dt.getTime())) all.push(dt);
    }
    if (!all.length) {
      var one = parseDateFromText(s);
      return { start: one, end: one };
    }
    return { start: all[0], end: all[all.length - 1] };
  }
  function parseEventStart(ev) {
    /* PMS 場次列表 UI 用 showStartTime／effectDate（唔係 showTime／startTime） */
    var candidates = [
      ev.showStartTime, ev.effectDate, ev.startTime, ev.eventStartTime, ev.beginTime,
      ev.showTime, ev.eventTime, ev.eventStart, ev.startDate, ev.performTime,
      ev.showEndTime, ev.eventName, ev.name, ev.title, ev.v, ev.label
    ];
    for (var i = 0; i < candidates.length; i++) {
      var s = candidates[i];
      if (s == null || s === '') continue;
      var range = parseDateRangeFromText(s);
      if (range.start) return range.start;
    }
    return null;
  }
  function parseEventEnd(ev) {
    var candidates = [
      ev.endTime, ev.eventEndTime, ev.finishTime, ev.showEndTime, ev.effectEndDate,
      ev.eventEnd, ev.endDate, ev.showStartTime, ev.effectDate,
      ev.startTime, ev.eventStartTime, ev.showTime, ev.eventTime,
      ev.eventName, ev.name, ev.title, ev.v, ev.label
    ];
    for (var i = 0; i < candidates.length; i++) {
      var s = candidates[i];
      if (s == null || s === '') continue;
      var range = parseDateRangeFromText(s);
      if (range.end) return range.end;
    }
    return null;
  }
  function periodBounds() {
    var fromS = (elFrom.value || '').trim();
    var toS = (elTo.value || '').trim();
    var from = null, to = null;
    if (fromS) {
      var a = fromS.split('-');
      from = new Date(+a[0], +a[1] - 1, +a[2]);
      from.setHours(0, 0, 0, 0);
    }
    if (toS) {
      var b = toS.split('-');
      to = new Date(+b[0], +b[1] - 1, +b[2]);
      to.setHours(23, 59, 59, 999);
    }
    return { from: from, to: to };
  }
  function inPeriod(ev, bounds) {
    if (!bounds.from && !bounds.to) return true;
    var st = ev.startDate || parseEventStart(ev);
    var en = ev.endDate || parseEventEnd(ev) || st;
    /* 有設時段但解析唔到日期：仍顯示（通門票／PMS 缺日期欄唔好靜靜濾走） */
    if (!st && !en) return true;
    if (!st) st = en;
    if (!en) en = st;
    // 區間重疊：場次 [st,en] 同篩選 [from,to] 有交集就收（多日通門票）
    if (bounds.to && st > bounds.to) return false;
    if (bounds.from && en < bounds.from) return false;
    return true;
  }

  /** 項目喺當前活動開始時段內有冇至少一場 */
  function projectHasEventsInPeriod(pr, bounds) {
    if (!bounds.from && !bounds.to) return true;
    var list = eventsFromProject(pr);
    for (var i = 0; i < list.length; i++) {
      if (inPeriod(list[i], bounds)) return true;
    }
    return false;
  }
  function enrichEvent(ev, projectName, projectId) {
    var start = parseEventStart(ev);
    var end = parseEventEnd(ev);
    var showTime = ev.showTime || ev.showStartTime || ev.eventTime || ev.effectDate || '';
    if (!showTime && (ev.startTime || ev.endTime || ev.showEndTime)) {
      var st0 = ev.startTime || ev.showStartTime || '';
      var en0 = ev.endTime || ev.showEndTime || '';
      showTime = String(st0) + (en0 ? ' ~ ' + en0 : '');
    } else if (showTime && (ev.showEndTime || ev.endTime) && String(showTime).indexOf('~') < 0) {
      var en1 = ev.showEndTime || ev.endTime;
      if (en1 && String(showTime) !== String(en1)) showTime = String(showTime) + ' ~ ' + en1;
    }
    return {
      eventId: ev.eventId != null ? ev.eventId : (ev.k != null ? ev.k : ev.id),
      eventName: ev.eventName || ev.name || ev.v || ev.title || ev.showTime || ev.showStartTime || '',
      showTime: showTime,
      showStartTime: ev.showStartTime || '',
      effectDate: ev.effectDate || '',
      showEndTime: ev.showEndTime || '',
      startDate: start,
      endDate: end || start,
      projectId: projectId != null ? projectId : ev.projectId,
      projectName: projectName || ev.projectName || ''
    };
  }
  function collectAllEvents() {
    var out = [];
    (state.projects || []).forEach(function (pr) {
      var list = pr.events || [];
      if (!list.length) {
        list = (pr.eventComboBoxVOList || pr.eventList || []).map(function (ev) {
          return {
            eventId: ev.eventId != null ? ev.eventId : ev.k,
            eventName: ev.eventName || ev.name || ev.v || ev.showTime || ev.showStartTime || '',
            showTime: ev.showTime || ev.showStartTime || '',
            showStartTime: ev.showStartTime || '',
            effectDate: ev.effectDate || '',
            showEndTime: ev.showEndTime || ''
          };
        });
      }
      list.forEach(function (ev) {
        var e = enrichEvent(ev, pr.projectName || pr.name, pr.projectId);
        if (e.eventId != null && e.eventId !== '') out.push(e);
      });
    });
    return out;
  }
  function applyEventFilter() {
    var bounds = periodBounds();
    var raw = state.eventsRaw || [];
    var filtered = raw.filter(function (ev) { return inPeriod(ev, bounds); });
    filtered.sort(function (a, b) {
      var ta = a.startDate ? a.startDate.getTime() : 0;
      var tb = b.startDate ? b.startDate.getTime() : 0;
      if (ta !== tb) return ta - tb;
      return String(a.eventName || '').localeCompare(String(b.eventName || ''), 'zh');
    });
    state.events = filtered;
    elEvents.innerHTML = '';
    if (!filtered.length) {
      var o = document.createElement('option');
      o.disabled = true;
      o.textContent = bounds.from || bounds.to ? '（此時段無場次）' : '（無場次）';
      elEvents.appendChild(o);
      return 0;
    }
    filtered.forEach(function (ev) {
      var o = document.createElement('option');
      o.value = String(ev.eventId);
      var label = ev.eventName || ('場次 ' + o.value);
      if (ev.showTime && label.indexOf(String(ev.showTime)) < 0) label += ' · ' + ev.showTime;
      if (ev.startDate) {
        var ds = ev.startDate.getFullYear() + '-' +
          (function(n){n=n+1;return n<10?'0'+n:''+n;})(ev.startDate.getMonth()) + '-' +
          (function(n){return n<10?'0'+n:''+n;})(ev.startDate.getDate());
        if (label.indexOf(ds) < 0) label = ds + ' · ' + label;
      }
      if ((elCross.checked || selectedProjectIds().length > 1) && ev.projectName) label = '[' + ev.projectName + '] ' + label;
      o.textContent = label + ' [' + o.value + ']';
      o.selected = true;
      elEvents.appendChild(o);
    });
    return filtered.length;
  }

    function projectListFromPms(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.commonSelects)) {
      return data.commonSelects.map(function (it) {
        return {
          projectId: it.k != null ? it.k : it.projectId,
          projectName: it.v != null ? it.v : it.projectName,
          eventComboBoxVOList: it.eventComboBoxVOList || it.eventList || it.events || []
        };
      });
    }
    if (Array.isArray(data.list)) return data.list;
    return [];
  }

  /** BI tree: projects with children {title,id} */
  function projectListFromBi(data) {
    var arr = data;
    if (arr && !Array.isArray(arr) && Array.isArray(arr.list)) arr = arr.list;
    if (arr && !Array.isArray(arr) && Array.isArray(arr.data)) arr = arr.data;
    if (!Array.isArray(arr)) return [];
    return arr.map(function (p) {
      var pid = p.id != null ? p.id : (p.projectId != null ? p.projectId : p.value);
      var pname = p.projectName || p.title || p.label || p.name || ('項目 ' + pid);
      var children = p.children || p.eventList || p.events || (p.item && p.item.children) || [];
      return {
        projectId: pid,
        projectName: pname,
        events: (children || []).map(function (c) {
          return {
            eventId: c.id != null ? c.id : (c.eventId != null ? c.eventId : c.value),
            eventName: c.title || c.eventName || c.label || c.name || c.showTime || '',
            showTime: c.showTime || c.eventTime || c.startTime || '',
            startTime: c.startTime || c.eventStartTime || c.beginTime || c.showTime || c.eventTime || ''
          };
        }).filter(function (e) { return e.eventId != null && e.eventId !== ''; })
      };
    }).filter(function (p) { return p.projectId != null && p.projectId !== ''; });
  }

  function fillProjects(list) {
    state.projects = list || [];
    renderProjectOptions();
  }

  function projectMatchesQuery(pr, q) {
    if (!q) return true;
    var name = String(pr.projectName || pr.name || '').toLowerCase();
    var id = String(pr.projectId || '');
    var compact = name.replace(/\s+/g, '');
    var q2 = q.replace(/\s+/g, '');
    return name.indexOf(q) >= 0 || compact.indexOf(q2) >= 0 || id.indexOf(q) >= 0;
  }

  function renderProjectOptions(keepIds) {
    var q = (elPq.value || '').trim().toLowerCase();
    var keep = keepIds || selectedProjectIds();
    var bounds = periodBounds();
    var hasPeriod = !!(bounds.from || bounds.to);
    elProj.innerHTML = '';
    var shown = (state.projects || []).filter(function (pr) {
      if (!projectMatchesQuery(pr, q)) return false;
      if (hasPeriod && !projectHasEventsInPeriod(pr, bounds)) return false;
      return true;
    });
    if (elSrc) {
      var base = state.srcLabel || '來源：—';
      if (state.projects && state.projects.length) {
        var bits = [];
        if (q) bits.push('關鍵字「' + (elPq.value || '').trim() + '」');
        if (hasPeriod) bits.push('時段內');
        elSrc.textContent = bits.length
          ? (base + ' · ' + bits.join('+') + ' ' + shown.length + '/' + state.projects.length)
          : base;
      } else if (state.srcLabel) {
        elSrc.textContent = base;
      }
    }
    if (!shown.length) {
      var o = document.createElement('option');
      o.disabled = true;
      o.textContent = hasPeriod || q ? '（此時段／關鍵字無項目）' : '（無項目）';
      elProj.appendChild(o);
      return shown.length;
    }
    shown.forEach(function (pr) {
      var o = document.createElement('option');
      o.value = String(pr.projectId);
      o.textContent = (pr.projectName || pr.name || '項目') + ' [' + pr.projectId + ']';
      if (keep.indexOf(o.value) >= 0) o.selected = true;
      elProj.appendChild(o);
    });
    return shown.length;
  }

  function selectedProjectIds() {
    return Array.prototype.slice.call(elProj.selectedOptions || [])
      .filter(function (o) { return !o.disabled && o.value; })
      .map(function (o) { return o.value; });
  }

  function selectedProjects() {
    var ids = selectedProjectIds();
    return ids.map(function (id) {
      return state.projects.find(function (p) { return String(p.projectId) === id; }) || { projectId: id };
    });
  }

  function eventsFromProject(pr) {
    var metaName = pr.projectName || pr.name || '';
    var metaId = pr.projectId;
    var list = pr.events || [];
    if (!list.length) {
      list = (pr.eventComboBoxVOList || pr.eventList || []).map(function (ev) {
        return {
          eventId: ev.eventId != null ? ev.eventId : ev.k,
          eventName: ev.eventName || ev.name || ev.v || ev.showTime || ev.showStartTime || '',
          showTime: ev.showTime || ev.showStartTime || '',
          showStartTime: ev.showStartTime || '',
          effectDate: ev.effectDate || '',
          showEndTime: ev.showEndTime || '',
          startTime: ev.startTime || ev.showStartTime || ev.showTime || ev.effectDate,
          endTime: ev.endTime || ev.showEndTime || ''
        };
      });
    }
    return (list || []).map(function (ev) {
      return enrichEvent(ev, metaName, metaId);
    }).filter(function (e) { return e.eventId != null && e.eventId !== ''; });
  }

  function fillEvents(list, projectMeta) {
    var meta = projectMeta || {};
    state.eventsRaw = (list || []).map(function (ev) {
      return enrichEvent(ev, meta.projectName, meta.projectId);
    }).filter(function (e) { return e.eventId != null && e.eventId !== ''; });
    applyEventFilter();
  }

  function fillEventsFromProjects(prs) {
    var out = [];
    var seen = {};
    (prs || []).forEach(function (pr) {
      eventsFromProject(pr).forEach(function (e) {
        var k = String(e.eventId);
        if (seen[k]) return;
        seen[k] = 1;
        out.push(e);
      });
    });
    state.eventsRaw = out;
    return applyEventFilter();
  }

  function selectedEvents() {
    return Array.prototype.slice.call(elEvents.selectedOptions || [])
      .filter(function (o) { return !o.disabled && o.value; })
      .map(function (o) {
        var ev = state.events.find(function (e) {
          return String(e.eventId != null ? e.eventId : e.k) === o.value;
        });
        return {
          eventId: o.value,
          eventName: (ev && (ev.eventName || ev.name || ev.title || ev.v)) || o.textContent,
          projectId: ev && ev.projectId,
          projectName: ev && ev.projectName
        };
      });
  }

  root.querySelector('#mz-se-all').onclick = function () {
    Array.prototype.forEach.call(elEvents.options, function (o) {
      if (!o.disabled) o.selected = true;
    });
  };
  root.querySelector('#mz-se-none').onclick = function () {
    Array.prototype.forEach.call(elEvents.options, function (o) { o.selected = false; });
  };
  root.querySelector('#mz-se-proj-all').onclick = async function () {
    if (elCross.checked) elCross.checked = false;
    Array.prototype.forEach.call(elProj.options, function (o) {
      if (!o.disabled) o.selected = true;
    });
    fillEvents([]);
    setMsg('載入場次…');
    await refreshEventsByMode();
  };
  root.querySelector('#mz-se-proj-none').onclick = function () {
    Array.prototype.forEach.call(elProj.options, function (o) { o.selected = false; });
    if (!elCross.checked) {
      fillEvents([]);
      setMsg('請揀項目（可多選）');
    }
  };
  function onProjectQueryChange() {
    var keep = selectedProjectIds();
    var n = renderProjectOptions(keep);
    var still = selectedProjectIds();
    if (!elCross.checked && !still.length) {
      fillEvents([]);
      setMsg(n ? '請揀項目（可多選）' : '無符合關鍵字嘅項目——改關鍵字或撳重新載入');
    } else if (!elCross.checked && still.length) {
      refreshEventsByMode();
    } else if (elCross.checked) {
      refreshEventsByMode();
    }
  }
  // input + compositionend（中文 IME）+ search（清除 ×）；唔再用 oninput／keyup 免雙重觸發
  ['input', 'compositionend', 'search'].forEach(function (evName) {
    elPq.addEventListener(evName, onProjectQueryChange);
  });

  function normalizePmsEventList(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.dataList)) return data.dataList;
    if (Array.isArray(data.list)) return data.list;
    if (Array.isArray(data.records)) return data.records;
    if (Array.isArray(data.rows)) return data.rows;
    if (data.data) return normalizePmsEventList(data.data);
    return [];
  }

  /** BI 報表樹有時唔包「全程通門票」等多日／非節目場次——用 PMS findEventList 補齊 */
  async function fetchPmsEventsForProject(projectId) {
    if (projectId == null || projectId === '') return [];
    var attempts = [
      { projectId: projectId, page: 1, pageSize: 10000, querySeatTotalCount: false },
      { projectId: projectId, page: 1, pageSize: 10000 },
      { projectId: projectId, page: 1, pageSize: 1000, querySeatTotalCount: false },
      { projectId: projectId, page: 1, pageSize: 1000 }
    ];
    var lastErr = null;
    for (var i = 0; i < attempts.length; i++) {
      try {
        var res = await api('GET', PMS + '/pms/event/findEventList', attempts[i]);
        var list = normalizePmsEventList(unwrapData(res));
        if (list.length) {
          if (i > 0) logLine('  findEventList 用第 ' + (i + 1) + ' 組參數拎到 ' + list.length + ' 場', 'ok');
          return list;
        }
        logLine('  findEventList 參數組 ' + (i + 1) + ' 回傳 0 場（projectId=' + projectId + '）', 'warn');
      } catch (e) {
        lastErr = e;
        logLine('  findEventList 失敗：' + (e && e.message ? e.message : e), 'warn');
      }
    }
    // fallback：場次下拉
    try {
      var res2 = await api('GET', PMS + '/pms/event/getEventComboBox', { projectId: projectId });
      var raw = unwrapData(res2);
      if (Array.isArray(raw)) {
        if (!raw.length) logLine('  getEventComboBox 亦係 0 場（projectId=' + projectId + '）', 'warn');
        return raw;
      }
      if (raw && Array.isArray(raw.commonSelects)) {
        if (!raw.commonSelects.length) logLine('  getEventComboBox.commonSelects 空（projectId=' + projectId + '）', 'warn');
        return raw.commonSelects.map(function (it) {
          return {
            eventId: it.k != null ? it.k : it.eventId,
            eventName: it.v != null ? it.v : it.eventName,
            showTime: it.showTime || it.showStartTime || it.eventTime || '',
            showStartTime: it.showStartTime || '',
            effectDate: it.effectDate || '',
            showEndTime: it.showEndTime || ''
          };
        });
      }
      var norm = normalizePmsEventList(raw);
      if (!norm.length) logLine('  PMS findEventList／getEventComboBox 都無場次（projectId=' + projectId + '）' + (lastErr ? '；最後錯誤：' + (lastErr.message || lastErr) : ''), 'warn');
      return norm;
    } catch (e2) {
      logLine('  getEventComboBox 失敗：' + (e2 && e2.message ? e2.message : e2) + '（projectId=' + projectId + '）', 'warn');
      return [];
    }
  }

  async function mergePmsEventsIntoProjects(prs) {
    var out = [];
    for (var i = 0; i < (prs || []).length; i++) {
      var pr = prs[i];
      if (!pr) continue;
      var pid = pr.projectId;
      var existing = eventsFromProject(pr);
      var seen = {};
      existing.forEach(function (e) { seen[String(e.eventId)] = 1; });
      var pmsList = await fetchPmsEventsForProject(pid);
      var added = 0;
      (pmsList || []).forEach(function (ev) {
        var e = enrichEvent(ev, pr.projectName || pr.name, pid);
        if (e.eventId == null || e.eventId === '') return;
        var k = String(e.eventId);
        if (seen[k]) return;
        seen[k] = 1;
        existing.push(e);
        added++;
      });
      // 寫回 pr.events，之後 fillEventsFromProjects／collectAllEvents 會用到
      pr.events = existing.map(function (e) {
        return {
          eventId: e.eventId,
          eventName: e.eventName,
          showTime: e.showTime,
          showStartTime: e.showStartTime || '',
          effectDate: e.effectDate || '',
          showEndTime: e.showEndTime || '',
          startTime: e.startDate ? fmtYmd(e.startDate) : (e.showTime || e.showStartTime || ''),
          endTime: e.endDate && e.endDate !== e.startDate ? fmtYmd(e.endDate) : (e.showEndTime || ''),
          startDate: e.startDate,
          endDate: e.endDate
        };
      });
      if (added) {
        logLine('  項目「' + (pr.projectName || pid) + '」：PMS 補咗 ' + added + ' 個場次（BI 樹可能缺通門票／多日場；PMS 原始 ' + (pmsList || []).length + '）', 'ok');
      } else if ((pmsList || []).length) {
        logLine('  項目「' + (pr.projectName || pid) + '」：PMS 回 ' + pmsList.length + ' 場，全部已喺 BI 樹', 'ok');
      } else {
        logLine('  項目「' + (pr.projectName || pid) + '」：PMS 無額外場次（findEventList／combo 空）', 'warn');
      }
      out.push(pr);
    }
    return out;
  }

  async function loadEventsForProject(pr) {
    await mergePmsEventsIntoProjects([pr]);
    return fillEventsFromProjects([pr]);
  }

  async function refreshEventsByMode() {
    var bounds = periodBounds();
    var hasPeriod = !!(bounds.from || bounds.to);
    // 時段一改：項目表跟住只顯示時段內有場次嘅項目
    renderProjectOptions(selectedProjectIds());
    if (elCross.checked) {
      // 跨項目：對可見項目補 PMS 場次（避免 BI 缺通門票）
      var allPrs = (state.projects || []).filter(function (pr) {
        return projectHasEventsInPeriod(pr, bounds) || true;
      });
      // 只補當前關鍵字篩完後仍可見、或時段內有場嘅項目會太多——改為補全部已載入項目太多；
      // 實用：補「時段內 BI 已有場」嘅項目 + 關鍵字匹配項目
      var q = (elPq.value || '').trim().toLowerCase();
      var enrichTargets = (state.projects || []).filter(function (pr) {
        if (q && !projectMatchesQuery(pr, q)) return false;
        return true;
      }).slice(0, 30); // 上限避免一次打爆
      if (enrichTargets.length) {
        setMsg('跨項目：補齊 PMS 場次…');
        await mergePmsEventsIntoProjects(enrichTargets);
        renderProjectOptions(selectedProjectIds());
      }
      state.eventsRaw = collectAllEvents();
      var n = applyEventFilter();
      setMsg('跨項目時段：顯示 ' + n + ' 個場次' +
        (hasPeriod ? '（已套用活動日期／多日場重疊）' : '（未限日期＝全部場次，建議設時段）'));
      return n;
    }
    var prs = selectedProjects();
    if (!prs.length) {
      fillEvents([]);
      setMsg(hasPeriod ? '請揀項目（可多選），或勾「跨項目」用時段搜尋' : '請先揀項目（可多選）');
      return 0;
    }
    setMsg('載入場次（BI＋PMS 補齊）…');
    await mergePmsEventsIntoProjects(prs);
    var rawBefore = 0;
    prs.forEach(function (pr) { rawBefore += (pr.events || []).length; });
    var n2 = fillEventsFromProjects(prs);
    if (hasPeriod && rawBefore > n2) {
      logLine('  時段篩選：合併後 ' + rawBefore + ' 場 → 顯示 ' + n2 + '（被日期篩走 ' + (rawBefore - n2) + '；無日期者已保留）', 'warn');
    } else if (rawBefore) {
      logLine('  合併後 ' + rawBefore + ' 場，顯示 ' + n2, 'ok');
    }
    setMsg(n2
      ? ('已揀 ' + prs.length + ' 個項目 · 顯示 ' + n2 + ' 個場次' +
        (hasPeriod ? '（已套用活動日期／跨日重疊；無日期亦保留）' : '') + '——可改選後導出')
      : (hasPeriod ? '此時段所揀項目無場次' : '所揀項目未搵到場次'));
    return n2;
  }

  elProj.onchange = async function () {
    // 揀咗項目 → 退出跨項目，合併所揀項目場次
    if (elCross.checked) elCross.checked = false;
    fillEvents([]);
    setMsg('載入場次…');
    await refreshEventsByMode();
  };
  root.querySelector('#mz-se-apply-date').onclick = async function () {
    await refreshEventsByMode();
  };
  elFrom.onchange = elTo.onchange = function () { /* 等套用或自動 */ };
  elCross.onchange = async function () {
    await refreshEventsByMode();
  };
  elFrom.addEventListener('change', function () { refreshEventsByMode(); });
  elTo.addEventListener('change', function () { refreshEventsByMode(); });

  async function loadProjectTree() {
    setMsg('載入項目／場次樹…');
    // Prefer BI (seat status report tree)
    try {
      var biRes = await api('POST', BI + '/rpt/ReportSeatSearch/queryProjectEventList', {});
      var biData = unwrapData(biRes);
      var biList = projectListFromBi(biData);
      if (biList.length) {
        state.treeSource = 'BI queryProjectEventList';
        state.srcLabel = '來源：BI 報表樹';
        elSrc.textContent = state.srcLabel;
        fillProjects(biList);
        renderProjectOptions(selectedProjectIds());
        fillEvents([]);
        setMsg('項目 ' + biList.length + ' 個 · 時段預設今日→半年——可搜關鍵字／多選項目 → 場次 → 導出');
        return;
      }
    } catch (e) {
      logLine('BI 樹失敗，改用 PMS：' + (e && e.message ? e.message : e), 'warn');
    }

    // Fallback PMS combo
    try {
      var res = await api('GET', PMS + '/pms/project/getProjectComboBox', { comboBoxCode: 1 });
      var list = projectListFromPms(unwrapData(res));
      if (!list.length) {
        var res2 = await api('GET', PMS + '/pms/project/getProjectComboBoxFuzzy', {
          projectName: '', comboBoxCode: 1
        });
        list = projectListFromPms(unwrapData(res2));
      }
      state.treeSource = 'PMS getProjectComboBox';
      state.srcLabel = '來源：PMS 項目下拉';
      elSrc.textContent = state.srcLabel;
      fillProjects(list);
      renderProjectOptions(selectedProjectIds());
      fillEvents([]);
      setMsg('項目 ' + list.length + ' 個 · 時段預設今日→半年——可搜關鍵字／多選項目 → 場次 → 導出');
    } catch (e2) {
      state.srcLabel = '載入失敗';
      elSrc.textContent = state.srcLabel;
      setMsg('載入項目失敗：' + (e2 && e2.message ? e2.message : e2), true);
    }
  }
  root.querySelector('#mz-se-reload').onclick = loadProjectTree;

  // ——— 座位信息 ———
  async function exportSeatInfo(eventId, eventName) {
    var json = await api('GET', PMS + '/pms/seatimage/exportSeatImage', { eventId: eventId });
    var data = unwrapData(json);
    if (isHardExportError(data)) throw new Error(payloadText(data) || '匯出失敗');
    var url = extractUrl(data);
    var lastHint = payloadText(data);
    var sawMcHint = mentionsMessageCenter(data);
    if (url && isImageUrl(url) && !isSpreadsheetUrl(url)) {
      logLine('  座位信息：API 回傳座位圖連結，略過，改等 Excel／消息中心…', 'warn');
      url = '';
      sawMcHint = true;
    }

    if (!url) {
      // 無論即時有無 URL，只要仲處理緊就長時間輪詢；等耐係正常
      for (var i = 0; i < INFO_POLL_MAX; i++) {
        if (state.abort) throw new Error('已停止');
        await sleep(INFO_POLL_MS);
        var polled = await api('GET', PMS + '/pms/seatimage/checkExportProcess', { eventId: eventId });
        var pd = unwrapData(polled);
        if (isHardExportError(pd)) throw new Error(payloadText(pd) || '匯出失敗');
        url = extractUrl(pd);
        if (!url && typeof pd === 'string' && /^https?:\/\//i.test(pd.trim())) {
          var cand = pd.trim();
          if (!(isImageUrl(cand) && !isSpreadsheetUrl(cand))) url = cand;
        }
        if (url && isImageUrl(url) && !isSpreadsheetUrl(url)) {
          logLine('  座位信息：API 回傳座位圖連結，略過，改等 Excel／消息中心…', 'warn');
          url = '';
          sawMcHint = true;
        }
        if (url) break;
        var tip = payloadText(pd) || lastHint;
        if (tip) lastHint = tip;
        if (mentionsMessageCenter(pd) || mentionsMessageCenter(tip)) sawMcHint = true;
        var mins = Math.floor(((i + 1) * INFO_POLL_MS) / 60000);
        var secs = Math.floor((((i + 1) * INFO_POLL_MS) % 60000) / 1000);
        logLine('  座位信息等待中 ' + (i + 1) + '/' + INFO_POLL_MAX +
          '（已約 ' + mins + ' 分 ' + secs + ' 秒）…' + (sawMcHint ? ' 可能落消息中心' : ''), 'warn');

        // 官方提示去消息中心時：唔使等盡 max，試幾次 MC 攞檔
        if (sawMcHint && (i + 1) >= INFO_MC_AFTER && ((i + 1) % 3 === 0 || (i + 1) === INFO_MC_AFTER)) {
          var early = await tryFindNoticeDownload(eventId, eventName, '座位信息');
          if (early) {
            logLine('  座位信息：已從消息中心自動下載', 'ok');
            return 'mc';
          }
        }
      }
    }

    if (url && isImageUrl(url) && !isSpreadsheetUrl(url)) {
      logLine('  座位信息：略過座位圖連結，改消息中心…', 'warn');
      url = '';
      sawMcHint = true;
    }
    if (url) {
      var fname = '座位信息_' + safeName(eventName) + '_' + eventId + '.xlsx';
      try {
        var how = await downloadBlob(url, fname);
        state.downloadedUrls[url] = how || 'ok';
        state.downloadedKeys[reportKey('座位信息', eventId)] = how || 'ok';
        if (how === 'triggered') logLine('  座位信息：已觸發瀏覽器下載（CORS fallback）', 'ok');
        return how;
      } catch (eDl) {
        if (eDl && eDl.code === 'SEATMAP_IMAGE') {
          logLine('  座位信息：' + eDl.message + ' → 改消息中心', 'warn');
          sawMcHint = true;
        } else {
          // downloadBlob 而家多數會 triggered；極少數仍 throw 先走 MC
          logLine('  座位信息直鏈下載異常：' + (eDl && eDl.message ? eDl.message : eDl) + ' → 改消息中心', 'warn');
          sawMcHint = true;
        }
      }
    }

    // 長等之後仍無直鏈：若提示消息中心／匯出中 → 當成功待下載，唔報 timeout 失敗
    if (sawMcHint || mentionsMessageCenter(lastHint) || /导出中|匯出中|導出中/.test(lastHint || '')) {
      logLine('  座位信息：改喺消息中心自動下載…', 'warn');
      var fromMc = await waitAndDownloadFromNotice(eventId, eventName, '座位信息');
      if (fromMc) return 'mc';
      return 'mc-pending';
    }
    if (lastHint && isHardExportError(lastHint)) throw new Error(lastHint);
    throw new Error(lastHint || '未取得座位信息下載連結（可能過於頻繁或無座項目）');
  }

  // ——— 座位狀態 ———
  async function triggerSeatStatus(eventId, eventName) {
    var last = null;
    for (var i = 0; i < STATUS_POLL_MAX; i++) {
      if (state.abort) throw new Error('已停止');
      var json = await api('GET', PMS + '/pms/seatReport/query', { eventId: eventId });
      var data = unwrapData(json) || {};
      last = data;
      var st = data.generationStatus != null ? Number(data.generationStatus) : null;
      var prog = data.progress != null ? data.progress : '?';
      var intervalSec = data.requestInterval != null ? Number(data.requestInterval) : 5;
      if (isNaN(intervalSec) || intervalSec < 1) intervalSec = 5;

      if (st === 1) {
        logLine('  座位狀態完成（' + prog + '%）→ 自動下載消息中心檔…', 'ok');
        var dl = await waitAndDownloadFromNotice(eventId, eventName, '座位狀態');
        if (!dl) {
          logLine('  座位狀態：消息中心暫未自動下載到，會再試一次…', 'warn');
          dl = await waitAndDownloadFromNotice(eventId, eventName, '座位狀態');
        }
        return { status: 1, download: dl, progress: prog };
      }
      if (st === 2) {
        var em = data.errorMsg || '生成失敗';
        throw new Error('座位狀態生成失敗：' + em);
      }
      // 0 or unknown = producing
      var elapsedMin = Math.floor((i + 1) * intervalSec / 60);
      logLine('  座位狀態生成中 ' + prog + '%（' + (i + 1) + '/' + STATUS_POLL_MAX +
        '，已約 ' + elapsedMin + ' 分，繼續等）…', 'warn');
      await sleep(intervalSec * 1000);
    }
    // 好長都未完成：唔當硬失敗——提示繼續喺消息中心等／再撳一次
    logLine('  座位狀態仍未完成（最後進度：' +
      (last && last.progress != null ? last.progress : '?') +
      '%）→ 請稍後去消息中心查看，或再開一次導出', 'warn');
    return { status: 0, download: null, progress: last && last.progress, pending: true };
  }


  function decodeHtmlEntities(s) {
    return String(s || '')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }

  function normalizeHref(href) {
    href = decodeHtmlEntities(String(href || '')).trim();
    if (!href) return '';
    if (/^javascript:/i.test(href) || href === '#') return '';
    if (/^\/\//.test(href)) href = 'https:' + href;
    // 消息中心常見相對路徑／同域轉址（唔係 OSS 直鏈）
    if (/^\//.test(href)) href = MC + href;
    else if (!/^https?:\/\//i.test(href) && /^[\w.?&=%/+-]+$/i.test(href) && /download|file|oss|notice|export/i.test(href)) {
      href = MC + (href.charAt(0) === '/' ? '' : '/') + href;
    }
    return href;
  }

  function looksLikeDownloadHref(href) {
    if (!href || !/^https?:\/\//i.test(href)) return false;
    if (isImageUrl(href) && !isReportFileUrl(href)) return false;
    if (isReportFileUrl(href)) return true;
    // mc／pms／bi 下載轉址、OSS、帶签名参数
    if (/mc-sig\.imaitix|pms-sig\.imaitix|bi-sig\.imaitix|aliyuncs|oss-|\/notice\/|download|fileId|fileUrl|getFile|export|attachment/i.test(href)) return true;
    if (/[?&](Expires|Signature|OSSAccessKeyId)=/i.test(href)) return true;
    return false;
  }

  /** 從通知 HTML／純文字抽出「点击下载」鏈（對齊消息中心文案）；略過座位圖 */
  function pickClickDownloadUrl(text) {
    if (!text) return '';
    text = decodeHtmlEntities(String(text));
    var best = '';
    // <a href>…点击下载…</a> 或 data-href / data-url
    var patterns = [
      /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
      /<a\s+[^>]*href\s*=\s*([^\s>]+)[^>]*>([\s\S]*?)<\/a>/gi,
      /<(?:a|span|button|div)[^>]*(?:data-(?:href|url|link|file|download)|data-src)\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/(?:a|span|button|div)>/gi
    ];
    for (var pi = 0; pi < patterns.length; pi++) {
      var re = patterns[pi];
      var m;
      while ((m = re.exec(text))) {
        var href = normalizeHref(m[1] || '');
        var label = (m[2] || '').replace(/<[^>]+>/g, '').trim();
        if (!href) continue;
        if (/座位图|座位圖|seat.?map|查看座位|查看座位图|查看座位圖/i.test(label)) continue;
        if (!looksLikeDownloadHref(href) && !/^https?:\/\//i.test(href)) continue;
        if (/点击下载|點擊下載|点击下載|點擊下载|立即下载|立即下載|download/i.test(label) || looksLikeDownloadHref(href)) {
          // 「点击下载」文案：接受非圖片 http(s)（含 PDF）；報表副檔名優先
          if (isReportFileUrl(href) || looksLikeDownloadHref(href) || /^https?:\/\//i.test(href)) {
            if (isImageUrl(href) && !isReportFileUrl(href)) continue;
            if (isReportFileUrl(href)) return href;
            if (!best) best = href;
          }
        }
      }
    }
    // onclick / window.open('url')
    if (!best) {
      var openM = text.match(/window\.open\s*\(\s*['"]([^'"]+)['"]/i)
        || text.match(/location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/i);
      if (openM && openM[1]) {
        var ou = normalizeHref(openM[1]);
        if (looksLikeDownloadHref(ou)) best = ou;
      }
    }
    // 「点击下载」附近／整段內嘅 https 或相對下載路徑
    if (!best) {
      var near = text.match(/(?:点击下载|點擊下載|点击下載|點擊下载)[^h]{0,120}(https?:\/\/[^\s"'<>]+)/i)
        || text.match(/(https?:\/\/[^\s"'<>]+)[^<]{0,80}(?:点击下载|點擊下載)/i)
        || text.match(/href\s*=\s*["']([^"']+)["'][^>]{0,160}(?:点击下载|點擊下載)/i)
        || text.match(/(?:点击下载|點擊下載)[^>]{0,60}href\s*=\s*["']([^"']+)["']/i)
        || text.match(/(?:点击下载|點擊下載)[^\/]{0,40}(\/[^\s"'<>]*download[^\s"'<>]*)/i);
      if (near && near[1]) {
        var nu = normalizeHref(near[1]);
        if (looksLikeDownloadHref(nu) || /^https?:\/\//i.test(nu)) best = nu;
      }
    }
    if (!best && /点击下载|點擊下載|座位状态报告已生成完成|座位狀態報告已生成完成|座位信息|座位状态报告导出|座位狀態報告導出/.test(text)) {
      var all = text.match(/https?:\/\/[^\s"'<>]+/gi) || [];
      var rels = text.match(/(?:href|data-url|data-href)\s*=\s*["'](\/[^"']+)["']/gi) || [];
      for (var ri = 0; ri < rels.length; ri++) {
        var rm = rels[ri].match(/["'](\/[^"']+)["']/);
        if (rm) all.push(rm[1]);
      }
      for (var ai = 0; ai < all.length; ai++) {
        var u = normalizeHref(String(all[ai]).replace(/[),.;]+$/, ''));
        if (!u || (isImageUrl(u) && !isReportFileUrl(u))) continue;
        if (looksLikeDownloadHref(u) || isReportFileUrl(u)) {
          best = u;
          break;
        }
        if (!best && /^https?:\/\//i.test(u)) best = u;
      }
    }
    if (best && isImageUrl(best) && !isReportFileUrl(best)) return '';
    return best;
  }

  function walkFindUrl(node, depth) {
    if (depth > 12 || node == null) return '';
    if (typeof node === 'string') {
      var fromHtml = pickClickDownloadUrl(node);
      if (fromHtml) return fromHtml;
      var t = node.trim();
      if (/^https?:\/\//i.test(t) && isReportFileUrl(t)) return t;
      if (looksLikeDownloadHref(t)) return t;
      if (/^https?:\/\//i.test(t) && !isImageUrl(t) && /aliyuncs|oss|download|xlsx|excel|pdf|imaitix/i.test(t)) return t;
      var nrel = normalizeHref(t);
      if (nrel !== t && looksLikeDownloadHref(nrel)) return nrel;
      return '';
    }
    if (Array.isArray(node)) {
      for (var i = 0; i < node.length; i++) {
        var u = walkFindUrl(node[i], depth + 1);
        if (u) return u;
      }
      return '';
    }
    if (typeof node === 'object') {
      var prefer = [
        'downloadUrl', 'fileUrl', 'excelUrl', 'xlsxUrl', 'pdfUrl', 'ossUrl', 'attachUrl', 'attachmentUrl',
        'url', 'link', 'pcUrl', 'actionUrl', 'jumpUrl', 'filePath', 'path', 'href',
        'content', 'noticeContent', 'msgContent', 'messageContent', 'detailContent', 'htmlContent',
        'body', 'noticeTitle', 'title', 'msgTitle', 'subject', 'text', 'remark', 'description'
      ];
      for (var j = 0; j < prefer.length; j++) {
        if (typeof node[prefer[j]] === 'string') {
          var p = walkFindUrl(node[prefer[j]], depth + 1);
          if (p) return p;
        }
      }
      var keys = Object.keys(node);
      for (var k = 0; k < keys.length; k++) {
        var u2 = walkFindUrl(node[keys[k]], depth + 1);
        if (u2) return u2;
      }
    }
    return '';
  }

  function noticeLooksLikeReport(n, eventId, eventName, kind) {
    var blob = JSON.stringify(n || {});
    var low = blob.toLowerCase();
    var hitKind = false;
    if (kind === '座位信息') {
      hitKind = /座位信息|seat.?info|seatinfo|座位資訊|座位信息导出|座位信息導出/.test(blob);
    } else {
      // 對齊消息中心：「【座位状态报告导出】成功」「座位状态报告已生成完成」
      hitKind = /座位狀態|座位状态|seat.?status|seatstatus|座位状态报告|座位狀態報告|座位狀態報表|座位状态报表|座位状态报告导出|座位狀態報告導出|座位状态报告已生成完成|座位狀態報告已生成完成/.test(blob);
    }
    var hitEvent = String(eventId) && low.indexOf(String(eventId).toLowerCase()) >= 0;
    var compact = low.replace(/\s+/g, '');
    var hitName = false;
    if (eventName) {
      var raw = String(eventName).toLowerCase();
      var nameKey = raw.replace(/\s+/g, '').slice(0, 12);
      if (nameKey && compact.indexOf(nameKey) >= 0) hitName = true;
      var tokens = raw.match(/[a-z0-9\u4e00-\u9fff]{3,}/g) || [];
      for (var ti = 0; ti < tokens.length && !hitName; ti++) {
        if (compact.indexOf(tokens[ti]) >= 0) hitName = true;
      }
    }
    var hitTitle = kind === '座位信息'
      ? /【?座位信息导出】?|【?座位信息導出】?|座位信息报表|座位信息報表/.test(blob)
      : /【\s*座位状态报告导出\s*】|【\s*座位狀態報告導出\s*】|座位状态报告导出|座位狀態報告導出|座位状态报告已生成完成|座位狀態報告已生成完成/.test(blob);
    if (!(hitTitle || hitKind)) return false;
    // 標題已明確係該報表 → 可收；否則要有場次 id／名
    if (hitTitle) return true;
    return hitEvent || hitName || hitKind;
  }

  function noticeScore(n, eventId, eventName, kind) {
    var blob = JSON.stringify(n || {});
    var s = 0;
    if (kind === '座位狀態' && /座位状态报告导出|座位狀態報告導出|座位状态报告已生成完成/.test(blob)) s += 50;
    if (kind === '座位信息' && /座位信息导出|座位信息導出/.test(blob)) s += 50;
    if (String(eventId) && blob.toLowerCase().indexOf(String(eventId).toLowerCase()) >= 0) s += 30;
    if (eventName) {
      var tokens = String(eventName).toLowerCase().match(/[a-z0-9\u4e00-\u9fff]{3,}/g) || [];
      var compact = blob.toLowerCase().replace(/\s+/g, '');
      for (var i = 0; i < tokens.length; i++) if (compact.indexOf(tokens[i]) >= 0) s += 10;
    }
    if (/点击下载|點擊下載/.test(blob)) s += 5;
    return s;
  }

  function normalizeNoticeList(listData) {
    if (!listData) return [];
    if (Array.isArray(listData)) return listData;
    if (Array.isArray(listData.dataList)) return listData.dataList;
    if (Array.isArray(listData.list)) return listData.list;
    if (Array.isArray(listData.records)) return listData.records;
    if (Array.isArray(listData.rows)) return listData.rows;
    if (listData.data) return normalizeNoticeList(listData.data);
    return [];
  }

  async function fetchNoticeLists() {
    var notices = [];
    var seen = {};
    var queries = [
      { page: 1, pageSize: 1000, showType: 3 },
      { page: 1, pageSize: 100, showType: 1 },
      { page: 1, pageSize: 100, showType: 2 },
      { page: 1, pageSize: 50 }
    ];
    for (var q = 0; q < queries.length; q++) {
      try {
        var listRes = await api('GET', MC + '/notice/listNotices', queries[q]);
        var batch = normalizeNoticeList(unwrapData(listRes));
        for (var i = 0; i < batch.length; i++) {
          var n = batch[i];
          var key = String(n.noticeId || n.id || n.messageId || JSON.stringify(n).slice(0, 80));
          if (seen[key]) continue;
          seen[key] = 1;
          notices.push(n);
        }
        // 合併晒各 showType，唔好第一個有結果就停（座位狀態可能喺另一個列表）
      } catch (e) { /* try next */ }
    }
    return notices;
  }

  function reportKey(kind, eventId) {
    return String(kind || '') + '|' + String(eventId || '');
  }

  async function saveNoticeFile(url, eventId, eventName, kind) {
    if (!url) return null;
    if (isImageUrl(url) && !isReportFileUrl(url)) return null;
    var rk = reportKey(kind, eventId);
    // 同一場同一種報表只下載一次（signed URL 每次唔同，唔能只靠 url dedupe）
    if (state.downloadedKeys[rk] || state.downloadedUrls[url]) {
      return state.downloadedUrls[url] ? url : 'already';
    }
    // 座位狀態多數 PDF；座位信息 xlsx——跟 URL 副檔名，否則按 kind
    var fname = kind + '_' + safeName(eventName) + '_' + eventId + extFromUrlOrKind(url, kind);
    try {
      var how = await downloadBlob(url, fname);
      state.downloadedUrls[url] = how || 'ok';
      state.downloadedKeys[rk] = how || 'ok';
      return url;
    } catch (e) {
      if (e && e.code === 'SEATMAP_IMAGE') return null;
      logLine('  下載未成功（' + (e && e.message ? e.message : e) + '），稍後再試…', 'warn');
      return null;
    }
  }

  async function fetchNoticeDetail(nid) {
    var attempts = [
      { noticeId: nid, page: 1, pageSize: 50 },
      { noticeId: nid },
      { id: nid, page: 1, pageSize: 50 },
      { messageId: nid, page: 1, pageSize: 50 },
      { msgId: nid }
    ];
    for (var i = 0; i < attempts.length; i++) {
      try {
        var det = await api('GET', MC + '/notice/listNoticeDetails', attempts[i]);
        var detData = unwrapData(det);
        if (detData != null && detData !== '') return detData;
      } catch (e) { /* try next shape */ }
    }
    return null;
  }

  async function tryFindNoticeDownload(eventId, eventName, kind) {
    kind = kind || '座位狀態';
    var rk = reportKey(kind, eventId);
    if (state.downloadedKeys[rk]) return 'already';
    try {
      var notices = await fetchNoticeLists();
      if (!notices.length) {
        logLine('  消息中心：列表空白', 'warn');
        return null;
      }

      var candidates = notices.filter(function (n) {
        return noticeLooksLikeReport(n, eventId, eventName, kind);
      });
      candidates.sort(function (a, b) {
        return noticeScore(b, eventId, eventName, kind) - noticeScore(a, eventId, eventName, kind);
      });
      // 列表往往冇中文標題／正文——拉最新若干條詳情再判斷（對齊「【座位状态报告导出】成功」）
      var explore = candidates.slice();
      var seenId = {};
      for (var ei = 0; ei < explore.length; ei++) {
        seenId[String(explore[ei].noticeId || explore[ei].id || explore[ei].messageId || ei)] = 1;
      }
      var recentCap = kind === '座位狀態' ? 25 : 15;
      for (var ri = 0; ri < notices.length && ri < recentCap; ri++) {
        var rn = notices[ri];
        var rid = String(rn.noticeId || rn.id || rn.messageId || 'r' + ri);
        if (seenId[rid]) continue;
        seenId[rid] = 1;
        explore.push(rn);
      }

      var enriched = [];
      var tried = {};
      for (var i = 0; i < explore.length; i++) {
        if (state.downloadedKeys[rk]) return 'already';
        var n = explore[i];
        var key = String(n.noticeId || n.id || n.messageId || i);
        if (tried[key]) continue;
        tried[key] = 1;

        var merged = n;
        var nid = n.noticeId || n.id || n.messageId || n.detailId || n.msgId;
        if (nid != null) {
          var detData = await fetchNoticeDetail(nid);
          if (detData != null) {
            merged = { list: n, detail: detData };
          }
        }

        if (!noticeLooksLikeReport(merged, eventId, eventName, kind) &&
            !noticeLooksLikeReport(n, eventId, eventName, kind)) {
          continue;
        }
        enriched.push(merged);

        var direct = walkFindUrl(merged, 0) || walkFindUrl(n, 0);
        var got = await saveNoticeFile(direct, eventId, eventName, kind);
        if (got) return got;
      }

      if (!enriched.length) {
        if (!state._mcMissLogged) {
          state._mcMissLogged = 1;
          logLine('  消息中心：未對中「' + kind + '」通知（會繼續等；標題應似【座位状态报告导出】）', 'warn');
        }
        return null;
      }
      // 有對中但拎唔到鏈
      enriched.sort(function (a, b) {
        return noticeScore(b, eventId, eventName, kind) - noticeScore(a, eventId, eventName, kind);
      });
      for (var j = 0; j < enriched.length; j++) {
        var url2 = walkFindUrl(enriched[j], 0);
        var got2 = await saveNoticeFile(url2, eventId, eventName, kind);
        if (got2) return got2;
      }
      var tipTitle = '';
      try {
        tipTitle = String((enriched[0] && (enriched[0].noticeTitle || enriched[0].title ||
          (enriched[0].list && (enriched[0].list.noticeTitle || enriched[0].list.title)))) || '');
      } catch (eT) {}
      logLine('  消息中心：搵到「' + kind + '」通知但未抽出下載鏈' +
        (tipTitle ? '（' + tipTitle.slice(0, 40) + '）' : '') + '，繼續輪詢…', 'warn');
    } catch (e2) {
      logLine('  消息中心列表查詢失敗：' + (e2 && e2.message ? e2.message : e2), 'warn');
    }
    return null;
  }

  /** 掃尾：把消息中心未下載嘅「座位状态报告」全部自動下載（按 noticeId 去重） */
  async function sweepSeatStatusFromMc(hintEvents) {
    hintEvents = hintEvents || [];
    var got = 0;
    try {
      var notices = await fetchNoticeLists();
      var explore = notices.slice(0, 40);
      for (var i = 0; i < explore.length; i++) {
        if (state.abort) break;
        var n = explore[i];
        var nid = n.noticeId || n.id || n.messageId || n.detailId || n.msgId;
        var nk = 'notice|' + String(nid || i);
        if (state.downloadedKeys[nk]) continue;

        var merged = n;
        if (nid != null) {
          var detData = await fetchNoticeDetail(nid);
          if (detData != null) merged = { list: n, detail: detData };
        }
        var blob = JSON.stringify(merged);
        if (!/座位状态报告|座位狀態報告|座位状态|座位狀態|seat.?status/i.test(blob)) continue;

        var url = walkFindUrl(merged, 0) || walkFindUrl(n, 0);
        if (!url) {
          // 再掃 detail 字串
          url = pickClickDownloadUrl(blob);
        }
        if (!url) {
          logLine('  掃尾：通知 ' + (nid || i) + ' 似座位狀態但未抽出下載鏈', 'warn');
          continue;
        }

        // 盡量對應場次名／id 做檔名
        var evName = '座位狀態';
        var evId = nid || ('n' + i);
        for (var hi = 0; hi < hintEvents.length; hi++) {
          var he = hintEvents[hi];
          var compact = blob.toLowerCase().replace(/\s+/g, '');
          if (he.eventId && compact.indexOf(String(he.eventId).toLowerCase()) >= 0) {
            evName = he.eventName || evName;
            evId = he.eventId;
            break;
          }
          if (he.eventName) {
            var tokens = String(he.eventName).toLowerCase().match(/[a-z0-9\u4e00-\u9fff]{3,}/g) || [];
            var hit = false;
            for (var ti = 0; ti < tokens.length; ti++) {
              if (compact.indexOf(tokens[ti]) >= 0) { hit = true; break; }
            }
            if (hit) {
              evName = he.eventName;
              evId = he.eventId || evId;
              break;
            }
          }
        }

        var rk = reportKey('座位狀態', evId);
        if (state.downloadedKeys[rk] && state.downloadedUrls[url]) {
          state.downloadedKeys[nk] = 'already';
          continue;
        }
        var saved = await saveNoticeFile(url, evId, evName, '座位狀態');
        if (saved) {
          state.downloadedKeys[nk] = saved;
          got++;
          logLine('  掃尾：已自動下載座位狀態（' + evName + '）', 'ok');
        }
      }
    } catch (e) {
      logLine('  掃尾消息中心失敗：' + (e && e.message ? e.message : e), 'warn');
    }
    return got;
  }

  /** 生成完成後輪詢消息中心，直到自動下載成功或超時 */
  async function waitAndDownloadFromNotice(eventId, eventName, kind) {
    // 座位狀態通知有時稍遲先出現
    if (kind === '座位狀態') await sleep(4000);
    for (var i = 0; i < MC_POLL_MAX; i++) {
      if (state.abort) throw new Error('已停止');
      var rk = reportKey(kind, eventId);
      if (state.downloadedKeys[rk]) {
        logLine('  ' + kind + '：已自動下載（略過重覆）', 'ok');
        return 'already';
      }
      var url = await tryFindNoticeDownload(eventId, eventName, kind);
      if (url) {
        logLine('  ' + kind + '：已從消息中心自動下載', 'ok');
        return url;
      }
      if (i === 0 || (i + 1) % 5 === 0) {
        logLine('  等消息中心「點擊下載」自動下載… ' + (i + 1) + '/' + MC_POLL_MAX, 'warn');
      }
      await sleep(MC_POLL_MS);
    }
    return null;
  }

  async function runExport() {
    if (state.running) return;
    var doInfo = elInfo.checked;
    var doStatus = elStatus.checked;
    var events = selectedEvents();
    if (!elCross.checked && !selectedProjectIds().length) { setMsg('請先揀項目（可多選），或勾「跨項目」並設時段', true); return; }
    if (!events.length) { setMsg('請至少揀一個場次（可設活動開始時段篩選）', true); return; }
    if (!doInfo && !doStatus) { setMsg('請至少勾選一種報表', true); return; }

    state.running = true;
    state.abort = false;
    state.downloadedUrls = {};
    state.downloadedKeys = {};
    state._mcMissLogged = 0;
    elGo.disabled = true;
    elStop.disabled = false;
    clearLog();
    setMsg('開始批量導出 ' + events.length + ' 個場次…');
    logLine('共 ' + events.length + ' 場 · 座位信息=' + (doInfo ? '開' : '關') +
      ' · 座位狀態=' + (doStatus ? '開' : '關'), '');

    var okInfo = 0, failInfo = 0, okStatus = 0, failStatus = 0, statusMsgOnly = 0;

    try {
      for (var i = 0; i < events.length; i++) {
        if (state.abort) {
          logLine('已停止（剩 ' + (events.length - i) + ' 場未做）', 'warn');
          break;
        }
        var ev = events[i];
        var label = (i + 1) + '/' + events.length + ' ' + (ev.eventName || '') + ' [' + ev.eventId + ']';
        logLine('—— ' + label + ' ——');

        if (doInfo) {
          try {
            logLine('  座位信息：匯出中（可能要等幾分鐘，請唔好關面板）…');
            var how = await exportSeatInfo(ev.eventId, ev.eventName);
            if (how === 'mc') {
              logLine('  座位信息：已自動下載完成', 'ok');
              okInfo++;
            } else if (how === 'mc-pending') {
              logLine('  座位信息：消息中心暫未搵到下載鏈（可稍後再開一次導出／手動）', 'warn');
              statusMsgOnly++;
              okInfo++;
            } else {
              logLine('  座位信息：下載完成', 'ok');
              okInfo++;
            }
          } catch (e) {
            logLine('  座位信息：失敗 — ' + (e && e.message ? e.message : e), 'err');
            failInfo++;
          }
          if (i < events.length - 1 || doStatus) await sleep(SLEEP_BETWEEN_MS);
        }

        if (state.abort) break;

        if (doStatus) {
          try {
            logLine('  座位狀態：觸發／輪詢…');
            var stRes = await triggerSeatStatus(ev.eventId, ev.eventName);
            if (stRes.download) {
              logLine('  座位狀態：已自動下載完成', 'ok');
              okStatus++;
            } else if (stRes.pending) {
              logLine('  座位狀態：仍在生成（唔當失敗）— 完成後可再開一次自動下載', 'warn');
              statusMsgOnly++;
              okStatus++;
            } else {
              logLine('  座位狀態：生成完成但未自動下載到檔（可再開一次）', 'warn');
              statusMsgOnly++;
              okStatus++;
            }
          } catch (e2) {
            logLine('  座位狀態：失敗 — ' + (e2 && e2.message ? e2.message : e2), 'err');
            failStatus++;
          }
          if (i < events.length - 1) await sleep(SLEEP_BETWEEN_MS);
        }
      }

      if (doStatus) {
        logLine('—— 掃尾：檢查消息中心未下載嘅座位狀態報告 ——');
        var swept = await sweepSeatStatusFromMc(events);
        if (swept) {
          okStatus += swept;
          logLine('  掃尾多下載咗 ' + swept + ' 個座位狀態檔', 'ok');
        } else {
          logLine('  掃尾：冇額外座位狀態可下載（若消息中心有「点击下载」仍唔得，請截圖通知詳情）', 'warn');
        }
      }

      var summary = '完成：信息 OK ' + okInfo + '／失敗 ' + failInfo +
        '；狀態 OK ' + okStatus + '／失敗 ' + failStatus +
        (statusMsgOnly ? '（其中 ' + statusMsgOnly + ' 場請去消息中心）' : '');
      setMsg(summary, failInfo + failStatus > 0);
      logLine(summary, failInfo + failStatus > 0 ? 'warn' : 'ok');
    } catch (err) {
      setMsg('中止：' + (err && err.message ? err.message : String(err)), true);
    } finally {
      state.running = false;
      elGo.disabled = false;
      elStop.disabled = true;
    }
  }
  elGo.onclick = runExport;

  try {
    await loadProjectTree();
  } catch (err) {
    setMsg('初始化失敗：' + (err && err.message ? err.message : String(err)), true);
  }
})();
