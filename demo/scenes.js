// Canvas drawing: placeholder "photos" for seeded proofs, the proof stamp and
// the share and shame cards. Everything is drawn locally; nothing is uploaded.

const INK = "#1d1b22";
const cache = new Map();
let mascotImg = null;

export function loadMascot() {
  if (mascotImg) return Promise.resolve(mascotImg);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      mascotImg = img;
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = "assets/valor-pigeon-512.png";
  });
}

function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function shape(ctx, fill, draw, lw = 10) {
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = lw;
  ctx.strokeStyle = INK;
  ctx.fillStyle = fill;
  draw();
  if (fill) ctx.fill();
  ctx.stroke();
  ctx.restore();
}

const SCENE_BG = {
  gym: ["#cfd8dc", "#b0bec5"], gym2: ["#ffe0b2", "#ffcc80"], gym3: ["#d1c4e9", "#b39ddb"],
  steps: ["#c8e6c9", "#a5d6a7"], steps2: ["#b3e5fc", "#81d4fa"], scroll: ["#283593", "#1a237e"],
  scroll2: ["#311b92", "#4527a0"], read: ["#ffecb3", "#ffe082"], cook: ["#ffccbc", "#ffab91"],
  couch: ["#f8bbd0", "#f48fb1"], custom: ["#e1f5fe", "#b3e5fc"]
};

function drawSceneArt(ctx, w, h, scene, rand) {
  const [bg, floor] = SCENE_BG[scene] || SCENE_BG.custom;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = floor;
  ctx.fillRect(0, h * 0.68, w, h * 0.32);
  // a few soft dots so photos are not identical
  for (let i = 0; i < 14; i++) {
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(rand() * w, rand() * h * 0.6, 6 + rand() * 18, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const cx = w / 2;
  const cy = h * 0.55;
  const tilt = (rand() - 0.5) * 0.25;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);
  if (scene.startsWith("gym")) {
    const c = scene === "gym2" ? "#e53935" : scene === "gym3" ? "#43a047" : "#546e7a";
    shape(ctx, "#90a4ae", () => rr(ctx, -150, -14, 300, 28, 12));
    for (const s of [-1, 1]) {
      shape(ctx, c, () => rr(ctx, s * 150 - 30, -80, 60, 160, 18));
      shape(ctx, c, () => rr(ctx, s * 205 - 22, -60, 44, 120, 14));
    }
  } else if (scene.startsWith("steps")) {
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.translate(-150 + i * 100, (i % 2 ? -40 : 40));
      ctx.rotate(-0.4);
      shape(ctx, scene === "steps2" ? "#ff7043" : "#5c6bc0", () => {
        ctx.beginPath();
        ctx.ellipse(0, 0, 34, 58, 0, 0, Math.PI * 2);
      });
      ctx.restore();
    }
    ctx.font = "800 64px Fredoka, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = INK;
    ctx.fillText(`${(10 + Math.floor(rand() * 4))},${String(Math.floor(rand() * 999)).padStart(3, "0")}`, 0, -170);
  } else if (scene.startsWith("scroll")) {
    ctx.fillStyle = "#fff59d";
    ctx.beginPath();
    ctx.arc(170, -230, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = SCENE_BG[scene][0];
    ctx.beginPath();
    ctx.arc(195, -245, 46, 0, Math.PI * 2);
    ctx.fill();
    shape(ctx, "#eceff1", () => rr(ctx, -80, -150, 160, 290, 26));
    shape(ctx, "#37474f", () => rr(ctx, -58, -120, 116, 220, 10), 6);
    ctx.strokeStyle = "#ef5350";
    ctx.lineWidth = 22;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-120, -170);
    ctx.lineTo(120, 170);
    ctx.stroke();
  } else if (scene === "read") {
    shape(ctx, "#fffde7", () => {
      ctx.beginPath();
      ctx.moveTo(0, -90);
      ctx.quadraticCurveTo(-110, -130, -220, -100);
      ctx.lineTo(-220, 110);
      ctx.quadraticCurveTo(-110, 80, 0, 120);
      ctx.quadraticCurveTo(110, 80, 220, 110);
      ctx.lineTo(220, -100);
      ctx.quadraticCurveTo(110, -130, 0, -90);
      ctx.closePath();
    });
    ctx.strokeStyle = INK;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, -90);
    ctx.lineTo(0, 120);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 6; i++) {
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * 30, -60 + i * 28);
        ctx.lineTo(s * (180 - rand() * 40), -60 + i * 28);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  } else if (scene === "cook") {
    shape(ctx, "#455a64", () => rr(ctx, 120, -18, 170, 36, 14));
    shape(ctx, "#37474f", () => {
      ctx.beginPath();
      ctx.arc(0, 0, 140, 0, Math.PI * 2);
    });
    shape(ctx, "#ffffff", () => {
      ctx.beginPath();
      ctx.ellipse(-10, 0, 90, 72, 0.3, 0, Math.PI * 2);
    }, 8);
    shape(ctx, "#ffb300", () => {
      ctx.beginPath();
      ctx.arc(-6, 2, 34, 0, Math.PI * 2);
    }, 8);
  } else if (scene === "couch") {
    shape(ctx, "#8d6e63", () => rr(ctx, -220, -60, 440, 150, 40));
    shape(ctx, "#a1887f", () => rr(ctx, -200, -130, 400, 100, 34));
    shape(ctx, "#ffcc80", () => rr(ctx, -40, -40, 120, 60, 20), 8);
  } else {
    shape(ctx, "#ffd54f", () => {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 70 : 160;
        const a = (Math.PI * 2 * i) / 10 - Math.PI / 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
    });
  }
  ctx.restore();
}

