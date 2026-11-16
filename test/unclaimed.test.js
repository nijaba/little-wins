// Data from an old single-family install becomes one family with no parents. Only an
// allowlisted parent may claim it; everyone else gets their own setup.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { ROOT, jar, startServer, tmpDir } = require('./helpers');

/** The number of migrations in server/db.js: each is one comment "// N:" in the list. */
const migrationCount = () =>
  [...fs.readFileSync(path.join(ROOT, 'server', 'db.js'), 'utf8').matchAll(/^ {2}\/\/ (\d+):/gm)]
    .length;

const today = new Date().toLocaleDateString('en-CA');

/** Builds a database as the single-family server (migration 1) made it, with some history. */
function legacyDb(dir, { version, childName }) {
  const db = new DatabaseSync(path.join(dir, 'test.db'));
  if (version === 1) {
    db.exec(`
      CREATE TABLE items(id INTEGER PRIMARY KEY, kind TEXT, name TEXT, note TEXT, pmin INT, pmax INT, sort INT, active INT DEFAULT 1);
      CREATE TABLE entries(id INTEGER PRIMARY KEY, ts TEXT, day TEXT, item_id INT, kind TEXT, points INT, who TEXT, note TEXT, undone INT DEFAULT 0);
      CREATE TABLE rewards(id INTEGER PRIMARY KEY, name TEXT, stars INT, points INT, sort INT);
      CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE sessions(id INTEGER PRIMARY KEY, token_hash TEXT UNIQUE, role TEXT, device TEXT, created TEXT, last_seen TEXT);
    `);
    if (childName) db.prepare("INSERT INTO settings VALUES('child_name', ?)").run(childName);
    db.prepare(
      "INSERT INTO sessions(token_hash, role, device, created, last_seen) VALUES('oldhash','parent','Mac',?,?)",
    ).run(new Date().toISOString(), new Date().toISOString());
    db.exec('PRAGMA user_version = 1');
  } else {
    // The earliest server: no active/sort columns, no settings table.
    db.exec(`
      CREATE TABLE items(id INTEGER PRIMARY KEY, kind TEXT, name TEXT, note TEXT, pmin INT, pmax INT, sort INT);
      CREATE TABLE entries(id INTEGER PRIMARY KEY, ts TEXT, day TEXT, item_id INT, kind TEXT, points INT, who TEXT, note TEXT, undone INT DEFAULT 0);
      CREATE TABLE rewards(id INTEGER PRIMARY KEY, name TEXT, stars INT, points INT);
    `);
  }
  const ts = new Date().toISOString();
  db.prepare(
    "INSERT INTO items(id,kind,name,note,pmin,pmax,sort) VALUES(1,'target','Reading','',5,5,1)",
  ).run();
  db.prepare(
    "INSERT INTO items(id,kind,name,note,pmin,pmax,sort) VALUES(2,'challenge','Kindness','',0,0,2)",
  ).run();
  db.prepare("INSERT INTO rewards(id,name,stars,points) VALUES(1,'Movie',1,20)").run();
  const entry = db.prepare(
    "INSERT INTO entries(ts,day,item_id,kind,points,who,note) VALUES(?,?,?,?,?,'Parent',?)",
  );
  entry.run(ts, today, 1, 'points', 5, '');
  entry.run(ts, today, 1, 'points', 5, '');
  entry.run(ts, today, 2, 'mark', 0, 'perfect');
  db.close();
}

const dbRows = (srv, sql) => srv.sql((db) => db.prepare(sql).all());

