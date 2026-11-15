// farm.js — the farm-plan generator, shared by main.ts (build time) and the
// dashboard (view time), so the steps a reader sees are the steps board.json
// holds. A plan is built from the snapshot's own figures, never from a list of
// names: the protocol's category picks the core action, its main chain picks
// the bridge cost and time, its 7-day change picks the entry timing, its age
// picks the hold length, and its rank picks the position size. Every step
// ends with an explicit Cost and Time, so the plan's price is scannable.
// All steps stay within 20-600 chars.

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
  // Thousands separators by hand: toLocaleString depends on the runtime's
  // locale, and the build must be byte-identical on every machine.
  if (Number.isInteger(n)) {
    return '$' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  return `$${n.toFixed(2)}`;
}

// The core action per category: what the farmer actually does with the money.
const CORE_ACTION = {
  Dexs: (a, n, c, f) => `Swap ${money(a)} through ${n} in two trades of about ${money(a / 2)} each, on different days, so the wallet shows repeat usage rather than a single pass-through.`,
  Lending: (a, n, c, f) => `Supply ${money(a)} as collateral on ${n} and borrow a small amount, under 30% of the collateral, so the position shows both sides of the market; the borrow accrues interest daily.`,
  Yield: (a, n, c, f) => `Deposit ${money(a)} into ${n}'s highest-TVL vault and leave it earning; the yield accrues continuously, so check the position weekly.`,
  RWA: (a, n, c, f) => `Buy ${money(a)} of ${n}'s tokenised asset position and hold it; the position earns its real-world yield over weeks, so keep it open at least a month.`,
  'Risk Curators': (a, n, c, f) => `Deposit ${money(a)} into ${n}'s largest curated vault; the curator manages the allocation, so your job is to stay in and watch the vault's reports.`,
  CDP: (a, n, c, f) => `Open a vault on ${n} with ${money(a)} of collateral and mint stablecoins against it at a conservative ratio, under 50%.`,
  Derivatives: (a, n, c, f) => `Open a small perpetual position of ${money(a)} notional on ${n} with low leverage, 2x or less, and hold it a few days; funding accrues over time.`,
  'Yield Aggregator': (a, n, c, f) => `Deposit ${money(a)} into ${n}'s auto-compounding vault; the aggregator harvests and re-deposits the yield for you.`,
  'Basis Trading': (a, n, c, f) => `Deposit ${money(a)} into ${n}'s basis vault, which earns the funding-rate spread; the position needs days to accrue.`,
  'Prediction Market': (a, n, c, f) => `Place ${money(a)} across two outcome markets on ${n}, splitting the stake so the wallet shows activity on more than one market.`,
  'Onchain Capital Allocator': (a, n, c, f) => `Allocate ${money(a)} through ${n} into its largest strategy and leave it deployed; allocations are reviewed on a schedule.`,
  'Collateral Markets': (a, n, c, f) => `Post ${money(a)} of collateral on ${n} and open a small borrow against it; keep the health factor high.`,
  'CDP Manager': (a, n, c, f) => `Open a managed vault on ${n} with ${money(a)} of collateral and let the manager keep the ratio safe.`,
  Chain: (a, n, c, f) => `Use ${money(a)} in ${n}'s native apps, starting with its largest one, and keep the funds working on the chain for a month.`,
  Payments: (a, n, c, f) => `Route ${money(a)} of payments through ${n} in two or three transfers over a week, so the wallet shows repeat use.`,
  Restaking: (a, n, c, f) => `Restake ${money(a)} through ${n} with an operator that has run for months, and leave it staked.`,
  'Stablecoin Wrapper': (a, n, c, f) => `Wrap ${money(a)} of stablecoins through ${n} and hold the wrapped position for a month.`,
  'Liquidity Manager': (a, n, c, f) => `Deposit ${money(a)} into ${n}'s managed liquidity position in its largest pool and leave it rebalancing for a month.`,
  'Staking Pool': (a, n, c, f) => `Stake ${money(a)} in ${n}'s pool and hold the receipt token; the stake earns the pool's yield while it stays in.`,
  CeDeFi: (a, n, c, f) => `Deposit ${money(a)} into ${n}'s custodial yield product and hold the position; check the custodian's proof of reserves first.`,
  Farm: (a, n, c, f) => `Stake ${money(a)} in ${n}'s farm and harvest the rewards weekly, re-depositing each harvest.`,
  'Anchor BTC': (a, n, c, f) => `Deposit ${money(a)} of BTC into ${n}'s anchor vault and hold the receipt; the position earns while the BTC stays locked.`,
  'Decentralized BTC': (a, n, c, f) => `Bridge ${money(a)} of BTC through ${n} and use the wrapped position in its largest pool for a month.`,
  'Leveraged Farming': (a, n, c, f) => `Open a leveraged farm of ${money(a)} on ${n} at low leverage, 2x or less, and monitor the health factor daily.`,
  'Dual-Token Stablecoin': (a, n, c, f) => `Mint ${money(a)} of ${n}'s stablecoin against collateral and hold it; keep the collateral ratio above the protocol's minimum.`,
  'Collateral Management': (a, n, c, f) => `Deposit ${money(a)} of collateral with ${n} and let its manager keep the position balanced.`,
  'OTC Marketplace': (a, n, c, f) => `Place ${money(a)} in an over-the-counter order on ${n} and settle it on-chain; keep the trade receipt.`,
  'Governance Incentives': (a, n, c, f) => `Lock ${money(a)} in ${n}'s governance vault and vote on the next two proposals, so the wallet shows participation.`,
  Insurance: (a, n, c, f) => `Buy ${money(a)} of cover from ${n} on ${c} and keep the policy for at least a month.`,
  'Crypto Card Issuer': (a, n, c, f) => `Load ${money(a)} onto ${n}'s card and spend it in two or three purchases over a week, so the wallet shows card use.`,
  'Uncollateralized Lending': (a, n, c, f) => `Lend ${money(a)} through ${n}'s credit pool and hold the position; uncollateralised pools carry borrower risk, so keep the amount small.`,
  Indexes: (a, n, c, f) => `Buy ${money(a)} of ${n}'s index token and hold it; the index rebalances on its own schedule.`,
  'Interest Rate Derivatives': (a, n, c, f) => `Buy ${money(a)} of fixed yield through ${n}'s rate market and hold it to maturity.`,
  'Options Vault': (a, n, c, f) => `Deposit ${money(a)} into ${n}'s options vault and leave it through one expiry cycle.`,
  Privacy: (a, n, c, f) => `Use ${money(a)} through ${n}'s private transfer flow once a week for a month, keeping the amounts varied.`,
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
  'Liquidity Manager': 'move half the position into a second pool',
  'Staking Pool': 'stake a slice in a second pool',
  CeDeFi: 'try the product on a second chain it supports',
  Farm: 'stake in a second farm pool',
  'Anchor BTC': 'use the receipt token in a second app',
  'Decentralized BTC': 'bridge a slice back the other way',
  'Leveraged Farming': 'open a second farm at a lower leverage',
  'Dual-Token Stablecoin': 'mint a second stablecoin tranche',
  Indexes: 'buy a second index token',
  'Interest Rate Derivatives': 'buy a second maturity',
  'Options Vault': 'deposit into a second vault',
  Insurance: 'buy a second, smaller cover',
};

