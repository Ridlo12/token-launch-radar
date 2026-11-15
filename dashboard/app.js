// app.js — Token Launch Radar v2 dashboard logic (ES module, no network).
// Reads the compact rows main.ts wrote to data.js and renders the board, the
// spotlight, the filters and the detail view. Farm steps are built by farm.js,
// the same generator main.ts used for board.json, so the page and the board agree.
import { ROWS, META, CATEGORIES, CHAINS, CALIBRATION, LIVE, TICKER_TOP, CAT_TOTALS } from './data.js';
import { buildFarmSteps, planSummary } from './farm.js';

// The factors main.ts used, re-derived here from the row's own figures so
// data.js stays small: momentum from the 7-day change, tenure from days
// listed, breadth from the chain count — the same formulas, rounded the same way.
const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
const round4 = (x) => Math.round(x * 10000) / 10000;
const momentumOf = (change) => (change === null ? 1 : 1 + clamp(change, -60, 120) / 150);
const tenureOf = (days) => (days === null ? 1 : 1 + 0.45 * Math.sqrt(Math.min(days, 1460) / 1460));
const breadthOf = (n) => 1 + 0.03 * Math.min(n - 1, 5);

const rows = ROWS.map((r) => ({
  rank: r[0],
  slug: r[1],
  name: r[2],
  category: CATEGORIES[r[3]],
  chains: r[4].map((i) => CHAINS[i]),
  tvl: r[5],
  change: r[6],
  implied: r[7],
  ageDays: r[8],
  ratio: r[9],
  wl: r[10] === 1,
  momentum: round4(momentumOf(r[6])),
  tenure: round4(tenureOf(r[8])),
  breadth: round4(breadthOf(r[4].length)),
  density: r[7] / r[5],
}));
// TVL rank and 7-day-change rank, for the detail view's "why this rank" line.
const byTvl = [...rows].sort((a, b) => b.tvl - a.tvl);
byTvl.forEach((r, i) => { r.tvlRank = i + 1; });
const byChg = [...rows].sort((a, b) => (b.change ?? -Infinity) - (a.change ?? -Infinity));
byChg.forEach((r, i) => { r.chgRank = i + 1; });
const minTvl = Math.min(...rows.map((r) => r.tvl));
const maxTvl = Math.max(...rows.map((r) => r.tvl));
const minImp = Math.min(...rows.map((r) => r.implied));
const maxImp = Math.max(...rows.map((r) => r.implied));
const maxRatio = Math.max(...rows.map((r) => r.ratio));
const logW = (v, lo, hi) => Math.max(2, Math.round(((Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * 100));

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function fmtUsd(n) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(n >= 1e11 ? 0 : 2).replace(/\.00$/, '')}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n}`;
}
function fmtFull(n) {
  return '$' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function fmtPct(x) {
  if (x === null || x === undefined) return '—';
  const s = (x > 0 ? '+' : '') + x.toFixed(1) + '%';
  const cls = x > 0 ? 'up' : x < 0 ? 'down' : '';
  return `<span class="${cls}">${s}</span>`;
}
function fmtAge(days) {
  if (days === null || days === undefined) return '—';
  if (days >= 365) return `${(days / 365).toFixed(1)}y`;
  return `${days}d`;
}

const state = { q: '', cat: '', chain: '', sort: 'rank', wl: false, selected: null };

function filtered() {
  const q = state.q.trim().toLowerCase();
  let list = rows.filter(
    (r) =>
      (!q || r.name.toLowerCase().includes(q) || r.slug.includes(q)) &&
      (!state.cat || r.category === state.cat) &&
      (!state.chain || r.chains.includes(state.chain)) &&
      (!state.wl || r.wl),
  );
  const by = {
    rank: (a, b) => a.rank - b.rank,
    tvl: (a, b) => b.tvl - a.tvl,
    chg: (a, b) => (b.change ?? -Infinity) - (a.change ?? -Infinity),
    age: (a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1),
    density: (a, b) => b.density - a.density,
  }[state.sort];
  return list.sort(by);
}

function renderChips() {
  const top = rows[0];
  $('chips').innerHTML = [
    `<span class="chip"><b>${META.rows}</b> protocols ranked</span>`,
    `<span class="chip"><b>${META.watchlist}</b> on the watchlist</span>`,
    `<span class="chip">top implied <b>${fmtUsd(top.implied)}</b> · ${esc(top.name)}</span>`,
    `<span class="chip">floor <b>${fmtUsd(META.floorUsd)}</b> TVL</span>`,
    `<span class="chip">snapshot <b>${META.asOf}</b></span>`,
  ].join('');
}

function renderTop10() {
  $('top10').innerHTML = rows.slice(0, 10).map((r) => `
    <div class="card${r.slug === state.selected ? ' sel' : ''}" data-slug="${esc(r.slug)}">
      <div class="crank">#${r.rank}</div>
      <div class="cname">${esc(r.name)}</div>
      <div class="cval">${fmtUsd(r.implied)}</div>
      <div class="cmeta">${esc(r.category)} · TVL ${fmtUsd(r.tvl)}</div>
    </div>`).join('');
  document.querySelectorAll('#top10 .card').forEach((el) => {
    el.addEventListener('click', () => select(el.dataset.slug));
  });
}

function renderTable() {
  const list = filtered();
  $('count').textContent = `${list.length} of ${rows.length} protocols shown.`;
  $('rows').innerHTML = list
    .map(
      (r) => `<tr data-slug="${esc(r.slug)}" class="${r.slug === state.selected ? 'selected' : ''}">
        <td class="num rank">${r.rank}</td>
        <td><span class="name">${esc(r.name)}</span>${r.wl ? '<span class="wlmark">WL</span>' : ''}<span class="badge">PRE-TOKEN</span></td>
        <td>${esc(r.category)}</td>
        <td>${esc(r.chains[0])}${r.chains.length > 1 ? ` +${r.chains.length - 1}` : ''}</td>
        <td class="num">${fmtUsd(r.tvl)}</td>
        <td class="num">${fmtPct(r.change)}</td>
        <td class="num"><strong>${fmtUsd(r.implied)}</strong><div class="bar"><i style="width:${logW(r.implied, minImp, maxImp)}%"></i></div></td>
        <td class="num">${fmtAge(r.ageDays)}</td>
      </tr>`,
    )
    .join('');
  document.querySelectorAll('#rows tr').forEach((tr) => {
    tr.addEventListener('click', () => select(tr.dataset.slug));
  });
}

function renderDetail() {
  const box = $('detail');
  const r = rows.find((x) => x.slug === state.selected);
  if (!r) {
    box.innerHTML = '<p class="empty">Select a protocol above to see its value breakdown and farm plan.</p>';
    return;
  }
  const steps = buildFarmSteps({
    slug: r.slug,
    name: r.name,
    category: r.category,
    chains: r.chains,
    tvl_usd: r.tvl,
    change_7d: r.change,
    implied_value_usd: r.implied,
    rank: r.rank,
    age_days: r.ageDays,
  });
  const sum = planSummary({
    chains: r.chains,
    age_days: r.ageDays,
  });
  // The displayed product uses the factors rounded to 4 decimals, so the
  // arithmetic on screen reconciles; the board's value is the exact product.
  const product = Math.round(r.tvl * r.ratio * r.momentum * r.tenure * r.breadth);
  const wf = [
    ['TVL', fmtUsd(r.tvl), logW(r.tvl, minTvl, maxTvl), false],
    ['Category ratio', String(r.ratio), Math.round((r.ratio / maxRatio) * 100), true],
    ['Momentum', String(r.momentum), Math.round(((r.momentum - 0.6) / 1.2) * 100), false],
    ['Tenure', String(r.tenure), Math.round(((r.tenure - 1) / 0.45) * 100), false],
    ['Breadth', String(r.breadth), Math.round(((r.breadth - 1) / 0.15) * 100), false],
  ];
  box.innerHTML = `
    <div class="detail-head">
      <h2>#${r.rank} ${esc(r.name)}</h2>
      <span class="sub">${esc(r.slug)} · ${esc(r.category)} · ${r.chains.map(esc).join(', ')}</span>
      ${r.wl ? '<span class="wlmark">WATCHLIST</span>' : '<span class="badge">BELOW FLOOR</span>'}
      <span class="badge">PRE-TOKEN</span>
    </div>
    <div class="grid2">
      <div>
        <p class="formula">Implied value = TVL × ratio × momentum × tenure × breadth<br>
        <code>${fmtFull(r.tvl)} × ${r.ratio} × ${r.momentum} × ${r.tenure} × ${r.breadth} ≈ ${fmtFull(product)}</code><br>
        <span class="hint">Factors shown rounded to 4 decimals; the board's value is the exact product, ${fmtFull(r.implied)}.</span></p>
        <div class="waterfall">${wf.map(([lbl, val, w, acc]) => `
          <div class="wf-row"><span class="lbl">${lbl}</span><span class="wf-track"><i class="${acc ? 'acc' : ''}" style="width:${clamp(w, 2, 100)}%"></i></span><span class="val">${val}</span></div>`).join('')}</div>
        <table class="kv">
          <tr><td>Implied value</td><td><strong>${fmtFull(r.implied)}</strong></td></tr>
          <tr><td>TVL</td><td>${fmtFull(r.tvl)} (rank #${r.tvlRank} of ${rows.length})</td></tr>
          <tr><td>7-day TVL change</td><td>${r.change === null ? 'not reported' : `${r.change > 0 ? '+' : ''}${r.change}% (rank #${r.chgRank} of ${rows.length})`}</td></tr>
          <tr><td>Category ratio (median mcap/TVL)</td><td>${r.ratio}</td></tr>
          <tr><td>Momentum factor</td><td>${r.momentum}</td></tr>
          <tr><td>Tenure factor (${r.ageDays === null ? 'listing unreported' : fmtAge(r.ageDays) + ' listed'})</td><td>${r.tenure}</td></tr>
          <tr><td>Breadth factor (${r.chains.length} chain${r.chains.length === 1 ? '' : 's'})</td><td>${r.breadth}</td></tr>
        </table>
        <p class="hint">“Records no token” means the snapshot carries no market cap, no
        CoinGecko id and no ticker for this protocol. The implied value is this entry's
        own claim, not a prediction that a token will launch.</p>
      </div>
      <div>
        <h3>Farm plan</h3>
        <p class="plansum">Est. total gas <b>≈ $${sum.gasUsd.toFixed(2)}</b> · active time <b>≈ ${sum.minutes} min</b> over <b>${sum.holdDays} days</b> · position <b>$${r.rank <= 25 ? '1,000' : r.rank <= 100 ? '500' : '100'}</b></p>
        <ol class="steps">${steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      </div>
    </div>`;
}

function renderChart() {
  const max = CAT_TOTALS[0][1];
  $('catbars').innerHTML = CAT_TOTALS.map(([cat, total]) => `
    <div class="brow"><span class="blbl">${esc(cat)}</span><span class="btrack"><i style="width:${Math.max(2, Math.round((total / max) * 100))}%"></i></span><span class="bval">${fmtUsd(total)}</span></div>`).join('');
}

function renderCalib() {
  document.querySelector('#calib tbody').innerHTML = CALIBRATION.map(
    (c) => `<tr><td>${esc(c.category)}</td><td class="num">${c.n}</td><td class="num">${c.median}</td><td class="num">${c.ratio}</td></tr>`,
  ).join('');
  document.querySelector('#live tbody').innerHTML = LIVE.map(
    (t) => `<tr><td>${esc(t[0])}</td><td class="num">${fmtFull(t[1])}</td><td class="num">${fmtFull(t[2])}</td><td class="num">${t[3]}</td></tr>`,
  ).join('');
  $('tickerCount').textContent = META.tickerOnly;
  $('tickerList').textContent = TICKER_TOP.map((t) => `${t[0]} (${t[1]})`).join(' · ');
}

function fillSelects() {
  const catSel = $('cat');
  [...new Set(rows.map((r) => r.category))].sort().forEach((c) => {
    const o = document.createElement('option');
    o.value = c;
    o.textContent = c;
    catSel.appendChild(o);
  });
  const chainSel = $('chain');
  [...new Set(rows.flatMap((r) => r.chains))].sort().forEach((c) => {
    const o = document.createElement('option');
    o.value = c;
    o.textContent = c;
    chainSel.appendChild(o);
  });
}

function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('q') !== null) { state.q = h.get('q'); $('q').value = state.q; }
  if (h.get('cat')) { state.cat = h.get('cat'); $('cat').value = state.cat; }
  if (h.get('chain')) { state.chain = h.get('chain'); $('chain').value = state.chain; }
  if (h.get('sort')) { state.sort = h.get('sort'); $('sort').value = state.sort; }
  if (h.get('wl') === '1') { state.wl = true; $('wl').checked = true; }
  if (h.get('detail')) state.selected = h.get('detail');
}

function writeHash() {
  const h = new URLSearchParams();
  if (state.q) h.set('q', state.q);
  if (state.cat) h.set('cat', state.cat);
  if (state.chain) h.set('chain', state.chain);
  if (state.sort !== 'rank') h.set('sort', state.sort);
  if (state.wl) h.set('wl', '1');
  if (state.selected) h.set('detail', state.selected);
  const s = h.toString();
  history.replaceState(null, '', s ? `#${s}` : location.pathname);
}

function select(slug) {
  state.selected = slug;
  writeHash();
  renderTop10();
  renderTable();
  renderDetail();
  $('detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

$('q').addEventListener('input', (e) => { state.q = e.target.value; writeHash(); renderTable(); });
$('cat').addEventListener('change', (e) => { state.cat = e.target.value; writeHash(); renderTable(); });
$('chain').addEventListener('change', (e) => { state.chain = e.target.value; writeHash(); renderTable(); });
$('sort').addEventListener('change', (e) => { state.sort = e.target.value; writeHash(); renderTable(); });
$('wl').addEventListener('change', (e) => { state.wl = e.target.checked; writeHash(); renderTable(); });

fillSelects();
readHash();
renderChips();
renderTop10();
renderTable();
renderDetail();
renderChart();
renderCalib();
