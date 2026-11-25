/**
 * Renders every SVG in assets/ from data/stats.json and the portfolio tokens.
 * No dependencies: run with `node scripts/build.ts` (Node 22.18+).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { TOKENS, PROFILE, STACK, type ThemeName, type Tokens } from "./tokens.ts";

interface Stats {
  updated: string | null;
  commits: number | null;
  prs: number | null;
  issues: number | null;
  repos: number | null;
  stars: number | null;
  followers: number | null;
  total: number | null;
  streak: { current: number | null; longest: number | null };
  langs: { name: string; pct: number }[];
  days: { date: string; count: number }[];
}

const out = new URL("../assets/", import.meta.url);
mkdirSync(out, { recursive: true });
const stats: Stats = JSON.parse(readFileSync(new URL("../data/stats.json", import.meta.url), "utf8"));


const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const num = (n: number | null) => (n === null || n === undefined ? "—" : n.toLocaleString("en-US"));


/* ---------- Text as outlines (fonts: Google Fonts, SIL OFL) ----------
 * Letters are drawn as vector paths, so they look the same in every browser and app.
 *   serif / serifBold  Abhaya Libre   English + numbers     (Sinhala line is pre-shaped, fonts/sinhala.json)
 *   brush              Ma Shan Zheng  Chinese characters
 *   mono               Tomorrow       small labels, tags, percentages
 *   display            Jura           tagline
 * Glyph data is exported once by tools/export-glyphs.py, so the daily workflow needs no font tooling. */
type FontKey = "serif" | "serifBold" | "brush" | "mono" | "monoReg" | "monoBold" | "display" | "displayBold";
interface Glyph { d: string; adv: number }
interface FontData { upm: number; asc: number; glyphs: Record<string, Glyph> }
const FONTS: Record<FontKey, FontData> = JSON.parse(readFileSync(new URL("../fonts/glyphs.json", import.meta.url), "utf8"));
const SINHALA: { d: string; width: number; baseline: number; size: number } = JSON.parse(
  readFileSync(new URL("../fonts/sinhala.json", import.meta.url), "utf8"),
);
const r2 = (n: number) => +n.toFixed(2);

/** Re-maps an absolute SVG path (M L H V Q C Z) from font units (y up) to pixels (y down). */
function place(d: string, sc: number, ox: number, oy: number): string {
  return d.replace(/([MLHVQCZ])([^MLHVQCZ]*)/g, (_m, cmd: string, args: string) => {
    const n = args.trim() ? args.trim().split(/[\s,]+/).map(Number) : [];
    if (cmd === "H") return `H${r2(ox + n[0] * sc)}`;
    if (cmd === "V") return `V${r2(oy - n[0] * sc)}`;
    return cmd + n.map((v, i) => r2(i % 2 === 0 ? ox + v * sc : oy - v * sc)).join(" ");
  });
}

function measure(font: FontKey, text: string, size: number, ls = 0): number {
  const f = FONTS[font];
  let w = 0;
  for (const ch of text) w += (f.glyphs[ch]?.adv ?? f.glyphs[" "]?.adv ?? f.upm / 3) * (size / f.upm) + ls;
  return w - (text.length ? ls : 0);
}

interface TextOpts { anchor?: "start" | "middle" | "end"; ls?: number; fill: string; opacity?: number; cls?: string; style?: string }

/** Draws text as one filled path. Missing glyphs are skipped with a warning. */
function type(font: FontKey, text: string, x: number, y: number, size: number, o: TextOpts): string {
  const f = FONTS[font];
  const sc = size / f.upm;
  const ls = o.ls ?? 0;
  const w = measure(font, text, size, ls);
  let cx = o.anchor === "middle" ? x - w / 2 : o.anchor === "end" ? x - w : x;
  const parts: string[] = [];
  for (const ch of text) {
    const g = f.glyphs[ch];
    if (!g) { if (ch.trim()) console.warn(`no glyph for "${ch}" in ${font}`); cx += (f.glyphs[" "]?.adv ?? 0) * sc + ls; continue; }
    if (g.d) parts.push(place(g.d, sc, cx, y));
    cx += g.adv * sc + ls;
  }
  const attrs = `fill="${o.fill}"${o.opacity !== undefined ? ` fill-opacity="${o.opacity}"` : ""}`;
  const path = `<path ${attrs} d="${parts.join("")}"/>`;
  return o.cls || o.style ? `<g${o.cls ? ` class="${o.cls}"` : ""}${o.style ? ` style="${o.style}"` : ""}>${path}</g>` : path;
}

