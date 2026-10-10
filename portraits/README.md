# Realistic character artwork

All runtime portraits use this local artwork. The legacy face-part compositor and
the original M.A.I. sprite are no longer loaded or drawn. The extracted original
resources remain in the repository as part of its original game-data archive.

| Asset | Characters | Dimensions |
| --- | --- | --- |
| `cast.webp` | Jack Dawn, Pierre, Lea, Ayumi, Raymond, Fenko | 1312 × 1199 |
| `pilot-01.webp` through `pilot-08.webp` | Player choices and mission contacts | 640 × 800 each |
| `mai.webp` | M.A.I. | 640 × 800 |

The six-character cast sheet preserves the approved designs, encoded as WebP.
`Portrait.CAST` in `js/ui2d.js` samples frames that exclude its names and dividers.
All images are rendered directly into the native-resolution UI with smoothing and
aspect-preserving cropping, without a 40 × 40 intermediate canvas. Numeric saved
appearance seeds map to the eight-picture bank using modulo eight, preserving
save compatibility and consistent identities. Named speakers use independent IDs.

Load these files with `Assets.picture`, never the byte-swapping legacy image
loader. Missing artwork falls back to another available realistic portrait. If no
portrait loads, boot reports the missing artwork rather than showing old faces.

The images were generated for this project with the built-in image generation
tool. They are original interpretations guided by the dialogue roles, not recovered
FISHLABS artwork. Production WebP files total 1,224,508 bytes. The individual source
images were resized proportionally for delivery; the cast sheet retains its source
dimensions. No character features were repainted during asset preparation.

## Art direction and generation prompts

The approved cast board uses realistic cinematic bust portraits, distinct faces,
worn submarine-colony clothing, natural skin texture, softly lit underwater station
backgrounds, clear eyes and restrained teal lighting. Jack is a stern auburn-haired
colonial administrator; Pierre a mature Black resistance organiser; Lea a confident
short-haired rebel pilot; Ayumi a composed East Asian resistance leader; Raymond a
younger auburn-haired adversary; Fenko a shrewd, weathered weapons broker.

The additional portraits use this common prompt followed by each subject below:

> Use case: stylized-concept. Asset type: a single realistic character portrait
> image for DEEP — Submarine Odyssey, a grounded underwater science-fiction
> adventure game. Make a professionally lit, lifelike cinematic portrait approaching
> photography, anatomically correct face, natural skin texture and hair, subtly worn
> practical submarine pilot clothing and pressure collar, blurred deep blue underwater
> station background, soft neutral light on both eyes and restrained teal rim light.
> Full head including hair, neck, shoulders and upper chest in frame; centered facing
> near camera, eyes around upper third, calm alert expression. Portrait-oriented 4:5
> composition. Consistent sophisticated game art direction, no illustration outlines,
> no pixel art, no plastic CGI skin. No text, labels, logos, watermarks, weapons, hands,
> hats or sunglasses. Original fictional person, no celebrity likeness. Subject:

- **pilot-01:** a Black man in his early thirties, dark brown skin, short tightly
  coiled hair, neat short beard, warm brown eyes, broad nose, quiet capable expression,
  dark slate pressure suit with a worn olive shoulder panel.
- **pilot-02:** a South Asian woman in her early thirties, warm medium-brown skin,
  dark curly hair tied back loosely with a few natural wisps, dark eyes, confident
  attentive expression, practical midnight-blue and muted rust submarine pilot jacket.
- **pilot-03:** a white man in his mid-forties, pale weathered skin, short salt-and-pepper
  crew cut, hazel eyes, neatly trimmed stubble, rugged ordinary face, composed expression,
  faded navy work jacket with a dark sealed collar.
- **pilot-04:** an East Asian woman in her late twenties, light warm skin, straight
  black hair in a practical chin-length bob swept away from both eyes, defined cheekbones,
  attentive calm expression, graphite pressure suit with muted teal utility panels.
- **pilot-05:** a South Asian man in his fifties, medium brown weathered skin, shaved
  head, neatly trimmed salt-and-pepper beard, kind steady dark eyes, broad strong face,
  well-used muted brown and dark blue submarine work jacket.
- **pilot-06:** a white woman in her late thirties, pale freckled skin, auburn-red hair
  tied back in a loose practical bun, green eyes, calm experienced expression, navy
  pressure suit with subtle grey-blue shoulder reinforcements.
- **pilot-07:** a Middle Eastern man in his early thirties, olive skin, thick dark
  wavy hair, clean-shaven angular jaw, dark eyebrows and amber-brown eyes, measured serious
  expression, a practical faded graphite and dark maroon submarine pilot suit.
- **pilot-08:** a Black woman in her forties, deep brown skin, very short natural
  tightly coiled hair, strong cheekbones, dark eyes, composed confident expression with
  a faint friendly smile, practical dark navy pressure suit with muted silver utility details.
- **mai:** M.A.I., the submarine's artificial-intelligence assistant, represented by a
  photorealistic female-presenting synthetic human avatar with an adult appearance in
  her thirties, light softly warm skin with realistic natural texture, short sleek
  silver-white bob framing a full visible face, grey-blue eyes, intelligent calm expression
  with subtle warmth. Graphite high collar with restrained luminous teal seams. A faint
  translucent holographic contour and delicate light traces ONLY around her temples and
  collar identify her as an AI, while her face remains natural, realistic, and clearly
  readable. Background is a subdued blurred submarine computer bay. No glowing eyes,
  no robot skull, no doll-like plastic skin.
