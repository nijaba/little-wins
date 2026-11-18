// The project page (site/) is built into a temp folder and checked: nothing missing, nothing
// loaded from a third party, nothing inline (the page follows the app's strict CSP spirit).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.join(__dirname, '..');
let out;
let html;
let css;

before(() => {
  out = fs.mkdtempSync(path.join(os.tmpdir(), 'lw-site-'));
  execFileSync('sh', [path.join(root, 'scripts', 'build-site.sh'), out], { stdio: 'pipe' });
  html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  css = fs.readFileSync(path.join(out, 'style.css'), 'utf8');
});

after(() => fs.rmSync(out, { recursive: true, force: true }));

// The project's own places: the repository, the project page, and the author's hosted service.
const ALLOWED =
  /^https:\/\/(github\.com\/nijaba\/little-wins|nijaba\.github\.io|little-wins\.nijalabs\.com)(\/|#|$)/;

test('SITE-01 every local href, src and poster in index.html exists in the built folder', () => {
  const refs = [...html.matchAll(/\b(?:href|src|poster)="([^"]*)"/g)].map((m) => m[1]);
  assert.ok(refs.length > 10);
  const local = refs.filter((r) => !/^(https?:|mailto:|#)/.test(r));
  assert.ok(local.includes('tour.mp4') && local.includes('style.css'));
  for (const ref of local) assert.ok(fs.existsSync(path.join(out, ref)), `missing ${ref}`);
  for (const frag of refs.filter((r) => r.startsWith('#')).filter((r) => r.length > 1))
    assert.ok(html.includes(`id="${frag.slice(1)}"`), `no anchor ${frag}`);
  assert.ok(fs.existsSync(path.join(out, '.nojekyll')));
});

test('SITE-02 index.html and style.css link only to the project, never to a third party', () => {
  const urls = [...(html + css).matchAll(/https?:\/\/[^\s"')<>]+/g)].map((m) => m[0]);
  assert.ok(urls.length > 0);
  for (const u of urls) assert.match(u, ALLOWED, `third-party URL ${u}`);
  assert.doesNotMatch(css, /@import|url\(\s*['"]?\/\//);
  // Nothing is fetched on load: only same-origin scripts and stylesheets.
  for (const m of html.matchAll(/<(?:script|link)\b[^>]*>/gi))
    assert.doesNotMatch(m[0], /(?:src|href)="(?:https?:)?\/\//i, m[0]);
});

test('SITE-03 no inline styles, scripts or event handlers', () => {
  assert.doesNotMatch(html, /\sstyle\s*=/i);
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i);
  assert.doesNotMatch(html, /href="javascript:/i);
  for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\b[^>]*>/gi))
    assert.equal(m[1].trim(), '', 'inline script');
  assert.doesNotMatch(html, /<style\b/i);
});

test('SITE-04 the header stars and the app icon are decoration: hidden from screen readers, still with reduced motion', () => {
  const stars = [...html.matchAll(/<span class="sparkle s\d" aria-hidden="true">★<\/span>/g)];
  assert.ok(stars.length >= 5, `${stars.length} stars`);
  assert.equal(
    (html.match(/class="sparkle/g) || []).length,
    stars.length,
    'every star is aria-hidden',
  );
  assert.match(
    css,
    /prefers-reduced-motion: reduce\)\s*\{\s*\.sparkle,\s*\.hero-logo\s*\{\s*animation: none;/,
  );
  assert.equal(
    (html.match(/src="icon\.svg"/g) || []).length,
    2,
    'the app icon, in the top bar and above the title',
  );
});

test('SITE-05 the page says how to add Little Wins to the home screen, with the iPhone pairing order', () => {
  const section = html.match(/<section[^>]*id="install"[\s\S]*?<\/section>/)?.[0];
  assert.ok(section, 'an install section');
  assert.match(section, /Add to Home Screen/);
  assert.match(section, /Install app/);
  assert.match(section, /Home Screen first/);
  // Plain and shaded bands still alternate.
  const bands = [...html.matchAll(/<section class="band( alt)?"/g)].map((m) => !!m[1]);
  for (let i = 1; i < bands.length; i++) assert.notEqual(bands[i], bands[i - 1], `band ${i}`);
});
