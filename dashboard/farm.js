// farm.js — the farm-plan generator, shared by main.ts (build time) and the
// dashboard (view time), so the steps a reader sees are the steps board.json
// holds. A plan is built from the snapshot's own figures, never from a list of
// names: the protocol's category picks the core action, its main chain picks
// the bridge cost and time, and its rank picks the position size. Every step
// names a cost or a time where one exists. All steps stay within 20-600 chars.

const POSITION_BY_RANK = [
  { maxRank: 25, usd: 1000 },
  { maxRank: 100, usd: 500 },
  { maxRank: Number.POSITIVE_INFINITY, usd: 100 },
];

export function positionSize(rank) {
  for (const tier of POSITION_BY_RANK) {
    if (rank <= tier.maxRank) return tier.usd;
  }
  return 100;
}

// Approximate one-way bridge cost and time per chain, in USD and minutes.
// These are rough public figures for moving stablecoins onto the chain, not
// quotes: the step text says "about", and the plan never promises an exact fee.
const CHAIN_BRIDGE = {
  Ethereum: { usd: 4, minutes: 12 },
  Solana: { usd: 0.02, minutes: 1 },
  Base: { usd: 0.15, minutes: 2 },
  Arbitrum: { usd: 0.2, minutes: 2 },
  Optimism: { usd: 0.2, minutes: 2 },
  Binance: { usd: 0.1, minutes: 1 },
  Polygon: { usd: 0.05, minutes: 2 },
  Avalanche: { usd: 0.3, minutes: 2 },
  'Hyperliquid L1': { usd: 0.05, minutes: 1 },
  Bitcoin: { usd: 2, minutes: 30 },
  Monad: { usd: 0.05, minutes: 1 },
  Berachain: { usd: 0.1, minutes: 2 },
  Sonic: { usd: 0.05, minutes: 1 },
  Sei: { usd: 0.02, minutes: 1 },
  Unichain: { usd: 0.15, minutes: 2 },
  Ink: { usd: 0.15, minutes: 2 },
  Worldchain: { usd: 0.15, minutes: 2 },
  Linea: { usd: 0.2, minutes: 2 },
  Scroll: { usd: 0.2, minutes: 2 },
  Zksync: { usd: 0.2, minutes: 2 },
  Fantom: { usd: 0.05, minutes: 2 },
  Gnosis: { usd: 0.05, minutes: 2 },
  Aptos: { usd: 0.02, minutes: 1 },
  Sui: { usd: 0.02, minutes: 1 },
  Tron: { usd: 0.5, minutes: 3 },
  Cronos: { usd: 0.1, minutes: 2 },
  Mantle: { usd: 0.15, minutes: 2 },
  Blast: { usd: 0.15, minutes: 2 },
  Mode: { usd: 0.15, minutes: 2 },
  Fraxtal: { usd: 0.15, minutes: 2 },
  Starknet: { usd: 0.5, minutes: 5 },
  zkSync: { usd: 0.2, minutes: 2 },
  Kava: { usd: 0.1, minutes: 2 },
  Celo: { usd: 0.05, minutes: 2 },
  Moonbeam: { usd: 0.1, minutes: 2 },
  Oasis: { usd: 0.05, minutes: 2 },
};

const DEFAULT_BRIDGE = { usd: 0.5, minutes: 3 };

export function bridgeFor(chain) {
  return CHAIN_BRIDGE[chain] ?? DEFAULT_BRIDGE;
}

function money(n) {
  // Thousands separator by hand: toLocaleString depends on the runtime's
  // locale, and the build must be byte-identical on every machine.
  if (n >= 1000) {
    const s = String(Math.round(n));
    return `$${s.slice(0, -3)},${s.slice(-3)}`;
  }
  if (Number.isInteger(n)) return `$${n}`;
  return `$${n.toFixed(2)}`;
}

