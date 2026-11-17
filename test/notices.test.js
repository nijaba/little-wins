// Notices on a child's device: allowed per child by a parent, sent once when a reward unlocks or a
// milestone is reached.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const { startServer, item } = require('./helpers');

/** A browser's side of a subscription: its keys, and a decrypt for what the server sends. */
function device() {
  const ua = crypto.createECDH('prime256v1');
  ua.generateKeys();
  const auth = crypto.randomBytes(16);
  const keys = {
    p256dh: ua.getPublicKey().toString('base64url'),
    auth: auth.toString('base64url'),
  };
  const decrypt = (body) => {
    const salt = body.subarray(0, 16);
    const idlen = body[20];
    const asPublic = body.subarray(21, 21 + idlen);
    const data = body.subarray(21 + idlen);
    const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), asPublic]);
    const ikm = Buffer.from(
      crypto.hkdfSync('sha256', ua.computeSecret(asPublic), auth, keyInfo, 32),
    );
    const cek = Buffer.from(
      crypto.hkdfSync('sha256', ikm, salt, 'Content-Encoding: aes128gcm\0', 16),
    );
    const nonce = Buffer.from(
      crypto.hkdfSync('sha256', ikm, salt, 'Content-Encoding: nonce\0', 12),
    );
    const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
    d.setAuthTag(data.subarray(-16));
    const plain = Buffer.concat([d.update(data.subarray(0, -16)), d.final()]);
    return JSON.parse(plain.subarray(0, plain.lastIndexOf(2)).toString());
  };
  return { keys, decrypt };
}

// A stand-in push service on localhost: records requests, answers with `status`.
let pushes = [];
const status = 201;
let push;
let pushUrl;
let srv;
before(async () => {
  push = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      pushes.push({ url: req.url, headers: req.headers, body: Buffer.concat(chunks) });
      res.writeHead(status);
      res.end();
    });
  });
  await new Promise((r) => push.listen(0, r));
  pushUrl = `http://localhost:${push.address().port}`;
  srv = await startServer({ signup: 'open', env: { PUSH_INTERVAL_MS: '150' } });
});
after(async () => {
  await srv.close();
  push.close();
});
const until = async (check, ms = 3000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (check()) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return check();
};

test("CN-01 a parent allows notices for one child; only that child's device can turn them on", async () => {
  const f = await srv.newFamily({ child: 'Robin' });
  const two = (await srv.api(f.jar, '/api/child/save', { name: 'Sky' })).json;
  const sky = two.children.find((c) => c.name === 'Sky').id;
  const robinDev = await srv.pairChild(f.jar, f.childId);
  const skyDev = await srv.pairChild(f.jar, sky);
  assert.equal((await srv.api(robinDev.jar, '/api/state')).json.notices.allowed, false);
  const S = (await srv.api(f.jar, '/api/child/notify', { child_id: f.childId, on: true })).json;
  assert.equal(S.children.find((c) => c.id === f.childId).notify, 1);
  const K = (await srv.api(robinDev.jar, '/api/state')).json;
  assert.equal(K.notices.allowed, true);
  assert.match(K.notices.key, /^B[\w-]{86}$/);
  const { keys } = device();
  const on = await srv.api(robinDev.jar, '/api/push/child-subscribe', {
    endpoint: `${pushUrl}/robin`,
    keys,
  });
  assert.equal(on.status, 200);
  assert.equal(on.json.notices.on, true);
  assert.equal(
    (await srv.api(skyDev.jar, '/api/push/child-subscribe', { endpoint: `${pushUrl}/sky`, keys }))
      .status,
    403,
    'not allowed for Sky',
  );
  assert.equal(
    (
      await srv.api(robinDev.jar, '/api/push/child-subscribe', {
        endpoint: 'https://evil.example/x',
        keys,
      })
    ).status,
    400,
  );
  const count = () =>
    srv.sql(
      (db) => db.prepare("SELECT COUNT(*) n FROM push_subscriptions WHERE kind='child'").get().n,
    );
  assert.equal(count(), 1);
  await srv.api(f.jar, '/api/child/notify', { child_id: f.childId, on: false });
  assert.equal(count(), 0, "stopping notices removes the child's subscription");
  assert.equal((await srv.api(robinDev.jar, '/api/state')).json.notices.on, false);
});

test('CN-02 unlocking a reward sends the child one notice, in the family language, and never again', async () => {
  pushes = [];
  const f = await srv.newFamily({ child: 'Robin', language: 'fr' });
  const tidy =
    item(f.state, 'target', 'Ranger sa chambre') ||
    f.state.items.find((i) => i.kind === 'target' && i.pmin === 10);
  await srv.api(f.jar, '/api/reward/save', { name: 'Glace', stars: 0, points: tidy.pmin });
  await srv.api(f.jar, '/api/child/notify', { child_id: f.childId, on: true });
  const dev = await srv.pairChild(f.jar, f.childId);
  const d = device();
  await srv.api(dev.jar, '/api/push/child-subscribe', {
    endpoint: `${pushUrl}/glace`,
    keys: d.keys,
  });
  const S = (await srv.api(f.jar, '/api/add', { child_id: f.childId, item_id: tidy.id })).json;
  assert.ok(await until(() => pushes.some((p) => p.url === '/glace')), 'a notice arrived');
  const msg = d.decrypt(pushes.find((p) => p.url === '/glace').body);
  assert.deepEqual(msg, { title: 'Little Wins', body: '⭐ Tu as débloqué Glace !', url: '/' });
  // Undo and record it again: the reward unlocks again, but the notice was already sent.
  await srv.api(f.jar, '/api/undo', { id: S.hist[0].id });
  await srv.api(f.jar, '/api/add', { child_id: f.childId, item_id: tidy.id });
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(pushes.filter((p) => p.url === '/glace').length, 1, 'once');
  // A penalty or a warning never sends anything.
  const penalty = f.state.items.find((i) => i.kind === 'penalty');
  await srv.api(f.jar, '/api/add', { child_id: f.childId, item_id: penalty.id });
  await srv.api(f.jar, '/api/warn', { child_id: f.childId, item_id: tidy.id });
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(pushes.filter((p) => p.url === '/glace').length, 1);
});

test('CN-03 a third perfect day in a row sends a streak notice; the evening reminder skips child devices', async () => {
  pushes = [];
  const f = await srv.newFamily({ child: 'Robin' });
  const c = item(f.state, 'challenge');
  await srv.api(f.jar, '/api/child/notify', { child_id: f.childId, on: true });
  const dev = await srv.pairChild(f.jar, f.childId);
  const d = device();
  await srv.api(dev.jar, '/api/push/child-subscribe', {
    endpoint: `${pushUrl}/streak`,
    keys: d.keys,
  });
  const day = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  for (const n of [2, 1, 0])
    await srv.api(f.jar, '/api/mark', {
      child_id: f.childId,
      item_id: c.id,
      mark: 'perfect',
      day: day(n),
    });
  assert.ok(await until(() => pushes.some((p) => p.url === '/streak')));
  const bodies = pushes.filter((p) => p.url === '/streak').map((p) => d.decrypt(p.body).body);
  assert.ok(bodies.includes('🔥 3 perfect days in a row!'), JSON.stringify(bodies));
  assert.ok(
    bodies.every((b) => !/mark today/i.test(b)),
    "never the parents' reminder",
  );
});
