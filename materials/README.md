# Underwater realism materials

The built-in image-generation tool created `surfaces.webp` as a photographic
material sheet. It contains eight samples: fish scales, smooth marine skin,
nautilus shell, turtle shell, painted steel, dark weathered steel, kelp and seabed.
The source image is 1254 × 1254. Columns and rows are sampled independently.

Ten derived 512 × 512 PNG maps preserve the original atlas layout and keyed
transparency while adding natural colour and surface detail. Lossless PNG keeps
the material boundaries stable. They are bundled so no texture baking happens
at game startup. Original emissive polygons use their original atlas directly.

| Maps | Used on |
| --- | --- |
| `deep-metal.png` | All submarine hulls, stations, mines, gates, cargo, torpedoes and capsules |
| `deep-wreck.png`, `fx-wreck.png` | Wreckage and organic debris |
| `fx-scales.png`, `fx-skin.png` | Fish, eels, rays, sharks, whales and squid |
| `fx-shell.png`, `fx-turtle.png`, `fx-shrimp.png` | Shell-bearing species |
| `fx-jelly.png` | Jellyfish |
| `fx-kelp.png` | Archived mesh material; live algae use new textured leaf geometry |

`js/realism.js` defines material parameters, curved mesh subdivision, continuous
deformation and the complete creature models. It retains original gameplay
dimensions and uses simpler geometry at distance. Sun shafts, wet highlights,
caustic modulation and bubble rims are visual approximations, not physically
simulated lighting or fluid dynamics. Camera/model pitch is corrected to agree
with the flight direction; the dock camera uses the matching downward pitch.

To rebuild derived maps, install the optional `@napi-rs/canvas` development tool
and run `node tools/bake-materials.cjs` from this repository. The checked-in game
and `npm test` do not require that package. The original sheet remains unchanged.

## Artwork prompt

Use case: photorealistic-natural. Asset type: game material texture atlas, a single square production texture sheet for a realistic underwater 3D game. Make a strict 4 column by 2 row grid of eight equal edge-to-edge square material samples, no borders no gaps no text. Each cell is a flat orthographic macro photograph with even neutral diffuse lighting, finely detailed but no objects or perspective. Row 1 from left: 1 silvery blue grey small overlapping fish scales with natural mottling; 2 charcoal grey smooth whale and shark skin with fine pores and faint healed scratches; 3 warm ivory and reddish brown banded nautilus shell surface, organic growth lines; 4 olive brown sea turtle shell scutes, irregular hexagonal scutes and fine cracks. Row 2 from left: 5 weathered pale grey submarine painted steel with fine scratches, restrained salt deposits and tiny rust flecks, no large panel lines; 6 dark gunmetal pressure hull steel with subtle machining scratches and corrosion; 7 olive green translucent kelp leaf tissue with longitudinal veins; 8 underwater grey brown basalt and sediment fine gritty surface with tiny pale shells. All materials fully fill their own square, realistic tactile surface detail, no dramatic reflections or baked directional shadows, no typography, no watermarks. Output 2048x2048.
