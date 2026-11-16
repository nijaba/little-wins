// API behavior for one family: points, warnings, marks and stars, past weeks, settings, devices,
// request limits, static files and the write guard. Signs in through the fake provider.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { shift } = require('../server/scoring');
const { ROOT, SESSION, startServer, rawStatus, item } = require('./helpers');

let srv;
let P; // { jar, state, childId }
let kid; // a paired child device jar
const state = async (j = P.jar, q = '') => (await srv.api(j, `/api/state${q}`)).json;
const post = (p, b, j = P.jar) => srv.api(j, p, b);

before(async () => {
  srv = await startServer({ signup: 'open' });
  P = await srv.newFamily({ name: 'Api Family', child: 'Sam' });
  kid = (await srv.pairChild(P.jar, P.childId)).jar;
});
after(() => srv.close());

test('the page and every file in public/ are served with nosniff', async () => {
  const r = await fetch(`${srv.base}/`);
  assert.equal(r.status, 200);
  assert.match(await r.text(), /Little Wins/);
  for (const f of fs.readdirSync(path.join(ROOT, 'public'))) {
    const res = await fetch(`${srv.base}/${f}`);
    assert.equal(res.status, 200, f);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff', f);
    await res.arrayBuffer();
  }
});

test('the page carries a strict content security policy', async () => {
  const r = await fetch(`${srv.base}/`);
  const csp = r.headers.get('content-security-policy');
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  const api = await fetch(`${srv.base}/api/config`);
  assert.equal(api.headers.get('x-content-type-options'), 'nosniff', 'API replies too');
});

test('a query string still serves the page and paths outside public/ are 404', async () => {
  assert.equal(await rawStatus(srv, '/?from=home-screen'), 200);
  for (const f of ['package.json', 'server/index.js', 'server/config.js']) {
    assert.ok(
      fs.existsSync(path.join(ROOT, f)),
      `${f} should exist for this test to mean anything`,
    );
  }
  for (const p of [
    '/../package.json',
    '/..%2fpackage.json',
    '/%2e%2e/package.json',
    '/../server/index.js',
    '/public/../package.json',
    '/package.json',
    '/server/config.js',
    '/nope.html',
  ])
    assert.equal(await rawStatus(srv, p), 404, p);
});

test('a new family with the starter list starts empty-handed', async () => {
  const S = await state();
  assert.equal(S.role, 'parent');
  assert.equal(S.balance, 0);
  assert.equal(S.stars, 0);
  assert.equal(S.childName, 'Sam');
  assert.equal(S.family.name, 'Api Family');
});

test('without a session the API answers 401, and forged session cookies do too', async () => {
  assert.equal((await srv.api(null, '/api/state')).status, 401);
  const tok = P.jar.c[SESSION];
  assert.match(tok, /^[\w-]{43}$/, 'the session is a random 256-bit token');
  const flip = tok.slice(0, -1) + (tok.at(-1) === 'A' ? 'B' : 'A');
  for (const c of [
    `${SESSION}=${flip}`,
    `${SESSION}=${tok}x`,
    `${SESSION}=${'A'.repeat(43)}`,
    `${SESSION}=1`,
  ])
    assert.equal((await srv.api({ header: c }, '/api/state')).status, 401, c);
});

test('session tokens are stored hashed, not as-is', async () => {
  const tok = P.jar.c[SESSION];
  const rows = srv.sql((db) =>
    db
      .prepare('SELECT token_hash FROM sessions')
      .all()
      .map((r) => r.token_hash),
  );
  assert.ok(rows.length >= 2);
  assert.ok(!rows.includes(tok), 'the raw token is not in the database');
  assert.ok(rows.includes(crypto.createHash('sha256').update(tok).digest('hex')));
});

