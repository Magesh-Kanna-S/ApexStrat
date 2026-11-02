/* Apex Strategy — data.js: scenario templates + seed state */
'use strict';
(function () {
  var CR = 1e7;

  /* ---------- Scenario templates ---------- */
  AS.SCENARIOS = {
    phones: {
      id: 'phones', label: 'Smartphones', unit: 'phones',
      blurb: 'Fight for share in a 5G smartphone market — Essentials, Mainstream and Premium buyers.',
      companySuffix: 'Mobile',
      productSuffix: ['Eco', 'Core', 'Ultra'],
      priceRange: [5000, 45000],
      attrs: [
        { key: 'perf', name: 'Performance' },
        { key: 'cam', name: 'Camera' },
        { key: 'batt', name: 'Battery' },
        { key: 'build', name: 'Build Quality' },
        { key: 'sw', name: 'Software' }
      ],
      segments: [
        { name: 'Essentials', baseDemand: 640000, growth: 0.004, idealPrice: 9500, priceDrift: -0.012, specDrift: 0.022,
          startSpecs: [3, 3, 3, 2, 3], specWeights: [.8, .7, 1.3, 1, .9],
          weights: { price: .38, specs: .24, aware: .12, access: .14, svc: .08, brand: .04 }, chPref: [.45, .3, .25] },
        { name: 'Mainstream', baseDemand: 640000, growth: 0.012, idealPrice: 13500, priceDrift: -0.012, specDrift: 0.028,
          startSpecs: [5, 4, 4, 4, 5], specWeights: [1, 1.1, 1, 1, 1.1],
          weights: { price: .3, specs: .28, aware: .14, access: .13, svc: .1, brand: .05 }, chPref: [.3, .4, .3] },
        { name: 'Premium', baseDemand: 320000, growth: 0.028, idealPrice: 19500, priceDrift: -0.012, specDrift: 0.035,
          startSpecs: [6, 7, 6, 6, 6], specWeights: [1.2, 1.3, .9, 1.1, 1],
          weights: { price: .24, specs: .34, aware: .14, access: .1, svc: .1, brand: .08 }, chPref: [.2, .5, .3] }
      ],
      capacity: 300000, ppw: 120, wage: 90000, salesFTECost: 85000,
      baseMat: 2200, attrCost: [750, 650, 500, 550, 350],
      take: { on: .08, mr: .16, gt: .24 },
      news: [
        { h: 'Steady market', t: 'The smartphone market closed the quarter with steady demand. Analysts expect a high-growth phase as 5G coverage reaches smaller towns.' },
        { h: 'Festive season lifts demand', t: 'Festive offers pulled buyers into stores. Mainstream segment volumes beat forecasts.' },
        { h: 'Component prices ease', t: 'Chip suppliers passed on cost savings. Efficient manufacturers can widen margins this quarter.' },
        { h: 'Premium buyers upgrade early', t: 'Trade-in schemes pushed premium upgrades. Camera and performance expectations are rising fast.' },
        { h: 'Online share keeps climbing', t: 'Quick-commerce partnerships grew online orders. Brands with strong digital shelf presence gained.' }
      ]
    },
    scooters: {
      id: 'scooters', label: 'Electric Scooters', unit: 'scooters',
      blurb: 'Electrify urban transport — Zip, City and Volt buyers wait for range and charging networks.',
      companySuffix: 'Scooters',
      productSuffix: ['Zip', 'City', 'Volt'],
      priceRange: [40000, 250000],
      attrs: [
        { key: 'motor', name: 'Motor Power' },
        { key: 'range', name: 'Range' },
        { key: 'batt', name: 'Battery Tech' },
        { key: 'build', name: 'Build Quality' },
        { key: 'conn', name: 'Connectivity' }
      ],
      segments: [
        { name: 'Zip', baseDemand: 130000, growth: 0.018, idealPrice: 78000, priceDrift: -0.01, specDrift: 0.024,
          startSpecs: [3, 4, 3, 3, 2], specWeights: [.9, 1.4, 1, 1, .6],
          weights: { price: .36, specs: .26, aware: .12, access: .14, svc: .08, brand: .04 }, chPref: [.35, .25, .4] },
        { name: 'City', baseDemand: 110000, growth: 0.024, idealPrice: 108000, priceDrift: -0.01, specDrift: 0.03,
          startSpecs: [5, 5, 4, 4, 4], specWeights: [1, 1.2, 1.1, 1, .8],
          weights: { price: .3, specs: .28, aware: .14, access: .13, svc: .09, brand: .06 }, chPref: [.2, .45, .35] },
        { name: 'Volt', baseDemand: 60000, growth: 0.038, idealPrice: 158000, priceDrift: -0.01, specDrift: 0.038,
          startSpecs: [7, 6, 6, 6, 6], specWeights: [1.3, 1.2, 1.1, 1, 1],
          weights: { price: .22, specs: .34, aware: .16, access: .1, svc: .1, brand: .08 }, chPref: [.15, .55, .3] }
      ],
      capacity: 62000, ppw: 90, wage: 88000, salesFTECost: 92000,
      baseMat: 24000, attrCost: [6300, 5500, 5500, 4600, 2100],
      take: { on: .07, mr: .15, gt: .22 },
      news: [
        { h: 'Subsidy revision announced', t: 'Purchase subsidies were revised for the next fiscal. Entry segment buyers are price-watching more than ever.' },
        { h: 'Charging network expands', t: 'Highway fast-charging corridors opened in six states. Range anxiety is easing for daily commuters.' },
        { h: 'Battery costs fall', t: 'Cell prices dropped on new chemistry. Manufacturers investing in battery tech can pass savings to buyers.' },
        { h: 'Fleet orders surge', t: 'Delivery and rental fleets placed bulk orders in the City segment. Service contracts decide the deals.' },
        { h: 'Safety norms tightened', t: 'Regulators announced stricter battery certification. Quality programs now protect brand trust.' }
      ]
    },
    appliances: {
      id: 'appliances', label: 'Home Appliances', unit: 'AC units',
      blurb: 'Cool the summer rush — Cool, Comfort and Smart AC buyers trade efficiency for price.',
      companySuffix: 'Appliances',
      productSuffix: ['Cool', 'Comfort', 'Smart'],
      priceRange: [18000, 95000],
      attrs: [
        { key: 'cool', name: 'Cooling Power' },
        { key: 'eff', name: 'Energy Efficiency' },
        { key: 'noise', name: 'Noise Control' },
        { key: 'build', name: 'Build Quality' },
        { key: 'smart', name: 'Smart Features' }
      ],
      segments: [
        { name: 'Cool', baseDemand: 120000, growth: 0.006, idealPrice: 27000, priceDrift: -0.008, specDrift: 0.018,
          startSpecs: [4, 3, 3, 3, 2], specWeights: [1.3, .9, .8, 1, .5],
          weights: { price: .4, specs: .22, aware: .12, access: .14, svc: .08, brand: .04 }, chPref: [.15, .35, .5] },
        { name: 'Comfort', baseDemand: 80000, growth: 0.015, idealPrice: 41000, priceDrift: -0.008, specDrift: 0.026,
          startSpecs: [5, 5, 5, 4, 4], specWeights: [1, 1.3, 1.1, 1, .8],
          weights: { price: .32, specs: .26, aware: .13, access: .13, svc: .1, brand: .06 }, chPref: [.2, .45, .35] },
        { name: 'Smart', baseDemand: 45000, growth: 0.032, idealPrice: 64000, priceDrift: -0.008, specDrift: 0.034,
          startSpecs: [6, 7, 6, 5, 7], specWeights: [.9, 1.2, 1, 1, 1.4],
          weights: { price: .24, specs: .32, aware: .15, access: .11, svc: .1, brand: .08 }, chPref: [.45, .45, .1] }
      ],
      capacity: 50000, ppw: 110, wage: 82000, salesFTECost: 78000,
      baseMat: 6800, attrCost: [1950, 1780, 1230, 1520, 1520],
      take: { on: .1, mr: .18, gt: .26 },
      news: [
        { h: 'Early heatwave', t: 'An early summer pushed cooling demand up across tier-1 cities. Retailers report thin shelves.' },
        { h: 'Power tariffs revised', t: 'Electricity tariffs rose in four states. Efficiency ratings now decide the Comfort segment.' },
        { h: 'Star-rating rules tighten', t: 'The energy regulator raised minimum star ratings. Older designs lose shelf eligibility next year.' },
        { h: 'Smart home bundles', t: 'Platforms began bundling ACs with smart speakers and meters. Connected features are pulling premium buyers.' },
        { h: 'Export window opens', t: 'A weak currency opened export orders. Manufacturers with spare capacity can serve both markets.' }
      ]
    }
  };

  AS.scenario = function (id) { return AS.SCENARIOS[id] || AS.SCENARIOS.phones; };

  /* ---------- Defaults ---------- */
  AS.DEFAULTS = {
    quartersTotal: 8, practiceRounds: 2, teamSizeMax: 7, teamsCount: 7,
    stRate: 0.0225,          // per quarter (9% APR)
    ltRate: 0.01875,         // per quarter (7.5% APR)
    emergencyRate: 0.05625,  // per quarter (22.5% APR)
    taxRate: 0.25,
    equityFee: 0.03,
    shares: 20000000,        // 2 crore shares
    startPrice: 640,
    storageRate: 0.04,
    adminFixedCr: 2.6,       // fixed admin cost per quarter (₹ cr)
    depRate: 0.0625,         // depreciation of plant value per quarter
    plantValueCr: 48,        // gross plant value per team (₹ cr)
    startCashCr: 40, startLtDebtCr: 60,
    emergencyCapCr: 50
  };

  /* Company display names used when seeding teams */
  AS.TEAM_SEED_NAMES = ['Astra', 'Beacon', 'Cobalt', 'Drift', 'Ember', 'Flux', 'Grove'];

  /* ---------- Decision factory ---------- */
  AS.defaultDecision = function (team, scen, teamsCount) {
    var products = {};
    var n = Math.max(2, teamsCount || 7);
    var totalProd = 0;
    team.products.forEach(function (p, i) {
      var seg = scen.segments[p.segment];
      /* autopilot: aim slightly above fair-share demand for this segment */
      var fair = seg.baseDemand / n;
      var production = Math.round(fair * 1.1 / 500) * 500;
      totalProd += production;
      products[p.id] = {
        name: p.name,
        price: Math.round(seg.idealPrice / 100) * 100,
        specsTarget: p.specs.slice(),
        channel: { on: 34, mr: 33, gt: 33 },
        promo: 2.0 * CR,                       // ₹ per quarter
        production: production
      };
    });
    /* respect plant capacity: scale the schedule down if it exceeds the plant */
    var capBudget = scen.capacity * 0.95;
    if (totalProd > capBudget && totalProd > 0) {
      var f = capBudget / totalProd;
      Object.keys(products).forEach(function (pid) {
        products[pid].production = Math.round(products[pid].production * f / 500) * 500;
      });
      totalProd = 0;
      Object.keys(products).forEach(function (pid) { totalProd += products[pid].production; });
    }
    return {
      products: products,
      workforce: Math.ceil(totalProd / scen.ppw),
      salesforce: 60,
      training: 1.0 * CR,
      innovation: 0.5 * CR,
      finance: { borrowST: 0, borrowLT: 0, repayST: 0, repayLT: 0, issueShares: 0, dividendPS: 0 },
      projects: { esg: 0, quality: 0, digital: 0, brandcamp: 0 },
      notes: '',
      updatedAt: null, updatedBy: null, submittedAt: null, submittedBy: null
    };
  };

  /* ---------- Team factory ---------- */
  AS.makeTeam = function (industryId, scenario, index) {
    var scen = AS.scenario(scenario);
    var name = AS.TEAM_SEED_NAMES[index % 7] + ' ' + scen.companySuffix;
    var team = {
      id: 'T_' + industryId + '_' + (index + 1),
      industryId: industryId,
      name: name,
      color: index % 7,
      members: [],
      shares: AS.DEFAULTS.shares,
      stockPrice: AS.DEFAULTS.startPrice,
      cash: AS.DEFAULTS.startCashCr * CR,
      stDebt: 0, ltDebt: AS.DEFAULTS.startLtDebtCr * CR,
      plantValue: AS.DEFAULTS.plantValueCr * CR,
      serviceLevel: 0.61,
      productivity: 1.0,
      brand: 0.5,
      prevStock: AS.DEFAULTS.startPrice,
      products: [],
      decisions: {},   // q -> decision
      results: {},     // q -> result
      submitted: {}    // q -> bool
    };
    scen.segments.forEach(function (seg, si) {
      team.products.push({
        id: team.id + '_P' + (si + 1),
        name: AS.TEAM_SEED_NAMES[index % 7] + ' ' + scen.productSuffix[si],
        segment: si,
        specs: seg.startSpecs.slice(),
        age: 4,
        awareness: 0.55,
        accessibility: 0.6,
        inventory: si === 0 ? 35000 : (si === 1 ? 8000 : 4000)
      });
    });
    return team;
  };

  /* ---------- Seed users ---------- */
  AS.seedUsers = function () {
    var now = AS.todayISO();
    var u = function (name, email, role, industryIds, teamIds) {
      return { id: 'U_' + email.split('@')[0], name: name, email: email, pass: AS.hash('Apex@123'), role: role,
        industryIds: industryIds || [], teamIds: teamIds || [], active: true, createdAt: now, mustChange: false };
    };
    return [
      u('Apex Admin', 'superadmin@apex.app', 'superadmin'),
      u('Ravi Kumar', 'manager@apex.app', 'manager'),
      u('Meera Nair', 'coordinator@apex.app', 'coordinator'),
      u('Arjun Das', 'player@apex.app', 'player'),
      u('Divya Rao', 'player2@apex.app', 'player')
    ];
  };
})();
