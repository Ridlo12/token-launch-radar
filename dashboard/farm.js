// farm.js — farm-plan generator for the Token Launch Radar v3 entry.
//
// Shared by main.ts (build time) and the dashboard (view time), so the steps
// a reader sees are the steps board.json holds. A plan is built from the
// snapshot's own figures, never from a list of names: the protocol's category
// picks the core action, the weekly rhythm and the risk check; its main chain
// picks the bridge cost and time; its 7-day change picks the entry timing;
// its age picks the hold length; and its rank picks the position size. Every
// step ends with an explicit Cost and Time. All steps stay within 20-600 chars.

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

// Rough one-way cost and time to move stablecoins onto a chain, in USD and
// minutes — approximate public figures, not quotes. Only chains that are a
// main chain for some board row are listed; anything else uses the default.
// (v2 listed 'Worldchain' and 'Zksync', which never match the snapshot's
// 'World Chain' and 'zkSync Era' — fixed here.)
const CHAIN_BRIDGE = {
  Ethereum: { usd: 4, minutes: 12 },
  Solana: { usd: 0.02, minutes: 1 },
  Base: { usd: 0.15, minutes: 2 },
  Arbitrum: { usd: 0.2, minutes: 2 },
  Binance: { usd: 0.1, minutes: 1 },
  Polygon: { usd: 0.05, minutes: 2 },
  Avalanche: { usd: 0.3, minutes: 2 },
  'Hyperliquid L1': { usd: 0.05, minutes: 1 },
  Bitcoin: { usd: 2, minutes: 30 },
  Monad: { usd: 0.05, minutes: 1 },
  Berachain: { usd: 0.1, minutes: 2 },
  Ink: { usd: 0.15, minutes: 2 },
  'World Chain': { usd: 0.15, minutes: 2 },
  'zkSync Era': { usd: 0.2, minutes: 2 },
  Aptos: { usd: 0.02, minutes: 1 },
  Sui: { usd: 0.02, minutes: 1 },
  Tron: { usd: 0.5, minutes: 3 },
  Mantle: { usd: 0.15, minutes: 2 },
  Starknet: { usd: 0.5, minutes: 5 },
  Kava: { usd: 0.1, minutes: 2 },
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
// Only the 32 categories on the board are listed; anything else falls back
// to the generic action in buildFarmSteps.
const CORE_ACTION = {
  Dexs: (a, n) => `Swap ${money(a)} through ${n} in two trades of about ${money(a / 2)} each, on different days, so the wallet shows repeat use.`,
  Lending: (a, n) => `Supply ${money(a)} as collateral on ${n} and borrow under 30% of it, so the position shows both sides of the market; the borrow accrues interest daily.`,
  Yield: (a, n) => `Deposit ${money(a)} into ${n}'s highest-TVL vault and leave it earning; check the position weekly.`,
  RWA: (a, n) => `Buy ${money(a)} of ${n}'s tokenised asset position and hold it; keep it open at least a month.`,
  'Risk Curators': (a, n) => `Deposit ${money(a)} into ${n}'s largest curated vault; the curator manages the allocation, so stay in and read the vault's reports.`,
  CDP: (a, n) => `Open a vault on ${n} with ${money(a)} of collateral and mint stablecoins at a conservative ratio, under 50%.`,
  Derivatives: (a, n) => `Open a small perpetual of ${money(a)} notional on ${n} at 2x leverage or less, and hold it a few days; funding accrues over time.`,
  'Yield Aggregator': (a, n) => `Deposit ${money(a)} into ${n}'s auto-compounding vault; it harvests the yield and re-deposits it.`,
  'Basis Trading': (a, n) => `Deposit ${money(a)} into ${n}'s basis vault, which earns the funding-rate spread; give it days to accrue.`,
  'Prediction Market': (a, n) => `Place ${money(a)} across two outcome markets on ${n}, splitting the stake so the wallet shows more than one market.`,
  'Onchain Capital Allocator': (a, n) => `Allocate ${money(a)} through ${n} into its largest strategy and leave it deployed; it is reviewed on a schedule.`,
  'Collateral Markets': (a, n) => `Post ${money(a)} of collateral on ${n} and open a small borrow; keep the health factor high.`,
  'CDP Manager': (a, n) => `Open a managed vault on ${n} with ${money(a)} of collateral; the manager keeps the ratio safe.`,
  Chain: (a, n) => `Use ${money(a)} in ${n}'s native apps, starting with its largest, and keep the funds working for a month.`,
  Payments: (a, n) => `Route ${money(a)} of payments through ${n} in two or three transfers over a week.`,
  Restaking: (a, n) => `Restake ${money(a)} through ${n} with an operator that has run for months.`,
  'Stablecoin Wrapper': (a, n) => `Wrap ${money(a)} of stablecoins through ${n} and hold the wrapped position.`,
  'Liquidity Manager': (a, n) => `Deposit ${money(a)} into ${n}'s managed liquidity position in its largest pool; leave it rebalancing for a month.`,
  'Staking Pool': (a, n) => `Stake ${money(a)} in ${n}'s pool and hold the receipt token; it earns the pool's yield while it stays in.`,
  CeDeFi: (a, n) => `Deposit ${money(a)} into ${n}'s custodial yield product and hold the position; check the custodian's proof of reserves first.`,
  Farm: (a, n) => `Stake ${money(a)} in ${n}'s farm; harvest the rewards weekly and re-deposit each harvest.`,
  'Anchor BTC': (a, n) => `Deposit ${money(a)} of BTC into ${n}'s anchor vault and hold the receipt; it earns while the BTC stays locked.`,
  'Decentralized BTC': (a, n) => `Bridge ${money(a)} of BTC through ${n} and use the wrapped position in its largest pool.`,
  'Leveraged Farming': (a, n) => `Open a leveraged farm of ${money(a)} on ${n} at 2x or less, and monitor the health factor daily.`,
  'Dual-Token Stablecoin': (a, n) => `Mint ${money(a)} of ${n}'s stablecoin against collateral; keep the ratio above the protocol's minimum.`,
  'OTC Marketplace': (a, n) => `Place ${money(a)} in an over-the-counter order on ${n} and settle it on-chain; keep the trade receipt.`,
  'Governance Incentives': (a, n) => `Lock ${money(a)} in ${n}'s governance vault and vote on the next two proposals.`,
  Insurance: (a, n) => `Buy ${money(a)} of cover from ${n} and keep the policy for at least a month.`,
  'Crypto Card Issuer': (a, n) => `Load ${money(a)} onto ${n}'s card and spend it in two or three purchases over a week.`,
  'Uncollateralized Lending': (a, n) => `Lend ${money(a)} through ${n}'s credit pool and hold it; uncollateralised pools carry borrower risk, so keep the amount small.`,
  Indexes: (a, n) => `Buy ${money(a)} of ${n}'s index token and hold it; it rebalances on its own schedule.`,
  'Interest Rate Derivatives': (a, n) => `Buy ${money(a)} of fixed yield through ${n}'s rate market and hold it to maturity.`,
};

// What to do every week, per category: the plan's rhythm differs by what the
// protocol is, instead of one generic "repeat the core action" line.
const WEEKLY_ACTION = {
  Dexs: 'swap a little again, in a different pool',
  Lending: 'top up collateral, check the borrow rate',
  Yield: 'claim the yield and re-deposit it',
  RWA: 'hold, and read the monthly asset report',
  'Risk Curators': 'read the vault report, check the allocation',
  CDP: 'check the ratio, top up if it slipped',
  Derivatives: 'roll into the next funding period',
  'Yield Aggregator': 'let it compound, check the APY held up',
  'Basis Trading': 'hold through one funding cycle',
  'Prediction Market': 'take a small position on a fresh market',
  'Onchain Capital Allocator': 'review the report, keep it deployed',
  'Collateral Markets': 'check the health factor, add collateral if it fell',
  'CDP Manager': 'let the manager work, check the ratio',
  Chain: 'use one more native app each week',
  Payments: 'route one more payment each week',
  Restaking: 'check the operator is still validating',
  'Stablecoin Wrapper': 'hold the wrap, check the peg',
  'Liquidity Manager': 'check the pool is rebalancing in range',
  'Staking Pool': 'check the yield, keep the receipt held',
  CeDeFi: 'check the proof of reserves is published',
  Farm: 'harvest and re-deposit the rewards',
  'Anchor BTC': 'check the receipt still tracks the BTC',
  'Decentralized BTC': 'keep the wrap in the pool, check the peg',
  'Leveraged Farming': 'check the health factor, deleverage if it slipped',
  'Dual-Token Stablecoin': 'check the stablecoin holds its peg',
  'OTC Marketplace': 'settle one small order a week if listed',
  'Governance Incentives': 'vote on each new proposal',
  Insurance: 'keep the policy live, note the expiry',
  'Crypto Card Issuer': 'spend a small amount on the card weekly',
  'Uncollateralized Lending': 'check the default rate has not jumped',
  Indexes: 'hold the index, check the rebalance note',
  'Interest Rate Derivatives': 'hold the fixed yield to maturity',
};

function weeklyAction(category) {
  return WEEKLY_ACTION[category] ?? 'repeat the core action once, a little differently';
}

// A second feature to try once, so the wallet shows more than one action type.
const SECOND_FEATURE = {
  Dexs: 'provide liquidity in one pool for a week',
  Lending: 'repay the borrow, then supply again',
  Yield: 'claim the yield once, then re-deposit it',
  RWA: 'hold the position through one reporting cycle',
  'Risk Curators': 'move a slice to a second vault',
  CDP: 'adjust the collateral ratio once',
  Derivatives: 'close, then open a smaller one the other way',
  'Yield Aggregator': 'switch half into a second vault',
  'Basis Trading': 'hold the basis position through one funding cycle',
  'Prediction Market': 'take a position on a second market',
  'Onchain Capital Allocator': 'allocate a slice to a second one',
  'Collateral Markets': 'post a second collateral type',
  'CDP Manager': 'open a second managed vault',
  Chain: 'use one more native app on the chain',
  Payments: 'make a second payment through the rail',
  Restaking: 'restake a slice with a second operator',
  'Stablecoin Wrapper': 'wrap a second stablecoin',
  'Liquidity Manager': 'move half into a second pool',
  'Staking Pool': 'stake a slice in a second pool',
  CeDeFi: 'try it on a second chain',
  Farm: 'stake in a second farm pool',
  'Anchor BTC': 'use the receipt token in a second app',
  'Decentralized BTC': 'bridge a slice back',
  'Leveraged Farming': 'open a second farm, lower leverage',
  'Dual-Token Stablecoin': 'mint a second stablecoin tranche',
  Indexes: 'buy a second index token',
  'Interest Rate Derivatives': 'buy a second maturity',
};

function secondFeature(category) {
  return SECOND_FEATURE[category] ?? 'try one more feature the protocol docs list';
}

// The risk worth watching, per category: the exit trigger in step 6 names
// the one number that tells the farmer the protocol itself is weakening.
const RISK_CHECK = {
  Dexs: 'Watch pool depth: slippage over 1% on your size means trade smaller.',
  Lending: 'Watch the health factor: above 2 is fine, below 1.5 top up or repay.',
  Yield: 'Watch the vault APY: a sudden collapse means the rewards ran out.',
  RWA: 'Watch the asset report: a missed report is a reason to leave.',
  'Risk Curators': 'Watch the vault report: a curator gone quiet is a red flag.',
  CDP: 'Watch the collateral ratio: near the liquidation line, top up at once.',
  Derivatives: 'Watch funding: long negative funding eats the position.',
  'Yield Aggregator': 'Watch vault TVL: a sharp fall can mean the strategy broke.',
  'Basis Trading': 'Watch the spread: flat for weeks means the trade pays nothing.',
  'Prediction Market': 'Watch volume: a market with none is hard to exit.',
  'Onchain Capital Allocator': 'Watch the report: an allocator gone quiet is a reason to leave.',
  'Collateral Markets': 'Watch the health factor: below 1.5, top up or repay.',
  'CDP Manager': 'Watch manager alerts: if it stops adjusting, manage the ratio yourself.',
  Chain: 'Watch chain TVL: a chain losing TVL drags its apps down.',
  Payments: 'Watch settlement time: slow settlements mean the rail strains.',
  Restaking: 'Watch the operator: slashing or long downtime means move.',
  'Stablecoin Wrapper': 'Watch the peg: a wrapper off peg for days is broken.',
  'Liquidity Manager': 'Watch the range: out of range earns nothing.',
  'Staking Pool': 'Watch pool yield: a sudden drop means rewards ended.',
  CeDeFi: 'Watch proof of reserves: if it stops updating, withdraw.',
  Farm: 'Watch the reward token price: a collapse makes the harvest worth little.',
  'Anchor BTC': 'Watch the receipt price: a depeg from BTC means exit.',
  'Decentralized BTC': 'Watch the bridge peg: off peg for days means broken.',
  'Leveraged Farming': 'Watch the health factor daily: leverage turns dips into liquidations.',
  'Dual-Token Stablecoin': 'Watch the peg: below $0.98 for days means leave.',
};

function riskCheck(category) {
  return RISK_CHECK[category] ?? 'Watch the protocol docs for its main risk, and leave if the team goes quiet.';
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
 * rank and age_days. Returns 7 strings, each 20-600 characters once trimmed.
 */
export function buildFarmSteps(row) {
  const amt = positionSize(row.rank);
  const chain = row.chains && row.chains.length > 0 ? row.chains[0] : 'Ethereum';
  const bridge = bridgeFor(chain);
  const fee = bridge.usd;
  const hold = holdDaysFor(row.age_days);
  const core = CORE_ACTION[row.category] ?? ((a, n) =>
    `Use ${n} with ${money(a)}, deposit, swap or stake, whichever its docs list first, and keep the position open for a month.`);
  return [
    withCost({
      text: `Bridge ${money(amt)} in stablecoins to ${chain}, ${row.name}'s main chain, using the chain's official bridge.`,
      cost: `about ${money(bridge.usd)} in gas`,
      time: `${bridge.minutes} minutes before the funds arrive`,
    }),
    withCost({
      text: core(amt, row.name),
      cost: `about ${money(fee)} in gas`,
      time: '15 minutes to set up',
    }),
    withCost(timingStep(row, amt, fee)),
    withCost({
      text: `Keep the position working for four weeks: ${weeklyAction(row.category)}, and keep at least ${money(amt)} in the position the whole time; snapshot-based programs usually reward steady duration more than one large deposit. Hold the position at least ${hold} days.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    }),
    withCost({
      text: `Use a second feature of ${row.name} once, ${secondFeature(row.category)}, so the wallet shows more than one action type.`,
      cost: `about ${money(fee)} in gas`,
      time: '10 minutes',
    }),
    withCost({
      text: `Set an exit trigger before you start: if ${row.name}'s TVL falls more than 25% from the snapshot's ${money(row.tvl_usd)}, cut the position in half. ${riskCheck(row.category)} Confirm the contract address on the protocol's DefiLlama page before the first approval, never share a seed phrase, and revoke the token approval after the campaign ends.`,
      cost: 'nothing to set the trigger',
      time: '5 minutes',
    }),
    withCost({
      text: `When the token launches: check the claim page within the first week, confirm the contract address matches the protocol's own announcement, and if the listing price is above this board's implied ${money(row.implied_value_usd)}, sell half and keep half; if it lists below, hold through the first month.`,
      cost: 'nothing until you claim',
      time: '15 minutes at launch',
    }),
  ];
}

// The plan's totals, from the same figures buildFarmSteps uses: gas in USD
// and active minutes, plus the hold length in days. The dashboard shows
// these beside the plan; they are not part of board.json.
export function planSummary(row) {
  const chain = row.chains && row.chains.length > 0 ? row.chains[0] : 'Ethereum';
  const bridge = bridgeFor(chain);
  const fee = bridge.usd;
  // Bridge + core deposit + split second deposit + 4 weekly actions + second feature.
  const gas = bridge.usd + fee + fee + 8 + fee;
  const minutes = bridge.minutes + 15 + 10 + 40 + 10 + 5 + 15;
  return { gasUsd: Math.round(gas * 100) / 100, minutes, holdDays: holdDaysFor(row.age_days) };
}
