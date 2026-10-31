// Generates the static SVGs in assets/ (hero, project cards, stack, section
// labels, contact buttons) in dark and light variants, and scripts/fonts.json
// for stats.mjs. Run after `npm install`: `npm run build`.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as fontkit from "fontkit";
import * as si from "simple-icons";
import subsetFont from "subset-font";
import {
  FONT_STACKS,
  SYNTAX,
  THEMES,
  TRAFFIC,
  esc,
  svg,
} from "./theme.mjs";

const ASSETS = new URL("../assets/", import.meta.url);
const FONT_DIR = new URL("../node_modules/geist/dist/fonts/", import.meta.url);

// ─── Fonts ──────────────────────────────────────────────────────────────────

const FONT_FILES = {
  sans400: ["Geist", 400, "geist-sans/Geist-Regular.woff2"],
  sans600: ["Geist", 600, "geist-sans/Geist-SemiBold.woff2"],
  sans700: ["Geist", 700, "geist-sans/Geist-Bold.woff2"],
  mono400: ["Geist Mono", 400, "geist-mono/GeistMono-Regular.woff2"],
};

// Only what stats.mjs draws, so the daily SVG stays small.
const STATS_CHARS = {
  sans600: "0123456789,",
  mono400: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ,.:·-",
};

const buffers = {};
const metrics = {};

async function loadFonts() {
  const out = {};
  for (const [key, [family, weight, file]] of Object.entries(FONT_FILES)) {
    buffers[key] = await readFile(new URL(file, FONT_DIR));
    metrics[key] = fontkit.create(buffers[key]);
    if (STATS_CHARS[key]) {
      const sub = await subsetFont(buffers[key], STATS_CHARS[key], {
        targetFormat: "woff2",
      });
      out[key] = { family, weight, data: sub.toString("base64") };
    }
  }
  await writeFile(
    new URL("./fonts.json", import.meta.url),
    JSON.stringify(out) + "\n",
  );
}

// @font-face rules carrying just the glyphs each SVG draws.
async function faces(uses) {
  const rules = [];
  for (const [key, text] of Object.entries(uses)) {
    const [family, weight] = FONT_FILES[key];
    const sub = await subsetFont(buffers[key], text, { targetFormat: "woff2" });
    rules.push(
      `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/woff2;base64,${sub.toString("base64")}) format('woff2')}`,
    );
  }
  return rules.join("") + FONT_STACKS;
}

function measure(font, size, text, tracking = 0) {
  const f = metrics[font];
  const w = (f.layout(text).advanceWidth / f.unitsPerEm) * size;
  return w + tracking * Math.max(0, text.length - 1);
}

