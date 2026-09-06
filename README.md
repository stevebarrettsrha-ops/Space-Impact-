# DEEP — Submarine Odyssey

A faithful browser recreation of **Deep 3D** (Fishlabs Entertainment, 2007), built directly
on the original MIDlet's own assets — the ones in this repository.

Nothing here is a re-drawing or a re-imagining: the submarines, sea creatures, station
modules, S.T.R.E.A.M. gates, mines and explosions you see are the original Micro3D meshes,
textured with the original `deep.bmp` / `fx.bmp` atlases, laid out with the original
interface art and driven by the original data tables. The only thing that changed is the
language: the game now ships an English language pack alongside the Russian one.

Open `index.html` through any web server (see *Running* below) and play.

---

## What the game is

You are a colonist on the ocean planet Kappa in the year 3601, caught between a radioactive
atmosphere above and crushing pressure below, trying to make a living with a harpoon.

* **Fly** a submarine through 3D underwater sectors — throttle, booster, chase or cockpit view.
* **Fish** with a harpoon: 13 species and 5 kinds of algae, each with its own weight,
  toughness and market value.
* **Fight** pirates, colonist patrols, Aquarians and minefields with railguns, coil guns,
  fusion cannons, mass drivers and torpedoes.
* **Trade** across 200 stations, each with its own tech level, depth and price band —
  and **produce** your own goods in the station factory from the original recipes.
* **Outfit** your boat: 11 hulls and 44 pieces of equipment, all at their original prices.
* **Work** the job board: 15 kinds of freelance mission with generated clients and rewards.
* **Follow the story**: 26 chapters, from Jack Dawn's fish quota to the liberation of Gosu,
  with M.A.I., Pierre, Lea, Ayumi, Raymond and Fenko — every line of dialogue translated.
* **Collect** 24 medals in bronze, silver and gold.

## Controls

| Key | Action |
|-----|--------|
| Arrows / WASD | steer, and navigate menus |
| Space / Enter | fire, confirm |
| Esc | back / cancel |
| 1 | switch weapon |
| 7 | auto fire |
| 3 | booster |
| 9 | autopilot |
| 0 | dock / enter S.T.R.E.A.M. — and Help on any station screen |
| 2 / 8 | throttle up / down |
| C | camera (chase / cockpit) |
| P | pause |

On phones and tablets an on-screen stick and buttons appear automatically.

## Fitting the screen

The picture is a fixed 240×320 — the resolution Deep 3D was authored for — and is scaled
to the window with a single uniform factor, so it can never be stretched. Both sides are
derived from that one number, so the ratio stays exactly 3:4 rather than drifting a pixel
either way.

Once there is room for a whole multiple the scale snaps to an integer and the pixel art
stays crisp (2× on a laptop, 3× at 1080p, 4× at 1440p, 6× at 4K). Below 2× it scales
freely so a handset is filled edge to edge, and it is allowed to go under 1× so a short
window shows the whole screen instead of clipping it. The cabinet around the screen is
budgeted for, and dropped entirely when the window has no room to spare.

On a touch device the controls get room of their own rather than sitting on the picture:
a band beneath the screen in portrait, the side gutters in landscape, with the stick and
buttons sized from the space actually available. They only overlay the picture — and then
at reduced opacity — when there is nowhere else for them to go.

## Running

The game reads the original binary assets with `fetch()`, so it needs to be served over
HTTP — opening the file directly from disk will not work.

```sh
python3 -m http.server 8000
# then open http://localhost:8000/
```

GitHub Pages serves it as-is with no build step.

---

## How the original assets are used

### Resource obfuscation

Every resource inside the MIDlet is scrambled: the loader swaps the first *n* bytes of a
file with the mirrored last *n* bytes, where *n* depends on the file length
(`10 + len%10` under 100 bytes, `50 + len%20` under 200, `80 + len%20` under 300,
`100 + len%50` otherwise). Nothing else is altered, so undoing the swap restores the
byte-exact original PNG, BMP, MBAC or MTRA. `js/assets.js` does this in the browser, which
is why the files in this repository are left completely untouched.

### 3D models

The meshes are HI CORP **Mascot Capsule Micro3D v3** `.mbac` files — format version 5 with
bit-packed vertex blocks, 7/7/1 packed unit normals and bit-packed polygon indices with
8-bit texel coordinates. `js/model.js` parses all 75 of them and flattens the bone
hierarchy; `js/gfx.js` draws them with a perspective-correct, z-buffered software
rasteriser into a 240×320 framebuffer, with depth fog for the water.

### Lights, and the two keying conventions

The atlases mix two kinds of transparency, and getting them wrong is what puts a black
box around every light. Cut-out cells — the algae — leave their surround on palette
index 0. Glow cells — station lights, engine exhaust, laser bolts, explosions, the
S.T.R.E.A.M. portal — paint theirs pure black, because the handset blended black away.
Index 0 is *white* in both atlases, and inside a glow cell it is the hot core, so it
cannot be keyed there either.

`Micro3D.classifyBlend` therefore sorts every polygon once at load time by looking at
the texels it actually covers, and tags it opaque, cut-out or additive; the rasteriser
drops index 0 for cut-outs and black for glows, and lets fog thin an emissive surface
rather than tint it, so no halo is left behind.

### Data

| File | Used for |
|------|----------|
| `txt/stations.txt` | 200 stations: name, tech level, map position, depth |
| `txt/ships.txt` | 11 hulls: armour, hold, price, slots, handling |
| `txt/equipment.txt` | 44 items: type, availability, price, stats |
| `txt/goods.txt` | 42 commodities: price bands and factory recipes |
| `txt/creatures.txt` | 18 species: weight and toughness |
| `txt/names_human_*.txt` | mission client names |
| `ru/*.lang`, `en/*.lang` | all in-game text |

### The English language pack

`en/` mirrors `ru/` exactly: 52 files, 1,049 strings, in the same
`DataOutputStream.writeUTF` record format (2-byte big-endian length + UTF-8), index for
index. English is the default; the Russian pack is still selectable from
**System → Settings → Language**, and the bitmap font carries both alphabets.

Reload times for weapons are the one thing not stored numerically in `equipment.txt` — the
item descriptions state them in words ("long reload", "improved", "short"), so they are
tabulated in `js/data.js` to match the text.

## Source layout

```
index.html        shell, styling, touch controls
js/assets.js      de-obfuscation and the PNG / BMP / .lang loaders
js/model.js       Mascot Capsule Micro3D v3 (.mbac) parser
js/gfx.js         software rasteriser, depth fog, projection
js/ui2d.js        the original bitmap font and the UI widgets
js/data.js        the txt/ tables and language lookups
js/world.js       player, ship, economy, job board, medals, saves
js/audio.js       WebAudio sound design (the AMR/MIDI cues cannot be decoded in a browser)
js/flight.js      the 3D sector: flying, fishing, combat, docking, S.T.R.E.A.M.
js/station.js     hangar, shop, missions, job board, trade, factory, map, status, medals
js/campaign.js    the 26 story chapters and the 47 dialogue scenes
js/main.js        boot, input, screen state machine, mission runner
```

## Credits

Deep 3D was created by **FISHLABS Entertainment GmbH** on the ABYSS® Game Engine.
Deep™ and ABYSS® are registered trademarks of FISHLABS Entertainment GmbH.
This is a fan recreation running on the original data files; all original art, models,
text and design are theirs.
