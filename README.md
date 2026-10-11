# DEEP — Submarine Odyssey

A browser recreation of **Deep 3D** (Fishlabs Entertainment, 2007), with realistic
character portraits, new ship and station models, and a modern material, lighting and
animation pass. The original game tables, story and creature identities are preserved.
The game ships English and Russian language packs.

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
resampled for layout — text and portraits use the device resolution — and because the
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

## How much the sector is drawn at

The 3D scene uses WebGL at the canvas's device resolution, independently of the
logical UI grid. Hardware anti-aliasing, mipmapped textures and anisotropic filtering
(where supported) smooth edges and distant materials. The renderer no longer lowers
GPU resolution in response to CPU frame timing.

**Settings → Detail** is remembered:

* `AUTO` and `NATIVE` use the full display backing store with WebGL.
* `BALANCED` caps the WebGL scene near two million pixels, with smooth presentation.

If WebGL is unavailable or its context is lost, the software renderer keeps the game
usable. Its automatic scaling has a 360-row minimum on displays that can fit it.
Restoring the graphics context rebuilds GPU resources. Performance depends on the
browser, graphics hardware, display density and scene; no fixed frame rate is promised.

## Rendering for a modern display

The layout and rendering grids are independent.

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
  still holds up over the water. Portraits and reduced-resolution sector frames use
  smooth resampling. The measuring, wrapping and drawing API did not change, so every
  hand-placed coordinate in the interface still lands where it did.
* **You can see the sector you are flying in.** Working range used to run out around
  480m in a play area 900m across, so the station was a silhouette from halfway out and
  everything past it was water; and every hull sat at half the brightness of its own
  texture. Fog now reaches 1500m at the surface and 980m at the bottom of the trench,
  ambient is up across structures and traffic, a face turned upwards picks up the light
  coming down through the water whichever way the key light points, and the boat carries
  its own lamp — an inverse-square pool about 105m across, measured in view space, so it
  costs one multiply-add per vertex. A ceiling on the shading keeps the lamp from blowing
  out a hull that is already pale. The realism pass adds wet-material highlights and
  absorbs warm wavelengths more quickly with distance.
* **Particles are round and blended.** Bubbles, marine snow and sparks were flat squares
  of solid colour; at modern resolutions they read as confetti. They are now soft discs
  composited over what is behind them.
* **Everything solid collides.** The boat is a sphere; stations use compound hulls, while wrecks,
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
hierarchy. The live game loads the creature source meshes; `js/realism.js` combines
their sections and refines them. `js/mesh-kit.js`, `js/world-assets.js` and
`js/station-model.js` build the replacement hardware. `js/gpu.js` renders the scene
with per-pixel lighting, filtered station shadows, near-plane clipping and wavelength-dependent
water absorption. `js/gfx.js` composites the scene under the native-resolution UI
and retains the software fallback.

### Lights, and the two keying conventions

The archived atlases mix two kinds of transparency, and getting them wrong puts a black
box around every light. Cut-out cells — the algae — leave their surround on palette
index 0. Glow cells — station lights, engine exhaust, laser bolts, explosions, the
S.T.R.E.A.M. portal — paint theirs pure black, because the handset blended black away.
Index 0 is *white* in both atlases, and inside a glow cell it is the hot core, so it
cannot be keyed there either.

