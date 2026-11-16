// The built Docker image, run hardened. Skipped without Docker or with SKIP_IMAGE_TESTS=1.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const net = require('node:net');
const { ROOT } = require('./helpers');

const IMAGE = 'little-wins:test';
const BASE = 'https://little.example.test';

const docker = (args, opts = {}) =>
  spawnSync('docker', args, { cwd: ROOT, encoding: 'utf8', ...opts });

let skip = false;
if (process.env.SKIP_IMAGE_TESTS === '1') skip = 'SKIP_IMAGE_TESTS=1';
else if (docker(['version', '--format', '{{.Server.Version}}']).status !== 0)
  skip = 'Docker is not available (docker version failed)';

const names = new Set();
let name;
let port;

const freePort = () =>
  new Promise((resolve) => {
    const s = net.createServer().listen(0, () => {
      const { port: p } = s.address();
      s.close(() => resolve(p));
    });
  });

const env = (extra = {}) => ({
  APP_BASE_URL: BASE,
  SESSION_SECRET: crypto.randomBytes(32).toString('hex'),
  GITHUB_CLIENT_ID: 'dummy-id',
  GITHUB_CLIENT_SECRET: 'dummy-secret',
  FORWARDED_ALLOW_IPS: '*',
  ...extra,
});

const runArgs = (e, extra = []) => [
  'run',
  '--read-only',
  '--tmpfs',
  '/tmp',
  '--tmpfs',
  '/data:uid=10001,gid=10001',
  '--cap-drop',
  'ALL',
  '--security-opt',
  'no-new-privileges',
  ...Object.entries(e).flatMap(([k, v]) => ['-e', `${k}=${v}`]),
  ...extra,
  IMAGE,
];

const get = (p, headers = {}) =>
  fetch(`http://127.0.0.1:${port}${p}`, { headers, redirect: 'manual' });

before(
  async () => {
    if (skip) return;
    const b = docker(['build', '-t', IMAGE, '.']);
    assert.equal(b.status, 0, `docker build failed:\n${b.stderr}`);
    port = await freePort();
    name = `little-wins-test-${process.pid}`;
    names.add(name);
    const r = docker(runArgs(env(), ['-d', '--name', name, '-p', `127.0.0.1:${port}:3000`]));
    assert.equal(r.status, 0, `docker run failed:\n${r.stderr}`);
  },
  { timeout: 300000 },
);

after(
  () => {
    if (skip) return;
    for (const n of names) docker(['rm', '-f', n]);
    docker(['rmi', '-f', IMAGE]);
  },
  { timeout: 60000 },
);

test('IM-01 the container becomes healthy within 60 seconds', {
  skip,
  timeout: 90000,
}, async () => {
  let status = '';
  for (let i = 0; i < 60; i++) {
    status = docker(['inspect', '-f', '{{.State.Health.Status}}', name]).stdout.trim();
    if (status === 'healthy') break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert.equal(status, 'healthy');
});

test('IM-02 the process runs as uid 10001, not root', { skip }, () => {
  const r = docker(['exec', name, 'id', '-u']);
  assert.equal(r.stdout.trim(), '10001', r.stderr);
});

test('IM-03 the root filesystem is read-only', { skip }, () => {
  assert.equal(
    docker(['inspect', '-f', '{{.HostConfig.ReadonlyRootfs}}', name]).stdout.trim(),
    'true',
  );
  const r = docker(['exec', name, 'touch', '/should-not-work']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /[Rr]ead-only/);
});

test('IM-04 /healthz answers 200 over plain HTTP', { skip }, async () => {
  assert.equal((await get('/healthz')).status, 200);
});

test('IM-05 plain HTTP with a foreign Host is redirected (308) to APP_BASE_URL', {
  skip,
}, async () => {
  const r = await get('/', { Host: 'evil.example' });
  assert.equal(r.status, 308);
  assert.equal(r.headers.get('location'), `${BASE}/`);
});

test('IM-06 the page answers 200 behind X-Forwarded-Proto: https and carries the CSP', {
  skip,
}, async () => {
  const r = await get('/', { 'X-Forwarded-Proto': 'https' });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-security-policy') || '', /default-src 'self'/);
});

test('IM-07 an http:// APP_BASE_URL makes the container exit non-zero with a message', {
  skip,
  timeout: 60000,
}, () => {
  const r = docker(runArgs(env({ APP_BASE_URL: 'http://little.example.test' }), ['--rm']));
  assert.notEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /https/);
});
