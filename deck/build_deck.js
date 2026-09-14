const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const Fi = require("react-icons/fi");

// Palette: Aberdeen granite + hot-water-bottle amber
const GRANITE = "22303C";
const INK = "1A222B";
const FOG = "E9EDF1";
const AMBER = "F0A030";
const AMBER_TINT = "FCEFD9";
const WHITE = "FFFFFF";
const MUTED = "66747F";
const LIGHT = "AEBAC4";

const TITLE_FONT = "Cambria";
const BODY_FONT = "Calibri";

async function iconPng(Icon, color) {
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Icon, { color: "#" + color, size: 256, strokeWidth: 2 })
  );
  const buf = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

async function main() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9"; // 10 x 5.625
  pres.title = "Landed - Aberdeen student arrival kits";

  const icons = {};
  const need = {
    package: Fi.FiPackage, thermo: Fi.FiThermometer, archive: Fi.FiArchive,
    user: Fi.FiUser, trash: Fi.FiTrash2, refresh: Fi.FiRefreshCw,
    globe: Fi.FiGlobe, message: Fi.FiMessageSquare, home: Fi.FiHome,
    mail: Fi.FiMail, users: Fi.FiUsers, truck: Fi.FiTruck,
    check: Fi.FiCheck, x: Fi.FiX, calendar: Fi.FiCalendar, box: Fi.FiBox,
    sun: Fi.FiSun, mappin: Fi.FiMapPin, flag: Fi.FiFlag, phone: Fi.FiPhone,
  };
  for (const [k, I] of Object.entries(need)) {
    icons[k + "_w"] = await iconPng(I, WHITE);
    icons[k + "_g"] = await iconPng(I, GRANITE);
    icons[k + "_a"] = await iconPng(I, AMBER);
  }

  // ---------- helpers ----------
  function title(slide, text, opts = {}) {
    slide.addText(text, {
      x: 0.5, y: 0.35, w: 9, h: 0.8, margin: 0, isTextBox: true,
      fontFace: TITLE_FONT, fontSize: 30, bold: true,
      color: opts.color || GRANITE, valign: "middle",
    });
  }
  function iconCircle(slide, key, x, y, d = 0.6, fill = AMBER) {
    slide.addShape(pres.ShapeType.ellipse, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill, width: 0 } });
    const pad = d * 0.24;
    slide.addImage({ data: icons[key], x: x + pad, y: y + pad, w: d - 2 * pad, h: d - 2 * pad });
  }
  function body(slide, text, x, y, w, h, extra = {}) {
    slide.addText(text, {
      x, y, w, h, margin: 0, isTextBox: true, fontFace: BODY_FONT, fontSize: 14,
      color: INK, valign: "top", ...extra,
    });
  }
  function bullets(slide, items, x, y, w, h, extra = {}) {
    const arr = items.map((t, i) => ({
      text: t, options: { bullet: { indent: 14 }, breakLine: i < items.length - 1, paraSpaceAfter: 6 },
    }));
    slide.addText(arr, {
      x, y, w, h, margin: 0, isTextBox: true, fontFace: BODY_FONT, fontSize: 14,
      color: INK, valign: "top", ...extra,
    });
  }
  function stat(slide, num, label, x, y, w, opts = {}) {
    slide.addText(num, {
      x, y, w, h: 0.9, margin: 0, isTextBox: true, fontFace: TITLE_FONT, fontSize: opts.size || 44,
      bold: true, color: opts.color || GRANITE, valign: "bottom",
    });
    slide.addText(label, {
      x, y: y + 0.95, w, h: 0.75, margin: 0, isTextBox: true, fontFace: BODY_FONT,
      fontSize: 13, color: opts.labelColor || MUTED, valign: "top",
    });
  }
  function card(slide, x, y, w, h, fill = FOG) {
    slide.addShape(pres.ShapeType.roundRect, {
      x, y, w, h, fill: { color: fill }, line: { color: fill, width: 0 }, rectRadius: 0.12,
    });
  }
  function iconRow(slide, key, head, text, x, y, w, opts = {}) {
    const d = 0.5;
    iconCircle(slide, key, x, y + 0.02, d, opts.fill || AMBER);
    slide.addText(head, {
      x: x + d + 0.2, y, w: w - d - 0.2, h: 0.3, margin: 0, isTextBox: true,
      fontFace: BODY_FONT, fontSize: 14, bold: true, color: opts.color || GRANITE, valign: "top",
    });
    slide.addText(text, {
      x: x + d + 0.2, y: y + 0.3, w: w - d - 0.2, h: opts.h || 0.7, margin: 0, isTextBox: true,
      fontFace: BODY_FONT, fontSize: 12.5, color: opts.textColor || INK, valign: "top",
    });
  }

  // ================= 1. Title =================
  {
    const s = pres.addSlide();
    s.background = { color: GRANITE };
    s.addText("Working name", { x: 0.6, y: 0.5, w: 4, h: 0.3, margin: 0, isTextBox: true, fontFace: BODY_FONT, fontSize: 12, color: LIGHT });
    s.addText("Landed", { x: 0.6, y: 1.35, w: 6, h: 1.1, margin: 0, isTextBox: true, fontFace: TITLE_FONT, fontSize: 60, bold: true, color: WHITE, valign: "middle" });
    s.addText("Arrival kits, winter kits and summer storage for Aberdeen's students.", {
      x: 0.6, y: 2.55, w: 5.4, h: 1.0, margin: 0, isTextBox: true, fontFace: BODY_FONT, fontSize: 20, color: FOG, valign: "top",
    });
    s.addText("Pre-order business plan  |  September 2026", { x: 0.6, y: 4.6, w: 5.4, h: 0.35, margin: 0, isTextBox: true, fontFace: BODY_FONT, fontSize: 12, color: LIGHT });
    iconCircle(s, "package_w", 6.7, 1.35, 2.5, AMBER);
    iconCircle(s, "thermo_g", 8.55, 0.65, 0.85, FOG);
    iconCircle(s, "archive_g", 6.15, 3.6, 0.85, FOG);
    s.addNotes("Working name only. Business: pre-ordered arrival kits delivered to halls before check-in, a winter kit in October, and summer box storage with furniture buy-back in May. Asset-light: stock is bought against confirmed pre-orders.");
  }

  // ================= 2. Problem =================
  {
    const s = pres.addSlide();
    s.background = { color: WHITE };
    title(s, "Arriving is uncomfortable. Leaving is wasteful.");
    stat(s, "c. 30,000", "students across the University of Aberdeen and RGU", 0.5, 1.3, 2.8);
    stat(s, "2", "campuses, and both Hillhead and Garthdee halls are a bus ride from the shops", 3.6, 1.3, 2.9);
    stat(s, "0", "full-size IKEA in Aberdeen; the nearest is in Edinburgh", 6.9, 1.3, 2.6);
    card(s, 0.5, 3.35, 4.35, 1.8);
    card(s, 5.15, 3.35, 4.35, 1.8);
    iconRow(s, "user_w", "September", "International students land with one suitcase and a phone, then need a bed made and a kettle that works by that night.", 0.75, 3.6, 3.9, { h: 1.1 });
    iconRow(s, "trash_w", "May", "The same students bin kettles, lamps and duvets in halls skips. New arrivals buy the same things again four months later.", 5.4, 3.6, 3.9, { h: 1.1 });
    s.addNotes("Student numbers are approximate (UoA c.15k, RGU c.15k) and should be checked against the latest HESA / university figures before this is shown externally. International intake fell across Scotland after the 2024 visa changes; check current-year figures for both universities.");
  }

  // ================= 3. Insight =================
  {
    const s = pres.addSlide();
    s.background = { color: WHITE };
    title(s, "Two predictable weeks a year");
    card(s, 0.5, 1.3, 4.35, 3.1);
    card(s, 5.15, 1.3, 4.35, 3.1);
    iconCircle(s, "package_w", 0.8, 1.6, 0.6);
    s.addText("September: arrival week", { x: 1.6, y: 1.6, w: 3.1, h: 0.6, margin: 0, isTextBox: true, fontFace: BODY_FONT, fontSize: 17, bold: true, color: GRANITE, valign: "middle" });
    bullets(s, [
      "Highest spend of the whole year, made in a hurry",
      "No way to shop before you have a room",
      "Halls check-in dates are published months ahead",
      "Everyone arrives in the same six buildings",
    ], 0.8, 2.4, 3.8, 1.9);
    iconCircle(s, "refresh_w", 5.45, 1.6, 0.6);
    s.addText("May: leaving week", { x: 6.25, y: 1.6, w: 3.1, h: 0.6, margin: 0, isTextBox: true, fontFace: BODY_FONT, fontSize: 17, bold: true, color: GRANITE, valign: "middle" });
    bullets(s, [
      "Skips full of reusable kit outside every hall",
      "International students need somewhere to leave boxes",
      "Move-out dates are also published in advance",
      "Cheapest stock of the year, for a week",
    ], 5.45, 2.4, 3.8, 1.9);
    s.addText("Both weeks are dated, both are concentrated in a handful of buildings, and the second one supplies the first.", {
      x: 0.5, y: 4.6, w: 9, h: 0.6, margin: 0, isTextBox: true, fontFace: TITLE_FONT, fontSize: 15, italic: true, color: GRANITE, valign: "middle",
    });
  }

  // ================= 4. Products =================
  {
    const s = pres.addSlide();
    s.background = { color: WHITE };
    title(s, "What we sell");
    const products = [
      { key: "package_w", name: "Arrival kit", price: "£95", items: ["Duvet, pillows and sheet set", "Mattress protector and towel", "Plates, bowls, mugs, cutlery", "Pan, kettle and chopping board", "UK adaptor and extension lead", "In your room before check-in"] },
      { key: "thermo_w", name: "Winter kit", price: "£45", items: ["Hot water bottle", "Thermal base layer", "Thick socks and a beanie", "Vitamin D and a blackout eye mask", "Local tea and a bag of rowies", "Delivered to halls in October"] },
      { key: "archive_w", name: "Summer storage", price: "£45 / box", items: ["Collected from halls in May", "Stored June to September", "Delivered to your new address", "We buy back what you don't want", "Cash or credit against next year's kit", ""] },
    ];
    const w = 2.87, gap = 0.2, y = 1.3, h = 3.25;
    products.forEach((p, i) => {
      const x = 0.5 + i * (w + gap);
      card(s, x, y, w, h);
      iconCircle(s, p.key, x + 0.25, y + 0.25, 0.55);
      s.addText(p.name, { x: x + 0.95, y: y + 0.22, w: w - 1.1, h: 0.3, margin: 0, isTextBox: true, fontFace: BODY_FONT, fontSize: 15, bold: true, color: GRANITE });
      s.addText(p.price, { x: x + 0.95, y: y + 0.5, w: w - 1.1, h: 0.4, margin: 0, isTextBox: true, fontFace: TITLE_FONT, fontSize: 20, bold: true, color: AMBER });
      bullets(s, p.items.filter(Boolean), x + 0.25, y + 1.1, w - 0.45, h - 1.25, { fontSize: 12 });
    });
    s.addText("Bundle: arrival kit + winter kit £125 (saves £15). Deposit £20 at reservation, balance on delivery.", {
      x: 0.5, y: 4.7, w: 9, h: 0.5, margin: 0, isTextBox: true, fontFace: BODY_FONT, fontSize: 13, color: GRANITE, valign: "middle", bold: true,
    });
  }

  // ================= 5. The cycle =================
  {
    const s = pres.addSlide();
    s.background = { color: WHITE };
    title(s, "One loop, twice a year");
    const steps = [
      { key: "mail_w", when: "June to August", what: "Pre-orders open through offer-holder and arrival groups" },
      { key: "truck_w", when: "September", what: "Kits delivered to rooms on check-in day" },
      { key: "thermo_w", when: "October", what: "Winter kits when the dark and the wind arrive" },
      { key: "box_w", when: "May", what: "Boxes collected, unwanted kit bought back" },
      { key: "archive_w", when: "June to August", what: "Storage; buy-back stock cleaned and repacked" },
    ];
    const n = steps.length, cw = 1.72, x0 = 0.5, y0 = 1.65;
    s.addShape(pres.ShapeType.line, { x: x0 + cw / 2, y: y0 + 0.35, w: cw * (n - 1), h: 0, line: { color: LIGHT, width: 2, dashType: "dash" } });
    steps.forEach((st, i) => {
      const x = x0 + i * cw;
      iconCircle(s, st.key, x + cw / 2 - 0.35, y0, 0.7);
      s.addText(st.when, { x, y: y0 + 0.85, w: cw, h: 0.3, margin: 0, isTextBox: true, fontFace: BODY_FONT, fontSize: 13, bold: true, color: GRANITE, align: "center" });
      s.addText(st.what, { x: x + 0.08, y: y0 + 1.15, w: cw - 0.16, h: 1.0, margin: 0, isTextBox: true, fontFace: BODY_FONT, fontSize: 11.5, color: INK, align: "center", valign: "top" });
    });
    card(s, 0.5, 4.05, 9, 1.05, AMBER_TINT);
    iconCircle(s, "refresh_w", 0.8, 4.3, 0.55);
    s.addText("Kit bought back for £2 to £5 in May is resold in September for £15 to £25. The leaving week stocks the arrival week, so the second year needs less wholesale stock than the first.", {
      x: 1.55, y: 4.15, w: 7.7, h: 0.85, margin: 0, isTextBox: true, fontFace: BODY_FONT, fontSize: 13, color: INK, valign: "middle",
    });
  }

  // ================= 6. Why Aberdeen =================
  {
    const s = pres.addSlide();
    s.background = { color: WHITE };
    title(s, "Why Aberdeen");
    s.addText("The gaps", { x: 0.5, y: 1.3, w: 5.4, h: 0.35, margin: 0, isTextBox: true, fontFace: BODY_FONT, fontSize: 16, bold: true, color: GRANITE });
    bullets(s, [
      "Halls sit out of town: Hillhead two miles north, Garthdee two miles south, both on hilly bus routes",
      "No big-box home store within walking distance of either campus",
      "A large international intake, much of it from warm countries",
      "Long, dark, windy winters from October to March",
      "A city-centre retail offer that has thinned out",
    ], 0.5, 1.7, 5.4, 2.0, { fontSize: 13 });
    s.addText("What that means", { x: 0.5, y: 3.75, w: 5.4, h: 0.35, margin: 0, isTextBox: true, fontFace: BODY_FONT, fontSize: 16, bold: true, color: GRANITE });
    body(s, "Customers are concentrated in a handful of buildings on one north-south line. A single van route serves most of the market, so delivery costs a few pounds per kit, not tens.", 0.5, 4.12, 5.4, 1.1, { fontSize: 13 });

    // schematic van route
    card(s, 6.4, 1.3, 3.1, 3.9);
    const lx = 7.15;
    s.addShape(pres.ShapeType.line, { x: lx, y: 1.85, w: 0, h: 2.55, line: { color: AMBER, width: 3 } });
    const stops = [
      { y: 1.85, name: "Hillhead halls", sub: "University of Aberdeen, Old Aberdeen" },
      { y: 3.1, name: "City centre", sub: "Private halls, Crown Place, Union Street" },
      { y: 4.4, name: "Garthdee", sub: "RGU campus and halls" },
    ];
    stops.forEach((st) => {
      s.addShape(pres.ShapeType.ellipse, { x: lx - 0.14, y: st.y - 0.14, w: 0.28, h: 0.28, fill: { color: WHITE }, line: { color: AMBER, width: 3 } });
      s.addText(st.name, { x: lx + 0.35, y: st.y - 0.25, w: 2.0, h: 0.28, margin: 0, isTextBox: true, fontFace: BODY_FONT, fontSize: 13, bold: true, color: GRANITE });
      s.addText(st.sub, { x: lx + 0.35, y: st.y + 0.02, w: 2.0, h: 0.45, margin: 0, isTextBox: true, fontFace: BODY_FONT, fontSize: 10.5, color: MUTED, valign: "top" });
    });
    s.addText("One van route, about 25 minutes end to end", { x: 6.6, y: 4.75, w: 2.7, h: 0.35, margin: 0, isTextBox: true, fontFace: BODY_FONT, fontSize: 10.5, italic: true, color: GRANITE, align: "center" });
  }

  // ================= 7. Unit economics =================
  {
    const s = pres.addSlide();
    s.background = { color: WHITE };
    title(s, "Unit economics");
    const hdr = (t) => ({ text: t, options: { bold: true, color: WHITE, fill: { color: GRANITE }, fontSize: 12.5, fontFace: BODY_FONT, align: "left", valign: "middle" } });
    const cell = (t, i, extra = {}) => ({ text: t, options: { color: INK, fill: { color: i % 2 ? WHITE : FOG }, fontSize: 12.5, fontFace: BODY_FONT, valign: "middle", ...extra } });
    const rowsData = [
      ["Arrival kit", "£95", "£48", "£4", "£43", "45%"],
      ["Winter kit", "£45", "£16", "£3", "£26", "58%"],
      ["Bundle", "£125", "£64", "£4", "£57", "46%"],
      ["Storage (per box)", "£45", "£6", "£6", "£33", "73%"],
      ["Resold item", "£18", "£3", "£2", "£13", "72%"],
    ];
    const rows = [["Product", "Price", "Goods", "Delivery", "Gross profit", "Margin"].map(hdr)];
    rowsData.forEach((r, i) => rows.push(r.map((c, j) => cell(c, i, { bold: j === 0 || j === 4 }))));
    s.addTable(rows, { x: 0.5, y: 1.35, w: 6.2, colW: [1.7, 0.8, 0.8, 0.95, 1.15, 0.8], rowH: 0.42, border: { type: "none" }, margin: 0.08 });
    body(s, "Goods costed at UK wholesale (bedding and catering suppliers). Delivery is van hire and fuel split across a full route. Storage cost is a 50 sq ft unit for four months, shared across 60 boxes.", 0.5, 4.15, 6.2, 1.0, { fontSize: 11, color: MUTED });
    card(s, 7.05, 1.35, 2.45, 1.7, AMBER_TINT);
    stat(s, "55%", "blended gross margin at year-one mix", 7.3, 1.35, 2.0, { size: 40 });
    card(s, 7.05, 3.25, 2.45, 1.85, FOG);
    stat(s, "£20", "deposit per order covers a third of the goods cost before anything is bought", 7.3, 3.2, 2.0, { size: 40 });
    s.addNotes("All costs are estimates for validation. Replace with quotes: bedding bundles from a UK contract-bedding wholesaler, catering-supply crockery, a Screwfix/Toolstation kettle. Van: one-day hire plus fuel, roughly £120, across 40+ drops.");
  }

  // ================= 8. Year one =================
  {
    const s = pres.addSlide();
    s.background = { color: WHITE };
    title(s, "Year one: small numbers, real profit");
    s.addChart(pres.charts.BAR, [
      { name: "Revenue", labels: ["Arrival kits (150)", "Winter kits (120)", "Storage boxes (100)", "Resold items (200)"], values: [14250, 5400, 4500, 3600] },
    ], {
      x: 0.5, y: 1.3, w: 5.7, h: 3.8, barDir: "bar",
      chartColors: [AMBER], showLegend: false,
      showTitle: true, title: "Revenue by product, year one", titleFontSize: 13, titleColor: GRANITE, titleFontFace: BODY_FONT,
      showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "£#,##0", dataLabelFontSize: 11, dataLabelColor: INK, dataLabelFontFace: BODY_FONT,
      catAxisLabelColor: INK, catAxisLabelFontSize: 11, catAxisLabelFontFace: BODY_FONT, catGridLine: { style: "none" },
      valAxisHidden: true, valGridLine: { style: "none" }, valAxisMaxVal: 18000,
    });
    stat(s, "£27.8k", "year-one revenue at these volumes", 6.6, 1.25, 2.9, { size: 40 });
    stat(s, "£15k", "gross profit, before your time", 6.6, 2.55, 2.9, { size: 40 });
    stat(s, "< 1%", "of students needed to hit 150 kits", 6.6, 3.85, 2.9, { size: 40 });
    s.addNotes("Volumes are targets, not forecasts. 150 kits is under 1% of the combined student population and around 5% of a typical first-year halls intake. Gross profit uses the unit economics slide: 150x43 + 120x26 + 100x33 + 200x13 = c. £15.5k.");
  }

  // ================= 9. Go to market =================
  {
    const s = pres.addSlide();
    s.background = { color: WHITE };
    title(s, "How we reach them before they arrive");
    const rows = [
      ["globe_w", "International student societies", "Nigerian, Indian, Malaysian and Chinese societies run the WhatsApp groups where offer-holders ask 'what should I bring?'"],
      ["message_w", "Freshers' groups", "UoA and RGU freshers' Facebook groups, plus the halls-specific groups that form each summer"],
      ["home_w", "Halls partnerships", "A flyer in the offer pack and a line in the welcome email, in return for less move-in mess and fewer May skips"],
      ["mail_w", "Pre-order page", "Live from June: pick a kit, pick your halls, £20 deposit, balance on delivery"],
      ["users_w", "Referral", "£10 off for each friend who orders; arrival groups make this spread on its own"],
      ["truck_w", "Delivery day", "A branded van outside halls on check-in day is the winter-kit sign-up sheet"],
    ];
    rows.forEach((r, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      iconRow(s, r[0], r[1], r[2], 0.5 + col * 4.65, 1.35 + row * 1.25, 4.35, { h: 0.9 });
    });
  }

  // ================= 10. Competition =================
  {
    const s = pres.addSlide();
    s.background = { color: WHITE };
    title(s, "Where the alternatives fall short");
    const cols = ["National kit sites", "Amazon / Argos", "Dunelm / B&M", "Landed"];
    const rowsData = [
      ["In your room before check-in", [false, false, false, true]],
      ["Built for an Aberdeen winter", [false, false, false, true]],
      ["Buys it back in May", [false, false, false, true]],
      ["Summer storage", [false, false, false, true]],
      ["Local WhatsApp support", [false, false, false, true]],
      ["No trip on the bus", [true, true, false, true]],
    ];
    const labelX = 0.5, labelW = 3.0, colW = 1.5, colX0 = 3.6, hy = 1.35, hh = 0.5, rh = 0.5;
    // highlight Landed column
    card(s, colX0 + 3 * colW - 0.05, hy - 0.1, colW + 0.1, hh + rowsData.length * rh + 0.2, AMBER_TINT);
    cols.forEach((c, j) => {
      s.addText(c, { x: colX0 + j * colW, y: hy, w: colW, h: hh, margin: 0, isTextBox: true, fontFace: BODY_FONT, fontSize: 12.5, bold: true, color: GRANITE, align: "center", valign: "middle" });
    });
    rowsData.forEach((r, i) => {
      const y = hy + hh + i * rh;
      if (i % 2 === 0) s.addShape(pres.ShapeType.rect, { x: labelX, y, w: labelW + 3 * colW, h: rh, fill: { color: FOG }, line: { color: FOG, width: 0 } });
      s.addText(r[0], { x: labelX + 0.15, y, w: labelW - 0.15, h: rh, margin: 0, isTextBox: true, fontFace: BODY_FONT, fontSize: 13, color: INK, valign: "middle" });
      r[1].forEach((v, j) => {
        const cx = colX0 + j * colW + colW / 2 - 0.16, cy = y + rh / 2 - 0.16;
        if (v) iconCircle(s, "check_w", cx, cy, 0.32, j === 3 ? AMBER : GRANITE);
        else iconCircle(s, "x_g", cx, cy, 0.32, "D9E0E6");
      });
    });
    s.addText("National kit sites courier a generic box to an address you may not have yet. Shops need a bus, a free afternoon and two strong arms.", {
      x: 0.5, y: 4.95, w: 9, h: 0.4, margin: 0, isTextBox: true, fontFace: BODY_FONT, fontSize: 11, italic: true, color: MUTED, valign: "middle",
    });
  }

  // ================= 11. Budget and ask =================
  {
    const s = pres.addSlide();
    s.background = { color: WHITE };
    title(s, "Starting budget and the ask");
    s.addChart(pres.charts.DOUGHNUT, [
      { name: "Budget", labels: ["Sample kits and photos £250", "Early stock float £360", "Flyers and ads £200", "Van hire, two days £180", "Storage unit deposit £150", "Web and domain £60"], values: [250, 360, 200, 180, 150, 60] },
    ], {
      x: 0.4, y: 1.25, w: 4.9, h: 3.9, holeSize: 55,
      chartColors: [AMBER, GRANITE, "5C6B78", "F3C27A", "9FB0BC", "D5DDE3"],
      showTitle: true, title: "Starting budget: £1,200", titleFontSize: 13, titleColor: GRANITE, titleFontFace: BODY_FONT,
      showLegend: true, legendPos: "r", legendFontSize: 10, legendColor: INK, legendFontFace: BODY_FONT,
      showValue: false, showPercent: false,
    });
    s.addText("The ask", { x: 5.6, y: 1.3, w: 3.9, h: 0.35, margin: 0, isTextBox: true, fontFace: BODY_FONT, fontSize: 16, bold: true, color: GRANITE });
    iconRow(s, "home_w", "Two halls partnerships", "A slot in the welcome pack at one UoA and one RGU building", 5.6, 1.75, 3.9, { h: 0.6 });
    iconRow(s, "users_w", "Introductions", "To the international student societies before their summer arrival groups form", 5.6, 2.7, 3.9, { h: 0.6 });
    iconRow(s, "package_w", "£3,000 float", "A start-up grant or loan so stock can be bought six weeks early at bulk prices", 5.6, 3.65, 3.9, { h: 0.6 });
    s.addText("Pre-orders fund the stock: £20 deposit at reservation, balance on delivery, wholesale ordered against confirmed numbers.", {
      x: 5.6, y: 4.5, w: 3.9, h: 0.65, margin: 0, isTextBox: true, fontFace: BODY_FONT, fontSize: 11, italic: true, color: MUTED, valign: "top",
    });
  }

  // ================= 12. Next 90 days =================
  {
    const s = pres.addSlide();
    s.background = { color: GRANITE };
    title(s, "The next twelve months", { color: WHITE });
    const steps = [
      { when: "Oct 2026", what: "Winter kit soft launch, 40 units, sold through societies. Proves the channel." },
      { when: "Nov to Dec", what: "30 conversations with international students; finalise arrival kit contents and price." },
      { when: "Jan to Mar 2027", what: "Halls and wholesaler agreements; pre-order page live." },
      { when: "May 2027", what: "First collections, buy-back and summer storage." },
      { when: "Jun to Jul", what: "Pre-orders open for the 2027 intake." },
    ];
    const n = steps.length, cw = 1.75, x0 = 0.5, y0 = 1.45;
    s.addShape(pres.ShapeType.line, { x: x0 + cw / 2, y: y0 + 0.2, w: cw * (n - 1), h: 0, line: { color: "4B5A67", width: 2 } });
    steps.forEach((st, i) => {
      const x = x0 + i * cw;
      s.addShape(pres.ShapeType.ellipse, { x: x + cw / 2 - 0.2, y: y0, w: 0.4, h: 0.4, fill: { color: AMBER }, line: { color: AMBER, width: 0 } });
      s.addText(st.when, { x, y: y0 + 0.55, w: cw, h: 0.3, margin: 0, isTextBox: true, fontFace: BODY_FONT, fontSize: 13, bold: true, color: WHITE, align: "center" });
      s.addText(st.what, { x: x + 0.08, y: y0 + 0.85, w: cw - 0.16, h: 1.3, margin: 0, isTextBox: true, fontFace: BODY_FONT, fontSize: 11.5, color: FOG, align: "center", valign: "top" });
    });
    s.addShape(pres.ShapeType.roundRect, { x: 0.5, y: 3.85, w: 9, h: 0.85, fill: { color: AMBER }, line: { color: AMBER, width: 0 }, rectRadius: 0.12 });
    s.addText("Go / no-go: 50 paid deposits by 31 July 2027. Fewer than that, and the arrival kit stays a winter-kit side line.", {
      x: 0.8, y: 3.85, w: 8.4, h: 0.85, margin: 0, isTextBox: true, fontFace: TITLE_FONT, fontSize: 16, bold: true, color: GRANITE, valign: "middle",
    });
    s.addText("[Your name]   |   [email]   |   [phone]   |   Aberdeen", { x: 0.5, y: 4.9, w: 9, h: 0.3, margin: 0, isTextBox: true, fontFace: BODY_FONT, fontSize: 12, color: LIGHT });
  }

  await pres.writeFile({ fileName: require("path").join(__dirname, "Landed-pitch-deck.pptx") });
  console.log("written");
}

main().catch((e) => { console.error(e); process.exit(1); });
