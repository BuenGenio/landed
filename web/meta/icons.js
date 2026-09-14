/* =====================================================================
   meta-design: icons
   ---------------------------------------------------------------------
   One geometry per icon, many styles. Geometry is a 48x48 line drawing
   registered once into a hidden <svg><defs>. A *style* is a renderer
   that instantiates that geometry in a different way:

     line    the plain outline the page was drawn with
     flat    filled shapes on a tinted disc
     3d      extruded parcel-label look in the brand palette
     3d-dpd  the same extrusion in a courier red / navy palette
     emoji   text fallback, no SVG at all (handy for e-mail or plain skins)

   Which style an icon uses is a *declaration*, resolved in this order:
     1. the `variant` attribute on <md-icon>
     2. the CSS custom property --icon-<name> on the element or any ancestor
        e.g.  .step { --icon-box: "3d-dpd"; }
     3. the CSS custom property --icon-style (page/skin default)
   ===================================================================== */
(function (MD) {
  const GEOMETRY = {
    duvet:   { emoji: "🛏️", g: '<rect x="6" y="14" width="36" height="22" rx="7"/><path d="M6 25h36M14 14v-3a4 4 0 0 1 8 0v3"/>' },
    pillow:  { emoji: "🛌", g: '<rect x="7" y="15" width="34" height="18" rx="9"/><path d="M14 20c3 3 3 6 0 9M34 20c-3 3-3 6 0 9"/>' },
    sheet:   { emoji: "🧻", g: '<rect x="8" y="10" width="32" height="28" rx="3"/><path d="M8 30l32-12"/>' },
    towel:   { emoji: "🧖", g: '<rect x="10" y="8" width="28" height="32" rx="4"/><path d="M10 18h28M10 30h28"/>' },
    plate:   { emoji: "🍽️", g: '<circle cx="24" cy="24" r="16"/><circle cx="24" cy="24" r="8"/>' },
    mug:     { emoji: "☕", g: '<rect x="10" y="14" width="22" height="24" rx="3"/><path d="M32 20h4a5 5 0 0 1 0 10h-4"/>' },
    cutlery: { emoji: "🍴", g: '<path d="M14 8v32M14 8v10M10 8v10M18 8v10M10 18c0 3 8 3 8 0M32 8c-4 6-4 14 0 16v16"/>' },
    pan:     { emoji: "🍳", g: '<circle cx="20" cy="26" r="13"/><path d="M33 22l10-6"/>' },
    kettle:  { emoji: "🫖", g: '<path d="M12 20h22l-3 20H15z"/><path d="M34 22l6-6M16 20a8 8 0 0 1 14 0"/>' },
    board:   { emoji: "🔪", g: '<rect x="8" y="12" width="32" height="24" rx="4"/><path d="M14 18l12 12M28 18l-4 4"/>' },
    plug:    { emoji: "🔌", g: '<rect x="8" y="12" width="32" height="24" rx="5"/><path d="M24 18v6M17 26v4M31 26v4"/>' },
    bag:     { emoji: "🧺", g: '<path d="M12 18h24l2 22H10z"/><path d="M12 18c0-6 24-6 24 0"/>' },
    bottle:  { emoji: "🔥", g: '<rect x="10" y="18" width="24" height="22" rx="9"/><path d="M34 26h5M34 32h5M22 18V9h4"/>' },
    thermal: { emoji: "👕", g: '<path d="M17 10l7 3 7-3 8 6-5 6-3-2v20H17V20l-3 2-5-6z"/>' },
    socks:   { emoji: "🧦", g: '<path d="M18 8h12v16l8 8-6 8-14-10z"/><path d="M18 14h12"/>' },
    beanie:  { emoji: "🧢", g: '<path d="M10 34a14 14 0 0 1 28 0z"/><rect x="8" y="34" width="32" height="6" rx="3"/><circle cx="24" cy="12" r="4"/>' },
    vitamin: { emoji: "💊", g: '<rect x="14" y="14" width="20" height="26" rx="4"/><rect x="17" y="8" width="14" height="6" rx="2"/><path d="M20 28h8"/>' },
    mask:    { emoji: "😴", g: '<path d="M6 22c4-8 12-8 18-4 6-4 14-4 18 4-2 10-10 12-18 6-8 6-16 4-18-6z"/>' },
    tea:     { emoji: "🍵", g: '<rect x="12" y="20" width="20" height="18" rx="3"/><path d="M22 20V8l10 4"/>' },
    rowie:   { emoji: "🥐", g: '<ellipse cx="24" cy="26" rx="16" ry="10"/><path d="M14 22c4 2 16 2 20 0M18 30h2M28 30h2"/>' },
    lamp:    { emoji: "💡", g: '<path d="M14 10h20l6 14H8z"/><path d="M24 24v14M14 38h20"/>' },
    rack:    { emoji: "👚", g: '<path d="M8 40l8-28h16l8 28M12 26h24M14 32h20"/>' },
    topper:  { emoji: "🛏️", g: '<rect x="6" y="18" width="36" height="12" rx="6"/><path d="M12 24h4M22 24h4M32 24h4"/>' },
    box:     { emoji: "📦", g: '<path d="M8 18l16-8 16 8-16 8z"/><path d="M8 18v14l16 8 16-8V18M24 26v14"/>' },
    chat:    { emoji: "💬", g: '<path d="M8 12h32v20H22l-8 7v-7H8z"/><path d="M16 22h16"/>' },
    mix:     { emoji: "🧩", g: '<rect x="8" y="8" width="14" height="14" rx="3"/><rect x="26" y="8" width="14" height="14" rx="3"/><rect x="8" y="26" width="14" height="14" rx="3"/><path d="M28 33l4 4 8-9"/>' },
    key:     { emoji: "🔑", g: '<circle cx="16" cy="24" r="8"/><path d="M24 24h16M34 24v6M39 24v4"/>' },
    // switcher glyphs
    sun:     { emoji: "☀️", g: '<circle cx="24" cy="24" r="8"/><path d="M24 6v6M24 36v6M6 24h6M36 24h6M11 11l4 4M33 33l4 4M11 37l4-4M33 15l4-4"/>' },
    moon:    { emoji: "🌙", g: '<path d="M30 8a16 16 0 1 0 10 28A14 14 0 0 1 30 8z"/>' },
    auto:    { emoji: "🌗", g: '<circle cx="24" cy="24" r="16"/><path d="M24 8v32M24 8a16 16 0 0 1 0 32z"/>' },
    globe:   { emoji: "🌐", g: '<circle cx="24" cy="24" r="16"/><path d="M8 24h32M24 8c6 6 6 26 0 32M24 8c-6 6-6 26 0 32"/>' },
    brush:   { emoji: "🎨", g: '<path d="M36 8l4 4-18 18-4-4zM18 26l4 4c-2 8-8 8-14 8 4-4 2-10 10-12z"/>' },
    card:    { emoji: "💳", g: '<rect x="6" y="12" width="36" height="24" rx="4"/><path d="M6 20h36M12 30h8"/>' },
  };

  const PALETTES = {
    "3d":     { fill: "var(--icon-fill)", top: "var(--icon-fill-2)", depth: "var(--icon-depth)", stroke: "var(--icon-stroke)", shadow: "var(--icon-shadow)" },
    "3d-dpd": { fill: "#DC0032", top: "#FF5C7A", depth: "#7A0020", stroke: "#1E1E3C", shadow: "rgba(30,30,60,.35)" },
  };

  // ---- renderers ---------------------------------------------------
  const svgOpen = (cls, extra = "") =>
    `<svg viewBox="0 0 48 48" class="md-ico ${cls}" aria-hidden="true" focusable="false" ${extra}>`;

  const STYLES = {
    line(name) {
      return svgOpen("md-ico--line") +
        `<use href="#i-${name}" fill="none" stroke="var(--icon-stroke)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    },
    flat(name) {
      return svgOpen("md-ico--flat") +
        `<circle cx="24" cy="24" r="23" fill="var(--icon-fill-2)"/>` +
        `<use href="#i-${name}" style="--md-shape-fill: var(--icon-fill)" fill="none" stroke="var(--icon-stroke)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    },
    "3d"(name, pal = PALETTES["3d"]) {
      const dark = pal.depth, layers = [];
      // extrusion: stack of offset copies down and to the right
      for (let i = 3; i >= 1; i--) {
        layers.push(`<use href="#i-${name}" transform="translate(${i} ${i})" style="--md-shape-fill:${dark};--md-path-fill:${dark}" fill="none" stroke="${dark}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`);
      }
      return svgOpen("md-ico--3d") +
        `<ellipse cx="26" cy="44" rx="18" ry="3.5" fill="${pal.shadow}"/>` +
        layers.join("") +
        `<use href="#i-${name}" style="--md-shape-fill:${pal.fill};--md-path-fill:${pal.fill}" fill="none" stroke="${pal.stroke}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>` +
        `<use href="#i-${name}" transform="translate(-1 -1) scale(.98)" style="--md-shape-fill:${pal.top};--md-path-fill:${pal.top}" fill="none" stroke="none" opacity=".35"/>` +
        `</svg>`;
    },
    "3d-dpd"(name) { return STYLES["3d"](name, PALETTES["3d-dpd"]); },
    emoji(name) {
      const e = (GEOMETRY[name] || {}).emoji || "•";
      return `<span class="md-ico md-ico--emoji" aria-hidden="true" style="font-size:.9em;line-height:1">${e}</span>`;
    },
  };
  STYLES["3d-dpd-style"] = STYLES["3d-dpd"];
  STYLES["3D-dpd-style"] = STYLES["3d-dpd"];

  // ---- registry ----------------------------------------------------
  function mountDefs() {
    if (document.getElementById("md-icon-defs")) return;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.id = "md-icon-defs";
    svg.setAttribute("width", "0"); svg.setAttribute("height", "0");
    svg.setAttribute("style", "position:absolute"); svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = "<defs>" + Object.entries(GEOMETRY).map(([k, v]) => `<g id="i-${k}">${v.g}</g>`).join("") + "</defs>";
    document.body.prepend(svg);
  }

  function normaliseStyle(s) {
    s = String(s || "").trim().replace(/^["']|["']$/g, "").toLowerCase();
    if (s.endsWith("-style")) s = s.slice(0, -6);
    return STYLES[s] ? s : "";
  }

  // Resolve the style declared for an icon on a given element via CSS custom properties.
  function declaredStyle(el, name) {
    const cs = getComputedStyle(el);
    return normaliseStyle(cs.getPropertyValue("--icon-" + name)) || normaliseStyle(cs.getPropertyValue("--icon-style")) || "line";
  }

  function render(name, style) {
    if (!GEOMETRY[name]) name = "box";
    const fn = STYLES[normaliseStyle(style) || "line"];
    return fn(name);
  }

  // <md-icon name="box" variant="3d-dpd" size="l"></md-icon>
  class MdIcon extends HTMLElement {
    static get observedAttributes() { return ["name", "variant"]; }
    connectedCallback() { this.paint(); }
    attributeChangedCallback() { if (this.isConnected) this.paint(); }
    paint() {
      const name = this.getAttribute("name") || "box";
      const style = normaliseStyle(this.getAttribute("variant")) || declaredStyle(this, name);
      if (this.dataset.painted === name + "|" + style) return;
      this.dataset.painted = name + "|" + style;
      this.innerHTML = render(name, style);
    }
  }
  if (!customElements.get("md-icon")) customElements.define("md-icon", MdIcon);

  MD.icons = {
    GEOMETRY, STYLES, PALETTES, mountDefs, render, declaredStyle, normaliseStyle,
    names: () => Object.keys(GEOMETRY),
    styles: () => ["line", "flat", "3d", "3d-dpd", "emoji"],
    // string helper for templates: MD.icons.tag("box", {size:"m"})
    tag: (name, o = {}) => `<md-icon name="${name}"${o.variant ? ` variant="${o.variant}"` : ""}${o.size ? ` size="${o.size}"` : ""}${o.cls ? ` class="${o.cls}"` : ""}></md-icon>`,
    register: (name, geometry, emoji = "•") => { GEOMETRY[name] = { g: geometry, emoji }; const d = document.querySelector("#md-icon-defs defs"); if (d) d.insertAdjacentHTML("beforeend", `<g id="i-${name}">${geometry}</g>`); },
    // repaint every icon on the page (after a skin or declaration change)
    repaint: () => document.querySelectorAll("md-icon").forEach(i => { delete i.dataset.painted; i.paint(); }),
  };
})(window.MD = window.MD || {});
