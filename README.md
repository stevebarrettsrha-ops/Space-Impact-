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
| F | full screen |
| P | pause |

On phones and tablets an on-screen stick and buttons appear automatically.

## Fitting the screen

The handset ran at a fixed 240×320. Here the framebuffer follows the window instead of
the other way round, because a fixed buffer can only ever be *either* sharp *or* full
screen: a whole-number scale leaves the window unfilled, and a fractional one softens
every letter.

So on every resize the game picks one integer **N** and a logical buffer that tiles the
display exactly: the canvas backing store is `bufW×N` by `bufH×N` device pixels, the CSS
box is that divided by the device pixel ratio, and presenting a frame is a plain N×N
block copy. There is no fractional scaling anywhere in the pipeline, so nothing is ever
resampled — text, portraits and sprites are pixel exact at any size — and because the
buffer is chosen from the window, the picture reaches all four edges.

N is aimed at roughly 320 logical rows, so a letter is always about the same share of the
screen; it is raised if the buffer would cost the software rasteriser more than it can
afford, and lowered again if a tall narrow window would be left with fewer columns than
the interface was drawn for. A very dense display has its target halved rather than
blitting fifteen million pixels a frame — the ratio stays whole, so the browser's own
upscale is still exact.

| window | buffer | backing store | logical |
|---|---|---|---|
| 1366×768 | ×3 | 1365×768 | 455×256 |
| 1920×1080 | ×3 | 1920×1080 | 640×360 |
| 2560×1440 | ×5 | 2560×1440 | 512×288 |
| 3840×2160 | ×7 | 3836×2156 | 548×308 |
| 390×844 @3× (portrait, touch band) | ×5 | 1170×1970 | 234×394 |

The sector is drawn full bleed, so the water and the boat use the whole display. The 2D
screens — menus, the station, conversations — are laid out inside a centred **page** kept
near the proportions they were drawn for, with the surround painted as the same water
further off. Everything reads `SCR_W` / `SCR_H`, which report the page while a screen is
being drawn and the whole buffer while the sector is, so the hand-placed coordinates of
the original interface still land where they should.

`F` toggles full screen.

On a touch device the controls get room of their own where there is any: a band beneath
the screen in portrait, with the stick and buttons sized from the space actually
available. In landscape the picture now runs edge to edge, so they overlay it at reduced
opacity, the way a modern handheld game does.

## Rendering for a modern display

Three things changed once the buffer stopped being 240×320.

* **Solid surfaces are sampled bilinearly.** The atlases pack many sprites side by side,
  so the four taps are clamped to each polygon's own texel box — it smooths a hull or a
  rock face without ever fetching a neighbour's art. Cut-outs and glows stay on nearest:
  filtering a keyed edge would drag the key colour into the picture.
* **Text is set at the display's real resolution.** The 2D layer is drawn straight onto
  the visible canvas with the logical grid as a transform, rather than into the low
  resolution surface and blown up with it. That let the handset's own 11x16 display face
  go: at this size its "a" and "n" are near enough the same shape that a menu item is
  guesswork. Menus, the HUD and the conversations are now set in a hinted, anti-aliased
  interface face — with the one pixel shadow the original glyphs carried built in, so it
  still holds up over the water — while sprites, portraits and the sector stay pixel
  exact beside it. The measuring, wrapping and drawing API did not change, so every
  hand-placed coordinate in the interface still lands where it did.
* **Particles are round and blended.** Bubbles, marine snow and sparks were flat squares
  of solid colour; at modern resolutions they read as confetti. They are now soft discs
  composited over what is behind them.
* **Everything solid collides.** The boat is a sphere and so is every station, wreck,
  ship and whale; running into one stops the boat at the contact point, costs hull in
  proportion to how hard the nose was driving in, and stalls the throttle. The hit lands
  once, on contact, so scraping along a hull you are already pressed against costs
  nothing but progress. Kelp, gates and waypoints are deliberately not solid — you swim
  through the first and fly through the others. Traffic is kept out of the station hull,
  and bolts stop at it instead of sailing through the middle.

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
**System → Settings → Language**, and the interface face covers both alphabets.

Reload times for weapons are the one thing not stored numerically in `equipment.txt` — the
item descriptions state them in words ("long reload", "improved", "short"), so they are
tabulated in `js/data.js` to match the text.

## Source layout

```
index.html        shell, styling, touch controls
js/assets.js      de-obfuscation and the PNG / BMP / .lang loaders
js/model.js       Mascot Capsule Micro3D v3 (.mbac) parser
js/gfx.js         software rasteriser, depth fog, projection
js/ui2d.js        text, the UI widgets and the portrait compositor
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
