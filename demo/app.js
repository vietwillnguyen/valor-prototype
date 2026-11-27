// Valor M0 clickable prototype: router, views and interactions.
// Plain ES modules, no framework. All user text is escaped by the html`` helper.
import { ECONOMY, TEMPLATES, IOU_SUGGESTIONS, REACTIONS } from "./config.js";
import * as eco from "./economy.js";
import * as S from "./store.js";
import { icon } from "./icons.js";
import * as scenes from "./scenes.js";

const Palette = window.ValorPalette;
const app = document.getElementById("app");
const tabbar = document.getElementById("tabbar");
const demoStrip = document.getElementById("demo-strip");
const layer = document.getElementById("layer");
const toasts = document.getElementById("toasts");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ------------------------------------------------------------ html helper

class Raw {
  constructor(s) {
    this.s = s;
  }
  toString() {
    return this.s;
  }
}
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
const raw = (s) => new Raw(s);
function part(v) {
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(part).join("");
  if (v === false || v === null || v === undefined) return "";
  return esc(v);
}
function html(strings, ...vals) {
  let out = strings[0];
  vals.forEach((v, i) => {
    out += part(v) + strings[i + 1];
  });
  return raw(out);
}
const ic = (name, cls) => raw(icon(name, cls));

// ---------------------------------------------------------------- ui state

const ui = {
  groupTab: "oaths",
  draft: null,
  capture: null,
  stream: null,
  lastRoute: "",
  firstLoad: true
};

// ------------------------------------------------------------- formatting

