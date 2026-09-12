import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Resize the generated master with alpha preserved. No external image requests.
const source = await readFile(new URL('../docs/brand/formly-icon-source.png', import.meta.url));
const output = new URL('../public/icons/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  for (const size of [16, 32, 48, 128, 256]) {
    const encoded = await page.evaluate(async ({ src, size }) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const context = canvas.getContext('2d');
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, 0, 0, size, size);
      return canvas.toDataURL('image/png').split(',')[1];
    }, { src: `data:image/png;base64,${source.toString('base64')}`, size });
    await writeFile(new URL(`icon-${size}.png`, output), Buffer.from(encoded, 'base64'));
  }
} finally {
  await browser.close();
}
