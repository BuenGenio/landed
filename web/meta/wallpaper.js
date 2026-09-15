/* =====================================================================
   Live wallpaper: five slow, warm, generative scenes cycling behind the page.
   ---------------------------------------------------------------------
   A fixed canvas at z-index -1, rendered at a fraction of the viewport and
   scaled up (which is what makes it soft), drawing one of:
     silk       drifting blurred colour fields, like light through a curtain
     contours   a slowly breathing topographic map in amber on the ground
     motes      dust in a low sun beam
     weave      interference bands, a warm textile shimmer
     dusk       a sunset gradient with cloud bands, on a very slow clock
   Scenes hold for 45 s, then cross-fade over 5 s. Colours are read from the
   page tokens (--bg, --amber, --fog, ...) so day and night modes each get
   their own palette, and the whole thing stays within a few percent of the
   background luminance so text on top stays legible.
   Off switch: localStorage md.wallpaper = "off", or ?wallpaper=off. Reduced
   motion: one still frame, no cycling. Hidden tab: paused.
   ===================================================================== */
(() => {
  const params = new URLSearchParams(location.search);
  let pref = params.get("wallpaper") || (() => { try { return localStorage.getItem("md.wallpaper"); } catch { return null; } })();
  if (params.has("wallpaper")) { try { localStorage.setItem("md.wallpaper", pref); } catch {} }
  if (pref === "off") return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- colour helpers ----
  // read any CSS colour (hex, rgb, oklch from a daisyUI theme, …) by painting it and sampling the pixel
  const px = document.createElement("canvas"); px.width = px.height = 1; const pxc = px.getContext("2d", { willReadFrequently: true });
  const rgb = css => { pxc.clearRect(0, 0, 1, 1); pxc.fillStyle = "#000"; pxc.fillStyle = css; pxc.fillRect(0, 0, 1, 1); const d = pxc.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; };
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const str = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  let P = null;
  function palette() {
    const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
    const dark = document.documentElement.dataset.mode === "dark";
    const bg = rgb(v("--bg") || "#fff"), amber = rgb(v("--amber") || "#F0A030");
    // warm accents that sit close to the background: tints in the day, embers at night
    const k = dark ? 0.24 : 0.22;
    P = { dark, bg,
      warm: [mix(bg, amber, k), mix(bg, rgb(dark ? "#C96A4A" : "#F6C89A"), k * 0.9), mix(bg, rgb(dark ? "#7D5A9E" : "#F2D6C2"), k * 0.8), mix(bg, rgb(dark ? "#E8B65A" : "#FFE8B8"), k)],
      line: mix(bg, amber, dark ? 0.42 : 0.38), glow: mix(bg, amber, dark ? 0.55 : 0.4) };
  }

  // ---- value noise, cheap and smooth ----
  const perm = new Uint8Array(512); { const p = []; for (let i = 0; i < 256; i++) p[i] = i; let s = 1234567; for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) perm[i] = p[i & 255]; }
  const fade = t => t * t * (3 - 2 * t);
  function noise(x, y, z) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255; x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);
    const h = (i, j, k) => perm[perm[perm[X + i] + Y + j] + Z + k] / 255;
    const l = (a, b, t) => a + (b - a) * t;
    return l(l(l(h(0, 0, 0), h(1, 0, 0), u), l(h(0, 1, 0), h(1, 1, 0), u), v), l(l(h(0, 0, 1), h(1, 0, 1), u), l(h(0, 1, 1), h(1, 1, 1), u), v), w);
  }

  // ---- scenes: each draws a full frame into a small canvas ----
  const SCENES = {
    silk(c, w, h, t) {
      const g = c.getContext("2d"); g.fillStyle = str(P.bg); g.fillRect(0, 0, w, h);
      const n = 6;
      for (let i = 0; i < n; i++) {
        const s = i * 1.7, x = w * (0.5 + 0.42 * Math.sin(t * 0.09 + s) * Math.cos(t * 0.05 + s * 0.7)), y = h * (0.5 + 0.42 * Math.cos(t * 0.07 + s * 1.3));
        const r = Math.max(w, h) * (0.35 + 0.12 * Math.sin(t * 0.11 + s));
        const grd = g.createRadialGradient(x, y, 0, x, y, r); const col = P.warm[i % P.warm.length];
        grd.addColorStop(0, str(col, 0.9)); grd.addColorStop(1, str(col, 0));
        g.fillStyle = grd; g.fillRect(0, 0, w, h);
      }
    },
    contours(c, w, h, t) {
      const g = c.getContext("2d"), img = g.createImageData(w, h), d = img.data, bg = P.bg, ln = P.line, fill = P.warm[0];
      const z = t * 0.035, sc = 2.6 / Math.max(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const v = noise(x * sc, y * sc, z) * 0.7 + noise(x * sc * 2.1 + 7, y * sc * 2.1, z * 1.4) * 0.3;
        const f = (v * 9) % 1, band = Math.max(0, 1 - Math.abs(f - 0.5) * 14);   // thin lines every 1/9
        const shade = 0.5 + 0.5 * Math.sin(v * 6.283);                              // gentle terrain shading
        let col = mix(bg, fill, shade); col = mix(col, ln, band * 0.85);
        const o = (y * w + x) * 4; d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    },
    motes: (() => {
      let pts = null;
      return (c, w, h, t) => {
        const g = c.getContext("2d");
        if (!pts || pts.w !== w) { pts = { w, list: Array.from({ length: 48 }, (_, i) => ({ x: Math.random(), y: Math.random(), r: 2 + Math.random() * 4, s: 0.3 + Math.random() * 0.7, p: i })) }; }
        g.fillStyle = str(P.bg); g.fillRect(0, 0, w, h);
        // a low sun beam from the top-left, breathing
        const beam = g.createLinearGradient(0, 0, w, h); const a = P.dark ? 0.5 : 0.55;
        beam.addColorStop(0, str(P.warm[3], a)); beam.addColorStop(0.45 + 0.1 * Math.sin(t * 0.08), str(P.warm[0], a * 0.6)); beam.addColorStop(1, str(P.bg, 0));
        g.fillStyle = beam; g.fillRect(0, 0, w, h);
        for (const m of pts.list) {
          const x = (m.x + 0.012 * Math.sin(t * 0.13 * m.s + m.p)) * w, y = ((m.y - t * 0.004 * m.s) % 1 + 1) % 1 * h;
          const tw = 0.55 + 0.45 * Math.sin(t * 0.9 * m.s + m.p);
          const grd = g.createRadialGradient(x, y, 0, x, y, m.r * 3); grd.addColorStop(0, str(P.glow, 0.32 * tw)); grd.addColorStop(0.4, str(P.glow, 0.12 * tw)); grd.addColorStop(1, str(P.glow, 0));
          g.fillStyle = grd; g.fillRect(x - m.r * 3, y - m.r * 3, m.r * 6, m.r * 6);
        }
      };
    })(),
    weave(c, w, h, t) {
      const g = c.getContext("2d"), img = g.createImageData(w, h), d = img.data, bg = P.bg, A = P.warm[0], B = P.warm[2];
      const k1 = 22 / w, k2 = 19 / h, k3 = 14 / w;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const v = Math.sin(x * k1 + t * 0.21) + Math.sin(y * k2 - t * 0.17) + Math.sin((x + y) * k3 + t * 0.09) + Math.sin(Math.hypot(x - w / 2, y - h / 2) * k1 * 0.5 - t * 0.12);
        const u = v / 8 + 0.5;   // 0..1
        const col = mix(mix(bg, A, u), B, 0.5 + 0.5 * Math.sin(u * 12.566));
        const o = (y * w + x) * 4; d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    },
    dusk(c, w, h, t) {
      const g = c.getContext("2d"), img = g.createImageData(w, h), d = img.data, bg = P.bg;
      const top = P.warm[2], midc = P.warm[0], low = P.warm[3], z = t * 0.02, ph = 0.5 + 0.5 * Math.sin(t * 0.03);
      for (let y = 0; y < h; y++) {
        const f = y / h; const sky = f < 0.5 ? mix(top, midc, f * 2) : mix(midc, low, (f - 0.5) * 2);
        for (let x = 0; x < w; x++) {
          const cl = noise(x / w * 3 + z * 0.6, f * 5 + z, ph) * 0.6 + noise(x / w * 7 + 3, f * 11, z * 2) * 0.4;   // cloud bands
          const col = mix(mix(bg, sky, 0.9), P.warm[1], Math.max(0, cl - 0.42) * 1.6);
          const o = (y * w + x) * 4; d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
        }
      }
      g.putImageData(img, 0, 0);
    },
  };
  const ORDER = ["silk", "contours", "motes", "weave", "dusk"];

  // ---- mount ----
  const HOLD = 45, FADE = 5, FPS = 24;
  const canvas = document.createElement("canvas"); canvas.className = "md-wallpaper"; canvas.setAttribute("aria-hidden", "true");
  const style = document.createElement("style");
  style.textContent = `.md-wallpaper{position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none;display:block}html[data-wallpaper] body{background:transparent!important}`;
  document.head.appendChild(style); document.body.prepend(canvas); document.documentElement.dataset.wallpaper = "on";
  const ctx = canvas.getContext("2d"), A = document.createElement("canvas"), B = document.createElement("canvas");
  let w = 0, h = 0;
  function size() {
    const scale = Math.min(1, 480 / innerWidth);                           // ~480px wide internally, scaled up = soft
    w = Math.max(160, Math.round(innerWidth * scale)); h = Math.max(100, Math.round(innerHeight * scale));
    for (const c of [canvas, A, B]) { c.width = w; c.height = h; }
  }
  let start = Math.random() * 1000, idx = Math.floor(Math.random() * ORDER.length), last = 0, running = false;
  const clock = () => start + performance.now() / 1000;
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    if (now - last < 1000 / FPS) return; last = now;
    if (!P) palette();
    const t = clock(), cycle = HOLD + FADE, phase = t % cycle;
    const cur = ORDER[idx % ORDER.length], nxt = ORDER[(idx + 1) % ORDER.length];
    SCENES[cur](A, w, h, t);
    ctx.globalAlpha = 1; ctx.drawImage(A, 0, 0);
    if (phase > HOLD) { SCENES[nxt](B, w, h, t); ctx.globalAlpha = Math.min(1, (phase - HOLD) / FADE); ctx.drawImage(B, 0, 0); ctx.globalAlpha = 1; }
    if (phase < 0.1 && frame.lastPhase > HOLD) idx++;
    frame.lastPhase = phase;
  }
  frame.lastPhase = 0;
  function play() { if (running || document.hidden) return; running = true; requestAnimationFrame(frame); }
  function stop() { running = false; }
  size(); palette();
  if (reduce) { SCENES[ORDER[idx]](A, w, h, clock()); ctx.drawImage(A, 0, 0); }   // one still frame
  else play();
  addEventListener("resize", () => { size(); if (reduce) { SCENES[ORDER[idx]](A, w, h, clock()); ctx.drawImage(A, 0, 0); } });
  document.addEventListener("visibilitychange", () => document.hidden ? stop() : play());
  document.addEventListener("md:mode", () => { P = null; if (reduce) { palette(); SCENES[ORDER[idx]](A, w, h, clock()); ctx.drawImage(A, 0, 0); } });
  document.addEventListener("md:skin", () => { P = null; });
  window.MD = window.MD || {}; MD.wallpaper = { next() { idx++; start += HOLD + FADE - (clock() % (HOLD + FADE)); }, scenes: ORDER, off() { try { localStorage.setItem("md.wallpaper", "off"); } catch {} location.reload(); } };
})();
