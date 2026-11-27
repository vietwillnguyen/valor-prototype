// Demo state: seeded friend groups, local persistence and every action the
// prototype supports. There is no backend; all of this lives in localStorage.
import { ECONOMY } from "./config.js";
import * as eco from "./economy.js";

const STORAGE_KEY = "valor.demo.v1";
const HOUR = 3600e3;
const DAY = 24 * HOUR;

let state = null;
const listeners = new Set();

// ------------------------------------------------------------------ helpers

let idCounter = 0;
export function uid(prefix = "x") {
  idCounter += 1;
  return `${prefix}${Date.now().toString(36)}${idCounter.toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}

export function now() {
  return Date.now() + (state ? state.clockOffset : 0);
}

export function dayKey(t = now()) {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function weekStart(t = now()) {
  const d = new Date(t);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setHours(0, 0, 0, 0);
  return d.getTime() - day * DAY;
}

// Small deterministic pseudo random, so "simulate friends" is varied but repeatable.
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

// -------------------------------------------------------------------- seed

function person(id, name, extra = {}) {
  return { id, name, valor: 100, lifetime: 0, kept: 0, broken: 0, streak: 0, bestStreak: 0, joinedAt: 0, ...extra };
}

export function seed() {
  const t = Date.now();
  const users = {
    mai: person("mai", "Mai", { valor: 145, lifetime: 230, kept: 9, broken: 1, streak: 4, bestStreak: 6 }),
    tuan: person("tuan", "Tuan", { valor: 60, lifetime: 95, kept: 4, broken: 3, streak: 1, bestStreak: 2 }),
    linh: person("linh", "Linh", { valor: 120, lifetime: 160, kept: 6, broken: 2, streak: 0, bestStreak: 4 }),
    khoa: person("khoa", "Khoa", { valor: 85, lifetime: 70, kept: 3, broken: 1, streak: 2, bestStreak: 2 }),
    bao: person("bao", "Bao", { valor: 110, lifetime: 40, kept: 2, broken: 0, streak: 2, bestStreak: 2 }),
    an: person("an", "An", { valor: 75, lifetime: 520, kept: 15, broken: 4, streak: 3, bestStreak: 7 })
  };
  const groups = {
    gymrats: { id: "gymrats", name: "The Gym Rats", members: ["mai", "tuan", "linh", "khoa"], invitedBy: "mai", motto: "Leg day is not optional" },
    goblins: { id: "goblins", name: "The Book Goblins", members: ["linh", "bao", "an"], invitedBy: "linh", motto: "We hoard pages" }
  };

  const proof = (id, userId, scene, caption, at, checkin, votes, extra = {}) => ({
    id, userId, image: `gen:${scene}:${id}`, caption, at, checkin, votes, reactions: {}, hidden: false, ...extra
  });
  const msg = (id, userId, type, text, at, extra = {}) => ({ id, userId, type, text, at, reactions: {}, hidden: false, ...extra });

  const oaths = {
    o_mai_gym: {
      id: "o_mai_gym", groupId: "gymrats", swearerId: "mai", title: "Gym 4x by Sunday", template: "gym",
      checkins: 4, stake: 50, iou: "Loser buys pho", createdAt: t - 3 * DAY, deadline: t + 2 * DAY + 3 * HOUR, status: "active",
      proofs: [
        proof("p_mai_1", "mai", "gym", "Chest day. Pigeon chest.", t - 2.5 * DAY, 1, { tuan: "approve", linh: "approve", khoa: "approve" }, { reactions: { huzzah: ["tuan", "khoa"] } }),
        proof("p_mai_2", "mai", "gym2", "Leg day done", t - 1.2 * DAY, 2, { tuan: "approve", khoa: "call", linh: "approve" }, { reactions: { sus: ["khoa"] } }),
        proof("p_mai_3", "mai", "gym3", "Back at it before work", t - 2 * HOUR, 3, {})
      ],
      thread: [
        msg("m1", "khoa", "text", "Suspiciously empty gym", t - 1.15 * DAY),
        msg("m2", "mai", "text", "It was 6am, Khoa. Normal people sleep.", t - 1.1 * DAY),
        msg("m3", "tuan", "photo", "Meanwhile me:", t - 20 * HOUR, { image: "gen:couch:m3" })
      ]
    },
    o_tuan_scroll: {
      id: "o_tuan_scroll", groupId: "gymrats", swearerId: "tuan", title: "No phone in bed for 3 nights", template: "scroll",
      checkins: 3, stake: 30, iou: "", createdAt: t - 2.5 * DAY, deadline: t + 5 * HOUR, status: "active",
      proofs: [
        proof("p_tuan_1", "tuan", "scroll", "Phone in the kitchen. Goodnight.", t - 2 * DAY, 1, { mai: "approve", linh: "approve" }),
        proof("p_tuan_2", "tuan", "scroll2", "Night 2. I read a book like a Victorian.", t - 1 * DAY, 2, { mai: "approve", khoa: "approve" }, { reactions: { respect: ["mai", "linh"] } })
      ],
      thread: [msg("m4", "linh", "text", "One more night, Tuan. You can do it.", t - 10 * HOUR)]
    },
    o_khoa_steps: {
      id: "o_khoa_steps", groupId: "gymrats", swearerId: "khoa", title: "10k steps a day for 3 days", template: "steps",
      checkins: 3, stake: 40, iou: "Loser does the dishes", createdAt: t - 6 * DAY, deadline: t - 2 * DAY, status: "kept", settledAt: t - 2 * DAY,
      result: { kept: true, reward: 24, returned: 40, burned: 0 },
      proofs: [
        proof("p_khoa_1", "khoa", "steps", "Day 1: 11,204", t - 5 * DAY, 1, { mai: "approve", tuan: "approve" }),
        proof("p_khoa_2", "khoa", "steps2", "Day 2: 10,050 (walked to the shop twice)", t - 4 * DAY, 2, { mai: "approve", linh: "approve" }),
        proof("p_khoa_3", "khoa", "steps", "Day 3: 13k, legs gone", t - 3 * DAY, 3, { tuan: "approve", linh: "approve" })
      ],
      thread: []
    },
    o_linh_read: {
      id: "o_linh_read", groupId: "gymrats", swearerId: "linh", title: "Read 50 pages by Sunday", template: "read",
      checkins: 2, stake: 25, iou: "Loser buys bubble tea", createdAt: t - 7 * DAY, deadline: t - 4 * DAY, status: "broken", settledAt: t - 4 * DAY,
      result: { kept: false, reward: 0, returned: 0, burned: 25 },
      proofs: [proof("p_linh_1", "linh", "read", "Page 12. It is going great.", t - 6 * DAY, 1, { mai: "approve" })],
      thread: [msg("m5", "mai", "text", "Bubble tea, Linh. Large. With pearls.", t - 3.9 * DAY)]
    },
    o_linh_book: {
      id: "o_linh_book", groupId: "goblins", swearerId: "linh", title: "Finish Piranesi by Friday", template: "read",
      checkins: 1, stake: 40, iou: "", createdAt: t - 1 * DAY, deadline: t + 3 * DAY, status: "active", proofs: [],
      thread: [msg("m6", "an", "text", "The statues, Linh. Wait until the statues.", t - 20 * HOUR)]
    },
    o_bao_cook: {
      id: "o_bao_cook", groupId: "goblins", swearerId: "bao", title: "Cook dinner 2x", template: "cook",
      checkins: 2, stake: 20, iou: "Loser does the dishes", createdAt: t - 2 * DAY, deadline: t + 20 * HOUR, status: "active",
      proofs: [proof("p_bao_1", "bao", "cook", "Egg fried rice, chef's kiss", t - 1 * DAY, 1, { an: "approve", linh: "approve" })],
      thread: []
    }
  };

  const ledger = [
    { userId: "mai", groupId: "gymrats", kind: "reward", amount: 30, at: t - 40 * 60e3 },
    { userId: "mai", groupId: "gymrats", kind: "witness", amount: 6, at: t - 50 * 60e3 },
    { userId: "khoa", groupId: "gymrats", kind: "reward", amount: 24, at: t - 30 * 60e3 },
    { userId: "khoa", groupId: "gymrats", kind: "witness", amount: 4, at: t - 70 * 60e3 },
    { userId: "tuan", groupId: "gymrats", kind: "witness", amount: 8, at: t - 90 * 60e3 },
    { userId: "linh", groupId: "gymrats", kind: "witness", amount: 4, at: t - 95 * 60e3 },
    { userId: "an", groupId: "goblins", kind: "reward", amount: 45, at: t - 35 * 60e3 },
    { userId: "bao", groupId: "goblins", kind: "witness", amount: 6, at: t - 65 * 60e3 },
    { userId: "linh", groupId: "goblins", kind: "witness", amount: 2, at: t - 80 * 60e3 }
  ];

  return {
    version: 1,
    seededAt: t,
    clockOffset: 0,
    signedUp: false,
    actingAs: "you",
    currentGroup: "gymrats",
    users,
    groups,
    oaths,
    ledger,
    reports: [],
    blocks: {},
    seenSettled: {},
    loaded: false
  };
}

// --------------------------------------------------------------- persistence

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 1) {
        state = parsed;
        return state;
      }
    }
  } catch (e) {
    /* corrupted or blocked storage: fall back to a fresh seed */
  }
  state = seed();
  return state;
}

let saveError = null;
export function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    saveError = null;
  } catch (e) {
    saveError = "This browser's storage is full, so the demo cannot remember that. Try Reset demo.";
  }
  listeners.forEach((fn) => fn(state));
}

export function lastSaveError() {
  return saveError;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function get() {
  return state;
}

export function resetDemo() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    /* ignore */
  }
  state = seed();
  save();
  return state;
}

// ------------------------------------------------------------------ queries

export const me = () => state.users[state.actingAs] || null;
export const user = (id) => state.users[id] || { id, name: "Someone", valor: 0, lifetime: 0, kept: 0, broken: 0, streak: 0 };
export const group = (id) => state.groups[id] || null;
export const oath = (id) => state.oaths[id] || null;

export function myGroups() {
  return Object.values(state.groups).filter((g) => g.members.includes(state.actingAs));
}

export function pendingInvites() {
  if (!state.signedUp) return [];
  return Object.values(state.groups).filter((g) => !g.members.includes("you") && !(state.declined || {})[g.id]);
}

export function isBlocked(userId) {
  return (state.blocks[state.actingAs] || []).includes(userId);
}

export function oathsIn(groupId) {
  return Object.values(state.oaths).filter((o) => o.groupId === groupId && !isBlocked(o.swearerId));
}

export function activeOaths(groupId) {
  return oathsIn(groupId).filter((o) => o.status === "active").sort((a, b) => a.deadline - b.deadline);
}

export function settledOaths(groupId) {
  return oathsIn(groupId).filter((o) => o.status !== "active").sort((a, b) => b.settledAt - a.settledAt);
}

export function oathsBy(userId) {
  return Object.values(state.oaths).filter((o) => o.swearerId === userId).sort((a, b) => b.createdAt - a.createdAt);
}

export function leaderboard(groupId) {
  const g = group(groupId);
  if (!g) return [];
  const since = weekStart();
  return g.members
    .filter((id) => !isBlocked(id))
    .map((id) => {
      const earned = state.ledger
        .filter((e) => e.userId === id && e.groupId === groupId && e.at >= since && (e.kind === "reward" || e.kind === "witness"))
        .reduce((s, e) => s + e.amount, 0);
      return { user: user(id), earned };
    })
    .sort((a, b) => b.earned - a.earned || a.user.name.localeCompare(b.user.name));
}

export function witnessesFor(o) {
  const g = group(o.groupId);
  return g ? g.members.filter((id) => id !== o.swearerId) : [];
}

// ----------------------------------------------------------------- ledger

function credit(userId, groupId, kind, amount) {
  if (!amount) return;
  const u = state.users[userId];
  if (!u) return;
  u.valor = Math.max(0, u.valor + amount);
  if (kind === "reward" || kind === "witness" || kind === "topup") u.lifetime += amount;
  state.ledger.push({ userId, groupId, kind, amount, at: now() });
  if (state.ledger.length > 400) state.ledger.splice(0, state.ledger.length - 400);
}

/** Daily top-up so nobody sits at zero. Returns the amount given (0 if already given today). */
export function dailyTopUp(userId = state.actingAs) {
  const u = state.users[userId];
  if (!u || !state.signedUp) return 0;
  const today = dayKey();
  if (u.topUpDay === today) return 0;
  u.topUpDay = today;
  credit(userId, state.currentGroup, "topup", ECONOMY.dailyTopUp);
  save();
  return ECONOMY.dailyTopUp;
}

// ----------------------------------------------------------------- actions

export function signUp(name) {
  const clean = String(name).trim().slice(0, 24) || "You";
  state.users.you = person("you", clean, { valor: ECONOMY.startingPurse, joinedAt: now(), topUpDay: dayKey() });
  state.signedUp = true;
  state.actingAs = "you";
  joinGroup("gymrats");
  return state.users.you;
}

export function joinGroup(groupId) {
  const g = group(groupId);
  if (!g) return;
  if (!g.members.includes("you")) g.members.push("you");
  state.currentGroup = groupId;
  save();
}

export function declineInvite(groupId) {
  state.declined = { ...(state.declined || {}), [groupId]: true };
  save();
}

export function leaveGroup(groupId) {
  const g = group(groupId);
  if (!g) return;
  g.members = g.members.filter((id) => id !== "you");
  // Active oaths you swore in that group are withdrawn and the stake is returned.
  for (const o of Object.values(state.oaths)) {
    if (o.groupId === groupId && o.swearerId === "you" && o.status === "active") {
      credit("you", groupId, "return", o.stake);
      o.status = "withdrawn";
      o.settledAt = now();
    }
  }
  const remaining = myGroups();
  state.currentGroup = remaining.length ? remaining[0].id : null;
  state.declined = { ...(state.declined || {}), [groupId]: true };
  save();
}

/** Delete your account, oaths, proof photos and messages. Friends' data stays. */
export function deleteAccount() {
  for (const g of Object.values(state.groups)) g.members = g.members.filter((id) => id !== "you");
  for (const [id, o] of Object.entries(state.oaths)) {
    if (o.swearerId === "you") {
      delete state.oaths[id];
      continue;
    }
    o.proofs.forEach((p) => delete p.votes.you);
    o.thread = o.thread.filter((m) => m.userId !== "you");
  }
  state.ledger = state.ledger.filter((e) => e.userId !== "you");
  state.reports = state.reports.filter((r) => r.by !== "you");
  delete state.blocks.you;
  delete state.users.you;
  state.signedUp = false;
  state.actingAs = "you";
  state.currentGroup = "gymrats";
  state.declined = {};
  save();
}

export function setActingAs(id) {
  if (id === "you" && !state.users.you) return;
  state.actingAs = id;
  const groups = myGroups();
  if (!groups.find((g) => g.id === state.currentGroup)) state.currentGroup = groups.length ? groups[0].id : null;
  save();
}

export function setGroup(id) {
  state.currentGroup = id;
  save();
}

export function swear({ title, template, checkins, deadline, stake, iou }) {
  const u = me();
  const s = eco.clampStake(stake, u.valor);
  if (!s) throw new Error("Not enough valor in your purse to stake.");
  const o = {
    id: uid("o_"), groupId: state.currentGroup, swearerId: u.id, title: String(title).trim().slice(0, 80), template,
    checkins: Math.max(1, Math.min(7, checkins | 0)), stake: s, iou: String(iou || "").trim().slice(0, 60),
    createdAt: now(), deadline, status: "active", proofs: [], thread: []
  };
  credit(u.id, o.groupId, "stake", -s);
  state.oaths[o.id] = o;
  save();
  return o;
}

export function addProof(oathId, image, caption) {
  const o = oath(oathId);
  const p = {
    id: uid("p_"), userId: o.swearerId, image, caption: String(caption || "").trim().slice(0, 120), at: now(),
    checkin: o.proofs.length + 1, votes: {}, reactions: {}, hidden: false
  };
  o.proofs.push(p);
  save();
  return p;
}

export function vote(oathId, proofId, choice, voterId = state.actingAs) {
  const o = oath(oathId);
  const p = o && o.proofs.find((x) => x.id === proofId);
  if (!p || o.status !== "active" || voterId === o.swearerId) return 0;
  const first = !p.votes[voterId];
  p.votes[voterId] = choice;
  let paid = 0;
  if (first) {
    const u = state.users[voterId];
    const today = dayKey();
    if (u.witnessDay !== today) {
      u.witnessDay = today;
      u.witnessCount = 0;
    }
    paid = eco.witnessPayout(u.witnessCount);
    u.witnessCount += 1;
    credit(voterId, o.groupId, "witness", paid);
  }
  save();
  return paid;
}

export function react(oathId, itemId, reaction, by = state.actingAs) {
  const o = oath(oathId);
  const item = o.proofs.find((x) => x.id === itemId) || o.thread.find((x) => x.id === itemId);
  if (!item) return;
  const list = item.reactions[reaction] || [];
  item.reactions[reaction] = list.includes(by) ? list.filter((x) => x !== by) : [...list, by];
  save();
}

export function reply(oathId, { text, image, type }, by = state.actingAs) {
  const o = oath(oathId);
  const m = {
    id: uid("m_"), userId: by, type: type || (image ? "photo" : "text"), text: String(text || "").trim().slice(0, 280),
    image: image || null, at: now(), reactions: {}, hidden: false
  };
  o.thread.push(m);
  save();
  return m;
}

export function nudge(oathId) {
  const o = oath(oathId);
  const left = Math.max(1, Math.round((o.deadline - now()) / HOUR));
  const lines = [
    `${user(o.swearerId).name}, ${left} hours left. The pigeon is watching.`,
    `Tick tock, ${user(o.swearerId).name}. ${left} hours. Honour is on the line.`,
    `${user(o.swearerId).name}! Your oath expires in ${left} hours. Do not make the pigeon sad.`
  ];
  return reply(oathId, { type: "nudge", text: lines[Math.floor(hash(oathId + now()) * lines.length)], image: "mascot" });
}

export function report(targetType, targetId, oathId, reason) {
  const o = oathId ? oath(oathId) : null;
  if (o) {
    const item = o.proofs.find((x) => x.id === targetId) || o.thread.find((x) => x.id === targetId);
    if (item) item.hidden = true;
  }
  state.reports.push({ id: uid("r_"), targetType, targetId, oathId: oathId || null, by: state.actingAs, reason, at: now(), status: "Pending review" });
  save();
}

export function block(userId) {
  const list = state.blocks[state.actingAs] || [];
  if (!list.includes(userId)) list.push(userId);
  state.blocks[state.actingAs] = list;
  save();
}

export function unblock(userId) {
  state.blocks[state.actingAs] = (state.blocks[state.actingAs] || []).filter((id) => id !== userId);
  save();
}

// ------------------------------------------------------------- settlement

export function settleDue() {
  const settled = [];
  for (const o of Object.values(state.oaths)) {
    if (o.status !== "active" || o.deadline > now()) continue;
    const u = state.users[o.swearerId];
    if (!u) continue;
    const before = { valor: u.valor, lifetime: u.lifetime, honor: eco.honorPct(u.kept, u.broken), rank: eco.rankFor(u.lifetime).name, streak: u.streak };
    const r = eco.settle(o, u);
    if (r.kept) {
      credit(u.id, o.groupId, "return", r.returned);
      credit(u.id, o.groupId, "reward", r.reward);
      u.kept += 1;
      u.streak += 1;
      u.bestStreak = Math.max(u.bestStreak, u.streak);
    } else {
      if (r.returned) credit(u.id, o.groupId, "return", r.returned);
      state.ledger.push({ userId: u.id, groupId: o.groupId, kind: "burn", amount: -r.burned, at: now() });
      u.broken += 1;
      u.streak = 0;
    }
    const after = { valor: u.valor, lifetime: u.lifetime, honor: eco.honorPct(u.kept, u.broken), rank: eco.rankFor(u.lifetime).name, streak: u.streak };
    o.status = r.kept ? "kept" : "broken";
    o.settledAt = now();
    o.result = { ...r, before, after, rankUp: after.rank !== before.rank ? after.rank : null, approved: eco.approvedCount(o) };
    o.thread.push({ id: uid("m_"), userId: o.swearerId, type: "system", text: r.kept ? "Oath kept." : "Oath broken.", at: now(), reactions: {}, hidden: false });
    settled.push(o);
  }
  if (settled.length) save();
  return settled;
}

/**
 * Demo control: move the clock to just past the deadline of `oathId` (or the
 * next one in the group). Other active oaths keep their remaining time, so
 * skipping ahead on one oath does not quietly break everyone else's.
 */
export function fastForward(oathId) {
  const target = oathId ? oath(oathId) : activeOaths(state.currentGroup)[0];
  if (!target || target.status !== "active") return { target: null, settled: [] };
  const jump = Math.max(0, target.deadline + 60e3 - now());
  for (const o of Object.values(state.oaths)) {
    if (o.status === "active" && o.id !== target.id) o.deadline += jump;
  }
  state.clockOffset += jump;
  const settled = settleDue();
  return { target, settled };
}

export function nextDay() {
  state.clockOffset += DAY;
  const settled = settleDue();
  const topUp = dailyTopUp();
  save();
  return { settled, topUp };
}

// --------------------------------------------------------- simulated friends

const BANTER = [
  "Bold of you to swear this in public.",
  "I have doubts. Many doubts.",
  "The pigeon approves. Mostly.",
  "Is that the same gym photo from March?",
  "Respect. Grudging, but respect.",
  "Huzzah! Glory to the oath keeper.",
  "Lighting is suspicious but I'll allow it.",
  "If you break this I'm framing the shame card."
];
const SCENES = { gym: ["gym", "gym2", "gym3"], steps: ["steps", "steps2"], scroll: ["scroll", "scroll2"], read: ["read"], cook: ["cook"], custom: ["custom"] };
const CAPTIONS = ["Done and dusted.", "Proof, as sworn.", "Another one.", "Witness this, peasants.", "Check-in complete."];

/** Make the seeded friends act: post proofs on their oaths, vote on pending proofs, react and banter. */
export function simulateFriends() {
  const g = group(state.currentGroup);
  if (!g) return { votes: 0, replies: 0, proofs: 0, names: [] };
  const friends = g.members.filter((id) => id !== "you" && id !== state.actingAs);
  const names = new Set();
  let votes = 0;
  let replies = 0;
  let proofs = 0;
  const salt = String(now());
  for (const o of activeOaths(g.id)) {
    // Friends make progress on their own oaths.
    if (friends.includes(o.swearerId) && o.proofs.length < o.checkins && hash(o.id + salt) < 0.75) {
      const scenes = SCENES[o.template] || SCENES.custom;
      const scene = scenes[o.proofs.length % scenes.length];
      const p = addProof(o.id, `gen:${scene}:${uid("s")}`, CAPTIONS[Math.floor(hash(o.id + salt + "c") * CAPTIONS.length)]);
      p.at = now();
      proofs += 1;
      names.add(user(o.swearerId).name);
    }
    for (const p of o.proofs) {
      if (p.hidden) continue;
      for (const f of friends) {
        if (f === o.swearerId || p.votes[f]) continue;
        const roll = hash(p.id + f + salt);
        if (roll < 0.15) continue; // some friends are busy
        vote(o.id, p.id, roll < 0.85 ? "approve" : "call", f);
        votes += 1;
        names.add(user(f).name);
        if (roll > 0.6 && roll < 0.8) {
          const r = ["huzzah", "respect", "lol", "sus"][Math.floor(hash(p.id + f) * 4)];
          if (!(p.reactions[r] || []).includes(f)) react(o.id, p.id, r, f);
        }
      }
    }
    const talker = friends.filter((f) => f !== o.swearerId)[Math.floor(hash(o.id + salt + "t") * Math.max(1, friends.length - 1))];
    if (talker) {
      reply(o.id, { text: BANTER[Math.floor(hash(o.id + salt + "b") * BANTER.length)] }, talker);
      replies += 1;
      names.add(user(talker).name);
    }
  }
  save();
  return { votes, replies, proofs, names: [...names] };
}

export const constants = { HOUR, DAY };
