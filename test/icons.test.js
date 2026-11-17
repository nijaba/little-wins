// The app's icons: the favicon, the home-screen icons and the manifest that lists them.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startServer } = require('./helpers');

const PUBLIC = path.join(__dirname, '..', 'public');
const read = (name) => fs.readFileSync(path.join(PUBLIC, name));
/** Width and height from a PNG's IHDR chunk. */
const pngSize = (buf) => {
  assert.equal(buf.subarray(1, 4).toString(), 'PNG', 'a PNG file');
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
};

let srv;
before(async () => {
  srv = await startServer();
});
after(() => srv.close());

test('IC-01 the page links its favicon and iOS icon, and the server serves each with its type', async () => {
  const html = read('index.html').toString();
  const types = {
    'favicon.ico': 'image/x-icon',
    'icon.svg': 'image/svg+xml',
    'apple-touch-icon.png': 'image/png',
    'manifest.json': 'application/json',
  };
  for (const [name, type] of Object.entries(types)) {
    assert.match(
      html,
      new RegExp(`href="${name.replace('.', '\\.')}"`),
      `index.html links ${name}`,
    );
    const r = await fetch(`${srv.base}/${name}`);
    assert.equal(r.status, 200, name);
    assert.equal(r.headers.get('content-type'), type, name);
  }
  assert.deepEqual(pngSize(read('apple-touch-icon.png')), [180, 180]);
});

test('IC-02 every manifest icon exists at the size it claims, with a maskable one', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.ok(manifest.icons.length >= 3);
  for (const icon of manifest.icons) {
    const file = read(icon.src);
    if (icon.type === 'image/png') {
      const [w, h] = pngSize(file);
      assert.equal(`${w}x${h}`, icon.sizes, icon.src);
    } else {
      assert.match(file.toString(), /^<svg /, icon.src);
    }
  }
  const sizes = manifest.icons.filter((i) => i.type === 'image/png').map((i) => i.sizes);
  for (const s of ['192x192', '512x512']) assert.ok(sizes.includes(s), s);
  assert.ok(
    manifest.icons.some((i) => i.purpose === 'maskable'),
    'a maskable icon for Android',
  );
});

test('IC-03 favicon.ico holds one 32 x 32 PNG image', () => {
  const ico = read('favicon.ico');
  assert.equal(ico.readUInt16LE(2), 1, 'an icon file');
  assert.equal(ico.readUInt16LE(4), 1, 'one image');
  assert.equal(ico.readUInt8(6), 32);
  assert.equal(ico.readUInt8(7), 32);
  const offset = ico.readUInt32LE(18);
  assert.deepEqual(pngSize(ico.subarray(offset)), [32, 32]);
  assert.equal(ico.readUInt32LE(14), ico.length - offset, 'the size field matches');
});
