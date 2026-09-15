# Landed

Arrival kits, winter kits and summer storage for Aberdeen's students. Working name.

The idea: students at Hillhead (University of Aberdeen) and Garthdee (RGU) arrive with one suitcase into halls that are a bus ride from the shops, and in May they bin the same kit new arrivals buy again in September. Sell a pre-ordered kit that is in the room before check-in, a winter kit in October, and box storage plus buy-back in May. Stock is bought against confirmed pre-orders, so the business starts on a budget of about £1,200.

## What's here

| Path | What it is |
|---|---|
| `site/` | Page templates: the pre-order page (`index.html`), about, contact, terms and privacy, plus shared `_head`, `_header`, `_footer` and `_scripts` partials. English, with `data-i18n` keys |
| `scripts/build-site.js` | Pre-renders every template in every language into `web/` (`/`, `/about/`, `/uk/`, `/uk/about/`, …) with hreflang, canonical, Open Graph, JSON-LD, sitemap, robots and the OG image. `npm run site:build`; `npm run dev` and `npm run deploy` run it |
| `admin/` | Admin web app source (Vue 3 + Tailwind 4 + TypeScript): dashboard, orders, shipping run sheet, billing ledger and invoices, emails, settings. `npm run admin:build` writes it to `web/admin/` |
| `web/admin/` | Built admin app, served at `/admin/` next to the API (`functions/admin/[[path]].js` serves its index for deep links on Pages; `scripts/dev.js` does the same locally) |
| `web/catalogue.js` | Kits, items, add-ons and prices. The page and the server both read this one file |
| `src/daisy.css` | The daisyUI 5 build source: the `landed` and `landed-dark` themes, the extra daisyUI themes, and the bridge that makes the meta-design tokens follow the active theme. `npm run css` compiles it to `web/meta/daisy.css`; `npm run site:build` runs that first |
| `web/meta/` | meta-design: `meta.css` (tokens + the page layout), `meta.js` (mode, language, skin, header behaviour), `skins.js` (the `daisy` skin that maps the `data-md` vocabulary to daisyUI classes, plus Tailwind, Bootstrap and Bulma demo skins), `icons.js`, `graphics.js`, `packages.js`. See `web/meta/README.md` |
| `web/meta/i18n/` | One dictionary per language (en, es, zh-CN, zh-HK, zh-TW, pl, uk, ar, ro); `npm run i18n` checks they all have the same keys |
| `functions/` | The API (Cloudflare Pages Functions): orders, referrals, Stripe checkout + webhook, deliveries, notifications |
| `db/migrations/` | Schema and seeded email templates. Locally `db/migrate.js` applies them to the SQLite file; in production `wrangler d1 migrations apply` applies the same files to D1 |
| `scripts/dev.js` | Local server that runs `web/` and `functions/` together on a SQLite file, no wrangler needed |
| `scripts/seed.js` | Seeds sample orders (and optionally the first admin user) through the HTTP API, locally or against the deployed site |
| `scripts/fetch-icons.cjs` | Regenerates the line-icon geometry in `web/meta/icons.js` from Hugeicons, Tabler and Streamline (`npm run icons`) |
| `scripts/gen-hero.sh` | Generates the hero slideshow scenes (`assets/hero/`, cut to `web/img/hero/` by `scripts/hero-webp.cjs`) with gpt-image-1; the slide list, kit tags and featured items are in `web/hero-slides.js` |
| `scripts/gen-photo-icons.sh` | Generates the skeuomorphic 3D icon theme (`assets/icons/skeuomorphic/`) with gpt-image-1 via the ask-gpt skill; `scripts/photo-icons-webp.cjs` cuts every theme in `assets/icons/` to `web/img/icons/<theme>/` |
| `test/` | End-to-end API tests (`npm test`) |
| `deck/Landed-pitch-deck.pptx` | 12-slide pitch deck (speaker notes flag which numbers are estimates) |
| `deck/build_deck.js` | Regenerates the deck with pptxgenjs |