// The core action per category: what the farmer actually does with the money.
// A category with no entry here uses the default, which stays honest about it.
const CORE_ACTION = {
  Dexs: (amt, name, chain, fee) =>
    `Swap ${money(amt)} through ${name} in two trades of about ${money(amt / 2)} each, on different days, so the wallet shows repeat usage rather than a single pass-through; each swap costs about ${money(fee)} in gas and a few minutes.`,
  Lending: (amt, name, chain, fee) =>
    `Supply ${money(amt)} as collateral on ${name} and borrow a small amount, under 30% of the collateral, so the position shows both sides of the market; the two transactions cost about ${money(fee)} in gas and 10 minutes, and the borrow accrues interest daily.`,
  Yield: (amt, name, chain, fee) =>
    `Deposit ${money(amt)} into ${name}'s highest-TVL vault and leave it earning; the yield accrues continuously, so check the position weekly, and budget about ${money(fee)} in gas for the deposit and 5 minutes.`,
  RWA: (amt, name, chain, fee) =>
    `Buy ${money(amt)} of ${name}'s tokenised asset position and hold it; the position earns its real-world yield over weeks, so keep it open at least a month, and budget about ${money(fee)} in gas and 10 minutes.`,
  'Risk Curators': (amt, name, chain, fee) =>
    `Deposit ${money(amt)} into ${name}'s largest curated vault; the curator manages the allocation, so your job is to stay in, and budget about ${money(fee)} in gas for the deposit and 5 minutes.`,
  CDP: (amt, name, chain, fee) =>
    `Open a vault on ${name} with ${money(amt)} of collateral and mint stablecoins against it at a conservative ratio, under 50%; the mint costs about ${money(fee)} in gas and takes 10 minutes.`,
  Derivatives: (amt, name, chain, fee) =>
    `Open a small perpetual position of ${money(amt)} notional on ${name} with low leverage, 2x or less, and hold it a few days; funding accrues over time, so budget about ${money(fee)} in gas and 10 minutes.`,
  'Yield Aggregator': (amt, name, chain, fee) =>
    `Deposit ${money(amt)} into ${name}'s auto-compounding vault; the aggregator harvests and re-deposits the yield for you, so budget about ${money(fee)} in gas and 5 minutes.`,
  'Basis Trading': (amt, name, chain, fee) =>
    `Deposit ${money(amt)} into ${name}'s basis vault, which earns the funding-rate spread; the position needs days to accrue, so budget about ${money(fee)} in gas and 5 minutes.`,
  'Prediction Market': (amt, name, chain, fee) =>
    `Place ${money(amt)} across two outcome markets on ${name}, splitting the stake so the wallet shows activity on more than one market; each bet costs about ${money(fee)} in gas and a few minutes.`,
  'Onchain Capital Allocator': (amt, name, chain, fee) =>
    `Allocate ${money(amt)} through ${name} into its largest strategy and leave it deployed; allocations are reviewed on a schedule, so budget about ${money(fee)} in gas and 10 minutes.`,
  'Collateral Markets': (amt, name, chain, fee) =>
    `Post ${money(amt)} of collateral on ${name} and open a small borrow against it; keep the health factor high, and budget about ${money(fee)} in gas and 10 minutes.`,
  'CDP Manager': (amt, name, chain, fee) =>
    `Open a managed vault on ${name} with ${money(amt)} of collateral and let the manager keep the ratio safe; the setup costs about ${money(fee)} in gas and takes 10 minutes.`,
  Chain: (amt, name, chain, fee) =>
    `Use ${money(amt)} in ${name}'s native apps, starting with its largest one, and keep the funds working on the chain for a month; budget about ${money(fee)} in gas and 15 minutes to set up.`,
  Payments: (amt, name, chain, fee) =>
    `Route ${money(amt)} of payments through ${name} in two or three transfers over a week, so the wallet shows repeat use; each transfer costs about ${money(fee)} and settles in minutes.`,
  Restaking: (amt, name, chain, fee) =>
    `Restake ${money(amt)} through ${name} with an operator that has run for months, and leave it staked; the setup costs about ${money(fee)} in gas and takes 10 minutes.`,
  'Stablecoin Wrapper': (amt, name, chain, fee) =>
    `Wrap ${money(amt)} of stablecoins through ${name} and hold the wrapped position for a month; the wrap costs about ${money(fee)} in gas and takes a few minutes.`,
  'Cross Chain Bridge': (amt, name, chain, fee) =>
    `Bridge ${money(amt)} through ${name} to a second chain and back over two weeks, so the wallet shows repeat crossings; each crossing costs about ${money(fee)} in gas and a few minutes.`,
};

// A second feature to try once, so the wallet shows more than one action type.
const SECOND_FEATURE = {
  Dexs: 'provide liquidity in one pool for a week',
  Lending: 'repay the borrow, then supply again',
  Yield: 'claim the yield once, then re-deposit it',
  RWA: 'hold the position through one reporting cycle',
  'Risk Curators': 'move a slice into a second curated vault',
  CDP: 'adjust the collateral ratio once',
  Derivatives: 'close the position, then open a smaller one the other way',
  'Yield Aggregator': 'switch half the deposit into a second vault',
  'Basis Trading': 'hold the basis position through one funding cycle',
  'Prediction Market': 'take a position on a second market',
  'Onchain Capital Allocator': 'allocate a slice to a second strategy',
  'Collateral Markets': 'post a second collateral type',
  'CDP Manager': 'open a second managed vault',
  Chain: 'use one more native app on the chain',
  Payments: 'make a second payment through the rail',
  Restaking: 'restake a slice with a second operator',
  'Stablecoin Wrapper': 'wrap a second stablecoin',
  'Cross Chain Bridge': 'bridge a small amount back the other way',
};

function secondFeature(category) {
  return SECOND_FEATURE[category] ?? 'try one more feature the protocol docs list';
}

/**
 * Build the farm plan for one board row. `row` carries slug, name, category,
 * chains (array, main chain first), tvl_usd, implied_value_usd and rank.
 * Returns 6 strings, each 20-600 characters once trimmed.
 */
export function buildFarmSteps(row) {
  const amt = positionSize(row.rank);
  const chain = row.chains && row.chains.length > 0 ? row.chains[0] : 'Ethereum';
  const bridge = bridgeFor(chain);
  const fee = bridge.usd;
  const core = CORE_ACTION[row.category] ?? ((a, n, c, f) =>
    `Use ${n} with ${money(a)}, deposit, swap or stake, whichever its docs list first, and keep the position open for a month; budget about ${money(f)} in gas and 10 minutes.`);
  return [
    `Bridge ${money(amt)} in stablecoins to ${chain}, ${row.name}'s main chain, using the chain's official bridge; expect about ${money(bridge.usd)} in gas and ${bridge.minutes} minutes before the funds arrive.`,
    core(amt, row.name, chain, fee),
    `Repeat the core action once a week for four weeks, keeping at least ${money(amt)} in the position the whole time; snapshot-based programs usually reward steady duration more than one large deposit.`,
    `Use a second feature of ${row.name} once, ${secondFeature(row.category)}, so the wallet shows more than one action type; budget about ${money(fee)} in gas and 10 minutes.`,
    `Record every transaction hash, the dates, and the position size in a simple sheet, and check ${row.name}'s dashboard weekly for new tasks, quests or point campaigns.`,
    `Before the first approval, confirm the contract address on the protocol's DefiLlama page, never share a seed phrase, and revoke the token approval after the campaign ends.`,
  ];
}
