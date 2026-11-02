/* Apex Strategy — util.js: formatting, icons, helpers */
'use strict';
var AS = window.AS || {}; window.AS = AS;

AS.VERSION = '1.0.0';
AS.CR = 1e7;                       // 1 crore
AS.NF0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
AS.NF1 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
AS.NF2 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

AS.rs   = function (v) { return '₹' + AS.NF0.format(Math.round(v)); };
AS.cr   = function (v) { return '₹' + AS.NF2.format(v / AS.CR) + ' cr'; };
AS.cr1  = function (v) { return '₹' + AS.NF1.format(v / AS.CR) + ' cr'; };
AS.num  = function (v) { return AS.NF0.format(Math.round(v)); };
AS.num1 = function (v) { return AS.NF1.format(v); };
AS.pct  = function (v, d) { return (v * 100).toFixed(d === undefined ? 1 : d) + '%'; };
AS.clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };
AS.esc = function (s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
};
AS.uid = function (p) {
  return (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
};
AS.gid = function (n) { return Math.floor(Math.random() * n); };
AS.todayISO = function () { return new Date().toISOString(); };

/* Simple hash for demo-grade password storage (not production security). */
AS.hash = function (s) {
  s = 'apex::' + s;
  var h1 = 0x811c9dc5, h2 = 0xdeadbeef;
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (c + i), 0x85ebca6b) >>> 0;
  }
  return h1.toString(16) + h2.toString(16);
};

/* Date helpers */
AS.fmtDate = function (iso) {
  if (!iso) return '—';
  var d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};
AS.fmtDateShort = function (iso) {
  if (!iso) return '—';
  var d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' ' +
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};
AS.timeLeft = function (iso) {
  if (!iso) return null;
  var ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return { over: true, text: 'passed' };
  var s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return { over: false, text: (d ? d + 'd ' : '') + h + 'h ' + m + 'm', ms: ms };
};