/** A data URL for a generated placeholder photo ("gen:<scene>:<seed>"). */
export function generatedPhoto(key, w = 600, h = 750) {
  if (cache.has(key)) return cache.get(key);
  const [, scene = "custom", seed = "0"] = key.split(":");
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  drawSceneArt(ctx, w, h, scene, seeded(key + seed));
  const url = canvas.toDataURL("image/jpeg", 0.82);
  cache.set(key, url);
  return url;
}

export function imageSrc(ref) {
  if (!ref) return "";
  if (ref === "mascot") return "assets/valor-pigeon-512.png";
  if (ref.startsWith("gen:")) return generatedPhoto(ref);
  if (ref.startsWith("data:image/")) return ref;
  return "";
}

export function sceneForTemplate(template) {
  return { gym: "gym", steps: "steps", scroll: "scroll", read: "read", cook: "cook" }[template] || "custom";
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawCover(ctx, img, w, h) {
  const iw = img.videoWidth || img.naturalWidth || img.width;
  const ih = img.videoHeight || img.naturalHeight || img.height;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function wrap(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function fitLines(ctx, text, maxWidth, maxLines) {
  let lines = wrap(ctx, text, maxWidth);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    let last = lines[maxLines - 1];
    while (ctx.measureText(last + "...").width > maxWidth && last.length) last = last.slice(0, -1);
    lines[maxLines - 1] = last.trimEnd() + "...";
  }
  return lines;
}

export function formatStamp(t) {
  const d = new Date(t);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}, ${hh}:${mm}`;
}

/**
 * Stamp a captured frame (video, image or canvas) with the time and the oath,
 * so an old photo cannot be passed off as new. Returns a JPEG data URL.
 */
function drawStamp(ctx, w, h, { title, at, checkin, of }) {
  const band = Math.round(h / 6);
  const k = w / 720;
  ctx.fillStyle = "rgba(20, 18, 26, 0.86)";
  ctx.fillRect(0, h - band, w, band);
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${Math.round(40 * k)}px Fredoka, sans-serif`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  const lines = fitLines(ctx, title, w - 200 * k, 1);
  ctx.fillText(lines[0], 32 * k, h - band + 62 * k);
  ctx.font = `600 ${Math.round(30 * k)}px Nunito, sans-serif`;
  ctx.fillStyle = "#ffe8a3";
  ctx.fillText(`Check-in ${checkin} of ${of}  |  ${formatStamp(at)}`, 32 * k, h - band + 110 * k);

  // wax seal
  ctx.save();
  ctx.translate(w - 92 * k, h - band - 10 * k);
  ctx.scale(k, k);
  ctx.rotate(-0.18);
  ctx.fillStyle = "#c62828";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.beginPath();
  for (let i = 0; i < 24; i++) {
    const r = i % 2 ? 66 : 72;
    const a = (Math.PI * 2 * i) / 24;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "#ffcdd2";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 50, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.font = "700 24px Fredoka, sans-serif";
  ctx.fillText("SWORN", 0, -4);
  ctx.font = "700 20px Fredoka, sans-serif";
  ctx.fillText("PROOF", 0, 22);
  ctx.restore();
}

/**
 * Stamp a captured frame (video, image or canvas) with the time and the oath,
 * so an old photo cannot be passed off as new. Returns a JPEG data URL.
 */
export async function stampPhoto(source, meta) {
  await document.fonts.ready;
  const w = 720;
  const h = 900;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  drawCover(ctx, source, w, h);
  if (meta.mode !== "reply") drawStamp(ctx, w, h, meta);
  return canvas.toDataURL("image/jpeg", 0.8);
}

/** Seeded and simulated proofs get the same stamp as real ones, drawn on the fly. */
export function stampedGenerated(key, meta) {
  const id = `${key}|${meta.title}|${meta.at}|${meta.checkin}|${meta.of}`;
  if (cache.has(id)) return cache.get(id);
  const [, scene = "custom", seed = "0"] = key.split(":");
  const w = 600;
  const h = 750;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  drawSceneArt(ctx, w, h, scene, seeded(key + seed));
  drawStamp(ctx, w, h, meta);
  const url = canvas.toDataURL("image/jpeg", 0.82);
  cache.set(id, url);
  return url;
}

export async function placeholderSource(scene) {
  return loadImage(generatedPhoto(`gen:${scene}:${Date.now()}`));
}

export async function fileToImage(file) {
  const url = URL.createObjectURL(file);
  try {
    return await loadImage(url);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

/**
 * Render a share card (kept) or shame card (broken) on a canvas, using the
 * active palette's role colours. Returns the canvas.
 */
export async function renderCard({ kept, name, title, groupName, reward, burned, honor, rank, streak, iou, checkins }, roles) {
  await document.fonts.ready;
  const img = await loadMascot();
  const w = 1080;
  const h = 1350;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  const ink = roles.mode === "dark" ? "#0a0a0f" : roles.ink;
  const paper = kept ? roles.background : roles.surface2;
  const headFill = kept ? roles.primary : roles.danger;
  const headText = kept ? roles.primaryContrast : roles.dangerContrast;

  ctx.fillStyle = roles.nav;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = paper;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 14;
  rr(ctx, 48, 48, w - 96, h - 96, 56);
  ctx.fill();
  ctx.stroke();

  // banner
  ctx.save();
  ctx.translate(w / 2, 200);
  ctx.rotate(kept ? -0.025 : 0.03);
  ctx.fillStyle = headFill;
  ctx.lineWidth = 12;
  rr(ctx, -400, -82, 800, 164, 40);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = headText;
  ctx.font = "700 112px Fredoka, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(kept ? "OATH KEPT" : "OATH BROKEN", 0, 6);
  ctx.restore();

  // mascot on a plate
  ctx.fillStyle = roles.plate;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(w / 2, 560, 215, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (img) {
    ctx.save();
    ctx.translate(w / 2, 560);
    ctx.rotate(kept ? -0.06 : 0.35);
    const s = kept ? 420 : 380;
    ctx.drawImage(img, -s / 2, -s / 2 + (kept ? -10 : 20), s, s);
    ctx.restore();
  }
  if (!kept) {
    // little rain cloud above the sad pigeon
    ctx.fillStyle = roles.muted;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(w / 2 + 150, 360, 42, Math.PI * 0.9, Math.PI * 2.1);
    ctx.arc(w / 2 + 215, 350, 52, Math.PI, Math.PI * 2.05);
    ctx.arc(w / 2 + 275, 372, 36, Math.PI * 1.1, Math.PI * 2.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = roles.text;
  ctx.font = "700 54px Fredoka, sans-serif";
  ctx.fillText(kept ? `${name} kept their word` : `${name} swore an oath and...`, w / 2, 860);
  ctx.font = "700 64px Fredoka, sans-serif";
  ctx.fillStyle = kept ? roles.primaryText : roles.dangerText;
  const lines = fitLines(ctx, `"${title}"`, w - 220, 2);
  lines.forEach((l, i) => ctx.fillText(l, w / 2, 945 + i * 72));
  if (!kept) {
    ctx.font = "800 44px Nunito, sans-serif";
    ctx.fillStyle = roles.text;
    ctx.fillText("did not.", w / 2, 945 + lines.length * 72 + 4);
  }

  // stat chips
  const chips = kept
    ? [`+${reward} valor`, `Honor ${honor ?? "-"}%`, `${rank}`]
    : [`-${burned} valor burned`, `Honor ${honor ?? "-"}%`];
  ctx.font = "800 38px Nunito, sans-serif";
  const pad = 34;
  const widths = chips.map((t) => ctx.measureText(t).width + pad * 2);
  const gap = 22;
  let x = (w - widths.reduce((a, b) => a + b, 0) - gap * (chips.length - 1)) / 2;
  const y = kept ? 1100 : 1125;
  chips.forEach((t, i) => {
    ctx.fillStyle = i === 0 ? (kept ? roles.success : roles.danger) : roles.accent;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 7;
    rr(ctx, x, y - 44, widths[i], 76, 38);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = i === 0 ? (kept ? roles.successContrast : roles.dangerContrast) : roles.accentContrast;
    ctx.fillText(t, x + widths[i] / 2, y + 7);
    x += widths[i] + gap;
  });

  ctx.font = "700 34px Nunito, sans-serif";
  ctx.fillStyle = roles.muted;
  let foot = kept
    ? `${checkins} check-ins witnessed by ${groupName}${streak > 1 ? `  |  streak ${streak}` : ""}`
    : iou ? `IOU due: ${iou.toLowerCase()}. Pay up.` : `Witnessed by ${groupName}. The pigeon is disappointed.`;
  fitLines(ctx, foot, w - 220, 2).forEach((l, i) => ctx.fillText(l, w / 2, 1205 + i * 44));
  ctx.font = "700 30px Fredoka, sans-serif";
  ctx.fillStyle = roles.navContrast;
  ctx.fillText("VALOR  |  swear it, prove it", w / 2, h - 12);
  return c;
}

// Hand a generated file to the viewer. A published Claude artifact runs in a
// sandbox where a plain download link does nothing, so there the platform's
// own save prompt is used; everywhere else it is an ordinary download.
export async function saveBlob(blob, filename) {
  if (window.claude && typeof window.claude.use === "function") {
    try {
      const downloads = await window.claude.use("downloads");
      if (!downloads) return "unavailable";
      await downloads.save({ filename, data: blob });
      return "saved";
    } catch (e) {
      return e && e.code === "declined" ? "cancelled" : "unavailable";
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return "saved";
}

export async function shareCanvas(canvas, filename, text) {
  const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return "shared";
    } catch (e) {
      if (e && e.name === "AbortError") return "cancelled";
    }
  }
  const how = await saveBlob(blob, filename);
  return how === "saved" ? "downloaded" : how;
}
