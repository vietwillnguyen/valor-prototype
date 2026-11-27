// Inline SVG icons drawn in the same chunky, rounded style as the UI.
// Decorative by default (aria-hidden); buttons carry their own text labels.
const P = {
  coin: '<circle cx="12" cy="12" r="9" fill="var(--v-warning)" stroke="currentColor"/><circle cx="12" cy="12" r="5.6" fill="none" stroke-width="1.6"/><path d="M9.8 9.6l2.2 5 2.2-5" fill="none" stroke-width="2"/>',
  shield: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/>',
  crown: '<path d="M4 17l-1-9 5 4 4-7 4 7 5-4-1 9z"/><path d="M4 20h16"/>',
  flame: '<path d="M12 21c-4 0-6.5-2.8-6.5-6.2 0-3.4 2.6-5.3 3.6-8.3 1.6 1.4 2.2 3 2.2 4.4 1-1 1.6-2.4 1.6-4.4 3 2 5.6 5.1 5.6 8.3 0 3.4-2.5 6.2-6.5 6.2z"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  ban: '<circle cx="12" cy="12" r="8.5"/><path d="M6 18L18 6"/>',
  send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  sword: '<path d="M12 2.5l2.2 2.6V14H9.8V5.1z"/><path d="M6.5 14.5h11"/><path d="M12 15v4.5"/><circle cx="12" cy="20.8" r="1.2"/>',
  home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  image: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5"/>',
  share: '<path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 12v8h14v-8"/>',
  download: '<path d="M12 4v11M8 11l4 4 4-4"/><path d="M5 20h14"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.4 3.3-5.3 6.5-5.3s5.7 1.9 6.5 5.3"/><path d="M15.5 4.8a3.4 3.4 0 0 1 0 6.5M18 14.8c1.8.8 3 2.6 3.5 5.2"/>',
  dots: '<circle cx="5.5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18.5" cy="12" r="1.2"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 2-2 0-1.5-1.5-1.8-1.5-3s1-2 2.5-2H18a3 3 0 0 0 3-3c0-4.4-4-8-9-8z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/>',
  wand: '<path d="M4 20L15 9M14 4v3M19 9h-3M17.5 5.5l-2 2M11 6.5L9.5 5M17.5 12.5l1.5 1.5"/>',
  forward: '<path d="M4 6l7 6-7 6zM12 6l7 6-7 6z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  reset: '<path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v4.5h4.5"/>',
  door: '<path d="M14 4H6v16h8"/><path d="M11 12h9M17 9l3 3-3 3"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
  duel: '<path d="M4.5 4.5l10 10M19.5 4.5l-10 10"/><path d="M12.5 17.5l5-5M11.5 17.5l-5-5"/><path d="M16 16l3.5 3.5M8 16l-3.5 3.5"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.5 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>'
};

export function icon(name, cls = "") {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${P[name] || ""}</svg>`;
}