test('points: fixed ignores the amount, ranged is clamped, the penalty floors at 0, undo restores', async () => {
  let S = await state();
  const fixed = item(S, 'target', 'Reading 20 min'); // 5
  const ranged = item(S, 'target', 'Help with a family chore'); // 5-15
  const pen = item(S, 'penalty', 'Hitting or hurting someone'); // 50
  const add = async (itemId, points) =>
    (await post('/api/add', { child_id: P.childId, item_id: itemId, points })).json;

  S = await add(fixed.id, 999);
  assert.equal(S.balance, 5, 'fixed item ignores requested points');
  S = await add(ranged.id, 12);
  assert.equal(S.balance, 17);
  S = await add(ranged.id, 999);
  assert.equal(S.balance, 32, 'ranged item clamps to max');
  S = await add(ranged.id, 1);
  assert.equal(S.balance, 37, 'ranged item clamps to min');
  S = await add(ranged.id);
  assert.equal(S.balance, 42, 'no amount means the minimum');

  S = await add(pen.id);
  assert.equal(S.balance, 0, 'balance never goes below 0');
  assert.equal(S.hist[0].points, -50);
  S = (await post('/api/undo', { id: S.hist[0].id })).json;
  assert.equal(S.balance, 42, 'undo restores the balance');
  S = (await post('/api/undo', { id: S.hist[0].id })).json;
  assert.equal(S.balance, 37, 'undo removes the latest remaining entry');
  S = await add(fixed.id);
  assert.equal(S.balance, 42);
});

test('a penalty on an empty balance costs nothing later', async () => {
  const f = await srv.newFamily({ child: 'Pen' });
  let S = f.state;
  const pen = item(S, 'penalty');
  const fixed = item(S, 'target', 'Reading 20 min');
  const add = async (i) =>
    (await srv.api(f.jar, '/api/add', { child_id: f.childId, item_id: i })).json;
  S = await add(pen.id);
  S = await add(fixed.id);
  assert.equal(S.balance, 5);
});

test('notes are kept for parents and trimmed, and the child never sees them', async () => {
  const f = await srv.newFamily({ child: 'Note' });
  const t = item(f.state, 'target', 'Reading 20 min');
  await srv.api(f.jar, '/api/add', { child_id: f.childId, item_id: t.id, note: '  secret  ' });
  assert.equal((await srv.api(f.jar, '/api/state')).json.hist[0].note, 'secret');
  const dev = await srv.pairChild(f.jar, f.childId);
  const h = (await srv.api(dev.jar, '/api/state')).json.hist;
  assert.ok(h.length > 0 && h.every((e) => e.note === '' && e.points > 0));
});

test('the child sees positive history only, no penalties and no warnings', async () => {
  const S = await state();
  const t = item(S, 'target', 'Homework');
  await post('/api/warn', { child_id: P.childId, item_id: t.id });
  const K = await state(kid);
  assert.equal(K.role, 'child');
  assert.equal(K.balance, 42);
  assert.equal(
    K.items.some((i) => i.kind === 'penalty'),
    false,
  );
  assert.deepEqual(K.warn, {});
  assert.ok(K.hist.every((e) => e.points > 0 && e.note === ''));
  for (const key of ['devices', 'parents', 'invites', 'me'])
    assert.equal(key in K, false, `the child does not get ${key}`);
});

test('warnings count per target per day; challenges cannot get points or warnings', async () => {
  const f = await srv.newFamily({ child: 'Warn' });
  const t = item(f.state, 'target');
  const ch = item(f.state, 'challenge');
  const body = (i) => ({ child_id: f.childId, item_id: i });
  await srv.api(f.jar, '/api/warn', body(t.id));
  const S = (await srv.api(f.jar, '/api/warn', body(t.id))).json;
  assert.equal(S.warn[t.id], 2);
  assert.equal(S.balance, 0, 'warnings carry no points');
  assert.equal((await srv.api(f.jar, '/api/add', body(ch.id))).status, 400);
  assert.equal((await srv.api(f.jar, '/api/warn', body(ch.id))).status, 400);
  const pen = item(f.state, 'penalty');
  assert.equal(
    (await srv.api(f.jar, '/api/warn', body(pen.id))).status,
    400,
    'no warnings on penalties',
  );
  assert.equal((await srv.api(f.jar, '/api/mark', { ...body(t.id), mark: 'ok' })).status, 400);
});

