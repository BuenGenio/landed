// Cuts the hero masters in assets/hero/<id>.png to web/img/hero/<id>-1536.webp and <id>-768.webp (3:2),
// plus a tiny blurred 24px placeholder embedded by the page while the slide loads.
const fs = require("fs"), path = require("path"), sharp = require("sharp");
const src = path.join(__dirname, "..", "assets", "hero"), out = path.join(__dirname, "..", "web", "img", "hero");
fs.mkdirSync(out, { recursive: true });
(async () => {
  const lqip = {};
  for (const f of fs.readdirSync(src).filter(f => f.endsWith(".png")).sort()) {
    const id = f.replace(/\.png$/, ""), img = sharp(path.join(src, f));
    await img.clone().resize(1536, 1024, { fit: "cover" }).webp({ quality: 78 }).toFile(path.join(out, `${id}-1536.webp`));
    await img.clone().resize(768, 512, { fit: "cover" }).webp({ quality: 74 }).toFile(path.join(out, `${id}-768.webp`));
    lqip[id] = "data:image/webp;base64," + (await img.clone().resize(24, 16, { fit: "cover" }).blur(1).webp({ quality: 40 }).toBuffer()).toString("base64");
    console.log("webp", id);
  }
  fs.writeFileSync(path.join(out, "lqip.json"), JSON.stringify(lqip));
})();
