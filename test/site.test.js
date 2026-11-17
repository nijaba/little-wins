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

const ALLOWED = /^https:\/\/(github\.com\/nijaba\/little-wins|nijaba\.github\.io)(\/|#|$)/;

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
  for (const m of html.matchAll(/<(?:script|link)\b[^>]*>/g))
    assert.doesNotMatch(m[0], /(?:src|href)="(?:https?:)?\/\//, m[0]);
});

test('SITE-03 no inline styles, scripts or event handlers', () => {
  assert.doesNotMatch(html, /\sstyle\s*=/i);
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i);
  assert.doesNotMatch(html, /href="javascript:/i);
  for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))
    assert.equal(m[1].trim(), '', 'inline script');
  assert.doesNotMatch(html, /<style\b/i);
});