function wrap(font, size, text, width) {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(font, size, next) > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

// Deterministic jitter, so rebuilding doesn't churn the SVGs.
function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const n = (x) => Math.round(x * 100) / 100;

// ─── Hero ───────────────────────────────────────────────────────────────────

const ABOUT_ME = [
  ["name", "Daniil"],
  ["country", "Kazakhstan"],
  ["stack", ["TS", "Next.js", "Node.js"]],
  ["building", "AI products"],
  ["fuel", "plov"],
];

// The aboutMe object as lines of [text, color] tokens, like AboutMeCard.tsx.
function codeLines() {
  const p = SYNTAX.punct;
  const lines = [
    [
      ["const", SYNTAX.keyword],
      [" ", p],
      ["aboutMe", SYNTAX.name],
      [" = {", p],
    ],
  ];
  for (const [key, value] of ABOUT_ME) {
    const line = [
      ["  ", p],
      [key, SYNTAX.key],
      [": ", p],
    ];
    if (Array.isArray(value)) {
      line.push(["[", p]);
      value.forEach((v, i) => {
        if (i) line.push([", ", p]);
        line.push([`"${v}"`, SYNTAX.string]);
      });
      line.push(["]", p]);
    } else line.push([`"${value}"`, SYNTAX.string]);
    line.push([",", p]);
    lines.push(line);
  }
  lines.push([["};", p]]);
  return lines;
}

async function hero(t, mode) {
  const W = 840;
  const H = 340;
  const win = { x: 416, y: 45, w: 376, h: 250 };
  const codeX = win.x + 20;
  const size = 13.5;
  const lh = 26;
  const firstBase = win.y + 70;
  const cw = measure("mono400", size, "0");

  // Typing timeline: every character after the indent gets a jittered step.
  const rand = rng(7);
  const start = 0.9;
  let clock = start;
  const clips = [];
  const cursor = []; // [time, x, y]
  const lines = codeLines();
  const text = lines
    .map((tokens, i) => {
      const base = firstBase + i * lh;
      let col = 0;
      const spans = tokens.map(([s, color]) => {
        const span = `<tspan x="${n(codeX + col * cw)}" fill="${color}">${esc(s)}</tspan>`;
        col += s.length;
        return s.trim() ? span : "";
      });
      const indent = tokens[0][0].trim() ? 0 : tokens[0][0].length;
      const chars = col - indent;
      const x0 = codeX + indent * cw;
      const begin = clock;
      const times = [0];
      for (let c = 1; c <= chars; c++) {
        clock += 0.018 + rand() * 0.04;
        times.push(clock - begin);
        cursor.push([clock, x0 + c * cw, base]);
      }
      if (i === 0) cursor.unshift([begin, x0, base]);
      const dur = clock - begin;
      clock += 0.12; // the newline
      cursor.push([clock, codeX + (lines[i + 1]?.[0][0].trim() ? 0 : 2) * cw, base + lh]);
      const values = times.map((_, c) => n(c * cw)).join(";");
      const keyTimes = times.map((x) => (x / dur).toFixed(4)).join(";");
      clips.push(
        `<clipPath id="l${i}"><rect x="${n(x0)}" y="${base - 18}" height="${lh}" width="0"><animate attributeName="width" values="${values}" keyTimes="${keyTimes}" calcMode="discrete" begin="${begin.toFixed(2)}s" dur="${dur.toFixed(2)}s" fill="freeze"/></rect></clipPath>`,
      );
      return `<text class="mono" y="${base}" font-size="${size}" clip-path="url(#l${i})" xml:space="preserve">${spans.join("")}</text>`;
    })
    .join("");

  // The cursor ends after the closing "};", not on a fresh line.
  cursor.pop();
  const end = cursor[cursor.length - 1][0];
  const span = end - start;
  const keyTimes = cursor.map(([tm]) => ((tm - start) / span).toFixed(4)).join(";");
  const xs = cursor.map(([, x]) => n(x + 1)).join(";");
  const ys = cursor.map(([, , y]) => y - 13).join(";");
  const caret = `<rect width="${n(cw * 0.45)}" height="16" fill="${SYNTAX.cursor}" opacity="0" x="${n(codeX + 1)}" y="${firstBase - 13}">
<animate attributeName="x" values="${xs}" keyTimes="${keyTimes}" calcMode="discrete" begin="${start}s" dur="${span.toFixed(2)}s" fill="freeze"/>
<animate attributeName="y" values="${ys}" keyTimes="${keyTimes}" calcMode="discrete" begin="${start}s" dur="${span.toFixed(2)}s" fill="freeze"/>
<set attributeName="opacity" to="1" begin="${start - 0.4}s"/>
<animate attributeName="opacity" values="1;0" keyTimes="0;0.5" calcMode="discrete" dur="1.06s" begin="${(end + 0.3).toFixed(2)}s" repeatCount="indefinite"/>
</rect>`;

  const title = ["Full Stack", "Developer"];
  for (const s of title) {
    const w = measure("sans700", 60, s, -2.4);
    if (48 + w > win.x - 24) throw new Error(`hero title too wide: ${s} ${w}`);
  }

  const code = lines.flat().map(([s]) => s).join("");
  const style = `${await faces({
    sans700: title.join(""),
    mono400: `HELLO, I'M DANIIL web apps · bots · AI products about-me.ts ${code}`,
  })}
.rise{animation:rise 1s cubic-bezier(.2,.7,.2,1) both}
@keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.a{animation:a 16s ease-in-out infinite alternate}.b{animation:b 19s ease-in-out infinite alternate}
@keyframes a{from{transform:translate(-40px,-16px)}to{transform:translate(36px,22px)}}
@keyframes b{from{transform:translate(30px,20px)}to{transform:translate(-44px,-18px)}}
@media (prefers-reduced-motion:reduce){.rise,.a,.b{animation:none}}`;

  const shadow =
    mode === "light"
      ? `<filter id="sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#000" flood-opacity=".22"/></filter>`
      : `<filter id="sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#000" flood-opacity=".7"/></filter>`;

  const body = `<defs>
<pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="${t.grid}"/></pattern>
<radialGradient id="fade" cx="50%" cy="50%" r="60%"><stop offset=".2" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<mask id="m"><rect width="${W}" height="${H}" fill="url(#fade)"/></mask>
<radialGradient id="ga"><stop offset="0" stop-color="${SYNTAX.keyword}" stop-opacity="${t.glowA}"/><stop offset="1" stop-color="${SYNTAX.keyword}" stop-opacity="0"/></radialGradient>
<radialGradient id="gb"><stop offset="0" stop-color="${SYNTAX.name}" stop-opacity="${t.glowB}"/><stop offset="1" stop-color="${SYNTAX.name}" stop-opacity="0"/></radialGradient>
<clipPath id="frame"><rect width="${W}" height="${H}" rx="16"/></clipPath>
${shadow}
${clips.join("\n")}
</defs>
<g clip-path="url(#frame)">
<rect width="${W}" height="${H}" fill="${t.bg}"/>
<rect width="${W}" height="${H}" fill="url(#dots)" mask="url(#m)"/>
<ellipse class="a" cx="560" cy="150" rx="260" ry="190" fill="url(#ga)"/>
<ellipse class="b" cx="700" cy="250" rx="220" ry="160" fill="url(#gb)"/>
</g>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="15.5" fill="none" stroke="${t.border}"/>
<text class="mono rise" x="48" y="104" font-size="12" letter-spacing="3.6" fill="${t.subtle}">HELLO, I'M DANIIL</text>
<text class="sans rise" style="animation-delay:.12s" x="46" y="170" font-size="60" font-weight="700" letter-spacing="-2.4" fill="${t.fg}">${title[0]}</text>
<text class="sans rise" style="animation-delay:.22s" x="46" y="232" font-size="60" font-weight="700" letter-spacing="-2.4" fill="${t.fg}">${title[1]}</text>
<text class="mono rise" style="animation-delay:.34s" x="48" y="282" font-size="13" fill="${t.muted}">web apps · bots · AI products</text>
<g class="rise" style="animation-delay:.3s">
<rect x="${win.x}" y="${win.y}" width="${win.w}" height="${win.h}" rx="12" fill="#0c0c0c" filter="url(#sh)"/>
<rect x="${win.x + 0.5}" y="${win.y + 0.5}" width="${win.w - 1}" height="${win.h - 1}" rx="11.5" fill="none" stroke="#262626"/>
${TRAFFIC.map((c, i) => `<circle cx="${win.x + 22 + i * 20}" cy="${win.y + 20}" r="6" fill="${c}"/>`).join("")}
<text class="mono" x="${win.x + 82}" y="${win.y + 24}" font-size="12" fill="#737373">about-me.ts</text>
<line x1="${win.x}" x2="${win.x + win.w}" y1="${win.y + 40.5}" y2="${win.y + 40.5}" stroke="#262626"/>
${text}
${caret}
</g>`;

  return svg({
    width: W,
    height: H,
    label: "Hello, I'm Daniil — Full Stack Developer. Web apps, bots and AI products.",
    style,
    body,
  });
}

// ─── Project cards ──────────────────────────────────────────────────────────

const PROJECTS = [
  {
    slug: "visit",
    title: "Visit.kz",
    meta: "myvisit.kz",
    live: true,
    text: "CRM with an AI receptionist for salons, barbershops and clinics: the AI answers clients in WhatsApp, Instagram and Telegram and books visits on its own.",
    tags: ["Next.js", "PostgreSQL", "Redis", "WebSockets", "Docker"],
  },
  {
    slug: "waymedia",
    title: "WayMedia",
    meta: "waymedia.ad",
    live: true,
    text: "Platform for TikTok and Instagram promo campaigns: editors post edits with a campaign's track and get paid for every thousand views.",
    tags: ["Next.js", "PostgreSQL", "Redis", "Tailwind", "Three.js"],
  },
  {
    slug: "vampire",
    title: "Vampire Media",
    meta: "vampiremedia.promo",
    live: true,
    text: "TikTok track promotion: a Discord bot for working with creators and a site with a public ledger of every view.",
    tags: ["discord.js", "Next.js", "Supabase"],
  },
  {
    slug: "ym-discord-rpc",
    title: "ym-discord-rpc",
    meta: "open source · MIT",
    live: false,
    text: "Discord Rich Presence for Yandex Music on Linux: cover art, links and a live progress bar, straight from MPRIS.",
    tags: ["TypeScript", "Node.js", "D-Bus", "Discord RPC"],
  },
];

async function card(p, t) {
  const W = 410;
  const H = 200;
  const pad = 24;
  const lines = wrap("sans400", 13.5, p.text, W - pad * 2);
  if (lines.length > 3) throw new Error(`${p.slug}: description wraps to ${lines.length} lines`);

  let x = pad;
  const chips = p.tags
    .map((tag) => {
      const w = measure("mono400", 11, tag) + 16;
      const chip = `<rect x="${n(x)}" y="${H - 42}" width="${n(w)}" height="22" rx="6" fill="${t.raised}" stroke="${t.border}"/><text class="mono" x="${n(x + 8)}" y="${H - 27}" font-size="11" fill="${t.muted}">${esc(tag)}</text>`;
      x += w + 6;
      return chip;
    })
    .join("");
  if (x - 6 > W - pad) throw new Error(`${p.slug}: chips overflow`);

  const status = p.live
    ? `<circle cx="${pad + 3}" cy="62" r="3" fill="${TRAFFIC[2]}"/><circle cx="${pad + 3}" cy="62" r="3" fill="none" stroke="${TRAFFIC[2]}"><animate attributeName="r" values="3;9" dur="2.4s" repeatCount="indefinite"/><animate attributeName="opacity" values=".7;0" dur="2.4s" repeatCount="indefinite"/></circle>`
    : `<circle cx="${pad + 3}" cy="62" r="3" fill="none" stroke="${t.subtle}" stroke-width="1.2"/>`;

  const style = await faces({
    sans400: lines.join(""),
    sans600: p.title,
    mono400: p.meta + p.tags.join(""),
  });
  const body = `<defs><radialGradient id="hl" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(0 0) scale(320 200)"><stop offset="0" stop-color="${SYNTAX.keyword}" stop-opacity="${t.glowB * 0.8}"/><stop offset="1" stop-color="${SYNTAX.keyword}" stop-opacity="0"/></radialGradient></defs>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="12" fill="${t.surface}" stroke="${t.border}"/>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="12" fill="url(#hl)"/>
<text class="sans" x="${pad}" y="42" font-size="20" font-weight="600" letter-spacing="-.4" fill="${t.fg}">${esc(p.title)}</text>
<path d="M${W - pad - 10} 38l10-10m-7 0h7v7" stroke="${t.subtle}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
${status}
<text class="mono" x="${pad + 14}" y="66" font-size="12" fill="${t.subtle}">${esc(p.meta)}</text>
${lines.map((l, i) => `<text class="sans" x="${pad}" y="${96 + i * 20}" font-size="13.5" fill="${t.muted}">${esc(l)}</text>`).join("")}
${chips}`;

  return svg({ width: W, height: H, label: `${p.title} — ${p.text}`, style, body });
}

// ─── Stack ──────────────────────────────────────────────────────────────────

// Dark colors are the brightened ones from StackScene.tsx; light ones are the
// brand colors, darkened where they would vanish on white.
const STACK = [
  ["TypeScript", si.siTypescript, "#4f9cf9", "#3178c6"],
  ["JavaScript", si.siJavascript, "#f7df1e", "#c9a800"],
  ["React", si.siReact, "#61dafb", "#0ea5c6"],
  ["Next.js", si.siNextdotjs, "#e8e8e8", "#0a0a0a"],
  ["Node.js", si.siNodedotjs, "#6cc24a", "#5fa04e"],
  ["PostgreSQL", si.siPostgresql, "#6d9fe8", "#4169e1"],
  ["Redis", si.siRedis, "#ff6b5b", "#e8382b"],
  ["Docker", si.siDocker, "#4aa8ff", "#2496ed"],
  ["Tailwind CSS", si.siTailwindcss, "#38bdf8", "#0ea5e9"],
  ["Three.js", si.siThreedotjs, "#e8e8e8", "#0a0a0a"],
  ["Supabase", si.siSupabase, "#3ecf8e", "#2fa572"],
  ["discord.js", si.siDiscorddotjs, "#7c8cff", "#5865f2"],
  ["Telegram Bots", si.siTelegram, "#35ade1", "#26a5e4"],
  ["Linux", si.siLinux, "#fcc624", "#a17a00"],
];

async function stack(t, mode) {
  const W = 840;
  const cols = 7;
  const slot = W / cols;
  const icon = 30;
  const H = 216;
  const items = STACK.map(([name, ic, dark, light], i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = slot * col + slot / 2;
    const top = 40 + row * 90;
    const color = mode === "dark" ? dark : light;
    return `<g class="ic" style="color:${color};animation-delay:${n((col + row * 2) * 0.32)}s"><path transform="translate(${n(cx - icon / 2)} ${top}) scale(${icon / 24})" d="${ic.path}" fill="currentColor"/></g><text class="mono" x="${n(cx)}" y="${top + icon + 24}" font-size="11" text-anchor="middle" fill="${t.subtle}">${esc(name)}</text>`;
  }).join("");

  const glow = mode === "dark" ? 9 : 6;
  const style = `${await faces({ mono400: STACK.map(([name]) => name).join("") })}
.ic{animation:glow 7s ease-in-out infinite both}
@keyframes glow{0%,24%,100%{filter:drop-shadow(0 0 0 transparent);transform:none}10%{filter:drop-shadow(0 0 ${glow}px currentColor);transform:translateY(-2px)}}
@media (prefers-reduced-motion:reduce){.ic{animation:none}}`;
  const body = `<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="14" fill="${t.surface}" stroke="${t.border}"/>${items}`;
  return svg({
    width: W,
    height: H,
    label: `Stack: ${STACK.map(([name]) => name).join(", ")}`,
    style,
    body,
  });
}

// ─── Section labels ─────────────────────────────────────────────────────────

async function label(text, t) {
  const W = 840;
  const H = 52;
  const w = measure("mono400", 12, text, 3.6);
  const gap = 18;
  const left = W / 2 - w / 2 - gap;
  const right = W / 2 + w / 2 + gap;
  const style = await faces({ mono400: text });
  const body = `<defs><linearGradient id="l" x1="0" x2="1"><stop offset="0" stop-color="${t.border}" stop-opacity="0"/><stop offset="1" stop-color="${t.border}"/></linearGradient><linearGradient id="r" x1="0" x2="1"><stop offset="0" stop-color="${t.border}"/><stop offset="1" stop-color="${t.border}" stop-opacity="0"/></linearGradient></defs>
<rect x="${n(left - 260)}" y="${H / 2}" width="260" height="1" fill="url(#l)"/>
<rect x="${n(right)}" y="${H / 2}" width="260" height="1" fill="url(#r)"/>
<text class="mono" x="${W / 2 + 1.8}" y="${H / 2 + 4}" font-size="12" letter-spacing="3.6" text-anchor="middle" fill="${t.subtle}">${esc(text)}</text>`;
  return svg({ width: W, height: H, label: text, style, body });
}

// ─── Contact buttons ────────────────────────────────────────────────────────

const GLOBE = `<g fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9.5"/><ellipse cx="12" cy="12" rx="4" ry="9.5"/><path d="M2.5 12h19"/></g>`;

const BUTTONS = [
  { slug: "site", text: "eon1x.vercel.app", icon: GLOBE, color: null },
  {
    slug: "telegram",
    text: "Telegram @eon1x",
    icon: `<path d="${si.siTelegram.path}" fill="currentColor"/>`,
    color: "#35ade1",
  },
];

async function button(b, t) {
  const H = 46;
  const textW = measure("mono400", 13, b.text);
  const W = Math.ceil(22 + 18 + 10 + textW + 24);
  const style = await faces({ mono400: b.text });
  const body = `<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="${H / 2}" fill="${t.surface}" stroke="${t.border}"/>
<g transform="translate(22 14) scale(.75)" style="color:${b.color ?? t.muted}">${b.icon}</g>
<text class="mono" x="50" y="27.5" font-size="13" fill="${t.fg}">${esc(b.text)}</text>`;
  return svg({ width: W, height: H, label: b.text, style, body });
}

// ─── Main ───────────────────────────────────────────────────────────────────

await loadFonts();
await mkdir(ASSETS, { recursive: true });

const files = {};
for (const [mode, t] of Object.entries(THEMES)) {
  files[`hero-${mode}.svg`] = await hero(t, mode);
  for (const p of PROJECTS) files[`card-${p.slug}-${mode}.svg`] = await card(p, t);
  files[`stack-${mode}.svg`] = await stack(t, mode);
  for (const text of ["PROJECTS", "STACK", "ACTIVITY", "CONTACT"])
    files[`label-${text.toLowerCase()}-${mode}.svg`] = await label(text, t);
  for (const b of BUTTONS) files[`button-${b.slug}-${mode}.svg`] = await button(b, t);
}

for (const [name, content] of Object.entries(files)) {
  await writeFile(new URL(name, ASSETS), content);
  console.log(`${name.padEnd(34)} ${(content.length / 1024).toFixed(1)} KB`);
}
