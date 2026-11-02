/* Apex Strategy — app.js: boot, auth screen, shell wiring */
'use strict';

/* Embedded copy of google-apps-script.gs for the Sheets Database page */
AS.APPS_SCRIPT = [
  '/**',
  ' * Apex Strategy — Google Sheets database (Apps Script Web App)',
  ' * -------------------------------------------------------------',
  ' * SETUP (5 minutes):',
  ' * 1. Create a new Google Sheet (any name, e.g. "Apex Strategy DB").',
  ' * 2. Extensions -> Apps Script. Delete the default code and paste this file.',
  ' * 3. Deploy -> New deployment -> type "Web app":',
  ' *      - Execute as: Me   - Who has access: Anyone',
  ' *    Click Deploy, authorize, and copy the Web app URL (ends with /exec).',
  ' * 4. In the Apex Strategy app: Super Admin -> Administration ->',
  ' *    Sheets Database -> paste the URL -> Connect.',
  ' */',
  'var CHUNK = 40000;',
  '',
  'function doGet(e) {',
  '  var action = (e && e.parameter && e.parameter.action) || \'get\';',
  '  try {',
  '    if (action === \'ping\') return out({ ok: true, rev: getRev() });',
  '    if (action === \'get\') {',
  '      var s = readState();',
  '      return out({ ok: true, rev: getRev(), state: s, empty: !s });',
  '    }',
  '    return out({ ok: false, msg: \'Unknown action: \' + action });',
  '  } catch (err) { return out({ ok: false, msg: String(err) }); }',
  '}',
  '',
  'function doPost(e) {',
  '  try {',
  '    var body = JSON.parse(e.postData.contents);',
  '    if (body.action !== \'save\') return out({ ok: false, msg: \'Unknown action\' });',
  '    var rev = getRev();',
  '    if (!body.force && body.baseRev !== rev) return out({ ok: false, conflict: true, rev: rev });',
  '    if (!body.state || body.state.length < 2) return out({ ok: false, msg: \'Empty state\' });',
  '    writeState(body.state);',
  '    setRev(rev + 1);',
  '    return out({ ok: true, rev: rev + 1, saved: new Date().toISOString() });',
  '  } catch (err) { return out({ ok: false, msg: String(err) }); }',
  '}',
  '',
  'function out(obj) {',
  '  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);',
  '}',
  'function getRev() {',
  '  return Number(PropertiesService.getScriptProperties().getProperty(\'rev\') || \'0\');',
  '}',
  'function setRev(r) {',
  '  PropertiesService.getScriptProperties().setProperty(\'rev\', String(r));',
  '}',
  'function getStateSheet() {',
  '  var ss = SpreadsheetApp.getActiveSpreadsheet();',
  '  var sh = ss.getSheetByName(\'STATE\');',
  '  if (!sh) {',
  '    sh = ss.insertSheet(\'STATE\');',
  '    sh.getRange(\'A1\').setValue(\'chunk\');',
  '    sh.getRange(\'B1\').setValue(\'note: Apex Strategy state — do not edit\');',
  '    sh.setFrozenRows(1);',
  '  }',
  '  return sh;',
  '}',
  'function readState() {',
  '  var sh = getStateSheet();',
  '  var last = sh.getLastRow();',
  '  if (last < 2) return \'\';',
  '  var vals = sh.getRange(2, 1, last - 1, 1).getValues();',
  '  return vals.map(function (r) { return r[0]; }).join(\'\');',
  '}',
  'function writeState(s) {',
  '  var sh = getStateSheet();',
  '  var last = sh.getLastRow();',
  '  if (last > 1) sh.getRange(2, 1, last - 1, 1).clearContent();',
  '  var rows = [];',
  '  for (var i = 0; i < s.length; i += CHUNK) rows.push([s.substring(i, i + CHUNK)]);',
  '  if (!rows.length) rows.push([\'\']);',
  '  sh.getRange(2, 1, rows.length, 1).setValues(rows);',
  '}'
].join('\n');

