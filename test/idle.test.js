// Idle families: a family no device has used for DELETE_IDLE_FAMILIES_DAYS is deleted.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { startServer, startFails, tmpDir, removeDir, SECRET } = require('./helpers');

const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString();
const count = (srv, sql, ...args) => srv.sql((db) => db.prepare(sql).get(...args).n);

test('IF-01 a family unused for longer than the limit is deleted with everything it owns; active and unclaimed ones stay', async () => {
  const srv = await startServer({ signup: 'open' });
  try {
    const idle = await srv.newFamily({ name: 'Sleepy Family' });
    const active = await srv.newFamily({ name: 'Busy Family' });
    await srv.pairChild(idle.jar, idle.childId);
    const fid = (j) =>
      srv.sql((db) => db.prepare('SELECT id FROM families WHERE name=?').get(j).id);
    const idleId = fid('Sleepy Family');
    const activeId = fid('Busy Family');
    assert.ok(
      srv.sql(
        (db) => db.prepare('SELECT last_active FROM families WHERE id=?').get(activeId).last_active,
      ),
    );
    srv.sql((db) => {
      db.prepare('UPDATE families SET last_active=? WHERE id=?').run(daysAgo(400), idleId);
      db.prepare('UPDATE families SET last_active=? WHERE id=?').run(daysAgo(300), activeId);
      // An unclaimed family (migrated data, no parent yet) is kept however old it is.
      db.prepare(
        "INSERT INTO families(name,timezone,week_start,created,last_active) VALUES('Unclaimed','UTC',1,?,?)",
      ).run(daysAgo(900), daysAgo(900));
    });
    await srv.restart(); // the sweep runs at startup
    assert.equal(
      count(srv, 'SELECT COUNT(*) n FROM families WHERE id=?', idleId),
      0,
      'the idle family is gone',
    );
    for (const t of ['children', 'items', 'rewards', 'entries', 'sessions', 'memberships'])
      assert.equal(count(srv, `SELECT COUNT(*) n FROM ${t} WHERE family_id=?`, idleId), 0, t);
    assert.equal(
      count(srv, 'SELECT COUNT(*) n FROM users WHERE subject=?', idle.who.sub),
      0,
      "its parent's account",
    );
    assert.equal(
      count(srv, 'SELECT COUNT(*) n FROM families WHERE id=?', activeId),
      1,
      'used 300 days ago: kept',
    );
    assert.equal(count(srv, "SELECT COUNT(*) n FROM families WHERE name='Unclaimed'"), 1);
    assert.equal((await srv.api(active.jar, '/api/state')).status, 200);
    assert.equal(
      (await srv.api(idle.jar, '/api/state')).status,
      401,
      'the idle family signs in again from nothing',
    );
    const out = srv.output();
    assert.match(out, /Deleted 1 idle family/);
    assert.doesNotMatch(out, /Sleepy/, 'only the count is logged');
  } finally {
    await srv.close();
  }
});

test('IF-02 any device using the app keeps its family active', async () => {
  const srv = await startServer({ signup: 'open' });
  try {
    const f = await srv.newFamily({ name: 'Kept Family' });
    const kid = await srv.pairChild(f.jar, f.childId);
    const lastActive = () =>
      srv.sql(
        (db) =>
          db.prepare("SELECT last_active FROM families WHERE name='Kept Family'").get().last_active,
      );
    // Make the family and its devices look unused for 200 days, then let only the child's device ask.
    srv.sql((db) => {
      db.prepare('UPDATE sessions SET last_seen=?').run(daysAgo(200));
      db.prepare('UPDATE families SET last_active=?').run(daysAgo(200));
    });
    assert.equal((await srv.api(kid.jar, '/api/state')).status, 200);
    assert.ok(Date.now() - Date.parse(lastActive()) < 60e3, "the child's device counts");
  } finally {
    await srv.close();
  }
});

test('IF-03 parents are told the rule; 0 turns deletion off; a bad value stops the server', async () => {
  const srv = await startServer({ signup: 'open', env: { DELETE_IDLE_FAMILIES_DAYS: '0' } });
  try {
    const f = await srv.newFamily({ name: 'Forever Family' });
    assert.equal(f.state.idleDays, undefined, 'nothing to tell when deletion is off');
    srv.sql((db) => db.prepare('UPDATE families SET last_active=?').run(daysAgo(5000)));
    await srv.restart();
    assert.equal(count(srv, "SELECT COUNT(*) n FROM families WHERE name='Forever Family'"), 1);
  } finally {
    await srv.close();
  }
  const on = await startServer({ signup: 'open' });
  try {
    const f = await on.newFamily();
    assert.equal(f.state.idleDays, 365, 'the default, shown to parents');
    const kid = await on.pairChild(f.jar, f.childId);
    assert.equal(
      (await on.api(kid.jar, '/api/state')).json.idleDays,
      undefined,
      'not on a child device',
    );
  } finally {
    await on.close();
  }
  const dir = tmpDir('idle-config');
  try {
    for (const value of ['29', '-1', 'soon']) {
      const r = await startFails({
        PORT: '0',
        DATABASE_PATH: path.join(dir, 'refused.db'),
        APP_BASE_URL: 'https://little.example.test',
        SESSION_SECRET: SECRET,
        GOOGLE_CLIENT_ID: 'id',
        GOOGLE_CLIENT_SECRET: 'secret',
        DELETE_IDLE_FAMILIES_DAYS: value,
      });
      assert.match(r.out, /DELETE_IDLE_FAMILIES_DAYS must be 0/, value);
    }
  } finally {
    removeDir(dir);
  }
});
