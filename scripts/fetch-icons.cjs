#!/usr/bin/env node
/* Regenerates the GEOMETRY block in web/meta/icons.js from openly licensed icon
   sets, fetched through the Iconify API and rescaled to the page's 48x48 grid.

     npm run icons   (node scripts/fetch-icons.cjs)

   Every icon keeps its stroke-only geometry so the page's renderers (line, flat,
   3d, 3d-dpd, emoji) keep working unchanged: presentation attributes are stripped
   and the <use> element supplies stroke, width and caps.

   Sets and licences (notices reproduced in the icons.js header):
     hugeicons   Hugeicons stroke-rounded   MIT        https://hugeicons.com
     tabler      Tabler Icons               MIT        https://tabler.io/icons
     streamline  Streamline Core (free)     CC BY 4.0  https://streamlinehq.com
*/
const fs = require("fs");
const path = require("path");
const https = require("https");

const ICONS = {
  duvet:   { emoji: "🛏️", src: "hugeicons:bed-single-01" },
  pillow:  { emoji: "🛌", src: "tabler:pillow" },
  sheet:   { emoji: "🧻", src: "hugeicons:bed-double" },
  towel:   { emoji: "🧖", src: "hugeicons:towels" },
  plate:   { emoji: "🍽️", src: "hugeicons:plate" },
  mug:     { emoji: "☕", src: "hugeicons:coffee-02" },
  cutlery: { emoji: "🍴", src: "hugeicons:spoon-and-fork" },
  pan:     { emoji: "🍳", src: "hugeicons:pan-01" },
  kettle:  { emoji: "🫖", src: "hugeicons:kettle-01" },
  board:   { emoji: "🔪", src: "hugeicons:knife-01" },
  plug:    { emoji: "🔌", src: "hugeicons:plug-01" },
  bag:     { emoji: "🧺", src: "hugeicons:shopping-bag-02" },
  bottle:  { emoji: "🔥", src: "hugeicons:fire" },
  thermal: { emoji: "👕", src: "hugeicons:long-sleeve-shirt" },
  socks:   { emoji: "🧦", src: "hugeicons:socks" },
  beanie:  { emoji: "🧢", src: "streamline:beanie" },
  vitamin: { emoji: "💊", src: "hugeicons:pill" },
  mask:    { emoji: "😴", src: "hugeicons:sleeping" },
  tea:     { emoji: "🍵", src: "hugeicons:tea" },
  rowie:   { emoji: "🥐", src: "hugeicons:croissant" },
  lamp:    { emoji: "💡", src: "hugeicons:lamp-desk" },
  rack:    { emoji: "👚", src: "hugeicons:hanger" },
  topper:  { emoji: "🛏️", src: "hugeicons:bed" },
  box:     { emoji: "📦", src: "hugeicons:package" },
  chat:    { emoji: "💬", src: "hugeicons:bubble-chat" },
  mix:     { emoji: "🧩", src: "hugeicons:puzzle" },
  key:     { emoji: "🔑", src: "hugeicons:key-01" },
  // switcher glyphs
  sun:     { emoji: "☀️", src: "hugeicons:sun-03" },
  moon:    { emoji: "🌙", src: "hugeicons:moon-02" },
  auto:    { emoji: "🌗", src: "hugeicons:contrast" },
  globe:   { emoji: "🌐", src: "hugeicons:globe-02" },
  brush:   { emoji: "🎨", src: "hugeicons:paint-board" },
  card:    { emoji: "💳", src: "hugeicons:credit-card" },
};

const GRID = 48;
const TARGET = path.join(__dirname, "..", "web", "meta", "icons.js");

// Names used only by the "photo" style (composite kit-card renders from
// scripts/gen-photo-icons.sh), aliased to an existing icon's line geometry so every
// other style (line/flat/3d/3d-dpd/emoji) still has something sensible to draw.
const ALIASES = {
  "kit-arrival": "duvet",
  "kit-winter": "bottle",
  "kit-both": "box",
  "kit-mix": "mix",
};

const get = url => new Promise((res, rej) => https.get(url, r => {
  let b = ""; r.on("data", d => b += d); r.on("end", () => r.statusCode === 200 ? res(b) : rej(new Error(`${r.statusCode} ${url}`)));
}).on("error", rej));