function secondFeature(category) {
  return SECOND_FEATURE[category] ?? 'try one more feature the protocol docs list';
}

function holdDaysFor(ageDays) {
  if (ageDays === null) return 30;
  if (ageDays < 180) return 60;
  if (ageDays < 365) return 45;
  return 30;
}

// Entry timing from the protocol's own 7-day change: hot protocols reward a
// fast first deposit, cold ones reward tranches, flat ones a split deposit.
function timingStep(row, amt, fee) {
  const chg = row.change_7d;
  if (chg !== null && chg >= 10) {
    return {
      text: `Move fast: ${row.name}'s TVL grew ${chg.toFixed(1)}% in 7 days, so make the first deposit within 48 hours, before the growth cools and the queue lengthens.`,
      cost: `about ${money(fee)} of gas`,
      time: '10 minutes',
    };
  }
  if (chg !== null && chg <= -10) {
    return {
      text: `TVL fell ${Math.abs(chg).toFixed(1)}% in 7 days, so enter in three tranches of about ${money(amt / 3)} each, a few days apart, instead of one deposit.`,
      cost: `about ${money(fee * 3)} of gas across the three deposits`,
      time: '10 minutes per tranche',
    };
  }
  return {
    text: `Split the deposit into two halves of about ${money(amt / 2)} on two different days, so the wallet shows two entries rather than one.`,
    cost: `about ${money(fee * 2)} of gas across the two deposits`,
    time: '10 minutes per deposit',
  };
}

