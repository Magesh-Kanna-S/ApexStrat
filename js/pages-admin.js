/* Apex Strategy — pages-admin.js: industries, users, round control, sheets, reports */
'use strict';
(function () {
  var UI;

  /* ================= INDUSTRIES (Super Admin) ================= */
  AS.PAGES.industries = function (el) {
    UI = AS.ui;
    var st = AS.store.state;
    var html = AS.pageHead('Industries', 'Every simulation instance runs its own market, teams and quarters',
      '<button class="btn btn-primary" id="newInd">' + AS.ic('plus') + ' New industry</button>');
    html += '<div class="grid g2">';
    st.industries.forEach(function (ind) {
      var teams = st.teams.filter(function (t) { return t.industryId === ind.id; });
      var lastQ = AS.lastPlayedQ(ind);
      var mgrs = (ind.managerIds || []).map(function (id) { var u = UI.userById(id); return u ? u.name : '—'; }).join(', ') || '—';
      html += '<div class="card">' +
        '<div class="card-title"><h3>' + AS.esc(ind.name) + '</h3><div class="spacer"></div>' +
        '<span class="chip ' + (ind.phase === 'running' ? 'chip-green' : ind.phase === 'finished' ? 'chip-blue' : 'chip-yellow') + '">' + ind.phase + '</span></div>' +
        '<div class="grid g2">' +
        AS.kpi('Scenario', AS.scenario(ind.scenario).label, AS.scenario(ind.scenario).blurb, {}) +
        AS.kpi('Progress', (ind.phase === 'setup' ? 'Not started' : ind.phase === 'finished' ? 'Complete' : 'Q' + Math.min(ind.currentQuarter, ind.quartersTotal) + ' of ' + ind.quartersTotal), lastQ ? lastQ + ' quarters played' : 'baseline ready', {}) +
        '</div>' +
        '<p class="small muted" style="margin:10px 0 4px">' + teams.length + ' companies · max ' + ind.teamSizeMax + ' players per team · ' + ind.practiceRounds + ' practice round(s) · Manager: ' + AS.esc(mgrs) + '</p>' +
        '<div class="btn-row">' +
        '<button class="btn btn-outline btn-sm" data-cfg="' + ind.id + '">' + AS.ic('settings') + ' Configure</button>' +
        (ind.phase === 'setup' ? '<button class="btn btn-green btn-sm" data-start="' + ind.id + '">' + AS.ic('play') + ' Start</button>' : '') +
        '<a class="btn btn-text btn-sm" href="#/rounds">Round Control</a>' +
        '<div class="spacer" style="flex:1"></div>' +
        '<button class="btn btn-text btn-sm" style="color:var(--c-red)" data-del="' + ind.id + '">Delete</button>' +
        '</div></div>';
    });
    html += '</div>';
    el.innerHTML = html;

    document.getElementById('newInd').addEventListener('click', function () { createModal(); });
    el.querySelectorAll('[data-cfg]').forEach(function (b) {
      b.addEventListener('click', function () { configModal(b.dataset.cfg); });
    });
    el.querySelectorAll('[data-start]').forEach(function (b) {
      b.addEventListener('click', function () { startIndustry(b.dataset.start); });
    });
    el.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var ind = st.industries.filter(function (x) { return x.id === b.dataset.del; })[0];
        var okc = await AS.confirmBox('Delete "' + AS.esc(ind.name) + '" with all its teams, decisions and results? This cannot be undone.', 'Delete');
        if (!okc) return;
        st.industries = st.industries.filter(function (x) { return x.id !== ind.id; });
        st.teams = st.teams.filter(function (t) { return t.industryId !== ind.id; });
        AS.store.commit('industry-delete', 'Deleted industry "' + ind.name + '"');
        AS.toast('Industry deleted', 'ok');
      });
    });

    function createModal() {
      var opts = Object.keys(AS.SCENARIOS).map(function (k) {
        return '<option value="' + k + '">' + AS.SCENARIOS[k].label + ' — ' + AS.esc(AS.SCENARIOS[k].blurb) + '</option>';
      }).join('');
      AS.modal({
        title: 'New industry', sub: 'Creates companies, computes the baseline quarter and opens Q1 decisions.',
        body:
          '<label class="fld"><span>Industry name</span><input id="niName" class="input" placeholder="e.g. MBA 2027 Batch — Smartphones"></label>' +
          '<label class="fld"><span>Scenario (market)</span><select id="niScen">' + opts + '</select></label>' +
          '<div class="frow">' +
          '<label class="fld fld-num"><span>Companies (2–7)</span><input id="niTeams" type="number" min="2" max="7" value="7"></label>' +
          '<label class="fld fld-num"><span>Quarters (2–12)</span><input id="niQ" type="number" min="2" max="12" value="8"></label>' +
          '<label class="fld fld-num"><span>Practice rounds (0–2)</span><input id="niP" type="number" min="0" max="2" value="2"></label>' +
          '<label class="fld fld-num"><span>Max players / team (1–7)</span><input id="niSize" type="number" min="1" max="7" value="7"></label>' +
          '</div>' +
          '<label class="fld"><span>Assign a Manager</span><select id="niMgr"><option value="">— none —</option>' +
          st.users.filter(function (u) { return u.role === 'manager'; }).map(function (u) { return '<option value="' + u.id + '">' + AS.esc(u.name) + '</option>'; }).join('') + '</select></label>',
        actions: '<button class="btn btn-outline" data-x="cancel">Cancel</button><button class="btn btn-primary" data-x="create">Create industry</button>',
        onmount: function (root, close) {
          root.querySelector('[data-x="cancel"]').addEventListener('click', close);
          root.querySelector('[data-x="create"]').addEventListener('click', function () {
            var name = root.querySelector('#niName').value.trim() || 'Untitled industry';
            var scen = root.querySelector('#niScen').value;
            var nTeams = AS.clamp(2, 7, +root.querySelector('#niTeams').value || 7);
            var nQ = AS.clamp(2, 12, +root.querySelector('#niQ').value || 8);
            var nP = AS.clamp(0, 2, +root.querySelector('#niP').value || 0);
            var size = AS.clamp(1, 7, +root.querySelector('#niSize').value || 7);
            var mgr = root.querySelector('#niMgr').value;
            var ind = {
              id: AS.uid('IND'), name: name, scenario: scen,
              quartersTotal: nQ, practiceRounds: nP, currentQuarter: 0,
              phase: 'setup', teamSizeMax: size, managerIds: mgr ? [mgr] : [],
              deadlines: {}, lockedQ: {}, results: {},
              createdAt: AS.todayISO(), startedAt: null, createdBy: UI.user().id
            };
            st.industries.push(ind);
            for (var i = 0; i < nTeams; i++) {
              var t = AS.makeTeam(ind.id, scen, i);
              st.teams.push(t);
            }
            var newTeams = st.teams.filter(function (x) { return x.industryId === ind.id; });
            newTeams.forEach(function (t) { t.decisions[0] = AS.defaultDecision(t, AS.scenario(scen), newTeams.length); });
            AS.engineProcess(st, ind, 0);   /* baseline */
            close();
            AS.store.commit('industry-create', 'Created "' + name + '" (' + nTeams + ' companies, ' + nQ + ' quarters, ' + nP + ' practice) — baseline computed', { industryId: ind.id });
            AS.toast('Industry created — baseline Q0 ready', 'ok');
          });
        }
      });
    }

    function configModal(id) {
      var ind = st.industries.filter(function (x) { return x.id === id; })[0];
      var teams = st.teams.filter(function (t) { return t.industryId === id; });
      var mgrs = st.users.filter(function (u) { return u.role === 'manager'; });
      var body =
        '<label class="fld"><span>Industry name</span><input id="ciName" class="input" value="' + AS.esc(ind.name) + '"></label>' +
        '<div class="frow">' +
        '<label class="fld fld-num"><span>Quarters (2–12)</span><input id="ciQ" type="number" min="2" max="12" value="' + ind.quartersTotal + '"></label>' +
        '<label class="fld fld-num"><span>Practice rounds (0–2)</span><input id="ciP" type="number" min="0" max="2" value="' + ind.practiceRounds + '"></label>' +
        '<label class="fld fld-num"><span>Max players / team</span><input id="ciSize" type="number" min="1" max="7" value="' + ind.teamSizeMax + '"></label>' +
        '</div>' +
        '<label class="fld"><span>Managers</span><div style="display:grid;gap:6px">' +
        mgrs.map(function (m) {
          return '<label class="swrow" style="border:1px solid var(--line);border-radius:10px;padding:6px 12px"><span class="t">' + AS.esc(m.name) + '</span>' +
            '<span class="switch"><input type="checkbox" data-mgr="' + m.id + '"' + (ind.managerIds.indexOf(m.id) >= 0 ? ' checked' : '') + '><i></i></span></label>';
        }).join('') + '</div></label>' +
        '<label class="fld"><span>Companies — rename or extend (max 7)</span><div id="ciTeams" style="display:grid;gap:8px">' +
        teams.map(function (t) {
          return '<div style="display:flex;gap:8px;align-items:center"><input class="input" data-team="' + t.id + '" value="' + AS.esc(t.name) + '" style="flex:1">' +
            '<span class="chip">' + (t.members || []).length + '/' + ind.teamSizeMax + ' players</span></div>';
        }).join('') +
        (teams.length < 7 && ind.phase === 'setup' ? '<button type="button" class="btn btn-outline btn-sm" id="ciAddTeam">' + AS.ic('plus') + ' Add company</button>' : '') +
        '</div></label>';
      AS.modal({
        title: 'Configure industry', sub: AS.esc(ind.name) + ' · ' + ind.phase, wide: true, body: body,
        actions: '<button class="btn btn-outline" data-x="cancel">Cancel</button><button class="btn btn-primary" data-x="save">Save changes</button>',
        onmount: function (root, close) {
          root.querySelector('[data-x="cancel"]').addEventListener('click', close);
          var addBtn = root.querySelector('#ciAddTeam');
          if (addBtn) addBtn.addEventListener('click', function () {
            var n = st.teams.filter(function (t) { return t.industryId === ind.id; }).length;
            if (n >= 7) return;
            var t = AS.makeTeam(ind.id, ind.scenario, n);
            st.teams.push(t);
            var allT = st.teams.filter(function (x) { return x.industryId === ind.id; });
            allT.forEach(function (x) { x.decisions[0] = AS.defaultDecision(x, AS.scenario(ind.scenario), allT.length); });
            AS.engineProcess(st, ind, 0);
            close(); configModal(id);
          });
          root.querySelector('[data-x="save"]').addEventListener('click', function () {
            ind.name = root.querySelector('#ciName').value.trim() || ind.name;
            ind.quartersTotal = AS.clamp(2, 12, +root.querySelector('#ciQ').value || ind.quartersTotal);
            ind.practiceRounds = AS.clamp(0, 2, +root.querySelector('#ciP').value || 0);
            ind.teamSizeMax = AS.clamp(1, 7, +root.querySelector('#ciSize').value || ind.teamSizeMax);
            if (ind.practiceRounds >= ind.quartersTotal) ind.practiceRounds = Math.max(0, ind.quartersTotal - 1);
            ind.managerIds = [];
            root.querySelectorAll('[data-mgr]').forEach(function (c) {
              if (c.checked) ind.managerIds.push(c.dataset.mgr);
              var mu = UI.userById(c.dataset.mgr);
              if (mu) { mu.industryIds = mu.industryIds || []; if (c.checked && mu.industryIds.indexOf(ind.id) < 0) mu.industryIds.push(ind.id); }
            });
            root.querySelectorAll('[data-team]').forEach(function (inp) {
              var t = UI.teamById(inp.dataset.team);
              if (t && inp.value.trim()) t.name = inp.value.trim();
            });
            close();
            AS.store.commit('industry-update', 'Updated settings for "' + ind.name + '" (quarters ' + ind.quartersTotal + ', practice ' + ind.practiceRounds + ', team size ' + ind.teamSizeMax + ')', { industryId: ind.id });
            AS.toast('Industry updated', 'ok');
          });
        }
      });
    }

    async function startIndustry(id) {
      var ind = st.industries.filter(function (x) { return x.id === id; })[0];
      var okc = await AS.confirmBox('Start "' + AS.esc(ind.name) + '"? Q1 decisions open for every company now.', 'Start simulation');
      if (!okc) return;
      ind.phase = 'running';
      ind.startedAt = AS.todayISO();
      ind.currentQuarter = 1;
      var teams = st.teams.filter(function (t) { return t.industryId === ind.id; });
      teams.forEach(function (t) {
        if (!t.decisions[1]) t.decisions[1] = JSON.parse(JSON.stringify(t.decisions[0] || AS.defaultDecision(t, AS.scenario(ind.scenario))));
        t.submitted = {};
      });
      AS.store.commit('industry-start', 'Started "' + ind.name + '" — Q1 decisions open', { industryId: ind.id });
      AS.toast('Simulation started', 'ok');
    }
  };

  /* ================= USERS (Super Admin + Manager) ================= */
  AS.PAGES.users = function (el) {
    UI = AS.ui;
    var st = AS.store.state, me = UI.user();
    var isSA = me.role === 'superadmin';
    var myInds = AS.store.industriesFor(me);
    var visible = st.users.filter(function (u) {
      if (isSA) return true;
      /* manager: non-admin users in own industries */
      if (u.role === 'superadmin') return false;
      var mine = (u.industryIds || []).some(function (iid) { return myInds.some(function (x) { return x.id === iid; }); });
      var mineT = (u.teamIds || []).some(function (tid) {
        var t = UI.teamById(tid); return t && myInds.some(function (x) { return x.id === t.industryId; });
      });
      return mine || mineT || u.id === me.id;
    });

    var html = AS.pageHead('Users', isSA ? 'Create and manage accounts for every role' : 'Coordinators and players in your industries',
      '<button class="btn btn-primary" id="newUser">' + AS.ic('plus') + ' New user</button>');
    html += '<div class="card"><div class="tblwrap"><table class="tbl"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Assignment</th><th>Status</th><th class="r">Actions</th></tr></thead><tbody>';
    visible.forEach(function (u) {
      var assign = u.role === 'superadmin' ? 'Everything' :
        u.role === 'manager' ? (u.industryIds || []).map(function (iid) { var i = st.industries.filter(function (x) { return x.id === iid; })[0]; return i ? i.name : '?'; }).join(', ') || '—' :
        (u.teamIds || []).map(function (tid) { var t = UI.teamById(tid); return t ? t.name : '?'; }).join(', ') || '—';
      var canEdit = isSA || (u.role !== 'superadmin' && u.id !== me.id);
      html += '<tr><td><b>' + AS.esc(u.name) + '</b></td><td>' + AS.esc(u.email) + '</td>' +
        '<td><span class="roletag role-' + u.role + '">' + AS.ROLE_LABEL[u.role] + '</span></td>' +
        '<td class="small">' + AS.esc(assign) + '</td>' +
        '<td>' + (u.active ? '<span class="chip chip-green">active</span>' : '<span class="chip chip-red">disabled</span>') + '</td>' +
        '<td class="r">' + (canEdit ? '<button class="btn btn-outline btn-sm" data-edit="' + u.id + '">Edit</button>' : '<span class="muted small">—</span>') + '</td></tr>';
    });
    html += '</tbody></table></div><p class="small muted mt">' +
      (isSA ? 'Super Admin — full control. Managers can process rounds, set deadlines and manage coordinators/players in their industries. Coordinators see only their allotted teams. Players see only their own team.' :
      'You can create Coordinators and Players inside your industries.') + '</p></div>';
    el.innerHTML = html;
    document.getElementById('newUser').addEventListener('click', function () { userModal(null); });
    el.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () { userModal(b.dataset.edit); });
    });

    function userModal(userId) {
      var u = userId ? st.users.filter(function (x) { return x.id === userId; })[0] : null;
      var roleOpts = isSA
        ? ['superadmin', 'manager', 'coordinator', 'player']
        : ['coordinator', 'player'];
      var inds = isSA ? st.industries : myInds;
      var indOpts = inds.map(function (i) { return '<option value="' + i.id + '">' + AS.esc(i.name) + '</option>'; }).join('');
      var body =
        '<label class="fld"><span>Full name</span><input id="vuName" class="input" value="' + (u ? AS.esc(u.name) : '') + '"></label>' +
        '<label class="fld"><span>Email</span><input id="vuEmail" class="input" type="email" value="' + (u ? AS.esc(u.email) : '') + '"' + (u ? ' disabled' : '') + '></label>' +
        '<label class="fld"><span>' + (u ? 'Reset password (leave blank to keep)' : 'Password') + '</span><input id="vuPass" class="input" type="text" placeholder="min 6 characters"></label>' +
        '<label class="fld"><span>Role</span><select id="vuRole"' + (u && u.id === me.id ? ' disabled' : '') + '>' +
        roleOpts.map(function (r) { return '<option value="' + r + '"' + (u && u.role === r ? ' selected' : '') + '>' + AS.ROLE_LABEL[r] + ' — ' + AS.ROLE_DESC[r] + '</option>'; }).join('') +
        '</select></label>' +
        '<label class="fld"><span>Industries (for managers)</span><div style="display:grid;gap:6px">' +
        inds.map(function (i) {
          return '<label class="swrow" style="border:1px solid var(--line);border-radius:10px;padding:6px 12px"><span class="t">' + AS.esc(i.name) + '</span>' +
            '<span class="switch"><input type="checkbox" data-vind="' + i.id + '"' + (u && (u.industryIds || []).indexOf(i.id) >= 0 ? ' checked' : '') + '><i></i></span></label>';
        }).join('') + '</div></label>' +
        '<label class="fld"><span>Teams (coordinators & players — pick an industry first)</span>' +
        '<div id="vuTeams" style="display:grid;gap:6px">' + teamBoxes(u, inds) + '</div></label>' +
        (u ? '<div class="swrow"><span class="t">Account active <small>disabled users cannot sign in</small></span><span class="switch"><input type="checkbox" id="vuActive"' + (u.active ? ' checked' : '') + '><i></i></span></div>' : '');
      AS.modal({
        title: u ? 'Edit user' : 'New user', sub: u ? AS.esc(u.email) : 'Passwords are stored locally / in your sheet. Share them securely.', wide: true, body: body,
        actions: '<button class="btn btn-outline" data-x="cancel">Cancel</button><button class="btn btn-primary" data-x="save">' + (u ? 'Save changes' : 'Create user') + '</button>',
        onmount: function (root, close) {
          root.querySelectorAll('[data-vind]').forEach(function (c) {
            c.addEventListener('change', function () { /* just informational */ });
          });
          root.querySelector('[data-x="cancel"]').addEventListener('click', close);
          root.querySelector('[data-x="save"]').addEventListener('click', function () {
            var name = root.querySelector('#vuName').value.trim();
            var email = u ? u.email : root.querySelector('#vuEmail').value.trim().toLowerCase();
            var pass = root.querySelector('#vuPass').value;
            var role = root.querySelector('#vuRole').value;
            if (!name || !email) { AS.toast('Name and email are required', 'err'); return; }
            if (!u && pass.length < 6) { AS.toast('Password must be at least 6 characters', 'err'); return; }
            if (u && pass && pass.length < 6) { AS.toast('Password must be at least 6 characters', 'err'); return; }
            var industryIds = [];
            root.querySelectorAll('[data-vind]').forEach(function (c) { if (c.checked) industryIds.push(c.dataset.vind); });
            var teamIds = [];
            root.querySelectorAll('[data-vteam]').forEach(function (c) { if (c.checked) teamIds.push(c.dataset.vteam); });
            if (u) {
              u.name = name;
              if (pass) u.pass = AS.hash(pass);
              if (u.id !== me.id) {
                u.role = role;
                u.industryIds = role === 'superadmin' ? [] : role === 'manager' ? industryIds : industryIds.slice(0, 1);
                u.teamIds = (role === 'coordinator' || role === 'player') ? teamIds : [];
              }
              u.active = root.querySelector('#vuActive') ? root.querySelector('#vuActive').checked : true;
              /* sync team membership */
              st.teams.forEach(function (t) { t.members = (t.members || []).filter(function (mid) { return mid !== u.id; }); });
              u.teamIds.forEach(function (tid) {
                var t = UI.teamById(tid);
                if (t && t.members.length < AS.store.teamSizeMaxOf(t)) t.members.push(u.id);
              });
              close();
              AS.store.commit('user-update', 'Updated user ' + u.email + ' (' + AS.ROLE_LABEL[u.role] + ')');
              AS.toast('User updated', 'ok');
            } else {
              var res = AS.store.createUser(me, {
                name: name, email: email, password: pass, role: role,
                industryIds: role === 'manager' ? industryIds : industryIds.slice(0, 1),
                teamIds: teamIds
              });
              if (!res.ok) { AS.toast(res.msg, 'err'); return; }
              close();
              AS.store.commit('user-create', 'Created ' + AS.ROLE_LABEL[role] + ' account for ' + email);
              AS.toast('User created', 'ok');
            }
          });
        }
      });
    }
    function teamBoxes(u, inds) {
      return inds.map(function (i) {
        var teams = st.teams.filter(function (t) { return t.industryId === i.id; });
        return '<div><div class="small muted" style="margin:4px 0">' + AS.esc(i.name) + '</div>' + teams.map(function (t) {
          var checked = u && (u.teamIds || []).indexOf(t.id) >= 0;
          return '<label class="swrow" style="padding:2px 0"><span class="t small">' + AS.teamChip(t) + ' <span class="muted">(' + (t.members || []).length + '/' + AS.store.teamSizeMaxOf(t) + ')</span></span>' +
            '<span class="switch"><input type="checkbox" data-vteam="' + t.id + '"' + (checked ? ' checked' : '') + '><i></i></span></label>';
        }).join('') + '</div>';
      }).join('');
    }
  };

  /* ================= ROUND CONTROL (Super Admin + Manager) ================= */
  AS.PAGES.rounds = function (el) {
    UI = AS.ui;
    var ind = UI.industry();
    if (!ind) return;
    var st = AS.store.state, me = UI.user();
    var teams = st.teams.filter(function (t) { return t.industryId === ind.id; });

    var html = AS.pageHead('Round Control', ind.name + ' · advance the simulation, set deadlines, lock decisions');
    if (ind.phase === 'setup') {
      html += '<div class="callout yellow">' + AS.ic('info') + '<div><b>Setup phase.</b> Start the simulation from the Industries page (Super Admin) to open Q1 decisions.</div></div>';
    }
    var q = ind.currentQuarter;
    /* current quarter card */
    html += '<div class="card"><div class="card-title"><h3>Current quarter</h3><div class="spacer"></div>' +
      (ind.phase === 'running' && q <= ind.quartersTotal ? '<span class="chip chip-blue">Q' + q + ' of ' + ind.quartersTotal + (q <= ind.practiceRounds ? ' · practice' : '') + '</span>' : '<span class="chip">' + ind.phase + '</span>') + '</div>';
    if (ind.phase === 'running' && q <= ind.quartersTotal) {
      var dl = AS.store.deadlineFor(ind, q);
      var dlVal = dl ? dl.slice(0, 16) : '';
      html += '<div class="grid g3">' +
        '<div><label class="fld"><span>Deadline for Q' + q + ' decisions</span><input type="datetime-local" id="rcDeadline" value="' + dlVal + '"></label>' +
        '<div class="btn-row"><button class="btn btn-primary btn-sm" id="rcSaveDl">Set deadline</button>' +
        (dl ? '<button class="btn btn-outline btn-sm" id="rcClearDl">Clear</button>' : '') +
        ((AS.store.lockReason(ind, q)) ? '<button class="btn btn-green btn-sm" id="rcUnlock">Unlock edits</button>' : '<button class="btn btn-outline btn-sm" id="rcLock">Lock now</button>') +
        '</div></div>' +
        '<div>' + AS.kpi('Submitted', teams.filter(function (t) { return t.submitted[q]; }).length + ' / ' + teams.length, 'teams have submitted Q' + q, { pct: teams.filter(function (t) { return t.submitted[q]; }).length / teams.length * 100 }) + '</div>' +
        '<div>' + AS.kpi('Deadline', dl ? (AS.timeLeft(dl) && !AS.timeLeft(dl).over ? AS.timeLeft(dl).text : 'passed') : 'not set', dl ? AS.fmtDate(dl) : 'teams can edit freely', { cls: dl && AS.timeLeft(dl).over ? 'bad' : '' }) + '</div>' +
        '</div>';
      html += '<div class="callout blue">' + AS.ic('info') + '<div><b>Processing Q' + q + '</b> computes results for every company using their submitted (or last saved) decisions, publishes scores and news, and opens Q' + (q + 1) + '. Teams without any saved decisions run on autopilot defaults. This cannot be undone.</div></div>';
      html += '<div class="btn-row"><button class="btn btn-green" id="rcProcess">' + AS.ic('play') + ' Process Q' + q + ' results now</button></div>';
    } else if (ind.phase === 'finished') {
      var lb = AS.leaderboard(st, ind);
      html += '<div class="callout green">' + AS.ic('trophy') + '<div><b>Finished.</b> Winner: ' + AS.teamChip(lb[0].team) + ' with a cumulative score of ' + lb[0].cum.toFixed(1) + '.</div></div>';
    }
    html += '</div>';

    /* submission status */
    if (ind.phase === 'running' && q <= ind.quartersTotal) {
      html += '<div class="card"><div class="card-title"><h3>Team status — Q' + q + '</h3></div><div class="tblwrap"><table class="tbl"><thead><tr><th>Company</th><th>Submitted</th><th>Last saved</th><th class="r">Players</th></tr></thead><tbody>';
      teams.forEach(function (t) {
        var d = t.decisions[q];
        html += '<tr><td>' + AS.teamChip(t) + '</td>' +
          '<td>' + (t.submitted[q] ? '<span class="chip chip-green">submitted</span>' : '<span class="chip chip-yellow">pending</span>') + '</td>' +
          '<td class="small muted">' + (d && d.updatedAt ? AS.fmtDateShort(d.updatedAt) + ' · ' + AS.esc(d.updatedBy || '') : 'no edits') + '</td>' +
          '<td class="r">' + (t.members || []).length + '</td></tr>';
      });
      html += '</tbody></table></div></div>';
    }

    /* history */
    var lastQ = AS.lastPlayedQ(ind);
    if (lastQ) {
      html += '<div class="card"><div class="card-title"><h3>Processed rounds</h3></div><div class="tblwrap"><table class="tbl"><thead><tr><th>Quarter</th><th>Economy</th><th>Leader after round</th><th class="r">Units sold</th></tr></thead><tbody>';
      for (var i = 1; i <= lastQ; i++) {
        var ir = ind.results[i];
        var lbq = ir ? ir.ranking.map(function (tid) { return UI.teamById(tid); }).filter(Boolean) : [];
        html += '<tr><td>Q' + i + (i <= ind.practiceRounds ? ' <span class="chip">practice</span>' : '') + '</td>' +
          '<td>' + (ir ? ir.ecoLabel : '—') + '</td>' +
          '<td>' + (lbq[0] ? AS.teamChip(lbq[0]) : '—') + '</td>' +
          '<td class="r">' + (ir ? AS.num(teams.reduce(function (s, t) { return s + (t.results[i] ? t.results[i].soldUnits : 0); }, 0)) : '—') + '</td></tr>';
      }
      html += '</tbody></table></div></div>';
    }
    el.innerHTML = html;

    var saveDl = document.getElementById('rcSaveDl');
    if (saveDl) saveDl.addEventListener('click', function () {
      var v = document.getElementById('rcDeadline').value;
      if (!v) { AS.toast('Pick a date and time first', 'err'); return; }
      ind.deadlines[q] = new Date(v).toISOString();
      AS.store.commit('deadline-set', 'Set Q' + q + ' deadline to ' + AS.fmtDate(ind.deadlines[q]), { industryId: ind.id });
      AS.toast('Deadline set', 'ok');
    });
    var clearDl = document.getElementById('rcClearDl');
    if (clearDl) clearDl.addEventListener('click', function () {
      delete ind.deadlines[q];
      AS.store.commit('deadline-set', 'Cleared Q' + q + ' deadline', { industryId: ind.id });
      AS.toast('Deadline cleared', 'ok');
    });
    var lockBtn = document.getElementById('rcLock');
    if (lockBtn) lockBtn.addEventListener('click', function () {
      ind.lockedQ[q] = true;
      AS.store.commit('lock-set', 'Locked Q' + q + ' decision editing', { industryId: ind.id });
      AS.toast('Q' + q + ' locked — teams cannot edit', 'ok');
    });
    var unlockBtn = document.getElementById('rcUnlock');
    if (unlockBtn) unlockBtn.addEventListener('click', function () {
      delete ind.lockedQ[q];
      ind.deadlines[q] = new Date(Date.now() + 2 * 864e5).toISOString();
      AS.store.commit('lock-set', 'Unlocked Q' + q + ' (deadline extended by 48h)', { industryId: ind.id });
      AS.toast('Unlocked — deadline extended 48h', 'ok');
    });
    var proc = document.getElementById('rcProcess');
    if (proc) proc.addEventListener('click', async function () {
      var pend = teams.filter(function (t) { return !t.submitted[q]; }).map(function (t) { return t.name; });
      var msg = 'Process results for Q' + q + ' of ' + ind.quartersTotal + '?' +
        (pend.length ? '<br><br>Not submitted: <b>' + AS.esc(pend.join(', ')) + '</b> — their last saved decisions (or autopilot) will be used.' : '') +
        '<br><br>This publishes scores and moves the industry to Q' + (q + 1) + '.';
      var okc = await AS.confirmBox(msg, 'Process round');
      if (!okc) return;
      var res = AS.store.processRound(me, ind);
      if (!res.ok) { AS.toast(res.msg, 'err'); return; }
      AS.toast('Q' + q + ' processed — results published', 'ok');
    });
  };

  /* ================= SHEETS DATABASE (Super Admin) ================= */
  AS.PAGES.database = function (el) {
    UI = AS.ui;
    var cfg = AS.store.state.settings.sheets;
    var stat = AS.sheets.status();
    var html = AS.pageHead('Sheets Database', 'Link a Google Sheet as the shared database (optional)');
    html += '<div class="grid g32">';
    html += '<div class="card"><div class="card-title"><h3>Connection</h3><div class="spacer"></div>' +
      '<span class="chip ' + (stat.mode === 'live' ? (stat.state === 'err' ? 'chip-red' : 'chip-green') : '') + '">' + (stat.mode === 'live' ? 'LIVE' : 'DEMO MODE') + '</span></div>' +
      '<p class="card-sub">In demo mode everything is stored in this browser. Connect a Google Sheet so every browser and device shares the same simulation.</p>' +
      '<label class="fld"><span>Apps Script Web App URL</span><input id="dbUrl" class="input" placeholder="https://script.google.com/macros/s/…/exec" value="' + AS.esc(cfg.url || '') + '"></label>' +
      '<div class="btn-row">' +
      '<button class="btn btn-primary" id="dbConnect">' + AS.ic('database') + ' ' + (cfg.connected ? 'Reconnect' : 'Connect') + '</button>' +
      (cfg.connected ? '<button class="btn btn-outline" id="dbDisconnect">Disconnect</button>' : '') +
      (cfg.connected ? '<button class="btn btn-tonal" id="dbSyncNow">' + AS.ic('refresh') + ' Sync now</button>' : '') +
      '</div>' +
      '<div class="swrow mt"><span class="t">Auto-sync on every change <small>recommended — keeps the sheet current</small></span>' +
      '<span class="switch"><input type="checkbox" id="dbAuto"' + (cfg.autoSync ? ' checked' : '') + '><i></i></span></div>' +
      (stat.lastError ? '<div class="form-err">' + AS.esc(stat.lastError) + '</div>' : '') +
      (stat.lastSync ? '<p class="small muted">Last sync: ' + AS.fmtDate(stat.lastSync) + '</p>' : '') +
      '</div>';
    html += '<div class="card"><div class="card-title"><h3>Setup — 5 steps</h3></div><ol style="padding-left:20px;line-height:2;font-size:13.5px">' +
      '<li>Create a new <b>Google Sheet</b> (e.g. "Apex Strategy DB").</li>' +
      '<li>Menu: <b>Extensions → Apps Script</b>. Delete the sample code.</li>' +
      '<li>Paste the script (button below) and save.</li>' +
      '<li><b>Deploy → New deployment → Web app</b>. Execute as <b>Me</b>, access <b>Anyone</b>. Authorise, copy the <b>/exec</b> URL.</li>' +
      '<li>Paste the URL on the left and click <b>Connect</b>.</li></ol>' +
      '<div class="btn-row">' +
      '<button class="btn btn-outline" id="dbCopyGs">' + AS.ic('download') + ' Copy Apps Script code</button>' +
      '<button class="btn btn-outline" id="dbDlGs">Download .gs file</button>' +
      '</div>' +
      '<p class="small muted mt">The sheet stores the whole state as chunked JSON — do not edit the STATE tab manually. A "rev" counter prevents conflicting overwrites.</p></div>';
    html += '</div>';
    /* danger zone */
    html += '<div class="card"><div class="card-title"><h3 style="color:var(--c-red)">Danger zone</h3></div>' +
      '<p class="card-sub">Reset the local copy to the shipped demo data. If a sheet is connected, the next sync overwrites it — disconnect first to keep the cloud copy.</p>' +
      '<button class="btn btn-danger" id="dbReset">' + AS.ic('warn') + ' Reset demo data</button></div>';
    el.innerHTML = html;

    document.getElementById('dbConnect').addEventListener('click', async function () {
      var url = document.getElementById('dbUrl').value.trim();
      if (!url || url.indexOf('script.google.com') < 0) { AS.toast('Paste the Apps Script /exec URL', 'err'); return; }
      this.disabled = true; this.textContent = 'Connecting…';
      try {
        await AS.sheets.connect(url);
        AS.store.commit('sync-connect', 'Connected Google Sheets database');
        AS.toast('Connected — database is live', 'ok');
      } catch (e) {
        AS.toast('Could not connect: ' + (e.message || e), 'err');
      } finally {
        this.disabled = false; this.innerHTML = AS.ic('database') + ' Reconnect';
      }
    });
    var dc = document.getElementById('dbDisconnect');
    if (dc) dc.addEventListener('click', function () {
      AS.sheets.disconnect();
      AS.store.commit('sync-disconnect', 'Disconnected Google Sheets database — back to demo mode');
      AS.toast('Disconnected — demo mode', 'ok');
    });
    var sn = document.getElementById('dbSyncNow');
    if (sn) sn.addEventListener('click', async function () {
      this.disabled = true;
      try { var r = await AS.sheets.push(); AS.toast(r.ok ? 'Synced' : 'Sync failed: ' + (r.error || 'conflict resolved'), r.ok ? 'ok' : 'err'); }
      catch (e) { AS.toast('Sync failed: ' + (e.message || e), 'err'); }
      this.disabled = false;
    });
    document.getElementById('dbAuto').addEventListener('change', function () {
      cfg.autoSync = this.checked;
      AS.store.commit('settings-change', 'Auto-sync ' + (this.checked ? 'enabled' : 'disabled'), { rerender: false });
    });
    document.getElementById('dbCopyGs').addEventListener('click', function () {
      navigator.clipboard.writeText(AS.APPS_SCRIPT).then(function () { AS.toast('Script copied to clipboard', 'ok'); });
    });
    document.getElementById('dbDlGs').addEventListener('click', function () {
      AS.download('google-apps-script.gs', AS.APPS_SCRIPT, 'text/javascript');
      AS.toast('Downloaded google-apps-script.gs', 'ok');
    });
    document.getElementById('dbReset').addEventListener('click', async function () {
      var okc = await AS.confirmBox('Reset ALL local data to the shipped demo? Any local edits (users, decisions, results) are lost.', 'Reset');
      if (!okc) return;
      AS.store.resetAll();
      location.hash = '#/dashboard';
      AS.ui.render();
      AS.toast('Demo data restored', 'ok');
    });
  };

  /* ================= REPORTS & LOGS ================= */
  AS.PAGES.reports = function (el, params) {
    UI = AS.ui;
    var ind = UI.industry();
    if (!ind) return;
    var me = UI.user();
    var isAdmin = me.role === 'superadmin' || me.role === 'manager';
    var myTeams = isAdmin ? UI.allTeamsInIndustry() : AS.store.teamsFor(me, ind);
    var lastQ = AS.lastPlayedQ(ind);
    var tab = params && params[0] === 'log' ? 'log' : 'reports';

    var html = AS.pageHead('Reports & Logs', 'Download quarter reports and activity logs' + (isAdmin ? '' : ' for your teams'));
    html += '<div class="tabs" id="repTabs">' +
      '<button class="tab' + (tab === 'reports' ? ' on' : '') + '" data-t="reports">Quarter reports</button>' +
      '<button class="tab' + (tab === 'log' ? ' on' : '') + '" data-t="log">Activity log</button></div>';
    html += '<div id="repBody"></div>';
    el.innerHTML = html;
    document.getElementById('repTabs').addEventListener('click', function (e) {
      var b = e.target.closest('.tab'); if (!b) return;
      tab = b.dataset.t; drawTab();
    });
    drawTab();

    function drawTab() {
      document.querySelectorAll('#repTabs .tab').forEach(function (b) { b.classList.toggle('on', b.dataset.t === tab); });
      var body = document.getElementById('repBody');
      if (tab === 'reports') body.innerHTML = reportsHTML();
      else body.innerHTML = logHTML();
      bindTab();
    }

    function reportsHTML() {
      if (lastQ == null) return '<div class="card"><div class="empty">' + AS.ic('report') + '<h3>No rounds processed yet</h3><p class="muted">Quarter reports appear once the first round is processed.</p></div></div>';
      var h = '<div class="card"><div class="card-title"><h3>Build a report</h3></div>' +
        '<div class="frow">' +
        '<label class="fld"><span>Company</span><select id="repTeam">' +
        myTeams.map(function (t) { return '<option value="' + t.id + '">' + AS.esc(t.name) + '</option>'; }).join('') + '</select></label>' +
        '<label class="fld"><span>Quarter</span><select id="repQ">' +
        (function () { var s = ''; for (var i = 0; i <= lastQ; i++) s += '<option value="' + i + '">' + (i === 0 ? 'Q0 · last year (baseline)' : 'Q' + i + (i <= ind.practiceRounds ? ' (practice)' : '')) + '</option>'; return s; })() +
        '</select></label>' +
        '</div><div class="btn-row">' +
        '<button class="btn btn-primary" id="repCsv">' + AS.ic('download') + ' Download CSV</button>' +
        '<button class="btn btn-tonal" id="repPdf">' + AS.ic('print') + ' Print / Save as PDF</button>' +
        (isAdmin ? '<button class="btn btn-outline" id="repAll">All companies — summary CSV</button>' : '') +
        '</div></div><div class="card"><div class="card-title"><h3>Preview</h3></div><div id="repPreview"></div></div>';
      return h;
    }

    function reportData(tid, q) {
      var t = UI.teamById(tid);
      var r = t.results[q];
      var dec = t.decisions[q];
      var rows = [
        ['Section', 'Metric', 'Value'],
        ['Company', 'Name', t.name],
        ['Company', 'Quarter', q === 0 ? 'Q0 (last year baseline)' : 'Q' + q + (r.practice ? ' (practice)' : '')],
        ['Company', 'Rank (cumulative)', r.rank],
        ['Score', 'Quarter score', r.score.avg.toFixed(1) + ' / 100'],
        ['Score', 'Cumulative score', r.cumulative.toFixed(1)]
      ];
      AS.SCORE_META.forEach(function (m) { rows.push(['Score', m.name, r.score[m.k].toFixed(0)]); });
      rows.push(
        ['Results', 'Revenue', AS.cr(r.revenue)], ['Results', 'Net profit', AS.cr(r.net)],
        ['Results', 'Net margin', AS.pct(r.netMargin, 1)], ['Results', 'Units sold', r.soldUnits],
        ['Results', 'Unit share', AS.pct(r.unitShare, 1)], ['Results', 'Demand', r.demandUnits],
        ['Results', 'Lost to stock-outs', r.lostUnits], ['Results', 'Ending inventory', r.inventoryUnits],
        ['Results', 'Plant utilisation', AS.pct(r.utilization, 1)], ['Results', 'Service level', AS.pct(r.serviceLevel, 0)],
        ['Results', 'Productivity index', r.productivity.toFixed(3)], ['Results', 'Share price', AS.rs(r.stockPrice)],
        ['Results', 'EPS (annualised)', AS.rs(r.eps)], ['Results', 'P/E', r.pe.toFixed(1)],
        ['Results', 'Cash', AS.cr(r.cash)], ['Results', 'Debt (ST/LT)', AS.cr(r.stDebt) + ' / ' + AS.cr(r.ltDebt)],
        ['Results', 'Emergency loan', AS.cr(r.emergency)]
      );
      if (r.emergency > 0) rows.push(['Alert', 'Emergency loan drawn', AS.cr(r.emergency) + ' at ' + AS.pct(AS.DEFAULTS.emergencyRate * 4, 1) + ' APR']);
      t.products.forEach(function (p) {
        var pr = r.products[p.id];
        if (!pr) return;
        rows.push(['Product: ' + pr.name, 'Price', AS.rs(pr.price)],
          ['Product: ' + pr.name, 'Demand / sold', Math.round(pr.demand) + ' / ' + Math.round(pr.sold)],
          ['Product: ' + pr.name, 'Stock-outs', Math.round(pr.lost)],
          ['Product: ' + pr.name, 'Ending stock', Math.round(pr.invEnd)],
          ['Product: ' + pr.name, 'Revenue', AS.cr(pr.revenue)]);
      });
      if (dec) {
        t.products.forEach(function (p) {
          var pd = dec.products[p.id]; if (!pd) return;
          rows.push(['Decision: ' + pd.name, 'Price / promo / schedule', AS.rs(pd.price) + ' / ' + AS.cr(pd.promo) + ' / ' + pd.production],
            ['Decision: ' + pd.name, 'Spec targets', pd.specsTarget.join('/')],
            ['Decision: ' + pd.name, 'Channels on/mr/gt', pd.channel.on + '/' + pd.channel.mr + '/' + pd.channel.gt]);
        });
        rows.push(['Decision', 'Workforce / salesforce', d0(dec.workforce) + ' / ' + d0(dec.salesforce)],
          ['Decision', 'Training / innovation', AS.cr(dec.training) + ' / ' + AS.cr(dec.innovation)],
          ['Decision', 'Projects (esg/quality/digital/campaign)', dec.projects.esg + '/' + dec.projects.quality + '/' + dec.projects.digital + '/' + dec.projects.brandcamp],
          ['Decision', 'Submitted', dec.submittedAt ? AS.fmtDate(dec.submittedAt) + ' by ' + dec.submittedBy : 'not submitted']);
      }
      (r.notes || []).forEach(function (n, i) { rows.push(['Coach note ' + (i + 1), '', n]); });
      function d0(x) { return x == null ? '—' : x; }
      return { team: t, r: r, rows: rows };
    }

    function bindTab() {
      if (tab !== 'reports') { bindLog(); return; }
      var preview = function () {
        var tid = document.getElementById('repTeam').value;
        var q = +document.getElementById('repQ').value;
        document.getElementById('repPreview').innerHTML = reportHTML(tid, q);
      };
      document.getElementById('repTeam').addEventListener('change', preview);
      document.getElementById('repQ').addEventListener('change', preview);
      preview();
      document.getElementById('repCsv').addEventListener('click', function () {
        var tid = document.getElementById('repTeam').value, q = +document.getElementById('repQ').value;
        var rd = reportData(tid, q);
        AS.download(AS.csvName('apex-' + rd.team.name.replace(/\s+/g, '-') + '-Q' + q), AS.toCSV(rd.rows));
        AS.store.commit('report-download', 'Downloaded Q' + q + ' report CSV for ' + rd.team.name, { industryId: ind.id, teamId: tid, rerender: false });
        AS.toast('CSV downloaded', 'ok');
      });
      document.getElementById('repPdf').addEventListener('click', function () {
        var tid = document.getElementById('repTeam').value, q = +document.getElementById('repQ').value;
        AS.printHTML('Apex Strategy — ' + UI.teamById(tid).name + ' Q' + q, reportHTML(tid, q, true));
        AS.store.commit('report-download', 'Printed Q' + q + ' report for ' + UI.teamById(tid).name, { industryId: ind.id, teamId: tid, rerender: false });
      });
      var all = document.getElementById('repAll');
      if (all) all.addEventListener('click', function () {
        var q = +document.getElementById('repQ').value;
        var rows = [['Company', 'Rank', 'Q Score', 'Cumulative', 'Revenue', 'Net profit', 'Margin', 'Unit share', 'Share price', 'Cash', 'Service']];
        UI.allTeamsInIndustry().forEach(function (t) {
          var r = t.results[q]; if (!r) return;
          rows.push([t.name, r.rank, r.score.avg.toFixed(1), r.cumulative.toFixed(1),
            AS.NF2.format(r.revenue / AS.CR), AS.NF2.format(r.net / AS.CR), AS.pct(r.netMargin, 1),
            AS.pct(r.unitShare, 1), AS.NF0.format(r.stockPrice), AS.NF2.format(r.cash / AS.CR), AS.pct(r.serviceLevel, 0)]);
        });
        AS.download(AS.csvName('apex-all-companies-Q' + q), AS.toCSV(rows));
        AS.toast('Summary CSV downloaded', 'ok');
      });
    }

    function reportHTML(tid, q, forPrint) {
      var t = UI.teamById(tid), r = t.results[q];
      var h = '<div class="rhead"><div><h1>' + AS.esc(t.name) + ' — Quarter ' + q + ' report</h1>' +
        '<div class="small">Apex Strategy · ' + AS.esc(ind.name) + ' · ' + AS.scenario(ind.scenario).label + ' market</div></div>' +
        '<div class="small">' + (forPrint ? 'Generated ' + AS.fmtDate(AS.todayISO()) : '') + '</div></div>';
      h += '<h2>Scorecard</h2><table><tr><th>Perspective</th><th>Measure</th><th class="r">Score</th></tr>';
      AS.SCORE_META.forEach(function (m) {
        h += '<tr><td>' + m.persp + '</td><td>' + m.name + '</td><td class="r">' + r.score[m.k].toFixed(0) + ' / 100</td></tr>';
      });
      h += '<tr><td colspan="2"><b>Quarter score / cumulative</b></td><td class="r"><b>' + r.score.avg.toFixed(1) + ' / ' + r.cumulative.toFixed(1) + '</b></td></tr></table>';
      h += '<h2>Headline results</h2><table><tr><th>Metric</th><th class="r">Value</th><th>Metric</th><th class="r">Value</th></tr>' +
        '<tr><td>Revenue</td><td class="r">' + AS.cr(r.revenue) + '</td><td>Net profit</td><td class="r">' + AS.cr(r.net) + '</td></tr>' +
        '<tr><td>Net margin</td><td class="r">' + AS.pct(r.netMargin, 1) + '</td><td>Unit share</td><td class="r">' + AS.pct(r.unitShare, 1) + '</td></tr>' +
        '<tr><td>Units sold</td><td class="r">' + AS.num(r.soldUnits) + '</td><td>Stock-outs</td><td class="r">' + AS.num(r.lostUnits) + '</td></tr>' +
        '<tr><td>Share price</td><td class="r">' + AS.rs(r.stockPrice) + '</td><td>Cash</td><td class="r">' + AS.cr(r.cash) + '</td></tr>' +
        '<tr><td>Plant utilisation</td><td class="r">' + AS.pct(r.utilization, 1) + '</td><td>Service level</td><td class="r">' + AS.pct(r.serviceLevel, 0) + '</td></tr></table>';
      h += '<h2>Products</h2><table><tr><th>Product</th><th class="r">Price</th><th class="r">Demand</th><th class="r">Sold</th><th class="r">Stock-out</th><th class="r">End stock</th><th class="r">Revenue</th></tr>';
      t.products.forEach(function (p) {
        var pr = r.products[p.id]; if (!pr) return;
        h += '<tr><td>' + AS.esc(pr.name) + '</td><td class="r">' + AS.rs(pr.price) + '</td><td class="r">' + AS.num(pr.demand) + '</td><td class="r">' + AS.num(pr.sold) +
          '</td><td class="r">' + AS.num(pr.lost) + '</td><td class="r">' + AS.num(pr.invEnd) + '</td><td class="r">' + AS.cr(pr.revenue) + '</td></tr>';
      });
      h += '</table>';
      if ((r.notes || []).length) {
        h += '<h2>Coach notes</h2><ul>' + r.notes.map(function (n) { return '<li>' + AS.esc(n) + '</li>'; }).join('') + '</ul>';
      }
      return h;
    }

    /* ---------- activity log ---------- */
    function visibleLogs() {
      var teamScope = {};
      myTeams.forEach(function (t) { teamScope[t.id] = 1; });
      var indScope = {}; indScope[ind.id] = 1;
      return AS.store.state.logs.filter(function (l) {
        if (isAdmin) return l.industryId === ind.id || !l.industryId;
        return l.teamId && teamScope[l.teamId] && (l.industryId ? indScope[l.industryId] : true);
      });
    }
    function logHTML() {
      var logs = visibleLogs();
      var h = '<div class="card"><div class="card-title"><h3>Activity log</h3><div class="spacer"></div>' +
        '<button class="btn btn-outline btn-sm" id="logCsv">' + AS.ic('download') + ' Download CSV (' + logs.length + ' entries)</button></div>' +
        '<div class="frow">' +
        '<label class="fld"><span>Team</span><select id="logTeam"><option value="">All teams</option>' +
        myTeams.map(function (t) { return '<option value="' + t.id + '">' + AS.esc(t.name) + '</option>'; }).join('') + '</select></label>' +
        '<label class="fld"><span>Action</span><select id="logAction"><option value="">All actions</option>' +
        ['signin', 'signout', 'decision-edit', 'decision-submit', 'decision-unsubmit', 'round-process', 'deadline-set', 'lock-set', 'industry-create', 'industry-update', 'industry-start', 'user-create', 'user-update', 'password-change', 'report-download']
          .map(function (a) { return '<option>' + a + '</option>'; }).join('') + '</select></label>' +
        '</div><div id="logList"></div></div>';
      return h;
    }
    function bindLog() {
      var draw = function () {
        var tid = document.getElementById('logTeam').value;
        var act = document.getElementById('logAction').value;
        var logs = visibleLogs().filter(function (l) {
          return (!tid || l.teamId === tid) && (!act || l.action === act);
        }).slice(-300).reverse();
        var h = '';
        logs.forEach(function (l) {
          h += '<div class="logline"><time>' + AS.fmtDate(l.ts) + '</time>' +
            '<span class="who"><b>' + AS.esc(l.userName) + '</b> <span class="muted small">' + AS.ROLE_LABEL[l.role] + (l.role === 'system' ? '' : '') + '</span></span>' +
            '<span><span class="chip chip-blue">' + AS.esc(l.action) + '</span> ' + AS.esc(l.details) + '</span></div>';
        });
        if (!h) h = '<div class="empty" style="padding:24px"><p class="muted">No log entries match.</p></div>';
        document.getElementById('logList').innerHTML = h;
      };
      document.getElementById('logTeam').addEventListener('change', draw);
      document.getElementById('logAction').addEventListener('change', draw);
      draw();
      document.getElementById('logCsv').addEventListener('click', function () {
        var logs = visibleLogs();
        var rows = [['Timestamp', 'User', 'Role', 'Action', 'Details', 'Industry', 'Team']];
        var teamName = {};
        AS.store.state.teams.forEach(function (t) { teamName[t.id] = t.name; });
        logs.forEach(function (l) {
          rows.push([l.ts, l.userName, l.role, l.action, l.details,
            ind.name, l.teamId ? (teamName[l.teamId] || '') : '']);
        });
        AS.download(AS.csvName('apex-activity-log'), AS.toCSV(rows));
        AS.store.commit('log-download', 'Downloaded activity log CSV (' + logs.length + ' entries)', { industryId: ind.id, rerender: false });
        AS.toast('Log CSV downloaded', 'ok');
      });
    }
  };
})();
