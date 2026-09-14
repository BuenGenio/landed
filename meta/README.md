# meta-design

A small, dependency-free layer that lets one page swap its look, its icons, its
integrations and its language from *declarations* instead of code. It powers
`web/index.html`. Plain scripts, no build step, works from `file://`.

```
meta/
  meta.css      tokens (light + dark) and structure every skin shares
  meta.js       runtime: mode, i18n, skins, states, switcher, boot
  icons.js      one geometry per icon, five renderers (line, flat, 3d, 3d-dpd, emoji)
  graphics.js   token-driven illustrations (<md-graphic name="room">)
  packages.js   integrations from declarations (<md-package name="PaymentGateway" provider="monobank">)
  skins.js      native, tailwind, bootstrap, bulma
  i18n/         en, es, zh-CN, zh-HK, zh-TW, pl, ar, ro
```

## Declarations

| Want | Declare |
|---|---|
| A component | `<div data-md="kit">`, `<button data-md="btn primary">` (component, then variants) |
| A state | `MD.state(el, "on", true)` writes `data-state="on"`; the skin restyles it |
| Text | `<h1 data-i18n="hero.h1">`, attributes via `data-i18n-attr="placeholder:notes.ph"` |
| An icon | `<md-icon name="box" size="l">` |
| An icon style for a region | CSS: `.md-steps { --icon-style: 3d; }` |
| One icon's style | CSS: `.md-steps { --icon-box: "3d-dpd-style"; }` or `<md-icon name="box" variant="3d-dpd">` |
| A graphic | `<md-graphic name="room" state="arrival winter">`; colours come from `--g-*` tokens |
| An integration | `<md-package name="PaymentGateway" provider="monobank" amount="20">` |
| Integration config | `MD.packages.configure("PaymentGateway", { provider: "stripe", account: "…" })` |
| The switchers | `<md-switcher controls="mode lang skin">` |

Icon and package resolution is layered: the element attribute wins, then the nearest
CSS custom property (`--icon-<name>`), then the skin's default (`--icon-style`).

## Modes, skins, languages

- **Mode**: `MD.mode.set("light" | "dark" | "auto")`. Writes `html[data-mode]`,
  `color-scheme` and `<meta name="theme-color">`. Auto follows `prefers-color-scheme`.
- **Skin**: `MD.skin.set("bootstrap")`. Loads the framework from its CDN, injects the
  skin's style block, maps every `data-md` component to framework classes, and tells the
  framework which colour mode is on (`data-bs-theme`, Bulma's `data-theme`, Tailwind's
  `darkMode: selector`). Switching skins reloads the page because framework resets are
  global; the page saves the visitor's form on `md:before-reload` and restores it.
- **Language**: `MD.i18n.set("zh-HK")`. Lazy-loads `i18n/<code>.js`, sets `lang`/`dir`,
  applies every `data-i18n`, repaints graphics, fires `md:lang` so the page re-renders
  generated text. Plurals use `Intl.PluralRules` with `{one, few, many, other, zero, two}`
  objects; money uses the `money` key per language.

Preferences persist in `localStorage` (`md.mode`, `md.lang`, `md.skin`) and can be forced
from the URL: `?mode=dark&lang=ar&skin=bulma`.

## Adding things

- **Icon**: `MD.icons.register("van", "<path d=…/>", "🚐")`, then `<md-icon name="van">`.
- **Icon style**: add a renderer to `STYLES` in `icons.js`; it receives the icon name and
  returns SVG that instantiates `#i-<name>`.
- **Skin**: `MD.skins.register({ id, label, assets: { css, js }, mode(m), icons, map, style })`.
  `map` keys are `component`, `component.variant`, `component.state`; the most specific wins
  and *replaces* the class list, so frameworks with conflicting utilities stay predictable.
- **Package provider**: add to `PACKAGES.<name>.providers` in `packages.js` with `href(attrs)`
  and `label`. PaymentGateway ships monobank (jar link), Stripe (payment link), PayPal (PayPal.Me)
  and `none`; Chat and Share ship WhatsApp, Telegram and email.
- **Language**: copy `i18n/en.js`, translate, register under the new code, add it to `LANGS`
  in `meta.js`. Keep the keys identical: `npm run i18n` checks every dictionary against `en.js`.
