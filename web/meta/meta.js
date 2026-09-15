/* =====================================================================
   meta-design: runtime
   ---------------------------------------------------------------------
   Ties the pieces together:
     MD.mode     day / night / auto           (html[data-mode])
     MD.i18n     dictionaries, plurals, RTL   (html[lang], html[dir])
     MD.skin     framework skins              (html[data-skin])
     MD.state    component states             (data-state="on bad show")
     MD.boot     load prefs, assets, dictionary; then reveal the page

   Preferences live in localStorage (md.mode, md.lang, md.skin) and can
   be forced with ?mode=dark&lang=es&skin=bootstrap on the URL.
   Load order: meta.css, icons.js, graphics.js, packages.js, skins.js,
   then this file. Everything is plain scripts so file:// works.
   ===================================================================== */
(function (MD) {
  const BASE = new URL(".", document.currentScript.src);
  const VER = new URL(document.currentScript.src).searchParams.get("v");   // cache-busting token from the build, passed on to the dictionaries
  const html = document.documentElement;
  const store = {
    get: k => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  };
  const emit = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));
  const loadCss = href => new Promise(res => {
    if (document.querySelector(`link[href="${href}"]`)) return res();
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = href; l.dataset.mdAsset = "1";
    l.onload = res; l.onerror = () => { console.warn("meta-design: could not load", href); res(); };
    document.head.appendChild(l);
  });
  const loadJs = src => new Promise(res => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement("script"); s.src = src; s.dataset.mdAsset = "1";
    s.onload = res; s.onerror = () => { console.warn("meta-design: could not load", src); res(); };
    document.head.appendChild(s);
  });
  const params = new URLSearchParams(location.search);

  // ------------------------------------------------------------- mode
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const mode = {
    pref: "auto",
    effective() { return this.pref === "auto" ? (mq.matches ? "dark" : "light") : this.pref; },
    set(p, persist = true) {
      this.pref = ["light", "dark", "auto"].includes(p) ? p : "auto";
      if (persist) store.set("md.mode", this.pref);
      this.paint();
    },
    paint() {
      const m = this.effective();
      html.dataset.mode = m; html.dataset.modePref = this.pref;
      let meta = document.querySelector('meta[name="theme-color"]');
      if (!meta) { meta = document.createElement("meta"); meta.name = "theme-color"; document.head.appendChild(meta); }
      meta.content = getComputedStyle(html).getPropertyValue("--bg").trim() || (m === "dark" ? "#0F151C" : "#FFFFFF");
      if (skin.current) skin.current.mode(m);
      emit("md:mode", { mode: m, pref: this.pref });
    },
  };
  mq.addEventListener("change", () => { if (mode.pref === "auto") mode.paint(); });

  // ------------------------------------------------------------- i18n
  // Flags are Unicode regional-indicator emoji, so they render everywhere without image files
  // (the Chinese variants use the flag of the region whose written form they follow).
  const LANGS = [
    { code: "en",    flag: "🇬🇧", label: "English",            locale: "en-GB", dir: "ltr" },
    { code: "es",    flag: "🇪🇸", label: "Español",            locale: "es-ES", dir: "ltr" },
    { code: "zh-CN", flag: "🇨🇳", label: "简体中文 · 普通话",   locale: "zh-CN", dir: "ltr" },
    { code: "zh-HK", flag: "🇭🇰", label: "廣東話 · 香港",       locale: "zh-HK", dir: "ltr" },
    { code: "zh-TW", flag: "🇹🇼", label: "繁體中文 · 台灣",     locale: "zh-TW", dir: "ltr" },
    { code: "pl",    flag: "🇵🇱", label: "Polski",             locale: "pl-PL", dir: "ltr" },
    { code: "uk",    flag: "🇺🇦", label: "Українська",         locale: "uk-UA", dir: "ltr" },
    { code: "ar",    flag: "🇸🇦", label: "العربية",            locale: "ar",    dir: "rtl" },
    { code: "ro",    flag: "🇷🇴", label: "Română",             locale: "ro-RO", dir: "ltr" },
  ];
  const DICTS = {};
  const i18n = {
    LANGS, DICTS, lang: "en",
    info(code = this.lang) { return LANGS.find(l => l.code === code) || LANGS[0]; },
    /** The pre-rendered site puts each language at /<code>/ (English at the root); the language
        baked into the page wins over any saved preference. Empty on a raw template (dev). */
    pageLang() { return html.dataset.lang || ""; },
    /** URL of the current page in another language, keeping the query string and hash. */
    pathFor(code) {
      const codes = LANGS.map(l => l.code).sort((a, b) => b.length - a.length);
      let path = location.pathname;
      for (const c of codes) { const m = path.match(new RegExp(`^/${c}(?=/|$)`, "i")); if (m) { path = path.slice(m[0].length) || "/"; break; } }
      if (!path.startsWith("/")) path = "/" + path;
      return (code === "en" ? "" : "/" + code) + path + location.search + location.hash;
    },
    /** Switch language: navigate on the pre-rendered site, swap dictionaries in place otherwise. */
    async go(code, persist = true) {
      if (persist) store.set("md.lang", code);
      if (this.pageLang() && code !== this.pageLang()) { location.href = this.pathFor(code); return; }
      return this.set(code, persist);
    },
    register(code, dict) { DICTS[code] = Object.assign(DICTS[code] || {}, dict); },
    async load(code) {
      if (!DICTS[code]) await loadJs(new URL(`i18n/${code}.js${VER ? "?v=" + VER : ""}`, BASE).href);
      return !!DICTS[code];
    },
    async set(code, persist = true) {
      if (!LANGS.some(l => l.code === code)) code = "en";
      if (!(await this.load(code))) code = "en";
      this.lang = code;
      if (persist) store.set("md.lang", code);
      this.apply();
    },
    plural(n, code = this.lang) {
      try { return new Intl.PluralRules(this.info(code).locale).select(n); } catch { return n === 1 ? "one" : "other"; }
    },
    t(key, o) {
      let v = (DICTS[this.lang] || {})[key];
      if (v == null) v = (DICTS.en || {})[key];
      if (v == null) return null;
      if (typeof v === "object") { const n = o && o.n != null ? Number(o.n) : 0; v = v[this.plural(n)] ?? v.other ?? Object.values(v)[0]; }
      return o ? String(v).replace(/\{(\w+)\}/g, (_, k) => (o[k] != null ? o[k] : `{${k}}`)) : String(v);
    },
    money(n) { return this.t("money", { n }) || `£${n}`; },
    date(d, opts) { return d.toLocaleDateString(this.info().locale, opts); },
    apply(root = document) {
      const L = this.info();
      html.lang = L.locale; html.dir = L.dir;
      const title = this.t("meta.title"); if (title) document.title = title;
      const desc = this.t("meta.description"), md = document.querySelector('meta[name="description"]');
      if (desc && md) md.content = desc;
      root.querySelectorAll("[data-i18n]").forEach(el => { const s = this.t(el.dataset.i18n); if (s != null) el.textContent = s; });
      root.querySelectorAll("[data-i18n-html]").forEach(el => { const s = this.t(el.dataset.i18nHtml); if (s != null) el.innerHTML = s; });
      root.querySelectorAll("[data-i18n-attr]").forEach(el => {
        el.dataset.i18nAttr.split(/[;,]/).forEach(pair => {
          const [attr, key] = pair.split(":").map(x => x.trim()); if (!attr || !key) return;
          const s = this.t(key); if (s != null) el.setAttribute(attr, s);
        });
      });
      if (MD.graphics) MD.graphics.repaint();
      if (MD.packages) MD.packages.repaint();
      document.querySelectorAll("md-switcher").forEach(s => s.paint());
      emit("md:lang", { lang: this.lang });
    },
  };
  MD.t = (k, o) => i18n.t(k, o);
  MD.money = n => i18n.money(n);

  // ------------------------------------------------------------- skin
  const skin = {
    current: null,
    id: "daisy",
    list() { return MD.skins.list(); },
    async use(id) {
      const S = MD.skins.SKINS[id] || MD.skins.SKINS.daisy || MD.skins.SKINS.native;
      this.id = S.id; this.current = S; html.dataset.skin = S.id;
      await Promise.all(S.assets.css.map(loadCss));
      for (const src of S.assets.js) await loadJs(src);
      if (S.assets.afterJs) S.assets.afterJs();
      let st = document.getElementById("md-skin");
      if (!st) { st = document.createElement("style"); st.id = "md-skin"; document.head.appendChild(st); }
      st.textContent = S.style || "";
      // page styles must come after the skin so they can override it
      const page = document.getElementById("page-style"); if (page) document.head.appendChild(page);
      this.decorate(document);
      if (MD.icons) MD.icons.repaint();
      S.mode(mode.effective());
      emit("md:skin", { skin: S.id });
    },
    // Switching frameworks means swapping global resets, so the page reloads
    // with the new preference. Pages can save their state on md:before-reload.
    set(id) {
      if (!MD.skins.SKINS[id] || id === this.id) return;
      store.set("md.skin", id);
      emit("md:before-reload", { skin: id });
      const u = new URL(location.href); u.searchParams.delete("skin"); location.replace(u.href);
    },
    classesFor(el) {
      const S = this.current || MD.skins.SKINS.daisy || MD.skins.SKINS.native;
      const toks = (el.dataset.md || "").trim().split(/\s+/).filter(Boolean);
      const comp = toks[0], variants = toks.slice(1);
      const states = (el.dataset.state || "").trim().split(/\s+/).filter(Boolean);
      const keys = [];
      states.forEach(s => variants.forEach(v => keys.push(`${comp}.${v}.${s}`)));
      states.forEach(s => keys.push(`${comp}.${s}`));
      variants.forEach(v => keys.push(`${comp}.${v}`));
      keys.push(comp);
      const hit = keys.find(k => S.map[k] != null);
      return [...variants, ...states, hit ? S.map[hit] : ""].join(" ");
    },
    apply(el) {
      if (el.dataset.mdBase == null) el.dataset.mdBase = el.className;
      const next = (el.dataset.mdBase + " " + this.classesFor(el)).trim().replace(/\s+/g, " ");
      if (el.className !== next) el.className = next;
    },
    decorate(root) {
      if (root.nodeType === 1 && root.dataset && root.dataset.md != null) this.apply(root);
      root.querySelectorAll && root.querySelectorAll("[data-md]").forEach(el => this.apply(el));
    },
  };

  // states: MD.state(el, "on", true) — the observer re-applies classes
  MD.state = (el, name, on = true) => {
    if (!el) return;
    const set = new Set((el.dataset.state || "").split(/\s+/).filter(Boolean));
    on ? set.add(name) : set.delete(name);
    const v = [...set].join(" ");
    if ((el.dataset.state || "") !== v) { el.dataset.state = v; skin.apply(el); }
  };
  new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === "attributes") { skin.apply(m.target); continue; }
      m.addedNodes.forEach(n => { if (n.nodeType === 1) skin.decorate(n); });
    }
  }).observe(html, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-state", "data-md"] });

  // ------------------------------------------------------------- persistence helper for pages
  MD.persist = {
    save: (k, v) => { try { sessionStorage.setItem("md.page." + k, JSON.stringify(v)); } catch {} },
    take: k => { try { const v = sessionStorage.getItem("md.page." + k); sessionStorage.removeItem("md.page." + k); return v ? JSON.parse(v) : null; } catch { return null; } },
  };

  // ------------------------------------------------------------- switcher
  // <md-switcher controls="mode lang skin"></md-switcher>
  class MdSwitcher extends HTMLElement {
    connectedCallback() { this.paint(); }
    paint() {
      const want = (this.getAttribute("controls") || "mode lang skin").split(/\s+/);
      const t = (k, fb) => i18n.t(k) || fb;
      const ico = n => MD.icons.render(n, "line");
      let h = "";
      if (want.includes("mode")) h += `<div class="md-seg" role="group" aria-label="${t("ui.mode", "Colour mode")}">` +
        [["light", "sun", t("ui.mode.light", "Day")], ["dark", "moon", t("ui.mode.dark", "Night")], ["auto", "auto", t("ui.mode.auto", "Auto")]]
          .map(([v, i, l]) => `<button type="button" data-mode-set="${v}" aria-pressed="${mode.pref === v}" title="${l}" aria-label="${l}">${ico(i)}</button>`).join("") + "</div>";
      if (want.includes("lang")) h += `<label class="md-sel">${ico("globe")}<span class="md-sr">${t("ui.lang", "Language")}</span><select data-lang-set>` +
        LANGS.map(l => `<option value="${l.code}" ${l.code === i18n.lang ? "selected" : ""}>${l.flag ? l.flag + "  " : ""}${l.label}</option>`).join("") + "</select></label>";
      if (want.includes("skin")) h += `<label class="md-sel">${ico("brush")}<span class="md-sr">${t("ui.skin", "Design framework")}</span><select data-skin-set>` +
        skin.list().map(s => `<option value="${s.id}" ${s.id === skin.id ? "selected" : ""}>${s.label}</option>`).join("") + "</select></label>";
      this.className = "md-switcher";
      this.innerHTML = h;
      this.querySelectorAll("[data-mode-set]").forEach(b => b.onclick = () => { mode.set(b.dataset.modeSet); this.paint(); });
      const ls = this.querySelector("[data-lang-set]"); if (ls) ls.onchange = () => i18n.go(ls.value);
      const ss = this.querySelector("[data-skin-set]"); if (ss) ss.onchange = () => skin.set(ss.value);
    }
  }
  if (!customElements.get("md-switcher")) customElements.define("md-switcher", MdSwitcher);

  // <md-langhint></md-langhint>: on a pre-rendered page, a one-line offer to read it in the visitor's own
  // language (saved choice or browser language) when that differs from the page's. Dismissing saves the page's language.
  class MdLangHint extends HTMLElement {
    paint() {
      const page = i18n.pageLang(); if (!page) return;
      const want = store.get("md.lang") || bestLang();
      const L = LANGS.find(l => l.code === want);
      if (!L || want === page || store.get("md.langhint") === page + ":" + want) { this.innerHTML = ""; return; }
      const label = (DICTS[want] && DICTS[want]["ui.lang.hint"]) || (DICTS.en && DICTS.en["ui.lang.hint"]) || "Read this page in {lang}";
      this.className = "md-langhint";
      this.innerHTML = `<a href="${i18n.pathFor(want)}">${L.flag || ""} ${label.replace("{lang}", L.label)}</a><button type="button" aria-label="Dismiss">×</button>`;
      this.querySelector("a").onclick = () => store.set("md.lang", want);
      this.querySelector("button").onclick = () => { store.set("md.langhint", page + ":" + want); store.set("md.lang", page); this.innerHTML = ""; };
    }
  }
  if (!customElements.get("md-langhint")) customElements.define("md-langhint", MdLangHint);

  // ------------------------------------------------------------- header
  // Fixed bar: solid once the page has scrolled a little; a hamburger menu under 56rem.
  function header() {
    const top = document.querySelector(".md-top"), btn = document.querySelector(".md-menu-toggle"), nav = document.querySelector(".md-nav");
    if (!top) return;
    const paint = () => top.classList.toggle("is-scrolled", window.scrollY > 24);
    paint(); addEventListener("scroll", paint, { passive: true });
    if (!btn || !nav) return;
    const setMenu = open => {
      btn.setAttribute("aria-expanded", String(open));
      btn.setAttribute("aria-label", i18n.t(open ? "nav.menu.close" : "nav.menu.open") || (open ? "Close menu" : "Open menu"));
      nav.classList.toggle("is-open", open); top.classList.toggle("menu-open", open); document.body.classList.toggle("menu-open", open);
      if (open) requestAnimationFrame(() => nav.querySelector("a")?.focus());
    };
    btn.addEventListener("click", () => setMenu(btn.getAttribute("aria-expanded") !== "true"));
    nav.querySelectorAll("a").forEach(a => a.addEventListener("click", () => setMenu(false)));
    addEventListener("keydown", e => { if (e.key === "Escape" && btn.getAttribute("aria-expanded") === "true") { setMenu(false); btn.focus(); } });
    matchMedia("(min-width: 56.01rem)").addEventListener("change", e => { if (e.matches) setMenu(false); });
  }

  // ------------------------------------------------------------- boot
  async function boot(opts = {}) {
    const prefMode = params.get("mode") || store.get("md.mode") || opts.mode || "auto";
    const prefLang = i18n.pageLang() || params.get("lang") || store.get("md.lang") || opts.lang || bestLang();
    // ?lang= on a pre-rendered page means "take me to that language's URL"
    if (i18n.pageLang() && params.get("lang") && params.get("lang") !== i18n.pageLang() && LANGS.some(l => l.code === params.get("lang"))) {
      store.set("md.lang", params.get("lang")); params.delete("lang");
      const q = params.toString(); location.replace(i18n.pathFor(store.get("md.lang")).replace(/\?[^#]*/, q ? "?" + q : "")); return new Promise(() => {});
    }
    const prefSkin = params.get("skin") || store.get("md.skin") || opts.skin || "daisy";
    if (params.has("mode")) store.set("md.mode", prefMode);
    if (params.has("lang")) store.set("md.lang", prefLang);
    if (params.has("skin")) store.set("md.skin", prefSkin);

    mode.set(prefMode, false);
    MD.icons.mountDefs();
    header();
    await Promise.all([skin.use(prefSkin), i18n.load("en")]);
    await i18n.set(prefLang, false);
    html.dataset.mdReady = "1";
    document.querySelectorAll("md-langhint").forEach(h => { if (DICTS[store.get("md.lang") || bestLang()]) h.paint(); else i18n.load(store.get("md.lang") || bestLang()).then(() => h.paint()).catch(() => {}); });
    emit("md:ready", {});
  }
  function bestLang() {
    const nav = (navigator.languages || [navigator.language || "en"]).map(s => s.toLowerCase());
    for (const n of nav) {
      if (n.startsWith("zh") || n.startsWith("yue")) return matchZh(n);
      const hit = LANGS.find(l => l.code.toLowerCase() === n || l.code.toLowerCase().split("-")[0] === n.split("-")[0]);
      if (hit) return hit.code;
    }
    return "en";
  }
  function matchZh(n) {
    if (n.includes("hk") || n.includes("yue") || n.includes("mo")) return "zh-HK";
    if (n.includes("tw") || n.includes("hant")) return "zh-TW";
    return "zh-CN";
  }

  Object.assign(MD, { mode, i18n, skin, boot, version: "0.1.0" });
})(window.MD = window.MD || {});
