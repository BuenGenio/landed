/* =====================================================================
   meta-design: packages
   ---------------------------------------------------------------------
   Third-party integrations generated from a declaration:

     <md-package name="PaymentGateway" provider="monobank" account="ABC123"
                 amount="20" currency="GBP" ref="LND-1234"></md-package>
     <md-package name="Chat" provider="whatsapp" account="447700900000"></md-package>

   A package is a name plus a set of providers. Each provider is a small
   adapter: it knows how to build a link from the declared attributes and
   how to draw itself. Swap the provider attribute and nothing else in
   the page changes. Attributes can also be filled from a config object
   through MD.packages.configure("PaymentGateway", {...}).
   ===================================================================== */
(function (MD) {
  const t = (k, o, fb) => (MD.t ? MD.t(k, o) : null) || fb;
  const enc = encodeURIComponent;
  const glyph = {
    // generic glyphs: wordmarks are text, so nobody's logo is copied
    card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.2L4 21l1.8-5.4A8 8 0 1 1 21 12z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/></svg>',
  };

  const PACKAGES = {
    PaymentGateway: {
      defaults: { currency: "GBP", amount: "20" },
      providers: {
        // Hosted checkout through the site's own API (POST /api/checkout): the page intercepts the click,
        // asks the server for a Stripe Checkout Session and redirects. The href is the same link an email carries.
        checkout: {
          label: "card",
          href: a => a.ref ? `?pay=${enc(a.ref)}` : "",
          note: () => t("pay.note.checkout", null, "Secure card checkout by Stripe; Apple Pay and Google Pay work too. Your reference is attached to the payment."),
        },
        monobank: {
          label: "monobank",
          href: a => a.account ? `https://send.monobank.ua/jar/${a.account}?a=${enc(a.amount)}&t=${enc(a.ref || "")}` : "",
          note: () => t("pay.note.monobank", null, "Opens a monobank jar. Card or Apple/Google Pay, the reference is filled in for you."),
        },
        stripe: {
          label: "Stripe",
          href: a => a.account ? `https://buy.stripe.com/${a.account}?client_reference_id=${enc(a.ref || "")}${a.email ? "&prefilled_email=" + enc(a.email) : ""}` : "",
          note: () => t("pay.note.stripe", null, "Secure card checkout by Stripe. Your reference is attached to the payment."),
        },
        paypal: {
          label: "PayPal",
          href: a => a.account ? `https://www.paypal.com/paypalme/${a.account}/${enc(a.amount)}${a.currency}` : "",
          note: () => t("pay.note.paypal", null, "PayPal.Me link with the deposit amount filled in. Add your reference in the note."),
        },
        none: {
          label: "",
          href: () => "",
          note: () => t("pay.note.none", null, "We email a payment link within 24 hours."),
        },
      },
      render(a, p) {
        const href = p.href(a);
        const amount = MD.money ? MD.money(Number(a.amount)) : `£${a.amount}`;
        const text = a.provider === "none" ? t("pay.later", null, "Deposit link by email") : t("pay.cta", { amount, provider: p.label }, `Pay ${amount} deposit with ${p.label}`);
        const tag = href ? `<a class="md-pay" data-provider="${a.provider}" href="${href}" target="_blank" rel="noopener">` : `<span class="md-pay" data-provider="${a.provider}" aria-disabled="true">`;
        return tag + glyph.card + `<span>${text}</span>` + (href ? "</a>" : "</span>") +
          `<span class="md-pay-note">${href ? p.note() : PACKAGES.PaymentGateway.providers.none.note()}</span>`;
      },
    },
    Chat: {
      defaults: {},
      providers: {
        whatsapp: { label: "WhatsApp", href: a => `https://wa.me/${(a.account || "").replace(/\D/g, "")}${a.text ? "?text=" + enc(a.text) : ""}`, glyph: "chat" },
        telegram: { label: "Telegram", href: a => `https://t.me/${a.account || ""}`, glyph: "send" },
        email:    { label: "Email", href: a => `mailto:${a.account || ""}${a.text ? "?body=" + enc(a.text) : ""}`, glyph: "mail" },
      },
      render(a, p) {
        return `<a class="md-chat" data-provider="${a.provider}" href="${p.href(a)}" target="_blank" rel="noopener">${glyph[p.glyph]}<span>${a.label || t("chat.cta", { provider: p.label }, `Message us on ${p.label}`)}</span></a>`;
      },
    },
    Share: {
      defaults: {},
      providers: {
        whatsapp: { label: "WhatsApp", href: a => `https://wa.me/?text=${enc(a.text || "")}`, glyph: "chat" },
        telegram: { label: "Telegram", href: a => `https://t.me/share/url?url=${enc(a.url || "")}&text=${enc(a.text || "")}`, glyph: "send" },
        email:    { label: "Email", href: a => `mailto:?subject=${enc(a.subject || "")}&body=${enc(a.text || "")}`, glyph: "mail" },
      },
      render(a, p) {
        return `<a class="md-share" data-provider="${a.provider}" href="${p.href(a)}" target="_blank" rel="noopener">${glyph[p.glyph]}<span>${a.label || t("share.on", { provider: p.label }, `Share on ${p.label}`)}</span></a>`;
      },
    },
  };

  const CONFIG = {};

  class MdPackage extends HTMLElement {
    static get observedAttributes() { return ["name", "provider", "account", "amount", "currency", "ref", "email", "text", "url", "subject", "label"]; }
    connectedCallback() { this.paint(); }
    attributeChangedCallback() { if (this.isConnected) this.paint(); }
    attrs() {
      const name = this.getAttribute("name");
      const pkg = PACKAGES[name] || { defaults: {}, providers: {} };
      const a = { ...pkg.defaults, ...(CONFIG[name] || {}) };
      for (const at of this.attributes) a[at.name] = at.value;
      if (!a.provider) a.provider = Object.keys(pkg.providers)[0];
      return a;
    }
    paint() {
      const name = this.getAttribute("name"), pkg = PACKAGES[name];
      if (!pkg) { this.innerHTML = `<!-- unknown package ${name} -->`; return; }
      const a = this.attrs();
      const p = pkg.providers[a.provider] || pkg.providers[Object.keys(pkg.providers)[0]];
      this.innerHTML = pkg.render(a, p);
      if (MD.skin && MD.skin.decorate) MD.skin.decorate(this);
    }
  }
  if (!customElements.get("md-package")) customElements.define("md-package", MdPackage);

  MD.packages = {
    PACKAGES,
    // MD.packages.configure("PaymentGateway", { provider: "monobank", account: "..." })
    configure: (name, cfg) => { CONFIG[name] = { ...(CONFIG[name] || {}), ...cfg }; document.querySelectorAll(`md-package[name="${name}"]`).forEach(p => p.paint()); },
    register: (name, def) => { PACKAGES[name] = def; },
    repaint: () => document.querySelectorAll("md-package").forEach(p => p.paint()),
    providers: name => Object.keys((PACKAGES[name] || { providers: {} }).providers),
  };
})(window.MD = window.MD || {});