(function () {
  function $(id) { return document.getElementById(id); }

  /* ---------------- theme ---------------- */
  function initTheme() {
    var saved = 'light';
    try { saved = localStorage.getItem('apexTheme') || 'light'; } catch (e) {}
    document.body.dataset.theme = saved;
  }
  function toggleTheme() {
    var now = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    document.body.dataset.theme = now;
    try { localStorage.setItem('apexTheme', now); } catch (e) {}
    /* redraw charts with new palette */
    if (AS.ui) AS.ui.render();
  }

  /* ---------------- drawer ---------------- */
  function toggleDrawer() {
    if (window.innerWidth <= 960) {
      var open = document.body.classList.toggle('nav-open');
      var scrim = $('scrim');
      scrim.style.opacity = open ? 1 : 0;
      scrim.style.pointerEvents = open ? 'auto' : 'none';
    } else {
      document.body.classList.toggle('drawer-coll');
      try { localStorage.setItem('apexDrawer', document.body.classList.contains('drawer-coll') ? '1' : '0'); } catch (e) {}
      setTimeout(function () { if (window.Chart) window.dispatchEvent(new Event('resize')); }, 200);
    }
  }

  /* ---------------- boot ---------------- */
  function showAuth() {
    $('app').hidden = true;
    $('authScreen').hidden = false;
  }
  function showApp() {
    $('authScreen').hidden = true;
    $('app').hidden = false;
    AS.ui.render();
    AS.sheets.startPolling();
  }

  function boot() {
    initTheme();
    try {
      if (localStorage.getItem('apexDrawer') === '1') document.body.classList.add('drawer-coll');
    } catch (e) {}

    AS.store.load();
    $('authVersion').textContent = 'v' + AS.VERSION;
    $('footVersion').textContent = 'v' + AS.VERSION;

    /* restore context per user */
    var u = AS.store.currentUser();
    if (u) {
      var savedInd = null;
      try { savedInd = localStorage.getItem('apexCtx.' + u.id); } catch (e) {}
      if (savedInd) AS.ui.ctx.industryId = savedInd;
      showApp();
    } else showAuth();

    /* ---- auth handlers ---- */
    $('authForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var err = $('authErr');
      var res = AS.store.login($('authEmail').value, $('authPass').value);
      if (!res.ok) { err.textContent = res.msg; err.hidden = false; return; }
      err.hidden = true;
      var cu = AS.store.currentUser();
      try { AS.ui.ctx.industryId = localStorage.getItem('apexCtx.' + cu.id) || null; } catch (ex) {}
      AS.toast('Welcome, ' + cu.name.split(' ')[0], 'ok');
      showApp();
    });
    document.querySelectorAll('[data-demo]').forEach(function (b) {
      b.addEventListener('click', function () {
        $('authEmail').value = b.dataset.demo;
        $('authPass').value = 'Apex@123';
        $('authForm').dispatchEvent(new Event('submit'));
      });
    });

    /* ---- shell handlers ---- */
    $('menuBtn').addEventListener('click', toggleDrawer);
    $('scrim').addEventListener('click', toggleDrawer);
    $('themeBtn').addEventListener('click', toggleTheme);
    $('avatarBtn').addEventListener('click', function (e) {
      e.stopPropagation();
      $('avatarMenu').hidden = !$('avatarMenu').hidden;
    });
    document.addEventListener('click', function () { $('avatarMenu').hidden = true; });
    $('avatarMenu').addEventListener('click', function (e) {
      var b = e.target.closest('[data-nav]');
      if (b) { location.hash = b.dataset.nav; $('avatarMenu').hidden = true; }
    });
    $('logoutBtn').addEventListener('click', function () {
      AS.store.logout();
      showAuth();
    });

    /* ---- routing ---- */
    window.addEventListener('hashchange', function () { AS.ui.render(); });
    if (!location.hash) location.hash = '#/dashboard';

    /* ---- keyboard ---- */
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey && (e.key === 'b' || e.key === 'B')) { e.preventDefault(); toggleDrawer(); }
      if (e.key === 'Escape') {
        $('avatarMenu').hidden = true;
        if (document.body.classList.contains('nav-open')) toggleDrawer();
      }
    });

    /* ---- tickers ---- */
    setInterval(function () {
      if (!$('app').hidden && AS.store.currentUser()) AS.ui.refreshChrome();
    }, 30000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
