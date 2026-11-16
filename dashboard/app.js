// Token Launch Radar v5 — dashboard logic (no network, no framework).
//
// Reads window.RADAR (written by main.ts from the same board), renders the
// sortable, filterable board, and opens a detail view for any row. The URL
// hash drives the initial view so a state can be linked: #detail=<slug>,
// #cat=<category>, #watch=1.

(function () {
  var R = window.RADAR;
  if (!R) return;
  var rows = R.rows;
  var meta = R.meta;

  var $ = function (id) { return document.getElementById(id); };
  var usd = function (n) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
    return '$' + Math.round(n);
  };
  var age = function (d) {
    if (d === null || d === undefined) return '—';
    if (d < 30) return d + 'd';
    if (d < 365) return (d / 30).toFixed(1) + 'mo';
    return (d / 365).toFixed(1) + 'y';
  };
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  // ---- header stats -------------------------------------------------------
  var maxImplied = rows.length ? rows[0].impliedValueUsd : 1;
  $('stats').innerHTML =
    '<div><dt>Ranked</dt><dd>' + rows.length + '</dd></div>' +
    '<div><dt>Watchlist</dt><dd>' + meta.watchlistSize + ' covered</dd></div>' +
    '<div><dt>Total implied</dt><dd>' + usd(meta.totalImpliedUsd) + '</dd></div>' +
    '<div><dt>Top value</dt><dd>' + usd(maxImplied) + '</dd></div>';
  var asofText = 'Snapshot ' + meta.asOf + ' · floor ' + usd(meta.floorUsd) + ' · ' +
    meta.snapshotProtocols + ' protocols in the snapshot.';
  $('asof').textContent = asofText;
  Array.prototype.forEach.call(document.querySelectorAll('.asof'), function (el) {
    el.textContent = meta.asOf;
  });

  // ---- filter controls ----------------------------------------------------
  var cats = {};
  var chains = {};
  rows.forEach(function (r) {
    cats[r.category || 'Uncategorised'] = 1;
    r.chains.forEach(function (c) { chains[c] = 1; });
  });
  Object.keys(cats).sort().forEach(function (c) {
    var o = document.createElement('option');
    o.value = c; o.textContent = c + ' (' + rows.filter(function (r) { return (r.category || 'Uncategorised') === c; }).length + ')';
    $('cat').appendChild(o);
  });
  Object.keys(chains).sort().forEach(function (c) {
    var o = document.createElement('option');
    o.value = c; o.textContent = c;
    $('chain').appendChild(o);
  });

  var state = { q: '', cat: '', chain: '', watch: false, sort: 'rank' };

  function visible() {
    var q = state.q.trim().toLowerCase();
    var list = rows.filter(function (r) {
      if (state.watch && !r.onWatchlist) return false;
      if (state.cat && (r.category || 'Uncategorised') !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) === -1) return false;
      if (q && (r.name + ' ' + r.slug + ' ' + (r.category || '')).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    var by = {
      rank: function (a, b) { return a.rank - b.rank; },
      tvl: function (a, b) { return b.tvlUsd - a.tvlUsd; },
      growth: function (a, b) { return (b.change7d || 0) - (a.change7d || 0); },
      age: function (a, b) { return (b.ageDays || 0) - (a.ageDays || 0); },
    }[state.sort];
    return list.sort(by);
  }

  function render() {
    var list = visible();
    $('count').textContent = 'Showing ' + list.length + ' of ' + rows.length + ' ranked';
    var html = list.map(function (r) {
      var g = r.change7d === null
        ? '<span class="muted">—</span>'
        : '<span class="' + (r.change7d >= 0 ? 'up' : 'down') + '">' +
          (r.change7d >= 0 ? '+' : '') + r.change7d.toFixed(1) + '%</span>';
      var w = Math.max(4, Math.round((r.impliedValueUsd / maxImplied) * 100));
      var chainLabel = r.chains.slice(0, 3).join(', ') +
        (r.chains.length > 3 ? ' +' + (r.chains.length - 3) + ' more' : '');
      return '<tr data-slug="' + esc(r.slug) + '" class="' + (r.onWatchlist ? 'watch' : '') + '">' +
        '<td class="num">' + r.rank + (r.onWatchlist ? ' ★' : '') + '</td>' +
        '<td><span class="name">' + esc(r.name) + '</span>' +
        '<span class="sub">' + esc(r.slug) + ' · ' + esc(r.category || 'Uncategorised') + ' · ' + esc(chainLabel) + '</span></td>' +
        '<td class="num">' + usd(r.tvlUsd) + '</td>' +
        '<td class="num">' + g + '</td>' +
        '<td class="num">' + age(r.ageDays) + '</td>' +
        '<td class="num">' + r.peerMultiple.toFixed(2) + '×</td>' +
        '<td class="num"><strong>' + usd(r.impliedValueUsd) + '</strong></td>' +
        '<td class="bar-cell"><div class="bar"><i style="width:' + w + '%"></i></div></td>' +
        '</tr>';
    }).join('');
    $('rows').innerHTML = html || '<tr><td colspan="8" class="muted">No protocols match this filter.</td></tr>';
  }

  // ---- detail view ---------------------------------------------------------
  var selected = null;
  function openDetail(slug) {
    var r = rows.filter(function (x) { return x.slug === slug; })[0];
    if (!r) return;
    selected = slug;
    Array.prototype.forEach.call(document.querySelectorAll('#board tbody tr'), function (tr) {
      tr.classList.toggle('sel', tr.getAttribute('data-slug') === slug);
    });
    $('d-name').textContent = '#' + r.rank + ' ' + r.name;
    $('d-sub').textContent = r.slug + ' · ' + (r.category || 'Uncategorised') + ' · ' +
      r.chains.join(', ') + ' · ' + (r.onWatchlist ? 'On the watchlist ★' : 'Below the floor — early find') +
      ' · Implied value ' + usd(r.impliedValueUsd);
    $('d-why').textContent = r.why;
    var sig = [
      ['TVL', usd(r.tvlUsd), 'Size of the protocol today'],
      ['7-day TVL change', r.change7d === null ? 'unreported' : ((r.change7d >= 0 ? '+' : '') + r.change7d.toFixed(2) + '%'), 'Momentum factor ' + r.momentum.toFixed(2) + '×'],
      ['Age', age(r.ageDays) + (r.listedAt ? ' (listed ' + r.listedAt + ')' : ''), 'Maturity factor ' + r.maturity.toFixed(2) + '×'],
      ['Chains', r.chains.length + ' (' + r.chains.join(', ') + ')', 'Breadth factor ' + r.breadth.toFixed(2) + '×'],
      ['Peer multiple', r.peerMultiple.toFixed(2) + '×' + (r.peerCount ? ' (' + r.peerCount + ' launched peers)' : ' (global median)'), 'Median mcap/TVL of launched peers in this category'],
      ['Early bonus', r.earlyBonus.toFixed(2) + '×', r.earlyBonus > 1 ? 'Listed under a year ago and growing over +10% in 7 days' : 'No early-growth bonus'],
      ['Implied value', usd(r.impliedValueUsd), 'TVL × peer multiple × momentum × maturity × breadth × early bonus'],
    ];
    $('d-signals').innerHTML = '<tr><th>Signal</th><th>Value</th><th>What it means</th></tr>' +
      sig.map(function (s) {
        return '<tr><td>' + esc(s[0]) + '</td><td class="num"><strong>' + esc(s[1]) + '</strong></td><td>' + esc(s[2]) + '</td></tr>';
      }).join('');
    $('d-steps').innerHTML = r.farmSteps.map(function (s) {
      return '<li>' + esc(s) + '</li>';
    }).join('');
    $('detail').hidden = false;
    $('detail').scrollIntoView({ behavior: 'auto', block: 'start' });
  }
  function closeDetail() {
    selected = null;
    $('detail').hidden = true;
    Array.prototype.forEach.call(document.querySelectorAll('#board tbody tr'), function (tr) {
      tr.classList.remove('sel');
    });
  }

  $('rows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (tr) openDetail(tr.getAttribute('data-slug'));
  });
  $('d-close').addEventListener('click', closeDetail);

  // ---- anchors -------------------------------------------------------------
  $('anchor-rows').innerHTML = R.anchors.map(function (a) {
    return '<tr><td><span class="name">' + esc(a.name) + '</span>' +
      '<span class="sub">' + esc(a.slug) + '</span></td>' +
      '<td>' + esc(a.category || '—') + '</td>' +
      '<td class="num">' + usd(a.tvlUsd) + '</td>' +
      '<td class="num">' + usd(a.mcapUsd) + '</td>' +
      '<td class="num">' + a.ratio.toFixed(2) + '×</td></tr>';
  }).join('');

  // ---- wiring ---------------------------------------------------------------
  $('q').addEventListener('input', function () { state.q = $('q').value; render(); });
  $('cat').addEventListener('change', function () { state.cat = $('cat').value; render(); });
  $('chain').addEventListener('change', function () { state.chain = $('chain').value; render(); });
  $('watchonly').addEventListener('change', function () { state.watch = $('watchonly').checked; render(); });
  $('sort').addEventListener('change', function () { state.sort = $('sort').value; render(); });

  // ---- initial state from the hash -----------------------------------------
  var hash = {};
  location.hash.replace(/^#\/?/, '').split('&').forEach(function (kv) {
    var p = kv.split('=');
    if (p[0]) hash[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
  });
  if (hash.cat) { state.cat = hash.cat; $('cat').value = hash.cat; }
  if (hash.chain) { state.chain = hash.chain; $('chain').value = hash.chain; }
  if (hash.watch === '1') { state.watch = true; $('watchonly').checked = true; }
  if (hash.q) { state.q = hash.q; $('q').value = hash.q; }
  if (hash.sort) { state.sort = hash.sort; $('sort').value = hash.sort; }
  render();
  if (hash.detail) openDetail(hash.detail);
})();
