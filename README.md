# Token Launch Radar — v2

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Ridlo12/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Ridlo12/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A radar for protocols that record no token yet, ranked by what a launch would
be worth if the protocol's record stayed as it is. Built for the
[make.fun Token Launch Radar bounty](https://make.fun/bounty/token-radar-01).

<sub>Entered on [make.fun](https://make.fun/?ref=v2p9m0qh&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>

## What it does

`main.ts` reads the sealed DefiLlama snapshot (`/input/snapshot.json`), ranks
the 197 pre-token protocols it finds, and writes the board, the dashboard's
data, and the dossier to `/output`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

## The model — category-ratio v2

Implied value = `TVL × category ratio × momentum × tenure × breadth`

- **Category ratio.** The median market-cap/TVL of the tokenised protocols in
  the same category, winsorized at the 5th/95th percentile and shrunk toward
  the global median (0.214) with a prior weight of 5 — so one 400× outlier
  cannot price a whole category, and a category with a single tokenised peer
  still borrows from the market. Only the 128 protocols with a positive
  market cap count as pricing evidence.
- **Momentum.** `1 + clamp(change_7d, −60, +120) / 150` → 0.60…1.80.
- **Tenure.** How long the protocol has run with no token:
  `1 + 0.45 × √(min(days listed, 1460) / 1460)` → 1.00…1.45.
- **Breadth.** `1 + 0.03 × min(chains − 1, 5)` → 1.00…1.15.

A protocol is ranked only when the snapshot records no token at all (no
market cap, no CoinGecko id, no ticker), and never a bridge, exchange,
liquid-staking product, wrapped or staked product, cross-chain bridge, or a
product named for an issuer whose token already trades (Circle, Tether). The
40-protocol watchlist is the floor: all 40 are ranked, plus the 157 eligible
protocols below the $50M floor with the most TVL.

A log-log fit of market cap on TVL across the tokenised protocols gives
R² 0.19 — too noisy to price from — so the board uses the category medians
above, not the fitted curve.

## The dashboard

- **Top 10 spotlight** — the ten largest launches at a glance, each clickable.
- **The board** — 197 rows, sortable (rank, TVL, 7-day change, age, implied
  value per $ of TVL), filterable by search, category, chain, and watchlist
  only. `WL` marks the 40 watchlist protocols.
- **Detail view** — the value broken down factor by factor (with a waterfall),
  the farm plan with an explicit cost and time on every step, and the plan's
  total gas and active time.
- **Where the value sits** — implied value by category, summed across the board.
- **Already has a token** — the largest tokenised protocols by market cap
  (the market's own values, never ranked), and the protocols that record a
  ticker but no market cap.

Top of the board (14 Nov 2026 snapshot): Steakhouse Financial $2.68B,
Sentora Curator $2.55B, Gauntlet $1.62B, Polymarket International $827M,
Nonce Capital $360M.

## Files

- `main.ts` — the program: reads the snapshot, scores the board, writes
  `board.json`, the dashboard's `data.js`, and `dossier.json`.
- `dashboard/` — the static page: `index.html`, `app.css`, `app.js`,
  `farm.js` (the farm-plan generator, shared by `main.ts` and the page).
- `screenshots/` — the board, a protocol's detail view, and a filtered view.
- `vendor/makefun-board.ts` — the kit's dossier library, copied verbatim.

## Referral

Built by [@ridlo12](https://github.com/Ridlo12) — referral code `v2p9m0qh`
(https://make.fun/r/v2p9m0qh).
