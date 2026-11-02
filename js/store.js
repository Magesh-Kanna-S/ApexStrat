/* Apex Strategy — store.js: state, auth, permissions, activity log, seed */
'use strict';
(function () {
  var KEY = 'apexStrategyState.v1';
  var SKEY = 'apexSession.v1';
  var state = null;
  var sessionUserId = null;

  /* ---------------- persistence ---------------- */
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) { state = JSON.parse(raw); }
    } catch (e) { state = null; }
    if (!state || state.version !== AS.VERSION) { state = seedState(); persist(); }
    try { sessionUserId = localStorage.getItem(SKEY) || null; } catch (e) {}
    return state;
  }
  function persist() {
    state.updatedAt = AS.todayISO();
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { AS.toast('Storage full — data not saved locally', 'err'); }
  }
  function save() { persist(); }

  /* Commit = mutate + log + persist + queue sync + rerender */
  function commit(action, details, opts) {
    opts = opts || {};
    var u = currentUser();
    state.logs.push({
      id: AS.uid('L'), ts: AS.todayISO(),
      userId: u ? u.id : null, userName: u ? u.name : 'System', role: u ? u.role : 'system',
      industryId: opts.industryId || null, teamId: opts.teamId || null,
      action: action, details: details || ''
    });
    if (state.logs.length > 4000) state.logs = state.logs.slice(-3500);
    persist();
    if (window.AS.sheets && state.settings.sheets.url && state.settings.sheets.connected && state.settings.sheets.autoSync) {
      AS.sheets.queuePush({ industryId: opts.industryId || null, teamId: opts.teamId || null });
    }
    if (opts.rerender !== false && window.AS.ui) AS.ui.render();
  }

  /* ---------------- seed ---------------- */
  function seedState() {
    var users = AS.seedUsers();
    var industries = [], teams = [], logs = [];
    var now = AS.todayISO();

    /* Industry 1: running demo (smartphones) */
    var ind = {
      id: 'IND_demo1', name: 'Demo Industry — Smartphones 2026', scenario: 'phones',
      quartersTotal: 8, practiceRounds: 2, currentQuarter: 1,
      phase: 'running', teamSizeMax: 7, managerIds: ['U_manager'],
      deadlines: {}, lockedQ: {}, results: {},
      createdAt: now, startedAt: now, createdBy: 'U_superadmin'
    };
    industries.push(ind);
    var scen = AS.scenario('phones');
    for (var i = 0; i < 7; i++) teams.push(AS.makeTeam(ind.id, 'phones', i));

    /* Industry 2: setup (scooters) — shows multi-industry support */
    var ind2 = {
      id: 'IND_setup1', name: 'MBA Batch 2026 — Electric Scooters', scenario: 'scooters',
      quartersTotal: 6, practiceRounds: 1, currentQuarter: 0,
      phase: 'setup', teamSizeMax: 5, managerIds: ['U_manager'],
      deadlines: {}, lockedQ: {}, results: {},
      createdAt: now, startedAt: null, createdBy: 'U_superadmin'
    };
    industries.push(ind2);
    for (var j = 0; j < 4; j++) teams.push(AS.makeTeam(ind2.id, 'scooters', j));

    /* assignments */
    var mgr = users.filter(function (u) { return u.role === 'manager'; })[0];
    mgr.industryIds = [ind.id, ind2.id];
    var coord = users.filter(function (u) { return u.role === 'coordinator'; })[0];
    coord.industryIds = [ind.id];
    coord.teamIds = [teams[0].id, teams[1].id];
    var p1 = users.filter(function (u) { return u.email === 'player@apex.app'; })[0];
    p1.industryIds = [ind.id]; p1.teamIds = [teams[0].id];
    var p2 = users.filter(function (u) { return u.email === 'player2@apex.app'; })[0];
    p2.industryIds = [ind.id]; p2.teamIds = [teams[1].id];
    teams[0].members = [p1.id];
    teams[1].members = [p2.id];

    var st = {
      version: AS.VERSION, rev: 1, updatedAt: now,
      users: users, industries: industries, teams: teams, logs: [],
      settings: { sheets: { url: '', connected: false, autoSync: true, lastSync: null, lastError: null } }
    };

    /* baseline Q0 for the running industry */
    var indTeams = teams.filter(function (t) { return t.industryId === ind.id; });
    indTeams.forEach(function (t) {
      t.decisions[0] = AS.defaultDecision(t, scen, indTeams.length);
    });
    var env = { teams: teams, industries: industries };
    AS.engineProcess(st, ind, 0);
    indTeams.forEach(function (t) {
      t.decisions[1] = JSON.parse(JSON.stringify(t.decisions[0]));
      t.submitted = {};
    });
    ind.deadlines[1] = new Date(Date.now() + 7 * 864e5).toISOString();

    /* baseline Q0 for the setup industry as well */
    var ind2Teams = teams.filter(function (t) { return t.industryId === ind2.id; });
    ind2Teams.forEach(function (t) { t.decisions[0] = AS.defaultDecision(t, AS.scenario('scooters'), ind2Teams.length); });
    AS.engineProcess(st, ind2, 0);
    ind2Teams.forEach(function (t) { t.submitted = {}; });

    st.logs.push({
      id: AS.uid('L'), ts: now, userId: 'U_superadmin', userName: 'Apex Admin', role: 'superadmin',
      industryId: ind.id, teamId: null,
      action: 'industry-create', details: 'Created "' + ind.name + '" (7 companies, 8 quarters, 2 practice rounds) and computed last-year baseline results.'
    });
    return st;
  }

  function resetAll() {
    try { localStorage.removeItem(KEY); localStorage.removeItem(SKEY); } catch (e) {}
    state = seedState(); persist();
  }

  /* ---------------- auth ---------------- */
  function login(email, pass) {
    var u = state.users.filter(function (x) { return x.email.toLowerCase() === String(email).toLowerCase().trim(); })[0];
    if (!u) return { ok: false, msg: 'No account found for this email.' };
    if (!u.active) return { ok: false, msg: 'This account is deactivated. Contact your Super Admin.' };
    if (u.pass !== AS.hash(pass)) return { ok: false, msg: 'Incorrect password.' };
    sessionUserId = u.id;
    try { localStorage.setItem(SKEY, u.id); } catch (e) {}
    logRaw('signin', 'Signed in', u);
    persist();
    return { ok: true, user: u };
  }
  function logout() {
    var u = currentUser();
    if (u) logRaw('signout', 'Signed out', u);
    sessionUserId = null;
    try { localStorage.removeItem(SKEY); } catch (e) {}
    persist();
  }
  function currentUser() {
    if (!sessionUserId) return null;
    return state.users.filter(function (u) { return u.id === sessionUserId && u.active; })[0] || null;
  }
  function logRaw(action, details, u, industryId, teamId) {
    u = u || currentUser();
    state.logs.push({
      id: AS.uid('L'), ts: AS.todayISO(), userId: u ? u.id : null,
      userName: u ? u.name : 'System', role: u ? u.role : 'system',
      industryId: industryId || null, teamId: teamId || null, action: action, details: details || ''
    });
  }

  /* ---------------- permissions ---------------- */
  function industriesFor(user) {
    if (!user) return [];
    if (user.role === 'superadmin') return state.industries;
    if (user.role === 'manager') return state.industries.filter(function (i) { return user.industryIds.indexOf(i.id) >= 0; });
    /* coordinator/player: industries of their teams */
    var tids = user.teamIds || [];
    return state.industries.filter(function (i) {
      return (user.industryIds || []).indexOf(i.id) >= 0 ||
        state.teams.some(function (t) { return t.industryId === i.id && tids.indexOf(t.id) >= 0; });
    });
  }
  function teamsFor(user, industry) {
    var inInd = state.teams.filter(function (t) { return t.industryId === industry.id; });
    if (!user) return [];
    if (user.role === 'superadmin' || user.role === 'manager') return inInd;
    return inInd.filter(function (t) {
      return (user.teamIds || []).indexOf(t.id) >= 0 || (t.members || []).indexOf(user.id) >= 0;
    });
  }
  function allTeams(user) {  // across permitted industries
    var inds = industriesFor(user);
    var ids = {}; inds.forEach(function (i) { ids[i.id] = 1; });
    return state.teams.filter(function (t) { return ids[t.industryId]; });
  }
  function canEditTeam(user, team) {
    if (!user || !team) return false;
    if (user.role === 'superadmin') return true;
    if (user.role === 'manager') return (user.industryIds || []).indexOf(team.industryId) >= 0;
    if (user.role === 'coordinator' || user.role === 'player')
      return (user.teamIds || []).indexOf(team.id) >= 0 || (team.members || []).indexOf(user.id) >= 0;
    return false;
  }
  function canProcess(user, industry) {
    if (!user) return false;
    if (user.role === 'superadmin') return true;
    return user.role === 'manager' && (user.industryIds || []).indexOf(industry.id) >= 0;
  }
  function canAdminIndustry(user, industry) {  // settings, deadlines, teams mgmt
    if (!user) return false;
    if (user.role === 'superadmin') return true;
    return user.role === 'manager' && (user.industryIds || []).indexOf(industry.id) >= 0;
  }

  /* ---------------- deadlines & locks ---------------- */
  function deadlineFor(industry, q) { return (industry.deadlines || {})[q] || null; }
  function isLocked(industry, q) {
    if ((industry.lockedQ || {})[q]) return true;
    var dl = deadlineFor(industry, q);
    return !!(dl && Date.now() > new Date(dl).getTime());
  }
  function lockReason(industry, q) {
    if ((industry.lockedQ || {})[q]) return 'Locked by administrator';
    var dl = deadlineFor(industry, q);
    if (dl && Date.now() > new Date(dl).getTime()) return 'Deadline passed';
    return null;
  }

  /* ---------------- round processing ---------------- */
  function processRound(user, industry) {
    if (!canProcess(user, industry)) return { ok: false, msg: 'You are not allowed to process rounds for this industry.' };
    var q = industry.currentQuarter;
    if (industry.phase === 'setup') return { ok: false, msg: 'Start the simulation first.' };
    if (industry.phase === 'finished') return { ok: false, msg: 'This simulation has finished.' };
    if (q > industry.quartersTotal) return { ok: false, msg: 'All quarters are already processed.' };
    var out = AS.engineProcess(state, industry, q);
    industry.currentQuarter = q + 1;
    if (industry.currentQuarter > industry.quartersTotal) {
      industry.phase = 'finished';
      industry.finishedAt = AS.todayISO();
    }
    /* seed next quarter decisions from the ones just processed */
    var teams = state.teams.filter(function (t) { return t.industryId === industry.id; });
    var nxt = industry.currentQuarter;
    if (nxt <= industry.quartersTotal) {
      teams.forEach(function (t) {
        if (!t.decisions[nxt]) t.decisions[nxt] = JSON.parse(JSON.stringify(t.decisions[q] || AS.defaultDecision(t, AS.scenario(industry.scenario))));
        t.decisions[nxt].submittedAt = null; t.decisions[nxt].submittedBy = null;
        t.submitted[nxt] = false;
      });
    }
    var skipped = teams.filter(function (t) { return !t.submitted[q]; }).map(function (t) { return t.name; });
    commit('round-process', 'Processed results for Q' + q + (out.missing.length ? ' — autopilot used for: ' + out.missing.join(', ') : '') +
      (skipped.length && !out.missing.length ? ' — not submitted by: ' + skipped.join(', ') : ''), { industryId: industry.id });
    return { ok: true, q: q, out: out, skipped: skipped };
  }

  /* ---------------- users ---------------- */
  function createUser(actor, data) {
    if (state.users.some(function (u) { return u.email.toLowerCase() === data.email.toLowerCase(); }))
      return { ok: false, msg: 'That email is already registered.' };
    var u = {
      id: AS.uid('U'), name: data.name, email: data.email.toLowerCase().trim(),
      pass: AS.hash(data.password), role: data.role,
      industryIds: data.industryIds || [], teamIds: data.teamIds || [],
      active: true, createdAt: AS.todayISO(), mustChange: !!data.mustChange
    };
    state.users.push(u);
    var effTeamIds = (data.role === 'coordinator' || data.role === 'player') ? (data.teamIds || []) : [];
    u.teamIds = effTeamIds;
    effTeamIds.forEach(function (tid) {
      var t = state.teams.filter(function (x) { return x.id === tid; })[0];
      if (t && (t.members || []).indexOf(u.id) < 0 && t.members.length < teamSizeMaxOf(t)) t.members.push(u.id);
    });
    if (data.role === 'manager') {
      (data.industryIds || []).forEach(function (iid) {
        var ind = state.industries.filter(function (x) { return x.id === iid; })[0];
        if (ind && ind.managerIds.indexOf(u.id) < 0) ind.managerIds.push(u.id);
      });
    }
    return { ok: true, user: u };
  }
  function teamSizeMaxOf(team) {
    var ind = state.industries.filter(function (i) { return i.id === team.industryId; })[0];
    return ind ? ind.teamSizeMax : 7;
  }
  function changePassword(user, oldP, newP) {
    if (user.pass !== AS.hash(oldP)) return { ok: false, msg: 'Current password is incorrect.' };
    if (String(newP).length < 6) return { ok: false, msg: 'New password must be at least 6 characters.' };
    user.pass = AS.hash(newP);
    user.mustChange = false;
    return { ok: true };
  }

  AS.store = {
    load: load, save: save, commit: commit, seedState: seedState, resetAll: resetAll,
    login: login, logout: logout, currentUser: currentUser,
    industriesFor: industriesFor, teamsFor: teamsFor, allTeams: allTeams,
    canEditTeam: canEditTeam, canProcess: canProcess, canAdminIndustry: canAdminIndustry,
    deadlineFor: deadlineFor, isLocked: isLocked, lockReason: lockReason,
    processRound: processRound, createUser: createUser, changePassword: changePassword,
    teamSizeMaxOf: teamSizeMaxOf,
    get state() { return state; }
  };
})();
