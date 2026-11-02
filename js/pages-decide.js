/* Apex Strategy — pages-decide.js: the 8 decision pages */
'use strict';
(function () {
  var UI, draft = { key: null, data: null };
  var saveTimer = null;

  /* ---------- draft helpers ---------- */
  function getDraft(team, q) {
    var key = team.id + ':' + q;
    if (draft.key !== key) {
      var src = team.decisions[q] || AS.defaultDecision(team, UI.scenario());
      draft = { key: key, data: JSON.parse(JSON.stringify(src)), teamId: team.id, q: q };
    }
    return draft.data;
  }
  function flushDraft(pageName, silent) {
    var team = UI.teamById(draft.teamId);
    if (!team || !draft.data) return;
    var q = draft.q;
    var before = JSON.stringify(team.decisions[q]);
    draft.data.updatedAt = AS.todayISO();
    draft.data.updatedBy = UI.user().name;
    if (before !== JSON.stringify(draft.data)) {
      team.decisions[q] = JSON.parse(JSON.stringify(draft.data));
      AS.store.commit('decision-edit', 'Updated ' + pageName + ' for Q' + q, { industryId: team.industryId, teamId: team.id, rerender: false });
      if (!silent) AS.toast('Saved', 'ok');
    }
  }
  function queueSave(pageName) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { flushDraft(pageName, true); }, 900);
  }

  /* ---------- shared decide page scaffold ---------- */
  function decideHead(el, pageName, extraActions) {
    var ind = UI.industry();
    var team = UI.decideTeam();
    if (!team) {
      el.innerHTML = '<div class="card"><div class="empty">' + AS.ic('info') + '<h3>No team assigned</h3><p class="muted">You need a team in this industry to enter decisions.</p></div></div>';
      return null;
    }
    var q = ind.currentQuarter;
    if (ind.phase !== 'running' || q > ind.quartersTotal) {
      el.innerHTML = AS.pageHead(pageName, team.name) + AS.lockBanner({ reason: ind.phase === 'setup' ? 'Simulation not started.' : 'Simulation finished.' });
      return null;
    }
    var lock = AS.decideLock(team);
    var dec = getDraft(team, q);
    var html = AS.pageHead(pageName, team.name + ' · Quarter ' + q + (q <= ind.practiceRounds ? ' (practice)' : ''),
      extraActions || '');
    html += AS.teamPicker();
    el.innerHTML = html + (lock.locked ? AS.lockBanner(lock) : '');
    AS.bindTeamPicker();
    el._team = team; el._q = q; el._dec = dec; el._lock = lock;
    return !lock.locked;
  }
  /* bind number input to draft path */
  function bindNum(id, path, onChange) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', function () {
      var v = parseFloat(this.value);
      if (isNaN(v)) return;
      ds(path, v);
      if (onChange) onChange();
      queueSave(el._page || 'decisions');
    });
  }
  function dg(path) {
    var parts = path.split('.'), o = draft.data;
    for (var i = 0; i < parts.length; i++) o = o[parts[i]];
    return o;
  }
  function ds(path, val) {
    var parts = path.split('.'), o = draft.data;
    for (var i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    o[parts[parts.length - 1]] = val;
  }

  /* ================= PLANNING HUB ================= */
  AS.PAGES.planning = function (el) {
    UI = AS.ui;
    var ok = decideHead(el, 'Planning Hub');
    if (!ok) return;
    var d = el._dec, team = el._team, q = el._q;
    var scen = UI.scenario();
    var html = '';
    /* deadline + submission status */
    var dl = AS.store.deadlineFor(UI.industry(), q);
    var t = AS.timeLeft(dl);
    html += '<div class="grid g3">' +
      AS.kpi('Deadline', t ? (t.over ? 'Passed' : t.text) : 'Not set', dl ? AS.fmtDate(dl) : 'ask your manager to set one', { icon: AS.ic('clock') }) +
      AS.kpi('Submission', team.submitted[q] ? 'Submitted' : 'Not submitted', team.submitted[q] ? 'you can still edit until the deadline' : 'submit from Review & Submit', { icon: AS.ic('review') }) +
      AS.kpi('Last saved', d.updatedAt ? AS.fmtDateShort(d.updatedAt) : '—', d.updatedBy ? 'by ' + AS.esc(d.updatedBy) : '', { icon: AS.ic('check') }) +
      '</div>';
    /* strategy brief */
    html += '<div class="card"><div class="card-title"><h3>Strategy brief</h3></div>' +
      '<label class="fld"><span>Objectives for this quarter (visible to your team and coordinators)</span>' +
      '<textarea id="planNotes" placeholder="e.g. Defend Essentials share, push Premium R&D before Q4, hold service above 80%...">' + AS.esc(d.notes || '') + '</textarea></label></div>';
    /* segment intents */
    html += '<div class="card"><div class="card-title"><h3>Segment intent</h3></div><p class="card-sub">Declare how you will play each segment this quarter. This is a planning aid — it does not change the simulation math.</p><div class="frow">';
    scen.segments.forEach(function (s, i) {
      var cur = (d['intent' + i]) || 'attack';
      html += '<label class="fld"><span>' + s.name + '</span><select data-intent="' + i + '">' +
        '<option value="attack"' + (cur === 'attack' ? ' selected' : '') + '>Attack — invest to win share</option>' +
        '<option value="defend"' + (cur === 'defend' ? ' selected' : '') + '>Defend — hold position</option>' +
        '<option value="harvest"' + (cur === 'harvest' ? ' selected' : '') + '>Harvest — maximise cash</option>' +
        '</select></label>';
    });
    html += '</div></div>';
    /* checklist */
    html += '<div class="card"><div class="card-title"><h3>Decision checklist — Q' + q + '</h3></div>';
    var pages = [['design', 'Product Design'], ['marketing', 'Marketing Mix'], ['operations', 'Operations'], ['manpower', 'Manpower'], ['finance', 'Finance'], ['projects', 'Special Projects']];
    pages.forEach(function (p) {
      html += '<div class="check">' + AS.ic('play') + '<div style="flex:1"><b>' + p[1] + '</b></div><a class="btn btn-text btn-sm" href="#/' + p[0] + '">Open</a></div>';
    });
    html += '<div class="check">' + AS.ic('review') + '<div style="flex:1"><b>Review &amp; Submit</b></div><a class="btn btn-tonal btn-sm" href="#/review">Submit</a></div></div>';
    el.insertAdjacentHTML('beforeend', html);

    document.getElementById('planNotes').addEventListener('input', function () {
      d.notes = this.value; queueSave('Planning Hub');
    });
    el.querySelectorAll('[data-intent]').forEach(function (s) {
      s.addEventListener('change', function () { d['intent' + this.dataset.intent] = this.value; queueSave('Planning Hub'); });
    });
  };

  /* ================= PRODUCT DESIGN ================= */
  AS.PAGES.design = function (el) {
    UI = AS.ui;
    var ok = decideHead(el, 'Product Design', '<button class="btn btn-outline btn-sm" id="resetSpecs">Reset targets to current</button>');
    if (!ok) return;
    var d = el._dec, team = el._team, q = el._q, scen = UI.scenario();
    var html = '<p class="muted" style="margin-bottom:14px">Set price, target specifications and channel split per product. R&amp;D projects take effect from next quarter. Material cost uses <b>current</b> specifications.</p>';
    html += '<div class="grid g3" id="designGrid">';
    team.products.forEach(function (p) {
      var pd = d.products[p.id];
      var seg = scen.segments[p.segment];
      html += '<div class="prodcard" data-prod="' + p.id + '">' +
        '<div class="prodhead"><h4><input class="input" style="width:150px;height:34px;font-weight:600" data-f="name" value="' + AS.esc(pd.name) + '"></h4>' +
        '<div class="spacer" style="flex:1"></div><span class="chip">' + seg.name + '</span></div>' +
        '<label class="fld fld-num"><span>Price (₹)</span><input type="number" min="' + scen.priceRange[0] + '" max="' + scen.priceRange[1] + '" step="100" data-f="price" value="' + pd.price + '"></label>' +
        '<p class="small muted" style="margin:2px 0 8px">Segment ideal price: <b>' + AS.rs(AS.idealPrice(seg, q)) + '</b></p>' +
        '<table class="tbl" style="margin-bottom:10px"><thead><tr><th>Spec</th><th class="r">Now</th><th class="r">Target</th></tr></thead><tbody>';
      scen.attrs.forEach(function (a, ai) {
        html += '<tr><td>' + a.name + '</td><td class="r muted">' + p.specs[ai].toFixed(0) + '</td>' +
          '<td class="r"><input type="number" min="1" max="10" step="1" style="width:64px;text-align:right" data-spec="' + ai + '" value="' + pd.specsTarget[ai] + '"></td></tr>';
      });
      html += '</tbody></table>';
      html += '<label class="fld"><span>Channel split (%) — must total 100</span>' +
        '<div class="frow" style="gap:8px">' +
        ['on:Online', 'mr:Modern retail', 'gt:General trade'].map(function (x) {
          var k = x.split(':')[0], lbl = x.split(':')[1];
          return '<label class="fld" style="margin:0"><span style="font-weight:500">' + lbl + '</span><input type="number" min="0" max="100" data-ch="' + k + '" value="' + pd.channel[k] + '"></label>';
        }).join('') + '</div></label>';
      html += '<div class="calc" data-calc="' + p.id + '"></div></div>';
    });
    html += '</div>';
    el.insertAdjacentHTML('beforeend', html);

    function recalcCard(pid) {
      var p = team.products.filter(function (x) { return x.id === pid; })[0];
      var pd = d.products[pid];
      var proj = AS.projProduct(team, p, pd, scen);
      var rnd = AS.rndCost(scen, p.specs, pd.specsTarget);
      var box = el.querySelector('[data-calc="' + pid + '"]');
      var chs = pd.channel.on + pd.channel.mr + pd.channel.gt;
      box.innerHTML =
        '<div><span>Material</span><b>' + AS.rs(proj.mat) + '</b></div>' +
        '<div><span>Channel cost</span><b>' + AS.pct(proj.take, 1) + '</b></div>' +
        '<div><span>Net price</span><b>' + AS.rs(proj.net) + '</b></div>' +
        '<div><span>Margin / unit</span><b class="' + (proj.margin < 0 ? 'bad' : 'good') + '">' + AS.rs(proj.margin) + '</b></div>' +
        '<div><span>Gross margin</span><b class="' + (proj.pct < 0.1 ? 'bad' : '') + '">' + AS.pct(proj.pct, 1) + '</b></div>' +
        '<div><span>R&amp;D project</span><b>' + (rnd > 0 ? AS.cr(rnd) : '—') + '</b></div>' +
        (Math.abs(chs - 100) > 0.5 ? '<div style="grid-column:1/-1"><span class="chip chip-red">Channel split is ' + chs + '% — must total 100%</span></div>' : '');
    }
    function recalcAll() { team.products.forEach(function (p) { recalcCard(p.id); }); }

    el.querySelectorAll('[data-prod]').forEach(function (card) {
      var pid = card.dataset.prod;
      card.addEventListener('input', function (e) {
        var t = e.target;
        if (t.dataset.f === 'name') d.products[pid].name = t.value;
        else if (t.dataset.f === 'price') d.products[pid].price = parseFloat(t.value) || 0;
        else if (t.dataset.spec !== undefined) d.products[pid].specsTarget[+t.dataset.spec] = AS.clamp(1, 10, parseFloat(t.value) || 1);
        else if (t.dataset.ch) d.products[pid].channel[t.dataset.ch] = AS.clamp(0, 100, parseFloat(t.value) || 0);
        recalcCard(pid);
        queueSave('Product Design');
      });
    });
    var rs = document.getElementById('resetSpecs');
    if (rs) rs.addEventListener('click', function () {
      team.products.forEach(function (p) { d.products[p.id].specsTarget = p.specs.slice(); });
      AS.PAGES.design(el); AS.toast('Targets reset to current specs', 'ok');
    });
    recalcAll();
  };

  /* ================= MARKETING MIX ================= */
  AS.PAGES.marketing = function (el) {
    UI = AS.ui;
    var ok = decideHead(el, 'Marketing Mix');
    if (!ok) return;
    var d = el._dec, team = el._team, q = el._q, scen = UI.scenario();
    var html = '<p class="muted" style="margin-bottom:14px">Promotion builds <b>awareness</b> (it decays every quarter — keep spending to stay visible). Distribution access comes from your sales force (Manpower page) and channel split (Product Design).</p>';
    html += '<div class="card"><div class="card-title"><h3>Promotion budget per product</h3></div>';
    html += '<div class="tblwrap"><table class="tbl"><thead><tr><th>Product</th><th>Segment</th><th class="r" style="width:160px">Budget (₹ cr / quarter)</th><th class="r">Awareness now</th><th class="r">Projected after spend</th></tr></thead><tbody>';
    team.products.forEach(function (p) {
      var pd = d.products[p.id];
      var decayed = p.awareness * 0.72;
      var build = 0.62 * (1 - decayed) * (1 - Math.exp(-(pd.promo / AS.CR) / (2.4 + 1.6 * p.segment)));
      var proj = Math.min(1, decayed + build);
      html += '<tr><td><b>' + AS.esc(pd.name) + '</b></td><td>' + scen.segments[p.segment].name + '</td>' +
        '<td class="r"><input type="number" min="0" step="0.1" style="width:120px;text-align:right" data-promo="' + p.id + '" value="' + (pd.promo / AS.CR).toFixed(1) + '"></td>' +
        '<td class="r">' + AS.pct(p.awareness, 0) + '</td>' +
        '<td class="r" data-aw="' + p.id + '"><b>' + AS.pct(proj, 0) + '</b></td></tr>';
    });
    html += '</tbody></table></div><div class="callout blue mt">' + AS.ic('info') + '<div>Guide: ₹2–3 cr per product keeps awareness roughly stable; ₹6+ cr pushes a product towards full market visibility. Premium products need more.</div></div></div>';
    html += '<div class="card" id="mmTotal"></div>';
    el.insertAdjacentHTML('beforeend', html);

    function recalc() {
      var tot = 0;
      team.products.forEach(function (p) {
        var pd = d.products[p.id];
        tot += pd.promo;
        var decayed = p.awareness * 0.72;
        var build = 0.62 * (1 - decayed) * (1 - Math.exp(-(pd.promo / AS.CR) / (2.4 + 1.6 * p.segment)));
        document.querySelector('[data-aw="' + p.id + '"]').innerHTML = '<b>' + AS.pct(Math.min(1, decayed + build), 0) + '</b>';
      });
      document.getElementById('mmTotal').innerHTML = '<div class="card-title"><h3>Total marketing spend</h3></div>' +
        '<div class="grid g3">' +
        AS.kpi('Promotion total', AS.cr(tot), 'per quarter', { icon: AS.ic('marketing') }) +
        AS.kpi('Sales force', AS.num(d.salesforce) + ' FTE', 'set on Manpower page', { icon: AS.ic('people') }) +
        AS.kpi('Channel costs', 'per Product Design', 'online / retail / trade mix', { icon: AS.ic('product') }) +
        '</div>';
    }
    el.addEventListener('input', function (e) {
      var t = e.target;
      if (t.dataset.promo) d.products[t.dataset.promo].promo = Math.max(0, parseFloat(t.value) || 0) * AS.CR;
      recalc(); queueSave('Marketing Mix');
    });
    recalc();
  };

  /* ================= OPERATIONS ================= */
  AS.PAGES.operations = function (el) {
    UI = AS.ui;
    var ok = decideHead(el, 'Operations');
    if (!ok) return;
    var d = el._dec, team = el._team, q = el._q, scen = UI.scenario();
    var ind = UI.industry();
    var lastQ = UI.lastQ();
    var cap = scen.capacity;
    var html = '<div class="card"><div class="card-title"><h3>Production schedule — Q' + q + '</h3></div>' +
      '<div class="tblwrap"><table class="tbl"><thead><tr><th>Product</th><th>Segment</th><th class="r">Opening stock</th><th class="r">Last demand</th><th class="r" style="width:150px">Schedule (units)</th><th class="r">Available</th><th class="r">Est. demand</th><th class="r">Risk</th></tr></thead><tbody>';
    team.products.forEach(function (p) {
      var pd = d.products[p.id];
      var lastDem = lastQ && team.results[lastQ] && team.results[lastQ].products[p.id] ? team.results[lastQ].products[p.id].demand : 0;
      var seg = scen.segments[p.segment];
      var estDem = lastDem > 0 ? lastDem : (seg.baseDemand / Math.max(1, AS.store.state.teams.filter(function (t) { return t.industryId === ind.id; }).length) * 0.9);
      var avail = pd.production + p.inventory;
      var risk = avail < estDem * 0.85 ? 'stock-out' : avail > estDem * 1.35 ? 'overstock' : 'ok';
      html += '<tr><td><b>' + AS.esc(pd.name) + '</b></td><td>' + seg.name + '</td>' +
        '<td class="r">' + AS.num(p.inventory) + '</td><td class="r muted">' + AS.num(lastDem) + '</td>' +
        '<td class="r"><input type="number" min="0" step="1000" style="width:120px;text-align:right" data-prod-sch="' + p.id + '" value="' + pd.production + '"></td>' +
        '<td class="r" data-avail="' + p.id + '">' + AS.num(avail) + '</td>' +
        '<td class="r muted">' + AS.num(Math.round(estDem)) + '</td>' +
        '<td class="r"><span class="chip ' + (risk === 'stock-out' ? 'chip-red' : risk === 'overstock' ? 'chip-yellow' : 'chip-green') + '" data-risk="' + p.id + '">' + risk + '</span></td></tr>';
    });
    html += '</tbody></table></div></div>';
    html += '<div id="opsSummary"></div>';
    el.insertAdjacentHTML('beforeend', html);

    function recalc() {
      var tot = 0;
      team.products.forEach(function (p) { tot += d.products[p.id].production; });
      var workersNeed = Math.ceil(tot / (scen.ppw * team.productivity));
      var byLabor = d.workforce * scen.ppw * team.productivity;
      document.getElementById('opsSummary').innerHTML = '<div class="grid g4">' +
        AS.kpi('Plant capacity', AS.num(cap) + ' ' + scen.unit, 'per quarter', {}) +
        AS.kpi('Scheduled', AS.num(tot) + ' ' + scen.unit, AS.pct(tot / cap, 1) + ' utilisation', { pct: tot / cap * 100, color: tot > cap ? 'var(--c-red-btn)' : 'var(--c-green-btn)' }) +
        AS.kpi('Workers needed', AS.num(workersNeed), 'have ' + AS.num(d.workforce) + ' (Manpower page)', { cls: d.workforce < workersNeed ? 'bad' : '' }) +
        AS.kpi('Labor capacity', AS.num(Math.round(byLabor)) + ' ' + scen.unit, 'with current workforce & productivity', {}) +
        '</div>' +
        (tot > cap ? '<div class="callout red">' + AS.ic('warn') + '<div><b>Over capacity.</b> The schedule exceeds the plant — production will be capped at ' + AS.num(cap) + ' units.</div></div>' : '') +
        (d.workforce < workersNeed ? '<div class="callout yellow">' + AS.ic('warn') + '<div><b>Not enough workers.</b> Production is also limited by workforce × ' + scen.ppw + ' units per worker. Raise the workforce on the Manpower page.</div></div>' : '') +
        '<p class="small muted mt">Unsold stock carries a ' + AS.pct(AS.DEFAULTS.storageRate, 0) + ' per quarter holding cost. Opening stock is sold first.</p>';
      /* per-row avail + risk */
      team.products.forEach(function (p) {
        var pd = d.products[p.id];
        document.querySelector('[data-avail="' + p.id + '"]').textContent = AS.num(pd.production + p.inventory);
        var lastDem = lastQ && team.results[lastQ] && team.results[lastQ].products[p.id] ? team.results[lastQ].products[p.id].demand : 0;
        var estDem = lastDem > 0 ? lastDem : scen.segments[p.segment].baseDemand / 7;
        var avail = pd.production + p.inventory;
        var risk = avail < estDem * 0.85 ? 'stock-out' : avail > estDem * 1.35 ? 'overstock' : 'ok';
        var chip = document.querySelector('[data-risk="' + p.id + '"]');
        chip.textContent = risk;
        chip.className = 'chip ' + (risk === 'stock-out' ? 'chip-red' : risk === 'overstock' ? 'chip-yellow' : 'chip-green');
      });
    }
    el.addEventListener('input', function (e) {
      var t = e.target;
      if (t.dataset.prodSch) d.products[t.dataset.prodSch].production = Math.max(0, parseFloat(t.value) || 0);
      recalc(); queueSave('Operations');
    });
    recalc();
  };

  /* ================= MANPOWER ================= */
  AS.PAGES.manpower = function (el) {
    UI = AS.ui;
    var ok = decideHead(el, 'Manpower');
    if (!ok) return;
    var d = el._dec, team = el._team, scen = UI.scenario();
    var html = '<div class="grid g32">';
    html += '<div class="card"><div class="card-title"><h3>Workforce & programs</h3></div>' +
      '<label class="fld fld-num"><span>Production workforce (headcount)</span><input type="number" min="0" step="10" id="hrW" value="' + d.workforce + '"><span class="hint">Each worker assembles ~' + Math.round(scen.ppw * team.productivity) + ' ' + scen.unit + ' per quarter</span></label>' +
      '<label class="fld fld-num"><span>Sales force (FTE)</span><input type="number" min="0" step="5" id="hrS" value="' + d.salesforce + '"><span class="hint">Drives store access and availability for all products</span></label>' +
      '<label class="fld fld-num"><span>Training budget (₹ cr / quarter)</span><input type="number" min="0" step="0.1" id="hrT" value="' + (d.training / AS.CR).toFixed(1) + '"><span class="hint">Drives customer service level</span></label>' +
      '<label class="fld fld-num"><span>Innovation budget (₹ cr / quarter)</span><input type="number" min="0" step="0.1" id="hrI" value="' + (d.innovation / AS.CR).toFixed(1) + '"><span class="hint">Raises productivity, counts towards the Innovation score</span></label></div>';
    html += '<div class="card"><div class="card-title"><h3>Projections</h3></div><div id="hrProj"></div></div>';
    html += '</div>';
    el.insertAdjacentHTML('beforeend', html);

    function recalc() {
      var hr = AS.projHr(team, d, scen);
      document.getElementById('hrProj').innerHTML =
        AS.scorebar('Projected service level', hr.svc * 100, 'now ' + AS.pct(team.serviceLevel, 0) + ' · full marks at 95%') +
        AS.scorebar('Projected productivity index', (hr.prod - 0.9) / 0.9 * 100, hr.prod.toFixed(3) + ' (1.00 at start, 1.25 = full marks)') +
        '<div class="grid g3 mt">' +
        AS.kpi('Wage bill', AS.cr(hr.wage), d.workforce + ' workers × ' + AS.rs(scen.wage), {}) +
        AS.kpi('Sales force cost', AS.cr(hr.salesCost), d.salesforce + ' FTE × ' + AS.rs(scen.salesFTECost), {}) +
        AS.kpi('Hiring / severance', AS.cr(hr.hire + hr.fire), hr.hire > 0 ? 'hiring ' + AS.cr(hr.hire) : hr.fire > 0 ? 'severance ' + AS.cr(hr.fire) : 'no change', {}) +
        '</div>' +
        '<p class="small muted mt">Training spend per employee: ' + AS.rs(hr.tpe) + '. Service improves with diminishing returns — roughly ' + AS.rs(9000) + ' per employee reaches a strong level.</p>';
    }
    ['hrW', 'hrS', 'hrT', 'hrI'].forEach(function (id) {
      document.getElementById(id).addEventListener('input', function () {
        var v = Math.max(0, parseFloat(this.value) || 0);
        if (id === 'hrW') d.workforce = Math.round(v);
        if (id === 'hrS') d.salesforce = Math.round(v);
        if (id === 'hrT') d.training = v * AS.CR;
        if (id === 'hrI') d.innovation = v * AS.CR;
        recalc(); queueSave('Manpower');
      });
    });
    recalc();
  };

  /* ================= FINANCE ================= */
  AS.PAGES.finance = function (el) {
    UI = AS.ui;
    var ok = decideHead(el, 'Finance');
    if (!ok) return;
    var d = el._dec, team = el._team, q = el._q;
    var D = AS.DEFAULTS;
    var html = '<div class="grid g4">' +
      AS.kpi('Cash', AS.cr(team.cash), 'end of last quarter', { cls: team.cash < 0 ? 'bad' : '' }) +
      AS.kpi('Short-term debt', AS.cr(team.stDebt), AS.pct(D.stRate * 4, 1) + ' APR', {}) +
      AS.kpi('Long-term debt', AS.cr(team.ltDebt), AS.pct(D.ltRate * 4, 1) + ' APR', {}) +
      AS.kpi('Share price', AS.rs(team.stockPrice), AS.num(team.shares) + ' shares', {}) +
      '</div>';
    html += '<div class="grid g32 mt">';
    html += '<div class="card"><div class="card-title"><h3>Financing decisions</h3></div>' +
      '<div class="frow">' +
      '<label class="fld fld-num"><span>Borrow short-term (₹ cr)</span><input type="number" min="0" step="1" id="fBst" value="' + (d.finance.borrowST / AS.CR).toFixed(0) + '"></label>' +
      '<label class="fld fld-num"><span>Repay short-term (₹ cr)</span><input type="number" min="0" step="1" id="fRst" value="' + (d.finance.repayST / AS.CR).toFixed(0) + '"></label>' +
      '<label class="fld fld-num"><span>Borrow long-term (₹ cr)</span><input type="number" min="0" step="1" id="fBlt" value="' + (d.finance.borrowLT / AS.CR).toFixed(0) + '"></label>' +
      '<label class="fld fld-num"><span>Repay long-term (₹ cr)</span><input type="number" min="0" step="1" id="fRlt" value="' + (d.finance.repayLT / AS.CR).toFixed(0) + '"></label>' +
      '<label class="fld fld-num"><span>Issue new shares (lakh)</span><input type="number" min="0" step="1" id="fIss" value="' + (d.finance.issueShares / 1e5).toFixed(0) + '"><span class="hint">' + AS.pct(D.equityFee, 0) + ' issue fee · dilutes EPS</span></label>' +
      '<label class="fld fld-num"><span>Dividend per share (₹)</span><input type="number" min="0" step="0.5" id="fDiv" value="' + d.finance.dividendPS + '"></label>' +
      '</div></div>';
    html += '<div class="card"><div class="card-title"><h3>Projection for this quarter</h3></div><div id="finProj"></div></div>';
    html += '</div>';
    el.insertAdjacentHTML('beforeend', html);

    function recalc() {
      var f = d.finance;
      var lastR = team.results[UI.lastQ()];
      var estNet = lastR ? lastR.net : 20 * AS.CR;
      var issueIn = f.issueShares * team.stockPrice * (1 - D.equityFee);
      var divOut = f.dividendPS * team.shares;
      var projCash = team.cash + estNet + team.plantValue * D.depRate + f.borrowST + f.borrowLT - f.repayST - f.repayLT + issueIn - divOut;
      var st = team.stDebt + f.borrowST - f.repayST;
      var lt = Math.max(0, team.ltDebt + f.borrowLT - f.repayLT);
      var equity = Math.max(1, team.plantValue + team.cash + 30 * AS.CR - lt - st);
      document.getElementById('finProj').innerHTML =
        '<div class="grid g2">' +
        AS.kpi('Projected cash (est.)', AS.cr(projCash), 'assumes profit ≈ last quarter (' + AS.cr(estNet) + ')', { cls: projCash < 0 ? 'bad' : '' }) +
        AS.kpi('Projected D/E', ((st + lt) / equity).toFixed(2), 'lower is safer — risk discount hits the share price', {}) +
        '</div>' +
        (projCash < 0 ? '<div class="callout red mt">' + AS.ic('warn') + '<div><b>Negative cash projected.</b> The bank auto-issues an emergency loan at ' + AS.pct(D.emergencyRate * 4, 1) + ' APR (up to ₹' + D.emergencyCapCr + ' cr) — plan borrowings or dividends instead.</div></div>' : '') +
        (f.issueShares > 0 ? '<div class="callout yellow mt">' + AS.ic('info') + '<div>Issuing ' + AS.num(f.issueShares) + ' shares raises about ' + AS.cr(issueIn) + ' and dilutes ownership by ' + AS.pct(f.issueShares / (team.shares + f.issueShares), 1) + '.</div></div>' : '');
    }
    ['fBst', 'fRst', 'fBlt', 'fRlt', 'fIss', 'fDiv'].forEach(function (id) {
      document.getElementById(id).addEventListener('input', function () {
        var v = Math.max(0, parseFloat(this.value) || 0);
        if (id === 'fBst') d.finance.borrowST = v * AS.CR;
        if (id === 'fRst') d.finance.repayST = v * AS.CR;
        if (id === 'fBlt') d.finance.borrowLT = v * AS.CR;
        if (id === 'fRlt') d.finance.repayLT = v * AS.CR;
        if (id === 'fIss') d.finance.issueShares = v * 1e5;
        if (id === 'fDiv') d.finance.dividendPS = v;
        recalc(); queueSave('Finance');
      });
    });
    recalc();
  };

  /* ================= SPECIAL PROJECTS ================= */
  AS.PAGES.projects = function (el) {
    UI = AS.ui;
    var ok = decideHead(el, 'Special Projects');
    if (!ok) return;
    var d = el._dec, team = el._team;
    var defs = [
      { k: 'esg', name: 'ESG & Sustainability', max: 3, cost: 2, eff: 'Brand image +2 points per level. Adds to the Innovation score.' },
      { k: 'quality', name: 'Quality Certification', max: 3, cost: 1.5, eff: 'Fewer returns and complaints — lifts customer service and brand slightly.' },
      { k: 'digital', name: 'Digital Transformation', max: 3, cost: 1.5, eff: 'Cuts the online channel fee by 0.9 points per level and boosts promotion efficiency +10% per level.' },
      { k: 'brandcamp', name: 'Brand Campaign', max: 1, cost: 4, eff: 'One-off +9 points of brand image this quarter. Runs while switched on.' }
    ];
    var html = '<p class="muted" style="margin-bottom:14px">Programs run quarter-by-quarter — you pay every quarter they stay switched on. Levels carry over when you re-enter the same decision next quarter.</p><div class="grid g2">';
    defs.forEach(function (p) {
      var cur = d.projects[p.k] || 0;
      html += '<div class="card"><div class="card-title"><h3>' + p.name + '</h3><div class="spacer"></div>' +
        '<span class="chip chip-purple" data-cost="' + p.k + '">' + AS.cr(cur * p.cost * AS.CR) + ' / qtr</span></div>' +
        '<p class="card-sub">' + p.eff + '</p><div class="seg" data-proj="' + p.k + '">';
      for (var l = 0; l <= p.max; l++)
        html += '<button data-lvl="' + l + '"' + (l === cur ? ' class="on"' : '') + '>' + (p.k === 'brandcamp' ? (l ? 'Run' : 'Off') : (l === 0 ? 'Off' : 'L' + l)) + '</button>';
      html += '</div></div>';
    });
    html += '</div><div class="card" id="projTotal"></div>';
    el.insertAdjacentHTML('beforeend', html);

    function recalc() {
      var tot = AS.projectCost(d.projects);
      document.getElementById('projTotal').innerHTML = '<div class="card-title"><h3>Total project spend</h3></div>' +
        AS.kpi('Per quarter', AS.cr(tot), 'charged in the quarter being processed', { icon: AS.ic('projects') }) +
        '<p class="small muted mt">Remember to set the level again next quarter — a new quarter starts from the previous quarter\'s levels.</p>';
    }
    el.querySelectorAll('[data-proj]').forEach(function (seg) {
      seg.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        var k = seg.dataset.proj, lvl = +b.dataset.lvl;
        d.projects[k] = lvl;
        seg.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
        document.querySelector('[data-cost="' + k + '"]').textContent = AS.cr(lvl * defs.filter(function (p) { return p.k === k; })[0].cost * AS.CR) + ' / qtr';
        recalc(); queueSave('Special Projects');
      });
    });
    recalc();
  };

  /* ================= REVIEW & SUBMIT ================= */
  AS.PAGES.review = function (el) {
    UI = AS.ui;
    var ind = UI.industry();
    var ok = decideHead(el, 'Review & Submit');
    if (!ok) {
      /* still show summary when locked */
      var teamL = UI.decideTeam();
      if (teamL && ind.phase === 'running') {
        flushDraft('Review & Submit', true);
        var dL = teamL.decisions[ind.currentQuarter];
        if (dL) el.insertAdjacentHTML('beforeend', summaryHTML(teamL, dL, ind) + submittedBanner(teamL, ind, true));
      }
      return;
    }
    var d = el._dec, team = el._team, q = el._q, scen = UI.scenario();
    var html = summaryHTML(team, d, ind);
    /* validation */
    var v = AS.validateDecision(team, d, scen);
    if (v.errors.length) {
      html += '<div class="card"><div class="card-title"><h3 class="bad">Errors — fix before submitting</h3></div>';
      v.errors.forEach(function (e) { html += '<div class="check">' + AS.ic('x') + '<div>' + AS.esc(e) + '</div></div>'; });
      html += '</div>';
    }
    if (v.warnings.length) {
      html += '<div class="card"><div class="card-title"><h3 class="warn">Warnings</h3></div>';
      v.warnings.forEach(function (w) { html += '<div class="check">' + AS.ic('warn') + '<div>' + AS.esc(w) + '</div></div>'; });
      html += '</div>';
    }
    html += submittedBanner(team, ind, AS.store.isLocked(ind, q));
    el.insertAdjacentHTML('beforeend', html);

    var btn = document.getElementById('submitBtn');
    if (btn) btn.addEventListener('click', function () {
      if (v.errors.length) { AS.toast('Fix the errors first', 'err'); return; }
      flushDraft('Review & Submit', true);
      team.decisions[q] = JSON.parse(JSON.stringify(draft.data));
      team.decisions[q].submittedAt = AS.todayISO();
      team.decisions[q].submittedBy = UI.user().name;
      team.submitted[q] = true;
      AS.store.commit('decision-submit', 'Submitted decisions for Q' + q, { industryId: ind.id, teamId: team.id });
      AS.toast('Decisions submitted for Q' + q, 'ok');
    });
    var ub = document.getElementById('unsubmitBtn');
    if (ub) ub.addEventListener('click', function () {
      team.submitted[q] = false;
      draft.data.submittedAt = null; draft.data.submittedBy = null;
      team.decisions[q].submittedAt = null; team.decisions[q].submittedBy = null;
      AS.store.commit('decision-unsubmit', 'Withdrew submission for Q' + q, { industryId: ind.id, teamId: team.id });
      AS.toast('Submission withdrawn — you can edit again', 'ok');
    });
  };

  function submittedBanner(team, ind, locked) {
    var q = ind.currentQuarter;
    if (team.submitted[q]) {
      var d = team.decisions[q];
      return '<div class="callout green">' + AS.ic('check') + '<div><b>Submitted for Q' + q + '</b> — ' +
        (d && d.submittedAt ? AS.fmtDate(d.submittedAt) + ' by ' + AS.esc(d.submittedBy || '') : '') +
        (locked ? '. The deadline has passed — decisions are locked.' : '. You can edit and resubmit until the deadline.') + '</div></div>';
    }
    if (locked) return '<div class="callout yellow">' + AS.ic('lock') + '<div><b>Not submitted.</b> The deadline passed — your last saved decisions (or autopilot defaults) will be used.</div></div>';
    return '<div class="btn-row"><button class="btn btn-green" id="submitBtn">' + AS.ic('check') + ' Submit decisions for Q' + q + '</button></div>';
  }

  function summaryHTML(team, d, ind) {
    var scen = UI.scenario();
    var html = '<div class="card"><div class="card-title"><h3>Decision summary — ' + AS.esc(team.name) + ', Q' + ind.currentQuarter + '</h3></div>';
    html += '<div class="tblwrap"><table class="tbl"><thead><tr><th>Product</th><th class="r">Price</th><th class="r">Spec targets</th><th class="r">Channel on/mr/gt</th><th class="r">Promo</th><th class="r">Schedule</th></tr></thead><tbody>';
    team.products.forEach(function (p) {
      var pd = d.products[p.id]; if (!pd) return;
      html += '<tr><td><b>' + AS.esc(pd.name) + '</b><br><span class="muted small">now: ' + p.specs.join('/') + '</span></td>' +
        '<td class="r">' + AS.rs(pd.price) + '</td>' +
        '<td class="r">' + pd.specsTarget.join('/') + '</td>' +
        '<td class="r">' + pd.channel.on + '/' + pd.channel.mr + '/' + pd.channel.gt + '</td>' +
        '<td class="r">' + AS.cr(pd.promo) + '</td>' +
        '<td class="r">' + AS.num(pd.production) + '</td></tr>';
    });
    html += '</tbody></table></div>';
    html += '<div class="grid g4 mt">' +
      AS.kpi('Workforce', AS.num(d.workforce), 'workers', {}) +
      AS.kpi('Sales force', AS.num(d.salesforce), 'FTE', {}) +
      AS.kpi('Training', AS.cr(d.training), 'per quarter', {}) +
      AS.kpi('Innovation', AS.cr(d.innovation), 'per quarter', {}) +
      '</div>';
    var f = d.finance;
    html += '<div class="grid g4 mt">' +
      AS.kpi('Borrow ST / LT', (f.borrowST / AS.CR).toFixed(0) + ' / ' + (f.borrowLT / AS.CR).toFixed(0) + ' cr', 'repay ' + (f.repayST / AS.CR).toFixed(0) + ' / ' + (f.repayLT / AS.CR).toFixed(0) + ' cr', {}) +
      AS.kpi('New shares', AS.num(f.issueShares), f.issueShares ? 'raises ~' + AS.cr(f.issueShares * team.stockPrice * 0.97) : '—', {}) +
      AS.kpi('Dividend / share', AS.rs(f.dividendPS), f.dividendPS ? 'total ' + AS.cr(f.dividendPS * team.shares) : '—', {}) +
      AS.kpi('Projects', ['esg', 'quality', 'digital', 'brandcamp'].map(function (k) { return k.slice(0, 1).toUpperCase() + d.projects[k]; }).join(' · '), 'E·Q·D·B levels', {}) +
      '</div>';
    html += (d.notes ? '<div class="callout blue mt">' + AS.ic('plan') + '<div><b>Strategy notes:</b> ' + AS.esc(d.notes) + '</div></div>' : '') + '</div>';
    return html;
  }
})();
