// Activity card for the profile README: totals, streaks and the contribution
// graph, from the public contribution calendar (private contributions count
// once "Include private contributions" is on). Meant to run daily.
// Usage: GITHUB_TOKEN=… node scripts/stats.mjs [outDir] [login]
import { mkdir, writeFile } from "node:fs/promises";
import { FONT_STACKS, SYNTAX, THEMES, fontFaces, svg } from "./theme.mjs";

const outDir = process.argv[2] ?? "dist";
const login =
  process.argv[3] ?? process.env.GITHUB_REPOSITORY_OWNER ?? "Akio1965";

const query = `query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date weekday contributionCount contributionLevel } }
      }
    }
  }
}`;

const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: {
    authorization: `bearer ${process.env.GITHUB_TOKEN}`,
    "content-type": "application/json",
    "user-agent": "profile-stats",
  },
  body: JSON.stringify({ query, variables: { login } }),
});
if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
const { data, errors } = await res.json();
if (errors) throw new Error(JSON.stringify(errors));

const calendar = data.user.contributionsCollection.contributionCalendar;
const weeks = calendar.weeks;
const days = weeks.flatMap((w) => w.contributionDays);

// The calendar ends today, which may still be empty: that doesn't break a
// streak until the day is over.
let current = 0;
for (let i = days.length - 1; i >= 0; i--) {
  if (days[i].contributionCount > 0) current++;
  else if (i < days.length - 1) break;
}
let longest = 0;
let run = 0;
for (const d of days) {
  run = d.contributionCount > 0 ? run + 1 : 0;
  longest = Math.max(longest, run);
}

const stats = [
  [calendar.totalContributions, "CONTRIBUTIONS"],
  [days.filter((d) => d.contributionCount > 0).length, "ACTIVE DAYS"],
  [current, "CURRENT STREAK"],
  [longest, "LONGEST STREAK"],
];
const updated = new Date()
  .toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
  .toUpperCase();

const LEVELS = [
  "NONE",
  "FIRST_QUARTILE",
  "SECOND_QUARTILE",
  "THIRD_QUARTILE",
  "FOURTH_QUARTILE",
];
// Ramps toward the Palenight keyword purple used across the profile.
const RAMP = {
  dark: ["#171717", "#3a2a4d", "#5e4180", "#9161c4", SYNTAX.keyword],
  light: ["#ededed", "#e4d0fb", "#c4a1f0", "#9b6ad8", "#7c3aed"],
};
const SWEEP = {
  dark: ["#ead7ff", 0.55],
  light: ["#7c3aed", 0.45],
};
const MONTHS = "JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC".split(" ");