The order and fulfilment backend reuses subsystems from `~/Projects/shima.shop` (libSQL-shaped data layer, now on SQLite/D1, order audit trail, request logging middleware, migration runner, Resend/SMTP notifications with DB templates, Stripe checkout verification, admin orders panel pattern). The admin app takes its structure from `~/Projects/duties-api` (`resources/js/admin`: the UI kit, API client, orders list and detail pages, template editor with live preview, and the payments ledger + numbered invoices model behind Billing), rebuilt without Laravel, pinia or roles since Landed has one team and one currency. Admin sign-in (email + password, cookie sessions) follows shima.shop's users + admin_sessions tables. The parts that did not fit a kit-and-deposit business (product catalogue, eleven payment gateways, social login, Vue/Vite admin) were left behind and replaced with Landed's own order model, run sheet, referral and cancellation rules.

## Run it locally

```bash
npm install
cp .dev.vars.example .dev.vars     # edit if you want Stripe / email; works as-is without either
npm run dev                        # http://localhost:8788  (admin at /admin/, API at /api/health)
npm run seed -- --admin you@example.com:password   # sample orders + your admin user (another terminal)
npm test
```

The admin under `/admin/` is the built bundle in `web/admin/`. To work on it: `npm run admin:dev` (Vite with hot reload on :5174, proxying `/api` to the dev server on :8788), `npm run admin:check` (vue-tsc), `npm run admin:build` (writes `web/admin/`; `npm run deploy` does this first).

The dev server creates `.data/landed.db` (SQLite), runs the migrations, serves `web/` and routes `/api/*` to `functions/` the way Cloudflare Pages does. Production is the same schema on Cloudflare D1 (also SQLite); `npm run pages:dev` runs the real workerd runtime with wrangler's local D1 copy (`npm run db:migrate:local` first) if you want to check that before deploying. Without `STRIPE_SECRET_KEY` the page still takes reservations; the deposit button says a link will follow, and admin can record cash or bank deposits. Without `RESEND_API_KEY` emails are logged (Admin → Emails) with their text so you can send them by hand.

## Admin sign-in

The admin at `/admin/` signs in with an email and password. Users live in `admin_users`; a sign-in sets an HttpOnly `landed_admin` cookie (30 days) backed by `admin_sessions`. More users, password resets and removals are under Admin → Settings → Admin users.

- **First user.** While no user exists the login page offers to create one. If `ADMIN_API_KEY` is set on the server, creating the first user needs that key too, so a fresh deployment cannot be claimed by a stranger: `npm run seed -- --url https://<site> --key <ADMIN_API_KEY> --admin you@example.com:password` does it (the `--admin` step is skipped when a user already exists; delete the sample orders afterwards if you only wanted the user).
- **No key and no user** (a fresh local checkout): everything is open, and the header says so until you add a user.
- **`ADMIN_API_KEY`** still works as an `X-Admin-Key` header for scripts and tests; the browser app does not use it.

## How an order flows

1. **Reserve.** The page POSTs the basket to `/api/orders`. The server prices it from `catalogue.js` (client totals are ignored), validates the referral code, issues a `LND-XXXX` reference, plans the deliveries (arrival box on check-in day, winter box on the October run, or on check-in day for late arrivals) and emails the customer a confirmation with a pay link and you a new-order alert.
2. **Deposit.** The pay button (or the emailed `?pay=LND-XXXX` link) asks `/api/checkout` for a hosted Stripe Checkout Session. Stripe calls `/api/webhooks/stripe` and the visitor returns to `/?session_id=…`; whichever arrives first marks the deposit paid, the other is a no-op. Cash or bank deposits are recorded in the admin console. Paid deposits count toward the go/no-go on the dashboard.
3. **Referrals.** Every reference is a referral code. A friend who uses it gets £10 off; the referrer earns £10 credit that comes off their balance at the door.
4. **Confirm.** A week before, open the run sheet for the date and send the reminder email in one click; each row also has a WhatsApp link with a prefilled message for the room check.
5. **Land.** On the day the run sheet groups boxes by halls with the packing list per box, the balance to collect and buttons for "in the room", "left at reception" (the customer gets an email saying where), "packed", "failed". Balance paid by cash or card is recorded there too; card at the door can use the copyable `?pay=REF&kind=balance` link.
6. **Cancel.** Customers cancel from a link with their email; free up to 14 days before check-in (card deposits are refunded through Stripe automatically), inside that the deposit is kept. Admin can cancel with a forced refund.
7. **Storage.** The tick box builds a list (Orders → Storage filter) with CSV export. Booking storage is not built yet.
8. **Money.** Every deposit, balance and refund is a row in the `payments` ledger (Stripe webhook, checkout return, admin cash/bank entries and cancellations all write it). Admin → Billing shows taken / refunded / outstanding, the ledger with CSV, and the documents. An order's invoice is issued once from its page (`LND-0001`, a snapshot of lines and payments at issue time, printable HTML); a refund (card through Stripe, cash or bank recorded by hand) marks the deposit or balance refunded and issues a credit note (`LND-CN-0002`). Business details and the number sequence live under Billing → Details.
9. **Shipping.** Admin → Shipping is the run sheet: boxes grouped by halls with the packing list, WhatsApp link and balance to collect, per-box buttons, multi-select for bulk status changes and moving drops to another day, the reminder email for the day, CSV and print.

