# Token Launch Radar — v5

A token launch radar for make.fun's **token-radar-01** bounty: it reads a sealed
DefiLlama snapshot, ranks every protocol that records no token by what its
launch would be worth, and hands in a web dashboard with a farm plan for each.

## The model (v5)

```
implied = TVL × peerMultiple(category) × momentum(7d) × maturity(age) × breadth(chains) × earlyBonus
```

- **Peer multiple** — median market-cap/TVL of launched protocols in the same
  category (ratios winsorised to 0.01–3.00; fewer than 3 peers falls back to
  the global median), clamped to 0.02–1.50×. Computed from the snapshot, never
  hardcoded.
- **Momentum** — 7-day TVL change, clamped to −40%…+120%, mapped to 0.80–1.60×.
- **Maturity** — days since DefiLlama first listed the protocol, 0.85–1.15×
  over 0–4 years.
- **Breadth** — 1.00× + 0.05× per extra chain, capped at 1.30×.
- **Early bonus** — 1.10× for protocols listed under a year ago already growing
  over +10% in 7 days.

Eligible rows: protocols that record no token and are not a wrapped, staked or
bridged product, a CEX, or a versioned copy — the snapshot's own watchlist
rule, applied to every candidate. The board ranks all 198 such candidates,
so all 40 watchlist protocols are covered plus 158 early finds below the
$50M floor. Launched protocols are not board rows; the eight largest appear
as valuation anchors.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

The grader runs `node main.ts` with no arguments (`/input/snapshot.json`,
`/output`). The program is deterministic: two runs write identical bytes.

## Layout

- `main.ts` — entrypoint: read snapshot, score, write outputs, build dossier.
- `lib/model.ts` — the value model, farm plans, board validation.
- `vendor/makefun-board.ts` — make.fun's dossier library, as shipped in the kit.
- `dashboard/` — the static page (index.html, app.css, app.js; no network).
- `screenshots/` — 1-board, 2-detail, 3-filtered.
