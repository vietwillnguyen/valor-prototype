/*
 * Valor palette module.
 *
 * One shared module for the prototype and the PRD. It takes a palette from a
 * Coolors URL or a hex list, validates it strictly, derives role tokens
 * (background, surface, primary, text, ...) and applies them as CSS custom
 * properties. Every foreground colour is checked and, when needed, nudged
 * towards black or white until it meets WCAG AA against the backgrounds it is
 * used on, so any palette stays readable.
 *
 * It is a classic script (no import or export) so it runs from a plain
 * <script> tag before first paint, and it also loads in Node for tests:
 * it attaches the API to globalThis.ValorPalette and to module.exports.
 *
 * Security: the raw user input is never written into CSS or HTML. Only hex
 * strings rebuilt from parsed numbers reach style.setProperty.
 */
(function (root) {
  "use strict";

  var DEFAULT_COOLORS_URL = "https://coolors.co/ff6b35-f7c59f-efefd0-004e89-1a659e";
  var DEFAULT_PALETTE = ["#ff6b35", "#f7c59f", "#efefd0", "#004e89", "#1a659e"];
  var STORAGE_KEY = "valor.palette.v1";
  var MIN_COLOURS = 2;
  var MAX_COLOURS = 10;
  var HEX6 = /^[0-9a-f]{6}$/;
  var HEX3 = /^[0-9a-f]{3}$/;

  // ---------------------------------------------------------------- parsing

  /**
   * Parse a Coolors URL or a hex list into ["#rrggbb", ...].
   * Returns { ok: true, colors } or { ok: false, error }.
   * Accepts: https://coolors.co/ff6b35-f7c59f, coolors.co/palette/..., "ff6b35-f7c59f",
   * "#ff6b35, #f7c59f", "ff6b35 f7c59f". Anything else is rejected.
   */
  function parsePalette(input) {
    if (typeof input !== "string") return fail("Paste a Coolors URL or a list of hex colours.");
    var text = input.trim();
    if (!text) return fail("Paste a Coolors URL or a list of hex colours.");
    if (text.length > 400) return fail("That is far too long to be a palette.");

    var list = text;
    if (/^(https?:\/\/)?([a-z0-9-]+\.)*coolors\.co(\/|$)/i.test(text)) {
      var path = text.replace(/^(https?:\/\/)?[^/]+/i, "").split(/[?#]/)[0];
      var segments = path.split("/").filter(Boolean);
      if (!segments.length) return fail("That Coolors link has no colours in it.");
      list = segments[segments.length - 1];
    } else if (/^[a-z]+:/i.test(text)) {
      return fail("Only coolors.co links or hex lists are accepted.");
    }

    var parts = list.split(/[\s,;-]+/).filter(Boolean);
    var colors = [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].toLowerCase().replace(/^#/, "");
      if (HEX3.test(p)) p = p[0] + p[0] + p[1] + p[1] + p[2] + p[2];
      if (!HEX6.test(p)) return fail("\"" + truncate(parts[i]) + "\" is not a hex colour.");
      colors.push("#" + p);
    }
    if (colors.length < MIN_COLOURS) return fail("A palette needs at least " + MIN_COLOURS + " colours.");
    if (colors.length > MAX_COLOURS) return fail("A palette can have at most " + MAX_COLOURS + " colours.");
    return { ok: true, colors: colors };
  }

  function fail(error) {
    return { ok: false, error: error };
  }

  function truncate(s) {
    s = String(s);
    return s.length > 12 ? s.slice(0, 12) + "..." : s;
  }

  function toCoolorsUrl(colors) {
    return "https://coolors.co/" + colors.map(function (c) { return c.slice(1); }).join("-");
  }

  // ------------------------------------------------------------ colour math

  function hexToRgb(hex) {
    var h = String(hex).replace(/^#/, "").toLowerCase();
    if (!HEX6.test(h)) throw new Error("bad hex " + hex);
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function rgbToHex(rgb) {
    return "#" + rgb.map(function (v) {
      var n = Math.max(0, Math.min(255, Math.round(v)));
      return (n < 16 ? "0" : "") + n.toString(16);
    }).join("");
  }

  function channel(c) {
    c = c / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function luminance(hex) {
    var rgb = hexToRgb(hex);
    return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
  }

  function contrast(a, b) {
    var la = luminance(a);
    var lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  function mix(a, b, t) {
    var x = hexToRgb(a);
    var y = hexToRgb(b);
    return rgbToHex([0, 1, 2].map(function (i) { return x[i] + (y[i] - x[i]) * t; }));
  }

  function chroma(hex) {
    var rgb = hexToRgb(hex);
    return (Math.max.apply(null, rgb) - Math.min.apply(null, rgb)) / 255;
  }

  function rgbToHsl(hex) {
    var rgb = hexToRgb(hex).map(function (v) { return v / 255; });
    var max = Math.max.apply(null, rgb);
    var min = Math.min.apply(null, rgb);
    var l = (max + min) / 2;
    var d = max - min;
    var h = 0;
    var s = 0;
    if (d > 0) {
      s = d / (1 - Math.abs(2 * l - 1));
      if (max === rgb[0]) h = ((rgb[1] - rgb[2]) / d) % 6;
      else if (max === rgb[1]) h = (rgb[2] - rgb[0]) / d + 2;
      else h = (rgb[0] - rgb[1]) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return { h: h, s: s, l: l };
  }

  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360;
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    var m = l - c / 2;
    var rgb;
    if (h < 60) rgb = [c, x, 0];
    else if (h < 120) rgb = [x, c, 0];
    else if (h < 180) rgb = [0, c, x];
    else if (h < 240) rgb = [0, x, c];
    else if (h < 300) rgb = [x, 0, c];
    else rgb = [c, 0, x];
    return rgbToHex(rgb.map(function (v) { return (v + m) * 255; }));
  }

  function hueDistance(a, b) {
    var d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  }

  function minContrast(fg, bgs) {
    return Math.min.apply(null, bgs.map(function (bg) { return contrast(fg, bg); }));
  }

  /**
   * Return fg unchanged if it reaches `min` against every colour in bgs,
   * otherwise the smallest mix towards black or white that does.
   */
  function ensureContrast(fg, bgs, min) {
    var goal = min + 0.05; // small margin so rounded ratios never show 4.49
    if (minContrast(fg, bgs) >= goal) return fg;
    var targets = ["#000000", "#ffffff"].sort(function (a, b) {
      return minContrast(b, bgs) - minContrast(a, bgs);
    });
    for (var i = 0; i < targets.length; i++) {
      var target = targets[i];
      if (minContrast(target, bgs) < goal) continue;
      var lo = 0;
      var hi = 1;
      for (var k = 0; k < 24; k++) {
        var mid = (lo + hi) / 2;
        if (minContrast(mix(fg, target, mid), bgs) >= goal) hi = mid;
        else lo = mid;
      }
      return mix(fg, target, hi);
    }
    return targets[0];
  }

  /** Pick the readable colour to put on top of a fill, preferring palette tones. */
  function readableOn(fill, preferred) {
    var best = null;
    for (var i = 0; i < preferred.length; i++) {
      var c = preferred[i];
      if (contrast(c, fill) >= 4.55 && (!best || contrast(c, fill) > contrast(best, fill))) best = c;
    }
    if (best) return best;
    if (contrast("#141414", fill) >= 4.55) return "#141414";
    return contrast("#000000", fill) >= contrast("#ffffff", fill) ? "#000000" : "#ffffff";
  }

  // --------------------------------------------------------- role derivation

  function describe(hex) {
    var hsl = rgbToHsl(hex);
    return { hex: hex, L: luminance(hex), chroma: chroma(hex), h: hsl.h, s: hsl.s, l: hsl.l };
  }

  /**
   * Derive role tokens from any palette.
   * Light mode when the palette has a light, calm colour (or is mostly light):
   *   lightest calm colour -> background, darkest -> text and nav.
   * Dark mode when the palette is mostly dark: darkest -> background.
   * Most saturated colours -> primary, secondary, accent (distinct hues first).
   */
  function deriveRoles(input) {
    var colors = (input && input.length >= MIN_COLOURS ? input : DEFAULT_PALETTE).map(function (c) {
      return c.toLowerCase();
    });
    var cols = colors.map(describe);
    var byL = cols.slice().sort(function (a, b) { return a.L - b.L; });
    var darkest = byL[0];
    var lightest = byL[byL.length - 1];
    var medianL = byL[Math.floor((byL.length - 1) / 2)].L;

    var calmLight = cols
      .filter(function (c) { return c.L >= 0.55 && c.chroma <= 0.3; })
      .sort(function (a, b) { return b.L - a.L; })[0];

    var mode;
    var background;
    var used = [];
    if (calmLight) {
      mode = "light";
      background = calmLight.hex;
      used.push(calmLight.hex);
    } else if (medianL >= 0.12 || lightest.L >= 0.75 && darkest.L > 0.2) {
      mode = "light";
      background = mix(lightest.hex, "#ffffff", 0.82);
    } else {
      mode = "dark";
      background = darkest.L > 0.04 ? mix(darkest.hex, "#000000", 0.35) : darkest.hex;
      used.push(darkest.hex);
    }

    var surface;
    var surface2;
    var text;
    var ink;
    var nav;
    if (mode === "light") {
      surface = mix(background, "#ffffff", 0.6);
      surface2 = mix(background, "#ffffff", 0.25);
      text = ensureContrast(darkest.hex, [background, surface, surface2], 7);
      ink = mix(text, "#000000", 0.6);
      nav = text;
    } else {
      var second = byL[1];
      if (second && second.L < 0.12 && contrast(second.hex, background) < 2) {
        surface = second.hex;
        used.push(second.hex);
      } else {
        surface = mix(background, "#ffffff", 0.08);
      }
      surface2 = mix(surface, "#ffffff", 0.05);
      var lightBase = lightest.L > 0.3 ? lightest.hex : "#ffffff";
      text = ensureContrast(mix(lightBase, "#ffffff", 0.78), [background, surface, surface2], 7);
      ink = ensureContrast(mix(text, background, 0.35), [background, surface], 3);
      nav = mix(background, "#000000", 0.4);
    }
    var border = ensureContrast(ink, [background, surface, surface2], 3);
    var navContrast = ensureContrast(mode === "light" ? background : text, [nav], 4.5);
    var muted = mutedTone(text, background, [background, surface, surface2]);

    // Accent candidates: everything not used as a neutral, most saturated first.
    var candidates = cols
      .filter(function (c) { return used.indexOf(c.hex) === -1; })
      .sort(function (a, b) { return b.chroma - a.chroma; });
    if (!candidates.length) candidates = cols.slice().sort(function (a, b) { return b.chroma - a.chroma; });

    var primary = candidates[0];
    var secondary = pickDistinct(candidates, [primary], 35) || synthesize(primary, 150, mode);
    var accent = pickDistinct(candidates, [primary, secondary], 25) || synthesize(primary, -60, mode);

    var ref = rgbToHsl(primary.hex);
    var success = harmonised(145, ref, mode, 0.55);
    var danger = harmonised(2, ref, mode, 0.72);
    var warning = harmonised(42, ref, mode, 0.9, mode === "light" ? 0.55 : 0.6);

    var preferredOnFill = [text, ink, background, surface];
    var roles = {
      mode: mode,
      background: background,
      surface: surface,
      surface2: surface2,
      text: text,
      muted: muted,
      ink: ink,
      border: border,
      nav: nav,
      navContrast: navContrast,
      focus: text,
      plate: mode === "light" ? surface : mix(text, background, 0.12)
    };
    [["primary", primary.hex], ["secondary", secondary.hex], ["accent", accent.hex],
      ["success", success], ["danger", danger], ["warning", warning]].forEach(function (pair) {
      var name = pair[0];
      var fill = pair[1];
      roles[name] = fill;
      roles[name + "Contrast"] = readableOn(fill, preferredOnFill);
      roles[name + "Text"] = ensureContrast(fill, [background, surface, surface2], 4.5);
    });
    roles.palette = colors.slice();
    return roles;
  }

  function mutedTone(text, background, bgs) {
    var lo = 0;
    var hi = 0.7;
    if (minContrast(text, bgs) < 4.6) return text;
    for (var k = 0; k < 20; k++) {
      var mid = (lo + hi) / 2;
      if (minContrast(mix(text, background, mid), bgs) >= 4.6) lo = mid;
      else hi = mid;
    }
    return mix(text, background, lo);
  }

  /** "Redmean" weighted RGB distance: cheap and close enough to perceived difference. */
  function distance(a, b) {
    var x = hexToRgb(a);
    var y = hexToRgb(b);
    var rm = (x[0] + y[0]) / 2;
    var dr = x[0] - y[0];
    var dg = x[1] - y[1];
    var db = x[2] - y[2];
    return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
  }

  /** The candidate that differs most from the colours already taken, or null if none differs enough. */
  function pickDistinct(candidates, taken, minHue) {
    var best = null;
    var bestScore = -1;
    candidates.forEach(function (c) {
      if (taken.some(function (t) { return t.hex === c.hex; })) return;
      var hueOk = taken.every(function (t) {
        return c.chroma < 0.08 || t.chroma < 0.08 || hueDistance(c.h, t.h) >= minHue;
      });
      var d = Math.min.apply(null, taken.map(function (t) { return distance(c.hex, t.hex); }));
      var score = d * (hueOk ? 1.5 : 1) * (c.chroma >= 0.08 ? 1 : 0.4);
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    });
    return best && bestScore >= 90 ? best : null;
  }

  function synthesize(base, rotate, mode) {
    var hsl = rgbToHsl(base.hex);
    var s = Math.max(hsl.s, 0.45);
    var l = mode === "light" ? Math.min(Math.max(hsl.l, 0.4), 0.6) : Math.min(Math.max(hsl.l, 0.5), 0.7);
    return describe(hslToHex(hsl.h + rotate, s, l));
  }

  /** A status colour that stays recognisable (fixed hue band) but borrows the palette's mood. */
  function harmonised(baseHue, ref, mode, sat, light) {
    var pull = 0;
    var d = hueDistance(baseHue, ref.h);
    if (ref.s > 0.15 && d > 0) {
      var dir = ((ref.h - baseHue + 540) % 360) - 180 > 0 ? 1 : -1;
      pull = dir * Math.min(10, d * 0.15);
    }
    var s = sat || Math.min(0.78, Math.max(0.5, ref.s));
    var l = light || (mode === "light" ? 0.42 : 0.6);
    return hslToHex(baseHue + pull, s, l);
  }

  // --------------------------------------------------------- contrast audit

  /** Every text/background pair the UI uses, with the WCAG minimum for each. */
  var CONTRAST_PAIRS = [
    ["text", "background", 4.5], ["text", "surface", 4.5], ["text", "surface2", 4.5],
    ["muted", "background", 4.5], ["muted", "surface", 4.5], ["muted", "surface2", 4.5],
    ["navContrast", "nav", 4.5],
    ["primaryContrast", "primary", 4.5], ["secondaryContrast", "secondary", 4.5],
    ["accentContrast", "accent", 4.5], ["successContrast", "success", 4.5],
    ["dangerContrast", "danger", 4.5], ["warningContrast", "warning", 4.5],
    ["primaryText", "background", 4.5], ["primaryText", "surface", 4.5],
    ["secondaryText", "surface", 4.5], ["accentText", "surface", 4.5],
    ["successText", "surface", 4.5], ["successText", "background", 4.5],
    ["dangerText", "surface", 4.5], ["dangerText", "background", 4.5],
    ["warningText", "surface", 4.5],
    ["border", "background", 3], ["border", "surface", 3], ["focus", "background", 3]
  ];

  function audit(roles) {
    return CONTRAST_PAIRS.map(function (p) {
      var ratio = contrast(roles[p[0]], roles[p[1]]);
      return { fg: p[0], bg: p[1], min: p[2], ratio: ratio, pass: ratio >= p[2] };
    });
  }

  // ------------------------------------------------------------- applying

  var ROLE_KEYS = ["background", "surface", "surface2", "text", "muted", "ink", "border", "nav", "navContrast",
    "focus", "plate", "primary", "primaryContrast", "primaryText", "secondary", "secondaryContrast",
    "secondaryText", "accent", "accentContrast", "accentText", "success", "successContrast", "successText",
    "danger", "dangerContrast", "dangerText", "warning", "warningContrast", "warningText"];

  function kebab(s) {
    return s.replace(/[A-Z]/g, function (m) { return "-" + m.toLowerCase(); });
  }

  function cssVars(roles) {
    var out = {};
    ROLE_KEYS.forEach(function (k) { out["--v-" + kebab(k)] = roles[k]; });
    roles.palette.forEach(function (c, i) { out["--v-palette-" + (i + 1)] = c; });
    return out;
  }

  function apply(roles, el) {
    var target = el || (root.document && root.document.documentElement);
    if (!target) return;
    var vars = cssVars(roles);
    for (var name in vars) {
      if (!/^#[0-9a-f]{6}$/.test(vars[name])) throw new Error("refusing non-hex value for " + name);
      target.style.setProperty(name, vars[name]);
    }
    target.setAttribute("data-palette-mode", roles.mode === "dark" ? "dark" : "light");
    var meta = root.document && root.document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", roles.nav);
  }

  // ------------------------------------------------------------- storage

  function storage() {
    try {
      return root.localStorage || null;
    } catch (e) {
      return null;
    }
  }

  function load() {
    var s = storage();
    if (!s) return null;
    try {
      var raw = s.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = parsePalette(JSON.parse(raw).join("-"));
      return parsed.ok ? parsed.colors : null;
    } catch (e) {
      return null;
    }
  }

  function save(colors) {
    var s = storage();
    if (!s) return;
    try {
      s.setItem(STORAGE_KEY, JSON.stringify(colors));
    } catch (e) { /* storage full or blocked: theme still applies for this visit */ }
  }

  function clear() {
    var s = storage();
    if (!s) return;
    try {
      s.removeItem(STORAGE_KEY);
    } catch (e) { /* ignore */ }
  }

  var current = { colors: DEFAULT_PALETTE.slice(), roles: null, source: "default", error: null };

  function use(colors, source) {
    current.colors = colors.slice();
    current.roles = deriveRoles(colors);
    current.source = source;
    apply(current.roles);
    if (root.dispatchEvent && typeof root.CustomEvent === "function") {
      root.dispatchEvent(new root.CustomEvent("valor:palette", { detail: current }));
    }
    return current;
  }

  /** Read ?colors= (saving it when valid), else the saved palette, else the default. */
  function init() {
    var fromQuery = null;
    current.error = null;
    try {
      var search = root.location && root.location.search;
      if (search) {
        var value = new root.URLSearchParams(search).get("colors");
        if (value !== null) {
          if (/^(default|reset)$/i.test(value.trim())) {
            clear();
          } else {
            var parsed = parsePalette(value);
            if (parsed.ok) fromQuery = parsed.colors;
            else current.error = "Ignored ?colors=: " + parsed.error;
          }
        }
      }
    } catch (e) { /* no location in this environment */ }
    if (fromQuery) {
      save(fromQuery);
      return use(fromQuery, "url");
    }
    var saved = load();
    if (saved) return use(saved, "saved");
    return use(DEFAULT_PALETTE, "default");
  }

  function setPalette(input) {
    var parsed = Array.isArray(input) ? parsePalette(input.join("-")) : parsePalette(input);
    if (!parsed.ok) return parsed;
    save(parsed.colors);
    use(parsed.colors, "custom");
    return { ok: true, colors: parsed.colors };
  }

  function reset() {
    clear();
    return use(DEFAULT_PALETTE, "default");
  }

  var api = {
    DEFAULT_PALETTE: DEFAULT_PALETTE.slice(),
    DEFAULT_COOLORS_URL: DEFAULT_COOLORS_URL,
    STORAGE_KEY: STORAGE_KEY,
    CONTRAST_PAIRS: CONTRAST_PAIRS,
    parsePalette: parsePalette,
    toCoolorsUrl: toCoolorsUrl,
    luminance: luminance,
    contrast: contrast,
    mix: mix,
    ensureContrast: ensureContrast,
    deriveRoles: deriveRoles,
    audit: audit,
    cssVars: cssVars,
    apply: apply,
    init: init,
    setPalette: setPalette,
    reset: reset,
    current: function () { return current; }
  };

  root.ValorPalette = api;
  if (typeof module === "object" && module && module.exports) module.exports = api;

  // Theme the page before first paint when running in a browser.
  if (root.document && root.document.documentElement) init();
})(typeof globalThis !== "undefined" ? globalThis : this);