test('adding without a child or with an unknown item answers 404', async () => {
  const t = item(await state(), 'target');
  assert.equal((await post('/api/add', { item_id: t.id })).status, 404, 'no child');
  assert.equal((await post('/api/add', { child_id: P.childId, item_id: 999999 })).status, 404);
  assert.equal((await post('/api/undo', { id: 999999 })).status, 404);
});

test('weekly challenges: marks replace each other, bad days and the star rule', async () => {
  let S = await state();
  const ch = item(S, 'challenge');
  const k = S.week.days.indexOf(S.today);
  const mk = async (day, mark, q = '') =>
    (await post(`/api/mark${q}`, { child_id: P.childId, item_id: ch.id, mark, day })).json;

  S = await mk(S.today, 'perfect');
  assert.equal(S.week.marks[ch.id][k], 'perfect');
  assert.equal(S.mk[ch.id], 'perfect');
  S = await mk(S.today, 'ok');
  assert.equal(S.week.marks[ch.id][k], 'ok', 're-marking a day replaces the old mark');

  const nextWeek = shift(S.week.days[6], 1);
  for (const day of [nextWeek, shift(S.today, 1), '2026-02-30', '2026-1-5', 'garbage'])
    assert.equal(
      (await post('/api/mark', { child_id: P.childId, item_id: ch.id, mark: 'perfect', day }))
        .status,
      400,
      day,
    );
  assert.equal(
    (await post('/api/mark', { child_id: P.childId, item_id: ch.id, mark: 'great', day: S.today }))
      .status,
    400,
  );

  // The star rule needs 2 days in one week. On Monday this week has only one, so use last week.
  const days = S.week.days.filter((d) => d <= S.today);
  const lastWeek = days.length < 2;
  const week = lastWeek ? S.week.prev : S.week.start;
  const [d0, d1, d2] = lastWeek
    ? [shift(week, 0), shift(week, 1), shift(week, 2)]
    : [days[0], S.today, days[1]];
  const stars0 = S.stars;
  S = await mk(d0, 'perfect', `?week=${week}`);
  assert.equal(S.stars, stars0, 'one perfect day is not enough');
  S = await mk(d1, 'perfect', `?week=${week}`);
  assert.equal(S.stars, stars0 + 1, '2 perfect days and no bad day wins a star');
  assert.equal(S.won[ch.id], 1);
  S = await mk(d2, 'bad', `?week=${week}`);
  assert.equal(S.stars, stars0, 'a bad day loses the star');
});

test('past weeks: browse, clamp, and fix marks on past days', async () => {
  const W = async (week, j = P.jar) =>
    (await srv.api(j, `/api/state?week=${encodeURIComponent(week)}`)).json;
  let S = await state();
  const ch = item(S, 'challenge', 'Kind words');
  const thisMon = S.week.start;
  const lastMon = S.week.prev;
  assert.deepEqual([S.week.current, S.week.next], [true, null]);
  assert.equal(lastMon, shift(thisMon, -7), 'can always go back at least one week');

  S = await W(shift(lastMon, 3));
  assert.deepEqual(
    [S.week.start, S.week.current, S.week.next],
    [lastMon, false, thisMon],
    'any day of a week selects that week',
  );
  assert.deepEqual([S.week.days[0], S.week.days[6]], [lastMon, shift(lastMon, 6)]);
  assert.equal((await W('2099-01-05')).week.start, thisMon, 'future weeks clamp to this week');
  assert.equal((await W('2020-01-01')).week.start, lastMon, 'weeks before any entries clamp');
  assert.equal((await W('garbage')).week.start, thisMon);
  assert.equal((await W(lastMon, kid)).week.start, lastMon, 'the child can browse past weeks');

  const stars0 = (await state()).stars;
  const mark = (day, m, j = P.jar) =>
    srv.api(j, `/api/mark?week=${lastMon}`, { child_id: P.childId, item_id: ch.id, mark: m, day });
  await mark(shift(lastMon, 5), 'perfect');
  const r = await mark(shift(lastMon, 6), 'perfect');
  assert.equal(r.status, 200);
  assert.equal(r.json.week.start, lastMon, 'the reply stays on the week being viewed');
  assert.deepEqual(r.json.week.marks[ch.id].slice(5), ['perfect', 'perfect']);
  assert.equal(r.json.stars, stars0 + 1);
  assert.equal(r.json.won[ch.id], 1);
  assert.equal(
    (await state()).won[ch.id],
    undefined,
    "this week's view doesn't show last week's star",
  );
  assert.equal((await W(lastMon, kid)).won[ch.id], 1);
  assert.equal((await mark(lastMon, 'bad')).json.stars, stars0, 'a bad day takes the star back');
  assert.equal((await mark(lastMon, 'ok', kid)).status, 403, 'children browse read-only');

  const old = shift(thisMon, -70);
  await post('/api/mark', { child_id: P.childId, item_id: ch.id, mark: 'ok', day: old });
  S = await W('2020-01-01');
  assert.deepEqual([S.week.start, S.week.prev, S.week.next], [old, null, shift(old, 7)]);
});