/** The pre-shaped Sinhala line, scaled to `size` px and placed on baseline y. */
function sinhala(x: number, y: number, size: number, o: { fill: string; opacity?: number }): string {
  const k = size / SINHALA.size;
  const d = SINHALA.d.replace(/(-?[\d.]+) (-?[\d.]+)/g, (_m, a: string, b: string) => `${r2(x + +a * k)} ${r2(y + (+b - SINHALA.baseline) * k)}`);
  return `<path fill="${o.fill}"${o.opacity !== undefined ? ` fill-opacity="${o.opacity}"` : ""} d="${d}"/>`;
}
const sinhalaWidth = (size: number) => (SINHALA.width * size) / SINHALA.size;

/** A small north-east arrow (none of the fonts has one). */
function arrow(x: number, y: number, s: number, color: string): string {
  return `<path d="M${x} ${y + s}L${x + s} ${y}M${x + s * 0.12} ${y}H${x + s}V${y + s * 0.88}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** Paper, grain, mount edge and rollers shared by every card. */
function frame(w: number, h: number, t: Tokens, id: string, body: string, css = ""): string {
  const [b1, b2, b3] = t.brass;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">
<style>
  ${css}
  @media (prefers-reduced-motion: reduce){*{animation:none!important;opacity:1!important;transform:none!important;stroke-dashoffset:0!important}}
</style>
<defs>
  <filter id="${id}g" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.11 0"/></filter>
  <linearGradient id="${id}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a2f1c"/><stop offset=".55" stop-color="#1c110a"/><stop offset="1" stop-color="#3a2416"/></linearGradient>
  <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${b1}"/><stop offset=".6" stop-color="${b2}"/><stop offset="1" stop-color="${b3}"/></linearGradient>
  <clipPath id="${id}c"><rect x="0" y="0" width="${w}" height="${h}" rx="10"/></clipPath>
</defs>
<rect width="${w}" height="${h}" rx="10" fill="${t.mount}"/>
<g clip-path="url(#${id}c)">
  <rect x="0" y="9" width="${w}" height="${h - 18}" fill="${t.paper}"/>
  <rect x="0" y="9" width="${w}" height="${h - 18}" filter="url(#${id}g)"/>
  ${body}
</g>
<rect x="14" y="2" width="${w - 28}" height="8" rx="4" fill="url(#${id}r)"/>
<rect x="9" y="0" width="8" height="12" rx="3" fill="url(#${id}b)"/><rect x="${w - 17}" y="0" width="8" height="12" rx="3" fill="url(#${id}b)"/>
<rect x="14" y="${h - 10}" width="${w - 28}" height="8" rx="4" fill="url(#${id}r)"/>
<rect x="9" y="${h - 12}" width="8" height="12" rx="3" fill="url(#${id}b)"/><rect x="${w - 17}" y="${h - 12}" width="8" height="12" rx="3" fill="url(#${id}b)"/>
</svg>
`;
}

/** The red name seal. */
function seal(x: number, y: number, size: number, ch: string, t: Tokens): string {
  return `<g transform="translate(${x} ${y})"><rect width="${size}" height="${size}" rx="${size * 0.12}" fill="${t.accent}"/><rect x="3" y="3" width="${size - 6}" height="${size - 6}" rx="${size * 0.08}" fill="none" stroke="${t.paper}" stroke-opacity=".55" stroke-width="1.2"/>${type("brush", ch, size / 2, size * 0.74, size * 0.62, { anchor: "middle", fill: t.paper })}</g>`;
}

/** Brush-painted 帕森度, supplied by the owner (art/). Black ink on transparent; tinted per theme below. */
const ART = ["pa", "sen", "do"].map(
  (n) => `data:image/webp;base64,${readFileSync(new URL(`../art/${n}.webp`, import.meta.url)).toString("base64")}`,
);
const rgb = (hex: string) => [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(3));

/** Pasindu Hasanga · පසිඳු හසංග · 帕森度, each script in its own font, laid out left to right. */
function subtitle(t: Tokens): string {
  const size = 21;
  const dot = (x: number) => type("serif", "·", x, 157, size, { fill: t.text, opacity: t.muted });
  let x = 142;
  const parts: string[] = [];
  parts.push(type("serif", PROFILE.fullName, x, 157, size, { fill: t.text, opacity: t.muted, ls: 1 }));
  x += measure("serif", PROFILE.fullName, size, 1) + 14;
  parts.push(dot(x)); x += measure("serif", "·", size) + 14;
  parts.push(sinhala(x, 157, size * 0.95, { fill: t.text, opacity: t.muted }));
  x += sinhalaWidth(size * 0.95) + 14;
  parts.push(dot(x)); x += measure("serif", "·", size) + 14;
  parts.push(type("brush", PROFILE.zhName, x, 158, size + 2, { fill: t.text, opacity: t.muted, ls: 2 }));
  return parts.join("\n  ");
}