Order statuses: `reserved → confirmed → delivered → closed`, or `cancelled`. Deposit: `pending | paid | refunded | kept | void`. Balance: `due | paid | waived | refunded`. Ledger kinds: `deposit | balance | refund`. Every change is written to `order_events` with IP, country and user agent.

## Layout and design system

The pages follow the layout of `~/Projects/tonymagnetic`: a fixed, full-width header that runs transparent and white over the hero photograph and turns solid (blurred, hairline shadow) once the page scrolls 24px; brand left, uppercase letter-spaced nav right with the mode / language / theme switchers, and a hamburger menu under 56rem that opens a full-screen panel. The hero fills the viewport (`min(100svh, 56rem)`) with an eyebrow, a large display heading and the lead lower-left inside an 86rem shell, and a rule-topped foot row with the item chips and the slide controls. Inner pages start with a heading band (eyebrow, big `h1`, lead, bottom rule) and read in a narrow column. The footer carries a big wordmark, the tagline, an uppercase link list and a bottom row with the place and copyright. All of it lives in the `layout` block of `web/meta/meta.css` and in `site/_header.html` / `site/_footer.html`; the header behaviour (scroll state, menu) is in `web/meta/meta.js`.

Components are daisyUI 5 on Tailwind v4. Markup declares a vocabulary (`data-md="kit"`, `data-md="btn primary"`, `data-state="on"`) and the `daisy` skin in `web/meta/skins.js` maps it to daisyUI classes, so the same templates can also be shown in the Tailwind, Bootstrap and Bulma demo skins from the theme switcher. Two custom daisyUI themes carry the brand (`landed`, `landed-dark`; the day/night/auto switch picks between them), and the theme switcher also offers a few stock daisyUI themes (Cupcake, Retro, Nord, Dracula) as `daisy:<theme>` skins. Tailwind only emits classes it finds as literal strings in `site/` and `web/meta/*.js`, so keep class names literal in the skin map and rebuild with `npm run css` (or `npm run css:watch` while designing).

## Hero slideshow

The top of the order page is a full-width slideshow of 18 furnished halls rooms, studio flats, shared kitchens and a tenement living room, each staged with one to three pack items in the light (`web/img/hero/`, masters in `assets/hero/`, prompts in `scripts/gen-hero.sh`). `web/hero-slides.js` lists the scenes with the kit they belong to and the catalogue items they feature; the page shows those items as chips under the picture in the visitor's language, and the slideshow follows the kit picked below (arrival scenes, winter scenes, or all). Cross-fades every 6 seconds, pauses on hover and focus, honours reduced motion, swipes on touch, arrows on the keyboard. The build pre-renders every figure with a blurred placeholder and a translated alt text. Regenerate one scene with `scripts/gen-hero.sh <id>` (needs OpusOS on :8001).

## Live wallpaper and elevation

`web/meta/wallpaper.js` paints a fixed canvas behind every page: five slow, warm generative scenes (drifting silk, breathing contour lines, dust in a sun beam, a textile weave, a sunset with cloud bands), each held for 45 seconds and cross-faded over 5. Colours come from the page tokens, so day and night get their own palettes and everything stays close to the background luminance. It renders at about 480px wide and scales up, capped at 24 fps, pauses in a hidden tab, shows one still frame under reduced motion, and switches off with `?wallpaper=off` (remembered) or `MD.wallpaper.off()`. `MD.wallpaper.next()` skips to the next scene.

