# Visual direction from the supplied references

The six reference images supplied on 10 October 2026 replace the earlier assumption
that a broad pyramidal building was the intended station design.

| References | Features to preserve or pursue |
| --- | --- |
| `image(6).png` through `image(9).png` | Recognisable DEEP industrial modules, open connecting trusses, dense mechanical surfaces, angular ships and bright paired engine trails. Preserve scale and separate structures. |
| `image(10).png` | Pressure tanks, pipes, railings, portholes, maintenance platforms and varied worn metal. Use these details without making every large station cylindrical. |
| `image(20261010-233716).png` | Layered underwater depth, dark rock silhouettes, small aquatic life and local cyan illumination. This is an atmosphere reference, not an in-game capture. |

## This correction

- Replace the oversized pyramidal crown with offset, stacked command decks.
- Narrow the core and expose the connecting trusses. Add actual railings, tanks,
  conduits and maintenance galleries to all station families and tiers.
- Increase manufactured material atlas density, add normal/roughness/metalness
  channels and subdivide large faces so the panels do not stretch across a hangar.
- Move propulsion pods outboard and render two continuous soft trails with bubbles.
- Add distant canyon ridges outside the playable sphere. They provide depth cues
  without adding invisible obstacles to existing flight routes.
- Rebuild the shop catalogue from the current ship, equipment and cargo models.

## Research and limits

[Three.js material documentation](https://threejs.org/docs/pages/MeshStandardMaterial.html)
describes separate colour, roughness, metalness and normal maps, and recommends an
environment map. Normal maps change lighting, not the actual silhouette. This
supports using geometry for trusses and pipes and surface maps for small seams.
The game keeps its renderer; this change does not add Three.js or claim full PBR.

[NVIDIA's water-caustics chapter](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-2-rendering-water-caustics)
distinguishes plausible real-time approximations from physically accurate water
lighting. Caustics, scattering and light shafts need to respond to the environment;
a blue background or uniform glow cannot reproduce the final reference by itself.

[glTF loading documentation](https://threejs.org/docs/pages/GLTFLoader.html)
provides a practical reference for a future authored-model pipeline. Matching the
last two images more closely still calls for dedicated high-detail models,
environment lighting/reflections and shadowed local volumetric lights. This pass
does not implement those systems and should not be described as photorealistic.

Judge progress with actual gameplay captures and consistent-camera model renders.
Do not use a generated concept image as proof of the game's output. The supplied
reference images are not copied into the shipped assets.