function withCost(step) {
  return `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
}

/**
 * Build the farm plan for one board row. `row` carries slug, name, category,
 * chains (array, main chain first), tvl_usd, change_7d, implied_value_usd,
 * rank and age_days. Returns 6 strings, each 20-600 characters once trimmed.
 */
export function buildFarmSteps(row) {
  const amt = positionSize(row.rank);
  const chain = row.chains && row.chains.length > 0 ? row.chains[0] : 'Ethereum';
  const bridge = bridgeFor(chain);
  const fee = bridge.usd;
  const hold = holdDaysFor(row.age_days);
  const core = CORE_ACTION[row.category] ?? ((a, n, c, f) =>
    `Use ${n} with ${money(a)}, deposit, swap or stake, whichever its docs list first, and keep the position open for a month.`);
  return [
    withCost({
      text: `Bridge ${money(amt)} in stablecoins to ${chain}, ${row.name}'s main chain, using the chain's official bridge.`,
      cost: `about ${money(bridge.usd)} in gas`,
      time: `${bridge.minutes} minutes before the funds arrive`,
    }),
    withCost({
      text: core(amt, row.name, chain, fee),
      cost: `about ${money(fee)} in gas`,
      time: '15 minutes to set up',
    }),
    withCost(timingStep(row, amt, fee)),
    withCost({
      text: `Repeat the core action once a week for four weeks, keeping at least ${money(amt)} in the position the whole time, and hold the position at least ${hold} days; snapshot-based programs usually reward steady duration more than one large deposit.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    }),
    withCost({
      text: `Use a second feature of ${row.name} once, ${secondFeature(row.category)}, so the wallet shows more than one action type.`,
      cost: `about ${money(fee)} in gas`,
      time: '10 minutes',
    }),
    withCost({
      text: `Set an exit trigger before you start: if ${row.name}'s TVL falls more than 25% from the snapshot's ${money(row.tvl_usd)}, cut the position in half; confirm the contract address on the protocol's DefiLlama page before the first approval, never share a seed phrase, and revoke the token approval after the campaign ends.`,
      cost: 'nothing to set the trigger',
      time: '5 minutes',
    }),
  ];
}

/**
 * The plan's totals, from the same figures buildFarmSteps uses: gas in USD
 * and active minutes, plus the hold length in days. The dashboard shows
 * these beside the plan; they are not part of board.json.
 */
export function planSummary(row) {
  const chain = row.chains && row.chains.length > 0 ? row.chains[0] : 'Ethereum';
  const bridge = bridgeFor(chain);
  const fee = bridge.usd;
  // Bridge + core deposit + split second deposit + 4 weekly actions + second feature.
  const gas = bridge.usd + fee + fee + 8 + fee;
  const minutes = bridge.minutes + 15 + 10 + 40 + 10 + 5;
  return { gasUsd: Math.round(gas * 100) / 100, minutes, holdDays: holdDaysFor(row.age_days) };
}
