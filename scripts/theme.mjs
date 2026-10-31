// Shared by build.mjs and stats.mjs. No dependencies, so the daily workflow
// runs stats.mjs without an npm install: the fonts come pre-subset in fonts.json.
import { readFileSync } from "node:fs";

// Colors follow eon1x.vercel.app: neutral scale on #0a0a0a, Palenight syntax.
export const THEMES = {
  dark: {
    bg: "#0a0a0a",
    surface: "#0d0d0d",
    raised: "#171717",
    border: "#262626",
    fg: "#ededed",
    muted: "#a3a3a3",
    subtle: "#737373",
    grid: "#1f1f1f",
    glowA: 0.13,
    glowB: 0.08,
  },
  light: {
    bg: "#fafafa",
    surface: "#ffffff",
    raised: "#f5f5f5",
    border: "#e5e5e5",
    fg: "#0a0a0a",
    muted: "#525252",
    subtle: "#737373",
    grid: "#e5e5e5",
    glowA: 0.22,
    glowB: 0.14,
  },
};

export const SYNTAX = {
  keyword: "#c792ea",
  name: "#82aaff",
  key: "#f07178",
  string: "#c3e88d",
  number: "#f78c6c",
  punct: "#a3a3a3",
  cursor: "#d4d4d4",
};

export const TRAFFIC = ["#ff5f57", "#febc2e", "#28c840"];

let fonts;
export function fontFaces(...keys) {
  fonts ??= JSON.parse(
    readFileSync(new URL("./fonts.json", import.meta.url), "utf8"),
  );
  return keys
    .map((k) => {
      const f = fonts[k];
      return `@font-face{font-family:'${f.family}';font-weight:${f.weight};src:url(data:font/woff2;base64,${f.data}) format('woff2')}`;
    })
    .join("");
}

export const FONT_STACKS = `.sans{font-family:'Geist',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif}.mono{font-family:'Geist Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}`;

export const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function svg({ width, height, label, style, body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title><style>${style}</style>${body}</svg>\n`;
}