function banner(name: ThemeName): string {
  const t = TOKENS[name];
  const [r, g, b] = rgb(t.text);
  const [pr, pg, pb] = rgb(t.paper);
  const inkOpacity = name === "dark" ? 0.2 : 0.16;
  const glyphs = ART.map((href, i) => {
    const x = 318 + i * 178;
    return `<clipPath id="gl${i}"><rect class="gw" x="${x}" y="24" width="230" height="230" style="animation-delay:${(0.5 + i * 0.7).toFixed(1)}s"/></clipPath>
  <image href="${href}" x="${x}" y="24" width="230" height="230" filter="url(#tint)" clip-path="url(#gl${i})" opacity="${inkOpacity}"/>`;
  }).join("\n  ");
  const body = `
  <filter id="tint" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  0 0 0 1 0"/></filter>
  ${glyphs}
  <ellipse class="mist m1" cx="200" cy="80" rx="190" ry="26" fill="${t.text}" fill-opacity=".05"/>
  <ellipse class="mist m2" cx="640" cy="230" rx="230" ry="22" fill="${t.text}" fill-opacity=".04"/>
  <filter id="tintp" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 ${pr}  0 0 0 0 ${pg}  0 0 0 0 ${pb}  0 0 0 1 0"/></filter>
  <g class="stamp"><g transform="translate(56 74)"><rect width="64" height="64" rx="7.7" fill="${t.accent}"/><rect x="3" y="3" width="58" height="58" rx="5" fill="none" stroke="${t.paper}" stroke-opacity=".55" stroke-width="1.2"/><image href="${ART[0]}" x="4" y="4" width="56" height="56" filter="url(#tintp)"/></g></g>
  <clipPath id="reveal"><rect class="wipe" x="130" y="60" width="740" height="90"/></clipPath>
  <g clip-path="url(#reveal)">${type("serifBold", PROFILE.name, 140, 124, 62, { fill: t.text, ls: 0.5 })}</g>
  <g class="fade">${subtitle(t)}</g>
  <path class="brush" d="M140 178 C 260 168, 380 188, 520 176 S 720 172, 800 180" fill="none" stroke="${t.accent}" stroke-width="3" stroke-linecap="round" pathLength="1"/>
  ${type("display", PROFILE.tagline, 141, 230, 34, { fill: t.accent, ls: 1.2, cls: "tag" })}`;
  const css = `
  .gw{animation:gwipe 1.4s cubic-bezier(.4,0,.2,1) both}
  @keyframes gwipe{from{height:0}to{height:230px}}
  .wipe{animation:wipe 2.2s cubic-bezier(.22,.61,.36,1) both}
  @keyframes wipe{from{width:0}to{width:740px}}
  .stamp{animation:stamp .7s cubic-bezier(.3,1.6,.5,1) .2s both;transform-box:fill-box;transform-origin:center}
  @keyframes stamp{from{opacity:0;transform:scale(1.5) rotate(-8deg)}to{opacity:1;transform:none}}
  .fade{animation:fade 1s ease 1.6s both}.fade2{animation:fade 1s ease 2.2s both}
  @keyframes fade{from{opacity:0}to{opacity:1}}
  .brush{animation:draw 1.6s ease 1.4s both}
  @keyframes draw{from{stroke-dasharray:1;stroke-dashoffset:1}to{stroke-dasharray:1;stroke-dashoffset:0}}
  .tag{animation:fade 1s ease 2.2s both}
  .mist{animation:drift 18s ease-in-out infinite alternate}.m2{animation-duration:24s;animation-direction:alternate-reverse}
  @keyframes drift{from{transform:translateX(-40px)}to{transform:translateX(60px)}}`;
  return frame(900, 280, t, "bn", body, css);
}

function metric(x: number, label: string, value: string, t: Tokens, i: number): string {
  return `<g class="rise" style="animation-delay:${0.15 * i}s">${type("mono", label.toUpperCase(), x, 70, 11.5, { fill: t.text, opacity: t.muted, ls: 2.5 })}
  ${type("serifBold", value, x, 122, 58, { fill: t.text })}
  <rect x="${x}" y="134" width="26" height="3" rx="1.5" fill="${t.accent}"/></g>`;
}

