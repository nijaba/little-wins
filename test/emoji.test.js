// Emoji for behaviors, penalties, challenges, rewards and children.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { startServer, item, tmpDir, removeDir } = require('./helpers');

let srv;
let f;
before(async () => {
  srv = await startServer({ signup: 'open' });
  f = await srv.newFamily({ child: 'Robin' });
});
after(() => srv.close());

test('EM-01 the starter list comes with emoji, in every language', async () => {
  assert.equal(item(f.state, 'target', 'Tidy room').emoji, '🧹');
  assert.equal(item(f.state, 'challenge', 'Bedtime on time').emoji, '🛏️');
  assert.equal(f.state.rewards.find((r) => r.name === 'New book').emoji, '📕');
  const fr = await srv.newFamily({ language: 'fr' });
  const tidy = fr.state.items.find((i) => i.kind === 'target' && i.pmin === 10 && i.sort === 2);
  assert.equal(
    tidy?.emoji ?? fr.state.items.filter((i) => i.kind === 'target')[2].emoji,
    '🧹',
    'same emoji in French',
  );
});

test('EM-02 a parent sets, changes and removes an emoji on a behavior, a reward and a child', async () => {
  let S = (
    await srv.api(f.jar, '/api/item/save', {
      kind: 'target',
      name: 'Feed the cat',
      pmin: 5,
      pmax: 5,
      emoji: '🐱',
    })
  ).json;
  const cat = item(S, 'target', 'Feed the cat');
  assert.equal(cat.emoji, '🐱');
  S = (
    await srv.api(f.jar, '/api/item/save', {
      id: cat.id,
      kind: 'target',
      name: 'Feed the cat',
      pmin: 5,
      pmax: 5,
      emoji: '👨‍👩‍👧',
    })
  ).json;
  assert.equal(item(S, 'target', 'Feed the cat').emoji, '👨‍👩‍👧', 'a joined emoji is one emoji');
  S = (
    await srv.api(f.jar, '/api/item/save', {
      id: cat.id,
      kind: 'target',
      name: 'Feed the cat',
      pmin: 5,
      pmax: 5,
    })
  ).json;
  assert.equal(item(S, 'target', 'Feed the cat').emoji, '👨‍👩‍👧', 'left out: unchanged');
  S = (
    await srv.api(f.jar, '/api/item/save', {
      id: cat.id,
      kind: 'target',
      name: 'Feed the cat',
      pmin: 5,
      pmax: 5,
      emoji: '',
    })
  ).json;
  assert.equal(item(S, 'target', 'Feed the cat').emoji, '', 'empty removes it');
  S = (
    await srv.api(f.jar, '/api/reward/save', {
      name: 'Ice cream',
      stars: 1,
      points: 0,
      emoji: '🍦',
    })
  ).json;
  assert.equal(S.rewards.find((r) => r.name === 'Ice cream').emoji, '🍦');
  S = (await srv.api(f.jar, '/api/child/save', { id: f.childId, name: 'Robin', emoji: '🦊' })).json;
  assert.equal(S.children.find((c) => c.id === f.childId).emoji, '🦊');
  S = (await srv.api(f.jar, '/api/child/save', { name: 'Sky', emoji: '🐻' })).json;
  assert.equal(S.children.find((c) => c.name === 'Sky').emoji, '🐻');
  const kid = await srv.pairChild(f.jar, f.childId);
  assert.equal(
    (await srv.api(kid.jar, '/api/state')).json.children[0].emoji,
    '🦊',
    "on the child's device too",
  );
});

test('EM-03 anything but one emoji is refused', async () => {
  for (const bad of ['A', 'ab', '🐱🐶', '<b>', '1', 'x'.repeat(20)]) {
    const r = await srv.api(f.jar, '/api/item/save', {
      kind: 'target',
      name: 'Bad',
      pmin: 5,
      pmax: 5,
      emoji: bad,
    });
    assert.equal(r.status, 400, JSON.stringify(bad));
  }
  assert.equal(
    (await srv.api(f.jar, '/api/reward/save', { name: 'Bad', stars: 1, points: 0, emoji: 'no' }))
      .status,
    400,
  );
  assert.equal(
    (await srv.api(f.jar, '/api/child/save', { id: f.childId, name: 'Robin', emoji: '🐱🐶' }))
      .status,
    400,
  );
});

test('EM-04 history shows the emoji, and the export keeps it', async () => {
  const tidy = item(f.state, 'target', 'Tidy room');
  const S = (await srv.api(f.jar, '/api/add', { child_id: f.childId, item_id: tidy.id })).json;
  assert.equal(S.hist[0].emoji, '🧹');
  const ex = (await srv.api(f.jar, '/api/export')).json;
  assert.equal(ex.items.find((i) => i.name === 'Tidy room').emoji, '🧹');
  assert.ok(ex.rewards.every((r) => 'emoji' in r) && ex.children.every((c) => 'emoji' in c));
});

test('EM-05 old data gets the starter emoji for names that match the starter list', () => {
  const dir = tmpDir('emoji-migrate');
  try {
    const file = path.join(dir, 'old.db');
    const old = new DatabaseSync(file);
    old.exec(`
      CREATE TABLE items(id INTEGER PRIMARY KEY, kind TEXT, name TEXT, note TEXT, pmin INT, pmax INT, sort INT, active INT DEFAULT 1);
      CREATE TABLE entries(id INTEGER PRIMARY KEY, ts TEXT, day TEXT, item_id INT, kind TEXT, points INT, who TEXT, note TEXT, undone INT DEFAULT 0);
      CREATE TABLE rewards(id INTEGER PRIMARY KEY, name TEXT, stars INT, points INT, sort INT);
      CREATE TABLE sessions(id INTEGER PRIMARY KEY, token_hash TEXT UNIQUE, role TEXT, device TEXT, created TEXT, last_seen TEXT);
      INSERT INTO items(kind,name,note,pmin,pmax,sort) VALUES('target','Tidy room','',10,10,1),('target','Walk the dog','',5,5,2),('challenge','Bedtime on time','',0,0,3);
      INSERT INTO rewards(name,stars,points,sort) VALUES('New book',6,200,1),('Zoo trip',9,0,2);
    `);
    old.close();
    const db = require('../server/db').open(file);
    const emoji = (sql) => db.prepare(sql).get().e;
    assert.equal(emoji("SELECT emoji e FROM items WHERE name='Tidy room'"), '🧹');
    assert.equal(emoji("SELECT emoji e FROM items WHERE name='Bedtime on time'"), '🛏️');
    assert.equal(
      emoji("SELECT emoji e FROM items WHERE name='Walk the dog'"),
      '',
      'not a starter name: none',
    );
    assert.equal(emoji("SELECT emoji e FROM rewards WHERE name='New book'"), '📕');
    assert.equal(emoji("SELECT emoji e FROM rewards WHERE name='Zoo trip'"), '');
    db.close();
  } finally {
    removeDir(dir);
  }
});

test('EM-06 the page, its scripts and styles are revalidated on each load (Cache-Control: no-cache)', async () => {
  for (const file of ['/', '/app.js', '/style.css', '/strings.en.js']) {
    const r = await fetch(`${srv.base}${file}`);
    assert.equal(r.headers.get('cache-control'), 'no-cache', file);
  }
});