for (const [label, version, childName, expectedChild] of [
  ['a version 1 database with a child name setting', 1, '  Sam  ', 'Sam'],
  ['the earliest database, without columns or settings', 0, null, 'Child'],
]) {
  describe(label, () => {
    test('is migrated to one family with one child, its entries and no parents', async () => {
      const dir = tmpDir('unclaimed');
      legacyDb(dir, { version, childName });
      const srv = await startServer({ dir, allowlist: 'google:alice@example.com' });
      try {
        assert.equal(dbRows(srv, 'SELECT * FROM families').length, 1);
        const kids = dbRows(srv, 'SELECT * FROM children');
        assert.deepEqual(
          kids.map((c) => c.name),
          [expectedChild],
        );
        assert.equal(dbRows(srv, 'SELECT * FROM memberships').length, 0, 'no parents yet');
        const entries = dbRows(srv, 'SELECT * FROM entries');
        assert.equal(entries.length, 3);
        assert.ok(
          entries.every((e) => e.child_id === kids[0].id && e.family_id === kids[0].family_id),
        );
        assert.ok(dbRows(srv, 'SELECT * FROM items').every((i) => i.active === 1 && i.family_id));
        assert.equal(dbRows(srv, 'SELECT * FROM sessions').length, 0, 'old PIN sessions are gone');
        assert.equal(
          dbRows(srv, 'PRAGMA user_version')[0].user_version,
          migrationCount(),
          'migrated to the latest schema version',
        );
      } finally {
        await srv.close();
      }
    });
  });
}

describe('claiming the migrated family', () => {
  test('the first allowlisted parent becomes its owner with no setup step, the next gets their own', async () => {
    const dir = tmpDir('unclaimed');
    legacyDb(dir, { version: 1, childName: 'Sam' });
    const srv = await startServer({
      dir,
      allowlist: 'google:alice@example.com,google:bob@example.com',
    });
    try {
      const a = jar();
      assert.ok((await srv.signIn(a, 'google', 'alice')).ok);
      const S = (await srv.api(a, '/api/state')).json;
      assert.equal(S.setup, undefined, 'no setup step');
      assert.equal(S.childName, 'Sam');
      assert.equal(S.balance, 10, 'the old entries belong to the child');
      assert.equal(S.me.owner, true);
      assert.deepEqual(S.items.map((i) => i.name).sort(), ['Kindness', 'Reading']);
      assert.equal(S.rewards.length, 1);
      assert.equal(S.hist.length, 3, 'two point entries and a mark');

      const b = jar();
      assert.ok((await srv.signIn(b, 'google', 'bob')).ok);
      assert.equal((await srv.api(b, '/api/state')).json.setup, true, 'the family is taken');
      const made = await srv.api(b, '/api/setup', {
        family_name: 'Bobs',
        child_name: 'Rae',
        timezone: 'UTC',
      });
      assert.equal(made.status, 200);
      assert.equal(made.json.balance, 0);
      assert.equal(made.json.childName, 'Rae');
      assert.equal(
        (await srv.api(a, '/api/state')).json.balance,
        10,
        "alice's family is unchanged",
      );
      assert.equal(dbRows(srv, 'SELECT * FROM families').length, 2);
    } finally {
      await srv.close();
    }
  });

  test('with open sign-up a stranger gets their own setup, never the unclaimed family', async () => {
    const dir = tmpDir('unclaimed');
    legacyDb(dir, { version: 1, childName: 'Sam' });
    const srv = await startServer({ dir, signup: 'open', allowlist: 'google:alice@example.com' });
    try {
      const stranger = jar();
      assert.ok((await srv.signIn(stranger, 'google', 'bob')).ok);
      const S = (await srv.api(stranger, '/api/state')).json;
      assert.equal(S.setup, true, 'a stranger must not land in the migrated family');
      assert.equal(S.childName, undefined);
      assert.equal(dbRows(srv, 'SELECT * FROM memberships').length, 0);

      const gh = jar();
      assert.ok((await srv.signIn(gh, 'github', 'carol')).ok);
      assert.equal((await srv.api(gh, '/api/state')).json.setup, true);

      const alice = jar();
      assert.ok((await srv.signIn(alice, 'google', 'alice')).ok);
      const A = (await srv.api(alice, '/api/state')).json;
      assert.equal(A.childName, 'Sam', 'the allowlisted parent still claims it');
      assert.equal(A.me.owner, true);
    } finally {
      await srv.close();
    }
  });

  test('a parent who is not on the allowlist cannot claim it in closed mode either', async () => {
    const dir = tmpDir('unclaimed');
    legacyDb(dir, { version: 1, childName: 'Sam' });
    const srv = await startServer({ dir, allowlist: 'google:alice@example.com' });
    try {
      const j = jar();
      assert.equal((await srv.signIn(j, 'google', 'bob')).status, 403);
      assert.equal(dbRows(srv, 'SELECT * FROM memberships').length, 0);
    } finally {
      await srv.close();
    }
  });
});