function statsCard(name: ThemeName): string {
  const t = TOKENS[name];
  const cols = [
    ["Commits", num(stats.commits)],
    ["Pull requests", num(stats.prs)],
    ["Repositories", num(stats.repos)],
    ["Stars", num(stats.stars)],
  ] as const;
  const body = `
  ${cols.map(([l, v], i) => metric(48 + i * 212, l, v, t, i)).join("\n  ")}
  <line x1="48" y1="170" x2="852" y2="170" stroke="${t.text}" stroke-opacity="${t.line}" stroke-dasharray="2 6" stroke-linecap="round"/>
  <g class="rise" style="animation-delay:.8s">
    ${seal(48, 184, 30, "火", t)}
    ${type("serifBold", `${num(stats.streak.current)} day streak`, 90, 206, 25, { fill: t.text })}
    ${type("serif", `longest ${num(stats.streak.longest)} days`, 330, 206, 25, { fill: t.text, opacity: t.muted })}
    ${type("mono", `LAST 12 MONTHS · ${stats.updated ? stats.updated : "AWAITING FIRST SYNC"}`, 852, 205, 11, { fill: t.text, opacity: t.muted, ls: 2, anchor: "end" })}
  </g>`;
  const css = `.rise{animation:rise .8s ease both}@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`;
  return frame(900, 284, t, "st", `<g class="rise">${heading("Activity", 48, 52, t)}</g><g transform="translate(0 30)">${body}</g>`, css);
}

function langsCard(name: ThemeName): string {
  const t = TOKENS[name];
  const rows = stats.langs.length ? stats.langs : [];
  const h = Math.max(150, 70 + rows.length * 38);
  const trackX = 200,
    trackW = 560;
  const body = rows.length
    ? rows
        .map((l, i) => {
          const y = 56 + i * 38;
          const w = Math.max(6, (trackW * l.pct) / 100);
          const fill = i === 0 ? t.accent : t.text;
          const op = i === 0 ? 1 : Math.max(0.35, 0.8 - i * 0.1);
          return `<g class="rise" style="animation-delay:${i * 0.12}s">
  ${type("serifBold", l.name, 48, y + 7, 23, { fill: t.text })}
  <rect x="${trackX}" y="${y - 2}" width="${trackW}" height="4" rx="2" fill="${t.text}" fill-opacity=".1"/>
  <rect class="bar" x="${trackX}" y="${y - 4}" width="${w.toFixed(1)}" height="8" rx="4" fill="${fill}" fill-opacity="${op}" style="animation-delay:${0.3 + i * 0.12}s"/>
  ${type("mono", `${l.pct.toFixed(1)}%`, 852, y + 4, 12.5, { fill: t.text, opacity: t.muted, anchor: "end", ls: 0.5 })}</g>`;
        })
        .join("\n")
    : type("serif", "The scroll is blank until the first sync runs.", 48, 86, 24, { fill: t.text, opacity: t.muted });
  const css = `.rise{animation:rise .8s ease both}@keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  .bar{transform-box:fill-box;transform-origin:left;animation:grow 1.2s cubic-bezier(.22,.61,.36,1) both}@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}`;
  return frame(900, h, t, "lg", body, css);
}

function contribCard(name: ThemeName): string {
  const t = TOKENS[name];
  const days = stats.days;
  const cell = 12,
    gap = 3,
    step = cell + gap,
    x0 = 52,
    y0 = 52;
  const counts = days.map((d) => d.count).filter((c) => c > 0).sort((a, b) => a - b);
  const q = (p: number) => counts[Math.min(counts.length - 1, Math.floor(p * counts.length))] ?? 1;
  const [q1, q2, q3] = [q(0.25), q(0.5), q(0.75)];
  const first = days.length ? new Date(days[0].date + "T00:00:00Z").getUTCDay() : 0;
  const cols = days.length ? Math.ceil((days.length + first) / 7) : 53;
  const cells = days.length
    ? days
        .map((d, i) => {
          const idx = i + first;
          const c = Math.floor(idx / 7),
            r = idx % 7;
          let fill = t.text,
            op = 0.1;
          if (d.count > 0) {
            if (d.count <= q1) op = 0.32;
            else if (d.count <= q2) op = 0.55;
            else if (d.count <= q3) op = 0.8;
            else {
              fill = t.accent;
              op = 1;
            }
          }
          return `<rect class="cell" x="${x0 + c * step}" y="${y0 + r * step}" width="${cell}" height="${cell}" rx="3" fill="${fill}" fill-opacity="${op}" style="animation-delay:${(c * 0.025).toFixed(3)}s"><title>${esc(d.date)}: ${d.count}</title></rect>`;
        })
        .join("\n")
    : Array.from({ length: 53 * 7 }, (_, i) => {
        const c = Math.floor(i / 7),
          r = i % 7;
        return `<rect x="${x0 + c * step}" y="${y0 + r * step}" width="${cell}" height="${cell}" rx="3" fill="${t.text}" fill-opacity=".08"/>`;
      }).join("");
  const w = Math.max(900, x0 * 2 + cols * step);
  const body = `
  ${type("serifBold", `${num(stats.total)} contributions in the last year`, x0, 37, 24, { fill: t.text })}
  ${cells}
  <g transform="translate(${w - x0 - 150} ${y0 + 7 * step + 14})">${type("mono", "LESS", -8, 10, 10, { fill: t.text, opacity: t.muted, anchor: "end", ls: 1.2 })}
    ${[0.1, 0.32, 0.55, 0.8].map((o, i) => `<rect x="${i * 16}" y="0" width="12" height="12" rx="3" fill="${t.text}" fill-opacity="${o}"/>`).join("")}<rect x="64" y="0" width="12" height="12" rx="3" fill="${t.accent}"/>${type("mono", "MORE", 86, 10, 10, { fill: t.text, opacity: t.muted, ls: 1.2 })}</g>`;
  const css = `.cell{animation:pop .5s ease both}@keyframes pop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}.cell{transform-box:fill-box;transform-origin:center}`;
  return frame(w, y0 + 7 * step + 46, t, "cb", body, css);
}

