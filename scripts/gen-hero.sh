#!/usr/bin/env bash
# Generates the hero slideshow visuals (assets/hero/<id>.png, 1536x1024) with OpenAI gpt-image-1 through the
# ask-gpt skill (OpusOS bridge on :8001), then cuts them to WebP with scripts/hero-webp.cjs.
# The slide list, tags and featured items live in web/hero-slides.js; this file only holds the scene prompts.
#
#   scripts/gen-hero.sh                 # every slide that is missing
#   scripts/gen-hero.sh bed-duvet tea   # only these (regenerates them)
#   FORCE=1 QUALITY=high JOBS=2 scripts/gen-hero.sh
set -euo pipefail
cd "$(dirname "$0")/.."
ASK="$HOME/.claude/skills/ask-gpt/ask.sh"
OUT=assets/hero; mkdir -p "$OUT"
JOBS="${JOBS:-4}"

STYLE="Photorealistic interior photograph, editorial real-estate style, 35mm lens, natural composition, no people, no hands, no text, no logos, no watermarks. A real, modest student home in Aberdeen, Scotland: pale walls, light wood furniture, grey granite tenements or a granite campus visible through the window. The featured items are the clear subject: placed in the foreground or centre, lit by a warm pool of light (a desk lamp or low sun) while the rest of the room sits in soft, slightly cooler shade, so the eye goes to them first. Palette: cream, natural fabric and light wood with warm amber accents and charcoal-navy details. Crisp, calm, inviting, believable."

declare -A P=(
  [bed-duvet]="A small halls single room at dusk. A freshly made bed with a plump white 10.5 tog duvet in a plain cotton cover and two full white pillows, a folded soft grey bath towel and hand towel at the foot of the bed, catching warm lamplight. A suitcase still closed by the door."
  [kettle-mugs]="A study desk under a window in a halls room, evening. A compact white electric kettle on its base with steam rising, two cream ceramic mugs beside it and a plain navy tea tin with no writing on it, all in the warm glow of a desk lamp; the made bed soft in the background."
  [kitchen-pans]="A shared student flat kitchen in the morning. On the hob a non-stick frying pan and a small stainless saucepan with lid; on the counter two white plates, two bowls and a cutlery set for two laid out neatly, sunlight across them. Granite rooftops through the window."
  [window-granite]="A bright morning in a student bedroom: a made bed with a white duvet and two pillows right by a large window, grey granite tenements and a wet street outside, low sun raking across the crisp bedding."
  [studio-flat]="A compact studio flat: a made bed with white bedding, and in the kitchenette a white kettle, a beech chopping board with a chef's knife and two mugs on the counter, lit by under-cabinet light, everything else in gentle shade."
  [bottle-bed]="A cosy halls room on a wet winter night, rain on the window. On the made bed a classic hot water bottle in a soft grey knitted cover on top of the duvet; a charcoal knitted beanie and a pair of thick grey wool socks on the chair, all in warm lamplight."
  [thermal-socks]="An armchair beside a radiator in a student flat living room, dark outside. Folded on the chair a charcoal long-sleeve thermal base layer and a pair of thick grey wool-mix socks, a steaming mug of tea on the side table, warm side light."
  [tea-rowies]="A small kitchen table in a tenement flat, morning. A plain navy tea tin with no writing or label, a brown paper bakery bag with two golden flaky Aberdeen rowies (butteries) in front of it, a cream mug of tea; soft window light, granite outside."
  [plug-desk]="A student desk in a halls room at night: a laptop charging through a white UK three-pin adaptor into a white four-socket extension lead running along the desk, a warm desk lamp on, a mug, the bed made in the background."
  [laundry-towels]="A bright shared flat utility corner: a cream cotton drawstring laundry bag hanging on a hook and two folded striped tea towels on the counter beside the sink, morning light, granite wall outside the window."
  [living-room-both]="A tenement flat living room with a bay window, late afternoon. An open cardboard moving box on the floor, a folded white duvet and a white kettle lifted out beside it, a knitted hot water bottle resting on the sofa arm; warm low sun on the box."
  [night-lamp]="First night in a halls room: lights of the city and the harbour through a dark window, a warm desk lamp switched on, the bed made with a white duvet turned down at one corner, two pillows, a mug on the desk, calm and safe."
  [kitchen-morning]="A student flat kitchen table set for two in the morning: two white plates, two bowls, two cream mugs and cutlery for two, a white kettle on the counter behind, sunlight through a sash window with granite outside."
  [winter-window]="A halls bedroom window with frost at the edges and snow on the granite rooftops outside, morning. On the windowsill a knitted hot water bottle and a charcoal beanie; the made bed with a thick white duvet in soft daylight."
  [topper-bed]="A student bedroom, afternoon light. The white duvet folded back at one corner to show a quilted mattress topper and a fitted white sheet on the mattress, two full pillows, a towel folded on the chair; warm light on the bedding."
  [drying-rack]="A bright flat bedroom by a window: a folding white clothes drying rack with a grey towel and a few clothes hanging over the rails, a small desk lamp on the desk, a made bed behind, soft afternoon light."
  [house-share]="A shared student house living room at dusk: a coffee table with a white kettle, two cream mugs and a box of tea in warm lamplight, a knitted throw on the sofa, an open box of bedding by the stairs, granite houses through the window."
  [bedside-winter]="A bedside table in a halls room at night: a small white bottle of vitamin D tablets, a black contoured sleep eye mask and a knitted hot water bottle beside a warm lamp, the duvet and pillows soft behind, rain on the window."
)

if [ $# -gt 0 ]; then names=("$@"); else names=("${!P[@]}"); fi
gen() {
  local n="$1" f="$OUT/$1.png"
  if [ -z "${FORCE:-}" ] && [ -f "$f" ] && [ -z "${EXPLICIT:-}" ]; then echo "skip $n (exists)"; return; fi
  bash "$ASK" --image "$f" --size 1536x1024 --quality "${QUALITY:-medium}" "${P[$n]} $STYLE" >/dev/null \
    && echo "ok   $n" || echo "FAIL $n" >&2
}
export -f gen; export ASK OUT STYLE FORCE EXPLICIT QUALITY
[ $# -gt 0 ] && export EXPLICIT=1
declare -p P > /tmp/gen-hero.prompts; export PROMPTS=/tmp/gen-hero.prompts
printf '%s\n' "${names[@]}" | xargs -P "$JOBS" -I{} bash -c 'source "$PROMPTS"; gen "$1"' _ {}
node scripts/hero-webp.cjs
