#!/usr/bin/env node
/**
 * Records the 30-second tour video, silent, to docs/video/tour.webm: a parent opens a demo
 * family, takes the guided tour (adding points, a warning and a mark on the way), and ends on
 * the child's view. Everything on screen is the demo's made-up family.
 *
 * It prints when each step starts; docs/video/tour-voiceover.md is timed to those marks, and
 * scripts/tour-voiceover.py turns the recording into the narrated public/tour.mp4.
 *
 *     npx playwright install chromium   # once
 *     node scripts/tour-video.js
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ROOT, PHONE, startServer, phonePage } = require('./guide-pictures');

const OUT = path.join(ROOT, 'docs', 'video', 'tour.webm');

// How long each tour step stays on screen, in seconds.
const HOLD = {
  'Earning points': 3.4,
  Warnings: 2.8,
  Penalties: 2.9,
  'Weekly challenges': 3.4,
  Rewards: 3.0,
  'History and undo': 2.8,
  Settings: 2.6,
  "Your child's phone": 3.2,
};

async function main() {
  const { chromium } = require('@playwright/test');
  const server = await startServer();
  const browser = await chromium.launch();
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'little-wins-video-'));
  try {
    const { context, page } = await phonePage(browser, server.base, {
      deviceScaleFactor: 1,
      reducedMotion: 'no-preference',
      recordVideo: { dir: folder, size: PHONE },
    });
    const start = Date.now();
    const mark = (what) =>
      console.log(`${((Date.now() - start) / 1000).toFixed(1).padStart(5)}s  ${what}`);
    const wait = (s) => page.waitForTimeout(Math.round(s * 1000));

    await page.goto('/');
    await page.getByRole('button', { name: 'Try a demo' }).waitFor();
    mark('sign-in page');
    await wait(1.8);
    await page.getByRole('button', { name: 'Try a demo' }).click();
    const banner = page.getByRole('region', { name: 'Demo' });
    await banner.waitFor();
    mark('demo family');
    await wait(1.0);
    await banner.getByRole('button', { name: 'Take the tour' }).click();

    const caption = page.locator('.tour-caption');
    for (const [title, hold] of Object.entries(HOLD)) {
      await caption.locator('h3', { hasText: title }).waitFor();
      mark(title);
      if (title === 'Earning points') {
        await wait(hold / 2);
        await page.locator('[data-tour=earn] [data-action=add]').click();
        await wait(hold / 2);
      } else if (title === 'Warnings') {
        await wait(hold / 2);
        await page.locator('[data-tour=warn]').click();
        await wait(hold / 2);
      } else if (title === 'Weekly challenges') {
        await wait(hold / 2);
        await page.locator('[data-tour=marks] button.d').last().click();
        await wait(hold / 2);
      } else {
        await wait(hold);
      }
      const last = title === "Your child's phone";
      await caption.getByRole('button', { name: last ? 'Done' : 'Next' }).click();
    }
    await page.locator('.tabs [data-tab=today]').click();
    await banner.getByRole('button', { name: "Mia's view" }).click();
    await page.locator('.who').waitFor();
    mark("Mia's view");
    await wait(2.6);
    mark('end');

    const video = page.video();
    await context.close();
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    await video.saveAs(OUT);
  } finally {
    await browser.close();
    server.stop();
    fs.rmSync(folder, { recursive: true, force: true });
  }
  console.log(`wrote ${path.relative(ROOT, OUT)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
