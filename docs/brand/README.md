# Formly icon

Generated with the built-in image-generation tool. The original PNG is kept in `formly-icon-source.png`; alpha-preserving browser canvas resizes are in `public/icons/` (16, 32, 48, 128, and 256 px). The manifest uses the first four sizes for the extension and toolbar. Options, onboarding, and documentation share the same artwork.

To recreate the sizes from the master:

```sh
npx playwright install chromium
npm run icons
```

## Generation prompt

```text
Use case: logo-brand
Asset type: production browser extension icon for Formly, a tool that fills website forms with fictional test data.
Primary request: Create one polished, distinctive app icon replacing a generic square letter F. A crisp ivory form sheet with two short indigo input lines and a small mint-green completion sparkle integrated at its lower right, on a rich periwinkle-indigo softly rounded square tile. Bold silhouette, optically balanced, premium restrained flat graphic design with only a very subtle dimensional finish. The form motif must remain recognizable as a tiny toolbar icon.
Composition: one centered icon only, square 1024x1024 canvas, tile nearly fills the canvas with narrow consistent padding. Transparent outer background and clean alpha edges.
Palette: indigo matching #5370ce, warm ivory, pale mint.
Constraints: no letters, no text, no F, no mockup, no device, no watermark, no multiple variations, no fine detail, no dramatic drop shadow.
```