/* CSV download */
AS.toCSV = function (rows) {
  return rows.map(function (r) {
    return r.map(function (c) {
      c = c == null ? '' : String(c);
      return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c;
    }).join(',');
  }).join('\r\n');
};
AS.download = function (filename, content, mime) {
  var blob = new Blob([content], { type: (mime || 'text/plain') + ';charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
};
AS.csvName = function (base) {
  var d = new Date();
  function p(x) { return (x < 10 ? '0' : '') + x; }
  return base + '-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + '.csv';
};
/* Print an HTML document via hidden iframe → browser "Save as PDF". */
AS.printHTML = function (title, bodyHTML) {
  var f = document.getElementById('printFrame');
  f.srcdoc = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + AS.esc(title) + '</title><style>' +
    'body{font-family:Roboto,Arial,sans-serif;color:#202124;font-size:12.5px;margin:32px;line-height:1.45}' +
    'h1{font-size:20px;margin:0 0 2px}h2{font-size:13px;text-transform:uppercase;letter-spacing:.8px;color:#5f6368;margin:20px 0 8px;border-bottom:2px solid #4285F4;padding-bottom:4px}' +
    'table{width:100%;border-collapse:collapse;margin-bottom:8px}th{text-align:left;font-size:10px;text-transform:uppercase;color:#5f6368;border-bottom:1.5px solid #dadce0;padding:5px 7px}td{padding:5px 7px;border-bottom:1px solid #e8eaed}' +
    '.r{text-align:right}.muted{color:#5f6368}.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #4285F4;padding-bottom:10px;margin-bottom:4px}' +
    '.small{font-size:11px;color:#5f6368}.good{color:#188038}.bad{color:#d93025}.logo{font-size:18px;font-weight:600}' +
    '@page{margin:16mm}b{font-weight:600}' +
    '</style></head><body>' + bodyHTML + '</body></html>';
  f.onload = function () {
    try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { /* noop */ }
  };
};

/* Icons (Material-style inline SVG) */
AS.ic = function (name, cls) {
  var p = {
    dashboard: 'M4 13h6V4H4v9zm0 7h6v-5H4v5zm9 0h6V11h-6v9zm0-16v5h6V4h-6z',
    trophy: 'M18 5V3H6v2H2v3c0 2.6 1.9 4.7 4.4 5 -.6 1.6-2 2.8-3.7 3.1L2 16.5V20h9v-2h2v2h9v-3.5l-.7-.4c-1.7-.3-3.1-1.5-3.7-3.1 2.5-.3 4.4-2.4 4.4-5V5h-4zM4 8V7h2v3.8C4.8 10.4 4 9.3 4 8zm16 0c0 1.3-.8 2.4-2 2.8V7h2v1z',
    economy: 'M3.5 18.5 9.5 12l4 4 7-8-1.4-1.2-5.6 6.4-4-4L2 17.7z',
    pie: 'M11 2v10h10A10 10 0 1 1 11 2zm2 2.2A8 8 0 1 0 20 12h-7V4.2z',
    compare: 'M4 6h6v12H4zM14 6h6v12h-6zM2 4h2v16H2zM20 4h2v16h-2z',
    sales: 'M4 20h16v2H4zM6 4h2.5v12H6zM11 8h2.5v8H11zM16 11h2.5v5H16z',
    finance: 'M4 10h3v10H4zM9.5 4h3v16h-3zM15 13h3v7h-3z',
    rnd: 'M12 2a8 8 0 0 0-8 8c0 2.9 1.6 5.5 4 6.9V20a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-3.1c2.4-1.4 4-4 4-6.9a8 8 0 0 0-8-8zm-2 18v-1h4v1h-4zm5.5-4.6-.5.3V17h-6v-1.3l-.5-.3A6 6 0 1 1 17.5 15.4zM11 6h2v5.2l3.4 2-.9 1.6L11 12V6z',
    plan: 'M4 4h16v2H4zM4 9h16v2H4zM4 14h10v2H4zM4 19h10v2H4zM17 14l4 3-4 3v-6z',
    product: 'M12 2 3 6.5v11L12 22l9-4.5v-11L12 2zm0 2.2 6.3 3.1L12 10.4 5.7 7.3 12 4.2zM5 9.1l6 3v7.2l-6-3V9.1zm8 10.2v-7.2l6-3v7.2l-6 3z',
    marketing: 'M18 16h3v-2h-3V5a2 2 0 0 0-2-2h-3v2h3v9h-3v2h3zm-8-2H3v2h7v-2zm-4-3h7V9H6v2zm3-6H3v2h6V5z',
    factory: 'M3 21V9l6 4V9l6 4V9l6 4v8H3zm3-6h2v2H6v-2zm5 0h2v2h-2v-2zm5 0h2v2h-2v-2z',
    people: 'M9 11a3.5 3.5 0 1 0-3.5-3.5A3.5 3.5 0 0 0 9 11zm0 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4zm8.5-2a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm.5 2c-.7 0-1.6.1-2.5.3a5.9 5.9 0 0 1 2.5 4.7H23v-2c0-2.2-3.6-3-5-3z',
    bank: 'M12 3 2 8.5V11h20V8.5L12 3zM4 13v6H2v2h20v-2h-2v-6h-3v6h-3v-6h-4v6H7v-6H4zm16 0h.01z',
    projects: 'M12 2 4 7v2h16V7l-8-5zm-5 9-3 3 3 3v-2h10v2l3-3-3-3v2H7v-2zm3 3h4v2h-4z',
    review: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm-1.5 15-5-5 1.4-1.4 3.6 3.6 7.6-7.6L19.5 8l-9 9z',
    report: 'M6 2h9l5 5v15H6zM14 3.5V8h4.5zM8 12h8v2H8zm0 4h8v2H8zm0-8h4v2H8z',
    industries: 'M12 7a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-4.4 0-8 1.8-8 4v9h16v-9c0-2.2-3.6-4-8-4z',
    users: 'M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-4 0-8 2-8 4.5V21h16v-2.5c0-2.5-4-4.5-8-4.5z',
    rounds: 'M12 4V1L8 5l4 4V6a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8zm7 8h-2a5 5 0 0 0-5-5v2a3 3 0 0 1 3 3z',
    database: 'M12 2C7.6 2 4 3.3 4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5c0-1.7-3.6-3-8-3zm0 2c3.9 0 6 .9 6 1s-2.1 1-6 1-6-.9-6-1 2.1-1 6-1zm6 15c0 .1-2.1 1-6 1s-6-.9-6-1v-2.6A13.6 13.6 0 0 0 12 17a13.6 13.6 0 0 0 6 1.4zm0-5c0 .1-2.1 1-6 1s-6-.9-6-1v-2.6A13.6 13.6 0 0 0 12 13a13.6 13.6 0 0 0 6 1.4z',
    guide: 'M4 3h12a2 2 0 0 1 2 2v14a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2V3zm4 4h8v2H8zm0 4h8v2H8zm0 4h5v2H8zM18 21h2v2h-2z',
    lock: 'M17 9V7a5 5 0 0 0-10 0v2H5v13h14V9h-2zm-8-2a3 3 0 0 1 6 0v2H9V7zm4 9.7V19h-2v-2.3a2 2 0 1 1 2 0z',
    password: 'M12 1a5 5 0 0 0-5 5v3H5v13h14V9h-2V6a5 5 0 0 0-5-5zm-3 5a3 3 0 0 1 6 0v3H9V6z',
    clock: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 10.4 4.2 2.5-1 1.7L11 13.6V6h2v6.4z',
    check: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z',
    x: 'M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z',
    warn: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
    info: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z',
    download: 'M12 16 6 10l1.4-1.4L11 12.2V3h2v9.2l3.6-3.6L18 10zM5 19h14v2H5z',
    print: 'M6 2h12v5H6zM4 9a2 2 0 0 0-2 2v6h4v5h12v-5h4v-6a2 2 0 0 0-2-2H4zm12 11v2H8v-5h8v3z',
    plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z',
    play: 'M8 5v14l11-7z',
    logout: 'M10 3H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6v-2H4V5h6V3zm4.6 3.6L13.2 8l3.2 3.2H8v2h8.4L13.2 16l1.4 1.4L21 12z',
    chart: 'M4 20h16v2H4zM6 4h3v13H6zM11 9h3v8h-3zM16 5h3v12h-3z',
    trendup: 'M3.5 18.5 12 10l4 4 6.3-7.1 1.5 1.3L16 17l-4-4-6.5 6.5z',
    news: 'M4 4h16v14H4zM6 6v10h12V6zm2 2h8v2H8zm0 4h8v2H8zM4 20h12v2H4zm14 0h2v2h-2z',
    team: 'M8 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3zM8 13c-2.7 0-8 1.3-8 4v3h8v-3c0-1 .4-1.9 1-2.7A11 11 0 0 0 8 13zm8 0a11 11 0 0 0-1 .3 4 4 0 0 1 1 2.7v3h8v-3c0-2.7-5.3-4-8-4z',
    settings: 'M19.4 13a7.6 7.6 0 0 0 .1-1 7.6 7.6 0 0 0-.1-1l2.1-1.7a.5.5 0 0 0 .1-.6l-2-3.5a.5.5 0 0 0-.6-.2l-2.5 1a7.4 7.4 0 0 0-1.7-1L14.4 2.4A.5.5 0 0 0 14 2h-4a.5.5 0 0 0-.5.4L9.2 5a7.4 7.4 0 0 0-1.7 1l-2.5-1a.5.5 0 0 0-.6.2l-2 3.5a.5.5 0 0 0 .1.6L4.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.7a.5.5 0 0 0-.1.6l2 3.5a.5.5 0 0 0 .6.2l2.5-1a7.4 7.4 0 0 0 1.7 1l.3 2.6a.5.5 0 0 0 .5.4h4a.5.5 0 0 0 .5-.4l.3-2.6a7.4 7.4 0 0 0 1.7-1l2.5 1a.5.5 0 0 0 .6-.2l2-3.5a.5.5 0 0 0-.1-.6zM12 15.5a3.5 3.5 0 1 1 3.5-3.5 3.5 3.5 0 0 1-3.5 3.5z',
    refresh: 'M12 4V1L8 5l4 4V6a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z',
    cal: 'M7 2v2H4v18h16V4h-3V2h-2v2H9V2H7zM6 10h12v10H6V10zm2-6h2v2h2V4h2v2H8V4z'
  };
  return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' + (p[name] || p.info) + '"/></svg>';
};

AS.COLS = {
  blue: '#4285F4', red: '#EA4335', yellow: '#FBBC05', green: '#34A853',
  purple: '#A142F4', cyan: '#24C1E0', pink: '#F45197'
};
AS.TEAM_COLORS = ['#4285F4', '#EA4335', '#FBBC05', '#34A853', '#A142F4', '#24C1E0', '#F45197'];
AS.TEAM_COLOR_NAMES = ['Blue', 'Red', 'Yellow', 'Green', 'Purple', 'Cyan', 'Pink'];

/* Which chart colors to use per theme */
AS.chartPalette = function () {
  var dark = document.body.dataset.theme === 'dark';
  return {
    text: dark ? '#9aa0a6' : '#5f6368',
    grid: dark ? '#3c4043' : '#e8eaed',
    series: dark
      ? ['#8ab4f8', '#f28b82', '#fdd663', '#81c995', '#c58af9', '#78d9ec', '#f7a6d0']
      : AS.TEAM_COLORS
  };
};

AS.ROLE_LABEL = {
  superadmin: 'Super Admin', manager: 'Manager',
  coordinator: 'Team Coordinator', player: 'Player'
};
AS.ROLE_DESC = {
  superadmin: 'Full control — users, industries, settings, rounds, everything',
  manager: 'Partial control — assigned industries: rounds, deadlines, teams, reports',
  coordinator: 'Allotted teams only — decisions, results and reports for those teams',
  player: 'Own team — enter decisions and read team results'
};

/* Segment short color mapping */
AS.SEG_COLOR = { 0: 'blue', 1: 'red', 2: 'yellow' };
