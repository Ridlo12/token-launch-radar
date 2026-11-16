// main.ts — Token Launch Radar, entry for make.fun token-radar-01.
//
// Reads the sealed DefiLlama snapshot, finds the protocols that still
// record no token and are not wrapped or staked products of one that
// trades, ranks them by an implied launch value, and writes the board,
// the dashboard and its dossier.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot>
//
// Node 22, standard library only, no network. The program runs twice and
// both runs must write the same bytes: nothing here reads the clock, the
// environment beyond MAKEFUN_OUTPUT_DIR, or any randomness.

import { readFileSync, writeFileSync, mkdirSync, cpSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-board.ts";
import farmModule from "./dashboard/farm.js";

const farmSteps = (
  farmModule as unknown as { farmSteps: (row: FarmRow) => string[] }
).farmSteps;

// ------------------------------------------------------------------ types

interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

interface Snapshot {
  as_of: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

// The row farmSteps takes: everything a farm plan needs to know, and
// nothing it does not. The dashboard builds the same shape from data.js.
interface FarmRow {
  slug: string;
  name: string;
  category: string | null;
  mainChain: string;
  chainCount: number;
  tvlUsd: number;
  change7d: number | null;
  daysListed: number | null;
  rank: number;
  impliedUsd: number;
}

interface Valued extends FarmRow {
  ratio: number;
  momentum: number;
  tenure: number;
  breadth: number;
}

// ------------------------------------------------------------------ helpers

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

// Median of a list of numbers, by value order.
function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

// The p-th quantile of an already sorted list, by linear interpolation
// between the two nearest ranks.
function quantileOf(sorted: number[], p: number): number {
  const at = (sorted.length - 1) * p;
  const lo = Math.floor(at);
  const hi = Math.min(lo + 1, sorted.length - 1);
  const frac = at - lo;
  return sorted[lo]! * (1 - frac) + sorted[hi]! * frac;
}

// Whole days between two YYYY-MM-DD dates, by UTC midnight.
function daysBetween(from: string, to: string): number {
  const a = Date.parse(from + "T00:00:00Z");
  const b = Date.parse(to + "T00:00:00Z");
  return Math.round((b - a) / 86400000);
}

// ------------------------------------------------------------------ the model
//
// implied value = TVL x ratio x momentum x tenure x breadth
//
// ratio     The category's median market-cap-per-TVL over its tokenised
//           protocols, winsorized at the 5th/95th percentile of the
//           category medians, then shrunk toward the global median with a
//           prior weight of 5. A category with few priced peers is pulled
//           toward the global median instead of trusting one outlier.
// momentum  1 + clamp(change_7d, -60, +120) / 150, so a protocol growing
//           fast earns up to 1.80x and one shrinking fast pays down to
//           0.60x; an unreported change earns 1.
// tenure    1 + 0.45 x sqrt(min(days listed, 1460) / 1460): the longer a
//           protocol has run with no token, the more its launch is worth,
//           capped at four years.
// breadth   1 + 0.03 x min(chains - 1, 5): a protocol live on more chains
//           reaches more users, worth a little more per chain.

function buildRatioTable(
  protocols: SnapshotProtocol[],
): { ratioOf: Map<string | null, number>; global: number; peersOf: Map<string | null, number> } {
  const pricedByCategory = new Map<string | null, number[]>();
  const allPriced: number[] = [];
  for (const p of protocols) {
    if (p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0) {
      const ratio = p.mcap_usd / p.tvl_usd;
      allPriced.push(ratio);
      const list = pricedByCategory.get(p.category) ?? [];
      list.push(ratio);
      pricedByCategory.set(p.category, list);
    }
  }
  const global = medianOf(allPriced);
  const medians = [...pricedByCategory.values()].map((list) => medianOf(list));
  medians.sort((a, b) => a - b);
  const low = quantileOf(medians, 0.05);
  const high = quantileOf(medians, 0.95);
  const ratioOf = new Map<string | null, number>();
  const peersOf = new Map<string | null, number>();
  for (const [category, list] of pricedByCategory) {
    const winsorized = clamp(medianOf(list), low, high);
    // Shrink toward the global median: (n x median + 5 x global) / (n + 5).
    ratioOf.set(category, (list.length * winsorized + 5 * global) / (list.length + 5));
    peersOf.set(category, list.length);
  }
  return { ratioOf, global, peersOf };
}

// ------------------------------------------------------------------ candidates
//
// A protocol records no token when mcap, gecko_id and symbol are all null.
// It is still not a subject when it is a wrapped, staked or bridged
// product of a token that already trades: the excluded categories, an
// exchange's name at the start, a version marker at the end, or a whole
// word wrapped / staked / staking in its name.

const EXCLUDED_CATEGORIES = new Set([
  "Bridge",
  "Canonical Bridge",
  "Cross Chain Bridge",
  "Liquid Staking",
  "Liquid Restaking",
  "Restaked BTC",
  "CEX",
]);

const ISSUER_PREFIXES = [
  "Binance",
  "Coinbase",
  "Bybit",
  "Kraken",
  "Bitget",
  "OKX",
  "Bitfinex",
  "Gemini",
  "Circle",
  "Tether",
];

const VERSION_TAIL = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

function isCandidate(p: SnapshotProtocol): boolean {
  if (p.mcap_usd !== null || p.gecko_id !== null || p.symbol !== null) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (ISSUER_PREFIXES.some((prefix) => p.name.startsWith(prefix))) return false;
  if (VERSION_TAIL.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  return true;
}

// ------------------------------------------------------------------ main

function main(): void {
  const argv = process.argv.slice(2);
  const inputAt = argv.indexOf("--input");
  // The grader runs `node main.ts` with no arguments: default to the
  // sealed snapshot the harness mounts at /input/snapshot.json.
  const inputPath =
    inputAt !== -1 && inputAt + 1 < argv.length
      ? argv[inputAt + 1]!
      : "/input/snapshot.json";
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "out";
  const root = dirname(fileURLToPath(import.meta.url));

  const snapshot = JSON.parse(readFileSync(inputPath, "utf8")) as Snapshot;
  const asOf = snapshot.as_of;
  const { ratioOf, global, peersOf } = buildRatioTable(snapshot.protocols);

  const valued: Valued[] = [];
  for (const p of snapshot.protocols) {
    if (!isCandidate(p)) continue;
    const ratio = ratioOf.get(p.category) ?? global;
    const momentum =
      p.change_7d === null ? 1 : 1 + clamp(p.change_7d, -60, 120) / 150;
    let tenure = 1;
    let daysListed: number | null = null;
    if (p.listed_at !== null) {
      daysListed = Math.max(0, daysBetween(p.listed_at, asOf));
      tenure = 1 + 0.45 * Math.sqrt(Math.min(daysListed, 1460) / 1460);
    }
    const breadth = 1 + 0.03 * Math.min(Math.max(p.chains.length - 1, 0), 5);
    const impliedUsd = Math.round(p.tvl_usd * ratio * momentum * tenure * breadth);
    valued.push({
      slug: p.slug,
      name: p.name,
      category: p.category,
      mainChain: p.chains[0] ?? "Ethereum",
      chainCount: p.chains.length,
      tvlUsd: p.tvl_usd,
      change7d: p.change_7d,
      daysListed,
      rank: 0,
      impliedUsd,
      ratio,
      momentum,
      tenure,
      breadth,
    });
  }

  // Rank by implied value, most valuable first; a tie breaks by slug so
  // the order is the same on every run.
  valued.sort((a, b) => b.impliedUsd - a.impliedUsd || (a.slug < b.slug ? -1 : 1));
  valued.forEach((row, i) => {
    row.rank = i + 1;
  });

  const rows = valued.map((row) => ({
    slug: row.slug,
    name: row.name,
    rank: row.rank,
    implied_value_usd: row.impliedUsd,
    farm_steps: farmSteps(row),
  }));

  // The watchlist is the floor: every one of its slugs must be on the board.
  const onBoard = new Set(rows.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((slug) => !onBoard.has(slug));
  if (missing.length > 0) {
    throw new Error("watchlist slugs missing from the board: " + missing.join(", "));
  }

  // ---- dashboard data: compact arrays, so the page stays under 64 KiB.
  const categoryNames = new Set<string>();
  for (const row of valued) categoryNames.add(row.category ?? "Uncategorised");
  const livePriced = snapshot.protocols
    .filter((p) => p.mcap_usd !== null && p.mcap_usd > 0)
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0))
    .slice(0, 12);
  for (const p of livePriced) categoryNames.add(p.category ?? "Uncategorised");
  const cats = [...categoryNames].sort();
  const catIndex = new Map(cats.map((c, i) => [c, i]));
  const chainNames = new Set<string>();
  for (const row of valued) chainNames.add(row.mainChain);
  const chains = [...chainNames].sort();
  const chainIndex = new Map(chains.map((c, i) => [c, i]));

  const data = {
    meta: {
      asOf,
      floorUsd: snapshot.floor_usd,
      rows: valued.length,
      globalRatio: Math.round(global * 10000) / 10000,
    },
    cats,
    catRatio: cats.map((c) => {
      const r = ratioOf.get(c === "Uncategorised" ? null : c) ?? global;
      return Math.round(r * 1e6) / 1e6;
    }),
    catPeers: cats.map((c) => peersOf.get(c === "Uncategorised" ? null : c) ?? 0),
    chains,
    rows: valued.map((row) => [
      row.slug,
      row.name,
      catIndex.get(row.category ?? "Uncategorised"),
      chainIndex.get(row.mainChain),
      row.chainCount,
      row.tvlUsd,
      row.change7d === null ? null : Math.round(row.change7d * 100) / 100,
      row.daysListed,
      row.impliedUsd,
    ]),
    live: livePriced.map((p) => [
      p.name,
      p.mcap_usd,
      catIndex.get(p.category ?? "Uncategorised"),
    ]),
  };
  const dataJs = "window.RADAR = " + JSON.stringify(data) + ";\n";

  // ---- write the outputs.
  mkdirSync(join(outDir, "dashboard"), { recursive: true });
  mkdirSync(join(outDir, "screenshots"), { recursive: true });
  cpSync(join(root, "dashboard"), join(outDir, "dashboard"), { recursive: true });
  cpSync(join(root, "screenshots"), join(outDir, "screenshots"), { recursive: true });
  writeFileSync(join(outDir, "board.json"), JSON.stringify({ rows }, null, 2) + "\n");
  writeFileSync(join(outDir, "dashboard", "data.js"), dataJs);
  writeFileSync(
    join(outDir, "dossier.json"),
    buildDossier(outDir, { text_max_bytes: 65536 }),
  );

  console.log("rows: " + rows.length);
  console.log("top3: " + valued.slice(0, 3).map((r) => r.slug + " $" + r.impliedUsd).join(", "));
  console.log("watchlist covered: " + snapshot.watchlist.length + "/" + snapshot.watchlist.length);
  console.log("data.js bytes: " + Buffer.byteLength(dataJs, "utf8"));
}

main();