function timeLeft(deadline) {
  const ms = deadline - S.now();
  if (ms <= 0) return "Due now";
  const h = Math.floor(ms / 3600e3);
  const d = Math.floor(h / 24);
  if (d >= 1) return `${d}d ${h % 24}h left`;
  if (h >= 1) return `${h}h ${Math.floor((ms % 3600e3) / 60e3)}m left`;
  return `${Math.max(1, Math.floor(ms / 60e3))}m left`;
}
function ago(t) {
  const ms = S.now() - t;
  if (ms < 60e3) return "just now";
  const m = Math.floor(ms / 60e3);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
const isClose = (o) => o.deadline - S.now() < ECONOMY.nudgeWindowHours * 3600e3;
const nameOf = (id) => (id === S.get().actingAs ? "You" : S.user(id).name);
const pluralOf = (w) => (/(s|sh|ch|x)$/.test(w) ? w + "es" : /[^aeiou]y$/.test(w) ? w.slice(0, -1) + "ies" : w + "s");
const plural = (n, w, many = pluralOf(w)) => `${n} ${n === 1 ? w : many}`;
const listJoin = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

const AVATAR_ROLES = ["primary", "secondary", "accent", "success", "warning"];
function avatar(id, size = "") {
  const u = S.user(id);
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const role = id === "you" ? "primary" : AVATAR_ROLES[h % AVATAR_ROLES.length];
  return html`<span class="avatar ${size}" style="--av-bg: var(--v-${role}); --av-fg: var(--v-${role}-contrast)" aria-hidden="true">${(u.name || "?").slice(0, 1).toUpperCase()}</span>`;
}

function mascot(cls = "", alt = "") {
  return html`<img class="mascot ${cls}" src="assets/valor-pigeon-512.png" width="512" height="512" alt="${alt}" ${alt ? "" : raw('aria-hidden="true"')}>`;
}

function valorChip(amount, cls = "") {
  return html`<span class="chip chip-valor ${cls}">${ic("coin")}<span>${amount}</span><span class="sr-only"> valor</span></span>`;
}

function progress(o) {
  const approved = eco.approvedCount(o);
  const pending = o.proofs.filter((p) => eco.checkinStatus(p) === "pending").length;
  const segs = [];
  for (let i = 0; i < o.checkins; i++) {
    const cls = i < approved ? "done" : i < approved + pending ? "pending" : "";
    segs.push(html`<span class="seg ${cls}"></span>`);
  }
  return html`<div class="progress" role="img" aria-label="${approved} of ${o.checkins} check-ins approved${pending ? `, ${pending} waiting for witnesses` : ""}">${segs}</div>
    <div class="progress-label"><b>${approved} of ${o.checkins}</b> check-ins${pending ? html` <span class="muted">(${pending} waiting for witnesses)</span>` : ""}</div>`;
}

function statusPill(o) {
  if (o.status === "kept") return html`<span class="pill pill-success">${ic("check")} Kept</span>`;
  if (o.status === "broken") return html`<span class="pill pill-danger">${ic("x")} Broken</span>`;
  if (o.status === "withdrawn") return html`<span class="pill">Withdrawn</span>`;
  return html`<span class="pill ${isClose(o) ? "pill-warning" : ""}">${ic("clock")} ${timeLeft(o.deadline)}</span>`;
}

function emptyState(line, sub, action = "", cls = "") {
  return html`<div class="empty ${cls}">
    ${mascot("mascot-empty bob")}
    <div class="bubble bubble-up">${line}</div>
    ${sub ? html`<p class="muted">${sub}</p>` : ""}
    ${action}
  </div>`;
}

// ---------------------------------------------------------------- router

const routes = [
  [/^\/invite\/(\w+)$/, viewInvite],
  [/^\/signup\/(\w+)$/, viewSignup],
  [/^\/group$/, viewGroup],
  [/^\/swear$/, viewSwear],
  [/^\/swear\/ceremony$/, viewCeremony],
  [/^\/oath\/(\w+)$/, viewOath],
  [/^\/capture\/(\w+)\/(proof|reply)$/, viewCapture],
  [/^\/result\/(\w+)$/, viewResult],
  [/^\/profile$/, () => viewProfile(S.get().actingAs)],
  [/^\/profile\/(\w+)$/, viewProfile],
  [/^\/theme$/, viewTheme],
  [/^\/safety$/, viewSafety],
  [/^\/duel$/, viewDuel]
];

const NO_TABS = /^\/(invite|signup|swear\/ceremony|capture|result|oath)/;

function go(path) {
  if (location.hash === "#" + path) render();
  else location.hash = path;
}

function currentPath() {
  return location.hash.replace(/^#/, "") || "";
}

function render() {
  stopStream();
  const st = S.get();
  let path = currentPath();
  if (!st.signedUp && !/^\/(invite|signup|theme)/.test(path)) {
    path = "/invite/gymrats";
    history.replaceState(null, "", "#" + path);
  } else if (st.signedUp && (!path || path === "/")) {
    path = "/group";
    history.replaceState(null, "", "#" + path);
  }
  let view = null;
  let args = [];
  for (const [re, fn] of routes) {
    const m = path.match(re);
    if (m) {
      view = fn;
      args = m.slice(1);
      break;
    }
  }
  if (!view) {
    view = viewGroup;
    path = "/group";
  }
  const changed = ui.lastRoute !== path;
  ui.lastRoute = path;
  const scrollTop = changed ? 0 : app.scrollTop;
  app.innerHTML = String(view(...args));
  app.scrollTop = scrollTop;
  renderChrome(path);
  if (changed) {
    const h = app.querySelector("h1");
    if (h && !ui.firstLoad) {
      h.setAttribute("tabindex", "-1");
      h.focus({ preventScroll: true });
    }
  }
  ui.firstLoad = false;
  afterRender(path);
}

function renderChrome(path) {
  const st = S.get();
  const showTabs = st.signedUp && !NO_TABS.test(path);
  tabbar.hidden = !showTabs;
  document.getElementById("phone").classList.toggle("has-tabs", showTabs);
  if (showTabs) {
    const tab = (href, name, label, active) =>
      html`<a href="#${href}" class="tab ${active ? "active" : ""}" ${active ? raw('aria-current="page"') : ""}>${ic(name)}<span>${label}</span></a>`;
    tabbar.innerHTML = String(html`
      ${tab("/group", "home", "Group", /^\/group/.test(path))}
      <a href="#/swear" class="tab tab-swear ${/^\/swear/.test(path) ? "active" : ""}">${ic("sword")}<span>Swear</span></a>
      ${tab("/profile", "user", "Profile", /^\/(profile|theme|safety)/.test(path))}`);
  }
  const acting = st.actingAs !== "you" ? S.user(st.actingAs).name : null;
  demoStrip.innerHTML = String(html`
    <span class="demo-tag">Prototype</span>
    <span class="demo-who">${acting ? html`Acting as <b>${acting}</b>` : st.signedUp ? html`You are <b>${S.user("you").name}</b>` : "Not signed in"}</span>
    <button type="button" class="demo-btn" data-action="open-demo">${ic("wand")} Demo controls</button>`);
}

// ----------------------------------------------------------- after render

function afterRender(path) {
  if (path.startsWith("/capture")) startCapture();
  if (path.startsWith("/result")) animateResult();
  if (path === "/swear") syncStake();
  const err = S.lastSaveError();
  if (err) toast(err, "danger");
}

// ================================================================== VIEWS

function viewInvite(groupId) {
  const g = S.group(groupId) || S.group("gymrats");
  const inviter = S.user(g.invitedBy);
  const active = S.activeOaths(g.id);
  const st = S.get();
  const already = st.signedUp && g.members.includes("you");
  return html`<section class="screen invite">
    <div class="invite-hero">
      <div class="plate">${mascot("hero-mascot bob", "Valor's pigeon knight mascot, wearing a crown and a red cape and holding a sword")}</div>
      <div class="bubble bubble-left">${inviter.name} has summoned you!</div>
    </div>
    <p class="eyebrow">You're invited</p>
    <h1 class="display">${inviter.name} invited you to <span class="hl">${g.name}</span></h1>
    <p class="lede">Swear oaths, prove them with photos, and let your friends be the judge. Keep your word, earn valor. Break it and, well, there will be a shame card.</p>
    <div class="card member-row">
      <div class="stack-avatars">${g.members.filter((m) => m !== "you").map((m) => avatar(m))}</div>
      <div><b>${plural(g.members.filter((m) => m !== "you").length, "member")}</b><br><span class="muted">${plural(active.length, "active oath")} right now</span></div>
    </div>
    <ul class="how">
      <li>${ic("sword")}<span><b>Swear</b> an oath with a deadline and stake some valor</span></li>
      <li>${ic("camera")}<span><b>Prove</b> it with an in-app photo</span></li>
      <li>${ic("users")}<span><b>Witnesses</b> approve it or call it</span></li>
    </ul>
    ${already
      ? html`<button type="button" class="btn btn-primary btn-block btn-lg" data-action="go" data-to="/group">Open ${g.name}</button>`
      : st.signedUp
        ? html`<button type="button" class="btn btn-primary btn-block btn-lg" data-action="join" data-group="${g.id}">Accept the summons</button>
          <button type="button" class="btn btn-ghost btn-block" data-action="decline" data-group="${g.id}">Not now</button>`
        : html`<button type="button" class="btn btn-primary btn-block btn-lg" data-action="go" data-to="/signup/${g.id}">Accept the summons</button>`}
    <p class="fine">No real money, ever. Valor is earned, never bought. Groups are invite-only and 18+.</p>
  </section>`;
}

function viewSignup(groupId) {
  const g = S.group(groupId) || S.group("gymrats");
  return html`<section class="screen signup">
    <button type="button" class="btn-back" data-action="back">${ic("back")}<span>Back</span></button>
    <div class="signup-head">
      ${mascot("signup-mascot wiggle")}
      <div class="bubble bubble-left">What shall we call you, brave one?</div>
    </div>
    <h1 class="display">Join ${g.name}</h1>
    <form class="card form" data-form="signup" data-group="${g.id}" novalidate>
      <label class="field">
        <span class="label">Your name</span>
        <input name="name" type="text" maxlength="24" autocomplete="given-name" required placeholder="e.g. Viet" />
      </label>
      <label class="check">
        <input type="checkbox" name="adult" required />
        <span>I am 18 or older</span>
      </label>
      <label class="check">
        <input type="checkbox" name="rules" required />
        <span>I'll be a good sport: no nasty photos, no bullying, report anything off</span>
      </label>
      <p class="form-error" role="alert" hidden></p>
      <button type="submit" class="btn btn-primary btn-block btn-lg">Sign up and join</button>
    </form>
    <p class="fine">Prototype: nothing is sent anywhere. Your name stays in this browser.</p>
  </section>`;
}

function groupHeader(g) {
  const u = S.me();
  const groups = S.myGroups();
  return html`<header class="topbar">
    ${mascot("topbar-mascot")}
    <div class="topbar-title">
      <span class="eyebrow">Your group</span>
      ${groups.length > 1
        ? html`<button type="button" class="group-switch" data-action="switch-group" aria-label="Switch group, current: ${g.name}">${g.name} ${ic("chevron", "rot90")}</button>`
        : html`<span class="group-name">${g.name}</span>`}
    </div>
    <a href="#/profile" class="purse" aria-label="Your purse: ${u.valor} valor">${ic("coin")}<b>${u.valor}</b></a>
  </header>`;
}

function viewGroup() {
  const st = S.get();
  const g = S.group(st.currentGroup);
  if (!g || !g.members.includes(st.actingAs)) {
    return html`<section class="screen">
      <h1 class="display">No group yet</h1>
      ${emptyState("You left your group. It's quiet in here.", "Groups are invite-only. Ask a friend for a link, or use the demo invite below.",
        html`<button type="button" class="btn btn-primary" data-action="go" data-to="/invite/gymrats">Open Mai's invite again</button>`)}
    </section>`;
  }
  const invites = S.pendingInvites().filter(() => st.actingAs === "you");
  const tab = ui.groupTab;
  return html`${groupHeader(g)}
  <section class="screen group">
    <h1 class="sr-only">${g.name}</h1>
    ${invites.map((inv) => html`<div class="card invite-card">
      ${avatar(inv.invitedBy)}
      <div class="grow"><b>${S.user(inv.invitedBy).name}</b> invited you to <b>${inv.name}</b></div>
      <a class="btn btn-sm btn-secondary" href="#/invite/${inv.id}">View</a>
    </div>`)}
    <div class="segmented" role="tablist" aria-label="Group sections">
      <button type="button" role="tab" id="tab-oaths" aria-controls="panel" aria-selected="${tab === "oaths"}" class="${tab === "oaths" ? "on" : ""}" data-action="group-tab" data-tab="oaths">Oaths</button>
      <button type="button" role="tab" id="tab-board" aria-controls="panel" aria-selected="${tab === "board"}" class="${tab === "board" ? "on" : ""}" data-action="group-tab" data-tab="board">Leaderboard</button>
    </div>
    <div id="panel" role="tabpanel" aria-labelledby="tab-${tab}">${tab === "board" ? boardPanel(g) : oathsPanel(g)}</div>
  </section>`;
}

function oathCard(o) {
  const mine = o.swearerId === S.get().actingAs;
  return html`<a class="card oath-card ${o.status}" href="#/oath/${o.id}">
    <div class="oath-card-top">
      ${avatar(o.swearerId)}
      <div class="grow">
        <span class="who">${mine ? "You swore" : `${S.user(o.swearerId).name} swore`}</span>
        <span class="oath-title">${o.title}</span>
      </div>
      ${statusPill(o)}
    </div>
    ${o.status === "active" ? progress(o) : ""}
    <div class="oath-card-foot">
      ${valorChip(o.stake)}<span class="muted">staked</span>
      ${o.iou ? html`<span class="chip chip-iou" title="IOU">IOU: ${o.iou}</span>` : ""}
    </div>
  </a>`;
}

function oathsPanel(g) {
  const active = S.activeOaths(g.id);
  const settled = S.settledOaths(g.id).slice(0, 6);
  return html`
    <button type="button" class="card cta" data-action="go" data-to="/swear">
      ${mascot("cta-mascot")}
      <span class="grow"><b class="cta-title">Swear an oath</b><span class="muted">Pick a quest, set a deadline, stake valor</span></span>
      <span class="cta-plus">${ic("plus")}</span>
    </button>
    <h2 class="section-title">Active oaths <span class="count">${active.length}</span></h2>
    ${active.length
      ? html`<div class="list">${active.map(oathCard)}</div>`
      : emptyState("Nobody has sworn anything. Suspicious.", "Be the first: swear an oath and let the group witness it.")}
    <a class="card duel-card" href="#/duel">
      <span class="duel-icon">${ic("duel")}</span>
      <span class="grow"><b>Duel a friend</b><span class="muted">Same oath, winner takes both stakes</span></span>
      <span class="badge">Coming in M2</span>
    </a>
    <h2 class="section-title">Recently settled</h2>
    ${settled.length
      ? html`<div class="list">${settled.map(oathCard)}</div>`
      : emptyState("No oaths settled yet.", "Kept and broken oaths land here when their deadline passes.")}
  `;
}

function boardPanel(g) {
  const rows = S.leaderboard(g.id);
  const resetIn = Math.ceil((S.weekStart() + 7 * 864e5 - S.now()) / 864e5);
  const anyone = rows.some((r) => r.earned > 0);
  return html`
    <div class="board-head"><h2 class="section-title">This week</h2><span class="muted">Resets in ${plural(resetIn, "day")}</span></div>
    ${anyone
      ? html`<ol class="board">${rows.map((r, i) => {
        const rank = eco.rankFor(r.user.lifetime).name;
        const honor = eco.honorPct(r.user.kept, r.user.broken);
        return html`<li class="card board-row ${r.user.id === S.get().actingAs ? "me" : ""}">
          <span class="place place-${i + 1}">${i + 1}</span>
          ${avatar(r.user.id)}
          <a class="grow board-name" href="#/profile/${r.user.id}"><b>${nameOf(r.user.id)}</b><span class="muted">${rank} | Honor ${honor === null ? "unrated" : honor + "%"}</span></a>
          ${valorChip(r.earned)}
        </li>`;
      })}</ol>`
      : emptyState("The leaderboard is empty. Glory awaits.", "Valor earned by keeping oaths and witnessing this week shows up here.")}
    <p class="fine">Counts valor earned this week from kept oaths and witnessing. Daily top-ups don't count.</p>`;
}

// ------------------------------------------------------------ swear (J2)

function deadlineOptions() {
  const n = new Date(S.now());
  const at = (days, h, m = 0) => {
    const d = new Date(n);
    d.setDate(d.getDate() + days);
    d.setHours(h, m, 0, 0);
    return d.getTime();
  };
  const toSunday = (7 - n.getDay()) % 7 || 7;
  const opts = [
    { id: "tonight", label: "Tonight", t: at(0, 23, 59) },
    { id: "tomorrow", label: "Tomorrow", t: at(1, 21) },
    { id: "3days", label: "In 3 days", t: at(3, 21) },
    { id: "sunday", label: "Sunday", t: at(toSunday, 21) },
    { id: "week", label: "In a week", t: at(7, 21) }
  ];
  return opts.filter((o) => o.t > S.now() + 3600e3);
}

function toLocalInput(t) {
  const d = new Date(t);
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function newDraft(templateId) {
  const t = TEMPLATES.find((x) => x.id === templateId) || TEMPLATES[0];
  const u = S.me();
  const opts = deadlineOptions();
  const pick = opts.find((o) => o.t - S.now() >= t.days * 864e5 * 0.6) || opts[opts.length - 1];
  return {
    template: t.id,
    title: t.title,
    checkins: t.checkins,
    deadline: pick.t,
    deadlineChoice: pick.id,
    stake: eco.clampStake(u.valor * ECONOMY.defaultStakeFraction, u.valor),
    iou: ""
  };
}

function viewSwear() {
  const u = S.me();
  const g = S.group(S.get().currentGroup);
  if (!g) return viewGroup();
  if (!ui.draft) ui.draft = newDraft("gym");
  const d = ui.draft;
  const max = Math.floor(u.valor / ECONOMY.stakeStep) * ECONOMY.stakeStep;
  const canStake = max >= ECONOMY.minStake;
  const witnesses = g.members.filter((m) => m !== u.id);
  return html`<section class="screen swear">
    <h1 class="display">Swear an oath</h1>
    <p class="muted">In front of ${g.name}. They'll be your witnesses.</p>

    <h2 class="section-title">1. Pick a quest</h2>
    <div class="templates" role="radiogroup" aria-label="Oath template">
      ${TEMPLATES.map((t) => html`<button type="button" role="radio" aria-checked="${d.template === t.id}" class="tpl ${d.template === t.id ? "on" : ""}" data-action="template" data-id="${t.id}">
        <img src="${scenes.generatedPhoto(`gen:${scenes.sceneForTemplate(t.id)}:tpl`)}" alt="" width="56" height="56">
        <span>${t.label}</span>
      </button>`)}
    </div>

    <form class="card form" data-form="swear" novalidate>
      <label class="field">
        <span class="label">2. Your oath</span>
        <input name="title" type="text" maxlength="80" required value="${d.title}" placeholder="I solemnly swear to..." data-bind="title">
      </label>

      <div class="field">
        <span class="label" id="checkins-label">3. Check-ins needed</span>
        <div class="stepper" role="group" aria-labelledby="checkins-label">
          <button type="button" class="btn btn-sm btn-ghost" data-action="checkins" data-delta="-1" aria-label="Fewer check-ins" ${d.checkins <= 1 ? "disabled" : ""}>-</button>
          <output aria-live="polite"><b>${d.checkins}</b> ${d.checkins === 1 ? "photo" : "photos"}</output>
          <button type="button" class="btn btn-sm btn-ghost" data-action="checkins" data-delta="1" aria-label="More check-ins" ${d.checkins >= 7 ? "disabled" : ""}>+</button>
        </div>
      </div>

      <fieldset class="field">
        <legend class="label">4. Deadline</legend>
        <div class="chips">
          ${deadlineOptions().map((o) => html`<button type="button" class="chip chip-choice ${d.deadlineChoice === o.id ? "on" : ""}" aria-pressed="${d.deadlineChoice === o.id}" data-action="deadline" data-t="${o.t}" data-id="${o.id}">${o.label}</button>`)}
        </div>
        <label class="inline-field"><span class="muted">or pick:</span>
          <input type="datetime-local" name="deadline" value="${toLocalInput(d.deadline)}" min="${toLocalInput(S.now() + 3600e3)}" data-bind="deadline" aria-label="Custom deadline">
        </label>
        <span class="muted small">${timeLeft(d.deadline)}</span>
      </fieldset>

      <div class="field">
        <label class="label" for="stake">5. Stake valor</label>
        ${canStake
          ? html`<div class="stake-row">
              <input id="stake" type="range" min="${ECONOMY.minStake}" max="${max}" step="${ECONOMY.stakeStep}" value="${d.stake}" data-bind="stake" aria-describedby="stake-help">
              <output class="stake-out" for="stake">${valorChip(d.stake, "chip-lg")}</output>
            </div>
            <span id="stake-help" class="muted small">From your purse of ${u.valor}. Keep the oath: stake back plus about ${eco.keptReward(d.stake, u.streak)}. Break it: the stake is burned.</span>`
          : html`<p class="notice">Your purse is nearly empty. Your daily top-up of ${ECONOMY.dailyTopUp} valor arrives tomorrow, or witness friends' proofs to earn some.</p>`}
      </div>

      <label class="field">
        <span class="label">6. IOU stake <span class="muted">(optional)</span></span>
        <input name="iou" type="text" maxlength="60" value="${d.iou}" placeholder="e.g. Loser buys dinner" data-bind="iou" aria-describedby="iou-help">
        <span id="iou-help" class="muted small">Friends settle it themselves. The app never touches money.</span>
      </label>
      <div class="chips">${IOU_SUGGESTIONS.map((s) => html`<button type="button" class="chip chip-choice" data-action="iou" data-text="${s}">${s}</button>`)}</div>

      <div class="witness-row">
        <div class="stack-avatars">${witnesses.map((m) => avatar(m, "sm"))}</div>
        <span class="muted small">${plural(witnesses.length, "witness")}: everyone in ${g.name}</span>
      </div>
      <p class="form-error" role="alert" hidden></p>
      <button type="submit" class="btn btn-primary btn-block btn-lg" ${canStake ? "" : "disabled"}>${ic("sword")} Swear it</button>
    </form>
  </section>`;
}

function syncStake() {
  const range = app.querySelector("#stake");
  if (!range) return;
  const pct = ((range.value - range.min) / Math.max(1, range.max - range.min)) * 100;
  range.style.setProperty("--fill", pct + "%");
}

function viewCeremony() {
  const d = ui.draft;
  if (!d) return viewSwear();
  const u = S.me();
  const g = S.group(S.get().currentGroup);
  const sworn = !!d.swornId;
  return html`<section class="screen ceremony ${sworn ? "sworn" : ""}">
    <h1 class="sr-only">The swearing ceremony</h1>
    <div class="ceremony-stage">
      <div class="plate plate-xl">${mascot(`ceremony-mascot ${sworn ? "hop" : "bob"}`, "The pigeon knight raises its sword")}</div>
      ${sworn ? html`<div class="seal" aria-hidden="true"><span>SWORN</span></div>` : ""}
    </div>
    <div class="scroll-card card">
      <p class="eyebrow">Repeat after the pigeon</p>
      <p class="vow">I, <b>${u.name}</b>, do solemnly swear: <b>"${d.title}"</b>, with ${plural(d.checkins, "photo check-in")}, before <b>${new Date(d.deadline).toLocaleString(undefined, { weekday: "long", hour: "2-digit", minute: "2-digit" })}</b>, upon <b>${d.stake} valor</b>${d.iou ? html`, and should I fail: <b>${d.iou.toLowerCase()}</b>` : ""}.</p>
      <p class="muted small">Witnessed by ${g.name}.</p>
    </div>
    ${sworn
      ? html`<p class="ceremony-line" role="status">It is done. ${g.name} has been notified and they are your witnesses now. No pressure.</p>
        <button type="button" class="btn btn-primary btn-block btn-lg" data-action="go" data-to="/oath/${d.swornId}">To the oath thread</button>`
      : html`<button type="button" class="btn btn-primary btn-block btn-lg" data-action="do-swear">${ic("sword")} I swear it</button>
        <button type="button" class="btn btn-ghost btn-block" data-action="go" data-to="/swear">Wait, let me change something</button>`}
  </section>`;
}

// -------------------------------------------------------- oath thread (J3, J4)

function viewOath(id) {
  const o = S.oath(id);
  if (!o) return emptyState("That oath has vanished into the mist.", "", html`<a class="btn btn-primary" href="#/group">Back to the group</a>`);
  const st = S.get();
  const actor = st.actingAs;
  const mine = o.swearerId === actor;
  const g = S.group(o.groupId);
  const witnesses = S.witnessesFor(o);
  const isMember = g && g.members.includes(actor);
  const active = o.status === "active";
  const items = [
    ...o.proofs.map((p) => ({ kind: "proof", at: p.at, p })),
    ...o.thread.map((m) => ({ kind: "msg", at: m.at, m }))
  ].sort((a, b) => a.at - b.at);
  return html`<header class="topbar topbar-thread">
    <button type="button" class="btn-icon" data-action="go" data-to="/group" aria-label="Back to ${g ? g.name : "group"}">${ic("back")}</button>
    <div class="topbar-title"><span class="eyebrow">${g ? g.name : ""}</span><span class="group-name">Oath thread</span></div>
    <button type="button" class="btn-icon" data-action="oath-menu" data-id="${o.id}" aria-label="More options for this oath">${ic("dots")}</button>
  </header>
  <section class="screen thread">
    <div class="card oath-hero ${o.status}">
      <div class="oath-card-top">
        ${avatar(o.swearerId, "lg")}
        <div class="grow"><span class="who">${mine ? "You swore" : `${S.user(o.swearerId).name} swore`}</span>
        <h1 class="oath-title-lg">${o.title}</h1></div>
      </div>
      <div class="hero-pills">${statusPill(o)} ${valorChip(o.stake)} <span class="muted small">staked</span></div>
      ${o.iou ? html`<p class="iou-line"><b>IOU:</b> ${o.iou}</p>` : ""}
      ${progress(o)}
      <p class="muted small">Witnesses: ${witnesses.map(nameOf).join(", ") || "nobody yet"}</p>
      ${!active && o.result
        ? html`<a class="btn btn-block ${o.status === "kept" ? "btn-success" : "btn-danger"}" href="#/result/${o.id}">${ic("share")} See the ${o.status === "kept" ? "share" : "shame"} card</a>`
        : ""}
      ${active && mine
        ? html`<a class="btn btn-primary btn-block btn-lg" href="#/capture/${o.id}/proof">${ic("camera")} Prove it</a>`
        : ""}
      ${active && !mine && isMember && isClose(o)
        ? html`<button type="button" class="btn btn-secondary btn-block" data-action="nudge" data-id="${o.id}">${ic("bell")} Nudge ${S.user(o.swearerId).name}: ${timeLeft(o.deadline)}</button>`
        : ""}
    </div>
    ${active ? html`<div class="demo-row" role="group" aria-label="Demo controls for this oath">
      <span class="demo-tag">Demo</span>
      <button type="button" class="btn btn-sm btn-ghost" data-action="simulate">${ic("users")} Simulate friends</button>
      <button type="button" class="btn btn-sm btn-ghost" data-action="fast-forward" data-id="${o.id}">${ic("forward")} Skip to deadline</button>
    </div>` : ""}
    <h2 class="section-title">Proof and banter</h2>
    ${items.length
      ? html`<ol class="feed">${items.map((it) => (it.kind === "proof" ? proofItem(o, it.p) : msgItem(o, it.m)))}</ol>`
      : emptyState(mine ? "No proof yet. The pigeon waits." : `No proof yet from ${S.user(o.swearerId).name}.`,
        mine ? "Tap Prove it and snap your first check-in." : "Say something encouraging. Or don't.")}
  </section>
  ${isMember ? html`<form class="composer" data-form="reply" data-id="${o.id}">
    <a class="btn-icon" href="#/capture/${o.id}/reply" aria-label="Reply with a photo">${ic("camera")}</a>
    <label class="sr-only" for="reply-text">Reply</label>
    <input id="reply-text" name="text" type="text" maxlength="280" placeholder="${active ? "Banter goes here..." : "Say something"}" autocomplete="off">
    <button type="submit" class="btn-icon btn-icon-primary" aria-label="Send reply">${ic("send")}</button>
  </form>` : ""}`;
}

function reactionsRow(o, item) {
  const actor = S.get().actingAs;
  return html`<div class="reactions" role="group" aria-label="Reactions">
    ${REACTIONS.map((r) => {
      const who = item.reactions[r.id] || [];
      const on = who.includes(actor);
      return html`<button type="button" class="react ${on ? "on" : ""}" aria-pressed="${on}" data-action="react" data-oath="${o.id}" data-item="${item.id}" data-r="${r.id}" aria-label="${r.label}${who.length ? `, ${who.length}` : ""}">${r.label}${who.length ? html` <b>${who.length}</b>` : ""}</button>`;
    })}
  </div>`;
}

function hiddenItem(kind) {
  return html`<div class="hidden-item">${ic("flag")} This ${kind} was reported and is hidden pending review.</div>`;
}

function proofItem(o, p) {
  const actor = S.get().actingAs;
  const blocked = S.isBlocked(p.userId);
  const status = eco.checkinStatus(p);
  const votes = Object.entries(p.votes);
  const approves = votes.filter(([, v]) => v === "approve").map(([k]) => k);
  const calls = votes.filter(([, v]) => v === "call").map(([k]) => k);
  const myVote = p.votes[actor];
  const canVote = o.status === "active" && actor !== o.swearerId && !p.hidden;
  const label = { approved: "Approved", called: "Called out", pending: "Waiting for witnesses", hidden: "Hidden" }[status];
  return html`<li class="feed-item proof">
    <div class="feed-head">
      ${avatar(p.userId, "sm")}
      <span class="grow"><b>${nameOf(p.userId)}</b> <span class="muted small">check-in ${p.checkin} of ${o.checkins} | ${ago(p.at)}</span></span>
      ${p.userId !== actor && !p.hidden ? html`<button type="button" class="btn-icon btn-icon-sm" data-action="item-menu" data-oath="${o.id}" data-item="${p.id}" data-kind="photo" data-user="${p.userId}" aria-label="Report or block: proof photo from ${S.user(p.userId).name}">${ic("dots")}</button>` : ""}
    </div>
    ${p.hidden || blocked
      ? hiddenItem("photo")
      : html`<div class="card proof-card">
        <img class="photo" src="${p.image.startsWith("gen:") ? scenes.stampedGenerated(p.image, { title: o.title, at: p.at, checkin: p.checkin, of: o.checkins }) : scenes.imageSrc(p.image)}" alt="Proof photo from ${S.user(p.userId).name}: ${p.caption || o.title}" loading="lazy">
        ${p.caption ? html`<p class="caption">${p.caption}</p>` : ""}
        <div class="verdict">
          <span class="pill ${status === "approved" ? "pill-success" : status === "called" ? "pill-danger" : "pill-warning"}">${label}</span>
          <span class="muted small">${approves.length} approve${approves.length ? ` (${approves.map(nameOf).join(", ")})` : ""} | ${calls.length} called it</span>
        </div>
        ${canVote ? html`<div class="vote-row">
          <button type="button" class="btn btn-success grow ${myVote === "approve" ? "picked" : ""}" aria-pressed="${myVote === "approve"}" data-action="vote" data-oath="${o.id}" data-item="${p.id}" data-v="approve">${ic("check")} ${myVote === "approve" ? "Approved" : "Approve"}</button>
          <button type="button" class="btn btn-danger-outline grow ${myVote === "call" ? "picked" : ""}" aria-pressed="${myVote === "call"}" data-action="vote" data-oath="${o.id}" data-item="${p.id}" data-v="call">${ic("x")} ${myVote === "call" ? "Called it" : "Call it"}</button>
        </div>` : ""}
        ${reactionsRow(o, p)}
      </div>`}
  </li>`;
}

function msgItem(o, m) {
  const actor = S.get().actingAs;
  if (m.type === "system") return html`<li class="feed-item system"><span>${m.text}</span></li>`;
  const mineMsg = m.userId === actor;
  const blocked = S.isBlocked(m.userId);
  return html`<li class="feed-item msg ${mineMsg ? "mine" : ""} msg-${m.type}">
    ${mineMsg ? "" : avatar(m.userId, "sm")}
    <div class="msg-body">
      <span class="msg-meta"><b>${nameOf(m.userId)}</b> <span class="muted small">${m.type === "nudge" ? "sent a nudge | " : ""}${ago(m.at)}</span></span>
      ${m.hidden || blocked
        ? hiddenItem(m.type === "photo" ? "photo" : "message")
        : html`<div class="bubble-msg">
          ${m.type === "nudge" ? html`<img class="nudge-mascot wiggle" src="assets/valor-pigeon-192.png" alt="" width="72" height="72">` : ""}
          ${m.type === "photo" && m.image ? html`<img class="photo photo-sm" src="${scenes.imageSrc(m.image)}" alt="Photo reply from ${S.user(m.userId).name}${m.text ? ": " + m.text : ""}" loading="lazy">` : ""}
          ${m.text ? html`<p>${m.text}</p>` : ""}
        </div>`}
    </div>
    ${!mineMsg && !m.hidden && !blocked ? html`<button type="button" class="btn-icon btn-icon-sm" data-action="item-menu" data-oath="${o.id}" data-item="${m.id}" data-kind="${m.type === "photo" ? "photo" : "message"}" data-user="${m.userId}" aria-label="Report or block: ${m.type === "photo" ? "photo" : "message"} from ${S.user(m.userId).name}">${ic("dots")}</button>` : ""}
  </li>`;
}

// --------------------------------------------------------------- capture (J3)

function viewCapture(id, mode) {
  const o = S.oath(id);
  if (!o) return viewGroup();
  const c = ui.capture && ui.capture.oathId === id && ui.capture.mode === mode ? ui.capture : (ui.capture = { oathId: id, mode, shot: null, cameraState: "starting" });
  const proof = mode === "proof";
  return html`<header class="topbar topbar-thread">
    <button type="button" class="btn-icon" data-action="cancel-capture" data-id="${o.id}" aria-label="Cancel and go back to the oath">${ic("back")}</button>
    <div class="topbar-title"><span class="eyebrow">${proof ? `Check-in ${o.proofs.length + 1} of ${o.checkins}` : "Photo reply"}</span><span class="group-name">${o.title}</span></div>
    <span></span>
  </header>
  <section class="screen capture">
    <h1 class="sr-only">${proof ? "Take a proof photo" : "Take a photo reply"}</h1>
    ${c.shot
      ? html`<div class="viewfinder card"><img class="photo" src="${c.shot}" alt="Your ${proof ? "stamped proof photo" : "photo"} preview"></div>
        <form class="form" data-form="post-photo" data-id="${o.id}" data-mode="${mode}">
          <label class="field"><span class="label">${proof ? "Caption" : "Message"}</span>
            <input name="caption" type="text" maxlength="120" placeholder="${proof ? "e.g. Leg day done" : "Say something"}"></label>
          <div class="btn-row">
            <button type="button" class="btn btn-ghost" data-action="retake">Retake</button>
            <button type="submit" class="btn btn-primary grow">${ic("send")} ${proof ? "Post proof" : "Send photo"}</button>
          </div>
        </form>`
      : html`<div class="viewfinder card">
          <video id="cam" playsinline muted autoplay aria-label="Camera preview"></video>
          <div class="cam-fallback" id="cam-fallback">
            ${mascot("cam-mascot bob")}
            <p id="cam-status" role="status">${c.cameraState === "starting" ? "Waking up the camera..." : "No camera here. Try one of these instead."}</p>
          </div>
          ${proof ? html`<div class="stamp-preview" aria-hidden="true">${o.title}</div>` : ""}
        </div>
        <div class="capture-actions">
          <button type="button" class="shutter" id="shutter" data-action="snap" aria-label="Take photo" disabled><span></span></button>
          <label class="btn btn-ghost">${ic("camera")} Open phone camera
            <input type="file" accept="image/*" capture="environment" class="sr-only" data-action-change="file-shot"></label>
          <button type="button" class="btn btn-ghost" data-action="placeholder-shot">${ic("image")} Use a placeholder photo (demo)</button>
        </div>
        <p class="fine">${proof ? "Proof photos are taken in the app and stamped with the time and the oath, so an old photo can't be reused." : "Photo replies go to this oath's thread, visible only to the group."}</p>`}
  </section>`;
}

function stopStream() {
  if (ui.stream) {
    ui.stream.getTracks().forEach((t) => t.stop());
    ui.stream = null;
  }
}

async function startCapture() {
  const c = ui.capture;
  if (!c || c.shot) return;
  const video = document.getElementById("cam");
  const status = document.getElementById("cam-status");
  const shutter = document.getElementById("shutter");
  if (!video) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    c.cameraState = "none";
    if (status) status.textContent = "No camera API in this browser. Use the phone camera or a placeholder photo.";
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 } }, audio: false });
    if (!document.getElementById("cam") || ui.capture !== c) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    ui.stream = stream;
    video.srcObject = stream;
    await video.play().catch(() => {});
    c.cameraState = "live";
    video.classList.add("live");
    document.getElementById("cam-fallback").hidden = true;
    shutter.disabled = false;
  } catch (e) {
    c.cameraState = "none";
    if (status) status.textContent = e && e.name === "NotAllowedError"
      ? "Camera permission was declined. Use the phone camera or a placeholder photo."
      : "No camera found here. Use the phone camera or a placeholder photo.";
  }
}

async function finishShot(source) {
  const c = ui.capture;
  const o = S.oath(c.oathId);
  c.shot = await scenes.stampPhoto(source, { title: o.title, at: S.now(), checkin: o.proofs.length + 1, of: o.checkins, mode: c.mode });
  stopStream();
  render();
}

// ---------------------------------------------------------------- result (J5)

function viewResult(id) {
  const o = S.oath(id);
  if (!o || !o.result) return viewOath(id);
  const kept = o.status === "kept";
  const u = S.user(o.swearerId);
  const r = o.result;
  const mine = o.swearerId === S.get().actingAs;
  const who = mine ? "You" : u.name;
  const before = r.before || { valor: u.valor, honor: eco.honorPct(u.kept, u.broken), rank: eco.rankFor(u.lifetime).name };
  const after = r.after || { valor: u.valor, honor: eco.honorPct(u.kept, u.broken), rank: eco.rankFor(u.lifetime).name };
  return html`<section class="screen result ${kept ? "kept" : "broken"}">
    <button type="button" class="btn-back" data-action="go" data-to="/oath/${o.id}">${ic("back")}<span>Thread</span></button>
    <div class="result-stage">
      <div class="plate plate-xl">${mascot(`result-mascot ${kept ? "hop" : "slump"}`, kept ? "The pigeon knight hops for joy" : "The pigeon knight slumps, sword drooping")}</div>
      ${kept ? "" : html`<span class="cloud" aria-hidden="true"></span>`}
      <div class="bubble ${kept ? "bubble-left" : "bubble-left"}">${kept ? "Huzzah! Word kept!" : "Oh no. Oh no no no."}</div>
    </div>
    <p class="eyebrow">${o.title}</p>
    <h1 class="display result-title">${kept ? `${who} kept the oath` : `${who} broke the oath`}</h1>
    <div class="stats-grid">
      <div class="card stat">
        <span class="stat-label">${ic("coin")} Valor</span>
        <span class="stat-num" data-count-from="${before.valor}" data-count-to="${after.valor}">${after.valor}</span>
        <span class="stat-delta ${kept ? "up" : "down"}">${kept ? `+${r.reward} reward, ${r.returned} stake back` : `-${r.burned} burned`}</span>
      </div>
      <div class="card stat">
        <span class="stat-label">${ic("shield")} Honor</span>
        <span class="stat-num">${after.honor === null ? "-" : after.honor + "%"}</span>
        <div class="honor-bar" role="img" aria-label="Honor ${after.honor ?? 0} percent"><span data-honor-from="${before.honor ?? 0}" data-honor-to="${after.honor ?? 0}" style="width:${before.honor ?? 0}%"></span></div>
        <span class="stat-delta ${kept ? "up" : "down"}">${before.honor === null ? "First rating" : `${before.honor}% before`}</span>
      </div>
    </div>
    ${r.rankUp ? html`<div class="card rankup">
      ${mascot("rankup-mascot hop")}
      <div><p class="eyebrow">Rank up!</p><p class="rankup-title">${who} ${mine ? "are" : "is"} now a <b>${r.rankUp}</b></p><p class="muted small">Ranks never go down. Honor can, so keep your word.</p></div>
    </div>` : ""}
    ${o.iou ? html`<p class="card iou-result">${kept ? html`<b>IOU safe.</b> Nobody owes "${o.iou.toLowerCase()}" this time.` : html`<b>IOU due:</b> ${who} ${mine ? "owe" : "owes"} the group: ${o.iou.toLowerCase()}.`}</p>` : ""}
    <h2 class="section-title">${kept ? "Share card" : "Shame card"}</h2>
    <div class="card card-preview"><canvas id="share-canvas" width="1080" height="1350" role="img" aria-label="${kept ? "Share" : "Shame"} card for ${o.title}"></canvas></div>
    <div class="btn-row">
      <button type="button" class="btn btn-primary grow" data-action="share-card" data-id="${o.id}">${ic("share")} Share</button>
      <button type="button" class="btn btn-ghost grow" data-action="save-card" data-id="${o.id}">${ic("download")} Save image</button>
    </div>
    <a class="btn btn-ghost btn-block" href="#/group">Back to ${S.group(o.groupId)?.name || "the group"}</a>
  </section>`;
}

function cardData(o) {
  const u = S.user(o.swearerId);
  const r = o.result;
  const after = r.after || {};
  return {
    kept: o.status === "kept",
    name: u.name,
    title: o.title,
    groupName: S.group(o.groupId)?.name || "the group",
    reward: r.reward,
    burned: r.burned,
    honor: after.honor ?? eco.honorPct(u.kept, u.broken),
    rank: after.rank || eco.rankFor(u.lifetime).name,
    streak: after.streak ?? u.streak,
    iou: o.iou,
    checkins: o.checkins
  };
}

async function drawShareCard(o) {
  return scenes.renderCard(cardData(o), Palette.current().roles);
}

async function animateResult() {
  const id = currentPath().split("/")[2];
  const o = S.oath(id);
  if (!o) return;
  const target = document.getElementById("share-canvas");
  if (target) {
    const c = await drawShareCard(o);
    const live = document.getElementById("share-canvas");
    if (live) live.getContext("2d").drawImage(c, 0, 0);
  }
  const num = app.querySelector("[data-count-to]");
  if (num) {
    const from = +num.dataset.countFrom;
    const to = +num.dataset.countTo;
    if (!reduceMotion && from !== to) {
      const t0 = performance.now();
      const step = (t) => {
        const k = Math.min(1, (t - t0) / 900);
        num.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(step);
      };
      num.textContent = from;
      requestAnimationFrame(step);
    }
  }
  const bar = app.querySelector("[data-honor-to]");
  if (bar) requestAnimationFrame(() => requestAnimationFrame(() => (bar.style.width = bar.dataset.honorTo + "%")));
}

// --------------------------------------------------------------- profile

function viewProfile(userId) {
  const st = S.get();
  const u = S.user(userId);
  if (!st.users[userId]) return viewGroup();
  const self = userId === st.actingAs;
  const rank = eco.rankFor(u.lifetime);
  const next = eco.nextRank(u.lifetime);
  const honor = eco.honorPct(u.kept, u.broken);
  const history = S.oathsBy(userId).filter((o) => !S.isBlocked(o.swearerId));
  const blocked = S.isBlocked(userId);
  return html`<section class="screen profile">
    ${self ? "" : html`<button type="button" class="btn-back" data-action="back">${ic("back")}<span>Back</span></button>`}
    <div class="card profile-card">
      <div class="profile-top">
        ${avatar(userId, "xl")}
        <div class="grow">
          <h1 class="display profile-name">${self ? u.name : u.name}</h1>
          <span class="rank-badge">${ic("crown")} ${rank.name}</span>
        </div>
        ${mascot("profile-mascot bob")}
      </div>
      <div class="rank-ladder" aria-label="Rank ladder">
        ${ECONOMY.ranks.map((r) => html`<span class="rung ${r.name === rank.name ? "on" : u.lifetime >= r.min ? "past" : ""}">${r.name}</span>`)}
      </div>
      <div class="rank-progress" role="progressbar" aria-label="Progress to next rank" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(eco.rankProgress(u.lifetime) * 100)}"><span style="width:${Math.round(eco.rankProgress(u.lifetime) * 100)}%"></span></div>
      <p class="muted small">${next ? `${u.lifetime} of ${next.min} lifetime valor to ${next.name}` : `${u.lifetime} lifetime valor. Legendary.`}</p>
    </div>
    <div class="stats-grid four">
      <div class="card stat"><span class="stat-label">${ic("coin")} Valor</span><span class="stat-num">${u.valor}</span><span class="muted small">in purse</span></div>
      <div class="card stat"><span class="stat-label">${ic("shield")} Honor</span><span class="stat-num">${honor === null ? "-" : honor + "%"}</span><span class="muted small">${honor === null ? "unrated" : `${u.kept} kept, ${u.broken} broken`}</span></div>
      <div class="card stat"><span class="stat-label">${ic("flame")} Streak</span><span class="stat-num">${u.streak}</span><span class="muted small">best ${u.bestStreak || u.streak}</span></div>
      <div class="card stat"><span class="stat-label">${ic("crown")} Earned</span><span class="stat-num">${u.lifetime}</span><span class="muted small">lifetime</span></div>
    </div>
    <h2 class="section-title">Oath history</h2>
    ${history.length
      ? html`<div class="list">${history.map(oathCard)}</div>`
      : emptyState(self ? "No oaths yet. Your legend is unwritten." : `${u.name} hasn't sworn anything yet.`,
        self ? "Swear your first one. Start small: the pigeon believes in you." : "",
        self ? html`<a class="btn btn-primary" href="#/swear">${ic("sword")} Swear an oath</a>` : "")}
    ${self
      ? html`<h2 class="section-title">Settings</h2>
        <div class="card menu">
          <a href="#/theme">${ic("palette")}<span class="grow">Theme</span>${ic("chevron")}</a>
          <a href="#/safety">${ic("shield")}<span class="grow">Safety and privacy</span>${ic("chevron")}</a>
        </div>
        <p class="fine">Valor is earned by keeping oaths, witnessing and the daily top-up. It can't be bought, sold or cashed out.</p>
        <div class="demo-row demo-row-single" role="group" aria-label="Demo controls">
          <span class="demo-tag">Demo</span>
          <button type="button" class="btn btn-sm btn-danger-outline" data-action="reset-demo">${ic("reset")} Reset demo</button>
          <p class="fine">Start over from Mai's invite. Your theme is kept.</p>
        </div>`
      : html`<div class="btn-row">
        <button type="button" class="btn btn-ghost grow" data-action="report-user" data-user="${userId}">${ic("flag")} Report ${u.name}</button>
        ${blocked
          ? html`<button type="button" class="btn btn-ghost grow" data-action="unblock" data-user="${userId}">Unblock</button>`
          : html`<button type="button" class="btn btn-danger-outline grow" data-action="block-user" data-user="${userId}">${ic("ban")} Block</button>`}
      </div>`}
  </section>`;
}

// ------------------------------------------------------------------ theme

const PRESETS = [
  { name: "Valor default", value: Palette.DEFAULT_COOLORS_URL },
  { name: "Seaside", value: "https://coolors.co/264653-2a9d8f-e9c46a-f4a261-e76f51" },
  { name: "Midnight", value: "https://coolors.co/0b132b-1c2541-3a506b-5bc0be-6fffe9" },
  { name: "Berry", value: "https://coolors.co/f72585-7209b7-3a0ca3-4361ee-4cc9f0" }
];

function viewTheme() {
  const cur = Palette.current();
  const roles = cur.roles;
  const rows = Palette.audit(roles);
  const fails = rows.filter((r) => !r.pass).length;
  const shareUrl = `${location.origin}${location.pathname}?colors=${cur.colors.map((c) => c.slice(1)).join("-")}`;
  return html`<section class="screen theme">
    <button type="button" class="btn-back" data-action="back">${ic("back")}<span>Back</span></button>
    <h1 class="display">Theme</h1>
    <p class="muted">Paste any Coolors palette. Valor picks the background, text and button colours and keeps every pair readable.</p>
    <form class="card form" data-form="theme" novalidate>
      <label class="field"><span class="label">Coolors URL or hex list</span>
        <input name="colors" type="text" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://coolors.co/ff6b35-f7c59f-efefd0-004e89-1a659e" value="${Palette.toCoolorsUrl(cur.colors)}" aria-describedby="theme-help theme-error"></label>
      <p id="theme-help" class="muted small">2 to 10 colours, like coolors.co/264653-2a9d8f-e9c46a or #ff6b35, #004e89.</p>
      <p id="theme-error" class="form-error" role="alert" ${cur.error ? "" : "hidden"}>${cur.error || ""}</p>
      <div class="btn-row">
        <button type="submit" class="btn btn-primary grow">${ic("palette")} Apply</button>
        <button type="button" class="btn btn-ghost" data-action="theme-reset">${ic("reset")} Reset to default</button>
      </div>
    </form>
    <div class="chips presets">${PRESETS.map((p) => html`<button type="button" class="chip chip-choice" data-action="theme-preset" data-value="${p.value}">${p.name}</button>`)}</div>

    <h2 class="section-title">Palette</h2>
    <div class="swatches">${cur.colors.map((c) => html`<span class="swatch" style="--sw:${c}"><span class="swatch-chip"></span><code>${c}</code></span>`)}</div>

    <h2 class="section-title">Live preview</h2>
    <div class="card preview">
      <div class="oath-card-top">${avatar("mai")}<div class="grow"><span class="who">Mai swore</span><span class="oath-title">Gym 4x by Sunday</span></div><span class="pill pill-warning">${ic("clock")} 5h left</span></div>
      <div class="progress" aria-hidden="true"><span class="seg done"></span><span class="seg done"></span><span class="seg pending"></span><span class="seg"></span></div>
      <p class="muted small">Muted text stays readable too.</p>
      <div class="btn-row">
        <button type="button" class="btn btn-success grow" tabindex="-1">${ic("check")} Approve</button>
        <button type="button" class="btn btn-danger-outline grow" tabindex="-1">${ic("x")} Call it</button>
      </div>
      <div class="btn-row">
        <button type="button" class="btn btn-primary grow" tabindex="-1">Primary</button>
        <button type="button" class="btn btn-secondary grow" tabindex="-1">Secondary</button>
        <span class="chip chip-accent">Accent</span>
      </div>
    </div>

    <h2 class="section-title">Roles and contrast</h2>
    <p class="muted small">Mode: <b>${roles.mode}</b>. ${fails ? `${fails} pairs below WCAG AA` : `All ${rows.length} text pairs pass WCAG AA (4.5:1 text, 3:1 borders).`}</p>
    <div class="card contrast-table">
      ${rows.map((r) => html`<div class="crow">
        <span class="cpair" style="--fg: ${roles[r.fg]}; --bg: ${roles[r.bg]}">Aa</span>
        <span class="grow small"><b>${r.fg}</b> on ${r.bg}</span>
        <span class="small ${r.pass ? "ok" : "bad"}">${r.ratio.toFixed(2)}:1 ${r.pass ? "pass" : "fail"}</span>
      </div>`)}
    </div>
    <p class="fine">Share this theme: <code class="break">${shareUrl}</code></p>
  </section>`;
}

// ----------------------------------------------------------------- safety

function viewSafety() {
  const st = S.get();
  const blocked = st.blocks[st.actingAs] || [];
  const reports = st.reports.filter((r) => r.by === st.actingAs);
  const g = S.group(st.currentGroup);
  return html`<section class="screen safety">
    <button type="button" class="btn-back" data-action="back">${ic("back")}<span>Back</span></button>
    <h1 class="display">Safety and privacy</h1>
    <div class="card rules">
      <p><b>The rules of the realm</b></p>
      <ul>
        <li>Groups are invite-only and 18+. There is no public feed.</li>
        <li>Report or block from any photo, message or profile.</li>
        <li>Reported content is hidden right away, pending review.</li>
        <li>Proof photos are deleted 30 days after an oath settles (share cards are kept).</li>
      </ul>
    </div>
    <h2 class="section-title">Blocked people</h2>
    ${blocked.length
      ? html`<div class="card menu">${blocked.map((id) => html`<div class="menu-row">${avatar(id, "sm")}<span class="grow">${S.user(id).name}</span><button type="button" class="btn btn-sm btn-ghost" data-action="unblock" data-user="${id}">Unblock</button></div>`)}</div>`
      : emptyState("You haven't blocked anyone. Peaceful.", "", "", "empty-sm")}
    <h2 class="section-title">Your reports</h2>
    ${reports.length
      ? html`<div class="card menu">${reports.map((r) => html`<div class="menu-row">${ic("flag")}<span class="grow">${r.targetType} from ${r.targetUser ? S.user(r.targetUser).name : "a member"}<br><span class="muted small">${r.reason} | ${ago(r.at)}</span></span><span class="pill pill-warning">${r.status}</span></div>`)}</div>`
      : emptyState("No reports. Everyone is behaving. For now.", "", "", "empty-sm")}
    <h2 class="section-title">Danger zone</h2>
    <div class="card menu">
      ${g ? html`<button type="button" class="menu-btn" data-action="leave-group">${ic("door")}<span class="grow">Leave ${g.name}</span></button>` : ""}
      <button type="button" class="menu-btn danger" data-action="delete-account" ${st.actingAs !== "you" ? "disabled" : ""}>${ic("trash")}<span class="grow">Delete my account and photos</span></button>
    </div>
    ${st.actingAs !== "you" ? html`<p class="fine">Switch back to yourself in Demo controls to delete your account.</p>` : ""}
  </section>`;
}

function viewDuel() {
  return html`<section class="screen duel">
    <button type="button" class="btn-back" data-action="back">${ic("back")}<span>Back</span></button>
    <div class="result-stage">
      <div class="plate plate-xl">${mascot("hero-mascot wiggle", "The pigeon knight, sword ready")}</div>
      <div class="bubble bubble-left">En garde! ...next milestone.</div>
    </div>
    <span class="badge">Coming in M2</span>
    <h1 class="display">Duels</h1>
    <p class="lede">Challenge one friend to the same oath. They match your stake. Whoever proves it wins both stakes; if you both prove it, you both keep your honor.</p>
    <a class="btn btn-primary btn-block" href="#/swear">Swear a solo oath instead</a>
  </section>`;
}

// ============================================================ OVERLAYS

let lastFocus = null;

function openSheet(content, { label = "Dialog", onClose } = {}) {
  closeSheet();
  lastFocus = document.activeElement;
  layer.innerHTML = String(html`<div class="scrim" data-action="close-sheet"></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${label}">
      <div class="sheet-grip" aria-hidden="true"></div>
      ${content}
    </div>`);
  layer.hidden = false;
  layer._onClose = onClose;
  const first = layer.querySelector(".sheet button, .sheet a, .sheet input");
  if (first) first.focus();
}

function closeSheet() {
  if (layer.hidden) return;
  layer.hidden = true;
  layer.innerHTML = "";
  if (layer._onClose) layer._onClose();
  layer._onClose = null;
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
}

function confirmSheet({ title, body, confirm, danger, onConfirm }) {
  openSheet(html`<h2 class="sheet-title">${title}</h2>
    <p class="muted">${body}</p>
    <div class="btn-row">
      <button type="button" class="btn btn-ghost grow" data-action="close-sheet">Cancel</button>
      <button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"} grow" data-action="confirm-yes">${confirm}</button>
    </div>`, { label: title });
  layer._confirm = onConfirm;
}

function openDemoSheet() {
  const st = S.get();
  const g = S.group(st.currentGroup);
  const people = st.signedUp ? ["you", ...(g ? g.members.filter((m) => m !== "you") : [])] : [];
  openSheet(html`<h2 class="sheet-title">${ic("wand")} Demo controls</h2>
    <p class="muted small">Fake helpers for the prototype. In the real app your friends do this themselves.</p>
    ${people.length ? html`<fieldset class="field"><legend class="label">Act as</legend>
      <div class="chips">${people.map((id) => html`<button type="button" class="chip chip-choice ${st.actingAs === id ? "on" : ""}" aria-pressed="${st.actingAs === id}" data-action="persona" data-user="${id}">${avatar(id, "xs")} ${id === "you" ? `${S.user("you").name} (you)` : S.user(id).name}</button>`)}</div>
    </fieldset>` : ""}
    <div class="demo-grid">
      ${st.signedUp ? html`
      <button type="button" class="btn btn-ghost" data-action="simulate">${ic("users")} Simulate friends</button>
      <button type="button" class="btn btn-ghost" data-action="fast-forward">${ic("forward")} Fast-forward to next deadline</button>
      <button type="button" class="btn btn-ghost" data-action="next-day">${ic("sun")} Skip to tomorrow</button>
      <a class="btn btn-ghost" href="#/invite/goblins" data-action="close-sheet-link">${ic("users")} Open the second invite</a>` : ""}
      <a class="btn btn-ghost" href="#/theme" data-action="close-sheet-link">${ic("palette")} Theme</a>
      <button type="button" class="btn btn-danger-outline" data-action="reset-demo">${ic("reset")} Reset demo</button>
    </div>
    <p class="fine">Demo clock: ${new Date(S.now()).toLocaleString()}${st.clockOffset ? " (fast-forwarded)" : ""}. Everything lives in this browser only.</p>`, { label: "Demo controls" });
}

function openItemMenu(oathId, itemId, kind, userId) {
  const name = S.user(userId).name;
  openSheet(html`<h2 class="sheet-title">This ${kind} from ${name}</h2>
    <div class="card menu">
      <button type="button" class="menu-btn" data-action="report-item" data-oath="${oathId}" data-item="${itemId}" data-kind="${kind}" data-user="${userId}">${ic("flag")}<span class="grow">Report this ${kind}</span></button>
      <button type="button" class="menu-btn danger" data-action="block-user" data-user="${userId}">${ic("ban")}<span class="grow">Block ${name}</span></button>
    </div>
    <button type="button" class="btn btn-ghost btn-block" data-action="close-sheet">Cancel</button>`, { label: `Options for this ${kind}` });
}

function openReportReasons(onPick, what) {
  const reasons = ["Nudity or sexual content", "Bullying or harassment", "Violence or self-harm", "Spam or fake proof", "Something else"];
  openSheet(html`<h2 class="sheet-title">Report ${what}</h2>
    <p class="muted small">It is hidden for everyone right away and reviewed by a human.</p>
    <div class="card menu">${reasons.map((r) => html`<button type="button" class="menu-btn" data-action="report-reason" data-reason="${r}">${ic("flag")}<span class="grow">${r}</span></button>`)}</div>
    <button type="button" class="btn btn-ghost btn-block" data-action="close-sheet">Cancel</button>`, { label: `Report ${what}` });
  layer._reason = onPick;
}

function openGroupSwitch() {
  const groups = S.myGroups();
  openSheet(html`<h2 class="sheet-title">Your groups</h2>
    <div class="card menu">${groups.map((g) => html`<button type="button" class="menu-btn ${g.id === S.get().currentGroup ? "on" : ""}" data-action="pick-group" data-group="${g.id}">${ic("users")}<span class="grow">${g.name}<br><span class="muted small">${plural(g.members.length, "member")}</span></span></button>`)}</div>`, { label: "Switch group" });
}

let toastTimer = null;
function toast(text, tone = "", action = null) {
  const el = document.createElement("div");
  el.className = `toast ${tone}`;
  el.innerHTML = String(html`${mascot("toast-mascot")}<span class="grow">${text}</span>${action ? html`<a class="toast-link" href="${action.href}">${action.label}</a>` : ""}`);
  toasts.appendChild(el);
  while (toasts.children.length > 2) toasts.firstChild.remove();
  clearTimeout(toastTimer);
  setTimeout(() => {
    el.classList.add("out");
    setTimeout(() => el.remove(), 300);
  }, action ? 6000 : 3200);
}

// ============================================================== ACTIONS

function afterSettle(settled, preferId) {
  if (!settled.length) return false;
  const st = S.get();
  const target = settled.find((o) => o.id === preferId) || settled.find((o) => o.swearerId === st.actingAs) || settled[0];
  go(`/result/${target.id}`);
  const others = settled.length - 1;
  if (others > 0) toast(`${plural(others, "other oath")} also settled.`);
  return true;
}

const actions = {
  go: (el) => go(el.dataset.to),
  back: () => (history.length > 1 ? history.back() : go("/group")),
  "open-demo": () => openDemoSheet(),
  "close-sheet": () => closeSheet(),
  "close-sheet-link": () => closeSheet(),
  "confirm-yes": () => {
    const fn = layer._confirm;
    layer._confirm = null;
    closeSheet();
    if (fn) fn();
  },
  join: (el) => {
    S.joinGroup(el.dataset.group);
    toast(`You joined ${S.group(el.dataset.group).name}. Huzzah!`, "success");
    go("/group");
  },
  decline: (el) => {
    S.declineInvite(el.dataset.group);
    go("/group");
  },
  "group-tab": (el) => {
    ui.groupTab = el.dataset.tab;
    render();
    app.querySelector(`#tab-${ui.groupTab}`)?.focus();
  },
  "switch-group": () => openGroupSwitch(),
  "pick-group": (el) => {
    S.setGroup(el.dataset.group);
    closeSheet();
    ui.draft = null;
    go("/group");
  },
  template: (el) => {
    const keep = ui.draft;
    ui.draft = newDraft(el.dataset.id);
    if (keep) {
      ui.draft.stake = keep.stake;
      ui.draft.iou = keep.iou;
    }
    render();
    app.querySelector(`[data-id="${el.dataset.id}"]`)?.focus();
    if (el.dataset.id === "custom") app.querySelector('input[name="title"]')?.focus();
  },
  checkins: (el) => {
    ui.draft.checkins = Math.max(1, Math.min(7, ui.draft.checkins + +el.dataset.delta));
    render();
    app.querySelector(`[data-action="checkins"][data-delta="${el.dataset.delta}"]`)?.focus();
  },
  deadline: (el) => {
    ui.draft.deadline = +el.dataset.t;
    ui.draft.deadlineChoice = el.dataset.id;
    render();
    app.querySelector(`[data-action="deadline"][data-id="${el.dataset.id}"]`)?.focus();
  },
  iou: (el) => {
    ui.draft.iou = el.dataset.text;
    const input = app.querySelector('input[name="iou"]');
    if (input) input.value = el.dataset.text;
  },
  "do-swear": () => {
    const d = ui.draft;
    try {
      const o = S.swear(d);
      d.swornId = o.id;
      render();
    } catch (e) {
      toast(e.message, "danger");
    }
  },
  nudge: (el) => {
    S.nudge(el.dataset.id);
    toast("Nudge sent. In the real app this is a push notification.", "success");
    render();
  },
  vote: (el) => {
    const paid = S.vote(el.dataset.oath, el.dataset.item, el.dataset.v);
    if (paid) toast(`Thanks for witnessing: +${paid} valor`, "success");
    else if (S.me().witnessCount >= ECONOMY.witnessDailyCap) toast(`Vote changed. Witness rewards are capped at ${ECONOMY.witnessDailyCap} a day.`);
    render();
  },
  react: (el) => {
    S.react(el.dataset.oath, el.dataset.item, el.dataset.r);
    render();
    app.querySelector(`[data-action="react"][data-item="${el.dataset.item}"][data-r="${el.dataset.r}"]`)?.focus();
  },
  "item-menu": (el) => openItemMenu(el.dataset.oath, el.dataset.item, el.dataset.kind, el.dataset.user),
  "oath-menu": (el) => {
    const o = S.oath(el.dataset.id);
    const actor = S.get().actingAs;
    if (o.swearerId === actor) {
      openSheet(html`<h2 class="sheet-title">Your oath</h2><p class="muted">You can't withdraw an oath once sworn. That's rather the point.</p>
        <button type="button" class="btn btn-ghost btn-block" data-action="close-sheet">Fair enough</button>`, { label: "Oath options" });
    } else {
      openItemMenu(o.id, o.id, "oath", o.swearerId);
    }
  },
  "report-item": (el) => {
    const { oath, item, kind, user } = el.dataset;
    openReportReasons((reason) => {
      S.report(kind, item, oath, reason);
      const r = S.get().reports[S.get().reports.length - 1];
      r.targetUser = user;
      S.save();
      toast(`Reported. The ${kind} is hidden pending review.`, "success");
      render();
    }, `this ${kind}`);
  },
  "report-user": (el) => {
    const user = el.dataset.user;
    openReportReasons((reason) => {
      S.report("profile", user, null, reason);
      const r = S.get().reports[S.get().reports.length - 1];
      r.targetUser = user;
      S.save();
      toast(`Reported ${S.user(user).name}. A human will review it.`, "success");
      render();
    }, S.user(user).name);
  },
  "report-reason": (el) => {
    const fn = layer._reason;
    layer._reason = null;
    closeSheet();
    if (fn) fn(el.dataset.reason);
  },
  "block-user": (el) => {
    const user = el.dataset.user;
    closeSheet();
    confirmSheet({
      title: `Block ${S.user(user).name}?`,
      body: "You won't see their oaths, photos or messages, and they won't be told. You can unblock them in Safety and privacy.",
      confirm: "Block",
      danger: true,
      onConfirm: () => {
        S.block(user);
        toast(`${S.user(user).name} is blocked.`);
        render();
      }
    });
  },
  unblock: (el) => {
    S.unblock(el.dataset.user);
    toast(`${S.user(el.dataset.user).name} is unblocked.`);
    render();
  },
  "leave-group": () => {
    const g = S.group(S.get().currentGroup);
    confirmSheet({
      title: `Leave ${g.name}?`,
      body: "Your active oaths in this group are withdrawn and their stakes returned. You'll need a new invite to come back.",
      confirm: "Leave group",
      danger: true,
      onConfirm: () => {
        S.leaveGroup(g.id);
        toast(`You left ${g.name}.`);
        go("/group");
      }
    });
  },
  "delete-account": () => {
    confirmSheet({
      title: "Delete your account?",
      body: "Your profile, oaths, proof photos and messages are deleted for good. Your friends keep their own oaths.",
      confirm: "Delete everything",
      danger: true,
      onConfirm: () => {
        S.deleteAccount();
        ui.draft = null;
        toast("Account deleted. Farewell, brave one.");
        go("/invite/gymrats");
      }
    });
  },
  persona: (el) => {
    S.setActingAs(el.dataset.user);
    closeSheet();
    ui.draft = null;
    const name = el.dataset.user === "you" ? "yourself" : S.user(el.dataset.user).name;
    toast(`Now acting as ${name}.`);
    render();
  },
  simulate: () => {
    closeSheet();
    const r = S.simulateFriends();
    if (!r.votes && !r.replies && !r.proofs) toast("Your friends are asleep. Nothing to do right now.");
    else toast(`${listJoin(r.names)} ${r.names.length === 1 ? "was" : "were"} busy: ${plural(r.proofs, "proof")}, ${plural(r.votes, "vote")}, ${plural(r.replies, "reply")}.`, "success");
    render();
  },
  "fast-forward": (el) => {
    closeSheet();
    const { target, settled } = S.fastForward(el.dataset.id);
    if (!target) {
      toast("No active oaths with a deadline in this group.");
      return;
    }
    if (!afterSettle(settled, target.id)) render();
  },
  "next-day": () => {
    closeSheet();
    const { settled, topUp } = S.nextDay();
    if (topUp) toast(`A new day. Daily rations: +${topUp} valor.`, "success");
    if (!afterSettle(settled)) render();
  },
  "reset-demo": () => {
    closeSheet();
    confirmSheet({
      title: "Reset the demo?",
      body: "Clears everything this browser remembers (sign-up, oaths, photos) and starts fresh. Your theme is kept.",
      confirm: "Reset demo",
      danger: true,
      onConfirm: () => {
        S.resetDemo();
        ui.draft = null;
        ui.capture = null;
        ui.groupTab = "oaths";
        go("/invite/gymrats");
        toast("Demo reset.");
      }
    });
  },
  snap: async () => {
    const video = document.getElementById("cam");
    if (video && video.videoWidth) await finishShot(video);
  },
  "placeholder-shot": async () => {
    const o = S.oath(ui.capture.oathId);
    const img = await scenes.placeholderSource(ui.capture.mode === "reply" ? "couch" : scenes.sceneForTemplate(o.template));
    await finishShot(img);
  },
  retake: () => {
    ui.capture.shot = null;
    render();
  },
  "cancel-capture": (el) => {
    ui.capture = null;
    go(`/oath/${el.dataset.id}`);
  },
  "share-card": async (el) => {
    const o = S.oath(el.dataset.id);
    const c = await drawShareCard(o);
    const how = await scenes.shareCanvas(c, `valor-${o.status}-${o.id}.png`, `${S.user(o.swearerId).name} ${o.status === "kept" ? "kept" : "broke"} an oath: ${o.title}`);
    if (how === "downloaded") toast("Sharing isn't available here, so the card was saved as an image.");
    if (how === "unavailable") toast("Saving isn't available in this view. Take a screenshot of the card instead.");
  },
  "save-card": async (el) => {
    const o = S.oath(el.dataset.id);
    const c = await drawShareCard(o);
    const blob = await new Promise((r) => c.toBlob(r, "image/png"));
    const how = await scenes.saveBlob(blob, `valor-${o.status}-${o.id}.png`);
    if (how === "saved") toast("Card saved.");
    if (how === "unavailable") toast("Saving isn't available in this view. Take a screenshot of the card instead.");
  },
  "theme-reset": () => {
    Palette.reset();
    stripColorsParam();
    render();
    toast("Back to the default palette.");
  },
  "theme-preset": (el) => applyTheme(el.dataset.value)
};

function stripColorsParam() {
  if (new URLSearchParams(location.search).has("colors")) history.replaceState(null, "", location.pathname + location.hash);
}

function applyTheme(value) {
  const r = Palette.setPalette(value);
  const err = app.querySelector("#theme-error");
  if (!r.ok) {
    if (err) {
      err.hidden = false;
      err.textContent = r.error;
    }
    return;
  }
  Palette.current().error = null;
  stripColorsParam();
  render();
  toast("Theme applied.", "success");
}

const forms = {
  signup: (form) => {
    const name = form.name.value.trim();
    const err = form.querySelector(".form-error");
    const problems = [];
    if (!name) problems.push("Tell us your name.");
    if (!form.adult.checked) problems.push("Valor is for people 18 and over.");
    if (!form.rules.checked) problems.push("Please agree to be a good sport.");
    if (problems.length) {
      err.hidden = false;
      err.textContent = problems.join(" ");
      (!name ? form.name : !form.adult.checked ? form.adult : form.rules).focus();
      return;
    }
    S.signUp(name);
    const g = S.group(form.dataset.group);
    if (g && g.id !== "gymrats") S.joinGroup(g.id);
    go("/group");
    setTimeout(() => {
      openSheet(html`<div class="welcome">
        ${mascot("welcome-mascot hop")}
        <h2 class="sheet-title">Welcome, ${name}!</h2>
        <p>Here's your starting purse.</p>
        <p class="purse-big">${ic("coin")} <b>${ECONOMY.startingPurse}</b> valor</p>
        <p class="muted small">Stake it on oaths. Keep them to earn more. Valor is earned only, never bought.</p>
        <button type="button" class="btn btn-primary btn-block btn-lg" data-action="close-sheet">Let's go</button>
      </div>`, { label: "Welcome" });
    }, 60);
  },
  swear: (form) => {
    const d = ui.draft;
    d.title = form.title.value.trim();
    const err = form.querySelector(".form-error");
    if (!d.title) {
      err.hidden = false;
      err.textContent = "Write your oath first. Something like \"Gym 3x this week\".";
      form.title.focus();
      return;
    }
    if (d.deadline < S.now() + 30 * 60e3) {
      err.hidden = false;
      err.textContent = "Pick a deadline at least half an hour from now.";
      return;
    }
    d.iou = form.iou.value.trim();
    d.swornId = null;
    go("/swear/ceremony");
  },
  reply: (form) => {
    const text = form.text.value.trim();
    if (!text) return;
    S.reply(form.dataset.id, { text });
    render();
    app.scrollTop = app.scrollHeight;
    document.getElementById("reply-text")?.focus();
  },
  "post-photo": (form) => {
    const c = ui.capture;
    const caption = form.caption.value.trim();
    const o = S.oath(c.oathId);
    if (c.mode === "proof") {
      S.addProof(o.id, c.shot, caption);
      const n = o.proofs.length;
      toast(n >= o.checkins ? `All ${o.checkins} check-ins posted! Now the witnesses decide.` : `${n} of ${o.checkins}! The pigeon is proud.`, "success");
    } else {
      S.reply(o.id, { text: caption, image: c.shot });
    }
    ui.capture = null;
    go(`/oath/${o.id}`);
  },
  theme: (form) => applyTheme(form.colors.value)
};

// ---------------------------------------------------------- event wiring

document.addEventListener("click", (ev) => {
  const el = ev.target.closest("[data-action]");
  if (!el) return;
  const fn = actions[el.dataset.action];
  if (!fn) return;
  if (el.tagName === "A" && el.dataset.action !== "close-sheet-link") ev.preventDefault();
  if (el.disabled) return;
  fn(el, ev);
});

document.addEventListener("submit", (ev) => {
  const form = ev.target.closest("[data-form]");
  if (!form) return;
  ev.preventDefault();
  forms[form.dataset.form]?.(form);
});

document.addEventListener("input", (ev) => {
  const el = ev.target;
  if (!el.dataset.bind || !ui.draft) return;
  const k = el.dataset.bind;
  if (k === "stake") {
    ui.draft.stake = +el.value;
    const out = app.querySelector(".stake-out");
    if (out) out.innerHTML = String(valorChip(ui.draft.stake, "chip-lg"));
    const help = app.querySelector("#stake-help");
    if (help) help.textContent = `From your purse of ${S.me().valor}. Keep the oath: stake back plus about ${eco.keptReward(ui.draft.stake, S.me().streak)}. Break it: the stake is burned.`;
    syncStake();
  } else if (k === "deadline") {
    const t = new Date(el.value).getTime();
    if (!Number.isNaN(t)) {
      ui.draft.deadline = t;
      ui.draft.deadlineChoice = "custom";
    }
  } else {
    ui.draft[k] = el.value;
  }
});

document.addEventListener("change", async (ev) => {
  const el = ev.target;
  if (el.dataset.actionChange === "file-shot" && el.files && el.files[0]) {
    try {
      const img = await scenes.fileToImage(el.files[0]);
      await finishShot(img);
    } catch (e) {
      toast("That photo couldn't be read. Try again or use a placeholder.", "danger");
    }
  }
  if (el.dataset.bind === "deadline") render();
});

document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && !layer.hidden) closeSheet();
  if (ev.key === "Tab" && !layer.hidden) {
    const f = [...layer.querySelectorAll("button:not([disabled]), a[href], input")];
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (ev.shiftKey && document.activeElement === first) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && document.activeElement === last) {
      ev.preventDefault();
      first.focus();
    }
  }
});

