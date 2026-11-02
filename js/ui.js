/* Apex Strategy — ui.js: router, navigation, chrome, components */
'use strict';
(function () {
  var charts = [];
  var ctx = { industryId: null };

  /* ---------------- nav definition ---------------- */
  var ALL = ['superadmin', 'manager', 'coordinator', 'player'];
  var DECIDE_ROLES = ALL;
  var NAV = [
    { group: 'Overview', items: [{ id: 'dashboard', label: 'Dashboard', icon: 'dashboard', roles: ALL }] },
    { group: 'Results', items: [
      { id: 'leaderboard', label: 'Leaderboard', icon: 'trophy', roles: ALL },
      { id: 'economy', label: 'Market Economy', icon: 'economy', roles: ALL },
      { id: 'share', label: 'Market Share', icon: 'pie', roles: ALL },
      { id: 'benchmark', label: 'Benchmarking', icon: 'compare', roles: ALL },
      { id: 'sales', label: 'Sales Analysis', icon: 'sales', roles: ALL },
      { id: 'statements', label: 'Financial Statements', icon: 'finance', roles: ALL },
      { id: 'rnd', label: 'R&D Report', icon: 'rnd', roles: ALL }
    ] },
    { group: 'Decide', items: [
      { id: 'planning', label: 'Planning Hub', icon: 'plan', roles: DECIDE_ROLES },
      { id: 'design', label: 'Product Design', icon: 'product', roles: DECIDE_ROLES },
      { id: 'marketing', label: 'Marketing Mix', icon: 'marketing', roles: DECIDE_ROLES },
      { id: 'operations', label: 'Operations', icon: 'factory', roles: DECIDE_ROLES },
      { id: 'manpower', label: 'Manpower', icon: 'people', roles: DECIDE_ROLES },
      { id: 'finance', label: 'Finance', icon: 'bank', roles: DECIDE_ROLES },
      { id: 'projects', label: 'Special Projects', icon: 'projects', roles: DECIDE_ROLES },
      { id: 'review', label: 'Review & Submit', icon: 'review', roles: DECIDE_ROLES }
    ] },
    { group: 'Reports', items: [{ id: 'reports', label: 'Reports & Logs', icon: 'report', roles: ALL }] },
    { group: 'Administration', items: [
      { id: 'industries', label: 'Industries', icon: 'industries', roles: ['superadmin'] },
      { id: 'users', label: 'Users', icon: 'users', roles: ['superadmin', 'manager'] },
      { id: 'rounds', label: 'Round Control', icon: 'rounds', roles: ['superadmin', 'manager'] },
      { id: 'database', label: 'Sheets Database', icon: 'database', roles: ['superadmin'] }
    ] },
    { group: 'Help', items: [
      { id: 'guide', label: 'Learner Guide', icon: 'guide', roles: ALL },
      { id: 'password', label: 'Change Password', icon: 'password', roles: ALL }
    ] }
  ];

  /* ---------------- helpers ---------------- */
  function user() { return AS.store.currentUser(); }
  function industry() {
    var u = user();
    var list = AS.store.industriesFor(u);
    var cur = list.filter(function (i) { return i.id === ctx.industryId; })[0];
    return cur || list[0] || null;
  }
  function industryList() { return AS.store.industriesFor(user()); }
  function teams() { var i = industry(); return i ? AS.store.teamsFor(user(), i) : []; }
  function allTeamsInIndustry() {
    var i = industry(); if (!i) return [];
    return AS.store.state.teams.filter(function (t) { return t.industryId === i.id; });
  }
  /* team currently edited on decide pages */
  function decideTeam() {
    var u = user(), i = industry(); if (!i) return null;
    var mine = AS.store.teamsFor(u, i);
    var t = mine.filter(function (x) { return x.id === ctx.teamId; })[0];
    return t || mine[0] || null;
  }
  function currentQuarter() { var i = industry(); return i ? i.currentQuarter : 0; }
  function lastQ() { var i = industry(); return i ? AS.lastPlayedQ(i) : 0; }
  function scenario() { var i = industry(); return i ? AS.scenario(i.scenario) : AS.scenario('phones'); }
  function teamById(id) { return AS.store.state.teams.filter(function (t) { return t.id === id; })[0]; }
  function userById(id) { return AS.store.state.users.filter(function (u) { return u.id === id; })[0]; }

  function canDecide() {
    var u = user(); if (!u) return false;
    var i = industry(); if (!i) return false;
    return AS.store.teamsFor(u, i).length > 0;
  }
  function pageAllowed(item) {
    var u = user(); if (!u) return false;
    if (item.roles.indexOf(u.role) < 0) return false;
    if (['planning', 'design', 'marketing', 'operations', 'manpower', 'finance', 'projects', 'review'].indexOf(item.id) >= 0)
      return canDecide();
    if (item.id === 'industries') return u.role === 'superadmin';
    if (item.id === 'database') return u.role === 'superadmin';
    if (item.id === 'users' || item.id === 'rounds') return u.role === 'superadmin' || u.role === 'manager';
    return true;
  }

  /* ---------------- chrome ---------------- */
  function buildNav() {
    var root = document.getElementById('navRoot');
    var active = route().page;
    var html = '';
    NAV.forEach(function (g) {
      var items = g.items.filter(pageAllowed);
      if (!items.length) return;
      html += '<div class="nav-group">' + g.group + '</div>';
      items.forEach(function (it) {
        html += '<a class="nav-item' + (it.id === active ? ' on' : '') + '" href="#/' + it.id + '" title="' + it.label + '">' +
          AS.ic(it.icon) + '<span>' + it.label + '</span></a>';
      });
    });
    root.innerHTML = html;
  }

  function refreshChrome() {
    var u = user(); if (!u) return;
    var i = industry();
    /* avatar + menu */
    var av = document.getElementById('avatarBtn');
    av.textContent = (u.name || '?').trim().charAt(0).toUpperCase();
    document.getElementById('amName').textContent = u.name;
    document.getElementById('amEmail').textContent = u.email;
    var rt = document.getElementById('amRole');
    rt.textContent = AS.ROLE_LABEL[u.role];
    rt.className = 'roletag role-' + u.role;
    /* top context */
    var tc = document.getElementById('topContext');
    if (i) {
      var q = i.currentQuarter;
      var qtxt = i.phase === 'setup' ? 'Setup' :
        i.phase === 'finished' ? 'Finished' :
        (q > i.quartersTotal ? 'Finished' : 'Q' + q + ' of ' + i.quartersTotal + (q <= i.practiceRounds ? ' · practice' : ''));
      tc.innerHTML = '<span class="chip chip-blue">' + AS.esc(i.name) + '</span>' +
        '<span class="chip">' + qtxt + '</span>' +
        (i.scenario ? '<span class="chip">' + AS.esc(scenario().label) + '</span>' : '');
    } else tc.innerHTML = '';
    /* deadline chip */
    var dl = document.getElementById('deadlineChip');
    if (i && i.phase === 'running' && q <= i.quartersTotal) {
      var reason = AS.store.lockReason(i, q);
      var t = AS.timeLeft(AS.store.deadlineFor(i, q));
      if (reason === 'Deadline passed') {
        dl.hidden = false; dl.className = 'deadline-chip over';
        dl.innerHTML = AS.ic('clock') + ' Q' + q + ' deadline passed';
      } else if (t) {
        dl.hidden = false; dl.className = 'deadline-chip';
        dl.innerHTML = AS.ic('clock') + ' Q' + q + ' in ' + t.text;
      } else {
        dl.hidden = false; dl.className = 'deadline-chip';
        dl.innerHTML = AS.ic('clock') + ' Q' + q + ' — no deadline set';
      }
    } else dl.hidden = true;
    /* sync badge */
    var sb = document.getElementById('syncBadge');
    var st = AS.sheets.status();
    if (st.mode === 'live') {
      sb.hidden = false; sb.className = 'sync-badge' + (st.state === 'err' ? ' err' : '');
      sb.innerHTML = '<span class="dot"></span>Live · ' + (st.state === 'err' ? 'sync issue' : 'Sheets synced');
    } else sb.hidden = true;
    /* drawer footer */
    var di = document.getElementById('drawerIndustry');
    var inds = industryList();
    if (inds.length > 1) {
      di.hidden = false;
      di.innerHTML = '<select id="indSelect" title="Switch industry">' + inds.map(function (x) {
        return '<option value="' + x.id + '"' + (i && x.id === i.id ? ' selected' : '') + '>' + AS.esc(x.name) + '</option>';
      }).join('') + '</select>';
      document.getElementById('indSelect').addEventListener('change', function () {
        setIndustry(this.value);
      });
    } else if (inds.length === 1) {
      di.hidden = false;
      di.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:2px 0">' + AS.esc(inds[0].name) + '</div>';
    } else di.hidden = true;
    var ds = document.getElementById('drawerSync');
    ds.className = 'drawer-sync' + (st.mode === 'live' ? (st.state === 'err' ? ' err' : '') : ' off');
    ds.innerHTML = '<span class="dot"></span>' + (st.mode === 'live'
      ? 'Google Sheets · ' + (st.lastSync ? AS.fmtDateShort(st.lastSync) : 'not synced yet')
      : 'Demo mode · data stays in this browser');
  }

  function setIndustry(id) {
    ctx.industryId = id;
    var u = user();
    if (u) { try { localStorage.setItem('apexCtx.' + u.id, id); } catch (e) {} }
    var mine = industry() ? AS.store.teamsFor(u, industry()) : [];
    ctx.teamId = mine.length ? mine[0].id : null;
    render();
  }
  function setTeam(id) { ctx.teamId = id; render(); }

  /* ---------------- router ---------------- */
  function route() {
    var h = location.hash.replace(/^#\/?/, '');
    var parts = h.split('/').filter(Boolean);
    return { page: parts[0] || 'dashboard', params: parts.slice(1) };
  }
  function render() {
    var u = user(); if (!u) return;
    /* validate context */
    var inds = industryList();
    if (!inds.length) {
      document.getElementById('page').innerHTML = '<div class="card"><div class="empty">' + AS.ic('info') +
        '<h3>No simulation assigned yet</h3><p class="muted">Ask your Super Admin to add you to an industry.</p></div></div>';
      buildNav(); refreshChrome(); return;
    }
    if (!industry()) ctx.industryId = inds[0].id;
    var r = route();
    /* find page renderer */
    var item = null;
    NAV.forEach(function (g) { g.items.forEach(function (it) { if (it.id === r.page) item = it; }); });
    if (!item || !pageAllowed(item)) { location.hash = '#/dashboard'; return; }
    charts.forEach(function (c) { try { c.destroy(); } catch (e) {} });
    charts = [];
    buildNav(); refreshChrome();
    var el = document.getElementById('page');
    el.scrollTop = 0; window.scrollTo(0, 0);
    var fn = AS.PAGES[item.id];
    if (fn) fn(el, r.params);
    /* close mobile drawer on navigate */
    document.body.classList.remove('nav-open');
    document.getElementById('scrim').style.opacity = 0;
    document.getElementById('scrim').style.pointerEvents = 'none';
  }

  /* ---------------- components ---------------- */
  AS.toast = function (msg, type) {
    var box = document.getElementById('toasts');
    var t = document.createElement('div');
    t.className = 'toast ' + (type || 'info');
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, 3600);
    setTimeout(function () { t.remove(); }, 4000);
  };
  AS.modal = function (opts) {
    var root = document.getElementById('modalRoot');
    var scrim = document.createElement('div');
    scrim.className = 'modal-scrim';
    scrim.innerHTML = '<div class="modal' + (opts.wide ? ' wide' : '') + '">' +
      (opts.title ? '<h3>' + opts.title + '</h3>' : '') +
      (opts.sub ? '<p class="modal-sub">' + opts.sub + '</p>' : '') +
      '<div class="modal-body">' + (opts.body || '') + '</div>' +
      '<div class="modal-actions">' + (opts.actions || '') + '</div></div>';
    root.appendChild(scrim);
    function close() { scrim.remove(); }
    scrim.addEventListener('click', function (e) { if (e.target === scrim) close(); });
    if (opts.onmount) opts.onmount(scrim, close);
    return { close: close, el: scrim };
  };
  AS.confirmBox = function (msg, okLabel) {
    return new Promise(function (res) {
      var m = AS.modal({
        title: 'Please confirm',
        body: '<p>' + msg + '</p>',
        actions: '<button class="btn btn-outline" data-x="0">Cancel</button>' +
          '<button class="btn btn-primary" data-x="1">' + (okLabel || 'Confirm') + '</button>',
        onmount: function (el, close) {
          el.querySelectorAll('[data-x]').forEach(function (b) {
            b.addEventListener('click', function () { close(); res(b.dataset.x === '1'); });
          });
        }
      });
    });
  };

  AS.chart = function (canvasId, type, data, opts) {
    var el = document.getElementById(canvasId);
    if (!el || !window.Chart) return;
    var pal = AS.chartPalette();
    Chart.defaults.font.family = 'Roboto, system-ui, sans-serif';
    Chart.defaults.color = pal.text;
    opts = opts || {};
    var round = type === 'doughnut' || type === 'pie';
    var options = {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: round ? 'nearest' : 'index', intersect: false },
      plugins: {
        legend: { position: opts.legend === false ? false : 'bottom', labels: { usePointStyle: true, boxWidth: 7, padding: 12 } },
        tooltip: { callbacks: { label: function (c) {
          var v = round ? c.parsed : c.parsed.y;
          return ' ' + (c.dataset.label || c.label) + ': ' + (v == null ? '-' : AS.NF1.format(v));
        } } }
      }
    };
    if (round) options.cutout = '58%';
    else {
      options.scales = {
        x: { grid: { display: false } },
        y: { grid: { color: pal.grid }, title: { display: !!opts.yTitle, text: opts.yTitle || '' },
             ticks: { callback: function (v) { return AS.NF0.format(v); } } }
      };
    }
    (data.datasets || []).forEach(function (d) {
      if (type === 'line') { d.tension = .3; if (d.pointRadius === undefined) d.pointRadius = 3; if (d.borderWidth === undefined) d.borderWidth = 2.5; }
      if (type === 'bar') d.borderRadius = 6;
    });
    var c = new Chart(el, { type: type, data: data, options: options });
    charts.push(c);
    return c;
  };

  /* KPI card html */
  AS.kpi = function (label, value, sub, opts) {
    opts = opts || {};
    var bar = opts.pct !== undefined ?
      '<div class="bar"><i style="width:' + AS.clamp(0, 100, opts.pct) + '%;background:' + (opts.color || 'var(--c-blue-btn)') + '"></i></div>' : '';
    return '<div class="card kpi">' +
      '<span class="lbl">' + (opts.icon ? AS.ic(opts.icon) : '') + label + '</span>' +
      '<span class="val ' + (opts.cls || '') + '">' + value + '</span>' +
      (sub ? '<span class="sub">' + sub + '</span>' : '') + bar + '</div>';
  };
  AS.scorebar = function (label, score, note) {
    var col = score >= 67 ? 'var(--c-green-btn)' : score >= 34 ? 'var(--c-yellow-vivid)' : 'var(--c-red-btn)';
    return '<div class="sbar"><div class="row"><b>' + label + '</b><span class="pillnum">' + score.toFixed(0) + '/100</span></div>' +
      '<div class="track"><i style="width:' + AS.clamp(0, 100, score) + '%;background:' + col + '"></i></div>' +
      (note ? '<div class="note">' + note + '</div>' : '') + '</div>';
  };
  AS.qsteps = function (ind) {
    var html = '<div class="qsteps">';
    for (var q = 1; q <= ind.quartersTotal; q++) {
      var played = (ind.results || {})[q];
      var isNow = ind.phase === 'running' && q === ind.currentQuarter;
      var prac = q <= ind.practiceRounds;
      html += '<span class="qstep ' + (played ? 'done' : '') + ' ' + (isNow ? 'now' : '') + ' ' + (prac && !played ? 'practice' : '') +
        '" title="Quarter ' + q + (prac ? ' (practice)' : '') + '">Q' + q + (prac ? '·P' : '') + '</span>';
    }
    return html + '</div>';
  };
  AS.dotHTML = function (team) {
    return '<span class="tdot" style="background:' + AS.TEAM_COLORS[team.color % 7] + '"></span>';
  };
  AS.teamChip = function (team) {
    return AS.dotHTML(team) + AS.esc(team.name);
  };
  /* page header helper */
  AS.pageHead = function (title, sub, actionsHTML) {
    return '<div class="page-head"><div><h1>' + title + '</h1>' +
      (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div><div class="spacer"></div>' +
      '<div class="page-actions">' + (actionsHTML || '') + '</div></div>';
  };
  /* team picker for decide pages (users with >1 permitted team) */
  AS.teamPicker = function () {
    var u = user(), i = industry();
    var mine = AS.store.teamsFor(u, i);
    if (mine.length <= 1) return '';
    var cur = decideTeam();
    return '<div class="fld" style="max-width:320px;margin-bottom:14px"><span>Working on team</span>' +
      '<select id="decideTeamSel">' + mine.map(function (t) {
        return '<option value="' + t.id + '"' + (cur && t.id === cur.id ? ' selected' : '') + '>' + AS.esc(t.name) + '</option>';
      }).join('') + '</select></div>';
  };
  AS.bindTeamPicker = function () {
    var sel = document.getElementById('decideTeamSel');
    if (sel) sel.addEventListener('change', function () { setTeam(this.value); });
  };
  /* decide-page lock banner; returns {locked, reason} */
  AS.decideLock = function (team) {
    var i = industry(), u = user();
    if (i.phase !== 'running') return { locked: true, reason: i.phase === 'setup' ? 'Simulation has not started yet.' : 'This simulation has finished.' };
    var q = i.currentQuarter;
    if (q > i.quartersTotal) return { locked: true, reason: 'All quarters are complete.' };
    var reason = AS.store.lockReason(i, q);
    if (reason) return { locked: true, reason: reason + ' — decisions for Q' + q + ' are locked.' };
    if (!AS.store.canEditTeam(u, team)) return { locked: true, reason: 'You do not have access to this team.' };
    return { locked: false };
  };
  AS.lockBanner = function (lock) {
    return '<div class="callout yellow">' + AS.ic('lock') + '<div><b>Decisions locked.</b> ' + lock.reason + '</div></div>';
  };

  AS.PAGES = {};
  AS.ui = {
    render: render, refreshChrome: refreshChrome, setIndustry: setIndustry, setTeam: setTeam,
    ctx: ctx, user: user, industry: industry, industryList: industryList, teams: teams,
    allTeamsInIndustry: allTeamsInIndustry, decideTeam: decideTeam, currentQuarter: currentQuarter,
    lastQ: lastQ, scenario: scenario, teamById: teamById, userById: userById, canDecide: canDecide,
    route: route
  };
})();