/** Brand marks from Simple Icons (CC0 files; the logos remain trademarks of their owners). One path each, 24x24. */
const ICONS: Record<string, string> = JSON.parse(readFileSync(new URL("../icons/icons.json", import.meta.url), "utf8"));

function stackCard(name: ThemeName): string {
  const t = TOKENS[name];
  const tileW = 100, tileH = 86, gapX = 10, pitch = 98, y0 = 96, x0 = 190;
  let i = 0;
  const rows = STACK.map((g, r) => {
    const top = y0 + r * pitch;
    const tiles = g.items.map((item, c) => {
      const x = x0 + c * (tileW + gapX);
      const d = ICONS[item];
      if (!d) console.warn(`no icon for ${item}`);
      const k = 1.45;
      const ix = x + tileW / 2 - 12 * k, iy = top + 14;
      return `<g class="rise" style="animation-delay:${(i++ * 0.04).toFixed(2)}s"><rect x="${x}" y="${top}" width="${tileW}" height="${tileH}" rx="8" fill="${t.text}" fill-opacity="${name === "dark" ? 0.04 : 0.05}" stroke="${t.text}" stroke-opacity="${t.line + 0.1}"/>${d ? `<path transform="translate(${r2(ix)} ${iy}) scale(${k})" d="${d}" fill="${t.text}"/>` : ""}${type("mono", item, x + tileW / 2, top + 72, 11, { fill: t.text, opacity: t.muted + 0.1, anchor: "middle", ls: 0.3 })}</g>`;
    }).join("");
    const label = type("mono", g.group.toUpperCase(), 48, top + tileH / 2 + 4, 11.5, { fill: t.text, opacity: t.muted, ls: 2.5 });
    return label + tiles;
  });
  const h = y0 + STACK.length * pitch + 20;
  return frame(900, h, t, "sk", `<g class="rise">${heading("Tech Stack", 48, 52, t)}</g>\n` + rows.join("\n"), RISE);
}

