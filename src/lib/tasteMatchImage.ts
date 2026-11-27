/**
 * Shareable taste-match picture (1080×1920, story-sized): both profile photos, the match ring,
 * artists in common and PLAI's address. Drawn on a canvas in PLAI's night colours.
 */

const C = {
  bg: "#080B12",
  card: "#121A28",
  ring: "#1C2638",
  cream: "#F0EBE3",
  pink: "#FF2D78",
  muted: "#6F8BAB",
};
const W = 1080;
const H = 1920;
const SANS = '"DM Sans", system-ui, sans-serif';
const DISPLAY = '"Unbounded", "DM Sans", sans-serif';

export interface MatchPerson {
  username: string;
  avatarUrl?: string | null;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = setTimeout(() => resolve(null), 5000);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });
}

/** Stars: fixed pattern so every image looks the same */
function stars(ctx: CanvasRenderingContext2D) {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 140; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const r = rand() * 2.2 + 0.4;
    ctx.globalAlpha = 0.15 + rand() * 0.45;
    ctx.fillStyle = C.cream;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

async function avatar(ctx: CanvasRenderingContext2D, person: MatchPerson, cx: number, cy: number, r: number) {
  // ring of background colour so overlapping photos read as two
  ctx.fillStyle = C.bg;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 10, 0, Math.PI * 2);
  ctx.fill();

  const img = person.avatarUrl ? await loadImage(person.avatarUrl) : null;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  if (img) {
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, cx - r, cy - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = C.card;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = C.pink;
    ctx.font = `500 ${Math.round(r * 0.9)}px ${SANS}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((person.username[0] || "?").toUpperCase(), cx, cy + r * 0.04);
  }
  ctx.restore();
}

/** Shrinks text until it fits the width */
function fitText(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, maxWidth: number) {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px ${SANS}`;
    s -= 2;
  } while (ctx.measureText(text).width > maxWidth && s > 20);
}

function pills(ctx: CanvasRenderingContext2D, labels: string[], y: number) {
  ctx.font = `500 38px ${SANS}`;
  const padX = 34;
  const h = 78;
  const gap = 18;
  const widths = labels.map((l) => Math.min(ctx.measureText(l).width + padX * 2, W - 160));
  // lay out in rows that fit
  const rows: { label: string; w: number }[][] = [[]];
  let rowW = 0;
  labels.forEach((l, i) => {
    const w = widths[i];
    if (rowW + w > W - 160 && rows[rows.length - 1].length) {
      rows.push([]);
      rowW = 0;
    }
    rows[rows.length - 1].push({ label: l, w });
    rowW += w + gap;
  });
  rows.slice(0, 2).forEach((row, ri) => {
    const total = row.reduce((s, p) => s + p.w, 0) + gap * (row.length - 1);
    let x = (W - total) / 2;
    const top = y + ri * (h + gap);
    for (const p of row) {
      ctx.strokeStyle = "rgba(240,235,227,0.28)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(x, top, p.w, h, h / 2);
      ctx.stroke();
      ctx.fillStyle = C.cream;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      let label = p.label;
      while (ctx.measureText(label).width > p.w - padX * 2 && label.length > 3) label = label.slice(0, -2);
      if (label !== p.label) label = label.trimEnd() + "…";
      ctx.fillText(label, x + p.w / 2, top + h / 2 + 2);
      x += p.w + gap;
    }
  });
}

export async function makeTasteMatchImage(opts: {
  score: number;
  me: MatchPerson;
  them: MatchPerson;
  artists: string[];
}): Promise<Blob> {
  try {
    await document.fonts.load(`500 40px "DM Sans"`);
    await document.fonts.load(`900 40px "Unbounded"`);
  } catch {}

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("couldn't make the picture");

  // background, stars, pink glow behind the ring
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  stars(ctx);
  const ringY = 1010;
  const glow = ctx.createRadialGradient(W / 2, ringY, 40, W / 2, ringY, 560);
  glow.addColorStop(0, "rgba(255,45,120,0.22)");
  glow.addColorStop(1, "rgba(255,45,120,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // PLAI logo
  ctx.textBaseline = "alphabetic";
  ctx.font = `900 120px ${DISPLAY}`;
  const pl = ctx.measureText("PL").width;
  const ai = ctx.measureText("AI").width;
  const logoX = (W - pl - ai) / 2;
  ctx.textAlign = "left";
  ctx.fillStyle = C.cream;
  ctx.fillText("PL", logoX, 290);
  ctx.save();
  ctx.shadowColor = "rgba(255,45,120,0.7)";
  ctx.shadowBlur = 40;
  ctx.fillStyle = C.pink;
  ctx.fillText("AI", logoX + pl, 290);
  ctx.restore();

  // label
  ctx.textAlign = "center";
  ctx.fillStyle = C.pink;
  ctx.font = `500 34px ${SANS}`;
  ctx.letterSpacing = "10px";
  ctx.fillText("TASTE MATCH", W / 2 + 5, 400);
  ctx.letterSpacing = "0px";

  // photos, overlapping
  await avatar(ctx, opts.me, W / 2 - 92, 560, 112);
  await avatar(ctx, opts.them, W / 2 + 92, 560, 112);

  // ring
  const r = 250;
  ctx.lineCap = "round";
  ctx.lineWidth = 34;
  ctx.strokeStyle = C.ring;
  ctx.beginPath();
  ctx.arc(W / 2, ringY, r, 0, Math.PI * 2);
  ctx.stroke();
  if (opts.score > 0) {
    ctx.strokeStyle = C.pink;
    ctx.beginPath();
    ctx.arc(W / 2, ringY, r, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * Math.min(opts.score, 100)) / 100);
    ctx.stroke();
  }

  // the number
  ctx.fillStyle = C.cream;
  ctx.textBaseline = "middle";
  ctx.font = `500 200px ${SANS}`;
  const num = String(opts.score);
  const numW = ctx.measureText(num).width;
  ctx.font = `500 80px ${SANS}`;
  const pctW = ctx.measureText("%").width;
  const startX = W / 2 - (numW + pctW + 8) / 2;
  ctx.textAlign = "left";
  ctx.font = `500 200px ${SANS}`;
  ctx.fillText(num, startX, ringY + 6);
  ctx.fillStyle = C.muted;
  ctx.font = `500 80px ${SANS}`;
  ctx.fillText("%", startX + numW + 8, ringY + 40);

  // names
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = C.cream;
  const names = `@${opts.me.username} & @${opts.them.username}`;
  fitText(ctx, names, 500, 54, W - 140);
  ctx.fillText(names, W / 2, 1380);

  // artists in common
  if (opts.artists.length) {
    ctx.fillStyle = C.muted;
    ctx.font = `400 34px ${SANS}`;
    ctx.fillText("both into", W / 2, 1470);
    pills(ctx, opts.artists.slice(0, 4), 1505);
  }

  // footer
  ctx.fillStyle = C.muted;
  ctx.font = `400 36px ${SANS}`;
  ctx.fillText("find your match on", W / 2, 1772);
  ctx.fillStyle = C.cream;
  ctx.font = `500 40px ${SANS}`;
  ctx.fillText("plai.delaneyprojects.xyz", W / 2, 1830);

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("couldn't make the picture"))), "image/png"),
  );
}
