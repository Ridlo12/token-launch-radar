// farm.js — farm plans for the token launch radar.
//
// One function, shared by main.ts (Node) and the dashboard (browser):
// farmSteps(row) turns a ranked row into seven concrete steps. Every step
// ends with an explicit "Cost: ... Time: ..." tail, so a reader always
// knows what a step costs and how long it takes.
//
// The row it takes is a plain object:
//   { slug, name, category, mainChain, chainCount, tvlUsd, change7d,
//     daysListed, rank, impliedUsd }
//
// Loaded as a classic script in the browser it sets window.farmSteps;
// required as a CommonJS module from main.ts it exports { farmSteps }.

"use strict";

// The snapshot's categories grouped into the handful of shapes a farm plan
// actually differs by: what you do each week, and what risk would make you
// cut the position. A category the map does not name falls back to general.
const FAMILY_BY_CATEGORY = {
  "Risk Curators": "curator",
  "Onchain Capital Allocator": "curator",
  "Collateral Management": "curator",
  Lending: "lending",
  "Leveraged Farming": "lending",
  Dexs: "markets",
  "Liquidity Manager": "markets",
  Derivatives: "markets",
  Options: "markets",
  CDP: "stable",
  "Dual-Token Stablecoin": "stable",
  RWA: "stable",
  Yield: "yield",
  Restaking: "yield",
  "Staking Pool": "yield",
  "Prediction Market": "prediction",
  Payments: "payments",
  "NFT Marketplace": "nft",
  Launchpad: "launch",
  "Token Locker": "launch",
  "AI Agents": "ai",
  "Decentralized AI": "ai",
  DOR: "ai",
  Chain: "chain",
};

const FAMILIES = {
  curator: {
    weekly:
      "re-check the vaults or strategies you sit in — allocations, fees, and any new vault the protocol opened — and move the position if a vault's TVL fell while the snapshot level held",
    risk: "a vault you sit in changes its strategy or caps deposits",
  },
  lending: {
    weekly:
      "check borrow rates, supply caps and utilisation on the markets you sit in, and rebalance if rates moved against you",
    risk: "borrow rates spike or a market hits its supply cap",
  },
  markets: {
    weekly:
      "check the pools you provide to — fees earned, impermanent loss and volume — and move liquidity if a pool dried up",
    risk: "pool volume collapses or a pair you hold depegs",
  },
  stable: {
    weekly:
      "check the peg and the collateral backing the assets you hold, and the newest collateral types the protocol onboarded",
    risk: "the peg slips or its backing thins",
  },
  yield: {
    weekly:
      "check the yield on your position against the rate the protocol quoted when you entered, and restake or rotate if it fell by a third",
    risk: "yields compress by a third or a restaking cap fills",
  },
  prediction: {
    weekly:
      "scan the newest markets for mispriced odds in topics you follow, and close positions whose edge is gone",
    risk: "a market you hold resolves against you",
  },
  payments: {
    weekly:
      "check the payment volume and the newest integrations routing through the protocol",
    risk: "volume stalls for two weeks running",
  },
  nft: {
    weekly:
      "watch floor volume and the newest collections listing on the marketplace",
    risk: "volume dries up across the marketplace",
  },
  launch: {
    weekly:
      "check the newest launches and lockups the platform lists, and whether any of them is one you would have backed",
    risk: "launches stall or lockups unlock early",
  },
  ai: {
    weekly:
      "check the agents or models the protocol runs, their usage and any new capability it shipped",
    risk: "usage flatlines or a flagship agent is retired",
  },
  chain: {
    weekly:
      "check the chain's activity — transactions, active addresses and the newest apps deploying on it",
    risk: "on-chain activity falls for two weeks running",
  },
  general: {
    weekly:
      "open the app and complete the newest on-chain action it offers, then check the protocol's announcements for anything that changes the plan",
    risk: "the protocol pauses deposits or changes its rewards",
  },
};

// Whole dollars with thousands separators: 2753981495 -> "2,753,981,495".
function dollars(n) {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// How long the protocol has run with no token, in words.
function ageText(daysListed) {
  if (daysListed === null || daysListed === undefined) return "an unreported stretch";
  if (daysListed < 30) return daysListed + " days";
  if (daysListed < 365) return "about " + Math.round(daysListed / 30) + " months";
  return "about " + (daysListed / 365).toFixed(1) + " years";
}

// The hold period follows the protocol's age: young ones get the longest
// leash, because a launch, if it comes, is furthest out for them.
function holdDays(daysListed) {
  if (daysListed === null || daysListed === undefined) return 45;
  if (daysListed < 365) return 60;
  if (daysListed < 730) return 45;
  return 30;
}

// The position size follows the rank tier: the board's top rows earn the
// biggest positions, the long tail earns a toe in the water.
function positionSize(rank) {
  if (rank <= 10) return "1,000";
  if (rank <= 50) return "500";
  return "100";
}

function farmSteps(row) {
  const family = FAMILIES[FAMILY_BY_CATEGORY[row.category] || "general"];
  const size = positionSize(row.rank);
  const hold = holdDays(row.daysListed);
  return [
    "Check " +
      row.name +
      "'s official site, docs and announcements and confirm it still records no token — look for any token, points or airdrop post before you put money in. Cost: $0. Time: 15 min.",
    "Start on " +
      row.mainChain +
      ", " +
      row.name +
      "'s main chain. If your funds sit on another chain, bridge first (about $1–3 and 5–15 min on a canonical bridge) and keep $2 of " +
      row.mainChain +
      " gas aside for the first transactions. Cost: $1–3 bridge + $2 gas. Time: 15 min.",
    "Size the position to the rank: #" +
      row.rank +
      " is a $" +
      size +
      " position — deposit $" +
      size +
      " in one go and do not chase it with leverage. Cost: $" +
      size +
      ". Time: 10 min.",
    "Each week, " + family.weekly + ". Cost: $0. Time: 20 min a week.",
    "Hold at least " +
      hold +
      " days — " +
      row.name +
      " has run " +
      ageText(row.daysListed) +
      " with no token, and a launch, if it comes, rewards the patient position over the tourist one. Cost: $0. Time: " +
      hold +
      " days.",
    "Cut half the position if " +
      row.name +
      "'s TVL falls more than 25% from the $" +
      dollars(row.tvlUsd) +
      " snapshot level, or if " +
      family.risk +
      ". Re-check TVL every week before you add anything. Cost: $0.50–1 gas. Time: 10 min.",
    "If " +
      row.name +
      " launches a token, claim in the first week, verify the contract address against the official announcement — never a forwarded link — sell half if the listing values it above this board's $" +
      dollars(row.impliedUsd) +
      " implied value, and hold the rest if it lists below. Cost: $1–2 gas. Time: 30 min.",
  ];
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { farmSteps };
}
if (typeof window !== "undefined") {
  window.farmSteps = farmSteps;
}
