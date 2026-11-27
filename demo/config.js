// All tunable numbers for the M0 prototype live here, so the reward curve can be
// tuned in one place. Valor is earned only: nothing here is for sale.

export const ECONOMY = {
  startingPurse: 100, // valor every new member starts with
  minStake: 5,
  stakeStep: 5,
  defaultStakeFraction: 0.3, // slider starts at 30% of the purse

  // Keeping an oath returns the stake plus a reward.
  keptRewardRate: 0.5, // reward = stake * rate ...
  keptRewardMin: 5, // ... but never less than this
  streakBonusPerKept: 0.1, // +10% reward per oath already in the streak ...
  streakBonusCap: 0.5, // ... capped at +50%

  // Breaking a solo oath burns the stake. It is never paid to anyone.
  brokenBurnsStake: true,

  // Witnessing pays a little, capped per day, so friends show up.
  witnessReward: 2,
  witnessDailyCap: 5, // rewarded votes per day

  // A daily top-up so nobody sits at zero.
  dailyTopUp: 10,

  // Ranks come from lifetime valor earned and never go down.
  ranks: [
    { name: "Squire", min: 0 },
    { name: "Knight", min: 30 },
    { name: "Champion", min: 300 },
    { name: "Legend", min: 1000 }
  ],

  nudgeWindowHours: 24 // "deadline is close" for the nudge button
};

export const TEMPLATES = [
  { id: "gym", label: "Gym", title: "Gym 3x this week", checkins: 3, days: 6, scene: "gym" },
  { id: "steps", label: "Steps", title: "10k steps a day for 3 days", checkins: 3, days: 3, scene: "steps" },
  { id: "scroll", label: "No doomscrolling", title: "No phone in bed for 3 nights", checkins: 3, days: 3, scene: "scroll" },
  { id: "read", label: "Read", title: "Read 50 pages by Sunday", checkins: 2, days: 4, scene: "read" },
  { id: "cook", label: "Cook", title: "Cook dinner 2x", checkins: 2, days: 5, scene: "cook" },
  { id: "custom", label: "Custom", title: "", checkins: 1, days: 2, scene: "custom" }
];

export const IOU_SUGGESTIONS = ["Loser buys dinner", "Loser does dishes", "Loser buys boba", "Loser sings karaoke"];

export const REACTIONS = [
  { id: "huzzah", label: "Huzzah" },
  { id: "sus", label: "Sus" },
  { id: "lol", label: "Ha!" },
  { id: "respect", label: "Respect" }
];