window.addEventListener("hashchange", () => {
  closeSheet();
  if (!currentPath().startsWith("/swear")) ui.draft = null;
  render();
});

window.addEventListener("valor:palette", () => {
  if (!ui.firstLoad) {
    /* role colours are CSS variables, so only the canvas needs a redraw */
    if (currentPath().startsWith("/result")) animateResult();
  }
});

// ------------------------------------------------------------------- boot

async function boot() {
  S.load();
  const splash = document.getElementById("splash");
  scenes.loadMascot();
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]);
  const settled = S.settleDue();
  const topUp = S.dailyTopUp();
  render();
  if (topUp) toast(`Daily rations: +${topUp} valor.`, "success");
  if (settled.length && S.get().signedUp) {
    const mine = settled.find((o) => o.swearerId === S.get().actingAs);
    if (mine) toast(`Your oath "${mine.title}" was settled.`, "", { href: `#/result/${mine.id}`, label: "See it" });
  }
  setTimeout(() => {
    splash.classList.add("gone");
    setTimeout(() => splash.remove(), 400);
  }, reduceMotion ? 0 : 650);
  // Keep countdowns fresh.
  setInterval(() => {
    if (layer.hidden && !/^\/(capture|swear|result)/.test(currentPath()) && document.activeElement?.tagName !== "INPUT") render();
  }, 60e3);
}

boot();
