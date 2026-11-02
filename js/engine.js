/* Apex Strategy — engine.js: quarterly simulation engine (deterministic) */
'use strict';
(function () {
  var D = AS.DEFAULTS, CR = 1e7;

  /* ---------- Cost helpers ---------- */
  AS.attrLevelCost = function (scen, ai, level) {
    return scen.attrCost[ai] * Math.pow(level / 3, 1.4);
  };
  AS.matCost = function (scen, specs) {
    var m = scen.baseMat;
    for (var i = 0; i < specs.length; i++) m += AS.attrLevelCost(scen, i, specs[i]);
    return m;
  };
  AS.specExpect = function (seg, q) {
    return seg.startSpecs.map(function (l) { return l * Math.pow(1 + seg.specDrift, q); });
  };
  AS.idealPrice = function (seg, q) {
    return seg.idealPrice * Math.pow(1 + seg.priceDrift, q);
  };
  AS.economy = function (q) {
    return 1 + 0.028 * Math.sin(q * 1.05) + (q % 8 === 3 ? 0.015 : 0);
  };
  AS.economyLabel = function (q) {
    var e = AS.economy(q);
    if (e > 1.02) return 'Boom conditions';
    if (e < 0.985) return 'Soft demand';
    return 'Neutral economy';
  };
  AS.specGap = function (scen, prod, q) {
    var seg = scen.segments[prod.segment];
    var exp = AS.specExpect(seg, q);
    var gap = 0, wsum = 0;
    for (var i = 0; i < 5; i++) {
      gap += seg.specWeights[i] * (exp[i] - prod.specs[i]);
      wsum += seg.specWeights[i];
    }
    return gap / wsum; // >0 means behind expectation
  };
  AS.rndCost = function (scen, from, to) {
    var c = 0;
    for (var i = 0; i < 5; i++) {
      if (to[i] > from[i]) c += (AS.attrLevelCost(scen, i, to[i]) - AS.attrLevelCost(scen, i, from[i])) * 4500;
    }
    return c; // ₹ (project tooling cost per spec step)
  };
  AS.projectCost = function (p) {
    return (p.esg * 2 + p.quality * 1.5 + p.digital * 1.5 + (p.brandcamp ? 4 : 0)) * CR;
  };

  /* ---------- Decision helpers ---------- */
  AS.channelMix = function (ch) {
    var t = (ch.on + ch.mr + ch.gt) || 1;
    return [ch.on / t, ch.mr / t, ch.gt / t];
  };
  AS.channelTake = function (scen, ch, digitalLvl) {
    var m = AS.channelMix(ch);
    var onTake = scen.take.on * (1 - 0.09 * digitalLvl);
    return m[0] * onTake + m[1] * scen.take.mr + m[2] * scen.take.gt;
  };

  AS.validateDecision = function (team, dec, scen) {
    var errs = [], warns = [];
    var cap = scen.capacity;
    var totalProd = 0;
    Object.keys(dec.products).forEach(function (pid) {
      var d = dec.products[pid], prod = team.products.filter(function (p) { return p.id === pid; })[0];
      if (!prod) return;
      var seg = scen.segments[prod.segment];
      if (d.price < scen.priceRange[0] || d.price > scen.priceRange[1])
        errs.push(prod.name + ': price outside the allowed range (' + AS.rs(scen.priceRange[0]) + ' – ' + AS.rs(scen.priceRange[1]) + ').');
      var chs = d.channel.on + d.channel.mr + d.channel.gt;
      if (Math.abs(chs - 100) > 0.5) errs.push(prod.name + ': channel split must total 100% (now ' + chs + '%).');
      if (d.production < 0) errs.push(prod.name + ': production cannot be negative.');
      if (d.promo < 0) errs.push(prod.name + ': promotion budget cannot be negative.');
      if (d.production > 0 && d.price > seg.idealPrice * 2.2)
        warns.push(prod.name + ': price is far above the ' + seg.name + ' ideal — volume will suffer.');
      if (d.production > 0 && d.price < seg.idealPrice * 0.55)
        warns.push(prod.name + ': price is far below the ' + seg.name + ' ideal — margin will suffer.');
      totalProd += d.production;
    });
    if (totalProd > cap * 1.001) errs.push('Total production ' + AS.num(totalProd) + ' exceeds plant capacity ' + AS.num(cap) + '.');
    else if (totalProd > cap * 0.97) warns.push('Plant utilisation will be near 100% — no room for demand surprises.');
    var needW = Math.ceil(totalProd / (scen.ppw * team.productivity));
    if (dec.workforce < needW * 0.85) warns.push('Workforce (' + AS.num(dec.workforce) + ') may be too small for the schedule (about ' + AS.num(needW) + ' needed).');
    var fin = dec.finance;
    if (fin.borrowST < 0 || fin.borrowLT < 0 || fin.repayST < 0 || fin.repayLT < 0 || fin.issueShares < 0 || fin.dividendPS < 0)
      errs.push('Finance inputs cannot be negative.');
    return { errors: errs, warnings: warns, totalProd: totalProd };
  };

  /* ---------- Live projections (decide pages) ---------- */
  AS.projProduct = function (team, prod, d, scen) {
    var seg = scen.segments[prod.segment];
    var mat = AS.matCost(scen, prod.specs);
    var take = AS.channelTake(scen, d.channel, 0);
    var net = d.price * (1 - take);
    var labor = scen.wage / scen.ppw / team.productivity;
    var margin = net - mat - labor;
    return { mat: mat, net: net, labor: labor, margin: margin, pct: net > 0 ? margin / net : 0, take: take };
  };

  AS.projHr = function (team, dec, scen) {
    var W = dec.workforce, S = dec.salesforce;
    var tpe = dec.training / Math.max(1, W + S);
    var svcTarget = 0.5 + 0.45 * (1 - Math.exp(-tpe / 9000));
    var svc = Math.min(0.99, 0.55 * team.serviceLevel + 0.45 * svcTarget);
    var prod = AS.clamp(0.9, 1.8, 1 + 0.09 * (1 - Math.exp(-dec.innovation / (4 * CR))) + 0.03 * (1 - Math.exp(-tpe / 12000)) - 0.012);
    return {
      wage: W * scen.wage, salesCost: S * scen.salesFTECost, tpe: tpe,
      svc: svc, svcTarget: svcTarget, prod: prod,
      hire: Math.max(0, W - team.workforcePrev) * scen.wage * 0.25,
      fire: Math.max(0, (team.workforcePrev || W) - W) * scen.wage * 0.35
    };
  };

  /* ---------- Scorecard ---------- */
  function scorecard(r, ctx) {
    var s = {};
    s.stock = AS.clamp(0, 100, 50 + (r.stockPrice / D.startPrice - 1) * 250);
    s.profit = r.revenue > 0 ? AS.clamp(0, 100, (r.net / r.revenue) / 0.12 * 100) : 0;
    s.share = AS.clamp(0, 100, r.unitShare / ctx.fairShare * 70);
    s.service = AS.clamp(0, 100, r.serviceLevel / 0.95 * 100);
    s.util = AS.clamp(0, 100, 100 - Math.abs(r.utilization - 0.945) * 500);
    s.fulfil = r.demandUnits > 0 ? AS.clamp(0, 100, r.soldUnits / r.demandUnits * 100) : 100;
    s.improve = AS.clamp(0, 100, (r.productivity - 1) / 0.25 * 100);
    s.innov = r.revenue > 0 ? AS.clamp(0, 100, (r.rnd + r.innovation + r.projects) / r.revenue / 0.05 * 100) : 0;
    var keys = ['stock', 'profit', 'share', 'service', 'util', 'fulfil', 'improve', 'innov'];
    var sum = 0; keys.forEach(function (k) { sum += s[k]; });
    s.avg = sum / keys.length;
    return s;
  }
  AS.SCORE_META = [
    { k: 'stock', persp: 'Financial', name: 'Stock Price' },
    { k: 'profit', persp: 'Financial', name: 'Profitability' },
    { k: 'share', persp: 'Customer', name: 'Market Share' },
    { k: 'service', persp: 'Customer', name: 'Customer Service' },
    { k: 'util', persp: 'Internal Process', name: 'Plant Utilisation' },
    { k: 'fulfil', persp: 'Internal Process', name: 'Demand Fulfilment' },
    { k: 'improve', persp: 'Learning & Growth', name: 'Continuous Improvement' },
    { k: 'innov', persp: 'Learning & Growth', name: 'Innovation' }
  ];

  function coachNotes(team, r, scen, q) {
    var n = [];
    team.products.forEach(function (p) {
      var pr = r.products[p.id];
      if (pr && pr.invEnd > 20000)
        n.push(p.name + ' has ' + AS.num(pr.invEnd) + ' unsold units. Carrying stock costs ' + AS.pct(D.storageRate, 0) + ' of its value every quarter.');
      if (pr && pr.lost > 3000)
        n.push(p.name + ' lost ' + AS.num(pr.lost) + ' units to stock-outs. Schedule more production or lift the price.');
      var gap = AS.specGap(scen, p, q);
      if (gap > 0.9)
        n.push(p.name + ' specifications are behind what ' + scen.segments[p.segment].name + ' buyers expect. Review R&D.');
    });
    if (r.serviceLevel < 0.7) n.push('Customer service level is ' + AS.pct(r.serviceLevel, 0) + '. Training budget drives service, retention and brand.');
    if (r.revenue > 0 && r.net / r.revenue < 0.06) n.push('Net margin is thin (' + AS.pct(r.net / r.revenue, 1) + '). Review price, channel costs and plant loading.');
    if (r.emergency > 0) n.push('An emergency loan was drawn this quarter. It carries a punitive ' + AS.pct(D.emergencyRate * 4, 1) + ' APR — plan cash better.');
    if (r.rnd === 0) n.push('No R&D investment this quarter. Specifications age fast in this market.');
    return n.slice(0, 5);
  }

  /* ---------- Main: process one quarter for an industry ---------- */
  AS.engineProcess = function (state, industry, q) {
    var scen = AS.scenario(industry.scenario);
    var teams = state.teams.filter(function (t) { return t.industryId === industry.id; });
    var eco = AS.economy(q);
    var missing = [];

    /* per-segment market data */
    var segData = scen.segments.map(function (seg, si) {
      return { seg: seg, si: si, demand: seg.baseDemand * Math.pow(1 + seg.growth, q) * eco, ideal: AS.idealPrice(seg, q), expect: AS.specExpect(seg, q) };
    });

    /* resolve decisions (autopilot fallback) */
    var plans = teams.map(function (t) {
      var dec = t.decisions[q];
      if (!dec) { dec = AS.defaultDecision(t, scen, teams.length); missing.push(t.name); }
      return { team: t, dec: dec };
    });

    /* pre-pass: company-level states that affect demand */
    plans.forEach(function (pl) {
      var t = pl.team, dec = pl.dec;
      var hr = AS.projHr(t, dec, scen);
      pl.svc = hr.svc;
      pl.prodIdx = hr.prod;
      pl.salesFTE = dec.salesforce;
      pl.brand = AS.clamp(0.05, 1, t.brand * 0.92 + dec.projects.brandcamp * 0.09 + dec.projects.esg * 0.018 + dec.projects.quality * 0.012);
      pl.digital = dec.projects.digital;
      /* per-team schedule vs plant capacity */
      var raw = 0;
      t.products.forEach(function (p) { var d = dec.products[p.id]; if (d) raw += d.production; });
      pl.capFactor = raw > scen.capacity ? scen.capacity / raw : 1;
    });

    /* demand per product */
    var entries = []; // {pl, prod, segData, attract}
    plans.forEach(function (pl) {
      pl.team.products.forEach(function (prod) {
        var sd = segData[prod.segment];
        var seg = sd.seg;
        var d = pl.dec.products[prod.id]; if (!d) return;
        var mix = AS.channelMix(d.channel);
        var prefRaw = mix[0] * seg.chPref[0] + mix[1] * seg.chPref[1] + mix[2] * seg.chPref[2];
        var cm = 0.75 + 0.25 * (prefRaw / Math.max.apply(null, seg.chPref));
        var acc = AS.clamp(0, 1, (0.3 + 0.7 * (1 - Math.exp(-pl.salesFTE / 90))) * cm);
        var decayed = prod.awareness * 0.72;
        var promoCr = d.promo / CR;
        var build = 0.62 * (1 - decayed) * (1 - Math.exp(-promoCr / (2.4 + 1.6 * prod.segment)));
        if (pl.digital > 0) build *= (1 + 0.1 * pl.digital);
        var aw = AS.clamp(0.02, 1, decayed + build);
        var specScore = 0, wsum = 0;
        for (var i = 0; i < 5; i++) {
          specScore += seg.specWeights[i] * AS.clamp(0, 1.25, prod.specs[i] / sd.expect[i]);
          wsum += seg.specWeights[i];
        }
        specScore /= wsum;
        var priceF = AS.clamp(0, 1.15, 1.35 - 0.6 * (d.price / sd.ideal));
        var w = seg.weights;
        var attract = w.price * priceF + w.specs * specScore + w.aware * aw + w.access * acc + w.svc * pl.svc + w.brand * pl.brand;
        entries.push({ pl: pl, prod: prod, sd: sd, d: d, attract: attract, aw: aw, acc: acc, specScore: specScore, priceF: priceF });
      });
    });

    /* allocate segment demand */
    var bySeg = {};
    entries.forEach(function (e) { (bySeg[e.prod.segment] = bySeg[e.prod.segment] || []).push(e); });
    Object.keys(bySeg).forEach(function (si) {
      var list = bySeg[si], sum = 0;
      list.forEach(function (e) { e.power = Math.pow(Math.max(0.02, e.attract), 2.4); sum += e.power; });
      list.forEach(function (e) { e.demandUnits = sum > 0 ? segData[si].demand * e.power / sum : 0; });
    });

    /* production + sales per team (team schedule capped at its plant capacity) */
    var totalUnits = 0;
    plans.forEach(function (pl) { pl.soldUnits = 0; pl.demandUnits = 0; pl.lostUnits = 0; pl.revenue = 0; pl.rnd = 0; pl.invEnd = 0; pl.matCost = 0; pl.madeUnits = 0; });
    entries.forEach(function (e) {
      var pl = e.pl, t = pl.team, d = e.d;
      var maxByLabor = pl.dec.workforce * scen.ppw * pl.prodIdx;
      var scheduled = Math.min(d.production * pl.capFactor, scen.capacity);
      var made = Math.max(0, Math.min(scheduled, maxByLabor));
      if (made < scheduled) { /* labor-limited */ }
      var avail = made + e.prod.inventory;
      var sold = Math.min(e.demandUnits, avail);
      var lost = Math.max(0, e.demandUnits - sold);
      var invEnd = avail - sold;
      var take = AS.channelTake(scen, d.channel, pl.digital);
      var revenue = sold * d.price * (1 - take);
      var volDisc = AS.clamp(0, 0.08, made / 1500000);
      var matUnit = AS.matCost(scen, e.prod.specs) * (1 - volDisc);
      var matCost = made * matUnit;
      var rnd = AS.rndCost(scen, e.prod.specs, d.specsTarget);
      pl.madeUnits += made; pl.soldUnits += sold; pl.demandUnits += e.demandUnits; pl.lostUnits += lost;
      pl.revenue += revenue; pl.matCost += matCost; pl.rnd += rnd; pl.invEnd += invEnd;
      e.made = made; e.sold = sold; e.lost = lost; e.invEnd = invEnd; e.revenue = revenue; e.matUnit = matUnit; e.take = take;
      totalUnits += sold;
    });

    /* P&L, balance sheet, cash */
    var results = {};
    plans.forEach(function (pl) {
      var t = pl.team, dec = pl.dec, hr = AS.projHr(t, dec, scen);
      var labor = dec.workforce * scen.wage;
      var salesCost = dec.salesforce * scen.salesFTECost;
      var projects = AS.projectCost(dec.projects);
      var storage = 0;
      entries.forEach(function (e) { if (e.pl === pl) storage += e.invEnd * e.matUnit * D.storageRate; });
      var admin = D.adminFixedCr * CR;
      var dep = t.plantValue * D.depRate;
      var interest = t.stDebt * D.stRate + t.ltDebt * D.ltRate;
      var ebt = pl.revenue - pl.matCost - labor - salesCost - dec.training - dec.innovation - projects - storage - admin - pl.rnd - interest - dep;
      var tax = ebt > 0 ? ebt * D.taxRate : 0;
      var net = ebt - tax;

      /* cash flow: operating + depreciation + new borrowing - repayments + equity - dividends */
      var fin = dec.finance;
      var issueIn = fin.issueShares * t.stockPrice * (1 - D.equityFee);
      var divOut = fin.dividendPS * t.shares;
      var cash = t.cash + net + dep + fin.borrowST + fin.borrowLT - fin.repayST - fin.repayLT + issueIn - divOut;
      var emergency = 0;
      if (cash < 0) {
        emergency = Math.min(-cash, D.emergencyCapCr * CR);
        var emergInt = emergency * D.emergencyRate;
        ebt -= emergInt;
        tax = ebt > 0 ? ebt * D.taxRate : 0;
        net = ebt - tax;
        cash = t.cash + net + dep + fin.borrowST + fin.borrowLT - fin.repayST - fin.repayLT + issueIn - divOut + emergency;
        if (cash < 0) cash = Math.max(cash, -D.emergencyCapCr * CR); // beyond cap: insolvent
      }
      var stDebt = t.stDebt + fin.borrowST - fin.repayST;
      var ltDebt = Math.max(0, t.ltDebt + fin.borrowLT - fin.repayLT);
      var shares = t.shares + fin.issueShares;
      var equity = Math.max(1, t.plantValue + t.cash + 30 * CR - ltDebt - stDebt); // simplified book equity
      var deRatio = (stDebt + ltDebt) / equity;

      /* stock price */
      var prevNet = t.results[q - 1] ? t.results[q - 1].net : net;
      var growth = prevNet !== 0 ? (net - prevNet) / Math.abs(prevNet) : 0;
      var eps = net * 4 / shares;
      var pe = 12 + 8 * AS.clamp(growth, -0.5, 2);
      var risk = 1 - AS.clamp(0, 0.35, deRatio * 0.15 + (emergency > 0 ? 0.08 : 0) + (net < 0 ? 0.05 : 0));
      var price = Math.max(5, 0.7 * eps * pe * risk + 0.3 * t.stockPrice);

      var util = scen.capacity > 0 ? pl.madeUnits / scen.capacity : 0;
      var fairShare = 1 / plans.length;

      var r = {
        q: q, practice: q > 0 && q <= industry.practiceRounds,
        revenue: pl.revenue, matCost: pl.matCost, labor: labor, salesCost: salesCost,
        training: dec.training, innovation: dec.innovation, projects: projects, storage: storage,
        admin: admin, rnd: pl.rnd, interest: interest, dep: dep, ebt: ebt, tax: tax, net: net,
        cash: cash, stDebt: stDebt, ltDebt: ltDebt, emergency: emergency, shares: shares,
        stockPrice: price, eps: eps, pe: pe, deRatio: deRatio, roe: net * 4 / Math.max(1, equity),
        soldUnits: pl.soldUnits, demandUnits: pl.demandUnits, lostUnits: pl.lostUnits, madeUnits: pl.madeUnits,
        inventoryUnits: pl.invEnd, utilization: util,
        serviceLevel: pl.svc, productivity: pl.prodIdx, brand: pl.brand,
        unitShare: totalUnits > 0 ? pl.soldUnits / totalUnits : 0,
        demandShare: pl.demandUnits, fairShare: fairShare,
        revenueShare: 0, netMargin: pl.revenue > 0 ? net / pl.revenue : 0,
        products: {}
      };
      entries.forEach(function (e) {
        if (e.pl !== pl) return;
        r.products[e.prod.id] = {
          name: e.d.name, price: e.d.price, demand: e.demandUnits, sold: e.sold, lost: e.lost,
          invEnd: e.invEnd, revenue: e.revenue, awareness: e.aw, accessibility: e.acc,
          specScore: e.specScore, priceF: e.priceF, made: e.made
        };
      });
      results[t.id] = r;
    });

    /* revenue share + scorecard + notes */
    var revTotal = 0;
    Object.keys(results).forEach(function (tid) { revTotal += results[tid].revenue; });
    Object.keys(results).forEach(function (tid) {
      var r = results[tid];
      r.revenueShare = revTotal > 0 ? r.revenue / revTotal : 0;
      r.score = scorecard(r, { fairShare: 1 / plans.length });
    });

    /* cumulative scores */
    teams.forEach(function (t) {
      var r = results[t.id];
      var sum = 0, n = 0, sumAll = 0, nAll = 0;
      for (var i = 1; i <= q; i++) {
        var rr = i === q ? r : t.results[i];
        if (!rr) continue;
        sumAll += rr.score.avg; nAll++;
        if (i > industry.practiceRounds) { sum += rr.score.avg; n++; }
      }
      r.cumulative = n > 0 ? sum / n : (nAll > 0 ? sumAll / nAll : 0);
      r.cumulativeOfficial = n > 0;
      r.notes = coachNotes(t, r, scen, q);
    });
    var ranking = teams.slice().sort(function (a, b) {
      var ra = results[a.id].cumulative, rb = results[b.id].cumulative;
      return rb - ra || results[b.id].score.avg - results[a.id].score.avg;
    });
    ranking.forEach(function (t, i) { results[t.id].rank = i + 1; });

    /* advance persistent team state */
    teams.forEach(function (t) {
      var r = results[t.id], dec = t.decisions[q] || plans.filter(function (p) { return p.team === t; })[0].dec;
      t.results[q] = r;
      t.stockPrice = r.stockPrice;
      t.cash = r.cash; t.stDebt = r.stDebt; t.ltDebt = r.ltDebt; t.shares = r.shares;
      t.serviceLevel = r.serviceLevel; t.productivity = r.productivity; t.brand = r.brand;
      t.workforcePrev = dec.workforce;
      t.products.forEach(function (p) {
        var pe = null; entries.forEach(function (e) { if (e.prod === p) pe = e; });
        var d = dec.products[p.id];
        p.specs = d ? d.specsTarget.slice() : p.specs;
        p.age += 1;
        if (pe) { p.awareness = pe.aw; p.accessibility = pe.acc; p.inventory = pe.invEnd; }
        else p.inventory = 0;
      });
    });

    /* industry-level record */
    var news = scen.news[q % scen.news.length];
    var indResult = {
      q: q, economy: eco, ecoLabel: AS.economyLabel(q), news: news,
      demand: segData.map(function (sd) { return sd.demand; }),
      idealPrices: segData.map(function (sd) { return sd.ideal; }),
      expects: segData.map(function (sd) { return sd.expect; }),
      ranking: ranking.map(function (t) { return t.id; })
    };
    if (!industry.results) industry.results = {};
    industry.results[q] = indResult;

    return { results: results, ranking: ranking, industryResult: indResult, missing: missing, totalUnits: totalUnits };
  };

  /* ---------- Leaderboard view helper ---------- */
  AS.leaderboard = function (state, industry) {
    var teams = state.teams.filter(function (t) { return t.industryId === industry.id; });
    var lastQ = AS.lastPlayedQ(industry);
    if (lastQ == null) return teams.map(function (t, i) { return { team: t, rank: i + 1, cum: 0, last: null }; });
    return teams.map(function (t) {
      var cum = 0, n = 0, cumAll = 0, nAll = 0, last = null;
      for (var q = 1; q <= lastQ; q++) {
        var r = t.results[q]; if (!r) continue;
        last = r; cumAll += r.score.avg; nAll++;
        if (q > industry.practiceRounds) { cum += r.score.avg; n++; }
      }
      return { team: t, cum: n > 0 ? cum / n : cumAll / Math.max(1, nAll), official: n > 0, last: last };
    }).sort(function (a, b) { return b.cum - a.cum; }).map(function (x, i) { x.rank = i + 1; return x; });
  };
  AS.lastPlayedQ = function (industry) {
    var max = null;
    Object.keys(industry.results || {}).forEach(function (k) { max = max == null ? +k : Math.max(max, +k); });
    return max;   /* null = nothing played yet; 0 = baseline only */
  };
})();