function card(t, mode) {
  const W = 840;
  const pad = 28;
  const col = W / stats.length;

  const cells = stats
    .map(([value, label], i) => {
      const cx = col * i + col / 2;
      const divider = i
        ? `<line x1="${col * i}" x2="${col * i}" y1="30" y2="92" stroke="${t.border}"/>`
        : "";
      return `${divider}<g class="rise" style="animation-delay:${i * 0.1}s"><text class="sans" x="${cx}" y="62" font-size="36" font-weight="600" letter-spacing="-1" text-anchor="middle" fill="${t.fg}">${value.toLocaleString("en-US")}</text><text class="mono" x="${cx + 0.8}" y="86" font-size="11" letter-spacing="1.6" text-anchor="middle" fill="${t.subtle}">${label}</text></g>`;
    })
    .join("");

  // Contribution graph: one column per week, Sunday on top, like GitHub's.
  const pitch = (W - pad * 2) / weeks.length;
  const size = Math.floor(pitch * 0.78 * 10) / 10;
  const top = 146;
  const ramp = RAMP[mode];
  let squares = "";
  let mask = "";
  const months = []; // [x, label]
  let lastMonth = -1;
  weeks.forEach((w, x) => {
    const gx = pad + x * pitch;
    const month = new Date(w.contributionDays[0].date).getUTCMonth();
    if (month !== lastMonth) {
      // A month squeezed into the first column or two would collide with the
      // next label; the newer one wins.
      if (months.length && gx - months.at(-1)[0] < 34) months.pop();
      months.push([gx, MONTHS[month]]);
    }
    lastMonth = month;
    for (const d of w.contributionDays) {
      const level = LEVELS.indexOf(d.contributionLevel);
      const y = top + d.weekday * pitch;
      const rect = `x="${gx.toFixed(1)}" y="${y.toFixed(1)}" width="${size}" height="${size}" rx="2.5"`;
      squares += `<rect class="c" ${rect} fill="${ramp[Math.max(0, level)]}" style="animation-delay:${(x * 0.012).toFixed(3)}s"/>`;
      if (level > 0) mask += `<rect ${rect} fill="#fff"/>`;
    }
  });
  const gridW = W - pad * 2;
  const gridBottom = top + 7 * pitch;

  const last = days[days.length - 1];
  const lastX = pad + (weeks.length - 1) * pitch + size / 2;
  const lastY = top + last.weekday * pitch + size / 2;
  const today = `<circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="${size / 2}" fill="none" stroke="${ramp[4]}" stroke-width="1.5"><animate attributeName="r" values="${size / 2};${size * 1.3}" dur="2.4s" repeatCount="indefinite"/><animate attributeName="opacity" values=".8;0" dur="2.4s" repeatCount="indefinite"/></circle>`;

  const legendY = gridBottom + 30;
  const moreW = 30;
  const swatch0 = W - pad - moreW - 5 * (size + 4);
  const legend =
    `<text class="mono" x="${(swatch0 - 6).toFixed(1)}" y="${legendY}" font-size="10" letter-spacing="1" text-anchor="end" fill="${t.subtle}">LESS</text>` +
    ramp
      .map(
        (c, i) =>
          `<rect x="${(swatch0 + i * (size + 4)).toFixed(1)}" y="${(legendY - size + 1).toFixed(1)}" width="${size}" height="${size}" rx="2.5" fill="${c}"/>`,
      )
      .join("") +
    `<text class="mono" x="${W - pad}" y="${legendY}" font-size="10" letter-spacing="1" text-anchor="end" fill="${t.subtle}">MORE</text>`;
  const H = Math.ceil(legendY + 22);

  const [sweepColor, sweepOpacity] = SWEEP[mode];
  const style = `${fontFaces("sans600", "mono400")}${FONT_STACKS}
.rise{animation:rise .9s cubic-bezier(.2,.7,.2,1) both}
@keyframes rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.c{animation:pop .5s cubic-bezier(.2,.7,.2,1) both}
@keyframes pop{from{opacity:0}to{opacity:1}}
.sweep{animation:sweep 9s cubic-bezier(.45,0,.55,1) 1.6s infinite both}
@keyframes sweep{0%{transform:translateX(-160px)}45%,100%{transform:translateX(${gridW + 160}px)}}
@media (prefers-reduced-motion:reduce){.rise,.c,.sweep{animation:none}.sweep{opacity:0}}`;

  const body = `<defs>
<linearGradient id="band" x1="0" x2="1"><stop offset="0" stop-color="${sweepColor}" stop-opacity="0"/><stop offset=".5" stop-color="${sweepColor}" stop-opacity="${sweepOpacity}"/><stop offset="1" stop-color="${sweepColor}" stop-opacity="0"/></linearGradient>
<mask id="active" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">${mask}</mask>
</defs>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="14" fill="${t.surface}" stroke="${t.border}"/>
${cells}
<line x1="${pad}" x2="${W - pad}" y1="112.5" y2="112.5" stroke="${t.border}"/>
${months.map(([x, m]) => `<text class="mono" x="${x.toFixed(1)}" y="${top - 10}" font-size="10" letter-spacing="1" fill="${t.subtle}">${m}</text>`).join("")}
${squares}
<g mask="url(#active)"><rect class="sweep" x="${pad - 160}" y="${top}" width="160" height="${7 * pitch}" fill="url(#band)"/></g>
${today}
<text class="mono" x="${pad}" y="${legendY}" font-size="10" letter-spacing="1.4" fill="${t.subtle}">LAST 12 MONTHS · UPDATED ${updated}</text>
${legend}`;

  return svg({
    width: W,
    height: H,
    label: `Contribution activity, last 12 months: ${stats.map(([v, l]) => `${v} ${l.toLowerCase()}`).join(", ")}`,
    style,
    body,
  });
}

await mkdir(outDir, { recursive: true });
for (const [mode, t] of Object.entries(THEMES)) {
  await writeFile(`${outDir}/activity-${mode}.svg`, card(t, mode));
}
console.log(stats.map(([v, l]) => `${l.toLowerCase()}: ${v}`).join(", "));
