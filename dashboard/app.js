// app.js — Token Launch Radar page.
//
// Reads window.RADAR (written by main.ts into data.js) and renders the
// spotlight, the sortable/filterable board, the detail view, the category
// chart, the concentration panel and the live-token panel. No network: the
// page works from disk. farm.js (window.farmSteps) writes the farm plans.

"use strict";

const RADAR = window.RADAR;

// Rows arrive as compact arrays:
// [slug, name, catIdx, chainIdx, chainCount, tvl, change7d, daysListed, implied]
const ROWS = RADAR.rows.map((a, i) => ({
  rank: i + 1,
  slug: a[0],
  name: a[1],
  catIdx: a[2],
  cat: RADAR.cats[a[2]],
  chainIdx: a[3],
  chain: RADAR.chains[a[3]],
  chainCount: a[4],
  tvl: a[5],
  chg: a[6],
  days: a[7],
  implied: a[8],
}));

const BY_SLUG = new Map(ROWS.map((r) => [r.slug, r]));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// The model's four factors, recomputed from the row's own figures so the
// detail view's waterfall and the board's implied value always agree.
function factors(r) {
  const ratio = RADAR.catRatio[r.catIdx];
  const momentum = r.chg === null ? 1 : 1 + clamp(r.chg, -60, 120) / 150;
  const tenure =
    r.days === null ? 1 : 1 + 0.45 * Math.sqrt(Math.min(r.days, 1460) / 1460);
  const breadth = 1 + 0.03 * Math.min(Math.max(r.chainCount - 1, 0), 5);
  return { ratio, momentum, tenure, breadth };
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(n) {
  return "$" + String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function short(n) {
  if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
  return "$" + Math.round(n / 1e3) + "K";
}

function chgText(chg) {
  if (chg === null || chg === undefined) return "—";
  return (chg >= 0 ? "+" : "") + chg.toFixed(1) + "%";
}

function ageText(days) {
  if (days === null || days === undefined) return "—";
  if (days < 30) return days + "d";
  if (days < 365) return Math.round(days / 30) + "mo";
  return (days / 365).toFixed(1) + "y";
}

function thinBadge(r) {
  return RADAR.catPeers[r.catIdx] <= 2
    ? '<span class="thin">thin evidence</span>'
    : "";
}

// ---------------------------------------------------------------- spotlight

function renderSpotlight() {
  const top = ROWS.slice(0, 10);
  document.getElementById("spotlight").innerHTML = top
    .map(
      (r) =>
        '<div class="card" data-slug="' +
        esc(r.slug) +
        '"><div class="rk">#' +
        r.rank +
        '</div><div class="nm">' +
        esc(r.name) +
        '</div><div class="vl">' +
        short(r.implied) +
        '</div><div class="ct">' +
        esc(r.cat) +
        " · " +
        esc(r.chain) +
        "</div></div>",
    )
    .join("");
}

// ------------------------------------------------------------------- board

const state = { sort: "rank", dir: 1, q: "", cat: "", chain: "" };

function filtered() {
  const q = state.q.trim().toLowerCase();
  let list = ROWS.filter(
    (r) =>
      (state.cat === "" || r.cat === state.cat) &&
      (state.chain === "" || r.chain === state.chain) &&
      (q === "" ||
        r.name.toLowerCase().includes(q) ||
        r.slug.includes(q)),
  );
  const key = state.sort;
  const dir = state.dir;
  const val = (r) => {
    if (key === "name" || key === "category" || key === "chain")
      return key === "name" ? r.name : key === "category" ? r.cat : r.chain;
    if (key === "chg") return r.chg === null ? -Infinity : r.chg;
    if (key === "days") return r.days === null ? -Infinity : r.days;
    return r[key];
  };
  list = [...list].sort((a, b) => {
    const va = val(a);
    const vb = val(b);
    if (va < vb) return -dir;
    if (va > vb) return dir;
    return a.rank - b.rank;
  });
  return list;
}

function renderBoard() {
  const list = filtered();
  const maxImplied = ROWS[0].implied;
  document.getElementById("boardBody").innerHTML = list
    .map((r) => {
      const pct = Math.round((r.implied / maxImplied) * 100);
      const chgCls = r.chg === null ? "" : r.chg >= 0 ? "up" : "down";
      return (
        '<tr data-slug="' +
        esc(r.slug) +
        '"><td class="num">' +
        r.rank +
        "</td><td><b>" +
        esc(r.name) +
        "</b>" +
        thinBadge(r) +
        "</td><td>" +
        esc(r.cat) +
        "</td><td>" +
        esc(r.chain) +
        "</td><td class=\"num\">" +
        short(r.tvl) +
        '</td><td class="num ' +
        chgCls +
        '">' +
        chgText(r.chg) +
        '</td><td class="num">' +
        ageText(r.days) +
        '</td><td class="num"><b>' +
        short(r.implied) +
        '</b><div class="bar"><i style="width:' +
        pct +
        '%"></i></div></td></tr>'
      );
    })
    .join("");
  document.getElementById("count").textContent =
    list.length + " of " + ROWS.length + " protocols · sorted by " + state.sort;
}

// ------------------------------------------------------------------ detail

function toFarmRow(r) {
  return {
    slug: r.slug,
    name: r.name,
    category: r.cat === "Uncategorised" ? null : r.cat,
    mainChain: r.chain,
    chainCount: r.chainCount,
    tvlUsd: r.tvl,
    change7d: r.chg,
    daysListed: r.days,
    rank: r.rank,
    impliedUsd: r.implied,
  };
}

function renderDetail(slug) {
  const r = BY_SLUG.get(slug);
  const box = document.getElementById("detail");
  const wrap = document.getElementById("detailWrap");
  if (!r) {
    wrap.hidden = true;
    box.innerHTML = "";
    return;
  }
  const f = factors(r);
  const tvlRank = [...ROWS].sort((a, b) => b.tvl - a.tvl).indexOf(r) + 1;
  const chgRank =
    r.chg === null
      ? "—"
      : "#" +
        ([...ROWS]
          .filter((x) => x.chg !== null)
          .sort((a, b) => b.chg - a.chg)
          .indexOf(r) +
          1);
  const peers = RADAR.catPeers[r.catIdx];
  const steps = window.farmSteps(toFarmRow(r));
  box.innerHTML =
    '<p><span class="back" id="backLink">← back to the board</span></p>' +
    "<h3>#" +
    r.rank +
    " " +
    esc(r.name) +
    thinBadge(r) +
    "</h3>" +
    '<p class="facts">' +
    esc(r.cat) +
    " · main chain " +
    esc(r.chain) +
    " (" +
    r.chainCount +
    " chains) · TVL rank #" +
    tvlRank +
    " · 7d change rank " +
    chgRank +
    " · " +
    ageText(r.days) +
    " listed" +
    "</p>" +
    '<table class="wf">' +
    "<tr><td>TVL</td><td>" +
    money(r.tvl) +
    "</td></tr>" +
    "<tr><td>× category ratio (" +
    esc(r.cat) +
    ", " +
    peers +
    " priced peer" +
    (peers === 1 ? "" : "s") +
    ")</td><td>" +
    f.ratio.toFixed(3) +
    "×</td></tr>" +
    "<tr><td>× momentum (7d " +
    chgText(r.chg) +
    ")</td><td>" +
    f.momentum.toFixed(3) +
    "×</td></tr>" +
    "<tr><td>× tenure (" +
    ageText(r.days) +
    " with no token)</td><td>" +
    f.tenure.toFixed(3) +
    "×</td></tr>" +
    "<tr><td>× breadth (" +
    r.chainCount +
    " chains)</td><td>" +
    f.breadth.toFixed(3) +
    "×</td></tr>" +
    '<tr class="total"><td>= implied value</td><td>' +
    money(r.implied) +
    "</td></tr></table>" +
    "<h3>How to farm it</h3><ol>" +
    steps
      .map((s) => "<li>" + esc(s).replace("Cost:", "<b>Cost:</b>") + "</li>")
      .join("") +
    "</ol>";
  wrap.hidden = false;
  document.getElementById("backLink").addEventListener("click", () => {
    location.hash = "#/";
  });
}

// ------------------------------------------------------- category + panels

function renderCategoryChart() {
  const totals = new Map();
  for (const r of ROWS) totals.set(r.cat, (totals.get(r.cat) || 0) + r.implied);
  const top = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const max = top[0][1];
  document.getElementById("catchart").innerHTML = top
    .map(
      ([cat, val]) =>
        '<div class="chartrow"><span>' +
        esc(cat) +
        '</span><span class="track"><span class="fill" style="display:block;width:' +
        Math.round((val / max) * 100) +
        '%"></span></span><span class="amt">' +
        short(val) +
        "</span></div>",
    )
    .join("");
}

function renderConcentration() {
  const totalImplied = ROWS.reduce((n, r) => n + r.implied, 0);
  const totalTvl = ROWS.reduce((n, r) => n + r.tvl, 0);
  const top3 = ROWS.slice(0, 3);
  const top3Implied = top3.reduce((n, r) => n + r.implied, 0);
  const top3Tvl = top3.reduce((n, r) => n + r.tvl, 0);
  const shareI = Math.round((top3Implied / totalImplied) * 100);
  const shareT = Math.round((top3Tvl / totalTvl) * 100);
  const topCat = top3[0].cat;
  const topRatio = RADAR.catRatio[top3[0].catIdx];
  const topPeers = RADAR.catPeers[top3[0].catIdx];
  const peerNote =
    topPeers === 1
      ? "because its only tokenised peer prices high"
      : "because its tokenised peers price high";
  document.getElementById("concentration").innerHTML =
    "<p>The top 3 rows hold <b>" +
    shareI +
    "%</b> of the board's implied value on <b>" +
    shareT +
    "%</b> of its TVL. The gap is the category ratio: " +
    esc(topCat) +
    " prices at <b>" +
    topRatio.toFixed(2) +
    "× TVL</b> against a <b>" +
    RADAR.meta.globalRatio.toFixed(2) +
    "×</b> global median, " +
    peerNote +
    " — so a " +
    esc(topCat) +
    " protocol's TVL counts for more than a typical protocol's. That is the model's honest output, stated here rather than hidden.</p>" +
    "<p>Board totals: " +
    money(totalImplied) +
    " implied value across " +
    ROWS.length +
    " protocols, on " +
    money(totalTvl) +
    " of TVL.</p>";
}

function renderLive() {
  document.getElementById("live").innerHTML = RADAR.live
    .map(
      ([name, mcap, catIdx]) =>
        "<div><b>" +
        esc(name) +
        "</b> — " +
        short(mcap) +
        ' <span>(' +
        esc(RADAR.cats[catIdx]) +
        ")</span></div>",
    )
    .join("");
}

// ------------------------------------------------------------------ routing

function route() {
  const hash = location.hash || "#/";
  const detail = hash.match(/^#\/detail\/(.+)$/);
  const cat = hash.match(/^#\/cat\/(.+)$/);
  if (detail) {
    renderDetail(decodeURIComponent(detail[1]));
    document
      .getElementById("detailWrap")
      .scrollIntoView({ behavior: "auto", block: "start" });
  } else {
    document.getElementById("detailWrap").hidden = true;
    if (cat) {
      state.cat = decodeURIComponent(cat[1]);
      document.getElementById("catFilter").value = state.cat;
    }
    renderBoard();
  }
}

function init() {
  document.getElementById("meta").textContent =
    "Snapshot " +
    RADAR.meta.asOf +
    " · " +
    RADAR.rows.length +
    " protocols ranked · watchlist floor " +
    money(RADAR.meta.floorUsd) +
    " · global median ratio " +
    RADAR.meta.globalRatio.toFixed(3) +
    "×";
  const catSel = document.getElementById("catFilter");
  for (const c of RADAR.cats) {
    const o = document.createElement("option");
    o.value = c;
    o.textContent = c;
    catSel.appendChild(o);
  }
  const chainSel = document.getElementById("chainFilter");
  for (const c of RADAR.chains) {
    const o = document.createElement("option");
    o.value = c;
    o.textContent = c;
    chainSel.appendChild(o);
  }
  document.getElementById("q").addEventListener("input", (e) => {
    state.q = e.target.value;
    renderBoard();
  });
  catSel.addEventListener("change", (e) => {
    state.cat = e.target.value;
    renderBoard();
  });
  chainSel.addEventListener("change", (e) => {
    state.chain = e.target.value;
    renderBoard();
  });
  document.querySelectorAll("#board th").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      if (state.sort === key) state.dir = -state.dir;
      else {
        state.sort = key;
        state.dir = key === "name" || key === "category" || key === "chain" ? 1 : -1;
      }
      renderBoard();
    });
  });
  document.getElementById("spotlight").addEventListener("click", (e) => {
    const card = e.target.closest("[data-slug]");
    if (card) location.hash = "#/detail/" + card.dataset.slug;
  });
  document.getElementById("boardBody").addEventListener("click", (e) => {
    const row = e.target.closest("[data-slug]");
    if (row) location.hash = "#/detail/" + row.dataset.slug;
  });
  window.addEventListener("hashchange", route);
  renderSpotlight();
  renderCategoryChart();
  renderConcentration();
  renderLive();
  route();
}

init();