test('settings: add, edit, reorder and remove items and rewards', async () => {
  let S = (
    await post('/api/item/save', {
      kind: 'target',
      name: '  Brush teeth  ',
      note: 'per day',
      pmin: 8,
      pmax: 3,
    })
  ).json;
  const it = item(S, 'target', 'Brush teeth');
  assert.ok(it, 'item added (name trimmed)');
  assert.deepEqual([it.pmin, it.pmax], [8, 8], 'max below min is raised to min');
  assert.equal((await post('/api/item/save', { kind: 'target', name: '   ' })).status, 400);
  assert.equal((await post('/api/item/save', { kind: 'bogus', name: 'x' })).status, 400);

  S = (
    await post('/api/item/save', {
      id: it.id,
      kind: 'target',
      name: 'Brush teeth x2',
      pmin: 5,
      pmax: 10,
    })
  ).json;
  assert.deepEqual(
    [item(S, 'target', 'Brush teeth').name, item(S, 'target', 'Brush teeth').pmax],
    ['Brush teeth x2', 10],
  );
  const pen = (await post('/api/item/save', { kind: 'penalty', name: 'Zero', pmin: 0 })).json;
  assert.equal(item(pen, 'penalty', 'Zero').pmin, 1, 'a penalty costs at least 1');
  const chal = (await post('/api/item/save', { kind: 'challenge', name: 'Chal', pmin: 9, pmax: 9 }))
    .json;
  assert.equal(item(chal, 'challenge', 'Chal').pmax, 0, 'a challenge has no points');

  const targets = () => S.items.filter((i) => i.kind === 'target').map((i) => i.id);
  const last = targets().at(-1);
  S = (await post('/api/item/move', { id: last, dir: -1 })).json;
  assert.equal(targets().at(-2), last, 'moved up one place');

  S = (await post('/api/item/delete', { id: it.id })).json;
  assert.equal(item(S, 'target', 'Brush teeth'), undefined);
  assert.equal(
    (await post('/api/item/delete', { id: it.id })).status,
    200,
    'hiding twice is harmless',
  );

  S = (await post('/api/reward/save', { name: 'Movie night', stars: 2, points: 50 })).json;
  const rw = S.rewards.find((r) => r.name === 'Movie night');
  assert.equal(S.rewards.at(-1).id, rw.id, 'new reward goes last');
  S = (await post('/api/reward/save', { id: rw.id, name: 'Movie night 2', stars: 3, points: 60 }))
    .json;
  assert.deepEqual(
    [S.rewards.at(-1).name, S.rewards.at(-1).stars, S.rewards.at(-1).points],
    ['Movie night 2', 3, 60],
  );
  S = (await post('/api/reward/move', { id: rw.id, dir: -1 })).json;
  assert.equal(S.rewards.at(-2).id, rw.id);
  assert.equal((await post('/api/reward/save', { name: '' })).status, 400);
  S = (await post('/api/reward/delete', { id: rw.id })).json;
  assert.equal(
    S.rewards.some((r) => r.id === rw.id),
    false,
  );
});

