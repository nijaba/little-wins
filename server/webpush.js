/**
 * Web Push with nothing but node:crypto: VAPID (RFC 8292) to sign each request to the browser's
 * push service, and message encryption (RFC 8291, "aes128gcm") so the push service can't read it.
 * The push service only learns that this server sent a device a message, and when.
 */
const crypto = require('node:crypto');

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const unb64 = (text) => Buffer.from(String(text || ''), 'base64url');

/** A new VAPID key pair: { publicKey, privateKey }, raw keys in base64url (65 and 32 bytes). */
function vapidKeys() {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  return { publicKey: b64url(ecdh.getPublicKey()), privateKey: b64url(ecdh.getPrivateKey()) };
}

/** A P-256 private KeyObject from raw base64url keys (for signing). */
function signingKey({ publicKey, privateKey }) {
  const pub = unb64(publicKey);
  return crypto.createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: b64url(pub.subarray(1, 33)),
      y: b64url(pub.subarray(33, 65)),
      d: privateKey,
    },
    format: 'jwk',
  });
}

/** The Authorization header for one push request: "vapid t=<JWT>, k=<public key>". */
function vapidAuth(endpoint, keys, subject, now = Date.now()) {
  const header = b64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = b64url(
    JSON.stringify({
      aud: new URL(endpoint).origin,
      exp: Math.floor(now / 1000) + 12 * 3600,
      sub: subject,
    }),
  );
  const signature = crypto.sign('sha256', Buffer.from(`${header}.${claims}`), {
    key: signingKey(keys),
    dsaEncoding: 'ieee-p1363',
  });
  return `vapid t=${header}.${claims}.${b64url(signature)}, k=${keys.publicKey}`;
}

/**
 * Encrypts `payload` for a subscription's keys ({ p256dh, auth }, base64url), as one aes128gcm
 * record. `salt` and `server` (an ECDH object) are only passed by tests, to check RFC 8291's example.
 */
function encrypt(payload, { p256dh, auth }, { salt = crypto.randomBytes(16), server } = {}) {
  const uaPublic = unb64(p256dh);
  const authSecret = unb64(auth);
  if (uaPublic.length !== 65 || authSecret.length !== 16) throw new Error('bad subscription keys');
  const ecdh = server || crypto.createECDH('prime256v1');
  if (!server) ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPublic);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', shared, authSecret, keyInfo, 32));
  const cek = Buffer.from(
    crypto.hkdfSync('sha256', ikm, salt, 'Content-Encoding: aes128gcm\0', 16),
  );
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, 'Content-Encoding: nonce\0', 12));
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([
    cipher.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), // 2: the last record
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, body]);
}

/**
 * Sends one encrypted message. Resolves to the push service's status: 201 means sent; 404 and
 * 410 mean the subscription is gone (the caller deletes it).
 */
async function send(subscription, payload, keys, subject) {
  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      TTL: String(12 * 3600),
      Urgency: 'normal',
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      Authorization: vapidAuth(subscription.endpoint, keys, subject),
    },
    body: encrypt(JSON.stringify(payload), subscription),
    signal: AbortSignal.timeout(10000),
  });
  return res.status;
}

// Push services of the browsers that support Web Push. A subscription pointing anywhere else is
// refused, so the server never sends requests to an address a client chose.
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^([\w-]+\.)*push\.apple\.com$/,
  /^([\w-]+\.)*notify\.windows\.com$/,
];

/** Whether a subscription endpoint is an https URL on a known push service (or localhost in tests). */
function allowedEndpoint(endpoint, allowLocal = false) {
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (allowLocal && url.protocol === 'http:' && url.hostname === 'localhost') return true;
  return url.protocol === 'https:' && !url.port && PUSH_HOSTS.some((h) => h.test(url.hostname));
}

module.exports = { vapidKeys, vapidAuth, encrypt, send, allowedEndpoint };
