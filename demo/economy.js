// Pure economy rules. No DOM, no storage, so they can be tested with node --test.
import { ECONOMY } from "./config.js";

export function rankFor(lifetimeEarned, cfg = ECONOMY) {
  let rank = cfg.ranks[0];
  for (const r of cfg.ranks) if (lifetimeEarned >= r.min) rank = r;
  return rank;
}

export function nextRank(lifetimeEarned, cfg = ECONOMY) {
  return cfg.ranks.find((r) => r.min > lifetimeEarned) || null;
}

/** Progress (0..1) from the current rank's threshold to the next one. */
export function rankProgress(lifetimeEarned, cfg = ECONOMY) {
  const cur = rankFor(lifetimeEarned, cfg);
  const next = nextRank(lifetimeEarned, cfg);
  if (!next) return 1;
  return (lifetimeEarned - cur.min) / (next.min - cur.min);
}

/** Honor is the share of settled oaths kept, or null while unrated. */
export function honorPct(kept, broken) {
  const total = kept + broken;
  return total === 0 ? null : Math.round((kept / total) * 100);
}

export function keptReward(stake, streak, cfg = ECONOMY) {
  const bonus = Math.min(cfg.streakBonusCap, streak * cfg.streakBonusPerKept);
  return Math.max(cfg.keptRewardMin, Math.round(stake * cfg.keptRewardRate * (1 + bonus)));
}

export function clampStake(value, purse, cfg = ECONOMY) {
  const max = Math.floor(purse / cfg.stakeStep) * cfg.stakeStep;
  if (max < cfg.minStake) return 0;
  const stepped = Math.round(value / cfg.stakeStep) * cfg.stakeStep;
  return Math.min(max, Math.max(cfg.minStake, stepped));
}

/**
 * A check-in counts when at least one witness voted and approvals are not
 * outnumbered by call-outs (a tie goes to the swearer).
 */
export function checkinStatus(proof) {
  if (proof.hidden) return "hidden";
  const votes = Object.values(proof.votes || {});
  const approve = votes.filter((v) => v === "approve").length;
  const call = votes.filter((v) => v === "call").length;
  if (approve + call === 0) return "pending";
  return approve >= call ? "approved" : "called";
}

export function approvedCount(oath) {
  return oath.proofs.filter((p) => checkinStatus(p) === "approved").length;
}

/** Decide an oath at its deadline. Returns { kept, delta, reward, burned }. */
export function settle(oath, swearer, cfg = ECONOMY) {
  const kept = approvedCount(oath) >= oath.checkins;
  if (kept) {
    const reward = keptReward(oath.stake, swearer.streak, cfg);
    return { kept: true, reward, returned: oath.stake, burned: 0 };
  }
  return { kept: false, reward: 0, returned: cfg.brokenBurnsStake ? 0 : oath.stake, burned: cfg.brokenBurnsStake ? oath.stake : 0 };
}

/** Witness reward for one vote, respecting the daily cap. */
export function witnessPayout(countToday, cfg = ECONOMY) {
  return countToday < cfg.witnessDailyCap ? cfg.witnessReward : 0;
}