test('a removed item keeps its name in the history', async () => {
  const f = await srv.newFamily({ child: 'Hist' });
  const t = (
    await srv.api(f.jar, '/api/item/save', { kind: 'target', name: 'Gone soon', pmin: 3, pmax: 3 })
  ).json.items.find((i) => i.name === 'Gone soon');
  await srv.api(f.jar, '/api/add', { child_id: f.childId, item_id: t.id });
  const S = (await srv.api(f.jar, '/api/item/delete', { id: t.id })).json;
  assert.equal(S.balance, 3, 'the points stay');
  assert.equal(S.hist[0].name, 'Gone soon');
  assert.equal(
    (await srv.api(f.jar, '/api/add', { child_id: f.childId, item_id: t.id })).status,
    400,
    'a removed item cannot be used any more',
  );
});

test('the family name, time zone and week start are parent settings', async () => {
  const f = await srv.newFamily({ name: 'Old name' });
  let r = await srv.api(f.jar, '/api/family/save', {
    name: '  New name  ',
    timezone: 'America/Chicago',
    week_start: 0,
  });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.family, { name: 'New name', timezone: 'America/Chicago', weekStart: 0 });
  assert.equal(
    (await srv.api(f.jar, '/api/family/save', { name: '', timezone: 'UTC' })).status,
    400,
  );
  assert.equal(
    (await srv.api(f.jar, '/api/family/save', { name: 'x', timezone: 'Mars/Base' })).status,
    400,
  );
  r = await srv.api(f.jar, '/api/family/save', { name: 'x', timezone: 'UTC', week_start: 5 });
  assert.equal(r.json.family.weekStart, 1, 'anything but 0 means Monday');
  const dev = await srv.pairChild(f.jar, f.childId);
  assert.equal(
    (await srv.api(dev.jar, '/api/family/save', { name: 'x', timezone: 'UTC' })).status,
    403,
  );
});

test('devices: listed for parents only, and can be logged out', async () => {
  const f = await srv.newFamily({ child: 'Dev' });
  const ios = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' };
  const child1 = await srv.pairChild(f.jar, f.childId, { headers: ios });
  const child2 = await srv.pairChild(f.jar, f.childId);
  const S = (await srv.api(f.jar, '/api/state')).json;
  assert.equal(S.devices.filter((d) => d.me).length, 1, 'exactly one device is "this device"');
  assert.equal(S.devices.filter((d) => d.kind === 'child').length, 2);
  assert.ok(S.devices.some((d) => d.kind === 'child' && d.device === 'iPhone'));
  assert.ok(
    S.devices.every((d) => d.who),
    'every device names its owner',
  );
  assert.equal((await srv.api(child1.jar, '/api/state')).json.devices, undefined);
  assert.equal(
    (await srv.api(child1.jar, '/api/session/revoke', { id: S.devices[0].id })).status,
    403,
  );

  // A second parent device: same account, signed in again.
  const again = require('./helpers').jar();
  assert.ok((await srv.signIn(again, 'google', f.who)).ok);
  const D = (await srv.api(f.jar, '/api/state')).json.devices;
  const child2Id = D.filter((d) => d.kind === 'child')
    .map((d) => d.id)
    .sort((a, b) => b - a)[0];
  const r = await srv.api(f.jar, '/api/session/revoke', { id: child2Id });
  assert.equal(r.json.devices.length, D.length - 1);
  assert.equal(
    (await srv.api(child2.jar, '/api/state')).status,
    401,
    'revoked device is logged out',
  );
  assert.equal((await srv.api(child1.jar, '/api/state')).status, 200, 'other devices stay');

  const meId = (await srv.api(again, '/api/state')).json.devices.find((d) => d.me).id;
  const own = await srv.api(again, '/api/session/revoke', { id: meId });
  assert.equal(own.status, 401);
  assert.match(own.headers.get('set-cookie'), new RegExp(`^${SESSION}=;.*Max-Age=0`));
  assert.equal((await srv.api(again, '/api/state')).status, 401);
  assert.equal((await srv.api(f.jar, '/api/state')).status, 200, 'other parent devices stay');
  assert.equal((await srv.api(f.jar, '/api/session/revoke', { id: 999999 })).status, 404);
});

