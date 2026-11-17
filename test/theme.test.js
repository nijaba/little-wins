// Light and dark themes: every color is a token on :root, the dark palette overrides them, and
// every text color stays readable (WCAG AA, 4.5:1) on the backgrounds it is used on.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'public', 'style.css'), 'utf8');
const DARK = '@media (prefers-color-scheme: dark) {';

/** The custom properties declared in the block that starts at `start`. */
function tokens(start) {
  const i = css.indexOf(start);
  assert.ok(i >= 0, `${start} is in style.css`);
  const body = css.slice(i, css.indexOf('}', i));
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,8})/g)].map((m) => [m[1], m[2]]),
  );
}
const light = tokens(':root {');
const dark = { ...light, ...tokens(`${DARK}\n  :root {`) };

const channels = (hex) => {
  let h = hex.slice(1);
  if (h.length <= 4) h = [...h.slice(0, 3)].map((c) => c + c).join('');
  return [0, 2, 4].map((k) => Number.parseInt(h.slice(k, k + 2), 16) / 255);
};
const luminance = (hex) =>
  channels(hex)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, k) => sum + c * [0.2126, 0.7152, 0.0722][k], 0);
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// Text (or a literal color) on the backgrounds it appears on.
const PAIRS = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['text', 'l'],
  ['text', 'demo-bg'],
  ['heading', 'surface'],
  ['heading', 'bg'],
  ['heading', 'l'],
  ['muted', 'surface'],
  ['muted', 'bg'],
  ['muted', 'l'],
  ['accent', 'surface'],
  ['#fff', 't'],
  ['#fff', 'gray'],
  ['#fff', 'danger'],
  ['#fff', 'n'],
  ['#fff', 'toast'],
  ['warn-text', 'warn'],
  ['warn-text', 'gold'],
  ['err', 'bg'],
  ['err', 'surface'],
  ['good', 'bg'],
  ['perfect', 'perfect-bg'],
  ['ok', 'ok-bg'],
  ['bad', 'bad-bg'],
];

test('TH-01 every text color reads at 4.5:1 or more on its background, in light and in dark', () => {
  for (const [name, theme] of [
    ['light', light],
    ['dark', dark],
  ]) {
    for (const [fg, bg] of PAIRS) {
      const a = fg.startsWith('#') ? fg : theme[fg];
      const b = theme[bg];
      assert.ok(a && b, `${name}: --${fg} and --${bg} are defined`);
      const r = contrast(a, b);
      assert.ok(r >= 4.5, `${name}: ${fg} on ${bg} is ${r.toFixed(2)}:1`);
    }
  }
});

test('TH-02 colors live in the theme tokens: the rest of the stylesheet uses var(--…)', () => {
  // Token definitions (the light and dark palettes, and the light one forced for printing) aside.
  const rules = css.slice(css.indexOf('body {')).split('@media print {')[0];
  assert.match(css, /@media print \{\n {2}:root \{/, 'printing uses the light palette');
  const literal = [...rules.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g)].map((m) => m[0]);
  // White text on colored buttons and the header, the dimmed overlay of a celebration, the tour's
  // orange outline, the video's black frame and dark shadows look the same in both themes.
  const allowed = new Set([
    '#fff',
    '#0008',
    '#f5a623',
    '#000',
    'rgba(0, 0, 0, 0.85)',
    'rgba(0, 0, 0, 0.25)',
  ]);
  assert.deepEqual(
    literal.filter((c) => !allowed.has(c)),
    [],
  );
  assert.ok(css.includes('color-scheme: light dark'), 'form controls follow the theme');
  assert.ok(
    Object.keys(tokens(`${DARK}\n  :root {`)).length >= 20,
    'the dark palette overrides the tokens',
  );
  const app = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
  for (const c of ['ring-track', 'ring-value', 'ring-text'])
    assert.ok(app.includes(`class=${c}`), c);
});
