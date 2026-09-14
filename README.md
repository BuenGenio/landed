# Landed

Arrival kits, winter kits and summer storage for Aberdeen's students. Working name.

The idea: students at Hillhead (University of Aberdeen) and Garthdee (RGU) arrive with one suitcase into halls that are a bus ride from the shops, and in May they bin the same kit new arrivals buy again in September. Sell a pre-ordered kit that is in the room before check-in, a winter kit in October, and box storage plus buy-back in May. Stock is bought against confirmed pre-orders, so the business starts on a budget of about £1,200.

## What's here

| Path | What it is |
|---|---|
| `deck/Landed-pitch-deck.pptx` | 12-slide pitch deck (speaker notes flag which numbers are estimates) |
| `deck/build_deck.js` | Regenerates the deck with pptxgenjs; edit copy and numbers here |
| `web/index.html` | Pre-order page: kit picker, university and halls, contact details, sticky total, confirmation, deposit payment |
| `web/meta/` | meta-design: the declaration-driven layer behind the page (modes, skins, icons, graphics, packages, languages). See `web/meta/README.md` |
| `landed-order-page.html` | Earlier single-file version of the page, kept for reference; `web/index.html` supersedes it |

## Running the order page

Open `web/index.html` in a browser, or serve it:

```bash
npm run web
```

Live copy: https://buengenio.github.io/landed/ (GitHub Pages, from the `gh-pages` branch). Redeploy with `npm run deploy:gh-pages` after committing (the plain `npm run deploy` targets Cloudflare Pages, where the API functions run).

Before it goes live for real, edit the constants at the top of the page `<script>` in `web/index.html`:

- `FORM_ENDPOINT` - where reservations are POSTed as JSON (Formspree, Tally, a Google Apps Script, or your own API). Left empty, the page still runs end to end and offers the customer an email fallback.
- `ORDER_EMAIL` - the address used for that fallback link and the email fallback of the Chat package.
- `WHATSAPP_NUMBER` - turns the "message us" link into WhatsApp.
- `DEPOSIT_GATEWAY` - `{ provider: "monobank" | "stripe" | "paypal" | "none", account }`. The account is a monobank jar id, a Stripe payment-link id or a PayPal.Me handle. With no account the button is shown disabled and the "link by email" note is used.

Then find-and-replace `Landed` if the name changes, and replace `hello@example.com`.

### What the page offers the visitor

- **Day / night / auto** switch in the header. Auto follows the device setting; the choice is remembered.
- **Language** switch: English, Spanish, Mandarin (simplified), Cantonese (Hong Kong, written Cantonese), Taiwanese Mandarin (traditional), Polish, Arabic (right-to-left) and Romanian. Polish, Arabic and Romanian were picked as the largest non-English community languages in Aberdeen City after the 2022 census; swap them in `web/meta/i18n/` if the audience differs. The backend always receives English field values plus the visitor's language code.
- **Design framework** switch: the page's own design, Tailwind CSS, Bootstrap 5 or Bulma, loaded from CDNs on demand. It exists to compare looks quickly; the native skin is the one to ship. The Tailwind option uses the play CDN, which logs a "not for production" warning by design.
- **University** selector (University of Aberdeen, RGU, NESCol, other) that pre-selects the matching halls.
- **Deposit payment** on the confirmation screen through the PaymentGateway package.

URL parameters force a view for sharing or testing: `?mode=dark&lang=zh-HK&skin=bootstrap`.

## Rebuilding the deck

```bash
npm install
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

Go / no-go: 50 paid deposits by 31 July 2027. Fewer than that and the arrival kit stays a winter-kit side line.

## Channels

International student societies and their arrival WhatsApp groups, UoA and RGU freshers' groups, halls welcome packs, referral (£10 off per friend), and the van outside halls on check-in day.