Cards (kits, box contents, add-ons, steps, FAQ, the prose-page cards) carry gentle shadows from `--shadow-sm` / `--shadow-md` in `web/meta/meta.css`, lift on hover, and turn white over the wallpaper; the order steps are numbered, the hero carries a "Choose your kit" cue that scrolls to the form, the reserve button glows, and every page except the order page ends with a "Choose a kit" call to action.

## Languages and SEO

Every page exists once per language at its own URL: English at the root (`/`, `/about/`) and the other eight at `/<code>/` (`/uk/about/`, `/zh-HK/terms/`). `scripts/build-site.js` bakes the translated text into the HTML, so search engines and social previews see the right language without JavaScript; the runtime then loads the same dictionary on top for the interactive parts. Each page carries a canonical URL, `hreflang` alternates for all languages plus `x-default`, Open Graph and Twitter tags (image `web/img/og.jpg`, made from the first-night photo), and JSON-LD (Organization, WebSite, the page type, breadcrumbs; the order page also has Product offers and the FAQ). `sitemap.xml` lists every URL with its alternates; `robots.txt` and `_headers` keep `/admin/` and `/api/` out of the index.

The language switcher navigates to the same page in the chosen language; `?lang=uk` on any page does the same. A one-line hint offers the visitor's own language (saved choice or browser language) when it differs from the page's. Pay links and the Stripe return page use the customer's language.

Adding a language: a dictionary in `web/meta/i18n/`, a row in `LANGS` in `web/meta/meta.js` (flag, label, locale, direction), the code in `LANG_CODES` in `functions/lib/notifications.js`, and `npm run i18n` to check the keys.

## Configuration

`.dev.vars` locally, Cloudflare Pages environment variables in production (see `wrangler.toml` for the list): `DATABASE_URL` (local only, `file:.data/landed.db`), `ADMIN_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`, `ORDER_EMAIL`, `WHATSAPP_NUMBER`, `SITE_URL`. In production the database is the `DB` D1 binding in `wrangler.toml`.

Editable in Admin → Settings: admin email, WhatsApp number, winter delivery day, go/no-go target and date, mail transport (Resend key or SMTP), log level. Email templates are edited under Admin → Emails with a test-send button.

In `web/index.html` the constants at the top of the script still hold `ORDER_EMAIL`, `WHATSAPP_NUMBER` and `DEPOSIT_GATEWAY`. `DEPOSIT_GATEWAY.provider` is `checkout` (Stripe via the API); the old link providers (`monobank`, `stripe` payment link, `paypal`, `none`) still work if you would rather not run Stripe yet.

## Deploy (Cloudflare Pages + D1)

Live: the Pages project is `landed` (account "DPD Anthill"), production at **https://landed.school** (alias `landed-eyb.pages.dev`). The database is Cloudflare D1 (SQLite), bound as `DB` in `wrangler.toml`; nothing else needs configuring for it beyond the database id.

First time (once per account):

```bash
npx wrangler login
npx wrangler d1 create landed                      # paste the database_id it prints into wrangler.toml
npx wrangler pages secret put ADMIN_API_KEY        # and STRIPE_*, RESEND_*, ORDER_EMAIL, WHATSAPP_NUMBER, SITE_URL as needed
```

Every release:

```bash
npm run deploy                                     # builds the admin, applies pending migrations to D1, deploys web/
npm run seed -- --url https://landed.school --key <ADMIN_API_KEY> --admin you@example.com:password   # first admin user (+ sample orders)
```

`npm run deploy` runs `wrangler d1 migrations apply landed --remote` before deploying, so new files in `db/migrations/` reach production on the next deploy. Then in Stripe add a webhook for `https://<your-domain>/api/webhooks/stripe` with the events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, and put its signing secret in `STRIPE_WEBHOOK_SECRET`.

## Icons and images