const num = v => { const s = (Math.round(v * 100) / 100).toString(); return s.replace(/^(-?)0\./, "$1."); };

// Multiply every coordinate in a path by k; arc rotation and flags stay as they are.
function scalePath(d, k) {
  const argc = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) || [];
  let out = "", cmd = "", i = 0;
  for (const t of tokens) {
    if (/[a-zA-Z]/.test(t)) { cmd = t; i = 0; out += t; continue; }
    const n = argc[cmd.toUpperCase()] || 2, slot = i % n;
    let v = parseFloat(t);
    const keep = cmd.toUpperCase() === "A" && slot >= 2 && slot <= 4;
    if (!keep) v *= k;
    const s = keep ? String(v) : num(v);
    out += (/[\d.]$/.test(out) && !s.startsWith("-") ? " " : "") + s;
    i++;
  }
  return out;
}

const SCALED_ATTRS = ["cx", "cy", "r", "rx", "ry", "x", "y", "width", "height", "x1", "y1", "x2", "y2"];
const DROP_ATTRS = ["fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "color", "opacity", "fill-opacity", "stroke-opacity"];

function toGrid(body, size) {
  const k = GRID / size;
  body = body.replace(/\sd="([^"]*)"/g, (_, d) => ` d="${scalePath(d, k)}"`);
  for (const a of SCALED_ATTRS) body = body.replace(new RegExp(`\\s${a}="(-?[\\d.]+)"`, "g"), (_, v) => ` ${a}="${num(parseFloat(v) * k)}"`);
  for (const a of DROP_ATTRS) body = body.replace(new RegExp(`\\s${a}="[^"]*"`, "g"), "");
  body = body.replace(/<g>\s*<\/g>/g, "").replace(/<g>([\s\S]*?)<\/g>/g, "$1");
  if (/<(use|image|text|style)/.test(body)) throw new Error("unsupported element in " + body.slice(0, 60));
  return body.trim();
}

(async () => {
  const bySet = {};
  for (const [name, { src }] of Object.entries(ICONS)) {
    const [set, icon] = src.split(":");
    (bySet[set] ||= []).push([name, icon]);
  }
  const bodies = {};
  for (const [set, list] of Object.entries(bySet)) {
    const data = JSON.parse(await get(`https://api.iconify.design/${set}.json?icons=${list.map(l => l[1]).join(",")}`));
    if (data.not_found?.length) throw new Error(`${set}: not found ${data.not_found.join(", ")}`);
    for (const [name, icon] of list) {
      const ic = data.icons[icon];
      const w = ic.width || data.width, h = ic.height || data.height;
      if (w !== h) throw new Error(`${set}:${icon} is ${w}x${h}, expected square`);
      bodies[name] = toGrid(ic.body, w);
    }
  }

  const all = { ...ICONS };
  for (const [alias, of] of Object.entries(ALIASES)) {
    bodies[alias] = bodies[of];
    all[alias] = { emoji: ICONS[of].emoji, src: `alias:${of}` };
  }

  const key = name => /^[a-zA-Z_$][\w$]*$/.test(name) ? name : JSON.stringify(name);
  const pad = Math.max(...Object.keys(all).map(k => (key(k) + ":").length)) + 1;
  const lines = Object.entries(all).map(([name, { emoji, src }]) =>
    `    ${(key(name) + ":").padEnd(pad)} { emoji: "${emoji}", src: "${src}", g: '${bodies[name]}' },`);
  const block = `  const GEOMETRY = {\n${lines.join("\n")}\n  };`;

  let js = fs.readFileSync(TARGET, "utf8");
  const re = /  const GEOMETRY = \{[\s\S]*?\n  \};/;
  if (!re.test(js)) throw new Error("GEOMETRY block not found in " + TARGET);
  js = js.replace(re, () => block);
  fs.writeFileSync(TARGET, js);
  console.log(`wrote ${Object.keys(ICONS).length} icons to ${path.relative(process.cwd(), TARGET)}`);
})().catch(e => { console.error(e.message); process.exit(1); });
