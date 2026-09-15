// Cuts the icon masters in assets/icons/<theme>/ down to 256px WebP in web/img/icons/<theme>/,
// trimming transparent margins so every icon fills its box the same way.
//
// Themes:  assets/icons/photorealistic-icons/icons/*.png   → web/img/icons/photorealistic/<id>.webp
//          assets/icons/skeuomorphic/*.png                 → web/img/icons/skeuomorphic/<id>.webp
// A theme folder may carry a names.json mapping source filenames to catalogue icon ids
// (one id or a list of ids); without it the filename is the id.
//
//   node scripts/photo-icons-webp.cjs             # every theme
//   node scripts/photo-icons-webp.cjs skeuomorphic
const fs = require("fs"), path = require("path"), sharp = require("sharp");
const ROOT = path.join(__dirname, "..");
const THEMES = {
  photorealistic: path.join(ROOT, "assets", "icons", "photorealistic-icons"),
  skeuomorphic: path.join(ROOT, "assets", "icons", "skeuomorphic"),
};
const only = process.argv.slice(2);

async function cut(src, dest) {
  const trimmed = await sharp(src).trim({ threshold: 8 }).toBuffer();
  await sharp(trimmed).resize(232, 232, { fit: "inside" })
    .extend({ top: 12, bottom: 12, left: 12, right: 12, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 85, alphaQuality: 90 }).toFile(dest);
}

(async () => {
  for (const [theme, dir] of Object.entries(THEMES)) {
    if (only.length && !only.includes(theme)) continue;
    const srcDir = fs.existsSync(path.join(dir, "icons")) ? path.join(dir, "icons") : dir;
    const namesFile = path.join(dir, "names.json");
    const names = fs.existsSync(namesFile) ? JSON.parse(fs.readFileSync(namesFile, "utf8")) : {};
    const out = path.join(ROOT, "web", "img", "icons", theme);
    fs.mkdirSync(out, { recursive: true });
    let n = 0;
    for (const f of fs.readdirSync(srcDir).filter(f => f.endsWith(".png"))) {
      const base = f.replace(/\.png$/, "");
      const ids = [].concat(names[base] || base);
      for (const id of ids) { await cut(path.join(srcDir, f), path.join(out, id + ".webp")); n++; }
    }
    console.log(`${theme}: ${n} icons → web/img/icons/${theme}/`);
  }
})();
