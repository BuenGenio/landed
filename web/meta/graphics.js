/* =====================================================================
   meta-design: graphics
   ---------------------------------------------------------------------
   Larger illustrations declared as <md-graphic name="room" state="arrival winter">.
   Every colour is a token (--g-*), so the same drawing follows the
   light/dark mode and any skin that re-declares the tokens. Text inside
   a graphic is translated through MD.t when a dictionary is loaded.
   ===================================================================== */
(function (MD) {
  const t = (k, fb) => (MD.t ? MD.t(k) : fb) || fb;

  const GRAPHICS = {
    room: () => `
<svg viewBox="0 0 480 320" role="img" aria-label="${t("room.aria", "A halls room in Aberdeen with the kit unpacked")}">
  <rect width="480" height="240" fill="var(--g-wall)"/>
  <rect y="240" width="480" height="80" fill="var(--g-floor)"/>
  <rect y="236" width="480" height="6" fill="var(--g-skirt)"/>
  <rect x="292" y="28" width="150" height="116" rx="6" fill="var(--g-paper)" stroke="var(--g-line)" stroke-width="6"/>
  <clipPath id="md-win"><rect x="298" y="34" width="138" height="104"/></clipPath>
  <g clip-path="url(#md-win)">
    <rect x="298" y="34" width="138" height="104" fill="var(--g-night)"/>
    <g fill="var(--g-night-deep)"><rect x="298" y="92" width="26" height="46"/><rect x="324" y="78" width="20" height="60"/><rect x="344" y="100" width="30" height="38"/><rect x="374" y="70" width="24" height="68"/><rect x="398" y="96" width="38" height="42"/></g>
    <g fill="var(--amber)"><rect x="304" y="100" width="5" height="6"/><rect x="330" y="86" width="5" height="6"/><rect x="380" y="80" width="5" height="6"/><rect x="380" y="96" width="5" height="6"/><rect x="408" y="106" width="5" height="6"/><rect x="350" y="110" width="5" height="6"/></g>
    <g stroke="#FFFFFF" stroke-opacity=".35" stroke-width="2" stroke-linecap="round"><path d="M310 40l-6 14M340 46l-6 14M370 38l-6 14M400 50l-6 14M424 40l-6 14M325 66l-6 14M355 62l-6 14M386 70l-6 14M412 74l-6 14"/></g>
    <g class="g-winter" fill="#FFFFFF"><circle cx="306" cy="48" r="2.5"/><circle cx="336" cy="40" r="2"/><circle cx="360" cy="56" r="2.5"/><circle cx="392" cy="44" r="2"/><circle cx="420" cy="60" r="2.5"/><circle cx="318" cy="76" r="2"/><circle cx="378" cy="74" r="2.5"/><circle cx="428" cy="88" r="2"/></g>
  </g>
  <path d="M367 34v104" stroke="var(--g-line)" stroke-width="4"/>
  <rect x="300" y="154" width="134" height="40" rx="6" fill="var(--g-paper)" stroke="var(--g-skirt)" stroke-width="3"/>
  <g stroke="var(--g-floor)" stroke-width="3"><path d="M314 158v32M330 158v32M346 158v32M362 158v32M378 158v32M394 158v32M410 158v32M426 158v32"/></g>
  <g class="g-winter"><path d="M318 152v22l-4 4h12l-4-4v-22" fill="var(--amber)" stroke="var(--g-line)" stroke-width="2" stroke-linejoin="round"/><path d="M340 152v22l-4 4h12l-4-4v-22" fill="var(--amber)" stroke="var(--g-line)" stroke-width="2" stroke-linejoin="round"/></g>
  <rect x="30" y="112" width="16" height="150" rx="4" fill="var(--g-wood)"/>
  <rect x="46" y="214" width="214" height="12" fill="var(--g-wood)"/>
  <rect x="52" y="226" width="12" height="36" fill="var(--g-wood)"/><rect x="242" y="226" width="12" height="36" fill="var(--g-wood)"/>
  <rect x="46" y="184" width="214" height="32" rx="4" fill="var(--g-skirt)"/>
  <g class="g-base"><rect x="46" y="176" width="214" height="40" rx="8" fill="var(--g-cloth)" stroke="var(--g-skirt)" stroke-width="2"/><rect x="50" y="160" width="60" height="22" rx="8" fill="var(--g-cloth-2)" stroke="var(--g-skirt)" stroke-width="2"/></g>
  <g class="g-arrival">
    <rect x="46" y="172" width="214" height="44" rx="9" fill="var(--g-paper)" stroke="var(--g-floor)" stroke-width="2"/>
    <rect x="46" y="194" width="214" height="14" fill="var(--amber)"/>
    <path d="M46 172c40 6 174 6 214 0" fill="none" stroke="var(--g-floor)" stroke-width="2"/>
    <rect x="50" y="150" width="68" height="26" rx="10" fill="var(--g-paper)" stroke="var(--g-floor)" stroke-width="2"/>
    <rect x="62" y="142" width="68" height="26" rx="10" fill="var(--g-paper)" stroke="var(--g-floor)" stroke-width="2"/>
  </g>
  <g class="g-winter">
    <rect x="160" y="150" width="46" height="30" rx="13" fill="var(--g-rubber)"/><rect x="204" y="159" width="10" height="12" rx="2" fill="var(--g-rubber)"/><rect x="212" y="157" width="8" height="16" rx="3" fill="var(--g-line)"/>
    <path d="M166 160h30" stroke="#FFFFFF" stroke-opacity=".4" stroke-width="3" stroke-linecap="round"/>
    <path d="M28 112a10 10 0 0 1 20 0v6H28z" fill="var(--amber)"/><circle cx="38" cy="100" r="5" fill="var(--g-paper)" stroke="var(--amber)" stroke-width="2"/>
  </g>
  <rect x="266" y="204" width="62" height="58" rx="3" fill="var(--g-wood)"/><rect x="262" y="200" width="70" height="8" rx="2" fill="var(--g-wood-deep)"/>
  <g class="g-arrival">
    <rect x="276" y="172" width="30" height="28" rx="6" fill="var(--g-line)"/><path d="M306 180l8-6" stroke="var(--g-line)" stroke-width="5" stroke-linecap="round"/><path d="M280 172a11 11 0 0 1 22 0" fill="none" stroke="var(--g-line)" stroke-width="3"/>
    <rect x="310" y="184" width="14" height="16" rx="2" fill="var(--g-paper)" stroke="var(--g-line)" stroke-width="2"/><path d="M324 188a4 4 0 0 1 0 8" fill="none" stroke="var(--g-line)" stroke-width="2"/>
  </g>
  <g class="g-winter" fill="none" stroke="var(--g-steam)" stroke-width="2" stroke-linecap="round"><path d="M314 178c-3-4 3-6 0-10M320 178c-3-4 3-6 0-10"/></g>
  <path d="M140 262l-22-14h112l-20 14z" fill="var(--g-card-deep)"/>
  <rect x="140" y="252" width="110" height="60" rx="3" fill="var(--g-card)" stroke="var(--g-card-deep)" stroke-width="3"/>
  <path d="M140 252l-24-16M250 252l24-16" stroke="var(--g-card-deep)" stroke-width="3" stroke-linecap="round"/>
  <rect x="168" y="272" width="54" height="22" rx="4" fill="#FFFFFF"/>
  <text x="195" y="288" text-anchor="middle" font-size="14" font-weight="800" fill="var(--amber)">Landed</text>
  <g class="g-arrival"><rect x="150" y="238" width="30" height="16" rx="8" fill="var(--g-paper)" stroke="var(--g-floor)" stroke-width="2"/><rect x="150" y="244" width="30" height="4" fill="var(--amber)"/></g>
  <g class="g-winter"><path d="M226 240h14v10l-8 4-6-4z" fill="var(--amber)" stroke="var(--g-line)" stroke-width="2" stroke-linejoin="round"/></g>
</svg>`,

    map: () => `
<svg viewBox="0 0 220 260" role="img" aria-label="${t("map.aria", "Map of the delivery route through Aberdeen")}">
  <rect width="220" height="260" rx="14" fill="var(--fog)"/>
  <path d="M168 0c10 30-10 60 4 90s-8 60 6 90 -6 60 4 80h38V0z" fill="var(--g-sea)"/>
  <path d="M0 42c40-4 70 10 100 6s40-8 52-2" fill="none" stroke="var(--g-river)" stroke-width="5" stroke-linecap="round"/>
  <path d="M0 214c40-8 80 4 120 0s26-2 40 4" fill="none" stroke="var(--g-river)" stroke-width="5" stroke-linecap="round"/>
  <text x="200" y="130" font-size="11" fill="var(--g-label)" transform="rotate(90 200 130)" text-anchor="middle">${t("map.sea", "North Sea")}</text>
  <text x="12" y="34" font-size="10" fill="var(--g-label)">${t("map.don", "River Don")}</text>
  <text x="12" y="234" font-size="10" fill="var(--g-label)">${t("map.dee", "River Dee")}</text>
  <path d="M70 60v140" stroke="var(--amber)" stroke-width="4" stroke-linecap="round"/>
  <circle class="anywhere" cx="86" cy="130" r="74" fill="none" stroke="var(--granite)" stroke-opacity=".3" stroke-width="2" stroke-dasharray="6 6"/>
  <g class="stop" data-halls="Hillhead"><circle cx="70" cy="60" r="7" fill="var(--g-paper)" stroke="var(--amber)" stroke-width="3"/><text x="86" y="58">${t("map.hillhead", "Hillhead")}</text><text x="86" y="71" font-size="10">${t("map.hillhead.sub", "University of Aberdeen")}</text></g>
  <g class="stop" data-halls="City centre halls"><circle cx="70" cy="130" r="7" fill="var(--g-paper)" stroke="var(--amber)" stroke-width="3"/><text x="86" y="128">${t("map.city", "City centre")}</text><text x="86" y="141" font-size="10">${t("map.city.sub", "Union Street area")}</text></g>
  <g class="stop" data-halls="Garthdee"><circle cx="70" cy="200" r="7" fill="var(--g-paper)" stroke="var(--amber)" stroke-width="3"/><text x="86" y="198">${t("map.garthdee", "Garthdee")}</text><text x="86" y="211" font-size="10">${t("map.garthdee.sub", "RGU campus")}</text></g>
</svg>`,
  };

  class MdGraphic extends HTMLElement {
    static get observedAttributes() { return ["name"]; }
    connectedCallback() { this.paint(); }
    attributeChangedCallback() { if (this.isConnected) this.paint(); }
    paint() {
      const fn = GRAPHICS[this.getAttribute("name")];
      this.innerHTML = fn ? fn() : "";
      // preserve per-stop state after a repaint
      const on = this.dataset.on;
      if (on) this.querySelectorAll(".stop").forEach(s => s.classList.toggle("on", s.dataset.halls === on));
    }
    // state is a space separated list, e.g. "arrival winter" or "anywhere"
    setState(list) { this.setAttribute("state", list.filter(Boolean).join(" ")); }
    setStop(halls) { this.dataset.on = halls; this.querySelectorAll(".stop").forEach(s => s.classList.toggle("on", s.dataset.halls === halls)); }
  }
  if (!customElements.get("md-graphic")) customElements.define("md-graphic", MdGraphic);

  MD.graphics = {
    GRAPHICS,
    register: (name, fn) => { GRAPHICS[name] = fn; },
    repaint: () => document.querySelectorAll("md-graphic").forEach(g => g.paint()),
  };
})(window.MD = window.MD || {});
