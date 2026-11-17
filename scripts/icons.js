#!/usr/bin/env node
/**
 * Makes the app's icons in public/ from the two hand-drawn SVGs there:
 *
 *   icon.svg           rounded square: the favicon, and the source of the PNGs below
 *   icon-maskable.svg  full bleed, star inside the safe zone: Android's maskable icon and iOS
 *
 *   icon-192.png, icon-512.png   manifest icons ("any")
 *   icon-maskable-512.png        manifest icon ("maskable")
 *   apple-touch-icon.png         180 x 180, for "Add to Home Screen" on iOS
 *   favicon.ico                  32 x 32 (a PNG inside an ICO), for browsers that ask for it
 *
 * Run it again after changing an SVG (Playwright's Chromium draws them; dev only):
 *
 *     npx playwright install chromium   # once
 *     node scripts/icons.js
 */
const fs = require('node:fs');
const path = require('node:path');

const PUBLIC = path.join(__dirname, '..', 'public');
const OUT = [
  ['icon.svg', 192, 'icon-192.png'],
  ['icon.svg', 512, 'icon-512.png'],
  ['icon-maskable.svg', 512, 'icon-maskable-512.png'],
  ['icon-maskable.svg', 180, 'apple-touch-icon.png'],
  ['icon.svg', 32, 'favicon.ico'],
];

/** An ICO file holding one PNG image (allowed since Windows Vista; every browser reads it). */
function ico(png, size) {
  const head = Buffer.alloc(22);
  head.writeUInt16LE(0, 0); // reserved
  head.writeUInt16LE(1, 2); // type: icon
  head.writeUInt16LE(1, 4); // one image
  head.writeUInt8(size % 256, 6); // width (0 means 256)
  head.writeUInt8(size % 256, 7); // height
  head.writeUInt8(0, 8); // no palette
  head.writeUInt8(0, 9); // reserved
  head.writeUInt16LE(1, 10); // colour planes
  head.writeUInt16LE(32, 12); // bits per pixel
  head.writeUInt32LE(png.length, 14); // image size
  head.writeUInt32LE(22, 18); // image offset
  return Buffer.concat([head, png]);
}

async function main() {
  const { chromium } = require('@playwright/test');
  const browser = await chromium.launch();
  try {
    for (const [svg, size, name] of OUT) {
      const page = await browser.newPage({ viewport: { width: size, height: size } });
      const data = fs.readFileSync(path.join(PUBLIC, svg)).toString('base64');
      await page.setContent(
        `<style>html,body{margin:0;background:transparent}img{display:block;width:${size}px;height:${size}px}</style><img src="data:image/svg+xml;base64,${data}">`,
      );
      await page.locator('img').evaluate((img) => img.decode());
      const png = await page.screenshot({ omitBackground: true });
      fs.writeFileSync(path.join(PUBLIC, name), name.endsWith('.ico') ? ico(png, size) : png);
      await page.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`wrote ${OUT.map(([, , name]) => `public/${name}`).join(', ')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
