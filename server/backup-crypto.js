/**
 * Encrypts backups for off-site copies, with nothing but node:crypto: X25519 + HKDF-SHA256 +
 * AES-256-GCM, to a public key. The server keeps only the public key; the private key stays with
 * the operator, off the server, so a stolen server or a leaked off-site folder reads nothing.
 *
 * File format (".lwb"): "LWB1" | ephemeral X25519 public key (32) | nonce (12) | ciphertext |
 * GCM tag (16). The first 48 bytes are authenticated as associated data.
 *
 * Command line (no server, no database; run where Node 22+ is, or in the container):
 *
 *     node server/backup-crypto.js keygen backup-key.txt     # writes the private key, prints the public one
 *     node server/backup-crypto.js encrypt <public key> < copy.db > copy.db.lwb
 *     node server/backup-crypto.js decrypt backup-key.txt < copy.db.lwb > copy.db
 */
const crypto = require('node:crypto');
const fs = require('node:fs');

const MAGIC = Buffer.from('LWB1');
const PUBLIC_PREFIX = 'lwpub1-';
const INFO = Buffer.from('little-wins backup v1');
const HEADER = MAGIC.length + 32 + 12;

/** The raw 32 bytes of an X25519 public key object. */
const rawPublic = (key) => key.export({ format: 'der', type: 'spki' }).subarray(-32);

/** A new key pair: { publicKey: 'lwpub1-…' (for the server), privateKey: PEM (keep off the server) }. */
function keygen() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519');
  return {
    publicKey:
      PUBLIC_PREFIX + publicKey.export({ format: 'der', type: 'spki' }).toString('base64url'),
    privateKey: privateKey.export({ format: 'pem', type: 'pkcs8' }),
  };
}

/** Reads an 'lwpub1-…' public key; throws a readable error for anything else. */
function parsePublic(text) {
  const value = String(text || '').trim();
  if (!value.startsWith(PUBLIC_PREFIX)) {
    throw new Error(`a backup public key starts with "${PUBLIC_PREFIX}" (make one with keygen)`);
  }
  try {
    const key = crypto.createPublicKey({
      key: Buffer.from(value.slice(PUBLIC_PREFIX.length), 'base64url'),
      format: 'der',
      type: 'spki',
    });
    if (key.asymmetricKeyType !== 'x25519') throw new Error('not X25519');
    return key;
  } catch {
    throw new Error('that backup public key could not be read');
  }
}

const deriveKey = (shared, ephemeral, recipient) =>
  Buffer.from(crypto.hkdfSync('sha256', shared, Buffer.concat([ephemeral, recipient]), INFO, 32));

/** Encrypts `plain` (a Buffer) to the 'lwpub1-…' public key. */
function encrypt(plain, publicKeyText) {
  const recipient = parsePublic(publicKeyText);
  const eph = crypto.generateKeyPairSync('x25519');
  const ephRaw = rawPublic(eph.publicKey);
  const shared = crypto.diffieHellman({ privateKey: eph.privateKey, publicKey: recipient });
  const key = deriveKey(shared, ephRaw, rawPublic(recipient));
  const nonce = crypto.randomBytes(12);
  const header = Buffer.concat([MAGIC, ephRaw, nonce]);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(header);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([header, body, cipher.getAuthTag()]);
}

/** Decrypts a .lwb file with the private key (PEM); throws if the key is wrong or the file was changed. */
function decrypt(sealed, privateKeyPem) {
  if (sealed.length < HEADER + 16 || !sealed.subarray(0, 4).equals(MAGIC)) {
    throw new Error('not a Little Wins encrypted backup');
  }
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const ephRaw = sealed.subarray(4, 36);
  const nonce = sealed.subarray(36, HEADER);
  const eph = crypto.createPublicKey({
    key: Buffer.concat([
      Buffer.from('302a300506032b656e032100', 'hex'), // SPKI prefix of an X25519 key
      ephRaw,
    ]),
    format: 'der',
    type: 'spki',
  });
  const shared = crypto.diffieHellman({ privateKey, publicKey: eph });
  const key = deriveKey(shared, ephRaw, rawPublic(crypto.createPublicKey(privateKey)));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAAD(sealed.subarray(0, HEADER));
  decipher.setAuthTag(sealed.subarray(-16));
  try {
    return Buffer.concat([decipher.update(sealed.subarray(HEADER, -16)), decipher.final()]);
  } catch {
    throw new Error('wrong key, or the file was changed or cut short');
  }
}

/** Command line: keygen | encrypt | decrypt, streaming stdin to stdout. */
function main(argv) {
  const [command, arg] = argv;
  const stdin = () => fs.readFileSync(0);
  if (command === 'keygen' && arg) {
    const { publicKey, privateKey } = keygen();
    fs.writeFileSync(arg, privateKey, { mode: 0o600, flag: 'wx' }); // never overwrite a key
    process.stdout.write(`${publicKey}\n`);
  } else if (command === 'encrypt' && arg) {
    process.stdout.write(encrypt(stdin(), arg));
  } else if (command === 'decrypt' && arg) {
    process.stdout.write(decrypt(stdin(), fs.readFileSync(arg, 'utf8')));
  } else {
    throw new Error(
      'usage: backup-crypto.js keygen <private key file> | encrypt <public key> | decrypt <private key file>',
    );
  }
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (err) {
    console.error(`backup-crypto: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { keygen, encrypt, decrypt, parsePublic };