function divider(name: ThemeName): string {
  const t = TOKENS[name];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="28" viewBox="0 0 900 28" role="img"><style>.b{animation:d 2s ease both}@keyframes d{from{stroke-dasharray:1;stroke-dashoffset:1}to{stroke-dasharray:1;stroke-dashoffset:0}}@media (prefers-reduced-motion: reduce){.b{animation:none;stroke-dashoffset:0}}</style>
<path class="b" d="M20 14 C 200 6, 360 20, 450 13 S 700 8, 880 14" fill="none" stroke="${t.text}" stroke-opacity=".45" stroke-width="1.6" stroke-linecap="round" pathLength="1"/>
<rect x="436" y="5" width="18" height="18" rx="2.5" fill="${t.accent}"/></svg>
`;
}



/* ---------- Text cards: About, Education, DNA, Exploring, Code, Architecture ---------- */
type Run = { t: string; b?: boolean };

/** Reading text on the cards. Switch with STYLE=serif|tech when building. */
const STYLE = process.env.STYLE ?? "tech";
const HEAD_FONT = (process.env.HEAD ?? "monoBold") as FontKey;
const BODY =
  STYLE === "tech"
    ? { reg: "monoReg" as FontKey, bold: "monoBold" as FontKey, size: 16, lh: 28, gap: 11, opacity: 0.95, head: HEAD_FONT, headSize: 28 }
    : { reg: "serif" as FontKey, bold: "serifBold" as FontKey, size: 20, lh: 30, gap: 10, opacity: 1, head: "serifBold" as FontKey, headSize: 28 };

/** Word-wraps rich text into outlined lines. Returns the SVG and the height used. */
function paragraph(runs: Run[], x: number, y: number, maxW: number, size: number, lh: number, t: Tokens, opacity = BODY.opacity) {
  // Words carry a `glue` flag when no space separates them from the previous word (e.g. bold "China" then ", an").
  const words: { w: string; b: boolean; glue: boolean }[] = [];
  let prevEndsSpace = true;
  for (const r of runs) {
    const toks = r.t.split(/(\s+)/).filter((x) => x !== "");
    let sawSpace = /^\s/.test(r.t);
    toks.forEach((tok, i) => {
      if (/^\s+$/.test(tok)) { sawSpace = true; return; }
      words.push({ w: tok, b: !!r.b, glue: i === 0 && !sawSpace && !prevEndsSpace && words.length > 0 });
      sawSpace = false;
    });
    prevEndsSpace = /\s$/.test(r.t);
  }
  const fontOf = (b: boolean): FontKey => (b ? BODY.bold : BODY.reg);
  const space = measure(BODY.reg, " ", size);
  const lines: { w: string; b: boolean; glue: boolean }[][] = [[]];
  let lw = 0;
  for (const word of words) {
    const ww = measure(fontOf(word.b), word.w, size);
    const gap = lines[lines.length - 1].length && !word.glue ? space : 0;
    if (lines[lines.length - 1].length && !word.glue && lw + gap + ww > maxW) { lines.push([]); lw = 0; }
    lw += (lines[lines.length - 1].length && !word.glue ? space : 0) + ww;
    lines[lines.length - 1].push(word);
  }
  const out = lines.map((line, i) => {
    let cx = x;
    return line.map((word, j) => {
      if (j > 0 && !word.glue) cx += space;
      const piece = type(fontOf(word.b), word.w, cx, y + i * lh, size, { fill: t.text, opacity });
      cx += measure(fontOf(word.b), word.w, size);
      return piece;
    }).join("");
  }).join("\n  ");
  return { svg: out, height: lines.length * lh };
}

/** Section title with the short cinnabar rule used on the other cards. */
function heading(label: string, x: number, y: number, t: Tokens): string {
  return `${type(BODY.head, label, x, y, BODY.headSize, { fill: t.text, ls: BODY.head === "serifBold" ? 0 : 0.6 })}<rect x="${x}" y="${y + 12}" width="26" height="3" rx="1.5" fill="${t.accent}"/>`;
}

const RISE = `.rise{animation:rise .8s ease both}@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`;
const rise = (i: number, inner: string) => `<g class="rise" style="animation-delay:${(i * 0.18).toFixed(2)}s">${inner}</g>`;

export const ABOUT: Run[] = [
  { t: "I'm a full-stack web developer who enjoys crafting " },
  { t: "clean, intuitive, and meaningful digital experiences", b: true },
  { t: ". With a background in " }, { t: "graphic design", b: true }, { t: " and " }, { t: "data operations", b: true },
  { t: ", I approach projects with a balance of creativity, structure, clarity, and precision — building software that feels human-centered and thoughtfully engineered." },
];
export const EDUCATION: Run[] = [
  { t: "I completed my undergraduate degree in " }, { t: "China", b: true },
  { t: ", an international environment that expanded my technical perspective and strengthened my ability to collaborate across cultures, disciplines, and languages." },
];
export const DNA = [
  "Full-Stack Thinker", "Design-Conscious Coder", "Accuracy-Driven Data Professional",
  "Multilingual Communicator", "Problem Solver with Creative Insight", "Values Clean UI, Clean Code, Clean Architecture",
];
export const EXPLORING = [
  "Deepening my full-stack flow with Next.js Server Actions",
  "Building my own TypeScript utility library",
  "Exploring UI animation practices with Motion",
  "Expanding my skills in design systems and component architecture",
];

function aboutCard(name: ThemeName): string {
  const t = TOKENS[name];
  const colW = 380;
  const a = paragraph(ABOUT, 48, 94, colW, BODY.size, BODY.lh, t);
  const e = paragraph(EDUCATION, 472, 94, colW, BODY.size, BODY.lh, t);
  const h = 94 + Math.max(a.height, e.height) + 30;
  const body = rise(0, `${heading("About Me", 48, 52, t)}\n  ${a.svg}`) + rise(1, `${heading("Education", 472, 52, t)}\n  ${e.svg}`) +
    `<line x1="450" y1="36" x2="450" y2="${h - 28}" stroke="${t.text}" stroke-opacity="${t.line}" stroke-dasharray="2 6" stroke-linecap="round"/>`;
  return frame(900, h, t, "ab", body, RISE);
}

function listBlock(items: string[], x: number, y: number, maxW: number, t: Tokens, delay: number): { svg: string; height: number } {
  let cy = y;
  const parts: string[] = [];
  for (const item of items) {
    const p = paragraph([{ t: item }], x + 22, cy, maxW - 22, BODY.size, BODY.lh, t);
    parts.push(`<rect x="${x + 2}" y="${cy - 10}" width="8" height="8" rx="1.5" fill="${t.accent}"/>${p.svg}`);
    cy += p.height + BODY.gap;
  }
  return { svg: rise(delay, parts.join("\n  ")), height: cy - y };
}

function dnaCard(name: ThemeName): string {
  const t = TOKENS[name];
  const left = listBlock(DNA, 48, 96, 380, t, 1);
  const right = listBlock(EXPLORING, 472, 96, 380, t, 2);
  const h = 96 + Math.max(left.height, right.height) + 22;
  const body = rise(0, heading("Developer DNA", 48, 52, t) + heading("Currently Exploring", 472, 52, t)) + left.svg + right.svg +
    `<line x1="450" y1="36" x2="450" y2="${h - 28}" stroke="${t.text}" stroke-opacity="${t.line}" stroke-dasharray="2 6" stroke-linecap="round"/>`;
  return frame(900, h, t, "dn", body, RISE);
}

type Tok = [string, "k" | "s" | "p" | "n"];
const CODE: Tok[][] = [
  [["const ", "k"], ["profile ", "n"], ["= {", "p"]],
  [["  role", "n"], [": ", "p"], ['"Full-Stack Developer"', "s"], [",", "p"]],
  [["  stack", "n"], [": [", "p"], ['"Next.js"', "s"], [", ", "p"], ['"React"', "s"], [", ", "p"], ['"NestJS"', "s"], [", ", "p"], ['"Tailwind"', "s"], [", ", "p"], ['"TypeScript"', "s"], ["],", "p"]],
  [["  strengths", "n"], [": [", "p"], ['"Clean UI"', "s"], [", ", "p"], ['"Smooth UX"', "s"], [", ", "p"], ['"Maintainable Code"', "s"], ["],", "p"]],
  [["  languages", "n"], [": [", "p"], ['"English"', "s"], [", ", "p"], ['"Chinese"', "s"], [", ", "p"], ['"Sinhalese"', "s"], ["],", "p"]],
  [["  approach", "n"], [": ", "p"], ['"Build with clarity. Design with intention."', "s"], [",", "p"]],
  [["};", "p"]],
];

function codeCard(name: ThemeName): string {
  const t = TOKENS[name];
  const size = 14.5, lh = 26;
  const colour = (k: Tok[1]) => (k === "k" ? { fill: t.accent, opacity: 1 } : k === "s" ? { fill: t.text, opacity: 1 } : k === "p" ? { fill: t.text, opacity: 0.5 } : { fill: t.text, opacity: 0.8 });
  const rows = CODE.map((line, i) => {
    let cx = 78;
    return line.map(([txt, kind]) => {
      const piece = type("mono", txt, cx, 128 + i * lh, size, { ...colour(kind), ls: 0.3 });
      cx += measure("mono", txt, size, 0.3) + 0.3;
      return piece;
    }).join("");
  }).join("\n  ");
  const h = 128 + CODE.length * lh + 22;
  const body = rise(0, heading("Code That Describes Me", 48, 52, t)) +
    rise(1, `<rect x="48" y="84" width="804" height="${h - 84 - 22}" rx="8" fill="${t.mount}" fill-opacity="${name === "dark" ? 0.55 : 0.12}" stroke="${t.text}" stroke-opacity="${t.line * 0.6}"/>
  <circle cx="68" cy="100" r="3.5" fill="${t.accent}"/><circle cx="82" cy="100" r="3.5" fill="${t.text}" fill-opacity=".3"/><circle cx="96" cy="100" r="3.5" fill="${t.text}" fill-opacity=".3"/>
  ${rows}`);
  return frame(900, h, t, "cd", body, RISE);
}

const ARCH_ROWS: [string, string][] = [
  ["Frontend", "Next.js + React + Tailwind"],
  ["Backend", "NestJS / Node.js + Express"],
  ["Database", "PostgreSQL + Prisma, or MongoDB"],
  ["Design", "Figma + component systems"],
  ["DevOps", "Git + Vercel + Linux"],
];
const ARCH_FLOW = ["Next.js UI", "API Routes", "NestJS / Node.js Logic", "Database Layer (SQL / NoSQL)"];

function archCard(name: ThemeName): string {
  const t = TOKENS[name];
  const rows = ARCH_ROWS.map(([k, v], i) => {
    const y = 108 + i * 44;
    return `${type("mono", k.toUpperCase(), 48, y, 11.5, { fill: t.text, opacity: t.muted, ls: 2.5 })}${type(BODY.reg, v, 170, y + 1, BODY.size + 1, { fill: t.text, opacity: BODY.opacity })}<line x1="48" y1="${y + 14}" x2="420" y2="${y + 14}" stroke="${t.text}" stroke-opacity="${t.line * 0.5}" stroke-dasharray="2 6" stroke-linecap="round"/>`;
  }).join("\n  ");
  const boxW = 330, bx = 520, bh = 34, gap = 24;
  const flow = ARCH_FLOW.map((label, i) => {
    const y = 84 + i * (bh + gap);
    const arrowY = y + bh;
    const arrowSvg = i < ARCH_FLOW.length - 1
      ? `<path d="M${bx + boxW / 2} ${arrowY + 3}V${arrowY + gap - 5}M${bx + boxW / 2 - 5} ${arrowY + gap - 10}L${bx + boxW / 2} ${arrowY + gap - 4}L${bx + boxW / 2 + 5} ${arrowY + gap - 10}" fill="none" stroke="${t.accent}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`
      : "";
    return `<rect x="${bx}" y="${y}" width="${boxW}" height="${bh}" rx="5" fill="none" stroke="${t.text}" stroke-opacity="${t.line + 0.15}"/>${type("mono", label, bx + boxW / 2, y + 22, 13.5, { fill: t.text, anchor: "middle", ls: 0.4 })}${arrowSvg}`;
  }).join("\n  ");
  const h = 84 + ARCH_FLOW.length * (bh + gap) + 20;
  const body = rise(0, heading("Architecture I Typically Build", 48, 52, t)) + rise(1, rows) + rise(2, flow);
  return frame(900, h, t, "ar", body, RISE);
}

