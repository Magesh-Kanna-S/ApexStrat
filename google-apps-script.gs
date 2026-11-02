/**
 * Apex Strategy — Google Sheets database (Apps Script Web App)
 * ------------------------------------------------------------
 * SETUP (5 minutes):
 * 1. Create a new Google Sheet (any name, e.g. "Apex Strategy DB").
 * 2. Extensions → Apps Script. Delete the default code and paste this file.
 * 3. Deploy → New deployment → type "Web app":
 *      - Description: Apex Strategy DB
 *      - Execute as: Me
 *      - Who has access: Anyone
 *    Click Deploy, authorize, and copy the Web app URL (ends with /exec).
 * 4. In the Apex Strategy app: sign in as Super Admin → Administration →
 *    Sheets Database → paste the URL → Connect.
 *
 * MODEL: the whole app state is stored as JSON, chunked into rows of a
 * "STATE" sheet (40,000 characters per row). A script property "rev" counts
 * every save so clients can detect conflicts.
 */

var CHUNK = 40000;

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'get';
  try {
    if (action === 'ping') {
      return out({ ok: true, rev: getRev() });
    }
    if (action === 'get') {
      var s = readState();
      return out({ ok: true, rev: getRev(), state: s, empty: !s });
    }
    return out({ ok: false, msg: 'Unknown action: ' + action });
  } catch (err) {
    return out({ ok: false, msg: String(err) });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.action !== 'save') return out({ ok: false, msg: 'Unknown action' });
    var rev = getRev();
    if (!body.force && body.baseRev !== rev) {
      return out({ ok: false, conflict: true, rev: rev });
    }
    if (!body.state || body.state.length < 2) return out({ ok: false, msg: 'Empty state' });
    writeState(body.state);
    setRev(rev + 1);
    return out({ ok: true, rev: rev + 1, saved: new Date().toISOString() });
  } catch (err) {
    return out({ ok: false, msg: String(err) });
  }
}

/* ---------- helpers ---------- */
function out(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function getRev() {
  return Number(PropertiesService.getScriptProperties().getProperty('rev') || '0');
}
function setRev(r) {
  PropertiesService.getScriptProperties().setProperty('rev', String(r));
}
function getStateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('STATE');
  if (!sh) {
    sh = ss.insertSheet('STATE');
    sh.getRange('A1').setValue('chunk');
    sh.getRange('B1').setValue('note: Apex Strategy state — do not edit');
    sh.setFrozenRows(1);
  }
  return sh;
}
function readState() {
  var sh = getStateSheet();
  var last = sh.getLastRow();
  if (last < 2) return '';
  var vals = sh.getRange(2, 1, last - 1, 1).getValues();
  return vals.map(function (r) { return r[0]; }).join('');
}
function writeState(s) {
  var sh = getStateSheet();
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, 1).clearContent();
  var rows = [];
  for (var i = 0; i < s.length; i += CHUNK) rows.push([s.substring(i, i + CHUNK)]);
  if (!rows.length) rows.push(['']);
  sh.getRange(2, 1, rows.length, 1).setValues(rows);
}

/* Optional: run this once from the editor to initialize. */
function setup() {
  getStateSheet();
  setRev(getRev());
}
