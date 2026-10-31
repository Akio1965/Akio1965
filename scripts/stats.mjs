// Contribution stats card for the profile README, from the public contribution
// calendar (private contributions count once "Include private contributions"
// is on). Runs daily in .github/workflows/profile.yml.
// Usage: GITHUB_TOKEN=… node scripts/stats.mjs [outDir] [login]
import { mkdir, writeFile } from "node:fs/promises";
import { FONT_STACKS, THEMES, esc, fontFaces, svg } from "./theme.mjs";

const outDir = process.argv[2] ?? "dist";
const login =
  process.argv[3] ?? process.env.GITHUB_REPOSITORY_OWNER ?? "Akio1965";

const query = `query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
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
const days = calendar.weeks.flatMap((w) => w.contributionDays);

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
  .toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
  .toUpperCase();

function card(t) {
  const W = 840;
  const H = 150;
  const col = W / stats.length;
  const cells = stats
    .map(([value, label], i) => {
      const cx = col * i + col / 2;
      const divider = i
        ? `<line x1="${col * i}" x2="${col * i}" y1="34" y2="104" stroke="${t.border}"/>`
        : "";
      return `${divider}<g class="rise" style="animation-delay:${i * 0.1}s"><text class="sans" x="${cx}" y="70" font-size="36" font-weight="600" letter-spacing="-1" text-anchor="middle" fill="${t.fg}">${value.toLocaleString("en-US")}</text><text class="mono" x="${cx + 0.8}" y="96" font-size="11" letter-spacing="1.6" text-anchor="middle" fill="${t.subtle}">${label}</text></g>`;
    })
    .join("");
  const style = `${fontFaces("sans600", "mono400")}${FONT_STACKS}
.rise{animation:rise .9s cubic-bezier(.2,.7,.2,1) both}
@keyframes rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.rise{animation:none}}`;
  const body = `<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="14" fill="${t.surface}" stroke="${t.border}"/>${cells}
<text class="mono" x="${W / 2}" y="${H - 18}" font-size="10" letter-spacing="1.4" text-anchor="middle" fill="${t.subtle}" opacity=".7">LAST 12 MONTHS · UPDATED ${esc(updated)}</text>`;
  return svg({
    width: W,
    height: H,
    label: stats.map(([v, l]) => `${v} ${l.toLowerCase()}`).join(", "),
    style,
    body,
  });
}

await mkdir(outDir, { recursive: true });
for (const [mode, t] of Object.entries(THEMES)) {
  await writeFile(`${outDir}/stats-${mode}.svg`, card(t));
}
console.log(stats.map(([v, l]) => `${l.toLowerCase()}: ${v}`).join(", "));