/** A button drawn inside the Connect card: cinnabar seal square, label, arrow. */
function button(t: Tokens, x: number, y: number, w: number, label: string): string {
  return `<g class="rise" style="animation-delay:.3s"><rect x="${x}" y="${y}" width="${w}" height="48" rx="6" fill="${t.paper}" fill-opacity=".6" stroke="${t.text}" stroke-opacity="${t.line + 0.2}"/>
  <rect x="${x + 14}" y="${y + 14}" width="20" height="20" rx="2.5" fill="${t.accent}"/>
  ${type("serifBold", label, x + 50, y + 31, 23, { fill: t.text })}
  ${arrow(x + 50 + measure("serifBold", label, 23) + 12, y + 17, 12, t.text)}</g>`;
}

/**
 * One card, cut into a left and right half so each half can carry its own link.
 * Both halves draw the same 900px card; the viewBox picks the half, so the seam is invisible.
 */
function connectCard(name: ThemeName, half: 0 | 1): string {
  const t = TOKENS[name];
  const body = `<g class="rise">${heading("Connect", 48, 52, t)}</g>${button(t, 252, 84, 190, "Portfolio")}${button(t, 458, 84, 190, "LinkedIn")}`;
  const full = frame(900, 160, t, "cn", body, RISE);
  return full.replace(/width="900" height="160" viewBox="0 0 900 160"/, `width="450" height="160" viewBox="${half * 450} 0 450 160"`);
}

const write = (f: string, s: string) => writeFileSync(new URL(f, out), s);
for (const n of ["dark", "light"] as ThemeName[]) {
  write(`banner-${n}.svg`, banner(n));
  write(`stats-${n}.svg`, statsCard(n));
  write(`langs-${n}.svg`, langsCard(n));
  write(`contrib-${n}.svg`, contribCard(n));
  write(`stack-${n}.svg`, stackCard(n));
  write(`connect-left-${n}.svg`, connectCard(n, 0));
  write(`connect-right-${n}.svg`, connectCard(n, 1));
  write(`about-${n}.svg`, aboutCard(n));
  write(`dna-${n}.svg`, dnaCard(n));
  write(`code-${n}.svg`, codeCard(n));
  write(`arch-${n}.svg`, archCard(n));
  write(`divider-${n}.svg`, divider(n));
}
console.log("assets written");
