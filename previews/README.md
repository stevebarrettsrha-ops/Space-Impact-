# Model catalogue

`catalog.webp` contains 108 transparent 128 × 96 pictures in a 12-column atlas:

- 22 ship pictures (two angles for all 11 classes).
- 44 equipment pictures, with geometry for each equipment category and tier.
- 42 cargo pictures, including all 18 live creature/algae models and 24 goods.

`js/catalog.js` maps each cell back to the existing item ID and its logical UI size.
High-resolution source cells do not change shop rows, prices or save identifiers.
The game loads this local atlas instead of the legacy ship/equipment/cargo sprites.

To regenerate after changing models, install the optional development dependency
`@napi-rs/canvas`, then run `node tools/bake-previews.cjs`. The script loads the actual
material artwork and renders the model pictures through `js/gfx.js`. It preserves
transparent backgrounds using the rasterizer's depth buffer. The shipped game has no
runtime dependencies and does not generate these pictures on startup.