test('logging out ends only that session', async () => {
  const f = await srv.newFamily({ child: 'Out' });
  const dev = await srv.pairChild(f.jar, f.childId);
  const r = await srv.api(dev.jar, '/api/logout', {});
  assert.equal(r.status, 200);
  assert.match(r.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await srv.api(dev.jar, '/api/state')).status, 401);
  assert.equal((await srv.api(f.jar, '/api/state')).status, 200);
});

test('request bodies over 10 KB are refused with 413 and the server carries on', async () => {
  const big = JSON.stringify({ kind: 'target', name: 'x', note: 'y'.repeat(20000) });
  assert.equal((await post('/api/item/save', big)).status, 413);
  assert.equal((await srv.api(null, '/api/pair', big)).status, 413, 'also before sign-in');
  assert.equal((await state()).role, 'parent', 'still fine afterwards');
  assert.equal(
    (await post('/api/item/save', { kind: 'target', name: 'ok', note: 'y'.repeat(3000) })).status,
    200,
    'normal-size bodies are handled',
  );
});

test('bad JSON and unknown routes do not crash the server', async () => {
  assert.equal(
    (await post('/api/item/save', '{not json')).status,
    400,
    'bad JSON is an empty body',
  );
  assert.equal((await post('/api/nope', {})).status, 404);
  assert.equal((await srv.api(P.jar, '/api/nope')).status, 404);
  assert.equal((await state()).role, 'parent');
});

test('writes must be JSON from this site: type, Origin and Sec-Fetch-Site are checked', async () => {
  const body = { family_id: 1, name: 'Guard', timezone: 'UTC' };
  const t = item(await state(), 'target');
  const url = '/api/item/delete';
  const bad = { id: t.id };
  assert.equal(
    (await srv.api(P.jar, url, JSON.stringify(bad), { contentType: 'text/plain' })).status,
    415,
  );
  assert.equal((await srv.api(P.jar, url, JSON.stringify(bad), { contentType: '' })).status, 415);
  assert.equal((await srv.api(null, '/api/pair', '{}', { contentType: 'text/plain' })).status, 415);
  for (const [name, headers] of [
    ['foreign Origin', { Origin: 'https://evil.example' }],
    ['cross-site fetch', { 'Sec-Fetch-Site': 'cross-site' }],
    ['null Origin', { Origin: 'null' }],
  ]) {
    const r = await srv.api(P.jar, url, bad, { headers });
    assert.equal(r.status, 403, name);
  }
  assert.ok(
    (await state()).items.some((i) => i.id === t.id),
    'the refused writes changed nothing',
  );
  const ok = await srv.api(P.jar, '/api/family/save', body, {
    headers: { Origin: srv.base, 'Sec-Fetch-Site': 'same-origin' },
  });
  assert.equal(ok.status, 200, 'same Origin is fine');
  assert.equal(
    (
      await srv.api(
        P.jar,
        '/api/family/save',
        { ...body, name: 'Api Family' },
        { contentType: 'application/json; charset=utf-8' },
      )
    ).status,
    200,
  );
  assert.equal(
    (await srv.api(P.jar, url, bad, { headers: { 'Sec-Fetch-Site': 'same-site' } })).status,
    200,
  );
});

test('a write route answers 404 to GET and 405 to other methods', async () => {
  assert.equal((await srv.api(P.jar, '/api/item/save')).status, 404);
  assert.equal((await srv.api(P.jar, '/api/undo')).status, 404);
  for (const method of ['PUT', 'DELETE', 'PATCH']) {
    const r = await srv.api(P.jar, '/api/item/save', '{}', { method });
    assert.equal(r.status, 405, method);
    assert.equal(r.headers.get('allow'), 'GET, POST');
  }
  const r = await fetch(`${srv.base}/api/config`);
  assert.deepEqual((await r.json()).providers.sort(), ['github', 'google']);
});

test('data survives a restart and sessions stay valid', async () => {
  const before = await state();
  const kidBefore = await state(kid);
  await srv.restart();
  const after = await state();
  assert.equal(after.balance, before.balance);
  assert.equal(after.stars, before.stars);
  assert.equal(after.items.length, before.items.length);
  assert.deepEqual(after.hist, before.hist);
  assert.equal((await state(kid)).balance, kidBefore.balance);
});
