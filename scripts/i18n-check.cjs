// Checks every dictionary in web/meta/i18n has the same keys and placeholders as en.js.
// Usage: npm run i18n
global.MD = { i18n: { register: (c, d) => { D[c] = d; } } }; const D = {};
const fs = require("fs"), path = require("path"), dir = path.join(__dirname, "..", "web", "meta", "i18n");
for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".js"))) require(path.join(dir, f));
const en = Object.keys(D.en).sort(); let bad = 0;
for (const [c, d] of Object.entries(D)) {
  const k = Object.keys(d), miss = en.filter(x => !k.includes(x)), extra = k.filter(x => !en.includes(x));
  const ph = en.filter(x => typeof D.en[x] === "string" && typeof d[x] === "string" && [...D.en[x].matchAll(/\{(\w+)\}/g)].some(m => !d[x].includes(m[0])));
  if (miss.length || extra.length || ph.length) bad++;
  console.log(`${c.padEnd(6)} ${k.length} keys  missing: ${miss.join(",") || "-"}  extra: ${extra.join(",") || "-"}  placeholders: ${ph.join(",") || "-"}`);
}
process.exit(bad ? 1 : 0);
