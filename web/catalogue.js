/* =====================================================================
   Landed catalogue: kits, items, add-ons and prices.
   ---------------------------------------------------------------------
   One file, two consumers. The order page loads it as a plain script;
   the API imports it as a module (a script without import/export is a
   valid module) and reads the same global. Prices are in GBP. Change a
   price here and both the page and the server-side pricing follow.
   ===================================================================== */
globalThis.LANDED_CATALOGUE = {
  currency: "GBP",
  deposit: 20,
  referralDiscount: 10,       // off the referred order's total
  referralCredit: 10,         // off the referrer's balance
  mixMinimum: 30,
  freeCancelDays: 14,         // free cancellation up to N days before check-in
  winterDelivery: "2026-10-17",  // planned winter-kit delivery day (Saturday) for "both"/winter orders
  kits: {
    arrival: { price: 95,  diy: 140 },
    winter:  { price: 45,  diy: 65 },
    both:    { price: 125, diy: 205 },
    mix:     { price: 0,   diy: 0 },
  },
  items: {
    arrival: [["duvet", 20], ["pillow", 10], ["sheet", 12], ["towel", 10], ["plate", 9], ["mug", 5], ["cutlery", 6], ["pan", 16], ["kettle", 14], ["board", 7], ["plug", 8], ["bag", 5]],
    winter:  [["bottle", 12], ["thermal", 14], ["socks", 7], ["beanie", 7], ["vitamin", 6], ["mask", 5], ["tea", 4], ["rowie", 3]],
  },
  addons: [
    { id: "pillow",   icon: "pillow", price: 8 },
    { id: "topper",   icon: "topper", price: 25 },
    { id: "lamp",     icon: "lamp",   price: 12 },
    { id: "rack",     icon: "rack",   price: 15 },
    { id: "crockery", icon: "plate",  price: 10 },
  ],
  addonMax: 5,
  // English names, used by the server for emails, the admin console and CSV exports
  names: {
    kit: { arrival: "Arrival kit", winter: "Winter kit", both: "Both kits", mix: "Mix and match" },
    item: {
      duvet: "Duvet, 10.5 tog, and cover", pillow: "Two pillows and cases", sheet: "Fitted sheet and protector", towel: "Bath and hand towel",
      plate: "Two plates, two bowls", mug: "Two mugs", cutlery: "Cutlery for two", pan: "Frying pan and saucepan", kettle: "Kettle",
      board: "Chopping board and knife", plug: "UK adaptor and extension lead", bag: "Laundry bag and tea towels",
      bottle: "Hot water bottle", thermal: "Thermal base layer", socks: "Thick wool-mix socks", beanie: "Beanie",
      vitamin: "Vitamin D, 3 months", mask: "Blackout eye mask", tea: "Local tea", rowie: "A bag of rowies",
    },
    addon: { pillow: "Extra pillow", topper: "Mattress topper", lamp: "Desk lamp", rack: "Clothes drying rack", crockery: "Second crockery set" },
  },
  unis: ["UoA", "RGU", "NESCol", "Other"],
  halls: ["Hillhead", "Garthdee", "City centre halls", "Private flat"],
};
