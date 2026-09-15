#!/usr/bin/env bash
# Generates the skeuomorphic 3D icon theme (web/img/icons/skeuomorphic/) with OpenAI gpt-image-1
# through the ask-gpt skill (OpusOS bridge; needs OpusOS running on :8001).
#
#   scripts/gen-photo-icons.sh            # every icon that is missing
#   scripts/gen-photo-icons.sh kettle mug # only these (regenerates them)
#   FORCE=1 scripts/gen-photo-icons.sh    # regenerate everything
#   JOBS=4 ...                            # parallel requests (bridge has 4 workers)
#
# Masters land in assets/icons/skeuomorphic/<name>.png (1024px, transparent); the page uses the
# 256px WebP cut by scripts/photo-icons-webp.cjs, which this script runs at the end.
set -euo pipefail
cd "$(dirname "$0")/.."
ASK="$HOME/.claude/skills/ask-gpt/ask.sh"
OUT=assets/icons/skeuomorphic; mkdir -p "$OUT"
JOBS="${JOBS:-4}"

STYLE="Photo-realistic 3D rendered product icon, a single object, centred, filling about 80% of the frame, seen in three-quarter view from slightly above. Soft studio lighting from the top left, gentle ambient occlusion, realistic matte materials, crisp edges. Isolated on a fully transparent background with no ground plane, no shadow outside the object, no text, no labels, no logos, no people, no hands. Colour palette: warm cream and natural fabric tones with soft amber #F0A030 accents and charcoal-navy #2A3540 details, consistent across a set of icons."

declare -A P=(
  [kit-arrival]="An open cardboard moving box packed neatly with a folded white duvet, two pillows, a small white kettle and a stack of two plates and two mugs peeking out of the top."
  [kit-winter]="A closed cardboard box with the lid flaps open, a red hot water bottle in a knitted cover, a folded grey thermal top, a pair of thick wool socks and a charcoal beanie arranged on top."
  [kit-both]="Two cardboard boxes side by side, the front one open showing folded white bedding and a kettle, the back one closed with a knitted beanie and wool socks resting on its lid."
  [kit-mix]="A loose, tidy arrangement of assorted student essentials: a folded duvet, a mug, a kettle, a pair of wool socks and a small hot water bottle, each item separate, like pieces to choose from."
  [duvet]="A folded white 10.5 tog duvet with a plain cream cotton cover, neatly stacked."
  [pillow]="Two plump white pillows in plain cotton pillowcases, stacked one on the other."
  [sheet]="A folded white fitted bed sheet with a quilted mattress protector folded on top."
  [towel]="A folded soft grey bath towel with a smaller matching hand towel folded on top."
  [plate]="Two white ceramic dinner plates stacked with two matching white bowls on top."
  [mug]="Two plain cream ceramic mugs side by side, one slightly in front of the other."
  [cutlery]="A cutlery set for two: two stainless steel knives, two forks and two spoons fanned neatly."
  [pan]="A non-stick frying pan with a black handle and a small stainless steel saucepan with lid, nested together."
  [kettle]="A compact white electric kettle with a charcoal handle and lid, on its base."
  [board]="A small beech wood chopping board with a chef's knife resting on it."
  [plug]="A white UK three-pin travel adaptor beside a short white four-socket extension lead, cable coiled."
  [bag]="A cream cotton drawstring laundry bag with two folded striped tea towels resting against it."
  [bottle]="A classic rubber hot water bottle in a soft grey knitted cover."
  [thermal]="A folded charcoal-grey long-sleeve thermal base layer top."
  [socks]="A pair of thick grey wool-mix socks folded together, one cuff turned over."
  [beanie]="A chunky knitted charcoal beanie with a folded brim."
  [vitamin]="A small white bottle of vitamin D tablets with an amber label, a few tablets beside it."
  [mask]="A soft black contoured blackout sleep eye mask with an elastic strap."
  [tea]="A small cardboard box of Scottish breakfast tea in cream and navy with two tea bags in front."
  [rowie]="A brown paper bakery bag folded at the top with two golden flaky Aberdeen rowies (butteries) in front of it."
  [topper]="A rolled white quilted mattress topper tied with a cream fabric strap."
  [lamp]="A small desk lamp with a charcoal metal arm and a warm amber shade, switched on."
  [rack]="A folding white clothes drying rack, partly open, with one grey towel hanging over a rail."
)

if [ $# -gt 0 ]; then names=("$@"); else names=("${!P[@]}"); fi
gen() {
  local n="$1" f="$OUT/$1.png"
  if [ -z "${FORCE:-}" ] && [ $# -eq 1 ] && [ -f "$f" ] && [ -z "${EXPLICIT:-}" ]; then echo "skip $n (exists)"; return; fi
  bash "$ASK" --image "$f" --size 1024x1024 --quality "${QUALITY:-medium}" --background transparent "${P[$n]} $STYLE" >/dev/null \
    && echo "ok   $n" || echo "FAIL $n" >&2
}
export -f gen; export ASK OUT STYLE FORCE EXPLICIT QUALITY
[ $# -gt 0 ] && export EXPLICIT=1
declare -p P > /tmp/gen-photo-icons.prompts; export PROMPTS=/tmp/gen-photo-icons.prompts
printf '%s\n' "${names[@]}" | xargs -P "$JOBS" -I{} bash -c 'source "$PROMPTS"; gen "$1"' _ {}
node scripts/photo-icons-webp.cjs
