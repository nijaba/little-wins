// Web Push without dependencies: RFC 8291 encryption, RFC 8292 VAPID, endpoint checks, timing.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const w = require('../server/webpush');
const { isDue } = require('../server/reminders');

test('WP-01 encryption matches the example in RFC 8291, byte for byte', () => {
  const server = crypto.createECDH('prime256v1');
  server.setPrivateKey(Buffer.from('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw', 'base64url'));
  // The browser's public key and authentication secret from RFC 8291, appendix A (published).
  const [uaPublic, uaSecret] = [
    'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
    'BTBZMqHH6r4Tts7J_aSIgg',
  ];
  const out = w.encrypt(
    'When I grow up, I want to be a watermelon',
    { p256dh: uaPublic, auth: uaSecret },
    { salt: Buffer.from('DGv6ra1nlYgDCS1FRnbzlw', 'base64url'), server },
  );
  assert.equal(
    out.toString('base64url'),
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
  );
  assert.throws(() => w.encrypt('x', { p256dh: 'AAAA', auth: 'AAAA' }), /bad subscription keys/);
});

test('WP-02 the VAPID header is an ES256 JWT for the push service origin, signed by the key it names', () => {
  const keys = w.vapidKeys();
  const now = Date.UTC(2026, 10, 17, 18, 0);
  const header = w.vapidAuth(
    'https://fcm.googleapis.com/fcm/send/abc',
    keys,
    'https://little.example.test',
    now,
  );
  const [, t, k] = header.match(/^vapid t=([\w.-]+), k=([\w-]+)$/);
  assert.equal(k, keys.publicKey);
  const [h, c, sig] = t.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(h, 'base64url')), { typ: 'JWT', alg: 'ES256' });
  const claims = JSON.parse(Buffer.from(c, 'base64url'));
  assert.equal(claims.aud, 'https://fcm.googleapis.com');
  assert.equal(claims.sub, 'https://little.example.test');
  assert.equal(claims.exp, now / 1000 + 12 * 3600);
  const pub = Buffer.from(k, 'base64url');
  const key = crypto.createPublicKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: pub.subarray(1, 33).toString('base64url'),
      y: pub.subarray(33).toString('base64url'),
    },
    format: 'jwk',
  });
  assert.ok(
    crypto.verify(
      'sha256',
      Buffer.from(`${h}.${c}`),
      { key, dsaEncoding: 'ieee-p1363' },
      Buffer.from(sig, 'base64url'),
    ),
  );
});

test('WP-03 only https endpoints on known push services are accepted (localhost only in tests)', () => {
  for (const ok of [
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/abc',
    'https://wns2-par02p.notify.windows.com/w/?token=abc',
  ])
    assert.ok(w.allowedEndpoint(ok), ok);
  for (const bad of [
    'http://fcm.googleapis.com/fcm/send/abc',
    'https://fcm.googleapis.com:8443/x',
    'https://evil.example/fcm.googleapis.com',
    'https://fcm.googleapis.com.evil.example/x',
    'https://169.254.169.254/latest',
    'https://localhost/x',
    'not a url',
    'http://localhost:9/push',
  ])
    assert.ok(!w.allowedEndpoint(bad), bad);
  assert.ok(w.allowedEndpoint('http://localhost:9/push', true), 'localhost, for tests');
});

test("WP-04 a reminder is due once a day, from its time to two hours later, in the family's time zone", () => {
  const sub = { timezone: 'America/Chicago', time: '19:30', last_day: null };
  const at = (iso) => new Date(iso);
  assert.equal(isDue(sub, at('2026-11-18T01:29:00Z')), false, '19:29 in Chicago');
  assert.equal(isDue(sub, at('2026-11-18T01:30:00Z')), true, '19:30 in Chicago');
  assert.equal(isDue(sub, at('2026-11-18T03:29:00Z')), true, '21:29');
  assert.equal(isDue(sub, at('2026-11-18T03:30:00Z')), false, 'more than two hours late: skipped');
  assert.equal(
    isDue({ ...sub, last_day: '2026-11-17' }, at('2026-11-18T01:45:00Z')),
    false,
    'already sent today',
  );
  assert.equal(
    isDue({ ...sub, timezone: 'UTC' }, at('2026-11-18T01:45:00Z')),
    false,
    'another zone, another hour',
  );
});
