import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const cssDir = path.join(root, "src", "LOOM.Web", "wwwroot", "css");
const jsDir = path.join(root, "src", "LOOM.Web", "wwwroot", "js");
fs.mkdirSync(cssDir, { recursive: true });
fs.mkdirSync(jsDir, { recursive: true });

function extractStyle(html) {
  const m = html.match(/<style>([\s\S]*?)<\/style>/);
  return m ? m[1] : "";
}

function extractLastScript(html) {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  return scripts.length ? scripts[scripts.length - 1][1] : "";
}

function unwrapIife(src) {
  let s = src.trim();
  while (/^\/\*[\s\S]*?\*\//.test(s)) {
    s = s.replace(/^\/\*[\s\S]*?\*\/\s*/, "").trim();
  }
  const start = s.search(/\(function\s*\(\)\s*\{/);
  const end = s.lastIndexOf("})();");
  if (start >= 0 && end > start) {
    const brace = s.indexOf("{", start);
    return s.slice(brace + 1, end).trim();
  }
  return s;
}

function indentBlock(code, spaces = "  ") {
  return code
    .split("\n")
    .map((line) => (line.length ? spaces + line : line))
    .join("\n");
}

const indexHtml = fs.readFileSync(path.join(root, "index_1.html"), "utf8");
const canvasHtml = fs.readFileSync(path.join(root, "canvas_1.html"), "utf8");

const css = extractStyle(indexHtml);
const lines = css.split("\n");

function findLine(substr) {
  const i = lines.findIndex((l) => l.includes(substr));
  if (i < 0) throw new Error("Not found: " + substr);
  return i;
}

const iIntro = findLine("CINEMATIC INTRO");
const iBackdrop = findLine("ANIMATED GRADIENT BACKDROP");
const iNav = findLine("/* ============ NAV ============");
const iHero = findLine("/* ============ HERO ============");
const iCanvasDemo = findLine("CANVAS DEMO");
const iScrollReveal = findLine("SCROLL REVEAL");
const iKeyframes = findLine("KEYFRAMES");
const iResponsive = findLine("RESPONSIVE");
const iIntroSkipped = findLine("When intro is skipped");
const iScrollbar = findLine("Custom scrollbar");

const siteCss = [
  lines.slice(0, iIntro).join("\n"),
  lines.slice(iIntroSkipped, iBackdrop).join("\n"),
  lines.slice(iResponsive).join("\n"),
]
  .map((s) => s.trim())
  .filter(Boolean)
  .join("\n\n")
  .trim() + "\n";

const files = {
  "site.css": siteCss,
  "intro.css": lines.slice(iIntro, iIntroSkipped).join("\n").trim() + "\n",
  "backdrop.css": lines.slice(iBackdrop, iNav).join("\n").trim() + "\n",
  "navigation.css": lines.slice(iNav, iHero).join("\n").trim() + "\n",
  "hero.css": lines.slice(iHero, iCanvasDemo).join("\n").trim() + "\n",
  "canvas-demo.css": lines.slice(iCanvasDemo, iScrollReveal).join("\n").trim() + "\n",
  "sections.css": lines.slice(iScrollReveal, iKeyframes).join("\n").trim() + "\n",
  "animations.css": lines.slice(iKeyframes, iResponsive).join("\n").trim() + "\n",
};

for (const [name, content] of Object.entries(files)) {
  fs.writeFileSync(path.join(cssDir, name), content);
  console.log(name, content.length);
}

const canvasCss = extractStyle(canvasHtml).trim() + "\n";
fs.writeFileSync(path.join(cssDir, "canvas-app.css"), canvasCss);
console.log("canvas-app.css", canvasCss.length);

const headScript = indexHtml.match(/<head>[\s\S]*?<script>\s*([\s\S]*?)\s*<\/script>/)[1].trim();
fs.writeFileSync(
  path.join(jsDir, "theme-init.js"),
  "/**\n * FOUC prevention — apply saved theme before paint.\n */\n" + headScript + "\n"
);
console.log("theme-init.js");

const landingBody = unwrapIife(extractLastScript(indexHtml));
const landingJs = `/**
 * Landing page interactions (intro, nav, canvas demo, scroll reveal).
 */

export function initLanding() {
${indentBlock(landingBody)}
}

export function disposeLanding() {
  /* cleanup listeners if needed */
}
`;
fs.writeFileSync(path.join(jsDir, "landing.js"), landingJs);
console.log("landing.js", landingJs.length);

let canvasBody = unwrapIife(extractLastScript(canvasHtml));
canvasBody = canvasBody.replace(/^['"]use strict['"];\s*/, "");
const canvasEditorJs = `/**
 * LOOM canvas editor — full visual demo app logic.
 */

export function initCanvasEditor() {
  'use strict';
${indentBlock(canvasBody, "  ")}
}
`;
fs.writeFileSync(path.join(jsDir, "canvas-editor.js"), canvasEditorJs);
console.log("canvas-editor.js", canvasEditorJs.length);

console.log("DONE");
