/* Apex Strategy — sheets.js: Google Sheets database sync (Apps Script Web App)
   Model: whole-state JSON, chunked into a STATE sheet (40k chars per row).
   Writes are pull → merge → push with a monotonically increasing revision. */
'use strict';
(function () {
  var debounceTimer = null, inFlight = false, pendingHints = null;

  function cfg() { return AS.store.state.settings.sheets; }

  function status() {
    var c = cfg();
    return {
      mode: c.url && c.connected ? 'live' : 'demo',
      state: !c.url ? 'off' : (c.connected ? (c.lastError ? 'err' : 'ok') : 'off'),
      lastSync: c.lastSync, lastError: c.lastError, url: c.url
    };
  }

  async function callAPI(params, body) {
    var url = cfg().url;
    if (!url) throw new Error('No Apps Script URL configured');
    var opts = { method: body ? 'POST' : 'GET', redirect: 'follow' };
    if (body) {
      opts.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
      opts.body = JSON.stringify(body);
    }
    var qs = Object.keys(params || {}).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
    var res = await fetch(url + (qs ? '?' + qs : ''), opts);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  }

  async function test(url) {
    var res = await fetch(url + '?action=ping', { method: 'GET', redirect: 'follow' });
    var j = await res.json();
    if (!j.ok) throw new Error('Endpoint did not respond correctly');
    return j;
  }

  /* ---- merge remote state into local (best effort, classroom-safe) ---- */
  function mergeRemote(local, remote, hints) {
    hints = hints || {};
    var hInd = hints.industryId, hTeam = hints.teamId;

    /* logs: union by id */
    var seen = {}, logs = [];
    local.logs.concat(remote.logs).forEach(function (l) {
      if (!seen[l.id]) { seen[l.id] = 1; logs.push(l); }
    });
    logs.sort(function (a, b) { return a.ts < b.ts ? -1 : 1; });
    local.logs = logs.slice(-4000);

    /* users: remote wins, keep local-only additions */
    var ru = {}; remote.users.forEach(function (u) { ru[u.id] = u; });
    var lu = {}; local.users.forEach(function (u) { lu[u.id] = u; });
    var users = remote.users.slice();
    local.users.forEach(function (u) { if (!ru[u.id]) users.push(u); });
    /* preserve the signed-in user's password locally if changed offline */
    var meId = AS.store.currentUser() ? AS.store.currentUser().id : null;
    if (meId && lu[meId] && ru[meId] && lu[meId].pass !== ru[meId].pass) {
      users = users.map(function (u) { return u.id === meId ? lu[meId] : u; });
    }
    local.users = users;

    /* industries: local wins for hinted (just-edited), else remote */
    var rInd = {}; remote.industries.forEach(function (i) { rInd[i.id] = i; });
    var inds = remote.industries.slice();
    local.industries.forEach(function (i) {
      if (!rInd[i.id]) inds.push(i);
      else if (i.id === hInd) inds = inds.map(function (x) { return x.id === i.id ? i : x; });
    });
    local.industries = inds;

    /* teams: hinted team local-wins; others merge decisions by updatedAt */
    var rTeam = {}; remote.teams.forEach(function (t) { rTeam[t.id] = t; });
    var teams = remote.teams.slice();
    local.teams.forEach(function (t) {
      var r = rTeam[t.id];
      if (!r) { teams.push(t); return; }
      if (t.id === hTeam) { teams = teams.map(function (x) { return x.id === t.id ? t : x; }); return; }
      /* per-quarter decisions: newer updatedAt wins */
      var qs = {}; Object.keys(r.decisions).forEach(function (q) { qs[q] = 1; });
      Object.keys(t.decisions).forEach(function (q) { qs[q] = 1; });
      Object.keys(qs).forEach(function (q) {
        var a = t.decisions[q], b = r.decisions[q];
        if (!a) return; if (!b) { r.decisions[q] = a; return; }
        if ((a.updatedAt || 0) > (b.updatedAt || 0)) r.decisions[q] = a;
      });
      r.members = Array.from(new Set((r.members || []).concat(t.members || [])));
    });
    local.teams = teams;

    /* settings: keep local connection config, take remote otherwise */
    var ls = local.settings.sheets;
    local.settings = JSON.parse(JSON.stringify(remote.settings));
    local.settings.sheets.url = ls.url;
    local.settings.sheets.connected = ls.connected;
    local.settings.sheets.autoSync = ls.autoSync;
  }

  async function pull(hints) {
    if (!cfg().url) return { ok: false };
    var j = await callAPI({ action: 'get' });
    if (j.ok && j.state) {
      var remote = JSON.parse(j.state);
      mergeRemote(AS.store.state, remote, hints);
      AS.store.state.rev = j.rev;
      cfg().lastSync = AS.todayISO(); cfg().lastError = null;
      AS.store.save();
      AS.ui && AS.ui.refreshChrome();
      return { ok: true, rev: j.rev };
    }
    throw new Error(j.msg || 'Bad response');
  }

  async function push(hints) {
    if (!cfg().url || !cfg().connected) return { ok: false, skipped: true };
    if (inFlight) { queuePush(hints); return { ok: false, queued: true }; }
    inFlight = true;
    try {
      /* pull-merge first so we push on top of the latest remote */
      var g = await callAPI({ action: 'get' });
      var local = AS.store.state;
      if (g.ok && g.state) {
        var remote = JSON.parse(g.state);
        if (g.rev !== local.rev) {
          mergeRemote(local, remote, hints);
          local.rev = g.rev;
          AS.store.save();
        }
      }
      var res = await callAPI({}, { action: 'save', baseRev: local.rev, state: JSON.stringify(local) });
      if (res.ok) {
        local.rev = res.rev;
        cfg().lastSync = AS.todayISO(); cfg().lastError = null;
        AS.store.save();
        AS.ui && AS.ui.refreshChrome();
        return { ok: true };
      }
      if (res.conflict) {
        cfg().lastError = 'Conflict: another device saved newer data.';
        AS.store.save();
        AS.toast('Sync conflict — another device saved newer data. Reverting to their version (your log entries are kept).', 'err');
        /* adopt remote to resolve */
        var r2 = await callAPI({ action: 'get' });
        if (r2.ok && r2.state) {
          mergeRemote(AS.store.state, JSON.parse(r2.state), {});
          AS.store.state.rev = r2.rev;
          AS.store.save();
        }
        AS.ui && AS.ui.render();
        return { ok: false, conflict: true };
      }
      throw new Error(res.msg || 'Save rejected');
    } catch (e) {
      cfg().lastError = String(e.message || e);
      cfg().lastSync = AS.todayISO();
      AS.store.save();
      AS.ui && AS.ui.refreshChrome();
      return { ok: false, error: cfg().lastError };
    } finally {
      inFlight = false;
    }
  }

  function queuePush(hints) {
    pendingHints = pendingHints || {};
    if (hints && hints.industryId) pendingHints.industryId = hints.industryId;
    if (hints && hints.teamId) pendingHints.teamId = hints.teamId;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      var h = pendingHints; pendingHints = null;
      push(h);
    }, 1200);
  }

  async function connect(url) {
    var j = await test(url);
    var c = cfg();
    c.url = url; c.connected = true; c.lastError = null;
    /* adopt remote state if it exists, else seed it */
    var g = await callAPI({ action: 'get' });
    if (g.ok && g.state) {
      var remote = JSON.parse(g.state);
      if (remote && remote.users && remote.users.length) {
        mergeRemote(AS.store.state, remote, {});
        AS.store.state.rev = g.rev;
      } else {
        await callAPI({}, { action: 'save', baseRev: g.rev, state: JSON.stringify(AS.store.state) });
        AS.store.state.rev = g.rev + 1;
      }
    }
    c.lastSync = AS.todayISO();
    return { ok: true };
  }

  function disconnect() {
    var c = cfg();
    c.connected = false; c.lastError = null;
  }

  /* periodic pull when live */
  function startPolling() {
    setInterval(function () {
      var c = cfg();
      if (c.url && c.connected && !inFlight && !debounceTimer && document.visibilityState !== 'hidden') {
        pull().catch(function (e) {
          c.lastError = String(e.message || e); AS.store.save(); AS.ui && AS.ui.refreshChrome();
        });
      }
    }, 20000);
  }

  AS.sheets = {
    status: status, pull: pull, push: push, queuePush: queuePush,
    connect: connect, disconnect: disconnect, startPolling: startPolling
  };
})();
