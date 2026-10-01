(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const SVGNS = 'http://www.w3.org/2000/svg';

  const CHAINS = {

    base:     { name: 'Base',        blockS: 2.0,  minPushS: 0.2,  tip: 0.001,   baseFee: 0.005,     native: 2500,  blob: 0,    enterprise: true,  regimeMult: [0.8, 1.0, 1.15] },

    ethereum: { name: 'Ethereum L1', blockS: 12.0, minPushS: 12.0, tip: 0.5,     baseFee: 0.187,     native: 2500,  blob: 0,    enterprise: true,  regimeMult: [0.7, 1.0, 2.0] },
    arbitrum: { name: 'Arbitrum',    blockS: 0.25, minPushS: 0.25, tip: 0.0005,  baseFee: 0.02,      native: 2500,  blob: 0.40, enterprise: true,  regimeMult: [1.0, 1.0, 1.0] },
    optimism: { name: 'Optimism',    blockS: 2.0,  minPushS: 1.0,  tip: 0.00001, baseFee: 0.000005,  native: 2500,  blob: 0.15, enterprise: true,  regimeMult: [0.7, 1.0, 7.1] },
    polygon:  { name: 'Polygon',     blockS: 1.5,  minPushS: 0.75, tip: 35.6,    baseFee: 0.414,     native: 0.077, blob: 0,    enterprise: true,  regimeMult: [0.8, 1.0, 1.2] },
    hyperevm: { name: 'HyperEVM',    blockS: 1.0,  minPushS: 1.0,  tip: 0.075,   baseFee: 0.1,       native: 69,    blob: 0,    enterprise: true,  regimeMult: [0.8, 1.0, 1.2] },

    robinhood:{ name: 'Robinhood',   blockS: 0.25, minPushS: 0.25, tip: 0.005,   baseFee: 0.029,     native: 2500,  blob: 0,    enterprise: true,  regimeMult: [0.7, 1.0, 2.2] },
  };

  const SIGMA_MULT = [0.6, 1.0, 1.15];

  const TIP_MULT = [0.8, 1.0, 1.2];
  const REGIME_NAMES = ['calm', 'median', 'volatile'];

  const CLASSES = {
    stables: { vmax: 100e6, sigma: 40,  tv: 1700, nsat: 10000,
      flow: { mL: 0.7, mR: -0.05, vh: 10e6, c: 0 },
      mtm:  { mL: 0.3, mR: -0.05, vh: 10e6, c: 0 } },
    majors:  { vmax: 50e6,  sigma: 260, tv: 24600, nsat: 815e3,
      flow: { mL: 1.1, mR: 0.2,  vh: 7e6,  c: 0 },
      mtm:  { mL: 1.5, mR: 0.1,  vh: 7e6,  c: 0 } },

    alts:    { vmax: 20e6,  sigma: 410, tv: 66000, nsat: 326e3,
      flow: { mL: 13,  mR: 0,    vh: 1e6,  c: 0.7 },
      mtm:  { mL: 10,  mR: -0.5, vh: 1e6,  c: 0 } },

    volatile: { vmax: 20e6, sigma: 2640, tv: 25000, nsat: 16200, tolDef: 17.5, mtmOnly: true,
      regimes: [ { nsat: 6100,  tv: 13900, sigma: 1950 },
                 { nsat: 16200, tv: 25000, sigma: 2640 },
                 { nsat: 32800, tv: 37700, sigma: 4420 } ],

      flow: { mL: 11,   mR: -3,   vh: 10e6,   c: 0 },
      mtm:  { mL: 11,   mR: -3,   vh: 10e6,   c: 0 } },
  };

  const APP_GAS = {
    0: { key: 'no APP',     gasPerTx: n => 0 },
    1: { key: 'pyth',       gasPerTx: n => 50800 + 10300 * n },
    2: { key: 'chainlink',  gasPerTx: n => 55000 + 61300 * n },
  };

  const sourceGas = () => 28500 + 6940 * state.fp;

  const totalFeeds = () => state.fp * state.fpp;
  const stackGasPerTx = () => (state.compressedOn ? sourceGas(totalFeeds()) : 0) + APP_GAS[state.app].gasPerTx(totalFeeds());
  const stackName = () => {
    const parts = [];
    if (state.compressedOn) parts.push('custom PP');
    if (state.app > 0) parts.push(APP_GAS[state.app].key);
    return parts.length ? parts.join(' + ') : 'no pusher';
  };

  const trim = n => (n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)).replace(/\.0+$|(\.\d*[1-9])0+$/, '$1');
  const fmtUsd = v => {
    const sign = v < 0 ? '−' : '';
    const a = Math.abs(v);
    if (a >= 1e9) return sign + '$' + trim(a / 1e9) + 'B';
    if (a >= 1e6) return sign + '$' + trim(a / 1e6) + 'M';
    if (a >= 1e3) return sign + '$' + trim(a / 1e3) + 'K';
    if (a >= 1) return sign + '$' + a.toFixed(0);
    if (a >= 0.005) return sign + '$' + a.toFixed(2);
    return a > 0 ? '<$0.01' : '$0';
  };
  const fmt2sig = v => {
    if (v === 0) return '$0';
    const a = Math.abs(v);
    const p = Math.pow(10, Math.floor(Math.log10(a)) - 1);
    return fmtUsd(Math.round(a / p) * p * Math.sign(v));
  };
  const fmtBp = v => (v < 0 ? '−' : '') + (Math.abs(v) >= 10 ? Math.abs(v).toFixed(1) : Math.abs(v).toFixed(2)) + ' bp';
  const fmtGwei = v => {
    if (v >= 10) return v.toFixed(0) + ' gwei';
    if (v >= 0.1) return v.toFixed(3).replace(/0+$/, '').replace(/\.$/, '') + ' gwei';
    return v.toPrecision(2).replace(/0+$/, '').replace(/\.$/, '') + ' gwei';
  };
  const fmtK = v => v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'k' : v.toFixed(0);

  const state = {
    chain: 'base', pclass: 'majors', regime: 1, basis: 'mtm', logScale: false,
    tolPos: 66.67, appTolPos: 66.67, mL: 1.1, mR: 0.2, vhPos: 46.13, vcurFrac: 0.254,
    compressedOn: true, app: 1, protPct: 15, ownPct: 10, ownerIsLp: false, fpp: 2,
    swapCond: false, scshPos: 50,
    fp: 1, c: 0, baseFee: 0.005, native: 2500,
  };

  const logMap = (pos, lo, hi) => Math.exp(Math.log(lo) + (Math.log(hi) - Math.log(lo)) * pos / 100);
  const logPos = (v, lo, hi) => 100 * (Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo));
  const TOL_LO = 0.01, TOL_HI = 30;
  const IVL_LO = 0.1, IVL_HI = 300;
  const SH_LO = 0.1, SH_HI = 100;

  const SWAP_SHARE = { stables: 37.7, majors: 35.3, alts: 21.0 };

  const vhFromPos = pos => Math.pow(10, 5 + 4 * pos / 100);
  const posFromVh = vh => 100 * (Math.log10(vh) - 5) / 4;

  function params() {
    const ch = CHAINS[state.chain];
    const cl = CLASSES[state.pclass];

    const tip = ch.tip * TIP_MULT[state.regime];
    const d = logMap(state.tolPos, TOL_LO, TOL_HI);

    const rc = cl.regimes ? cl.regimes[state.regime] : null;
    const sigma = rc ? rc.sigma : cl.sigma * SIGMA_MULT[state.regime];
    const gasPerTx = stackGasPerTx();
    const compGasTx = state.compressedOn ? sourceGas(totalFeeds()) : 0;
    const appGasTx = APP_GAS[state.app].gasPerTx(totalFeeds());

    const tvEff = rc ? rc.tv : cl.tv * (sigma / cl.sigma);
    const nsat = rc ? rc.nsat : cl.nsat;
    const trigN = x => 1 / (1 / nsat + x / tvEff + (x * x) / (sigma * sigma));
    const nDev = trigN(d);

    const capN = 86400 / ch.minPushS;
    const capFn = x => 1 / (1 / x + 1 / capN);
    let pushesPerDay = capFn(nDev);
    let pushMode = tvEff / d < Math.pow(sigma / d, 2) ? 'path-limited' : 'deviation-driven';
    if (nDev > capN) pushMode = 'slot-limited';
    const interval = 86400 / pushesPerDay;

    const dApp = logMap(state.appTolPos, TOL_LO, TOL_HI);
    const pushesApp = capFn(trigN(dApp));
    const intervalApp = 86400 / pushesApp;

    const protFrac = state.protPct / 100;
    const ownerFrac = state.ownerIsLp ? 1 - protFrac : state.ownPct / 100;
    const lpFrac = Math.max(0, 1 - protFrac - ownerFrac);

    const priceGwei = state.baseFee * ch.regimeMult[state.regime] + tip;

    const paidShare = (state.swapCond && state.chain === 'ethereum') ? logMap(state.scshPos, SH_LO, SH_HI) / 100 : 1;
    const unitUsd = priceGwei * 1e-9 * state.native * (1 + ch.blob) / state.fp;
    const gasLineComp = compGasTx * pushesPerDay * paidShare * unitUsd;
    const gasLineApp = appGasTx * pushesApp * paidShare * unitUsd;
    const gasLine = gasLineComp + gasLineApp;
    const totalCost = gasLine;
    const vhEff = vhFromPos(state.vhPos);
    return { ch, cl, tip, d, sigma, interval, nDev, gasPerTx, pushesPerDay, pushMode, priceGwei, gasLine, totalCost, protFrac, ownerFrac, lpFrac, vhEff, vmax: cl.vmax,
             dApp, pushesApp, intervalApp, compGasTx, appGasTx, gasLineComp, gasLineApp, paidShare };
  }
  const marginBp = (V, p) => state.mL + (state.mR - state.mL) * V / (V + p.vhEff) - state.c;
  const gross = (V, p) => marginBp(V, p) * V / 10000;
  const ownerRev = (V, p) => gross(V, p) * p.ownerFrac;
  const ownerNet = (V, p) => ownerRev(V, p) - p.totalCost;
  const net = (V, p) => gross(V, p) - p.totalCost;

  const mrBp = (V, p) => marginBp(V, p) + V * (state.mR - state.mL) * p.vhEff / Math.pow(V + p.vhEff, 2);

  function breakEvens(p) {
    if (p.ownerFrac <= 0) return [];
    const effCost = p.totalCost / p.ownerFrac;
    const a = state.mR - state.c;
    const b = (state.mL - state.c) * p.vhEff - 10000 * effCost;
    const q = -10000 * effCost * p.vhEff;
    let roots = [];
    if (Math.abs(a) < 1e-9) {
      if (Math.abs(b) > 1e-9) roots = [-q / b];
    } else {
      const disc = b * b - 4 * a * q;
      if (disc >= 0) {
        const sq = Math.sqrt(disc);
        roots = [(-b + sq) / (2 * a), (-b - sq) / (2 * a)];
      }
    }
    return roots.filter(v => v > 0 && v <= p.vmax && Math.abs(ownerNet(v, p)) < p.totalCost * 0.01 + 1)
                .sort((x, y) => x - y);
  }

  function el(name, attrs, parent) {
    const e = document.createElementNS(SVGNS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function niceCeil(x) {
    if (x <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(x)));
    const f = x / p;
    const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return nf * p;
  }
  const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const LOG_MIN = 1e5;

  function attachHover(svg, geo, seriesList, p) {
    const hover = el('g', { style: 'display:none' }, svg);
    const cross = el('line', { y1: geo.top, y2: geo.top + geo.ih, stroke: 'var(--baseline)', 'stroke-width': 1 }, hover);
    const hdots = seriesList.map(s => s.dot === false ? null : el('circle', { r: 5, fill: s.color, stroke: 'var(--surface-1)', 'stroke-width': 2 }, hover));
    const hit = el('rect', { x: geo.left, y: geo.top, width: geo.iw, height: geo.ih, fill: 'transparent' }, svg);
    const tooltip = $('tooltip');
    hit.addEventListener('pointermove', ev => {
      const r = svg.getBoundingClientRect();
      const sx = (ev.clientX - r.left) * (geo.w / r.width);
      const frac = Math.max(0, Math.min(1, (sx - geo.left) / geo.iw));
      const V = geo.vAt(frac);
      const x = geo.xOf(V);
      hover.style.display = '';
      cross.setAttribute('x1', x); cross.setAttribute('x2', x);
      $('ttX').textContent = 'V = ' + fmtUsd(V) + '  ·  margin ' + fmtBp(marginBp(V, p));
      const rows = $('ttRows');
      rows.textContent = '';
      seriesList.forEach((s, si) => {
        const yv = s.fn(V);
        if (hdots[si]) { hdots[si].setAttribute('cx', x); hdots[si].setAttribute('cy', geo.yOf(yv)); }
        const row = document.createElement('div');
        row.className = 'tt-row';
        const key = document.createElement('span');
        key.className = 'tt-key';
        key.style.borderTopColor = typeof s.tooltipColor === 'function' ? s.tooltipColor(yv) : s.color;
        const v = document.createElement('span');
        v.className = 'tt-val'; v.textContent = s.fmt(yv);
        const n = document.createElement('span');
        n.className = 'tt-name'; n.textContent = s.name;
        row.appendChild(key); row.appendChild(v); row.appendChild(n);
        rows.appendChild(row);
      });
      tooltip.style.display = 'block';
      const pad = 14;
      let tx = ev.clientX + pad, ty = ev.clientY + pad;
      if (tx + tooltip.offsetWidth > window.innerWidth - 8) tx = ev.clientX - tooltip.offsetWidth - pad;
      if (ty + tooltip.offsetHeight > window.innerHeight - 8) ty = ev.clientY - tooltip.offsetHeight - pad;
      tooltip.style.left = tx + 'px'; tooltip.style.top = ty + 'px';
    });
    hit.addEventListener('pointerleave', () => {
      hover.style.display = 'none'; tooltip.style.display = 'none';
    });
  }

  function renderMain(p, bes) {
    const svg = $('chart');
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const MG = { top: 18, right: 30, bottom: 36, left: 64 };
    const W = 920, H = 380;
    const IW = W - MG.left - MG.right, IH = H - MG.top - MG.bottom;
    const N = 300;
    const log = state.logScale;
    const xOf = V => log
      ? MG.left + IW * (Math.log10(Math.max(V, LOG_MIN)) - 5) / (Math.log10(p.vmax) - 5)
      : MG.left + IW * (V / p.vmax);
    const vAt = frac => log
      ? Math.pow(10, 5 + (Math.log10(p.vmax) - 5) * frac)
      : p.vmax * frac;

    const pts = [];
    const gpts = [];
    for (let i = 0; i <= N; i++) {
      const V = vAt(i / N);
      pts.push([V, ownerRev(V, p)]);
      gpts.push([V, gross(V, p)]);
    }
    const ys = pts.map(q => q[1]).concat([p.totalCost]);
    const dataMax = Math.max(...ys), dataMin = Math.min(...ys);
    const span = Math.max(dataMax, 0) - Math.min(dataMin, 0);
    const step = niceCeil(span * 1.1 / 4) || 1;
    const tickMin = Math.floor(Math.min(dataMin, 0) / step) * step;
    const tickMax = Math.ceil(Math.max(dataMax * 1.05, step) / step) * step;
    const yOf = y => MG.top + IH * (1 - (y - tickMin) / (tickMax - tickMin));

    for (let yv = tickMin; yv <= tickMax + step / 2; yv += step) {
      const y = yOf(yv);
      const isZero = Math.abs(yv) < step / 1e6;
      el('line', { x1: MG.left, x2: MG.left + IW, y1: y, y2: y,
        stroke: isZero ? 'var(--baseline)' : 'var(--grid)', 'stroke-width': 1 }, svg);
      const t = el('text', { x: MG.left - 8, y: y + 4, 'text-anchor': 'end', class: 'tick' }, svg);
      t.textContent = fmtUsd(isZero ? 0 : yv);
    }
    const xAxisY = MG.top + IH;
    if (log) {
      for (let d = 5; Math.pow(10, d) <= p.vmax * 1.01; d++) {
        const x = xOf(Math.pow(10, d));
        el('line', { x1: x, x2: x, y1: xAxisY, y2: xAxisY + 5, stroke: 'var(--baseline)', 'stroke-width': 1 }, svg);
        const t = el('text', { x: x, y: xAxisY + 20, 'text-anchor': 'middle', class: 'tick' }, svg);
        t.textContent = fmtUsd(Math.pow(10, d));
      }
    } else {
      for (let g = 0; g <= 5; g++) {
        const xv = p.vmax * g / 5;
        const x = xOf(Math.max(xv, 0.0001));
        el('line', { x1: x, x2: x, y1: xAxisY, y2: xAxisY + 5, stroke: 'var(--baseline)', 'stroke-width': 1 }, svg);
        const t = el('text', { x: x, y: xAxisY + 20, 'text-anchor': 'middle', class: 'tick' }, svg);
        t.textContent = fmtUsd(xv);
      }
    }
    el('line', { x1: MG.left, x2: MG.left + IW, y1: xAxisY, y2: xAxisY, stroke: 'var(--baseline)', 'stroke-width': 1 }, svg);
    const xt = el('text', { x: MG.left + IW / 2, y: H - 2, 'text-anchor': 'middle', class: 'tick' }, svg);
    xt.textContent = 'Daily volume V' + (log ? ' (log scale)' : '');

    const yCost = yOf(p.totalCost);
    let runStart = null, runSign = null;
    const flush = endIdx => {
      if (runStart === null || endIdx <= runStart) { runStart = null; return; }
      const seg = pts.slice(runStart, endIdx + 1);
      let d = '';
      seg.forEach((q, i) => { d += (i ? 'L' : 'M') + xOf(q[0]).toFixed(2) + ',' + yOf(q[1]).toFixed(2); });
      d += 'L' + xOf(seg[seg.length - 1][0]).toFixed(2) + ',' + yCost.toFixed(2);
      d += 'L' + xOf(seg[0][0]).toFixed(2) + ',' + yCost.toFixed(2) + 'Z';
      el('path', { d: d, fill: runSign > 0 ? 'var(--wash-good)' : 'var(--wash-bad)', stroke: 'none' }, svg);
      runStart = null;
    };
    for (let i = 0; i <= N; i++) {
      const sign = pts[i][1] - p.totalCost >= 0 ? 1 : -1;
      if (runStart === null) { runStart = i; runSign = sign; continue; }
      if (sign !== runSign) {
        const [v1, y1] = pts[i - 1], [v2, y2] = pts[i];
        const cv = v1 + (v2 - v1) * (p.totalCost - y1) / (y2 - y1);
        pts.splice(i, 0, [cv, p.totalCost]);
        flush(i);
        runStart = i; runSign = sign;
        i++;
      }
    }
    flush(pts.length - 1);

    el('line', { x1: MG.left, x2: MG.left + IW, y1: yCost, y2: yCost,
      stroke: 'var(--cost)', 'stroke-width': 2, 'stroke-dasharray': '7 5' }, svg);
    const clbl = el('text', { x: MG.left + IW - 4, y: yCost - 7, 'text-anchor': 'end', class: 'dlabel' }, svg);
    clbl.textContent = 'cost ' + fmtUsd(p.totalCost) + '/day';

    const exitIdx = -1;

    let d = '';
    pts.forEach((q, i) => { d += (i ? 'L' : 'M') + xOf(q[0]).toFixed(2) + ',' + yOf(q[1]).toFixed(2); });
    el('path', { d: d, fill: 'none', stroke: 'var(--series-rev)', 'stroke-width': 2,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);

    const beY0 = MG.top + (exitIdx > 0 ? 26 : 12);
    bes.forEach((v, i) => {
      const x = xOf(v);
      el('line', { x1: x, x2: x, y1: MG.top, y2: MG.top + IH, stroke: 'var(--baseline)', 'stroke-width': 1 }, svg);
      el('circle', { cx: x, cy: yCost, r: 5, fill: 'var(--cost)', stroke: 'var(--surface-1)', 'stroke-width': 2 }, svg);
      const anchorEnd = x > MG.left + IW - 130;
      const t = el('text', { x: x + (anchorEnd ? -6 : 6), y: beY0 + i * 14,
        'text-anchor': anchorEnd ? 'end' : 'start', class: 'dlabel' }, svg);
      t.textContent = 'owner break-even ' + fmt2sig(v) + '/day';
    });

    const vc = state.vcurFrac * p.vmax;
    if (!log || vc >= LOG_MIN) {
      const x = xOf(vc), y = yOf(ownerRev(vc, p));
      el('line', { x1: x, x2: x, y1: MG.top, y2: MG.top + IH, stroke: 'var(--grid)', 'stroke-width': 1 }, svg);
      el('circle', { cx: x, cy: y, r: 6, fill: 'var(--series-rev)', stroke: 'var(--surface-1)', 'stroke-width': 2 }, svg);
      const nv = ownerNet(vc, p);
      const anchorEnd = x > MG.left + IW - 130;
      const lbl = el('text', { x: x + (anchorEnd ? -10 : 10), y: Math.max(y - 10, MG.top + 26), class: 'dlabel' }, svg);
      if (anchorEnd) lbl.setAttribute('text-anchor', 'end');
      lbl.textContent = 'owner net ' + fmtUsd(nv) + '/day';
    }

    attachHover(svg, { top: MG.top, left: MG.left, iw: IW, ih: IH, w: W, xOf, yOf, vAt }, [
      { name: 'gross P&L', color: cssVar('--text-muted'), dot: false, fn: V => gross(V, p), fmt: v => fmtUsd(v) + '/day' },
      { name: 'protocol', color: cssVar('--text-muted'), dot: false, fn: V => gross(V, p) * p.protFrac, fmt: v => fmtUsd(v) + '/day' },
      { name: 'LPs', color: cssVar('--series-margin'), dot: false, fn: V => gross(V, p) * p.lpFrac, fmt: v => fmtUsd(v) + '/day' },
      { name: 'owner revenue', color: cssVar('--series-rev'), fn: V => ownerRev(V, p), fmt: v => fmtUsd(v) + '/day' },
      { name: 'cost stack', color: cssVar('--cost'), dot: false, fn: () => p.totalCost, fmt: v => fmtUsd(v) + '/day' },
      { name: 'owner net', color: cssVar('--good'), dot: false, tooltipColor: v => v >= 0 ? cssVar('--good') : cssVar('--bad'),
        fn: V => ownerNet(V, p), fmt: v => fmtUsd(v) + '/day' },
    ], p);
  }

  function renderSmall(svgId, fn, color, p, fmtVal, zeroCross) {
    const svg = $(svgId);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const MG = { top: 16, right: 24, bottom: 34, left: 56 };
    const W = 560, H = 300;
    const IW = W - MG.left - MG.right, IH = H - MG.top - MG.bottom;
    const N = 160;
    const xOf = V => MG.left + IW * (V / p.vmax);
    const vAt = frac => p.vmax * frac;

    const pts = [];
    for (let i = 0; i <= N; i++) pts.push([vAt(i / N), fn(vAt(i / N))]);
    const ys = pts.map(q => q[1]);
    const dataMax = Math.max(...ys), dataMin = Math.min(...ys);
    const span = Math.max(dataMax, 0) - Math.min(dataMin, 0);
    const step = niceCeil(span * 1.1 / 4) || 1;
    const tickMin = Math.floor(Math.min(dataMin, 0) / step) * step;
    const tickMax = Math.ceil(Math.max(dataMax * 1.05, step) / step) * step;
    const yOf = y => MG.top + IH * (1 - (y - tickMin) / (tickMax - tickMin));

    for (let yv = tickMin; yv <= tickMax + step / 2; yv += step) {
      const y = yOf(yv);
      const isZero = Math.abs(yv) < step / 1e6;
      el('line', { x1: MG.left, x2: MG.left + IW, y1: y, y2: y,
        stroke: isZero ? 'var(--baseline)' : 'var(--grid)', 'stroke-width': 1 }, svg);
      const t = el('text', { x: MG.left - 8, y: y + 4, 'text-anchor': 'end', class: 'tick' }, svg);
      t.textContent = fmtVal(isZero ? 0 : yv);
    }
    const xAxisY = MG.top + IH;
    for (let g = 0; g <= 4; g++) {
      const xv = p.vmax * g / 4;
      const x = xOf(xv);
      el('line', { x1: x, x2: x, y1: xAxisY, y2: xAxisY + 5, stroke: 'var(--baseline)', 'stroke-width': 1 }, svg);
      const t = el('text', { x: x, y: xAxisY + 20, 'text-anchor': 'middle', class: 'tick' }, svg);
      t.textContent = fmtUsd(xv);
    }
    el('line', { x1: MG.left, x2: MG.left + IW, y1: xAxisY, y2: xAxisY, stroke: 'var(--baseline)', 'stroke-width': 1 }, svg);
    const xt = el('text', { x: MG.left + IW / 2, y: H - 2, 'text-anchor': 'middle', class: 'tick' }, svg);
    xt.textContent = 'Daily volume V';

    if (zeroCross) {
      let vz = null;
      if (pts[0][1] <= 0) vz = 0;
      else for (let i = 1; i <= N; i++) {
        if (pts[i][1] <= 0) {
          const [v1, y1] = pts[i - 1], [v2, y2] = pts[i];
          vz = v1 + (v2 - v1) * y1 / (y1 - y2);
          break;
        }
      }
      if (vz !== null && vz < p.vmax) {
        const xz = xOf(vz);
        el('rect', { x: xz, y: MG.top, width: MG.left + IW - xz, height: IH, fill: 'var(--wash-bad)' }, svg);
        el('line', { x1: xz, x2: xz, y1: MG.top, y2: MG.top + IH, stroke: 'var(--baseline)', 'stroke-width': 1 }, svg);
        const anchorEnd = xz > MG.left + IW - 110;
        const zt = el('text', { x: xz + (anchorEnd ? -4 : 4), y: MG.top + 12,
          'text-anchor': anchorEnd ? 'end' : 'start', class: 'tick' }, svg);
        zt.textContent = '0 at ' + fmt2sig(vz);
      }
    }

    let d = '';
    pts.forEach((q, i) => { d += (i ? 'L' : 'M') + xOf(q[0]).toFixed(2) + ',' + yOf(q[1]).toFixed(2); });
    el('path', { d: d, fill: 'none', stroke: color, 'stroke-width': 2,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);

    const vc = state.vcurFrac * p.vmax;
    const cx = xOf(vc), cy = yOf(fn(vc));
    el('circle', { cx: cx, cy: cy, r: 6, fill: color, stroke: 'var(--surface-1)', 'stroke-width': 2 }, svg);
    const anchorEnd = cx > MG.left + IW - 80;
    const lbl = el('text', { x: cx + (anchorEnd ? -10 : 10), y: Math.max(cy - 10, MG.top + 24), class: 'dlabel' }, svg);
    if (anchorEnd) lbl.setAttribute('text-anchor', 'end');
    lbl.textContent = fmtVal(fn(vc));

    attachHover(svg, { top: MG.top, left: MG.left, iw: IW, ih: IH, w: W, xOf, yOf, vAt },
      [{ name: svgId === 'marChart' ? 'net margin' : 'marginal revenue', color: color, fn: fn, fmt: fmtVal }], p);
  }

  const setText = (id, txt) => { $(id).textContent = txt; };

  function applyBasisDefaults() {

    const b = CLASSES[state.pclass][state.basis];
    state.mL = b.mL; state.mR = b.mR; state.vhPos = posFromVh(b.vh); state.c = b.c;
    $('ml').value = b.mL; $('mr').value = b.mR; $('vhalf').value = state.vhPos;
  }
  function applyClassDefaults() {
    const cl = CLASSES[state.pclass];

    $('bs0').disabled = !!cl.mtmOnly;
    if (cl.mtmOnly && state.basis !== 'mtm') setBasis('mtm');
    applyBasisDefaults();

    const dDef = Math.max(TOL_LO, Math.min(TOL_HI, cl.tolDef || cl.flow.mL / 2));
    state.tolPos = logPos(dDef, TOL_LO, TOL_HI);
    $('tol').value = state.tolPos;
    state.appTolPos = state.tolPos;
    $('apptol').value = state.appTolPos;
    state.scshPos = logPos(SWAP_SHARE[state.pclass], SH_LO, SH_HI);
    $('scsh').value = state.scshPos;
  }
  function applyChainDefaults() {
    const ch = CHAINS[state.chain];
    state.baseFee = ch.baseFee; state.native = ch.native;
    $('basefee').value = ch.baseFee; $('native').value = ch.native;

    const ok = ch.enterprise;
    $('ap1').disabled = !ok; $('ap2').disabled = !ok;
    if (!ok && state.app !== 0) setApp(0);
  }
  function setRegime(r) {
    state.regime = r;
    [0, 1, 2].forEach(i => $('reg' + i).setAttribute('aria-pressed', i === r));
    update();
  }
  function setCo(on) {
    state.compressedOn = on;
    $('co1').setAttribute('aria-pressed', on);
    $('co0').setAttribute('aria-pressed', !on);
    update();
  }
  function setApp(a) {
    state.app = a;
    [0, 1, 2].forEach(i => $('ap' + i).setAttribute('aria-pressed', i === a));
    $('apptol').disabled = a === 0;
    update();
  }
  function setSwapCond(on) {
    state.swapCond = on;
    $('sc1').setAttribute('aria-pressed', on);
    $('sc0').setAttribute('aria-pressed', !on);
    update();
  }
  function setFpp(k) {
    state.fpp = k;
    $('fpp1').setAttribute('aria-pressed', k === 1);
    $('fpp2').setAttribute('aria-pressed', k === 2);
    update();
  }
  function setOwnerLp(on) {
    state.ownerIsLp = on;
    $('ol1').setAttribute('aria-pressed', on);
    $('ol0').setAttribute('aria-pressed', !on);
    $('own').disabled = on;
    update();
  }
  function setBasis(bs) {
    if (CLASSES[state.pclass].mtmOnly) bs = 'mtm';
    state.basis = bs;
    $('bs0').setAttribute('aria-pressed', bs === 'flow');
    $('bs1').setAttribute('aria-pressed', bs === 'mtm');
    applyBasisDefaults();
    update();
  }
  function setScale(log) {
    state.logScale = log;
    $('scaleLin').setAttribute('aria-pressed', !log);
    $('scaleLog').setAttribute('aria-pressed', log);
    update();
  }

  function update() {
    state.tolPos = +$('tol').value;
    state.appTolPos = +$('apptol').value;

    state.protPct = +$('prot').value;
    state.ownPct = +$('own').value;
    state.mL = +$('ml').value;
    state.mR = +$('mr').value;
    state.vhPos = +$('vhalf').value;
    state.vcurFrac = +$('vcur').value / 1000;
    state.fp = +$('fp').value;
    state.scshPos = +$('scsh').value;

    const fppOk = state.app !== 0;
    $('fpp1').disabled = !fppOk; $('fpp2').disabled = !fppOk;
    const scOk = state.chain === 'ethereum';
    if (!scOk && state.swapCond) { state.swapCond = false; $('sc1').setAttribute('aria-pressed', false); $('sc0').setAttribute('aria-pressed', true); }
    $('sc0').disabled = !scOk; $('sc1').disabled = !scOk;
    $('scsh').disabled = !scOk || !state.swapCond;

    state.baseFee = Math.max(0, +$('basefee').value || 0);
    state.native = Math.max(0, +$('native').value || 0);

    const p = params();
    const chR = CHAINS[state.chain];
    $('regHelp').dataset.tip = 'What kind of day you are provisioning for: calm = a quiet day (~25% of days), median = typical, volatile = a busy day (~25%).\n'
      + 'One dial moves three things: the base fee (' + chR.name + ': x' + chR.regimeMult[0].toFixed(1) + ' / x1.0 / x' + chR.regimeMult[2].toFixed(1) + '), '
      + (CLASSES[state.pclass].regimes
          ? 'the push trigger curve (this class has its own measured calm / median / volatile day - mostly trade tempo, ~x0.4 / x1 / x2)'
          : 'the asset vol (x0.6 / x1 / x1.15)')
      + ', and the priority tip (x0.8 / x1.0 / x1.2).';

    const fmtIvl = s => s >= 1 ? (s >= 60 ? (s / 60).toFixed(1) + ' min' : s.toFixed(1) + ' s') : (s * 1000).toFixed(0) + ' ms';
    setText('tolOut', (p.d >= 0.1 ? p.d.toFixed(2) : p.d.toFixed(3)) + ' bp · ~every ' + fmtIvl(p.interval));

    const dDefended = p.cl.tolDef || p.cl.flow.mL / 2;

    const staleBlocks = p.interval / CHAINS[state.chain].blockS;
    $('tolWarn').classList.toggle('on', p.d > 1.5 * dDefended && staleBlocks > 3);
    $('apptol').disabled = state.app === 0;
    setText('apptolOut', state.app === 0 ? 'no APP' : (p.dApp >= 0.1 ? p.dApp.toFixed(2) : p.dApp.toFixed(3)) + ' bp · ~every ' + fmtIvl(p.intervalApp));
    setText('protOut', state.protPct + '% of gross');
    setText('ownOut', state.ownerIsLp ? (p.ownerFrac * 100).toFixed(0) + '% of gross (all but protocol)' : state.ownPct + '% of gross');
    setText('lpOut', state.ownerIsLp ? '0% - owner is the LP' : (p.lpFrac * 100).toFixed(0) + '% of gross');
    setText('mlOut', state.mL.toFixed(1) + ' bp');
    setText('mrOut', (state.mR < 0 ? '−' : '') + Math.abs(state.mR).toFixed(Math.abs(state.mR) < 1 ? 2 : 1) + ' bp');
    setText('vhalfOut', fmtUsd(vhFromPos(state.vhPos)));
    setText('vcurOut', fmtUsd(state.vcurFrac * p.vmax));
    setText('fpOut', state.app === 0
      ? state.fp + (state.fp > 1 ? ' pools · gas ÷ ' + state.fp : ' pool')
      : state.fp + (state.fp > 1 ? ' pools · ' + totalFeeds() + ' feeds · gas ÷ ' + state.fp : ' pool · ' + totalFeeds() + (state.fpp > 1 ? ' feeds' : ' feed')));
    setText('scshOut', state.chain !== 'ethereum' ? 'Ethereum only'
      : !state.swapCond ? 'off'
      : logMap(state.scshPos, SH_LO, SH_HI).toFixed(1) + '% of pushes paid');

    const ro = $('gasReadout');
    ro.textContent = '';
    const terms = [];
    const scTag = p.paidShare < 1 ? ' paid (swap-cond.)' : '';
    const capTag = p.pushMode === 'slot-limited' ? ' (~block rate)' : '';
    const sameRate = p.compGasTx > 0 && p.appGasTx > 0 && Math.abs(p.pushesPerDay - p.pushesApp) < 0.02 * p.pushesPerDay;
    if (sameRate) {
      terms.push('(custom PP ' + fmtK(p.compGasTx) + ' + ' + APP_GAS[state.app].key + ' ' + fmtK(p.appGasTx) + ' gas) × ' + fmtK(p.pushesPerDay * p.paidShare) + '/day' + scTag + capTag);
    } else {
      if (p.compGasTx > 0) terms.push('custom PP ' + fmtK(p.compGasTx) + ' gas × ' + fmtK(p.pushesPerDay * p.paidShare) + '/day' + scTag + capTag);
      if (p.appGasTx > 0) terms.push(APP_GAS[state.app].key + ' ' + fmtK(p.appGasTx) + ' gas × ' + fmtK(p.pushesApp * p.paidShare) + '/day' + scTag);
    }
    const b1 = document.createElement('b');
    b1.textContent = terms.length === 0 ? 'no pusher' : terms.length === 1 ? terms[0] : '(' + terms.join(' + ') + ')';
    ro.appendChild(b1);
    ro.appendChild(document.createTextNode(' × ' + fmtGwei(p.priceGwei) + ' (' + REGIME_NAMES[state.regime] + ') × $' + state.native.toLocaleString() + (p.ch.blob ? ' × ' + (1 + p.ch.blob).toFixed(2) + ' blob' : '') + (state.fp > 1 ? ' ÷ ' + state.fp + ' pools' : '') + ' = '));
    const b2 = document.createElement('b');
    b2.textContent = fmtUsd(p.totalCost) + '/day cost';
    ro.appendChild(b2);
    const txPerDay = ((p.compGasTx > 0 ? p.pushesPerDay : 0) + (p.appGasTx > 0 ? p.pushesApp : 0) || p.pushesPerDay) * p.paidShare;
    const perPush = p.gasLine / txPerDay;
    const ppTxt = perPush >= 0.01 ? perPush.toFixed(3) : perPush >= 0.0001 ? perPush.toFixed(5) : perPush.toPrecision(2);
    ro.appendChild(document.createTextNode('  ·  $' + ppTxt + '/push'));

    const bes = breakEvens(p);
    const vc = state.vcurFrac * p.vmax;
    const onv = ownerNet(vc, p);

    if (bes.length === 0) {
      const anyProfit = p.ownerFrac > 0 && ownerRev(p.vmax, p) > p.totalCost;
      setText('t1v', '-');
      setText('t1s', p.ownerFrac <= 0 ? 'owner share is 0 - nothing covers the cost'
        : anyProfit ? 'owner-profitable across the whole range'
        : 'no break-even in range - owner share never covers the cost stack');
      setText('t4v', '-'); setText('t4s', 'bp');
    } else {
      setText('t1v', fmt2sig(bes[0]) + '/day');
      setText('t1s', bes.length > 1 ? 'second crossing (profit ends) at ' + fmt2sig(bes[1]) + '/day' : 'owner share covers the cost stack past this volume');
      setText('t4v', fmtBp(marginBp(bes[0], p)).replace(' bp', ''));
      setText('t4s', 'bp gross margin needed at ' + fmt2sig(bes[0]));
    }

    setText('t2v', fmtUsd(onv) + '/day');
    setText('t2s', 'at V = ' + fmtUsd(vc) + ' · owner rev ' + fmtUsd(ownerRev(vc, p)) + ' − cost ' + fmtUsd(p.totalCost));

    setText('t3l', 'Gross P&L at your V');
    setText('t3v', fmtUsd(gross(vc, p)) + '/day');
    setText('t3s', 'protocol ' + fmtUsd(gross(vc, p) * p.protFrac) + ' · LPs ' + fmtUsd(gross(vc, p) * p.lpFrac) + ' · owner ' + fmtUsd(ownerRev(vc, p)));

    setText('t5v', fmtUsd(p.totalCost) + '/day');
    setText('t5s', stackName() + ' gas, all pushers');

    renderMain(p, bes);
    if ($('marginDetails').open) {
      renderSmall('marChart', V => marginBp(V, p), cssVar('--series-margin'), p, fmtBp, true);
      renderSmall('mrChart', V => mrBp(V, p), cssVar('--series-mr'), p, fmtBp, true);
    }
  }

  $('chain').addEventListener('change', () => { state.chain = $('chain').value; applyChainDefaults(); update(); });
  $('pclass').addEventListener('change', () => { state.pclass = $('pclass').value; applyClassDefaults(); update(); });
  [0, 1, 2].forEach(i => {
    $('reg' + i).addEventListener('click', () => setRegime(i));
    $('ap' + i).addEventListener('click', () => { if (!$('ap' + i).disabled) setApp(i); });
  });
  $('bs0').addEventListener('click', () => setBasis('flow'));
  $('bs1').addEventListener('click', () => setBasis('mtm'));
  $('co1').addEventListener('click', () => setCo(true));
  $('co0').addEventListener('click', () => setCo(false));
  $('ol1').addEventListener('click', () => setOwnerLp(true));
  $('ol0').addEventListener('click', () => setOwnerLp(false));
  $('fpp1').addEventListener('click', () => setFpp(1));
  $('fpp2').addEventListener('click', () => setFpp(2));
  $('sc1').addEventListener('click', () => setSwapCond(true));
  $('sc0').addEventListener('click', () => setSwapCond(false));

  function dFromInterval(ivl) {
    const cl = CLASSES[state.pclass];
    const rc = cl.regimes ? cl.regimes[state.regime] : null;
    const sigmaEff = rc ? rc.sigma : cl.sigma * SIGMA_MULT[state.regime];
    const tvEff = rc ? rc.tv : cl.tv * (sigmaEff / cl.sigma);
    const nsat = rc ? rc.nsat : cl.nsat;
    const P = Math.min(86400 / ivl, nsat * 0.999);
    const a = 1 / (sigmaEff * sigmaEff), b = 1 / tvEff;
    const c = 1 / P - 1 / nsat;
    const d = (-b + Math.sqrt(b * b + 4 * a * c)) / (2 * a);
    return Math.max(TOL_LO, Math.min(TOL_HI, d));
  }
  $('scaleLin').addEventListener('click', () => setScale(false));
  $('scaleLog').addEventListener('click', () => setScale(true));
  $('marginDetails').addEventListener('toggle', update);
  ['tol', 'apptol', 'prot', 'own', 'ml', 'mr', 'vhalf', 'vcur', 'fp', 'basefee', 'native', 'scsh']
    .forEach(id => $(id).addEventListener('input', update));
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', update);

  const helptip = document.createElement('div');
  helptip.className = 'helptip';
  document.body.appendChild(helptip);
  document.querySelectorAll('.help').forEach(h => {
    const show = () => {
      helptip.textContent = h.dataset.tip;
      helptip.style.display = 'block';
      helptip.style.left = '0px'; helptip.style.top = '0px';
      const r = h.getBoundingClientRect();
      const w = helptip.offsetWidth, ht = helptip.offsetHeight;
      let x = r.right + 8, y = r.top - 4;
      if (x + w > window.innerWidth - 8) x = Math.max(8, r.left - w - 8);
      if (y + ht > window.innerHeight - 8) y = window.innerHeight - ht - 8;
      if (y < 8) y = 8;
      helptip.style.left = x + 'px'; helptip.style.top = y + 'px';
    };
    const hide = () => { helptip.style.display = 'none'; };
    h.addEventListener('mouseenter', show);
    h.addEventListener('mouseleave', hide);
  });

  applyClassDefaults();
  applyChainDefaults();
  update();
})();
