// Encrypted off-site backups: server/backup-crypto.js and scripts/backup.sh with BACKUP_PUBLIC_KEY.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { keygen, encrypt, decrypt, parsePublic } = require('../server/backup-crypto');
const { tmpDir, removeDir } = require('./helpers');

const ROOT = path.join(__dirname, '..');
const CLI = path.join(ROOT, 'server', 'backup-crypto.js');

test('BK-01 a backup encrypted to the public key decrypts with the private key, byte for byte', () => {
  const { publicKey, privateKey } = keygen();
  assert.match(publicKey, /^lwpub1-[\w-]{50,}$/);
  assert.match(privateKey, /^-----BEGIN PRIVATE KEY-----/);
  const plain = Buffer.from(`SQLite format 3\0${'x'.repeat(5000)}`);
  const sealed = encrypt(plain, publicKey);
  assert.equal(sealed.subarray(0, 4).toString(), 'LWB1');
  assert.equal(sealed.length, plain.length + 4 + 32 + 12 + 16);
  assert.ok(!sealed.includes(Buffer.from('SQLite format')), 'nothing readable in the file');
  assert.deepEqual(decrypt(sealed, privateKey), plain);
  assert.notDeepEqual(encrypt(plain, publicKey), sealed, 'a fresh key and nonce every time');
});

test('BK-02 a wrong key, a changed or cut file, or a bad public key is refused', () => {
  const a = keygen();
  const b = keygen();
  const sealed = encrypt(Buffer.from('family data'), a.publicKey);
  assert.throws(() => decrypt(sealed, b.privateKey), /wrong key/);
  const changed = Buffer.from(sealed);
  changed[50] ^= 1;
  assert.throws(() => decrypt(changed, a.privateKey), /wrong key, or the file was changed/);
  const header = Buffer.from(sealed);
  header[10] ^= 1; // the ephemeral key, part of the authenticated header
  assert.throws(() => decrypt(header, a.privateKey));
  assert.throws(() => decrypt(sealed.subarray(0, sealed.length - 1), a.privateKey), /wrong key/);
  assert.throws(() => decrypt(Buffer.from('SQLite format 3'), a.privateKey), /not a Little Wins/);
  for (const bad of [
    '',
    'age1qqq',
    'lwpub1-notbase64!',
    `lwpub1-${Buffer.alloc(44).toString('base64url')}`,
  ])
    assert.throws(() => parsePublic(bad), /backup public key/, JSON.stringify(bad));
});

test('BK-03 the command line makes a key it never overwrites, and encrypts and decrypts streams', () => {
  const dir = tmpDir('backup-cli');
  try {
    const keyFile = path.join(dir, 'backup-key.txt');
    const pub = execFileSync(process.execPath, [CLI, 'keygen', keyFile]).toString().trim();
    assert.match(pub, /^lwpub1-/);
    assert.equal(
      fs.statSync(keyFile).mode & 0o777,
      0o600,
      'the private key is readable by its owner only',
    );
    const again = spawnSync(process.execPath, [CLI, 'keygen', keyFile]);
    assert.equal(again.status, 1, 'an existing key is never overwritten');
    const sealed = execFileSync(process.execPath, [CLI, 'encrypt', pub], { input: 'hello' });
    const back = execFileSync(process.execPath, [CLI, 'decrypt', keyFile], { input: sealed });
    assert.equal(back.toString(), 'hello');
    const usage = spawnSync(process.execPath, [CLI, 'encrypt']);
    assert.equal(usage.status, 1);
    assert.match(usage.stderr.toString(), /usage:/);
  } finally {
    removeDir(dir);
  }
});

test('BK-04 backup.sh with BACKUP_PUBLIC_KEY writes an encrypted copy that restores the database', () => {
  const dir = tmpDir('backup-sh');
  try {
    const db = path.join(dir, 'little-wins.db');
    const conn = require('../server/db').open(db);
    conn.exec(
      "INSERT INTO families(name,timezone,week_start,created) VALUES('Backup Family','UTC',1,'2026-01-01')",
    );
    conn.close();
    const { publicKey, privateKey } = keygen();
    const env = {
      PATH: process.env.PATH,
      HOME: dir,
      DB_FILE: db,
      BACKUP_DIR: path.join(dir, 'daily'),
      OFFSITE_DIR: path.join(dir, 'offsite'),
    };
    const plainRun = spawnSync('sh', [path.join(ROOT, 'scripts', 'backup.sh')], { env });
    assert.equal(plainRun.status, 0, plainRun.stderr.toString());
    assert.ok(!fs.existsSync(env.OFFSITE_DIR), 'no key, no encrypted copy');

    const run = spawnSync('sh', [path.join(ROOT, 'scripts', 'backup.sh')], {
      env: { ...env, BACKUP_PUBLIC_KEY: publicKey },
    });
    assert.equal(run.status, 0, run.stderr.toString());
    assert.match(run.stdout.toString(), /encrypted copy: .*\.db\.lwb/);
    const [lwb] = fs.readdirSync(env.OFFSITE_DIR);
    assert.match(lwb, /^little-wins-\d{4}-\d{2}-\d{2}\.db\.lwb$/);
    const [plain] = fs.readdirSync(env.BACKUP_DIR);
    const restored = decrypt(fs.readFileSync(path.join(env.OFFSITE_DIR, lwb)), privateKey);
    assert.deepEqual(restored, fs.readFileSync(path.join(env.BACKUP_DIR, plain)));
    const out = path.join(dir, 'restored.db');
    fs.writeFileSync(out, restored);
    const check = new DatabaseSync(out, { readOnly: true });
    assert.equal(check.prepare('SELECT name FROM families').get().name, 'Backup Family');
    check.close();

    const bad = spawnSync('sh', [path.join(ROOT, 'scripts', 'backup.sh')], {
      env: { ...env, BACKUP_PUBLIC_KEY: 'not-a-key' },
    });
    assert.notEqual(bad.status, 0, 'a bad key fails the job');
    assert.match(bad.stderr.toString(), /backup public key/);
  } finally {
    removeDir(dir);
  }
});
