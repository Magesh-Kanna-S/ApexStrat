/* Apex Strategy — pages-results.js: leaderboard + 6 analyse pages */
'use strict';
(function () {
  var UI;

  function lbTable(full) {
    var ind = UI.industry();
    var lb = AS.leaderboard(AS.store.state, ind);
    var lastQ = UI.lastQ();
    var html = '<div class="tblwrap"><table class="tbl"><thead><tr><th style="width:44px">#</th><th>Company</th>' +
      (full ? AS.SCORE_META.map(function (m) { return '<th class="r" title="' + m.name + '">' + m.name.split(' ')[0] + '</th>'; }).join('') : '<th class="r">Score</th>') +
      '<th class="r">Cumulative</th><th class="r">Revenue</th><th class="r">Net profit</th><th class="r">Margin</th><th class="r">Share price</th><th class="r">Mkt cap</th><th class="r">Unit share</th><th class="r">ROE (ann.)</th></tr></thead><tbody>';
    lb.forEach(function (x) {
      var r = x.last;
      html += '<tr><td class="rank">' + x.rank + '</td><td>' + AS.teamChip(x.team) + '</td>';
      if (full) {
        AS.SCORE_META.forEach(function (m) {
          var v = r ? r.score[m.k] : null;
          html += '<td class="r ' + (v == null ? '' : v >= 67 ? 'good' : v >= 34 ? 'warn' : 'bad') + '">' + (v == null ? '—' : v.toFixed(0)) + '</td>';
        });
      } else {
        html += '<td class="r">' + (r ? r.score.avg.toFixed(1) : '—') + '</td>';
      }
      html += '<td class="r"><b>' + x.cum.toFixed(1) + '</b></td>' +
        '<td class="r">' + (r ? AS.cr1(r.revenue) : '—') + '</td>' +
        '<td class="r ' + (r && r.net < 0 ? 'bad' : '') + '">' + (r ? AS.cr1(r.net) : '—') + '</td>' +
        '<td class="r">' + (r ? AS.pct(r.netMargin, 1) : '—') + '</td>' +
        '<td class="r">' + (r ? AS.rs(r.stockPrice) : '—') + '</td>' +
        '<td class="r">' + (r ? AS.cr0(r.stockPrice * r.shares) : '—') + '</td>' +
        '<td class="r">' + (r ? AS.pct(r.unitShare, 1) : '—') + '</td>' +
        '<td class="r">' + (r ? AS.pct(r.roe, 1) : '—') + '</td></tr>';
    });
    html += '</tbody></table></div><p class="small muted mt">Amounts in ₹ crore · ' + (lastQ == null ? 'no data' : lastQ === 0 ? 'last year (baseline)' : 'latest: Q' + lastQ) +
      (lastQ != null && lastQ > 0 && lastQ <= ind.practiceRounds ? ' · practice — not counted in cumulative' : (lastQ === 0 ? ' · last year (baseline)' : '')) + '</p>';
    return html;
  }
  AS.cr0 = function (v) { return '₹' + AS.NF0.format(v / AS.CR); };

  /* ================= LEADERBOARD ================= */
  AS.PAGES.leaderboard = function (el) {
    UI = AS.ui;
    el.innerHTML = AS.pageHead('Leaderboard', 'Cumulative balanced-scorecard ranking') +
      '<div class="card">' + lbTable(false) + '</div>' +
      '<div class="card"><div class="card-title"><h3>How the score works</h3></div>' +
      '<p class="small">Each quarter, eight measures across the four Balanced Scorecard perspectives are scored 0–100; the quarter score is their average. ' +
      'Rank is based on the cumulative score — the average of all <b>scored</b> quarters — so consistent performance beats one lucky quarter. Practice rounds are never included.</p></div>';
  };

  /* ================= MARKET ECONOMY ================= */
  AS.PAGES.economy = function (el) {
    UI = AS.ui;
    var ind = UI.industry(), scen = UI.scenario();
    var lastQ = UI.lastQ();
    var html = AS.pageHead('Market Economy', 'Segment demand, prices and expectations over time');
    /* demand table */
    html += '<div class="card"><div class="card-title"><h3>Segment demand</h3></div>' +
      '<div class="tblwrap"><table class="tbl"><thead><tr><th>Segment</th><th class="r">Buyers now</th><th class="r">Next quarter</th><th class="r">Growth</th><th class="r">Ideal price</th><th class="r">Price drift</th><th class="r">Spec expectation</th></tr></thead><tbody>';
    var qNow = Math.max(1, lastQ + 1);
    scen.segments.forEach(function (s, i) {
      var nowD = lastQ ? (ind.results[lastQ].demand[i]) : s.baseDemand;
      var nextD = s.baseDemand * Math.pow(1 + s.growth, qNow) * AS.economy(qNow);
      var ideal = AS.idealPrice(s, qNow);
      var expGrowth = (Math.pow(1 + s.specDrift, 4) - 1) * 100;
      html += '<tr><td><b>' + s.name + '</b></td><td class="r">' + AS.num(nowD) + '</td><td class="r">' + AS.num(nextD) + '</td>' +
        '<td class="r good">' + AS.pct(s.growth, 1) + '</td><td class="r">' + AS.rs(ideal) + '</td>' +
        '<td class="r bad">' + AS.pct(s.priceDrift, 1) + '</td><td class="r warn">+' + expGrowth.toFixed(1) + '% / year</td></tr>';
    });
    html += '</tbody></table></div>' +
      '<p class="small muted mt">Ideal prices drift down every quarter, and buyers expect better specifications for the same money — this is why products age and need R&D.</p></div>';

    /* charts */
    html += '<div class="grid g2">' +
      '<div class="card"><div class="card-title"><h3>Demand by segment</h3></div><div class="chartbox h240"><canvas id="ecoDemand"></canvas></div></div>' +
      '<div class="card"><div class="card-title"><h3>Ideal price by segment</h3></div><div class="chartbox h240"><canvas id="ecoPrice"></canvas></div></div>' +
      '</div>';

    /* segment detail cards */
    html += '<div class="grid g3">';
    scen.segments.forEach(function (s, i) {
      html += '<div class="card"><div class="card-title"><h3>' + s.name + ' buyers</h3></div>' +
        '<p class="card-sub">What they weigh when choosing a ' + scen.unit.slice(0, -1) + ':</p>';
      var entries = [['Price', s.weights.price], ['Specifications', s.weights.specs], ['Brand awareness', s.weights.aware],
        ['Store / channel access', s.weights.access], ['Customer service', s.weights.svc], ['Brand image', s.weights.brand]];
      entries.forEach(function (e) { html += AS.scorebar(e[0], e[1] * 100); });
      html += '<p class="small muted mt">Channel preference — ' +
        ['Online', 'Modern retail', 'General trade'].map(function (c, ci) { return c + ' ' + Math.round(s.chPref[ci] * 100) + '%'; }).join(' · ') + '</p></div>';
    });
    html += '</div>';
    el.innerHTML = html;

    var qs = [], pal = AS.chartPalette();
    for (var q = 0; q <= Math.max(lastQ, 1); q++) qs.push('Q' + q);
    AS.chart('ecoDemand', 'line', {
      labels: qs,
      datasets: scen.segments.map(function (s, i) {
        return { label: s.name, data: qs.map(function (_, q) { return Math.round(s.baseDemand * Math.pow(1 + s.growth, q) * AS.economy(q)); }),
          borderColor: pal.series[i], backgroundColor: pal.series[i] };
      })
    }, { yTitle: 'buyers' });
    AS.chart('ecoPrice', 'line', {
      labels: qs,
      datasets: scen.segments.map(function (s, i) {
        return { label: s.name, data: qs.map(function (_, q) { return Math.round(AS.idealPrice(s, q)); }),
          borderColor: pal.series[i], backgroundColor: pal.series[i] };
      })
    }, { yTitle: '₹' });
  };

  /* ================= MARKET SHARE ================= */
  AS.PAGES.share = function (el) {
    UI = AS.ui;
    var ind = UI.industry(), scen = UI.scenario();
    var lastQ = UI.lastQ();
    if (lastQ == null) { el.innerHTML = AS.pageHead('Market Share', '') + noResults(); return; }
    var teams = AS.store.state.teams.filter(function (t) { return t.industryId === ind.id; });
    var ir = ind.results[lastQ];
    var r0 = teams[0].results[lastQ];
    var html = AS.pageHead('Market Share', 'Q' + lastQ + ' — ' + ir.ecoLabel);

    html += '<div class="grid g32">' +
      '<div class="card"><div class="card-title"><h3>Overall unit share</h3></div><div class="chartbox h240"><canvas id="sharePie"></canvas></div></div>' +
      '<div class="card"><div class="card-title"><h3>Share trend</h3></div><div class="chartbox h240"><canvas id="shareTrend"></canvas></div></div></div>';

    /* per-segment stacked bar: units sold by team */
    html += '<div class="card"><div class="card-title"><h3>Units sold by segment</h3></div><div class="chartbox h300"><canvas id="shareStack"></canvas></div></div>';

    /* table by segment */
    html += '<div class="card"><div class="card-title"><h3>Share by segment</h3></div><div class="tblwrap"><table class="tbl"><thead><tr><th>Company</th>' +
      scen.segments.map(function (s) { return '<th class="r">' + s.name + '</th>'; }).join('') + '<th class="r">Total</th></tr></thead><tbody>';
    teams.forEach(function (t) {
      var r = t.results[lastQ];
      html += '<tr><td>' + AS.teamChip(t) + '</td>';
      scen.segments.forEach(function (s, si) {
        var pid = t.products.filter(function (p) { return p.segment === si; })[0];
        var pr = r.products[pid.id];
        var segTotal = 0;
        teams.forEach(function (t2) {
          var p2 = t2.products.filter(function (p) { return p.segment === si; })[0];
          var x = t2.results[lastQ].products[p2.id]; if (x) segTotal += x.sold;
        });
        html += '<td class="r">' + (pr && segTotal ? AS.pct(pr.sold / segTotal, 1) : '—') + '</td>';
      });
      html += '<td class="r"><b>' + AS.pct(r.unitShare, 1) + '</b></td></tr>';
    });
    html += '</tbody></table></div></div>';
    el.innerHTML = html;

    var pal = AS.chartPalette();
    AS.chart('sharePie', 'doughnut', {
      labels: teams.map(function (t) { return t.name; }),
      datasets: [{ data: teams.map(function (t) { return Math.round(t.results[lastQ].unitShare * 1000) / 10; }),
        backgroundColor: teams.map(function (t, i) { return pal.series[t.color % 7]; }) }]
    });
    var qs = []; for (var q = 1; q <= lastQ; q++) qs.push('Q' + q);
    AS.chart('shareTrend', 'line', {
      labels: qs,
      datasets: teams.map(function (t) {
        return { label: t.name, data: qs.map(function (_, q) { return t.results[q] ? +(t.results[q].unitShare * 100).toFixed(1) : null; }),
          borderColor: pal.series[t.color % 7], backgroundColor: pal.series[t.color % 7], spanGaps: true };
      })
    }, { yTitle: '%' });
    AS.chart('shareStack', 'bar', {
      labels: scen.segments.map(function (s) { return s.name; }),
      datasets: teams.map(function (t) {
        return { label: t.name, data: scen.segments.map(function (s, si) {
          var p = t.products.filter(function (x) { return x.segment === si; })[0];
          var pr = t.results[lastQ].products[p.id];
          return pr ? Math.round(pr.sold) : 0;
        }), backgroundColor: pal.series[t.color % 7] };
      })
    }, { yTitle: 'units' });
  };

  /* ================= BENCHMARKING ================= */
  AS.PAGES.benchmark = function (el) {
    UI = AS.ui;
    var ind = UI.industry();
    var lastQ = UI.lastQ();
    if (lastQ == null) { el.innerHTML = AS.pageHead('Benchmarking', '') + noResults(); return; }
    el.innerHTML = AS.pageHead('Benchmarking', 'Q' + lastQ + ' — your company vs the industry') +
      '<div class="card"><div class="card-title"><h3>Financial snapshot</h3></div>' + lbTable(true) + '</div>' +
      '<div class="grid g2">' +
      '<div class="card"><div class="card-title"><h3>Best in class</h3></div><div id="bestList"></div></div>' +
      '<div class="card"><div class="card-title"><h3>Scorecard comparison</h3></div><div class="chartbox h300"><canvas id="bmRadar"></canvas></div>' +
      '<p class="small muted">Choose companies in the legend. The grey area is the industry average.</p></div></div>';

    var teams = AS.store.state.teams.filter(function (t) { return t.industryId === ind.id; });
    /* best in class */
    var metrics = [
      ['Cumulative score', function (t, r) { var x = AS.leaderboard(AS.store.state, ind).filter(function (y) { return y.team.id === t.id; })[0]; return x.cum; }, ''],
      ['Net margin', function (t, r) { return r.netMargin * 100; }, '%'],
      ['Unit share', function (t, r) { return r.unitShare * 100; }, '%'],
      ['Share price', function (t, r) { return r.stockPrice; }, '₹'],
      ['Service level', function (t, r) { return r.serviceLevel * 100; }, '%']
    ];
    var bl = '';
    metrics.forEach(function (m) {
      var best = null;
      teams.forEach(function (t) {
        var r = t.results[lastQ];
        var v = m[1](t, r);
        if (!best || v > best.v) best = { t: t, v: v };
      });
      bl += '<div class="check">' + AS.ic('trophy') + '<div><b>' + m[0] + ': ' + AS.teamChip(best.t) + '</b><br>' +
        '<span class="muted small">' + (m[2] === '₹' ? AS.rs(best.v) : best.v.toFixed(1) + m[2]) + '</span></div></div>';
    });
    document.getElementById('bestList').innerHTML = bl;

    /* radar */
    var pal = AS.chartPalette();
    AS.chart('bmRadar', 'radar', {
      labels: AS.SCORE_META.map(function (m) { return m.name; }),
      datasets: teams.slice(0, 7).map(function (t) {
        return { label: t.name, data: AS.SCORE_META.map(function (m) { return Math.round(t.results[lastQ].score[m.k]); }),
          borderColor: pal.series[t.color % 7], backgroundColor: pal.series[t.color % 7] + '22' };
      })
    });
  };

  /* ================= SALES ANALYSIS ================= */
  AS.PAGES.sales = function (el) {
    UI = AS.ui;
    var ind = UI.industry(), scen = UI.scenario();
    var lastQ = UI.lastQ();
    if (lastQ == null) { el.innerHTML = AS.pageHead('Sales Analysis', '') + noResults(); return; }
    var teams = AS.store.state.teams.filter(function (t) { return t.industryId === ind.id; });
    var u = UI.user();
    var myTeams = AS.store.teamsFor(u, ind);
    var focus = myTeams[0] || teams[0];

    var html = AS.pageHead('Sales Analysis', 'Q' + lastQ + ' — product-level performance');
    /* team selector */
    html += '<div class="fld" style="max-width:320px"><span>Company</span><select id="salesTeam">' +
      teams.map(function (t) { return '<option value="' + t.id + '"' + (t.id === focus.id ? ' selected' : '') + '>' + AS.esc(t.name) + '</option>'; }).join('') +
      '</select></div>';

    html += '<div class="card" id="salesCard"></div>';
    html += '<div class="grid g2"><div class="card"><div class="card-title"><h3>Demand vs units sold</h3></div><div class="chartbox h240"><canvas id="salesChart"></canvas></div></div>' +
      '<div class="card"><div class="card-title"><h3>Segment price positioning</h3></div><div class="chartbox h240"><canvas id="priceChart"></canvas></div></div></div>';
    el.innerHTML = html;

    function draw() {
      var tid = document.getElementById('salesTeam').value;
      var t = UI.teamById(tid);
      var r = t.results[lastQ];
      var c = document.getElementById('salesCard');
      var h = '<div class="tblwrap"><table class="tbl"><thead><tr><th>Product</th><th>Segment</th><th class="r">Price</th><th class="r">Demand</th>' +
        '<th class="r">Sold</th><th class="r">Lost</th><th class="r">Ending stock</th><th class="r">Revenue</th><th class="r">Awareness</th><th class="r">Access</th><th class="r">Spec fit</th></tr></thead><tbody>';
      t.products.forEach(function (p) {
        var pr = r.products[p.id];
        var seg = scen.segments[p.segment];
        h += '<tr><td><b>' + AS.esc(pr.name) + '</b></td><td>' + seg.name + '</td><td class="r">' + AS.rs(pr.price) + '</td>' +
          '<td class="r">' + AS.num(pr.demand) + '</td><td class="r">' + AS.num(pr.sold) + '</td>' +
          '<td class="r ' + (pr.lost > 0 ? 'bad' : '') + '">' + AS.num(pr.lost) + '</td>' +
          '<td class="r ' + (pr.invEnd > 20000 ? 'warn' : '') + '">' + AS.num(pr.invEnd) + '</td>' +
          '<td class="r">' + AS.cr1(pr.revenue) + '</td>' +
          '<td class="r">' + AS.pct(pr.awareness, 0) + '</td><td class="r">' + AS.pct(pr.accessibility, 0) + '</td>' +
          '<td class="r ' + (pr.specScore > 1 ? 'good' : pr.specScore < 0.9 ? 'bad' : '') + '">' + AS.pct(pr.specScore, 0) + '</td></tr>';
      });
      h += '</tbody></table></div>';
      c.innerHTML = h;

      var pal = AS.chartPalette();
      AS.chart('salesChart', 'bar', {
        labels: t.products.map(function (p) { return r.products[p.id].name; }),
        datasets: [
          { label: 'Demand', data: t.products.map(function (p) { return Math.round(r.products[p.id].demand); }), backgroundColor: pal.series[0] },
          { label: 'Sold', data: t.products.map(function (p) { return Math.round(r.products[p.id].sold); }), backgroundColor: pal.series[3] }
        ]
      }, { yTitle: 'units' });
      /* price vs ideal */
      AS.chart('priceChart', 'bar', {
        labels: t.products.map(function (p) { return r.products[p.id].name; }),
        datasets: [
          { label: 'Your price', data: t.products.map(function (p) { return Math.round(r.products[p.id].price); }), backgroundColor: pal.series[0] },
          { label: 'Segment ideal', data: t.products.map(function (p) { return Math.round(AS.idealPrice(scen.segments[p.segment], lastQ)); }), backgroundColor: pal.series[2] }
        ]
      }, { yTitle: '₹' });
    }
    draw();
    document.getElementById('salesTeam').addEventListener('change', function () {
      /* destroy existing charts before redraw */
      draw();
    });
  };

  /* ================= FINANCIAL STATEMENTS ================= */
  AS.PAGES.statements = function (el, params) {
    UI = AS.ui;
    var ind = UI.industry();
    var lastQ = UI.lastQ();
    if (lastQ == null) { el.innerHTML = AS.pageHead('Financial Statements', '') + noResults(); return; }
    var teams = AS.store.state.teams.filter(function (t) { return t.industryId === ind.id; });
    var u = UI.user();
    var myTeams = AS.store.teamsFor(u, ind);
    var focus = myTeams[0] || teams[0];
    var q = params && params[0] !== undefined && params[0] !== '' ? Math.max(0, Math.min(lastQ, +params[0])) : lastQ;

    var html = AS.pageHead('Financial Statements', 'Quarterly statements for ' + AS.esc(focus.name));
    html += '<div class="fld" style="max-width:320px"><span>Company</span><select id="finTeam">' +
      teams.map(function (t) { return '<option value="' + t.id + '"' + (t.id === focus.id ? ' selected' : '') + '>' + AS.esc(t.name) + '</option>'; }).join('') + '</select></div>';
    /* quarter tabs */
    html += '<div class="tabs" id="finTabs">';
    for (var i = 0; i <= lastQ; i++) html += '<button class="tab' + (i === q ? ' on' : '') + '" data-q="' + i + '">' + (i === 0 ? 'Q0 · last year' : 'Q' + i + (i <= ind.practiceRounds ? ' ·P' : '')) + '</button>';
    html += '</div><div id="finBody"></div>';
    el.innerHTML = html;

    function line(lbl, v, cls) { return '<tr><td>' + lbl + '</td><td class="r ' + (cls || '') + '">' + (typeof v === 'string' ? v : AS.cr(v)) + '</td></tr>'; }
    function draw() {
      var t = UI.teamById(document.getElementById('finTeam').value);
      var r = t.results[q];
      document.querySelectorAll('#finTabs .tab').forEach(function (b) { b.classList.toggle('on', +b.dataset.q === q); });
      /* promo spend from the quarter's decision */
      var dec = t.decisions[q] || {};
      var promo = 0;
      if (dec.products) Object.keys(dec.products).forEach(function (k) { promo += dec.products[k].promo || 0; });
      var h = '<div class="grid g3">';
      h += '<div class="card"><div class="card-title"><h3>Income statement</h3></div><div class="tblwrap"><table class="tbl"><tbody>' +
        line('<b>Revenue</b> (net of channel costs)', r.revenue) +
        line('Cost of materials', -r.matCost) +
        line('Direct labor', -r.labor) +
        line('Promotion spend', -promo) +
        line('Sales force', -r.salesCost) +
        line('Training', -r.training) +
        line('Innovation programs', -r.innovation) +
        line('Special projects', -r.projects) +
        line('R&D projects', -r.rnd) +
        line('Inventory carrying cost', -r.storage) +
        line('Administration', -r.admin) +
        line('Depreciation', -r.dep) +
        line('Interest', -r.interest) +
        (r.emergency > 0 ? line('<b class="bad">Emergency loan interest</b>', -(r.emergency * AS.DEFAULTS.emergencyRate), 'bad') : '') +
        '<tr><td><b>Earnings before tax</b></td><td class="r"><b>' + AS.cr(r.ebt) + '</b></td></tr>' +
        line('Tax (25%)', -r.tax) +
        '<tr><td><b>Net profit</b></td><td class="r ' + (r.net < 0 ? 'bad' : 'good') + '"><b>' + AS.cr(r.net) + '</b></td></tr>' +
        '</tbody></table></div></div>';
      /* Balance sheet */
      var inventoryVal = 0;
      Object.keys(r.products).forEach(function (k) { var pr = r.products[k]; inventoryVal += pr.invEnd; });
      h += '<div class="card"><div class="card-title"><h3>Balance sheet</h3></div><div class="tblwrap"><table class="tbl"><tbody>' +
        line('Cash', r.cash, r.cash < 0 ? 'bad' : '') +
        line('Inventory (units)', AS.num(r.inventoryUnits) + ' ' + UI.scenario().unit, '') +
        line('Plant (net of depreciation)', t.plantValue * (1 - AS.DEFAULTS.depRate * q)) +
        line('<b>Total assets</b>', r.cash + t.plantValue, '') +
        line('Short-term debt', -r.stDebt) +
        line('Long-term debt', -r.ltDebt) +
        (r.emergency > 0 ? line('Emergency loan (Big Bank)', -r.emergency, 'bad') : '') +
        line('Equity (simplified)', Math.max(0, r.cash + t.plantValue - r.stDebt - r.ltDebt - r.emergency)) +
        '</tbody></table></div></div>';
      /* Cash flow + ratios */
      h += '<div class="card"><div class="card-title"><h3>Ratios & shares</h3></div>' +
        '<div class="tblwrap"><table class="tbl"><tbody>' +
        '<tr><td>Net margin</td><td class="r">' + AS.pct(r.netMargin, 1) + '</td></tr>' +
        '<tr><td>ROE (annualised)</td><td class="r">' + AS.pct(r.roe, 1) + '</td></tr>' +
        '<tr><td>Debt / equity</td><td class="r">' + r.deRatio.toFixed(2) + '</td></tr>' +
        '<tr><td>EPS (quarter)</td><td class="r">' + AS.rs(r.eps / 4) + '</td></tr>' +
        '<tr><td>EPS (annualised)</td><td class="r">' + AS.rs(r.eps) + '</td></tr>' +
        '<tr><td>P/E</td><td class="r">' + r.pe.toFixed(1) + '</td></tr>' +
        '<tr><td>Share price</td><td class="r"><b>' + AS.rs(r.stockPrice) + '</b></td></tr>' +
        '<tr><td>Market cap</td><td class="r">' + AS.cr0(r.stockPrice * r.shares) + '</td></tr>' +
        '<tr><td>Shares outstanding</td><td class="r">' + AS.num(r.shares) + '</td></tr>' +
        '<tr><td>Plant utilisation</td><td class="r">' + AS.pct(r.utilization, 0) + '</td></tr>' +
        '<tr><td>Service level</td><td class="r">' + AS.pct(r.serviceLevel, 0) + '</td></tr>' +
        '</tbody></table></div></div>';
      h += '</div>';
      document.getElementById('finBody').innerHTML = h;
    }
    draw();
    document.getElementById('finTeam').addEventListener('change', draw);
    document.getElementById('finTabs').addEventListener('click', function (e) {
      var b = e.target.closest('.tab'); if (!b) return;
      q = +b.dataset.q; draw();
    });
  };

  /* ================= R&D REPORT ================= */
  AS.PAGES.rnd = function (el) {
    UI = AS.ui;
    var ind = UI.industry(), scen = UI.scenario();
    var lastQ = UI.lastQ();
    if (lastQ == null) { el.innerHTML = AS.pageHead('R&D Report', '') + noResults(); return; }
    var teams = AS.store.state.teams.filter(function (t) { return t.industryId === ind.id; });
    var u = UI.user();
    var myTeams = AS.store.teamsFor(u, ind);
    var focus = myTeams[0] || teams[0];

    var html = AS.pageHead('R&D Report', 'Specifications vs buyer expectations');
    html += '<div class="fld" style="max-width:320px"><span>Company</span><select id="rndTeam">' +
      teams.map(function (t) { return '<option value="' + t.id + '"' + (t.id === focus.id ? ' selected' : '') + '>' + AS.esc(t.name) + '</option>'; }).join('') + '</select></div>';
    html += '<div id="rndBody"></div>';
    el.innerHTML = html;

    function draw() {
      var t = UI.teamById(document.getElementById('rndTeam').value);
      var r = t.results[lastQ];
      var qNext = Math.min(ind.currentQuarter, ind.quartersTotal);
      var h = '<div class="grid g3">';
      t.products.forEach(function (p) {
        var seg = scen.segments[p.segment];
        var exp = AS.specExpect(seg, lastQ);
        var nextDec = t.decisions[qNext];
        var target = nextDec && nextDec.products[p.id] ? nextDec.products[p.id].specsTarget : p.specs;
        h += '<div class="card"><div class="card-title"><h3>' + AS.esc(p.name) + '</h3><div class="spacer"></div><span class="chip">' + seg.name + '</span></div>';
        h += '<div class="tblwrap"><table class="tbl"><thead><tr><th>Attribute</th><th class="r">Now</th><th class="r">Buyers expect</th><th class="r">Gap</th><th class="r">Next target</th></tr></thead><tbody>';
        scen.attrs.forEach(function (a, ai) {
          var gap = p.specs[ai] - exp[ai];
          h += '<tr><td>' + a.name + '</td><td class="r">' + p.specs[ai].toFixed(1) + '</td><td class="r">' + exp[ai].toFixed(1) + '</td>' +
            '<td class="r ' + (gap < -0.8 ? 'bad' : gap > 0.8 ? 'good' : '') + '">' + (gap >= 0 ? '+' : '') + gap.toFixed(1) + '</td>' +
            '<td class="r">' + (target[ai] > p.specs[ai] ? '<b class="good">' + target[ai].toFixed(0) + '</b>' : target[ai].toFixed(0)) + '</td></tr>';
        });
        h += '</tbody></table></div>';
        h += '<p class="small muted mt">Age: ' + p.age + ' quarters · awareness ' + AS.pct(p.awareness, 0) + ' · stock ' + AS.num(p.inventory) + '</p></div>';
      });
      h += '</div>';
      /* project spend */
      h += '<div class="card"><div class="card-title"><h3>R&D spend</h3></div><div class="tblwrap"><table class="tbl"><thead><tr><th>Quarter</th><th class="r">R&D projects</th><th class="r">Innovation</th><th class="r">Training</th><th class="r">Revenue</th><th class="r">R&D + innovation % of revenue</th></tr></thead><tbody>';
      for (var q = 0; q <= lastQ; q++) {
        var rr = t.results[q]; var dd = t.decisions[q];
        if (!rr) continue;
        var innovPct = rr.revenue > 0 ? (rr.rnd + rr.innovation + rr.projects) / rr.revenue * 100 : 0;
        h += '<tr><td>' + (q === 0 ? 'Q0 · last year' : 'Q' + q + (q <= ind.practiceRounds ? ' <span class="chip">P</span>' : '')) + '</td>' +
          '<td class="r">' + AS.cr(rr.rnd) + '</td><td class="r">' + AS.cr(rr.innovation) + '</td><td class="r">' + AS.cr(rr.training) + '</td>' +
          '<td class="r">' + AS.cr(rr.revenue) + '</td>' +
          '<td class="r ' + (innovPct >= 3 ? 'good' : innovPct < 1 ? 'bad' : '') + '">' + innovPct.toFixed(1) + '%</td></tr>';
      }
      h += '</tbody></table></div><p class="small muted mt">Scorecard Innovation measure reaches 100 at 5% of revenue.</p></div>';
      document.getElementById('rndBody').innerHTML = h;
    }
    draw();
    document.getElementById('rndTeam').addEventListener('change', draw);
  };

  function noResults() {
    return '<div class="card"><div class="empty">' + AS.ic('info') + '<h3>No results yet</h3><p class="muted">Reports fill in after the first round is processed.</p></div></div>';
  }
})();
