// Evening reminders: subscribing a device, and the scheduler sending encrypted pushes to it.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const { startServer, item } = require('./helpers');
const { timeOfDay } = require('../server/clock');

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
let status = 201;
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

test('RM-01 a parent device subscribes with a time; bad endpoints, keys and times are refused', async () => {
  const f = await srv.newFamily();
  assert.match(
    f.state.push?.key || (await srv.api(f.jar, '/api/state')).json.push.key,
    /^B[\w-]{86}$/,
  );
  const { keys } = device();
  const sub = (body) =>
    srv.api(f.jar, '/api/push/subscribe', {
      endpoint: `${pushUrl}/a`,
      keys,
      time: '19:30',
      ...body,
    });
  for (const bad of [
    { endpoint: 'https://evil.example/push' },
    { endpoint: 'http://127.0.0.1:9/push' },
    { keys: { p256dh: 'AAAA', auth: keys.auth } },
    { keys: { p256dh: keys.p256dh, auth: '' } },
    { time: '24:00' },
    { time: '7pm' },
  ])
    assert.equal((await sub(bad)).status, 400, JSON.stringify(bad));
  const ok = await sub({});
  assert.equal(ok.status, 200);
  assert.equal(ok.json.push.time, '19:30');
  const kid = await srv.pairChild(f.jar, f.childId);
  assert.equal(
    (
      await srv.api(kid.jar, '/api/push/subscribe', {
        endpoint: `${pushUrl}/k`,
        keys,
        time: '19:30',
      })
    ).status,
    403,
  );
  assert.equal(
    (await srv.api(kid.jar, '/api/state')).json.push,
    undefined,
    'not offered on a child device',
  );
  const off = await srv.api(f.jar, '/api/push/unsubscribe', {});
  assert.equal(off.json.push.time, null);
});

test('RM-02 at its time the device gets one encrypted, signed push, in the family language, and only once', async () => {
  pushes = [];
  const f = await srv.newFamily({ language: 'fr' });
  const d = device();
  // Subscribe for "now" in the family's time zone (UTC), with challenges still unmarked.
  const r = await srv.api(f.jar, '/api/push/subscribe', {
    endpoint: `${pushUrl}/fam1`,
    keys: d.keys,
    time: timeOfDay('UTC'),
  });
  assert.equal(r.status, 200);
  assert.ok(await until(() => pushes.some((p) => p.url === '/fam1')), 'a push arrived');
  const p = pushes.find((x) => x.url === '/fam1');
  assert.equal(p.headers['content-encoding'], 'aes128gcm');
  assert.match(p.headers.authorization, /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=B[\w-]+$/);
  assert.ok(Number(p.headers.ttl) > 0);
  const msg = d.decrypt(p.body);
  assert.deepEqual(msg, {
    title: 'Little Wins',
    body: "C'est l'heure de noter les défis du jour.",
    url: '/',
  });
  assert.doesNotMatch(JSON.stringify(msg), /Kid|Test Family/, 'nothing about the child');
  await new Promise((res) => setTimeout(res, 600));
  assert.equal(pushes.filter((x) => x.url === '/fam1').length, 1, 'once a day');
});

test('RM-03 no push when every challenge is marked; a gone subscription is dropped; logging out removes it', async () => {
  pushes = [];
  const f = await srv.newFamily();
  for (const c of f.state.items.filter((i) => i.kind === 'challenge'))
    await srv.api(f.jar, '/api/mark', { child_id: f.childId, item_id: c.id, mark: 'perfect' });
  await srv.api(f.jar, '/api/push/subscribe', {
    endpoint: `${pushUrl}/done`,
    keys: device().keys,
    time: timeOfDay('UTC'),
  });
  await new Promise((res) => setTimeout(res, 600));
  assert.equal(
    pushes.filter((x) => x.url === '/done').length,
    0,
    'nothing left to mark: no reminder',
  );

  status = 410;
  const g = await srv.newFamily();
  item(g.state, 'challenge');
  await srv.api(g.jar, '/api/push/subscribe', {
    endpoint: `${pushUrl}/gone`,
    keys: device().keys,
    time: timeOfDay('UTC'),
  });
  assert.ok(await until(() => pushes.some((x) => x.url === '/gone')));
  const count = (ep) =>
    srv.sql(
      (db) => db.prepare('SELECT COUNT(*) n FROM push_subscriptions WHERE endpoint=?').get(ep).n,
    );
  assert.ok(
    await until(() => count(`${pushUrl}/gone`) === 0),
    'the push service said 410: dropped',
  );
  status = 201;

  await srv.api(g.jar, '/api/push/subscribe', {
    endpoint: `${pushUrl}/out`,
    keys: device().keys,
    time: '07:00',
  });
  assert.equal(count(`${pushUrl}/out`), 1);
  await srv.api(g.jar, '/api/logout', {});
  assert.equal(count(`${pushUrl}/out`), 0, 'logging the device out removes its reminder');
});

test('RM-04 PUSH_REMINDERS=0 turns reminders off', async () => {
  const off = await startServer({ signup: 'open', env: { PUSH_REMINDERS: '0' } });
  try {
    const f = await off.newFamily();
    assert.equal((await off.api(f.jar, '/api/state')).json.push, undefined);
    const r = await off.api(f.jar, '/api/push/subscribe', {
      endpoint: `${pushUrl}/x`,
      keys: device().keys,
      time: '19:30',
    });
    assert.equal(r.status, 404);
  } finally {
    await off.close();
  }
});