`Micro3D.classifyBlend` therefore sorts every polygon once at load time by looking at
the texels it actually covers, and tags it opaque, cut-out or additive; the rasteriser
drops index 0 for cut-outs and black for glows, and lets fog thin an emissive surface
rather than tint it, so no halo is left behind. This remains relevant to creature
bioluminescence. Live ships and stations now use solid attached lamps and impellers;
weapon trails, wakes and explosion flashes are soft depth-tested particles.

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
js/gfx.js         software rasteriser, material lighting, depth fog, projection
js/realism.js     material maps, mesh refinement, complete creatures and deformation
js/mesh-kit.js    shared solid geometry primitives and transforms
js/station-model.js  station families, technology tiers and faction markings
js/world-assets.js   ship fleet, world props, wakes and particle effects
js/catalog.js    pre-rendered ship, equipment and cargo catalogue
js/ui2d.js        text, the UI widgets and realistic portrait rendering
js/data.js        the txt/ tables and language lookups
js/world.js       player, ship, economy, job board, medals, saves
js/audio.js       WebAudio sound design (the AMR/MIDI cues cannot be decoded in a browser)
js/flight.js      the 3D sector: flying, fishing, combat, docking, S.T.R.E.A.M.
js/station.js     hangar, shop, missions, job board, trade, factory, map, status, medals
js/campaign.js    the 26 story chapters and the 47 dialogue scenes
js/main.js        boot, input, screen state machine, mission runner
```

## Character portraits

Jack Dawn, Pierre, Lea, Ayumi, Raymond and Fenko now use the approved realistic
character artwork bundled in `portraits/cast.webp`. Dialogue displays larger,
smooth portraits beside the text on wide layouts and above it on narrow layouts.
Long speeches are paginated: confirm/0 advances through all text before changing
speaker, up/down revisits pages, and Back retains the existing skip behavior.

The old face-part compositor is fully replaced. Players choose from eight realistic
portraits, mission contacts use the same bank, and M.A.I. has a dedicated realistic
avatar. Existing saved appearance numbers map consistently to the new bank. Missing
images fall back to another loaded realistic portrait. Mission contact cards keep
text below the portrait and support up/down scrolling for long descriptions.

All 15 identities are bundled in ten WebP files totalling about 1.2 MB; playing
never requires an image service or CDN. The original extracted face resources are
not loaded or displayed by the game.

## Regression checks

Run `npm test` with Node.js 22 or newer. No dependency installation or build step
is needed, and the game itself still runs as a static site. GitHub Actions runs
the same checks on pushes and pull requests.

The checks exercise difficulty selection, version 1 save compatibility, malformed
or unavailable storage, save feedback, pause dialogs, focus loss, sector result
timing, shield damage, portrait identity/loading, dialogue pagination, material
coverage, mesh validity, whole creatures, animation pixels, occlusion and script
syntax. They load the actual models, game tables and
language pack in an isolated JavaScript runtime; they do not replace browser
playtesting or rendering checks.

Gameplay now pauses when the window loses focus or the tab becomes hidden;
resume explicitly from the pause menu. Mission result delays pause with gameplay.
Loading an invalid or unsupported save preserves the current game, and a failed
manual save displays an error. Existing valid version 1 saves retain their format.

## Creature and world realism

All 13 animal species now render complete bodies with continuous swimming, pulsing,
wing or flipper motion. The eight species with `_01`/`_02` meshes previously alternated
different body sections as if they were frames; those sections are now joined. A hooked
animal stops deforming. Refinement adds curved edges and more geometry up close, while
distant animals and vehicles use the simpler mesh.

Five algae types now have solid, double-sided leaf ribbons with continuous sway and
veined textures. All 11 submarine hulls, enemy ships, stations, gates, mines, torpedoes,
cargo and wreckage receive weathered surface maps and material-specific highlights.
Creature bioluminescence retains its original UVs and colours.

Stations share the same large angular industrial model in flight and the dock console:
stacked command decks, broad armoured hangars, open truss bridges, machinery stacks and
recessed docking entrances. Windows, ribs, work lights, vents and service gantries are
solid attached details. Compound collision boxes follow the major structures, leaving
the central docking throat and gaps between the wings open. Docking range is unchanged.
All 200 stations select from 24 deterministic variants: four families (outpost,
research, refinery and fortified port), three technology tiers and two faction schemes.

All 11 playable ships now have bevelled angular armour, cabins, thick control surfaces, ducted
impellers, maintenance bands and navigation lamps. Workboats, interceptors, raiders,
haulers, twin-hull freighters and luxury craft have different geometry and finishes.
Enemy ships use those same upgraded classes; the mission tanker has its own twin-tank
model. Outboard pods produce continuous paired propulsion trails with a bubble wake.
Every physical impeller uses a shared rotating blade mesh inside its fixed duct,
including the tanker, torpedoes and engine/thruster equipment models. Twin fans
counter-rotate at both detail levels. Player fan speed follows throttle and boost;
animation uses simulation time, freezes on pause and works in both renderers.

The transit gate has a hollow aperture and fixed frame. Mines, torpedoes, cargo crates,
rescue capsules, waypoints and three types of salvage use new solid geometry. Soft
weapon tracers and short explosion flashes replace the old effect meshes; expanding
bubble clouds remain depth-tested against the world.

The hangar, shop and cargo screens use 108 locally bundled model previews: two views
of each ship, all 44 equipment items and all 42 goods. These pictures are rendered
from the live models or matching equipment/cargo models, including the upgraded animals
and algae. `previews/README.md` describes the optional rebuild command.

The water uses animated low-contrast backscatter, depth-dependent light shafts and
caustics that fade at depth, exponential colour absorption, and soft depth-tested
particles. Filtered station shadows establish depth between decks and hangars. The
seabed and distant canyon walls remain outside the navigable volume. These are real-time shading approximations,
not a fluid simulation or ray tracing.

Creature material maps and catalogue pictures are prebuilt and bundled locally. Small
hardware atlases and geometry are constructed once at boot from bundled steel artwork;
there are no image-service calls. `materials/README.md` records the artwork prompt and rebuild steps.
Creature statistics, economy, missions and save formats are unchanged. Station collision
now follows the rebuilt structures instead of a single bounding sphere.

The latest reference-driven correction adds stacked command decks, open truss bridges,
pipework, galleries and railings. Manufactured assets use denser panel textures with
normal, roughness and metalness data, plus consistent texture scale on large faces.
See [visual direction](docs/visual-direction.md) for the supplied references, research
and the remaining gap between these real-time models and the detailed reference art.

## Credits

Deep 3D was created by **FISHLABS Entertainment GmbH** on the ABYSS® Game Engine.
Deep™ and ABYSS® are registered trademarks of FISHLABS Entertainment GmbH.
This is a fan recreation running on the original data files; all original art, models,
text and design are theirs.

### Browser graphics validation

`npm test` runs the gameplay and asset regressions. CI also installs Playwright and
runs `node tools/webgl-smoke.cjs` in Chromium: it checks real WebGL rendering, native
resolution, portrait resizing, station menus, context loss and recovery, and JavaScript/
GL errors. The workflow uploads gameplay captures as `gameplay-browser-captures`.
