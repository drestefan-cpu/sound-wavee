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

/** Centered rows of rounded labels; returns the y below them */
function pills(
  ctx: CanvasRenderingContext2D,
  labels: string[],
  y: number,
  opts: { size?: number; tinted?: boolean; maxRows?: number } = {},
): number {
  const size = opts.size ?? 34;
  ctx.font = `500 ${size}px ${SANS}`;
  const padX = Math.round(size * 0.85);
  const h = Math.round(size * 2);
  const gap = 14;
  const maxW = W - 160;
  const rows: { label: string; w: number }[][] = [[]];
  let rowW = 0;
  for (const l of labels) {
    const w = Math.min(ctx.measureText(l).width + padX * 2, maxW);
    if (rowW + w > maxW && rows[rows.length - 1].length) {
      rows.push([]);
      rowW = 0;
    }
    rows[rows.length - 1].push({ label: l, w });
    rowW += w + gap;
  }
  const shown = rows.slice(0, opts.maxRows ?? 2);
  shown.forEach((row, ri) => {
    const total = row.reduce((sum, p) => sum + p.w, 0) + gap * (row.length - 1);
    let x = (W - total) / 2;
    const top = y + ri * (h + gap);
    for (const p of row) {
      ctx.beginPath();
      ctx.roundRect(x, top, p.w, h, h / 2);
      if (opts.tinted) {
        ctx.fillStyle = "rgba(255,45,120,0.16)";
        ctx.fill();
      } else {
        ctx.strokeStyle = "rgba(240,235,227,0.28)";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      ctx.fillStyle = opts.tinted ? C.pink : C.cream;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      let label = p.label;
      while (ctx.measureText(label).width > p.w - padX * 2 && label.length > 3) label = label.slice(0, -2);
      if (label !== p.label) label = label.trimEnd() + "…";
      ctx.fillText(label, x + p.w / 2, top + h / 2 + 2);
      x += p.w + gap;
    }
  });
  return y + shown.length * (h + gap) - gap;
}

function heading(ctx: CanvasRenderingContext2D, text: string, y: number) {
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = C.muted;
  ctx.font = `500 26px ${SANS}`;
  ctx.letterSpacing = "6px";
  ctx.fillText(text.toUpperCase(), W / 2 + 3, y);
  ctx.letterSpacing = "0px";
}

function clip(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t.trimEnd() + "…";
}

export interface MatchSong {
  title: string;
  artist: string;
  artUrl?: string | null;
}

/** Song rows: artwork, title, artist. Returns the y below them. */
async function songRows(ctx: CanvasRenderingContext2D, songs: MatchSong[], y: number): Promise<number> {
  const art = 104;
  const rowH = art + 22;
  const left = 140;
  const textX = left + art + 30;
  const maxText = W - 140 - textX;
  const images = await Promise.all(songs.map((s) => (s.artUrl ? loadImage(s.artUrl) : Promise.resolve(null))));
  songs.forEach((song, i) => {
    const top = y + i * rowH;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(left, top, art, art, 16);
    ctx.clip();
    const img = images[i];
    if (img) {
      ctx.drawImage(img, left, top, art, art);
    } else {
      ctx.fillStyle = C.card;
      ctx.fillRect(left, top, art, art);
      ctx.fillStyle = C.muted;
      ctx.font = `400 44px ${SANS}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("♪", left + art / 2, top + art / 2 + 2);
    }
    ctx.restore();
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = C.cream;
    ctx.font = `500 38px ${SANS}`;
    ctx.fillText(clip(ctx, song.title, maxText), textX, top + 46);
    ctx.fillStyle = C.muted;
    ctx.font = `400 32px ${SANS}`;
    ctx.fillText(clip(ctx, song.artist, maxText), textX, top + 90);
  });
  return y + songs.length * rowH - 22;
}

export async function makeTasteMatchImage(opts: {
  score: number;
  me: MatchPerson;
  them: MatchPerson;
  genres: string[];
  artists: string[];
  artistCount: number;
  songs: MatchSong[];
  songCount: number;
}): Promise<Blob> {
  try {
    await document.fonts.load(`400 40px "DM Sans"`);
    await document.fonts.load(`500 40px "DM Sans"`);
    await document.fonts.load(`900 40px "Unbounded"`);
  } catch {}

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("couldn't make the picture");

  const ringY = 700;
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  stars(ctx);
  const glow = ctx.createRadialGradient(W / 2, ringY, 30, W / 2, ringY, 460);
  glow.addColorStop(0, "rgba(255,45,120,0.22)");
  glow.addColorStop(1, "rgba(255,45,120,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // PLAI logo
  ctx.textBaseline = "alphabetic";
  ctx.font = `900 84px ${DISPLAY}`;
  const pl = ctx.measureText("PL").width;
  const ai = ctx.measureText("AI").width;
  const logoX = (W - pl - ai) / 2;
  ctx.textAlign = "left";
  ctx.fillStyle = C.cream;
  ctx.fillText("PL", logoX, 190);
  ctx.save();
  ctx.shadowColor = "rgba(255,45,120,0.7)";
  ctx.shadowBlur = 32;
  ctx.fillStyle = C.pink;
  ctx.fillText("AI", logoX + pl, 190);
  ctx.restore();

  ctx.textAlign = "center";
  ctx.fillStyle = C.pink;
  ctx.font = `500 28px ${SANS}`;
  ctx.letterSpacing = "9px";
  ctx.fillText("TASTE MATCH", W / 2 + 4, 262);
  ctx.letterSpacing = "0px";

  await avatar(ctx, opts.me, W / 2 - 78, 395, 92);
  await avatar(ctx, opts.them, W / 2 + 78, 395, 92);

  // ring + number
  const r = 175;
  ctx.lineCap = "round";
  ctx.lineWidth = 26;
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
  ctx.textBaseline = "middle";
  ctx.font = `500 140px ${SANS}`;
  const num = String(opts.score);
  const numW = ctx.measureText(num).width;
  ctx.font = `500 56px ${SANS}`;
  const pctW = ctx.measureText("%").width;
  const startX = W / 2 - (numW + pctW + 6) / 2;
  ctx.textAlign = "left";
  ctx.fillStyle = C.cream;
  ctx.font = `500 140px ${SANS}`;
  ctx.fillText(num, startX, ringY + 4);
  ctx.fillStyle = C.muted;
  ctx.font = `500 56px ${SANS}`;
  ctx.fillText("%", startX + numW + 6, ringY + 30);

  // names
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = C.cream;
  const names = `@${opts.me.username} & @${opts.them.username}`;
  fitText(ctx, names, 500, 46, W - 140);
  ctx.fillText(names, W / 2, 966);

  // details, top to bottom, stopping before the footer
  let y = 1010;
  const bottom = 1800;
  if (opts.genres.length) {
    y = pills(ctx, opts.genres.slice(0, 4), y, { size: 28, tinted: true, maxRows: 1 }) + 70;
  } else {
    y += 30;
  }
  if (opts.artists.length && y < bottom - 200) {
    heading(ctx, `${opts.artistCount} ${opts.artistCount === 1 ? "artist" : "artists"} in common`, y);
    y = pills(ctx, opts.artists.slice(0, 6), y + 30, { size: 32, maxRows: 2 }) + 76;
  }
  if (opts.songs.length && y < bottom - 160) {
    heading(ctx, `${opts.songCount} ${opts.songCount === 1 ? "song" : "songs"} you both love`, y);
    const room = Math.max(1, Math.floor((bottom - (y + 34)) / 126));
    y = await songRows(ctx, opts.songs.slice(0, Math.min(3, room)), y + 34);
  }

  // footer, small
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = C.muted;
  ctx.font = `400 26px ${SANS}`;
  ctx.fillText("plai.delaneyprojects.xyz", W / 2, 1868);

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("couldn't make the picture"))), "image/png"),
  );
}
