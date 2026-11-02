/* Apex Strategy — pages-core.js: dashboard, learner guide, change password */
'use strict';
(function () {
  var UI = null;

  /* ================= DASHBOARD ================= */
  AS.PAGES.dashboard = function (el) {
    UI = AS.ui;
    var u = UI.user(), ind = UI.industry();
    if (!ind) return;
    var scen = UI.scenario();
    var isAdmin = u.role === 'superadmin' || u.role === 'manager';
    var myTeams = AS.store.teamsFor(u, ind);
    var focusTeam = isAdmin ? null : (myTeams[0] || null);

    var html = AS.pageHead('Dashboard',
      ind.name + ' · ' + scen.label + ' market',
      isAdmin ? '<a class="btn btn-outline btn-sm" href="#/rounds">' + AS.ic('rounds') + ' Round Control</a>' : '');

    /* phase callouts */
    if (ind.phase === 'setup') {
      html += '<div class="callout blue">' + AS.ic('info') + '<div><b>Setup phase.</b> Companies are created but the simulation has not started. ' +
        (u.role === 'superadmin' ? 'Open <a href="#/industries">Industries</a> to configure and start it.' : 'The Super Admin starts the simulation.') + '</div></div>';
    } else if (ind.phase === 'finished') {
      html += '<div class="callout green">' + AS.ic('trophy') + '<div><b>Simulation finished.</b> All ' + ind.quartersTotal + ' quarters were played. Check the <a href="#/leaderboard">final leaderboard</a> and download reports.</div></div>';
    } else {
      var q = ind.currentQuarter;
      var prac = q <= ind.practiceRounds;
      html += '<div class="callout ' + (prac ? 'yellow' : 'blue') + '">' + AS.ic(prac ? 'info' : 'play') + '<div><b>Quarter ' + q + ' of ' + ind.quartersTotal +
        (prac ? ' — practice round' : '') + '.</b> ' +
        (prac ? 'Practice results do not count towards the leaderboard. ' : '') +
        (isAdmin ? 'Teams enter decisions; you process the round from Round Control.' : 'Enter your decisions in the Decide pages, then submit from Review & Submit.') + '</div></div>';
      html += AS.qsteps(ind);
    }

    var lb = AS.leaderboard(AS.store.state, ind);
    var lastQ = AS.lastPlayedQ(ind);
    var ir = lastQ == null ? null : (ind.results[lastQ] || null);

    if (isAdmin) {
      /* ---- admin dashboard ---- */
      var teams = AS.store.state.teams.filter(function (t) { return t.industryId === ind.id; });
      var submitted = 0, edited = 0;
      teams.forEach(function (t) {
        var d = t.decisions[ind.currentQuarter];
        if (d && t.submitted[ind.currentQuarter]) submitted++;
        if (d && d.updatedAt) edited++;
      });
      html += '<div class="grid g4 mt">' +
        AS.kpi('Teams', teams.length, scen.label + ' market', { icon: '<i></i>' }) +
        AS.kpi('Submissions', submitted + ' / ' + teams.length, 'Q' + ind.currentQuarter + ' decisions submitted', { pct: teams.length ? submitted / teams.length * 100 : 0, color: 'var(--c-green-btn)' }) +
        AS.kpi('Highest score', lb.length ? lb[0].cum.toFixed(1) : '—', lb.length ? lb[0].team.name : '', { icon: AS.ic('trophy') }) +
        AS.kpi('Last processed', lastQ ? 'Q' + lastQ : 'Baseline', ir ? ir.ecoLabel : '', { icon: AS.ic('clock') }) +
        '</div>';
      html += '<div class="grid g32 mt">';
      /* submission status */
      html += '<div class="card"><div class="card-title"><h3>Team status — Q' + ind.currentQuarter + '</h3></div>' +
        '<div class="tblwrap"><table class="tbl"><thead><tr><th>Company</th><th>Edited</th><th>Submitted</th><th class="r">Last activity</th></tr></thead><tbody>';
      teams.forEach(function (t) {
        var d = t.decisions[ind.currentQuarter] || t.decisions[lastQ];
        html += '<tr><td>' + AS.teamChip(t) + '</td>' +
          '<td>' + (d && d.updatedAt ? '<span class="chip chip-green">saved</span>' : '<span class="chip">no edits</span>') + '</td>' +
          '<td>' + (t.submitted[ind.currentQuarter] ? '<span class="chip chip-green">yes</span>' : '<span class="chip chip-yellow">pending</span>') + '</td>' +
          '<td class="r muted small">' + (d && d.updatedAt ? AS.fmtDateShort(d.updatedAt) : '—') + '</td></tr>';
      });
      html += '</tbody></table></div></div>';
      /* news */
      html += '<div class="card"><div class="card-title"><h3>Market news</h3></div>';
      html += ir ? '<div class="news"><h4>' + ir.news.h + '</h4><p>' + ir.news.t + '</p></div>' +
        '<p class="small muted mt">Economy: ' + ir.ecoLabel + ' · next quarter demand shown in <a href="#/economy">Market Economy</a></p>'
        : '<p class="muted">News appears after the first round is processed.</p>';
      html += '</div></div>';
    } else {
      /* ---- team dashboard ---- */
      var t = focusTeam;
      if (t && lastQ != null) {
        var r = t.results[lastQ];
        var myRank = lb.filter(function (x) { return x.team.id === t.id; })[0];
        html += '<div class="grid g4 mt">' +
          AS.kpi('Score this quarter', r.score.avg.toFixed(1), (r.practice ? 'practice — not counted' : (lastQ === 0 ? 'last year (baseline)' : 'Q' + lastQ + ' balanced scorecard')), { pct: r.score.avg, icon: AS.ic('trophy') }) +
          AS.kpi('Cumulative score', myRank.cum.toFixed(1), 'rank ' + myRank.rank + ' of ' + lb.length + (myRank.official ? '' : ' · practice'), { pct: myRank.cum }) +
          AS.kpi('Net profit', AS.cr(r.net), 'Revenue ' + AS.cr(r.revenue), { cls: r.net >= 0 ? 'good' : 'bad' }) +
          AS.kpi('Market share', AS.pct(r.unitShare, 1), AS.num(r.soldUnits) + ' ' + scen.unit + ' sold', { pct: r.unitShare * 100 * 3 }) +
          '</div>';
        /* trends + scorecard */
        html += '<div class="grid g32 mt">';
        html += '<div class="card"><div class="card-title"><h3>Trends</h3><div class="spacer"></div>' +
          '<div class="seg" id="trendSeg"><button data-k="stockPrice" class="on">Share price</button><button data-k="net">Profit</button><button data-k="revenue">Revenue</button></div></div>' +
          '<div class="chartbox h240"><canvas id="dashTrend"></canvas></div></div>';
        html += '<div class="card"><div class="card-title"><h3>Balanced scorecard</h3></div>' +
          '<p class="card-sub">Each measure is scored 0–100. The quarter score is their average.</p>';
        AS.SCORE_META.forEach(function (m) {
          html += AS.scorebar(m.name, r.score[m.k]);
        });
        html += '</div></div>';
        /* coach + team + news */
        html += '<div class="grid g3 mt">';
        html += '<div class="card"><div class="card-title"><h3>Coach\'s notes</h3></div>';
        r.notes.forEach(function (n) { html += '<div class="callout yellow" style="margin-bottom:8px">' + AS.ic('info') + '<div>' + AS.esc(n) + '</div></div>'; });
        if (!r.notes.length) html += '<p class="muted">No warnings. Keep it up.</p>';
        html += '</div>';
        html += '<div class="card"><div class="card-title"><h3>My team</h3></div><p class="card-sub">' + AS.teamChip(t) + '</p>';
        (t.members || []).forEach(function (mid) {
          var mu = UI.userById(mid);
          if (mu) html += '<div class="check">' + AS.ic('people') + '<div><b>' + AS.esc(mu.name) + '</b> <span class="muted small">' + AS.esc(mu.email) + '</span></div></div>';
        });
        var coord = AS.store.state.users.filter(function (x) { return x.role === 'coordinator' && (x.teamIds || []).indexOf(t.id) >= 0; })[0];
        if (coord) html += '<div class="check">' + AS.ic('team') + '<div><b>' + AS.esc(coord.name) + '</b> <span class="muted small">coordinator</span></div></div>';
        html += '<p class="small muted mt">Max team size: ' + AS.store.teamSizeMaxOf(t) + ' players.</p></div>';
        html += '<div class="card"><div class="card-title"><h3>Market news</h3></div>';
        if (ir) html += '<div class="news"><h4>' + ir.news.h + '</h4><p>' + ir.news.t + '</p></div><p class="small muted mt">' + ir.ecoLabel + '</p>';
        else html += '<p class="muted">News appears after the first round.</p>';
        html += '</div></div>';
      } else {
        html += '<div class="card"><div class="empty">' + AS.ic('info') + '<h3>No results yet</h3><p class="muted">Results appear after the first round is processed.</p></div></div>';
      }
    }

    /* leaderboard (all roles) */
    html += '<div class="card mt"><div class="card-title"><h3>Leaderboard</h3><div class="spacer"></div>' +
      (lastQ != null && lastQ <= ind.practiceRounds ? '<span class="chip chip-yellow">practice — not counted</span>' : '') + '</div>' +
      '<div class="tblwrap"><table class="tbl"><thead><tr><th style="width:44px">#</th><th>Company</th><th class="r">Score</th><th class="r">Cumulative</th>' +
      '<th class="r">Revenue</th><th class="r">Profit</th><th class="r">Share price</th></tr></thead><tbody>';
    lb.forEach(function (x) {
      var r = x.last;
      html += '<tr' + (focusTeam && x.team.id === focusTeam.id ? ' class="me"' : '') + '><td class="rank">' + x.rank + '</td>' +
        '<td>' + AS.teamChip(x.team) + '</td>' +
        '<td class="r">' + (r ? r.score.avg.toFixed(1) : '—') + '</td>' +
        '<td class="r"><b>' + x.cum.toFixed(1) + '</b></td>' +
        '<td class="r">' + (r ? AS.cr1(r.revenue) : '—') + '</td>' +
        '<td class="r ' + (r && r.net < 0 ? 'bad' : 'good') + '">' + (r ? AS.cr1(r.net) : '—') + '</td>' +
        '<td class="r">' + (r ? AS.rs(r.stockPrice) : AS.rs(AS.DEFAULTS.startPrice)) + '</td></tr>';
    });
    html += '</tbody></table></div><p class="small muted mt">Amounts in ₹ crore. Cumulative = average of scored quarters (practice rounds excluded).</p></div>';

    el.innerHTML = html;

    /* trend chart */
    var cv = document.getElementById('dashTrend');
    if (cv) {
      var teamsAll = UI.allTeamsInIndustry();
      var draw = function (key) {
        var qs = []; for (var q = 0; q <= lastQ; q++) qs.push('Q' + q);
        var pal = AS.chartPalette();
        var ds = teamsAll.map(function (t, i) {
          var pts = qs.map(function (_, q) { var r = t.results[q]; return r ? r[key] : (q === 0 ? null : null); });
          return { label: t.name, data: pts, borderColor: pal.series[i % 7], backgroundColor: pal.series[i % 7], spanGaps: true };
        });
        AS.chart('dashTrend', 'line', { labels: qs, datasets: ds }, { yTitle: '₹' });
      };
      draw('stockPrice');
      var seg = document.getElementById('trendSeg');
      seg.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        seg.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
        var idx = AS.chart ? charts0() : 0;
        draw(b.dataset.k);
      });
    }
    function charts0() { return 0; }
  };

  /* ================= LEARNER GUIDE ================= */
  AS.PAGES.guide = function (el) {
    var ind = AS.ui.industry();
    var scen = AS.ui.scenario();
    el.innerHTML = AS.pageHead('Learner Guide', 'How Apex Strategy works') +

    '<div class="grid g2">' +
    '<div class="card"><div class="card-title"><h3>' + AS.ic('play') + ' The flow, every quarter</h3></div>' +
      '<ol style="margin:0;padding-left:20px;line-height:1.9">' +
      '<li><b>Analyse</b> — study Market Economy, Market Share, Benchmarking, Sales Analysis, Financial Statements and the R&D report.</li>' +
      '<li><b>Plan</b> — agree a strategy in the Planning Hub: target segments, price points, budgets.</li>' +
      '<li><b>Decide</b> — enter decisions: Product Design, Marketing Mix, Operations, Manpower, Finance, Special Projects.</li>' +
      '<li><b>Submit</b> — validate and submit in Review &amp; Submit before the deadline.</li>' +
      '<li><b>Process</b> — the Manager or Super Admin processes the round; results, scorecard and news are published.</li>' +
      '<li><b>Review</b> — read the dashboard, coach notes and reports; then repeat for the next quarter.</li></ol></div>' +

    '<div class="card"><div class="card-title"><h3>' + AS.ic('people') + ' Roles</h3></div>' +
      Object.keys(AS.ROLE_LABEL).map(function (r) {
        return '<div class="check">' + AS.ic('check') + '<div><b>' + AS.ROLE_LABEL[r] + '</b><br><span class="muted small">' + AS.ROLE_DESC[r] + '</span></div></div>';
      }).join('') + '</div></div>' +

    '<div class="card"><div class="card-title"><h3>' + AS.ic('trophy') + ' How the score works</h3></div>' +
      '<p>Each quarter, eight measures across the four Balanced Scorecard perspectives are scored from 0 to 100. The quarter score is their average. ' +
      'Your cumulative score is the average of all <b>scored</b> quarters — practice rounds are never included, so consistent performance beats one lucky quarter.</p>' +
      '<div class="grid g4">' + AS.SCORE_META.map(function (m) {
        return '<div class="callout blue" style="margin:0"><b>' + m.name + '</b><br><span class="small">' + m.persp + '</span></div>';
      }).join('') + '</div></div>' +

    '<div class="card"><div class="card-title"><h3>' + AS.ic('product') + ' The ' + scen.label + ' market</h3></div>' +
      '<p>' + AS.esc(scen.blurb) + ' Each company runs three products, one per segment. Buyers weigh price, specifications, awareness, accessibility, service and brand — ' +
      'the exact weights differ by segment (see Market Economy).</p>' +
      '<div class="tblwrap"><table class="tbl"><thead><tr><th>Segment</th><th class="r">Buyers / quarter</th><th class="r">Growth</th><th class="r">Ideal price (Q0)</th><th>What buyers weigh most</th></tr></thead><tbody>' +
      scen.segments.map(function (s) {
        var w = s.weights; var entries = [['Price', w.price], ['Specs', w.specs], ['Awareness', w.aware], ['Access', w.access], ['Service', w.svc], ['Brand', w.brand]]
          .sort(function (a, b) { return b[1] - a[1]; }).slice(0, 2).map(function (x) { return x[0] + ' ' + Math.round(x[1] * 100) + '%'; }).join(', ');
        return '<tr><td>' + s.name + '</td><td class="r">' + AS.num(s.baseDemand) + '</td><td class="r">' + AS.pct(s.growth, 1) + '/qtr</td><td class="r">' + AS.rs(s.idealPrice) + '</td><td>' + entries + '</td></tr>';
      }).join('') + '</tbody></table></div></div>' +

    '<div class="grid g2">' +
    '<div class="card"><div class="card-title"><h3>' + AS.ic('warn') + ' Common traps</h3></div>' +
      '<div class="check">' + AS.ic('x') + '<div><b>Stock-outs.</b> Lost sales never return. Watch the Operations forecast before finalising production.</div></div>' +
      '<div class="check">' + AS.ic('x') + '<div><b>Unsold inventory.</b> Carrying stock costs ' + AS.pct(AS.DEFAULTS.storageRate, 0) + ' of its value every quarter.</div></div>' +
      '<div class="check">' + AS.ic('x') + '<div><b>Specs drift behind.</b> Buyer expectations rise every quarter; without R&D your products age out of their segment.</div></div>' +
      '<div class="check">' + AS.ic('x') + '<div><b>Emergency loans.</b> Running out of cash triggers a punitive ' + AS.pct(AS.DEFAULTS.emergencyRate * 4, 1) + ' APR loan.</div></div>' +
      '<div class="check">' + AS.ic('x') + '<div><b>Deadline lock.</b> Decisions lock automatically at the deadline. Unsubmitted teams fall back to their last saved decisions (or autopilot).</div></div>' +
      '</div>' +
    '<div class="card"><div class="card-title"><h3>' + AS.ic('lock') + ' Access rules</h3></div>' +
      '<p class="small">You see the results of every company in your industry (that is public market data), but you can only enter decisions for your own team. ' +
      'Team Coordinators enter decisions for their allotted teams. Managers and the Super Admin process rounds, set deadlines and download reports. ' +
      'Every decision, submission and round is written to the activity log.</p>' +
      '<p class="small">Deadlines and quarters: this industry plays ' + (ind ? ind.quartersTotal : 8) + ' quarters with ' + (ind ? ind.practiceRounds : 0) + ' practice round(s).</p>' +
      '</div></div>';
  };

  /* ================= CHANGE PASSWORD ================= */
  AS.PAGES.password = function (el) {
    var u = AS.ui.user();
    el.innerHTML = AS.pageHead('Change Password', 'Update your account password') +
      '<div class="card" style="max-width:460px">' +
      (u.mustChange ? '<div class="form-err">Your administrator asked you to change your password before continuing.</div>' : '') +
      '<form id="pwForm">' +
      '<label class="fld"><span>Current password</span><input type="password" id="pwOld" autocomplete="current-password" required></label>' +
      '<label class="fld"><span>New password (min 6 characters)</span><input type="password" id="pwNew" autocomplete="new-password" minlength="6" required></label>' +
      '<label class="fld"><span>Repeat new password</span><input type="password" id="pwNew2" autocomplete="new-password" minlength="6" required></label>' +
      '<div id="pwErr" class="form-err" hidden></div>' +
      '<button class="btn btn-primary" type="submit">Update password</button></form></div>';

    document.getElementById('pwForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var err = document.getElementById('pwErr');
      var n1 = document.getElementById('pwNew').value, n2 = document.getElementById('pwNew2').value;
      if (n1 !== n2) { err.textContent = 'New passwords do not match.'; err.hidden = false; return; }
      var res = AS.store.changePassword(u, document.getElementById('pwOld').value, n1);
      if (!res.ok) { err.textContent = res.msg; err.hidden = false; return; }
      AS.store.commit('password-change', 'Password updated', { rerender: false });
      err.hidden = true;
      AS.toast('Password updated', 'ok');
      this.reset();
    });
  };
})();