- **Kit cards and "What's in the box"** use rendered product images, one WebP per icon in `web/img/icons/<theme>/`. Two themes live in `assets/icons/`: `photorealistic-icons/` (the default, style `photo`; 20 item icons, mapped to catalogue ids by its `names.json`) and `skeuomorphic/` (style `skeuomorphic`; all 27 icons, generated by `scripts/gen-photo-icons.sh [name…]`, which needs OpusOS on :8001 for the OpenAI bridge). `photo` falls back to the skeuomorphic icon and then the line drawing where the photorealistic set has none yet (the four kits, topper, lamp, rack). After adding masters run `node scripts/photo-icons-webp.cjs`.
- **Everything else** uses line icons from [Hugeicons](https://hugeicons.com) (MIT), [Tabler](https://tabler.io/icons) (MIT) and the free [Streamline Core](https://streamlinehq.com) set (CC BY 4.0, used for the beanie). The name-to-source map is in `scripts/fetch-icons.cjs`; `npm run icons` regenerates. Kit cards are aliases (`kit-arrival` etc.) so every style still renders them.
- **Hero photo** (`web/img/first-night.*`, master in `assets/first-night.png`) was generated with gpt-image-1 as a stand-in until there is a photo of the real sample kit. Shown when the order includes arrival items; the drawn room remains the winter-only fallback.

## API

Public: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/setup` (first user only), `POST /api/orders`, `GET /api/orders/:ref?email=`, `POST /api/orders/:ref/cancel {email, reason}`, `GET /api/referrals/:code`, `POST /api/checkout {ref, kind}`, `GET /api/checkout-success?session_id=`, `POST /api/webhooks/stripe`, `GET /api/health`.

Admin (`X-Admin-Key`): `GET /api/orders?…&format=csv`, `PATCH|DELETE /api/orders/:ref`, `POST /api/orders/:ref/notify {event}`, `POST /api/orders/:ref/refund {kind, amount?, reason}`, `POST|GET /api/orders/:ref/invoice[?format=html]`, `GET /api/deliveries?date=&halls=&format=csv`, `POST /api/deliveries {action:'reminders', date}` or `{action:'bulk', ids, status, note?}`, `PATCH /api/deliveries/:id {status, note, scheduled_date}`, `GET /api/stats`, `GET /api/billing`, `GET /api/payments?kind=&method=&ref=&from=&to=&format=csv`, `GET /api/invoices?type=&ref=`, `GET /api/invoices/:number[?format=html]`, `GET|PUT /api/notification-templates`, `POST /api/notification-templates/test`, `POST /api/notification-templates/preview {event, subject?, body_html?, ref?}`, `GET /api/notifications`, `GET|PUT /api/settings?key=general|mail|billing|app.settings`, `GET|DELETE /api/logs`, `GET|POST /api/users`, `PATCH|DELETE /api/users/:id`.

## Rebuilding the deck

```bash
npm run deck
```

Writes `deck/Landed-pitch-deck.pptx`. Colours, fonts and every slide's copy live in `deck/build_deck.js`.

## Numbers to verify before showing this to anyone

All figures are estimates for validation, not quotes.

- Student population (deck says c. 30,000 across UoA and RGU): check current-year figures for both universities, especially international intake after the 2024 visa changes.
- Kit costs (arrival kit £48, winter kit £16): get wholesale quotes for bedding bundles, catering-supply crockery, a kettle and a pan set.
- Delivery (£3-4 per kit): one-day van hire plus fuel across a full Hillhead-city centre-Garthdee route.
- Storage (£6 per box): a 50 sq ft unit for four months shared across about 60 boxes.
- Prices (£95 / £45 / £125 bundle / £45 per storage box): untested. The winter-kit soft launch is the first price test.

## Plan

| When | What |
|---|---|
| Oct 2026 | Winter kit soft launch, 40 units, sold through student societies |
| Nov-Dec 2026 | 30 conversations with international students; finalise arrival kit contents and price |
| Jan-Mar 2027 | Halls and wholesaler agreements; pre-order page live |
| May 2027 | First collections, buy-back and summer storage |
| Jun-Jul 2027 | Pre-orders open for the 2027 intake |

Go / no-go: 50 paid deposits by 31 July 2027 (the dashboard tracks this). Fewer than that and the arrival kit stays a winter-kit side line.

## Channels

International student societies and their arrival WhatsApp groups, UoA and RGU freshers' groups, halls welcome packs, referral (£10 off per friend), and the van outside halls on check-in day.
